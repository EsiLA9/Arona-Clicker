// ============================================================
// ui/selector-theme.ts — Init / GlobalEnh 选择页主题只读投影
//
// 选择页的聚焦只是表现状态，不进入 RuntimeThemeManager 的场景栈。
// 本模块把实体主题、Init 快照阶段和当前 Area 合成为局部 ThemeTree /
// BackgroundView，供 selector-page 渲染与轻量过渡使用。
// ============================================================

import type { EnhancementDef } from '../data-services/contracts/enhancement';
import type { BackgroundLayerDef, ThemeDef, ThemeNodeName } from '../engine/types/theme';
import { SYSTEM_DEFAULT_PRIMARY } from '../engine/core/theme-defaults';
import { deriveThemeTokens, entityKeyOf, hexToRgbTriplet } from '../arona-clicker/services/color-system';
import { getEnhancementReveal } from './components/tooltip-reveal';
import { createUIContext, type UIContext } from './context';
import { buildBackgroundView, renderBackground, type BackgroundView } from './background-service';
import { buildThemeTree, themeTreeToInlineStyle, type ThemeTree } from './theme-tree';
import { buildPresentationView, type PresentationView } from './presentation-service';
import type { SelectionFace } from './components/global-enhancement-select';

export type SelectorVariantId = 'new' | 'active' | 'advanced' | 'completed' | 'warning' | 'locked' | 'available';

export interface SelectorBackgroundContext {
  sceneId: string;
  variantId: SelectorVariantId;
  face: SelectionFace;
  focusedEntityId: string | null;
  activeInitId: string | null;
  currentAreaId: string | null;
  transitionKey: string;
}

export interface SelectorThemeProjection {
  context: SelectorBackgroundContext;
  theme?: ThemeDef;
  tree: ThemeTree;
  inlineStyle: string;
  background: BackgroundView;
  /** 当前聚焦主题提供的顶栏宿主视图；没有声明时回退运行时顶栏表现。 */
  presentation: PresentationView;
}

const FALLBACK_PRIMARYS = [
  '#3b82f6', '#0ea5e9', '#6366f1', '#8b5cf6', '#db2777', '#e11d48',
  '#ea580c', '#ca8a04', '#059669', '#0f766e',
] as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 无声明主题时按实体 ID 稳定选取一个回退主色，不使用随机数。 */
export function selectorFallbackPrimary(face: SelectionFace, id: string | null): string {
  const seed = `${face}:${id ?? 'empty'}`;
  return FALLBACK_PRIMARYS[stableHash(seed) % FALLBACK_PRIMARYS.length];
}

function activeInitId(ctx: UIContext): string | null {
  const active = ctx.view.activeInit || ctx.game.state.activeInit;
  if (active) return active;
  const visited = ctx.game.state.visitedInits ?? [];
  for (let index = visited.length - 1; index >= 0; index -= 1) {
    if (ctx.world.inits.has(visited[index])) return visited[index];
  }
  return null;
}

/** 选择页无显式选中项时，优先恢复最近访问过的 Init。 */
export function preferredInitId(ctx: UIContext): string | null {
  return activeInitId(ctx);
}

function progressData(ctx: UIContext, initId: string): {
  visitedAreas: readonly string[];
  totalFrames: number;
  storyCount: number;
  spotLevels: Readonly<Record<string, number>>;
  currentAreaId: string | null;
} {
  const active = (ctx.view.activeInit || ctx.game.state.activeInit) === initId;
  const snapshot = ctx.game.state.initSnapshots?.[initId];
  if (active) {
    return {
      visitedAreas: ctx.view.visitedAreas,
      totalFrames: ctx.view.totalFrames,
      storyCount: ctx.view.storyLog.length,
      spotLevels: ctx.view.spotLevels,
      currentAreaId: ctx.view.currentAreaId,
    };
  }
  return {
    visitedAreas: snapshot?.visitedAreas ?? [],
    totalFrames: snapshot?.totalFrames ?? 0,
    storyCount: snapshot?.storyLog.length ?? 0,
    spotLevels: snapshot?.spotLevels ?? {},
    currentAreaId: snapshot?.currentAreaId ?? null,
  };
}

/** Init 的状态只按快照/当前运行快照离散化，避免随单个资源或 Tick 换色。 */
export function selectorInitVariant(ctx: UIContext, initId: string): Extract<SelectorVariantId, 'new' | 'active' | 'advanced' | 'completed' | 'warning'> {
  const entered = (ctx.game.state.visitedInits ?? []).includes(initId)
    || (ctx.view.activeInit || ctx.game.state.activeInit) === initId
    || !!ctx.game.state.initSnapshots?.[initId];
  if (!entered) return 'new';

  const data = progressData(ctx, initId);
  const areaIds = ctx.world.areasOfInit(initId);
  const spotIds = areaIds.flatMap(areaId => ctx.world.spotsOfArea(areaId));
  const allAreasVisited = areaIds.length > 0 && areaIds.every(areaId => data.visitedAreas.includes(areaId));
  const allSpotsMaxed = spotIds.length > 0 && spotIds.every(spotId => {
    const def = ctx.world.spots.get(spotId);
    return (data.spotLevels[spotId] ?? 0) >= (def?.maxLevel ?? 1);
  });
  if (allAreasVisited && allSpotsMaxed) return 'completed';

  // 选择页也可能从仍在播放剧情的游戏中打开；这是需要提醒玩家的离散状态。
  if ((ctx.view.activeInit || ctx.game.state.activeInit) === initId && ctx.view.currentStory) return 'warning';
  const advanced = data.totalFrames > 0
    || data.storyCount > 0
    || data.visitedAreas.length > 1
    || Object.values(data.spotLevels).some(level => level > 1);
  return advanced ? 'advanced' : 'active';
}

function selectorEnhancementVariant(ctx: UIContext, enhancement: EnhancementDef): Extract<SelectorVariantId, 'locked' | 'available' | 'active'> {
  const stage = getEnhancementReveal(ctx, enhancement).stage;
  if (stage === 'owned') return 'active';
  if (stage === 'purchaseable') return 'available';
  return 'locked';
}

function declaredTheme(ctx: UIContext, face: SelectionFace, id: string | null): { theme?: ThemeDef; kind: 'init' | 'enhancement' } {
  if (face === 'init') {
    const init = id ? ctx.world.inits.get(id) : undefined;
    return { theme: init?.theme, kind: 'init' };
  }
  const enhancement = id ? ctx.game.registry.enhancements.get(id) : undefined;
  return { theme: enhancement?.theme, kind: 'enhancement' };
}

function selectedTheme(ctx: UIContext, face: SelectionFace, id: string | null): { theme?: ThemeDef; kind: 'init' | 'enhancement' } {
  const declared = declaredTheme(ctx, face, id);
  if (!id) return declared;
  const override = ctx.game.colorSystem.entityThemeOverride(ctx.game.state, entityKeyOf(declared.kind, id));
  return { theme: override ?? declared.theme, kind: declared.kind };
}

function areaTheme(ctx: UIContext, areaId: string | null): ThemeDef | undefined {
  if (!areaId) return undefined;
  const area = ctx.world.areas.get(areaId);
  if (!area) return undefined;
  return ctx.game.colorSystem.entityThemeOverride(ctx.game.state, entityKeyOf('area', areaId)) ?? area.theme;
}

function themePrimary(ctx: UIContext, theme: ThemeDef | undefined, contribution: Record<string, string>, fallback: string): string {
  if (contribution.primary) return contribution.primary;
  if (theme?.palette?.[0]) return theme.palette[0];
  if (theme?.colorGroupId) {
    const group = ctx.game.colorSystem.getGroup(theme.colorGroupId);
    const primary = group?.theme?.primary ?? group?.slots.find(slot => slot.role === 'primary')?.color ?? group?.slots[0]?.color;
    if (primary) return primary;
  }
  return fallback;
}

function themeTokens(ctx: UIContext, theme: ThemeDef | undefined, fallback: string): { tokens: Record<string, string>; primary: string; palette: string[] } {
  const contribution = ctx.game.colorSystem.themeFromThemeDef(theme);
  const primary = themePrimary(ctx, theme, contribution, fallback);
  const tokens = { ...deriveThemeTokens(primary), ...contribution };
  const groupPalette = theme?.colorGroupId
    ? ctx.game.colorSystem.getGroup(theme.colorGroupId)?.slots.map(slot => slot.color)
    : undefined;
  const palette = theme?.palette?.length
    ? [...theme.palette]
    : groupPalette?.length
      ? groupPalette
      : [primary];
  return { tokens, primary, palette };
}

function colorThemePresent(theme: ThemeDef | undefined, contribution: Record<string, string>): boolean {
  return !!theme && (!!theme.colorGroupId || !!theme.palette?.length || Object.keys(contribution).length > 0 || Object.keys(theme.nodes ?? {}).length > 0);
}

function backgroundLayers(theme: ThemeDef | undefined, variantId: SelectorVariantId): readonly BackgroundLayerDef[] {
  const variant = theme?.backgroundVariants?.find(candidate => candidate.id === variantId);
  if (variant) return variant.layers;
  return theme?.background ?? [];
}

function selectorFallbackBackground(tokens: Record<string, string>, primary: string): BackgroundLayerDef {
  return {
    id: 'selector-focus-atmosphere',
    kind: 'gradient',
    value: `linear-gradient(135deg, ${tokens.bg ?? 'var(--canvas)'} 0%, ${tokens.bgAlt ?? 'var(--panel-light)'} 62%, ${primary} 118%)`,
    opacity: 0.78,
    position: 'center',
    size: 'cover',
    repeat: 'no-repeat',
    blendMode: 'normal',
    attachment: 'fixed',
  };
}

/** 与 RuntimeThemeManager 相同的“有 id 替换、匿名追加”合并规则。 */
export function mergeSelectorBackgrounds(...views: readonly BackgroundView[]): BackgroundView {
  const layers: BackgroundView['layers'][number][] = [];
  const byId = new Map<string, number>();
  for (const view of views) {
    for (const layer of view.layers) {
      if (layer.id) {
        const index = byId.get(layer.id);
        if (index !== undefined) {
          layers[index] = layer;
          continue;
        }
        byId.set(layer.id, layers.length);
      }
      layers.push(layer);
    }
  }
  return { layers };
}

function localTreeStyle(tree: ThemeTree): string {
  return themeTreeToInlineStyle(tree);
}

export function projectSelectorTheme(ctx: UIContext, face: SelectionFace, focusedEntityId: string | null): SelectorThemeProjection {
  const resumeId = activeInitId(ctx);
  const focusId = focusedEntityId ?? (face === 'init' ? resumeId : null);
  const initVariant = face === 'init' && focusId ? selectorInitVariant(ctx, focusId) : null;
  const enhancement = face === 'global-enh' && focusId ? ctx.game.registry.enhancements.get(focusId) : undefined;
  const variantId: SelectorVariantId = initVariant ?? (enhancement ? selectorEnhancementVariant(ctx, enhancement) : 'new');
  const selected = selectedTheme(ctx, face, focusId);
  const runtime = ctx.game.colorSystem.runtimeTheme();
  const runtimePrimary = runtime.tokens.primary ?? runtime.palette[0] ?? SYSTEM_DEFAULT_PRIMARY;
  const baseTokens = { ...deriveThemeTokens(runtimePrimary), ...runtime.tokens };
  const fallbackPrimary = selectorFallbackPrimary(face, focusId);
  const focus = themeTokens(ctx, selected.theme, selected.theme ? runtimePrimary : fallbackPrimary);
  const tokens = { ...baseTokens, ...focus.tokens };
  let palette = selected.theme ? focus.palette : [fallbackPrimary];
  const nodeOverrides = new Map(Object.entries(runtime.nodeOverrides) as [ThemeNodeName, string][]);
  for (const [node, value] of Object.entries(selected.theme?.nodes ?? {})) nodeOverrides.set(node as ThemeNodeName, value);

  const data = focusId && face === 'init' ? progressData(ctx, focusId) : undefined;
  const currentAreaId = resumeId && data && focusId === resumeId ? data.currentAreaId : (resumeId ? progressData(ctx, resumeId).currentAreaId : null);
  const currentArea = focusId && face === 'init' && focusId === resumeId ? areaTheme(ctx, currentAreaId) : undefined;
  const areaContribution = ctx.game.colorSystem.themeFromThemeDef(currentArea);
  if (currentArea && colorThemePresent(currentArea, areaContribution)) {
    const area = themeTokens(ctx, currentArea, tokens.primary ?? runtimePrimary);
    Object.assign(tokens, area.tokens);
    palette = area.palette;
  }
  for (const [node, value] of Object.entries(currentArea?.nodes ?? {})) nodeOverrides.set(node as ThemeNodeName, value);

  const primary = tokens.primary ?? focus.primary ?? runtimePrimary;
  const tree = buildThemeTree(tokens, primary, palette, nodeOverrides);
  const focusPresentation = buildPresentationView(selected.theme?.presentation, ctx.game.pics, {
    evaluateCondition: condition => ctx.game.conditionSystem.evaluateExpr(condition, ctx.game.state),
  });
  // 选择页只覆盖当前聚焦主题实际声明的顶栏宿主；未声明时保留玩家/运行时主题的顶栏配置。
  const presentation = focusPresentation.hasHost('header.button') || focusPresentation.hasHost('header')
    ? focusPresentation
    : ctx.presentation;
  const baseBackground = ctx.background.layers.length > 0
    ? ctx.background
    : buildBackgroundView(runtime.background, ctx.game.pics, baseTokens);
  const focusDefs = backgroundLayers(selected.theme, variantId);
  const focusBackground = buildBackgroundView(
    focusDefs.length > 0 ? focusDefs : [selectorFallbackBackground(tokens, primary)],
    ctx.game.pics,
    tokens,
  );
  const areaDefs = currentArea?.background ?? [];
  const areaBackground = areaDefs.length > 0
    ? buildBackgroundView(areaDefs, ctx.game.pics, tokens)
    : { layers: [] };
  const sceneId = focusId
    ? `${face === 'init' ? 'init' : 'enhancement'}:${focusId}`
    : `selector:${face}`;
  const transitionKey = [sceneId, variantId, resumeId ?? '', currentAreaId ?? ''].join('|');
  const context: SelectorBackgroundContext = {
    sceneId,
    variantId,
    face,
    focusedEntityId: focusId,
    activeInitId: resumeId,
    currentAreaId,
    transitionKey,
  };
  return {
    context,
    theme: selected.theme,
    tree,
    inlineStyle: localTreeStyle(tree),
    background: mergeSelectorBackgrounds(baseBackground, focusBackground, areaBackground),
    presentation,
  };
}

/** 为选择页顶栏建立局部只读上下文，不把聚焦主题写回运行时场景栈。 */
export function createSelectorPresentationContext(ctx: UIContext, projection: SelectorThemeProjection): UIContext {
  return createUIContext(ctx.game, ctx.background, projection.presentation);
}

/** 选择页专用超级背景内的双缓冲 HTML 外壳；背景层仍由 background-service 统一安全渲染。 */
export function renderSelectorSceneLayer(
  ctx: UIContext,
  projection: SelectorThemeProjection | null,
  slot: 'current' | 'next',
): string {
  if (!projection) {
    return `<div class="selector-scene-background selector-scene-background-${slot}" data-selector-scene-slot="${slot}" data-selector-transition-key="" aria-hidden="true"></div>`;
  }
  return `<div class="selector-scene-background selector-scene-background-${slot}" data-selector-scene-slot="${slot}" data-selector-transition-key="${ctx.escapeHtml(projection.context.transitionKey)}" style="${ctx.escapeHtml(projection.inlineStyle)}" aria-hidden="true">${renderBackground(projection.background, 'selector-background')}</div>`;
}

export function selectorThemeStyle(projection: SelectorThemeProjection): string {
  return projection.inlineStyle;
}

export function selectorPrimaryRgb(primary: string): string {
  return hexToRgbTriplet(primary);
}
