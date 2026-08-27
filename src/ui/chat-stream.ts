// ============================================================
// ui/chat-stream.ts — 聊天流领域逻辑（计数/路由/剧情同步）
// 疏散自 controller.ts：把聊天流相关的私有状态与操作收拢到这里，
// 由 controller 持有一个实例并委托。
// ============================================================

import { GameInstance } from '../engine/game-instance';
import type { StoryView } from '../engine/types';
import type { PanelState } from './components/app-shell';
import type { ChatEntry, ChatTextEntry } from './components/story';
import { PLAYER_IDENTITY } from './player';

const CHAT_MAX = 200;

/** 聊天流管理：维护自增 ID、当前剧情页去重指纹，并把条目路由到当前活跃流。 */
export class ChatStream {
  private chatId = 1;
  private lastStoryFingerprint: string | null = null;

  /** 会话重置（新游戏 / 读档 / 重启）：清剧情指纹，ID 无需归零。 */
  reset(): void {
    this.lastStoryFingerprint = null;
  }

  /** 当前活跃聊天流（对话空间打开时 = 该学生的流；否则 = 一般聊天流）。 */
  activeStream(panelState: PanelState): ChatEntry[] {
    const convId = panelState.conversationVariantId;
    if (!convId) return panelState.chatEntries;
    return (panelState.studentChats[convId] ??= []);
  }

  /** 记录聊天流条目，维持上限（路由到当前活跃流：一般聊天 / 学生对话空间）。 */
  push(panelState: PanelState, entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    const stream = this.activeStream(panelState);
    stream.push({
      ...entry,
      id: this.chatId++,
      timestamp: Date.now(),
    });
    if (stream.length > CHAT_MAX) {
      stream.splice(0, stream.length - CHAT_MAX);
    }
  }

  /**
   * 每次 render 前把当前 Talklet 的演示内容同步进聊天流。
   * 以 `storyId:pageIndex` 指纹去重，覆盖自动展开 / 手动启动 / 推进 / 读档 / 切换 Init 全部入口。
   *
   * 多沙盒：对话空间（conversationVariantId 非空）同步该角色独立游标上的当前剧情；
   * 一般聊天（conversationVariantId 空）同步全局游标（active 主线 / 一般闲聊）。
   * 各沙盒并行互不干扰——外部故事不会串入角色流。
   */
  syncCurrentStory(panelState: PanelState, game: GameInstance): void {
    const convId = panelState.conversationVariantId;
    const story = convId ? game.getStoryView(convId) : game.getView().currentStory;
    if (!story) {
      this.lastStoryFingerprint = null;
      return;
    }
    const fingerprint = `${story.storyId}:${story.pageIndex}`;
    if (fingerprint === this.lastStoryFingerprint) return;
    this.lastStoryFingerprint = fingerprint;
    // click 页为纯底部按钮交互页（text 作按钮文案），不进入聊天流
    if (story.page.kind === 'click') return;
    this.push(panelState, {
      kind: story.page.kind ?? 'talk',
      speaker: story.page.speaker,
      text: story.page.text,
      storyType: story.type,
      align: story.page.align,
      avatar: story.page.avatar,
      image: story.page.image,
      side: story.page.side,
      noAvatar: story.page.noAvatar,
    });
  }

  /** 玩家（老师）回复气泡入流（由 clickSend 回显调用）。 */
  pushPlayerReply(panelState: PanelState, text: string): void {
    this.push(panelState, {
      kind: 'talk',
      speaker: PLAYER_IDENTITY.speaker,
      text,
      isPlayer: PLAYER_IDENTITY.isPlayer,
    });
  }

  /** 向后吸收的过渡页（推进后自动跳过的纯展示页）同步进聊天流。 */
  pushAbsorbed(panelState: PanelState, views: StoryView[]): void {
    for (const view of views) {
      if (view.page.kind === 'click') continue;
      this.push(panelState, {
        kind: view.page.kind ?? 'talk',
        speaker: view.page.speaker,
        text: view.page.text,
        storyType: view.type,
        align: view.page.align,
        avatar: view.page.avatar,
        image: view.page.image,
        side: view.page.side,
        noAvatar: view.page.noAvatar,
      });
    }
  }

  /** 当前活跃流的演出专用文本覆盖层。 */
  activeChatTexts(panelState: PanelState): ChatTextEntry[] {
    const convId = panelState.conversationVariantId;
    if (!convId) return panelState.chatTexts;
    return (panelState.studentChatTexts[convId] ??= []);
  }

  /** 清理聊天流全部内容（含演出专用文本覆盖层）。 */
  clearAll(panelState: PanelState): void {
    const stream = this.activeStream(panelState);
    stream.length = 0;
    const texts = this.activeChatTexts(panelState);
    texts.length = 0;
  }

  /** 删除全部可变位置的演出文本覆盖层（保留聊天历史）。 */
  clearAllTexts(panelState: PanelState): void {
    const texts = this.activeChatTexts(panelState);
    texts.length = 0;
  }

  /** 添加演出专用文本覆盖层到当前活跃流（同 id 覆盖更新）。 */
  pushChatText(panelState: PanelState, entry: ChatTextEntry): void {
    const texts = this.activeChatTexts(panelState);
    const existing = texts.findIndex(t => t.id === entry.id);
    if (existing >= 0) {
      texts[existing] = entry;
    } else {
      texts.push(entry);
    }
  }

  /** 按临时 id 擦除演出专用文本覆盖层。 */
  clearChatText(panelState: PanelState, id: string): void {
    const texts = this.activeChatTexts(panelState);
    const idx = texts.findIndex(t => t.id === id);
    if (idx >= 0) texts.splice(idx, 1);
  }
}
