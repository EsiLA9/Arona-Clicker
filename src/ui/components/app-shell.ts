import { UIContext } from '../context';
import { renderHeader } from './header';
import { renderLeftPanel } from './rail';
import { renderCenterPanel } from './center-panel';
import { renderRightPanel } from './right-panels';
import { ChatEntry } from './story';

export interface PanelState {
  leftTab: string;
  centerTab: string;
  rightTab: string;
  chatEntries: ChatEntry[];
  /** 通讯录当前选中的差分 id（驱动右栏培养面板）。 */
  selectedVariantId: string | null;
  /**
   * 对话空间：当前打开的学生差分 id（null = 一般聊天）。
   * 打开时中栏整体替换为该学生的对话视图（含顶部返回栏）。
   */
  conversationVariantId: string | null;
  /** 每个学生各自的聊天流（对话空间复用聊天流机制，按学生恢复语境）。 */
  studentChats: Record<string, ChatEntry[]>;
  /** 未读消息计数接口（预留，后续接入未读系统时提供）。 */
  getUnread?: (variantId: string) => number;
}

export function renderAppShell(ctx: UIContext, state: PanelState): string {
  const conversation = state.conversationVariantId
    ? {
        variantId: state.conversationVariantId,
        entries: state.studentChats[state.conversationVariantId] ?? [],
      }
    : undefined;
  return `
    <main class="console-shell">
      ${renderHeader(ctx)}
      <section class="workspace">
        ${renderLeftPanel(ctx, state)}
        ${renderCenterPanel(ctx, state.centerTab, state.chatEntries, ctx.game.getSendState(state.conversationVariantId ?? undefined), conversation)}
        ${renderRightPanel(ctx, state.rightTab, state.selectedVariantId)}
      </section>
      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>TS-HTML ENGINE · NO NETWORK</span></footer>
    </main>`;
}
