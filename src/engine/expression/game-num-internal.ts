// ============================================================
// engine/expression/game-num-internal.ts — GameNumSystem 内部共享类型
// （build / tag 模块与宿主类之间共享，不对外）
// ============================================================

import type { GameNum, ZoneBound } from './game-num-eval';

export type { GameNum } from './game-num-eval';

/** zone 节点（携带 childMulMap/bound）。 */
export type ZoneNode = GameNum & { kind: 'zone' };
/** 可乘区节点（携带 childMulMap/bound）。 */
export type MulNode = GameNum & { childMulMap?: Map<string, GameNum[]>; bound?: ZoneBound };

export interface ZoneIndexEntry {
  flat: Set<GameNum>;
  mul: Set<GameNum>;
}
