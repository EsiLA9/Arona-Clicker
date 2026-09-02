// ============================================================
// engine/def-factory/resource.ts — 资源量工厂
// 构造 ResourceAmount（供内容声明与引擎测试复用）
// ============================================================

import type { ResourceAmount } from '../contracts/resource';

/** 资源量快捷构造（花费 / 奖励条目）。 */
export const r = (resourceId: string, amount: number): ResourceAmount => ({ resourceId, amount });
