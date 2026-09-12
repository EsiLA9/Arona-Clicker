import type { UIContext } from '../context';
import { renderUIHost } from '../presentation-service';

export type WorkspaceSlot = 'left' | 'center' | 'right';
export type WorkspaceLayoutPreset = 'default' | 'center-heavy';
export type WorkspaceResponsiveProfile = 'default' | 'two-column' | 'single-column';
export type WorkspaceScrollMode = 'auto' | 'content' | 'none';
export type WorkspaceScrollOwner = 'workspace-body' | 'content-region' | 'delegated';
export type WorkspaceSurface = 'panel' | 'none';
export interface WorkspaceColumnSpec {
  slot: WorkspaceSlot;
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
  content: string;
}
export interface WorkspaceLayoutSpec {
  preset?: WorkspaceLayoutPreset;
  responsive?: WorkspaceResponsiveProfile;
}
export interface WorkspaceFrameSpec {
  id: string;
  left: WorkspaceColumnSpec;
  center: WorkspaceColumnSpec;
  right: WorkspaceColumnSpec;
  layout?: WorkspaceLayoutSpec;
}

function legacyWorkspaceClass(id: string): string {
  if (id === 'game') return 'workspace';
  if (id === 'shop') return 'shop-workspace';
  if (id === 'character') return 'character-workspace';
  if (id === 'contacts') return 'contacts-workspace';
  if (id === 'story') return 'story-workspace';
  if (id === 'settings') return 'settings-workspace';
  if (id === 'inventory') return 'inventory-workspace';
  return id.startsWith('service-') ? 'service-workspace' : '';
}

function scrollOwner(mode: WorkspaceScrollMode): WorkspaceScrollOwner {
  if (mode === 'auto') return 'workspace-body';
  if (mode === 'content') return 'content-region';
  return 'delegated';
}

export function renderWorkspaceColumn(ctx: UIContext, column: WorkspaceColumnSpec): string {
  const visible = column.visible !== false;
  const surface = column.surface ?? 'none';
  const className = ['workspace-column', `workspace-column--${column.slot}`, surface === 'panel' ? 'panel' : '', column.className, visible ? '' : 'is-collapsed'].filter(Boolean).join(' ');
  const header = column.header ? `<header class="workspace-column__header">${column.header}</header>` : '';
  const scroll = column.scroll ?? 'auto';
  const body = `<div class="workspace-column__body" data-scroll="${scroll}" data-scroll-owner="${scrollOwner(scroll)}">${header}${column.content}</div>`;
  const role = column.role ? ` data-workspace-role="${ctx.escapeHtml(column.role)}"` : '';
  const owner = column.workspaceOwner ? ` data-workspace-owner="${ctx.escapeHtml(column.workspaceOwner)}"` : '';
  const content = `<div class="workspace-column__slot" data-workspace-column="${column.slot}" data-workspace-surface="${surface}"${role}${owner}>${body}</div>`;
  return renderUIHost(ctx, { hostId: column.hostId, themeScope: column.themeScope, className, content });
}

export function renderWorkspaceFrame(ctx: UIContext, spec: WorkspaceFrameSpec): string {
  const preset = spec.layout?.preset ?? 'default';
  const responsive = spec.layout?.responsive ?? 'default';
  const legacyClass = legacyWorkspaceClass(spec.id);
  return `<section class="workspace-frame workspace-frame--${spec.id} ${legacyClass}" data-workspace-frame="${spec.id}" data-layout="${preset}" data-responsive="${responsive}">${renderWorkspaceColumn(ctx, spec.left)}${renderWorkspaceColumn(ctx, spec.center)}${renderWorkspaceColumn(ctx, spec.right)}</section>`;
}
