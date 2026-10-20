/**
 * datapack.schema.test.ts —— Schema 校验器规则单测
 *
 * 旧 datapack/AronaClickerCore 分片目录已退役；当前 Runtime Base 内容也包含独立编辑器 Schema
 * 尚未覆盖的字段。本文件只验证编辑器已支持的校验规则，不作为 Runtime 内容的全量回归。
 */
import { describe, expect, it } from 'vitest';
import { validateDatapack } from '../validate';

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
  const pack = (conditions: unknown[], resources: unknown[] = [], tags: unknown[] = []) => ({
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
    tags,
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

  it('target=hasTag 使用完整 TagRef 引用标签表', () => {
    const issues = validateDatapack(
      pack(
        [{ target: 'hasTag', key: 'base:office', comparator: '==', value: 1 }],
        [],
        [{ id: 'base:office', name: '办公室' }],
      ),
    );
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('target=hasTag 拒绝非法 TagRef 格式', () => {
    const issues = validateDatapack(
      pack(
        [{ target: 'hasTag', key: 'bad:tag:path', comparator: '==', value: 1 }],
        [],
        [{ id: 'tag', name: '标签' }],
      ),
    );
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('合法 TagRef'))).toBe(true);
  });

  it('tags 表拒绝非法 id/parent，但允许裸 id', () => {
    const issues = validateDatapack({ tags: [
      { id: 'office', name: '办公室' },
      { id: 'bad:tag:path', name: '坏标签', parent: 'not-a-ref' },
    ] });
    expect(issues.filter((i) => i.severity === 'error').map(i => i.path)).toEqual([
      'tags[1].id', 'tags[1].parent',
    ]);
  });
});
