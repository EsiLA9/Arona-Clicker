// ============================================================
// ui/runtime-editor/config.ts — 运行时编辑器调试开关
// ============================================================

/**
 * 调试编辑开关：置 1 时，在包库已有编辑态数据包的前提下自动打开
 * 第一个编辑态记录；不会创建无包归属的全局编辑态。仅用于本地调试。
 */
export const IS_DEBUG_EDITING: 0 | 1 = 1;

/** 兼容旧调试入口的默认字段；正式目标始终来自编辑态包记录。 */
export const DEBUG_EDITING_DEFAULTS = {
  modName: 'debug-mod',
  displayName: '调试数据包',
  version: '1.0.0',
  author: 'debug',
  description: '调试编辑态数据包。',
} as const;
