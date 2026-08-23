// ============================================================
// engine/tag.ts — 层级 Tag（TagPath）与匹配工具
//
// 完整标签 ID 形式：`modName:tag:parent/child/...`
// - 左广（parent）右细（child）；child 从属于 parent，参与 parent 的计数/筛选。
// - 存储只用路径数组（TagPath），mod 与 `tag` 类型前缀由 tagId 统一补齐。
// ============================================================

/** 路径数组形式的层级标签，如 ['field', 'combat']。 */
export type TagPath = string[];

export const TAG_MOD = 'base';
export const TAG_PREFIX = `${TAG_MOD}:tag:`;

/** 构造路径标签：tagPath('field', 'combat') → ['field', 'combat'] */
export const tagPath = (...segments: string[]): TagPath => segments;

/** 完整三段式标签 ID：base:tag:parent/child */
export const tagId = (path: TagPath): string => `${TAG_PREFIX}${path.join('/')}`;

/** 解析完整标签 ID 为路径（兼容裸路径串：office/defense 或 office）。 */
export const parseTagId = (id: string): TagPath => {
  const rest = id.startsWith(TAG_PREFIX) ? id.slice(TAG_PREFIX.length) : id;
  return rest ? rest.split('/') : [];
};

/**
 * 匹配：query 是 declared 的前缀（或相等）→ 命中。
 * child 从属 parent：声明 field/combat 的实体命中查询 field。
 */
export const matchesTag = (declared: TagPath, query: TagPath): boolean => {
  if (query.length > declared.length) return false;
  for (let i = 0; i < query.length; i++) {
    if (declared[i] !== query[i]) return false;
  }
  return true;
};

/** 展示用：office/defense（省略 mod:tag: 前缀）。 */
export const tagDisplay = (path: TagPath): string => path.join('/');
