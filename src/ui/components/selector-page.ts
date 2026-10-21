// ============================================================
// ui/components/selector-page.ts — 选择页整页渲染（Init / GlobalEnhancement）
//
// 页面只保留顶栏与页脚，主体是一张全画布节点图 + 右侧固定工作台。
// Init 与 GlobalEnhancement 共用同一平面，按区带与线型区分；所有
// 名称、条件、价格、拥有态都来自只读投影，动作仍走既有 GameCommands。
// ============================================================

import type { UIContext } from '../context';
import type { InitSelectMode } from './init-select';
import type { SelectorNodeKind } from '../selector-theme';
import { buildSelectorGraphView, renderSelectorGraphWorkspace, renderSelectorWorkbench, resolveSelectorSelection } from './selector-graph';
import { renderHeader, renderHeaderButton } from './header';
import { createSelectorPresentationContext, projectSelectorTheme, renderSelectorSceneLayer } from '../selector-theme';

/** 整页渲染：顶栏 + 节点图画布 + 右侧工作台；lastInitialKind 决定初始聚焦的节点类型。 */
export function renderSelectorPage(
  ctx: UIContext,
  mode: InitSelectMode,
  initSelectedId: string | null,
  enhSelectedId: string | null,
  showBackToGame: boolean,
  initialKind: SelectorNodeKind = 'init',
): string {
  const restarting = mode === 'restart';
  const selection = resolveSelectorSelection(ctx, initialKind, initSelectedId, enhSelectedId);
  const selectedKind = selection?.kind ?? initialKind;
  const graph = buildSelectorGraphView(ctx);
  const projection = projectSelectorTheme(ctx, selectedKind, selection?.entityId ?? null);
  const headerContext = createSelectorPresentationContext(ctx, projection);

  const headerActions = [
    ctx.saveExists && !restarting
      ? renderHeaderButton(headerContext, {
        id: 'load-game-init',
        title: '读取本地存档',
        content: 'LOAD SAVE <span>↗</span>',
      })
      : '',
    showBackToGame
      ? renderHeaderButton(headerContext, {
        title: '返回当前游戏',
        backToGame: true,
        content: '返回游戏 <span>↗</span>',
      })
      : '',
  ].join('');

  const statusLabel = selectedKind === 'init'
    ? `WORLD LINE · ${restarting ? 'RESTART' : 'NEW GAME'}`
    : 'GLOBAL ENH';

  return `
    <main class="console-shell init-select-shell selector-shell selector-graph-shell" style="${ctx.escapeHtml(projection.inlineStyle)}">
      <div class="selector-super-background" data-selector-super-background="true" style="${ctx.escapeHtml(projection.inlineStyle)}">
        <div class="selector-scene-background-stack" aria-hidden="true">
          ${renderSelectorSceneLayer(ctx, projection, 'current')}
          ${renderSelectorSceneLayer(ctx, null, 'next')}
        </div>
      </div>

      ${renderHeader(headerContext, {
        className: 'selector-topbar',
        themeStyle: projection.inlineStyle,
        themeKey: projection.context.transitionKey,
        extraActions: headerActions,
        statusLabel: `<span data-selector-status>${statusLabel}</span>`,
        statusSubline: '● GRAPH VIEW',
      })}

      <div class="selector-workspace" style="${ctx.escapeHtml(projection.inlineStyle)}">
        ${renderSelectorGraphWorkspace(ctx, graph, selection, projection.context.transitionKey)}
        ${renderSelectorWorkbench(ctx, mode, selection, showBackToGame)}
        <section class="selector-init-overview" data-selector-init-overview hidden aria-label="世界线概览" aria-describedby="selector-init-description"></section>
      </div>

      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>TS-HTML ENGINE · NO NETWORK</span></footer>
    </main>`;
}
