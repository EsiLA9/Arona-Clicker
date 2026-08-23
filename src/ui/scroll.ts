// ============================================================
// ui/scroll.ts — 聊天流 / 面板滚动状态管理
// 疏散自 controller.ts：DOM 重建前后按比例保存并恢复滚动位置，
// 避免条件刷新把列表拽回顶层、或打断用户在上方翻看历史。
// ============================================================

/** 聊天流 / 面板滚动状态：重建 DOM 前后捕获并按比例恢复。 */
export class ScrollManager {
  private chatScrollRatio = 1;
  private chatAtBottom = true;
  private pendingChatForceScroll = false;
  /** 上一次重建时的活跃流条目数（判断是否有新内容到达）。 */
  private lastChatCount = 0;
  /** 面板滚动位置快照：按面板序号记录 .panel-body 的 scrollTop。 */
  private panelScrollTop: number[] = [];

  /** 会话重置：回到底部 + 清快照计数。 */
  reset(): void {
    this.chatScrollRatio = 1;
    this.chatAtBottom = true;
    this.pendingChatForceScroll = false;
    this.lastChatCount = 0;
  }

  /** 标记下次重建强制滚到底（从日志切回聊天等场景）。 */
  forceToBottom(): void {
    this.pendingChatForceScroll = true;
  }

  /** 重建 DOM 前调用：记录当前聊天流滚动比例，并判断是否贴底。 */
  captureChat(root: HTMLElement): void {
    const stream = root.querySelector<HTMLElement>('.chat-stream');
    if (!stream) return;
    const max = stream.scrollHeight - stream.clientHeight;
    if (max <= 0) {
      this.chatScrollRatio = 1;
      this.chatAtBottom = true;
      return;
    }
    this.chatScrollRatio = stream.scrollTop / max;
    // 距底部 24px 内视为"贴底"（新内容到达时跟随滚到底）
    this.chatAtBottom = stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 24;
  }

  /**
   * 重建 DOM 后调用：
   * - 新内容到达且用户原本贴底 → 滚到底
   * - 用户在上方翻看历史 → 保持原位置（不打断）
   * - force（从日志切回聊天）→ 滚到底
   */
  restoreChat(root: HTMLElement, opts: {
    centerTab: string;
    conversationVariantId: string | null;
    activeStreamLength: number;
  }): void {
    // 对话空间或一般聊天：两者都有 .chat-stream
    if (opts.centerTab !== 'chat' && !opts.conversationVariantId) return;
    const stream = root.querySelector<HTMLElement>('.chat-stream');
    if (!stream) return;
    const hasNew = opts.activeStreamLength !== this.lastChatCount;
    this.lastChatCount = opts.activeStreamLength;
    if ((hasNew && this.chatAtBottom) || this.pendingChatForceScroll) {
      this.chatScrollRatio = 1;
      this.pendingChatForceScroll = false;
      this.chatAtBottom = true;
    }
    const max = stream.scrollHeight - stream.clientHeight;
    stream.scrollTop = this.chatScrollRatio * max;
  }

  /** 面板滚动位置快照：强化/通讯录等列表防刷新回滚。 */
  capturePanel(root: HTMLElement): void {
    this.panelScrollTop = [...root.querySelectorAll<HTMLElement>('.panel')].map(
      panel => panel.querySelector<HTMLElement>('.panel-body')?.scrollTop ?? 0,
    );
  }

  restorePanel(root: HTMLElement): void {
    if (this.panelScrollTop.length === 0) return;
    root.querySelectorAll<HTMLElement>('.panel').forEach((panel, i) => {
      const body = panel.querySelector<HTMLElement>('.panel-body');
      if (body && this.panelScrollTop[i] !== undefined) {
        body.scrollTop = this.panelScrollTop[i];
      }
    });
  }
}
