import { UIContext } from '../context';
import { DEFAULT_LAYER_ORDER, type ThemeOrderScope } from '../../engine/core/theme-runtime';
import type { PresentationHostState } from '../../engine/types/theme';
import { entityKeyOf, renderEntityThemeOptions } from './entity-theme-options';
import { renderPresentationHostBackground } from '../presentation-service';

const LAYER_LABELS: Record<ThemeOrderScope, string> = {
  player: '玩家层',
  init: '世界线层',
  area: '场景层',
  student: '学生层',
};

/** 主题浮窗内的层级优先级段：行可拖拽排序，上方优先（高 → 低）；右侧显示该层当前生效主题色。 */
function renderLayerOrderSection(ctx: UIContext): string {
  const order = ctx.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER;
  // 引擎序 = 低 → 高（后合并者覆盖）；展示序反转，使顶部为最高优先级
  const display = [...order].reverse();
  return `
    <section class="theme-float-section layer-order">
      <h4 class="theme-float-section-title">层级优先级 <small>上方优先 · 拖拽排序</small></h4>
      <div class="layer-order-rows" data-theme-layer-order-rows>
        ${display.map((scope, i) => {
          const primary = ctx.game.colorSystem.scopeThemeTokens(scope)['primary'] ?? null;
          return `
          <div class="layer-order-row" draggable="true" data-theme-layer-order-scope="${scope}">
            <span class="layer-order-handle" title="拖拽调整优先级">⋮⋮</span>
            <span class="layer-order-rank">${i + 1}</span>
            <span class="layer-order-name">${LAYER_LABELS[scope]}</span>
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
  className?: string;
  themeStyle?: string;
  themeKey?: string;
}

export type HeaderServiceId = 'game' | 'datapack' | 'saves' | 'records';

export interface HeaderButtonRenderOptions {
  content: string;
  id?: string;
  title?: string;
  className?: string;
  service?: HeaderServiceId;
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
              ${renderLayerOrderSection(ctx)}
              ${renderAreaDesignsSection(ctx)}
            </div>
          </div>
        </div>
        <div class="save-actions service-nav-actions">
          ${[['game', '游戏', '⌂'], ['datapack', '数据包', '▦'], ['saves', '存档', '↓'], ['records', '记录', '✦']].map(([service, label, icon]) => renderHeaderButton(ctx, { service: service as HeaderServiceId, title: `进入${label}服务`, content: `${label} <span>${icon}</span>` })).join('')}
          ${renderHeaderButton(ctx, { id: 'help-modal', title: '关于', content: '?' })}
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
