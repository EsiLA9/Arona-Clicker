// ============================================================
// engine/core/color.ts — 色彩框架
//
// 全项目**唯一**的色彩实现：解析 / 序列化 / HSL 派生 / 度量 / 混合叠加。
// 引擎服务（color-system）、UI 主题树（theme-tree / theme-palette / color-scheme）、
// 背景图层服务（ui/background-color）一律调用本模块。
// 禁止在别处再写 hexToHsl、hslCss、亮度模型、对比度、可读文字色或阈值常量。
//
// 两套判定契约（回答两个不同的问题，不要合并）：
//   1. 主题面判定 —— themeSurfaceIsLight / themeSurfaceInk
//      HSL 明度 + THEME_LIGHTNESS_THRESHOLD(0.38)。
//      用途：primary → 整套 token 走浅底还是深底；主题色相的面（气泡/色块）上的文字。
//   2. 背景文字判定 —— readableOnColor
//      WCAG 相对亮度 + TEXT_ON_LIGHT_THRESHOLD(0.75)。
//      用途：某个已知背景上的文字取白还是深（如 --ink-on-*、多图层合成背景）。
//      阈值刻意保守（纯对比度交叉点 ≈0.21）：中等饱和彩色（#3d83f2，Y≈0.24）判为
//      深底用白字，符合本项目「彩色底优先白字」的既定取向。
//
// 色相单位统一为**度**（0~360），禁止再把 0~1 归一色相跨函数传递：
// `(h + 12)` 这类写法正是单位混用造成的静默失效（bgAlt 的 +12° 偏移曾是空操作）。
// ============================================================

/** 非预乘 sRGB 分量 + alpha，取值域 0~1（与 CSS 语义一致）。 */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** HSL：色相为**度**（0~360），饱和度/明度为 0~1。 */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** 可被本框架接受的色彩输入。 */
export type ColorSource = Rgba | Hsl | string;

/** CSS 变量查找表：var(--name) 的替代值（必须来自该渲染作用域）。 */
export type VarLookup = Readonly<Record<string, string | undefined>>;

/** 主题面「底亮」阈值（HSL 明度）。 */
export const THEME_LIGHTNESS_THRESHOLD = 0.38;
/** 背景「底亮」阈值（WCAG 相对亮度）。 */
export const TEXT_ON_LIGHT_THRESHOLD = 0.75;
/** 底暗时的文字色。 */
export const INK_ON_DARK = '#ffffff';
/** 底亮时的文字色（与 css/background.css 的 data-theme-text-mode="dark" 语义一致）。 */
export const INK_ON_LIGHT = 'hsl(220 18% 12%)';
/** WCAG AA 正文最低对比度。 */
export const MIN_CONTRAST = 4.5;

const MAX_VAR_DEPTH = 8;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function isRgba(source: ColorSource): source is Rgba {
  return typeof source === 'object' && 'r' in source;
}

function isHsl(source: ColorSource): source is Hsl {
  return typeof source === 'object' && 'h' in source;
}

// --- 解析 ---

/** 在括号/引号之外按分隔符切分（渐变参数与 var() 兜底值都需要）。 */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** 取括号外的首个空白前的片段：色标颜色本体，剔除其后的位置描述。 */
function leadingToken(text: string): string {
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && (char === ' ' || char === '\t')) return text.slice(0, index);
  }
  return text;
}

function unitToNumber(token: string): number | undefined {
  const match = /^([-+]?(?:\d+\.?\d*|\.\d+))(%?)$/.exec(token.trim());
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? (match[2] ? value / 100 : value) : undefined;
}

function parseHue(token: string): number | undefined {
  const match = /^([-+]?(?:\d+\.?\d*|\.\d+))(deg|grad|rad|turn)?$/.exec(token.trim());
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = match[2];
  if (unit === 'grad') return (value * 360) / 400;
  if (unit === 'rad') return (value * 180) / Math.PI;
  if (unit === 'turn') return value * 360;
  return value;
}

function parseHexColor(digits: string): Rgba | undefined {
  const expand = (part: string): number => parseInt(part.length === 1 ? part + part : part, 16) / 255;
  if (digits.length === 3 || digits.length === 4) {
    return {
      r: expand(digits[0]!),
      g: expand(digits[1]!),
      b: expand(digits[2]!),
      a: digits.length === 4 ? expand(digits[3]!) : 1,
    };
  }
  if (digits.length === 6 || digits.length === 8) {
    return {
      r: expand(digits.slice(0, 2)),
      g: expand(digits.slice(2, 4)),
      b: expand(digits.slice(4, 6)),
      a: digits.length === 8 ? expand(digits.slice(6, 8)) : 1,
    };
  }
  return undefined;
}

function functionBody(text: string): string | undefined {
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  return open >= 0 && close > open ? text.slice(open + 1, close) : undefined;
}

/** rgb()/rgba()：兼容逗号与空格语法、百分比分量、`/` 与第 4 参 alpha。 */
function parseRgbColor(body: string): Rgba | undefined {
  const [colorPart, alphaPart = ''] = splitTopLevel(body, '/');
  const segments = colorPart!.includes(',')
    ? splitTopLevel(colorPart!, ',')
    : colorPart!.trim().split(/\s+/);
  const tokens = segments.map(part => part.trim()).filter(Boolean);
  if (tokens.length < 3) return undefined;
  const channels: number[] = [];
  for (const token of tokens.slice(0, 3)) {
    const value = unitToNumber(token);
    if (value === undefined) return undefined;
    // 百分比形式已是 0~1；数值形式按 0~255 归一
    channels.push(token.trim().endsWith('%') ? value : value / 255);
  }
  const alphaToken = (alphaPart.trim() || tokens[3] || '').trim();
  const alpha = alphaToken ? unitToNumber(alphaToken) : 1;
  if (alpha === undefined) return undefined;
  return { r: clamp01(channels[0]!), g: clamp01(channels[1]!), b: clamp01(channels[2]!), a: clamp01(alpha) };
}

/** hsl()/hsla()：兼容 `h s% l%`、逗号语法与 `/` alpha。 */
function parseHslColor(body: string): Rgba | undefined {
  const parsed = parseHslParts(body);
  if (!parsed) return undefined;
  const { hsl, alpha } = parsed;
  const rgb = hslToRgb(hsl);
  return { ...rgb, a: alpha };
}

function parseHslParts(body: string): { hsl: Hsl; alpha: number } | undefined {
  const [colorPart, alphaPart = ''] = splitTopLevel(body, '/');
  const segments = colorPart!.includes(',')
    ? splitTopLevel(colorPart!, ',')
    : colorPart!.trim().split(/\s+/);
  const tokens = segments.map(part => part.trim()).filter(Boolean);
  if (tokens.length < 3) return undefined;
  const hue = parseHue(tokens[0]!);
  const saturation = unitToNumber(tokens[1]!);
  const lightness = unitToNumber(tokens[2]!);
  if (hue === undefined || saturation === undefined || lightness === undefined) return undefined;
  const alphaToken = (alphaPart.trim() || tokens[3] || '').trim();
  const alpha = alphaToken ? unitToNumber(alphaToken) : 1;
  if (alpha === undefined) return undefined;
  return { hsl: { h: normalizeHue(hue), s: clamp01(saturation), l: clamp01(lightness) }, alpha: clamp01(alpha) };
}

function parseVarColor(text: string, lookup: VarLookup | undefined, depth: number): Rgba | undefined {
  const body = functionBody(text);
  if (body === undefined) return undefined;
  const parts = splitTopLevel(body, ',');
  const name = parts[0]!.trim();
  const fallback = parts.slice(1).join(',').trim();
  const declared = lookup?.[name];
  if (declared) {
    const parsed = parseColor(declared, lookup, depth + 1);
    if (parsed) return parsed;
  }
  return fallback ? parseColor(fallback, lookup, depth + 1) : undefined;
}

/**
 * 解析静态 CSS 颜色为 Rgba。
 * 支持 #rgb/#rgba/#rrggbb/#rrggbbaa、rgb()/rgba()、hsl()/hsla()、transparent
 * 与可静态解析的 var(--x[, fallback])。无法解析（含 url()、color-mix 等）返回 undefined。
 */
export function parseColor(value: string, lookup?: VarLookup, depth = 0): Rgba | undefined {
  if (typeof value !== 'string' || depth > MAX_VAR_DEPTH) return undefined;
  const text = value.trim().toLowerCase();
  if (!text) return undefined;
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (text.startsWith('var(')) return parseVarColor(text, lookup, depth);
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text);
  if (hex) return parseHexColor(hex[1]!);
  if (/^rgba?\(/.test(text)) {
    const body = functionBody(text);
    return body === undefined ? undefined : parseRgbColor(body);
  }
  if (/^hsla?\(/.test(text)) {
    const body = functionBody(text);
    return body === undefined ? undefined : parseHslColor(body);
  }
  return undefined;
}

// --- 转换与序列化 ---

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function hslToRgb(hsl: Hsl): { r: number; g: number; b: number } {
  const hue = normalizeHue(hsl.h);
  const s = clamp01(hsl.s);
  const l = clamp01(hsl.l);
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: clamp01(channel(0)), g: clamp01(channel(8)), b: clamp01(channel(4)) };
}

export function rgbToHsl(color: Rgba): Hsl {
  const r = clamp01(color.r);
  const g = clamp01(color.g);
  const b = clamp01(color.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  const hue = max === r
    ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
    : max === g
      ? ((b - r) / delta + 2) / 6
      : ((r - g) / delta + 4) / 6;
  return { h: normalizeHue(hue * 360), s: clamp01(s), l };
}

/** 任意色彩输入 → Rgba（字符串按 lookup 解析）。 */
export function toRgba(source: ColorSource, lookup?: VarLookup): Rgba | undefined {
  if (typeof source === 'string') return parseColor(source, lookup);
  if (isRgba(source)) return source;
  if (isHsl(source)) return { ...hslToRgb(source), a: 1 };
  return undefined;
}

/** 任意色彩输入 → Hsl（字符串按 lookup 解析）。 */
export function toHsl(source: ColorSource, lookup?: VarLookup): Hsl | undefined {
  if (typeof source === 'string') {
    const parsed = parseColor(source, lookup);
    return parsed ? rgbToHsl(parsed) : undefined;
  }
  if (isHsl(source)) return { h: normalizeHue(source.h), s: clamp01(source.s), l: clamp01(source.l) };
  if (isRgba(source)) return rgbToHsl(source);
  return undefined;
}

function channelToHex(channel: number): string {
  return Math.round(clamp01(channel) * 255).toString(16).padStart(2, '0');
}

/** Rgba → #rrggbb（丢弃 alpha）。 */
export function toHex(color: Rgba): string {
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;
}

/** 色彩输入 → `r, g, b`（0~255），供 rgba(var(--x-rgb), a) 形式消费。 */
export function rgbTriplet(value: ColorSource, fallback = '59, 158, 255'): string {
  const color = toRgba(value);
  if (!color) return fallback;
  return `${Math.round(clamp01(color.r) * 255)}, ${Math.round(clamp01(color.g) * 255)}, ${Math.round(clamp01(color.b) * 255)}`;
}

/** HSL → CSS 文本；alpha 为 0~1 时输出 hsla(... / a)。 */
export function formatHsl(hsl: Hsl, alpha?: number): string {
  const h = Math.round(normalizeHue(hsl.h));
  const s = Math.round(clamp01(hsl.s) * 100);
  const l = Math.round(clamp01(hsl.l) * 100);
  return alpha === undefined
    ? `hsl(${h} ${s}% ${l}%)`
    : `hsla(${h} ${s}% ${l}% / ${clamp01(alpha)})`;
}

// --- HSL 派生（全项目唯一的颜色调整入口） ---

export interface HslAdjust {
  /** 色相偏移，单位**度**。 */
  hueShift?: number;
  /** 饱和度倍数。 */
  saturationScale?: number;
  /** 饱和度下限（在 saturationScale 之后生效）。 */
  minSaturation?: number;
  /** 饱和度上限。 */
  maxSaturation?: number;
  /** 饱和度绝对值（优先于 saturationScale / min / max）。 */
  saturation?: number;
  /** 明度绝对值（优先于 lightnessScale）。 */
  lightness?: number;
  /** 明度倍数。 */
  lightnessScale?: number;
  /** 明度下限。 */
  minLightness?: number;
  /** 明度上限。 */
  maxLightness?: number;
}

/** 在 HSL 空间做确定性调整（不经过 RGB 往返，保证输出与派生式一一对应）。 */
export function adjustHsl(source: ColorSource, adjust: HslAdjust, lookup?: VarLookup): Hsl | undefined {
  const base = toHsl(source, lookup);
  if (!base) return undefined;
  const h = normalizeHue(base.h + (adjust.hueShift ?? 0));
  let s = adjust.saturation ?? base.s * (adjust.saturationScale ?? 1);
  if (adjust.minSaturation !== undefined) s = Math.max(s, adjust.minSaturation);
  if (adjust.maxSaturation !== undefined) s = Math.min(s, adjust.maxSaturation);
  let l = adjust.lightness ?? base.l * (adjust.lightnessScale ?? 1);
  if (adjust.minLightness !== undefined) l = Math.max(l, adjust.minLightness);
  if (adjust.maxLightness !== undefined) l = Math.min(l, adjust.maxLightness);
  return { h, s: clamp01(s), l: clamp01(l) };
}

/** 派生并序列化：`hslCss('#3b82f6', { saturationScale: 0.12, lightness: 0.96 })`。 */
export function hslCss(source: ColorSource, adjust: HslAdjust = {}, alpha?: number, lookup?: VarLookup): string | undefined {
  const hsl = adjustHsl(source, adjust, lookup);
  return hsl ? formatHsl(hsl, alpha) : undefined;
}

// --- 度量 ---

function toLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function toEncoded(channel: number): number {
  const value = clamp01(channel);
  return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

/** WCAG 相对亮度（0~1）。 */
export function relativeLuminance(color: Rgba): number {
  return 0.2126 * toLinear(clamp01(color.r)) + 0.7152 * toLinear(clamp01(color.g)) + 0.0722 * toLinear(clamp01(color.b));
}

/** WCAG 对比度（1~21）；任一侧不可解析时返回 0（视作最差）。 */
export function contrastRatio(a: ColorSource, b: ColorSource, lookup?: VarLookup): number {
  const fg = toRgba(a, lookup);
  const bg = toRgba(b, lookup);
  if (!fg || !bg) return 0;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// --- 判定契约 ---

/** 契约 1：该色作为主题面时是否算「底亮」（HSL 明度）。 */
export function themeSurfaceIsLight(source: ColorSource, lookup?: VarLookup): boolean {
  const hsl = toHsl(source, lookup);
  return hsl ? hsl.l > THEME_LIGHTNESS_THRESHOLD : false;
}

/**
 * 契约 1 的输出：主题面（气泡/色块）上的文字色。
 * 底亮 → 按色相微染的深字；底暗 → 白字。
 */
export function themeSurfaceInk(source: ColorSource, lookup?: VarLookup): string {
  const hsl = toHsl(source, lookup);
  if (!hsl || hsl.l <= THEME_LIGHTNESS_THRESHOLD) return INK_ON_DARK;
  return hslCss(hsl, { saturationScale: 0.12, minSaturation: 0.06, lightness: 0.16 }) ?? INK_ON_DARK;
}

/**
 * 契约 2：该背景上的文字色。
 * 底暗 → 白，底亮 → 深；不可解析时按亮底处理（浅底深字比深底黑字安全）。
 */
export function readableOnColor(source: ColorSource, lookup?: VarLookup): string {
  const color = toRgba(source, lookup);
  if (!color) return INK_ON_LIGHT;
  return relativeLuminance(color) > TEXT_ON_LIGHT_THRESHOLD ? INK_ON_LIGHT : INK_ON_DARK;
}

// --- 混合与叠加（W3C compositing） ---

/** 色标/多层均值：先解码到线性光空间求算术均值，再回编码（光学混合近似）。 */
export function mixLinear(colors: readonly Rgba[]): Rgba {
  const total = colors.reduce((acc, color) => ({
    r: acc.r + toLinear(clamp01(color.r)),
    g: acc.g + toLinear(clamp01(color.g)),
    b: acc.b + toLinear(clamp01(color.b)),
    a: acc.a + clamp01(color.a),
  }), { r: 0, g: 0, b: 0, a: 0 });
  const count = colors.length;
  return {
    r: toEncoded(total.r / count),
    g: toEncoded(total.g / count),
    b: toEncoded(total.b / count),
    a: clamp01(total.a / count),
  };
}

type BlendFunction = (backdrop: number, source: number) => number;

const BLEND_FUNCTIONS: Record<string, BlendFunction> = {
  normal: (_b, s) => s,
  multiply: (b, s) => b * s,
  screen: (b, s) => b + s - b * s,
  overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  darken: (b, s) => Math.min(b, s),
  lighten: (b, s) => Math.max(b, s),
  'color-dodge': (b, s) => (b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s))),
  'color-burn': (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)),
  'hard-light': (b, s) => (s <= 0.5 ? 2 * s * b : 1 - 2 * (1 - s) * (1 - b)),
  'soft-light': (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  },
};

function blendFunction(name: string | undefined): BlendFunction {
  return (name && BLEND_FUNCTIONS[name]) || BLEND_FUNCTIONS['normal']!;
}

/** source-over 合成一层（W3C：Cs' = (1-ab)Cs + ab·B(Cb,Cs)，再按 alpha 归一）。 */
export function compositeLayer(backdrop: Rgba, source: Rgba, opacity = 1, blendName?: string): Rgba {
  const as = clamp01(source.a * opacity);
  const ab = clamp01(backdrop.a);
  const ao = as + ab * (1 - as);
  if (ao <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const blend = blendFunction(blendName);
  const channel = (cb: number, cs: number): number => {
    const mixed = (1 - ab) * cs + ab * blend(cb, cs);
    return clamp01((as * mixed + (1 - as) * ab * cb) / ao);
  };
  return {
    r: channel(backdrop.r, source.r),
    g: channel(backdrop.g, source.g),
    b: channel(backdrop.b, source.b),
    a: ao,
  };
}

// --- CSS 背景值 → 单层代表色 ---

/** 渐变层代表色：解析全部可解析色标后取光空间均值；角度/位置参数忽略。 */
function gradientColor(value: string, lookup?: VarLookup): Rgba | undefined {
  const body = functionBody(value);
  if (body === undefined) return undefined;
  const stops = splitTopLevel(body, ',')
    .map(part => parseColor(leadingToken(part.trim()), lookup))
    .filter((color): color is Rgba => color !== undefined && color.a > 0);
  return stops.length > 0 ? mixLinear(stops) : undefined;
}

/**
 * 一个 CSS 背景值的代表色：
 * 纯色 → 该色；渐变 → 色标光空间均值；url()/不可解析值 → undefined（视作透明跳过）。
 * 无 lookup 时含 var() 的值视为「未知」而非「未定义」，整层跳过：退到兜底字面量会判反。
 */
export function representativeColorOf(value: string, lookup?: VarLookup): Rgba | undefined {
  const text = value?.trim() ?? '';
  if (!text || /^url\(/i.test(text)) return undefined;
  if (!lookup && /var\(/i.test(text)) return undefined;
  if (/gradient\(/i.test(text)) return gradientColor(text, lookup);
  return parseColor(text, lookup);
}
