// ============================================================
// ui/runtime-editor/dsl-editors.ts — 条件与效果的编辑 UI
//
// 递归结构只做「有限深度」编辑：条件组受 MAX_CONDITION_DEPTH / ITEMS 约束，
// 超限不渲染「继续嵌套」，提示改在 Datapack 中编辑（与校验层同一上限）。
// 本文件只负责渲染与回读；结构合法性由 content-policy-dsl 校验。
// ============================================================

import { MAX_CONDITION_DEPTH, MAX_CONDITION_ITEMS } from '../../data-services/authoring/content-policy-dsl';
import type { Comparator, Condition, ConditionGroup, ConditionTarget, Effect, EffectOp, ValueExpression } from '../../engine/types/expression';
import type { UIContext } from '../context';
import {
  CONDITION_TARGET_OPTIONS,
  conditionTargetEditorOf,
  readConditionTargetFields,
  renderConditionTargetFields,
  summarizeCondition,
} from './condition-target-editors';

export const MAX_VALUE_EXPRESSION_DEPTH = 4;
export const MAX_VALUE_EXPRESSION_NODES = 32;

const EFFECT_OP_LABELS: ReadonlyArray<{ value: EffectOp; label: string }> = [
  { value: 'addResource', label: '增加资源' },
  { value: 'setResource', label: '设置资源' },
  { value: 'addSpotLevel', label: '提升设施等级' },
  { value: 'setSpotLevel', label: '设置设施等级' },
  { value: 'setManager', label: '指派管理' },
  { value: 'addEnhancement', label: '获得强化' },
  { value: 'addItem', label: '获得物品' },
  { value: 'unlockInit', label: '解锁世界线' },
  { value: 'setFlag', label: '设置标记' },
  { value: 'setExtra', label: '写入 Extra' },
  { value: 'addExtra', label: '累加 Extra' },
  { value: 'removeExtra', label: '删除 Extra' },
  { value: 'grantCharacter', label: '获得角色' },
  { value: 'addAffectionExp', label: '增加好感' },
  { value: 'triggerStory', label: '触发剧情' },
  { value: 'travelToArea', label: '移动到区域' },
  { value: 'setTheme', label: '临时主题' },
  { value: 'setSpotMaxLevel', label: '设置等级上限' },
  { value: 'removeSpotMaxLevel', label: '移除等级上限' },
  { value: 'loot', label: '掉落表' },
  { value: 'showOpeningTitle', label: '开幕标题' },
  { value: 'showChatText', label: '演出文本' },
  { value: 'clearIdChatFlow', label: '清理指定演出流' },
  { value: 'clearAllChatFlow', label: '清理聊天流' },
  { value: 'clearAllChatText', label: '清理全部演出文本' },
];

const VALUE_EXPRESSION_BINARY_OPS = new Set(['add', 'sub', 'mul', 'div', 'min', 'max', 'pow']);
const VALUE_EXPRESSION_UNARY_OPS = new Set(['floor', 'ceil', 'round']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConditionGroup(value: unknown): value is ConditionGroup {
  return isRecord(value)
    && (value.type === 'AND' || value.type === 'OR')
    && Array.isArray(value.conditions);
}

function serializeOpaque(value: unknown): string | undefined {
  try {
    const raw = JSON.stringify(value);
    return typeof raw === 'string' ? raw : undefined;
  } catch {
    return undefined;
  }
}

function valueExpressionWithinLimit(value: unknown, depth = 1, state = { nodes: 0 }): value is ValueExpression {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  state.nodes += 1;
  if (depth > MAX_VALUE_EXPRESSION_DEPTH || state.nodes > MAX_VALUE_EXPRESSION_NODES) return false;
  if (value.type === 'const') return typeof value.value === 'number' && Number.isFinite(value.value);
  if (value.type === 'value') {
    return isRecord(value.value) && value.value.type === 'value' && isRecord(value.value.params);
  }
  if (VALUE_EXPRESSION_BINARY_OPS.has(value.type)) {
    return valueExpressionWithinLimit(value.left, depth + 1, state)
      && valueExpressionWithinLimit(value.right, depth + 1, state);
  }
  if (VALUE_EXPRESSION_UNARY_OPS.has(value.type)) return valueExpressionWithinLimit(value.expr, depth + 1, state);
  if (value.type === 'clamp') {
    return valueExpressionWithinLimit(value.expr, depth + 1, state)
      && valueExpressionWithinLimit(value.min, depth + 1, state)
      && valueExpressionWithinLimit(value.max, depth + 1, state);
  }
  return false;
}

function isEffect(value: unknown): value is Effect {
  return isRecord(value)
    && typeof value.op === 'string'
    && typeof value.target === 'string'
    && value.value !== undefined
    && value.value !== null;
}

function invalidEffectNode(path: string): Effect {
  return { op: '__runtime_editor_invalid__' as EffectOp, target: path, value: path };
}

function effectOptionLabel(op: string): string {
  return EFFECT_OP_LABELS.find(option => option.value === op)?.label ?? `${op || '未知'}（未接入，已保留）`;
}

function effectOptions(esc: (value: string) => string, current: string): string {
  const known = EFFECT_OP_LABELS.find(option => option.value === current);
  const options = known
    ? [known, ...EFFECT_OP_LABELS.filter(option => option.value !== current)]
    : [{ value: current as EffectOp, label: effectOptionLabel(current) }, ...EFFECT_OP_LABELS];
  return options
    .map(option => `<option value="${esc(String(option.value))}"${option.value === current ? ' selected="selected"' : ''}>${esc(option.label)}</option>`)
    .join('');
}

function isKnownEffectOp(op: string): op is EffectOp {
  return EFFECT_OP_LABELS.some(option => option.value === op);
}

function isValueExpressionNode(value: unknown): value is Record<string, unknown> & { type: string } {
  return isRecord(value)
    && typeof value.type === 'string'
    && (value.type === 'const'
      || value.type === 'value'
      || VALUE_EXPRESSION_BINARY_OPS.has(value.type)
      || VALUE_EXPRESSION_UNARY_OPS.has(value.type)
      || value.type === 'clamp');
}

// --- 条件 ---

export function renderConditionEditor(
  ctx: UIContext,
  group: ConditionGroup | undefined,
  depth = 1,
  path: readonly number[] = [],
): string {
  const esc = ctx.escapeHtml;
  if (group !== undefined && !isConditionGroup(group)) {
    return renderOpaqueConditionNode(ctx, group, path, `条件组结构未知；仅保留原始节点，Apply 将阻断。路径：${conditionPathLabel(path)}`);
  }
  if (depth > MAX_CONDITION_DEPTH) {
    return renderOpaqueConditionNode(ctx, group, path, `已超过条件组嵌套上限（${MAX_CONDITION_DEPTH} 层）；仅保留原始节点。`);
  }
  const items = group?.conditions ?? [];
  const rows = items.map((item, index) => {
    const itemPath = [...path, index];
    if (isConditionGroup(item)) {
      return depth < MAX_CONDITION_DEPTH
        ? `<div class="runtime-condition-group" data-runtime-condition-item="group" data-runtime-condition-path="${esc(conditionPathLabel(itemPath))}">${renderConditionEditor(ctx, item, depth + 1, itemPath)}<button type="button" class="mini-action danger" data-runtime-condition-item-remove>删除条件组</button></div>`
        : renderOpaqueConditionNode(ctx, item, itemPath, `已达条件组嵌套上限（${MAX_CONDITION_DEPTH} 层）；仅保留原始节点。`, true);
    }
    return isCondition(item)
      ? renderConditionRow(ctx, item, itemPath)
      : renderOpaqueConditionNode(ctx, item, itemPath, '未知条件节点；仅保留原始节点，Apply 将阻断。', true);
  }).join('');
  const full = items.length >= MAX_CONDITION_ITEMS;
  const canNest = depth < MAX_CONDITION_DEPTH;
  const limitNote = items.length > MAX_CONDITION_ITEMS
    ? `<p class="runtime-editor-warning" data-runtime-condition-item-limit>当前条件组有 ${items.length} 项，超过 Runtime Editor 上限 ${MAX_CONDITION_ITEMS}；不会截断，但只能在 Datapack 中修改。</p>`
    : '';
  return `<div class="runtime-condition" data-runtime-condition data-runtime-condition-depth="${depth}" data-runtime-condition-path="${esc(conditionPathLabel(path))}">
    <div class="runtime-condition-heading">
      <button type="button" class="runtime-condition-toggle" data-runtime-condition-toggle data-runtime-condition-type="${group?.type === 'OR' ? 'OR' : 'AND'}" aria-pressed="${group?.type === 'OR' ? 'true' : 'false'}">${group?.type === 'OR' ? '任一满足（OR）' : '全部满足（AND）'}</button>
      <span class="runtime-condition-heading-note">条件组</span>
    </div>
    <div class="runtime-condition-items" data-runtime-condition-items>${limitNote}${rows || '<p class="runtime-editor-hint">还没有条件项；留空表示无条件。</p>'}</div>
    <div class="runtime-condition-actions">
      <button type="button" class="toolbar-button" data-runtime-condition-add="condition"${full ? ' disabled' : ''}>添加原子条件</button>
      ${canNest
        ? `<button type="button" class="toolbar-button" data-runtime-condition-add="group"${full ? ' disabled' : ''}>添加条件组</button>`
        : '<span class="runtime-editor-hint">已达嵌套上限，更复杂的条件请改在 Datapack 中编辑</span>'}
    </div>
  </div>`;
}

function renderConditionRow(ctx: UIContext, condition: Condition, path: readonly number[] = []): string {
  const esc = ctx.escapeHtml;
  const unknownTarget = conditionTargetEditorOf(condition.target) === undefined;
  return `<div class="runtime-condition-row" data-runtime-condition-item="condition">
    <button type="button" class="runtime-condition-summary${unknownTarget ? ' is-unsupported' : ''}" data-runtime-condition-edit data-runtime-condition-path="${esc(conditionPathLabel(path))}" data-runtime-condition-target="${esc(String(condition.target))}" data-runtime-condition-key="${esc(String(condition.key))}" data-runtime-condition-comparator="${esc(String(condition.comparator))}" data-runtime-condition-value="${esc(String(condition.value))}" title="点击编辑原子条件（路径 ${esc(conditionPathLabel(path))}）">
      <span class="runtime-condition-summary-text" data-runtime-condition-summary-text>${esc(summarizeCondition(ctx, condition))}</span>
      <span class="runtime-condition-summary-edit">编辑</span>
    </button>
    ${unknownTarget ? '<span class="runtime-editor-warning" data-runtime-condition-unknown-target>未知目标，已保留并阻断编辑</span>' : ''}
    <button type="button" class="mini-action danger" data-runtime-condition-item-remove>删除</button>
  </div>`;
}

function renderOpaqueConditionNode(
  ctx: UIContext,
  value: unknown,
  path: readonly number[],
  label: string,
  item = false,
): string {
  const esc = ctx.escapeHtml;
  const raw = serializeOpaque(value);
  const opaque = raw ? ` data-runtime-condition-opaque="${esc(raw)}"` : '';
  if (item) {
    return `<div class="runtime-condition-row runtime-condition-row-unsupported" data-runtime-condition-item="opaque" data-runtime-condition-path="${esc(conditionPathLabel(path))}"${opaque}>
      <span class="runtime-editor-warning" data-runtime-condition-summary-text data-runtime-condition-unsupported data-runtime-condition-boundary>${esc(label)}${raw ? `：${esc(raw)}` : ''}</span>
      <button type="button" class="mini-action danger" data-runtime-condition-item-remove>删除</button>
    </div>`;
  }
  return `<div class="runtime-condition" data-runtime-condition data-runtime-condition-depth="${path.length + 1}" data-runtime-condition-path="${esc(conditionPathLabel(path))}" data-runtime-condition-opaque="${esc(raw ?? '')}">
    <p class="runtime-editor-warning" data-runtime-condition-boundary>${esc(label)}；原始结构不会被静默清空，请改在 Datapack 中编辑。</p>
    <div class="runtime-condition-items" data-runtime-condition-items></div>
  </div>`;
}

function conditionPathLabel(path: readonly number[]): string {
  return path.length === 0 ? 'root' : path.join('.');
}

function isCondition(value: unknown): value is Condition {
  return isRecord(value)
    && typeof value.target === 'string'
    && typeof value.key === 'string'
    && typeof value.comparator === 'string'
    && typeof value.value === 'number';
}

/** 条目级条件容器：允许多个并列条件组，组间关系固定为 OR。 */
export function renderConditionEditorList(ctx: UIContext, group: ConditionGroup | undefined): string {
  const nestedGroups = isConditionGroup(group) && group.type === 'OR' && group.conditions.every(isConditionGroup)
    ? group.conditions
    : undefined;
  const groups: Array<ConditionGroup | undefined> = nestedGroups && nestedGroups.length > 1 ? nestedGroups : [group];
  return `<div class="runtime-condition-list" data-runtime-condition-list>${groups
    .map((entry, index) => renderConditionOuterHtml(ctx, entry, index > 0, index > 0, index > 0 ? [index] : []))
    .join('')}</div>`;
}

/** 新增一个并列条件组；组间关系通过外层 OR 标记表达。 */
export function renderAdditionalConditionHtml(ctx: UIContext): string {
  return renderConditionOuterHtml(ctx, undefined, true, true);
}

function renderConditionOuterHtml(
  ctx: UIContext,
  group: ConditionGroup | undefined,
  removable: boolean,
  withRelation = false,
  path: readonly number[] = [],
): string {
  return `<div class="runtime-condition-outer" data-runtime-condition-outer>
    ${withRelation ? '<div class="runtime-condition-outer-relation" data-runtime-condition-outer-relation>OR</div>' : ''}
    ${renderConditionEditor(ctx, group, 1, path)}
    ${removable ? '<button type="button" class="mini-action danger" data-runtime-condition-outer-remove>删除这组条件</button>' : ''}
  </div>`;
}

/** 原子条件弹窗：字段仍沿用现有四元组，树内只展示摘要。 */
export function renderAtomicConditionEditor(ctx: UIContext, condition: Condition): string {
  const esc = ctx.escapeHtml;
  const targetOptions = [...CONDITION_TARGET_OPTIONS];
  if (!targetOptions.some(option => option.value === condition.target)) {
    targetOptions.unshift({ value: condition.target, label: `${condition.target}（未知目标）` });
  }
  targetOptions.sort((left, right) => left.value === condition.target ? -1 : right.value === condition.target ? 1 : 0);
  return `<div class="runtime-atomic-condition-editor" data-runtime-atomic-condition-editor data-runtime-condition-raw="${esc(JSON.stringify(condition))}">
    <p class="runtime-editor-hint">原子条件决定一项具体的比较；保存后会回到条件树。</p>
    <label class="user-theme-field"><span>目标</span><select data-runtime-condition-editor-field="target">${targetOptions
      .map(option => `<option value="${esc(option.value)}"${option.value === condition.target ? ' selected="selected"' : ''}>${esc(option.label)}</option>`)
      .join('')}</select></label>
    <div data-runtime-condition-target-fields>${renderConditionTargetFields(ctx, condition)}</div>
  </div>`;
}

export function readAtomicConditionEditor(scope: ParentNode): Condition {
  const target = readSelect(scope.querySelector<HTMLSelectElement>('[data-runtime-condition-editor-field="target"]')) as ConditionTarget || '__runtime_editor_invalid__' as ConditionTarget;
  const original = readOpaqueNode(scope.querySelector<HTMLElement>('[data-runtime-atomic-condition-editor]')?.dataset.runtimeConditionRaw);
  const fallback: Condition = original.ok && isCondition(original.value)
    ? { ...original.value, target }
    : { target, key: '', comparator: '>=', value: 1 };
  return readConditionTargetFields(scope, target, fallback);
}

/** 读回条件组；条目为空时返回 undefined（表示未设置条件）。 */
export function readConditionEditor(scope: ParentNode): ConditionGroup | undefined {
  // 条件树根 = 没有祖先条件组的所有 runtime-condition；并列根组统一按 OR 组合。
  const roots = [...scope.querySelectorAll<HTMLElement>('.runtime-condition')]
    .filter(element => !element.parentElement?.closest('.runtime-condition'));
  const groups = roots
    .map(readConditionGroup)
    .filter(group => !isConditionGroup(group) || group.conditions.length > 0);
  if (groups.length === 0) return undefined;
  if (groups.length === 1) return groups[0];
  return { type: 'OR', conditions: groups as unknown as (Condition | ConditionGroup)[] };
}

function readConditionGroup(root: HTMLElement): ConditionGroup {
  const opaque = readOpaqueNode(root.dataset.runtimeConditionOpaque);
  if (opaque.ok) return opaque.value as ConditionGroup;
  if (root.dataset.runtimeConditionOpaque !== undefined && !opaque.ok) {
    return { type: 'AND', conditions: [invalidConditionNode(root.dataset.runtimeConditionPath ?? 'root')] };
  }
  const type = root.querySelector<HTMLElement>(':scope > .runtime-condition-heading [data-runtime-condition-type]')?.dataset.runtimeConditionType === 'OR' ? 'OR' : 'AND';
  const items = directChild(root, 'runtime-condition-items');
  const conditions: (Condition | ConditionGroup)[] = [];
  for (const child of [...(items?.children ?? [])]) {
    const element = child as HTMLElement;
    if (element.dataset.runtimeConditionItem === 'group') {
      const nested = [...element.children].find(node => node.classList.contains('runtime-condition')) as HTMLElement | undefined;
      if (nested) conditions.push(readConditionGroup(nested));
      else conditions.push(readOpaqueOrInvalid(element));
    } else if (element.dataset.runtimeConditionItem === 'condition') conditions.push(readConditionItem(element));
    else if (element.dataset.runtimeConditionItem === 'opaque') conditions.push(readOpaqueOrInvalid(element));
  }
  return { type, conditions };
}

function readConditionItem(element: HTMLElement): Condition {
  const summary = element.querySelector<HTMLElement>('[data-runtime-condition-edit]');
  const rawValue = summary?.dataset.runtimeConditionValue ?? '1';
  const parsedValue = Number(rawValue);
  return {
    target: (summary?.dataset.runtimeConditionTarget ?? '__runtime_editor_invalid__') as ConditionTarget,
    key: summary?.dataset.runtimeConditionKey ?? '',
    comparator: (summary?.dataset.runtimeConditionComparator ?? '>=') as Comparator,
    value: Number.isFinite(parsedValue) ? parsedValue : rawValue as unknown as number,
  };
}

function readOpaqueNode(raw: string | undefined): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  if (raw === undefined) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function readOpaqueOrInvalid(element: HTMLElement): Condition | ConditionGroup {
  const opaque = readOpaqueNode(element.dataset.runtimeConditionOpaque);
  if (opaque.ok) return opaque.value as Condition | ConditionGroup;
  return invalidConditionNode(element.dataset.runtimeConditionPath ?? 'unknown');
}

function invalidConditionNode(path: string): Condition {
  return {
    target: `unknown:${path}` as ConditionTarget,
    key: path,
    comparator: '==' as Comparator,
    value: Number.NaN,
  };
}

/** 读取下拉框当前值：兼容只保留 selected 属性、尚未同步 value 的 DOM 宿主。 */
function readSelect(select: HTMLSelectElement | null | undefined): string {
  if (!select) return '';
  const marked = [...select.options].find(option => option.selected || option.hasAttribute('selected'));
  return select.value || marked?.value || '';
}

/** 按 class 取直接子元素：避免嵌套条件组被外层误读。 */
function directChild(root: HTMLElement, className: string): HTMLElement | undefined {
  return [...root.children].find(child => child.classList.contains(className)) as HTMLElement | undefined;
}

/** 从树节点 DOM 反推出相对于根组的条件路径。 */
export function conditionPathForElement(element: Element): number[] {
  let item: HTMLElement | null = element.closest<HTMLElement>('[data-runtime-condition-item]');
  const path: number[] = [];
  let outerRoot: HTMLElement | null = null;
  while (item) {
    const items = item.parentElement;
    if (!items?.matches('[data-runtime-condition-items]')) break;
    const siblings = [...items.children].filter(child => child.matches('[data-runtime-condition-item]'));
    const index = siblings.indexOf(item);
    if (index < 0) break;
    path.unshift(index);
    const groupRoot = items.parentElement;
    outerRoot = groupRoot;
    item = groupRoot?.parentElement?.closest<HTMLElement>('[data-runtime-condition-item="group"]') ?? null;
  }
  const list = outerRoot?.parentElement?.closest<HTMLElement>('[data-runtime-condition-list]');
  if (list && outerRoot) {
    const roots = [...list.querySelectorAll<HTMLElement>('.runtime-condition')]
      .filter(root => !root.parentElement?.closest('.runtime-condition'));
    if (roots.length > 1) {
      const outerIndex = roots.indexOf(outerRoot);
      if (outerIndex >= 0) path.unshift(outerIndex);
    }
  }
  return path;
}

export function conditionAtPath(group: ConditionGroup | undefined, path: readonly number[]): Condition | ConditionGroup | undefined {
  let current: Condition | ConditionGroup | undefined = group;
  for (const index of path) {
    if (!current || !isConditionGroup(current)) return undefined;
    current = current.conditions[index];
  }
  return current;
}

export function replaceConditionAtPath(group: ConditionGroup, path: readonly number[], replacement: Condition): ConditionGroup {
  if (path.length === 0) return group;
  const [index, ...rest] = path;
  if (index < 0 || index >= group.conditions.length) return group;
  const conditions = [...group.conditions];
  const current = conditions[index];
  conditions[index] = rest.length > 0 && isConditionGroup(current)
    ? replaceConditionAtPath(current, rest, replacement)
    : rest.length === 0
      ? replacement
      : current;
  return { ...group, conditions };
}

/** 新增单个条件项的 HTML：由交互层插入到指定条件组的 items 容器。 */
export function renderConditionItemHtml(ctx: UIContext, depth = 1): string {
  return renderConditionRow(ctx, { target: 'alwaysTrue', key: '', comparator: '==', value: 1 }, []);
}

/** 新增嵌套条件组的 HTML（深度受 MAX_CONDITION_DEPTH 约束）。 */
export function renderNestedConditionHtml(ctx: UIContext, depth: number): string {
  if (depth > MAX_CONDITION_DEPTH) {
    return `<div class="runtime-condition-group runtime-condition-unsupported" data-runtime-condition-depth-blocked><span class="runtime-editor-warning">已达条件组嵌套上限（${MAX_CONDITION_DEPTH} 层），未添加条件组。</span></div>`;
  }
  return `<div class="runtime-condition-group" data-runtime-condition-item="group">${renderConditionEditor(ctx, undefined, depth)}<button type="button" class="mini-action danger" data-runtime-condition-item-remove>删除条件组</button></div>`;
}

// --- 效果 ---

export function renderEffectEditor(ctx: UIContext, effects: readonly Effect[]): string {
  const rows = effects.length === 0
    ? '<p class="runtime-editor-hint">还没有效果。</p>'
    : effects.map((effect, index) => isEffect(effect) && isKnownEffectOp(effect.op)
      ? renderEffectRow(ctx, effect, index)
      : renderOpaqueEffectRow(ctx, effect, index)).join('');
  return `<div class="runtime-effects" data-runtime-effects>${rows}<div class="runtime-condition-actions"><button type="button" class="toolbar-button" data-runtime-effect-add>添加效果</button><span class="runtime-editor-hint">数值支持数字或文本；动态/结构化值会原样保留，复杂编辑请改在 Datapack 中完成</span></div></div>`;
}

function renderEffectRow(ctx: UIContext, effect: Effect, index: number): string {
  const esc = ctx.escapeHtml;
  const valueJson = serializeOpaque(effect.value);
  const valueKind = isValueExpressionNode(effect.value)
    ? 'value-expression'
    : typeof effect.value === 'object' && effect.value !== null ? 'opaque' : '';
  const valueOverLimit = valueKind === 'value-expression' && !valueExpressionWithinLimit(effect.value);
  const structuredValue = valueKind !== '';
  const preservedValue = valueJson
    ? ` data-runtime-effect-value-json="${esc(valueJson)}" data-runtime-effect-value-kind="${valueKind}"`
    : '';
  const placeholder = valueKind === 'value-expression'
    ? ` placeholder="${esc(valueOverLimit ? '动态表达式超出 Runtime Editor 边界（保持原样）' : '动态表达式（保持原样）')}"`
    : valueKind === 'opaque'
      ? ' placeholder="结构化值（保持原样）"'
      : '';
  const summary = `效果 ${String(effect.op)} · target=${String(effect.target)} · value=${displayEffectValue(effect.value)}`;
  return `<div class="runtime-effect-row" data-runtime-effect-row data-runtime-effect-path="effects[${index}]" data-runtime-effect-location="effects[${index}]">
      <span class="runtime-effect-summary${structuredValue ? ' is-structured' : ''}" data-runtime-effect-summary>${esc(summary)}</span>
      <label class="user-theme-field"><span>效果</span><select data-runtime-effect-field="op">${effectOptions(esc, String(effect.op))}</select></label>
      <label class="user-theme-field"><span>目标</span><input data-runtime-effect-field="target" value="${esc(String(effect.target))}"></label>
      <label class="user-theme-field"><span>数值</span><input data-runtime-effect-field="value" value="${esc(displayEffectValue(effect.value))}"${preservedValue}${placeholder}${structuredValue ? ' readonly disabled' : ''}></label>
      ${valueOverLimit ? `<span class="runtime-editor-warning" data-runtime-effect-value-boundary>动态 ValueExpression 超出深度 ${MAX_VALUE_EXPRESSION_DEPTH} 或节点数 ${MAX_VALUE_EXPRESSION_NODES} 上限；仅保留原始值。</span>` : ''}
      <button type="button" class="mini-action danger" data-runtime-effect-remove>删除</button>
    </div>`;
}

function renderOpaqueEffectRow(ctx: UIContext, effect: unknown, index: number): string {
  const esc = ctx.escapeHtml;
  const serialized = serializeOpaque(effect);
  const raw = ` data-runtime-effect-opaque="${esc(serialized ?? '')}"`;
  const summary = isEffect(effect)
    ? `效果 ${String(effect.op)} · target=${String(effect.target)}`
    : '未知效果节点';
  const message = isEffect(effect)
    ? `效果操作 ${String(effect.op)} 未接入 Runtime Editor；仅保留原始结构，Apply 将阻断。`
    : '未知效果节点；仅保留原始结构，Apply 将阻断。';
  const opControl = isEffect(effect)
    ? `<label class="user-theme-field"><span>效果</span><select data-runtime-effect-field="op" disabled>${effectOptions(esc, String(effect.op))}</select></label>`
    : '';
  return `<div class="runtime-effect-row runtime-effect-unsupported" data-runtime-effect-row data-runtime-effect-path="effects[${index}]" data-runtime-effect-location="effects[${index}]"${raw}>
      <span class="runtime-effect-summary is-unsupported" data-runtime-effect-summary>${esc(summary)} · effects[${index}]</span>
      ${opControl}
      <span class="runtime-editor-warning" data-runtime-effect-unsupported>${esc(message)}路径：effects[${index}]</span>
      <button type="button" class="mini-action danger" data-runtime-effect-remove>删除</button>
    </div>`;
}

/** 新增单条效果的 HTML。 */
export function renderEffectRowHtml(ctx: UIContext): string {
  const esc = ctx.escapeHtml;
  return `<div class="runtime-effect-row" data-runtime-effect-row>
    <label class="user-theme-field"><span>效果</span><select data-runtime-effect-field="op">${effectOptions(esc, 'addResource')}</select></label>
    <label class="user-theme-field"><span>目标</span><input data-runtime-effect-field="target" value=""></label>
    <label class="user-theme-field"><span>数值</span><input data-runtime-effect-field="value" value="0"></label>
    <button type="button" class="mini-action danger" data-runtime-effect-remove>删除</button>
  </div>`;
}

export function readEffectEditor(scope: ParentNode): Effect[] {
  return [...scope.querySelectorAll<HTMLElement>('[data-runtime-effect-row]')].map(row => {
    const opaque = readOpaqueNode(row.dataset.runtimeEffectOpaque);
    if (opaque.ok) return opaque.value as Effect;
    if (row.dataset.runtimeEffectOpaque !== undefined) return invalidEffectNode(row.dataset.runtimeEffectPath ?? 'unknown');
    const field = (key: string): string => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-effect-field="${key}"]`)?.value ?? '';
    const op = readSelect(row.querySelector<HTMLSelectElement>('[data-runtime-effect-field="op"]')) as EffectOp;
    const raw = field('value').trim();
    const preserved = readOpaqueNode(row.querySelector<HTMLInputElement>('[data-runtime-effect-field="value"]')?.dataset.runtimeEffectValueJson);
    const value = preserved.ok
      ? preserved.value
      : raw !== '' && Number.isFinite(Number(raw))
        ? Number(raw)
        : raw;
    return {
      op,
      target: field('target'),
      value: value as Effect['value'],
    };
  });
}

function displayEffectValue(value: Effect['value']): string {
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (isValueExpressionNode(value)) return `动态表达式（${value.type}，保持原样）`;
  if (isRecord(value)) return '结构化值（保持原样）';
  return '';
}
