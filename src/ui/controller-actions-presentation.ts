// ============================================================
// ui/controller-actions-presentation.ts — 实体表现选择
// 所有名称 / 描述 / 主题组合的玩家选择均经 GameCommands 写入。
// ============================================================

import type { UIController } from './controller';

export function bindEntityPresentationActions(ctrl: UIController, scope: ParentNode = ctrl.root): void {
  scope.querySelectorAll<HTMLButtonElement>('[data-entity-presentation-select]').forEach(button => {
    button.addEventListener('click', () => {
      const raw = button.dataset.entityPresentationSelect;
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as { entityKey?: unknown; optionId?: unknown };
        if (typeof payload.entityKey !== 'string') return;
        const optionId = payload.optionId === null
          ? null
          : typeof payload.optionId === 'string'
            ? payload.optionId
            : undefined;
        if (optionId === undefined) return;
        const changed = optionId === null
          ? ctrl.commands.clearEntityPresentationSelection(payload.entityKey)
          : ctrl.commands.setEntityPresentationSelection(payload.entityKey, optionId);
        if (!changed) {
          ctrl.toast.show('该表现内容当前不可用', 'error');
          return;
        }
        ctrl.scheduleRender();
      } catch {
        ctrl.toast.show('无效的表现内容选择', 'error');
      }
    });
  });
}
