// ============================================================
// arona-clicker/services/spot-service.ts — Spot 操作服务
//
// 从 GameInstance 拆出：Spot 购买/升级/管理/产出/等级上限/Tag 操作。
// GameInstance 以门面形式委托本服务，保持公开 API 不变。
// ============================================================

import type {
  SpotId,
} from '../../engine/types';
import type { SpotDef } from '../../data-services/contracts/world';
import type { PaymentOptionDef } from '../../data-services/contracts/cost';
import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { PlayerState } from '../types/state';
import type { SpotUpgradeResult, SpotUnlockResult } from '../contracts/results';
import type { TagPath } from '../../engine/core/tag';
import { Registry } from '../../data-services/registry/registry';
import { ValueSystem } from '../../engine/expression/value-system';
import { ConditionSystem } from '../../engine/expression/condition-system';
import type { SpotMutationPort } from '../contracts/mutation';
import { EffectEngine } from '../../engine/effect/effect-engine';
import { CharacterSystem } from './character-system';
import { AffectorEngine } from '../../engine/effect/affector-engine';
import { EventBus } from '../../engine/core/event-bus';
import { DevLog } from '../../engine/core/dev-log';
import { tagDisplay, tagKey } from '../../engine/core/tag';
import { SpotContentService } from './spot-content-service';
import { PaymentService, type PaymentOptionView, type PaymentSelection } from './payment-service';

export interface SpotServiceOptions {
  registry: Registry;
  valueSystem: ValueSystem;
  conditionSystem: ConditionSystem;
  mutations: SpotMutationPort;
  effectEngine: EffectEngine;
  characterSystem: CharacterSystem;
  affectorEngine: AffectorEngine;
  eventBus: EventBus;
  devLog: DevLog;
  getState: () => PlayerState;
  getVisibility: () => VisibilitySnapshot;
  /** 强制重算可见性快照（平时由 EventBus 事件驱动增量更新）。 */
  refreshVisibility: () => void;
  /** 读取资源持有量：全局资源 + 当前世界线局部资源（局部优先覆盖同名）。 */
  getResourceAmount: (resourceId: string) => number;
}

export class SpotService {
  private contentService: SpotContentService | undefined;

  private readonly paymentService: PaymentService;

  constructor(private readonly opts: SpotServiceOptions) {
    this.paymentService = new PaymentService({
      values: opts.valueSystem,
      conditions: opts.conditionSystem,
      getResourceAmount: opts.getResourceAmount,
    });
  }

  /** Runtime 内容编辑门面；普通 GameInstance 未接入 Runtime 编辑时为空。 */
  get content(): SpotContentService | undefined {
    return this.contentService;
  }

  setContentService(contentService: SpotContentService): void {
    this.contentService = contentService;
  }

  private get state(): PlayerState {
    return this.opts.getState();
  }

  /** 查询当前 Spot 操作的支付方案；只读，不写状态。 */
  getPaymentOptions(spotId: string, action: 'unlock' | 'upgrade'): readonly PaymentOptionView[] {
    const spotDef = this.registry.spots.get(spotId);
    if (!spotDef) return [];
    const options = this.paymentOptionDefs(spotDef, action);
    return this.paymentService.evaluate(options, this.state);
  }

  /** 升级 Spot：通用公式 + levelUpgrades 效果叠加。 */
  upgradeSpot(spotId: string, paymentOptionId?: string): SpotUpgradeResult {
    const spotDef = this.registry.spots.get(spotId);
    if (!spotDef) {
      this.devLog.record(`升级失败：${spotId}`, { source: 'spot', level: 'error', details: 'NotFound' });
      return { success: false, spotId, error: 'NotFound' };
    }

    const currentLevel = this.state.spotLevels[spotId] ?? 0;
    if (currentLevel <= 0) {
      return { success: false, spotId, error: 'NotOwned' };
    }
    const nextLevel = currentLevel + 1;

    // ── 等级上限检查 ──
    const maxLevel = this.getEffectiveMaxLevel(spotId);
    if (maxLevel !== undefined && nextLevel > maxLevel) {
      this.devLog.record(`升级失败：${spotDef.name}`, {
        source: 'spot', level: 'warning',
        details: `已达上限 Lv.${maxLevel}`,
      });
      return { success: false, spotId, error: 'MaxLevel' };
    }

    // ── 条件与效果（levelUpgrades 中查下一级） ──
    const upgrade = (spotDef.levelUpgrades ?? []).find(u => u.level === nextLevel);
    if (upgrade?.condition) {
      if (!this.conditionSystem.evaluateGroup(upgrade.condition, this.state)) {
        this.devLog.record(`升级失败：${spotDef.name}`, {
          source: 'spot', level: 'warning', details: 'ConditionNotMet',
        });
        return { success: false, spotId, error: 'ConditionNotMet' };
      }
    }

    const selection = this.selectPayment(spotDef, 'upgrade', paymentOptionId);
    if (!selection.ok) {
      // 无通用公式 且 无下一级定义 → 无法升级
      this.devLog.record(`升级失败：${spotDef.name}`, {
        source: 'spot', level: 'warning', details: selection.error,
      });
      return this.paymentFailure(spotId, selection);
    }

    // ── 扣费 + 升级：同一原子提交，避免多项成本出现部分写入 ──
    this.mutations.commitSpotTransaction({
      spotId,
      newLevel: nextLevel,
      resourceDeltas: this.negate(selection.option.resourceCosts),
      itemDeltas: this.negate(selection.option.itemCosts),
    });

    // ── 执行升级效果（levelUpgrades 中定义） ──
    if (upgrade && upgrade.effects.length > 0) {
      this.effectEngine.applyEffects(upgrade.effects);
    }

    this.opts.refreshVisibility();
    this.affectorEngine.recheckAll();

    this.devLog.record(`${spotDef.name} 已升级至 Lv.${nextLevel}`, {
      source: 'spot',
      level: 'success',
      details: `消耗 ${this.paymentDescription(selection.option)}${maxLevel ? ` (上限 Lv.${maxLevel})` : ''}`,
      frame: this.state.totalFrames,
    });
    return { success: true, spotId, newLevel: nextLevel };
  }

  /**
   * 获取某个 Spot 的有效等级上限。
   *
   * 优先级（由高到低）：
   *  1. 活跃 Affector 的 removeSpotMaxLevel → 无限制（返回 undefined）
   *  2. 活跃 Affector 的 setSpotMaxLevel → 取所有限制中的最高值
   *  3. SpotDef.maxLevel（Spot 自身定义的上限）
   *  4. 以上皆无 → undefined（无限制）
   */
  getEffectiveMaxLevel(spotId: string): number | undefined {
    const overrides = this.affectorEngine.getSpotMaxLevelOverrides();

    // 1. 已解除限制
    if (overrides.lifted.has(spotId)) return undefined;

    // 2. Affector 设定的限制
    const affLimit = overrides.maxLevels.get(spotId);
    if (affLimit !== undefined) return affLimit;

    // 3. Spot 自身定义的上限
    const spotDef = this.registry.spots.get(spotId);
    return spotDef?.maxLevel;
  }

  /**
   * 手动解锁 Spot（购买，可达性层）：可见 → 资源足够 → 拥有（level = 1）。
   */
  unlockSpot(spotId: string, paymentOptionId?: string): SpotUnlockResult {
    const spotDef = this.registry.spots.get(spotId);
    if (!spotDef) return { success: false, spotId, error: 'NotFound' };

    if ((this.state.spotLevels[spotId] ?? 0) > 0)
      return { success: false, spotId, error: 'AlreadyOwned' };

    // 检查可见性
    if (!this.opts.getVisibility().spots[spotId])
      return { success: false, spotId, error: 'NotVisible' };

    // 检查等级上限（上限为 0 = 不可解锁）
    const maxLevel = this.getEffectiveMaxLevel(spotId);
    if (maxLevel !== undefined && maxLevel < 1)
      return { success: false, spotId, error: 'MaxLevel' };

    const selection = this.selectPayment(spotDef, 'unlock', paymentOptionId);
    if (!selection.ok) return this.paymentFailure(spotId, selection);

    // 扣费 + 解锁 (设置 level = 1)：同一原子提交
    this.mutations.commitSpotTransaction({
      spotId,
      newLevel: 1,
      resourceDeltas: this.negate(selection.option.resourceCosts),
      itemDeltas: this.negate(selection.option.itemCosts),
    });

    this.opts.refreshVisibility();
    return { success: true, spotId };
  }

  /** 运行时给 Spot 新加入一个 Tag：Enhancement 按 Tag 作用、tag 条件即时更新。 */
  addSpotTag(spotId: string, tag: TagPath): boolean {
    if (this.hasEffectiveTag(spotId, tag)) return false;
    this.mutations.applySpotTagChange(spotId, tag, true);
    this.afterSpotTagChange(spotId, tag, true);
    return true;
  }

  /** 运行时让 Spot 撤出一个 Tag：相关按 Tag 作用即时失效。 */
  removeSpotTag(spotId: string, tag: TagPath): boolean {
    if (!this.hasEffectiveTag(spotId, tag)) return false;
    this.mutations.applySpotTagChange(spotId, tag, false);
    this.afterSpotTagChange(spotId, tag, false);
    return true;
  }

  /** 当前有效 tags（声明 + 运行时增撤）是否已含该 tag。 */
  private hasEffectiveTag(spotId: string, tag: TagPath): boolean {
    return this.registry.effectiveSpotTags(spotId, this.opts.getState().spotTagOverrides)
      .some(t => this.registry.tagKeyForSpotTag(spotId, t) === tagKey(tag));
  }

  private afterSpotTagChange(spotId: string, tag: TagPath, added: boolean): void {
    this.opts.refreshVisibility();
    this.affectorEngine.recheckAll();
    this.devLog.record(
      `${added ? '加入' : '撤出'}标签 ${tagDisplay(tag)}：${this.registry.spots.get(spotId)?.name ?? spotId}`,
      { source: 'spot', level: 'info', details: added ? 'tag added' : 'tag removed' },
    );
  }

  // --- 依赖别名 ---

  private get registry() { return this.opts.registry; }
  private get valueSystem() { return this.opts.valueSystem; }
  private get conditionSystem() { return this.opts.conditionSystem; }
  private get mutations() { return this.opts.mutations; }
  private get effectEngine() { return this.opts.effectEngine; }
  private get characterSystem() { return this.opts.characterSystem; }
  private get affectorEngine() { return this.opts.affectorEngine; }
  private get eventBus() { return this.opts.eventBus; }
  private get devLog() { return this.opts.devLog; }

  private paymentOptionDefs(spotDef: SpotDef, action: 'unlock' | 'upgrade'): readonly PaymentOptionDef[] {
    if (action === 'unlock') return spotDef.purchaseOptions;
    const nextLevel = (this.state.spotLevels[spotDef.id] ?? 0) + 1;
    const upgrade = (spotDef.levelUpgrades ?? []).find(item => item.level === nextLevel);
    return upgrade?.paymentOptions ?? [];
  }

  private selectPayment(spotDef: SpotDef, action: 'unlock' | 'upgrade', paymentOptionId?: string): PaymentSelection {
    return this.paymentService.select(this.paymentOptionDefs(spotDef, action), this.state, paymentOptionId, action === 'unlock' && spotDef.purchaseOptions.length === 0 ? 'no-route' : 'not-declared');
  }

  private paymentFailure(spotId: string, selection: Extract<PaymentSelection, { ok: false }>): {
    success: false;
    spotId: string;
    error: 'InsufficientResource' | 'PaymentNotDeclared' | 'NoPurchaseRoute' | 'PaymentOptionRequired' | 'PaymentOptionNotFound' | 'PaymentConditionNotMet' | 'InvalidPayment';
    paymentOptionIds?: string[];
  } {
    const error = selection.error === 'not-declared'
      ? 'PaymentNotDeclared'
      : selection.error === 'no-route'
        ? 'NoPurchaseRoute'
        : selection.error === 'option-required'
        ? 'PaymentOptionRequired'
        : selection.error === 'option-not-found'
          ? 'PaymentOptionNotFound'
          : selection.error === 'condition-failed'
            ? 'PaymentConditionNotMet'
            : selection.error === 'invalid'
              ? 'InvalidPayment'
              : 'InsufficientResource';
    return {
      success: false,
      spotId,
      error,
      ...(selection.error === 'option-required'
        ? { paymentOptionIds: selection.options.filter(option => option.status === 'available').map(option => option.id) }
        : {}),
    };
  }

  private negate(costs: Readonly<Record<string, number>>): Record<string, number> {
    return Object.fromEntries(Object.entries(costs).map(([id, amount]) => [id, -amount]));
  }

  private paymentDescription(option: PaymentOptionView): string {
    return option.costs.length > 0
      ? option.costs.map(cost => `${cost.required} ${cost.id}`).join('、')
      : '免费';
  }
}
