import type { UIContext } from '../context';
import { renderUIHost } from '../presentation-service';

export type WorkspaceSlot = 'left' | 'center' | 'right';
export interface WorkspaceColumnSpec {
  slot: WorkspaceSlot;
  /** 稳定的业务语义，供主题编辑器和后续工作区扩展识别；不参与布局。 */
  role?: string;
  hostId: string;
  themeScope?: string;
  className?: string;
  visible?: boolean;
  scroll?: 'auto' | 'content' | 'none';
  header?: string;
  content: string;
}
export interface WorkspaceLayoutSpec { preset?: 'default' | 'center-heavy'; }
export interface WorkspaceFrameSpec {
  id: string;
  left: WorkspaceColumnSpec;
  center: WorkspaceColumnSpec;
  right: WorkspaceColumnSpec;
  layout?: WorkspaceLayoutSpec;
}

export function renderWorkspaceColumn(ctx: UIContext, column: WorkspaceColumnSpec): string {
  const visible = column.visible !== false;
  const className = ['workspace-column', `workspace-column--${column.slot}`, column.className, visible ? '' : 'is-collapsed'].filter(Boolean).join(' ');
  const header = column.header ? `<header class="workspace-column__header">${column.header}</header>` : '';
  const body = `<div class="workspace-column__body" data-scroll="${column.scroll ?? 'auto'}">${header}${column.content}</div>`;
  const role = column.role ? ` data-workspace-role="${ctx.escapeHtml(column.role)}"` : '';
  const content = `<div class="workspace-column__slot" data-workspace-column="${column.slot}"${role}>${body}</div>`;
  return renderUIHost(ctx, { hostId: column.hostId, themeScope: column.themeScope, className, content });
}

export function renderWorkspaceFrame(ctx: UIContext, spec: WorkspaceFrameSpec): string {
  const preset = spec.layout?.preset ?? 'default';
  const legacyClass = spec.id === 'game'
    ? 'workspace'
    : spec.id === 'shop'
      ? 'shop-workspace'
        : spec.id === 'character'
          ? 'character-workspace'
        : spec.id === 'settings'
          ? 'settings-workspace'
          : spec.id.startsWith('service-')
            ? 'service-workspace'
            : '';
  return `<section class="workspace-frame workspace-frame--${spec.id} ${legacyClass}" data-workspace-frame="${spec.id}" data-layout="${preset}">${renderWorkspaceColumn(ctx, spec.left)}${renderWorkspaceColumn(ctx, spec.center)}${renderWorkspaceColumn(ctx, spec.right)}</section>`;
}
