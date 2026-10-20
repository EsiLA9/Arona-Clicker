/**
 * 节点探索 UI Demo
 *
 * 独立实验：只使用本目录的类型、数据与 DOM，不导入任何游戏业务模块。
 * 进度只保存在当前页面会话的内存中，刷新即重置。
 */

type GraphId = 'main' | 'branch';
type NodeState = 'hidden' | 'frontier' | 'known' | 'owned';
type LayoutMode = 'wide' | 'compact';

interface NodeCoordinate {
  x: number;
  y: number;
}

interface DemoNode {
  id: string;
  name: string;
  description: string;
  initialState: NodeState;
  childGraphId?: GraphId;
  /** 随机节点的初始落点，使用 0–1 归一化坐标，便于两种布局复用。 */
  seed?: { nx: number; ny: number };
  /** 纯视觉海拔：0 贴在平面上，正数抬高、负数下沉。 */
  elevation?: number;
}

type DemoEdgeKind = 'route' | 'directed' | 'virtual';

interface DemoEdge {
  a: string;
  b: string;
  /** route 双向可探索；directed 只沿 a→b 探索；virtual 仅作关系提示。 */
  kind?: DemoEdgeKind;
}

interface LayoutPreset {
  viewBox: string;
  radius: number;
  hitRadius: number;
  labelOffset: number;
  /** 设计约束：边目标长度、节点最小间距、同一节点相邻边的夹角下限。 */
  idealEdgeLength: number;
  minNodeGap: number;
  minAngleDeg: number;
  coordinates: Record<string, NodeCoordinate>;
}

interface SolveStats {
  iterations: number;
  passes: number;
  maxStep: number;
  minGap: number;
  minAngle: number;
  overlaps: number;
}

interface DemoGraph {
  id: GraphId;
  name: string;
  nodes: DemoNode[];
  edges: DemoEdge[];
  layouts: Record<LayoutMode, LayoutPreset>;
  /** 子图中承接父图入口的局部节点 ID。 */
  entryNodeId?: string;
}

interface SessionState {
  currentGraphId: GraphId;
  nodeStates: Record<GraphId, Record<string, NodeState>>;
  selectedNodeIds: Record<GraphId, string | null>;
  /** 归一化平面拖动偏移；只保存在当前页面会话。 */
  nodeOffsets: Record<GraphId, Record<string, NodeCoordinate>>;
  /** 观察范围偏移；平面和节点共用此相机位置。 */
  cameraOffset: NodeCoordinate;
}

interface NodeDragState {
  graphId: GraphId;
  nodeId: string;
  pointerId: number;
  startPointer: NodeCoordinate;
  startCoordinate: NodeCoordinate;
  startOffset: NodeCoordinate;
  moved: boolean;
}

interface CameraPanState {
  pointerId: number;
  startPointer: NodeCoordinate;
  startOffset: NodeCoordinate;
  moved: boolean;
}

interface PanelAction {
  id: string;
  label: string;
  tone: 'primary' | 'ghost';
  run: () => void;
}

interface NodeView {
  group: SVGGElement;
  glyph: SVGTextElement;
  label: SVGTextElement;
}

interface GraphEntryRelation {
  parent: DemoGraph;
  parentNode: DemoNode;
  child: DemoGraph;
  entryNode: DemoNode;
}

interface ProjectionMetrics {
  centerX: number;
  centerY: number;
  scaleX: number;
  scaleY: number;
  heightScale: number;
  worldUnits: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const COMPACT_CANVAS_WIDTH = 560;
const MIN_PROJECTION_SCALE = 0.1;
const MAX_PROJECTION_SCALE = 10;
const WHEEL_ZOOM_SPEED = 0.0012;
const NODE_DETAIL_LOD_THRESHOLD = 0.4;
const GRAPH_IDS: GraphId[] = ['main', 'branch'];

const STATE_LABEL: Record<NodeState, string> = {
  hidden: '未发现',
  frontier: '待探索',
  known: '已认识',
  owned: '已拥有',
};

/** 固定节点的本地线条图符；仅做视觉映射，不新增节点类型。 */
const NODE_ICONS: Record<string, string> = {
  A: 'M -9 7 L 0 -8 L 9 7 Z M -12 7 H 12',
  B: 'M -10 8 C -4 8 2 4 4 -2 C 5 -6 8 -7 10 -8',
  C: 'M -12 3 H 12 M -12 -1 H 12 M -8 3 V -1 M 8 3 V -1 M -2 3 V -1 M 2 3 V -1',
  D: 'M -9 8 V 0 A 9 9 0 0 1 9 0 V 8 M -12 8 H 12',
  E: 'M -11 8 H -2 V 2 H 5 V -4 H 11',
  F: 'M -12 7 L -4 -4 L 1 2 L 5 -2 L 12 7 Z',
  X: 'M -9 8 V -6 M 9 8 V -6 M -9 -2 H 9 M -3 8 V -2',
  Y: 'M -10 0 A 10 6 0 1 0 10 0 A 10 6 0 1 0 -10 0 M -6 5 H 6',
  Z: 'M -6 8 V -8 M 6 8 V -8 M -6 -8 H 6 M -9 8 H 9 M -2 -3 V 2',
  W: 'M -10 7 C -2 7 1 3 3 -2 C 4 -5 7 -6 10 -7 M 1 -1 L -4 0 L -2 4',
};
const RANDOM_NODE_ICON = 'M 0 -8 L 7 0 L 0 8 L -7 0 Z M -3 0 H 3';

function iconFor(nodeId: string): string {
  return NODE_ICONS[nodeId] ?? RANDOM_NODE_ICON;
}

const GRAPHS: Record<GraphId, DemoGraph> = {
  main: {
    id: 'main',
    name: '探索原野',
    nodes: [
      {
        id: 'A',
        name: '晨曦营地',
        description: '旅途起点的木质营地，晨光穿过旗面，在草地上留下长长的影子。',
        initialState: 'owned',
      },
      {
        id: 'B',
        name: '风语小径',
        description: '沿缓坡而上的小径，风穿过草叶时带着细碎的低语。',
        initialState: 'known',
      },
      {
        id: 'C',
        name: '旧木桥',
        description: '横跨浅溪的木桥，桥板被往来的脚步磨得发亮。',
        initialState: 'frontier',
      },
      {
        id: 'D',
        name: '回声之门',
        description: '刻着回环纹样的拱门，门后藏着一处安静的庭院。',
        initialState: 'hidden',
        childGraphId: 'branch',
      },
      {
        id: 'E',
        name: '苔痕石阶',
        description: '被苔痕覆盖的石阶，一阶一阶通向更高的坡地。',
        initialState: 'hidden',
      },
      {
        id: 'F',
        name: '远丘瞭望',
        description: '视野开阔的高地，可以望见整片原野的尽头。',
        initialState: 'hidden',
      },
      {
        id: 'G',
        name: '风车台地',
        description: '几座旧风车守着台地，叶片把云影切成缓慢移动的碎片。',
        initialState: 'hidden',
      },
      {
        id: 'H',
        name: '北辰灯塔',
        description: '沿着高地边缘点亮的灯塔，为夜行者标出北方。',
        initialState: 'hidden',
      },
      {
        id: 'I',
        name: '月影渡口',
        description: '浅滩上的旧渡口，与远处灯塔隔水相望。',
        initialState: 'hidden',
      },
      {
        id: 'J',
        name: '云端遗迹',
        description: '石柱静静立在云雾边缘，仿佛曾经连接着另一条道路。',
        initialState: 'hidden',
      },
    ],
    edges: [
      { a: 'A', b: 'B' },
      { a: 'A', b: 'C' },
      { a: 'B', b: 'D', kind: 'directed' },
      { a: 'B', b: 'G' },
      { a: 'G', b: 'H' },
      { a: 'G', b: 'I' },
      { a: 'C', b: 'E' },
      { a: 'E', b: 'F' },
      { a: 'C', b: 'I' },
      { a: 'H', b: 'J', kind: 'directed' },
      { a: 'F', b: 'J', kind: 'virtual' },
    ],
    layouts: {
      wide: {
        viewBox: '0 0 760 510',
        radius: 32,
        hitRadius: 46,
        labelOffset: 56,
        idealEdgeLength: 200,
        minNodeGap: 150,
        minAngleDeg: 40,
        coordinates: {
          A: { x: 120, y: 250 },
          B: { x: 300, y: 150 },
          C: { x: 300, y: 350 },
          D: { x: 520, y: 100 },
          E: { x: 520, y: 355 },
          F: { x: 688, y: 442 },
          G: { x: 430, y: 250 },
          H: { x: 620, y: 170 },
          I: { x: 450, y: 430 },
          J: { x: 690, y: 355 },
        },
      },
      compact: {
        viewBox: '0 0 420 520',
        radius: 30,
        hitRadius: 42,
        labelOffset: 52,
        idealEdgeLength: 150,
        minNodeGap: 110,
        minAngleDeg: 40,
        coordinates: {
          A: { x: 108, y: 88 },
          B: { x: 108, y: 248 },
          C: { x: 306, y: 162 },
          D: { x: 108, y: 408 },
          E: { x: 306, y: 322 },
          F: { x: 306, y: 458 },
          G: { x: 208, y: 145 },
          H: { x: 310, y: 90 },
          I: { x: 208, y: 370 },
          J: { x: 310, y: 440 },
        },
      },
    },
  },
  branch: {
    id: 'branch',
    name: '回声庭院',
    entryNodeId: 'X',
    nodes: [
      {
        id: 'X',
        name: '回廊入口',
        description: '半开的回廊入口，脚步声会沿着墙壁一路传开。',
        initialState: 'owned',
      },
      {
        id: 'Y',
        name: '静水庭院',
        description: '庭院中央是一方静水，水面复制着上方的天空。',
        initialState: 'frontier',
      },
      {
        id: 'Z',
        name: '钟塔残影',
        description: '只剩轮廓的钟塔，指针停在同一个时刻。',
        initialState: 'hidden',
      },
      {
        id: 'W',
        name: '蔓生耳语',
        description: '爬满整面矮墙的藤蔓，靠近时能听到细微的沙沙声。',
        initialState: 'hidden',
      },
      {
        id: 'U',
        name: '镜面回廊',
        description: '镜面映出并不存在的岔路，只有一条细线指向更深处。',
        initialState: 'hidden',
      },
      {
        id: 'V',
        name: '庭院星盘',
        description: '石盘上的星位与庭院入口相连，却不代表真实通路。',
        initialState: 'hidden',
      },
    ],
    edges: [
      { a: 'X', b: 'Y' },
      { a: 'Y', b: 'Z' },
      { a: 'Y', b: 'W' },
      { a: 'Z', b: 'U', kind: 'directed' },
      { a: 'W', b: 'U' },
      { a: 'Y', b: 'V' },
      { a: 'X', b: 'V', kind: 'virtual' },
    ],
    layouts: {
      wide: {
        viewBox: '0 0 760 510',
        radius: 32,
        hitRadius: 46,
        labelOffset: 56,
        idealEdgeLength: 210,
        minNodeGap: 150,
        minAngleDeg: 40,
        coordinates: {
          X: { x: 140, y: 300 },
          Y: { x: 390, y: 230 },
          Z: { x: 650, y: 170 },
          W: { x: 390, y: 412 },
          U: { x: 645, y: 330 },
          V: { x: 160, y: 110 },
        },
      },
      compact: {
        viewBox: '0 0 420 520',
        radius: 30,
        hitRadius: 42,
        labelOffset: 52,
        idealEdgeLength: 155,
        minNodeGap: 110,
        minAngleDeg: 40,
        coordinates: {
          X: { x: 105, y: 92 },
          Y: { x: 105, y: 250 },
          Z: { x: 105, y: 408 },
          W: { x: 305, y: 250 },
          U: { x: 305, y: 408 },
          V: { x: 205, y: 92 },
        },
      },
    },
  },
};

const ELEVATIONS: Record<string, number> = { D: 1, F: 1, E: -1, Z: 1, W: -1 };

for (const graphId of GRAPH_IDS) {
  for (const node of GRAPHS[graphId].nodes) {
    node.elevation = ELEVATIONS[node.id] ?? 0;
  }
}

function cloneGraph(graph: DemoGraph): DemoGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge) => ({ ...edge })),
    layouts: graph.layouts,
  };
}

/** 初始数据快照：随机节点与重置都以它为基准恢复。 */
const INITIAL_GRAPHS: Record<GraphId, DemoGraph> = {
  main: cloneGraph(GRAPHS.main),
  branch: cloneGraph(GRAPHS.branch),
};

function restoreInitialGraphs(): void {
  for (const graphId of GRAPH_IDS) {
    const base = INITIAL_GRAPHS[graphId];
    GRAPHS[graphId].nodes = base.nodes.map((node) => ({ ...node }));
    GRAPHS[graphId].edges = base.edges.map((edge) => ({ ...edge }));
  }
}

function queryElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Demo 缺少必要元素：${selector}`);
  return element;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

function createArrowMarker(markerId: string): SVGDefsElement {
  const defs = createSvgElement('defs', {});
  const marker = createSvgElement('marker', {
    id: markerId,
    viewBox: '0 0 10 10',
    refX: '8',
    refY: '5',
    markerWidth: '6',
    markerHeight: '6',
    orient: 'auto-start-reverse',
    markerUnits: 'strokeWidth',
  });
  marker.append(createSvgElement('path', { d: 'M 0 1 L 9 5 L 0 9 Z', fill: '#8aa5bc' }));
  defs.append(marker);
  return defs;
}

const elements = {
  graphName: queryElement<HTMLElement>('#graph-name'),
  breadcrumb: queryElement<HTMLElement>('#breadcrumb'),
  backButton: queryElement<HTMLButtonElement>('#back-button'),
  resetButton: queryElement<HTMLButtonElement>('#reset-button'),
  randomNodeButton: queryElement<HTMLButtonElement>('#random-node-button'),
  canvasHost: queryElement<HTMLElement>('#canvas-host'),
  backdrop: queryElement<SVGSVGElement>('#graph-backdrop'),
  backdropCaption: queryElement<HTMLElement>('#backdrop-caption'),
  backdropNodeLimitControl: queryElement<HTMLElement>('#backdrop-node-limit-control'),
  backdropNodeLimit: queryElement<HTMLInputElement>('#backdrop-node-limit'),
  svg: queryElement<SVGSVGElement>('#graph-canvas'),
  progress: queryElement<HTMLElement>('#progress'),
  projectionScale: queryElement<HTMLInputElement>('#projection-scale'),
  projectionScaleValue: queryElement<HTMLOutputElement>('#projection-scale-value'),
  nodeName: queryElement<HTMLElement>('#node-name'),
  nodeState: queryElement<HTMLElement>('#node-state'),
  nodeDescription: queryElement<HTMLElement>('#node-desc'),
  nodeActions: queryElement<HTMLElement>('#node-actions'),
  nodeIcon: queryElement<HTMLElement>('#node-icon'),
  worldNote: queryElement<HTMLElement>('#world-note'),
  connector: queryElement<SVGSVGElement>('#graph-connector'),
  feedback: queryElement<HTMLElement>('#feedback'),
  debugOutput: queryElement<HTMLElement>('#debug-output'),
};

function findNode(graph: DemoGraph, nodeId: string): DemoNode | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}

function currentGraph(): DemoGraph {
  return GRAPHS[session.currentGraphId];
}

/** 当前图若是某张图的子图，返回它的上层图；本 Demo 只有一层。 */
function parentGraphId(graphId: GraphId): GraphId | null {
  for (const candidateId of GRAPH_IDS) {
    const candidate = GRAPHS[candidateId];
    if (candidate.nodes.some((node) => node.childGraphId === graphId)) return candidate.id;
  }
  return null;
}

function graphEntryRelation(graphId: GraphId): GraphEntryRelation | null {
  const child = GRAPHS[graphId];
  const owners = GRAPH_IDS.flatMap((parentId) =>
    GRAPHS[parentId].nodes
      .filter((node) => node.childGraphId === graphId)
      .map((parentNode) => ({ parent: GRAPHS[parentId], parentNode })),
  );
  if (owners.length === 0) return null;

  const parentNode = owners.length === 1 ? owners[0]?.parentNode : undefined;
  const parent = owners.length === 1 ? owners[0]?.parent : undefined;
  const entryNode = child.entryNodeId ? findNode(child, child.entryNodeId) : undefined;
  if (!parent || !parentNode || !entryNode) {
    console.error(`子图入口关系无效：${graphId}`, {
      owners: owners.length,
      entryNodeId: child.entryNodeId ?? null,
    });
    return null;
  }

  return { parent, parentNode, child, entryNode };
}

function commonEntryDisplayName(graph: DemoGraph, node: DemoNode): string {
  const incoming = graphEntryRelation(graph.id);
  if (incoming?.entryNode.id === node.id) return `${incoming.parentNode.name} · 共通入口`;
  const outgoing = node.childGraphId ? graphEntryRelation(node.childGraphId) : null;
  if (outgoing?.parent.id === graph.id && outgoing.parentNode.id === node.id) {
    return `${outgoing.parentNode.name} · 共通入口`;
  }
  return node.name;
}

function getNodeState(nodeId: string, graphId: GraphId = session.currentGraphId): NodeState {
  return session.nodeStates[graphId][nodeId] ?? 'hidden';
}

function isVisible(nodeId: string): boolean {
  return getNodeState(nodeId) !== 'hidden';
}

function edgeKey(edge: DemoEdge): string {
  return `${edge.kind ?? 'route'}:${edge.a}-${edge.b}`;
}

function canRevealFrom(edge: DemoEdge, nodeId: string): string | null {
  if (edge.kind === 'virtual') return null;
  if (edge.a === nodeId) return edge.b;
  if (edge.kind !== 'directed' && edge.b === nodeId) return edge.a;
  return null;
}

/** 只把直接的 Hidden 邻居改为 Frontier；不降级、不递归。 */
function revealNeighbors(
  graph: DemoGraph,
  states: Record<string, NodeState>,
  nodeId: string,
): string[] {
  const revealed: string[] = [];
  for (const edge of graph.edges) {
    const otherId = canRevealFrom(edge, nodeId);
    if (!otherId) continue;
    if (states[otherId] === 'hidden') {
      states[otherId] = 'frontier';
      revealed.push(otherId);
    }
  }
  return revealed;
}

function createSessionState(): SessionState {
  const nodeStates = {} as Record<GraphId, Record<string, NodeState>>;

  for (const graphId of GRAPH_IDS) {
    const graph = GRAPHS[graphId];
    const states: Record<string, NodeState> = {};
    for (const node of graph.nodes) {
      states[node.id] = node.initialState;
    }
    for (const node of graph.nodes) {
      if (node.initialState === 'owned') revealNeighbors(graph, states, node.id);
    }
    nodeStates[graphId] = states;
  }

  return {
    currentGraphId: 'main',
    nodeStates,
    selectedNodeIds: { main: 'A', branch: null },
    nodeOffsets: { main: {}, branch: {} },
    cameraOffset: { x: 0, y: 0 },
  };
}

let session: SessionState = createSessionState();

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const BACK_TRANSITION_MS = 220;
let transitionTimer: number | null = null;
let transitionLocked = false;

let layoutMode: LayoutMode =
  elements.canvasHost.clientWidth > 0 && elements.canvasHost.clientWidth < COMPACT_CANVAS_WIDTH
    ? 'compact'
    : 'wide';
let projectionScale = 1;
let activeNodeDrag: NodeDragState | null = null;
let activeCameraPan: CameraPanState | null = null;

let worldLayer: SVGGElement | null = null;
let edgeLayer: SVGGElement | null = null;
let projectionEdgeLayer: SVGGElement | null = null;
let planeLayer: SVGGElement | null = null;
let heightLayer: SVGGElement | null = null;
let nodeLayer: SVGGElement | null = null;

const nodeViews = new Map<string, NodeView>();
const edgeViews = new Map<string, SVGLineElement>();
const projectionEdgeViews = new Map<string, SVGLineElement>();
const heightViews = new Map<string, SVGGElement>();

const solvedLayouts = new Map<string, LayoutPreset>();
const solveStats = new Map<string, SolveStats>();

/** 取当前布局模式的解算结果；每个「图 + 模式」只解算一次。 */
function layoutFor(graph: DemoGraph): LayoutPreset {
  const key = `${graph.id}:${layoutMode}`;
  const cached = solvedLayouts.get(key);
  if (cached) return cached;

  const result = solveLayout(graph, graph.layouts[layoutMode]);
  applySavedNodeOffsets(graph, result.preset);
  solvedLayouts.set(key, result.preset);
  solveStats.set(key, result.stats);
  return result.preset;
}

function applySavedNodeOffsets(graph: DemoGraph, layout: LayoutPreset): void {
  const [, , viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);
  for (const [nodeId, offset] of Object.entries(session.nodeOffsets[graph.id])) {
    const coordinate = layout.coordinates[nodeId];
    if (!coordinate) continue;
    layout.coordinates[nodeId] = {
      x: coordinate.x + offset.x * viewWidth,
      y: coordinate.y + offset.y * viewHeight,
    };
  }
}

function currentSolveStats(): SolveStats | null {
  return solveStats.get(`${session.currentGraphId}:${layoutMode}`) ?? null;
}

const MAX_SOLVE_STEPS = 700;
const REST_SPEED = 0.25;
const REST_STEPS = 8;

/** 物理松弛：弹簧（向心）+ 间距斥力（离心）+ 夹角约束，速度衰减到相对静止即停。 */
function solveLayout(
  graph: DemoGraph,
  preset: LayoutPreset,
): { preset: LayoutPreset; stats: SolveStats } {
  const ids = graph.nodes.map((node) => node.id);
  const nodeById = new Map<string, DemoNode>(
    graph.nodes.map((node): [string, DemoNode] => [node.id, node]),
  );
  const positions = new Map<string, NodeCoordinate>();
  let centroidX = 0;
  let centroidY = 0;

  const [minX, minY, maxX, maxY] = preset.viewBox.split(' ').map(Number);
  const pad = preset.radius + 26;

  for (const id of ids) {
    const authored = preset.coordinates[id];
    const seed = authored ?? {
      x: minX + pad + (nodeById.get(id)?.seed?.nx ?? 0.5) * (maxX - minX - pad * 2),
      y: minY + pad + (nodeById.get(id)?.seed?.ny ?? 0.5) * (maxY - minY - pad * 2),
    };
    positions.set(id, { x: seed.x, y: seed.y });
    centroidX += seed.x;
    centroidY += seed.y;
  }
  centroidX /= ids.length;
  centroidY /= ids.length;

  const neighbors = new Map<string, string[]>();
  for (const id of ids) neighbors.set(id, []);
  for (const edge of graph.edges) {
    if (edge.kind === 'virtual') continue;
    neighbors.get(edge.a)?.push(edge.b);
    neighbors.get(edge.b)?.push(edge.a);
  }

  const positionOf = (id: string): NodeCoordinate => {
    const position = positions.get(id);
    if (!position) throw new Error(`未知节点：${id}`);
    return position;
  };

  let iterations = 0;
  let maxStep = 0;
  let calmSteps = 0;

  for (let step = 0; step < MAX_SOLVE_STEPS; step += 1) {
    iterations = step + 1;
    const forces = new Map<string, NodeCoordinate>();
    for (const id of ids) forces.set(id, { x: 0, y: 0 });

    const addForce = (id: string, x: number, y: number): void => {
      const force = forces.get(id);
      if (!force) return;
      force.x += x;
      force.y += y;
    };

    // 离心力：间距小于设计值时把两个节点推开
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = positionOf(ids[i]);
        const b = positionOf(ids[j]);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        if (distance >= preset.minNodeGap) continue;
        const push = ((preset.minNodeGap - distance) * 0.9) / 2;
        dx /= distance;
        dy /= distance;
        addForce(ids[i], -dx * push, -dy * push);
        addForce(ids[j], dx * push, dy * push);
      }
    }

    // 向心力：每条边向设计长度收放
    for (const edge of graph.edges) {
      if (edge.kind === 'virtual') continue;
      const a = positionOf(edge.a);
      const b = positionOf(edge.b);
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.001;
      dx /= distance;
      dy /= distance;
      const force = (distance - preset.idealEdgeLength) * 0.045;
      addForce(edge.a, dx * force, dy * force);
      addForce(edge.b, -dx * force, -dy * force);
    }

    // 角度约束：同一节点的两条边夹角过小时，把两个邻居向外推开
    for (const id of ids) {
      const around = neighbors.get(id) ?? [];
      for (let i = 0; i < around.length; i += 1) {
        for (let j = i + 1; j < around.length; j += 1) {
          const origin = positionOf(id);
          const u = positionOf(around[i]);
          const v = positionOf(around[j]);
          const ux = u.x - origin.x;
          const uy = u.y - origin.y;
          const vx = v.x - origin.x;
          const vy = v.y - origin.y;
          const lu = Math.hypot(ux, uy) || 1;
          const lv = Math.hypot(vx, vy) || 1;
          const cosine = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lu * lv)));
          const angle = (Math.acos(cosine) * 180) / Math.PI;
          if (angle >= preset.minAngleDeg) continue;

          let sx = v.x - u.x;
          let sy = v.y - u.y;
          const separation = Math.hypot(sx, sy) || 1;
          sx /= separation;
          sy /= separation;
          const push = ((preset.minAngleDeg - angle) / preset.minAngleDeg) * 0.8;
          addForce(around[i], -sx * push, -sy * push);
          addForce(around[j], sx * push, sy * push);
        }
      }
    }

    // 轻微回中，避免整图漂移
    for (const id of ids) {
      const position = positionOf(id);
      addForce(id, (centroidX - position.x) * 0.002, (centroidY - position.y) * 0.002);
    }

    // 阻尼松弛 + 边界：位移就是本步的“速度”，足够小即视为相对静止
    maxStep = 0;
    for (const id of ids) {
      const position = positionOf(id);
      const force = forces.get(id);
      if (!force) continue;

      let dx = force.x * 0.9;
      let dy = force.y * 0.9;
      const stepLength = Math.hypot(dx, dy);
      if (stepLength > 8) {
        dx = (dx / stepLength) * 8;
        dy = (dy / stepLength) * 8;
      }

      const nextX = Math.min(maxX - pad, Math.max(minX + pad, position.x + dx));
      const nextY = Math.min(maxY - pad, Math.max(minY + pad, position.y + dy));
      maxStep = Math.max(maxStep, Math.hypot(nextX - position.x, nextY - position.y));
      position.x = nextX;
      position.y = nextY;
    }

    if (maxStep < REST_SPEED) {
      calmSteps += 1;
      if (calmSteps >= REST_STEPS) break;
    } else {
      calmSteps = 0;
    }
  }
  // 投影修正：把间距与夹角从“软约束”收紧为硬约束，仍以位移足够小作为静止条件
  const rotatePoint = (point: NodeCoordinate, origin: NodeCoordinate, angle: number): void => {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    point.x = origin.x + dx * cos - dy * sin;
    point.y = origin.y + dx * sin + dy * cos;
  };

  const clampToBounds = (position: NodeCoordinate): void => {
    position.x = Math.min(maxX - pad, Math.max(minX + pad, position.x));
    position.y = Math.min(maxY - pad, Math.max(minY + pad, position.y));
  };

  let passes = 0;
  for (let pass = 0; pass < 60; pass += 1) {
    passes = pass + 1;
    let correction = 0;

    for (const id of ids) {
      const around = neighbors.get(id) ?? [];
      for (let i = 0; i < around.length; i += 1) {
        for (let j = i + 1; j < around.length; j += 1) {
          const origin = positionOf(id);
          const u = positionOf(around[i]);
          const v = positionOf(around[j]);
          const ux = u.x - origin.x;
          const uy = u.y - origin.y;
          const vx = v.x - origin.x;
          const vy = v.y - origin.y;
          const lu = Math.hypot(ux, uy) || 1;
          const lv = Math.hypot(vx, vy) || 1;
          const cosine = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lu * lv)));
          const deficit = preset.minAngleDeg - (Math.acos(cosine) * 180) / Math.PI;
          if (deficit <= 0) continue;

          const radians = Math.min(((deficit * Math.PI) / 180) / 2, 0.04);
          const sign = ux * vy - uy * vx >= 0 ? 1 : -1;
          rotatePoint(u, origin, -sign * radians);
          rotatePoint(v, origin, sign * radians);
          correction = Math.max(correction, radians * Math.max(lu, lv));
        }
      }
    }

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = positionOf(ids[i]);
        const b = positionOf(ids[j]);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        if (distance >= preset.minNodeGap) continue;
        const shift = (preset.minNodeGap - distance) / 2;
        dx /= distance;
        dy /= distance;
        a.x -= dx * shift;
        a.y -= dy * shift;
        b.x += dx * shift;
        b.y += dy * shift;
        correction = Math.max(correction, shift);
      }
    }

    for (const id of ids) clampToBounds(positionOf(id));
    if (correction < 0.05) break;
  }

  let minGap = Number.POSITIVE_INFINITY;
  let overlaps = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = positionOf(ids[i]);
      const b = positionOf(ids[j]);
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      minGap = Math.min(minGap, distance);
      if (distance < preset.radius * 2 + 6) overlaps += 1;
    }
  }

  let minAngle = 180;
  for (const id of ids) {
    const around = neighbors.get(id) ?? [];
    for (let i = 0; i < around.length; i += 1) {
      for (let j = i + 1; j < around.length; j += 1) {
        const origin = positionOf(id);
        const u = positionOf(around[i]);
        const v = positionOf(around[j]);
        const ux = u.x - origin.x;
        const uy = u.y - origin.y;
        const vx = v.x - origin.x;
        const vy = v.y - origin.y;
        const cosine =
          (ux * vx + uy * vy) / ((Math.hypot(ux, uy) || 1) * (Math.hypot(vx, vy) || 1));
        const angle = (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
        minAngle = Math.min(minAngle, angle);
      }
    }
  }

  const coordinates: Record<string, NodeCoordinate> = {};
  for (const id of ids) {
    const position = positionOf(id);
    coordinates[id] = {
      x: Math.round(position.x * 10) / 10,
      y: Math.round(position.y * 10) / 10,
    };
  }

  return {
    preset: { ...preset, coordinates },
    stats: {
      iterations,
      passes,
      maxStep: Math.round(maxStep * 1000) / 1000,
      minGap: Math.round(minGap * 10) / 10,
      minAngle: Math.round(minAngle * 10) / 10,
      overlaps,
    },
  };
}

function coordinateFor(layout: LayoutPreset, nodeId: string): NodeCoordinate {
  const coordinate = layout.coordinates[nodeId];
  if (!coordinate) throw new Error(`缺少节点坐标：${nodeId}`);
  return coordinate;
}

function projectionMetrics(layout: LayoutPreset): ProjectionMetrics {
  const [viewX, viewY, viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);
  const axisScale = Math.min(viewWidth * 0.28, viewHeight * 0.42);

  return {
    centerX: viewX + viewWidth / 2,
    centerY: viewY + viewHeight / 2,
    scaleX: axisScale,
    scaleY: axisScale * 0.54,
    heightScale: layoutMode === 'compact' ? 28 : 32,
    worldUnits: layoutMode === 'compact' ? 220 : 260,
  };
}

/** 现有 x/y 布局结果与 elevation 共用此唯一轴测投影入口。 */
function projectCoordinate(
  layout: LayoutPreset,
  coordinate: NodeCoordinate,
  elevation = 0,
): NodeCoordinate {
  const metrics = projectionMetrics(layout);
  const xyScale = projectionScale;
  const x = ((coordinate.x - metrics.centerX) / metrics.worldUnits) * xyScale;
  const y = ((coordinate.y - metrics.centerY) / metrics.worldUnits) * xyScale;
  return {
    x: metrics.centerX + metrics.scaleX * (x - y),
    y: metrics.centerY + metrics.scaleY * (x + y) - metrics.heightScale * elevation * heightProjectionScale(),
  };
}

/** z 以 100% 为精确锚点，只响应平面缩放变化的四分之一。 */
function heightProjectionScale(): number {
  return 1 + (projectionScale - 1) * 0.25;
}

/** Keep nodes legible at 100%, then shrink their visual mass nonlinearly below it. */
function nodeDetailScale(): number {
  return projectionScale >= 1 ? 1 : Math.max(0.3, Math.pow(projectionScale, 0.7));
}

function usesCompactNodeSymbols(): boolean {
  return projectionScale <= NODE_DETAIL_LOD_THRESHOLD;
}

function projectNode(layout: LayoutPreset, node: DemoNode, elevation = node.elevation ?? 0): NodeCoordinate {
  return projectCoordinate(layout, coordinateFor(layout, node.id), elevation);
}

function projectReferencePoint(layout: LayoutPreset, x: number, y: number): NodeCoordinate {
  const metrics = projectionMetrics(layout);
  return {
    x: metrics.centerX + metrics.scaleX * (x - y),
    y: metrics.centerY + metrics.scaleY * (x + y),
  };
}

/** 母图星座保留原 x/y 构图，只把节点高度转成 y 轴偏移，不旋转平面。 */
function projectConstellationNode(layout: LayoutPreset, node: DemoNode): NodeCoordinate {
  const coordinate = coordinateFor(layout, node.id);
  return {
    x: coordinate.x,
    y: coordinate.y - projectionMetrics(layout).heightScale * (node.elevation ?? 0),
  };
}

/** 母图星座固定在子图平面坐标中的位置，不绑定入口节点或容器边缘。 */
function constellationWorldAnchor(layout: LayoutPreset): NodeCoordinate {
  const metrics = projectionMetrics(layout);
  const [, , viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);
  return {
    x: metrics.centerX + viewWidth * 0.22,
    y: metrics.centerY - viewHeight * 0.14,
  };
}

function selectedNode(graph: DemoGraph): DemoNode | undefined {
  const selectedId = session.selectedNodeIds[graph.id];
  return selectedId ? findNode(graph, selectedId) : undefined;
}

function defaultSelectionFor(graph: DemoGraph): string | null {
  const owned = graph.nodes.find((node) => node.initialState === 'owned');
  return owned?.id ?? graph.nodes[0]?.id ?? null;
}

/* ---------- 渲染 ---------- */

function renderGraph(): void {
  cancelActiveDrag();
  const graph = currentGraph();
  const layout = layoutFor(graph);

  elements.svg.setAttribute('viewBox', layout.viewBox);
  elements.svg.setAttribute('aria-label', `${graph.name} 节点图`);
  elements.svg.classList.toggle('graph--overview', usesCompactNodeSymbols());
  elements.svg.replaceChildren();

  const [viewX, viewY, viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);
  const panSurface = createSvgElement('rect', {
    class: 'graph__pan-surface',
    x: String(viewX),
    y: String(viewY),
    width: String(viewWidth),
    height: String(viewHeight),
    fill: 'transparent',
    'pointer-events': 'all',
    'aria-hidden': 'true',
  });
  worldLayer = createSvgElement('g', { class: 'graph__world' });
  planeLayer = createReferencePlane(layout);
  projectionEdgeLayer = createSvgElement('g', { class: 'graph__projection-edges', 'aria-hidden': 'true', 'pointer-events': 'none' });
  edgeLayer = createSvgElement('g', { class: 'graph__edges' });
  heightLayer = createSvgElement('g', { class: 'graph__heights' });
  nodeLayer = createSvgElement('g', { class: 'graph__nodes' });
  worldLayer.append(planeLayer, projectionEdgeLayer, edgeLayer, heightLayer, nodeLayer);
  elements.svg.append(createArrowMarker('edge-arrow-head'), panSurface, worldLayer);
  applyCameraOffset();
  applyPlaneScale(layout);

  nodeViews.clear();
  edgeViews.clear();
  projectionEdgeViews.clear();
  heightViews.clear();

  for (const edge of graph.edges) {
    if (isVisible(edge.a) && isVisible(edge.b)) ensureEdgeView(layout, edge);
  }
  for (const node of graph.nodes) {
    ensureHeightView(layout, node);
    ensureNodeView(layout, node);
  }
  for (const node of graph.nodes) updateNodeView(node);
  syncEdges();
}

function createReferencePlane(layout: LayoutPreset): SVGGElement {
  const group = createSvgElement('g', {
    class: 'reference-plane',
    'aria-hidden': 'true',
    'pointer-events': 'none',
  });
  const bounds = visiblePlaneBounds(layout);
  const step = planeGridStep(layout);
  const xIndices = gridIndices(bounds.minX, bounds.maxX, step);
  const yIndices = gridIndices(bounds.minY, bounds.maxY, step);
  const grid = createSvgElement('g', { class: 'reference-plane__grid' });
  for (const index of xIndices) {
    const offset = index * step;
    const xStart = projectReferencePoint(layout, offset, bounds.minY - step);
    const xEnd = projectReferencePoint(layout, offset, bounds.maxY + step);
    grid.append(
      createSvgElement('line', {
        class: referenceGridLineClass(index),
        x1: String(xStart.x), y1: String(xStart.y), x2: String(xEnd.x), y2: String(xEnd.y),
      }),
    );
  }
  for (const index of yIndices) {
    const offset = index * step;
    const yStart = projectReferencePoint(layout, bounds.minX - step, offset);
    const yEnd = projectReferencePoint(layout, bounds.maxX + step, offset);
    grid.append(createSvgElement('line', {
      class: referenceGridLineClass(index),
      x1: String(yStart.x), y1: String(yStart.y), x2: String(yEnd.x), y2: String(yEnd.y),
    }));
  }
  group.append(grid);

  const ticks = createSvgElement('g', { class: 'reference-plane__ticks' });
  for (const index of xIndices) {
    if (index === 0) continue;
    const point = projectReferencePoint(layout, index * step, 0);
    ticks.append(createSvgElement('line', {
      class: `reference-plane__tick${index % 5 === 0 ? ' is-major' : ''}`,
      x1: String(point.x), y1: String(point.y - 3), x2: String(point.x), y2: String(point.y + 3),
    }));
  }
  const origin = projectReferencePoint(layout, 0, 0);
  ticks.append(createSvgElement('circle', {
    class: 'reference-plane__origin',
    cx: String(origin.x), cy: String(origin.y), r: '3',
  }));
  group.append(ticks);
  return group;
}

function referenceGridLineClass(index: number): string {
  return `reference-plane__line${index === 0 ? ' is-axis' : ''}${index !== 0 && index % 5 === 0 ? ' is-major' : ''}`;
}

function visiblePlaneBounds(layout: LayoutPreset): { minX: number; maxX: number; minY: number; maxY: number } {
  const metrics = projectionMetrics(layout);
  const [viewX, viewY, viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);
  const corners = [
    { x: viewX, y: viewY },
    { x: viewX + viewWidth, y: viewY },
    { x: viewX, y: viewY + viewHeight },
    { x: viewX + viewWidth, y: viewY + viewHeight },
  ].map((point) => {
    const baseX = metrics.centerX + (point.x - session.cameraOffset.x - metrics.centerX) / projectionScale;
    const baseY = metrics.centerY + (point.y - session.cameraOffset.y - metrics.centerY) / projectionScale;
    const difference = (baseX - metrics.centerX) / metrics.scaleX;
    const sum = (baseY - metrics.centerY) / metrics.scaleY;
    return { x: (difference + sum) / 2, y: (sum - difference) / 2 };
  });
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function planeGridStep(layout: LayoutPreset): number {
  const metrics = projectionMetrics(layout);
  const screenUnitsPerPlaneUnit = Math.hypot(metrics.scaleX, metrics.scaleY) * projectionScale;
  const desiredStep = 64 / screenUnitsPerPlaneUnit;
  const magnitude = Math.pow(10, Math.floor(Math.log10(desiredStep)));
  const normalized = desiredStep / magnitude;
  const niceValue = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceValue * magnitude;
}

function gridIndices(min: number, max: number, step: number): number[] {
  const first = Math.floor(min / step) - 1;
  const last = Math.ceil(max / step) + 1;
  const indices: number[] = [];
  for (let index = first; index <= last; index += 1) indices.push(index);
  return indices;
}

function refreshReferencePlane(layout: LayoutPreset): void {
  if (!worldLayer || !planeLayer) return;
  const replacement = createReferencePlane(layout);
  worldLayer.replaceChild(replacement, planeLayer);
  planeLayer = replacement;
  applyPlaneScale(layout);
}

/**
 * 重建只读母图拓扑概览。
 * 只画入口沿可见连接扩展后的局部节点与局部真实连接，不画平面、网格或高度辅助物；
 * 不建监听、不设 tabindex，也不写入 nodeViews；
 * 子图内的探索 / 取得不会触发它，只有切图与重置才重建一次。
 */
function renderBackdrop(): void {
  const relation = graphEntryRelation(session.currentGraphId);
  elements.backdrop.replaceChildren();

  if (!relation) {
    elements.backdrop.style.left = '';
    elements.backdrop.style.top = '';
    elements.backdropCaption.style.left = '';
    elements.backdropCaption.style.top = '';
    elements.backdropCaption.hidden = true;
    elements.backdropCaption.textContent = '';
    elements.backdropNodeLimitControl.hidden = true;
    updateBackdropVisibility();
    return;
  }

  const { parent, parentNode } = relation;
  const layout = layoutFor(parent);
  const states = session.nodeStates[parent.id];
  const nodeLimit = Math.max(1, Math.floor(Number(elements.backdropNodeLimit.value) || 1));
  const adjacency = new Map<string, string[]>();
  for (const edge of parent.edges) {
    if (edge.kind === 'virtual') continue;
    const fromNeighbors = adjacency.get(edge.a) ?? [];
    fromNeighbors.push(edge.b);
    adjacency.set(edge.a, fromNeighbors);
    // 母图展示弱连通局部：单向边保留箭头表现，但从任一端都可纳入概览范围。
    const toNeighbors = adjacency.get(edge.b) ?? [];
    toNeighbors.push(edge.a);
    adjacency.set(edge.b, toNeighbors);
  }
  const includedIds = new Set<string>();
  const visitedIds = new Set<string>([parentNode.id]);
  const pendingIds = [parentNode.id];
  let pendingIndex = 0;
  while (pendingIndex < pendingIds.length && includedIds.size < nodeLimit) {
    const nodeId = pendingIds[pendingIndex];
    pendingIndex += 1;
    if (!nodeId || states[nodeId] === 'hidden') continue;
    includedIds.add(nodeId);
    for (const neighborId of adjacency.get(nodeId) ?? []) {
      if (visitedIds.has(neighborId) || states[neighborId] === 'hidden') continue;
      visitedIds.add(neighborId);
      pendingIds.push(neighborId);
    }
  }
  const displayedNodes = parent.nodes.filter((node) => includedIds.has(node.id) && states[node.id] !== 'hidden');
  const entryPoint = projectConstellationNode(layout, parentNode);
  const anchor = constellationWorldAnchor(layout);
  const constellationPoint = (node: DemoNode): NodeCoordinate => {
    const point = projectConstellationNode(layout, node);
    return {
      x: anchor.x + point.x - entryPoint.x,
      y: anchor.y + point.y - entryPoint.y,
    };
  };

  elements.backdrop.setAttribute('viewBox', layout.viewBox);
  elements.backdrop.append(createArrowMarker('ghost-edge-arrow-head'));
  elements.backdropNodeLimitControl.hidden = false;
  elements.backdropCaption.hidden = false;
  elements.backdropCaption.textContent = `母图概览 · ${parent.name} · ${displayedNodes.length} / ${nodeLimit} 节点`;

  const edgeGroup = createSvgElement('g', { class: 'ghost-edges' });
  const nodeGroup = createSvgElement('g', { class: 'ghost-nodes' });

  for (const edge of parent.edges) {
    if (!includedIds.has(edge.a) || !includedIds.has(edge.b)) continue;
    if (states[edge.a] === 'hidden' || states[edge.b] === 'hidden') continue;
    const fromNode = findNode(parent, edge.a);
    const toNode = findNode(parent, edge.b);
    if (!fromNode || !toNode) continue;
    const from = constellationPoint(fromNode);
    const to = constellationPoint(toNode);
    edgeGroup.append(
      createSvgElement('line', {
        class: `ghost-edge${edge.kind === 'directed' ? ' ghost-edge--directed' : ''}${edge.kind === 'virtual' ? ' ghost-edge--virtual' : ''}`,
        x1: String(from.x),
        y1: String(from.y),
        x2: String(to.x),
        y2: String(to.y),
      }),
    );
  }

  for (const node of displayedNodes) {
    const nodeState = states[node.id];
    if (nodeState === 'hidden') continue;

    const coordinate = constellationPoint(node);
    const radius = node.id === parentNode.id ? 10 : 6;
    const ghostNode = createSvgElement('g', {
      class: `ghost-node ghost-node--${nodeState}${node.id === parentNode.id ? ' is-entry' : ''}`,
      'data-ghost-id': node.id,
      transform: `translate(${coordinate.x} ${coordinate.y})`,
    });
    if (node.id === parentNode.id) {
      ghostNode.append(createSvgElement('circle', {
        class: 'ghost-anchor',
        r: String(radius + 6),
      }));
    }
    ghostNode.append(createSvgElement('circle', {
      class: 'ghost-node__body',
      r: String(radius),
    }));
    nodeGroup.append(ghostNode);
  }

  const worldGroup = createSvgElement('g', { class: 'ghost-world' });
  worldGroup.append(edgeGroup, nodeGroup);
  elements.backdrop.append(worldGroup);
  updateBackdropVisibility();
  positionBackdrop();
}

/** 母图星座沿用子图的比例尺和相机变换，不按当前内容范围重新拟合。 */
function positionBackdrop(): void {
  const relation = graphEntryRelation(session.currentGraphId);
  if (!relation) return;
  const layout = layoutFor(relation.child);
  const metrics = projectionMetrics(layout);
  const anchor = constellationWorldAnchor(layout);
  const matrix = elements.svg.getScreenCTM();
  if (!matrix) return;

  const worldGroup = elements.backdrop.querySelector<SVGGElement>('.ghost-world');
  if (!worldGroup) return;
  worldGroup.setAttribute(
    'transform',
    `translate(${session.cameraOffset.x} ${session.cameraOffset.y}) translate(${metrics.centerX} ${metrics.centerY}) scale(${projectionScale}) translate(${-metrics.centerX} ${-metrics.centerY})`,
  );

  const hostRect = elements.canvasHost.getBoundingClientRect();
  const hostPoint = new DOMPoint(
    metrics.centerX + (anchor.x - metrics.centerX) * projectionScale + session.cameraOffset.x,
    metrics.centerY + (anchor.y - metrics.centerY) * projectionScale + session.cameraOffset.y,
  ).matrixTransform(matrix);
  elements.backdrop.style.left = '0px';
  elements.backdrop.style.top = '0px';
  elements.backdropCaption.style.left = `${hostPoint.x - hostRect.left}px`;
  elements.backdropCaption.style.top = `${hostPoint.y - hostRect.top - 20}px`;
}

function updateBackdropVisibility(): void {
  const hasParent = parentGraphId(session.currentGraphId) !== null;
  elements.canvasHost.dataset.hasParent = hasParent ? 'true' : 'false';
  elements.backdropNodeLimitControl.hidden = !hasParent;
}

let connectorFrame = 0;

function renderConnectorSoon(): void {
  if (connectorFrame) cancelAnimationFrame(connectorFrame);
  connectorFrame = requestAnimationFrame(() => {
    connectorFrame = 0;
    renderConnector();
  });
}

/** 母图共通入口到子图入口的曲线：统一换算到画布宿主坐标，不进入图拓扑。 */
function renderConnector(): void {
  elements.connector.replaceChildren();
  const relation = graphEntryRelation(session.currentGraphId);
  if (!relation || transitionLocked) return;
  if (elements.canvasHost.dataset.transition) return;

  const hostRect = elements.canvasHost.getBoundingClientRect();
  if (hostRect.width < 10) return;

  const ghost = elements.backdrop.querySelector(`[data-ghost-id="${relation.parentNode.id}"]`);
  const target = nodeViews.get(relation.entryNode.id)?.group;
  if (!(ghost instanceof SVGGElement) || !(target instanceof SVGGElement)) return;

  const from = svgElementPointInHost(ghost, hostRect);
  const to = svgElementPointInHost(target, hostRect);
  if (!from || !to) return;

  elements.connector.setAttribute('viewBox', `0 0 ${hostRect.width} ${hostRect.height}`);
  elements.connector.append(
    createSvgElement('path', {
      class: 'connector-path',
      d: connectorPath(from.x, from.y, to.x, to.y),
    }),
  );
}

function svgElementPointInHost(element: SVGGraphicsElement, hostRect: DOMRect): NodeCoordinate | null {
  const matrix = element.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(0, 0).matrixTransform(matrix);
  return { x: point.x - hostRect.left, y: point.y - hostRect.top };
}

function connectorPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const bend = 0.16;
  const midX = (x1 + x2) / 2 - (dy / length) * length * bend;
  const midY = (y1 + y2) / 2 + (dx / length) * length * bend;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function ensureHeightView(layout: LayoutPreset, node: DemoNode): void {
  if (!heightLayer || !isVisible(node.id) || heightViews.has(node.id)) return;
  const elevation = node.elevation ?? 0;

  const position = projectNode(layout, node);
  const metrics = projectionMetrics(layout);
  const group = createSvgElement('g', {
    class: `node-height ${elevation > 0 ? 'node-height--above' : elevation < 0 ? 'node-height--below' : 'node-height--flat'}`,
    transform: `translate(${position.x} ${position.y}) scale(${nodeDetailScale()})`,
    'data-height-node-id': node.id,
    'aria-hidden': 'true',
    'pointer-events': 'none',
  });
  const planeOffset = metrics.heightScale * elevation * heightProjectionScale();
  if (elevation !== 0) {
    group.append(createSvgElement('line', {
      class: 'node-height__riser',
      x1: '0', y1: '0', x2: '0', y2: String(planeOffset / nodeDetailScale()),
    }));
  }
  group.append(createSvgElement('ellipse', {
    class: 'node-height__footprint',
    cx: '0', cy: String(planeOffset / nodeDetailScale()), rx: String(layout.radius * 0.6), ry: String(layout.radius * 0.25),
  }));
  heightLayer.append(group);
  heightViews.set(node.id, group);
}

function graphPointFromClient(clientX: number, clientY: number): NodeCoordinate | null {
  const matrix = elements.svg.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

function pointerInGraph(event: PointerEvent): NodeCoordinate | null {
  return graphPointFromClient(event.clientX, event.clientY);
}

function applyCameraOffset(): void {
  if (!worldLayer) return;
  const { x, y } = session.cameraOffset;
  worldLayer.setAttribute('transform', `translate(${x} ${y})`);
}

function applyPlaneScale(layout: LayoutPreset): void {
  if (!planeLayer) return;
  const metrics = projectionMetrics(layout);
  planeLayer.setAttribute(
    'transform',
    `translate(${metrics.centerX} ${metrics.centerY}) scale(${projectionScale}) translate(${-metrics.centerX} ${-metrics.centerY})`,
  );
}

function planeDeltaFromScreen(layout: LayoutPreset, delta: NodeCoordinate): NodeCoordinate {
  const metrics = projectionMetrics(layout);
  const projectedDifference = (delta.x * metrics.worldUnits) / (metrics.scaleX * projectionScale);
  const projectedSum = (delta.y * metrics.worldUnits) / (metrics.scaleY * projectionScale);
  return {
    x: (projectedDifference + projectedSum) / 2,
    y: (projectedSum - projectedDifference) / 2,
  };
}

function updateNodeGeometry(layout: LayoutPreset, node: DemoNode): void {
  const position = projectNode(layout, node);
  const detailScale = nodeDetailScale();
  const nodeView = nodeViews.get(node.id);
  if (nodeView) nodeView.group.setAttribute('transform', `translate(${position.x} ${position.y}) scale(${detailScale})`);

  const heightView = heightViews.get(node.id);
  if (!heightView) return;
  const elevation = node.elevation ?? 0;
  const planeOffset = projectionMetrics(layout).heightScale * elevation * heightProjectionScale();
  heightView.setAttribute('transform', `translate(${position.x} ${position.y}) scale(${detailScale})`);
  heightView.querySelector<SVGLineElement>('.node-height__riser')?.setAttribute('y2', String(planeOffset / detailScale));
  heightView.querySelector<SVGEllipseElement>('.node-height__footprint')?.setAttribute('cy', String(planeOffset / detailScale));
}

function beginNodeDrag(node: DemoNode, group: SVGGElement, event: PointerEvent): void {
  if (event.button !== 0 || transitionLocked || activeNodeDrag || activeCameraPan) return;
  const pointer = pointerInGraph(event);
  if (!pointer) return;

  const graph = currentGraph();
  const layout = layoutFor(graph);
  const [, , viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);
  const coordinate = coordinateFor(layout, node.id);
  const offset = session.nodeOffsets[graph.id][node.id] ?? { x: 0, y: 0 };
  activeNodeDrag = {
    graphId: graph.id,
    nodeId: node.id,
    pointerId: event.pointerId,
    startPointer: pointer,
    startCoordinate: { ...coordinate },
    startOffset: { ...offset },
    moved: false,
  };
  group.classList.add('node--dragging');
  group.setPointerCapture(event.pointerId);
}

function moveDraggedNode(group: SVGGElement, event: PointerEvent): void {
  const drag = activeNodeDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const pointer = pointerInGraph(event);
  if (!pointer) return;

  const pointerDelta = { x: pointer.x - drag.startPointer.x, y: pointer.y - drag.startPointer.y };
  if (Math.hypot(pointerDelta.x, pointerDelta.y) > 3) drag.moved = true;
  if (!drag.moved) return;

  const graph = currentGraph();
  if (graph.id !== drag.graphId) return;
  const layout = layoutFor(graph);
  const [, , viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);
  const planeDelta = planeDeltaFromScreen(layout, pointerDelta);
  const offset = {
    x: drag.startOffset.x + planeDelta.x / viewWidth,
    y: drag.startOffset.y + planeDelta.y / viewHeight,
  };
  session.nodeOffsets[graph.id][drag.nodeId] = offset;
  layout.coordinates[drag.nodeId] = {
    x: drag.startCoordinate.x + planeDelta.x,
    y: drag.startCoordinate.y + planeDelta.y,
  };

  const node = findNode(graph, drag.nodeId);
  if (!node) return;
  updateNodeGeometry(layout, node);
  syncEdges();
  positionBackdrop();
  renderConnectorSoon();
}

function finishNodeDrag(group: SVGGElement, event: PointerEvent): void {
  const drag = activeNodeDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  group.classList.remove('node--dragging');
  activeNodeDrag = null;
}

function beginCameraPan(event: PointerEvent): void {
  if (event.button !== 0 || transitionLocked || activeNodeDrag || activeCameraPan) return;
  const target = event.target;
  if (target instanceof Element && target.closest('.node')) return;
  const pointer = pointerInGraph(event);
  if (!pointer) return;

  activeCameraPan = {
    pointerId: event.pointerId,
    startPointer: pointer,
    startOffset: { ...session.cameraOffset },
    moved: false,
  };
  elements.svg.classList.add('graph--panning');
  elements.svg.setPointerCapture(event.pointerId);
}

function moveCameraPan(event: PointerEvent): void {
  const pan = activeCameraPan;
  if (!pan || pan.pointerId !== event.pointerId) return;
  const pointer = pointerInGraph(event);
  if (!pointer) return;

  const delta = { x: pointer.x - pan.startPointer.x, y: pointer.y - pan.startPointer.y };
  if (Math.hypot(delta.x, delta.y) > 3) pan.moved = true;
  if (!pan.moved) return;

  session.cameraOffset = {
    x: pan.startOffset.x + delta.x,
    y: pan.startOffset.y + delta.y,
  };
  applyCameraOffset();
  refreshReferencePlane(layoutFor(currentGraph()));
  positionBackdrop();
  renderConnectorSoon();
}

function finishCameraPan(event: PointerEvent): void {
  if (!activeCameraPan || activeCameraPan.pointerId !== event.pointerId) return;
  activeCameraPan = null;
  elements.svg.classList.remove('graph--panning');
}

function cancelActiveDrag(): void {
  activeNodeDrag?.graphId === session.currentGraphId &&
    nodeViews.get(activeNodeDrag.nodeId)?.group.classList.remove('node--dragging');
  activeNodeDrag = null;
  activeCameraPan = null;
  elements.svg.classList.remove('graph--panning');
}

function ensureNodeView(layout: LayoutPreset, node: DemoNode): void {
  if (!nodeLayer || !isVisible(node.id) || nodeViews.has(node.id)) return;

  const elevation = node.elevation ?? 0;
  const coordinate = projectNode(layout, node);
  const heightClass = elevation > 0 ? ' node--above' : elevation < 0 ? ' node--below' : '';
  const radius = layout.radius * 0.75;
  const badgeOffset = radius * 0.72;

  const group = createSvgElement('g', {
    class: `node${heightClass}`,
    'data-node-id': node.id,
    transform: `translate(${coordinate.x} ${coordinate.y}) scale(${nodeDetailScale()})`,
    tabindex: '0',
    role: 'button',
  });

  const hit = createSvgElement('circle', {
    class: 'node__hit',
    r: String(layout.hitRadius),
  });
  const ring = createSvgElement('circle', {
    class: 'node__ring',
    r: String(radius + 9),
  });
  const body = createSvgElement('circle', {
    class: 'node__body',
    r: String(radius),
  });
  const badge = createSvgElement('circle', {
    class: 'node__badge',
    cx: String(badgeOffset),
    cy: String(-badgeOffset),
    r: '10',
  });
  const check = createSvgElement('path', {
    class: 'node__check',
    d: 'M -3.6 0 L -1 2.8 L 3.8 -2.8',
    transform: `translate(${badgeOffset} ${-badgeOffset})`,
  });
  const icon = createSvgElement('g', { class: 'node__icon', 'aria-hidden': 'true' });
  icon.append(createSvgElement('path', { d: iconFor(node.id) }));
  const glyph = createSvgElement('text', {
    class: 'node__glyph',
    'text-anchor': 'middle',
    dy: '0.35em',
  });
  const elevated = elevation !== 0;
  const label = createSvgElement('text', {
    class: 'node__label',
    'text-anchor': elevated ? 'start' : 'middle',
    x: elevated ? String(radius + 10) : '0',
    y: elevated ? '4' : String(layout.labelOffset),
  });

  group.append(hit, ring, body, badge, check, icon, glyph, label);

  group.addEventListener('click', () => handleSelect(node.id));
  group.addEventListener('pointerdown', (event) => beginNodeDrag(node, group, event));
  group.addEventListener('pointermove', (event) => moveDraggedNode(group, event));
  group.addEventListener('pointerup', (event) => finishNodeDrag(group, event));
  group.addEventListener('pointercancel', (event) => finishNodeDrag(group, event));
  group.addEventListener('lostpointercapture', (event) => finishNodeDrag(group, event));
  group.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleSelect(node.id);
  });

  nodeLayer.append(group);
  nodeViews.set(node.id, { group, glyph, label });
}

function updateNodeView(node: DemoNode): void {
  const view = nodeViews.get(node.id);
  if (!view) return;

  const nodeState = getNodeState(node.id);
  const selected = session.selectedNodeIds[session.currentGraphId] === node.id;
  const simplified = usesCompactNodeSymbols();
  const elevation = node.elevation ?? 0;
  const radius = layoutFor(currentGraph()).radius * 0.75;

  view.group.classList.toggle('node--overview', simplified);
  view.group.classList.toggle('node--frontier', nodeState === 'frontier');
  view.group.classList.toggle('node--known', nodeState === 'known');
  view.group.classList.toggle('node--owned', nodeState === 'owned');
  view.group.classList.toggle('is-selected', selected);
  view.group.setAttribute('aria-pressed', selected ? 'true' : 'false');
  view.group.setAttribute(
    'aria-label',
    nodeState === 'frontier' ? '未知节点，待探索' : `${node.name}，${STATE_LABEL[nodeState]}`,
  );

  view.glyph.textContent = nodeState === 'frontier' ? '？' : node.id;
  view.label.textContent = simplified
    ? nodeState === 'frontier' ? '？' : node.id
    : nodeState === 'frontier' ? '未知节点' : commonEntryDisplayName(currentGraph(), node);
  view.label.setAttribute('text-anchor', simplified || elevation === 0 ? 'middle' : 'start');
  view.label.setAttribute('x', simplified || elevation === 0 ? '0' : String(radius + 10));
  view.label.setAttribute('y', simplified ? String(radius + 12) : elevation === 0 ? String(layoutFor(currentGraph()).labelOffset) : '4');
}

function ensureEdgeView(layout: LayoutPreset, edge: DemoEdge): void {
  if (!edgeLayer || edgeViews.has(edgeKey(edge))) return;

  const graph = currentGraph();
  const nodeA = findNode(graph, edge.a);
  const nodeB = findNode(graph, edge.b);
  if (!nodeA || !nodeB) return;
  const from = projectNode(layout, nodeA);
  const to = projectNode(layout, nodeB);
  const line = createSvgElement('line', {
    class: `edge${edge.kind === 'directed' ? ' edge--directed' : ''}${edge.kind === 'virtual' ? ' edge--virtual' : ''}`,
    x1: String(from.x),
    y1: String(from.y),
    x2: String(to.x),
    y2: String(to.y),
    'aria-hidden': 'true',
  });

  edgeLayer.append(line);
  edgeViews.set(edgeKey(edge), line);
}

function ensureProjectionEdgeView(layout: LayoutPreset, edge: DemoEdge): void {
  if (!projectionEdgeLayer || projectionEdgeViews.has(edgeKey(edge))) return;
  const graph = currentGraph();
  const nodeA = findNode(graph, edge.a);
  const nodeB = findNode(graph, edge.b);
  if (!nodeA || !nodeB) return;
  const from = projectNode(layout, nodeA, 0);
  const to = projectNode(layout, nodeB, 0);
  const line = createSvgElement('line', {
    class: 'projection-edge',
    x1: String(from.x),
    y1: String(from.y),
    x2: String(to.x),
    y2: String(to.y),
    'aria-hidden': 'true',
  });
  projectionEdgeLayer.append(line);
  projectionEdgeViews.set(edgeKey(edge), line);
}

function syncEdges(): void {
  const graph = currentGraph();
  const layout = layoutFor(graph);
  const selectedId = session.selectedNodeIds[session.currentGraphId];

  for (const edge of graph.edges) {
    const key = edgeKey(edge);
    const visible = isVisible(edge.a) && isVisible(edge.b);
    const existing = edgeViews.get(key);
    const existingProjection = projectionEdgeViews.get(key);

    if (visible && !existing) {
      ensureEdgeView(layout, edge);
    } else if (!visible && existing) {
      existing.remove();
      edgeViews.delete(key);
    }
    if (visible && edge.kind !== 'virtual' && !existingProjection) {
      ensureProjectionEdgeView(layout, edge);
    } else if ((!visible || edge.kind === 'virtual') && existingProjection) {
      existingProjection.remove();
      projectionEdgeViews.delete(key);
    }
  }

  for (const edge of graph.edges) {
    const line = edgeViews.get(edgeKey(edge));
    const projectionLine = projectionEdgeViews.get(edgeKey(edge));
    if (!line) continue;
    const nodeA = findNode(graph, edge.a);
    const nodeB = findNode(graph, edge.b);
    if (nodeA && nodeB) {
      const from = projectNode(layout, nodeA);
      const to = projectNode(layout, nodeB);
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
    }
    if (projectionLine && nodeA && nodeB) {
      const from = projectNode(layout, nodeA, 0);
      const to = projectNode(layout, nodeB, 0);
      projectionLine.setAttribute('x1', String(from.x));
      projectionLine.setAttribute('y1', String(from.y));
      projectionLine.setAttribute('x2', String(to.x));
      projectionLine.setAttribute('y2', String(to.y));
    }
    line.classList.toggle(
      'edge--open',
      getNodeState(edge.a) === 'owned' && getNodeState(edge.b) === 'owned',
    );
    const active =
      selectedId !== null && (selectedId === edge.a || selectedId === edge.b);
    line.classList.toggle('edge--active', active);
  }
}

/** 全量刷新当前图的节点视图（只改属性与文本，不重建 SVG）。 */
function refreshNodeViews(): void {
  for (const node of currentGraph().nodes) {
    ensureHeightView(layoutFor(currentGraph()), node);
    ensureNodeView(layoutFor(currentGraph()), node);
    updateNodeView(node);
  }
}

function renderHeader(): void {
  const graph = currentGraph();
  elements.graphName.textContent = graph.name;
  elements.breadcrumb.replaceChildren();

  if (session.currentGraphId === 'main') {
    const current = document.createElement('span');
    current.className = 'crumb crumb--current';
    current.setAttribute('aria-current', 'page');
    current.textContent = '母图';
    elements.breadcrumb.append(current);
  } else {
    const root = document.createElement('button');
    root.type = 'button';
    root.className = 'crumb';
    root.textContent = '母图';
    root.addEventListener('click', handleBack);

    const separator = document.createElement('span');
    separator.className = 'crumb__sep';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '/';

    const current = document.createElement('span');
    current.className = 'crumb crumb--current';
    current.setAttribute('aria-current', 'page');
    current.textContent = '偏移分支';

    elements.breadcrumb.append(root, separator, current);
  }

  const relation = graphEntryRelation(session.currentGraphId);
  elements.worldNote.hidden = !relation;
  elements.worldNote.textContent = relation
    ? `共通入口 · ${relation.parentNode.id}「${relation.parentNode.name}」 ↔ ${relation.entryNode.id}「${relation.entryNode.name}」`
    : '';
  elements.backButton.disabled = session.currentGraphId === 'main';
}

function setPanelIcon(node: DemoNode | null, state: NodeState): void {
  if (!node || state === 'frontier') {
    elements.nodeIcon.innerHTML = '<span class="panel__question">？</span>';
    return;
  }
  const path = iconFor(node.id);
  elements.nodeIcon.innerHTML = `<svg viewBox="-16 -16 32 32" aria-hidden="true"><path d="${path}"></path></svg>`;
}

function renderPanel(options: { focusActionId?: string } = {}): void {
  const graph = currentGraph();
  const node = selectedNode(graph);
  elements.nodeActions.replaceChildren();

  if (!node) {
    setPanelIcon(null, 'hidden');
    elements.nodeName.textContent = '未选择节点';
    elements.nodeState.textContent = '—';
    elements.nodeState.dataset.state = 'none';
    elements.nodeDescription.textContent = '点击画布中的节点查看详情。';
    return;
  }

  const nodeState = getNodeState(node.id);
  const known = nodeState === 'known' || nodeState === 'owned';
  setPanelIcon(node, nodeState);

  elements.nodeName.textContent = known ? commonEntryDisplayName(graph, node) : '未知节点';
  elements.nodeState.textContent = STATE_LABEL[nodeState];
  elements.nodeState.dataset.state = nodeState;
  elements.nodeDescription.textContent = known
    ? node.description
    : '尚未探索的节点。完成探索后才能看到它的名称与描述。';

  const actions = buildActions(node, nodeState);
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn--${action.tone}`;
    button.dataset.action = action.id;
    button.textContent = action.label;
    button.addEventListener('click', action.run);
    elements.nodeActions.append(button);
  }

  if (actions.length === 0 && nodeState === 'owned') {
    const hint = document.createElement('p');
    hint.className = 'panel__hint';
    hint.textContent = node.childGraphId
      ? '已拥有。该节点通往独立子图，可随时进入。'
      : '已拥有，信息在此持续可见。';
    elements.nodeActions.append(hint);
  }

  if (actions.length === 0 && nodeState === 'frontier') {
    const hint = document.createElement('p');
    hint.className = 'panel__hint';
    hint.textContent = '探索只会推进一步，相邻节点不会立刻全部显现。';
    elements.nodeActions.append(hint);
  }

  if (options.focusActionId) {
    const target = elements.nodeActions.querySelector<HTMLButtonElement>(
      `[data-action="${options.focusActionId}"]`,
    );
    target?.focus();
  }
}

function buildActions(node: DemoNode, nodeState: NodeState): PanelAction[] {
  if (nodeState === 'frontier') {
    return [{ id: 'explore', label: '探索', tone: 'primary', run: handleExplore }];
  }
  if (nodeState === 'known') {
    return [{ id: 'acquire', label: '取得', tone: 'primary', run: handleAcquire }];
  }
  if (nodeState === 'owned' && node.childGraphId) {
    return [{ id: 'enter-child', label: '进入子图', tone: 'primary', run: handleEnterChild }];
  }
  return [];
}

function renderProgress(): void {
  const states = session.nodeStates[session.currentGraphId];
  let owned = 0;
  let known = 0;
  let frontier = 0;

  for (const value of Object.values(states)) {
    if (value === 'owned') owned += 1;
    else if (value === 'known') known += 1;
    else if (value === 'frontier') frontier += 1;
  }

  elements.progress.textContent = `已拥有 ${owned} · 已认识 ${known} · 待探索 ${frontier}`;
}

function renderDebug(): void {
  const states = session.nodeStates[session.currentGraphId];
  const entries = Object.entries(states).map(([nodeId, value]) => `${nodeId}=${value}`);

  const stats = currentSolveStats();
  const layoutLine = stats
    ? `layout: rest@${stats.iterations} iter + ${stats.passes}p · step=${stats.maxStep} · gap=${stats.minGap} · angle=${stats.minAngle}° · overlap=${stats.overlaps}`
    : 'layout: n/a';

  elements.debugOutput.textContent = [
    `graph: ${session.currentGraphId}`,
    `selected: ${session.selectedNodeIds[session.currentGraphId] ?? 'null'}`,
    layoutLine,
    `states: ${entries.join('  ')}`,
  ].join('\n');
}

function focusNode(nodeId: string): void {
  nodeViews.get(nodeId)?.group.focus();
}

function focusSelectedNode(): void {
  const nodeId = session.selectedNodeIds[session.currentGraphId];
  if (nodeId) focusNode(nodeId);
}

/* ---------- 动作 ---------- */

function handleSelect(nodeId: string): void {
  if (getNodeState(nodeId) === 'hidden') return;

  const graph = currentGraph();
  const previousId = session.selectedNodeIds[session.currentGraphId];
  if (previousId === nodeId) {
    renderPanel();
    return;
  }

  session.selectedNodeIds[session.currentGraphId] = nodeId;

  const previousNode = previousId ? findNode(graph, previousId) : undefined;
  if (previousNode) updateNodeView(previousNode);
  const nextNode = findNode(graph, nodeId);
  if (nextNode) updateNodeView(nextNode);

  syncEdges();
  renderPanel();
  renderDebug();
}

function handleExplore(): void {
  const graph = currentGraph();
  const node = selectedNode(graph);
  if (!node || getNodeState(node.id) !== 'frontier') return;

  session.nodeStates[graph.id][node.id] = 'known';
  updateNodeView(node);
  syncEdges();
  renderPanel({ focusActionId: 'acquire' });
  renderProgress();
  renderDebug();
  elements.feedback.textContent = `已探索：${node.name}。取得后才会拥有它。`;
}

function handleAcquire(): void {
  const graph = currentGraph();
  const node = selectedNode(graph);
  if (!node || getNodeState(node.id) !== 'known') return;

  session.nodeStates[graph.id][node.id] = 'owned';
  const revealed = revealNeighbors(graph, session.nodeStates[graph.id], node.id);

  refreshNodeViews();
  syncEdges();
  renderProgress();
  renderDebug();

  if (node.childGraphId) {
    renderPanel({ focusActionId: 'enter-child' });
    elements.feedback.textContent = `已取得：${node.name}。可以进入独立子图。`;
    return;
  }

  renderPanel();
  focusSelectedNode();
  elements.feedback.textContent =
    revealed.length > 0 ? `已取得：${node.name}。相邻节点已显现。` : `已取得：${node.name}。`;
}

function handleEnterChild(): void {
  const graph = currentGraph();
  const node = selectedNode(graph);
  if (!node || !node.childGraphId || getNodeState(node.id) !== 'owned') return;

  transitionToGraph(node.childGraphId, `已进入「${GRAPHS[node.childGraphId].name}」。`);
}

const RANDOM_NODE_NAMES = ['雾中灯标', '碎光岔路', '低语草丛', '旧石界碑', '薄暮坡道', '浅滩渡口'];
const RANDOM_NODE_DESCRIPTIONS = [
  '随机放入的探索节点，用来观察新节点加入后的排布。',
  '临时节点，加入后会按间距与角度约束重新安置。',
  '随机落点的节点，若与已有节点过近会被物理松弛推开。',
  '用于压测布局的节点，重置后会被移除。',
];
const MAX_RANDOM_NODES = 6;
let randomNodeSeq = 0;

function invalidateLayout(graphId: GraphId): void {
  for (const mode of ['wide', 'compact'] as LayoutMode[]) {
    solvedLayouts.delete(`${graphId}:${mode}`);
    solveStats.delete(`${graphId}:${mode}`);
  }
}

function handleAddRandomNode(): void {
  const graph = currentGraph();
  const randomCount = graph.nodes.filter((node) => node.seed).length;
  if (randomCount >= MAX_RANDOM_NODES) {
    elements.feedback.textContent = `当前图最多放入 ${MAX_RANDOM_NODES} 个随机节点，重置后可重新放置。`;
    return;
  }

  const candidates = graph.nodes.filter((node) => getNodeState(node.id) !== 'hidden');
  if (candidates.length === 0) return;

  randomNodeSeq += 1;
  const id = `R${randomNodeSeq}`;
  const name = RANDOM_NODE_NAMES[(randomNodeSeq - 1) % RANDOM_NODE_NAMES.length] ?? '随机节点';
  const description =
    RANDOM_NODE_DESCRIPTIONS[(randomNodeSeq - 1) % RANDOM_NODE_DESCRIPTIONS.length] ??
    '随机放入的探索节点。';

  graph.nodes.push({
    id,
    name,
    description,
    initialState: 'frontier',
    seed: { nx: 0.1 + Math.random() * 0.8, ny: 0.1 + Math.random() * 0.8 },
  });

  const linkCount = Math.random() < 0.5 ? 1 : 2;
  const pool = [...candidates];
  for (let i = 0; i < linkCount && pool.length > 0; i += 1) {
    const target = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (!target) continue;
    graph.edges.push({ a: id, b: target.id });
  }

  session.nodeStates[graph.id][id] = 'frontier';
  session.selectedNodeIds[graph.id] = id;
  invalidateLayout(graph.id);

  renderGraph();
  renderBackdrop();
  renderHeader();
  renderPanel();
  renderProgress();
  renderDebug();
  elements.feedback.textContent = `已随机放入节点：${name}。`;
  focusNode(id);
}

function handleBack(): void {
  if (session.currentGraphId === 'main' || transitionLocked) return;
  transitionToGraph('main', `已返回「${GRAPHS.main.name}」。`);
}

/** 进入与返回共用同一套空间过渡：先收拢旧层，再让目标层就位。 */
function transitionToGraph(graphId: GraphId, feedback: string): void {
  if (transitionLocked || graphId === session.currentGraphId) return;

  if (REDUCED_MOTION.matches) {
    switchGraph(graphId, feedback);
    return;
  }

  transitionLocked = true;
  elements.backButton.disabled = true;
  elements.canvasHost.dataset.transition = 'back';

  transitionTimer = window.setTimeout(() => {
    transitionTimer = null;
    switchGraph(graphId, feedback);
    elements.canvasHost.dataset.transition = 'enter';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        elements.canvasHost.dataset.transition = '';
        transitionLocked = false;
        renderConnectorSoon();
      });
    });
  }, BACK_TRANSITION_MS);
}

function cancelTransition(): void {
  if (transitionTimer !== null) {
    window.clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  transitionLocked = false;
  elements.canvasHost.dataset.transition = '';
}

function handleReset(): void {
  cancelTransition();
  restoreInitialGraphs();
  for (const graphId of GRAPH_IDS) invalidateLayout(graphId);
  session = createSessionState();
  setProjectionScale(1);
  renderGraph();
  renderHeader();
  renderBackdrop();
  renderPanel();
  renderProgress();
  renderDebug();
  renderConnector();
  elements.feedback.textContent = '已重置 Demo：两张图都回到初始状态。';
  focusSelectedNode();
}

function setProjectionScale(scale: number, anchor: NodeCoordinate | null = null): void {
  const previousScale = projectionScale;
  projectionScale = Math.max(MIN_PROJECTION_SCALE, Math.min(MAX_PROJECTION_SCALE, scale));
  if (anchor && previousScale !== projectionScale) {
    const layout = layoutFor(currentGraph());
    const { centerX, centerY } = projectionMetrics(layout);
    const ratio = projectionScale / previousScale;
    session.cameraOffset = {
      x: anchor.x - centerX - ratio * (anchor.x - centerX - session.cameraOffset.x),
      y: anchor.y - centerY - ratio * (anchor.y - centerY - session.cameraOffset.y),
    };
  }
  elements.projectionScale.value = String(Math.round(projectionScale * 100));
  elements.projectionScaleValue.value = `${Math.round(projectionScale * 100)}%`;
  elements.projectionScaleValue.textContent = `${Math.round(projectionScale * 100)}%`;

  const graph = currentGraph();
  const layout = layoutFor(graph);
  elements.svg.classList.toggle('graph--overview', usesCompactNodeSymbols());
  applyCameraOffset();
  refreshReferencePlane(layout);
  positionBackdrop();
  for (const node of graph.nodes) {
    updateNodeGeometry(layout, node);
    updateNodeView(node);
  }
  syncEdges();
  renderConnectorSoon();
}

function handleCanvasWheel(event: WheelEvent): void {
  event.preventDefault();
  if (transitionLocked) return;

  const anchor = graphPointFromClient(event.clientX, event.clientY);
  if (!anchor) return;
  const deltaPixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? event.deltaY * elements.svg.clientHeight
      : event.deltaY;
  const nextScale = projectionScale * Math.exp(-deltaPixels * WHEEL_ZOOM_SPEED);
  setProjectionScale(nextScale, anchor);
}

function switchGraph(graphId: GraphId, feedback: string): void {
  cancelActiveDrag();
  session.currentGraphId = graphId;
  const graph = GRAPHS[graphId];
  if (session.selectedNodeIds[graphId] === null) {
    session.selectedNodeIds[graphId] = defaultSelectionFor(graph);
  }

  renderGraph();
  renderHeader();
  renderBackdrop();
  renderPanel();
  renderProgress();
  renderDebug();
  renderConnectorSoon();
  elements.feedback.textContent = feedback;
  focusSelectedNode();
}

/* ---------- 响应式布局 ---------- */

function focusedNodeId(): string | null {
  const active = document.activeElement;
  if (!(active instanceof Element)) return null;
  const group = active.closest('.node');
  return group instanceof SVGElement ? (group.dataset.nodeId ?? null) : null;
}

function applyLayoutWidth(width: number): void {
  const nextMode: LayoutMode = width < COMPACT_CANVAS_WIDTH ? 'compact' : 'wide';
  if (nextMode === layoutMode) return;

  layoutMode = nextMode;
  const activeNodeId = focusedNodeId();
  renderGraph();
  renderBackdrop();
  renderConnectorSoon();
  if (activeNodeId) focusNode(activeNodeId);
}

/* ---------- 启动 ---------- */

renderGraph();
renderHeader();
renderBackdrop();
renderPanel();
renderProgress();
renderDebug();
elements.feedback.textContent = '从「已拥有」的节点出发，沿着连线逐步探索。';

elements.backButton.addEventListener('click', handleBack);
elements.resetButton.addEventListener('click', handleReset);
elements.randomNodeButton.addEventListener('click', handleAddRandomNode);
elements.svg.addEventListener('pointerdown', beginCameraPan);
elements.svg.addEventListener('pointermove', moveCameraPan);
elements.svg.addEventListener('pointerup', finishCameraPan);
elements.svg.addEventListener('pointercancel', finishCameraPan);
elements.svg.addEventListener('lostpointercapture', finishCameraPan);
elements.svg.addEventListener('wheel', handleCanvasWheel, { passive: false });
elements.backdropNodeLimit.addEventListener('input', () => {
  renderBackdrop();
  renderConnectorSoon();
});
elements.projectionScale.addEventListener('input', () => {
  setProjectionScale(Number(elements.projectionScale.value) / 100);
});
renderConnectorSoon();

const resizeObserver = new ResizeObserver((entries) => {
  const entry = entries[0];
  if (!entry) return;
  applyLayoutWidth(entry.contentRect.width);
  positionBackdrop();
  renderConnectorSoon();
});
resizeObserver.observe(elements.canvasHost);
