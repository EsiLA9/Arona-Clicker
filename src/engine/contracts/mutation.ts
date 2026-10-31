import type { Effect } from '../types';
import type { EffectReceipt } from './effect-receipt';

/** 基础机制驱动状态所需的最小写入能力；具体领域写入口由 Runtime 注入。 */
export interface StateMutationPort {
  applyEffects(effects: Effect[]): void;
  /** Optional committed-result route; the observer runs before mutation notifications. */
  applyEffectsWithReceipts?(effects: Effect[], onReceipt?: (receipt: EffectReceipt) => void): EffectReceipt[];
  changeResource(resource: string, delta: number): number;
}
