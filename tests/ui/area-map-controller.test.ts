// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import { bindEvents } from '../../src/ui/controller-events';
import { loadAreaMapDemoPack } from '../../src/ui/development/area-map-demo-pack';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';

const area = (id: string) => `area-map-demo:area:${id}`;
const map = (id: string) => `area-map-demo:area-map:${id}`;
let game: GameInstance, ctrl: UIController, root: HTMLElement;
const click = (selector: string) => {
  const el = root.querySelector(selector);
  expect(el, selector).not.toBeNull();
  el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  ctrl.flushUIUpdates();
};
const settle = async () => { await Promise.resolve(); await Promise.resolve(); ctrl.flushUIUpdates(); };

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>'; localStorage.clear();
  root = document.querySelector('#app')!;
  game = new GameInstance(); game.init([(await loadAreaMapDemoPack()).datapack]);
  ctrl = new UIController(game, root); ctrl.started = true; bindEvents(ctrl); ctrl.render();
});
afterEach(() => { ctrl.destroy(); game.dispose(); vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });

describe('AreaMap real Controller flow', () => {
  test('mall halls unlock without visits, rooms require exploration and visited rooms offer fast return', async () => {
    click('[data-area-map-open]'); click('[data-area-map-node="mall"]');
    click('[data-area-map-node="hall2"]');
    expect(root.querySelector<HTMLButtonElement>('[data-area-map-action="travel"]')!.disabled).toBe(true);
    click('[data-area-map-node="mall_entrance"]'); click('[data-area-map-action="travel"]'); await settle();
    expect(game.state.currentAreaId).toBe(area('mall_entrance'));
    click('[data-area-map-open]'); click('[data-area-map-node="hall2"]');
    expect(root.querySelector('[data-area-map-detail]')?.textContent).toContain('尚未到访');
    expect(root.querySelector('[data-area-map-action="travel"]')?.textContent).toBe('乘交通前往');
    click('[data-area-map-action="travel"]'); await settle();
    expect(game.state.currentAreaId).toBe(area('hall2'));
    click('[data-area-map-open]'); click('[data-area-map-node="floor"]'); click('[data-area-map-node="shop"]');
    expect(root.querySelector<HTMLButtonElement>('[data-area-map-action="travel"]')!.disabled).toBe(true);
    click('[data-area-map-node="hall1"]'); click('[data-area-map-action="travel"]'); await settle();
    click('[data-area-map-open]'); click('[data-area-map-node="floor"]'); click('[data-area-map-node="corridor"]');
    click('[data-area-map-action="travel"]'); await settle();
    click('[data-area-map-open]'); click('[data-area-map-node="shop"]'); click('[data-area-map-action="travel"]'); await settle();
    click('[data-area-map-open]'); click('[data-area-map-node="hall1"]');
    expect(root.querySelector('[data-area-map-action="travel"]')?.textContent).toBe('快速返回');
    click('[data-area-map-action="travel"]'); await settle();
    expect(game.state.currentAreaId).toBe(area('hall1'));
  });
  test('Enter selects inspect nodes and Space opens referenced maps without travel', () => {
    click('[data-area-map-open]');
    root.querySelector('[data-area-map-node="note"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    ctrl.flushUIUpdates();
    expect(ctrl.panelState.areaMapSession?.selectedNodeId).toBe('note');
    root.querySelector('[data-area-map-node="portal"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    ctrl.flushUIUpdates();
    expect(ctrl.panelState.areaMapSession?.currentMapId).toBe(map('b'));
    expect(game.state.currentAreaId).toBe(area('a'));
  });
  test('Hero/map entry admission updates in place when Story ends or the Map association changes', () => {
    const button = root.querySelector<HTMLButtonElement>('[data-area-map-open]')!;
    const hero = root.querySelector<HTMLButtonElement>('[data-area-workspace-open]')!;
    const render = vi.spyOn(ctrl, 'render');
    game.story.startStory('area-map-demo:activestory:arrival', 'active'); ctrl.refreshLight();
    expect(button.disabled).toBe(true); expect(hero.disabled).toBe(true);
    game.story.clearAllCurrentStories(); ctrl.refreshLight();
    expect(button.disabled).toBe(false); expect(hero.disabled).toBe(false);
    expect(root.querySelector('[data-area-map-open]')).toBe(button);
    expect(root.querySelector('[data-area-workspace-open]')).toBe(hero);
    const current = game.registry.areas.get(area('a'))!;
    current.navigationMapId = undefined; ctrl.refreshLight();
    expect(root.querySelector('[data-area-map-open]')).toBeNull();
    current.navigationMapId = map('a'); ctrl.refreshLight();
    expect(root.querySelector('[data-area-map-open]')).not.toBeNull();
    expect(render).not.toHaveBeenCalled();
  });
  test('closing restores the prior chat reading position and explicit Hero navigation discards map history', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2000);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    for (let index = 0; index < 12; index++) ctrl.pushChat({ kind: 'reward', text: `历史记录 ${index}` });
    ctrl.render();
    root.querySelector<HTMLElement>('.chat-stream')!.scrollTop = 320;
    click('[data-area-map-open]'); click('[data-area-map-action="close"]');
    expect(root.querySelector<HTMLElement>('.chat-stream')!.scrollTop).toBe(320);
    click('[data-area-map-open]'); click('[data-area-map-node="portal"]');
    click('[data-area-workspace-open]');
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
    expect(ctrl.panelState.workspaceNavigation?.current.kind).toBe('area');
    click('[data-area-workspace-leave]');
    expect(ctrl.panelState.workspaceNavigation?.current.kind).toBe('game');
  });

  test('real passive leaveArea:false permits browsing but blocks travel, and a protected owner blocks entry', () => {
    game.registry.load({ ...mergeFragments([]), stories: [{ id: 'area-map-demo:story:passive', name: '闲聊', talklets: [{ text: '暂时留在这里。' }] }],
      passiveStories: [
        { id: 'area-map-demo:passivestory:safe', storyId: 'area-map-demo:story:passive', type: 'passive', repeatable: true, weight: 1, availableInits: ['area-map-demo:init:demo'], triggerCondition: { type: 'AND', conditions: [] }, leaveArea: false },
        { id: 'area-map-demo:passivestory:owner', storyId: 'area-map-demo:story:passive', type: 'passive', repeatable: true, weight: 1, availableInits: ['area-map-demo:init:demo'], triggerCondition: { type: 'AND', conditions: [] }, owner: 'student', blocksInteraction: true },
      ] });
    expect(game.story.startStory('area-map-demo:passivestory:safe', 'passive').success).toBe(true);
    ctrl.render(); click('[data-area-map-open]'); click('[data-area-map-node="plaza"]');
    expect(ctrl.panelState.areaMapSession).toBeDefined();
    expect(root.querySelector<HTMLButtonElement>('[data-area-map-action="travel"]')?.disabled).toBe(true);
    click('[data-area-map-action="close"]'); game.story.clearAllCurrentStories();
    expect(game.story.startStory('area-map-demo:passivestory:owner', 'passive', 'student').success).toBe(true);
    ctrl.panelState.conversationVariantId = 'student'; ctrl.render();
    click('[data-area-map-open]');
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
  });
  test('browse/select/cycle/back/current/close never travels and preserves DOM and source game location', () => {
    ctrl.panelState.rightTab = 'enh'; ctrl.render();
    const state = JSON.stringify(game.state);
    const travel = vi.spyOn(ctrl.commands, 'travelToArea');
    click('[data-area-map-open]');
    const frame = root.querySelector('[data-workspace-frame="area-map"]');
    const svg = root.querySelector('[data-area-map-viewport]');
    const scroll = root.querySelector('[data-area-map-detail-scroll]');
    const note = root.querySelector('[data-area-map-node="note"]');
    click('[data-area-map-node="note"]');
    expect(root.querySelector('[data-area-map-node="note"]')).toBe(note);
    expect(root.querySelector('[data-area-map-action="travel"]')?.hasAttribute('hidden')).toBe(true);
    const camera = { scale: 1.7, x: 77, y: 88 };
    ctrl.panelState.areaMapSession!.viewports.set(map('a'), camera);
    for (const target of ['b', 'c', 'a']) {
      click('[data-area-map-node="portal"]');
      expect(ctrl.panelState.areaMapSession?.currentMapId).toBe(map(target));
      expect(game.state.currentAreaId).toBe(area('a'));
    }
    expect(ctrl.panelState.areaMapSession?.history.map(h => h.mapId)).toEqual([map('a'), map('b'), map('c')]);
    click('[data-area-map-action="back"]');
    expect(ctrl.panelState.areaMapSession?.currentMapId).toBe(map('c'));
    click('[data-area-map-action="current"]');
    expect(ctrl.panelState.areaMapSession?.history).toEqual([]);
    expect(ctrl.panelState.areaMapSession?.viewports.get(map('a'))).toEqual(camera);
    expect(root.querySelector('[data-workspace-frame="area-map"]')).toBe(frame);
    expect(root.querySelector('[data-area-map-viewport]')).toBe(svg);
    expect(root.querySelector('[data-area-map-detail-scroll]')).toBe(scroll);
    click('[data-area-map-action="close"]');
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
    expect(ctrl.panelState.rightTab).toBe('enh');
    expect(document.activeElement?.hasAttribute('data-area-map-open')).toBe(true);
    expect(JSON.stringify(game.state)).toBe(state);
    expect(travel).not.toHaveBeenCalled();
  });

  test('command failure retains selection/camera/history and feedback without full render', () => {
    click('[data-area-map-open]'); click('[data-area-map-node="plaza"]');
    const session = ctrl.panelState.areaMapSession!;
    const before = root.querySelector('[data-area-map-viewport]');
    const render = vi.spyOn(ctrl, 'render');
    vi.spyOn(ctrl.commands, 'travelToArea').mockReturnValue({ success: false, areaId: area('b'), error: 'StoryBlocked' });
    click('[data-area-map-action="travel"]');
    expect(ctrl.panelState.areaMapSession).toBe(session);
    expect(session.selectedNodeId).toBe('plaza');
    expect(root.querySelector('[data-area-map-viewport]')).toBe(before);
    expect(root.querySelector('[data-area-map-feedback]')?.textContent).toContain('剧情');
    expect(render).not.toHaveBeenCalled();
    expect(game.state.currentAreaId).toBe(area('a'));
  });

  test('success resists nested duplicate submission, exits once and queues one notice before arrival Story', async () => {
    click('[data-area-map-open]'); click('[data-area-map-node="plaza"]');
    const button = root.querySelector('[data-area-map-action="travel"]')!;
    const travel = vi.spyOn(ctrl.commands, 'travelToArea').mockImplementation(id => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return game.travelToArea(id);
    });
    click('[data-area-map-action="travel"]'); await settle();
    expect(travel).toHaveBeenCalledTimes(1);
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
    expect(game.state.currentAreaId).toBe(area('b'));
    expect(game.story.getCurrentStoryView()?.storyId).toBe('area-map-demo:activestory:arrival');
    const texts = ctrl.panelState.chatEntries.map(entry => 'text' in entry ? entry.text : '');
    expect(texts.filter(text => text.includes('移动到了 中央广场'))).toHaveLength(1);
    expect(texts.findIndex(text => text.includes('移动到了'))).toBeLessThan(texts.findIndex(text => text.includes('你穿过街道')));
  });

  test('stale/changed node action refuses travel and clears obsolete selection; Tick reconciles locally', () => {
    click('[data-area-map-open]'); click('[data-area-map-node="plaza"]');
    const travel = vi.spyOn(ctrl.commands, 'travelToArea');
    const svg = root.querySelector('[data-area-map-viewport]');
    game.registry.areaMaps.get(map('a'))!.nodes.find(n => n.id === 'plaza')!.action = { kind: 'inspect' };
    click('[data-area-map-action="travel"]');
    expect(travel).not.toHaveBeenCalled();
    expect(ctrl.panelState.areaMapSession?.selectedNodeId).toBeNull();
    ctrl.refreshLight(); ctrl.flushUIUpdates();
    expect(root.querySelector('[data-area-map-viewport]')).toBe(svg);
  });

  test('external travel, protected Story and runtime load release the map session', async () => {
    click('[data-area-map-open]');
    game.travelToArea(area('b')); await settle();
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
    expect(root.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
    game.story.clearAllCurrentStories();
    ctrl.render(); click('[data-area-map-open]');
    const save = game.save(); game.load(save);
    ctrl.refreshLight(); await settle();
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
    ctrl.render(); click('[data-area-map-open]');
    game.story.startStory('area-map-demo:activestory:arrival', 'active', null, { force: true });
    ctrl.refreshLight(); await settle();
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
    expect(game.story.isBlockingInteraction()).toBe(true);
  });

  test('confirmation blocks entry; map removal falls back to current entry or closes', async () => {
    ctrl.modal.open({ title: '确认', body: '待确认', footer: '<button class="modal-close">取消</button>' });
    click('[data-area-map-open]');
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
    ctrl.modal.close(); click('[data-area-map-open]'); click('[data-area-map-node="portal"]');
    const current = game.registry.areaMaps.get(map('b'))!;
    current.revealTriggers = [{ reveal: 'existence', condition: { target: 'resource', key: 'permit', comparator: '>=', value: 1 } }];
    ctrl.refreshLight(); ctrl.flushUIUpdates();
    expect(ctrl.panelState.areaMapSession?.currentMapId).toBe(map('a'));
    game.registry.areaMaps.get(map('a'))!.revealTriggers = current.revealTriggers;
    ctrl.refreshLight(); await settle();
    expect(ctrl.panelState.areaMapSession).toBeUndefined();
  });
});
