/**
 * validate/index.ts —— Schema 驱动校验器
 *
 * M1 交付基础规则；M3 扩展（ID 三段式格式、判别联合必填、表达式结构等）。
 * 不依赖游戏代码，仅依赖 schema DSL 与数据本身。
 */
import type { FieldDef, FieldType, TableKey, TableSchema } from '../schema/types';
import { TABLES } from '../schema/datapack.schema';
import { validateExtraValue } from './extra';

export interface ValidationIssue {
  table: TableKey;
  /** array 表行索引；record 表为 -1 */
  rowIndex: number;
  /** record 表的 key */
  key?: string;
  path: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidateCtx {
  /** 各表 id 集合（用于 ref 完整性） */
  idSets: Map<TableKey, Set<string>>;
  /** 动态枚举选项：`${table}#${field}` → Set<string>（optionsFrom 用） */
  enumSets?: Map<string, Set<string>>;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function jsonType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '数组';
  return typeof v;
}

function push(
  issues: ValidationIssue[],
  table: TableKey,
  rowIndex: number,
  path: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
): void {
  issues.push({ table, rowIndex, path, message, severity });
}

/** 递归校验一个值是否符合 FieldType */
function validateValue(
  type: FieldType,
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  table: TableKey,
  rowIndex: number,
  ctx: ValidateCtx,
): void {
  switch (type.kind) {
    case 'string':
      if (typeof value !== 'string') {
        push(issues, table, rowIndex, path, `${path} 应为字符串，实际为 ${jsonType(value)}`);
      }
      break;
    case 'int':
      if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
        push(issues, table, rowIndex, path, `${path} 应为整数，实际为 ${jsonType(value)}`);
      }
      break;
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        push(issues, table, rowIndex, path, `${path} 应为数值，实际为 ${jsonType(value)}`);
      }
      break;
    case 'bool':
      if (typeof value !== 'boolean') {
        push(issues, table, rowIndex, path, `${path} 应为布尔，实际为 ${jsonType(value)}`);
      }
      break;
    case 'enum': {
      if (typeof value !== 'string') {
        push(issues, table, rowIndex, path, `${path} 应为字符串，实际为 ${jsonType(value)}`);
        break;
      }
      const opts = new Set(type.options ?? []);
      const ds = ctx.enumSets?.get(enumKey(table, path));
      if (ds) for (const o of ds) opts.add(o);
      if (opts.size > 0 && !opts.has(value)) {
        push(issues, table, rowIndex, path, `${path} 值 "${value}" 不在可选范围 [${[...opts].join(', ')}]`);
      }
      break;
    }
    case 'multiEnum': {
      if (!Array.isArray(value)) {
        push(issues, table, rowIndex, path, `${path} 应为标签数组`);
        break;
      }
      const opts = new Set(type.options ?? []);
      value.forEach((v, i) => {
        if (typeof v !== 'string') {
          push(issues, table, rowIndex, `${path}[${i}]`, `${path} 元素应为字符串`);
        } else if (opts.size > 0 && !opts.has(v)) {
          push(issues, table, rowIndex, `${path}[${i}]`, `${path} 标签 "${v}" 不在可选范围`);
        }
      });
      break;
    }
    case 'object': {
      if (!isObj(value)) {
        push(issues, table, rowIndex, path, `${path} 应为对象，实际为 ${jsonType(value)}`);
        break;
      }
      for (const f of type.fields) {
        validateField(f, value, path, issues, table, rowIndex, ctx);
      }
      break;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        push(issues, table, rowIndex, path, `${path} 应为数组，实际为 ${jsonType(value)}`);
        break;
      }
      value.forEach((item, idx) => {
        validateValue(type.item.type, item, `${path}[${idx}]`, issues, table, rowIndex, ctx);
      });
      break;
    }
    case 'record': {
      if (!isObj(value)) {
        push(issues, table, rowIndex, path, `${path} 应为键值映射，实际为 ${jsonType(value)}`);
        break;
      }
      for (const [k, v] of Object.entries(value)) {
        validateValue(type.value.type, v, `${path}.${k}`, issues, table, rowIndex, ctx);
      }
      break;
    }
    case 'union': {
      if (!isObj(value)) {
        push(issues, table, rowIndex, path, `${path} 应为对象（判别联合）`);
        break;
      }
      const obj = value;
      const tag = obj[type.tagField];
      let variant;
      if (typeof tag === 'string') {
        variant = type.variants.find((v) => v.tag === tag);
        if (!variant) {
          push(
            issues,
            table,
            rowIndex,
            path,
            `${path} 判别值 "${tag}" 无匹配变体（可选 [${type.variants.map((v) => v.tag).join(', ')}]）`,
          );
          break;
        }
      } else {
        // 判别键缺失：回退 noTag 变体（如叶子条件不写 type），向后兼容 '__leaf'
        variant = type.variants.find((v) => v.noTag) ?? type.variants.find((v) => v.tag === '__leaf');
        if (!variant) {
          push(issues, table, rowIndex, path, `${path} 缺少判别字段 "${type.tagField}"`);
          break;
        }
      }
      const fields = typeof variant.fields === 'function' ? variant.fields() : variant.fields;
      for (const f of fields) {
        validateField(f, obj, path, issues, table, rowIndex, ctx);
      }
      break;
    }
    case 'tagged': {
      if (!isObj(value)) {
        push(issues, table, rowIndex, path, `${path} 应为对象（判别对象联合）`);
        break;
      }
      const obj = value;
      // 第一个元素：判别枚举字段（required + 取值校验）
      validateField(type.tagField, obj, path, issues, table, rowIndex, ctx);
      const tag = obj[type.tagField.key];
      const combo = type.combos.find((c) => c.tag === tag);
      if (typeof tag === 'string' && !combo) {
        push(
          issues,
          table,
          rowIndex,
          path,
          `${path} 判别值 "${tag}" 无匹配组合（可选 [${type.combos.map((c) => c.tag).join(', ')}]）`,
        );
        break;
      }
      const fields = combo ? combo.fields : type.combos[0]?.fields ?? [];
      for (const f of fields) {
        validateField(f, obj, path, issues, table, rowIndex, ctx);
      }
      // 公共尾部字段（如条件叶子的比较符/值）
      for (const f of type.after ?? []) {
        validateField(f, obj, path, issues, table, rowIndex, ctx);
      }
      break;
    }
    case 'ref': {
      if (typeof value !== 'string') {
        push(issues, table, rowIndex, path, `${path} 应为引用 ID 字符串`);
        break;
      }
      const ids = ctx.idSets.get(type.table);
      if (ids && !ids.has(value)) {
        push(issues, table, rowIndex, path, `${path} 引用 "${value}" 不存在于 ${type.table} 表`);
      }
      break;
    }
    case 'flexible':
      // 宽松值：接受任意 JSON
      break;
    case 'hand':
      // 生成器占位：merge 后不应残留（残留即同步遗漏）；防御性跳过校验
      break;
    case 'extra':
      validateExtraValue(value, path, issues, table);
      break;
    case 'divider':
      // 横条非数据字段，不应被校验（validateField 已前置拦截）
      break;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
    }
  }
}

function validateField(
  f: FieldDef,
  row: Record<string, unknown>,
  basePath: string,
  issues: ValidationIssue[],
  table: TableKey,
  rowIndex: number,
  ctx: ValidateCtx,
): void {
  if (f.type.kind === 'divider') return; // 横条非数据字段，跳过校验
  if (f.root) {
    // root 字段描述宿主对象整体（如叶子条件的 tagged 联动），直接校验整个对象
    validateValue(f.type, row, basePath, issues, table, rowIndex, ctx);
    return;
  }
  const path = basePath ? `${basePath}.${f.key}` : f.key;
  const value = row[f.key];
  if (value === undefined || value === null) {
    if (f.required) push(issues, table, rowIndex, path, `${path} 缺少必填字段`);
    return;
  }
  validateValue(f.type, value, path, issues, table, rowIndex, ctx);
}

function enumKey(table: TableKey, path: string): string {
  // 顶层字段才可能配置 optionsFrom（如 characters.school）
  const parts = path.split('.');
  return `${table}#${parts[parts.length - 1]}`;
}

/** 校验单表全部行（array 表） */
export function validateTable(table: TableSchema, rows: unknown[], ctx: ValidateCtx): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  rows.forEach((row, idx) => {
    if (!isObj(row)) {
      push(issues, table.key, idx, `${table.key}[${idx}]`, `行应为对象，实际为 ${jsonType(row)}`);
      return;
    }
    for (const f of table.fields) {
      if (f.type.kind === 'divider') continue; // 横条非数据字段
      validateField(f, row, '', issues, table.key, idx, ctx);
    }
    const known = new Set(table.fields.filter((f) => f.type.kind !== 'divider').map((f) => f.key));
    for (const k of Object.keys(row)) {
      if (!known.has(k)) {
        push(issues, table.key, idx, `${table.key}[${idx}].${k}`, `未知字段 "${k}"`, 'warning');
      }
    }
  });
  return issues;
}

/** 校验 record 型表（如 extras） */
export function validateRecord(table: TableSchema, data: Record<string, unknown>, ctx: ValidateCtx): ValidationIssue[] {
  if (table.shape !== 'record' || !table.recordValue) return [];
  const issues: ValidationIssue[] = [];
  for (const [k, v] of Object.entries(data)) {
    validateValue(table.recordValue, v, `extras.${k}`, issues, table.key, -1, ctx);
  }
  issues.forEach((issue) => (issue.key = issue.path.replace(/^extras\./, '')));
  return issues;
}

/** 同表 id 唯一性检查 */
export function checkUniqueIds(table: TableSchema, rows: unknown[]): ValidationIssue[] {
  if (!table.idField) return [];
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, idx) => {
    const id = (row as Record<string, unknown>)?.[table.idField];
    if (typeof id !== 'string') return;
    if (seen.has(id)) {
      push(issues, table.key, idx, `${table.key}[${idx}].${table.idField}`, `ID "${id}" 重复（第 ${seen.get(id)} 行）`);
    } else {
      seen.set(id, idx);
    }
  });
  return issues;
}

/** 三段式 ID 格式：`pack:kind:name`（如 base:spot:credit_printer） */
const ID_FORMAT = /^[a-z0-9]+:[a-z0-9]+:[^:]+$/;

export function checkIdFormat(table: TableSchema, rows: unknown[]): ValidationIssue[] {
  if (!table.idField || table.idFormat === 'free') return [];
  const issues: ValidationIssue[] = [];
  rows.forEach((row, idx) => {
    const id = (row as Record<string, unknown>)?.[table.idField];
    if (typeof id !== 'string' || id.length === 0) return;
    if (!ID_FORMAT.test(id)) {
      push(issues, table.key, idx, `${table.key}[${idx}].${table.idField}`, `ID "${id}" 不符合三段式格式（pack:kind:name）`);
    }
  });
  return issues;
}

export interface DatapackData {
  [key: string]: unknown;
}

/** 校验一个完整 datapack（所有表的数组数据），返回全部 issues */
export function validateDatapack(
  data: DatapackData,
  opts: { checkIds?: boolean; checkUnknownFields?: boolean } = {},
): ValidationIssue[] {
  const { checkIds = true, checkUnknownFields = true } = opts;
  const issues: ValidationIssue[] = [];
  const ctx: ValidateCtx = { idSets: new Map(), enumSets: new Map() };

  // 第一轮：收集 id / 动态枚举
  for (const table of TABLES) {
    const rows = data[table.key];
    if (table.shape === 'record') continue;
    if (!Array.isArray(rows)) continue;
    const ids = new Set<string>();
    for (const row of rows) {
      const id = (row as Record<string, unknown>)?.[table.idField ?? 'id'];
      if (typeof id === 'string') ids.add(id);
      // 收集 optionsFrom 顶层字段
      for (const f of table.fields) {
        if (f.type.kind === 'enum' && f.type.optionsFrom) {
          const v = (row as Record<string, unknown>)?.[f.key];
          if (typeof v === 'string') {
            const k = `${table.key}#${f.key}`;
            if (!ctx.enumSets!.has(k)) ctx.enumSets!.set(k, new Set());
            ctx.enumSets!.get(k)!.add(v);
          }
        }
      }
    }
    ctx.idSets.set(table.key, ids);
  }
  // extras record：id 集合 = 顶层 key
  const extras = data['extras'];
  if (isObj(extras)) {
    ctx.idSets.set('extras', new Set(Object.keys(extras)));
  }

  // 第二轮：逐表校验
  for (const table of TABLES) {
    const raw = data[table.key];
    if (table.shape === 'record') {
      if (isObj(raw)) issues.push(...validateRecord(table, raw, ctx));
      continue;
    }
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) {
      issues.push({ table: table.key, rowIndex: 0, path: table.key, severity: 'error', message: `${table.key} 应为数组` });
      continue;
    }
    issues.push(...validateTable(table, raw, ctx));
    if (checkIds) {
      issues.push(...checkUniqueIds(table, raw));
      issues.push(...checkIdFormat(table, raw));
    }
  }
  return issues;
}

export const ALL_TABLES = TABLES;
