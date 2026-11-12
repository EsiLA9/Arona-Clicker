// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { makePack } from '../../engine/story/story-test-fixtures';
import { UIController } from '../../../src/ui/controller/controller';
import { bindEvents } from '../../../src/ui/controller/controller-events';

const parent = 'test:passivestory:ui_parent', child = 'test:activestory:ui_child';
const area = 'base:area:schale_rooftop';
let game: GameInstance, ctrl: UIController;
function setup(invitation = false, travelChild = false) {
  game = new GameInstance();
  game.init([baseDatapack, makePack([
    { id: parent, storyId: 'test:story:ui_parent', owner: 'Hoshino', availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, kizuna: { entryId: child, ...(invitation ? { areaId: area } : {}) }, activation: { kind: 'random' as const, weight: 1, repeatable: false } },
    { id: child, storyId: 'test:story:ui_child', availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, activation: { kind: 'active' as const } },
  ], [
    { id: 'test:story:ui_parent', name: 'Parent', startContext: { type: 'chara', characterId: 'Hoshino' }, stages: { s: { advance: 'input' } }, nodes: [
      { id: 'card', type: 'click', stageId: 's', interaction: { kind: 'kizunaCard' } },
      { id: 'tail', type: 'talklet', stageId: 's', content: { kind: 'talk', speaker: '星野', text: '原聊天后文' } },
    ] },
    { id: 'test:story:ui_child', name: 'Child', startContext: { type: 'area', areaId: area }, stages: { s: { advance: 'input' } }, nodes: travelChild ? [
      { id: 'travel', type: 'click', stageId: 's', interaction: { kind: 'button', text: '返回主厅' } },
  { id: "travel-effect-1", type: 'operation', action: { kind: 'travel', areaId: 'base:area:schale_main' } },
      { id: 'body', type: 'talklet', stageId: 's', content: { kind: 'narration', text: '独立子故事正文' } },
    ] : [
      { id: 'body', type: 'talklet', stageId: 's', content: { kind: 'narration', text: '独立子故事正文' } },
    ] },
  ])]);
  game.story.clearAllCurrentStories();
  game.mutations.acquireCharacter('Hoshino', 'story');
  document.body.innerHTML = '<div id="app"></div>';
  ctrl = new UIController(game, document.querySelector('#app')!);
  ctrl.started = true;
  bindEvents(ctrl);
  if (travelChild) expect(game.travelToArea(area).success).toBe(true);
  game.story.startStory(parent, 'passive', 'Hoshino');
  ctrl.openContactsWorkspace('Hoshino');
  ctrl.render();
}
describe('story continuation surfaces', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { ctrl?.destroy(); game?.dispose(); vi.useRealTimers(); localStorage.clear(); });
  it('plays the child on its own surface, then resumes the original conversation on return', () => {
    setup();
    document.querySelector<HTMLElement>('[data-story-card-token]')!.click();
    document.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click();
    ctrl.render();
    expect(ctrl.panelState.storyReplay?.entryId).toBe(child);
    expect(ctrl.panelState.storyReplay?.entries.some(x => x.text === '独立子故事正文')).toBe(true);
    expect(ctrl.panelState.studentChats.Hoshino?.some(x => x.text === '独立子故事正文')).toBe(false);
    document.querySelector<HTMLButtonElement>('[data-send]')!.click();
    expect(game.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('card');
    ctrl.openContactsWorkspace('Hoshino'); ctrl.render();
    expect(ctrl.panelState.storyReplay).toBeUndefined();
    expect(game.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('tail');
    vi.advanceTimersByTime(5000); ctrl.refreshChatPanel();
    expect(document.body.textContent).toContain('原聊天后文');
  });
  it('accepts the bound Area invitation and rebuilds the live channel after loading', () => {
    setup(true);
    expect(document.querySelector('.yuzu-kizuna-heart')).not.toBeNull();
    expect(document.querySelector('[data-story-card-token]')).toBeNull();
    expect(document.body.textContent).toContain('前往夏莱天台接续故事');
    game.travelToArea(area);
    ctrl.navigateToService('game'); ctrl.panelState.conversationVariantId = null; ctrl.render();
    const button = document.querySelector<HTMLButtonElement>('[data-area-story-quick-enter]')!;
    expect(button.dataset.areaStoryQuickEnter).toMatch(/^continuation:/);
    button.click(); ctrl.render();
    const previousRun = ctrl.panelState.storyReplay!.runId;
    game.load(game.save()); ctrl.render();
    expect(ctrl.panelState.storyReplay!.runId).not.toBe(previousRun);
    expect(ctrl.panelState.storyReplay!.runId).toBe(game.story.getActiveStoryChannel()!.runId);
    document.querySelector<HTMLButtonElement>('[data-send]')!.click();
    expect(game.story.saveCursors().child).toBeUndefined();
    ctrl.openContactsWorkspace('Hoshino'); ctrl.render();
    expect(game.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('tail');
  });
  it('restores a changed Chara scene into a fresh UI route without advancing the parent', () => {
    setup();
    const doc = game.registry.stories.get('test:story:ui_child')!;
    game.registry.load(makePack([game.registry.activeStories.get(child)!], [{ ...doc, nodes: [
      { id: 'move', type: 'moveToCharaspace', characterId: 'Serika' }, ...doc.nodes,
    ] }]));
    game.mutations.acquireCharacter('Serika', 'story');
    document.querySelector<HTMLElement>('[data-story-card-token]')!.click();
    document.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click();
    const saved = game.save();
    game.load(saved);
    ctrl.panelState.storyReplay = undefined;
    ctrl.panelState.workspace = undefined;
    ctrl.panelState.workspaceNavigation = { current: { kind: 'game' } };
    ctrl.panelState.conversationVariantId = null;
    ctrl.render();
    expect(ctrl.panelState.workspace).toMatchObject({ type: 'contacts', conversationVariantId: 'Serika' });
    expect(ctrl.panelState.storyReplay).toMatchObject({ owner: 'Serika' });
    expect(document.body.textContent).toContain('独立子故事正文');
    expect(game.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('card');
    ctrl.render(); ctrl.refreshChatPanel();
    expect(game.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('card');
  });
  it('updates the active Story scene and theme context immediately after a Story travel action', () => {
    setup(false, true);
    const travelEvents: unknown[] = [];
    game.eventBus.on('storyContextMoved', event => { if (event.type === 'storyContextMoved') travelEvents.push(event); });
    document.querySelector<HTMLElement>('[data-story-card-token]')!.click();
    document.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click();
    ctrl.render();
    expect(ctrl.panelState.storyReplay?.context).toEqual({ type: 'area', areaId: area });
    const replayId = ctrl.panelState.storyReplay!.replayId;
    document.querySelector<HTMLButtonElement>('[data-send]')!.click();
    ctrl.render();
    expect(game.getView().currentAreaId).toBe('base:area:schale_main');
    expect(travelEvents).toContainEqual(expect.objectContaining({ context: { type: 'area', areaId: 'base:area:schale_main' }, replayId }));
    expect(ctrl.panelState.storyReplay?.context).toEqual({ type: 'area', areaId: 'base:area:schale_main' });
  });
});
