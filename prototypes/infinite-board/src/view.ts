import { bezierPath, edgeEndpoints, gridOffset, nodeRect, portPoint, screenToWorld } from './geometry';
import { GRID_SIZE, type Board, type Edge, type Node } from './types';
import { ELEMENT_TYPES } from './element-types';

const svgNS = 'http://www.w3.org/2000/svg';

export class BoardView {
  readonly nodeElements = new Map<string, HTMLElement>();
  readonly edgeElements = new Map<string, { group: SVGGElement; path: SVGPathElement; hit: SVGPathElement; label: SVGTextElement }>();
  private readonly nodesById = new Map<string, Node>();
  private readonly edgesById = new Map<string, Edge>();
  private readonly incidentEdgeIds = new Map<string, Set<string>>();
  private readonly edgeIdsByPair = new Map<string, Set<string>>();
  private readonly tempPath: SVGPathElement;
  private connectionTargetId: string | null = null;
  private connectionTargetPortId: string | null = null;
  private compatibleTargets = new Set<string>();
  private selectedNodeIds = new Set<string>();
  private selectedEdgeId: string | null = null;

  constructor(readonly viewport: HTMLElement, readonly world: HTMLElement, readonly nodesHost: HTMLElement, readonly svg: SVGSVGElement) {
    const defs = document.createElementNS(svgNS, 'defs');
    const marker = document.createElementNS(svgNS, 'marker');
    marker.id = 'edge-arrow';
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = document.createElementNS(svgNS, 'path');
    arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrow.setAttribute('class', 'edge-arrow');
    marker.append(arrow);
    defs.append(marker);
    this.tempPath = document.createElementNS(svgNS, 'path');
    this.tempPath.setAttribute('class', 'edge-temp');
    this.tempPath.setAttribute('marker-end', 'url(#edge-arrow)');
    this.tempPath.setAttribute('visibility', 'hidden');
    this.svg.append(defs, this.tempPath);
  }

  sync(board: Board, selectedNodeIds: ReadonlySet<string>, selectedEdgeId: string | null): void {
    this.syncNodes(board.nodes);
    this.syncEdges(board.edges);
    this.updateCamera(board.view);
    this.updatePositions(board);
    this.setSelection(selectedNodeIds, selectedEdgeId);
  }

  syncNodes(nodes: Node[]): void {
    this.nodesById.clear();
    for (const node of nodes) this.nodesById.set(node.id, node);
    const present = new Set(nodes.map(node => node.id));
    for (const [id, element] of this.nodeElements) {
      if (!present.has(id)) { element.remove(); this.nodeElements.delete(id); }
    }
    for (const node of nodes) {
      let element = this.nodeElements.get(node.id);
      if (!element) {
        element = this.createNodeElement(node);
        this.nodeElements.set(node.id, element);
        this.nodesHost.append(element);
      }
      element.dataset.kind = node.kind;
      element.dataset.elementType = node.elementTypeId;
      element.setAttribute('aria-label', `${node.title || '未命名'}，${node.w} 乘 ${node.h} 格`);
      element.querySelector<HTMLElement>('.node__title')!.textContent = node.title || '未命名';
      element.querySelector<HTMLElement>('.node__type')!.textContent = ELEMENT_TYPES[node.elementTypeId].label;
      element.querySelector<HTMLElement>('.node__description')!.textContent = node.description || '';
      this.syncPorts(element, node);
    }
  }

  syncEdges(edges: Edge[]): void {
    this.edgesById.clear();
    this.incidentEdgeIds.clear();
    this.edgeIdsByPair.clear();
    for (const edge of edges) {
      this.edgesById.set(edge.id, edge);
      this.addToIndex(this.incidentEdgeIds, edge.sourceNodeId, edge.id);
      this.addToIndex(this.incidentEdgeIds, edge.targetNodeId, edge.id);
      this.addToIndex(this.edgeIdsByPair, `${edge.sourceNodeId}\u0000${edge.targetNodeId}`, edge.id);
    }
    const present = new Set(edges.map(edge => edge.id));
    for (const [id, elements] of this.edgeElements) {
      if (!present.has(id)) { elements.group.remove(); this.edgeElements.delete(id); }
    }
    for (const edge of edges) {
      let elements = this.edgeElements.get(edge.id);
      if (!elements) {
        const group = document.createElementNS(svgNS, 'g');
        const path = document.createElementNS(svgNS, 'path');
        const hit = document.createElementNS(svgNS, 'path');
        const label = document.createElementNS(svgNS, 'text');
        path.setAttribute('class', 'edge-path');
        path.setAttribute('marker-end', 'url(#edge-arrow)');
        hit.setAttribute('class', 'edge-hit');
        label.setAttribute('class', 'edge-label');
        group.append(path, hit, label);
        this.svg.insertBefore(group, this.tempPath);
        elements = { group, path, hit, label };
        this.edgeElements.set(edge.id, elements);
      }
      elements.group.dataset.edgeId = edge.id;
      elements.group.dataset.kind = edge.kind;
      elements.group.setAttribute('role', 'button');
      elements.group.setAttribute('tabindex', '0');
      elements.group.setAttribute('aria-label', `${edge.label || '连接'}，${edge.sourceNodeId} 到 ${edge.targetNodeId}`);
      elements.label.textContent = edge.label || '';
    }
  }

  endpointSideAt(edgeId: string, point: { x: number; y: number }, view: Board['view']): 'source' | 'target' {
    const path = this.edgeElements.get(edgeId)?.path;
    if (!path) return 'target';
    const length = path.getTotalLength();
    if (!length) return 'target';
    const worldPoint = screenToWorld(point, view);
    let nearestRatio = 0;
    let nearestDistance = Infinity;
    for (let index = 0; index <= 40; index++) {
      const ratio = index / 40;
      const sample = path.getPointAtLength(length * ratio);
      const distance = (sample.x - worldPoint.x) ** 2 + (sample.y - worldPoint.y) ** 2;
      if (distance < nearestDistance) { nearestDistance = distance; nearestRatio = ratio; }
    }
    return nearestRatio < 0.5 ? 'source' : 'target';
  }

  updateTemporaryTransfer(edgeId: string, side: 'source' | 'target', nodeId: string, portId: string | undefined, valid: boolean): void {
    const edge = this.edgesById.get(edgeId);
    const movedNode = this.nodesById.get(nodeId);
    if (!edge || !movedNode) return;
    const sourceId = side === 'source' ? nodeId : edge.sourceNodeId;
    const targetId = side === 'target' ? nodeId : edge.targetNodeId;
    const source = this.nodesById.get(sourceId), target = this.nodesById.get(targetId);
    if (!source || !target) return;
    const sourcePortId = side === 'source' ? portId : edge.sourcePortId;
    const targetPortId = side === 'target' ? portId : edge.targetPortId;
    this.setConnectionTarget(nodeId, valid, portId);
    const from = sourcePortId ? portPoint(source, sourcePortId) : { x: nodeRect(source).x + nodeRect(source).w, y: nodeRect(source).y + nodeRect(source).h / 2 };
    const to = targetPortId ? portPoint(target, targetPortId) : { x: nodeRect(target).x, y: nodeRect(target).y + nodeRect(target).h / 2 };
    this.tempPath.setAttribute('d', bezierPath(from, to));
    this.tempPath.setAttribute('visibility', 'visible');
  }

  updateCamera(view: Board['view']): void {
    const pitch = GRID_SIZE * view.zoom;
    this.viewport.style.backgroundSize = `${pitch}px ${pitch}px`;
    this.viewport.style.backgroundPosition = `${gridOffset(view.x, pitch)}px ${gridOffset(view.y, pitch)}px`;
    this.world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    this.world.style.setProperty('--zoom', String(view.zoom));
  }

  updatePositions(board: Board): void {
    this.updateViewportSize();
    for (const [id, element] of this.nodeElements) this.updateNodeElement(element, this.nodesById.get(id));
    for (const [id, elements] of this.edgeElements) this.updateEdgeElement(elements, this.edgesById.get(id));
  }

  updateViewportSize(): void {
    const rect = this.viewport.getBoundingClientRect();
    this.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  }

  updateNodeAndIncidentEdges(nodeId: string): void {
    const nodeElement = this.nodeElements.get(nodeId);
    if (nodeElement) this.updateNodeElement(nodeElement, this.nodesById.get(nodeId));
    for (const edgeId of this.incidentEdgeIds.get(nodeId) || []) {
      const elements = this.edgeElements.get(edgeId);
      if (elements) this.updateEdgeElement(elements, this.edgesById.get(edgeId));
    }
  }

  hasDirectedEdge(sourceId: string, targetId: string, exceptId?: string): boolean {
    const ids = this.edgeIdsByPair.get(`${sourceId}\u0000${targetId}`);
    if (!ids) return false;
    for (const id of ids) if (id !== exceptId) return true;
    return false;
  }

  getNode(id: string): Node | undefined { return this.nodesById.get(id); }
  getEdge(id: string): Edge | undefined { return this.edgesById.get(id); }

  private addToIndex(index: Map<string, Set<string>>, key: string, id: string): void {
    let ids = index.get(key);
    if (!ids) index.set(key, ids = new Set());
    ids.add(id);
  }

  private updateNodeElement(element: HTMLElement, node: Node | undefined): void {
    if (!node) return;
    const box = nodeRect(node);
    element.style.left = `${box.x}px`;
    element.style.top = `${box.y}px`;
    element.style.width = `${box.w}px`;
    element.style.height = `${box.h}px`;
  }

  private updateEdgeElement(elements: { path: SVGPathElement; hit: SVGPathElement; label: SVGTextElement }, edge: Edge | undefined): void {
    if (!edge) return;
    const source = this.nodesById.get(edge.sourceNodeId), target = this.nodesById.get(edge.targetNodeId);
    if (!source || !target) return;
    const d = bezierPath(...edgeEndpoints(source, target, edge.sourcePortId, edge.targetPortId));
    elements.path.setAttribute('d', d);
    elements.hit.setAttribute('d', d);
    const midpoint = elements.path.getPointAtLength(elements.path.getTotalLength() / 2);
    elements.label.setAttribute('x', String(midpoint.x));
    elements.label.setAttribute('y', String(midpoint.y));
  }

  updateTemporaryEdge(sourceId: string, sourcePortId: string, targetId: string, targetPortId: string | undefined, validTarget = true): void {
    const source = this.nodesById.get(sourceId);
    const target = this.nodesById.get(targetId);
    if (!source) { this.tempPath.setAttribute('visibility', 'hidden'); return; }
    this.setConnectionTarget(targetId || null, validTarget, targetPortId);
    if (!target) { this.tempPath.setAttribute('visibility', 'hidden'); return; }
    const from = portPoint(source, sourcePortId);
    const rect = nodeRect(target);
    const to = targetPortId ? portPoint(target, targetPortId) : { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    this.tempPath.setAttribute('d', bezierPath(from, to));
    this.tempPath.setAttribute('visibility', 'visible');
  }

  updateTemporaryFreeEdge(sourceId: string, sourcePortId: string, point: { x: number; y: number }, view: Board['view']): void {
    const source = this.nodesById.get(sourceId);
    if (!source) { this.hideTemporaryEdge(); return; }
    this.setConnectionTarget(null, true);
    const from = portPoint(source, sourcePortId);
    const to = screenToWorld(point, view);
    this.tempPath.setAttribute('d', bezierPath(from, to));
    this.tempPath.setAttribute('visibility', 'visible');
  }

  updateTemporaryFreeTransfer(edgeId: string, side: 'source' | 'target', point: { x: number; y: number }, view: Board['view']): void {
    const edge = this.edgesById.get(edgeId);
    if (!edge) { this.hideTemporaryEdge(); return; }
    const source = this.nodesById.get(edge.sourceNodeId), target = this.nodesById.get(edge.targetNodeId);
    if (!source || !target) { this.hideTemporaryEdge(); return; }
    const [from, to] = edgeEndpoints(source, target, edge.sourcePortId, edge.targetPortId);
    const endpoint = screenToWorld(point, view);
    this.setConnectionTarget(null, true);
    this.tempPath.setAttribute('d', bezierPath(side === 'source' ? endpoint : from, side === 'target' ? endpoint : to));
    this.tempPath.setAttribute('visibility', 'visible');
  }

  hideTemporaryEdge(): void {
    this.tempPath.setAttribute('visibility', 'hidden');
    this.setConnectionTarget(null, true);
  }

  setConnectionTarget(nodeId: string | null, valid: boolean, portId?: string): void {
    if (this.connectionTargetId && this.connectionTargetId !== nodeId) {
      const previous = this.nodeElements.get(this.connectionTargetId);
      previous?.classList.remove('is-connection-target', 'is-connection-invalid');
      previous?.querySelectorAll('.node__port.is-connection-port-target').forEach(port => port.classList.remove('is-connection-port-target'));
    } else if (this.connectionTargetId && this.connectionTargetPortId !== (portId || null)) {
      this.nodeElements.get(this.connectionTargetId)?.querySelectorAll('.node__port.is-connection-port-target').forEach(port => port.classList.remove('is-connection-port-target'));
    }
    this.connectionTargetId = nodeId;
    this.connectionTargetPortId = portId || null;
    if (nodeId) {
      const element = this.nodeElements.get(nodeId);
      element?.classList.toggle('is-connection-target', valid);
      element?.classList.toggle('is-connection-invalid', !valid);
      if (valid && portId) {
        for (const port of element?.querySelectorAll<HTMLElement>('.node__port') || []) {
          if (port.dataset.portId === portId) port.classList.add('is-connection-port-target');
        }
      }
    }
  }

  setCompatibleTargets(targets: Map<string, string[]>): void {
    for (const id of this.compatibleTargets) {
      const element = this.nodeElements.get(id);
      element?.classList.remove('is-compatible-target');
      element?.querySelectorAll('.node__port.is-compatible-port').forEach(port => port.classList.remove('is-compatible-port'));
    }
    this.compatibleTargets = new Set(targets.keys());
    for (const [id, portIds] of targets) {
      const element = this.nodeElements.get(id);
      element?.classList.add('is-compatible-target');
      for (const port of element?.querySelectorAll<HTMLElement>('.node__port') || []) {
        if (portIds.includes(port.dataset.portId || '')) port.classList.add('is-compatible-port');
      }
    }
  }

  setSelection(nodeIds: ReadonlySet<string>, edgeId: string | null): void {
    for (const id of this.selectedNodeIds) if (!nodeIds.has(id)) this.nodeElements.get(id)?.classList.remove('is-selected');
    for (const id of nodeIds) if (!this.selectedNodeIds.has(id)) this.nodeElements.get(id)?.classList.add('is-selected');
    this.selectedNodeIds = new Set(nodeIds);
    if (this.selectedEdgeId !== edgeId) {
      if (this.selectedEdgeId) this.edgeElements.get(this.selectedEdgeId)?.group.classList.remove('is-selected');
      if (edgeId) this.edgeElements.get(edgeId)?.group.classList.add('is-selected');
      this.selectedEdgeId = edgeId;
    }
  }

  private createNodeElement(node: Node): HTMLElement {
    const element = document.createElement('article');
    element.className = 'node';
    element.dataset.nodeId = node.id;
    element.dataset.kind = node.kind;
    element.tabIndex = 0;
    element.setAttribute('role', 'group');
    const title = document.createElement('div');
    title.className = 'node__title';
    const type = document.createElement('div');
    type.className = 'node__type';
    const description = document.createElement('div');
    description.className = 'node__description';
    element.append(title, type, description);
    return element;
  }

  private syncPorts(element: HTMLElement, node: Node): void {
    element.querySelectorAll('.node__port').forEach(port => port.remove());
    const definitions = ELEMENT_TYPES[node.elementTypeId].ports;
    for (const direction of ['input', 'output'] as const) {
      const ports = definitions.filter(port => port.direction === direction);
      ports.forEach((definition, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `node__port node__${direction}`;
        button.dataset.port = direction;
        button.dataset.portId = definition.id;
        button.dataset.portLabel = definition.label;
        button.style.top = `${((index + 1) / (ports.length + 1)) * 100}%`;
        button.title = `${direction === 'input' ? 'Input' : 'Output'} · ${definition.label}`;
        button.setAttribute('aria-label', `${node.title || '未命名'} ${definition.label} ${direction === 'input' ? '输入点' : '输出点'}`);
        element.append(button);
      });
    }
  }
}
