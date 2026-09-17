// ============================================================
// ui/runtime-editor/subdialog.ts — 子编辑弹窗宿主
//
// 独立于 ModalManager 的二级弹窗：在编辑器主窗口之上
// 再开一层；需要继续编辑嵌套集合时使用可回退的子弹窗栈。
// 挂载于 body，不随 #app 重建丢失。
// ============================================================

export interface SubDialogOptions {
  title: string;
  body: string;
  footer?: string;
  /** replace 替换当前层；push 保留当前层，关闭后回到父级。 */
  mode?: 'replace' | 'push';
  /** 关闭回调（× / 遮罩 / Esc）。 */
  onClose?: () => void;
}

interface SubDialogFrame {
  readonly host: HTMLElement;
  readonly closeHandler: (() => void) | undefined;
}

const frames: SubDialogFrame[] = [];
let keydownAttached = false;

/** 打开子编辑弹窗；replace 替换当前层，push 保留当前层供关闭后恢复。 */
export function openSubDialog(options: SubDialogOptions): HTMLElement {
  if (options.mode === 'push') {
    frames.at(-1)?.host.remove();
  } else {
    const current = frames.pop();
    current?.host.remove();
  }
  const host = document.createElement('div');
  host.className = 'runtime-subdialog';
  host.innerHTML = `
    <div class="runtime-subdialog-overlay" data-runtime-subdialog-overlay>
      <section class="runtime-subdialog-panel" role="dialog" aria-modal="true">
        <header class="runtime-subdialog-head">
          <strong>${escapeHtml(options.title)}</strong>
          <button type="button" class="icon-button" data-runtime-subdialog-close aria-label="关闭" title="关闭">×</button>
        </header>
        <div class="runtime-subdialog-body">${options.body}</div>
        ${options.footer ? `<footer class="runtime-subdialog-foot">${options.footer}</footer>` : ''}
      </section>
    </div>`;
  frames.push({ host, closeHandler: options.onClose });
  document.body.appendChild(host);
  host.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-runtime-subdialog-close]')) {
      closeSubDialog();
      return;
    }
    if (target.matches('[data-runtime-subdialog-overlay]')) closeSubDialog();
  });
  if (!keydownAttached) {
    document.addEventListener('keydown', onKeydown, true);
    keydownAttached = true;
  }
  return host;
}

/** 关闭子编辑弹窗；invokeClose 为 false 时不触发 onClose（内部替换窗口用）。 */
export function closeSubDialog(invokeClose = true): void {
  const frame = frames.pop();
  if (!frame) return;
  frame.host.remove();
  const parent = frames.at(-1);
  if (parent) {
    document.body.appendChild(parent.host);
  } else if (keydownAttached) {
    document.removeEventListener('keydown', onKeydown, true);
    keydownAttached = false;
  }
  const handler = frame.closeHandler;
  if (invokeClose) handler?.();
}

/** 当前子编辑弹窗的宿主节点；未打开时为 null。 */
export function subDialogElement(): HTMLElement | null {
  return frames.at(-1)?.host ?? null;
}

/** 外层 Runtime Editor 关闭时清空所有子弹窗，不触发逐层回退回调。 */
export function clearSubDialogs(): void {
  while (frames.length > 0) closeSubDialog(false);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  closeSubDialog();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}
