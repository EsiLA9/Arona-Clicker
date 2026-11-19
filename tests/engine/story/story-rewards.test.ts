// ============================================================
// engine/story-rewards.test.ts — 完结奖励结算（conditionalRewards）
//
// 覆盖机制：
//   1. conditionalRewards 条件奖励（分歧 flag 决定档位）
//   2. 无任何条件命中时发放兜底包
//   3. visitedStoryInChain：条件奖励引用链内经过的 Story
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { cond, and } from '../../../src/engine/types';
import type { StoryEntryDef } from '../../../src/data-services/contracts/story-entry';
import { Resource } from '../../../src/arona-clicker/types/ids';
import { finishWelcome, finishStory, desertEntry, desertIntro, desertAssault, desertNegotiate, desertEpilogue, makePack } from './story-test-fixtures';

describe('Story 完结奖励（conditionalRewards）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('conditionalRewards：分歧 flag 决定完结奖励（突击 +50，谈判 +20）', () => {
    // flag 条件只区分"存在与否"（value=1 表示存在且非空）；两条都命中时两份条件奖励均结算。
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:assault_mission',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      completionReward: { first: [{ op: 'addResource', target: Resource.Pyroxene, value: 3 }] },
      conditionalRewards: [
        { condition: and(cond('flag', 'route', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 50 }] },
        { condition: and(), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 20 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.story.startActiveStory('test:story:assault_mission');
    finishStory(game, 0); // 默认首奖 +3，两个命中条件依序 +50、+20
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(73);
  });

  test('conditionalRewards 无命中时仍发放默认首奖', () => {
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:fallback_mission',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      completionReward: { first: [{ op: 'addResource', target: Resource.Pyroxene, value: 7 }] },
      conditionalRewards: [
        // 永不命中的条件
        { condition: and(cond('flag', 'never_set', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 99 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.story.startActiveStory('test:story:fallback_mission');
    finishStory(game, 1); // 走谈判
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(7);
  });

  test('simple 策略只结算默认奖励，不读取条件 outcomes', () => {
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:simple_mission',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'simple',
      completionReward: { first: [{ op: 'addResource', target: Resource.Pyroxene, value: 4 }] },
      conditionalRewards: [{ condition: and(), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 90 }] }],
    };
    game.init([baseDatapack, makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue])]);
    finishWelcome(game);
    game.story.startActiveStory(entry.id);
    finishStory(game, 1);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(4);
  });

  test('visitedStoryInChain：条件奖励可引用链内经过的 Story', () => {
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:chain_mission',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      completionReward: { first: [{ op: 'addResource', target: Resource.Pyroxene, value: 2 }] },
      conditionalRewards: [
        // 走过突击分支 → 高奖励（不依赖 flag，直接看经过的 Story）
        { condition: and(cond('visitedStoryInChain', 'test:story:desert_assault', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 30 }] },
        { condition: and(cond('visitedStoryInChain', 'test:story:desert_negotiate', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);

    // 走突击 → +30
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.story.startActiveStory('test:story:chain_mission');
    finishStory(game, 0);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(32);

    // 重置走谈判 → +15
    game.reset();
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.story.startActiveStory('test:story:chain_mission');
    finishStory(game, 1);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(17);
  });
});
