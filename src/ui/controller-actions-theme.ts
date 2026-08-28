// ============================================================
// ui/controller-actions-theme.ts — UI 控制器：主题交互事件绑定
// 从 controller.ts 的 bindActions 拆出：activate-color / 自定义主题 /
//   层级优先级 / 实体主题槽（applyTheme 的 CSS 注入见 controller-theme）
// ============================================================

import { DEFAULT_LAYER_ORDER, type ThemeOrderScope } from '../engine/core/theme-runtime';
import type { UIController } from './controller';

/** 绑定主题交互事件（render 后调用）。 */
export function bindThemeActions(ctrl: UIController): void {
  // 主题切换：激活某色彩组（统一走 ownership 闸门，null = 恢复默认）。
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-activate-group]').forEach(button => {
    button.addEventListener('click', () => {
      const groupId = button.dataset.activateGroup || null;
      if (!ctrl.game.mutations.activateTheme(groupId)) {
        ctrl.toast.show('该色彩组尚未解锁', 'error');
        return;
      }
      ctrl.toast.show(groupId ? '主题已切换' : '已恢复默认主题', 'success');
      ctrl.render();
    });
  });
  // 层级优先级：拖拽行重排（HTML5 DnD；drop 时把新顺序落库并重渲染）
  const layerRows = ctrl.root.querySelector<HTMLElement>('[data-theme-layer-order-rows]');
  if (layerRows) {
    let dragging: string | null = null;
    layerRows.addEventListener('dragstart', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-layer-order-scope]');
      if (!row) return;
      dragging = row.dataset.themeLayerOrderScope ?? null;
      if (dragging) {
        e.dataTransfer!.setData('text/plain', dragging);
        e.dataTransfer!.effectAllowed = 'move';
      }
      requestAnimationFrame(() => row.classList.add('is-dragging'));
    });
    layerRows.addEventListener('dragover', (e) => {
      e.preventDefault(); // 允许 drop
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-layer-order-scope]');
      layerRows.querySelectorAll('.drop-before, .drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
      if (!target || target.dataset.themeLayerOrderScope === dragging) return;
      const rect = target.getBoundingClientRect();
      target.classList.add(e.clientY > rect.top + rect.height / 2 ? 'drop-after' : 'drop-before');
      e.dataTransfer!.dropEffect = 'move';
    });
    layerRows.addEventListener('drop', (e) => {
      e.preventDefault();
      const dragged = e.dataTransfer?.getData('text/plain') ?? dragging;
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-layer-order-scope]');
      layerRows.querySelectorAll('.drop-before, .drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
      if (!dragged || !target || target.dataset.themeLayerOrderScope === dragged) return;
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      // 展示序顶部 = 最高优先级（引擎序反转）；drop 计算在展示序内进行
      const display = [...(ctrl.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER)].reverse();
      const dispNext = display.filter(s => s !== dragged);
      const at = dispNext.indexOf(target.dataset.themeLayerOrderScope as ThemeOrderScope);
      if (at < 0) return;
      dispNext.splice(after ? at + 1 : at, 0, dragged as ThemeOrderScope);
      ctrl.game.mutations.setThemeLayerOrder([...dispNext].reverse());
      ctrl.render();
    });
    layerRows.addEventListener('dragend', () => {
      layerRows.querySelectorAll('.is-dragging, .drop-before, .drop-after')
        .forEach(el => el.classList.remove('is-dragging', 'drop-before', 'drop-after'));
      dragging = null;
    });
  }
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
