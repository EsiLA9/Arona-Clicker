// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { UIController } from '../../src/ui/controller';
import { openRuntimeEditorPanel, openRuntimeEditorLauncher } from '../../src/ui/runtime-editor/actions';
import { getRuntimeEditorCodexView, renderRuntimeEditorCodex } from '../../src/ui/runtime-editor/view';
import { createCodexShellState, codexEntryKey } from '../../src/ui/runtime-editor/codex';
import { renderDefinitionInspector } from '../../src/ui/runtime-editor/codex-details';
import type { RuntimeContentBrowserView } from '../../src/data-services/contracts/runtime-content-browser';
import type { UIContext } from '../../src/ui/context';

describe('RuntimeEditor 超级图鉴集成', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = new GameInstance();
    game.init([baseDatapack]);
    controller = new UIController(game, root);
  });

  afterEach(() => {
    controller.destroy();
    game.stop();
    localStorage.clear();
  });

  it('只从当前 Registry 有效视图构建图鉴，不要求编辑态 packRecordId', () => {
    const runtimeView = game.runtimeContentBrowser.getView();
    expect(runtimeView.loadedMods.length).toBeGreaterThan(0);
    expect(runtimeView.entries.length).toBeGreaterThan(0);

    openRuntimeEditorPanel(controller, 'codex');

    const panel = document.querySelector('[data-runtime-editor-panel-host]');
    expect(panel?.querySelector('[data-runtime-editor-codex]')).not.toBeNull();
    expect(panel?.querySelector('.runtime-editor-empty-state')).toBeNull();
    expect(controller.panelState.runtimeDatapackEditor).toBeUndefined();
    expect(panel?.textContent).toContain('当前 Runtime 有效内容 · 只读');
  });

  it('从入口打开后可完成 Mod、类型、条目、详情页签和移动端栏位切换', () => {
    openRuntimeEditorLauncher(controller);
    const launcher = document.querySelector('[data-runtime-editor-launcher]');
    const button = launcher?.querySelector<HTMLElement>('[data-runtime-editor-launcher-entry="runtime-codex"]');
    expect(button).not.toBeNull();
    button!.click();

    const panel = document.querySelector('[data-runtime-editor-panel-host]')!;
    const mod = panel.querySelector<HTMLElement>('[data-codex-mod]');
    expect(mod).not.toBeNull();
    mod!.click();
    expect(controller.runtimeEditorCodexState.selectedModId).toBe(mod!.dataset.codexMod);
    const kind = panel.querySelector<HTMLElement>('[data-codex-kind]:not([data-codex-kind=""])');
    expect(kind).not.toBeNull();
    kind!.click();
    expect(controller.runtimeEditorCodexState.selectedKind).toBe(kind!.dataset.codexKind);
    const entry = panel.querySelector<HTMLElement>('[data-codex-entry]');
    expect(entry).not.toBeNull();
    entry!.click();

    expect(panel.querySelector('[data-codex-inspector]')).not.toBeNull();
    expect(panel.querySelector('button[data-codex-mobile-pane="detail"]')?.getAttribute('aria-selected')).toBe('true');
    panel.querySelector<HTMLElement>('[data-codex-inspector-tab="raw"]')!.click();
    expect(panel.querySelector('[data-codex-inspector-panel="raw"]')).not.toBeNull();

    panel.querySelector<HTMLElement>('[data-codex-mobile-pane="mods"]')!.click();
    expect(panel.querySelector('[data-runtime-editor-codex]')?.getAttribute('data-codex-mobile-pane')).toBe('mods');
  });

  it('交互只局部替换中栏和详情栏，不重建超级图鉴工作区', () => {
    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector('[data-runtime-editor-panel-host] .runtime-editor-panel')!;
    const codex = panel.querySelector('[data-runtime-editor-codex]')!;
    const entriesPane = codex.querySelector('[data-codex-pane="entries"]')!;
    const mod = codex.querySelector<HTMLElement>('[data-codex-mod]')!;

    mod.click();

    expect(document.querySelector('[data-runtime-editor-panel-host] .runtime-editor-panel')).toBe(panel);
    expect(panel.querySelector('[data-runtime-editor-codex]')).toBe(codex);
    expect(codex.querySelector('[data-codex-pane="entries"]')).not.toBe(entriesPane);
    expect(controller.runtimeEditorCodexState.selectedModId).toBe(mod.dataset.codexMod);
  });

  it('点击条目只更新选中项和详情，不重建条目列表', () => {
    openRuntimeEditorPanel(controller, 'codex');
    const codex = document.querySelector<HTMLElement>('[data-runtime-editor-codex]')!;
    const entryList = codex.querySelector<HTMLElement>('.runtime-editor-codex__entry-list');
    const entries = [...codex.querySelectorAll<HTMLElement>('[data-codex-entry]')];
    expect(entryList).not.toBeNull();
    expect(entries.length).toBeGreaterThanOrEqual(2);

    entries[0].click();
    const firstDetail = codex.querySelector<HTMLElement>('[data-codex-pane="detail"]')!;
    expect(codex.querySelector('.runtime-editor-codex__entry-list')).toBe(entryList);
    expect(entries[0].getAttribute('aria-selected')).toBe('true');

    entries[1].click();
    expect(codex.querySelector('.runtime-editor-codex__entry-list')).toBe(entryList);
    expect(entries[0].getAttribute('aria-selected')).toBe('false');
    expect(entries[1].getAttribute('aria-selected')).toBe('true');
    expect(codex.querySelector('[data-codex-pane="detail"]')).not.toBe(firstDetail);
  });

  it('类型筛选默认折叠，展开后在筛选刷新中保留状态', () => {
    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector('[data-runtime-editor-panel-host]')!;
    const filter = panel.querySelector<HTMLDetailsElement>('[data-codex-kind-filter]')!;
    filter.querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    filter.open = true;
    filter.dispatchEvent(new Event('toggle'));

    const kind = panel.querySelector<HTMLElement>('[data-codex-kind]:not([data-codex-kind=""])');
    expect(kind).not.toBeNull();
    kind!.click();

    expect(controller.runtimeEditorCodexState.kindFilterOpen).toBe(true);
    expect(panel.querySelector<HTMLDetailsElement>('[data-codex-kind-filter]')?.open).toBe(true);
  });

  it('详情适配器使用只读查询快照并保留完整 ID 与 Inspector 页签', () => {
    const view = game.runtimeContentBrowser.getView();
    const entry = view.entries.find(item => item.ref.fullId !== null);
    expect(entry).toBeDefined();
    const html = renderRuntimeEditorCodex(createUIContext(game), {
      ...createCodexShellState(),
      selectedEntryKey: codexEntryKey({
        definitionKind: entry!.ref.definitionKind,
        fullId: entry!.ref.fullId!,
      }),
      mobilePane: 'detail',
    });
    expect(html).toContain(entry!.ref.fullId!);
    expect(html).toContain('data-codex-inspector-tab="overview"');
    expect(html).toContain('data-codex-inspector-tab="relations"');
    expect(html).toContain('data-codex-inspector-tab="raw"');
    expect(html).not.toContain('data-codex-write');
  });

  it('类型概览补充领域字段，关系保留独立页签', () => {
    const view = game.runtimeContentBrowser.getView();
    const spot = view.entries.find(entry => entry.ref.definitionKind === 'spots' && entry.ref.fullId !== null);
    expect(spot).toBeDefined();
    const html = renderRuntimeEditorCodex(createUIContext(game), {
      ...createCodexShellState(),
      selectedEntryKey: codexEntryKey({
        definitionKind: spot!.ref.definitionKind,
        fullId: spot!.ref.fullId!,
      }),
      mobilePane: 'detail',
    });
    expect(html).toContain('所属 Area');
    expect(html).toContain('data-codex-inspector-tab="relations"');
    expect(html).toContain('data-codex-inspector-tab="raw"');
  });

  it('Runtime 查询层为已知字段关系提供声明可靠性', () => {
    const spot = game.runtimeContentBrowser.getView().entries.find(entry => entry.ref.definitionKind === 'spots' && entry.ref.fullId !== null);
    expect(spot).toBeDefined();
    const detail = game.runtimeContentBrowser.getDefinition(spot!.ref);
    const areaReference = detail?.outgoingReferences.find(reference => reference.path.endsWith('.areaId'));
    expect(areaReference?.relation).toBe('所属 Area');
    expect(areaReference?.confidence).toBe('declared');
  });

  it('当前 Runtime 暴露的全部 Def 类型都能进入三页签渲染路径', () => {
    const runtimeView = game.runtimeContentBrowser.getView();
    for (const entry of runtimeView.entries) {
      const state = {
        ...createCodexShellState(),
        selectedEntryKey: codexEntryKey({
          definitionKind: entry.ref.definitionKind,
          fullId: entry.ref.fullId ?? '<singleton>',
        }),
        mobilePane: 'detail' as const,
      };
      expect(() => renderRuntimeEditorCodex(createUIContext(game), state)).not.toThrow();
      expect(renderRuntimeEditorCodex(createUIContext(game), state)).toContain('data-codex-inspector-tab="overview"');
      expect(renderRuntimeEditorCodex(createUIContext(game), { ...state, selectedEntryKey: state.selectedEntryKey })).toContain('data-codex-inspector-tab="relations"');
      expect(renderRuntimeEditorCodex(createUIContext(game), { ...state, selectedEntryKey: state.selectedEntryKey })).toContain('data-codex-inspector-tab="raw"');
    }
  });

  it('当前 Runtime 的每个真实 Def 都能渲染概览、关系和原始数据页', () => {
    for (const entry of game.runtimeContentBrowser.getView().entries) {
      const detail = game.runtimeContentBrowser.getDefinition(entry.ref);
      expect(detail).not.toBeNull();
      const inspector = {
        definitionKind: entry.ref.definitionKind,
        fullId: entry.ref.fullId ?? '<singleton>',
        title: entry.label,
        description: entry.description,
        definition: detail!.raw,
        references: [],
        reverseReferences: [],
      };
      expect(() => renderDefinitionInspector(inspector, 'overview')).not.toThrow();
      expect(() => renderDefinitionInspector(inspector, 'relations')).not.toThrow();
      expect(() => renderDefinitionInspector(inspector, 'raw')).not.toThrow();
    }
  });

  it('没有可靠 sourceMod 时保留在 Runtime 有效配置分组，不把 namespace 猜成 Mod 来源', () => {
    const runtimeView: RuntimeContentBrowserView = {
      loadedMods: [{ modName: 'known', loaded: true, definitionCount: 1 }],
      kinds: [{
        kind: 'items',
        label: '物品',
        group: 'economy',
        shape: 'map',
        derived: false,
        present: true,
        entryCount: 2,
      }],
      entries: [
        {
          ref: { definitionKind: 'items', fullId: 'known:item:owned' },
          kind: { kind: 'items', label: '物品', group: 'economy', shape: 'map', derived: false, present: true, entryCount: 2 },
          namespace: 'known',
          sourceMod: 'known',
          label: '有 owner 的内容',
          diagnosticCount: 0,
          searchableText: 'known:item:owned',
        },
        {
          ref: { definitionKind: 'items', fullId: 'unknown:item:effective' },
          kind: { kind: 'items', label: '物品', group: 'economy', shape: 'map', derived: false, present: true, entryCount: 2 },
          namespace: 'unknown',
          label: '来源未知的有效内容',
          diagnosticCount: 0,
          searchableText: 'unknown:item:effective unknown',
        },
      ],
    };
    const context = {
      game: { runtimeContentBrowser: { getView: () => runtimeView } },
    } as unknown as UIContext;

    const view = getRuntimeEditorCodexView(context);
    expect(view.entries.map(entry => [entry.fullId, entry.modId])).toEqual([
      ['known:item:owned', 'known'],
      ['unknown:item:effective', '__runtime-effective__'],
    ]);
    expect(view.loadedMods.map(mod => mod.label)).toEqual(['known', 'Runtime 有效配置']);
    expect(view.loadedMods.find(mod => mod.id === 'unknown')).toBeUndefined();
  });

  it('resolved 关系可跳转，点击只更新 Codex 选择状态和详情栏位', () => {
    const runtimeView = game.runtimeContentBrowser.getView();
    const source = runtimeView.entries
      .map(entry => game.runtimeContentBrowser.getDefinition(entry.ref))
      .find(detail => detail?.outgoingReferences.some(reference => reference.status === 'resolved'));
    expect(source).toBeDefined();
    const resolved = source!.outgoingReferences.find(reference => reference.status === 'resolved')!;
    expect(resolved.target).not.toBeNull();

    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector('[data-runtime-editor-panel-host]')!;
    const codex = panel.querySelector<HTMLElement>('[data-runtime-editor-codex]')!;
    const modsPane = codex.querySelector('[data-codex-pane="mods"]');
    const entriesPane = codex.querySelector('[data-codex-pane="entries"]');
    const codexShell = codex;
    const sourceKey = codexEntryKey({
      definitionKind: source!.summary.ref.definitionKind,
      fullId: source!.summary.ref.fullId!,
    });
    const sourceButton = [...panel.querySelectorAll<HTMLElement>('[data-codex-entry]')]
      .find(button => button.dataset.codexEntry === sourceKey);
    expect(sourceButton).toBeDefined();
    sourceButton!.click();

    panel.querySelector<HTMLElement>('[data-codex-inspector-tab="relations"]')!.click();
    const targetButton = panel.querySelector<HTMLButtonElement>('button[data-codex-reference-target]');
    expect(targetButton).not.toBeNull();
    const targetKey = targetButton!.dataset.codexReferenceTarget;
    targetButton!.click();

    expect(controller.runtimeEditorCodexState.selectedEntryKey).toBe(targetKey);
    expect(controller.runtimeEditorCodexState.mobilePane).toBe('detail');
    expect(controller.runtimeEditorCodexState.backStack).toHaveLength(1);
    expect(codex.querySelector('[data-codex-pane="mods"]')).toBe(modsPane);
    expect(codex.querySelector('[data-codex-pane="entries"]')).toBe(entriesPane);
    expect(panel.querySelector('[data-runtime-editor-codex]')).toBe(codexShell);

    const back = codex.querySelector<HTMLButtonElement>('[data-codex-navigation="back"]');
    expect(back?.disabled).toBe(false);
    back!.click();
    expect(controller.runtimeEditorCodexState.selectedEntryKey).toBe(sourceKey);
    expect(controller.runtimeEditorCodexState.forwardStack).toEqual([targetKey]);
    const forward = codex.querySelector<HTMLButtonElement>('[data-codex-navigation="forward"]');
    expect(forward?.disabled).toBe(false);
    forward!.click();
    expect(controller.runtimeEditorCodexState.selectedEntryKey).toBe(targetKey);
    expect(controller.panelState.runtimeDatapackEditor).toBeUndefined();
  });

  it('原始数据页签可只读复制 JSON，并在复制后不改变 Runtime', async () => {
    const entry = game.runtimeContentBrowser.getView().entries.find(item => item.ref.fullId !== null);
    expect(entry).toBeDefined();
    const detailBefore = game.runtimeContentBrowser.getDefinition(entry!.ref);
    expect(detailBefore).not.toBeNull();
    const rawBefore = JSON.stringify(detailBefore!.raw);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      openRuntimeEditorPanel(controller, 'codex');
      const panel = document.querySelector('[data-runtime-editor-panel-host]')!;
      const entryKey = codexEntryKey({
        definitionKind: entry!.ref.definitionKind,
        fullId: entry!.ref.fullId!,
      });
      const entryButton = [...panel.querySelectorAll<HTMLElement>('[data-codex-entry]')]
        .find(button => button.dataset.codexEntry === entryKey);
      expect(entryButton).toBeDefined();
      entryButton!.click();
      panel.querySelector<HTMLElement>('[data-codex-inspector-tab="raw"]')!.click();

      const copyButton = panel.querySelector<HTMLButtonElement>('[data-codex-copy-raw]');
      expect(copyButton?.getAttribute('aria-label')).toBe('复制当前 Def 的原始 JSON');
      expect(copyButton?.dataset.codexCopyFormat).toBe('json');
      copyButton!.click();

      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(detailBefore!.raw, null, 2)));
      expect(JSON.stringify(game.runtimeContentBrowser.getDefinition(entry!.ref)?.raw)).toBe(rawBefore);
      expect(controller.panelState.runtimeDatapackEditor).toBeUndefined();
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('剪贴板不可用时显示提示且不抛错', () => {
    const entry = game.runtimeContentBrowser.getView().entries.find(item => item.ref.fullId !== null);
    expect(entry).toBeDefined();
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

    try {
      openRuntimeEditorPanel(controller, 'codex');
      const panel = document.querySelector('[data-runtime-editor-panel-host]')!;
      const entryKey = codexEntryKey({
        definitionKind: entry!.ref.definitionKind,
        fullId: entry!.ref.fullId!,
      });
      [...panel.querySelectorAll<HTMLElement>('[data-codex-entry]')]
        .find(button => button.dataset.codexEntry === entryKey)!.click();
      panel.querySelector<HTMLElement>('[data-codex-inspector-tab="raw"]')!.click();

      expect(() => panel.querySelector<HTMLButtonElement>('[data-codex-copy-raw]')!.click()).not.toThrow();
      expect(document.querySelector('#toast-layer')?.textContent).toContain('不支持复制原始数据');
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
