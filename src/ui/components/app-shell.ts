import { UIContext } from '../context';
import { ChatEntry, ChatTextEntry } from './story';
import type { ShopSession } from '../../arona-clicker/services/shop-service';
import type { InventoryWorkspaceState } from '../inventory-view';
import type { DatapackWorkspaceState } from '../workspace/datapack-workspace-state';
import type { RuntimeDatapackEditorState } from '../runtime-editor/state';
import { renderWorkspace } from '../workspace/workspace-renderer';
import { resolveCurrentWorkspaceRoute, type WorkspaceLocation, type WorkspaceNavigationState, type WorkspaceRoute } from '../workspace/workspace-router';

export type { DatapackWorkspaceSection } from '../../arona-clicker/services/datapack-workspace-view';
export type { DatapackWorkspaceState } from '../workspace/datapack-workspace-state';
export type { RuntimeDatapackEditorState } from '../runtime-editor/state';
export type { WorkspaceLocation, WorkspaceNavigationState, WorkspaceRoute } from '../workspace/workspace-router';

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
  service?: 'game' | 'settings' | 'inventory' | 'datapack' | 'saves' | 'records';
  datapackWorkspace?: DatapackWorkspaceState;
  runtimeDatapackEditor?: RuntimeDatapackEditorState;
  workspaceNavigation?: WorkspaceNavigationState;
  inventoryWorkspace?: InventoryWorkspaceState;
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
  /** 当前接管三栏的临时功能工作区；Shop 是首个实现。 */
  workspace?: WorkspaceState;
}

export type WorkspaceReturnContext = WorkspaceLocation;
export type ShopReturnContext = WorkspaceLocation;

export interface ShopFeedEntry {
  kind: 'enter' | 'add' | 'remove' | 'checkout' | 'error' | 'cancel';
  text: string;
}

export interface ShopWorkspaceState {
  type: 'shop';
  spotId: string;
  shopId: string;
  session: ShopSession;
  feed: ShopFeedEntry[];
  returnContext: ShopReturnContext;
  themeId: string;
}

export interface CharacterWorkspaceState {
  type: 'character';
  variantId: string;
  conversationVariantId: string | null;
  returnContext: ShopReturnContext;
}

export interface ContactsWorkspaceState {
  type: 'contacts';
  selectedVariantId: string | null;
  conversationVariantId: string | null;
  returnContext: WorkspaceReturnContext;
}

export interface StoryWorkspaceState {
  type: 'story';
  navPath: string[];
  subroute: 'overview' | 'archive';
  selectedEntryId: string | null;
  conversationOwner: string | null;
  mode: 'overview' | 'playing';
  returnContext: WorkspaceReturnContext;
}

export type WorkspaceState = ShopWorkspaceState | CharacterWorkspaceState | ContactsWorkspaceState | StoryWorkspaceState;

export function renderAppShell(ctx: UIContext, state: PanelState): string {
  const workspace = state.workspace;
  const legacyWorkspace = workspace
    ? workspace.type === 'shop'
      ? { type: 'shop' as const, sessionId: `${workspace.spotId}:${workspace.shopId}` }
      : workspace.type === 'character'
        ? { type: 'character' as const, variantId: workspace.variantId }
        : workspace.type === 'contacts'
          ? { type: 'contacts' as const }
          : { type: 'story' as const, sessionId: workspace.conversationOwner ?? undefined }
    : null;
  const route = resolveCurrentWorkspaceRoute(state.workspaceNavigation, { service: state.service, workspace: legacyWorkspace });
  return renderWorkspace(ctx, route, state);
}
