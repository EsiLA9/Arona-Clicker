import type { AreaMapNodeAction, AreaMapNodeDef } from '../../../data-services/contracts/area-map';
import type { Registry } from '../../../data-services/registry/registry';
import type { PlayerState } from '../../types/state';
import type { Condition, ConditionGroup } from '../../../engine/types/expression';
import type { ConditionQueryPort } from '../../contracts/runtime/condition-query';
import type { AreaMapCollectionEntry, AreaMapEntryView, AreaMapNodeView, AreaMapQueryPort, AreaMapRevealView, AreaMapView } from '../../contracts/world/area-map-query';
import type { TravelResult } from '../../contracts/runtime/results';
import { progressHas } from './area-travel-routes';
import { queryInformationReveal } from './information-reveal-domain';
import { worldInformationRule } from './information-reveal-domain';

interface Context {
  registry: () => Registry;
  state: () => PlayerState;
  observedMapIds?: () => readonly string[];
  conditions: () => ConditionQueryPort;
  travelStatus: (areaId: string) => TravelResult;
  travelQuery?: () => (areaId: string) => TravelResult;
  connections?: () => { hasConnection(from: string, to: string): boolean };
}

/** Current-map projection only: references are checked directly, never recursively expanded. */
export class AreaMapQuery implements AreaMapQueryPort {
  constructor(private readonly context: Context) {}

  private evaluate = (condition: Condition | ConditionGroup): boolean =>
    this.context.conditions().evaluateExpr(condition, this.context.state());

  private known(key: Parameters<typeof queryInformationReveal>[2]): boolean {
    const state = this.context.state(), registry = this.context.registry();
    const status = queryInformationReveal(registry, state, key, state.activeInit, {}, new Set(this.context.observedMapIds?.() ?? [])).status;
    if ((key.entityKind === 'areaMap' || key.entityKind === 'areaMapNode') && status === 'unresolved'
      && !worldInformationRule(registry, key)) return true;
    return status === 'known-no-gate' || status === 'known-progress';
  }

  private mapInfo(mapId: string): AreaMapRevealView {
    return {
      existenceKnown: this.known({ entityKind: 'areaMap', entityId: mapId, target: 'existence' }),
      nameKnown: this.known({ entityKind: 'areaMap', entityId: mapId, target: 'name' }),
      utilityKnown: this.known({ entityKind: 'areaMap', entityId: mapId, target: 'utility' }),
      conditionKnown: this.known({ entityKind: 'areaMap', entityId: mapId, target: 'condition' }),
    };
  }

  getAreaInfo(areaId: string): AreaMapRevealView {
    return {
      existenceKnown: this.known({ entityKind: 'area', entityId: areaId, target: 'existence' }),
      nameKnown: this.known({ entityKind: 'area', entityId: areaId, target: 'name' }),
      utilityKnown: this.known({ entityKind: 'area', entityId: areaId, target: 'utility' }),
      conditionKnown: this.known({ entityKind: 'area', entityId: areaId, target: 'condition' }),
    };
  }

  private nodeInfo(mapId: string, nodeId: string): AreaMapRevealView {
    return {
      existenceKnown: this.known({ entityKind: 'areaMapNode', mapId, nodeId, target: 'existence' }),
      nameKnown: this.known({ entityKind: 'areaMapNode', mapId, nodeId, target: 'name' }),
      utilityKnown: this.known({ entityKind: 'areaMapNode', mapId, nodeId, target: 'utility' }),
      conditionKnown: this.known({ entityKind: 'areaMapNode', mapId, nodeId, target: 'condition' }),
    };
  }

  private canOpenMap(mapId: string): boolean {
    const map = this.context.registry().areaMaps.get(mapId);
    return !!map && (!map.openCondition || this.evaluate(map.openCondition));
  }

  getCollectedMapEntries(): readonly AreaMapCollectionEntry[] {
    const state = this.context.state(), registry = this.context.registry();
    return (state.collectedAreaMapIds ?? []).map(mapId => {
      const map = registry.areaMaps.get(mapId);
      if (!map) return { name: '不可用地图', available: false };
      const info = this.mapInfo(mapId);
      return {
        name: info.nameKnown ? map.name : '未知地图',
        available: info.existenceKnown && this.canOpenMap(mapId),
      };
    });
  }

  getEntryView(areaId: string): AreaMapEntryView {
    const mapId = this.context.registry().areas.get(areaId)?.navigationMapId;
    if (!mapId) return { ready: false, reason: 'NoEntry' };
    const map = this.context.registry().areaMaps.get(mapId);
    if (!map || !this.mapInfo(mapId).existenceKnown) return { ready: false, reason: 'Unavailable' };
    if (!this.canOpenMap(mapId)) return { ready: false, reason: 'Locked' };
    return { ready: true, mapId, name: this.mapInfo(mapId).nameKnown ? map.name : '未知地图' };
  }

  getView(mapId: string): AreaMapView | null {
    const map = this.context.registry().areaMaps.get(mapId);
    if (!map) return null;
    const info = this.mapInfo(mapId);
    if (!info.existenceKnown || !this.canOpenMap(mapId)) return null;
    const travelStatus = this.context.travelQuery?.() ?? this.context.travelStatus;
    const nodes = map.nodes.flatMap(node => {
      if (!this.nodeInfo(mapId, node.id).existenceKnown) return [];
      return [this.projectNode(mapId, node, travelStatus)];
    });
    const visible = new Map(nodes.map(node => [node.id, node]));
    const graph = this.context.connections?.();
    const edges = map.edges.flatMap(edge => {
      const from = visible.get(edge.fromNodeId)?.action, to = visible.get(edge.toNodeId)?.action;
      if (from?.kind !== 'attemptAreaTravel' || to?.kind !== 'attemptAreaTravel') return [];
      const forward = graph?.hasConnection(from.areaId, to.areaId) ?? false;
      const reverse = graph?.hasConnection(to.areaId, from.areaId) ?? false;
      if (forward && reverse) return [{ ...edge }];
      if (forward) return [{ ...edge, directed: true }];
      if (reverse) return [{ fromNodeId: edge.toNodeId, toNodeId: edge.fromNodeId, directed: true }];
      return [];
    });
    const projected = {
      id: map.id, ...info, name: info.nameKnown ? map.name : '未知地图',
      ...(info.utilityKnown && map.description ? { description: map.description } : {}),
      nodes, edges,
    };
    return { ...projected, revision: JSON.stringify(projected) };
  }

  getNodeView(mapId: string, nodeId: string): AreaMapNodeView | null {
    return this.getView(mapId)?.nodes.find(node => node.id === nodeId) ?? null;
  }

  private projectNode(mapId: string, node: AreaMapNodeDef, travelStatus: (areaId: string) => TravelResult): AreaMapNodeView {
    const registry = this.context.registry();
    const info = this.nodeInfo(mapId, node.id);
    const action: AreaMapNodeAction = node.action ?? { kind: 'inspect' };
    const target = action.kind === 'openMap' ? registry.areaMaps.get(action.mapId)
      : action.kind === 'attemptAreaTravel' ? registry.areas.get(action.areaId) : undefined;
    const requiresTarget = action.kind !== 'inspect';
    const targetInfo = action.kind === 'openMap' ? this.mapInfo(action.mapId)
      : action.kind === 'attemptAreaTravel' ? this.getAreaInfo(action.areaId) : null;
    const targetExists = !requiresTarget || !!target;
    const mapExistenceRule = action.kind === 'openMap' ? worldInformationRule(registry, { entityKind: 'areaMap', entityId: action.mapId, target: 'existence' }) : undefined;
    const targetExistenceKnown = !requiresTarget || (action.kind === 'openMap'
      ? targetExists && (targetInfo?.existenceKnown || !mapExistenceRule
        || mapExistenceRule.mode === 'condition' && this.evaluate(mapExistenceRule.condition))
      : targetExists && !!targetInfo?.existenceKnown);
    const targetVisible = targetExists && targetExistenceKnown;
    const actionAllowed = !node.actionCondition || this.evaluate(node.actionCondition);
    const travel = action.kind === 'attemptAreaTravel' && targetVisible ? travelStatus(action.areaId) : null;
    const targetAllowed = action.kind === 'openMap' ? this.canOpenMap(action.mapId) : !travel || travel.success;
    const ready = actionAllowed && targetVisible && targetAllowed;
    const reason = !targetVisible ? 'Unavailable' as const : !actionAllowed || !targetAllowed
      ? travel && !travel.success ? travel.error : 'Locked' as const : travel && !travel.success ? travel.error : undefined;
    const targetCondition = action.kind === 'openMap' ? registry.areaMaps.get(action.mapId)?.openCondition
      : action.kind === 'attemptAreaTravel' ? registry.areas.get(action.areaId)?.enterCondition : undefined;
    const conditions = info.conditionKnown && targetVisible && targetInfo?.conditionKnown
      ? [node.actionCondition, targetCondition].filter((condition): condition is NonNullable<typeof condition> => !!condition).map(condition => structuredClone(condition))
      : [];
    return {
      id: node.id, ...info,
      name: info.nameKnown ? node.name ?? (targetVisible && targetInfo?.nameKnown ? target?.name : undefined) ?? '未命名节点' : '未知节点',
      ...(info.utilityKnown && (node.description || targetVisible && targetInfo?.utilityKnown && target?.description)
        ? { description: node.description ?? target!.description } : {}),
      position: { ...node.position },
      appearance: { kind: node.appearance?.kind ?? 'point', ...(info.utilityKnown && node.appearance?.iconPicId ? { iconPicId: node.appearance.iconPicId } : {}) },
      actionKind: action.kind, action: targetVisible ? { ...action } : null, ready,
      ...(action.kind === 'attemptAreaTravel' && targetVisible ? {
        current: this.context.state().currentAreaId === action.areaId,
        visited: progressHas(this.context.state().visitedAreas, action.areaId),
        ...(travel?.success && travel.method ? { travelMethod: travel.method } : {}),
      } : {}),
      ...(reason ? { reason } : {}), ...(conditions.length ? { conditions } : {}),
    };
  }
}
