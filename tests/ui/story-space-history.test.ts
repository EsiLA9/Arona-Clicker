// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { makePack } from '../engine/story-test-fixtures';
import { UIController } from '../../src/ui/controller/controller';
import { bindEvents } from '../../src/ui/controller/controller-events';

const parent = 'test:passivestory:history_parent', child = 'test:activestory:history_child';
const area = 'base:area:schale_rooftop';
let game: GameInstance, ctrl: UIController;
function setup(roundTrip = true) {
  const talk = (id: string) => ({ id, type: 'talklet' as const, stageId: 's', content: { kind: 'narration' as const, text: id } });
  game = new GameInstance();
  game.init([baseDatapack, makePack([
    { id: parent, storyId: 'test:story:history_parent', type: 'passive', owner: 'Hoshino', repeatable: false, replayable: true, weight: 1, availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, kizuna: { entryId: child } },
    { id: child, storyId: 'test:story:history_child', type: 'active', availableInits: [], triggerCondition: { type: 'AND', conditions: [] } },
  ], [
    { id: 'test:story:history_parent', name: 'parent', startContext: { type: 'chara', characterId: 'Hoshino' }, stages: { s: { advance: 'input' } }, nodes: [{ id: 'card', type: 'click', stageId: 's', interaction: { kind: 'kizunaCard' } }, talk('parent-tail')] },
    { id: 'test:story:history_child', name: 'child', startContext: { type: 'chara', characterId: 'Hoshino' }, stages: { s: { advance: 'input' } }, nodes: [talk('child-start'), { id: 'go', type: 'moveToArea', areaId: area }, talk('onsite'), ...(roundTrip ? [{ id: 'back', type: 'moveToCharaspace' as const, characterId: 'Hoshino' }, talk('child-return')] : [])] },
  ])]);
  game.story.clearAllCurrentStories(); game.mutations.acquireCharacter('Hoshino', 'story');
  document.body.innerHTML = '<div id="app"></div>';
  ctrl = new UIController(game, document.querySelector('#app')!); ctrl.started = true; bindEvents(ctrl);
  ctrl.chat.pushToVariant(ctrl.panelState, 'Hoshino', { kind: 'system', text: 'prior-contact' });
  ctrl.chat.pushToOwner(ctrl.panelState, null, { kind: 'system', text: 'prior-init' });
  expect(game.story.startStory(parent, 'passive', 'Hoshino').success).toBe(true); ctrl.openContactsWorkspace('Hoshino'); ctrl.render();
}
function step() {
  const channel = game.story.getActiveStoryChannel()!.replayId;
  expect(game.story.continueReplayStory(channel, game.story.getReplayPlaybackView(channel)!.token!).success).toBe(true);
  ctrl.render();
}
describe('formal story history and space', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { ctrl?.destroy(); game?.dispose(); vi.useRealTimers(); localStorage.clear(); });
  it('uses a heart card and keeps existing contact history on child entry', () => {
    setup();
    expect(document.querySelector('.yuzu-kizuna-heart')).not.toBeNull();
    game.story.clickSend('Hoshino'); ctrl.render();
    expect(document.body.textContent).toContain('prior-contact');
    expect(document.body.textContent).toContain('child-start');
    expect(game.story.getPlaybackView('Hoshino').entries.some(e => e.text === 'child-start')).toBe(true);
  });
  it('appends to each space once, restores mid-run, and hands back after the explicit return', () => {
    setup(); game.story.clickSend('Hoshino'); ctrl.render(); step();
    expect(document.body.textContent).toContain('prior-init');
    expect(document.body.textContent).toContain('onsite');
    expect(document.body.textContent).not.toContain('child-start');
    game.load(game.save()); ctrl.render(); step();
    expect(document.body.textContent).toContain('prior-contact');
    expect(document.body.textContent).toContain('child-start');
    expect(document.body.textContent).toContain('child-return');
    expect(document.body.textContent).not.toContain('onsite');
    step();
    expect(game.story.getCurrentStoryView('Hoshino')?.nodeId).toBe('parent-tail');
    expect(ctrl.panelState.storyReplay).toBeUndefined();
    expect(document.querySelector('[data-send]')).not.toBeNull();
    ctrl.render(); ctrl.refreshChatPanel();
    expect(game.story.getPlaybackView('Hoshino').entries.filter(e => e.text === 'child-start')).toHaveLength(1);
    expect(game.story.getPlaybackView(null).entries.filter(e => e.text === 'onsite')).toHaveLength(1);
  });
  it('offers a return action after completion away from its parent, including after loading', () => {
    setup(false); game.story.clickSend('Hoshino'); ctrl.render(); step(); step();
    expect(game.story.getCurrentStoryView('Hoshino')?.nodeId).toBe('card');
    game.load(game.save()); ctrl.render();
    const back = document.querySelector<HTMLButtonElement>('[data-story-return-owner]');
    expect(back).not.toBeNull(); back!.click(); ctrl.render();
    expect(ctrl.panelState.conversationVariantId).toBe('Hoshino');
    expect(game.story.getCurrentStoryView('Hoshino')?.nodeId).toBe('parent-tail');
  });
  it('keeps its temporary theme active through rendering and removes it on completion', () => {
    setup();
    const doc = game.registry.stories.get('test:story:history_child')!;
    game.registry.load(makePack([game.registry.activeStories.get(child)!], [{ ...doc, nodes: [
      { id: 'theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { tokens: { primary: '#123456' } } } } }, ...doc.nodes,
    ] }]));
    game.story.clickSend('Hoshino'); ctrl.render(); ctrl.refreshChatPanel();
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#123456');
    step(); step(); step();
    expect(game.colorSystem.runtimeTheme().tokens.primary).not.toBe('#123456');
  });
  it('keeps a private reread selected while a formal child remains in progress', () => {
    setup(); game.story.clickSend('Hoshino'); ctrl.render();
    const formal = game.story.getActiveStoryChannel()!.replayId;
    const replay = game.story.replayStory(parent, 'Hoshino');
    if (!replay.success) throw new Error('Replay rejected');
    ctrl.render(); ctrl.refreshChatPanel();
    expect(ctrl.panelState.storyReplay?.replayId).toBe(replay.replayId);
    expect(game.story.getActiveStoryChannel()?.replayId).toBe(formal);
    game.story.cancelReplayStory(replay.replayId!); ctrl.render();
    expect(ctrl.panelState.storyReplay?.replayId).toBe(formal);
  });
  it('keeps the last committed scene and history when a move is rejected', () => {
    setup();
    const doc = game.registry.stories.get('test:story:history_child')!;
    game.registry.load(makePack([game.registry.activeStories.get(child)!], [{ ...doc, nodes: doc.nodes.map(node => node.id === 'go'
      ? { ...node, type: 'moveToArea' as const, areaId: 'base:area:abydos_pool' } : node) }]));
    game.story.clickSend('Hoshino'); ctrl.render();
    const channel = game.story.getActiveStoryChannel()!.replayId;
    expect(game.story.continueReplayStory(channel, game.story.getReplayPlaybackView(channel)!.token!).success).toBe(false);
    expect(ctrl.panelState.conversationVariantId).toBe('Hoshino');
    expect(ctrl.panelState.workspace?.type).toBe('contacts');
    expect(game.state.currentAreaId).toBe('base:area:schale_main');
    expect(game.story.getCurrentStoryView('Hoshino')?.nodeId).toBe('card');
    expect(game.story.getPlaybackView('Hoshino').entries.some(e => e.text === 'child-start')).toBe(true);
  });
  it('can switch from a contact to the current Area without a redundant travel failure', () => {
    setup();
    const doc = game.registry.stories.get('test:story:history_child')!;
    game.registry.load(makePack([game.registry.activeStories.get(child)!], [{ ...doc, nodes: doc.nodes.map(node => node.id === 'go'
      ? { ...node, type: 'moveToArea' as const, areaId: 'base:area:schale_main' } : node) }]));
    game.story.clickSend('Hoshino'); ctrl.render(); step();
    expect(ctrl.panelState.conversationVariantId).toBeNull();
    expect(document.body.textContent).toContain('prior-init');
    expect(document.body.textContent).toContain('onsite');
  });
});
