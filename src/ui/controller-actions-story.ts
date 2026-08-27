// ============================================================
// ui/controller-actions-story.ts — UI 控制器：剧情事件绑定
// 从 controller.ts 的 bindActions 拆出：start-story / replay / 层级导航 /
//   archive / 被动闲聊 / send / story-choice / kizuna
// ============================================================

import type { StoryAdvanceResult, StoryStartResult } from '../engine/types';
import { storyErrorText } from './components/story';
import type { UIController } from './controller';

/** 剧情操作失败 → devLog 记录（结果带 error 时）。 */
function logStoryFailure(ctrl: UIController, result: StoryStartResult | StoryAdvanceResult): void {
  if (result.success) return;
  ctrl.game.devLog.record(`剧情操作失败：${storyErrorText[result.error] ?? result.error}`, {
    source: 'story',
    level: 'warning',
    details: result.error,
  });
}

/** 绑定剧情域事件（render 后调用）。 */
export function bindStoryActions(ctrl: UIController): void {
  // 剧情：首次进入 Entry 时切到剧情所需聊天空间（owner = VariantId → 学生对话空间沙盒；
  // 无 owner → 一般聊天流全局沙盒），并切到聊天 tab，让演出立即可见。
  // 不移动 Area：startActiveStory 只启动演出游标，不触发 travelToArea。
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-start-story]').forEach(button => {
    button.addEventListener('click', () => {
      const storyId = button.dataset.startStory!;
      const entry = ctrl.game.registry.activeStories.get(storyId);
      const owner = entry?.owner ?? null;
      ctrl.panelState.conversationVariantId = owner;
      ctrl.panelState.centerTab = 'chat';
      ctrl.panelState.leftTab = 'story';
      ctrl.scroll.forceToBottom();
      const result = ctrl.game.startActiveStory(storyId, owner);
      logStoryFailure(ctrl, result);
      ctrl.render();
    });
  });
  // 重阅读：故事栏已完成 + replayable 的内容项。
  // 点击后前往该 Entry 归属的对话空间演出（owner = VariantId → 学生对话空间沙盒；
  // 无 owner → 一般聊天流全局沙盒），并切到聊天 tab，让演出立即可见。
  // 重读不移动 Area：replayStory 只重置演出游标，不触发 travelToArea。
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-replay-story]').forEach(button => {
    button.addEventListener('click', () => {
      const storyId = button.dataset.replayStory!;
      const entry = ctrl.game.registry.activeStories.get(storyId);
      const owner = entry?.owner ?? null;
      ctrl.panelState.conversationVariantId = owner;
      ctrl.panelState.centerTab = 'chat';
      ctrl.panelState.leftTab = 'story';
      ctrl.scroll.forceToBottom();
      const result = ctrl.game.replayStory(storyId, owner);
      logStoryFailure(ctrl, result);
      ctrl.render();
    });
  });
  // 故事层级导航：向内逐层下钻（分类 → 篇 → 章）
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-story-nav]').forEach(button => {
    button.addEventListener('click', () => {
      const path = (button.dataset.storyNav ?? '').split(':').filter(Boolean);
      ctrl.panelState.storyNavPath = path;
      ctrl.panelState.leftTab = 'story';
      ctrl.render();
    });
  });
  // 故事层级导航：面包屑返回指定深度
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-story-back]').forEach(button => {
    button.addEventListener('click', () => {
      const depth = Number(button.dataset.storyBack ?? 0);
      ctrl.panelState.storyNavPath = ctrl.panelState.storyNavPath.slice(0, depth);
      ctrl.panelState.leftTab = 'story';
      ctrl.render();
    });
  });
  // 故事"档案"入口：中栏切换档案临时页
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-story-archive]').forEach(button => {
    button.addEventListener('click', () => {
      ctrl.panelState.centerTab = 'archive-draft';
      ctrl.render();
    });
  });
  ctrl.root.querySelector<HTMLButtonElement>('[data-trigger-passive-story]')?.addEventListener('click', () => {
    // 壁垒：对话空间只抽归该学生的闲聊；一般聊天抽全局闲聊（owner = undefined）
    const owner = ctrl.panelState.conversationVariantId ?? undefined;
    const result = ctrl.game.triggerPassiveStory(ctrl.game.getView().activeInit, owner);
    logStoryFailure(ctrl, result);
    ctrl.render();
  });
  // 底部发送按钮：本质是带发送交互的 Talklet 的演出形态
  ctrl.root.querySelector<HTMLButtonElement>('[data-send]')?.addEventListener('click', () => {
    // 误触发的文本选区（拖拽选中气泡文字）不算点击，避免吞掉真实点击
    const sel = document.getSelection();
    if (sel && sel.type === 'Range' && !sel.isCollapsed) return;
    // 壁垒：聊天空间里点发送走"该学生专属闲聊"抽取；一般聊天抽全局
    const owner = ctrl.panelState.conversationVariantId ?? undefined;
    const result = ctrl.game.clickSend(owner);
    if (result.type === 'completed') {
      // 回显决策由引擎给出（非 click 页 + 有 sendText + 未 muteReply）：
      // 满足时才以"老师"身份发出右侧气泡；click / 静默发送不产生玩家回复气泡
      if (result.echoReply) {
        ctrl.chat.pushPlayerReply(ctrl.panelState, result.sentText);
      }
      // 向后吸收的过渡页（推进后自动跳过的纯展示页）同步进聊天流
      ctrl.chat.pushAbsorbed(ctrl.panelState, result.absorbed ?? []);
    } else if (result.type === 'working') {
      // 多击任务：尚未完成，仅进度条 +1（本次点击不发送、不推进），render() 自动刷新
    } else if (result.type === 'idle' && result.started) {
      // 无剧情时点击触发了被动闲聊
    }
    ctrl.render();
  });
  ctrl.root.querySelectorAll<HTMLButtonElement>('[data-story-choice]').forEach(button => {
    button.addEventListener('click', () => {
      // 聊天沙盒：对话空间的选项推进作用于该角色自己的游标；一般聊天推进全局游标
      const owner = ctrl.panelState.conversationVariantId ?? undefined;
      const result = ctrl.game.advanceStory(Number(button.dataset.storyChoice), owner);
      logStoryFailure(ctrl, result);
      ctrl.render();
    });
  });
  // 羁绊剧情卡片（流内渲染）：点击启动目标 ActiveStoryEntry（skipConditions，尊重单次完成态）
  ctrl.root.querySelectorAll<HTMLElement>('[data-kizuna]').forEach(el => {
    el.addEventListener('click', () => {
      const storyId = el.dataset.kizuna!;
      const owner = ctrl.panelState.conversationVariantId ?? undefined;
      const result = ctrl.game.startCardStory(storyId, owner);
      logStoryFailure(ctrl, result);
      ctrl.render();
    });
  });
}
