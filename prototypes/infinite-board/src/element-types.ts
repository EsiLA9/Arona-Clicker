import type { ElementTypeId, NodeKind } from './types';

export interface ElementPort {
  id: string;
  label: string;
  direction: 'input' | 'output';
  targets?: Array<{ elementTypeId: ElementTypeId; portId: string }>;
}

export interface ElementTypeDefinition {
  id: ElementTypeId;
  label: string;
  visualKind: NodeKind;
  ports: ElementPort[];
}

export const ELEMENT_TYPES: Record<ElementTypeId, ElementTypeDefinition> = {
  legacy: {
    id: 'legacy', label: '旧版元素', visualKind: 'plain',
    ports: [
      { id: 'in', label: '输入', direction: 'input' },
      { id: 'out', label: '输出', direction: 'output', targets: [{ elementTypeId: 'legacy', portId: 'in' }] },
    ],
  },
  source: {
    id: 'source', label: '数据源', visualKind: 'event',
    ports: [{ id: 'data-out', label: '数据', direction: 'output', targets: [{ elementTypeId: 'transform', portId: 'data-in' }] }],
  },
  transform: {
    id: 'transform', label: '处理节点', visualKind: 'condition',
    ports: [
      { id: 'data-in', label: '数据', direction: 'input' },
      { id: 'result-out', label: '结果', direction: 'output', targets: [{ elementTypeId: 'result', portId: 'result-in' }] },
    ],
  },
  result: {
    id: 'result', label: '结果节点', visualKind: 'reference',
    ports: [{ id: 'result-in', label: '结果', direction: 'input' }],
  },
};

export function getPort(elementTypeId: ElementTypeId, portId: string): ElementPort | undefined {
  return ELEMENT_TYPES[elementTypeId].ports.find(port => port.id === portId);
}

export function defaultPort(elementTypeId: ElementTypeId, direction: ElementPort['direction']): ElementPort | undefined {
  const ports = ELEMENT_TYPES[elementTypeId].ports.filter(port => port.direction === direction);
  return ports.length === 1 ? ports[0] : undefined;
}

export function isValidElementType(value: unknown): value is ElementTypeId {
  return typeof value === 'string' && value in ELEMENT_TYPES;
}

export function isConnectionAllowed(sourceType: ElementTypeId, sourcePortId: string, targetType: ElementTypeId, targetPortId: string): boolean {
  const sourcePort = getPort(sourceType, sourcePortId);
  const targetPort = getPort(targetType, targetPortId);
  return sourcePort?.direction === 'output' && targetPort?.direction === 'input' &&
    !!sourcePort.targets?.some(target => target.elementTypeId === targetType && target.portId === targetPortId);
}
