// ============================================================
// ui/controller-panels.ts — UI 控制器：面板桥接
// 从 controller.ts 拆出：initSelectMode / renderSelectorPage /
//   replaceDetail / bindDetailActions / bindSelectorCommonActions
// ============================================================

import { createUIContext } from './context';
import { backgroundView as backgroundViewImpl, presentationView as presentationViewImpl } from './controller-theme';
import { renderSelectorPage as renderSelectorPageView } from './components/selector-page';
import type { InitSelectMode } from './components/init-select';
import type { SelectionFace } from './components/global-enhancement-select';
import { SaveSystem } from '../data-services/persistence/storage';
import type { SaveData } from '../arona-clicker/contracts/save-data';
import type { UIController } from './controller';
import { bindTopBarActions } from './controller-actions-topbar';
import { bindThemeActions } from './controller-actions-theme';
import { syncOuterBackground } from './outer-background';

/** Init 选择界面模式：由当前流程决定（新建 vs 重启/重选），替代从 activeInit 推断。 */
export function initSelectMode(ctrl: UIController): InitSelectMode {
  return ctrl.pendingRestart ? 'restart' : 'new';
}

/** 选择页是否提供「返回游戏」：游戏进行中（started）从面板进入时保留逃生口。 */
export function showBackToGame(ctrl: UIController): boolean {
  return ctrl.started && !ctrl.pendingRestart;
}

/** 全量渲染选择页（Init ⇄ GlobalEnhancement 左右滑动，共享一圆）。initialFace 决定初始滑动位置。 */
export function renderSelectorPage(ctrl: UIController, initialFace: SelectionFace = 'init'): void {
  // 选择页是新游戏的首个可见界面：先落一份存档，避免用户在选择 Init
  // 或 GlobalEnhancement 前关闭页面后丢失这次新建会话。
  if (!SaveSystem.exists()) {
    SaveSystem.save(ctrl.withHistories(ctrl.commands.save()));
  }
  const context = createUIContext(ctrl.game, backgroundViewImpl(ctrl), presentationViewImpl(ctrl));
  ctrl.selectorPage.reset();
  ctrl.root.innerHTML = renderSelectorPageView(
    context,
    initSelectMode(ctrl),
    ctrl.selectorPage.selectedInitId,
    ctrl.selectorPage.selectedEnhId,
    showBackToGame(ctrl),
    initialFace,
  );
  syncOuterBackground(context.background);
  // #app 重建后原锚点（如 Spot hover 的卡片）已脱离文档 → 关闭残留悬浮层
  ctrl.popovers.retainIfAnchored();
  // 选择页也需要 Hover 弹层（同一套事件委托，首次进入即绑定）
  ctrl.popovers.bind();
  ctrl.selectorPage.bindStage(initialFace);
  // Lobby 也提供与一般游戏相同的服务导航；进入服务后由 render() 切换到服务工作区。
  bindTopBarActions(ctrl);
  bindThemeActions(ctrl);
}

/** 全量渲染 Init 选择器（轨道默认停在 Init 面）。 */
export function renderInitSelect(ctrl: UIController): void {
  renderSelectorPage(ctrl, 'init');
}

/** 全量渲染 GlobalEnhancement 选择页（轨道默认停在强化面）。 */
export function renderGlobalEnhancementSelect(ctrl: UIController): void {
  renderSelectorPage(ctrl, 'global-enh');
}

/** 局部替换当前面的详情文案块（不动轮盘 DOM，旋转状态得以保留）。 */
export function replaceCurrentDetail(ctrl: UIController): void {
  ctrl.selectorPage.replaceCurrentDetail();
}

/** 绑定 Init 面详情 CTA（进入 / 购买）。轮盘局部刷新后需重绑。 */
export function bindDetailActions(ctrl: UIController): void {
  // 详情 CTA：已解锁 → 直接进入（新游戏 / 恢复）
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-init]').forEach(button => {
    button.addEventListener('click', () => {
      const initId = button.dataset.init!;
      if (ctrl.pendingRestart) {
        ctrl.pendingRestart = false;
        ctrl.resumeInit(initId);
      } else {
        ctrl.startNewGame(initId);
      }
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
      // 解锁后局部刷新：仅替换该卡片；若它正被选中则同步刷新详情 CTA
      ctrl.selectorPage.refreshInitRow(initId);
      if (ctrl.selectorPage.selectedInitId === initId) {
        ctrl.selectorPage.replaceInitDetail();
      }
    });
  });
}

/** 绑定 GlobalEnhancement 面详情 CTA（购买 / 停用）。轮盘局部刷新后需重绑。 */
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
      ctrl.selectorPage.refreshEnhRow(enhId);
      if (ctrl.selectorPage.selectedEnhId === enhId) {
        ctrl.selectorPage.replaceEnhDetail();
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
      ctrl.selectorPage.refreshEnhRow(enhId);
      if (ctrl.selectorPage.selectedEnhId === enhId) {
        ctrl.selectorPage.replaceEnhDetail();
      }
    });
  });
}

/** 绑定选择页顶栏共用交互（翻面 / 读档 / 返回游戏）。每次整页渲染绑定一次。 */
export function bindSelectorCommonActions(ctrl: UIController): void {
  // 翻面：左右滑动到另一侧
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-flip-selection-face]').forEach(button => {
    button.addEventListener('click', () => {
      ctrl.flipSelectionFace();
    });
  });

  // 读档（选择页顶栏）
  ctrl.root.querySelector('#load-game-init')?.addEventListener('click', () => {
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
        ctrl.panelState.service = 'game';
      }
      ctrl.render();
    }
  });

  // 返回游戏（仅 mid-game 入口）
  ctrl.root.querySelector('[data-back-to-game]')?.addEventListener('click', () => {
    ctrl.render();
  });
}
