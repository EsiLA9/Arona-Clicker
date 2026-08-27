// ============================================================
// engine/extra.ts — Extra 额外数据体系（运行时实现集中出口）
// 实现已按关注点拆分：
//   extra-core（常量/错误/守卫/构造）· extra-construct · extra-path
//   extra-merge · extra-read · extra-validate
// 本文件仅作聚合 re-export，保持 `from './index'` 全项目兼容。
// 设计文档: docs/13-extra-data-system.md（M1 格式底座）
// ============================================================

export * from './extra-core';
export * from './extra-construct';
export * from './extra-path';
export * from './extra-merge';
export * from './extra-read';
export * from './extra-validate';
// extra 便捷构造器已移至 def-factory/extra.ts，此处 re-export 保持兼容
export { extra } from '../def-factory/extra';