import { describe, expect, test } from 'vitest';
import bundledManifest from '../../src/arona-clicker/content/base-pack/datapack.json';
import bundledContent from '../../src/arona-clicker/content/base-pack/content.json';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { parsePack } from '../../src/data-services/datapack/pack-parser';
import { FolderPackSource } from '../../src/data-services/datapack/source';

describe('发布基础数据包', () => {
  test('运行时内置图片引用使用直接资源 URL，而不是文件包 zip 路径', () => {
    expect(bundledContent.pics?.find(pic => pic.id === 'base:background(pic):hoshino')?.src).toBe('/src/data/Hoshino.png');
    expect(bundledContent.pics?.every(pic => !pic.src.startsWith('zip:'))).toBe(true);
  });

  test('Schale 主厅不再声明面板清空层，由 UI 主题服务生成主题色基底', () => {
    const area = bundledContent.areas.find(item => item.id === 'base:area:schale_main');
    const hosts = area?.presentation?.default?.theme?.presentation?.hosts ?? [];
    for (const hostId of ['leftPanel.area', 'centerPanel.chat', 'rightPanel.spot']) {
      expect(hosts.some(host => host.id === hostId)).toBe(false);
    }
  });

  test('manifest 与完整 JSON 分片可由标准 PackSource 解析', async () => {
    const files: Array<{ path: string; value: unknown }> = [
      { path: 'datapack.json', value: bundledManifest },
      { path: 'content.json', value: bundledContent },
    ];
    const parsed = await parsePack(new FolderPackSource(files.map(({ path, value }) => ({
      path,
      read: async () => new TextEncoder().encode(JSON.stringify(value)),
    }))));

    expect(parsed.manifest).toMatchObject({ modName: 'base', version: '1.0.2', dependencies: [] });
    expect(parsed.datapack).toEqual(defaultDatapack);
    expect(parsed.jsonFileCount).toBe(1);
    expect(parsed.ignoredCount).toBe(0);
  });
});
