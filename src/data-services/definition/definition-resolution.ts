import type {
  DefinitionChange,
  DefinitionDelta,
  DefinitionKey,
  DefinitionRecord,
  DefinitionResolution,
  DefinitionSourceLayer,
  DefinitionSourceRef,
  DefinitionTombstone,
} from './definition-types';

export function definitionKeyId(key: DefinitionKey): string {
  return JSON.stringify([key.table, key.id]);
}

function sameSource(left: DefinitionSourceRef, right: DefinitionSourceRef): boolean {
  return left.kind === right.kind && left.sourceId === right.sourceId;
}

function sameKey(left: DefinitionKey, right: DefinitionKey): boolean {
  return left.table === right.table && left.id === right.id;
}

function sameTombstoneKey(tombstone: DefinitionTombstone, key: DefinitionKey): boolean {
  return tombstone.table === key.table && tombstone.id === key.id;
}

export function createSourceLayer<T>(
  source: DefinitionSourceRef,
  records: readonly DefinitionRecord<T>[] = [],
  tombstones: readonly DefinitionTombstone[] = [],
): DefinitionSourceLayer<T> {
  return {
    source,
    records: [...records],
    tombstones: [...tombstones],
  };
}

export function createDraftLayer<T>(
  sourceId: string,
  records: readonly DefinitionRecord<T>[] = [],
): DefinitionSourceLayer<T> {
  return createSourceLayer(
    { kind: 'draft', sourceId },
    records,
  );
}

function assertDraftLayer<T>(layer: DefinitionSourceLayer<T>): void {
  if (layer.source.kind !== 'draft') {
    throw new Error('Draft-only Tombstone operations require a draft source layer');
  }
}

function recordForKey<T>(
  layer: DefinitionSourceLayer<T>,
  key: DefinitionKey,
): DefinitionRecord<T> | undefined {
  return layer.records.find((record) => sameKey(record.key, key));
}

function tombstoneForKey<T>(
  layer: DefinitionSourceLayer<T>,
  key: DefinitionKey,
): DefinitionTombstone | undefined {
  return layer.tombstones.find((tombstone) => sameTombstoneKey(tombstone, key));
}

export function setDefinitionRecord<T>(
  layer: DefinitionSourceLayer<T>,
  key: DefinitionKey,
  value: T,
  kind: DefinitionRecord<T>['kind'] = 'owned',
): DefinitionSourceLayer<T> {
  const record: DefinitionRecord<T> = {
    key,
    source: layer.source,
    kind,
    value,
  };
  return {
    ...layer,
    records: [
      ...layer.records.filter((candidate) => !sameKey(candidate.key, key)),
      record,
    ],
  };
}

export function deleteLocalDefinition<T>(
  layer: DefinitionSourceLayer<T>,
  key: DefinitionKey,
): DefinitionSourceLayer<T> {
  return {
    ...layer,
    records: layer.records.filter(
      (record) => !(sameKey(record.key, key) && record.kind === 'owned'),
    ),
  };
}

export function removeOverride<T>(
  layer: DefinitionSourceLayer<T>,
  key: DefinitionKey,
): DefinitionSourceLayer<T> {
  return {
    ...layer,
    records: layer.records.filter(
      (record) => !(sameKey(record.key, key) && record.kind === 'override'),
    ),
  };
}

export function suspendDefinition<T>(
  layer: DefinitionSourceLayer<T>,
  key: DefinitionKey,
): DefinitionSourceLayer<T> {
  assertDraftLayer(layer);
  const tombstone: DefinitionTombstone = {
    table: key.table,
    id: key.id,
    kind: 'suspend',
    owner: layer.source,
  };
  return {
    ...layer,
    tombstones: [
      ...layer.tombstones.filter((candidate) => !sameTombstoneKey(candidate, key)),
      tombstone,
    ],
  };
}

export function resumeDefinition<T>(
  layer: DefinitionSourceLayer<T>,
  key: DefinitionKey,
): DefinitionSourceLayer<T> {
  assertDraftLayer(layer);
  return {
    ...layer,
    tombstones: layer.tombstones.filter(
      (tombstone) =>
        !(
          sameTombstoneKey(tombstone, key) &&
          sameSource(tombstone.owner, layer.source)
        ),
    ),
  };
}

function firstRecord<T>(
  layers: readonly DefinitionSourceLayer<T>[],
  key: DefinitionKey,
): DefinitionRecord<T> | undefined {
  for (const layer of layers) {
    const record = recordForKey(layer, key);
    if (record) return record;
  }
  return undefined;
}

export function resolveDefinition<T>(
  layers: readonly DefinitionSourceLayer<T>[],
  key: DefinitionKey,
): DefinitionResolution<T> {
  for (const layer of layers) {
    const tombstone = tombstoneForKey(layer, key);
    if (tombstone) {
      const shadowedRecord = firstRecord(layers, key);
      return shadowedRecord
        ? {
            status: 'suspended',
            key,
            suspendedBy: tombstone.owner,
            shadowedRecord,
          }
        : { status: 'missing', key };
    }

    const record = recordForKey(layer, key);
    if (record) return { status: 'resolved', record };
  }

  return { status: 'missing', key };
}

function resolutionKey<T>(resolution: DefinitionResolution<T>): DefinitionKey {
  return resolution.status === 'resolved' ? resolution.record.key : resolution.key;
}

function statusOf<T>(resolution: DefinitionResolution<T>): DefinitionResolution<T>['status'] {
  return resolution.status;
}

function sameRecord<T>(
  left: DefinitionRecord<T>,
  right: DefinitionRecord<T>,
  equals: (left: T, right: T) => boolean,
): boolean {
  return sameSource(left.source, right.source) && equals(left.value, right.value);
}

function compareKeys(left: DefinitionKey, right: DefinitionKey): number {
  return definitionKeyId(left).localeCompare(definitionKeyId(right));
}

function resolutionMap<T>(
  resolutions: readonly DefinitionResolution<T>[],
): Map<string, DefinitionResolution<T>> {
  return new Map(resolutions.map((resolution) => [
    definitionKeyId(resolutionKey(resolution)),
    resolution,
  ]));
}

function missingResolution<T>(key: DefinitionKey): DefinitionResolution<T> {
  return { status: 'missing', key };
}

export function createDefinitionDelta<T>(
  before: readonly DefinitionResolution<T>[],
  after: readonly DefinitionResolution<T>[],
  equals: (left: T, right: T) => boolean = Object.is,
): DefinitionDelta {
  const beforeMap = resolutionMap(before);
  const afterMap = resolutionMap(after);
  const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])]
    .map((key) => JSON.parse(key) as [string, string])
    .map(([table, id]) => ({ table, id }))
    .sort(compareKeys);
  const added: DefinitionKey[] = [];
  const changed: DefinitionKey[] = [];
  const removed: DefinitionKey[] = [];
  const transitions: DefinitionChange[] = [];

  for (const key of keys) {
    const beforeResolution = beforeMap.get(definitionKeyId(key)) ?? missingResolution(key);
    const afterResolution = afterMap.get(definitionKeyId(key)) ?? missingResolution(key);
    const beforeStatus = statusOf(beforeResolution);
    const afterStatus = statusOf(afterResolution);

    if (beforeStatus !== afterStatus) {
      transitions.push({ key, before: beforeStatus, after: afterStatus });
    }

    if (beforeStatus === 'resolved' && afterStatus !== 'resolved') {
      removed.push(key);
      continue;
    }
    if (beforeStatus !== 'resolved' && afterStatus === 'resolved') {
      added.push(key);
      continue;
    }
    if (
      beforeResolution.status === 'resolved' &&
      afterResolution.status === 'resolved' &&
      !sameRecord(beforeResolution.record, afterResolution.record, equals)
    ) {
      changed.push(key);
    }
  }

  return { added, changed, removed, transitions };
}
