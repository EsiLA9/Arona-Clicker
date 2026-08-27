// ============================================================
// engine/story-replay.test.ts — 重阅读与分歧点准入守卫
//
// 覆盖机制：
//   1. replayStory：仅 replayable Entry 可用，非 replayable 返回 NotReplayable
//   2. 分歧点守卫：未真读分支时拒绝进入，已读分支放行
//   3. 分歧点守卫：先真读分支后，重阅读可正常进入
//   4. 重阅读可完整走完链，但不重复发放奖励（防刷）
//   5. 重阅读走完链后可再次通过守卫（阅读记录已累积）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { Resource, StoryEntryDef, cond, and } from '../../src/engine/types';
import {
  finishWelcome,
  finishStory,
  desertEntry,
  desertPack,
  supplyPack,
  desertIntro,
  desertAssault,
  desertNegotiate,
  desertEpilogue,
  makePack,
} from './story-test-fixtures';

describe('重阅读与分歧点准入守卫', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('replayStory：仅 replayable Entry 可用，非 replayable 返回 NotReplayable', () => {
    game.init([baseDatapack, desertPack, supplyPack]);
    finishWelcome(game);

    // supply_mission 未设 replayable → 拒绝
    expect(game.replayStory('test:story:supply_mission')).toMatchObject({ success: false, error: 'NotReplayable' });
    // desert_mission 可重阅读
    expect(game.replayStory('test:story:desert_mission')).toMatchObject({ success: true });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_intro');
  });

  test('分歧点守卫：未真读分支时拒绝进入，已读分支放行', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次演出：走谈判分支（未读突击分支）
    game.startActiveStory('test:story:desert_mission');
    finishStory(game, 1);
    expect(game.getView().currentStory).toBeNull();

    // 重阅读：先推进到选项页，再选"正面突击" → 守卫拦截
    expect(game.replayStory('test:story:desert_mission')).toMatchObject({ success: true });
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false }); // t0 → t1（选项页）
    const blocked = game.advanceStory(0);
    expect(blocked).toMatchObject({ success: false, error: 'BranchGuardDenied' });
    if ('denialMessage' in blocked) {
      expect(blocked.denialMessage).toBe('你还没有真正走过突击路线，无法进入该分歧。');
    }
    // 页面未推进、效果未应用：仍停在选项页
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_intro');
    expect(game.getView().currentStory!.pageIndex).toBe(1);

    // 改选"迂回谈判"（已真读）→ 放行
    expect(game.advanceStory(1)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_negotiate');
  });

  test('分歧点守卫：先真读分支后，重阅读可正常进入', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次演出走突击分支（真读）
    game.startActiveStory('test:story:desert_mission');
    finishStory(game, 0);
    expect(game.getView().currentStory).toBeNull();

    // 重阅读：先推进到选项页，选突击 → 已读 → 放行
    game.replayStory('test:story:desert_mission');
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false }); // t0 → t1
    expect(game.advanceStory(0)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_assault');
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
    game.startActiveStory('test:story:replay_reward');
    finishStory(game, 0);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(30);

    // 重阅读再走突击 → 不重复发放
    game.replayStory('test:story:replay_reward');
    finishStory(game, 0);
    expect(game.getView().currentStory).toBeNull();
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(30);
  });

  test('重阅读走完链后可再次通过守卫（阅读记录已累积）', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次走谈判（未读突击）→ 重阅读选突击被拒
    game.startActiveStory('test:story:desert_mission');
    finishStory(game, 1);
    game.replayStory('test:story:desert_mission');
    game.advanceStory(); // t0 → t1
    expect(game.advanceStory(0)).toMatchObject({ success: false, error: 'BranchGuardDenied' });
    // 改走谈判完成本次重阅读（真实读完谈判分支）
    expect(game.advanceStory(1)).toMatchObject({ success: true, finished: false });
    finishStory(game, 1);

    // 第二次重阅读：走谈判分支时经过的 negotiate 已完整读过，仍放行；
    // 突击分支从未被真实阅读 → 仍被拒
    game.replayStory('test:story:desert_mission');
    game.advanceStory();
    expect(game.advanceStory(0)).toMatchObject({ success: false, error: 'BranchGuardDenied' });
    expect(game.advanceStory(1)).toMatchObject({ success: true, finished: false });
  });
});
