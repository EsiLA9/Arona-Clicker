// ============================================================
// ui/popovers.ts — 悬浮详情弹层（event delegation + 防抖）
// 独立于 #app 的 body 级弹性层，一次绑定、跨 DOM 重建保持。
// ============================================================

import type { GameReadModel } from '../../arona-clicker/contracts/index';
import { createUIContext } from '../runtime/context';
import { getTooltipContent } from '../components/tooltip/tooltip';

const GAP = 10;
const POINTER_GAP = 0;
const SHOW_DELAY = 80;  // 停留此毫秒才显示（防误触）
const HIDE_DELAY = 60;  // 移出后快速隐藏（便于查看下方内容）

type TooltipPlacement = 'right' | 'left' | 'bottom' | 'top';

interface TooltipPoint {
  x: number;
  y: number;
}

/**
 * body 级浮动弹层（独立于 #app 的 DOM 刷新）。
 * 用事件委托 + 防抖：鼠标在 wrap 上停留一小段时间才显示（避免扫过即弹），
 * 移出 wrap（未进入弹层）后快速隐藏（避免遮挡下方内容）。
 */
export class PopoverManager {
  private bound = false;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingWrap: HTMLElement | null = null;
  private timerGeneration = 0;
  /** 当前显示中浮层的锚点元素（retainIfAnchored 判断用）。 */
  private lastWrap: HTMLElement | null = null;
  private pointer: TooltipPoint | null = null;
  private placement: TooltipPlacement | null = null;
  private positionFrame: number | null = null;
  private positionWrap: HTMLElement | null = null;
  private naturalTooltipSize: { width: number; height: number } | null = null;
  private renderedTooltipSize: { width: number; height: number } | null = null;
  private maxWidthSetting = '';
  private maxHeightSetting = '';

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
    if (this.pendingWrap && !this.isLiveAnchor(this.pendingWrap)) this.cancelPendingShow();
    const tooltipEl = document.getElementById('floating-tooltip');
    if (!tooltipEl || !tooltipEl.classList.contains('is-open')) return;
    if (this.lastWrap?.isConnected) return;
    this.clearTooltip(tooltipEl);
  }

  /** 即将替换指定范围时，关闭该范围内的悬浮层；未受影响的锚点保持。 */
  dismissBeforeRootMutation(scope: ParentNode = this.root): void {
    if (this.pendingWrap && scope.contains(this.pendingWrap)) this.cancelPendingShow();
    if (!this.lastWrap || !scope.contains(this.lastWrap)) return;
    const tooltipEl = document.getElementById('floating-tooltip');
    if (tooltipEl) this.clearTooltip(tooltipEl);
    else {
      this.lastWrap = null;
      this.placement = null;
      this.naturalTooltipSize = null;
      this.renderedTooltipSize = null;
      this.cancelPositionFrame();
    }
  }

  private isLiveAnchor(wrap: HTMLElement): boolean {
    return wrap.isConnected && this.root.contains(wrap);
  }

  private cancelPendingShow(): void {
    if (this.showTimer !== null) clearTimeout(this.showTimer);
    this.showTimer = null;
    this.pendingWrap = null;
    this.timerGeneration += 1;
  }

  private cancelPositionFrame(): void {
    if (this.positionFrame !== null) window.cancelAnimationFrame(this.positionFrame);
    this.positionFrame = null;
    this.positionWrap = null;
  }

  private clearTooltip(tooltipEl: HTMLElement): void {
    tooltipEl.classList.remove('is-open');
    this.lastWrap = null;
    this.placement = null;
    this.naturalTooltipSize = null;
    this.renderedTooltipSize = null;
    this.cancelPositionFrame();
  }

  private positionTooltip(wrap: HTMLElement, tooltipEl: HTMLElement, refreshSize = false): void {
    if (!tooltipEl.classList.contains('is-open') || this.lastWrap !== wrap || !this.isLiveAnchor(wrap)) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportMaxWidth = Math.max(1, viewportWidth - GAP * 2);
    const viewportMaxHeight = Math.max(1, viewportHeight - GAP * 2);
    if (refreshSize || !this.naturalTooltipSize || !this.renderedTooltipSize) {
      tooltipEl.style.maxWidth = `${viewportMaxWidth}px`;
      tooltipEl.style.maxHeight = `${viewportMaxHeight}px`;
      this.maxWidthSetting = `${viewportMaxWidth}px`;
      this.maxHeightSetting = `${viewportMaxHeight}px`;
      const natural = tooltipEl.getBoundingClientRect();
      this.naturalTooltipSize = { width: natural.width, height: Math.min(natural.height, viewportMaxHeight) };
      this.renderedTooltipSize = this.naturalTooltipSize;
    }

    const anchor = wrap.getBoundingClientRect();
    const size = this.naturalTooltipSize!;
    const pointer = this.pointer ?? { x: anchor.left + anchor.width / 2, y: anchor.top + anchor.height / 2 };
    const room = {
      right: Math.max(0, viewportWidth - GAP - anchor.right - POINTER_GAP),
      left: Math.max(0, anchor.left - POINTER_GAP - GAP),
      bottom: Math.max(0, viewportHeight - GAP - anchor.bottom - POINTER_GAP),
      top: Math.max(0, anchor.top - POINTER_GAP - GAP),
    };
    const canFit: Record<TooltipPlacement, boolean> = {
      right: room.right >= size.width,
      left: room.left >= size.width,
      bottom: room.bottom >= size.height,
      top: room.top >= size.height,
    };
    const prefersLeft = wrap.matches('.right-panel [data-ui-spot-card]');
    const order: TooltipPlacement[] = prefersLeft
      ? ['left', 'right', 'bottom', 'top']
      : ['right', 'left', 'bottom', 'top'];
    let placement = this.placement && canFit[this.placement]
      ? this.placement
      : order.find(candidate => canFit[candidate]);

    if (!placement) {
      // No side can hold the full natural size. Use the side with the most usable area,
      // then constrain the floating layer to the viewport and let its content scroll.
      const availableArea: Record<TooltipPlacement, number> = {
        right: room.right * viewportMaxHeight,
        left: room.left * viewportMaxHeight,
        bottom: viewportMaxWidth * room.bottom,
        top: viewportMaxWidth * room.top,
      };
      placement = order.reduce((best, candidate) => availableArea[candidate] > availableArea[best] ? candidate : best, order[0]);
    }

    const sideRoom = placement === 'right' ? room.right
      : placement === 'left' ? room.left
        : viewportMaxWidth;
    // Preserve a usable text width when the target leaves almost no side space. In this
    // constrained fallback the tooltip may overlap the target, but remains viewport-bound.
    const fallbackMinWidth = Math.min(180, viewportMaxWidth);
    const maxWidth = Math.min(viewportMaxWidth, Math.max(fallbackMinWidth, sideRoom));
    const nextMaxWidthSetting = `${maxWidth}px`;
    const sideHeight = placement === 'bottom' ? room.bottom : placement === 'top' ? room.top : viewportMaxHeight;
    const fallbackMinHeight = Math.min(160, viewportMaxHeight);
    const nextMaxHeightSetting = `${Math.max(fallbackMinHeight, sideHeight)}px`;
    if (this.maxWidthSetting !== nextMaxWidthSetting || this.maxHeightSetting !== nextMaxHeightSetting) {
      tooltipEl.style.maxWidth = nextMaxWidthSetting;
      tooltipEl.style.maxHeight = nextMaxHeightSetting;
      this.maxWidthSetting = nextMaxWidthSetting;
      this.maxHeightSetting = nextMaxHeightSetting;
      const measured = tooltipEl.getBoundingClientRect();
      this.renderedTooltipSize = { width: Math.min(measured.width, viewportMaxWidth), height: Math.min(measured.height, viewportMaxHeight) };
    }
    const width = Math.min(this.renderedTooltipSize!.width, viewportMaxWidth);
    const height = Math.min(this.renderedTooltipSize!.height, viewportMaxHeight);
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
    let left: number;
    let top: number;
    if (placement === 'right') {
      left = anchor.right + POINTER_GAP;
      top = clamp(pointer.y - height / 2, GAP, viewportHeight - GAP - height);
    } else if (placement === 'left') {
      left = anchor.left - POINTER_GAP - width;
      top = clamp(pointer.y - height / 2, GAP, viewportHeight - GAP - height);
    } else if (placement === 'bottom') {
      left = clamp(pointer.x - width / 2, GAP, viewportWidth - GAP - width);
      top = anchor.bottom + POINTER_GAP;
    } else {
      left = clamp(pointer.x - width / 2, GAP, viewportWidth - GAP - width);
      top = anchor.top - POINTER_GAP - height;
    }

    tooltipEl.style.left = `${clamp(left, GAP, viewportWidth - GAP - width)}px`;
    tooltipEl.style.top = `${clamp(top, GAP, viewportHeight - GAP - height)}px`;
    this.placement = placement;
  }

  private schedulePosition(wrap: HTMLElement, tooltipEl: HTMLElement): void {
    this.positionWrap = wrap;
    if (this.positionFrame !== null) return;
    this.positionFrame = window.requestAnimationFrame(() => {
      this.positionFrame = null;
      const current = this.positionWrap;
      this.positionWrap = null;
      if (current) this.positionTooltip(current, tooltipEl);
    });
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

    const hide = (delay = HIDE_DELAY) => {
      this.cancelPendingShow();
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        this.hideTimer = null;
        this.clearTooltip(tooltipEl!);
      }, delay);
    };
    const cancelHide = () => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    };

    const show = (wrap: HTMLElement) => {
      cancelHide();
      // A bubbled mouseover from a child is still the same logical target.
      if (this.pendingWrap === wrap) return;
      if (this.lastWrap === wrap && tooltipEl!.classList.contains('is-open')) {
        this.cancelPendingShow();
        this.schedulePosition(wrap, tooltipEl!);
        return;
      }
      // 防抖：鼠标在 wrap 上停留 SHOW_DELAY 毫秒才生成内容
      this.cancelPendingShow();
      const generation = this.timerGeneration;
      this.pendingWrap = wrap;
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        if (this.pendingWrap === wrap) this.pendingWrap = null;
        if (generation !== this.timerGeneration || !this.isLiveAnchor(wrap)) return;
        const key = wrap.dataset.tooltip;
        if (!key) {
          if (this.lastWrap !== wrap) this.clearTooltip(tooltipEl!);
          return;
        }
        cancelHide();

        const context = createUIContext(this.game);
        const content = getTooltipContent(context, key);
        if (!content) {
          if (this.lastWrap !== wrap) this.clearTooltip(tooltipEl!);
          return;
        }

        tooltipEl!.innerHTML = content;
        this.placement = null;
        this.naturalTooltipSize = null;
        this.renderedTooltipSize = null;
        this.maxWidthSetting = '';
        this.maxHeightSetting = '';
        tooltipEl!.classList.add('is-open');
        this.lastWrap = wrap;
        this.positionTooltip(wrap, tooltipEl!, true);
      }, SHOW_DELAY);
    };

    // 事件委托：mouseover 时若进入 hover-wrap[data-tooltip]，防抖后显示
    this.root.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (wrap) {
        const mouse = event as MouseEvent;
        this.pointer = { x: mouse.clientX, y: mouse.clientY };
        show(wrap);
      }
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
    this.root.addEventListener('mousemove', (event) => {
      const mouse = event as MouseEvent;
      this.pointer = { x: mouse.clientX, y: mouse.clientY };
      const target = event.target as HTMLElement;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (wrap && wrap === this.lastWrap) this.schedulePosition(wrap, tooltipEl!);
    });
    this.root.addEventListener('wheel', (event) => {
      if (!tooltipEl!.classList.contains('is-open')) return;
      const wheel = event as WheelEvent;
      const rect = tooltipEl!.getBoundingClientRect();
      if (wheel.clientX < rect.left || wheel.clientX > rect.right
        || wheel.clientY < rect.top || wheel.clientY > rect.bottom || wheel.deltaY === 0) return;
      const maxScroll = Math.max(0, tooltipEl!.scrollHeight - tooltipEl!.clientHeight);
      const nextScrollTop = Math.max(0, Math.min(maxScroll, tooltipEl!.scrollTop + wheel.deltaY));
      if (nextScrollTop === tooltipEl!.scrollTop) return;
      tooltipEl!.scrollTop = nextScrollTop;
      wheel.preventDefault();
    }, { capture: true, passive: false });
    this.root.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (wrap) {
        this.pointer = null;
        show(wrap);
      }
    });
    this.root.addEventListener('focusout', (event) => {
      const target = event.target as HTMLElement;
      const related = event.relatedTarget as HTMLElement | null;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (!wrap) return;
      if (related && (wrap.contains(related) || related.closest('.hover-wrap[data-tooltip]'))) {
        cancelHide();
        return;
      }
      hide();
    });
    window.addEventListener('scroll', () => {
      if (this.lastWrap) this.schedulePosition(this.lastWrap, tooltipEl!);
    }, true);
    window.addEventListener('resize', () => {
      if (this.lastWrap) {
        this.naturalTooltipSize = null;
        this.renderedTooltipSize = null;
        this.schedulePosition(this.lastWrap, tooltipEl!);
      }
    });
  }
}
