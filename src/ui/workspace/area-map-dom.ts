import type { UIContext } from '../runtime/context';
import type { PanelState } from '../components/shared/app-shell';
import type { AreaMapSession } from './area-map-session';
import { renderAreaMapDetail, renderAreaMapEdges, renderAreaMapNode, renderAreaMapWorkspace, areaMapTravelLabel } from '../components/map/area-map-workspace';

interface Overlays {
  dismissBeforeRootMutation(scope: ParentNode): void;
  retainIfAnchored(): void;
}

function attributes(current: Element, next: Element): void {
  for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
  for (const attr of [...next.attributes]) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
}

/** Patches only a node's simple SVG children; the interactive g remains the same anchor. */
function patchNode(current: Element, next: Element, overlays: Overlays): void {
  attributes(current, next);
  const children = [...current.children];
  const retained = new Set<Element>();
  for (const desired of [...next.children]) {
    const key = `${desired.tagName}:${desired.getAttribute('class') ?? ''}`;
    const child = children.find(item => !retained.has(item) && `${item.tagName}:${item.getAttribute('class') ?? ''}` === key);
    if (child) {
      retained.add(child); attributes(child, desired);
      if (child.textContent !== desired.textContent) child.textContent = desired.textContent;
    } else current.append(desired);
  }
  for (const child of children) if (!retained.has(child)) { overlays.dismissBeforeRootMutation(child); child.remove(); }
}

function svgFragment(markup: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = markup;
  return svg;
}

export function applyAreaMapCamera(root: ParentNode, session: AreaMapSession): void {
  const camera = session.viewports.get(session.currentMapId)!;
  root.querySelector('[data-area-map-world]')?.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
}

/** Returns false only when the workspace identity is absent; subregion loss is repaired locally. */
export function reconcileAreaMapDOM(root: HTMLElement, ctx: UIContext, state: PanelState, session: AreaMapSession, overlays: Overlays, canTravel: boolean): boolean {
  const frame = root.querySelector<HTMLElement>('[data-workspace-frame="area-map"]');
  if (!frame) return false;
  const required = [
    ['[data-area-map-viewport]', 'center'], ['[data-area-map-detail-scroll]', 'right'],
    ['[data-area-map-actions]', 'right'], ['.area-map-toolbar', 'center'],
  ];
  let recovery: HTMLTemplateElement | undefined;
  for (const [selector, column] of required) if (!frame.querySelector(selector)) {
    recovery ??= document.createElement('template');
    if (!recovery.innerHTML) recovery.innerHTML = renderAreaMapWorkspace(ctx, session, state);
    const desired = recovery.content.querySelector(selector);
    const body = frame.querySelector(`[data-workspace-column="${column}"] .workspace-column__body`);
    if (!desired || !body) return false;
    body.append(desired.cloneNode(true));
  }
  const viewport = frame.querySelector<SVGSVGElement>('[data-area-map-viewport]')!;
  if (viewport.dataset.areaMapSession !== session.sessionId) return false;
  viewport.setAttribute('aria-label', session.view.name);
  let world = viewport.querySelector('[data-area-map-world]');
  if (!world) {
    world = svgFragment('<g data-area-map-world><g data-area-map-edges></g><g data-area-map-nodes></g></g>').firstElementChild!;
    viewport.prepend(world);
  }
  for (const layer of ['edges', 'nodes']) if (!world.querySelector(`[data-area-map-${layer}]`)) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute(`data-area-map-${layer}`, ''); world.append(group);
  }
  const nodeLayer = world.querySelector('[data-area-map-nodes]')!;
  const existing = [...nodeLayer.children];
  const nodeIndex = new Map(existing.map(el => [`${el.getAttribute('data-area-map-id')}:${el.getAttribute('data-area-map-node')}`, el]));
  const retained = new Set<Element>();
  for (const node of session.view.nodes) {
    const desired = svgFragment(renderAreaMapNode(ctx, session, node)).firstElementChild!;
    const current = nodeIndex.get(`${session.currentMapId}:${node.id}`);
    if (current) { retained.add(current); patchNode(current, desired, overlays); }
    else nodeLayer.append(desired);
  }
  for (const node of existing) if (!retained.has(node)) { overlays.dismissBeforeRootMutation(node); node.remove(); }
  const edgeLayer = world.querySelector('[data-area-map-edges]')!;
  const edges = [...edgeLayer.children];
  const edgeIndex = new Map(edges.map(el => [el.getAttribute('data-area-map-edge'), el]));
  const keepEdges = new Set<Element>();
  for (const desired of [...svgFragment(renderAreaMapEdges(session)).children]) {
    const current = edgeIndex.get(desired.getAttribute('data-area-map-edge'));
    if (current) { keepEdges.add(current); attributes(current, desired); }
    else edgeLayer.append(desired);
  }
  for (const edge of edges) if (!keepEdges.has(edge)) edge.remove();
  let empty = viewport.querySelector('[data-area-map-empty]');
  if (!empty) { empty = svgFragment('<text data-area-map-empty x="500" y="350" text-anchor="middle">这张地图暂无可见节点</text>').firstElementChild!; viewport.append(empty); }
  empty.toggleAttribute('hidden', session.view.nodes.length > 0);
  const detail = frame.querySelector<HTMLElement>('[data-area-map-detail]');
  if (!detail) {
    const scroll = frame.querySelector('[data-area-map-detail-scroll]')!;
    const replacement = document.createElement('section'); replacement.dataset.areaMapDetail = ''; scroll.append(replacement);
  }
  const content = frame.querySelector<HTMLElement>('[data-area-map-detail]')!;
  const html = renderAreaMapDetail(ctx, session);
  if (content.innerHTML !== html) { overlays.dismissBeforeRootMutation(content); content.innerHTML = html; }
  const selected = session.view.nodes.find(n => n.id === session.selectedNodeId);
  const travel = frame.querySelector<HTMLButtonElement>('[data-area-map-action="travel"]')!;
  travel.hidden = selected?.actionKind !== 'attemptAreaTravel';
  travel.dataset.areaMapTravelNode = selected?.id ?? '';
  travel.dataset.areaMapId = session.currentMapId;
  travel.dataset.areaMapRevision = String(session.revision);
  travel.disabled = !canTravel || !selected?.ready || session.submitting;
  travel.textContent = areaMapTravelLabel(selected);
  if (selected?.actionKind === 'attemptAreaTravel' && selected.ready && !canTravel) {
    const status = content.querySelector('.area-map-detail__status');
    if (status) status.textContent = session.submitting ? '正在前往…' : '当前交互期间暂不可移动';
  }
  frame.querySelector<HTMLButtonElement>('[data-area-map-action="back"]')!.disabled = session.history.length === 0;
  frame.querySelector('[data-area-map-title]')!.textContent = session.view.name;
  const feedback = frame.querySelector('[data-area-map-feedback]')!;
  feedback.textContent = session.feedback?.mapId === session.currentMapId ? session.feedback.text : '';
  applyAreaMapCamera(frame, session);
  overlays.retainIfAnchored();
  return true;
}
