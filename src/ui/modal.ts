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
  /** 是否可关闭（Esc + 遮罩点击）。默认 true。 */
  dismissable?: boolean;
  onClose?: () => void;
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
  return `
    <div class="modal-overlay" ${dismissable ? 'data-modal-overlay' : ''}>
      <section class="modal-panel" role="dialog" aria-modal="true"${width}>
        <header class="modal-head">
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

  /** 打开弹窗（重复 open 会替换内容）。 */
  open(opts: ModalOptions): void {
    this.ensureContainer();
    this.el!.innerHTML = renderModalShell(opts);
    this.el!.classList.add('is-open');
    this.closeHandler = opts.onClose;
  }

  close(): void {
    if (!this.el || !this.el.classList.contains('is-open')) return;
    this.el.classList.remove('is-open');
    this.el.innerHTML = '';
    const handler = this.closeHandler;
    this.closeHandler = undefined;
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
      if (target.matches('[data-modal-overlay]')) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.close();
    });
  }
}
