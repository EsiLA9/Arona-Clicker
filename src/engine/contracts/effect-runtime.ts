import type { Effect } from '../types/expression';

/**
 * 运行时宿主对非持久化 Effect 的消费入口。
 *
 * 返回 true 表示该效果已被宿主消费，不应再交给状态写入口；返回 false
 * 则由基础状态变更管道继续处理。引擎不解释具体产品效果名。
 */
export type EffectRuntimeHandler = (effect: Effect) => boolean;
