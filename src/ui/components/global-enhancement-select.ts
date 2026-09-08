// ============================================================
// ui/components/global-enhancement-select.ts — 全局强化选择界面
// 与 Init 选择页共用同一巨大圆盘，但朝向相反（镜像）：
// Init 盘在左、聚焦正右方、详情在左；GlobalEnhancement 盘在右、
// 聚焦正左方、详情在右。由顶栏翻面按钮在两面间切换。
// ============================================================

import type { RevealStage } from '../../engine/contracts/reveal';
import type { ResourceAmount } from '../../data-services/contracts/common';
import { UIContext } from '../context';
import { getEnhancementReveal } from './tooltip';
import { enhMultiplierLabel } from './enhancements';
import { projectSelectorTheme, selectorThemeStyle } from '../selector-theme';

/** 选择页朝向：'init' = 世界线面；'global-enh' = 全局强化面。 */
export type SelectionFace = 'init' | 'global-enh';

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
  /** 条目局部主题树，轮盘卡片与详情共用。 */
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

function rowStatus(enh: GlobalEnhancementSummary): string {
  if (enh.owned) return enh.irreversible ? 'ACTIVE · 已激活·不可撤回' : 'ACTIVE · 已激活';
  if (enh.stage === 'purchaseable') return 'BUYABLE · 可购买';
  if (enh.stage === 'presence') return 'FOG · 迷雾笼罩';
  return 'LOCKED · 未解锁';
}

function rowHtml(ctx: UIContext, enh: GlobalEnhancementSummary): string {
  const classes = ['init-row', 'enh-row'];
  if (!enh.owned && enh.stage !== 'purchaseable') classes.push('is-locked');
  const name = enh.nameKnown || enh.owned ? enh.name : '???';
  const tilt = enh.utilityKnown && enh.multiplierText ? enh.multiplierText : (enh.owned ? enh.multiplierText || '—' : '???');
  return `
    <button class="${classes.join(' ')}" data-global-enh-select="${enh.id}" data-selector-theme-key="enhancement:${enh.id}" style="${ctx.escapeHtml(enh.themeStyle)}" data-tooltip="enh:${enh.id}">
      <span class="init-row-main">
        <strong>${ctx.escapeHtml(name)}</strong>
        <small>${rowStatus(enh)}</small>
      </span>
      <span class="init-row-tilt">${ctx.escapeHtml(tilt)}</span>
    </button>`;
}

function detailHtml(ctx: UIContext, enh: GlobalEnhancementSummary, showBackToGame: boolean): string {
  const priceText = enh.conditionKnown ? formatCost(ctx, enh.price) : '???';

  let name = '???';
  let desc = '这条全局强化尚被迷雾笼罩……';
  if (enh.owned || enh.utilityKnown) {
    name = enh.name;
    desc = enh.description;
  } else if (enh.nameKnown) {
    name = enh.name;
    desc = '这条全局强化的详情尚待揭示……';
  }

  const metaBits: string[] = [];
  if (enh.nameKnown || enh.owned) {
    metaBits.push(`SCOPE GLOBAL`);
    if (enh.utilityKnown && enh.multiplierText) metaBits.push(enh.multiplierText);
    if (enh.owned) metaBits.push('ACTIVE · 已激活');
    if (!enh.owned) metaBits.push(`COST ${priceText}`);
    metaBits.push(enh.irreversible ? 'IRREVERSIBLE' : 'HOT-PLUG');
  }

  const action = (() => {
    if (enh.owned) {
      if (enh.irreversible) {
        return `<span class="orb-lock">已激活 · 不可撤回</span>`;
      }
      return `<button class="primary-button" data-global-enh-deactivate="${enh.id}">停用（可热插拔）<span>↗</span></button>`;
    }
    if (enh.stage === 'purchaseable') {
      return `<button class="primary-button" data-global-enh-purchase="${enh.id}">购买解锁 · ${ctx.escapeHtml(priceText)} <span>↗</span></button>`;
    }
    const label = enh.stage === 'presence' ? '条件未满足' : (enh.price.length === 0 ? '条件未满足' : `需要 ${ctx.escapeHtml(priceText)}`);
    return `<span class="orb-lock">${label}</span>`;
  })();

  return `
    <div class="init-orb-copy enh-orb-copy" data-selector-theme-key="enhancement:${enh.id}" style="${ctx.escapeHtml(enh.themeStyle)}">
      <span class="eyebrow">GLOBAL ENHANCEMENT / SCOPE</span>
      <span class="orb-big">GLOBAL · 全局作用域</span>
      <h2>${ctx.escapeHtml(name)}</h2>
      <p>${ctx.escapeHtml(desc)}</p>
      ${metaBits.length ? `<div class="orb-meta">${metaBits.map(b => `<span>${ctx.escapeHtml(b)}</span>`).join('')}</div>` : ''}
      <div class="orb-actions">${action}</div>
      ${showBackToGame ? '<p class="orb-note">强化改动即时生效；返回游戏继续当前世界线。</p>' : ''}
    </div>`;
}

/** 右侧详情（镜像面坐在右盘弧上），供整页渲染与轮盘切换局部刷新共用。 */
export function renderGlobalEnhancementDetail(
  ctx: UIContext,
  selectedId: string | null = null,
  showBackToGame = false,
): string {
  const list = visibleGlobalEnhancements(ctx);
  const selected = list.find(enh => enh.id === selectedId) ?? list[0];
  if (!selected) return '<div class="init-orb-copy enh-orb-copy"><p>暂无可选的全局强化。</p></div>';
  return detailHtml(ctx, selected, showBackToGame);
}

/** 单张轮盘卡片，供购买/停用后的局部替换（避免整页重渲染）。 */
export function renderGlobalEnhancementRow(ctx: UIContext, enhId: string): string | null {
  const enh = visibleGlobalEnhancements(ctx).find(summary => summary.id === enhId);
  return enh ? rowHtml(ctx, enh) : null;
}
