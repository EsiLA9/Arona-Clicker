import type { UIContext } from '../runtime/context';
import type { EditorExplorerNode, EditorExplorerNodeAction } from './editor-explorer-nodes';

export function renderEditorExplorerIcon(kind: string | undefined): string {
  if (kind === 'book') return '<svg class="editor-document-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h4.5A2.5 2.5 0 0 1 10 6.5V17a3.2 3.2 0 0 0-2.5-1.3H3zm14 0h-4.5A2.5 2.5 0 0 0 10 6.5V17a3.2 3.2 0 0 1 2.5-1.3H17z"/></svg>';
  if (kind === 'document') return '<svg class="editor-document-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3.5h8l4 4V16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16zM12 3.5V8h4m-9 3h6m-6 3h6"/></svg>';
  return kind ? `<span class="editor-explorer-icon editor-explorer-icon--${kind}" aria-hidden="true"></span>` : '';
}

export function renderStoryDocumentIcon(kind: 'story' | 'entry'): string {
  return kind === 'story'
    ? '<svg class="editor-document-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h4.5A2.5 2.5 0 0 1 10 6.5V17a3.2 3.2 0 0 0-2.5-1.3H3zm14 0h-4.5A2.5 2.5 0 0 0 10 6.5V17a3.2 3.2 0 0 1 2.5-1.3H17z"/></svg>'
    : '<svg class="editor-document-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3.5h8l4 4V16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16zM12 3.5V8h4m-9 3h6m-6 3h6"/></svg>';
}

export function renderEditorGear(): string {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.7 2.5h2.6l.5 1.8 1.5.9 1.8-.5 1.3 2.2-1.3 1.4v1.8l1.3 1.4-1.3 2.2-1.8-.5-1.5.9-.5 1.8H8.7l-.5-1.8-1.5-.9-1.8.5-1.3-2.2 1.3-1.4V8.3L3.6 6.9l1.3-2.2 1.8.5 1.5-.9z"/><circle cx="10" cy="9.9" r="2.4"/></svg>';
}

export function renderEditorDirectoryTools(label: string, controls: string, key: string): string {
  return `<div class="editor-directory-tools" data-editor-key="${key}" role="group" aria-label="${label}">${controls}</div>`;
}

export function renderEditorDirectoryList(content: string, attributes = ''): string {
  return `<ul class="editor-directory-tree"${attributes ? ' ' + attributes : ''}>${content}</ul>`;
}

export function renderEditorDirectoryRow(ctx: UIContext, spec: {
  key: string;
  control: string;
  controlsBefore?: string;
  actions?: string;
  children?: string;
  attributes?: string;
}): string {
  const heading = spec.controlsBefore || spec.actions || spec.children
    ? `<div class="editor-directory-heading">${spec.controlsBefore ?? ''}${spec.control}${spec.actions ?? ''}</div>` : spec.control;
  return `<li data-editor-key="${ctx.escapeHtml(spec.key)}"${spec.attributes ? ' ' + spec.attributes : ''}>${heading}${spec.children ?? ''}</li>`;
}

export function renderEditorDirectoryToggle(open: boolean | undefined, attributes: string, content = '', className = 'mini-action'): string {
  return `<button type="button" class="${className}" ${attributes} ${open === undefined ? 'disabled' : `aria-expanded="${open}"`}>
    <svg class="editor-directory-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4"/></svg>${content}</button>`;
}

export function renderEditorExplorerSearch(ctx: UIContext, options: {
  readonly query: string;
  readonly channel: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly className?: string;
  readonly attributes?: string;
}): string {
  const e = ctx.escapeHtml;
  const label = options.label ?? '搜索名称或 ID';
  const input = `<input type="search" aria-label="${e(label)}" data-editor-explorer-query="${e(options.channel)}"${options.attributes ? ` ${options.attributes}` : ''} value="${e(options.query)}" placeholder="${e(options.placeholder ?? '名称或 ID')}">`;
  return options.className
    ? `<label class="${e(options.className)}">${e(label)}${input}</label>`
    : input;
}

export interface ProjectedEditorExplorerNode extends EditorExplorerNode {
  readonly children: readonly ProjectedEditorExplorerNode[];
  readonly selfMatches: boolean;
  readonly isRevealTarget: boolean;
  readonly isSelected: boolean;
  readonly isActiveResource: boolean;
  readonly isVisible: boolean;
  readonly effectiveExpanded: boolean;
  readonly containsSelected: boolean;
  readonly containsReveal: boolean;
}

export interface EditorExplorerTreeProjection {
  readonly roots: readonly ProjectedEditorExplorerNode[];
  readonly query: string;
  readonly matchCount: number;
  readonly emptyReason?: 'no-items' | 'no-domain-results' | 'no-text-results';
}

export function projectEditorExplorerTree(roots: readonly EditorExplorerNode[], options: {
  readonly query: string;
  readonly domainVisible?: (node: EditorExplorerNode) => boolean;
  readonly revealPlacementKey?: string;
  readonly expandedOverrides?: Readonly<Record<string, boolean>>;
  readonly searchExpandedOverrides?: Readonly<Record<string, boolean>>;
  readonly selectedPlacementKey?: string;
  readonly activeResourceKey?: string;
  readonly defaultExpanded?: (node: EditorExplorerNode) => boolean;
}): EditorExplorerTreeProjection {
  const query = options.query.trim().toLocaleLowerCase();
  let matchCount = 0;
  const visit = (node: EditorExplorerNode): ProjectedEditorExplorerNode | undefined => {
    const children = node.children.flatMap(child => {
      const projected = visit(child);
      return projected?.isVisible ? [projected] : [];
    });
    const domainVisible = options.domainVisible?.(node) ?? true;
    const selfMatches = !query || node.searchableText.some(text => text.toLocaleLowerCase().includes(query));
    const isRevealTarget = node.placementKey === options.revealPlacementKey;
    const isSelected = node.placementKey === options.selectedPlacementKey;
    const isActiveResource = Boolean(node.resource && node.resource.resourceKey === options.activeResourceKey);
    const isVisible = (domainVisible || isRevealTarget) && (selfMatches || isRevealTarget) || children.length > 0;
    if (domainVisible && query && selfMatches) matchCount += 1;
    if (!isVisible) return undefined;
    const containsSelected = isSelected || isActiveResource || children.some(child => child.containsSelected);
    const containsReveal = isRevealTarget || children.some(child => child.containsReveal);
    const overrides = query || containsReveal ? options.searchExpandedOverrides : options.expandedOverrides;
    const effectiveExpanded = overrides?.[node.placementKey]
      ?? (Boolean(query) || containsSelected || containsReveal || Boolean(options.defaultExpanded?.(node)));
    return { ...node, children, selfMatches, isRevealTarget, isSelected, isActiveResource, isVisible, effectiveExpanded,
      containsSelected, containsReveal };
  };
  const projectedRoots = roots.flatMap(root => {
    const projected = visit(root);
    return projected?.isVisible ? [projected] : [];
  });
  const hasBaseNodes = roots.length > 0;
  const emptyReason = projectedRoots.length ? undefined
    : !hasBaseNodes ? 'no-items' : query ? 'no-text-results' : 'no-domain-results';
  return { roots: projectedRoots, query, matchCount, emptyReason };
}

export function renderEditorExplorerTree(ctx: UIContext, projection: EditorExplorerTreeProjection, emptyMessage = '没有匹配项。'): string {
  const e = ctx.escapeHtml;
  const escapeKey = (key: string) => e(key);
  const attrsForAction = (action: EditorExplorerNodeAction) => {
    const resource = action.resource;
    const common = `data-editor-explorer-action="${e(action.id)}"`;
    const businessAttributes = Object.entries(action.attributes ?? {}).map(([name, value]) => ` ${e(name)}="${e(value)}"`).join('');
    if (!resource) return common + businessAttributes;
    return `${common} data-editor-resource-provider="${e(resource.providerKey)}" data-editor-resource-kind="${e(resource.kind)}"`
      + ` data-editor-resource-id="${e(resource.id)}" data-editor-resource-key="${e(resource.resourceKey)}"`
      + `${action.sourceKey !== undefined ? ` data-editor-resource-source="${e(action.sourceKey)}"` : ''}`
      + `${resource.ownerModName ? ` data-editor-resource-owner="${e(resource.ownerModName)}"` : ''}` + businessAttributes;
  };
  const renderNode = (node: ProjectedEditorExplorerNode): string => {
    const deferredDom = node.presentation?.markers?.includes('deferred-dom') ?? false;
    const childNodes = deferredDom && !node.effectiveExpanded
      ? node.children.filter(child => child.childState.kind !== 'empty' || child.containsSelected || child.containsReveal)
      : node.children;
    const hasChildren = node.children.length > 0;
    const actualChildren = node.childState.kind === 'loaded' && node.childState.totalCount > 0;
    const kind = node.presentation?.kind;
    const structuralDirectory = kind === 'directory' || kind === 'group'
      || kind === 'init' && node.resource?.providerKey === 'story-directory';
    const label = `<span class="editor-directory-name${node.presentation?.markers?.includes('strong-label') ? ' editor-directory-name--strong' : ''}">${e(node.label)}</span>`
      + `${node.presentation?.auxiliaryLabel ? `<small class="editor-directory-note"${node.presentation.auxiliaryTone ? ` data-editor-note-tone="${e(node.presentation.auxiliaryTone)}"` : ''}>${e(node.presentation.auxiliaryLabel)}</small>` : ''}`;
    const toggle = hasChildren && actualChildren
      ? renderEditorDirectoryToggle(node.effectiveExpanded,
        `data-editor-expand data-editor-placement-select data-editor-placement-key="${escapeKey(node.placementKey)}"${deferredDom ? ' data-editor-expand-deferred' : ''} aria-pressed="${node.isSelected}" title="${e(node.presentation?.tooltip ?? node.label)}"`,
        label, 'editor-directory-row editor-directory-branch')
      : `<span class="editor-directory-chevron-placeholder" aria-hidden="true"></span><span class="editor-directory-row editor-directory-branch"${node.isSelected ? ' data-selected="true"' : ''}>${label}</span>`;
    const resourceButton = node.resource && !structuralDirectory
      ? `<button type="button" class="editor-directory-row${node.isActiveResource ? ' is-active-resource' : ''}" data-editor-resource-provider="${e(node.resource.providerKey)}"`
        + ` data-editor-resource-kind="${e(node.resource.kind)}" data-editor-resource-id="${e(node.resource.id)}" data-editor-resource-key="${e(node.resource.resourceKey)}"`
        + `${node.sourceKey !== undefined ? ` data-editor-resource-source="${e(node.sourceKey)}"` : ''}`
        + ` data-editor-placement-select data-editor-placement-key="${escapeKey(node.placementKey)}" aria-pressed="${node.isSelected}" title="${e(node.presentation?.tooltip ?? node.label)}">`
        + `${renderEditorExplorerIcon(node.presentation?.icon)}${label}</button>` : '';
    const control = structuralDirectory ? toggle : resourceButton || `<span class="editor-directory-row">${label}</span>`;
    const children = childNodes.length || deferredDom && actualChildren && !node.effectiveExpanded
      ? renderEditorDirectoryList(childNodes.map(renderNode).join(''), node.effectiveExpanded ? '' : 'hidden') : '';
    const noVisibleMatches = projection.query && !node.children.length && actualChildren && node.selfMatches
      ? '<small class="editor-directory-empty-note">无匹配项</small>' : '';
    const actions = node.actions?.map(action => `<button type="button" class="mini-action${action.id === 'manage' ? ' editor-directory-manage' : ''}" ${attrsForAction(action)}`
      + `${action.disabledReason ? ` disabled title="${e(action.disabledReason)}"` : ` title="${e(action.label)}"`}>${action.icon === 'gear' || action.id === 'manage' ? renderEditorGear() : e(action.label)}</button>`).join('') ?? '';
    const controlsBefore = !structuralDirectory && hasChildren && actualChildren
      ? renderEditorDirectoryToggle(node.effectiveExpanded,
        `data-editor-expand data-editor-placement-key="${escapeKey(node.placementKey)}" aria-label="展开或收起 ${e(node.label)}" title="展开或收起 ${e(node.label)}"`)
      : '';
    const rowControl = structuralDirectory ? control : resourceButton || control;
    const classes = `data-editor-placement-key="${escapeKey(node.placementKey)}"${node.isActiveResource ? ' data-active-resource="true"' : ''}`;
    return renderEditorDirectoryRow(ctx, { key: node.placementKey, control: rowControl, controlsBefore,
      actions: actions || undefined, children: children || noVisibleMatches || undefined, attributes: classes });
  };
  return projection.roots.length
    ? renderEditorDirectoryList(projection.roots.map(renderNode).join(''))
    : `<p class="editor-explorer-empty" role="status">${e(emptyMessage)}</p>`;
}

export function setEditorDirectoryExpanded(toggle: HTMLElement, open: boolean): boolean {
  const children = toggle.closest('li')?.querySelector<HTMLUListElement>(':scope > ul');
  if (!children) return false;
  toggle.setAttribute('aria-expanded', String(open));
  children.hidden = !open;
  return true;
}
