import type { BackgroundView } from './background-service';
import type { PresentationHostState } from '../../engine/types/theme';
import {
  buildScopedThemeNodeVars,
  resolveScopedThemeNodes,
  type ThemeNodeName,
} from './theme-palette';

export type ThemeNodeTree = Readonly<Record<ThemeNodeName, string>>;
export type ThemeScopeOverrides = Readonly<Record<string, Partial<Record<ThemeNodeName, string>>>>;

/** Resolve dotted UI scopes from the root, applying only the overrides declared at each level. */
export function createThemeScopeCascade(root: ThemeNodeTree, overrides: ThemeScopeOverrides) {
  const cache = new Map<string, ThemeNodeTree>([['root', root]]);

  const nodesFor = (scope: string): ThemeNodeTree => {
    const normalized = scope.trim() || 'root';
    const cached = cache.get(normalized);
    if (cached) return cached;

    const separator = normalized.lastIndexOf('.');
    const parentScope = separator >= 0 ? normalized.slice(0, separator) : 'root';
    const parent = nodesFor(parentScope);
    const local = new Map(Object.entries(overrides[normalized] ?? {}) as [ThemeNodeName, string][]);
    const resolved = resolveScopedThemeNodes(parent, local);
    cache.set(normalized, resolved);
    return resolved;
  };

  return {
    nodesFor,
    varsFor: (scope: string) => buildScopedThemeNodeVars(nodesFor(scope)),
  };
}

export interface ThemeBackgroundCascadeInput {
  hostLayers: readonly BackgroundView['layers'][number][];
  stateLayers?: readonly BackgroundView['layers'][number][];
  globalLayers: readonly BackgroundView['layers'][number][];
  state: PresentationHostState;
  /** Opt in only for surfaces that intentionally show the page background beneath themselves. */
  inheritGlobal?: boolean;
}

const layerBase = (value: string): BackgroundView['layers'][number] => ({
  id: 'theme-cascade-base',
  kind: 'solid',
  value,
  opacity: 1,
  position: 'center',
  size: 'cover',
  repeat: 'no-repeat',
  blendMode: 'normal',
  attachment: 'fixed',
  scale: 1,
  rotation: 0,
});

export function themeBaseLayerForState(state: PresentationHostState): BackgroundView['layers'][number] {
  if (state === 'active') {
    return layerBase('var(--theme-palette-2, var(--theme-palette-1, var(--theme-node-primary)))');
  }
  if (state === 'inactive' || state === 'disabled') {
    return layerBase('var(--theme-node-panel-light, var(--theme-node-panel, #ffffff))');
  }
  return layerBase('var(--theme-node-panel, #ffffff)');
}

export function themeBaseColorForState(state: PresentationHostState, vars?: Readonly<Record<string, string | undefined>>): string | null {
  const keys = state === 'active'
    ? ['--theme-palette-2', '--theme-palette-1', '--theme-node-primary']
    : state === 'inactive' || state === 'disabled'
      ? ['--theme-node-panel-light', '--theme-node-panel']
      : ['--theme-node-panel'];
  return keys.map(key => vars?.[key]).find((value): value is string => Boolean(value)) ?? null;
}

function mergeStateLayers(
  base: readonly BackgroundView['layers'][number][],
  overlay: readonly BackgroundView['layers'][number][],
): BackgroundView['layers'][number][] {
  const overlayIds = new Set(overlay.map(layer => layer.id).filter((id): id is string => Boolean(id)));
  return [...base.filter(layer => !layer.id || !overlayIds.has(layer.id)), ...overlay];
}

/**
 * Resolve one host's background independently from its parent and the page canvas.
 * Color variables flow through ThemeTree; background layers stay local unless a caller
 * explicitly requests the global canvas. Missing local backgrounds get a semantic base.
 */
export function resolveThemeBackgroundCascade(input: ThemeBackgroundCascadeInput): BackgroundView['layers'][number][] {
  if (input.stateLayers?.length) {
    const explicitEmpty = input.stateLayers.some(layer => layer.kind === 'empty');
    const base = input.hostLayers.length
      ? input.hostLayers
      : explicitEmpty
        ? []
        : [themeBaseLayerForState(input.state)];
    return mergeStateLayers(base, input.stateLayers);
  }
  if (input.hostLayers.length) return [...input.hostLayers];
  if (input.state !== 'default') return [themeBaseLayerForState(input.state)];
  if (input.inheritGlobal && input.globalLayers.length) return [...input.globalLayers];
  return [themeBaseLayerForState(input.state)];
}
