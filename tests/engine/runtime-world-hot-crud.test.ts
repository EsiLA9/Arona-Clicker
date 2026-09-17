import { describe, expect, test } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { RuntimeWorldDraft } from '../../src/arona-clicker/contracts/runtime-content';

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
});
