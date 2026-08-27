// ============================================================
// ui/components/tooltip-detail-init.ts — Init（世界线）提示面板
// 从 tooltip.ts 拆出：renderInitDetail
// ============================================================

import { InitDef } from '../../engine/types';
import { UIContext } from '../context';
import { getInitReveal, OBFUSCATED, renderRevealTriggers } from './tooltip-reveal';

/** 生成 Init（世界线）的详情信息面板 HTML。 */
export function renderInitDetail(ctx: UIContext, init: InitDef): string {
  const reveal = getInitReveal(ctx, init);
  const owned = reveal.stage === 'owned';
  const purchaseable = reveal.stage === 'purchaseable';
  const isActive = ctx.view.activeInit === init.id;

  const name = reveal.nameKnown ? init.name : OBFUSCATED;
  const desc = reveal.utilityKnown
    ? `<p class="info-desc">${ctx.escapeHtml(init.description)}</p>`
    : '';

  const areas = ctx.game.registry.areasOfInit(init.id);
  const spotCount = areas.reduce(
    (sum, areaId) => sum + ctx.game.registry.spotsOfArea(areaId).length,
    0,
  );

  // 默认区域列表
  const defaultAreaNames = reveal.utilityKnown && init.defaultAreas.length
    ? init.defaultAreas
        .map(aid => {
          const area = ctx.game.registry.areas.get(aid);
          return area ? ctx.escapeHtml(area.name) : aid;
        })
        .join('、')
    : '';

  // 购买费用
  const costText = (init.purchaseCost ?? []).length
    ? (init.purchaseCost ?? []).map(c => `${ctx.formatNumber(c.amount)} ${ctx.nameOf('resource', c.resourceId)}`).join(' · ')
    : '免费';

  const statusText = isActive
    ? '当前世界线'
    : owned
      ? '已解锁'
      : purchaseable
        ? '可购买'
        : '未解锁';

  const statusClass = isActive || owned || purchaseable ? 'info-accent' : 'info-dim';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">INIT</span><strong>${ctx.escapeHtml(name)}</strong>${isActive ? '<span class="info-current">ACTIVE</span>' : ''}</div>
      ${desc}
      <div class="info-divider"></div>
      <div class="info-row"><span>状态</span><span class="${statusClass}">${statusText}</span></div>
      ${reveal.utilityKnown
        ? `<div class="info-row"><span>区域 / 设施</span><span>${areas.length} AREA · ${spotCount} SPOT</span></div>`
        : `<div class="info-row"><span>规模</span><span>${OBFUSCATED}</span></div>`}
      ${reveal.utilityKnown && defaultAreaNames
        ? `<div class="info-row"><span>默认区域</span><span>${defaultAreaNames}</span></div>`
        : ''}
      ${!owned
        ? `<div class="info-row"><span>解锁花费</span><span>${reveal.conditionKnown ? ctx.escapeHtml(costText) : OBFUSCATED}</span></div>`
        : ''}
      ${reveal.utilityKnown
        ? `<div class="info-divider"></div><div class="info-row"><span>进度</span><span>${owned ? '独立保存，随时可返回' : '尚未开始'}</span></div>`
        : ''}
      ${renderRevealTriggers(ctx, init.revealTriggers, owned)}
    </div>`;
}
