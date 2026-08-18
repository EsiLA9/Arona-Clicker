/**
 * enum-options.ts —— 收集字段可选项（静态 options + optionsFrom 动态 distinct）
 */
import type { EditorModel } from '../model/editor-model';
import type { TableKey } from '../schema/types';

export function collectEnumOptions(
  type: { options?: string[]; optionsFrom?: { table: TableKey; field: string } },
  table: TableKey,
  model: EditorModel,
): string[] {
  const set = new Set<string>();
  for (const o of type.options ?? []) set.add(o);
  if (type.optionsFrom) {
    const rows = model.rowsOf(type.optionsFrom.table);
    for (const row of rows) {
      const v = row[type.optionsFrom.field];
      if (typeof v === 'string') set.add(v);
    }
    void table;
  }
  return [...set];
}
