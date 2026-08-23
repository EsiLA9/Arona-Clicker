// ============================================================
// engine/color-system.ts — 色彩系统（库存查询/解锁编排/HSL 主题派生）
//
// 主题派生规则：至少配 primary；其余 token 按 HSL 深/浅确定性派生，
// 显式配置覆盖派生值；派生前景/背景对对比度不足时自动翻转深浅。
// ============================================================

import type {
  ColorDef,
  Condition,
  ConditionGroup,
  Effect,
  PlayerState,
} from './types';
import type { Registry } from './registry';
import type { StateMutationService } from './state-mutation-service';
import { RuntimeThemeManager, type ThemeLayer } from './theme-runtime';

// --- HSL 工具（纯函数，UI 可复用） ---

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 220, s: 0.8, l: 0.55 };
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslCss(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

/** hex → "r,g,b" 三元组，供 rgba(var(--ac-primary-rgb), a) 形式消费。 */
export function hexToRgbTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '59,158,255';
  const int = parseInt(m[1], 16);
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

/** WCAG 相对亮度。 */
function luminance(cssColor: string): number {
  const hsl = typeof cssColor === 'string' && cssColor.startsWith('#')
    ? hexToHsl(cssColor)
    : parseHslCss(cssColor);
  // 简化亮度模型：明度主导 + 少量饱和度修正（派生用途足够）
  return 0.2126 * chan(hsl) + 0.7152 * chan({ ...hsl, l: Math.min(1, hsl.l + 0.02 * hsl.s) }) + 0.0722 * chan(hsl);
}

function chan({ s, l }: { s: number; l: number }): number {
  return l < 0.03928 ? l / 12.92 : Math.pow((l + 0.055) / 1.055, 2.4) * (1 - 0.3 * s);
}

function parseHslCss(css: string): { h: number; s: number; l: number } {
  const m = /hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/.exec(css);
  if (!m) return { h: 0, s: 0, l: 0.5 };
  return { h: Number(m[1]) / 360, s: Number(m[2]) / 100, l: Number(m[3]) / 100 };
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const MIN_CONTRAST = 4.5;

/**
 * 深浅判定的统一明度阈值（0.38）。
 * 引擎层（deriveThemeTokens / readableOn）与 UI 层（theme-tree 的 --ink-on-*）
 * 必须共用此值，避免边界色在两层判定不一致。
 * 以 HSL 明度为感知亮度模型：仅配 primary 的主题（夏莱蓝 #3b82f6、晴空 #38bdf8、
 * 泳装 #3ec6e0、青柠 #a3e635、翡翠 #10b981、青碧 #14b8a6、绯红 #e11d48、
 * 阿比多斯黄沙 #eab308 等）明度均高于此线，自动派生为浅底而非近黑；
 * 仅真正深色（如墨蓝 #1e3a5f 等）保持深底。
 */
export const LIGHTNESS_THRESHOLD = 0.38;

/** 由底色推导其上的可读文字色：底亮→深字，底暗→浅字。确定性。 */
function readableOn(h: number, s: number, l: number): string {
  return l > LIGHTNESS_THRESHOLD ? hslCss(h, Math.max(s * 0.12, 0.06), 0.16) : '#ffffff';
}

/**
 * 由 primary 派生整套 UI token（确定性：同输入同输出）。
 * 浅色判定：primary 明度 > LIGHTNESS_THRESHOLD → 浅底深字；否则深底浅字。
 * 背景 bg→bgAlt 取主色到邻近色的轻微渐变（bgAlt 色相偏移 +12）。
 * 聊天气泡左(NPC)/右(Player)底色不同且各带派生文字色，确保对比清晰。
 */
export function deriveThemeTokens(primary: string): Record<string, string> {
  const { h, s, l } = hexToHsl(primary);
  const light = l > LIGHTNESS_THRESHOLD;
  const playerBg = primary;
  const playerText = readableOn(h, s, l);
  const npcBg = hslCss(h, Math.max(s * 0.5, 0.14), light ? 0.34 : 0.26);
  const npcText = readableOn(h, Math.max(s * 0.5, 0.14), light ? 0.34 : 0.26);
  return {
    primary,
    primaryDim: hslCss(h, s * 0.7, light ? l * 0.85 : Math.min(1, l * 1.15)),
    bg: hslCss(h, s * 0.12, light ? 0.96 : 0.12),
    bgAlt: hslCss((h + 12) % 360, s * 0.15, light ? 0.90 : 0.17),
    text: hslCss(h, s * 0.08, light ? 0.15 : 0.92),
    textDim: hslCss(h, s * 0.08, light ? 0.40 : 0.65),
    border: hslCss(h, s * 0.20, light ? 0.82 : 0.28),
    accent: primary,
    playerBubble: playerBg,
    playerBubbleText: playerText,
    npcBubble: npcBg,
    npcBubbleText: npcText,
  };
}

/**
 * 解析色彩的最终 token 表：
 * 显式 theme 全量覆盖 > primary 派生 > 默认 primary。
 * CT-04 对比度防呆：text/bg 对不足阈值时翻转 text 深浅。
 */
export function resolveTheme(def: Pick<ColorDef, 'theme'>): Record<string, string> {
  const primary = def.theme['primary'] ?? '#4a7dff';
  const tokens = { ...deriveThemeTokens(primary), ...def.theme };
  const fg = tokens['text'];
  const bg = tokens['bg'];
  if (fg && bg && contrastRatio(fg, bg) < MIN_CONTRAST) {
    const bgL = hexToHsl(bg.startsWith('#') ? bg : '#808080').l;
    const flipped = bgL > LIGHTNESS_THRESHOLD ? 'hsl(0 8% 10%)' : 'hsl(0 0% 94%)';
    if (contrastRatio(flipped, bg) > contrastRatio(fg, bg)) tokens['text'] = flipped;
  }
  return tokens;
}

// --- 服务 ---

export class ColorSystem {
  /** 运行时主题管理：Color 与游戏实际结构解耦，多 Color/临时演出的叠加入口。 */
  readonly runtime: RuntimeThemeManager;

  constructor(
    private readonly registry: Registry,
    private readonly mutations: StateMutationService,
    private readonly getState: () => PlayerState,
    private readonly checkCondition: (expr: Condition | ConditionGroup, state: PlayerState) => boolean,
  ) {
    // 层→token 表解析：引用 ColorId 时取其整包 resolveTheme，否则空表；tokens 覆盖在此层合并
    this.runtime = new RuntimeThemeManager(layer => {
      const tokens: Record<string, string> = {};
      if (layer.colorId) {
        const def = this.registry.colors.get(layer.colorId);
        if (def) Object.assign(tokens, resolveTheme(def));
      }
      if (layer.tokens) Object.assign(tokens, layer.tokens);
      return tokens;
    });
  }

  // --- 运行时主题（RuntimeThemeManager 门面） ---

  /** 从状态同步玩家全局主题层（activeColor → player 层；读档/激活主题后调用）。 */
  syncPlayerThemeFromState(state: PlayerState): void {
    const id = state.activeColor ?? null;
    this.runtime.setPlayer(id ? { scope: 'player', colorId: id } : null);
  }

  /** 压入场景特色层（当前 Area / 当前对话学生；同 scope 覆盖）。 */
  pushSceneTheme(layer: ThemeLayer): void {
    this.runtime.pushScene(layer);
  }

  /** 弹出场景层（按 scope 弹出；缺省弹出最近一个）。 */
  popSceneTheme(scope?: ThemeLayer['scope']): void {
    this.runtime.popScene(scope);
  }

  /** 推入临时演出层，返回其 id（供 popEphemeralTheme 移除）。 */
  pushEphemeralTheme(layer: ThemeLayer): string {
    return this.runtime.pushEphemeral(layer);
  }

  /** 移除临时演出层（不存在则静默忽略）。 */
  popEphemeralTheme(id: string): void {
    this.runtime.popEphemeral(id);
  }

  /** 清空全部运行时层（新会话/读档）。 */
  resetRuntimeThemes(): void {
    this.runtime.reset();
  }

  /** 当前运行时主题（L1 临时 > L2 场景 > L3 玩家）合并后的最终结果。 */
  runtimeTheme(): ReturnType<RuntimeThemeManager['resolve']> {
    return this.runtime.resolve();
  }

  /** 当前运行时主题合并后的最终 token 表。 */
  runtimeThemeTokens(): Record<string, string> {
    return this.runtimeTheme().tokens;
  }

  /**
   * 处理临时演出类 theme effect（setTheme op）。
   * 由 effect-engine 在 applyEffects 时转发（mutations 对 setTheme 保持 no-op）。
   * @returns 是否已消费（op 属于主题类）。
   */
  /** 剧情演出临时层的固定槽位：同一剧情内的 setTheme 覆盖式更新，离开剧情即清除。 */
  static readonly STORY_EPHEMERAL_ID = 'story-ephemeral';

  handleThemeEffect(effect: Effect): boolean {
    if (effect.op !== 'setTheme') return false;
    const value = effect.value as import('./types/expression').ThemeEffectValue;
    this.pushEphemeralTheme({
      id: ColorSystem.STORY_EPHEMERAL_ID,
      scope: 'ephemeral',
      colorId: value?.colorId,
      tokens: value?.tokens,
    });
    return true;
  }

  /** 清除剧情临时演出层（剧情结束后调用）。 */
  clearStoryTheme(): void {
    this.runtime.popEphemeral(ColorSystem.STORY_EPHEMERAL_ID);
  }

  getDef(colorId: string): ColorDef | undefined {
    return this.registry.colors.get(colorId);
  }

  getAll(): ColorDef[] {
    return [...this.registry.colors.values()];
  }

  isOwned(state: PlayerState, colorId: string): boolean {
    return state.colorsOwned?.includes(colorId) ?? false;
  }

  ownedColors(state: PlayerState): ColorDef[] {
    return (state.colorsOwned ?? [])
      .map(id => this.registry.colors.get(id))
      .filter((d): d is ColorDef => !!d);
  }

  /**
   * 尝试解锁色彩（条件编排在此，写经 mutations.unlockColor）。
   * @returns 'unlocked' 成功 | 'already' 幂等 | false 条件不满足或定义缺失
   */
  tryUnlock(colorId: string): 'unlocked' | 'already' | false {
    const def = this.getDef(colorId);
    if (!def) return false;
    const state = this.getState();
    if (this.isOwned(state, colorId)) return 'already';
    if (def.unlock && !this.checkCondition(def.unlock, state)) return false;
    return this.mutations.unlockColor(colorId) ? 'unlocked' : 'already';
  }

  /**
   * 扫描所有已定义色彩，对尚未拥有且条件已满足者执行 tryUnlock。
   * 仅覆盖带 unlock 条件的色彩（缺省无 unlock = 不可自动解锁，见 ColorDef 约定）。
   * 挂在 characterAcquired / 进入世界线等时机，使"达成条件即自动解锁"闭环。
   * @returns 本次新解锁的色彩 id 列表（空数组 = 无变化）。
   */
  recheckUnlocks(): string[] {
    const newly: string[] = [];
    for (const def of this.getAll()) {
      if (!def.unlock) continue;
      if (this.tryUnlock(def.id) === 'unlocked') newly.push(def.id);
    }
    return newly;
  }

  /** 变体已装备色彩的聚合效果声明（消费方按现有 Effect 语义求值）。 */
  effectsOf(state: PlayerState, variantId: string): Effect[] {
    const entry = state.roster?.[variantId];
    if (!entry) return [];
    const out: Effect[] = [];
    for (const colorId of entry.equippedColors) {
      const def = this.registry.colors.get(colorId);
      if (def?.effects) out.push(...def.effects);
    }
    return out;
  }

  /** 当前激活主题的最终 token 表（activeColor 为 null 或未知 → null，UI 用默认主题）。 */
  activeThemeTokens(state: PlayerState): Record<string, string> | null {
    const id = state.activeColor;
    if (!id) return null;
    const def = this.getDef(id);
    if (!def || !this.isOwned(state, id)) return null;
    return resolveTheme(def);
  }

  /**
   * 图鉴用：拆解出色彩每个 token 的取值与来源。
   * - 来源 'defined'  = 作者显式写在 ColorDef.theme 中的定义值
   * - 来源 'derived'  = 引擎由 primary 经 HSL 规则确定性派生的自动构造值
   * autoConstructed：整套主题仅配 primary、其余全部靠派生 → 视为「自动构造」；
   * 反之作者显式补充了至少一个非 primary token → 「已被定义」。
   * 返回顺序按 token 稳定性：primary 优先，其余按解析结果键序。
   */
  describeColor(def: ColorDef): {
    autoConstructed: boolean;
    tokens: { key: string; value: string; source: 'defined' | 'derived' }[];
  } {
    const definedKeys = new Set(Object.keys(def.theme));
    const resolved = resolveTheme(def);
    const autoConstructed = [...definedKeys].every(k => k === 'primary');
    const ordered = ['primary', ...Object.keys(resolved).filter(k => k !== 'primary')];
    return {
      autoConstructed,
      tokens: ordered.map(key => ({
        key,
        value: resolved[key],
        source: definedKeys.has(key) ? 'defined' : 'derived',
      })),
    };
  }
}
