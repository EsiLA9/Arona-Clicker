// ============================================================
// engine/game/story-helpers.test.ts — page-interaction / passive-picker
// ============================================================
import { describe, test, expect } from 'vitest';
import { isInteractivePage, rollClickWorkTotal, shouldEchoReply } from '../../../src/engine/game/page-interaction';
import { eligiblePassiveStories, pickPassiveStory } from '../../../src/engine/game/passive-picker';
import type { PassiveStoryEntry } from '../../../src/engine/types';

describe('page-interaction', () => {
  test('isInteractivePage：click / 选项 / sendText / clickWork 均为交互页', () => {
    expect(isInteractivePage({ text: 'x', kind: 'click' })).toBe(true);
    expect(isInteractivePage({ text: 'x', choices: [{ text: 'a', effects: [] }] })).toBe(true);
    expect(isInteractivePage({ text: 'x', sendText: '推进' })).toBe(true);
    expect(isInteractivePage({ text: 'x', clickWork: { base: 3 } })).toBe(true);
    // 纯展示页（无任何操作点）不视为交互页
    expect(isInteractivePage({ text: '旁白', kind: 'narration' })).toBe(false);
    expect(isInteractivePage({ text: '对话', speaker: '阿罗娜' })).toBe(false);
  });

  test('shouldEchoReply：非 click + 有 sendText + 未 muteReply 才回显', () => {
    expect(shouldEchoReply({ text: 'hi', sendText: '收到！' })).toBe(true);
    expect(shouldEchoReply({ text: 'ni', kind: 'narration', sendText: '（推进）' })).toBe(true);
    // click 恒不回显，即便有 sendText
    expect(shouldEchoReply({ text: 'x', kind: 'click', sendText: '推进' })).toBe(false);
    // muteReply 关闭回显
    expect(shouldEchoReply({ text: 'hi', sendText: '（静默）', muteReply: true })).toBe(false);
    // 无 sendText 无回显
    expect(shouldEchoReply({ text: 'hi' })).toBe(false);
    expect(shouldEchoReply({ text: 'hi', sendText: '   ' })).toBe(false);
  });

  test('rollClickWorkTotal：base 恒定，rand 落在 [0, rand) 内', () => {
    expect(rollClickWorkTotal(3)).toBe(3);
    for (let i = 0; i < 50; i++) {
      const total = rollClickWorkTotal(4, 2);
      expect(total).toBeGreaterThanOrEqual(4);
      expect(total).toBeLessThan(6);
    }
  });
});

describe('passive-picker', () => {
  const p = (id: string, weight: number): PassiveStoryEntry => ({
    id,
    storyId: id,
    type: 'passive',
    availableInits: [],
    triggerCondition: { type: 'AND', conditions: [] },
    repeatable: true,
    weight,
  });

  test('eligiblePassiveStories：按谓词过滤', () => {
    const all: PassiveStoryEntry[] = [p('a', 1), p('b', 0), p('c', 2)];
    const brushed = eligiblePassiveStories(all, (e) => e.weight > 0 && e.repeatable);
    expect(brushed.map(e => e.id).sort()).toEqual(['a', 'c']);
  });

  test('pickPassiveStory：空候选返回 undefined，单候选返回它', () => {
    expect(pickPassiveStory([])).toBeUndefined();
    expect(pickPassiveStory([p('solo', 1)])?.id).toBe('solo');
  });

  test('pickPassiveStory：按权重分布（random 定向桩）', () => {
    const candidates = [p('low', 10), p('high', 90)];
    // roll < 10 → low；否则 → high
    const original = Math.random;
    try {
      Math.random = () => 0.05;
      expect(pickPassiveStory(candidates)?.id).toBe('low');
      Math.random = () => 0.5;
      expect(pickPassiveStory(candidates)?.id).toBe('high');
    } finally {
      Math.random = original;
    }
  });
});