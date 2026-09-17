// ============================================================
// ui/runtime-editor/dsl-editors.ts — 条件与效果的编辑 UI
//
// 递归结构只做「有限深度」编辑：条件组受 MAX_CONDITION_DEPTH / ITEMS 约束，
// 超限不渲染「继续嵌套」，提示改在 Datapack 中编辑（与校验层同一上限）。
// 本文件只负责渲染与回读；结构合法性由 content-policy-dsl 校验。
// ============================================================

import { MAX_CONDITION_DEPTH, MAX_CONDITION_ITEMS } from '../../data-services/authoring/content-policy-dsl';
import type { Comparator, Condition, ConditionGroup, ConditionTarget, Effect, EffectOp } from '../../engine/types/expression';
import type { UIContext } from '../context';
import {
  CONDITION_TARGET_OPTIONS,
  readConditionTargetFields,
  renderConditionTargetFields,
  summarizeCondition,
} from './condition-target-editors';

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

// --- 条件 ---

export function renderConditionEditor(
  ctx: UIContext,
  group: ConditionGroup | undefined,
  depth = 1,
  path: readonly number[] = [],
): string {
  const esc = ctx.escapeHtml;
  const items = group?.conditions ?? [];
  const rows = items.map((item, index) => {
    const itemPath = [...path, index];
    return isGroup(item)
      ? `<div class="runtime-condition-group" data-runtime-condition-item="group">${renderConditionEditor(ctx, item, depth + 1, itemPath)}<button type="button" class="mini-action danger" data-runtime-condition-item-remove>删除条件组</button></div>`
      : renderConditionRow(ctx, item);
  }).join('');
  const full = items.length >= MAX_CONDITION_ITEMS;
  const canNest = depth < MAX_CONDITION_DEPTH;
  return `<div class="runtime-condition" data-runtime-condition data-runtime-condition-depth="${depth}">
    <div class="runtime-condition-heading">
      <button type="button" class="runtime-condition-toggle" data-runtime-condition-toggle data-runtime-condition-type="${group?.type === 'OR' ? 'OR' : 'AND'}" aria-pressed="${group?.type === 'OR' ? 'true' : 'false'}">${group?.type === 'OR' ? '任一满足（OR）' : '全部满足（AND）'}</button>
      <span class="runtime-condition-heading-note">条件组</span>
    </div>
    <div class="runtime-condition-items" data-runtime-condition-items>${rows || '<p class="runtime-editor-hint">还没有条件项；留空表示无条件。</p>'}</div>
    <div class="runtime-condition-actions">
      <button type="button" class="toolbar-button" data-runtime-condition-add="condition"${full ? ' disabled' : ''}>添加原子条件</button>
      ${canNest
        ? `<button type="button" class="toolbar-button" data-runtime-condition-add="group"${full ? ' disabled' : ''}>添加条件组</button>`
        : '<span class="runtime-editor-hint">已达嵌套上限，更复杂的条件请改在 Datapack 中编辑</span>'}
    </div>
  </div>`;
}

function renderConditionRow(ctx: UIContext, condition: Condition): string {
  const esc = ctx.escapeHtml;
  return `<div class="runtime-condition-row" data-runtime-condition-item="condition">
    <button type="button" class="runtime-condition-summary" data-runtime-condition-edit data-runtime-condition-target="${esc(condition.target)}" data-runtime-condition-key="${esc(condition.key)}" data-runtime-condition-comparator="${esc(condition.comparator)}" data-runtime-condition-value="${esc(String(condition.value))}" title="点击编辑原子条件">
      <span class="runtime-condition-summary-text" data-runtime-condition-summary-text>${esc(summarizeCondition(ctx, condition))}</span>
      <span class="runtime-condition-summary-edit">编辑</span>
    </button>
    <button type="button" class="mini-action danger" data-runtime-condition-item-remove>删除</button>
  </div>`;
}

/** 条目级条件容器：允许多个并列条件组，组间关系固定为 OR。 */
export function renderConditionEditorList(ctx: UIContext, group: ConditionGroup | undefined): string {
  const nestedGroups = group?.type === 'OR' && group.conditions.every(isGroup)
    ? group.conditions
    : undefined;
  const groups: Array<ConditionGroup | undefined> = nestedGroups && nestedGroups.length > 1 ? nestedGroups : [group];
  return `<div class="runtime-condition-list" data-runtime-condition-list>${groups
    .map((entry, index) => renderConditionOuterHtml(ctx, entry, index > 0, index > 0))
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
): string {
  return `<div class="runtime-condition-outer" data-runtime-condition-outer>
    ${withRelation ? '<div class="runtime-condition-outer-relation" data-runtime-condition-outer-relation>OR</div>' : ''}
    ${renderConditionEditor(ctx, group)}
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
  return `<div class="runtime-atomic-condition-editor" data-runtime-atomic-condition-editor>
    <p class="runtime-editor-hint">原子条件决定一项具体的比较；保存后会回到条件树。</p>
    <label class="user-theme-field"><span>目标</span><select data-runtime-condition-editor-field="target">${targetOptions
      .map(option => `<option value="${esc(option.value)}"${option.value === condition.target ? ' selected="selected"' : ''}>${esc(option.label)}</option>`)
      .join('')}</select></label>
    <div data-runtime-condition-target-fields>${renderConditionTargetFields(ctx, condition)}</div>
  </div>`;
}

export function readAtomicConditionEditor(scope: ParentNode): Condition {
  const target = readSelect(scope.querySelector<HTMLSelectElement>('[data-runtime-condition-editor-field="target"]')) as ConditionTarget;
  const fallback: Condition = { target, key: '', comparator: '>=', value: 1 };
  return readConditionTargetFields(scope, target, fallback);
}

/** 读回条件组；条目为空时返回 undefined（表示未设置条件）。 */
export function readConditionEditor(scope: ParentNode): ConditionGroup | undefined {
  // 条件树根 = 没有祖先条件组的所有 runtime-condition；并列根组统一按 OR 组合。
  const groups = [...scope.querySelectorAll<HTMLElement>('.runtime-condition')]
    .filter(element => !element.parentElement?.closest('.runtime-condition'))
    .map(readConditionGroup)
    .filter(group => group.conditions.length > 0);
  if (groups.length === 0) return undefined;
  if (groups.length === 1) return groups[0];
  return { type: 'OR', conditions: groups };
}

function readConditionGroup(root: HTMLElement): ConditionGroup {
  const type = root.querySelector<HTMLElement>(':scope > .runtime-condition-heading [data-runtime-condition-type]')?.dataset.runtimeConditionType === 'OR' ? 'OR' : 'AND';
  const items = directChild(root, 'runtime-condition-items');
  const conditions: (Condition | ConditionGroup)[] = [];
  for (const child of [...(items?.children ?? [])]) {
    const element = child as HTMLElement;
    if (element.dataset.runtimeConditionItem === 'group') {
      const nested = [...element.children].find(node => node.classList.contains('runtime-condition')) as HTMLElement | undefined;
      if (nested) conditions.push(readConditionGroup(nested));
    } else if (element.dataset.runtimeConditionItem === 'condition') conditions.push(readConditionItem(element));
  }
  return { type, conditions };
}

function readConditionItem(element: HTMLElement): Condition {
  const summary = element.querySelector<HTMLElement>('[data-runtime-condition-edit]');
  return {
    target: (summary?.dataset.runtimeConditionTarget ?? 'resource') as ConditionTarget,
    key: summary?.dataset.runtimeConditionKey ?? '',
    comparator: (summary?.dataset.runtimeConditionComparator ?? '>=') as Comparator,
    value: Number(summary?.dataset.runtimeConditionValue ?? '1'),
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
    if (!current || !isGroup(current)) return undefined;
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
  conditions[index] = rest.length > 0 && isGroup(current)
    ? replaceConditionAtPath(current, rest, replacement)
    : rest.length === 0
      ? replacement
      : current;
  return { ...group, conditions };
}

/** 新增单个条件项的 HTML：由交互层插入到指定条件组的 items 容器。 */
export function renderConditionItemHtml(ctx: UIContext, depth = 1): string {
  return renderConditionRow(ctx, { target: 'alwaysTrue', key: '', comparator: '==', value: 1 });
}

/** 新增嵌套条件组的 HTML（深度受 MAX_CONDITION_DEPTH 约束）。 */
export function renderNestedConditionHtml(ctx: UIContext, depth: number): string {
  return `<div class="runtime-condition-group" data-runtime-condition-item="group">${renderConditionEditor(ctx, undefined, depth)}<button type="button" class="mini-action danger" data-runtime-condition-item-remove>删除条件组</button></div>`;
}

// --- 效果 ---

export function renderEffectEditor(ctx: UIContext, effects: readonly Effect[]): string {
  const esc = ctx.escapeHtml;
  const rows = effects.length === 0
    ? '<p class="runtime-editor-hint">还没有效果。</p>'
    : effects.map(effect => `<div class="runtime-effect-row" data-runtime-effect-row>
      <label class="user-theme-field"><span>效果</span><select data-runtime-effect-field="op">${EFFECT_OP_LABELS
        .map(option => `<option value="${option.value}"${option.value === effect.op ? ' selected' : ''}>${option.label}</option>`)
        .join('')}</select></label>
      <label class="user-theme-field"><span>目标</span><input data-runtime-effect-field="target" value="${esc(String(effect.target))}"></label>
      <label class="user-theme-field"><span>数值</span><input data-runtime-effect-field="value" value="${esc(displayEffectValue(effect.value))}"></label>
      <button type="button" class="mini-action danger" data-runtime-effect-remove>删除</button>
    </div>`).join('');
  return `<div class="runtime-effects" data-runtime-effects>${rows}<div class="runtime-condition-actions"><button type="button" class="toolbar-button" data-runtime-effect-add>添加效果</button><span class="runtime-editor-hint">数值支持数字或文本；复杂表达式请改在 Datapack 中编辑</span></div></div>`;
}

/** 新增单条效果的 HTML。 */
export function renderEffectRowHtml(ctx: UIContext): string {
  const esc = ctx.escapeHtml;
  return `<div class="runtime-effect-row" data-runtime-effect-row>
    <label class="user-theme-field"><span>效果</span><select data-runtime-effect-field="op">${EFFECT_OP_LABELS
      .map(option => `<option value="${option.value}"${option.value === 'addResource' ? ' selected' : ''}>${option.label}</option>`)
      .join('')}</select></label>
    <label class="user-theme-field"><span>目标</span><input data-runtime-effect-field="target" value=""></label>
    <label class="user-theme-field"><span>数值</span><input data-runtime-effect-field="value" value="0"></label>
    <button type="button" class="mini-action danger" data-runtime-effect-remove>删除</button>
  </div>`;
}

export function readEffectEditor(scope: ParentNode): Effect[] {
  return [...scope.querySelectorAll<HTMLElement>('[data-runtime-effect-row]')].map(row => {
    const field = (key: string): string => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-effect-field="${key}"]`)?.value ?? '';
    const raw = field('value').trim();
    return {
      op: field('op') as EffectOp,
      target: field('target'),
      value: raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw,
    };
  });
}

function displayEffectValue(value: Effect['value']): string {
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return String(value);
  return '';
}

function isGroup(value: Condition | ConditionGroup): value is ConditionGroup {
  return typeof value === 'object' && value !== null && 'type' in value;
}
