/**
 * Tree-shaped extension data used by engine definitions and runtime state.
 * The runtime implementation lives in engine/extra.ts.
 */
export type ExtraValue =
  | { t: 'int'; v: number }        // 整数（NBT Int）
  | { t: 'float'; v: number }      // 浮点（NBT Float）
  | { t: 'str'; v: string }        // 字符串（NBT String）
  | { t: 'bool'; v: boolean }      // 布尔
  | { t: 'list'; v: ExtraValue[] } // 列表（NBT List，异构）
  | { t: 'dict'; v: Record<string, ExtraValue> }; // 复合（NBT Compound）

export type ExtraCompound = { t: 'dict'; v: Record<string, ExtraValue> };

export type ExtraPath = string;
