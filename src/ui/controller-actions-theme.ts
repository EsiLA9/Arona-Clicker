// ============================================================
// ui/controller-actions-theme.ts — UI 控制器：主题交互事件绑定
// 从 controller.ts 的 bindActions 拆出：activate-color / 自定义主题 /
//   层级优先级 / 实体主题槽（applyTheme 的 CSS 注入见 controller-theme）
// ============================================================

import { DEFAULT_LAYER_ORDER, type ThemeOrderScope } from '../engine/core/theme-runtime';
import type { UIController } from './controller';

/** 绑定主题交互事件（render 后调用）。 */
export function bindThemeActions(ctrl: UIController): void {
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-activate-color]').forEach(button => {
    button.addEventListener('click', () => {
      const colorId = button.dataset.activateColor || null;
      if (!ctrl.game.mutations.activateTheme(colorId)) {
        ctrl.toast.show('该色彩尚未解锁', 'error');
        return;
      }
      ctrl.game.mutations.setCustomTheme(null);
      ctrl.toast.show(colorId ? '主题已切换' : '已恢复默认主题', 'success');
      ctrl.render();
    });
  });
  // 自定义主题：从 ColorGroup 取主色位 Color 构建 ThemeDef（绕过 ownership 闸门）。
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-activate-custom-theme]').forEach(button => {
    button.addEventListener('click', () => {
      const groupId = button.dataset.activateCustomTheme;
      if (!groupId) {
        ctrl.game.mutations.setCustomTheme(null);
        ctrl.toast.show('已恢复默认主题', 'success');
        ctrl.render();
        return;
      }
      const group = ctrl.game.registry.colorGroups.get(groupId);
      const slot = group?.slots.find(s => s.role === 'primary') ?? group?.slots[0];
      if (!slot) {
        ctrl.toast.show('该色组无效', 'error');
        return;
      }
      ctrl.game.mutations.setCustomTheme({ colorId: slot.colorId });
      ctrl.game.mutations.activateTheme(null);
      ctrl.toast.show('已应用自定义主题', 'success');
      ctrl.render();
    });
  });
  // 层级优先级：◀/▶ 交换相邻位（低 → 高排列）
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-theme-layer-order-move]').forEach(button => {
    button.addEventListener('click', () => {
      const scope = button.dataset.themeLayerOrderMove as ThemeOrderScope;
      const dir = Number(button.dataset.dir);
      const cur = ctrl.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER;
      const idx = cur.indexOf(scope);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= cur.length) return;
      const next = [...cur];
      [next[idx], next[target]] = [next[target], next[idx]];
      ctrl.game.mutations.setThemeLayerOrder(next);
      ctrl.render();
    });
  });
  // 实体主题槽：选定 Area / 学生的当前主题来源（载荷 = {entityKey, slot} JSON）
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-entity-theme-select]').forEach(button => {
    button.addEventListener('click', () => {
      const raw = button.dataset.entityThemeSelect;
      if (!raw) return;
      try {
        const { entityKey, slot } = JSON.parse(raw);
        ctrl.game.mutations.setEntityThemeSlot(entityKey, slot);
        ctrl.render();
      } catch {
        ctrl.toast.show('无效的主题选择', 'error');
      }
    });
  });
}
