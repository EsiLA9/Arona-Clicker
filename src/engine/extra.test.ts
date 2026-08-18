// ============================================================
// engine/extra.test.ts — Extra 格式底座（M1）单元测试
// ============================================================
import { describe, test, expect } from 'vitest';
import { ExtraCompound, ExtraValue } from './types';
import {
  extra,
  ExtraError,
  EXTRA_MAX_DEPTH,
  extraFromJson,
  cloneExtra,
  parseExtraPath,
  getAtPath,
  setAtPath,
  deleteAtPath,
  mergeExtra,
  expandFlatKeys,
  toNumber,
  toString,
  toBool,
  readNumber,
  readString,
  readBool,
  validateExtraValue,
  assertValidExtra,
  isDict,
  isList,
  isInt,
} from './extra';

/** 测试辅助：断言节点为 dict 并取出其表（收窄 ExtraValue 联合）。 */
function dictOf(v: ExtraValue): Record<string, ExtraValue> {
  if (!isDict(v)) throw new Error('expected dict node');
  return v.v;
}

describe('extra constructors', () => {
  test('should build all six variants', () => {
    expect(extra.int(3)).toEqual({ t: 'int', v: 3 });
    expect(extra.float(1.5)).toEqual({ t: 'float', v: 1.5 });
    expect(extra.str('x')).toEqual({ t: 'str', v: 'x' });
    expect(extra.bool(true)).toEqual({ t: 'bool', v: true });
    expect(extra.list(extra.int(1), extra.str('a'))).toEqual({ t: 'list', v: [{ t: 'int', v: 1 }, { t: 'str', v: 'a' }] });
    expect(extra.dict({ a: extra.int(1) })).toEqual({ t: 'dict', v: { a: { t: 'int', v: 1 } } });
  });

  test('should truncate float to int for int()', () => {
    expect(extra.int(3.7)).toEqual({ t: 'int', v: 3 });
  });
});

describe('extraFromJson', () => {
  test('should map scalar types', () => {
    expect(extraFromJson(3)).toEqual({ t: 'int', v: 3 });
    expect(extraFromJson(3.5)).toEqual({ t: 'float', v: 3.5 });
    expect(extraFromJson('hi')).toEqual({ t: 'str', v: 'hi' });
    expect(extraFromJson(false)).toEqual({ t: 'bool', v: false });
  });

  test('should map arrays and objects recursively', () => {
    const node = extraFromJson({ a: [1, 'x', { b: true }], c: 2.5 });
    expect(node).toEqual({
      t: 'dict',
      v: {
        a: { t: 'list', v: [{ t: 'int', v: 1 }, { t: 'str', v: 'x' }, { t: 'dict', v: { b: { t: 'bool', v: true } } }] },
        c: { t: 'float', v: 2.5 },
      },
    });
  });

  test('should reject null/undefined', () => {
    expect(() => extraFromJson(null)).toThrow(ExtraError);
    expect(() => extraFromJson(undefined)).toThrow(ExtraError);
  });

  test('should reject dict key containing slash', () => {
    expect(() => extraFromJson({ 'a/b': 1 })).toThrow(ExtraError);
  });

  test('should enforce max depth', () => {
    let raw: unknown = 1;
    for (let i = 0; i < EXTRA_MAX_DEPTH + 2; i++) raw = { a: raw };
    expect(() => extraFromJson(raw)).toThrow(ExtraError);
  });
});

describe('cloneExtra', () => {
  test('should deep-copy independently', () => {
    const node = extra.dict({ a: extra.list(extra.int(1)) });
    const copy = cloneExtra(node) as ExtraCompound;
    expect(copy).toEqual(node);
    expect(copy).not.toBe(node);
    expect((copy.v.a.v as ExtraValue[])).not.toBe((node.v.a.v as ExtraValue[]));
    (copy.v.a.v as ExtraValue[]).push(extra.int(2));
    expect(node.v.a.v).toHaveLength(1);
  });
});

describe('parseExtraPath', () => {
  test('should parse valid paths', () => {
    expect(parseExtraPath('a/b/c')).toEqual(['a', 'b', 'c']);
    expect(parseExtraPath('inv/0/name')).toEqual(['inv', '0', 'name']);
    expect(parseExtraPath('single')).toEqual(['single']);
  });

  test('should reject invalid paths', () => {
    expect(() => parseExtraPath('')).toThrow(ExtraError);
    expect(() => parseExtraPath('/a')).toThrow(ExtraError);
    expect(() => parseExtraPath('a/')).toThrow(ExtraError);
    expect(() => parseExtraPath('a//b')).toThrow(ExtraError);
  });
});

describe('getAtPath', () => {
  const tree = extra.dict({
    meta: extra.dict({ rank: extra.int(3), name: extra.str('foo') }),
    inv: extra.list(extra.dict({ name: extra.str('sword') })),
    on: extra.bool(true),
  });

  test('should read nested dict values', () => {
    expect(getAtPath(tree, 'meta/rank')).toEqual({ t: 'int', v: 3 });
    expect(getAtPath(tree, 'meta/name')).toEqual({ t: 'str', v: 'foo' });
    expect(getAtPath(tree, 'on')).toEqual({ t: 'bool', v: true });
  });

  test('should read list by index', () => {
    expect(getAtPath(tree, 'inv/0/name')).toEqual({ t: 'str', v: 'sword' });
  });

  test('should return undefined when missing or unreachable', () => {
    expect(getAtPath(tree, 'meta/unknown')).toBeUndefined();
    expect(getAtPath(tree, 'nope')).toBeUndefined();
    // int 节点不能下钻
    expect(getAtPath(tree, 'meta/rank/x')).toBeUndefined();
    // 非数字段落在 list 上
    expect(getAtPath(tree, 'inv/name')).toBeUndefined();
  });

  test('should return undefined for undefined root', () => {
    expect(getAtPath(undefined, 'a')).toBeUndefined();
  });
});

describe('setAtPath', () => {
  test('should create intermediate dicts', () => {
    const root = setAtPath(undefined, 'story/choice/3', extra.int(1));
    expect(root).toEqual({
      t: 'dict',
      v: { story: { t: 'dict', v: { choice: { t: 'dict', v: { '3': { t: 'int', v: 1 } } } } } },
    });
  });

  test('should overwrite existing scalar leaf', () => {
    const root = extra.dict({ a: extra.int(1) });
    setAtPath(root, 'a', extra.str('x'));
    expect(getAtPath(root, 'a')).toEqual({ t: 'str', v: 'x' });
  });

  test('should push and replace list items', () => {
    const root = extra.dict({ inv: extra.list(extra.str('a')) });
    setAtPath(root, 'inv/1', extra.str('b'));
    expect(root.v.inv.v).toHaveLength(2);
    setAtPath(root, 'inv/0', extra.str('c'));
    expect((root.v.inv.v as ExtraValue[])[0]).toEqual({ t: 'str', v: 'c' });
  });

  test('should throw on out-of-bounds list index', () => {
    const root = extra.dict({ inv: extra.list(extra.str('a')) });
    expect(() => setAtPath(root, 'inv/5', extra.str('x'))).toThrow(ExtraError);
  });

  test('should throw when drilling into non-container', () => {
    const root = extra.dict({ a: extra.int(1) });
    expect(() => setAtPath(root, 'a/b', extra.int(2))).toThrow(ExtraError);
    // 中间段为 list 且下一段非数字
    const root2 = extra.dict({ inv: extra.list(extra.str('a')) });
    expect(() => setAtPath(root2, 'inv/name', extra.int(2))).toThrow(ExtraError);
  });
});

describe('deleteAtPath', () => {
  test('should delete dict key and return removed node', () => {
    const root = extra.dict({ a: extra.int(1), b: extra.int(2) });
    expect(deleteAtPath(root, 'a')).toEqual({ t: 'int', v: 1 });
    expect(root.v.a).toBeUndefined();
    expect(root.v.b).toBeDefined();
  });

  test('should splice list index', () => {
    const root = extra.dict({ inv: extra.list(extra.str('a'), extra.str('b')) });
    expect(deleteAtPath(root, 'inv/0')).toEqual({ t: 'str', v: 'a' });
    expect(root.v.inv.v).toHaveLength(1);
    expect((root.v.inv.v as ExtraValue[])[0]).toEqual({ t: 'str', v: 'b' });
  });

  test('should return undefined when missing', () => {
    expect(deleteAtPath(undefined, 'a')).toBeUndefined();
    expect(deleteAtPath(extra.dict({}), 'a')).toBeUndefined();
  });
});

describe('mergeExtra', () => {
  test('should deep-merge dicts and replace scalars/lists', () => {
    const target = extra.dict({
      a: extra.dict({ x: extra.int(1), y: extra.int(2) }),
      list: extra.list(extra.int(1)),
      keep: extra.int(5),
    });
    const source = extra.dict({
      a: extra.dict({ y: extra.int(20), z: extra.int(3) }),
      list: extra.list(extra.int(9)),
    });
    const result = mergeExtra(target, source);
    expect(result.v.a.v).toEqual({
      x: { t: 'int', v: 1 },
      y: { t: 'int', v: 20 },
      z: { t: 'int', v: 3 },
    });
    // list 整体替换，keep 保留
    expect(result.v.list).toEqual({ t: 'list', v: [{ t: 'int', v: 9 }] });
    expect(result.v.keep).toEqual({ t: 'int', v: 5 });
  });

  test('should clone source values (no aliasing)', () => {
    const target = extra.dict({});
    const source = extra.dict({ a: extra.dict({ x: extra.int(1) }) });
    const result = mergeExtra(target, source);
    expect(result.v.a).not.toBe(source.v.a);
    expect(dictOf(result.v.a).x).not.toBe(dictOf(source.v.a).x);
  });

  test('should reject non-dict source', () => {
    expect(() => mergeExtra(extra.dict({}), extra.int(1))).toThrow(ExtraError);
  });
});

describe('expandFlatKeys', () => {
  test('should expand flat keys into tree', () => {
    const root = expandFlatKeys({
      'globals/softCap': extra.int(1000),
      'meta/rank': extra.int(3),
      single: extra.str('x'),
    });
    expect(root).toEqual({
      t: 'dict',
      v: {
        globals: { t: 'dict', v: { softCap: { t: 'int', v: 1000 } } },
        meta: { t: 'dict', v: { rank: { t: 'int', v: 3 } } },
        single: { t: 'str', v: 'x' },
      },
    });
  });

  test('should throw on conflicting keys', () => {
    expect(() => expandFlatKeys({ 'a/b': extra.int(1), a: extra.int(2) })).toThrow(ExtraError);
    expect(() => expandFlatKeys({ a: extra.int(1), 'a/b': extra.int(2) })).toThrow(ExtraError);
  });
});

describe('loose readers', () => {
  const tree = extra.dict({
    n: extra.int(3),
    f: extra.float(1.5),
    s: extra.str('hi'),
    on: extra.bool(true),
    off: extra.bool(false),
    list: extra.list(extra.int(1)),
  });

  test('toNumber should map int/float/bool', () => {
    expect(toNumber(getAtPath(tree, 'n'))).toBe(3);
    expect(toNumber(getAtPath(tree, 'f'))).toBe(1.5);
    expect(toNumber(getAtPath(tree, 'on'))).toBe(1);
    expect(toNumber(getAtPath(tree, 'off'))).toBe(0);
    expect(toNumber(getAtPath(tree, 's'))).toBe(0);
    expect(toNumber(getAtPath(tree, 'list'))).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  test('toString should only read str', () => {
    expect(toString(getAtPath(tree, 's'))).toBe('hi');
    expect(toString(getAtPath(tree, 'n'))).toBe('');
    expect(toString(undefined)).toBe('');
  });

  test('toBool should only read bool', () => {
    expect(toBool(getAtPath(tree, 'on'))).toBe(true);
    expect(toBool(getAtPath(tree, 'off'))).toBe(false);
    expect(toBool(getAtPath(tree, 'n'))).toBe(false);
    expect(toBool(undefined)).toBe(false);
  });

  test('readNumber/readString/readBool convenience', () => {
    expect(readNumber(tree, 'n')).toBe(3);
    expect(readNumber(tree, 'missing')).toBe(0);
    expect(readString(tree, 's')).toBe('hi');
    expect(readString(tree, 'missing')).toBe('');
    expect(readBool(tree, 'on')).toBe(true);
    expect(readBool(tree, 'missing')).toBe(false);
  });
});

describe('validateExtraValue', () => {
  test('should accept valid tree', () => {
    const node = extra.dict({ a: extra.list(extra.int(1), extra.bool(true)) });
    expect(validateExtraValue(node)).toEqual([]);
  });

  test('should flag non-integer int', () => {
    expect(validateExtraValue({ t: 'int', v: 1.5 })).toHaveLength(1);
  });

  test('should flag empty / slash keys', () => {
    expect(validateExtraValue(extra.dict({ '': extra.int(1) }))).toHaveLength(1);
    expect(validateExtraValue(extra.dict({ 'a/b': extra.int(1) }))).toHaveLength(1);
  });

  test('should flag unknown variant', () => {
    expect(validateExtraValue({ t: 'wat', v: 1 } as unknown as ExtraValue)).toHaveLength(1);
  });

  test('should enforce max depth', () => {
    let node: ExtraValue = extra.int(1);
    for (let i = 0; i < EXTRA_MAX_DEPTH + 1; i++) node = extra.dict({ a: node });
    expect(validateExtraValue(node)).toHaveLength(1);
  });

  test('assertValidExtra throws on first error', () => {
    expect(() => assertValidExtra(extra.dict({ 'a/b': extra.int(1) }))).toThrow(ExtraError);
    expect(() => assertValidExtra(extra.dict({ ok: extra.int(1) }))).not.toThrow();
  });
});

describe('guards', () => {
  test('should narrow variants', () => {
    const d = extra.dict({});
    const l = extra.list(extra.int(1));
    const i = extra.int(1);
    expect(isDict(d)).toBe(true);
    expect(isList(l)).toBe(true);
    expect(isInt(i)).toBe(true);
    expect(isDict(l)).toBe(false);
    expect(isList(d)).toBe(false);
  });
});
