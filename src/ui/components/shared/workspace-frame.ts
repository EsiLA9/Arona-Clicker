import type { UIContext } from '../../runtime/context';
import { renderUIHost } from '../../presentation/presentation-service';

export type WorkspaceSlot = 'left' | 'center' | 'right';
export type WorkspaceLayoutPreset = 'default' | 'center-heavy';
export type WorkspaceComposition = 'columns' | 'left-center' | 'center-right' | 'all';
export type WorkspaceResponsiveProfile = 'default' | 'two-column' | 'single-column' | 'pane-switch';
export type WorkspaceScrollMode = 'auto' | 'content' | 'none';
export type WorkspaceScrollOwner = 'workspace-body' | 'content-region' | 'delegated';
export type WorkspaceSurface = 'panel' | 'none';
export interface WorkspaceColumnSpec {
  /** Legacy appearance name, never the physical position or instance identity. */
  slot?: WorkspaceSlot;
  key?: string;
  definitionId?: string;
  bindingKey?: string;
  width?: string;
  onBack?: (() => void) | null;
  backSelector?: string;
  actions?: import('../../workspace/column-actions').ColumnActions;
  bind?: (root: HTMLElement) => void | (() => void);
  /** 稳定的业务语义，供主题编辑器和后续工作区扩展识别；不参与布局。 */
  role?: string;
  /** 当前列的 Workspace owner；用于 DOM 身份检查和刷新边界诊断。 */
  workspaceOwner?: string;
  hostId: string;
  themeScope?: string;
  className?: string;
  /** 列是否拥有统一外层 Panel surface；Game 旧面板由列内业务 Panel 自己持有。 */
  surface?: WorkspaceSurface;
  visible?: boolean;
  scroll?: WorkspaceScrollMode;
  header?: string;
  /** Fixed content outside the independently scrolling column body. */
  footer?: string;
  /** Fixed layer over the body viewport, outside its scrolling content. */
  bodyOverlay?: string;
  content: string;
}
export interface WorkspaceLayoutSpec {
  preset?: WorkspaceLayoutPreset;
  responsive?: WorkspaceResponsiveProfile;
  /** Render only the retained columns; callers place absorbed content in the retained slot explicitly. */
  composition?: WorkspaceComposition;
}
interface WorkspaceFrameBase {
  panelAliases?: Partial<Record<WorkspaceSlot, readonly string[]>>;
  /** Optional mount namespace when two instances use the same workspace design. */
  instanceId?: string;
  /** Specialized keyed renderers (Map/Operation) keep ownership of their internal patches. */
  updates?: 'columns' | 'external';
  id: string;
  onBack?: (() => void) | null;
  layout?: WorkspaceLayoutSpec;
  /** Optional shared surface nodes appended as direct children after the frame columns. */
  overlay?: string;
}
export type WorkspaceFrameSpec = WorkspaceFrameBase & (
  | { columns: readonly WorkspaceColumnSpec[] }
  | { left: WorkspaceColumnSpec; center: WorkspaceColumnSpec; right: WorkspaceColumnSpec }
);
export function workspaceScope(spec: WorkspaceFrameSpec): string { return spec.instanceId ?? spec.id; }

export function columnKey(column: WorkspaceColumnSpec): string {
  return column.key ?? column.role ?? column.slot ?? column.hostId;
}

export function columnInstanceId(scope: string, column: WorkspaceColumnSpec): string {
  return `${scope}/${encodeURIComponent(columnKey(column))}`;
}

export function columnWidth(column: WorkspaceColumnSpec): string {
  const width = column.width?.trim() ?? 'minmax(0, 1fr)';
  let depth = 0;
  if (!width || /[;{}"'\[\]]|^(?:repeat|subgrid|masonry)\b/i.test(width)) throw new Error(`Expected one CSS column track: ${width}`);
  for (const char of width) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (/\s/.test(char) && depth === 0) throw new Error(`Expected one CSS column track: ${width}`);
    if (depth < 0) throw new Error(`Invalid CSS column track: ${width}`);
  }
  if (depth) throw new Error(`Invalid CSS column track: ${width}`);
  return width;
}

/** Compatibility stays at this boundary; new workspaces always declare an ordered list. */
export function workspaceColumns(spec: WorkspaceFrameSpec): readonly WorkspaceColumnSpec[] {
  const columns = 'columns' in spec ? spec.columns
    : spec.layout?.composition === 'left-center' ? [spec.left, spec.right]
      : spec.layout?.composition === 'center-right' ? [spec.left, spec.center]
        : spec.layout?.composition === 'all' ? [spec.left] : [spec.left, spec.center, spec.right];
  const keys = new Set<string>();
  for (const column of columns) {
    const key = columnKey(column);
    if (keys.has(key)) throw new Error(`Duplicate workspace column key: ${spec.id}/${key}`);
    keys.add(key);
  }
  return columns;
}

/** Layout-only entry point for tools whose columns own their surface and theme. */
export interface WorkspaceLayoutMarkupSpec {
  instanceId?: string;
  id: string;
  columns: readonly string[];
  className?: string;
  layout?: WorkspaceLayoutSpec;
  overlay?: string;
  widths?: readonly string[];
}

export function renderWorkspaceLayout(spec: WorkspaceLayoutMarkupSpec): string {
  const esc = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const preset = spec.layout?.preset ?? 'default';
  const responsive = spec.layout?.responsive ?? 'default';
  const composition = spec.layout?.composition ?? 'columns';
  const className = ['workspace-frame', `workspace-frame--${spec.id}`, legacyWorkspaceClass(spec.id), spec.className].filter(Boolean).join(' ');
  const tracks = spec.widths ? ` data-ordered-columns style="grid-template-columns:${esc(spec.widths.join(' '))}"` : '';
  const empty = spec.widths?.length === 0 ? '<div data-workspace-empty role="status">暂无内容</div>' : '';
  return `<section class="${esc(className)}" data-workspace-frame="${esc(spec.id)}" data-workspace-instance="${esc(spec.instanceId ?? spec.id)}" data-layout="${preset}" data-responsive="${responsive}" data-composition="${composition}"${tracks}>${spec.columns.join('')}${empty}${spec.overlay ?? ''}</section>`;
}

function legacyWorkspaceClass(id: string): string {
  if (id === 'game') return 'workspace';
  if (id === 'shop') return 'shop-workspace';
  if (id === 'character') return 'character-workspace';
  if (id === 'contacts') return 'contacts-workspace';
  if (id === 'story') return 'story-workspace';
  if (id === 'area') return 'area-workspace';
  if (id === 'settings') return 'settings-workspace';
  if (id === 'inventory') return 'inventory-workspace';
  return id.startsWith('service-') ? 'service-workspace' : '';
}

function scrollOwner(mode: WorkspaceScrollMode): WorkspaceScrollOwner {
  if (mode === 'auto') return 'workspace-body';
  if (mode === 'content') return 'content-region';
  return 'delegated';
}

export function renderWorkspaceColumn(ctx: UIContext, column: WorkspaceColumnSpec, scope = 'embedded'): string {
  const visible = column.visible !== false;
  const surface = column.surface ?? 'none';
  const className = ['workspace-column', column.slot ? `workspace-column--${column.slot}` : '', surface === 'panel' ? 'panel' : '', column.className, visible ? '' : 'is-collapsed'].filter(Boolean).join(' ');
  const header = column.header ? `<header class="workspace-column__header">${column.header}</header>` : '';
  const scroll = column.scroll ?? 'auto';
  const body = `<div class="workspace-column__body" data-scroll="${scroll}" data-scroll-owner="${scrollOwner(scroll)}">${column.content}</div>`;
  const viewport = column.bodyOverlay === undefined ? body : `<div class="workspace-column__viewport">${body}${column.bodyOverlay}</div>`;
  const footer = column.footer ? `<footer class="workspace-column__footer">${column.footer}</footer>` : '';
  const role = column.role ? ` data-workspace-role="${ctx.escapeHtml(column.role)}"` : '';
  const owner = column.workspaceOwner ? ` data-workspace-owner="${ctx.escapeHtml(column.workspaceOwner)}"` : '';
  const content = `<div class="workspace-column__slot" data-workspace-column="${ctx.escapeHtml(column.slot ?? columnKey(column))}" data-workspace-surface="${surface}"${role}${owner}>${header}${viewport}${footer}</div>`;
  return renderUIHost(ctx, { hostId: column.hostId, themeScope: column.themeScope, className, content, useHostGeometry: surface === 'panel', attributes: {
    'data-column-key': columnKey(column), 'data-column-instance': columnInstanceId(scope, column),
    'data-column-definition': column.definitionId ?? column.role ?? columnKey(column),
    'data-column-binding': column.bindingKey ?? '',
    'data-column-origin': column.workspaceOwner ?? column.definitionId ?? '',
  } });
}

export function renderWorkspaceFrame(ctx: UIContext, spec: WorkspaceFrameSpec): string {
  const all = workspaceColumns(spec);
  const columns = 'columns' in spec ? all.filter(column => column.visible !== false) : all;
  ctx.workspaceColumns?.(spec);
  return renderWorkspaceLayout({ id: spec.id, instanceId: workspaceScope(spec), layout: spec.layout, columns: columns.map(column => renderWorkspaceColumn(ctx, column, workspaceScope(spec))), overlay: spec.overlay,
    widths: columns.map(column => 'columns' in spec ? columnWidth(column) : column.width ?? `var(--workspace-${column.slot}-width)`),
  });
}
