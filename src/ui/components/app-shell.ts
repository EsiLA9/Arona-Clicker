import { UIContext } from '../context';
import { renderHeader } from './header';
import { renderLeftPanel } from './rail';
import { renderCenterPanel } from './center-panel';
import { renderRightPanel } from './right-panels';
import { ChatEntry, ChatTextEntry } from './story';
import { renderBackground } from '../background-service';
import { renderServiceWorkspace } from './service-workspace';

export type DatapackWorkspaceSection = 'all' | 'enabled' | 'disabled' | 'issues' | 'import';

export interface DatapackWorkspaceState {
  section: DatapackWorkspaceSection;
  selectedPackId: string | null;
  draftEnabledIds: string[];
  draftOrder: string[];
  validation: { ok: boolean; errors: string[]; warnings: string[] } | null;
  lastResult: { ok: boolean; message: string } | null;
}

/** 底部按钮门控阶段（§4 页级节奏）：typing = 对方打字中；pause = 连发停顿拍；thinking = 按钮"想回复"中。 */
export type SendGatePhase = 'typing' | 'pause' | 'thinking';

/** 开幕标题横幅快照：标题 + 呼出时刻（render 重建元素时按 startedAt 断点续播 CSS 动画，见 story-gate.ts）。 */
export interface ActiveBanner {
  title: string;
  startedAt: number;
}

/** 剧情入口确认浮层（点击剧情入口后等待确认；确认/取消动作见 controller-actions-story）。 */
export interface StoryGateState {
  /** 待进入的剧情入口 id（ActiveStoryEntry.id）。 */
  storyId: string;
  /** 目标沙盒（VariantId）；null = 全局聊天流。 */
  owner: string | null;
  /** 确认后的启动方式：active = startActiveStory / replay = replayStory / card = startCardStory。 */
  mode: 'active' | 'replay' | 'card';
}

export interface PanelState {
  /** 当前顶层服务工作区；game = 正常游玩三栏。 */
  service?: 'game' | 'datapack' | 'saves' | 'records';
  datapackWorkspace?: DatapackWorkspaceState;
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
  /**
   * 底部按钮门控阶段（§4 页级节奏，render 前由 ChatStream 计算当前活跃流）：
   * typing = 对方消息未送达；pause = 连发停顿拍；thinking = 按钮"想回复"中。
   * 三阶段内按钮均无文案、不可推进、点击仅加速 0.1s/次。
   */
  sendGate?: SendGatePhase | null;
  /** 故事层级导航路径：[]=分类选择，['main']=主线篇，['main','part_1']=主线篇1章，['main','part_1','ch_1']=项。 */
  storyNavPath: string[];
  /** 剧情入口确认浮层（非 null 时中心聊天窗格叠加确认浮层，确认才真正启动剧情）。 */
  storyGate?: StoryGateState | null;
  /** 当前活跃流的开幕标题横幅（render 前由 ChatStream.activeBanner 计算；null = 无）。 */
  openingBanner?: ActiveBanner | null;
}

export function renderAppShell(ctx: UIContext, state: PanelState): string {
  const service = state.service ?? 'game';
  if (service !== 'game') {
    return renderConsoleFrame(ctx, renderServiceWorkspace(ctx, service, state), '服务工作区 · 只读视图');
  }
  const conversation = state.conversationVariantId
    ? {
        variantId: state.conversationVariantId,
        entries: state.studentChats[state.conversationVariantId] ?? [],
        chatTexts: state.studentChatTexts[state.conversationVariantId] ?? [],
      }
    : undefined;
  return renderConsoleFrame(ctx, `
      <section class="workspace">
        ${renderLeftPanel(ctx, state)}
        ${renderCenterPanel(ctx, state.centerTab, state.chatEntries, state.chatTexts, ctx.game.story.getSendState(state.conversationVariantId ?? undefined), conversation, state.sendGate ?? null, state.storyGate ?? null, state.openingBanner ?? null)}
        ${renderRightPanel(ctx, state.rightTab, state.selectedVariantId)}
      </section>
    `, 'TS-HTML ENGINE · NO NETWORK');
}

function renderConsoleFrame(ctx: UIContext, body: string, footerNote: string): string {
  return `
    ${renderBackground(ctx.background)}
    <main class="console-shell">
      ${renderHeader(ctx)}
      ${body}
      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>${footerNote}</span></footer>
    </main>`;
}
