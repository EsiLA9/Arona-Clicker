import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// tests/engine/per-init-fields.test.ts — per-Init 字段清单守卫与语义
// ============================================================

import { describe, it, expect } from 'vitest';
import { PER_INIT_FIELD_SPECS } from '../../src/arona-clicker/state/per-init-fields';
import { InitSavepoint } from '../../src/arona-clicker/state/init-savepoint';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import { Registry } from '../../src/data-services/registry/registry';
import type { CharacterPersistScope } from '../../src/data-services/contracts/character-persist';
import type { PlayerState, InitSnapshot } from '../../src/arona-clicker/types/state';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

/** 快照键全集（与 types/state.ts InitSnapshot 对齐；漂移时本测试与编译期守卫同时报警）。 */
const EXPECTED_SNAPSHOT_KEYS = [
  'resources', 'spotLevels', 'spotManagers', 'visitedAreas', 'totalFrames',
  'inventory', 'unlockedEnhancements', 'storyLog', 'storyReadLogs', 'flags',
  'triggersCompleted', 'currentAreaId', 'extras', 'roster', 'fragments', 'gachaState', 'chatRead',
  'equipmentsOwned', 'shopPurchaseRecords', 'storyCursors',
];

function makeRegistry(persist?: Partial<Record<'roster' | 'gacha' | 'chatRead', CharacterPersistScope>>): Registry {
  const registry = new Registry();
  registry.load({
    name: 'test:savepoint',
    version: '1',
    inits: [],
    areas: [],
    spots: [],
    items: [],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    characterPersistConfig: persist,
  } as unknown as Datapack);
  return registry;
}

describe('PER_INIT_FIELD_SPECS 键集合守卫', () => {
  it('SPECS 键集合 == InitSnapshot 键全集（防漂移）', () => {
    expect(PER_INIT_FIELD_SPECS.map(spec => spec.key).sort()).toEqual([...EXPECTED_SNAPSHOT_KEYS].sort());
  });
});

describe('InitSavepoint 三操作（spec 驱动）', () => {
  function makeSavepoint(persist?: Partial<Record<'roster' | 'gacha' | 'chatRead', CharacterPersistScope>>) {
    const registry = makeRegistry(persist);
    const state = createDefaultState();
    const savepoint = new InitSavepoint(registry, () => state);
    return { registry, state, savepoint };
  }

  it('save：捕获浅拷贝（改 state 不影响快照）', () => {
    const { state, savepoint } = makeSavepoint();
    state.resources = { credit: 100 };
    state.flags = { a: '1' };
    state.visitedAreas = ['base:area:x' as never];
    state.totalFrames = 42;
    state.storyReadLogs = { 's1': { readTalkletIndexes: [0], chosenChoiceIndexes: {} } };

    savepoint.save('i1');
    const snapshot = state.initSnapshots!['i1'];
    expect(snapshot.resources).toEqual({ credit: 100 });
    expect(snapshot.totalFrames).toBe(42);
    expect(snapshot.storyReadLogs).toBeDefined();

    state.resources.credit = 999;
    state.flags.a = '2';
    expect(snapshot.resources.credit).toBe(100);
    expect(snapshot.flags.a).toBe('1');
  });

  it('save：chatRead 缺省 init 进快照；roster 缺省 global 不进快照', () => {
    const { state, savepoint } = makeSavepoint();
    state.chatRead = { 'm1': true };
    state.roster = {} as PlayerState['roster'];

    savepoint.save('i1');
    const snapshot = state.initSnapshots!['i1'];
    expect(snapshot.chatRead).toEqual({ 'm1': true });
    expect(snapshot.roster).toBeUndefined();
    expect(snapshot.fragments).toBeUndefined();
  });

  it('clear：字段重置为新鲜值，activeInit 清空，global 归属容器保留', () => {
    const { state, savepoint } = makeSavepoint();
    state.resources = { credit: 100 };
    state.totalFrames = 42;
    state.activeInit = 'base:init:schale_office';
    state.chatRead = { 'm1': true };
    const roster: NonNullable<PlayerState['roster']> = { v1: { variantId: 'v1' } as never };
    state.roster = roster;

    savepoint.clear();
    expect(state.resources).toEqual({});
    expect(state.totalFrames).toBe(0);
    expect(state.activeInit).toBe('');
    expect(state.chatRead).toEqual({});
    expect(state.roster).toBe(roster);
  });

  it('restore：从快照写回状态', () => {
    const { state, savepoint } = makeSavepoint();
    state.resources = { credit: 100 };
    state.flags = { a: '1' };
    savepoint.save('i1');
    const snapshot = state.initSnapshots!['i1'];

    state.resources = { credit: 5 };
    state.flags = {};
    savepoint.restore(snapshot);
    expect(state.resources).toEqual({ credit: 100 });
    expect(state.flags).toEqual({ a: '1' });
  });

  it('归属声明为 init 时：roster/fragments/gachaState 进快照且 clear 重置', () => {
    const { state, savepoint } = makeSavepoint({ roster: 'init', gacha: 'init' });
    state.roster = { v1: { variantId: 'v1' } as never };
    state.gachaState = { p1: { pity: 1, pulls: 2 } } as never;

    savepoint.save('i1');
    const snapshot = state.initSnapshots!['i1'];
    expect(snapshot.roster).toBeDefined();
    expect(snapshot.fragments).toEqual({});
    expect(snapshot.gachaState).toEqual({ p1: { pity: 1, pulls: 2 } });
    expect(snapshot.chatRead).toEqual({});

    savepoint.clear();
    expect(state.roster).toEqual({});
    expect(state.gachaState).toEqual({});
  });
});
