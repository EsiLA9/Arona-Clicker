// @vitest-environment happy-dom
// ============================================================
// chat-notice-order.test.ts — 聊天流通知次序与奖励延迟
// 覆盖：进入 Area 通知先于该次移动触发的剧情内容入流；
//       奖励通知延迟入流（Story 末尾留一拍，~0.8s 后统一落账）。
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { UIController } from '../../src/ui/controller';
import { finishWelcome } from '../engine/story-test-fixtures';

const OFFICE = 'base:init:schale_office';

describe('聊天流通知次序（travel 先行 / 奖励延迟）', () => {
  let game: GameInstance;
  let root: HTMLElement;
  let controller: UIController;
  let panel: any;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    controller = new UIController(game, root);
    controller.mount();
    controller.startNewGame(OFFICE);
    finishWelcome(game);
    panel = (controller as unknown as { panelState: any }).panelState;
  });

  afterEach(() => {
    game.stop();
    localStorage.clear();
  });

  it('进入 Area 通知先于该次移动触发的剧情内容入流', () => {
    // 星野对话空间：羁绊剧情首页为 narration（可入流），验证通知排在其前
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    panel.conversationVariantId = 'Hoshino';
    controller.pendingTravelChats.push('移动到了 测试区域');
    game.story.startCardStory('base:activestory:bond_hoshino_1', 'Hoshino');
    controller.render();
    const stream = controller.activeStream();
    const travelIdx = stream.findIndex(e => e.kind === 'reward' && e.text.includes('移动到了'));
    const storyIdx = stream.findIndex(e => e.kind !== 'reward');
    expect(travelIdx).toBeGreaterThanOrEqual(0);
    expect(storyIdx).toBeGreaterThan(travelIdx);
  });

  it('奖励通知延迟入流：render 后不立即出现，约一拍后统一落账', () => {
    vi.useFakeTimers();
    try {
      controller.pendingRewardChats.push('首次完成 · 测试奖励');
      controller.render();
      expect(controller.activeStream().some(e => e.text.includes('测试奖励'))).toBe(false);
      vi.advanceTimersByTime(UIController.REWARD_REVEAL_DELAY_MS);
      expect(controller.activeStream().some(e => e.kind === 'reward' && e.text.includes('测试奖励'))).toBe(true);
      // 落账后队列清空，不重复入流
      controller.render();
      expect(controller.activeStream().filter(e => e.text.includes('测试奖励'))).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('奖励通知等待故事彻底结束：完结即推的尾巴播放中顺延，游标清空后才落账', () => {
    vi.useFakeTimers();
    try {
      game.mutations.acquireCharacter('Hoshino', 'gacha');
      panel.conversationVariantId = 'Hoshino';
      controller.pendingRewardChats.push('首次完成 · 测试奖励');
      // 羁绊剧情开播（游标占用）：到期检查发现演出未彻底结束 → 顺延
      game.story.startCardStory('base:activestory:bond_hoshino_1', 'Hoshino');
      controller.render();
      vi.advanceTimersByTime(UIController.REWARD_REVEAL_DELAY_MS);
      expect(controller.activeStream().some(e => e.text.includes('测试奖励'))).toBe(false);
      // 播完整条羁绊剧情（尾巴未完结仍会即时推送，一并播完）→ 游标清空
      const drain = () => {
        for (let i = 0; i < 30; i++) {
          const r = game.story.advanceStory(undefined, 'Hoshino');
          if (!r.success) {
            if (r.error === 'ChoiceRequired') { game.story.advanceStory(0, 'Hoshino'); continue; }
            break;
          }
          if ('finished' in r && r.finished) break;
        }
      };
      drain();
      drain();
      expect(game.getStoryView('Hoshino')).toBeNull();
      controller.render();
      vi.advanceTimersByTime(UIController.REWARD_REVEAL_DELAY_MS);
      expect(controller.activeStream().some(e => e.kind === 'reward' && e.text.includes('测试奖励'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
