import type { AreaMapCamera, AreaMapSession } from './area-map-session';
import { applyAreaMapCamera } from './area-map-dom';

/** Zoom about a point expressed in the viewport viewBox coordinate system. */
export function zoomAreaMap(camera: AreaMapCamera, x: number, y: number, factor: number): AreaMapCamera {
  const scale = Math.max(0.2, Math.min(3, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { scale, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio };
}

function point(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const matrix = svg.getScreenCTM?.();
  if (matrix && typeof svg.createSVGPoint === 'function') {
    const value = svg.createSVGPoint(); value.x = clientX; value.y = clientY;
    const transformed = value.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }
  const rect = svg.getBoundingClientRect();
  return { x: (clientX - rect.left) * 1000 / (rect.width || 1000), y: (clientY - rect.top) * 700 / (rect.height || 700) };
}

/** Attaches only to the stable viewport and releases listeners/capture on close or replacement. */
export function bindAreaMapCamera(svg: SVGSVGElement, session: AreaMapSession, suppressClick: () => void): () => void {
  let drag: { id: number; mapId: string; clientX: number; clientY: number; x: number; y: number; camera: AreaMapCamera; moved: boolean } | null = null;
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || session.submitting) return;
    const p = point(svg, event.clientX, event.clientY);
    drag = { id: event.pointerId, mapId: session.currentMapId, clientX: event.clientX, clientY: event.clientY, ...p, camera: { ...session.viewports.get(session.currentMapId)! }, moved: false };
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId || drag.mapId !== session.currentMapId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) > 4) {
      drag.moved = true;
      try { svg.setPointerCapture?.(event.pointerId); } catch { /* Capture starts only for a real drag. */ }
    }
    if (!drag.moved) return;
    const p = point(svg, event.clientX, event.clientY);
    session.viewports.set(session.currentMapId, { ...drag.camera, x: drag.camera.x + p.x - drag.x, y: drag.camera.y + p.y - drag.y });
    svg.dataset.dragging = 'true';
    applyAreaMapCamera(svg, session);
    event.preventDefault();
  };
  const end = (event?: PointerEvent) => {
    if (!drag || event && drag.id !== event.pointerId) return;
    const ended = drag; drag = null;
    if (ended.moved) suppressClick();
    try { svg.releasePointerCapture?.(ended.id); } catch { /* Capture may already have ended. */ }
    delete svg.dataset.dragging;
  };
  const wheel = (event: WheelEvent) => {
    if (session.submitting) return;
    event.preventDefault();
    const p = point(svg, event.clientX, event.clientY);
    const camera = session.viewports.get(session.currentMapId)!;
    session.viewports.set(session.currentMapId, zoomAreaMap(camera, p.x, p.y, Math.exp(-Math.max(-300, Math.min(300, event.deltaY)) * .0015)));
    applyAreaMapCamera(svg, session);
  };
  svg.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('lostpointercapture', end);
  svg.addEventListener('wheel', wheel, { passive: false });
  return () => {
    end();
    svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerup', end); svg.removeEventListener('pointercancel', end);
    svg.removeEventListener('lostpointercapture', end); svg.removeEventListener('wheel', wheel);
  };
}
