// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { renderChatEntry } from '../../src/ui/components/story';
import type { FlowContent } from '../../src/ui/flow/flow-entry';
import type { UIContext } from '../../src/ui/context';

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const context = { escapeHtml, formatNumber: String } as unknown as UIContext;

describe('Flow Map location card rendering', () => {
  test('renders fixed-size location cards on the Talklet host with typed identities', () => {
    const entry: FlowContent = {
      kind: 'talk',
      noAvatar: true,
      text: '选择目的地点',
      mapLocations: {
        runId: 'run-1',
        mapId: 'map-1',
        fromNodeId: 'node-a',
        hostLayout: { alignment: 'right', gapPx: 14 },
        locations: [
          {
            instanceKey: 'flow:run-1::entry:node-b::object-b',
            objectKey: 'object-b',
            ref: { kind: 'mapNode', runId: 'run-1', mapId: 'map-1', nodeId: 'node-b' },
            title: '地点 B <出口>',
            description: '可前往',
            stateLabel: '未到达',
            selectable: true,
          },
          {
            instanceKey: 'flow:run-1::entry:node-c::object-c',
            objectKey: 'object-c',
            ref: { kind: 'mapNode', runId: 'run-1', mapId: 'map-1', nodeId: 'node-c' },
            title: '地点 C',
            stateLabel: '未到达 · 需要钥匙 ≥ 2（未满足）',
            selectable: false,
            unavailableReason: '需要钥匙 ≥ 2',
          },
        ],
      },
    };
    const html = renderChatEntry(context, entry, { instanceKey: 'move-entry' });
    const root = document.createElement('div');
    root.innerHTML = html;
    const talklet = root.querySelector<HTMLElement>('.chat-talk[data-flow-entry-key="move-entry"]')!;
    const section = root.querySelector<HTMLElement>('[data-map-location-choices]')!;
    const cards = [...section.querySelectorAll<HTMLElement>('[data-map-instance-key]')];

    expect(talklet.querySelector('.chat-bubble')?.contains(section)).toBe(true);
    expect(section.dataset.mapRunId).toBe('run-1');
    expect(section.dataset.mapMapId).toBe('map-1');
    expect(section.dataset.mapFromNode).toBe('node-a');
    expect(section.dataset.mapCardHostAlign).toBe('right');
    expect(section.dataset.mapCardHostGap).toBe('14');
    expect(cards[0].dataset.mapObjectKey).toBe('object-b');
    expect(cards[0].dataset.mapInstanceKey).toBe('flow:run-1::entry:node-b::object-b');
    expect(cards[0].dataset.mapCardEntry).toBe('selectLocation');
    expect(cards[0].getAttribute('role')).toBe('button');
    expect(cards[0].dataset.mapLocationNodeId).toBe('node-b');
    expect(cards[1].dataset.mapCardEntry).toBeUndefined();
    expect(cards[1].getAttribute('aria-disabled')).toBe('true');
    expect(section.textContent).toContain('需要钥匙 ≥ 2');
    expect(cards[0].getAttribute('style')).toContain('--map-card-angle:');
    expect(root.querySelector('[data-map-move-to]')).toBeNull();
    expect(root.querySelector('[data-map-location-submit]')).toBeNull();
    expect(root.textContent).toContain('地点 B <出口>');
  });

  test('ordinary Flow entries do not acquire location choice controls', () => {
    const html = renderChatEntry(context, { kind: 'system', text: '普通条目' });
    expect(html).not.toContain('data-map-location-choices');
    expect(html).not.toContain('data-map-location-choices');
  });
});
