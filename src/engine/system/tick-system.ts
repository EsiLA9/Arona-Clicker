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
    private readonly gameNumSystem: GameNumSystem,
    mutations?: StateMutationService,
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
