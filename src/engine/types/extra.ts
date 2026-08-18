// ============================================================
// engine/types/extra.ts — Extra 额外数据类型（类 NBT 树）
// 运行时实现见 engine/extra.ts
// ============================================================

/**
 * 树形额外数据节点。六种变体，t 为判别字段（NBT 严格型）。
 * - int / float 区分精度语义，利于数据包校验与跨语言存档；
 * - list 允许异构元素（放宽 NBT 同构约束，换取 JSON 直转能力）；
 * - dict 即 NBT Compound，key 禁含路径分隔符（见 ExtraPath 约定）。
 */
export type ExtraValue =
  | { t: 'int'; v: number }        // 整数（NBT Int）
  | { t: 'float'; v: number }      // 浮点（NBT Float）
  | { t: 'str'; v: string }        // 字符串（NBT String）
  | { t: 'bool'; v: boolean }      // 布尔
  | { t: 'list'; v: ExtraValue[] } // 列表（NBT List，异构）
  | { t: 'dict'; v: Record<string, ExtraValue> }; // 复合（NBT Compound）

/** dict 变体便捷别名。Def 的 extra 字段建议使用此类型。 */
export type ExtraCompound = { t: 'dict'; v: Record<string, ExtraValue> };

/**
 * Extra 路径：/ 分隔的字符串（如 'meta/rank'、'inv/0/name'）。
 * - 段不允许为空（首尾 /、//、空串均非法）；
 * - dict key 不得含 /，list 索引用数字段。
 */
export type ExtraPath = string;
