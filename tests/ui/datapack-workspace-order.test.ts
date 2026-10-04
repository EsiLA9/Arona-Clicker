// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { createUIContext } from '../../src/ui/context';
import { renderAppShell, type PanelState } from '../../src/ui/components/app-shell';
import { buildDatapackWorkspaceView, filterPacks, orderPacks, resolvePackIssues } from '../../src/arona-clicker/services/datapack-workspace-view';
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
      funcletDefs: [],
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
    registerDemo(runtime, ['ghost']);
  });

  it('列表按草案顺序渲染，而不是正式顺序', () => {
    const base = runtime.getPackCatalog().entries.find(entry => entry.modName === 'base')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;

    const reversed = renderDatapack(runtime, {
      section: 'all', mode: 'classic', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [demo, base],
      validation: null, lastResult: null,
    });
    expect(reversed.indexOf(`data-pack-id="demo@1.0.0"`)).toBeLessThan(reversed.indexOf(`data-pack-id="base@1.0.0"`));

    const formal = renderDatapack(runtime, {
      section: 'all', mode: 'classic', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo],
      validation: null, lastResult: null,
    });
    expect(formal.indexOf(`data-pack-id="base@1.0.0"`)).toBeLessThan(formal.indexOf(`data-pack-id="demo@1.0.0"`));
  });

  it('经典包模式显示拖放列表与正式启用草案状态', () => {
    const base = runtime.getPackCatalog().entries.find(entry => entry.modName === 'base')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;

    const enabledSection = renderDatapack(runtime, {
      section: 'enabled', mode: 'classic', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo],
      validation: null, lastResult: null,
    });
    expect(enabledSection).toContain('data-pack-list="enabled"');
    expect(enabledSection).toContain('data-pack-list="disabled"');
    expect(enabledSection).toContain('data-pack-apply');
  });

  it('启用中的 base 不可自由拖动；未启用的 base 可拖向同名交换', () => {
    const base = runtime.getPackCatalog().entries.find(entry => entry.modName === 'base')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;
    const created = runtime.createEditingPack(base, '2.0.0');
    if (!created.ok || !created.packRecordId) throw new Error(created.message);

    const html = renderDatapack(runtime, {
      section: 'all', mode: 'classic', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo, created.packRecordId],
      validation: null, lastResult: null,
    });
    expect(html).toContain('data-pack-id="base@1.0.0" draggable="false"');
    expect(html).toContain('data-pack-id="demo@1.0.0" draggable="true"');
    expect(html).toContain(`data-pack-id="${created.packRecordId}" draggable="true"`);
  });

  it('导航计数按包库记录与固定目录来源分类', () => {
    const base = runtime.getPackCatalog().entries.find(entry => entry.modName === 'base')!.id;
    const demo = runtime.getPackCatalog().entries.find(entry => entry.modName === 'demo')!.id;

    const html = renderDatapack(runtime, {
      section: 'issues', mode: 'classic', selectedPackId: null,
      draftEnabledIds: [base, demo], draftOrder: [base, demo],
      validation: null, lastResult: null,
    });
    expect(html).toContain('2 启用 · 2 条记录');
    expect(html).toContain('data-datapack-mode="classic"');
    expect(html).toContain('data-datapack-mode="development"');
    expect(html).toContain('data-pack-id="demo@1.0.0"');
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

  it('DatapackWorkspaceView 一次派生草案顺序、启用集、选中项与分区计数', () => {
    const entries = [
      entryOf('a@1', { modName: 'a', enabled: true }),
      entryOf('b@1', { modName: 'b', enabled: false, dependencies: ['missing'] }),
    ];
    const view = buildDatapackWorkspaceView({
      entries,
      section: 'issues',
      draftOrder: ['b@1', 'a@1'],
      draftEnabledIds: ['a@1', 'b@1'],
      selectedPackId: 'b@1',
      validation: { ok: false, errors: ['b 有效性检查失败'], warnings: [] },
    });

    expect(view.orderedEntries.map(entry => entry.id)).toEqual(['b@1', 'a@1']);
    expect(view.filteredEntries.map(entry => entry.id)).toEqual(['b@1']);
    expect(view.selection?.id).toBe('b@1');
    expect(view.draftEnabledIds).toEqual(new Set(['a@1', 'b@1']));
    expect(view.issues.get('b@1')?.some(issue => issue.kind === 'missing-dependency')).toBe(true);
    expect(view.invalidIds).toEqual(new Set(['b@1']));
    expect(view.sections.find(section => section.id === 'issues')?.count).toBe(1);
    expect(view.changed).toBe(true);
    expect(view.canApply).toBe(true);
  });
});
