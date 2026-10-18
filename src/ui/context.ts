import { SaveSystem } from '../data-services/persistence/storage';
import type { GameView } from '../arona-clicker/contracts/view';
import type { GameReadModel } from '../arona-clicker/contracts';
import { displayName } from '../engine/core/display-name';
import type { BackgroundDecorationView, BackgroundView } from './background-service';
import { backgroundInkService, type BackgroundInk } from './background-color';
import type { PresentationView } from './presentation-service';
import { DEFAULT_PANEL_OPACITY } from './presentation-config';
import type { PresentationHostState, PresentationTextColorMode } from '../engine/types/theme';
import { resolveThemeBackgroundCascade, themeBaseColorForState, themeBaseLayerForState } from './theme-cascade-service';

export interface PresentationHostStateResult {
  background: BackgroundView;
  textColorMode: PresentationTextColorMode;
  source: 'state' | 'default' | 'parent' | 'auto';
  /** 宿主自身背景图层的合成代表色；无自有背景层时为 null（此时沿用 auto 语义色）。 */
  ink: BackgroundInk | null;
}

function mergeDecoration(base: BackgroundDecorationView | undefined, overlay: BackgroundDecorationView | undefined): BackgroundDecorationView | undefined {
  if (!base && !overlay) return undefined;
  return { ...base, ...overlay };
}

/**
 * 组件层可见的游戏只读门面：仅暴露渲染所需的状态读取与查询系统，
 * 不含写入口（mutations / 各命令门面 / 生命周期 / 存档）。
 * 写操作一律由 controller 层经 GameCommands 发起（架构纪律 #4）。
 */
/**
 * Map 工作区的 UI 临时信息流：Controller 持有真正的 Run 级流实例，
 * 缺失时渲染层只使用 detached View 的基线（无查询与会话观察）。
 */
export interface MapFlowReader {
  entriesFor(runId: string, view: import('../arona-clicker/contracts/runtime').MapRunWorkspaceView, ctx: UIContext): readonly import('./flow/flow-entry').FlowEntry[];
}

export interface UIContext {
  game: GameReadModel;
  world: GameReadModel['world'];
  view: GameView;
  saveExists: boolean;
  /** 仅 Map 工作区渲染使用；其他调用方保持缺省。 */
  mapFlow?: MapFlowReader;
  formatNumber(value: number): string;
  escapeHtml(value: string): string;
  formatTime(timestamp: number): string;
  /** 将实体 ID 转为人类可读显示名。 */
  nameOf(type: string, id: string): string;
  background: BackgroundView;
  presentation: PresentationView;
  /** 选择页主题投影策略；撤离到重选页时不把运行快照中的当前 Area 叠到 Init 预览上。 */
  selectorThemePolicy?: { includeResumedArea: boolean };
  entityPresentation?: GameReadModel['entityPresentation'];
  /** 宿主背景使用自有图层或按 ThemeTree 生成的语义底色；需要页面底图时显式传 inheritGlobal=true。 */
  backgroundForHost(hostId: string, inheritGlobal?: boolean, state?: PresentationHostState): BackgroundView;
  presentationHostState(hostId: string, state?: PresentationHostState): PresentationHostStateResult;
  textColorModeForHost(hostId: string, state?: PresentationHostState): PresentationTextColorMode;
  hoverTextColorModeForHost(hostId: string): PresentationTextColorMode;
}

const formatNumber = (value: number) => Math.floor(value).toLocaleString('en-US');

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('zh-CN', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

const emptyPresentation: PresentationView = {
  region: () => ({ layers: [], components: [] }),
  host: () => ({ layers: [], opacity: DEFAULT_PANEL_OPACITY, layerOrder: [] }),
  hasHost: () => false,
  shapeForHost: () => undefined,
  shapeParametersForHost: () => ({}),
  panelOpacity: () => DEFAULT_PANEL_OPACITY,
  asset: () => undefined,
  motion: () => undefined,
  stateAppearance: () => undefined,
};

export function createUIContext(
  game: GameReadModel,
  background?: BackgroundView,
  presentation?: PresentationView,
  selectorThemePolicy?: UIContext['selectorThemePolicy'],
  mapFlow?: MapFlowReader,
): UIContext {
  const presentationView = presentation ?? emptyPresentation;
  const resolveHostId = (hostId: string): string | undefined => {
    let candidate = hostId;
    while (candidate) {
      if (presentationView.hasHost(candidate)) return candidate;
      const separator = candidate.lastIndexOf('.');
      candidate = separator >= 0 ? candidate.slice(0, separator) : '';
    }
    return undefined;
  };
  /**
   * 宿主自有背景图层的合成代表色（以主题面板基底作透明层底色）。
   * 仅当宿主自身声明了背景图层时返回非 null；无自有背景的宿主靠 CSS 语义色绘制，
   * （如 chat-bubble 用 --theme-node-npc-bubble），此时返回 null 让调用方维持 auto，
   * 继续沿用各语义节点的 --ink-on-*，避免用页面底色误判。
   */
  const hostInk = (hostId: string, state: PresentationHostState): BackgroundInk | null => {
    const host = presentationView.host(hostId);
    const stateLayers = host.states?.get(state)?.layers ?? [];
    const hostLayers = stateLayers.length
      ? (() => {
          const overlayIds = new Set(stateLayers.map(layer => layer.id).filter((id): id is string => Boolean(id)));
          const base = host.layers.length
            ? host.layers
            : stateLayers.some(layer => layer.kind === 'empty')
              ? []
                : [themeBaseLayerForState(state)];
          return [...base.filter(layer => !layer.id || !overlayIds.has(layer.id)), ...stateLayers];
        })()
      : host.layers;
    if (hostLayers.length === 0) return null;
    return backgroundInkService.ink(hostLayers, {
      lookup: background?.themeVars,
      // 宿主半透明图层叠在主题面板基底上，而不是页面背景图上。
      base: themeBaseColorForState(state, background?.themeVars),
    });
  };
  const resolveTextColorMode = (hostId: string, state: PresentationHostState): Pick<PresentationHostStateResult, 'textColorMode' | 'source'> => {
    // auto 的语义：宿主自带背景图层时按「多图层合成色」判定深浅，否则维持语义色。
    const concrete = (mode: PresentationTextColorMode, source: PresentationHostStateResult['source']): Pick<PresentationHostStateResult, 'textColorMode' | 'source'> => {
      if (mode !== 'auto') return { textColorMode: mode, source };
      const ink = hostInk(hostId, state);
      return ink ? { textColorMode: ink.textColorMode, source } : { textColorMode: 'auto', source };
    };
    let candidate = hostId;
    let first = true;
    while (candidate) {
      const resolvedHostId = resolveHostId(candidate);
      if (!resolvedHostId) break;
      const host = presentationView.host(resolvedHostId);
      // A concrete state always wins over the host default, including an
      // explicit `auto`. Only after the exact state is absent do we inherit
      // the host's default-state configuration.
      const stateMode = state === 'default' ? undefined : host.states?.get(state)?.textColorMode;
      if (stateMode !== undefined) return concrete(stateMode, first ? 'state' : 'parent');
      const defaultMode = host.states?.get('default')?.textColorMode ?? host.textColorMode;
      if (defaultMode !== undefined) return concrete(defaultMode, first ? 'default' : 'parent');
      const separator = resolvedHostId.lastIndexOf('.');
      candidate = separator >= 0 ? resolvedHostId.slice(0, separator) : '';
      first = false;
    }
    return concrete('auto', 'auto');
  };
  const context: UIContext = {
    game,
    world: game.world,
    view: game.getView(),
    saveExists: SaveSystem.exists(),
    formatNumber,
    escapeHtml,
    formatTime,
    nameOf: (type, id) => displayName(game.registry, type, id),
    background: background ?? { layers: [] },
    presentation: presentation ?? emptyPresentation,
    selectorThemePolicy,
    mapFlow,
    entityPresentation: game.entityPresentation,
    backgroundForHost: (hostId, inheritGlobal = false, state: PresentationHostState = 'default') => {
      const globalLayers = (background ?? { layers: [] }).layers;
      const resolvedHostId = resolveHostId(hostId);
      const host = resolvedHostId ? presentationView.host(resolvedHostId) : presentationView.host(hostId);
      const localHost = presentationView.host(hostId);
      const parentState = resolvedHostId && resolvedHostId !== hostId
        ? host.states?.get(state)
        : undefined;
      const localState = localHost.states?.get(state);
      const localStateView = localState && (localState.layers.length > 0 || localState.decoration !== undefined)
        ? localState
        : undefined;
      const parentStateView = parentState && (parentState.layers.length > 0 || parentState.decoration !== undefined)
        ? parentState
        : undefined;
      const decoration = mergeDecoration(host.decoration, localStateView?.decoration ?? parentStateView?.decoration);
      const geometry = presentationView.shapeParametersForHost(hostId);
      const layers = resolveThemeBackgroundCascade({
        hostLayers: localHost.layers,
        stateLayers: localStateView?.layers,
        globalLayers,
        state,
        inheritGlobal,
      });
      return { layers, ...geometry, decoration };
    },
    presentationHostState: (hostId, state: PresentationHostState = 'default') => ({
      background: context.backgroundForHost(hostId, false, state),
      ink: hostInk(hostId, state),
      ...resolveTextColorMode(hostId, state),
    }),
    textColorModeForHost: (hostId, state: PresentationHostState = 'default') => resolveTextColorMode(hostId, state).textColorMode,
    hoverTextColorModeForHost: hostId => resolveTextColorMode(hostId, 'active').textColorMode,
  };
  return context;
}
