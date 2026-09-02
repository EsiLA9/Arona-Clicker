import type { GameNumState } from './state-query';
import type { GameNum } from '../expression/game-num-eval';
import type { EntityRef } from '../expression/tag-effect';
import type { ZoneNode } from '../expression/game-num-internal';

/** UI 所需的数值求值面；构建索引、脏位与 Affector 同步留在引擎内部。 */
export interface GameNumQueryPort {
  evaluate(node: GameNum, state: GameNumState): number;
  buildZoneNode(scope: EntityRef, part: 'flat' | 'mul', resource?: string): ZoneNode;
  evaluateResourceGain(resource: string, state: GameNumState): number;
  evaluateSpotYield(spotId: string, state: GameNumState): number;
}
