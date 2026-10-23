// ============================================================
// ui/controller-panels.ts — UI 控制器：面板桥接
// 从 controller.ts 拆出：initSelectMode / renderSelectorPage /
//   bindDetailActions / bindSelectorCommonActions
// ============================================================

import { createUIContext } from '../runtime/context';
import { selectorBaseBackgroundView, selectorBasePresentationView } from './controller-theme';
import { renderSelectorPage as renderSelectorPageView } from '../components/navigation/selector-page';
import type { InitSelectMode } from '../components/world/init-select';
import type { SelectorNodeKind } from '../presentation/selector-theme';
import { SaveSystem } from '../../data-services/persistence/storage';
import type { SaveData } from '../../arona-clicker/contracts/runtime/save-data';
import type { UIController } from './controller';
import { bindTopBarActions } from './controller-actions-topbar';
import { bindThemeActions } from './controller-actions-theme';
import { bindEntityPresentationActions } from './controller-actions-presentation';
import { syncOuterBackground } from '../presentation/outer-background';

/** Init 选择界面模式：由当前流程决定（新建 vs 重启/重选），替代从 activeInit 推断。 */
export function initSelectMode(ctrl: UIController): InitSelectMode {
  return ctrl.pendingRestart ? 'restart' : 'new';
}

/** 选择页是否提供「返回游戏」：游戏进行中（started）从面板进入时保留逃生口。 */
export function showBackToGame(ctrl: UIController): boolean {
  return ctrl.started && !ctrl.pendingRestart;
}

/** 全量渲染选择页（Init / GlobalEnhancement 节点图）。initialKind 决定初始聚焦的节点类型。 */
export function renderSelectorPage(ctrl: UIController, initialKind: SelectorNodeKind = 'init'): void {
  // 离开世界线后的概览不能被已排队的主题 / 结构刷新重新展开成星图。
  const overview = ctrl.root.querySelector<HTMLElement>('[data-selector-init-overview]');
  const overviewInitId = initialKind === 'init' && overview && !overview.hidden
    ? ctrl.selectorPage.previewedInitId : null;
  // 选择页是新游戏的首个可见界面：先落一份存档，避免用户在选择 Init
  // 或 GlobalEnhancement 前关闭页面后丢失这次新建会话。
  if (!SaveSystem.exists()) {
    SaveSystem.save(ctrl.withHistories(ctrl.commands.save()));
  }
  const context = createUIContext(
    ctrl.game,
    selectorBaseBackgroundView(ctrl),
    selectorBasePresentationView(ctrl),
    { includeResumedArea: !ctrl.pendingRestart },
  );
  ctrl.popovers.dismissBeforeRootMutation();
  ctrl.selectorPage.reset();
  ctrl.root.innerHTML = renderSelectorPageView(
    context,
    initSelectMode(ctrl),
    ctrl.selectorPage.selectedInitId,
    ctrl.selectorPage.selectedEnhId,
    showBackToGame(ctrl),
    initialKind,
  );
  syncOuterBackground(context.background);
  // #app 重建后原锚点（如 Spot hover 的卡片）已脱离文档 → 关闭残留悬浮层
  ctrl.popovers.retainIfAnchored();
  // 选择页也需要 Hover 弹层（同一套事件委托，首次进入即绑定）
  ctrl.popovers.bind();
  ctrl.selectorPage.bindStage(initialKind);
  // Lobby 也提供与一般游戏相同的服务导航；进入服务后由 render() 切换到服务工作区。
  bindTopBarActions(ctrl);
  bindThemeActions(ctrl);
  bindEntityPresentationActions(ctrl);
  if (overviewInitId) ctrl.selectorPage.openInitOverview(overviewInitId, { animate: false });
}

/** 全量渲染选择页（默认聚焦世界线节点）。 */
export function renderInitSelect(ctrl: UIController): void {
  renderSelectorPage(ctrl, 'init');
}

/** 全量渲染选择页（默认聚焦全局强化节点，mid-game 热插拔入口）。 */
export function renderGlobalEnhancementSelect(ctrl: UIController): void {
  renderSelectorPage(ctrl, 'global-enh');
}

const initActionButtons = new WeakSet<HTMLButtonElement>();

/** 绑定世界线详情 CTA：先预览，再确认进入；工作台与中转页局部刷新后补绑。 */
export function bindDetailActions(ctrl: UIController): void {
  // 详情 CTA 只打开概览；确认按钮才进入（新游戏 / 恢复）。
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-init]').forEach(button => {
    if (initActionButtons.has(button)) return;
    initActionButtons.add(button);
    button.addEventListener('click', () => {
      const initId = button.dataset.init!;
      if (!button.hasAttribute('data-init-confirm')) {
        ctrl.selectorPage.openInitOverview(initId);
        return;
      }
      if (button.disabled || !ctrl.selectorPage.canEnterInit(initId)) return;
      button.disabled = true;
      if (ctrl.pendingRestart) {
        ctrl.pendingRestart = false;
        ctrl.resumeInit(initId);
      } else {
        ctrl.startNewGame(initId);
      }
      if (!ctrl.started || ctrl.game.state.activeInit !== initId) button.disabled = false;
    });
  });

  // 详情 CTA：购买按钮：先扣费，再局部刷新该行与详情（不触发整页重渲染）
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-init-purchase]').forEach(button => {
    button.addEventListener('click', () => {
      const initId = button.dataset.initPurchase!;
      const result = ctrl.commands.purchaseInit(initId);
      if (!result.success) {
        const errMap: Record<string, string> = {
          NotFound: '世界线不存在',
          AlreadyUnlocked: '该世界线已解锁',
          InsufficientResource: '资源不足，无法购买',
        };
        ctrl.toast.show(`购买失败：${errMap[result.error] ?? result.error}`, 'error');
        return;
      }
      const init = ctrl.game.world.inits.get(initId);
      ctrl.toast.show(`已解锁世界线 <b>${init?.name ?? initId}</b>`, 'success');
      // 解锁后局部刷新：仅同步该节点；若它正被选中则同步刷新工作台 CTA
      ctrl.selectorPage.refreshInitNode(initId);
      if (ctrl.selectorPage.selectedNode?.kind === 'init' && ctrl.selectorPage.selectedNode.entityId === initId) {
        ctrl.selectorPage.refreshWorkbench();
      }
    });
  });
}

/** 绑定全局强化节点详情 CTA（购买 / 停用）。工作台局部刷新后需重绑。 */
export function bindGlobalEnhancementDetailActions(ctrl: UIController): void {
  // 购买全局强化
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-global-enh-purchase]').forEach(button => {
    button.addEventListener('click', () => {
      const enhId = button.dataset.globalEnhPurchase!;
      const result = ctrl.commands.purchaseEnhancement(enhId);
      if (!result.success) {
        const errMap: Record<string, string> = {
          NotFound: '不存在',
          AlreadyOwned: '已拥有',
          NotVisible: '尚不可见',
          ConditionNotMet: '条件未满足',
          InsufficientResource: '资源不足，无法购买',
        };
        ctrl.toast.show(`购买失败：${errMap[result.error] ?? result.error}`, 'error');
        return;
      }
      const enh = ctrl.game.registry.enhancements.get(enhId);
      ctrl.toast.show(`已获得全局强化 <b>${enh?.name ?? enhId}</b>`, 'success');
      ctrl.selectorPage.refreshEnhNode(enhId);
      if (ctrl.selectorPage.selectedNode?.kind === 'global-enh' && ctrl.selectorPage.selectedNode.entityId === enhId) {
        ctrl.selectorPage.refreshWorkbench();
      }
    });
  });

  // 停用（热插拔移除）全局强化
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-global-enh-deactivate]').forEach(button => {
    button.addEventListener('click', () => {
      const enhId = button.dataset.globalEnhDeactivate!;
      const removed = ctrl.commands.removeEnhancement(enhId);
      if (!removed) {
        ctrl.toast.show('无法停用（不可撤回或发生错误）', 'error');
        return;
      }
      const enh = ctrl.game.registry.enhancements.get(enhId);
      ctrl.toast.show(`已停用全局强化 <b>${enh?.name ?? enhId}</b>`, 'info');
      ctrl.selectorPage.refreshEnhNode(enhId);
      if (ctrl.selectorPage.selectedNode?.kind === 'global-enh' && ctrl.selectorPage.selectedNode.entityId === enhId) {
        ctrl.selectorPage.refreshWorkbench();
      }
    });
  });
}

const selectorCommonRoots = new WeakSet<HTMLElement>();

/** 在稳定 root 委托读档 / 返回游戏，工作台局部替换后无需重绑顶栏。 */
export function bindSelectorCommonActions(ctrl: UIController): void {
  if (selectorCommonRoots.has(ctrl.root)) return;
  selectorCommonRoots.add(ctrl.root);
  ctrl.root.addEventListener('click', event => {
    const target = event.target as Element | null;
    if (!target?.closest('.selector-shell')) return;
    if (target.closest('[data-back-to-game]')) {
      ctrl.render();
      return;
    }
    if (!target.closest('#load-game-init')) return;
    // 读档（选择页顶栏）
    const data = SaveSystem.load<SaveData>();
    if (data) {
      ctrl.commands.load(data);
      ctrl.resetSessionPanel();
      ctrl.restoreHistories(data);
      ctrl.game.devLog.record('本地存档已读取', { source: 'save', level: 'success' });
      if (data.playerState.activeInit) {
        ctrl.started = true;
        ctrl.commands.start();
      } else {
        // Lobby 存档只恢复 Runtime/全局状态，不能启动 Tick 或伪造 Init 会话。
        ctrl.started = false;
        ctrl.navigateToService('game');
      }
      ctrl.render();
    }
  });
}
