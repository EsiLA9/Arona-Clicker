// ============================================================
// ui/controller-actions-contacts.ts — UI 控制器：通讯录 / 角色 / 招募 / 成长
// 从 controller.ts 的 bindActions 拆出：select-variant / 对话空间 /
//   mark-read / 装备 / Gacha 入口 / add-exp / breakthrough
// ============================================================

import type { UIController } from './controller';

/** 绑定通讯录 / 角色面板、招募入口与角色成长事件（render 后调用）。 */
export function bindContactsActions(ctrl: UIController): void {
  // --- 通讯录 / 角色（Character 重构 UI） ---
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-select-variant]').forEach(button => {
    button.addEventListener('click', () => {
      ctrl.panelState.selectedVariantId = button.dataset.selectVariant ?? null;
      ctrl.panelState.conversationVariantId = ctrl.panelState.selectedVariantId;
      ctrl.panelState.leftTab = 'contacts';
      ctrl.panelState.rightTab = 'character';
      ctrl.scroll.forceToBottom();
      ctrl.render();
    });
  });
  // 对话空间返回键：回到一般聊天（并取消左侧该学生的 active 选中态）
  ctrl.root.querySelector('[data-conversation-back]')?.addEventListener('click', () => {
    ctrl.panelState.conversationVariantId = null;
    ctrl.panelState.selectedVariantId = null;
    ctrl.panelState.centerTab = 'chat';
    ctrl.scroll.forceToBottom();
    ctrl.render();
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-mark-read]').forEach(button => {
    button.addEventListener('click', () => {
      ctrl.game.mutations.markChatRead(button.dataset.markRead!);
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-equip-equipment]').forEach(button => {
    button.addEventListener('click', () => {
      const variantId = ctrl.panelState.selectedVariantId;
      if (!variantId) return;
      const r = ctrl.game.mutations.equipEquipment(variantId, button.dataset.equipEquipment!);
      if (!r.ok) ctrl.toast.show(r.reason === 'not-owned' ? '尚未收集该装备' : '无法装备', 'error');
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-unequip-equipment]').forEach(button => {
    button.addEventListener('click', () => {
      const variantId = ctrl.panelState.selectedVariantId;
      if (!variantId) return;
      ctrl.game.mutations.unequipEquipment(variantId);
      ctrl.render();
    });
  });
  // Gacha 入口
  ctrl.root.querySelector('#open-gacha')?.addEventListener('click', () => ctrl.openGachaModal());
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-open-spot-gacha]').forEach(button => {
    button.addEventListener('click', () => ctrl.openSpotGachaModal(button.dataset.openSpotGacha!));
  });
  // 抽取按钮在 body 级弹窗内，由 openGachaModal 打开时单独绑定（bindGachaButtons）
  ctrl.bindGachaButtons(ctrl.root.querySelectorAll('[data-gacha]'));
  // 角色成长
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-add-exp]').forEach(button => {
    button.addEventListener('click', () => {
      const variantId = button.dataset.addExp!;
      const before = ctrl.game.rosterSystem.getOwned(ctrl.game.state, variantId)?.level ?? 0;
      const r = ctrl.game.mutations.addExp(variantId, 100);
      if (r.ok && r.newLevel > before) ctrl.toast.show(`升级！Lv.${r.newLevel}`, 'success');
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-breakthrough]').forEach(button => {
    button.addEventListener('click', () => {
      const r = ctrl.game.mutations.breakthroughStar(button.dataset.breakthrough!);
      if (!r.ok) ctrl.toast.show('碎片不足或已达上限', 'error');
      else ctrl.toast.show(`突破成功 ★${r.newStars}`, 'success');
      ctrl.render();
    });
  });
}
