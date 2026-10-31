import { createChatColumn, createContactsColumn, createCharacterColumn } from '../../columns';
import type { UIContext } from '../../runtime/context';
import type { ContactsWorkspaceState, PanelState } from '../shared/app-shell';
import { renderWorkspaceFrame, type WorkspaceFrameSpec } from '../shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../shared/workspace-titlebar';

function placeholder(detail: string): string {
  return '<div class="workspace-placeholder"><p>'
    + detail
    + '</p></div>';
}

export function createContactsWorkspaceFrame(
  ctx: UIContext,
  workspace: ContactsWorkspaceState,
  state: PanelState,
): WorkspaceFrameSpec {
  const selected = workspace.selectedVariantId;
  const conversation = workspace.conversationVariantId;
  const variant = selected ? ctx.game.rosterSystem.getVariant(selected) : undefined;
  const centerContent = placeholder(
        variant
          ? '已选择 ' + variant.displayName + '。故事内容将在通讯录 Workspace 中继续展开。'
          : '选择一名学生后，这里将显示她的故事内容。',
      );
  return { id: 'contacts',
    layout: { responsive: 'single-column' },
    columns: [createContactsColumn(ctx, { selectedVariantId: selected, chats: state.studentChats, getUnread: state.getUnread, heading: renderWorkspaceTitlebar(ctx, 'left', '通讯录', 'data-contacts-workspace-leave'), bodyClassName: 'contacts-workspace__list', appearance: { key: 'navigation', width: 'var(--workspace-left-width)', slot: 'left', role: 'navigation', workspaceOwner: 'contacts', hostId: 'leftPanel.service.contacts.navigation', themeScope: 'left.contacts.navigation', surface: 'panel', className: 'contacts-workspace__left', scroll: 'content' } }),
      (conversation || state.storyReplay?.owner === null) ? createChatColumn(ctx, { owner: conversation, entries: state.storyReplay?.owner === conversation && state.storyReplay.replayId ? state.storyReplay.entries : conversation ? state.studentChats[conversation] ?? [] : state.chatEntries, chatTexts: state.storyReplay?.owner === conversation && state.storyReplay.replayId ? state.storyReplay.chatTexts : conversation ? state.studentChatTexts[conversation] ?? [] : state.chatTexts, sendState: state.storyReplay?.owner === conversation && state.storyReplay.replayId ? ctx.game.story.getReplaySendState(state.storyReplay.replayId) : ctx.game.story.getSendState(conversation ?? undefined), sendGate: state.sendGate, storyGate: state.storyGate, openingBanner: state.openingBanner, replayId: state.storyReplay?.owner === conversation ? state.storyReplay.replayId : undefined, heading: renderWorkspaceTitlebar(ctx, 'center', '学生故事'), appearance: { key: 'primary', width: 'var(--workspace-center-width)', slot: 'center', role: 'primary', workspaceOwner: 'contacts', hostId: 'centerPanel.service.contacts.main', themeScope: 'center.contacts.main', surface: 'panel', className: 'contacts-workspace__center', scroll: 'none' } }) : { key: 'primary', width: 'var(--workspace-center-width)',
        slot: 'center',
        role: 'primary',
        workspaceOwner: 'contacts',
        hostId: 'centerPanel.service.contacts.main',
        themeScope: 'center.contacts.main',
        surface: 'panel',
        className: 'contacts-workspace__center',
        header: renderWorkspaceTitlebar(ctx, 'center', '学生故事'),
        content: centerContent,
        scroll: 'none',
      },
      createCharacterColumn(ctx, { variantId: selected, heading: renderWorkspaceTitlebar(ctx, 'right', '角色信息'), bodyClassName: 'contacts-workspace__inspector', appearance: { key: 'inspector', width: 'var(--workspace-right-width)', slot: 'right', role: 'inspector', workspaceOwner: 'contacts', hostId: 'rightPanel.service.contacts.inspector', themeScope: 'right.contacts.inspector', surface: 'panel', className: 'contacts-workspace__right', scroll: 'content' } })]
  };
}

export function renderContactsWorkspace(
  ctx: UIContext,
  workspace: ContactsWorkspaceState,
  state: PanelState,
): string {
  return renderWorkspaceFrame(ctx, createContactsWorkspaceFrame(ctx, workspace, state));
}
