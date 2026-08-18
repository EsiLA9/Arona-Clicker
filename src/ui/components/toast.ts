// ============================================================
// ui/components/toast.ts — 全局 Toast 通知服务
// ============================================================
// 统一入口：UIController.toast.show('消息', 'success'|'error'|'info')
// Toast 挂载在 body 上，独立于 #app 的 render() 重建周期。

export type ToastLevel = 'success' | 'error' | 'info';

interface PendingToast {
  id: number;
  text: string;
  level: ToastLevel;
}

const DISMISS_MS = 2500;
const MAX_VISIBLE = 4;

export class ToastService {
  private container: HTMLElement | null = null;
  private seq = 0;

  /** 显示一条 toast 通知。text 支持简单的内联 HTML（仅为强调加粗）。 */
  show(text: string, level: ToastLevel = 'info'): void {
    this.ensureContainer();
    const toast: PendingToast = { id: ++this.seq, text, level };
    this.renderOne(toast);
    this.clamp();
    setTimeout(() => this.dismiss(toast.id), DISMISS_MS);
  }

  private ensureContainer(): void {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-layer';
    document.body.appendChild(this.container);
  }

  private renderOne(t: PendingToast): void {
    if (!this.container) return;
    const el = document.createElement('div');
    el.className = `toast-message toast-${t.level}`;
    el.dataset.toastId = String(t.id);
    el.innerHTML = t.text;
    this.container.appendChild(el);
  }

  private dismiss(id: number): void {
    if (!this.container) return;
    const el = this.container.querySelector<HTMLElement>(`[data-toast-id="${id}"]`);
    if (!el) return;
    el.classList.add('toast-fade');
    // 等过渡结束后移除
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // 兜底：600ms 后强制移除
    setTimeout(() => { if (el.parentNode) el.remove(); }, 650);
  }

  /** 超过可见上限则移除最旧的 toast。 */
  private clamp(): void {
    if (!this.container) return;
    const items = this.container.querySelectorAll('.toast-message:not(.toast-fade)');
    if (items.length <= MAX_VISIBLE) return;
    for (let i = 0; i < items.length - MAX_VISIBLE; i++) {
      (items[i] as HTMLElement).remove();
    }
  }
}
