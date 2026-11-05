import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM, type Board, type Node, type Point } from './types';
import { ELEMENT_TYPES, getPort } from './element-types';

export function screenToWorld(point: Point, view: Board['view']): Point {
  return { x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
}

export function worldToScreen(point: Point, view: Board['view']): Point {
  return { x: point.x * view.zoom + view.x, y: point.y * view.zoom + view.y };
}

export function snap(value: number): number {
  return Math.round(value / GRID_SIZE);
}

export function zoomAt(view: Board['view'], point: Point, deltaY: number): Board['view'] {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * Math.exp(-deltaY * 0.001)));
  const scale = zoom / view.zoom;
  return { zoom, x: point.x - (point.x - view.x) * scale, y: point.y - (point.y - view.y) * scale };
}

export function nodeRect(node: Node): { x: number; y: number; w: number; h: number } {
  return { x: node.x * GRID_SIZE, y: node.y * GRID_SIZE, w: node.w * GRID_SIZE, h: node.h * GRID_SIZE };
}

export function portPoint(node: Node, portId: string): Point {
  const definition = getPort(node.elementTypeId, portId);
  const ports = ELEMENT_TYPES[node.elementTypeId].ports.filter(port => port.direction === definition?.direction);
  const index = Math.max(0, ports.findIndex(port => port.id === portId));
  const rect = nodeRect(node);
  return {
    x: definition?.direction === 'output' ? rect.x + rect.w : rect.x,
    y: rect.y + rect.h * (index + 1) / (ports.length + 1),
  };
}

export function edgeEndpoints(source: Node, target: Node, sourcePortId: string, targetPortId: string): [Point, Point] {
  return [portPoint(source, sourcePortId), portPoint(target, targetPortId)];
}

export function bezierPath(from: Point, to: Point): string {
  const curve = Math.max(36, Math.abs(to.x - from.x) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
}

export function gridOffset(value: number, pitch: number): number {
  return ((value % pitch) + pitch) % pitch;
}
