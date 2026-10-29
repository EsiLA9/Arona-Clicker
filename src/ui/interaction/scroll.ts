// ============================================================
// ui/scroll.ts — 面板 / 工作区滚动状态 + 聊天流的共享滚动入口
// 聊天流的贴底跟随、图片伸展与观察器已收拢到 flow/flow-scroll.ts；
// 本类保留原公开方法，作为 Chat 侧的薄包装与面板/工作区快照管理者。
// ============================================================

import { FlowScroll } from '../flow/flow-scroll';
import { workspaceColumnScrollTargets } from './workspace-scroll';

/** 聊天流的流实例键：`.chat-stream` 每次全量 render 会换节点，状态必须按流而非元素保存。 */
const CHAT_STREAM_KEY = 'chat';

function chatHosts(root: HTMLElement): HTMLElement[] {
  if (root.querySelectorAll) return [...root.querySelectorAll<HTMLElement>('.chat-stream')];
  const host = root.querySelector<HTMLElement>('.chat-stream');
  return host ? [host] : [];
}
function chatKey(host: HTMLElement): string {
  const instance = host.closest?.<HTMLElement>('[data-column-instance]')?.dataset.columnInstance;
  const stream = host.dataset?.flowStreamKey;
  return instance ? `${instance}:${stream ?? 'chat'}` : stream ?? CHAT_STREAM_KEY;
}
function panelKey(panel: HTMLElement, index: number): string {
  const column = panel.closest?.<HTMLElement>('[data-column-instance]');
  return column ? `${column.dataset.columnInstance}:${panel.dataset.gamePanel ?? panel.dataset.themeHostId ?? [...column.querySelectorAll('.panel:not(.workspace-column)')].indexOf(panel)}` : String(index);
}

/** Compatibility for older Workspace markup that predates data-column-instance. */
function legacyWorkspaceScrollTargets(root: HTMLElement): Array<[string, HTMLElement]> {
  return [...root.querySelectorAll<HTMLElement>('.workspace-column__body')]
    .flatMap((body): Array<[string, HTMLElement]> => {
      if (body.closest?.('[data-column-instance]')) return [];
      const slot = body.closest?.<HTMLElement>('[data-workspace-column]')?.dataset.workspaceColumn;
      if (!slot) return [];
      const scope = body.closest?.<HTMLElement>('[data-workspace-instance]')?.dataset.workspaceInstance ?? 'legacy';
      const content = body.dataset.scrollOwner === 'content-region'
        ? body
        : body.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
      return [[`${scope}:${slot}`, content ?? body]];
    });
}

/** 面板与工作区滚动状态；聊天流委托 FlowScroll 处理。 */
export class ScrollManager {
  /** 聊天流共享滚动能力（按真实宿主元素与流实例键工作）。 */
  private readonly flow = new FlowScroll();
  /** 下一次重建强制滚到底（从日志切回聊天等场景）。 */
  private pendingChatForceScroll = false;
  /** 上一次重建时的活跃流条目数（判断是否有新内容到达）。 */
  private lastChatCount = new Map<string, number>();
  /** 面板滚动位置快照：按面板序号记录内容 Panel 的 .panel-body scrollTop。 */
  private panelScrollTop = new Map<string, number>();
  /** Workspace 三列滚动快照：按 left / center / right 槽位保存。 */
  private workspaceScrollTop = new Map<string, number>();

  /** 会话重置：回到底部 + 清快照计数。 */
  reset(): void {
    this.pendingChatForceScroll = false;
    this.lastChatCount.clear();
    this.panelScrollTop.clear();
    this.workspaceScrollTop.clear();
    this.flow.reset();
  }

  /** 标记下次重建强制滚到底（从日志切回聊天等场景）。 */
  forceToBottom(): void {
    this.pendingChatForceScroll = true;
  }

  /** 重建 DOM 前调用：记录当前聊天流滚动状态与阅读锚点。 */
  captureChat(root: HTMLElement): void {
    for (const host of chatHosts(root)) this.flow.capture(host, chatKey(host));
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
    const force = this.pendingChatForceScroll;
    this.pendingChatForceScroll = false;
    for (const host of chatHosts(root)) {
      const key = chatKey(host);
      const count = host.dataset?.flowStreamKey ? host.querySelectorAll('[data-flow-entry-key]').length : opts.activeStreamLength;
      const hasNew = count !== this.lastChatCount.get(key);
      this.lastChatCount.set(key, count);
      this.flow.restore(host, { mode: 'ratio', follow: hasNew, force, streamKey: key });
    }
  }

  /**
   * 重建后调用：观察聊天流内图片的尺寸变化。
   * .chat-stream 是固定尺寸滚动容器，内容撑高不改变其自身 content box，
   * 监听容器本身不会触发；改监听流内 <img>（加载时从 0 撑开到实际高度），
   * 图片尺寸回调里重新贴底——覆盖"流高小于视口，图片渲染后才超出"的情况。
   */
  observeChatStream(root: HTMLElement): void {
    for (const host of chatHosts(root)) this.flow.observe(host, chatKey(host));
  }

  /** 面板滚动位置快照：强化/通讯录等列表防刷新回滚。 */
  capturePanel(root: HTMLElement): void {
    this.panelScrollTop = new Map([...root.querySelectorAll<HTMLElement>('.panel:not(.workspace-column)')].map(
      (panel, index) => [panelKey(panel, index), panel.querySelector<HTMLElement>('.panel-body')?.scrollTop ?? 0],
    ));
  }

  restorePanel(root: HTMLElement): void {
    if (this.panelScrollTop.size === 0) return;
    root.querySelectorAll<HTMLElement>('.panel:not(.workspace-column)').forEach((panel, i) => {
      const body = panel.querySelector<HTMLElement>('.panel-body');
      const top = this.panelScrollTop.get(panelKey(panel, i));
      if (body && top !== undefined) {
        body.scrollTop = top;
      }
    });
  }

  captureWorkspace(root: HTMLElement): void {
    this.workspaceScrollTop = new Map();
    for (const column of root.querySelectorAll<HTMLElement>('[data-column-instance]')) {
      for (const [key, target] of workspaceColumnScrollTargets(column)) this.workspaceScrollTop.set(key, target.scrollTop);
    }
    for (const [key, target] of legacyWorkspaceScrollTargets(root)) this.workspaceScrollTop.set(key, target.scrollTop);
  }

  restoreWorkspace(root: HTMLElement): void {
    for (const column of root.querySelectorAll<HTMLElement>('[data-column-instance]')) {
      for (const [key, target] of workspaceColumnScrollTargets(column)) {
        const scrollTop = this.workspaceScrollTop.get(key);
        if (scrollTop !== undefined) target.scrollTop = scrollTop;
      }
    }
    for (const [key, target] of legacyWorkspaceScrollTargets(root)) {
      const scrollTop = this.workspaceScrollTop.get(key);
      if (scrollTop !== undefined) target.scrollTop = scrollTop;
    }
  }
}
