// ============================================================
// ui/controller-actions-story.ts — UI 控制器：剧情事件绑定
// 从 controller.ts 的 bindActions 拆出：start-story / replay / 层级导航 /
//   archive / 被动闲聊 / send / story-choice / kizuna
// ============================================================

import type { SendResult, StoryAdvanceResult, StoryStartResult } from '../../arona-clicker/contracts/runtime/results';
import { storyErrorText } from '../components/story/story';
import type { UIController } from './controller';

/** 剧情操作失败 → devLog 记录（结果带 error 时；SendResult 见 completed.advance / idle.error）。 */
export function logStoryFailure(ctrl: UIController, result: StoryStartResult | StoryAdvanceResult | SendResult): void {
  if ('type' in result) {
    if (result.type === 'completed' && !result.advance.success) {
      ctrl.game.devLog.record(`剧情操作失败：${storyErrorText[result.advance.error] ?? result.advance.error}`, {
        source: 'story',
        level: 'warning',
        details: result.advance.error,
      });
    }
    if (result.type === 'idle' && result.error) {
      ctrl.game.devLog.record(`剧情操作失败：${storyErrorText[result.error] ?? result.error}`, {
        source: 'story',
        level: 'warning',
        details: result.error,
      });
    }
    return;
  }
  if (result.success) return;
  ctrl.game.devLog.record(`剧情操作失败：${storyErrorText[result.error] ?? result.error}`, {
    source: 'story',
    level: 'warning',
    details: result.error,
  });
}

/** Resolve the owner from the clicked display, never its physical panel. */
function stateForStoryElement(ctrl: UIController, element: Element) {
  const pane = element.closest<HTMLElement>('[data-chat-owner]');
  return pane ? { ...ctrl.panelState, conversationVariantId: pane.dataset.chatOwner || null } : ctrl.panelState;
}

/** 绑定剧情域事件（render 后调用）。 */
export function bindStoryActions(ctrl: UIController, scope: ParentNode = ctrl.root): void {
  const storyGateCard = scope.querySelector<HTMLElement>('[data-story-gate] .story-gate-card');
  if (storyGateCard && document.activeElement === document.body) storyGateCard.focus({ preventScroll: true });
  scope.querySelectorAll<HTMLElement>('[data-story-workspace-leave]').forEach(button => {
    button.addEventListener('click', () => ctrl.disposeWorkspace());
  });
  // 重阅读：故事栏已完成 + replayable 的内容项。
  // 点击后前往该 Entry 归属的对话空间并弹出确认浮层（实际重读由确认触发）。
  // 重读不移动 Area：replayStory 只重置演出游标，不触发 travelToArea。
  scope.querySelectorAll<HTMLButtonElement>('[data-replay-story]').forEach(button => {
    button.addEventListener('click', () => {
      const storyId = button.dataset.replayStory!;
      const entry = ctrl.game.registry.activeStories.get(storyId);
      const owner = entry?.owner ?? null;
      ctrl.panelState.storyGate = { storyId, owner, mode: 'replay' };
      ctrl.render();
    });
  });
  // 剧情入口确认浮层：进入（按 mode 分派原启动逻辑；卡片入口 = goto 重开，
  // 已完结剧情由 startCardStory 的 force 直接重新开始，不再转 replayStory）
  scope.querySelectorAll<HTMLElement>('[data-story-gate-confirm]').forEach(button => {
    button.addEventListener('click', () => {
      const gate = ctrl.panelState.storyGate;
      if (!gate) return;
      ctrl.panelState.storyGate = null;
      if (gate.sourceRunId) {
        const current = gate.sourceOwner ? ctrl.game.getStoryView(gate.sourceOwner) : ctrl.game.getView().currentStory;
        if (current?.runId !== gate.sourceRunId) { ctrl.refreshChatPanel(); return; }
      }
      ctrl.deliverPendingRewardsBeforeStory();
      const owner = gate.owner ?? undefined;
      let result: StoryStartResult;
      if (gate.sourceToken) {
        const submitted = ctrl.commands.submitStoryInput(gate.sourceOwner ?? null, gate.sourceToken);
        logStoryFailure(ctrl, submitted);
        ctrl.refreshChatPanel();
        return;
      }
      if (gate.mode === 'replay') ctrl.pendingStoryReplayReturn = { entryId: gate.storyId, owner: gate.owner ?? null };
      if (gate.mode === 'card') result = ctrl.commands.startCardStory(gate.storyId, owner);
      else if (gate.mode === 'replay') result = ctrl.commands.replayStory(gate.storyId, owner);
      else result = ctrl.commands.startActiveStory(gate.storyId, owner);
      if (!result.success && ctrl.pendingStoryReplayReturn?.entryId === gate.storyId) ctrl.pendingStoryReplayReturn = null;
      logStoryFailure(ctrl, result);
      if (result.success && ctrl.panelState.workspace?.type === 'story') {
        ctrl.panelState.workspace.mode = result.finished ? 'overview' : 'playing';
      }
      ctrl.refreshChatPanel();
    });
  });
  // 剧情入口确认浮层：取消（X / 取消按钮 / 遮罩空白；卡片内点击冒泡不关闭）
  scope.querySelectorAll<HTMLElement>('[data-story-gate-cancel]').forEach(el => {
    el.addEventListener('click', event => {
      if (event.target !== event.currentTarget) return;
      ctrl.panelState.storyGate = null;
      ctrl.refreshChatPanel();
    });
  });
  // 故事层级导航：向内逐层下钻（分类 → 篇 → 章）
  scope.querySelectorAll<HTMLButtonElement>('[data-story-nav]').forEach(button => {
    button.addEventListener('click', () => {
      const path = (button.dataset.storyNav ?? '').split(':').filter(Boolean);
      if (ctrl.panelState.workspace?.type !== 'story') ctrl.openStoryWorkspace();
      const workspace = ctrl.panelState.workspace;
      if (workspace?.type !== 'story') return;
      workspace.navPath = path;
      workspace.subroute = 'overview';
      ctrl.refreshPanels(['left', 'center']);
    });
  });
  // 故事层级导航：面包屑返回指定深度
  scope.querySelectorAll<HTMLButtonElement>('[data-story-back]').forEach(button => {
    button.addEventListener('click', () => {
      const depth = Number(button.dataset.storyBack ?? 0);
      if (ctrl.panelState.workspace?.type !== 'story') ctrl.openStoryWorkspace();
      const workspace = ctrl.panelState.workspace;
      if (workspace?.type !== 'story') return;
      workspace.navPath = workspace.navPath.slice(0, depth);
      workspace.subroute = 'overview';
      ctrl.refreshPanels(['left', 'center']);
    });
  });
  // 故事"档案"入口：进入 StoryWorkspace 的显式子路由
  scope.querySelectorAll<HTMLButtonElement>('[data-story-archive]').forEach(button => {
    button.addEventListener('click', () => {
      if (ctrl.panelState.workspace?.type !== 'story') ctrl.openStoryWorkspace();
      const workspace = ctrl.panelState.workspace;
      if (workspace?.type !== 'story') return;
      workspace.subroute = 'archive';
      workspace.selectedEntryId = null;
      workspace.conversationOwner = null;
      workspace.mode = 'overview';
      ctrl.panelState.conversationVariantId = null;
      ctrl.panelState.storyGate = null;
      ctrl.refreshPanels(['left', 'center', 'right']);
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-story-archive-back]').forEach(button => {
    button.addEventListener('click', () => {
      if (ctrl.panelState.workspace?.type !== 'story') return;
      ctrl.panelState.workspace.subroute = 'overview';
      ctrl.refreshPanels(['left', 'center', 'right']);
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-trigger-passive-story]').forEach(trigger => trigger.addEventListener('click', () => {
    const state = stateForStoryElement(ctrl, trigger);
    // 开幕横幅展示/淡出期间阻断剧情推进类点击
    if (ctrl.chat.bannerBlocking(state)) return;
    // 壁垒：对话空间只抽归该学生的闲聊；一般聊天抽全局闲聊（owner = undefined）
    const owner = state.conversationVariantId ?? undefined;
    ctrl.deliverPendingRewardsBeforeStory();
    const result = ctrl.commands.triggerPassiveStory(ctrl.game.getView().activeInit, owner);
    logStoryFailure(ctrl, result);
    ctrl.refreshChatPanel();
  }));
  // 底部发送按钮：本质是带发送交互的 Talklet 的演出形态
  scope.querySelectorAll<HTMLButtonElement>('[data-send]').forEach(sendButton => sendButton.addEventListener('click', () => {
    const state = stateForStoryElement(ctrl, sendButton);
    const owner = state.conversationVariantId ?? null;
    const playback = ctrl.game.story.getPlaybackView(owner);
    // 开幕横幅展示/淡出期间阻断剧情推进类点击（节奏加速一并阻断）
    if (ctrl.chat.bannerBlocking(state)) return;
    const token = sendButton.dataset.storyToken;
    if (playback.phase === 'typing' || playback.phase === 'thinking') {
      if (token) ctrl.commands.accelerateStoryPresentation(owner, token);
      ctrl.refreshChatPanel();
      return;
    }
    if (playback.phase !== 'continue' && playback.phase !== 'input' && playback.phase !== 'idle') return;
    ctrl.deliverPendingRewardsBeforeStory();
    const result = playback.phase === 'idle'
      ? ctrl.commands.clickSend(owner ?? undefined)
      : !token ? null : playback.phase === 'continue'
        ? ctrl.commands.continueStory(owner, token)
        : ctrl.commands.submitStoryInput(owner, token);
    if (result) logStoryFailure(ctrl, result);
    ctrl.refreshChatPanel();
  }));
  scope.querySelectorAll<HTMLButtonElement>('[data-story-choice]').forEach(button => {
    button.addEventListener('click', () => {
      const state = stateForStoryElement(ctrl, button);
      // 开幕横幅展示/淡出期间阻断剧情推进类点击
      if (ctrl.chat.bannerBlocking(state)) return;
      // 聊天沙盒：对话空间的选项推进作用于该角色自己的游标；一般聊天推进全局游标
      const owner = state.conversationVariantId ?? null;
      const token = button.dataset.storyToken;
      if (!token || ctrl.game.story.getPlaybackView(owner).phase !== 'input') return;
      const result = ctrl.commands.submitStoryInput(owner, token, button.dataset.storyChoiceId ?? button.dataset.storyChoice);
      logStoryFailure(ctrl, result);
      ctrl.refreshChatPanel();
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-story-card-token]').forEach(button => {
    button.addEventListener('click', () => {
      const state = stateForStoryElement(ctrl, button);
      if (ctrl.chat.bannerBlocking(state) || ctrl.chat.activeGate(state)) return;
      const owner = state.conversationVariantId;
      const view = owner ? ctrl.game.getStoryView(owner) : ctrl.game.getView().currentStory;
      if (!view?.page.kizuna || view.token !== button.dataset.storyCardToken) return;
      ctrl.panelState.storyGate = { storyId: view.page.kizuna.storyId, owner, mode: 'card',
        sourceOwner: owner, sourceRunId: view.runId, sourceToken: view.token };
      ctrl.refreshChatPanel();
    });
  });
  // 羁绊剧情卡片（流内渲染）：点击弹出确认浮层，确认后启动目标 ActiveStoryEntry
  //（skipConditions，尊重单次完成态；owner 取点击时所在对话空间）
  scope.querySelectorAll<HTMLElement>('[data-kizuna]').forEach(el => {
    el.addEventListener('click', () => {
      // 开幕横幅展示/淡出期间阻断剧情推进类点击
      if (ctrl.chat.bannerBlocking(ctrl.panelState)) return;
      const storyId = el.dataset.kizuna!;
      const binding = el.closest<HTMLElement>('[data-story-card-owner]');
      const owner = binding ? binding.dataset.storyCardOwner || null : ctrl.panelState.conversationVariantId;
      const source = el.closest<HTMLElement>('[data-story-source-run]');
      const sourceOwner = source ? source.dataset.storySourceOwner || null : undefined;
      if (source) {
        const current = sourceOwner ? ctrl.game.getStoryView(sourceOwner) : ctrl.game.getView().currentStory;
        if (current?.runId !== source.dataset.storySourceRun) return;
      }
      ctrl.openStoryWorkspace({ selectedEntryId: storyId, conversationOwner: owner, mode: 'overview' });
      ctrl.panelState.storyGate = { storyId, owner, mode: 'card',
        ...(source ? { sourceRunId: source.dataset.storySourceRun, sourceOwner } : {}) };
      ctrl.refreshPanels(['center']);
    });
  });
}
