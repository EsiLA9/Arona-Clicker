// @vitest-environment happy-dom
// ============================================================
// controller-global-enhancement.test.ts — 选择节点图 + GlobalEnhancement 购买
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { projectPlane } from '../../src/ui/components/navigation/selector-graph';

const OFFICE = 'base:init:schale_office';
const FOUNDATION = 'base:enhancement:foundation';

describe('UIController 选择节点图（Init / GlobalEnhancement）', () => {
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
    vi.restoreAllMocks();
    game.stop();
    localStorage.clear();
  });

  /** 进入选择页（重选流程）。 */
  const showSelectPage = () => {
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = true;
    (controller as unknown as { renderInitSelect(): void }).renderInitSelect();
  };

  /** 图上节点是 SVG <g>：用冒泡 click 走与真实指针一致的选择路径。 */
  const clickNode = (selector: string): SVGElement => {
    const node = root.querySelector<SVGElement>(selector)!;
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return node;
  };

  it('选择页使用单一节点画布同时呈现世界线与全局强化，不再渲染轮盘 / 翻面控件', () => {
    showSelectPage();

    expect(root.querySelector('[data-selector-graph]')).not.toBeNull();
    expect(root.querySelector('[data-selector-workbench]')).not.toBeNull();
    expect(root.querySelectorAll('[data-selector-node]').length).toBeGreaterThan(1);
    expect(root.querySelector('[data-init-select]')).not.toBeNull();
    expect(root.querySelector('[data-global-enh-select]')).not.toBeNull();

    expect(root.querySelector('.init-wheel')).toBeNull();
    expect(root.querySelector('.selector-face')).toBeNull();
    expect(root.querySelector('[data-flip-selection-face]')).toBeNull();
  });

  it('节点选中切换工作台与聚焦主题，不重建节点、不触碰运行状态', () => {
    showSelectPage();
    const initNode = clickNode(`[data-init-select="${OFFICE}"]`);
    expect(controller.selectorPage.selectedInitId).toBe(OFFICE);

    const beforeState = { ...game.state };
    const enhNode = clickNode(`[data-global-enh-select="${FOUNDATION}"]`);

    expect(controller.selectorPage.selectedEnhId).toBe(FOUNDATION);
    expect(controller.selectorPage.selectedInitId).toBe(OFFICE);
    expect(root.querySelector('[data-selector-graph]')?.getAttribute('data-selector-selected-kind')).toBe('global-enh');
    expect(root.querySelector('.selector-workbench-title')?.textContent).toBe('全能基建');
    expect(root.querySelector('[data-selector-workbench-body]')?.textContent).toContain('全局信用点产出');
    expect(root.contains(initNode)).toBe(true);
    expect(root.contains(enhNode)).toBe(true);
    expect(game.state.activeInit).toBe(beforeState.activeInit);
    expect(game.state.totalFrames).toBe(beforeState.totalFrames);
  });

  it('全局强化购买后节点与工作台立即刷新，不触发整页重渲染', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    showSelectPage();

    const node = clickNode(`[data-global-enh-select="${FOUNDATION}"]`);
    expect(root.querySelector<HTMLButtonElement>(`[data-global-enh-purchase="${FOUNDATION}"]`)).not.toBeNull();

    root.querySelector<HTMLButtonElement>(`[data-global-enh-purchase="${FOUNDATION}"]`)!.click();

    expect(game.state.unlockedEnhancements).toContain(FOUNDATION);
    expect(root.querySelector(`[data-global-enh-select="${FOUNDATION}"]`)?.classList.contains('is-owned')).toBe(true);
    expect(root.querySelector('[data-selector-workbench-body]')?.textContent).toContain('已激活');
    expect(root.contains(node)).toBe(true);
  });

  it('由节点自身的 Active Affector 授权进入任意星图，并可返回来源图', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    game.mutations.changeResource('base:resource:pyroxene', 100);
    showSelectPage();
    clickNode(`[data-global-enh-select="${FOUNDATION}"]`);

    expect(root.querySelector('[data-selector-workbench-body]')?.textContent).toContain('取得并激活此节点关联的 Affector');
    root.querySelector<HTMLButtonElement>(`[data-global-enh-purchase="${FOUNDATION}"]`)!.click();
    expect(game.affectorEngine.getActiveGraphCapabilitySources().get('base:graph:foundation'))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        mountEntityId: FOUNDATION,
        nodeId: 'init:base:init:millennium',
      })]));

    const rootFoundation = root.querySelector<SVGElement>(`[data-global-enh-select="${FOUNDATION}"]`)!;
    const rootFoundationPosition = {
      x: Number(rootFoundation.getAttribute('data-node-x')),
      y: Number(rootFoundation.getAttribute('data-node-y')),
    };
    root.querySelector<HTMLButtonElement>('[data-selector-graph-enter]')!.click();
    expect(root.querySelector('[data-selector-graph]')?.getAttribute('data-selector-graph-id')).toBe('base:graph:foundation');
    expect(root.querySelector('[data-selector-graph-back]')).not.toBeNull();
    expect(root.querySelector('.selector-graph-backdrop [data-selector-node]')).toBeNull();
    expect(root.querySelector('.selector-graph-backdrop .selector-node.is-backdrop')).not.toBeNull();
    expect(root.querySelector('.selector-graph-cross-link')).not.toBeNull();
    const sourceNode = root.querySelector<SVGElement>('.selector-graph-backdrop [data-node-id="global-enh:base:enhancement:foundation"]')!;
    const planeOrigin = projectPlane(0, 0);
    const expectedSourcePosition = {
      x: projectPlane(-360, -210).x + (rootFoundationPosition.x - planeOrigin.x) * 0.48,
      y: projectPlane(-360, -210).y + (rootFoundationPosition.y - planeOrigin.y) * 0.48,
    };
    expect(Number(sourceNode.getAttribute('data-node-x'))).toBeCloseTo(expectedSourcePosition.x);
    expect(Number(sourceNode.getAttribute('data-node-y'))).toBeCloseTo(expectedSourcePosition.y);

    root.querySelector<HTMLButtonElement>('[data-selector-graph-back]')!.click();
    expect(root.querySelector('[data-selector-graph]')?.getAttribute('data-selector-graph-id')).toBe('main');
    expect(controller.selectorPage.selectedEnhId).toBe(FOUNDATION);
  });

  it('mid-game 从强化面板进入时默认聚焦全局强化节点，并保留「返回游戏」逃生口', () => {
    (controller as unknown as { started: boolean }).started = true;
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = false;
    controller.openGlobalEnhancementSelect();

    expect(root.querySelector('[data-selector-graph]')?.getAttribute('data-selector-selected-kind')).toBe('global-enh');
    expect(controller.selectorPage.selectedEnhId).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-back-to-game]')).not.toBeNull();
  });
});
