export interface OverlayDragHost {
  readonly panel: HTMLElement;
  readonly handle: HTMLElement;
}

/** 让浮层标题栏可拖动；位置只作用于当前 DOM 生命周期，不写入存档或 localStorage。 */
export function bindOverlayDrag(panel: HTMLElement, handle: HTMLElement | null): void {
  if (!handle || handle.dataset.overlayDragBound === 'true') return;
  handle.dataset.overlayDragBound = 'true';
  handle.classList.add('is-overlay-drag-handle');
  let drag: { pointerId: number; offsetX: number; offsetY: number } | null = null;
  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
  const move = (clientX: number, clientY: number): void => {
    if (!drag) return;
    const rect = panel.getBoundingClientRect();
    // 无布局尺寸（jsdom/happy-dom 或未渲染）时不做边界压缩，避免拖动被锁死在 0。
    const maxLeft = rect.width > 0 ? Math.max(0, window.innerWidth - rect.width) : window.innerWidth;
    const maxTop = rect.height > 0 ? Math.max(0, window.innerHeight - rect.height) : window.innerHeight;
    panel.style.transform = 'none';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${Math.round(clamp(clientX - drag.offsetX, 0, maxLeft))}px`;
    panel.style.top = `${Math.round(clamp(clientY - drag.offsetY, 0, maxTop))}px`;
  };
  handle.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = panel.getBoundingClientRect();
    drag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (drag && event.pointerId === drag.pointerId) move(event.clientX, event.clientY);
  });
  const finish = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    handle.releasePointerCapture?.(event.pointerId);
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}
