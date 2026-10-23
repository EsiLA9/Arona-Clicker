// ============================================================
// ui/selector-page.ts — 选择页协调器（节点图谱）
//
// 负责：节点选中、工作台就地刷新、画布平移 / 缩放、聚焦主题同步。
// 空间呈现沿用 tools/node-graph-ui-demo 的阅读方式，但运行依赖完全独立。
// 不持有业务状态：可见性、拥有、价格与动作合法性全部来自
// UIContext 只读投影与既有 Controller / GameCommands。
// ============================================================

import type { GameReadModel } from '../../arona-clicker/contracts/index';
import type { UIContext } from '../runtime/context';
import { renderInitOverview, type InitSelectMode } from '../components/world/init-select';
import type { SelectorNodeKind } from '../presentation/selector-theme';
import {
  buildSelectorGraphView,
  selectorNodePresentation,
  selectorConstellationScale,
  selectorNodeRenderScale,
  updateSelectorGraphGrid,
  renderSelectorWorkbenchContent,
  renderSelectorWorkbenchHead,
  renderSelectorGraphWorkspace,
  DEFAULT_SELECTOR_GRAPH_PORTAL,
  type SelectorGraphPortalDef,
  type SelectorSelection,
  type SelectorGraphView,
} from '../components/navigation/selector-graph';
import { SelectorGraphTransition, type GraphNavigationMotion } from './selector-graph-transition';
import { SelectorSceneBackground } from '../presentation/selector-scene-background';
import type { PopoverManager } from '../interaction/popovers';
import { applyThemeTree } from '../presentation/theme-tree';
import { refreshPresentationHostElementsIn } from '../controller/controller-theme';
import { createSelectorPresentationContext, preferredInitId, projectSelectorTheme, renderSelectorSceneLayer } from '../presentation/selector-theme';

/** controller 暴露给选择页的回调（避免反向依赖）。 */
export interface SelectorHost {
  game: GameReadModel;
  root: HTMLElement;
  popovers: PopoverManager;
  selectorContext(): UIContext;
  initSelectMode(): InitSelectMode;
  showBackToGame(): boolean;
  bindDetailActions(): void;
  bindGlobalEnhancementDetailActions(): void;
  bindSelectorCommonActions(): void;
}

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 620;
const VIEW_CENTER = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 };
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.2;
const PAN_THRESHOLD = 3;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface SelectorGraphHistoryEntry {
  graphId: string;
  selection: SelectorSelection;
  targetNodeId: string;
  portal: SelectorGraphPortalDef;
  camera: CameraState;
}

interface CameraState {
  scale: number;
  x: number;
  y: number;
}

interface PanState {
  pointerId: number;
  start: { x: number; y: number };
  origin: { x: number; y: number };
  moved: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nodeEntityId(node: Element): string | undefined {
  const kind = node.getAttribute('data-selector-node-kind');
  return kind === 'global-enh'
    ? node.getAttribute('data-global-enh-select') ?? undefined
    : node.getAttribute('data-init-select') ?? undefined;
}

/** 选择页装配：节点图谱选中 / 工作台 / 画布相机。 */
export class SelectorPage {
  private initSelectedId: string | null = null;
  private enhSelectedId: string | null = null;
  private selection: SelectorSelection | null = null;
  private viewport: SVGSVGElement | null = null;
  private world: SVGGElement | null = null;
  private camera: CameraState = { scale: 1, x: 0, y: 0 };
  private pan: PanState | null = null;
  private readonly sceneBackground = new SelectorSceneBackground();
  private graphId = 'main';
  private readonly graphHistory: SelectorGraphHistoryEntry[] = [];
  private transition: SelectorGraphTransition | null = null;
  private navigationBound = false;
  private workbenchCollapsed = false;
  private overviewInitId: string | null = null;
  private overviewReturnFocus: HTMLElement | null = null;

  constructor(private readonly host: SelectorHost) {
    // 视口本身由 SVG viewBox 自适应；只有相机缩放保存在这里，窗口变化无需重建。
    window.addEventListener('resize', () => {
      if (!this.transition && this.host.root.querySelector('.selector-shell')) this.applyCamera();
    });
    // 捕获阶段也阻止合成事件；inert 负责键盘可达性。顶栏仍可用于离开页面。
    for (const type of ['click', 'keydown', 'wheel', 'pointerdown', 'pointermove']) {
      this.host.root.addEventListener(type, event => {
        if (!(event.target instanceof Element) || !event.target.closest('.selector-workspace')) return;
        if (!this.transition && !(this.overviewInitId && event.target.closest('[data-selector-graph], [data-selector-workbench]'))) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true, passive: false });
    }
  }

  /** 进入选择页前重置页面级瞬时状态；选中项按注册表有效性保留。 */
  reset(): void {
    this.transition?.cancel();
    this.sceneBackground.cancel();
    this.workbenchCollapsed = false;
    this.overviewInitId = null;
    this.overviewReturnFocus = null;
    this.graphId = 'main';
    this.graphHistory.length = 0;
    this.selection = null;
    this.viewport = null;
    this.world = null;
    this.pan = null;
    this.camera = { scale: 1, x: 0, y: 0 };
    const context = this.host.selectorContext();
    const preferred = preferredInitId(context);
    if (!this.initSelectedId || !context.world.inits.has(this.initSelectedId)) {
      this.initSelectedId = preferred && context.world.inits.has(preferred) ? preferred : null;
    }
    if (this.enhSelectedId && !context.game.registry.enhancements.has(this.enhSelectedId)) {
      this.enhSelectedId = null;
    }
  }

  get currentKind(): SelectorNodeKind { return this.selection?.kind ?? 'init'; }
  get selectedInitId(): string | null { return this.initSelectedId; }
  get selectedEnhId(): string | null { return this.enhSelectedId; }
  get selectedNode(): SelectorSelection | null { return this.selection; }
  get previewedInitId(): string | null { return this.overviewInitId; }

  /** Runtime 编辑器 Apply 重建选择页后恢复用户原先聚焦的 Init。 */
  restoreInitSelection(initId: string | null): void {
    if (initId && this.host.game.registry.inits.has(initId)) {
      this.initSelectedId = initId;
      if (this.selection?.kind === 'init') this.selection = { kind: 'init', entityId: initId };
    }
  }

  /** 整页装配：恢复选中、绑定节点与画布交互、复位相机。 */
  bindStage(initialKind: SelectorNodeKind): void {
    const context = this.host.selectorContext();
    const selection = this.resolveSelection(context, initialKind);
    this.applySelection(selection);

    this.viewport = this.host.root.querySelector<SVGSVGElement>('[data-selector-graph-viewport]');
    this.world = this.host.root.querySelector<SVGGElement>('[data-selector-graph-world]');
    this.camera = { scale: 1, x: 0, y: 0 };
    this.bindGraphInteractions();
    this.host.bindDetailActions();
    this.host.bindGlobalEnhancementDetailActions();
    this.host.bindSelectorCommonActions();
    this.bindNavigationActions();
    this.applyCamera();
    this.syncFocusedTheme(false);
  }

  /** 选中节点：只更新节点态与工作台，不重建画布。 */
  select(selection: SelectorSelection, options: { animate?: boolean } = {}): void {
    if (this.transition || this.overviewInitId) return;
    if (this.selection?.kind === selection.kind && this.selection.entityId === selection.entityId) return;
    this.applySelection(selection);
    this.updateNodeSelection();
    this.replaceWorkbench();
    this.syncFocusedTheme(options.animate !== false);
  }

  /** 解锁 / 购买后原位同步该节点；不替换节点元素，保留定位与事件绑定。 */
  refreshInitNode(initId: string): void {
    this.refreshNode('init', initId);
  }

  refreshEnhNode(enhId: string): void {
    this.refreshNode('global-enh', enhId);
  }

  /** 购买 / 停用后刷新工作台详情；选中项未变化时不会重建节点。 */
  refreshWorkbench(): void {
    if (this.transition) return;
    this.replaceWorkbench();
    this.syncFocusedTheme(false);
  }

  /** 主题浮窗开合等顶栏状态变化后，只刷新选择页顶栏的宿主表现。 */
  refreshTopbarPresentation(): void { this.syncFocusedTheme(false); }

  /** 星图与概览共享外壳；仅切换可见性，保存图层、相机、选择和工作台阅读位置。 */
  openInitOverview(initId: string, options: { animate?: boolean } = {}): void {
    if (this.transition || this.overviewInitId || this.selection?.kind !== 'init' || this.selection.entityId !== initId) return;
    const region = this.host.root.querySelector<HTMLElement>('[data-selector-init-overview]');
    if (!region) return;
    const markup = renderInitOverview(this.host.selectorContext(), initId);
    if (!markup) return;
    this.overviewReturnFocus = this.host.root.querySelector<HTMLElement>('[data-selector-workbench] [data-init]');
    this.overviewInitId = initId;
    this.releasePan();
    this.host.popovers.dismissBeforeRootMutation(this.host.root.querySelector<HTMLElement>('.selector-workspace') ?? region);
    region.innerHTML = markup;
    this.syncWorkspaceVisibility();
    this.host.bindDetailActions();
    this.syncFocusedTheme(options.animate !== false);
    region.querySelector<HTMLElement>('[data-selector-init-overview-title]')?.focus({ preventScroll: true });
  }

  canEnterInit(initId: string): boolean {
    const region = this.host.root.querySelector<HTMLElement>('[data-selector-init-overview]');
    return !this.transition && this.overviewInitId === initId
      && !!region?.isConnected && !region.hidden
      && this.host.selectorContext().view.unlockedInits.includes(initId)
      && this.host.game.world.inits.has(initId);
  }

  private closeInitOverview(): void {
    if (!this.overviewInitId) return;
    const region = this.host.root.querySelector<HTMLElement>('[data-selector-init-overview]');
    if (region) this.host.popovers.dismissBeforeRootMutation(region);
    this.overviewInitId = null;
    this.syncWorkspaceVisibility();
    this.syncFocusedTheme(true);
    if (this.overviewReturnFocus?.isConnected) this.overviewReturnFocus.focus({ preventScroll: true });
    this.overviewReturnFocus = null;
    region?.replaceChildren();
    this.host.popovers.retainIfAnchored();
  }

  private syncWorkspaceVisibility(): void {
    const root = this.host.root;
    const overview = !!this.overviewInitId;
    const graph = root.querySelector<HTMLElement>('[data-selector-graph]');
    const workbench = root.querySelector<HTMLElement>('[data-selector-workbench]');
    const toggle = root.querySelector<HTMLButtonElement>('[data-selector-workbench-toggle]');
    const region = root.querySelector<HTMLElement>('[data-selector-init-overview]');
    if (graph) graph.hidden = overview;
    if (workbench) workbench.hidden = overview || this.workbenchCollapsed;
    if (toggle) {
      toggle.hidden = overview;
      toggle.setAttribute('aria-expanded', String(!this.workbenchCollapsed));
      toggle.innerHTML = `${this.workbenchCollapsed ? '展开详情' : '收起详情'} <span aria-hidden="true">${this.workbenchCollapsed ? '‹' : '›'}</span>`;
    }
    if (region) region.hidden = !overview;
    const subline = root.querySelector<HTMLElement>('.selector-topbar .status-line > .live');
    if (subline) subline.textContent = overview ? '● WORLD LINE' : '● GRAPH VIEW';
  }

  private resolveSelection(context: UIContext, initialKind: SelectorNodeKind): SelectorSelection | null {
    const nodes = buildSelectorGraphView(context, this.graphId, this.currentParentRelation()).nodes;
    const inits = nodes.filter(node => node.kind === 'init');
    const enhancements = nodes.filter(node => node.kind === 'global-enh');
    if (initialKind === 'global-enh') {
      const enh = enhancements.find(node => node.entityId === this.enhSelectedId) ?? enhancements[0];
      if (enh) return { kind: 'global-enh', entityId: enh.entityId };
    }
    const init = inits.find(node => node.entityId === this.initSelectedId) ?? inits[0];
    if (init) return { kind: 'init', entityId: init.entityId };
    const fallback = enhancements[0];
    return fallback ? { kind: 'global-enh', entityId: fallback.entityId } : null;
  }

  private applySelection(selection: SelectorSelection | null): void {
    this.selection = selection;
    if (selection?.kind === 'init') this.initSelectedId = selection.entityId;
    if (selection?.kind === 'global-enh') this.enhSelectedId = selection.entityId;
  }

  private updateNodeSelection(): void {
    this.host.root.querySelectorAll<SVGGElement>('[data-selector-node]').forEach(node => {
      const selected = !!this.selection
        && this.selection.kind === node.getAttribute('data-selector-node-kind')
        && this.selection.entityId === nodeEntityId(node);
      node.classList.toggle('is-selected', selected);
      node.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  private replaceWorkbench(): void {
    const body = this.host.root.querySelector<HTMLElement>('[data-selector-workbench-body]');
    if (!body) return;
    this.host.popovers.dismissBeforeRootMutation(body);
    const context = this.host.selectorContext();
    body.innerHTML = renderSelectorWorkbenchContent(
      context,
      this.host.initSelectMode(),
      this.selection,
      this.host.showBackToGame(),
      this.graphId,
    );
    const node = this.selection
      ? buildSelectorGraphView(context, this.graphId, this.currentParentRelation()).nodes.find(candidate =>
        candidate.kind === this.selection?.kind && candidate.entityId === this.selection?.entityId)
      : undefined;
    const head = this.host.root.querySelector<HTMLElement>('.selector-workbench-head');
    if (head) {
      this.host.popovers.dismissBeforeRootMutation(head);
      head.innerHTML = renderSelectorWorkbenchHead(context, node);
    }
    this.host.popovers.retainIfAnchored();
    this.host.bindDetailActions();
    this.host.bindGlobalEnhancementDetailActions();
    this.bindNavigationActions();
  }

  private refreshNode(kind: SelectorNodeKind, entityId: string): void {
    if (this.transition) return;
    const context = this.host.selectorContext();
    const node = buildSelectorGraphView(context, this.graphId, this.currentParentRelation()).nodes.find(candidate =>
      candidate.kind === kind && candidate.entityId === entityId);
    if (!node) return;
    const element = [...this.host.root.querySelectorAll<SVGGElement>('[data-selector-node]')]
      .find(candidate => candidate.getAttribute('data-selector-node-kind') === kind && nodeEntityId(candidate) === entityId);
    if (!element) return;
    const presentation = selectorNodePresentation(node, this.selection);
    element.setAttribute('class', presentation.className);
    element.setAttribute('aria-pressed', presentation.ariaPressed);
    element.setAttribute('aria-label', presentation.ariaLabel);
    const glyph = element.querySelector<SVGTextElement>('.selector-node-glyph');
    if (glyph) glyph.textContent = presentation.glyph;
    const label = element.querySelector<SVGTextElement>('.selector-node-label');
    if (label) label.textContent = presentation.label;
    const icon = element.querySelector<SVGPathElement>('.selector-node-icon');
    if (node.fog) {
      icon?.remove();
    } else if (!icon) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'selector-node-icon');
      path.setAttribute('d', node.iconPath);
      element.querySelector('.selector-node-body')?.after(path);
    }
    this.applyCamera();
    this.refreshGraphSummary();
  }

  private refreshGraphSummary(): void {
    const summary = this.host.root.querySelector<HTMLElement>('[data-selector-graph-summary]');
    if (summary) summary.textContent = buildSelectorGraphView(this.host.selectorContext(), this.graphId, this.currentParentRelation()).summaryText;
  }

  private currentParentRelation(): { graphId: string; sourceNode: SelectorSelection; targetNodeId: string; portal: SelectorGraphPortalDef } | undefined {
    const parent = this.graphHistory[this.graphHistory.length - 1];
    return parent ? {
      graphId: parent.graphId,
      sourceNode: parent.selection,
      targetNodeId: parent.targetNodeId,
      portal: parent.portal,
    } : undefined;
  }

  private bindNavigationActions(): void {
    if (this.navigationBound) return;
    this.navigationBound = true;
    this.host.root.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !this.overviewInitId || !(event.target instanceof Element)
        || !event.target.closest('[data-selector-init-overview]')) return;
      event.preventDefault();
      this.closeInitOverview();
    });
    this.host.root.addEventListener('click', event => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-selector-graph-enter], [data-selector-graph-back], [data-selector-workbench-toggle], [data-selector-init-overview-back]');
      if (!button) return;
      event.preventDefault();
      if (button.hasAttribute('data-selector-init-overview-back')) { this.closeInitOverview(); return; }
      if (this.overviewInitId || this.transition) return;
      if (button.hasAttribute('data-selector-workbench-toggle')) {
        const workbench = this.host.root.querySelector<HTMLElement>('[data-selector-workbench]');
        if (workbench) this.host.popovers.dismissBeforeRootMutation(workbench);
        this.workbenchCollapsed = !this.workbenchCollapsed;
        this.syncWorkspaceVisibility();
        button.focus({ preventScroll: true });
        return;
      }
      if (button.hasAttribute('data-selector-graph-back')) this.leaveCurrentGraph();
      else if (button.dataset.selectorGraphEnter && button.dataset.selectorGraphTargetNode) {
        this.enterSelectedGraph(button.dataset.selectorGraphEnter, button.dataset.selectorGraphTargetNode);
      }
    });
  }

  private enterSelectedGraph(graphId: string, nodeId: string): void {
    if (this.transition || this.overviewInitId || !this.selection) return;
    const context = this.host.selectorContext();
    const node = buildSelectorGraphView(context, this.graphId, this.currentParentRelation()).nodes.find(candidate =>
      candidate.kind === this.selection?.kind && candidate.entityId === this.selection?.entityId);
    const targetExists = node?.graphTargets.some(target => target.graphId === graphId && target.nodeId === nodeId);
    if (!node || !targetExists) return;
    const portal = node.graphPortal ?? DEFAULT_SELECTOR_GRAPH_PORTAL;
    const previous: SelectorGraphHistoryEntry = {
      graphId: this.graphId,
      selection: this.selection,
      targetNodeId: nodeId,
      portal,
      camera: { ...this.camera },
    };
    const graph = buildSelectorGraphView(context, graphId, {
      graphId: previous.graphId, sourceNode: previous.selection, targetNodeId: nodeId, portal,
    });
    const target = graph.nodes.find(candidate => candidate.nodeId === nodeId);
    // buildSelectorGraphView 的未知图回退不得被误当作授权目标。
    if (graph.graphId !== graphId || !target) return;
    this.navigateGraph(graph, target, this.frameGraphCamera(graph), {
      direction: 'enter',
      from: { graphId: this.graphId, nodeId: node.nodeId, position: node.position },
      to: { graphId, nodeId, position: target.position },
      constellation: portal.renderOtherGraph ? graph.backdrop?.nodes : undefined,
      drawLink: portal.renderLink,
    }, () => {
      const source = buildSelectorGraphView(this.host.selectorContext(), this.graphId, this.currentParentRelation()).nodes.find(candidate => candidate.nodeId === node.nodeId);
      if (!source?.graphTargets.some(candidate => candidate.graphId === graphId && candidate.nodeId === nodeId)) return false;
      this.graphHistory.push(previous);
      return true;
    });
  }

  private leaveCurrentGraph(): void {
    if (this.overviewInitId) return;
    if (this.transition) return;
    const previous = this.graphHistory[this.graphHistory.length - 1];
    if (!previous) return;
    const context = this.host.selectorContext();
    const current = buildSelectorGraphView(context, this.graphId, this.currentParentRelation());
    const parent = this.graphHistory[this.graphHistory.length - 2];
    const graph = buildSelectorGraphView(context, previous.graphId, parent ? {
      graphId: parent.graphId, sourceNode: parent.selection, targetNodeId: parent.targetNodeId, portal: parent.portal,
    } : undefined);
    const source = current.nodes.find(node => node.nodeId === previous.targetNodeId);
    const target = graph.nodes.find(node => node.kind === previous.selection.kind && node.entityId === previous.selection.entityId);
    if (graph.graphId !== previous.graphId || !target) return;
    this.navigateGraph(graph, target, previous.camera, {
      direction: 'return',
      from: { graphId: this.graphId, nodeId: source?.nodeId ?? '', position: source?.position ?? target.position },
      to: { graphId: graph.graphId, nodeId: target.nodeId, position: target.position },
      constellation: previous.portal.renderOtherGraph ? current.backdrop?.nodes : undefined,
      constellationScale: selectorConstellationScale(previous.portal),
      drawLink: previous.portal.renderLink,
    }, () => { this.graphHistory.pop(); return true; }, !source);
  }

  private navigateGraph(
    graph: SelectorGraphView,
    target: SelectorSelection,
    camera: CameraState,
    motion: GraphNavigationMotion,
    commitHistory: () => boolean,
    immediate = false,
  ): void {
    const workspace = this.host.root.querySelector<HTMLElement>('.selector-workspace');
    const graphHost = workspace?.querySelector<HTMLElement>('[data-selector-graph]');
    const viewport = this.viewport;
    const outgoing = this.world;
    if (!workspace || !graphHost || !viewport?.isConnected || !outgoing) return;
    const context = this.host.selectorContext();
    const next = htmlToElement(renderSelectorGraphWorkspace(context, graph, target, '', graph.graphId,
      motion.direction === 'enter' || this.graphHistory.length > 1));
    const incoming = next.querySelector<SVGGElement>('[data-selector-graph-world]')!;
    this.applyCameraToWorld(incoming, camera);
    this.releasePan();
    const workbench = workspace.querySelector<HTMLElement>('[data-selector-workbench]');
    graphHost.inert = true;
    if (workbench) workbench.inert = true;
    workspace.setAttribute('aria-busy', 'true');
    this.host.popovers.dismissBeforeRootMutation(workspace);
    const transition = new SelectorGraphTransition({
      viewport, outgoing, incoming, view: graph, motion,
      oldCamera: { ...this.camera }, newCamera: camera,
      reducedMotion: immediate || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
      arrive: () => {
        if (!viewport.isConnected || incoming.parentNode !== viewport) return false;
        const latest = buildSelectorGraphView(this.host.selectorContext(), graph.graphId);
        if (latest.graphId !== graph.graphId || !latest.nodes.some(node => node.nodeId === motion.to.nodeId) || !commitHistory()) return false;
        this.graphId = graph.graphId;
        this.applySelection({ kind: target.kind, entityId: target.entityId });
        this.camera = { ...camera };
        this.world = incoming;
        graphHost.dataset.selectorGraphId = graph.graphId;
        const toolbar = graphHost.querySelector('.selector-graph-toolbar');
        if (toolbar) this.host.popovers.dismissBeforeRootMutation(toolbar);
        toolbar?.remove();
        const nextToolbar = next.querySelector('.selector-graph-toolbar');
        if (nextToolbar) graphHost.prepend(nextToolbar);
        this.replaceWorkbench();
        this.refreshGraphSummary();
        this.syncFocusedTheme(!immediate);
        return true;
      },
      finish: () => {
        if (this.transition !== transition) return;
        this.transition = null;
        graphHost.inert = false;
        if (workbench) workbench.inert = false;
        workspace.removeAttribute('aria-busy');
        if (!viewport.isConnected || this.viewport !== viewport) return;
        this.applyCamera();
        this.host.popovers.retainIfAnchored();
        // 顶栏可在动画中获得焦点；仅接回工作区内或被移除控件的焦点。
        if (document.activeElement === document.body || workspace.contains(document.activeElement)) {
          const focused = [...this.world!.querySelectorAll<SVGGElement>('[data-selector-node]')]
            .find(node => node.dataset.nodeId === (this.graphId === graph.graphId ? motion.to.nodeId : motion.from.nodeId));
          focused?.focus({ preventScroll: true });
        }
      },
    });
    this.transition = transition;
    transition.start();
  }

  /** 初次进入按真实图形范围取景，避免 Portal 星座或高程节点被 viewBox 边缘裁掉。 */
  private frameGraphCamera(graph: SelectorGraphView): CameraState {
    const points = [...graph.nodes, ...(graph.backdrop?.nodes ?? [])].flatMap(node => [node.position, node.planePosition]);
    if (points.length === 0) return { scale: 1, x: 0, y: 0 };
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));
    const margin = 48;
    const scale = clamp(Math.min(1, (VIEW_WIDTH - margin * 2) / Math.max(1, maxX - minX), (VIEW_HEIGHT - margin * 2) / Math.max(1, maxY - minY)), ZOOM_MIN, 1);
    const offset = (min: number, max: number, size: number): number => {
      const low = margin - min * scale;
      const high = size - margin - max * scale;
      return low <= high ? clamp(0, low, high) : (low + high) / 2;
    };
    return { scale, x: offset(minX, maxX, VIEW_WIDTH), y: offset(minY, maxY, VIEW_HEIGHT) };
  }

  private bindGraphInteractions(): void {
    const viewport = this.viewport;
    if (!viewport) return;

    // 节点点击 / 键盘激活（g[role=button]）只改变选中，不写游戏状态。
    viewport.addEventListener('click', event => {
      const target = event.target as Element | null;
      const node = target?.closest?.('[data-selector-node]');
      if (node) this.selectFromElement(node);
    });
    viewport.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target as Element | null;
      const node = target?.closest?.('[data-selector-node]');
      if (!node) return;
      event.preventDefault();
      this.selectFromElement(node);
    });

    // 画布滚轮缩放：以指针位置为锚点，阻止整页滚动。
    viewport.addEventListener('wheel', event => {
      event.preventDefault();
      const anchor = this.clientToViewBox(event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0012);
      this.setZoom(this.camera.scale * factor, anchor);
    }, { passive: false });

    // 空白处拖拽平移；节点自身仍处理选中。
    viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      if (target?.closest?.('[data-selector-node]')) return;
      this.pan = {
        pointerId: event.pointerId,
        start: this.clientToViewBox(event.clientX, event.clientY),
        origin: { x: this.camera.x, y: this.camera.y },
        moved: false,
      };
      try { viewport.setPointerCapture(event.pointerId); } catch { /* 非浏览器环境 */ }
      viewport.classList.add('is-panning');
    });

    viewport.addEventListener('pointermove', event => {
      const pan = this.pan;
      if (!pan || pan.pointerId !== event.pointerId) return;
      const point = this.clientToViewBox(event.clientX, event.clientY);
      const dx = point.x - pan.start.x;
      const dy = point.y - pan.start.y;
      if (!pan.moved && Math.abs(dx) + Math.abs(dy) < PAN_THRESHOLD) return;
      pan.moved = true;
      this.camera = { ...this.camera, x: pan.origin.x + dx, y: pan.origin.y + dy };
      this.applyCamera();
    });

    const endPan = (event: PointerEvent): void => {
      if (!this.pan || this.pan.pointerId !== event.pointerId) return;
      try { viewport.releasePointerCapture(event.pointerId); } catch { /* 非浏览器环境 */ }
      this.pan = null;
      viewport.classList.remove('is-panning');
    };
    viewport.addEventListener('pointerup', endPan);
    viewport.addEventListener('pointercancel', endPan);

    const slider = this.host.root.querySelector<HTMLInputElement>('[data-selector-zoom-slider]');
    slider?.addEventListener('input', () => {
      this.setZoom(Number(slider.value) / 100, VIEW_CENTER);
    });
    this.host.root.querySelector<HTMLButtonElement>('[data-selector-zoom-reset]')?.addEventListener('click', () => {
      if (this.transition || this.overviewInitId) return;
      this.camera = { scale: 1, x: 0, y: 0 };
      this.applyCamera();
    });
  }

  private selectFromElement(element: Element): void {
    const kind = element.getAttribute('data-selector-node-kind') as SelectorNodeKind | null;
    const entityId = nodeEntityId(element);
    if (!kind || !entityId) return;
    this.select({ kind, entityId });
  }

  /** 屏幕坐标 → SVG viewBox 坐标；CTM 不可用时退回矩形比例。 */
  private clientToViewBox(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.viewport;
    if (!svg) return { x: VIEW_CENTER.x, y: VIEW_CENTER.y };
    const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
    if (ctm && typeof svg.createSVGPoint === 'function') {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const transformed = point.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * VIEW_WIDTH,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * VIEW_HEIGHT,
    };
  }

  private setZoom(next: number, anchor = VIEW_CENTER): void {
    if (this.transition || this.overviewInitId) return;
    const scale = clamp(next, ZOOM_MIN, ZOOM_MAX);
    if (scale === this.camera.scale) return;
    const ratio = scale / this.camera.scale;
    this.camera = {
      scale,
      x: anchor.x - (anchor.x - this.camera.x) * ratio,
      y: anchor.y - (anchor.y - this.camera.y) * ratio,
    };
    this.applyCamera();
  }

  private releasePan(): void {
    if (!this.pan) return;
    try { this.viewport?.releasePointerCapture(this.pan.pointerId); } catch { /* 已释放 */ }
    this.pan = null;
    this.viewport?.classList.remove('is-panning');
  }

  /** 世界层随相机缩放；节点自身按非线性倍率反缩放，低倍率仍保持可读。 */
  private applyCamera(): void {
    if (this.transition) return;
    const { scale } = this.camera;
    if (this.world) this.applyCameraToWorld(this.world, this.camera);
    const percent = String(Math.round(scale * 100));
    const readout = this.host.root.querySelector<HTMLElement>('[data-selector-zoom-readout]');
    if (readout) readout.textContent = `${percent}%`;
    const slider = this.host.root.querySelector<HTMLInputElement>('[data-selector-zoom-slider]');
    if (slider && slider.value !== percent) slider.value = percent;
  }

  private applyCameraToWorld(world: SVGGElement, camera: CameraState): void {
    const { scale, x, y } = camera;
    world.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
    updateSelectorGraphGrid(world.querySelector<SVGGElement>('.selector-graph-grid'), camera);
    const nodeScale = selectorNodeRenderScale(scale);
    const counterScale = nodeScale / scale;
    world.querySelectorAll<SVGGElement>('[data-selector-node]').forEach(node => {
      const nodeX = node.getAttribute('data-node-x') ?? '0';
      const nodeY = node.getAttribute('data-node-y') ?? '0';
      const transform = `translate(${nodeX} ${nodeY}) scale(${counterScale})`;
      node.setAttribute('transform', transform);
    });
    world.querySelectorAll<SVGGElement>('[data-selector-node-height]').forEach(height => {
      const nodeX = height.getAttribute('data-node-x') ?? '0';
      const nodeY = height.getAttribute('data-node-y') ?? '0';
      const planeOffset = height.getAttribute('data-plane-offset') ?? '0';
      height.setAttribute('transform', `translate(${nodeX} ${nodeY})`);
      height.querySelector<SVGGElement>('.selector-node-footprint-scale')?.setAttribute(
        'transform',
        `translate(0 ${planeOffset}) scale(${counterScale.toFixed(4)})`,
      );
    });
  }

  /** 把当前选中节点的局部主题投影到页面宿主、画布与工作台；节点自身保留局部主题。 */
  private syncFocusedTheme(animate: boolean): void {
    const baseContext = this.host.selectorContext();
    // 概览只展示 Init 背景，不叠加已保存位置的 Area 表现。
    const context = this.overviewInitId
      ? { ...baseContext, selectorThemePolicy: { includeResumedArea: false } }
      : baseContext;
    const kind = this.selection?.kind ?? 'init';
    const focusedId = this.selection?.entityId ?? null;
    const projection = projectSelectorTheme(context, kind, focusedId);
    const { root } = this.host;
    const shell = root.querySelector<HTMLElement>('.selector-shell');
    if (shell) applyThemeTree(shell, projection.tree);
    const topbar = root.querySelector<HTMLElement>('.selector-topbar');
    if (topbar) {
      applyThemeTree(topbar, projection.tree);
      topbar.dataset.selectorHeaderThemeKey = projection.context.transitionKey;
      refreshPresentationHostElementsIn(
        topbar,
        createSelectorPresentationContext(context, projection),
        ['header.button'],
      );
    }
    const workspace = root.querySelector<HTMLElement>('.selector-workspace');
    if (workspace) {
      applyThemeTree(workspace, projection.tree);
      workspace.dataset.selectorThemeKey = projection.context.transitionKey;
    }
    const graph = root.querySelector<HTMLElement>('[data-selector-graph]');
    if (graph) {
      graph.dataset.selectorThemeKey = projection.context.transitionKey;
      graph.dataset.selectorSelectedKind = kind;
    }
    const workbench = root.querySelector<HTMLElement>('[data-selector-workbench]');
    if (workbench) applyThemeTree(workbench, projection.tree);
    const superBackground = root.querySelector<HTMLElement>('.selector-super-background');
    if (superBackground) applyThemeTree(superBackground, projection.tree);
    const status = root.querySelector<HTMLElement>('[data-selector-status]');
    if (status) {
      const restarting = this.host.initSelectMode() === 'restart';
      status.textContent = kind === 'init'
        ? `WORLD LINE · ${restarting ? 'RESTART' : 'NEW GAME'}`
        : 'GLOBAL ENH';
    }

    const stack = root.querySelector<HTMLElement>('.selector-scene-background-stack');
    if (!stack) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.sceneBackground.show(stack, renderSelectorSceneLayer(context, projection, 'next'), animate && !reducedMotion);
  }
}

function htmlToElement(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}
