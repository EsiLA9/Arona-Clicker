// ============================================================
// engine/expression/game-num-internal.ts — GameNumSystem 内部共享类型
// （build / tag 模块与宿主类之间共享，不对外）
// ============================================================

import type { GameNum } from './game-num-eval';

export type { GameNum } from './game-num-eval';

/** zone 节点（求值统一走 state 表 aggregateZone）。 */
export type ZoneNode = GameNum & { kind: 'zone' };

export interface ZoneIndexEntry {
  flat: Set<GameNum>;
  mul: Set<GameNum>;
}
