import { describe, expect, it, vi } from 'vitest';
import { StoryNodePlayer } from '../../src/arona-clicker/services/story/story-node-player';
import type { StoryNode, StoryNodeDocument } from '../../src/data-services/contracts/story-node';
import type { StoryNodePlaybackHost, StoryNodePlaybackView } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryRunFlags } from '../../src/engine/contracts/story-run-flags';

const talk = (id: string, requiresFlag?: string): StoryNode => ({ id, type: 'talklet', stageId: id, content: { kind: 'talk', text: id }, ...(requiresFlag === undefined ? {} : { requiresFlag }) });
function doc(id: string, nodes: readonly StoryNode[]): StoryNodeDocument {
  return { id, name: id, startContext: { type: 'area', areaId: 'base:area:schale_main' }, nodes, stages: Object.fromEntries(nodes.flatMap(node => node.type === 'talklet' || node.type === 'click'
    ? [[node.stageId, { advance: node.type === 'click' ? 'input' : 'auto' }]] : [])) };
}
function fixture(...documents: StoryNodeDocument[]) {
  const host: StoryNodePlaybackHost = { preflight: vi.fn(() => undefined), execute: vi.fn(() => ({ status: 'applied' as const })), random: vi.fn(() => 0.5), evaluate: () => true };
  return { player: new StoryNodePlayer(new Map(documents.map(item => [item.id, item])), host), host };
}
const source = { entryId: 'test:activestory:flags', owner: null };
const token = (view: StoryNodePlaybackView): string => { if (view.status !== 'delivery' && view.status !== 'input') throw new Error('Missing wait'); return view.token; };

describe('Entry run-local flag map and node gates', () => {
  it.each([false, 0, '', null, { nested: ['value'] }])('tests existence rather than truthiness: %j', value => {
    const f = fixture(doc('root', [talk('visible', 'SomeStory-ready')]));
    expect(f.player.start('root', source, { 'SomeStory-ready': value }).view).toMatchObject({ status: 'delivery', node: { id: 'visible' } });
  });

  it('skips all four node kinds without calling any host, drawing random, or waiting', () => {
    const f = fixture(doc('root', [
      talk('talk', 'absent'),
      { id: 'click', type: 'click', stageId: 'click', requiresFlag: 'absent', interaction: { kind: 'button', text: 'skip', press: { base: 2, rand: 3 } } },
      { id: 'action', type: 'operation', requiresFlag: 'absent', action: { kind: 'travel', areaId: 'missing' } },
      { id: 'transfer', type: 'transfer', requiresFlag: 'absent', transfer: { mode: 'goto', storyId: 'missing' } },
    ]));
    const result = f.player.start('root', source);
    expect(result).toMatchObject({ ok: true, view: { status: 'completed' } });
    expect(result.events.map(event => event.type)).toEqual(['completed']);
    expect(f.host.execute).not.toHaveBeenCalled();
    expect(f.host.preflight).not.toHaveBeenCalled();
    expect(f.host.random).not.toHaveBeenCalled();
  });

  it('sets, overwrites and removes in ordered choice actions, shared through insert and goto', () => {
    const f = fixture(doc('root', [
      { id: 'choice', type: 'click', stageId: 'choice', interaction: { kind: 'choice', sharedActions: [{ kind: 'localFlag', op: 'set', name: 'route', value: true }], options: [{ id: 'go', text: 'go', result: { actions: [
        { kind: 'localFlag', op: 'set', name: 'route', value: false },
        { kind: 'localFlag', op: 'remove', name: 'missing' },
      ], transfer: { mode: 'insert', storyId: 'child' } } }] } },
      talk('returned', 'route'),
      { id: 'goto', type: 'transfer', transfer: { mode: 'goto', storyId: 'end' } },
    ]), doc('child', [talk('inChild', 'route')]), doc('end', [
      { id: 'remove', type: 'operation', action: { kind: 'localFlag', op: 'remove', name: 'route' } }, talk('skipped', 'route'), talk('final'),
    ]));
    let result = f.player.start('root', source);
    result = f.player.submit(token(result.view), 'go');
    expect(result.view).toMatchObject({ storyId: 'child', node: { id: 'inChild' } });
    expect(f.player.save().run!.localFlags).toEqual({ route: false });
    result = f.player.ackDelivery(token(result.view));
    expect(result.view).toMatchObject({ node: { id: 'returned' } });
    result = f.player.ackDelivery(token(result.view));
    expect(result.view).toMatchObject({ storyId: 'end', node: { id: 'final' } });
    expect(f.player.save().run!.localFlags).toEqual({});
    expect(f.host.execute).not.toHaveBeenCalled();
  });

  it('copies caller values, handles special keys and starts each run with a fresh map', () => {
    const f = fixture(doc('root', [talk('special', '__proto__')]));
    const initial = JSON.parse('{"__proto__":{"nested":[1]}}');
    f.player.start('root', source, initial);
    initial.__proto__.nested.push(2);
    expect(f.player.save().run!.localFlags).toEqual(JSON.parse('{"__proto__":{"nested":[1]}}'));
    const snapshot = f.player.save();
    (snapshot.run!.localFlags.__proto__ as { nested: number[] }).nested.push(9);
    expect(f.player.save().run!.localFlags).toEqual(JSON.parse('{"__proto__":{"nested":[1]}}'));
    f.player.cancel();
    expect(f.player.start('root', source).view.status).toBe('completed');
  });

  it('restores JSON checkpoints without replaying actions or rechecking an accepted wait', () => {
    const root = doc('root', [
      { id: 'set', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'ready', value: 0 } }, talk('wait', 'ready'), talk('after', 'ready'),
    ]);
    const f = fixture(root);
    f.player.start('root', source);
    const saved = JSON.parse(JSON.stringify(f.player.save()));
    const next = fixture(root);
    next.player.restore(saved);
    expect(next.player.save().run!.localFlags).toEqual({ ready: 0 });
    expect(next.host.execute).not.toHaveBeenCalled();
    const accepted = next.player.save();
    (accepted.run as { localFlags: StoryRunFlags }).localFlags = {};
    next.player.restore(accepted); // existing checkpoint remains an already accepted wait
    expect(next.player.getView()).toMatchObject({ node: { id: 'wait' } });
    expect(next.player.ackDelivery(token(next.player.getView())).view.status).toBe('completed');
  });

  it('rejects malformed initial maps and snapshots without replacing a live wait', () => {
    const f = fixture(doc('root', [talk('wait')]));
    f.player.start('root', source);
    const before = f.player.getView();
    for (const flags of [null, [], { '': true }, { bad: undefined }, { bad: Number.NaN }, { bad: new Map() }]) {
      const snapshot = f.player.save();
      (snapshot.run as unknown as { localFlags: unknown }).localFlags = flags;
      expect(() => f.player.restore(snapshot)).toThrow('InvalidSnapshot');
      expect(f.player.getView()).toEqual(before);
    }
    const idle = fixture(doc('root', [talk('wait')]));
    expect(idle.player.start('root', source, { bad: undefined } as unknown as StoryRunFlags)).toMatchObject({ ok: false });
    expect(idle.player.getView().status).toBe('idle');
  });
});
