// ============================================================
// ui/runtime-editor/config.ts — 运行时编辑器调试开关
// ============================================================

/**
 * 调试编辑开关：置 1 时，进入数据包管理页默认开启编辑态，
 * 并以 DEBUG_EDITING_DEFAULTS 预填 Mod 元信息；置 0 时恢复
 * 「手动点击开启编辑态」。仅用于本地调试，交付前应改回 0。
 */
export const IS_DEBUG_EDITING: 0 | 1 = 1;

/** IS_DEBUG_EDITING = 1 时预填的默认编辑数据参数。 */
export const DEBUG_EDITING_DEFAULTS = {
  modName: 'debug-mod',
  displayName: '调试数据包',
  version: '1.0.0',
  author: 'debug',
  description: 'IS_DEBUG_EDITING=1 时自动开启的调试编辑态。',
} as const;
