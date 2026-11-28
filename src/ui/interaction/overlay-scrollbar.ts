export interface OverlayScrollbarBinding {
  root: HTMLElement;
  viewport: HTMLElement;
  content?: HTMLElement;
  track: HTMLElement;
  thumb: HTMLElement;
}

export interface OverlayScrollbarController {
  refresh(): void;
  rebind(binding: OverlayScrollbarBinding): void;
  dispose(): void;
}

export interface OverlayScrollbarGroup {
  refresh(): void;
  rebind(): void;
  dispose(): void;
}

interface ThumbGeometry {
  readonly height: number;
  readonly travel: number;
  readonly range: number;
}

const controllers = new WeakMap<HTMLElement, OverlayScrollbarController>();
const groups = new WeakMap<HTMLElement, OverlayScrollbarGroup>();
const regionSelector = '[data-overlay-scrollbar]';

function scrollbarBinding(root: HTMLElement): OverlayScrollbarBinding | undefined {
  const viewport = root.querySelector<HTMLElement>('.overlay-scrollbar__viewport');
  const track = root.querySelector<HTMLElement>('.overlay-scrollbar__track');
  const thumb = track?.querySelector<HTMLElement>('.overlay-scrollbar__thumb');
  if (!viewport || !track || !thumb) return;
  return {
    root,
    viewport,
    content: root.querySelector<HTMLElement>('[data-overlay-scrollbar-content]') ?? undefined,
    track,
    thumb,
  };
}

function renderTrack(): string {
  return '<div class="overlay-scrollbar__track" aria-hidden="true"><div class="overlay-scrollbar__thumb"></div></div>';
}

/** Wraps caller-owned viewport markup without taking ownership of its scroll semantics. */
export function renderOverlayScrollbar(viewportMarkup: string, rootClass = ''): string {
  return `<div class="overlay-scrollbar${rootClass ? ` ${rootClass}` : ''}" data-overlay-scrollbar>${viewportMarkup}${renderTrack()}</div>`;
}

/** Enhances an existing native vertical scroller. The viewport remains the scroll owner. */
export function createOverlayScrollbar(initial: OverlayScrollbarBinding): OverlayScrollbarController {
  controllers.get(initial.root)?.dispose();

  let binding = initial;
  let disposed = false;
  let listeners: AbortController | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let drag: { pointerId: number; startY: number; scrollTop: number } | undefined;

  const geometry = (): ThumbGeometry | undefined => {
    const { viewport, track } = binding;
    const height = viewport.clientHeight;
    const range = viewport.scrollHeight - height;
    const trackHeight = track.clientHeight || track.getBoundingClientRect().height || height;
    if (height <= 0 || range <= 0 || trackHeight <= 0) return;
    const minThumb = Math.min(24, trackHeight);
    const thumbHeight = Math.min(trackHeight, Math.max(minThumb, height * height / viewport.scrollHeight));
    return { height: thumbHeight, travel: trackHeight - thumbHeight, range };
  };

  const releaseDrag = (): void => {
    if (!drag) return;
    const { pointerId } = drag;
    drag = undefined;
    if (binding.thumb.hasPointerCapture?.(pointerId)) binding.thumb.releasePointerCapture(pointerId);
  };

  const updateVisibility = (event: PointerEvent): void => {
    if (!geometry() || event.pointerType === 'touch') {
      binding.root.removeAttribute('data-overlay-scrollbar-visible');
      return;
    }
    if (drag) {
      binding.root.setAttribute('data-overlay-scrollbar-visible', '');
      return;
    }
    const target = event.target;
    const inside = target instanceof Node && binding.root.contains(target);
    binding.root.toggleAttribute('data-overlay-scrollbar-visible', inside);
  };

  const refresh = (): void => {
    if (disposed) return;
    const size = geometry();
    binding.root.toggleAttribute('data-overlay-scrollbar-overflow', Boolean(size));
    if (!size) {
      releaseDrag();
      binding.root.removeAttribute('data-overlay-scrollbar-visible');
      binding.thumb.style.height = '0px';
      binding.thumb.style.transform = 'translateY(0px)';
      return;
    }
    const progress = Math.max(0, Math.min(1, binding.viewport.scrollTop / size.range));
    binding.thumb.style.height = `${size.height}px`;
    binding.thumb.style.transform = `translateY(${progress * size.travel}px)`;
  };

  const onPointerMove = (event: PointerEvent): void => {
    updateVisibility(event);
  };
  const onScroll = (event: Event): void => {
    if (event.target === binding.viewport) refresh();
  };
  const onWheel = (event: WheelEvent): void => {
    const target = event.target;
    const size = geometry();
    if (!binding.track.contains(target instanceof Node ? target : null) || !size) return;
    const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? binding.viewport.clientHeight : 1;
    const previousScrollTop = binding.viewport.scrollTop;
    const nextScrollTop = Math.max(0, Math.min(size.range, previousScrollTop + event.deltaY * multiplier));
    if (nextScrollTop === previousScrollTop) return;
    binding.viewport.scrollTop = nextScrollTop;
    if (event.cancelable) event.preventDefault();
    refresh();
  };
  const onPointerDown = (event: PointerEvent): void => {
    const size = geometry();
    if (event.button !== 0 || !size?.travel || event.pointerType === 'touch') return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, startY: event.clientY, scrollTop: binding.viewport.scrollTop };
    binding.root.setAttribute('data-overlay-scrollbar-visible', '');
    binding.thumb.setPointerCapture?.(event.pointerId);
  };
  const onThumbMove = (event: PointerEvent): void => {
    if (drag?.pointerId !== event.pointerId) return;
    const size = geometry();
    if (!size?.travel) return;
    const next = drag.scrollTop + (event.clientY - drag.startY) * size.range / size.travel;
    binding.viewport.scrollTop = Math.max(0, Math.min(size.range, next));
    refresh();
  };
  const onDragEnd = (event: PointerEvent): void => {
    if (drag?.pointerId !== event.pointerId) return;
    releaseDrag();
    updateVisibility(event);
  };

  const attach = (): void => {
    listeners = new AbortController();
    const options = { signal: listeners.signal };
    binding.root.addEventListener('scroll', onScroll, { ...options, capture: true });
    // Hover detection spans the scroll region; the track itself remains pointer-transparent.
    binding.root.addEventListener('pointermove', onPointerMove, { ...options, capture: true });
    // The visible thumb is a sibling of the native viewport; forward wheel input to its scroll owner.
    binding.root.addEventListener('wheel', onWheel, { ...options, capture: true, passive: false });
    binding.root.addEventListener('pointerleave', () => {
      if (!drag) binding.root.removeAttribute('data-overlay-scrollbar-visible');
    }, options);
    binding.thumb.addEventListener('pointerdown', onPointerDown, options);
    binding.thumb.addEventListener('pointermove', onThumbMove, options);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) binding.thumb.addEventListener(type, onDragEnd, options);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(refresh);
      resizeObserver.observe(binding.viewport);
      if (binding.content && binding.content !== binding.viewport) resizeObserver.observe(binding.content);
    }
  };

  const controller: OverlayScrollbarController = {
    refresh,
    rebind(next) {
      if (disposed) return;
      const existing = controllers.get(next.root);
      if (existing && existing !== controller) existing.dispose();
      releaseDrag();
      listeners?.abort();
      resizeObserver?.disconnect();
      controllers.delete(binding.root);
      binding.root.removeAttribute('data-overlay-scrollbar-visible');
      binding = next;
      controllers.set(binding.root, controller);
      attach();
      refresh();
    },
    dispose() {
      if (disposed) return;
      releaseDrag();
      disposed = true;
      listeners?.abort();
      resizeObserver?.disconnect();
      binding.root.removeAttribute('data-overlay-scrollbar-visible');
      binding.root.removeAttribute('data-overlay-scrollbar-overflow');
      binding.thumb.style.height = '';
      binding.thumb.style.transform = '';
      controllers.delete(binding.root);
    },
  };

  controllers.set(binding.root, controller);
  attach();
  refresh();
  return controller;
}

/** Binds all opt-in regions below a stable owner and reconciles them after keyed DOM patches. */
export function bindOverlayScrollbars(owner: HTMLElement): OverlayScrollbarGroup {
  groups.get(owner)?.dispose();
  const bindings = new Map<HTMLElement, OverlayScrollbarController>();
  const rebind = (): void => {
    const roots = new Set(owner.querySelectorAll<HTMLElement>(regionSelector));
    if (owner.matches(regionSelector)) roots.add(owner);
    for (const root of roots) {
      const next = scrollbarBinding(root);
      if (!next) continue;
      const current = bindings.get(root);
      if (current) current.rebind(next);
      else bindings.set(root, createOverlayScrollbar(next));
    }
    for (const [root, controller] of bindings) {
      if (roots.has(root)) continue;
      controller.dispose();
      bindings.delete(root);
    }
  };
  rebind();
  const group: OverlayScrollbarGroup = {
    refresh() { for (const controller of bindings.values()) controller.refresh(); },
    rebind,
    dispose() {
      for (const controller of bindings.values()) controller.dispose();
      bindings.clear();
      groups.delete(owner);
    },
  };
  groups.set(owner, group);
  return group;
}

/** Refreshes already-bound regions from a product-specific update path. */
export function refreshOverlayScrollbars(owner: HTMLElement): void {
  const group = groups.get(owner);
  if (group) {
    group.rebind();
    group.refresh();
    return;
  }
  const roots = owner.querySelectorAll<HTMLElement>(regionSelector);
  if (owner.matches(regionSelector)) controllers.get(owner)?.refresh();
  for (const root of roots) controllers.get(root)?.refresh();
}
