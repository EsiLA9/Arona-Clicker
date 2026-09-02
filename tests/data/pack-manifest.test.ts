import { describe, expect, test } from 'vitest';
import { ManifestError, parsePackManifest } from '../../src/data-services/datapack/manifest';

describe('PackManifest', () => {
  test('解析并规范化完整 manifest', () => {
    expect(parsePackManifest({
      modName: 'my-mod', name: 'My Mod', version: '1.0.0', author: 'A',
      dependencies: ['other-mod'], icon: 'images/icon.png',
    })).toEqual({
      modName: 'my-mod', name: 'My Mod', version: '1.0.0', author: 'A',
      dependencies: ['other-mod'], icon: 'images/icon.png',
    });
  });

  test('可省略可选字段，dependencies 默认为空', () => {
    expect(parsePackManifest({ modName: 'my-mod', name: 'My Mod', version: '1.0.0' }).dependencies).toEqual([]);
  });

  test('拒绝缺失字段与非法 modName', () => {
    expect(() => parsePackManifest({ name: 'x', version: '1.0.0' })).toThrow(ManifestError);
    expect(() => parsePackManifest({ modName: 'My_Mod', name: 'x', version: '1.0.0' })).toThrow(/modName/);
  });

  test('拒绝错误的 dependencies 类型', () => {
    expect(() => parsePackManifest({ modName: 'my-mod', name: 'x', version: '1.0.0', dependencies: ['bad_mod'] })).toThrow(/dependencies/);
  });
});
