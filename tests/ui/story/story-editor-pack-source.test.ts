// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { AronaClickerRuntime } from '../../../src/arona-clicker/runtime/runtime';
import { baseDatapack } from '../../../src/data/test-datapack';
import { emptyStoryAuthoring } from '../../../src/data-services/authoring/story-authoring';
import { UIController } from '../../../src/ui/controller/controller';
import { createUIContext } from '../../../src/ui/runtime/context';
import { StoryDraftPersistence, STORY_EDITOR_STORAGE_KEY } from '../../../src/ui/story-editor/persistence';
import { createStoryEditorState } from '../../../src/ui/story-editor/model';
import '../../../src/ui/runtime/service-definitions';

it('browses and previews both slots, then preserves a draft when the running source switches', () => {
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
    chooseStory('公开版本');
    expect(root.querySelector<HTMLButtonElement>('[data-editor-action="save"]')?.disabled).toBe(true);
    click('[data-editor-key="quick-preview"]');
    expect(root.querySelector('[aria-label="试播正文"]')?.textContent).toContain('普通态文本');
    click('[data-authoring-action="close-preview"]');
    choose(`pack:${edit}`);
    chooseStory('编辑副本');
    expect(root.querySelector<HTMLButtonElement>('[data-authoring-action="pack"]')?.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-editor-action="save-to-runtime"]')?.disabled).toBe(true);
    click('[data-editor-key="quick-preview"]');
    expect(root.querySelector('[aria-label="试播正文"]')?.textContent).toContain('编辑态专属文本');
    click('[data-authoring-action="close-preview"]');

    game.setPackSelection(paneKey, 'editing');
    expect(game.getRunningStoryPackId(pack.modName)).toBe(fixedId);
    expect(game.applyPackSelection().ok).toBe(true);
    choose('');
    chooseStory('编辑副本');
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
    click('[data-editor-key="quick-preview"]');
    expect(root.querySelector('[aria-label="试播正文"]')?.textContent).toContain('编辑态专属文本');
    click('[data-authoring-action="close-preview"]');
    click('[data-editor-action="recover-source"]');
    expect(ctrl.storyEditor.state.sourceSelection).toBe(`pack:${edit}`);
    expect(ctrl.storyEditor.save(true, false)).toBe(true);
    expect(game.registry.stories.get(storyId)?.name).toBe('公开版本');
  } finally {
    ctrl.destroy();
    game.storyService.dispose();
    game.stop();
    localStorage.clear();
  }
});

it('shows an offline Entry owned by its pack and saves it without changing its dependency Story', () => {
  localStorage.clear();
  const game = new AronaClickerRuntime();
  game.init([baseDatapack]);
  const packId = game.createEmptyEditingPack({ modId: 'entry-addon', versionId: '1.0.0' }).packRecordId!;
  const story = [...game.registry.stories.values()][0];
  const entryId = 'entry-addon:activestory:foreign_body';
  const entry = { id: entryId, storyId: story.id, openingTitle: '外部正文入口', availableInits: [],
    triggerCondition: { type: 'AND' as const, conditions: [] }, activation: { kind: 'active' as const } };
  const saved = game.saveStoryAuthoringToPack(packId, { ...emptyStoryAuthoring(), activeStories: [entry] });
  expect(saved, saved.message).toMatchObject({ ok: true });
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>('#app')!;
  const ui = new UIController(game, root);
  try {
    ui.storyEditor.open();
    const source = root.querySelector<HTMLSelectElement>('[data-editor-source]')!;
    source.value = `pack:${packId}`;
    source.dispatchEvent(new Event('change', { bubbles: true }));
    ui.flushUIUpdates();
    root.querySelector<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]')!.click();
    ui.flushUIUpdates();
    root.querySelector<HTMLButtonElement>(`[data-editor-entry="${entryId}"]`)!.click();
    ui.flushUIUpdates();
    const title = [...root.querySelectorAll<HTMLInputElement>('[data-value-path]')]
      .find(input => input.dataset.valuePath === JSON.stringify(['activeStories', 0, 'openingTitle']))!;
    expect(title.disabled).toBe(false);
    title.value = '新入口标题';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    ui.flushUIUpdates();
    root.querySelector<HTMLButtonElement>('[data-authoring-action="pack"]')!.click();
    ui.flushUIUpdates();
    expect(game.getPackRecord(packId)?.datapack.activeStories[0].openingTitle).toBe('新入口标题');
    expect(game.getPackRecord(packId)?.datapack.stories).toHaveLength(0);
    expect(game.registry.stories.get(story.id)).toBe(story);
    expect(game.registry.storyEntries.has(entryId)).toBe(false);
  } finally {
    ui.destroy();
    game.storyService.dispose();
    game.stop();
    localStorage.clear();
  }
});
