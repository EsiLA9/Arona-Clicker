import type { AreaMapNodeAction, AreaMapNodeDef } from '../../../data-services/contracts/area-map';
import type { Registry } from '../../../data-services/registry/registry';
import type { RevealTrigger, RevealTarget } from '../../../engine/contracts/reveal';
import { existenceMet, unlockMet } from '../../../engine/visibility/reveal';
import type { PlayerState } from '../../types/state';
import type { ConditionQueryPort } from '../../contracts/runtime/condition-query';
import type { AreaMapEntryView, AreaMapNodeView, AreaMapQueryPort, AreaMapRevealView, AreaMapView } from '../../contracts/world/area-map-query';
import type { TravelResult } from '../../contracts/runtime/results';
import { progressHas } from './area-travel-routes';

interface Context {
  registry: () => Registry;
  state: () => PlayerState;
  conditions: () => ConditionQueryPort;
  travelStatus: (areaId: string) => TravelResult;
  travelQuery?: () => (areaId: string) => TravelResult;
  connections?: () => { hasConnection(from: string, to: string): boolean };
}

/** Current-map projection only: references are checked directly, never recursively expanded. */
export class AreaMapQuery implements AreaMapQueryPort {
  constructor(private readonly context: Context) {}

  private evaluate = (condition: NonNullable<RevealTrigger['condition']>): boolean =>
    this.context.conditions().evaluateExpr(condition, this.context.state());

  private info(triggers?: readonly RevealTrigger[]): AreaMapRevealView {
    const met = (target: RevealTarget) => {
      const list = triggers?.filter(t => t.reveal === target) ?? [];
      return !list.length || list.some(t => !t.condition || this.evaluate(t.condition));
    };
    return { nameKnown: met('name'), utilityKnown: met('utility'), conditionKnown: met('condition'), unlocked: unlockMet(triggers, this.evaluate) };
  }

  getEntryView(areaId: string): AreaMapEntryView {
    const mapId = this.context.registry().areas.get(areaId)?.navigationMapId;
    if (!mapId) return { ready: false, reason: 'NoEntry' };
    const view = this.getView(mapId);
    if (!view) return { ready: false, reason: 'Unavailable' };
    return view.unlocked ? { ready: true, mapId, name: view.name } : { ready: false, reason: 'Locked' };
  }

  getView(mapId: string): AreaMapView | null {
    const map = this.context.registry().areaMaps.get(mapId);
    if (!map || !existenceMet(map.revealTriggers, this.evaluate)) return null;
    const info = this.info(map.revealTriggers);
    const travelStatus = this.context.travelQuery?.() ?? this.context.travelStatus;
    const nodes = map.nodes.flatMap(node => {
      if (!existenceMet(node.revealTriggers, this.evaluate)) return [];
      return [this.projectNode(node, info.unlocked, travelStatus)];
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

  private projectNode(node: AreaMapNodeDef, mapUnlocked: boolean, travelStatus: (areaId: string) => TravelResult): AreaMapNodeView {
    const registry = this.context.registry();
    const info = this.info(node.revealTriggers);
    const action: AreaMapNodeAction = node.action ?? { kind: 'inspect' };
    const target = action.kind === 'openMap' ? registry.areaMaps.get(action.mapId)
      : action.kind === 'attemptAreaTravel' ? registry.areas.get(action.areaId) : undefined;
    const requiresTarget = action.kind !== 'inspect';
    const targetVisible = !requiresTarget || !!target && existenceMet(target.revealTriggers, this.evaluate);
    const targetInfo = target && targetVisible ? this.info(target.revealTriggers) : null;
    const targetUnlocked = !requiresTarget || !!targetInfo?.unlocked;
    const travel = action.kind === 'attemptAreaTravel' && targetVisible && targetUnlocked
      ? travelStatus(action.areaId) : null;
    const ready = mapUnlocked && info.unlocked && targetVisible && targetUnlocked && (!travel || travel.success);
    const reason = !targetVisible ? 'Unavailable' as const : !mapUnlocked || !info.unlocked || !targetUnlocked ? 'Locked' as const
      : travel && !travel.success ? travel.error : undefined;
    const conditions = info.conditionKnown && targetVisible
      ? [...(node.revealTriggers ?? []), ...(targetInfo?.conditionKnown ? target?.revealTriggers ?? [] : [])]
        .filter(trigger => trigger.reveal === 'unlock' && trigger.condition).map(trigger => structuredClone(trigger.condition!))
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
