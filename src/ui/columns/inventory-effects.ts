import type { UIContext } from '../runtime/context';
import { describeAffectorPack } from '../../engine/effect/affector-text';
import { describeCondition } from '../components/tooltip/tooltip';

/** Existing compact inventory and Affector summary shown by Game's “其他” view. */
export function renderInventoryEffectsContent(ctx: UIContext): string {
  const { game, view } = ctx;
  const inventoryRows = Object.entries(view.inventory).length
    ? Object.entries(view.inventory).map(([itemId, count]) => {
        const item = game.registry.items.get(itemId);
        const useButton = item?.type === 'consumable'
          ? `<button class="use-item-button" data-use-item="${itemId}">使用</button>`
          : '';
        return `<li class="hover-wrap" data-tooltip="item:${itemId}"><span>${ctx.escapeHtml(item?.name ?? itemId)}</span><div class="inventory-actions">${useButton}<b>${count}</b></div></li>`;
      }).join('')
    : '<li class="empty">背包目前为空</li>';

  const affectorText = (packId: string): string => {
    const pack = game.affectorEngine.getPack(packId);
    if (!pack) return '';
    return describeAffectorPack(pack, ctx.nameOf, {
      describeCondition: cond => describeCondition(cond, ctx.nameOf),
    }).join('；');
  };
  const affectors = view.activeAffectors.length
    ? view.activeAffectors.map(instance => {
        const shortName = instance.packId.split(':').pop() ?? instance.packId;
        const detail = affectorText(instance.packId) || `${instance.mountEntityId} / ${instance.activeEntryIds.length} active`;
        return `
        <div class="trace"><span class="trace-line cyan"></span><p><b>${ctx.escapeHtml(shortName)}</b><small>${ctx.escapeHtml(detail)}</small></p><span class="trace-value">ACTIVE</span></div>`;
      }).join('')
    : '<div class="trace-empty">当前没有生效中的 Affector</div>';

  return `
    <div class="mini-panel-head"><span class="eyebrow">背包</span></div>
    <ul class="inventory-list">${inventoryRows}</ul>
    <button type="button" class="toolbar-button inventory-open-workspace" data-open-inventory>打开完整背包 ↗</button>
    <div class="mini-panel-head"><span class="eyebrow">效果追踪</span></div>
    <div class="trace"><span class="trace-line"></span><p><b>基础生产</b><small>Spot output pipeline</small></p><span class="trace-value">READY</span></div>
    ${affectors}`;
}
