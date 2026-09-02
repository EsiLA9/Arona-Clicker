// ============================================================
// arona-clicker/services/enhancement-service.ts — 强化领域服务（购买/移除/诊断）
// 从 GameInstance 门面拆出。稳定 API 保留在 GameInstance 上作门面委托。
// ============================================================

import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { EnhancementId } from '../../engine/types/ids';
import type { RevealTarget } from '../../engine/contracts/reveal';
import type { PlayerState } from '../types/state';
import type { EnhancementPurchaseResult } from '../contracts/results';
import { Registry } from '../../data-services/registry/registry';
import { ConditionSystem } from '../../engine/expression/condition-system';
import { EffectEngine } from '../../engine/effect/effect-engine';
import type { EnhancementMutationPort } from '../contracts/mutation';
import { AffectorEngine } from '../../engine/effect/affector-engine';
import { DevLog } from '../../engine/core/dev-log';
import { existenceCondition, unlockMet } from '../../engine/visibility/reveal';
import { condLabel, triggerLabel } from './debug-labels';

export interface EnhancementServiceOptions {
  registry: Registry;
  mutations: EnhancementMutationPort;
  conditionSystem: ConditionSystem;
  effectEngine: EffectEngine;
  affectorEngine: AffectorEngine;
  devLog: DevLog;
  getState: () => PlayerState;
  getVisibility: () => VisibilitySnapshot;
  refreshVisibility: () => void;
  recheckAllAffectors: () => void;
  getResourceAmount: (resourceId: string) => number;
}

export class EnhancementService {
  constructor(private readonly opts: EnhancementServiceOptions) {}

  /**
   * 购买并激活一个 Enhancement（可达性层）。
   * 前置校验：存在 → 可见 → 解锁条件满足 → 资源充足 → 未重复获得。
   */
  purchaseEnhancement(enhancementId: EnhancementId): EnhancementPurchaseResult {
    const state = this.opts.getState();
    const enh = this.opts.registry.enhancements.get(enhancementId);
    if (!enh) {
      this.opts.devLog.record(`获取强化失败：${enhancementId}`, { source: 'enhancement', level: 'error', details: 'NotFound' });
      return { success: false, enhancementId, error: 'NotFound' };
    }
    if (state.unlockedEnhancements.includes(enhancementId)) {
      this.opts.devLog.record(`${enh.name} 已获得`, { source: 'enhancement', level: 'warning', details: 'AlreadyOwned' });
      return { success: false, enhancementId, error: 'AlreadyOwned' };
    }
    if (!this.opts.getVisibility().enhancements[enhancementId]) {
      this.opts.devLog.record(`无法获取 ${enh.name}：尚未可见`, { source: 'enhancement', level: 'warning', details: 'NotVisible' });
      return { success: false, enhancementId, error: 'NotVisible' };
    }
    if (!unlockMet(enh.revealTriggers, c => this.opts.conditionSystem.evaluateExpr(c, state))) {
      this.opts.devLog.record(`无法获取 ${enh.name}：解锁条件未满足`, { source: 'enhancement', level: 'warning', details: 'ConditionNotMet' });
      return { success: false, enhancementId, error: 'ConditionNotMet' };
    }
    for (const cost of enh.price ?? []) {
      if (this.opts.getResourceAmount(cost.resourceId) < cost.amount) {
        this.opts.devLog.record(`无法获取 ${enh.name}：资源不足`, { source: 'enhancement', level: 'warning', details: 'InsufficientResource' });
        return { success: false, enhancementId, error: 'InsufficientResource' };
      }
    }
    for (const cost of enh.price ?? []) {
      this.opts.mutations.changeResource(cost.resourceId, -cost.amount);
    }
    this.opts.mutations.addEnhancement(enhancementId);
    if (enh.autoApply && enh.effects.length > 0) {
      this.opts.effectEngine.applyEffects(enh.effects);
    }
    // 强化获得事件会自动驱动可见性增量更新，无需在此全量重算
    this.opts.devLog.record(`已获得强化：${enh.name}`, {
      source: 'enhancement',
      level: 'success',
      details: enh.price && enh.price.length > 0
        ? `消耗 ${enh.price.map(c => `${c.amount} ${c.resourceId}`).join(', ')}`
        : undefined,
    });
    return { success: true, enhancementId };
  }

  /** 从当前游戏移除一个已获得的 Enhancement（不再生效，可重新购买）。不可撤回（irreversible）的强化拒绝移除。 */
  removeEnhancement(enhancementId: EnhancementId): boolean {
    const def = this.opts.registry.enhancements.get(enhancementId);
    if (def?.irreversible) {
      this.opts.devLog.record(`无法移除强化：${enhancementId}（不可撤回）`, { source: 'enhancement', level: 'warning' });
      return false;
    }
    const removed = this.opts.mutations.removeEnhancement(enhancementId);
    if (removed) {
      this.opts.refreshVisibility();
      this.opts.recheckAllAffectors();
      this.opts.devLog.record(`已移除强化：${enhancementId}`, { source: 'enhancement', level: 'info' });
    }
    return removed;
  }

  /** [DEBUG] 将每个 Enhancement 的六个条件层级 dump 到 devLog。 */
  dumpEnhancementDebug(): void {
    const state = this.opts.getState();
    const all = [...this.opts.registry.enhancements.values()];
    this.opts.devLog.record(`── Enhancement 条件诊断 ── 共 ${all.length} 个`, { source: 'debug', level: 'info' });

    for (const enh of all) {
      const owned = state.unlockedEnhancements.includes(enh.id);
      const visible = this.opts.getVisibility().enhancements[enh.id] ?? false;

      const triggers = enh.revealTriggers;
      // 存在任一该目标的 Trigger 时，需至少一个满足才揭示；否则视为无揭示门槛。
      const metAny = (target: RevealTarget) =>
        !triggers?.some(t => t.reveal === target) ||
        triggers.some(t => t.reveal === target && (!t.condition || this.opts.conditionSystem.evaluateExpr(t.condition, state)));
      const exOk = metAny('existence');
      const nameOk = metAny('name');
      const condOk = metAny('condition');
      const utilOk = metAny('utility');
      const unlockOk = unlockMet(enh.revealTriggers, c => this.opts.conditionSystem.evaluateExpr(c, state));

      const mark = (ok: boolean) => ok ? '✓' : '✗';

      this.opts.devLog.record(
        `${mark(owned)} ${enh.name}  (${enh.id})`,
        {
          source: 'debug',
          level: owned ? 'success' : visible ? 'info' : 'warning',
          details: [
            `可见性 ${mark(visible)} — ${condLabel(existenceCondition(enh.revealTriggers))}`,
            `存在   ${mark(exOk)} — ${triggerLabel(triggers, 'existence')}`,
            `名称   ${mark(nameOk)} — ${triggerLabel(triggers, 'name')}`,
            `条件   ${mark(condOk)} — ${triggerLabel(triggers, 'condition')}`,
            `效用   ${mark(utilOk)} — ${triggerLabel(triggers, 'utility')}`,
            `解锁   ${mark(unlockOk)} — ${triggerLabel(triggers, 'unlock')}`,
          ].join('<br>'),
        },
      );
    }
    this.opts.devLog.record('── 诊断完成 ──', { source: 'debug', level: 'info' });
  }
}
