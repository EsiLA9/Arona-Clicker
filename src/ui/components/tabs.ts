import { UIContext } from '../context';
import { renderPresentationHostBackground } from '../presentation-service';

export interface TabDef {
  id: string;
  label: string;
  hint?: string;
}

/** 渲染一组 Tab 按钮。active 为当前激活 id，data-panel 为该组归属。 */
export function renderTabs(
  ctx: UIContext,
  panel: string,
  tabs: TabDef[],
  active: string,
): string {
  const buttons = tabs.map(tab => `
    <button
      class="ui-control ui-control--tab switch-tab presentation-host-target ${tab.id === active ? 'active ui-control--active' : ''}"
      data-theme-host-id="${panel}Panel.tab"
      data-theme-state="${tab.id === active ? 'active' : 'inactive'}"
      data-theme-text-mode="${ctx.textColorModeForHost?.(`${panel}Panel.tab`, tab.id === active ? 'active' : 'inactive') ?? 'auto'}"
      data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost(`${panel}Panel.tab`)}"
      data-tab="${panel}:${tab.id}"
      aria-pressed="${tab.id === active}"
    >${renderPresentationHostBackground(ctx, `${panel}Panel.tab`, 'presentation-host-background', tab.id === active ? 'active' : 'inactive')}<span class="presentation-host-content">${ctx.escapeHtml(tab.label)}</span></button>`).join('');
  return `<div class="ui-cluster ui-cluster--${panel}-tabs switch-tabs"><div class="switch-tabs-content" role="tablist">${buttons}</div></div>`;
}

/** 渲染属于 panel 顶部结构区块的 Tabs 区域。 */
export function renderPanelTabsRegion(
  ctx: UIContext,
  panel: string,
  tabs: TabDef[],
  active: string,
): string {
  const tabsHost = `${panel}Panel.tabs`;
  return `<div class="ui-cluster ui-cluster--${panel}-tabs-region panel-tabs-region presentation-host-target" data-theme-host-id="${tabsHost}" data-theme-state="default" data-theme-text-mode="${ctx.textColorModeForHost?.(tabsHost) ?? 'auto'}">${renderPresentationHostBackground(ctx, tabsHost)}${renderTabs(ctx, panel, tabs, active)}</div>`;
}
