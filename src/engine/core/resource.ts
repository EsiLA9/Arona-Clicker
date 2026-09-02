// ============================================================
// engine/resource.ts — 资源 ID 与展示辅助
// 资源为三段式 ID：base:resource:credit（编辑者 DSL / 统计 / 条件共用）
// ============================================================

export type ResourceId = string;

/** 构造三段式资源 ID。 */
export const resourceId = (mod: string, name: string): string => `${mod}:resource:${name}`;

/** 通用展示回退；产品资源名由 ResourceDisplay 配置提供。 */
export function resourceLabel(id: string): string {
  return id;
}
