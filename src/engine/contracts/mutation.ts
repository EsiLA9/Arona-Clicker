import type { Effect } from '../types';

/** 基础机制驱动状态所需的最小写入能力；具体领域写入口由 Runtime 注入。 */
export interface StateMutationPort {
  applyEffects(effects: Effect[]): void;
  changeResource(resource: string, delta: number): number;
}
