// @vitest-environment happy-dom
// ============================================================
// controller-global-enhancement.test.ts — 选择页翻面 + GlobalEnhancement 购买
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';

const OFFICE = 'base:init:schale_office';
const FOUNDATION = 'base:enhancement:foundation';

describe('UIController 选择页翻面（Init ⇄ GlobalEnhancement）', () => {
  let game: GameInstance;
  let root: HTMLElement;
  let controller: UIController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    controller = new UIController(game, root);
    controller.mount();
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
    vi.clearAllTimers();
    localStorage.clear();
    vi.useRealTimers();
  });

  /** 进入选择页（重选流程）。 */
  const showSelectPage = () => {
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = true;
    (controller as unknown as { renderInitSelect(): void }).renderInitSelect();
  };

  it('选择页双面叠放、仅一面可见，翻面动画后切换圆盘方向与可见面', () => {
    showSelectPage();
    // 双面都在 DOM，但只有 Init 面激活；单一共享圆盘
    expect(root.querySelector('.face-init .init-orb-copy')).not.toBeNull();
    expect(root.querySelector('.face-enh .enh-orb-copy')).not.toBeNull();
    expect(root.querySelectorAll('.init-orb-disc')).toHaveLength(1);
    expect(root.querySelector('.face-init')?.classList.contains('is-inactive')).toBe(false);
    expect(root.querySelector('.face-enh')?.classList.contains('is-inactive')).toBe(true);
    expect(root.querySelector('.selector-shell')?.classList.contains('init-mode')).toBe(true);

    // 点击翻面 → 动画未完成前仍是旧方向，推进后切换
    const flip = root.querySelector<HTMLButtonElement>('[data-flip-selection-face]')!;
    expect(flip).not.toBeNull();
    flip.click();
    expect(root.querySelector('.selector-shell')?.classList.contains('enh-mode')).toBe(false);
    vi.advanceTimersByTime(180);
    expect(root.querySelector('.selector-shell')?.classList.contains('enh-mode')).toBe(true);
    vi.advanceTimersByTime(420);
    expect(root.querySelector('.face-init')?.classList.contains('is-inactive')).toBe(true);
    expect(root.querySelector('.face-enh')?.classList.contains('is-inactive')).toBe(false);
    expect(root.querySelector('.selector-shell')?.classList.contains('enh-mode')).toBe(true);

    // 再翻回 Init 面
    flip.click();
    vi.advanceTimersByTime(600);
    expect(root.querySelector('.face-init')?.classList.contains('is-inactive')).toBe(false);
    expect(root.querySelector('.face-enh')?.classList.contains('is-inactive')).toBe(true);
    expect(root.querySelector('.selector-shell')?.classList.contains('init-mode')).toBe(true);
  });

  it('GlobalEnhancement 面购买后行与详情立即刷新，不触发整页重渲染', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    showSelectPage();
    root.querySelector<HTMLButtonElement>('[data-flip-selection-face]')!.click();
    vi.advanceTimersByTime(600); // 完成翻面动画

    const row = root.querySelector<HTMLButtonElement>(`[data-global-enh-select="${FOUNDATION}"]`)!;
    expect(row).not.toBeNull();
    expect(root.querySelector('.face-enh')?.classList.contains('is-inactive')).toBe(false);

    // 显式选中 foundation，避免测试依赖全局强化价格排序
    row.click();
    const buy = root.querySelector<HTMLButtonElement>(`[data-global-enh-purchase="${FOUNDATION}"]`);
    expect(buy).not.toBeNull();
    buy!.click();

    // 行文本与详情立即更新为「已激活」
    expect(root.querySelector(`[data-global-enh-select="${FOUNDATION}"]`)?.textContent).toContain('已激活');
    expect(root.querySelector('.face-enh .enh-orb-copy')?.textContent).toContain('已激活');
    expect(root.contains(row)).toBe(true); // 轮盘 DOM 未被整页重建
  });

  it('mid-game 从强化面板进入全局强化选择页，含「返回游戏」逃生口', () => {
    // 正常游戏进行中（started = true）
    (controller as unknown as { started: boolean }).started = true;
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = false;
    // 直接打开全局强化选择页（模拟 mid-game 入口）
    controller.openGlobalEnhancementSelect();
    expect(root.querySelector('.face-enh .enh-orb-copy')).not.toBeNull();
    expect(root.querySelector('.face-enh')?.classList.contains('is-inactive')).toBe(false);
    expect(root.querySelector('.face-init')?.classList.contains('is-inactive')).toBe(true);
    expect(root.querySelector('.selector-shell')?.classList.contains('enh-mode')).toBe(true);

    // 有「返回游戏」按钮
    const backBtn = root.querySelector<HTMLButtonElement>('[data-back-to-game]');
    expect(backBtn).not.toBeNull();
  });
});
