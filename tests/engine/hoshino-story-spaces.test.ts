import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishStory, settleStoryPresentation } from './story-test-fixtures';

const parent = 'base:passivestory:affinity_hoshino_bond_tail';
const child = 'base:activestory:bond_hoshino_1';
const area = 'base:area:abydos_embankment';
let game: GameInstance;
function next(channel: string, choice: string) {
  const view = game.story.getReplayPlaybackView(channel)!;
  if (view.phase === 'continue') expect(game.story.continueReplayStory(channel, view.token!).success).toBe(true);
  else if (view.phase === 'input') expect(game.story.submitReplayStoryInput(channel, view.token!, game.story.getReplayStoryView(channel)?.page.choices ? choice : undefined).success).toBe(true);
  else if (view.phase === 'failed') throw new Error(view.error);
  else vi.advanceTimersByTime(10000);
}
describe('published Hoshino three-space child story', () => {
  beforeEach(() => {
    vi.useFakeTimers(); game = new GameInstance(); game.init([defaultDatapack]);
    game.inits.unlockInit('base:init:abydos');
    expect(game.inits.startNewGame('base:init:abydos')).toBe(true);
    game.story.clearAllCurrentStories(); game.mutations.acquireCharacter('Hoshino', 'story');
    game.mutations.addAffectionExp('Hoshino', 1000);
  });
  afterEach(() => { game.dispose(); vi.useRealTimers(); });
  it('ships the same Entry, movement nodes and world locations as the author source', () => {
    for (const table of ['stories', 'activeStories', 'passiveStories'] as const) {
      expect(defaultDatapack[table].filter(x => [parent, child, 'base:story:affinity_hoshino_bond_tail', 'base:story:bond_hoshino_1'].includes(x.id)))
        .toEqual(baseDatapack[table].filter(x => [parent, child, 'base:story:affinity_hoshino_bond_tail', 'base:story:bond_hoshino_1'].includes(x.id)));
    }
    expect(defaultDatapack.areas.find(x => x.id === area)).toMatchObject(baseDatapack.areas.find(x => x.id === area)!);
  });
  it.each(['option1', 'option2'])('travels and returns %s to the original conversation without replaying world effects', choice => {
    for (let i = 0; i < 2; i++) {
      expect(game.story.triggerAffectionPush('Hoshino').success).toBe(true); finishStory(game, 0, 'Hoshino');
    }
    expect(game.story.triggerAffectionPush('Hoshino').success).toBe(true);
    expect(game.story.getCurrentStoryView('Hoshino')?.storyId).toBe(parent);
    settleStoryPresentation(game, 'Hoshino'); game.story.clickSend('Hoshino');
    const channel = game.story.getActiveStoryChannel()!.replayId;
    let sawDeparture = false, sawOnsite = false, sawReturn = false;
    for (let guard = 0; guard < 80 && game.story.saveCursors().child; guard++) {
      const node = game.story.getReplayStoryView(channel)?.nodeId;
      if (node === 'departure' && !sawDeparture) {
        sawDeparture = true;
        expect(game.story.getActiveStoryChannel()?.context).toMatchObject({ type: 'chara', characterId: 'Hoshino' });
        game.load(game.save());
      }
      if (node === 'p4-choice' && !sawOnsite) {
        sawOnsite = true;
        expect(game.state.currentAreaId).toBe(area);
        game.load(game.save());
      }
      if (node === 'contact-return' && !sawReturn) {
        sawReturn = true;
        expect(game.story.getActiveStoryChannel()?.context).toMatchObject({ type: 'chara', characterId: 'Hoshino' });
        game.load(game.save());
      }
      next(channel, choice);
    }
    expect([sawDeparture, sawOnsite, sawReturn]).toEqual([true, true, true]);
    const expectedFlag = choice === 'option1' ? 'hoshino-remembers' : 'hoshino-new-memories';
    expect(game.story.saveCursors().chats['variant:Hoshino'].playback.run?.localFlags).toEqual({ [expectedFlag]: true });
    expect(game.story.getCurrentStoryView('Hoshino')?.nodeId).toBe(choice === 'option1' ? 'remembered' : 'new-memories');
    expect(game.story.getPendingStoryReturn()).toBeNull();
    expect(game.story.getPlaybackView(null).entries.some(x => x.text.includes('海风很舒服哦'))).toBe(true);
    expect(game.story.getPlaybackView('Hoshino').entries.some(x => x.text.includes('海风很舒服哦'))).toBe(false);
    expect(game.state.flags.bond_hoshino_choice).toBe(choice === 'option1' ? 'committee' : 'forget');
    finishStory(game, 0, 'Hoshino');
    const before = JSON.stringify(game.state);
    const replay = game.story.replayStory(parent, 'Hoshino');
    if (!replay.success) throw new Error('Replay rejected');
    let replayChild = '';
    const off = game.eventBus.on('storyTriggered', e => { if (e.storyId === child) replayChild = e.replayId!; });
    for (let i = 0; i < 120 && game.story.getReplayStoryView(replay.replayId!); i++) {
      const running = replayChild && game.story.getReplayStoryView(replayChild) ? replayChild : replay.replayId!;
      next(running, choice);
    }
    off(); expect(game.story.getReplayStoryView(replay.replayId!)).toBeNull();
    expect(JSON.stringify(game.state)).toBe(before);
  });
});
