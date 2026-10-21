import { selectorGraphLinkPath, selectorNodeRenderScale, type SelectorGraphNodeView, type SelectorGraphView } from './components/selector-graph';

type Point = { x: number; y: number };
export type GraphCamera = Point & { scale: number };
type Endpoint = { graphId: string; nodeId: string; position: Point };

/** 一次导航的 UI 投影；不写图定义、Runtime 或存档。position 已包含高程。 */
export interface GraphNavigationMotion {
  direction: 'enter' | 'return';
  from: Endpoint;
  to: Endpoint;
  /** 只接受实际渲染的母图星座，位置沿用 Portal 投影结果。 */
  constellation?: SelectorGraphNodeView[];
  constellationScale?: number;
  drawLink?: boolean;
}

export const GRAPH_NAVIGATION_TIMING = {
  enter: { collapse: 400, travel: 450, expand: 450 },
  return: { collapse: 150, travel: 450, expand: 800 },
} as const;

const SVG_NS = 'http://www.w3.org/2000/svg';

function opacityOf(element: Element): number {
  const value = Number.parseFloat(getComputedStyle(element).opacity);
  return Number.isFinite(value) ? value : 1;
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function cameraPoint(point: Point, camera: GraphCamera): Point {
  return { x: point.x * camera.scale + camera.x, y: point.y * camera.scale + camera.y };
}

function nodeScale(camera: GraphCamera): number {
  return selectorNodeRenderScale(camera.scale);
}

function nodeElement(world: SVGGElement, nodeId: string): SVGGElement | undefined {
  return [...world.querySelectorAll<SVGGElement>('[data-selector-node]')]
    .find(node => node.dataset.nodeId === nodeId);
}

interface TransitionOptions {
  viewport: SVGSVGElement;
  outgoing: SVGGElement;
  incoming: SVGGElement;
  view: SelectorGraphView;
  motion: GraphNavigationMotion;
  oldCamera: GraphCamera;
  newCamera: GraphCamera;
  reducedMotion: boolean;
  /** 抵达时重新核对目标，再提交历史、详情与主题。 */
  arrive(): boolean;
  finish(): void;
}

/** 同一 SVG 中保留两份 world；星座形变和绘线承担导航，相机不替代节点关系。 */
export class SelectorGraphTransition {
  private frame: number | null = null;
  private settleFrame: ((completed: boolean) => void) | null = null;
  private observer: MutationObserver | null = null;
  private proxy: SVGGElement | null = null;
  private overlay: SVGGElement | null = null;
  private stopped = false;
  private arrived = false;
  private readonly restore = new Map<SVGElement, string | null>();
  private readonly attributes = new Map<Element, Map<string, string | null>>();

  constructor(private readonly options: TransitionOptions) {}

  start(): void {
    const { viewport, outgoing, incoming, reducedMotion } = this.options;
    incoming.style.display = 'none';
    incoming.setAttribute('aria-hidden', 'true');
    viewport.dataset.selectorNavigationDirection = this.options.motion.direction;
    viewport.append(incoming);
    if (reducedMotion) {
      this.arrived = this.options.arrive();
      this.complete();
      return;
    }
    // 仅在本次过渡中观察卸载；路由退出和局部 world 移除都立即取消。
    this.observer = new MutationObserver(() => {
      if (!viewport.isConnected || outgoing.parentNode !== viewport || incoming.parentNode !== viewport) this.cancel();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    void this.play().catch(() => this.cancel());
  }

  cancel(): void { this.complete(); }

  private fade(element: SVGElement, opacity: number): void {
    this.style(element, 'opacity', String(opacity));
  }

  private style(element: SVGElement, name: string, value: string): void {
    if (!this.restore.has(element)) this.restore.set(element, element.getAttribute('style'));
    element.style.setProperty(name, value);
  }

  private attribute(element: Element, name: string, value: string): void {
    let attributes = this.attributes.get(element);
    if (!attributes) { attributes = new Map(); this.attributes.set(element, attributes); }
    if (!attributes.has(name)) attributes.set(name, element.getAttribute(name));
    element.setAttribute(name, value);
  }

  private copyNode(node: SVGGElement): SVGGElement {
    const copy = node.cloneNode(true) as SVGGElement;
    for (const attribute of ['data-selector-node', 'data-init-select', 'data-global-enh-select', 'role', 'tabindex', 'aria-pressed', 'aria-label']) copy.removeAttribute(attribute);
    copy.setAttribute('aria-hidden', 'true');
    copy.style.pointerEvents = 'none';
    return copy;
  }

  private tween(duration: number, update: (progress: number) => void): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    update(0);
    return new Promise(resolve => {
      this.settleFrame = resolve;
      let start: number | undefined;
      const frame = (time: number): void => {
        if (this.stopped) return;
        start ??= time;
        const fraction = Math.min(1, (time - start) / duration);
        update(fraction * fraction * (3 - 2 * fraction));
        if (fraction < 1) this.frame = window.requestAnimationFrame(frame);
        else {
          this.frame = null;
          this.settleFrame = null;
          resolve(true);
        }
      };
      this.frame = window.requestAnimationFrame(frame);
    });
  }

  private async play(): Promise<void> {
    const { motion, incoming, outgoing } = this.options;
    const constellationNodeId = motion.direction === 'enter' ? motion.from.nodeId : motion.to.nodeId;
    const backdrop = (motion.direction === 'enter' ? incoming : outgoing).querySelector<SVGGElement>('.selector-graph-backdrop');
    if (backdrop && motion.constellation?.some(node => node.nodeId === constellationNodeId)) {
      await this.playConstellation(backdrop);
    } else await this.playFallback();
  }

  private mainLayers(): SVGElement[] {
    return ['.selector-graph-grid', '.selector-graph-projection-edges', '.selector-graph-edges', '.selector-graph-heights']
      .flatMap(selector => {
        const element = this.options.outgoing.querySelector<SVGElement>(selector);
        return element ? [element] : [];
      });
  }

  private async playConstellation(backdrop: SVGGElement): Promise<void> {
    const { viewport, outgoing, incoming, motion, oldCamera, newCamera, view } = this.options;
    const entering = motion.direction === 'enter';
    const timing = GRAPH_NAVIGATION_TIMING[motion.direction];
    const source = nodeElement(outgoing, motion.from.nodeId);
    const target = nodeElement(incoming, motion.to.nodeId);
    if (!source || !target) { this.cancel(); return; }
    const stars = new Map(motion.constellation!.map(node => [node.nodeId, node]));
    const starNodeId = entering ? motion.from.nodeId : motion.to.nodeId;
    const starCamera = entering ? newCamera : oldCamera;
    const starPosition = cameraPoint(stars.get(starNodeId)!.position, starCamera);
    const from = entering ? starPosition : cameraPoint(motion.from.position, oldCamera);
    const to = entering ? cameraPoint(motion.to.position, newCamera) : starPosition;

    const overlay = document.createElementNS(SVG_NS, 'g');
    overlay.dataset.selectorNavigationOverlay = motion.direction;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('pointer-events', 'none');
    this.overlay = overlay;
    const constellation = backdrop.cloneNode(true) as SVGGElement;
    constellation.dataset.selectorNavigationConstellation = motion.direction;
    constellation.setAttribute('transform', `translate(${starCamera.x} ${starCamera.y}) scale(${starCamera.scale})`);
    constellation.querySelectorAll('.selector-graph-cross-link').forEach(line => line.remove());
    overlay.append(constellation);
    viewport.append(overlay);
    const starOpacity = opacityOf(constellation);
    this.fade(constellation, entering ? 0 : starOpacity);

    const oldBackdrop = outgoing.querySelector<SVGGElement>('.selector-graph-backdrop');
    let oldLink: SVGPathElement | null = null;
    if (!entering && oldBackdrop) {
      // 复用现有星座的外观和位置；清除静态线，下一阶段从子图反向画回去。
      oldLink = oldBackdrop.querySelector<SVGPathElement>('.selector-graph-cross-link')?.cloneNode(true) as SVGPathElement | null;
      if (oldLink) constellation.append(oldLink);
      this.fade(oldBackdrop, 0);
    }
    const oldLinkOpacity = oldLink ? opacityOf(oldLink) : 0;
    const layers = this.mainLayers();
    if (entering && oldBackdrop) layers.push(oldBackdrop);
    const layerOpacity = layers.map(opacityOf);
    const collapsingNodes = [...outgoing.querySelectorAll<SVGGElement>('[data-selector-node]')].map(element => ({
      element,
      position: cameraPoint({ x: Number(element.dataset.nodeX), y: Number(element.dataset.nodeY) }, oldCamera),
      star: stars.get(element.dataset.nodeId!),
      details: [...element.querySelectorAll<SVGElement>('.selector-node-label, .selector-node-icon, .selector-node-glyph, .selector-node-badge, .selector-node-check')].map(element => ({ element, opacity: opacityOf(element) })),
    }));
    viewport.dataset.selectorNavigationPhase = 'collapse';
    if (!await this.tween(timing.collapse, progress => {
      if (!entering) {
        // 绘线抵达前完整保留子图；失焦退场只发生在母图展开时。
        if (oldLink) this.fade(oldLink, oldLinkOpacity * (1 - progress));
        return;
      }
      layers.forEach((element, index) => this.fade(element, layerOpacity[index] * Math.max(0, 1 - progress / 0.35)));
      if (oldLink) this.fade(oldLink, oldLinkOpacity * (1 - progress));
      if (entering) this.fade(constellation, starOpacity * Math.max(0, (progress - 0.75) / 0.25));
      for (const node of collapsingNodes) {
        if (!node.star) { this.fade(node.element, 1 - progress); continue; }
        const end = cameraPoint(node.star.position, starCamera);
        const radiusRatio = node.star.nodeId === starNodeId ? 6 / 27 : 5 / 27;
        const scale = mix(nodeScale(oldCamera), radiusRatio * starCamera.scale, progress) / oldCamera.scale;
        this.attribute(node.element, 'transform', `translate(${(mix(node.position.x, end.x, progress) - oldCamera.x) / oldCamera.scale} ${(mix(node.position.y, end.y, progress) - oldCamera.y) / oldCamera.scale}) scale(${scale})`);
        this.fade(node.element, Math.min(1, (1 - progress) / 0.25));
        node.details.forEach(detail => this.fade(detail.element, detail.opacity * Math.max(0, 1 - progress / 0.6)));
      }
    })) return;
    oldLink?.remove();

    let line: SVGPathElement | null = null;
    if (motion.drawLink) {
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('class', 'selector-graph-backdrop');
      group.style.opacity = '1';
      line = document.createElementNS(SVG_NS, 'path');
      line.setAttribute('class', 'selector-graph-cross-link');
      line.dataset.selectorNavigationLink = motion.direction;
      line.setAttribute('d', selectorGraphLinkPath(from, to));
      line.setAttribute('pathLength', '1');
      line.style.strokeDasharray = '1';
      line.style.strokeDashoffset = '1';
      line.style.opacity = '0.85';
      group.append(line);
      overlay.append(group);
    }
    let preview: SVGGElement | null = null;
    if (entering && !motion.drawLink) {
      preview = this.copyNode(target);
      preview.dataset.selectorNavigationTarget = 'true';
      preview.setAttribute('transform', `translate(${to.x} ${to.y}) scale(${nodeScale(newCamera)})`);
      overlay.append(preview);
      this.fade(preview, 0);
    }
    viewport.dataset.selectorNavigationPhase = 'travel';
    if (!await this.tween(timing.travel, progress => {
      if (line) line.style.strokeDashoffset = String(1 - progress);
      if (preview) this.fade(preview, progress);
    })) return;
    if (line) {
      line.removeAttribute('pathLength');
      line.style.removeProperty('stroke-dasharray');
      line.style.removeProperty('stroke-dashoffset');
    }

    this.arrived = this.options.arrive();
    if (!this.arrived) { this.cancel(); return; }
    if (entering) outgoing.style.display = 'none';
    incoming.style.removeProperty('display');
    preview?.remove();
    const incomingLayers = [...incoming.children].filter(element => !element.classList.contains('selector-graph-nodes')) as SVGElement[];
    const incomingOpacity = incomingLayers.map(opacityOf);
    const finalBackdrop = incoming.querySelector<SVGGElement>('.selector-graph-backdrop');
    const nodes = view.nodes.map(node => ({ view: node, element: nodeElement(incoming, node.nodeId)! }));
    const outgoingNodes = [...outgoing.querySelectorAll<SVGGElement>('[data-selector-node]')];
    const outgoingFootprints = [...outgoing.querySelectorAll<SVGGElement>('.selector-node-footprint-scale')];
    const incomingFootprints = [...incoming.querySelectorAll<SVGGElement>('.selector-node-footprint-scale')];
    const outgoingOpacity = opacityOf(outgoing);
    // 将母图星座的真实比例还原成母图布局；同一个空间变换同时作用于原子图。
    const parentScale = oldCamera.scale * (motion.constellationScale ?? 0.48);
    const parentOrigin = {
      x: starPosition.x - motion.to.position.x * parentScale,
      y: starPosition.y - motion.to.position.y * parentScale,
    };
    const returnScale = newCamera.scale / parentScale;
    const returnOffset = {
      x: cameraPoint(motion.to.position, newCamera).x - returnScale * starPosition.x,
      y: cameraPoint(motion.to.position, newCamera).y - returnScale * starPosition.y,
    };
    viewport.dataset.selectorNavigationPhase = 'expand';
    if (!await this.tween(timing.expand, progress => {
      const geometry = entering ? progress : Math.max(0, (progress - 0.65) / 0.35);
      const spaceScale = mix(1, returnScale, progress);
      const spaceX = returnOffset.x * progress;
      const spaceY = returnOffset.y * progress;
      const parentCamera: GraphCamera = {
        scale: parentScale * spaceScale,
        x: parentOrigin.x * spaceScale + spaceX,
        y: parentOrigin.y * spaceScale + spaceY,
      };
      incomingLayers.forEach((element, index) => {
        // 进入时临时星座与已画完的线持续托底，结束后直接交给相同的正式图层。
        this.fade(element, entering && element === finalBackdrop ? 0 : incomingOpacity[index] * geometry);
      });
      if (entering && line) this.fade(line, mix(0.85, 0.55 * starOpacity, progress));
      if (!entering) {
        // 母图仍按真实 Portal 空间还原；旧图围绕关联星点额外扩张三倍，向视口外退场。
        const departure = mix(1, 3, progress);
        const departingScale = oldCamera.scale * spaceScale * departure;
        this.attribute(outgoing, 'transform', `translate(${((oldCamera.x - starPosition.x) * departure + starPosition.x) * spaceScale + spaceX} ${((oldCamera.y - starPosition.y) * departure + starPosition.y) * spaceScale + spaceY}) scale(${departingScale})`);
        const counterScale = selectorNodeRenderScale(departingScale) / departingScale;
        outgoingNodes.forEach(node => this.attribute(node, 'transform', `translate(${node.dataset.nodeX} ${node.dataset.nodeY}) scale(${counterScale})`));
        outgoingFootprints.forEach(footprint => {
          const height = footprint.closest<SVGGElement>('[data-selector-node-height]')!;
          this.attribute(footprint, 'transform', `translate(0 ${height.dataset.planeOffset}) scale(${counterScale})`);
        });
        // blur 使用旧图局部单位，抵消布局缩放，避免很大的滤镜区域和突兀的强模糊。
        this.style(outgoing, 'filter', `blur(${8 * progress ** 1.4 / departingScale}px)`);
        this.fade(outgoing, outgoingOpacity * (1 - Math.max(0, (progress - 0.25) / 0.75) ** 1.25));
        this.attribute(overlay, 'transform', `translate(${spaceX} ${spaceY}) scale(${spaceScale})`);
        this.attribute(incoming, 'transform', `translate(${parentCamera.x} ${parentCamera.y}) scale(${parentCamera.scale})`);
        incomingFootprints.forEach(footprint => {
          const height = footprint.closest<SVGGElement>('[data-selector-node-height]')!;
          this.attribute(footprint, 'transform', `translate(0 ${height.dataset.planeOffset}) scale(${nodeScale(parentCamera) / parentCamera.scale})`);
        });
        this.fade(constellation, starOpacity * Math.max(0, 1 - progress / 0.3));
        if (line) {
          // 旧图进一步退远时，曲线仍连接移动后的子图节点和母图来源星点。
          this.attribute(line, 'd', selectorGraphLinkPath({
            x: starPosition.x + (from.x - starPosition.x) * departure,
            y: starPosition.y + (from.y - starPosition.y) * departure,
          }, to));
          this.fade(line, 0.85 * (1 - progress));
        }
      }
      for (const { view: node, element } of nodes) {
        if (entering) { this.fade(element, node.nodeId === motion.to.nodeId ? 1 : progress); continue; }
        const star = stars.get(node.nodeId);
        this.fade(element, star ? Math.min(1, progress / 0.3) : progress);
        const ratio = node.nodeId === starNodeId ? 6 / 27 : 5 / 27;
        const scale = mix(star ? ratio * starCamera.scale : Math.min(0.55, nodeScale(newCamera)), nodeScale(newCamera), progress) / parentCamera.scale;
        this.attribute(element, 'transform', `translate(${node.position.x} ${node.position.y}) scale(${scale})`);
        element.querySelectorAll<SVGElement>('.selector-node-label, .selector-node-icon').forEach(detail => this.fade(detail, Math.min(1, progress / 0.6)));
      }
    })) return;
    this.complete();
  }

  private async playFallback(): Promise<void> {
    const { viewport, outgoing, incoming, motion, oldCamera, newCamera, view } = this.options;
    const source = nodeElement(outgoing, motion.from.nodeId);
    const target = nodeElement(incoming, motion.to.nodeId);
    if (!source || !target) { this.cancel(); return; }
    const fading = [...outgoing.querySelectorAll<SVGElement>(
      '.selector-graph-grid, .selector-graph-backdrop, .selector-graph-projection-edges, .selector-graph-edges, .selector-graph-heights, [data-selector-node]',
    )].filter(element => element !== source);
    const initialOpacity = fading.map(opacityOf);
    viewport.dataset.selectorNavigationPhase = 'collapse';
    const timing = GRAPH_NAVIGATION_TIMING[motion.direction];
    if (!await this.tween(timing.collapse, progress => fading.forEach((element, index) => this.fade(element, initialOpacity[index] * (1 - progress))))) return;

    const from = cameraPoint(motion.from.position, oldCamera);
    const to = cameraPoint(motion.to.position, newCamera);
    const startScale = nodeScale(oldCamera);
    const endScale = nodeScale(newCamera);
    const proxy = this.copyNode(source);
    proxy.dataset.selectorJump = motion.direction;
    this.proxy = proxy;
    viewport.append(proxy);
    this.fade(source, 0);
    viewport.dataset.selectorNavigationPhase = 'travel';
    if (!await this.tween(timing.travel, progress => {
      const x = from.x + (to.x - from.x) * progress;
      // 克制的跳跃弧线；两端严格落在投影位置，不移动相机代替跳跃。
      const y = from.y + (to.y - from.y) * progress - Math.sin(Math.PI * progress) * Math.min(32, Math.hypot(to.x - from.x, to.y - from.y) * 0.12);
      proxy.setAttribute('transform', `translate(${x} ${y}) scale(${startScale + (endScale - startScale) * progress})`);
    })) return;

    this.arrived = this.options.arrive();
    if (!this.arrived) { this.cancel(); return; }
    incoming.style.removeProperty('display');
    proxy.remove();
    outgoing.style.display = 'none';
    viewport.dataset.selectorNavigationPhase = 'expand';
    const layers = [...incoming.children].filter(element => !element.classList.contains('selector-graph-nodes')) as SVGElement[];
    const layerOpacity = layers.map(opacityOf);
    const nodes = view.nodes.map(node => ({ view: node, element: nodeElement(incoming, node.nodeId)! }));
    if (!await this.tween(timing.expand, progress => {
      layers.forEach((element, index) => this.fade(element, layerOpacity[index] * progress));
      for (const { view: node, element } of nodes) {
        this.fade(element, node.nodeId === motion.to.nodeId ? 1 : progress);
      }
    })) return;
    this.complete();
  }

  private complete(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.settleFrame?.(false);
    this.settleFrame = null;
    this.observer?.disconnect();
    this.proxy?.remove();
    this.overlay?.remove();
    const { viewport, outgoing, incoming, newCamera } = this.options;
    for (const [element, style] of this.restore) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }
    for (const [element, attributes] of this.attributes) {
      for (const [name, value] of attributes) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    if (this.arrived) {
      outgoing.remove();
      incoming.style.removeProperty('display');
      incoming.removeAttribute('aria-hidden');
      incoming.querySelectorAll<SVGGElement>('[data-selector-node]').forEach(node => {
        node.setAttribute('transform', `translate(${node.dataset.nodeX} ${node.dataset.nodeY}) scale(${nodeScale(newCamera) / newCamera.scale})`);
      });
    } else {
      incoming.remove();
      outgoing.style.removeProperty('display');
    }
    delete viewport.dataset.selectorNavigationPhase;
    delete viewport.dataset.selectorNavigationDirection;
    this.options.finish();
  }
}
