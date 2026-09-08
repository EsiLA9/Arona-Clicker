import type {
  ComponentPlacementDef,
  BackgroundLayerDef,
  PresentationDef,
  PresentationLayerDef,
  PresentationRegion,
  PlacementAnchor,
  MotionDef,
  MotionPreset,
  StateAppearanceDef,
  PresentationHostState,
  PresentationTextColorMode,
  PresentationShape,
} from '../engine/types/theme';
import type { Condition } from '../engine/types/expression';
import type { PicQueryPort } from '../arona-clicker/contracts/pic-query';
import type { BackgroundDecorationView, BackgroundView } from './background-service';
import { buildBackgroundDecorationView, renderBackground } from './background-service';
import type { UIContext } from './context';
import {
  CORNER_RADIUS_MAX,
  CORNER_RADIUS_MIN,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_PARALLELOGRAM_SKEW_X_DEG,
  DEFAULT_PANEL_OPACITY,
  SKEW_X_DEG_MAX,
  SKEW_X_DEG_MIN,
} from './presentation-config';

export interface PresentationViewLayer {
  id?: string;
  kind: PresentationLayerDef['kind'];
  value: string;
  opacity: number;
  position: string;
  size: string;
  repeat: string;
  blendMode: string;
  attachment: string;
  scale?: number;
  rotation?: number;
}

export interface ResolvedAssetView {
  ref: string;
  url: string;
  alt: string;
  fit: 'cover' | 'contain' | 'natural';
}

export interface ComponentView extends ResolvedAssetView {
  id: string;
  parent: string;
  anchor: PlacementAnchor;
  offset: { x: number; y: number; unit: 'percent' | 'px' };
  size?: { width?: number; height?: number; unit: 'percent' | 'px' | 'auto' };
}

export interface PresentationRegionView {
  layers: readonly PresentationViewLayer[];
  components: readonly ComponentView[];
}

export interface PresentationHostView {
  layers: readonly PresentationViewLayer[];
  opacity: number;
  shape?: PresentationShape;
  cornerRadius?: number;
  skewXDeg?: number;
  decoration?: BackgroundDecorationView;
  textColorMode?: PresentationTextColorMode;
  systemColorLayerIgnored?: boolean;
  layerOrder?: readonly string[];
  states?: ReadonlyMap<PresentationHostState, PresentationHostStateView>;
}

export interface PresentationHostStateView {
  layers: readonly PresentationViewLayer[];
  decoration?: BackgroundDecorationView;
  systemColorLayerIgnored?: boolean;
  layerOrder?: readonly string[];
  textColorMode?: PresentationTextColorMode;
}

export interface PresentationView {
  region(region: PresentationRegion): PresentationRegionView;
  host(id: string): PresentationHostView;
  shapeForHost(id: string): PresentationShape | undefined;
  shapeParametersForHost(id: string): Pick<PresentationHostView, 'shape' | 'cornerRadius' | 'skewXDeg'>;
  hasHost(id: string): boolean;
  panelOpacity(region: PresentationRegion): number;
  asset(ref: string): ResolvedAssetView | undefined;
  motion(name: string): MotionDef | undefined;
  stateAppearance(state: StateAppearanceDef['state']): StateAppearanceDef | undefined;
}

const REGIONS: readonly PresentationRegion[] = [
  'shell', 'header', 'leftPanel', 'centerPanel', 'rightPanel', 'footer', 'story', 'modal',
];
const SAFE_VALUE = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\([^;<>]+\)|var\(--[a-z0-9-]+\))$/i;
const SAFE_POSITION = /^[a-z0-9% .-]+$/i;
const SAFE_SIZE = /^[a-z0-9% .-]+$/i;
const SAFE_REPEAT = /^(?:repeat|repeat-x|repeat-y|no-repeat|space|round)$/;
const SAFE_BLEND = /^(?:normal|multiply|screen|overlay|soft-light|hard-light|darken|lighten)$/;
const SAFE_FIT = new Set(['cover', 'contain', 'natural']);
const SAFE_ANCHOR = new Set<PlacementAnchor>(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']);
const SAFE_UNIT = new Set(['percent', 'px', 'auto']);
const SAFE_ATTACHMENT = new Set(['scroll', 'fixed', 'local']);
const SAFE_MOTION = new Set<MotionPreset>(['none', 'fade', 'fade-up', 'soft-scale', 'slide-in', 'pulse']);
const SAFE_SHAPES = new Set<PresentationShape>(['rounded-rectangle', 'rounded-parallelogram']);

function safeCss(value: string | undefined, pattern: RegExp, fallback: string): string {
  return value && pattern.test(value.trim()) ? value.trim() : fallback;
}

function safeNumber(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(-10000, Math.min(10000, value)) : fallback;
}

function safeRange(value: number | undefined, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
}

function safeAssetUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^(?:https?:|blob:|data:image\/|\/|\.\.?\/)/i.test(trimmed)) return trimmed;
  return undefined;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

function imageView(ref: string, pics: PicQueryPort): ResolvedAssetView | undefined {
  const def = pics.defOf(ref);
  const url = safeAssetUrl(pics.urlOf(ref) ?? '');
  if (!def || !url) return undefined;
  const fit = def.defaultFit && SAFE_FIT.has(def.defaultFit) ? def.defaultFit : 'natural';
  return { ref, url, alt: def.alt ?? def.label ?? '', fit: fit as ResolvedAssetView['fit'] };
}

function layerView(layer: BackgroundLayerDef, value: string): PresentationViewLayer | undefined {
  if (layer.kind === 'empty') return { kind: layer.kind, value: 'transparent', opacity: 0, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed', scale: 1, rotation: 0 };
  if (layer.kind !== 'image' && !SAFE_VALUE.test(value.trim())) return undefined;
  return {
    id: layer.id,
    kind: layer.kind,
    value: value ?? '',
    opacity: Math.max(0, Math.min(1, layer.opacity ?? 1)),
    position: safeCss(layer.position, SAFE_POSITION, 'center'),
    size: safeCss(layer.size, SAFE_SIZE, 'cover'),
    repeat: safeCss(layer.repeat, SAFE_REPEAT, 'no-repeat'),
    blendMode: safeCss(layer.blendMode, SAFE_BLEND, 'normal'),
    attachment: layer.attachment && SAFE_ATTACHMENT.has(layer.attachment) ? layer.attachment : 'fixed',
    scale: Math.max(0.05, Math.min(8, typeof layer.scale === 'number' && Number.isFinite(layer.scale) ? layer.scale : 1)),
    rotation: typeof layer.rotation === 'number' && Number.isFinite(layer.rotation) ? ((layer.rotation % 360) + 360) % 360 : 0,
  };
}

function hasCycle(id: string, byId: ReadonlyMap<string, ComponentPlacementDef>): boolean {
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && byId.has(current)) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current)!.parent;
  }
  return false;
}

function regionFor(component: ComponentPlacementDef, byId: ReadonlyMap<string, ComponentPlacementDef>): PresentationRegion | undefined {
  const seen = new Set<string>();
  let parent = component.parent;
  while (parent) {
    if (REGIONS.includes(parent as PresentationRegion)) return parent as PresentationRegion;
    if (seen.has(parent)) return undefined;
    seen.add(parent);
    parent = byId.get(parent)?.parent ?? '';
  }
  return undefined;
}

export function buildPresentationView(
  presentation: PresentationDef | undefined,
  pics: PicQueryPort,
  options: { evaluateCondition?: (condition: Condition) => boolean } = {},
): PresentationView {
  const regionMap = new Map<PresentationRegion, PresentationRegionView>(
    REGIONS.map(region => [region, { layers: [], components: [] }]),
  );
  const panelOpacity = new Map<PresentationRegion, number>();
  const hostMap = new Map<string, PresentationHostView>();
  for (const panel of presentation?.panels ?? []) {
    if (REGIONS.includes(panel.region)) panelOpacity.set(panel.region, Math.max(0, Math.min(1, panel.opacity ?? DEFAULT_PANEL_OPACITY)));
  }
  const asset = (ref: string): ResolvedAssetView | undefined => imageView(ref, pics);
  const resolveLayer = (layer: BackgroundLayerDef): PresentationViewLayer | undefined => {
    const image = layer.kind === 'image' ? asset(layer.value) : undefined;
    return layer.kind === 'image'
      ? (image ? layerView({ ...layer, value: `url(\"${image.url.replace(/\"/g, '%22')}\")` }, `url(\"${image.url.replace(/\"/g, '%22')}\")`) : undefined)
      : layerView(layer, layer.value.trim());
  };
  const motions = new Map<string, MotionDef>();
  for (const [name, motion] of Object.entries(presentation?.motions ?? {})) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) continue;
    const clean = (value: MotionPreset | undefined): MotionPreset | undefined => value && SAFE_MOTION.has(value) ? value : undefined;
    motions.set(name, {
      enter: clean(motion.enter), exit: clean(motion.exit), hover: clean(motion.hover),
      duration: motion.duration === 'fast' || motion.duration === 'slow' || motion.duration === 'normal' ? motion.duration : undefined,
    });
  }
  const states = new Map((presentation?.states ?? []).map(state => [state.state, {
    ...state,
    emphasis: state.emphasis === 'quiet' || state.emphasis === 'strong' ? state.emphasis : 'normal',
  }] as const));
  for (const layer of presentation?.layers ?? []) {
    if (!REGIONS.includes(layer.region)) continue;
    const resolved = resolveLayer(layer);
    if (resolved) {
      const current = regionMap.get(layer.region)!;
      regionMap.set(layer.region, { ...current, layers: [...current.layers, resolved] });
    }
  }
  for (const host of presentation?.hosts ?? []) {
    const orderLayers = (layers: readonly BackgroundLayerDef[] | undefined, layerOrder: readonly string[] | undefined) => {
      const resolvedLayers = (layers ?? []).map(resolveLayer).filter((layer): layer is PresentationViewLayer => Boolean(layer));
      const rank = new Map((layerOrder ?? []).map((id, index) => [id, index]));
      return [...resolvedLayers].sort((a, b) => (rank.get(a.id ?? '') ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id ?? '') ?? Number.MAX_SAFE_INTEGER));
    };
    const orderedLayers = orderLayers(host.layers, host.layerOrder);
    const states = new Map<PresentationHostState, PresentationHostStateView>();
    for (const state of ['default', 'active', 'inactive', 'disabled'] as const) {
      const stateDef = host.states?.[state];
      if (!stateDef) continue;
      states.set(state, {
        layers: orderLayers(stateDef.layers, stateDef.layerOrder),
        decoration: buildBackgroundDecorationView(stateDef.decoration),
        systemColorLayerIgnored: stateDef.systemColorLayerIgnored === true,
        layerOrder: stateDef.layerOrder,
        textColorMode: stateDef.textColorMode,
      });
    }
    hostMap.set(host.id, {
      layers: orderedLayers,
      opacity: Math.max(0, Math.min(1, host.opacity ?? DEFAULT_PANEL_OPACITY)),
      shape: host.shape && SAFE_SHAPES.has(host.shape) ? host.shape : undefined,
      cornerRadius: safeRange(host.cornerRadius, CORNER_RADIUS_MIN, CORNER_RADIUS_MAX),
      skewXDeg: safeRange(host.skewXDeg, SKEW_X_DEG_MIN, SKEW_X_DEG_MAX),
      decoration: buildBackgroundDecorationView(host.decoration),
      textColorMode: host.textColorMode,
      systemColorLayerIgnored: host.systemColorLayerIgnored === true,
      layerOrder: host.layerOrder ?? orderedLayers.map(layer => layer.id).filter((id): id is string => Boolean(id)),
      states,
    });
  }
  const defs = (presentation?.components ?? []).filter(component => component.id && component.parent);
  const byId = new Map(defs.map(component => [component.id, component]));
  for (const component of defs) {
    if (hasCycle(component.id, byId)) continue;
    if (component.visibleWhen && options.evaluateCondition && !options.evaluateCondition(component.visibleWhen)) continue;
    const view = component.asset ? asset(component.asset) : undefined;
    if (!view) continue;
    const region = regionFor(component, byId);
    if (!region || !REGIONS.includes(region)) continue;
    if (!SAFE_ANCHOR.has(component.anchor)) continue;
    const offsetUnit = component.offset?.unit && SAFE_UNIT.has(component.offset.unit) ? component.offset.unit : 'percent';
    const sizeUnit = component.size?.unit && SAFE_UNIT.has(component.size.unit) ? component.size.unit : 'auto';
    const current = regionMap.get(region)!;
    regionMap.set(region, {
      ...current,
      components: [...current.components, {
        ...view,
        id: component.id,
        parent: component.parent,
        anchor: component.anchor,
        offset: { x: safeNumber(component.offset?.x), y: safeNumber(component.offset?.y), unit: offsetUnit as 'percent' | 'px' },
        size: component.size ? { ...component.size, unit: sizeUnit as 'percent' | 'px' | 'auto' } : undefined,
      }],
    });
  }
  const shapeParametersForHost = (id: string): Pick<PresentationHostView, 'shape' | 'cornerRadius' | 'skewXDeg'> => {
    let candidate = id;
    let shape: PresentationShape | undefined;
    let cornerRadius: number | undefined;
    let skewXDeg: number | undefined;
    while (candidate) {
      const host = hostMap.get(candidate);
      if (host) {
        if (shape === undefined && host.shape !== undefined) shape = host.shape;
        if (cornerRadius === undefined && host.cornerRadius !== undefined) cornerRadius = host.cornerRadius;
        if (skewXDeg === undefined && host.skewXDeg !== undefined) skewXDeg = host.skewXDeg;
        if (shape !== undefined && cornerRadius !== undefined && skewXDeg !== undefined) break;
      }
      const separator = candidate.lastIndexOf('.');
      candidate = separator >= 0 ? candidate.slice(0, separator) : '';
    }
    return {
      shape,
      cornerRadius: cornerRadius ?? DEFAULT_CORNER_RADIUS,
      skewXDeg: skewXDeg ?? (shape === 'rounded-parallelogram' ? DEFAULT_PARALLELOGRAM_SKEW_X_DEG : 0),
    };
  };

  return {
    region: region => regionMap.get(region) ?? { layers: [], components: [] },
    host: id => hostMap.get(id) ?? { layers: [], opacity: DEFAULT_PANEL_OPACITY },
    shapeForHost: id => shapeParametersForHost(id).shape,
    shapeParametersForHost,
    hasHost: id => hostMap.has(id),
    panelOpacity: region => hostMap.get(region)?.opacity ?? panelOpacity.get(region) ?? DEFAULT_PANEL_OPACITY,
    asset,
    motion: name => motions.get(name),
    stateAppearance: state => states.get(state),
  };
}

function componentStyle(component: ComponentView): string {
  const offset = `${component.offset.x}${component.offset.unit}`;
  const cross = `${component.offset.y}${component.offset.unit}`;
  const parts = ['position:absolute', 'pointer-events:none', `object-fit:${component.fit === 'natural' ? 'contain' : component.fit}`];
  switch (component.anchor) {
    case 'top-left': parts.push(`left:${offset}`, `top:${cross}`); break;
    case 'top-right': parts.push(`right:${offset}`, `top:${cross}`); break;
    case 'bottom-left': parts.push(`left:${offset}`, `bottom:${cross}`); break;
    case 'bottom-right': parts.push(`right:${offset}`, `bottom:${cross}`); break;
    case 'center': parts.push(`left:calc(50% + ${offset})`, `top:calc(50% + ${cross})`, 'transform:translate(-50%, -50%)'); break;
  }
  if (component.size?.width !== undefined && component.size.unit !== 'auto') parts.push(`width:${safeNumber(component.size.width)}${component.size.unit}`);
  if (component.size?.height !== undefined && component.size.unit !== 'auto') parts.push(`height:${safeNumber(component.size.height)}${component.size.unit}`);
  return parts.join(';');
}

function renderComponent(component: ComponentView, children: ReadonlyMap<string, readonly ComponentView[]>): string {
  const nested = (children.get(component.id) ?? []).map(child => renderComponent(child, children)).join('');
  const imageStyle = `width:100%;height:100%;object-fit:${component.fit === 'natural' ? 'contain' : component.fit}`;
  return `<div class="presentation-component-node" data-presentation-component="${escapeAttribute(component.id)}" style="${escapeAttribute(componentStyle(component))}"><img class="presentation-component" src="${escapeAttribute(component.url)}" alt="${escapeAttribute(component.alt)}" style="${escapeAttribute(imageStyle)}" loading="lazy">${nested}</div>`;
}

export function renderPresentationRegion(view: PresentationView, region: PresentationRegion): string {
  const resolved = view.region(region);
  const layers = resolved.layers.map((layer, index) => `<div class="presentation-layer" data-presentation-layer="${index}" aria-hidden="true" style="${escapeAttribute(`z-index:${index + 1};background:${layer.value};opacity:${layer.opacity};background-position:${layer.position};background-size:${layer.size};background-repeat:${layer.repeat};background-blend-mode:${layer.blendMode};background-attachment:${layer.attachment};transform:scale(${layer.scale ?? 1}) rotate(${layer.rotation ?? 0}deg)`)}"></div>`).join('');
  const children = new Map<string, ComponentView[]>();
  for (const component of resolved.components) {
    const list = children.get(component.parent) ?? [];
    list.push(component);
    children.set(component.parent, list);
  }
  const components = resolved.components.filter(component => component.parent === region)
    .map(component => renderComponent(component, children)).join('');
  return `<div class="presentation-region" data-presentation-region="${region}" aria-hidden="true">${layers}${components}</div>`;
}

export function renderPresentationHostBackground(ctx: UIContext, hostId: string, className = 'presentation-host-background', state: PresentationHostState = 'default'): string {
  if (!ctx.presentation?.hasHost?.(hostId) && state === 'default') return '';
  const background = ctx.backgroundForHost(hostId, false, state);
  const hoverBackground = state === 'inactive'
    ? ctx.backgroundForHost(hostId, false, 'active')
    : undefined;
  return renderBackground(background, className, hoverBackground);
}

export interface UIHostRenderOptions {
  hostId: string;
  content: string;
  className?: string;
  state?: PresentationHostState;
  textMode?: PresentationTextColorMode;
  themeScope?: string;
}

/** 统一生成带表现宿主元数据的服务容器，避免新服务重复手写主题接线。 */
export function renderUIHost(ctx: UIContext, options: UIHostRenderOptions): string {
  const state = options.state ?? 'default';
  const resolved = ctx.presentationHostState(options.hostId, state);
  const textMode = options.textMode ?? resolved.textColorMode;
  const hoverTextMode = state === 'inactive' ? ctx.hoverTextColorModeForHost(options.hostId) : undefined;
  const background = renderPresentationHostBackground(ctx, options.hostId, 'presentation-host-background', state);
  const hostId = escapeAttribute(options.hostId);
  const className = escapeAttribute(options.className ?? 'ui-host');
  const scope = options.themeScope ? ` data-theme-scope="${escapeAttribute(options.themeScope)}"` : '';
  const hoverTextAttribute = hoverTextMode ? ` data-theme-hover-text-mode="${hoverTextMode}"` : '';
  return `<section class="${className} presentation-host-target" data-theme-host-id="${hostId}" data-theme-state="${state}" data-theme-text-mode="${textMode}"${hoverTextAttribute}${scope}>${background}<div class="presentation-host-content">${options.content}</div></section>`;
}
