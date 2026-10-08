import { describe, expect, test } from 'vitest';
import { operationRelationAnchors, operationRelationPath, type OperationRelationRect } from '../../src/ui/operation-card-relation';

const rect = (left: number, top: number, right: number, bottom: number): OperationRelationRect => ({ left, top, right, bottom });

describe('Operation card relation anchors', () => {
  test.each([
    ['left party to right target', rect(10, 10, 30, 30), rect(80, 10, 100, 30), 'right', 'left'],
    ['right party to left target', rect(80, 10, 100, 30), rect(10, 10, 30, 30), 'left', 'right'],
    ['center card to left target', rect(45, 10, 65, 30), rect(10, 10, 30, 30), 'left', 'right'],
    ['center card to right target', rect(45, 10, 65, 30), rect(80, 10, 100, 30), 'right', 'left'],
    ['same party below', rect(20, 10, 40, 30), rect(20, 60, 40, 80), 'bottom', 'top'],
    ['overlapping card inside target', rect(70, 65, 90, 85), rect(40, 40, 100, 100), 'right', 'right'],
  ] as const)('%s chooses facing ports', (_name, source, target, sourcePort, targetPort) => {
    const anchors = operationRelationAnchors(source, target);
    expect(anchors.sourcePort).toBe(sourcePort);
    expect(anchors.targetPort).toBe(targetPort);
    expect(operationRelationPath(anchors)).toMatch(/^M /);
    expect(operationRelationPath(anchors)).toContain(' C ');
  });
});
