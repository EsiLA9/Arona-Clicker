// @vitest-environment happy-dom
import { createStoryForTest } from './story-editor-test-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { UIController } from '../../../src/ui/controller/controller';
import { createStoryEditorState, currentDraft, type StoryDraft } from '../../../src/ui/story-editor/model';
import { StoryDraftPersistence } from '../../../src/ui/story-editor/persistence';
import { emptyStoryAuthoring } from '../../../src/data-services/authoring/story-authoring';
import { storyReferenceOptions } from '../../../src/ui/story-editor/property-options';
import { createUIContext } from '../../../src/ui/runtime/context';
import { prepareReferenceNavi, referenceChoices } from '../../../src/ui/story-editor/reference-navi';
import { getContentPolicy } from '../../../src/data-services/authoring/content-policy';
import { bindRuntimeDatapackEditorActions } from '../../../src/ui/runtime-editor/actions';
import { renderRuntimeEditorFields, runtimeEditorFieldViews } from '../../../src/ui/runtime-editor/form';
import { clearSubDialogs } from '../../../src/ui/runtime-editor/subdialog';
import '../../../src/ui/runtime/service-definitions';

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
    const picker = document.querySelector('.condition-reference-picker');
    if (picker) {
      find<HTMLButtonElement>(`[data-condition-picker-choice="${id}"]`).click();
      find<HTMLButtonElement>('[data-condition-subeditor="confirm"]').click();
      ctrl.flushUIUpdates();
      return;
    }
    const row = [...document.querySelectorAll<HTMLElement>('[data-reference-search]')].find(row => row.querySelector('small')?.textContent === id);
    expect(row, id).toBeDefined(); row!.querySelector<HTMLButtonElement>('[data-modal-action^="reference-select:"]')!.click(); ctrl.flushUIUpdates();
  };
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>'; root = find('#app');
    game = new GameInstance(); game.init([structuredClone(baseDatapack)]); ctrl = new UIController(game, root);
    ctrl.render(); ctrl.storyEditor.open(); createStoryForTest(game,ctrl); ctrl.flushUIUpdates();
    draft = currentDraft(ctrl.storyEditor.state)!;
    draft.document = { ...draft.document, startContext: { type: 'area', areaId: [...game.registry.areas.keys()][0] }, nodes: [
      { id: 'transfer', type: 'transfer', transfer: { mode: 'insert', storyId: 'missing:story:old' } },
      { id: 'talk', type: 'talklet', stageId: 'one', content: { kind: 'talk', text: '正文' } },
      { id: 'move', type: 'moveToArea', areaId: [...game.registry.areas.keys()][0] },
      { id: 'resource', type: 'operation', action: { kind: 'state', effects: [{ op: 'setResource', resourceId: [...game.registry.resourceDisplays.keys()][0], amount: 2 }] } },
    ] };
    const authoring = emptyStoryAuthoring();
    authoring.activeStories.push({ id: 'local:activestory:navi', storyId: 'local:story:navi', availableInits: [''], triggerCondition: { type: 'AND', conditions: [] }, activation: { kind: 'active' as const } });
    ctrl.storyEditor.state.drafts.push({ ...structuredClone(draft), draftId: 'navi-child', sourceId: null,
      document: { ...structuredClone(draft.document), id: 'local:story:navi', name: '未应用的目标故事' }, authoring });
    refresh();
  });
  afterEach(() => { clearSubDialogs(); ctrl.modal.close(); ctrl.destroy(); game.stop(); vi.restoreAllMocks(); localStorage.clear(); });

  it('searches by name or ID, selects a draft Story and preserves field, scroll, history and playback', () => {
    selectNode('transfer'); const field = property(['transfer','storyId']);
    const jump = field.closest('[data-reference-control]')!.querySelector<HTMLButtonElement>('[data-reference-jump]')!;
    expect(jump.disabled).toBe(true);
    const body = find('.story-editor-right .workspace-column__body'); body.scrollTop = 73;
    const history = ctrl.storyEditor.state.visitIndex, running = game.storyService.getCurrentStoryId();
    const full = vi.spyOn(ctrl, 'render'); open(field);
    const search = find<HTMLInputElement>('[data-condition-subfield="search"]');
    find<HTMLButtonElement>('[data-condition-picker-filter="unknown"]').click();
    search.value = 'NOT-FOUND'; search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(find('.condition-reference-cards').textContent).toContain('没有匹配');
    search.value = '未应用的目标'; search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(find('[data-condition-subfield="search"]') === search).toBe(true);
    find<HTMLButtonElement>('[data-condition-picker-choice="local:story:navi"]').click();
    expect(draft.document.nodes[0]).toMatchObject({ transfer: { storyId: 'missing:story:old' } });
    choose('local:story:navi');
    expect(property(['transfer','storyId']) === field).toBe(true); expect(document.activeElement === field).toBe(true);
    expect(body.scrollTop).toBe(73); expect(ctrl.storyEditor.state.visitIndex).toBe(history);
    expect(game.storyService.getCurrentStoryId()).toBe(running); expect(full).not.toHaveBeenCalled();
    expect(draft.document.nodes[0]).toMatchObject({ transfer: { storyId: 'local:story:navi' } });
    expect(jump.disabled).toBe(false);
    open(field); find<HTMLButtonElement>('.story-editor-reference-navi .modal-close').click();
    expect(document.activeElement === field).toBe(true);
    expect(draft.document.nodes[0]).toMatchObject({ transfer: { storyId: 'local:story:navi' } });
  });

  it('keeps source navigation separate from selection and closes on leaving', () => {
    selectNode('transfer'); open(property(['transfer','storyId']));
    find<HTMLButtonElement>('[data-condition-picker-choice="local:story:navi"]').click();
    find<HTMLButtonElement>('[data-condition-subeditor="source"]').click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target).toEqual({ kind: 'story', id: 'local:story:navi' });
    expect(draft.document.nodes[0]).toMatchObject({ transfer: { storyId: 'missing:story:old' } });
    selectNode('move'); open(property(['areaId']));
    expect(ctrl.storyEditor.beforeLeave()).toBe(true); expect(ctrl.modal.isOpen()).toBe(false);
  });

  it('updates draft grouping, filters the Story directory, and preserves the optional value through saves', () => {
    const init = [...game.registry.inits.values()][0];
    const grouping = find<HTMLSelectElement>('[data-editor-field="story-init"]');
    const filter = find<HTMLSelectElement>('[data-editor-story-init-filter]');
    const change = (field: HTMLSelectElement, value: string) => {
      field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); ctrl.flushUIUpdates();
    };
    const row = () => root.querySelector(`[data-editor-story="${draft.draftId}"]`);
    expect(grouping.selectedOptions[0].textContent).toBe('其他');
    change(filter, 'other');
    expect(row()).not.toBeNull();
    change(grouping, init.id);
    expect(row()).toBeNull();
    change(filter, init.id);
    expect(row()?.closest('[data-editor-key="story-list"]')?.textContent).toContain(init.name);
    draft.document = { ...draft.document, nodes: [{ id: 'line', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: '正文' } }],
      stages: { body: { advance: 'auto' } } };
    const saved = ctrl.storyEditor.saveToRuntime();
    expect(saved, ctrl.storyEditor.state.error ?? undefined).toBe(true);
    expect(game.registry.stories.get(draft.document.id)?.initId).toBe(init.id);
    const restored = createStoryEditorState();
    new StoryDraftPersistence().load(restored);
    expect(restored.drafts.find(row => row.draftId === draft.draftId)?.document.initId).toBe(init.id);
    ctrl.flushUIUpdates();
    change(grouping, '');
    expect(draft.document).not.toHaveProperty('initId');
    expect(game.registry.stories.get(draft.document.id)?.initId).toBe(init.id);
    change(filter, 'other');
    expect(row()).not.toBeNull();
  });

  it('groups Init starting Entry choices by their linked Story while retaining the Entry ID', () => {
    const entry = [...game.registry.activeStories.values()][0];
    const story = game.registry.stories.get(entry.storyId)!;
    const initId = [...game.registry.inits.keys()][0];
    expect(game.saveStoryDefinition({ ...story, initId }).ok).toBe(true);
    const ctx = createUIContext(game), policy = getContentPolicy('inits')!;
    const scope = document.createElement('div');
    scope.innerHTML = renderRuntimeEditorFields(ctx, runtimeEditorFieldViews(ctx, policy, { startStoryId: '' })
      .filter(view => view.key === 'startStoryId'), [], policy);
    document.body.append(scope);
    bindRuntimeDatapackEditorActions(ctrl, scope);
    find<HTMLButtonElement>('[data-runtime-story-reference="startStoryId"]').click();
    find<HTMLButtonElement>(`[data-condition-picker-filter="${initId}"]`).click();
    expect(find(`[data-condition-picker-choice="${entry.id}"] strong`).textContent).toContain('主动入口');
    choose(entry.id);
    const field = find<HTMLSelectElement>('[data-runtime-editor-field="startStoryId"]');
    expect(field.value).toBe(entry.id);
    expect(document.activeElement).toBe(field);
  });

  it('fills image, area and nested resource fields through their existing edit routes', () => {
    selectNode('talk'); root.querySelector<HTMLButtonElement>('[data-column-action="story-editor-designer:appearance"]')!.click(); ctrl.flushUIUpdates(); const avatar = property(['appearance','presentation','avatar']);
    const pic = [...game.registry.pics.keys()][0]; open(avatar); choose(pic);
    expect(draft.document.nodes[1]).toMatchObject({ appearance: { presentation: { avatar: pic } } });
    expect(property(['appearance','presentation','avatar']) === avatar).toBe(true);
    selectNode('move'); const area = [...game.registry.areas.keys()].at(-1)!;
    open(property(['areaId'])); choose(area); expect(draft.document.nodes[2]).toMatchObject({ areaId: area });
    selectNode('resource'); const resource = [...game.registry.resourceDisplays.keys()].at(-1)!;
    open(property(['action','effects',0,'resourceId'])); choose(resource);
    expect(draft.document.nodes[3]).toMatchObject({ action: { effects: [{ resourceId: resource, amount: 2 }] } });
  });

  it('supports Entry structured references and Init list elements without losing input identity', () => {
    const state = ctrl.storyEditor.state; state.target = { kind: 'entry', id: 'local:activestory:navi' }; state.selectedNodeId = null;
    state.entryEditorTab = 'gates'; refresh();
    const field = [...root.querySelectorAll<HTMLInputElement>('[data-value-input]')].find(input => input.dataset.valuePath === JSON.stringify(['activeStories',0,'availableInits',0]))!;
    expect(field).toBeDefined(); const init = [...game.registry.inits.keys()][0]; open(field); choose(init);
    expect(state.drafts.find(row => row.draftId === 'navi-child')!.authoring!.activeStories[0].availableInits).toEqual([init]);
    expect(field.isConnected).toBe(true); expect(document.activeElement === field).toBe(true);
    state.entryEditorTab = 'basic'; refresh();
    const story = [...root.querySelectorAll<HTMLInputElement>('[data-value-input]')].find(input => input.dataset.valuePath === JSON.stringify(['activeStories',0,'storyId']))!;
    open(story); choose(draft.document.id);
    expect(state.drafts.find(row => row.draftId === 'navi-child')!.authoring!.activeStories[0].storyId).toBe(draft.document.id);
  });

  it('jumps from the current linked Story field even when the Entry is read-only', () => {
    const state = ctrl.storyEditor.state;
    const entryId = 'local:activestory:navi';
    const entryDraft = state.drafts.find(row => row.draftId === 'navi-child')!;
    entryDraft.authoring!.activeStories[0].availableInits = [];
    refresh();
    find<HTMLButtonElement>(`[data-editor-entry="${entryId}"]`).click(); ctrl.flushUIUpdates();
    const field = find<HTMLInputElement>('[data-value-scope="$authoring"][data-story-reference="story"]');
    const jump = field.closest('[data-reference-control]')!.querySelector<HTMLButtonElement>('[data-reference-jump]')!;
    for (const [value, disabled] of [['', true], ['missing:story:absent', true], [draft.document.id, false]] as const) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true })); ctrl.flushUIUpdates();
      expect(jump.isConnected).toBe(true);
      expect(jump.disabled).toBe(disabled);
    }
    state.readOnlyReason = '当前内容只读';
    refresh();
    expect(field.disabled).toBe(true);
    expect(field.closest('[data-reference-control]')!.querySelector<HTMLButtonElement>('[data-reference-navi]')!.disabled).toBe(true);
    expect(jump.disabled).toBe(false);
    jump.click(); ctrl.flushUIUpdates();
    expect(ctrl.modal.isOpen()).toBe(false);
    expect(state.target).toEqual({ kind: 'story', id: draft.document.id });
    expect(entryDraft.authoring!.activeStories[0].storyId).toBe(draft.document.id);
    find<HTMLButtonElement>('[data-editor-action="history-back"]').click(); ctrl.flushUIUpdates();
    expect(state.target).toEqual({ kind: 'entry', id: entryId });
  });

  it('refuses detached or blocked fields and leaves fixed enums without Navi buttons', () => {
    selectNode('move'); open(property(['areaId'])); draft.document.nodes.splice(2,1); refresh();
    choose([...game.registry.areas.keys()][0]); expect(ctrl.modal.isOpen()).toBe(false);
    expect(draft.document.nodes.some(node => node.id === 'move')).toBe(false);
    selectNode('talk'); const sender = find<HTMLSelectElement>('[data-editor-key="sender"]');
    expect(sender.closest('[data-reference-control]')).not.toBeNull();
    expect(property(['appearance','presentation','side']).closest('[data-reference-control]')).toBeNull();
    ctrl.storyEditor.state.storageBlocked = true; refresh();
    expect(property(['appearance','presentation','avatar']).closest('[data-reference-control]')!.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    expect(root.querySelector('[data-story-branch-field="kind"]')?.closest('[data-reference-control]')).toBeNull();
  });

  it('deduplicates choices, disables missing references and decorates empty catalogues only once', () => {
    const ctx = createUIContext(game);
    expect(storyReferenceOptions(ctx,'activeEntry',ctrl.storyEditor.state).some(row => row.value === 'local:activestory:navi')).toBe(true);
    const container = document.createElement('div'); container.innerHTML = '<label>空目录<select data-editor-key="empty" data-story-reference="funclet"><option value="">选择…</option></select></label>';
    prepareReferenceNavi(container, () => false); prepareReferenceNavi(container, () => false);
    expect(container.querySelectorAll('[data-reference-navi]')).toHaveLength(1);
    expect(container.querySelector('[data-reference-jump]')).toBeNull();
    const field = container.querySelector('select')!;
    expect(referenceChoices(field)).toEqual([]);
    field.innerHTML += '<option value="old" data-reference-missing>缺失引用</option><option value="same">旧名称</option><option value="same">新名称</option>';
    expect(referenceChoices(field)).toEqual([{value:'old',label:'缺失引用',disabled:true},{value:'same',label:'新名称',disabled:false}]);
  });
});
