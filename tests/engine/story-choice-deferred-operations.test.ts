import { describe, expect, it, vi } from 'vitest';
import { StoryNodePlayer } from '../../src/arona-clicker/services/story/story-node-player';
import type { StoryNodePlaybackHost, StoryNodePlaybackView } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryNode, StoryNodeDocument } from '../../src/data-services/contracts/story-node';

const source = { entryId: 'test:entry:choice', owner: null };
const talk = (id: string, requiresFlag?: string): StoryNode => ({ id, type: 'talklet', stageId: id, content: { kind: 'talk', text: id }, ...(requiresFlag ? { requiresFlag } : {}) });
const doc = (id: string, nodes: readonly StoryNode[]): StoryNodeDocument => ({ id, name: id, startContext: { type: 'area', areaId: 'base:area:schale_main' }, nodes, stages: Object.fromEntries(nodes.flatMap(node => node.type === 'click' || node.type === 'talklet' ? [[node.stageId, { advance: node.type === 'click' ? 'input' : 'auto' }]] : [])) });
const token = (view: StoryNodePlaybackView): string => {
  if (view.status !== 'delivery' && view.status !== 'input' && view.status !== 'operation' && view.status !== 'result') throw new Error(`No wait token: ${view.status}`);
  return view.token;
};
function setup(...documents: StoryNodeDocument[]) {
  const host = { evaluate: () => false, preflight: vi.fn<NonNullable<StoryNodePlaybackHost['preflight']>>(() => undefined), execute: vi.fn<StoryNodePlaybackHost['execute']>(() => ({ status: 'applied' })), random: () => 0.5 } satisfies StoryNodePlaybackHost;
  return { player: new StoryNodePlayer(new Map(documents.map(item => [item.id, item])), host), host };
}

describe('Choice flags with deferred Operations', () => {
  it('rejects a condition-failed option without consuming input or writing local flags', () => {
    const root = doc('root', [{ id: 'choice', type: 'click', stageId: 'choice', interaction: { kind: 'choice', options: [{ id: 'locked', text: 'locked', condition: { type: 'AND', conditions: [] }, result: { actions: [{ kind: 'localFlag', op: 'set', name: 'route_locked', value: true }] } }] } }, talk('guarded', 'route_locked')]);
    const f = setup(root);
    const input = f.player.start('root', source, { prior: 1 }).view;
    expect(input).toMatchObject({ status: 'input', availableOptionIds: [] });
    expect(f.player.submit(token(input), 'locked')).toMatchObject({ ok: false, error: 'OptionUnavailable' });
    expect(f.player.getView()).toEqual(input);
    expect(f.player.save().run?.localFlags).toEqual({ prior: 1 });
    expect(f.host.execute).not.toHaveBeenCalled();
  });

  it('clears a previous branch marker before setting the new choice and keeps state flags persistent-only', () => {
    const root = doc('root', [
      { id: 'choice', type: 'click', stageId: 'choice', interaction: { kind: 'choice', sharedActions: [{ kind: 'localFlag', op: 'remove', name: 'route_a' }, { kind: 'localFlag', op: 'remove', name: 'route_b' }], options: [{ id: 'a', text: 'A', result: { actions: [{ kind: 'localFlag', op: 'set', name: 'route_a', value: true }] } }, { id: 'b', text: 'B', result: { actions: [{ kind: 'localFlag', op: 'set', name: 'route_b', value: true }] } }] } },
      { id: 'award', type: 'operation', requiresFlag: 'route_b', action: { kind: 'state', effects: [{ op: 'setFlag', flagId: 'persistent_route_b', value: true }, { op: 'addResource', resourceId: 'credit', amount: 2 }] } },
      talk('a-only', 'route_a'), talk('b-only', 'route_b'),
    ]);
    const f = setup(root);
    const input = f.player.start('root', source, { route_a: true }).view;
    const operation = f.player.submit(token(input), 'b').view;
    expect(operation).toMatchObject({ status: 'operation', node: { id: 'award' } });
    expect(f.player.save().run?.localFlags).toEqual({ route_b: true });
    expect(f.host.execute).toHaveBeenCalledTimes(1);
    expect(f.host.execute.mock.calls[0][0]).toMatchObject({ kind: 'state', effects: [{ op: 'setFlag', flagId: 'persistent_route_b', value: true }, { op: 'addResource', amount: 2 }] });
    const next = setup(root);
    next.player.restore(JSON.parse(JSON.stringify(f.player.save())));
    expect(next.host.execute).not.toHaveBeenCalled();
    expect(next.player.ackDelivery(token(next.player.getView())).view).toMatchObject({ status: 'delivery', node: { id: 'b-only' } });
  });

  it('clears A when the same Choice is re-entered before dispatching only branch B', () => {
    const choice = { id: 'choice', type: 'click' as const, stageId: 'choice', interaction: { kind: 'choice' as const, sharedActions: [{ kind: 'localFlag' as const, op: 'remove' as const, name: 'route_a' }, { kind: 'localFlag' as const, op: 'remove' as const, name: 'route_b' }, { kind: 'localFlag' as const, op: 'remove' as const, name: 'again' }], options: [
      { id: 'a', text: 'A', result: { actions: [{ kind: 'localFlag' as const, op: 'set' as const, name: 'route_a', value: true }, { kind: 'localFlag' as const, op: 'set' as const, name: 'again', value: true }] } },
      { id: 'b', text: 'B', result: { actions: [{ kind: 'localFlag' as const, op: 'set' as const, name: 'route_b', value: true }] } },
    ] } };
    const root = doc('root', [choice,
      { id: 'award-a', type: 'operation', requiresFlag: 'route_a', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 1 }] } },
      { id: 'to-return', type: 'transfer', requiresFlag: 'again', transfer: { mode: 'goto', storyId: 'return' } },
      { id: 'award-b', type: 'operation', requiresFlag: 'route_b', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] } },
      talk('only-b', 'route_b'),
    ]);
    const f = setup(root, doc('return', [{ id: 'back', type: 'transfer', transfer: { mode: 'goto', storyId: 'root' } }]));
    const inputA = f.player.start('root', source).view;
    const awardA = f.player.submit(token(inputA), 'a').view;
    expect(awardA).toMatchObject({ status: 'operation', node: { id: 'award-a' } });
    const choiceB = f.player.ackDelivery(token(awardA)).view;
    expect(choiceB).toMatchObject({ status: 'input', storyId: 'root', node: { id: 'choice' } });
    expect(f.player.save().run?.localFlags).toEqual({ route_a: true, again: true });
    const awardB = f.player.submit(token(choiceB), 'b').view;
    expect(awardB).toMatchObject({ status: 'operation', node: { id: 'award-b' } });
    const onlyB = f.player.ackDelivery(token(awardB)).view;
    expect(onlyB).toMatchObject({ status: 'delivery', node: { id: 'only-b' } });
    expect(f.host.execute.mock.calls.map(([action]) => action)).toEqual([
      { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 1 }] },
      { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 2 }] },
    ]);
    expect(f.player.save().run?.localFlags).toEqual({ route_b: true });
  });

  it('preserves the insert return point and local flags across Story documents and goto', () => {
    const root = doc('root', [
      { id: 'choice', type: 'click', stageId: 'choice', interaction: { kind: 'choice', options: [{ id: 'go', text: 'Go', result: { actions: [{ kind: 'localFlag', op: 'set', name: 'route', value: true }] } }] } },
      { id: 'to-child', type: 'transfer', requiresFlag: 'route', transfer: { mode: 'insert', storyId: 'child' } },
      talk('returned', 'route'), { id: 'to-end', type: 'transfer', requiresFlag: 'route', transfer: { mode: 'goto', storyId: 'end' } },
    ]);
    const f = setup(root, doc('child', [talk('in-child', 'route')]), doc('end', [talk('at-end', 'route')]));
    const input = f.player.start('root', source).view;
    const child = f.player.submit(token(input), 'go').view;
    expect(child).toMatchObject({ status: 'delivery', storyId: 'child', node: { id: 'in-child' } });
    const returned = f.player.ackDelivery(token(child)).view;
    expect(returned).toMatchObject({ status: 'delivery', storyId: 'root', node: { id: 'returned' } });
    expect(f.player.ackDelivery(token(returned)).view).toMatchObject({ status: 'delivery', storyId: 'end', node: { id: 'at-end' } });
  });

  it('restores an Operation wait without replaying it, then follows its flag-gated Transfer', () => {
    const root = doc('root', [
      { id: 'choice', type: 'click', stageId: 'choice', interaction: { kind: 'choice', options: [{ id: 'go', text: 'Go', result: { actions: [{ kind: 'localFlag', op: 'set', name: 'route', value: true }] } }] } },
      { id: 'award', type: 'operation', requiresFlag: 'route', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 3 }] } },
      { id: 'to-child', type: 'transfer', requiresFlag: 'route', transfer: { mode: 'goto', storyId: 'child' } },
    ]);
    const child = doc('child', [talk('child-body', 'route')]);
    const f = setup(root, child);
    const input = f.player.start('root', source).view;
    const operation = f.player.submit(token(input), 'go').view;
    expect(operation).toMatchObject({ status: 'operation', node: { id: 'award' } });
    const snapshot = JSON.parse(JSON.stringify(f.player.save()));
    const restored = setup(root, child);
    restored.player.restore(snapshot);
    expect(restored.host.execute).not.toHaveBeenCalled();
    const body = restored.player.ackDelivery(token(restored.player.getView())).view;
    expect(body).toMatchObject({ status: 'delivery', storyId: 'child', node: { id: 'child-body' } });
    expect(restored.host.execute).not.toHaveBeenCalled();
    expect(restored.player.save().run?.localFlags).toEqual({ route: true });
  });

  it('keeps a replay local route marker while skipping persistent state effects', () => {
    const root = doc('root', [
      { id: 'choice', type: 'click', stageId: 'choice', interaction: { kind: 'choice', options: [{ id: 'go', text: 'Go', result: { actions: [{ kind: 'localFlag', op: 'set', name: 'route', value: true }] } }] } },
      { id: 'award', type: 'operation', requiresFlag: 'route', action: { kind: 'state', effects: [{ op: 'setFlag', flagId: 'persistent', value: true }] } }, talk('route-tail', 'route'),
    ]);
    const f = setup(root);
    const input = f.player.start('root', source).view;
    f.player.setChannel('replay:one', true);
    const tail = f.player.submit(token(input), 'go').view;
    expect(tail).toMatchObject({ status: 'delivery', node: { id: 'route-tail' } });
    expect(f.host.execute).not.toHaveBeenCalled();
    expect(f.player.save().run?.localFlags).toEqual({ route: true });
  });

  it('fails at a later Operation without pretending the earlier committed batch was rolled back', () => {
    const root = doc('root', [
      {id:'choice',type:'click',stageId:'choice',interaction:{kind:'choice',options:[{id:'go',text:'Go',result:{actions:[{kind:'localFlag',op:'set',name:'route',value:true}]}}]}},
      {id:'first',type:'operation',requiresFlag:'route',action:{kind:'state',effects:[{op:'setFlag',flagId:'first',value:true}]}},
      {id:'second',type:'operation',requiresFlag:'route',action:{kind:'state',effects:[{op:'setFlag',flagId:'second',value:true}]}},
    ]);
    const f = setup(root), persisted: string[] = [];
    f.host.preflight.mockImplementation(action => action.kind === 'state' && action.effects.some(effect=>effect.op==='setFlag'&&effect.flagId==='second') ? 'SecondRejected' : undefined);
    f.host.execute.mockImplementation(action => { if(action.kind==='state') for(const effect of action.effects) if(effect.op==='setFlag') persisted.push(effect.flagId); return {status:'applied'}; });
    const input = f.player.start('root',source).view;
    const first = f.player.submit(token(input),'go').view;
    expect(first).toMatchObject({status:'operation',node:{id:'first'}});
    expect(f.player.ackDelivery(token(first))).toMatchObject({ok:false,error:'SecondRejected',view:{status:'failed'}});
    expect(persisted).toEqual(['first']);
    expect(f.host.execute).toHaveBeenCalledTimes(1);
  });
});
