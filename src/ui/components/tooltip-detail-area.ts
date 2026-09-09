// ============================================================
// ui/components/tooltip-detail-area.ts — Area 提示面板
// 从 tooltip.ts 拆出：renderAreaDetail
// ============================================================

import type { AreaDef } from '../../data-services/contracts/world';
import { existenceCondition } from '../../engine/visibility/reveal';
import { UIContext } from '../context';
import { conditionMet, getAreaReveal, OBFUSCATED, renderRevealTriggers } from './tooltip-reveal';
import { describeCondition, getSpotYieldBreakdown } from './tooltip-enhancement';
import { buildConditionView, renderConditionTree } from '../condition-presentation';

/** 生成 Area 的详情信息面板 HTML（按信息揭示阶梯遮挡）。 */
export function renderAreaDetail(ctx: UIContext, area: AreaDef): string {
  const { game, view } = ctx;
  const reveal = getAreaReveal(ctx, area);
  const known = reveal.utilityKnown;
  const isCurrent = view.currentAreaId === area.id;
  const visible = view.visibility.areas[area.id] ?? false;
  const isLocked = !visible;
  const name = reveal.nameKnown ? area.name : OBFUSCATED;
  const desc = known ? area.description : '';
  const init = game.world.inits.get(area.initId);
  const spotIds = game.world.spotsOfArea(area.id);
  const spotRows = spotIds.map(spotId => {
    const spot = game.world.spots.get(spotId);
    if (!spot) return '';
    const level = view.spotLevels[spotId] ?? 0;
    const owned = level > 0;
    const yieldInfo = getSpotYieldBreakdown(ctx, spot);
    const resource = ctx.nameOf('resource', spot.baseYieldResource);
    return `
      <div class="info-spot">
        <span class="info-spot-name">${ctx.escapeHtml(spot.name)}</span>
        <span class="${owned ? 'info-accent' : 'info-dim'}">${owned ? `Lv.${level} · ${ctx.formatNumber(yieldInfo.total)} ${resource}/t` : '未获取'}</span>
      </div>`;
  }).join('');
  const adjacentRows = (area.adjacentAreaIds ?? [])
    .map(adjId => game.world.areas.get(adjId))
    .filter((adj): adj is AreaDef => !!adj)
    .map(adj => {
      const adjReveal = getAreaReveal(ctx, adj);
      return `<span class="info-tag">${ctx.escapeHtml(adjReveal.nameKnown ? adj.name : OBFUSCATED)}</span>`;
    })
    .join('');
  const spotSummary = spotRows || '<div class="info-dim">尚无设施</div>';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">AREA</span><strong>${ctx.escapeHtml(name)}</strong>${isCurrent ? '<span class="info-current">CURRENT</span>' : isLocked ? '<span class="info-lock">LOCKED</span>' : ''}</div>
      ${desc ? `<p class="info-desc">${ctx.escapeHtml(desc)}</p>` : ''}
      <div class="info-divider"></div>
      ${known ? `<div class="info-row"><span>所属世界线</span><span>${ctx.escapeHtml(ctx.nameOf('init', area.initId))}</span></div>` : ''}
      ${isLocked
        ? `<div class="info-row"><span>状态</span><span class="info-dim">尚未开放</span></div>
           <div class="info-row"><span>解锁条件</span><span>${renderConditionTree(buildConditionView(existenceCondition(area.revealTriggers), { nameOf: ctx.nameOf, formatNumber: ctx.formatNumber, style: 'ui', evaluate: condition => conditionMet(condition, ctx.game) }), ctx.escapeHtml, reveal.conditionKnown)}</span></div>`
        : known
          ? `<div class="info-row"><span>运营设施</span><span>${spotIds.length} 处 · ${spotIds.filter(id => (view.spotLevels[id] ?? 0) > 0).length} 已启用</span></div>
             <div class="info-sub">设施明细</div>
             <div class="info-spot-list">${spotSummary}</div>`
          : ''}
      <div class="info-divider"></div>
      <div class="info-row"><span>相邻区域</span></div>
      <div class="info-tags">${adjacentRows || '<span class="info-dim">无相邻区域</span>'}</div>
      ${renderRevealTriggers(ctx, area.revealTriggers, reveal.stage === 'owned')}
    </div>`;
}
