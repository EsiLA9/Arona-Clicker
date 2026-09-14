export type WorkspaceServicePage = 'settings' | 'inventory' | 'datapack' | 'saves' | 'records';

export type WorkspaceRoute =
  | { kind: 'game' }
  | { kind: 'service'; page: WorkspaceServicePage }
  | { kind: 'shop'; sessionId: string }
  | { kind: 'character'; variantId: string }
  | { kind: 'contacts' }
  | { kind: 'story'; sessionId?: string };

export type LegacyWorkspaceRoute = 'game' | 'contacts' | 'story' | 'shop' | 'character' | 'service';

export interface LegacyWorkspaceRef {
  type: 'shop' | 'character' | 'contacts' | 'story';
  sessionId?: string;
  variantId?: string;
}

/** 单层返回位置：只保存可恢复的 UI 位置，不携带 Workspace 内部业务状态。 */
export interface WorkspaceLocation {
  route?: WorkspaceRoute | LegacyWorkspaceRoute;
  leftTab: string;
  centerTab: string;
  rightTab: string;
  selectedVariantId: string | null;
  conversationVariantId: string | null;
}

/** 当前路由与单层返回位置；不实现通用 history stack。 */
export interface WorkspaceNavigationState {
  current: WorkspaceRoute;
  returnTo?: WorkspaceLocation;
}

export function routeForService(service: string | undefined): WorkspaceRoute {
  switch (service) {
    case 'settings':
    case 'inventory':
    case 'datapack':
    case 'saves':
    case 'records':
      return { kind: 'service', page: service };
    default:
      return { kind: 'game' };
  }
}

export function routeFromLegacyState(input: { service?: string; workspace?: LegacyWorkspaceRef | null }): WorkspaceRoute {
  if (input.service && input.service !== 'game') return routeForService(input.service);
  const workspace = input.workspace;
  if (!workspace) return { kind: 'game' };
  if (workspace.type === 'shop') return { kind: 'shop', sessionId: workspace.sessionId ?? '' };
  if (workspace.type === 'character') return { kind: 'character', variantId: workspace.variantId ?? '' };
  if (workspace.type === 'contacts') return { kind: 'contacts' };
  return { kind: 'story', sessionId: workspace.sessionId };
}

export function normalizeWorkspaceRoute(route: WorkspaceRoute | LegacyWorkspaceRoute | undefined): WorkspaceRoute {
  if (!route || typeof route === 'string') {
    if (route === 'contacts') return { kind: 'contacts' };
    if (route === 'story') return { kind: 'story' };
    if (route === 'shop') return { kind: 'shop', sessionId: '' };
    if (route === 'character') return { kind: 'character', variantId: '' };
    return routeForService(route);
  }
  return route;
}

export function workspaceRouteKey(route: WorkspaceRoute): string {
  if (route.kind === 'service') return `service:${route.page}`;
  if (route.kind === 'shop') return `shop:${route.sessionId}`;
  if (route.kind === 'character') return `character:${route.variantId}`;
  if (route.kind === 'story') return `story:${route.sessionId ?? ''}`;
  return route.kind;
}

export function sameWorkspaceRoute(left: WorkspaceRoute, right: WorkspaceRoute): boolean {
  return workspaceRouteKey(left) === workspaceRouteKey(right);
}

export function createWorkspaceNavigation(current: WorkspaceRoute = { kind: 'game' }, returnTo?: WorkspaceLocation): WorkspaceNavigationState {
  return returnTo ? { current, returnTo } : { current };
}

export function enterWorkspaceNavigation(
  navigation: WorkspaceNavigationState,
  current: WorkspaceRoute,
  returnTo: WorkspaceLocation,
): WorkspaceNavigationState {
  return { current, returnTo };
}

export function replaceWorkspaceNavigation(
  navigation: WorkspaceNavigationState,
  current: WorkspaceRoute,
): WorkspaceNavigationState {
  return navigation.returnTo ? { current, returnTo: navigation.returnTo } : { current };
}

export function backWorkspaceNavigation(
  navigation: WorkspaceNavigationState,
  fallback: WorkspaceRoute = { kind: 'game' },
): { current: WorkspaceRoute; returnTo?: WorkspaceLocation } {
  if (!navigation.returnTo) return { current: fallback };
  return { current: normalizeWorkspaceRoute(navigation.returnTo.route), returnTo: undefined };
}

export function isLegacyWorkspaceStateConsistent(input: { service?: string; workspace?: LegacyWorkspaceRef | null }): boolean {
  return !input.workspace || !input.service || input.service === 'game';
}

export function resolveCurrentWorkspaceRoute(
  navigation: WorkspaceNavigationState | undefined,
  legacy: { service?: string; workspace?: LegacyWorkspaceRef | null },
): WorkspaceRoute {
  const derived = routeFromLegacyState(legacy);
  return navigation && sameWorkspaceRoute(navigation.current, derived) ? navigation.current : derived;
}
