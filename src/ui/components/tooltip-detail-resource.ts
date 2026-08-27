// ============================================================
// ui/components/tooltip-detail-resource.ts — 资源提示面板
// 从 tooltip.ts 拆出：renderResourceDetail
// ============================================================

import { UIContext } from '../context';

/** 生成资源（Resource）的详情信息面板 HTML：当前值 + 按需统计。 */
export function renderResourceDetail(ctx: UIContext, resourceId: string): string {
  const { game, view } = ctx;
  const value = view.resources[resourceId] ?? 0;
  const initId = view.activeInit;
  const stat = (dsl: string) => game.statsService.evaluate(dsl) ?? 0;
  const perTick = game.gameNumSystem.evaluateResourceGain(resourceId, game.state as never) ?? 0;
  const produced = stat(`$GlobalProducedAmount ${resourceId}`);
  const consumed = stat(`$GlobalConsumedAmount ${resourceId}`);
  const runProduced = stat(`$CurrentRunProducedAmount ${resourceId}`);
  const initProduced = initId ? stat(`$InitProducedAmount ${initId} ${resourceId}`) : null;

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">RESOURCE</span><strong>${ctx.escapeHtml(ctx.nameOf('resource', resourceId))}</strong></div>
      <div class="info-divider"></div>
      <div class="info-row"><span>当前持有</span><span class="info-accent">${ctx.formatNumber(value)}</span></div>
      <div class="info-row"><span>每 Tick 获取</span><span class="info-accent">+${ctx.formatNumber(perTick)}</span></div>
      <div class="info-row"><span>累计产出</span><span>${ctx.formatNumber(produced)}</span></div>
      <div class="info-row"><span>累计消耗</span><span>${ctx.formatNumber(consumed)}</span></div>
      <div class="info-row"><span>本次游玩产出</span><span>${ctx.formatNumber(runProduced)}</span></div>
      ${initId !== null && initProduced !== null
        ? `<div class="info-row"><span>${ctx.escapeHtml(ctx.nameOf('init', initId))} 产出</span><span>${ctx.formatNumber(initProduced)}</span></div>`
        : ''}
    </div>`;
}
