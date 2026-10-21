// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { bindAreaMapCamera, zoomAreaMap } from '../../src/ui/workspace/area-map-camera';
import type { AreaMapSession } from '../../src/ui/workspace/area-map-session';
test('zoom keeps the pointer world position fixed and clamps scale', () => {
  const before = { scale: 1.2, x: 100, y: 50 };
  const next = zoomAreaMap(before, 700, 400, 2);
  expect((700 - next.x) / next.scale).toBe((700 - before.x) / before.scale);
  expect((400 - next.y) / next.scale).toBe((400 - before.y) / before.scale);
  expect(zoomAreaMap(before, 0, 0, 100).scale).toBe(3);
  expect(zoomAreaMap(before, 0, 0, .001).scale).toBe(.2);
});
test('ordinary node presses do not capture and retarget clicks; real drags capture and suppress click', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const capture = vi.fn(); Object.assign(svg, { setPointerCapture: capture, releasePointerCapture: vi.fn(), getScreenCTM: () => null });
  const session = { currentMapId: 'a', submitting: false, viewports: new Map([['a', { scale: 1, x: 0, y: 0 }]]) } as AreaMapSession;
  const suppress = vi.fn();
  const dispose = bindAreaMapCamera(svg, session, suppress);
  svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
  expect(capture).not.toHaveBeenCalled();
  svg.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(suppress).not.toHaveBeenCalled();
  svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0, clientX: 10, clientY: 10 }));
  svg.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 30, clientY: 20 }));
  expect(capture).toHaveBeenCalledWith(2);
  svg.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));
  expect(suppress).toHaveBeenCalledOnce();
  dispose();
});
test('native SVGPoint coordinate getters are normalized before drag state is captured', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(svg, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() {
      const x = this.x, y = this.y;
      return Object.create(null, { x: { get: () => x }, y: { get: () => y } });
    } }),
  });
  const session = { currentMapId: 'a', submitting: false, viewports: new Map([['a', { scale: 1, x: 0, y: 0 }]]) } as AreaMapSession;
  const dispose = bindAreaMapCamera(svg, session, vi.fn());
  svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
  svg.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 30, clientY: 40 }));
  expect(session.viewports.get('a')).toEqual({ scale: 1, x: 20, y: 30 });
  dispose();
});
