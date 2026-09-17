// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { SPOT_CONTENT_POLICY } from '../../src/data-services/authoring/content-policy';
import type { UIContext } from '../../src/ui/context';
import {
  createRuntimeDatapackEditorState,
  markRuntimeEditorApplied,
  runtimeEditorEntryState,
  runtimeEditorPendingSpots,
  setRuntimeEditorProblems,
  setRuntimeEditorSpot,
} from '../../src/ui/runtime-editor/state';
import {
  normalizeEntityNameValues,
  problemFieldKey,
  problemSectionId,
  readRuntimeEditorFields,
  renderRuntimeEditorFields,
  runtimeEditorDiff,
  runtimeEditorFieldViews,
  runtimeEditorInitialValues,
} from '../../src/ui/runtime-editor/form';
import { readFunctionalityRows, readPaymentOptionRows, renderFunctionalityList, renderPaymentOptionList } from '../../src/ui/runtime-editor/collections';
import { collectionPrototype, normalizeConditionRoot, PAYMENT_OPTION_PROTOTYPE } from '../../src/ui/runtime-editor/collection-prototypes';
import {
  conditionAtPath,
  conditionPathForElement,
  renderAdditionalConditionHtml,
  readConditionEditor,
  readAtomicConditionEditor,
  readEffectEditor,
  renderAtomicConditionEditor,
  renderConditionEditor,
  renderConditionEditorList,
  renderConditionItemHtml,
  renderEffectEditor,
  replaceConditionAtPath,
} from '../../src/ui/runtime-editor/dsl-editors';
import { conditionTargetEditorOf, renderConditionTargetFields } from '../../src/ui/runtime-editor/condition-target-editors';
import { renderRuntimeSpotForm } from '../../src/ui/runtime-editor/view';
import type { ConditionGroup } from '../../src/engine/types/expression';
import type { PanelState } from '../../src/ui/components/app-shell';

const AREA = 'base:area:main';

const ctx = {
  game: {
    registry: {
      areas: new Map([[AREA, { id: AREA, name: '主厅' }]]),
      resourceDisplays: new Map([
        ['base:resource:credit', { resourceId: 'base:resource:credit', label: '信用点', order: 1 }],
        ['base:resource:energy', { resourceId: 'base:resource:energy', label: '能量', order: 2 }],
      ]),
      items: new Map([
        ['base:item:ticket', { id: 'base:item:ticket', name: '活动票券' }],
      ]),
      shops: new Map(),
      gachaPools: new Map(),
    },
  },
  view: { currentAreaId: AREA },
  escapeHtml: (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)),
} as unknown as UIContext;

const draftValues = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...runtimeEditorInitialValues(ctx, SPOT_CONTENT_POLICY),
  idName: 'printer',
  name: '打印机',
  ...overrides,
});

const runtimeSpot = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'draft-mod:spot:printer',
  areaId: AREA,
  name: '打印机',
  description: '',
  purchaseOptions: [{ id: 'free', label: '免费', costs: [] }],
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
    expect(views.find(view => view.key === 'baseCost')).toBeUndefined();
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

    expect(read).toMatchObject({ idName: 'printer', name: '打印机', areaId: AREA });
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

  test('entityName 字段读入大写时自动转小写，并返回被改写字段标签', () => {
    const values = draftValues({ idName: 'Printer-A' });

    expect(normalizeEntityNameValues(SPOT_CONTENT_POLICY, values)).toEqual(['Spot ID 名']);
    expect(values.idName).toBe('printer-a');
    expect(normalizeEntityNameValues(SPOT_CONTENT_POLICY, draftValues())).toEqual([]);
  });

  test('功能集合以摘要行呈现：新建不铺开字段，详情在条目子编辑弹窗', () => {
    const functionalities = [
      { id: 'credit', kind: 'flow', resource: 'base:resource:credit', amount: 2 },
      { id: 'energy', kind: 'linearYield', resource: 'base:resource:energy', amountPerLevel: 3 },
    ] as const;
    const scope = document.createElement('div');
    scope.innerHTML = renderFunctionalityList(ctx, functionalities);

    // 每行只有「类型 + 注释名 + 操作」，没有铺开的字段控件。
    expect(scope.querySelectorAll('[data-runtime-collection-row]')).toHaveLength(2);
    expect(scope.querySelectorAll('[data-runtime-item-field]')).toHaveLength(0);
    expect(scope.textContent).toContain('持续产出');
    expect(scope.textContent).toContain('按等级产出');
    expect(scope.textContent).not.toContain('zoneModifiers');
    // 行内 hidden 承载整条 JSON：回读与原型一致。
    expect(readFunctionalityRows(scope)).toEqual(functionalities);
  });

  test('集合原型可复用：新增一行只给出最小原型，字段留给弹窗', () => {
    const scope = document.createElement('div');
    scope.innerHTML = renderFunctionalityList(ctx, []);
    const prototype = collectionPrototype('functionality')!;
    const empty = prototype.createEmpty(ctx);

    expect(empty).toMatchObject({ kind: 'flow' });
    expect(Object.keys(empty)).toEqual(expect.arrayContaining(['id', 'kind']));
    // 原型自带摘要能力：同一份原型既渲染行、也渲染弹窗表单。
    const scope2 = document.createElement('div');
    scope2.innerHTML = prototype.renderItem(ctx, empty as never);
    expect(scope2.querySelector('[data-runtime-item-field="kind"]')).not.toBeNull();
    expect(scope2.querySelector('[data-runtime-item-condition-host]')).not.toBeNull();
  });

  test('差异只列出被改动的字段，并按编码值比较', () => {
    const rows = runtimeEditorDiff(SPOT_CONTENT_POLICY, draftValues({ name: '改名后的打印机' }), runtimeSpot());

    expect(rows.filter(row => row.changed).map(row => row.key)).toEqual(['name']);
    expect(rows.find(row => row.key === 'purchaseOptions')).toMatchObject({ changed: false });
    expect(rows.find(row => row.key === 'name')).toMatchObject({ changed: true, draft: '改名后的打印机', runtime: '打印机' });
    expect(runtimeEditorDiff(SPOT_CONTENT_POLICY, draftValues(), undefined)).toEqual([]);
  });

  test('功能列表参与 Draft/Runtime 差异比较', () => {
    const functionalities = [{ id: 'credit', kind: 'flow', resource: 'base:resource:credit', amount: 2 }];
    const encoded = [{ id: 'runtime:resource:credit', kind: 'flow', resource: 'base:resource:credit', amount: 2 }];
    const rows = runtimeEditorDiff(SPOT_CONTENT_POLICY, draftValues({ functionalities }), { ...runtimeSpot(), functionalities: encoded });
    expect(rows.find(row => row.key === 'functionalities')).toMatchObject({ changed: false });
    expect(runtimeEditorDiff(
      SPOT_CONTENT_POLICY,
      draftValues({ functionalities: [{ ...functionalities[0], amount: 5 }] }),
      { ...runtimeSpot(), functionalities: encoded },
    )).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'functionalities', changed: true })]));
  });

  test('诊断路径映射回字段键，供表单高亮与定位', () => {
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { path: 'spot.baseYield', message: '' })).toBeUndefined();
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { path: 'idName', message: '' })).toBe('idName');
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { path: 'spot.functionalities', message: '' })).toBeUndefined();
    expect(problemFieldKey(SPOT_CONTENT_POLICY, { message: '' })).toBeUndefined();
  });

  test('诊断可映射到 Switch 与集合条目', () => {
    const paymentProblem = { code: 'invalid-field', path: 'spot.purchaseOptions[0].costs[0].amount', message: '金额不合法' };
    const areaProblem = { code: 'invalid-field', path: 'spot.areaId', message: '区域不存在' };
    expect(problemSectionId(SPOT_CONTENT_POLICY, paymentProblem)).toBe('payments');
    expect(problemSectionId(SPOT_CONTENT_POLICY, areaProblem)).toBe('ownership');

    const editor = createRuntimeDatapackEditorState(AREA);
    editor.modName = 'draft-mod';
    editor.displayName = 'Draft Mod';
    editor.activeSection = 'payments';
    setRuntimeEditorSpot(editor, {
      idName: 'printer', areaId: AREA, name: '打印机', description: '',
      purchaseOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount: 0 }] }],
    });
    setRuntimeEditorProblems(editor, [paymentProblem, areaProblem]);
    const scope = document.createElement('div');
    scope.innerHTML = renderRuntimeSpotForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState);

    expect(scope.querySelector('[data-runtime-editor-section-tab="payments"]')?.classList.contains('has-runtime-editor-problem')).toBe(true);
    expect(scope.querySelector('[data-runtime-editor-section-tab="payments"] .runtime-editor-tab-error')?.textContent).toBe('1');
    expect(scope.querySelector('[data-runtime-collection="payment-options"] [data-runtime-collection-row]')?.classList.contains('has-runtime-editor-problem')).toBe(true);
    expect(scope.querySelector('.runtime-collection-error')?.textContent).toContain('金额不合法');
    expect(scope.querySelector('[data-runtime-editor-section-tab="ownership"]')?.classList.contains('has-runtime-editor-problem')).toBe(true);
  });
});

describe('Spot 编辑外壳分页', () => {
  const renderForm = (editor: ReturnType<typeof createRuntimeDatapackEditorState>): HTMLElement => {
    const scope = document.createElement('div');
    scope.innerHTML = renderRuntimeSpotForm(ctx, { runtimeDatapackEditor: editor } as unknown as PanelState);
    return scope;
  };

  test('页互相隔离：DOM 中只出现当前页，切页后渲染对应页', () => {
    const editor = createRuntimeDatapackEditorState(AREA);
    const scope = renderForm(editor);

    const tabs = [...scope.querySelectorAll<HTMLElement>('[data-runtime-editor-section-tab]')];
    expect(tabs).toHaveLength(SPOT_CONTENT_POLICY.sections!.length);
    // 隔离：只渲染当前页，其余页不在 DOM 中。
    const pages = [...scope.querySelectorAll<HTMLElement>('[data-runtime-editor-section]')];
    expect(pages).toHaveLength(1);
    expect(pages[0].dataset.runtimeEditorSection).toBe('overview');
    expect(scope.querySelector('[data-runtime-editor-field="idName"]')).toBeNull();

    editor.activeSection = 'basics';
    const basics = renderForm(editor);
    expect(basics.querySelectorAll<HTMLElement>('[data-runtime-editor-section]')).toHaveLength(1);
    expect(basics.querySelector('[data-runtime-editor-section="basics"] [data-runtime-editor-field="idName"]')).not.toBeNull();
    expect(basics.querySelector('[data-runtime-editor-field="baseCapacity"]')).toBeNull();

    editor.activeSection = 'functionalities';
    const feature = renderForm(editor);
    expect(feature.querySelector('[data-runtime-collection="functionality"]')).not.toBeNull();
    expect(feature.querySelector('[data-runtime-editor-field="idName"]')).toBeNull();

    editor.activeSection = 'diagnostics';
    const diagnostics = renderForm(editor);
    expect(diagnostics.querySelector('[data-runtime-editor-section="diagnostics"]')).not.toBeNull();
  });

  test('表单暂存优先于 Draft：切页汇总后的值可回灌到任意页', () => {
    const editor = createRuntimeDatapackEditorState(AREA);
    editor.activeSection = 'basics';
    editor.formDraft = { idName: 'stashed', name: '暂存名' };
    const scope = renderForm(editor);
    expect(scope.querySelector<HTMLInputElement>('[data-runtime-editor-field="idName"]')?.value).toBe('stashed');
  });
});

describe('条件与效果子编辑器', () => {
  test('条件编辑器往返：嵌套组可读回，空组归一化为未设置', () => {
    const scope = document.createElement('div');
    scope.innerHTML = renderConditionEditor(ctx, {
      type: 'AND',
      conditions: [
        { target: 'resource', key: 'base:resource:credit', comparator: '>=', value: 10 },
        { type: 'OR', conditions: [{ target: 'flag', key: 'done', comparator: '==', value: 1 }] },
      ],
    });

    expect(scope.querySelectorAll('[data-runtime-condition-item="condition"]')).toHaveLength(2);
    expect(scope.querySelectorAll('[data-runtime-condition]')).toHaveLength(2);
    expect(scope.querySelectorAll('[data-runtime-condition-field]')).toHaveLength(0);
    expect(scope.textContent).toContain('全部满足（AND）');
    expect(scope.textContent).toContain('任一满足（OR）');
    expect(scope.textContent).toContain('资源数量 · 信用点 >= 10');

    const nestedItem = scope.querySelectorAll<HTMLElement>('[data-runtime-condition-item="condition"]')[1];
    expect(conditionPathForElement(nestedItem)).toEqual([1, 0]);

    // 往返自洽：读回 → 重渲染 → 再读回结果稳定（嵌套深度与分组方式保持不变）。
    const first = readConditionEditor(scope);
    expect(first?.type).toBe('AND');
    expect(first?.conditions).toHaveLength(2);
    expect((first?.conditions[1] as { type: string }).type).toBe('OR');

    const again = document.createElement('div');
    again.innerHTML = renderConditionEditor(ctx, first);
    expect(readConditionEditor(again)).toEqual(first);

    const empty = document.createElement('div');
    empty.innerHTML = renderConditionEditor(ctx, undefined);
    expect(readConditionEditor(empty)).toBeUndefined();
  });

  test('支付方案集合支持混合费用，等级升级复用同一支付方案原型', () => {
    const options = [{
      id: 'credit-ticket',
      label: '信用点与票券',
      costs: [
        { type: 'resource' as const, resourceId: 'base:resource:credit', amount: 10 },
        { type: 'item' as const, itemId: 'base:item:ticket', amount: 2 },
      ],
    }];
    const scope = document.createElement('div');
    scope.innerHTML = renderPaymentOptionList(ctx, options);

    expect(scope.querySelector('[data-runtime-collection="payment-options"]')).not.toBeNull();
    expect(readPaymentOptionRows(scope)).toEqual(options);
    const optionForm = document.createElement('div');
    optionForm.innerHTML = PAYMENT_OPTION_PROTOTYPE.renderItem(ctx, options[0]);
    expect(optionForm.querySelector('[data-runtime-collection="payment-costs"]')).not.toBeNull();
    expect(PAYMENT_OPTION_PROTOTYPE.readItem(optionForm, options[0])).toEqual(options[0]);

    const levelPrototype = collectionPrototype('level-upgrade')!;
    const level = { level: 2, paymentOptions: options, effects: [] };
    const levelForm = document.createElement('div');
    levelForm.innerHTML = levelPrototype.renderItem(ctx, level as never);
    expect(levelForm.querySelector('[data-runtime-collection="payment-options"]')).not.toBeNull();
    expect(levelPrototype.readItem(levelForm, level as never)).toEqual(level);
  });

  test('原子条件弹窗保留四元组，摘要中的用户输入经过转义', () => {
    const condition = { target: 'flag' as const, key: '<script>alert(1)</script>', comparator: '==' as const, value: 1 };
    const scope = document.createElement('div');
    scope.innerHTML = renderConditionEditor(ctx, { type: 'AND', conditions: [condition] });
    expect(scope.querySelector('.runtime-condition-summary')?.innerHTML).not.toContain('<script>');
    expect(scope.textContent).toContain('<script>alert(1)</script>');

    const dialog = document.createElement('div');
    dialog.innerHTML = renderAtomicConditionEditor(ctx, condition);
    expect(readAtomicConditionEditor(dialog)).toEqual(condition);
    dialog.querySelector<HTMLInputElement>('[data-runtime-condition-editor-field="key"]')!.value = 'updated';
    expect(readAtomicConditionEditor(dialog).key).toBe('updated');
  });

  test('条件路径可以稳定替换嵌套原子条件', () => {
    const original: ConditionGroup = {
      type: 'AND',
      conditions: [{ type: 'OR', conditions: [{ target: 'flag', key: 'done', comparator: '==', value: 1 }] }],
    };
    const updated = replaceConditionAtPath(original, [0, 0], { target: 'flag', key: 'seen', comparator: '>=', value: 2 });
    expect(conditionAtPath(updated, [0, 0])).toEqual({ target: 'flag', key: 'seen', comparator: '>=', value: 2 });
    expect(updated.type).toBe('AND');
    expect((updated.conditions[0] as { type: string }).type).toBe('OR');
  });

  test('并列 runtime-condition 以 OR 显示并读回为外层 OR 组', () => {
    const scope = document.createElement('div');
    scope.innerHTML = renderConditionEditorList(ctx, {
      type: 'AND',
      conditions: [{ target: 'flag', key: 'first', comparator: '==', value: 1 }],
    });
    const list = scope.querySelector<HTMLElement>('[data-runtime-condition-list]')!;
    list.insertAdjacentHTML('beforeend', renderAdditionalConditionHtml(ctx));
    list.querySelectorAll<HTMLElement>('[data-runtime-condition-items]')[1]
      .insertAdjacentHTML('beforeend', renderConditionItemHtml(ctx));

    expect(list.querySelectorAll('[data-runtime-condition]').length).toBe(2);
    expect(list.querySelector('[data-runtime-condition-outer-relation]')?.textContent).toBe('OR');
    expect(conditionPathForElement(list.querySelectorAll<HTMLElement>('[data-runtime-condition-item="condition"]')[1])).toEqual([1, 0]);
    const expected = {
      type: 'OR',
      conditions: [
        { type: 'AND', conditions: [{ target: 'flag', key: 'first', comparator: '==', value: 1 }] },
        { type: 'AND', conditions: [{ target: 'alwaysTrue', key: '', comparator: '==', value: 1 }] },
      ],
    } satisfies ConditionGroup;
    expect(readConditionEditor(scope)).toEqual(expected);

    const rerendered = document.createElement('div');
    rerendered.innerHTML = renderConditionEditorList(ctx, expected);
    expect(rerendered.querySelectorAll('[data-runtime-condition-outer]')).toHaveLength(2);
    expect(rerendered.querySelector('[data-runtime-condition-outer-relation]')?.textContent).toBe('OR');
    expect(readConditionEditor(rerendered)).toEqual(expected);
  });

  test('条件编辑器已打开并清空时不会回退旧条件', () => {
    const prototype = collectionPrototype('functionality')!;
    const item = {
      id: 'test',
      kind: 'restartInit' as const,
      condition: { type: 'AND' as const, conditions: [{ target: 'flag' as const, key: 'old', comparator: '==', value: 1 as number }] },
    };
    const scope = document.createElement('div');
    scope.innerHTML = prototype.renderItem(ctx, item as never);
    scope.querySelector('[data-runtime-condition-item="condition"]')?.remove();
    expect(prototype.readItem(scope, item as never)).not.toHaveProperty('condition');
  });

  test('新增叶条件默认显示 True，根层多个组合条件归一化为 OR', () => {
    const prototype = collectionPrototype('functionality')!;
    const scope = document.createElement('div');
    scope.innerHTML = renderConditionEditor(ctx, { type: 'AND', conditions: [] });
    scope.querySelector<HTMLElement>('[data-runtime-condition-items]')!.insertAdjacentHTML(
      'beforeend',
      '<div data-runtime-condition-item="condition"><button data-runtime-condition-edit data-runtime-condition-target="alwaysTrue" data-runtime-condition-key="" data-runtime-condition-comparator="==" data-runtime-condition-value="1"><span data-runtime-condition-summary-text>True</span></button></div>',
    );
    expect(scope.querySelector('[data-runtime-condition-summary-text]')?.textContent).toBe('True');
    expect(normalizeConditionRoot({
      type: 'AND',
      conditions: [
        { type: 'AND', conditions: [{ target: 'flag', key: 'a', comparator: '==', value: 1 }] },
        { type: 'AND', conditions: [{ target: 'flag', key: 'b', comparator: '==', value: 1 }] },
      ],
    }).type).toBe('OR');
    expect(prototype.normalizeItem).toBeDefined();
  });

  test('目标编辑器注册表为 alwaysTrue 提供无字段编辑器', () => {
    const editor = conditionTargetEditorOf('alwaysTrue');
    expect(editor?.fields).toEqual([]);
    expect(editor?.createDefault()).toEqual({ target: 'alwaysTrue', key: '', comparator: '==', value: 1 });
    expect(renderConditionTargetFields(ctx, editor!.createDefault())).toContain('始终成立');
  });

  test('引用型目标使用 Registry 候选并保留引用 ID', () => {
    const resource = renderConditionTargetFields(ctx, { target: 'resource', key: 'base:resource:credit', comparator: '>=', value: 10 });
    expect(resource).toContain('list="runtime-condition-options-resource"');
    expect(resource).toContain('value="base:resource:credit"');
    expect(resource).toContain('>信用点</option>');

    const area = renderConditionTargetFields(ctx, { target: 'area', key: AREA, comparator: '==', value: 1 });
    expect(area).toContain('list="runtime-condition-options-area"');
    expect(area).toContain('>主厅</option>');
  });

  test('效果编辑器往返：数值解析为数字，空列表保持为空数组', () => {
    const scope = document.createElement('div');
    scope.innerHTML = renderEffectEditor(ctx, [{ op: 'addResource', target: 'base:resource:credit', value: 5 }]);
    expect(readEffectEditor(scope)).toEqual([{ op: 'addResource', target: 'base:resource:credit', value: 5 }]);

    const empty = document.createElement('div');
    empty.innerHTML = renderEffectEditor(ctx, []);
    expect(readEffectEditor(empty)).toEqual([]);
  });
});

describe('草稿条目编辑状态', () => {
  const spot = {
    idName: 'printer',
    areaId: AREA,
    name: '打印机',
    description: '',
    purchaseOptions: [{ id: 'free', label: '免费', costs: [] }],
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
