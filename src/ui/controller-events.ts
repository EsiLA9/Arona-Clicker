// ============================================================
// ui/controller-events.ts — UI 控制器：EventBus 订阅
// 从 controller.ts 拆出：mount 内事件驱动订阅（揭示刷新 / 奖励排队 /
//   池 gate 解锁 / 移动通知 / 聊天流清理与演出文本）
// ============================================================

import { createUIContext } from './context';
import { refreshRevealIfChanged } from './controller-core';
import type { UIController } from './controller';

/** 绑定引擎 EventBus 事件 → UI 响应（mount 时调用一次）。 */
export function bindEvents(ctrl: UIController): void {
  // EventBus 广播 → 揭示条件判断 → 变化则反射到 UI（无需玩家交互才刷新）
  ctrl.game.eventBus.onAny(event => {
    // 生产类高频事件由 refreshLight 覆盖数值，不参与揭示评估
    if (event.type === 'tick' || event.type === 'spotProduced') return;
    refreshRevealIfChanged(ctrl);
    ctrl.refreshLogPanel();
  });
  // 剧情完结奖励结算 → 排队（不立即渲染）：等点击处理器推完玩家回复气泡、
  // render 内同步完最后一页台词后，再统一落账，保证聊天流顺序正确
  ctrl.game.eventBus.on('storyRewarded', event => {
    if (event.type !== 'storyRewarded') return;
    const ctx = createUIContext(ctrl.game);
    const summary = event.effects.map(effect => {
      if (effect.op === 'addResource' && effect.target) {
        return `${ctx.nameOf('resource', effect.target)} +${effect.value}`;
      }
      return effect.op;
    }).join('、');
    const parts = [
      event.source === 'conditional' ? '条件达成' : event.source === 'first' ? '首次完成' : '再次完成',
      summary || '无奖励',
      ...(event.flags.length > 0 ? [`解锁标记 ${event.flags.join('、')}`] : []),
    ];
    ctrl.pendingRewardChats.push(parts.join(' · '));
  });
  // 池 gate 解锁 → 奖励样式通知（如「日程表攻防」开启深夜闲聊）
  ctrl.game.eventBus.on('poolGateChanged', event => {
    if (event.type !== 'poolGateChanged' || !event.available) return;
    const ctx = createUIContext(ctrl.game);
    ctrl.pendingRewardChats.push(`解锁闲聊池 · ${ctx.nameOf('pool', event.poolId)}`);
  });
  // Story 的 travelToArea effect 移动（notice=true）→ 「移动到了 XX」迷你条目
  //（REWARD 风格、无小字符）。进 travel 队列：render 时先于剧情内容入流
  ctrl.game.eventBus.on('storyAreaTraveled', event => {
    if (event.type !== 'storyAreaTraveled') return;
    const ctx = createUIContext(ctrl.game);
    ctrl.pendingTravelChats.push(`移动到了 ${ctx.nameOf('area', event.areaId)}`);
  });
  // 好感跨级 → 该角色对话空间聊天流 reward 风格提示行（第一迭代唯一升级播报）
  ctrl.game.eventBus.on('affectionChanged', event => {
    if (event.type !== 'affectionChanged' || !event.leveledUp) return;
    const name = ctrl.game.rosterSystem.getVariant(event.variantId)?.displayName ?? event.variantId;
    ctrl.chat.pushToVariant(ctrl.panelState, event.variantId, {
      kind: 'reward',
      text: `与 ${name} 的羁绊提升至 Lv.${event.newLevel}`,
    });
  });
  // 聊天流演出服务（Talklet）：清理全部聊天内容
  ctrl.game.eventBus.on('chatFlowCleared', () => {
    ctrl.chat.clearAll(ctrl.panelState);
  });
  // 聊天流演出服务（Talklet）：删除全部可变位置的演出文本（保留聊天历史）
  ctrl.game.eventBus.on('chatTextClearedAll', () => {
    ctrl.chat.clearAllTexts(ctrl.panelState);
  });
  // Story 开始前默认清理：避免中途进入（如羁绊卡片 startCardStory）时残留上一场的演出文本
  ctrl.game.eventBus.on('storyTriggered', () => {
    ctrl.chat.clearAllTexts(ctrl.panelState);
  });
  // 开幕标题横幅（showOpeningTitle 效果呼出）：挂到当前活跃流；标题优先级
  // effect.value → entry.openingTitle → StoryDef.name。发起方管线随后必 render，此处只写状态
  ctrl.game.eventBus.on('openingTitleShown', event => {
    if (event.type !== 'openingTitleShown') return;
    const convId = ctrl.panelState.conversationVariantId;
    const view = convId ? ctrl.game.getStoryView(convId) : ctrl.game.getView().currentStory;
    let title = event.title;
    if (!title && view) {
      const entry = [...ctrl.game.registry.storyEntries.values()].find(e => e.storyId === view.storyId);
      title = entry?.openingTitle ?? ctrl.game.registry.stories.get(view.storyId)?.name;
    }
    if (!title) return;
    ctrl.chat.showBanner(convId ?? '#global', title);
  });
  // Story 完结默认清理：结束后自动删除全部演出文本覆盖层（与 clearAllChatText 一致）
  ctrl.game.eventBus.on('storyCompleted', () => {
    ctrl.chat.clearAllTexts(ctrl.panelState);
  });
  // §3 羁绊尾巴：完结剧情的关联尾巴在玩家正在观看该角色对话空间时立即推送；
  // 不在该空间则留在就绪队列顶（通讯录徽标提示，打开时经输入中提示送达）
  ctrl.game.eventBus.on('storyCompleted', event => {
    if (event.type !== 'storyCompleted') return;
    const convId = ctrl.panelState.conversationVariantId;
    if (!convId) return;
    if (ctrl.game.getStoryView(convId)) return; // 沙盒有进行中演出（如 insert 链未完）
    const completedEntry = [...ctrl.game.registry.storyEntries.values()]
      .find(e => e.storyId === event.storyId);
    const hasTail = [...ctrl.game.registry.passiveStories.values()].some(tail =>
      tail.pushAfterStory === event.storyId
      && tail.owner === convId
      && (!completedEntry?.owner || completedEntry.owner === tail.owner)
      && !ctrl.game.story.hasCompletedStory(tail.storyId));
    if (hasTail) {
      ctrl.commands.triggerTailPush(convId, event.storyId);
      ctrl.refreshChatPanel();
    }
  });
  // 聊天流演出服务（Talklet）：显示演出专用文本（临时 id + 百分比坐标，可嵌入标准 Talklet）
  ctrl.game.eventBus.on('chatTextShown', event => {
    if (event.type !== 'chatTextShown') return;
    ctrl.chat.pushChatText(ctrl.panelState, {
      id: event.id,
      text: event.text,
      talklet: event.talklet,
      x: event.x ?? 0,
      y: event.y ?? 1,
      align: event.align ?? 'left',
      kind: event.kind,
      style: event.style,
      title: event.title,
      buttonText: event.buttonText,
      targetStoryId: event.targetStoryId,
      timestamp: Date.now(),
    });
    ctrl.refreshChatPanel();
  });
  // 聊天流演出服务（Talklet）：按临时 id 擦除演出专用文本
  ctrl.game.eventBus.on('chatTextCleared', event => {
    if (event.type !== 'chatTextCleared') return;
    ctrl.chat.clearChatText(ctrl.panelState, event.id);
    ctrl.refreshChatPanel();
  });
}
