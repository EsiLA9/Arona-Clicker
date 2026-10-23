import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { SaveData } from '../../src/arona-clicker/contracts/runtime/save-data';
import { finishWelcome, makePack } from './story-test-fixtures';

const entryId = 'test:activestory:checkpoint';
const storyId = 'test:story:checkpoint';
let game: GameInstance;
function setup() {
  game = new GameInstance();
  game.init([baseDatapack, makePack([
    { id: entryId, storyId, type: 'active', availableInits: [], triggerCondition: { type: 'AND', conditions: [] } },
  ], [{ id: storyId, name: 'Checkpoint', stages: { work: { advance: 'input' }, body: { advance: 'auto' } }, nodes: [
    { id: 'award', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 7 }] } },
    { id: 'overlay', type: 'operation', action: { kind: 'overlay', command: { command: 'show', id: 'hint', x: 0.2, y: 0.3, content: { kind: 'text', text: '恢复提示' } } } },
    { id: 'work', type: 'click', stageId: 'work', interaction: { kind: 'button', text: '继续', press: { base: 3, rand: 2 } } },
    { id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: '工作完成' } },
  ] }])]);
  finishWelcome(game);
  return game;
}

describe('formal Node save/load cutover', () => {
  afterEach(() => { game?.dispose(); vi.restoreAllMocks(); });

  it('restores independent owners and exact click rolls without replaying state operations', () => {
    const g = setup();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const shown: unknown[] = [];
    g.eventBus.on('chatTextShown', event => shown.push(event));
    const before = g.state.resources['base:resource:credit'] ?? 0;
    expect(g.story.startActiveStory(entryId).success).toBe(true);
    expect(g.story.startActiveStory(entryId, 'guest').success).toBe(true);
    const oldGlobal = g.story.getCurrentStoryView()!;
    const oldGuest = g.story.getCurrentStoryView('guest')!;
    expect(g.story.clickSend(null, oldGlobal.token)).toMatchObject({ type: 'working', clicksDone: 1, clicksTotal: 4 });
    g.story.clickSend('guest', oldGuest.token);
    g.story.clickSend('guest', g.story.getCurrentStoryView('guest')!.token);
    const save = JSON.parse(JSON.stringify(g.save())) as SaveData;
    const rolls = random.mock.calls.length;
    expect(save.version).toBe('2.0.0');
    expect(save).not.toHaveProperty('pendingTalkletClicks');
    expect(g.state.resources['base:resource:credit']).toBe(before + 14);

    g.load(save);
    expect(random).toHaveBeenCalledTimes(rolls);
    expect(g.state.resources['base:resource:credit']).toBe(before + 14);
    expect(g.story.getSendState()).toMatchObject({ clickWork: { total: 4, done: 1 } });
    expect(g.story.getSendState('guest')).toMatchObject({ clickWork: { total: 4, done: 2 } });
    const restored = g.story.getCurrentStoryView()!;
    expect(restored.runId).not.toBe(oldGlobal.runId);
    expect(restored.token).not.toBe(oldGlobal.token);
    expect(restored.historyId).toBe(oldGlobal.historyId);
    expect(g.story.clickSend(null, oldGlobal.token)).toMatchObject({ type: 'completed', advance: { success: false, error: 'StaleToken' } });
    expect(shown).toHaveLength(4); // two initial overlays, two restored overlays
    expect(shown.slice(2)).toEqual(expect.arrayContaining([
      expect.objectContaining({ owner: null, runId: restored.runId, id: 'hint' }),
      expect.objectContaining({ owner: 'guest', runId: g.story.getCurrentStoryView('guest')!.runId, id: 'hint' }),
    ]));
    g.load(save); // the same saved run remains restorable after its old visual run was closed
    expect(g.story.getCurrentStoryView()!.runId).not.toBe(restored.runId);
    expect(g.state.resources['base:resource:credit']).toBe(before + 14);
  });

  it('rejects the old save format before touching the running state or current wait', () => {
    const g = setup();
    g.story.startActiveStory(entryId);
    const before = JSON.stringify(g.state);
    const view = g.story.getCurrentStoryView();
    const incompatible = { ...g.save(), version: '1.0.0' };
    expect(() => g.load(incompatible)).toThrow('UnsupportedSaveFormat');
    expect(JSON.stringify(g.state)).toBe(before);
    expect(g.story.getCurrentStoryView()).toEqual(view);
  });

  it('rejects a corrupt later owner before replacing any state or existing run', () => {
    const g = setup();
    g.story.startActiveStory(entryId);
    g.story.startActiveStory(entryId, 'guest');
    const saved = JSON.parse(JSON.stringify(g.save()));
    saved.storyPlayback.chats['variant:guest'].playback.run.nodeId = 'missing-node';
    const state = JSON.stringify(g.state);
    const global = g.story.getCurrentStoryView();
    const guest = g.story.getCurrentStoryView('guest');
    expect(() => g.load(saved)).toThrow();
    expect(JSON.stringify(g.state)).toBe(state);
    expect(g.story.getCurrentStoryView()).toEqual(global);
    expect(g.story.getCurrentStoryView('guest')).toEqual(guest);
  });
});
