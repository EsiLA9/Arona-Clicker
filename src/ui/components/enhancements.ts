import { UIContext } from '../context';
import { getEnhancementReveal, describeCondition } from './tooltip';
import { tagDisplay } from '../../engine/tag';
import { unlockCondition } from '../../engine/reveal';
import { EnhancementDef } from '../../engine/types';

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
  // 已购买的 enhancement 收入管理弹窗，此处不再显示；挂靠（仅 UI 位置）过滤可购项
  const visibleHere = (enh: EnhancementDef): boolean => {
    const att = enh.attachment;
    if (!att || att.kind === 'global') return true;
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
    const multiplierText = enh.productionMultiplier
      ? `×${ctx.formatNumber(enh.productionMultiplier * 100)}${enh.productionTags?.length ? `（${enh.productionTags.map(tagDisplay).join('/')}）` : ''}`
      : '';
    const utilityText = reveal.utilityKnown ? (multiplierText || '—') : HIDDEN_TEXT;
    const priceText = enh.price?.length
      ? enh.price.map(cost => `${ctx.formatNumber(cost.amount)} ${ctx.nameOf('resource', cost.resourceId)}`).join(' · ')
      : '无花费';
    const description = reveal.utilityKnown
      ? `<p>${ctx.escapeHtml(enh.description)}</p>`
      : '';

    return `
      <article class="mini-card hover-wrap" data-tooltip="enh:${enh.id}">
        <div class="mini-card-head">
          <span class="mini-eyebrow">ENHANCEMENT</span>
          <strong>${purchaseable ? '可购买' : '未解锁'}</strong>
        </div>
        <h3>${ctx.escapeHtml(title)}</h3>
        ${description}
        <div class="mini-card-foot">
          <span class="mini-yield">${ctx.escapeHtml(utilityText)}</span>
          ${purchaseable
            ? `<button data-purchase-enh="${enh.id}">购买 ${priceText} <span>↗</span></button>`
            : ''}
        </div>
        <small class="mini-note">解锁条件：${ctx.escapeHtml(condText)}</small>
      </article>`;
  }).join('');

  const ownedCount = [...game.registry.enhancements.values()]
    .filter(enh => view.unlockedEnhancements.includes(enh.id)).length;
  return `
    <div class="mini-panel-head"><span class="eyebrow">强化系统</span><span class="count">${ownedCount} OWNED</span></div>
    ${cards ? `<div class="mini-card-grid">${cards}</div>` : '<div class="empty">当前区域无可购买的强化</div>'}
    ${ownedCount > 0
      ? `<button class="manager-entry" data-open-enh-manager>管理已购买强化（${ownedCount}）<span>↗</span></button>`
      : ''}`;
}

/** 弹窗内容：当前游戏已购买的 Enhancement 列表（与购买面板同构的 mini-card，查看 + 移除管理）。 */
export function renderEnhancementManager(ctx: UIContext): string {
  const { game, view } = ctx;
  const owned = [...game.registry.enhancements.values()]
    .filter(enh => view.unlockedEnhancements.includes(enh.id));
  if (owned.length === 0) {
    return '<p class="info-dim">当前游戏尚未获得任何强化。在强化面板购买后，会自动收纳到这里。</p>';
  }
  const cards = owned.map(enh => {
    const multiplier = enh.productionMultiplier
      ? `×${enh.productionMultiplier.toFixed(2)}${enh.productionTags?.length ? `（${enh.productionTags.map(tagDisplay).join('/')}）` : ''}`
      : '';
    return `
      <article class="mini-card owned">
        <div class="mini-card-head">
          <span class="mini-eyebrow">ENHANCEMENT</span>
          <strong class="owned-tag">已激活</strong>
        </div>
        <h3>${ctx.escapeHtml(enh.name)}</h3>
        <p>${ctx.escapeHtml(enh.description)}</p>
        <div class="mini-card-foot">
          <span class="mini-yield">${ctx.escapeHtml(multiplier || '—')} · ${ctx.escapeHtml(attachLabel(ctx, enh))}</span>
          <button class="toolbar-button" data-remove-enh="${enh.id}" title="从当前游戏移除该强化">移除</button>
        </div>
      </article>`;
  }).join('');
  return `<div class="mini-card-grid">${cards}</div>`;
}
