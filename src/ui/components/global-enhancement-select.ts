// ============================================================
// ui/components/global-enhancement-select.ts — GlobalEnhancement 选择投影
// 与 Init 共用节点图与右侧工作台；这里只输出只读摘要、节点呈现字段
// 与工作台详情。购买 / 停用仍由 controller-panels 绑定到 GameCommands。
// ============================================================

import type { RevealStage } from '../../engine/contracts/reveal';
import type { ResourceAmount } from '../../data-services/contracts/common';
import { UIContext } from '../context';
import { getEnhancementReveal } from './tooltip';
import { enhMultiplierLabel } from './enhancements';
import { projectSelectorTheme, selectorThemeStyle, type SelectorNodeState } from '../selector-theme';

export interface GlobalEnhancementSummary {
  id: string;
  name: string;
  description: string;
  stage: RevealStage;
  nameKnown: boolean;
  conditionKnown: boolean;
  utilityKnown: boolean;
  owned: boolean;
  /** 不可撤回：获得后禁止移除。 */
  irreversible: boolean;
  price: ResourceAmount[];
  /** 产出倍率展示文案（如 +100%（全局））。 */
  multiplierText: string;
  /** 条目局部主题树，图上节点与工作台共用。 */
  themeStyle: string;
}

function summarize(ctx: UIContext): GlobalEnhancementSummary[] {
  return [...ctx.game.registry.enhancements.values()]
    .filter(enh => enh.attachment?.kind === 'global')
    .map(enh => {
      const reveal = getEnhancementReveal(ctx, enh);
      return {
        id: enh.id,
        name: enh.name,
        description: enh.description,
        stage: reveal.stage,
        nameKnown: reveal.nameKnown,
        conditionKnown: reveal.conditionKnown,
        utilityKnown: reveal.utilityKnown,
        owned: reveal.stage === 'owned',
        irreversible: !!enh.irreversible,
        price: enh.price ?? [],
        multiplierText: enhMultiplierLabel(ctx, enh),
        themeStyle: selectorThemeStyle(projectSelectorTheme(ctx, 'global-enh', enh.id)),
      };
    });
}

/** 按成本升序排列的可见全局强化（invisible 不入列）。 */
export function visibleGlobalEnhancements(ctx: UIContext): GlobalEnhancementSummary[] {
  return summarize(ctx)
    .sort((a, b) => costOf(a) - costOf(b))
    .filter(enh => enh.stage !== 'invisible');
}

function costOf(enh: GlobalEnhancementSummary): number {
  return enh.price.reduce((sum, c) => sum + c.amount, 0);
}

function formatCost(ctx: UIContext, cost: ResourceAmount[]): string {
  if (cost.length === 0) return '免费';
  return cost.map(c => `${c.amount} ${ctx.nameOf('resource', c.resourceId)}`).join('、');
}

/** 节点标题：未揭示名称前只显示占位符。 */
export function enhancementDisplayName(enh: GlobalEnhancementSummary): string {
  return enh.nameKnown || enh.owned ? enh.name : '???';
}

export function enhancementNodeState(enh: GlobalEnhancementSummary): SelectorNodeState {
  if (enh.owned) return 'owned';
  if (enh.stage === 'purchaseable') return 'buyable';
  if (enh.stage === 'presence' || enh.stage === 'invisible') return 'fog';
  return 'locked';
}

export function enhancementStateLabel(enh: GlobalEnhancementSummary): string {
  if (enh.owned) return enh.irreversible ? 'ACTIVE · 已激活·不可撤回' : 'ACTIVE · 已激活';
  if (enh.stage === 'purchaseable') return 'BUYABLE · 可购买';
  if (enh.stage === 'presence') return 'FOG · 迷雾笼罩';
  return 'LOCKED · 未解锁';
}

/** 节点副标题：只披露效用已揭示时的产出倍率。 */
export function enhancementNodeMeta(enh: GlobalEnhancementSummary): string {
  if (enh.utilityKnown && enh.multiplierText) return enh.multiplierText;
  return enh.owned && enh.multiplierText ? enh.multiplierText : 'SCOPE GLOBAL';
}

function detailHtml(ctx: UIContext, enh: GlobalEnhancementSummary, showBackToGame: boolean): string {
  const priceText = enh.conditionKnown ? formatCost(ctx, enh.price) : '???';

  let desc = '这条全局强化尚被迷雾笼罩……';
  if (enh.owned || enh.utilityKnown) {
    desc = enh.description;
  } else if (enh.nameKnown) {
    desc = '这条全局强化的详情尚待揭示……';
  }

  const metaBits: string[] = [];
  if (enh.nameKnown || enh.owned) {
    metaBits.push('SCOPE GLOBAL');
    if (enh.utilityKnown && enh.multiplierText) metaBits.push(enh.multiplierText);
    if (enh.owned) metaBits.push('ACTIVE · 已激活');
    if (!enh.owned) metaBits.push(`COST ${priceText}`);
    metaBits.push(enh.irreversible ? 'IRREVERSIBLE' : 'HOT-PLUG');
  }

  const action = (() => {
    if (enh.owned) {
      if (enh.irreversible) {
        return `<span class="selector-detail-lock">已激活 · 不可撤回</span>`;
      }
      return `<button class="primary-button" data-global-enh-deactivate="${enh.id}">停用（可热插拔）<span>↗</span></button>`;
    }
    if (enh.stage === 'purchaseable') {
      return `<button class="primary-button" data-global-enh-purchase="${enh.id}">购买解锁 · ${ctx.escapeHtml(priceText)} <span>↗</span></button>`;
    }
    const label = enh.stage === 'presence' ? '条件未满足' : (enh.price.length === 0 ? '条件未满足' : `需要 ${ctx.escapeHtml(priceText)}`);
    return `<span class="selector-detail-lock">${label}</span>`;
  })();

  return `
    <div class="selector-detail" data-selector-detail data-selector-theme-key="enhancement:${enh.id}" style="${ctx.escapeHtml(enh.themeStyle)}">
      <span class="eyebrow">GLOBAL ENHANCEMENT / SCOPE</span>
      <span class="selector-detail-figure">GLOBAL · 全局作用域</span>
      <p>${ctx.escapeHtml(desc)}</p>
      ${metaBits.length ? `<div class="selector-detail-meta">${metaBits.map(b => `<span>${ctx.escapeHtml(b)}</span>`).join('')}</div>` : ''}
      <div class="selector-detail-actions">${action}</div>
      ${showBackToGame ? '<p class="selector-detail-note">强化改动即时生效；返回游戏继续当前世界线。</p>' : ''}
    </div>`;
}

/** 右侧工作台的全局强化详情，供整页渲染与节点刷新共用。 */
export function renderGlobalEnhancementDetail(
  ctx: UIContext,
  selectedId: string | null = null,
  showBackToGame = false,
): string {
  const list = visibleGlobalEnhancements(ctx);
  const selected = list.find(enh => enh.id === selectedId) ?? list[0];
  if (!selected) return '<div class="selector-detail selector-detail-empty"><p>暂无可选的全局强化。</p></div>';
  return detailHtml(ctx, selected, showBackToGame);
}
