import type { UIContext } from '../context';
import type { PanelState, CharacterWorkspaceState } from './app-shell';
import { renderWorkspaceFrame } from './workspace-frame';
import { renderPanelHeaderRegion } from './tabs';
import { renderContactsTab, renderCharacterPanel, renderConversationBody } from './contacts';

function tabs(ctx: UIContext, panel: 'left' | 'center' | 'right', title: string, back = false): string {
  const content = back
    ? '<button class="ui-control ui-control--tab switch-tab active" data-character-workspace-leave>← 返回游戏</button>'
    : `<span class="character-workspace__title">${ctx.escapeHtml(title)}</span>`;
  return renderPanelHeaderRegion(ctx, panel, `<div class="switch-tabs"><div class="switch-tabs-content">${content}</div></div>`);
}

/** 角色服务工作区：通讯录与学生故事共同接管中栏、右栏。 */
export function renderCharacterWorkspace(ctx: UIContext, workspace: CharacterWorkspaceState, state: PanelState): string {
  const conversationId = workspace.conversationVariantId;
  const left = tabs(ctx, 'left', '通讯录', true)
    + `<div class="character-workspace__left-body">${renderContactsTab(ctx, workspace.variantId, state.studentChats, state.getUnread)}</div>`;
  const center = tabs(ctx, 'center', conversationId ? '学生故事' : '学生详情')
    + (conversationId
      ? renderConversationBody(ctx, conversationId, state.studentChats[conversationId] ?? [], state.studentChatTexts[conversationId] ?? [], ctx.game.story.getSendState(conversationId), state.sendGate ?? null, state.storyGate ?? null, state.openingBanner ?? null)
      : '<div class="character-workspace__empty panel-body"><p>选择一名学生开始查看她的故事。</p></div>');
  const right = tabs(ctx, 'right', '角色成长')
    + `<div class="character-workspace__right-body panel-body">${renderCharacterPanel(ctx, workspace.variantId)}</div>`;

  return renderWorkspaceFrame(ctx, {
    id: 'character',
    layout: { responsive: 'single-column' },
      left: { slot: 'left', role: 'contacts', hostId: 'leftPanel.character.contacts', themeScope: 'left.character.contacts', surface: 'panel', className: 'character-workspace__left', content: left, scroll: 'content' },
      center: { slot: 'center', role: 'story', hostId: 'centerPanel.character.story', themeScope: 'center.character.story', surface: 'panel', className: 'character-workspace__center', content: center, scroll: 'none' },
      right: { slot: 'right', role: 'progression', hostId: 'rightPanel.character.progression', themeScope: 'right.character.progression', surface: 'panel', className: 'character-workspace__right', content: right, scroll: 'content' },
  });
}
