import type { MapActionRelation, MapRelationScope, MapTargetRef, MapUnitRef } from '../../arona-clicker/contracts/map-relations';

/** Visual copies share this key; it never creates an additional domain object. */
export function mapUnitKey(scope: MapRelationScope, kind: MapUnitRef['kind'], id: string): string {
  return mapObjectKey({ scope, kind, id });
}

export function mapObjectKey(ref: MapTargetRef): string {
  const { scope } = ref;
  return JSON.stringify([scope.runId, scope.mapId, scope.nodeId, scope.activityId, scope.round, ref.kind, ref.id]);
}

/** Attribute-only presentation patch. Callers own the interaction priority. */
export function presentMapRelations(root: HTMLElement, relations: readonly MapActionRelation[], showCandidates = false): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-map-role-source], [data-map-role-recipient], [data-map-role-candidate]')) {
    delete node.dataset.mapRoleSource;
    delete node.dataset.mapRoleRecipient;
    delete node.dataset.mapRoleCandidate;
  }
  const instances = [...root.querySelectorAll<HTMLElement>('[data-map-object-key], [data-map-relation-key]')];
  for (const relation of relations) {
    const targetKey = relation.selectedTarget
      ? mapObjectKey(relation.selectedTarget) : null;
    const candidates = new Set(showCandidates && relation.selectionMode === 'selectable'
      ? relation.candidates.map(mapObjectKey) : []);
    for (const node of instances) {
      if (node.dataset.mapRelationKey === relation.key) node.dataset.mapRoleSource = '发起';
      if (targetKey !== null && node.dataset.mapObjectKey === targetKey) node.dataset.mapRoleRecipient = '接收';
      else if (node.dataset.mapObjectKey && candidates.has(node.dataset.mapObjectKey)) node.dataset.mapRoleCandidate = '候选';
    }
  }
}
