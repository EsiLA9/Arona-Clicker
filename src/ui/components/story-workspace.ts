import type { UIContext } from '../context';
import type { PanelState, StoryWorkspaceState } from './app-shell';
import { renderConversationBody } from './contacts';
import { renderChatTab } from './center-panel';
import { renderStoryNavigation } from './rail';
import { renderWorkspaceFrame } from './workspace-frame';
import { renderWorkspaceTitlebar } from './workspace-titlebar';

function placeholder(detail: string): string {
  return '<div class="workspace-placeholder"><p>'
    + detail
    + '</p></div>';
}

export function renderStoryWorkspace(
  ctx: UIContext,
  workspace: StoryWorkspaceState,
  state: PanelState,
): string {
  const owner = workspace.conversationOwner;
  const hasConversation = workspace.subroute === 'overview'
    && (workspace.selectedEntryId !== null || workspace.mode === 'playing');
  const left = renderWorkspaceTitlebar(ctx, 'left', '故事导航', 'data-story-workspace-leave')
    + '<div class="story-workspace__navigation">'
    + renderStoryNavigation(ctx, workspace.navPath)
    + '</div>';
  const centerContent = workspace.subroute === 'archive'
    ? '<div class="story-workspace__archive">'
      + '<div class="workspace-placeholder"><h2>故事档案</h2><p>档案内容将在 Records Service 或 Story 子路由中继续设计。</p>'
      + '<button type="button" class="toolbar-button" data-story-archive-back>返回故事</button></div></div>'
    : hasConversation
    ? owner
      ? renderConversationBody(
          ctx,
          owner,
          state.studentChats[owner] ?? [],
          state.studentChatTexts[owner] ?? [],
          ctx.game.story.getSendState(owner),
          state.sendGate ?? null,
          state.storyGate ?? null,
          state.openingBanner ?? null,
        )
      : '<div class="ui-cluster ui-cluster--center-chat panel-body">'
        + renderChatTab(
            ctx,
            state.chatEntries,
            state.chatTexts,
            ctx.game.story.getSendState(),
            state.sendGate ?? null,
            state.storyGate ?? null,
            state.openingBanner ?? null,
          )
        + '</div>'
    : placeholder('选择左侧分类或故事条目后，这里将显示故事内容。');
  const right = renderWorkspaceTitlebar(ctx, 'right', '故事详情')
    + placeholder(
        workspace.selectedEntryId
          ? '当前故事的详情与辅助信息将在此 Workspace 内继续设计。'
          : '故事详情、档案和统计的归属正在规划中。',
      );
  const center = renderWorkspaceTitlebar(ctx, 'center', '故事内容') + centerContent;

  return renderWorkspaceFrame(ctx, {
    id: 'story',
    layout: { responsive: 'single-column' },
    left: {
      slot: 'left',
      role: 'navigation',
      workspaceOwner: 'story',
      hostId: 'leftPanel.service.story.navigation',
      themeScope: 'left.story.navigation',
      surface: 'panel',
      className: 'story-workspace__left',
      content: left,
      scroll: 'content',
    },
    center: {
      slot: 'center',
      role: 'primary',
      workspaceOwner: 'story',
      hostId: 'centerPanel.service.story.main',
      themeScope: 'center.story.main',
      surface: 'panel',
      className: 'story-workspace__center',
      content: center,
      scroll: 'none',
    },
    right: {
      slot: 'right',
      role: 'inspector',
      workspaceOwner: 'story',
      hostId: 'rightPanel.service.story.inspector',
      themeScope: 'right.story.inspector',
      surface: 'panel',
      className: 'story-workspace__right',
      content: right,
      scroll: 'content',
    },
  });
}
