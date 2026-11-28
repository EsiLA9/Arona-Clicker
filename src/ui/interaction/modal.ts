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
  /** 编辑器工作台外观；普通游戏弹窗保持默认样式。 */
  appearance?: 'editor';
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
  const title = opts.title ? escapeHtml(opts.title) : '';
  const dismissable = opts.dismissable ?? true;
  const panelClass = opts.panelClass ? ` ${opts.panelClass}` : '';
  const editorClass = opts.appearance === 'editor' ? ' editor-modal-panel' : '';
  const editorOverlayClass = opts.appearance === 'editor' ? ' editor-modal-overlay' : '';
  const editorHeadClass = opts.appearance === 'editor' ? ' editor-modal-head' : '';
  const editorBodyClass = opts.appearance === 'editor' ? ' editor-modal-body' : '';
  const editorFootClass = opts.appearance === 'editor' ? ' editor-modal-foot' : '';
  const overlayClass = opts.panelClass === 'user-theme-modal' ? ' modal-overlay-user-theme' : '';
  const headClass = opts.panelClass === 'user-theme-modal' ? ' modal-head-user-theme' : '';
  return `
    <div class="modal-overlay${overlayClass}${editorOverlayClass}" ${dismissable ? 'data-modal-overlay' : ''}>
      <section class="modal-panel${editorClass}${panelClass}" role="dialog" aria-modal="true"${title ? ` aria-label="${title}"` : ''}${width}>
        <header class="modal-head${headClass}${editorHeadClass}" ${opts.panelClass === 'user-theme-modal' ? 'data-user-theme-drag' : ''}>
          <span class="eyebrow">${title}</span>
          <button class="modal-close icon-button${opts.appearance === 'editor' ? ' editor-modal-close' : ''}" aria-label="关闭" title="关闭">×</button>
        </header>
        <div class="modal-body${editorBodyClass}">${opts.body}</div>
        ${opts.footer ? `<footer class="modal-foot${editorFootClass}">${opts.footer}</footer>` : ''}
      </section>
    </div>`;
}

export class ModalManager {
  private el: HTMLElement | null = null;
  private closeHandler: (() => void) | undefined;
  private actionHandler: ((action: string) => void) | undefined;
  private dismissable = true;
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.dismissable) this.close();
  };

  /** 打开弹窗（重复 open 会替换内容）。 */
  open(opts: ModalOptions): HTMLElement {
    this.ensureContainer();
    this.el!.innerHTML = renderModalShell(opts);
    this.el!.classList.add('is-open');
    this.dismissable = opts.dismissable ?? true;
    this.closeHandler = opts.onClose;
    this.actionHandler = opts.onAction;
    return this.el!.querySelector<HTMLElement>('.modal-panel')!;
  }

  close(): void {
    if (!this.el || !this.el.classList.contains('is-open')) return;
    this.el.classList.remove('is-open');
    this.el.innerHTML = '';
    const handler = this.closeHandler;
    this.closeHandler = undefined;
    this.actionHandler = undefined;
    this.dismissable = true;
    handler?.();
  }

  isOpen(): boolean {
    return this.el?.classList.contains('is-open') ?? false;
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKeydown);
    this.el?.remove();
    this.el = null;
    this.closeHandler = undefined;
    this.actionHandler = undefined;
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
    document.addEventListener('keydown', this.onKeydown);
  }
}
