import { describe, expect, it } from 'vitest';
import { parsePackFromZipBuffer } from '../../../src/data-services/datapack/pack-parser';
import { jsonArchiveEntry, writeZipArchive } from '../../../src/data-services/archive/archive-writer';
import { EditorModel } from '../model/editor-model';
import { createDatapackPackage, readEditorProject, readFormImport } from './io';

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
  it('uses the same complete-input gate for JSON, ZIP and directory form imports', async () => {
    const json = new File([JSON.stringify(operationData)], 'content.json');
    const asDirectory = (name: string, value: unknown) => {
      const file = new File([JSON.stringify(value)], name.split('/').pop()!);
      Object.defineProperty(file, 'webkitRelativePath', { value: `pack/${name}` });
      return file;
    };
    const manifestFile = asDirectory('datapack.json', manifest);
    const nestedFile = asDirectory('world/nested/content.json', operationData);
    const zipBytes = await createDatapackPackage(operationData, manifest);
    const zip = new File([new Uint8Array(zipBytes)], 'pack.zip');
    for (const imported of await Promise.all([
      readFormImport([json]), readFormImport([zip]), readFormImport([manifestFile, nestedFile], true),
    ])) {
      expect(imported.project.status).toBe('complete');
      expect(imported.datapack.operationLocations).toEqual(operationData.operationLocations);
    }
    expect((await readFormImport([manifestFile, nestedFile], true)).sourceName).toBe('pack');

    const brokenFile = asDirectory('world/bad.json', { spots: null });
    const brokenZipBytes = await writeZipArchive({ entries: [
      jsonArchiveEntry('datapack.json', manifest), jsonArchiveEntry('content.json', operationData),
      jsonArchiveEntry('world/bad.json', { spots: null }),
    ] });
    await expect(readFormImport([brokenFile])).rejects.toThrow('bad.json');
    await expect(readFormImport([new File([new Uint8Array(brokenZipBytes)], 'bad.zip')])).rejects.toThrow('world/bad.json');
    await expect(readFormImport([manifestFile, nestedFile, brokenFile], true)).rejects.toThrow('world/bad.json');
    const partial = await readEditorProject([manifestFile, nestedFile, brokenFile], true);
    expect(partial).toMatchObject({ status: 'incomplete' });
    expect(partial.definitions.some(row => row.table === 'operationLocations')).toBe(true);
  });

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
