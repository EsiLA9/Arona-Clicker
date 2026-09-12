import type { UIContext } from '../context';
import type { PanelState, StoryWorkspaceState } from './app-shell';
import { renderConversationBody } from './contacts';
import { renderChatTab } from './center-panel';
import { renderStoryNavigation } from './rail';
import { renderWorkspaceFrame } from './workspace-frame';

function leaveHeader(title: string): string {
  return '<div class="workspace-page-header">'
    + '<button type="button" class="workspace-page-header__back" data-story-workspace-leave aria-label="返回游戏">← 返回游戏</button>'
    + '<div><span class="eyebrow">STORY WORKSPACE</span><strong>'
    + title
    + '</strong></div></div>';
}

function placeholder(title: string, detail: string): string {
  return '<div class="workspace-placeholder"><span class="eyebrow">PLANNED REGION</span><h2>'
    + title
    + '</h2><p>'
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
  const left = leaveHeader('故事')
    + '<div class="story-workspace__navigation">'
    + renderStoryNavigation(ctx, workspace.navPath)
    + '</div>';
  const center = workspace.subroute === 'archive'
    ? '<div class="story-workspace__archive">'
      + '<div class="workspace-placeholder"><span class="eyebrow">STORY ARCHIVE</span><h2>故事档案</h2><p>档案内容将在 Records Service 或 Story 子路由中继续设计。</p>'
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
      : renderChatTab(
          ctx,
          state.chatEntries,
          state.chatTexts,
          ctx.game.story.getSendState(),
          state.sendGate ?? null,
          state.storyGate ?? null,
          state.openingBanner ?? null,
        )
    : placeholder('故事内容', '选择左侧分类或故事条目后，这里将显示故事内容。');
  const right = placeholder(
    '故事详情',
    workspace.selectedEntryId
      ? '当前故事的详情与辅助信息将在此 Workspace 内继续设计。'
      : '故事详情、档案和统计的归属正在规划中。',
  );

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
