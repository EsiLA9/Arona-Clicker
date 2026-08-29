// ============================================================
// ui/controller-actions-contacts.ts — UI 控制器：通讯录 / 角色 / 招募 / 成长
// 从 controller.ts 的 bindActions 拆出：select-variant / 对话空间 /
//   mark-read / 装备 / Gacha 入口 / add-exp / breakthrough
// ============================================================

import type { UIController } from './controller';
import { logStoryFailure } from './controller-actions-story';

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
      // §2 轴 B 进入即推：就绪队列非空时自动开始队列顶的台阶剧情（引擎内幂等保护）
      const variantId = ctrl.panelState.conversationVariantId;
      if (variantId && ctrl.game.rosterSystem.isOwned(ctrl.game.state, variantId)) {
        ctrl.game.story.triggerAffectionPush(variantId);
      }
      ctrl.render();
    });
  });
  // 轴 A 可用消息：点击已读（引擎内结算 affectionExpReward → affectionChanged）
  ctrl.root.querySelectorAll<HTMLElement>('[data-chat-read]').forEach(el => {
    el.addEventListener('click', () => {
      const messageId = el.dataset.chatRead!;
      const variantId = ctrl.panelState.conversationVariantId;
      // 消息内容先落流（气泡留档），再走引擎结算
      const message = ctrl.game.registry.chatMessages.get(messageId);
      if (message && variantId) {
        ctrl.chat.pushToVariant(ctrl.panelState, variantId, {
          kind: 'talk',
          speaker: ctrl.game.rosterSystem.getVariant(variantId)?.displayName,
          text: message.content,
          side: 'left',
        });
      }
      ctrl.game.mutations.markChatRead(messageId);
      ctrl.render();
    });
  });
  // §3 消息羁绊卡片：登记 pendingKizunaTail 后启动关联剧情；无尾巴的消息即点即已读
  ctrl.root.querySelectorAll<HTMLElement>('[data-kizuna-msg]').forEach(el => {
    el.addEventListener('click', () => {
      const messageId = el.dataset.kizunaMsg!;
      const owner = ctrl.panelState.conversationVariantId;
      if (!owner) return;
      const result = ctrl.game.story.startMessageKizuna(messageId, owner);
      logStoryFailure(ctrl, result);
      ctrl.render();
    });
  });
  // §3 尾巴收尾：把尾巴段落档进该学生聊天流 → markChatRead（结算奖励）+ 清 pending
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-tail-done]').forEach(button => {
    button.addEventListener('click', () => {
      const owner = ctrl.panelState.conversationVariantId;
      if (!owner) return;
      const messageId = ctrl.game.story.getPendingKizunaTail(owner);
      const message = messageId ? ctrl.game.registry.chatMessages.get(messageId) : undefined;
      if (message?.kizunaTail?.length) {
        const name = ctrl.game.rosterSystem.getVariant(owner)?.displayName;
        for (const tl of message.kizunaTail) {
          if (tl.kind === 'click') continue;
          ctrl.chat.pushToVariant(ctrl.panelState, owner, {
            kind: tl.kind === 'narration' ? 'narration' : 'talk',
            speaker: tl.speaker ?? name,
            text: tl.text,
            align: tl.align,
            avatar: tl.avatar,
            image: tl.image,
            side: tl.side,
            noAvatar: tl.noAvatar,
          });
        }
      }
      ctrl.game.story.completeKizunaTail(owner);
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
