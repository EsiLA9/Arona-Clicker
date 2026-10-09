import { describe, expect, it } from 'vitest';
import { parsePackFromZipBuffer } from '../../../src/data-services/datapack/pack-parser';
import { EditorModel } from '../model/editor-model';
import { createDatapackPackage } from './io';

const manifest = {
  modName: 'scene-authoring',
  name: 'Atomic Scene Authoring',
  version: '1.2.0',
  author: 'Author',
  dependencies: ['base'],
};

const operationData = {
  inits: [],
  areas: [],
  spots: [],
  name: manifest.name,
  version: manifest.version,
  modName: manifest.modName,
  operationEvents: [{ id: 'scene-authoring:event:sample', extension: { tree: [{ keep: true }] } }],
  operationLocations: [{ id: 'scene-authoring:location:sample', extension: { values: [1, null, { deep: 'value' }] } }],
  operationActions: [{ id: 'scene-authoring:action:sample', extension: { arbitrary: { nested: ['json'] } } }],
  studentOperationProfiles: [{ id: 'scene-authoring:student-profile:sample', extension: [{ nested: true }] }],
  operationStrategyProfiles: [{ id: 'scene-authoring:strategy-profile:sample', extension: { bias: 21 } }],
  operationCardPools: [{ id: 'scene-authoring:card-pool:sample', extension: { entries: [{ weight: 3 }] } }],
};

describe('Datapack Editor package I/O', () => {
  it('exports and re-imports all Operation tables and package metadata through PackParser', async () => {
    const firstBytes = await createDatapackPackage(operationData, manifest);
    const firstParsed = await parsePackFromZipBuffer(firstBytes);

    expect(firstParsed.manifest).toMatchObject(manifest);
    expect(firstParsed.datapack.modName).toBe(manifest.modName);
    for (const table of [
      'operationEvents', 'operationLocations', 'operationActions',
      'studentOperationProfiles', 'operationStrategyProfiles', 'operationCardPools',
    ] as const) {
      expect(firstParsed.datapack[table]).toEqual(operationData[table]);
    }

    const editor = new EditorModel();
    editor.loadDatapack(firstParsed.datapack as unknown as Record<string, unknown>, firstParsed.manifest);
    const editedPayload = { preserved: [null, { futureShape: true }] };
    editor.setValue('operationLocations', 0, ['extension', 'values'], editedPayload);
    const secondBytes = await createDatapackPackage(editor.toDatapack(), editor.getPackageMetadata());
    const secondParsed = await parsePackFromZipBuffer(secondBytes);

    expect(secondParsed.manifest).toMatchObject(manifest);
    expect((secondParsed.datapack.operationLocations?.[0] as unknown as Record<string, unknown>).extension)
      .toEqual({ values: editedPayload });
    expect(secondParsed.datapack.operationEvents).toEqual(operationData.operationEvents);
    expect(secondParsed.datapack.operationActions).toEqual(operationData.operationActions);
    expect(secondParsed.datapack.studentOperationProfiles).toEqual(operationData.studentOperationProfiles);
    expect(secondParsed.datapack.operationStrategyProfiles).toEqual(operationData.operationStrategyProfiles);
    expect(secondParsed.datapack.operationCardPools).toEqual(operationData.operationCardPools);
  });
});
