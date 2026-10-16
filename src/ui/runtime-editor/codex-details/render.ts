import { buildFieldTree, formatInspectorScalar, inspectorTypeLabel, type InspectorFieldNode } from './field-tree';
import { collectSemanticSummaries } from './semantic';
import { codexKindLabel } from '../codex/content-labels';
import type {
  DefinitionInspectorViewModel,
  InspectorDefinitionTarget,
  InspectorReference,
  InspectorReferenceDefinitionRef,
  InspectorReferenceStatus,
  InspectorRenderOptions,
  InspectorSummaryField,
  InspectorTab,
} from './types';

type ReferenceDirection = 'outbound' | 'inbound';
type IncomingReferenceCategory = 'direct' | 'self' | 'derived' | 'runtime-rule' | 'candidate' | 'unresolved';

const TAB_LABELS: Readonly<Record<InspectorTab, string>> = {
  overview: '资料',
  relations: '被引用',
  raw: '技术详情',
};

const STATUS_LABELS: Readonly<Record<InspectorReferenceStatus, string>> = {
  resolved: '已解析',
  missing: '缺失',
  ambiguous: '歧义',
};

const INCOMING_CATEGORY_LABELS: Readonly<Record<IncomingReferenceCategory, string>> = {
  direct: '确定的直接引用',
  self: '自引用',
  derived: '派生引用',
  'runtime-rule': '运行时规则',
  candidate: '可能使用（候选）',
  unresolved: '未解析关系',
};

const INSPECTOR_ID = 'runtime-editor-codex-inspector';

function inspectorTabId(tab: InspectorTab): string {
  return INSPECTOR_ID + '-tab-' + tab;
}

function inspectorPanelId(tab: InspectorTab): string {
  return INSPECTOR_ID + '-panel-' + tab;
}

export function escapeInspectorHtml(value: string): string {
  return value.replace(/[&<>\"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function esc(value: unknown): string {
  return escapeInspectorHtml(String(value));
}

function renderFieldNode(node: InspectorFieldNode): string {
  const truncation = node.truncation ? ' · ' + node.truncation : '';
  const meta = '<code class=\"codex-field-path\">' + esc(node.path) + '</code>'
    + '<span class=\"codex-field-type\">' + esc(inspectorTypeLabel(node.type)) + '</span>'
    + '<span class=\"codex-field-value\">' + esc(node.displayValue) + '</span>'
    + (truncation ? '<span class=\"codex-field-truncation\">' + esc(truncation) + '</span>' : '');
  if (node.children.length === 0) {
    return '<div class=\"codex-field-node codex-field-leaf\" data-codex-field-path=\"' + esc(node.path) + '\"><span class=\"codex-field-line\">' + meta + '</span></div>';
  }
  return '<details class=\"codex-field-node\" data-codex-field-path=\"' + esc(node.path) + '\" open><summary class=\"codex-field-line\">'
    + meta + '</summary><div class=\"codex-field-children\">' + node.children.map(renderFieldNode).join('') + '</div></details>';
}

function rebaseFieldTree(node: InspectorFieldNode, rootPath: string): InspectorFieldNode {
  return {
    ...node,
    path: rootPath + node.path.slice(1),
    children: node.children.map(child => rebaseFieldTree(child, rootPath)),
  };
}

export function renderFieldTree(
  value: unknown,
  options: Pick<InspectorRenderOptions, 'maxDepth' | 'maxNodes'> = {},
  rootPath = '$',
): string {
  const tree = rebaseFieldTree(buildFieldTree(value, options), rootPath);
  return '<div class=\"codex-field-tree\" data-codex-field-tree>' + renderFieldNode(tree) + '</div>';
}

function renderSource(source: DefinitionInspectorViewModel['source']): string {
  if (!source) return '';
  const rows = [
    source.modId ? ['来源包', source.modId] : source.label ? ['来源', source.label] : undefined,
    source.version ? ['版本', source.version] : undefined,
  ].filter((row): row is [string, string] => row !== undefined);
  return rows.map(([label, value]) => '<div class=\"codex-inspector-row\"><span>' + esc(label) + '</span><span>' + esc(value) + '</span></div>').join('');
}

function renderReferenceLocation(
  reference: InspectorReference,
  direction: ReferenceDirection,
  target: InspectorDefinitionTarget,
): string | undefined {
  if (reference.scope !== 'local') return undefined;
  if (direction === 'inbound') return reference.path || undefined;
  const locations = (reference.targetLocations ?? []).filter(location =>
    location.ref.definitionKind === target.definitionKind
    && location.ref.fullId !== null
    && location.ref.fullId === target.fullId,
  );
  return locations.length === 1 ? locations[0].path : undefined;
}

function renderReferenceTarget(
  target: InspectorDefinitionTarget,
  interactive: boolean,
  reference?: InspectorReference,
  direction?: ReferenceDirection,
): string {
  const identity = '<span>' + esc(codexKindLabel(target.definitionKind)) + '</span><code>' + esc(target.fullId) + '</code>'
    + (target.label ? '<span>' + esc(target.label) + '</span>' : '');
  if (!interactive || !target.entryKey) return identity;
  const location = reference && direction ? renderReferenceLocation(reference, direction, target) : undefined;
  const locationAttribute = location ? ' data-codex-reference-location=\"' + esc(location) + '\"' : '';
  return '<button type=\"button\" class=\"codex-reference-target-button\" data-codex-reference-target=\"'
    + esc(target.entryKey) + '\"' + locationAttribute + ' aria-label=\"跳转到 ' + esc(target.definitionKind) + ' '
    + esc(target.fullId) + '\">' + identity + '</button>';
}

function isStructuredValue(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function profileValueSummary(value: object): string {
  return Array.isArray(value) ? value.length + ' 项' : '展开字段';
}

function referenceForProfilePath(view: DefinitionInspectorViewModel, path: string | undefined): InspectorReference | undefined {
  if (!path) return undefined;
  return (view.references ?? []).find(reference =>
    reference.path === path
    && reference.status === 'resolved'
    && reference.scope !== 'candidate'
    && reference.confidence !== 'inferred'
    && Boolean(reference.target.entryKey),
  );
}

function renderProfileScalarValue(view: DefinitionInspectorViewModel, value: unknown, path: string | undefined): string {
  const reference = referenceForProfilePath(view, path);
  return reference
    ? renderReferenceTarget(reference.target, true, reference, 'outbound')
    : '<span>' + esc(formatInspectorScalar(value)) + '</span>';
}

function isProfileScalar(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

function renderProfileField(
  view: DefinitionInspectorViewModel,
  field: InspectorSummaryField,
  options: InspectorRenderOptions,
): string {
  const value = Array.isArray(field.value) && field.value.every(isProfileScalar)
    ? field.value.length === 0
      ? '<span>0 项</span>'
      : '<ul class=\"codex-inspector-profile-values\">' + field.value.map((item, index) =>
        '<li>' + renderProfileScalarValue(view, item, field.path ? field.path + '[' + index + ']' : undefined) + '</li>',
      ).join('') + '</ul>'
    : isStructuredValue(field.value)
    ? '<details class=\"codex-inspector-profile-value\"><summary>' + esc(profileValueSummary(field.value)) + '</summary>'
      + renderFieldTree(field.value, options, field.path ?? '$') + '</details>'
    : renderProfileScalarValue(view, field.value, field.path);
  const pathAttribute = field.path ? ' data-codex-profile-path=\"' + esc(field.path) + '\"' : '';
  return '<div class=\"codex-inspector-row\" data-codex-profile-field=\"' + esc(field.label) + '\"' + pathAttribute
    + '><span>' + esc(field.label) + '</span>' + value + '</div>';
}

function renderSummaryFields(view: DefinitionInspectorViewModel, options: InspectorRenderOptions): string {
  const fields = (view.summaryFields ?? []).filter(field =>
    !['$.id', '$.name', '$.title', '$.displayName', '$.resourceId', '$.label'].includes(field.path ?? ''),
  );
  if (fields.length === 0) return '';
  return '<section class=\"codex-inspector-section codex-inspector-definition-fields\"><h3>定义资料</h3>'
    + fields.map(field => renderProfileField(view, field, options)).join('') + '</section>';
}

function profileFieldPath(path: string | undefined): readonly string[] | undefined {
  if (!path) return undefined;
  const match = path.match(/^\$\.([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)$/);
  return match?.[1].split('.');
}

function omitSelectedFields(value: unknown, paths: readonly (readonly string[])[]): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || paths.length === 0) return value;
  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return value;
  }
  const pathsByKey = new Map<string, readonly (readonly string[])[]>();
  for (const path of paths) {
    const matching = pathsByKey.get(path[0]) ?? [];
    pathsByKey.set(path[0], [...matching, path.slice(1)]);
  }
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const matching = pathsByKey.get(key) ?? [];
    if (matching.some(path => path.length === 0)) continue;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      const nestedPaths = matching.filter(path => path.length > 0);
      if (nestedPaths.length > 0 && 'value' in descriptor) {
        Object.defineProperty(result, key, {
          ...descriptor,
          value: omitSelectedFields(descriptor.value, nestedPaths),
        });
      } else {
        Object.defineProperty(result, key, descriptor);
      }
    } catch {
      Object.defineProperty(result, key, { value: '[Unreadable]', enumerable: true, configurable: true });
    }
  }
  return result;
}

function omitDisplayedDefinitionFields(
  definition: unknown,
  summaryFields: readonly InspectorSummaryField[],
): unknown {
  const paths: string[][] = [['id'], ['name'], ['title'], ['displayName'], ['description'], ['label'], ['resourceId']];
  for (const field of summaryFields) {
    const path = profileFieldPath(field.path);
    if (path) paths.push([...path]);
  }
  return omitSelectedFields(definition, paths);
}

function hasInspectableFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== 'object' || value === null) return false;
  try {
    return Object.keys(value).length > 0;
  } catch {
    return true;
  }
}

function renderUnwrappedFields(view: DefinitionInspectorViewModel, options: InspectorRenderOptions): string {
  const value = omitDisplayedDefinitionFields(view.definition, view.summaryFields ?? []);
  if (!hasInspectableFields(value)) return '';
  return '<details class=\"codex-inspector-unwrapped-fields\"><summary>其它定义字段</summary>'
    + renderFieldTree(value, options) + '</details>';
}

function renderCoverageNote(view: DefinitionInspectorViewModel, warnOnEmpty: boolean): string {
  const coverage = view.referenceCoverage;
  if (!coverage || coverage.status !== 'partial') return '';
  if (warnOnEmpty) {
    return '<p class=\"codex-inspector-empty\" data-codex-reference-coverage=\"partial\">当前生效内容仍有部分自定义规则尚未识别。未找到记录不表示没有内容使用它。</p>';
  }
  return '<p class=\"codex-inspector-empty\" data-codex-reference-coverage=\"partial\">出向关系扫描只覆盖已识别规则：本体有 '
    + esc(coverage.declaredCount) + ' 条已声明关系、' + esc(coverage.candidateCount) + ' 条候选关系。</p>';
}

function renderOverview(view: DefinitionInspectorViewModel, options: InspectorRenderOptions): string {
  const semantic = collectSemanticSummaries(view.definition, options);
  const semanticHtml = semantic.map(item =>
    '<div class=\"codex-semantic-summary\" data-codex-semantic-kind=\"' + esc(item.kind) + '\"><span class=\"codex-semantic-kind\">'
    + esc(item.label) + '</span><span class=\"codex-semantic-text\">' + esc(item.text) + '</span><code>' + esc(item.path) + '</code></div>',
  ).join('');
  const metadata = renderSource(view.source)
    + (view.status && view.status !== '已解析'
      ? '<div class=\"codex-inspector-row\"><span>状态</span><span>' + esc(view.status) + '</span></div>'
      : '');
  return '<section class=\"codex-inspector-overview\" role=\"tabpanel\" id=\"' + inspectorPanelId('overview')
    + '\" aria-labelledby=\"' + inspectorTabId('overview') + '\" data-codex-inspector-panel=\"overview\">'
    + (view.description ? '<p class=\"codex-inspector-description\">' + esc(view.description) + '</p>' : '')
    + (metadata ? '<div class=\"codex-inspector-metadata\">' + metadata + '</div>' : '')
    + renderSummaryFields(view, options)
    + (semantic.length ? '<section class=\"codex-inspector-section\"><h3>语义摘要</h3>' + semanticHtml + '</section>' : '')
    + renderUnwrappedFields(view, options)
    + '</section>';
}

function sameReference(left: InspectorReferenceDefinitionRef, right: InspectorReferenceDefinitionRef): boolean {
  return left.definitionKind === right.definitionKind && left.fullId === right.fullId;
}

function sourceIdentity(reference: InspectorReference): InspectorReferenceDefinitionRef {
  return reference.edgeSource ?? {
    definitionKind: reference.target.definitionKind,
    fullId: reference.target.fullId,
  };
}

function targetForIncomingReference(reference: InspectorReference): InspectorDefinitionTarget {
  const source = sourceIdentity(reference);
  const matchesCanonicalStoryAlias = source.definitionKind === 'storyEntries'
    && (reference.target.definitionKind === 'activeStories' || reference.target.definitionKind === 'passiveStories')
    && source.fullId !== null
    && source.fullId === reference.target.fullId;
  const matchesSource = source.definitionKind === reference.target.definitionKind
    && (source.fullId === null || source.fullId === reference.target.fullId);
  return {
    ...reference.target,
    definitionKind: matchesCanonicalStoryAlias ? reference.target.definitionKind : source.definitionKind,
    fullId: source.fullId ?? reference.target.fullId,
    ...(matchesSource || matchesCanonicalStoryAlias ? {} : { entryKey: undefined }),
  };
}

function isSelfReference(reference: InspectorReference, view: DefinitionInspectorViewModel): boolean {
  if (reference.edgeSource && reference.edgeTarget) return sameReference(reference.edgeSource, reference.edgeTarget);
  const source = sourceIdentity(reference);
  return source.definitionKind === view.definitionKind
    && (source.fullId === null || source.fullId === view.fullId);
}

function incomingCategory(reference: InspectorReference, view: DefinitionInspectorViewModel): IncomingReferenceCategory {
  if (reference.scope === 'candidate' || reference.status === 'ambiguous' || reference.confidence === 'inferred') return 'candidate';
  if (reference.status === 'missing') return 'unresolved';
  if (isSelfReference(reference, view)) return 'self';
  if (reference.sourceCategory === 'derived') return 'derived';
  if (reference.sourceCategory === 'runtime-rule') return 'runtime-rule';
  return 'direct';
}

interface IncomingReferenceGroup {
  readonly sourceKey: string;
  readonly target: InspectorDefinitionTarget;
  readonly references: InspectorReference[];
}

function groupIncomingReferences(
  references: readonly InspectorReference[],
  category: IncomingReferenceCategory,
  view: DefinitionInspectorViewModel,
): IncomingReferenceGroup[] {
  const groups = new Map<string, IncomingReferenceGroup>();
  for (const reference of references) {
    if (incomingCategory(reference, view) !== category) continue;
    const source = sourceIdentity(reference);
    const fullId = source.fullId ?? reference.target.fullId;
    const key = JSON.stringify([source.definitionKind, fullId]);
    const existing = groups.get(key);
    if (existing) existing.references.push(reference);
    else groups.set(key, { sourceKey: key, target: targetForIncomingReference(reference), references: [reference] });
  }
  return [...groups.values()];
}

function sourcePathCount(groups: readonly IncomingReferenceGroup[]): { pathCount: number; unlocatedCount: number } {
  const paths = new Set<string>();
  let unlocatedCount = 0;
  for (const group of groups) {
    for (const reference of group.references) {
      if (reference.path) paths.add(JSON.stringify([group.sourceKey, reference.path]));
      else unlocatedCount += 1;
    }
  }
  return { pathCount: paths.size, unlocatedCount };
}

function referenceLocationButton(reference: InspectorReference, target: InspectorDefinitionTarget): string {
  if (!target.entryKey) return '';
  const location = renderReferenceLocation(reference, 'inbound', target);
  if (!location) return '';
  return '<button type=\"button\" class=\"codex-reference-location-button\" data-codex-reference-target=\"'
    + esc(target.entryKey) + '\" data-codex-reference-location=\"' + esc(location) + '\">定位此处</button>';
}

function renderIncomingReferencePath(reference: InspectorReference): string {
  const source = targetForIncomingReference(reference);
  const path = reference.path
    ? '<code data-codex-reference-path=\"' + esc(reference.path) + '\">' + esc(reference.path) + '</code>'
    : '<small>路径未提供</small>';
  const scope = reference.scope === 'local' ? '<small>局部关系</small>' : '';
  const context = reference.context
    ? '<small>局部上下文：' + esc(reference.context.definitionKind) + ' · '
      + esc(reference.context.fullId ?? '局部定义') + '</small>'
    : '';
  const locations = (reference.targetLocations ?? []).map(location =>
    '<small>局部位置：' + esc(location.ref.definitionKind) + ' · ' + esc(location.ref.fullId ?? '局部定义')
    + ' · <code data-codex-reference-path=\"' + esc(location.path) + '\">' + esc(location.path) + '</code></small>',
  ).join('');
  const candidates = (reference.scope === 'candidate' || reference.status === 'ambiguous') && reference.candidates?.length
    ? '<div class=\"codex-reference-candidates\"><span>可能目标：</span>'
      + reference.candidates.map(candidate => renderReferenceTarget(candidate, Boolean(candidate.entryKey))).join('') + '</div>'
    : '';
  const status = '<small>' + esc(STATUS_LABELS[reference.status]) + '</small>';
  return '<li data-codex-reference-status=\"' + esc(reference.status) + '\" data-codex-reference-direction=\"inbound\" data-codex-reference-confidence=\"'
    + esc(reference.confidence ?? '') + '\"><span>'
    + esc(reference.relation ?? '引用用途') + '</span>' + path + scope + context + locations + status
    + referenceLocationButton(reference, source) + candidates + '</li>';
}

function renderIncomingGroup(group: IncomingReferenceGroup): string {
  const first = group.references[0];
  const interactive = Boolean(group.target.entryKey);
  const singlePathReference = group.references.length === 1 ? first : undefined;
  const target = renderReferenceTarget(group.target, interactive, singlePathReference, 'inbound');
  const relations = [...new Set(group.references.map(reference => reference.relation ?? '引用用途'))].join(' / ');
  const counts = sourcePathCount([group]);
  const locationSummary = counts.pathCount + ' 条引用路径'
    + (counts.unlocatedCount ? ' · ' + counts.unlocatedCount + ' 条未提供路径' : '');
  const paths = group.references.map(renderIncomingReferencePath).join('');
  const pathContent = group.references.length > 1
    ? '<details class=\"codex-related-paths\"><summary>' + esc(locationSummary) + '</summary><ul>' + paths + '</ul></details>'
    : '<ul class=\"codex-related-paths codex-related-paths--single\">' + paths + '</ul>';
  return '<li class=\"codex-related-group\" data-codex-reference-source=\"' + esc(encodeURIComponent(group.sourceKey))
    + '\"><div class=\"codex-related-item\">' + target + '<span class=\"codex-related-relation\">' + esc(relations)
    + '</span></div>' + pathContent + '</li>';
}

function renderIncomingSection(
  category: IncomingReferenceCategory,
  groups: readonly IncomingReferenceGroup[],
): string {
  const { pathCount, unlocatedCount } = sourcePathCount(groups);
  const counts = groups.length + ' 个引用者 · ' + pathCount + ' 条引用路径'
    + (unlocatedCount ? ' · ' + unlocatedCount + ' 条未提供路径' : '');
  if (groups.length === 0) {
    return '<section class=\"codex-inspector-section\"><h3>' + INCOMING_CATEGORY_LABELS[category]
      + ' <span data-codex-reference-source-count=\"0\" data-codex-reference-path-count=\"0\">0 个引用者 · 0 条引用路径</span></h3><p class=\"codex-inspector-empty\">未找到确定的直接引用者。</p></section>';
  }
  return '<section class=\"codex-inspector-section\"><h3>' + INCOMING_CATEGORY_LABELS[category]
    + ' <span data-codex-reference-source-count=\"' + groups.length + '\" data-codex-reference-path-count=\"'
    + pathCount + '\">' + esc(counts) + '</span></h3><ul class=\"codex-incoming-reference-groups\">'
    + groups.map(renderIncomingGroup).join('') + '</ul></section>';
}

function renderRelations(view: DefinitionInspectorViewModel): string {
  const incoming = view.reverseReferences ?? [];
  const categories: readonly IncomingReferenceCategory[] = ['direct', 'self', 'derived', 'runtime-rule', 'candidate', 'unresolved'];
  const grouped = new Map(categories.map(category => [
    category,
    groupIncomingReferences(incoming, category, view),
  ]));
  const directGroups = grouped.get('direct') ?? [];
  const content = [
    renderIncomingSection('direct', directGroups),
    ...categories.filter(category => category !== 'direct').map(category =>
      (grouped.get(category)?.length ?? 0) > 0 ? renderIncomingSection(category, grouped.get(category) ?? []) : '',
    ),
  ].join('');
  const coverage = renderCoverageNote(view, directGroups.length === 0);
  return '<section class=\"codex-inspector-relations\" role=\"tabpanel\" id=\"' + inspectorPanelId('relations')
    + '\" aria-labelledby=\"' + inspectorTabId('relations') + '\" data-codex-inspector-panel=\"relations\">'
    + coverage + content + '</section>';
}

function renderReference(reference: InspectorReference, direction: ReferenceDirection): string {
  const statusLabel = STATUS_LABELS[reference.status];
  const confidenceLabel = reference.confidence === 'inferred' ? '推断' : reference.confidence === 'declared' ? '已声明' : '';
  const candidates = reference.status !== 'resolved' && reference.candidates?.length
    ? '<div class=\"codex-reference-candidates\"><span>候选：</span>'
      + reference.candidates.map(candidate => renderReferenceTarget(candidate, Boolean(candidate.entryKey))).join('') + '</div>'
    : '';
  const interactive = direction === 'inbound' ? Boolean(reference.target.entryKey) : reference.status === 'resolved';
  const target = renderReferenceTarget(reference.target, interactive, reference, direction);
  const confidence = confidenceLabel ? '<span class=\"codex-reference-confidence\">' + esc(confidenceLabel) + '</span>' : '';
  const path = reference.path
    ? '<code data-codex-reference-path=\"' + esc(reference.path) + '\">' + esc(reference.path) + '</code>'
    : '';
  const scope = reference.scope === 'local' ? '<small>局部关系</small>' : '';
  const context = reference.context
    ? '<small>局部上下文：' + esc(reference.context.definitionKind) + ' · '
      + esc(reference.context.fullId ?? '局部定义') + '</small>'
    : '';
  return '<li class=\"codex-reference codex-reference-' + esc(reference.status)
    + '\" data-codex-reference-status=\"' + esc(reference.status) + '\" data-codex-reference-direction=\"'
    + direction + '\" data-codex-reference-confidence=\"' + esc(reference.confidence ?? '') + '\">'
    + '<div class=\"codex-reference-head\"><span class=\"codex-reference-status\">' + esc(statusLabel) + '</span>'
    + confidence + '<span>' + esc(reference.relation ?? (direction === 'outbound' ? '引用' : '被引用'))
    + '</span>' + path + scope + context + '</div>'
    + '<div class=\"codex-reference-target\">' + target + '</div>' + candidates + '</li>';
}

function renderOutboundReferences(view: DefinitionInspectorViewModel): string {
  const outbound = view.references ?? [];
  const list = outbound.length
    ? '<ul>' + outbound.map(reference => renderReference(reference, 'outbound')).join('') + '</ul>'
    : '<p class=\"codex-inspector-empty\">暂无已识别的出向关系。</p>';
  return '<section class=\"codex-inspector-section\"><h3>向外引用 <span>' + outbound.length + '</span></h3>' + list + '</section>';
}

function renderRaw(view: DefinitionInspectorViewModel, options: InspectorRenderOptions): string {
  let json: string;
  try {
    json = JSON.stringify(view.definition, null, 2) ?? 'undefined';
  } catch {
    json = '[无法序列化]';
  }
  return '<section class=\"codex-inspector-raw\" role=\"tabpanel\" id=\"' + inspectorPanelId('raw')
    + '\" aria-labelledby=\"' + inspectorTabId('raw') + '\" data-codex-inspector-panel=\"raw\">'
    + renderCoverageNote(view, false)
    + renderOutboundReferences(view)
    + '<section class=\"codex-inspector-section\"><div class=\"codex-inspector-section-head\"><h3>字段树</h3>'
    + '<button type=\"button\" class=\"codex-inspector-copy-raw\" data-codex-copy-raw data-codex-copy-format=\"json\" aria-label=\"复制当前 Def 的原始 JSON\">复制 JSON</button></div>'
    + renderFieldTree(view.definition, options) + '</section>'
    + '<details class=\"codex-inspector-section codex-inspector-json\"><summary>严格 JSON</summary><pre data-codex-raw-json>'
    + esc(json) + '</pre></details></section>';
}

function renderTabs(tab: InspectorTab): string {
  const buttons = (Object.keys(TAB_LABELS) as InspectorTab[]).map(key =>
    '<button type=\"button\" role=\"tab\" id=\"' + inspectorTabId(key) + '\" data-codex-inspector-tab=\"' + key
    + '\" aria-controls=\"' + inspectorPanelId(key) + '\" aria-selected=\"' + (key === tab ? 'true' : 'false')
    + '\" tabindex=\"' + (key === tab ? '0' : '-1') + '\">' + TAB_LABELS[key] + '</button>',
  ).join('');
  return '<nav class=\"codex-inspector-tabs\" id=\"' + INSPECTOR_ID + '-tabs\" role=\"tablist\" aria-label=\"详情页签\">'
    + buttons + '</nav>';
}

export function renderDefinitionInspector(
  view: DefinitionInspectorViewModel,
  tab: InspectorTab = 'overview',
  options: InspectorRenderOptions = {},
): string {
  const panel = tab === 'relations' ? renderRelations(view) : tab === 'raw' ? renderRaw(view, options) : renderOverview(view, options);
  return '<section class=\"codex-inspector\" data-codex-inspector data-codex-inspector-tab=\"' + esc(tab) + '\">'
    + renderTabs(tab) + panel + '</section>';
}
