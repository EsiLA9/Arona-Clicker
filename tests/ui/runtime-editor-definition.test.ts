// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { renderRuntimeDefinitionForm, renderRuntimeEditorPanel, renderRuntimeEditorWorkspace, runtimeEditorInitProblems, runtimeEditorInitUnsupportedFields } from '../../src/ui/runtime-editor/view';

const ctx = {
  game: {
    getView: () => ({ activeInit: 'base:init:main', currentAreaId: 'base:area:main' }),
    registry: {
      areas: new Map([['base:area:main', { id: 'base:area:main', name: '主厅', initId: 'base:init:main' }]]),
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
  test('右侧 panes 使用独立滚动高度，不由左侧 Switch 的内容高度决定', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/css/runtime-editor.css'), 'utf8');
    const panelBody = css.match(/\.runtime-editor-panel-body\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const editorBody = css.match(/\.runtime-editor-body\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const panes = css.match(/\.runtime-editor-panes\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(panelBody).toContain('display: flex;');
    expect(panelBody).toContain('overflow: hidden;');
    expect(editorBody).toContain('min-height: 0;');
    expect(editorBody).toContain('overflow: hidden;');
    expect(panes).toContain('height: 100%;');
    expect(panes).toContain('overflow-y: auto;');
  });

  test('Runtime Editor 通过独立浮动面板承载入口，不依赖 Toast', () => {
    document.body.innerHTML = '';
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    const panel = document.createElement('div');
    panel.innerHTML = renderRuntimeEditorPanel(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'browser');

    expect(panel.querySelector('.runtime-editor-panel')).not.toBeNull();
    expect(panel.querySelector('[data-runtime-editor-surface="mod"]')).not.toBeNull();
    expect(panel.querySelector('.runtime-editor-panel [data-runtime-editor-kind-tab="inits"]')).not.toBeNull();
    expect(panel.querySelector('[data-toast-action-key]')).toBeNull();
  });

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
    area.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor, service: 'game' } as unknown as PanelState, 'areas');
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

  test('游戏 Init 页面新建 Area 时使用当前 Init，并在概览显示关系摘要', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    prepareRuntimeEditorForNewDefinition(editor, 'areas');
    editor.activeSection = 'basics';

    const area = document.createElement('div');
    area.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor, service: 'game' } as unknown as PanelState, 'areas');

    expect(area.querySelector<HTMLSelectElement>('[data-runtime-editor-field="initId"]')?.value).toBe('base:init:main');

    editor.activeSection = 'overview';
    area.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'areas');
    expect(area.querySelector('.runtime-editor-overview')?.textContent).toContain('默认设施');
    expect(area.querySelector('.runtime-editor-overview')?.textContent).toContain('相邻区域');
  });

  test('非 Init 内容页新建 Area 不预填所属 Init', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    prepareRuntimeEditorForNewDefinition(editor, 'areas');
    editor.activeSection = 'basics';

    const area = document.createElement('div');
    area.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor, service: 'datapack' } as unknown as PanelState, 'areas');

    expect(area.querySelector<HTMLSelectElement>('[data-runtime-editor-field="initId"]')?.value).toBe('');
  });

  test('Init 使用五个专属 Switch，并以候选顺序编辑 defaultAreas', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    setRuntimeEditorDefinition(editor, 'inits', {
      idName: 'main', name: 'Main', description: '', defaultAreas: ['runtime:area:lobby', 'base:area:main'],
    });
    editor.areas.push({ idName: 'lobby', initId: 'runtime:init:main', name: '入口大厅', description: '', defaultSpots: [] });
    editor.activeSection = 'areas';

    const scope = document.createElement('div');
    scope.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'inits');

    expect([...scope.querySelectorAll('[data-runtime-editor-section-tab]')].map(item => item.textContent?.trim().replace(/\d+$/, ''))).toEqual(['概览', '基础', '区域', '揭示', '诊断']);
    expect(scope.querySelector('textarea[data-runtime-editor-extension="defaultAreas"]')).toBeNull();
    expect(scope.querySelectorAll('[data-runtime-init-area-row]')).toHaveLength(2);
    expect(scope.querySelector('[data-runtime-init-area-row]')?.textContent).toContain('入口大厅');
    expect(scope.querySelector('[data-runtime-init-area-row]')?.textContent).toContain('待提交');
    expect(scope.querySelector('[data-runtime-init-area-row].has-runtime-editor-problem')).not.toBeNull();
    expect(scope.querySelector('[data-runtime-init-area-option][data-area-id="runtime:area:lobby"]')).not.toBeNull();
  });

  test('Init 关系错误与未开放字段会进入诊断，且空 defaultAreas 保持合法警告', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    setRuntimeEditorDefinition(editor, 'inits', { idName: 'main', name: 'Main', description: '', defaultAreas: [] });
    (ctx.game.registry.inits as unknown as Map<string, Record<string, unknown>>).set('runtime:init:main', { id: 'runtime:init:main', name: 'Main', enterEffects: [] });

    expect(runtimeEditorInitUnsupportedFields(ctx, editor, editor.inits[0])).toEqual(['进入效果']);
    expect(runtimeEditorInitProblems(ctx, editor, editor.inits[0]).map(problem => problem.code)).toContain('unsupported-field');

    editor.activeSection = 'overview';
    const overview = document.createElement('div');
    overview.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'inits');
    expect(overview.textContent).toContain('没有默认区域');

    editor.activeSection = 'diagnostics';
    const diagnostics = document.createElement('div');
    diagnostics.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'inits');
    expect(diagnostics.textContent).toContain('能力问题');
    expect(diagnostics.textContent).toContain('替换会被阻断');
    (ctx.game.registry.inits as unknown as Map<string, unknown>).delete('runtime:init:main');
  });

  test('Area 拓扑使用可搜索目标与连接类型列表，而不是原始 ID 文本框', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    setRuntimeEditorDefinition(editor, 'areas', {
      idName: 'lobby', initId: 'base:init:main', name: 'Lobby', description: '', defaultSpots: [],
      topology: [{ areaId: 'base:area:main', type: 'twoWay' }],
    });
    editor.activeSection = 'topology';

    const area = document.createElement('div');
    area.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'areas');

    expect(area.querySelector('[data-runtime-area-topology-editor]')).not.toBeNull();
    expect(area.querySelector('[data-runtime-area-topology-area]')?.getAttribute('aria-controls')).toBe('runtime-area-topology-options');
    expect(area.querySelector('[data-runtime-area-topology-options]')).not.toBeNull();
    expect(area.querySelector('[data-runtime-area-topology-type]')).not.toBeNull();
    expect(area.querySelector('[data-runtime-area-topology-row]')?.getAttribute('data-topology-type')).toBe('twoWay');
    expect(area.querySelector('textarea[data-runtime-editor-extension="adjacentAreaIds"]')).toBeNull();
  });

  test('Area 拓扑搜索源包含 Registry 中其它数据包的 Area', () => {
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'runtime';
    editor.displayName = 'Runtime';
    setRuntimeEditorDefinition(editor, 'areas', {
      idName: 'lobby', initId: 'base:init:main', name: 'Lobby', description: '', defaultSpots: [], topology: [],
    });
    editor.activeSection = 'topology';
    (ctx.game.registry.areas as unknown as Map<string, { id: string; name: string; initId?: string }>).set('addition-test:area:observatory', {
      id: 'addition-test:area:observatory', name: '观测台', initId: 'addition-test:init:observatory',
    });

    const area = document.createElement('div');
    area.innerHTML = renderRuntimeDefinitionForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState, 'areas');

    expect(area.querySelector('[role="option"][data-area-id="addition-test:area:observatory"]')?.textContent).toContain('观测台');
    (ctx.game.registry.areas as unknown as Map<string, unknown>).delete('addition-test:area:observatory');
  });
});
