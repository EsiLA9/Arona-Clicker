import type {
  OperationObservation,
  OperationObservationInput,
  OperationObservationLog,
  OperationObservationState,
} from '../../contracts/operation/operation-observation';
import type { SpotUpgradeResult } from '../../contracts/runtime/results';

export const OPERATION_OBSERVATION_LIMIT = 20;
export const OPERATION_OBSERVATION_MAX_BYTES = 8 * 1024;

const MAX_STRING_BYTES = 256;
const MAX_RECORD_ITEMS = 32;
const MAX_LOG_ENTRIES = 20;

type UnknownRecord = Record<string, unknown>;

function dataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

function clipString(value: unknown, maxBytes = MAX_STRING_BYTES): { value: string; truncated: boolean } {
  if (typeof value !== 'string') return { value: '', truncated: value !== undefined };
  if (utf8Length(value) <= maxBytes) return { value, truncated: false };
  let output = '';
  let bytes = 0;
  for (const codePoint of value) {
    const size = utf8Length(codePoint);
    if (bytes + size > maxBytes) break;
    output += codePoint;
    bytes += size;
  }
  return { value: output, truncated: true };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function projectNumberRecord(value: unknown, omitted: { count: number }): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isPlainRecord(value)) {
    if (value !== undefined && value !== null) omitted.count += 1;
    return result;
  }
  let keys: string[];
  try {
    keys = Object.keys(value).sort();
  } catch {
    omitted.count += 1;
    return result;
  }
  for (const key of keys) {
    if (Object.keys(result).length >= MAX_RECORD_ITEMS) {
      omitted.count += keys.length - Object.keys(result).length;
      break;
    }
    const safeKey = clipString(key, 96);
    const number = finiteNumber(dataValue(value, key));
    if (safeKey.truncated || number === null) {
      omitted.count += 1;
      continue;
    }
    result[safeKey.value] = number;
  }
  return result;
}

function projectState(value: unknown, omitted: { count: number }): OperationObservationState {
  const spotLevel = finiteNumber(dataValue(value, 'spotLevel'));
  const resources = dataValue(value, 'resources');
  return {
    spotLevel,
    resources: {
      global: projectNumberRecord(dataValue(resources, 'global'), omitted),
      currentInit: projectNumberRecord(dataValue(resources, 'currentInit'), omitted),
    },
    inventory: projectNumberRecord(dataValue(value, 'inventory'), omitted),
  };
}

function projectResult(value: unknown, spotId: string, omitted: { count: number }): OperationObservation['result'] {
  const success = dataValue(value, 'success') === true;
  const resultId = clipString(dataValue(value, 'spotId'));
  if (resultId.truncated) omitted.count += 1;
  const resultSpotId = resultId.value || spotId;
  if (success) {
    const newLevel = finiteNumber(dataValue(value, 'newLevel'));
    if (newLevel === null) omitted.count += 1;
    return { success: true, spotId: resultSpotId, newLevel: newLevel ?? 0 };
  }
  const allowedErrors = new Set([
    'NotFound', 'NotOwned', 'InsufficientResource', 'MaxLevel', 'ConditionNotMet',
    'PaymentNotDeclared', 'NoPurchaseRoute', 'PaymentOptionRequired', 'PaymentOptionNotFound',
    'PaymentConditionNotMet', 'InvalidPayment',
  ]);
  const rawError = dataValue(value, 'error');
  const error = (typeof rawError === 'string' && allowedErrors.has(rawError) ? rawError : 'NotFound') as Extract<SpotUpgradeResult, { success: false }>['error'];
  const rawIds = dataValue(value, 'paymentOptionIds');
  const paymentOptionIds: string[] = [];
  if (Array.isArray(rawIds)) {
    omitted.count += Math.max(0, rawIds.length - MAX_RECORD_ITEMS);
    for (let index = 0; index < Math.min(rawIds.length, MAX_RECORD_ITEMS); index += 1) {
      const id = clipString(dataValue(rawIds, String(index)));
      if (id.truncated) omitted.count += 1;
      if (id.value) paymentOptionIds.push(id.value);
    }
  }
  return { success: false, spotId: resultSpotId, error, ...(paymentOptionIds.length ? { paymentOptionIds } : {}) };
}

function projectLogs(value: unknown, omitted: { count: number }): { entries: OperationObservationLog[]; omitted: number } {
  if (!Array.isArray(value)) return { entries: [], omitted: 0 };
  const logs: OperationObservationLog[] = [];
  const take = Math.min(value.length, MAX_LOG_ENTRIES);
  const omittedEntries = value.length - take;
  omitted.count += omittedEntries;
  for (let index = 0; index < take; index += 1) {
    const entry = dataValue(value, String(index));
    const rawLevel = dataValue(entry, 'level');
    const level = rawLevel === 'success' || rawLevel === 'warning' || rawLevel === 'error' ? rawLevel : 'info';
    const message = clipString(dataValue(entry, 'message'));
    const source = clipString(dataValue(entry, 'source'));
    const detailsValue = dataValue(entry, 'details');
    const details = detailsValue === undefined ? undefined : clipString(detailsValue);
    if (message.truncated || source.truncated || details?.truncated) omitted.count += 1;
    const id = finiteNumber(dataValue(entry, 'id')) ?? 0;
    const timestamp = finiteNumber(dataValue(entry, 'timestamp')) ?? 0;
    const frame = finiteNumber(dataValue(entry, 'frame'));
    logs.push({ id, timestamp, level, source: source.value, message: message.value,
      ...(details ? { details: details.value } : {}), ...(frame === null ? {} : { frame }) });
  }
  return { entries: logs, omitted: omittedEntries };
}

function recordDiff(before: Record<string, number>, after: Record<string, number>) {
  const ids = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return ids.flatMap(resourceId => {
    const from = before[resourceId] ?? null;
    const to = after[resourceId] ?? null;
    return from === to ? [] : [{ resourceId, from, to }];
  });
}

function buildChanges(before: OperationObservationState, after: OperationObservationState): OperationObservation['changes'] {
  return {
    spotLevel: { from: before.spotLevel, to: after.spotLevel },
    resources: [
      ...recordDiff(before.resources.global, after.resources.global).map(change => ({ ...change, scope: 'global' as const })),
      ...recordDiff(before.resources.currentInit, after.resources.currentInit).map(change => ({ ...change, scope: 'currentInit' as const })),
    ],
    inventory: recordDiff(before.inventory, after.inventory).map(({ resourceId: itemId, ...change }) => ({ itemId, ...change })),
  };
}

function byteLength(value: unknown): number {
  return utf8Length(JSON.stringify(value));
}

function makeBounded(input: OperationObservationInput, captureId: string): OperationObservation {
  const omitted = { count: 0 };
  const operation = dataValue(input, 'operation');
  const rawSpotId = clipString(dataValue(operation, 'spotId'));
  const spotId = rawSpotId.value || 'unknown';
  if (rawSpotId.truncated) omitted.count += 1;
  const payment = dataValue(operation, 'paymentOptionId');
  const paymentOptionId = payment === undefined ? undefined : clipString(payment);
  if (paymentOptionId?.truncated) omitted.count += 1;
  const before = projectState(dataValue(input, 'before'), omitted);
  const after = projectState(dataValue(input, 'after'), omitted);
  const identity = dataValue(input, 'identity');
  const activeInitValue = clipString(dataValue(identity, 'activeInit'));
  const contentRevisionValue = clipString(dataValue(identity, 'contentRevision'));
  if (activeInitValue.truncated || contentRevisionValue.truncated) omitted.count += 1;
  const activeInit = activeInitValue.value || 'unknown';
  const contentRevision = contentRevisionValue.value || 'unknown';
  const reason = dataValue(identity, 'reason');
  const safeReason = reason === undefined ? undefined : clipString(reason);
  if (safeReason?.truncated) omitted.count += 1;
  const projectedLogs = projectLogs(dataValue(dataValue(input, 'logs'), 'entries'), omitted);
  const result = projectResult(dataValue(input, 'result'), spotId, omitted);
  const frame = dataValue(input, 'frame');
  let output: OperationObservation = {
    schemaVersion: 1,
    captureId,
    operation: { kind: 'spot-upgrade', spotId, ...(paymentOptionId?.value ? { paymentOptionId: paymentOptionId.value } : {}) },
    result,
    identity: {
      activeInit,
      contentRevision,
      ...(safeReason === undefined ? {} : { reason: safeReason.value }),
    },
    frame: { before: finiteNumber(dataValue(frame, 'before')), after: finiteNumber(dataValue(frame, 'after')) },
    before,
    after,
    changes: buildChanges(before, after),
    logs: { association: 'captured-during-command', entries: projectedLogs.entries, omitted: projectedLogs.omitted },
    completeness: { status: 'complete', truncated: false, omitted: 0 },
  };

  const markTruncated = (count: number) => {
    output = { ...output, completeness: { status: 'truncated', truncated: true, omitted: output.completeness.omitted + count } };
  };
  if (omitted.count > 0) markTruncated(omitted.count);
  while (byteLength(output) > OPERATION_OBSERVATION_MAX_BYTES) {
    if (output.logs.entries.length) {
      output = { ...output, logs: { ...output.logs, entries: output.logs.entries.slice(0, -1), omitted: output.logs.omitted + 1 } };
      markTruncated(1);
      continue;
    }
    const maps: { side: 'before' | 'after'; group: 'global' | 'currentInit' | 'inventory'; values: Record<string, number> }[] = [
      { side: 'after', group: 'inventory', values: output.after.inventory },
      { side: 'after', group: 'currentInit', values: output.after.resources.currentInit },
      { side: 'after', group: 'global', values: output.after.resources.global },
      { side: 'before', group: 'inventory', values: output.before.inventory },
      { side: 'before', group: 'currentInit', values: output.before.resources.currentInit },
      { side: 'before', group: 'global', values: output.before.resources.global },
    ];
    const candidate = maps.find(item => Object.keys(item.values).length > 0);
    const lastKey = candidate?.values && Object.keys(candidate.values).sort().at(-1);
    if (candidate && lastKey !== undefined) {
      const next = { ...candidate.values };
      delete next[lastKey];
      const side = output[candidate.side];
      const updated = candidate.group === 'inventory'
        ? { ...side, inventory: next }
        : { ...side, resources: { ...side.resources, [candidate.group]: next } };
      output = { ...output, [candidate.side]: updated };
      markTruncated(1);
      output = { ...output, changes: buildChanges(output.before, output.after) };
      continue;
    }
    const minimum: OperationObservation = {
      ...output,
      before: { spotLevel: output.before.spotLevel, resources: { global: {}, currentInit: {} }, inventory: {} },
      after: { spotLevel: output.after.spotLevel, resources: { global: {}, currentInit: {} }, inventory: {} },
      logs: { association: 'captured-during-command', entries: [], omitted: output.logs.omitted },
      changes: { spotLevel: output.changes.spotLevel, resources: [], inventory: [] },
    };
    output = { ...output, before: minimum.before, after: minimum.after, logs: minimum.logs, changes: minimum.changes };
    markTruncated(1);
    break;
  }
  return output;
}

function copyObservation(observation: OperationObservation): OperationObservation {
  return JSON.parse(JSON.stringify(observation)) as OperationObservation;
}

export class OperationObservationStore {
  private sequence = 0;
  private readonly entries: OperationObservation[] = [];

  capture(input: OperationObservationInput): OperationObservation {
    this.sequence += 1;
    const record = makeBounded(input, `runtime-local-${this.sequence}`);
    this.entries.push(record);
    if (this.entries.length > OPERATION_OBSERVATION_LIMIT) this.entries.splice(0, this.entries.length - OPERATION_OBSERVATION_LIMIT);
    return copyObservation(record);
  }

  get(captureId: string): OperationObservation | null {
    const record = this.entries.find(entry => entry.captureId === captureId);
    return record ? copyObservation(record) : null;
  }

  list(limit = OPERATION_OBSERVATION_LIMIT): OperationObservation[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(OPERATION_OBSERVATION_LIMIT, Math.floor(limit))) : 0;
    if (safeLimit === 0) return [];
    return this.entries.slice(-safeLimit).reverse().map(copyObservation);
  }

  clear(): void {
    this.entries.length = 0;
  }
}
