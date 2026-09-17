// ============================================================
// data-services/contracts/common.ts — Datapack 通用声明
// ============================================================

import type { TagRef } from '../../engine/core/tag';

export type { ResourceAmount } from '../../engine/contracts/resource';

/** Def 审计元数据；缺省表示历史内容尚未记录时间。 */
export interface DefMetadata {
  createdAt: number;
  updatedAt: number;
}

export interface EffectiveDefMetadata extends DefMetadata {
  createdAtKnown: boolean;
  updatedAtKnown: boolean;
}

/** Registry 查询层对缺失时间采用的排序底值；不回写原始 Def。 */
export const MISSING_DEF_TIME = Number.MIN_SAFE_INTEGER;

export function effectiveDefMetadata(metadata?: Partial<DefMetadata>): EffectiveDefMetadata {
  return {
    createdAt: metadata?.createdAt ?? MISSING_DEF_TIME,
    updatedAt: metadata?.updatedAt ?? MISSING_DEF_TIME,
    createdAtKnown: metadata?.createdAt !== undefined,
    updatedAtKnown: metadata?.updatedAt !== undefined,
  };
}

export interface ResourceDisplayDef {
  /** @label 资源 ID */
  resourceId: string;
  /** @label 标签 */
  label: string;
  /** @label 详情标签 */
  detailLabel?: string;
  /** @label 显示条件 @enum always=常显 @enum hasAmount=仅持有量>0 显示 */
  showWhen?: 'always' | 'hasAmount';
  /** @label 排序 */
  order?: number;
}

export interface TagDef {
  /** @label 完整 TagRef；当前包新建时由 manifest.modName 自动补齐 */
  id: string;
  /** @label 父 TagRef；允许跨包挂靠 */
  parent?: string;
  /** @label 名称 */
  name: string;
  /** @label 简介 */
  description?: string;
}

/** Registry 入库后的 TagDef：身份字段已解析为完整 TagRef。 */
export interface ResolvedTagDef extends Omit<TagDef, 'id' | 'parent'> {
  id: TagRef;
  parent?: TagRef;
}
