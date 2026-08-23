// ============================================================
// engine/extra-validate.ts — Extra 校验（收集错误，不抛错）
// ============================================================

import { ExtraValue } from './types';
import { EXTRA_MAX_DEPTH, ExtraError, validateDictKey } from './extra-core';

/**
 * 递归校验树形结构，返回错误信息数组（空数组 = 合法）。
 * 校验项：深度 ≤ EXTRA_MAX_DEPTH、dict key 非空且不含 '/',
 * int 值必须为整数、list/dict 值类型正确。
 */
export function validateExtraValue(v: ExtraValue, depth = 0): string[] {
  const errors: string[] = [];
  if (depth > EXTRA_MAX_DEPTH) {
    errors.push(`nesting exceeds max depth ${EXTRA_MAX_DEPTH}`);
    return errors;
  }
  switch (v.t) {
    case 'int':
      if (!Number.isInteger(v.v)) errors.push(`int value ${v.v} is not an integer`);
      break;
    case 'float':
      break;
    case 'str':
      break;
    case 'bool':
      break;
    case 'list':
      if (!Array.isArray(v.v)) errors.push('list value is not an array');
      else v.v.forEach((item, i) => {
        for (const e of validateExtraValue(item, depth + 1)) errors.push(`list[${i}]: ${e}`);
      });
      break;
    case 'dict':
      for (const [key, child] of Object.entries(v.v)) {
        try {
          validateDictKey(key);
        } catch (err) {
          errors.push(`key "${key}": ${(err as Error).message}`);
          continue;
        }
        for (const e of validateExtraValue(child, depth + 1)) errors.push(`"${key}": ${e}`);
      }
      break;
    default: {
      // 穷举校验：未知变体
      const t = (v as { t?: string }).t;
      errors.push(`unknown variant "${String(t)}"`);
    }
  }
  return errors;
}

/** 校验并抛错（首个错误即抛），供 Def / 数据包静态校验调用。 */
export function assertValidExtra(v: ExtraValue): void {
  const errors = validateExtraValue(v);
  if (errors.length > 0) {
    throw new ExtraError(`Invalid extra data: ${errors.join('; ')}`);
  }
}