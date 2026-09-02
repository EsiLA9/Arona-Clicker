// ============================================================
// ui/popovers.ts — 悬浮详情弹层（event delegation + 防抖）
// 独立于 #app 的 body 级弹性层，一次绑定、跨 DOM 重建保持。
// ============================================================

import type { GameReadModel } from '../arona-clicker/contracts';
import { createUIContext } from './context';
import { getTooltipContent } from './components/tooltip';

const GAP = 10;
const SHOW_DELAY = 80;  // 停留此毫秒才显示（防误触）
const HIDE_DELAY = 60;  // 移出后快速隐藏（便于查看下方内容）

/**
 * body 级浮动弹层（独立于 #app 的 DOM 刷新）。
 * 用事件委托 + 防抖：鼠标在 wrap 上停留一小段时间才显示（避免扫过即弹），
 * 移出 wrap（未进入弹层）后快速隐藏（避免遮挡下方内容）。
 */
export class PopoverManager {
  private bound = false;
  /** 当前显示中浮层的锚点元素（retainIfAnchored 判断用）。 */
  private lastWrap: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly game: GameReadModel,
  ) {}

  /**
   * DOM 全量重建后调用（controller.render 开头）：
   * 锚点元素仍连接（如 body 级弹窗内未被重建）→ 保留浮层；
   * 锚点已被重建移除（#app 内的 hover-wrap）→ 关闭，避免残留陈旧浮层。
   */
  retainIfAnchored(): void {
    const tooltipEl = document.getElementById('floating-tooltip');
    if (!tooltipEl || !tooltipEl.classList.contains('is-open')) return;
    if (this.lastWrap?.isConnected) return;
    tooltipEl.classList.remove('is-open');
    this.lastWrap = null;
  }

  bind(): void {
    // #app 持久存在，事件委托监听器只需绑定一次（Init 选择页与游戏页共用同一 root）
    if (this.bound) return;
    this.bound = true;
    let tooltipEl = document.getElementById('floating-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'floating-tooltip';
      tooltipEl.className = 'floating-tooltip';
      document.body.appendChild(tooltipEl);
    }

    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const hide = (delay = HIDE_DELAY) => {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        tooltipEl!.classList.remove('is-open');
        this.lastWrap = null;
      }, delay);
    };
    const cancelHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const show = (wrap: HTMLElement) => {
      // 防抖：鼠标在 wrap 上停留 SHOW_DELAY 毫秒才生成内容
      if (showTimer) clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        const key = wrap.dataset.tooltip;
        if (!key) return;
        cancelHide();

        const context = createUIContext(this.game);
        const content = getTooltipContent(context, key);
        if (!content) return;

        tooltipEl!.innerHTML = content;
        tooltipEl!.classList.add('is-open');
        this.lastWrap = wrap;

        const wrapRect = wrap.getBoundingClientRect();
        const popRect = tooltipEl!.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = wrapRect.bottom + 8;
        if (top + popRect.height > vh - GAP) {
          top = wrapRect.top - popRect.height - 8;
          if (top < GAP) top = GAP;
        }
        // 默认右对齐 wrap 右缘（避免覆盖同行左侧内容 / 面板内其他导航）
        let left = wrapRect.right - popRect.width;
        if (left < GAP) left = GAP;
        if (left + popRect.width > vw - GAP) left = vw - GAP - popRect.width;
        tooltipEl!.style.top = `${top}px`;
        tooltipEl!.style.left = `${left}px`;
      }, SHOW_DELAY);
    };

    // 事件委托：mouseover 时若进入 hover-wrap[data-tooltip]，防抖后显示
    this.root.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (wrap) show(wrap);
    });
    // mouseout 时：移出 wrap 且未进入另一 wrap → 快速隐藏。
    // tooltip 为 pointer-events:none，鼠标可穿透，不会拦截移向底部内容的动作。
    this.root.addEventListener('mouseout', (event) => {
      const target = event.target as HTMLElement;
      const to = event.relatedTarget as HTMLElement | null;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (!wrap) return;
      // 移入另一 wrap → 保持，由对方 mouseover 接管
      if (to && to.closest('.hover-wrap[data-tooltip]')) {
        cancelHide();
        return;
      }
      hide();
    });
  }
}
