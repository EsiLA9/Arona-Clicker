import { describe, expect, it } from 'vitest';
import {
  createDraftLayer,
  createSourceLayer,
  resolveDefinition,
  setDefinitionRecord,
  suspendDefinition,
} from '../../src/data-services/definition/definition-resolution';
import {
  resolveDefinitionReference,
  resolveOptional,
  resolveRequired,
} from '../../src/data-services/definition/definition-reference-resolution';
import type {
  DefinitionKey,
  DefinitionRef,
  DefinitionSourceLayer,
} from '../../src/data-services/definition/definition-types';

interface TestDef {
  value: string;
}

const key: DefinitionKey = { table: 'spots', id: 'spot-a' };
const baseSource = { kind: 'base' as const, sourceId: 'base' };
const packSource = { kind: 'pack' as const, sourceId: 'pack-a' };
const draftSource = { kind: 'draft' as const, sourceId: 'workspace-1' };
const reference: DefinitionRef = { key, source: packSource };

const base = createSourceLayer<TestDef>(
  baseSource,
  [{ key, source: baseSource, kind: 'owned', value: { value: 'base' } }],
);
const pack = createSourceLayer<TestDef>(
  packSource,
  [{ key, source: packSource, kind: 'override', value: { value: 'pack' } }],
);
const resolvedLayers = [pack, base] as const;
const suspendedLayers = [
  suspendDefinition(createDraftLayer<TestDef>(draftSource.sourceId), key),
  ...resolvedLayers,
] as const;

describe('Definition reference policy resolution', () => {
  it.each([
    ['required', resolveRequired],
    ['optional', resolveOptional],
  ] as const)('%s preserves a resolved Definition result', (_policy, resolve) => {
    expect(resolve(resolvedLayers, reference)).toEqual({
      policy: _policy,
      status: 'resolved',
      record: {
        key,
        source: packSource,
        kind: 'override',
        value: { value: 'pack' },
      },
    });
  });

  it.each([
    ['required', resolveRequired],
    ['optional', resolveOptional],
  ] as const)('%s preserves a suspended Definition result', (_policy, resolve) => {
    expect(resolve(suspendedLayers, reference)).toMatchObject({
      policy: _policy,
      status: 'suspended',
      key,
      suspendedBy: draftSource,
      shadowedRecord: {
        source: packSource,
        value: { value: 'pack' },
      },
    });
  });

  it.each([
    ['required', resolveRequired],
    ['optional', resolveOptional],
  ] as const)('%s preserves a missing Definition result', (_policy, resolve) => {
    expect(resolve([], reference)).toEqual({
      policy: _policy,
      status: 'missing',
      key,
    });
  });

  it('does not enter Definition Resolution for symbolic references', () => {
    const repositoryMustNotBeRead = new Proxy(
      [] as readonly DefinitionSourceLayer<TestDef>[],
      {
        get() {
          throw new Error('symbolic references must not read Definition Repository layers');
        },
      },
    );
    const symbolicReference = { kind: 'tag-path', value: 'story:opening' };

    expect(resolveDefinitionReference(
      repositoryMustNotBeRead,
      symbolicReference,
      'symbolic',
    )).toEqual({
      policy: 'symbolic',
      status: 'not-applicable',
      reference: symbolicReference,
    });
  });

  it('does not mutate the source layers or records', () => {
    const draft = createDraftLayer<TestDef>(draftSource.sourceId);
    const layers = [
      draft,
      setDefinitionRecord(draft, key, { value: 'draft' }),
      ...resolvedLayers,
    ] as const;
    const snapshot = structuredClone(layers);

    resolveRequired(layers, reference);

    expect(layers).toEqual(snapshot);
    expect(resolveDefinition(layers, key)).toMatchObject({
      status: 'resolved',
      record: { value: { value: 'draft' } },
    });
  });
});
