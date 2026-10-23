// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/runtime/context';
import { UIController } from '../../src/ui/controller/controller';
import { openRuntimeEditorPanel, openRuntimeEditorLauncher, syncRuntimeEditorPanel } from '../../src/ui/runtime-editor/actions';
import { getRuntimeEditorCodexView, renderRuntimeEditorCodex } from '../../src/ui/runtime-editor/view';
import { createCodexShellState, codexEntryKey, reduceCodexShellState, renderCodexDetailPane } from '../../src/ui/runtime-editor/codex';
import { createRuntimeDatapackEditorState, setRuntimeEditorDefinition } from '../../src/ui/runtime-editor/state';
import { renderDefinitionInspector } from '../../src/ui/runtime-editor/codex-details';
import type {
  RuntimeContentBrowserView,
  RuntimeContentReferenceDiagnostic,
} from '../../src/data-services/contracts/runtime-content-browser';
import type { UIContext } from '../../src/ui/runtime/context';

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

  it('重复同步保留 Runtime Editor shell、header 和 body 宿主，Codex 委托动作只执行一次', () => {
    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector<HTMLElement>('.runtime-editor-panel')!;
    const header = panel.querySelector('[data-runtime-editor-panel-head]');
    const body = panel.querySelector('.runtime-editor-panel-body');
    const codex = panel.querySelector('[data-runtime-editor-codex]');
    const initialMod = panel.querySelector<HTMLElement>('[data-codex-mod]')!;
    const selectedModId = initialMod.dataset.codexMod;

    syncRuntimeEditorPanel(controller);

    expect(document.querySelector('.runtime-editor-panel')).toBe(panel);
    expect(panel.querySelector('[data-runtime-editor-panel-head]')).toBe(header);
    expect(panel.querySelector('.runtime-editor-panel-body')).toBe(body);
    expect(panel.querySelector('[data-runtime-editor-codex]')).toBe(codex);
    let codexState = controller.runtimeEditorCodexState;
    let stateWrites = 0;
    Object.defineProperty(controller, 'runtimeEditorCodexState', {
      configurable: true,
      get: () => codexState,
      set: value => { stateWrites += 1; codexState = value; },
    });
    panel.querySelector<HTMLElement>(`[data-codex-mod="${selectedModId}"]`)!.click();
    expect(controller.runtimeEditorCodexState.selectedModId).toBe(selectedModId || null);
    expect(stateWrites).toBe(2);
  });

  it('内容浏览器条目选择保留三栏和列表节点，只刷新右侧 Draft 编辑区', () => {
    const editor = createRuntimeDatapackEditorState(null, 'runtime-editor', 'editing:runtime');
    editor.modName = 'runtime';
    editor.displayName = 'Runtime 编辑包';
    setRuntimeEditorDefinition(editor, 'inits', { idName: 'first', name: 'First', description: '', defaultAreas: [] });
    setRuntimeEditorDefinition(editor, 'inits', { idName: 'second', name: 'Second', description: '', defaultAreas: [] });
    controller.panelState.runtimeDatapackEditor = editor;
    controller.runtimeEditorSurface = 'browser';
    controller.runtimeEditorPanelOpen = true;
    syncRuntimeEditorPanel(controller);

    const panel = document.querySelector<HTMLElement>('[data-runtime-editor-panel-host] .runtime-editor-panel')!;
    const browser = panel.querySelector('[data-runtime-editor-browser]');
    const kindsPane = browser?.querySelector('[data-codex-pane="mods"]');
    const entriesPane = browser?.querySelector('[data-codex-pane="entries"]');
    const detailPane = browser?.querySelector('[data-codex-pane="detail"]');
    const list = browser?.querySelector('[data-runtime-editor-browser-entry-list]');
    const detail = browser?.querySelector('[data-runtime-editor-browser-detail]');

    const rows = [...(browser?.querySelectorAll<HTMLElement>('[data-runtime-editor-entry]') ?? [])];
    const search = browser?.querySelector<HTMLInputElement>('[data-runtime-editor-browser-search]')!;
    search.value = 'first';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect([...browser!.querySelectorAll('[data-runtime-editor-entry]')]).toEqual(rows);
    expect(rows.map(row => row.hidden)).toEqual([false, true]);
    browser!.querySelector<HTMLElement>('[data-runtime-editor-filter="applied"]')!.click();
    expect([...browser!.querySelectorAll('[data-runtime-editor-entry]')]).toEqual(rows);
    expect(rows.every(row => row.hidden)).toBe(true);
    browser!.querySelector<HTMLElement>('[data-runtime-editor-filter="all"]')!.click();
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    panel.querySelector<HTMLElement>('[data-runtime-editor-definition-id="first"]')!.click();

    expect(editor.selectedDefinitionId).toBe('first');
    expect(browser?.querySelector('[data-codex-pane="mods"]')).toBe(kindsPane);
    expect(browser?.querySelector('[data-codex-pane="entries"]')).toBe(entriesPane);
    expect(browser?.querySelector('[data-codex-pane="detail"]')).toBe(detailPane);
    expect(browser?.querySelector('[data-runtime-editor-browser-entry-list]')).toBe(list);
    expect(browser?.querySelector('[data-runtime-editor-browser-detail]')).toBe(detail);
    expect(detail?.textContent).toContain('编辑 Init');
    expect(detail?.textContent).toContain('first');
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
    expect(controller.runtimeEditorCodexState.selectedModId).toBe(mod!.dataset.codexMod || null);
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
    expect(codex.querySelector('[data-codex-pane="entries"]')).toBe(entriesPane);
    expect(controller.runtimeEditorCodexState.selectedModId).toBe(mod.dataset.codexMod || null);
  });

  it('检查器页签切换只更新详情 slot，保留详情 Pane、标题和选中条目', () => {
    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector('[data-runtime-editor-panel-host] .runtime-editor-panel')!;
    const entry = panel.querySelector<HTMLElement>('[data-codex-entry]')!;
    entry.click();

    const codex = panel.querySelector('[data-runtime-editor-codex]')!;
    const detailPane = codex.querySelector('[data-codex-pane="detail"]');
    const detailHeader = detailPane?.querySelector('.runtime-editor-codex__detail-head');
    const detailSlot = detailPane?.querySelector('[data-codex-detail-slot]');
    const selectedEntry = panel.querySelector('[data-codex-entry].is-selected');
    const relationsTab = panel.querySelector<HTMLButtonElement>('[data-codex-inspector-tab="relations"]')!;
    relationsTab.click();

    expect(codex.querySelector('[data-codex-pane="detail"]')).toBe(detailPane);
    expect(detailPane?.querySelector('.runtime-editor-codex__detail-head')).toBe(detailHeader);
    expect(detailPane?.querySelector('[data-codex-detail-slot]')).toBe(detailSlot);
    expect(panel.querySelector('[data-codex-entry].is-selected')).toBe(selectedEntry);
    const activeTab = detailSlot?.querySelector('button[data-codex-inspector-tab="relations"]');
    expect(activeTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(activeTab);
  });

  it('键盘切换页签保留按钮与标题身份，重复同步不重建工具', () => {
    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector<HTMLElement>('[data-runtime-editor-codex]')!;
    panel.querySelector<HTMLElement>('[data-codex-entry]')!.click();
    const title = panel.querySelector('#runtime-editor-codex-detail-title');
    const overview = panel.querySelector<HTMLElement>('[data-codex-inspector-tab="overview"]')!;
    const raw = panel.querySelector<HTMLElement>('[data-codex-inspector-tab="raw"]')!;
    overview.focus();
    overview.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' }));
    expect(controller.runtimeEditorCodexInspectorTab).toBe('raw');
    expect(document.activeElement).toBe(raw);
    expect(panel.querySelector('#runtime-editor-codex-detail-title')).toBe(title);
    syncRuntimeEditorPanel(controller);
    expect(document.querySelector('[data-runtime-editor-codex]')).toBe(panel);
    expect(panel.querySelector('[data-codex-inspector-tab="raw"]')).toBe(raw);
  });

  it('条目标题在详情 shell header 安全转义，并只在一个位置出现', () => {
    const view = getRuntimeEditorCodexView(createUIContext(game));
    const entry = view.entries[0];
    const title = 'Unsafe <title> & "quoted"';
    const pane = document.createElement('div');
    pane.innerHTML = renderCodexDetailPane(
      { ...entry, label: title },
      view.loadedMods,
      () => '<p>资料正文</p>',
    );

    const heading = pane.querySelector<HTMLElement>('#runtime-editor-codex-detail-title');
    expect(heading?.textContent).toBe(title);
    expect(heading?.querySelector('title')).toBeNull();
    expect(pane.querySelector('.runtime-editor-codex__detail-body')?.textContent).toBe('资料正文');
    expect(pane.innerHTML.match(/Unsafe/g)).toHaveLength(1);
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
    expect(codex.querySelector('[data-codex-pane="detail"]')).toBe(firstDetail);
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

  it('搜索和输入法组合保留input、两侧Pane与仍可见的条目节点', () => {
    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector<HTMLElement>('[data-runtime-editor-codex]')!;
    const input = panel.querySelector<HTMLInputElement>('[data-codex-query]')!;
    const list = panel.querySelector('.runtime-editor-codex__entries-wrap');
    const pane = panel.querySelector('[data-codex-pane="entries"]');
    const first = panel.querySelector<HTMLElement>('[data-codex-entry]')!;
    const label = first.querySelector('strong')!.textContent!;
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = label;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    expect(controller.runtimeEditorCodexState.query).toBe('');
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    expect(controller.runtimeEditorCodexState.query).toBe(label);
    expect(panel.querySelector('[data-codex-query]')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(panel.querySelector('[data-codex-pane="entries"]')).toBe(pane);
    expect(panel.querySelector('.runtime-editor-codex__entries-wrap')).toBe(list);
    expect(panel.querySelector('[data-codex-entry]')).toBe(first);
  });

  it('跨筛选引用跳转保留列表范围；返回恢复页签和阅读位置，主动定位可撤回', () => {
    const source = game.runtimeContentBrowser.getView().entries
      .filter(entry => entry.ref.definitionKind === 'spots')
      .map(entry => game.runtimeContentBrowser.getDefinition(entry.ref))
      .find(detail => detail?.outgoingReferences.some(ref => ref.target?.definitionKind === 'areas' && ref.status === 'resolved'))!;
    const relation = source.outgoingReferences.find(ref => ref.target?.definitionKind === 'areas' && ref.status === 'resolved')!;
    const targetKey = codexEntryKey({ definitionKind: 'areas', fullId: relation.target!.fullId! });
    const sourceKey = codexEntryKey({ definitionKind: 'spots', fullId: source.summary.ref.fullId! });
    controller.runtimeEditorCodexState = { ...createCodexShellState(), query: relation.target!.fullId!, selectedKind: 'areas', selectedEntryKey: targetKey, mobilePane: 'detail' };
    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector<HTMLElement>('[data-runtime-editor-codex]')!;
    panel.querySelector<HTMLElement>('[data-codex-inspector-tab="relations"]')!.click();
    const list = panel.querySelector<HTMLElement>('.runtime-editor-codex__entries-wrap')!;
    const detail = panel.querySelector<HTMLElement>('.runtime-editor-codex__detail-body')!;
    list.scrollTop = 31;
    detail.scrollTop = 93;
    const link = [...panel.querySelectorAll<HTMLButtonElement>('[data-codex-reference-target]')].find(button => button.dataset.codexReferenceTarget === sourceKey)!;
    expect(link).toBeDefined();
    link.click();
    expect(controller.runtimeEditorCodexState.query).toBe(relation.target!.fullId);
    expect(controller.runtimeEditorCodexState.selectedEntryKey).toBe(sourceKey);
    expect(panel.querySelector('[data-codex-locate]')).not.toBeNull();
    panel.querySelector<HTMLElement>('[data-codex-locate]')!.click();
    expect(controller.runtimeEditorCodexState.query).toBe('');
    panel.querySelector<HTMLElement>('[data-codex-navigation="back"]')!.click();
    expect(controller.runtimeEditorCodexState.query).toBe(relation.target!.fullId);
    expect(controller.runtimeEditorCodexState.selectedEntryKey).toBe(sourceKey);
    panel.querySelector<HTMLElement>('[data-codex-navigation="back"]')!.click();
    expect(controller.runtimeEditorCodexState.selectedEntryKey).toBe(targetKey);
    expect(controller.runtimeEditorCodexInspectorTab).toBe('relations');
    expect(panel.querySelector('.runtime-editor-codex__entries-wrap')).toBe(list);
    expect(list.scrollTop).toBe(31);
    expect(detail.scrollTop).toBe(93);
  });

  it('历史最多保留50步并清理失效条目', () => {
    const view = getRuntimeEditorCodexView(createUIContext(game));
    const keys = view.entries.slice(0, 2).map(codexEntryKey);
    let state = createCodexShellState();
    for (let index = 0; index < 60; index++) state = reduceCodexShellState(view, state, { type: 'open-entry', entryKey: keys[index % 2] });
    expect(state.backStack).toHaveLength(50);
    expect(state.backReadings).toHaveLength(50);
    state = reduceCodexShellState({ ...view, entries: view.entries.filter(entry => codexEntryKey(entry) !== keys[0]) }, state, { type: 'go-back' });
    expect(state.backStack).not.toContain(keys[0]);
    expect(state.backReadings?.every(item => item.entryKey !== keys[0])).toBe(true);
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
    for (const entry of runtimeView.entries.filter(entry => entry.ref.definitionKind !== 'storyEntries' || !runtimeView.entries.some(other => ['activeStories', 'passiveStories'].includes(other.ref.definitionKind) && other.ref.fullId === entry.ref.fullId))) {
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
    expect(view.loadedMods.map(mod => mod.label)).toEqual(['known', '来源待确认']);
    expect(view.loadedMods.find(mod => mod.id === 'unknown')).toBeUndefined();
  });

  it('查看 Area 的入向关系时显示并打开引用它的 Spot', () => {
    const runtimeView = game.runtimeContentBrowser.getView();
    const source = runtimeView.entries
      .map(entry => game.runtimeContentBrowser.getDefinition(entry.ref))
      .find(detail => detail?.summary.ref.definitionKind === 'spots'
        && detail.outgoingReferences.some(reference => reference.path.endsWith('.areaId')
          && reference.status === 'resolved'
          && reference.target?.definitionKind === 'areas'));
    expect(source).toBeDefined();
    const reference = source!.outgoingReferences.find(item => item.path.endsWith('.areaId')
      && item.status === 'resolved'
      && item.target?.definitionKind === 'areas')!;
    const sourceKey = codexEntryKey({
      definitionKind: source!.summary.ref.definitionKind,
      fullId: source!.summary.ref.fullId!,
    });
    const target = reference.target!;
    const targetKey = codexEntryKey({
      definitionKind: target.definitionKind,
      fullId: target.fullId!,
    });
    const incoming = game.runtimeContentBrowser.getEntityRelations(target).incoming.find(item =>
      item.source.definitionKind === source!.summary.ref.definitionKind
      && item.source.fullId === source!.summary.ref.fullId
      && item.path === reference.path);
    expect(incoming).toBeDefined();

    openRuntimeEditorPanel(controller, 'codex');
    const panel = document.querySelector('[data-runtime-editor-panel-host]')!;
    const targetButton = [...panel.querySelectorAll<HTMLElement>('[data-codex-entry]')]
      .find(button => button.dataset.codexEntry === targetKey);
    expect(targetButton).toBeDefined();
    targetButton!.click();
    panel.querySelector<HTMLElement>('[data-codex-inspector-tab="relations"]')!.click();

    const inboundRows = [...panel.querySelectorAll<HTMLElement>('[data-codex-reference-source]')];
    const sourceRow = inboundRows.find(row =>
      [...row.querySelectorAll<HTMLElement>('[data-codex-reference-path]')].some(node => node.dataset.codexReferencePath === incoming!.path)
      && row.querySelector<HTMLButtonElement>('button[data-codex-reference-target]')?.dataset.codexReferenceTarget === sourceKey);
    expect(sourceRow).toBeDefined();
    const sourceButton = sourceRow!.querySelector<HTMLButtonElement>('button[data-codex-reference-target]')!;
    expect(sourceRow!.querySelector(`[data-codex-reference-path="${reference.path}"]`)).not.toBeNull();
    expect(sourceButton!.textContent).toContain(source!.summary.ref.fullId!);
    sourceButton!.click();
    expect(controller.runtimeEditorCodexState.selectedEntryKey).toBe(sourceKey);
    expect(panel.querySelector('[data-codex-detail-header]')?.textContent).toContain(source!.summary.ref.fullId!);
  });

  it('局部入向关系以引用者为跳转端并显示所属位置', () => {
    const runtimeView = game.runtimeContentBrowser.getView();
    const source = runtimeView.entries.find(entry => entry.ref.definitionKind === 'spots' && entry.ref.fullId !== null)!;
    const owner = runtimeView.entries.find(entry => entry.ref.definitionKind === 'areas' && entry.ref.fullId !== null)!;
    const reference: RuntimeContentReferenceDiagnostic = {
      source: source.ref,
      path: '$.operation.actorId',
      value: 'actor:local',
      relation: '局部演员',
      targetKind: 'actors',
      confidence: 'declared',
      scope: 'local',
      sourceCategory: 'definition',
      targetLocations: [{ ref: owner.ref, path: '$.actors[friend]' }],
      context: owner.ref,
      status: 'resolved',
      target: null,
      candidates: [],
    };
    const mockQuery = Object.create(game.runtimeContentBrowser) as typeof game.runtimeContentBrowser;
    Object.defineProperty(mockQuery, 'getEntityRelations', {
      configurable: true,
      value: () => ({ outgoing: [], incoming: [reference] }),
    });
    const mockGame = Object.create(game) as GameInstance;
    Object.defineProperty(mockGame, 'runtimeContentBrowser', { configurable: true, value: mockQuery });
    const context = { ...createUIContext(game), game: mockGame } as UIContext;
    const html = renderRuntimeEditorCodex(context, {
      ...createCodexShellState(),
      selectedEntryKey: codexEntryKey({ definitionKind: owner.ref.definitionKind, fullId: owner.ref.fullId! }),
      mobilePane: 'detail',
    }, 'relations');
    const rendered = document.createElement('div');
    rendered.innerHTML = html;

    const row = rendered.querySelector<HTMLElement>('[data-codex-reference-source]');
    const sourceButton = row?.querySelector<HTMLButtonElement>('button[data-codex-reference-target]');
    expect(sourceButton?.dataset.codexReferenceTarget).toBe(codexEntryKey({
      definitionKind: source.ref.definitionKind,
      fullId: source.ref.fullId!,
    }));
    expect(sourceButton?.textContent).toContain(source.ref.fullId!);
    expect(row?.textContent).toContain('局部位置');
    expect(row?.textContent).toContain('$.actors[friend]');
    expect(row?.querySelector(`[data-codex-reference-path="${reference.path}"]`)).not.toBeNull();
    expect(sourceButton?.dataset.codexReferenceTarget).not.toContain(reference.value);
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

    panel.querySelector<HTMLElement>('[data-codex-inspector-tab="raw"]')!.click();
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
      panel.querySelector<HTMLElement>('[data-codex-copy-id]')!.click();
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(entry!.ref.fullId));
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
