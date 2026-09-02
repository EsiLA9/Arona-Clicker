import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { ZipPackSource } from '../../src/data-services/datapack/source';

describe('ZipPackSource', () => {
  test('将 zip 条目暴露为可读取的 PackEntry', async () => {
    const zip = new JSZip();
    zip.file('data/spots.json', '{"spots":[]}');
    zip.file('images/icon.png', new Uint8Array([1, 2, 3]));
    zip.file('empty/', '');

    const entries = await new ZipPackSource(zip).list();
    expect(entries.map(entry => entry.path)).toEqual(['data/spots.json', 'images/icon.png']);
    expect(new TextDecoder().decode(await entries[0].read())).toBe('{"spots":[]}');
    expect(Array.from(await entries[1].read())).toEqual([1, 2, 3]);
  });
});
