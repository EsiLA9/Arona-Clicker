import type { AreaDef } from '../../data-services/contracts/world';
import type { AreaConnectionDef, AreaTransitNetworkDef } from '../../engine/contracts/affector';
import { existenceMet, unlockMet } from '../../engine/visibility/reveal';
import type { ConditionQueryPort } from '../contracts/condition-query';
import type { PlayerState } from '../types/state';

const indexes = new WeakMap<readonly string[], ReadonlySet<string>>();
export function progressHas(list: readonly string[] | undefined, id: string): boolean {
  if (!list) return false;
  let index = indexes.get(list);
  if (!index || index.size !== list.length) { index = new Set(list); indexes.set(list, index); }
  return index.has(id);
}

/** Snapshot of actual directed links. Transport groups stay implicit, O(V + E + memberships). */
export class AreaTravelGraph {
  readonly links = new Map<string, Set<string>>();
  readonly networksByArea = new Map<string, Set<AreaTransitNetworkDef>>();
  constructor(
    readonly areas: ReadonlyMap<string, AreaDef>,
    connections: readonly AreaConnectionDef[],
    networks: readonly AreaTransitNetworkDef[],
  ) {
    const add = (from: string, to: string) => {
      if (!areas.has(from) || !areas.has(to) || areas.get(from)!.initId !== areas.get(to)!.initId) return;
      const links = this.links.get(from) ?? new Set<string>(); links.add(to); this.links.set(from, links);
    };
    for (const area of areas.values()) for (const to of area.adjacentAreaIds ?? []) add(area.id, to);
    for (const link of connections) {
      add(link.fromAreaId, link.toAreaId);
      if (link.direction === 'twoWay') add(link.toAreaId, link.fromAreaId);
    }
    for (const network of networks) for (const id of network.areaIds) {
      if (!areas.has(id)) continue;
      const groups = this.networksByArea.get(id) ?? new Set(); groups.add(network); this.networksByArea.set(id, groups);
    }
  }
  neighbours(from: string): string[] {
    const targets = new Set(this.links.get(from));
    for (const network of this.networksByArea.get(from) ?? []) for (const id of network.areaIds) {
      if (id !== from && this.areas.get(id)?.initId === this.areas.get(from)?.initId) targets.add(id);
    }
    return [...targets];
  }
  hasConnection(from: string, to: string): boolean {
    if (from === to || !this.areas.has(from) || this.areas.get(from)?.initId !== this.areas.get(to)?.initId) return false;
    if (this.links.get(from)?.has(to)) return true;
    const targets = this.networksByArea.get(to);
    return [...this.networksByArea.get(from) ?? []].some(network => targets?.has(network));
  }
}

export type AreaTravelMethod = 'adjacent' | 'visited' | 'transit';

/** One traversal per query batch; never uses Map nodes/edges or persists route knowledge. */
export function buildAreaTravelRoutes(graph: AreaTravelGraph, state: PlayerState, conditions: ConditionQueryPort): ReadonlyMap<string, AreaTravelMethod> {
  const routes = new Map<string, AreaTravelMethod>();
  const current = state.currentAreaId;
  if (!current) return routes;
  const evaluate = (condition: Parameters<ConditionQueryPort['evaluateExpr']>[0]) => conditions.evaluateExpr(condition, state);
  const eligible = new Map<string, boolean>();
  const canEnter = (id: string) => {
    if (eligible.has(id)) return eligible.get(id)!;
    const area = graph.areas.get(id);
    const allowed = !!area && area.initId === state.activeInit && existenceMet(area.revealTriggers, evaluate) && unlockMet(area.revealTriggers, evaluate);
    eligible.set(id, allowed); return allowed;
  };
  const canPass = (id: string) => {
    const area = graph.areas.get(id)!;
    return progressHas(state.visitedAreas, id) && area.quickPassage !== false;
  };
  const queue = [current], queued = new Set(queue), expandedNetworks = new Set<AreaTransitNetworkDef>();
  const offer = (id: string, method: AreaTravelMethod) => {
    if (id === current || !canEnter(id)) return;
    if (!routes.has(id) || method === 'adjacent') routes.set(id, method);
    if (!queued.has(id) && canPass(id)) { queued.add(id); queue.push(id); }
  };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const from = queue[cursor];
    for (const to of graph.links.get(from) ?? []) {
      if (from === current || progressHas(state.visitedAreas, to)) offer(to, from === current ? 'adjacent' : 'visited');
    }
    for (const network of graph.networksByArea.get(from) ?? []) {
      if (expandedNetworks.has(network)) continue;
      expandedNetworks.add(network);
      for (const to of network.areaIds) offer(to, 'transit');
    }
  }
  return routes;
}
