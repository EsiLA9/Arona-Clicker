import { UIContext } from '../context';

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
      class="switch-tab ${tab.id === active ? 'active' : ''}"
      data-tab="${panel}:${tab.id}"
      aria-pressed="${tab.id === active}"
    >${ctx.escapeHtml(tab.label)}</button>`).join('');
  return `<div class="switch-tabs" role="tablist">${buttons}</div>`;
}
