import { describe, expect, it } from 'vitest';
import {
  collectDefinitionDiagnostics,
  createDraftLayer,
  createSourceLayer,
  resolveDefinition,
  suspendDefinition,
  type DefinitionKey,
} from '../../src/data-services';
import type { DefinitionReferenceDiagnosticInput } from '../../src/data-services/definition/definition-diagnostics';

interface TestDef {
  value: string;
}

const source: DefinitionKey = { table: 'stories', id: 'story-a' };
const reference: DefinitionKey = { table: 'spots', id: 'spot-a' };
const base = createSourceLayer<TestDef>(
  { kind: 'base', sourceId: 'base' },
  [{
    key: reference,
    source: { kind: 'base', sourceId: 'base' },
    kind: 'owned',
    value: { value: 'base' },
  }],
);

function input(
  policy: DefinitionReferenceDiagnosticInput<TestDef>['policy'],
  resolution: DefinitionReferenceDiagnosticInput<TestDef>['resolution'],
): DefinitionReferenceDiagnosticInput<TestDef> {
  return { source, reference, path: 'story-a.entries[0].spotId', policy, resolution };
}

describe('DefinitionDiagnostics', () => {
  it('does not diagnose a resolved reference', () => {
    const resolution = resolveDefinition([base], reference);

    expect(collectDefinitionDiagnostics([input('required', resolution)])).toEqual([]);
  });

  it('reports optional missing references as warnings', () => {
    const resolution = resolveDefinition<TestDef>([], reference);

    expect(collectDefinitionDiagnostics([input('optional', resolution)])).toEqual([{
      code: 'DEF_REF_MISSING_OPTIONAL',
      severity: 'warning',
      source,
      reference,
      path: 'story-a.entries[0].spotId',
      resolutionStatus: 'missing',
      policy: 'optional',
      message: 'Definition reference spots:spot-a is missing',
    }]);
  });

  it('reports required missing and suspended references as errors', () => {
    const missing = resolveDefinition<TestDef>([], reference);
    const draft = suspendDefinition(createDraftLayer<TestDef>('workspace-1'), reference);
    const suspended = resolveDefinition([draft, base], reference);

    expect(collectDefinitionDiagnostics([input('required', missing)]))
      .toMatchObject([{ code: 'DEF_REF_MISSING_REQUIRED', severity: 'error' }]);
    expect(collectDefinitionDiagnostics([input('required', suspended)]))
      .toMatchObject([{
        code: 'DEF_REF_SUSPENDED',
        severity: 'error',
        resolutionStatus: 'suspended',
      }]);
  });

  it('does not send symbolic identities through Definition Resolution', () => {
    const resolution = resolveDefinition<TestDef>([], reference);

    expect(collectDefinitionDiagnostics([input('symbolic', resolution)])).toEqual([]);
  });
});
