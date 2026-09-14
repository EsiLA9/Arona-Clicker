import { describe, expect, it } from 'vitest';
import {
  createDefinitionDelta,
  createDraftLayer,
  createSourceLayer,
  deleteLocalDefinition,
  removeOverride,
  resolveDefinition,
  resumeDefinition,
  setDefinitionRecord,
  suspendDefinition,
  type DefinitionKey,
  type DefinitionResolution,
} from '../../src/data-services';

interface TestDef {
  value: string;
}

const key: DefinitionKey = { table: 'spots', id: 'spot-a' };
const base = createSourceLayer(
  { kind: 'base', sourceId: 'base' },
  [{ key, source: { kind: 'base', sourceId: 'base' }, kind: 'owned', value: { value: 'base' } }],
);
const pack = createSourceLayer(
  { kind: 'pack', sourceId: 'pack-a' },
  [{ key, source: { kind: 'pack', sourceId: 'pack-a' }, kind: 'override', value: { value: 'pack' } }],
);

function missing(): DefinitionResolution<TestDef> {
  return { status: 'missing', key };
}

describe('Definition Resolution', () => {
  it('keeps a stable Draft owner and restores the shadowed source on resume', () => {
    const draft = suspendDefinition(createDraftLayer<TestDef>('workspace-1'), key);
    const suspended = resolveDefinition([draft, pack, base], key);

    expect(draft.tombstones).toEqual([{
      table: 'spots',
      id: 'spot-a',
      kind: 'suspend',
      owner: { kind: 'draft', sourceId: 'workspace-1' },
    }]);
    expect(suspended).toMatchObject({
      status: 'suspended',
      key,
      suspendedBy: { kind: 'draft', sourceId: 'workspace-1' },
      shadowedRecord: { value: { value: 'pack' } },
    });
    expect(resolveDefinition([resumeDefinition(draft, key), pack, base], key))
      .toMatchObject({ status: 'resolved', record: { value: { value: 'pack' } } });
  });

  it('does not create a suspended result when no source candidate exists', () => {
    const draft = suspendDefinition(createDraftLayer<TestDef>('workspace-1'), key);

    expect(resolveDefinition([draft], key)).toEqual(missing());
  });

  it('does not delete source records when suspending', () => {
    const draft = suspendDefinition(
      setDefinitionRecord(createDraftLayer<TestDef>('workspace-1'), key, { value: 'draft' }),
      key,
    );

    expect(draft.records).toHaveLength(1);
    expect(resolveDefinition([draft, pack, base], key)).toMatchObject({
      status: 'suspended',
      shadowedRecord: { value: { value: 'draft' } },
    });
  });

  it('falls back after delete-local and remove-override', () => {
    const ownedDraft = setDefinitionRecord(
      createDraftLayer<TestDef>('workspace-1'),
      key,
      { value: 'draft' },
      'owned',
    );
    const overrideDraft = setDefinitionRecord(
      createDraftLayer<TestDef>('workspace-1'),
      key,
      { value: 'draft-override' },
      'override',
    );

    expect(resolveDefinition([deleteLocalDefinition(ownedDraft, key), pack, base], key))
      .toMatchObject({ status: 'resolved', record: { value: { value: 'pack' } } });
    expect(resolveDefinition([removeOverride(overrideDraft, key), pack, base], key))
      .toMatchObject({ status: 'resolved', record: { value: { value: 'pack' } } });
  });

  it('cannot resume another source owner tombstone', () => {
    const draftA = suspendDefinition(createDraftLayer<TestDef>('workspace-a'), key);
    const draftB = createDraftLayer<TestDef>('workspace-b');
    const resumedByB = resumeDefinition(
      { ...draftB, tombstones: draftA.tombstones },
      key,
    );

    expect(resumedByB.tombstones).toEqual(draftA.tombstones);
  });
});

describe('Definition Delta', () => {
  it('projects resolution transitions into runtime-facing content changes', () => {
    const draft = suspendDefinition(createDraftLayer<TestDef>('workspace-1'), key);
    const resolvedBase = resolveDefinition([base], key);
    const resolvedPack = resolveDefinition([pack, base], key);
    const suspended = resolveDefinition([draft, pack, base], key);

    expect(createDefinitionDelta([missing()], [resolvedBase])).toMatchObject({
      added: [key],
      changed: [],
      removed: [],
      transitions: [{ key, before: 'missing', after: 'resolved' }],
    });
    expect(createDefinitionDelta([resolvedBase], [missing()])).toMatchObject({
      added: [],
      changed: [],
      removed: [key],
      transitions: [{ key, before: 'resolved', after: 'missing' }],
    });
    expect(createDefinitionDelta([resolvedPack], [suspended])).toMatchObject({
      removed: [key],
      transitions: [{ key, before: 'resolved', after: 'suspended' }],
    });
    expect(createDefinitionDelta([suspended], [resolvedPack])).toMatchObject({
      added: [key],
      transitions: [{ key, before: 'suspended', after: 'resolved' }],
    });
    expect(createDefinitionDelta([resolvedBase], [resolvedPack])).toMatchObject({
      changed: [key],
      transitions: [],
    });
  });
});
