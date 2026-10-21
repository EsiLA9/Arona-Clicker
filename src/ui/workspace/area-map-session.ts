import type { AreaMapQueryPort, AreaMapView } from '../../arona-clicker/contracts/area-map-query';

export interface AreaMapCamera { scale: number; x: number; y: number }
export interface AreaMapSession {
  sessionId: string;
  originInitId: string;
  originAreaId: string;
  runtimeGeneration: number;
  currentMapId: string;
  selectedNodeId: string | null;
  history: Array<{ mapId: string; selectedNodeId: string | null }>;
  viewports: Map<string, AreaMapCamera>;
  view: AreaMapView;
  revision: number;
  submitting: boolean;
  feedback: { mapId: string; nodeId: string | null; text: string } | null;
}

export function fitAreaMap(view: AreaMapView): AreaMapCamera {
  if (!view.nodes.length) return { scale: 1, x: 500, y: 350 };
  const xs = view.nodes.map(n => n.position.x), ys = view.nodes.map(n => n.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.max(0.2, Math.min(2, 760 / Math.max(220, maxX - minX), 460 / Math.max(160, maxY - minY)));
  return { scale, x: 500 - (minX + maxX) / 2 * scale, y: 350 - (minY + maxY) / 2 * scale };
}

export function createAreaMapSession(sessionId: string, initId: string, areaId: string, view: AreaMapView, generation: number): AreaMapSession {
  return { sessionId, originInitId: initId, originAreaId: areaId, runtimeGeneration: generation,
    currentMapId: view.id, selectedNodeId: null, history: [], viewports: new Map([[view.id, fitAreaMap(view)]]),
    view, revision: 0, submitting: false, feedback: null };
}

export function openAreaMap(session: AreaMapSession, view: AreaMapView, resetHistory = false): void {
  if (resetHistory) session.history = [];
  else if (view.id !== session.currentMapId) session.history.push({ mapId: session.currentMapId, selectedNodeId: session.selectedNodeId });
  const same = view.id === session.currentMapId;
  session.currentMapId = view.id;
  if (!same || resetHistory) session.selectedNodeId = null;
  session.view = view;
  session.revision++;
  session.feedback = null;
  if (!session.viewports.has(view.id)) session.viewports.set(view.id, fitAreaMap(view));
}

export function previousAreaMap(session: AreaMapSession, query: AreaMapQueryPort): boolean {
  while (session.history.length) {
    const previous = session.history.pop()!;
    const view = query.getView(previous.mapId);
    if (!view?.unlocked) continue;
    session.currentMapId = view.id;
    session.view = view;
    session.selectedNodeId = view.nodes.some(n => n.id === previous.selectedNodeId) ? previous.selectedNodeId : null;
    session.feedback = null;
    session.revision++;
    if (!session.viewports.has(view.id)) session.viewports.set(view.id, fitAreaMap(view));
    return true;
  }
  return false;
}

/** Refresh only public current-map facts. Camera and valid selection remain stable. */
export function reconcileAreaMap(session: AreaMapSession, query: AreaMapQueryPort): boolean {
  const view = query.getView(session.currentMapId);
  if (!view) return false;
  if (view.revision === session.view.revision) return true;
  const previous = session.view.nodes.find(n => n.id === session.selectedNodeId);
  const next = view.nodes.find(n => n.id === session.selectedNodeId);
  if (!next || JSON.stringify(previous?.action) !== JSON.stringify(next.action)) {
    session.selectedNodeId = null;
    session.feedback = null;
  }
  session.view = view;
  session.revision++;
  return true;
}
