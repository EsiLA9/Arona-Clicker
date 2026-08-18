/**
 * navi.test.ts —— 导航系统（NaviService / resolveRef / collectRefIds / resolveOptionsFrom）单测
 */
import { describe, expect, it } from 'vitest';
import { EditorModel } from '../model/editor-model';
import {
  NaviService,
  collectRefIds,
  collectRefOptions,
  refDisplay,
  resolveOptionsFrom,
  resolveRef,
} from './navi';

const sample = {
  spots: [
    { id: 'base:spot:alpha', name: 'A' },
    { id: 'base:spot:beta', name: 'B' },
  ],
  characters: [{ id: 'arona', school: '千年' }, { id: 'noa', school: '千年' }],
  extras: { 'meta/author': { t: 'str', v: 'admin' } },
};

function makeModel(): EditorModel {
  const m = new EditorModel();
  m.loadDatapack(sample);
  return m;
}

describe('NaviService', () => {
  it('订阅导航并广播目标', () => {
    const navi = new NaviService();
    const seen: unknown[] = [];
    const off = navi.onNavigate((t) => seen.push(t));
    navi.navigate({ table: 'spots', rowIndex: 1 });
    off();
    navi.navigate({ table: 'spots', rowIndex: 2 });
    expect(seen).toEqual([{ table: 'spots', rowIndex: 1 }]);
  });
});

describe('collectRefIds', () => {
  it('array 表收集 idField 全部 ID', () => {
    const m = makeModel();
    expect(collectRefIds(m, 'spots')).toEqual(['base:spot:alpha', 'base:spot:beta']);
  });

  it('record 表收集 key', () => {
    const m = makeModel();
    expect(collectRefIds(m, 'extras')).toEqual(['meta/author']);
  });
});

describe('collectRefOptions', () => {
  it('array 表收集 id + 可读名', () => {
    const m = makeModel();
    expect(collectRefOptions(m, 'spots')).toEqual([
      { id: 'base:spot:alpha', name: 'A' },
      { id: 'base:spot:beta', name: 'B' },
    ]);
  });

  it('record 表收集 key（名称为空）', () => {
    const m = makeModel();
    expect(collectRefOptions(m, 'extras')).toEqual([{ id: 'meta/author', name: '' }]);
  });
});

describe('refDisplay', () => {
  it('解析到目标时返回 "名 (id)"', () => {
    const m = makeModel();
    expect(refDisplay(m, 'spots', 'base:spot:alpha')).toBe('A (base:spot:alpha)');
  });

  it('找不到名称或未解析时原样返回 id', () => {
    const m = makeModel();
    expect(refDisplay(m, 'extras', 'meta/author')).toBe('meta/author');
    expect(refDisplay(m, 'spots', 'nope')).toBe('nope');
    expect(refDisplay(m, 'spots', '')).toBe('');
  });
});

describe('resolveRef', () => {
  it('array 表按 id 定位行索引', () => {
    const m = makeModel();
    expect(resolveRef(m, 'spots', 'base:spot:beta')).toEqual({ table: 'spots', rowIndex: 1 });
  });

  it('record 表按 key 定位（rowIndex=-1）', () => {
    const m = makeModel();
    expect(resolveRef(m, 'extras', 'meta/author')).toEqual({
      table: 'extras',
      rowIndex: -1,
      recordKey: 'meta/author',
    });
  });

  it('找不到返回 null（含空值）', () => {
    const m = makeModel();
    expect(resolveRef(m, 'spots', 'nope')).toBeNull();
    expect(resolveRef(m, 'spots', '')).toBeNull();
    expect(resolveRef(m, 'extras', 'nope')).toBeNull();
  });
});

describe('resolveOptionsFrom', () => {
  it('定位来源表首个匹配行', () => {
    const m = makeModel();
    expect(resolveOptionsFrom(m, { table: 'characters', field: 'school' }, '千年')).toEqual({
      table: 'characters',
      rowIndex: 0,
    });
  });

  it('找不到返回 null', () => {
    const m = makeModel();
    expect(resolveOptionsFrom(m, { table: 'characters', field: 'school' }, '山海经')).toBeNull();
  });
});
