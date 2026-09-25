import type { StateMutationService } from '../state/state-mutation-service';
import type { PlayerState, RevealedInformationTarget } from '../types/state';
import type { Registry } from '../../data-services/registry/registry';
import type { ConditionSystem } from '../../engine/expression/condition-system';
import type { ConditionState } from '../../engine/contracts/state-query';
import type { TriggerEventDef } from '../../engine/types/trigger';
import type { RegistrationKey, TriggerRegistrationRequest, TriggerRuntimeAction, TriggerRuntimeActionResult, TriggerSystem } from '../../engine/effect/trigger-system';
import { deriveDesiredInformationWatches, queryInformationReveal, type PrerequisiteMap, type RevealWatch, type WakeSource } from './information-reveal-domain';

type WatchRecord = { watch: RevealWatch; handle: string; registrationKeys: RegistrationKey[]; descriptor: string };
export type ImmediateRevealTarget = RevealedInformationTarget;

function keyId(key: RevealedInformationTarget): string { return `${key.entityKind}\u0000${key.entityId}\u0000${key.target}`; }
function watchId(watch: RevealWatch): string { return keyId(watch.key); }

function eventOf(source: WakeSource): TriggerEventDef | undefined {
  switch (source.kind) {
    case 'resource-change': return { kind: 'resource', resource: source.resourceId };
    case 'spot-level-change': return { kind: 'spotLevel', spotId: source.spotId };
    case 'story-completed': return { kind: 'story', storyId: source.storyId };
    case 'init-admission': return undefined;
  }
}

/** Materializes domain Watches as private, rebuildable Trigger registrations. */
export class InformationRevealAdapter {
  private readonly records = new Map<string, WatchRecord>();
  private readonly handles = new Map<string, WatchRecord>();
  private readonly inFlight = new Set<string>();
  private readonly allowedCommits = new Set<string>();
  private readonly immediateCommits = new Set<string>();
  private reconciling = false;
  private refreshPending = false;
  private nextHandle = 1;

  constructor(
    private readonly triggers: TriggerSystem,
    private readonly conditions: ConditionSystem,
    private readonly mutations: StateMutationService,
    private readonly getState: () => PlayerState,
    private readonly registry: Registry,
    private readonly prerequisites: PrerequisiteMap = {},
    private readonly registrationNamespace = 'information-reveal',
  ) {
    this.triggers.setRuntimeActionHandler(action => this.handleAction(action));
    this.mutations.setInformationRevealTargetValidator((state, key) => this.validateCommit(state, key));
  }

  /** Registers every reactive source before any current-state admission check. */
  reconcile(watches: readonly RevealWatch[], immediateTargets: readonly ImmediateRevealTarget[] = []): void {
    if (this.reconciling) { this.refreshPending = true; return; }
    this.reconciling = true;
    try {
      this.applyDesired(watches, immediateTargets);
      while (this.refreshPending) {
        this.refreshPending = false;
        const fresh = this.currentDesired();
        this.applyDesired(fresh.watches, fresh.immediateTargets);
      }
    } finally {
      this.reconciling = false;
    }
  }

  private applyDesired(watches: readonly RevealWatch[], immediateTargets: readonly ImmediateRevealTarget[]): void {
    const desired = new Map(watches.filter(watch => this.isCurrentWatch(watch)).map(watch => [watchId(watch), watch]));
    for (const [id, record] of [...this.records]) {
      const next = desired.get(id);
      if (!next || JSON.stringify(next) !== record.descriptor) this.withdrawRecord(id, record);
    }
    for (const [id, watch] of desired) {
      if (this.records.has(id)) continue;
      const baseHandle = `reveal-action:${this.nextHandle++}`;
      const record: WatchRecord = {
        watch,
        handle: this.registrationNamespace === 'information-reveal' ? baseHandle : `${this.registrationNamespace}:${baseHandle}`,
        registrationKeys: [], descriptor: JSON.stringify(watch),
      };
      this.records.set(id, record);
      this.handles.set(record.handle, record);
      try {
        if (watch.wakePlan.kind === 'reactive') this.registerSources(record, watch.wakePlan.sources);
      } catch (error) {
        this.withdrawRecord(id, record);
        throw error;
      }
    }

    for (const key of immediateTargets) this.commitImmediate(key);
    for (const [id, record] of [...this.records]) {
      if (record.watch.wakePlan.kind === 'reactive' || record.watch.wakePlan.kind === 'admission-only') {
        const current = this.currentWatch(record.watch.key);
        if (current && this.conditions.evaluateExpr(current.fullCondition, this.getState() as ConditionState)) this.commitRecord(id, record);
      }
    }
  }

  withdrawAll(): void {
    for (const [id, record] of [...this.records]) this.withdrawRecord(id, record);
  }

  private registerSources(record: WatchRecord, sources: readonly WakeSource[]): void {
    let index = 0;
    for (const source of sources) {
      const on = eventOf(source);
      if (!on) continue;
      const key = `${this.registrationNamespace}:${record.handle}:${index++}`;
      const request: TriggerRegistrationRequest = {
        key, triggerId: key, tags: new Set(), group: `${this.registrationNamespace}:${record.watch.watchScope.initId}`,
        def: { id: key, on, effects: [], once: false },
        action: { kind: 'reveal', handle: record.handle },
      };
      this.triggers.register(request);
      record.registrationKeys.push(key);
    }
  }

  private handleAction(action: TriggerRuntimeAction): TriggerRuntimeActionResult {
    if (action.kind !== 'reveal') return { kind: 'not-committed' };
    const record = this.handles.get(action.handle);
    if (!record) return { kind: 'not-committed' };
    const id = watchId(record.watch);
    if (this.inFlight.has(id) || this.getState().activeInit !== record.watch.watchScope.initId) return { kind: 'not-committed' };
    this.inFlight.add(id);
    try {
      const current = this.currentWatch(record.watch.key);
      if (!current || JSON.stringify(current) !== record.descriptor
        || !this.conditions.evaluateExpr(current.fullCondition, this.getState() as ConditionState)) return { kind: 'not-committed' };
      return this.commitRecord(id, record) ? { kind: 'success' } : { kind: 'not-committed' };
    } finally {
      this.inFlight.delete(id);
    }
  }

  private commitImmediate(key: ImmediateRevealTarget): void {
    const id = keyId(key);
    const current = this.query(key);
    if (current.status !== 'pending-gate' || !this.hasUnconditionalGate(key)) return;
    this.immediateCommits.add(id);
    this.allowedCommits.add(id);
    try {
      if (this.mutations.revealInformationTarget(key)) this.refreshPending = true;
    } finally {
      this.allowedCommits.delete(id);
      this.immediateCommits.delete(id);
    }
  }

  private commitRecord(id: string, record: WatchRecord): boolean {
    const current = this.currentWatch(record.watch.key);
    if (!current || JSON.stringify(current) !== record.descriptor
      || !this.conditions.evaluateExpr(current.fullCondition, this.getState() as ConditionState)) return false;
    this.allowedCommits.add(id);
    let committed = false;
    try { committed = this.mutations.revealInformationTarget(record.watch.key); }
    finally { this.allowedCommits.delete(id); }
    if (committed) {
      this.withdrawRecord(id, record);
      this.refreshPending = true;
      if (!this.reconciling) this.reconcileCurrent();
    }
    return committed;
  }

  private validateCommit(state: PlayerState, key: RevealedInformationTarget): boolean {
    const id = keyId(key);
    if (!this.allowedCommits.has(id)) return false;
    const current = this.query(key, state);
    if (current.status !== 'pending-gate') return false;
    if (this.immediateCommits.has(id)) return this.hasUnconditionalGate(key);
    const record = this.records.get(id);
    return !!record && !!current.watch && JSON.stringify(current.watch) === record.descriptor
      && this.conditions.evaluateExpr(current.watch.fullCondition, state as ConditionState);
  }

  private query(key: RevealedInformationTarget, state = this.getState()) {
    return queryInformationReveal(this.registry, state, key, state.activeInit, this.prerequisites);
  }

  private currentWatch(key: RevealedInformationTarget): RevealWatch | undefined {
    return this.query(key).watch;
  }

  private isCurrentWatch(watch: RevealWatch): boolean {
    const current = this.currentWatch(watch.key);
    return !!current && JSON.stringify(current) === JSON.stringify(watch);
  }

  private hasUnconditionalGate(key: RevealedInformationTarget): boolean {
    const triggers = this.entityTriggers(key);
    return triggers.some(trigger => trigger.reveal === key.target && !trigger.condition);
  }

  private entityTriggers(key: RevealedInformationTarget) {
    switch (key.entityKind) {
      case 'init': return this.registry.inits.get(key.entityId)?.revealTriggers ?? [];
      case 'area': return this.registry.areas.get(key.entityId)?.revealTriggers ?? [];
      case 'spot': return this.registry.spots.get(key.entityId)?.revealTriggers ?? [];
      case 'enhancement': return this.registry.enhancements.get(key.entityId)?.revealTriggers ?? [];
      case 'item': return this.registry.items.get(key.entityId)?.revealTriggers ?? [];
      case 'activeStoryEntry': return this.registry.activeStories.get(key.entityId)?.revealTriggers ?? [];
      case 'passiveStoryEntry': return this.registry.passiveStories.get(key.entityId)?.revealTriggers ?? [];
    }
  }

  private currentDesired(): { watches: RevealWatch[]; immediateTargets: ImmediateRevealTarget[] } {
    const state = this.getState();
    const watches = deriveDesiredInformationWatches(this.registry, state, state.activeInit, this.prerequisites);
    const immediateTargets: ImmediateRevealTarget[] = [];
    const entities: RevealedInformationTarget[] = [];
    const add = (entityKind: RevealedInformationTarget['entityKind'], entries: Iterable<[string, { revealTriggers?: readonly { reveal: string; condition?: unknown }[] }]>) => {
      for (const [entityId, def] of entries) for (const trigger of def.revealTriggers ?? []) {
        if (trigger.reveal !== 'existence' && trigger.reveal !== 'unlock') entities.push({ entityKind, entityId, target: trigger.reveal });
      }
    };
    add('init', this.registry.inits);
    add('area', this.registry.areas);
    add('spot', this.registry.spots);
    add('enhancement', this.registry.enhancements);
    add('item', this.registry.items);
    add('activeStoryEntry', this.registry.activeStories);
    add('passiveStoryEntry', this.registry.passiveStories);
    for (const key of entities) {
      const query = this.query(key, state);
      if (query.status === 'pending-gate' && query.diagnostics.includes('unconditional-gate-admission-evaluation-required')) immediateTargets.push(key);
    }
    return { watches, immediateTargets };
  }

  reconcileCurrent(): void {
    if (this.reconciling) { this.refreshPending = true; return; }
    const current = this.currentDesired();
    this.reconcile(current.watches, current.immediateTargets);
  }

  private withdrawRecord(id: string, record: WatchRecord): void {
    for (const key of record.registrationKeys) this.triggers.withdraw(key);
    this.records.delete(id);
    this.handles.delete(record.handle);
  }
}
