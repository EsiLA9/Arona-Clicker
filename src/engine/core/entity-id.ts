// ============================================================
// engine/entity-id.ts — 三段式实体 ID（modName:typeName:idName）
// 规范与裁定见 docs-828/06-adr/0004-datapack-management §2。
// ============================================================

export interface EntityIdParts {
  mod: string;
  type: string;
  name: string;
}

export const ENTITY_MOD = 'base';

/**
 * 注册表表名级 typeName 集合（与 Registry 各表对应）。
 * 裁定：中段必须属于本集合（S1b/c 收紧 story/character 后全集生效）。
 */
export const ENTITY_TYPES: ReadonlySet<string> = new Set([
  'init',
  'area',
  'spot',
  'enhancement',
  'story',
  'activestory',
  'passivestory',
  'item',
  'droptable',
  'trigger',
  'affector',
  'affectorpack',
  'funclet',
  'character',
  'variant',
  'pic',
  'charaprofile',
  'resource',
  'colorgroup',
  'colorequipment',
  'themedesign',
  'gachapool',
  'passivepool',
  'cultivatecurve',
  'resourcedisplay',
  'affectionconfig',
  'tag',
]);

/** 构造三段式实体 ID：entityId('base', 'spot', 'credit_printer') → base:spot:credit_printer */
export const entityId = (mod: string, type: string, name: string): string =>
  `${mod}:${type}:${name}`;

/** 解析三段式实体 ID（仅格式校验：段字符集，不查 typeName 注册表）。不匹配时返回 null。 */
export const parseEntityId = (id: string): EntityIdParts | null => {
  const match = /^([a-z0-9-]+):([a-z0-9-]+):([a-z0-9_-]+)$/.exec(id);
  if (!match) return null;
  return { mod: match[1], type: match[2], name: match[3] };
};

export type EntityIdIssue = 'format' | 'type';

/** 校验三段式实体 ID：格式 + typeName 已注册。合法返回 null，否则返回首个问题。 */
export const validateEntityId = (id: string): EntityIdIssue | null => {
  const parts = parseEntityId(id);
  if (!parts) return 'format';
  if (!ENTITY_TYPES.has(parts.type)) return 'type';
  return null;
};
