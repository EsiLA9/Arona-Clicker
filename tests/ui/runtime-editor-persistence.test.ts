// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import type { StorageAdapter } from '../../src/data-services/persistence/storage-adapter';
import { UIController } from '../../src/ui/controller/controller';
import {
  createRuntimeDatapackEditorState,
  restoreRuntimeEditorSnapshot,
  setRuntimeEditorDefinition,
} from '../../src/ui/runtime-editor/state';
import {
  RUNTIME_EDITOR_DRAFT_SCHEMA_VERSION,
  RUNTIME_EDITOR_DRAFT_STORAGE_KEY,
  RuntimeEditorDraftPersistence,
} from '../../src/ui/runtime-editor/persistence';

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();

  get(key: string): string | null { return this.values.get(key) ?? null; }
  set(key: string, value: string): void { this.values.set(key, value); }
  remove(key: string): void { this.values.delete(key); }
}

describe('Runtime Editor 编辑态长效保存', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('只保存 Draft 投影，恢复后清空 Effective 并提示尚未 Apply', () => {
    const source = createRuntimeDatapackEditorState('base:area:main', 'runtime-draft');
    source.modName = 'draft-mod';
    source.displayName = 'Draft Mod';
    setRuntimeEditorDefinition(source, 'inits', { idName: 'main', name: 'Main', description: '', defaultAreas: [] });
    source.formDraft = { idName: 'typed-but-not-saved', nested: { value: 1 } };
    source.applied = true;
    source.appliedInits = [{ idName: 'old', name: 'Old', description: '', defaultAreas: [] }];
    source.problems = [{ code: 'old', message: 'old diagnostic' }];

    const persistence = new RuntimeEditorDraftPersistence(new MemoryStorage());
    expect(persistence.flush(source).ok).toBe(true);
    const loaded = persistence.load();
    expect(loaded.status).toBe('restored');
    if (loaded.status !== 'restored') return;

    const restored = createRuntimeDatapackEditorState(null);
    restoreRuntimeEditorSnapshot(restored, loaded.snapshot);
    expect(restored.modName).toBe('draft-mod');
    expect(restored.inits).toEqual([{ idName: 'main', name: 'Main', description: '', defaultAreas: [] }]);
    expect(restored.formDraft).toEqual({ idName: 'typed-but-not-saved', nested: { value: 1 } });
    expect(restored.applied).toBe(false);
    expect(restored.appliedInits).toEqual([]);
    expect(restored.problems).toEqual([]);
    expect(restored.notice).toContain('尚未同步到当前运行时');
  });

  it('防抖保存并在坏版本数据上软失败清理', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const persistence = new RuntimeEditorDraftPersistence(storage);
    const editor = createRuntimeDatapackEditorState(null);
    editor.modName = 'debounced';

    persistence.schedule(editor);
    expect(storage.get(RUNTIME_EDITOR_DRAFT_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(180);
    const raw = storage.get(RUNTIME_EDITOR_DRAFT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).schemaVersion).toBe(RUNTIME_EDITOR_DRAFT_SCHEMA_VERSION);

    storage.set(RUNTIME_EDITOR_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 999, payload: {} }));
    expect(persistence.load().status).toBe('invalid');
    expect(storage.get(RUNTIME_EDITOR_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('controller 重建后恢复草稿，但不会自动创建 Runtime Mod', () => {
    const firstGame = new AronaClickerRuntime();
    firstGame.init([baseDatapack]);
    const firstRoot = document.createElement('div');
    const firstController = new UIController(firstGame, firstRoot);
    const editor = createRuntimeDatapackEditorState(null, 'persistent-test');
    editor.modName = 'persistent-mod';
    editor.displayName = 'Persistent Mod';
    editor.formDraft = { idName: 'unfinished' };
    firstController.panelState.runtimeDatapackEditor = editor;
    firstController.runtimeEditorPersistence.flush(editor);
    firstController.destroy();
    firstGame.stop();

    const secondGame = new AronaClickerRuntime();
    secondGame.init([baseDatapack]);
    const secondRoot = document.createElement('div');
    const secondController = new UIController(secondGame, secondRoot);
    secondController.render();

    const restored = secondController.panelState.runtimeDatapackEditor;
    expect(restored?.modName).toBe('persistent-mod');
    expect(restored?.displayName).toBe('Persistent Mod');
    expect(restored?.formDraft).toEqual({ idName: 'unfinished' });
    expect(restored?.applied).toBe(false);
    expect(secondGame.getRuntimeMod?.()).toBeNull();
    expect(restored?.notice).toContain('尚未同步到当前运行时');

    secondController.destroy();
    secondGame.stop();
  });

  it('显式关闭编辑态会清理本地草稿，而关闭浮窗只保留草稿', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    const editor = createRuntimeDatapackEditorState(null, 'close-test');
    editor.packRecordId = 'editing:close-test';
    editor.modName = 'close-test';
    editor.displayName = 'Close Test';
    controller.panelState.runtimeDatapackEditor = editor;
    controller.runtimeEditorPersistence.flush(editor);
    controller.runtimeEditorPanelOpen = true;
    controller.runtimeEditorSurface = 'mod';
    controller.started = true;
    controller.panelState.service = 'datapack';
    controller.render();

    const modName = document.querySelector<HTMLInputElement>('[data-runtime-editor-mod-field="modName"]')!;
    modName.value = 'typed-before-close';
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-panel-close]')?.click();
    expect(controller.panelState.runtimeDatapackEditor).toBe(editor);
    expect(JSON.parse(localStorage.getItem(RUNTIME_EDITOR_DRAFT_STORAGE_KEY)!).payload.modName).toBe('typed-before-close');

    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')?.click();
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="close-editing"]')?.click();
    expect(controller.panelState.runtimeDatapackEditor).toBeUndefined();
    expect(localStorage.getItem(RUNTIME_EDITOR_DRAFT_STORAGE_KEY)).toBeNull();

    controller.destroy();
    game.stop();
  });

  it('表单输入事件会把未点击保存的 Mod 字段写入草稿', () => {
    vi.useFakeTimers();
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    const editor = createRuntimeDatapackEditorState(null, 'input-test');
    editor.packRecordId = 'editing:input-test';
    controller.panelState.runtimeDatapackEditor = editor;
    controller.runtimeEditorPanelOpen = true;
    controller.runtimeEditorSurface = 'mod';
    controller.render();

    const modName = document.querySelector<HTMLInputElement>('[data-runtime-editor-mod-field="modName"]')!;
    modName.value = 'typed-mod';
    modName.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(180);

    const raw = localStorage.getItem(RUNTIME_EDITOR_DRAFT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).payload.modName).toBe('typed-mod');
    expect(editor.modName).toBe('typed-mod');

    controller.destroy();
    game.stop();
  });
});
