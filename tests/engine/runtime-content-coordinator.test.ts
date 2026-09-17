import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { Registry } from '../../src/data-services/registry/registry';
import { RuntimeContentCoordinator, type RuntimeSpotInput } from '../../src/arona-clicker/services/runtime-content-coordinator';

const AREA = 'base:area:main';
const MOD = 'draft-mod';

const datapack: Datapack = {
  name: 'runtime content coordinator fixture',
  version: '1.0.0',
  modName: 'base',
  inits: [{ id: 'base:init:main', name: 'Main', description: '', defaultAreas: [] }],
  areas: [{ id: AREA, initId: 'base:init:main', name: 'Main', description: '', defaultSpots: [] }],
  spots: [],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [{ id: 'base:item:ticket', name: 'Ticket', description: '', maxStack: 99, rarity: 'common', type: 'material' }],
  resourceDisplays: [{ resourceId: 'base:resource:credit', label: 'Credit' }],
  funcletDefs: [],
  characters: [],
};

const input = (idName = 'printer', overrides: Partial<RuntimeSpotInput> = {}): RuntimeSpotInput => ({
  idName,
  areaId: AREA,
  name: 'Printer',
  description: 'A temporary printer',
  purchaseOptions: [{ id: 'free', costs: [] }],
  ...overrides,
});

const makeCoordinator = (settings: ConstructorParameters<typeof RuntimeContentCoordinator>[1] = {}) => {
  const registry = new Registry();
  registry.load(datapack);
  return { registry, coordinator: new RuntimeContentCoordinator(registry, { modName: MOD, ...settings }) };
};

describe('RuntimeContentCoordinator', () => {
  test('converts one editor Spot input to a complete local SpotDef and advances revision', () => {
    const { registry, coordinator } = makeCoordinator();
    const result = coordinator.submit({ operation: 'create', modName: MOD, spot: input(), expectedRevision: 0 });

    expect(result).toMatchObject({ ok: true, revision: 1, spotId: `${MOD}:spot:printer`, operation: 'create' });
    expect(result.transition).toEqual({
      key: { table: 'spots', id: `${MOD}:spot:printer` },
      before: 'missing',
      after: 'resolved',
    });
    expect(registry.spots.get(`${MOD}:spot:printer`)).toEqual({
      id: `${MOD}:spot:printer`,
      metadata: { createdAt: expect.any(Number), updatedAt: expect.any(Number) },
      areaId: AREA,
      name: 'Printer',
      description: 'A temporary printer',
      purchaseOptions: [{ id: 'free', costs: [] }],
      levelUpgrades: [],
      tags: [],
    });
    const state = coordinator.getRuntimeModState();
    expect(state.modName).toBe(MOD);
    expect([...state.spots.keys()]).toEqual([`${MOD}:spot:printer`]);
    expect(state.suspendedSpotIds.size).toBe(0);
  });

  test('accepts multi-asset payment options and encodes them into the runtime SpotDef', () => {
    const { registry, coordinator } = makeCoordinator();
    const result = coordinator.submit({
      operation: 'create',
      modName: MOD,
      spot: input('payment-desk', {
        purchaseOptions: [{
          id: 'credit-ticket',
          label: '信用点与票券',
          costs: [
            { type: 'resource', resourceId: 'base:resource:credit', amount: 10 },
            { type: 'item', itemId: 'base:item:ticket', amount: 2 },
          ],
        }],
        levelUpgrades: [{
          level: 2,
          paymentOptions: [{ id: 'ticket', costs: [{ type: 'item', itemId: 'base:item:ticket', amount: 1 }] }],
          effects: [],
        }],
      }),
      expectedRevision: 0,
    });

    expect(result).toMatchObject({ ok: true, revision: 1 });
    expect(registry.spots.get(`${MOD}:spot:payment-desk`)).toMatchObject({
      purchaseOptions: [{
        id: 'credit-ticket',
        costs: [
          { type: 'resource', resourceId: 'base:resource:credit', amount: { type: 'const', value: 10 } },
          { type: 'item', itemId: 'base:item:ticket', amount: { type: 'const', value: 2 } },
        ],
      }],
      levelUpgrades: [{
        level: 2,
        paymentOptions: [{ id: 'ticket' }],
      }],
    });
  });

  test('rejects stale revision before touching Registry or RuntimeModState', () => {
    const { registry, coordinator } = makeCoordinator();
    coordinator.submit({ operation: 'create', modName: MOD, spot: input(), expectedRevision: 0 });

    const result = coordinator.submit({
      operation: 'replace',
      modName: MOD,
      idName: 'printer',
      spot: input('printer', { name: 'Changed' }),
      expectedRevision: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: 'stale-revision', path: 'expectedRevision' });
    expect(registry.spots.get(`${MOD}:spot:printer`)?.name).toBe('Printer');
    expect(coordinator.getRevision()).toBe(1);
  });

  test('enforces one Mod and derives the owner-compatible entity ID', () => {
    const { registry, coordinator } = makeCoordinator();
    const created = coordinator.submit({ operation: 'create', modName: MOD, spot: input('desk'), expectedRevision: 0 });
    expect(created.spotId).toBe(`${MOD}:spot:desk`);

    const conflict = coordinator.submit({ operation: 'create', modName: 'another-mod', spot: input('other'), expectedRevision: 1 });

    expect(conflict.ok).toBe(false);
    expect(conflict.diagnostics[0].code).toBe('mod-conflict');
    expect(registry.spots.has('another-mod:spot:other')).toBe(false);
    expect([...coordinator.getRuntimeModState().spots.keys()]).toEqual([`${MOD}:spot:desk`]);
  });

  test('rejects a configured temporary Mod that is already loaded in Registry', () => {
    const registry = new Registry();
    registry.load({ ...datapack, modName: MOD, name: 'occupied mod' });
    const coordinator = new RuntimeContentCoordinator(registry, { modName: MOD });

    const result = coordinator.submit({ operation: 'create', modName: MOD, spot: input(), expectedRevision: 0 });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('mod-conflict');
    expect(coordinator.getRevision()).toBe(0);
  });

  test('rejects complex or malformed input before Registry mutation', () => {
    const { registry, coordinator } = makeCoordinator();
    // 未授权字段（theme）仍被拒绝：编辑器只开放策略表登记过的字段与扩展。
    const withUnknownField = { ...input(), theme: {} } as unknown as RuntimeSpotInput;
    const unknown = coordinator.submit({ operation: 'create', modName: MOD, spot: withUnknownField, expectedRevision: 0 });
    expect(unknown.ok).toBe(false);
    expect(unknown.diagnostics[0]).toMatchObject({ code: 'invalid-field', path: 'spot.theme' });
    expect(registry.spots.size).toBe(0);

    // 已授权的扩展同样逐项校验：shop 功能必须给出商店。
    const invalidFunctionality = coordinator.submit({
      operation: 'create',
      modName: MOD,
      spot: input('bad-fn', { functionalities: [{ id: 'counter', kind: 'shop' }] }),
      expectedRevision: 0,
    });
    expect(invalidFunctionality.ok).toBe(false);
    expect(invalidFunctionality.diagnostics[0]).toMatchObject({ code: 'invalid-field', path: 'spot.functionalities[0].shopId' });
    expect(registry.spots.size).toBe(0);

    const invalidNumber = coordinator.submit({ operation: 'create', modName: MOD, spot: input('bad', { maxLevel: Number.NaN }), expectedRevision: 0 });
    expect(invalidNumber.ok).toBe(false);
    expect(invalidNumber.diagnostics[0]).toMatchObject({ code: 'invalid-field', path: 'spot.maxLevel' });
    expect(coordinator.getRevision()).toBe(0);
  });

  test('replaces resource Affector rows while preserving unsupported Spot functionality', () => {
    const { registry, coordinator } = makeCoordinator();
    expect(coordinator.submit({
      operation: 'create',
      modName: MOD,
      spot: input('printer', {
        functionalities: [{ id: 'credit', kind: 'flow', resource: 'base:resource:credit', amount: 2 }],
      }),
      expectedRevision: 0,
    })).toMatchObject({ ok: true, revision: 1 });

    const spotId = `${MOD}:spot:printer`;
    const current = registry.spots.get(spotId)!;
    registry.applySpotMutation({
      operation: 'replace',
      ownerModName: MOD,
      spot: { ...current, functionalities: [...(current.functionalities ?? []), { id: 'legacy:gacha', kind: 'gacha' }] },
    });
    coordinator.adoptRuntimeMod(MOD, [spotId]);

    const replaced = coordinator.submit({
      operation: 'replace',
      modName: MOD,
      idName: 'printer',
      spot: input('printer', {
        functionalities: [{ id: 'credit', kind: 'flow', resource: 'base:resource:credit', amount: 5 }],
      }),
      expectedRevision: 0,
    });
    expect(replaced).toMatchObject({ ok: true, revision: 1 });
    expect(registry.spots.get(spotId)?.functionalities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime:resource:credit', kind: 'flow', amount: 5 }),
      expect.objectContaining({ id: 'legacy:gacha', kind: 'gacha' }),
    ]));
  });

  test('delete carries retain or purge signal without touching PlayerState', () => {
    const commits: string[] = [];
    const { registry, coordinator } = makeCoordinator({
      onCommitted: commit => commits.push(`${commit.operation}:${commit.playerData ?? 'none'}`),
    });
    coordinator.submit({ operation: 'create', modName: MOD, spot: input(), expectedRevision: 0 });
    const result = coordinator.submit({ operation: 'delete', modName: MOD, idName: 'printer', playerData: 'purge', expectedRevision: 1 });

    expect(result).toMatchObject({ ok: true, revision: 2, operation: 'delete', spotId: `${MOD}:spot:printer` });
    expect(result.transition?.before).toBe('resolved');
    expect(result.transition?.after).toBe('missing');
    expect(commits).toEqual(['create:none', 'delete:purge']);
    expect(registry.spots.has(`${MOD}:spot:printer`)).toBe(false);
    expect(coordinator.getRuntimeModState().spots.has(`${MOD}:spot:printer`)).toBe(false);
  });

  test('rolls Registry and coordinator state back when downstream commit fails', () => {
    const rollbacks: string[] = [];
    const { registry, coordinator } = makeCoordinator({
      onCommitted: () => { throw new Error('downstream unavailable'); },
      onRollback: context => rollbacks.push(`${context.commit.operation}:${context.commit.spotId}`),
    });
    const result = coordinator.submit({ operation: 'create', modName: MOD, spot: input(), expectedRevision: 0 });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('commit-failed');
    expect(registry.spots.has(`${MOD}:spot:printer`)).toBe(false);
    expect(coordinator.getRevision()).toBe(0);
    expect(coordinator.getRuntimeModState().modName).toBe(MOD);
    expect(rollbacks).toEqual(['create:draft-mod:spot:printer']);
  });

  test('applies suspend and resume transitions with revision checks, then allows replace', () => {
    const { registry, coordinator } = makeCoordinator();
    coordinator.submit({ operation: 'create', modName: MOD, spot: input(), expectedRevision: 0 });
    const suspended = coordinator.submit({ operation: 'suspend', modName: MOD, idName: 'printer', expectedRevision: 1 });

    expect(suspended).toMatchObject({ ok: true, revision: 2, operation: 'suspend' });
    expect(suspended.transition).toEqual({
      key: { table: 'spots', id: `${MOD}:spot:printer` },
      before: 'resolved',
      after: 'suspended',
    });
    expect(registry.spots.has(`${MOD}:spot:printer`)).toBe(false);
    expect(registry.isSpotSuspended(`${MOD}:spot:printer`)).toBe(true);
    expect(coordinator.getRuntimeModState().suspendedSpotIds).toContain(`${MOD}:spot:printer`);

    const staleResume = coordinator.submit({ operation: 'resume', modName: MOD, idName: 'printer', expectedRevision: 1 });
    expect(staleResume.ok).toBe(false);
    expect(staleResume.diagnostics[0]).toMatchObject({ code: 'stale-revision', path: 'expectedRevision' });
    expect(coordinator.getRevision()).toBe(2);

    const resumed = coordinator.submit({ operation: 'resume', modName: MOD, idName: 'printer', expectedRevision: 2 });
    expect(resumed).toMatchObject({ ok: true, revision: 3, operation: 'resume' });
    expect(resumed.transition).toEqual({
      key: { table: 'spots', id: `${MOD}:spot:printer` },
      before: 'suspended',
      after: 'resolved',
    });
    expect(registry.spots.has(`${MOD}:spot:printer`)).toBe(true);
    expect(registry.isSpotSuspended(`${MOD}:spot:printer`)).toBe(false);
    expect(coordinator.getRuntimeModState().suspendedSpotIds.size).toBe(0);

    const replaced = coordinator.submit({
      operation: 'replace',
      modName: MOD,
      idName: 'printer',
      spot: input('printer', { name: 'Resumed and replaced' }),
      expectedRevision: 3,
    });
    expect(replaced).toMatchObject({ ok: true, revision: 4, operation: 'replace' });
    expect(registry.spots.get(`${MOD}:spot:printer`)?.name).toBe('Resumed and replaced');
  });

  test('deletes a suspended Spot according to the current delete contract', () => {
    const { registry, coordinator } = makeCoordinator();
    coordinator.submit({ operation: 'create', modName: MOD, spot: input(), expectedRevision: 0 });
    coordinator.submit({ operation: 'suspend', modName: MOD, idName: 'printer', expectedRevision: 1 });

    const result = coordinator.submit({ operation: 'delete', modName: MOD, idName: 'printer', playerData: 'retain', expectedRevision: 2 });

    expect(result).toMatchObject({ ok: true, revision: 3, operation: 'delete', spotId: `${MOD}:spot:printer` });
    expect(result.transition).toEqual({
      key: { table: 'spots', id: `${MOD}:spot:printer` },
      before: 'suspended',
      after: 'missing',
    });
    expect(registry.spots.has(`${MOD}:spot:printer`)).toBe(false);
    expect(registry.isSpotSuspended(`${MOD}:spot:printer`)).toBe(false);
    expect(registry.spotIncludingSuspended(`${MOD}:spot:printer`)).toBeUndefined();
    expect(coordinator.getRuntimeModState().spots.has(`${MOD}:spot:printer`)).toBe(false);
    expect(coordinator.getRuntimeModState().suspendedSpotIds.size).toBe(0);
  });
});
