// ============================================================
// engine/color-system.ts — 色彩系统（库存查询/解锁编排/HSL 主题派生）
//
// 主题派生规则：至少配 primary；其余 token 按 HSL 深/浅确定性派生，
// 显式配置覆盖派生值；派生前景/背景对对比度不足时自动翻转深浅。
// ============================================================

import type {
  ColorDef,
  ColorGroupDef,
  ColorGroupId,
  ColorId,
  Condition,
  ConditionGroup,
  Effect,
  PlayerState,
  ThemeDef,
  ThemeDesignDef,
} from '../types';
import type { Registry } from '../registry/registry';
import type { StateMutationService } from './state-mutation-service';
import { RuntimeThemeManager, type ThemeLayer, type ThemeTokens } from '../core/theme-runtime';

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

/** 实体键：`area:<id>` / `variant:<id>`（主题槽 / 配色设计归属的键）。 */
export function entityKeyOf(kind: 'area' | 'variant', id: string): string {
  return `${kind}:${id}`;
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

/** 实体主题槽的 UI 选项视图。 */
export interface EntityThemeOption {
  kind: 'default' | 'equipment' | 'design' | 'custom';
  id?: string;
  name: string;
  theme?: ThemeDef;
  swatch?: string;
  owned: boolean;
  active: boolean;
}

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
    panel: '#ffffff',
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

// ============================================================================
// Color / ColorGroup → theme-tree 快速映射（token 贡献）
//
// 每个实体（角色对话 / Area / Spot / Talklet·Story / 自定义主题）都可把自身
// 解析为一组 token 贡献，填入全局参考 theme-tree（见 theme-runtime 分层合并）。
// Color 直接用其 theme；ColorGroup 取其 primary role slot（回退首个）的 Color。
// ============================================================================

/** Color → 整包 token 贡献（即 resolveTheme）。 */
export function themeContributionFromColor(def: ColorDef): ThemeTokens {
  return resolveTheme(def);
}

/**
 * ColorGroup → token 贡献：取主色位（role==='primary'，无则首个 slot）引用的 Color，
 * 解析其整包 theme。无主色位 / 主色未定义时返回空表（不污染参考树）。
 */
export function themeContributionFromGroup(
  group: ColorGroupDef,
  getColor: (id: ColorId) => ColorDef | undefined,
): ThemeTokens {
  const slot = group.slots.find(s => s.role === 'primary') ?? group.slots[0];
  const base: ThemeTokens = {};
  if (slot) {
    const color = getColor(slot.colorId);
    if (color) Object.assign(base, resolveTheme(color));
  }
  // 组自身声明的部分节点覆盖（panel / playerBubble 等），叠加在主色位 Color 之上
  if (group.theme) Object.assign(base, group.theme);
  return base;
}

/**
 * ThemeDef（声明式主题：引用 Color 打底 + 局部覆盖）→ token 贡献。
 * 供 Area / 学生对话 / Spot / 自定义主题统一复用同一条解析路径。
 */
export function themeContributionFromThemeDef(
  theme: ThemeDef | undefined,
  getColor: (id: ColorId) => ColorDef | undefined,
): ThemeTokens {
  if (!theme) return {};
  const tokens: ThemeTokens = {};
  if (theme.colorId) {
    const color = getColor(theme.colorId);
    if (color) Object.assign(tokens, resolveTheme(color));
  }
  if (theme.tokens) Object.assign(tokens, theme.tokens);
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

  /** 从状态同步玩家全局主题层：自定义主题优先，否则 activeColor（读档/激活主题后调用）。 */
  syncPlayerThemeFromState(state: PlayerState): void {
    if (state.customTheme) {
      this.runtime.setPlayer({
        scope: 'player',
        colorId: state.customTheme.colorId,
        tokens: state.customTheme.tokens,
      });
    } else {
      const id = state.activeColor ?? null;
      this.runtime.setPlayer(id ? { scope: 'player', colorId: id } : null);
    }
    this.runtime.setLayerOrder(state.themeLayerOrder);
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

  /** 某 scope 当前生效层（忽略临时演出层）解析出的 token 表；无该层返回空表。 */
  scopeThemeTokens(scope: ThemeLayer['scope']): ThemeTokens {
    return this.runtime.resolveScope(scope);
  }

  /**
   * 处理临时演出类 theme effect（setTheme op）。
   * 由 effect-engine 在 applyEffects 时转发（mutations 对 setTheme 保持 no-op）。
   * scope=area/student 时改写实体主题槽（持久，玩家可改回）；否则推临时演出层。
   * @returns 是否已消费（op 属于主题类）。
   */
  /** 剧情演出临时层的固定槽位：同一剧情内的 setTheme 覆盖式更新，离开剧情即清除。 */
  static readonly STORY_EPHEMERAL_ID = 'story-ephemeral';

  handleThemeEffect(effect: Effect): boolean {
    if (effect.op !== 'setTheme') return false;
    const value = effect.value as import('../types/expression').ThemeEffectValue;
    if (value?.scope === 'area' || value?.scope === 'student') {
      if (!value.entityKey) return false;
      // 剧情/Trigger 直接改写实体主题槽（自定义来源，持久至玩家改回）
      this.mutations.setEntityThemeSlot(value.entityKey, {
        kind: 'custom',
        customTheme: { colorId: value.colorId, tokens: value.tokens },
      });
      return true;
    }
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

  /** 取 ColorGroup 定义（供 UI 快速映射）。 */
  getGroup(groupId: ColorGroupId): ColorGroupDef | undefined {
    return this.registry.colorGroups.get(groupId);
  }

  // --- theme-tree 快速映射（封装 registry 解析） ---

  /** Color → 整包 token 贡献。 */
  themeFromColor(colorId: ColorId): ThemeTokens {
    const def = this.registry.colors.get(colorId);
    return def ? resolveTheme(def) : {};
  }

  /** ColorGroup → token 贡献（主色位 Color）。 */
  themeFromGroup(groupId: ColorGroupId): ThemeTokens {
    const group = this.registry.colorGroups.get(groupId);
    return group ? themeContributionFromGroup(group, id => this.registry.colors.get(id)) : {};
  }

  /** ThemeDef → token 贡献（统一解析路径）。 */
  themeFromThemeDef(theme: ThemeDef | undefined): ThemeTokens {
    return themeContributionFromThemeDef(theme, id => this.registry.colors.get(id));
  }

  // --- 实体主题槽（Area / 学生差分的多来源配色） ---

  /** 设计 → 主题定义。 */
  designTheme(designId: string): ThemeDef | undefined {
    return this.registry.themeDesigns.get(designId)?.theme;
  }

  /** 某实体已解锁的设计（按获得顺序）。 */
  ownedDesigns(state: PlayerState, entityKey: string): ThemeDesignDef[] {
    return (state.entityThemeDesignsOwned?.[entityKey] ?? [])
      .map(id => this.registry.themeDesigns.get(id))
      .filter((d): d is ThemeDesignDef => !!d);
  }

  /** 设计是否已解锁。 */
  isDesignOwned(state: PlayerState, entityKey: string, designId: string): boolean {
    return state.entityThemeDesignsOwned?.[entityKey]?.includes(designId) ?? false;
  }

  /** 由 ThemeDef 取预览主色（colorId → Color.primary；否则 tokens.primary）。 */
  themeSwatchColor(theme: ThemeDef): string | undefined {
    if (theme.colorId) {
      const primary = this.registry.colors.get(theme.colorId)?.theme['primary'];
      if (primary) return primary;
    }
    return theme.tokens?.['primary'];
  }

  /**
   * 解析实体当前生效的主题槽覆盖（ThemeDef | null）。
   * null = 无覆盖，调用方走声明默认（Area.theme / Variant.theme / 色组回退）。
   * equipment 来源跟随「当前已装备」的装备（kind 即「跟随装备」语义）。
   */
  entityThemeOverride(
    state: PlayerState,
    entityKey: string,
    equippedEquipmentId?: string | null,
  ): ThemeDef | null {
    const slot = state.entityThemeSlots?.[entityKey];
    if (!slot || slot.kind === 'default') return null;
    if (slot.kind === 'custom') return slot.customTheme ?? null;
    if (slot.kind === 'design') {
      if (!slot.designId || !this.isDesignOwned(state, entityKey, slot.designId)) return null;
      return this.registry.themeDesigns.get(slot.designId)?.theme ?? null;
    }
    if (!equippedEquipmentId) return null;
    const def = this.registry.colorEquipments.get(equippedEquipmentId);
    if (!def) return null;
    return def.theme ?? (def.themeColorId ? { colorId: def.themeColorId } : null);
  }

  /**
   * 实体的可用主题来源列表（UI 渲染用）：
   * 声明默认 → 当前装备主题 → 目标为该实体的设计（含未解锁，owned=false）→ 玩家自定义。
   */
  entityThemeOptions(
    state: PlayerState,
    entityKey: string,
    opts: { declaredTheme?: ThemeDef; equippedEquipmentId?: string | null },
  ): EntityThemeOption[] {
    const { declaredTheme, equippedEquipmentId } = opts;
    const slot = state.entityThemeSlots?.[entityKey];
    const options: EntityThemeOption[] = [];
    if (declaredTheme) {
      options.push({
        kind: 'default',
        name: '默认',
        theme: declaredTheme,
        swatch: this.themeSwatchColor(declaredTheme),
        owned: true,
        active: !slot || slot.kind === 'default',
      });
    }
    if (equippedEquipmentId) {
      const def = this.registry.colorEquipments.get(equippedEquipmentId);
      const theme = def?.theme ?? (def?.themeColorId ? { colorId: def.themeColorId } : undefined);
      if (def && theme) {
        options.push({
          kind: 'equipment',
          id: def.id,
          name: `装备 · ${def.name}`,
          theme,
          swatch: this.themeSwatchColor(theme),
          owned: true,
          active: slot?.kind === 'equipment',
        });
      }
    }
    const owned = state.entityThemeDesignsOwned?.[entityKey] ?? [];
    const designs = [...this.registry.themeDesigns.values()].filter(
      d => d.entityKey === entityKey || (!d.entityKey && owned.includes(d.id)),
    );
    for (const d of designs) {
      options.push({
        kind: 'design',
        id: d.id,
        name: d.name,
        theme: d.theme,
        swatch: this.themeSwatchColor(d.theme),
        owned: owned.includes(d.id),
        active: slot?.kind === 'design' && slot.designId === d.id,
      });
    }
    if (slot?.kind === 'custom' && slot.customTheme) {
      options.push({
        kind: 'custom',
        name: '自定义',
        theme: slot.customTheme,
        swatch: this.themeSwatchColor(slot.customTheme),
        owned: true,
        active: true,
      });
    }
    return options;
  }

  /**
   * 尝试解锁实体配色设计：条件校验 → 入库存 → 自动设为该实体当前生效主题。
   * @returns 'unlocked' 成功 | 'already' 幂等 | false 条件不满足或定义缺失
   */
  tryUnlockDesign(entityKey: string, designId: string): 'unlocked' | 'already' | false {
    const def = this.registry.themeDesigns.get(designId);
    if (!def) return false;
    const state = this.getState();
    if (this.isDesignOwned(state, entityKey, designId)) return 'already';
    if (def.unlock && !this.checkCondition(def.unlock, state)) return false;
    if (!this.mutations.unlockEntityDesign(entityKey, designId)) return 'already';
    // 获得即改默认：自动把该设计设为实体当前生效主题
    this.mutations.setEntityThemeSlot(entityKey, { kind: 'design', designId });
    return 'unlocked';
  }

  /**
   * 扫描全部带 unlock + entityKey 的配色设计，对尚未拥有且条件已满足者自动解锁。
   * 挂在 characterAcquired / flagChanged 时机（与 ColorEquipmentSystem.recheckUnlocks 同一闭环）。
   * @returns 本次新解锁的设计 id 列表（空数组 = 无变化）。
   */
  recheckDesignUnlocks(): string[] {
    const newly: string[] = [];
    for (const def of this.registry.themeDesigns.values()) {
      if (!def.unlock || !def.entityKey) continue;
      if (this.tryUnlockDesign(def.entityKey, def.id) === 'unlocked') newly.push(def.id);
    }
    return newly;
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

  /** 变体已装备色彩装备的聚合效果声明已迁移至 ColorEquipmentSystem.effectsOf（单装备槽按 equippedEquipment 聚合）。 */

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
