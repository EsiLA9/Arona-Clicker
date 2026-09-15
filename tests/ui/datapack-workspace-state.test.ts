import { describe, expect, it } from 'vitest';
import type { PackCatalogEntry, RuntimeModDraft } from '../../src/arona-clicker/contracts';
import {
  createDatapackWorkspaceState,
  hasDatapackWorkspaceChanges,
  moveDatapackDraft,
  resetDatapackWorkspaceState,
  selectDatapackPack,
  setDatapackValidation,
  synchronizeDatapackWorkspaceState,
  toggleDatapackDraftEnabled,
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
} from '../../src/ui/workspace/runtime-datapack-editor-state';

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
  baseCost: 2,
  baseCostResource: 'coin',
  baseCapacity: 4,
};

describe('Datapack Workspace 状态边界', () => {
  it('从正式配置创建独立草案，并保留首选可操作包', () => {
    const entries = [
      entry('core', { sourceKind: 'builtin', enabled: true }),
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
