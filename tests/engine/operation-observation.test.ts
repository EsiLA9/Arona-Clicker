import { describe, expect, test } from 'vitest';
import { OPERATION_OBSERVATION_LIMIT, OPERATION_OBSERVATION_MAX_BYTES, OperationObservationStore } from '../../src/arona-clicker/services/operation/operation-observation';
import type { OperationObservationInput } from '../../src/arona-clicker/contracts/operation/operation-observation';

function makeInput(overrides: Partial<OperationObservationInput> = {}): OperationObservationInput {
  return {
    operation: { kind: 'spot-upgrade', spotId: 'base:spot:credit_printer', paymentOptionId: 'credit' },
    result: { success: true, spotId: 'base:spot:credit_printer', newLevel: 2 },
    identity: { activeInit: 'base:init:schale_office', contentRevision: 'unknown', reason: 'revision unavailable' },
    frame: { before: 12, after: 12 },
    before: { spotLevel: 1, resources: { global: { pyroxene: 3 }, currentInit: { credit: 500 } }, inventory: { ticket: 2 } },
    after: { spotLevel: 2, resources: { global: { pyroxene: 3 }, currentInit: { credit: 400 } }, inventory: { ticket: 1 } },
    logs: { association: 'captured-during-command', omitted: 0, entries: [
      { id: 2, timestamp: 100, level: 'success', source: 'spot', message: '升级成功', details: '消耗 100 credit', frame: 12 },
    ] },
    ...overrides,
  };
}

const utf8Bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

describe('OperationObservationStore', () => {
  test('projects fixed fields, computes value changes, and returns defensive copies', () => {
    const store = new OperationObservationStore();
    const first = store.capture(makeInput());
    expect(first).toMatchObject({
      schemaVersion: 1,
      captureId: 'runtime-local-1',
      operation: { kind: 'spot-upgrade', spotId: 'base:spot:credit_printer', paymentOptionId: 'credit' },
      result: { success: true, newLevel: 2 },
      changes: {
        spotLevel: { from: 1, to: 2 },
        resources: [{ scope: 'currentInit', resourceId: 'credit', from: 500, to: 400 }],
        inventory: [{ itemId: 'ticket', from: 2, to: 1 }],
      },
      logs: { association: 'captured-during-command', entries: [{ id: 2, message: '升级成功' }], omitted: 0 },
      completeness: { status: 'complete', truncated: false },
    });
    (first.before.resources.currentInit as Record<string, number>).credit = 0;
    (first.logs.entries as unknown as unknown[]).length = 0;
    expect(store.get(first.captureId)?.before.resources.currentInit.credit).toBe(500);
    expect(store.get(first.captureId)?.logs.entries).toHaveLength(1);
  });

  test('does not invoke getters and marks omitted accessor data incomplete', () => {
    const store = new OperationObservationStore();
    let calls = 0;
    const resources = { credit: 1 };
    Object.defineProperty(resources, 'secret', { enumerable: true, get: () => { calls += 1; return 7; } });
    const observation = store.capture(makeInput({
      before: { spotLevel: 1, resources: { global: {}, currentInit: resources }, inventory: {} },
    }));
    expect(calls).toBe(0);
    expect(observation.before.resources.currentInit).toEqual({ credit: 1 });
    expect(observation.completeness).toMatchObject({ status: 'truncated', truncated: true, omitted: expect.any(Number) });
  });

  test('does not expand class instances or cyclic values from numeric maps', () => {
    class RuntimeObject { credit = 99; }
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const store = new OperationObservationStore();
    const observation = store.capture(makeInput({
      before: { spotLevel: 1, resources: { global: new RuntimeObject() as unknown as Record<string, number>, currentInit: cyclic as Record<string, number> }, inventory: {} },
    }));
    expect(observation.before.resources).toEqual({ global: {}, currentInit: {} });
    expect(observation.completeness.status).toBe('truncated');
  });

  test('bounds long strings, large maps, logs, and final UTF-8 JSON while keeping it parseable', () => {
    const store = new OperationObservationStore();
    const oversizedMap = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`resource-${index}`, index]));
    const input = makeInput({
      operation: { kind: 'spot-upgrade', spotId: '长'.repeat(2000) },
      before: { spotLevel: 1, resources: { global: oversizedMap, currentInit: oversizedMap }, inventory: oversizedMap },
      after: { spotLevel: 2, resources: { global: oversizedMap, currentInit: oversizedMap }, inventory: oversizedMap },
      logs: { association: 'captured-during-command', omitted: 0, entries: Array.from({ length: 80 }, (_, index) => ({
        id: index, timestamp: index, level: 'info' as const, source: 'x'.repeat(2000), message: '日志'.repeat(2000), details: 'd'.repeat(2000),
      })) },
    });
    const observation = store.capture(input);
    const json = JSON.stringify(observation);
    expect(utf8Bytes(observation)).toBeLessThanOrEqual(OPERATION_OBSERVATION_MAX_BYTES);
    expect(JSON.parse(json)).toMatchObject({ completeness: { status: 'truncated', truncated: true } });
    expect(observation.completeness.omitted).toBeGreaterThan(0);
    expect(observation.logs.omitted).toBeGreaterThan(0);
  });

  test('retains only the newest 20 and does not reuse sequence numbers after clear', () => {
    const store = new OperationObservationStore();
    for (let index = 0; index < OPERATION_OBSERVATION_LIMIT + 2; index += 1) store.capture(makeInput());
    expect(store.list()).toHaveLength(OPERATION_OBSERVATION_LIMIT);
    expect(store.list(1)[0].captureId).toBe('runtime-local-22');
    expect(store.list(0)).toEqual([]);
    expect(store.get('runtime-local-1')).toBeNull();
    store.clear();
    expect(store.capture(makeInput()).captureId).toBe('runtime-local-23');
  });

  test('captures structured rejection results without retaining arbitrary fields', () => {
    const store = new OperationObservationStore();
    const result = store.capture(makeInput({
      result: { success: false, spotId: 'base:spot:credit_printer', error: 'InsufficientResource', paymentOptionIds: ['credit'] },
    }));
    expect(result.result).toEqual({ success: false, spotId: 'base:spot:credit_printer', error: 'InsufficientResource', paymentOptionIds: ['credit'] });
    expect(JSON.stringify(result)).not.toContain('prototype');
  });
});
