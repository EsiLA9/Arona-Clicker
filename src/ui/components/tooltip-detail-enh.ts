// ============================================================
// ui/components/tooltip-detail-enh.ts — Enhancement 提示面板
// 从 tooltip.ts 拆出：renderEnhancementDetail
// ============================================================

import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import { unlockCondition } from '../../engine/visibility/reveal';
import { describeAffectorPack } from '../../engine/effect/affector-text';
import { UIContext } from '../context';
import { conditionMet, getEnhancementReveal, OBFUSCATED, renderRevealTriggers } from './tooltip-reveal';
import { describeCondition } from './tooltip-enhancement';
import { buildConditionView, renderConditionTree } from '../condition-presentation';

/** 生成 Enhancement 的详情信息面板 HTML。 */
export function renderEnhancementDetail(ctx: UIContext, enh: EnhancementDef): string {
  const reveal = getEnhancementReveal(ctx, enh);
  const owned = reveal.stage === 'owned';
  const purchaseable = reveal.stage === 'purchaseable';
  const priceText = enh.price?.length
    ? enh.price.map(cost => `${ctx.formatNumber(cost.amount)} ${ctx.nameOf('resource', cost.resourceId)}`).join(' · ')
    : '无花费';

  // 按信息揭示阶梯遮挡：名称/解锁条件/效用 各自可见才展示，否则 ???。
  const name = reveal.nameKnown ? enh.name : OBFUSCATED;
  const desc = reveal.utilityKnown
    ? `<p class="info-desc">${ctx.escapeHtml(enh.description)}</p>`
    : '';
  const condText = renderConditionTree(buildConditionView(unlockCondition(enh.revealTriggers), {
    nameOf: ctx.nameOf, formatNumber: ctx.formatNumber, style: 'ui',
    evaluate: condition => conditionMet(condition, ctx.game),
  }), ctx.escapeHtml, reveal.conditionKnown);
  const priceRow = purchaseable || reveal.utilityKnown
    ? `<div class="info-row"><span>购买花费</span><span>${ctx.escapeHtml(priceText)}</span></div>`
    : '';
  const allZoneMods = (enh.affectorPackIds ?? []).flatMap(pid => {
    const pack = ctx.game.affectorEngine?.getPack(pid);
    return pack ? pack.entries.flatMap(e => e.zoneModifiers ?? []) : [];
  });
  const mulMods = allZoneMods.filter(z => z.category === 'mul');
  const multRow = reveal.utilityKnown && mulMods.length
    ? `<div class="info-row"><span>产出倍率</span><span class="info-accent">${mulMods.map(z => `×${(typeof z.value === 'number' ? z.value : 1).toFixed(2)}`).join(' · ')}</span></div>`
    : '';
  const scopeRow = reveal.utilityKnown && mulMods.length
    ? `<div class="info-row"><span>作用范围</span><span>${mulMods
        .map(z =>
          z.target.kind === 'tag'
            ? `${ctx.world.tagName(z.target.tag)} 类 Spot`
            : z.target.ref.id === '*'
            ? '全局'
            : ctx.nameOf(z.target.ref.kind, z.target.ref.id),
        )
        .join(' / ')}</span></div>`
    : '';

  const status = owned ? '已激活' : purchaseable ? '可购买' : '未解锁';
  // 挂载的 Affector Pack：通用展示文本（条件 + 效果逐条转译）
  const affectorSection = reveal.utilityKnown && enh.affectorPackIds?.length
    ? (() => {
        const lines = enh.affectorPackIds.flatMap(pid => {
          const pack = ctx.game.affectorEngine.getPack(pid);
          if (!pack) return [];
          return describeAffectorPack(pack, ctx.nameOf, {
            describeCondition: cond => describeCondition(cond, ctx.nameOf),
          });
        });
        if (lines.length === 0) return '';
        return `<div class="info-divider"></div><div class="info-sub">挂载效果（持有即持续生效）</div>${lines
          .map(line => `<div class="info-row"><span>${ctx.escapeHtml(line)}</span></div>`)
          .join('')}`;
      })()
    : '';
  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">ENHANCEMENT</span><strong>${ctx.escapeHtml(name)}</strong></div>
      ${desc}
      <div class="info-divider"></div>
      <div class="info-row"><span>状态</span><span class="${owned || purchaseable ? 'info-accent' : 'info-dim'}">${status}</span></div>
      <div class="info-row"><span>解锁条件</span><span>${condText}</span></div>
      ${priceRow}
      ${multRow}
      ${scopeRow}
      ${owned && enh.maxStacks ? `<div class="info-row"><span>最大叠加</span><span>${String(enh.maxStacks)}</span></div>` : ''}
      ${affectorSection}
      ${owned && enh.effects.length ? `<div class="info-row"><span>附带效果</span><span>${enh.effects.length} 项</span></div>` : ''}
      ${renderRevealTriggers(ctx, enh.revealTriggers, owned)}
    </div>`;
}
