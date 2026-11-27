import type { UIController } from '../controller/controller';
import type { WorkspaceRoute } from '../workspace/workspace-router';
import type { StoryEditorTarget } from '../story-editor/model';
import type { WorldEntityRef } from '../runtime-editor/world-browser';

export type DevNavigationRequest =
  | { page: 'game' }
  | { page: 'story-editor'; target?: StoryEditorTarget; source?: string }
  | { page: 'world-editor'; target?: WorldEntityRef };

export interface DevNavigationSnapshot {
  status: 'ready' | 'navigating';
  route: WorkspaceRoute;
  resource?: { provider: 'story' | 'world'; kind: 'story' | 'entry' | 'init' | 'area' | 'spot'; id: string; source?: string };
  layout?: { mode: string; view: string; ribbon: string; leftWidth: number; rightWidth: number };
}

export type DevNavigationResult =
  | { ok: true; current: DevNavigationSnapshot }
  | { ok: false; code: 'busy' | 'invalid-request' | 'unsupported-layout-override' | 'invalid-target' | 'style-load-failed' | 'gate-blocked' | 'navigation-incomplete'; message: string; current: DevNavigationSnapshot };

export interface DevNavigationApi {
  ready(): Promise<DevNavigationSnapshot>;
  current(): DevNavigationSnapshot;
  navigate(request: unknown): Promise<DevNavigationResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): DevNavigationRequest | undefined {
  if (!isRecord(value) || typeof value.page !== 'string') return undefined;
  if ('mode' in value || 'view' in value) return undefined;
  if (value.page === 'game') return { page: 'game' };
  if (value.page === 'story-editor') {
    if (value.source !== undefined && typeof value.source !== 'string') return undefined;
    if (value.target === undefined) return { page: value.page, source: value.source as string | undefined };
    if (!isRecord(value.target) || (value.target.kind !== 'story' && value.target.kind !== 'entry') || typeof value.target.id !== 'string' || !value.target.id) return undefined;
    return { page: value.page, source: value.source as string | undefined, target: { kind: value.target.kind, id: value.target.id } };
  }
  if (value.page === 'world-editor') {
    if (value.target === undefined) return { page: value.page };
    if (!isRecord(value.target) || !['init', 'area', 'spot'].includes(String(value.target.kind)) || typeof value.target.id !== 'string' || !value.target.id) return undefined;
    return { page: value.page, target: { kind: value.target.kind as WorldEntityRef['kind'], id: value.target.id } };
  }
  return undefined;
}

/** Turn /game query parameters into the same input accepted by the script API. */
export function devNavigationRequestFromSearch(search: string): unknown | undefined {
  const params = new URLSearchParams(search);
  const pages = params.getAll('devPage');
  if (pages.length === 0) return undefined;
  if (pages.length !== 1 || !pages[0]) return { page: '__invalid__' };
  const page = pages[0];
  const kinds = params.getAll('kind');
  const ids = params.getAll('id');
  const sources = params.getAll('source');
  if (kinds.length > 1 || ids.length > 1 || sources.length > 1) return { page: '__invalid__' };
  const kind = kinds[0];
  const id = ids[0];
  const source = sources[0];
  if (page === 'game') {
    if (kind !== undefined || id !== undefined || source !== undefined) return { page: '__invalid__' };
    return { page, ...(params.has('mode') ? { mode: params.get('mode') } : {}), ...(params.has('view') ? { view: params.get('view') } : {}) };
  }
  if (page === 'story-editor') {
    if ((kind === undefined) !== (id === undefined) || source !== undefined && kind === undefined) return { page: '__invalid__' };
    const target = kind === undefined ? undefined : { kind, id };
    return { page, target, source, ...(params.has('mode') ? { mode: params.get('mode') } : {}), ...(params.has('view') ? { view: params.get('view') } : {}) };
  }
  if (page === 'world-editor') {
    if (source !== undefined || (kind === undefined) !== (id === undefined)) return { page: '__invalid__' };
    const target = kind === undefined ? undefined : { kind, id };
    return { page, target, ...(params.has('mode') ? { mode: params.get('mode') } : {}), ...(params.has('view') ? { view: params.get('view') } : {}) };
  }
  return { page };
}

function currentRoute(controller: UIController): WorkspaceRoute {
  return controller.panelState.workspaceNavigation?.current ?? { kind: 'game' };
}

function isEditorRoute(route: WorkspaceRoute): route is Extract<WorkspaceRoute, { kind: 'story-editor' | 'world-editor' }> {
  return route.kind === 'story-editor' || route.kind === 'world-editor';
}

function restorePreviousRoute(controller: UIController, previous: WorkspaceRoute): void {
  const current = currentRoute(controller);
  if (current.kind === previous.kind) return;
  if (isEditorRoute(previous)) controller.replaceWorkspaceRoute(previous);
  else if (isEditorRoute(current)) controller.endEditorSession(true);
  else controller.replaceWorkspaceRoute(previous);
  controller.render();
}

function numericStyle(shell: HTMLElement, property: string): number {
  const value = getComputedStyle(shell).getPropertyValue(property) || shell.style.getPropertyValue(property);
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createDevNavigation(controller: UIController): DevNavigationApi {
  let navigating = false;

  const current = (): DevNavigationSnapshot => {
    const route = currentRoute(controller);
    const shell = controller.root.querySelector<HTMLElement>('[data-editor-workspace]');
    const snapshot: DevNavigationSnapshot = { status: navigating ? 'navigating' : 'ready', route };
    if (shell) {
      snapshot.layout = {
        mode: shell.dataset.editorWorkspaceMode ?? '',
        view: shell.dataset.editorWorkspaceView ?? '',
        ribbon: shell.querySelector<HTMLElement>('[data-editor-workspace-header]')?.dataset.editorWorkspaceRibbon ?? '',
        leftWidth: numericStyle(shell, '--editor-track-left'),
        rightWidth: numericStyle(shell, '--editor-track-right'),
      };
    }
    if (route.kind === 'story-editor') {
      const target = controller.storyEditor.state.target;
      if (target) snapshot.resource = { provider: 'story', ...target, source: controller.storyEditor.state.sourceSelection ?? '' };
    } else if (route.kind === 'world-editor') {
      const active = controller.browseInstances.active;
      const target = active?.providerKey === 'world'
        ? (active.state as import('../runtime-editor/world-browser-provider').WorldBrowseInstanceState).provider.target
        : undefined;
      if (target) snapshot.resource = { provider: 'world', ...target };
    }
    return snapshot;
  };
  const settledCurrent = (): DevNavigationSnapshot => ({ ...current(), status: 'ready' });

  const ready = async (): Promise<DevNavigationSnapshot> => current();

  const navigate = async (input: unknown): Promise<DevNavigationResult> => {
    if (navigating) return { ok: false, code: 'busy', message: 'Another development navigation is in progress.', current: current() };
    if (isRecord(input) && ('mode' in input || 'view' in input)) {
      return { ok: false, code: 'unsupported-layout-override', message: 'URL Mode/View overrides are deferred; use the Editor Layout controls.', current: current() };
    }
    const request = parseRequest(input);
    if (!request) return { ok: false, code: 'invalid-request', message: 'The development navigation request is invalid.', current: current() };
    if (request.page === 'story-editor' && request.target && !controller.storyEditor.canNavigateToTarget(request.target, request.source)) {
      return { ok: false, code: 'invalid-target', message: 'The requested Story or Entry is not available in that source.', current: current() };
    }
    if (request.page === 'world-editor' && request.target && !controller.canNavigateToWorldEntity(request.target)) {
      return { ok: false, code: 'invalid-target', message: 'The requested World entity does not exist.', current: current() };
    }

    navigating = true;
    const previousRoute = currentRoute(controller);
    try {
      const surface = request.page === 'story-editor' ? 'story' : request.page === 'world-editor' ? 'world-editor' : undefined;
      try {
        if (surface) await controller.loadSurfaceStyles?.(surface);
      } catch {
        return { ok: false, code: 'style-load-failed', message: `Could not load the ${surface} editor styles.`, current: settledCurrent() };
      }

      if (request.page === 'game') {
        controller.navigateToService('game', false);
        const after = settledCurrent();
        return after.route.kind === 'game'
          ? { ok: true, current: after }
          : { ok: false, code: 'gate-blocked', message: 'The current editor refused to leave.', current: after };
      }

      if (request.page === 'story-editor') {
        controller.openStoryEditor();
        if (currentRoute(controller).kind !== 'story-editor') {
          restorePreviousRoute(controller, previousRoute);
          return { ok: false, code: 'gate-blocked', message: 'The current editor refused to switch to Story.', current: settledCurrent() };
        }
        if (request.target && !controller.storyEditor.navigateToTarget(request.target, request.source)) {
          restorePreviousRoute(controller, previousRoute);
          return { ok: false, code: 'navigation-incomplete', message: 'The requested Story resource could not be activated.', current: settledCurrent() };
        }
        const after = settledCurrent();
        const hostReady = Boolean(controller.root.querySelector('[data-editor-workspace] .story-editor-center'));
        if (hostReady && (!request.target || after.resource?.provider === 'story' && after.resource.kind === request.target.kind && after.resource.id === request.target.id)) {
          return { ok: true, current: after };
        }
        restorePreviousRoute(controller, previousRoute);
        return { ok: false, code: 'navigation-incomplete', message: 'The Story editor host is not ready for interaction.', current: settledCurrent() };
      }

      controller.openWorldBrowser();
      if (currentRoute(controller).kind !== 'world-editor') {
        restorePreviousRoute(controller, previousRoute);
        return { ok: false, code: 'gate-blocked', message: 'The current editor refused to switch to World.', current: settledCurrent() };
      }
      if (request.target && !controller.navigateToWorldEntity(request.target)) {
        restorePreviousRoute(controller, previousRoute);
        return { ok: false, code: 'navigation-incomplete', message: 'The World browser opened, but the requested entity was not located.', current: settledCurrent() };
      }
      const after = settledCurrent();
      const hostReady = Boolean(controller.root.querySelector('[data-editor-workspace] [data-world-tree]')
        && controller.root.querySelector('[data-editor-workspace] [data-world-detail]'));
      if (hostReady && (!request.target || after.resource?.provider === 'world' && after.resource.kind === request.target.kind && after.resource.id === request.target.id)) {
        return { ok: true, current: after };
      }
      restorePreviousRoute(controller, previousRoute);
      return { ok: false, code: 'navigation-incomplete', message: 'The World editor host is not ready for interaction.', current: settledCurrent() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try { restorePreviousRoute(controller, previousRoute); } catch { /* Preserve the original navigation error. */ }
      return { ok: false, code: 'navigation-incomplete', message, current: settledCurrent() };
    } finally {
      navigating = false;
    }
  };

  return { ready, current, navigate };
}
