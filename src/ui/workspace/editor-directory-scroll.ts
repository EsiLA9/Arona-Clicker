import type { UIContext } from '../runtime/context';
import { bindOverlayScrollbars, refreshOverlayScrollbars, renderOverlayScrollbar } from '../interaction/overlay-scrollbar';

export function renderEditorDirectoryScroll(ctx: UIContext, key: string, listKey: string, className: string, content: string): string {
  const e = ctx.escapeHtml;
  return `<div class="editor-directory-scroll" data-editor-key="scroll:${e(key)}">${renderOverlayScrollbar(`
    <div class="editor-directory-scroll-body overlay-scrollbar__viewport ${className}" data-scroll-owner="content-region" data-scroll-key="${e(key)}" data-editor-key="${e(listKey)}">
      <div class="overlay-scrollbar__content" data-overlay-scrollbar-content>${content}</div>
    </div>`)}
  </div>`;
}

export function refreshEditorDirectoryScrollbars(root: HTMLElement): void {
  refreshOverlayScrollbars(root);
}

export function bindEditorDirectoryScrollbars(root: HTMLElement): () => void {
  const controller = bindOverlayScrollbars(root);
  return () => controller.dispose();
}
