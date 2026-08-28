// ============================================================
// ui/controller-modals.ts — UI 控制器：弹层弹窗管理
// 从 controller.ts 拆出：openGachaModal / openSpotGachaModal /
//   bindGachaButtons / openEnhancementManager
// ============================================================

import { createUIContext } from './context';
import { renderGachaBody, renderSpotGachaBody } from './components/contacts';
import { renderEnhancementManager } from './components/enhancements';
import type { UIController } from './controller';

/** 招募补给弹窗：卡池列表 + 抽取按钮（结果经 chat/toast 反馈）。 */
export function openGachaModal(ctrl: UIController): void {
  ctrl.modal.open({
    title: '招募补给 · Gacha',
    body: renderGachaBody(createUIContext(ctrl.game)),
    width: 560,
  });
  // 弹窗挂在 body 级 .app-modal，不在 #app 内——bindActions 覆盖不到，
  // 需在每次 open 后对弹窗 DOM 单独绑定抽取按钮
  bindGachaButtons(ctrl, document.querySelectorAll('.app-modal [data-gacha]'));
}

/** Spot 招募弹窗：专有卡池 / 通用卡池 经 Switch 切换。 */
export function openSpotGachaModal(ctrl: UIController, spotId: string): void {
  const spot = ctrl.game.registry.spots.get(spotId);
  if (!spot) return;
  ctrl.modal.open({
    title: `招募 · ${spot.name}`,
    body: renderSpotGachaBody(createUIContext(ctrl.game), spotId),
    width: 560,
  });
  // 弹窗位于 body 级 .app-modal，单独绑定 Switch 与抽取按钮
  const modalEl = document.querySelector('.app-modal');
  modalEl?.querySelectorAll<HTMLButtonElement>('[data-gacha-scope-switch] .switch-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const scope = tab.dataset.scope!;
      modalEl.querySelectorAll('[data-gacha-scope-switch] .switch-tab').forEach(t => t.classList.toggle('active', t === tab));
      modalEl.querySelectorAll<HTMLElement>('[data-scope-panel]').forEach(panel => {
        panel.hidden = panel.dataset.scopePanel !== scope;
      });
    });
  });
  bindGachaButtons(ctrl, modalEl?.querySelectorAll<HTMLButtonElement>('[data-gacha]') ?? document.querySelectorAll('.app-modal [data-gacha]'));
}

/** 绑定抽取按钮（root 内与弹窗内共用）。 */
export function bindGachaButtons(ctrl: UIController, buttons: NodeListOf<HTMLButtonElement>): void {
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const poolId = button.dataset.gacha!;
      const count = Number(button.dataset.gachaCount) || 1;
      try {
        const summary = ctrl.game.gachaService.roll(poolId, count);
        for (const r of summary.results) {
          const v = ctrl.game.rosterSystem.getVariant(r.variantId);
          ctrl.pushChat({
            kind: 'reward',
            text: r.duplicate
              ? `招募重复 · ${v?.displayName ?? r.variantId} → 碎片 +${r.shards}`
              : `招募成功 · ${v?.displayName ?? r.variantId} 加入通讯录！`,
          });
        }
        if (summary.results.length === 0) {
          const pool = ctrl.game.gachaService.getPool(poolId);
          ctrl.toast.show(
            summary.stopped === 'insufficient-currency'
              ? `${pool?.currency === 'base:resource:pyroxene' ? '青辉石' : '资源'}不足`
              : '抽取失败',
            'error',
          );
        }
      } catch (e) {
        ctrl.toast.show(e instanceof Error ? e.message : '抽取失败', 'error');
      }
      ctrl.modal.close();
      ctrl.render();
    });
  });
}

/** 打开"当前游戏 · 强化管理"弹窗：查看 + 移除已购买的 Enhancement。 */
export function openEnhancementManager(ctrl: UIController): void {
  const render = () => {
    ctrl.modal.open({
      title: '当前游戏 · 强化管理',
      body: renderEnhancementManager(createUIContext(ctrl.game)),
      footer: `<button class="primary-button modal-close">关闭</button>`,
      onClose: () => ctrl.render(),
    });
    // 弹窗位于 body（不在 #app 内），此处动态绑定移除按钮
    document.querySelectorAll<HTMLButtonElement>('[data-remove-enh]').forEach(btn => {
      btn.addEventListener('click', () => {
        const enhId = btn.dataset.removeEnh!;
        const removed = ctrl.game.enhancements.removeEnhancement(enhId);
        if (removed) {
          const enh = ctrl.game.registry.enhancements.get(enhId);
          ctrl.toast.show(`已移除强化 <b>${enh?.name ?? enhId}</b>`, 'info');
        }
        render(); // 刷新弹窗内容
      });
    });
  };
  render();
}
