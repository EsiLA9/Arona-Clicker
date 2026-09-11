import type { AronaClickerState, AronaClickerInitSnapshot } from '../types/state';
import type { Character } from '../types/ids';
import type { Registry } from '../../data-services/registry/registry';
import { extra, mergeExtra } from '../../engine/extra/index';
import { globalEnhancementEntries, localEnhancementEntries, globalSpotEntries, localSpotEntries } from './snapshot';

export interface PerInitFieldSpec {
  readonly key: keyof AronaClickerInitSnapshot & string;
  readonly scope?: 'roster' | 'gacha' | 'chatRead' | 'equips';
  clear(registry: Registry, state: AronaClickerState): void;
  capture(registry: Registry, state: AronaClickerState, into: AronaClickerInitSnapshot): void;
  restore(registry: Registry, state: AronaClickerState, snapshot: AronaClickerInitSnapshot): void;
}
interface FieldSpec<K extends keyof AronaClickerInitSnapshot & string> extends PerInitFieldSpec { readonly key: K; }
type StatePatch = Record<string, unknown>;
const patch = (state: AronaClickerState): StatePatch => state as unknown as StatePatch;

function shallowClone<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (value !== null && typeof value === 'object') return { ...value } as T;
  return value;
}

function field<K extends keyof AronaClickerInitSnapshot & string>(key: K, fresh: () => AronaClickerInitSnapshot[K]): FieldSpec<K> {
  return {
    key,
    clear: (_registry, state) => { patch(state)[key] = fresh(); },
    capture: (_registry, state, into) => {
      const value = patch(state)[key];
      into[key] = (value === undefined ? fresh() : shallowClone(value)) as AronaClickerInitSnapshot[K];
    },
    restore: (_registry, state, snapshot) => { patch(state)[key] = snapshot[key]; },
  };
}

function spotField<K extends 'spotLevels' | 'spotManagers'>(key: K): FieldSpec<K> {
  type AnySpotMap = Record<string, number | Character>;
  return {
    key,
    clear: (registry, state) => { patch(state)[key] = globalSpotEntries(registry, state[key] as unknown as AnySpotMap); },
    capture: (registry, state, into) => { into[key] = localSpotEntries(registry, state[key] as unknown as AnySpotMap) as AronaClickerInitSnapshot[K]; },
    restore: (registry, state, snapshot) => {
      patch(state)[key] = {
        ...globalSpotEntries(registry, state[key] as unknown as AnySpotMap),
        ...localSpotEntries(registry, (snapshot[key] ?? {}) as unknown as AnySpotMap),
      };
    },
  };
}

const enhancementField: FieldSpec<'unlockedEnhancements'> = {
  key: 'unlockedEnhancements',
  clear: (registry, state) => { state.unlockedEnhancements = globalEnhancementEntries(registry, state.unlockedEnhancements); },
  capture: (registry, state, into) => { into.unlockedEnhancements = localEnhancementEntries(registry, state.unlockedEnhancements); },
  restore: (registry, state, snapshot) => {
    state.unlockedEnhancements = [...new Set([
      ...globalEnhancementEntries(registry, state.unlockedEnhancements),
      ...localEnhancementEntries(registry, snapshot.unlockedEnhancements ?? []),
    ])];
  },
};

function characterContainer<K extends 'roster' | 'fragments' | 'gachaState' | 'chatRead' | 'equipmentsOwned'>(
  key: K,
  scope: 'roster' | 'gacha' | 'chatRead' | 'equips',
  empty: () => AronaClickerInitSnapshot[K],
): FieldSpec<K> {
  return {
    key,
    scope,
    clear: (registry, state) => { if (registry.characterScopeOf(scope) === 'init') patch(state)[key] = empty(); },
    capture: (registry, state, into) => {
      if (registry.characterScopeOf(scope) !== 'init') return;
      const value = patch(state)[key];
      into[key] = (value === undefined ? empty() : shallowClone(value)) as AronaClickerInitSnapshot[K];
    },
    restore: (registry, state, snapshot) => { if (registry.characterScopeOf(scope) === 'init') patch(state)[key] = snapshot[key] ?? empty(); },
  };
}

const extrasSpec: FieldSpec<'extras'> = {
  key: 'extras',
  clear: (_registry, state) => { state.initExtras = extra.dict({}); },
  capture: (_registry, state, into) => { into.extras = state.initExtras ? mergeExtra(extra.dict({}), state.initExtras) : undefined; },
  restore: (_registry, state, snapshot) => { state.initExtras = snapshot.extras ? mergeExtra(extra.dict({}), snapshot.extras) : extra.dict({}); },
};

export const PER_INIT_FIELD_SPECS = [
  field('resources', () => ({})), spotField('spotLevels'), spotField('spotManagers'),
  field('visitedAreas', () => []), field('totalFrames', () => 0), field('inventory', () => ({})),
  enhancementField, field('storyLog', () => []), field('storyReadLogs', () => ({})),
  field('flags', () => ({})), field('triggersCompleted', () => []), field('currentAreaId', () => undefined), extrasSpec,
  characterContainer('roster', 'roster', () => ({})), characterContainer('fragments', 'roster', () => ({})),
  characterContainer('gachaState', 'gacha', () => ({})), characterContainer('chatRead', 'chatRead', () => ({})),
  characterContainer('equipmentsOwned', 'equips', () => []),
  field('shopPurchaseRecords', () => ({})),
];

type SpecKeys = (typeof PER_INIT_FIELD_SPECS)[number]['key'];
type SnapshotKeys = keyof AronaClickerInitSnapshot & string;
type NoExtraSpecKey = Exclude<SpecKeys, SnapshotKeys> extends never ? true : ['PER_INIT_FIELD_SPECS 含快照外的键', Exclude<SpecKeys, SnapshotKeys>];
type NoMissingSpecKey = Exclude<SnapshotKeys, SpecKeys> extends never ? true : ['PER_INIT_FIELD_SPECS 缺少快照键', Exclude<SnapshotKeys, SpecKeys>];
export const PER_INIT_KEY_GUARD: [NoExtraSpecKey, NoMissingSpecKey] = [true, true];
