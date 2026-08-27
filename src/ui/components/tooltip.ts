// ============================================================
// ui/components/tooltip.ts — 提示面板门面（瘦身版）
// 渲染函数按实体类型拆至 tooltip-detail-*，揭示/强化横切拆至
//   tooltip-reveal / tooltip-enhancement；本文件保留统一入口路由
//   getTooltipContent 与 re-export 兼容层（对外导入路径不变）。
// ============================================================

import { UIContext } from '../context';
import { renderSpotDetail } from './tooltip-detail-spot';
import { renderEnhancementDetail } from './tooltip-detail-enh';
import { renderAreaDetail } from './tooltip-detail-area';
import { renderInitDetail } from './tooltip-detail-init';
import { renderItemDetail } from './tooltip-detail-item';
import { renderResourceDetail } from './tooltip-detail-resource';
import { renderPoolDetail, renderPassiveEntryDetail } from './tooltip-detail-codex';

// ---- re-export 兼容层（保持 `./components/tooltip` 导入路径不变） ----

export { conditionMet, resolveReveal, getEnhancementReveal, getSpotReveal, getInitReveal, getAreaReveal, getStoryReveal, OBFUSCATED, REVEAL_TARGET_LABEL, renderRevealTriggers } from './tooltip-reveal';
export type { RevealLevel, RevealResult, RevealInput } from './tooltip-reveal';
export { describeStatDsl, describeCondition, getEnhancementMultiplier, getSpotYieldBreakdown } from './tooltip-enhancement';
export type { YieldBreakdown } from './tooltip-enhancement';
export { renderAreaDetail } from './tooltip-detail-area';
export { renderSpotDetail } from './tooltip-detail-spot';
export { renderResourceDetail } from './tooltip-detail-resource';
export { renderEnhancementDetail } from './tooltip-detail-enh';
export { renderInitDetail } from './tooltip-detail-init';
export { renderItemDetail } from './tooltip-detail-item';

/**
 * 统一弹层内容入口。
 * key 格式：`spot:<id>` | `enh:<id>` | `area:<id>` | `init:<id>`。
 * 返回带 .info-popover 的 HTML，供 body 级浮层注入。
 */
export function getTooltipContent(ctx: UIContext, key: string): string {
  // 实体 ID 为三段式（base:spot:credit_printer），只能按第一个冒号切分，保留完整 ID
  const sep = key.indexOf(':');
  if (sep === -1) return '';
  const kind = key.slice(0, sep);
  const id = key.slice(sep + 1);
  switch (kind) {
    case 'spot': {
      const spot = ctx.game.registry.spots.get(id);
      if (!spot) return '';
      const level = ctx.view.spotLevels[id] ?? 0;
      return renderSpotDetail(ctx, spot, level);
    }
    case 'enh': {
      const enh = ctx.game.registry.enhancements.get(id);
      return enh ? renderEnhancementDetail(ctx, enh) : '';
    }
    case 'area': {
      const area = ctx.game.registry.areas.get(id);
      return area ? renderAreaDetail(ctx, area) : '';
    }
    case 'init': {
      const init = ctx.game.registry.inits.get(id);
      return init ? renderInitDetail(ctx, init) : '';
    }
    case 'item': {
      const item = ctx.game.registry.items.get(id);
      return item ? renderItemDetail(ctx, item) : '';
    }
    case 'resource':
      return renderResourceDetail(ctx, id);
    case 'passive': {
      const entry = ctx.game.registry.passiveStories.get(id);
      return entry ? renderPassiveEntryDetail(ctx, entry) : '';
    }
    case 'pool': {
      const pool = ctx.game.registry.passivePools.get(id);
      return pool ? renderPoolDetail(ctx, pool) : '';
    }
    default:
      return '';
  }
}
