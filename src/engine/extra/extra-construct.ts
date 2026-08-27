// ============================================================
// engine/extra-construct.ts — Extra 构造：fromJson / cloneExtra
// ============================================================

import { ExtraValue } from '../types';
import { EXTRA_MAX_DEPTH, ExtraError, validateDictKey } from './extra-core';
import { extra } from '../def-factory/extra';

/**
 * 从纯 TS 字面量（string/number/boolean/数组/纯对象）宽松转换。
 * 整数 number → int；带小数 → float；null/undefined 拒绝。
 * 转换递归时校验深度与 dict key 合法性。
 */
export function extraFromJson(raw: unknown, depth = 0): ExtraValue {
  if (depth > EXTRA_MAX_DEPTH) {
    throw new ExtraError(`Extra nesting exceeds max depth ${EXTRA_MAX_DEPTH}`);
  }
  if (raw === null || raw === undefined) {
    throw new ExtraError('Extra fromJson: null/undefined is not a valid node');
  }
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? extra.int(raw) : extra.float(raw);
  }
  if (typeof raw === 'string') return extra.str(raw);
  if (typeof raw === 'boolean') return extra.bool(raw);
  if (Array.isArray(raw)) {
    return extra.list(...raw.map(item => extraFromJson(item, depth + 1)));
  }
  if (typeof raw === 'object') {
    const record: Record<string, ExtraValue> = {};
    for (const [key, value] of Object.entries(raw)) {
      validateDictKey(key);
      record[key] = extraFromJson(value, depth + 1);
    }
    return extra.dict(record);
  }
  throw new ExtraError(`Extra fromJson: unsupported value type "${typeof raw}"`);
}

// --- 深度克隆（纯 JSON 结构，递归实现）---

export function cloneExtra(v: ExtraValue): ExtraValue {
  switch (v.t) {
    case 'int':
    case 'float':
    case 'str':
    case 'bool':
      return { t: v.t, v: v.v } as ExtraValue;
    case 'list':
      return { t: 'list', v: v.v.map(cloneExtra) };
    case 'dict': {
      const out: Record<string, ExtraValue> = {};
      for (const [key, child] of Object.entries(v.v)) out[key] = cloneExtra(child);
      return { t: 'dict', v: out };
    }
  }
}