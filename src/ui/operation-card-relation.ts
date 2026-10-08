export interface OperationRelationRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type OperationRelationPort = 'left' | 'right' | 'top' | 'bottom';

export interface OperationRelationAnchors {
  readonly source: readonly [number, number];
  readonly target: readonly [number, number];
  readonly sourcePort: OperationRelationPort;
  readonly targetPort: OperationRelationPort;
}

const center = (rect: OperationRelationRect): readonly [number, number] => [
  (rect.left + rect.right) / 2,
  (rect.top + rect.bottom) / 2,
];

function portPoint(rect: OperationRelationRect, port: OperationRelationPort): readonly [number, number] {
  switch (port) {
    case 'left': return [rect.left, (rect.top + rect.bottom) / 2];
    case 'right': return [rect.right, (rect.top + rect.bottom) / 2];
    case 'top': return [(rect.left + rect.right) / 2, rect.top];
    case 'bottom': return [(rect.left + rect.right) / 2, rect.bottom];
  }
}

function nearestTargetBoundary(source: OperationRelationRect, target: OperationRelationRect): OperationRelationPort | null {
  const overlaps = source.left < target.right && source.right > target.left
    && source.top < target.bottom && source.bottom > target.top;
  if (!overlaps) return null;
  const [sx, sy] = center(source);
  const [tx, ty] = center(target);
  const dx = sx - tx;
  const dy = sy - ty;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'top' : 'bottom';
}

export function operationRelationAnchors(sourceRect: OperationRelationRect, targetRect: OperationRelationRect): OperationRelationAnchors {
  const [sx, sy] = center(sourceRect);
  const [tx, ty] = center(targetRect);
  const dx = tx - sx;
  const dy = ty - sy;
  const sameRect = dx === 0 && dy === 0;
  const nestedTargetPort = nearestTargetBoundary(sourceRect, targetRect);
  let sourcePort: OperationRelationPort;
  let targetPort: OperationRelationPort;
  if (nestedTargetPort) {
    sourcePort = nestedTargetPort;
    targetPort = nestedTargetPort;
  } else if (sameRect || Math.abs(dx) >= Math.abs(dy)) {
    sourcePort = dx >= 0 ? 'right' : 'left';
    targetPort = dx >= 0 ? 'left' : 'right';
  } else {
    sourcePort = dy >= 0 ? 'bottom' : 'top';
    targetPort = dy >= 0 ? 'top' : 'bottom';
  }
  return {
    source: portPoint(sourceRect, sourcePort),
    target: portPoint(targetRect, targetPort),
    sourcePort,
    targetPort,
  };
}

function normal(port: OperationRelationPort): readonly [number, number] {
  switch (port) {
    case 'left': return [-1, 0];
    case 'right': return [1, 0];
    case 'top': return [0, -1];
    case 'bottom': return [0, 1];
  }
}

export function operationRelationPath(anchors: OperationRelationAnchors): string {
  const [x1, y1] = anchors.source;
  const [x2, y2] = anchors.target;
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const handle = Math.max(18, Math.min(90, distance * 0.36));
  const [n1x, n1y] = normal(anchors.sourcePort);
  const [n2x, n2y] = normal(anchors.targetPort);
  const c1x = x1 + n1x * handle;
  const c1y = y1 + n1y * handle;
  const c2x = x2 + n2x * handle;
  const c2y = y2 + n2y * handle;
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}
