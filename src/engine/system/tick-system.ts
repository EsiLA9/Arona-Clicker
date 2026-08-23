// ============================================================
// engine/tick-system.ts - Unified production tick
// ============================================================

import {
  PlayerState,
  TickResult,
  ProductionResult,
} from '../types';
import { Registry } from '../registry/registry';
import { ValueSystem } from '../expression/value-system';
import { EventBus } from '../core/event-bus';
import { StateMutationService } from './state-mutation-service';
import { GameNumSystem } from '../expression/game-num';
import { TagPath, matchesTag } from '../core/tag';

/** One engine tick is one second for both manual and automatic progression. */
export const TICK_INTERVAL_MS = 1000;

export class TickSystem {
  private readonly registry: Registry;
  private readonly valueSystem: ValueSystem;
  private readonly eventBus: EventBus;
  private _state!: PlayerState;
  private readonly mutations: StateMutationService;

  constructor(
    registry: Registry,
    valueSystem: ValueSystem,
    eventBus: EventBus,
    mutations?: StateMutationService,
    private readonly gameNumSystem?: GameNumSystem,
  ) {
    this.registry = registry;
    this.valueSystem = valueSystem;
    this.eventBus = eventBus;
    this.mutations = mutations ?? new StateMutationService(eventBus);
  }

  setState(state: PlayerState): void {
    this._state = state;
    this.mutations.setState(state);
  }

  /** Execute one unified tick and settle every owned Spot once. */
  tick(): TickResult {
    const state = this._state;
    state.totalFrames += 1;

    // 统一数值路径：每 Tick 对每个 Resource 求一次 primitiveGain（GameNum 懒求值）
    if (this.gameNumSystem) {
      const productions: ProductionResult[] = [];
      for (const resource of this.gameNumSystem.getResources()) {
        const gain = this.gameNumSystem.evaluateResourceGain(resource, state);
        if (gain <= 0) continue;
        this.mutations.changeResource(resource, gain);
        productions.push({ spotId: resource, resource, amount: gain });
        this.eventBus.emit({ type: 'spotProduced', spotId: resource, resource, amount: gain });
      }
      this.eventBus.emit({ type: 'tick', frame: state.totalFrames });
      return { frame: state.totalFrames, productions };
    }

    // 旧路径（无 GameNum 时，供单元测试直用）：逐 Spot 结算
    const productions: ProductionResult[] = [];

    // 某 Enhancement 是否作用于带给定 tags 的 Spot（层级匹配）：
    // 无 productionTags = 全局；否则 Spot 的任一声明 tag 命中任一查询 tag（前缀匹配）。
    // 作用域为全局（当前 Init），不按 Area 限定。
    const matchesEnhancement = (enhId: string, spotTags: TagPath[]): boolean => {
      const enh = this.registry.enhancements.get(enhId);
      if (!enh?.productionMultiplier) return false;
      if (!enh.productionTags || enh.productionTags.length === 0) return true;
      return enh.productionTags.some(query => spotTags.some(declared => matchesTag(declared, query)));
    };

    for (const [spotId, level] of Object.entries(state.spotLevels)) {
      if (level <= 0) continue;
      const spotDef = this.registry.spots.get(spotId);
      if (!spotDef) continue;

      // 聚合当前 Spot 适用的 Enhancement 产出倍率（组内累乘，按 tag 过滤）。
      const spotTags = spotDef.tags ?? [];
      const enhancementMultiplier = state.unlockedEnhancements.reduce((multiplier, enhId) => {
        return matchesEnhancement(enhId, spotTags)
          ? multiplier * this.registry.enhancements.get(enhId)!.productionMultiplier!
          : multiplier;
      }, 1);

      // All numeric inputs are evaluated through ValueSystem. A Spot's
      // baseYield is now its output for this unified tick.
      // Manager 加成已冻结（docs-818/12-character-rework.md §4.4）：
      // managerBonusYield / 角色标签加成不再参与产出，spotManagers 有值与否结果一致。
      const baseYield = this.valueSystem.evaluate(spotDef.baseYield, state);
      const requested = baseYield * enhancementMultiplier;
      const resource = spotDef.baseYieldResource;
      const current = state.resources[resource] ?? 0;
      const actual = spotDef.baseCapacity > 0
        ? Math.max(0, Math.min(requested, spotDef.baseCapacity - current))
        : requested;

      // Only settle real output. Zero-output ticks (e.g. capacity reached)
      // stay silent so the UI log and event stream don't spam.
      if (actual <= 0) continue;
      this.mutations.changeResource(resource, actual);
      productions.push({ spotId, resource, amount: actual });
      this.eventBus.emit({ type: 'spotProduced', spotId, resource, amount: actual });
      // Spot 功能的线性额外产出由挂载在其上的功能 Affector 在 applyActiveEffects 阶段结算。
    }

    this.eventBus.emit({ type: 'tick', frame: state.totalFrames });
    return { frame: state.totalFrames, productions };
  }
}
