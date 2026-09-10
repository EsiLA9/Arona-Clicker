import type { UIContext } from '../context';
import type { ShopWorkspaceState } from './app-shell';
import { renderResourceStrip } from './header';
import { renderWorkspaceFrame } from './workspace-frame';
import { renderUIHost } from '../presentation-service';

interface ShopWorkspaceView {
  shop: any;
  entries: string;
  feed: string;
  cart: string;
  costs: string;
  canCheckout: boolean;
}

function buildView(ctx: UIContext, workspace: ShopWorkspaceState): ShopWorkspaceView | null {
  const shop = ctx.game.registry.shops.get(workspace.shopId);
  if (!shop) return null;
  const cart = workspace.session.lines();
  const preview = ctx.game.shopService.preview(workspace.shopId, cart);
  const entryCard = (entry: typeof shop.entries[number]) => {
    const availability = ctx.game.shopService.availability(workspace.shopId, workspace.spotId, entry.id);
    if (!availability || availability.status === 'hidden') return '';
    const count = cart.find(line => line.entryId === entry.id)?.quantity ?? 0;
    const disabled = availability.status !== 'available';
    const status = availability.status === 'sold-out' ? '售罄' : availability.status === 'locked' ? '未满足条件' : '可购买';
    const remaining = availability.stockRemaining === null ? '库存不限' : `余量 ${availability.stockRemaining}`;
    const unitPreview = ctx.game.shopService.preview(workspace.shopId, [{ entryId: entry.id, quantity: 1 }]);
    const price = Object.entries(unitPreview?.resourceCosts ?? {}).map(([id, amount]) => `${ctx.formatNumber(amount)} ${ctx.escapeHtml(ctx.nameOf('resource', id))}`).join(' · ')
      || Object.entries(unitPreview?.itemCosts ?? {}).map(([id, amount]) => `${ctx.formatNumber(amount)} ${ctx.escapeHtml(ctx.nameOf('item', id))}`).join(' · ')
      || '无消耗';
    return `<article class="mini-card shop-product-card ${disabled ? 'closed' : ''}"><div class="mini-card-title-row"><strong class="mini-card-title">${ctx.escapeHtml(entry.name)}</strong><small class="mini-status">${status}</small></div><div class="shop-product-card__price">${price}</div><div class="shop-product-card__meta"><span>${remaining}</span>${count ? `<span>已选 ${count}</span>` : ''}</div><button class="mini-action shop-product-card__action" data-shop-select="${ctx.escapeHtml(entry.id)}" ${disabled ? 'disabled' : ''}>选择</button></article>`;
  };
  const sections = (shop.sections ?? []).map(section => {
    if (section.condition && !ctx.game.conditionSystem.evaluateGroup(section.condition, ctx.game.state)) return '';
    const entries = shop.entries.filter(entry => entry.sectionId === section.id).map(entryCard).join('');
    return entries ? `<section class="shop-workspace__section"><header><h3>${ctx.escapeHtml(section.name)}</h3>${section.description ? `<p>${ctx.escapeHtml(section.description)}</p>` : ''}</header>${entries}</section>` : '';
  }).join('');
  const unsectioned = shop.entries.filter(entry => !entry.sectionId).map(entryCard).join('');
  const entries = sections || unsectioned ? `${sections}${unsectioned ? `<section class="shop-workspace__section">${unsectioned}</section>` : ''}` : '<p class="modal-empty">暂无可见商品。</p>';
  const costs = Object.entries(preview?.resourceCosts ?? {}).map(([id, amount]) => `${ctx.escapeHtml(id)} × ${ctx.formatNumber(amount)}`).join('，') || Object.entries(preview?.itemCosts ?? {}).map(([id, amount]) => `${ctx.escapeHtml(id)} × ${ctx.formatNumber(amount)}`).join('，') || '无';
  const cartRows = cart.map(line => `<li><span>${ctx.escapeHtml(shop.entries.find(entry => entry.id === line.entryId)?.name ?? line.entryId)}</span><span>× ${line.quantity}</span></li>`).join('') || '<li>购物车为空</li>';
  const feed = workspace.feed.slice(-8).map(item => `<li class="shop-feed-${item.kind}">${ctx.escapeHtml(item.text)}</li>`).join('') || '<li>欢迎光临。</li>';
  return { shop, entries, feed, cart: cartRows, costs, canCheckout: cart.length > 0 };
}

export function renderShopWorkspace(ctx: UIContext, workspace: ShopWorkspaceState): string {
  const view = buildView(ctx, workspace);
  const shopTabs = (panel: 'left' | 'center' | 'right', content: string) => renderUIHost(ctx, { hostId: `${panel}Panel.tabs`, className: `ui-cluster ui-cluster--${panel}-tabs-region panel-tabs-region shop-workspace__tab`, content: `<div class="switch-tabs"><div class="switch-tabs-content">${content}</div></div>` });
  const left = shopTabs('left', '<button class="ui-control ui-control--tab switch-tab active" data-shop-leave>← 返回 Spot</button>') + (view ? `<div class="shop-workspace__feed"><h3>店内消息</h3><ul>${view.feed}</ul></div>` : '<p class="modal-empty">商店不存在。</p>');
  const center = shopTabs('center', `<span class="shop-workspace__title">${ctx.escapeHtml(view?.shop.name ?? '商店')}</span>`) + (view ? `<div class="shop-workspace__catalog"><header><p>${ctx.escapeHtml(view.shop.description ?? '')}</p></header>${view.entries}</div>` : '<p class="modal-empty">无法加载商店。</p>');
  const right = shopTabs('right', '<span class="shop-workspace__title">持有与结算</span>') + (view ? `<section class="shop-workspace__settlement"><h3>持有与结算</h3>${renderResourceStrip(ctx)}<div class="shop-workspace__holdings">${renderHoldings(ctx)}</div><h4>已购买小项</h4><ul>${view.cart}</ul><p>预计消耗：${view.costs}</p><div class="shop-workspace__actions"><button data-shop-cancel ${view.canCheckout ? '' : 'disabled'}>撤销</button><button class="primary-button" data-shop-checkout ${view.canCheckout ? '' : 'disabled'}>结算</button></div></section>` : '<button data-shop-leave>返回 Spot</button>');
  return renderWorkspaceFrame(ctx, { id: 'shop',
    left: { slot: 'left', hostId: 'leftPanel.shop.feed', themeScope: 'left.shop.feed', className: 'shop-workspace__left', content: left },
    center: { slot: 'center', hostId: 'centerPanel.shop.catalog', themeScope: 'center.shop.catalog', className: 'shop-workspace__center', content: center, scroll: 'content' },
    right: { slot: 'right', hostId: 'rightPanel.shop.settlement', themeScope: 'right.shop.settlement', className: 'shop-workspace__right', content: right },
  });
}

function renderHoldings(ctx: UIContext): string {
  return [...ctx.game.registry.resourceDisplays.values()].slice(0, 8).map(def => `<span class="shop-holding"><small>${ctx.escapeHtml(def.label)}</small><strong>${ctx.formatNumber(ctx.game.getView().resources[def.resourceId] ?? 0)}</strong></span>`).join('') || '<span>暂无可用货币</span>';
}
