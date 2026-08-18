/**
 * validate/extra.ts —— Extra 树（NBT 六变体 {t,v}）结构校验
 *
 * ExtraValue 六变体：
 *   str  → v: string
 *   num  → v: number
 *   bool → v: boolean
 *   null → v: null
 *   list → v: ExtraValue[]
 *   dict → v: Record<string, ExtraValue>
 */
import type { TableKey } from '../schema/types';
import type { ValidationIssue } from './index';

export const EXTRA_TAGS = ['str', 'num', 'int', 'bool', 'null', 'list', 'dict'] as const;
export type ExtraTag = (typeof EXTRA_TAGS)[number];

export function isExtraValue(value: unknown): value is { t: string; v: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    't' in value &&
    'v' in value
  );
}

export function validateExtraValue(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  table: TableKey,
): void {
  if (!isExtraValue(value)) {
    issues.push({ table, rowIndex: -1, path, severity: 'error', message: `${path} 应为 {t, v} 节点，实际为 ${typeof value}` });
    return;
  }
  const t = value.t;
  if (!EXTRA_TAGS.includes(t as ExtraTag)) {
    issues.push({ table, rowIndex: -1, path, severity: 'error', message: `${path}.t 非法标签 "${t}"（可选 [${EXTRA_TAGS.join(', ')}]）` });
    return;
  }
  const v = value.v;
  const child = `${path}.v`;
  switch (t as ExtraTag) {
    case 'str':
      if (typeof v !== 'string') {
        issues.push({ table, rowIndex: -1, path: child, severity: 'error', message: `${child} 应为字符串，实际为 ${typeof v}` });
      }
      break;
    case 'num':
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        issues.push({ table, rowIndex: -1, path: child, severity: 'error', message: `${child} 应为数值，实际为 ${typeof v}` });
      }
      break;
    case 'int':
      if (typeof v !== 'number' || !Number.isInteger(v)) {
        issues.push({ table, rowIndex: -1, path: child, severity: 'error', message: `${child} 应为整数，实际为 ${typeof v}` });
      }
      break;
    case 'bool':
      if (typeof v !== 'boolean') {
        issues.push({ table, rowIndex: -1, path: child, severity: 'error', message: `${child} 应为布尔，实际为 ${typeof v}` });
      }
      break;
    case 'null':
      if (v !== null) {
        issues.push({ table, rowIndex: -1, path: child, severity: 'error', message: `${child} 应为 null` });
      }
      break;
    case 'list': {
      if (!Array.isArray(v)) {
        issues.push({ table, rowIndex: -1, path: child, severity: 'error', message: `${child} 应为 ExtraValue[]` });
        break;
      }
      v.forEach((item, i) => validateExtraValue(item, `${child}[${i}]`, issues, table));
      break;
    }
    case 'dict': {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        issues.push({ table, rowIndex: -1, path: child, severity: 'error', message: `${child} 应为 Record<string, ExtraValue>` });
        break;
      }
      for (const [k, item] of Object.entries(v)) {
        validateExtraValue(item, `${child}.${k}`, issues, table);
      }
      break;
    }
  }
}
