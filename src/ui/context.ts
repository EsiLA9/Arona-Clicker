import { SaveSystem } from '../data-services/persistence/storage';
import type { GameView } from '../arona-clicker/contracts/view';
import type { GameReadModel } from '../arona-clicker/contracts';
import { displayName } from '../engine/core/display-name';
import type { BackgroundDecorationView, BackgroundView } from './background-service';
import { backgroundInkService, type BackgroundInk } from './background-color';
import type { PresentationView } from './presentation-service';
import { DEFAULT_PANEL_OPACITY } from './presentation-config';
import type { PresentationHostState, PresentationTextColorMode } from '../engine/types/theme';

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
export interface UIContext {
  game: GameReadModel;
  world: GameReadModel['world'];
  view: GameView;
  saveExists: boolean;
  formatNumber(value: number): string;
  escapeHtml(value: string): string;
  formatTime(timestamp: number): string;
  /** 将实体 ID 转为人类可读显示名。 */
  nameOf(type: string, id: string): string;
  background: BackgroundView;
  presentation: PresentationView;
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

export function createUIContext(game: GameReadModel, background?: BackgroundView, presentation?: PresentationView): UIContext {
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
   * 宿主背景栈的合成代表色（含其下方的全局背景）。
   * 仅当宿主自身声明了背景图层时返回非 null——无自有背景的宿主可能靠 CSS 直接上色
   * （如 chat-bubble 用 --theme-node-npc-bubble），此时返回 null 让调用方维持 auto，
   * 继续沿用各语义节点的 --ink-on-*，避免用页面底色误判。
   */
  const hostInk = (hostId: string, state: PresentationHostState): BackgroundInk | null => {
    const hostLayers = context.backgroundForHost(hostId, false, state).layers;
    if (hostLayers.length === 0) return null;
    return backgroundInkService.ink(hostLayers, {
      lookup: background?.themeVars,
      // 宿主背景层多为半透明，须与其下方的全局背景合成后再判定
      base: background?.ink?.color ?? null,
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
    backgroundForHost: (hostId, inheritGlobal = true, state: PresentationHostState = 'default') => {
      const globalLayers = (background ?? { layers: [] }).layers;
      const activeFallbackLayer = {
        kind: 'solid' as const,
        value: 'var(--theme-palette-2, var(--theme-palette-1, var(--theme-node-primary)))',
        opacity: 1,
        position: 'center' as const,
        size: 'cover' as const,
        repeat: 'no-repeat' as const,
        blendMode: 'normal' as const,
        attachment: 'fixed' as const,
        scale: 1,
        rotation: 0,
      };
      const baseFallbackLayer = {
        kind: 'solid' as const,
        value: 'var(--ui-button-bg, var(--theme-node-panel-light, var(--theme-node-panel, #ffffff)))',
        opacity: 1,
        position: 'center' as const,
        size: 'cover' as const,
        repeat: 'no-repeat' as const,
        blendMode: 'normal' as const,
        attachment: 'fixed' as const,
        scale: 1,
        rotation: 0,
      };
      const shouldUseBaseFallback = state === 'inactive' || state === 'disabled';
      const resolvedHostId = resolveHostId(hostId);
      if (!resolvedHostId) {
        return {
          layers: state === 'active' ? [activeFallbackLayer] : shouldUseBaseFallback ? [baseFallbackLayer] : inheritGlobal ? globalLayers : [],
          ...presentationView.shapeParametersForHost(hostId),
        };
      }
      let effectiveHostId = resolvedHostId;
      let host = presentationView.host(effectiveHostId);
      const stateView = () => {
        const exact = host.states?.get(state);
        return exact && (exact.layers.length > 0 || exact.decoration !== undefined)
          ? exact
          : undefined;
      };
      while (state !== 'default' && !stateView()) {
        const separator: number = effectiveHostId.lastIndexOf('.');
        const parentId: string = separator >= 0 ? effectiveHostId.slice(0, separator) : '';
        if (!parentId || !presentationView.hasHost(parentId)) break;
        effectiveHostId = parentId;
        host = presentationView.host(parentId);
      }
      const activeState = stateView();
      const activeFallback = state === 'active' && !activeState;
      const decoration = mergeDecoration(host.decoration, activeState?.decoration);
      const mergeStateLayers = (base: readonly BackgroundView['layers'][number][], overlay: readonly BackgroundView['layers'][number][]) => {
        const overlayIds = new Set(overlay.map(layer => layer.id).filter((id): id is string => Boolean(id)));
        return [...base.filter(layer => !layer.id || !overlayIds.has(layer.id)), ...overlay];
      };
      const hostLayers = activeFallback
        ? []
        : activeState?.layers.length
          ? mergeStateLayers(host.layers, activeState.layers)
          : host.layers;
      const geometry = presentationView.shapeParametersForHost(hostId);
      if (activeFallback) return { layers: [activeFallbackLayer], ...geometry, decoration };
      return { layers: hostLayers.length > 0 ? hostLayers : inheritGlobal ? globalLayers : shouldUseBaseFallback ? [baseFallbackLayer] : [], ...geometry, decoration };
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
