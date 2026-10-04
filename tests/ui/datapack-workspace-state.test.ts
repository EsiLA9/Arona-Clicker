import { describe, expect, it } from 'vitest';
import type { PackCatalogEntry, RuntimeModDraft } from '../../src/arona-clicker/contracts';
import {
  createDatapackWorkspaceState,
  hasDatapackWorkspaceChanges,
  moveDatapackDraftToColumn,
  moveDatapackDraft,
  moveDatapackPaneDraft,
  resetDatapackWorkspaceState,
  selectDatapackPack,
  setDatapackValidation,
  synchronizeDatapackWorkspaceState,
  toggleDatapackDraftEnabled,
  setDatapackWorkspaceMode,
  swapDatapackDraftIntoEnabledSequence,
} from '../../src/ui/workspace/datapack-workspace-state';
import {
  clearRuntimeEditorSpot,
  createRuntimeDatapackEditorState,
  hydrateRuntimeEditor,
  prepareRuntimeEditorForNewSpot,
  removeRuntimeEditorSpot,
  resolveRuntimeEditorSpot,
  setRuntimeEditorError,
  setRuntimeEditorSpot,
  setRuntimeEditorSpotSuspended,
  selectRuntimeEditorSpot,
  toRuntimeModDraft,
  updateRuntimeEditorFields,
} from '../../src/ui/runtime-editor/state';

const entry = (id: string, overrides: Partial<PackCatalogEntry> = {}): PackCatalogEntry => ({
  id,
  modName: id,
  name: id,
  version: '1.0.0',
  dependencies: [],
  sourceKind: 'zip',
  importedAt: 0,
  enabled: false,
  ...overrides,
});

const spot = {
  idName: 'mine',
  areaId: 'area-1',
  name: 'Mine',
  description: 'A mine',
  purchaseOptions: [{ id: 'free', costs: [] }],
};

describe('Datapack Workspace 状态边界', () => {
  it('从正式配置创建独立草案，并保留首选可操作包', () => {
    const entries = [
      entry('core', { modName: 'base', sourceKind: 'bundle', enabled: true }),
      entry('demo', { enabled: false }),
    ];
    const state = createDatapackWorkspaceState(entries, { enabledIds: ['core'], order: ['core', 'demo'] });

    expect(state.selectedPackId).toBe('demo');
    expect(state.draftEnabledIds).toEqual(['core']);
    expect(state.draftOrder).toEqual(['core', 'demo']);
    expect(state.validation).toBeNull();
    expect(state.lastResult).toBeNull();
    expect(hasDatapackWorkspaceChanges(state, { enabledIds: ['core'], order: ['core', 'demo'] })).toBe(false);
  });

  it('模式切换保存在工作区状态，草案重置时保留当前模式', () => {
    const entries = [entry('core', { sourceKind: 'builtin' }), entry('demo')];
    const state = createDatapackWorkspaceState(entries);
    setDatapackWorkspaceMode(state, 'development');
    const reset = resetDatapackWorkspaceState(entries, undefined, state);
    expect(reset.mode).toBe('development');
  });

  it('同步包库变化时只清理未知草案项，并追加新包', () => {
    const state = createDatapackWorkspaceState([entry('a'), entry('b')], { enabledIds: ['a'], order: ['b', 'a'] });
    state.selectedPackId = 'removed';

    synchronizeDatapackWorkspaceState(state, [entry('a'), entry('c')]);

    expect(state.draftOrder).toEqual(['a', 'c']);
    expect(state.draftEnabledIds).toEqual(['a']);
    expect(state.selectedPackId).toBe('a');
  });

  it('统一处理选中、切换、校验与重置，且重置保留当前工作区位置', () => {
    const entries = [entry('core', { sourceKind: 'builtin', enabled: true }), entry('demo')];
    const state = createDatapackWorkspaceState(entries);
    state.section = 'issues';
    selectDatapackPack(state, 'demo');
    toggleDatapackDraftEnabled(state, 'demo');
    setDatapackValidation(state, { ok: false, errors: ['bad'], warnings: ['warn'] });

    const reset = resetDatapackWorkspaceState(entries, undefined, state);

    expect(state.section).toBe('all');
    expect(state.selectedPackId).toBe('demo');
    expect(state.draftEnabledIds).toContain('demo');
    expect(reset.section).toBe('all');
    expect(reset.selectedPackId).toBe('demo');
    expect(reset.draftEnabledIds).toEqual(['core']);
    expect(reset.validation).toBeNull();
  });

  it('移动草案时拒绝越过不可排序包，并在合法移动后清理反馈', () => {
    const entries = [
      entry('core', { sourceKind: 'builtin' }),
      entry('a'),
      entry('b'),
    ];
    const state = createDatapackWorkspaceState(entries, { enabledIds: [], order: ['core', 'a', 'b'] });
    state.validation = { ok: false, errors: ['bad'], warnings: [] };
    state.lastResult = { ok: false, message: 'bad' };

    expect(moveDatapackDraft(state, entries, 'a', -1)).toBe('blocked');
    expect(state.draftOrder).toEqual(['core', 'a', 'b']);
    expect(moveDatapackDraft(state, entries, 'b', -1)).toBe('moved');
    expect(state.draftOrder).toEqual(['core', 'b', 'a']);
    expect(state.validation).toBeNull();
    expect(state.lastResult).toBeNull();
  });

  it('跨启用列表拖移时更新启用状态与序列顺序，并阻止 ModName 冲突', () => {
    const entries = [
      entry('core', { modName: 'base', sourceKind: 'builtin', enabled: true, capabilities: { required: true, removable: false, reorderable: false, enableable: false } }),
      entry('same-active', { modName: 'same', enabled: true }),
      entry('candidate', { modName: 'same' }),
      entry('other', { modName: 'other' }),
    ];
    const state = createDatapackWorkspaceState(entries, { enabledIds: ['core', 'same-active'], order: ['core', 'same-active', 'candidate', 'other'] });
    expect(moveDatapackDraftToColumn(state, entries, 'candidate', true, 1)).toBe('blocked');
    expect(moveDatapackDraftToColumn(state, entries, 'other', true, 1)).toBe('moved');
    expect(state.draftOrder).toEqual(['core', 'other', 'same-active', 'candidate']);
    expect(state.draftEnabledIds).toEqual(['core', 'same-active', 'other']);
    expect(moveDatapackDraftToColumn(state, entries, 'same-active', false, 0)).toBe('moved');
    expect(state.draftEnabledIds).toEqual(['core', 'other']);
    expect(state.draftOrder).toEqual(['core', 'other', 'same-active', 'candidate']);
  });

  it('确认交换同名记录时沿用活跃项与拖动项原有位置', () => {
    const entries = [
      entry('core', { modName: 'base', sourceKind: 'builtin', enabled: true, capabilities: { required: true, removable: false, reorderable: false, enableable: false } }),
      entry('first', { modName: 'first', enabled: true }),
      entry('same-active', { modName: 'same', enabled: true }),
      entry('candidate', { modName: 'same', editingMode: 'editing' }),
      entry('other', { modName: 'other' }),
    ];
    const state = createDatapackWorkspaceState(entries, {
      enabledIds: ['core', 'first', 'same-active'],
      order: ['core', 'first', 'same-active', 'candidate', 'other'],
    });

    expect(swapDatapackDraftIntoEnabledSequence(state, entries, 'candidate', 'same-active')).toBe('swapped');
    expect(state.draftEnabledIds).toEqual(['core', 'first', 'candidate']);
    expect(state.draftOrder).toEqual(['core', 'first', 'candidate', 'same-active', 'other']);
    expect(swapDatapackDraftIntoEnabledSequence(state, entries, 'candidate', 'same-active')).toBe('blocked');
  });

  it('base 交换可往返，并保留启用位置与未启用位置', () => {
    const entries = [
      entry('base-bundle', { modName: 'base', sourceKind: 'bundle', enabled: true, capabilities: { required: true, removable: false, reorderable: false, enableable: false } }),
      entry('other-active', { modName: 'other', enabled: true }),
      entry('base-editing', { modName: 'base', sourceKind: 'editing', editingMode: 'editing', capabilities: { required: true, removable: false, reorderable: true, enableable: true } }),
    ];
    const state = createDatapackWorkspaceState(entries, {
      enabledIds: ['base-bundle', 'other-active'],
      order: ['base-bundle', 'other-active', 'base-editing'],
    });

    expect(swapDatapackDraftIntoEnabledSequence(state, entries, 'base-editing', 'base-bundle')).toBe('swapped');
    expect(state.draftEnabledIds).toEqual(['base-editing', 'other-active']);
    expect(state.draftOrder).toEqual(['base-editing', 'other-active', 'base-bundle']);

    expect(swapDatapackDraftIntoEnabledSequence(state, entries, 'base-bundle', 'base-editing')).toBe('swapped');
    expect(state.draftEnabledIds).toEqual(['base-bundle', 'other-active']);
    expect(state.draftOrder).toEqual(['base-bundle', 'other-active', 'base-editing']);
  });

  it('无同名冲突时允许编辑态记录进入启用序列', () => {
    const entries = [
      entry('core', { modName: 'base', sourceKind: 'builtin', enabled: true, capabilities: { required: true, removable: false, reorderable: false, enableable: false } }),
      entry('editable', { modName: 'editable', editingMode: 'editing' }),
    ];
    const state = createDatapackWorkspaceState(entries, { enabledIds: ['core'], order: ['core', 'editable'] });
    expect(moveDatapackDraftToColumn(state, entries, 'editable', true, 1)).toBe('moved');
    expect(state.draftEnabledIds).toEqual(['core', 'editable']);
  });

  it('移动 Pane 时将普通态与编辑态作为一个连续块移动', () => {
    const entries = [
      entry('core', { modName: 'core', sourceKind: 'builtin' }),
      entry('demo-fixed', { modName: 'demo' }),
      entry('other', { modName: 'other' }),
      entry('demo-editing', { modName: 'demo', sourceKind: 'editing', editingMode: 'editing' }),
    ];
    const state = createDatapackWorkspaceState(entries, { enabledIds: [], order: entries.map(item => item.id) });

    expect(moveDatapackPaneDraft(state, entries, 'demo@1.0.0', 1)).toBe('moved');
    expect(state.draftOrder).toEqual(['core', 'other', 'demo-fixed', 'demo-editing']);
    expect(moveDatapackPaneDraft(state, entries, 'demo@1.0.0', -1)).toBe('moved');
    expect(state.draftOrder).toEqual(['core', 'demo-fixed', 'demo-editing', 'other']);
    expect(moveDatapackPaneDraft(state, entries, 'demo@1.0.0', -1)).toBe('blocked');
    expect(state.draftOrder).toEqual(['core', 'demo-fixed', 'demo-editing', 'other']);
  });
});

describe('Runtime Datapack Editor 状态边界', () => {
  it('集中处理表单字段、Spot 草案和 RuntimeModDraft 映射', () => {
    const editor = createRuntimeDatapackEditorState('area-1');
    updateRuntimeEditorFields(editor, {
      modName: ' demo ',
      displayName: ' Demo Pack ',
      version: ' 2.0.0 ',
      selectedAreaId: 'area-2',
    });
    setRuntimeEditorSpot(editor, { ...spot, areaId: 'area-2' });

    expect(toRuntimeModDraft(editor)).toEqual({
      modName: 'demo',
      displayName: 'Demo Pack',
      version: '2.0.0',
      author: '',
      description: '',
      spots: [{ ...spot, areaId: 'area-2' }],
      suspendedSpotIds: [],
    });
  });

  it('从已加载草案回填，并在新建或清除 Spot 时清理应用态与错误', () => {
    const editor = createRuntimeDatapackEditorState(null);
    setRuntimeEditorError(editor, 'invalid');
    const runtimeMod: RuntimeModDraft = {
      modName: 'loaded',
      displayName: 'Loaded Pack',
      version: '1.0.0',
      author: 'Author',
      description: 'Description',
      spots: [{ ...spot, areaId: 'area-1' }],
      suspendedSpotIds: [],
    };

    hydrateRuntimeEditor(editor, runtimeMod);
    expect(editor.applied).toBe(true);
    expect(editor.error).toBeNull();
    expect(toRuntimeModDraft(editor)).toEqual(runtimeMod);

    prepareRuntimeEditorForNewSpot(editor, 'area-2');
    expect(editor.selectedAreaId).toBe('area-2');
    expect(editor.spots).toEqual([{ ...spot, areaId: 'area-1' }]);
    expect(editor.selectedSpotId).toBeNull();
    expect(editor.applied).toBe(false);
    expect(editor.error).toBeNull();

    setRuntimeEditorSpot(editor, spot);
    setRuntimeEditorError(editor, 'again');
    clearRuntimeEditorSpot(editor);
    expect(editor.spots).toEqual([{ ...spot, areaId: 'area-1' }]);
    expect(editor.selectedSpotId).toBeNull();
    expect(editor.error).toBeNull();
    expect(editor.applied).toBe(false);
  });

  it('支持多个 Spot 的选择、挂起/恢复与单项删除，不影响其他草稿', () => {
    const editor = createRuntimeDatapackEditorState('area-1');
    updateRuntimeEditorFields(editor, { modName: 'demo', displayName: 'Demo' });
    setRuntimeEditorSpot(editor, { ...spot, idName: 'mine-a' });
    prepareRuntimeEditorForNewSpot(editor, 'area-2');
    setRuntimeEditorSpot(editor, { ...spot, idName: 'mine-b', areaId: 'area-2' });

    expect(editor.spots.map(item => item.idName)).toEqual(['mine-a', 'mine-b']);
    expect(selectRuntimeEditorSpot(editor, 'mine-a')).toBe(true);
    expect(setRuntimeEditorSpotSuspended(editor, 'mine-a', true)).toBe(true);
    expect(editor.suspendedSpotIds).toEqual(['mine-a']);
    expect(resolveRuntimeEditorSpot(editor, 'mine-a')).toMatchObject({ status: 'suspended', suspendedBy: { kind: 'draft', sourceId: 'runtime-editor' } });
    expect(toRuntimeModDraft(editor)?.suspendedSpotIds).toEqual(['mine-a']);
    expect(setRuntimeEditorSpotSuspended(editor, 'mine-a', false)).toBe(true);
    expect(editor.suspendedSpotIds).toEqual([]);
    expect(resolveRuntimeEditorSpot(editor, 'mine-a')).toMatchObject({ status: 'resolved', record: { source: { kind: 'draft', sourceId: 'runtime-editor' } } });
    expect(setRuntimeEditorSpotSuspended(editor, 'mine-a', true)).toBe(true);
    expect(removeRuntimeEditorSpot(editor, 'mine-a')).toBe(true);
    expect(editor.spots.map(item => item.idName)).toEqual(['mine-b']);
    expect(editor.suspendedSpotIds).toEqual([]);
    expect(editor.selectedSpotId).toBeNull();
  });
});
