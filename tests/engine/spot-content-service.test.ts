import { describe, expect, test } from 'vitest';
import { SpotContentService, type SpotContentPort } from '../../src/arona-clicker/services/spot-content-service';
import type { RuntimeModApplyResult } from '../../src/arona-clicker/contracts/runtime';
import type { RuntimeModStateSnapshot, RuntimeSpotInput, RuntimeSpotMutation, RuntimeSpotMutationResult } from '../../src/arona-clicker/contracts/runtime-content';

const spot: RuntimeSpotInput = {
  idName: 'desk',
  areaId: 'base:area:main',
  name: 'Desk',
  description: '',
  purchaseOptions: [{ id: 'free', costs: [] }],
};

const state = {
  modName: 'draft-mod',
  sourceId: 'runtime-editor',
  spots: new Map(),
  suspendedSpotIds: new Set(),
  revision: 0,
} satisfies RuntimeModStateSnapshot;

describe('SpotContentService', () => {
  test('只转发单个 mutation，并保留 revision 与结果', () => {
    const mutations: RuntimeSpotMutation[] = [];
    const result: RuntimeSpotMutationResult = {
      ok: true,
      revision: 1,
      spotId: 'draft-mod:spot:desk',
      operation: 'create',
      diagnostics: [],
      message: 'ok',
    };
    const metadataResult: RuntimeModApplyResult = { ok: true, message: 'saved' };
    const port: SpotContentPort = {
      getState: () => state,
      setModMetadata: () => metadataResult,
      applyMutation: mutation => {
        mutations.push(mutation);
        return result;
      },
    };
    const content = new SpotContentService(port);

    expect(content.setModMetadata({ modName: 'draft-mod', displayName: 'Draft', version: '1.0.0', author: '', description: '' })).toBe(metadataResult);
    expect(content.create('draft-mod', spot, 0)).toBe(result);
    expect(content.getState()).toBe(state);
    expect(mutations).toEqual([{ operation: 'create', modName: 'draft-mod', spot, expectedRevision: 0 }]);
  });

  test('各快捷操作都只生成对应的一个 Spot mutation', () => {
    const mutations: RuntimeSpotMutation[] = [];
    const port: SpotContentPort = {
      getState: () => state,
      setModMetadata: () => ({ ok: true, message: 'saved' }),
      applyMutation: mutation => {
        mutations.push(mutation);
        return { ok: true, revision: mutations.length, spotId: 'draft-mod:spot:desk', operation: mutation.operation, diagnostics: [], message: 'ok' };
      },
    };
    const content = new SpotContentService(port);

    content.replace('draft-mod', 'desk', spot, 1);
    content.suspend('draft-mod', 'desk', 2);
    content.resume('draft-mod', 'desk', 3);
    content.delete('draft-mod', 'desk', 'retain', 4);

    expect(mutations.map(mutation => mutation.operation)).toEqual(['replace', 'suspend', 'resume', 'delete']);
    expect(mutations[3]).toMatchObject({ idName: 'desk', playerData: 'retain', expectedRevision: 4 });
  });
});
