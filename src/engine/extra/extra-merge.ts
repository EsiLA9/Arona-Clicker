// ============================================================
// engine/extra-merge.ts — Extra 合并与扁平键展开
// ============================================================

import { ExtraCompound, ExtraValue } from '../types';
import { EXTRA_MAX_DEPTH, ExtraError, isDict } from './extra-core';
import { extra } from '../def-factory/extra';
import { cloneExtra } from './extra-construct';
import { parseExtraPath, getAtPath, setAtPath } from './extra-path';

/**
 * 深合并：source 覆盖 target 同名 key；dict 递归合并，list/标量整体替换。
 * 返回 target（原地修改）。source 的 key 合法性由 validateDictKey 保证。
 */
export function mergeExtra(target: ExtraCompound, source: ExtraValue, depth = 0): ExtraCompound {
  if (depth > EXTRA_MAX_DEPTH) {
    throw new ExtraError(`Extra nesting exceeds max depth ${EXTRA_MAX_DEPTH}`);
  }
  if (!isDict(source)) {
    throw new ExtraError('Extra mergeExtra: source must be a dict');
  }
  for (const [key, value] of Object.entries(source.v)) {
    const existing = target.v[key];
    if (existing !== undefined && isDict(existing) && isDict(value)) {
      mergeExtra(existing, value, depth + 1);
    } else {
      target.v[key] = cloneExtra(value);
    }
  }
  return target;
}

/**
 * 展开扁平键（'a/b' → 树）为 dict。用于数据包 extras 常量表加载（M2）。
 * 扁平键与既有树冲突（'a/b' 与 'a' 并存）时抛错。
 */
export function expandFlatKeys(extras: Record<string, ExtraValue>): ExtraCompound {
  const root = extra.dict({});
  for (const [key, value] of Object.entries(extras)) {
    const segments = parseExtraPath(key);
    const target = extra.dict({});
    if (segments.length === 1) {
      const seg = segments[0];
      if (root.v[seg] !== undefined) {
        throw new ExtraError(`Extra expandFlatKeys: conflicting key "${key}"`);
      }
      root.v[seg] = cloneExtra(value);
    } else {
      const last = segments[segments.length - 1];
      const parentSegs = segments.slice(0, -1);
      const existing = getAtPath(root, parentSegs.join('/'));
      if (existing !== undefined && !isDict(existing)) {
        throw new ExtraError(`Extra expandFlatKeys: conflict at "${key}" (non-dict node)`);
      }
      const parent = (existing as ExtraCompound | undefined) ?? extra.dict({});
      if (parent.v[last] !== undefined) {
        throw new ExtraError(`Extra expandFlatKeys: conflicting key "${key}"`);
      }
      parent.v[last] = cloneExtra(value);
      setAtPath(root, parentSegs.join('/'), parent);
    }
  }
  return root;
}