import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { discoverDevelopmentDatapacks, parseDevelopmentPackFolderName } from '../../src/ui/development/development-datapack-loader';

const manifest = (modName: string, version: string) => JSON.stringify({ modName, name: 'Example', version, dependencies: [] });
const fragment = (version: string) => JSON.stringify({ name: 'Example', version, spots: [] });

describe('开发数据包固定目录发现', () => {
  it('只发现顶层 ZIP，并与命名展开目录读取等价数据、保留普通态/编辑态', async () => {
    const zip = new JSZip();
    zip.file('datapack.json', manifest('example', '1.2.0'));
    zip.file('00-content.json', fragment('1.2.0'));
    zip.file('assets/icon.svg', '<svg/>');
    const archiveBytes = await zip.generateAsync({ type: 'uint8array' });
    const files = new Map<string, Uint8Array>([
      ['/asset/example.zip', archiveBytes],
      ['/asset/example@1.2.0@finished/datapack.json', new TextEncoder().encode(manifest('example', '1.2.0'))],
      ['/asset/example@1.2.0@finished/00-content.json', new TextEncoder().encode(fragment('1.2.0'))],
      ['/asset/example@1.2.0@finished/assets/icon.svg', new TextEncoder().encode('<svg/>')],
      ['/asset/example@1.3.0@editing/datapack.json', new TextEncoder().encode(manifest('example', '1.3.0'))],
      ['/asset/example@1.3.0@editing/00-content.json', new TextEncoder().encode(fragment('1.3.0'))],
      ['/asset/not-a-package/readme.txt', new TextEncoder().encode('ignored')],
      ['/asset/nested/archive.zip', archiveBytes],
    ]);
    const discovered = await discoverDevelopmentDatapacks({
      '../../datapack-dev/example.zip': '/asset/example.zip',
      '../../datapack-dev/example@1.2.0@finished/datapack.json': '/asset/example@1.2.0@finished/datapack.json',
      '../../datapack-dev/example@1.2.0@finished/00-content.json': '/asset/example@1.2.0@finished/00-content.json',
      '../../datapack-dev/example@1.2.0@finished/assets/icon.svg': '/asset/example@1.2.0@finished/assets/icon.svg',
      '../../datapack-dev/example@1.3.0@editing/datapack.json': '/asset/example@1.3.0@editing/datapack.json',
      '../../datapack-dev/example@1.3.0@editing/00-content.json': '/asset/example@1.3.0@editing/00-content.json',
      '../../datapack-dev/not-a-package/readme.txt': '/asset/not-a-package/readme.txt',
      '../../datapack-dev/nested/archive.zip': '/asset/nested/archive.zip',
      '../../datapack/other.zip': '/asset/example.zip',
    }, async url => {
      const bytes = files.get(url);
      if (!bytes) throw new Error(`Missing test asset: ${url}`);
      return bytes;
    });

    expect(discovered.issues).toEqual([]);
    expect(discovered.packs.map(pack => [pack.sourcePath, pack.sourceKind, pack.editingMode])).toEqual([
      ['example.zip', 'zip', 'normal'],
      ['example@1.2.0@finished/', 'folder', 'normal'],
      ['example@1.3.0@editing/', 'folder', 'editing'],
    ]);
    expect(discovered.packs[0].datapack).toMatchObject(discovered.packs[1].datapack);
    expect(discovered.packs[0].images[0].path).toBe('assets/icon.svg');
    expect(discovered.packs[1].images[0].path).toBe('assets/icon.svg');
    expect(discovered.packs.every(pack => pack.id.startsWith('development:'))).toBe(true);
    expect(discovered.packs.some(pack => pack.sourcePath === 'nested/archive.zip')).toBe(false);
  });

  it('拒绝目录名与 manifest 身份不一致，但只报告该来源', async () => {
    const discovered = await discoverDevelopmentDatapacks({
      '../../datapack-dev/another@1.0@finished/datapack.json': 'manifest',
      '../../datapack-dev/another@1.0@finished/00-content.json': 'fragment',
      '../../datapack-dev/broken@1.0@finished/datapack.json': 'bad-manifest',
      '../../datapack-dev/broken@1.0@finished/00-content.json': 'bad-fragment',
      '../../datapack-dev/wrong-name/datapack.json': 'wrong-manifest',
      '../../datapack-dev/wrong-name/00-content.json': 'wrong-fragment',
    }, async url => new TextEncoder().encode(url === 'manifest'
      ? manifest('different', '1.0')
      : url === 'fragment'
        ? fragment('1.0')
        : url === 'bad-manifest'
          ? '{'
          : url === 'wrong-manifest'
            ? manifest('wrong-name', '1.0')
            : fragment('1.0')));

    expect(discovered.packs).toEqual([]);
    expect(discovered.issues).toHaveLength(3);
    expect(discovered.issues[0].message).toContain('目录身份 another@1.0');
    expect(discovered.issues[1].message).toContain('JSON 解析失败');
    expect(discovered.issues[2].message).toContain('目录名必须为');
  });

  it('只接受小写状态后缀及合法 ModName', () => {
    expect(parseDevelopmentPackFolderName('example-mod@2.0.0@editing')).toEqual({ modName: 'example-mod', version: '2.0.0', editingMode: 'editing' });
    expect(parseDevelopmentPackFolderName('example@2@finished')).toEqual({ modName: 'example', version: '2', editingMode: 'normal' });
    expect(parseDevelopmentPackFolderName('Example@2@finished')).toBeNull();
    expect(parseDevelopmentPackFolderName('example@2@draft')).toBeNull();
  });
});
