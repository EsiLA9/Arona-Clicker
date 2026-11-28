import { bindOverlayScrollbars, renderOverlayScrollbar } from '../interaction/overlay-scrollbar';

/** Wraps a Game column's existing native scroll owner in the shared visual scrollbar. */
export function renderGameColumnScroll(viewportClass: string, content: string): string {
  return renderOverlayScrollbar(`<div class="${viewportClass} overlay-scrollbar__viewport" data-scroll-owner="content-region">
    <div class="game-column-scroll__content overlay-scrollbar__content" data-overlay-scrollbar-content>${content}</div>
  </div>`, 'game-column-scroll');
}

/** Keeps shared controllers aligned with semantic column content replacement. */
export function bindGameColumnScrollbars(root: HTMLElement) {
  const group = bindOverlayScrollbars(root);
  return {
    afterContentUpdate: () => group.rebind(),
    dispose: () => group.dispose(),
  };
}
