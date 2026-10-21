// ============================================================
// ui/components/selector-graph.ts — Init / GlobalEnhancement 节点图谱
//
// 与 tools/node-graph-ui-demo 的空间呈现保持同一阅读方式：轴测参考平面、
// 圆形节点、节点下方的名称、节点间连线、右侧当前节点工作台。
// 这里只做只读投影与表现；位置 / 连线不写入存档，也不改变揭示与购买条件。
//
// 状态来源：
// - 可见性与名称 / 条件 / 效用：getInitReveal() / getEnhancementReveal()
// - 拥有：unlockedInits / unlockedEnhancements
// - 活动：activeInit
// ============================================================

import type { UIContext } from '../context';
import type { InitSelectMode } from './init-select';
import {
  initDisplayName,
  initNodeState,
  initStateLabel,
  renderInitDetail,
  visibleInitsByTilt,
} from './init-select';
import {
  enhancementDisplayName,
  enhancementNodeState,
  enhancementStateLabel,
  renderGlobalEnhancementDetail,
  visibleGlobalEnhancements,
} from './global-enhancement-select';
import type { SelectorNodeKind, SelectorNodeState } from '../selector-theme';

export interface SelectorSelection {
  kind: SelectorNodeKind;
  entityId: string;
}

export interface SelectorGraphNodeView extends SelectorSelection {
  nodeId: string;
  index: number;
  title: string;
  state: SelectorNodeState;
  stateLabel: string;
  kindLabel: string;
  themeStyle: string;
  /** 投影后的画布坐标（SVG viewBox 单位）。 */
  position: { x: number; y: number };
  /** 节点在平台上的逻辑平面坐标；与网格共用 projectPlane()。 */
  planeCoordinate: { x: number; y: number };
  /** 节点在平台平面的落点；position 为按 elevation 偏移后的节点本体坐标。 */
  planePosition: { x: number; y: number };
  /** 仅用于空间呈现；正数抬高，负数下沉。 */
  elevation: number;
  iconPath: string;
  /** 是否处于迷雾态：只显示问号与占位名称。 */
  fog: boolean;
  ariaLabel: string;
  /** 该节点声明的图间关系；位置按轴测平面坐标解释。 */
  graphPortal?: SelectorGraphPortalDef;
  /** 当前由此实体挂载的 Active Affector 提供的具体图/节点目标。 */
  graphTargets: SelectorGraphTarget[];
}

export interface SelectorGraphEdgeView {
  from: string;
  to: string;
  tone: 'base' | 'open' | 'owned';
}

export interface SelectorGraphView {
  graphId: string;
  graphTitle: string;
  nodes: SelectorGraphNodeView[];
  edges: SelectorGraphEdgeView[];
  backdrop?: {
    /** 单槽背景按 source/target 图对合并，多个链接节点不会重复绘制同一星座。 */
    constellationId: string;
    nodes: SelectorGraphNodeView[];
    edges: SelectorGraphEdgeView[];
    sourceNodeId: string;
    targetNodeId: string;
    sourcePosition: { x: number; y: number } | null;
    showConnector: boolean;
  };
  summaryText: string;
}

export interface SelectorGraphPortalDef {
  /** 进入目标图时是否将来源图作为另一侧的只读星图显示。 */
  renderOtherGraph: boolean;
  /** 是否显示来源节点到目标节点的跨图连线。 */
  renderLink: boolean;
  /** 来源星图在目标图逻辑平面中的偏移量；单位是平面轴坐标，不是画布像素。 */
  otherGraphPosition: { x: number; y: number };
  /** 母图星座的布局比例；压缩节点间距，星点大小由星座样式单独控制。 */
  constellationScale?: number;
}

export interface SelectorGraphTarget {
  graphId: string;
  nodeId: string;
  instanceId: string;
  packId: string;
}

export const DEFAULT_SELECTOR_GRAPH_PORTAL: SelectorGraphPortalDef = {
  renderOtherGraph: false,
  renderLink: false,
  otherGraphPosition: { x: 0, y: 0 },
  constellationScale: 0.48,
};

export function selectorConstellationScale(portal: SelectorGraphPortalDef): number {
  return Math.min(1, Math.max(0.1, portal.constellationScale ?? 0.48));
}

interface SelectorGraphNodeDef extends SelectorSelection {
  /** 该星图自己的逻辑平面坐标。 */
  coordinate: { x: number; y: number };
  /** 可选的节点级跨图关系；未声明时不创建入口。 */
  portal?: SelectorGraphPortalDef | null;
}

export interface SelectorGraphDefinition {
  id: string;
  title: string;
  nodes: SelectorGraphNodeDef[];
  edges: Array<{ from: string; to: string }>;
}

const GRAPH_PORTALS: Record<string, SelectorGraphPortalDef> = {
  'global-enh:base:enhancement:foundation': {
    renderOtherGraph: true,
    renderLink: true,
    constellationScale: 0.48,
    // Demo 的星图合成思路改用产品自己的平面坐标：来源图向逻辑轴的左上侧摆放。
    otherGraphPosition: { x: -360, y: -210 },
  },
};

/**
 * 产品侧图谱数据。Demo 仅作为几何/交互参考；产品只消费自己的图定义，
 * 未来删除 tools/node-graph-ui-demo 不会影响此处。
 */
export const SELECTOR_GRAPH_DEFINITIONS: Record<string, SelectorGraphDefinition> = {
  'base:graph:foundation': {
    id: 'base:graph:foundation',
    title: '基建星图',
    nodes: [
      { kind: 'init', entityId: 'base:init:millennium', coordinate: { x: -180, y: -80 } },
      { kind: 'init', entityId: 'base:init:abydos', coordinate: { x: -40, y: 80 } },
      { kind: 'init', entityId: 'base:init:gehenna', coordinate: { x: 120, y: -40 } },
      { kind: 'global-enh', entityId: 'base:enhancement:foundation', coordinate: { x: 40, y: -200 }, portal: null },
      { kind: 'global-enh', entityId: 'base:enhancement:unified_logistics', coordinate: { x: 240, y: 40 } },
    ],
    edges: [
      { from: 'init:base:init:millennium', to: 'init:base:init:abydos' },
      { from: 'init:base:init:abydos', to: 'init:base:init:gehenna' },
      { from: 'init:base:init:millennium', to: 'global-enh:base:enhancement:foundation' },
      { from: 'global-enh:base:enhancement:foundation', to: 'global-enh:base:enhancement:unified_logistics' },
    ],
  },
};

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 620;
const PLANE_CENTER = { x: 450, y: 310 };
/** 轴测投影：x 轴向右下、y 轴向右上；两者的屏幕斜率不同。 */
const PLANE_SKEW = 0.82;
const PLANE_RISE = 0.44;
const GRID_STEP = 80;
const NODE_ELEVATION_STEP = 38;
const NODE_VISUAL_SCALE = 0.68;

/** 屏幕内的节点尺寸独立于布局间距；放大画布或退场时最多为原尺寸的 1.5 倍。 */
export function selectorNodeRenderScale(cameraScale: number): number {
  return Math.min(1.5, cameraScale >= 1 ? cameraScale : Math.max(0.55, cameraScale ** 0.7));
}

/** 纯视觉高程；不参与可见性、购买、世界线归属或效果判断。 */
const NODE_ELEVATIONS: Record<string, number> = {
  'init:base:init:millennium': 1,
  'init:base:init:abydos': -1,
  'init:base:init:gehenna': 1,
  'global-enh:base:enhancement:foundation': 1,
  'global-enh:base:enhancement:unified_logistics': -1,
  'global-enh:base:enhancement:hangar_safety_grid': -1,
};

const KIND_LABEL: Record<SelectorNodeKind, string> = {
  'init': '世界线',
  'global-enh': '全局强化',
};

/** 节点内的线性图符；只做视觉区分，不代表新的实体类型。 */
const INIT_ICONS = [
  'M -9 7 L 0 -8 L 9 7 Z M -12 7 H 12',
  'M -9 8 V -6 M 9 8 V -6 M -9 -2 H 9 M -3 8 V -2',
  'M -10 0 A 10 6 0 1 0 10 0 A 10 6 0 1 0 -10 0 M -6 5 H 6',
  'M -12 3 H 12 M -12 -1 H 12 M -8 3 V -1 M 8 3 V -1 M -2 3 V -1 M 2 3 V -1',
  'M -6 8 V -8 M 6 8 V -8 M -6 -8 H 6 M -9 8 H 9 M -2 -3 V 2',
] as const;

const ENH_ICONS = [
  'M 0 -9 V -4 M 0 4 V 9 M -9 0 H -4 M 4 0 H 9 M -6.5 -6.5 L -3 -3 M 3 3 L 6.5 6.5 M 6.5 -6.5 L 3 -3 M -3 3 L -6.5 6.5',
  'M 0 -9 L 8 -4.5 V 4.5 L 0 9 L -8 4.5 V -4.5 Z M -3 0 H 3',
  'M -8 0 H -4 M 4 0 H 8 M 0 -8 V -4 M 0 4 V 8 M -5.5 -5.5 L -2.8 -2.8 M 2.8 2.8 L 5.5 5.5 M 5.5 -5.5 L 2.8 -2.8 M -2.8 2.8 L -5.5 5.5',
  'M -6 8 V 2 L -2 -6 V -8 H 2 V -6 L 6 2 V 8 Z M -6 8 H 6',
  'M -11 6 H -2 V 0 H 6 V -6 H 11 M -2 6 V 0 M 6 0 V -6',
  'M 0 -9 L 8 -5 V 2 C 8 6 4 8 0 9 C -4 8 -8 6 -8 2 V -5 Z',
] as const;

/** 星区槽位：手工校准的画布落点，只属于表现层，不参与任何业务判定。 */
interface ScreenPoint { x: number; y: number }

const INIT_SLOTS: ScreenPoint[] = [
  { x: 200, y: 300 },
  { x: 320, y: 170 },
  { x: 450, y: 230 },
  { x: 340, y: 405 },
  { x: 470, y: 385 },
  { x: 250, y: 470 },
  { x: 520, y: 500 },
  { x: 520, y: 120 },
];

const ENH_SLOTS: ScreenPoint[] = [
  { x: 650, y: 145 },
  { x: 770, y: 215 },
  { x: 645, y: 310 },
  { x: 780, y: 345 },
  { x: 650, y: 465 },
  { x: 785, y: 490 },
  { x: 865, y: 260 },
  { x: 870, y: 420 },
];

const INIT_SLOT_BY_ID: Record<string, number> = {
  'base:init:schale_office': 0,
  'base:init:millennium': 1,
  'base:init:trinity': 2,
  'base:init:abydos': 3,
  'base:init:gehenna': 4,
};

const ENH_SLOT_BY_ID: Record<string, number> = {
  'base:enhancement:user-theme-editor': 0,
  'base:enhancement:foundation': 1,
  'base:enhancement:unified_logistics': 2,
  'base:enhancement:eternal_contract': 3,
  'base:enhancement:hangar_dispatch_protocol': 4,
  'base:enhancement:hangar_safety_grid': 5,
};

function slotPosition(slots: ScreenPoint[], index: number): ScreenPoint {
  if (index < slots.length) return slots[index];
  const extra = index - slots.length;
  const angle = -0.8 + extra * 1.05;
  const radius = 210 + Math.floor(extra / 6) * 76;
  return {
    x: Math.max(70, Math.min(VIEW_WIDTH - 70, slots[0].x + Math.cos(angle) * radius)),
    y: Math.max(90, Math.min(VIEW_HEIGHT - 80, slots[0].y + Math.sin(angle) * radius)),
  };
}

/** 已知实体占据预设槽位，其余实体依次填空位；不产生重叠，也不随揭示顺序跳位。 */
function assignSlots(ids: readonly string[], slots: ScreenPoint[], preferred: Record<string, number>): Map<string, ScreenPoint> {
  const used = new Set<number>();
  const result = new Map<string, ScreenPoint>();
  for (const id of ids) {
    const slot = preferred[id];
    if (slot !== undefined && slot < slots.length && !used.has(slot)) {
      used.add(slot);
      result.set(id, slots[slot]);
    }
  }
  let cursor = 0;
  for (const id of ids) {
    if (result.has(id)) continue;
    while (used.has(cursor)) cursor += 1;
    used.add(cursor);
    result.set(id, slotPosition(slots, cursor));
    cursor += 1;
  }
  return result;
}

/** 轴测参考平面的投影入口：网格、节点、连线共用同一套参数。 */
export function projectPlane(x: number, y: number): { x: number; y: number } {
  return {
    x: PLANE_CENTER.x + PLANE_SKEW * (x - y),
    y: PLANE_CENTER.y + PLANE_RISE * (x + y),
  };
}

function iconFor(kind: SelectorNodeKind, index: number): string {
  const icons = kind === 'init' ? INIT_ICONS : ENH_ICONS;
  return icons[index % icons.length];
}

function nodeTitle(title: string, fog: boolean): string {
  return fog || title === '???' ? '未知节点' : title;
}

function nodeGeometry(kind: SelectorNodeKind, entityId: string, preferredScreenPosition: ScreenPoint): {
  planeCoordinate: { x: number; y: number };
  planePosition: ScreenPoint;
  position: ScreenPoint;
  elevation: number;
} {
  // 槽位是为保持当前画面布局给出的屏幕锚点；先逆投影成平面坐标，再统一正投影。
  const planeCoordinate = unprojectPlane(preferredScreenPosition.x, preferredScreenPosition.y);
  const planePosition = projectPlane(planeCoordinate.x, planeCoordinate.y);
  const elevation = NODE_ELEVATIONS[`${kind}:${entityId}`] ?? 0;
  return {
    planeCoordinate,
    planePosition,
    position: { x: planePosition.x, y: planePosition.y - elevation * NODE_ELEVATION_STEP },
    elevation,
  };
}

/** 只读节点图谱投影；Affector 明确给出目标图与链接节点。 */
function graphTargetsForEntity(ctx: UIContext, entityId: string): SelectorGraphTarget[] {
  const sourcesByGraph = ctx.game.affectorEngine.getActiveGraphCapabilitySources?.() ?? new Map();
  const targets = new Map<string, SelectorGraphTarget>();
  for (const [graphId, sources] of sourcesByGraph) {
    const definition = SELECTOR_GRAPH_DEFINITIONS[graphId];
    if (!definition) continue;
    for (const source of sources) {
      if (source.mountEntityId !== entityId) continue;
      if (!definition.nodes.some(node => graphNodeId(node) === source.nodeId)) continue;
      const key = `${graphId}\u0000${source.nodeId}`;
      if (!targets.has(key)) {
        targets.set(key, {
          graphId,
          nodeId: source.nodeId,
          instanceId: source.instanceId,
          packId: source.packId,
        });
      }
    }
  }
  return [...targets.values()];
}

function graphPortalFor(kind: SelectorNodeKind, entityId: string): SelectorGraphPortalDef | undefined {
  return GRAPH_PORTALS[`${kind}:${entityId}`];
}

function buildRootSelectorGraphView(ctx: UIContext): SelectorGraphView {
  const inits = visibleInitsByTilt(ctx);
  const enhancements = visibleGlobalEnhancements(ctx);
  const initPositions = assignSlots(inits.map(init => init.id), INIT_SLOTS, INIT_SLOT_BY_ID);
  const enhPositions = assignSlots(enhancements.map(enh => enh.id), ENH_SLOTS, ENH_SLOT_BY_ID);

  const initNodes: SelectorGraphNodeView[] = inits.map((init, index) => {
    const state = initNodeState(init);
    const fog = state === 'fog';
    const title = initDisplayName(init);
    const preferredScreenPosition = initPositions.get(init.id) ?? INIT_SLOTS[0];
    const geometry = nodeGeometry('init', init.id, preferredScreenPosition);
    return {
      nodeId: `init:${init.id}`,
      kind: 'init',
      entityId: init.id,
      index,
      title: nodeTitle(title, fog),
      state,
      stateLabel: initStateLabel(init),
      kindLabel: KIND_LABEL['init'],
      themeStyle: init.themeStyle,
      position: geometry.position,
      planeCoordinate: geometry.planeCoordinate,
      planePosition: geometry.planePosition,
      elevation: geometry.elevation,
      iconPath: iconFor('init', index),
      fog,
      ariaLabel: `${KIND_LABEL['init']} ${nodeTitle(title, fog)}，${initStateLabel(init)}`,
      graphPortal: graphPortalFor('init', init.id),
      graphTargets: graphTargetsForEntity(ctx, init.id),
    };
  });

  const enhNodes: SelectorGraphNodeView[] = enhancements.map((enh, index) => {
    const state = enhancementNodeState(enh);
    const fog = state === 'fog';
    const title = enhancementDisplayName(enh);
    const preferredScreenPosition = enhPositions.get(enh.id) ?? ENH_SLOTS[0];
    const geometry = nodeGeometry('global-enh', enh.id, preferredScreenPosition);
    return {
      nodeId: `global-enh:${enh.id}`,
      kind: 'global-enh',
      entityId: enh.id,
      index,
      title: nodeTitle(title, fog),
      state,
      stateLabel: enhancementStateLabel(enh),
      kindLabel: KIND_LABEL['global-enh'],
      themeStyle: enh.themeStyle,
      position: geometry.position,
      planeCoordinate: geometry.planeCoordinate,
      planePosition: geometry.planePosition,
      elevation: geometry.elevation,
      iconPath: iconFor('global-enh', index),
      fog,
      ariaLabel: `${KIND_LABEL['global-enh']} ${nodeTitle(title, fog)}，${enhancementStateLabel(enh)}`,
      graphPortal: graphPortalFor('global-enh', enh.id),
      graphTargets: graphTargetsForEntity(ctx, enh.id),
    };
  });

  const nodes = [...initNodes, ...enhNodes];
  const edges: SelectorGraphEdgeView[] = [];
  const addEdges = (list: SelectorGraphNodeView[]) => {
    for (let index = 0; index < list.length - 1; index += 1) {
      const from = list[index];
      const to = list[index + 1];
      const bothOwned = (from.state === 'owned' || from.state === 'active')
        && (to.state === 'owned' || to.state === 'active');
      const open = from.state === 'buyable' || to.state === 'buyable';
      edges.push({ from: from.nodeId, to: to.nodeId, tone: bothOwned ? 'owned' : open ? 'open' : 'base' });
    }
  };
  addEdges(initNodes);
  addEdges(enhNodes);

  const ownedInits = inits.filter(init => init.unlocked).length;
  const ownedEnhancements = enhancements.filter(enh => enh.owned).length;
  return {
    graphId: 'main',
    graphTitle: '世界线与全局强化',
    nodes,
    edges,
    summaryText: `${inits.length} WORLD LINE · ${ownedInits} OWNED / ${enhancements.length} GLOBAL ENH · ${ownedEnhancements} ACTIVE`,
  };
}

function moveNodeOnPlane(
  node: SelectorGraphNodeView,
  offset: { x: number; y: number },
  scale: number,
): SelectorGraphNodeView {
  const planeCoordinate = {
    x: offset.x + node.planeCoordinate.x * scale,
    y: offset.y + node.planeCoordinate.y * scale,
  };
  const planePosition = projectPlane(planeCoordinate.x, planeCoordinate.y);
  return {
    ...node,
    position: {
      x: planePosition.x,
      y: planePosition.y - node.elevation * NODE_ELEVATION_STEP * scale,
    },
    planePosition,
    planeCoordinate,
    graphPortal: undefined,
    graphTargets: [],
  };
}

function graphNodeId(selection: SelectorSelection): string {
  return `${selection.kind}:${selection.entityId}`;
}

function makeDefinedGraphView(
  ctx: UIContext,
  definition: SelectorGraphDefinition,
  parent?: { graphId: string; sourceNode: SelectorSelection; targetNodeId: string; portal: SelectorGraphPortalDef },
): SelectorGraphView {
  const base = buildRootSelectorGraphView(ctx);
  const available = new Map(base.nodes.map(node => [graphNodeId(node), node]));
  const nodes = definition.nodes.flatMap((nodeDef, index) => {
    const baseNode = available.get(graphNodeId(nodeDef));
    if (!baseNode) return [];
    const planeCoordinate = nodeDef.coordinate;
    const planePosition = projectPlane(planeCoordinate.x, planeCoordinate.y);
    const elevation = NODE_ELEVATIONS[`${baseNode.kind}:${baseNode.entityId}`] ?? 0;
    const portal = nodeDef.portal === null ? undefined : nodeDef.portal ?? graphPortalFor(baseNode.kind, baseNode.entityId);
    return [{
      ...baseNode,
      index,
      planeCoordinate,
      planePosition,
      position: { x: planePosition.x, y: planePosition.y - elevation * NODE_ELEVATION_STEP },
      elevation,
      graphPortal: portal,
      graphTargets: graphTargetsForEntity(ctx, baseNode.entityId),
    }];
  });
  const nodeIds = new Set(nodes.map(node => node.nodeId));
  const edges = definition.edges.flatMap(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)
    ? [{ from: edge.from, to: edge.to, tone: 'base' as const }]
    : []);

  let backdrop: SelectorGraphView['backdrop'];
  const canRenderParentConstellation = !!parent
    && parent.graphId !== definition.id
    && nodes.some(node => node.nodeId === parent.targetNodeId);
  const sourceView = canRenderParentConstellation && parent && parent.graphId !== 'main' && SELECTOR_GRAPH_DEFINITIONS[parent.graphId]
    ? makeDefinedGraphView(ctx, SELECTOR_GRAPH_DEFINITIONS[parent.graphId])
    : base;
  if (canRenderParentConstellation && parent?.portal.renderOtherGraph) {
    const sourceNodeId = graphNodeId(parent.sourceNode);
    const targetNodeId = parent.targetNodeId;
    const constellationScale = selectorConstellationScale(parent.portal);
    const shiftedNodes = sourceView.nodes.map(node => moveNodeOnPlane(
      node,
      parent.portal.otherGraphPosition,
      constellationScale,
    ));
    const shiftedSource = shiftedNodes.find(node => node.nodeId === sourceNodeId);
    backdrop = {
      constellationId: `${parent.graphId}->${definition.id}`,
      nodes: shiftedNodes,
      edges: sourceView.edges,
      sourceNodeId,
      targetNodeId,
      sourcePosition: shiftedSource?.position ?? null,
      showConnector: parent.portal.renderLink,
    };
  } else if (canRenderParentConstellation && parent) {
    // 星图显示与跨图连线是两个独立开关；只画线时仍从来源图的平面坐标计算锚点。
    const source = sourceView.nodes.find(node => node.nodeId === graphNodeId(parent.sourceNode));
    if (source) {
      const constellationScale = selectorConstellationScale(parent.portal);
      const shifted = moveNodeOnPlane(source, parent.portal.otherGraphPosition, constellationScale);
      backdrop = {
        constellationId: `${parent.graphId}->${definition.id}`,
        nodes: [],
        edges: [],
        sourceNodeId: shifted.nodeId,
        targetNodeId: parent.targetNodeId,
        sourcePosition: shifted.position,
        showConnector: parent.portal.renderLink,
      };
    }
  }

  return {
    graphId: definition.id,
    graphTitle: definition.title,
    nodes,
    edges,
    backdrop,
    summaryText: `${definition.title.toUpperCase()} · ${nodes.length} NODES · ${edges.length} LINKS`,
  };
}

/** Build one arbitrary graph plus an optional source-graph composition from the navigation relation. */
export function buildSelectorGraphView(
  ctx: UIContext,
  graphId = 'main',
  parent?: { graphId: string; sourceNode: SelectorSelection; targetNodeId: string; portal: SelectorGraphPortalDef },
): SelectorGraphView {
  if (graphId === 'main') return buildRootSelectorGraphView(ctx);
  const definition = SELECTOR_GRAPH_DEFINITIONS[graphId];
  return definition ? makeDefinedGraphView(ctx, definition, parent) : buildRootSelectorGraphView(ctx);
}

/** 默认选中：优先用户上次选择，其次当前活动世界线，最后排序首位。 */
export function resolveSelectorSelection(
  ctx: UIContext,
  initialKind: SelectorNodeKind,
  initSelectedId: string | null,
  enhSelectedId: string | null,
): SelectorSelection | null {
  const nodes = buildSelectorGraphView(ctx).nodes;
  const inits = nodes.filter(node => node.kind === 'init');
  const enhancements = nodes.filter(node => node.kind === 'global-enh');
  if (initialKind === 'global-enh') {
    const enh = enhancements.find(node => node.entityId === enhSelectedId) ?? enhancements[0];
    if (enh) return { kind: 'global-enh', entityId: enh.entityId };
  }
  const init = inits.find(node => node.entityId === initSelectedId) ?? inits[0];
  if (init) return { kind: 'init', entityId: init.entityId };
  const fallback = enhancements[0];
  return fallback ? { kind: 'global-enh', entityId: fallback.entityId } : null;
}

function isNodeSelected(node: SelectorGraphNodeView, selected: SelectorSelection | null): boolean {
  return !!selected && selected.kind === node.kind && selected.entityId === node.entityId;
}

function nodeClassName(node: SelectorGraphNodeView, selected: SelectorSelection | null): string {
  return [
    'selector-node',
    node.kind === 'init' ? 'is-init' : 'is-enh',
    `is-${node.state}`,
    isNodeSelected(node, selected) ? 'is-selected' : '',
  ].filter(Boolean).join(' ');
}

/** 原位刷新只需这些字段；SVG 节点不通过重建 innerHTML 更新。 */
export function selectorNodePresentation(node: SelectorGraphNodeView, selected: SelectorSelection | null): {
  className: string;
  ariaPressed: string;
  ariaLabel: string;
  glyph: string;
  label: string;
} {
  return {
    className: nodeClassName(node, selected),
    ariaPressed: isNodeSelected(node, selected) ? 'true' : 'false',
    ariaLabel: node.ariaLabel,
    glyph: node.fog ? '?' : '',
    label: node.title,
  };
}

/** 节点标签宽度估算：中文按 1em、拉丁按 0.55em；过长时用 textLength 压缩而不是截断。 */
function labelLengthAttribute(label: string): string {
  let units = 0;
  for (const character of label) units += /[\u3000-\u9fff]/.test(character) ? 1 : 0.55;
  return units * 12 > 100 ? ' textLength="100" lengthAdjust="spacingAndGlyphs"' : '';
}

function renderNodeHeight(node: SelectorGraphNodeView): string {
  if (node.elevation === 0) return '';
  const planeOffset = node.planePosition.y - node.position.y;
  const heightKind = node.elevation > 0 ? 'above' : 'below';
  return `
    <g class="selector-node-height is-${heightKind}"
      data-selector-node-height
      data-node-x="${node.position.x}"
      data-node-y="${node.position.y}"
      data-plane-offset="${planeOffset}"
      aria-hidden="true"
      pointer-events="none"
      transform="translate(${node.position.x} ${node.position.y})">
      <line class="selector-node-riser" x1="0" y1="0" x2="0" y2="${planeOffset}"></line>
      <g class="selector-node-footprint-scale" transform="translate(0 ${planeOffset})">
        <ellipse class="selector-node-footprint" cx="0" cy="0" rx="${22 * NODE_VISUAL_SCALE}" ry="${9 * NODE_VISUAL_SCALE}"></ellipse>
      </g>
    </g>`;
}

/** 单个节点；原位刷新时复用同一 <g> 外壳，保持 DOM 身份。 */
export function renderSelectorGraphNode(
  ctx: UIContext,
  node: SelectorGraphNodeView,
  selected: SelectorSelection | null,
  interactive = true,
  backdropEntry = false,
): string {
  const presentation = selectorNodePresentation(node, selected);
  const selectAttribute = !interactive ? '' : node.kind === 'init'
    ? `data-init-select="${ctx.escapeHtml(node.entityId)}"`
    : `data-global-enh-select="${ctx.escapeHtml(node.entityId)}"`;
  const icon = node.fog
    ? ''
    : `<path class="selector-node-icon" d="${node.iconPath}"></path>`;
  return `
    <g class="${presentation.className}${interactive ? '' : ` is-backdrop${backdropEntry ? ' is-entry' : ''}`}"
      ${interactive ? 'data-selector-node' : ''}
      data-selector-node-kind="${node.kind}"
      data-node-id="${ctx.escapeHtml(node.nodeId)}"
      data-node-x="${node.position.x}"
      data-node-y="${node.position.y}"
      ${selectAttribute}
      ${interactive ? `role="button" tabindex="0" aria-pressed="${presentation.ariaPressed}" aria-label="${ctx.escapeHtml(presentation.ariaLabel)}"` : 'aria-hidden="true" pointer-events="none"'}
      style="${ctx.escapeHtml(node.themeStyle)}"
      transform="translate(${node.position.x} ${node.position.y})">
      <circle class="selector-node-hit" r="42"></circle>
      <g class="selector-node-visual" transform="scale(${NODE_VISUAL_SCALE})">
        <circle class="selector-node-ring" r="36"></circle>
        <circle class="selector-node-body" r="27"></circle>
        ${icon}
        <text class="selector-node-glyph" text-anchor="middle" dy="0.35em">${presentation.glyph}</text>
        <circle class="selector-node-badge" cx="19" cy="-19" r="8"></circle>
        <path class="selector-node-check" d="M -3.4 0 L -1 2.6 L 3.6 -2.6" transform="translate(19 -19)"></path>
      </g>
      <text class="selector-node-label${node.elevation === 0 ? '' : ' is-elevated'}" text-anchor="middle" x="0" y="41"${labelLengthAttribute(presentation.label)}>${ctx.escapeHtml(presentation.label)}</text>
    </g>`;
}

interface GraphCamera {
  scale: number;
  x: number;
  y: number;
}

interface PlaneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** 撤销 SVG 相机变换，再把投影坐标还原为平面坐标。 */
function unprojectPlane(x: number, y: number): ScreenPoint {
  const horizontal = (x - PLANE_CENTER.x) / PLANE_SKEW;
  const vertical = (y - PLANE_CENTER.y) / PLANE_RISE;
  return {
    x: (horizontal + vertical) / 2,
    y: (vertical - horizontal) / 2,
  };
}

/** 以当前相机反算画布四角的平面范围，网格只绘制可视区域及少量余量。 */
function visiblePlaneBounds(camera: GraphCamera): PlaneBounds {
  const corners = [
    { x: 0, y: 0 },
    { x: VIEW_WIDTH, y: 0 },
    { x: 0, y: VIEW_HEIGHT },
    { x: VIEW_WIDTH, y: VIEW_HEIGHT },
  ].map(point => unprojectPlane(
    (point.x - camera.x) / camera.scale,
    (point.y - camera.y) / camera.scale,
  ));
  const xs = corners.map(point => point.x);
  const ys = corners.map(point => point.y);
  const margin = GRID_STEP * 2;
  return {
    minX: Math.min(...xs) - margin,
    maxX: Math.max(...xs) + margin,
    minY: Math.min(...ys) - margin,
    maxY: Math.max(...ys) + margin,
  };
}

function gridValues(min: number, max: number): number[] {
  const first = Math.floor(min / GRID_STEP) * GRID_STEP;
  const last = Math.ceil(max / GRID_STEP) * GRID_STEP;
  const values: number[] = [];
  for (let value = first; value <= last; value += GRID_STEP) values.push(value);
  return values;
}

function renderGrid(camera: GraphCamera = { scale: 1, x: 0, y: 0 }): string {
  const bounds = visiblePlaneBounds(camera);
  const lines: string[] = [];
  for (const value of gridValues(bounds.minX, bounds.maxX)) {
    const verticalStart = projectPlane(value, bounds.minY);
    const verticalEnd = projectPlane(value, bounds.maxY);
    const major = value !== 0 && value % (GRID_STEP * 5) === 0;
    const axis = value === 0;
    const className = `selector-graph-gridline${axis ? ' is-axis' : major ? ' is-major' : ''}`;
    lines.push(`<line class="${className}" x1="${verticalStart.x.toFixed(2)}" y1="${verticalStart.y.toFixed(2)}" x2="${verticalEnd.x.toFixed(2)}" y2="${verticalEnd.y.toFixed(2)}"></line>`);
  }
  for (const value of gridValues(bounds.minY, bounds.maxY)) {
    const horizontalStart = projectPlane(bounds.minX, value);
    const horizontalEnd = projectPlane(bounds.maxX, value);
    const major = value !== 0 && value % (GRID_STEP * 5) === 0;
    const axis = value === 0;
    const className = `selector-graph-gridline${axis ? ' is-axis' : major ? ' is-major' : ''}`;
    lines.push(`<line class="${className}" x1="${horizontalStart.x.toFixed(2)}" y1="${horizontalStart.y.toFixed(2)}" x2="${horizontalEnd.x.toFixed(2)}" y2="${horizontalEnd.y.toFixed(2)}"></line>`);
  }
  const origin = projectPlane(0, 0);
  return `<g class="selector-graph-grid" aria-hidden="true">${lines.join('')}<circle class="selector-graph-origin" cx="${origin.x}" cy="${origin.y}" r="3.2"></circle></g>`;
}

/** 相机变化时只替换网格线，保留画布、节点、焦点与工作台 DOM。 */
export function updateSelectorGraphGrid(group: SVGGElement | null, camera: GraphCamera): void {
  if (group) group.innerHTML = renderGrid(camera);
}

/** 静态跨图线与导航绘线共用路径；反向交换两端即为同一曲线的反向。 */
export function selectorGraphLinkPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const middleX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${middleX} ${from.y}, ${middleX} ${to.y}, ${to.x} ${to.y}`;
}

function renderCanvas(ctx: UIContext, view: SelectorGraphView, selected: SelectorSelection | null): string {
  const byId = new Map(view.nodes.map(node => [node.nodeId, node]));
  const edges = view.edges.map(edge => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return '';
    return `<line class="selector-graph-edge is-${edge.tone}" x1="${from.position.x}" y1="${from.position.y}" x2="${to.position.x}" y2="${to.position.y}"></line>`;
  }).join('');
  const projectionEdges = view.edges.map(edge => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to || (from.elevation === 0 && to.elevation === 0)) return '';
    const start = projectPlane(from.planeCoordinate.x, from.planeCoordinate.y);
    const end = projectPlane(to.planeCoordinate.x, to.planeCoordinate.y);
    return `<line class="selector-graph-projection-edge" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"></line>`;
  }).join('');
  const heights = view.nodes.map(renderNodeHeight).join('');
  const nodes = view.nodes.map(node => renderSelectorGraphNode(ctx, node, selected)).join('');
  const backdropById = new Map((view.backdrop?.nodes ?? []).map(node => [node.nodeId, node]));
  const backdropEdges = (view.backdrop?.edges ?? []).map(edge => {
    const from = backdropById.get(edge.from);
    const to = backdropById.get(edge.to);
    if (!from || !to) return '';
    return `<line class="selector-graph-edge is-backdrop" x1="${from.position.x}" y1="${from.position.y}" x2="${to.position.x}" y2="${to.position.y}"></line>`;
  }).join('');
  const backdropNodes = (view.backdrop?.nodes ?? []).map(node => renderSelectorGraphNode(
    ctx,
    node,
    null,
    false,
    node.nodeId === view.backdrop?.sourceNodeId,
  )).join('');
  const sourceNode = view.backdrop?.nodes.find(node => node.nodeId === view.backdrop?.sourceNodeId);
  const targetNode = byId.get(view.backdrop?.targetNodeId ?? '');
  const sourcePosition = sourceNode?.position ?? view.backdrop?.sourcePosition;
  const connector = view.backdrop?.showConnector && sourcePosition && targetNode
    ? `<path class="selector-graph-cross-link" d="${selectorGraphLinkPath(sourcePosition, targetNode.position)}"></path>`
    : '';
  return `
    <div class="selector-graph-stage">
      <svg class="selector-graph-canvas" data-selector-graph-viewport viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="group" aria-label="世界线与全局强化节点图">
        <g class="selector-graph-world" data-selector-graph-world>
          ${renderGrid()}
          <g class="selector-graph-backdrop"${view.backdrop ? ` data-constellation-id="${ctx.escapeHtml(view.backdrop.constellationId)}"` : ''} aria-hidden="true">${backdropEdges}${backdropNodes}${connector}</g>
          <g class="selector-graph-projection-edges" aria-hidden="true">${projectionEdges}</g>
          <g class="selector-graph-edges" aria-hidden="true">${edges}</g>
          <g class="selector-graph-heights" aria-hidden="true">${heights}</g>
          <g class="selector-graph-nodes">${nodes}</g>
        </g>
      </svg>
    </div>`;
}

/** 画布主体：导航、比例尺、轴测平面和视图提示。 */
export function renderSelectorGraphWorkspace(
  ctx: UIContext,
  view: SelectorGraphView,
  selected: SelectorSelection | null,
  themeKey: string,
  graphId = 'main',
  canGoBack = false,
): string {
  const selectedKind = selected?.kind ?? 'init';
  return `
    <section class="selector-graph" data-selector-graph data-selector-graph-id="${ctx.escapeHtml(graphId)}" data-selector-theme-key="${ctx.escapeHtml(themeKey)}" data-selector-selected-kind="${selectedKind}" aria-label="世界线与全局强化节点图">
      ${canGoBack ? '<div class="selector-graph-toolbar"><button type="button" class="selector-graph-back" data-selector-graph-back>返回上一张星图</button></div>' : ''}
      <div class="selector-graph-scale">
        <label for="selector-graph-zoom">图谱比例</label>
        <input id="selector-graph-zoom" type="range" min="40" max="220" step="1" value="100" data-selector-zoom-slider aria-label="图谱比例">
        <output class="selector-graph-zoom" data-selector-zoom-readout>100%</output>
        <button type="button" class="selector-graph-reset" data-selector-zoom-reset title="复位视图">复位</button>
      </div>
      <div class="selector-graph-meta">
        <span class="selector-graph-summary" data-selector-graph-summary>${ctx.escapeHtml(view.summaryText)}</span>
        <span class="selector-graph-hint">拖动空白平移 · 滚轮缩放 · Tab 切换节点</span>
      </div>
      ${renderCanvas(ctx, view, selected)}
    </section>`;
}

/** 工作台内容：详情随选中节点替换，节点本身不重建。 */
export function renderSelectorWorkbenchContent(
  ctx: UIContext,
  mode: InitSelectMode,
  selected: SelectorSelection | null,
  showBackToGame: boolean,
  graphId = 'main',
): string {
  if (!selected) {
    return `
      <div class="selector-detail selector-detail-empty">
        <span class="eyebrow">NODE DETAIL</span>
        <h2>选择一个节点</h2>
        <p>点击画布上的世界线或全局强化节点，查看揭示状态、条件与可用操作。</p>
      </div>`;
  }
  const detail = selected.kind === 'init'
    ? renderInitDetail(ctx, mode, selected.entityId)
    : renderGlobalEnhancementDetail(ctx, selected.entityId, showBackToGame);
  const node = buildSelectorGraphView(ctx, graphId).nodes.find(candidate =>
    candidate.kind === selected.kind && candidate.entityId === selected.entityId);
  const portal = node?.graphPortal;
  const graphTargets = node?.graphTargets ?? [];
  const graphAction = graphTargets.length > 0
    ? `<section class="selector-graph-portal"><span class="eyebrow">LINKED STAR MAP</span><p>该节点的 Active Affector 提供以下星图入口。</p>${graphTargets.map(target => {
        const title = SELECTOR_GRAPH_DEFINITIONS[target.graphId]?.title ?? target.graphId;
        return `<button type="button" class="selector-graph-enter" data-selector-graph-enter="${ctx.escapeHtml(target.graphId)}" data-selector-graph-target-node="${ctx.escapeHtml(target.nodeId)}">进入 ${ctx.escapeHtml(title)} ↗</button>`;
      }).join('')}</section>`
    : portal
      ? `<section class="selector-graph-portal is-locked"><span class="eyebrow">LINKED STAR MAP</span><p>取得并激活此节点关联的 Affector 后开放进入。</p></section>`
      : '';
  return `${detail}${graphAction}`;
}

/** 工作台头部：图标、名称、类型与状态；首次渲染与选中刷新共用。 */
export function renderSelectorWorkbenchHead(ctx: UIContext, node: SelectorGraphNodeView | undefined): string {
  const badge = node
    ? `<span class="selector-workbench-badge is-${node.state}">${ctx.escapeHtml(node.stateLabel)}</span>`
    : '<span class="selector-workbench-badge is-idle">未选择</span>';
  const icon = node
    ? `<span class="selector-workbench-icon is-${node.state}" aria-hidden="true"><svg viewBox="-14 -14 28 28"><path d="${node.iconPath}"></path></svg></span>`
    : '';
  const title = node
    ? `<span class="selector-workbench-title">${ctx.escapeHtml(node.title)}</span>`
    : '<span class="selector-workbench-title">节点工作台</span>';
  const kind = node
    ? `<span class="selector-workbench-kind">${ctx.escapeHtml(node.kindLabel)}</span>`
    : '';
  return `
    <div class="selector-workbench-heading">
      <span class="eyebrow">当前节点</span>
      <div class="selector-workbench-identity">${icon}<div class="selector-workbench-titles">${title}${kind}</div></div>
    </div>
    ${badge}`;
}

/** 右侧固定工作台：独立滚动，不随画布平移 / 缩放。 */
export function renderSelectorWorkbench(
  ctx: UIContext,
  mode: InitSelectMode,
  selected: SelectorSelection | null,
  showBackToGame: boolean,
  graphId = 'main',
): string {
  const view = buildSelectorGraphView(ctx, graphId);
  const node = selected
    ? view.nodes.find(candidate => candidate.kind === selected.kind && candidate.entityId === selected.entityId)
    : undefined;
  return `
    <button type="button" class="selector-workbench-toggle" data-selector-workbench-toggle aria-expanded="true" aria-controls="selector-node-workbench">收起详情 <span aria-hidden="true">›</span></button>
    <aside id="selector-node-workbench" class="selector-workbench" data-selector-workbench aria-label="节点工作台">
      <header class="selector-workbench-head">${renderSelectorWorkbenchHead(ctx, node)}</header>
      <div class="selector-workbench-body" data-selector-workbench-body>
        ${renderSelectorWorkbenchContent(ctx, mode, selected, showBackToGame, graphId)}
      </div>
    </aside>`;
}
