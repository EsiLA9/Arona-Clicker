// ============================================================
// ui/components/tooltip-detail-spot.ts — Spot 提示面板
// 从 tooltip.ts 拆出：renderSpotDetail
// ============================================================

import { Character } from '../../arona-clicker/types/ids';
import type { SpotDef } from '../../data-services/contracts/world';
import { existenceCondition, unlockCondition } from '../../engine/visibility/reveal';
import { UIContext } from '../context';
import { conditionMet, getSpotReveal, OBFUSCATED, renderRevealTriggers } from './tooltip-reveal';
import { describeCondition, getSpotYieldBreakdown } from './tooltip-enhancement';
import { buildConditionView, renderConditionTree } from '../condition-presentation';

function paymentText(ctx: UIContext, options: ReturnType<UIContext['game']['spot']['getPaymentOptions']>): string {
  return options.map(option => {
    const costs = option.costs.length > 0
      ? option.costs.map(cost => `${ctx.formatNumber(cost.required)} ${ctx.nameOf(cost.type, cost.id)}`).join(' + ')
      : '免费';
    return options.length > 1 ? `${option.label}：${costs}` : costs;
  }).join(' / ');
}

/** 生成 Spot 的详情信息面板 HTML。 */
export function renderSpotDetail(ctx: UIContext, spot: SpotDef, level: number): string {
  const { game, view } = ctx;
  const reveal = getSpotReveal(ctx, spot);
  const owned = reveal.stage === 'owned';
  const known = reveal.utilityKnown;   // 效用已揭示才展示运行数值
  const show = (k: boolean, text: string): string => (k ? text : OBFUSCATED);
  const yieldInfo = getSpotYieldBreakdown(ctx, spot);
  const yieldRows = yieldInfo.outputs.length > 0
    ? yieldInfo.outputs.map(output => `${ctx.formatNumber(output.amount)} ${ctx.nameOf('resource', output.resource)} / tick`).join('、')
    : '无持续产出';
  const manager = view.spotManagers[spot.id] ?? Character.None;
  const managerName = ctx.nameOf('character', manager);

  // 下一级升级信息：只读取当前等级条目的显式支付方案。
  const nextLevel = level + 1;
  const maxLevel = game.spot.getEffectiveMaxLevel(spot.id);
  const capped = maxLevel !== undefined && nextLevel > maxLevel;

  const nextUpgradeDef = (spot.levelUpgrades ?? []).find(u => u.level === nextLevel);
  const registeredSpot = game.registry.spots.get(spot.id);
  const upgradeOptions = !capped && known && registeredSpot ? game.spot.getPaymentOptions(spot.id, 'upgrade') : [];
  const upgradeCostText = upgradeOptions.length > 0
    ? paymentText(ctx, upgradeOptions)
    : null;
  const upgradeRow = !known
    ? `<div class="info-row"><span>升级</span><span>${OBFUSCATED}</span></div>`
      : upgradeCostText !== null
      ? `<div class="info-row"><span>升级 Lv.${nextLevel}</span><span>${ctx.escapeHtml(upgradeCostText)}${nextUpgradeDef?.condition ? ' · 需条件' : ''}</span></div>`
      : `<div class="info-row"><span>升级</span><span class="info-dim">${capped ? `已达上限 Lv.${maxLevel}` : '已达当前上限'}</span></div>`;

  // Spot 功能（内源 + 外源）：线性产出 / 交互型功能；未揭示时遮挡。
  const funcRows = !known
    ? ''
    : game.spotFunctionalitySystem.functionalitiesOf(spot, game.state).map(fn => {
      if (fn.kind === 'linearYield') {
        const perLevel = `每级 +${ctx.formatNumber(fn.amountPerLevel ?? 0)} ${ctx.nameOf('resource', fn.resource ?? '')}`;
        const active = fn.condition && !game.conditionSystem.evaluateGroup(fn.condition, game.state)
          ? '（未生效）'
          : '';
        const cond = fn.condition
          ? ` · 条件：${ctx.escapeHtml(describeCondition(fn.condition, ctx.nameOf))}`
          : '';
        return `<div class="info-row"><span>功能</span><span>${ctx.escapeHtml(perLevel)}${cond}${active}</span></div>`;
      }
      if (fn.kind === 'restartInit') {
        return `<div class="info-row"><span>功能</span><span class="info-accent">结束当前游戏 · 重选世界线</span></div>`;
      }
      if (fn.kind === 'hardResetInit') {
        return `<div class="info-row"><span>功能</span><span class="info-warn">彻底重置当前世界线 · 下次进入为崭新</span></div>`;
      }
      return '';
    }).join('');

  const name = reveal.nameKnown ? spot.name : OBFUSCATED;
  const desc = known
    ? `<p class="info-desc">${ctx.escapeHtml(spot.description)}</p>`
    : '';
  const acquisitionCondition = unlockCondition(spot.revealTriggers) ?? existenceCondition(spot.revealTriggers);
  const condText = renderConditionTree(buildConditionView(acquisitionCondition, {
    nameOf: ctx.nameOf, formatNumber: ctx.formatNumber, style: 'ui',
    evaluate: condition => conditionMet(condition, ctx.game),
  }), ctx.escapeHtml, reveal.conditionKnown);
  const acquisitionOptions = known && registeredSpot ? game.spot.getPaymentOptions(spot.id, 'unlock') : [];
  const noPurchaseRoute = known && registeredSpot?.purchaseOptions.length === 0;
  const costText = acquisitionOptions.length > 0
    ? `花费 ${paymentText(ctx, acquisitionOptions)}`
    : noPurchaseRoute ? '无购买途径' : '';
  const acquisitionText = acquisitionCondition
    ? `${condText}${costText ? ` · ${ctx.escapeHtml(costText)}` : ''}`
    : costText || condText;

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">SPOT</span><strong>${ctx.escapeHtml(name)}</strong></div>
      ${desc}
      <div class="info-divider"></div>
      ${owned ? '' : `<div class="info-row"><span>获取条件</span><span>${acquisitionText}</span></div>`}
      <div class="info-row"><span>当前等级</span><span class="info-accent">${show(known, `Lv.${level}`)}</span></div>
      <div class="info-row"><span>持续产出</span><span>${show(known, yieldRows)}</span></div>
      ${funcRows}
      ${upgradeRow}
      ${maxLevel !== undefined ? `<div class="info-row"><span>等级上限</span><span class="info-dim">Lv.${maxLevel}</span></div>` : ''}
      <div class="info-row"><span>Manager</span><span>${ctx.escapeHtml(managerName)}</span></div>
      <div class="info-divider"></div>
      <div class="info-tags">${known ? ctx.world.effectiveSpotTags(spot.id, ctx.game.state.spotTagOverrides).map(tag => {
        const name = ctx.world.tagNameForSpotTag?.(spot.id, tag) ?? ctx.world.tagName(tag);
        const desc = ctx.world.tagDescriptionForSpotTag?.(spot.id, tag) ?? ctx.world.tagDescription(tag);
        const tip = desc ? ` title="${ctx.escapeHtml(desc)}"` : '';
        return `<span class="info-tag"${tip}>${ctx.escapeHtml(name)}</span>`;
      }).join('') : ''}</div>
      ${renderRevealTriggers(ctx, spot.revealTriggers, owned)}
    </div>`;
}
