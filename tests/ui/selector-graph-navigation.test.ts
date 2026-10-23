// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { buildSelectorGraphView, selectorGraphLinkPath, SELECTOR_GRAPH_DEFINITIONS, type SelectorGraphPortalDef } from '../../src/ui/components/navigation/selector-graph';
import { createUIContext } from '../../src/ui/runtime/context';
import { cameraPoint, GRAPH_NAVIGATION_TIMING } from '../../src/ui/navigation/selector-graph-transition';

const FOUNDATION = 'base:enhancement:foundation';
const MILLENNIUM = 'base:init:millennium';
const GRAPH = 'base:graph:foundation';
const SOURCE = `global-enh:${FOUNDATION}`;
const TARGET = `init:${MILLENNIUM}`;

describe('选择页图与星座之间的绘线导航', () => {
  let game: GameInstance;
  let root: HTMLElement;
  let controller: UIController;
  let time: number;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let portal: SelectorGraphPortalDef;
  let originalPortal: SelectorGraphPortalDef;
  const definition = SELECTOR_GRAPH_DEFINITIONS[GRAPH];
  const originalNodes = definition.nodes;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    time = 0;
    frameId = 0;
    frames = new Map();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    controller = new UIController(game, root);
    controller.mount();
    game.inits.startNewGame('base:init:schale_office');
    game.mutations.changeResource('base:resource:pyroxene', 100);
    game.enhancements.purchaseEnhancement(FOUNDATION);
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = true;
    (controller as unknown as { renderInitSelect(): void }).renderInitSelect();
    controller.selectorPage.select({ kind: 'global-enh', entityId: FOUNDATION }, { animate: false });
    portal = buildSelectorGraphView(createUIContext(game)).nodes.find(node => node.nodeId === SOURCE)!.graphPortal!;
    originalPortal = { ...portal };
  });

  afterEach(() => {
    controller.selectorPage.reset();
    game.stop();
    definition.nodes = originalNodes;
    Object.assign(portal, originalPortal);
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const query = <T extends Element = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const click = (selector: string) => query(selector).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const phase = () => query('[data-selector-graph-viewport]').getAttribute('data-selector-navigation-phase');
  const graphId = () => query('[data-selector-graph]').getAttribute('data-selector-graph-id');
  const worlds = () => root.querySelectorAll('[data-selector-graph-world]');
  const currentNode = (id: string) => query<SVGGElement>(`[data-selector-graph-world] [data-selector-node][data-node-id="${id}"]`);
  const zoom = (value: number) => {
    const slider = query<HTMLInputElement>('[data-selector-zoom-slider]');
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const frame = async (elapsed = 0) => {
    time += elapsed;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(time));
    await Promise.resolve();
    await Promise.resolve();
  };
  const stage = async () => {
    const viewport = query('[data-selector-graph-viewport]');
    const direction = viewport.getAttribute('data-selector-navigation-direction') as 'enter' | 'return';
    const currentPhase = phase() as 'collapse' | 'travel' | 'expand';
    await frame();
    await frame(GRAPH_NAVIGATION_TIMING[direction][currentPhase]);
  };
  const finish = async () => { await stage(); await stage(); await stage(); };
  const point = (node: Element) => ({ x: Number(node.getAttribute('data-node-x')), y: Number(node.getAttribute('data-node-y')) });
  const transform = (value: string) => {
    const numbers = value.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
    return { x: numbers[0], y: numbers[1], scale: numbers[2] };
  };

  it('当前图收成真实星座，再从来源星点绘线抵达指定目标；抵达才提交详情', async () => {
    zoom(60);
    const viewport = query('[data-selector-graph-viewport]');
    const topbar = query('.selector-topbar');
    const workbench = query('[data-selector-workbench]');
    const detail = query('[data-selector-workbench-body]').innerHTML;
    const source = currentNode(SOURCE);
    const camera = transform(query('[data-selector-graph-world]').getAttribute('transform')!);
    const before = JSON.stringify(game.state);
    click('[data-selector-graph-enter]');
    expect(worlds()).toHaveLength(2);
    expect(phase()).toBe('collapse');
    expect(graphId()).toBe('main');
    expect(query('[data-selector-workbench-body]').innerHTML).toBe(detail);
    expect(query('[data-selector-graph]').inert).toBe(true);
    const originalTransform = source.getAttribute('transform');
    await frame();
    await frame(200);
    expect(phase()).toBe('collapse');
    expect(source.getAttribute('transform')).not.toBe(originalTransform);
    expect(graphId()).toBe('main');
    await frame(200);
    expect(phase()).toBe('travel');
    expect(root.querySelector('[data-selector-jump]')).toBeNull();
    const nextCamera = transform(worlds()[1].getAttribute('transform')!);
    const star = cameraPoint(point(query(`[data-selector-navigation-constellation] [data-node-id="${SOURCE}"]`)), nextCamera);
    const collapsed = cameraPoint(transform(source.getAttribute('transform')!), camera);
    expect(collapsed.x).toBeCloseTo(star.x);
    expect(collapsed.y).toBeCloseTo(star.y);
    const line = query<SVGPathElement>('[data-selector-navigation-link]');
    const endpoint = cameraPoint(buildSelectorGraphView(createUIContext(game), GRAPH).nodes.find(node => node.nodeId === TARGET)!.position, nextCamera);
    expect(line.getAttribute('d')).toBe(selectorGraphLinkPath(star, endpoint));
    expect(line.style.strokeDashoffset).toBe('1');
    expect(star.y).toBeGreaterThan(0);
    await frame();
    await frame(225);
    expect(Number(line.style.strokeDashoffset)).toBeCloseTo(0.5);
    expect(graphId()).toBe('main');
    expect(query('[data-selector-workbench-body]').innerHTML).toBe(detail);
    await frame(225);
    expect(phase()).toBe('expand');
    expect(graphId()).toBe(GRAPH);
    expect(controller.selectorPage.selectedNode).toEqual({ kind: 'init', entityId: MILLENNIUM });
    expect(query('.selector-workbench-title').textContent).toBe('千禧年学院');
    await stage();
    expect(worlds()).toHaveLength(1);
    expect(query('[data-selector-graph-viewport]')).toBe(viewport);
    expect(query('.selector-topbar')).toBe(topbar);
    expect(query('[data-selector-workbench]')).toBe(workbench);
    expect(root.querySelector('[data-selector-jump]')).toBeNull();
    expect(root.querySelector('[data-selector-navigation-overlay]')).toBeNull();
    expect(query('[data-selector-graph]').inert).toBe(false);
    expect(query('.selector-workspace').hasAttribute('aria-busy')).toBe(false);
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('按当前相机、高程和 Portal 星座位置返回，并从相同端点展开到已保存的母图相机', async () => {
    zoom(55);
    const parentCamera = query('[data-selector-graph-world]').getAttribute('transform');
    click('[data-selector-graph-enter]');
    await finish();
    zoom(140);
    // 普通选择不改变导航关系里的抵达节点。
    controller.selectorPage.select({ kind: 'init', entityId: 'base:init:abydos' }, { animate: false });
    const childCamera = transform(query('[data-selector-graph-world]').getAttribute('transform')!);
    const star = point(query(`.selector-graph-backdrop [data-node-id="${SOURCE}"]`));
    const childTarget = point(currentNode(TARGET));
    const link = query('.selector-graph-cross-link').getAttribute('d')!;
    expect(link.startsWith(`M ${star.x} ${star.y}`)).toBe(true);
    click('[data-selector-graph-back]');
    await stage();
    const line = query<SVGPathElement>('[data-selector-navigation-link]');
    const landing = cameraPoint(star, childCamera);
    expect(line.getAttribute('d')).toBe(selectorGraphLinkPath(cameraPoint(childTarget, childCamera), landing));
    expect(line.style.strokeDashoffset).toBe('1');
    await stage();
    const incoming = worlds()[1];
    const source = incoming.querySelector(`[data-selector-node][data-node-id="${SOURCE}"]`)!;
    const start = transform(source.getAttribute('transform')!);
    const incomingCamera = transform(incoming.getAttribute('transform')!);
    const screenStart = cameraPoint(start, incomingCamera);
    expect(screenStart.x).toBeCloseTo(landing.x);
    expect(screenStart.y).toBeCloseTo(landing.y);
    await stage();
    expect(graphId()).toBe('main');
    expect(query('[data-selector-graph-world]').getAttribute('transform')).toBe(parentCamera);
    expect(controller.selectorPage.selectedNode).toEqual({ kind: 'global-enh', entityId: FOUNDATION });
  });

  it('过渡期间阻止连续点击、普通选择、滚轮、拖拽和比例尺输入', async () => {
    const camera = query('[data-selector-graph-world]').getAttribute('transform');
    click('[data-selector-graph-enter]');
    click('[data-selector-graph-enter]');
    click(`[data-selector-node][data-node-id="init:base:init:schale_office"]`);
    controller.selectorPage.select({ kind: 'init', entityId: MILLENNIUM });
    query('[data-selector-graph-viewport]').dispatchEvent(new WheelEvent('wheel', { deltaY: 500, bubbles: true, cancelable: true }));
    query('[data-selector-graph-viewport]').dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1, bubbles: true }));
    query('[data-selector-graph-viewport]').dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 100, pointerId: 1, bubbles: true }));
    zoom(200);
    expect(worlds()).toHaveLength(2);
    expect(worlds()[0].getAttribute('transform')).toBe(camera);
    expect(controller.selectorPage.selectedEnhId).toBe(FOUNDATION);
    await finish();
    click('[data-selector-graph-back]');
    await finish();
    expect(root.querySelector('[data-selector-graph-back]')).toBeNull();
    zoom(120);
    expect(query('[data-selector-zoom-readout]').textContent).toBe('120%');
  });

  it('返回时旧图额外向外扩张并失焦淡出，节点尺寸封顶；母图完全恢复后才销毁旧图', async () => {
    click('[data-selector-graph-enter]');
    await finish();
    const oldWorld = worlds()[0];
    const nodes = [...oldWorld.querySelectorAll<SVGGElement>('[data-selector-node]')];
    const oldCamera = transform(oldWorld.getAttribute('transform')!);
    const star = cameraPoint(point(query(`.selector-graph-backdrop [data-node-id="${SOURCE}"]`)), oldCamera);
    const target = cameraPoint(point(currentNode(TARGET)), oldCamera);
    const before = JSON.stringify(game.state);
    click('[data-selector-graph-back]');
    await stage();
    expect(nodes.every(node => !node.style.opacity || node.style.opacity === '1')).toBe(true);
    await stage();
    expect(phase()).toBe('expand');
    expect(oldWorld.isConnected).toBe(true);
    expect((oldWorld as SVGElement).style.display).toBe('');
    expect(nodes.every(node => !node.style.opacity || node.style.opacity === '1')).toBe(true);
    await frame();
    await frame(400);
    const space = transform(query('[data-selector-navigation-overlay]').getAttribute('transform')!);
    const growingCamera = transform(oldWorld.getAttribute('transform')!);
    expect(space.scale).toBeGreaterThan(1);
    expect(growingCamera.scale / oldCamera.scale).toBeCloseTo(space.scale * 2);
    const departingNode = nodes.find(node => node.dataset.nodeId === TARGET)!;
    const departingPoint = cameraPoint(point(departingNode), growingCamera);
    const expectedPoint = cameraPoint({ x: star.x + (target.x - star.x) * 2, y: star.y + (target.y - star.y) * 2 }, space);
    expect(departingPoint.x).toBeCloseTo(expectedPoint.x);
    expect(departingPoint.y).toBeCloseTo(expectedPoint.y);
    expect(query('[data-selector-navigation-link]').getAttribute('d')).toBe(selectorGraphLinkPath({ x: star.x + (target.x - star.x) * 2, y: star.y + (target.y - star.y) * 2 }, star));
    const oldStyle = (oldWorld as SVGElement).style;
    expect(Number.parseFloat(oldStyle.filter.slice(5)) * growingCamera.scale).toBeCloseTo(8 * 0.5 ** 1.4);
    expect(Number(oldStyle.opacity)).toBeGreaterThan(0);
    expect(Number(oldStyle.opacity)).toBeLessThan(1);
    for (const node of nodes) expect(transform(node.getAttribute('transform')!).scale * growingCamera.scale).toBeLessThanOrEqual(1.5);
    const incoming = worlds()[1];
    const parentCamera = transform(incoming.getAttribute('transform')!);
    const parentSource = incoming.querySelector(`[data-selector-node][data-node-id="${SOURCE}"]`)!;
    const parentPoint = cameraPoint(point(parentSource), parentCamera);
    const growingStar = cameraPoint(star, space);
    expect(parentPoint.x).toBeCloseTo(growingStar.x);
    expect(parentPoint.y).toBeCloseTo(growingStar.y);
    expect((incoming as SVGElement).style.filter).toBe('');
    expect(query<HTMLElement>('.selector-topbar').style.filter).toBe('');
    expect(oldWorld.isConnected).toBe(true);
    expect(nodes.every(node => !node.style.opacity || node.style.opacity === '1')).toBe(true);
    await frame(390);
    expect(oldWorld.isConnected).toBe(true);
    const lateCamera = transform(oldWorld.getAttribute('transform')!);
    expect(nodes.every(node => {
      const position = cameraPoint(point(node), lateCamera);
      return position.x < 0 || position.x > 900 || position.y < 0 || position.y > 620;
    })).toBe(true);
    expect(Number(oldStyle.opacity)).toBeLessThan(0.01);
    await frame(10);
    expect(oldWorld.isConnected).toBe(false);
    expect(worlds()).toHaveLength(1);
    expect(graphId()).toBe('main');
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('普通缩放与导航全程的节点和高程投影不超过 1.5 倍', async () => {
    const checkSize = () => {
      for (const world of worlds()) {
        const camera = transform(world.getAttribute('transform')!);
        world.querySelectorAll('[data-selector-node], .selector-node-footprint-scale').forEach(node => {
          expect(transform(node.getAttribute('transform')!).scale * camera.scale).toBeLessThanOrEqual(1.5001);
        });
      }
    };
    zoom(220);
    expect(transform(currentNode(SOURCE).getAttribute('transform')!).scale * 2.2).toBeCloseTo(1.5);
    checkSize();
    click('[data-selector-graph-enter]');
    await finish();
    zoom(220);
    click('[data-selector-graph-back]');
    await stage();
    await stage();
    await frame();
    for (let step = 0; step < 8; step++) { await frame(100); checkSize(); }
    expect(graphId()).toBe('main');
    expect(transform(currentNode(SOURCE).getAttribute('transform')!).scale * 2.2).toBeCloseTo(1.5);
  });

  it('共同放大途中卸载原图层，母图收敛到最终布局并释放输入锁', async () => {
    const parentCamera = worlds()[0].getAttribute('transform');
    click('[data-selector-graph-enter]');
    await finish();
    const oldWorld = worlds()[0];
    click('[data-selector-graph-back]');
    await stage();
    await stage();
    await frame();
    await frame(400);
    expect((oldWorld as SVGElement).style.filter).toContain('blur(');
    oldWorld.remove();
    await frame();
    expect(worlds()).toHaveLength(1);
    expect(worlds()[0].getAttribute('transform')).toBe(parentCamera);
    expect(root.querySelector('[data-selector-navigation-overlay]')).toBeNull();
    expect(query('[data-selector-graph]').inert).toBe(false);
    expect(frames.size).toBe(0);
    expect((oldWorld as SVGElement).style.filter).toBe('');
    expect((oldWorld as SVGElement).style.opacity).toBe('');
  });

  it('减少动态效果时同步切换且不创建动画帧，普通节点选择保留画布和节点身份', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const viewport = query('[data-selector-graph-viewport]');
    click('[data-selector-graph-enter]');
    expect(graphId()).toBe(GRAPH);
    expect(frames.size).toBe(0);
    expect(worlds()).toHaveLength(1);
    expect(phase()).toBeNull();
    const node = currentNode(TARGET);
    click('[data-selector-graph-back]');
    expect(graphId()).toBe('main');
    const source = currentNode(SOURCE);
    click('[data-init-select="base:init:schale_office"]');
    expect(query('[data-selector-graph-viewport]')).toBe(viewport);
    expect(currentNode(SOURCE)).toBe(source);
    expect(node.isConnected).toBe(false);
  });

  it('缺失目标不会提交历史；跳跃中丢失目标安全取消并恢复原图输入', async () => {
    definition.nodes = originalNodes.filter(node => `${node.kind}:${node.entityId}` !== TARGET);
    click('[data-selector-graph-enter]');
    expect(worlds()).toHaveLength(1);
    expect(phase()).toBeNull();
    definition.nodes = originalNodes;
    click('[data-selector-graph-enter]');
    await stage();
    definition.nodes = [];
    await stage();
    expect(graphId()).toBe('main');
    expect(worlds()).toHaveLength(1);
    expect(query('[data-selector-graph]').inert).toBe(false);
    expect(root.querySelector('[data-selector-graph-back]')).toBeNull();
    expect(frames.size).toBe(0);
  });

  it.each(['collapse', 'travel', 'expand'])('%s 阶段路由退出或图层卸载，取消帧且不覆盖新页面', async phaseName => {
    click('[data-selector-graph-enter]');
    if (phaseName !== 'collapse') await stage();
    if (phaseName === 'expand') await stage();
    const workspace = query('.selector-workspace');
    const oldViewport = query('[data-selector-graph-viewport]');
    root.innerHTML = '<button id="other-page">其他页面</button>';
    await frame();
    expect(root.innerHTML).toBe('<button id="other-page">其他页面</button>');
    expect(frames.size).toBe(0);
    expect(workspace.hasAttribute('aria-busy')).toBe(false);
    expect(oldViewport.querySelector('[data-selector-jump]')).toBeNull();
    expect(oldViewport.querySelector('[data-selector-navigation-overlay]')).toBeNull();
    expect(oldViewport.querySelectorAll('[data-selector-graph-world]')).toHaveLength(1);
  });

  it('单独卸载 incoming world 也会清理并释放旧画布', async () => {
    const source = currentNode(SOURCE);
    const originalTransform = source.getAttribute('transform');
    click('[data-selector-graph-enter]');
    await frame();
    await frame(200);
    expect(source.getAttribute('transform')).not.toBe(originalTransform);
    worlds()[1].remove();
    await frame();
    expect(frames.size).toBe(0);
    expect(query('[data-selector-graph]').inert).toBe(false);
    expect(graphId()).toBe('main');
    expect(source.getAttribute('transform')).toBe(originalTransform);
    expect(root.querySelector('[data-selector-navigation-overlay]')).toBeNull();
  });

  it('未要求显示母图星座时，保留独立连线开关且直接跳回来源布局', async () => {
    portal.renderOtherGraph = false;
    click('[data-selector-graph-enter]');
    await finish();
    expect(root.querySelectorAll('.selector-graph-backdrop .selector-node')).toHaveLength(0);
    expect(root.querySelector('.selector-graph-cross-link')).not.toBeNull();
    click('[data-selector-graph-back]');
    await stage();
    const spy = vi.spyOn(query<SVGGElement>('[data-selector-jump]'), 'setAttribute');
    await stage();
    const endpoint = transform(spy.mock.calls.filter(([name]) => name === 'transform').at(-1)![1]);
    const source = point(worlds()[1].querySelector(`[data-node-id="${SOURCE}"]`)!);
    expect(endpoint).toMatchObject(source);
    await stage();
    expect(graphId()).toBe('main');
  });

  it.each([0.22, 0.83])('星座比例 %s 与不同平面偏移复用实际星点及跨图连线端点', async scale => {
    portal.constellationScale = scale;
    portal.otherGraphPosition = { x: 280, y: -170 };
    click('[data-selector-graph-enter]');
    await finish();
    zoom(70);
    const camera = transform(query('[data-selector-graph-world]').getAttribute('transform')!);
    const star = point(query(`.selector-graph-backdrop [data-node-id="${SOURCE}"]`));
    expect(query('.selector-graph-cross-link').getAttribute('d')).toContain(`M ${star.x} ${star.y}`);
    click('[data-selector-graph-back]');
    await stage();
    const line = query<SVGPathElement>('[data-selector-navigation-link]');
    const target = point(currentNode(TARGET));
    expect(line.getAttribute('d')).toBe(selectorGraphLinkPath(cameraPoint(target, camera), cameraPoint(star, camera)));
    await stage();
    await stage();
  });

  it('Portal 关闭跨图线时仍完成星座形变，不临时添加跨图线', async () => {
    portal.renderLink = false;
    click('[data-selector-graph-enter]');
    await stage();
    expect(root.querySelector('[data-selector-navigation-constellation]')).not.toBeNull();
    expect(root.querySelector('[data-selector-navigation-link]')).toBeNull();
    await stage();
    await stage();
    expect(root.querySelector('.selector-graph-cross-link')).toBeNull();
    click('[data-selector-graph-back]');
    await stage();
    expect(root.querySelector('[data-selector-navigation-link]')).toBeNull();
    await stage();
    await stage();
    expect(graphId()).toBe('main');
  });

  it('子图的世界线中转页返回后保留图层与导航历史，仍能正常返回母图', async () => {
    game.inits.unlockInit(MILLENNIUM);
    click('[data-selector-graph-enter]');
    await finish();
    zoom(135);
    const viewport = query('[data-selector-graph-viewport]');
    const world = worlds()[0];
    const camera = world.getAttribute('transform');
    const before = JSON.stringify(game.state);
    click('[data-selector-workbench] [data-init]');
    expect(query('[data-selector-graph]').hidden).toBe(true);
    expect(query('[data-selector-init-overview]').hidden).toBe(false);
    expect(JSON.stringify(game.state)).toBe(before);
    click('[data-selector-init-overview-back]');
    expect(graphId()).toBe(GRAPH);
    expect(worlds()[0]).toBe(world);
    expect(world.getAttribute('transform')).toBe(camera);
    expect(query('[data-selector-graph-viewport]')).toBe(viewport);
    click('[data-selector-graph-back]');
    await finish();
    expect(graphId()).toBe('main');
  });

  it('子图抵达节点被移除后仍能直接安全返回来源，不伪造缺失节点', async () => {
    click('[data-selector-graph-enter]');
    await finish();
    definition.nodes = [];
    click('[data-selector-graph-back]');
    expect(graphId()).toBe('main');
    expect(frames.size).toBe(0);
    expect(worlds()).toHaveLength(1);
    expect(controller.selectorPage.selectedNode).toEqual({ kind: 'global-enh', entityId: FOUNDATION });
  });

  it('动画期间切换顶栏焦点后不抢回焦点，导航后的返回游戏仍有效', async () => {
    (controller as unknown as { started: boolean }).started = true;
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = false;
    controller.openGlobalEnhancementSelect();
    controller.selectorPage.select({ kind: 'global-enh', entityId: FOUNDATION }, { animate: false });
    click('[data-selector-graph-enter]');
    const topbarButton = query<HTMLButtonElement>('.selector-topbar button');
    topbarButton.focus();
    await finish();
    expect(document.activeElement).toBe(topbarButton);
    click('[data-selector-graph-back]');
    await finish();
    click('[data-back-to-game]');
    expect(root.querySelector('.selector-shell')).toBeNull();
  });
});

