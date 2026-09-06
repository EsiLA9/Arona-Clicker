// ============================================================
// ui/modal.ts — 弹窗母版（ModalManager）
//
// 供全站复用的模态弹窗：遮罩 + 面板 + 标题 + 内容体 + 底部操作区。
// 用法：
//   const modal = new ModalManager();
//   modal.open({ title, body, footer?, onClose? });
//   modal.close();
//
// 关闭方式：右上角 ×、点击遮罩、Esc（dismissable 为 false 时禁用 Esc/遮罩）。
// 挂载于 body 级（同 floating-tooltip），不随 #app 重建而丢失。
// ============================================================

export interface ModalOptions {
  id?: string;
  /** 标题（自动转义）。 */
  title?: string;
  /** 内容体 HTML。 */
  body: string;
  /** 底部操作区 HTML（如确认/取消按钮）。 */
  footer?: string;
  /** 面板最大宽度（px）。 */
  width?: number;
  /** 仅用于需要专用布局的弹窗面板。 */
  panelClass?: string;
  /** 是否可关闭（Esc + 遮罩点击）。默认 true。 */
  dismissable?: boolean;
  onClose?: () => void;
  onAction?: (action: string) => void;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!));
}

/** 渲染弹窗骨架（供复用/测试）。 */
export function renderModalShell(opts: ModalOptions): string {
  const width = opts.width ? ` style="max-width:${opts.width}px"` : '';
  const dismissable = opts.dismissable ?? true;
  const panelClass = opts.panelClass ? ` ${opts.panelClass}` : '';
  const overlayClass = opts.panelClass === 'user-theme-modal' ? ' modal-overlay-user-theme' : '';
  const headClass = opts.panelClass === 'user-theme-modal' ? ' modal-head-user-theme' : '';
  return `
    <div class="modal-overlay${overlayClass}" ${dismissable ? 'data-modal-overlay' : ''}>
      <section class="modal-panel${panelClass}" role="dialog" aria-modal="true"${width}>
        <header class="modal-head${headClass}" ${opts.panelClass === 'user-theme-modal' ? 'data-user-theme-drag' : ''}>
          <span class="eyebrow">${opts.title ? escapeHtml(opts.title) : ''}</span>
          <button class="modal-close icon-button" aria-label="关闭" title="关闭">×</button>
        </header>
        <div class="modal-body">${opts.body}</div>
        ${opts.footer ? `<footer class="modal-foot">${opts.footer}</footer>` : ''}
      </section>
    </div>`;
}

export class ModalManager {
  private el: HTMLElement | null = null;
  private closeHandler: (() => void) | undefined;
  private actionHandler: ((action: string) => void) | undefined;

  /** 打开弹窗（重复 open 会替换内容）。 */
  open(opts: ModalOptions): void {
    this.ensureContainer();
    this.el!.innerHTML = renderModalShell(opts);
    this.el!.classList.add('is-open');
    this.closeHandler = opts.onClose;
    this.actionHandler = opts.onAction;
  }

  close(): void {
    if (!this.el || !this.el.classList.contains('is-open')) return;
    this.el.classList.remove('is-open');
    this.el.innerHTML = '';
    const handler = this.closeHandler;
    this.closeHandler = undefined;
    this.actionHandler = undefined;
    handler?.();
  }

  isOpen(): boolean {
    return this.el?.classList.contains('is-open') ?? false;
  }

  private ensureContainer(): void {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'app-modal';
    document.body.appendChild(this.el);

    // 关闭：右上角 ×、点击遮罩（仅 dismissable）、Esc
    this.el.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.matches('.modal-close')) {
        this.close();
        return;
      }
      const action = target.dataset.modalAction;
      if (action) {
        this.actionHandler?.(action);
        return;
      }
      if (target.matches('[data-modal-overlay]')) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.close();
    });
  }
}
