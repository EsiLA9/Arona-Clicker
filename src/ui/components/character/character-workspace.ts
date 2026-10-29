import { createChatColumn, createContactsColumn, createCharacterColumn } from '../../columns';
import type { UIContext } from '../../runtime/context';
import type { PanelState, CharacterWorkspaceState } from '../shared/app-shell';
import { renderWorkspaceFrame, type WorkspaceFrameSpec } from '../shared/workspace-frame';
import { renderPanelHeaderRegion } from '../shared/tabs';

function tabs(ctx: UIContext, panel: 'left' | 'center' | 'right', title: string, back = false): string {
  const content = back
    ? '<button class="ui-control ui-control--tab switch-tab active" data-character-workspace-leave data-workspace-back>← 返回游戏</button>'
    : `<span class="character-workspace__title">${ctx.escapeHtml(title)}</span>`;
  return renderPanelHeaderRegion(ctx, panel, `<div class="switch-tabs"><div class="switch-tabs-content">${content}</div></div>`);
}

/** 角色服务工作区：通讯录与学生故事共同接管中栏、右栏。 */
export function createCharacterWorkspaceFrame(ctx: UIContext, workspace: CharacterWorkspaceState, state: PanelState): WorkspaceFrameSpec {
  const conversationId = workspace.conversationVariantId;
  const center = '<div class="character-workspace__empty panel-body"><p>选择一名学生开始查看她的故事。</p></div>';

  return { id: 'character',
    layout: { responsive: 'single-column' },
    columns: [createContactsColumn(ctx, { selectedVariantId: workspace.variantId, chats: state.studentChats, getUnread: state.getUnread, heading: tabs(ctx, 'left', '通讯录', true), bodyClassName: 'character-workspace__left-body', appearance: { key: 'contacts', width: 'var(--workspace-left-width)', slot: 'left', workspaceOwner: 'character', role: 'contacts', hostId: 'leftPanel.character.contacts', themeScope: 'left.character.contacts', surface: 'panel', className: 'character-workspace__left', scroll: 'content' } }),
      conversationId ? createChatColumn(ctx, { owner: conversationId, entries: conversationId ? state.studentChats[conversationId] ?? [] : state.chatEntries, chatTexts: conversationId ? state.studentChatTexts[conversationId] ?? [] : state.chatTexts, sendState: ctx.game.story.getSendState(conversationId ?? undefined), sendGate: state.sendGate, storyGate: state.storyGate, openingBanner: state.openingBanner, heading: tabs(ctx, 'center', conversationId ? '学生故事' : '学生详情'), appearance: { key: 'story', width: 'var(--workspace-center-width)', slot: 'center', workspaceOwner: 'character', role: 'story', hostId: 'centerPanel.character.story', themeScope: 'center.character.story', surface: 'panel', className: 'character-workspace__center', scroll: 'none' } }) : { key: 'story', width: 'var(--workspace-center-width)', slot: 'center', workspaceOwner: 'character', role: 'story', hostId: 'centerPanel.character.story', themeScope: 'center.character.story', surface: 'panel', className: 'character-workspace__center', header: tabs(ctx, 'center', '学生详情'), content: center, scroll: 'none' },
      createCharacterColumn(ctx, { variantId: workspace.variantId, heading: tabs(ctx, 'right', '角色成长'), bodyClassName: 'character-workspace__right-body panel-body', appearance: { key: 'progression', width: 'var(--workspace-right-width)', slot: 'right', workspaceOwner: 'character', role: 'progression', hostId: 'rightPanel.character.progression', themeScope: 'right.character.progression', surface: 'panel', className: 'character-workspace__right', scroll: 'content' } })]
  };
}

export function renderCharacterWorkspace(ctx: UIContext, workspace: CharacterWorkspaceState, state: PanelState): string {
  return renderWorkspaceFrame(ctx, createCharacterWorkspaceFrame(ctx, workspace, state));
}
