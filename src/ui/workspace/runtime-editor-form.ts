import {
  encodedAuthoringExtensionValue,
  encodedAuthoringFieldValue,
  getWritableField,
  isNumericAuthoringKind,
  type ContentAuthoringPolicy,
  type WritableFieldDef,
} from '../../data-services/authoring/content-policy';
import type { SpotResourceAffectorDraft } from '../../data-services/authoring/content-policy-types';
import type { UIContext } from '../context';

export interface RuntimeEditorFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface RuntimeEditorFieldView {
  readonly key: string;
  readonly label: string;
  readonly control: 'text' | 'number' | 'select';
  readonly value: string;
  readonly required: boolean;
  readonly locked: boolean;
  readonly options: readonly RuntimeEditorFieldOption[];
  readonly hint: string | null;
}

export interface RuntimeEditorDiffRow {
  readonly key: string;
  readonly label: string;
  readonly draft: string;
  readonly runtime: string;
  readonly changed: boolean;
}

export interface RuntimeEditorAffectorRowView {
  readonly id: string;
  readonly mode: 'fixed' | 'per-level';
  readonly resource: string;
  readonly amount: string;
  readonly resourceOptions: readonly RuntimeEditorFieldOption[];
}

/** 可写字段 → 表单控件。引用候选来自当前 Registry，不由 UI 维护候选表。 */
export function runtimeEditorFieldViews(
  ctx: UIContext,
  policy: ContentAuthoringPolicy,
  values: object,
  options: { readonly lockedFields?: readonly string[] } = {},
): RuntimeEditorFieldView[] {
  const raw = values as Record<string, unknown>;
  return policy.fields.map(field => {
    const candidates = field.kind === 'ref' ? refOptions(ctx, field) : [];
    const control: RuntimeEditorFieldView['control'] = field.kind === 'ref'
      ? 'select'
      : isNumericAuthoringKind(field.kind) ? 'number' : 'text';
    return {
      key: field.key,
      label: field.label,
      control,
      value: raw[field.key] === undefined || raw[field.key] === null ? '' : String(raw[field.key]),
      required: field.required !== false,
      locked: options.lockedFields?.includes(field.key) ?? false,
      options: candidates,
      hint: field.kind === 'ref' && candidates.length === 0
        ? `当前 Registry 中没有可引用的 ${field.refType ?? '内容'}，需要先创建。`
        : null,
    };
  });
}

/** 新建内容的初值：来自策略表的 label/initialValue 与当前 Registry，UI 不再持有字段清单。 */
export function runtimeEditorInitialValues(
  ctx: UIContext,
  policy: ContentAuthoringPolicy,
  options: { readonly preferredRefValue?: string | null } = {},
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of policy.fields) {
    if (field.initialValue !== undefined) {
      values[field.key] = field.initialValue;
      continue;
    }
    switch (field.kind) {
      case 'entityName':
      case 'string':
      case 'nonEmptyString':
        values[field.key] = '';
        break;
      case 'ref': {
        const candidates = refOptions(ctx, field);
        const preferred = options.preferredRefValue && candidates.some(option => option.value === options.preferredRefValue)
          ? options.preferredRefValue
          : candidates[0]?.value ?? '';
        values[field.key] = preferred;
        break;
      }
      default:
        // 可选数值以空输入表达「未设置」，编码时整键省略。
        values[field.key] = field.required === false ? '' : 0;
    }
  }
  return values;
}

export function renderRuntimeEditorFields(
  ctx: UIContext,
  views: readonly RuntimeEditorFieldView[],
  problems: readonly RuntimeEditorProblemInput[] = [],
  policy?: ContentAuthoringPolicy,
): string {
  const esc = ctx.escapeHtml;
  return views.map(view => {
    const problem = policy ? problems.find(item => problemFieldKey(policy, item) === view.key) : undefined;
    const control = view.control === 'select'
      ? `<select data-runtime-editor-field="${view.key}"${view.locked ? ' disabled' : ''}>${renderOptions(esc, view.options, view.value, view.required)}</select>`
      : `<input data-runtime-editor-field="${view.key}" type="${view.control}"${view.locked ? ' disabled' : ''} value="${esc(view.value)}">`;
    const locked = view.locked ? '<span class="runtime-editor-locked">已应用，ID 不可修改</span>' : '';
    const hint = view.hint ? `<em class="runtime-editor-hint">${esc(view.hint)}</em>` : '';
    const error = problem ? `<em class="runtime-editor-field-error">${esc(problem.message)}</em>` : '';
    return `<label class="user-theme-field runtime-editor-field" data-runtime-editor-row="${view.key}"><span>${esc(view.label)}${view.required ? '' : '（可选）'}</span>${control}${locked}${hint}${error}</label>`;
  }).join('');
}

/** 表单 → 字段值。类型转换只由策略表的 kind 决定，UI 不重复业务规则。 */
export function readRuntimeEditorFields(
  policy: ContentAuthoringPolicy,
  scope: ParentNode,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of policy.fields) {
    const element = scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-field="${field.key}"]`);
    // 锁定字段（如已应用条目的 ID）也要回读：DOM 已禁止修改，值不会偏离原值。
    if (!element) continue;
    const raw = element.value;
    values[field.key] = isNumericAuthoringKind(field.kind) && raw.trim() !== '' ? Number(raw) : raw;
  }
  return values;
}

export function readRuntimeEditorAffectorRows(scope: ParentNode): SpotResourceAffectorDraft[] {
  return [...scope.querySelectorAll<HTMLElement>('[data-runtime-editor-affector-row]')].map(row => {
    const value = (key: string): string => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-affector-field="${key}"]`)?.value ?? '';
    const rawAmount = value('amount').trim();
    return {
      id: value('id') || row.dataset.runtimeEditorAffectorId || '',
      type: 'resource-flow',
      mode: value('mode') === 'per-level' ? 'per-level' : 'fixed',
      resource: value('resource'),
      amount: rawAmount === '' ? Number.NaN : Number(rawAmount),
    };
  });
}

export function renderRuntimeEditorAffectorList(
  ctx: UIContext,
  affectors: unknown,
  problems: readonly RuntimeEditorProblemInput[] = [],
): string {
  const esc = ctx.escapeHtml;
  const rows = Array.isArray(affectors) ? affectors.map((value, index) => toAffectorRowView(ctx, value, index)) : [];
  const body = rows.length === 0
    ? '<p class="runtime-editor-affector-empty">还没有持续资源。添加一行后选择资源与产出数值。</p>'
    : `<div class="runtime-editor-affector-list">${rows.map((row, index) => renderAffectorRow(ctx, row, index, problems)).join('')}</div>`;
  return `<section class="runtime-editor-affectors" data-runtime-editor-affectors><div class="runtime-editor-affector-heading"><div><h5>持续资源 Affector</h5><p class="runtime-editor-hint">固定持续按 Spot 已解锁状态生效；按等级持续随 Spot 等级线性增长。</p></div><button type="button" class="toolbar-button" data-runtime-editor-affector-add>添加持续资源</button></div>${body}</section>`;
}

/** Draft 与 Runtime Effective 的字段级差异，只比较已编码值，避免两种表示法互相误判。 */
export function runtimeEditorDiff(
  policy: ContentAuthoringPolicy,
  draft: object,
  runtime: object | undefined,
): RuntimeEditorDiffRow[] {
  if (!runtime) return [];
  const runtimeRecord = runtime as Record<string, unknown>;
  const fieldRows = policy.fields
    .filter(field => field.kind !== 'entityName')
    .map(field => {
      const draftValue = encodedAuthoringFieldValue(policy, field.key, (draft as Record<string, unknown>)[field.key]);
      const runtimeValue = runtimeRecord[field.key];
      return {
        key: field.key,
        label: field.label,
        draft: displayValue(draftValue),
        runtime: displayValue(runtimeValue),
        changed: JSON.stringify(draftValue) !== JSON.stringify(runtimeValue),
      };
    });
  const extensionRows = (policy.extensions ?? []).map(extension => {
    const draftValue = encodedAuthoringExtensionValue(policy, extension.inputKey, (draft as Record<string, unknown>)[extension.inputKey]);
    const runtimeValue = encodedAuthoringExtensionValue(policy, extension.inputKey, runtimeRecord[extension.inputKey]);
    return {
      key: extension.inputKey,
      label: extension.inputKey === 'affectors' ? '持续资源 Affector' : extension.inputKey,
      draft: displayValue(draftValue),
      runtime: displayValue(runtimeValue),
      changed: JSON.stringify(draftValue) !== JSON.stringify(runtimeValue),
    };
  });
  return [...fieldRows, ...extensionRows];
}

export function renderRuntimeEditorDiff(rows: readonly RuntimeEditorDiffRow[]): string {
  const changed = rows.filter(row => row.changed);
  if (changed.length === 0) return '<p class="runtime-editor-diff-empty">Draft 与 Runtime 一致。</p>';
  return `<ul class="runtime-editor-diff">${changed.map(row => `<li><span>${row.label}</span><em>${row.runtime}</em><b>${row.draft}</b></li>`).join('')}</ul>`;
}

/** 诊断只需要 path 与 message；策略校验问题与运行时提交诊断都可直接传入。 */
export interface RuntimeEditorProblemInput {
  readonly path?: string;
  readonly message: string;
}

export function renderRuntimeEditorProblems(
  ctx: UIContext,
  policy: ContentAuthoringPolicy,
  problems: readonly RuntimeEditorProblemInput[],
): string {
  if (problems.length === 0) return '';
  const items = problems.map(problem => {
    const fieldKey = problemFieldKey(policy, problem);
    const target = fieldKey ? ` data-runtime-editor-diagnostic="${fieldKey}"` : '';
    return `<li${target}>${ctx.escapeHtml(problem.message)}</li>`;
  }).join('');
  return `<div class="runtime-editor-diagnostics"><span class="eyebrow">诊断</span><ul>${items}</ul></div>`;
}

export function problemFieldKey(policy: ContentAuthoringPolicy, problem: RuntimeEditorProblemInput): string | undefined {
  if (!problem.path) return undefined;
  if (getWritableField(policy, problem.path)) return problem.path;
  const prefix = `${policy.inputPrefix}.`;
  const stripped = problem.path.startsWith(prefix) ? problem.path.slice(prefix.length) : undefined;
  return stripped && getWritableField(policy, stripped) ? stripped : undefined;
}

function toAffectorRowView(ctx: UIContext, value: unknown, index: number): RuntimeEditorAffectorRowView {
  const raw = value && typeof value === 'object' ? value as Partial<SpotResourceAffectorDraft> : {};
  const resource = typeof raw.resource === 'string' ? raw.resource : '';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `affector-${index + 1}`,
    mode: raw.mode === 'per-level' ? 'per-level' : 'fixed',
    resource,
    amount: typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? String(raw.amount) : '',
    resourceOptions: resourceOptions(ctx, resource),
  };
}

function renderAffectorRow(
  ctx: UIContext,
  row: RuntimeEditorAffectorRowView,
  index: number,
  problems: readonly RuntimeEditorProblemInput[],
): string {
  const esc = ctx.escapeHtml;
  const rowProblems = problems.filter(problem => problem.path?.startsWith(`spot.affectors[${index}]`));
  const errors = rowProblems.length === 0 ? '' : `<ul class="runtime-editor-affector-errors">${rowProblems.map(problem => `<li>${esc(problem.message)}</li>`).join('')}</ul>`;
  return `<div class="runtime-editor-affector-row" data-runtime-editor-affector-row data-runtime-editor-affector-id="${esc(row.id)}">
    <input type="hidden" data-runtime-editor-affector-field="id" value="${esc(row.id)}">
    <input type="hidden" data-runtime-editor-affector-field="type" value="resource-flow">
    <div class="runtime-editor-affector-row-heading"><strong>持续资源 ${index + 1}</strong><button type="button" class="mini-action danger" data-runtime-editor-affector-delete>删除</button></div>
    <label class="user-theme-field"><span>模式</span><select data-runtime-editor-affector-field="mode"><option value="fixed"${row.mode === 'fixed' ? ' selected' : ''}>固定持续</option><option value="per-level"${row.mode === 'per-level' ? ' selected' : ''}>按 Spot 等级</option></select></label>
    <label class="user-theme-field"><span>资源</span><select data-runtime-editor-affector-field="resource">${renderOptions(esc, row.resourceOptions, row.resource, true)}</select></label>
    <label class="user-theme-field"><span data-runtime-editor-affector-amount-label>${row.mode === 'per-level' ? '每级产出' : '持续产出'}</span><input data-runtime-editor-affector-field="amount" type="number" min="0" step="any" value="${esc(row.amount)}"></label>
    ${errors}
  </div>`;
}

function resourceOptions(ctx: UIContext, current = ''): RuntimeEditorFieldOption[] {
  const options = [...ctx.game.registry.resourceDisplays.values()]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(resource => ({ value: resource.resourceId, label: resource.label || resource.resourceId }));
  if (current && !options.some(option => option.value === current)) {
    options.unshift({ value: current, label: `${current}（当前资源未注册）` });
  }
  return options;
}

function refOptions(ctx: UIContext, field: WritableFieldDef): RuntimeEditorFieldOption[] {
  if (field.refType === 'area') {
    return [...ctx.game.registry.areas.values()].map(area => ({ value: area.id, label: area.name || area.id }));
  }
  return [];
}

function renderOptions(
  esc: (value: string) => string,
  options: readonly RuntimeEditorFieldOption[],
  value: string,
  required: boolean,
): string {
  const known = options.some(option => option.value === value);
  const head = value && !known
    ? `<option value="${esc(value)}" selected>${esc(value)}（当前 Registry 中不存在）</option>`
    : value ? '' : required ? '<option value="">请选择…</option>' : '<option value="">（未设置）</option>';
  return head + options.map(option => `<option value="${esc(option.value)}"${option.value === value ? ' selected' : ''}>${esc(option.label)}</option>`).join('');
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && 'value' in (value as Record<string, unknown>)) return String((value as Record<string, unknown>).value);
  return JSON.stringify(value);
}
