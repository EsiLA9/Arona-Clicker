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
  private stack: HTMLElement | null = null;
  private collapseButton: HTMLButtonElement | null = null;
  private collapsed = false;
  private seq = 0;

  /** 显示一条 toast 通知。text 支持简单的内联 HTML（仅为强调加粗）。 */
  show(text: string, level: ToastLevel = 'info'): void {
    this.ensureContainer();
    const toast: PendingToast = { id: ++this.seq, text, level };
    this.renderOne(toast);
    this.clamp();
    this.updateCollapseButton();
    setTimeout(() => this.dismiss(toast.id), DISMISS_MS);
  }

  showAction(key: string, text: string, label: string, action: () => void): void {
    this.ensureContainer();
    const selector = `[data-toast-action-key="${CSS.escape(key)}"]`;
    let el = this.container!.querySelector<HTMLElement>(selector);
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-message toast-info toast-action';
      el.dataset.toastActionKey = key;
      this.stack!.appendChild(el);
    }
    el.innerHTML = `<span>${text}</span><button type="button" class="toolbar-button">${label}</button>`;
    el.querySelector('button')?.addEventListener('click', () => {
      this.removeAction(key);
      action();
    }, { once: true });
    this.updateCollapseButton();
  }

  removeAction(key: string): void {
    this.container?.querySelector<HTMLElement>(`[data-toast-action-key="${CSS.escape(key)}"]`)?.remove();
    this.updateCollapseButton();
  }

  private toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.container?.classList.toggle('toast-collapsed', this.collapsed);
    this.updateCollapseButton();
  }

  private ensureContainer(): void {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-layer';
    this.collapseButton = document.createElement('button');
    this.collapseButton.type = 'button';
    this.collapseButton.className = 'toast-collapse';
    this.collapseButton.setAttribute('aria-controls', 'toast-stack');
    this.collapseButton.addEventListener('click', () => this.toggleCollapsed());
    this.stack = document.createElement('div');
    this.stack.id = 'toast-stack';
    this.stack.className = 'toast-stack';
    this.container.append(this.collapseButton, this.stack);
    document.body.appendChild(this.container);
    this.updateCollapseButton();
  }

  private renderOne(t: PendingToast): void {
    if (!this.stack) return;
    const el = document.createElement('div');
    el.className = `toast-message toast-${t.level}`;
    el.dataset.toastId = String(t.id);
    el.innerHTML = t.text;
    this.stack.appendChild(el);
  }

  private dismiss(id: number): void {
    if (!this.container) return;
    const el = this.stack?.querySelector<HTMLElement>(`[data-toast-id="${id}"]`);
    if (!el) return;
    el.classList.add('toast-fade');
    // 等过渡结束后移除
    el.addEventListener('transitionend', () => {
      el.remove();
      this.updateCollapseButton();
    }, { once: true });
    // 兜底：600ms 后强制移除
    setTimeout(() => {
      if (el.parentNode) {
        el.remove();
        this.updateCollapseButton();
      }
    }, 650);
  }

  /** 超过可见上限则移除最旧的 toast。 */
  private clamp(): void {
    if (!this.container) return;
    const items = this.stack?.querySelectorAll('.toast-message:not(.toast-fade)') ?? [];
    if (items.length <= MAX_VISIBLE) return;
    for (let i = 0; i < items.length - MAX_VISIBLE; i++) {
      (items[i] as HTMLElement).remove();
    }
  }

  private updateCollapseButton(): void {
    if (!this.collapseButton || !this.container) return;
    const count = this.stack?.querySelectorAll('.toast-message:not(.toast-fade)').length ?? 0;
    this.container.classList.toggle('toast-collapsed', this.collapsed);
    this.collapseButton.textContent = this.collapsed ? '‹' : '›';
    this.collapseButton.setAttribute('aria-expanded', String(!this.collapsed));
    this.collapseButton.setAttribute('aria-label', this.collapsed
      ? `展开通知${count > 0 ? `（${count} 条）` : ''}`
      : '向右收起通知');
    this.collapseButton.title = this.collapsed ? '展开通知' : '向右收起通知';
  }
}
