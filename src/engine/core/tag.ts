// ============================================================
// engine/tag.ts — 层级 Tag（TagPath）与匹配工具
//
// 完整标签 ID 形式：`modName:parent/child/...`
// - 左广（parent）右细（child）；child 从属于 parent，参与 parent 的计数/筛选。
// - 现有 TagPath 继续作为运行时层级路径；TagRef 是跨包边界使用的完整身份。
// ============================================================

/** 路径数组形式的层级标签，如 ['field', 'combat']。 */
export type TagPath = string[];

declare const tagRefBrand: unique symbol;

/** 跨 Datapack 的完整 Tag 身份，如 `base:office/defense`。 */
export type TagRef = string & { readonly [tagRefBrand]: true };

export const TAG_MOD = 'base';
export const TAG_PREFIX = `${TAG_MOD}:tag:`;
const TAG_REF_RE = /^([a-z0-9-]+):([a-z0-9_-]+(?:\/[a-z0-9_-]+)*)$/;

/** 构造路径标签：tagPath('field', 'combat') → ['field', 'combat'] */
export const tagPath = (...segments: string[]): TagPath => segments;

/** 构造完整 TagRef；Tag 不是实体，不使用三段式实体 ID。 */
export const tagRef = (modName: string, path: TagPath): TagRef => {
  const value = `${modName}:${tagDisplay(path)}`;
  if (!TAG_REF_RE.test(value)) throw new Error(`非法 TagRef：${value}`);
  return value as TagRef;
};

/** 判断字符串是否为完整 TagRef。 */
export const isTagRef = (value: string): value is TagRef => TAG_REF_RE.test(value);

/** 解析完整 TagRef；返回命名空间与层级路径。 */
export const parseTagRef = (value: string): { modName: string; path: TagPath } | undefined => {
  const match = TAG_REF_RE.exec(value);
  return match ? { modName: match[1], path: match[2].split('/') } : undefined;
};

/** 展示完整 TagRef 的路径部分；编辑器可另行显示 modName。 */
export const tagRefPath = (value: TagRef): TagPath => parseTagRef(value)!.path;

/** 将 TagPath 转成稳定的完整身份键；裸路径默认归属 base。 */
export const tagKey = (path: TagPath, defaultModName = TAG_MOD): string => {
  const first = path[0];
  if (!first) return `${defaultModName}:`;
  const separator = first.indexOf(':');
  if (separator > 0) return `${first}${path.length > 1 ? '/' + path.slice(1).join('/') : ''}`;
  return `${defaultModName}:${path.join('/')}`;
};

/** 将内容层裸路径解析为带命名空间的运行时路径，保留 TagPath 数组形状。 */
export const qualifyTagPath = (path: TagPath, defaultModName = TAG_MOD): TagPath => {
  const parsed = parseTagRef(tagKey(path, defaultModName));
  return parsed ? [`${parsed.modName}:${parsed.path[0]}`, ...parsed.path.slice(1)] : [...path];
};

/** TagPath 的命名空间部分；裸路径按调用方默认包解析。 */
export const tagModName = (path: TagPath, defaultModName = TAG_MOD): string => {
  const separator = path[0]?.indexOf(':') ?? -1;
  return separator > 0 ? path[0].slice(0, separator) : defaultModName;
};

/** 兼容旧引擎内部调用名；新代码应使用 tagKey。 */
export const tagId = (path: TagPath, defaultModName = TAG_MOD): string => tagKey(path, defaultModName);

/** 解析完整标签 ID 为路径（兼容裸路径串：office/defense 或 office）。 */
export const parseTagId = (id: string): TagPath => {
  const legacyRest = id.startsWith(TAG_PREFIX) ? id.slice(TAG_PREFIX.length) : undefined;
  if (legacyRest !== undefined) return legacyRest ? legacyRest.split('/') : [];
  const parsed = parseTagRef(id);
  return parsed ? [`${parsed.modName}:${parsed.path[0]}`, ...parsed.path.slice(1)] : (id ? id.split('/') : []);
};

/**
 * 匹配：query 是 declared 的前缀（或相等）→ 命中。
 * child 从属 parent：声明 field/combat 的实体命中查询 field。
 */
export const matchesTag = (declared: TagPath, query: TagPath): boolean => {
  if (query.length > declared.length) return false;
  if (tagModName(declared) !== tagModName(query)) return false;
  const declaredPath = parseTagId(tagKey(declared)).map((segment, index) => index === 0 ? segment.slice(segment.indexOf(':') + 1) : segment);
  const queryPath = parseTagId(tagKey(query)).map((segment, index) => index === 0 ? segment.slice(segment.indexOf(':') + 1) : segment);
  for (let i = 0; i < queryPath.length; i++) {
    if (declaredPath[i] !== queryPath[i]) return false;
  }
  return true;
};

/** 展示用：office/defense（省略命名空间）。 */
export const tagDisplay = (path: TagPath): string => {
  if (path.length === 0) return '';
  const first = path[0];
  const separator = first.indexOf(':');
  return `${separator > 0 ? first.slice(separator + 1) : first}${path.length > 1 ? '/' + path.slice(1).join('/') : ''}`;
};
