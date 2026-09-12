import type { UIContext } from '../context';
import type { ContactsWorkspaceState, PanelState } from './app-shell';
import { renderContactsTab, renderCharacterPanel, renderConversationBody } from './contacts';
import { renderWorkspaceFrame } from './workspace-frame';

function leaveHeader(ctx: UIContext, title: string, action: string): string {
  return '<div class="workspace-page-header">'
    + '<button type="button" class="workspace-page-header__back" '
    + action
    + ' aria-label="返回游戏">← 返回游戏</button>'
    + '<div><span class="eyebrow">CONTACTS WORKSPACE</span><strong>'
    + ctx.escapeHtml(title)
    + '</strong></div></div>';
}

function placeholder(title: string, detail: string): string {
  return '<div class="workspace-placeholder"><span class="eyebrow">PLANNED REGION</span><h2>'
    + title
    + '</h2><p>'
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
  const left = leaveHeader(ctx, '通讯录', 'data-contacts-workspace-leave')
    + '<div class="contacts-workspace__list">'
    + renderContactsTab(ctx, selected, state.studentChats, state.getUnread)
    + '</div>';
  const center = conversation
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
        '学生故事',
        variant
          ? '已选择 ' + variant.displayName + '。故事内容将在通讯录 Workspace 中继续展开。'
          : '选择一名学生后，这里将显示她的故事内容。',
      );
  const right = '<div class="contacts-workspace__inspector">'
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
