// ============================================================
// ui/components/tooltip-detail-spot.ts — Spot 提示面板
// 从 tooltip.ts 拆出：renderSpotDetail
// ============================================================

import { Character, SpotDef } from '../../engine/types';
import { existenceCondition, unlockCondition } from '../../engine/visibility/reveal';
import { UIContext } from '../context';
import { getSpotReveal, OBFUSCATED, renderRevealTriggers } from './tooltip-reveal';
import { describeCondition, getSpotYieldBreakdown } from './tooltip-enhancement';

/** 生成 Spot 的详情信息面板 HTML。 */
export function renderSpotDetail(ctx: UIContext, spot: SpotDef, level: number): string {
  const { game, view } = ctx;
  const reveal = getSpotReveal(ctx, spot);
  const owned = reveal.stage === 'owned';
  const known = reveal.utilityKnown;   // 效用已揭示才展示运行数值
  const show = (k: boolean, text: string): string => (k ? text : OBFUSCATED);
  const yieldInfo = getSpotYieldBreakdown(ctx, spot);
  const resource = ctx.nameOf('resource', spot.baseYieldResource);
  const manager = view.spotManagers[spot.id] ?? Character.None;
  const managerName = ctx.nameOf('character', manager);

  // 下一级升级信息（通用升级：指数花费；否则 levelUpgrades 逐级）
  const nextLevel = level + 1;
  const maxLevel = game.spot.getEffectiveMaxLevel(spot.id);
  const capped = maxLevel !== undefined && nextLevel > maxLevel;

  const upgradeCostText: string | null = capped
    ? null
    : (() => {
        // 优先用 levelUpgrades 的显式 cost
        const nextUpgrade = (spot.levelUpgrades ?? []).find(u => u.level === nextLevel);
        if (nextUpgrade?.cost !== undefined) {
          return ctx.formatNumber(game.valueSystem.evaluate(nextUpgrade.cost, game.state));
        }
        // 通用公式
        if (spot.upgradeCostBase !== undefined) {
          return ctx.formatNumber(Math.floor(spot.upgradeCostBase * Math.pow(spot.upgradeCostGrowth ?? 1, nextLevel - 1)));
        }
        // 无下一级定义
        if (nextUpgrade) return null;
        return null;
      })();

  const nextUpgradeDef = (spot.levelUpgrades ?? []).find(u => u.level === nextLevel);
  const upgradeRow = !known
    ? `<div class="info-row"><span>升级</span><span>${OBFUSCATED}</span></div>`
    : upgradeCostText !== null
      ? `<div class="info-row"><span>升级 Lv.${nextLevel}</span><span>${upgradeCostText} ${ctx.nameOf('resource', spot.baseCostResource)}${nextUpgradeDef?.condition ? ' · 需条件' : ''}</span></div>`
      : `<div class="info-row"><span>升级</span><span class="info-dim">${capped ? `已达上限 Lv.${maxLevel}` : '已达当前上限'}</span></div>`;

  const managerBonusRow = !known || manager === Character.None
    ? ''
    : `<div class="info-row"><span>Manager 加成</span><span>+${ctx.formatNumber(yieldInfo.managerBonus)} · ×${yieldInfo.tagMultiplier.toFixed(2)}</span></div>`;

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
  const condText = reveal.conditionKnown
    ? describeCondition(unlockCondition(spot.revealTriggers) ?? existenceCondition(spot.revealTriggers), ctx.nameOf)
    : OBFUSCATED;

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">SPOT</span><strong>${ctx.escapeHtml(name)}</strong></div>
      ${desc}
      <div class="info-divider"></div>
      ${owned ? '' : `<div class="info-row"><span>获取条件</span><span>${ctx.escapeHtml(condText)}</span></div>`}
      <div class="info-row"><span>当前等级</span><span class="info-accent">${show(known, `Lv.${level}`)}</span></div>
      <div class="info-row"><span>基础产出</span><span>${show(known, `${ctx.formatNumber(yieldInfo.base)} ${resource} / tick`)}</span></div>
      ${managerBonusRow}
      <div class="info-row"><span>强化倍率</span><span>${show(known, `×${yieldInfo.enhMultiplier.toFixed(2)}${yieldInfo.enhMultiplier === 1 ? '（未获得）' : ''}`)}</span></div>
      <div class="info-row"><span>实际入账</span><span class="info-accent">${show(known, `${ctx.formatNumber(yieldInfo.total)} ${resource} / tick`)}</span></div>
      ${funcRows}
      <div class="info-row"><span>容量上限</span><span>${show(known, spot.baseCapacity > 0 ? ctx.formatNumber(spot.baseCapacity) : '无限制')}</span></div>
      ${upgradeRow}
      ${maxLevel !== undefined ? `<div class="info-row"><span>等级上限</span><span class="info-dim">Lv.${maxLevel}</span></div>` : ''}
      <div class="info-row"><span>Manager</span><span>${ctx.escapeHtml(managerName)}</span></div>
      <div class="info-divider"></div>
      <div class="info-tags">${known ? ctx.game.registry.effectiveSpotTags(spot.id, ctx.game.state.spotTagOverrides).map(tag => {
        const name = ctx.game.registry.tagName(tag);
        const desc = ctx.game.registry.tagDescription(tag);
        const tip = desc ? ` title="${ctx.escapeHtml(desc)}"` : '';
        return `<span class="info-tag"${tip}>${ctx.escapeHtml(name)}</span>`;
      }).join('') : ''}</div>
      ${renderRevealTriggers(ctx, spot.revealTriggers, owned)}
    </div>`;
}
