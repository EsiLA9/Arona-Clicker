// @vitest-environment happy-dom
// ============================================================
// controller-init-select.test.ts — 选择页交互：购买后局部刷新
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
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
    game.inits.startNewGame(OFFICE);
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

  it('resetSessionPanel 彻底重置会话 UI：退出对话空间、清空学生聊天流与选中差分', () => {
    const panel = (controller as unknown as { panelState: any }).panelState;
    // 模拟上一会话残留：打开过星野对话空间并留了聊天记录
    panel.conversationVariantId = 'Hoshino';
    panel.selectedVariantId = 'Hoshino';
    panel.studentChats['Hoshino'] = [{ id: 1, kind: 'talk', text: '旧消息', timestamp: 0 }];
    panel.chatEntries = [{ id: 9, kind: 'talk', text: '一般聊天旧消息', timestamp: 0 }];

    (controller as unknown as { resetSessionPanel(): void }).resetSessionPanel();

    expect(panel.conversationVariantId).toBeNull();
    expect(panel.selectedVariantId).toBeNull();
    expect(panel.studentChats).toEqual({});
    expect(panel.chatEntries).toEqual([]);
    expect(panel.leftTab).toBe('area');
    expect(panel.centerTab).toBe('chat');
    expect(panel.rightTab).toBe('spot');
  });

  it('引擎层 startNewGame 产生干净的 per-Init 状态（资源/flag/剧情记录清空）', () => {
    game.mutations.changeResource('base:resource:credit', 12345);
    game.mutations.setFlag('some_flag', '1');
    // 再次开启新游戏（同一 Init）
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
    const view = game.getView();
    expect(view.resources['base:resource:credit'] ?? 0).toBe(0); // 新会话资源归零
    expect(game.state.flags['some_flag']).toBeUndefined(); // 旧会话 flag 已清空
    expect(game.state.storyLog).toEqual([]); // 剧情完成记录清空（startNewGame 重置会话记录）
  });
});
