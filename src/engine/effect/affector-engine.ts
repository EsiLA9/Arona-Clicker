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
  AffectorPackRef,
  AffectorState,
  GameEvent,
  PlayerState,
  SpotFunctionalityDef,
  SpotId,
  Expr,
  value,
} from '../types';
import { Registry } from '../registry/registry';
import { ConditionSystem } from '../expression/condition-system';
import { StateMutationService } from '../system/state-mutation-service';
import { EffectEngine } from './effect-engine';
import { SpotFunctionalitySystem } from '../system/spot-functionality';
import { EventBus } from '../core/event-bus';
import { EventDrivenReactor } from './event-driven-reactor';
import { CONDITION_DEP_EVENT_TYPES, ConditionDepIndex } from '../expression/condition-deps';
import { deriveAnonymousId } from '../core/anonymous-id';
import type { DevLog } from '../core/dev-log';
import type { GameNumSystem } from '../expression/game-num';

export class AffectorEngine extends EventDrivenReactor {
  private readonly packs = new Map<string, AffectorPackDef>();
  private readonly instances = new Map<string, AffectorInstance>();
  /** 实例 id → 其 entry 条件的事件依赖（命中即定向 recheck，替代全量重估）。 */
  private readonly condDeps = new ConditionDepIndex<string>();
  /** 条件含 stat/未知 target 的实例：事件无法精确命中，保留每 Tick 轮询。 */
  private readonly pollingInstances = new Set<string>();
  private state: PlayerState | null = null;
  /** 可选：接入后把按 tag 的加成转写为 GameNum tag 效果（经 syncAffectorZoneEffects）。 */
  gameNumSystem?: GameNumSystem;
  /** 可选：数据包校验警告（entry id 重复等）的日志出口，由宿主注入。 */
  devLog?: DevLog;
  /** getSpotMaxLevelOverrides 结果缓存（recheck/unmount 时失效）。 */
  private maxLevelOverridesCache: { lifted: Set<SpotId>; maxLevels: Map<SpotId, number> } | null = null;

  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem: ConditionSystem,
    private readonly mutations: StateMutationService,
    eventBus?: EventBus,
    private readonly effectEngine?: EffectEngine,
    private readonly functionalitySystem?: SpotFunctionalitySystem,
  ) {
    super(eventBus ?? new EventBus());
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
    // entry 条件新鲜度：分桶订阅条件可能声明的事件，命中即定向 recheck
    this.subscribeTo(CONDITION_DEP_EVENT_TYPES);
  }

  /** EventDrivenReactor 命中入口：条件依赖命中的实例定向重估。 */
  protected onEvent(_type: GameEvent['type'], event: GameEvent): void {
    for (const instanceId of this.condDeps.affected(event)) this.recheck(instanceId);
  }

  /**
   * 合并加载数据包级 Affector pack（多 Datapack 叠加：后加载的包覆盖同名 id，
   * 即「以新加载的 Datapack 为第一判断依据」）。调用方在整体替换（reload）时须先 clear()。
   */
  load(packs: AffectorPackDef[]): void {
    for (const pack of packs) {
      this.warnDuplicateEntryIds(pack);
      this.packs.set(pack.id, pack);
    }
  }

  /** 清空全部 pack 注册（整体替换数据包时使用）。 */
  clear(): void {
    this.packs.clear();
  }

  /** 运行时注册数据包之外的 Affector pack（如由 Spot 功能动态构造）。 */
  registerPack(pack: AffectorPackDef): void {
    this.warnDuplicateEntryIds(pack);
    this.packs.set(pack.id, pack);
  }

  /** entry id 重复 → 同 id 会被 activeEntryIds 隐式视为同时激活（04h §3.2），数据包作者需知悉。 */
  private warnDuplicateEntryIds(pack: AffectorPackDef): void {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const entry of pack.entries) {
      if (seen.has(entry.id)) dupes.add(entry.id);
      seen.add(entry.id);
    }
    if (dupes.size === 0) return;
    const message = `AffectorPack ${pack.id} 存在重复 entry id：${[...dupes].join('、')}（同 id entry 会被视为同时激活）`;
    if (this.devLog) this.devLog.record(message, { source: 'affector', level: 'warning' });
    else console.warn(`[Affector] ${message}`);
  }

  setState(state: PlayerState): void {
    this.state = state;
    this.mutations.setState(state);
    if (this.effectEngine) this.effectEngine.setState(state);
  }

  mount(packRef: AffectorPackRef, mountEntityId: string): AffectorInstance | null {
    if (!this.state) return null;
    // 解析引用：内联完整包 → 派生/采用其 id 并注册；id 字符串 → 查已注册表
    let packId: string;
    let pack: AffectorPackDef | undefined;
    if (typeof packRef === 'string') {
      packId = packRef;
      pack = this.packs.get(packId);
      if (!pack) return null;
    } else {
      pack = packRef;
      packId = pack.id?.trim() ? pack.id : deriveAnonymousId('anon:pack', pack);
      if (!this.packs.has(packId)) this.packs.set(packId, pack); // 内联包先注册（同 id 不重复覆盖）
    }
    const instanceId = `${packId}@${mountEntityId}`;
    // 幂等（04h §3.3）：实例已存在（如重复获得同一物品再次触发 itemCollected）→
    // 只 recheck 不重建，避免新实例 Latent→Active 翻转重复发放一次性 effects
    const existing = this.instances.get(instanceId);
    if (existing && existing.state !== 'Removed') {
      this.recheck(instanceId);
      return existing;
    }
    const instance: AffectorInstance = {
      instanceId,
      packId,
      mountEntityId,
      state: 'Latent',
      activeEntryIds: [],
    };
    this.instances.set(instance.instanceId, instance);
    this.registerConditionDeps(instance.instanceId, packId);
    this.recheck(instance.instanceId);
    if (this.gameNumSystem) this.gameNumSystem.syncAffectorZoneEffects(this, this.state);
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
    this.maxLevelOverridesCache = null;
    const oldState = instance.state;
    instance.state = 'Removed';
    instance.activeEntryIds = [];
    this.condDeps.unregister(instanceId);
    this.pollingInstances.delete(instanceId);
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
    this.maxLevelOverridesCache = null;

    const activeEntryIds = pack.entries
      .filter(entry => !entry.condition || this.conditionSystem.evaluateGroup(entry.condition, this.state!))
      .map(entry => entry.id);
    const oldState = instance.state;
    instance.activeEntryIds = activeEntryIds;
    instance.state = activeEntryIds.length > 0 ? 'Active' : 'Latent';
    // 激活沿（Latent→Active）一次性执行 entry.effects 全量（Phase 4.3）：
    // addResource 一次性发放，setFlag/addItem 等一次性 op 同样只在此执行一次；
    // 持续产出走 flows，每 tick 逻辑走 perTickEffects（applyActiveEffects）；
    // setSpotMaxLevel/removeSpotMaxLevel 为声明类 op，由 getSpotMaxLevelOverrides 动态读取。
    if (oldState !== 'Active' && instance.state === 'Active') {
      const grants = pack.entries
        .filter(entry => activeEntryIds.includes(entry.id))
        .flatMap(entry => entry.effects.filter(effect => effect.op !== 'setSpotMaxLevel' && effect.op !== 'removeSpotMaxLevel'));
      if (grants.length > 0) {
        if (this.effectEngine) this.effectEngine.applyEffects(grants);
        else this.mutations.applyEffects(grants);
      }
    }
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

  getPack(ref: AffectorPackRef): AffectorPackDef | undefined {
    if (typeof ref === 'string') return this.packs.get(ref);
    return ref; // 内联完整包直接返回
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
    if (this.maxLevelOverridesCache) return this.maxLevelOverridesCache;
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

    this.maxLevelOverridesCache = { lifted, maxLevels };
    return this.maxLevelOverridesCache;
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
   * pack 注册键按 fn.id@spotId 命名空间化：同一功能定义挂到多个 Spot 时各自独立，
   * flow 内嵌的 spotLevel 引用各自 Spot（避免首个注册者的等级串号）。
   */
  private syncSpotFunctionalities(spotId: string): void {
    const spot = this.registry.spots.get(spotId);
    if (!spot || !this.state) return;
    const funcs = this.functionalitySystem?.functionalitiesOf(spot, this.state) ?? spot.functionalities ?? [];

    const expectedPackIds = new Set(
      funcs.filter(fn => fn.kind === 'linearYield').map(fn => `${fn.id}@${spotId}`),
    );
    // 卸载已不再匹配的功能实例
    for (const instance of [...this.instances.values()]) {
      if (instance.mountEntityId !== spotId || instance.state === 'Removed') continue;
      if (expectedPackIds.has(instance.packId)) continue;
      this.unmount(instance.instanceId, 'functionality removed');
    }
    // 挂载缺失的线性功能
    for (const fn of funcs) {
      if (fn.kind !== 'linearYield') continue;
      const packId = `${fn.id}@${spotId}`;
      if (!this.packs.has(packId)) this.registerPack(this.buildSpotFunctionalityPack(spotId, fn));
      const instanceId = `${packId}@${spotId}`;
      if (!this.instances.has(instanceId)) this.mount(packId, spotId);
    }
  }

  /** 同步全部 Spot 的功能挂载（外源 Enhancement 变化 / Tag 变化时）。 */
  private syncAllSpotFunctionalities(): void {
    for (const spot of this.registry.spots.values()) this.syncSpotFunctionalities(spot.id);
  }

  private buildSpotFunctionalityPack(spotId: string, fn: SpotFunctionalityDef): AffectorPackDef {
    return {
      id: `${fn.id}@${spotId}`,
      entries: [{
        id: fn.id,
        condition: fn.condition,
        effects: [],
        flows: [{
          resource: fn.resource ?? '',
          value: Expr.mul(
            Expr.val(value('spotLevel', { spot: spotId })),
            Expr.const(fn.amountPerLevel ?? 0),
          ),
        }],
      }],
    };
  }

  /**
   * 登记实例全部 entry 条件的事件依赖；含 stat/未知 target 的实例转入每 Tick 轮询
   * （stat 计数变化无专属事件，见 ADR-002 rev2「stat 宽依赖收窄」）。
   */
  private registerConditionDeps(instanceId: string, packId: string): void {
    const pack = this.packs.get(packId);
    if (!pack) return;
    for (const entry of pack.entries) {
      if (this.condDeps.register(instanceId, entry.condition)) this.pollingInstances.add(instanceId);
    }
  }

  applyActiveEffects(): void {
    if (!this.state) return;
    // 条件可能由统计驱动（stat 无专属事件），仅这类实例保留每 Tick 重估；
    // 其余实例的条件翻转由事件驱动定向 recheck 保证新鲜
    for (const instanceId of [...this.pollingInstances]) this.recheck(instanceId);
    for (const instance of this.getActiveInstances()) {
      const pack = this.packs.get(instance.packId);
      if (!pack) continue;
      for (const entry of pack.entries) {
        if (!instance.activeEntryIds.includes(entry.id)) continue;
        // effects 已在激活沿一次性执行（recheck）；每 tick 只执行显式声明的 perTickEffects
        const perTick = entry.perTickEffects ?? [];
        if (perTick.length === 0) continue;
        if (this.effectEngine) this.effectEngine.applyEffects(perTick);
        else this.mutations.applyEffects(perTick);
      }
    }
    // 把按 tag 的加成（zoneModifiers）写入 GameNum tag 效果表；失活实例由其内部对账撤销
    if (this.gameNumSystem && this.state) this.gameNumSystem.syncAffectorZoneEffects(this, this.state);
  }

  /**
   * 状态 ↔ 实例对账重挂载（Phase 4.1/4.2）：按当前 PlayerState 计算期望挂载集合
   * （inventory 中已拥有物品 / unlockedEnhancements 的 affectorPackIds + 已解锁 Spot 的
   * linearYield 功能），卸载不再成立的实例、补挂缺失的实例。用于不经
   * itemCollected / enhancementAdded / spotLevelChanged 事件的状态重建路径：
   * init / enterInit（世界线切换）/ restoreFromSave / reset。
   */
  reconcileMounts(): void {
    const state = this.state;
    if (!state) return;
    const expected = new Map<string, { ref: AffectorPackRef; mountEntityId: string }>();
    const expectPacks = (entityId: string, refs: readonly AffectorPackRef[] | undefined) => {
      for (const ref of refs ?? []) {
        const packId = typeof ref === 'string' ? ref : (ref.id?.trim() ? ref.id : deriveAnonymousId('anon:pack', ref));
        expected.set(`${packId}@${entityId}`, { ref, mountEntityId: entityId });
      }
    };
    for (const [itemId, count] of Object.entries(state.inventory ?? {})) {
      if (!(count > 0)) continue;
      expectPacks(itemId, this.registry.items.get(itemId)?.affectorPackIds);
    }
    for (const enhId of state.unlockedEnhancements) {
      expectPacks(enhId, this.registry.enhancements.get(enhId)?.affectorPackIds);
    }
    for (const spotId of Object.keys(state.spotLevels)) {
      if ((state.spotLevels[spotId] ?? 0) <= 0) continue;
      for (const fn of this.spotFunctionalitiesOf(spotId)) {
        if (fn.kind !== 'linearYield') continue;
        const packId = `${fn.id}@${spotId}`;
        if (!this.packs.has(packId)) this.registerPack(this.buildSpotFunctionalityPack(spotId, fn));
        expected.set(`${packId}@${spotId}`, { ref: packId, mountEntityId: spotId });
      }
    }
    for (const instance of [...this.instances.values()]) {
      if (instance.state !== 'Removed' && !expected.has(instance.instanceId)) {
        this.unmount(instance.instanceId, 'mount condition no longer holds');
      }
    }
    for (const m of expected.values()) this.mount(m.ref, m.mountEntityId);
    if (this.gameNumSystem) this.gameNumSystem.syncAffectorZoneEffects(this, state);
  }

  private spotFunctionalitiesOf(spotId: string): SpotFunctionalityDef[] {
    const spot = this.registry.spots.get(spotId);
    if (!spot || !this.state) return [];
    return this.functionalitySystem?.functionalitiesOf(spot, this.state) ?? spot.functionalities ?? [];
  }
}
