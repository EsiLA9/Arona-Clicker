// ============================================================
// ui/controller-actions-contacts.ts — UI 控制器：通讯录 / 角色 / 招募 / 成长
// 从 controller.ts 的 bindActions 拆出：select-variant / 对话空间 /
//   输入中推送 / 装备 / Gacha 入口 / add-exp / breakthrough
// ============================================================

import type { UIController } from './controller';

/** 输入中提示时长（ms）：省略号展示后自动推送就绪队列顶。 */
const TYPING_DELAY_MS = 900;

/** 取消输入中定时并清除提示态。 */
function clearTyping(ctrl: UIController): void {
  if (ctrl.typingTimer !== null) {
    clearTimeout(ctrl.typingTimer);
    ctrl.typingTimer = null;
  }
  ctrl.panelState.typingVariantId = null;
}

/**
 * 输入中提示流程：队列非空且无进行中演出时，先展示省略号（typing 态），
 * 延时后自动推送就绪队列顶（§2 轴 B 进入即推 / §3 尾巴强制优先）。
 */
function scheduleTypingPush(ctrl: UIController, variantId: string): void {
  clearTyping(ctrl);
  if (!ctrl.game.rosterSystem.isOwned(ctrl.game.state, variantId)) return;
  if (ctrl.game.getStoryView(variantId)) return; // 沙盒有进行中演出：直接恢复，不打断
  if (ctrl.game.story.readyStepCount(variantId) <= 0) return;
  ctrl.panelState.typingVariantId = variantId;
  ctrl.render();
  ctrl.typingTimer = setTimeout(() => {
    ctrl.typingTimer = null;
    if (ctrl.panelState.conversationVariantId !== variantId) return;
    ctrl.panelState.typingVariantId = null;
    ctrl.game.story.triggerAffectionPush(variantId);
    ctrl.render();
  }, TYPING_DELAY_MS);
}

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
      // 未读即推：队列非空时先展示输入中省略号，延时送达队列顶
      const variantId = ctrl.panelState.conversationVariantId;
      if (variantId) scheduleTypingPush(ctrl, variantId);
      if (!ctrl.panelState.typingVariantId) ctrl.render();
    });
  });
  // 对话空间返回键：回到一般聊天（并取消左侧该学生的 active 选中态）
  ctrl.root.querySelector('[data-conversation-back]')?.addEventListener('click', () => {
    clearTyping(ctrl);
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
