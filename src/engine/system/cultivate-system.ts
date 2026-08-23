// ============================================================
// engine/cultivate-system.ts — 培养纯计算（曲线解析/升级推演/突破校验）
//
// 只做计算，不写状态：写操作由 StateMutationService.addExp / breakthroughStar
// 调用本模块的判定函数后执行。
// ============================================================

import type {
  CharacterVariantDef,
  CultivateCurveDef,
  PlayerState,
  RosterEntry,
} from '../types';

/** 曲线的运行时视图（缺省字段已填充）。 */
export interface CurveView {
  maxLevel: number;
  /** expTable[l-1] = 从 l 升 l+1 所需经验。 */
  expTable: number[];
  starMax: number;
  /** starCost[s] = 从 s 星升 s+1 星所需该变体碎片。 */
  starCost: number[];
  levelCapPerStar: number;
}

/** 全局缺省曲线：上限 10 级、线性 50×level 经验、不可突破（未配置曲线时）。 */
export const DEFAULT_CURVE: CurveView = {
  maxLevel: 10,
  expTable: Array.from({ length: 9 }, (_, i) => 50 * (i + 1)),
  starMax: 0,
  starCost: [],
  levelCapPerStar: 0,
};

/** 解析曲线定义为运行时视图（未声明/未知 id 时用全局默认）。 */
export function resolveCurve(def: CultivateCurveDef | undefined): CurveView {
  if (!def) return DEFAULT_CURVE;
  return {
    maxLevel: def.maxLevel,
    expTable: def.expTable ?? DEFAULT_CURVE.expTable,
    starMax: def.starMax ?? 0,
    starCost: def.starCost ?? [],
    levelCapPerStar: def.levelCapPerStar ?? 0,
  };
}

/** 当前星级下的有效等级上限。 */
export function effectiveMaxLevel(curve: CurveView, stars: number): number {
  return curve.maxLevel + stars * curve.levelCapPerStar;
}

/** 升到下一级所需经验；expTable 未覆盖该级返回 Infinity（不可再升）。 */
export function expToNext(curve: CurveView, level: number): number {
  const need = curve.expTable[level - 1];
  return need === undefined ? Number.POSITIVE_INFINITY : need;
}

export interface ExpApplyResult {
  ok: boolean;
  entry: RosterEntry;
  leveledUp: boolean;
}

/**
 * 经验推演：跨级逐级扣减，达有效上限（maxLevel + stars × levelCapPerStar）后溢出截断。
 * 纯函数——不修改传入 entry，返回新对象。
 */
export function applyExp(curve: CurveView, entry: RosterEntry, amount: number): ExpApplyResult {
  let { level, exp } = entry;
  const cap = effectiveMaxLevel(curve, entry.stars);
  if (amount <= 0 || level >= cap) return { ok: false, entry, leveledUp: false };

  let leveledUp = false;
  let remaining = amount;
  while (level < cap) {
    const need = expToNext(curve, level);
    if (!Number.isFinite(need) || remaining < need) break;
    remaining -= need;
    level += 1;
    leveledUp = true;
  }
  // 达上限后剩余经验截断（不保留溢出）
  exp = level >= cap ? 0 : exp + remaining;
  return { ok: true, entry: { ...entry, level, exp }, leveledUp };
}

export interface StarCheckResult {
  ok: boolean;
  reason?: 'no-entry' | 'no-curve' | 'at-max' | 'insufficient-shards';
  cost?: number;
}

/** 突破校验：碎片只看该变体自己的余额（差分隔离）。 */
export function checkBreakthrough(
  curve: CurveView,
  state: PlayerState,
  variant: CharacterVariantDef,
  entry: RosterEntry,
): StarCheckResult {
  if (curve.starCost.length === 0 || curve.starMax <= 0) return { ok: false, reason: 'no-curve' };
  if (entry.stars >= curve.starMax) return { ok: false, reason: 'at-max' };
  const cost = curve.starCost[entry.stars];
  if (cost === undefined) return { ok: false, reason: 'no-curve' };
  if ((state.fragments?.[variant.id] ?? 0) < cost) return { ok: false, reason: 'insufficient-shards', cost };
  return { ok: true, cost };
}
