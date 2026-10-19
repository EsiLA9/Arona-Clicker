import type { GameplayMapActionDef, GameplayMapDef } from '../../data-services/contracts/gameplay-map';
import type { MapRunCardRef } from '../contracts/map-cards';
import type { MapRunActionOverride } from '../contracts/map-run';
import { parseMapRunCardRef } from './map-card-catalog';

export interface MapCardActionChoice {
  readonly characterId: string;
  readonly actionId: string | null;
  readonly overrideKind: MapRunActionOverride['kind'] | null;
  readonly targetCard?: MapRunCardRef | null;
}

export interface MapScostCost {
  readonly original: number;
  readonly discount: number;
  readonly paid: number;
}

/** Actual cost description, after all round-local reductions are combined. */
export function mapScostCost(action: GameplayMapActionDef, reduction = 0n): MapScostCost | null {
  const original = (action.costs ?? []).filter(cost => cost.scope === 'actor' && cost.resourceId === 'sCost')
    .reduce((sum, cost) => sum + BigInt(cost.amount), 0n);
  if (original === 0n) return null;
  if (original < 0n || original > BigInt(Number.MAX_SAFE_INTEGER) || reduction < 0n) throw new Error('Invalid scost cost');
  const discount = reduction < original ? reduction : original;
  return Object.freeze({ original: Number(original), discount: Number(discount), paid: Number(original - discount) });
}

/** Validate card relationships and stage reductions, without granting resources or executing actions. */
export function resolveMapCardEffects(definition: GameplayMapDef, scope: MapRunCardRef['scope'], choices: readonly MapCardActionChoice[]): {
  readonly targets: ReadonlyMap<string, MapRunCardRef>;
  readonly reductions: ReadonlyMap<string, bigint>;
} {
  const actions = new Map((definition.actions ?? []).map(action => [action.id, action]));
  const node = definition.nodes.find(row => row.id === scope.nodeId);
  const encounter = scope.activityId === null ? node?.encounter : node?.activities?.find(row => row.id === scope.activityId)?.encounter;
  if (!encounter || scope.mapId !== definition.id) throw new Error('Card effects require their actual Encounter');
  const active = new Map<string, string>();
  const seen = new Set<string>();
  for (const choice of choices) {
    if (!choice || typeof choice.characterId !== 'string' || seen.has(choice.characterId)) throw new Error('Invalid card effect source');
    seen.add(choice.characterId);
    if (choice.actionId === null) continue;
    active.set(JSON.stringify([choice.overrideKind === 'playerCommand' ? 'playerCommand' : 'hand', 'partyCharacter', choice.characterId, choice.actionId]), choice.characterId);
  }
  const targets = new Map<string, MapRunCardRef>();
  const reductions = new Map<string, bigint>();
  for (const choice of choices) {
    const action = choice.actionId === null ? null : actions.get(choice.actionId);
    if (action?.target.kind !== 'card') {
      if (choice.targetCard != null || (action?.cardEffects?.length ?? 0) > 0) throw new Error('Unexpected card target or effect');
      continue;
    }
    const target = parseMapRunCardRef(choice.targetCard);
    if (!target || Object.keys(scope).some(key => target.scope[key as keyof typeof scope] !== scope[key as keyof typeof scope])) {
      throw new Error('Card target belongs to another scene or round');
    }
    let identity: unknown;
    try { identity = JSON.parse(target.id); } catch { throw new Error('Invalid domain card identity'); }
    if (!Array.isArray(identity) || identity.length !== 4 || JSON.stringify(identity) !== target.id
      || !['hand', 'playerCommand'].includes(identity[0]) || identity[1] !== 'partyCharacter'
      || typeof identity[2] !== 'string' || typeof identity[3] !== 'string') throw new Error('Invalid scost target identity');
    const [, , ownerId, actionId] = identity as string[];
    const targetAction = actions.get(actionId);
    const candidates = encounter.participants?.find(row => row.characterId === ownerId)?.actions ?? [];
    const targetCost = targetAction ? mapScostCost(targetAction) : null;
    if (!definition.partyCharacterIds.includes(ownerId) || !targetAction?.eligibleCharacterIds.includes(ownerId)
      || !candidates.some(row => row.actionId === actionId) || !targetCost
      || (action.target.side === 'self' && ownerId !== choice.characterId)
      || action.target.side === 'opponent') throw new Error('Card effect target is not an eligible scost card');
    if (!action.cardEffects?.length) throw new Error('Card target has no declared effect');
    let reduction = 0n;
    for (const effect of action.cardEffects) {
      if (effect.kind !== 'scostDiscount' || !Number.isSafeInteger(effect.amount) || effect.amount <= 0) throw new Error('Invalid scost discount');
      reduction += BigInt(effect.amount);
    }
    targets.set(choice.characterId, target);
    const receiver = active.get(target.id);
    if (receiver) reductions.set(receiver, (reductions.get(receiver) ?? 0n) + reduction);
  }
  return { targets, reductions };
}
