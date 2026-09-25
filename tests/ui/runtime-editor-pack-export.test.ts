// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { parsePackFromZipBuffer } from '../../src/data-services/datapack/pack-parser';
import { validateDatapack } from '../../src/data-services/registry/registry-validate';
import {
  compileRuntimeEditorPack,
  writeRuntimeEditorPack,
} from '../../src/ui/runtime-editor/pack-export';
import { bindRuntimeDatapackEditorActions } from '../../src/ui/runtime-editor/actions';
import {
  createRuntimeDatapackEditorState,
  setRuntimeEditorDefinition,
} from '../../src/ui/runtime-editor/state';
import { renderRuntimeEditorPanel } from '../../src/ui/runtime-editor/view';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';

function createEditor() {
  const editor = createRuntimeDatapackEditorState(null);
  editor.packRecordId = 'editing:test';
  editor.modName = 'demo-mod';
  editor.displayName = 'Demo Mod';
  editor.version = '1.2.0';
  editor.author = 'Test';
  return editor;
}

describe('Runtime Editor Mod ZIP 导出', () => {
  test('从 Draft 编译标准 Datapack 分片，并可再次解析', async () => {
    const editor = createEditor();
    setRuntimeEditorDefinition(editor, 'inits', {
      idName: 'main',
      name: 'Main',
      description: '',
      defaultAreas: ['demo-mod:area:lobby'],
    });
    setRuntimeEditorDefinition(editor, 'areas', {
      idName: 'lobby',
      initId: 'demo-mod:init:main',
      name: 'Lobby',
      description: '',
      defaultSpots: ['demo-mod:spot:scanner'],
      topology: [],
    });
    setRuntimeEditorDefinition(editor, 'spots', {
      idName: 'scanner',
      areaId: 'demo-mod:area:lobby',
      name: 'Scanner',
      description: '',
      purchaseOptions: [{ id: 'free', costs: [] }],
    });

    const compiled = compileRuntimeEditorPack(editor);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.archive.manifest.dependencies).toEqual([]);
    expect(compiled.archive.plan.entries.map(entry => entry.path)).toEqual([
      'datapack.json',
      'data/00-meta.json',
      'data/10-inits.json',
      'data/20-areas.json',
      'data/30-spots.json',
    ]);

    const firstBytes = await writeRuntimeEditorPack(compiled.archive);
    const secondBytes = await writeRuntimeEditorPack(compiled.archive);
    expect([...firstBytes]).toEqual([...secondBytes]);
    const parsed = await parsePackFromZipBuffer(firstBytes);
    validateDatapack(parsed.datapack);
    expect(parsed.manifest).toMatchObject({ modName: 'demo-mod', name: 'Demo Mod', version: '1.2.0' });
    expect(parsed.datapack.inits[0].id).toBe('demo-mod:init:main');
    expect(parsed.datapack.areas[0].defaultSpots).toEqual(['demo-mod:spot:scanner']);
    expect(parsed.datapack.spots[0].areaId).toBe('demo-mod:area:lobby');
  });

  test('挂起条目不导出，跨包引用生成 dependencies', () => {
    const editor = createEditor();
    setRuntimeEditorDefinition(editor, 'areas', {
      idName: 'external-area',
      initId: 'base:init:main',
      name: 'External Area',
      description: '',
      defaultSpots: [],
      topology: [],
    });
    setRuntimeEditorDefinition(editor, 'spots', {
      idName: 'scanner',
      areaId: 'base:area:main',
      name: 'Scanner',
      description: '',
      purchaseOptions: [{
        id: 'purchase',
        costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount: 1 }],
      }],
    });
    editor.suspendedAreaIds = ['external-area'];

    const compiled = compileRuntimeEditorPack(editor, {
      areaIds: new Set(['base:area:main']),
      initIds: new Set(['base:init:main']),
      resourceIds: new Set(['base:resource:credit']),
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.archive.datapack.areas).toHaveLength(0);
    expect(compiled.archive.manifest.dependencies).toEqual(['base']);
  });

  test('编辑态导出以源包为底保留不可编辑数据表', async () => {
    const editor = createEditor();
    editor.modName = 'base';
    editor.displayName = defaultDatapack.name;
    editor.version = defaultDatapack.version;
    const sourceDatapack = {
      ...structuredClone(defaultDatapack),
      modName: 'base',
    };
    const compiled = compileRuntimeEditorPack(editor, {
      sourceDatapack,
      resourceIds: new Set(),
      itemIds: new Set(),
      gachaPoolIds: new Set(sourceDatapack.gachaPools?.map(pool => pool.id) ?? []),
      shopIds: new Set(sourceDatapack.shops?.map(shop => shop.id) ?? []),
      initIds: new Set(sourceDatapack.inits.map(init => init.id)),
      areaIds: new Set(sourceDatapack.areas.map(area => area.id)),
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.archive.datapack.inits).toEqual([]);
    expect(compiled.archive.datapack.items).toEqual(sourceDatapack.items);
    expect(compiled.archive.datapack.gachaPools).toEqual(sourceDatapack.gachaPools);
    expect(compiled.archive.datapack.gearConfig).toEqual(sourceDatapack.gearConfig);
    expect(compiled.archive.plan.entries.map(entry => entry.path)).toContain('data/80-singletons.json');

    const parsed = await parsePackFromZipBuffer(await writeRuntimeEditorPack(compiled.archive));
    expect(parsed.datapack.items).toEqual(sourceDatapack.items);
    expect(parsed.datapack.gachaPools).toEqual(sourceDatapack.gachaPools);
    expect(parsed.datapack.gearConfig).toEqual(sourceDatapack.gearConfig);
  });

  test('检测到无法无损回写的 Spot 结构时阻止导出', () => {
    const editor = createEditor();
    setRuntimeEditorDefinition(editor, 'spots', {
      idName: 'scanner',
      areaId: 'base:area:main',
      name: 'Scanner',
      description: '',
      purchaseOptions: [{ id: 'free', costs: [] }],
      unsupportedFunctionalityIds: ['legacy-flow'],
    });
    const compiled = compileRuntimeEditorPack(editor, { areaIds: new Set(['base:area:main']) });
    expect(compiled).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'unsupported-round-trip', path: 'spots.scanner.functionalities' }],
    });
  });

  test('编辑器面板在 Mod 已配置时提供全局导出入口', () => {
    const editor = createEditor();
    const ctx = { escapeHtml: (value: string) => value } as never;
    const host = document.createElement('div');
    host.innerHTML = renderRuntimeEditorPanel(ctx, { runtimeDatapackEditor: editor } as never, 'browser');
    expect(host.querySelector('[data-runtime-editor-export]')).not.toBeNull();
    expect(host.querySelector('[data-runtime-editor-export]')?.hasAttribute('disabled')).toBe(false);
  });

  test('点击导出会先吸收当前 Mod 表单，并只触发下载不触碰 Runtime', async () => {
    const editor = createEditor();
    const runtimeMetadata = vi.fn();
    const runtimeApply = vi.fn();
    const persistenceSchedule = vi.fn();
    const toastShow = vi.fn();
    const ctrl = {
      panelState: { runtimeDatapackEditor: editor },
      game: {
        registry: {
          resourceDisplays: new Map(),
          items: new Map(),
          gachaPools: new Map(),
          shops: new Map(),
          inits: new Map(),
          areas: new Map(),
        },
      },
      commands: {
        setRuntimeModMetadata: runtimeMetadata,
        applyRuntimeWorldDraft: runtimeApply,
      },
      runtimeEditorPersistence: { schedule: persistenceSchedule },
      toast: { show: toastShow },
    } as never;
    const host = document.createElement('div');
    const ctx = { escapeHtml: (value: string) => value } as never;
    host.innerHTML = renderRuntimeEditorPanel(ctx as never, { runtimeDatapackEditor: editor } as never, 'mod');
    document.body.appendChild(host);
    const setField = (key: string, value: string): void => {
      host.querySelector<HTMLInputElement>(`[data-runtime-editor-mod-field="${key}"]`)!.value = value;
    };
    setField('modName', 'downloaded-mod');
    setField('displayName', 'Downloaded Mod');
    setField('version', '2.0.0');

    const anchorClick = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => 'blob:runtime-editor');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const panel = host.querySelector<HTMLElement>('.runtime-editor-panel')!;
    bindRuntimeDatapackEditorActions(ctrl, panel);
    panel.querySelector<HTMLButtonElement>('[data-runtime-editor-export]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(editor.modName).toBe('downloaded-mod');
    expect(editor.displayName).toBe('Downloaded Mod');
    expect(editor.version).toBe('2.0.0');
    expect(editor.error).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:runtime-editor');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(persistenceSchedule).toHaveBeenCalledWith(editor);
    expect(toastShow).toHaveBeenCalledWith('已导出 downloaded-mod-2.0.0.zip（0 条内容，0 个依赖）', 'success');
    expect(runtimeMetadata).not.toHaveBeenCalled();
    expect(runtimeApply).not.toHaveBeenCalled();
    anchorClick.mockRestore();
    vi.unstubAllGlobals();
    host.remove();
  });
});
