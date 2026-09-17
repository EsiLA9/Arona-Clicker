// ============================================================
// ui/runtime-editor/collection-prototypes.ts — 集合原型注册表
//
// 可变列表不各写一套渲染：集合 = 一份原型（空值 / 摘要 / 条目编辑 / 回读），
// 由通用渲染器与子弹窗消费。新增一类可变列表 = 注册一份原型，
// Reveal / Affector / 后续 Def 的同类字段都复用同一接口。
//
// 行内只呈现「类型 + 注释名」摘要；详尽字段在子编辑弹窗内。
// ============================================================

import { validateConditionGroup, validateEffectList } from '../../data-services/authoring/content-policy-dsl';
import type {
  PaymentCostDraft,
  PaymentOptionDraft,
  SpotFunctionalityDraft,
  SpotFunctionalityKind,
  SpotLevelUpgradeDraft,
  SpotRevealTriggerDraft,
} from '../../data-services/authoring/content-policy';
import type { RevealTarget } from '../../engine/contracts/reveal';
import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import type { UIContext } from '../context';
import type { RuntimeEditorProblemInput } from './form';
import { readConditionEditor, readEffectEditor, renderConditionEditor, renderConditionEditorList, renderEffectEditor } from './dsl-editors';

export type CollectionKind = 'object' | 'scalar';

export interface CollectionPrototype<T = unknown> {
  /** 集合 id（与 AuthoringExtension.editor 对应）。 */
  readonly id: string;
  /** 提交字段名（与 AuthoringExtension.inputKey 对应）。 */
  readonly field: string;
  /** object = 摘要行 + 子弹窗；scalar = 行内单值编辑。 */
  readonly kind: CollectionKind;
  readonly label: string;
  readonly hint: string;
  readonly addLabel: string;
  /** 新建条目：只给最小原型，其余字段在子弹窗内补全。 */
  createEmpty(ctx: UIContext): T;
  /** 摘要行：类型徽标 + 注释名。 */
  summary(ctx: UIContext, item: T): { readonly type: string; readonly note: string };
  /** 子弹窗内的详尽编辑表单（object 集合）。 */
  renderItem(ctx: UIContext, item: T): string;
  /** 从子弹窗 DOM 读回条目。 */
  readItem(scope: ParentNode, fallback: T): T;
  /** 保存前校验：返回消息则阻止保存。 */
  validate?(ctx: UIContext, item: T): string | undefined;
  /** 判别型集合根据首个枚举字段决定可见字段。 */
  readonly variantFields?: (variant: string) => readonly string[];
  /** 判别字段名；缺省为既有功能集合使用的 kind。 */
  readonly variantKey?: string;
  /** 集合写回前的结构归一化；只用于 Draft 结构，不参与条目路径编辑。 */
  readonly normalizeItem?: (item: T) => T;
}

const FUNCTIONALITY_KINDS: ReadonlyArray<{ value: SpotFunctionalityKind; label: string }> = [
  { value: 'flow', label: '持续产出资源' },
  { value: 'linearYield', label: '按等级产出资源' },
  { value: 'restartInit', label: '软重启入口' },
  { value: 'hardResetInit', label: '硬重置入口' },
  { value: 'gacha', label: '招募入口' },
  { value: 'shop', label: '商店入口' },
];

const REVEAL_TARGETS: ReadonlyArray<{ value: RevealTarget; label: string }> = [
  { value: 'existence', label: '出现' },
  { value: 'name', label: '名称' },
  { value: 'condition', label: '条件' },
  { value: 'utility', label: '用途' },
  { value: 'unlock', label: '解锁' },
];

const PAYMENT_COST_TYPES: ReadonlyArray<{ value: PaymentCostDraft['type']; label: string }> = [
  { value: 'resource', label: 'Resource' },
  { value: 'item', label: '物品' },
];

const PAYMENT_OPTION_ID_PATTERN = /^[a-z0-9_-]+$/;

function kindFields(kind: string): readonly string[] {
  switch (kind) {
    case 'flow': return ['resource', 'amount'];
    case 'linearYield': return ['resource', 'amountPerLevel', 'startLevel'];
    case 'shop': return ['shopId'];
    default: return [];
  }
}

function optionList(esc: (value: string) => string, options: ReadonlyArray<{ value: string; label: string }>, current: string): string {
  const known = options.some(option => option.value === current);
  const head = current && !known
    ? `<option value="${esc(current)}" selected="selected">${esc(current)}（当前 Registry 中不存在）</option>`
    : current ? '' : '<option value="">（未设置）</option>';
  return head + options.map(option => `<option value="${option.value}"${option.value === current ? ' selected="selected"' : ''}>${esc(option.label)}</option>`).join('');
}

function resourceOptions(ctx: UIContext) {
  return [...ctx.game.registry.resourceDisplays.values()]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(resource => ({ value: resource.resourceId, label: resource.label || resource.resourceId }));
}

function shopOptions(ctx: UIContext) {
  return [...ctx.game.registry.shops.values()].map(shop => ({ value: shop.id, label: shop.name || shop.id }));
}

function gachaPoolOptions(ctx: UIContext) {
  return [...ctx.game.registry.gachaPools.values()].map(pool => ({ value: pool.id, label: pool.name || pool.id }));
}

function labelOf(options: ReadonlyArray<{ value: string; label: string }>, value: string | undefined): string {
  if (!value) return '未设置';
  return options.find(option => option.value === value)?.label ?? value;
}

function itemField(key: string, label: string, control: string, hidden = false): string {
  return `<label class="user-theme-field"${hidden ? ' hidden' : ''} data-runtime-item-cell="${key}"><span>${label}</span>${control}</label>`;
}

function itemValue(scope: ParentNode, key: string): string {
  return scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-item-field="${key}"]`)?.value ?? '';
}

function itemNumber(scope: ParentNode, key: string): number | undefined {
  const raw = itemValue(scope, key).trim();
  return raw === '' ? undefined : Number(raw);
}

// --- 功能（functionalities） ---

export const FUNCTIONALITY_PROTOTYPE: CollectionPrototype<SpotFunctionalityDraft> = {
  id: 'functionality',
  field: 'functionalities',
  kind: 'object',
  label: '功能',
  hint: '产出类功能随解锁生效；入口类功能在 Spot 面板提供操作按钮。逐条进入子编辑弹窗配置。',
  addLabel: '添加功能',
  variantFields: kindFields,
  normalizeItem(item) {
    return { ...item, ...(item.condition ? { condition: normalizeConditionRoot(item.condition) } : {}) };
  },
  createEmpty(ctx) {
    return {
      id: `functionality-${Date.now().toString(36)}`,
      kind: 'flow',
      resource: [...ctx.game.registry.resourceDisplays.keys()][0] ?? '',
      amount: 1,
    };
  },
  summary(ctx, item) {
    const kindLabel = FUNCTIONALITY_KINDS.find(option => option.value === item.kind)?.label ?? item.kind;
    switch (item.kind) {
      case 'flow':
        return { type: '持续产出', note: `${labelOf(resourceOptions(ctx), item.resource)} +${item.amount ?? 0}` };
      case 'linearYield':
        return { type: '按等级产出', note: `${labelOf(resourceOptions(ctx), item.resource)} 每级 +${item.amountPerLevel ?? 0}` };
      case 'shop':
        return { type: '商店入口', note: labelOf(shopOptions(ctx), item.shopId) };
      case 'gacha':
        return { type: '招募入口', note: '使用专属卡池' };
      default:
        return { type: kindLabel, note: '操作入口' };
    }
  },
  renderItem(ctx, item) {
    const esc = ctx.escapeHtml;
    const active = new Set(kindFields(item.kind));
    const cell = (key: string, label: string, control: string) => active.has(key) ? itemField(key, label, control) : '';
    return `<div data-runtime-item-form="functionality">
      <label class="user-theme-field"><span>类型</span><select data-runtime-item-field="kind">${FUNCTIONALITY_KINDS
        .map(option => `<option value="${option.value}"${option.value === item.kind ? ' selected="selected"' : ''}>${option.label}</option>`)
        .join('')}</select></label>
      ${cell('resource', '产出资源', `<select data-runtime-item-field="resource">${optionList(esc, resourceOptions(ctx), item.resource ?? '')}</select>`)}
      ${cell('amount', '产出数量', `<input data-runtime-item-field="amount" type="number" min="0" step="any" value="${esc(String(item.amount ?? ''))}">`)}
      ${cell('amountPerLevel', '每级产出', `<input data-runtime-item-field="amountPerLevel" type="number" min="0" step="any" value="${esc(String(item.amountPerLevel ?? ''))}">`)}
      ${cell('startLevel', '起算等级', `<input data-runtime-item-field="startLevel" type="number" min="0" step="1" value="${esc(String(item.startLevel ?? ''))}">`)}
      ${cell('shopId', '商店', `<select data-runtime-item-field="shopId">${optionList(esc, shopOptions(ctx), item.shopId ?? '')}</select>`)}
      <div class="runtime-condition-actions"><span class="runtime-editor-hint">条件</span><button type="button" class="toolbar-button" data-runtime-item-condition>${(item.condition?.conditions?.length ?? 0) > 0 ? `条件（${item.condition!.conditions.length} 项）` : '添加条件'}</button></div>
      <div class="runtime-item-condition" data-runtime-item-condition-host hidden>${renderConditionEditorList(ctx, item.condition)}</div>
    </div>`;
  },
  readItem(scope, fallback) {
    const kind = itemValue(scope, 'kind') as SpotFunctionalityKind;
    const conditionHost = scope.querySelector('[data-runtime-item-condition-host]');
    const condition = conditionHost ? readConditionEditor(conditionHost) : fallback.condition;
    return {
      id: fallback.id,
      kind,
      ...(kind === 'flow' || kind === 'linearYield' ? { resource: itemValue(scope, 'resource') } : {}),
      ...(kind === 'flow' ? { amount: itemNumber(scope, 'amount') } : {}),
      ...(kind === 'linearYield' ? { amountPerLevel: itemNumber(scope, 'amountPerLevel') } : {}),
      ...(kind === 'linearYield' && itemNumber(scope, 'startLevel') ? { startLevel: itemNumber(scope, 'startLevel') } : {}),
      ...(kind === 'shop' ? { shopId: itemValue(scope, 'shopId') } : {}),
      ...(condition ? { condition } : {}),
    };
  },
};

// --- 支付费用项（PaymentOption.costs） ---

export const PAYMENT_COST_PROTOTYPE: CollectionPrototype<PaymentCostDraft> = {
  id: 'payment-costs',
  field: 'costs',
  kind: 'object',
  label: '费用项',
  hint: '同一支付方案内的所有费用项都会同时扣除。',
  addLabel: '添加费用项',
  variantKey: 'type',
  variantFields: type => type === 'item' ? ['itemId', 'amount'] : ['resourceId', 'amount'],
  createEmpty(ctx) {
    const firstResource = resourceOptions(ctx)[0]?.value;
    const firstItem = itemOptions(ctx)[0]?.value;
    return firstResource
      ? { type: 'resource', resourceId: firstResource, amount: 1 }
      : { type: 'item', itemId: firstItem ?? '', amount: 1 };
  },
  summary(ctx, item) {
    const target = item.type === 'resource'
      ? labelOf(resourceOptions(ctx), item.resourceId)
      : labelOf(itemOptions(ctx), item.itemId);
    return { type: item.type === 'resource' ? '资源' : '物品', note: `${target} × ${item.amount}` };
  },
  renderItem(ctx, item) {
    const esc = ctx.escapeHtml;
    const target = item.type === 'resource'
      ? `<select data-runtime-item-field="resourceId">${optionList(esc, resourceOptions(ctx), item.resourceId ?? '')}</select>`
      : `<select data-runtime-item-field="itemId">${optionList(esc, itemOptions(ctx), item.itemId ?? '')}</select>`;
    return `<div data-runtime-item-form="payment-cost">
      <label class="user-theme-field"><span>支付类型</span><select data-runtime-item-field="type">${PAYMENT_COST_TYPES
        .map(option => `<option value="${option.value}"${option.value === item.type ? ' selected="selected"' : ''}>${option.label}</option>`)
        .join('')}</select></label>
      <label class="user-theme-field"><span>${item.type === 'resource' ? '资源' : '物品'}</span>${target}</label>
      <label class="user-theme-field"><span>数量</span><input data-runtime-item-field="amount" type="number" min="0" step="${item.type === 'item' ? '1' : 'any'}" value="${esc(String(item.amount ?? ''))}"></label>
    </div>`;
  },
  readItem(scope, fallback) {
    const type = itemValue(scope, 'type') as PaymentCostDraft['type'];
    return {
      type,
      ...(type === 'resource' ? { resourceId: itemValue(scope, 'resourceId') } : { itemId: itemValue(scope, 'itemId') }),
      amount: itemNumber(scope, 'amount') ?? fallback.amount,
    };
  },
  validate(_ctx, item) {
    if (item.type !== 'resource' && item.type !== 'item') return '支付类型必须是 Resource 或物品';
    const target = item.type === 'resource' ? item.resourceId : item.itemId;
    if (!target?.trim()) return '支付资产不能为空';
    if (!Number.isFinite(item.amount) || item.amount < 0) return '支付数量必须是非负有限数字';
    if (item.type === 'item' && !Number.isInteger(item.amount)) return '物品支付数量必须是非负整数';
    return undefined;
  },
};

// --- 支付方案（Spot.purchaseOptions / LevelUpgrade.paymentOptions） ---

export const PAYMENT_OPTION_PROTOTYPE: CollectionPrototype<PaymentOptionDraft> = {
  id: 'payment-options',
  field: 'purchaseOptions',
  kind: 'object',
  label: '支付方案',
  hint: '多个方案之间为 OR；满足条件且余额足够的方案才可用于购买。全部删除表示无购买途径，免费请保留一个 costs 为空的方案。',
  addLabel: '添加支付方案',
  normalizeItem(item) {
    return { ...item, ...(item.condition ? { condition: normalizeConditionRoot(item.condition) } : {}), costs: [...item.costs] };
  },
  createEmpty(ctx) {
    const resource = resourceOptions(ctx)[0]?.value;
    const item = itemOptions(ctx)[0]?.value;
    return {
      id: `payment-${Date.now().toString(36)}`,
      label: '支付方案',
      costs: [resource
        ? { type: 'resource', resourceId: resource, amount: 1 }
        : { type: 'item', itemId: item ?? '', amount: 1 }],
    };
  },
  summary(_ctx, item) {
    return {
      type: item.label || item.id,
      note: `${item.costs.length} 项费用${item.condition ? ` · 条件 ${item.condition.conditions.length} 项` : ''}`,
    };
  },
  renderItem(ctx, item) {
    const esc = ctx.escapeHtml;
    return `<div data-runtime-item-form="payment-option">
      <label class="user-theme-field"><span>方案 ID</span><input data-runtime-item-field="id" value="${esc(item.id)}" pattern="[a-z0-9_-]+"></label>
      <label class="user-theme-field"><span>显示名称（可选）</span><input data-runtime-item-field="label" value="${esc(item.label ?? '')}"></label>
      <div class="runtime-condition-actions"><span class="runtime-editor-hint">条件</span><button type="button" class="toolbar-button" data-runtime-item-condition>${(item.condition?.conditions.length ?? 0) > 0 ? `条件（${item.condition!.conditions.length} 项）` : '添加条件'}</button></div>
      <div class="runtime-item-condition" data-runtime-item-condition-host hidden>${renderConditionEditorList(ctx, item.condition)}</div>
      ${renderCollection(ctx, PAYMENT_COST_PROTOTYPE, item.costs)}
    </div>`;
  },
  readItem(scope, fallback) {
    const conditionHost = scope.querySelector('[data-runtime-item-condition-host]');
    const condition = conditionHost ? readConditionEditor(conditionHost) : fallback.condition;
    const costSection = scope.querySelector(`[data-runtime-collection="${PAYMENT_COST_PROTOTYPE.id}"]`);
    return {
      id: itemValue(scope, 'id'),
      ...(itemValue(scope, 'label').trim() ? { label: itemValue(scope, 'label').trim() } : {}),
      ...(condition ? { condition } : {}),
      costs: costSection ? readCollection(scope, PAYMENT_COST_PROTOTYPE) : fallback.costs,
    };
  },
  validate(_ctx, item) {
    if (!PAYMENT_OPTION_ID_PATTERN.test(item.id)) return '支付方案 ID 必须是非空 [a-z0-9_-]+ 名称';
    if (item.label !== undefined && typeof item.label !== 'string') return '支付方案名称必须是字符串';
    if (item.costs.some(cost => PAYMENT_COST_PROTOTYPE.validate?.(_ctx, cost))) return '支付方案包含无效费用项';
    return undefined;
  },
};

// --- 等级升级（levelUpgrades） ---

export const LEVEL_UPGRADE_PROTOTYPE: CollectionPrototype<SpotLevelUpgradeDraft> = {
  id: 'level-upgrade',
  field: 'levelUpgrades',
  kind: 'object',
  label: '等级升级',
  hint: '达到指定等级时消耗资源并触发效果。',
  addLabel: '添加升级',
  normalizeItem(item) {
    return { ...item, ...(item.condition ? { condition: normalizeConditionRoot(item.condition) } : {}) };
  },
  createEmpty() {
    return { level: 1, paymentOptions: [{ id: 'free', label: '免费', costs: [] }], effects: [] };
  },
  summary(_ctx, item) {
    const payment = `${item.paymentOptions.length} 个支付方案`;
    return { type: `Lv.${item.level}`, note: `${payment} · ${item.effects.length} 个效果` };
  },
  renderItem(ctx, item) {
    const esc = ctx.escapeHtml;
    return `<div data-runtime-item-form="level-upgrade">
      <label class="user-theme-field"><span>等级</span><input data-runtime-item-field="level" type="number" min="1" step="1" value="${esc(String(item.level))}"></label>
      ${renderCollection(ctx, PAYMENT_OPTION_PROTOTYPE, item.paymentOptions ?? [])}
      <div class="runtime-condition-actions"><span class="runtime-editor-hint">条件</span><button type="button" class="toolbar-button" data-runtime-item-condition>${(item.condition?.conditions?.length ?? 0) > 0 ? `条件（${item.condition!.conditions.length} 项）` : '添加条件'}</button></div>
      <div class="runtime-item-condition" data-runtime-item-condition-host hidden>${renderConditionEditorList(ctx, item.condition)}</div>
      <div class="runtime-condition-actions"><span class="runtime-editor-hint">效果（${item.effects.length}）</span><button type="button" class="toolbar-button" data-runtime-item-effects>编辑效果</button></div>
      <div class="runtime-item-effects" data-runtime-item-effects-host hidden>${renderEffectEditor(ctx, item.effects)}</div>
    </div>`;
  },
  readItem(scope, fallback) {
    const conditionHost = scope.querySelector('[data-runtime-item-condition-host]');
    const effectsHost = scope.querySelector('[data-runtime-item-effects-host]');
    const condition = conditionHost ? readConditionEditor(conditionHost) : fallback.condition;
    const paymentSection = scope.querySelector(`[data-runtime-collection="${PAYMENT_OPTION_PROTOTYPE.id}"]`);
    const hasPaymentRows = Boolean(paymentSection?.querySelector('[data-runtime-collection-row]'));
    return {
      level: itemNumber(scope, 'level') ?? fallback.level,
      paymentOptions: paymentSection && (hasPaymentRows || fallback.paymentOptions !== undefined)
        ? readCollection(scope, PAYMENT_OPTION_PROTOTYPE)
        : fallback.paymentOptions,
      ...(condition ? { condition } : {}),
      effects: effectsHost ? readEffectEditor(effectsHost) : fallback.effects,
    };
  },
  validate(ctx, item) {
    if (!Number.isInteger(item.level) || item.level < 1) return '升级等级必须是不小于 1 的整数';
    if (item.paymentOptions.length === 0) return '升级条目至少需要一个支付方案；免费升级请保留免费方案';
    const problem = validateEffectList(item.effects, 'spot.effects');
    return problem?.message;
  },
};

// --- 揭示（revealTriggers） ---

export const REVEAL_TRIGGER_PROTOTYPE: CollectionPrototype<SpotRevealTriggerDraft> = {
  id: 'reveal-trigger',
  field: 'revealTriggers',
  kind: 'object',
  label: '揭示',
  hint: '声明该 Spot 在可见性阶梯上何时出现。',
  addLabel: '添加揭示',
  normalizeItem(item) {
    return { ...item, ...(item.condition ? { condition: normalizeConditionRoot(item.condition) } : {}) };
  },
  createEmpty() {
    return { reveal: 'existence' };
  },
  summary(_ctx, item) {
    return { type: '揭示', note: `${labelOf(REVEAL_TARGETS, item.reveal)}${item.condition ? ` · 条件 ${item.condition.conditions.length} 项` : ''}` };
  },
  renderItem(ctx, item) {
    const esc = ctx.escapeHtml;
    return `<div data-runtime-item-form="reveal-trigger">
      <label class="user-theme-field"><span>揭示目标</span><select data-runtime-item-field="reveal">${REVEAL_TARGETS
        .map(option => `<option value="${option.value}"${option.value === item.reveal ? ' selected="selected"' : ''}>${option.label}</option>`)
        .join('')}</select></label>
      <div class="runtime-condition-actions"><span class="runtime-editor-hint">条件</span><button type="button" class="toolbar-button" data-runtime-item-condition>${(item.condition?.conditions?.length ?? 0) > 0 ? `条件（${item.condition!.conditions.length} 项）` : '添加条件'}</button></div>
      <div class="runtime-item-condition" data-runtime-item-condition-host hidden>${renderConditionEditorList(ctx, item.condition)}</div>
    </div>`;
  },
  readItem(scope, fallback) {
    const conditionHost = scope.querySelector('[data-runtime-item-condition-host]');
    const condition = conditionHost ? readConditionEditor(conditionHost) : fallback.condition;
    return {
      reveal: itemValue(scope, 'reveal') as RevealTarget,
      ...(condition ? { condition } : {}),
    };
  },
};

// --- 标签（tags，标量集合，行内编辑） ---

export const TAG_PROTOTYPE: CollectionPrototype<string> = {
  id: 'tag-list',
  field: 'tags',
  kind: 'scalar',
  label: '层级标签',
  hint: '以 / 分隔层级路径；供 Enhancement 与条件按 Tag 作用。',
  addLabel: '添加标签',
  createEmpty() { return ''; },
  summary(_ctx, item) { return { type: 'tag', note: item || '（空）' }; },
  renderItem(ctx, item) {
    return `<label class="user-theme-field"><span>标签路径</span><input data-runtime-item-field="value" value="${ctx.escapeHtml(item)}" placeholder="office/defense"></label>`;
  },
  readItem(scope) { return itemValue(scope, 'value'); },
};

// --- 招募卡池（gachaPools，标量集合，行内编辑） ---

export const GACHA_POOL_PROTOTYPE: CollectionPrototype<string> = {
  id: 'gacha-pool-list',
  field: 'gachaPools',
  kind: 'scalar',
  label: '招募卡池',
  hint: '该 Spot 招募入口可用的专属卡池；候选来自当前 Registry。',
  addLabel: '添加卡池',
  createEmpty(ctx) { return [...ctx.game.registry.gachaPools.keys()][0] ?? ''; },
  summary(ctx, item) { return { type: 'pool', note: labelOf(gachaPoolOptions(ctx), item) }; },
  renderItem(ctx, item) {
    const esc = ctx.escapeHtml;
    return `<label class="user-theme-field"><span>卡池</span><select data-runtime-item-field="value">${optionList(esc, gachaPoolOptions(ctx), item)}</select></label>`;
  },
  readItem(scope) { return itemValue(scope, 'value'); },
};

const PROTOTYPES: readonly CollectionPrototype<never>[] = [
  FUNCTIONALITY_PROTOTYPE,
  PAYMENT_OPTION_PROTOTYPE,
  PAYMENT_COST_PROTOTYPE,
  LEVEL_UPGRADE_PROTOTYPE,
  REVEAL_TRIGGER_PROTOTYPE,
  TAG_PROTOTYPE,
  GACHA_POOL_PROTOTYPE,
] as unknown as readonly CollectionPrototype<never>[];

export function collectionPrototype(id: string): CollectionPrototype<never> | undefined {
  return PROTOTYPES.find(prototype => prototype.id === id);
}

export function collectionPrototypes(): readonly CollectionPrototype<never>[] {
  return PROTOTYPES;
}

// --- 通用渲染 / 回读 ---

export function renderCollection<T>(ctx: UIContext, prototype: CollectionPrototype<T>, items: readonly T[], problems: readonly RuntimeEditorProblemInput[] = []): string {
  const esc = ctx.escapeHtml;
  const rows = items.length === 0
    ? '<p class="runtime-collection-empty">暂无条目。</p>'
    : `<ul class="runtime-collection-list">${items.map((item, index) => {
      const summary = prototype.summary(ctx, item);
      const itemProblems = problems.filter(problem => collectionProblemMatches(problem, prototype, index));
      const control = prototype.kind === 'scalar'
        ? `<input class="runtime-collection-input" data-runtime-collection-input value="${esc(String(item))}">`
        : `<span class="runtime-collection-note">${esc(summary.note)}</span>`;
      const problemNote = itemProblems.length > 0
        ? `<em class="runtime-collection-error">${esc(itemProblems[0].message)}${itemProblems.length > 1 ? `（另有 ${itemProblems.length - 1} 项）` : ''}</em>`
        : '';
      return `<li class="runtime-collection-row${itemProblems.length > 0 ? ' has-runtime-editor-problem' : ''}" data-runtime-collection-row data-runtime-collection-index="${index}">
        <input type="hidden" data-runtime-collection-value value="${esc(JSON.stringify(item))}">
        <span class="runtime-collection-type">${esc(summary.type)}</span>
        ${control}
        ${problemNote}
        ${prototype.kind === 'scalar' ? '' : '<button type="button" class="mini-action" data-runtime-collection-edit>编辑</button>'}
        <button type="button" class="mini-action danger" data-runtime-collection-remove>删除</button>
      </li>`;
    }).join('')}</ul>`;
  return `<section class="runtime-collection" data-runtime-collection="${prototype.id}">
    <div class="runtime-collection-head">
      <div><h5>${esc(prototype.label)}</h5><p class="runtime-editor-hint">${esc(prototype.hint)}</p></div>
      <button type="button" class="toolbar-button" data-runtime-collection-add>${esc(prototype.addLabel)}</button>
    </div>
    ${rows}
  </section>`;
}

export function readCollection<T>(scope: ParentNode, prototype: CollectionPrototype<T>): T[] {
  const items: T[] = [];
  for (const row of [...scope.querySelectorAll<HTMLElement>(`[data-runtime-collection="${prototype.id}"] [data-runtime-collection-row]`)]) {
    if (prototype.kind === 'scalar') {
      const value = row.querySelector<HTMLInputElement>('[data-runtime-collection-input]')?.value ?? '';
      if (value !== '') items.push(value as T);
      continue;
    }
    const raw = row.querySelector<HTMLInputElement>('[data-runtime-collection-value]')?.value ?? '';
    const item = parseJson<T>(raw);
    if (item !== undefined) items.push(prototype.normalizeItem?.(item) ?? item);
  }
  return items;
}

function collectionProblemMatches<T>(problem: RuntimeEditorProblemInput, prototype: CollectionPrototype<T>, index: number): boolean {
  if (problem.collectionId && problem.itemIndex !== undefined) {
    return problem.collectionId === prototype.id && problem.itemIndex === index;
  }
  if (!problem.path) return false;
  const path = problem.path.replace(/^spot\./, '').replace(/^affectors(?=\[|$)/, 'functionalities');
  return path.startsWith(`${prototype.field}[${index}]`);
}

function itemOptions(ctx: UIContext) {
  return [...(ctx.game.registry.items?.values() ?? [])]
    .map(item => ({ value: item.id, label: item.name || item.id }));
}

/** 条目编辑弹窗保存后，把 JSON 写回行内 hidden；摘要行随之刷新。 */
export function writeCollectionRow(
  ctx: UIContext,
  row: HTMLElement,
  prototype: CollectionPrototype<never>,
  item: unknown,
): void {
  const normalized = prototype.normalizeItem?.(item as never) ?? item;
  const hidden = row.querySelector<HTMLInputElement>('[data-runtime-collection-value]');
  if (hidden) hidden.value = JSON.stringify(normalized);
  const summary = prototype.summary(ctx, normalized as never);
  const typeEl = row.querySelector<HTMLElement>('.runtime-collection-type');
  const noteEl = row.querySelector<HTMLElement>('.runtime-collection-note');
  if (typeEl) typeEl.textContent = summary.type;
  if (noteEl) noteEl.textContent = summary.note;
}

/** 根层只有一个条件组时直接使用它；多个最外层条件组统一归入 OR。 */
export function normalizeConditionRoot(group: ConditionGroup): ConditionGroup {
  const groups = group.conditions.filter(isConditionGroup);
  if (groups.length !== group.conditions.length || groups.length === 0) return group;
  if (groups.length === 1) return groups[0];
  return { type: 'OR', conditions: groups };
}

function isConditionGroup(value: Condition | ConditionGroup): value is ConditionGroup {
  return 'conditions' in value && 'type' in value;
}

export function collectionRowItem<T>(row: HTMLElement): T | undefined {
  return parseJson<T>(row.querySelector<HTMLInputElement>('[data-runtime-collection-value]')?.value ?? '');
}

function parseJson<T>(raw: string): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

// --- 效果编辑（弹窗内联，供升级原型复用） ---

export function readEffects(scope: ParentNode): Effect[] {
  return [...scope.querySelectorAll<HTMLElement>('[data-runtime-item-effect-row]')].map(row => {
    const value = (key: string): string => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-item-effect-field="${key}"]`)?.value ?? '';
    const raw = value('value').trim();
    return {
      op: value('op') as Effect['op'],
      target: value('target'),
      value: raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw,
    };
  });
}

/** 条件编辑器挂载：首次点击按钮时才展开（新建条目不会铺开一大串字段）。 */
export function mountConditionEditor(ctx: UIContext, host: HTMLElement): void {
  const condition = readHostCondition(ctx, host);
  renderConditionHost(ctx, host, condition);
}

export function readHostCondition(ctx: UIContext, host: HTMLElement): ConditionGroup | undefined {
  void ctx;
  return readConditionEditor(host);
}

export function renderConditionHost(ctx: UIContext, host: HTMLElement, condition: ConditionGroup | undefined): void {
  host.hidden = false;
  host.innerHTML = renderConditionEditor(ctx, condition);
}

export function validateConditionOnly(condition: ConditionGroup | undefined): string | undefined {
  return condition ? validateConditionGroup(condition, 'spot.condition')?.message : undefined;
}
