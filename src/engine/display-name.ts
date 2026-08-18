// ============================================================
// engine/display-name.ts — 统一三段式 ID → 人类可读名称解析
// ============================================================
// 所有 UI 组件通过此服务获取实体显示名，避免到处做 fallback id。
// 三段式 ID 形如：base:spot:credit_printer / base:enh:credit_system
// 简名（如 resource 'credit'）也可传入。

import { resourceLabel } from './resource';
import { Registry } from './registry';
import { Character } from './types';

export type EntityType = 'resource' | 'spot' | 'enh' | 'init' | 'area' | 'character' | 'item' | 'story';

/** 将任意实体 ID 映射为人类可读显示名。 */
export function displayName(
  registry: Registry,
  type: string,
  id: string,
): string {
  switch (type) {
    case 'resource': {
      // 优先使用数据包声明的资源显示配置（detailLabel 用于详情，label 用于资源条），
      // 未声明时回退到内置标签表，再回退到原始 ID。
      const def = registry.resourceDisplays.get(id);
      return def?.detailLabel ?? def?.label ?? resourceLabel(id);
    }
    case 'spot':
      return registry.spots.get(id)?.name ?? shortId(id);
    case 'enh':
    case 'enhancement':
      return registry.enhancements.get(id)?.name ?? shortId(id);
    case 'init':
      return registry.inits.get(id)?.name ?? shortId(id);
    case 'area':
      return registry.areas.get(id)?.name ?? shortId(id);
    case 'character':
      if (id === Character.None) return '未分配';
      return registry.characters.get(id as Character)?.displayName ?? shortId(id);
    case 'item':
      return registry.items.get(id)?.name ?? shortId(id);
    case 'story':
      return registry.stories.get(id)?.name ?? shortId(id);
    default:
      return id;
  }
}

/** 将三段式 ID 的最后一段作为简写返回。base:spot:credit_printer → credit_printer */
function shortId(id: string): string {
  const last = id.lastIndexOf(':');
  return last >= 0 ? id.slice(last + 1) : id;
}
