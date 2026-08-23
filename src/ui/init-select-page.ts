// ============================================================
// ui/init-select-page.ts — 世界线选择页（圆盘轮盘交互）
// 疏散自 controller.ts：把选择页的轮盘装配、聚焦旋转、局部刷新
// 逻辑连同其状态收拢到这里，由 controller 委托。
// ============================================================

import { GameInstance } from '../engine/game-instance';
import { createUIContext } from './context';
import { renderInitDetail, renderInitRow, type InitSelectMode } from './components/init-select';
import type { PopoverManager } from './popovers';

/** controller 暴露给选择页的回调（避免反向依赖）。 */
export interface InitSelectHost {
  game: GameInstance;
  root: HTMLElement;
  popovers: PopoverManager;
  /** 当前选择模式（新建 vs 重选）。 */
  initSelectMode(): InitSelectMode;
  /** 整页重建选择页（renderInitSelect）。 */
  renderInitSelect(): void;
  /** 局部替换左侧详情文案块（不动轮盘 DOM）。 */
  replaceInitDetail(): void;
  /** 绑定详情 CTA 与顶栏读档按钮。 */
  bindDetailActions(): void;
}

/** 选择页轮盘交互：本地持有聚焦项与局部刷新 API。 */
export class InitSelectPage {
  private selectedId: string | null = null;
  private stageApi: { refreshRow(initId: string): void } | null = null;

  constructor(private readonly host: InitSelectHost) {}

  /** 重置聚焦状态（进入选择页前调用）。 */
  reset(): void {
    this.selectedId = null;
    this.stageApi = null;
  }

  /** 局部替换左侧详情文案块（不动轮盘 DOM，旋转状态得以保留）。 */
  replaceInitDetail(): void {
    const { host } = this;
    const copy = host.root.querySelector('.init-orb-copy');
    if (copy) {
      copy.outerHTML = renderInitDetail(createUIContext(host.game), host.initSelectMode(), this.selectedId);
    }
    host.bindDetailActions();
  }

  /**
   * Init 选择页交互：世界线卡片像时钟刻度一样沿盘缘环绕巨大圆盘排布。
   * 已显示的 Init 视为一个有序 List，滚轮/点击驱动整组卡片绕盘心旋转，
   * 转到正右方（与详情相邻）的卡片即聚焦项。
   * 约束：
   *   - 元素间相对位置不可破坏：每张卡片持有固定「世界角」i*step，随 spin 整体旋转，永不互相穿越。
   *   - 不可聚焦到空元素：聚焦 = 转至正右方的卡片，始终有卡片就位。
   *   - 滚到 List 边缘元素再继续滚，聚焦跳到另一侧元素（环形 List，spin 环形归一化）。
   * 卡片 DOM 常驻，切换只改 transform/opacity + 局部替换左侧详情，保证过渡连续。
   */
  bindStage(): void {
    const { host } = this;
    const shell = host.root.querySelector<HTMLElement>('.init-select-shell');
    const disc = host.root.querySelector<HTMLElement>('.init-orb-disc');
    const wheelEl = host.root.querySelector<HTMLElement>('.init-wheel');
    if (!shell || !disc || !wheelEl || host.root.querySelectorAll('[data-init-select]').length === 0) {
      host.bindDetailActions();
      return;
    }
    const ids = [...host.root.querySelectorAll<HTMLButtonElement>('[data-init-select]')]
      .map(row => row.dataset.initSelect!);
    const count = ids.length;
    // 盘缘步进角（度）：小间距可容纳更多条目同屏
    const step = Math.min(360 / count, 16);
    // 累积旋转（步数）：卡片 world 角 i*step 固定，随 spin 整体旋转；
    // 聚焦 = 转至正右方的卡片；spin 环形，边缘继续滚则聚焦跳到另一侧，卡片不瞬移。
    let spin = Math.max(0, ids.indexOf(this.selectedId ?? ids[0]));
    this.selectedId = ids[spin];

    const getRows = () => [...host.root.querySelectorAll<HTMLButtonElement>('[data-init-select]')];

    /** 依当前 spin 沿盘缘排布卡片，返回聚焦卡片下标（正右方）。 */
    const apply = (): number => {
      if (!document.contains(wheelEl)) return spin;
      const d = disc!.getBoundingClientRect();
      const s = shell!.getBoundingClientRect();
      const cx = d.left - s.left + d.width / 2;
      const cy = d.top - s.top + d.height / 2;
      const radius = (d.width / 2) * 0.985;
      const rot = spin * step;

      let focus = spin;
      let bestAbs = Infinity;
      const poses = getRows().map((row, i) => {
        let angle = i * step - rot;
        // 归一化到 [-180, 180] 仅用于背面绘制，不改变卡片相对顺序
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        const abs = Math.abs(angle);
        if (abs < bestAbs) { bestAbs = abs; focus = i; }
        return { row, angle };
      });
      poses.forEach(({ row, angle }, i) => {
        const rad = angle * Math.PI / 180;
        const facing = Math.cos(rad);
        const x = cx + radius * facing;
        const y = cy + radius * Math.sin(rad);
        row.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}deg)`;
        row.style.opacity = facing <= 0.05 ? '0' : String(Math.max(0.08, facing));
        row.style.pointerEvents = facing <= 0.05 ? 'none' : 'auto';
        row.classList.toggle('is-active', i === focus);
      });
      return focus;
    };

    const bindRowClick = (row: HTMLButtonElement) => {
      row.addEventListener('click', () => {
        const i = ids.indexOf(row.dataset.initSelect!);
        if (i !== spin) rotateTo(i, true);
      });
    };

    const rotateTo = (target: number, refreshDetail: boolean) => {
      // 直接让目标卡片聚焦：spin 设为 target，卡片沿固定 world 角整体旋转到该卡片位于正右方
      spin = ((target % count) + count) % count;
      const focus = apply();
      this.selectedId = ids[focus];
      if (refreshDetail) this.replaceInitDetail();
    };

    /** 解锁等状态变化后原位同步该卡片内容：不替换节点，保留内联定位与事件绑定。 */
    const refreshRow = (initId: string) => {
      const html = renderInitRow(createUIContext(host.game), initId);
      const old = getRows().find(row => row.dataset.initSelect === initId);
      if (!html || !old) return;
      const template = document.createElement('template');
      template.innerHTML = html.trim();
      const fresh = template.content.firstElementChild as HTMLButtonElement;
      old.className = fresh.className;
      old.innerHTML = fresh.innerHTML;
      apply();
    };
    this.stageApi = { refreshRow };

    getRows().forEach(bindRowClick);

    wheelEl.parentElement?.addEventListener('wheel', event => {
      event.preventDefault();
      // 连续旋转一格：整组卡片绕盘心转动，相对位置保持；spin 环形，转到 List 边缘元素后继续滚则聚焦跳到另一侧
      spin = ((spin + ((event as WheelEvent).deltaY > 0 ? 1 : -1)) % count + count) % count;
      const focus = apply();
      this.selectedId = ids[focus];
      this.replaceInitDetail();
    }, { passive: false });

    // 视差：指针移动时背景层与卡片轻微反向漂移，形成聚焦纵深感
    const onMove = (event: MouseEvent) => {
      if (!document.contains(wheelEl)) {
        shell!.removeEventListener('mousemove', onMove);
        return;
      }
      const rect = shell!.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      shell!.style.setProperty('--par-x', nx.toFixed(3));
      shell!.style.setProperty('--par-y', ny.toFixed(3));
    };
    shell.addEventListener('mousemove', onMove);
    shell.addEventListener('mouseleave', () => {
      shell.style.setProperty('--par-x', '0');
      shell.style.setProperty('--par-y', '0');
    });

    window.addEventListener('resize', apply);
    apply();
    host.bindDetailActions();
  }

  /** 解锁等状态变化后原位同步该卡片内容（controller 的购买流程调用）。 */
  refreshRow(initId: string): void {
    this.stageApi?.refreshRow(initId);
  }

  /** 当前聚焦的世界线 id（供 controller 判断详情 CTA 是否指向选中项）。 */
  get selectedInitId(): string | null {
    return this.selectedId;
  }
}
