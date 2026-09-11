// ============================================================
// ui/controller-actions-inventory.ts — UI 控制器：背包 / 区域 / 强化 / 升级 / 重启
// 从 controller.ts 的 bindActions 拆出：use-item / area / purchase-enh /
//   enh-manager / global-enh-select / upgrade / restart-init / hard-reset-init
// ============================================================

import { enhPurchaseErrorText, travelErrorText, itemUseErrorText } from './components/errors';
import type { UIController } from './controller';
import { createInventoryWorkspaceState, deriveInventoryRows, type InventoryWorkspaceState } from './inventory-view';

function inventoryWorkspace(ctrl: UIController): InventoryWorkspaceState {
  return ctrl.panelState.inventoryWorkspace ??= createInventoryWorkspaceState();
}

function inventoryOrder(ctrl: UIController, state: InventoryWorkspaceState): string[] {
  const rows = deriveInventoryRows(ctrl.game.registry.items, ctrl.game.getView().inventory, {
    ...state,
    typeFilter: 'all',
    rarityFilter: 'all',
    usabilityFilter: 'all',
    ownedOnly: false,
    query: '',
    sortMode: 'name',
    sortDirection: 'asc',
    customOrder: [],
    selectedItemId: null,
  }, itemId => ctrl.game.getView().visibility.items[itemId] !== false);
  const known = new Set(rows.allRows.map(row => row.id));
  const order = state.customOrder.filter(id => known.has(id));
  for (const row of rows.allRows) if (!order.includes(row.id)) order.push(row.id);
  state.customOrder = order;
  return order;
}

function moveInventoryItem(ctrl: UIController, itemId: string, direction: 'up' | 'down'): void {
  const state = inventoryWorkspace(ctrl);
  const order = inventoryOrder(ctrl, state);
  const index = order.indexOf(itemId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  state.sortMode = 'custom';
  state.sortDirection = 'asc';
  ctrl.render();
}

function reorderInventoryItem(ctrl: UIController, fromId: string, toId: string): void {
  if (fromId === toId) return;
  const state = inventoryWorkspace(ctrl);
  const order = inventoryOrder(ctrl, state);
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0) return;
  order.splice(from, 1);
  order.splice(order.indexOf(toId), 0, fromId);
  state.sortMode = 'custom';
  state.sortDirection = 'asc';
  ctrl.render();
}

function bindInventoryWorkspaceActions(ctrl: UIController, scope: ParentNode): void {
  scope.querySelector('[data-open-inventory]')?.addEventListener('click', () => {
    if (ctrl.panelState.workspace) ctrl.disposeWorkspace();
    ctrl.panelState.service = 'inventory';
    ctrl.render();
  });

  scope.querySelectorAll<HTMLButtonElement>('[data-inventory-type]').forEach(button => {
    button.addEventListener('click', () => {
      inventoryWorkspace(ctrl).typeFilter = (button.dataset.inventoryType ?? 'all') as InventoryWorkspaceState['typeFilter'];
      inventoryWorkspace(ctrl).selectedItemId = null;
      ctrl.render();
    });
  });
  scope.querySelector<HTMLSelectElement>('[data-inventory-rarity]')?.addEventListener('change', event => {
    inventoryWorkspace(ctrl).rarityFilter = (event.currentTarget as HTMLSelectElement).value as InventoryWorkspaceState['rarityFilter'];
    inventoryWorkspace(ctrl).selectedItemId = null;
    ctrl.render();
  });
  scope.querySelector<HTMLSelectElement>('[data-inventory-usability]')?.addEventListener('change', event => {
    inventoryWorkspace(ctrl).usabilityFilter = (event.currentTarget as HTMLSelectElement).value as InventoryWorkspaceState['usabilityFilter'];
    inventoryWorkspace(ctrl).selectedItemId = null;
    ctrl.render();
  });
  scope.querySelector<HTMLInputElement>('[data-inventory-owned-only]')?.addEventListener('change', event => {
    inventoryWorkspace(ctrl).ownedOnly = (event.currentTarget as HTMLInputElement).checked;
    inventoryWorkspace(ctrl).selectedItemId = null;
    ctrl.render();
  });
  scope.querySelector<HTMLInputElement>('[data-inventory-query]')?.addEventListener('input', event => {
    const input = event.currentTarget as HTMLInputElement;
    inventoryWorkspace(ctrl).query = input.value;
    inventoryWorkspace(ctrl).selectedItemId = null;
    const cursor = input.selectionStart ?? input.value.length;
    ctrl.render();
    const next = ctrl.root.querySelector<HTMLInputElement>('[data-inventory-query]');
    next?.focus();
    next?.setSelectionRange(cursor, cursor);
  });
  scope.querySelector('[data-inventory-clear]')?.addEventListener('click', () => {
    const state = inventoryWorkspace(ctrl);
    state.typeFilter = 'all';
    state.rarityFilter = 'all';
    state.usabilityFilter = 'all';
    state.ownedOnly = true;
    state.query = '';
    state.selectedItemId = null;
    ctrl.render();
  });
  scope.querySelector<HTMLSelectElement>('[data-inventory-sort]')?.addEventListener('change', event => {
    inventoryWorkspace(ctrl).sortMode = (event.currentTarget as HTMLSelectElement).value as InventoryWorkspaceState['sortMode'];
    ctrl.render();
  });
  scope.querySelector('[data-inventory-sort-direction]')?.addEventListener('click', () => {
    const state = inventoryWorkspace(ctrl);
    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    ctrl.render();
  });
  scope.querySelector('[data-inventory-reset-order]')?.addEventListener('click', () => {
    const state = inventoryWorkspace(ctrl);
    state.customOrder = [];
    state.sortMode = 'custom';
    state.sortDirection = 'asc';
    ctrl.render();
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-inventory-select]').forEach(button => {
    button.addEventListener('click', () => {
      inventoryWorkspace(ctrl).selectedItemId = button.dataset.inventorySelect ?? null;
      ctrl.render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-inventory-use]').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.dataset.inventoryUse;
      if (!itemId) return;
      const result = ctrl.commands.useItem(itemId);
      if (result.success) {
        const item = ctrl.game.registry.items.get(itemId);
        ctrl.toast.show(`已使用 <b>${item?.name ?? itemId}</b>`, 'success');
      } else {
        ctrl.toast.show(`使用失败：${itemUseErrorText[result.error] ?? result.error}`, 'error');
      }
      ctrl.render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-inventory-move]').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.closest<HTMLElement>('[data-inventory-item-id]')?.dataset.inventoryItemId;
      const direction = button.dataset.inventoryMove as 'up' | 'down' | undefined;
      if (itemId && direction) moveInventoryItem(ctrl, itemId, direction);
    });
  });
  let draggingId: string | null = null;
  scope.querySelectorAll<HTMLElement>('[data-inventory-item-id]').forEach(row => {
    row.addEventListener('dragstart', event => {
      if (inventoryWorkspace(ctrl).sortMode !== 'custom') return;
      draggingId = row.dataset.inventoryItemId ?? null;
      if (draggingId && event instanceof DragEvent && event.dataTransfer) event.dataTransfer.setData('text/plain', draggingId);
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => {
      draggingId = null;
      row.classList.remove('is-dragging');
    });
    row.addEventListener('dragover', event => {
      if (!draggingId || inventoryWorkspace(ctrl).sortMode !== 'custom') return;
      event.preventDefault();
      row.classList.add('is-drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
    row.addEventListener('drop', event => {
      event.preventDefault();
      row.classList.remove('is-drop-target');
      const fromId = draggingId ?? (event instanceof DragEvent ? event.dataTransfer?.getData('text/plain') : null);
      const toId = row.dataset.inventoryItemId;
      draggingId = null;
      if (fromId && toId) reorderInventoryItem(ctrl, fromId, toId);
    });
  });
}

/** 绑定背包 / 区域 / 强化 / 升级 / 重启事件（render 后调用）。 */
export function bindInventoryActions(ctrl: UIController, scope: ParentNode = ctrl.root): void {
  bindInventoryWorkspaceActions(ctrl, scope);
  // 背包 / 区域 / 强化 / 升级
  scope.querySelectorAll<HTMLButtonElement>('[data-use-item]').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.dataset.useItem!;
      const result = ctrl.commands.useItem(itemId);
      if (result.success) {
        const item = ctrl.game.registry.items.get(itemId);
        ctrl.toast.show(`已使用 <b>${item?.name ?? itemId}</b>`, 'success');
      } else {
        ctrl.toast.show(`使用失败：${itemUseErrorText[result.error] ?? result.error}`, 'error');
      }
      ctrl.refreshPanels(['right']);
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-area]').forEach(button => {
    button.addEventListener('click', () => {
      // aria-disabled 行（当前 Area / 锁定 Area）不可移动
      if (button.getAttribute('aria-disabled') === 'true') return;
      const areaId = button.dataset.area!;
      const result = ctrl.commands.travelToArea(areaId);
      if (result.success) {
        const area = ctrl.game.world.areas.get(areaId);
        ctrl.toast.show(`已前往 ${area?.name ?? areaId}`, 'success');
        // 与 Talklet 的 travelToArea（notice=true）一致：在聊天流显示「移动到了 XX」迷你条目。
        // 进 travel 队列：移动触发的剧情与通知在同一次 render，通知必须先于剧情内容入流
        ctrl.pendingTravelChats.push(`移动到了 ${area?.name ?? areaId}`);
      } else {
        ctrl.toast.show(`无法移动：${travelErrorText[result.error] ?? result.error}`, 'error');
      }
      ctrl.scheduleRender();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-purchase-enh]').forEach(button => {
    button.addEventListener('click', () => {
      const enhId = button.dataset.purchaseEnh!;
      const result = ctrl.commands.purchaseEnhancement(enhId);
      if (result.success) {
        const enh = ctrl.game.registry.enhancements.get(enhId);
        ctrl.toast.show(`已获得强化 <b>${enh?.name ?? enhId}</b>`, 'success');
      } else {
        ctrl.toast.show(`购买失败：${enhPurchaseErrorText[result.error] ?? result.error}`, 'error');
      }
      ctrl.refreshPanels(['right']);
    });
  });
  scope.querySelector('[data-open-enh-manager]')?.addEventListener('click', () => {
    ctrl.openEnhancementManager();
  });
  // 全局强化选择页入口（mid-game 热插拔）：打开镜像盘的 GlobalEnhancement 面
  scope.querySelector('[data-open-global-enh-select]')?.addEventListener('click', () => {
    ctrl.openGlobalEnhancementSelect();
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(button => {
    button.addEventListener('click', () => {
      const spotId = button.dataset.upgrade!;
      // 未拥有（level 0）→ 购买解锁；已拥有 → 升级
      const level = ctrl.game.getView().spotLevels[spotId] ?? 0;
      const spotDef = ctrl.game.world.spots.get(spotId);
      const spotName = spotDef?.name ?? spotId;

      if (level <= 0) {
        const result = ctrl.commands.unlockSpot(spotId);
        if (result.success) {
          ctrl.toast.show(`已解锁 <b>${spotName}</b>`, 'success');
        } else {
          const errMap: Record<string, string> = {
            NotFound: '未找到该设施',
            NotVisible: '设施尚不可见',
            AlreadyOwned: '已拥有该设施',
            InsufficientResource: '资源不足',
            MaxLevel: '已达等级上限',
          };
          ctrl.toast.show(`解锁失败：${errMap[result.error] ?? result.error}`, 'error');
        }
      } else {
        const result = ctrl.commands.upgradeSpot(spotId);
        if (result.success) {
          ctrl.toast.show(`<b>${spotName}</b> 已升级至 Lv.${result.newLevel}`, 'success');
        } else {
          const errMap: Record<string, string> = {
            NotFound: '未找到该设施',
            NotOwned: '尚未拥有该设施',
            InsufficientResource: '资源不足',
            MaxLevel: ctrl.game.spot.getEffectiveMaxLevel(spotId) !== undefined
              ? `已达等级上限 Lv.${ctrl.game.spot.getEffectiveMaxLevel(spotId)}`
              : '已达等级上限',
            ConditionNotMet: '条件未满足',
          };
          ctrl.toast.show(`升级失败：${errMap[result.error] ?? result.error}`, 'error');
        }
      }
      ctrl.refreshPanels(['right']);
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-restart-init]').forEach(button => {
    button.addEventListener('click', () => {
      // 不立即调用 restartInit（会清资源），仅在控制器标记待重启。
      // 玩家在 InitSelect 中选卡 / 购买时再真正执行 restartInit + resumeInit。
      ctrl.started = false;
      ctrl.pendingRestart = true;
      ctrl.toast.show('选择世界线切换，或购买新世界线', 'info');
      ctrl.renderInitSelect();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-hard-reset-init]').forEach(button => {
    button.addEventListener('click', () => {
      // 硬重置仍需立即清档（放弃快照），但保留 unlockedInits 与统计。
      ctrl.commands.hardRestartInit();
      ctrl.started = false;
      ctrl.pendingRestart = true;
      ctrl.toast.show('已彻底重置当前世界线，返回选择', 'info');
      ctrl.renderInitSelect();
    });
  });
}
