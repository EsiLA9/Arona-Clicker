// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { AronaClickerRuntime } from '../../../src/arona-clicker/runtime/runtime';
import { baseDatapack } from '../../../src/data/test-datapack';
import { emptyStoryAuthoring } from '../../../src/data-services/authoring/story-authoring';
import { characterStoryDirectoryId } from '../../../src/data-services/contracts/story-directory';
import { UIController } from '../../../src/ui/controller/controller';
import { createUIContext } from '../../../src/ui/runtime/context';
import { StoryDraftPersistence, STORY_EDITOR_STORAGE_KEY } from '../../../src/ui/story-editor/persistence';
import { createStoryEditorState } from '../../../src/ui/story-editor/model';
import '../../../src/ui/runtime/service-definitions';

it('browses and previews only the loaded slot, then preserves a draft when the source is unloaded', () => {
  localStorage.clear();
  const game = new AronaClickerRuntime();
  const storyId = 'author-source:story:test';
  const fixedId = 'source-fixed';
  const paneKey = 'author-source@1.0.0';
  const story = { id: storyId, name: '公开版本', startContext: { type: 'area' as const, areaId: baseDatapack.areas[0].id },
    stages: { s: { advance: 'input' as const } },
    nodes: [{ id: 'hello', type: 'talklet' as const, stageId: 's', content: { kind: 'narration' as const, text: '普通态文本' } }] };
  const pack = { ...game.getPackRecord(game.createEmptyEditingPack({ modId: 'scratch', versionId: '1.0.0' }).packRecordId!)!.datapack,
    modName: 'author-source', name: '来源验证', version: '1.0.0', stories: [story] };
  game.packManager.importFixed({ id: fixedId, sourceKind: 'zip', importedAt: 1, images: [],
    manifest: { modName: pack.modName, name: pack.name, version: pack.version, dependencies: ['base'] }, datapack: pack });
  const edit = game.packManager.createEditingPack(fixedId).pack.id;
  game.init([baseDatapack, pack]);
  const draftVersion = structuredClone(story);
  draftVersion.name = '编辑副本';
  draftVersion.nodes[0].content.text = '编辑态专属文本';
  const patch = { ...emptyStoryAuthoring(), stories: [draftVersion] };
  expect(game.saveStoryAuthoringToPack(fixedId, patch).ok).toBe(false);
  expect(game.applyStoryAuthoring(patch, edit).ok).toBe(false);
  expect(game.saveStoryAuthoringToPack(edit, patch)).toMatchObject({ ok: true });
  expect(game.registry.stories.get(storyId)?.name).toBe('公开版本');
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>('#app')!;
  const ctrl = new UIController(game, root);
  const click = (selector: string) => {
    const button = root.querySelector<HTMLButtonElement>(selector);
    expect(button, selector).not.toBeNull();
    button!.click();
    ctrl.flushUIUpdates();
  };
  const choose = (value: string) => {
    const select = root.querySelector<HTMLSelectElement>('[data-editor-source]')!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    ctrl.flushUIUpdates();
  };
  const chooseStory = (name: string) => {
    const option = [...root.querySelectorAll<HTMLButtonElement>('[data-editor-story]')].find(button => button.textContent?.includes(name));
    expect(option).toBeDefined();
    option!.click();
    ctrl.flushUIUpdates();
  };
  try {
    ctrl.storyEditor.open();
    const sources = () => [...root.querySelectorAll<HTMLOptionElement>('[data-editor-source] option')].map(option => option.value);
    const editingSource = { packRecordId: edit, modName: pack.modName, dependencies: ['base'] };
    expect(sources()).toContain(`pack:${fixedId}`);
    expect(sources()).not.toContain(`pack:${edit}`);
    expect(game.getStoryPackSources(editingSource).datapacks).toEqual([]);
    expect(game.createStoryAuthoringPreview(patch, { storyId }, editingSource)).toMatchObject({ ok: false, message: expect.stringContaining('未载入') });
    const sourceControl = root.querySelector<HTMLSelectElement>('[data-editor-source]')!;
    const staleOption = document.createElement('option');
    staleOption.value = `pack:${edit}`;
    sourceControl.add(staleOption);
    choose(`pack:${edit}`);
    expect(ctrl.storyEditor.state.sourceSelection).toBeUndefined();
    expect(sources()).not.toContain(`pack:${edit}`);
    chooseStory('公开版本');
    expect(root.querySelector<HTMLButtonElement>('[data-editor-action="save"]')?.disabled).toBe(true);
    click('[data-editor-key="quick-preview"]');
    expect(root.querySelector('[aria-label="试播正文"]')?.textContent).toContain('普通态文本');
    click('[data-authoring-action="close-preview"]');
    game.setPackSelection(paneKey, 'editing');
    ctrl.storyEditor.refresh(createUIContext(game));
    expect(sources()).not.toContain(`pack:${edit}`);
    expect(game.applyPackSelection().ok).toBe(true);
    ctrl.storyEditor.refresh(createUIContext(game));
    expect(sources()).toContain(`pack:${edit}`);
    expect(sources()).not.toContain(`pack:${fixedId}`);
    choose(`pack:${edit}`);
    chooseStory('编辑副本');
    expect(root.querySelector<HTMLButtonElement>('[data-authoring-action="pack"]')?.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-editor-action="save-to-runtime"]')?.disabled).toBe(false);
    click('[data-editor-key="quick-preview"]');
    expect(root.querySelector('[aria-label="试播正文"]')?.textContent).toContain('编辑态专属文本');
    click('[data-authoring-action="close-preview"]');

    const state = ctrl.storyEditor.state;
    const draft = state.drafts.find(item => item.document.id === storyId)!;
    draft.document = { ...draft.document, name: '已保存的草稿' };
    draft.dirty = true;
    expect(ctrl.storyEditor.save(true, false)).toBe(true);
    draft.document = { ...draft.document, name: '切换前的修改' };
    draft.dirty = true;
    game.setPackSelection(paneKey, 'fixed');
    expect(game.applyPackSelection().ok).toBe(true);
    ctrl.storyEditor.refresh(createUIContext(game));
    expect(sources()).not.toContain(`pack:${edit}`);
    expect(root.querySelector('[data-editor-key="source-status"]')?.textContent).toContain('暂时无法保存');
    expect(ctrl.storyEditor.save(true, false)).toBe(false);
    const saved = JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!);
    expect(saved.drafts[0].document.name).toBe('已保存的草稿');
    expect(saved.recoveryDrafts[0].document.name).toBe('切换前的修改');
    const reopened = createStoryEditorState();
    new StoryDraftPersistence().load(reopened);
    expect(reopened.storageBlocked).toBe(false);
    expect(reopened.drafts).toEqual([expect.objectContaining({ dirty: true, savedAt: saved.drafts[0].savedAt,
      document: expect.objectContaining({ name: '切换前的修改' }) })]);
    const classicUnavailablePreview = root.querySelector<HTMLButtonElement>('[data-editor-key="quick-preview"]')!;
    expect(classicUnavailablePreview.disabled).toBe(true);
    expect(classicUnavailablePreview.title).toContain('未载入');
    classicUnavailablePreview.click();
    expect(root.querySelector('[aria-label="试播正文"]')).toBeNull();
    game.setPackSelection(paneKey, 'editing');
    expect(game.applyPackSelection().ok).toBe(true);
    ctrl.storyEditor.refresh(createUIContext(game));
    click('[data-editor-action="recover-source"]');
    expect(ctrl.storyEditor.state.sourceSelection).toBe(`pack:${edit}`);
    expect(ctrl.storyEditor.save(true, false)).toBe(true);
    expect(game.registry.stories.get(storyId)?.name).toBe('编辑副本');

    click('[data-editor-workspace-action="mode"]');
    const original = root.querySelector<HTMLElement>('[data-editor-workspace-action="activate"][aria-pressed="true"]')!.dataset.editorInstance;
    click('[data-editor-workspace-action="duplicate"]');
    expect(root.querySelectorAll('[data-editor-workspace-action="activate"]')).toHaveLength(2);
    game.setPackSelection(paneKey, 'fixed');
    expect(game.applyPackSelection().ok).toBe(true);
    ctrl.storyEditor.refresh(createUIContext(game));
    click(`[data-editor-workspace-action="activate"][data-editor-instance="${original}"]`);
    expect(state.sourceSelection).toBe(`draft:${draft.draftId}`);
    expect(state.target?.id).toBe(storyId);
    expect(root.querySelector('[data-editor-workspace-status]')?.textContent).toContain('只读');
    expect(root.querySelector<HTMLButtonElement>('[data-editor-action="save"]')?.disabled).toBe(true);
    const unavailablePreview = root.querySelector<HTMLButtonElement>('[data-editor-key="quick-preview"]')!;
    expect(unavailablePreview.disabled).toBe(true);
    expect(unavailablePreview.title).toContain('未载入');
    unavailablePreview.click();
    expect(root.querySelector('[aria-label="试播正文"]')).toBeNull();
    game.setPackSelection(paneKey, 'editing');
    expect(game.applyPackSelection().ok).toBe(true);
    ctrl.storyEditor.refresh(createUIContext(game));
    click(`[data-editor-workspace-action="activate"][data-editor-instance="${original}"]`);
    expect(state.target?.id).toBe(storyId);
    expect(state.drafts).toContain(draft);
    expect(root.querySelector<HTMLButtonElement>('[data-editor-key="quick-preview"]')!.disabled).toBe(false);
  } finally {
    ctrl.destroy();
    game.storyService.dispose();
    game.stop();
    localStorage.clear();
  }
});

it('filters the advanced directory independently and opens a result in its selected pack scope', () => {
  localStorage.clear();
  const game = new AronaClickerRuntime();
  game.init([baseDatapack]);
  const packId = game.createEmptyEditingPack({ modId: 'sidebar-qa', versionId: '1.0.0' }).packRecordId!;
  const baseStory = baseDatapack.stories[0];
  const story = { id: 'sidebar-qa:story:scoped', name: '定向来源故事', startContext: baseStory.startContext, nodes: [], stages: {} };
  expect(game.saveStoryAuthoringToPack(packId, { ...emptyStoryAuthoring(), stories: [story] }).ok).toBe(true);
  game.packManager.setEnabled(packId, true);
  game.applyEnabledPacks();
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>('#app')!;
  const ctrl = new UIController(game, root);
  const button = (selector: string) => root.querySelector<HTMLButtonElement>(selector)!;
  const click = (selector: string) => { button(selector).click(); ctrl.flushUIUpdates(); };
  const chooseScope = (value: string) => {
    const select = root.querySelector<HTMLSelectElement>('[data-editor-source]')!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    ctrl.flushUIUpdates();
    expect(select.value).toBe(value);
  };
  const activeTab = () => button('[data-editor-workspace-action="activate"][aria-pressed="true"]').dataset.editorInstance;
  const state = ctrl.storyEditor.state;
  try {
    ctrl.storyEditor.open();
    click('[data-editor-workspace-action="mode"]');
    click(`[data-sidebar-story-id="${baseStory.id}"]`);
    const baseTab = activeTab();
    chooseScope(`pack:${packId}`);
    expect(state.target?.id).toBe(baseStory.id);
    expect(state.sourceSelection).toBeUndefined();
    expect(root.querySelector(`[data-sidebar-story-id="${baseStory.id}"]`)).toBeNull();
    expect(activeTab()).toBe(baseTab);
    click(`[data-sidebar-story-id="${story.id}"]`);
    const packTab = activeTab();
    expect(state.target?.id).toBe(story.id);
    expect(state.sourceSelection).toBe(`pack:${packId}`);
    expect(button('[data-editor-workspace-header] [data-editor-action="save"]').disabled).toBe(false);
    click(`[data-editor-workspace-action="activate"][data-editor-instance="${baseTab}"]`);
    expect(state.target?.id).toBe(baseStory.id);
    expect(button(`[data-sidebar-story-id="${baseStory.id}"]`).dataset.sidebarOpenSource).toBe('');
    chooseScope(`pack:${packId}`);
    click(`[data-sidebar-story-id="${story.id}"]`);
    expect(activeTab()).toBe(packTab);
    chooseScope('');
    expect(state.sourceSelection).toBe(`pack:${packId}`);
    expect(state.target?.id).toBe(story.id);
    expect(button(`[data-sidebar-story-id="${baseStory.id}"]`).dataset.sidebarOpenSource).toBe('');
  } finally {
    ctrl.destroy();
    game.storyService.dispose();
    game.stop();
    localStorage.clear();
  }
});

it('builds scoped Story sources from loaded snapshots and refuses to fill missing dependencies from the library', () => {
  const game = new AronaClickerRuntime();
  try {
    const add = (modName: string, dependencies: string[]) => {
      const template = game.packManager.getPack(game.createEmptyEditingPack({ modId: modName + '-template', versionId: '1.0.0' }).packRecordId!)!;
      const datapack = { ...template.datapack, modName, name: modName };
      game.packManager.importFixed({ id: modName, sourceKind: 'zip', importedAt: 1, images: [], datapack,
        manifest: { modName, name: modName, version: datapack.version, dependencies } });
      return datapack;
    };
    const dependency = add('story-support', ['base']);
    const root = add('story-root', ['story-support']);
    game.init([baseDatapack, root]);
    const source = { packRecordId: 'story-root', modName: 'story-root', dependencies: ['story-support'] };
    const missing = game.getStoryPackSources(source);
    expect(missing.datapacks.map(pack => pack.modName ?? 'base')).toEqual(['base', 'story-root']);
    expect(missing.issues).toEqual([expect.stringContaining('story-support')]);
    const record = game.packManager.getPack('story-root')!;
    game.packManager.savePack({ ...record, manifest: { ...record.manifest, dependencies: ['new-unloaded'] },
      datapack: { ...root, name: '包库中的新版本' }, contentDigest: undefined });
    game.init([baseDatapack, dependency, root]);
    const sources = game.getStoryPackSources(source);
    expect(sources.issues).toEqual([]);
    expect(sources.datapacks.map(pack => pack.modName ?? 'base')).toEqual(['base', 'story-support', 'story-root']);
    expect(sources.datapacks.at(-1)?.name).toBe('story-root');
  } finally {
    game.storyService.dispose();
    game.stop();
  }
});

it('creates hierarchy data in active editing packs and saves an Entry without changing its dependency Story', () => {
  localStorage.clear();
  const game = new AronaClickerRuntime();
  const theme = { id: 'entry-addon:themedesign:directory_demo', name: '目录测试主题', theme: { tokens: { primary: '#123456' } } };
  game.init([baseDatapack]);
  const packId = game.createEmptyEditingPack({ modId: 'entry-addon', versionId: '1.0.0' }).packRecordId!;
  const pack = game.packManager.getPack(packId)!;
  game.packManager.savePack({ ...pack, contentDigest: undefined, datapack: { ...pack.datapack, themeDesigns: [theme] } });
  const story = [...game.registry.stories.values()][0];
  const entryId = 'entry-addon:activestory:foreign_body';
  const entry = { id: entryId, storyId: story.id, openingTitle: '外部正文入口', availableInits: [],
    triggerCondition: { type: 'AND' as const, conditions: [] }, activation: { kind: 'active' as const } };
  const otherEntry = { ...entry, id: 'entry-addon:activestory:same_path',
    directoryPlacements: [{ initId: game.state.activeInit, hierarchyString: '对白/初遇' }] };
  const saved = game.saveStoryAuthoringToPack(packId, { ...emptyStoryAuthoring(), activeStories: [entry, otherEntry] });
  expect(saved, saved.message).toMatchObject({ ok: true });
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>('#app')!;
  const ui = new UIController(game, root);
  try {
    ui.storyEditor.open();
    const click = (selector: string) => {
      const button = root.querySelector<HTMLButtonElement>(selector);
      expect(button, selector).not.toBeNull();
      button!.click(); ui.flushUIUpdates();
    };
    const initId = game.state.activeInit;
    const note = (id: string) => root.querySelector(`.story-editor-left [data-directory-folder-id="${id}"]`)
      ?.parentElement?.querySelector('.story-editor-tree-note')?.textContent;
    const levelStatus = () => root.querySelector('[aria-label="层级状态"]')?.textContent;
    const displayStatus = () => root.querySelector('[aria-label="资料生效状态"]')?.textContent;
    click(`[data-directory-init-id="${initId}"][data-directory-folder-id=""]`);
    const chooseDirectoryPack = (action: string, modName: string) => {
      click(`[data-directory-create="${action}"]`);
      const choice = [...document.querySelectorAll<HTMLButtonElement>('.app-modal [data-modal-action^="pack:"]')]
        .find(button => button.textContent?.endsWith(` · ${modName}`));
      expect(choice).toBeDefined();
      choice!.click(); ui.flushUIUpdates();
    };
    expect(root.querySelector('[aria-label="资料操作"]')?.textContent).toContain('查看');
    const inactive = game.createEmptyEditingPack({ modId: 'inactive-layout', versionId: '1.0.0' }).packRecordId!;
    game.packManager.setEnabled(packId, true);
    click('[data-directory-create="new"]');
    expect(document.querySelector('.app-modal [data-modal-action^="pack:"]')).toBeNull();
    ui.modal.close();
    game.applyEnabledPacks();
    ui.storyEditor.requestRefresh(); ui.flushUIUpdates();
    expect(game.getRunningStoryPackId('entry-addon')).toBe(packId);
    expect(game.getRunningStoryPackId('inactive-layout')).not.toBe(inactive);
    click('[data-directory-create="new"]');
    expect([...document.querySelectorAll('.app-modal [data-modal-action^="pack:"]')].map(button => button.textContent)).toEqual([expect.stringContaining('entry-addon')]);
    const running = game.getRunningStoryPackId.bind(game);
    const deactivate = () => vi.spyOn(game, 'getRunningStoryPackId').mockImplementation(mod => mod === 'entry-addon' ? undefined : running(mod));
    const staleChoice = deactivate();
    document.querySelector<HTMLButtonElement>('.app-modal [data-modal-action^="pack:"]')!.click();
    expect(document.querySelector('[data-pack-picker-status]')?.textContent).toContain('已不在当前活跃');
    staleChoice.mockRestore();
    ui.modal.close();
    chooseDirectoryPack('new', 'entry-addon');
    expect(ui.storyEditor.state.directoryManagement?.location()).toEqual({ initId, directoryId: '' });
    expect(ui.storyEditor.state.sourceSelection).toBeUndefined();
    const setDirectoryField = (name: string, value: string) => {
      const field = root.querySelector<HTMLInputElement>(`[data-directory-field="${name}"]`)!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setDirectoryField('id', 'entries');
    setDirectoryField('title', '入口目录');
    ui.storyEditor.requestRefresh(); ui.flushUIUpdates();
    expect(root.querySelector<HTMLInputElement>('[data-directory-field="title"]')?.value).toBe('入口目录');
    const staleSave = deactivate();
    click('[data-directory-action="save"]');
    expect(root.querySelector('.story-editor-right [role="status"]')?.textContent).toContain('当前修改已保留');
    expect(game.getPackRecord(packId)?.datapack.storyDirectories ?? []).toHaveLength(0);
    staleSave.mockRestore();
    click('[data-directory-action="save"]');
    const directoryId = 'entry-addon:story-directory:entries';
    expect(note(directoryId)).toContain('手动');
    expect(levelStatus()).toContain('手动建立');
    expect(game.getPackRecord(packId)?.datapack.storyDirectories).toContainEqual(expect.objectContaining({ id: directoryId, title: '入口目录' }));
    expect(root.querySelector('.story-editor-center .workspace-heading')?.textContent).toContain('入口目录');
    const description = root.querySelector<HTMLTextAreaElement>('[data-directory-field="description"]')!;
    const preview = root.querySelector('[data-directory-preview]')!;
    const left = root.querySelector<HTMLElement>('.story-editor-left .workspace-column__body')!;
    const center = root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body')!;
    const right = root.querySelector<HTMLElement>('.story-editor-right .workspace-column__body')!;
    const folder = root.querySelector<HTMLElement>(`.story-editor-left [data-directory-folder-id="${directoryId}"]`)!;
    const initHeading = root.querySelector<HTMLButtonElement>(`.story-editor-left [data-directory-init-id="${initId}"][data-directory-folder-id=""]`)!.parentElement!;
    const toggle = initHeading.querySelector<HTMLButtonElement>('[data-sidebar-folder]')!;
    if (toggle.getAttribute('aria-expanded') === 'true') toggle.click();
    const overview = game.story.getStoryDirectory();
    expect(overview.some(row => row.id === directoryId)).toBe(false);
    description.focus();
    description.value = '卷首语\n<仅纯文本>';
    description.setSelectionRange(2, 5);
    description.dispatchEvent(new Event('input', { bubbles: true }));
    expect(preview.textContent).toContain('卷首语\n<仅纯文本>');
    expect(preview.textContent).toContain('未保存');
    expect(preview.innerHTML).toContain('&lt;仅纯文本&gt;');
    left.scrollTop = 16; center.scrollTop = 24; right.scrollTop = 36;
    click('[data-directory-action="save"]');
    expect(root.querySelector('[data-directory-field="description"]')).toBe(description);
    expect(document.activeElement).toBe(description);
    expect([description.selectionStart, description.selectionEnd]).toEqual([2, 5]);
    expect([left.scrollTop, center.scrollTop, right.scrollTop]).toEqual([16, 24, 36]);
    expect(folder.closest('ul[hidden]')).not.toBeNull();
    expect(preview.textContent).not.toContain('未保存');
    expect(game.getPackRecord(packId)?.datapack.storyDirectories?.find(row => row.id === directoryId)?.description).toBe(description.value);
    click('[data-editor-action="directory-back"]');
    expect(game.registry.storyDirectories.has(directoryId)).toBe(false);
    game.applyEnabledPacks();
    ui.storyEditor.refresh(createUIContext(game));
    const editorSource = root.querySelector<HTMLSelectElement>('[data-editor-source]')!;
    editorSource.value = `pack:${packId}`;
    editorSource.dispatchEvent(new Event('change', { bubbles: true }));
    ui.flushUIUpdates();
    click(`.story-editor-left [data-directory-folder-id="${directoryId}"]`);
    expect(root.querySelector('[data-directory-preview]')?.textContent).toContain('卷首语');
    click('[data-editor-action="directory-back"]');
    root.querySelector<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]')!.click();
    ui.flushUIUpdates();
    root.querySelector<HTMLButtonElement>(`[data-editor-entry="${entryId}"]`)!.click();
    ui.flushUIUpdates();
    click('[data-editor-directory="entry"]');
    expect(ui.modal.isOpen()).toBe(false);
    click(`.story-editor-left [data-directory-folder-id="${directoryId}"]`);
    click('[data-directory-action="place"]');
    const title = [...root.querySelectorAll<HTMLInputElement>('[data-value-path]')]
      .find(input => input.dataset.valuePath === JSON.stringify(['activeStories', 0, 'openingTitle']))!;
    expect(title.disabled).toBe(false);
    title.value = '新入口标题';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    ui.flushUIUpdates();
    const entryDescription = root.querySelector<HTMLTextAreaElement>('[data-public-description]')!;
    entryDescription.value = '入口简介\n第二行';
    entryDescription.dispatchEvent(new Event('input', { bubbles: true }));
    ui.flushUIUpdates();
    root.querySelector<HTMLButtonElement>('[data-authoring-action="pack"]')!.click();
    ui.flushUIUpdates();
    expect(game.getPackRecord(packId)?.datapack.activeStories[0].openingTitle, ui.storyEditor.state.error ?? undefined).toBe('新入口标题');
    expect(game.getPackRecord(packId)?.datapack.activeStories[0].directoryPlacements).toEqual([{ initId, directoryId }]);
    expect(game.getPackRecord(packId)?.datapack.activeStories[0].publicDescription).toBe('入口简介\n第二行');
    entryDescription.value = '　';
    entryDescription.dispatchEvent(new Event('input', { bubbles: true }));
    ui.flushUIUpdates();
    click('[data-authoring-action="pack"]');
    expect(game.getPackRecord(packId)?.datapack.activeStories[0]).not.toHaveProperty('publicDescription');
    click('[data-editor-directory="entry"]');
    setDirectoryField('placement-hierarchy', '对白/初遇');
    click('[data-directory-action="place-path"]');
    click('[data-authoring-action="pack"]');
    expect(game.getPackRecord(packId)?.datapack.activeStories[0].directoryPlacements).toEqual([{ initId, hierarchyString: '对白/初遇' }]);
    click('.story-editor-left [data-directory-folder-id="@hierarchy/对白/初遇"]');
    expect(note('@hierarchy/对白/初遇')).toBe('路径 · 无资料 · 内容×2');
    expect(levelStatus()).toContain('0 条 Story · 2 条 Entry');
    expect(root.querySelector('[data-directory-field="description"]')).toBeNull();
    chooseDirectoryPack('new-design', 'entry-addon');
    setDirectoryField('id', 'meeting');
    setDirectoryField('description', '初遇篇卷首语');
    click('[data-directory-action="save"]');
    expect(game.getPackRecord(packId)?.datapack.storyDirectories).toContainEqual(expect.objectContaining({
      id: 'entry-addon:story-hierarchy:meeting', initId, hierarchyString: '对白/初遇', description: '初遇篇卷首语',
    }));
    const design = '[data-column-action="directory-tab:design"]';
    const contents = '[data-column-action="directory-tab:contents"]';
    const centerBody = root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body')!;
    centerBody.scrollTop = 17;
    click(contents);
    expect(root.querySelector('[aria-label="内容概览"]')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('[aria-label="内容概览"] [data-editor-entry-target]')?.textContent).toContain('新入口标题');
    centerBody.scrollTop = 27;
    click(design);
    expect(centerBody.scrollTop).toBe(17);
    chooseDirectoryPack('new-design', 'entry-addon');
    setDirectoryField('id', 'alternate');
    setDirectoryField('title', '另一个封面');
    setDirectoryField('theme', theme.id);
    expect(root.querySelector('[data-story-directory-theme]')?.getAttribute('data-story-directory-theme')).toBe(theme.id);
    click('[data-directory-action="save"]');
    click('[data-directory-action="primary-design"]');
    expect(game.getPackRecord(packId)?.datapack.storyDirectories).toContainEqual(expect.objectContaining({
      id: 'entry-addon:story-hierarchy:alternate', themeDesignId: theme.id, primary: 'design',
    }));
    expect(note('@hierarchy/对白/初遇')).toBe('路径 · 资料×2 · 内容×2');
    expect(levelStatus()).toContain('手动资料2 份');
    expect(displayStatus()).toContain('当前生效路径默认显示');
    expect(displayStatus()).toContain('应用后另一个封面');
    click('[data-directory-action="candidate:entry-addon:story-hierarchy:meeting"]');
    expect(root.querySelector('[data-directory-preview]')?.textContent).toContain('初遇篇卷首语');
    expect(displayStatus()).toContain('应用后另一个封面');
    click('[data-directory-action="primary-path"]');
    expect(displayStatus()).toContain('应用后路径默认显示');
    click('[data-directory-action="candidate:entry-addon:story-hierarchy:alternate"]');
    expect(root.querySelector('[data-directory-field="description"]')).toBeNull();
    click('[data-directory-action="edit-design"]');
    setDirectoryField('description', '更新后的简介');
    click('[data-directory-action="save"]');
    expect(root.querySelector('[data-directory-preview]')?.textContent).toContain('更新后的简介');
    click('[data-directory-action="remove"]');
    expect(root.querySelector('.story-editor-right')?.textContent).toContain('删除「另一个封面」');
    click('[data-directory-action="confirm-remove"]');
    expect(game.getPackRecord(packId)?.datapack.storyDirectories?.some(row => row.id.endsWith(':alternate'))).toBe(false);
    expect(game.getPackRecord(packId)?.datapack.activeStories[0].directoryPlacements).toEqual([{ initId, hierarchyString: '对白/初遇' }]);
    click(contents);
    expect(centerBody.scrollTop).toBe(27);
    expect(game.getPackRecord(packId)?.datapack.stories).toHaveLength(0);
    expect(game.registry.stories.get(story.id)).toEqual(story);
    expect(game.registry.storyEntries.get(entryId)?.openingTitle).toBe('外部正文入口');

    const basePack = game.getPackCatalog().entries.find(pack => pack.modName === 'base' && pack.editingMode === 'normal')!;
    const rolePackId = game.createEditingPack(basePack.packRecordId ?? basePack.id).packRecordId!;
    game.setPackSelection(`base@${basePack.version}`, 'editing');
    expect(game.applyPackSelection().ok).toBe(true);
    const source = root.querySelector<HTMLSelectElement>('[data-editor-source]')!;
    source.value = '';
    source.dispatchEvent(new Event('change', { bubbles: true }));
    ui.flushUIUpdates();
    const roleGroup = `.story-editor-left [data-directory-init-id="${initId}"][data-directory-folder-id="@characters"]`;
    const roleToggle = root.querySelector(roleGroup)?.parentElement?.querySelector<HTMLButtonElement>('[data-sidebar-folder]')!;
    if (roleToggle.getAttribute('aria-expanded') !== 'true') { roleToggle.click(); ui.flushUIUpdates(); }
    const roleId = characterStoryDirectoryId(initId, baseDatapack.characters[0].id);
    click(`.story-editor-left [data-directory-folder-id="${roleId}"]`);
    expect(note(roleId)).toContain('自动 · 无资料');
    expect(levelStatus()).toContain('自动生成');
    chooseDirectoryPack('edit-design', 'base');
    expect(ui.storyEditor.state.directoryManagement?.location()).toEqual({ initId, directoryId: roleId });
    setDirectoryField('description', '角色资料');
    click('[data-directory-action="save"]');
    expect(game.getPackRecord(rolePackId)?.datapack.storyDirectories?.find(row => row.id === roleId)?.description).toBe('角色资料');
    expect(note(roleId)).toContain('自动 · 有资料');
    click('.story-editor-right [data-directory-action="remove"]');
    click('[data-directory-action="confirm-remove"]');
    expect(game.getPackRecord(rolePackId)?.datapack.storyDirectories?.some(row => row.id === roleId)).toBe(false);
    expect(ui.storyEditor.state.directoryManagement?.location()).toEqual({ initId, directoryId: roleId });
  } finally {
    ui.destroy();
    game.storyService.dispose();
    game.stop();
    localStorage.clear();
  }
});

it('creates, moves, sorts and safely removes directories in the selected editing pack', () => {
  localStorage.clear();
  const game = new AronaClickerRuntime();
  game.init([baseDatapack]);
  const packId = game.createEmptyEditingPack({ modId: 'tree-qa', versionId: '1.0.0' }).packRecordId!;
  const initId = game.state.activeInit;
  const id = (name: string) => `tree-qa:story-directory:${name}`;
  expect(game.saveStoryDirectoryToPack(packId, [
    { id: id('a'), initId, title: '甲卷' }, { id: id('b'), initId, title: '乙卷' },
  ]).ok).toBe(true);
  game.packManager.setEnabled(packId, true);
  game.applyEnabledPacks();
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>('#app')!;
  const ui = new UIController(game, root);
  const click = (selector: string) => {
    const button = root.querySelector<HTMLButtonElement>(selector);
    expect(button?.disabled, selector).toBe(false);
    button!.click(); ui.flushUIUpdates();
  };
  const action = (name: string) => click(`[data-directory-action="${name}"]`);
  const manage = (directoryId: string) => click(`.story-editor-left [data-directory-init-id="${initId}"][data-directory-folder-id="${directoryId}"]`);
  const set = (key: string, value: string) => {
    const field = root.querySelector<HTMLInputElement>(`[data-directory-field="${key}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    ui.flushUIUpdates();
    return field;
  };
  const definitions = () => game.getPackRecord(packId)!.datapack.storyDirectories!;
  const centerFolders = () => [...root.querySelectorAll<HTMLButtonElement>('.story-editor-center [data-editor-key="directory-contents"] > li > .story-editor-tree-heading > [data-editor-directory]')]
    .map(button => button.dataset.directoryFolderId).filter(id => id?.startsWith('tree-qa:'));
  try {
    ui.storyEditor.open();
    const source = root.querySelector<HTMLSelectElement>('[data-editor-source]')!;
    source.value = `pack:${packId}`;
    source.dispatchEvent(new Event('change', { bubbles: true }));
    ui.flushUIUpdates();
    manage(id('a'));
    click('[data-directory-create="new"]');
    document.querySelector<HTMLButtonElement>('.app-modal [data-modal-action^="pack:"]')!.click();
    ui.flushUIUpdates();
    set('id', 'leaf'); set('title', '新章节');
    action('save');
    expect(definitions().find(row => row.id === id('leaf'))?.parentId).toBe(id('a'));
    const selected = root.querySelector<HTMLButtonElement>(`.story-editor-left [data-directory-folder-id="${id('leaf')}"]`);
    expect(selected?.getAttribute('aria-pressed')).toBe('true');
    expect(selected?.closest('ul[hidden]')).toBeNull();

    manage(id('a'));
    action('move');
    expect(root.querySelector(`[data-directory-action="parent:${id('leaf')}"]`)).toBeNull();
    const search = set('move-query', '乙卷');
    expect(root.querySelector('[data-directory-field="move-query"]')).toBe(search);
    action(`parent:${id('b')}`);
    expect(root.querySelector('.story-editor-right')?.textContent).toContain('乙卷 / 甲卷');
    action('confirm-move');
    expect(definitions().find(row => row.id === id('a'))?.parentId).toBe(id('b'));
    expect(definitions().find(row => row.id === id('leaf'))?.parentId).toBe(id('a'));
    action('remove');
    expect(root.querySelector<HTMLButtonElement>('[data-directory-action="confirm-remove"]')?.disabled).toBe(true);
    click(`[data-directory-reference-kind="directory"][data-directory-reference-id="${id('leaf')}"]`);
    action('remove'); action('confirm-remove');
    expect(definitions().some(row => row.id === id('leaf'))).toBe(false);
    expect(root.querySelector('.story-editor-center .workspace-heading')?.textContent).toContain('甲卷');

    action('move'); action('parent:'); action('confirm-move');
    manage('');
    action('sort'); action(`up:${id('b')}`);
    expect(centerFolders()).toEqual([id('b'), id('a')]);
    expect(definitions().every(row => row.order === undefined)).toBe(true);
    action('save-order');
    expect(definitions().find(row => row.id === id('b'))!.order).toBeLessThan(definitions().find(row => row.id === id('a'))!.order!);

    manage(id('a'));
    action('edit-design');
    set('title', '待保存标题');
    expect(game.saveStoryDirectoryToPack(packId, { ...definitions().find(row => row.id === id('b'))!, title: '外部修改' }).ok).toBe(true);
    action('save');
    expect(root.querySelector<HTMLInputElement>('[data-directory-field="title"]')?.value).toBe('待保存标题');
    expect(root.querySelector('.story-editor-right [role="status"]')?.textContent).toContain('当前修改已保留');
    expect(definitions().find(row => row.id === id('a'))?.title).toBe('甲卷');
  } finally {
    ui.destroy();
    game.storyService.dispose();
    game.stop();
    localStorage.clear();
  }
});
