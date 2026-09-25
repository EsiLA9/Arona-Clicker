import type { Registry } from '../../data-services/registry/registry';
import type { ConditionState } from '../../engine/contracts/state-query';
import type { ConditionSystem } from '../../engine/expression/condition-system';
import type { RegistrationKey, TriggerRegistrationRequest, TriggerRuntimeAction, TriggerRuntimeActionResult, TriggerSystem } from '../../engine/effect/trigger-system';
import type { TriggerEventDef } from '../../engine/types/trigger';
import type { PlayerState } from '../types/state';
import type { StateMutationService } from '../state/state-mutation-service';
import { deriveDesiredMilestoneWatches, type DesiredMilestoneWatch, type MilestoneWakeSource } from './milestone-domain';

type WatchRecord = { watch: DesiredMilestoneWatch; handle: string; registrationKeys: RegistrationKey[]; descriptor: string };

function eventOf(source: MilestoneWakeSource): TriggerEventDef {
  switch (source.kind) {
    case 'resource': return { kind: 'resource', resource: source.resourceId };
    case 'spotLevel': return { kind: 'spotLevel', spotId: source.spotId };
    case 'story': return { kind: 'story', storyId: source.storyId };
  }
}

export class MilestoneAdapter {
  private readonly records = new Map<string, WatchRecord>();
  private readonly handles = new Map<string, WatchRecord>();
  private readonly inFlight = new Set<string>();
  private readonly allowedCommits = new Set<string>();
  private reconciling = false;
  private refreshPending = false;

  constructor(
    private readonly triggers: TriggerSystem,
    private readonly conditions: ConditionSystem,
    private readonly mutations: StateMutationService,
    private readonly getState: () => PlayerState,
    private readonly registry: Registry,
    private readonly registrationNamespace = 'milestone',
  ) {
    this.mutations.setMilestoneCompletionValidator((state, id) => this.validateCommit(state, id));
  }

  reconcileCurrent(): void {
    if (this.reconciling) { this.refreshPending = true; return; }
    this.reconciling = true;
    try {
      do {
        this.refreshPending = false;
        this.applyDesired();
      } while (this.refreshPending);
    } finally {
      this.reconciling = false;
    }
  }

  withdrawAll(): void {
    for (const [id, record] of [...this.records]) this.withdrawRecord(id, record);
  }

  handleRuntimeAction(action: TriggerRuntimeAction): TriggerRuntimeActionResult {
    if (action.kind !== 'milestone') return { kind: 'not-committed' };
    const record = this.handles.get(action.handle);
    if (!record) return { kind: 'not-committed' };
    return this.attemptCompletion(record) ? { kind: 'success' } : { kind: 'not-committed' };
  }

  private applyDesired(): void {
    const desired = new Map(deriveDesiredMilestoneWatches(this.registry, this.getState()).map(watch => [watch.milestoneId, watch]));
    for (const [id, record] of [...this.records]) {
      const next = desired.get(id);
      if (!next || JSON.stringify(next) !== record.descriptor) this.withdrawRecord(id, record);
    }
    for (const [id, watch] of desired) {
      if (this.records.has(id)) continue;
      const handle = `${this.registrationNamespace}:action:${id}`;
      const record: WatchRecord = { watch, handle, registrationKeys: [], descriptor: JSON.stringify(watch) };
      this.records.set(id, record);
      this.handles.set(handle, record);
      try {
        this.registerSources(record);
      } catch (error) {
        this.withdrawRecord(id, record);
        throw error;
      }
    }
    for (const [id, record] of [...this.records]) this.attemptCompletion(record);
  }

  private registerSources(record: WatchRecord): void {
    for (const [index, source] of record.watch.sources.entries()) {
      const key = `${this.registrationNamespace}:${record.watch.milestoneId}:${index}`;
      const request: TriggerRegistrationRequest = {
        key,
        triggerId: key,
        tags: new Set(),
        group: `${this.registrationNamespace}:runtime`,
        def: { id: key, on: eventOf(source), effects: [], once: false },
        action: { kind: 'milestone', handle: record.handle },
      };
      this.triggers.register(request);
      if (this.records.get(record.watch.milestoneId) !== record) {
        this.triggers.withdraw(key);
        continue;
      }
      record.registrationKeys.push(key);
    }
  }

  private attemptCompletion(record: WatchRecord): boolean {
    const id = record.watch.milestoneId;
    if (this.inFlight.has(id)) return false;
    this.inFlight.add(id);
    try {
      const current = this.currentWatch(id);
      if (!current || JSON.stringify(current) !== record.descriptor
        || !this.conditions.evaluateExpr(current.condition, this.getState() as ConditionState)) return false;
      this.allowedCommits.add(id);
      let committed = false;
      try { committed = this.mutations.completeMilestone(id); }
      finally { this.allowedCommits.delete(id); }
      if (committed || this.getState().milestoneProgress?.completed.includes(id)) this.withdrawRecord(id, record);
      return committed;
    } finally {
      this.inFlight.delete(id);
    }
  }

  private validateCommit(state: PlayerState, id: string): boolean {
    if (!this.allowedCommits.has(id)) return false;
    const record = this.records.get(id);
    if (!record) return false;
    const current = this.currentWatch(id);
    return !!current && JSON.stringify(current) === record.descriptor
      && this.conditions.evaluateExpr(current.condition, state as ConditionState);
  }

  private currentWatch(id: string): DesiredMilestoneWatch | undefined {
    return deriveDesiredMilestoneWatches(this.registry, this.getState()).find(watch => watch.milestoneId === id);
  }

  private withdrawRecord(id: string, record: WatchRecord): void {
    for (const key of record.registrationKeys) this.triggers.withdraw(key);
    this.records.delete(id);
    this.handles.delete(record.handle);
    this.refreshPending = this.reconciling;
  }
}
