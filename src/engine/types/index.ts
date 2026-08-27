// ============================================================
// engine/types/index.ts — 共享类型出口
//
// 历史兼容：原 engine/types.ts 拆分至本目录后由 index 汇总，
// 全项目 `import { ... } from './'` 保持兼容。
// ============================================================

// ID、枚举、全局资源标识
export * from './ids';
// Extra 树类型
export * from './extra';
// 数值表达式 / 条件 / 效果 / Funclet
export * from './expression';
// Def 构造工厂（Expr / cond / and / extra / r 等，独立文件见 def-factory/）
export * from '../def-factory';
// 数据包实体定义（Def）
export * from './entities';
// Character 重构实体（变体/培养/色彩/抽卡/聊天流）
export * from './character';
// Chara 头像-人名对声明表
export * from './chara-profile';
// 运行时状态与统计
export * from './state';
// 操作返回结果 / 剧情视图
export * from './results';
// 运行时事件
export * from './events';
// 图片资产（PicDef / 三段式索引）
export * from './pics';
