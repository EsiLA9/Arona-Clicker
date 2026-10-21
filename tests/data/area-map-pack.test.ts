import { expect, test } from 'vitest';
import JSZip from 'jszip';
import { parsePackFromZipBuffer } from '../../src/data-services/datapack/pack-parser';
import { mergeFragments, parseFragment } from '../../src/data-services/datapack/fragment-parser';
import { Registry } from '../../src/data-services/registry/registry';

test('real fragmented ZIP retains AreaMap content and finalizes circular navigation references', async () => {
  const zip = new JSZip();
  zip.file('datapack.json', JSON.stringify({ modName: 'demo', name: 'Demo', version: '1.0.0' }));
  const a = { id: 'demo:area-map:a', name: 'A', nodes: [{ id: 'n', position: { x: 0, y: 0 }, action: { kind: 'openMap', mapId: 'demo:area-map:b' } }], edges: [] };
  const b = { ...a, id: 'demo:area-map:b', name: 'B', nodes: [{ ...a.nodes[0], action: { kind: 'openMap', mapId: a.id } }] };
  zip.file('data/a.json', JSON.stringify({ name: 'Demo', version: '1.0.0', areaMaps: [a] }));
  zip.file('data/b.json', JSON.stringify({ areaMaps: [b], maps: [] }));
  const parsed = await parsePackFromZipBuffer(await zip.generateAsync({ type: 'uint8array' }));
  expect(parsed.datapack.areaMaps).toEqual([a, b]);
  expect(parsed.datapack.maps).toEqual([]);
  const registry = new Registry();
  registry.load(parsed.datapack);
  expect(() => registry.validateAreaMapRefs()).not.toThrow();
});

test('fragment recognizes explicit empty navigation maps without inventing maps in legacy packs', () => {
  expect(mergeFragments([parseFragment('empty.json', '{"areaMaps":[]}')]).areaMaps).toEqual([]);
  expect(mergeFragments([]).areaMaps).toBeUndefined();
  expect(() => parseFragment('invalid.json', '{"areaMaps":{}}')).toThrow(/areaMaps/);
});
