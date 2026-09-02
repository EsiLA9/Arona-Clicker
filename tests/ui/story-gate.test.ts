// @vitest-environment happy-dom
// ============================================================
// story-gate.test.ts — 剧情入口确认浮层 + 开幕标题横幅（集成）
// 覆盖：kizuna 卡片 / 故事栏条目点击 → 浮层出现且剧情未启动；
//   确认 → 按 mode 启动；取消 → 关闭未启动；横幅渲染与 3s 自动消失。
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { bindStoryActions } from '../../src/ui/controller-actions-story';
import { finishWelcome } from '../engine/story-test-fixtures';

const OFFICE = 'base:init:schale_office';
const HOSHINO = 'Hoshino';
const BOND = 'base:activestory:bond_hoshino_1';
const FLOW_SHOW = 'base:activestory:schale_flow_show';

describe('UIController 剧情入口确认浮层', () => {
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
    game.mutations.acquireCharacter(HOSHINO, 'gacha');
    finishWelcome(game);
    panel = (controller as unknown as { panelState: any }).panelState;
  });

  afterEach(() => {
    game.stop();
    localStorage.clear();
  });

  it('kizuna 卡片点击 → 确认浮层出现且剧情未启动；确认后 startCardStory 启动', () => {
    panel.conversationVariantId = HOSHINO;
    controller.render();
    expect(game.getStoryView(HOSHINO)).toBeNull();
    // 注入 kizuna 卡片并重新绑定（复用 controller-actions-story 的 data-kizuna 处理器）
    root.innerHTML = '<div class="chat-pane"><div class="kizuna-card" data-kizuna="base:activestory:bond_hoshino_1"></div></div>';
    bindStoryActions(controller);
    root.querySelector<HTMLElement>('[data-kizuna]')!.click();
    // 点击后：浮层出现、剧情未启动、卡片仍在（浮层覆盖其上）
    expect(root.querySelector('[data-story-gate]')).not.toBeNull();
    expect(game.getStoryView(HOSHINO)).toBeNull();
    expect(panel.storyGate).toEqual({ storyId: BOND, owner: HOSHINO, mode: 'card' });
    // 确认 → 剧情在该学生沙盒启动
    root.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click();
    expect(panel.storyGate).toBeNull();
    expect(root.querySelector('[data-story-gate]')).toBeNull();
    expect(game.getStoryView(HOSHINO)?.storyId).toBe(BOND);
  });

  it('kizuna 浮层取消（取消按钮）→ 关闭且剧情未启动', () => {
    panel.conversationVariantId = HOSHINO;
    controller.render();
    root.innerHTML = '<div class="chat-pane"><div class="kizuna-card" data-kizuna="base:activestory:bond_hoshino_1"></div></div>';
    bindStoryActions(controller);
    root.querySelector<HTMLElement>('[data-kizuna]')!.click();
    expect(root.querySelector('[data-story-gate]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.story-gate-cancel')!.click();
    expect(panel.storyGate).toBeNull();
    expect(root.querySelector('[data-story-gate]')).toBeNull();
    expect(game.getStoryView(HOSHINO)).toBeNull();
  });

  it('kizuna 浮层遮罩空白点击取消，卡片内点击冒泡不关闭', () => {
    panel.conversationVariantId = HOSHINO;
    controller.render();
    root.innerHTML = '<div class="chat-pane"><div class="kizuna-card" data-kizuna="base:activestory:bond_hoshino_1"></div></div>';
    bindStoryActions(controller);
    root.querySelector<HTMLElement>('[data-kizuna]')!.click();
    const overlay = root.querySelector<HTMLElement>('.story-gate-overlay')!;
    // 卡片内点击（冒泡到遮罩）：target ≠ currentTarget → 不关闭
    overlay.querySelector<HTMLElement>('.story-gate-band')!.click();
    expect(panel.storyGate).not.toBeNull();
    // 遮罩自身点击：target = currentTarget → 关闭
    overlay.click();
    expect(panel.storyGate).toBeNull();
    expect(game.getStoryView(HOSHINO)).toBeNull();
  });

  it('故事栏条目点击 → 浮层（保留切 tab 行为）；确认后启动 active 剧情', () => {
    root.innerHTML = `<button data-start-story="${FLOW_SHOW}"></button>`;
    bindStoryActions(controller);
    root.querySelector<HTMLButtonElement>('[data-start-story]')!.click();
    expect(panel.centerTab).toBe('chat');
    expect(panel.storyGate).toEqual({ storyId: FLOW_SHOW, owner: null, mode: 'active' });
    expect(game.getView().currentStory).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click();
    expect(game.getView().currentStory?.storyId).toBe(FLOW_SHOW);
  });

  it('故事栏重读点击 → 浮层确认文案为「重新观看」；确认后 replayStory', () => {
    const welcome = 'base:activestory:schale_welcome';
    root.innerHTML = `<button data-replay-story="${welcome}"></button>`;
    bindStoryActions(controller);
    root.querySelector<HTMLButtonElement>('[data-replay-story]')!.click();
    expect(panel.storyGate).toEqual({ storyId: welcome, owner: null, mode: 'replay' });
    const card = root.querySelector('[data-story-gate]')!;
    expect(card.textContent).toContain('重新观看');
    root.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click();
    expect(game.getView().currentStory?.storyId).toBe(welcome);
  });

  it('开幕横幅：呼出后连续播放（重渲染断点续播不闪动），展示期结束自动消失', () => {
    vi.useFakeTimers();
    try {
      panel.conversationVariantId = HOSHINO;
      controller.render();
      // 事件订阅在 mount 内注册；applyEffects 同步链路直达 ChatStream
      game.effectEngine.applyEffects([{ op: 'showOpeningTitle', target: '', value: '星野 · 午后的堤防' }]);
      controller.render();
      const banner = root.querySelector('[data-story-banner]');
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toContain('星野 · 午后的堤防');
      // 推进 0.9s（模拟打字门控/连发触发的重渲染）：横幅仍在，且携带负 animation-delay 断点续播
      vi.advanceTimersByTime(900);
      controller.render();
      const resumed = root.querySelector('[data-story-banner]');
      expect(resumed).not.toBeNull();
      expect(resumed!.getAttribute('style') ?? '').toMatch(/animation-delay:\s*-900ms/);
      // 非阻塞（pointer-events: none）由 story-overlays.css 承担，happy-dom 不加载外部 CSS 不在此断言
      vi.advanceTimersByTime(29100);
      expect(root.querySelector('[data-story-banner]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('开幕横幅展示/淡出期间阻断剧情推进点击，结束后恢复', () => {
    vi.useFakeTimers();
    try {
      panel.conversationVariantId = HOSHINO;
      controller.render();
      // 卡片入口启动羁绊剧情：首页声明 showOpeningTitle → 开局即呼出横幅
      game.story.startCardStory(BOND, HOSHINO);
      controller.render();
      expect(root.querySelector('[data-story-banner]')).not.toBeNull();
      expect(panel.sendGate).toBe('typing');
      const pageBefore = game.getStoryView(HOSHINO)!.pageIndex;
      // 展示期间：推进 / 选项 / 卡片点击一律被阻断
      root.querySelector<HTMLButtonElement>('[data-send]')!.click();
      expect(game.getStoryView(HOSHINO)!.pageIndex).toBe(pageBefore);
      // 展示期结束：横幅移除、阻断解除，推进恢复
      vi.advanceTimersByTime(30000);
      expect(root.querySelector('[data-story-banner]')).toBeNull();
      expect(panel.sendGate).toBeNull();
      root.querySelector<HTMLButtonElement>('[data-send]')!.click();
      expect(game.getStoryView(HOSHINO)!.pageIndex).toBe(pageBefore + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('已完结羁绊剧情：卡片再点击 → 浮层为「重新开始」，游标被占用也能确认重开', () => {
    panel.conversationVariantId = HOSHINO;
    controller.render();
    // 播完整条羁绊剧情（选项页选第一项）；完结后尾巴即时推送，一并播完腾出游标
    const drain = () => {
      for (let guard = 0; guard < 30; guard++) {
        const r = game.story.advanceStory(undefined, HOSHINO);
        if (!r.success) {
          if ((r as { error?: string }).error === 'ChoiceRequired') {
            game.story.advanceStory(0, HOSHINO);
            continue;
          }
          break;
        }
        if ('finished' in r && r.finished) break;
      }
    };
    game.story.startCardStory(BOND, HOSHINO);
    drain();
    drain(); // 第二轮：尾巴即时推送的演出播完
    expect(game.getStoryView(HOSHINO)).toBeNull();
    controller.chat.reset(); // 清掉开局呼出横幅的阻断期（真实计时），否则卡片点击被守卫吞掉
    controller.render();
    // 再度出现的前置内容（kizuna 卡片）→ 点击 → 浮层确认文案为「重新开始」
    root.innerHTML = '<div class="chat-pane"><div class="kizuna-card" data-kizuna="base:activestory:bond_hoshino_1"></div></div>';
    bindStoryActions(controller);
    root.querySelector<HTMLElement>('[data-kizuna]')!.click();
    const card = root.querySelector('[data-story-gate]')!;
    expect(card.textContent).toContain('重新开始');
    // 死锁解除回归：确认时游标被其他剧情占用（台阶剧情），卡片重开照常清游标启动。
    // render 会重建 DOM：重新注入卡片再点
    expect(game.story.startStory('base:passivestory:affinity_hoshino_1', 'passive', HOSHINO).success).toBe(true);
    controller.render();
    root.innerHTML = '<div class="chat-pane"><div class="kizuna-card" data-kizuna="base:activestory:bond_hoshino_1"></div></div>';
    bindStoryActions(controller);
    root.querySelector<HTMLElement>('[data-kizuna]')!.click();
    root.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click();
    const view = game.getStoryView(HOSHINO);
    expect(view?.storyId).toBe(BOND);
    expect(view?.pageIndex).toBe(0);
  });
});
