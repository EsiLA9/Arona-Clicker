// ============================================================
// engine/def-factory/resource.ts — 资源量工厂
// 构造 ResourceAmount（自 src/data/base/enhancements.ts 局部定义抽升）
// ============================================================

import type { ResourceAmount } from '../types/common';

/** 资源量快捷构造（花费 / 奖励条目）。 */
export const r = (resourceId: string, amount: number): ResourceAmount => ({ resourceId, amount });
