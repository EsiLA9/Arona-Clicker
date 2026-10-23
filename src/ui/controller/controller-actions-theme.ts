// ============================================================
// ui/controller-actions-theme.ts — UI 控制器：主题选择与实体主题槽事件
// ============================================================

import type { UIController } from './controller';

/** 绑定主题交互事件（render 后调用）。 */
export function bindThemeActions(ctrl: UIController, scope: ParentNode = ctrl.root): void {
  scope.querySelectorAll<HTMLButtonElement>('[data-open-user-theme]').forEach(button => {
    button.addEventListener('click', () => ctrl.openUserThemeEditor());
  });
  // 主题切换：激活某色彩组（统一走 ownership 闸门，null = 恢复默认）。
  scope.querySelectorAll<HTMLButtonElement>('[data-activate-group]').forEach(button => {
    button.addEventListener('click', () => {
      const groupId = button.dataset.activateGroup || null;
      if (!ctrl.commands.activateTheme(groupId)) {
        ctrl.toast.show('该色彩组尚未解锁', 'error');
        return;
      }
      ctrl.toast.show(groupId ? '主题已切换' : '已恢复默认主题', 'success');
      ctrl.scheduleRender();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-activate-custom-theme]').forEach(button => {
    button.addEventListener('click', () => {
      const customThemeId = button.dataset.activateCustomTheme;
      if (!customThemeId || !ctrl.commands.activateCustomTheme(customThemeId)) {
        ctrl.toast.show('用户自定义主题不可用', 'error');
        return;
      }
      ctrl.toast.show('已应用用户自定义主题', 'success');
      ctrl.scheduleRender();
    });
  });
  // 实体主题槽：选定 Area / 学生的当前主题来源（载荷 = {entityKey, slot} JSON）
  scope.querySelectorAll<HTMLButtonElement>('[data-entity-theme-select]').forEach(button => {
    button.addEventListener('click', () => {
      const raw = button.dataset.entityThemeSelect;
      if (!raw) return;
      try {
        const { entityKey, slot } = JSON.parse(raw);
        ctrl.commands.setEntityThemeSlot(entityKey, slot);
        ctrl.scheduleRender();
      } catch {
        ctrl.toast.show('无效的主题选择', 'error');
      }
    });
  });
}
