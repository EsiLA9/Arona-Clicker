import { UIContext } from '../../runtime/context';
import { renderPresentationHostBackground } from '../../presentation/presentation-service';

export interface TabDef {
  id: string;
  label: string;
  hint?: string;
  action?: string;
}

export interface PanelActionDef {
  id: string;
  label: string;
  active?: boolean;
  navigation?: string;
  disabled?: boolean;
}

/** 渲染一组 Tab 按钮。active 为当前激活 id，data-panel 为该组归属。 */
export function renderTabs(
  ctx: UIContext,
  panel: string,
  tabs: TabDef[],
  active: string,
  ariaLabel?: string,
): string {
  const buttons = tabs.map(tab => `
    <button
      class="ui-control ui-control--tab switch-tab presentation-host-target ${tab.id === active ? 'active ui-control--active' : ''}"
      data-theme-host-id="${panel}Panel.tab"
      data-theme-state="${tab.id === active ? 'active' : 'inactive'}"
      data-theme-text-mode="${ctx.textColorModeForHost?.(`${panel}Panel.tab`, tab.id === active ? 'active' : 'inactive') ?? 'auto'}"
      data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost(`${panel}Panel.tab`)}"
      data-column-action="${ctx.escapeHtml(tab.action ?? tab.id)}"
      role="tab"
      aria-selected="${tab.id === active}"
      aria-pressed="${tab.id === active}"
    >${renderPresentationHostBackground(ctx, `${panel}Panel.tab`, 'presentation-host-background', tab.id === active ? 'active' : 'inactive')}<span class="presentation-host-content">${ctx.escapeHtml(tab.label)}</span></button>`).join('');
  return `<div class="ui-cluster ui-cluster--${panel}-tabs switch-tabs"><div class="switch-tabs-content" role="tablist"${ariaLabel ? ` aria-label="${ctx.escapeHtml(ariaLabel)}"` : ''}>${buttons}</div></div>`;
}

/**
 * panel 顶部结构区块的宿主外壳：Tabs 与非 Tabs 内容共用同一宿主、渲染色与等高 token。
 * 所有顶栏都必须经此产出，避免手写 header 与统一顶栏不对齐、也不带渲染色。
 */
function renderPanelRegionShell(ctx: UIContext, panel: string, inner: string): string {
  const tabsHost = `${panel}Panel.tabs`;
  return `<div class="ui-cluster ui-cluster--${panel}-tabs-region panel-tabs-region presentation-host-target" data-theme-host-id="${tabsHost}" data-theme-state="default" data-theme-text-mode="${ctx.textColorModeForHost?.(tabsHost) ?? 'auto'}">${renderPresentationHostBackground(ctx, tabsHost)}${inner}</div>`;
}

/** 渲染属于 panel 顶部结构区块的 Tabs 区域。 */
export function renderPanelTabsRegion(
  ctx: UIContext,
  panel: string,
  tabs: TabDef[],
  active: string,
): string {
  return renderPanelRegionShell(ctx, panel, renderTabs(ctx, panel, tabs, active));
}

/** 渲染 panel 顶部结构区块的非 Tabs 内容（如对话空间返回栏），复用统一宿主与渲染色。 */
export function renderPanelHeaderRegion(ctx: UIContext, panel: string, content: string): string {
  return renderPanelRegionShell(ctx, panel, `<div class="presentation-host-content">${content}</div>`);
}

/** Render tab-styled actions without encoding a physical left/center/right target. */
export function renderPanelActionsRegion(ctx: UIContext, panel: string, actions: readonly PanelActionDef[]): string {
  const buttons = actions.map(action => `
    <button type="button"
      class="ui-control ui-control--tab switch-tab presentation-host-target ${action.active ? 'active ui-control--active' : ''}"
      data-theme-host-id="${panel}Panel.tab"
      data-theme-state="${action.active ? 'active' : 'inactive'}"
      data-theme-text-mode="${ctx.textColorModeForHost?.(`${panel}Panel.tab`, action.active ? 'active' : 'inactive') ?? 'auto'}"
      data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost(`${panel}Panel.tab`)}"
      ${action.navigation ? `data-workspace-navigation="${ctx.escapeHtml(action.navigation)}"` : `data-column-action="${ctx.escapeHtml(action.id)}"`}
      ${action.disabled ? 'disabled' : ''}
      ${action.active ? 'aria-current="page" aria-pressed="true"' : 'aria-pressed="false"'}
    >${renderPresentationHostBackground(ctx, `${panel}Panel.tab`, 'presentation-host-background', action.active ? 'active' : 'inactive')}<span class="presentation-host-content">${ctx.escapeHtml(action.label)}</span></button>`).join('');
  return renderPanelRegionShell(ctx, panel, `<div class="ui-cluster ui-cluster--${panel}-tabs switch-tabs"><div class="switch-tabs-content" role="group">${buttons}</div></div>`);
}
