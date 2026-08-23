// @vitest-environment happy-dom
// ============================================================
// controller-init-select.test.ts — 选择页交互：购买后局部刷新
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { UIController } from '../../src/ui/controller';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';

describe('UIController Init 选择页', () => {
  let game: GameInstance;
  let root: HTMLElement;
  let controller: UIController;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    controller = new UIController(game, root);
    controller.mount();
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
    localStorage.clear();
  });

  /** 进入重选流程并渲染选择页。 */
  const showSelectPage = () => {
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = true;
    (controller as unknown as { renderInitSelect(): void }).renderInitSelect();
  };

  const snapshot = () => ({
    rowOwned: root.querySelector(`[data-init-select="${MILLENNIUM}"]`)?.textContent?.includes('已解锁') ?? false,
    copyHasPurchase: !!root.querySelector('.init-orb-copy [data-init-purchase]'),
    copyHasEnter: !!root.querySelector('.init-orb-copy [data-init]'),
  });

  it('购买选中项后行与详情立即刷新，不触发整页重渲染', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    showSelectPage();

    // 选中千禧年
    const row = root.querySelector<HTMLButtonElement>(`[data-init-select="${MILLENNIUM}"]`)!;
    row.click();
    expect(snapshot().copyHasPurchase).toBe(true);

    // 点击购买 CTA → 行文本与详情 CTA 应立即更新
    root.querySelector<HTMLButtonElement>('[data-init-purchase]')!.click();
    const after = snapshot();
    expect(after.rowOwned).toBe(true);
    expect(after.copyHasPurchase).toBe(false);
    expect(after.copyHasEnter).toBe(true);

    // 轮盘 DOM 未被整页重建：卡片节点引用保持不变（无飞入/丢绑定）
    expect(root.contains(row)).toBe(true);
  });
});
