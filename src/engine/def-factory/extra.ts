// ============================================================
// engine/def-factory/extra.ts — Extra 值工厂
// 构造 ExtraValue tagged union（自 engine/extra/extra-core.ts 拆出）
// ============================================================

import type { ExtraCompound, ExtraValue } from '../types/extra';

/** ExtraValue 便捷构造（数据包 TS 书写零负担）。 */
export const extra = {
  int: (v: number): ExtraValue => ({ t: 'int', v: Math.trunc(v) }),
  float: (v: number): ExtraValue => ({ t: 'float', v }),
  str: (v: string): ExtraValue => ({ t: 'str', v }),
  bool: (v: boolean): ExtraValue => ({ t: 'bool', v }),
  list: (...items: ExtraValue[]): ExtraValue => ({ t: 'list', v: items }),
  dict: (v: Record<string, ExtraValue>): ExtraCompound => ({ t: 'dict', v }),
};
