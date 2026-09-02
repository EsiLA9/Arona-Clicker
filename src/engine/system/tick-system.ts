// ============================================================
// engine/tick-system.ts - Unified production tick
// ============================================================

import type { ProductionResult, TickResult } from '../contracts/tick';
import { ValueSystem } from '../expression/value-system';
import { EventBus } from '../core/event-bus';
import type { StateMutationPort } from '../contracts/mutation';
import type { TickState } from '../contracts/state-query';
import { GameNumSystem } from '../expression/game-num';

/** One engine tick is one second for both manual and automatic progression. */
export const TICK_INTERVAL_MS = 1000;

export class TickSystem {
  private readonly valueSystem: ValueSystem;
  private readonly eventBus: EventBus;
  private _state!: TickState;
  private readonly mutations: StateMutationPort;

  constructor(
    valueSystem: ValueSystem,
    eventBus: EventBus,
    private readonly gameNumSystem: GameNumSystem,
    mutations: StateMutationPort,
  ) {
    this.valueSystem = valueSystem;
    this.eventBus = eventBus;
    this.mutations = mutations;
  }

  setState(state: TickState): void {
    this._state = state;
    // 迁移兼容：旧宿主允许通过 setState 同步写入口；基础契约不再要求该能力。
    (this.mutations as StateMutationPort & { setState?: (state: object) => void }).setState?.(state);
  }

  /** Execute one unified tick and settle every owned Spot once. */
  tick(): TickResult {
    const state = this._state;
    state.totalFrames += 1;

    // 统一数值路径：每 Tick 对每个 Resource 求一次 primitiveGain（GameNum 懒求值）。
    // 产出为 resource 级聚合（跨所有 spot），不再逐 spot 结算，故无 spot 级 capacity 截断。
    const productions: ProductionResult[] = [];
    for (const resource of this.gameNumSystem.getResources()) {
      const gain = this.gameNumSystem.evaluateResourceGain(resource, state);
      if (gain <= 0) continue;
      this.mutations.changeResource(resource, gain);
      productions.push({ spotId: '', resource, amount: gain });
      this.eventBus.emit({ type: 'spotProduced', spotId: '', resource, amount: gain });
    }
    this.eventBus.emit({ type: 'tick', frame: state.totalFrames });
    return { frame: state.totalFrames, productions };
  }
}
