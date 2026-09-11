import type { AronaClickerState, AronaClickerInitSnapshot } from '../types/state';
import type { Character } from '../types/ids';
import type { Registry } from '../../data-services/registry/registry';
import { extra, mergeExtra } from '../../engine/extra/index';
import { globalEnhancementEntries, localEnhancementEntries, globalSpotEntries, localSpotEntries } from './snapshot';
import type { StoryCursorCollection } from '../../engine/contracts/story-cursor';

export interface PerInitFieldContext {
  readonly storyCursors?: {
    capture(): StoryCursorCollection;
    clear(): void;
    restore(collection: StoryCursorCollection | undefined): void;
  };
}

export interface PerInitFieldSpec {
  readonly key: keyof AronaClickerInitSnapshot & string;
  readonly scope?: 'roster' | 'gacha' | 'chatRead' | 'equips';
  clear(registry: Registry, state: AronaClickerState, context?: PerInitFieldContext): void;
  capture(registry: Registry, state: AronaClickerState, into: AronaClickerInitSnapshot, context?: PerInitFieldContext): void;
  restore(registry: Registry, state: AronaClickerState, snapshot: AronaClickerInitSnapshot, context?: PerInitFieldContext): void;
}
interface FieldSpec<K extends keyof AronaClickerInitSnapshot & string> extends PerInitFieldSpec { readonly key: K; }
type StatePatch = Record<string, unknown>;
const patch = (state: AronaClickerState): StatePatch => state as unknown as StatePatch;

function cloneSerializable<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function field<K extends keyof AronaClickerInitSnapshot & string>(key: K, fresh: () => AronaClickerInitSnapshot[K]): FieldSpec<K> {
  return {
    key,
    clear: (_registry, state) => { patch(state)[key] = fresh(); },
    capture: (_registry, state, into) => {
      const value = patch(state)[key];
      into[key] = (value === undefined ? fresh() : cloneSerializable(value)) as AronaClickerInitSnapshot[K];
    },
    restore: (_registry, state, snapshot) => {
      const value = snapshot[key];
      patch(state)[key] = (value === undefined ? fresh() : cloneSerializable(value)) as AronaClickerInitSnapshot[K];
    },
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
      into[key] = (value === undefined ? empty() : cloneSerializable(value)) as AronaClickerInitSnapshot[K];
    },
    restore: (registry, state, snapshot) => {
      if (registry.characterScopeOf(scope) !== 'init') return;
      const value = snapshot[key];
      patch(state)[key] = (value === undefined ? empty() : cloneSerializable(value)) as AronaClickerInitSnapshot[K];
    },
  };
}

const extrasSpec: FieldSpec<'extras'> = {
  key: 'extras',
  clear: (_registry, state) => { state.initExtras = extra.dict({}); },
  capture: (_registry, state, into) => { into.extras = state.initExtras ? mergeExtra(extra.dict({}), state.initExtras) : undefined; },
  restore: (_registry, state, snapshot) => { state.initExtras = snapshot.extras ? mergeExtra(extra.dict({}), snapshot.extras) : extra.dict({}); },
};

const storyCursorsSpec: FieldSpec<'storyCursors'> = {
  key: 'storyCursors',
  clear: (_registry, _state, context) => { context?.storyCursors?.clear(); },
  capture: (_registry, _state, into, context) => {
    if (context?.storyCursors) into.storyCursors = context.storyCursors.capture();
  },
  restore: (_registry, _state, snapshot, context) => {
    context?.storyCursors?.restore(snapshot.storyCursors);
  },
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
  storyCursorsSpec,
];

type SpecKeys = (typeof PER_INIT_FIELD_SPECS)[number]['key'];
type SnapshotKeys = keyof AronaClickerInitSnapshot & string;
type NoExtraSpecKey = Exclude<SpecKeys, SnapshotKeys> extends never ? true : ['PER_INIT_FIELD_SPECS 含快照外的键', Exclude<SpecKeys, SnapshotKeys>];
type NoMissingSpecKey = Exclude<SnapshotKeys, SpecKeys> extends never ? true : ['PER_INIT_FIELD_SPECS 缺少快照键', Exclude<SnapshotKeys, SpecKeys>];
export const PER_INIT_KEY_GUARD: [NoExtraSpecKey, NoMissingSpecKey] = [true, true];
