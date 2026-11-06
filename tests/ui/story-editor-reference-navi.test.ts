// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft, type StoryDraft } from '../../src/ui/story-editor/model';
import { emptyStoryAuthoring } from '../../src/data-services/authoring/story-authoring';
import { storyReferenceOptions } from '../../src/ui/story-editor/property-options';
import { createUIContext } from '../../src/ui/runtime/context';
import { prepareReferenceNavi, referenceChoices } from '../../src/ui/story-editor/reference-navi';
import '../../src/ui/runtime/service-definitions';

describe('Story content reference Navi', () => {
  let game: GameInstance, ctrl: UIController, root: HTMLElement, draft: StoryDraft;
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const element = document.querySelector<T>(selector); expect(element, selector).not.toBeNull(); return element!;
  };
  const refresh = () => { ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates(); };
  const selectNode = (id: string) => { find(`[data-editor-node="${id}"]`).click(); ctrl.flushUIUpdates(); };
  const property = (path: (string | number)[]) => [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-story-property-path]')].find(input => input.dataset.storyPropertyPath === JSON.stringify(path))!;
  const open = (field: HTMLElement) => { field.closest('[data-reference-control]')!.querySelector<HTMLButtonElement>('[data-reference-navi]')!.click(); };
  const choose = (id: string) => {
    const row = [...document.querySelectorAll<HTMLElement>('[data-reference-search]')].find(row => row.querySelector('small')?.textContent === id);
    expect(row, id).toBeDefined(); row!.querySelector<HTMLButtonElement>('[data-modal-action^="reference-select:"]')!.click(); ctrl.flushUIUpdates();
  };
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>'; root = find('#app');
    game = new GameInstance(); game.init([structuredClone(baseDatapack)]); ctrl = new UIController(game, root);
    ctrl.render(); ctrl.storyEditor.open(); find('[data-editor-action="new"]').click(); ctrl.flushUIUpdates();
    draft = currentDraft(ctrl.storyEditor.state)!;
    draft.document = { ...draft.document, startContext: { type: 'area', areaId: [...game.registry.areas.keys()][0] }, nodes: [
      { id: 'transfer', type: 'transfer', transfer: { mode: 'insert', storyId: 'missing:story:old' } },
      { id: 'talk', type: 'talklet', stageId: 'one', content: { kind: 'talk', text: '正文' } },
      { id: 'move', type: 'moveToArea', areaId: [...game.registry.areas.keys()][0] },
      { id: 'resource', type: 'operation', action: { kind: 'state', effects: [{ op: 'setResource', resourceId: [...game.registry.resourceDisplays.keys()][0], amount: 2 }] } },
    ] };
    const authoring = emptyStoryAuthoring();
    authoring.activeStories.push({ id: 'local:activestory:navi', type: 'active', storyId: 'local:story:navi', availableInits: [''], triggerCondition: { type: 'AND', conditions: [] } });
    ctrl.storyEditor.state.drafts.push({ ...structuredClone(draft), draftId: 'navi-child', sourceId: null,
      document: { ...structuredClone(draft.document), id: 'local:story:navi', name: '未应用的目标故事' }, authoring });
    refresh();
  });
  afterEach(() => { ctrl.modal.close(); ctrl.destroy(); game.stop(); vi.restoreAllMocks(); localStorage.clear(); });

  it('searches by name or ID, selects a draft Story and preserves field, scroll, history and playback', () => {
    selectNode('transfer'); const field = property(['transfer','storyId']);
    const body = find('.story-editor-right .workspace-column__body'); body.scrollTop = 73;
    const history = ctrl.storyEditor.state.visitIndex, running = game.storyService.getCurrentStoryId();
    const full = vi.spyOn(ctrl, 'render'); open(field);
    const search = find<HTMLInputElement>('[data-reference-query]'), row = find('[data-reference-search]');
    search.value = 'NOT-FOUND'; search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(find('[data-reference-empty]').hidden).toBe(false);
    search.value = '未应用的目标'; search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(find('[data-reference-search]') === row).toBe(true);
    choose('local:story:navi');
    expect(property(['transfer','storyId']) === field).toBe(true); expect(document.activeElement === field).toBe(true);
    expect(body.scrollTop).toBe(73); expect(ctrl.storyEditor.state.visitIndex).toBe(history);
    expect(game.storyService.getCurrentStoryId()).toBe(running); expect(full).not.toHaveBeenCalled();
    expect(draft.document.nodes[0]).toMatchObject({ transfer: { storyId: 'local:story:navi' } });
    open(field); find<HTMLButtonElement>('.story-editor-reference-navi .modal-close').click();
    expect(document.activeElement === field).toBe(true);
    expect(draft.document.nodes[0]).toMatchObject({ transfer: { storyId: 'local:story:navi' } });
  });

  it('keeps source navigation separate from selection and closes on leaving', () => {
    selectNode('transfer'); open(property(['transfer','storyId']));
    const row = [...document.querySelectorAll<HTMLElement>('[data-reference-search]')].find(row => row.textContent?.includes('local:story:navi'))!;
    row.querySelector<HTMLButtonElement>('[data-modal-action^="reference-source:"]')!.click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target).toEqual({ kind: 'story', id: 'local:story:navi' });
    expect(draft.document.nodes[0]).toMatchObject({ transfer: { storyId: 'missing:story:old' } });
    selectNode('move'); open(property(['areaId']));
    expect(ctrl.storyEditor.beforeLeave()).toBe(true); expect(ctrl.modal.isOpen()).toBe(false);
  });

  it('fills image, area and nested resource fields through their existing edit routes', () => {
    selectNode('talk'); const avatar = property(['presentation','avatar']);
    const pic = [...game.registry.pics.keys()][0]; open(avatar); choose(pic);
    expect(draft.document.nodes[1]).toMatchObject({ presentation: { avatar: pic } });
    expect(property(['presentation','avatar']) === avatar).toBe(true);
    selectNode('move'); const area = [...game.registry.areas.keys()].at(-1)!;
    open(property(['areaId'])); choose(area); expect(draft.document.nodes[2]).toMatchObject({ areaId: area });
    selectNode('resource'); const resource = [...game.registry.resourceDisplays.keys()].at(-1)!;
    open(property(['action','effects',0,'resourceId'])); choose(resource);
    expect(draft.document.nodes[3]).toMatchObject({ action: { effects: [{ resourceId: resource, amount: 2 }] } });
  });

  it('supports Entry structured references and Init list elements without losing input identity', () => {
    const state = ctrl.storyEditor.state; state.target = { kind: 'entry', id: 'local:activestory:navi' }; state.selectedNodeId = null; refresh();
    const field = [...root.querySelectorAll<HTMLInputElement>('[data-value-input]')].find(input => input.dataset.valuePath === JSON.stringify(['activeStories',0,'availableInits',0]))!;
    expect(field).toBeDefined(); const init = [...game.registry.inits.keys()][0]; open(field); choose(init);
    expect(state.drafts.find(row => row.draftId === 'navi-child')!.authoring!.activeStories[0].availableInits).toEqual([init]);
    expect(field.isConnected).toBe(true); expect(document.activeElement === field).toBe(true);
    const story = [...root.querySelectorAll<HTMLInputElement>('[data-value-input]')].find(input => input.dataset.valuePath === JSON.stringify(['activeStories',0,'storyId']))!;
    open(story); choose(draft.document.id);
    expect(state.drafts.find(row => row.draftId === 'navi-child')!.authoring!.activeStories[0].storyId).toBe(draft.document.id);
  });

  it('refuses detached or blocked fields and leaves fixed enums without Navi buttons', () => {
    selectNode('move'); open(property(['areaId'])); draft.document.nodes.splice(2,1); refresh();
    choose([...game.registry.areas.keys()][0]); expect(ctrl.modal.isOpen()).toBe(false);
    expect(draft.document.nodes.some(node => node.id === 'move')).toBe(false);
    selectNode('talk'); const sender = find<HTMLSelectElement>('[data-editor-key="sender"]');
    expect(sender.closest('[data-reference-control]')).not.toBeNull();
    expect(property(['presentation','side']).closest('[data-reference-control]')).toBeNull();
    ctrl.storyEditor.state.storageBlocked = true; refresh();
    expect(property(['presentation','avatar']).closest('[data-reference-control]')!.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    expect(root.querySelector('[data-story-branch-field="kind"]')?.closest('[data-reference-control]')).toBeNull();
  });

  it('deduplicates choices, disables missing references and decorates empty catalogues only once', () => {
    const ctx = createUIContext(game);
    expect(storyReferenceOptions(ctx,'activeEntry',ctrl.storyEditor.state).some(row => row.value === 'local:activestory:navi')).toBe(true);
    const container = document.createElement('div'); container.innerHTML = '<label>空目录<select data-editor-key="empty" data-story-reference="funclet"><option value="">选择…</option></select></label>';
    prepareReferenceNavi(container); prepareReferenceNavi(container);
    expect(container.querySelectorAll('[data-reference-navi]')).toHaveLength(1);
    const field = container.querySelector('select')!;
    expect(referenceChoices(field)).toEqual([]);
    field.innerHTML += '<option value="old" data-reference-missing>缺失引用</option><option value="same">旧名称</option><option value="same">新名称</option>';
    expect(referenceChoices(field)).toEqual([{value:'old',label:'缺失引用',disabled:true},{value:'same',label:'新名称',disabled:false}]);
  });
});
