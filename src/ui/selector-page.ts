// ============================================================
// ui/selector-page.ts — 选择页（Init ⇄ GlobalEnhancement 翻面）
// 双面叠放于同一视口，共享一个可左右滑动的圆盘。
// 翻面动画：先淡出当前面条项与文本 → 圆盘左右滑动 → 圆盘落位后
// 重排目标面条项（relayout）再淡入。切换期间只移动圆盘，条项与文本由
// 淡入淡出承接，避免错位与文字堆叠。
// Init 面聚焦盘右缘，GlobalEnhancement 面聚焦盘左缘（镜像、方向相反）。
// 轮盘层（.wheel-init/.wheel-enh）挂在 shell 顶部覆盖整页，翻面时与文本面同步淡入淡出/显隐。
// ============================================================

import type { GameReadModel } from '../arona-clicker/contracts';
import { createUIContext } from './context';
import type { InitSelectMode } from './components/init-select';
import { renderInitDetail, renderInitRow } from './components/init-select';
import type { SelectionFace } from './components/global-enhancement-select';
import { renderGlobalEnhancementDetail, renderGlobalEnhancementRow } from './components/global-enhancement-select';
import type { PopoverManager } from './popovers';

/** controller 暴露给选择页的回调（避免反向依赖）。 */
export interface SelectorHost {
  game: GameReadModel;
  root: HTMLElement;
  popovers: PopoverManager;
  initSelectMode(): InitSelectMode;
  showBackToGame(): boolean;
  bindDetailActions(): void;
  bindGlobalEnhancementDetailActions(): void;
  bindSelectorCommonActions(): void;
  renderSelectorPage(face: SelectionFace): void;
}

interface WheelApi {
  refreshRow(id: string): void;
  /** 按当前圆盘坐标重排全部条项（隐藏面切到前台、窗口尺寸变化时调用）。 */
  relayout(): void;
}

/** 与 css/selectors.css 中 .selector-face 过渡 / 圆盘 transform 过渡保持一致。 */
const FADE_MS = 180;
const DISC_MS = 420;

/** SelectionFace → DOM 面向 class 后缀（global-enh → enh）。 */
function faceClass(face: SelectionFace): string {
  return face === 'global-enh' ? 'enh' : 'init';
}

/** 选择页装配：双面叠放 + 共享圆盘，翻面动画（淡出 → 滑盘 → 重排 → 淡入）。 */
export class SelectorPage {
  private initSelectedId: string | null = null;
  private enhSelectedId: string | null = null;
  private face: SelectionFace = 'init';
  private initWheel: WheelApi | null = null;
  private enhWheel: WheelApi | null = null;
  private flipSeq = 0;

  constructor(private readonly host: SelectorHost) {
    // ←/→ 方向键翻面（仅当选择页在 DOM 时生效）
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (!host.root.querySelector('.selector-shell')) return;
      e.preventDefault();
      this.slideTo(e.key === 'ArrowRight' ? 'global-enh' : 'init');
    });
    // 窗口尺寸变化后按当前圆盘坐标重排可见面条项
    window.addEventListener('resize', () => {
      if (this.face === 'global-enh') this.enhWheel?.relayout();
      else this.initWheel?.relayout();
    });
  }

  /** 重置轮盘状态（进入选择页前调用）；选中项跨翻面保留。 */
  reset(): void {
    this.face = 'init';
    this.initWheel = null;
    this.enhWheel = null;
  }

  get currentFace(): SelectionFace { return this.face; }
  get selectedInitId(): string | null { return this.initSelectedId; }
  get selectedEnhId(): string | null { return this.enhSelectedId; }

  /** 切换到指定面：淡出当前面 → 滑动圆盘 → 重排目标面并淡入。 */
  slideTo(face: SelectionFace): void {
    if (this.face === face) return;
    const { root } = this.host;
    const shell = root.querySelector<HTMLElement>('.selector-shell');
    const oldEl = root.querySelector<HTMLElement>(`.selector-face.face-${faceClass(this.face)}`);
    const newEl = root.querySelector<HTMLElement>(`.selector-face.face-${faceClass(face)}`);
    const oldWheel = root.querySelector<HTMLElement>(`.wheel-${faceClass(this.face)}`);
    const newWheel = root.querySelector<HTMLElement>(`.wheel-${faceClass(face)}`);
    if (!shell || !oldEl || !newEl) return;

    // 防连点：新切换令旧定时器失效，并清掉上次中断残留的中间态
    const seq = ++this.flipSeq;
    this.face = face;
    root.querySelectorAll('.selector-face.is-fading, .init-wheel.is-fading').forEach(el => el.classList.remove('is-fading'));

    const isEnh = face === 'global-enh';
    // 1) 淡出当前面条项与文本
    oldEl.classList.add('is-fading');
    oldWheel?.classList.add('is-fading');
    window.setTimeout(() => {
      if (seq !== this.flipSeq) return;
      // 2) 只滑动圆盘，交换可见面
      shell.classList.toggle('init-mode', !isEnh);
      shell.classList.toggle('enh-mode', isEnh);
      oldEl.classList.remove('is-fading');
      oldEl.classList.add('is-inactive');
      oldWheel?.classList.remove('is-fading');
      oldWheel?.classList.add('is-inactive');
      window.setTimeout(() => {
        if (seq !== this.flipSeq) return;
        // 3) 圆盘落位后按新坐标重排目标面条项，再淡入
        (isEnh ? this.enhWheel : this.initWheel)?.relayout();
        newEl.classList.remove('is-inactive');
        newWheel?.classList.remove('is-inactive');
        this.syncTopbar();
      }, DISC_MS);
    }, FADE_MS);
  }

  /** 局部替换当前可见面的详情文案块（旋转后详情随聚焦刷新）。 */
  replaceCurrentDetail(): void {
    if (this.face === 'global-enh') {
      this.replaceEnhDetail();
    } else {
      this.replaceInitDetail();
    }
  }

  /** 局部替换 Init 面详情文案块（不动轮盘 DOM，旋转状态得以保留）。 */
  replaceInitDetail(): void {
    const copy = this.host.root.querySelector('.face-init .init-orb-copy');
    if (copy) {
      copy.outerHTML = renderInitDetail(createUIContext(this.host.game), this.host.initSelectMode(), this.initSelectedId);
    }
    this.host.bindDetailActions();
  }

  /** 局部替换 GlobalEnhancement 面详情文案块。 */
  replaceEnhDetail(): void {
    const copy = this.host.root.querySelector('.face-enh .enh-orb-copy');
    if (copy) {
      copy.outerHTML = renderGlobalEnhancementDetail(createUIContext(this.host.game), this.enhSelectedId, this.host.showBackToGame());
    }
    this.host.bindGlobalEnhancementDetailActions();
  }

  /** 解锁/购买等状态变化后原位同步该卡片内容（controller 调用）。 */
  refreshInitRow(initId: string): void { this.initWheel?.refreshRow(initId); }
  refreshEnhRow(enhId: string): void { this.enhWheel?.refreshRow(enhId); }

  /** 装配两面向：各自轮盘定位 + 详情 CTA 与顶栏（一次只显示 initialFace）。 */
  bindStage(initialFace: SelectionFace): void {
    this.face = initialFace;
    this.initWheel = this.bindWheel('init');
    this.enhWheel = this.bindWheel('global-enh');
    this.host.bindDetailActions();
    this.host.bindGlobalEnhancementDetailActions();
    this.host.bindSelectorCommonActions();
    this.bindParallax();
  }

  /** 鼠标视差：光标相对圆盘中心的位置写入 --par-x/--par-y，条项与圆盘据此轻微偏移（仅视觉，不改选中）。 */
  private bindParallax(): void {
    const root = this.host.root;
    const shell = root.querySelector<HTMLElement>('.selector-shell');
    const disc = root.querySelector<HTMLElement>('.init-orb-disc');
    if (!shell || !disc) return;

    const setPar = (x: string, y: string) => {
      shell.style.setProperty('--par-x', x);
      shell.style.setProperty('--par-y', y);
    };
    // 挂在 shell 上以覆盖圆盘中心区域（圆盘可能位于 viewport 之上）
    shell.addEventListener('mousemove', (e: MouseEvent) => {
      const r = disc.getBoundingClientRect();
      const radius = r.width / 2 || 1;
      const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / radius));
      const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / radius));
      setPar(dx.toFixed(3), dy.toFixed(3));
    });
    shell.addEventListener('mouseleave', () => setPar('0', '0'));
  }

  private syncTopbar(): void {
    const label = this.host.root.querySelector<HTMLElement>('[data-flip-label]');
    const status = this.host.root.querySelector<HTMLElement>('[data-face-status]');
    if (label) label.textContent = this.face === 'global-enh' ? '世界线' : '全局强化';
    if (status) {
      const restarting = this.host.initSelectMode() === 'restart';
      status.textContent = this.face === 'global-enh'
        ? 'GLOBAL ENH'
        : `WORLD LINE · ${restarting ? 'RESTART' : 'NEW GAME'}`;
    }
  }

  /** 单个面的轮盘装配：卡片沿盘缘固定「世界角」i*step，随 spin 整体旋转；聚焦 = 转至盘缘视点的卡片。 */
  private bindWheel(face: SelectionFace): WheelApi | null {
    const isEnh = face === 'global-enh';
    const rowSel = isEnh ? '[data-global-enh-select]' : '[data-init-select]';
    const wheelEl = this.host.root.querySelector<HTMLElement>(isEnh ? '.wheel-enh' : '.wheel-init');
    const disc = this.host.root.querySelector<HTMLElement>('.init-orb-disc');
    if (!wheelEl || !disc || this.host.root.querySelectorAll(rowSel).length === 0) return null;

    const ids = [...this.host.root.querySelectorAll<HTMLButtonElement>(rowSel)]
      .map(row => row.dataset[isEnh ? 'globalEnhSelect' : 'initSelect']!);
    const count = ids.length;
    // 盘缘步进角（度）：小间距可容纳更多条目同屏
    const step = Math.min(360 / count, 16);
    const initial = isEnh ? this.enhSelectedId : this.initSelectedId;
    let spin = Math.max(0, ids.indexOf(initial ?? ids[0]));
    this.setSelected(isEnh, ids[spin]);

    const getRows = () => [...this.host.root.querySelectorAll<HTMLButtonElement>(rowSel)];

    /** 依当前 spin 沿盘缘排布卡片，返回聚焦卡片下标（Init=正右方；Enh=镜像正左方）。 */
    const apply = (): number => {
      if (!document.contains(wheelEl)) return spin;
      // 共享圆盘中心：以本面轮盘（与所在面向同宽）为坐标系测量
      const w = wheelEl.getBoundingClientRect();
      const d = disc.getBoundingClientRect();
      const cx = d.left - w.left + d.width / 2;
      const cy = d.top - w.top + d.height / 2;
      const radius = (d.width / 2) * 0.985;
      const rot = spin * step;

      let focus = spin;
      let bestAbs = Infinity;
      const poses = getRows().map((row, i) => {
        let angle = i * step - rot;
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        const abs = Math.abs(angle);
        if (abs < bestAbs) { bestAbs = abs; focus = i; }
        return { row, angle };
      });
      poses.forEach(({ row, angle }, i) => {
        const rad = angle * Math.PI / 180;
        const facing = Math.cos(rad);
        // 增强面镜像：x 取反，聚焦落在盘左缘（与 Init 相反），旋转角同步取反使条项中线指向圆心
        const x = isEnh ? cx - radius * facing : cx + radius * facing;
        const y = cy + radius * Math.sin(rad);
        const tilt = isEnh ? -angle : angle;
        row.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${tilt}deg)`;
        row.style.opacity = facing <= 0.05 ? '0' : String(Math.max(0.08, facing));
        row.style.pointerEvents = facing <= 0.05 ? 'none' : 'auto';
        row.classList.toggle('is-active', i === focus);
      });
      return focus;
    };

    /** 按当前圆盘坐标重排：先禁用过渡（避免从旧盘位“漂移”到新盘位），提交后再恢复。 */
    const relayout = (): void => {
      const rows = getRows();
      rows.forEach(row => row.style.transition = 'none');
      apply();
      void wheelEl.getBoundingClientRect(); // 强制同步，让“无过渡”的定位先提交
      rows.forEach(row => row.style.transition = '');
    };

    const bindRowClick = (row: HTMLButtonElement) => {
      row.addEventListener('click', () => {
        const i = ids.indexOf(row.dataset[isEnh ? 'globalEnhSelect' : 'initSelect']!);
        if (i !== spin) rotateTo(i, true);
      });
    };

    const rotateTo = (target: number, refreshDetail: boolean) => {
      spin = ((target % count) + count) % count;
      const focus = apply();
      this.setSelected(isEnh, ids[focus]);
      if (refreshDetail) { if (isEnh) this.replaceEnhDetail(); else this.replaceInitDetail(); }
    };

    /** 状态变化后原位同步该卡片内容：不替换节点，保留内联定位与事件绑定。 */
    const refreshRow = (id: string) => {
      const html = isEnh
        ? renderGlobalEnhancementRow(createUIContext(this.host.game), id)
        : renderInitRow(createUIContext(this.host.game), id);
      const old = getRows().find(row => row.dataset[isEnh ? 'globalEnhSelect' : 'initSelect'] === id);
      if (!html || !old) return;
      const template = document.createElement('template');
      template.innerHTML = html.trim();
      const fresh = template.content.firstElementChild as HTMLButtonElement;
      old.className = fresh.className;
      old.innerHTML = fresh.innerHTML;
      apply();
    };

    getRows().forEach(bindRowClick);

    wheelEl.parentElement?.addEventListener('wheel', event => {
      event.preventDefault();
      // 连续旋转一格：整组卡片绕盘心转动，相对位置保持；spin 环形，边缘继续滚则聚焦跳到另一侧
      spin = ((spin + ((event as WheelEvent).deltaY > 0 ? 1 : -1)) % count + count) % count;
      const focus = apply();
      this.setSelected(isEnh, ids[focus]);
      if (isEnh) this.replaceEnhDetail(); else this.replaceInitDetail();
    }, { passive: false });

    apply();
    return { refreshRow, relayout };
  }

  private setSelected(isEnh: boolean, id: string): void {
    if (isEnh) this.enhSelectedId = id; else this.initSelectedId = id;
  }
}
