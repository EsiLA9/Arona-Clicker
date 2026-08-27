// ============================================================
// ui/components/selector-page.ts — 选择页整页渲染（Init ⇄ GlobalEnhancement）
// 两个面向叠放于同一视口（一次只显示一面），共享一个可左右滑动的圆盘：
// Init 面：盘在左、盘右缘聚焦、详情在左；GlobalEnhancement 面：盘在右、盘左缘聚焦、详情在右（镜像）。
// initialFace 决定默认进入的面与圆盘初始位置。
// ============================================================

import { UIContext } from '../context';
import { InitSelectMode, renderInitDetail, renderInitRow, visibleInitsByTilt } from './init-select';
import {
  SelectionFace,
  renderGlobalEnhancementDetail,
  renderGlobalEnhancementRow,
  visibleGlobalEnhancements,
} from './global-enhancement-select';

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
  const initSelected = initList.find(i => i.id === initSelectedId) ?? initList[0];
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

      <div class="init-wheel">${initRows}</div>
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

      <div class="init-wheel enh-wheel">${enhRows}</div>
    </section>`;

  return `
    <main class="console-shell init-select-shell selector-shell ${isEnh ? 'enh-mode' : 'init-mode'}">
      <div class="init-orb-disc selector-disc"></div>

      <header class="topbar">
        <div class="brand-lockup">
          <span class="signal-dot"></span>
          <div><span class="eyebrow">SCHale / SYSTEM 01</span><h1>AronaClicker</h1></div>
        </div>
        <div class="topbar-right">
          ${ctx.saveExists && !restarting ? `<button id="load-game-init" class="toolbar-button">LOAD SAVE<span>↗</span></button>` : ''}
          <button class="toolbar-button" data-flip-selection-face><span data-flip-label>${isEnh ? '世界线' : '全局强化'}</span> <span>⇄</span></button>
          ${showBackToGame ? '<button class="toolbar-button" data-back-to-game>返回游戏 <span>↗</span></button>' : ''}
          <div class="status-line"><span data-face-status>${isEnh ? 'GLOBAL ENH' : `WORLD LINE · ${restarting ? 'RESTART' : 'NEW GAME'}`}</span><span class="live">● AWAITING INPUT</span></div>
        </div>
      </header>

      <div class="selector-viewport">
        ${initFace}
        ${enhFace}
      </div>

      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>TS-HTML ENGINE · NO NETWORK</span></footer>
    </main>`;
}
