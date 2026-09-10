import {
  resolveTheme,
  themeContributionFromThemeDef,
} from '../arona-clicker/services/color-system';
import type {
  ColorGroupId,
  ThemeDef,
} from '../engine/types';
import type { ColorGroupDef } from '../data-services/contracts/color';
import { SYSTEM_DEFAULT_PRIMARY } from '../engine/core/theme-defaults';
import { hslCss, rgbTriplet, readableOnColor } from '../engine/core/color';
import { buildThemeNodeVars, type ThemeNodeName } from './theme-palette';

/**
 * 界面色彩树 —— 所有 UI 颜色集中设定工具。
 *
 * 每个节点描述：
 *  - acRef：对齐引擎注入的 --ac-* token 名；存在时该节点「引擎强制设色优先」，
 *           生成 `var(--ac-<acRef>, <derive>)`，引擎给了就用、否则自动衍生。
 *  - derive：从主题 primary 自动衍生默认值（无 acRef 或 acRef 缺失时采用）。
 *  - constant：固定语义色（如成功/警告），不随主题变化；与 acRef 共存时作为
 *           var 链的兜底值（如 panel 默认为白、可被 Color 的 panel token 覆盖）。
 *  - isBg：标记该节点为「背景色」，额外生成 `--ink-on-<name>` 文本色变量，
 *          由背景明暗决定其上文字是白还是黑（底暗白字 / 底亮黑字）。
 *
 * buildThemeVars(primary, overrides?, tokens?) 把树展开成一维 `--<name>` 映射：
 *  - overrides 对任意节点强制设色（最高优先级，直接采用，不走衍生/acRef）。
 *  - 无 override 且有 acRef：生成 `var(--ac-<acRef>, <derive>)`。
 *  - 无 override 无 acRef：直接用 derive 的自动衍生值。
 *  - tokens 为引擎已解析的真实色彩表（可选）：背景节点优先用其中的真实色判定明暗，
 *   使作者显式设的深/浅背景能正确翻转其上文字色。
 */

export type ThemeVarName =
  | 'ink' | 'ink-strong' | 'muted' | 'line'
  | 'panel' | 'panel-light' | 'canvas'
  | 'cyan' | 'primary-rgb'
  | 'player-bubble' | 'npc-bubble'
  | 'lime' | 'orange';

/** 背景节点配套文本色变量名（如 'ink-on-panel'）。 */
export type InkOnVarName = `ink-on-${ThemeVarName}`;

interface ThemeNode {
  acRef?: string;
  derive?: (primary: string) => string;
  constant?: string;
  /** 标记该节点为「背景色」，会额外生成一个 `--ink-on-<name>` 文本色变量（底暗白字/底亮黑字）。 */
  isBg?: boolean;
}

/** 由基准色派生出「饱和度 ×sMul、明度固定为 l」的色（框架唯一派生入口）。 */
const shade = (hex: string, sMul: number, l: number): string => hslCss(hex, { saturationScale: sMul, lightness: l }) ?? hex;

export const THEME_NODES: Record<ThemeVarName, ThemeNode> = {
  ink:            { acRef: 'text',         derive: p => shade(p, 0.08, 0.15) },
  'ink-strong':   {                         derive: p => `color-mix(in srgb, var(--ink, ${shade(p, 0.08, 0.15)}), #000 18%)` },
  muted:          { acRef: 'textDim',      derive: p => shade(p, 0.08, 0.40) },
  line:           { acRef: 'border',       derive: p => shade(p, 0.20, 0.82) },
  panel:          { acRef: 'panel', constant: '#ffffff', isBg: true },
  'panel-light':  { acRef: 'bgAlt',        derive: p => shade(p, 0.15, 0.90), isBg: true },
  canvas:         { acRef: 'bg',           derive: p => shade(p, 0.12, 0.96), isBg: true },
  cyan:           { acRef: 'primary',      derive: p => p, isBg: true },
  'primary-rgb':  { acRef: 'primary-rgb',  derive: p => rgbTriplet(p) },
  'player-bubble':{ acRef: 'playerBubble', derive: p => p, isBg: true },
  'npc-bubble':   { acRef: 'npcBubble',    derive: p => shade(p, 0.50, 0.30) },
  lime:           { constant: '#2ec494' },
  orange:         { constant: '#ffa94d' },
};

export function buildThemeVars(
  primary: string,
  overrides: Partial<Record<ThemeVarName, string>> = {},
  tokens?: Record<string, string> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(THEME_NODES) as ThemeVarName[]) {
    const node = THEME_NODES[name];
    let bgColor: string; // 写入 out[name] 的值（acRef 节点为 var 链）
    if (overrides[name] != null) {
      bgColor = overrides[name]!;
    } else if (node.acRef) {
      // 引擎强制层优先：var(--ac-<acRef>, <constant|derive>)；
      // 常量节点（如 panel）也可被引擎 token 覆盖（作者定义部分节点颜色）。
      const fallback = node.constant ?? (node.derive ? node.derive(primary) : '');
      bgColor = `var(--ac-${node.acRef}, ${fallback})`;
    } else if (node.constant != null) {
      bgColor = node.constant;
    } else {
      bgColor = node.derive ? node.derive(primary) : '';
    }
    out[name] = bgColor;
    // 背景节点 → 其上文本色：跟随「该背景的实际取值」判定白/深，而非主题色的深浅。
    // 判定优先级：引擎真实 token（作者显式深浅背景）> 本节点最终色（含 override/constant/derived）。
    // 用确定性 JS 判定并落成静态色值（而非 CSS color-contrast()）：
    // color-contrast() 跨浏览器支持不稳（多数引擎未实现运行时对比度计算，会被忽略回退），
    // 一旦失效会让 --ink-on-* 变无效 → 文本回退成继承色，导致深底上出现深字。
    // 这里取该背景节点「实际解析后」的颜色做明暗判定，任一背景（含 --ac-* 覆盖、override）都正确反色。
    if (node.isBg) {
      const realBg = node.acRef && tokens ? tokens[node.acRef] : undefined;
      const inkOn = readableOnColor(realBg ?? bgColor);
      out[`ink-on-${name}` as InkOnVarName] = inkOn;
      // 弱化字色（次要/说明文本）：跟随同一背景的 ink-on 派生，保证任何明暗背景上都有可读的灰字。
      out[`muted-on-${name}` as InkOnVarName] = `color-mix(in srgb, ${inkOn} 58%, transparent)`;
    }
  }
  return out;
}

/** 任意节点的纯自动衍生值（忽略 acRef 强制层），供预览/调试。 */
export function deriveNode(name: ThemeVarName, primary: string): string {
  const node = THEME_NODES[name];
  if (node.constant != null) return node.constant;
  return node.derive ? node.derive(primary) : '';
}

/**
 * area-hero 横幅渐变：以主题 primary 为光晕核心、canvas/panel-light 为基底，
 * 形成随主题切换的渐变渲染。优先用引擎真实 token 的 primary 主色。
 */
export function heroGradient(primary: string, tokens?: Record<string, string> | null): string {
  const realPrimary = (tokens && tokens['primary']) || primary;
  const glow = `color-mix(in srgb, ${realPrimary} 22%, transparent)`;
  return `linear-gradient(125deg, ${'var(--canvas)'} 0%, ${'var(--panel-light)'} 55%, ${glow} 100%)`;
}

// ============================================================================
// ThemeTree：实体自有的"参考树"快照（CSS 变量映射）
//
// 与整个界面一一对应的全局参考树由 controller.applyTheme 维护（合并运行时层后
// 经 buildThemeVars 注入 :root）。此处提供"实体把自己的期望色填入参考树某个节点、
// 向下构建出完整 CSS 变量映射"的快速映射，既可用于整体预览，也可在必要时绕过全局
// 参考树、直接把映射落到某个容器（作用域化 / inline 覆盖）。
// ============================================================================

/** 一套完整 CSS 变量映射（含 --ac-* 引擎 token、语义节点、--hero-gradient）。 */
export type ThemeTree = Record<string, string>;

/**
 * 由引擎 token 表构建实体自有的 ThemeTree 快照：
 *  - 透传 --ac-*（背景节点上的 --ink-on-* 才能按 token 明暗正确反色）
 *  - 展开语义节点（ink / panel / canvas / 气泡 …）
 *  - 附加 --hero-gradient
 * 等价于把该 token 表"填入参考树 primary 节点、向下构建"的结果。
 */
export function buildThemeTree(
  tokens: Record<string, string>,
  primary?: string,
  palette?: readonly string[],
  nodeOverrides: ReadonlyMap<ThemeNodeName, string> = new Map(),
): ThemeTree {
  const resolvedPrimary = primary ?? tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY;
  const resolvedPalette = palette && palette.length > 0 ? palette : [resolvedPrimary];
  const tree: ThemeTree = { ...buildThemeVars(resolvedPrimary, {}, tokens) };
  Object.assign(tree, buildThemeNodeVars({ colors: resolvedPalette }, tokens, nodeOverrides));
  for (const [key, value] of Object.entries(tokens)) {
    tree[`--ac-${key}`] = value;
  }
  tree['--hero-gradient'] = heroGradient(resolvedPrimary, tokens);
  return tree;
}

/** 把 ThemeTree 应用到某个容器元素（作用域化：其后代继承这些变量）。 */
export function applyThemeTree(el: HTMLElement, tree: ThemeTree): void {
  for (const [key, value] of Object.entries(tree)) {
    el.style.setProperty(key, value);
  }
}

/** 清除容器上的 ThemeTree 变量（传 tree 只清已知键；缺省清全部自定义属性）。 */
export function clearThemeTree(el: HTMLElement, tree?: ThemeTree): void {
  const keys = tree ? Object.keys(tree) : [...el.style];
  for (const key of keys) el.style.removeProperty(key);
}

/** ThemeTree → 内联 style 字符串（供 HTML 模板直接填入，即"绕过参考树直接 fill styles"）。 */
export function themeTreeToInlineStyle(tree: ThemeTree): string {
  return Object.entries(tree)
    .map(([k, v]) => `${k.startsWith('--') ? k : '--' + k}:${v}`)
    .join(';');
}

// --- ColorGroup / ThemeDef 各自的快速映射 ---

/** ColorGroup 快速映射：直接用 resolveTheme 解析为 ThemeTree。 */
export function themeTreeFromGroup(group: ColorGroupDef): ThemeTree {
  return buildThemeTree(resolveTheme(group), undefined, group.slots.map(slot => slot.color));
}

/** ThemeDef（自定义主题）快速映射：引用 ColorGroup 打底 + 局部覆盖。 */
export function themeTreeFromThemeDef(
  theme: ThemeDef | undefined,
  getGroup: (id: ColorGroupId) => ColorGroupDef | undefined,
): ThemeTree {
  const group = theme?.colorGroupId ? getGroup(theme.colorGroupId) : undefined;
  const palette = theme?.palette?.length ? theme.palette : group?.slots.map(slot => slot.color);
  const nodeOverrides = new Map(Object.entries(theme?.nodes ?? {}) as [ThemeNodeName, string][]);
  return buildThemeTree(themeContributionFromThemeDef(theme, getGroup), undefined, palette, nodeOverrides);
}
