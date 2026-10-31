import type { UIContext } from '../runtime/context';
import type { ChatEntry, ChatTextEntry } from '../components/story/story';
import type { SendState } from '../../arona-clicker/contracts/runtime/results';
import type { ActiveBanner, SendGatePhase, StoryGateState } from '../components/shared/app-shell';
import type { WorkspaceColumnSpec } from '../components/shared/workspace-frame';
import { renderChatContent } from './chat-content';
import { renderContactsTab, renderCharacterPanel, renderConversationBody, type UnreadResolver } from '../components/character/contacts';
import { renderWorkspaceTitlebar } from '../components/shared/workspace-titlebar';
import type { ColumnActions } from '../workspace/column-actions';
import type { SemanticColumnSpec } from './semantic-column';

interface ColumnAppearance {
  heading?: string;
  bodyClassName?: string;
  key?: string;
  title?: string;
  onBack?: (() => void) | null;
  actions?: ColumnActions;
  appearance?: Partial<Omit<WorkspaceColumnSpec, 'content' | 'bind'>>;
}
function actions(binding: ColumnAppearance): Pick<WorkspaceColumnSpec, 'actions'> {
  return { actions: binding.actions };
}
function heading(ctx: UIContext, binding: ColumnAppearance, panel: 'left' | 'center' | 'right'): string {
  return binding.heading ?? (binding.title ? renderWorkspaceTitlebar(ctx, panel, binding.title, 'data-column-back') : '');
}

export interface ChatColumnBinding extends ColumnAppearance {
  owner: string | null;
  entries: ChatEntry[];
  chatTexts?: ChatTextEntry[];
  sendState: SendState;
  sendGate?: SendGatePhase | null;
  storyGate?: StoryGateState | null;
  openingBanner?: ActiveBanner | null;
  readOnly?: boolean;
  replayId?: string;
}
/** Display a chosen business stream; mounting is never a Story start/advance operation. */
export function createChatColumn(ctx: UIContext, binding: ChatColumnBinding): WorkspaceColumnSpec {
  const body = binding.owner
    ? renderConversationBody(ctx, binding.owner, binding.entries, binding.chatTexts ?? [], binding.sendState, binding.sendGate ?? null, binding.storyGate ?? null, binding.openingBanner ?? null, binding.readOnly ?? false, binding.replayId)
    : '<div class="ui-cluster ui-cluster--center-chat panel-body">' + renderChatContent(ctx, binding.entries, binding.chatTexts ?? [], binding.sendState, binding.sendGate ?? null, binding.storyGate ?? null, binding.openingBanner ?? null, binding.readOnly ?? false, binding.replayId) + '</div>';
  return { key: binding.key ?? 'chat', definitionId: 'chat', bindingKey: binding.owner ?? '#global',
    slot: 'center', hostId: 'centerPanel.chat', themeScope: 'center.chat', surface: 'panel', scroll: 'none',
    ...binding.appearance, header: heading(ctx, binding, 'center'), onBack: binding.onBack, ...actions(binding), content: body };
}

export interface ContactsColumnBinding extends ColumnAppearance {
  selectedVariantId: string | null;
  chats: Record<string, ChatEntry[]>;
  getUnread?: UnreadResolver;
  onSelect?: (variantId: string) => void;
}
export function createContactsColumn(ctx: UIContext, binding: ContactsColumnBinding): WorkspaceColumnSpec {
  const callbacks: ColumnActions = { ...binding.actions,
    ...(binding.onSelect ? { '[data-select-variant]': (node: HTMLElement) => binding.onSelect!(node.dataset.selectVariant!) } : {}),
  };
  return { key: binding.key ?? 'contacts', definitionId: 'contacts', slot: 'left', hostId: 'leftPanel.contacts', themeScope: 'left.contacts', surface: 'panel', scroll: 'content',
    ...binding.appearance, onBack: binding.onBack,
    actions: callbacks,
    header: heading(ctx, binding, 'left'),
    content: `<div class="${ctx.escapeHtml(binding.bodyClassName ?? 'contacts-workspace__list')}" data-scroll-owner="content-region">` + renderContactsTab(ctx, binding.selectedVariantId, binding.chats, binding.getUnread) + '</div>' };
}

export interface CharacterColumnBinding extends ColumnAppearance { variantId: string | null }
export function createCharacterColumn(ctx: UIContext, binding: CharacterColumnBinding): SemanticColumnSpec {
  const refreshBinding = { ...binding, appearance: binding.appearance ? { ...binding.appearance } : undefined, actions: binding.actions ? { ...binding.actions } : undefined };
  return { key: binding.key ?? 'character', definitionId: 'character', bindingKey: binding.variantId ?? '', slot: 'right', hostId: 'rightPanel.character', themeScope: 'right.character', surface: 'panel', scroll: 'content',
    ...binding.appearance, header: heading(ctx, binding, 'right'), onBack: binding.onBack, ...actions(binding),
    semanticRefresh: nextCtx => createCharacterColumn(nextCtx, refreshBinding),
    content: `<div class="${ctx.escapeHtml(binding.bodyClassName ?? 'contacts-workspace__inspector')}" data-scroll-owner="content-region" data-character-owner="${ctx.escapeHtml(binding.variantId ?? '')}">${renderCharacterPanel(ctx, binding.variantId)}</div>` };
}
