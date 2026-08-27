import { UIContext } from '../context';
import { getEnhancementReveal, describeCondition } from './tooltip';
import { unlockCondition } from '../../engine/visibility/reveal';
import { EnhancementDef, AffectorPackDef } from '../../engine/types';

/** 从 Enhancement 挂载的 Affector 包派生其产出倍率展示文案（统一 zone 模型）。 */
export function enhMultiplierLabel(ctx: UIContext, enh: EnhancementDef): string {
  const packs = (enh.affectorPackIds ?? [])
    .map(pid => ctx.game.affectorEngine.getPack(pid))
    .filter((p): p is AffectorPackDef => !!p);
  for (const pack of packs) {
    for (const entry of pack.entries) {
      for (const z of entry.zoneModifiers ?? []) {
        if (z.category !== 'mul') continue;
        const val = typeof z.value === 'number' ? z.value : 0;
        if (z.target.kind === 'entity' && z.target.ref.id === '*') {
          return `+${((val - 1) * 100).toFixed(0)}%（全局）`;
        }
        if (z.target.kind === 'tag') {
          return `+${((val - 1) * 100).toFixed(0)}%（${ctx.game.registry.tagName(z.target.tag)}）`;
        }
      }
    }
  }
  return '';
}

/** 挂靠展示文案（管理弹窗内"查看"用）。 */
function attachLabel(ctx: UIContext, enh: EnhancementDef): string {
  const att = enh.attachment;
  if (!att) return '贯穿游戏';
  switch (att.kind) {
    case 'area': return `挂靠：${ctx.nameOf('area', att.areaId)}`;
    case 'init': return `挂靠：${ctx.nameOf('init', att.initId)}`;
    case 'global': return '贯穿游戏';
  }
}

/** 信息揭示占位。 */
const HIDDEN_TEXT = '???';

export function renderEnhancements(ctx: UIContext): string {
  const { game, view } = ctx;
  const registry = game.registry;
  // 已购买的 enhancement 收入管理弹窗，此处不再显示；挂靠（仅 UI 位置）过滤可购项。
  // global 挂靠强化只在「全局强化选择页」购买/管理，不在右侧面板出现。
  const visibleHere = (enh: EnhancementDef): boolean => {
    const att = enh.attachment;
    if (att?.kind === 'global') return false;
    if (!att) return true;
    if (att.kind === 'init') return view.activeInit === att.initId;
    return view.currentAreaId === att.areaId;
  };
  const cards = [...game.registry.enhancements.values()].map(enh => {
    const reveal = getEnhancementReveal(ctx, enh);
    if (reveal.stage === 'invisible' || reveal.stage === 'owned' || !visibleHere(enh)) return '';
    const purchaseable = reveal.stage === 'purchaseable';

    // 按揭示阶梯遮挡信息
    const title = reveal.nameKnown ? enh.name : HIDDEN_TEXT;
    const unlock = unlockCondition(enh.revealTriggers);
    const condText = reveal.conditionKnown
      ? (unlock ? describeCondition(unlock, ctx.nameOf) : '无前置条件')
      : HIDDEN_TEXT;
    const multiplierText = enhMultiplierLabel(ctx, enh);
    const utilityText = reveal.utilityKnown ? (multiplierText || '—') : HIDDEN_TEXT;
    const priceText = enh.price?.length
      ? enh.price.map(cost => `${ctx.formatNumber(cost.amount)} ${ctx.nameOf('resource', cost.resourceId)}`).join(' · ')
      : '无花费';
    const description = reveal.utilityKnown
      ? `<p>${ctx.escapeHtml(enh.description)}</p>`
      : '';
    return `
      <article class="mini-card hover-wrap" data-tooltip="enh:${enh.id}">
        <div class="mini-card-title-row">
          <h3 class="mini-card-title">${ctx.escapeHtml(title)}</h3>
          <strong class="mini-status">${purchaseable ? '可购买' : '未解锁'}</strong>
        </div>
        ${description}
        <div class="mini-card-foot">
          <span class="mini-yield">${ctx.escapeHtml(utilityText)}</span>
          <div class="mini-actions">
            ${purchaseable
              ? `<button class="mini-action" data-purchase-enh="${enh.id}">购买 ${priceText} <span>↗</span></button>`
              : ''}
          </div>
        </div>
        <small class="mini-note">条件：${ctx.escapeHtml(condText)}</small>
      </article>`;
  }).join('');

  const ownedCount = [...game.registry.enhancements.values()]
    .filter(enh => view.unlockedEnhancements.includes(enh.id)).length;
  const globalEnhs = [...game.registry.enhancements.values()]
    .filter(enh => enh.attachment?.kind === 'global');
  const globalOwned = globalEnhs.filter(enh => view.unlockedEnhancements.includes(enh.id)).length;
  return `
    <div class="mini-panel-head"><span class="eyebrow">强化系统</span><span class="count">${ownedCount} OWNED</span></div>
    ${cards ? `<div class="mini-card-grid">${cards}</div>` : '<div class="empty">当前区域无可购买的强化</div>'}
    ${ownedCount > 0
      ? `<button class="manager-entry" data-open-enh-manager>管理已购买强化（${ownedCount}）<span>↗</span></button>`
      : ''}
    ${globalEnhs.length > 0
      ? `<button class="manager-entry" data-open-global-enh-select>全局强化选择（已装 ${globalOwned}/${globalEnhs.length}）<span>⇄</span></button>`
      : ''}`;
}

/** 弹窗内容：当前游戏已购买的 Enhancement 列表（与购买面板同构的 mini-card，查看 + 移除管理）。 */
export function renderEnhancementManager(ctx: UIContext): string {
  const { game, view } = ctx;
  const registry = game.registry;
  const owned = [...game.registry.enhancements.values()]
    .filter(enh => view.unlockedEnhancements.includes(enh.id) && enh.attachment?.kind !== 'global');
  if (owned.length === 0) {
    return '<p class="info-dim">当前游戏尚未获得任何强化。在强化面板购买后，会自动收纳到这里。</p>';
  }
  const cards = owned.map(enh => {
    const multiplier = enhMultiplierLabel(ctx, enh);
    return `
      <article class="mini-card hover-wrap owned">
        <div class="mini-card-title-row">
          <h3 class="mini-card-title">${ctx.escapeHtml(enh.name)}</h3>
          <strong class="mini-status owned-tag">已激活</strong>
        </div>
        <p>${ctx.escapeHtml(enh.description)}</p>
        <div class="mini-card-foot">
          <span class="mini-yield">${ctx.escapeHtml(multiplier || '—')} · ${ctx.escapeHtml(attachLabel(ctx, enh))}</span>
          <div class="mini-actions">
            <button class="mini-action" data-remove-enh="${enh.id}" title="从当前游戏移除该强化">移除</button>
          </div>
        </div>
      </article>`;
  }).join('');
  return `<div class="mini-card-grid">${cards}</div>`;
}
