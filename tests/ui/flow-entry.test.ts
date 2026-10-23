// ============================================================
// tests/ui/flow-entry.test.ts — 共享呈现条目的投递策略
// 覆盖：默认追加 / 显式回收 / 跨流隔离 / 空 ID / 上限 / 序列化恢复 / Talklet 适配
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  FLOW_STREAM_MAX,
  applyFlowEntry,
  applyFlowEntryInPlace,
  assertFlowIdentity,
  chatEntryToFlowContent,
  chatEntryToFlowEntry,
  chatInstanceKey,
  createFlowStream,
  deliverFlowEntry,
  flowEntryFromTalklet,
  mapInstanceKey,
  type FlowEntry,
  type FlowIdentified,
  type FlowTalkletInput,
} from '../../src/ui/flow/flow-entry';
import type { ChatEntry } from '../../src/ui/components/story/story';

function entry(overrides: Partial<FlowEntry> & Pick<FlowEntry, 'instanceKey'>): FlowEntry {
  return {
    streamKey: 'chat:global',
    kind: 'talk',
    text: overrides.instanceKey,
    ...overrides,
  };
}

function listed(entries: readonly FlowIdentified[]): string[] {
  return entries.map(item => (item as FlowEntry).instanceKey);
}

describe('FlowEntry 投递策略', () => {
  it('缺省追加允许同逻辑 ID 的合法重复', () => {
    const first = entry({ instanceKey: 'a', contentId: 'slot' });
    const second = entry({ instanceKey: 'b', contentId: 'slot' });
    const result = applyFlowEntry([first], second);
    expect(listed(result)).toEqual(['a', 'b']);
    expect(result[1].repeatPolicy).toBeUndefined();
  });

  it('replaceSameId 清理同流全部同 ID 旧实例并尾插', () => {
    const stream = [
      entry({ instanceKey: 'a', contentId: 'slot' }),
      entry({ instanceKey: 'b' }),
      entry({ instanceKey: 'c', contentId: 'slot' }),
    ];
    const result = applyFlowEntry(stream, entry({
      instanceKey: 'd', contentId: 'slot', repeatPolicy: 'replaceSameId',
    }));
    expect(listed(result)).toEqual(['b', 'd']);
    expect(stream.map(item => item.instanceKey)).toEqual(['a', 'b', 'c']);
  });

  it('缺省 append 的旧条目即使同 ID 也一并回收', () => {
    const appended = entry({ instanceKey: 'old', contentId: 'slot' });
    const result = applyFlowEntry([appended], entry({
      instanceKey: 'next', contentId: 'slot', repeatPolicy: 'replaceSameId',
    }));
    expect(listed(result)).toEqual(['next']);
  });

  it('就地版本保持数组 identity 且结果一致', () => {
    const stream = [entry({ instanceKey: 'a', contentId: 'slot' })];
    const returned = applyFlowEntryInPlace(stream, entry({
      instanceKey: 'b', contentId: 'slot', repeatPolicy: 'replaceSameId',
    }));
    expect(returned).toBe(stream);
    expect(listed(stream)).toEqual(['b']);
  });

  it('不同流的同 ID 条目互不影响', () => {
    const left = deliverFlowEntry(createFlowStream('run:1'), entry({
      streamKey: 'run:1', instanceKey: mapInstanceKey('current-note', '1'), contentId: 'sample:current-note',
    }));
    const right = deliverFlowEntry(createFlowStream('run:2'), entry({
      streamKey: 'run:2', instanceKey: mapInstanceKey('current-note', '1'), contentId: 'sample:current-note',
    }));
    deliverFlowEntry(left, entry({
      streamKey: 'run:1', instanceKey: mapInstanceKey('current-note', '2'), contentId: 'sample:current-note', repeatPolicy: 'replaceSameId',
    }));
    expect(left.entries).toHaveLength(1);
    expect(right.entries).toHaveLength(1);
    expect(left.entries[0].instanceKey).toBe(mapInstanceKey('current-note', '2'));
    expect(right.entries[0].instanceKey).toBe(mapInstanceKey('current-note', '1'));
  });

  it('向其他流投递被拒绝', () => {
    const stream = createFlowStream('run:1');
    expect(() => deliverFlowEntry(stream, entry({ streamKey: 'run:2', instanceKey: 'x' })))
      .toThrow(/streamKey/);
    expect(stream.entries).toHaveLength(0);
  });

  it('replaceSameId 缺少或只有空白 ID 时拒绝写入', () => {
    const stream = createFlowStream('run:1');
    for (const contentId of [undefined, '', '   ']) {
      expect(() => deliverFlowEntry(stream, entry({
        streamKey: 'run:1', instanceKey: 'x', ...(contentId === undefined ? {} : { contentId }), repeatPolicy: 'replaceSameId',
      }))).toThrow(/contentId/);
    }
    expect(stream.entries).toHaveLength(0);
  });

  it('不支持的 repeatPolicy 被拒绝', () => {
    expect(() => assertFlowIdentity({ repeatPolicy: 'prepend' as never })).toThrow(/repeatPolicy/);
  });

  it('上限裁剪保留末尾条目，回收先于裁剪', () => {
    const stream: FlowEntry[] = [];
    for (let index = 0; index < FLOW_STREAM_MAX; index += 1) {
      applyFlowEntryInPlace(stream, entry({ instanceKey: `n${index}` }));
    }
    expect(stream).toHaveLength(FLOW_STREAM_MAX);
    applyFlowEntryInPlace(stream, entry({
      instanceKey: 'slot', contentId: 'slot', repeatPolicy: 'replaceSameId',
    }));
    expect(stream).toHaveLength(FLOW_STREAM_MAX);
    expect(stream[stream.length - 1].instanceKey).toBe('slot');
    expect(stream.some(item => item.instanceKey === 'n0')).toBe(false);
  });

  it('序列化往返后再次投递仍遵守显式策略', () => {
    const delivered = applyFlowEntry([], entry({
      instanceKey: 'a', contentId: 'slot', repeatPolicy: 'replaceSameId',
    }));
    const restored = JSON.parse(JSON.stringify(delivered)) as FlowEntry[];
    expect(restored).toHaveLength(1);
    const next = applyFlowEntry(restored, entry({
      instanceKey: 'b', contentId: 'slot', repeatPolicy: 'replaceSameId',
    }));
    expect(listed(next)).toEqual(['b']);
  });
});

describe('Talklet 形态输入', () => {
  it('匿名 Talklet 默认追加并保留重复文本', () => {
    const talklet: FlowTalkletInput = { speaker: '阿罗娜', text: '重复文本' };
    const first = flowEntryFromTalklet({ streamKey: '#global', instanceKey: 'k1', talklet });
    const second = flowEntryFromTalklet({ streamKey: '#global', instanceKey: 'k2', talklet });
    expect(first).not.toBeNull();
    expect(first!.contentId).toBeUndefined();
    expect(first!.repeatPolicy).toBeUndefined();
    expect(applyFlowEntry([first!], second!)).toHaveLength(2);
  });

  it('显式逻辑 ID 与策略原样透传，并映射呈现字段', () => {
    const talklet: FlowTalkletInput = {
      id: 'sample:field-note',
      repeatPolicy: 'replaceSameId',
      kind: 'narration',
      speaker: '情报',
      text: '机器人 3 / 6 HP',
      align: 'left',
      avatar: 'mod:image(pic):enemy',
      image: 'mod:image(pic):enemy-portrait',
      side: 'right',
      noAvatar: true,
      showAvatar: true,
    };
    const result = flowEntryFromTalklet({
      streamKey: 'run:1',
      instanceKey: mapInstanceKey('field-note', 'unit-a'),
      talklet,
      lifecycle: 'current',
      source: { kind: 'sample.note', id: 'unit-a' },
    });
    expect(result).toMatchObject({
      streamKey: 'run:1',
      instanceKey: 'map:field-note:unit-a',
      contentId: 'sample:field-note',
      repeatPolicy: 'replaceSameId',
      kind: 'narration',
      speaker: '情报',
      text: '机器人 3 / 6 HP',
      align: 'left',
      avatar: 'mod:image(pic):enemy',
      image: 'mod:image(pic):enemy-portrait',
      side: 'right',
      noAvatar: true,
      showAvatar: true,
      lifecycle: 'current',
      source: { kind: 'sample.note', id: 'unit-a' },
    });
    expect(applyFlowEntry(
      [flowEntryFromTalklet({ streamKey: 'run:1', instanceKey: 'old', talklet: { text: '旧记录', id: 'sample:field-note' } })!],
      result!,
    ).map(item => item.instanceKey)).toEqual(['map:field-note:unit-a']);
  });

  it('带 ID 的 Talklet 缺少 ID 时不能使用 replaceSameId', () => {
    expect(() => flowEntryFromTalklet({
      streamKey: 'run:1', instanceKey: 'x', talklet: { text: '情报', repeatPolicy: 'replaceSameId' },
    })).toThrow(/contentId/);
  });

  it('click 页不进入信息流', () => {
    expect(flowEntryFromTalklet({
      streamKey: '#global', instanceKey: 'click', talklet: { kind: 'click', text: '点击' },
    })).toBeNull();
  });
});

describe('普通 Chat 条目适配', () => {
  const chatEntry: ChatEntry = {
    id: 7,
    kind: 'talk',
    speaker: '阿罗娜',
    text: '前辈，早上好。',
    isPlayer: false,
    side: 'left',
    avatar: 'mod:image(pic):arona',
    image: 'mod:image(pic):banner',
    noAvatar: false,
    showAvatar: true,
    align: 'center',
    storyPageKey: '["entry","story",0]',
    timestamp: 1,
  };

  it('实例键映射数字 ID，逻辑身份留空因此永不回收', () => {
    const flow = chatEntryToFlowEntry('#global', chatEntry);
    expect(flow.instanceKey).toBe(chatInstanceKey(7));
    expect(flow.contentId).toBeUndefined();
    expect(flow.repeatPolicy).toBeUndefined();
    expect(flow.lifecycle).toBe('observed');
    const same = chatEntryToFlowEntry('#global', { ...chatEntry, id: 8 });
    expect(applyFlowEntry([flow], same)).toHaveLength(2);
  });

  it('呈现字段完整映射且不含剧情同步指纹', () => {
    const content = chatEntryToFlowContent(chatEntry);
    expect(content).toEqual({
      kind: 'talk',
      speaker: '阿罗娜',
      text: '前辈，早上好。',
      isPlayer: false,
      align: 'center',
      avatar: 'mod:image(pic):arona',
      image: 'mod:image(pic):banner',
      side: 'left',
      noAvatar: false,
      showAvatar: true,
    });
    expect('storyPageKey' in content).toBe(false);
  });
});
