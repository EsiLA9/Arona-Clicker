// ============================================================
// engine/visibility-engine.ts — 可见性引擎（事件驱动，编排层）
//
// 以 EventBus（trigger-eventbus 底层）为唯一驱动源：
//   反向索引构建 → visibility/index.ts；事件→受影响实体 → index.collectAffected；
//   求值（existenceMet / evaluateEntity / 整类重算）→ visibility/eval.ts。
// 本文件仅保留：快照持有 + 增量 dirty 标记 + 对外 API 编排。
// ============================================================

import { InitId, AreaId, SpotId, EnhancementId, GameEvent } from '../types';
import type { VisibilitySnapshot } from '../contracts/reveal';
import type { ConditionState } from '../contracts/state-query';
import type { RevealRegistryContext } from '../contracts/reveal';
import { ConditionSystem } from '../expression/condition-system';
import { EventBus } from '../core/event-bus';
import { VisibilityIndex } from './visibility-index';
import { VisibilityEval, EntityKind, EntityKey, emptySnapshot } from './visibility-eval';
import { EventDrivenReactor } from '../effect/event-driven-reactor';
import { CONDITION_DEP_EVENT_TYPES } from '../expression/condition-deps';

export class VisibilityEngine extends EventDrivenReactor {
  private index: VisibilityIndex;
  private eval: VisibilityEval;

  private snapshot: VisibilitySnapshot = emptySnapshot();
  private dirty = new Set<EntityKey>();
  private dirtyAll = false;

  constructor(registry: RevealRegistryContext, conditionSystem: ConditionSystem, eventBus: EventBus) {
    super(eventBus);
    this.index = new VisibilityIndex(registry);
    this.eval = new VisibilityEval(registry, conditionSystem);
    // 分桶订阅条件依赖可能声明的全部事件类型（超集，构造期即生效，
    // 保证存档恢复等不经 rebuild 的路径也能持续标脏）
    this.subscribeTo(CONDITION_DEP_EVENT_TYPES);
  }

  // --- 对外 API ---

  /** 重建反向索引并全量重算（注册表加载/热替换后调用）。 */
  rebuild(state: ConditionState): void {
    this.index.build();
    this.recomputeAll(state);
  }

  /** 读取快照；如有脏实体则增量重算后返回（最终一致）。 */
  getVisibility(state: ConditionState): VisibilitySnapshot {
    if (this.dirtyAll) {
      this.recomputeAll(state);
      return this.snapshot;
    }
    if (this.dirty.size > 0) {
      for (const key of this.dirty) {
        const idx = key.indexOf(':');
        const kind = key.slice(0, idx) as EntityKind;
        const id = key.slice(idx + 1);
        this.snapshot[kind]![id] = this.eval.evaluateEntity(kind, id, state);
      }
      this.dirty.clear();
    }
    return this.snapshot;
  }

  /** 强制全量重算（存档迁移、调试、stat 边缘情形兜底）。 */
  recomputeAll(state: ConditionState): void {
    this.snapshot = {
      inits: this.eval.recomputeCategory(state, 'inits'),
      areas: this.eval.recomputeCategory(state, 'areas'),
      spots: this.eval.recomputeCategory(state, 'spots'),
      enhancements: this.eval.recomputeCategory(state, 'enhancements'),
      items: this.eval.recomputeCategory(state, 'items'),
      // 故事入口可见性由 triggerCondition 控制，此处始终保持可见（与旧语义一致）
      stories: this.eval.allTrue(this.eval.allStoryEntryKeys()),
    };
    this.dirty.clear();
    this.dirtyAll = false;
  }

  // 重置为默认空快照（不立即重算）。随后 enterInit / refreshVisibility 会全量重建，
  // 与「reset 清空可见性、由后续进入世界线重新计算」的既有契约一致。
  reset(): void {
    this.snapshot = emptySnapshot();
    this.dirty.clear();
    this.dirtyAll = false;
  }

  /** 清空 spots/areas（世界线切换时调用）：下次读取全量重算以保证一致。 */
  clearLocal(): void {
    this.snapshot.spots = {};
    this.snapshot.areas = {};
    this.dirtyAll = true;
  }

  /** 直接恢复存档快照（load 时调用）。 */
  setSnapshot(snapshot: VisibilitySnapshot): void {
    this.snapshot = snapshot;
    this.dirty.clear();
    this.dirtyAll = false;
  }

  // 入口门槛查询需对「当前 registry + state」实时求值（移动/解锁等正确性关键路径），
  // 不走增量缓存，避免注册表直接变更或非事件态变更造成缓存陈旧。
  isInitVisible(initId: InitId, state: ConditionState): boolean {
    return this.eval.evaluateEntity('inits', initId, state);
  }

  isAreaVisible(areaId: AreaId, state: ConditionState): boolean {
    return this.eval.evaluateEntity('areas', areaId, state);
  }

  isSpotVisible(spotId: SpotId, state: ConditionState): boolean {
    return this.eval.evaluateEntity('spots', spotId, state);
  }

  isEnhancementVisible(enhId: EnhancementId, state: ConditionState): boolean {
    return this.eval.evaluateEntity('enhancements', enhId, state);
  }

  // --- 事件订阅（仅自增标脏）---

  protected onEvent(_type: GameEvent['type'], e: GameEvent): void {
    for (const key of this.index.collectAffected(e)) this.dirty.add(key);
  }
}
