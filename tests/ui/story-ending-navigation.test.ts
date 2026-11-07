// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { makePack } from '../engine/story-test-fixtures';
import { UIController } from '../../src/ui/controller/controller';
import { bindEvents } from '../../src/ui/controller/controller-events';

const parent = 'test:passivestory:route_parent', child = 'test:activestory:route_child';
const plain = 'test:activestory:route_plain', passive = 'test:passivestory:route_plain';
const onsite = 'test:passivestory:route_onsite', area = 'base:area:schale_rooftop';
let game: GameInstance, ctrl: UIController;
function setup(atArea = false, charaScene = false) {
  const entryBase = { availableInits: [], triggerCondition: { type: 'AND' as const, conditions: [] }, replayable: true };
  const body = { id: 'body', type: 'talklet' as const, stageId: 's', content: { kind: 'narration' as const, text: 'body' } };
  const docBase = { name: 'route', startContext: { type: 'area' as const, areaId: area }, stages: { s: { advance: 'input' as const } } };
  const pack = makePack([
    { ...entryBase, id: parent, storyId: 'test:story:route_parent', owner: 'Hoshino', kizuna: { entryId: child, ...(atArea ? { areaId: area } : {}) }, activation: { kind: 'random' as const, weight: 1, repeatable: false } },
    { ...entryBase, id: child, storyId: 'test:story:route_child', activation: { kind: 'active' as const } },
    { ...entryBase, id: plain, storyId: 'test:story:route_plain', activation: { kind: 'active' as const } },
    { ...entryBase, id: passive, storyId: 'test:story:route_plain', owner: 'Hoshino', activation: { kind: 'random' as const, weight: 1, repeatable: false } },
    { ...entryBase, id: onsite, storyId: 'test:story:route_onsite', owner: 'Hoshino', activation: { kind: 'random' as const, weight: 1, repeatable: false } },
  ], [
    { ...docBase, id: 'test:story:route_parent', startContext: { type: 'chara', characterId: 'Hoshino' }, nodes: [{ id: 'card', type: 'click', stageId: 's', interaction: { kind: 'kizunaCard' } }, body] },
    { ...docBase, id: 'test:story:route_child', ...(charaScene ? { startContext: { type: 'chara' as const, characterId: 'Hoshino' } } : {}), nodes: [body] },
    { ...docBase, id: 'test:story:route_plain', nodes: [body] },
    { ...docBase, id: 'test:story:route_onsite', nodes: [{ id: 'area', type: 'click', stageId: 's', interaction: { kind: 'areaContinue', areaId: area } }, body] },
  ]);
  game = new GameInstance(); game.init([baseDatapack, pack]); game.story.clearAllCurrentStories();
  game.mutations.acquireCharacter('Hoshino', 'story');
  document.body.innerHTML = '<div id="app"></div>';
  ctrl = new UIController(game, document.querySelector('#app')!); ctrl.started = true; bindEvents(ctrl);
}
function finishChannel(channel: string) {
  expect(game.story.continueReplayStory(channel, game.story.getReplayPlaybackView(channel)!.token!).success).toBe(true);
}
function startChild(atArea = false) {
  game.story.startStory(parent, 'passive', 'Hoshino');
  ctrl.openContactsWorkspace('Hoshino');
  if (atArea) {
    game.travelToArea(area);
    const invitation = game.story.getAreaStoryDeliveries(area).find(x => x.entryId === child)!;
    expect(game.story.acceptAreaStoryDelivery(invitation.id!, area).success).toBe(true);
  } else game.story.clickSend('Hoshino');
  return game.story.getActiveStoryChannel()!.replayId;
}
describe('Story ending navigation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { ctrl?.destroy(); game?.dispose(); localStorage.clear(); vi.useRealTimers(); });
  it('ordinary first Active story stays in Game', () => {
    setup(); ctrl.navigateToService('game');
    game.story.startActiveStory(plain);
    game.story.continueStory(null, game.story.getPlaybackView(null).token!);
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
  });
  it('ordinary first Passive story stays in Contacts', () => {
    setup(); ctrl.openContactsWorkspace('Hoshino');
    game.story.startStory(passive, 'passive', 'Hoshino');
    game.story.continueStory('Hoshino', game.story.getPlaybackView('Hoshino').token!);
    expect(ctrl.panelState.workspace?.type).toBe('contacts');
  });
  it('formal direct child keeps the current scene while its parent waits for return', () => {
    setup(); finishChannel(startChild());
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
    ctrl.render(); ctrl.refreshChatPanel();
    expect(document.querySelector('[data-story-replay-id] [data-send]')).toBeNull();
    expect(game.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('card');
    expect(game.story.saveCursors().chats['variant:Hoshino'].continuation?.state).toBe('returned');
  });
  it('formal Area child keeps the current scene', () => {
    setup(true); finishChannel(startChild(true));
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
    ctrl.render(); ctrl.refreshChatPanel();
    expect(document.querySelector('[data-story-replay-id] [data-send]')).toBeNull();
  });
  it('formal areaContinue root keeps the current scene', () => {
    setup(); ctrl.chat.pushToOwner(ctrl.panelState, null, { kind: 'system', text: 'prior-init' });
    game.story.startStory(onsite, 'passive', 'Hoshino'); game.travelToArea(area);
    const invitation = game.story.getAreaStoryDeliveries(area).find(x => x.entryId === onsite)!;
    game.story.acceptAreaStoryDelivery(invitation.id!, area);
    ctrl.render();
    expect(document.body.textContent).toContain('prior-init');
    expect(document.body.textContent).toContain('body');
    finishChannel(game.story.getActiveStoryChannel()!.replayId);
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
    ctrl.render(); ctrl.refreshChatPanel();
    expect(document.querySelector('[data-story-replay-id] [data-send]')).toBeNull();
    expect(document.querySelector('[data-send]')).not.toBeNull();
  });
  it('restored formal child keeps the current scene', () => {
    setup(); const channel = startChild(); game.load(game.save()); ctrl.render();
    finishChannel(channel);
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
    ctrl.render(); ctrl.refreshChatPanel();
    expect(document.querySelector('[data-story-replay-id] [data-send]')).toBeNull();
  });
  it('true standalone replay correctly opens Story', () => {
    setup(); const started = game.story.replayStory(plain);
    if (!started.success) throw new Error('Replay rejected');
    finishChannel(started.replayId!);
    expect(ctrl.panelState.workspace?.type).toBe('story');
  });
  it('combined replay waits until the replay root finishes before opening Story', () => {
    setup(); const started = game.story.replayStory(parent, 'Hoshino');
    if (!started.success) throw new Error('Replay rejected');
    let channel = '';
    game.eventBus.on('storyTriggered', e => { if (e.storyId === child) channel = e.replayId!; });
    game.story.submitReplayStoryInput(started.replayId!, game.story.getReplayPlaybackView(started.replayId!)!.token!);
    finishChannel(channel);
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
    finishChannel(started.replayId!);
    expect(ctrl.panelState.workspace?.type).toBe('story');
  });
  it('returns from a completed Chara scene to the parent when selecting the same contact', () => {
    setup(false, true); finishChannel(startChild());
    expect(ctrl.panelState.workspace?.type).toBe('contacts');
    expect(ctrl.panelState.storyReplay).toBeUndefined();
    ctrl.render(); ctrl.refreshChatPanel();
    expect(document.querySelector('[data-story-replay-id] [data-send]')).toBeNull();
    expect(document.querySelector('[data-story-return-owner]')).toBeNull();
    expect(document.querySelector('[data-send]')).not.toBeNull();
    ctrl.selectContactsVariant('Hoshino'); ctrl.render();
    expect(ctrl.panelState.storyReplay).toBeUndefined();
    expect(game.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('body');
  });
  it('releases a finished formal channel when the next ordinary story starts', () => {
    setup(); finishChannel(startChild());
    expect(game.story.startActiveStory(plain).success).toBe(true);
    ctrl.render();
    expect(ctrl.panelState.storyReplay).toBeUndefined();
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
    expect(document.querySelector('[data-story-replay-id]')).toBeNull();
    expect(document.querySelector('[data-send]')).not.toBeNull();
  });
  it('formal child cancellation does not open Story', () => {
    setup(); const channel = startChild(); game.story.cancelReplayStory(channel);
    expect(ctrl.panelState.workspace?.type).not.toBe('story');
  });
});
