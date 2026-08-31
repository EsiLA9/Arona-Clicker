// ============================================================
// ui/controller-actions-inventory.ts — UI 控制器：背包 / 区域 / 强化 / 升级 / 重启
// 从 controller.ts 的 bindActions 拆出：use-item / area / purchase-enh /
//   enh-manager / global-enh-select / upgrade / restart-init / hard-reset-init
// ============================================================

import { enhPurchaseErrorText, travelErrorText, itemUseErrorText } from './components/errors';
import type { UIController } from './controller';

/** 绑定背包 / 区域 / 强化 / 升级 / 重启事件（render 后调用）。 */
export function bindInventoryActions(ctrl: UIController): void {
  // 背包 / 区域 / 强化 / 升级
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-use-item]').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.dataset.useItem!;
      const result = ctrl.game.items.useItem(itemId);
      if (result.success) {
        const item = ctrl.game.registry.items.get(itemId);
        ctrl.toast.show(`已使用 <b>${item?.name ?? itemId}</b>`, 'success');
      } else {
        ctrl.toast.show(`使用失败：${itemUseErrorText[result.error] ?? result.error}`, 'error');
      }
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-area]').forEach(button => {
    button.addEventListener('click', () => {
      // aria-disabled 行（当前 Area / 锁定 Area）不可移动
      if (button.getAttribute('aria-disabled') === 'true') return;
      const areaId = button.dataset.area!;
      const result = ctrl.game.travelToArea(areaId);
      if (result.success) {
        const area = ctrl.game.registry.areas.get(areaId);
        ctrl.toast.show(`已前往 ${area?.name ?? areaId}`, 'success');
        // 与 Talklet 的 travelToArea（notice=true）一致：在聊天流显示「移动到了 XX」迷你条目。
        // 进 travel 队列：移动触发的剧情与通知在同一次 render，通知必须先于剧情内容入流
        ctrl.pendingTravelChats.push(`移动到了 ${area?.name ?? areaId}`);
      } else {
        ctrl.toast.show(`无法移动：${travelErrorText[result.error] ?? result.error}`, 'error');
      }
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-purchase-enh]').forEach(button => {
    button.addEventListener('click', () => {
      const enhId = button.dataset.purchaseEnh!;
      const result = ctrl.game.enhancements.purchaseEnhancement(enhId);
      if (result.success) {
        const enh = ctrl.game.registry.enhancements.get(enhId);
        ctrl.toast.show(`已获得强化 <b>${enh?.name ?? enhId}</b>`, 'success');
      } else {
        ctrl.toast.show(`购买失败：${enhPurchaseErrorText[result.error] ?? result.error}`, 'error');
      }
      ctrl.render();
    });
  });
  ctrl.root.querySelector('[data-open-enh-manager]')?.addEventListener('click', () => {
    ctrl.openEnhancementManager();
  });
  // 全局强化选择页入口（mid-game 热插拔）：打开镜像盘的 GlobalEnhancement 面
  ctrl.root.querySelector('[data-open-global-enh-select]')?.addEventListener('click', () => {
    ctrl.openGlobalEnhancementSelect();
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(button => {
    button.addEventListener('click', () => {
      const spotId = button.dataset.upgrade!;
      // 未拥有（level 0）→ 购买解锁；已拥有 → 升级
      const level = ctrl.game.getView().spotLevels[spotId] ?? 0;
      const spotDef = ctrl.game.registry.spots.get(spotId);
      const spotName = spotDef?.name ?? spotId;

      if (level <= 0) {
        const result = ctrl.game.spot.unlockSpot(spotId);
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
        const result = ctrl.game.spot.upgradeSpot(spotId);
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
      ctrl.render();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-restart-init]').forEach(button => {
    button.addEventListener('click', () => {
      // 不立即调用 restartInit（会清资源），仅在控制器标记待重启。
      // 玩家在 InitSelect 中选卡 / 购买时再真正执行 restartInit + resumeInit。
      ctrl.started = false;
      ctrl.pendingRestart = true;
      ctrl.toast.show('选择世界线切换，或购买新世界线', 'info');
      ctrl.renderInitSelect();
    });
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-hard-reset-init]').forEach(button => {
    button.addEventListener('click', () => {
      // 硬重置仍需立即清档（放弃快照），但保留 unlockedInits 与统计。
      ctrl.game.inits.hardRestartInit();
      ctrl.started = false;
      ctrl.pendingRestart = true;
      ctrl.toast.show('已彻底重置当前世界线，返回选择', 'info');
      ctrl.renderInitSelect();
    });
  });
}
