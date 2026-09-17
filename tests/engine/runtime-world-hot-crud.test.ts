import { describe, expect, test } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { RuntimeWorldDraft } from '../../src/arona-clicker/contracts/runtime-content';
import { Registry } from '../../src/data-services/registry/registry';
import { RuntimeWorldContentCoordinator } from '../../src/arona-clicker/services/runtime-world-content-coordinator';

class CountingRuntime extends AronaClickerRuntime {
  reloadCount = 0;

  override reloadPreservingState(datapacks: Datapack[]): void {
    this.reloadCount += 1;
    super.reloadPreservingState(datapacks);
  }
}

const MOD = 'runtime-world';
const INIT = `${MOD}:init:demo`;
const HOME = `${MOD}:area:home`;
const SECOND = `${MOD}:area:second`;
const NEW_AREA = `${MOD}:area:new-area`;

function worldDraft(
  inits: RuntimeWorldDraft['inits'] = [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [HOME, SECOND] }],
  areas: RuntimeWorldDraft['areas'] = [
    { idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [], adjacentAreaIds: [SECOND] },
    { idName: 'second', initId: INIT, name: 'Second', description: '', defaultSpots: [], adjacentAreaIds: [HOME] },
  ],
): RuntimeWorldDraft {
  return { modName: MOD, inits, areas };
}

function setupGame(): CountingRuntime {
  const game = new CountingRuntime();
  game.init([defaultDatapack]);
  expect(game.setRuntimeModMetadata({ modName: MOD, displayName: 'Runtime World', version: '1.0.0', author: '', description: '' }).ok).toBe(true);
  return game;
}

describe('Init / Area Runtime Editor 热 CRUD', () => {
  test('局部提交 create / replace 不触发整包 reload，并维护 Area 索引', () => {
    const game = setupGame();
    expect(game.applyRuntimeWorldDraft(worldDraft())).toMatchObject({ ok: true, revision: 1 });
    expect(game.reloadCount).toBe(0);
    expect(game.registry.inits.get(INIT)?.name).toBe('Demo Init');
    expect(game.registry.areas.get(HOME)?.name).toBe('Home');
    expect(game.registry.areasOfInit(INIT)).toEqual([HOME, SECOND]);

    const replaced = game.applyRuntimeWorldDraft(worldDraft(
      [{ idName: 'demo', name: 'Renamed Init', description: '', defaultAreas: [HOME, SECOND] }],
      [{ idName: 'home', initId: INIT, name: 'Renamed Home', description: 'updated', defaultSpots: [], adjacentAreaIds: [SECOND] }, { idName: 'second', initId: INIT, name: 'Second', description: '', defaultSpots: [], adjacentAreaIds: [HOME] }],
    ));
    expect(replaced).toMatchObject({ ok: true, revision: 2 });
    expect(game.reloadCount).toBe(0);
    expect(game.registry.inits.get(INIT)?.name).toBe('Renamed Init');
    expect(game.registry.areas.get(HOME)?.description).toBe('updated');
    expect(game.registry.areasOfInit(INIT)).toEqual([HOME, SECOND]);
  });

  test('当前 Area 被删除后回到当前 Init 的第一个有效默认 Area，并保留玩家资源', () => {
    const game = setupGame();
    expect(game.applyRuntimeWorldDraft(worldDraft()).ok).toBe(true);
    expect(game.inits.startNewGame(INIT)).toBe(true);
    game.state.resources['base:resource:credit'] = 321;
    expect(game.state.currentAreaId).toBe(HOME);

    const result = game.applyRuntimeWorldDraft(worldDraft(
      [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [SECOND] }],
      [{ idName: 'second', initId: INIT, name: 'Second', description: '', defaultSpots: [], adjacentAreaIds: [] }],
    ));

    expect(result.ok).toBe(true);
    expect(game.reloadCount).toBe(0);
    expect(game.state.activeInit).toBe(INIT);
    expect(game.state.currentAreaId).toBe(SECOND);
    expect(game.state.resources['base:resource:credit']).toBe(321);
  });

  test('当前 Init 被移除后退回 Init 选择界面，不留下悬空位置', () => {
    const game = setupGame();
    expect(game.applyRuntimeWorldDraft(worldDraft()).ok).toBe(true);
    expect(game.inits.startNewGame(INIT)).toBe(true);
    expect(game.applyRuntimeWorldDraft(worldDraft([], [])).ok).toBe(true);

    expect(game.state.activeInit).toBe('');
    expect(game.state.currentAreaId).toBeUndefined();
    expect(game.registry.inits.has(INIT)).toBe(false);
    expect(game.registry.areas.has(HOME)).toBe(false);
    expect(game.registry.areas.has(SECOND)).toBe(false);
  });

  test('删除仍被 Spot 引用的 Area 会 fail closed，且不留下半提交', () => {
    const game = setupGame();
    expect(game.applyRuntimeWorldDraft(worldDraft(
      [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [HOME] }],
      [{ idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [] }],
    )).ok).toBe(true);
    expect(game.runtimeDefinitionEditor.createSpot({
      idName: 'desk', areaId: HOME, name: 'Desk', description: '', purchaseOptions: [{ id: 'free', costs: [] }],
    }).ok).toBe(true);

    const rejected = game.applyRuntimeWorldDraft(worldDraft([], []));
    expect(rejected.ok).toBe(false);
    expect(rejected.message).toContain('Spot');
    expect(game.registry.inits.get(INIT)?.name).toBe('Demo Init');
    expect(game.registry.areas.has(HOME)).toBe(true);
    expect(game.registry.spots.has(`${MOD}:spot:desk`)).toBe(true);
  });

  test('双向拓扑通过 Runtime Overlay 提供反向边，不修改目标 Area Def', () => {
    const game = setupGame();
    const result = game.applyRuntimeWorldDraft(worldDraft(
      [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [HOME, SECOND] }],
      [
        { idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [], topology: [{ areaId: SECOND, type: 'twoWay' }] },
        { idName: 'second', initId: INIT, name: 'Second', description: '', defaultSpots: [], topology: [] },
      ],
    ));

    expect(result.ok).toBe(true);
    expect(game.registry.areas.get(HOME)?.adjacentAreaIds).toEqual([SECOND]);
    expect(game.registry.areas.get(SECOND)?.adjacentAreaIds).toEqual([]);
    expect(game.availableAreaIds(SECOND)).toContain(HOME);
  });

  test('Runtime Area 可以对外部 Area 建立双向拓扑', () => {
    const game = setupGame();
    expect(game.inits.startNewGame('base:init:schale_office')).toBe(true);
    const externalTarget = 'base:area:schale_main';
    const runtimeArea = `${MOD}:area:portal`;

    const result = game.applyRuntimeWorldDraft(worldDraft([], [{
      idName: 'portal',
      initId: 'base:init:schale_office',
      name: 'Portal',
      description: '',
      defaultSpots: [],
      topology: [{ areaId: externalTarget, type: 'twoWay' }],
    }]));

    expect(result.ok).toBe(true);
    expect(game.registry.areas.get(externalTarget)?.adjacentAreaIds).not.toContain(runtimeArea);
    expect(game.availableAreaIds(externalTarget)).toContain(runtimeArea);
    expect(game.travelToArea(runtimeArea, true)).toMatchObject({ success: true, areaId: runtimeArea });
    expect(game.state.currentAreaId).toBe(runtimeArea);
  });

  test('热创建并应用 Area 后，当前玩家可以立即移动到新 Area', () => {
    const game = setupGame();
    expect(game.applyRuntimeWorldDraft(worldDraft(
      [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [HOME] }],
      [{ idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [], adjacentAreaIds: [] }],
    )).ok).toBe(true);
    expect(game.inits.startNewGame(INIT)).toBe(true);

    const applied = game.applyRuntimeWorldDraft(worldDraft(
      [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [HOME, NEW_AREA] }],
      [
        { idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [], topology: [{ areaId: NEW_AREA, type: 'twoWay' }] },
        { idName: 'new-area', initId: INIT, name: 'New Area', description: '', defaultSpots: [], topology: [] },
      ],
    ));

    expect(applied.ok).toBe(true);
    expect(game.registry.areas.has(NEW_AREA)).toBe(true);
    expect(game.state.currentAreaId).toBe(HOME);
    expect(game.travelToArea(NEW_AREA)).toMatchObject({ success: true, areaId: NEW_AREA });
    expect(game.state.currentAreaId).toBe(NEW_AREA);
  });

  test('defaultAreas 的声明顺序在热替换后保持为运行时语义', () => {
    const game = setupGame();
    expect(game.applyRuntimeWorldDraft(worldDraft()).ok).toBe(true);

    const reordered = game.applyRuntimeWorldDraft(worldDraft(
      [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [SECOND, HOME] }],
      [
        { idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [], adjacentAreaIds: [SECOND] },
        { idName: 'second', initId: INIT, name: 'Second', description: '', defaultSpots: [], adjacentAreaIds: [HOME] },
      ],
    ));

    expect(reordered.ok).toBe(true);
    expect(game.registry.inits.get(INIT)?.defaultAreas).toEqual([SECOND, HOME]);
  });

  test('首个失败草稿不会锁定临时 Mod 或推进版本', () => {
    const game = new CountingRuntime();
    game.init([defaultDatapack]);
    const result = game.applyRuntimeWorldDraft({
      modName: MOD,
      inits: [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [`${MOD}:area:missing`] }],
      areas: [],
    });

    expect(result.ok).toBe(false);
    expect(game.getRuntimeWorldState()).toMatchObject({ modName: null, revision: 0 });
    expect(game.registry.inits.has(INIT)).toBe(false);
  });

  test('Init 的 startStoryId 必须指向已注册 Story 或 ActiveStory，并在失败时原子回滚', () => {
    const game = new CountingRuntime();
    game.init([defaultDatapack]);
    const result = game.applyRuntimeWorldDraft({
      modName: MOD,
      inits: [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [], startStoryId: `${MOD}:story:missing` }],
      areas: [],
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('start story');
    expect(game.getRuntimeWorldState()).toMatchObject({ modName: null, revision: 0 });
    expect(game.registry.inits.has(INIT)).toBe(false);
  });

  test('Init 可以引用 ActiveStory 投放位', () => {
    const game = new CountingRuntime();
    game.init([defaultDatapack]);
    const entry = [...game.registry.activeStories.values()][0];
    expect(entry).toBeDefined();
    const result = game.applyRuntimeWorldDraft({
      modName: MOD,
      inits: [{ idName: 'demo', name: 'Demo Init', description: '', defaultAreas: [], startStoryId: entry.id }],
      areas: [],
    });

    expect(result.ok).toBe(true);
    expect(game.registry.inits.get(`${MOD}:init:demo`)?.startStoryId).toBe(entry.id);
  });

  test('替换含未支持 opaque 字段的 Init 会被拒绝，避免静默丢失', () => {
    const registry = new Registry();
    const initWithExtra = {
      id: INIT,
      name: 'Opaque Init',
      description: '',
      defaultAreas: [HOME],
      extra: { t: 'dict' as const, v: { retained: { t: 'str' as const, v: 'yes' } } },
    };
    const area = { id: HOME, initId: INIT, name: 'Home', description: '', defaultSpots: [] };
    registry.load({
      ...defaultDatapack,
      modName: MOD,
      inits: [...defaultDatapack.inits, initWithExtra],
      areas: [...defaultDatapack.areas, area],
    });
    const coordinator = new RuntimeWorldContentCoordinator(registry);
    coordinator.adoptRuntimeMod(MOD, [INIT], [HOME]);

    const result = coordinator.applyWorldDraft({
      modName: MOD,
      inits: [{ idName: 'demo', name: 'Renamed Init', description: '', defaultAreas: [HOME] }],
      areas: [{ idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [] }],
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('未支持字段');
    expect(registry.inits.get(INIT)).toBe(initWithExtra);
    expect(coordinator.getState().revision).toBe(0);
  });
});
