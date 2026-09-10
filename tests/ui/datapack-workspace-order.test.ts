// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { createUIContext } from '../../src/ui/context';
import { renderAppShell, type PanelState } from '../../src/ui/components/app-shell';
import { filterPacks, orderPacks, resolvePackIssues } from '../../src/ui/components/service-workspace';
import type { PackCatalogEntry } from '../../src/arona-clicker/contracts';

const baseState = (): PanelState => ({
  service: 'game',
  leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
  chatEntries: [], chatTexts: [], selectedVariantId: null,
  conversationVariantId: null, studentChats: {}, studentChatTexts: {}, storyNavPath: [],
});

function registerDemo(runtime: AronaClickerRuntime, dependencies: string[] = []): void {
  runtime.registerParsedPack({
    manifest: { modName: 'demo', name: 'Demo Pack', version: '1.0.0', dependencies },
    datapack: {
      name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [],
      activeStories: [], passiveStories: [], stories: [], items: [], characters: [],
      characterBonuses: [], funcletDefs: [],
      pics: [{ id: 'demo:avatar(pic):x', src: 'zip:x.png' }],
    },
    images: [{ path: 'x.png', url: 'data:image/png;base64,x' }],
    jsonFileCount: 1,
    ignoredCount: 0,
  });
}

function renderDatapack(runtime: AronaClickerRuntime, workspace: NonNullable<PanelState['datapackWorkspace']>): string {
  return renderAppShell(createUIContext(runtime), { ...baseState(), service: 'datapack', datapackWorkspace: workspace });
}

const entryOf = (id: string, overrides: Partial<PackCatalogEntry> = {}): PackCatalogEntry => ({
  id, modName: id.split('@')[0], name: id, version: '1.0.0', dependencies: [],
  sourceKind: 'zip', importedAt: 0, enabled: false, ...overrides,
});

describe('数据包工作区排序与默认行为', () => {
  let runtime: AronaClickerRuntime;

  beforeEach(() => {
    runtime = new AronaClickerRuntime();
    registerDemo(runtime);
  });

  it('列表按草案顺序渲染，而不是正式顺序', () => {
    const base = runtime.getPackCatalog().entries.find(entry => entry.sourceKind === 'builtin')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;

    const reversed = renderDatapack(runtime, {
      section: 'all', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [demo, base],
      validation: null, lastResult: null,
    });
    expect(reversed.indexOf(`data-pack-id="${demo}"`)).toBeLessThan(reversed.indexOf(`data-pack-id="${base}"`));

    const formal = renderDatapack(runtime, {
      section: 'all', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo],
      validation: null, lastResult: null,
    });
    expect(formal.indexOf(`data-pack-id="${base}"`)).toBeLessThan(formal.indexOf(`data-pack-id="${demo}"`));
  });

  it('仅在「全部数据包」分区允许调整加载顺序', () => {
    const base = runtime.getPackCatalog().entries.find(entry => entry.sourceKind === 'builtin')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;

    const enabledSection = renderDatapack(runtime, {
      section: 'enabled', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo],
      validation: null, lastResult: null,
    });
    expect(enabledSection).toContain('加载顺序只能在「全部数据包」中调整');
    expect(enabledSection).toContain('请在「全部数据包」中调整加载顺序');
  });

  it('核心包不可被普通包越过：对内置包上移按钮禁用', () => {
    const base = runtime.getPackCatalog().entries.find(entry => entry.sourceKind === 'builtin')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;

    const html = renderDatapack(runtime, {
      section: 'all', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo],
      validation: null, lastResult: null,
    });
    // demo 位于 base 之后，其上移目标是非可排序的核心包 → 禁用
    expect(html).toContain(`data-pack-draft-up="${demo}" title="前方是核心数据包，不可越过" disabled`);
  });

  it('导航计数与「有问题」分区使用草案口径', () => {
    registerDemo(runtime, ['ghost']);
    const base = runtime.getPackCatalog().entries.find(entry => entry.sourceKind === 'builtin')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;

    const html = renderDatapack(runtime, {
      section: 'issues', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo],
      validation: null, lastResult: null,
    });
    expect(html).toContain('2 启用 · 2 已导入');
    expect(html).toContain(`data-pack-id="${demo}"`);
  });

  it('resolvePackIssues 覆盖缺失依赖、modName 冲突与顺序异常', () => {
    const entries = [
      entryOf('a@1', { modName: 'a', dependencies: [] }),
      entryOf('b@1', { modName: 'b', dependencies: ['missing'] }),
      entryOf('c@1', { modName: 'a', dependencies: [] }),
    ];
    const enabledIds = new Set(['a@1', 'b@1', 'c@1']);
    const issues = resolvePackIssues(entries, ['b@1', 'a@1', 'c@1'], enabledIds);

    expect(issues.get('a@1')?.some(issue => issue.kind === 'duplicate-mod-name')).toBe(true);
    expect(issues.get('c@1')?.some(issue => issue.kind === 'duplicate-mod-name')).toBe(true);
    expect(issues.get('b@1')?.some(issue => issue.kind === 'missing-dependency')).toBe(true);
  });

  it('依赖排在依赖者之后时报告顺序异常', () => {
    const entries = [
      entryOf('dep@1', { modName: 'dep' }),
      entryOf('user@1', { modName: 'user', dependencies: ['dep'] }),
    ];
    const issues = resolvePackIssues(entries, ['user@1', 'dep@1'], new Set(['dep@1', 'user@1']));
    expect(issues.get('user@1')?.some(issue => issue.kind === 'dependency-order')).toBe(true);
  });

  it('orderPacks 在草案顺序缺失时回退到包库顺序', () => {
    const entries = [entryOf('a@1'), entryOf('b@1')];
    expect(orderPacks(entries, []).map(entry => entry.id)).toEqual(['a@1', 'b@1']);
    expect(orderPacks(entries, ['b@1']).map(entry => entry.id)).toEqual(['b@1', 'a@1']);
  });

  it('filterPacks 按草案启用集过滤，不依赖正式状态', () => {
    const entries = [entryOf('a@1', { enabled: true }), entryOf('b@1', { enabled: false })];
    const enabled = filterPacks('enabled', entries, entries, ['a@1', 'b@1'], new Set(['a@1', 'b@1']));
    const disabled = filterPacks('disabled', entries, entries, ['a@1', 'b@1'], new Set(['a@1', 'b@1']));
    expect(enabled.map(entry => entry.id)).toEqual(['a@1', 'b@1']);
    expect(disabled).toEqual([]);
  });
});
