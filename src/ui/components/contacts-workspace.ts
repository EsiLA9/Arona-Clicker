import type { UIContext } from '../context';
import type { ContactsWorkspaceState, PanelState } from './app-shell';
import { renderContactsTab, renderCharacterPanel, renderConversationBody } from './contacts';
import { renderWorkspaceFrame } from './workspace-frame';
import { renderWorkspaceTitlebar } from './workspace-titlebar';

function placeholder(detail: string): string {
  return '<div class="workspace-placeholder"><p>'
    + detail
    + '</p></div>';
}

export function renderContactsWorkspace(
  ctx: UIContext,
  workspace: ContactsWorkspaceState,
  state: PanelState,
): string {
  const selected = workspace.selectedVariantId;
  const conversation = workspace.conversationVariantId;
  const variant = selected ? ctx.game.rosterSystem.getVariant(selected) : undefined;
  const left = renderWorkspaceTitlebar(ctx, 'left', '通讯录', 'data-contacts-workspace-leave')
    + '<div class="contacts-workspace__list">'
    + renderContactsTab(ctx, selected, state.studentChats, state.getUnread)
    + '</div>';
  const centerContent = conversation
    ? renderConversationBody(
        ctx,
        conversation,
        state.studentChats[conversation] ?? [],
        state.studentChatTexts[conversation] ?? [],
        ctx.game.story.getSendState(conversation),
        state.sendGate ?? null,
        state.storyGate ?? null,
        state.openingBanner ?? null,
      )
    : placeholder(
        variant
          ? '已选择 ' + variant.displayName + '。故事内容将在通讯录 Workspace 中继续展开。'
          : '选择一名学生后，这里将显示她的故事内容。',
      );
  const center = renderWorkspaceTitlebar(ctx, 'center', '学生故事') + centerContent;
  const right = renderWorkspaceTitlebar(ctx, 'right', '角色信息')
    + '<div class="contacts-workspace__inspector">'
    + renderCharacterPanel(ctx, selected)
    + '</div>';

  return renderWorkspaceFrame(ctx, {
    id: 'contacts',
    layout: { responsive: 'single-column' },
    left: {
      slot: 'left',
      role: 'navigation',
      workspaceOwner: 'contacts',
      hostId: 'leftPanel.service.contacts.navigation',
      themeScope: 'left.contacts.navigation',
      surface: 'panel',
      className: 'contacts-workspace__left',
      content: left,
      scroll: 'content',
    },
    center: {
      slot: 'center',
      role: 'primary',
      workspaceOwner: 'contacts',
      hostId: 'centerPanel.service.contacts.main',
      themeScope: 'center.contacts.main',
      surface: 'panel',
      className: 'contacts-workspace__center',
      content: center,
      scroll: 'none',
    },
    right: {
      slot: 'right',
      role: 'inspector',
      workspaceOwner: 'contacts',
      hostId: 'rightPanel.service.contacts.inspector',
      themeScope: 'right.contacts.inspector',
      surface: 'panel',
      className: 'contacts-workspace__right',
      content: right,
      scroll: 'content',
    },
  });
}
