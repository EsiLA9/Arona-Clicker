// ============================================================
// ui/controller-actions-contacts.ts — UI 控制器：通讯录 / 角色 / 招募 / 成长
// 从 controller.ts 的 bindActions 拆出：select-variant / 对话空间 /
//   输入中推送 / 装备 / Gacha 入口 / add-exp / breakthrough
// ============================================================

import type { UIController } from './controller';

/**
 * 打开对话空间即推：队列非空且无进行中演出时立即推送就绪队列顶
 * （§2 轴 B 进入即推 / §3 尾巴强制优先）。"正在输入"节奏由页级打字提示承担（§4）。
 */
function pushReadyTop(ctrl: UIController, variantId: string): void {
  if (!ctrl.game.rosterSystem.isOwned(ctrl.game.state, variantId)) return;
  if (ctrl.game.getStoryView(variantId)) return; // 沙盒有进行中演出：直接恢复，不打断
  if (ctrl.game.story.readyStepCount(variantId) <= 0) return;
  ctrl.commands.triggerAffectionPush(variantId);
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
      ctrl.panelState.storyGate = null; // 换流后浮层失效（owner 已不属于当前流）
      ctrl.scroll.forceToBottom();
      // 未读即推：队列非空时立即送达队列顶（打字节奏由剧情首条 talk 页承担）
      const variantId = ctrl.panelState.conversationVariantId;
      if (variantId) pushReadyTop(ctrl, variantId);
      ctrl.render();
    });
  });
  // 对话空间返回键：回到一般聊天（并取消左侧该学生的 active 选中态）
  ctrl.root.querySelector('[data-conversation-back]')?.addEventListener('click', () => {
    ctrl.panelState.conversationVariantId = null;
    ctrl.panelState.selectedVariantId = null;
    ctrl.panelState.centerTab = 'chat';
    ctrl.panelState.storyGate = null; // 换流后浮层失效（owner 已不属于当前流）
    ctrl.scroll.forceToBottom();
    ctrl.render();
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-mark-read]').forEach(button => {
    button.addEventListener('click', () => {
      ctrl.commands.markChatRead(button.dataset.markRead!);
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-equip-equipment]').forEach(button => {
    button.addEventListener('click', () => {
      const variantId = ctrl.panelState.selectedVariantId;
      if (!variantId) return;
      const r = ctrl.commands.equipEquipment(variantId, button.dataset.equipEquipment!);
      if (!r.ok) ctrl.toast.show(r.reason === 'not-owned' ? '尚未收集该装备' : '无法装备', 'error');
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-unequip-equipment]').forEach(button => {
    button.addEventListener('click', () => {
      const variantId = ctrl.panelState.selectedVariantId;
      if (!variantId) return;
      ctrl.commands.unequipEquipment(variantId);
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
      const r = ctrl.commands.addExp(variantId, 100);
      if (r.ok && r.newLevel > before) ctrl.toast.show(`升级！Lv.${r.newLevel}`, 'success');
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-breakthrough]').forEach(button => {
    button.addEventListener('click', () => {
      const r = ctrl.commands.breakthroughStar(button.dataset.breakthrough!);
      if (!r.ok) ctrl.toast.show('碎片不足或已达上限', 'error');
      else ctrl.toast.show(`突破成功 ★${r.newStars}`, 'success');
      ctrl.render();
    });
  });
}
