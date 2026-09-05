import { describe, expect, test } from 'vitest';
import { isTagRef, parseTagRef, tagRef } from '../../src/engine/core/tag';

describe('TagRef', () => {
  test('使用包命名空间构造完整 TagRef', () => {
    const ref = tagRef('base', ['office', 'defense']);
    expect(ref).toBe('base:office/defense');
    expect(parseTagRef(ref)).toEqual({ modName: 'base', path: ['office', 'defense'] });
  });

  test('拒绝非法命名空间或路径', () => {
    expect(isTagRef('base:office')).toBe(true);
    expect(isTagRef('Base:office')).toBe(false);
    expect(isTagRef('base:office/')).toBe(false);
    expect(() => tagRef('base_mod', ['office'])).toThrow('非法 TagRef');
  });

  test('Tag 不是三段式实体 ID', () => {
    expect(tagRef('my-mod', ['haunted', 'underground'])).toBe('my-mod:haunted/underground');
    expect(isTagRef('my-mod:tag:haunted')).toBe(false);
  });
});
