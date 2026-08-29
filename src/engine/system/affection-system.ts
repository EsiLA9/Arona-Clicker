// ============================================================
// engine/system/affection-system.ts — 好感纯计算（阶梯解析/星级锁/升级推演）
//
// 只做计算，不写状态：写操作由 StateMutationService.addAffectionExp
// 调用本模块的推演函数后执行。
// 默认阶梯 = 蔚蓝档案原版羁绊表（参考数据：仓库根目录 bondDict.ts）。
// 设计文档：docs-828/06-adr/planning.md §1。
// ============================================================

import type {
  AffectionConfigDef,
  CharacterVariantDef,
  RosterEntry,
} from '../types';

/**
 * 蔚蓝档案原版羁绊阶梯（1→2 级需 15 …… 99→100 级需 7365）。
 * bond2exDict[L] = [本级需求, 累计值]；累计列为推导值不入引擎。
 */
export const DEFAULT_AFFECTION_EXP_CURVE: readonly number[] = [
  15, 30, 30, 35, 35, 35, 40, 40, 40, 60,
  90, 105, 120, 140, 160, 180, 205, 230, 255, 285,
  315, 345, 375, 410, 445, 480, 520, 560, 600, 645,
  690, 735, 780, 830, 880, 930, 985, 1040, 1095, 1155,
  1215, 1275, 1335, 1400, 1465, 1530, 1600, 1670, 1740, 1815,
  1890, 1965, 2040, 2120, 2200, 2280, 2365, 2450, 2535, 2625,
  2715, 2805, 2895, 2990, 3085, 3180, 3280, 3380, 3480, 3585,
  3690, 3795, 3900, 4010, 4120, 4230, 4345, 4460, 4575, 4695,
  4815, 4935, 5055, 5180, 5305, 5430, 5560, 5690, 5820, 5955,
  6090, 6225, 6360, 6500, 6640, 6780, 6925, 7070, 7215, 7365,
];

/** 引擎内置默认配置（数据包 affectionConfig 缺省时使用，不报错）。 */
export const DEFAULT_AFFECTION_CONFIG: Required<AffectionConfigDef> = {
  expCurve: [...DEFAULT_AFFECTION_EXP_CURVE],
  expBeyond: DEFAULT_AFFECTION_EXP_CURVE[DEFAULT_AFFECTION_EXP_CURVE.length - 1]!,
  maxLevel: DEFAULT_AFFECTION_EXP_CURVE.length,
  defaultLevelCapByStar: [20, 20, 20, 20, 20, 100],
};

/** 配置的运行时视图（缺省字段已填充引擎默认）。 */
export interface AffectionConfigView {
  maxLevel: number;
  /** expCurve[l-1] = 从 l 升 l+1 所需小值（阶梯区）。 */
  expCurve: number[];
  /** 等值区每级需求（超出阶梯覆盖后）。 */
  expBeyond: number;
  /** 星级锁默认表（索引 = 星级）。 */
  defaultLevelCapByStar: number[];
}

/** 解析配置为运行时视图（未声明/缺字段用引擎默认；expCurve 空数组视为未声明）。 */
export function resolveAffectionConfig(def: AffectionConfigDef | undefined): AffectionConfigView {
  if (!def) return { ...DEFAULT_AFFECTION_CONFIG, expCurve: [...DEFAULT_AFFECTION_CONFIG.expCurve], defaultLevelCapByStar: [...DEFAULT_AFFECTION_CONFIG.defaultLevelCapByStar] };
  const curve = def.expCurve && def.expCurve.length > 0 ? [...def.expCurve] : [...DEFAULT_AFFECTION_EXP_CURVE];
  return {
    expCurve: curve,
    expBeyond: def.expBeyond ?? curve[curve.length - 1]!,
    maxLevel: def.maxLevel ?? curve.length,
    defaultLevelCapByStar: def.defaultLevelCapByStar && def.defaultLevelCapByStar.length > 0
      ? [...def.defaultLevelCapByStar]
      : [...DEFAULT_AFFECTION_CONFIG.defaultLevelCapByStar],
  };
}

/** 升到下一级所需小值：阶梯区取 expCurve[等级-1]，等值区取 expBeyond，超上限返回 Infinity。 */
export function affectionExpToNext(config: AffectionConfigView, level: number): number {
  if (level >= config.maxLevel) return Number.POSITIVE_INFINITY;
  const need = config.expCurve[level - 1];
  return need ?? config.expBeyond;
}

/**
 * 星级锁：当前星级下的好感等级上限 = min(星级锁(stars), maxLevel)。
 * 星级超出星级锁表覆盖时取表尾值；per-variant 覆盖表优先于全局默认表。
 */
export function affectionLevelCapOf(config: AffectionConfigView, variant: CharacterVariantDef | undefined, stars: number): number {
  const table = variant?.affectionLevelCapByStar ?? config.defaultLevelCapByStar;
  const idx = Math.max(0, Math.min(stars, table.length - 1));
  return Math.min(table[idx] ?? config.maxLevel, config.maxLevel);
}

export interface AffectionApplyResult {
  ok: boolean;
  entry: RosterEntry;
  leveledUp: boolean;
}

/**
 * 好感小值推演：跨级逐级扣减；达星级锁 cap 后小值截断（不保留溢出，解锁上限后重新积累）。
 * 未拥有 / delta <= 0 拒绝（与 addExp 一致）。纯函数——不修改传入 entry，返回新对象。
 */
export function applyAffectionExp(config: AffectionConfigView, entry: RosterEntry, cap: number, variant: CharacterVariantDef | undefined, delta: number): AffectionApplyResult {
  let level = entry.affectionLevel ?? 1;
  let exp = entry.affectionExp ?? 0;
  if (delta <= 0 || level >= cap) return { ok: false, entry, leveledUp: false };

  let leveledUp = false;
  let remaining = delta;
  while (level < cap) {
    const need = affectionExpToNext(config, level);
    if (!Number.isFinite(need) || remaining < need) break;
    remaining -= need;
    level += 1;
    leveledUp = true;
  }
  // 达 cap 后小值截断（不保留溢出；星级突破解锁上限后重新积累）
  exp = level >= cap ? 0 : exp + remaining;
  return { ok: true, entry: { ...entry, affectionLevel: level, affectionExp: exp }, leveledUp };
}
