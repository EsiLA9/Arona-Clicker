import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { parsePack, parsePackFromZipBuffer } from '../../src/data-services/datapack/pack-parser';
import { ZipPackSource } from '../../src/data-services/datapack/source';

function makePack(extra: Record<string, string> = {}) {
  const zip = new JSZip();
  zip.file('datapack.json', JSON.stringify({ modName: 'demo', name: 'Demo', version: '1.0.0' }));
  zip.file('data/content.json', JSON.stringify({ name: 'Demo', version: '1.0.0', spots: [] }));
  for (const [path, content] of Object.entries(extra)) zip.file(path, content);
  return new ZipPackSource(zip);
}

describe('parsePack', () => {
  test('解析 manifest、分片与图片资源', async () => {
    const pack = await parsePack(makePack({ 'images/icon.svg': '<svg></svg>', 'notes.txt': 'ignored' }));
    expect(pack.manifest.modName).toBe('demo');
    expect(pack.datapack.modName).toBe('demo');
    expect(pack.datapack.name).toBe('Demo');
    expect(pack.jsonFileCount).toBe(1);
    expect(pack.images[0].url).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(pack.ignoredCount).toBe(1);
  });

  test('缺少 manifest 时拒绝', async () => {
    const source = new ZipPackSource(new JSZip().file('data/content.json', '{"name":"Demo","version":"1.0.0","spots":[]}'));
    await expect(parsePack(source)).rejects.toThrow(/datapack\.json/);
  });

  test('manifest 与分片元数据不一致时拒绝', async () => {
    const source = makePack();
    const zip = new JSZip();
    zip.file('datapack.json', JSON.stringify({ modName: 'demo', name: 'Other', version: '1.0.0' }));
    zip.file('data/content.json', '{"name":"Demo","version":"1.0.0","spots":[]}');
    await expect(parsePack(new ZipPackSource(zip))).rejects.toThrow(/不一致/);
    expect(source).toBeDefined();
  });

  test('提供 ZIP buffer 便捷入口', async () => {
    const zip = new JSZip();
    zip.file('datapack.json', '{"modName":"demo","name":"Demo","version":"1.0.0"}');
    zip.file('content.json', '{"name":"Demo","version":"1.0.0","spots":[]}');
    const parsed = await parsePackFromZipBuffer(await zip.generateAsync({ type: 'uint8array' }));
    expect(parsed.manifest.modName).toBe('demo');
  });
});
