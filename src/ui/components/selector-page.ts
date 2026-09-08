// ============================================================
// ui/components/selector-page.ts — 选择页整页渲染（Init ⇄ GlobalEnhancement）
// 两个面向叠放于同一视口（一次只显示一面），共享一个可左右滑动的圆盘：
// Init 面：盘在左、盘右缘聚焦、详情在左；GlobalEnhancement 面：盘在右、盘左缘聚焦、详情在右（镜像）。
// 两个轮盘层（.wheel-init / .wheel-enh）直接挂在 shell 上覆盖整页，卡片只受页面边界裁剪。
// initialFace 决定默认进入的面与圆盘初始位置。
// ============================================================

import type { UIContext } from '../context';
import { InitSelectMode, renderInitDetail, renderInitRow, visibleInitsByTilt } from './init-select';
import {
  SelectionFace,
  renderGlobalEnhancementDetail,
  renderGlobalEnhancementRow,
  visibleGlobalEnhancements,
} from './global-enhancement-select';
import { renderHeader, renderHeaderButton } from './header';
import { createSelectorPresentationContext, preferredInitId, projectSelectorTheme, renderSelectorSceneLayer } from '../selector-theme';

/** 整页渲染：双面叠放 + 共享圆盘 + 顶栏翻面按钮。initialFace 决定默认进入的面。 */
export function renderSelectorPage(
  ctx: UIContext,
  mode: InitSelectMode,
  initSelectedId: string | null,
  enhSelectedId: string | null,
  showBackToGame: boolean,
  initialFace: SelectionFace,
): string {
  const restarting = mode === 'restart';
  const isEnh = initialFace === 'global-enh';

  const initList = visibleInitsByTilt(ctx);
  const initPreferredId = preferredInitId(ctx);
  const initSelected = initList.find(i => i.id === initSelectedId)
    ?? initList.find(i => i.id === initPreferredId)
    ?? initList[0];
  const initDetail = initSelected
    ? renderInitDetail(ctx, mode, initSelected.id)
    : '<div class="init-orb-copy"><p>暂无可选的世界线。</p></div>';
  const initRows = initList.map(i => renderInitRow(ctx, i.id) ?? '').join('');

  const enhList = visibleGlobalEnhancements(ctx);
  const enhSelected = enhList.find(e => e.id === enhSelectedId) ?? enhList[0];
  const enhDetail = enhSelected
    ? renderGlobalEnhancementDetail(ctx, enhSelected.id, showBackToGame)
    : '<div class="init-orb-copy enh-orb-copy"><p>暂无可选的全局强化。</p></div>';
  const enhRows = enhList.map(e => renderGlobalEnhancementRow(ctx, e.id) ?? '').join('');
  const activeProjection = projectSelectorTheme(
    ctx,
    initialFace,
    isEnh ? enhSelected?.id ?? null : initSelected?.id ?? null,
  );
  const headerContext = createSelectorPresentationContext(ctx, activeProjection);
  const headerActions = [
    ctx.saveExists && !restarting
      ? renderHeaderButton(headerContext, {
        id: 'load-game-init',
        title: '读取本地存档',
        content: 'LOAD SAVE <span>↗</span>',
      })
      : '',
    renderHeaderButton(headerContext, {
      title: isEnh ? '切换到世界线选择' : '切换到全局强化选择',
      flipSelectionFace: true,
      content: `<span data-flip-label>${isEnh ? '世界线' : '全局强化'}</span> <span>⇄</span>`,
    }),
    showBackToGame
      ? renderHeaderButton(headerContext, {
        title: '返回当前游戏',
        backToGame: true,
        content: '返回游戏 <span>↗</span>',
      })
      : '',
  ].join('');

  const initFace = `
    <section class="selector-face face-init ${isEnh ? 'is-inactive' : ''}">
      <div class="init-stage">
        ${initDetail}

        <aside class="init-rail">
          <div class="init-rail-head">
            <span class="eyebrow">INDEX / BY TILT DESC</span>
            <span class="init-rail-hint">滚轮移动聚焦 ↕</span>
          </div>
        </aside>
      </div>
    </section>`;

  const enhFace = `
    <section class="selector-face face-enh ${isEnh ? '' : 'is-inactive'}">
      <div class="init-stage enh-stage">
        <aside class="init-rail enh-rail">
          <div class="init-rail-head">
            <span class="eyebrow">INDEX / GLOBAL ENH</span>
            <span class="init-rail-hint">滚轮移动聚焦 ↕</span>
          </div>
        </aside>

        ${enhDetail}
      </div>
    </section>`;

  return `
    <main class="console-shell init-select-shell selector-shell ${isEnh ? 'enh-mode' : 'init-mode'}">
      <div class="selector-super-background" data-selector-super-background="true" style="${ctx.escapeHtml(activeProjection.inlineStyle)}">
        <div class="selector-scene-background-stack" aria-hidden="true">
          ${renderSelectorSceneLayer(ctx, activeProjection, 'current')}
          ${renderSelectorSceneLayer(ctx, null, 'next')}
        </div>
      </div>

      <div class="init-orb-disc selector-disc" aria-hidden="true" style="${ctx.escapeHtml(activeProjection.inlineStyle)}"></div>

      ${renderHeader(headerContext, {
        className: 'selector-topbar',
        themeStyle: activeProjection.inlineStyle,
        themeKey: activeProjection.context.transitionKey,
        extraActions: headerActions,
        statusLabel: `<span data-face-status>${isEnh ? 'GLOBAL ENH' : `WORLD LINE · ${restarting ? 'RESTART' : 'NEW GAME'}`}</span>`,
        statusSubline: '● AWAITING INPUT',
      })}

      <div class="selector-viewport" data-selector-theme-key="${ctx.escapeHtml(activeProjection.context.transitionKey)}" style="${ctx.escapeHtml(activeProjection.inlineStyle)}">
        ${initFace}
        ${enhFace}
      </div>

      <div class="init-wheel wheel-init ${isEnh ? 'is-inactive' : ''}">${initRows}</div>
      <div class="init-wheel wheel-enh ${isEnh ? '' : 'is-inactive'}">${enhRows}</div>

      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>TS-HTML ENGINE · NO NETWORK</span></footer>
    </main>`;
}
