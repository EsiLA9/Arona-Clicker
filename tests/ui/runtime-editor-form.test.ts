// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { SPOT_CONTENT_POLICY } from '../../src/data-services/authoring/content-policy';
import type { UIContext } from '../../src/ui/context';
import {
  createRuntimeDatapackEditorState,
  markRuntimeEditorApplied,
  runtimeEditorEntryState,
  runtimeEditorPendingSpots,
  setRuntimeEditorSpot,
} from '../../src/ui/workspace/runtime-datapack-editor-state';
import {
  problemFieldKey,
  readRuntimeEditorAffectorRows,
  readRuntimeEditorFields,
  renderRuntimeEditorAffectorList,
  renderRuntimeEditorFields,
  runtimeEditorDiff,
  runtimeEditorFieldViews,
  runtimeEditorInitialValues,
} from '../../src/ui/workspace/runtime-editor-form';

const AREA = 'base:area:main';

const ctx = {
  game: {
    registry: {
      areas: new Map([[AREA, { id: AREA, name: '主厅' }]]),
      resourceDisplays: new Map([
        ['base:resource:credit', { resourceId: 'base:resource:credit', label: '信用点', order: 1 }],
        ['base:resource:energy', { resourceId: 'base:resource:energy', label: '能量', order: 2 }],
      ]),
    },
  },
  view: { currentAreaId: AREA },
  escapeHtml: (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)),
} as unknown as UIContext;

const draftValues = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...runtimeEditorInitialValues(ctx, SPOT_CONTENT_POLICY),
  idName: 'printer',
  name: '打印机',
  baseCost: 12,
  ...overrides,
});

const runtimeSpot = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'draft-mod:spot:printer',
  areaId: AREA,
  name: '打印机',
  description: '',
  baseCost: { type: 'const', value: 12 },
  baseCostResource: 'base:resource:credit',
  baseCapacity: 0,
  ...overrides,
});

describe('策略驱动的编辑器表单', () => {
  test('字段视图来自策略表，引用候选来自当前 Registry', () => {
    const views = runtimeEditorFieldViews(ctx, SPOT_CONTENT_POLICY, runtimeEditorInitialValues(ctx, SPOT_CONTENT_POLICY));

    expect(views.map(view => view.key)).toEqual(SPOT_CONTENT_POLICY.fields.map(field => field.key));
    expect(views[0]).toMatchObject({ key: 'idName', label: 'Spot ID 名', control: 'text' });
    expect(views.find(view => view.key === 'areaId')).toMatchObject({
      control: 'select',
      value: AREA,
      options: [{ value: AREA, label: '主厅' }],
    });
    expect(views.find(view => view.key === 'baseYield')).toBeUndefined();
    expect(views.find(view => view.key === 'baseCostResource')?.value).toBe('base:resource:credit');
  });

  test('引用候选为空时给出提示，不伪造候选', () => {
    const emptyCtx = { ...ctx, game: { registry: { areas: new Map() } } } as unknown as UIContext;
    const views = runtimeEditorFieldViews(emptyCtx, SPOT_CONTENT_POLICY, runtimeEditorInitialValues(emptyCtx, SPOT_CONTENT_POLICY));

    expect(views.find(view => view.key === 'areaId')?.options).toEqual([]);
    expect(views.find(view => view.key === 'areaId')?.hint).toContain('没有可引用的 area');
  });

  test('表单读写往返：数值按 kind 转换，锁定字段仍然回读', () => {
    const values = draftValues();
    const scope = document.createElement('div');
    scope.innerHTML = renderRuntimeEditorFields(ctx, runtimeEditorFieldViews(ctx, SPOT_CONTENT_POLICY, values));
    const read = readRuntimeEditorFields(SPOT_CONTENT_POLICY, scope);

    expect(read).toMatchObject({ idName: 'printer', name: '打印机', baseCost: 12, areaId: AREA });
    expect(typeof read.baseCost).toBe('number');
    expect(typeof read.idName).toBe('string');

    const locked = renderRuntimeEditorFields(
      ctx,
      runtimeEditorFieldViews(ctx, SPOT_CONTENT_POLICY, values, { lockedFields: ['idName'] }),
    );
    expect(locked).toContain('disabled');
    const lockedScope = document.createElement('div');
    lockedScope.innerHTML = locked;
    expect(readRuntimeEditorFields(SPOT_CONTENT_POLICY, lockedScope).idName).toBe('printer');
  });

  test('持续资源 Affector 列表支持多行读写，并隐藏底层 Pack 字段', () => {
    const affectors = [
      { id: 'credit', type: 'resource-flow', mode: 'fixed', resource: 'base:resource:credit', amount: 2 },
      { id: 'energy', type: 'resource-flow', mode: 'per-level', resource: 'base:resource:energy', amount: 3 },
    ] as const;
    const scope = document.createElement('div');
    scope.innerHTML = renderRuntimeEditorAffectorList(ctx, affectors);

    expect(scope.querySelectorAll('[data-runtime-editor-affector-row]')).toHaveLength(2);
    expect(scope.textContent).toContain('固定持续');
    expect(scope.textContent).toContain('按 Spot 等级');
    expect(scope.textContent).not.toContain('effects');
    expect(scope.textContent).not.toContain('zoneModifiers');
    expect(scope.textContent).not.toContain('Affector Pack');
    expect(readRuntimeEditorAffectorRows(scope)).toEqual(affectors);
  });

  test('差异只列出被改动的字段，并按编码值比较', () => {
    const rows = runtimeEditorDiff(SPOT_CONTENT_POLICY, draftValues({ name: '改名后的打印机' }), runtimeSpot());

    expect(rows.filter(row => row.changed).map(row => row.key)).toEqual(['name']);
    expect(rows.find(row => row.key === 'baseCost')).toMatchObject({ changed: false, draft: '12', runtime: '12' });
    expect(rows.find(row => row.key === 'name')).toMatchObject({ changed: true, draft: '改名后的打印机', runtime: '打印机' });
    expect(runtimeEditorDiff(SPOT_CONTENT_POLICY, draftValues(), undefined)).toEqual([]);
  });

  test('Affector 列表参与 Draft/Runtime 差异比较', () => {
    const affectors = [{ id: 'credit', type: 'resource-flow', mode: 'fixed', resource: 'base:resource:credit', amount: 2 }] as const;
    const rows = runtimeEditorDiff(SPOT_CONTENT_POLICY, draftValues({ affectors }), { ...runtimeSpot(), affectors });
    expect(rows.find(row => row.key === 'affectors')).toMatchObject({ changed: false });
    expect(runtimeEditorDiff(
      SPOT_CONTENT_POLICY,
      draftValues({ affectors: [{ ...affectors[0], amount: 5 }] }),
      { ...runtimeSpot(), affectors },
    )).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'affectors', changed: true })]));
  });

  test('诊断路径映射回字段键，供表单高亮与定位', () => {
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { path: 'spot.baseYield', message: '' })).toBeUndefined();
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { path: 'idName', message: '' })).toBe('idName');
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { path: 'spot.functionalities', message: '' })).toBeUndefined();
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { message: '' })).toBeUndefined();
  });
});

describe('草稿条目编辑状态', () => {
  const spot = {
    idName: 'printer',
    areaId: AREA,
    name: '打印机',
    description: '',
    baseCost: 12,
    baseCostResource: 'base:resource:credit',
    baseCapacity: 0,
  };

  test('新建 → 已生效 → 已修改的推导，以及待应用清单', () => {
    const editor = createRuntimeDatapackEditorState(AREA);
    setRuntimeEditorSpot(editor, { ...spot });
    expect(runtimeEditorEntryState(editor, editor.spots[0])).toBe('created');
    expect(runtimeEditorPendingSpots(editor)).toHaveLength(1);

    markRuntimeEditorApplied(editor, true);
    expect(runtimeEditorEntryState(editor, editor.spots[0])).toBe('unchanged');
    expect(runtimeEditorPendingSpots(editor)).toEqual([]);

    editor.spots[0].name = '改名后的打印机';
    expect(runtimeEditorEntryState(editor, editor.spots[0])).toBe('modified');
    expect(runtimeEditorPendingSpots(editor)).toHaveLength(1);

    markRuntimeEditorApplied(editor, true);
    expect(runtimeEditorEntryState(editor, editor.spots[0])).toBe('unchanged');
  });
});
