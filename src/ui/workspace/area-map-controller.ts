import type { UIController } from '../controller';
import type { AreaMapSession } from './area-map-session';
import { createAreaMapSession, fitAreaMap, openAreaMap, previousAreaMap, reconcileAreaMap } from './area-map-session';
import { createWorkspaceNavigation, normalizeWorkspaceRoute } from './workspace-router';
import { getForegroundInteractionStatus } from './foreground-interaction';
import { createUIContext } from '../context';
import { applyAreaMapCamera, reconcileAreaMapDOM } from './area-map-dom';
import { bindAreaMapCamera } from './area-map-camera';
import { areaMapReason } from '../components/area-map-workspace';
import { renderLeftPanel } from '../components/rail';
import { bindInventoryActions } from '../controller-actions-inventory';
import { bindEntityPresentationActions } from '../controller-actions-presentation';

export const AREA_MAP_REGION = 'workspace.area-map';
let sequence = 0;

/** UI-only coordinator. Every action re-reads public query/admission before issuing a command. */
export class AreaMapController {
  private bound = false;
  private viewport: SVGSVGElement | null = null;
  private releaseCamera: (() => void) | null = null;
  private suppressUntil = 0;
  private painted = '';
  constructor(private readonly ctrl: UIController) {}
  private get session(): AreaMapSession | undefined { return this.ctrl.panelState.areaMapSession; }
  private allowed(intent: 'openAreaMap' | 'attemptAreaTravel'): boolean {
    return getForegroundInteractionStatus(this.ctrl.game, this.ctrl.panelState, intent, {
      confirmation: this.ctrl.modal.isOpen(), submitting: this.session?.submitting,
    }).allowed;
  }

  open(areaId: string): void {
    const c = this.ctrl;
    if (!c.started || normalizeWorkspaceRoute(c.workspaceLocation().route).kind !== 'game' || c.panelState.workspace || !this.allowed('openAreaMap')) return;
    const state = c.game.state;
    if (state.currentAreaId !== areaId || !state.activeInit) return;
    const entry = c.game.areaMap.getEntryView(areaId);
    if (!entry.ready) return;
    const view = c.game.areaMap.getView(entry.mapId);
    if (!view?.unlocked) return;
    c.panelState.areaMapSession = createAreaMapSession(`area-map-${++sequence}`, state.activeInit, areaId, view, c.game.inits.getRuntimeGeneration());
    c.enterWorkspaceRoute({ kind: 'area-map', sessionId: this.session!.sessionId });
    c.render();
  }

  close(render = true): void {
    const c = this.ctrl, session = this.session;
    if (!session) return;
    const navigation = c.panelState.workspaceNavigation;
    this.release();
    if (navigation?.current.kind === 'area-map') {
      const location = navigation.returnTo;
      c.panelState.workspace = undefined;
      c.panelState.workspaceNavigation = createWorkspaceNavigation(normalizeWorkspaceRoute(location?.route));
      c.panelState.service = 'game';
      if (location) {
        c.panelState.leftTab = location.leftTab; c.panelState.centerTab = location.centerTab;
        c.panelState.rightTab = location.rightTab; c.panelState.selectedVariantId = location.selectedVariantId;
        c.panelState.conversationVariantId = location.conversationVariantId;
      }
    }
    if (render) {
      c.render();
      [...c.root.querySelectorAll<HTMLButtonElement>('[data-area-map-open]')].find(button => button.dataset.areaMapOpen === session.originAreaId)?.focus();
    }
  }

  release(): void {
    this.releaseCamera?.(); this.releaseCamera = null; this.viewport = null;
    this.ctrl.panelState.areaMapSession = undefined; this.painted = '';
  }

  /** Called before root render, including external navigation/reload; never recursively renders. */
  beforeRender(): void {
    const c = this.ctrl, s = this.session, route = c.panelState.workspaceNavigation?.current;
    if (!s) {
      if (route?.kind === 'area-map') c.panelState.workspaceNavigation = createWorkspaceNavigation();
      return;
    }
    if (route?.kind !== 'area-map' || route.sessionId !== s.sessionId || c.panelState.workspace || c.panelState.service !== 'game') { this.release(); return; }
    if (s.submitting) return;
    if (!c.started || c.game.state.activeInit !== s.originInitId || c.game.state.currentAreaId !== s.originAreaId ||
      c.game.inits.getRuntimeGeneration() !== s.runtimeGeneration || !this.allowed('openAreaMap')) { this.close(false); return; }
    if (!reconcileAreaMap(s, c.game.areaMap)) {
      const entry = c.game.areaMap.getEntryView(c.game.state.currentAreaId!);
      const view = entry.ready ? c.game.areaMap.getView(entry.mapId) : null;
      if (!view) { this.close(false); return; }
      openAreaMap(s, view, true);
    }
  }

  /** Returns whether this refresh belongs to the map (even if it just closed). */
  refresh(force = false): boolean {
    const before = this.session;
    if (!before) { this.refreshEntry(); return false; }
    if (before.submitting) return true;
    this.beforeRender();
    if (!this.session) { this.ctrl.scheduleRender(); return true; }
    this.refreshLeft();
    const s = this.session;
    const fingerprint = `${s.revision}:${s.selectedNodeId}:${s.submitting}:${this.allowed('attemptAreaTravel')}:${JSON.stringify(s.feedback)}`;
    if (force || fingerprint !== this.painted) {
      this.ctrl.requestUIUpdate({ type: 'region', hostId: AREA_MAP_REGION, reason: 'area-map-state' });
    }
    return true;
  }

  apply(): boolean {
    const s = this.session;
    if (!s) return false;
    const applied = reconcileAreaMapDOM(this.ctrl.root, createUIContext(this.ctrl.game), this.ctrl.panelState, s, this.ctrl.popovers, this.allowed('attemptAreaTravel'));
    if (applied) {
      this.painted = `${s.revision}:${s.selectedNodeId}:${s.submitting}:${this.allowed('attemptAreaTravel')}:${JSON.stringify(s.feedback)}`;
      this.bindViewport();
    }
    return applied;
  }

  private refreshLeft(): void {
    const c = this.ctrl;
    const current = c.root.querySelector<HTMLElement>('[data-workspace-frame="area-map"] [data-game-panel="left"] .panel-body');
    if (!current) return;
    const template = document.createElement('template');
    template.innerHTML = renderLeftPanel(createUIContext(c.game), c.panelState);
    const next = template.content.querySelector('.panel-body');
    if (!next || current.innerHTML === next.innerHTML) return;
    const scrollTop = current.scrollTop;
    c.popovers.dismissBeforeRootMutation(current);
    current.innerHTML = next.innerHTML;
    bindInventoryActions(c, current); bindEntityPresentationActions(c, current);
    current.scrollTop = scrollTop; c.popovers.retainIfAnchored();
  }

  /** Gate changes need not change Reveal stages, so keep the two entry controls current. */
  private refreshEntry(): void {
    const c = this.ctrl;
    if (!c.started || c.panelState.service !== 'game') return;
    const route = normalizeWorkspaceRoute(c.workspaceLocation().route);
    if (route.kind !== 'game' && route.kind !== 'area') return;
    const hero = c.root.querySelector<HTMLButtonElement>('[data-area-workspace-open]');
    if (!hero || hero.dataset.areaWorkspaceOpen !== c.game.state.currentAreaId) return;
    const allowed = this.allowed('openAreaMap');
    hero.disabled = !allowed;
    if (allowed) { hero.removeAttribute('aria-disabled'); hero.removeAttribute('title'); }
    else { hero.setAttribute('aria-disabled', 'true'); hero.title = '请先完成当前交互'; }
    let button = c.root.querySelector<HTMLButtonElement>('[data-area-map-open]');
    const entry = c.game.areaMap.getEntryView(c.game.state.currentAreaId!);
    if (!entry.ready) {
      if (button) { c.popovers.dismissBeforeRootMutation(button); button.remove(); c.popovers.retainIfAnchored(); }
      return;
    }
    if (!button) {
      button = document.createElement('button'); button.type = 'button'; button.className = 'area-map-entry';
      button.dataset.areaMapOpen = c.game.state.currentAreaId!; button.textContent = '区域地图';
      hero.closest('.area-hero')?.insertAdjacentElement('afterend', button);
    }
    button.disabled = !allowed || route.kind !== 'game';
    if (route.kind !== 'game') button.title = '请先返回游戏';
    else if (!allowed) button.title = '请先完成当前交互'; else button.removeAttribute('title');
  }

  bind(): void {
    if (!this.bound) {
      this.bound = true;
      this.ctrl.root.addEventListener('click', this.click, true);
      this.ctrl.root.addEventListener('keydown', this.keydown);
    }
    if (this.session) { this.apply(); this.bindViewport(); }
    else { this.releaseCamera?.(); this.releaseCamera = null; this.viewport = null; }
  }
  private bindViewport(): void {
    const svg = this.ctrl.root.querySelector<SVGSVGElement>('[data-area-map-viewport]');
    if (!svg || !this.session || svg === this.viewport) return;
    this.releaseCamera?.(); this.viewport = svg;
    this.releaseCamera = bindAreaMapCamera(svg, this.session, () => { this.suppressUntil = Date.now() + 150; });
  }
  destroy(): void {
    this.release();
    this.ctrl.root.removeEventListener('click', this.click, true);
    this.ctrl.root.removeEventListener('keydown', this.keydown); this.bound = false;
  }

  private click = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const open = target.closest<HTMLElement>('[data-area-map-open]');
    if (open) { event.preventDefault(); event.stopImmediatePropagation(); this.open(open.dataset.areaMapOpen!); return; }
    const node = target.closest<SVGElement>('[data-area-map-node]');
    const action = target.closest<HTMLElement>('[data-area-map-action]');
    const rail = target.closest<HTMLElement>('[data-area]');
    if (!node && !action && !(rail && this.session)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (Date.now() < this.suppressUntil || !target.isConnected || !target.closest('[data-workspace-frame="area-map"]')) return;
    if (node) this.select(node);
    else if (action) this.action(action.dataset.areaMapAction!, action);
    else if (rail && rail.getAttribute('aria-disabled') !== 'true') this.travelFromRail(rail.dataset.area!);
  };
  private keydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const node = event.target instanceof Element ? event.target.closest<SVGElement>('[data-area-map-node]') : null;
    if (node) { event.preventDefault(); this.select(node); }
  };

  private select(element: SVGElement): void {
    const s = this.session;
    if (!s || s.submitting || !this.allowed('openAreaMap') || element.dataset.areaMapId !== s.currentMapId || Number(element.dataset.areaMapRevision) !== s.revision) return;
    const fresh = this.ctrl.game.areaMap.getView(s.currentMapId);
    if (!fresh || fresh.revision !== s.view.revision) { this.refresh(true); return; }
    const node = fresh.nodes.find(node => node.id === element.dataset.areaMapNode);
    if (!node) return;
    s.selectedNodeId = node.id; s.feedback = null;
    if (node.actionKind === 'openMap') {
      const target = node.ready && node.action?.kind === 'openMap' ? this.ctrl.game.areaMap.getView(node.action.mapId) : null;
      if (target?.unlocked) openAreaMap(s, target);
      else s.feedback = { mapId: s.currentMapId, nodeId: node.id, text: areaMapReason(node.reason ?? 'Unavailable') };
    }
    this.refresh(true); this.ctrl.flushUIUpdates();
  }

  private action(action: string, element: HTMLElement): void {
    const s = this.session;
    if (!s) return;
    if (action === 'close') { this.close(); return; }
    if (s.submitting || !this.allowed('openAreaMap')) return;
    if (action === 'back') previousAreaMap(s, this.ctrl.game.areaMap);
    else if (action === 'current') {
      const entry = this.ctrl.game.areaMap.getEntryView(this.ctrl.game.state.currentAreaId!);
      const target = entry.ready ? this.ctrl.game.areaMap.getView(entry.mapId) : null;
      if (target?.unlocked) openAreaMap(s, target, true);
      else s.feedback = { mapId: s.currentMapId, nodeId: null, text: '当前区域地图不可用' };
    } else if (action === 'fit' || action === 'reset') {
      s.viewports.set(s.currentMapId, action === 'fit' ? fitAreaMap(s.view) : { scale: 1, x: 500, y: 350 });
      applyAreaMapCamera(this.ctrl.root, s); return;
    } else if (action === 'travel') { this.travel(element); return; }
    else return;
    this.refresh(true); this.ctrl.flushUIUpdates();
  }

  private travel(element: HTMLElement): void {
    const s = this.session;
    if (!s || !this.allowed('attemptAreaTravel') || element.dataset.areaMapTravelNode !== s.selectedNodeId ||
      element.dataset.areaMapId !== s.currentMapId || Number(element.dataset.areaMapRevision) !== s.revision) return;
    const fresh = this.ctrl.game.areaMap.getView(s.currentMapId);
    const node = fresh?.nodes.find(node => node.id === s.selectedNodeId);
    if (!fresh || fresh.revision !== s.view.revision || !node?.ready || node.action?.kind !== 'attemptAreaTravel') { this.refresh(true); return; }
    this.commitTravel(node.action.areaId, node.id);
  }
  private travelFromRail(areaId: string): void {
    if (!this.allowed('attemptAreaTravel')) return;
    this.commitTravel(areaId, null);
  }
  private commitTravel(areaId: string, nodeId: string | null): void {
    const s = this.session;
    if (!s || s.submitting) return;
    s.submitting = true;
    this.apply();
    try {
      const result = this.ctrl.commands.travelToArea(areaId);
      if (result.success) {
        this.ctrl.pendingTravelChats.push(`移动到了 ${this.ctrl.game.world.areas.get(result.areaId)?.name ?? '目标区域'}`);
        this.close(false); this.ctrl.scheduleRender();
      } else {
        s.feedback = { mapId: s.currentMapId, nodeId, text: areaMapReason(result.error) };
      }
    } finally {
      s.submitting = false;
      if (this.session === s) { this.refresh(true); this.ctrl.flushUIUpdates(); }
    }
  }
}
