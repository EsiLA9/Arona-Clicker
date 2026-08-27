// ============================================================
// engine/def-factory/reveal.ts — 揭示 Trigger 共享构造
// base 数据揭示递进的标准门槛：credit 持有量 / credit 累计产出。
// ============================================================

import type { RevealTarget, RevealTrigger } from '../types/reveal';
import { cond, and } from './condition';

/** 「全局累计产出达到 N 信用点」的统计 DSL key（揭示递进的标准门槛）。 */
export const CREDIT_PRODUCED_STAT = '$GlobalProducedAmount base:resource:credit';

/** 持有指定资源 ≥ amount 门槛的揭示 Trigger。 */
export const revealResource = (
  target: RevealTarget,
  resourceId: string,
  amount: number,
): RevealTrigger => ({
  reveal: target,
  condition: and(cond('resource', resourceId, '>=', amount)),
});

/** 全局累计产出达到 N 信用点门槛的揭示 Trigger。 */
export const revealCredit = (
  target: RevealTarget,
  producedAmount: number,
): RevealTrigger => ({
  reveal: target,
  condition: and(cond('stat', CREDIT_PRODUCED_STAT, '>=', producedAmount)),
});
