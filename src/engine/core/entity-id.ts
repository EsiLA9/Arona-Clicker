// ============================================================
// engine/entity-id.ts — 三段式实体 ID（modName:idType:idName）
// ============================================================

export interface EntityIdParts {
  mod: string;
  type: string;
  name: string;
}

export const ENTITY_MOD = 'base';

/** 构造三段式实体 ID：entityId('base', 'spot', 'credit_printer') → base:spot:credit_printer */
export const entityId = (mod: string, type: string, name: string): string =>
  `${mod}:${type}:${name}`;

/** 解析三段式实体 ID。不匹配三段式格式时返回 null。 */
export const parseEntityId = (id: string): EntityIdParts | null => {
  const match = /^([^:]+):([^:]+):(.+)$/.exec(id);
  if (!match) return null;
  return { mod: match[1], type: match[2], name: match[3] };
};
