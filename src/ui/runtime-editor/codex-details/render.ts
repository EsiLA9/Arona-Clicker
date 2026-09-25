import { buildFieldTree, formatInspectorScalar, inspectorTypeLabel, type InspectorFieldNode } from './field-tree';
import { collectSemanticSummaries } from './semantic';
import type {
  DefinitionInspectorViewModel,
  InspectorReference,
  InspectorReferenceStatus,
  InspectorRenderOptions,
  InspectorTab,
} from './types';

const TAB_LABELS: Readonly<Record<InspectorTab, string>> = {
  overview: '概览',
  relations: '关系',
  raw: '原始数据',
};

const STATUS_LABELS: Readonly<Record<InspectorReferenceStatus, string>> = {
  resolved: '已解析',
  missing: '缺失',
  ambiguous: '歧义',
};

const INSPECTOR_ID = 'runtime-editor-codex-inspector';

function inspectorTabId(tab: InspectorTab): string {
  return `${INSPECTOR_ID}-tab-${tab}`;
}

function inspectorPanelId(tab: InspectorTab): string {
  return `${INSPECTOR_ID}-panel-${tab}`;
}

export function escapeInspectorHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function esc(value: unknown): string {
  return escapeInspectorHtml(String(value));
}

function renderFieldNode(node: InspectorFieldNode): string {
  const truncation = node.truncation ? ` · ${node.truncation}` : '';
  const meta = `<code class="codex-field-path">${esc(node.path)}</code><span class="codex-field-type">${esc(inspectorTypeLabel(node.type))}</span><span class="codex-field-value">${esc(node.displayValue)}</span>${truncation ? `<span class="codex-field-truncation">${esc(truncation)}</span>` : ''}`;
  if (node.children.length === 0) {
    return `<div class="codex-field-node codex-field-leaf" data-codex-field-path="${esc(node.path)}"><span class="codex-field-line">${meta}</span></div>`;
  }
  return `<details class="codex-field-node" data-codex-field-path="${esc(node.path)}" open><summary class="codex-field-line">${meta}</summary><div class="codex-field-children">${node.children.map(renderFieldNode).join('')}</div></details>`;
}

export function renderFieldTree(value: unknown, options: Pick<InspectorRenderOptions, 'maxDepth' | 'maxNodes'> = {}): string {
  const tree = buildFieldTree(value, options);
  return `<div class="codex-field-tree" data-codex-field-tree>${renderFieldNode(tree)}</div>`;
}

function renderSource(source: DefinitionInspectorViewModel['source']): string {
  if (!source) return '';
  const rows = [
    source.modId ? ['来源包', source.modId] : source.label ? ['来源', source.label] : undefined,
    source.version ? ['版本', source.version] : undefined,
  ].filter((row): row is [string, string] => row !== undefined);
  return rows.map(([label, value]) => `<div class="codex-inspector-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`).join('');
}

function renderSummaryFields(view: DefinitionInspectorViewModel): string {
  return (view.summaryFields ?? []).map(field => `<div class="codex-inspector-row"><span>${esc(field.label)}</span><span>${esc(formatInspectorScalar(field.value))}</span></div>`).join('');
}

function renderRelatedReferences(view: DefinitionInspectorViewModel): string {
  const references = [
    ...(view.references ?? []).map(reference => ({ reference, direction: 'outbound' as const })),
    ...(view.reverseReferences ?? []).map(reference => ({ reference, direction: 'inbound' as const })),
  ].filter(({ reference }) => reference.status !== 'missing' || reference.target.fullId);
  if (references.length === 0) return '';

  const groups = new Map<string, Array<{ readonly reference: InspectorReference; readonly direction: 'outbound' | 'inbound' }>>();
  for (const item of references) {
    const key = `${item.reference.status}\u0000${item.reference.target.definitionKind}\u0000${item.reference.target.fullId}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return `<div class="codex-inspector-section codex-inspector-related"><div class="codex-inspector-section-head"><h3>相关组分</h3><span class="codex-inspector-section-note">${groups.size} 个目标</span></div><div class="codex-related-list">${[...groups.values()].slice(0, 8).map(group => renderRelatedReferenceGroup(group, false)).join('')}</div></div>`;
}

function renderRelatedReferenceGroup(
  group: readonly { readonly reference: InspectorReference; readonly direction: 'outbound' | 'inbound' }[],
  includePaths = true,
): string {
  const first = group[0].reference;
  const status = STATUS_LABELS[first.status];
  const target = first.target;
  const relations = [...new Set(group.map(({ reference }) => reference.relation ?? '引用'))];
  const relation = relations.join(' / ');
  const paths = group
    .map(({ reference, direction }) => `<li data-codex-reference-direction="${direction}" data-codex-reference-confidence="${esc(reference.confidence ?? '')}"><span>${esc(direction === 'outbound' ? '向外' : '反向')}</span><code data-codex-reference-path="${esc(reference.path ?? '')}">${esc(reference.path ?? '未提供路径')}</code>${reference.confidence ? `<small>${esc(reference.confidence === 'declared' ? '已声明' : '推断')}</small>` : ''}</li>`)
    .join('');
  const body = `<span class="codex-related-relation">${esc(relation)}</span><span>${esc(target.label ?? target.fullId)}</span><code>${esc(target.definitionKind)} · ${esc(target.fullId)}</code>${first.status === 'resolved' ? '' : `<span class="codex-related-status">${esc(status)}</span>`}`;
  const targetBody = target.entryKey && first.status === 'resolved'
    ? `<button type="button" class="codex-related-item" data-codex-reference-target="${esc(target.entryKey)}" data-codex-related-status="${esc(first.status)}" aria-label="跳转到 ${esc(target.definitionKind)} ${esc(target.fullId)}">${body}</button>`
    : `<div class="codex-related-item codex-related-item--static" data-codex-related-status="${esc(first.status)}">${body}</div>`;
  const pathsBody = group.length > 1
    ? `<details class="codex-related-paths"><summary>${group.length} 条引用路径</summary><ul>${paths}</ul></details>`
    : `<ul class="codex-related-paths codex-related-paths--single">${paths}</ul>`;
  return `<div class="codex-related-group" data-codex-related-target="${esc(`${target.definitionKind}:${target.fullId}`)}">${targetBody}${includePaths ? pathsBody : ''}</div>`;
}

function renderOverview(view: DefinitionInspectorViewModel, options: InspectorRenderOptions): string {
  const semantic = collectSemanticSummaries(view.definition, options);
  const semanticHtml = semantic.length === 0
    ? '<p class="codex-inspector-empty">暂无已识别的语义节点；完整内容仍保留在原始数据页签。</p>'
    : semantic.map(item => `<div class="codex-semantic-summary" data-codex-semantic-kind="${esc(item.kind)}"><span class="codex-semantic-kind">${esc(item.label)}</span><span class="codex-semantic-text">${esc(item.text)}</span><code>${esc(item.path)}</code></div>`).join('');
  return `<section class="codex-inspector-overview" role="tabpanel" id="${inspectorPanelId('overview')}" aria-labelledby="${inspectorTabId('overview')}" data-codex-inspector-panel="overview">
    <div class="codex-inspector-identity"><span class="codex-inspector-kind">${esc(view.definitionLabel ?? view.definitionKind)}</span><strong>${esc(view.title ?? view.fullId)}</strong></div>
    <div class="codex-inspector-id"><code>${esc(view.fullId)}</code></div>
    ${view.description ? `<p class="codex-inspector-description">${esc(view.description)}</p>` : ''}
    <div class="codex-inspector-metadata">${renderSource(view.source)}${view.status && view.status !== '已解析' ? `<div class="codex-inspector-row"><span>状态</span><span>${esc(view.status)}</span></div>` : ''}${renderSummaryFields(view)}</div>
    ${semantic.length ? `<div class="codex-inspector-section"><h3>语义摘要</h3>${semanticHtml}</div>` : ''}
    ${renderRelatedReferences(view)}
  </section>`;
}

function renderReferenceTarget(
  target: InspectorReference['target'],
  interactive: boolean,
): string {
  const identity = `<span>${esc(target.definitionKind)}</span><code>${esc(target.fullId)}</code>${target.label ? `<span>${esc(target.label)}</span>` : ''}`;
  if (!interactive || !target.entryKey) return identity;
  return `<button type="button" class="codex-reference-target-button" data-codex-reference-target="${esc(target.entryKey)}" aria-label="跳转到 ${esc(target.definitionKind)} ${esc(target.fullId)}">${identity}</button>`;
}

function renderReference(reference: InspectorReference, direction: 'outbound' | 'inbound'): string {
  const statusLabel = STATUS_LABELS[reference.status];
  const confidenceLabel = reference.confidence === 'inferred' ? '推断' : reference.confidence === 'declared' ? '已声明' : '';
  const candidates = reference.status === 'ambiguous' && reference.candidates?.length
    ? `<div class="codex-reference-candidates"><span>候选：</span>${reference.candidates.map(candidate => renderReferenceTarget(candidate, true)).join('')}</div>`
    : '';
  const target = renderReferenceTarget(reference.target, reference.status === 'resolved');
  return `<li class="codex-reference codex-reference-${esc(reference.status)}" data-codex-reference-status="${esc(reference.status)}" data-codex-reference-direction="${direction}" data-codex-reference-confidence="${esc(reference.confidence ?? '')}">
    <div class="codex-reference-head"><span class="codex-reference-status">${esc(statusLabel)}</span>${confidenceLabel ? `<span class="codex-reference-confidence">${esc(confidenceLabel)}</span>` : ''}<span>${esc(reference.relation ?? (direction === 'outbound' ? '引用' : '被引用'))}</span>${reference.path ? `<code>${esc(reference.path)}</code>` : ''}</div>
    <div class="codex-reference-target">${target}</div>
    ${candidates}
  </li>`;
}

function renderRelations(view: DefinitionInspectorViewModel): string {
  const outbound = view.references ?? [];
  const inbound = view.reverseReferences ?? [];
  if (outbound.length === 0 && inbound.length === 0) return `<section class="codex-inspector-relations" role="tabpanel" id="${inspectorPanelId('relations')}" aria-labelledby="${inspectorTabId('relations')}" data-codex-inspector-panel="relations"><p class="codex-inspector-empty">暂无关系索引。</p></section>`;
  return `<section class="codex-inspector-relations" role="tabpanel" id="${inspectorPanelId('relations')}" aria-labelledby="${inspectorTabId('relations')}" data-codex-inspector-panel="relations">
    ${outbound.length ? `<div class="codex-inspector-section"><h3>它引用 <span>${outbound.length}</span></h3><ul>${outbound.map(reference => renderReference(reference, 'outbound')).join('')}</ul></div>` : ''}
    ${inbound.length ? `<div class="codex-inspector-section"><h3>引用它 <span>${inbound.length}</span></h3><ul>${inbound.map(reference => renderReference(reference, 'inbound')).join('')}</ul></div>` : ''}
  </section>`;
}

function renderRaw(view: DefinitionInspectorViewModel, options: InspectorRenderOptions): string {
  let json: string;
  try {
    json = JSON.stringify(view.definition, null, 2) ?? 'undefined';
  } catch {
    json = '[无法序列化]';
  }
  return `<section class="codex-inspector-raw" role="tabpanel" id="${inspectorPanelId('raw')}" aria-labelledby="${inspectorTabId('raw')}" data-codex-inspector-panel="raw"><div class="codex-inspector-section"><div class="codex-inspector-section-head"><h3>字段树</h3><button type="button" class="codex-inspector-copy-raw" data-codex-copy-raw data-codex-copy-format="json" aria-label="复制当前 Def 的原始 JSON">复制 JSON</button></div>${renderFieldTree(view.definition, options)}</div><details class="codex-inspector-section codex-inspector-json"><summary>严格 JSON</summary><pre data-codex-raw-json>${esc(json)}</pre></details></section>`;
}

function renderTabs(tab: InspectorTab): string {
  return `<nav class="codex-inspector-tabs" id="${INSPECTOR_ID}-tabs" role="tablist" aria-label="详情页签">${(Object.keys(TAB_LABELS) as InspectorTab[]).map(key => `<button type="button" role="tab" id="${inspectorTabId(key)}" data-codex-inspector-tab="${key}" aria-controls="${inspectorPanelId(key)}" aria-selected="${key === tab ? 'true' : 'false'}" tabindex="${key === tab ? '0' : '-1'}">${TAB_LABELS[key]}</button>`).join('')}</nav>`;
}

export function renderDefinitionInspector(
  view: DefinitionInspectorViewModel,
  tab: InspectorTab = 'overview',
  options: InspectorRenderOptions = {},
): string {
  const panel = tab === 'relations' ? renderRelations(view) : tab === 'raw' ? renderRaw(view, options) : renderOverview(view, options);
  return `<section class="codex-inspector" data-codex-inspector data-codex-inspector-tab="${esc(tab)}">${renderTabs(tab)}${panel}</section>`;
}
