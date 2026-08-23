// ============================================================
// engine/extra-read.ts — Extra 宽松读取（缺失即默认，不抛错）
// ============================================================

import { ExtraPath, ExtraValue } from '../types';
import { isBool, isStr } from './extra-core';
import { getAtPath } from './extra-path';

/** int/float → 数值；bool → 1/0；str/list/dict/缺失 → 0。 */
export function toNumber(v: ExtraValue | undefined): number {
  if (v === undefined) return 0;
  switch (v.t) {
    case 'int':
    case 'float':
      return v.v;
    case 'bool':
      return v.v ? 1 : 0;
    default:
      return 0;
  }
}

/** 仅 str 返回其值；其余（含缺失）→ ''。 */
export function toString(v: ExtraValue | undefined): string {
  return v !== undefined && isStr(v) ? v.v : '';
}

/** 仅 bool 返回其值；其余（含缺失）→ false。 */
export function toBool(v: ExtraValue | undefined): boolean {
  return v !== undefined && isBool(v) ? v.v : false;
}

export function readNumber(root: ExtraValue | undefined, path: ExtraPath): number {
  return toNumber(getAtPath(root, path));
}

export function readString(root: ExtraValue | undefined, path: ExtraPath): string {
  return toString(getAtPath(root, path));
}

export function readBool(root: ExtraValue | undefined, path: ExtraPath): boolean {
  return toBool(getAtPath(root, path));
}