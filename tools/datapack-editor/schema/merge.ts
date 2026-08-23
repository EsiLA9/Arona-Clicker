/**
 * merge.ts —— 生成 defs（engine 协议）⊕ editor-extras（本地编辑语义）拼合
 *
 * 生成 defs 覆盖"结构 + 简单含义"（string/float/enum/ref/array/record/extra…）；
 * editor-extras 覆盖"复杂 / 仅编辑需要"（tagged 联动、引用表、optionsFrom、int/float 精修、
 * divider 分组、stories/extras 整表）。
 *
 * 优先级：override（editor-extras）> 生成 defs > hand 占位（残留 = 同步遗漏，测试报错）。
 */
import { loadEngineDefs } from './engine-defs';
import type { GenField } from './engine-defs';
import { TABLE_META, divider } from './editor-extras';
import type { FieldDef, TableKey, TableSchema } from './types';

function convertGenerated(gf: GenField): FieldDef {
  const base = {
    key: gf.key,
    label: gf.label ?? gf.key,
    ...(gf.group ? { group: gf.group } : {}),
    ...(gf.description ? { description: gf.description } : {}),
    ...(gf.required ? { required: true as const } : {}),
  };
  switch (gf.kind) {
    case 'string':
      return { ...base, type: { kind: 'string' } };
    case 'int':
      return { ...base, type: { kind: 'int' } };
    case 'float':
      return { ...base, type: { kind: 'float' } };
    case 'bool':
      return { ...base, type: { kind: 'bool' } };
    case 'enum': {
      const [table, field] = (gf.optionsFrom ?? '').split('.');
      return {
        ...base,
        type: {
          kind: 'enum',
          options: gf.options ?? [],
          ...(gf.meaning ? { meaning: gf.meaning } : {}),
          ...(gf.optionsFrom ? { optionsFrom: { table: table as TableKey, field } } : {}),
        },
      };
    }
    case 'ref':
      return { ...base, type: { kind: 'ref', table: gf.table as TableKey } };
    case 'extra':
      return { ...base, label: gf.label ?? 'Extra', group: 'Extra', type: { kind: 'extra' } };
    case 'flexible':
      return { ...base, type: { kind: 'flexible' } };
    case 'hand':
      // 防御：正常应由 editor-extras 覆盖；残留即同步遗漏（engine-schema.sync.test.ts 报错）
      return { ...base, type: { kind: 'hand' } };
    case 'array':
      return { ...base, type: { kind: 'array', item: convertGenerated(gf.item!) } };
    case 'object':
      return { ...base, type: { kind: 'object', fields: (gf.fields ?? []).map(convertGenerated) } };
    case 'record':
      return { ...base, type: { kind: 'record', value: convertGenerated(gf.value!) } };
  }
}

/** 拼合 engine defs + editor-extras → 13 张表 */
export function buildTables(): TableSchema[] {
  const ed = loadEngineDefs();
  const tables: TableSchema[] = [];

  for (const meta of TABLE_META) {
    if (meta.custom) {
      tables.push(meta.custom());
      continue;
    }
    const entity = meta.type ? ed.defMap[meta.key]?.type : undefined;
    const genFields = entity ? (ed.defs[entity]?.fields ?? []) : [];
    const ov = meta.overrides ?? {};
    const fields: FieldDef[] = [];

    for (const gf of genFields) {
      const override = ov[gf.key];
      const def = override ? (typeof override === 'function' ? override() : override) : convertGenerated(gf);
      fields.push(def);
      const divLabel = meta.dividerAfter?.[gf.key];
      if (divLabel) fields.push(divider(divLabel));
    }
    // 覆盖中存在但生成 defs 没有的字段（UI-only / editor 侧新增）——同步测试会告警
    for (const key of Object.keys(ov)) {
      if (genFields.some((g) => g.key === key)) continue;
      const f = typeof ov[key] === 'function' ? (ov[key] as () => FieldDef)() : (ov[key] as FieldDef);
      fields.push(f);
    }

    tables.push({
      key: meta.key,
      label: meta.label,
      ...(meta.idField ? { idField: meta.idField } : {}),
      ...(meta.shape ? { shape: meta.shape } : {}),
      ...(meta.idFormat ? { idFormat: meta.idFormat } : {}),
      ...(meta.worldlineSplit ? { worldlineSplit: true } : {}),
      fields,
    });
  }
  return tables;
}
