import type { InitDef } from '../../data-services/contracts/world';
import type { AronaClickerState, AronaClickerInitSnapshot } from '../types/state';
import { Registry } from '../../data-services/registry/registry';
import { PER_INIT_FIELD_SPECS, type PerInitFieldContext } from './per-init-fields';
import { extra, mergeExtra } from '../../engine/extra/index';

export class InitSavepoint {
  constructor(
    private readonly registry: Registry,
    private readonly getState: () => AronaClickerState,
    private readonly context: PerInitFieldContext = {},
  ) {}
  private get state(): AronaClickerState { return this.getState(); }
  save(initId: string): void {
    const state = this.state;
    const snapshot = {} as AronaClickerInitSnapshot;
    for (const spec of PER_INIT_FIELD_SPECS) spec.capture(this.registry, state, snapshot, this.context);
    if (!state.initSnapshots) state.initSnapshots = {};
    state.initSnapshots[initId] = snapshot;
  }
  clear(): void {
    const state = this.state;
    for (const spec of PER_INIT_FIELD_SPECS) spec.clear(this.registry, state, this.context);
    state.activeInit = '';
  }
  restore(snapshot: NonNullable<AronaClickerState['initSnapshots']>[string]): void {
    const state = this.state;
    for (const spec of PER_INIT_FIELD_SPECS) spec.restore(this.registry, state, snapshot, this.context);
  }
  seed(init: InitDef): void { this.state.initExtras = mergeExtra(extra.dict({}), init.extra ?? extra.dict({})); }
}
