/**
 * editor-model.ts —— Schema 驱动的通用编辑数据模型
 *
 * 持有整个工作集（所有表数据），提供增删改/移动/复制/撤销重做。
 * 所有变更走统一入口并产生快照历史，UI 层订阅 onChange 刷新。
 * 不依赖游戏代码与 DOM。
 */
import { TABLES } from '../schema/datapack.schema';
import type { TableKey, TableSchema } from '../schema/types';
import { validateDatapack, type ValidationIssue } from '../validate';

export type Row = Record<string, unknown>;

export type EditPath = (string | number)[];

export interface EditorChange {
  /** 操作描述，如 "新增行 spots[4]" */
  label: string;
}

type HistoryEntry = { label: string; snapshot: string };

const HISTORY_LIMIT = 50;

export class EditorModel {
  /** tableKey → 数据。array 表为行数组；record 表为 {key: value} */
  private data: Partial<Record<TableKey, unknown>> = {};
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listeners = new Set<(reason: string) => void>();

  // ---------- 加载 / 导出 ----------

  loadDatapack(datapack: Record<string, unknown>): void {
    this.data = {};
    for (const table of TABLES) {
      const raw = datapack[table.key];
      if (raw !== undefined) this.data[table.key] = structuredClone(raw);
    }
    this.undoStack = [];
    this.redoStack = [];
    this.notify('load');
  }

  toDatapack(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const table of TABLES) {
      const d = this.data[table.key];
      if (d !== undefined) out[table.key] = structuredClone(d);
    }
    return out;
  }

  /** 当前数据（引用，勿直接修改；用于读取） */
  raw(): Partial<Record<TableKey, unknown>> {
    return this.data;
  }

  // ---------- 读取 ----------

  rowsOf(table: TableKey): Row[] {
    const d = this.data[table];
    return Array.isArray(d) ? (d as Row[]) : [];
  }

  recordOf(table: TableKey): Record<string, unknown> {
    const d = this.data[table];
    return typeof d === 'object' && d !== null && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  }

  rowAt(table: TableKey, index: number): Row {
    const rows = this.rowsOf(table);
    if (index < 0 || index >= rows.length) throw new Error(`行越界：${table}[${index}]`);
    return rows[index];
  }

  /** record 表：key 存在性 */
  hasRecordKey(table: TableKey, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.recordOf(table), key);
  }

  // ---------- 变更（全部产生历史快照） ----------

  private commit(label: string, mutator: () => void): void {
    this.undoStack.push({ label, snapshot: JSON.stringify(this.data) });
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    mutator();
    this.notify(label);
  }

  addRow(table: TableKey): number {
    const schema = this.tableSchema(table);
    if (schema.shape === 'record') {
      throw new Error(`record 表 ${table} 不支持 addRow，请使用 setRecordKey`);
    }
    const row: Row = {};
    for (const f of schema.fields) {
      if (f.type.kind === 'divider') continue; // 横条非数据字段，不进入数据行
      const def = defaultFor(f.type.kind);
      if (def !== undefined) row[f.key] = def;
    }
    let idx = -1;
    this.commit(`新增行 ${table}`, () => {
      const rows = this.rowsOf(table);
      idx = rows.length;
      rows.push(row);
    });
    return idx;
  }

  removeRow(table: TableKey, index: number): void {
    this.commit(`删除行 ${table}[${index}]`, () => {
      this.rowsOf(table).splice(index, 1);
    });
  }

  duplicateRow(table: TableKey, index: number): number {
    const copy = structuredClone(this.rowAt(table, index));
    let newIndex = -1;
    this.commit(`复制行 ${table}[${index}]`, () => {
      const rows = this.rowsOf(table);
      newIndex = index + 1;
      rows.splice(newIndex, 0, copy);
    });
    return newIndex;
  }

  moveRow(table: TableKey, from: number, to: number): void {
    if (from === to) return;
    this.commit(`移动行 ${table}[${from}]→[${to}]`, () => {
      const rows = this.rowsOf(table);
      const [row] = rows.splice(from, 1);
      rows.splice(to, 0, row);
    });
  }

  /**
   * 沿路径设置值（不可变写入：克隆目标行/记录后修改并整体替换）。
   * record 表：rowIndex 传 -1，path 第一段为 record key。
   */
  setValue(table: TableKey, rowIndex: number, path: EditPath, value: unknown): void {
    const label = `${table}[${rowIndex}] ${path.join('.')} 修改`;
    this.commit(label, () => {
      if (rowIndex < 0) {
        const clone = structuredClone(this.recordOf(table));
        if (path.length === 0) {
          this.data[table] = value;
        } else {
          setAt(clone, path, value);
          this.data[table] = clone;
        }
        return;
      }
      const rows = this.rowsOf(table);
      if (path.length === 0) {
        // 整行替换（openFieldEditor 的整行编辑）
        rows[rowIndex] = (value ?? {}) as Row;
        return;
      }
      const clone = structuredClone(rows[rowIndex]);
      setAt(clone, path, value);
      rows[rowIndex] = clone;
    });
  }

  /** record 表：新增/覆盖 key → value */
  setRecordKey(table: TableKey, key: string, value: unknown): void {
    this.commit(`设置 ${table}.${key}`, () => {
      this.recordOf(table)[key] = value;
    });
  }

  removeRecordKey(table: TableKey, key: string): void {
    this.commit(`删除 ${table}.${key}`, () => {
      delete this.recordOf(table)[key];
    });
  }

  // ---------- 撤销 / 重做 ----------

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.redoStack.push({ label: entry.label, snapshot: JSON.stringify(this.data) });
    this.data = JSON.parse(entry.snapshot) as typeof this.data;
    this.notify(`撤销：${entry.label}`);
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.undoStack.push({ label: entry.label, snapshot: JSON.stringify(this.data) });
    this.data = JSON.parse(entry.snapshot) as typeof this.data;
    this.notify(`重做：${entry.label}`);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ---------- 校验 ----------

  validate(): ValidationIssue[] {
    return validateDatapack(this.toDatapack());
  }

  // ---------- 订阅 ----------

  onChange(listener: (reason: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(reason: string): void {
    for (const fn of this.listeners) fn(reason);
  }

  private tableSchema(key: TableKey): TableSchema {
    const t = TABLES.find((x) => x.key === key);
    if (!t) throw new Error(`未知表：${key}`);
    return t;
  }
}

/** 按 kind 提供默认值（用于新增行） */
function defaultFor(kind: string): unknown {
  switch (kind) {
    case 'string':
    case 'enum':
    case 'ref':
      return '';
    case 'int':
    case 'float':
      return 0;
    case 'bool':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return undefined;
  }
}

/** 在 path 上设置值（创建缺失中间对象） */
function setAt(target: Record<string, unknown>, path: EditPath, value: unknown): void {
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    const next = cur[seg];
    if (typeof next !== 'object' || next === null) {
      cur[seg] = {};
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = value;
}
