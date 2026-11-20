// ============================================================
// engine/story-replay.test.ts — 重阅读与分歧点准入守卫
//
// 覆盖机制：
//   1. replayStory：默认按 Entry 阅读凭据开放，显式许可优先
//   2. 分歧点守卫：未真读分支时拒绝进入，已读分支放行
//   3. 分歧点守卫：先真读分支后，重阅读可正常进入
//   4. 重阅读可完整走完链，但不重复发放奖励（防刷）
//   5. 重阅读走完链后可再次通过守卫（阅读记录已累积）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { cond, and } from '../../../src/engine/types';
import type { StoryEntryDef } from '../../../src/data-services/contracts/story-entry';
import { Resource } from '../../../src/arona-clicker/types/ids';
import type { StoryView } from '../../../src/arona-clicker/contracts/runtime/results';
import {
  finishWelcome,
  settleStoryPresentation,
  finishStory,
  desertEntry,
  desertPack,
  supplyPack,
  supplyEntry,
  supplyMain,
  supplyDetail,
  desertIntro,
  desertAssault,
  desertNegotiate,
  desertEpilogue,
  makePack,
} from './story-test-fixtures';

function advanceToChoice(game: GameInstance, replayId: string): StoryView {
  for (let guard = 0; guard < 200; guard++) {
    settleStoryPresentation(game, null, replayId);
    const view = game.story.getReplayStoryView(replayId);
    if (!view) throw new Error('Story ended before its choice input');
    if (view.phase === 'delivery') {
      const result = game.story.continueReplayStory(replayId, view.token);
      if (!result.success) throw new Error(`delivery failed: ${result.error}`);
      continue;
    }
    if (view.page.choices?.length) return view;
    const result = game.story.submitReplayStoryInput(replayId, view.token);
    if (!result.success) throw new Error(`Story stopped before its choice input: ${result.error}`);
  }
  throw new Error('Story choice loop exceeded its guard');
}

function choose(game: GameInstance, replayId: string, view: StoryView, index: number) {
  const optionId = view.page.choices?.[index]?.id;
  if (!optionId) throw new Error(`Choice ${index} is unavailable`);
  return game.story.submitReplayStoryInput(replayId, view.token, optionId);
}

function finishReplay(game: GameInstance, replayId: string, choiceIndex = 0): void {
  for (let guard = 0; guard < 200; guard++) {
    settleStoryPresentation(game, null, replayId);
    const playback = game.story.getReplayPlaybackView(replayId);
    if (!playback || playback.phase === 'idle') return;
    if (playback.phase === 'continue') {
      const result = game.story.continueReplayStory(replayId, playback.token!);
      if (!result.success) throw new Error(`replay continue failed: ${result.error}`);
    } else if (playback.phase === 'input') {
      const view = game.story.getReplayStoryView(replayId)!;
      const selected = view.availableChoiceIndexes.includes(choiceIndex) ? choiceIndex : view.availableChoiceIndexes[0];
      const optionId = view.page.choices && selected !== undefined ? view.page.choices[selected]?.id : undefined;
      const result = game.story.submitReplayStoryInput(replayId, playback.token!, optionId);
      if (!result.success) throw new Error(`replay input failed: ${result.error}`);
    } else if (playback.phase === 'failed') throw new Error(playback.error ?? 'Replay failed');
    else throw new Error(`Unexpected replay phase: ${playback.phase}`);
  }
  throw new Error('Replay fixture did not reach a bounded terminal state');
}

describe('重阅读与分歧点准入守卫', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('replayStory：缺省且未读时拒绝，显式开启仍可启动', () => {
    game.init([baseDatapack, desertPack, supplyPack]);
    finishWelcome(game);

    // supply_mission 未设 replayable → 拒绝
    expect(game.story.replayStory('test:story:supply_mission')).toMatchObject({ success: false, error: 'NotReplayable' });
    // desert_mission 可重阅读
    const replay = game.story.replayStory('test:story:desert_mission');
    expect(replay).toMatchObject({ success: true });
    if (!replay.success || !replay.replayId) return;
    expect(game.story.getReplayStoryView(replay.replayId)?.storyDefId).toBe('test:story:desert_intro');
    expect(game.getView().currentStory).toBeNull();
  });

  test('缺省重读按实际投递的 Entry 开放，重读不写凭据，共用正文的入口不共享许可', () => {
    const otherEntry = { ...supplyEntry, id: 'test:story:supply_other' };
    game.init([baseDatapack, makePack([supplyEntry, otherEntry], [supplyMain, supplyDetail])]);
    finishWelcome(game);

    expect(game.story.startStory(supplyEntry.id, 'passive').success).toBe(true);
    settleStoryPresentation(game);
    expect(game.story.getStoryReplayStatus(supplyEntry.id)).toEqual({ allowed: true, progress: 'read' });
    expect(game.story.replayStory(otherEntry.id)).toMatchObject({ success: false, error: 'NotReplayable' });

    const replay = game.story.replayStory(supplyEntry.id);
    expect(replay.success).toBe(true);
    if (!replay.success || !replay.replayId) throw new Error('缺省入口重读未启动');
    finishReplay(game, replay.replayId);
    expect(game.story.getStoryReplayStatus(supplyEntry.id)?.progress).toBe('read');

    finishStory(game);
    expect(game.story.getStoryReplayStatus(supplyEntry.id)?.progress).toBe('completed');
    expect(game.story.replayStory(otherEntry.id)).toMatchObject({ success: false, error: 'NotReplayable' });
    game.load(game.save());
    expect(game.story.getStoryReplayStatus(supplyEntry.id)).toEqual({ allowed: true, progress: 'completed' });
    const entry = game.registry.storyEntries.get(supplyEntry.id)!;
    entry.replayable = false;
    expect(game.story.replayStory(entry.id)).toMatchObject({ success: false, error: 'NotReplayable' });
  });

  test('旧存档只使用能确认 Entry 身份的完成投递凭据', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);
    delete game.registry.storyEntries.get(desertEntry.id)!.replayable;
    game.state.storyLog.push({ type: 'active', storyId: desertEntry.storyId, choiceIndex: -1 });
    expect(game.story.replayStory(desertEntry.id)).toMatchObject({ success: false, error: 'NotReplayable' });
    game.state.areaStoryDeliveries!.push({
      entryId: desertEntry.id, areaId: 'base:area:schale_main', sourceId: 'legacy', status: 'completed',
    });
    expect(game.story.getStoryReplayStatus(desertEntry.id)).toEqual({ allowed: true, progress: 'completed' });
  });

  test('分歧点守卫：独立 Transfer 拒绝未读分支，失败后新重播可选择已读路线', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次演出：走谈判分支（未读突击分支）
    game.story.startActiveStory('test:story:desert_mission');
    finishStory(game, 1);
    expect(game.getView().currentStory).toBeNull();

    // 重阅读：逐个确认正文 delivery 到达 choice Click，再选“正面突击”。
    const replay = game.story.replayStory('test:story:desert_mission');
    expect(replay).toMatchObject({ success: true });
    if (!replay.success || !replay.replayId) return;
    const replayId = replay.replayId;
    const choice = advanceToChoice(game, replayId);
    const before = { flags: structuredClone(game.state.flags), resources: structuredClone(game.state.resources), storyLog: structuredClone(game.state.storyLog) };
    const blocked = choose(game, replayId, choice, 0);
    expect(blocked).toMatchObject({ success: false, error: 'PlaybackFailed', detail: 'BranchGuardDenied' });
    expect(game.story.getReplayPlaybackView(replayId)?.phase).toBe('failed');
    expect({ flags: game.state.flags, resources: game.state.resources, storyLog: game.state.storyLog }).toEqual(before);

    // 失败的 Choice 已被接受；重新开始后选择已读的谈判路线。
    const nextReplay = game.story.replayStory('test:story:desert_mission');
    expect(nextReplay.success).toBe(true);
    if (!nextReplay.success || !nextReplay.replayId) return;
    expect(choose(game, nextReplay.replayId, advanceToChoice(game, nextReplay.replayId), 1)).toMatchObject({ success: true, finished: false });
    expect(game.story.getReplayStoryView(nextReplay.replayId)?.storyDefId).toBe('test:story:desert_negotiate');
  });

  test('分歧点守卫：先真读分支后，重阅读可正常进入', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次演出走突击分支（真读）
    game.story.startActiveStory('test:story:desert_mission');
    finishStory(game, 0);
    expect(game.getView().currentStory).toBeNull();

    // 重阅读：逐个确认正文 delivery 到达 choice Click，选突击 → 已读 → 放行。
    const replay = game.story.replayStory('test:story:desert_mission');
    expect(replay.success).toBe(true);
    if (!replay.success || !replay.replayId) return;
    expect(choose(game, replay.replayId, advanceToChoice(game, replay.replayId), 0)).toMatchObject({ success: true, finished: false });
    expect(game.story.getReplayStoryView(replay.replayId)?.storyDefId).toBe('test:story:desert_assault');
  });

  test('重阅读可完整走完链，但不重复发放奖励（防刷）', () => {
    // 配置条件奖励：走过突击分支 → +30 青辉石
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:replay_reward',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      conditionalRewards: [
        { condition: and(cond('visitedStoryInChain', 'test:story:desert_assault', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 30 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
    game.init([baseDatapack, pack]);
    finishWelcome(game);

    // 首次走突击 → +30
    game.story.startActiveStory('test:story:replay_reward');
    finishStory(game, 0);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(30);

    // 重阅读再走突击 → 不重复发放
    const replay = game.story.replayStory('test:story:replay_reward');
    expect(replay.success).toBe(true);
    if (!replay.success || !replay.replayId) return;
    finishReplay(game, replay.replayId, 0);
    expect(game.story.getReplayStoryView(replay.replayId)).toBeNull();
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(30);
  });

  test('重阅读走完链后可再次通过守卫（阅读记录已累积）', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次走谈判（未读突击）→ 重阅读选突击后由独立Transfer拒绝
    game.story.startActiveStory('test:story:desert_mission');
    finishStory(game, 1);
    const firstReplay = game.story.replayStory('test:story:desert_mission');
    expect(firstReplay.success).toBe(true);
    if (!firstReplay.success || !firstReplay.replayId) return;
    const firstReplayId = firstReplay.replayId;
    const firstChoice = advanceToChoice(game, firstReplayId);
    expect(choose(game, firstReplayId, firstChoice, 0)).toMatchObject({ success: false, error: 'PlaybackFailed', detail: 'BranchGuardDenied' });
    // 显式开启新重播并走谈判完成链，真实阅读记录已累积。
    const negotiateReplay = game.story.replayStory('test:story:desert_mission');
    expect(negotiateReplay.success).toBe(true);
    if (!negotiateReplay.success || !negotiateReplay.replayId) return;
    expect(choose(game, negotiateReplay.replayId, advanceToChoice(game, negotiateReplay.replayId), 1)).toMatchObject({ success: true, finished: false });
    finishReplay(game, negotiateReplay.replayId, 1);

    // 第二次重阅读：走谈判分支时经过的 negotiate 已完整读过，仍放行；
    // 突击分支从未被真实阅读 → 仍被拒
    const secondReplay = game.story.replayStory('test:story:desert_mission');
    expect(secondReplay.success).toBe(true);
    if (!secondReplay.success || !secondReplay.replayId) return;
    const secondChoice = advanceToChoice(game, secondReplay.replayId);
    expect(choose(game, secondReplay.replayId, secondChoice, 0)).toMatchObject({ success: false, error: 'PlaybackFailed', detail: 'BranchGuardDenied' });
    const finalReplay = game.story.replayStory('test:story:desert_mission');
    expect(finalReplay.success).toBe(true);
    if (!finalReplay.success || !finalReplay.replayId) return;
    expect(choose(game, finalReplay.replayId, advanceToChoice(game, finalReplay.replayId), 1)).toMatchObject({ success: true, finished: false });
    finishReplay(game, finalReplay.replayId, 1);
  });
});
