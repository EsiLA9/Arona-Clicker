// ============================================================
// ui/color-scheme.ts — 统一颜色管理框架
// ============================================================
// 职责分层：
//   语义层（数据）→ 注册表（框架）→ 渲染层（卡片）
// ============================================================
// 安全约束：
//   - 颜色值全部硬编码在注册表内，不从 extra 读取
//   - 调用方按实体固有属性（tags/type）决定语义角色
//   - 强调卡色板由单一 accent 色确定性派生，零主题变量引用
//   - 卡片结构/字体完全共享 .mini-card，强调卡仅注入 --card-* token
// ============================================================

import { SYSTEM_DEFAULT_PRIMARY } from '../engine/core/theme-defaults';
import { hslCss } from '../engine/core/color';

/**
 * 语义颜色角色注册表（硬编码值）。
 *
 * 注册表是「颜色语义」与「渲染值」之间的唯一映射点。
 * 所有值均为硬编码 hex，不引用 CSS 变量或引擎 token，
 * 避免数据包通过 extra 注入任意颜色值。
 */
const COLOR_SCHEME_REGISTRY: Record<string, string> = {
  primary: SYSTEM_DEFAULT_PRIMARY,
  accent:  SYSTEM_DEFAULT_PRIMARY,
  npc:     '#5a7ac0',
  player:  SYSTEM_DEFAULT_PRIMARY,
  danger:  '#e11d48',
  success: '#2ec494',
  warning: '#ffa94d',
  muted:   '#999999',
  purple:  '#7c3aed',
};

/** 解析语义角色 → CSS 颜色值（缺省回退主色）。 */
export function resolveColorScheme(scheme: string): string {
  return COLOR_SCHEME_REGISTRY[scheme] ?? COLOR_SCHEME_REGISTRY.primary;
}

/**
 * 由单一 accent 色确定性派生卡片整组视觉 token（--card-*）。
 *
 * 全部输出为具体色值（hsl/linear-gradient），不引用任何主题变量
 * （--cyan/--line/--panel-light 等），使强调卡视觉 100% 自洽：
 * 主题怎么变都不影响它；全局卡也不受它影响。
 *
 * 派生原则（基于 accent 的 HSL）：
 *   - 背景：accent 低饱和高明度（浅色渐变）
 *   - 边框：accent 中浓度（hover 用原色）
 *   - 标题/按钮文字：accent 深色可读版
 *   - 状态/产出：accent 中深可读版
 *   - 阴影：accent 透明
 */
export function accentPalette(hex: string): string {
  const strong = hslCss(hex, { saturationScale: 1.15, maxSaturation: 0.78, lightnessScale: 0.45, maxLightness: 0.38 }) ?? hex;
  const mid = hslCss(hex, { saturationScale: 1.1, maxSaturation: 0.72, lightnessScale: 0.58, maxLightness: 0.48 }) ?? hex;
  const border = hslCss(hex, { saturationScale: 0.8, maxSaturation: 0.55, lightness: 0.70 }) ?? hex;
  const bgLight = hslCss(hex, { saturationScale: 0.22, maxSaturation: 0.18, lightness: 0.97 }) ?? hex;
  const bgMid = hslCss(hex, { saturationScale: 0.12, maxSaturation: 0.10, lightness: 0.95 }) ?? hex;
  const textDark = hslCss(hex, { saturation: 0.10, lightness: 0.22 }) ?? hex;
  const textDim = hslCss(hex, { saturation: 0.08, lightness: 0.45 }) ?? hex;
  return [
    `--card-bg:linear-gradient(180deg, ${bgLight}, ${bgMid})`,
    `--card-border:${border}`,
    `--card-border-hover:${hex}`,
    `--card-text:${textDark}`,
    `--card-text-strong:${strong}`,
    `--card-text-dim:${textDim}`,
    `--card-accent:${mid}`,
    `--card-shadow:0 4px 14px ${hslCss(hex, {}, 0.25) ?? hex}`,
    `--card-btn-border:${border}`,
    `--card-btn-text:${strong}`,
    `--card-btn-border-hover:${hex}`,
    `--card-btn-text-hover:${hex}`,
  ].join(';');
}

/**
 * 卡片主题色钩子：根据语义角色输出内联 style 属性串。
 *
 * 调用方负责决定语义角色（如从 spot tags 推导），
 * 本函数仅解析注册表并派生色板。
 *
 * 返回值：
 *   - scheme 解析后等于主色 → ''（无强调，走全局默认）
 *   - 否则 → style="--card-bg:…;--card-border:…;…"（整组 token 覆盖）
 */
export function cardAccent(scheme: string): string {
  const accent = resolveColorScheme(scheme);
  if (accent === COLOR_SCHEME_REGISTRY.primary) return '';
  return `style="${accentPalette(accent)}"`;
}
