import type { UIController } from '../controller/controller';
import type { PanelState } from '../components/shared/app-shell';
import type { WorkspaceLocation, WorkspaceNavigationState } from './workspace-router';

export interface EditorReturn {
  location: WorkspaceLocation;
  navigation?: WorkspaceNavigationState;
  workspace: PanelState['workspace'];
  mapEntrySource: PanelState['mapEntrySource'];
  init: string | null;
  serviceTheme: UIController['serviceThemeOverride'];
}

export function captureEditorReturn(ctrl: UIController): EditorReturn {
  const panel = ctrl.panelState;
  return { location: ctrl.workspaceLocation(), navigation: panel.workspaceNavigation,
    workspace: panel.workspace, mapEntrySource: panel.mapEntrySource, init: ctrl.game.state.activeInit, serviceTheme: ctrl.serviceThemeOverride };
}

export function discardEditorReturn(ctrl: UIController, saved?: EditorReturn): void {
  const workspace = saved?.workspace;
  if (workspace?.type === 'shop') {
    workspace.session.clear();
    ctrl.game.colorSystem.popEphemeralTheme(workspace.themeId);
  }
}

export function restoreEditorReturn(ctrl: UIController, saved?: EditorReturn): void {
  const panel = ctrl.panelState;
  const route = saved?.location.route;
  const target = route && typeof route !== 'string' ? route : { kind: 'game' as const };
  const sameInit = saved?.init === ctrl.game.state.activeInit;
  const valid = target.kind === 'service' || sameInit && (
    target.kind === 'game' || target.kind === 'contacts' || target.kind === 'story' || target.kind === 'shop'
    || target.kind === 'character' && ctrl.game.rosterSystem.isOwned(ctrl.game.state, target.variantId)
    || target.kind === 'area' && ctrl.game.world.areas.has(target.areaId)
    || target.kind === 'map' && ctrl.game.mapRun.getSnapshot()?.runId === target.runId
    || target.kind === 'map-entry' && ctrl.game.registry.maps.has(target.mapId)
    || target.kind === 'operation' && Boolean(ctrl.game.operationEntry.getView(target.runId))
    || target.kind === 'area-map' && panel.areaMapSession?.sessionId === target.sessionId);
  ctrl.serviceThemeOverride = saved && target.kind === 'service' ? saved.serviceTheme : undefined;
  if (saved && valid) {
    panel.workspace = saved.workspace;
    panel.workspaceNavigation = saved.navigation ?? { current: target };
    panel.service = target.kind === 'service' ? target.page : 'game';
    panel.leftTab = saved.location.leftTab;
    panel.centerTab = saved.location.centerTab;
    panel.rightTab = saved.location.rightTab;
    panel.selectedVariantId = saved.location.selectedVariantId;
    panel.conversationVariantId = saved.location.conversationVariantId;
    panel.mapEntrySource = saved.mapEntrySource;
  } else {
    discardEditorReturn(ctrl, saved);
    panel.workspace = undefined;
    panel.workspaceNavigation = { current: { kind: 'game' } };
    panel.service = 'game';
  }
}
