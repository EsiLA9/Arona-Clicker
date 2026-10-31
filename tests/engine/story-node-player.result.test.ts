import { describe, expect, it, vi } from 'vitest';
import { StoryNodePlayer } from '../../src/arona-clicker/services/story/story-node-player';
import type { StoryNodeActionOutcome, StoryNodePlaybackHost, StoryNodePlaybackView } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryNodeDocument } from '../../src/data-services/contracts/story-node';
import type { EffectReceipt } from '../../src/engine/contracts/effect-receipt';
import type { StoryNodeSnapshot } from '../../src/engine/contracts/story-node-snapshot';

const receipt: EffectReceipt = { effectIndex: 0, op: 'addResource', target: 'credit', status: 'changed', before: 1, after: 3, delta: 2 };
const source = { entryId: 'entry:root', owner: null, historyId: 'history:root' };
const root: StoryNodeDocument = { id: 'story:root', name: 'Root', stages: { unused: { advance: 'auto' } }, nodes: [
  { id: 'click', type: 'click', stageId: 'unused', interaction: { kind: 'button', text: 'Go', result: {
    actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] }],
    transfer: { mode: 'insert', storyId: 'story:child' },
  } } },
  { id: 'tail', type: 'talklet', stageId: 'unused', content: { kind: 'talk', text: 'Tail' } },
] };
const child: StoryNodeDocument = { id: 'story:child', name: 'Child', stages: { unused: { advance: 'auto' } }, nodes: [
  { id: 'body', type: 'talklet', stageId: 'unused', content: { kind: 'talk', text: 'Child' } },
] };
const token = (view: StoryNodePlaybackView): string => {
  if (!('token' in view)) throw new Error(`Missing token: ${view.status}`);
  return view.token;
};
function fixture(documents = [root, child], outcome: StoryNodeActionOutcome = { status: 'applied', receipts: [receipt] }) {
  const execute = vi.fn<StoryNodePlaybackHost['execute']>(() => structuredClone(outcome));
  const preflightTransfer = vi.fn<NonNullable<StoryNodePlaybackHost['preflightTransfer']>>(() => undefined);
  const host: StoryNodePlaybackHost = { execute, preflightTransfer, preflight: () => undefined, evaluate: () => true, random: () => 0 };
  return { player: new StoryNodePlayer(new Map(documents.map(document => [document.id, document])), host), execute, preflightTransfer };
}

describe('StoryNodePlayer committed result barriers', () => {
  it('defers an accepted insert until result acknowledgment and never rechecks its dynamic guard', () => {
    const f = fixture();
    const input = f.player.start(root.id, source).view;
    const result = f.player.submit(token(input)).view;
    expect(result).toMatchObject({ status: 'result', storyId: root.id, node: { id: 'click' }, data: { receipts: [receipt], presentation: [] } });
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(f.preflightTransfer).toHaveBeenCalledTimes(1);
    expect(f.player.submit(token(input))).toMatchObject({ ok: false, error: 'StaleToken' });
    f.preflightTransfer.mockReturnValue('NoLongerAvailable');
    const entered = f.player.ackDelivery(token(result));
    expect(entered.view).toMatchObject({ status: 'delivery', storyId: child.id });
    expect(f.preflightTransfer).toHaveBeenCalledTimes(1);
    const returned = f.player.ackDelivery(token(entered.view));
    expect(returned.view).toMatchObject({ status: 'delivery', storyId: root.id, node: { id: 'tail' } });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('restores an immutable result and continuation without replaying actions or transfer admission', () => {
    const f = fixture();
    const input = f.player.start(root.id, source).view;
    const result = f.player.submit(token(input)).view;
    const snapshot = JSON.parse(JSON.stringify(f.player.save()));
    expect(snapshot).toMatchObject({ format: 'story-nodes-v2', run: { nodeId: 'click', pending: { kind: 'result', continuation: { transfer: { mode: 'insert', storyId: child.id } } } } });
    const next = fixture();
    next.preflightTransfer.mockReturnValue('ChangedAfterSave');
    next.player.restore(snapshot);
    expect(next.player.getView()).toMatchObject({ status: 'result', data: { receipts: [receipt] } });
    expect(next.player.ackDelivery(token(result))).toMatchObject({ ok: false, error: 'StaleToken' });
    expect(next.player.ackDelivery(token(next.player.getView())).view).toMatchObject({ status: 'delivery', storyId: child.id });
    expect(next.execute).not.toHaveBeenCalled();
    expect(next.preflightTransfer).not.toHaveBeenCalled();
  });

  it('waits for presentation-only results and isolates returned data', () => {
    const f = fixture([root, child], { status: 'applied', presentation: [{ op: 'showOpeningTitle', target: '', value: 'Title' }] });
    const input = f.player.start(root.id, source).view;
    const result = f.player.submit(token(input)).view;
    if (result.status !== 'result') throw new Error('Expected result');
    (result.data.presentation[0] as { value: string }).value = 'Mutated';
    expect(f.player.getView()).toMatchObject({ data: { presentation: [{ value: 'Title' }] } });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('continues pure local actions immediately without inventing a result barrier', () => {
    const document: StoryNodeDocument = { ...root, nodes: [
      { id: 'click', type: 'click', stageId: 'unused', interaction: { kind: 'button', text: 'Go', result: {
        actions: [{ kind: 'localFlag', op: 'set', name: 'ready', value: false }],
      } } },
      { id: 'tail', type: 'talklet', stageId: 'unused', requiresFlag: 'ready', content: { kind: 'talk', text: 'Tail' } },
    ] };
    const f = fixture([document]);
    const input = f.player.start(root.id, source).view;
    expect(f.player.submit(token(input)).view).toMatchObject({ status: 'delivery', node: { id: 'tail' } });
    expect(f.execute).not.toHaveBeenCalled();
  });

  it('restores an applied Operation and its data without re-executing it', () => {
    const document: StoryNodeDocument = { ...root, nodes: [{ id: 'operation', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] } }] };
    const f = fixture([document]);
    const operation = f.player.start(root.id, source).view;
    expect(operation).toMatchObject({ status: 'operation', data: { receipts: [receipt] } });
    const next = fixture([document]);
    next.player.restore(JSON.parse(JSON.stringify(f.player.save())));
    expect(next.player.getView()).toMatchObject({ status: 'operation', data: { receipts: [receipt] } });
    expect(next.player.ackDelivery(token(next.player.getView())).view.status).toBe('completed');
    expect(next.execute).not.toHaveBeenCalled();
  });

  it('keeps empty Operations at one checkpoint and executes the next only after acknowledgment', () => {
    const document: StoryNodeDocument = { ...root, nodes: [
      { id: 'one', type: 'operation', action: { kind: 'travel', areaId: 'area:one' } },
      { id: 'two', type: 'operation', action: { kind: 'travel', areaId: 'area:two' } },
    ] };
    const f = fixture([document], { status: 'applied' });
    const first = f.player.start(root.id, source).view;
    expect(first).toMatchObject({ status: 'operation', node: { id: 'one' }, data: { receipts: [], presentation: [], order: [] } });
    expect(f.execute).toHaveBeenCalledTimes(1);
    const second = f.player.ackDelivery(token(first)).view;
    expect(second).toMatchObject({ status: 'operation', node: { id: 'two' } });
    expect(f.execute).toHaveBeenCalledTimes(2);
    expect(f.player.ackDelivery(token(second)).view.status).toBe('completed');
  });

  it('retains both the prior prefix and a rejected action’s committed receipt in a failed view', () => {
    const document: StoryNodeDocument = { ...root, nodes: [{ id: 'click', type: 'click', stageId: 'unused', interaction: { kind: 'button', text: 'Go', result: { actions: [
      { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] },
      { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] },
    ] } } }] };
    const f = fixture([document]);
    f.execute.mockReturnValueOnce({ status: 'applied', receipts: [receipt] }).mockReturnValueOnce({ status: 'rejected', error: 'ObserverFailed', receipts: [{ ...receipt, before: 3, after: 5 }] });
    const input = f.player.start(root.id, source).view;
    expect(f.player.submit(token(input))).toMatchObject({ ok: false, view: { status: 'failed', error: 'ObserverFailed', data: { receipts: [receipt, { ...receipt, before: 3, after: 5 }] } } });
    expect(f.player.submit(token(input)).ok).toBe(false);
    expect(f.execute).toHaveBeenCalledTimes(2);
  });

  it('keeps receipt and presentation order across a mixed action batch', () => {
    const document: StoryNodeDocument = { ...root, nodes: [{ id: 'click', type: 'click', stageId: 'unused', interaction: { kind: 'button', text: 'Go', result: { actions: [
      { kind: 'presentation', command: { command: 'openingTitle', title: 'Start' } },
      { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] },
      { kind: 'overlay', command: { command: 'clearAllTexts' } },
    ] } } }] };
    const f = fixture([document]);
    f.execute.mockReturnValueOnce({ status: 'applied', presentation: [{ op: 'showOpeningTitle', target: '', value: 'Start' }] })
      .mockReturnValueOnce({ status: 'applied', receipts: [receipt] })
      .mockReturnValueOnce({ status: 'applied', presentation: [{ op: 'clearAllChatText', target: '', value: 0 }] });
    const input = f.player.start(root.id, source).view;
    const result = f.player.submit(token(input)).view;
    expect(result).toMatchObject({ status: 'result', data: { order: [
      { kind: 'presentation', index: 0 }, { kind: 'receipt', index: 0 }, { kind: 'presentation', index: 1 },
    ] } });
    const restored = fixture([document]);
    restored.player.restore(JSON.parse(JSON.stringify(f.player.save())));
    expect(restored.player.getView()).toMatchObject({ status: 'result', data: result.status === 'result' ? result.data : {} });
    expect(restored.player.ackDelivery(token(restored.player.getView())).view.status).toBe('completed');
    expect(restored.execute).not.toHaveBeenCalled();
  });

  it('preserves an already committed receipt when a synchronous host notification throws', () => {
    const f = fixture();
    f.execute.mockImplementation(() => { throw Object.assign(new Error('ObserverFailed'), { receipts: [receipt] }); });
    const input = f.player.start(root.id, source).view;
    expect(f.player.submit(token(input))).toMatchObject({ ok: false, view: { status: 'failed', data: { receipts: [receipt], order: [{ kind: 'receipt', index: 0 }] } } });
  });

  it('rejects inconsistent result snapshots before replacing a live wait and rejects old idle snapshots', () => {
    const f = fixture();
    const input = f.player.start(root.id, source).view;
    f.player.submit(token(input));
    const snapshot = f.player.save();
    const before = f.player.getView();
    for (const pending of [
      { kind: 'result', data: { receipts: [], presentation: [] }, continuation: {} },
      { kind: 'result', data: { receipts: [receipt], presentation: [] }, continuation: { transfer: { mode: 'goto', storyId: 'missing' } } },
      { kind: 'operation', data: { receipts: [receipt], presentation: [] } },
      { kind: 'result', data: { receipts: [{ ...receipt, delta: NaN }], presentation: [] }, continuation: {} },
      { kind: 'result', data: { receipts: [receipt], presentation: [], order: [{ kind: 'receipt', index: 0 }] }, continuation: {} },
    ]) {
      expect(() => f.player.restore({ ...snapshot, run: { ...snapshot.run!, pending } } as StoryNodeSnapshot)).toThrow();
      expect(f.player.getView()).toEqual(before);
    }
    expect(() => f.player.restore({ format: 'story-nodes', run: null } as unknown as StoryNodeSnapshot)).toThrow('InvalidSnapshot');
    expect(f.player.getView()).toEqual(before);
  });

  it('requires the saved presentation order to reference every item exactly once', () => {
    const f = fixture();
    const input = f.player.start(root.id, source).view;
    f.player.submit(token(input));
    const before = f.player.getView();
    for (const order of [[], [{ kind: 'receipt', index: 1 }], [{ kind: 'presentation', index: 0 }], [{ kind: 'receipt', index: 0 }, { kind: 'receipt', index: 0 }]]) {
      const snapshot = f.player.save();
      if (snapshot.run?.pending.kind !== 'result') throw new Error('Expected saved result');
      const bad = { ...snapshot, run: { ...snapshot.run, pending: { ...snapshot.run.pending, data: { ...snapshot.run.pending.data, order } } } };
      expect(() => f.player.restore(bad as StoryNodeSnapshot)).toThrow('InvalidSnapshot');
      expect(f.player.getView()).toEqual(before);
    }
  });
});
