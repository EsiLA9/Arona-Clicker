import type { GameplayMapActionDef, GameplayMapDef } from '../../data-services/contracts/gameplay-map';
import type { MapRunCardRef } from '../contracts/map-cards';
import type { MapRunActionOverride } from '../contracts/map-run';
import { parseMapRunCardRef } from './map-card-catalog';
import { normalizeMapActionEffects } from '../../data-services/normalization/gameplay-map-effect-program';
import { planMapEffectSource } from './map-effect-planner';

export type MapCardActionChoice = ({
  readonly characterId: string;
  readonly enemyId?: never;
} | {
  readonly enemyId: string;
  readonly characterId?: never;
}) & {
  readonly actionId: string | null;
  readonly overrideKind: MapRunActionOverride['kind'] | null;
  readonly targetCard?: MapRunCardRef | null;
};

export function mapCardActorKey(ownerKind: 'partyCharacter' | 'enemy', ownerId: string): string {
  return ownerKind === 'partyCharacter' ? ownerId : JSON.stringify(['enemy', ownerId]);
}

export interface MapScostCost {
  readonly original: number;
  readonly discount: number;
  readonly paid: number;
}

/** Pure prepare work description for the authoritative MapRun planner to account once. */
export interface MapCardPrepareMetadata {
  readonly sourceKey: string;
  readonly source: { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string };
  readonly actionId: string;
  readonly effectPath: string;
  readonly leaf: {
    readonly op: 'discountSCost';
    readonly amount: number;
    readonly mode: 'legacy' | 'program';
  };
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
export function resolveMapCardEffects(
  definition: GameplayMapDef,
  scope: MapRunCardRef['scope'],
  choices: readonly MapCardActionChoice[],
  activeChoices: readonly MapCardActionChoice[] = choices,
): {
  readonly targets: ReadonlyMap<string, MapRunCardRef>;
  readonly reductions: ReadonlyMap<string, bigint>;
  readonly prepareMetadata: readonly MapCardPrepareMetadata[];
} {
  const actions = new Map((definition.actions ?? []).map(action => [action.id, action]));
  const node = definition.nodes.find(row => row.id === scope.nodeId);
  const encounter = scope.activityId === null ? node?.encounter : node?.activities?.find(row => row.id === scope.activityId)?.encounter;
  if (!encounter || scope.mapId !== definition.id) throw new Error('Card effects require their actual Encounter');
  const active = new Map<string, string>();
  const seenActive = new Set<string>();
  for (const choice of activeChoices) {
    if (!choice) throw new Error('Invalid card effect source');
    const ownerKind = typeof choice.enemyId === 'string' ? 'enemy' : 'partyCharacter';
    const ownerId = ownerKind === 'enemy' ? choice.enemyId! : choice.characterId!;
    if (typeof ownerId !== 'string' || seenActive.has(mapCardActorKey(ownerKind, ownerId))) throw new Error('Invalid card effect source');
    const sourceKey = mapCardActorKey(ownerKind, ownerId);
    seenActive.add(sourceKey);
    if (choice.actionId === null) continue;
    active.set(JSON.stringify([choice.overrideKind === 'playerCommand' ? 'playerCommand' : 'hand', ownerKind, ownerId, choice.actionId]), sourceKey);
  }
  const targets = new Map<string, MapRunCardRef>();
  const reductions = new Map<string, bigint>();
  const prepareMetadata: MapCardPrepareMetadata[] = [];
  const seenSources = new Set<string>();
  for (const choice of choices) {
    if (!choice) throw new Error('Invalid card effect source');
    const ownerKind = typeof choice.enemyId === 'string' ? 'enemy' : 'partyCharacter';
    const ownerId = ownerKind === 'enemy' ? choice.enemyId! : choice.characterId!;
    const sourceKey = mapCardActorKey(ownerKind, ownerId);
    if (seenSources.has(sourceKey)) throw new Error('Invalid card effect source');
    seenSources.add(sourceKey);
    const action = choice.actionId === null ? null : actions.get(choice.actionId);
    const actionEffects = action ? normalizeMapActionEffects(action) : null;
    if (action?.target.kind !== 'card') {
      if (choice.targetCard != null || (actionEffects?.prepare.length ?? 0) > 0) throw new Error('Unexpected card target or effect');
      continue;
    }
    const target = parseMapRunCardRef(choice.targetCard);
    if (!target || Object.keys(scope).some(key => target.scope[key as keyof typeof scope] !== scope[key as keyof typeof scope])) {
      throw new Error('Card target belongs to another scene or round');
    }
    let identity: unknown;
    try { identity = JSON.parse(target.id); } catch { throw new Error('Invalid domain card identity'); }
    if (!Array.isArray(identity) || identity.length !== 4 || JSON.stringify(identity) !== target.id
      || !['hand', 'playerCommand'].includes(identity[0]) || !['partyCharacter', 'enemy'].includes(identity[1])
      || typeof identity[2] !== 'string' || typeof identity[3] !== 'string') throw new Error('Invalid scost target identity');
    const [, rawOwnerKind, targetOwnerId, actionId] = identity as string[];
    const targetOwnerKind = rawOwnerKind as 'partyCharacter' | 'enemy';
    const targetAction = actions.get(actionId);
    const partyCandidates = targetOwnerKind === 'partyCharacter'
      ? encounter.participants?.find(row => row.characterId === targetOwnerId)?.actions ?? []
      : [];
    const enemyCandidates = targetOwnerKind === 'enemy'
      ? encounter.enemies?.find(row => row.id === targetOwnerId)?.actions ?? []
      : [];
    const targetCost = targetAction ? mapScostCost(targetAction) : null;
    const exists = targetOwnerKind === 'partyCharacter'
      ? definition.partyCharacterIds.includes(targetOwnerId) && !!targetAction?.eligibleCharacterIds.includes(targetOwnerId)
        && partyCandidates.some(row => row.actionId === actionId)
      : enemyCandidates.some(row => row.actionId === actionId);
    const sourceIsAlly = ownerKind === targetOwnerKind;
    if (!exists || !targetCost
      || (action.target.side === 'self' && (targetOwnerKind !== ownerKind || targetOwnerId !== ownerId))
      || (action.target.side === 'ally' && !sourceIsAlly)
      || (action.target.side === 'opponent' && sourceIsAlly)) {
      throw new Error('Card effect target is not an eligible scost card');
    }
    if (!actionEffects || actionEffects.prepare.length === 0) throw new Error('Card target has no declared effect');
    const preparePlan = planMapEffectSource({
      input: {
        sourceKey,
        actionId: action.id,
        source: ownerKind === 'partyCharacter' ? { kind: 'partyCharacter', id: ownerId } : { kind: 'enemy', id: ownerId },
        primary: null,
        sourceTeam: { kind: 'team', side: ownerKind === 'enemy' ? 'enemy' : 'party' },
        hp: {},
        locals: { counters: {}, flags: {} },
      },
      effects: actionEffects,
      instructions: [],
      // Prepare is described here, but its dynamic visits belong to the outer round planner.
      // Empty instructions ensure this metadata query never invokes the callback.
      visit: () => {},
    });
    for (const leaf of preparePlan.prepareDiscounts) {
      prepareMetadata.push(Object.freeze({
        sourceKey,
        source: Object.freeze(ownerKind === 'partyCharacter'
          ? { kind: 'partyCharacter' as const, id: ownerId }
          : { kind: 'enemy' as const, id: ownerId }),
        actionId: action.id,
        effectPath: leaf.originPath,
        leaf: Object.freeze({ op: leaf.op, amount: leaf.amount, mode: leaf.mode }),
      }));
    }
    const reduction = preparePlan.prepareDiscounts.reduce((sum, instruction) => sum + BigInt(instruction.amount), 0n);
    targets.set(sourceKey, target);
    const receiver = active.get(target.id);
    if (receiver) reductions.set(receiver, (reductions.get(receiver) ?? 0n) + reduction);
  }
  return { targets, reductions, prepareMetadata: Object.freeze(prepareMetadata) };
}
