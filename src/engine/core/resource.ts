// ============================================================
// engine/resource.ts — 资源 ID 与展示辅助
// 资源为三段式 ID：base:resource:credit（编辑者 DSL / 统计 / 条件共用）
// ============================================================

import { Resource } from '../types';

export type ResourceId = string;

export const RESOURCE_MOD = 'base';
export const RESOURCE_PREFIX = `${RESOURCE_MOD}:resource:`;

/** 构造三段式资源 ID：resourceId('base', 'credit') → base:resource:credit */
export const resourceId = (mod: string, name: string): string => `${mod}:resource:${name}`;

/** 展示名（UI / 日志用）。未知资源回退为原 ID。 */
export function resourceLabel(id: string): string {
  switch (id) {
    case Resource.Credit: return '信用点';
    case Resource.Pyroxene: return '青辉石';
    default: return id;
  }
}
