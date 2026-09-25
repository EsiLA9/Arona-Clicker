import { describe, expect, test } from 'vitest';
import { CONTENT_POLICIES, SPOT_CONTENT_POLICY } from '../../src/data-services/authoring/content-policy';
import type { ContentAuthoringPolicy } from '../../src/data-services/authoring/content-policy-types';
import {
  deriveDefinitionEditorDescriptor,
  deriveDefinitionEditorDescriptors,
} from '../../src/ui/runtime-editor/definition-descriptor';

describe('definition editor descriptor', () => {
  test('derives stable sections, writable fields, and extensions from Policy order', () => {
    const descriptor = deriveDefinitionEditorDescriptor(SPOT_CONTENT_POLICY);

    expect(descriptor.sections.map(section => section.id)).toEqual([
      'overview', 'basics', 'ownership', 'payments', 'functionalities', 'upgrades', 'reveals', 'diagnostics',
    ]);
    expect(descriptor.sections.find(section => section.id === 'basics')?.fieldKeys).toEqual([
      'idName', 'name', 'description', 'conditionText',
    ]);
    expect(descriptor.writableFields.map(field => field.key)).toEqual([
      'idName', 'areaId', 'name', 'description', 'maxLevel', 'conditionText', 'global',
    ]);
    expect(descriptor.fields).toBe(descriptor.writableFields);
    expect(descriptor.extensions.map(extension => extension.inputKey)).toEqual([
      'functionalities', 'levelUpgrades', 'purchaseOptions', 'revealTriggers', 'tags', 'gachaPools',
    ]);
    expect(descriptor.extensions.find(extension => extension.inputKey === 'purchaseOptions')).toMatchObject({
      definitionKey: 'purchaseOptions',
      sectionId: 'payments',
      editorId: 'payment-options',
      required: true,
      preserveEmpty: true,
    });
  });

  test('exposes capability levels and does not overclaim Apply for an opaque Policy', () => {
    const descriptor = deriveDefinitionEditorDescriptor(SPOT_CONTENT_POLICY);

    expect(descriptor.capabilities).toMatchObject({
      R0: true,
      R1: true,
      D1: true,
      A1: false,
      browse: true,
      inspect: true,
      draft: true,
      apply: false,
      applyStrategy: 'local-mutation',
      opaqueSafe: false,
      runtimeReady: true,
      draftScope: 'new-or-complete',
    });
    expect(descriptor.capabilities.blockers).toContain('unsupported-fields');
    expect(descriptor.capabilities.blockers).not.toContain('missing-invalidation-trigger');
    expect(descriptor.applyStrategy).toBe('local-mutation');
    expect(descriptor.opaqueSafe).toBe(false);
    expect(descriptor.runtimeReady).toBe(true);
  });

  test('retains policy hints and observed unknown fields instead of treating them as writable', () => {
    const descriptor = deriveDefinitionEditorDescriptor(SPOT_CONTENT_POLICY, {
      observedDefinition: {
        id: 'runtime:spot:archive',
        name: 'Archive',
        theme: { primary: '#fff' },
        extra: { source: 'legacy' },
      },
      unsupported: [{ path: 'spot.functionalities[legacy-flow]', reason: 'opaque-functionality' }],
    });

    expect(descriptor.unknownFields.map(field => field.key)).toEqual(['theme', 'extra']);
    expect(descriptor.unsupported.map(field => field.path)).toEqual([
      'spot.unsupported',
      'spot.theme',
      'spot.extra',
      'spot.functionalities[legacy-flow]',
    ]);
    expect(descriptor.unsupported.every(field => field.retained)).toBe(true);
    expect(descriptor.writableFields.some(field => field.key === 'theme')).toBe(false);
    expect(descriptor.writableFields.some(field => field.key === 'extra')).toBe(false);
    expect(descriptor.capabilities.blockers).toContain('unknown-fields');
  });

  test('reports materialization gaps and allows A1 only for a fully proven policy', () => {
    const readyPolicy = createReadyPolicy();
    const ready = deriveDefinitionEditorDescriptor(readyPolicy);
    expect(ready.runtimeReady).toBe(true);
    expect(ready.opaqueSafe).toBe(true);
    expect(ready.capabilities).toMatchObject({ R0: true, R1: true, D1: true, A1: true, level: 'A1', maxLevel: 'A1' });
    expect(ready.materialization).toEqual([
      expect.objectContaining({ field: 'idName', inputKey: 'idName', definitionKey: 'id', status: 'ready' }),
      expect.objectContaining({ field: 'name', inputKey: 'name', definitionKey: 'name', status: 'ready' }),
    ]);

    const blockedPolicy: ContentAuthoringPolicy = {
      ...readyPolicy,
      fields: [...readyPolicy.fields, { key: 'description', label: '描述', kind: 'string', section: 'basics' }],
    };
    const blocked = deriveDefinitionEditorDescriptor(blockedPolicy);
    expect(blocked.materialization).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'description', status: 'missing', reason: 'missing-materialization' }),
    ]));
    expect(blocked.runtimeReady).toBe(false);
    expect(blocked.capabilities.A1).toBe(false);
    expect(blocked.capabilities.blockers).toContain('missing-materialization');
  });

  test('derives multiple Policies without sharing mutable descriptor arrays', () => {
    const descriptors = deriveDefinitionEditorDescriptors(CONTENT_POLICIES);
    expect(descriptors.map(descriptor => descriptor.key)).toEqual(['inits', 'areas', 'spots', 'enhancements']);
    expect(descriptors[0].sections).not.toBe(descriptors[1].sections);
    expect(descriptors[0].writableFields).not.toBe(descriptors[1].writableFields);
  });
});

function createReadyPolicy(): ContentAuthoringPolicy {
  return {
    key: 'spots',
    label: 'Ready Spot',
    idType: 'spot',
    inputPrefix: 'spot',
    sections: [{ id: 'overview', label: '概览' }, { id: 'basics', label: '基础' }],
    fields: [
      { key: 'idName', label: 'ID', kind: 'entityName', section: 'basics' },
      { key: 'name', label: '名称', kind: 'string', section: 'basics' },
    ],
    materialization: [
      { field: 'idName', consumers: ['registry-record'], invalidate: 'none' },
      { field: 'name', consumers: ['ui-dynamic'], invalidate: 'none' },
    ],
    apply: 'local-mutation',
    state: 'retain',
    mutate: () => ({
      table: 'spots', operation: 'replace', ownerModName: 'test', defId: 'test:spot:ready',
      previousDef: undefined, currentDef: undefined, rollback: () => undefined,
    }),
  };
}
