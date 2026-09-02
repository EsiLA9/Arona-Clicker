// ============================================================
// ui/components/tooltip-detail-item.ts — Item（背包物品）提示面板
// 从 tooltip.ts 拆出：renderItemDetail
// ============================================================

import type { ItemDef } from '../../data-services/contracts/item';
import { UIContext } from '../context';
import { renderRevealTriggers } from './tooltip-reveal';

/** 生成 Item（背包物品）的详情信息面板 HTML。 */
export function renderItemDetail(ctx: UIContext, item: ItemDef): string {
  const count = ctx.view.inventory[item.id] ?? 0;
  const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' }[item.rarity] ?? item.rarity;
  const typeLabel = { consumable: '消耗品', material: '材料', key: '关键道具' }[item.type] ?? item.type;

  const effectLines: string[] = [];
  if (item.useEffects?.length) {
    for (const ef of item.useEffects) {
      if (ef.op === 'addResource' || ef.op === 'setResource') {
        effectLines.push(`获得 ${ef.value ?? 0} ${ctx.nameOf('resource', ef.target)}`);
      } else if (ef.op === 'addItem') {
        effectLines.push(`获得 ${ef.target}`);
      } else if (ef.op === 'addEnhancement') {
        effectLines.push(`解锁强化 ${ef.target}`);
      } else {
        effectLines.push(ef.op);
      }
    }
  }
  const effectsText = effectLines.length
    ? `<div class="info-divider"></div><div class="info-row"><span>使用效果</span><span>${effectLines.map(l => ctx.escapeHtml(l)).join(' · ')}</span></div>`
    : '';

  const sellText = item.sellPrice
    ? `<div class="info-row"><span>售价</span><span>${ctx.formatNumber(item.sellPrice.amount)} ${ctx.nameOf('resource', item.sellPrice.resourceId)}</span></div>`
    : '';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">ITEM</span><strong>${ctx.escapeHtml(item.name)}</strong><span class="info-rarity info-rarity-${item.rarity}">${rarityLabel}</span></div>
      <p class="info-desc">${ctx.escapeHtml(item.description)}</p>
      <div class="info-divider"></div>
      <div class="info-row"><span>类型</span><span>${typeLabel}</span></div>
      <div class="info-row"><span>持有</span><span class="info-accent">${count}</span></div>
      <div class="info-row"><span>最大堆叠</span><span>${item.maxStack}</span></div>
      ${sellText}
      ${effectsText}
      ${item.type === 'consumable'
        ? `<div class="info-divider"></div><div class="info-row"><span>操作</span><span>右键使用</span></div>`
        : ''}
      ${renderRevealTriggers(ctx, item.revealTriggers, true)}
    </div>`;
}
