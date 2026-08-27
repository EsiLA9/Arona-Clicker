import { UIContext } from '../context';
import { DEFAULT_LAYER_ORDER, type ThemeOrderScope } from '../../engine/core/theme-runtime';
import { entityKeyOf, renderEntityThemeOptions } from './entity-theme-options';

const LAYER_LABELS: Record<ThemeOrderScope, string> = {
  player: '玩家层',
  area: '场景层',
  student: '学生层',
};

/** 主题浮窗内的层级优先级段：三行各带 ◀/▶ 交换相邻位（低 → 高）。 */
function renderLayerOrderSection(ctx: UIContext): string {
  const order = ctx.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER;
  return `
    <section class="theme-float-section layer-order">
      <h4 class="theme-float-section-title">层级优先级 <small>低 → 高</small></h4>
      <div class="layer-order-rows">
        ${order.map((scope, i) => `
          <div class="layer-order-row">
            <span class="layer-order-rank">${i + 1}</span>
            <span class="layer-order-name">${LAYER_LABELS[scope]}</span>
            <span class="layer-order-actions">
              <button type="button" class="layer-order-move" data-theme-layer-order-move="${scope}" data-dir="-1" title="降低优先级" ${i === 0 ? 'disabled' : ''}>◀</button>
              <button type="button" class="layer-order-move" data-theme-layer-order-move="${scope}" data-dir="1" title="提高优先级" ${i === order.length - 1 ? 'disabled' : ''}>▶</button>
            </span>
          </div>`).join('')}
      </div>
      <p class="theme-float-note">剧情演出临时层始终最高优先级</p>
    </section>`;
}

/** 主题浮窗内的区域配色段：当前 Area 的可用主题来源（仅进入 Area 时渲染）。 */
function renderAreaDesignsSection(ctx: UIContext): string {
  const areaId = ctx.view.currentAreaId;
  if (!areaId) return '';
  const area = ctx.game.registry.areas.get(areaId);
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

export function renderHeader(ctx: UIContext): string {
  const { view, game } = ctx;
  const ownedColors = game.colorSystem.ownedColors(game.state);
  const activeColor = game.state.activeColor;
  const customTheme = game.state.customTheme;
  const palette = `
        <button class="theme-swatch default ${!activeColor && !customTheme ? 'active' : ''}" data-activate-color="" title="默认主题">默认</button>
        ${ownedColors.map(c => `
          <button class="theme-swatch ${activeColor === c.id && !customTheme ? 'active' : ''}"
            data-activate-color="${c.id}" title="${ctx.escapeHtml(c.name)}"
            style="--swatch:${c.theme['primary'] ?? '#888'}">${ctx.escapeHtml(c.name)}</button>`).join('')}
        ${[...game.registry.colorGroups.values()].map(g => {
          const slot = g.slots.find(s => s.role === 'primary') ?? g.slots[0];
          const color = slot ? game.registry.colors.get(slot.colorId) : undefined;
          const primary = color?.theme['primary'] ?? '#888';
          const active = customTheme?.colorId === slot?.colorId ? 'active' : '';
          return `
          <button class="theme-swatch group ${active}" data-activate-custom-theme="${g.id}"
            title="自定义主题 · ${ctx.escapeHtml(g.name)}" style="--swatch:${primary}">${ctx.escapeHtml(g.name)}</button>`;
        }).join('')}`;
  return `
    <header class="topbar">
      <div class="brand-lockup">
        <span class="signal-dot"></span>
        <div><h1>AronaClicker</h1></div>
      </div>
      <div class="topbar-right">
        <div class="status-line"><span>WORLDLINE ${view.activeInit ? ctx.nameOf('init', view.activeInit) : '未进入'}</span></div>
        <div class="theme-palette">
          <button id="theme-palette-btn" class="toolbar-button" title="切换界面主题色">
            主题 <span>◑</span>
          </button>
          <div class="theme-float" data-theme-float>
            <div class="theme-float-head" data-theme-float-head>
              <span>主题设置</span>
              <button class="theme-float-close" type="button" data-theme-float-close title="关闭">✕</button>
            </div>
            <div class="theme-float-body">
              <div class="theme-swatches">${palette}</div>
              ${renderLayerOrderSection(ctx)}
              ${renderAreaDesignsSection(ctx)}
            </div>
          </div>
        </div>
        <div class="save-actions">
          <button id="collection-modal" class="toolbar-button" title="被动闲聊收集图鉴（按 Pool 分组）">图鉴 <span>✦</span></button>
          <button id="import-datapack" class="toolbar-button" title="从压缩包加载 Mod 数据包（遍历其中所有 .json 构造 Def）">导入 Mod <span>⇪</span></button>
          <button id="new-game" class="toolbar-button" title="放弃当前进度，选择新的世界线">新游戏 <span>↗</span></button>
          <button id="save-game" class="toolbar-button" title="保存当前进度">保存 <span>↓</span></button>
          <button id="load-game" class="toolbar-button" title="读取本地存档" ${ctx.saveExists ? '' : 'disabled'}>读取 <span>↗</span></button>
          <button id="help-modal" class="toolbar-button" title="关于">?</button>
        </div>
      </div>
    </header>`;
}

export function renderResourceStrip(ctx: UIContext): string {
  const { view, game } = ctx;
  const gainOf = (resourceId: string) =>
    ctx.formatNumber(game.gameNumSystem.evaluateResourceGain(resourceId, game.state as never));
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
