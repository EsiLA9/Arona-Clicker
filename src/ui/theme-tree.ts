import { hexToHsl, hexToRgbTriplet } from '../engine/color-system';

/** 背景明暗 → 其上文本色：底暗用白，底亮用黑（确定性）。 */
const ON_DARK = '#ffffff';
const ON_LIGHT = 'hsl(220 18% 12%)';

/**
 * 感知亮度判定阈值（WCAG 相对亮度 Y 尺度，0~1）。
 * 用「感知亮度」而非 HSL 明度：蓝色等分量的 HSL 明度偏高，但人眼感知偏暗，
 * 故中等饱和的彩色气泡（如 #3d83f2）应判为暗底、用白字而非黑字。
 */
const PERCEIVED_LIGHT_THRESHOLD = 0.30;

/** HSL(h s% l%) → 相对亮度近似（hue 转换为 RGB 权重再算 Y）。 */
function hslRelativeLuminance(h: number, s: number, l: number): number {
  const fn = (n: number): number => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const toLin = (c: number): number => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const r = toLin(fn(0));
  const g = toLin(fn(8));
  const b = toLin(fn(4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 解析一个背景节点最终颜色的感知亮度（WCAG 相对亮度 Y，支持 hex / hsl() / color-mix 兜底失败回退）。 */
function bgLightness(bg: string): number {
  const hex = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (hex) {
    const int = parseInt(hex[1], 16);
    const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const r = lin(((int >> 16) & 255) / 255);
    const g = lin(((int >> 8) & 255) / 255);
    const b = lin((int & 255) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const m = /hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%/i.exec(bg);
  if (m) return hslRelativeLuminance(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
  // color-mix 等无法静态解析 → 按亮底处理（用黑字）
  return PERCEIVED_LIGHT_THRESHOLD;
}

/**
 * 界面色彩树 —— 所有 UI 颜色集中设定工具。
 *
 * 每个节点描述：
 *  - acRef：对齐引擎注入的 --ac-* token 名；存在时该节点「引擎强制设色优先」，
 *           生成 `var(--ac-<acRef>, <derive>)`，引擎给了就用、否则自动衍生。
 *  - derive：从主题 primary 自动衍生默认值（无 acRef 或 acRef 缺失时采用）。
 *  - constant：固定语义色（如成功/警告），不随主题变化。
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

function hslCss(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}
const shade = (hex: string, sMul: number, l: number): string => {
  const { h, s } = hexToHsl(hex);
  return hslCss(h, s * sMul, l);
};

export const THEME_NODES: Record<ThemeVarName, ThemeNode> = {
  ink:            { acRef: 'text',         derive: p => shade(p, 0.08, 0.15) },
  'ink-strong':   {                         derive: p => `color-mix(in srgb, var(--ink, ${shade(p, 0.08, 0.15)}), #000 18%)` },
  muted:          { acRef: 'textDim',      derive: p => shade(p, 0.08, 0.40) },
  line:           { acRef: 'border',       derive: p => shade(p, 0.20, 0.82) },
  panel:          { constant: '#ffffff', isBg: true },
  'panel-light':  { acRef: 'bgAlt',        derive: p => shade(p, 0.15, 0.90), isBg: true },
  canvas:         { acRef: 'bg',           derive: p => shade(p, 0.12, 0.96), isBg: true },
  cyan:           { acRef: 'primary',      derive: p => p, isBg: true },
  'primary-rgb':  { acRef: 'primary-rgb',  derive: p => hexToRgbTriplet(p) },
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
    let bgColor: string;
    if (overrides[name] != null) {
      bgColor = overrides[name]!;
      out[name] = bgColor;
    } else if (node.constant != null) {
      bgColor = node.constant;
      out[name] = bgColor;
    } else {
      const derived = node.derive ? node.derive(primary) : '';
      bgColor = derived;
      out[name] = node.acRef ? `var(--ac-${node.acRef}, ${derived})` : derived;
    }
    // 背景节点 → 其上文本色：跟随「该背景的实际取值」判定白/黑，而非主题色的深浅。
    // 判定优先级：引擎真实 token（作者显式深浅背景）> 本节点最终色（含 override/constant/derived）。
    // 用确定性 JS 判定并落成静态色值（而非 CSS color-contrast()）：
    // color-contrast() 跨浏览器支持不稳（多数引擎未实现运行时对比度计算，会被忽略回退），
    // 一旦失效会让 --ink-on-* 变无效 → 文本回退成继承色，导致深底上出现深字。
    // 这里取该背景节点「实际解析后」的颜色做明暗判定，任一背景（含 --ac-* 覆盖、override）都正确反色。
    if (node.isBg) {
      const realBg = node.acRef && tokens ? tokens[node.acRef] : undefined;
      const bg = realBg ?? bgColor;
      const inkOn = bgLightness(bg) > PERCEIVED_LIGHT_THRESHOLD ? ON_LIGHT : ON_DARK;
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
 * 给定背景色（hex / hsl / 引擎 token 解析值），返回其上可读文字色：
 * 底暗 → 白，底亮 → 黑。供需要在 JS 侧直接决定文字色的场景使用。
 */
export function readableOn(bg: string): string {
  return bgLightness(bg) > PERCEIVED_LIGHT_THRESHOLD ? ON_LIGHT : ON_DARK;
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
