import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import {
  ArchiveWriteError,
  normalizeArchivePath,
  serializeArchiveJson,
  validateArchivePlan,
  writeZipArchive,
} from '../../src/data-services/archive/archive-writer';

describe('通用归档写出服务', () => {
  test('支持嵌套目录、文本和二进制条目，并按路径稳定排序', async () => {
    const plan = {
      entries: [
        { path: 'layouts/main/theme.json', content: serializeArchiveJson({ version: 1 }) },
        { path: 'assets/icon.bin', content: new Uint8Array([0, 1, 255]) },
        { path: 'datapack.json', content: '{"name":"demo"}\\n' },
      ],
    } as const;

    const entries = validateArchivePlan(plan);
    expect(entries.map(entry => entry.path)).toEqual(['assets/icon.bin', 'datapack.json', 'layouts/main/theme.json']);

    const bytes = await writeZipArchive(plan);
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)).toEqual(['assets/icon.bin', 'datapack.json', 'layouts/main/theme.json']);
    expect(await zip.file('layouts/main/theme.json')!.async('string')).toContain('"version": 1');
    expect([...await zip.file('assets/icon.bin')!.async('uint8array')]).toEqual([0, 1, 255]);
  });

  test('同一归档计划生成稳定字节，路径安全规则拒绝穿越与重复', async () => {
    const plan = { entries: [{ path: 'data/value.json', content: '{"ok":true}\\n' }] };
    const first = await writeZipArchive(plan);
    const second = await writeZipArchive(plan);
    expect([...first]).toEqual([...second]);

    expect(normalizeArchivePath('nested/file.txt')).toBe('nested/file.txt');
    expect(() => normalizeArchivePath('../outside.txt')).toThrow(ArchiveWriteError);
    expect(() => normalizeArchivePath('nested/../outside.txt')).toThrow(ArchiveWriteError);
    expect(() => normalizeArchivePath('C:/outside.txt')).toThrow(ArchiveWriteError);
    expect(() => normalizeArchivePath('nested\\\\file.txt')).toThrow(ArchiveWriteError);
    expect(() => validateArchivePlan({
      entries: [
        { path: 'same.txt', content: 'a' },
        { path: 'same.txt', content: 'b' },
      ],
    })).toThrow(/路径重复/);
  });
});
