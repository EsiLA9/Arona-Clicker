import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  MAX_ZOOM,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  MIN_ZOOM,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type Board,
  type Edge,
  type EdgeKind,
  type Node,
  type NodeKind,
  type Point,
} from './types';
import { snap } from './geometry';
import { ELEMENT_TYPES, isConnectionAllowed, isValidElementType } from './element-types';

const nodeKinds: NodeKind[] = ['plain', 'event', 'condition', 'reference'];
const edgeKinds: EdgeKind[] = ['plain', 'sequence', 'relation'];

export function createBoard(): Board {
  return { schemaVersion: SCHEMA_VERSION, nodes: [], edges: [], view: { x: 0, y: 0, zoom: 1 } };
}

export function makeId(): string {
  return crypto.randomUUID();
}

export function createNode(point: Point, elementTypeId: Node['elementTypeId'] = 'source', title = ELEMENT_TYPES[elementTypeId].label): Node {
  return {
    id: makeId(), kind: ELEMENT_TYPES[elementTypeId].visualKind, elementTypeId, title, description: '',
    x: snap(point.x), y: snap(point.y), w: DEFAULT_NODE_WIDTH, h: DEFAULT_NODE_HEIGHT, data: {},
  };
}

export function copyNode(source: Node, point: Point): Node {
  return { ...structuredClone(source), id: makeId(), x: snap(point.x), y: snap(point.y) };
}

export function addEdge(board: Board, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string): Edge | undefined {
  if (sourceNodeId === targetNodeId || !board.nodes.some(n => n.id === sourceNodeId) || !board.nodes.some(n => n.id === targetNodeId)) return;
  if (board.edges.some(e => e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId)) return;
  const source = board.nodes.find(node => node.id === sourceNodeId)!;
  const target = board.nodes.find(node => node.id === targetNodeId)!;
  if (!isConnectionAllowed(source.elementTypeId, sourcePortId, target.elementTypeId, targetPortId)) return;
  const edge: Edge = { id: makeId(), sourceNodeId, sourcePortId, targetNodeId, targetPortId, kind: 'plain' };
  board.edges.push(edge);
  return edge;
}

export function deleteNode(board: Board, nodeId: string): void {
  board.nodes = board.nodes.filter(node => node.id !== nodeId);
  board.edges = board.edges.filter(edge => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId);
}

export function deleteEdge(board: Board, edgeId: string): void {
  board.edges = board.edges.filter(edge => edge.id !== edgeId);
}

export function transferEdgeEndpoint(board: Board, edgeId: string, side: 'source' | 'target', nodeId: string, portId: string): boolean {
  const edge = board.edges.find(item => item.id === edgeId);
  if (!edge || !board.nodes.some(node => node.id === nodeId)) return false;
  const sourceNodeId = side === 'source' ? nodeId : edge.sourceNodeId;
  const targetNodeId = side === 'target' ? nodeId : edge.targetNodeId;
  if (sourceNodeId === targetNodeId || board.edges.some(item => item.id !== edgeId && item.sourceNodeId === sourceNodeId && item.targetNodeId === targetNodeId)) return false;
  const source = board.nodes.find(item => item.id === sourceNodeId)!;
  const target = board.nodes.find(item => item.id === targetNodeId)!;
  const sourcePortId = side === 'source' ? portId : edge.sourcePortId;
  const targetPortId = side === 'target' ? portId : edge.targetPortId;
  if (!isConnectionAllowed(source.elementTypeId, sourcePortId, target.elementTypeId, targetPortId)) return false;
  if (side === 'source') {
    edge.sourceNodeId = nodeId;
    edge.sourcePortId = portId;
  } else {
    edge.targetNodeId = nodeId;
    edge.targetPortId = portId;
  }
  return true;
}

export function saveBoard(board: Board): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

export function loadBoard(): { board: Board; warning?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { board: parseBoard(raw) } : { board: createBoard() };
  } catch {
    return { board: createBoard(), warning: '已保存数据无法读取，当前打开空白图板。' };
  }
}

export function parseBoard(json: string): Board {
  const value: unknown = JSON.parse(json);
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== SCHEMA_VERSION) || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || !isRecord(value.view)) {
    throw new Error('JSON 结构或 schemaVersion 不受支持。');
  }
  const legacy = value.schemaVersion === 1;
  const view = value.view;
  if (!finite(view.x) || !finite(view.y) || !finite(view.zoom) || view.zoom < MIN_ZOOM || view.zoom > MAX_ZOOM) throw new Error('视图坐标或缩放值无效。');
  const ids = new Set<string>();
  const nodes: Node[] = value.nodes.map((raw): Node => {
    if (!isRecord(raw) || !validId(raw.id) || ids.has(raw.id) || !nodeKinds.includes(raw.kind as NodeKind) ||
      (!legacy && !isValidElementType(raw.elementTypeId)) ||
      typeof raw.title !== 'string' || typeof raw.x !== 'number' || !Number.isInteger(raw.x) ||
      typeof raw.y !== 'number' || !Number.isInteger(raw.y) || typeof raw.w !== 'number' ||
      !Number.isInteger(raw.w) || raw.w < MIN_NODE_WIDTH || typeof raw.h !== 'number' ||
      !Number.isInteger(raw.h) || raw.h < MIN_NODE_HEIGHT || !isRecord(raw.data) ||
      (raw.description !== undefined && typeof raw.description !== 'string')) throw new Error('节点字段无效或 ID 重复。');
    ids.add(raw.id);
    return { id: raw.id, kind: raw.kind as NodeKind, elementTypeId: legacy ? 'legacy' : raw.elementTypeId as Node['elementTypeId'], title: raw.title, description: raw.description as string | undefined,
      x: raw.x, y: raw.y, w: raw.w, h: raw.h, data: raw.data };
  });
  const nodeIds = new Set(nodes.map(node => node.id));
  const pairs = new Set<string>();
  const edges: Edge[] = value.edges.map((raw): Edge => {
    const sourcePortId = legacy ? 'out' : isRecord(raw) && typeof raw.sourcePortId === 'string' ? raw.sourcePortId : '';
    const targetPortId = legacy ? 'in' : isRecord(raw) && typeof raw.targetPortId === 'string' ? raw.targetPortId : '';
    if (!isRecord(raw) || !validId(raw.id) || ids.has(raw.id) || typeof raw.sourceNodeId !== 'string' ||
      typeof raw.targetNodeId !== 'string' || raw.sourceNodeId === raw.targetNodeId ||
      !nodeIds.has(raw.sourceNodeId) || !nodeIds.has(raw.targetNodeId) || !edgeKinds.includes(raw.kind as EdgeKind) ||
      !sourcePortId || !targetPortId ||
      (raw.label !== undefined && typeof raw.label !== 'string')) throw new Error('连线字段、ID 或节点引用无效。');
    const pair = `${raw.sourceNodeId}\u0000${raw.targetNodeId}`;
    if (pairs.has(pair)) throw new Error('图中存在重复的有向连接。');
    pairs.add(pair);
    ids.add(raw.id);
    const source = nodes.find(node => node.id === raw.sourceNodeId)!;
    const target = nodes.find(node => node.id === raw.targetNodeId)!;
    if (!isConnectionAllowed(source.elementTypeId, sourcePortId, target.elementTypeId, targetPortId)) throw new Error('连线交互点类型不兼容。');
    return { id: raw.id, sourceNodeId: raw.sourceNodeId, sourcePortId, targetNodeId: raw.targetNodeId, targetPortId,
      label: raw.label as string | undefined, kind: raw.kind as EdgeKind };
  });
  return { schemaVersion: SCHEMA_VERSION, nodes, edges, view: { x: view.x, y: view.y, zoom: view.zoom } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

