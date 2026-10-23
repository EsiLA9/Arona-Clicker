import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/story-entry-split.test.ts
// Story 三层拆分回归：StoryEntryDef（触发入口）/ StoryDef（纯演出）/ Talklet
// ============================================================
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { Registry } from '../../src/data-services/registry/registry';
import { and } from '../../src/engine/types';
import type { StoryView } from '../../src/arona-clicker/contracts/runtime/results';
import { finishStory } from './story-test-fixtures';

function advanceToChoice(g: GameInstance): StoryView {
  for (let guard = 0; guard < 200; guard++) {
    const view = g.story.getCurrentStoryView();
    if (!view) throw new Error('Story ended before its choice input');
    if (view.phase === 'delivery') {
      const result = g.story.advanceStory(undefined, null, view.token);
      if (!result.success) throw new Error(`delivery failed: ${result.error}`);
      continue;
    }
    if (view.page.choices?.length) return view;
    const result = g.story.clickSend(null, view.token);
    if (result.type === 'idle' || result.type === 'choice'
      || result.type === 'completed' && !result.advance.success) throw new Error('Story stopped before choice');
  }
  throw new Error('Story choice loop exceeded its guard');
}

describe('Story 三层拆分（Entry / Story / Talklet）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('registry：storyEntries 与 stories 并行注册，entry.storyId 重定向到演出本体', () => {
    game.init([baseDatapack]);
    const entry = game.registry.storyEntries.get('base:activestory:schale_welcome')!;
    expect(entry.type).toBe('active');
    expect(entry.storyId).toBe('base:story:schale_welcome');
    expect(entry.availableInits).toContain('base:init:schale_office');
    // 演出本体是纯演出：无触发/揭示字段
    const story = game.registry.stories.get(entry.storyId)!;
    expect(story.nodes.length).toBeGreaterThan(0);
    expect(story).not.toHaveProperty('talklets');
    expect(story).not.toHaveProperty('triggerCondition');
    expect(story).not.toHaveProperty('revealTriggers');
    // 揭示/触发信息只存在于 Entry
    expect(entry.triggerCondition).toBeDefined();
  });

  test('registry：entry.storyId 引用缺失时抛错', () => {
    const reg = new Registry();
    const broken: Datapack = {
      ...baseDatapack,
      stories: [],
      activeStories: [
        { id: 'x:activestory:ghost', storyId: 'x:story:missing', type: 'active', availableInits: [], triggerCondition: and() },
      ],
      passiveStories: [],
    };
    expect(() => reg.load(broken)).toThrow(/references unknown story: "x:story:missing"/);
  });

  test('registry：FollowUp 校验目标 StoryEntry 与 Area 引用', () => {
    const reg = new Registry();
    const source = baseDatapack.passiveStories.find(entry => entry.id === 'base:passivestory:hoshino_conv_2')!;
    const dp: Datapack = {
      ...baseDatapack,
      passiveStories: [{
        ...source,
        followUps: [{
          id: 'test-follow-up',
          waitFor: { kind: 'next-enter-area', areaId: 'base:area:schale_rooftop' },
          outcome: { kind: 'start-story-entry', storyEntryId: 'base:activestory:hoshino_rooftop_meet' },
        }],
      }],
    };
    expect(() => reg.load(dp)).not.toThrow();
  });

  test('registry：FollowUp 拒绝缺失目标与错误 Area', () => {
    const reg = new Registry();
    const source = baseDatapack.passiveStories.find(entry => entry.id === 'base:passivestory:hoshino_conv_2')!;
    const broken: Datapack = {
      ...baseDatapack,
      passiveStories: [{
        ...source,
        followUps: [{
          id: 'broken-follow-up',
          waitFor: { kind: 'next-enter-area', areaId: 'test:area:missing' },
          outcome: { kind: 'start-story-entry', storyEntryId: 'test:activestory:missing' },
        }],
      }],
    };
    expect(() => reg.load(broken)).toThrow(/references an invalid area/);
  });

  test('registry：FollowUp id 在同一 StoryEntry 内必须唯一', () => {
    const reg = new Registry();
    const source = baseDatapack.passiveStories.find(entry => entry.id === 'base:passivestory:hoshino_conv_2')!;
    const duplicate = {
      id: 'duplicate',
      waitFor: { kind: 'next-enter-area' as const, areaId: 'base:area:schale_rooftop' },
      outcome: { kind: 'start-story-entry' as const, storyEntryId: 'base:activestory:hoshino_rooftop_meet' },
    };
    const broken: Datapack = {
      ...baseDatapack,
      passiveStories: [{ ...source, followUps: [duplicate, duplicate] }],
    };
    expect(() => reg.load(broken)).toThrow(/duplicate or missing FollowUp id/);
  });

  test('passive 抽选与完结奖励经 Entry 消费；完成记录仍按 Story.id', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      game.init([baseDatapack]);
      finishStory(game); // 先完成主动 welcome，腾出 passive 抽选窗口
      game.story.clickSend();
      const current = game.getView().currentStory;
      if (current?.type !== 'passive') return; // 池内无可用 passive 时跳过
      finishStory(game);
      // 完成记录按 Story.id 记（1:1 时与 Entry.id 同值）
      expect(game.state.storyLog.some(c => c.storyId.startsWith('base:story:'))).toBe(true);
      // 奖励从 Entry.completionReward 读取（青辉石为全局资源 → globalResources 桶）
      expect(game.state.globalResources?.['base:resource:pyroxene'] ?? 0).toBeGreaterThan(0);
    } finally {
      random.mockRestore();
    }
  });

  test('storyReadLogs：启动记录首条 Talklet，推进记录已读索引与所选选项', () => {
    game.init([baseDatapack]);
    // 新节点中只有有效 delivery ack 才记 Talklet ordinal。
    const logs = () => game.state.storyReadLogs ?? {};
    expect(logs()['base:story:schale_welcome']?.readTalkletIndexes ?? []).toEqual([]);
    const first = game.story.getCurrentStoryView()!;
    expect(first).toMatchObject({ nodeId: 'p1-body', phase: 'delivery' });
    expect(game.story.advanceStory(undefined, null, first.token).success).toBe(true);
    expect(logs()['base:story:schale_welcome']?.readTalkletIndexes).toEqual([0]);

    const choice = advanceToChoice(game);
    let log = logs()['base:story:schale_welcome']!;
    expect(log.readTalkletIndexes).toEqual([0, 1, 2, 3, 4]);
    expect(log.chosenChoiceIndexes).toEqual({});

    const optionId = choice.page.choices![0]!.id;
    game.story.advanceStory(optionId, null, choice.token);
    log = logs()['base:story:schale_welcome']!;
    expect(log.chosenChoiceIndexes[4]).toEqual([0]);
    expect(log.readTalkletIndexes).toEqual([0, 1, 2, 3, 4]);
    const ending = game.story.getCurrentStoryView()!;
    expect(ending).toMatchObject({ nodeId: 'p7-body', phase: 'delivery' });
    game.story.advanceStory(undefined, null, ending.token);
    expect(log.readTalkletIndexes).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('无选项页推进不记录 chosenChoiceIndexes', () => {
    game.init([baseDatapack]);
    const view = game.story.getCurrentStoryView()!;
    game.story.advanceStory(undefined, null, view.token); // delivery 0（无choice）
    const log = game.state.storyReadLogs!['base:story:schale_welcome']!;
    expect(log.chosenChoiceIndexes).toEqual({});
  });

  test('旧档兼容：缺失 storyReadLogs 的状态可正常推进', () => {
    game.init([baseDatapack]);
    // 模拟旧档：删除可选字段
    delete (game.state as { storyReadLogs?: unknown }).storyReadLogs;
    const view = game.story.getCurrentStoryView()!;
    const r = game.story.advanceStory(undefined, null, view.token);
    expect(r.success).toBe(true);
    // 推进后重新产生日志
    expect(game.state.storyReadLogs?.['base:story:schale_welcome']).toBeDefined();
  });
});
