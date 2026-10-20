import type { MapRunCardInstance, MapRunCardRef } from '../contracts/map-cards';
import type { MapRun } from '../contracts/map-run';
import type { GameplayBActionPreview } from './gameplay-b-action-preview-resolver';

/** Parse untrusted saved / commanded references into detached immutable values. */
export function parseMapRunCardRef(value: unknown): MapRunCardRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ref = value as Record<string, unknown>;
  if (ref.kind !== 'card' || typeof ref.id !== 'string' || !ref.id.trim()
    || !ref.scope || typeof ref.scope !== 'object' || Array.isArray(ref.scope)) return null;
  const scope = ref.scope as Record<string, unknown>;
  const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  if (!id(scope.runId) || !id(scope.mapId) || !id(scope.nodeId)
    || !(scope.activityId === null || id(scope.activityId))
    || typeof scope.round !== 'number' || !Number.isSafeInteger(scope.round) || scope.round < 1) return null;
  return Object.freeze({ kind: 'card', id: ref.id, scope: Object.freeze({
    runId: scope.runId, mapId: scope.mapId, nodeId: scope.nodeId, activityId: scope.activityId, round: scope.round,
  }) });
}

/** Identity comparison is independent of object property order and visual instance. */
export function mapRunCardKey(ref: MapRunCardRef): string {
  const scope = ref.scope;
  return JSON.stringify([scope.runId, scope.mapId, scope.nodeId, scope.activityId, scope.round, ref.kind, ref.id]);
}

/** Called only with the Owner's validated current snapshot and action preview. */
export function catalogMapRunCards(run: Pick<MapRun, 'runId' | 'mapId' | 'status' | 'activeEncounter'>,
  preview: Pick<GameplayBActionPreview, 'preparedActions'>
    & Partial<Pick<GameplayBActionPreview, 'preparedEnemyActions'>>): readonly MapRunCardInstance[] {
  const encounter = run.activeEncounter;
  if (!encounter || run.status !== 'inProgress') return Object.freeze([]);
  const scope = Object.freeze({ runId: run.runId, mapId: run.mapId, nodeId: encounter.nodeId,
    activityId: encounter.activityId ?? null, round: encounter.round });
  const cards: MapRunCardInstance[] = [];
  const append = (owner: MapRunCardInstance['owner'], zone: MapRunCardInstance['zone'], actionId: string | null,
    logicalIndex: number, prepared: boolean, controllable: boolean) => {
    const ref: MapRunCardRef = Object.freeze({ kind: 'card', scope, id: JSON.stringify([zone, owner.kind, owner.id, actionId]) });
    cards.push(Object.freeze({ ref, owner: Object.freeze(owner), zone, actionId, logicalIndex, prepared, controllable }));
  };
  for (const prepared of preview.preparedActions) {
    const owner = { kind: 'partyCharacter' as const, id: prepared.characterId };
    prepared.handActionIds.forEach((actionId, index) => {
      append(owner, 'hand', actionId, index, actionId === prepared.preparedActionId, true);
    });
    if (prepared.overrideKind === 'playerCommand' && prepared.preparedActionId !== null) {
      append(owner, 'playerCommand', prepared.preparedActionId, prepared.handActionIds.length, true, true);
    }
  }
  for (const prepared of preview.preparedEnemyActions ?? []) {
    const owner = { kind: 'enemy' as const, id: prepared.enemyId };
    prepared.handActionIds.forEach((actionId, index) => {
      append(owner, 'hand', actionId, index, actionId === prepared.naturalActionId, false);
    });
  }
  for (const [index, enemy] of encounter.enemies.entries()) {
    if (enemy.currentHp > 0) append({ kind: 'enemy', id: enemy.enemyId }, 'enemyIntent', null, index, true, false);
  }
  return Object.freeze(cards);
}
