export type InspectorFieldType =
  | 'undefined'
  | 'null'
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'symbol'
  | 'function'
  | 'array'
  | 'object';

export type InspectorFieldTruncation = 'depth' | 'nodes' | 'cycle' | 'getter' | 'unreadable';

export interface InspectorFieldNode {
  readonly key: string;
  readonly path: string;
  readonly type: InspectorFieldType;
  readonly displayValue: string;
  readonly children: readonly InspectorFieldNode[];
  readonly truncation?: InspectorFieldTruncation;
}

export interface FieldTreeOptions {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_MAX_NODES = 2_000;

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function fieldType(value: unknown): InspectorFieldType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value as InspectorFieldType;
}

function primitiveDisplay(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    if (Object.is(value, -0)) return '-0';
    return String(value);
  }
  if (typeof value === 'bigint') return `${String(value)}n`;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'symbol') return String(value);
  if (typeof value === 'function') return '[Function]';
  return Array.isArray(value) ? `[Array(${value.length})]` : '[Object]';
}

function propertyPath(parent: string, key: string, arrayParent: boolean): string {
  if (arrayParent && /^\d+$/.test(key)) return `${parent}[${key}]`;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return `${parent}.${key}`;
  return `${parent}[${JSON.stringify(key)}]`;
}

function safeKeys(value: object): string[] | undefined {
  try {
    return Object.keys(value);
  } catch {
    return undefined;
  }
}

export function buildFieldTree(value: unknown, options: FieldTreeOptions = {}): InspectorFieldNode {
  const maxDepth = Math.max(0, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const maxNodes = Math.max(1, options.maxNodes ?? DEFAULT_MAX_NODES);
  let nodeCount = 0;
  const ancestors = new WeakSet<object>();

  const build = (key: string, path: string, current: unknown, depth: number): InspectorFieldNode => {
    nodeCount += 1;
    const type = fieldType(current);
    const base = {
      key,
      path,
      type,
      displayValue: primitiveDisplay(current),
      children: [] as readonly InspectorFieldNode[],
    };
    if (!isObjectLike(current)) return base;
    if (ancestors.has(current)) return { ...base, truncation: 'cycle' };
    if (depth >= maxDepth) return { ...base, truncation: 'depth' };
    if (nodeCount >= maxNodes) return { ...base, truncation: 'nodes' };

    const keys = safeKeys(current);
    if (!keys) return { ...base, truncation: 'unreadable' };
    const children: InspectorFieldNode[] = [];
    ancestors.add(current);
    try {
      for (const childKey of keys) {
        if (nodeCount >= maxNodes) return { ...base, children, truncation: 'nodes' };
        const childPath = propertyPath(path, childKey, Array.isArray(current));
        let descriptor: PropertyDescriptor | undefined;
        try {
          descriptor = Object.getOwnPropertyDescriptor(current, childKey);
        } catch {
          children.push({
            key: childKey,
            path: childPath,
            type: 'undefined',
            displayValue: '[Unreadable]',
            children: [],
            truncation: 'unreadable',
          });
          continue;
        }
        if (!descriptor) continue;
        if (!('value' in descriptor)) {
          children.push({
            key: childKey,
            path: childPath,
            type: 'undefined',
            displayValue: '[Getter]',
            children: [],
            truncation: 'getter',
          });
          continue;
        }
        children.push(build(childKey, childPath, descriptor.value, depth + 1));
      }
    } finally {
      ancestors.delete(current);
    }
    return { ...base, children };
  };

  return build('$', '$', value, 0);
}

export function formatInspectorScalar(value: unknown): string {
  return primitiveDisplay(value);
}

export function inspectorTypeLabel(type: InspectorFieldType): string {
  return type === 'null' ? 'null' : type;
}
