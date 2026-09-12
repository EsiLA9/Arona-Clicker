import type { UIContext } from '../context';
import { renderItemDetail } from './tooltip';
import { renderUIHost } from '../presentation-service';
import { renderWorkspaceFrame } from './workspace-frame';
import type { PanelState } from './app-shell';
import {
  createInventoryWorkspaceState,
  deriveInventoryRows,
  type InventoryRow,
  type InventoryWorkspaceState,
} from '../inventory-view';

const TYPE_LABELS = { consumable: '消耗品', material: '材料', key: '关键道具' } as const;
const RARITY_LABELS = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' } as const;

function inventoryTabs(ctx: UIContext, panel: 'left' | 'center' | 'right', content: string): string {
  return renderUIHost(ctx, {
    hostId: `${panel}Panel.tabs`,
    className: `ui-cluster ui-cluster--${panel}-tabs-region panel-tabs-region inventory-workspace__tab`,
    content: `<div class="switch-tabs"><div class="switch-tabs-content">${content}</div></div>`,
  });
}

function filterButton(label: string, value: string, active: boolean): string {
  return `<button type="button" class="ui-control ui-control--tab switch-tab inventory-filter-button ${active ? 'active ui-control--active' : ''}" data-inventory-type="${value}" aria-pressed="${active}">${label}</button>`;
}

function itemIcon(row: InventoryRow): string {
  return row.item?.icon ?? (row.type === 'consumable' ? '✚' : row.type === 'material' ? '◆' : row.type === 'key' ? '⌘' : '?');
}

function rowMarkup(ctx: UIContext, row: InventoryRow, selected: boolean, customSort: boolean): string {
  const rarity = row.rarity ? RARITY_LABELS[row.rarity] : '未定义';
  const type = row.type ? TYPE_LABELS[row.type] : '未知类型';
  const quantity = row.maxStack === null ? `${ctx.formatNumber(row.count)}` : `${ctx.formatNumber(row.count)} / ${ctx.formatNumber(row.maxStack)}`;
  const use = row.item?.type === 'consumable' && row.count > 0
    ? `<button type="button" class="mini-action" data-inventory-use="${ctx.escapeHtml(row.id)}" ${row.usable ? '' : 'disabled'}>${row.usable ? '使用' : '不可用'}</button>`
    : '';
  const move = customSort
    ? `<button type="button" class="inventory-entry__move" data-inventory-move="up" aria-label="${ctx.escapeHtml(row.name)}上移">↑</button><button type="button" class="inventory-entry__move" data-inventory-move="down" aria-label="${ctx.escapeHtml(row.name)}下移">↓</button>`
    : '';
  return `
    <article class="inventory-entry ${selected ? 'is-selected' : ''} ${row.item ? '' : 'is-unknown'}" data-inventory-item-id="${ctx.escapeHtml(row.id)}" draggable="${customSort}" aria-selected="${selected}">
      <button type="button" class="inventory-entry__select" data-inventory-select="${ctx.escapeHtml(row.id)}" aria-label="查看 ${ctx.escapeHtml(row.name)}">
        <span class="inventory-entry__icon" aria-hidden="true">${ctx.escapeHtml(itemIcon(row))}</span>
        <span class="inventory-entry__copy"><strong>${ctx.escapeHtml(row.name)}</strong><small>${type} · ${rarity}</small></span>
        <span class="inventory-entry__quantity">${quantity}</span>
      </button>
      <div class="inventory-entry__actions"><span class="inventory-entry__drag" title="${customSort ? '拖动调整顺序' : '切换到自定义排序后可拖动'}" aria-hidden="true">⠿</span>${move}${use}</div>
    </article>`;
}

function renderNavigation(ctx: UIContext, state: InventoryWorkspaceState, rows: ReturnType<typeof deriveInventoryRows>): string {
  const typeCount = (type: keyof typeof TYPE_LABELS): string => `${rows.counts.byType[type]}`;
  return `${inventoryTabs(ctx, 'left', '<span class="inventory-workspace__title">筛选</span>')}
    <div class="inventory-workspace__navigation">
      <div class="inventory-column-heading"><span class="eyebrow">ITEM INDEX</span><strong>物品整理</strong><small>${rows.counts.totalKinds} 种 · ${ctx.formatNumber(rows.counts.totalCount)} 件</small></div>
      <label class="inventory-search"><span class="eyebrow">搜索物品</span><input type="search" value="${ctx.escapeHtml(state.query)}" placeholder="名称或 ID" data-inventory-query></label>
      <div class="inventory-filter-group"><span class="eyebrow">种类</span><div class="inventory-filter-list">
        ${filterButton('全部', 'all', state.typeFilter === 'all')}<span class="inventory-filter-count">${rows.counts.totalKinds}</span>
        ${(['consumable', 'material', 'key'] as const).map(type => `${filterButton(TYPE_LABELS[type], type, state.typeFilter === type)}<span class="inventory-filter-count">${typeCount(type)}</span>`).join('')}
      </div></div>
      <label class="inventory-select-field"><span class="eyebrow">稀有度</span><select data-inventory-rarity>${(['all', 'common', 'rare', 'epic', 'legendary'] as const).map(value => `<option value="${value}" ${state.rarityFilter === value ? 'selected' : ''}>${value === 'all' ? '全部' : RARITY_LABELS[value]}</option>`).join('')}</select></label>
      <label class="inventory-select-field"><span class="eyebrow">使用状态</span><select data-inventory-usability>${(['all', 'usable', 'unusable'] as const).map(value => `<option value="${value}" ${state.usabilityFilter === value ? 'selected' : ''}>${value === 'all' ? '全部' : value === 'usable' ? '可使用' : '当前不可用'}</option>`).join('')}</select></label>
      <label class="inventory-owned-toggle"><input type="checkbox" data-inventory-owned-only ${state.ownedOnly ? 'checked' : ''}><span>仅显示已持有</span></label>
      <button type="button" class="toolbar-button inventory-clear-button" data-inventory-clear>清除筛选</button>
    </div>`;
}

function renderSortToolbar(ctx: UIContext, state: InventoryWorkspaceState, rows: ReturnType<typeof deriveInventoryRows>): string {
  const sortLabels = { custom: '自定义顺序', name: '名称', type: '种类', rarity: '稀有度', count: '持有数量', stack: '堆叠占用' } as const;
  return `<div class="inventory-toolbar">
    <div><span class="eyebrow">当前结果</span><strong>${rows.counts.resultKinds} 种 · ${ctx.formatNumber(rows.counts.resultCount)} 件</strong></div>
    <label><span class="eyebrow">排序</span><select data-inventory-sort>${(Object.keys(sortLabels) as Array<keyof typeof sortLabels>).map(value => `<option value="${value}" ${state.sortMode === value ? 'selected' : ''}>${sortLabels[value]}</option>`).join('')}</select></label>
    <button type="button" class="toolbar-button" data-inventory-sort-direction title="切换排序方向">${state.sortDirection === 'asc' ? '升序 ↑' : '降序 ↓'}</button>
    <button type="button" class="toolbar-button" data-inventory-reset-order>恢复默认</button>
  </div>`;
}

function renderMain(ctx: UIContext, state: InventoryWorkspaceState, rows: ReturnType<typeof deriveInventoryRows>): string {
  const selectedId = rows.rows.some(row => row.id === state.selectedItemId) ? state.selectedItemId : rows.rows[0]?.id ?? null;
  const list = rows.rows.length
    ? rows.rows.map(row => rowMarkup(ctx, row, row.id === selectedId, state.sortMode === 'custom')).join('')
    : `<div class="inventory-empty"><strong>${rows.allRows.length ? '没有符合条件的物品' : '背包目前为空'}</strong><span>${rows.allRows.length ? '调整左侧筛选条件后继续查看。' : '获得物品后会显示在这里。'}</span></div>`;
  return `${inventoryTabs(ctx, 'center', '<span class="inventory-workspace__title">物品库</span>')}
    <div class="inventory-workspace__main">
      ${renderSortToolbar(ctx, state, rows)}
      <div class="inventory-list inventory-workspace__list" data-inventory-list>${list}</div>
    </div>`;
}

function useReason(row: InventoryRow): string {
  if (!row.item) return '物品定义缺失';
  if (row.item.type !== 'consumable') return '该物品不可使用';
  if (row.count < 1) return '当前没有持有';
  return '使用条件未满足';
}

function renderInspector(ctx: UIContext, state: InventoryWorkspaceState, rows: ReturnType<typeof deriveInventoryRows>): string {
  const row = rows.rows.find(item => item.id === state.selectedItemId) ?? rows.rows[0];
  const detail = !row
    ? '<section class="inventory-inspector__empty"><strong>选择物品查看详情</strong><span>中栏选中物品后，这里会显示说明与可用操作。</span></section>'
    : row.item
      ? `<section class="inventory-inspector__detail">${renderItemDetail(ctx, row.item)}<div class="inventory-inspector__action"><button type="button" class="primary-button" data-inventory-use="${ctx.escapeHtml(row.id)}" ${row.usable ? '' : 'disabled'}>${row.usable ? '使用物品 ↗' : useReason(row)}</button></div></section>`
      : `<section class="inventory-inspector__empty"><strong>${ctx.escapeHtml(row.name)}</strong><span>${ctx.escapeHtml(row.description)}</span><small>该条目不可操作，请检查数据包注册表。</small></section>`;
  return `${inventoryTabs(ctx, 'right', '<span class="inventory-workspace__title">物品详情</span>')}
    <div class="inventory-workspace__inspector">${detail}<section class="inventory-trace"><div class="inventory-column-heading"><span class="eyebrow">EFFECT TRACE</span><strong>效果追踪</strong></div><p>全局运行时效果仍在游戏右栏“其他”面板中集中查看。</p><button type="button" class="toolbar-button" data-service="game">返回游戏</button></section></div>`;
}

export function renderInventoryWorkspace(ctx: UIContext, state: PanelState): string {
  const workspace = state.inventoryWorkspace ?? createInventoryWorkspaceState();
  const rows = deriveInventoryRows(
    ctx.game.registry.items,
    ctx.view.inventory,
    workspace,
    itemId => ctx.view.visibility.items[itemId] !== false,
    (item, count) => item.type === 'consumable' && count > 0 && (!item.useCondition || ctx.game.conditionSystem.evaluateGroup(item.useCondition, ctx.game.state)),
  );
  return renderWorkspaceFrame(ctx, {
    id: 'inventory',
    layout: { responsive: 'two-column' },
    left: { slot: 'left', workspaceOwner: 'inventory', role: 'navigation', hostId: 'leftPanel.service.inventory.navigation', themeScope: 'left.inventory.navigation', surface: 'panel', className: 'left-panel inventory-workspace__left', content: renderNavigation(ctx, workspace, rows), scroll: 'none' },
    center: { slot: 'center', workspaceOwner: 'inventory', role: 'primary', hostId: 'centerPanel.service.inventory.main', themeScope: 'center.inventory.main', surface: 'panel', className: 'center-panel inventory-workspace__center', content: renderMain(ctx, workspace, rows), scroll: 'none' },
    right: { slot: 'right', workspaceOwner: 'inventory', role: 'inspector', hostId: 'rightPanel.service.inventory.inspector', themeScope: 'right.inventory.inspector', surface: 'panel', className: 'right-panel inventory-workspace__right', content: renderInspector(ctx, workspace, rows), scroll: 'content' },
  });
}
