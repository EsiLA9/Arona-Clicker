import { UIContext } from '../context';
import { renderHeader } from './header';
import { renderLeftPanel } from './rail';
import { renderCenterPanel } from './center-panel';
import { renderRightPanel } from './right-panels';
import { ChatEntry, ChatTextEntry } from './story';

export interface PanelState {
  leftTab: string;
  centerTab: string;
  rightTab: string;
  chatEntries: ChatEntry[];
  /** 演出专用文本覆盖层（showChatText，一般聊天流）。 */
  chatTexts: ChatTextEntry[];
  /** 通讯录当前选中的差分 id（驱动右栏培养面板）。 */
  selectedVariantId: string | null;
  /**
   * 对话空间：当前打开的学生差分 id（null = 一般聊天）。
   * 打开时中栏整体替换为该学生的对话视图（含顶部返回栏）。
   */
  conversationVariantId: string | null;
  /** 每个学生各自的聊天流（对话空间复用聊天流机制，按学生恢复语境）。 */
  studentChats: Record<string, ChatEntry[]>;
  /** 每个学生各自的演出专用文本覆盖层。 */
  studentChatTexts: Record<string, ChatTextEntry[]>;
  /** 未读消息计数接口（对话空间就绪队列条数，由 controller 提供）。 */
  getUnread?: (variantId: string) => number;
  /** 输入中提示：该学生对话空间有待推送内容，先展示省略号再推送。 */
  typingVariantId?: string | null;
  /** 故事层级导航路径：[]=分类选择，['main']=主线篇，['main','part_1']=主线篇1章，['main','part_1','ch_1']=项。 */
  storyNavPath: string[];
}

export function renderAppShell(ctx: UIContext, state: PanelState): string {
  const conversation = state.conversationVariantId
    ? {
        variantId: state.conversationVariantId,
        entries: state.studentChats[state.conversationVariantId] ?? [],
        chatTexts: state.studentChatTexts[state.conversationVariantId] ?? [],
        typing: state.typingVariantId === state.conversationVariantId,
      }
    : undefined;
  return `
    <main class="console-shell">
      ${renderHeader(ctx)}
      <section class="workspace">
        ${renderLeftPanel(ctx, state)}
        ${renderCenterPanel(ctx, state.centerTab, state.chatEntries, state.chatTexts, ctx.game.story.getSendState(state.conversationVariantId ?? undefined), conversation)}
        ${renderRightPanel(ctx, state.rightTab, state.selectedVariantId)}
      </section>
      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>TS-HTML ENGINE · NO NETWORK</span></footer>
    </main>`;
}
