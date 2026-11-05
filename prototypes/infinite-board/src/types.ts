export const GRID_SIZE = 24;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2.5;
export const MIN_NODE_WIDTH = 6;
export const MIN_NODE_HEIGHT = 3;
export const DEFAULT_NODE_WIDTH = 8;
export const DEFAULT_NODE_HEIGHT = 4;
export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'ac-infinite-board-v1';

export type NodeKind = 'plain' | 'event' | 'condition' | 'reference';
export type EdgeKind = 'plain' | 'sequence' | 'relation';
export type ElementTypeId = 'legacy' | 'source' | 'transform' | 'result';

export interface Node {
  id: string;
  kind: NodeKind;
  elementTypeId: ElementTypeId;
  title: string;
  description?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
}

export interface Edge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePortId: string;
  targetPortId: string;
  label?: string;
  kind: EdgeKind;
}

export interface Board {
  schemaVersion: number;
  nodes: Node[];
  edges: Edge[];
  view: { x: number; y: number; zoom: number };
}

export interface Point {
  x: number;
  y: number;
}
