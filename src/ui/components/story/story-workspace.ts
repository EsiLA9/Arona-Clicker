import { createChatColumn } from '../../columns';
import type { UIContext } from '../../runtime/context';
import type { PanelState, StoryWorkspaceState } from '../shared/app-shell';
import { renderStoryNavigation } from '../../columns';
import { renderWorkspaceFrame, type WorkspaceFrameSpec } from '../shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../shared/workspace-titlebar';

function placeholder(detail: string): string {
  return '<div class="workspace-placeholder"><p>'
    + detail
    + '</p></div>';
}

export function createStoryWorkspaceFrame(
  ctx: UIContext,
  workspace: StoryWorkspaceState,
  state: PanelState,
): WorkspaceFrameSpec {
  const owner = workspace.conversationOwner;
  const hasConversation = workspace.subroute === 'overview'
    && (workspace.selectedEntryId !== null || workspace.mode === 'playing');
  const left = '<div class="story-workspace__navigation" data-scroll-owner="content-region">'
    + renderStoryNavigation(ctx, workspace.navPath)
    + '</div>';
  const centerContent = workspace.subroute === 'archive'
    ? '<div class="story-workspace__archive">'
      + '<div class="workspace-placeholder"><h2>故事档案</h2><p>档案内容将在 Records Service 或 Story 子路由中继续设计。</p>'
      + '<button type="button" class="toolbar-button" data-story-archive-back>返回故事</button></div></div>'
    : placeholder('选择左侧分类或故事条目后，这里将显示故事内容。');
  const right = placeholder(
        workspace.selectedEntryId
          ? '当前故事的详情与辅助信息将在此 Workspace 内继续设计。'
          : '故事详情、档案和统计的归属正在规划中。',
      );

  return { id: 'story',
    layout: { responsive: 'single-column' },
    columns: [{ key: 'navigation', width: 'var(--workspace-left-width)',
        slot: 'left',
        role: 'navigation',
        workspaceOwner: 'story',
        hostId: 'leftPanel.service.story.navigation',
        themeScope: 'left.story.navigation',
        surface: 'panel',
        className: 'story-workspace__left',
        header: renderWorkspaceTitlebar(ctx, 'left', '故事导航', 'data-story-workspace-leave'),
        content: left,
        scroll: 'content',
      },
      hasConversation && workspace.subroute !== 'archive' ? createChatColumn(ctx, { owner: owner, entries: owner ? state.studentChats[owner] ?? [] : state.chatEntries, chatTexts: owner ? state.studentChatTexts[owner] ?? [] : state.chatTexts, sendState: ctx.game.story.getSendState(owner ?? undefined), sendGate: state.sendGate, storyGate: state.storyGate, openingBanner: state.openingBanner, heading: renderWorkspaceTitlebar(ctx, 'center', '故事内容'), appearance: { key: 'primary', width: 'var(--workspace-center-width)', slot: 'center', role: 'primary', workspaceOwner: 'story', hostId: 'centerPanel.service.story.main', themeScope: 'center.story.main', surface: 'panel', className: 'story-workspace__center', scroll: 'none' } }) : { key: 'primary', width: 'var(--workspace-center-width)',
        slot: 'center',
        role: 'primary',
        workspaceOwner: 'story',
        hostId: 'centerPanel.service.story.main',
        themeScope: 'center.story.main',
        surface: 'panel',
        className: 'story-workspace__center',
        header: renderWorkspaceTitlebar(ctx, 'center', '故事内容'),
        content: centerContent,
        scroll: 'none',
      },
      { key: 'inspector', width: 'var(--workspace-right-width)',
        slot: 'right',
        role: 'inspector',
        workspaceOwner: 'story',
        hostId: 'rightPanel.service.story.inspector',
        themeScope: 'right.story.inspector',
        surface: 'panel',
        className: 'story-workspace__right',
        header: renderWorkspaceTitlebar(ctx, 'right', '故事详情'),
        content: right,
        scroll: 'content',
      }]
  };
}

export function renderStoryWorkspace(
  ctx: UIContext,
  workspace: StoryWorkspaceState,
  state: PanelState,
): string {
  return renderWorkspaceFrame(ctx, createStoryWorkspaceFrame(ctx, workspace, state));
}
