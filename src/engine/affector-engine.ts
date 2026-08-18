// ============================================================
// engine/affector-engine.ts — Affector 生命周期管理
//
// 可知性/可达性层级的最末层：生效（AccessStage.active）。
// 已挂载的效果体由 condition 决定 Latent/Active，每 tick 全量重估，
// Active 才应用效果。
// ============================================================

import {
  AffectorInstance,
  AffectorPackDef,
  AffectorState,
  PlayerState,
  SpotFunctionalityDef,
  SpotId,
  Effect,
  Expr,
  value,
} from './types';
import { Registry } from './registry';
import { ConditionSystem } from './condition-system';
import { StateMutationService } from './state-mutation-service';
import { EffectEngine } from './effect-engine';
import { SpotFunctionalitySystem } from './spot-functionality';
import { EventBus } from './event-bus';

export class AffectorEngine {
  private readonly packs = new Map<string, AffectorPackDef>();
  private readonly instances = new Map<string, AffectorInstance>();
  private state: PlayerState | null = null;

  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem: ConditionSystem,
    private readonly mutations: StateMutationService,
    private readonly eventBus?: EventBus,
    private readonly effectEngine?: EffectEngine,
    private readonly functionalitySystem?: SpotFunctionalitySystem,
  ) {
    if (!eventBus) return;
    eventBus.on('itemCollected', event => {
      if (event.count > 0) this.mountItemAffectors(event.itemId);
      else if (event.count < 0) this.unmountEntity(event.itemId, 'item removed');
    });
    eventBus.on('spotLevelChanged', event => {
      this.recheckByEntity(event.spotId);
      // Spot 功能 Affector：解锁/升级时同步（外源功能随 Enhancement 变化），归零时卸载
      if (event.newLevel > 0) this.syncSpotFunctionalities(event.spotId);
      else this.unmountEntity(event.spotId, 'spot level zero');
    });
    // 外源功能 + 自有 Affector：Enhancement 获得/移除时同步
    eventBus.on('enhancementAdded', event => {
      this.mountEnhancementAffectors(event.enhancementId);
      this.syncAllSpotFunctionalities();
    });
    eventBus.on('enhancementRemoved', event => {
      this.unmountEntity(event.enhancementId, 'enhancement removed');
      this.syncAllSpotFunctionalities();
    });
    // Spot 动态 Tag 变化也可能改变外源功能命中范围
    eventBus.on('spotTagChanged', () => this.syncAllSpotFunctionalities());
  }

  load(packs: AffectorPackDef[]): void {
    this.packs.clear();
    for (const pack of packs) this.packs.set(pack.id, pack);
  }

  /** 运行时注册数据包之外的 Affector pack（如由 Spot 功能动态构造）。 */
  registerPack(pack: AffectorPackDef): void {
    this.packs.set(pack.id, pack);
  }

  setState(state: PlayerState): void {
    this.state = state;
    this.mutations.setState(state);
    if (this.effectEngine) this.effectEngine.setState(state);
  }

  mount(packId: string, mountEntityId: string): AffectorInstance | null {
    if (!this.packs.has(packId) || !this.state) return null;
    const instance: AffectorInstance = {
      instanceId: `${packId}@${mountEntityId}`,
      packId,
      mountEntityId,
      state: 'Latent',
      activeEntryIds: [],
    };
    this.instances.set(instance.instanceId, instance);
    this.recheck(instance.instanceId);
    this.eventBus?.emit({
      type: 'affectorMounted',
      instanceId: instance.instanceId,
      packId,
      mountEntityId,
    });
    return instance;
  }

  unmount(instanceId: string, reason = 'unmounted'): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    const oldState = instance.state;
    instance.state = 'Removed';
    instance.activeEntryIds = [];
    this.eventBus?.emit({
      type: 'affectorStateChanged',
      instanceId,
      oldState,
      newState: 'Removed',
    });
    this.eventBus?.emit({ type: 'affectorUnmounted', instanceId, reason });
    return true;
  }

  recheck(instanceId: string): AffectorState | null {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.state === 'Removed' || !this.state) return instance?.state ?? null;
    const pack = this.packs.get(instance.packId);
    if (!pack) return null;

    const activeEntryIds = pack.entries
      .filter(entry => !entry.condition || this.conditionSystem.evaluateGroup(entry.condition, this.state!))
      .map(entry => entry.id);
    const oldState = instance.state;
    instance.activeEntryIds = activeEntryIds;
    instance.state = activeEntryIds.length > 0 ? 'Active' : 'Latent';
    if (oldState !== instance.state) {
      this.eventBus?.emit({
        type: 'affectorStateChanged',
        instanceId,
        oldState,
        newState: instance.state,
      });
    }
    return instance.state;
  }

  recheckAll(): void {
    for (const instance of this.instances.values()) this.recheck(instance.instanceId);
  }

  getInstance(instanceId: string): AffectorInstance | undefined {
    return this.instances.get(instanceId);
  }

  getPack(packId: string): AffectorPackDef | undefined {
    return this.packs.get(packId);
  }

  getActiveInstances(): AffectorInstance[] {
    return [...this.instances.values()].filter(instance => instance.state === 'Active');
  }

  /**
   * 扫描所有活跃 Affector 的 setSpotMaxLevel / removeSpotMaxLevel 效果，
   * 返回按优先级解析后的 maxLevel 覆盖表。
   *
   * 优先级：
   *  1. removeSpotMaxLevel → 无限制 （最高优先级）
   *  2. 多个 setSpotMaxLevel → 取最高限制值
   *  3. 无 Affector → undefined（回退 SpotDef.maxLevel）
   */
  getSpotMaxLevelOverrides(): { lifted: Set<SpotId>; maxLevels: Map<SpotId, number> } {
    const lifted = new Set<SpotId>();
    const maxLevels = new Map<SpotId, number>();

    for (const instance of this.getActiveInstances()) {
      const pack = this.packs.get(instance.packId);
      if (!pack) continue;
      for (const entry of pack.entries) {
        if (!instance.activeEntryIds.includes(entry.id)) continue;
        for (const effect of entry.effects) {
          if (effect.op === 'removeSpotMaxLevel') {
            lifted.add(effect.target);
          } else if (effect.op === 'setSpotMaxLevel') {
            const val = Number(effect.value);
            const current = maxLevels.get(effect.target) ?? 0;
            if (val > current) maxLevels.set(effect.target, val);
          }
        }
      }
    }

    // lifted 优先：已解除限制的 Spot 不需要 maxLevel
    for (const id of lifted) maxLevels.delete(id);

    return { lifted, maxLevels };
  }

  private mountItemAffectors(itemId: string): void {
    const item = this.registry.items.get(itemId);
    for (const packId of item?.affectorPackIds ?? []) {
      this.mount(packId, itemId);
    }
  }

  private mountEnhancementAffectors(enhancementId: string): void {
    const enh = this.registry.enhancements.get(enhancementId);
    for (const packId of enh?.affectorPackIds ?? []) {
      this.mount(packId, enhancementId);
    }
  }

  private unmountEntity(entityId: string, reason: string): void {
    for (const instance of this.instances.values()) {
      if (instance.mountEntityId !== entityId || instance.state === 'Removed') continue;
      this.unmount(instance.instanceId, reason);
    }
  }

  private recheckByEntity(entityId: string): void {
    for (const instance of this.instances.values()) {
      if (instance.mountEntityId === entityId) this.recheck(instance.instanceId);
    }
  }

  /**
   * 同步某 Spot 的 linearYield 功能 Affector（内源 + 外源）：挂载缺失的、卸载失效的。
   */
  private syncSpotFunctionalities(spotId: string): void {
    const spot = this.registry.spots.get(spotId);
    if (!spot || !this.state) return;
    const funcs = this.functionalitySystem?.functionalitiesOf(spot, this.state) ?? spot.functionalities ?? [];

    // 卸载已不再匹配的功能实例
    for (const instance of [...this.instances.values()]) {
      if (instance.mountEntityId !== spotId || instance.state === 'Removed') continue;
      if (funcs.some(fn => fn.id === instance.packId)) continue;
      this.unmount(instance.instanceId, 'functionality removed');
    }
    // 挂载缺失的线性功能
    for (const fn of funcs) {
      if (fn.kind !== 'linearYield') continue;
      if (!this.packs.has(fn.id)) this.registerPack(this.buildSpotFunctionalityPack(spotId, fn));
      const instanceId = `${fn.id}@${spotId}`;
      if (!this.instances.has(instanceId)) this.mount(fn.id, spotId);
    }
  }

  /** 同步全部 Spot 的功能挂载（外源 Enhancement 变化 / Tag 变化时）。 */
  private syncAllSpotFunctionalities(): void {
    for (const spot of this.registry.spots.values()) this.syncSpotFunctionalities(spot.id);
  }

  private buildSpotFunctionalityPack(spotId: string, fn: SpotFunctionalityDef): AffectorPackDef {
    const effect: Effect = {
      op: 'addResource',
      target: fn.resource ?? '',
      value: Expr.mul(
        Expr.val(value('spotLevel', { spot: spotId })),
        Expr.const(fn.amountPerLevel ?? 0),
      ),
    };
    return {
      id: fn.id,
      entries: [{ id: fn.id, condition: fn.condition, effects: [effect] }],
    };
  }

  applyActiveEffects(): void {
    if (!this.state) return;
    // 条件可能由统计驱动（如累计产出阈值），每 tick 先全量重估保证最新
    for (const instance of [...this.instances.values()]) this.recheck(instance.instanceId);
    for (const instance of this.getActiveInstances()) {
      const pack = this.packs.get(instance.packId);
      if (!pack) continue;
      for (const entry of pack.entries) {
        if (!instance.activeEntryIds.includes(entry.id)) continue;
        // addResource 合流进资源的 primitiveGain（GameNum 懒求值），此处只执行其余效果
        const nonResourceEffects = entry.effects.filter(
          effect => effect.op !== 'addResource' && effect.op !== 'setSpotMaxLevel' && effect.op !== 'removeSpotMaxLevel',
        );
        if (nonResourceEffects.length === 0) continue;
        if (this.effectEngine) this.effectEngine.applyEffects(nonResourceEffects);
        else this.mutations.applyEffects(nonResourceEffects);
      }
    }
  }
}
