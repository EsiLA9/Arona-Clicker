import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishStory, settleStoryPresentation } from './story-test-fixtures';

const drink = 'base:passivestory:shiroko_drink_invite';
const rooftop = 'base:passivestory:shiroko_rooftop_invite';
const area = 'base:area:schale_rooftop';
let game: GameInstance;
function finishChannel(channel: string, optionId: string) {
  for (let guard = 0; guard < 50; guard++) {
    const view = game.story.getReplayPlaybackView(channel);
    if (!view || view.phase === 'idle') return;
    if (view.phase === 'continue') expect(game.story.continueReplayStory(channel, view.token!).success).toBe(true);
    else if (view.phase === 'input') {
      if (game.story.getReplayStoryView(channel)?.nodeId === 'kizuna') return;
      expect(game.story.submitReplayStoryInput(channel, view.token!, optionId).success).toBe(true);
    }
    else if (view.phase === 'failed') throw new Error(view.error);
    else vi.advanceTimersByTime(10000);
  }
  throw new Error('Shiroko sample did not finish');
}

describe('published Shiroko continuation samples', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    game = new GameInstance(); game.init([defaultDatapack]);
    game.story.clearAllCurrentStories(); game.mutations.acquireCharacter('Shiroko', 'story');
  });
  afterEach(() => { game.dispose(); vi.useRealTimers(); });

  it('keeps the shipped sample definitions synchronized with their TypeScript author source', () => {
    for (const table of ['stories', 'passiveStories', 'activeStories'] as const) {
      expect(defaultDatapack[table].filter(x => x.id.includes(':shiroko_'))).toEqual(baseDatapack[table].filter(x => x.id.includes(':shiroko_')));
    }
  });
  it.each([
    ['coffee', 'photo'], ['coffee', 'route'], ['juice', 'photo'], ['juice', 'route'],
  ])('plays drink %s then rooftop %s through actual affection and Area entrances', (drinkChoice, rooftopChoice) => {
    expect(game.story.readyStepCount('Shiroko')).toBe(1);
    expect(game.story.triggerAffectionPush('Shiroko').success).toBe(true);
    expect(game.story.getCurrentStoryView('Shiroko')!.storyId).toBe(drink);
    settleStoryPresentation(game, 'Shiroko');
    expect(game.story.getCurrentStoryView('Shiroko')!.nodeId).toBe('kizuna');
    game.story.clickSend('Shiroko');
    finishChannel(game.story.getActiveStoryChannel()!.replayId, drinkChoice);
    expect(game.story.getCurrentStoryView('Shiroko')!.nodeId).toBe('kizuna');
    game.story.activateOwner('Shiroko');
    expect(game.story.getCurrentStoryView('Shiroko')!.nodeId).toBe(`return-${drinkChoice}`);
    expect(game.story.saveCursors().chats['variant:Shiroko'].playback.run!.localFlags).toEqual({ [`shiroko-drink-${drinkChoice}`]: true });
    finishStory(game, 0, 'Shiroko');

    expect(game.story.readyStepCount('Shiroko')).toBe(1);
    expect(game.story.triggerAffectionPush('Shiroko').success).toBe(true);
    expect(game.story.getCurrentStoryView('Shiroko')!.storyId).toBe(rooftop);
    settleStoryPresentation(game, 'Shiroko');
    expect(game.story.saveCursors().child).toBeUndefined();
    expect(game.travelToArea(area).success).toBe(true);
    const invitation = game.story.getAreaStoryDeliveries(area).find(x => x.entryId === 'base:activestory:shiroko_rooftop')!;
    expect(invitation.id).toMatch(/^continuation:/);
    game.load(game.save());
    expect(game.story.acceptAreaStoryDelivery(invitation.id!, area).success).toBe(true);
    const channel = game.story.getActiveStoryChannel()!.replayId;
    game.load(game.save()); finishChannel(channel, rooftopChoice);
    expect(game.story.getCurrentStoryView('Shiroko')!.nodeId).toBe('kizuna');
    game.story.activateOwner('Shiroko');
    expect(game.story.getCurrentStoryView('Shiroko')!.nodeId).toBe(`return-${rooftopChoice}`);
    expect(game.story.saveCursors().chats['variant:Shiroko'].playback.run!.localFlags).toEqual({ [`shiroko-rooftop-${rooftopChoice}`]: true });
    finishStory(game, 0, 'Shiroko');
    expect(game.story.readyStepCount('Shiroko')).toBe(0);
    expect(Object.keys(game.state.flags).filter(x => x.startsWith('shiroko-'))).toEqual([]);
    expect(game.state.storyLog.filter(x => x.storyId.includes(':shiroko_'))).toHaveLength(4);

    const before = JSON.stringify(game.state);
    const replay = game.story.replayStory(rooftop, 'Shiroko');
    if (!replay.success) throw new Error('Replay rejected');
    let replayChild = '';
    const off = game.eventBus.on('storyTriggered', e => { if (e.storyId === 'base:activestory:shiroko_rooftop') replayChild = e.replayId!; });
    finishChannel(replay.replayId!, rooftopChoice);
    expect(game.story.submitReplayStoryInput(replay.replayId!, game.story.getReplayPlaybackView(replay.replayId!)!.token!).success).toBe(true);
    expect(replayChild).toBeTruthy();
    finishChannel(replayChild, rooftopChoice); finishChannel(replay.replayId!, rooftopChoice); off();
    expect(JSON.stringify(game.state)).toBe(before);
  });
});
