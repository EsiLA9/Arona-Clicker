// ============================================================
// ui/controller-save.ts — UI 控制器：存档 / 读档
// 从 controller.ts 拆出：handleSave / handleLoad / bindSaveActions
// ============================================================

import { SaveSystem } from '../save/storage';
import type { UIController } from './controller';

/** 保存：写入本地存档（含聊天历史），并反馈结果。 */
export function handleSave(ctrl: UIController): void {
  const saved = SaveSystem.save(ctrl.withHistories(ctrl.game.save()));
  ctrl.game.devLog.record(saved ? '本地存档已保存' : '本地存档保存失败', {
    source: 'save',
    level: saved ? 'success' : 'error',
  });
  ctrl.toast.show(saved ? '存档已保存' : '存档保存失败', saved ? 'success' : 'error');
  ctrl.render();
}

/** 读档：恢复本地存档并回到游戏（解锁当前世界线 + 恢复聊天历史）。 */
export function handleLoad(ctrl: UIController): void {
  const data = SaveSystem.load();
  if (data) {
    ctrl.game.load(data);
    ctrl.game.unlockInit(ctrl.game.state.activeInit || 'base:init:schale_office');
    ctrl.resetSessionPanel();
    ctrl.restoreHistories(data);
    ctrl.game.devLog.record('本地存档已读取', { source: 'save', level: 'success' });
    ctrl.toast.show('存档已加载', 'success');
  } else {
    ctrl.game.devLog.record('本地存档读取失败', { source: 'save', level: 'warning' });
    ctrl.toast.show('没有找到存档', 'error');
  }
  ctrl.render();
}

/** 绑定主页面存档 / 读档按钮。 */
export function bindSaveActions(ctrl: UIController): void {
  ctrl.root.querySelector('#save-game')?.addEventListener('click', () => handleSave(ctrl));
  ctrl.root.querySelector('#load-game')?.addEventListener('click', () => handleLoad(ctrl));
}
