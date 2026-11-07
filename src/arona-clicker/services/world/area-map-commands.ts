import type { Registry } from '../../../data-services/registry/registry';
import type { AreaMapOpenResult, AreaMapQueryPort } from '../../contracts/world/area-map-query';
import type { PlayerState } from '../../types/state';
import type { StateMutationService } from '../../state/state-mutation-service';
import type { ConditionSystem } from '../../../engine/expression/condition-system';
import type { InformationRevealAdapter } from './information-reveal-adapter';

interface Context {
  readonly registry: Registry;
  readonly getState: () => PlayerState;
  readonly conditions: ConditionSystem;
  readonly query: AreaMapQueryPort;
  readonly mutations: StateMutationService;
  readonly informationReveal: InformationRevealAdapter;
  readonly setObservedMapIds: (mapIds: readonly string[]) => void;
}

/** Commands for opening authored navigation maps and collecting them after a successful open. */
export class AreaMapCommandService {
  private readonly authorizedCollections = new Set<string>();
  private observedMapIds: string[] = [];

  constructor(private readonly context: Context) {
    context.mutations.setAreaMapCollectionValidator((_state, mapId) =>
      this.authorizedCollections.has(mapId) && context.registry.areaMaps.has(mapId));
    context.mutations.setAreaMapAcquisitionHandler(mapId => this.grantAreaMap(mapId));
  }

  grantAreaMap(mapId: string): boolean {
    if (!this.context.registry.areaMaps.has(mapId)) return false;
    this.authorizedCollections.add(mapId);
    try { return this.context.mutations.collectAreaMap(mapId); }
    finally { this.authorizedCollections.delete(mapId); }
  }

  openFromArea(areaId: string): AreaMapOpenResult {
    const state = this.context.getState();
    if (state.currentAreaId !== areaId) return { success: false, error: 'Unavailable' };
    const mapId = this.context.registry.areas.get(areaId)?.navigationMapId;
    if (!mapId) return { success: false, error: 'NoEntry' };
    if (!this.canBrowse(mapId, state)) return { success: false, error: 'Locked' };
    const openingScope = [...new Set([...this.observedMapIds, mapId])];
    this.observedMapIds = openingScope;
    this.context.setObservedMapIds(this.observedMapIds);
    this.preserveOpeningScope(openingScope);
    if (!this.context.informationReveal.observeAreaMapOnOpen(mapId)) return { success: false, error: 'Unavailable' };
    this.preserveOpeningScope(openingScope);
    const entry = this.context.query.getEntryView(areaId);
    if (!entry.ready) return { success: false, error: entry.reason };
    if (!this.context.query.getView(mapId)) return { success: false, error: 'Unavailable' };
    return { success: true, mapId, collected: this.collectOnOpen(mapId) };
  }

  openCollectedMap(index: number): AreaMapOpenResult {
    const state = this.context.getState();
    const mapId = Number.isInteger(index) && index >= 0 ? state.collectedAreaMapIds?.[index] : undefined;
    if (!mapId || !state.collectedAreaMapIds?.includes(mapId)) return { success: false, error: 'Unavailable' };
    if (!this.canBrowse(mapId, state)) return { success: false, error: 'Locked' };
    const openingScope = [...new Set([...this.observedMapIds, mapId])];
    this.observedMapIds = openingScope;
    this.context.setObservedMapIds(openingScope);
    this.preserveOpeningScope(openingScope);
    if (!this.context.informationReveal.observeAreaMapOnOpen(mapId)) return { success: false, error: 'Unavailable' };
    this.preserveOpeningScope(openingScope);
    if (!this.context.query.getView(mapId)) return { success: false, error: 'Unavailable' };
    return { success: true, mapId, collected: false };
  }

  openFromNode(sourceMapId: string, nodeId: string): AreaMapOpenResult {
    const state = this.context.getState();
    const sourceAllowed = state.collectedAreaMapIds?.includes(sourceMapId)
      || this.context.registry.areas.get(state.currentAreaId ?? '')?.navigationMapId === sourceMapId;
    const sourceNode = this.context.query.getNodeView(sourceMapId, nodeId);
    if (!sourceAllowed || !sourceNode?.ready || sourceNode.action?.kind !== 'openMap') return { success: false, error: 'Unavailable' };
    const mapId = sourceNode.action.mapId;
    if (!this.canBrowse(mapId, state)) return { success: false, error: 'Locked' };
    const openingScope = [...new Set([...this.observedMapIds, sourceMapId, mapId])];
    this.observedMapIds = openingScope;
    this.context.setObservedMapIds(this.observedMapIds);
    this.preserveOpeningScope(openingScope);
    if (!this.context.informationReveal.observeAreaMapOnOpen(mapId)) return { success: false, error: 'Unavailable' };
    this.preserveOpeningScope(openingScope);
    if (!this.context.query.getView(mapId)) return { success: false, error: 'Unavailable' };
    return { success: true, mapId, collected: this.collectOnOpen(mapId) };
  }

  observeSessionMaps(mapIds: readonly string[]): void {
    this.observedMapIds = [...new Set(mapIds.filter(id => this.context.registry.areaMaps.has(id)))];
    this.context.setObservedMapIds(this.observedMapIds);
  }

  closeSession(): void {
    this.observedMapIds = [];
    this.context.setObservedMapIds([]);
  }

  private canBrowse(mapId: string, state: PlayerState): boolean {
    const map = this.context.registry.areaMaps.get(mapId);
    return !!map && (!map.openCondition || this.context.conditions.evaluateExpr(map.openCondition, state));
  }

  private collectOnOpen(mapId: string): boolean {
    const map = this.context.registry.areaMaps.get(mapId);
    if (!map || map.collection === 'explicit' || this.context.getState().collectedAreaMapIds?.includes(mapId)) return false;
    this.authorizedCollections.add(mapId);
    try { return this.context.mutations.collectAreaMap(mapId); }
    finally { this.authorizedCollections.delete(mapId); }
  }

  private preserveOpeningScope(openingScope: readonly string[]): void {
    this.observedMapIds = [...new Set([...this.observedMapIds, ...openingScope])];
    this.context.setObservedMapIds(this.observedMapIds);
  }
}
