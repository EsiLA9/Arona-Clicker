import { describe, expect, it } from 'vitest';
import type { StoryNodeDocument, StoryTalkletNode } from '../../src/data-services/contracts/story-node';
import type { StoryAction } from '../../src/data-services/contracts/story-node-actions';
import type { StoryNodePlaybackHost, StoryNodePlaybackView, StoryNodeDocuments } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import { StoryNodePlayer } from '../../src/arona-clicker/services/story/story-node-player';

const ROOT = 'test:story:boundary-root';
const source = { entryId: 'test:activestory:boundary', owner: null } as const;
const talk = (id: string, stageId: string, text = id): StoryTalkletNode => ({ id, type: 'talklet', stageId, content: { kind: 'talk', text } });
const documentOf = (id: string, nodes: StoryNodeDocument['nodes'], stages: StoryNodeDocument['stages'] = {}): StoryNodeDocument => ({ id, name: id, nodes, stages });
const documents = (...items: StoryNodeDocument[]): StoryNodeDocuments => new Map(items.map(item => [item.id, item]));
const credit = (amount = 1): StoryAction => ({ kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount }] });

interface State { credit: number; applied: StoryAction[]; preflighted: StoryAction[] }
function makeHost(options: { rejectPreflight?: (action: StoryAction) => boolean; afterExecute?: () => void } = {}): { host: StoryNodePlaybackHost; state: State } {
  const state: State = { credit: 0, applied: [], preflighted: [] };
  const host: StoryNodePlaybackHost = {
    evaluate: () => true,
    random: () => 0,
    preflight: action => { state.preflighted.push(action); return options.rejectPreflight?.(action) ? 'preflight rejected' : undefined; },
    execute: action => {
      state.applied.push(action);
      if (action.kind === 'state') for (const effect of action.effects) {
        if (effect.op === 'addResource' && effect.resourceId === 'credit') state.credit += Number(effect.amount);
      }
      options.afterExecute?.();
      return { status: 'applied' };
    },
  };
  return { host, state };
}
const delivery = (view: StoryNodePlaybackView) => {
  if (view.status !== 'delivery') throw new Error(`expected delivery, got ${view.status}`);
  return view;
};
const input = (view: StoryNodePlaybackView) => {
  if (view.status !== 'input') throw new Error(`expected input, got ${view.status}`);
  return view;
};

function transferChain(count: number): StoryNodeDocuments {
  const items: StoryNodeDocument[] = [];
  for (let index = 0; index <= count; index += 1) {
    const id = `test:story:transfer-${index}`;
    const nextId = `test:story:transfer-${index + 1}`;
    items.push(documentOf(id, index < count
      ? [{ id: 'jump', type: 'transfer', transfer: { mode: 'goto', storyId: nextId } }]
      : [talk('end', 'body')], index < count ? {} : { body: { advance: 'auto' } }));
  }
  return new Map(items.map(item => [item.id, item]));
}

describe('StoryNodePlayer boundary regressions', () => {
  it('delivers every Talklet in one input stage before its final Click', () => {
    const root = documentOf(ROOT, [talk('first', 'phase'), talk('second', 'phase'), {
      id: 'continue', type: 'click', stageId: 'phase', interaction: { kind: 'button', text: '继续' },
    }], { phase: { advance: 'input' } });
    const player = new StoryNodePlayer(documents(root), makeHost().host);
    const first = delivery(player.start(ROOT, source).view);
    const second = delivery(player.ackDelivery(first.token).view);
    expect(second.node.id).toBe('second');
    const click = input(player.ackDelivery(second.token).view);
    expect(click.node.id).toBe('continue');
  });

  it('keeps the same input ticket when action preflight rejects before reply or effects', () => {
    const root = documentOf(ROOT, [{ id: 'choose', type: 'click', stageId: 'pick', interaction: { kind: 'choice', options: [{
      id: 'go', text: '开始', reply: { kind: 'talk', text: '已经开始' }, result: { actions: [credit(3)] },
    }] } }], { pick: { advance: 'input' } });
    const { host, state } = makeHost({ rejectPreflight: action => action.kind === 'state' });
    const player = new StoryNodePlayer(documents(root), host);
    const waiting = input(player.start(ROOT, source).view);
    const rejected = player.submit(waiting.token, 'go');
    expect(rejected).toMatchObject({ ok: false, error: 'preflight rejected', view: { status: 'input', token: waiting.token } });
    expect(rejected.events.some(event => event.type === 'reply')).toBe(false);
    expect(state.credit).toBe(0);
    expect(state.applied).toHaveLength(0);
    expect(state.preflighted).toHaveLength(1);
  });

  it('accepts exactly 32 control transfers and stops before the 33rd', () => {
    const atLimit = new StoryNodePlayer(transferChain(32), makeHost().host).start('test:story:transfer-0', source);
    expect(delivery(atLimit.view).storyId).toBe('test:story:transfer-32');
    const overLimit = new StoryNodePlayer(transferChain(33), makeHost().host).start('test:story:transfer-0', source);
    expect(overLimit).toMatchObject({ ok: false, error: 'TransferLimitExceeded', view: { status: 'failed', error: 'TransferLimitExceeded' } });
  });

  it('allows 256 automatic nodes and fails at 257 without replaying prior effects', () => {
    const operations = (count: number) => documentOf(ROOT, Array.from({ length: count }, (_, index) => ({
      id: `operation-${index}`, type: 'operation' as const, action: credit(),
    })));
    const exactState = makeHost();
    const exact = new StoryNodePlayer(documents(operations(256)), exactState.host).start(ROOT, source);
    expect(exact).toMatchObject({ ok: true, view: { status: 'completed' } });
    expect(exactState.state.credit).toBe(256);
    const overState = makeHost();
    const over = new StoryNodePlayer(documents(operations(257)), overState.host).start(ROOT, source);
    expect(over).toMatchObject({ ok: false, error: 'AutoStepLimitExceeded', view: { status: 'failed', error: 'AutoStepLimitExceeded' } });
    expect(overState.state.credit).toBe(256);
    expect(overState.state.applied).toHaveLength(256);
  });

  it('preserves root identity when an insert at the chain tail ends in another story', () => {
    const insertedId = 'test:story:inserted-tail';
    const root = documentOf(ROOT, [{ id: 'insert', type: 'click', stageId: 'entry', interaction: { kind: 'choice', options: [{
      id: 'go', text: '进入', result: { transfer: { mode: 'insert', storyId: insertedId } },
    }] } }], { entry: { advance: 'input' } });
    const inserted = documentOf(insertedId, [talk('last-line', 'body')], { body: { advance: 'auto' } });
    const player = new StoryNodePlayer(documents(root, inserted), makeHost().host);
    const choice = input(player.start(ROOT, source).view);
    const line = delivery(player.submit(choice.token, 'go').view);
    const completed = player.ackDelivery(line.token).view;
    expect(completed).toMatchObject({ status: 'completed', completion: {
      entryId: source.entryId, rootStoryId: ROOT, owner: null, terminalStoryId: insertedId,
    } });
  });

  it('isolates both source documents and returned views', () => {
    const root = documentOf(ROOT, [talk('line', 'body', 'original')], { body: { advance: 'auto' } });
    const player = new StoryNodePlayer(documents(root), makeHost().host);
    (root.nodes[0] as unknown as { content: { text: string } }).content.text = 'mutated source';
    const first = delivery(player.start(ROOT, source).view);
    expect(first.node.content.text).toBe('original');
    (player.getView() as unknown as { node: { content: { text: string } } }).node.content.text = 'mutated view';
    expect(delivery(player.getView()).node.content.text).toBe('original');
  });

  it('returns a false Cancelled receipt when a start-time Operation synchronously cancels', () => {
    let player!: StoryNodePlayer;
    const { host, state } = makeHost({ afterExecute: () => player.cancel() });
    const root = documentOf(ROOT, [
      { id: 'first', type: 'operation', action: credit() },
      { id: 'second', type: 'operation', action: credit() },
    ]);
    player = new StoryNodePlayer(documents(root), host);
    const result = player.start(ROOT, source);
    expect(result).toMatchObject({ ok: false, error: 'Cancelled', view: { status: 'idle' } });
    expect(state.credit).toBe(1);
    expect(state.applied).toHaveLength(1);
  });

  it('returns a false Cancelled receipt when ack auto-advances into a cancelling Operation', () => {
    let player!: StoryNodePlayer;
    const { host, state } = makeHost({ afterExecute: () => player.cancel() });
    const root = documentOf(ROOT, [
      talk('start-line', 'opening'),
      { id: 'first', type: 'operation', action: credit() },
      { id: 'second', type: 'operation', action: credit() },
    ], { opening: { advance: 'auto' } });
    player = new StoryNodePlayer(documents(root), host);
    const line = delivery(player.start(ROOT, source).view);
    const result = player.ackDelivery(line.token);
    expect(result).toMatchObject({ ok: false, error: 'Cancelled', view: { status: 'idle' } });
    expect(state.credit).toBe(1);
    expect(state.applied).toHaveLength(1);
  });
});
