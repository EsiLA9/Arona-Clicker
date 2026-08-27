// ============================================================
// engine/def-factory/story-entry.test.ts — StoryEntry 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  activeStory,
  passiveStory,
  ActiveStoryBuilder,
  PassiveStoryBuilder,
  and,
  cond,
  Resource,
} from '../../../src/engine/types';
import { tagPath } from '../../../src/engine/core/tag';
import type { ActiveStoryEntry, PassiveStoryEntry } from '../../../src/engine/types';

describe('StoryEntry builders', () => {
  test('activeStory() 返回 ActiveStoryBuilder 实例', () => {
    expect(activeStory('s')).toBeInstanceOf(ActiveStoryBuilder);
  });

  test('active：最小 entry（缺省恒真条件 / storyId 缺省自身 / 可重读）', () => {
    const def = activeStory('base:story:welcome').inits('base:init:schale_office').build();
    expect(def).toEqual<ActiveStoryEntry>({
      id: 'base:story:welcome',
      storyId: 'base:story:welcome',
      type: 'active',
      triggerCondition: and(),
      availableInits: ['base:init:schale_office'],
    });
  });

  test('active：分歧链 entry（conditionalRewards / branchGuard / replayable）', () => {
    const def = activeStory(
      'base:story:millennium_game_crisis',
      'base:story:millennium_game_crisis_intro',
    )
      .inits('base:init:millennium')
      .replayable()
      .completionStrategy('conditional')
      .conditionalReward(
        and(cond('visitedStoryInChain', 'base:story:millennium_game_crisis_debug', '==', 1)),
        { op: 'addResource', target: Resource.Pyroxene, value: 40 },
      )
      .branchGuard(
        'base:story:millennium_game_crisis_bribe',
        [{ storyId: 'base:story:millennium_game_crisis_bribe', talkletIndex: -1 }],
        '你还没有真正走过这条路线，无法回顾该分歧。',
      )
      .build();
    expect(def).toEqual<ActiveStoryEntry>({
      id: 'base:story:millennium_game_crisis',
      storyId: 'base:story:millennium_game_crisis_intro',
      type: 'active',
      triggerCondition: and(),
      availableInits: ['base:init:millennium'],
      replayable: true,
      completionStrategy: 'conditional',
      conditionalRewards: [
        {
          condition: and(cond('visitedStoryInChain', 'base:story:millennium_game_crisis_debug', '==', 1)),
          effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 40 }],
        },
      ],
      branchGuards: [
        {
          storyId: 'base:story:millennium_game_crisis_bribe',
          prerequisites: [{ storyId: 'base:story:millennium_game_crisis_bribe', talkletIndex: -1 }],
          denialMessage: '你还没有真正走过这条路线，无法回顾该分歧。',
        },
      ],
    });
  });

  test('passive：闲聊 entry（weight / 完结奖励 / tags / reveal）', () => {
    const def = passiveStory('base:story:schale_briefing')
      .inits('base:init:schale_office')
      .weight(1)
      .tags(tagPath('theme', 'daily'))
      .reveal('name', and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 30)))
      .rewardFirst({ op: 'addResource', target: Resource.Pyroxene, value: 15 })
      .rewardRepeat({ op: 'addResource', target: Resource.Pyroxene, value: 5 })
      .build();
    expect(def).toEqual<PassiveStoryEntry>({
      id: 'base:story:schale_briefing',
      storyId: 'base:story:schale_briefing',
      type: 'passive',
      triggerCondition: and(),
      repeatable: true,
      weight: 1,
      availableInits: ['base:init:schale_office'],
      tags: [['theme', 'daily']],
      revealTriggers: [
        { reveal: 'name', condition: and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 30)) },
      ],
      completionReward: {
        first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
        repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
      },
    });
  });

  test('passive：壁垒/冷却/阻断（owner / cooldown / block / 演出锁定）', () => {
    const def = passiveStory('base:story:hoshino_conv_2', 'base:story:hoshino_rooftop_hint')
      .owner('Hoshino')
      .inits('base:init:schale_office')
      .repeatable(false)
      .weight(1)
      .block(and(cond('area', 'base:area:schale_rooftop', '==', 1)))
      .leaveArea(false)
      .interruptible(false)
      .build();
    expect(def).toEqual<PassiveStoryEntry>({
      id: 'base:story:hoshino_conv_2',
      storyId: 'base:story:hoshino_rooftop_hint',
      type: 'passive',
      owner: 'Hoshino',
      availableInits: ['base:init:schale_office'],
      repeatable: false,
      weight: 1,
      triggerCondition: and(),
      block: and(cond('area', 'base:area:schale_rooftop', '==', 1)),
      leaveArea: false,
      interruptible: false,
    });
  });

  test('active：羁绊剧情 entry（owner / 首次奖励）', () => {
    const def = activeStory('base:bond:hoshino_1')
      .owner('Hoshino')
      .replayable()
      .rewardFirst({ op: 'addResource', target: Resource.Pyroxene, value: 30 })
      .build();
    expect(def).toEqual<ActiveStoryEntry>({
      id: 'base:bond:hoshino_1',
      storyId: 'base:bond:hoshino_1',
      type: 'active',
      triggerCondition: and(),
      availableInits: [],
      replayable: true,
      owner: 'Hoshino',
      completionReward: {
        first: [{ op: 'addResource', target: Resource.Pyroxene, value: 30 }],
      },
    });
  });

  test('两个 builder 实例类型正确', () => {
    expect(passiveStory('s')).toBeInstanceOf(PassiveStoryBuilder);
    expect(activeStory('s')).toBeInstanceOf(ActiveStoryBuilder);
  });

  test('active 缺省不输出可选字段', () => {
    const def = activeStory('s').inits().build();
    expect(def).not.toHaveProperty('completionReward');
    expect(def).not.toHaveProperty('owner');
    expect(def).not.toHaveProperty('replayable');
  });

  test('passive 缺省不输出可选字段', () => {
    const def = passiveStory('s').inits().weight(1).build();
    expect(def).not.toHaveProperty('completionReward');
    expect(def).not.toHaveProperty('owner');
    expect(def).not.toHaveProperty('cooldownFrames');
    expect(def).not.toHaveProperty('block');
  });
});
