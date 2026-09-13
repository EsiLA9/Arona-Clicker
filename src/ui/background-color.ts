// ============================================================
// ui/background-color.ts — 背景图层「合成代表色」服务
//
// 色彩数学（解析 / 序列化 / 亮度 / 混合 / 叠加）全部来自 engine/core/color；
// 本模块只负责「把 BackgroundLayerDef 栈折叠成一个代表色并惰性记忆」。
//
// 折叠规则：
//   1. 每层代表色：见 representativeColorOf（纯色取自身，渐变取色标光空间均值，
//      url()/不可解析值视作透明跳过，含 var() 且无作用域变量表时同样跳过）。
//   2. 叠加：W3C compositing（source-over + 可分离混合模式），自底向上。
//   3. 判定：对合成结果调用 readableOnColor（WCAG + TEXT_ON_LIGHT_THRESHOLD），
//      与 --ink-on-* 共用同一契约。
//
// 已知近似（有意为之）：不建模渐变方向/几何与 position/size/scale/rotation；
// 渐变按色标等权；容器自身 CSS 透明度需由调用方用 base 表达。
// ============================================================

import {
  INK_ON_DARK,
  INK_ON_LIGHT,
  TEXT_ON_LIGHT_THRESHOLD,
  compositeLayer,
  relativeLuminance,
  representativeColorOf,
  toHex,
  toRgba,
  type Rgba,
  type VarLookup,
} from '../engine/core/color';

/** 参与合成的图层最小输入（BackgroundViewLayer 结构兼容）。 */
export interface ColorLayerInput {
  id?: string;
  value: string;
  opacity?: number;
  blendMode?: string;
  enabled?: boolean;
}

export interface BackgroundInkOptions {
  /**
   * 该渲染作用域的变量表（themeVarLookup 产物）。**必须与 DOM 实际生效的变量同源**：
   * var() 的取值取决于作用域，用别处的 token 反推会判出与渲染相反的文字色。
   * 不确定时不要传——服务会跳过含 var() 的图层，而不是猜一个颜色。
   */
  lookup?: VarLookup;
  /** 图层之下的基底：宿主背景叠在全局背景之上时传入下层合成结果。 */
  base?: Rgba | string | null;
  /** 需要从合成中排除的层 id（与渲染端 systemColorLayerIgnored 行为对齐）。 */
  ignoreLayerIds?: readonly string[];
}

export interface BackgroundInk {
  /** 合成后的代表色（#rrggbb；半透明时 alpha 另见下方字段）。 */
  color: string;
  /** 代表色的合成 alpha（0~1）：<1 表示其下仍有未知底层。 */
  alpha: number;
  /** 代表色的 WCAG 相对亮度（0~1）。 */
  luminance: number;
  /** true = 底亮，其上应用深色文字。 */
  light: boolean;
  /** 该背景上应使用的文字色。 */
  text: string;
  /** 供 data-theme-text-mode 消费的取值：底暗 → 'light'（白字），底亮 → 'dark'。 */
  textColorMode: 'light' | 'dark';
  /** 参与合成的图层数（0 表示仅由 base 决定）。 */
  layers: number;
}

/** 单层代表色：纯色/渐变按框架解析，图片与不可解析值返回 undefined。 */
export function layerColorOf(layer: ColorLayerInput, lookup?: VarLookup): Rgba | undefined {
  return representativeColorOf(layer.value ?? '', lookup);
}

/** 纯函数：把图层栈折叠为合成代表色并给出文字色判定；无可解析图层时返回 null。 */
export function compositeBackgroundInk(
  layers: readonly ColorLayerInput[],
  options: BackgroundInkOptions = {},
): BackgroundInk | null {
  const ignore = options.ignoreLayerIds && options.ignoreLayerIds.length > 0 ? new Set(options.ignoreLayerIds) : undefined;
  let current: Rgba = (options.base ? toRgba(options.base) : undefined) ?? { r: 0, g: 0, b: 0, a: 0 };
  let used = 0;
  for (const layer of layers) {
    if (layer.enabled === false) continue;
    if (ignore && layer.id !== undefined && ignore.has(layer.id)) continue;
    const color = layerColorOf(layer, options.lookup);
    if (!color) continue;
    current = compositeLayer(current, color, layer.opacity ?? 1, layer.blendMode);
    used++;
  }
  if (current.a <= 0.001) return null;
  const luminance = relativeLuminance(current);
  const light = luminance > TEXT_ON_LIGHT_THRESHOLD;
  return {
    color: toHex(current),
    alpha: current.a,
    luminance,
    light,
    text: light ? INK_ON_LIGHT : INK_ON_DARK,
    textColorMode: light ? 'dark' : 'light',
    layers: used,
  };
}

function signatureOf(layers: readonly ColorLayerInput[], options: BackgroundInkOptions): string {
  const lookup = options.lookup;
  const lookupKey = lookup
    ? Object.keys(lookup).sort().map(key => `${key}=${lookup[key] ?? ''}`).join(';')
    : '';
  const base = typeof options.base === 'string' ? options.base : options.base ? toHex(options.base) + '@' + options.base.a.toFixed(3) : '';
  const ignore = options.ignoreLayerIds?.join(',') ?? '';
  return JSON.stringify([
    layers.map(layer => [layer.id ?? '', layer.value, layer.opacity ?? null, layer.blendMode ?? null, layer.enabled !== false]),
    lookupKey,
    base,
    ignore,
  ]);
}

/**
 * 惰性记忆的合成色服务。
 * 结果按「图层内容 + 变量表 + 基底」签名缓存：同一背景栈跨帧复用同一次计算，
 * 内容变化才重算（背景视图每次 render 都会重建对象，故不能用对象身份作键）。
 */
export class BackgroundInkService {
  private readonly cache = new Map<string, BackgroundInk | null>();

  constructor(private readonly capacity = 96) {}

  /** 命中即返回；未命中才做合成计算并写入缓存（含 null 的负缓存）。 */
  ink(layers: readonly ColorLayerInput[], options: BackgroundInkOptions = {}): BackgroundInk | null {
    const key = signatureOf(layers, options);
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      // 命中后移到队尾，使淘汰近似 LRU
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const value = compositeBackgroundInk(layers, options);
    this.cache.set(key, value);
    while (this.cache.size > Math.max(1, this.capacity)) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return value;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/** 全局共享实例：背景合成色只在被读取时求值。 */
export const backgroundInkService = new BackgroundInkService();

/**
 * 主题 token / palette → CSS 变量查找表。
 *
 * `vars` 是**该渲染作用域实际写入 DOM 的变量表**（buildThemeTree / applyTheme 的产物，
 * 含 --theme-node-* / --ac-* / 兼容别名）。它是 var() 求值的唯一可信来源：
 * 这些变量会按「节点覆盖 → UI 作用域覆盖 → 局部 ThemeTree」逐级改写，
 * 用 token 反推只能在 :root 且无覆盖时成立——否则会判出与渲染相反的文字色
 * （例：选择页顶栏用聚焦 Init 投影出的深色主题画深底，却拿游戏页运行时 token 判成亮底）。
 *
 * 因此：调用方拿不到作用域变量表时应传 undefined，让服务跳过全部 var() 图层。
 * 未登记者同样按不可解析处理。token/palette 推导值只补充不随作用域变化的变量。
 */
export function themeVarLookup(
  tokens: Readonly<Record<string, string>> | undefined,
  palette: readonly string[] = [],
  vars?: Readonly<Record<string, string | undefined>>,
): VarLookup {
  const token = (name: string): string | undefined => {
    const value = tokens?.[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  const paletteAt = (index: number): string | undefined => {
    const value = palette[index] ?? palette[0] ?? token('primary');
    return value && value.trim() ? value.trim() : undefined;
  };
  const scoped = (name: string): string | undefined => {
    const value = vars?.[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  const lookup: Record<string, string | undefined> = {
    '--bg': token('bg'),
    '--canvas': token('bg'),
    '--bg-alt': token('bgAlt'),
    '--panel': token('panel'),
    '--panel-light': token('bgAlt'),
    '--primary': token('primary'),
    '--cyan': token('primary'),
    '--accent': token('accent') ?? token('primary'),
    '--ac-primary': token('primary'),
    '--player-bubble': token('playerBubble'),
    '--npc-bubble': token('npcBubble'),
    '--theme-node-bg': token('bg'),
    '--theme-node-bg-alt': token('bgAlt'),
    '--theme-node-panel': token('panel'),
    '--theme-node-panel-light': token('bgAlt'),
    '--theme-node-primary': token('primary'),
    '--theme-node-accent': token('accent') ?? token('primary'),
    '--theme-node-player-bubble': token('playerBubble'),
    '--theme-node-npc-bubble': token('npcBubble'),
    // applyTheme 的语义别名：--ui-button-bg 在 DOM 中即 var(--theme-node-panel-light)，
    // 按使用它的元素自身作用域求值。
    '--ui-button-bg': token('bgAlt'),
  };
  for (let index = 0; index < 6; index++) {
    const value = paletteAt(index);
    if (value) lookup[`--theme-palette-${index + 1}`] = value;
  }
  if (!vars) return lookup;
  // 作用域变量表（唯一可信来源）覆盖全部近似值；忽略非 -- 前缀键（ThemeTree 里的解包语义键）
  const scopedUiButton = scoped('--ui-button-bg') ?? scoped('--theme-node-panel-light');
  if (scopedUiButton) lookup['--ui-button-bg'] = scopedUiButton;
  for (const [name, value] of Object.entries(vars)) {
    if (!name.startsWith('--')) continue;
    if (typeof value === 'string' && value.trim()) lookup[name] = value.trim();
  }
  return lookup;
}
