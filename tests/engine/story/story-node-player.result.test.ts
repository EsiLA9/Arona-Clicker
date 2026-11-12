import { describe, expect, it, vi } from 'vitest';
import { StoryNodePlayer } from '../../../src/arona-clicker/services/story/story-node-player';
import type { StoryNodeActionOutcome, StoryNodePlaybackHost, StoryNodePlaybackView } from '../../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryNodeDocument } from '../../../src/data-services/contracts/story-node';
import type { EffectReceipt } from '../../../src/engine/contracts/effect-receipt';
import type { StoryNodeSnapshot } from '../../../src/engine/contracts/story-node-snapshot';

const receipt: EffectReceipt = { effectIndex: 0, op: 'addResource', target: 'credit', status: 'changed', before: 1, after: 3, delta: 2 };
const source = { entryId: 'entry:root', owner: null, historyId: 'history:root' };
const root: StoryNodeDocument = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'story:root', name: 'Root', stages: { unused: { advance: 'auto' } }, nodes: [
  { id: 'click', type: 'click', stageId: 'unused', interaction: { kind: 'button', text: 'Go', press: { base: 2 } } },
  { id: 'tail', type: 'talklet', stageId: 'unused', content: { kind: 'talk', text: 'Tail' } },
] };
const child: StoryNodeDocument = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'story:child', name: 'Child', stages: { unused: { advance: 'auto' } }, nodes: [
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

describe('StoryNodePlayer independent action checkpoints', () => {

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

  it('only reaches a following Operation when the final press succeeds', () => {
    const document: StoryNodeDocument = { ...root, nodes: [root.nodes[0],
      { id: 'reward', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] } }, root.nodes[1],
    ] };
    const f = fixture([document]);
    const input = f.player.start(document.id, source).view;
    const partial = f.player.submit(token(input)).view;
    expect(partial.status).toBe('input'); expect(f.execute).not.toHaveBeenCalled();
    const operation = f.player.submit(token(partial)).view;
    expect(operation).toMatchObject({ status: 'operation', node: { id: 'reward' } });
    expect(f.player.ackDelivery(token(operation)).view).toMatchObject({ status: 'delivery', node: { id: 'tail' } });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });
  it('rejects retired Button result payloads rather than silently ignoring actions', () => {
    const document = structuredClone(root);
    Object.assign((document.nodes[0] as { interaction: object }).interaction, { result: { actions: [{ kind: 'localFlag', op: 'set', name: 'old', value: true }] } });
    const f = fixture([document]);
    expect(f.player.start(document.id, source).ok).toBe(false);
    expect(f.execute).not.toHaveBeenCalled();
  });
  it('preserves the dedicated Entry card request and restores its presentation without replay', () => {
    const document: StoryNodeDocument = { ...root, nodes: [{ id: 'card', type: 'click', stageId: 'unused', interaction: { kind: 'entryCard', card: {
      request: { entryId: 'entry:child', entryType: 'active', owner: null, intent: 'card' },
    } } }] };
    const f = fixture([document]);
    const result = f.player.submit(token(f.player.start(document.id, source).view)).view;
    expect(result.status).toBe('result');
    const next = fixture([document]); next.player.restore(JSON.parse(JSON.stringify(f.player.save())));
    expect(next.player.getView()).toMatchObject({ status: 'result', data: { receipts: [receipt] } });
    expect(next.player.ackDelivery(token(next.player.getView())).view.status).toBe('completed');
    expect(next.execute).not.toHaveBeenCalled();
  });
  it('rejects retired Button result snapshots without replacing the current run', () => {
    const f = fixture(); f.player.start(root.id, source);
    const snapshot = f.player.save(), before = f.player.getView();
    expect(() => f.player.restore({ ...snapshot, run: { ...snapshot.run!, pending: { kind: 'result', data: { receipts: [receipt], presentation: [], order: [{ kind: 'receipt', index: 0 }] }, continuation: {} } } } as unknown as StoryNodeSnapshot)).toThrow('InvalidSnapshot');
    expect(f.player.getView()).toEqual(before);
  });
  it('requires each saved Operation receipt and presentation item to appear exactly once in order', () => {
    const document: StoryNodeDocument = {...root,nodes:[{id:'reward',type:'operation',action:{kind:'state',effects:[]}}]};
    const f=fixture([document],{status:'applied',receipts:[receipt],presentation:[{op:'clearAllChatText',target:'',value:0}]});
    f.player.start(document.id,source);
    const snapshot=f.player.save(),before=f.player.getView();
    if(snapshot.run?.pending.kind!=='operation') throw new Error('Expected Operation');
    for(const order of [[],[{kind:'receipt',index:0}],[{kind:'receipt',index:0},{kind:'receipt',index:0}]]) {
      const bad={...snapshot,run:{...snapshot.run,pending:{...snapshot.run.pending,data:{...snapshot.run.pending.data,order}}}};
      expect(()=>f.player.restore(bad as StoryNodeSnapshot)).toThrow('InvalidSnapshot');
      expect(f.player.getView()).toEqual(before);
    }
  });
  it('preserves committed Operation receipts when a synchronous observer throws', () => {
    const document: StoryNodeDocument = {...root,nodes:[{id:'reward',type:'operation',action:{kind:'state',effects:[]}}]};
    const f=fixture([document]);
    f.execute.mockImplementation(()=>{throw Object.assign(new Error('ObserverFailed'),{receipts:[receipt]});});
    const failed=f.player.start(document.id,source);
    expect(failed.view).toMatchObject({status:'failed',data:{receipts:[receipt]}});
    expect(f.execute).toHaveBeenCalledTimes(1);
  });
});
