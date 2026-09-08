import { UIContext } from '../context';
import { renderResourceStrip } from './header';
import { renderTabs, TabDef } from './tabs';
import { renderProductionNodes } from './production';
import { renderEnhancements } from './enhancements';
import { renderCharacterPanel } from './contacts';
import { describeAffectorPack } from '../../engine/effect/affector-text';
import { describeCondition } from './tooltip';
import { renderBackground } from '../background-service';

const RIGHT_TABS: TabDef[] = [
  { id: 'spot', label: '设施' },
  { id: 'character', label: '学生' },
  { id: 'enh', label: '强化' },
  { id: 'other', label: '其他' },
];

export function renderRightPanel(ctx: UIContext, activeTab: string, selectedVariantId: string | null = null): string {
  let body: string;
  if (activeTab === 'enh') {
    body = renderEnhancements(ctx);
  } else if (activeTab === 'other') {
    body = renderOtherTab(ctx);
  } else if (activeTab === 'character') {
    body = renderCharacterPanel(ctx, selectedVariantId);
  } else {
    body = renderProductionNodes(ctx);
  }
  return `
    <aside class="ui-cluster ui-cluster--right-panel panel right-panel presentation-host-target" data-theme-scope="right.${activeTab}" data-theme-host-id="rightPanel.${activeTab}" data-theme-state="default" data-theme-text-mode="${ctx.textColorModeForHost(`rightPanel.${activeTab}`)}">
      ${renderBackground(ctx.backgroundForHost(`rightPanel.${activeTab}`), 'console-panel-background')}
      ${renderResourceStrip(ctx)}
      ${renderTabs(ctx, 'right', RIGHT_TABS, activeTab)}
      <div class="ui-cluster ui-cluster--right-${activeTab} panel-body">${body}</div>
    </aside>`;
}

function renderOtherTab(ctx: UIContext): string {
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
    <div class="mini-panel-head"><span class="eyebrow">效果追踪</span></div>
    <div class="trace"><span class="trace-line"></span><p><b>基础生产</b><small>Spot output pipeline</small></p><span class="trace-value">READY</span></div>
    ${affectors}`;
}
