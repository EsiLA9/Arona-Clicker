// ============================================================
// engine/extra-core.ts — Extra 体系共享底座：常量、错误、守卫、构造
// Extra 的拆分核心，供 construct/path/merge/read/validate 共用，避免循环依赖。
// ============================================================

import { ExtraCompound, ExtraValue } from './types';

/** 嵌套深度上限，防畸形数据打爆调用栈（设计文档 §3.3）。 */
export const EXTRA_MAX_DEPTH = 32;

export class ExtraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtraError';
  }
}

// --- 变体守卫（类型谓词）---

export function isInt(v: ExtraValue): v is { t: 'int'; v: number } { return v.t === 'int'; }
export function isFloat(v: ExtraValue): v is { t: 'float'; v: number } { return v.t === 'float'; }
export function isStr(v: ExtraValue): v is { t: 'str'; v: string } { return v.t === 'str'; }
export function isBool(v: ExtraValue): v is { t: 'bool'; v: boolean } { return v.t === 'bool'; }
export function isList(v: ExtraValue): v is { t: 'list'; v: ExtraValue[] } { return v.t === 'list'; }
export function isDict(v: ExtraValue): v is { t: 'dict'; v: Record<string, ExtraValue> } { return v.t === 'dict'; }

// --- 便捷构造器（数据包 TS 书写零负担）---

export const extra = {
  int: (v: number): ExtraValue => ({ t: 'int', v: Math.trunc(v) }),
  float: (v: number): ExtraValue => ({ t: 'float', v }),
  str: (v: string): ExtraValue => ({ t: 'str', v }),
  bool: (v: boolean): ExtraValue => ({ t: 'bool', v }),
  list: (...items: ExtraValue[]): ExtraValue => ({ t: 'list', v: items }),
  dict: (v: Record<string, ExtraValue>): ExtraCompound => ({ t: 'dict', v }),
};

/** dict key 合法性：非空且不含 '/'。ExtraError 校验公共入口。 */
export function validateDictKey(key: string): void {
  if (key === '') {
    throw new ExtraError('Extra dict key must not be empty');
  }
  if (key.includes('/')) {
    throw new ExtraError(`Extra dict key must not contain '/': "${key}"`);
  }
}