import type { UIContext } from '../context';
import { renderPanelHeaderRegion } from './tabs';

export type WorkspaceTitlebarLeaveAction =
  | 'data-contacts-workspace-leave'
  | 'data-story-workspace-leave';

export type WorkspaceTitlebarPanel = 'left' | 'center' | 'right';

const BACK_CHEVRON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16">'
  + '<path d="M15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />'
  + '</svg>';

/** Contacts / Story 各列标题复用默认页对应列的顶部宿主和等高标题区。 */
export function renderWorkspaceTitlebar(
  ctx: UIContext,
  panel: WorkspaceTitlebarPanel,
  title: string,
  leaveAction?: WorkspaceTitlebarLeaveAction,
): string {
  const leaveButton = leaveAction
    ? `<button type="button" class="conversation-back" ${leaveAction} aria-label="返回上一页" title="返回上一页">${BACK_CHEVRON}</button>`
    : '';
  const content = `
    <div class="conversation-heading">
      ${leaveButton}
      <div class="conversation-title"><b>${ctx.escapeHtml(title)}</b></div>
    </div>`;
  return renderPanelHeaderRegion(ctx, panel, content);
}
