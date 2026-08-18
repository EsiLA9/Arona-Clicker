/**
 * navi.ts —— 导航（Navi）系统
 *
 * 让"指向特殊类型"的字段（ref → 其他表 ID、optionsFrom → 来源表行）具备
 * 可指涉能力：显示目标 ID 补全、一键跳转到被引用目标行。
 *
 * 设计：
 * - NaviTarget：定位目标（表 + 行索引 / record key），不感知 UI。
 * - NaviService：全局事件总线，UI 层（main.ts）订阅并执行"切表 + 高亮"。
 * - resolveRef / resolveOptionsFrom：把字段值解析成 NaviTarget。
 * - collectRefOptions / refDisplay：收集目标表候选（id + 可读名），并生成"名 (id)"显示文本。
 * - collectRefIds：兼容旧接口，等价于 collectRefOptions 的 id 列表。
 */
import type { EditorModel } from '../model/editor-model';
import type { TableKey } from '../schema/types';
import { getTable } from '../schema/datapack.schema';

/** 导航目标：array 表用 rowIndex；record 表用 recordKey（rowIndex 为 -1） */
export interface NaviTarget {
  table: TableKey;
  rowIndex: number;
  recordKey?: string;
}

export type NaviListener = (target: NaviTarget) => void;

/** 导航事件总线：navigate 广播，onNavigate 订阅（返回取消订阅函数） */
export class NaviService {
  private listeners = new Set<NaviListener>();

  onNavigate(cb: NaviListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  navigate(target: NaviTarget): void {
    for (const fn of [...this.listeners]) fn(target);
  }
}

/** 目标表主键字段名（record 表无） */
function idFieldOf(table: TableKey): string | undefined {
  return getTable(table).idField;
}

/** 引用候选：id + 人类可读名（用于"名 (id)"显示与下拉过滤） */
export interface RefOption {
  id: string;
  name: string;
}

/** 行的人类可读名：优先 name/label/displayName，其次首个字符串字段 */
function rowDisplayName(
  schema: ReturnType<typeof getTable>,
  row: Record<string, unknown>,
): string {
  const idField = schema.idField ?? 'id';
  for (const f of schema.fields) {
    if (f.type.kind === 'divider') continue; // 横条非数据字段
    if (f.key === idField) continue;
    if (f.key === 'name' || f.key === 'label' || f.key === 'displayName') {
      if (typeof row[f.key] === 'string' && row[f.key]) return String(row[f.key]);
    }
  }
  for (const f of schema.fields) {
    if (f.type.kind === 'divider') continue; // 横条非数据字段
    if (f.key === idField) continue;
    const t = f.type.kind;
    if ((t === 'string' || t === 'ref' || t === 'flexible') && typeof row[f.key] === 'string' && row[f.key]) {
      return `${f.label}: ${String(row[f.key])}`;
    }
  }
  return '';
}

/** 收集目标表所有可引用候选（array 表：idField + 可读名；record 表：key + 空名） */
export function collectRefOptions(model: EditorModel, table: TableKey): RefOption[] {
  const schema = getTable(table);
  if (schema.shape === 'record') {
    return Object.keys(model.recordOf(table)).map((k) => ({ id: k, name: '' }));
  }
  const idField = schema.idField ?? 'id';
  return model
    .rowsOf(table)
    .map((r) => {
      const row = r as Record<string, unknown>;
      const id = typeof row[idField] === 'string' ? (row[idField] as string) : '';
      return { id, name: rowDisplayName(schema, row) };
    })
    .filter((o) => o.id.length > 0);
}

/** 兼容旧接口：收集目标表所有可引用 ID */
export function collectRefIds(model: EditorModel, table: TableKey): string[] {
  return collectRefOptions(model, table).map((o) => o.id);
}

/** 引用值展示文本："名 (id)"；找不到名/未解析则原样返回 id */
export function refDisplay(model: EditorModel, table: TableKey, value: string): string {
  if (!value) return '';
  const opt = collectRefOptions(model, table).find((o) => o.id === value);
  return opt && opt.name ? `${opt.name} (${opt.id})` : value;
}

/** 解析引用值 → 目标行（找不到返回 null）。record 表按 key 匹配。 */
export function resolveRef(model: EditorModel, table: TableKey, value: string): NaviTarget | null {
  if (!value) return null;
  const schema = getTable(table);
  if (schema.shape === 'record') {
    return model.hasRecordKey(table, value) ? { table, rowIndex: -1, recordKey: value } : null;
  }
  const idField = schema.idField ?? 'id';
  const idx = model.rowsOf(table).findIndex((r) => r[idField] === value);
  return idx >= 0 ? { table, rowIndex: idx } : null;
}

/** 解析 optionsFrom 值 → 来源表首个匹配行（用于跳转来源） */
export function resolveOptionsFrom(
  model: EditorModel,
  source: { table: TableKey; field: string },
  value: string,
): NaviTarget | null {
  if (!value) return null;
  const schema = getTable(source.table);
  if (schema.shape === 'record') return null;
  const idx = model.rowsOf(source.table).findIndex((r) => r[source.field] === value);
  return idx >= 0 ? { table: source.table, rowIndex: idx } : null;
}

/** 供 field-editor 展示引用目标的概要（如 "spots[3]：credit_printer"） */
export function describeTarget(target: NaviTarget): string {
  const label = getTable(target.table).label;
  if (target.recordKey !== undefined) return `${label}#${target.recordKey}`;
  return `${label}[${target.rowIndex}]`;
}

export { idFieldOf };
