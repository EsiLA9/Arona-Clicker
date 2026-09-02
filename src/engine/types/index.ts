// ============================================================
// engine/types/index.ts — 共享类型出口
//
// 基础引擎机制的聚合入口；产品实体与领域结果不在此处汇总。
// ============================================================

// 通用 ID 与字符串分类
export * from './ids';
// Extra 树类型
export * from './extra';
// 数值表达式 / 条件 / 效果 / Funclet
export * from './expression';
// Def 构造工厂（Expr / cond / and / extra / r 等，独立文件见 def-factory/）
export * from '../def-factory';
// 引擎机制 Def
export * from './reveal';
export * from './trigger';
// 通用角色/内容引用 ID；具体角色实体与配置在 data-services / AronaClicker
export * from './character';
export * from './theme';
// 运行时事件
export * from './events';
