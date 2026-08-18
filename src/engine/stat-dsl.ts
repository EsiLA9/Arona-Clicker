// ============================================================
// engine/stat-dsl.ts — 函数式统计查询 DSL（受限函数库）
//
// 形式：`$FunctionName 参数...`（参数用空格分隔）
//   例：$GlobalProducedAmount base:resource:credit
//       $InitProducedAmount base:init:schale_office base:resource:credit
//       $CurrentRunCompletedStories
//
// 作用域编码在函数名：Global（贯穿 Init）/ CurrentRun（本次游玩）/ Init（某 Init）。
// 编辑者只能用本库预定义函数，新增统计模式 = 注册新函数名，语法不变。
// ============================================================

import { StatCounters } from './types';

export type StatScope = 'global' | 'currentRun' | 'init';

export interface StatFnDef {
  scope: StatScope;
  /** StatCounters 字段名（produced/consumed/... 为 Record，其余为 number）；framesInInit 仅 init 层。 */
  metric: keyof StatCounters | 'framesInInit';
  /** 该指标需要维度参数（资源 / 物品 ID）。 */
  keyed: boolean;
}

export const STAT_FNS: Record<string, StatFnDef> = {
  // produced / consumed（key = resourceId）
  $GlobalProducedAmount: { scope: 'global', metric: 'produced', keyed: true },
  $CurrentRunProducedAmount: { scope: 'currentRun', metric: 'produced', keyed: true },
  $InitProducedAmount: { scope: 'init', metric: 'produced', keyed: true },
  $GlobalConsumedAmount: { scope: 'global', metric: 'consumed', keyed: true },
  $CurrentRunConsumedAmount: { scope: 'currentRun', metric: 'consumed', keyed: true },
  $InitConsumedAmount: { scope: 'init', metric: 'consumed', keyed: true },

  // itemsCollected / itemsUsed（key = itemId）
  $GlobalCollectedAmount: { scope: 'global', metric: 'itemsCollected', keyed: true },
  $CurrentRunCollectedAmount: { scope: 'currentRun', metric: 'itemsCollected', keyed: true },
  $InitCollectedAmount: { scope: 'init', metric: 'itemsCollected', keyed: true },
  $GlobalUsedAmount: { scope: 'global', metric: 'itemsUsed', keyed: true },
  $CurrentRunUsedAmount: { scope: 'currentRun', metric: 'itemsUsed', keyed: true },
  $InitUsedAmount: { scope: 'init', metric: 'itemsUsed', keyed: true },

  // 计数类（无 key）
  $GlobalUnlockedSpots: { scope: 'global', metric: 'spotsUnlocked', keyed: false },
  $CurrentRunUnlockedSpots: { scope: 'currentRun', metric: 'spotsUnlocked', keyed: false },
  $InitUnlockedSpots: { scope: 'init', metric: 'spotsUnlocked', keyed: false },
  $GlobalUpgradedSpots: { scope: 'global', metric: 'spotsUpgraded', keyed: false },
  $CurrentRunUpgradedSpots: { scope: 'currentRun', metric: 'spotsUpgraded', keyed: false },
  $InitUpgradedSpots: { scope: 'init', metric: 'spotsUpgraded', keyed: false },
  $GlobalUnlockedEnhancements: { scope: 'global', metric: 'enhancementsUnlocked', keyed: false },
  $CurrentRunUnlockedEnhancements: { scope: 'currentRun', metric: 'enhancementsUnlocked', keyed: false },
  $InitUnlockedEnhancements: { scope: 'init', metric: 'enhancementsUnlocked', keyed: false },
  $GlobalCompletedStories: { scope: 'global', metric: 'storiesCompleted', keyed: false },
  $CurrentRunCompletedStories: { scope: 'currentRun', metric: 'storiesCompleted', keyed: false },
  $InitCompletedStories: { scope: 'init', metric: 'storiesCompleted', keyed: false },
  $GlobalUnlockedInits: { scope: 'global', metric: 'initsUnlocked', keyed: false },
  $CurrentRunUnlockedInits: { scope: 'currentRun', metric: 'initsUnlocked', keyed: false },
  $InitUnlockedInits: { scope: 'init', metric: 'initsUnlocked', keyed: false },
  $GlobalFramesActive: { scope: 'global', metric: 'framesActive', keyed: false },
  $CurrentRunFramesActive: { scope: 'currentRun', metric: 'framesActive', keyed: false },
  $InitFramesActive: { scope: 'init', metric: 'framesActive', keyed: false },
  // framesInInit 仅 init 层有意义
  $InitFramesInInit: { scope: 'init', metric: 'framesInInit', keyed: false },
};

export interface StatQuery {
  fn: string;
  def: StatFnDef;
  initId?: string;
  key?: string;
}

/** 解析统计函数调用串；无法识别返回 null。 */
export function parseStatCall(dsl: string): StatQuery | null {
  const tokens = dsl.trim().split(/\s+/);
  const fn = tokens[0];
  const def = STAT_FNS[fn];
  if (!def) return null;
  const args = tokens.slice(1);

  let initId: string | undefined;
  if (def.scope === 'init') {
    initId = args.shift();
    if (!initId) return null;
  }
  let key: string | undefined;
  if (def.keyed) {
    key = args.shift();
    if (!key) return null;
  }
  return { fn, def, initId, key };
}
