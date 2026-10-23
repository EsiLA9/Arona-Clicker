import { describe, expect, it, vi } from 'vitest';
import { StoryNodePlayer } from '../../src/arona-clicker/services/story/story-node-player';
import type { StoryNodeDocument } from '../../src/data-services/contracts/story-node';
import type { StoryNodePlaybackHost, StoryNodePlaybackView } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryNodeSnapshot } from '../../src/engine/contracts/story-node-snapshot';

const root: StoryNodeDocument = { id: 'story:root', name: 'Root', stages: { click: { advance: 'input' }, end: { advance: 'auto' } }, nodes: [
  { id: 'write', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'credit', amount: 1 }] } },
  { id: 'click', type: 'click', stageId: 'click', interaction: { kind: 'button', text: '按', press: { base: 2, rand: 3 }, result: { transfer: { mode: 'insert', storyId: 'story:child' } } } },
  { id: 'end', type: 'talklet', stageId: 'end', content: { kind: 'talk', text: '返回。' } },
] };
const child: StoryNodeDocument = { id: 'story:child', name: 'Child', stages: { body: { advance: 'auto' } }, nodes: [
  { id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: '插播。' } },
] };
const token = (view: StoryNodePlaybackView): string => {
  if (view.status !== 'input' && view.status !== 'delivery') throw new Error('Missing wait');
  return view.token;
};
function fixture() {
  const execute = vi.fn<StoryNodePlaybackHost['execute']>(() => ({ status: 'applied' }));
  const random = vi.fn(() => 0.5);
  const host: StoryNodePlaybackHost = { execute, random, evaluate: () => true, preflight: () => undefined };
  const documents = new Map([root, child].map(document => [document.id, document]));
  return { player: new StoryNodePlayer(documents, host), host, execute, random, documents };
}
describe('StoryNodePlayer persistent checkpoints', () => {
  it('resumes multi-click with the same roll and fresh tickets, without repeating previous effects', () => {
    const f = fixture();
    const started = f.player.start(root.id, { entryId: 'entry:root', owner: 'guest' });
    const partial = f.player.submit(token(started.view));
    expect(partial.view).toMatchObject({ press: { total: 3, done: 1 } });
    const saved = f.player.save();
    const next = new StoryNodePlayer(f.documents, f.host);
    next.restore(JSON.parse(JSON.stringify(saved)));
    expect(next.getView()).toMatchObject({ press: { total: 3, done: 1 } });
    expect(next.submit(token(partial.view)).error).toBe('StaleToken');
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(f.random).toHaveBeenCalledTimes(1);
    const working = next.submit(token(next.getView()));
    const inserted = next.submit(token(working.view));
    const inChild = next.save();
    next.restore(inChild);
    const returned = next.ackDelivery(token(next.getView()));
    expect(returned.view).toMatchObject({ storyId: root.id, node: { id: 'end' } });
    expect(next.ackDelivery(token(returned.view)).view.status).toBe('completed');
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(inserted.view).toMatchObject({ storyId: child.id });
  });

  it('validates checkpoints before replacing a live wait and never executes on rejection', () => {
    const f = fixture();
    f.player.start(root.id, { entryId: 'entry:root', owner: null });
    const before = f.player.getView();
    for (const change of [
      { nodeId: 'missing' }, { transfers: 33 }, { visited: [] },
      { pending: { kind: 'delivery' } }, { pending: { kind: 'input', press: { total: 999, done: 0 } } },
      { pending: { kind: 'input', press: { total: 3, done: 3 } } },
      { stack: [{ storyId: child.id, nextNodeId: 'missing' }] },
    ]) {
      const snapshot = f.player.save();
      expect(() => f.player.restore({ ...snapshot, run: { ...snapshot.run!, ...change } } as StoryNodeSnapshot)).toThrow();
      expect(f.player.getView()).toEqual(before);
    }
    expect(f.execute).toHaveBeenCalledTimes(1);
    f.player.restore({ format: 'story-nodes', run: null });
    expect(f.player.getView().status).toBe('idle');
  });

  it('rejects saving inside a synchronous action rather than recording a replayable half-step', () => {
    const f = fixture();
    f.execute.mockImplementation(() => {
      expect(() => f.player.save()).toThrow('Busy');
      return { status: 'applied' };
    });
    expect(f.player.start(root.id, { entryId: 'entry:root', owner: null }).ok).toBe(true);
  });
});
