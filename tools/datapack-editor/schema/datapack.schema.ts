/**
 * datapack.schema.ts —— 13 张表 Schema（由协议拼合）
 *
 * 结构 + 简单含义来自 src/engine/types/**（scripts/gen-engine-schema.mjs →
 * engine-defs.gen.json）；复杂/编辑语义来自 editor-extras.ts；merge.ts 拼合为最终 TableSchema。
 *
 * 修改约定：改引擎类型后必须 `npm run gen:schema`；engine-schema.sync.test.ts 兜底防漂移。
 */
import type { TableSchema } from './types';
import { buildTables } from './merge';

export const TABLES: TableSchema[] = buildTables();

const BY_KEY = new Map<TableSchema['key'], TableSchema>(TABLES.map((t) => [t.key, t]));
export const getTable = (key: TableSchema['key']): TableSchema => {
  const t = BY_KEY.get(key);
  if (!t) throw new Error(`Unknown table: ${key}`);
  return t;
};
