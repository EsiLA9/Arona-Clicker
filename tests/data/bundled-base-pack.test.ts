import { describe, expect, test } from 'vitest';
import bundledManifest from '../../src/arona-clicker/content/base-pack/datapack.json';
import bundledContent from '../../src/arona-clicker/content/base-pack/content.json';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { parsePack } from '../../src/data-services/datapack/pack-parser';
import { FolderPackSource } from '../../src/data-services/datapack/source';

describe('发布基础数据包', () => {
  test('manifest 与完整 JSON 分片可由标准 PackSource 解析', async () => {
    const files: Array<{ path: string; value: unknown }> = [
      { path: 'datapack.json', value: bundledManifest },
      { path: 'content.json', value: bundledContent },
    ];
    const parsed = await parsePack(new FolderPackSource(files.map(({ path, value }) => ({
      path,
      read: async () => new TextEncoder().encode(JSON.stringify(value)),
    }))));

    expect(parsed.manifest).toMatchObject({ modName: 'base', version: '1.0.0', dependencies: [] });
    expect(parsed.datapack).toEqual(defaultDatapack);
    expect(parsed.jsonFileCount).toBe(1);
    expect(parsed.ignoredCount).toBe(0);
  });
});
