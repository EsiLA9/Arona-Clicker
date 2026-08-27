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
  /** 聊天流图片观察器：<img> 加载撑开高度后自动贴底。 */
  private resizeObserver: ResizeObserver | null = null;
  /** 当前被观察的聊天流容器（用于移除 scroll 监听）。 */
  private observeTarget: HTMLElement | null = null;

  /** 滚动时实时刷新贴底标记：图片加载回调不打断用户上翻历史。 */
  private handleStreamScroll = (): void => {
    const stream = this.observeTarget;
    if (!stream) return;
    this.chatAtBottom = stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 24;
  };

  /** 会话重置：回到底部 + 清快照计数。 */
  reset(): void {
    this.chatScrollRatio = 1;
    this.chatAtBottom = true;
    this.pendingChatForceScroll = false;
    this.lastChatCount = 0;
    this.disconnectObserver();
  }

  /** 标记下次重建强制滚到底（从日志切回聊天等场景）。 */
  forceToBottom(): void {
    this.pendingChatForceScroll = true;
  }

  /** 重建 DOM 前调用：记录当前聊天流滚动比例，并判断是否贴底。 */
  captureChat(root: HTMLElement): void {
    this.disconnectObserver();
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

  /**
   * 重建后调用：观察聊天流内图片的尺寸变化。
   * .chat-stream 是固定尺寸滚动容器，内容撑高不改变其自身 content box，
   * 监听容器本身不会触发；改监听流内 <img>（加载时从 0 撑开到实际高度），
   * 图片尺寸回调里重新贴底——覆盖"流高小于视口，图片渲染后才超出"的情况。
   */
  observeChatStream(root: HTMLElement): void {
    this.disconnectObserver();
    if (!this.chatAtBottom) return;
    const stream = root.querySelector<HTMLElement>('.chat-stream');
    if (!stream || typeof ResizeObserver === 'undefined') return;
    const images = [...stream.querySelectorAll<HTMLImageElement>('img')];
    if (images.length === 0) return;
    this.observeTarget = stream;
    stream.addEventListener('scroll', this.handleStreamScroll);
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.chatAtBottom) return;
      stream.scrollTop = stream.scrollHeight - stream.clientHeight;
    });
    for (const img of images) this.resizeObserver.observe(img);
  }

  /** 停止观察聊天流（重建 / 重置前调用）。 */
  disconnectObserver(): void {
    if (this.observeTarget) {
      this.observeTarget.removeEventListener('scroll', this.handleStreamScroll);
      this.observeTarget = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
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
