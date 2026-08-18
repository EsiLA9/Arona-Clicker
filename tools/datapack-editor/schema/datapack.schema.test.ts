/**
 * datapack.schema.test.ts —— 真实数据回归测试
 *
 * 用工具自身的 schema + 校验器校验 datapack/AronaClickerCore/*.json，
 * 必须 0 error。任何引擎类型更新导致的 schema 漂移都会在此暴露。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateDatapack } from '../validate';
import type { DatapackData } from '../validate';

const DATAPACK_DIR = join(import.meta.dirname, '../../../datapack/AronaClickerCore');

function loadDatapack(): DatapackData {
  const files = readdirSync(DATAPACK_DIR).filter((f) => f.endsWith('.json'));
  const merged: DatapackData = {};
  for (const file of files) {
    const partial = JSON.parse(readFileSync(join(DATAPACK_DIR, file), 'utf8')) as DatapackData;
    for (const [key, value] of Object.entries(partial)) {
      if (!(key in merged)) merged[key] = value;
      else if (Array.isArray(merged[key]) && Array.isArray(value)) {
        (merged[key] as unknown[]).push(...value);
      }
    }
  }
  return merged;
}

describe('真实 datapack 回归校验', () => {
  const data = loadDatapack();

  it('加载到数据（分片文件存在）', () => {
    const files = readdirSync(DATAPACK_DIR).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('schema 校验 0 error', () => {
    const issues = validateDatapack(data);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      const sample = errors.slice(0, 40).map((e) => `  ${e.message}`).join('\n');
      throw new Error(`schema 校验发现 ${errors.length} 个错误：\n${sample}`);
    }
    expect(errors).toEqual([]);
  });
});

describe('divider 横条（UI 语义分组，非数据字段）', () => {
  it('含 divider 的表校验正常，且不报未知字段', () => {
    const issues = validateDatapack({
      inits: [{ id: 'base:init:test', name: '测试', description: '', defaultAreas: [] }],
    });
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});

describe('叶子条件 tagged 联动（target 首枚举 → key 引用表）', () => {
  const pack = (conditions: unknown[], resources: unknown[] = []) => ({
    inits: [
      {
        id: 'base:init:test',
        name: '测试',
        description: '',
        defaultAreas: [],
        triggers: [{ id: 't1', on: { kind: 'tick', every: 1 }, condition: { type: 'AND', conditions } }],
      },
    ],
    resourceDisplays: resources,
  });

  it('target=resource 时 key 按资源表引用校验（credit 命中）', () => {
    const issues = validateDatapack(
      pack(
        [{ target: 'resource', key: 'base:resource:credit', comparator: '>=', value: 10 }],
        [{ resourceId: 'base:resource:credit', label: '信用点' }],
      ),
    );
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('target=resource 但 key 引用不存在 → 报资源表引用错误', () => {
    const issues = validateDatapack(
      pack(
        [{ target: 'resource', key: 'not_a_resource', comparator: '>=', value: 10 }],
        [{ resourceId: 'base:resource:credit', label: '信用点' }],
      ),
    );
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('resourceDisplays'))).toBe(true);
  });

  it('target=hasTag（自由文本）不校验引用表', () => {
    const issues = validateDatapack(pack([{ target: 'hasTag', key: 'any-tag', comparator: '==', value: 1 }]));
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});
