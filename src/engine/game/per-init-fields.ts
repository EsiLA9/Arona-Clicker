// ============================================================
// engine/game/per-init-fields.ts — per-Init 字段清单（单一事实源）
//
// InitSnapshot / PlayerState 的 per-Init 字段集合在此声明一次，
// init-savepoint 的 save / clear / restore 三操作全部由本表驱动：
// 新增 per-Init 字段 = InitSnapshot 类型加字段 + 本表加一条 spec，
// 键集合一致性由文件尾编译期守卫强制（漂移即编译错误）。
// ============================================================

import type { PlayerState, InitSnapshot, Character } from '../types';
import type { Registry } from '../registry/registry';
import { extra, mergeExtra } from '../extra/index';
import { globalSpotEntries, localSpotEntries } from './snapshot';

/** 单个 per-Init 字段的三操作声明。 */
export interface PerInitFieldSpec {
  /** InitSnapshot / PlayerState 上的字段键（extras 例外：状态侧键为 initExtras）。 */
  readonly key: keyof InitSnapshot & string;
  /**
   * 归属声明键（registry.characterScopeOf）：声明后仅当归属为 'init' 时
   * 参与保存/清除/恢复；缺省 = 恒参与。
   */
  readonly scope?: 'roster' | 'gacha' | 'chatRead';
  /** clear：将状态字段重置为新鲜值。 */
  clear(registry: Registry, state: PlayerState): void;
  /** save：从当前状态捕获值进快照。 */
  capture(registry: Registry, state: PlayerState, into: InitSnapshot): void;
  /** restore：从快照写回状态。 */
  restore(registry: Registry, state: PlayerState, snapshot: InitSnapshot): void;
}

interface FieldSpec<K extends keyof InitSnapshot & string> extends PerInitFieldSpec {
  readonly key: K;
}

/** 状态侧可写视图（按动态键写入时使用；读取走 PlayerState 具名键）。 */
type StatePatch = Record<string, unknown>;

const patch = (state: PlayerState): StatePatch => state as unknown as StatePatch;

/** 浅拷贝（数组 / 纯对象；原始值原样返回）——与原 init-savepoint 逐字段语义一致。 */
function shallowClone<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (value !== null && typeof value === 'object') return { ...value } as T;
  return value;
}

/** 普通字段：新鲜值工厂 + 浅拷贝捕获（undefined 回落新鲜值）+ 直接写回。 */
function field<K extends keyof InitSnapshot & string>(
  key: K,
  fresh: () => InitSnapshot[K],
): FieldSpec<K> {
  return {
    key,
    clear: (_registry, state) => { patch(state)[key] = fresh(); },
    capture: (_registry, state, into) => {
      const value = patch(state)[key];
      into[key] = (value === undefined ? fresh() : shallowClone(value)) as InitSnapshot[K];
    },
    restore: (_registry, state, snapshot) => { patch(state)[key] = snapshot[key]; },
  };
}

/** Spot 容器：save 捕获局部 Spot，clear 保留 global Spot，restore 以 global 现值打底合并局部。 */
function spotField<K extends 'spotLevels' | 'spotManagers'>(key: K): FieldSpec<K> {
  type AnySpotMap = Record<string, number | Character>;
  return {
    key,
    clear: (registry, state) => {
      patch(state)[key] = globalSpotEntries(registry, state[key] as unknown as AnySpotMap);
    },
    capture: (registry, state, into) => {
      into[key] = localSpotEntries(registry, state[key] as unknown as AnySpotMap) as InitSnapshot[K];
    },
    restore: (registry, state, snapshot) => {
      patch(state)[key] = {
        ...globalSpotEntries(registry, state[key] as unknown as AnySpotMap),
        ...localSpotEntries(registry, (snapshot[key] ?? {}) as unknown as AnySpotMap),
      };
    },
  };
}

/**
 * Character 归属容器（roster/fragments 归属随 roster 声明；gachaState 随 gacha；chatRead 随 chatRead）：
 * 仅当归属声明为 'init' 时参与三操作；global 块跨世界线保留、不进快照。
 */
function characterContainer<K extends 'roster' | 'fragments' | 'gachaState' | 'chatRead'>(
  key: K,
  scope: 'roster' | 'gacha' | 'chatRead',
): FieldSpec<K> {
  return {
    key,
    scope,
    clear: (registry, state) => {
      if (registry.characterScopeOf(scope) !== 'init') return;
      patch(state)[key] = {};
    },
    capture: (registry, state, into) => {
      if (registry.characterScopeOf(scope) !== 'init') return;
      const value = patch(state)[key];
      into[key] = (value ? { ...value } : {}) as InitSnapshot[K];
    },
    restore: (registry, state, snapshot) => {
      if (registry.characterScopeOf(scope) !== 'init') return;
      patch(state)[key] = snapshot[key] ?? {};
    },
  };
}

/** per-Init extras：状态键 initExtras、快照键 extras（历史命名差异），经 mergeExtra 深拷贝。 */
const extrasSpec: FieldSpec<'extras'> = {
  key: 'extras',
  clear: (_registry, state) => { state.initExtras = extra.dict({}); },
  capture: (_registry, state, into) => {
    into.extras = state.initExtras ? mergeExtra(extra.dict({}), state.initExtras) : undefined;
  },
  restore: (_registry, state, snapshot) => {
    state.initExtras = snapshot.extras ? mergeExtra(extra.dict({}), snapshot.extras) : extra.dict({});
  },
};

/** per-Init 字段清单（排列顺序即快照写入顺序）。 */
export const PER_INIT_FIELD_SPECS = [
  field('resources', () => ({})),
  spotField('spotLevels'),
  spotField('spotManagers'),
  field('visitedAreas', () => []),
  field('totalFrames', () => 0),
  field('inventory', () => ({})),
  field('unlockedEnhancements', () => []),
  field('storyLog', () => []),
  field('storyReadLogs', () => ({})),
  field('flags', () => ({})),
  field('triggersCompleted', () => []),
  field('currentAreaId', () => undefined),
  extrasSpec,
  characterContainer('roster', 'roster'),
  characterContainer('fragments', 'roster'),
  characterContainer('gachaState', 'gacha'),
  characterContainer('chatRead', 'chatRead'),
];

type SpecKeys = (typeof PER_INIT_FIELD_SPECS)[number]['key'];
type SnapshotKeys = keyof InitSnapshot & string;

// 编译期守卫：SPECS 键集合与 InitSnapshot 键集合必须完全一致（漂移即编译错误）
type NoExtraSpecKey = Exclude<SpecKeys, SnapshotKeys> extends never
  ? true : ['PER_INIT_FIELD_SPECS 含快照外的键', Exclude<SpecKeys, SnapshotKeys>];
type NoMissingSpecKey = Exclude<SnapshotKeys, SpecKeys> extends never
  ? true : ['PER_INIT_FIELD_SPECS 缺少快照键', Exclude<SnapshotKeys, SpecKeys>];
export const PER_INIT_KEY_GUARD: [NoExtraSpecKey, NoMissingSpecKey] = [true, true];
