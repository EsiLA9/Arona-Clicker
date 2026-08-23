// ============================================================
// engine/story-entry-split.test.ts
// Story 三层拆分回归：StoryEntryDef（触发入口）/ StoryDef（纯演出）/ Talklet
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { Registry } from '../../src/engine/registry/registry';
import { Datapack, and } from '../../src/engine/types';

/** 推进完当前展开的剧情（active 会锁定移动）。 */
function finishStory(g: GameInstance): void {
  for (let guard = 0; guard < 200; guard++) {
    const r = g.advanceStory();
    if (r.success && 'finished' in r && r.finished) break;
    if (!r.success && r.error === 'ChoiceRequired') {
      g.advanceStory(0);
      continue;
    }
    if (!r.success) break;
  }
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
    const entry = game.registry.storyEntries.get('base:story:schale_welcome')!;
    expect(entry.type).toBe('active');
    expect(entry.storyId).toBe('base:story:schale_welcome');
    expect(entry.availableInits).toContain('base:init:schale_office');
    // 演出本体是纯演出：无触发/揭示字段
    const story = game.registry.stories.get(entry.storyId)!;
    expect(story.talklets.length).toBeGreaterThan(0);
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
        { id: 'x:story:ghost', storyId: 'x:story:missing', type: 'active', availableInits: [], triggerCondition: and() },
      ],
      passiveStories: [],
    };
    expect(() => reg.load(broken)).toThrow(/references unknown story: "x:story:missing"/);
  });

  test('passive 抽选与完结奖励经 Entry 消费；完成记录仍按 Story.id', () => {
    game.init([baseDatapack]);
    finishStory(game); // 先完成主动 welcome，腾出 passive 抽选窗口
    game.clickSend();
    const current = game.getView().currentStory;
    if (current?.type !== 'passive') return; // 池内无可用 passive 时跳过
    finishStory(game);
    // 完成记录按 Story.id 记（1:1 时与 Entry.id 同值）
    expect(game.state.storyLog.some(c => c.storyId.startsWith('base:story:'))).toBe(true);
    // 奖励从 Entry.completionReward 读取（青辉石为全局资源 → globalResources 桶）
    expect(game.state.globalResources?.['base:resource:pyroxene'] ?? 0).toBeGreaterThan(0);
  });

  test('storyReadLogs：启动记录首条 Talklet，推进记录已读索引与所选选项', () => {
    game.init([baseDatapack]);
    // schale_welcome：talklet 0~4 无选项（旁白+对话+click），5 含选项，6 结尾
    const logs = () => game.state.storyReadLogs ?? {};
    expect(logs()['base:story:schale_welcome']?.readTalkletIndexes).toEqual([0]);

    game.advanceStory(); // 0 → 1
    game.advanceStory(); // 1 → 2
    game.advanceStory(); // 2 → 3
    game.advanceStory(); // 3 → 4
    game.advanceStory(); // 4 → 5（选项页）
    let log = logs()['base:story:schale_welcome']!;
    expect(log.readTalkletIndexes).toEqual([0, 1, 2, 3, 4, 5]);
    expect(log.chosenChoiceIndexes[5]).toBeUndefined();

    game.advanceStory(0); // 5(选 0) → 6
    log = logs()['base:story:schale_welcome']!;
    expect(log.chosenChoiceIndexes[5]).toEqual([0]);
    expect(log.readTalkletIndexes).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test('无选项页推进不记录 chosenChoiceIndexes', () => {
    game.init([baseDatapack]);
    game.advanceStory(); // 0 → 1（0 无选项）
    const log = game.state.storyReadLogs!['base:story:schale_welcome']!;
    expect(log.chosenChoiceIndexes).toEqual({});
  });

  test('旧档兼容：缺失 storyReadLogs 的状态可正常推进', () => {
    game.init([baseDatapack]);
    // 模拟旧档：删除可选字段
    delete (game.state as { storyReadLogs?: unknown }).storyReadLogs;
    const r = game.advanceStory();
    expect(r.success).toBe(true);
    // 推进后重新产生日志
    expect(game.state.storyReadLogs?.['base:story:schale_welcome']).toBeDefined();
  });
});
