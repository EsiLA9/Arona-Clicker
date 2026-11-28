import type { EditorResourceOpenRequest } from './editor-resource-request';
import type { UIContext } from '../runtime/context';
import { renderEditorEntityIcon, type EditorWorldIconType } from '../components/shared/editor-entity-icon';
import { indexEditorExplorer, type EditorExplorerNode, type EditorExplorerNodeAction } from './editor-explorer-nodes';

export function renderEditorGear(): string {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.7 2.5h2.6l.5 1.8 1.5.9 1.8-.5 1.3 2.2-1.3 1.4v1.8l1.3 1.4-1.3 2.2-1.8-.5-1.5.9-.5 1.8H8.7l-.5-1.8-1.5-.9-1.8.5-1.3-2.2 1.3-1.4V8.3L3.6 6.9l1.3-2.2 1.8.5 1.5-.9z"/><circle cx="10" cy="9.9" r="2.4"/></svg>';
}

export function renderEditorDirectoryTools(label: string, controls: string, key: string): string {
  return `<div class="editor-directory-tools" data-editor-key="${key}" role="group" aria-label="${label}">${controls}</div>`;
}

function renderEditorDirectoryList(content: string, hidden = false): string {
  return `<ul class="editor-directory-tree"${hidden ? ' hidden' : ''}>${content}</ul>`;
}

function renderEditorDirectoryRow(ctx: UIContext, spec: {
  key: string;
  control: string;
  controlsBefore: string;
  actions: string;
  children: string;
  attributes: string;
}): string {
  return `<li data-editor-key="${ctx.escapeHtml(spec.key)}" ${spec.attributes}>
    <div class="editor-directory-heading">${spec.controlsBefore}${spec.control}${spec.actions}</div>${spec.children}</li>`;
}

export type EditorDirectoryToggleIcon = {
  readonly viewBox?: string;
  /** Trusted SVG fragments supplied by the application for a folder type. */
  readonly collapsed: string;
  readonly expanded: string;
} | { readonly entity: EditorWorldIconType };

export const editorDirectoryToggleIcons: Readonly<Partial<Record<string, EditorDirectoryToggleIcon>>> = {
  init: { entity: 'init' },
  area: { entity: 'area' },
  spot: { entity: 'spot' },
};

function renderEditorDirectoryToggle(open: boolean, attributes: string, icon?: EditorDirectoryToggleIcon): string {
  const svg = !icon
    ? '<svg class="editor-directory-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4"/></svg>'
    : 'entity' in icon ? renderEditorEntityIcon(icon.entity, undefined, true)
    : `<svg class="editor-directory-toggle-icon" viewBox="${icon.viewBox ?? '0 0 12 12'}" aria-hidden="true">
    <g class="editor-directory-toggle-collapsed">${icon.collapsed}</g><g class="editor-directory-toggle-expanded">${icon.expanded}</g></svg>`;
  return `<button type="button" class="mini-action" data-editor-key="expand-slot" ${attributes} aria-expanded="${open}">
    ${svg}</button>`;
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
  readonly totalChildren: number;
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

export function projectEditorExplorerTree(positions: readonly EditorExplorerNode[], options: {
  readonly query: string;
  readonly filtering?: boolean;
  readonly domainVisible?: (node: EditorExplorerNode) => boolean;
  readonly revealPlacementKey?: string;
  readonly expandedOverrides?: Readonly<Record<string, boolean>>;
  readonly searchExpandedOverrides?: Readonly<Record<string, boolean>>;
  readonly selectedPlacementKey?: string;
  readonly activeResourceKey?: string;
  readonly activeSourceKey?: string;
  readonly defaultExpanded?: (node: EditorExplorerNode) => boolean;
}): EditorExplorerTreeProjection {
  const query = options.query.trim().toLocaleLowerCase();
  const searching = Boolean(query || options.filtering);
  const index = indexEditorExplorer(positions);
  let matchCount = 0;
  const visit = (node: EditorExplorerNode): ProjectedEditorExplorerNode | undefined => {
    const actualChildren = index.children(node.placementKey);
    const children = actualChildren.flatMap(child => {
      const projected = visit(child);
      return projected?.isVisible ? [projected] : [];
    });
    const domainVisible = options.domainVisible?.(node) ?? true;
    const selfMatches = !query || node.searchableText.some(text => text.toLocaleLowerCase().includes(query));
    const isRevealTarget = node.placementKey === options.revealPlacementKey;
    const isSelected = node.placementKey === options.selectedPlacementKey;
    const isActiveResource = Boolean(node.resource && node.resource.resourceKey === options.activeResourceKey
        && (options.activeSourceKey === undefined || node.sourceKey === options.activeSourceKey));
    const isVisible = (domainVisible || isRevealTarget) && (selfMatches || isRevealTarget) || children.length > 0;
    if (domainVisible && query && selfMatches) matchCount += 1;
    if (!isVisible) return undefined;
    const containsSelected = isSelected || children.some(child => child.containsSelected);
    const containsReveal = isRevealTarget || children.some(child => child.containsReveal);
    const overrides = searching || containsReveal ? options.searchExpandedOverrides : options.expandedOverrides;
    const effectiveExpanded = overrides?.[node.placementKey]
      ?? (searching || containsSelected || containsReveal || Boolean(options.defaultExpanded?.(node)));
    return { ...node, children, totalChildren: actualChildren.length, selfMatches, isRevealTarget, isSelected, isActiveResource, isVisible, effectiveExpanded,
      containsSelected, containsReveal };
  };
  const projectedRoots = index.children().flatMap(root => {
    const projected = visit(root);
    return projected?.isVisible ? [projected] : [];
  });
  const hasBaseNodes = positions.length > 0;
  const emptyReason = projectedRoots.length ? undefined
    : !hasBaseNodes ? 'no-items' : query ? 'no-text-results' : 'no-domain-results';
  return { roots: projectedRoots, query, matchCount, emptyReason };
}

export function renderEditorExplorerTree(ctx: UIContext, projection: EditorExplorerTreeProjection, emptyMessage = '没有匹配项。',
  toggleIcons = editorDirectoryToggleIcons): string {
  const e = ctx.escapeHtml;
  const renderNode = (node: ProjectedEditorExplorerNode, depth: number): string => {
    const deferred = node.folder?.mount === 'on-expand';
    const children = deferred && !node.effectiveExpanded
      ? node.children.filter(child => child.folder || child.containsSelected || child.containsReveal)
      : node.children;
    const key = e(node.placementKey);
    const label = `<span class="editor-directory-name${node.presentation?.markers?.includes('strong-label') ? ' editor-directory-name--strong' : ''}">${e(node.label)}</span>`
      + (node.presentation?.auxiliaryLabel ? `<small class="editor-directory-note"${node.presentation.auxiliaryTone ? ` data-editor-note-tone="${e(node.presentation.auxiliaryTone)}"` : ''}>${e(node.presentation.auxiliaryLabel)}</small>` : '');
    const entityKind = node.presentation?.kind ?? node.resource?.kind;
    const iconType = node.folder?.toggleIconType ?? entityKind;
    const toggleIcon = node.children.length && iconType && Object.prototype.hasOwnProperty.call(toggleIcons, iconType)
      ? toggleIcons[iconType] : undefined;
    const toggle = node.children.length
      ? renderEditorDirectoryToggle(node.effectiveExpanded,
        `data-editor-expand data-editor-placement-key="${key}"${deferred ? ' data-editor-expand-deferred' : ''} aria-label="展开或收起 ${e(node.label)}"`,
        toggleIcon)
      : '';
    const rowIcon = toggleIcon && 'entity' in toggleIcon && toggleIcon.entity === entityKind
      ? '' : renderEditorEntityIcon(entityKind, node.presentation?.entryType);
    const opensResource = Boolean(node.resource && !node.folder);
    const disabledReason = opensResource ? node.openDisabledReason : node.selectDisabledReason;
    const control = `<button type="button" class="editor-directory-row"`
      + ` data-editor-key="placement-label" data-editor-placement-select data-editor-placement-key="${key}"${opensResource ? ' data-editor-explorer-action="open"' : node.select ? ' data-editor-explorer-action="select"' : ''}`
      + ` aria-pressed="${node.isSelected}" title="${e(disabledReason ?? node.presentation?.tooltip ?? node.label)}"${disabledReason ? ' aria-disabled="true"' : ''}>`
      + `${rowIcon}${label}</button>`;
    const actions = [...(node.actions ?? [])];
    if (node.folder && node.resource) actions.unshift({ id: 'open', icon: 'gear',
      label: node.resourceActionLabel ?? `打开 ${node.label}`, disabledReason: node.openDisabledReason });
    const controls = actions.map(action =>
      `<button type="button" class="mini-action${action.icon === 'gear' ? ' editor-directory-manage' : ''}" data-editor-key="row-action:${e(action.id)}" data-editor-explorer-action="${e(action.id)}"`
      + ` aria-label="${e(action.label)}" title="${e(action.disabledReason ?? action.label)}"${action.disabledReason ? ' disabled' : ''}>`
      + `${action.icon === 'gear' ? renderEditorGear() : e(action.label)}</button>`).join('');
    const subtree = node.children.length
      ? renderEditorDirectoryList(children.map(child => renderNode(child, depth + 1)).join(''), !node.effectiveExpanded)
      : projection.query && node.totalChildren && node.selfMatches
        ? '<small class="editor-directory-empty-note">无匹配项</small>' : '';
    const resourceKey = node.resource ? e(node.resource.resourceKey) : undefined;
    const identity = resourceKey === undefined ? '' : ` data-editor-highlight-resource="${resourceKey}"${
      node.sourceKey !== undefined ? ` data-editor-highlight-source="${e(node.sourceKey)}"` : ''}`;
    const attributes = `data-editor-placement-key="${key}" style="--editor-directory-depth:${depth}"${identity}${node.isActiveResource ? ' data-active-resource="true"' : ''}${node.isRevealTarget ? ' data-editor-reveal-target' : ''}`;
    return renderEditorDirectoryRow(ctx, { key: node.placementKey, control, controlsBefore: toggle, actions: controls,
      children: subtree, attributes });
  };
  return projection.roots.length
    ? renderEditorDirectoryList(projection.roots.map(root => renderNode(root, 0)).join(''))
    : `<p class="editor-explorer-empty" role="status">${e(emptyMessage)}</p>`;
}

/** Resolve tree commands against the current data, using only the position and action from the DOM. */
export function editorDirectoryClick(root: HTMLElement, event: MouseEvent, resolve: (row: HTMLElement) => EditorExplorerNode | undefined,
  handlers: {
    expand: (placementKey: string, toggle: HTMLElement, open: boolean) => void;
    select: (placementKey: string, control: HTMLElement | null) => void;
    open: (request: EditorResourceOpenRequest, control?: HTMLElement) => boolean;
    onCommand?: () => void;
  }): boolean {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-editor-expand], [data-editor-explorer-action], [data-editor-placement-select]') : null;
  const row = target?.closest<HTMLElement>('li[data-editor-placement-key]');
  if (!target || !row || !root.contains(row)) return false;
  const key = row.dataset.editorPlacementKey!;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (target.getAttribute('aria-disabled') === 'true' || target.hasAttribute('disabled')) return true;
  const id = target.dataset.editorExplorerAction;
  if (!id) {
    const toggle = target.hasAttribute('data-editor-expand') ? target
      : row.querySelector<HTMLElement>(':scope > .editor-directory-heading > [data-editor-expand]');
    handlers.select(key, toggle === target
      ? row.querySelector<HTMLElement>(':scope > .editor-directory-heading > [data-editor-placement-select]') : target);
    if (toggle) handlers.expand(key, toggle, toggle.getAttribute('aria-expanded') !== 'true');
    return true;
  }
  const node = resolve(row);
  if (!node) return true;
  if (id === 'select' && !node.selectDisabledReason && node.select) {
    handlers.select(key, target);
    node.select(root);
    handlers.onCommand?.();
    return true;
  }
  const action: EditorExplorerNodeAction | undefined = id === 'open' && node.resource
    ? { id, label: node.label, resource: node.resource, sourceKey: node.sourceKey, disabledReason: node.openDisabledReason }
    : node.actions?.find(candidate => candidate.id === id);
  if (action && !action.disabledReason) {
    if (action.resource) {
      handlers.open({ resource: action.resource, sourceKey: action.sourceKey, placementKey: key,
        origin: 'explorer-placement' }, target.hasAttribute('data-editor-placement-select') ? target : undefined);
    } else if (action.run) {
      action.run(root);
      handlers.onCommand?.();
    }
  }
  return true;
}

export function setEditorDirectoryExpanded(toggle: HTMLElement, open: boolean): boolean {
  const children = toggle.closest('li')?.querySelector<HTMLUListElement>(':scope > ul');
  if (!children) return false;
  toggle.setAttribute('aria-expanded', String(open));
  children.hidden = !open;
  return true;
}
