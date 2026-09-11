// ============================================================
// data/zip-loader.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import JSZip from 'jszip';
import {
  loadDatapackFromZip,
  loadDatapackFromZipBuffer,
  ZipLoadError,
} from '../../src/data-services/datapack/zip-loader';
import { Registry } from '../../src/data-services/registry/registry';

const INIT_FRAGMENT = {
  name: 'Test Mod',
  version: '1.0.0',
  inits: [
    { id: 'test:init:init_a', name: 'Test Init', description: '', defaultAreas: ['test:area:area_1'] },
  ],
};

const AREA_FRAGMENT = {
  areas: [
    { id: 'test:area:area_1', initId: 'test:init:init_a', name: 'Test Area', description: '', defaultSpots: ['test:spot:spot_1'] },
  ],
};

const SPOT_FRAGMENT = {
  spots: [
    {
      id: 'test:spot:spot_1', areaId: 'test:area:area_1', name: 'Test Spot', description: '',
      baseCost: { type: 'const', value: 10 },
      baseCostResource: 'credit',
      baseYield: { type: 'const', value: 5 },
      baseYieldResource: 'credit',
      baseCapacity: 100,
      levelUpgrades: [],
      tags: [],
    },
  ],
};

function makeZip(files: Record<string, unknown>, dirs: string[] = []): JSZip {
  const zip = new JSZip();
  for (const dir of dirs) zip.folder(dir);
  for (const [path, data] of Object.entries(files)) {
    zip.file(path, typeof data === 'string' ? data : JSON.stringify(data));
  }
  return zip;
}

describe('loadDatapackFromZip', () => {
  test('合并多个分片文件为单个 Datapack 并通过 Registry 校验', async () => {
    const zip = makeZip({
      '01-inits.json': INIT_FRAGMENT,
      '02-areas.json': AREA_FRAGMENT,
      '03-spots.json': SPOT_FRAGMENT,
    });
    const { datapack, jsonFileCount, ignoredCount } = await loadDatapackFromZip(zip);

    expect(jsonFileCount).toBe(3);
    expect(ignoredCount).toBe(0);
    expect(datapack.name).toBe('Test Mod');
    expect(datapack.version).toBe('1.0.0');
    expect(datapack.inits).toHaveLength(1);
    expect(datapack.areas).toHaveLength(1);
    expect(datapack.spots).toHaveLength(1);
    // 跨文件引用完整性应由 Registry 校验通过
    const reg = new Registry();
    expect(() => reg.load(datapack)).not.toThrow();
  });

  test('递归遍历子目录中的 json 文件', async () => {
    const zip = makeZip({
      'mod/inits.json': INIT_FRAGMENT,
      'mod/content/areas.json': AREA_FRAGMENT,
      'mod/content/levels/spots.json': SPOT_FRAGMENT,
    });
    const { datapack, jsonFileCount } = await loadDatapackFromZip(zip);
    expect(jsonFileCount).toBe(3);
    expect(datapack.inits).toHaveLength(1);
    expect(datapack.spots).toHaveLength(1);
  });

  test('提取图片资产并统计 ignoredCount（图片不再计入忽略）', async () => {
    const zip = makeZip({
      'mod/inits.json': INIT_FRAGMENT,
      'mod/assets/icon.png': 'fake-png',
      'mod/assets/bg.webp': 'fake-webp',
      'mod/readme.md': '# mod',
      'mod/data.bson': 'binary',
    });
    const { jsonFileCount, ignoredCount, images } = await loadDatapackFromZip(zip);
    expect(jsonFileCount).toBe(1);
    expect(ignoredCount).toBe(2); // readme.md / data.bson
    expect(images).toHaveLength(2);
    expect(images.map(i => i.path)).toEqual(['mod/assets/icon.png', 'mod/assets/bg.webp']);
    expect(images[0].url).toMatch(/^data:image\/png;base64,/);
  });

  test('pics 列表字段并入 Datapack', async () => {
    const zip = makeZip({
      '00-pics.json': {
        pics: [
          { id: 'modA:avatar(pic):hoshino', src: 'zip:assets/avatar.png' },
          { id: 'modA:background(pic):office', src: 'https://example.com/bg.png' },
        ],
      },
    });
    const { datapack } = await loadDatapackFromZip(zip);
    expect(datapack.pics).toHaveLength(2);
    expect(datapack.pics![0].id).toBe('modA:avatar(pic):hoshino');
  });

  test('extras 分片合并，name/version 取首个出现的文件', async () => {
    const zip = makeZip({
      'a.json': { name: 'First', version: '2.0.0', extras: { 'theme.bg': 'red' } },
      'b.json': { name: 'Second', version: '9.9.9', extras: { 'theme.fg': 'white' } },
    });
    const { datapack } = await loadDatapackFromZip(zip);
    expect(datapack.name).toBe('First');
    expect(datapack.version).toBe('2.0.0');
    expect(datapack.extras).toEqual({ 'theme.bg': 'red', 'theme.fg': 'white' });
  });

  test('仅含未知字段的对象文件报 ZipLoadError', async () => {
    const zip = makeZip({ 'meta.json': { description: 'just metadata' } });
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(ZipLoadError);
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(/未包含任何 Datapack 字段/);
  });

  test('顶层为数组的文件报 ZipLoadError 并提示包装方式', async () => {
    const zip = makeZip({ 'items.json': [{ id: 'x' }] });
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(ZipLoadError);
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(/顶层是数组/);
  });

  test('非法 JSON 报 ZipLoadError 并携带文件路径', async () => {
    const zip = makeZip({ 'broken.json': '{ not valid json' });
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(/\[broken\.json\]/);
  });

  test('列表字段非数组时报错', async () => {
    const zip = makeZip({ 'spots.json': { spots: { id: 'x' } } });
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(ZipLoadError);
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(/"spots" 应为数组/);
  });

  test('压缩包内没有任何 json 时报错', async () => {
    const zip = makeZip({ 'readme.md': 'no json here' });
    await expect(loadDatapackFromZip(zip)).rejects.toThrow(/未找到任何 \.json 文件/);
  });
});

describe('loadDatapackFromZipBuffer', () => {
  test('从生成的 zip buffer 端到端加载', async () => {
    const zip = makeZip({
      'mod/inits.json': INIT_FRAGMENT,
      'mod/areas.json': AREA_FRAGMENT,
      'mod/spots.json': SPOT_FRAGMENT,
    });
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const { datapack } = await loadDatapackFromZipBuffer(buffer);
    expect(datapack.name).toBe('Test Mod');
    expect(datapack.version).toBe('1.0.0');
    expect(datapack.inits).toHaveLength(1);
    expect(datapack.areas).toHaveLength(1);
    expect(datapack.spots).toHaveLength(1);
  });
});
