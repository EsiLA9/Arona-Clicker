import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { whisperClickPack, finishWelcome } from './story-test-fixtures';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const PYROXENE = 'base:resource:pyroxene';
const FOUNDATION = 'base:enhancement:foundation';
const ETERNAL = 'base:enhancement:eternal_contract';

describe('Init 生命周期：Global 数据与 per-Init 数据分离', () => {
  const games: GameInstance[] = [];
  const createGame = (): GameInstance => {
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
    return game;
  };

  afterEach(() => games.forEach(game => game.stop()));

  test('真正开始新游戏不继承旧 GlobalEnh', () => {
    const game = createGame();
    game.state.resources[PYROXENE] = 100;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
    expect(game.state.unlockedEnhancements).not.toContain(FOUNDATION);
  });

  test('新进入 Init、暂时离开和彻底 Init 都保留 GlobalEnh', () => {
    const game = createGame();
    game.state.resources[PYROXENE] = 300;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    game.inits.unlockInit(MILLENNIUM);

    game.inits.restartInit();
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    expect(game.state.unlockedEnhancements).toContain(FOUNDATION);

    game.inits.restartInit();
    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    expect(game.state.unlockedEnhancements).toContain(FOUNDATION);

    game.inits.hardRestartInit();
    expect(game.state.unlockedEnhancements).toContain(FOUNDATION);
  });

  test('恢复旧 Init 不会覆盖后来获得的 GlobalEnh', () => {
    const game = createGame();
    game.state.resources[PYROXENE] = 400;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    game.inits.restartInit();
    game.inits.unlockInit(MILLENNIUM);
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);

    game.mutations.addEnhancement(ETERNAL);
    game.inits.restartInit();
    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    expect(game.state.unlockedEnhancements).toEqual(expect.arrayContaining([FOUNDATION, ETERNAL]));
  });

  test('直接恢复目标 Init 会先保存当前 Init 并重建运行时', () => {
    const game = createGame();
    const officeSpot = 'base:spot:credit_printer';
    const millenniumSpot = 'base:spot:millennium_game';
    game.mutations.setSpotLevel(officeSpot, 2);
    const initialOfficeAffectors = game.affectorEngine.getActiveInstances().filter(i => i.mountEntityId === officeSpot).length;
    const before = game.inits.getRuntimeGeneration();
    expect(game.inits.isRuntimeGenerationCurrent(before)).toBe(true);

    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    expect(game.state.activeInit).toBe(MILLENNIUM);
    expect(game.state.initSnapshots?.[OFFICE]?.spotLevels[officeSpot]).toBe(2);
    expect(game.inits.getRuntimeGeneration()).toBeGreaterThan(before);
    expect(game.inits.isRuntimeGenerationCurrent(before)).toBe(false);
    expect(game.affectorEngine.getActiveInstances().some(i => i.mountEntityId === officeSpot)).toBe(false);

    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    expect(game.state.spotLevels[officeSpot]).toBe(2);
    expect(game.affectorEngine.getActiveInstances().filter(i => i.mountEntityId === officeSpot)).toHaveLength(initialOfficeAffectors);

    game.effectEngine.applyEffects([{ op: 'setSpotLevel', target: millenniumSpot, value: 3 }]);
    expect(game.state.spotLevels[millenniumSpot]).toBeUndefined();
  });

  test('Story cursor 随 Init 快照恢复，而不是复用旧运行时对象', () => {
    const game = createGame();
    const officeStory = 'base:activestory:schale_welcome';

    expect(game.story.getCurrentStoryId()).toBe(officeStory);
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    expect(game.state.initSnapshots?.[OFFICE]?.storyCursors?.global.currentStoryId).toBe(officeStory);
    expect(game.story.getCurrentStoryId()).toBeNull();

    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    expect(game.story.getCurrentStoryId()).toBe(officeStory);
  });

  test('进行中的 insert Story 随 Init 快照恢复执行上下文', () => {
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack, whisperClickPack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:whisper_click').success).toBe(true);
    expect(game.story.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory?.storyDefId).toBe('test:story:whisper_click_sub');
    expect(game.state.initSnapshots?.[OFFICE]).toBeUndefined();

    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    const snapshot = game.state.initSnapshots?.[OFFICE];
    expect(snapshot?.storyCursors?.global.insertStack).toEqual([
      { storyId: 'test:story:whisper_click_main', pageIndex: 1 },
    ]);

    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    expect(game.getView().currentStory?.storyDefId).toBe('test:story:whisper_click_sub');
    expect(game.getView().currentStory?.pageIndex).toBe(0);
  });

  test('同一 Runtime 读档前清理旧 Affector 实例', () => {
    const game = createGame();
    const spotId = 'base:spot:credit_printer';
    const save = game.save();
    delete save.playerState.spotLevels[spotId];

    expect(game.affectorEngine.getActiveInstances().some(i => i.mountEntityId === spotId)).toBe(true);
    game.load(save);
    expect(game.affectorEngine.getActiveInstances().some(i => i.mountEntityId === spotId)).toBe(false);
  });

  test('恢复 Init 后当前状态与快照不共享可变对象', () => {
    const game = createGame();
    const snapshotResource = 'base:resource:credit';
    game.mutations.setResource(snapshotResource, 17);
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    const officeSnapshot = game.state.initSnapshots?.[OFFICE];
    expect(officeSnapshot?.resources[snapshotResource]).toBe(17);

    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    game.mutations.changeResource(snapshotResource, 5);
    expect(officeSnapshot?.resources[snapshotResource]).toBe(17);
  });

  test('load 与 reset 也会推进 runtime generation', () => {
    const game = createGame();
    const save = game.save();
    const beforeLoad = game.inits.getRuntimeGeneration();

    game.load(save);
    const afterLoad = game.inits.getRuntimeGeneration();
    expect(afterLoad).toBeGreaterThan(beforeLoad);
    expect(game.inits.isRuntimeGenerationCurrent(beforeLoad)).toBe(false);

    game.reset();
    expect(game.inits.getRuntimeGeneration()).toBeGreaterThan(afterLoad);
  });
});
