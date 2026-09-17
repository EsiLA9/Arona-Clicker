// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { getContentPolicy } from '../../src/data-services/authoring/content-policy';
import type { UIContext } from '../../src/ui/context';
import type { PanelState } from '../../src/ui/components/app-shell';
import {
  createRuntimeDatapackEditorState,
  getSelectedRuntimeEditorDefinition,
  markRuntimeEditorApplied,
  prepareRuntimeEditorForNewDefinition,
  removeRuntimeEditorDefinition,
  runtimeEditorPendingDefinitions,
  setRuntimeEditorDefinition,
  toRuntimeModDraft,
} from '../../src/ui/runtime-editor/state';
import { renderRuntimeDefinitionForm, renderRuntimeEditorWorkspace } from '../../src/ui/runtime-editor/view';

const ctx = {
  game: {
    registry: {
      areas: new Map([['base:area:main', { id: 'base:area:main', name: '主厅' }]]),
      inits: new Map([['base:init:main', { id: 'base:init:main', name: '主世界' }]]),
      stories: new Map([['base:story:intro', { id: 'base:story:intro', name: '开场' }]]),
      resourceDisplays: new Map(),
      items: new Map(),
      shops: new Map(),
      gachaPools: new Map(),
    },
  },
  escapeHtml: (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)),
} as unknown as UIContext;

describe('Runtime Editor shared Init / Area framework', () => {
  test('Init / Area 使用同一 Draft CRUD 状态并映射到 RuntimeModDraft', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    setRuntimeEditorDefinition(editor, 'inits', { idName: 'main', name: 'Main', description: '', defaultAreas: [] });
    setRuntimeEditorDefinition(editor, 'areas', { idName: 'lobby', initId: 'runtime:init:main', name: 'Lobby', description: '', defaultSpots: [] });

    const draft = toRuntimeModDraft(editor);
    expect(draft?.inits).toEqual([{ idName: 'main', name: 'Main', description: '', defaultAreas: [] }]);
    expect(draft?.areas?.[0].initId).toBe('runtime:init:main');
    expect(draft?.enhancements).toBeUndefined();
    expect(runtimeEditorPendingDefinitions(editor, 'inits')).toHaveLength(1);

    markRuntimeEditorApplied(editor, true);
    expect(runtimeEditorPendingDefinitions(editor, 'inits')).toHaveLength(0);
    removeRuntimeEditorDefinition(editor, 'inits', 'main');
    expect(runtimeEditorPendingDefinitions(editor, 'inits').map(item => item.idName)).toEqual(['main']);
    expect(toRuntimeModDraft(editor)?.inits).toBeUndefined();
  });

  test('Init / Area 表单均使用 Spot 的 shell / Switch / Apply 结构，且当前 Switch 不暴露 Enhancement', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    setRuntimeEditorDefinition(editor, 'inits', { idName: 'main', name: 'Main', description: '', defaultAreas: [] });
    editor.activeSection = 'basics';
    const init = document.createElement('div');
    init.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'inits');
    expect(init.querySelector('.runtime-editor-shell')).not.toBeNull();
    expect(init.querySelector('.runtime-editor-switch')).not.toBeNull();
    expect(init.querySelector('[data-runtime-editor-apply]')).not.toBeNull();
    expect(init.querySelector('[data-runtime-editor-field="idName"]')?.getAttribute('name')).toBe('idName');

    prepareRuntimeEditorForNewDefinition(editor, 'areas');
    const area = document.createElement('div');
    area.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'areas');
    expect(area.querySelector('.runtime-editor-shell')).not.toBeNull();
    expect(area.querySelector('[data-runtime-editor-content-kind="areas"]')).not.toBeNull();
    expect(getContentPolicy('areas')?.sections).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'topology' })]));

    const workspace = document.createElement('div');
    workspace.innerHTML = renderRuntimeEditorWorkspace(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState);
    expect(workspace.querySelector('[data-runtime-editor-kind-tab="inits"]')).not.toBeNull();
    expect(workspace.querySelector('[data-runtime-editor-kind-tab="areas"]')?.classList.contains('is-active')).toBe(true);
    expect(workspace.querySelector('[data-runtime-editor-kind-tab="enhancements"]')).toBeNull();
    expect(getSelectedRuntimeEditorDefinition(editor)).toBeNull();
  });
});
