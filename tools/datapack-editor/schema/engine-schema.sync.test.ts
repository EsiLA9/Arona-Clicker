/**
 * engine-schema.sync.test.ts —— 引擎类型 ↔ editor schema 三向一致性
 *
 * 复用 scripts/gen-engine-schema.mjs 的解析器重新解析 src/engine/types/**，
 * 与提交的 engine-defs.gen.json 及 merge 后的 TABLES 对比，防"引擎新增字段/枚举
 * 但 editor 未同步"的漂移（error 红灯）。
 */
import { describe, expect, it } from 'vitest';
import { parseEngineSchema } from '../../../scripts/gen-engine-schema';
import { TABLE_META } from './editor-extras';
import { getTable, TABLES } from './datapack.schema';
import type { FieldDef, FieldType } from './types';

const schema = parseEngineSchema();
const VALID_KEYS = new Set<string>(TABLES.map((t) => t.key));

/**
 * 递归收集 FieldType 中的所有 ref 表引用。
 * 递归结构（conditionsField / valueExpressionField）通过指纹去重防循环，
 * 深度上限兜底（引擎不允许过深的条件嵌套）。
 */
function collectRefs(type: FieldType, out: Set<string>, seen: Set<string>, depth = 0): void {
  if (depth > 25) return;
  switch (type.kind) {
    case 'ref':
      out.add(type.table);
      break;
    case 'array': {
      const sig = `array:${type.item.key}:${type.item.label}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      collectRefs(type.item.type, out, seen, depth + 1);
      break;
    }
    case 'object': {
      const sig = `object:${type.fields.map((f) => f.key).join(',')}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      for (const f of type.fields) collectRefs(f.type, out, seen, depth + 1);
      break;
    }
    case 'record':
      collectRefs(type.value.type, out, seen, depth + 1);
      break;
    case 'union': {
      const sig = `union:${type.tagField}:${type.variants.map((v) => v.tag).join('|')}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      for (const v of type.variants) {
        const fields = typeof v.fields === 'function' ? v.fields() : v.fields;
        for (const f of fields) collectRefs(f.type, out, seen, depth + 1);
      }
      break;
    }
    case 'tagged':
      collectRefs(type.tagField.type, out, seen, depth + 1);
      for (const c of type.combos) for (const f of c.fields) collectRefs(f.type, out, seen, depth + 1);
      for (const f of type.after ?? []) collectRefs(f.type, out, seen, depth + 1);
      break;
    default:
      break;
  }
}

describe('Schema 描述协议：defMap 派生自 Datapack', () => {
  it('defMap 覆盖 editor 的 13 张表（非自定义表均有类型映射）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      expect(schema.defMap[meta.key], `${meta.key} 未出现在 defMap（Datapack 接口缺失？）`).toBeDefined();
      expect(schema.defMap[meta.key].type, `${meta.key} 类型映射缺失`).toBe(meta.type);
    }
  });

  it('生成 defs 非空（解析到字段）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const entity = schema.defs[meta.type!];
      expect(entity, `${meta.type} 无 defs（类型解析失败？）`).toBeDefined();
      expect(entity.fields?.length, `${meta.type} 字段为空`).toBeGreaterThan(0);
    }
  });
});

describe('Schema 描述协议：字段覆盖一致性', () => {
  it('每个生成字段在最终 TABLES 中都有 FieldDef（新增字段未同步 → error）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genFields = schema.defs[meta.type!].fields ?? [];
      const finalKeys = new Set(getTable(meta.key).fields.map((f) => f.key));
      for (const gf of genFields) {
        expect(
          finalKeys.has(gf.key),
          `${meta.key}.${gf.key} 已在 engine 类型中，但 editor schema 未同步（运行 npm run gen:schema 或补 editor-extras 覆盖）`,
        ).toBe(true);
      }
    }
  });

  it('无残留 hand 字段（复杂字段必须由 editor-extras 覆盖）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genFields = schema.defs[meta.type!].fields ?? [];
      const ov = meta.overrides ?? {};
      for (const gf of genFields) {
        if (gf.kind === 'hand') {
          expect(
            ov[gf.key],
            `${meta.key}.${gf.key} 为 hand 占位（${gf.tsType}），缺少 editor-extras 运行时构建`,
          ).toBeDefined();
        }
      }
    }
  });

  it('覆盖字段 key 必须存在于生成 defs（防 editor 侧私加引擎不认的字段）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genKeys = new Set((schema.defs[meta.type!].fields ?? []).map((f) => f.key));
      for (const key of Object.keys(meta.overrides ?? {})) {
        expect(
          genKeys.has(key),
          `${meta.key}.${key} 覆盖了 engine 类型中不存在的字段（请先补 types 或移除该覆盖）`,
        ).toBe(true);
      }
    }
  });
});

describe('Schema 描述协议：引用与枚举合法性', () => {
  it('所有 ref 目标 ∈ editor TableKey', () => {
    for (const t of TABLES) {
      for (const f of t.fields) {
        const refs = new Set<string>();
        collectRefs(f.type, refs, new Set<string>());
        for (const ref of refs) {
          expect(VALID_KEYS.has(ref), `${t.key}.${f.key} 引用了未知表 "${ref}"`).toBe(true);
        }
      }
    }
  });

  it('生成枚举字段（未覆盖时）保留全部类型选项', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genFields = schema.defs[meta.type!].fields ?? [];
      const ov = meta.overrides ?? {};
      const finalMap = new Map(getTable(meta.key).fields.map((f) => [f.key, f]));
      for (const gf of genFields) {
        if (gf.kind !== 'enum' || !gf.options?.length || ov[gf.key]) continue;
        const final = finalMap.get(gf.key);
        if (!final || final.type.kind !== 'enum' || final.type.optionsFrom) continue;
        for (const o of gf.options) {
          expect(
            (final.type.options ?? []).includes(o),
            `${meta.key}.${gf.key} 枚举选项 "${o}" 在 editor schema 中缺失`,
          ).toBe(true);
        }
      }
    }
  });
});
