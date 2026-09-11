import { UIContext } from '../context';
import { DEFAULT_LAYER_ORDER, type ThemeOrderScope } from '../../engine/core/theme-runtime';
import type { PresentationHostState, ThemeDef } from '../../engine/types/theme';
import { entityKeyOf, renderEntityThemeOptions } from './entity-theme-options';
import { renderPresentationHostBackground } from '../presentation-service';

const LAYER_LABELS: Record<ThemeOrderScope, string> = {
  player: '玩家层',
  init: '世界线层',
  area: '场景层',
  student: '学生层',
};

const LAYER_REGIONS: Record<ThemeOrderScope, string> = {
  player: '全局界面',
  init: '当前世界线',
  area: '当前区域',
  student: '当前学生剧情',
};

interface LayerOrderMeta {
  themeName: string;
  region: string;
}

function themeNameOf(ctx: UIContext, theme: ThemeDef | undefined): string {
  if (!theme) return '未设置';
  if (theme.colorGroupId) {
    return ctx.game.colorSystem.getGroup(theme.colorGroupId)?.name ?? `色彩组 · ${theme.colorGroupId}`;
  }
  return '局部主题';
}

function activeEntityThemeName(
  ctx: UIContext,
  entityKey: string | undefined,
  declaredTheme: ThemeDef | undefined,
  equippedEquipmentId?: string | null,
): string {
  if (!entityKey) return themeNameOf(ctx, declaredTheme);
  const active = ctx.game.colorSystem.entityThemeOptions(ctx.game.state, entityKey, {
    declaredTheme,
    equippedEquipmentId,
  }).find(option => option.active);
  if (!active) return themeNameOf(ctx, declaredTheme);
  return active.kind === 'default' ? themeNameOf(ctx, active.theme ?? declaredTheme) : active.name;
}

function playerThemeName(ctx: UIContext): string {
  const activeTheme = ctx.game.state.activeTheme ?? { kind: 'system' as const };
  if (activeTheme.kind === 'system') return '系统默认';
  if (activeTheme.kind === 'color-group') {
    return ctx.game.colorSystem.getGroup(activeTheme.id)?.name ?? `色彩组 · ${activeTheme.id}`;
  }
  const customTheme = ctx.game.state.customThemes?.[activeTheme.id];
  return customTheme ? `自定义 · ${customTheme.name}` : '用户自定义主题';
}

function layerOrderMeta(ctx: UIContext, scope: ThemeOrderScope, studentVariantId: string | null): LayerOrderMeta {
  if (scope === 'player') {
    return { themeName: playerThemeName(ctx), region: LAYER_REGIONS.player };
  }

  if (scope === 'init') {
    const init = ctx.view.activeInit ? ctx.world.inits.get(ctx.view.activeInit) : undefined;
    return {
      themeName: activeEntityThemeName(ctx, init ? entityKeyOf('init', init.id) : undefined, init?.theme),
      region: init ? `${LAYER_REGIONS.init} · ${init.name}` : `${LAYER_REGIONS.init} · 未进入`,
    };
  }

  if (scope === 'area') {
    const area = ctx.view.currentAreaId ? ctx.world.areas.get(ctx.view.currentAreaId) : undefined;
    return {
      themeName: activeEntityThemeName(ctx, area ? entityKeyOf('area', area.id) : undefined, area?.theme),
      region: area ? `${LAYER_REGIONS.area} · ${area.name}` : `${LAYER_REGIONS.area} · 未进入`,
    };
  }

  const variant = studentVariantId ? ctx.game.rosterSystem.getVariant(studentVariantId) : undefined;
  const equippedEquipmentId = studentVariantId
    ? ctx.game.rosterSystem.getOwned(ctx.game.state, studentVariantId)?.colorEquipment
    : null;
  const declaredTheme = variant?.theme ?? (variant?.colorGroupId ? { colorGroupId: variant.colorGroupId } : undefined);
  return {
    themeName: activeEntityThemeName(ctx, variant ? entityKeyOf('variant', variant.id) : undefined, declaredTheme, equippedEquipmentId),
    region: variant ? `${LAYER_REGIONS.student} · ${variant.displayName}` : `${LAYER_REGIONS.student} · 未打开`,
  };
}

/** 主题浮窗内的层级优先级段：行可拖拽排序，上方优先（高 → 低）；右侧显示该层当前生效主题色。 */
function renderLayerOrderSection(ctx: UIContext, studentVariantId: string | null): string {
  const order = ctx.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER;
  // 引擎序 = 低 → 高（后合并者覆盖）；展示序反转，使顶部为最高优先级
  const display = [...order].reverse();
  return `
    <section class="theme-float-section layer-order">
      <h4 class="theme-float-section-title">层级优先级 <small>上方优先 · 拖拽排序</small></h4>
      <div class="layer-order-rows" data-theme-layer-order-rows>
        ${display.map((scope, i) => {
          const primary = ctx.game.colorSystem.scopeThemeTokens(scope)['primary'] ?? null;
          const meta = layerOrderMeta(ctx, scope, studentVariantId);
          const themeName = ctx.escapeHtml(meta.themeName);
          const region = ctx.escapeHtml(`${LAYER_LABELS[scope]} · ${meta.region}`);
          return `
          <div class="layer-order-row" draggable="true" data-theme-layer-order-scope="${scope}" aria-label="${themeName}，作用区域：${region}">
            <span class="layer-order-handle" title="拖拽调整优先级">⋮⋮</span>
            <span class="layer-order-rank">${i + 1}</span>
            <span class="layer-order-name">
              <strong class="layer-order-theme-name">${themeName}</strong>
              <small class="layer-order-region">${region}</small>
            </span>
            <span class="layer-order-swatch ${primary ? '' : 'none'}" style="--swatch:${primary ?? '#c3ccdb'}" title="${primary ? '当前生效主题色' : '当前未生效'}"></span>
          </div>`;
        }).join('')}
      </div>
      <p class="theme-float-note">剧情演出临时层始终最高优先级</p>
    </section>`;
}

/** 主题浮窗内的区域配色段：当前 Area 的可用主题来源（仅进入 Area 时渲染）。 */
function renderAreaDesignsSection(ctx: UIContext): string {
  const areaId = ctx.view.currentAreaId;
  if (!areaId) return '';
  const area = ctx.world.areas.get(areaId);
  if (!area) return '';
  const entityKey = entityKeyOf('area', areaId);
  const options = ctx.game.colorSystem.entityThemeOptions(ctx.game.state, entityKey, {
    declaredTheme: area.theme,
  });
  if (options.length === 0) return '';
  return `
    <section class="theme-float-section entity-designs">
      <h4 class="theme-float-section-title">区域配色 <small>${ctx.escapeHtml(area.name)}</small></h4>
      ${renderEntityThemeOptions(ctx, entityKey, options)}
    </section>`;
}

function renderUserThemeSection(ctx: UIContext): string {
  const capability = ctx.game.userThemeService.capability();
  const customId = ctx.game.state.userTheme?.customThemeId;
  const customTheme = customId ? ctx.game.state.customThemes?.[customId] : undefined;
  const active = ctx.game.state.activeTheme?.kind === 'custom' && ctx.game.state.activeTheme.id === customId;
  return `
    <section class="theme-float-section user-theme-access">
      <h4 class="theme-float-section-title">用户自定义主题 <small>${customTheme ? (active ? '当前使用中' : '已保存，可应用') : '尚未保存'}</small></h4>
      <button type="button" class="theme-editor-entry ${capability.active ? 'is-available' : 'is-locked'}" data-open-user-theme>
        <span>${capability.active ? (customTheme ? '编辑用户自定义' : '创建用户自定义') : '需要主题编辑权限'}</span><span>↗</span>
      </button>
    </section>`;
}

export interface HeaderRenderOptions {
  extraActions?: string;
  statusLabel?: string;
  statusSubline?: string;
  studentVariantId?: string | null;
  className?: string;
  themeStyle?: string;
  themeKey?: string;
}

export type HeaderServiceId = 'game' | 'settings';
export type HeaderActionId = 'inventory';

export interface HeaderButtonRenderOptions {
  content: string;
  id?: string;
  title?: string;
  className?: string;
  service?: HeaderServiceId;
  action?: HeaderActionId;
  disabled?: boolean;
  flipSelectionFace?: boolean;
  backToGame?: boolean;
  state?: PresentationHostState;
  ariaExpanded?: boolean;
}

/** 顶栏普通按钮的统一表现入口；选择页操作与游戏页服务按钮共用 header.button。 */
export function renderHeaderButton(ctx: UIContext, options: HeaderButtonRenderOptions): string {
  const hostId = 'header.button';
  const state = options.state ?? 'inactive';
  const className = ['toolbar-button', 'presentation-host-target', options.className ?? '']
    .filter(Boolean)
    .join(' ');
  const attributes = [
    `class="${className}"`,
    options.id ? `id="${ctx.escapeHtml(options.id)}"` : '',
    options.title ? `title="${ctx.escapeHtml(options.title)}"` : '',
    options.service ? `data-service="${options.service}"` : '',
    options.action ? `data-topbar-action="${options.action}"` : '',
    options.disabled ? 'disabled' : '',
    options.flipSelectionFace ? 'data-flip-selection-face' : '',
    options.backToGame ? 'data-back-to-game' : '',
    `data-theme-host-id="${hostId}"`,
    `data-theme-state="${state}"`,
    `data-theme-text-mode="${ctx.textColorModeForHost(hostId, state)}"`,
    state === 'inactive' ? `data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost(hostId)}"` : '',
    options.ariaExpanded === undefined ? '' : `aria-expanded="${options.ariaExpanded}"`,
  ].filter(Boolean).join(' ');
  return `<button ${attributes}>${renderPresentationHostBackground(ctx, hostId, 'presentation-host-background', state)}<span class="presentation-host-content">${options.content}</span></button>`;
}

export function renderHeader(ctx: UIContext, options: HeaderRenderOptions = {}): string {
  const { view, game } = ctx;
  const activeTheme = game.state.activeTheme ?? { kind: 'system' as const };
  // 色板只展示已拥有的色彩组（未解锁的不渲染，避免"看得到用不了"）
  const ownedGroups = game.colorSystem.ownedGroups(game.state);
  const customId = game.state.userTheme?.customThemeId;
  const customTheme = customId ? game.state.customThemes?.[customId] : undefined;
  const customSwatch = customTheme
    ? game.colorSystem.themeSwatchColor(customTheme)
      ?? (customTheme.baseThemeRef?.kind === 'color-group' && customTheme.baseThemeRef.id
        ? game.colorSystem.themeSwatchColor({ colorGroupId: customTheme.baseThemeRef.id })
        : undefined)
      ?? '#888'
    : undefined;
  const palette = `
        <button class="theme-swatch default ${activeTheme.kind === 'system' ? 'active' : ''}" data-activate-group="" aria-pressed="${activeTheme.kind === 'system'}" title="系统默认主题">系统默认</button>
        ${ownedGroups.map(g => {
          const primary = game.colorSystem.themeSwatchColor({ colorGroupId: g.id }) ?? '#888';
          const active = activeTheme.kind === 'color-group' && activeTheme.id === g.id ? 'active' : '';
          return `
          <button class="theme-swatch group ${active}" data-activate-group="${g.id}" aria-pressed="${Boolean(active)}"
            title="${ctx.escapeHtml(g.name)}" style="--swatch:${primary}">${ctx.escapeHtml(g.name)}</button>`;
        }).join('')}
        ${customTheme ? `<button class="theme-swatch custom ${activeTheme.kind === 'custom' && activeTheme.id === customId ? 'active' : ''}" data-activate-custom-theme="${ctx.escapeHtml(customId!)}" aria-pressed="${activeTheme.kind === 'custom' && activeTheme.id === customId}" title="应用用户自定义主题" style="--swatch:${customSwatch}">自定义 · ${ctx.escapeHtml(customTheme.name)}</button>` : ''}`;
  const className = ['topbar', options.className ?? ''].filter(Boolean).join(' ');
  const themeStyle = options.themeStyle ? ` style="${ctx.escapeHtml(options.themeStyle)}"` : '';
  const themeKey = options.themeKey ? ` data-selector-header-theme-key="${ctx.escapeHtml(options.themeKey)}"` : '';
  return `
    <header class="${className}"${themeKey}${themeStyle}>
      <div class="brand-lockup">
        <span class="signal-dot"></span>
        <div><h1>AronaClicker</h1></div>
      </div>
      <div class="topbar-right">
        ${options.extraActions ?? ''}
        <div class="status-line"><span>${options.statusLabel ?? `WORLDLINE ${view.activeInit ? ctx.nameOf('init', view.activeInit) : '未进入'}`}</span>${options.statusSubline ? `<span class="live">${options.statusSubline}</span>` : ''}</div>
        <div class="theme-palette">
          ${renderHeaderButton(ctx, { id: 'theme-palette-btn', title: '切换界面主题色', ariaExpanded: false, content: '主题 <span>◑</span>' })}
          <div class="theme-float" data-theme-float>
            <div class="theme-float-head" data-theme-float-head>
              <span>主题设置</span>
              <button class="theme-float-close" type="button" data-theme-float-close title="关闭">✕</button>
            </div>
            <div class="theme-float-body">
              <div class="theme-swatches">${palette}</div>
              ${renderUserThemeSection(ctx)}
              ${renderLayerOrderSection(ctx, options.studentVariantId ?? null)}
              ${renderAreaDesignsSection(ctx)}
            </div>
          </div>
        </div>
        <div class="save-actions service-nav-actions">
          ${renderHeaderButton(ctx, { service: 'game', title: '返回游戏', content: '游戏 <span>⌂</span>' })}
          ${renderHeaderButton(ctx, {
            action: 'inventory',
            disabled: !view.activeInit,
            title: view.activeInit ? '打开背包' : '进入游戏后可用',
            content: '背包 <span>▤</span>',
          })}
          ${renderHeaderButton(ctx, { service: 'settings', title: '打开设置', content: '设置 <span>⚙</span>' })}
        </div>
      </div>
    </header>`;
}

export function renderResourceStrip(ctx: UIContext): string {
  const { view, game } = ctx;
  const gainOf = (resourceId: string) =>
    ctx.formatNumber(game.gameNumSystem.evaluateResourceGain(resourceId, game.state));
  // 资源条由数据包声明的 resourceDisplays 驱动：
  // 数据包编辑者可自定义显示哪些货币、标签、可选策略（hasAmount）与排序，UI 不再硬编码。
  const items = [...game.registry.resourceDisplays.values()]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(def => {
      const amount = view.resources[def.resourceId] ?? 0;
      if (def.showWhen === 'hasAmount' && amount <= 0) return '';
      return `<span class="res-item hover-wrap" data-tooltip="resource:${def.resourceId}"><span class="eyebrow">${ctx.escapeHtml(def.label)}</span><strong data-resource="${def.resourceId}">${ctx.formatNumber(amount)}</strong><small data-gain="${def.resourceId}">+${gainOf(def.resourceId)}/t</small></span>`;
    })
    .join('');
  return `
    <section class="resource-bar">
      ${items}
      <span class="res-item"><span class="eyebrow">帧</span><strong data-resource="frame">${ctx.formatNumber(view.totalFrames)}</strong></span>
      <button id="tick-now" class="primary-button">推进 <span>↗</span></button>
    </section>`;
}
