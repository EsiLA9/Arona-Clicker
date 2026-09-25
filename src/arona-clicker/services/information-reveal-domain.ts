import type { Registry } from '../../data-services/registry/registry';
import type { Condition, ConditionGroup } from '../../engine/types/expression';
import type { RevealTrigger } from '../../engine/types/reveal';
import type { PlayerState, InformationRevealEntityKind, InformationRevealTarget, RevealedInformationTarget } from '../types/state';

export type RevealKey = RevealedInformationTarget;
export type RevealStatus = 'unresolved' | 'prerequisite-unmet' | 'known-no-gate' | 'known-progress' | 'pending-gate';
export type WakeSource =
  | { kind: 'init-admission'; initId: string; afterAdmission: true }
  | { kind: 'resource-change'; resourceId: string; scope: 'current-init' }
  | { kind: 'spot-level-change'; spotId: string; scope: 'current-init' }
  | { kind: 'story-completed'; storyId: string; fact: 'per-init-storyLog' | 'current-run' };
export type WakePlan =
  | { kind: 'reactive'; sources: WakeSource[]; activationCoverage: 'complete' | 'partial'; invalidationCoverage: 'complete' | 'partial' | 'uncovered' }
  | { kind: 'admission-only'; reason: string }
  | { kind: 'unsupported'; reason: string };
export interface RevealWatch {
  key: RevealKey;
  fullCondition: Condition | ConditionGroup;
  prerequisiteTargets: InformationRevealTarget[];
  prerequisiteBasis: 'satisfied';
  watchScope: { kind: 'current-applied-content-init'; initId: string };
  wakePlan: WakePlan;
}
export interface RevealQuery {
  status: RevealStatus;
  diagnostics: string[];
  watch?: RevealWatch;
}
export type PrerequisiteMap = Readonly<Record<string, readonly InformationRevealTarget[]>>;
const INFO = new Set<string>(['name', 'condition', 'utility']);
const keyOf = (k: RevealKey) => `${k.entityKind}\u0000${k.entityId}\u0000${k.target}`;
const same = (a: RevealKey, b: RevealKey) => keyOf(a) === keyOf(b);
const infoTriggers = (triggers: readonly RevealTrigger[] | undefined) => (triggers ?? []).filter(t => t.reveal !== 'existence' && t.reveal !== 'unlock');
const expression = (triggers: readonly RevealTrigger[]): Condition | ConditionGroup | undefined => {
  if (triggers.some(t => !t.condition)) return undefined;
  const conditions = triggers.map(t => t.condition!).filter(Boolean);
  return conditions.length === 1 ? conditions[0] : { type: 'OR', conditions };
};

function entityTriggers(registry: Registry, kind: InformationRevealEntityKind, id: string): readonly RevealTrigger[] | undefined {
  switch (kind) {
    case 'init': return registry.inits.get(id)?.revealTriggers;
    case 'area': return registry.areas.get(id)?.revealTriggers;
    case 'spot': return registry.spots.get(id)?.revealTriggers;
    case 'enhancement': return registry.enhancements.get(id)?.revealTriggers;
    case 'item': return registry.items.get(id)?.revealTriggers;
    case 'activeStoryEntry': return registry.activeStories.get(id)?.revealTriggers;
    case 'passiveStoryEntry': return registry.passiveStories.get(id)?.revealTriggers;
  }
}

function entityExists(registry: Registry, kind: InformationRevealEntityKind, id: string): boolean {
  switch (kind) {
    case 'init': return registry.inits.has(id);
    case 'area': return registry.areas.has(id);
    case 'spot': return registry.spots.has(id);
    case 'enhancement': return registry.enhancements.has(id);
    case 'item': return registry.items.has(id);
    case 'activeStoryEntry': return registry.activeStories.has(id);
    case 'passiveStoryEntry': return registry.passiveStories.has(id);
  }
}

function eligible(registry: Registry, state: PlayerState, kind: InformationRevealEntityKind, id: string, activeInit: string): boolean {
  if (!activeInit || state.activeInit !== activeInit) return false;
  switch (kind) {
    case 'init': return id === activeInit && registry.inits.has(id);
    case 'area': return registry.areas.get(id)?.initId === activeInit;
    case 'spot': {
      const spot = registry.spots.get(id);
      if (spot?.global) return true;
      const area = registry.areas.get(spot?.areaId ?? '');
      return area?.initId === activeInit;
    }
    case 'enhancement': {
      const attachment = registry.enhancements.get(id)?.attachment;
      if (!registry.enhancements.has(id)) return false;
      if (!attachment || attachment.kind === 'init') return !attachment || attachment.initId === activeInit;
      if (attachment.kind === 'global') return true;
      return registry.areas.get(attachment.areaId)?.initId === activeInit;
    }
    case 'item': return registry.items.has(id);
    case 'activeStoryEntry': {
      const entry = registry.activeStories.get(id);
      return !!entry && (entry.availableInits.length === 0 || entry.availableInits.includes(activeInit));
    }
    case 'passiveStoryEntry': {
      const entry = registry.passiveStories.get(id);
      return !!entry && (entry.availableInits.length === 0 || entry.availableInits.includes(activeInit));
    }
  }
}

function leaves(expr: Condition | ConditionGroup): Condition[] {
  if ('conditions' in expr) return expr.conditions.flatMap(c => leaves(c));
  return [expr];
}

function plan(expr: Condition | ConditionGroup, initId: string): WakePlan {
  const sources: WakeSource[] = [{ kind: 'init-admission', initId, afterAdmission: true }];
  const invalidation: ('complete' | 'partial' | 'uncovered')[] = [];
  let uncovered = false;
  for (const c of leaves(expr)) {
    let source: WakeSource | undefined;
    switch (c.target) {
      case 'resource': source = { kind: 'resource-change', resourceId: c.key, scope: 'current-init' }; invalidation.push('complete'); break;
      case 'spotLevel': source = { kind: 'spot-level-change', spotId: c.key, scope: 'current-init' }; invalidation.push('complete'); break;
      case 'hasReadStory': source = { kind: 'story-completed', storyId: c.key, fact: 'per-init-storyLog' }; invalidation.push('partial'); break;
      case 'hasReadStoryInRun': source = { kind: 'story-completed', storyId: c.key, fact: 'current-run' }; invalidation.push('complete'); break;
      default: uncovered = true; break;
    }
    if (source && !sources.some(s => JSON.stringify(s) === JSON.stringify(source))) sources.push(source);
  }
  if (!sources.some(s => s.kind !== 'init-admission')) return { kind: 'admission-only', reason: 'Gate has no supported reactive wake source.' };
  return {
    kind: 'reactive', sources,
    activationCoverage: uncovered ? 'partial' : 'complete',
    invalidationCoverage: uncovered || invalidation.includes('partial')
      ? invalidation.length ? 'partial' : 'uncovered'
      : invalidation.length ? 'complete' : 'uncovered',
  };
}

/** Derives Save facts and current desired Watches; it does not evaluate conditions or register events. */
export function queryInformationReveal(
  registry: Registry, state: PlayerState, key: RevealKey, activeInit: string,
  prerequisites: PrerequisiteMap = {},
): RevealQuery {
  const diagnostics: string[] = [];
  const declared = entityTriggers(registry, key.entityKind, key.entityId) ?? [];
  if (!entityExists(registry, key.entityKind, key.entityId) || !eligible(registry, state, key.entityKind, key.entityId, activeInit)) return { status: 'unresolved', diagnostics: ['definition-missing-or-out-of-scope'] };
  if (key.target === 'existence' || key.target === 'unlock') return { status: 'unresolved', diagnostics: ['non-information-target'] };
  const triggers = infoTriggers(declared).filter(t => t.reveal === key.target);
  const targetDeclared = INFO.has(key.target) || declared.some(t => t.reveal === key.target);
  if (!targetDeclared) return { status: 'unresolved', diagnostics: ['target-not-declared'] };

  const refs = prerequisites[keyOf(key)] ?? [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const check = (target: string): boolean => {
    if (target === key.target || visiting.has(target)) { diagnostics.push(`prerequisite-cycle:${target}`); return false; }
    if (!INFO.has(target) && !declared.some(t => t.reveal === target)) { diagnostics.push(`prerequisite-missing:${target}`); return false; }
    if (visited.has(target)) return true;
    visiting.add(target);
    const depKey = { ...key, target };
    const depTriggers = infoTriggers(declared).filter(t => t.reveal === target);
    const depRefs = prerequisites[keyOf(depKey)] ?? [];
    const depsSatisfied = depRefs.every(check);
    visiting.delete(target); visited.add(target);
    return depsSatisfied && (depTriggers.length === 0 || state.informationRevealProgress?.revealed.some(r => same(r, depKey)) === true);
  };
  if (!refs.every(check)) return { status: 'prerequisite-unmet', diagnostics };
  if (!triggers.length) return { status: 'known-no-gate', diagnostics };
  if (state.informationRevealProgress?.revealed.some(r => same(r, key))) return { status: 'known-progress', diagnostics };
  if (triggers.some(t => !t.condition)) return { status: 'pending-gate', diagnostics: [...diagnostics, 'unconditional-gate-admission-evaluation-required'] };
  const fullCondition = expression(triggers)!;
  return { status: 'pending-gate', diagnostics, watch: {
    key, fullCondition, prerequisiteTargets: [...refs], prerequisiteBasis: 'satisfied',
    watchScope: { kind: 'current-applied-content-init', initId: activeInit }, wakePlan: plan(fullCondition, activeInit),
  } };
}

/** Builds the current desired set from registry declarations, without mutating Save progress. */
export function deriveDesiredInformationWatches(registry: Registry, state: PlayerState, activeInit: string, prerequisites: PrerequisiteMap = {}): RevealWatch[] {
  const result: RevealWatch[] = [];
  const entities: [InformationRevealEntityKind, string][] = [
    ...[...registry.inits.keys()].map(id => ['init', id] as [InformationRevealEntityKind, string]),
    ...[...registry.areas.keys()].map(id => ['area', id] as [InformationRevealEntityKind, string]),
    ...[...registry.spots.keys()].map(id => ['spot', id] as [InformationRevealEntityKind, string]),
    ...[...registry.enhancements.keys()].map(id => ['enhancement', id] as [InformationRevealEntityKind, string]),
    ...[...registry.items.keys()].map(id => ['item', id] as [InformationRevealEntityKind, string]),
    ...[...registry.activeStories.keys()].map(id => ['activeStoryEntry', id] as [InformationRevealEntityKind, string]),
    ...[...registry.passiveStories.keys()].map(id => ['passiveStoryEntry', id] as [InformationRevealEntityKind, string]),
  ];
  for (const [entityKind, entityId] of entities) {
    const triggers = entityTriggers(registry, entityKind, entityId) ?? [];
    const targets = new Set([...INFO, ...triggers.map(t => t.reveal).filter(t => t !== 'existence' && t !== 'unlock')]);
    for (const target of targets) {
      const query = queryInformationReveal(registry, state, { entityKind, entityId, target }, activeInit, prerequisites);
      if (query.status === 'pending-gate' && query.watch && query.watch.fullCondition && leaves(query.watch.fullCondition).length) result.push(query.watch);
    }
  }
  return result;
}
