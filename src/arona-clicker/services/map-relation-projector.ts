import type { GameplayMapDef } from '../../data-services/contracts/gameplay-map';
import type { MapRunActiveWorkspaceView } from '../contracts/runtime';
import type { MapActionRelation, MapEffectRecipient, MapRelationScope, MapRelationSource, MapTargetRef, MapUnitRef } from '../contracts/map-relations';

type RelationInput = Pick<MapRunActiveWorkspaceView, 'run' | 'currentEncounter' | 'actionPreview' | 'sourcePreview'>;

/** Consumes Owner-approved targets. Does not pick targets, draw cards or settle effects. */
export function projectMapRelations(view: RelationInput, definition: GameplayMapDef): readonly MapActionRelation[] {
  const { run, actionPreview: preview } = view;
  if (!preview || !run.activeEncounter) return Object.freeze([]);
  const scope: MapRelationScope = Object.freeze({
    runId: run.runId, mapId: run.mapId, nodeId: preview.nodeId,
    activityId: preview.draft.activityId ?? null, round: preview.round,
  });
  const draft = Object.freeze({ ...preview.draft });
  const unit = (kind: MapUnitRef['kind'], id: string): MapUnitRef => Object.freeze({ scope, kind, id });
  const actions = new Map((definition.actions ?? []).map(action => [action.id, action]));
  const relations: MapActionRelation[] = [];
  function append(
    source: MapRelationSource, selectedTarget: MapTargetRef | null,
    candidates: readonly MapTargetRef[], targetState: MapActionRelation['targetState'],
    selectionMode: MapActionRelation['selectionMode'], canReplaceAction: boolean,
    enemyDamage?: number,
  ): void {
    const action = source.actionId === null ? undefined : actions.get(source.actionId);
    const effects: MapEffectRecipient[] = (action?.hpEffects ?? []).map(effect => Object.freeze({
      kind: 'hp' as const, resourceId: null, amount: effect.amount, recipient: selectedTarget,
    }));
    for (const effect of action?.effects ?? []) {
      effects.push(Object.freeze({
        kind: 'resource', resourceId: effect.resourceId, amount: effect.amount,
        recipient: effect.scope === 'team' ? Object.freeze({ kind: 'team' as const, scope })
          : effect.recipient === 'target' ? selectedTarget : source.performer,
      }));
    }
    for (const effect of action?.cardEffects ?? []) effects.push(Object.freeze({
      kind: 'cardCost', resourceId: 'sCost', amount: -effect.amount, recipient: selectedTarget,
    }));
    if (enemyDamage !== undefined) effects.push(Object.freeze({
      kind: 'hp', resourceId: null, amount: -enemyDamage, recipient: null,
    }));
    relations.push(Object.freeze({
      key: JSON.stringify([scope.runId, scope.mapId, scope.nodeId, scope.activityId, scope.round, source.kind, source.id, source.actionId]),
      scope, draft, phase: 'preparation', visibility: 'public', source: Object.freeze(source),
      selectedTarget, candidates: Object.freeze([...candidates]), targetState, selectionMode,
      canSelectTarget: source.kind !== 'enemy' && selectionMode === 'selectable' && candidates.length > 1,
      canReplaceAction, effectRecipients: Object.freeze(effects),
    }));
  }
  for (const prepared of preview.preparedActions) {
    const action = prepared.preparedAction;
    if (!action) continue; // Wait does not invent an action source.
    const performer = unit('partyCharacter', prepared.characterId);
    const selected = prepared.targetCard ?? (prepared.targetEnemyId !== null ? unit('enemy', prepared.targetEnemyId)
      : prepared.targetCharacterId !== null ? unit('partyCharacter', prepared.targetCharacterId) : null);
    const candidates = [
      ...prepared.legalTargetCharacterIds.map(id => unit('partyCharacter', id)),
      ...prepared.legalTargetEnemyIds.map(id => unit('enemy', id)),
      ...(prepared.legalTargetCards ?? []),
    ];
    const replaceable = prepared.hand.some(candidate => candidate.actionId !== action.actionId)
      || preview.playerCommandOptions.some(option => option.characterId === prepared.characterId
        && option.action.actionId !== action.actionId && option.canPayPlayerCost && option.canPayActionCosts);
    append({ kind: 'preparedAction', id: prepared.characterId, actionId: action.actionId, performer },
      selected, candidates, prepared.targetKind === 'none' ? 'none' : selected ? 'determined' : 'pending',
      prepared.targetKind === 'none' ? 'none' : prepared.targetKind === 'self' ? 'self' : 'selectable', replaceable);
  }
  const sources = view.sourcePreview;
  if (sources) {
    for (const kind of ['ability', 'item'] as const) {
      const actionId = kind === 'ability' ? sources.selectedAbilityActionId
        : sources.itemOptions.find(option => option.itemId === sources.selectedItemId)?.actionId;
      if (!actionId) continue;
      const option = (kind === 'ability' ? sources.abilityOptions : sources.itemOptions).find(row => row.actionId === actionId);
      if (!option) continue;
      const target = kind === 'ability' ? sources.selectedAbilityTarget : sources.selectedItemTarget;
      const selected = target === null ? null : target.kind === 'enemy'
        ? unit('enemy', target.enemyId) : unit('partyCharacter', target.characterId);
      append({ kind, id: kind === 'item' ? sources.selectedItemId! : actionId, actionId, performer: null }, selected,
        [...option.legalTargetCharacterIds.map(id => unit('partyCharacter', id)), ...option.legalTargetEnemyIds.map(id => unit('enemy', id))],
        selected ? 'determined' : 'pending', 'selectable', false);
    }
  }
  for (const enemy of view.currentEncounter?.enemies ?? []) {
    if (enemy.currentHp <= 0) continue;
    append({ kind: 'enemy', id: enemy.enemyId, actionId: null, performer: unit('enemy', enemy.enemyId) },
      null, [], 'unknown', 'rule', false, enemy.damage);
  }
  return Object.freeze(relations);
}
