import { describe, expect, test } from 'vitest';
import { FragmentParseError, mergeFragments, parseFragment } from '../../src/data-services/datapack/fragment-parser';

describe('Datapack fragment parser', () => {
  test('解析分片并合并列表与 extras', () => {
    const first = parseFragment('a.json', '{"name":"Demo","spots":[{"id":"a"}],"extras":{"theme":{"bg":"red"}}}');
    const second = parseFragment('b.json', '{"spots":[{"id":"b"}],"version":"1.0.0"}');
    const datapack = mergeFragments([first, second]);
    expect(datapack.name).toBe('Demo');
    expect(datapack.version).toBe('1.0.0');
    expect(datapack.spots.map(spot => spot.id)).toEqual(['a', 'b']);
    expect(datapack.extras).toEqual({ theme: { bg: 'red' } });
  });

  test('错误包含分片路径', () => {
    expect(() => parseFragment('broken.json', '{')).toThrow(FragmentParseError);
    expect(() => parseFragment('broken.json', '{')).toThrow('[broken.json]');
  });
});
