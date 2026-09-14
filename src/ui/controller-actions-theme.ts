// ============================================================
// ui/controller-actions-theme.ts — UI 控制器：主题交互事件绑定
// 从 controller.ts 的 bindActions 拆出：activate-color / 自定义主题 /
//   层级优先级 / 实体主题槽（applyTheme 的 CSS 注入见 controller-theme）
// ============================================================

import { DEFAULT_LAYER_ORDER, type ThemeOrderScope } from '../engine/core/theme-runtime';
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
  // 层级优先级：指针拖拽排序。
  // 不用 HTML5 DnD：拖拽源位于「render 全量重建 #app」的 DOM 内，且外层是可滚动容器，
  // 浏览器会在 dragover 里持续自动滚动并每帧同步 reflow → 拖拽即卡死；触屏与远程桌面也无法可靠触发。
  // 这里改用 Pointer Events，按帧合并更新，落库路径与按钮排序完全一致（setThemeLayerOrder）。
  const layerRows = scope.querySelector<HTMLElement>('[data-theme-layer-order-rows]');
  if (layerRows) {
    function rowElements(): HTMLElement[] {
      return [...layerRows!.querySelectorAll<HTMLElement>('[data-theme-layer-order-scope]')];
    }

    let drag: { pointerId: number; scope: ThemeOrderScope; row: HTMLElement; startY: number } | null = null;
    let pendingY = 0;
    let moved = false;
    let frame = 0;

    function clearIndicators(): void {
      for (const row of rowElements()) row.classList.remove('drop-before', 'drop-after');
    }

    /** 命中的投放行与插入方向（落在行下半 → 插到其后）。 */
    function resolveDrop(clientY: number): { scope: ThemeOrderScope; after: boolean } | null {
      if (!drag) return null;
      for (const row of rowElements()) {
        const rowScope = row.dataset.themeLayerOrderScope as ThemeOrderScope | undefined;
        if (!rowScope || rowScope === drag.scope) continue;
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return { scope: rowScope, after: clientY > rect.top + rect.height / 2 };
        }
      }
      return null;
    }

    function paintIndicator(): void {
      frame = 0;
      if (!drag) return;
      const drop = resolveDrop(pendingY);
      clearIndicators();
      if (!drop) return;
      rowElements().find(row => row.dataset.themeLayerOrderScope === drop.scope)
        ?.classList.add(drop.after ? 'drop-after' : 'drop-before');
    }

    function commitDrop(dragged: ThemeOrderScope, drop: { scope: ThemeOrderScope; after: boolean }): void {
      // 展示序顶部 = 最高优先级（引擎序反转）；排序计算在展示序内进行
      const display = [...(ctrl.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER)].reverse();
      const next = display.filter(item => item !== dragged);
      const at = next.indexOf(drop.scope);
      if (at < 0) return;
      next.splice(drop.after ? at + 1 : at, 0, dragged);
      ctrl.commands.setThemeLayerOrder([...next].reverse());
      ctrl.scheduleRender();
    }

    function endDrag(): void {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      const active = drag;
      drag = null;
      moved = false;
      if (!active) return;
      active.row.classList.remove('is-dragging');
      clearIndicators();
      layerRows!.removeEventListener('pointermove', onPointerMove);
      layerRows!.removeEventListener('pointerup', onPointerUp);
      layerRows!.removeEventListener('pointercancel', onPointerCancel);
      try {
        layerRows!.releasePointerCapture(active.pointerId);
      } catch {
        // 无指针捕获的环境（自动化/旧内核）依赖 layerRows 上的监听器即可。
      }
    }

    function onPointerMove(e: PointerEvent): void {
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (!moved) {
        if (Math.abs(e.clientY - drag.startY) < 4) return;
        moved = true;
      }
      pendingY = e.clientY;
      if (!frame) frame = requestAnimationFrame(paintIndicator);
    }

    function onPointerUp(e: PointerEvent): void {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dragged = drag.scope;
      const drop = moved ? resolveDrop(e.clientY) : null;
      endDrag();
      if (drop) commitDrop(dragged, drop);
    }

    function onPointerCancel(): void {
      endDrag();
    }

    layerRows.addEventListener('pointerdown', (e) => {
      if (drag || e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      const row = target.closest<HTMLElement>('[data-theme-layer-order-scope]');
      const rowScope = row?.dataset.themeLayerOrderScope as ThemeOrderScope | undefined;
      if (!row || !rowScope || !layerRows.contains(row)) return;
      // 触摸只在手柄上启动，避免行内拖拽吞掉浮窗滚动；鼠标/笔整行可拖。
      if (e.pointerType === 'touch' && !target.closest('.layer-order-handle')) return;
      drag = { pointerId: e.pointerId, scope: rowScope, row, startY: e.clientY };
      pendingY = e.clientY;
      moved = false;
      row.classList.add('is-dragging');
      try {
        layerRows.setPointerCapture(e.pointerId);
      } catch {
        // 同上：无指针捕获时仍能收到冒泡到 layerRows 的指针事件。
      }
      layerRows.addEventListener('pointermove', onPointerMove);
      layerRows.addEventListener('pointerup', onPointerUp);
      layerRows.addEventListener('pointercancel', onPointerCancel);
      e.preventDefault();
    });
  }
  // 层级优先级：按钮排序，与拖拽等价；键盘、读屏与无指针环境下的稳定入口
  scope.querySelectorAll<HTMLButtonElement>('[data-theme-layer-order-move]').forEach(button => {
    button.addEventListener('click', () => {
      const moveScope = button.dataset.themeLayerOrderMoveScope as ThemeOrderScope | undefined;
      const direction = button.dataset.themeLayerOrderMove;
      if (!moveScope || (direction !== 'up' && direction !== 'down')) return;
      const display = [...(ctrl.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER)].reverse();
      const index = display.indexOf(moveScope);
      const next = index + (direction === 'up' ? -1 : 1);
      if (index < 0 || next < 0 || next >= display.length) return;
      [display[index], display[next]] = [display[next], display[index]];
      ctrl.commands.setThemeLayerOrder([...display].reverse());
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
