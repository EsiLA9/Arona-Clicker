import type { ThemeTokens } from '../engine/core/theme-runtime';
import type { ThemeMode, ThemeNodeName } from '../engine/types/theme';

export type { ThemeNodeName } from '../engine/types/theme';
export type { ThemeMode } from '../engine/types/theme';

export interface ThemeRenderOptions { mode: ThemeMode; }

export const THEME_PALETTE_MAX = 6;

function hslCss(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

function hexToHsl(color: string): { h: number; s: number; l: number } | undefined {
  const match = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return undefined;
  const value = Number.parseInt(match[1], 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(channel => channel / 255);
  const max = Math.max(...rgb); const min = Math.min(...rgb); const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rgb[0]) h = ((rgb[1] - rgb[2]) / delta + (rgb[1] < rgb[2] ? 6 : 0)) / 6;
  else if (max === rgb[1]) h = ((rgb[2] - rgb[0]) / delta + 2) / 6;
  else h = ((rgb[0] - rgb[1]) / delta + 4) / 6;
  return { h, s, l };
}

function lightBackgroundSurface(color: string, mode: ThemeMode, hueShift = 0): string {
  if (mode === 'dark') return color;
  const hsl = hexToHsl(color);
  if (!hsl) return `color-mix(in srgb, ${color} 8%, #ffffff)`;
  const lightness = hsl.l + (0.999 - hsl.l) * 0.97;
  const controlledLightness = Math.min(0.99, lightness > 0.985 ? lightness - 0.004 : lightness);
  return hslCss((hsl.h + hueShift) % 1, hsl.s * 0.36, controlledLightness);
}

/** 将主题锚点压向浅色表面；dark 分支只保留接口，暂时不改变颜色。 */
export function deriveSurfaceColor(color: string, mode: ThemeMode = 'light', amount = 0.8): string {
  if (mode === 'dark') return color;
  const hsl = hexToHsl(color);
  if (!hsl) return `color-mix(in srgb, ${color} ${Math.round((1 - amount) * 100)}%, #ffffff)`;
  return hslCss(hsl.h, hsl.s * (1 - amount * 0.45), hsl.l + (0.96 - hsl.l) * amount);
}

/** 生成没有显式背景层时使用的主题浅渐变。第二色缺失时由第一色派生第二端点。 */
export function deriveBackgroundGradient(colors: readonly string[], mode: ThemeMode = 'light'): string {
  const first = colors[0] ?? '#3b9eff';
  const second = colors[1]
    ? lightBackgroundSurface(colors[1], mode)
    : lightBackgroundSurface(first, mode, 0.11);
  const firstEndpoint = lightBackgroundSurface(first, mode);
  return `linear-gradient(135deg, ${firstEndpoint} 0%, ${second} 100%)`;
}

export interface ThemePalette {
  colors: readonly string[];
}

export interface ThemeNodeOverride {
  node: ThemeNodeName;
  color: string;
}

export type ThemeScopeId =
  | 'root'
  | 'header'
  | 'left'
  | 'left.area'
  | 'left.contacts'
  | 'left.story'
  | 'center'
  | 'center.chat'
  | 'center.log'
  | 'center.conversation'
  | 'right'
  | 'right.spot'
  | 'right.character'
  | 'right.enh'
  | 'right.other'
  | 'footer';

const PREFERRED_PALETTE_INDEX: Record<ThemeNodeName, number> = {
  primary: 0,
  primaryStrong: 0,
  bg: 0,
  bgAlt: 1,
  panel: 0,
  panelLight: 1,
  text: 0,
  muted: 1,
  line: 1,
  active: 1,
  highlight: 2,
  success: 4,
  warning: 5,
  danger: 5,
  accent: 1,
  playerBubble: 0,
  npcBubble: 1,
};

const TOKEN_FOR_NODE: Record<ThemeNodeName, readonly string[]> = {
  primary: ['primary'],
  primaryStrong: ['primaryStrong', 'primary'],
  bg: ['bg'],
  bgAlt: ['bgAlt'],
  panel: ['panel'],
  panelLight: ['panelAlt', 'bgAlt'],
  text: ['text'],
  muted: ['muted', 'textDim'],
  line: ['line', 'border'],
  active: ['active'],
  highlight: ['highlight'],
  success: ['success'],
  warning: ['warning'],
  danger: ['danger'],
  accent: ['accent'],
  playerBubble: ['playerBubble'],
  npcBubble: ['npcBubble'],
};

export function normalizeThemePalette(colors: readonly string[] | undefined): string[] {
  return [...(colors ?? [])].filter(color => typeof color === 'string' && color.trim().length > 0).slice(0, THEME_PALETTE_MAX);
}

export function paletteColor(colors: readonly string[], preferredIndex: number, fallback = '#3b9eff'): string {
  if (colors.length === 0) return fallback;
  const index = Math.max(0, Math.min(Math.floor(preferredIndex), colors.length - 1));
  return colors[index] ?? colors[0] ?? fallback;
}

export function preferredPaletteIndex(node: ThemeNodeName): number {
  return PREFERRED_PALETTE_INDEX[node];
}

export function resolveThemeNode(
  node: ThemeNodeName,
  palette: ThemePalette,
  tokens: ThemeTokens = {},
  overrides: ReadonlyMap<ThemeNodeName, string> = new Map(),
): string {
  const override = overrides.get(node);
  if (override !== undefined) return override;
  for (const token of TOKEN_FOR_NODE[node]) {
    if (tokens[token] !== undefined) return tokens[token] as string;
  }
  const selectedColor = paletteColor(palette.colors, preferredPaletteIndex(node));
  if (node === 'bg') return lightBackgroundSurface(selectedColor, 'light');
  if (node === 'bgAlt') return lightBackgroundSurface(selectedColor, 'light', 0.11);
  if (node === 'panel') return deriveSurfaceColor(selectedColor, 'light', 0.94);
  if (node === 'panelLight') return deriveSurfaceColor(selectedColor, 'light', 0.97);
  if (palette.colors.length === 1) {
    const anchor = palette.colors[0];
    if (node === 'text') return '#172033';
    if (node === 'muted') return '#60708a';
    if (node === 'line') return `color-mix(in srgb, ${anchor} 18%, #172033)`;
  }
  return paletteColor(palette.colors, preferredPaletteIndex(node));
}

export function resolveThemeNodes(
  palette: ThemePalette,
  tokens: ThemeTokens = {},
  overrides: ReadonlyMap<ThemeNodeName, string> = new Map(),
): Record<ThemeNodeName, string> {
  return (Object.keys(PREFERRED_PALETTE_INDEX) as ThemeNodeName[]).reduce((out, node) => {
    out[node] = resolveThemeNode(node, palette, tokens, overrides);
    return out;
  }, {} as Record<ThemeNodeName, string>);
}

function cssNodeName(node: ThemeNodeName): string {
  return node.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** 将语义节点落为独立 CSS 变量，供组件按语义引用而非自行选择色板位置。 */
export function buildThemeNodeVars(
  palette: ThemePalette,
  tokens: ThemeTokens = {},
  overrides: ReadonlyMap<ThemeNodeName, string> = new Map(),
): Record<string, string> {
  const nodes = resolveThemeNodes(palette, tokens, overrides);
  return Object.fromEntries(Object.entries(nodes).map(([node, color]) => [`--theme-node-${cssNodeName(node as ThemeNodeName)}`, color]));
}

/** 在已有父作用域节点结果上应用当前作用域覆盖，未覆盖节点保持继承。 */
export function resolveScopedThemeNodes(
  parent: Readonly<Record<ThemeNodeName, string>>,
  overrides: ReadonlyMap<ThemeNodeName, string> = new Map(),
): Record<ThemeNodeName, string> {
  return (Object.keys(PREFERRED_PALETTE_INDEX) as ThemeNodeName[]).reduce((out, node) => {
    out[node] = overrides.get(node) ?? parent[node];
    return out;
  }, {} as Record<ThemeNodeName, string>);
}

export function buildScopedThemeNodeVars(
  nodes: Readonly<Record<ThemeNodeName, string>>,
): Record<string, string> {
  return Object.fromEntries(Object.entries(nodes).map(([node, color]) => [`--theme-node-${cssNodeName(node as ThemeNodeName)}`, color]));
}

function lightness(color: string): number {
  const hex = color.trim().match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const digits = hex.length === 3 ? hex.split('').map(part => part + part) : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
    const [r, g, b] = digits.map(part => parseInt(part, 16) / 255);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  }
  const hsl = color.match(/hsla?\([^)]*[\s,]([\d.]+)%\s*(?:\/[^)]*)?\)$/i)?.[1];
  return hsl ? Number(hsl) / 100 : 0.5;
}

export const READABLE_ON_LIGHTNESS_THRESHOLD = 0.80;

function readableOn(color: string): string {
  return lightness(color) > READABLE_ON_LIGHTNESS_THRESHOLD ? '#172033' : '#ffffff';
}

/** 为作用域同步旧变量，并让局部面板/气泡在节点覆盖后仍保持可读。 */
export function buildScopedThemeCompatibilityVars(nodes: Readonly<Record<ThemeNodeName, string>>): Record<string, string> {
  const panelInk = readableOn(nodes.panel);
  const panelLightInk = readableOn(nodes.panelLight);
  const bgInk = readableOn(nodes.bg);
  const primaryInk = readableOn(nodes.primary);
  const highlightInk = readableOn(nodes.highlight);
  const playerBubbleInk = readableOn(nodes.playerBubble);
  const npcBubbleInk = readableOn(nodes.npcBubble);
  return {
    ...buildThemeCompatibilityVars(),
    '--ink-on-panel': panelInk,
    '--muted-on-panel': `color-mix(in srgb, ${panelInk} 58%, transparent)`,
    '--ink-on-panel-light': panelLightInk,
    '--muted-on-panel-light': `color-mix(in srgb, ${panelLightInk} 58%, transparent)`,
    '--ink-on-canvas': bgInk,
    '--muted-on-canvas': `color-mix(in srgb, ${bgInk} 58%, transparent)`,
    '--ink-on-primary': primaryInk,
    '--ink-on-highlight': highlightInk,
    '--ink-on-player-bubble': playerBubbleInk,
    '--muted-on-player-bubble': `color-mix(in srgb, ${playerBubbleInk} 58%, transparent)`,
    '--ink-on-npc-bubble': npcBubbleInk,
    '--muted-on-npc-bubble': `color-mix(in srgb, ${npcBubbleInk} 58%, transparent)`,
  };
}

/** 旧主题树变量的兼容别名，允许组件渐进迁移到 --theme-node-*。 */
export function buildThemeCompatibilityVars(): Record<string, string> {
  return {
    '--cyan': 'var(--theme-node-primary)',
    '--panel': 'var(--theme-node-panel)',
    '--panel-light': 'var(--theme-node-panel-light)',
    '--canvas': 'var(--theme-node-bg)',
    '--ink': 'var(--theme-node-text)',
    '--muted': 'var(--theme-node-muted)',
    '--line': 'var(--theme-node-line)',
    '--player-bubble': 'var(--theme-node-player-bubble)',
    '--npc-bubble': 'var(--theme-node-npc-bubble)',
    '--primary': 'var(--theme-node-primary)',
    '--bg': 'var(--theme-node-bg)',
    '--bg-alt': 'var(--theme-node-bg-alt)',
    '--text': 'var(--theme-node-text)',
    '--accent': 'var(--theme-node-accent)',
    '--danger': 'var(--theme-node-danger)',
    '--ink-on-primary': '#ffffff',
    '--ink-on-highlight': '#ffffff',
  };
}
