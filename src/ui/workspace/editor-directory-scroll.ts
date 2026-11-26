import type { UIContext } from '../runtime/context';

export function renderEditorDirectoryScroll(ctx: UIContext, key: string, listKey: string, className: string, content: string): string {
  const e = ctx.escapeHtml;
  return `<div class="editor-directory-scroll" data-editor-key="scroll:${e(key)}">
    <div class="editor-directory-scroll-body ${className}" data-scroll-owner="content-region" data-scroll-key="${e(key)}" data-editor-key="${e(listKey)}">
      <div data-editor-directory-scroll-content>${content}</div>
    </div>
    <div class="editor-directory-thumb" data-editor-directory-thumb aria-hidden="true"></div>
  </div>`;
}

const scrollRegion = '.editor-directory-scroll';

function geometry(list: HTMLElement) {
  const height = list.clientHeight;
  const range = list.scrollHeight - height;
  if (height <= 0 || range <= 0) return;
  const thumb = Math.max(Math.min(22, height / 2), height * height / list.scrollHeight);
  return { thumb, travel: height - thumb, range };
}

function update(list: HTMLElement, thumb: HTMLElement): void {
  const size = geometry(list);
  thumb.toggleAttribute('data-overflow', Boolean(size));
  if (!size) return;
  thumb.style.height = `${size.thumb}px`;
  const progress = Math.max(0, Math.min(1, list.scrollTop / size.range));
  thumb.style.transform = `translateY(${progress * size.travel}px)`;
}

export function refreshEditorDirectoryScrollbars(root: HTMLElement): void {
  for (const region of root.querySelectorAll<HTMLElement>(scrollRegion)) {
    update(region.querySelector<HTMLElement>('[data-scroll-key]')!, region.querySelector<HTMLElement>('[data-editor-directory-thumb]')!);
  }
}

export function bindEditorDirectoryScrollbars(root: HTMLElement): () => void {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const observers: ResizeObserver[] = [];
  for (const region of root.querySelectorAll<HTMLElement>(scrollRegion)) {
    const list = region.querySelector<HTMLElement>('[data-scroll-key]')!;
    const thumb = region.querySelector<HTMLElement>('[data-editor-directory-thumb]')!;
    const refresh = () => update(list, thumb);
    let drag: { pointerId: number; startY: number; scrollTop: number } | undefined;
    list.addEventListener('scroll', refresh, options);
    thumb.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !geometry(list)?.travel) return;
      event.preventDefault();
      drag = { pointerId: event.pointerId, startY: event.clientY, scrollTop: list.scrollTop };
      thumb.setPointerCapture?.(event.pointerId);
    }, options);
    thumb.addEventListener('pointermove', event => {
      if (drag?.pointerId !== event.pointerId) return;
      const size = geometry(list);
      if (!size?.travel) return;
      list.scrollTop = drag.scrollTop + (event.clientY - drag.startY) * size.range / size.travel;
      refresh();
    }, options);
    const release = (event: PointerEvent) => { if (drag?.pointerId === event.pointerId) drag = undefined; };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) thumb.addEventListener(name, release, options);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(refresh);
      observer.observe(list);
      observer.observe(list.querySelector<HTMLElement>('[data-editor-directory-scroll-content]')!);
      observers.push(observer);
    }
    refresh();
  }
  return () => {
    abort.abort();
    for (const observer of observers) observer.disconnect();
  };
}
