import type {
  MapRun,
  MapRunFactState,
  MapRunRestoreFailureReason,
  MapRunRestoreResult,
  MapRunPartyMember,
  MapRunPartyHp,
  MapRunEnemyHp,
  MapRunEnemyHand,
  MapRunEnemyActorResourceBalance,
  MapRunSuccessResult,
  MapRunFailureResult,
  MapRunSaveSnapshot,
  MapRunActorResourceBalance,
  MapRunTeamResourceBalance,
  MapRunEncounterSnapshot,
  MapRunCandidateSourceSnapshot,
  MapRunHandRandomState,
  MapRunActionOverride,
  MapRunEncounterTargetSelection,
  MapRunEncounterDraftToken,
  MapRunEncounterCommitCommand,
  MapRunEncounterCommitPreview,
  MapRunEncounterCommitReceipt,
  MapRunEncounterActionSettlement,
  MapRunEncounterEnemyActionSettlement,
  MapRunEncounterSettlementResourceChange,
  MapRunEncounterHpChange,
  MapRunEncounterAbilityDraft,
  MapRunEncounterItemDraft,
  MapRunEncounterSourceTarget,
  MapRunEncounterSourceSettlement,
  MapRunEncounterItemSettlement,
  MapRunEncounterExecutionSequenceEntry,
  MapRunCardEffectModifierReceipt,
  MapRunEncounterExecutionTarget,
  MapRunEncounterSchedulerStartSnapshot,
  MapRunEncounterSchedulerTerminal,
  MapRunEncounterSourcePreview,
  MapRunEncounterProgramScope,
  MapRunEncounterProgramVisit,
  MapRunActiveActivity,
  MapRunShopDraftToken,
  MapRunShopPurchaseReceipt,
} from '../../contracts/map/map-run';
import { GAMEPLAY_B_HAND_RNG_ALGORITHM } from '../../contracts/map/map-run';
import type { MapRunCardInstance, MapRunCardRef } from '../../contracts/map/map-cards';
import type { MapRunEntrySnapshot } from '../../contracts/map/map-entry';
import { catalogMapRunCards, mapRunCardKey, parseMapRunCardRef } from './map-card-catalog';
import { mapCardActorKey, mapScostCost, resolveMapCardEffects, type MapCardActionChoice } from './map-card-effects';
import { isGameplayMapEdgeConditionSatisfied } from './map-edge-conditions';
import type {
  GameplayEncounterDef,
  GameplayMapActionDef,
  GameplayMapActivityDef,
  GameplayMapNodeDef,
  GameplayMapRunFactsDef,
  GameplayShopOfferDef,
} from '../../../data-services/contracts/gameplay-map';
import type { GameplayMapEffectConditionDef, GameplayMapEffectStatementDef } from '../../../data-services/contracts/gameplay-map-effects';
import type { MapContentResolver } from '../../contracts/map/map-content-resolver';
import type {
  MapEffectActorIdentity,
  MapEffectLocalsState,
  MapEncounterStatusInstance,
  MapRunStatusInstance,
  MapEffectStatusTickTraceEntry,
  MapEffectProgramSourceIdentity,
  MapEffectResourceLedgerEntry,
  MapEffectResourceBalanceSnapshot,
  MapEffectTraceEntry,
  MapEffectStatusRemoveTraceEntry,
  MapEffectStatusConsumeTraceEntry,
  MapEffectStatusCategoryRemoveTraceEntry,
  MapEffectStatusExpiryTriggerTraceEntry,
  MapEffectStatusDamageTriggerTraceEntry,
  MapEffectRandomState,
  MapEffectShieldLedger,
  MapEffectShieldTraceEntry,
  MapEffectTriggerTraceEntry,
} from '../../contracts/map/map-effects';
import { drawGameplayBHands } from './gameplay-b-hand-resolver';
import {
  normalizeMapActionEffects,
  type NormalizedGameplayMapActionEffects,
  type NormalizedGameplayMapEffectCondition,
  type NormalizedGameplayMapEffectInstruction,
} from '../../../data-services/normalization/gameplay-map-effect-program';
import { gameplayMapUsesDamageProtection, gameplayMapUsesDamageReduction, gameplayMapUsesShieldAdd, gameplayMapUsesStatusConsume, gameplayMapUsesStatusRemoveCategory, validateGameplayMapEffectContext } from '../../../data-services/validation/gameplay-map-effect-context';
import { resolveGameplayMapCandidateSources } from '../../../data-services/validation/gameplay-map-candidate-pools';
import { planMapEffectSource } from './map-effect-planner';
import { copyMapEffectRandomState, createMapEffectRandomState } from './gameplay-b-effect-rng';
import {
  resolveGameplayBActionPreview,
  type GameplayBActionPreview,
} from './gameplay-b-action-preview-resolver';
import { selectGameplayBUnitTarget } from './gameplay-b-target-selection';
import { buildGameplayBAg1ExecutionSources, type GameplayBAg1ExecutionTarget } from './gameplay-b-ag1-source-adapter';
import { copyMapEncounterLocalsState, initializeMapEncounterLocals } from './map-encounter-locals';
import {
  applyMapStatusRoundEnd,
  applyMapEncounterStatusRoundEnd,
  compareMapEncounterStatusStableOrder,
  copyMapRunStatusInstances,
  copyMapEncounterStatusInstances,
  validateMapRunStatusInstances,
  validateMapEncounterStatusInstances,
  validateMapEncounterStatusTrace,
} from './map-encounter-statuses';
import {
  validateMapEffectCommitReceipt,
  type MapEffectReceiptBalances,
  type MapEffectReceiptContext,
} from './map-effect-receipt-validator';

type ResolvedMap = NonNullable<ReturnType<MapContentResolver['resolve']>>;
type ResolveCharacterIdForVariant = (variantId: string) => string | null | undefined;

function candidateActionIdsFor(
  map: Pick<ResolvedMap, 'actions' | 'candidatePools' | 'executionContractId' | 'mapRunFacts'>,
  directCandidates: Parameters<typeof resolveGameplayMapCandidateSources>[1],
  poolIds: Parameters<typeof resolveGameplayMapCandidateSources>[2],
  candidateSourceSnapshot?: MapRunCandidateSourceSnapshot,
): Set<string> {
  return new Set(resolveGameplayMapCandidateSources(map, directCandidates, poolIds, {
    mode: 'runtime',
    mapRunFacts: candidateSourceSnapshot?.mapRunFacts,
  }).map(candidate => candidate.actionId));
}

interface MutableMapRun {
  runId: string;
  mapId: string;
  party: MapRunPartyMember[];
  partyAgility?: MapRun['partyAgility'];
  partyHp: MapRunPartyHp[];
  mapRunFacts?: MapRun['mapRunFacts'];
  mapRunStatuses?: MapRunStatusInstance[];
  lastEncounterCommit: MapRunEncounterCommitReceipt | null;
  playerCost: number;
  commitVersion: number;
  actorResources: MapRunActorResourceBalance[];
  teamResources: MapRunTeamResourceBalance[];
  status: MapRun['status'];
  currentNodeId: string;
  visitedNodeIds: string[];
  completedEncounterNodeIds: string[];
  completedActivityIds: string[];
  activeActivity: MapRunActiveActivity | null;
  activeEncounter: MapRunEncounterSnapshot | null;
}

interface MapRunSlot {
  readonly definition: ResolvedMap;
  readonly run: MutableMapRun;
}

interface TerminalMapRunCommitReplay {
  readonly command: MapRunEncounterCommitCommand;
  readonly snapshot: MapRun;
}

interface MapRunEncounterCommitPlan {
  readonly settlements: readonly MapRunEncounterActionSettlement[];
  readonly enemyActions: readonly MapRunEncounterEnemyActionSettlement[];
  readonly ability: MapRunEncounterSourceSettlement | null;
  readonly item: MapRunEncounterItemSettlement | null;
  readonly playerCostRequired: number;
  readonly actorBalancesAfter: ReadonlyMap<string, number>;
  readonly teamBalancesAfter: ReadonlyMap<string, number>;
  readonly enemyActorBalancesAfter: ReadonlyMap<string, number>;
  readonly enemyTeamBalancesAfter: ReadonlyMap<string, number>;
  readonly partyHpAfter: ReadonlyMap<string, number>;
  readonly enemyHpAfter: ReadonlyMap<string, number>;
  readonly terminal: 'none' | 'victory' | 'failure';
  readonly programReceiptVersion?: 1 | 2;
  readonly executionContractId?: 'E1-COMPAT-1' | 'AG-1';
  readonly effectScope?: MapRunEncounterProgramScope;
  readonly programVisits?: readonly MapRunEncounterProgramVisit[];
  readonly plannedLocals?: MapEffectLocalsState;
  readonly effectTrace?: readonly MapEffectTraceEntry[];
  readonly statusReceiptVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly plannedStatuses?: readonly MapEncounterStatusInstance[];
  readonly statusTrace?: readonly MapEffectStatusTickTraceEntry[];
  readonly plannedMapRunStatuses?: readonly MapRunStatusInstance[];
  readonly statusRemoveTrace?: readonly MapEffectStatusRemoveTraceEntry[];
  readonly statusConsumeTrace?: readonly MapEffectStatusConsumeTraceEntry[];
  readonly statusCategoryRemoveTrace?: readonly MapEffectStatusCategoryRemoveTraceEntry[];
  readonly plannedMapRunFacts?: MapRunFactState;
  readonly plannedEffectRandomState?: MapEffectRandomState;
  readonly schedulerFormatVersion?: 5 | 6 | 7;
  readonly shieldReceiptVersion?: 1;
  readonly shieldStart?: MapEffectShieldLedger;
  readonly plannedShields?: MapEffectShieldLedger;
  readonly shieldTrace?: readonly MapEffectShieldTraceEntry[];
  readonly triggerReceiptVersion?: 1 | 2 | 3 | 4;
  readonly triggerTrace?: readonly MapEffectTriggerTraceEntry[];
  readonly statusExpiryTriggerTrace?: readonly MapEffectStatusExpiryTriggerTraceEntry[];
  readonly statusDamageTriggerTrace?: readonly MapEffectStatusDamageTriggerTraceEntry[];
  readonly schedulerStartSnapshot?: MapRunEncounterSchedulerStartSnapshot;
  readonly schedulerTerminal?: MapRunEncounterSchedulerTerminal;
  readonly executionSequence?: readonly MapRunEncounterExecutionSequenceEntry[];
  readonly cardEffectModifierReceipts?: readonly MapRunCardEffectModifierReceipt[];
}

/** Opaque detached result of preparing one Encounter Commit. */
export interface PreparedMapRunEncounterCommit {
  readonly snapshot: MapRun;
  readonly replayed: boolean;
  readonly itemId: string | null;
}

interface PreparedMapRunEncounterCommitState {
  readonly snapshot: MapRun;
  readonly itemId: string | null;
  readonly baseSlot: MapRunSlot | null;
  readonly nextSlot: MapRunSlot | null;
  readonly result: MapRunSuccessResult | null;
  readonly failureResult: MapRunFailureResult | null;
  readonly terminalCommitReplay: TerminalMapRunCommitReplay | null;
  readonly replayed: boolean;
  installed: boolean;
}

let nextMapRunSequence = 0;

function snapshotOf(run: MutableMapRun): MapRun {
  const freezeStatus = (status: MapEncounterStatusInstance): MapEncounterStatusInstance => Object.freeze({
    ...status,
    holder: Object.freeze({ ...status.holder }),
    source: freezeProgramSource(status.source),
  });
  const freezeStatusTrace = (entry: MapEffectStatusTickTraceEntry): MapEffectStatusTickTraceEntry => Object.freeze({
    ...entry,
    holder: Object.freeze({ ...entry.holder }),
    source: freezeProgramSource(entry.source),
    statusBefore: freezeStatus(entry.statusBefore),
    statusAfter: entry.statusAfter === null ? null : freezeStatus(entry.statusAfter),
  }) as MapEffectStatusTickTraceEntry;
  const freezeStatusRemoveTrace = (entry: MapEffectStatusRemoveTraceEntry): MapEffectStatusRemoveTraceEntry => Object.freeze({
    ...entry,
    ...(entry.source ? { source: freezeProgramSource(entry.source) } : {}),
    ...(entry.identity ? { identity: Object.freeze({ ...entry.identity }) } : {}),
    removed: Object.freeze(entry.removed.map(row => Object.freeze({
      statusIndexBefore: row.statusIndexBefore,
      status: freezeStatus(row.status),
    }))),
  });
  const cloneReceipt = (receipt: MapRunEncounterCommitReceipt | null) => receipt === null ? null : Object.freeze({
    ...receipt,
    ...(receipt.schedulerStartSnapshot ? { schedulerStartSnapshot: copySchedulerStartSnapshot(receipt.schedulerStartSnapshot) } : {}),
    ...(receipt.schedulerTerminal ? { schedulerTerminal: Object.freeze({ ...receipt.schedulerTerminal }) } : {}),
    ...(receipt.effectScope ? { effectScope: Object.freeze({ ...receipt.effectScope }) } : {}),
    ...(receipt.programVisits ? { programVisits: Object.freeze(receipt.programVisits.map(visit => Object.freeze({
      ...visit,
      source: freezeProgramSource(visit.source),
    }))) } : {}),
    ...(receipt.plannedLocals ? { plannedLocals: copyMapEncounterLocalsState(receipt.plannedLocals) } : {}),
    ...(receipt.plannedMapRunFacts ? { plannedMapRunFacts: copyMapRunFacts(receipt.plannedMapRunFacts) } : {}),
    ...(receipt.plannedEffectRandomState ? { plannedEffectRandomState: copyMapEffectRandomState(receipt.plannedEffectRandomState) } : {}),
    ...(receipt.shieldStart ? { shieldStart: copyShieldLedger(receipt.shieldStart) } : {}),
    ...(receipt.plannedShields ? { plannedShields: copyShieldLedger(receipt.plannedShields) } : {}),
    ...(receipt.shieldTrace ? { shieldTrace: Object.freeze(receipt.shieldTrace.map(freezeShieldTraceEntry)) } : {}),
    ...(receipt.triggerTrace ? { triggerTrace: Object.freeze(receipt.triggerTrace.map(freezeTriggerTraceEntry)) } : {}),
    ...(receipt.statusExpiryTriggerTrace ? { statusExpiryTriggerTrace: Object.freeze(receipt.statusExpiryTriggerTrace.map(freezeStatusExpiryTriggerTraceEntry)) } : {}),
    ...(receipt.statusDamageTriggerTrace ? { statusDamageTriggerTrace: Object.freeze(receipt.statusDamageTriggerTrace.map(entry => Object.freeze({
      ...entry, status: freezeDamageRewardStatus(entry.status), holder: Object.freeze({ ...entry.holder }),
    }))) } : {}),
    ...(receipt.effectTrace ? { effectTrace: Object.freeze(receipt.effectTrace.map(freezeProgramTraceEntry)) } : {}),
    ...(receipt.plannedStatuses ? { plannedStatuses: Object.freeze(receipt.plannedStatuses.map(freezeStatus)) } : {}),
    ...(receipt.plannedMapRunStatuses ? { plannedMapRunStatuses: copyMapRunStatusInstances(receipt.plannedMapRunStatuses) } : {}),
    ...(receipt.statusTrace ? { statusTrace: Object.freeze(receipt.statusTrace.map(freezeStatusTrace)) } : {}),
    ...(receipt.statusRemoveTrace ? { statusRemoveTrace: Object.freeze(receipt.statusRemoveTrace.map(freezeStatusRemoveTrace)) } : {}),
    ...(receipt.statusConsumeTrace ? { statusConsumeTrace: Object.freeze(receipt.statusConsumeTrace.map(freezeMapEffectStatusConsumeTrace)) } : {}),
    ...(receipt.statusCategoryRemoveTrace ? { statusCategoryRemoveTrace: Object.freeze(receipt.statusCategoryRemoveTrace.map(freezeMapEffectStatusCategoryRemoveTrace)) } : {}),
    ...(receipt.executionSequence ? { executionSequence: Object.freeze(receipt.executionSequence.map(entry => Object.freeze({
      ...entry,
      owner: entry.owner ? Object.freeze({ ...entry.owner }) : null,
      cardRef: entry.cardRef ? parseMapRunCardRef(entry.cardRef)! : null,
      additionalTarget: entry.additionalTarget ? cloneSourceTarget(entry.additionalTarget)! : null,
      target: entry.target.kind === 'card'
        ? Object.freeze({ kind: 'card' as const, cardRef: entry.target.cardRef ? parseMapRunCardRef(entry.target.cardRef)! : null })
        : Object.freeze({ ...entry.target }),
      resourceChanges: Object.freeze(entry.resourceChanges.map(change => Object.freeze({ ...change }))),
      hpChanges: Object.freeze(entry.hpChanges.map(change => Object.freeze({ ...change }))),
    }))) } : {}),
    ...(receipt.cardEffectModifierReceipts ? { cardEffectModifierReceipts: Object.freeze(receipt.cardEffectModifierReceipts.map(row => Object.freeze({
      ...row, sourceCardRef: parseMapRunCardRef(row.sourceCardRef)!, targetCardRef: parseMapRunCardRef(row.targetCardRef)!,
      ...(row.reason ? { reason: row.reason } : {}),
      hits: Object.freeze(row.hits.map(hit => Object.freeze({ ...hit, identity: Object.freeze({ ...hit.identity }),
        ...(hit.batch ? { batch: Object.freeze({ ...hit.batch }) } : {}) }))),
    }))) } : {}),
    ...(receipt.enemyActions ? { enemyActions: freezeEnemyActionSettlements(receipt.enemyActions) } : {}),
    ...(receipt.ability ? { ability: Object.freeze({
      ...receipt.ability,
      target: cloneSourceTarget(receipt.ability.target)!,
      ...(receipt.ability.additionalTarget === undefined ? {} : { additionalTarget: cloneSourceTarget(receipt.ability.additionalTarget) }),
      resourceChanges: Object.freeze(receipt.ability.resourceChanges.map(change => Object.freeze({ ...change }))),
      hpChanges: Object.freeze(receipt.ability.hpChanges.map(change => Object.freeze({ ...change }))),
    }) } : {}),
    ...(receipt.item ? { item: Object.freeze({
      ...receipt.item,
      target: cloneSourceTarget(receipt.item.target)!,
      ...(receipt.item.additionalTarget === undefined ? {} : { additionalTarget: cloneSourceTarget(receipt.item.additionalTarget) }),
      resourceChanges: Object.freeze(receipt.item.resourceChanges.map(change => Object.freeze({ ...change }))),
      hpChanges: Object.freeze(receipt.item.hpChanges.map(change => Object.freeze({ ...change }))),
    }) } : {}),
    settlements: Object.freeze(receipt.settlements.map(settlement => Object.freeze({
      ...settlement,
      ...(settlement.additionalTarget === undefined ? {} : { additionalTarget: cloneSourceTarget(settlement.additionalTarget) }),
      ...(settlement.targetCard ? { targetCard: parseMapRunCardRef(settlement.targetCard)! } : {}),
      ...(settlement.scostCost ? { scostCost: Object.freeze({ ...settlement.scostCost }) } : {}),
      ...(settlement.hpChanges ? { hpChanges: Object.freeze(settlement.hpChanges.map(change => Object.freeze({ ...change }))) } : {}),
      resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
    }))),
  });
  const lastCommit = cloneReceipt(run.activeEncounter?.lastCommit ?? null);
  const activeEncounter = run.activeEncounter === null ? null : Object.freeze({
    ...run.activeEncounter,
    hands: Object.freeze(run.activeEncounter.hands.map(hand => Object.freeze({
      characterId: hand.characterId,
      actionIds: Object.freeze([...hand.actionIds]),
    }))),
    enemyHands: Object.freeze(run.activeEncounter.enemyHands.map(hand => Object.freeze({
      enemyId: hand.enemyId,
      actionIds: Object.freeze([...hand.actionIds]),
    }))),
    enemyActorResources: Object.freeze(run.activeEncounter.enemyActorResources.map(balance => Object.freeze({ ...balance }))),
    enemyTeamResources: Object.freeze(run.activeEncounter.enemyTeamResources.map(balance => Object.freeze({ ...balance }))),
    overrides: Object.freeze(run.activeEncounter.overrides.map(override => Object.freeze({ ...override }))),
    targetSelections: Object.freeze(run.activeEncounter.targetSelections.map(selection => Object.freeze({ ...selection,
      ...(selection.targetCard ? { targetCard: parseMapRunCardRef(selection.targetCard)! } : {}),
    }))),
    ...(run.activeEncounter.abilityDraft == null ? {} : {
      abilityDraft: Object.freeze({ ...run.activeEncounter.abilityDraft, target: cloneSourceTarget(run.activeEncounter.abilityDraft.target), additionalTarget: cloneSourceTarget(run.activeEncounter.abilityDraft.additionalTarget) }),
    }),
    ...(run.activeEncounter.itemDraft == null ? {} : {
      itemDraft: Object.freeze({ ...run.activeEncounter.itemDraft, target: cloneSourceTarget(run.activeEncounter.itemDraft.target), additionalTarget: cloneSourceTarget(run.activeEncounter.itemDraft.additionalTarget) }),
    }),
    ...(run.activeEncounter.locals === undefined ? {} : {
      locals: copyMapEncounterLocalsState(run.activeEncounter.locals),
    }),
    ...(run.activeEncounter.effectRandomState === undefined ? {} : {
      effectRandomState: copyMapEffectRandomState(run.activeEncounter.effectRandomState),
    }),
    ...(run.activeEncounter.candidateSourceSnapshot === undefined ? {} : {
      candidateSourceSnapshot: copyCandidateSourceSnapshot(run.activeEncounter.candidateSourceSnapshot),
    }),
    ...(run.activeEncounter.statuses === undefined ? {} : {
      statuses: copyMapEncounterStatusInstances(run.activeEncounter.statuses),
    }),
    ...(run.activeEncounter.shields === undefined ? {} : { shields: copyShieldLedger(run.activeEncounter.shields) }),
    enemies: Object.freeze(run.activeEncounter.enemies.map(enemy => Object.freeze({ ...enemy }))),
    ...(run.activeEncounter.enemyAgility === undefined ? {} : {
      enemyAgility: Object.freeze(run.activeEncounter.enemyAgility.map(row => Object.freeze({ ...row }))),
    }),
    randomState: Object.freeze({ ...run.activeEncounter.randomState }),
    lastCommit,
  });
  const snapshot = {
    ...run,
    party: Object.freeze(run.party.map(member => Object.freeze({ ...member }))),
    ...(run.partyAgility === undefined ? {} : {
      partyAgility: Object.freeze(run.partyAgility.map(row => Object.freeze({ ...row }))),
    }),
    partyHp: Object.freeze(run.partyHp.map(row => Object.freeze({ ...row }))),
    ...(run.mapRunFacts === undefined ? {} : {
      mapRunFacts: Object.freeze({
        counters: Object.freeze(run.mapRunFacts.counters.map(row => Object.freeze({ ...row }))),
        flags: Object.freeze(run.mapRunFacts.flags.map(row => Object.freeze({ ...row }))),
      }),
    }),
    ...(run.mapRunStatuses === undefined ? {} : { mapRunStatuses: copyMapRunStatusInstances(run.mapRunStatuses) }),
    lastEncounterCommit: cloneReceipt(run.lastEncounterCommit),
    actorResources: Object.freeze(run.actorResources.map(balance => Object.freeze({ ...balance }))),
    teamResources: Object.freeze(run.teamResources.map(balance => Object.freeze({ ...balance }))),
    visitedNodeIds: Object.freeze([...run.visitedNodeIds]),
    completedEncounterNodeIds: Object.freeze([...run.completedEncounterNodeIds]),
    completedActivityIds: Object.freeze([...run.completedActivityIds]),
    activeActivity: freezeActiveActivity(run.activeActivity),
    activeEncounter,
  };
  Object.defineProperty(snapshot, 'activeEncounterNodeId', {
    enumerable: false,
    configurable: false,
    get: () => snapshot.activeEncounter?.nodeId ?? null,
  });
  return Object.freeze(snapshot) as MapRun;
}

function cloneSourceTarget(target: MapRunEncounterSourceTarget | null): MapRunEncounterSourceTarget | null {
  return target === null ? null : Object.freeze({ ...target });
}

function copySchedulerStartSnapshot(snapshot: MapRunEncounterSchedulerStartSnapshot): MapRunEncounterSchedulerStartSnapshot {
  const encounter = snapshot.encounter;
  return Object.freeze({
    runId: snapshot.runId,
    mapId: snapshot.mapId,
    party: Object.freeze(snapshot.party.map(row => Object.freeze({ ...row }))),
    partyAgility: Object.freeze(snapshot.partyAgility.map(row => Object.freeze({ ...row }))),
    partyHp: Object.freeze(snapshot.partyHp.map(row => Object.freeze({ ...row }))),
    playerCost: snapshot.playerCost,
    actorResources: Object.freeze(snapshot.actorResources.map(row => Object.freeze({ ...row }))),
    teamResources: Object.freeze(snapshot.teamResources.map(row => Object.freeze({ ...row }))),
    ...(snapshot.mapRunFacts === undefined ? {} : { mapRunFacts: copyMapRunFacts(snapshot.mapRunFacts) }),
    ...(snapshot.mapRunStatuses === undefined ? {} : { mapRunStatuses: copyMapRunStatusInstances(snapshot.mapRunStatuses) }),
    encounter: Object.freeze({
      nodeId: encounter.nodeId,
      ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
      round: encounter.round,
      hands: Object.freeze(encounter.hands.map(row => Object.freeze({
        characterId: row.characterId, actionIds: Object.freeze([...row.actionIds]),
      }))),
      enemyHands: Object.freeze(encounter.enemyHands.map(row => Object.freeze({
        enemyId: row.enemyId, actionIds: Object.freeze([...row.actionIds]),
      }))),
      enemyActorResources: Object.freeze(encounter.enemyActorResources.map(row => Object.freeze({ ...row }))),
      enemyTeamResources: Object.freeze(encounter.enemyTeamResources.map(row => Object.freeze({ ...row }))),
      overrides: Object.freeze(encounter.overrides.map(row => Object.freeze({ ...row }))),
      targetSelections: Object.freeze(encounter.targetSelections.map(row => {
        if (row.targetCharacterId !== undefined) return Object.freeze({ characterId: row.characterId, targetCharacterId: row.targetCharacterId,
          ...(row.additionalTargetCharacterId === undefined ? {} : { additionalTargetCharacterId: row.additionalTargetCharacterId }),
          ...(row.additionalTargetEnemyId === undefined ? {} : { additionalTargetEnemyId: row.additionalTargetEnemyId }) });
        if (row.targetEnemyId !== undefined) return Object.freeze({ characterId: row.characterId, targetEnemyId: row.targetEnemyId,
          ...(row.additionalTargetCharacterId === undefined ? {} : { additionalTargetCharacterId: row.additionalTargetCharacterId }),
          ...(row.additionalTargetEnemyId === undefined ? {} : { additionalTargetEnemyId: row.additionalTargetEnemyId }) });
        return Object.freeze({ characterId: row.characterId, targetCard: parseMapRunCardRef(row.targetCard!)! });
      })),
      abilityDraft: encounter.abilityDraft === null ? null : Object.freeze({
        ...encounter.abilityDraft, target: cloneSourceTarget(encounter.abilityDraft.target)!,
        additionalTarget: cloneSourceTarget(encounter.abilityDraft.additionalTarget)!,
      }),
      itemDraft: encounter.itemDraft === null ? null : Object.freeze({
        ...encounter.itemDraft, target: cloneSourceTarget(encounter.itemDraft.target)!,
        additionalTarget: cloneSourceTarget(encounter.itemDraft.additionalTarget)!,
      }),
      enemies: Object.freeze(encounter.enemies.map(row => Object.freeze({ ...row }))),
      enemyAgility: Object.freeze(encounter.enemyAgility.map(row => Object.freeze({ ...row }))),
      draftVersion: encounter.draftVersion,
      drawCursorStart: encounter.drawCursorStart,
      randomState: Object.freeze({ ...encounter.randomState }),
      effectRandomState: copyMapEffectRandomState(encounter.effectRandomState),
      locals: copyMapEncounterLocalsState(encounter.locals),
      statuses: copyMapEncounterStatusInstances(encounter.statuses),
      ...(encounter.shields === undefined ? {} : { shields: copyShieldLedger(encounter.shields) }),
      ...(encounter.candidateSourceSnapshot === undefined ? {} : {
        candidateSourceSnapshot: copyCandidateSourceSnapshot(encounter.candidateSourceSnapshot),
      }),
    }),
  });
}

function copyMapRunFacts(facts: MapRunFactState): MapRunFactState {
  return Object.freeze({
    counters: Object.freeze(facts.counters.map(row => Object.freeze({ ...row }))),
    flags: Object.freeze(facts.flags.map(row => Object.freeze({ ...row }))),
  });
}

function copyShieldLedger(value: MapEffectShieldLedger): MapEffectShieldLedger {
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, amount])));
}

function restoreShieldLedger(
  value: unknown,
  partyIds: readonly string[],
  enemyIds: readonly string[],
): MapEffectShieldLedger | null {
  if (!isRecord(value)) return null;
  const validKeys = new Set([
    ...partyIds.map(id => `partyCharacter:${id}`),
    ...enemyIds.map(id => `enemy:${id}`),
  ]);
  const restored: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (!validKeys.has(key) || !Number.isSafeInteger(amount) || (amount as number) <= 0) return null;
    restored[key] = amount as number;
  }
  return copyShieldLedger(restored);
}

function freezeShieldTraceEntry(entry: MapEffectShieldTraceEntry): MapEffectShieldTraceEntry {
  return Object.freeze({
    ...entry,
    ...(entry.source ? { source: freezeProgramSource(entry.source) } : {}),
    identity: Object.freeze({ ...entry.identity }),
  });
}

function freezeTriggerTraceEntry(entry: MapEffectTriggerTraceEntry): MapEffectTriggerTraceEntry {
  if (entry.event === 'enemyDefeated') return Object.freeze({
    ...entry,
    target: Object.freeze({ kind: 'enemy' as const, id: entry.target.id }),
    rewardRecipient: Object.freeze({ kind: 'partyCharacter' as const, id: entry.rewardRecipient.id }),
  });
  return Object.freeze({ ...entry, target: Object.freeze({ ...entry.target }) });
}

function freezeStatusExpiryTriggerTraceEntry(entry: MapEffectStatusExpiryTriggerTraceEntry): MapEffectStatusExpiryTriggerTraceEntry {
  return Object.freeze({
    ...entry,
    holder: Object.freeze({ ...entry.holder }),
    status: Object.freeze({ ...entry.status, holder: Object.freeze({ ...entry.status.holder }),
      source: freezeProgramSource(entry.status.source) }),
  });
}

function freezeDamageRewardStatus(status: MapEncounterStatusInstance): MapEncounterStatusInstance {
  return Object.freeze({ ...status, holder: Object.freeze({ ...status.holder }), source: freezeProgramSource(status.source) });
}

function schedulerStartSnapshotOf(slot: MapRunSlot): MapRunEncounterSchedulerStartSnapshot {
  const encounter = slot.run.activeEncounter;
  if (!encounter) throw new MapRunError(['there is no active Encounter to snapshot']);
  return copySchedulerStartSnapshot({
    runId: slot.run.runId,
    mapId: slot.run.mapId,
    party: slot.run.party,
    partyAgility: slot.run.partyAgility ?? slot.run.party.map(member => ({ characterId: member.characterId, agility: 0 })),
    partyHp: slot.run.partyHp,
    playerCost: slot.run.playerCost,
    actorResources: slot.run.actorResources,
    teamResources: slot.run.teamResources,
    ...(slot.run.mapRunFacts === undefined ? {} : { mapRunFacts: slot.run.mapRunFacts }),
    ...(slot.run.mapRunStatuses === undefined ? {} : { mapRunStatuses: slot.run.mapRunStatuses }),
    encounter: {
      nodeId: encounter.nodeId,
      ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
      round: encounter.round,
      hands: encounter.hands,
      enemyHands: encounter.enemyHands,
      enemyActorResources: encounter.enemyActorResources,
      enemyTeamResources: encounter.enemyTeamResources,
      overrides: encounter.overrides,
      targetSelections: encounter.targetSelections,
      abilityDraft: encounter.abilityDraft ?? null,
      itemDraft: encounter.itemDraft ?? null,
      enemies: encounter.enemies,
      enemyAgility: encounter.enemyAgility ?? encounter.enemies.map(enemy => ({ enemyId: enemy.enemyId, agility: 0 })),
      draftVersion: encounter.draftVersion,
      drawCursorStart: encounter.drawCursorStart,
      randomState: encounter.randomState,
      effectRandomState: copyMapEffectRandomState(encounter.effectRandomState),
      locals: encounter.locals ?? { counters: {}, flags: {} },
      statuses: encounter.statuses ?? [],
      ...(gameplayMapUsesShieldAdd(slot.definition) ? { shields: encounter.shields ?? {} } : {}),
      ...(encounter.candidateSourceSnapshot === undefined ? {} : {
        candidateSourceSnapshot: encounter.candidateSourceSnapshot,
      }),
    },
  });
}

function freezeActiveActivity(activity: MapRunActiveActivity | null): MapRunActiveActivity | null {
  if (activity === null) return null;
  return Object.freeze({
    ...activity,
    lastPurchase: activity.lastPurchase === null ? null : Object.freeze({
      ...activity.lastPurchase,
      costs: Object.freeze(activity.lastPurchase.costs.map(row => Object.freeze({ ...row }))),
      effects: Object.freeze(activity.lastPurchase.effects.map(row => Object.freeze({ ...row }))),
      heal: activity.lastPurchase.heal === null ? null : Object.freeze({ ...activity.lastPurchase.heal }),
    }),
  });
}

/** Ordered activities declared by a Node; an empty list means legacy single-Encounter content. */
function nodeActivities(node: GameplayMapNodeDef): readonly GameplayMapActivityDef[] {
  return Array.isArray(node.activities) ? node.activities : [];
}

function encounterRounds(encounter: GameplayEncounterDef): number | undefined {
  return Number.isSafeInteger(encounter.rounds) ? encounter.rounds as number : undefined;
}

function activityKind(activity: GameplayMapActivityDef): MapRunActiveActivity['kind'] {
  if (activity.shop !== undefined) return 'shop';
  const encounter = activity.encounter;
  if (!encounter) return 'encounter';
  if ((encounter.enemies?.length ?? 0) > 0) return 'battle';
  return encounterRounds(encounter) === undefined ? 'encounter' : 'rest';
}

function activityCompletedKey(nodeId: string, activityId: string): string {
  return `${nodeId}/${activityId}`;
}

/**
 * Resolves the Encounter definition for a Node or one of its activities.
 * `activityId` is undefined only for a legacy single-Encounter Node.
 */
function resolveNodeEncounter(
  node: GameplayMapNodeDef | undefined,
  activityId?: string,
): GameplayEncounterDef | null {
  if (!node) return null;
  const activities = nodeActivities(node);
  if (activities.length === 0) {
    return activityId === undefined ? node.encounter ?? null : null;
  }
  if (activityId === undefined) return null;
  const activity = activities.find(candidate => candidate.id === activityId);
  return activity?.encounter ?? null;
}

/** Resolves the Shop definition for a Node activity, or null for a non-shop activity. */
function resolveNodeShop(node: GameplayMapNodeDef | undefined, activityId?: string) {
  if (!node || activityId === undefined) return null;
  return nodeActivities(node).find(candidate => candidate.id === activityId)?.shop ?? null;
}

function nextUnfinishedActivityIndex(
  activities: readonly GameplayMapActivityDef[],
  completedActivityIds: readonly string[],
  nodeId: string,
  fromIndex: number,
): number {
  const completed = new Set(completedActivityIds);
  for (let index = fromIndex; index < activities.length; index += 1) {
    if (!completed.has(activityCompletedKey(nodeId, activities[index].id))) return index;
  }
  return -1;
}

function freezeShopCosts(offer: GameplayShopOfferDef): readonly { readonly resourceId: string; readonly amount: number }[] {
  const rows: unknown = offer.costs ?? [];
  if (!Array.isArray(rows)) throw new MapRunError([`Shop offer "${offer.id}" costs must be an array`]);
  const seen = new Set<string>();
  const result: { resourceId: string; amount: number }[] = [];
  for (const row of rows) {
    if (!isRecord(row) || !isNonEmptyId(row.resourceId)
      || !Number.isSafeInteger(row.amount) || (row.amount as number) <= 0) {
      throw new MapRunError([`Shop offer "${offer.id}" has an invalid cost`]);
    }
    if (seen.has(row.resourceId)) throw new MapRunError([`Shop offer "${offer.id}" has a duplicate cost`]);
    seen.add(row.resourceId);
    result.push({ resourceId: row.resourceId, amount: row.amount as number });
  }
  return Object.freeze(result.map(row => Object.freeze({ ...row })));
}

function freezeShopEffects(offer: GameplayShopOfferDef): readonly { readonly resourceId: string; readonly amount: number }[] {
  const rows: unknown = offer.effects ?? [];
  if (!Array.isArray(rows)) throw new MapRunError([`Shop offer "${offer.id}" effects must be an array`]);
  const seen = new Set<string>();
  const result: { resourceId: string; amount: number }[] = [];
  for (const row of rows) {
    if (!isRecord(row) || !isNonEmptyId(row.resourceId)
      || !Number.isSafeInteger(row.amount) || (row.amount as number) === 0) {
      throw new MapRunError([`Shop offer "${offer.id}" has an invalid effect`]);
    }
    if (seen.has(row.resourceId)) throw new MapRunError([`Shop offer "${offer.id}" has a duplicate effect`]);
    seen.add(row.resourceId);
    result.push({ resourceId: row.resourceId, amount: row.amount as number });
  }
  return Object.freeze(result.map(row => Object.freeze({ ...row })));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function gameplayMapUsesStatusRemove(value: unknown): boolean {
  const contains = (candidate: unknown): boolean => {
    if (Array.isArray(candidate)) return candidate.some(contains);
    if (!isRecord(candidate)) return false;
    return candidate.op === 'statusRemove' || Object.values(candidate).some(contains);
  };
  return isRecord(value) && Array.isArray(value.actions)
    && value.actions.some(action => isRecord(action) && contains(action.effectProgram));
}

function gameplayMapUsesMapRunStatus(definition: ResolvedMap): boolean {
  return definition.statuses?.some(status => status.lifetime === 'mapRun') ?? false;
}

function gameplayMapUsesStatusDamageReward(definition: ResolvedMap): boolean {
  return definition.executionContractId === 'AG-1'
    && (definition.statuses?.some(status => status.onDamageTaken !== undefined) ?? false);
}

function mapRunStatusIdentityKey(status: MapEncounterStatusInstance): string {
  const source = status.source.kind === 'partyCharacter' || status.source.kind === 'enemy'
    ? [status.source.kind, status.source.id]
    : status.source.kind === 'ability' ? [status.source.kind, status.source.actionId]
      : [status.source.kind, status.source.actionId, status.source.itemId];
  return JSON.stringify([status.holder.kind, status.holder.id, status.statusId, source, status.actionId]);
}

function gameplayMapStatusReceiptVersion(definition: ResolvedMap): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return gameplayMapUsesMapRunStatus(definition) ? 7
    : gameplayMapUsesDamageProtection(definition) ? 6
    : gameplayMapUsesDamageReduction(definition) ? 5
      : gameplayMapUsesStatusRemoveCategory(definition) ? 4
        : gameplayMapUsesStatusConsume(definition) ? 3
          : gameplayMapUsesStatusRemove(definition) ? 2 : 1;
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length
    && keys.every(key => typeof key === 'string' && expected.includes(key)
      && Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function initializeMapRunFacts(definition: ResolvedMap): MapRun['mapRunFacts'] {
  const declared: GameplayMapRunFactsDef | undefined = definition.mapRunFacts;
  if (declared === undefined) return undefined;
  if (!isRecord(declared)
    || (declared.counters !== undefined && !Array.isArray(declared.counters))
    || (declared.flags !== undefined && !Array.isArray(declared.flags))) {
    throw new MapRunError([`Map "${definition.id}" has invalid MapRun Fact declarations`]);
  }
  const counters = declared.counters ?? [];
  const flags = declared.flags ?? [];
  const ids = new Set<string>();
  for (const counter of counters) {
    if (!isRecord(counter) || !isNonEmptyId(counter.id)
      || !Number.isSafeInteger(counter.initial) || !Number.isSafeInteger(counter.min) || !Number.isSafeInteger(counter.max)
      || (counter.min as number) > (counter.max as number)
      || (counter.initial as number) < (counter.min as number) || (counter.initial as number) > (counter.max as number)
      || ids.has(counter.id)) {
      throw new MapRunError([`Map "${definition.id}" has an invalid MapRun Fact Counter`]);
    }
    ids.add(counter.id);
  }
  for (const flag of flags) {
    if (!isRecord(flag) || !isNonEmptyId(flag.id) || typeof flag.initial !== 'boolean' || ids.has(flag.id)) {
      throw new MapRunError([`Map "${definition.id}" has an invalid MapRun Fact Flag`]);
    }
    ids.add(flag.id);
  }
  if (ids.size > 64) throw new MapRunError([`Map "${definition.id}" exceeds the MapRun Fact limit`]);
  return {
    counters: counters.map(({ id, initial }) => ({ id, value: initial })),
    flags: flags.map(({ id, initial }) => ({ id, value: initial })),
  };
}

function restoreMapRunFacts(value: unknown, definition: ResolvedMap): MapRun['mapRunFacts'] | null {
  const declared = initializeMapRunFacts(definition);
  const owner = isRecord(value) ? value : null;
  const stateDescriptor = owner === null ? undefined : Object.getOwnPropertyDescriptor(owner, 'mapRunFacts');
  const hasState = stateDescriptor !== undefined;
  if (declared === undefined) return hasState ? null : undefined;
  if (!stateDescriptor || !Object.prototype.hasOwnProperty.call(stateDescriptor, 'value')
    || !isRecord(stateDescriptor.value) || !exactKeys(stateDescriptor.value, ['counters', 'flags'])) return null;
  const saved = stateDescriptor.value;
  if (!Array.isArray(saved.counters) || !Array.isArray(saved.flags)
    || saved.counters.length !== declared.counters.length || saved.flags.length !== declared.flags.length) return null;
  const counters: { id: string; value: number }[] = [];
  for (const [index, raw] of saved.counters.entries()) {
    const expected = declared.counters[index];
    if (!expected || !isRecord(raw) || !exactKeys(raw, ['id', 'value']) || raw.id !== expected.id
      || !Number.isSafeInteger(raw.value) || (raw.value as number) < definition.mapRunFacts!.counters![index]!.min
      || (raw.value as number) > definition.mapRunFacts!.counters![index]!.max) return null;
    counters.push({ id: expected.id, value: raw.value as number });
  }
  const flags: { id: string; value: boolean }[] = [];
  for (const [index, raw] of saved.flags.entries()) {
    const expected = declared.flags[index];
    if (!expected || !isRecord(raw) || !exactKeys(raw, ['id', 'value']) || raw.id !== expected.id
      || typeof raw.value !== 'boolean') return null;
    flags.push({ id: expected.id, value: raw.value });
  }
  return { counters, flags };
}

function restoreMapRunStatuses(
  value: unknown,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
  commitVersion: number,
): MapRun['mapRunStatuses'] | null {
  const owner = isRecord(value) ? value : null;
  const descriptor = owner === null ? undefined : Object.getOwnPropertyDescriptor(owner, 'mapRunStatuses');
  if (!gameplayMapUsesMapRunStatus(definition)) return descriptor === undefined ? undefined : null;
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return validateMapRunStatusInstances(descriptor.value, {
    map: definition,
    partyCharacterIds: party.map(member => member.characterId),
    currentCommitVersion: commitVersion,
  }) ?? null;
}

function hasFactGatedCandidatePools(definition: ResolvedMap): boolean {
  return (definition.candidatePools ?? []).some(pool => pool.gate !== undefined);
}

function copyCandidateSourceSnapshot(
  snapshot: MapRunCandidateSourceSnapshot,
): MapRunCandidateSourceSnapshot {
  return Object.freeze({
    formatVersion: 1,
    mapRunFacts: copyMapRunFacts(snapshot.mapRunFacts),
  });
}

function createCandidateSourceSnapshot(
  definition: ResolvedMap,
  facts: MapRunFactState | undefined,
): MapRunCandidateSourceSnapshot | undefined {
  if (!hasFactGatedCandidatePools(definition)) return undefined;
  if (facts === undefined) throw new MapRunError([`Map "${definition.id}" requires MapRun Facts for gated candidate Pools`]);
  const restored = restoreMapRunFacts({ mapRunFacts: facts }, definition);
  if (restored === null || restored === undefined) throw new MapRunError([`Map "${definition.id}" has invalid candidate Fact input`]);
  return copyCandidateSourceSnapshot({ formatVersion: 1, mapRunFacts: restored });
}

function restoreCandidateSourceSnapshot(
  value: unknown,
  owner: Record<string, unknown>,
  definition: ResolvedMap,
): MapRunCandidateSourceSnapshot | undefined | null {
  const descriptor = Object.getOwnPropertyDescriptor(owner, 'candidateSourceSnapshot');
  const gated = hasFactGatedCandidatePools(definition);
  if (!gated) return descriptor === undefined ? undefined : null;
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !isRecord(value)
    || !exactKeys(value, ['formatVersion', 'mapRunFacts']) || value.formatVersion !== 1) return null;
  const mapRunFacts = restoreMapRunFacts({ mapRunFacts: value.mapRunFacts }, definition);
  if (!mapRunFacts) return null;
  return copyCandidateSourceSnapshot({ formatVersion: 1, mapRunFacts });
}

function isUniqueIdArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every(isNonEmptyId)
    && new Set(value).size === value.length;
}

function isPartySnapshot(
  value: unknown,
  expectedCharacterIds: readonly string[],
  resolveCharacterIdForVariant?: ResolveCharacterIdForVariant,
): value is MapRunPartyMember[] {
  if (!Array.isArray(value)
    || expectedCharacterIds.length === 0
    || value.length !== expectedCharacterIds.length
    || expectedCharacterIds.some(characterId => !isNonEmptyId(characterId))
    || new Set(expectedCharacterIds).size !== expectedCharacterIds.length) return false;

  const seenVariantIds = new Set<string>();
  for (const [index, member] of value.entries()) {
    if (!isRecord(member)
      || !isNonEmptyId(member.characterId)
      || member.characterId !== expectedCharacterIds[index]
      || !isNonEmptyId(member.variantId)
      || seenVariantIds.has(member.variantId)) return false;
    if (resolveCharacterIdForVariant) {
      let resolvedCharacterId: string | null | undefined;
      try {
        resolvedCharacterId = resolveCharacterIdForVariant(member.variantId);
      } catch {
        return false;
      }
      if (resolvedCharacterId !== member.characterId) return false;
    }
    seenVariantIds.add(member.variantId);
  }
  return true;
}

function projectPartySnapshot(party: readonly MapRunPartyMember[]): MapRunPartyMember[] {
  return party.map(({ characterId, variantId }) => ({ characterId, variantId }));
}

function rejectRestore(
  mapId: string | null,
  reason: MapRunRestoreFailureReason,
  diagnostic: string,
): MapRunRestoreResult {
  return { status: 'rejected', mapId, reason, diagnostics: Object.freeze([diagnostic]) };
}

function advanceRunSequence(runId: string): void {
  const match = /^map-run-(\d+)$/.exec(runId);
  if (!match) return;
  const sequence = Number(match[1]);
  if (Number.isSafeInteger(sequence)) nextMapRunSequence = Math.max(nextMapRunSequence, sequence);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function actorResourceKey(characterId: string, resourceId: string): string {
  return JSON.stringify([characterId, resourceId]);
}

function sameCommitRequest(left: MapRunEncounterCommitCommand, right: MapRunEncounterCommitCommand): boolean {
  return left.runId === right.runId
    && left.requestId === right.requestId
    && left.expectedCommitVersion === right.expectedCommitVersion
    && left.draft.nodeId === right.draft.nodeId
    && (left.draft.activityId ?? null) === (right.draft.activityId ?? null)
    && left.draft.round === right.draft.round
    && left.draft.draftVersion === right.draft.draftVersion;
}

function invalidMapResourceDefinition(message: string): never {
  throw new MapRunError([message]);
}

function initialResourceBalances(
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): { actorResources: MapRunActorResourceBalance[]; teamResources: MapRunTeamResourceBalance[] } {
  const actorResourceIds = new Set<string>();
  const teamResourceIds = new Set<string>();
  const initialActorValues = new Map<string, number>();
  const initialTeamValues = new Map<string, number>();
  const partyIds = new Set(party.map(member => member.characterId));

  if (definition.actions !== undefined && !Array.isArray(definition.actions)) {
    invalidMapResourceDefinition(`Map "${definition.id}" has invalid Action definitions`);
  }
  for (const action of definition.actions ?? []) {
    if (!isRecord(action)) invalidMapResourceDefinition(`Map "${definition.id}" has an invalid Action`);
    for (const field of ['costs', 'effects'] as const) {
      const rows: unknown = action[field];
      if (rows === undefined) continue;
      if (!Array.isArray(rows)) {
        invalidMapResourceDefinition(`Map Action "${action.id}" has invalid ${field}`);
      }
      for (const row of rows) {
        if (!isRecord(row) || (row.scope !== 'actor' && row.scope !== 'team') || !isNonEmptyId(row.resourceId)) {
          invalidMapResourceDefinition(`Map Action "${action.id}" has an invalid ${field} resource`);
        }
        (row.scope === 'actor' ? actorResourceIds : teamResourceIds).add(row.resourceId);
      }
    }
  }

  const actorInitials: unknown = definition.initialActorResources;
  if (actorInitials !== undefined && !Array.isArray(actorInitials)) {
    invalidMapResourceDefinition(`Map "${definition.id}" has invalid initial Actor resources`);
  }
  for (const row of (actorInitials ?? []) as unknown[]) {
    if (!isRecord(row) || !isNonEmptyId(row.characterId) || !partyIds.has(row.characterId)
      || !isNonEmptyId(row.resourceId) || !Number.isSafeInteger(row.value) || (row.value as number) < 0) {
      invalidMapResourceDefinition(`Map "${definition.id}" has an invalid initial Actor resource`);
    }
    const key = actorResourceKey(row.characterId, row.resourceId);
    if (initialActorValues.has(key)) {
      invalidMapResourceDefinition(`Map "${definition.id}" has a duplicate initial Actor resource`);
    }
    actorResourceIds.add(row.resourceId);
    initialActorValues.set(key, row.value as number);
  }

  const teamInitials: unknown = definition.initialTeamResources;
  if (teamInitials !== undefined && !Array.isArray(teamInitials)) {
    invalidMapResourceDefinition(`Map "${definition.id}" has invalid initial Team resources`);
  }
  for (const row of (teamInitials ?? []) as unknown[]) {
    if (!isRecord(row) || !isNonEmptyId(row.resourceId)
      || !Number.isSafeInteger(row.value) || (row.value as number) < 0) {
      invalidMapResourceDefinition(`Map "${definition.id}" has an invalid initial Team resource`);
    }
    if (initialTeamValues.has(row.resourceId)) {
      invalidMapResourceDefinition(`Map "${definition.id}" has a duplicate initial Team resource`);
    }
    teamResourceIds.add(row.resourceId);
    initialTeamValues.set(row.resourceId, row.value as number);
  }

  const orderedActorResourceIds = [...actorResourceIds].sort(compareIds);
  const orderedTeamResourceIds = [...teamResourceIds].sort(compareIds);
  return {
    actorResources: party.flatMap(member => orderedActorResourceIds.map(resourceId => ({
      characterId: member.characterId,
      resourceId,
      value: initialActorValues.get(actorResourceKey(member.characterId, resourceId)) ?? 0,
    }))),
    teamResources: orderedTeamResourceIds.map(resourceId => ({
      resourceId,
      value: initialTeamValues.get(resourceId) ?? 0,
    })),
  };
}

function initialPartyHp(definition: ResolvedMap, party: readonly MapRunPartyMember[]): MapRunPartyHp[] {
  const rows: unknown = definition.initialPartyHp;
  if (!Array.isArray(rows) || rows.length !== party.length) {
    invalidMapResourceDefinition(`Map "${definition.id}" must declare starting HP for every fixed party member`);
  }
  return party.map((member, index) => {
    const row: unknown = rows[index];
    if (!isRecord(row) || row.characterId !== member.characterId
      || !Number.isSafeInteger(row.initialHp) || !Number.isSafeInteger(row.maxHp)
      || (row.maxHp as number) < 1 || (row.initialHp as number) < 1
      || (row.initialHp as number) > (row.maxHp as number)) {
      invalidMapResourceDefinition(`Map "${definition.id}" has invalid starting HP for "${member.characterId}"`);
    }
    return { characterId: member.characterId, currentHp: row.initialHp as number };
  });
}

function partyHpCaps(definition: ResolvedMap, party: readonly MapRunPartyMember[]): ReadonlyMap<string, number> {
  const rows: unknown = definition.initialPartyHp;
  if (!Array.isArray(rows) || rows.length !== party.length) return new Map();
  const caps = new Map<string, number>();
  for (const [index, member] of party.entries()) {
    const row = rows[index];
    if (!isRecord(row) || row.characterId !== member.characterId
      || !Number.isSafeInteger(row.maxHp) || (row.maxHp as number) < 1) return new Map();
    caps.set(member.characterId, row.maxHp as number);
  }
  return caps;
}

function initialPartyAgility(
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRun['partyAgility'] {
  if (definition.executionContractId !== 'AG-1') return undefined;
  const authored = new Map((definition.partyAgility ?? []).map(row => [row.characterId, row.agility]));
  return party.map(member => ({ characterId: member.characterId, agility: authored.get(member.characterId) ?? 0 }));
}

function initialEnemyAgility(
  definition: ResolvedMap,
  encounter: GameplayEncounterDef,
): MapRunEncounterSnapshot['enemyAgility'] {
  if (definition.executionContractId !== 'AG-1') return undefined;
  return (encounter.enemies ?? []).map(enemy => ({ enemyId: enemy.id, agility: enemy.agility ?? 0 }));
}

function restoreAgilitySnapshot<T extends { readonly agility: number }>(
  value: unknown,
  expected: readonly T[] | undefined,
  identityKey: 'characterId' | 'enemyId',
): readonly T[] | null | undefined {
  if (expected === undefined) return value === undefined ? undefined : null;
  if (!Array.isArray(value) || value.length !== expected.length) return null;
  const restored: T[] = [];
  for (const [index, raw] of value.entries()) {
    const expectedRow = expected[index] as (T & Record<typeof identityKey, string>) | undefined;
    if (!expectedRow || !isRecord(raw)) return null;
    const keys = Reflect.ownKeys(raw);
    if (keys.length !== 2 || keys.some(key => key !== identityKey && key !== 'agility')) return null;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const identity = descriptors[identityKey];
    const agility = descriptors.agility;
    if (!identity || !('value' in identity) || identity.get || identity.set
      || !agility || !('value' in agility) || agility.get || agility.set
      || identity.value !== expectedRow[identityKey]
      || !Number.isSafeInteger(agility.value) || agility.value < 0
      || agility.value !== expectedRow.agility) return null;
    restored.push({ ...expectedRow });
  }
  return restored;
}

function partyHealthForHandDraw(
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
  partyHp: readonly MapRunPartyHp[],
): { readonly characterId: string; readonly currentHp: number; readonly maxHp: number }[] {
  const caps = partyHpCaps(definition, party);
  const currentHp = new Map(partyHp.map(row => [row.characterId, row.currentHp]));
  if (caps.size !== party.length || currentHp.size !== party.length) {
    throw new MapRunError(['Hand draw requires current party HP and Map HP caps']);
  }
  return party.map(member => {
    const maxHp = caps.get(member.characterId);
    const hp = currentHp.get(member.characterId);
    if (maxHp === undefined || hp === undefined) {
      throw new MapRunError(['Hand draw is missing HP for Character "' + member.characterId + '"']);
    }
    return { characterId: member.characterId, currentHp: hp, maxHp };
  });
}

function restoreActorResourceBalances(
  value: unknown,
  expected: readonly MapRunActorResourceBalance[],
): MapRunActorResourceBalance[] | null {
  if (!Array.isArray(value) || value.length !== expected.length) return null;
  const result: MapRunActorResourceBalance[] = [];
  for (const [index, row] of value.entries()) {
    const identity = expected[index];
    if (!identity || !isRecord(row)
      || row.characterId !== identity.characterId
      || row.resourceId !== identity.resourceId
      || !Number.isSafeInteger(row.value)
      || (row.value as number) < 0) return null;
    result.push({ characterId: identity.characterId, resourceId: identity.resourceId, value: row.value as number });
  }
  return result;
}

function restoreTeamResourceBalances(
  value: unknown,
  expected: readonly MapRunTeamResourceBalance[],
): MapRunTeamResourceBalance[] | null {
  if (!Array.isArray(value) || value.length !== expected.length) return null;
  const result: MapRunTeamResourceBalance[] = [];
  for (const [index, row] of value.entries()) {
    const identity = expected[index];
    if (!identity || !isRecord(row)
      || row.resourceId !== identity.resourceId
      || !Number.isSafeInteger(row.value)
      || (row.value as number) < 0) return null;
    result.push({ resourceId: identity.resourceId, value: row.value as number });
  }
  return result;
}

function restorePartyHp(
  value: unknown,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunPartyHp[] | null {
  const caps = partyHpCaps(definition, party);
  if (caps.size !== party.length || !Array.isArray(value) || value.length !== party.length) return null;
  const result: MapRunPartyHp[] = [];
  for (const [index, rawRow] of value.entries()) {
    const member = party[index];
    if (!member || !isRecord(rawRow) || Object.keys(rawRow).length !== 2
      || Object.keys(rawRow).some(key => !['characterId', 'currentHp'].includes(key))
      || rawRow.characterId !== member.characterId
      || !Number.isSafeInteger(rawRow.currentHp) || (rawRow.currentHp as number) < 0
      || (rawRow.currentHp as number) > (caps.get(member.characterId) ?? -1)) return null;
    result.push({ characterId: member.characterId, currentHp: rawRow.currentHp as number });
  }
  return result;
}

function initializeEncounterSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/** Derives the next activity's fresh Hand seed from detached, committed Encounter RNG state. */
function nextActivityRandomState(current: MapRunHandRandomState): MapRunHandRandomState {
  const mask = (1n << 64n) - 1n;
  let word = BigInt.asUintN(64, BigInt(current.seed)) + 0x9E3779B97F4A7C15n * (BigInt(current.cursor) + 1n);
  word &= mask;
  word = ((word ^ (word >> 30n)) * 0xBF58476D1CE4E5B9n) & mask;
  word = ((word ^ (word >> 27n)) * 0x94D049BB133111EBn) & mask;
  word ^= word >> 31n;
  return {
    algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
    seed: Number(word & 0xFFFF_FFFFn),
    cursor: 0,
  };
}

interface CreateEncounterSnapshotOptions {
  readonly round?: number;
  readonly randomState?: MapRunHandRandomState;
  readonly retainedEnemies?: readonly MapRunEnemyHp[];
  readonly retainedEnemyActorResources?: readonly MapRunEnemyActorResourceBalance[];
  readonly retainedEnemyTeamResources?: readonly MapRunTeamResourceBalance[];
  readonly activityId?: string;
  readonly retainedLocals?: MapRunEncounterSnapshot['locals'];
  readonly retainedStatuses?: readonly MapEncounterStatusInstance[];
  readonly retainedEffectRandomState?: MapEffectRandomState;
  readonly retainedShields?: MapEffectShieldLedger;
  readonly retainedCandidateSourceSnapshot?: MapRunCandidateSourceSnapshot;
  readonly candidateSourceFacts?: MapRunFactState;
}

function createEncounterSnapshot(
  definition: ResolvedMap,
  nodeId: string,
  encounter: GameplayEncounterDef,
  party: readonly MapRunPartyMember[],
  actorResources: readonly MapRunActorResourceBalance[],
  teamResources: readonly MapRunTeamResourceBalance[],
  partyHp: readonly MapRunPartyHp[],
  options: CreateEncounterSnapshotOptions = {},
): MapRunEncounterSnapshot {
  const {
    round = 1, randomState, retainedEnemies, retainedEnemyActorResources, retainedEnemyTeamResources,
    activityId, retainedLocals, retainedStatuses, retainedEffectRandomState, retainedShields,
    retainedCandidateSourceSnapshot, candidateSourceFacts,
  } = options;
  const enemyDefinitions: unknown = encounter.enemies ?? [];
  if (!Array.isArray(enemyDefinitions)) throw new MapRunError([`Encounter "${nodeId}" has an invalid Enemy roster`]);
  const enemyIds = new Set<string>();
  for (const enemy of enemyDefinitions) {
    if (!isRecord(enemy) || !isNonEmptyId(enemy.id) || enemyIds.has(enemy.id)
      || !Number.isSafeInteger(enemy.maxHp) || (enemy.maxHp as number) < 1
      || !Number.isSafeInteger(enemy.initialHp) || (enemy.initialHp as number) < 1
      || (enemy.initialHp as number) > (enemy.maxHp as number)) {
      throw new MapRunError([`Encounter "${nodeId}" has an invalid Enemy definition`]);
    }
    enemyIds.add(enemy.id);
  }
  const startingState: MapRunHandRandomState = randomState ?? {
    algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
    seed: initializeEncounterSeed(),
    cursor: 0,
  };
  let effectRandomState: MapEffectRandomState | undefined;
  if (definition.executionContractId === 'AG-1') {
    try {
      const initialEffectState = createMapEffectRandomState(startingState.seed);
      effectRandomState = copyMapEffectRandomState(retainedEffectRandomState ?? initialEffectState);
      if (effectRandomState.seed !== initialEffectState.seed) {
        throw new Error('retained Effect Random seed does not match the Encounter Hand seed');
      }
    } catch (error) {
      throw new MapRunError([error instanceof Error ? error.message : String(error)]);
    }
  }
  let candidateSourceSnapshot: MapRunCandidateSourceSnapshot | undefined;
  if (hasFactGatedCandidatePools(definition)) {
    if (retainedCandidateSourceSnapshot !== undefined) {
      const restored = restoreCandidateSourceSnapshot(retainedCandidateSourceSnapshot,
        { candidateSourceSnapshot: retainedCandidateSourceSnapshot }, definition);
      if (!restored) throw new MapRunError([`Map "${definition.id}" has invalid retained candidate Fact input`]);
      candidateSourceSnapshot = restored;
    } else {
      candidateSourceSnapshot = createCandidateSourceSnapshot(definition, candidateSourceFacts);
    }
  } else if (retainedCandidateSourceSnapshot !== undefined) {
    throw new MapRunError([`Map "${definition.id}" cannot retain candidate Facts without a gated Pool`]);
  }
  const enemies: MapRunEnemyHp[] = retainedEnemies === undefined
    ? (encounter.enemies ?? []).map(enemy => ({ enemyId: enemy.id, currentHp: enemy.initialHp }))
    : retainedEnemies.map(enemy => ({ ...enemy }));
  const enemyActorResources = retainedEnemyActorResources === undefined
    ? (encounter.enemies ?? []).flatMap(enemy => (enemy.initialResources ?? []).map(resource => ({
      enemyId: enemy.id,
      resourceId: resource.resourceId,
      value: resource.value,
    })))
    : retainedEnemyActorResources.map(balance => ({ ...balance }));
  const enemyTeamResources = retainedEnemyTeamResources === undefined
    ? (encounter.initialEnemyTeamResources ?? []).map(resource => ({ ...resource }))
    : retainedEnemyTeamResources.map(balance => ({ ...balance }));
  const enemyAgility = initialEnemyAgility(definition, encounter);
  const enemyDefinitionById = new Map((encounter.enemies ?? []).map(enemy => [enemy.id, enemy]));
  try {
    const draw = drawGameplayBHands({
      partyCharacterIds: party.map(member => member.characterId),
      enemies: encounter.enemies,
      enemyHealth: enemies.map(enemy => ({
        enemyId: enemy.enemyId,
        currentHp: enemy.currentHp,
        maxHp: enemyDefinitionById.get(enemy.enemyId)!.maxHp,
      })),
      enemyActorResources,
      enemyTeamResources,
      participants: encounter.participants,
      actions: definition.actions,
      candidatePools: definition.candidatePools,
      executionContractId: definition.executionContractId,
      mapRunFacts: definition.mapRunFacts,
      candidateSourceSnapshot,
      actorResources,
      teamResources,
      partyHealth: partyHealthForHandDraw(definition, party, partyHp),
      livingPartyCharacterIds: partyHp.filter(row => row.currentHp > 0).map(row => row.characterId),
      livingEnemyIds: enemies.filter(enemy => enemy.currentHp > 0).map(enemy => enemy.enemyId),
      randomState: startingState,
    });
    return {
      nodeId,
      ...(encounter.locals === undefined && retainedLocals === undefined ? {} : {
        locals: retainedLocals === undefined
          ? initializeMapEncounterLocals(encounter.locals)
          : copyMapEncounterLocalsState(retainedLocals, encounter.locals),
      }),
      ...((definition.statuses?.length ?? 0) === 0 && (retainedStatuses?.length ?? 0) === 0 ? {} : {
        statuses: copyMapEncounterStatusInstances(retainedStatuses ?? []),
      }),
      ...(activityId === undefined ? {} : { activityId }),
      round,
      hands: draw.hands,
      enemyHands: draw.enemyHands,
      enemyActorResources,
      enemyTeamResources,
      overrides: [],
      targetSelections: [],
      enemies,
      ...(enemyAgility === undefined ? {} : { enemyAgility }),
      draftVersion: 0,
      drawCursorStart: startingState.cursor,
      randomState: draw.randomState,
      ...(effectRandomState === undefined ? {} : { effectRandomState }),
      ...(gameplayMapUsesShieldAdd(definition) ? { shields: copyShieldLedger(retainedShields ?? {}) } : {}),
      ...(candidateSourceSnapshot === undefined ? {} : { candidateSourceSnapshot }),
      lastCommit: null,
    };
  } catch (error) {
    throw new MapRunError([error instanceof Error ? error.message : String(error)]);
  }
}

interface EnteredNodeState {
  readonly activeActivity: MapRunActiveActivity | null;
  readonly activeEncounter: MapRunEncounterSnapshot | null;
}

/**
 * Opens the first unfinished activity of an ordered Node, or the legacy single
 * Encounter. Returns both active fields so callers never desynchronize them.
 */
function openNodeContent(
  definition: ResolvedMap,
  node: GameplayMapNodeDef,
  party: readonly MapRunPartyMember[],
  actorResources: readonly MapRunActorResourceBalance[],
  teamResources: readonly MapRunTeamResourceBalance[],
  partyHp: readonly MapRunPartyHp[],
  completedActivityIds: readonly string[],
  fromIndex = 0,
  activityRandomState?: MapRunHandRandomState,
  candidateSourceFacts?: MapRunFactState,
): EnteredNodeState {
  const activities = nodeActivities(node);
  if (activities.length === 0) {
    return {
      activeActivity: null,
      activeEncounter: node.encounter
        ? createEncounterSnapshot(definition, node.id, node.encounter, party, actorResources, teamResources, partyHp,
          { candidateSourceFacts })
        : null,
    };
  }
  const index = nextUnfinishedActivityIndex(activities, completedActivityIds, node.id, fromIndex);
  if (index < 0) return { activeActivity: null, activeEncounter: null };
  const activity = activities[index];
  const kind = activityKind(activity);
  const activeActivity: MapRunActiveActivity = {
    nodeId: node.id,
    activityId: activity.id,
    index,
    kind,
    shopDraftVersion: 0,
    lastPurchase: null,
  };
  if (kind === 'shop') return { activeActivity, activeEncounter: null };
  if (!activity.encounter) throw new MapRunError([`Node "${node.id}" Activity "${activity.id}" declares no content`]);
  return {
    activeActivity,
    activeEncounter: createEncounterSnapshot(
      definition,
      node.id,
      activity.encounter,
      party,
      actorResources,
      teamResources,
      partyHp,
      { round: 1, randomState: activityRandomState, activityId: activity.id, candidateSourceFacts },
    ),
  };
}

interface ActivityAdvanceResult {
  readonly run: MutableMapRun;
  readonly success: boolean;
  readonly nodeCompleted: boolean;
}

/**
 * Marks the current activity complete and opens the next fixed activity, or
 * completes the Node when nothing remains. Never re-applies the prior effect.
 */
function advanceCompletedActivity(
  definition: ResolvedMap,
  run: MutableMapRun,
  encounterNodeId: string,
  encounterActivityId: string | undefined,
  nextActivityRandomState?: MapRunHandRandomState,
): ActivityAdvanceResult {
  const node = definition.nodes.find(candidate => candidate.id === encounterNodeId);
  const activities = node ? nodeActivities(node) : [];
  if (!node || activities.length === 0 || encounterActivityId === undefined) {
    const completedEncounterNodeIds = run.completedEncounterNodeIds.includes(encounterNodeId)
      ? [...run.completedEncounterNodeIds]
      : [...run.completedEncounterNodeIds, encounterNodeId];
    return {
      run: { ...run, completedEncounterNodeIds, activeActivity: null, activeEncounter: null },
      success: definition.exitNodeIds.includes(encounterNodeId),
      nodeCompleted: true,
    };
  }

  const completedActivityIds = run.completedActivityIds.includes(activityCompletedKey(encounterNodeId, encounterActivityId))
    ? [...run.completedActivityIds]
    : [...run.completedActivityIds, activityCompletedKey(encounterNodeId, encounterActivityId)];
  const currentIndex = activities.findIndex(activity => activity.id === encounterActivityId);
  const next = openNodeContent(
    definition,
    node,
    run.party,
    run.actorResources,
    run.teamResources,
    run.partyHp,
    completedActivityIds,
    currentIndex + 1,
    nextActivityRandomState,
    run.mapRunFacts,
  );
  if (next.activeActivity !== null) {
    return {
      run: { ...run, completedActivityIds, activeActivity: next.activeActivity, activeEncounter: next.activeEncounter },
      success: false,
      nodeCompleted: false,
    };
  }
  const completedEncounterNodeIds = run.completedEncounterNodeIds.includes(encounterNodeId)
    ? [...run.completedEncounterNodeIds]
    : [...run.completedEncounterNodeIds, encounterNodeId];
  return {
    run: { ...run, completedActivityIds, completedEncounterNodeIds, activeActivity: null, activeEncounter: null },
    success: definition.exitNodeIds.includes(encounterNodeId),
    nodeCompleted: true,
  };
}

/** Evaluates the restricted completion predicate through U06's normalized condition kernel. */
function encounterCompletionSatisfied(
  condition: GameplayMapEffectConditionDef,
  locals: MapEffectLocalsState,
): boolean {
  const annotateCondition = (value: GameplayMapEffectConditionDef, path: string): NormalizedGameplayMapEffectCondition => {
    const origin = { originPath: path, mode: 'program' as const };
    if (value.kind === 'not') return { ...value, ...origin, condition: annotateCondition(value.condition, `${path}.condition`) };
    if (value.kind === 'all' || value.kind === 'any') {
      return { ...value, ...origin, conditions: value.conditions.map((child, index) =>
        annotateCondition(child, `${path}.conditions[${index}]`)) };
    }
    return { ...value, ...origin } as NormalizedGameplayMapEffectCondition;
  };
  const instruction: NormalizedGameplayMapEffectInstruction = {
    op: 'when',
    condition: annotateCondition(condition, 'Encounter.completion.condition'),
    then: [],
    originPath: 'Encounter.completion',
    mode: 'program',
  };
  const effects: NormalizedGameplayMapActionEffects = {
    budget: 'program-4096',
    prepare: [],
    resolve: [instruction],
  };
  try {
    const evaluated = planMapEffectSource({
      input: {
        sourceKey: 'completion-condition',
        actionId: 'Encounter.completion',
        source: null,
        primary: null,
        sourceTeam: { kind: 'team', side: 'party' },
        preparedPartyTagSources: [],
        hp: {},
        locals,
      },
      effects,
      // The completion predicate is an Encounter terminal check, outside Action visits/trace.
      visit: () => undefined,
    });
    const trace = [...evaluated.trace].reverse().find(row => row.op === 'when');
    if (!trace || trace.op !== 'when') throw new MapRunError(['Encounter completion condition produced no result']);
    return trace.result;
  } catch (error) {
    if (error instanceof MapRunError) throw error;
    throw new MapRunError([error instanceof Error ? error.message : String(error)]);
  }
}

type SettlementActor = { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string } | null;
type SettlementUnitTarget = { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string } | null;

function settlementUnitTarget(
  targetCharacterId: string | null,
  targetEnemyId: string | null,
): SettlementUnitTarget {
  if (targetCharacterId !== null && targetEnemyId !== null) {
    throw new MapRunError(['an Action cannot resolve both a party and Enemy unit target']);
  }
  return targetCharacterId !== null ? { kind: 'partyCharacter', id: targetCharacterId }
    : targetEnemyId !== null ? { kind: 'enemy', id: targetEnemyId } : null;
}

function normalizeMapRunActionEffects(action: GameplayMapActionDef): ReturnType<typeof normalizeMapActionEffects> {
  try {
    const effectDefinition = Object.prototype.hasOwnProperty.call(action, 'agility')
      ? Object.fromEntries(Object.entries(action).filter(([key]) => key !== 'agility')) as unknown as GameplayMapActionDef
      : action;
    return normalizeMapActionEffects(effectDefinition);
  } catch (error) {
    throw new MapRunError([error instanceof Error ? error.message : String(error)]);
  }
}

function freezeProgramSource(source: MapEffectProgramSourceIdentity): MapEffectProgramSourceIdentity {
  return Object.freeze({ ...source });
}

function freezeProgramTraceEntry(entry: MapEffectTraceEntry): MapEffectTraceEntry {
  const source = entry.source ? freezeProgramSource(entry.source) : undefined;
  const identity = entry.identity ? Object.freeze({ ...entry.identity }) : undefined;
  const damageReduction = entry.op === 'damage' && entry.damageReduction ? Object.freeze({
    total: entry.damageReduction.total,
    sources: Object.freeze(entry.damageReduction.sources.map(row => Object.freeze({
      ...row,
      source: freezeProgramSource(row.source),
    }))),
  }) : undefined;
  const damageProtection = entry.op === 'damage' && entry.damageProtection ? Object.freeze({
    ...entry.damageProtection,
    statusBefore: Object.freeze({
      ...entry.damageProtection.statusBefore,
      holder: Object.freeze({ ...entry.damageProtection.statusBefore.holder }),
      source: freezeProgramSource(entry.damageProtection.statusBefore.source),
    }),
    statusAfter: entry.damageProtection.statusAfter === null ? null : Object.freeze({
      ...entry.damageProtection.statusAfter,
      holder: Object.freeze({ ...entry.damageProtection.statusAfter.holder }),
      source: freezeProgramSource(entry.damageProtection.statusAfter.source),
    }),
  }) : undefined;
  if (entry.op === 'targetSet') return Object.freeze({
    ...entry,
    ...(source ? { source } : {}),
    selector: entry.selector ? Object.freeze({ ...entry.selector }) : null,
    identities: Object.freeze(entry.identities.map(candidate => Object.freeze({ ...candidate }))),
  });
  if ('batch' in entry && entry.batch) return Object.freeze({
    ...entry, ...(source ? { source } : {}), ...(identity ? { identity } : {}),
    ...(damageReduction ? { damageReduction } : {}), ...(damageProtection ? { damageProtection } : {}),
    batch: Object.freeze({ ...entry.batch }),
  }) as MapEffectTraceEntry;
  if (entry.op === 'discountSCost') {
    return Object.freeze({
      ...entry,
      ...(source ? { source } : {}),
      targetCard: Object.freeze({ ...entry.targetCard, scope: Object.freeze({ ...entry.targetCard.scope }) }),
      receiver: entry.receiver ? Object.freeze({ ...entry.receiver }) : null,
    });
  }
  if (entry.op === 'when') return Object.freeze({
    ...entry,
    ...(source ? { source } : {}),
    reads: Object.freeze(entry.reads.map(read => Object.freeze({
      ...read,
      ...('identity' in read ? { identity: Object.freeze({ ...read.identity }) } : {}),
    }))),
  }) as MapEffectTraceEntry;
  return Object.freeze({ ...entry, ...(source ? { source } : {}), ...(identity ? { identity } : {}),
    ...(damageReduction ? { damageReduction } : {}), ...(damageProtection ? { damageProtection } : {}) }) as MapEffectTraceEntry;
}

function freezeMapEffectStatusRemoveTrace(entry: MapEffectStatusRemoveTraceEntry): MapEffectStatusRemoveTraceEntry {
  return Object.freeze({
    ...entry,
    ...(entry.source ? { source: freezeProgramSource(entry.source) } : {}),
    ...(entry.identity ? { identity: Object.freeze({ ...entry.identity }) } : {}),
    removed: Object.freeze(entry.removed.map(row => Object.freeze({
      statusIndexBefore: row.statusIndexBefore,
      status: Object.freeze({
        ...row.status,
        holder: Object.freeze({ ...row.status.holder }),
        source: freezeProgramSource(row.status.source),
      }),
    }))),
  });
}

function freezeMapEffectStatusConsumeTrace(entry: MapEffectStatusConsumeTraceEntry): MapEffectStatusConsumeTraceEntry {
  const freezeStatus = (status: MapEncounterStatusInstance): MapEncounterStatusInstance => Object.freeze({
    ...status,
    holder: Object.freeze({ ...status.holder }),
    source: freezeProgramSource(status.source),
  });
  return Object.freeze({
    ...entry,
    ...(entry.source ? { source: freezeProgramSource(entry.source) } : {}),
    ...(entry.identity ? { identity: Object.freeze({ ...entry.identity }) } : {}),
    changes: Object.freeze(entry.changes.map(change => Object.freeze({
      statusIndexBefore: change.statusIndexBefore,
      statusBefore: freezeStatus(change.statusBefore),
      consumedStacks: change.consumedStacks,
      statusAfter: change.statusAfter === null ? null : freezeStatus(change.statusAfter),
    }))),
  });
}

function freezeMapEffectStatusCategoryRemoveTrace(entry: MapEffectStatusCategoryRemoveTraceEntry): MapEffectStatusCategoryRemoveTraceEntry {
  return Object.freeze({
    ...entry,
    ...(entry.source ? { source: freezeProgramSource(entry.source) } : {}),
    identity: Object.freeze({ ...entry.identity }),
    removed: Object.freeze(entry.removed.map(row => Object.freeze({
      statusIndexBefore: row.statusIndexBefore,
      status: Object.freeze({ ...row.status, holder: Object.freeze({ ...row.status.holder }), source: freezeProgramSource(row.status.source) }),
    }))),
  });
}

function settlementChangesFor(
  action: GameplayMapActionDef,
  actor: SettlementActor,
  target: SettlementUnitTarget,
  scostDiscount = 0n,
  options: {
    readonly programPlan?: ReturnType<typeof planMapEffectSource>;
    readonly programCostProbe?: boolean;
    readonly onProgramResourceChange?: (change: MapRunEncounterSettlementResourceChange, entry: MapEffectResourceLedgerEntry) => void;
  } = {},
): MapRunEncounterSettlementResourceChange[] {
  const changes: MapRunEncounterSettlementResourceChange[] = [];
  const rawCosts: unknown = action.costs ?? [];
  if (!Array.isArray(rawCosts)) throw new MapRunError([`Action "${action.id}" costs must be an array`]);
  for (const rawCost of rawCosts) {
    if (!isRecord(rawCost) || (rawCost.scope !== 'actor' && rawCost.scope !== 'team')
      || !isNonEmptyId(rawCost.resourceId) || !Number.isSafeInteger(rawCost.amount)
      || (rawCost.amount as number) <= 0) {
      throw new MapRunError([`Action "${action.id}" has an invalid resource cost`]);
    }
    let cost = BigInt(rawCost.amount as number);
    if (rawCost.scope === 'actor' && rawCost.resourceId === 'sCost') {
      const reduction = scostDiscount < cost ? scostDiscount : cost;
      cost -= reduction;
      scostDiscount -= reduction;
    }
    if (rawCost.scope === 'actor' && actor === null) {
      throw new MapRunError([`Actor cost on Action "${action.id}" has no owning unit`]);
    }
    changes.push({
      kind: 'cost',
      scope: rawCost.scope,
      ...(rawCost.scope === 'actor' && actor?.kind === 'partyCharacter' ? { characterId: actor.id } : {}),
      ...(rawCost.scope === 'actor' && actor?.kind === 'enemy' ? { enemyId: actor.id } : {}),
      ...(rawCost.scope === 'team' && actor?.kind === 'enemy' ? { teamSide: 'enemy' as const } : {}),
      resourceId: rawCost.resourceId,
      delta: cost === 0n ? 0 : -Number(cost),
    });
  }

  const effects = normalizeMapRunActionEffects(action);
  const resourceLedger = options.programPlan?.resourceLedger
    ?? (options.programCostProbe || action.effectProgram === undefined ? [] : null);
  if (resourceLedger === null) throw new MapRunError([`Action "${action.id}" must be planned by the authoritative Encounter planner`]);
  for (const entry of resourceLedger) {
    const change: MapRunEncounterSettlementResourceChange = {
      kind: 'effect',
      scope: entry.account === 'sourceTeam' ? 'team' : 'actor',
      ...(entry.identity.kind === 'partyCharacter' ? { characterId: entry.identity.id } : {}),
      ...(entry.identity.kind === 'enemy' ? { enemyId: entry.identity.id } : {}),
      ...(entry.identity.kind === 'team' && entry.identity.side === 'enemy' ? { teamSide: 'enemy' as const } : {}),
      resourceId: entry.resourceId,
      delta: entry.delta,
    };
    changes.push(change);
    options.onProgramResourceChange?.(change, entry);
  }
  return changes;
}

function freezeCommitSettlements(
  settlements: readonly MapRunEncounterActionSettlement[],
): readonly MapRunEncounterActionSettlement[] {
  return Object.freeze(settlements.map(settlement => Object.freeze({
    ...settlement,
    ...(settlement.additionalTarget === undefined ? {} : { additionalTarget: cloneSourceTarget(settlement.additionalTarget) }),
    ...(settlement.targetCard ? { targetCard: parseMapRunCardRef(settlement.targetCard)! } : {}),
    ...(settlement.scostCost ? { scostCost: Object.freeze({ ...settlement.scostCost }) } : {}),
    ...(settlement.hpChanges ? { hpChanges: Object.freeze(settlement.hpChanges.map(change => Object.freeze({ ...change }))) } : {}),
    resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
  })));
}

function freezeEnemyActionSettlements(
  settlements: readonly MapRunEncounterEnemyActionSettlement[],
): readonly MapRunEncounterEnemyActionSettlement[] {
  return Object.freeze(settlements.map(settlement => Object.freeze({
    ...settlement,
    ...(settlement.targetCard ? { targetCard: parseMapRunCardRef(settlement.targetCard)! } : {}),
    resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
    ...(settlement.hpChanges ? { hpChanges: Object.freeze(settlement.hpChanges.map(change => Object.freeze({ ...change }))) } : {}),
  })));
}

function isActorlessSourceAction(action: GameplayMapActionDef | undefined): action is GameplayMapActionDef {
  if (!action || action.eligibleCharacterIds.length !== 0
    || (action.target.kind !== 'enemy' && action.target.kind !== 'partyCharacter')
    || (action.costs?.length ?? 0) !== 0 || action.effectProgram === undefined) return false;
  let effects: ReturnType<typeof normalizeMapActionEffects>;
  try { effects = normalizeMapRunActionEffects(action); } catch { return false; }
  const hasSourceActorResourceChange = (instructions: readonly NormalizedGameplayMapEffectInstruction[]): boolean =>
    instructions.some(instruction => instruction.op === 'resourceChange'
      ? instruction.account === 'sourceActor'
      : instruction.op === 'when'
        && (hasSourceActorResourceChange(instruction.then)
          || hasSourceActorResourceChange(instruction.else ?? [])));
  return !hasSourceActorResourceChange(effects.resolve);
}

function actionHasE2HpExpansion(action: GameplayMapActionDef): boolean {
  const visit = (instructions: readonly GameplayMapEffectStatementDef[]): boolean =>
    instructions.some(instruction => instruction.op === 'damage' || instruction.op === 'heal'
      ? typeof instruction.target === 'object' || typeof instruction.amount !== 'number' || instruction.repeat !== undefined
      : instruction.op === 'when' && (visit(instruction.then) || visit(instruction.else ?? [])));
  return visit(action.effectProgram?.resolve ?? []);
}

function restoreHpChangeEntries(
  value: unknown,
  action: GameplayMapActionDef,
  expectedIdentity: { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string } | null,
  partyIds: ReadonlySet<string>,
  enemyIds: ReadonlySet<string>,
): MapRunEncounterHpChange[] | null {
  if (!Array.isArray(value)) return null;
  const expanded = actionHasE2HpExpansion(action);
  const result: MapRunEncounterHpChange[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || !Number.isSafeInteger(raw.delta)) return null;
    if (raw.scope === 'party') {
      if (Object.keys(raw).length !== 3 || Object.keys(raw).some(key => !['scope', 'characterId', 'delta'].includes(key))
        || !isNonEmptyId(raw.characterId) || !partyIds.has(raw.characterId)
        || (!expanded && (expectedIdentity?.kind !== 'partyCharacter' || expectedIdentity.id !== raw.characterId))) return null;
      result.push({ scope: 'party', characterId: raw.characterId, delta: raw.delta as number });
    } else if (raw.scope === 'enemy') {
      if (Object.keys(raw).length !== 3 || Object.keys(raw).some(key => !['scope', 'enemyId', 'delta'].includes(key))
        || !isNonEmptyId(raw.enemyId) || !enemyIds.has(raw.enemyId)
        || (!expanded && (expectedIdentity?.kind !== 'enemy' || expectedIdentity.id !== raw.enemyId))) return null;
      result.push({ scope: 'enemy', enemyId: raw.enemyId, delta: raw.delta as number });
    } else return null;
  }
  return result;
}

function actorlessSourceAction(slot: MapRunSlot, actionId: string, label: string): GameplayMapActionDef {
  const action = (slot.definition.actions ?? []).find(candidate => candidate.id === actionId);
  if (!isActorlessSourceAction(action)) {
    throw new MapRunError([`${label} Action "${actionId}" is not a legal actorless source`]);
  }
  return action;
}

function parseSourceTarget(value: unknown): MapRunEncounterSourceTarget | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (value.kind === 'partyCharacter' && keys.length === 2
    && keys.every(key => ['kind', 'characterId'].includes(key)) && isNonEmptyId(value.characterId)) {
    return { kind: 'partyCharacter', characterId: value.characterId };
  }
  if (value.kind === 'enemy' && keys.length === 2
    && keys.every(key => ['kind', 'enemyId'].includes(key)) && isNonEmptyId(value.enemyId)) {
    return { kind: 'enemy', enemyId: value.enemyId };
  }
  return undefined;
}

function validateSourceTarget(
  target: MapRunEncounterSourceTarget | null,
  action: GameplayMapActionDef,
  slot: MapRunSlot,
  label: string,
): asserts target is MapRunEncounterSourceTarget {
  const encounter = slot.run.activeEncounter;
  if (!target || action.target.kind !== target.kind) {
    throw new MapRunError([`${label} Action "${action.id}" has an invalid or missing target`]);
  }
  if (target.kind === 'partyCharacter') {
    const isKnownPartyMember = slot.run.party.some(member => member.characterId === target.characterId);
    const isDowned = (slot.run.partyHp.find(row => row.characterId === target.characterId)?.currentHp ?? 0) <= 0;
    const allowsDownedTarget = action.target.kind === 'partyCharacter' && action.target.includeDefeated === true;
    if (!isKnownPartyMember || (isDowned && !allowsDownedTarget)) {
      throw new MapRunError([`${label} Action "${action.id}" targets a downed or unknown party member`]);
    }
  } else if (!encounter?.enemies.some(enemy => enemy.enemyId === target.enemyId && enemy.currentHp > 0)) {
    throw new MapRunError([`${label} Action "${action.id}" targets a defeated or unknown Enemy`]);
  }
}

function validateAdditionalSourceTarget(target: MapRunEncounterSourceTarget | null,
  action: GameplayMapActionDef, primary: MapRunEncounterSourceTarget | null, slot: MapRunSlot,
  label: string): asserts target is MapRunEncounterSourceTarget {
  if (!action.additionalTarget || !target || target.kind !== action.additionalTarget) {
    throw new MapRunError([`${label} Action "${action.id}" has an invalid or missing additional target`]);
  }
  validateSourceTarget(target, { ...action, target: { kind: action.additionalTarget } } as GameplayMapActionDef, slot, label);
  if (primary && primary.kind === target.kind
    && ((primary.kind === 'partyCharacter' && target.kind === 'partyCharacter' && primary.characterId === target.characterId)
      || (primary.kind === 'enemy' && target.kind === 'enemy' && primary.enemyId === target.enemyId))) {
    throw new MapRunError([`${label} Action "${action.id}" additional target must differ from its primary target`]);
  }
}

/** Purely validates and stages one full Encounter round from its starting balances. */
function encounterHasProgramActions(slot: MapRunSlot): boolean {
  const encounter = slot.run.activeEncounter;
  if (!encounter) return false;
  const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
  const encounterDef = resolveNodeEncounter(node, encounter.activityId);
  if (!encounterDef) return false;
  const referencedActionIds = new Set<string>();
  const candidateMap = slot.definition;
  for (const participant of encounterDef.participants ?? []) {
    for (const actionId of candidateActionIdsFor(candidateMap, participant.actions, participant.candidatePoolIds,
      encounter.candidateSourceSnapshot)) {
      referencedActionIds.add(actionId);
    }
  }
  for (const enemy of encounterDef.enemies ?? []) {
    for (const actionId of candidateActionIdsFor(candidateMap, enemy.actions, enemy.candidatePoolIds,
      encounter.candidateSourceSnapshot)) {
      referencedActionIds.add(actionId);
    }
  }
  for (const actionId of encounterDef.abilityActionIds ?? []) referencedActionIds.add(actionId);
  for (const mapping of encounterDef.itemActions ?? []) referencedActionIds.add(mapping.actionId);
  return [...referencedActionIds].some(actionId =>
    slot.definition.actions?.find(candidate => candidate.id === actionId)?.effectProgram !== undefined);
}

function resolveEncounterCommitPlan(slot: MapRunSlot): MapRunEncounterCommitPlan {
  return slot.definition.executionContractId === 'AG-1'
    ? resolveAg1EncounterCommitPlan(slot)
    : resolveE1EncounterCommitPlan(slot);
}

/** Sequential AG-1 planner. All mutations below are confined to detached working copies. */
function resolveAg1EncounterCommitPlan(slot: MapRunSlot): MapRunEncounterCommitPlan {
  const encounter = slot.run.activeEncounter;
  if (!encounter) throw new MapRunError(['there is no active Encounter to commit']);
  const schedulerStartSnapshot = schedulerStartSnapshotOf(slot);
  const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
  const encounterDef = resolveNodeEncounter(node, encounter.activityId);
  if (!encounterDef) throw new MapRunError([`Encounter "${encounter.nodeId}" is not declared by the current Map`]);
  if (encounter.round >= Number.MAX_SAFE_INTEGER) throw new MapRunError(['the Encounter round is exhausted']);
  const hasBattle = (encounterDef.enemies?.length ?? 0) > 0;
  if (encounterDef.completion?.kind === 'condition' && hasBattle) {
    throw new MapRunError(['E1 condition completion is not available in Battle Encounters']);
  }
  const hasProgramActions = encounterHasProgramActions(slot);
  if (hasProgramActions || encounterDef.completion?.kind === 'condition') {
    // The Effect context validator predates the U01 scheduler-only Action agility field.
    // Validate an otherwise identical projection so that field does not appear as an unknown Effect field.
    const contextDefinition = {
      ...slot.definition,
      actions: (slot.definition.actions ?? []).map(action => Object.fromEntries(
        Object.entries(action).filter(([key]) => key !== 'agility')) as unknown as GameplayMapActionDef),
    };
    const contextIssues = validateGameplayMapEffectContext(contextDefinition);
    if (contextIssues.length > 0) throw new MapRunError(contextIssues.map(issue => `${issue.path}: ${issue.message}`));
  }
  let preview: GameplayBActionPreview;
  try {
    preview = resolveGameplayBActionPreview({ runId: slot.run.runId, definition: slot.definition, encounter,
      party: slot.run.party, partyHp: slot.run.partyHp, playerCost: slot.run.playerCost,
      actorResources: slot.run.actorResources, teamResources: slot.run.teamResources });
  } catch (error) { throw new MapRunError([error instanceof Error ? error.message : String(error)]); }
  for (const prepared of preview.preparedActions) {
    if (prepared.targetSelectionRequired) throw new MapRunError([`Character "${prepared.characterId}" still requires a target selection`]);
    if (prepared.additionalTargetSelectionRequired) throw new MapRunError([`Character "${prepared.characterId}" still requires an additional target selection`]);
  }
  const partyChoices: MapCardActionChoice[] = preview.preparedActions.map(row => ({ characterId: row.characterId,
    actionId: row.skipReason === 'noLegalTarget' ? null : row.preparedActionId,
    overrideKind: row.overrideKind, targetCard: row.targetCard }));
  const enemyChoices: MapCardActionChoice[] = preview.preparedEnemyActions.map(row => ({ enemyId: row.enemyId,
    actionId: row.skipReason === 'noLegalTarget' ? null : row.naturalActionId,
    overrideKind: null, targetCard: row.targetCard }));
  const activeChoices = [...partyChoices, ...enemyChoices];
  const scope = { runId: slot.run.runId, mapId: slot.run.mapId, nodeId: encounter.nodeId,
    activityId: encounter.activityId ?? null, round: encounter.round };
  const cardDefinition = {
    ...slot.definition,
    actions: (slot.definition.actions ?? []).map(action => Object.fromEntries(
      Object.entries(action).filter(([key]) => key !== 'agility')) as unknown as GameplayMapActionDef),
  };
  let cardPlan: ReturnType<typeof resolveMapCardEffects>;
  try { cardPlan = resolveMapCardEffects(cardDefinition, scope, activeChoices, activeChoices, encounter.candidateSourceSnapshot); }
  catch (error) { throw new MapRunError([error instanceof Error ? error.message : String(error)]); }
  const sourcePreview: MapRunEncounterSourcePreview = {
    nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion,
    selectedAbilityActionId: encounter.abilityDraft?.actionId ?? null,
    selectedAbilityTarget: encounter.abilityDraft?.target ?? null,
    selectedAbilityAdditionalTarget: encounter.abilityDraft?.additionalTarget ?? null,
    selectedItemId: encounter.itemDraft?.itemId ?? null,
    selectedItemTarget: encounter.itemDraft?.target ?? null,
    selectedItemAdditionalTarget: encounter.itemDraft?.additionalTarget ?? null,
    abilityOptions: (encounterDef.abilityActionIds ?? []).map(actionId => ({ actionId, selected: encounter.abilityDraft?.actionId === actionId })) as unknown as MapRunEncounterSourcePreview['abilityOptions'],
    itemOptions: (encounterDef.itemActions ?? []).map(mapping => ({ ...mapping, selected: encounter.itemDraft?.itemId === mapping.itemId })) as unknown as MapRunEncounterSourcePreview['itemOptions'],
  };
  let sources: ReturnType<typeof buildGameplayBAg1ExecutionSources>;
  try {
    sources = buildGameplayBAg1ExecutionSources({
      scope, definition: slot.definition, partyIds: slot.run.party.map(member => member.characterId),
      enemyIds: encounter.enemies.map(enemy => enemy.enemyId),
      partyAgility: slot.run.partyAgility ?? [], enemyAgility: encounter.enemyAgility ?? [],
      actionPreview: preview, sourcePreview,
      cards: catalogMapRunCards({ ...slot.run, status: slot.run.status, activeEncounter: encounter }, preview),
    });
  } catch (error) { throw new MapRunError([error instanceof Error ? error.message : String(error)]); }

  const actions = new Map((slot.definition.actions ?? []).map(action => [action.id, action]));
  const enemyDefinitions = encounterDef.enemies ?? [];
  const partyCaps = partyHpCaps(slot.definition, slot.run.party);
  const enemyCaps = new Map(enemyDefinitions.map(enemy => [enemy.id, enemy.maxHp]));
  let plannedEffectRandomState = copyMapEffectRandomState(encounter.effectRandomState);
  const partyHp = new Map(slot.run.partyHp.map(row => [row.characterId, row.currentHp]));
  const enemyHp = new Map(encounter.enemies.map(row => [row.enemyId, row.currentHp]));
  const shieldMap = gameplayMapUsesShieldAdd(slot.definition);
  let shields: MapEffectShieldLedger | undefined = shieldMap
    ? copyShieldLedger(encounter.shields ?? {})
    : undefined;
  const shieldStart = shields === undefined ? undefined : copyShieldLedger(shields);
  const shieldTrace: MapEffectShieldTraceEntry[] = [];
  const actorBalances = new Map(slot.run.actorResources.map(row => [actorResourceKey(row.characterId, row.resourceId), row.value]));
  const teamBalances = new Map(slot.run.teamResources.map(row => [row.resourceId, row.value]));
  const enemyActorBalances = new Map(encounter.enemyActorResources.map(row => [actorResourceKey(row.enemyId, row.resourceId), row.value]));
  const enemyTeamBalances = new Map(encounter.enemyTeamResources.map(row => [row.resourceId, row.value]));
  let plannedMapRunFacts = slot.run.mapRunFacts === undefined ? undefined : copyMapRunFacts(slot.run.mapRunFacts);
  const resourceBalancesForSource = (): MapEffectResourceBalanceSnapshot => {
    const actors: Record<string, Record<string, number>> = {};
    for (const member of slot.run.party) actors[`partyCharacter:${member.characterId}`] = {};
    for (const enemy of encounter.enemies) actors[`enemy:${enemy.enemyId}`] = {};
    const addActorBalances = (kind: 'partyCharacter' | 'enemy', balances: ReadonlyMap<string, number>) => {
      for (const [key, value] of balances) {
        let identity: unknown;
        try { identity = JSON.parse(key); }
        catch { throw new MapRunError(['the MapRun contains a malformed Actor resource balance key']); }
        if (!Array.isArray(identity) || identity.length !== 2
          || typeof identity[0] !== 'string' || typeof identity[1] !== 'string') {
          throw new MapRunError(['the MapRun contains a malformed Actor resource balance key']);
        }
        const accountKey = `${kind}:${identity[0]}`;
        const account = actors[accountKey] ?? (actors[accountKey] = {});
        account[identity[1]] = value;
      }
    };
    addActorBalances('partyCharacter', actorBalances);
    addActorBalances('enemy', enemyActorBalances);
    return {
      actors,
      teams: { party: Object.fromEntries(teamBalances), enemy: Object.fromEntries(enemyTeamBalances) },
    };
  };
  const preparedPartyTagSources = Object.freeze(preview.preparedActions.flatMap(row => {
    if (!row.preparedActionId) return [];
    const action = actions.get(row.preparedActionId);
    if (!action) throw new MapRunError([`Prepared Action "${row.preparedActionId}" is no longer defined`]);
    return [Object.freeze({ characterId: row.characterId, actionId: action.id,
      origin: row.overrideKind === 'playerCommand' ? 'playerCommand' as const : 'hand' as const,
      tags: Object.freeze([...(action.tags ?? [])]) })];
  }));
  let locals = copyMapEncounterLocalsState(encounter.locals ?? { counters: {}, flags: {} }, encounterDef.locals);
  let plannedMapRunStatuses: readonly MapRunStatusInstance[] = slot.run.mapRunStatuses ?? [];
  let statuses: readonly MapEncounterStatusInstance[] = [...(encounter.statuses ?? []), ...plannedMapRunStatuses];
  const sortStatusProjection = (rows: readonly MapEncounterStatusInstance[]): MapEncounterStatusInstance[] => {
    const partyOrder = new Map(slot.run.party.map((member, index) => [member.characterId, index]));
    const enemyOffset = partyOrder.size;
    const enemyOrder = new Map(enemyDefinitions.map((enemy, index) => [enemy.id, enemyOffset + index]));
    const holderOrder = (status: MapEncounterStatusInstance) => status.holder.kind === 'partyCharacter'
      ? partyOrder.get(status.holder.id) ?? Number.MAX_SAFE_INTEGER
      : enemyOrder.get(status.holder.id) ?? Number.MAX_SAFE_INTEGER;
    return [...rows].sort((left, right) => holderOrder(left) - holderOrder(right)
      || compareMapEncounterStatusStableOrder(left, right));
  };
  statuses = sortStatusProjection(statuses);
  const programVisits: MapRunEncounterProgramVisit[] = [];
  const effectTrace: MapEffectTraceEntry[] = [];
  const triggerTrace: MapEffectTriggerTraceEntry[] = [];
  const statusDamageTriggerTrace: MapEffectStatusDamageTriggerTraceEntry[] = [];
  const triggerTraceByLedgerEntry = new WeakMap<MapEffectResourceLedgerEntry, { readonly trace: MapEffectTriggerTraceEntry; readonly source: MapEffectProgramSourceIdentity }>();
  const statusDamageTraceByLedgerEntry = new WeakMap<MapEffectResourceLedgerEntry, { readonly index: number; readonly trace: MapEffectStatusDamageTriggerTraceEntry; readonly source: MapEffectProgramSourceIdentity }>();
  const triggerTraceBySettlementChange = new WeakMap<MapRunEncounterSettlementResourceChange, { readonly trace: MapEffectTriggerTraceEntry; readonly source: MapEffectProgramSourceIdentity }>();
  const statusDamageTraceBySettlementChange = new WeakMap<MapRunEncounterSettlementResourceChange, { readonly index: number; readonly trace: MapEffectStatusDamageTriggerTraceEntry; readonly source: MapEffectProgramSourceIdentity }>();
  let nextTriggerQueueIndex = 1;
  const statusRemoveTrace: MapEffectStatusRemoveTraceEntry[] = [];
  const statusConsumeTrace: MapEffectStatusConsumeTraceEntry[] = [];
  const statusCategoryRemoveTrace: MapEffectStatusCategoryRemoveTraceEntry[] = [];
  const programScope: MapRunEncounterProgramScope = Object.freeze({ ...scope });
  const resourceEntries = new WeakMap<MapRunEncounterSettlementResourceChange, MapEffectResourceLedgerEntry>();
  const visitsForSource = (sourceIdentity: MapEffectProgramSourceIdentity, actionId: string, path: string, kind: 'prepare' | 'statement' | 'condition') => {
    if (programVisits.length >= 4096) throw new MapRunError(['the Encounter program visit budget exceeds 4096']);
    const sourceKey = sourceIdentity.kind === 'partyCharacter' || sourceIdentity.kind === 'enemy'
      ? mapCardActorKey(sourceIdentity.kind, sourceIdentity.id)
      : sourceIdentity.kind === 'ability' ? JSON.stringify(['ability', sourceIdentity.actionId])
        : JSON.stringify(['item', sourceIdentity.itemId, sourceIdentity.actionId]);
    programVisits.push(Object.freeze({ sourceKey, source: freezeProgramSource(sourceIdentity), actionId, path, kind, mode: 'program' }));
    return sourceKey;
  };
  const hpObject = () => Object.fromEntries([
    ...[...partyHp].map(([id, current]) => [`partyCharacter:${id}`, { current, cap: partyCaps.get(id)! }] as const),
    ...[...enemyHp].map(([id, current]) => [`enemy:${id}`, { current, cap: enemyCaps.get(id)! }] as const),
  ]);
  const planSource = (action: GameplayMapActionDef, sourceIdentity: MapEffectProgramSourceIdentity,
    primary: MapEffectActorIdentity | null, additionalTarget: MapEffectActorIdentity | null, side: 'party' | 'enemy',
    pendingCardEffectModifier?: { readonly sourceKey: string; readonly actionId: string; readonly delta: number }) => {
    const sourceKey = sourceIdentity.kind === 'partyCharacter' || sourceIdentity.kind === 'enemy'
      ? mapCardActorKey(sourceIdentity.kind, sourceIdentity.id)
      : sourceIdentity.kind === 'ability' ? JSON.stringify(['ability', sourceIdentity.actionId])
        : JSON.stringify(['item', sourceIdentity.itemId, sourceIdentity.actionId]);
    const normalized = normalizeMapRunActionEffects(action);
    let result: ReturnType<typeof planMapEffectSource>;
    const priorMapRunStatuses = plannedMapRunStatuses;
    try {
      result = planMapEffectSource({ input: { sourceKey, actionId: action.id,
        source: sourceIdentity.kind === 'partyCharacter' || sourceIdentity.kind === 'enemy' ? sourceIdentity : null,
        primary, additionalTarget, sourceTeam: { kind: 'team', side }, preparedPartyTagSources, sourceIdentity,
        statusDefinitions: slot.definition.statuses ?? [], statuses, hp: hpObject(), locals,
        ...(plannedMapRunFacts === undefined || slot.definition.mapRunFacts === undefined ? {} : {
          mapRunFacts: { declarations: slot.definition.mapRunFacts, state: copyMapRunFacts(plannedMapRunFacts) },
        }),
        resourceBalances: resourceBalancesForSource(), effectRandomState: copyMapEffectRandomState(plannedEffectRandomState),
        ...(shields === undefined ? {} : { shields }),
        round: encounter.round,
        targetOrder: { party: slot.run.party.map(row => row.characterId), enemy: enemyDefinitions.map(row => row.id) } },
        effects: normalized, ...(pendingCardEffectModifier ? { pendingCardEffectModifier } : {}),
        parentExecutionIndex: sequence.length,
        triggerQueueStart: nextTriggerQueueIndex,
        triggerActivationBudget: 32 - triggerTrace.length - statusDamageTriggerTrace.length,
        visit: entry => { visitsForSource(sourceIdentity, action.id, entry.path, entry.kind); } });
    } catch (error) { throw new MapRunError([error instanceof Error ? error.message : String(error)]); }
    const usedLedgerRows = new Set<number>();
    for (const [index, entry] of result.triggerTrace.entries()) {
      const recipient = entry.event === 'enemyDefeated' ? entry.rewardRecipient : entry.target;
      const ledgerIndex = result.resourceLedger.findIndex((candidate, candidateIndex) => !usedLedgerRows.has(candidateIndex)
        && candidate.path === entry.path && candidate.resourceId === entry.resourceId && candidate.delta === entry.delta
        && candidate.identity.kind === recipient.kind && candidate.identity.id === recipient.id
        && candidate.account === (entry.event === 'enemyDefeated' ? 'sourceActor' : 'primaryActor'));
      const ledgerEntry = ledgerIndex < 0 ? undefined : result.resourceLedger[ledgerIndex];
      if (!ledgerEntry || ledgerEntry.path !== entry.path || ledgerEntry.resourceId !== entry.resourceId
        || ledgerEntry.delta !== entry.delta || ledgerEntry.identity.kind !== recipient.kind
        || ledgerEntry.identity.id !== recipient.id || ledgerEntry.account !== (entry.event === 'enemyDefeated' ? 'sourceActor' : 'primaryActor')) {
        throw new MapRunError(['Trigger trace does not match its parent source resource ledger']);
      }
      triggerTrace.push(freezeTriggerTraceEntry(entry));
      triggerTraceByLedgerEntry.set(ledgerEntry, { trace: entry, source: sourceIdentity });
      usedLedgerRows.add(ledgerIndex);
    }
    for (const entry of result.statusDamageTriggerTrace) {
      const ledgerIndex = result.resourceLedger.findIndex((candidate, candidateIndex) => !usedLedgerRows.has(candidateIndex)
        && candidate.path === `status:${entry.status.statusId}.onDamageTaken`
        && candidate.resourceId === entry.resourceId && candidate.delta === entry.delta
        && candidate.identity.kind === entry.holder.kind && candidate.identity.id === entry.holder.id
        && candidate.account === 'primaryActor');
      const ledgerEntry = ledgerIndex < 0 ? undefined : result.resourceLedger[ledgerIndex];
      if (!ledgerEntry) throw new MapRunError(['Status damage reward is missing its parent source resource intent']);
      const trace = Object.freeze({ ...entry, status: freezeDamageRewardStatus(entry.status), holder: Object.freeze({ ...entry.holder }) });
      const traceIndex = statusDamageTriggerTrace.length;
      statusDamageTriggerTrace.push(trace);
      statusDamageTraceByLedgerEntry.set(ledgerEntry, { index: traceIndex, trace, source: sourceIdentity });
      usedLedgerRows.add(ledgerIndex);
    }
    nextTriggerQueueIndex += result.triggerTrace.length + result.statusDamageTriggerTrace.length;
    for (const [key, state] of Object.entries(result.hp)) {
      const separator = key.indexOf(':');
      const kind = key.slice(0, separator); const id = key.slice(separator + 1);
      if (kind === 'partyCharacter') partyHp.set(id, state.current); else if (kind === 'enemy') enemyHp.set(id, state.current);
    }
    locals = copyMapEncounterLocalsState(result.locals, encounterDef.locals);
    const partitionedStatuses = result.plannedStatuses.map(status => {
      const statusDefinition = slot.definition.statuses?.find(candidate => candidate.id === status.statusId);
      if (statusDefinition?.lifetime !== 'mapRun') return status;
      const prior = priorMapRunStatuses.find(candidate => mapRunStatusIdentityKey(candidate) === mapRunStatusIdentityKey(status));
      if (prior) return {
        ...status,
        originNodeId: prior.originNodeId,
        ...(prior.originActivityId === undefined ? {} : { originActivityId: prior.originActivityId }),
        appliedCommitVersion: prior.appliedCommitVersion,
        lastTriggeredCommitVersion: prior.lastTriggeredCommitVersion,
      } satisfies MapRunStatusInstance;
      if (status.source.kind !== 'partyCharacter') throw new MapRunError(['MapRun Status requires a Party Character Action source']);
      return {
        ...status,
        originNodeId: encounter.nodeId,
        ...(encounter.activityId === undefined ? {} : { originActivityId: encounter.activityId }),
        appliedCommitVersion: slot.run.commitVersion,
        lastTriggeredCommitVersion: null,
      } satisfies MapRunStatusInstance;
    });
    statuses = sortStatusProjection(partitionedStatuses);
    plannedMapRunStatuses = copyMapRunStatusInstances(statuses.filter(status =>
      slot.definition.statuses?.find(candidate => candidate.id === status.statusId)?.lifetime === 'mapRun') as MapRunStatusInstance[]);
    if (shields !== undefined) {
      if (result.plannedShields === undefined || result.shieldTrace === undefined) {
        throw new MapRunError(['Shield Map source plan omitted Shield evidence']);
      }
      shields = copyShieldLedger(result.plannedShields);
      for (const entry of result.shieldTrace) {
        shieldTrace.push(freezeShieldTraceEntry({ ...entry, source: sourceIdentity, mode: 'program' }));
      }
    }
    for (const entry of result.statusRemoveTrace) {
      statusRemoveTrace.push(freezeMapEffectStatusRemoveTrace({ ...entry, source: sourceIdentity, mode: 'program' }));
    }
    for (const entry of result.statusConsumeTrace) {
      statusConsumeTrace.push(freezeMapEffectStatusConsumeTrace({ ...entry, source: sourceIdentity, mode: 'program' }));
    }
    for (const entry of result.statusCategoryRemoveTrace) {
      statusCategoryRemoveTrace.push(freezeMapEffectStatusCategoryRemoveTrace({ ...entry, source: sourceIdentity, mode: 'program' }));
    }
    if (result.plannedMapRunFacts !== undefined) plannedMapRunFacts = copyMapRunFacts(result.plannedMapRunFacts);
    if (result.effectRandomState !== undefined) plannedEffectRandomState = copyMapEffectRandomState(result.effectRandomState);
    for (const trace of result.trace) if (trace.op !== 'resourceChange') effectTrace.push(freezeProgramTraceEntry({ ...trace, source: sourceIdentity, mode: 'program' }));
    for (const entry of result.triggerTrace) effectTrace.push(freezeProgramTraceEntry({ sourceKey: entry.sourceKey,
      source: sourceIdentity, actionId: entry.actionId, path: entry.path, op: 'resourceChange', mode: 'program',
      identity: entry.event === 'enemyDefeated' ? entry.rewardRecipient : entry.target,
      resourceId: entry.resourceId, delta: entry.delta }));
    return result;
  };
  const balancesFor = (change: MapRunEncounterSettlementResourceChange) => change.scope === 'actor'
    ? change.enemyId === undefined ? actorBalances : enemyActorBalances
    : change.teamSide === 'enemy' ? enemyTeamBalances : teamBalances;
  const balanceKeyFor = (change: MapRunEncounterSettlementResourceChange) => change.scope === 'actor'
    ? actorResourceKey(change.characterId ?? change.enemyId ?? '', change.resourceId) : change.resourceId;
  const applyChanges = (changes: readonly MapRunEncounterSettlementResourceChange[], actionId: string,
    kind: 'cost' | 'effect') => {
    for (const change of changes) {
      if (change.kind !== kind) continue;
      const balances = balancesFor(change); const key = balanceKeyFor(change); const before = balances.get(key);
      if (before === undefined) throw new MapRunError([`Action costs reference a resource without a MapRun balance: "${change.resourceId}"`]);
      const after = before + change.delta;
      if (!Number.isSafeInteger(after) || after < 0) throw new MapRunError([`Action "${actionId}" would leave an invalid balance for "${change.resourceId}"`]);
      balances.set(key, after);
      const entry = resourceEntries.get(change);
      if (kind === 'effect' && entry) {
        const visit = [...programVisits].reverse().find(row => row.actionId === actionId && row.path === entry.path);
        const trigger = triggerTraceBySettlementChange.get(change);
        const statusDamage = statusDamageTraceBySettlementChange.get(change);
        if (!visit && !trigger && !statusDamage) throw new MapRunError(['Program resource has no matching source visit']);
        if (statusDamage) statusDamageTriggerTrace[statusDamage.index] = Object.freeze({ ...statusDamage.trace,
          balanceBefore: before, balanceAfter: after });
        effectTrace.push(freezeProgramTraceEntry({ sourceKey: trigger?.trace.sourceKey ?? statusDamage?.trace.sourceKey ?? visit!.sourceKey,
          source: trigger?.source ?? statusDamage?.source ?? visit!.source, actionId,
          path: entry.path, op: 'resourceSettlement', mode: 'program', identity: entry.identity, account: entry.account,
          resourceId: entry.resourceId, intentDelta: entry.intentDelta, before, after, delta: after - before }));
      }
    }
  };
  const commandCost = preview.preparedActions.reduce((sum, row) => sum + (row.overrideKind === 'playerCommand' ? row.playerCost : 0), 0);
  if (!Number.isSafeInteger(commandCost) || commandCost > slot.run.playerCost) throw new MapRunError(['the Encounter round cannot pay its combined PlayerCost costs']);
  let playerCostRequired = commandCost;
  const entityReduction = cardPlan.reductions;
  const partySettlements = new Map<string, MapRunEncounterActionSettlement>();
  const enemySettlements = new Map<string, MapRunEncounterEnemyActionSettlement>();
  let abilitySettlement: MapRunEncounterSourceSettlement | null = null;
  let itemSettlement: MapRunEncounterItemSettlement | null = null;
  const sequence: MapRunEncounterExecutionSequenceEntry[] = [];
  const isDefeated = () => slot.run.party.every(member => (partyHp.get(member.characterId) ?? 0) <= 0);
  const allEnemiesDefeated = () => hasBattle && enemyDefinitions.every(enemy => (enemyHp.get(enemy.id) ?? 0) <= 0);
  let terminal: MapRunEncounterCommitPlan['terminal'] = isDefeated() ? 'failure' : allEnemiesDefeated() ? 'victory' : 'none';
  let schedulerTerminal: MapRunEncounterSchedulerTerminal = terminal === 'none'
    ? { outcome: 'none', checkpoint: null }
    : { outcome: terminal, checkpoint: 'commitStart' };
  const toReceiptTarget = (target: GameplayBAg1ExecutionTarget): MapRunEncounterExecutionTarget => {
    if (target.kind === 'actor') {
      if (target.actorKind === 'partyCharacter') return target.actorId === null ? { kind: 'none' } : { kind: 'partyCharacter', characterId: target.actorId };
      return target.actorId === null ? { kind: 'none' } : { kind: 'enemy', enemyId: target.actorId };
    }
    if (target.kind === 'card') return { kind: 'card', cardRef: target.cardRef };
    return { kind: 'none' };
  };
  const targetFor = (source: typeof sources[number], action: GameplayMapActionDef,
    additionalTarget: MapEffectActorIdentity | null) => {
    let partyId: string | null = null; let enemyId: string | null = null; let targetCard: MapRunCardRef | null = null;
    if (action.target.kind === 'partyCharacter' || action.target.kind === 'enemy') {
      const selected = source.target.kind === 'actor' ? source.target.actorId : null;
      const ownerId = source.owner?.id;
      const explicit = ownerId ? encounter.targetSelections.find(row => row.characterId === ownerId) : undefined;
      const explicitId = action.target.kind === 'partyCharacter' ? explicit?.targetCharacterId : explicit?.targetEnemyId;
      const current = action.target.kind === 'partyCharacter' ? partyHp : enemyHp;
      let selectedId = explicitId ?? selected;
      const actorlessLockedTarget = source.sourceKind === 'ability' || source.sourceKind === 'item';
      if (explicitId === undefined && !actorlessLockedTarget
        && (selectedId === null || (current.get(selectedId) ?? 0) <= 0)) {
        selectedId = action.target.kind === 'partyCharacter'
          ? selectGameplayBUnitTarget(slot.run.party.flatMap(member => {
            const hp = partyHp.get(member.characterId) ?? 0;
            return hp > 0 && !(additionalTarget?.kind === 'partyCharacter' && additionalTarget.id === member.characterId)
              ? [{ id: member.characterId, currentHp: hp, maxHp: partyCaps.get(member.characterId)! }] : [];
          }), action.target.preference ?? 'stableOrder')
          : selectGameplayBUnitTarget(enemyDefinitions.flatMap(enemy => {
            const hp = enemyHp.get(enemy.id) ?? 0;
            return hp > 0 && !(additionalTarget?.kind === 'enemy' && additionalTarget.id === enemy.id)
              ? [{ id: enemy.id, currentHp: hp, maxHp: enemy.maxHp }] : [];
          }), action.target.preference ?? 'stableOrder');
      }
      if (action.target.kind === 'partyCharacter') partyId = selectedId;
      else enemyId = selectedId;
    } else if (action.target.kind === 'self') {
      if (source.owner?.kind === 'partyCharacter') partyId = source.owner.id; else if (source.owner?.kind === 'enemy') enemyId = source.owner.id;
    } else if (action.target.kind === 'card') {
      targetCard = cardPlan.targets.get(source.owner ? mapCardActorKey(source.owner.kind, source.owner.id) : '') ?? null;
    }
    return { partyId, enemyId, targetCard, unit: settlementUnitTarget(partyId, enemyId) };
  };
  const sourceIdentity = (source: typeof sources[number]): MapEffectProgramSourceIdentity => {
    if (source.sourceKind === 'partyAction') return { kind: 'partyCharacter', id: source.owner!.id };
    if (source.sourceKind === 'enemyAction') return { kind: 'enemy', id: source.owner!.id };
    if (source.sourceKind === 'ability') return { kind: 'ability', actionId: source.actionId };
    return { kind: 'item', actionId: source.actionId, itemId: source.sourceKey && JSON.parse(source.sourceKey)[6] as string };
  };
  const additionalTargetFor = (source: typeof sources[number], action: GameplayMapActionDef): MapEffectActorIdentity | null => {
    let selected: MapRunEncounterSourceTarget | null = null;
    if (source.sourceKind === 'partyAction' && source.owner) {
      const row = preview.preparedActions.find(candidate => candidate.characterId === source.owner!.id);
      if (row?.additionalTargetCharacterId) selected = { kind: 'partyCharacter', characterId: row.additionalTargetCharacterId };
      else if (row?.additionalTargetEnemyId) selected = { kind: 'enemy', enemyId: row.additionalTargetEnemyId };
    } else if (source.sourceKind === 'ability') selected = encounter.abilityDraft?.additionalTarget ?? null;
    else if (source.sourceKind === 'item') selected = encounter.itemDraft?.additionalTarget ?? null;
    if (!action.additionalTarget) {
      if (selected !== null) throw new MapRunError([`Action "${action.id}" does not accept an additional target`]);
      return null;
    }
    if (source.sourceKind === 'enemyAction') throw new MapRunError([`Enemy Action "${action.id}" cannot declare an additional target`]);
    const partySkippedWithoutTarget = source.sourceKind === 'partyAction'
      && preview.preparedActions.find(candidate => candidate.characterId === source.owner?.id)?.skipReason === 'noLegalTarget';
    if (!selected) {
      if (partySkippedWithoutTarget) return null;
      throw new MapRunError([`Action "${action.id}" has no selected additional target`]);
    }
    if (selected.kind !== action.additionalTarget) throw new MapRunError([`Action "${action.id}" has an additional target on the wrong side`]);
    const primary = source.target.kind === 'actor' && source.target.actorId !== null
      ? { kind: source.target.actorKind, id: source.target.actorId } as MapEffectActorIdentity : null;
    const additional: MapEffectActorIdentity = selected.kind === 'partyCharacter'
      ? { kind: 'partyCharacter', id: selected.characterId } : { kind: 'enemy', id: selected.enemyId };
    if ((primary?.kind === additional.kind && primary.id === additional.id)
      || (source.owner?.kind === 'partyCharacter' && additional.kind === 'partyCharacter' && source.owner.id === additional.id)) {
      throw new MapRunError([`Action "${action.id}" additional target must differ from its primary and Party source`]);
    }
    const livingAtQueueStart = additional.kind === 'partyCharacter'
      ? schedulerStartSnapshot.partyHp.some(row => row.characterId === additional.id && row.currentHp > 0)
      : schedulerStartSnapshot.encounter.enemies.some(row => row.enemyId === additional.id && row.currentHp > 0);
    const belongsToQueue = additional.kind === 'partyCharacter'
      ? slot.run.party.some(row => row.characterId === additional.id)
      : encounter.enemies.some(row => row.enemyId === additional.id);
    if (!livingAtQueueStart || !belongsToQueue) throw new MapRunError([`Action "${action.id}" additional target is not a living current Encounter unit`]);
    return additional;
  };
  const appendSequence = (source: typeof sources[number], input: Omit<MapRunEncounterExecutionSequenceEntry, 'executionIndex' | 'sourceKey' | 'sourceKind' | 'owner' | 'actionId' | 'cardRef' | 'baseAgility' | 'actorAgility' | 'finalAgility' | 'sideRank' | 'sourceRank' | 'ownerDeclarationIndex' | 'logicalIndex'>) => {
    sequence.push(Object.freeze({ executionIndex: sequence.length, sourceKey: source.sourceKey, sourceKind: source.sourceKind,
      owner: source.owner ? Object.freeze({ ...source.owner }) : null, actionId: source.actionId,
      cardRef: source.cardRef, baseAgility: source.baseAgility, actorAgility: source.actorAgility,
      finalAgility: source.finalAgility, sideRank: source.orderCandidate.sideRank,
      sourceRank: source.orderCandidate.sourceRank, ownerDeclarationIndex: source.orderCandidate.ownerDeclarationIndex,
      logicalIndex: source.orderCandidate.logicalIndex, ...input,
      additionalTarget: input.additionalTarget === null ? null : cloneSourceTarget(input.additionalTarget)!,
      target: Object.freeze(input.target.kind === 'card' && input.target.cardRef
        ? { kind: 'card' as const, cardRef: parseMapRunCardRef(input.target.cardRef)! } : { ...input.target }),
      resourceChanges: Object.freeze(input.resourceChanges.map(row => Object.freeze({ ...row }))),
      hpChanges: Object.freeze(input.hpChanges.map(row => Object.freeze({ ...row }))) }));
  };
  const pushSkipped = (source: typeof sources[number], reason: 'defeated' | 'noLegalTarget' | 'unaffordable' | 'roundEnded',
    target: MapRunEncounterExecutionTarget, additionalTarget: MapEffectActorIdentity | null) => {
    const sourceModifier = modifierReceipts?.find(row => row.sourceOwnerId === source.owner?.id && row.sourceActionId === source.actionId);
    if (sourceModifier) {
      const index = modifierReceipts.indexOf(sourceModifier);
      modifierReceipts[index] = { ...sourceModifier, outcome: 'sourceSkipped', reason, hits: [] };
    }
    const targetKey = source.cardRef ? mapRunCardKey(source.cardRef) : '';
    const pendingModifier = pendingModifiers?.get(targetKey);
    if (pendingModifier) {
      const prior = modifierReceipts[pendingModifier.receiptIndex]!;
      modifierReceipts[pendingModifier.receiptIndex] = { ...prior, outcome: 'notApplied', reason, hits: [] };
      pendingModifiers.delete(targetKey);
    }
    const commandSpent = source.sourceKind === 'partyAction' && source.owner
      && preview.preparedActions.find(row => row.characterId === source.owner!.id)?.overrideKind === 'playerCommand' ? 1 : 0;
    const resourceChanges: MapRunEncounterSettlementResourceChange[] = [];
    if (source.sourceKind === 'partyAction') partySettlements.set(source.owner!.id, {
      characterId: source.owner!.id, actionId: source.actionId,
      targetCharacterId: target.kind === 'partyCharacter' ? target.characterId : null,
      additionalTarget: additionalTarget === null ? null : additionalTarget.kind === 'partyCharacter'
        ? { kind: 'partyCharacter', characterId: additionalTarget.id } : { kind: 'enemy', enemyId: additionalTarget.id },
      ...(target.kind === 'enemy' ? { targetEnemyId: target.enemyId } : {}),
      ...(target.kind === 'card' && target.cardRef ? { targetCard: target.cardRef } : {}),
      overrideKind: preview.preparedActions.find(row => row.characterId === source.owner!.id)?.overrideKind ?? null,
      playerCostSpent: commandSpent as 0 | 1, resourceChanges,
      ...(reason === 'noLegalTarget' ? { skipReason: reason } : {}),
    });
    if (source.sourceKind === 'enemyAction') enemySettlements.set(source.owner!.id, {
      enemyId: source.owner!.id, actionId: source.actionId, skipReason: reason, resourceChanges,
    });
    appendSequence(source, { target, additionalTarget: additionalTarget === null ? null : additionalTarget.kind === 'partyCharacter'
      ? { kind: 'partyCharacter', characterId: additionalTarget.id } : { kind: 'enemy', enemyId: additionalTarget.id },
      skipReason: reason, playerCostSpent: commandSpent as 0 | 1,
      itemConsumed: false, resourceChanges, hpChanges: [] });
  };

  const modifierTargets = new Map<string, string>();
  const modifierSources = new Map<string, typeof sources[number]>();
  const modifierReceipts: MapRunCardEffectModifierReceipt[] = [];
  const claimedModifierTargets = new Set<string>();
  for (const modifier of cardPlan.modifiers) {
    const sourceIndex = sources.findIndex(row => row.owner?.id === modifier.sourceKey && row.sourceKind === 'partyAction'
      && row.actionId === modifier.actionId && row.owner?.kind === 'partyCharacter');
    const targetIndex = sources.findIndex(row => row.cardRef !== null && mapRunCardKey(row.cardRef) === mapRunCardKey(modifier.targetCard));
    const targetKey = mapRunCardKey(modifier.targetCard);
    if (claimedModifierTargets.has(targetKey)) throw new MapRunError(['a CardRef target cannot receive more than one modifier']);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex <= sourceIndex || sources[targetIndex]?.sourceKind !== 'partyAction'
      || sources[targetIndex]?.owner?.kind !== 'partyCharacter' || sources[targetIndex]?.owner?.id === sources[sourceIndex]?.owner?.id
      || !sources[sourceIndex]?.cardRef) throw new MapRunError(['CardRef modifier source or target is not a later selected Party Prepared Action']);
    modifierTargets.set(modifier.sourceKey, mapRunCardKey(modifier.targetCard));
    claimedModifierTargets.add(targetKey);
    modifierSources.set(modifier.sourceKey, sources[sourceIndex]!);
    const modifierSource = sources[sourceIndex]!;
    const modifierTarget = sources[targetIndex]!;
    modifierReceipts.push({ sourceKey: modifierSource.sourceKey, sourceActionId: modifierSource.actionId,
      sourceOwnerId: modifierSource.owner!.id, sourceCardRef: parseMapRunCardRef(modifierSource.cardRef)!,
      sourceExecutionIndex: sourceIndex, targetCardRef: parseMapRunCardRef(modifier.targetCard)!,
      targetOwnerId: modifierTarget.owner!.id, targetActionId: modifierTarget.actionId, targetExecutionIndex: targetIndex,
      path: 'resolve[0].amount', delta: modifier.delta, outcome: 'notApplied', hits: [] });
  }
  const pendingModifiers = new Map<string, { readonly sourceKey: string; readonly actionId: string; readonly delta: number; readonly receiptIndex: number }>();

  // Prepare discounts are fixed before the queue and do not change with later HP or execution order.
  for (const metadata of cardPlan.prepareMetadata) {
    const targetCard = cardPlan.targets.get(metadata.sourceKey);
    if (!targetCard) throw new MapRunError([`Action "${metadata.actionId}" has no resolved prepare CardRef`]);
    const source = metadata.source;
    const sourceKey = visitsForSource(source, metadata.actionId, metadata.effectPath, 'prepare');
    effectTrace.push(freezeProgramTraceEntry({ sourceKey, source, actionId: metadata.actionId, path: metadata.effectPath,
      op: 'discountSCost', mode: 'program', amount: metadata.leaf.amount, targetCard, receiver: null }));
  }
  for (const source of sources) {
    const action = actions.get(source.actionId);
    if (!action) throw new MapRunError([`Selected Action "${source.actionId}" is no longer defined`]);
    const additionalTarget = additionalTargetFor(source, action);
    if (terminal !== 'none') { pushSkipped(source, 'roundEnded', toReceiptTarget(source.target), additionalTarget); continue; }
    if (source.owner?.kind === 'partyCharacter' && (partyHp.get(source.owner.id) ?? 0) <= 0) {
      pushSkipped(source, 'defeated', toReceiptTarget(source.target), additionalTarget); continue;
    }
    if (source.owner?.kind === 'enemy' && (enemyHp.get(source.owner.id) ?? 0) <= 0) {
      pushSkipped(source, 'defeated', toReceiptTarget(source.target), additionalTarget); continue;
    }
    const resolved = targetFor(source, action, additionalTarget);
    if (source.skipReason === 'noLegalTarget') {
      pushSkipped(source, 'noLegalTarget', toReceiptTarget(source.target), additionalTarget); continue;
    }
    if ((action.target.kind === 'enemy' && resolved.enemyId === null)
      || (action.target.kind === 'partyCharacter' && resolved.partyId === null)
      || (action.target.kind === 'card' && resolved.targetCard === null)) {
      pushSkipped(source, 'noLegalTarget', toReceiptTarget(source.target), additionalTarget); continue;
    }
    if (source.sourceKind === 'ability' || source.sourceKind === 'item') {
      const target = source.target.kind === 'actor' && source.target.actorId !== null
        ? source.target.actorKind === 'partyCharacter' ? { kind: 'partyCharacter' as const, characterId: source.target.actorId }
          : { kind: 'enemy' as const, enemyId: source.target.actorId } : null;
      if (!target) throw new MapRunError([`Actorless Action "${action.id}" has an invalid target`]);
      actorlessSourceAction(slot, action.id, source.sourceKind === 'ability' ? 'Ability' : 'Item');
      if ((target.kind === 'partyCharacter' && !slot.run.party.some(row => row.characterId === target.characterId))
        || (target.kind === 'enemy' && !encounter.enemies.some(row => row.enemyId === target.enemyId))) {
        throw new MapRunError([`Actorless Action "${action.id}" has a target outside the current Encounter`]);
      }
      if (source.sourceKind === 'ability') {
        if (slot.run.playerCost < playerCostRequired + 1) throw new MapRunError(['the Encounter round cannot pay its PlayerCost costs']);
        playerCostRequired += 1;
      }
    }
    const actor: SettlementActor = source.owner
      ? { kind: source.owner.kind === 'partyCharacter' ? 'partyCharacter' : 'enemy', id: source.owner.id } : null;
    const reduction = source.owner ? entityReduction.get(mapCardActorKey(source.owner.kind, source.owner.id)) ?? 0n : 0n;
    if ((source.sourceKind === 'ability' || source.sourceKind === 'item') && (action.costs?.length ?? 0) > 0) {
      throw new MapRunError([`Actorless Action "${action.id}" cannot declare Action costs`]);
    }
    const costProbe = settlementChangesFor(action, actor, resolved.unit, reduction, { programCostProbe: true });
    const sourceCanPay = (changes: readonly MapRunEncounterSettlementResourceChange[]) => {
      const required = new Map<string, { readonly change: MapRunEncounterSettlementResourceChange; amount: bigint }>();
      for (const change of changes) if (change.kind === 'cost') {
        const key = JSON.stringify([change.scope, change.characterId ?? change.enemyId ?? null, change.teamSide ?? 'party', change.resourceId]);
        const previous = required.get(key);
        required.set(key, { change, amount: (previous?.amount ?? 0n) + BigInt(-change.delta) });
      }
      for (const { change, amount } of required.values()) {
        const balance = balancesFor(change).get(balanceKeyFor(change));
        if (balance === undefined) throw new MapRunError([`Action costs reference a resource without a MapRun balance: "${change.resourceId}"`]);
        if (amount > BigInt(balance)) return false;
      }
      return true;
    };
    if (!sourceCanPay(costProbe)) {
      if (source.sourceKind === 'enemyAction') { pushSkipped(source, 'unaffordable', toReceiptTarget(source.target), additionalTarget); continue; }
      throw new MapRunError([`the fixed-party source "${source.actionId}" cannot afford its resource cost`]);
    }
    applyChanges(costProbe, action.id, 'cost');
    const primary = resolved.enemyId !== null ? { kind: 'enemy' as const, id: resolved.enemyId }
      : resolved.partyId !== null ? { kind: 'partyCharacter' as const, id: resolved.partyId } : null;
    const identity = sourceIdentity(source);
    const pendingKey = source.cardRef ? mapRunCardKey(source.cardRef) : '';
    const pendingModifier = pendingModifiers.get(pendingKey);
    const effectPlan = action.effectProgram === undefined ? undefined : planSource(action, identity, primary,
      additionalTarget, source.sourceKind === 'enemyAction' ? 'enemy' : 'party', pendingModifier);
    if (pendingModifier) {
      if (!effectPlan) throw new MapRunError(['CardRef modifier target did not produce a Program plan']);
      const receipt = modifierReceipts[pendingModifier.receiptIndex]!;
      const hits = effectPlan.trace.flatMap(trace => (trace.op === 'damage' || trace.op === 'heal')
        && trace.identity !== undefined && (trace.identity.kind === 'partyCharacter' || trace.identity.kind === 'enemy')
        && trace.modifierSourceKey === pendingModifier.sourceKey
        && trace.requestedAmount !== undefined && trace.modifierDelta !== undefined
        && trace.modifiedRequestedAmount !== undefined
        ? [{ op: trace.op, identity: { kind: trace.identity.kind, id: trace.identity.id },
          requestedAmount: trace.requestedAmount, modifierDelta: trace.modifierDelta,
          modifiedRequestedAmount: trace.modifiedRequestedAmount, before: trace.before, after: trace.after,
          hpDelta: trace.delta, ...(trace.batch ? { batch: trace.batch } : {}) }]
        : []);
      modifierReceipts[pendingModifier.receiptIndex] = { ...receipt, outcome: 'applied', hits };
      pendingModifiers.delete(pendingKey);
    }
    const fullChanges = settlementChangesFor(action, actor, resolved.unit, reduction,
      effectPlan ? { programPlan: effectPlan, onProgramResourceChange: (change, entry) => {
        resourceEntries.set(change, entry);
        const trigger = triggerTraceByLedgerEntry.get(entry);
        if (trigger) triggerTraceBySettlementChange.set(change, trigger);
        const statusDamage = statusDamageTraceByLedgerEntry.get(entry);
        if (statusDamage) statusDamageTraceBySettlementChange.set(change, statusDamage);
      } } : {});
    const effects = fullChanges.filter(change => change.kind === 'effect');
    applyChanges(effects, action.id, 'effect');
    const sourceHpChanges: MapRunEncounterHpChange[] = (effectPlan?.trace ?? []).flatMap(trace => {
      if ((trace.op !== 'hpChange' && trace.op !== 'damage' && trace.op !== 'heal') || !trace.identity
        || (trace.identity.kind !== 'partyCharacter' && trace.identity.kind !== 'enemy')) return [];
      return [trace.identity.kind === 'enemy' ? { scope: 'enemy', enemyId: trace.identity.id, delta: trace.delta }
        : { scope: 'party', characterId: trace.identity.id, delta: trace.delta }];
    });
    const allChanges = [...costProbe, ...effects];
    const target = resolved.targetCard ? { kind: 'card' as const, cardRef: resolved.targetCard }
      : resolved.partyId ? { kind: 'partyCharacter' as const, characterId: resolved.partyId }
        : resolved.enemyId ? { kind: 'enemy' as const, enemyId: resolved.enemyId } : { kind: 'none' as const };
    const commandSpent = source.sourceKind === 'partyAction'
      && preview.preparedActions.find(row => row.characterId === source.owner!.id)?.overrideKind === 'playerCommand' ? 1 : 0;
    let itemConsumed = false;
    if (source.sourceKind === 'partyAction') {
      const prepared = preview.preparedActions.find(row => row.characterId === source.owner!.id)!;
      const settlement: MapRunEncounterActionSettlement = {
        characterId: source.owner!.id, actionId: action.id,
        targetCharacterId: resolved.partyId, ...(resolved.enemyId === null ? {} : { targetEnemyId: resolved.enemyId }),
        additionalTarget: additionalTarget === null ? null : additionalTarget.kind === 'partyCharacter'
          ? { kind: 'partyCharacter', characterId: additionalTarget.id } : { kind: 'enemy', enemyId: additionalTarget.id },
        ...(resolved.targetCard ? { targetCard: resolved.targetCard } : {}),
        ...(mapScostCost(action, reduction) ? { scostCost: mapScostCost(action, reduction)! } : {}),
        overrideKind: prepared.overrideKind, playerCostSpent: commandSpent as 0 | 1,
        resourceChanges: allChanges, ...(sourceHpChanges.length ? { hpChanges: sourceHpChanges } : {}),
      };
      partySettlements.set(source.owner!.id, settlement);
    } else if (source.sourceKind === 'enemyAction') {
      const settlement: MapRunEncounterEnemyActionSettlement = {
        enemyId: source.owner!.id, actionId: action.id,
        ...(resolved.partyId === null ? {} : { targetCharacterId: resolved.partyId }),
        ...(resolved.enemyId === null ? {} : { targetEnemyId: resolved.enemyId }),
        ...(resolved.targetCard ? { targetCard: resolved.targetCard } : {}),
        ...(mapScostCost(action, reduction) ? { scostCost: mapScostCost(action, reduction)! } : {}),
        resourceChanges: allChanges, ...(sourceHpChanges.length ? { hpChanges: sourceHpChanges } : {}),
      };
      enemySettlements.set(source.owner!.id, settlement);
    } else if (source.sourceKind === 'ability') {
      playerCostRequired += 1;
      const selectedTarget = source.target.kind === 'actor' && source.target.actorId !== null
        ? source.target.actorKind === 'partyCharacter' ? { kind: 'partyCharacter' as const, characterId: source.target.actorId }
          : { kind: 'enemy' as const, enemyId: source.target.actorId } : null;
      if (!selectedTarget) throw new MapRunError([`Ability Action "${action.id}" has no target`]);
      abilitySettlement = { actionId: action.id, target: selectedTarget, playerCostSpent: 1,
        ...(additionalTarget === null ? { additionalTarget: null } : { additionalTarget: additionalTarget.kind === 'partyCharacter'
          ? { kind: 'partyCharacter' as const, characterId: additionalTarget.id } : { kind: 'enemy' as const, enemyId: additionalTarget.id } }),
        resourceChanges: allChanges, hpChanges: sourceHpChanges };
    } else {
      itemConsumed = true;
      const selectedTarget = source.target.kind === 'actor' && source.target.actorId !== null
        ? source.target.actorKind === 'partyCharacter' ? { kind: 'partyCharacter' as const, characterId: source.target.actorId }
          : { kind: 'enemy' as const, enemyId: source.target.actorId } : null;
      if (!selectedTarget) throw new MapRunError([`Item Action "${action.id}" has no target`]);
      const itemId = JSON.parse(source.sourceKey)[6] as string;
      itemSettlement = { itemId, actionId: action.id, target: selectedTarget, consumedCount: 1,
        ...(additionalTarget === null ? { additionalTarget: null } : { additionalTarget: additionalTarget.kind === 'partyCharacter'
          ? { kind: 'partyCharacter' as const, characterId: additionalTarget.id } : { kind: 'enemy' as const, enemyId: additionalTarget.id } }),
        resourceChanges: allChanges, hpChanges: sourceHpChanges };
    }
    appendSequence(source, { target, additionalTarget: additionalTarget === null ? null : additionalTarget.kind === 'partyCharacter'
      ? { kind: 'partyCharacter', characterId: additionalTarget.id } : { kind: 'enemy', enemyId: additionalTarget.id },
      skipReason: null, playerCostSpent: source.sourceKind === 'ability' ? 1 : commandSpent as 0 | 1,
      itemConsumed, resourceChanges: allChanges, hpChanges: sourceHpChanges });
    const ownModifier = cardPlan.modifiers.find(row => row.sourceKey === source.owner?.id && row.actionId === source.actionId);
    if (ownModifier) {
      const modifierSource = modifierSources.get(ownModifier.sourceKey)!;
      const targetKey = modifierTargets.get(ownModifier.sourceKey)!;
      if (pendingModifiers.has(targetKey)) throw new MapRunError(['a CardRef target cannot receive more than one modifier']);
      const receiptIndex = modifierReceipts.findIndex(row => row.sourceOwnerId === source.owner?.id && row.sourceActionId === source.actionId);
      if (receiptIndex < 0) throw new MapRunError(['CardRef modifier receipt source is missing']);
      pendingModifiers.set(targetKey, { sourceKey: modifierSource.sourceKey, actionId: modifierSource.actionId,
        delta: ownModifier.delta, receiptIndex });
    }
    if (isDefeated()) terminal = 'failure'; else if (allEnemiesDefeated()) terminal = 'victory';
    if (terminal !== 'none') schedulerTerminal = { outcome: terminal, checkpoint: 'afterSource', executionIndex: sequence.length - 1 };
  }

  for (const row of preview.preparedActions) if (!partySettlements.has(row.characterId)) {
    partySettlements.set(row.characterId, { characterId: row.characterId, actionId: null, targetCharacterId: null,
      additionalTarget: null, overrideKind: null, playerCostSpent: 0, resourceChanges: [] });
  }
  for (const row of preview.preparedEnemyActions) if (!enemySettlements.has(row.enemyId)) {
    enemySettlements.set(row.enemyId, { enemyId: row.enemyId, actionId: row.naturalActionId, resourceChanges: [] });
  }
  let statusTrace: readonly MapEffectStatusTickTraceEntry[] = [];
  const statusExpiryTriggerTrace: MapEffectStatusExpiryTriggerTraceEntry[] = [];
  const terminalBeforeStatusTick = terminal !== 'none';
  if (terminal === 'none' && (slot.definition.statuses?.length ?? 0) > 0) {
    const tick = gameplayMapUsesMapRunStatus(slot.definition)
      ? applyMapStatusRoundEnd({
        round: encounter.round,
        commitVersion: slot.run.commitVersion,
        definitions: slot.definition.statuses ?? [],
        statuses: statuses.filter(status => slot.definition.statuses?.find(definition => definition.id === status.statusId)?.lifetime !== 'mapRun'),
        mapRunStatuses: plannedMapRunStatuses,
        partyOrder: slot.run.party.map(row => row.characterId),
        enemyOrder: enemyDefinitions.map(row => row.id),
        hp: hpObject(),
      })
      : (() => {
        const localTick = applyMapEncounterStatusRoundEnd({ round: encounter.round, definitions: slot.definition.statuses ?? [], statuses,
          partyOrder: slot.run.party.map(row => row.characterId), enemyOrder: enemyDefinitions.map(row => row.id), hp: hpObject() });
        return { hp: localTick.hp, encounterStatuses: localTick.statuses, mapRunStatuses: [], trace: localTick.trace };
      })();
    statuses = sortStatusProjection([...tick.encounterStatuses, ...tick.mapRunStatuses]);
    plannedMapRunStatuses = gameplayMapUsesMapRunStatus(slot.definition)
      ? copyMapRunStatusInstances(tick.mapRunStatuses)
      : plannedMapRunStatuses;
    statusTrace = tick.trace;
    for (const [key, state] of Object.entries(tick.hp)) {
      const separator = key.indexOf(':'); const kind = key.slice(0, separator); const id = key.slice(separator + 1);
      if (kind === 'partyCharacter') partyHp.set(id, state.current); else if (kind === 'enemy') enemyHp.set(id, state.current);
    }
    const naturalExpirations = tick.trace.flatMap((entry, statusTraceIndex) => {
      if (!entry.removed || entry.remainingRoundsBefore !== 1 || entry.remainingRoundsAfter !== 0) return [];
      const definition = slot.definition.statuses?.find(candidate => candidate.id === entry.statusId);
      return definition?.onExpire ? [{ entry, statusTraceIndex, effect: definition.onExpire }] : [];
    });
    if (triggerTrace.length + statusDamageTriggerTrace.length + naturalExpirations.length > 32) {
      throw new MapRunError(['the Commit Trigger activation budget exceeds 32 after Status expiry']);
    }
    for (const { entry, statusTraceIndex, effect } of naturalExpirations) {
      if (!Number.isSafeInteger(effect.delta) || effect.delta <= 0 || !isNonEmptyId(effect.resourceId)) {
        throw new MapRunError([`Status "${entry.statusId}" has an invalid onExpire resource effect`]);
      }
      const balances = entry.holder.kind === 'partyCharacter' ? actorBalances : enemyActorBalances;
      const key = actorResourceKey(entry.holder.id, effect.resourceId);
      const balanceBefore = balances.get(key);
      if (balanceBefore === undefined) {
        throw new MapRunError([`Status "${entry.statusId}" onExpire references a resource without a holder balance: "${effect.resourceId}"`]);
      }
      const balanceAfter = balanceBefore + effect.delta;
      if (!Number.isSafeInteger(balanceAfter) || balanceAfter < 0) {
        throw new MapRunError([`Status "${entry.statusId}" onExpire would leave an invalid holder balance for "${effect.resourceId}"`]);
      }
      balances.set(key, balanceAfter);
      statusExpiryTriggerTrace.push(freezeStatusExpiryTriggerTraceEntry({
        queueIndex: triggerTrace.length + statusDamageTriggerTrace.length + statusExpiryTriggerTrace.length + 1,
        event: 'statusExpired', statusTraceIndex, round: encounter.round,
        status: { ...entry.statusBefore, holder: { ...entry.statusBefore.holder }, source: { ...entry.statusBefore.source } },
        holder: { ...entry.holder }, resourceId: effect.resourceId, delta: effect.delta,
        balanceBefore, balanceAfter,
      }));
    }
    if (isDefeated()) terminal = 'failure'; else if (allEnemiesDefeated()) terminal = 'victory';
    if (terminal !== 'none') schedulerTerminal = { outcome: terminal, checkpoint: 'afterStatusRoundEnd' };
  }
  if (terminal === 'none' && !hasBattle && encounterRounds(encounterDef) !== undefined
    && encounter.round >= encounterRounds(encounterDef)!) {
    terminal = 'victory'; schedulerTerminal = { outcome: terminal, checkpoint: 'afterNonBattleCompletion' };
  }
  if (terminal === 'none' && !hasBattle && encounterDef.completion?.kind === 'condition'
    && encounterCompletionSatisfied(encounterDef.completion.condition, locals)) {
    terminal = 'victory'; schedulerTerminal = { outcome: terminal, checkpoint: 'afterNonBattleCompletion' };
  }
  if (terminalBeforeStatusTick) statuses = gameplayMapUsesMapRunStatus(slot.definition)
    ? statuses.filter(status => slot.definition.statuses?.find(definition => definition.id === status.statusId)?.lifetime === 'mapRun')
    : [];
  const encounterNode = slot.definition.nodes.find(node => node.id === encounter.nodeId);
  const activityRows = encounterNode?.activities ?? [];
  const finalExitEncounter = terminal === 'victory' && slot.definition.exitNodeIds.includes(encounter.nodeId)
    && (encounter.activityId === undefined || activityRows.findIndex(activity => activity.id === encounter.activityId) === activityRows.length - 1);
  if (terminal === 'failure' || finalExitEncounter) {
    statuses = statuses.filter(status => slot.definition.statuses?.find(definition => definition.id === status.statusId)?.lifetime !== 'mapRun');
    plannedMapRunStatuses = [];
  }
  const executionSequence = Object.freeze(sequence);
  return {
    settlements: Object.freeze(slot.run.party.map(row => partySettlements.get(row.characterId)!)),
    enemyActions: Object.freeze(enemyDefinitions.map(row => enemySettlements.get(row.id)!)),
    ability: abilitySettlement, item: itemSettlement, playerCostRequired, actorBalancesAfter: actorBalances, teamBalancesAfter: teamBalances,
    enemyActorBalancesAfter: enemyActorBalances, enemyTeamBalancesAfter: enemyTeamBalances,
    partyHpAfter: partyHp, enemyHpAfter: enemyHp, terminal,
    schedulerFormatVersion: gameplayMapUsesMapRunStatus(slot.definition) ? 7 : shieldMap ? 6 : 5,
    schedulerStartSnapshot, schedulerTerminal: Object.freeze({ ...schedulerTerminal }), executionSequence,
    ...(shieldMap ? { shieldReceiptVersion: 1 as const, shieldStart: shieldStart!, plannedShields: copyShieldLedger(shields!),
      shieldTrace: Object.freeze([...shieldTrace]) } : {}),
    ...(gameplayMapUsesStatusDamageReward(slot.definition) ? {
      triggerReceiptVersion: 4 as const,
      triggerTrace: Object.freeze([...triggerTrace]),
      statusExpiryTriggerTrace: Object.freeze([...statusExpiryTriggerTrace]),
      statusDamageTriggerTrace: Object.freeze([...statusDamageTriggerTrace]),
    } : triggerTrace.some(entry => entry.event === 'enemyDefeated') ? {
      triggerReceiptVersion: 3 as const,
      triggerTrace: Object.freeze([...triggerTrace]),
      statusExpiryTriggerTrace: Object.freeze([...statusExpiryTriggerTrace]),
    } : statusExpiryTriggerTrace.length > 0 ? {
      triggerReceiptVersion: 2 as const,
      triggerTrace: Object.freeze([...triggerTrace]),
      statusExpiryTriggerTrace: Object.freeze([...statusExpiryTriggerTrace]),
    } : triggerTrace.length > 0 ? { triggerReceiptVersion: 1 as const, triggerTrace: Object.freeze([...triggerTrace]) } : {}),
    ...(plannedMapRunFacts === undefined ? {} : { plannedMapRunFacts: copyMapRunFacts(plannedMapRunFacts) }),
    plannedEffectRandomState: copyMapEffectRandomState(plannedEffectRandomState),
    executionContractId: 'AG-1',
    ...((slot.definition.statuses?.length ?? 0) === 0 ? {} : { statusReceiptVersion: gameplayMapStatusReceiptVersion(slot.definition),
      plannedStatuses: copyMapEncounterStatusInstances(statuses.filter(status =>
        slot.definition.statuses?.find(definition => definition.id === status.statusId)?.lifetime !== 'mapRun')),
      ...(gameplayMapUsesMapRunStatus(slot.definition) ? { plannedMapRunStatuses: copyMapRunStatusInstances(plannedMapRunStatuses) } : {}),
      statusTrace: Object.freeze([...statusTrace]),
      ...(gameplayMapStatusReceiptVersion(slot.definition) >= 2
        ? { statusRemoveTrace: Object.freeze([...statusRemoveTrace]) } : {}),
      ...(gameplayMapStatusReceiptVersion(slot.definition) >= 3
        ? { statusConsumeTrace: Object.freeze([...statusConsumeTrace]) } : {}),
      ...(gameplayMapStatusReceiptVersion(slot.definition) >= 4
        ? { statusCategoryRemoveTrace: Object.freeze([...statusCategoryRemoveTrace]) } : {}) }),
    ...(modifierReceipts.length ? { cardEffectModifierReceipts: Object.freeze(modifierReceipts.map(row => Object.freeze({
      ...row, sourceCardRef: parseMapRunCardRef(row.sourceCardRef)!, targetCardRef: parseMapRunCardRef(row.targetCardRef)!,
      hits: Object.freeze(row.hits.map(hit => Object.freeze({ ...hit, identity: Object.freeze({ ...hit.identity }) }))),
    }))) } : {}),
    ...(!hasProgramActions ? {} : { programReceiptVersion: modifierReceipts.length ? 2 as const : 1 as const, effectScope: programScope,
      programVisits: Object.freeze([...programVisits]), plannedLocals: copyMapEncounterLocalsState(locals, encounterDef.locals),
      effectTrace: Object.freeze(effectTrace.map(freezeProgramTraceEntry)) }),
  };
}

/** Preserved legacy E1 grouped planner. Its historical behavior remains isolated from AG-1. */
function resolveE1EncounterCommitPlan(slot: MapRunSlot): MapRunEncounterCommitPlan {
  const encounter = slot.run.activeEncounter;
  if (!encounter) throw new MapRunError(['there is no active Encounter to commit']);
  const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
  const encounterDef = resolveNodeEncounter(node, encounter.activityId);
  if (!encounterDef) throw new MapRunError([`Encounter "${encounter.nodeId}" is not declared by the current Map`]);
  const transitionDiagnostics: string[] = [];
  const hasConditionCompletion = encounterDef.completion?.kind === 'condition';
  if (hasConditionCompletion && (encounterDef.enemies?.length ?? 0) > 0) {
    transitionDiagnostics.push('E1 condition completion is not available in Battle Encounters');
  }
  const hasProgramActions = encounterHasProgramActions(slot);
  if (transitionDiagnostics.length > 0) throw new MapRunError(transitionDiagnostics);
  if (hasProgramActions || hasConditionCompletion) {
    const contextIssues = validateGameplayMapEffectContext(slot.definition);
    if (contextIssues.length > 0) throw new MapRunError(contextIssues.map(issue => `${issue.path}: ${issue.message}`));
  }

  let preview: GameplayBActionPreview;
  try {
    preview = resolveGameplayBActionPreview({
      runId: slot.run.runId,
      definition: slot.definition,
      encounter,
      party: slot.run.party,
      partyHp: slot.run.partyHp,
      playerCost: slot.run.playerCost,
      actorResources: slot.run.actorResources,
      teamResources: slot.run.teamResources,
    });
  } catch (error) {
    throw new MapRunError([error instanceof Error ? error.message : String(error)]);
  }
  if (encounter.round >= Number.MAX_SAFE_INTEGER) {
    throw new MapRunError(['the Encounter round is exhausted']);
  }
  for (const prepared of preview.preparedActions) {
    if (prepared.targetSelectionRequired) throw new MapRunError([`Character "${prepared.characterId}" still requires a target selection`]);
    if (prepared.additionalTargetSelectionRequired) throw new MapRunError([`Character "${prepared.characterId}" still requires an additional target selection`]);
  }
  const partyCardChoices: MapCardActionChoice[] = preview.preparedActions.map(row => ({ characterId: row.characterId,
    actionId: row.skipReason === 'noLegalTarget' ? null : row.preparedActionId,
    overrideKind: row.overrideKind, targetCard: row.targetCard }));
  const activeCardChoices: MapCardActionChoice[] = [
    ...partyCardChoices,
    ...preview.preparedEnemyActions.map(row => ({
      enemyId: row.enemyId,
      actionId: row.skipReason === 'noLegalTarget' ? null : row.naturalActionId,
      overrideKind: null,
      targetCard: row.targetCard,
    })),
  ];
  let cardPlan: ReturnType<typeof resolveMapCardEffects>;
  try {
    cardPlan = resolveMapCardEffects(slot.definition, { runId: slot.run.runId, mapId: slot.run.mapId,
      nodeId: encounter.nodeId, activityId: encounter.activityId ?? null, round: encounter.round },
    partyCardChoices, activeCardChoices, encounter.candidateSourceSnapshot);
  } catch (error) { throw new MapRunError([error instanceof Error ? error.message : String(error)]); }

  const effectScope: MapRunEncounterProgramScope = Object.freeze({
    runId: slot.run.runId,
    mapId: slot.run.mapId,
    nodeId: encounter.nodeId,
    activityId: encounter.activityId ?? null,
    round: encounter.round,
  });
  const programVisits: MapRunEncounterProgramVisit[] = [];
  const programTrace: MapEffectTraceEntry[] = [];
  const programResourceEntries = new WeakMap<MapRunEncounterSettlementResourceChange, MapEffectResourceLedgerEntry>();
  const attachProgramResourceEntry = (change: MapRunEncounterSettlementResourceChange, entry: MapEffectResourceLedgerEntry) => {
    programResourceEntries.set(change, entry);
  };
  const recordProgramResourceSettlement = (
    change: MapRunEncounterSettlementResourceChange,
    before: number,
    after: number,
  ) => {
    if (change.kind !== 'effect') return;
    const entry = programResourceEntries.get(change);
    if (!entry) return;
    const visit = [...programVisits].reverse().find(candidate => candidate.sourceKey === entry.sourceKey
      && candidate.actionId === entry.actionId && candidate.path === entry.path);
    if (!visit) throw new MapRunError(['Program resource has no matching source visit']);
    programTrace.push(freezeProgramTraceEntry({
      sourceKey: entry.sourceKey,
      source: visit.source,
      actionId: entry.actionId,
      path: entry.path,
      op: 'resourceSettlement',
      mode: 'program',
      identity: entry.identity,
      account: entry.account,
      resourceId: entry.resourceId,
      intentDelta: entry.delta,
      before,
      after,
      delta: after - before,
    }));
  };
  const recordProgramVisit = (
    source: MapEffectProgramSourceIdentity,
    sourceKey: string,
    actionId: string,
    path: string,
    kind: 'prepare' | 'statement' | 'condition',
  ) => {
    if (programVisits.length >= 4096) throw new MapRunError(['the Encounter program visit budget exceeds 4096']);
    programVisits.push(Object.freeze({ sourceKey, source: freezeProgramSource(source), actionId, path, kind, mode: 'program' }));
  };
  const cardReceiverFor = (targetCard: MapRunCardRef): MapEffectActorIdentity | null => {
    let rawIdentity: unknown;
    try { rawIdentity = JSON.parse(targetCard.id); } catch { return null; }
    if (!Array.isArray(rawIdentity) || rawIdentity.length !== 4) return null;
    const [zone, rawKind, id, actionId] = rawIdentity;
    if ((zone !== 'hand' && zone !== 'playerCommand') || typeof id !== 'string' || typeof actionId !== 'string'
      || (rawKind !== 'partyCharacter' && rawKind !== 'enemy')) return null;
    const choice = activeCardChoices.find(candidate => {
      const ownerMatches = rawKind === 'partyCharacter'
        ? 'characterId' in candidate && candidate.characterId === id
        : 'enemyId' in candidate && candidate.enemyId === id;
      const zoneMatches = zone === 'playerCommand'
        ? candidate.overrideKind === 'playerCommand'
        : candidate.overrideKind !== 'playerCommand';
      return ownerMatches && candidate.actionId === actionId && zoneMatches;
    });
    return choice ? { kind: rawKind, id } : null;
  };
  const appendPrepareMetadata = (
    metadata: ReturnType<typeof resolveMapCardEffects>['prepareMetadata'][number],
    cardPlan: ReturnType<typeof resolveMapCardEffects>,
  ) => {
    const targetCard = cardPlan.targets.get(metadata.sourceKey);
    if (!targetCard) throw new MapRunError([`Action "${metadata.actionId}" has no resolved prepare CardRef`]);
    const source: MapEffectProgramSourceIdentity = metadata.source;
    recordProgramVisit(source, metadata.sourceKey, metadata.actionId, metadata.effectPath, 'prepare');
    programTrace.push(freezeProgramTraceEntry({
      sourceKey: metadata.sourceKey,
      source,
      actionId: metadata.actionId,
      path: metadata.effectPath,
      op: 'discountSCost',
      mode: 'program',
      amount: metadata.leaf.amount,
      targetCard,
      receiver: cardReceiverFor(targetCard),
    }));
  };
  for (const metadata of cardPlan.prepareMetadata) appendPrepareMetadata(metadata, cardPlan);

  const actorBalances = new Map(slot.run.actorResources.map(balance => [
    actorResourceKey(balance.characterId, balance.resourceId), balance.value,
  ]));
  const teamBalances = new Map(slot.run.teamResources.map(balance => [balance.resourceId, balance.value]));
  const enemyActorBalances = new Map(encounter.enemyActorResources.map(balance => [
    actorResourceKey(balance.enemyId, balance.resourceId), balance.value,
  ]));
  const enemyTeamBalances = new Map(encounter.enemyTeamResources.map(balance => [balance.resourceId, balance.value]));
  const settlements: MapRunEncounterActionSettlement[] = [];
  const pendingSourceHpChanges: {
    readonly settlement: { readonly kind: 'ability' } | { readonly kind: 'item' };
    readonly action: GameplayMapActionDef;
    readonly programPlan?: ReturnType<typeof planMapEffectSource>;
  }[] = [];
  const requiredCosts = new Map<string, {
    readonly scope: 'actor' | 'team';
    readonly characterId?: string;
    readonly enemyId?: string;
    readonly teamSide?: 'enemy';
    readonly resourceId: string;
    amount: bigint;
  }>();
  let playerCostRequired = 0;
  let ability: MapRunEncounterSourceSettlement | null = null;
  let item: MapRunEncounterItemSettlement | null = null;
  const actionById = new Map((slot.definition.actions ?? []).map(action => [action.id, action]));
  const preparedPartyTagSources = Object.freeze(preview.preparedActions.flatMap(prepared => {
    if (prepared.preparedActionId === null) return [];
    const action = actionById.get(prepared.preparedActionId);
    if (!action) throw new MapRunError([`Prepared Action "${prepared.preparedActionId}" is no longer defined`]);
    return [Object.freeze({
      characterId: prepared.characterId,
      actionId: action.id,
      origin: prepared.overrideKind === 'playerCommand' ? 'playerCommand' as const : 'hand' as const,
      tags: Object.freeze([...(action.tags ?? [])]),
    })];
  }));
  const partyHpAfter = new Map(slot.run.partyHp.map(row => [row.characterId, row.currentHp]));
  const enemyHpAfter = new Map(encounter.enemies.map(row => [row.enemyId, row.currentHp]));
  const partyCaps = partyHpCaps(slot.definition, slot.run.party);
  const enemyDefinitions = encounterDef.enemies ?? [];
  const enemyCaps = new Map(enemyDefinitions.map(enemy => [enemy.id, enemy.maxHp]));
  let plannedLocals = copyMapEncounterLocalsState(
    encounter.locals ?? { counters: {}, flags: {} }, encounterDef.locals,
  );
  let plannedStatuses: readonly MapEncounterStatusInstance[] = encounter.statuses ?? [];
  let statusTrace: readonly MapEffectStatusTickTraceEntry[] = [];
  const programSourceKey = (source: MapEffectProgramSourceIdentity): string => source.kind === 'partyCharacter' || source.kind === 'enemy'
    ? mapCardActorKey(source.kind, source.id)
    : source.kind === 'ability' ? JSON.stringify(['ability', source.actionId])
      : JSON.stringify(['item', source.itemId, source.actionId]);
  const planProgramSource = (
    action: GameplayMapActionDef,
    source: MapEffectProgramSourceIdentity,
    primary: MapEffectActorIdentity | null,
    teamSide: 'party' | 'enemy',
  ): ReturnType<typeof planMapEffectSource> => {
    const effects = normalizeMapRunActionEffects(action);
    const sourceKey = programSourceKey(source);
    const hp: Record<string, { current: number; cap: number }> = {};
    for (const [id, current] of partyHpAfter) {
      const cap = partyCaps.get(id);
      if (cap !== undefined) hp[`partyCharacter:${id}`] = { current, cap };
    }
    for (const [id, current] of enemyHpAfter) {
      const cap = enemyCaps.get(id);
      if (cap !== undefined) hp[`enemy:${id}`] = { current, cap };
    }
    let plan: ReturnType<typeof planMapEffectSource>;
    try {
      plan = planMapEffectSource({
        input: {
          sourceKey,
          actionId: action.id,
          source: source.kind === 'partyCharacter' || source.kind === 'enemy' ? source : null,
          primary,
          sourceTeam: { kind: 'team', side: teamSide },
          preparedPartyTagSources,
          sourceIdentity: source,
          statusDefinitions: slot.definition.statuses ?? [],
          statuses: plannedStatuses,
          hp,
          locals: plannedLocals,
          round: encounter.round,
          targetOrder: {
            party: slot.run.party.map(member => member.characterId),
            enemy: enemyDefinitions.map(enemy => enemy.id),
          },
        },
        effects,
        visit: access => recordProgramVisit(source, sourceKey, action.id, access.path, access.kind),
      });
    } catch (error) {
      throw new MapRunError([error instanceof Error ? error.message : String(error)]);
    }
    for (const [key, value] of Object.entries(plan.hp)) {
      const separator = key.indexOf(':');
      const kind = key.slice(0, separator);
      const id = key.slice(separator + 1);
      if (kind === 'partyCharacter') partyHpAfter.set(id, value.current);
      else if (kind === 'enemy') enemyHpAfter.set(id, value.current);
    }
    try {
      plannedLocals = copyMapEncounterLocalsState(plan.locals, encounterDef.locals);
    } catch (error) {
      throw new MapRunError([error instanceof Error ? error.message : String(error)]);
    }
    plannedStatuses = plan.plannedStatuses;
    for (const entry of plan.trace) {
      if (entry.op === 'resourceChange') continue;
      programTrace.push(freezeProgramTraceEntry({ ...entry, source, mode: 'program' }));
    }
    return plan;
  };

  const programHpChanges = (
    action: GameplayMapActionDef,
    programPlan?: ReturnType<typeof planMapEffectSource>,
  ): MapRunEncounterHpChange[] | undefined => {
    if (!programPlan) {
      if (action.effectProgram === undefined) return undefined;
      throw new MapRunError([`Action "${action.id}" has no detached effectProgram source plan`]);
    }
    const changes: MapRunEncounterHpChange[] = [];
    for (const trace of programPlan.trace) {
      if ((trace.op !== 'hpChange' && trace.op !== 'damage' && trace.op !== 'heal') || !trace.identity
        || (trace.identity.kind !== 'enemy' && trace.identity.kind !== 'partyCharacter')) continue;
      changes.push(trace.identity.kind === 'enemy'
        ? { scope: 'enemy', enemyId: trace.identity.id, delta: trace.delta }
        : { scope: 'party', characterId: trace.identity.id, delta: trace.delta });
    }
    return changes.length > 0 ? changes : undefined;
  };

  const addRequiredCosts = (resourceChanges: readonly MapRunEncounterSettlementResourceChange[]) => {
    for (const change of resourceChanges) {
      if (change.kind !== 'cost') continue;
      const key = JSON.stringify([change.scope, change.characterId ?? change.enemyId ?? null, change.teamSide ?? 'party', change.resourceId]);
      const existing = requiredCosts.get(key);
      requiredCosts.set(key, {
        scope: change.scope,
        ...(change.characterId === undefined ? {} : { characterId: change.characterId }),
        ...(change.enemyId === undefined ? {} : { enemyId: change.enemyId }),
        ...(change.teamSide === undefined ? {} : { teamSide: change.teamSide }),
        resourceId: change.resourceId,
        amount: (existing?.amount ?? 0n) + BigInt(-change.delta),
      });
    }
  };

  for (const prepared of preview.preparedActions) {
    if (prepared.targetSelectionRequired) {
      throw new MapRunError([`Character "${prepared.characterId}" still requires a target selection`]);
    }
    if (prepared.additionalTargetSelectionRequired) {
      throw new MapRunError([`Character "${prepared.characterId}" still requires an additional target selection`]);
    }
    const actionId = prepared.preparedActionId;
    if (actionId === null) {
      if (prepared.targetCharacterId !== null || prepared.overrideKind !== null || prepared.playerCost !== 0) {
        throw new MapRunError([`Character "${prepared.characterId}" has an invalid Wait preparation`]);
      }
      settlements.push({
        characterId: prepared.characterId,
        actionId: null,
        targetCharacterId: null,
        overrideKind: null,
        playerCostSpent: 0,
        resourceChanges: [],
      });
      continue;
    }
    const action = actionById.get(actionId);
    if (!action || !action.eligibleCharacterIds.includes(prepared.characterId)) {
      throw new MapRunError([`Prepared Action "${actionId}" is no longer valid for "${prepared.characterId}"`]);
    }
    let targetCharacterId = prepared.targetCharacterId;
    let targetEnemyId = prepared.targetEnemyId ?? null;
    const targetSelection = encounter.targetSelections.find(selection => selection.characterId === prepared.characterId);
    let skipReason: MapRunEncounterActionSettlement['skipReason'];
    if (prepared.skipReason === 'noLegalTarget') {
      if (action.target.kind !== 'card' || prepared.targetCard !== null || prepared.legalTargetCards?.length !== 0) {
        throw new MapRunError([`Prepared Action "${actionId}" has an invalid noLegalTarget skip`]);
      }
      skipReason = 'noLegalTarget';
    } else if (action.target.kind === 'enemy') {
      const currentHp = targetEnemyId === null ? 0 : enemyHpAfter.get(targetEnemyId) ?? 0;
      if (currentHp <= 0 && targetSelection?.targetEnemyId === undefined) {
        targetEnemyId = selectGameplayBUnitTarget(enemyDefinitions.flatMap(enemy => {
          const hp = enemyHpAfter.get(enemy.id) ?? 0;
          return hp > 0 ? [{ id: enemy.id, currentHp: hp, maxHp: enemy.maxHp }] : [];
        }), action.target.preference ?? 'stableOrder');
      }
      if (targetEnemyId === null) skipReason = 'noLegalTarget';
    } else if (action.target.kind === 'partyCharacter') {
      const currentHp = targetCharacterId === null ? 0 : partyHpAfter.get(targetCharacterId) ?? 0;
      if (currentHp <= 0 && targetSelection?.targetCharacterId === undefined) {
        targetCharacterId = selectGameplayBUnitTarget(slot.run.party.flatMap(member => {
          const hp = partyHpAfter.get(member.characterId) ?? 0;
          return hp > 0 ? [{ id: member.characterId, currentHp: hp, maxHp: partyCaps.get(member.characterId)! }] : [];
        }), action.target.preference ?? 'stableOrder');
      }
      if (targetCharacterId === null) skipReason = 'noLegalTarget';
    }

    const playerCostSpent = prepared.playerCost;
    playerCostRequired += playerCostSpent;
    if (skipReason) {
      settlements.push({
        characterId: prepared.characterId,
        actionId,
        targetCharacterId: null,
        overrideKind: prepared.overrideKind,
        playerCostSpent,
        resourceChanges: [],
        skipReason,
      });
      continue;
    }
    if ((action.target.kind === 'none' && targetCharacterId !== null)
      || (action.target.kind === 'self' && targetCharacterId !== prepared.characterId)
      || (action.target.kind === 'partyCharacter'
        && (!targetCharacterId || !slot.run.party.some(member => member.characterId === targetCharacterId)))
      || (action.target.kind === 'enemy' && (!targetEnemyId || !encounter.enemies.some(enemy => enemy.enemyId === targetEnemyId)))) {
      throw new MapRunError([`Prepared Action "${actionId}" has an invalid resolved target`]);
    }

    const reduction = cardPlan.reductions.get(mapCardActorKey('partyCharacter', prepared.characterId)) ?? 0n;
    const scostCost = mapScostCost(action, reduction);
    const partySource: MapEffectProgramSourceIdentity = { kind: 'partyCharacter', id: prepared.characterId };
    const programPlan = action.effectProgram === undefined ? undefined : planProgramSource(
      action,
      partySource,
      targetEnemyId !== null ? { kind: 'enemy', id: targetEnemyId }
        : targetCharacterId !== null ? { kind: 'partyCharacter', id: targetCharacterId } : null,
      'party',
    );
    const resourceChanges = settlementChangesFor(action, { kind: 'partyCharacter', id: prepared.characterId },
      settlementUnitTarget(targetCharacterId, targetEnemyId), reduction,
      { programPlan, onProgramResourceChange: attachProgramResourceEntry });
    addRequiredCosts(resourceChanges);
    const hpChanges = programHpChanges(action, programPlan);
    const settlement: MapRunEncounterActionSettlement = {
      characterId: prepared.characterId,
      actionId,
      targetCharacterId,
      ...(cardPlan.targets.has(mapCardActorKey('partyCharacter', prepared.characterId))
        ? { targetCard: cardPlan.targets.get(mapCardActorKey('partyCharacter', prepared.characterId))! } : {}),
      ...(scostCost ? { scostCost } : {}),
      ...(targetEnemyId === null ? {} : { targetEnemyId }),
      overrideKind: prepared.overrideKind,
      playerCostSpent,
      resourceChanges,
      ...(hpChanges ? { hpChanges } : {}),
    };
    settlements.push(settlement);
  }

  const sourceTargetIds = (target: MapRunEncounterSourceTarget) => ({
    targetCharacterId: target.kind === 'partyCharacter' ? target.characterId : null,
    targetEnemyId: target.kind === 'enemy' ? target.enemyId : null,
  });
  const abilityDraft: MapRunEncounterAbilityDraft | null = encounter.abilityDraft ?? null;
  if (abilityDraft !== null) {
    const exposed = encounterDef.abilityActionIds ?? [];
    if (!exposed.includes(abilityDraft.actionId)) {
      throw new MapRunError([`Ability Action "${abilityDraft.actionId}" is not exposed by this Encounter`]);
    }
    const action = actorlessSourceAction(slot, abilityDraft.actionId, 'Ability');
    validateSourceTarget(abilityDraft.target, action, slot, 'Ability');
    const abilityPrimary = abilityDraft.target;
    if (!abilityPrimary) throw new MapRunError(['Ability has no selected primary target']);
    if (action.additionalTarget) {
      const candidates = action.additionalTarget === 'partyCharacter'
        ? slot.run.partyHp.filter(row => row.currentHp > 0 && !(abilityPrimary.kind === 'partyCharacter' && row.characterId === abilityPrimary.characterId))
        : encounter.enemies.filter(row => row.currentHp > 0 && !(abilityPrimary.kind === 'enemy' && row.enemyId === abilityPrimary.enemyId));
      if (candidates.length === 0) throw new MapRunError(['Ability has no legal additional target and cannot be committed']);
      validateAdditionalSourceTarget(abilityDraft.additionalTarget, action, abilityPrimary, slot, 'Ability');
    } else if (abilityDraft.additionalTarget !== null) throw new MapRunError(['Ability does not accept an additional target']);
    playerCostRequired += 1;
    const { targetCharacterId, targetEnemyId } = sourceTargetIds(abilityDraft.target);
    const abilitySource: MapEffectProgramSourceIdentity = { kind: 'ability', actionId: action.id };
    const programPlan = action.effectProgram === undefined ? undefined : planProgramSource(
      action,
      abilitySource,
      targetEnemyId !== null ? { kind: 'enemy', id: targetEnemyId } : { kind: 'partyCharacter', id: targetCharacterId! },
      'party',
    );
    const resourceChanges = settlementChangesFor(action, null,
      settlementUnitTarget(targetCharacterId, targetEnemyId), 0n,
      { programPlan, onProgramResourceChange: attachProgramResourceEntry });
    addRequiredCosts(resourceChanges);
    ability = {
      actionId: action.id,
      target: abilityDraft.target,
      playerCostSpent: 1,
      resourceChanges,
      hpChanges: [],
    };
    pendingSourceHpChanges.push({ settlement: { kind: 'ability' }, action, programPlan });
  }

  const itemDraft: MapRunEncounterItemDraft | null = encounter.itemDraft ?? null;
  if (itemDraft !== null) {
    const mappings = encounterDef.itemActions ?? [];
    const mapping = mappings.find(candidate => candidate.itemId === itemDraft.itemId);
    if (!mapping || mapping.actionId !== itemDraft.actionId) {
      throw new MapRunError([`Item "${itemDraft.itemId}" is not mapped to this Encounter Action`]);
    }
    const action = actorlessSourceAction(slot, itemDraft.actionId, 'Item');
    validateSourceTarget(itemDraft.target, action, slot, 'Item');
    const itemPrimary = itemDraft.target;
    if (!itemPrimary) throw new MapRunError(['Item has no selected primary target']);
    if (action.additionalTarget) {
      const candidates = action.additionalTarget === 'partyCharacter'
        ? slot.run.partyHp.filter(row => row.currentHp > 0 && !(itemPrimary.kind === 'partyCharacter' && row.characterId === itemPrimary.characterId))
        : encounter.enemies.filter(row => row.currentHp > 0 && !(itemPrimary.kind === 'enemy' && row.enemyId === itemPrimary.enemyId));
      if (candidates.length === 0) throw new MapRunError(['Item has no legal additional target and cannot be committed']);
      validateAdditionalSourceTarget(itemDraft.additionalTarget, action, itemPrimary, slot, 'Item');
    } else if (itemDraft.additionalTarget !== null) throw new MapRunError(['Item does not accept an additional target']);
    const { targetCharacterId, targetEnemyId } = sourceTargetIds(itemDraft.target);
    const itemSource: MapEffectProgramSourceIdentity = {
      kind: 'item', actionId: action.id, itemId: itemDraft.itemId,
    };
    const programPlan = action.effectProgram === undefined ? undefined : planProgramSource(
      action,
      itemSource,
      targetEnemyId !== null ? { kind: 'enemy', id: targetEnemyId } : { kind: 'partyCharacter', id: targetCharacterId! },
      'party',
    );
    const resourceChanges = settlementChangesFor(action, null,
      settlementUnitTarget(targetCharacterId, targetEnemyId), 0n,
      { programPlan, onProgramResourceChange: attachProgramResourceEntry });
    addRequiredCosts(resourceChanges);
    item = {
      itemId: itemDraft.itemId,
      actionId: action.id,
      target: itemDraft.target,
      consumedCount: 1,
      resourceChanges,
      hpChanges: [],
    };
    pendingSourceHpChanges.push({ settlement: { kind: 'item' }, action, programPlan });
  }

  if (!Number.isSafeInteger(playerCostRequired) || playerCostRequired > slot.run.playerCost) {
    throw new MapRunError(['the Encounter round cannot pay its combined PlayerCost costs']);
  }
  for (const required of requiredCosts.values()) {
    const key = required.scope === 'actor' && (required.characterId !== undefined || required.enemyId !== undefined)
      ? actorResourceKey(required.characterId ?? required.enemyId!, required.resourceId)
      : required.resourceId;
    const startingBalance = required.scope === 'actor'
      ? required.enemyId === undefined ? actorBalances.get(key) : enemyActorBalances.get(key)
      : required.teamSide === 'enemy' ? enemyTeamBalances.get(key) : teamBalances.get(key);
    if (startingBalance === undefined) {
      throw new MapRunError([`Action costs reference a resource without a MapRun balance: "${required.resourceId}"`]);
    }
    if (required.amount > BigInt(startingBalance)) {
      throw new MapRunError([`the fixed-party round cannot afford resource cost "${required.resourceId}"`]);
    }
  }
  for (const required of requiredCosts.values()) {
    const key = required.scope === 'actor' && (required.characterId !== undefined || required.enemyId !== undefined)
      ? actorResourceKey(required.characterId ?? required.enemyId!, required.resourceId)
      : required.resourceId;
    const balance = required.scope === 'actor'
      ? required.enemyId === undefined ? actorBalances.get(key)! : enemyActorBalances.get(key)!
      : required.teamSide === 'enemy' ? enemyTeamBalances.get(key)! : teamBalances.get(key)!;
    const afterCosts = balance - Number(required.amount);
    if (!Number.isSafeInteger(afterCosts) || afterCosts < 0) {
      throw new MapRunError([`the fixed-party round produced an invalid post-cost balance for "${required.resourceId}"`]);
    }
    if (required.scope === 'actor') {
      if (required.enemyId === undefined) actorBalances.set(key, afterCosts);
      else enemyActorBalances.set(key, afterCosts);
    } else if (required.teamSide === 'enemy') enemyTeamBalances.set(key, afterCosts);
    else teamBalances.set(key, afterCosts);
  }

  const resourceSettlements = [
    ...settlements.map(settlement => ({ actionId: settlement.actionId, resourceChanges: settlement.resourceChanges })),
    ...(ability ? [{ actionId: ability.actionId, resourceChanges: ability.resourceChanges }] : []),
    ...(item ? [{ actionId: item.actionId, resourceChanges: item.resourceChanges }] : []),
  ];
  for (const settlement of resourceSettlements) {
    for (const change of settlement.resourceChanges) {
      if (change.kind !== 'effect') continue;
      const key = change.scope === 'actor' && (change.characterId !== undefined || change.enemyId !== undefined)
        ? actorResourceKey(change.characterId ?? change.enemyId!, change.resourceId)
        : change.resourceId;
      const targetBalances = change.scope === 'actor'
        ? change.enemyId === undefined ? actorBalances : enemyActorBalances
        : change.teamSide === 'enemy' ? enemyTeamBalances : teamBalances;
      const currentBalance = targetBalances.get(key) ?? 0;
      const afterEffect = currentBalance + change.delta;
      if (!Number.isSafeInteger(afterEffect) || afterEffect < 0) {
        throw new MapRunError([`Action "${settlement.actionId}" effect would leave an invalid balance for "${change.resourceId}"`]);
      }
      targetBalances.set(key, afterEffect);
      recordProgramResourceSettlement(change, currentBalance, afterEffect);
    }
  }

  const pendingHpChanges: { settlement: (typeof pendingSourceHpChanges)[number]['settlement']; changes: MapRunEncounterHpChange[] }[] = [];
  for (const pending of pendingSourceHpChanges) {
    const changes = programHpChanges(pending.action, pending.programPlan);
    if (changes && changes.length > 0) pendingHpChanges.push({ settlement: pending.settlement, changes });
  }
  for (const applied of pendingHpChanges) {
    if (applied.settlement.kind === 'ability' && ability) {
      ability = { ...ability, hpChanges: applied.changes };
    } else if (applied.settlement.kind === 'item' && item) {
      item = { ...item, hpChanges: applied.changes };
    }
  }

  let terminal: MapRunEncounterCommitPlan['terminal'] = 'none';
  const isDefeated = () => slot.run.party.every(member => (partyHpAfter.get(member.characterId) ?? 0) === 0);
  const hasBattle = enemyDefinitions.length > 0;
  const rounds = encounterRounds(encounterDef);
  const allEnemiesDefeated = () => hasBattle
    && enemyDefinitions.every(enemy => (enemyHpAfter.get(enemy.id) ?? 0) === 0);
  if (isDefeated()) {
    terminal = 'failure';
  } else if (allEnemiesDefeated()) {
    terminal = 'victory';
  }

  const enemyActions: MapRunEncounterEnemyActionSettlement[] = [];
  const enemyDiscounts = new Map(cardPlan.reductions);
  const cardScope = { runId: slot.run.runId, mapId: slot.run.mapId,
    nodeId: encounter.nodeId, activityId: encounter.activityId ?? null, round: encounter.round };
  const enemyById = new Map(enemyDefinitions.map(enemy => [enemy.id, enemy]));
  const enemyOrder = new Map(enemyDefinitions.map((enemy, index) => [enemy.id, index]));
  const pushEnemySkip = (enemyId: string, actionId: string, skipReason: 'defeated' | 'noLegalTarget' | 'unaffordable' | 'roundEnded') => {
    enemyActions.push({ enemyId, actionId, skipReason, resourceChanges: [] });
  };
  const applyEnemyResourceChanges = (actionId: string, changes: readonly MapRunEncounterSettlementResourceChange[]) => {
    for (const kind of ['cost', 'effect'] as const) {
      for (const change of changes) {
        if (change.kind !== kind) continue;
        const key = change.scope === 'actor'
          ? actorResourceKey(change.characterId ?? change.enemyId ?? '', change.resourceId)
          : change.resourceId;
        const balances = change.scope === 'actor'
          ? change.enemyId === undefined ? actorBalances : enemyActorBalances
          : change.teamSide === 'enemy' ? enemyTeamBalances : teamBalances;
        const current = balances.get(key) ?? 0;
        const next = current + change.delta;
        if (!Number.isSafeInteger(next) || next < 0) {
          throw new MapRunError([`Action "${actionId}" would leave an invalid balance for "${change.resourceId}"`]);
        }
        balances.set(key, next);
        recordProgramResourceSettlement(change, current, next);
      }
    }
  };
  const enemyActionCostsArePayable = (changes: readonly MapRunEncounterSettlementResourceChange[]) => {
    const requirements = new Map<string, { readonly balance: number; amount: bigint }>();
    for (const change of changes) {
      if (change.kind !== 'cost') continue;
      const key = JSON.stringify([change.scope, change.characterId ?? change.enemyId ?? null, change.teamSide ?? 'party', change.resourceId]);
      const balance = change.scope === 'actor'
        ? change.enemyId === undefined
          ? actorBalances.get(actorResourceKey(change.characterId ?? '', change.resourceId)) ?? 0
          : enemyActorBalances.get(actorResourceKey(change.enemyId, change.resourceId)) ?? 0
        : change.teamSide === 'enemy' ? enemyTeamBalances.get(change.resourceId) ?? 0 : teamBalances.get(change.resourceId) ?? 0;
      const previous = requirements.get(key);
      requirements.set(key, { balance, amount: (previous?.amount ?? 0n) + BigInt(-change.delta) });
    }
    return [...requirements.values()].every(row => row.amount <= BigInt(row.balance));
  };

  for (const prepared of preview.preparedEnemyActions) {
    const enemyId = prepared.enemyId;
    const actionId = prepared.naturalActionId;
    const enemy = enemyById.get(enemyId);
    if (!enemy) throw new MapRunError([`Prepared Enemy "${enemyId}" is no longer in the Encounter roster`]);
    if (actionId === null) {
      enemyActions.push({ enemyId, actionId: null, resourceChanges: [] });
      continue;
    }
    const action = actionById.get(actionId);
    if (!action || !candidateActionIdsFor(slot.definition, enemy.actions, enemy.candidatePoolIds,
      encounter.candidateSourceSnapshot).has(actionId)) {
      throw new MapRunError([`Enemy Prepared Action "${actionId}" is no longer valid for "${enemyId}"`]);
    }
    if ((enemyHpAfter.get(enemyId) ?? 0) <= 0) {
      pushEnemySkip(enemyId, actionId, 'defeated');
      continue;
    }
    if (terminal !== 'none') {
      pushEnemySkip(enemyId, actionId, 'roundEnded');
      continue;
    }

    let targetCharacterId: string | null = null;
    let targetEnemyId: string | null = null;
    let targetCard = prepared.targetCard ?? null;
    if (action.target.kind === 'partyCharacter') {
      targetCharacterId = prepared.targetCharacterId;
      if (targetCharacterId === null || (partyHpAfter.get(targetCharacterId) ?? 0) <= 0) {
        targetCharacterId = selectGameplayBUnitTarget(slot.run.party.flatMap(member => {
          const hp = partyHpAfter.get(member.characterId) ?? 0;
          return hp > 0 ? [{ id: member.characterId, currentHp: hp, maxHp: partyCaps.get(member.characterId)! }] : [];
        }), action.target.preference ?? 'stableOrder');
      }
      if (targetCharacterId === null) {
        pushEnemySkip(enemyId, actionId, 'noLegalTarget');
        continue;
      }
    } else if (action.target.kind === 'enemy') {
      targetEnemyId = prepared.targetEnemyId;
      if (targetEnemyId === null || (enemyHpAfter.get(targetEnemyId) ?? 0) <= 0) {
        targetEnemyId = selectGameplayBUnitTarget(enemyDefinitions.flatMap(candidate => {
          const hp = enemyHpAfter.get(candidate.id) ?? 0;
          return hp > 0 ? [{ id: candidate.id, currentHp: hp, maxHp: candidate.maxHp }] : [];
        }), action.target.preference ?? 'stableOrder');
      }
      if (targetEnemyId === null) {
        pushEnemySkip(enemyId, actionId, 'noLegalTarget');
        continue;
      }
    } else if (action.target.kind === 'self') {
      targetEnemyId = enemyId;
    } else if (action.target.kind === 'card') {
      if (targetCard === null) {
        pushEnemySkip(enemyId, actionId, 'noLegalTarget');
        continue;
      }
    }

    const reduction = enemyDiscounts.get(mapCardActorKey('enemy', enemyId)) ?? 0n;
    const enemyActor: SettlementActor = { kind: 'enemy', id: enemyId };
    const resolvedTarget = settlementUnitTarget(targetCharacterId, targetEnemyId);
    const isProgramAction = action.effectProgram !== undefined;
    const costChanges = settlementChangesFor(action, enemyActor, resolvedTarget, reduction,
      isProgramAction ? { programCostProbe: true } : {});
    if (!enemyActionCostsArePayable(costChanges)) {
      pushEnemySkip(enemyId, actionId, 'unaffordable');
      continue;
    }
    if (isProgramAction) applyEnemyResourceChanges(actionId, costChanges);
    const enemyChoice: MapCardActionChoice | null = action.target.kind === 'card'
      ? { enemyId, actionId, overrideKind: null, targetCard } : null;
    const activePlan = enemyChoice === null ? null
      : resolveMapCardEffects(slot.definition, cardScope, [enemyChoice], activeCardChoices, encounter.candidateSourceSnapshot);
    for (const metadata of activePlan?.prepareMetadata ?? []) appendPrepareMetadata(metadata, activePlan!);
    const enemySource: MapEffectProgramSourceIdentity = { kind: 'enemy', id: enemyId };
    const programPlan = isProgramAction ? planProgramSource(
      action,
      enemySource,
      targetEnemyId !== null ? { kind: 'enemy', id: targetEnemyId }
        : targetCharacterId !== null ? { kind: 'partyCharacter', id: targetCharacterId } : null,
      'enemy',
    ) : undefined;
    const plannedResourceChanges = isProgramAction
      ? settlementChangesFor(action, enemyActor, resolvedTarget, reduction,
        { programPlan, onProgramResourceChange: attachProgramResourceEntry }).filter(change => change.kind === 'effect')
      : costChanges;
    applyEnemyResourceChanges(actionId, plannedResourceChanges);
    const resourceChanges = isProgramAction ? [...costChanges, ...plannedResourceChanges] : plannedResourceChanges;
    const hpChanges = programHpChanges(action, programPlan);
    const scostCost = mapScostCost(action, reduction);
    enemyActions.push({
      enemyId,
      actionId,
      ...(targetCharacterId === null ? {} : { targetCharacterId }),
      ...(targetEnemyId === null ? {} : { targetEnemyId }),
      ...(targetCard === null ? {} : { targetCard }),
      ...(scostCost ? { scostCost } : {}),
      resourceChanges,
      ...(hpChanges ? { hpChanges } : {}),
    });

    if (activePlan) {
      for (const [futureEnemyId, orderIndex] of enemyOrder) {
        if (orderIndex <= (enemyOrder.get(enemyId) ?? -1)) continue;
        const key = mapCardActorKey('enemy', futureEnemyId);
        const gained = activePlan.reductions.get(key) ?? 0n;
        if (gained > 0n) enemyDiscounts.set(key, (enemyDiscounts.get(key) ?? 0n) + gained);
      }
    }
    if (isDefeated()) {
      terminal = 'failure';
    } else if (allEnemiesDefeated()) {
      terminal = 'victory';
    }
  }

  if (terminal === 'none' && isDefeated()) terminal = 'failure';
  else if (terminal === 'none' && allEnemiesDefeated()) terminal = 'victory';
  if (terminal !== 'none') plannedStatuses = [];
  if (terminal === 'none' && (slot.definition.statuses?.length ?? 0) > 0) {
    try {
      const tick = applyMapEncounterStatusRoundEnd({
        round: encounter.round,
        definitions: slot.definition.statuses ?? [],
        statuses: plannedStatuses,
        partyOrder: slot.run.party.map(member => member.characterId),
        enemyOrder: enemyDefinitions.map(enemy => enemy.id),
        hp: Object.fromEntries([
          ...[...partyHpAfter].map(([id, current]) => [`partyCharacter:${id}`, {
            current, cap: partyCaps.get(id)!,
          }] as const),
          ...[...enemyHpAfter].map(([id, current]) => [`enemy:${id}`, {
            current, cap: enemyCaps.get(id)!,
          }] as const),
        ]),
      });
      plannedStatuses = tick.statuses;
      statusTrace = tick.trace;
      for (const [key, state] of Object.entries(tick.hp)) {
        const separator = key.indexOf(':');
        const kind = key.slice(0, separator);
        const id = key.slice(separator + 1);
        if (kind === 'partyCharacter') partyHpAfter.set(id, state.current);
        else if (kind === 'enemy') enemyHpAfter.set(id, state.current);
      }
    } catch (error) {
      throw new MapRunError([error instanceof Error ? error.message : String(error)]);
    }
  }
  if (terminal === 'none' && isDefeated()) terminal = 'failure';
  else if (terminal === 'none' && allEnemiesDefeated()) terminal = 'victory';
  else if (terminal === 'none' && !hasBattle && rounds !== undefined && encounter.round >= rounds) {
    // A Rest ends on its declared finite round count after Status tick.
    terminal = 'victory';
  } else if (terminal === 'none' && !hasBattle && encounterDef.completion?.kind === 'condition'
    && encounterCompletionSatisfied(encounterDef.completion.condition, plannedLocals)) {
    terminal = 'victory';
  }
  return {
    settlements,
    enemyActions,
    ability,
    item,
    playerCostRequired,
    actorBalancesAfter: actorBalances,
    teamBalancesAfter: teamBalances,
    enemyActorBalancesAfter: enemyActorBalances,
    enemyTeamBalancesAfter: enemyTeamBalances,
    partyHpAfter,
    enemyHpAfter,
    terminal,
    ...((slot.definition.statuses?.length ?? 0) === 0 ? {} : {
      statusReceiptVersion: 1 as const,
      plannedStatuses: Object.freeze([...plannedStatuses]),
      statusTrace: Object.freeze([...statusTrace]),
    }),
    ...(!hasProgramActions ? {} : {
      programReceiptVersion: 1 as const,
      executionContractId: 'E1-COMPAT-1' as const,
      effectScope,
      programVisits: Object.freeze([...programVisits]),
      plannedLocals: copyMapEncounterLocalsState(plannedLocals, encounterDef.locals),
      effectTrace: Object.freeze(programTrace.map(freezeProgramTraceEntry)),
    }),
  };
}

function restoreActorlessSourceSettlement(
  value: unknown,
  kind: 'ability',
  encounter: NonNullable<ResolvedMap['nodes'][number]['encounter']>,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunEncounterSourceSettlement | null;
function restoreActorlessSourceSettlement(
  value: unknown,
  kind: 'item',
  encounter: NonNullable<ResolvedMap['nodes'][number]['encounter']>,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunEncounterItemSettlement | null;
function restoreActorlessSourceSettlement(
  value: unknown,
  kind: 'ability' | 'item',
  encounter: NonNullable<ResolvedMap['nodes'][number]['encounter']>,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunEncounterSourceSettlement | MapRunEncounterItemSettlement | null {
  if (!isRecord(value)) return null;
  const expectedKeys = kind === 'ability'
    ? ['actionId', 'target', 'playerCostSpent', 'resourceChanges', 'hpChanges']
    : ['itemId', 'actionId', 'target', 'consumedCount', 'resourceChanges', 'hpChanges'];
  if (Object.keys(value).length !== expectedKeys.length || Object.keys(value).some(key => !expectedKeys.includes(key))
    || !isNonEmptyId(value.actionId) || !Array.isArray(value.resourceChanges) || !Array.isArray(value.hpChanges)) return null;
  const action = (definition.actions ?? []).find(candidate => candidate.id === value.actionId);
  if (!isActorlessSourceAction(action)) return null;
  const target = parseSourceTarget(value.target);
  if (!target || target.kind !== action.target.kind) return null;
  if (target.kind === 'partyCharacter' && !party.some(member => member.characterId === target.characterId)) return null;
  const enemyIds = new Set((encounter.enemies ?? []).map(enemy => enemy.id));
  if (target.kind === 'enemy' && !enemyIds.has(target.enemyId)) return null;
  if (kind === 'ability') {
    if (!encounter.abilityActionIds?.includes(value.actionId) || value.playerCostSpent !== 1) return null;
  } else {
    if (!isNonEmptyId(value.itemId) || value.consumedCount !== 1
      || !encounter.itemActions?.some(mapping => mapping.itemId === value.itemId && mapping.actionId === value.actionId)) return null;
  }
  let expectedChanges: MapRunEncounterSettlementResourceChange[];
  try {
    expectedChanges = settlementChangesFor(action, null,
      target.kind === 'partyCharacter' ? { kind: 'partyCharacter', id: target.characterId } : { kind: 'enemy', id: target.enemyId },
      0n, { programCostProbe: true });
  } catch {
    return null;
  }
  const rawResourceChanges = value.resourceChanges as unknown[];
  const projectedCosts = rawResourceChanges.filter((raw): raw is Record<string, unknown> => isRecord(raw) && raw.kind === 'cost');
  if (expectedChanges.length !== projectedCosts.length) return null;
  for (const [index, raw] of projectedCosts.entries()) {
    const expected = expectedChanges[index];
    if (!expected || !isRecord(raw)) return null;
    const expectedKeysForChange = [
      'kind', 'scope',
      ...(expected.characterId === undefined ? [] : ['characterId']),
      ...(expected.enemyId === undefined ? [] : ['enemyId']),
      ...(expected.teamSide === undefined ? [] : ['teamSide']),
      'resourceId', 'delta',
    ];
    if (Object.keys(raw).length !== expectedKeysForChange.length
      || Object.keys(raw).some(key => !expectedKeysForChange.includes(key))
      || raw.kind !== expected.kind || raw.scope !== expected.scope
      || raw.characterId !== expected.characterId || raw.enemyId !== expected.enemyId
      || raw.teamSide !== expected.teamSide || raw.resourceId !== expected.resourceId
      || raw.delta !== expected.delta) return null;
  }
  const expectedIdentity = target.kind === 'enemy'
    ? { kind: 'enemy' as const, id: target.enemyId }
    : { kind: 'partyCharacter' as const, id: target.characterId };
  const hpChanges = restoreHpChangeEntries(value.hpChanges, action, expectedIdentity,
    new Set(party.map(member => member.characterId)), new Set(enemyIds));
  if (!hpChanges) return null;
  const restoredResourceChanges = rawResourceChanges.filter(isRecord)
    .map(change => ({ ...change }) as unknown as MapRunEncounterSettlementResourceChange);
  return kind === 'ability'
    ? {
      actionId: value.actionId,
      target,
      playerCostSpent: 1,
      resourceChanges: restoredResourceChanges,
      hpChanges,
    }
    : {
      itemId: value.itemId as string,
      actionId: value.actionId,
      target,
      consumedCount: 1,
      resourceChanges: restoredResourceChanges,
      hpChanges,
    };
}

function stableReceiptValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableReceiptValue);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableReceiptValue(value[key])]));
  return value;
}

function sameReceiptValue(left: unknown, right: unknown): boolean {
  try { return JSON.stringify(stableReceiptValue(left)) === JSON.stringify(stableReceiptValue(right)); }
  catch { return false; }
}

function restoreAg1EncounterCommitReceipt(
  value: Record<string, unknown>,
  definition: ResolvedMap,
  encounterDef: GameplayEncounterDef,
  nodeId: string,
  party: readonly MapRunPartyMember[],
  commitVersion: number,
  runId: string,
  activityId: string | undefined,
  currentEncounter: MapEffectReceiptContext['currentEncounter'] | undefined,
  currentBalances: MapEffectReceiptBalances | undefined,
  currentShields?: unknown,
): MapRunEncounterCommitReceipt | null {
  const start = value.schedulerStartSnapshot;
  const shieldMap = gameplayMapUsesShieldAdd(definition);
  const schedulerKeys = ['schedulerFormatVersion', 'schedulerStartSnapshot', 'schedulerTerminal', 'executionSequence',
    'plannedEffectRandomState', ...(shieldMap ? ['shieldReceiptVersion', 'shieldStart', 'plannedShields', 'shieldTrace'] : [])];
  const startFactState = restoreMapRunFacts(start, definition);
  const startRootKeys = ['runId', 'mapId', 'party', 'partyAgility', 'partyHp', 'playerCost', 'actorResources', 'teamResources', 'encounter',
    ...(definition.mapRunFacts === undefined ? [] : ['mapRunFacts']),
    ...(gameplayMapUsesMapRunStatus(definition) ? ['mapRunStatuses'] : [])];
  const receiptKeys = [
    'requestId', 'commandVersion', 'resultingCommitVersion', 'nodeId', 'activityId', 'round', 'draftVersion',
    'settlements', 'enemyActions', 'ability', 'item', 'executionContractId', ...schedulerKeys,
    'plannedMapRunFacts', 'plannedEffectRandomState', 'programReceiptVersion', 'effectScope', 'programVisitCount', 'programVisits', 'plannedLocals', 'effectTrace',
    'cardEffectModifierReceipts', 'statusReceiptVersion', 'plannedStatuses', 'statusTrace', 'statusRemoveTrace', 'statusConsumeTrace', 'statusCategoryRemoveTrace',
    ...(gameplayMapUsesMapRunStatus(definition) ? ['plannedMapRunStatuses'] : []),
    'triggerReceiptVersion', 'triggerTrace', 'statusExpiryTriggerTrace', 'statusDamageTriggerTrace',
  ];
  const expectedSchedulerVersion = gameplayMapUsesMapRunStatus(definition) ? 7 : shieldMap ? 6 : 5;
  if (value.executionContractId !== 'AG-1' || value.schedulerFormatVersion !== expectedSchedulerVersion
    || !Array.isArray(value.executionSequence) || !isRecord(start)
    || startFactState === null
    || Object.keys(start).length !== startRootKeys.length
    || Object.keys(start).some(key => !startRootKeys.includes(key))
    || value.schedulerTerminal === undefined
    || !Number.isSafeInteger(value.commandVersion) || value.commandVersion !== commitVersion - 1
    || value.resultingCommitVersion !== commitVersion
    || value.nodeId !== nodeId || value.round !== (start.encounter as Record<string, unknown> | undefined)?.round
    || value.draftVersion !== (start.encounter as Record<string, unknown> | undefined)?.draftVersion
    || (activityId === undefined ? Object.prototype.hasOwnProperty.call(value, 'activityId')
      : value.activityId !== activityId)
    || Object.keys(value).some(key => !receiptKeys.includes(key))) return null;

  const expectedResources = initialResourceBalances(definition, party);
  const partyHp = restorePartyHp(start.partyHp, definition, party);
  const mapRunFacts = startFactState;
  const mapRunStatuses = restoreMapRunStatuses(start, definition, party, value.commandVersion as number);
  const actorResources = restoreActorResourceBalances(start.actorResources, expectedResources.actorResources);
  const teamResources = restoreTeamResourceBalances(start.teamResources, expectedResources.teamResources);
  const partyAgility = restoreAgilitySnapshot(start.partyAgility, initialPartyAgility(definition, party), 'characterId');
  const startEnemyIds = (encounterDef.enemies ?? []).map(enemy => enemy.id);
  const startEncounter = isRecord(start.encounter) ? start.encounter : null;
  const startShields = shieldMap
    ? startEncounter === null ? null : restoreShieldLedger(startEncounter.shields, party.map(member => member.characterId), startEnemyIds)
    : undefined;
  if (start.runId !== runId || start.mapId !== definition.id || !sameReceiptValue(start.party, party)
    || !Number.isSafeInteger(start.playerCost) || (start.playerCost as number) < 0
    || !partyHp || !actorResources || !teamResources || !partyAgility || startEncounter === null || mapRunStatuses === null
    || (shieldMap && (startShields === null || value.shieldReceiptVersion !== 1
      || !sameReceiptValue(value.shieldStart, startShields)))) return null;
  const rawEncounter = startEncounter;
  const encounterNodeId = nodeId;
  const rawActivityId = activityId;
  const encounterSnapshotInput = {
    ...rawEncounter,
    ...(rawActivityId === undefined ? {} : { activityId: rawActivityId }),
    lastCommit: null,
  };
  const encounter = restoreEncounterSnapshot(encounterSnapshotInput, definition, encounterNodeId, party,
    partyHp, actorResources, teamResources, start.playerCost as number, value.commandVersion as number,
    runId, activityId, mapRunFacts ?? undefined);
  if (!encounter || encounter.round !== value.round || encounter.draftVersion !== value.draftVersion) return null;

  const historicalRun: MutableMapRun = {
    runId, mapId: definition.id, party: party.map(member => ({ ...member }),), partyAgility: [...partyAgility],
    partyHp, lastEncounterCommit: null, playerCost: start.playerCost as number,
    commitVersion: value.commandVersion as number, actorResources, teamResources,
    ...(mapRunFacts === undefined ? {} : { mapRunFacts }),
    ...(mapRunStatuses === undefined ? {} : { mapRunStatuses: [...mapRunStatuses] }),
    status: 'inProgress', currentNodeId: nodeId, visitedNodeIds: [nodeId], completedEncounterNodeIds: [],
    completedActivityIds: [], activeActivity: null, activeEncounter: encounter,
  };
  let plan: MapRunEncounterCommitPlan;
  try { plan = resolveAg1EncounterCommitPlan({ definition, run: historicalRun }); }
  catch { return null; }
  const expected: Record<string, unknown> = {
    executionContractId: 'AG-1', schedulerFormatVersion: plan.schedulerFormatVersion,
    schedulerStartSnapshot: plan.schedulerStartSnapshot, schedulerTerminal: plan.schedulerTerminal,
    executionSequence: plan.executionSequence, settlements: plan.settlements,
    ...(plan.enemyActions.length > 0 ? { enemyActions: plan.enemyActions } : {}),
    ...(plan.ability === null ? {} : { ability: plan.ability }), ...(plan.item === null ? {} : { item: plan.item }),
    ...(plan.programReceiptVersion === undefined ? {} : {
      programReceiptVersion: plan.programReceiptVersion, effectScope: plan.effectScope,
      programVisitCount: plan.programVisits?.length ?? 0, programVisits: plan.programVisits,
      plannedLocals: plan.plannedLocals, effectTrace: plan.effectTrace,
    }),
    ...(plan.cardEffectModifierReceipts === undefined ? {} : { cardEffectModifierReceipts: plan.cardEffectModifierReceipts }),
    ...(plan.statusReceiptVersion === undefined ? {} : {
      statusReceiptVersion: plan.statusReceiptVersion, plannedStatuses: plan.plannedStatuses, statusTrace: plan.statusTrace,
      ...(plan.statusReceiptVersion === 7 ? { plannedMapRunStatuses: plan.plannedMapRunStatuses } : {}),
      ...(plan.statusReceiptVersion !== 1 ? { statusRemoveTrace: plan.statusRemoveTrace } : {}),
      ...(plan.statusReceiptVersion >= 3 ? { statusConsumeTrace: plan.statusConsumeTrace } : {}),
      ...(plan.statusReceiptVersion >= 4 ? { statusCategoryRemoveTrace: plan.statusCategoryRemoveTrace } : {}),
    }),
    ...(plan.plannedMapRunFacts === undefined ? {} : { plannedMapRunFacts: plan.plannedMapRunFacts }),
    plannedEffectRandomState: plan.plannedEffectRandomState,
    ...(plan.shieldReceiptVersion === undefined ? {} : {
      shieldReceiptVersion: plan.shieldReceiptVersion,
      shieldStart: plan.shieldStart,
      plannedShields: plan.plannedShields,
      shieldTrace: plan.shieldTrace,
    }),
    ...(plan.triggerReceiptVersion === undefined ? {} : {
      triggerReceiptVersion: plan.triggerReceiptVersion, triggerTrace: plan.triggerTrace,
      ...(plan.triggerReceiptVersion >= 2 ? { statusExpiryTriggerTrace: plan.statusExpiryTriggerTrace } : {}),
      ...(plan.triggerReceiptVersion === 4 ? { statusDamageTriggerTrace: plan.statusDamageTriggerTrace } : {}),
    }),
  };
  for (const key of [...schedulerKeys.slice(0, 0), 'executionContractId', 'schedulerFormatVersion',
    'schedulerStartSnapshot', 'schedulerTerminal', 'executionSequence', 'settlements', 'enemyActions', 'ability', 'item',
    'programReceiptVersion', 'effectScope', 'programVisitCount', 'programVisits', 'plannedLocals', 'effectTrace',
    'cardEffectModifierReceipts',
    'plannedMapRunFacts', 'plannedEffectRandomState',
    'statusReceiptVersion', 'plannedStatuses', 'statusTrace', 'statusRemoveTrace', 'statusConsumeTrace', 'statusCategoryRemoveTrace',
    'plannedMapRunStatuses',
    'triggerReceiptVersion', 'triggerTrace', 'statusExpiryTriggerTrace', 'statusDamageTriggerTrace',
    'shieldReceiptVersion', 'shieldStart', 'plannedShields', 'shieldTrace']) {
    if (Object.prototype.hasOwnProperty.call(value, key) !== Object.prototype.hasOwnProperty.call(expected, key)
      || (Object.prototype.hasOwnProperty.call(expected, key)
        && !sameReceiptValue(value[key], expected[key]))) return null;
  }

  if (currentEncounter && currentEncounter.round === (value.round as number) + 1 && currentBalances) {
    const startEncounter = start.encounter as Record<string, unknown>;
    // A configured locals scope or a Program receipt is retained on the live
    // successor. An unconfigured, program-free Encounter may omit it.
    const localsExpected = encounterDef.locals !== undefined || plan.plannedLocals !== undefined;
    const statusesExpected = (definition.statuses?.length ?? 0) > 0
      || (Array.isArray(startEncounter.statuses) && startEncounter.statuses.length > 0);
    const checkRows = (actual: unknown, expectedMap: ReadonlyMap<string, number>, identity: (row: Record<string, unknown>) => string) => {
      if (!Array.isArray(actual) || !actual.every(isRecord) || actual.length !== expectedMap.size) return false;
      const seen = new Set<string>();
      for (const row of actual) {
        const key = identity(row);
        if (seen.has(key) || expectedMap.get(key) !== row.value) return false;
        seen.add(key);
      }
      return seen.size === expectedMap.size;
    };
    if (!checkRows(currentBalances.partyActor, plan.actorBalancesAfter, row => actorResourceKey(String(row.characterId), String(row.resourceId)))
      || !checkRows(currentBalances.partyTeam, plan.teamBalancesAfter, row => String(row.resourceId))
      || !checkRows(currentBalances.enemyActor, plan.enemyActorBalancesAfter, row => actorResourceKey(String(row.enemyId), String(row.resourceId)))
      || !checkRows(currentBalances.enemyTeam, plan.enemyTeamBalancesAfter, row => String(row.resourceId))
      || !sameReceiptValue(currentEncounter.partyHp, [...plan.partyHpAfter].map(([characterId, currentHp]) => ({ characterId, currentHp })))
      || !sameReceiptValue(currentEncounter.enemies, [...plan.enemyHpAfter].map(([enemyId, currentHp]) => ({ enemyId, currentHp })))
      || (currentEncounter.locals !== undefined) !== localsExpected
      || (localsExpected && !sameReceiptValue(currentEncounter.locals,
        plan.plannedLocals ?? startEncounter.locals))
      || (currentEncounter.statuses !== undefined) !== statusesExpected
      || (statusesExpected && !sameReceiptValue(currentEncounter.statuses,
        plan.plannedStatuses ?? startEncounter.statuses))
      || (shieldMap && !sameReceiptValue(currentShields, plan.plannedShields))) return null;
  }
  return {
    requestId: value.requestId as string, commandVersion: value.commandVersion as number,
    resultingCommitVersion: value.resultingCommitVersion as number, nodeId, ...(activityId === undefined ? {} : { activityId }),
    round: value.round as number, draftVersion: value.draftVersion as number,
    settlements: plan.settlements,
    ...(plan.enemyActions.length > 0 ? { enemyActions: plan.enemyActions } : {}),
    ...(plan.ability === null ? {} : { ability: plan.ability }), ...(plan.item === null ? {} : { item: plan.item }),
    executionContractId: 'AG-1', schedulerFormatVersion: plan.schedulerFormatVersion!,
    schedulerStartSnapshot: plan.schedulerStartSnapshot!, schedulerTerminal: plan.schedulerTerminal!,
    executionSequence: plan.executionSequence!,
    ...(plan.programReceiptVersion === undefined ? {} : {
      programReceiptVersion: plan.programReceiptVersion, effectScope: plan.effectScope!,
      programVisitCount: plan.programVisits!.length, programVisits: plan.programVisits!,
      plannedLocals: plan.plannedLocals!, effectTrace: plan.effectTrace!,
    }),
    ...(plan.cardEffectModifierReceipts === undefined ? {} : { cardEffectModifierReceipts: plan.cardEffectModifierReceipts }),
    ...(plan.statusReceiptVersion === undefined ? {} : {
      statusReceiptVersion: plan.statusReceiptVersion, plannedStatuses: plan.plannedStatuses!, statusTrace: plan.statusTrace!,
      ...(plan.statusReceiptVersion === 7 ? { plannedMapRunStatuses: copyMapRunStatusInstances(plan.plannedMapRunStatuses!) } : {}),
      ...(plan.statusReceiptVersion !== 1 ? { statusRemoveTrace: plan.statusRemoveTrace! } : {}),
      ...(plan.statusReceiptVersion >= 3 ? { statusConsumeTrace: plan.statusConsumeTrace! } : {}),
      ...(plan.statusReceiptVersion >= 4 ? { statusCategoryRemoveTrace: plan.statusCategoryRemoveTrace! } : {}),
    }),
    ...(plan.plannedMapRunFacts === undefined ? {} : { plannedMapRunFacts: copyMapRunFacts(plan.plannedMapRunFacts) }),
    plannedEffectRandomState: copyMapEffectRandomState(plan.plannedEffectRandomState),
    ...(plan.shieldReceiptVersion === undefined ? {} : {
      shieldReceiptVersion: plan.shieldReceiptVersion,
      shieldStart: copyShieldLedger(plan.shieldStart!),
      plannedShields: copyShieldLedger(plan.plannedShields!),
      shieldTrace: Object.freeze(plan.shieldTrace!.map(freezeShieldTraceEntry)),
    }),
    ...(plan.triggerReceiptVersion === undefined ? {} : {
      triggerReceiptVersion: plan.triggerReceiptVersion,
      triggerTrace: Object.freeze(plan.triggerTrace!.map(freezeTriggerTraceEntry)),
      ...(plan.triggerReceiptVersion >= 2 ? {
        statusExpiryTriggerTrace: Object.freeze(plan.statusExpiryTriggerTrace!.map(freezeStatusExpiryTriggerTraceEntry)),
      } : {}),
      ...(plan.triggerReceiptVersion === 4 ? { statusDamageTriggerTrace: Object.freeze(plan.statusDamageTriggerTrace!.map(entry => Object.freeze({
        ...entry, status: freezeDamageRewardStatus(entry.status), holder: Object.freeze({ ...entry.holder }),
      }))) } : {}),
    }),
  };
}

function restoreEncounterCommitReceipt(
  value: unknown,
  definition: ResolvedMap,
  expectedNodeId: string | null,
  party: readonly MapRunPartyMember[],
  encounterRound: number | null,
  commitVersion: number,
  runId: string,
  activityId?: string,
  currentEncounter?: MapEffectReceiptContext['currentEncounter'],
  currentBalances?: MapEffectReceiptBalances,
  currentShields?: unknown,
): MapRunEncounterCommitReceipt | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  const receiptNodeId = typeof value.nodeId === 'string' ? value.nodeId : null;
  const programReceiptFields = [
    'programReceiptVersion', 'executionContractId', 'effectScope', 'programVisitCount',
    'programVisits', 'plannedLocals', 'effectTrace',
  ] as const;
  const modifierReceiptFields = ['cardEffectModifierReceipts'] as const;
  const schedulerReceiptFields = [
    'schedulerFormatVersion', 'schedulerStartSnapshot', 'schedulerTerminal', 'executionSequence', 'plannedMapRunFacts',
    'plannedEffectRandomState', 'shieldReceiptVersion', 'shieldStart', 'plannedShields', 'shieldTrace',
    'triggerReceiptVersion', 'triggerTrace', 'statusExpiryTriggerTrace', 'statusDamageTriggerTrace',
  ] as const;
  const statusReceiptFields = ['statusReceiptVersion', 'plannedStatuses', 'statusTrace', 'statusRemoveTrace', 'statusConsumeTrace', 'statusCategoryRemoveTrace', 'plannedMapRunStatuses'] as const;
  const baseStatusReceiptFields = ['statusReceiptVersion', 'plannedStatuses', 'statusTrace'] as const;
  const hasStatusReceipt = statusReceiptFields.some(field => Object.prototype.hasOwnProperty.call(value, field));
  const ag1StatusReceipt = definition.executionContractId === 'AG-1';
  const hasEnemyActions = Object.prototype.hasOwnProperty.call(value, 'enemyActions');
  const hasAbility = Object.prototype.hasOwnProperty.call(value, 'ability');
  const hasItem = Object.prototype.hasOwnProperty.call(value, 'item');
  const hasActivityId = Object.prototype.hasOwnProperty.call(value, 'activityId');
  const hasTriggerVersion = Object.prototype.hasOwnProperty.call(value, 'triggerReceiptVersion');
  const hasActionTriggerTrace = Object.prototype.hasOwnProperty.call(value, 'triggerTrace');
  const hasStatusExpiryTriggerTrace = Object.prototype.hasOwnProperty.call(value, 'statusExpiryTriggerTrace');
  const hasStatusDamageTriggerTrace = Object.prototype.hasOwnProperty.call(value, 'statusDamageTriggerTrace');
  const shieldMap = gameplayMapUsesShieldAdd(definition);
  const damageReductionMap = gameplayMapUsesDamageReduction(definition);
  const damageProtectionMap = gameplayMapUsesDamageProtection(definition);
  if (keys.length < 7 || keys.length > (shieldMap ? 39 : 35) + (gameplayMapUsesMapRunStatus(definition) ? 1 : 0)
    + (gameplayMapUsesStatusDamageReward(definition) ? 1 : 0) || keys.some(key => ![
    'requestId', 'commandVersion', 'resultingCommitVersion', 'nodeId', 'activityId', 'round', 'draftVersion', 'settlements', 'enemyActions', 'ability', 'item',
    ...programReceiptFields, ...modifierReceiptFields, ...statusReceiptFields, ...schedulerReceiptFields,
  ].includes(key))
    || (hasStatusReceipt && baseStatusReceiptFields.some(field => !Object.prototype.hasOwnProperty.call(value, field)))
    || (hasStatusReceipt && ![1, 2, 3, 4, 5, 6, 7].includes(value.statusReceiptVersion as number))
    || (hasStatusReceipt && value.statusReceiptVersion === 1
      && (Object.prototype.hasOwnProperty.call(value, 'statusRemoveTrace')
        || Object.prototype.hasOwnProperty.call(value, 'statusConsumeTrace')
        || Object.prototype.hasOwnProperty.call(value, 'statusCategoryRemoveTrace')))
    || (hasStatusReceipt && value.statusReceiptVersion === 2
      && (!Array.isArray(value.statusRemoveTrace) || Object.prototype.hasOwnProperty.call(value, 'statusConsumeTrace')
        || Object.prototype.hasOwnProperty.call(value, 'statusCategoryRemoveTrace')))
    || (hasStatusReceipt && value.statusReceiptVersion === 3
      && (!Array.isArray(value.statusRemoveTrace) || !Array.isArray(value.statusConsumeTrace)
        || Object.prototype.hasOwnProperty.call(value, 'statusCategoryRemoveTrace')))
    || (hasStatusReceipt && value.statusReceiptVersion === 4
      && (!Array.isArray(value.statusRemoveTrace) || !Array.isArray(value.statusConsumeTrace)
        || !Array.isArray(value.statusCategoryRemoveTrace)))
    || (hasStatusReceipt && value.statusReceiptVersion === 5
      && (!Array.isArray(value.statusRemoveTrace) || !Array.isArray(value.statusConsumeTrace)
        || !Array.isArray(value.statusCategoryRemoveTrace)))
    || (hasStatusReceipt && value.statusReceiptVersion === 6
      && (!Array.isArray(value.statusRemoveTrace) || !Array.isArray(value.statusConsumeTrace)
        || !Array.isArray(value.statusCategoryRemoveTrace) || !damageProtectionMap))
    || (hasStatusReceipt && value.statusReceiptVersion === 7
      && (!gameplayMapUsesMapRunStatus(definition) || !Array.isArray(value.plannedMapRunStatuses)
        || !Array.isArray(value.statusRemoveTrace) || !Array.isArray(value.statusConsumeTrace)
        || !Array.isArray(value.statusCategoryRemoveTrace)))
    || (hasStatusReceipt && value.statusReceiptVersion !== 7 && Object.prototype.hasOwnProperty.call(value, 'plannedMapRunStatuses'))
    || (hasStatusReceipt && gameplayMapUsesMapRunStatus(definition) && value.statusReceiptVersion !== 7)
    || (hasStatusReceipt && value.statusReceiptVersion === 7 && !gameplayMapUsesMapRunStatus(definition))
    || (hasStatusReceipt && !ag1StatusReceipt && value.statusReceiptVersion !== 1)
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion === 3
      && (!gameplayMapUsesStatusConsume(definition) || gameplayMapUsesStatusRemoveCategory(definition)))
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion === 4
      && !gameplayMapUsesStatusRemoveCategory(definition))
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion === 5 && !damageReductionMap)
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion === 5 && damageProtectionMap)
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion === 6 && !damageProtectionMap)
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion === 2
      && (!gameplayMapUsesStatusRemove(definition) || gameplayMapUsesStatusConsume(definition)))
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion === 1
      && (gameplayMapUsesStatusRemove(definition) || gameplayMapUsesStatusConsume(definition)
        || gameplayMapUsesStatusRemoveCategory(definition) || damageReductionMap || damageProtectionMap))
    || (hasStatusReceipt && ag1StatusReceipt && value.statusReceiptVersion !== gameplayMapStatusReceiptVersion(definition))
    || (hasStatusReceipt && (!Array.isArray(value.plannedStatuses) || !Array.isArray(value.statusTrace)))
    || ((definition.statuses?.length ?? 0) > 0 && !hasStatusReceipt)
    || (hasTriggerVersion !== hasActionTriggerTrace)
    || (hasTriggerVersion && value.triggerReceiptVersion !== 1 && value.triggerReceiptVersion !== 2 && value.triggerReceiptVersion !== 3 && value.triggerReceiptVersion !== 4)
    || (hasTriggerVersion && value.triggerReceiptVersion === 1
      && (!Array.isArray(value.triggerTrace) || value.triggerTrace.length === 0 || hasStatusExpiryTriggerTrace))
    || (hasTriggerVersion && value.triggerReceiptVersion === 2
      && (!Array.isArray(value.triggerTrace) || !Array.isArray(value.statusExpiryTriggerTrace)
        || value.statusExpiryTriggerTrace.length === 0
        || value.triggerTrace.some((entry: unknown) => isRecord(entry) && entry.event === 'enemyDefeated')))
    || (hasTriggerVersion && value.triggerReceiptVersion === 3
      && (!Array.isArray(value.triggerTrace) || !value.triggerTrace.some((entry: unknown) => isRecord(entry) && entry.event === 'enemyDefeated')
        || !Array.isArray(value.statusExpiryTriggerTrace)))
    || (hasTriggerVersion && value.triggerReceiptVersion === 4
      && (!gameplayMapUsesStatusDamageReward(definition) || !Array.isArray(value.triggerTrace)
        || !Array.isArray(value.statusExpiryTriggerTrace) || !Array.isArray(value.statusDamageTriggerTrace)))
    || (hasTriggerVersion && value.triggerReceiptVersion !== 4 && hasStatusDamageTriggerTrace)
    || (hasTriggerVersion && value.triggerReceiptVersion !== 4 && gameplayMapUsesStatusDamageReward(definition))
    || (!hasTriggerVersion && hasStatusExpiryTriggerTrace)
    || (!hasTriggerVersion && hasStatusDamageTriggerTrace)
    || !isNonEmptyId(value.requestId)
    || !Number.isSafeInteger(value.commandVersion) || (value.commandVersion as number) < 0
    || !Number.isSafeInteger(value.resultingCommitVersion)
    || value.resultingCommitVersion !== (value.commandVersion as number) + 1
    || value.resultingCommitVersion !== commitVersion
    || !isNonEmptyId(receiptNodeId)
    || (expectedNodeId !== null && receiptNodeId !== expectedNodeId)
    || hasActivityId !== (activityId !== undefined)
    || (hasActivityId && value.activityId !== activityId)
    || !Number.isSafeInteger(value.round) || (value.round as number) < 1
    || (encounterRound !== null && value.round !== encounterRound - 1)
    || !Number.isSafeInteger(value.draftVersion) || (value.draftVersion as number) < 0
    || !Array.isArray(value.settlements) || value.settlements.length !== party.length
    || (hasEnemyActions && !Array.isArray(value.enemyActions))) return null;

  const node = definition.nodes.find(candidate => candidate.id === receiptNodeId);
  const encounterDef = resolveNodeEncounter(node, activityId);
  if (!node || !encounterDef) return null;
  const hasSchedulerReceipt = schedulerReceiptFields.some(field => Object.prototype.hasOwnProperty.call(value, field));
  if (definition.executionContractId === 'AG-1') {
    if (!hasSchedulerReceipt || value.executionContractId !== 'AG-1') return null;
    return restoreAg1EncounterCommitReceipt(value, definition, encounterDef, receiptNodeId!, party,
      commitVersion, runId, activityId, currentEncounter, currentBalances, currentShields);
  }
  if (hasSchedulerReceipt || value.executionContractId === 'AG-1') return null;
  const enemyRoster = encounterDef.enemies ?? [];
  if (hasEnemyActions !== (enemyRoster.length > 0)) return null;
  const abilitySettlement = hasAbility
    ? restoreActorlessSourceSettlement(value.ability, 'ability', encounterDef, definition, party)
    : null;
  const itemSettlement = hasItem
    ? restoreActorlessSourceSettlement(value.item, 'item', encounterDef, definition, party)
    : null;
  if ((hasAbility && !abilitySettlement) || (hasItem && !itemSettlement)) return null;
  const candidatesByCharacter = new Map<string, Set<string>>();
  const candidateMap = definition;
  for (const participant of encounterDef.participants ?? []) {
    candidatesByCharacter.set(participant.characterId,
      candidateActionIdsFor(candidateMap, participant.actions, participant.candidatePoolIds));
  }
  const restoredSettlements: MapRunEncounterActionSettlement[] = [];
  const actionById = new Map((definition.actions ?? []).map(action => [action.id, action]));
  let cardPlan: ReturnType<typeof resolveMapCardEffects>;
  let activeCardChoices: MapCardActionChoice[] = [];
  try {
    const partyCardChoices = (value.settlements as unknown[]).map(raw => {
      if (!isRecord(raw)) return raw as unknown as MapCardActionChoice;
      return {
        characterId: raw.characterId as string,
        actionId: raw.skipReason === 'noLegalTarget' ? null : raw.actionId as string | null,
        overrideKind: raw.overrideKind as MapRunActionOverride['kind'] | null,
        targetCard: raw.targetCard as MapRunCardRef | undefined,
      } satisfies MapCardActionChoice;
    });
    const enemyCardChoices = hasEnemyActions
      ? (value.enemyActions as unknown[]).map(raw => {
        if (!isRecord(raw)) return raw as unknown as MapCardActionChoice;
        return {
          enemyId: raw.enemyId as string,
          actionId: raw.skipReason === 'noLegalTarget' ? null : raw.actionId as string | null,
          overrideKind: null,
          targetCard: raw.targetCard as MapRunCardRef | undefined,
        } satisfies MapCardActionChoice;
      })
      : [];
    activeCardChoices = [ ...partyCardChoices, ...enemyCardChoices ];
    cardPlan = resolveMapCardEffects(definition, { runId, mapId: definition.id, nodeId: receiptNodeId!,
      activityId: activityId ?? null, round: value.round as number }, partyCardChoices, activeCardChoices);
  } catch { return null; }
  let playerCostSpentTotal = abilitySettlement ? 1 : 0;
  // Each Character may spend at most one PlayerCost per round; Ability spends one more.
  const maxPlayerCostSpent = party.length + (abilitySettlement ? 1 : 0);
  for (const [index, rawSettlement] of value.settlements.entries()) {
    const member = party[index];
    if (!member || !isRecord(rawSettlement)) return null;
    const settlementKeys = Object.keys(rawSettlement);
    const hasEnemyTarget = Object.prototype.hasOwnProperty.call(rawSettlement, 'targetEnemyId');
    const hasHpChanges = Object.prototype.hasOwnProperty.call(rawSettlement, 'hpChanges');
    const hasCardTarget = Object.prototype.hasOwnProperty.call(rawSettlement, 'targetCard');
    const hasScostCost = Object.prototype.hasOwnProperty.call(rawSettlement, 'scostCost');
    const hasSkipReason = Object.prototype.hasOwnProperty.call(rawSettlement, 'skipReason');
    const allowedSettlementKeys = [
      'characterId', 'actionId', 'targetCharacterId', 'targetEnemyId', 'overrideKind', 'playerCostSpent',
      'resourceChanges', 'hpChanges', 'targetCard', 'scostCost', 'skipReason',
    ];
    if (settlementKeys.some(key => !allowedSettlementKeys.includes(key))
      || settlementKeys.length !== 6 + Number(hasEnemyTarget) + Number(hasHpChanges) + Number(hasCardTarget)
        + Number(hasScostCost) + Number(hasSkipReason)
      || rawSettlement.characterId !== member.characterId
      || !(rawSettlement.actionId === null || isNonEmptyId(rawSettlement.actionId))
      || !(rawSettlement.targetCharacterId === null || isNonEmptyId(rawSettlement.targetCharacterId))
      || (hasEnemyTarget && !isNonEmptyId(rawSettlement.targetEnemyId))
      || (hasSkipReason && rawSettlement.skipReason !== 'noLegalTarget')
      || !(rawSettlement.overrideKind === null || rawSettlement.overrideKind === 'swap' || rawSettlement.overrideKind === 'playerCommand')
      || !Number.isSafeInteger(rawSettlement.playerCostSpent)
      || (rawSettlement.playerCostSpent !== 0 && rawSettlement.playerCostSpent !== 1)
      || !Array.isArray(rawSettlement.resourceChanges)) return null;

    const actionId = rawSettlement.actionId as string | null;
    const targetCharacterId = rawSettlement.targetCharacterId as string | null;
    const targetEnemyId = hasEnemyTarget ? rawSettlement.targetEnemyId as string : null;
    const overrideKind = rawSettlement.overrideKind as MapRunActionOverride['kind'] | null;
    playerCostSpentTotal += rawSettlement.playerCostSpent as number;
    if (playerCostSpentTotal > maxPlayerCostSpent) return null;
    if (actionId === null) {
      if (targetCharacterId !== null || targetEnemyId !== null || hasHpChanges || hasCardTarget || hasScostCost || hasSkipReason
        || overrideKind !== null || rawSettlement.playerCostSpent !== 0
        || rawSettlement.resourceChanges.length !== 0) return null;
      restoredSettlements.push({
        characterId: member.characterId, actionId: null, targetCharacterId: null,
        overrideKind: null, playerCostSpent: 0, resourceChanges: [],
      });
      continue;
    }
    const action = actionById.get(actionId);
    if (!action || !action.eligibleCharacterIds.includes(member.characterId)
      || !candidatesByCharacter.get(member.characterId)?.has(actionId)
      || (rawSettlement.playerCostSpent === 1) !== (overrideKind === 'playerCommand')
      || (overrideKind === 'swap' && rawSettlement.playerCostSpent !== 0)) return null;
    if (hasSkipReason) {
      if ((action.target.kind !== 'enemy' && action.target.kind !== 'partyCharacter' && action.target.kind !== 'card')
        || targetCharacterId !== null || targetEnemyId !== null
        || hasHpChanges || hasCardTarget || hasScostCost || rawSettlement.resourceChanges.length !== 0) return null;
      restoredSettlements.push({
        characterId: member.characterId,
        actionId,
        targetCharacterId: null,
        skipReason: 'noLegalTarget',
        overrideKind,
        playerCostSpent: rawSettlement.playerCostSpent as 0 | 1,
        resourceChanges: [],
      });
      continue;
    }
    if (hasCardTarget !== cardPlan.targets.has(member.characterId)
      || (action.target.kind === 'card' && (targetCharacterId !== null || targetEnemyId !== null || !hasCardTarget))) return null;
    if ((action.target.kind === 'none' && (targetCharacterId !== null || targetEnemyId !== null))
      || (action.target.kind === 'self' && (targetCharacterId !== member.characterId || targetEnemyId !== null))
      || (action.target.kind === 'partyCharacter'
        && (!targetCharacterId || targetEnemyId !== null || !party.some(candidate => candidate.characterId === targetCharacterId)))
      || (action.target.kind === 'enemy'
        && (targetCharacterId !== null || !targetEnemyId || !(encounterDef.enemies ?? []).some(enemy => enemy.id === targetEnemyId)))) return null;

    let expectedChanges: MapRunEncounterSettlementResourceChange[];
    let expectedScost: ReturnType<typeof mapScostCost>;
    try {
      const reduction = cardPlan.reductions.get(mapCardActorKey('partyCharacter', member.characterId)) ?? 0n;
      expectedChanges = settlementChangesFor(action, { kind: 'partyCharacter', id: member.characterId },
        settlementUnitTarget(targetCharacterId, targetEnemyId), reduction,
        { programCostProbe: true });
      expectedScost = mapScostCost(action, reduction);
    } catch {
      return null;
    }
    const projectedChanges = rawSettlement.resourceChanges
      .filter((change): change is Record<string, unknown> => isRecord(change) && change.kind === 'cost');
    if (hasScostCost !== (expectedScost !== null)) return null;
    if (expectedScost && (!isRecord(rawSettlement.scostCost) || Object.keys(rawSettlement.scostCost).length !== 3
      || Object.keys(expectedScost).some(key => (rawSettlement.scostCost as Record<string, unknown>)[key]
        !== expectedScost![key as keyof typeof expectedScost]))) return null;
    if (expectedChanges.length !== projectedChanges.length) return null;
    for (const [changeIndex, rawChange] of projectedChanges.entries()) {
      const expected = expectedChanges[changeIndex];
      if (!expected || !isRecord(rawChange)) return null;
      const expectedKeys = [
        'kind', 'scope',
        ...(expected.characterId === undefined ? [] : ['characterId']),
        ...(expected.enemyId === undefined ? [] : ['enemyId']),
        ...(expected.teamSide === undefined ? [] : ['teamSide']),
        'resourceId', 'delta',
      ];
      const changeKeys = Object.keys(rawChange);
      if (changeKeys.length !== expectedKeys.length || changeKeys.some(key => !expectedKeys.includes(key))
        || rawChange.kind !== expected.kind || rawChange.scope !== expected.scope
        || rawChange.characterId !== expected.characterId || rawChange.enemyId !== expected.enemyId
        || rawChange.teamSide !== expected.teamSide || rawChange.resourceId !== expected.resourceId
        || rawChange.delta !== expected.delta) return null;
    }
    let restoredHpChanges: MapRunEncounterHpChange[] | undefined;
    if (hasHpChanges) {
      const expectedIdentity = targetEnemyId !== null ? { kind: 'enemy' as const, id: targetEnemyId }
        : targetCharacterId !== null ? { kind: 'partyCharacter' as const, id: targetCharacterId } : null;
      restoredHpChanges = restoreHpChangeEntries(rawSettlement.hpChanges, action, expectedIdentity,
        new Set(party.map(candidate => candidate.characterId)), new Set(enemyRoster.map(candidate => candidate.id))) ?? undefined;
      if (!restoredHpChanges) return null;
    }
    const restoredResourceChanges = rawSettlement.resourceChanges.filter(isRecord)
      .map(change => ({ ...change }) as unknown as MapRunEncounterSettlementResourceChange);    restoredSettlements.push({
      characterId: member.characterId,
      actionId,
      targetCharacterId,
      ...(targetEnemyId === null ? {} : { targetEnemyId }),
      ...(cardPlan.targets.has(mapCardActorKey('partyCharacter', member.characterId))
        ? { targetCard: cardPlan.targets.get(mapCardActorKey('partyCharacter', member.characterId))! } : {}),
      ...(expectedScost ? { scostCost: expectedScost } : {}),
      overrideKind,
      playerCostSpent: rawSettlement.playerCostSpent as 0 | 1,
      resourceChanges: restoredResourceChanges,
      ...(restoredHpChanges ? { hpChanges: restoredHpChanges } : {}),
    });
  }

  const restoredEnemyActions: MapRunEncounterEnemyActionSettlement[] = [];
  if (hasEnemyActions) {
    const rawRows = value.enemyActions as unknown[];
    if (rawRows.length !== enemyRoster.length) return null;
    const enemyOrder = new Map(enemyRoster.map((enemy, index) => [enemy.id, index]));
    const candidateActionIdsByEnemy = new Map(enemyRoster.map(enemy => [enemy.id,
      candidateActionIdsFor(candidateMap, enemy.actions, enemy.candidatePoolIds)]));
    for (const [index, rawSettlement] of rawRows.entries()) {
      const enemy = enemyRoster[index];
      if (!enemy || !isRecord(rawSettlement) || rawSettlement.enemyId !== enemy.id
        || !(rawSettlement.actionId === null || isNonEmptyId(rawSettlement.actionId))
        || !Array.isArray(rawSettlement.resourceChanges)) return null;
      const hasTargetCharacter = Object.prototype.hasOwnProperty.call(rawSettlement, 'targetCharacterId');
      const hasTargetEnemy = Object.prototype.hasOwnProperty.call(rawSettlement, 'targetEnemyId');
      const hasTargetCard = Object.prototype.hasOwnProperty.call(rawSettlement, 'targetCard');
      const hasSkipReason = Object.prototype.hasOwnProperty.call(rawSettlement, 'skipReason');
      const hasScost = Object.prototype.hasOwnProperty.call(rawSettlement, 'scostCost');
      const hasHpChanges = Object.prototype.hasOwnProperty.call(rawSettlement, 'hpChanges');
      const actionId = rawSettlement.actionId as string | null;
      if (actionId === null) {
        if (Object.keys(rawSettlement).length !== 3 || hasTargetCharacter || hasTargetEnemy || hasTargetCard
          || hasSkipReason || hasScost || hasHpChanges || rawSettlement.resourceChanges.length > 0) return null;
        restoredEnemyActions.push({ enemyId: enemy.id, actionId: null, resourceChanges: [] });
        continue;
      }
      const action = actionById.get(actionId);
      if (!action || !candidateActionIdsByEnemy.get(enemy.id)?.has(actionId)) return null;
      const allowedKeys = [
        'enemyId', 'actionId', 'targetCharacterId', 'targetEnemyId', 'targetCard', 'scostCost',
        'skipReason', 'resourceChanges', 'hpChanges',
      ];
      if (Object.keys(rawSettlement).some(key => !allowedKeys.includes(key))) return null;
      const skipReason = hasSkipReason ? rawSettlement.skipReason : undefined;
      if (hasSkipReason) {
        if (!['defeated', 'noLegalTarget', 'unaffordable', 'roundEnded'].includes(String(skipReason))
          || Object.keys(rawSettlement).length !== 4 || hasTargetCharacter || hasTargetEnemy || hasTargetCard
          || hasScost || hasHpChanges || rawSettlement.resourceChanges.length !== 0
          || (skipReason === 'noLegalTarget' && !['partyCharacter', 'enemy', 'card'].includes(action.target.kind))) return null;
        restoredEnemyActions.push({ enemyId: enemy.id, actionId, skipReason: skipReason as 'defeated' | 'noLegalTarget' | 'unaffordable' | 'roundEnded', resourceChanges: [] });
        continue;
      }

      const targetCharacterId = hasTargetCharacter && isNonEmptyId(rawSettlement.targetCharacterId)
        ? rawSettlement.targetCharacterId : null;
      const targetEnemyId = hasTargetEnemy && isNonEmptyId(rawSettlement.targetEnemyId)
        ? rawSettlement.targetEnemyId : null;
      if ((hasTargetCharacter && targetCharacterId === null) || (hasTargetEnemy && targetEnemyId === null)) return null;
      let targetCard: MapRunCardRef | null = null;
      if (hasTargetCard) {
        targetCard = parseMapRunCardRef(rawSettlement.targetCard);
        if (!targetCard || targetCard.scope.runId !== runId || targetCard.scope.mapId !== definition.id
          || targetCard.scope.nodeId !== receiptNodeId || targetCard.scope.activityId !== (activityId ?? null)
          || targetCard.scope.round !== value.round) return null;
      }
      const targetMatches = action.target.kind === 'none'
        ? targetCharacterId === null && targetEnemyId === null && targetCard === null
        : action.target.kind === 'self'
          ? targetCharacterId === null && targetEnemyId === enemy.id && targetCard === null
          : action.target.kind === 'partyCharacter'
            ? targetCharacterId !== null && targetEnemyId === null && targetCard === null
              && party.some(member => member.characterId === targetCharacterId)
            : action.target.kind === 'enemy'
              ? targetCharacterId === null && targetEnemyId !== null && enemyOrder.has(targetEnemyId) && targetCard === null
              : targetCharacterId === null && targetEnemyId === null && targetCard !== null;
      if (!targetMatches) return null;

      const enemyActorKey = mapCardActorKey('enemy', enemy.id);
      let reduction = cardPlan.reductions.get(enemyActorKey) ?? 0n;
      for (const prior of restoredEnemyActions) {
        if (prior.actionId === null || prior.skipReason !== undefined) continue;
        const priorIndex = enemyOrder.get(prior.enemyId);
        if (priorIndex === undefined || priorIndex >= index) continue;
        const priorAction = actionById.get(prior.actionId);
        if (priorAction?.target.kind !== 'card' || !prior.targetCard) continue;
        try {
          const priorPlan = resolveMapCardEffects(definition, {
            runId, mapId: definition.id, nodeId: receiptNodeId!,
            activityId: activityId ?? null, round: value.round as number,
          }, [{ enemyId: prior.enemyId, actionId: prior.actionId, overrideKind: null, targetCard: prior.targetCard }], activeCardChoices);
          reduction += priorPlan.reductions.get(enemyActorKey) ?? 0n;
        } catch { return null; }
      }
      if (action.target.kind === 'card') {
        try {
          resolveMapCardEffects(definition, {
            runId, mapId: definition.id, nodeId: receiptNodeId!,
            activityId: activityId ?? null, round: value.round as number,
          }, [{ enemyId: enemy.id, actionId, overrideKind: null, targetCard: targetCard! }], activeCardChoices);
        } catch { return null; }
      }

      let expectedChanges: MapRunEncounterSettlementResourceChange[];
      let expectedScost: ReturnType<typeof mapScostCost>;
      try {
        expectedChanges = settlementChangesFor(action, { kind: 'enemy', id: enemy.id },
          settlementUnitTarget(targetCharacterId, targetEnemyId), reduction,
          { programCostProbe: true });
        expectedScost = mapScostCost(action, reduction);
      } catch { return null; }
      const projectedChanges = rawSettlement.resourceChanges
        .filter((change): change is Record<string, unknown> => isRecord(change) && change.kind === 'cost');
      if (hasScost !== (expectedScost !== null)) return null;
      if (expectedScost && (!isRecord(rawSettlement.scostCost) || Object.keys(rawSettlement.scostCost).length !== 3
        || Object.keys(expectedScost).some(key => (rawSettlement.scostCost as Record<string, unknown>)[key]
          !== expectedScost![key as keyof typeof expectedScost]))) return null;
      if (expectedChanges.length !== projectedChanges.length) return null;
      for (const [changeIndex, rawChange] of projectedChanges.entries()) {
        const expected = expectedChanges[changeIndex];
        if (!expected || !isRecord(rawChange)) return null;
        const expectedKeys = [
          'kind', 'scope',
          ...(expected.characterId === undefined ? [] : ['characterId']),
          ...(expected.enemyId === undefined ? [] : ['enemyId']),
          ...(expected.teamSide === undefined ? [] : ['teamSide']),
          'resourceId', 'delta',
        ];
        if (Object.keys(rawChange).length !== expectedKeys.length
          || Object.keys(rawChange).some(key => !expectedKeys.includes(key))
          || rawChange.kind !== expected.kind || rawChange.scope !== expected.scope
          || rawChange.characterId !== expected.characterId || rawChange.enemyId !== expected.enemyId
          || rawChange.teamSide !== expected.teamSide || rawChange.resourceId !== expected.resourceId
          || rawChange.delta !== expected.delta) return null;
      }
      let hpChanges: MapRunEncounterHpChange[] | undefined;
      if (hasHpChanges) {
        const expectedIdentity = targetEnemyId !== null ? { kind: 'enemy' as const, id: targetEnemyId }
          : targetCharacterId !== null ? { kind: 'partyCharacter' as const, id: targetCharacterId } : null;
        hpChanges = restoreHpChangeEntries(rawSettlement.hpChanges, action, expectedIdentity,
          new Set(party.map(candidate => candidate.characterId)), new Set(enemyRoster.map(candidate => candidate.id))) ?? undefined;
        if (!hpChanges) return null;
      }
      const restoredResourceChanges = rawSettlement.resourceChanges.filter(isRecord)
        .map(change => ({ ...change }) as unknown as MapRunEncounterSettlementResourceChange);      restoredEnemyActions.push({
        enemyId: enemy.id, actionId,
        ...(targetCharacterId === null ? {} : { targetCharacterId }),
        ...(targetEnemyId === null ? {} : { targetEnemyId }),
        ...(targetCard === null ? {} : { targetCard }),
        ...(expectedScost ? { scostCost: expectedScost } : {}),
        resourceChanges: restoredResourceChanges,
        ...(hpChanges ? { hpChanges } : {}),
      });
    }
  }

  const hasProgramReceipt = programReceiptFields.some(field => Object.prototype.hasOwnProperty.call(value, field));
    if (hasProgramReceipt && value.executionContractId !== 'AG-1') {
    const validation = validateMapEffectCommitReceipt(value, {
      runId,
      map: definition,
      encounter: encounterDef,
      ...(currentEncounter === undefined ? {} : { currentEncounter }),
      ...(currentBalances === undefined ? {} : { currentBalances }),
    });
    if (!validation.ok) return null;
  }

  let receiptMapRunStatuses: readonly MapRunStatusInstance[] | undefined;
  if (hasStatusReceipt) {
    const receiptStatuses = validateMapEncounterStatusInstances(value.plannedStatuses, {
      map: definition,
      encounter: encounterDef,
      currentRound: (value.round as number) + 1,
    });
    if (!receiptStatuses) return null;
    const receiptHp: Record<string, { current: number; cap: number }> = {};
    if (currentEncounter) {
      for (const row of currentEncounter.partyHp ?? []) {
        const cap = definition.initialPartyHp.find(hp => hp.characterId === row.characterId)?.maxHp;
        if (cap !== undefined) receiptHp[`partyCharacter:${row.characterId}`] = { current: row.currentHp, cap };
      }
      for (const row of currentEncounter.enemies ?? []) {
        const cap = (encounterDef.enemies ?? []).find(enemy => enemy.id === row.enemyId)?.maxHp;
        if (cap !== undefined) receiptHp[`enemy:${row.enemyId}`] = { current: row.currentHp, cap };
      }
    } else if (Array.isArray(value.statusTrace)) {
      for (const entry of value.statusTrace) {
        if (!isRecord(entry) || !isRecord(entry.holder)) continue;
        const holder = entry.holder;
        if ((holder.kind !== 'partyCharacter' && holder.kind !== 'enemy')
          || typeof holder.id !== 'string' || !Number.isSafeInteger(entry.hpAfter)) continue;
        const cap = holder.kind === 'partyCharacter'
          ? definition.initialPartyHp.find(hp => hp.characterId === holder.id)?.maxHp
          : (encounterDef.enemies ?? []).find(enemy => enemy.id === holder.id)?.maxHp;
        if (cap !== undefined) receiptHp[`${holder.kind}:${holder.id}`] = { current: entry.hpAfter as number, cap };
      }
    }
    const receiptTrace = value.statusTrace as unknown[];
    if (value.statusReceiptVersion === 7) {
      receiptMapRunStatuses = validateMapRunStatusInstances(value.plannedMapRunStatuses, {
        map: definition,
        partyCharacterIds: party.map(member => member.characterId),
        currentCommitVersion: value.resultingCommitVersion as number,
      }) ?? undefined;
      if (!receiptMapRunStatuses) return null;
    } else {
      const tickSkipped = !currentEncounter && receiptStatuses.length === 0 && receiptTrace.length === 0;
      const statusPlan = validateMapEncounterStatusTrace({
        statusReceiptVersion: value.statusReceiptVersion,
        statusTrace: receiptTrace,
        round: value.round as number,
        definitions: definition.statuses ?? [],
        plannedStatuses: receiptStatuses,
        receiptHp,
        partyOrder: party.map(member => member.characterId),
        enemyOrder: (encounterDef.enemies ?? []).map(enemy => enemy.id),
        tickSkipped,
      });
      if (!statusPlan) return null;
    }
    if (currentEncounter?.statuses !== undefined && JSON.stringify(currentEncounter.statuses) !== JSON.stringify(receiptStatuses)) return null;
  }

  let programReceipt: Pick<MapRunEncounterCommitReceipt,
    'programReceiptVersion' | 'executionContractId' | 'effectScope' | 'programVisitCount' | 'programVisits' | 'plannedLocals' | 'effectTrace'> = {};
  if (hasProgramReceipt) {
    try {
      programReceipt = {
        programReceiptVersion: value.programReceiptVersion as 1 | 2,
        executionContractId: value.executionContractId as 'E1-COMPAT-1',
        effectScope: Object.freeze({ ...(value.effectScope as MapRunEncounterProgramScope) }),
        programVisitCount: value.programVisitCount as number,
        programVisits: Object.freeze((value.programVisits as MapRunEncounterProgramVisit[]).map(visit => Object.freeze({
          ...visit,
          source: freezeProgramSource(visit.source),
        }))),
        plannedLocals: copyMapEncounterLocalsState(value.plannedLocals, encounterDef.locals),
        effectTrace: Object.freeze((value.effectTrace as MapEffectTraceEntry[]).map(freezeProgramTraceEntry)),
      };
    } catch {
      return null;
    }
  }

  let statusReceipt: Pick<MapRunEncounterCommitReceipt,
    'statusReceiptVersion' | 'plannedStatuses' | 'statusTrace' | 'plannedMapRunStatuses'> = {};
  if (hasStatusReceipt) {
    try {
      statusReceipt = {
        statusReceiptVersion: value.statusReceiptVersion as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        plannedStatuses: validateMapEncounterStatusInstances(value.plannedStatuses, {
          map: definition,
          encounter: encounterDef,
          currentRound: (value.round as number) + 1,
        }) ?? (() => { throw new Error('invalid receipt planned Statuses'); })(),
        statusTrace: Object.freeze((value.statusTrace as MapEffectStatusTickTraceEntry[]).map(entry => Object.freeze({
          ...entry,
          holder: Object.freeze({ ...entry.holder }),
          source: freezeProgramSource(entry.source),
          statusBefore: Object.freeze({ ...entry.statusBefore,
            holder: Object.freeze({ ...entry.statusBefore.holder }), source: freezeProgramSource(entry.statusBefore.source) }),
          statusAfter: entry.statusAfter === null ? null : Object.freeze({ ...entry.statusAfter,
            holder: Object.freeze({ ...entry.statusAfter.holder }), source: freezeProgramSource(entry.statusAfter.source) }),
        }) as MapEffectStatusTickTraceEntry)),
        ...(receiptMapRunStatuses === undefined ? {} : { plannedMapRunStatuses: copyMapRunStatusInstances(receiptMapRunStatuses) }),
      };
    } catch {
      return null;
    }
  }

  return {
    requestId: value.requestId,
    commandVersion: value.commandVersion as number,
    resultingCommitVersion: value.resultingCommitVersion as number,
    nodeId: receiptNodeId!,
    ...(activityId === undefined ? {} : { activityId }),
    round: value.round as number,
    draftVersion: value.draftVersion as number,
    settlements: restoredSettlements,
    ...(hasEnemyActions ? { enemyActions: restoredEnemyActions } : {}),
    ...(abilitySettlement ? { ability: abilitySettlement } : {}),
    ...(itemSettlement ? { item: itemSettlement } : {}),
    ...programReceipt,
    ...statusReceipt,
  };
}

function restoreEncounterSnapshot(
  value: unknown,
  definition: ResolvedMap,
  expectedNodeId: string,
  party: readonly MapRunPartyMember[],
  partyHp: readonly MapRunPartyHp[],
  actorResources: readonly MapRunActorResourceBalance[],
  teamResources: readonly MapRunTeamResourceBalance[],
  playerCost: number,
  commitVersion: number,
  runId: string,
  activityId?: string,
  rootMapRunFacts?: MapRunFactState,
): MapRunEncounterSnapshot | null {
  if (!isRecord(value)) return null;
  const candidateSourceSnapshot = restoreCandidateSourceSnapshot(value.candidateSourceSnapshot, value, definition);
  if (candidateSourceSnapshot === null
    || (value.round === 1 && candidateSourceSnapshot !== undefined
      && !sameReceiptValue(candidateSourceSnapshot.mapRunFacts, rootMapRunFacts))) return null;
  const hasOverrides = Object.prototype.hasOwnProperty.call(value, 'overrides');
  const hasLegacyOverride = Object.prototype.hasOwnProperty.call(value, 'override');
  const hasTargetSelections = Object.prototype.hasOwnProperty.call(value, 'targetSelections');
  const hasDraftVersion = Object.prototype.hasOwnProperty.call(value, 'draftVersion');
  const abilityDraftSnapshot: unknown = Object.prototype.hasOwnProperty.call(value, 'abilityDraft') ? value.abilityDraft : null;
  const itemDraftSnapshot: unknown = Object.prototype.hasOwnProperty.call(value, 'itemDraft') ? value.itemDraft : null;
  const statusSnapshot: unknown = Object.prototype.hasOwnProperty.call(value, 'statuses') ? value.statuses : undefined;
  const hasStatuses = Object.prototype.hasOwnProperty.call(value, 'statuses');
  const shieldMap = gameplayMapUsesShieldAdd(definition);
  const hasShields = Object.prototype.hasOwnProperty.call(value, 'shields');
  const hasEffectRandomState = Object.prototype.hasOwnProperty.call(value, 'effectRandomState');
  let effectRandomState: MapEffectRandomState | undefined;
  if (definition.executionContractId === 'AG-1') {
    try { effectRandomState = copyMapEffectRandomState(value.effectRandomState); }
    catch { return null; }
  } else if (hasEffectRandomState) return null;
  const isLegacyDraftSnapshot = !hasOverrides && !hasLegacyOverride && !hasTargetSelections && !hasDraftVersion;
  // Snapshots written before multiple overrides used one nullable `override`; migrate it into the list form.
  const overridesSnapshot: unknown = isLegacyDraftSnapshot
    ? []
    : hasOverrides
      ? value.overrides
      : hasLegacyOverride
        ? (value.override === null || value.override === undefined ? [] : [value.override])
        : [];
  const targetSelectionsSnapshot: unknown = isLegacyDraftSnapshot ? [] : value.targetSelections;
  const draftVersionSnapshot: unknown = isLegacyDraftSnapshot ? 0 : value.draftVersion;
  const lastCommitSnapshot: unknown = Object.prototype.hasOwnProperty.call(value, 'lastCommit') ? value.lastCommit : null;

  if (value.nodeId !== expectedNodeId
    || (value.activityId ?? null) !== (activityId ?? null)
    || (activityId !== undefined && !isNonEmptyId(value.activityId))
    || !Number.isSafeInteger(value.round) || (value.round as number) < 1
    || !Number.isSafeInteger(draftVersionSnapshot) || (draftVersionSnapshot as number) < 0
    || !Number.isSafeInteger(value.drawCursorStart) || (value.drawCursorStart as number) < 0
    || !isRecord(value.randomState)
    || value.randomState.algorithm !== GAMEPLAY_B_HAND_RNG_ALGORITHM
    || !Number.isSafeInteger(value.randomState.seed)
    || !Number.isSafeInteger(value.randomState.cursor) || (value.randomState.cursor as number) < 0
    || (value.drawCursorStart as number) > (value.randomState.cursor as number)
    || (value.round === 1 && value.drawCursorStart !== 0)
    || !Array.isArray(overridesSnapshot)
    || !(lastCommitSnapshot === null || isRecord(lastCommitSnapshot))
    || !Array.isArray(targetSelectionsSnapshot)
    || !Array.isArray(value.hands)
    || value.hands.length !== party.length
    || !Array.isArray(value.enemyHands)
    || !Array.isArray(value.enemyActorResources)
    || !Array.isArray(value.enemyTeamResources)
    || !Array.isArray(value.enemies)
    || (hasStatuses && !Array.isArray(statusSnapshot))
    || (shieldMap !== hasShields)
    || (!hasStatuses && (definition.statuses?.length ?? 0) > 0)) return null;

  const savedHands: { characterId: string; actionIds: string[] }[] = [];
  for (const [index, row] of value.hands.entries()) {
    const partyMember = party[index];
    if (!partyMember || !isRecord(row)
      || row.characterId !== partyMember.characterId
      || !isUniqueIdArray(row.actionIds)
      || row.actionIds.length > 3) return null;
    savedHands.push({ characterId: partyMember.characterId, actionIds: [...row.actionIds] });
  }

  const targetSelections: MapRunEncounterTargetSelection[] = [];
  const selectedCharacters = new Set<string>();
  let previousPartyIndex = -1;
  for (const rawSelection of targetSelectionsSnapshot) {
    if (!isRecord(rawSelection)) return null;
    const keys = Object.keys(rawSelection);
    const partyIndex = party.findIndex(member => member.characterId === rawSelection.characterId);
    const partyTarget = keys.length >= 2 && keys.length <= 4
      && keys.every(key => ['characterId', 'targetCharacterId', 'additionalTargetCharacterId', 'additionalTargetEnemyId'].includes(key))
      && isNonEmptyId(rawSelection.targetCharacterId);
    const enemyTarget = keys.length >= 2 && keys.length <= 4
      && keys.every(key => ['characterId', 'targetEnemyId', 'additionalTargetCharacterId', 'additionalTargetEnemyId'].includes(key))
      && isNonEmptyId(rawSelection.targetEnemyId);
    const hasAdditionalCharacter = rawSelection.additionalTargetCharacterId !== undefined;
    const hasAdditionalEnemy = rawSelection.additionalTargetEnemyId !== undefined;
    const hasPartyPrimary = rawSelection.targetCharacterId !== undefined;
    const hasEnemyPrimary = rawSelection.targetEnemyId !== undefined;
    const targetCard = keys.length === 2 && keys.every(key => ['characterId', 'targetCard'].includes(key))
      ? parseMapRunCardRef(rawSelection.targetCard) : null;
    if ((!partyTarget && !enemyTarget && !targetCard)
      || (!targetCard && hasPartyPrimary === hasEnemyPrimary)
      || (partyTarget && enemyTarget)
      || !isNonEmptyId(rawSelection.characterId) || partyIndex < 0
      || partyIndex <= previousPartyIndex || selectedCharacters.has(rawSelection.characterId)) return null;
    previousPartyIndex = partyIndex;
    selectedCharacters.add(rawSelection.characterId);
    if ((hasAdditionalCharacter && !isNonEmptyId(rawSelection.additionalTargetCharacterId))
      || (hasAdditionalEnemy && !isNonEmptyId(rawSelection.additionalTargetEnemyId))
      || (hasAdditionalCharacter && hasAdditionalEnemy)) return null;
    targetSelections.push(targetCard ? { characterId: rawSelection.characterId, targetCard } : partyTarget
      ? { characterId: rawSelection.characterId, targetCharacterId: rawSelection.targetCharacterId as string,
        ...(hasAdditionalCharacter ? { additionalTargetCharacterId: rawSelection.additionalTargetCharacterId as string }
          : hasAdditionalEnemy ? { additionalTargetEnemyId: rawSelection.additionalTargetEnemyId as string } : {}) }
      : { characterId: rawSelection.characterId, targetEnemyId: rawSelection.targetEnemyId as string,
        ...(hasAdditionalCharacter ? { additionalTargetCharacterId: rawSelection.additionalTargetCharacterId as string }
          : hasAdditionalEnemy ? { additionalTargetEnemyId: rawSelection.additionalTargetEnemyId as string } : {}) });
  }

  const node = definition.nodes.find(candidate => candidate.id === expectedNodeId);
  const encounterDef = resolveNodeEncounter(node, activityId);
  if (!node || !encounterDef) return null;
  const hasLocals = Object.prototype.hasOwnProperty.call(value, 'locals');
  let locals: MapRunEncounterSnapshot['locals'];
  if (hasLocals) {
    try {
      const restoredLocals = copyMapEncounterLocalsState(value.locals, encounterDef.locals);
      if (encounterDef.locals === undefined
        && (Object.keys(restoredLocals.counters).length > 0 || Object.keys(restoredLocals.flags).length > 0)) return null;
      locals = restoredLocals;
    } catch {
      return null;
    }
  } else if (encounterDef.locals !== undefined) {
    return null;
  }
  const expectedEnemyDefinitions = encounterDef.enemies ?? [];
  const shields = shieldMap
    ? restoreShieldLedger(value.shields, party.map(member => member.characterId), expectedEnemyDefinitions.map(enemy => enemy.id))
    : undefined;
  if (shieldMap && shields === null) return null;
  const enemyAgility = restoreAgilitySnapshot(
    Object.prototype.hasOwnProperty.call(value, 'enemyAgility') ? value.enemyAgility : undefined,
    initialEnemyAgility(definition, encounterDef),
    'enemyId',
  );
  if (enemyAgility === null) return null;
  if (value.enemies.length !== expectedEnemyDefinitions.length) return null;
  const enemies: MapRunEnemyHp[] = [];
  for (const [index, rawEnemy] of value.enemies.entries()) {
    const expectedEnemy = expectedEnemyDefinitions[index];
    if (!expectedEnemy || !isRecord(rawEnemy) || Object.keys(rawEnemy).length !== 2
      || Object.keys(rawEnemy).some(key => !['enemyId', 'currentHp'].includes(key))
      || rawEnemy.enemyId !== expectedEnemy.id
      || !Number.isSafeInteger(rawEnemy.currentHp) || (rawEnemy.currentHp as number) < 0
      || (rawEnemy.currentHp as number) > expectedEnemy.maxHp) return null;
    enemies.push({ enemyId: expectedEnemy.id, currentHp: rawEnemy.currentHp as number });
  }
  if (expectedEnemyDefinitions.length > 0 && enemies.every(enemy => enemy.currentHp === 0)) return null;

  let statuses: readonly MapEncounterStatusInstance[] | undefined;
  if (hasStatuses || (definition.statuses?.length ?? 0) > 0) {
    statuses = validateMapEncounterStatusInstances(statusSnapshot ?? [], {
      map: definition,
      encounter: encounterDef,
      currentRound: value.round as number,
      candidateSourceSnapshot,
    }) ?? undefined;
    if (statuses === undefined) return null;
  }

  if (value.enemyHands.length !== expectedEnemyDefinitions.length) return null;
  const enemyHands: MapRunEnemyHand[] = [];
  for (const [index, row] of value.enemyHands.entries()) {
    const expectedEnemy = expectedEnemyDefinitions[index];
    if (!expectedEnemy || !isRecord(row) || Object.keys(row).length !== 2
      || Object.keys(row).some(key => !['enemyId', 'actionIds'].includes(key))
      || row.enemyId !== expectedEnemy.id || !isUniqueIdArray(row.actionIds) || row.actionIds.length > 3) return null;
    enemyHands.push({ enemyId: expectedEnemy.id, actionIds: [...row.actionIds] });
  }

  const expectedEnemyIds = new Set(expectedEnemyDefinitions.map(enemy => enemy.id));
  const enemyActorResources: MapRunEnemyActorResourceBalance[] = [];
  const enemyActorResourceKeys = new Set<string>();
  for (const row of value.enemyActorResources) {
    if (!isRecord(row) || Object.keys(row).length !== 3
      || Object.keys(row).some(key => !['enemyId', 'resourceId', 'value'].includes(key))
      || !isNonEmptyId(row.enemyId) || !expectedEnemyIds.has(row.enemyId)
      || !isNonEmptyId(row.resourceId) || !Number.isSafeInteger(row.value) || (row.value as number) < 0) return null;
    const key = JSON.stringify([row.enemyId, row.resourceId]);
    if (enemyActorResourceKeys.has(key)) return null;
    enemyActorResourceKeys.add(key);
    enemyActorResources.push({ enemyId: row.enemyId, resourceId: row.resourceId, value: row.value as number });
  }
  for (const enemy of expectedEnemyDefinitions) {
    for (const resource of enemy.initialResources ?? []) {
      if (!enemyActorResourceKeys.has(JSON.stringify([enemy.id, resource.resourceId]))) return null;
    }
  }

  const enemyTeamResources: MapRunTeamResourceBalance[] = [];
  const enemyTeamResourceIds = new Set<string>();
  for (const row of value.enemyTeamResources) {
    if (!isRecord(row) || Object.keys(row).length !== 2
      || Object.keys(row).some(key => !['resourceId', 'value'].includes(key))
      || !isNonEmptyId(row.resourceId) || !Number.isSafeInteger(row.value) || (row.value as number) < 0
      || enemyTeamResourceIds.has(row.resourceId)) return null;
    enemyTeamResourceIds.add(row.resourceId);
    enemyTeamResources.push({ resourceId: row.resourceId, value: row.value as number });
  }
  for (const resource of encounterDef.initialEnemyTeamResources ?? []) {
    if (!enemyTeamResourceIds.has(resource.resourceId)) return null;
  }

  const actionById = new Map((definition.actions ?? []).map(action => [action.id, action]));
  const abilityActionIds = encounterDef.abilityActionIds ?? [];
  let abilityDraft: MapRunEncounterAbilityDraft | null = null;
  if (abilityDraftSnapshot !== null) {
    if (!isRecord(abilityDraftSnapshot)
      || Object.keys(abilityDraftSnapshot).length !== 3
      || Object.keys(abilityDraftSnapshot).some(key => !['actionId', 'target', 'additionalTarget'].includes(key))
      || !isNonEmptyId(abilityDraftSnapshot.actionId)
      || !abilityActionIds.includes(abilityDraftSnapshot.actionId)) return null;
    const action = actionById.get(abilityDraftSnapshot.actionId);
    const target = parseSourceTarget(abilityDraftSnapshot.target);
    const additionalTarget = parseSourceTarget(abilityDraftSnapshot.additionalTarget);
    if (!isActorlessSourceAction(action) || target === undefined
      || additionalTarget === undefined || (target !== null && target.kind !== action.target.kind)
      || (additionalTarget !== null && target === null)
      || (additionalTarget !== null && (!action.additionalTarget || additionalTarget.kind !== action.additionalTarget))) return null;
    if (target?.kind === 'partyCharacter'
      && (!party.some(member => member.characterId === target.characterId)
        || (partyHp.find(row => row.characterId === target.characterId)?.currentHp ?? 0) <= 0)) return null;
    if (target?.kind === 'enemy' && !enemies.some(enemy => enemy.enemyId === target.enemyId && enemy.currentHp > 0)) return null;
    if (additionalTarget?.kind === 'partyCharacter' && (!party.some(member => member.characterId === additionalTarget.characterId)
      || (partyHp.find(row => row.characterId === additionalTarget.characterId)?.currentHp ?? 0) <= 0
      || (target?.kind === 'partyCharacter' && target.characterId === additionalTarget.characterId))) return null;
    if (additionalTarget?.kind === 'enemy' && (!enemies.some(enemy => enemy.enemyId === additionalTarget.enemyId && enemy.currentHp > 0)
      || (target?.kind === 'enemy' && target.enemyId === additionalTarget.enemyId))) return null;
    abilityDraft = { actionId: abilityDraftSnapshot.actionId, target, additionalTarget };
  }

  const itemMappings = encounterDef.itemActions ?? [];
  let itemDraft: MapRunEncounterItemDraft | null = null;
  if (itemDraftSnapshot !== null) {
    if (!isRecord(itemDraftSnapshot)
      || Object.keys(itemDraftSnapshot).length !== 4
      || Object.keys(itemDraftSnapshot).some(key => !['itemId', 'actionId', 'target', 'additionalTarget'].includes(key))
      || !isNonEmptyId(itemDraftSnapshot.itemId)
      || !isNonEmptyId(itemDraftSnapshot.actionId)) return null;
    const mapping = itemMappings.find(candidate => candidate.itemId === itemDraftSnapshot.itemId);
    const action = actionById.get(itemDraftSnapshot.actionId);
    const target = parseSourceTarget(itemDraftSnapshot.target);
    const additionalTarget = parseSourceTarget(itemDraftSnapshot.additionalTarget);
    if (!mapping || mapping.actionId !== itemDraftSnapshot.actionId
      || !isActorlessSourceAction(action) || target === undefined
      || additionalTarget === undefined || (target !== null && target.kind !== action.target.kind)
      || (additionalTarget !== null && target === null)
      || (additionalTarget !== null && (!action.additionalTarget || additionalTarget.kind !== action.additionalTarget))) return null;
    if (target?.kind === 'partyCharacter'
      && (!party.some(member => member.characterId === target.characterId)
        || (partyHp.find(row => row.characterId === target.characterId)?.currentHp ?? 0) <= 0)) return null;
    if (target?.kind === 'enemy' && !enemies.some(enemy => enemy.enemyId === target.enemyId && enemy.currentHp > 0)) return null;
    if (additionalTarget?.kind === 'partyCharacter' && (!party.some(member => member.characterId === additionalTarget.characterId)
      || (partyHp.find(row => row.characterId === additionalTarget.characterId)?.currentHp ?? 0) <= 0
      || (target?.kind === 'partyCharacter' && target.characterId === additionalTarget.characterId))) return null;
    if (additionalTarget?.kind === 'enemy' && (!enemies.some(enemy => enemy.enemyId === additionalTarget.enemyId && enemy.currentHp > 0)
      || (target?.kind === 'enemy' && target.enemyId === additionalTarget.enemyId))) return null;
    itemDraft = { itemId: itemDraftSnapshot.itemId, actionId: itemDraftSnapshot.actionId, target, additionalTarget };
  }

  const handsByCharacter = new Map(savedHands.map(hand => [hand.characterId, hand.actionIds]));
  const overrides: MapRunActionOverride[] = [];
  const overrideCharacters = new Set<string>();
  let previousOverridePartyIndex = -1;
  for (const rawOverride of overridesSnapshot) {
    if (!isRecord(rawOverride)) return null;
    const keys = Object.keys(rawOverride);
    if (keys.length !== 3 || keys.some(key => !['kind', 'characterId', 'actionId'].includes(key))
      || (rawOverride.kind !== 'swap' && rawOverride.kind !== 'playerCommand')
      || !isNonEmptyId(rawOverride.characterId) || !isNonEmptyId(rawOverride.actionId)) return null;
    const partyIndex = party.findIndex(member => member.characterId === rawOverride.characterId);
    const hand = handsByCharacter.get(rawOverride.characterId) ?? [];
    const action = actionById.get(rawOverride.actionId);
    if (partyIndex < 0 || partyIndex <= previousOverridePartyIndex || overrideCharacters.has(rawOverride.characterId)
      || !action || !action.eligibleCharacterIds.includes(rawOverride.characterId)) return null;
    if (rawOverride.kind === 'swap') {
      if (!hand.includes(rawOverride.actionId) || rawOverride.actionId === hand[0]) return null;
    } else if (hand.includes(rawOverride.actionId)) return null;
    previousOverridePartyIndex = partyIndex;
    overrideCharacters.add(rawOverride.characterId);
    overrides.push({
      kind: rawOverride.kind,
      characterId: rawOverride.characterId,
      actionId: rawOverride.actionId,
    });
  }
  const drawCursorStart = value.drawCursorStart as number;
  let expectedDraw: ReturnType<typeof drawGameplayBHands>;
  try {
    expectedDraw = drawGameplayBHands({
      partyCharacterIds: party.map(member => member.characterId),
      enemies: expectedEnemyDefinitions,
      enemyHealth: enemies.map(enemy => ({
        enemyId: enemy.enemyId,
        currentHp: enemy.currentHp,
        maxHp: expectedEnemyDefinitions.find(definition => definition.id === enemy.enemyId)!.maxHp,
      })),
      enemyActorResources,
      enemyTeamResources,
      livingPartyCharacterIds: partyHp.filter(row => row.currentHp > 0).map(row => row.characterId),
      livingEnemyIds: enemies.filter(enemy => enemy.currentHp > 0).map(enemy => enemy.enemyId),
      participants: encounterDef.participants,
      actions: definition.actions,
      candidatePools: definition.candidatePools,
      executionContractId: definition.executionContractId,
      mapRunFacts: definition.mapRunFacts,
      candidateSourceSnapshot,
      actorResources,
      teamResources,
        partyHealth: partyHealthForHandDraw(definition, party, partyHp),
      randomState: {
        algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
        seed: value.randomState.seed as number,
        cursor: drawCursorStart,
      },
    });
  } catch {
    return null;
  }
  if (expectedDraw.randomState.cursor !== value.randomState.cursor
    || expectedDraw.hands.some((hand, index) => hand.characterId !== savedHands[index]?.characterId
      || hand.actionIds.length !== savedHands[index]?.actionIds.length
      || hand.actionIds.some((actionId, actionIndex) => actionId !== savedHands[index]?.actionIds[actionIndex]))
    || expectedDraw.enemyHands.some((hand, index) => hand.enemyId !== enemyHands[index]?.enemyId
      || hand.actionIds.length !== enemyHands[index]?.actionIds.length
      || hand.actionIds.some((actionId, actionIndex) => actionId !== enemyHands[index]?.actionIds[actionIndex]))) return null;

  const receiptCurrentEncounter: NonNullable<MapEffectReceiptContext['currentEncounter']> = {
    nodeId: expectedNodeId,
    ...(activityId === undefined ? {} : { activityId }),
    round: value.round as number,
    ...(locals === undefined ? {} : { locals }),
    ...(statuses === undefined ? {} : { statuses }),
    partyHp: partyHp.map(row => ({ characterId: row.characterId, currentHp: row.currentHp })),
    enemies: enemies.map(row => ({ enemyId: row.enemyId, currentHp: row.currentHp })),
  };
  const receiptCurrentBalances: MapEffectReceiptBalances = {
    partyActor: actorResources,
    partyTeam: teamResources,
    enemyActor: enemyActorResources,
    enemyTeam: enemyTeamResources,
  };
  const lastCommit = lastCommitSnapshot === null
    ? null
    : restoreEncounterCommitReceipt(lastCommitSnapshot, definition, expectedNodeId, party, value.round as number,
      commitVersion, runId, activityId, receiptCurrentEncounter, receiptCurrentBalances, shieldMap ? shields : undefined);
  if (lastCommitSnapshot !== null && lastCommit === null) return null;
  if (definition.executionContractId === 'AG-1') {
    if (!effectRandomState || (lastCommit !== null
      && !sameReceiptValue(lastCommit.plannedEffectRandomState, effectRandomState))) return null;
    if (lastCommit === null && value.round === 1) {
      try {
        if (!sameReceiptValue(effectRandomState, createMapEffectRandomState(value.randomState.seed as number))) return null;
      } catch { return null; }
    }
  }

  const restored: MapRunEncounterSnapshot = {
    nodeId: expectedNodeId,
    ...(locals === undefined ? {} : { locals }),
    ...(statuses === undefined ? {} : { statuses }),
    ...(shieldMap ? { shields: shields! } : {}),
    ...(activityId === undefined ? {} : { activityId }),
    round: value.round as number,
    hands: savedHands,
    enemyHands,
    enemyActorResources,
    enemyTeamResources,
    overrides,
    targetSelections,
    ...(abilityDraft === null ? {} : { abilityDraft }),
    ...(itemDraft === null ? {} : { itemDraft }),
    enemies,
    ...(enemyAgility === undefined ? {} : { enemyAgility }),
    draftVersion: draftVersionSnapshot as number,
    drawCursorStart,
    randomState: {
      algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
      seed: value.randomState.seed as number,
      cursor: value.randomState.cursor as number,
    },
    ...(effectRandomState === undefined ? {} : { effectRandomState: copyMapEffectRandomState(effectRandomState) }),
    ...(candidateSourceSnapshot === undefined ? {} : { candidateSourceSnapshot }),
    lastCommit,
  };
  try {
    resolveGameplayBActionPreview({
      runId,
      definition,
      encounter: restored,
      party,
      partyHp,
      playerCost,
      actorResources,
      teamResources,
    });
  } catch {
    return null;
  }
  return restored;
}

function hasInvalidActiveEncounterNodeAlias(value: Record<string, unknown>, expectedNodeId: string | null): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(value, 'activeEncounterNodeId');
  if (!descriptor) return false;
  if (descriptor.enumerable) return true;
  try {
    return value.activeEncounterNodeId !== expectedNodeId;
  } catch {
    return true;
  }
}

function sameShopRows(
  value: readonly unknown[],
  expected: readonly { readonly resourceId: string; readonly amount: number }[],
): boolean {
  if (value.length !== expected.length) return false;
  for (const [index, row] of value.entries()) {
    const target = expected[index];
    if (!target || !isRecord(row) || Object.keys(row).length !== 2
      || row.resourceId !== target.resourceId || row.amount !== target.amount) return false;
  }
  return true;
}

function restoreShopPurchaseReceipt(
  value: unknown,
  nodeId: string,
  activity: GameplayMapActivityDef,
  activityId: string,
  draftVersion: number,
): MapRunShopPurchaseReceipt | null {
  const shop = activity.shop;
  if (!shop || !isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 8 || keys.some(key => ![
    'requestId', 'offerId', 'nodeId', 'activityId', 'resultingDraftVersion', 'costs', 'effects', 'heal',
  ].includes(key))
    || !isNonEmptyId(value.requestId) || !isNonEmptyId(value.offerId)
    || value.nodeId !== nodeId || value.activityId !== activityId
    || !Number.isSafeInteger(value.resultingDraftVersion) || (value.resultingDraftVersion as number) !== draftVersion
    || !Array.isArray(value.costs) || !Array.isArray(value.effects)) return null;
  const offer = shop.offers.find(candidate => candidate.id === value.offerId);
  if (!offer) return null;
  let expectedCosts: readonly { resourceId: string; amount: number }[];
  let expectedEffects: readonly { resourceId: string; amount: number }[];
  try {
    expectedCosts = freezeShopCosts(offer);
    expectedEffects = freezeShopEffects(offer);
  } catch {
    return null;
  }
  if (!sameShopRows(value.costs, expectedCosts) || !sameShopRows(value.effects, expectedEffects)) return null;
  let heal: MapRunShopPurchaseReceipt['heal'] = null;
  if (offer.heal === undefined) {
    if (value.heal !== null) return null;
  } else {
    if (!isRecord(value.heal) || Object.keys(value.heal).length !== 3
      || Object.keys(value.heal).some(key => !['characterId', 'amount', 'restored'].includes(key))
      || value.heal.characterId !== offer.heal.characterId
      || value.heal.amount !== offer.heal.amount
      || !Number.isSafeInteger(value.heal.restored) || (value.heal.restored as number) < 0
      || (value.heal.restored as number) > offer.heal.amount) return null;
    heal = { characterId: offer.heal.characterId, amount: offer.heal.amount, restored: value.heal.restored as number };
  }
  return {
    requestId: value.requestId,
    offerId: value.offerId,
    nodeId,
    activityId,
    resultingDraftVersion: draftVersion,
    costs: expectedCosts,
    effects: expectedEffects,
    heal,
  };
}

function restoreRunState(
  value: unknown,
  definition: ResolvedMap,
  mapId: string,
  resolveCharacterIdForVariant?: ResolveCharacterIdForVariant,
): MutableMapRun | null {
  const commitVersionSnapshot: unknown = isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'commitVersion')
    ? value.commitVersion
    : 0;
  if (!isRecord(value)
    || !isNonEmptyId(value.runId)
    || value.mapId !== mapId
    || value.status !== 'inProgress'
    || !isPartySnapshot(value.party, definition.partyCharacterIds, resolveCharacterIdForVariant)
    || !Object.prototype.hasOwnProperty.call(value, 'partyHp')
    || !Object.prototype.hasOwnProperty.call(value, 'lastEncounterCommit')
    || !Number.isSafeInteger(value.playerCost)
    || (value.playerCost as number) < 0
    || !Number.isSafeInteger(commitVersionSnapshot) || (commitVersionSnapshot as number) < 0
    || !isNonEmptyId(value.currentNodeId)
    || !isUniqueIdArray(value.visitedNodeIds)
    || !isUniqueIdArray(value.completedEncounterNodeIds)
    || !(value.activeEncounter === null || isRecord(value.activeEncounter))) return null;

  const nodesById = new Map(definition.nodes.map(node => [node.id, node]));
  const knownNodeIds = new Set(nodesById.keys());
  const contentNodeIds = new Set(definition.nodes
    .filter(node => node.encounter !== undefined || nodeActivities(node).length > 0)
    .map(node => node.id));
  const visitedNodeIds = value.visitedNodeIds;
  const completedEncounterNodeIds = value.completedEncounterNodeIds;
  const currentNodeId = value.currentNodeId;
  const currentNode = nodesById.get(currentNodeId);

  if (!currentNode
    || visitedNodeIds[0] !== definition.startNodeId
    || !visitedNodeIds.includes(currentNodeId)
    || visitedNodeIds.some(nodeId => !knownNodeIds.has(nodeId))
    || completedEncounterNodeIds.some(nodeId => !contentNodeIds.has(nodeId) || !visitedNodeIds.includes(nodeId))) return null;

  const completedActivityIdsSnapshot: unknown = value.completedActivityIds === undefined
    ? []
    : value.completedActivityIds;
  if (!isUniqueIdArray(completedActivityIdsSnapshot)) return null;
  for (const key of completedActivityIdsSnapshot) {
    const separator = key.indexOf('/');
    const nodeId = separator < 0 ? '' : key.slice(0, separator);
    const activityId = separator < 0 ? '' : key.slice(separator + 1);
    const owner = nodesById.get(nodeId);
    if (!owner || !visitedNodeIds.includes(nodeId)
      || !nodeActivities(owner).some(activity => activity.id === activityId)) return null;
  }

  const expectedResources = initialResourceBalances(definition, value.party);
  const partyHp = restorePartyHp(value.partyHp, definition, value.party);
  const partyAgility = restoreAgilitySnapshot(
    Object.prototype.hasOwnProperty.call(value, 'partyAgility') ? value.partyAgility : undefined,
    initialPartyAgility(definition, value.party),
    'characterId',
  );
  const actorResources = restoreActorResourceBalances(value.actorResources, expectedResources.actorResources);
  const teamResources = restoreTeamResourceBalances(value.teamResources, expectedResources.teamResources);
  const mapRunFacts = restoreMapRunFacts(value, definition);
  const mapRunStatuses = restoreMapRunStatuses(value, definition, value.party, commitVersionSnapshot as number);
  if (!partyHp || partyAgility === null || !actorResources || !teamResources
    || mapRunFacts === null || mapRunStatuses === null) return null;
  const lastEncounterCommitSnapshot: unknown = value.lastEncounterCommit;
  if (!(lastEncounterCommitSnapshot === null || isRecord(lastEncounterCommitSnapshot))) return null;
  if (((commitVersionSnapshot as number) === 0) !== (lastEncounterCommitSnapshot === null)) return null;
  const lastReceiptActivityId = isRecord(lastEncounterCommitSnapshot)
    && isNonEmptyId(lastEncounterCommitSnapshot.activityId)
    ? lastEncounterCommitSnapshot.activityId
    : undefined;
  const rawActiveEncounter = isRecord(value.activeEncounter) ? value.activeEncounter : null;
  const currentReceiptScopeMatches = rawActiveEncounter !== null && isRecord(lastEncounterCommitSnapshot)
    && rawActiveEncounter.nodeId === lastEncounterCommitSnapshot.nodeId
    && (rawActiveEncounter.activityId ?? null) === (lastEncounterCommitSnapshot.activityId ?? null)
    && Number.isSafeInteger(rawActiveEncounter.round)
    && rawActiveEncounter.round === (lastEncounterCommitSnapshot.round as number) + 1
    && Array.isArray(rawActiveEncounter.enemies);
  const receiptCurrentEncounter = currentReceiptScopeMatches ? {
    nodeId: rawActiveEncounter!.nodeId as string,
    ...(isNonEmptyId(rawActiveEncounter!.activityId) ? { activityId: rawActiveEncounter!.activityId } : {}),
    round: rawActiveEncounter!.round as number,
    ...(Object.prototype.hasOwnProperty.call(rawActiveEncounter!, 'locals') ? { locals: rawActiveEncounter!.locals } : {}),
    ...(Array.isArray(rawActiveEncounter!.statuses) ? { statuses: rawActiveEncounter!.statuses as MapEncounterStatusInstance[] } : {}),
    partyHp,
    enemies: rawActiveEncounter!.enemies as NonNullable<MapEffectReceiptContext['currentEncounter']>['enemies'],
  } : undefined;
  const receiptCurrentBalances: MapEffectReceiptBalances | undefined = currentReceiptScopeMatches ? {
    partyActor: actorResources,
    partyTeam: teamResources,
    enemyActor: rawActiveEncounter!.enemyActorResources as MapEffectReceiptBalances['enemyActor'],
    enemyTeam: rawActiveEncounter!.enemyTeamResources as MapEffectReceiptBalances['enemyTeam'],
  } : undefined;
  const lastEncounterCommit = lastEncounterCommitSnapshot === null
    ? null
    : restoreEncounterCommitReceipt(
      lastEncounterCommitSnapshot,
      definition,
      null,
      value.party,
      null,
      commitVersionSnapshot as number,
      value.runId as string,
      lastReceiptActivityId,
      receiptCurrentEncounter,
      receiptCurrentBalances,
      currentReceiptScopeMatches && gameplayMapUsesShieldAdd(definition) ? rawActiveEncounter!.shields : undefined,
    );
  if (lastEncounterCommitSnapshot !== null && lastEncounterCommit === null) return null;
  if (lastEncounterCommit?.executionContractId === 'AG-1'
    && !sameReceiptValue(lastEncounterCommit.plannedMapRunFacts, mapRunFacts)) return null;
  if (gameplayMapUsesMapRunStatus(definition)
    && ((commitVersionSnapshot as number) === 0
      ? lastEncounterCommit !== null || !sameReceiptValue(mapRunStatuses, [])
      : !lastEncounterCommit || !sameReceiptValue(lastEncounterCommit.plannedMapRunStatuses, mapRunStatuses))) return null;
  if (lastEncounterCommit && !visitedNodeIds.includes(lastEncounterCommit.nodeId)) return null;

  const currentActivities = nodeActivities(currentNode);
  const currentNodeCompleted = completedEncounterNodeIds.includes(currentNode.id);
  const rawActiveActivity: unknown = value.activeActivity === undefined ? null : value.activeActivity;
  if (!(rawActiveActivity === null || isRecord(rawActiveActivity))) return null;

  let activeActivity: MapRunActiveActivity | null = null;
  let activeActivityRequiresEncounter = false;
  if (rawActiveActivity !== null) {
    if (currentActivities.length === 0 || currentNodeCompleted) return null;
    const keys = Object.keys(rawActiveActivity);
    if (keys.length !== 6 || keys.some(key => ![
      'nodeId', 'activityId', 'index', 'kind', 'shopDraftVersion', 'lastPurchase',
    ].includes(key))
      || rawActiveActivity.nodeId !== currentNode.id
      || !isNonEmptyId(rawActiveActivity.activityId)
      || !Number.isSafeInteger(rawActiveActivity.index) || (rawActiveActivity.index as number) < 0
      || !Number.isSafeInteger(rawActiveActivity.shopDraftVersion)
      || (rawActiveActivity.shopDraftVersion as number) < 0) return null;
    const index = rawActiveActivity.index as number;
    const activity = currentActivities[index];
    if (!activity || activity.id !== rawActiveActivity.activityId) return null;
    const kind = activityKind(activity);
    if (rawActiveActivity.kind !== kind) return null;
    const rawLastPurchase = rawActiveActivity.lastPurchase;
    if (!(rawLastPurchase === null || isRecord(rawLastPurchase))) return null;
    if (kind === 'shop') {
      const lastPurchase = rawLastPurchase === null
        ? null
        : restoreShopPurchaseReceipt(
          rawLastPurchase,
          currentNode.id,
          activity,
          activity.id,
          rawActiveActivity.shopDraftVersion as number,
        );
      if (rawLastPurchase !== null && lastPurchase === null) return null;
      activeActivity = {
        nodeId: currentNode.id,
        activityId: activity.id,
        index,
        kind,
        shopDraftVersion: rawActiveActivity.shopDraftVersion as number,
        lastPurchase,
      };
    } else {
      if (rawActiveActivity.shopDraftVersion !== 0 || rawLastPurchase !== null) return null;
      activeActivityRequiresEncounter = true;
      activeActivity = {
        nodeId: currentNode.id,
        activityId: activity.id,
        index,
        kind,
        shopDraftVersion: 0,
        lastPurchase: null,
      };
    }
    const completed = new Set(completedActivityIdsSnapshot);
    for (const [activityIndex, candidate] of currentActivities.entries()) {
      const done = completed.has(activityCompletedKey(currentNode.id, candidate.id));
      if (activityIndex < index && !done) return null;
      if (activityIndex >= index && done) return null;
    }
  }
  if (currentActivities.length > 0 && !currentNodeCompleted && activeActivity === null) return null;
  if (currentNodeCompleted && activeActivity !== null) return null;
  if (currentNodeCompleted) {
    const completed = new Set(completedActivityIdsSnapshot);
    if (!currentActivities.every(activity => completed.has(activityCompletedKey(currentNode.id, activity.id)))) return null;
  }

  const requiresEncounter = currentActivities.length > 0
    ? activeActivityRequiresEncounter
    : currentNode.encounter !== undefined && !currentNodeCompleted;
  const activeEncounter = value.activeEncounter === null
    ? null
    : restoreEncounterSnapshot(
      value.activeEncounter,
      definition,
      currentNode.id,
      value.party,
      partyHp,
      actorResources,
      teamResources,
      value.playerCost as number,
      commitVersionSnapshot as number,
      value.runId as string,
      activeActivity?.activityId,
      mapRunFacts ?? undefined,
    );
  if (value.activeEncounter !== null && activeEncounter === null) return null;
  if (requiresEncounter !== (activeEncounter !== null)) return null;
  if (activeEncounter && (!contentNodeIds.has(activeEncounter.nodeId)
    || activeEncounter.nodeId !== currentNode.id
    || completedEncounterNodeIds.includes(activeEncounter.nodeId))) return null;
  if (activeEncounter?.lastCommit) {
    if (!lastEncounterCommit
      || JSON.stringify(activeEncounter.lastCommit) !== JSON.stringify(lastEncounterCommit)) return null;
  }
  if (lastEncounterCommit && activeEncounter
    && lastEncounterCommit.nodeId === activeEncounter.nodeId
    && lastEncounterCommit.activityId === activeEncounter.activityId
    && activeEncounter.round > 1 && !activeEncounter.lastCommit) return null;
  if (hasInvalidActiveEncounterNodeAlias(value, activeEncounter?.nodeId ?? null)) return null;
  if (definition.exitNodeIds.includes(currentNode.id) && activeEncounter === null && activeActivity === null) return null;

  return {
    runId: value.runId,
    mapId,
    party: projectPartySnapshot(value.party),
    ...(partyAgility === undefined ? {} : { partyAgility }),
    partyHp,
    ...(mapRunFacts === undefined ? {} : { mapRunFacts }),
    ...(mapRunStatuses === undefined ? {} : { mapRunStatuses: [...mapRunStatuses] }),
    lastEncounterCommit,
    playerCost: value.playerCost as number,
    commitVersion: commitVersionSnapshot as number,
    actorResources,
    teamResources,
    status: 'inProgress',
    currentNodeId,
    visitedNodeIds: [...visitedNodeIds],
    completedEncounterNodeIds: [...completedEncounterNodeIds],
    completedActivityIds: [...completedActivityIdsSnapshot],
    activeActivity,
    activeEncounter,
  };
}

export class MapRunError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'MapRunError';
  }
}

/** Owns at most one active MapRun and never writes Persistent PlayerState. */
export class MapRunService {
  private slot: MapRunSlot | null = null;
  private result: MapRunSuccessResult | null = null;
  private failureResult: MapRunFailureResult | null = null;
  private terminalCommitReplay: TerminalMapRunCommitReplay | null = null;
  private readonly preparedEncounterCommits = new WeakMap<object, PreparedMapRunEncounterCommitState>();

  constructor(
    private readonly resolver: MapContentResolver,
    private readonly resolveCharacterIdForVariant?: ResolveCharacterIdForVariant,
  ) {}

  start(mapId: string, admittedParty: readonly MapRunPartyMember[]): MapRun {
    if (this.slot?.run.status === 'inProgress') {
      throw new MapRunError(['a MapRun is already in progress']);
    }
    const definition = this.resolver.resolve(mapId);
    if (!definition) throw new MapRunError([`unknown Map ID "${mapId}"`]);
    if (!Number.isSafeInteger(definition.resumeVersion) || definition.resumeVersion < 1) {
      throw new MapRunError([`Map "${mapId}" has an invalid resumeVersion; a MapRun cannot be started`]);
    }
    if (!Number.isSafeInteger(definition.initialPlayerCost) || definition.initialPlayerCost < 0) {
      throw new MapRunError([`Map "${mapId}" has an invalid initialPlayerCost; a MapRun cannot be started`]);
    }
    if (!isPartySnapshot(admittedParty, definition.partyCharacterIds, this.resolveCharacterIdForVariant)) {
      throw new MapRunError([`Map "${mapId}" did not receive a complete admitted party snapshot`]);
    }

    const startNode = definition.nodes.find(node => node.id === definition.startNodeId);
    if (!startNode) throw new MapRunError([`Map "${mapId}" has no start Node "${definition.startNodeId}"`]);

    const party = projectPartySnapshot(admittedParty);
    const partyHp = initialPartyHp(definition, party);
    const partyAgility = initialPartyAgility(definition, party);
    const resources = initialResourceBalances(definition, party);
    const mapRunFacts = initializeMapRunFacts(definition);
    const runId = `map-run-${++nextMapRunSequence}`;
    const entered = openNodeContent(
      definition,
      startNode,
      party,
      resources.actorResources,
      resources.teamResources,
      partyHp,
      [],
      0,
      undefined,
      mapRunFacts,
    );
    const run: MutableMapRun = {
      runId,
      mapId,
      party,
      ...(partyAgility === undefined ? {} : { partyAgility }),
      partyHp,
      ...(mapRunFacts === undefined ? {} : { mapRunFacts }),
      ...(gameplayMapUsesMapRunStatus(definition) ? { mapRunStatuses: [] } : {}),
      lastEncounterCommit: null,
      playerCost: definition.initialPlayerCost,
      commitVersion: 0,
      actorResources: resources.actorResources,
      teamResources: resources.teamResources,
      status: 'inProgress',
      currentNodeId: startNode.id,
      visitedNodeIds: [startNode.id],
      completedEncounterNodeIds: [],
      completedActivityIds: [],
      activeActivity: entered.activeActivity,
      activeEncounter: entered.activeEncounter,
    };
    if (!run.activeEncounter && !run.activeActivity && definition.exitNodeIds.includes(startNode.id)) {
      run.status = 'success';
    }

    if (run.status === 'success') {
      this.failureResult = null;
      this.terminalCommitReplay = null;
      return this.finishSuccess(definition, run);
    }
    this.result = null;
    this.failureResult = null;
    this.terminalCommitReplay = null;
    this.slot = { definition, run };
    return snapshotOf(run);
  }

  /** Rebuilds the entire active MapRun from its Map start and admitted party snapshot. */
  restart(expectedRunId: string): MapRun {
    const previousSlot = this.slot;
    if (!previousSlot || previousSlot.run.runId !== expectedRunId || previousSlot.run.status !== 'inProgress') {
      throw new MapRunError(['the MapRun to restart is no longer active']);
    }
    const previousResult = this.result;
    const previousFailureResult = this.failureResult;
    const previousTerminalReplay = this.terminalCommitReplay;
    this.slot = null;
    try {
      return this.start(previousSlot.run.mapId, previousSlot.run.party);
    } catch (error) {
      this.slot = previousSlot;
      this.result = previousResult;
      this.failureResult = previousFailureResult;
      this.terminalCommitReplay = previousTerminalReplay;
      throw error;
    }
  }

  /** Discards the complete active MapRun; it has no PlayerState or Save result. */
  abandon(expectedRunId: string): void {
    const slot = this.slot;
    if (!slot || slot.run.runId !== expectedRunId || slot.run.status !== 'inProgress') {
      throw new MapRunError(['the MapRun to abandon is no longer active']);
    }
    this.slot = null;
    this.result = null;
    this.failureResult = null;
    this.terminalCommitReplay = null;
  }

  getSnapshot(expectedRunId?: string): MapRun | null {
    const run = this.slot?.run;
    if (!run || (expectedRunId !== undefined && expectedRunId !== run.runId)) return null;
    return snapshotOf(run);
  }

  /** Returns an owner-bound, detached summary for the preparation workspace. */
  getEntrySnapshot(expectedRunId: string): MapRunEntrySnapshot | null {
    const slot = this.slot;
    if (!slot || slot.run.runId !== expectedRunId || slot.run.status !== 'inProgress') return null;
    const node = slot.definition.nodes.find(candidate => candidate.id === slot.run.currentNodeId);
    if (!node) return null;
    const run = snapshotOf(slot.run);
    const caps = partyHpCaps(slot.definition, run.party);
    if (caps.size !== run.party.length) return null;
    const partyHp = Object.freeze(run.party.map(member => {
      const current = run.partyHp.find(row => row.characterId === member.characterId);
      const maxHp = caps.get(member.characterId);
      if (!current || maxHp === undefined) return null;
      return Object.freeze({ characterId: member.characterId, currentHp: current.currentHp, maxHp });
    }));
    if (partyHp.some(row => row === null)) return null;
    const activities = nodeActivities(node);
    const activeActivity = run.activeActivity;
    const activity = activeActivity
      ? Object.freeze({
          kind: activeActivity.kind,
          position: activeActivity.index + 1,
          total: activities.length,
        })
      : undefined;
    const entryInfo = slot.definition.entryInfo
      ? Object.freeze({
          ...(slot.definition.entryInfo.description === undefined ? {} : { description: slot.definition.entryInfo.description }),
          ...(slot.definition.entryInfo.tips === undefined ? {} : { tips: Object.freeze([...slot.definition.entryInfo.tips]) }),
        })
      : undefined;
    return Object.freeze({
      run,
      mapName: slot.definition.name,
      ...(entryInfo ? { entryInfo } : {}),
      currentNodeTitle: node.title,
      partyHp: partyHp as readonly { readonly characterId: string; readonly currentHp: number; readonly maxHp: number }[],
      ...(activity ? { activity } : {}),
      ...(run.activeEncounter ? { round: run.activeEncounter.round } : {}),
    });
  }

  /** Enumerates current domain cards, never visual copies or unselected command offers. */
  getCards(expectedRunId?: string): readonly MapRunCardInstance[] {
    const slot = this.slot;
    if (!slot || !slot.run.activeEncounter || (expectedRunId !== undefined && expectedRunId !== slot.run.runId)) return Object.freeze([]);
    return catalogMapRunCards(snapshotOf(slot.run), this.resolveActionPreview(slot));
  }

  /** A stale scene / round / removed command card is not a current domain object. */
  resolveCardReference(ref: MapRunCardRef): MapRunCardInstance | null {
    const parsed = parseMapRunCardRef(ref);
    if (!parsed) return null;
    const key = mapRunCardKey(parsed);
    return this.getCards(parsed.scope.runId).find(card => mapRunCardKey(card.ref) === key) ?? null;
  }

  /** Returns a detached success-only summary for the matching completed Run. */
  getResult(expectedRunId: string): MapRunSuccessResult | null {
    if (!this.result || this.result.runId !== expectedRunId) return null;
    return Object.freeze({ ...this.result });
  }

  /** Returns the runtime-only failure summary for the most recent failed Run. */
  getFailureResult(expectedRunId: string): MapRunFailureResult | null {
    if (!this.failureResult || this.failureResult.runId !== expectedRunId) return null;
    return Object.freeze({ ...this.failureResult });
  }

  /** Returns a detached Prepared Action / Target preview without mutating the Run. */
  previewActions(expectedRunId?: string): GameplayBActionPreview | null {
    const slot = this.slot;
    if (!slot || (expectedRunId !== undefined && expectedRunId !== slot.run.runId)
      || slot.run.activeEncounter === null) return null;
    return this.resolveActionPreview(slot);
  }

  /** Validates a hypothetical replacement without installing it or consuming randomness. */
  previewActionReplacement(runId: string, characterId: string, actionId: string, draft: MapRunEncounterDraftToken): GameplayBActionPreview {
    const slot = this.requireEncounterDraft(runId, draft);
    const encounter = slot.run.activeEncounter!;
    const current = this.resolveActionPreview(slot);
    const prepared = current.preparedActions.find(row => row.characterId === characterId);
    if (!prepared || prepared.preparedActionId === null) throw new MapRunError(['Replacement source is not an active Character']);
    if (actionId === prepared.preparedActionId) throw new MapRunError(['Replacement must choose a different prepared Action']);
    const inHand = prepared.handActionIds.includes(actionId);
    if (!inHand) {
      const option = current.playerCommandOptions.find(row => row.characterId === characterId && row.actionId === actionId);
      if (!option || !option.canPayPlayerCost || !option.canPayActionCosts) throw new MapRunError(['Replacement is not a payable PlayerCommand candidate']);
    }
    const overrides = encounter.overrides.filter(row => row.characterId !== characterId);
    if (actionId !== prepared.naturalActionId) overrides.push({ kind: inHand ? 'swap' : 'playerCommand', characterId, actionId });
    const order = new Map(slot.run.party.map((member, index) => [member.characterId, index]));
    overrides.sort((left, right) => order.get(left.characterId)! - order.get(right.characterId)!);
    return this.resolveActionPreview(slot, this.pruneRemovedCardTargets(slot, {
      ...encounter, overrides,
      targetSelections: encounter.targetSelections.filter(row => row.characterId !== characterId),
    }));
  }

  /** Reports full-round affordability from the same pure settlement plan as Commit. */
  previewEncounterCommit(expectedRunId?: string): MapRunEncounterCommitPreview | null {
    const slot = this.slot;
    const encounter = slot?.run.activeEncounter;
    if (!slot || !encounter || (expectedRunId !== undefined && expectedRunId !== slot.run.runId)) return null;
    const identity = {
      nodeId: encounter.nodeId,
      ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
      round: encounter.round,
      draftVersion: encounter.draftVersion,
    };
    try {
      if (!Number.isSafeInteger(slot.run.commitVersion) || slot.run.commitVersion >= Number.MAX_SAFE_INTEGER) {
        throw new MapRunError(['the MapRun Commit version is exhausted']);
      }
      const plan = resolveEncounterCommitPlan(slot);
      return Object.freeze({
        ...identity,
        canCommit: true,
        playerCostRequired: plan.playerCostRequired,
        diagnostics: Object.freeze([]),
        settlements: freezeCommitSettlements(plan.settlements),
        enemyActions: freezeEnemyActionSettlements(plan.enemyActions),
        ...(plan.schedulerFormatVersion === undefined ? {} : {
          executionContractId: 'AG-1' as const,
          schedulerFormatVersion: plan.schedulerFormatVersion,
          schedulerTerminal: plan.schedulerTerminal,
          executionSequence: plan.executionSequence,
          ...(plan.plannedMapRunFacts === undefined ? {} : { plannedMapRunFacts: copyMapRunFacts(plan.plannedMapRunFacts) }),
          plannedEffectRandomState: copyMapEffectRandomState(plan.plannedEffectRandomState),
        }),
        ...(plan.programReceiptVersion === undefined ? {} : {
          programReceiptVersion: plan.programReceiptVersion,
          ...(plan.executionContractId === 'E1-COMPAT-1' ? { executionContractId: plan.executionContractId } : {}),
          effectScope: plan.effectScope,
          programVisitCount: plan.programVisits?.length ?? 0,
          programVisits: plan.programVisits,
          plannedLocals: plan.plannedLocals,
          effectTrace: plan.effectTrace,
        }),
        ...(plan.cardEffectModifierReceipts === undefined ? {} : { cardEffectModifierReceipts: plan.cardEffectModifierReceipts }),
        ...(plan.statusReceiptVersion === undefined ? {} : {
          statusReceiptVersion: plan.statusReceiptVersion,
          plannedStatuses: plan.plannedStatuses,
          statusTrace: plan.statusTrace,
          ...(plan.statusReceiptVersion !== 1 ? { statusRemoveTrace: plan.statusRemoveTrace } : {}),
          ...(plan.statusReceiptVersion >= 3 ? { statusConsumeTrace: plan.statusConsumeTrace } : {}),
          ...(plan.statusReceiptVersion >= 4 ? { statusCategoryRemoveTrace: plan.statusCategoryRemoveTrace } : {}),
        }),
        ...(plan.shieldReceiptVersion === undefined ? {} : {
          shieldReceiptVersion: plan.shieldReceiptVersion,
          shieldStart: plan.shieldStart,
          plannedShields: plan.plannedShields,
          shieldTrace: plan.shieldTrace,
        }),
        ...(plan.triggerReceiptVersion === undefined ? {} : {
          triggerReceiptVersion: plan.triggerReceiptVersion, triggerTrace: plan.triggerTrace,
      ...(plan.triggerReceiptVersion >= 2 ? { statusExpiryTriggerTrace: plan.statusExpiryTriggerTrace } : {}),
          ...(plan.triggerReceiptVersion === 4 ? { statusDamageTriggerTrace: plan.statusDamageTriggerTrace } : {}),
        }),
      });
    } catch (error) {
      const diagnostics = error instanceof MapRunError
        ? error.diagnostics
        : [error instanceof Error ? error.message : String(error)];
      return Object.freeze({
        ...identity,
        canCommit: false,
        playerCostRequired: null,
        diagnostics: Object.freeze([...diagnostics]),
        settlements: null,
        enemyActions: null,
      });
    }
  }

  /** Atomically settles a full fixed-party round, advances Hand/RNG, and records a retry receipt. */
  commitEncounterRound(command: MapRunEncounterCommitCommand): MapRun {
    const prepared = this.prepareEncounterRoundCommit(command);
    if (prepared.itemId !== null) {
      throw new MapRunError(['an Item Encounter Commit requires the GameInstance cross-owner coordinator']);
    }
    if (!this.canInstallPreparedEncounterCommit(prepared)) {
      throw new MapRunError(['the prepared Encounter Commit is stale']);
    }
    this.installPreparedEncounterCommit(prepared);
    return prepared.snapshot;
  }

  /** Builds a detached full-round plan without changing any MapRun-owned state. */
  prepareEncounterRoundCommit(command: MapRunEncounterCommitCommand): PreparedMapRunEncounterCommit {
    if (!isRecord(command)
      || Object.keys(command).length !== 4
      || Object.keys(command).some(key => !['runId', 'requestId', 'expectedCommitVersion', 'draft'].includes(key))
      || !isNonEmptyId(command.runId)
      || !isNonEmptyId(command.requestId)
      || !Number.isSafeInteger(command.expectedCommitVersion) || (command.expectedCommitVersion as number) < 0
      || !isRecord(command.draft)
      || Object.keys(command.draft).length !== (command.draft.activityId === undefined ? 3 : 4)
      || Object.keys(command.draft).some(key => !['nodeId', 'activityId', 'round', 'draftVersion'].includes(key))
      || !isNonEmptyId(command.draft.nodeId)
      || (command.draft.activityId !== undefined && !isNonEmptyId(command.draft.activityId))
      || !Number.isSafeInteger(command.draft.round) || (command.draft.round as number) < 1
      || !Number.isSafeInteger(command.draft.draftVersion) || (command.draft.draftVersion as number) < 0) {
      throw new MapRunError(['the Encounter Commit request is malformed']);
    }
    const terminalReplay = this.terminalCommitReplay;
    if (terminalReplay?.command.requestId === command.requestId) {
      if (!sameCommitRequest(terminalReplay.command, command)) {
        throw new MapRunError(['the Encounter Commit request ID was already used with different input']);
      }
      return this.makePreparedEncounterCommit({
        snapshot: terminalReplay.snapshot,
        itemId: null,
        baseSlot: this.slot,
        nextSlot: this.slot,
        result: this.result,
        failureResult: this.failureResult,
        terminalCommitReplay: this.terminalCommitReplay,
        replayed: true,
      });
    }
    const slot = this.requireActiveRun(command.runId);
    const encounter = slot.run.activeEncounter;
    const previousReceipt = slot.run.lastEncounterCommit;
    if (previousReceipt?.requestId === command.requestId) {
      if (command.expectedCommitVersion !== previousReceipt.commandVersion
        || !isRecord(command.draft)
        || command.draft.nodeId !== previousReceipt.nodeId
        || (command.draft.activityId ?? null) !== (previousReceipt.activityId ?? null)
        || command.draft.round !== previousReceipt.round
        || command.draft.draftVersion !== previousReceipt.draftVersion) {
        throw new MapRunError(['the Encounter Commit request ID was already used with different input']);
      }
      return this.makePreparedEncounterCommit({
        snapshot: snapshotOf(slot.run),
        itemId: null,
        baseSlot: slot,
        nextSlot: slot,
        result: this.result,
        failureResult: this.failureResult,
        terminalCommitReplay: this.terminalCommitReplay,
        replayed: true,
      });
    }
    if (!Number.isSafeInteger(slot.run.commitVersion) || slot.run.commitVersion >= Number.MAX_SAFE_INTEGER) {
      throw new MapRunError(['the MapRun Commit version is exhausted']);
    }
    if (command.expectedCommitVersion !== slot.run.commitVersion) {
      throw new MapRunError(['the MapRun Commit version is stale']);
    }
    const currentSlot = this.requireEncounterDraft(command.runId, command.draft);
    const currentEncounter = currentSlot.run.activeEncounter!;
    const plan = resolveEncounterCommitPlan(currentSlot);
    const nextPlayerCost = currentSlot.run.playerCost - plan.playerCostRequired;

    const commitVersion = currentSlot.run.commitVersion + 1;
    if (!Number.isSafeInteger(commitVersion)) throw new MapRunError(['the MapRun Commit version is exhausted']);
    const nextActorResources = currentSlot.run.actorResources.map(balance => ({
      ...balance,
      value: plan.actorBalancesAfter.get(actorResourceKey(balance.characterId, balance.resourceId)) ?? balance.value,
    }));
    const nextTeamResources = currentSlot.run.teamResources.map(balance => ({
      ...balance,
      value: plan.teamBalancesAfter.get(balance.resourceId) ?? balance.value,
    }));
    const nextEnemyActorResources = [...plan.enemyActorBalancesAfter].map(([key, value]) => {
      const identity = JSON.parse(key) as [string, string];
      return { enemyId: identity[0], resourceId: identity[1], value };
    });
    const nextEnemyTeamResources = [...plan.enemyTeamBalancesAfter].map(([resourceId, value]) => ({ resourceId, value }));
    const commitNode = currentSlot.definition.nodes.find(candidate => candidate.id === currentEncounter.nodeId);
    const commitEncounterDef = resolveNodeEncounter(commitNode, currentEncounter.activityId);
    if (!commitEncounterDef) {
      throw new MapRunError([`Encounter "${currentEncounter.nodeId}" is not declared by the current Map`]);
    }
    const receipt: MapRunEncounterCommitReceipt = {
      requestId: command.requestId,
      commandVersion: command.expectedCommitVersion,
      resultingCommitVersion: commitVersion,
      nodeId: currentEncounter.nodeId,
      ...(currentEncounter.activityId === undefined ? {} : { activityId: currentEncounter.activityId }),
      round: currentEncounter.round,
      draftVersion: currentEncounter.draftVersion,
      settlements: plan.settlements,
      ...(plan.enemyActions.length > 0 ? { enemyActions: freezeEnemyActionSettlements(plan.enemyActions) } : {}),
      ...(plan.ability === null ? {} : { ability: plan.ability }),
      ...(plan.item === null ? {} : { item: plan.item }),
      ...(plan.schedulerFormatVersion === undefined ? {} : {
        executionContractId: 'AG-1' as const,
        schedulerFormatVersion: plan.schedulerFormatVersion,
        schedulerStartSnapshot: plan.schedulerStartSnapshot,
        schedulerTerminal: plan.schedulerTerminal,
        executionSequence: plan.executionSequence,
        ...(plan.plannedMapRunFacts === undefined ? {} : { plannedMapRunFacts: copyMapRunFacts(plan.plannedMapRunFacts) }),
      plannedEffectRandomState: copyMapEffectRandomState(plan.plannedEffectRandomState),
      }),
      ...(plan.programReceiptVersion === undefined ? {} : {
        programReceiptVersion: plan.programReceiptVersion,
        executionContractId: plan.executionContractId,
        effectScope: plan.effectScope,
        programVisitCount: plan.programVisits?.length ?? 0,
        programVisits: plan.programVisits,
        plannedLocals: plan.plannedLocals,
        effectTrace: plan.effectTrace,
      }),
      ...(plan.cardEffectModifierReceipts === undefined ? {} : { cardEffectModifierReceipts: plan.cardEffectModifierReceipts }),
      ...(plan.statusReceiptVersion === undefined ? {} : {
        statusReceiptVersion: plan.statusReceiptVersion,
        plannedStatuses: plan.plannedStatuses,
        ...(plan.statusReceiptVersion === 7 ? { plannedMapRunStatuses: plan.plannedMapRunStatuses } : {}),
          statusTrace: plan.statusTrace,
          ...(plan.statusReceiptVersion !== 1 ? { statusRemoveTrace: plan.statusRemoveTrace } : {}),
          ...(plan.statusReceiptVersion >= 3 ? { statusConsumeTrace: plan.statusConsumeTrace } : {}),
          ...(plan.statusReceiptVersion >= 4 ? { statusCategoryRemoveTrace: plan.statusCategoryRemoveTrace } : {}),
      }),
      ...(plan.shieldReceiptVersion === undefined ? {} : {
        shieldReceiptVersion: plan.shieldReceiptVersion,
        shieldStart: plan.shieldStart,
        plannedShields: plan.plannedShields,
        shieldTrace: plan.shieldTrace,
      }),
      ...(plan.triggerReceiptVersion === undefined ? {} : {
        triggerReceiptVersion: plan.triggerReceiptVersion,
        triggerTrace: Object.freeze(plan.triggerTrace!.map(freezeTriggerTraceEntry)),
      ...(plan.triggerReceiptVersion >= 2 ? {
          statusExpiryTriggerTrace: Object.freeze(plan.statusExpiryTriggerTrace!.map(freezeStatusExpiryTriggerTraceEntry)),
        } : {}),
        ...(plan.triggerReceiptVersion === 4 ? { statusDamageTriggerTrace: Object.freeze(plan.statusDamageTriggerTrace!.map(entry => Object.freeze({
          ...entry, status: freezeDamageRewardStatus(entry.status), holder: Object.freeze({ ...entry.holder }),
        }))) } : {}),
      }),
    };
    const nextPartyHp = currentSlot.run.party.map(member => ({
      characterId: member.characterId,
      currentHp: plan.partyHpAfter.get(member.characterId) ?? 0,
    }));
    const nextEnemyHp = currentEncounter.enemies.map(enemy => ({
      enemyId: enemy.enemyId,
      currentHp: plan.enemyHpAfter.get(enemy.enemyId) ?? enemy.currentHp,
    }));
    const baseRun: MutableMapRun = {
      ...currentSlot.run,
      playerCost: nextPlayerCost,
      commitVersion,
      partyHp: nextPartyHp,
      lastEncounterCommit: receipt,
      actorResources: nextActorResources,
      teamResources: nextTeamResources,
      ...(plan.plannedMapRunFacts === undefined ? {} : { mapRunFacts: copyMapRunFacts(plan.plannedMapRunFacts) }),
      ...(plan.plannedMapRunStatuses === undefined ? {} : { mapRunStatuses: [...copyMapRunStatusInstances(plan.plannedMapRunStatuses)] }),
    };
    let nextRun: MutableMapRun;
    let successAtExit = false;
    if (plan.terminal === 'failure') {
      nextRun = { ...baseRun, activeEncounter: null, activeActivity: null, status: 'failure' };
    } else if (plan.terminal === 'victory') {
      const advanced = advanceCompletedActivity(
        currentSlot.definition,
        baseRun,
        currentEncounter.nodeId,
        currentEncounter.activityId,
        nextActivityRandomState(currentEncounter.randomState),
      );
      successAtExit = advanced.success;
      nextRun = { ...advanced.run, status: advanced.success ? 'success' : 'inProgress' };
    } else {
      const drawnEncounter = createEncounterSnapshot(
        currentSlot.definition,
        currentEncounter.nodeId,
        commitEncounterDef,
        currentSlot.run.party,
        nextActorResources,
        nextTeamResources,
        nextPartyHp,
        {
          round: currentEncounter.round + 1,
          randomState: currentEncounter.randomState,
          retainedEnemies: nextEnemyHp,
          retainedEnemyActorResources: nextEnemyActorResources,
          retainedEnemyTeamResources: nextEnemyTeamResources,
          activityId: currentEncounter.activityId,
          retainedLocals: plan.programReceiptVersion !== undefined ? plan.plannedLocals : currentEncounter.locals,
          retainedStatuses: plan.statusReceiptVersion !== undefined ? plan.plannedStatuses : currentEncounter.statuses,
          retainedEffectRandomState: plan.plannedEffectRandomState,
          retainedShields: plan.plannedShields,
          retainedCandidateSourceSnapshot: currentEncounter.candidateSourceSnapshot,
        },
      );
      nextRun = { ...baseRun, activeEncounter: { ...drawnEncounter, lastCommit: receipt } };
    }
    const snapshot = snapshotOf(nextRun);
    let nextSlot: MapRunSlot | null = { ...currentSlot, run: nextRun };
    let nextResult: MapRunSuccessResult | null = null;
    let nextFailureResult: MapRunFailureResult | null = null;
    let nextTerminalCommitReplay = this.terminalCommitReplay;
    if (plan.terminal === 'failure') {
      nextFailureResult = Object.freeze({
        runId: nextRun.runId,
        mapId: nextRun.mapId,
        outcome: 'failure',
        failedNodeId: currentEncounter.nodeId,
        reason: 'partyDefeated',
      });
      nextSlot = null;
      nextTerminalCommitReplay = { command: { ...command, draft: { ...command.draft } }, snapshot };
    }
    if (successAtExit) {
      nextResult = this.successResultFor(slot.definition, nextRun);
      nextSlot = null;
      nextTerminalCommitReplay = { command: { ...command, draft: { ...command.draft } }, snapshot };
    }
    return this.makePreparedEncounterCommit({
      snapshot,
      itemId: plan.item?.itemId ?? null,
      baseSlot: currentSlot,
      nextSlot,
      result: nextResult,
      failureResult: nextFailureResult,
      terminalCommitReplay: nextTerminalCommitReplay,
      replayed: false,
    });
  }

  /** Pure installability preflight for a previously prepared Commit. */
  canInstallPreparedEncounterCommit(prepared: PreparedMapRunEncounterCommit): boolean {
    const state = this.preparedEncounterCommits.get(prepared as object);
    return !!state && !state.installed && this.slot === state.baseSlot;
  }

  /** Installs a precomputed MapRun state with no parsing, planning, events, or callbacks. */
  installPreparedEncounterCommit(prepared: PreparedMapRunEncounterCommit): void {
    const state = this.preparedEncounterCommits.get(prepared as object)!;
    if (state.installed) return;
    if (state.replayed) {
      state.installed = true;
      return;
    }
    this.slot = state.nextSlot;
    this.result = state.result;
    this.failureResult = state.failureResult;
    this.terminalCommitReplay = state.terminalCommitReplay;
    state.installed = true;
  }

  private makePreparedEncounterCommit(input: Omit<PreparedMapRunEncounterCommitState, 'installed'>): PreparedMapRunEncounterCommit {
    const token = Object.freeze({ snapshot: input.snapshot, replayed: input.replayed, itemId: input.itemId });
    this.preparedEncounterCommits.set(token, { ...input, installed: false });
    return token;
  }

  /** Replaces one character's natural Hand-first Prepared Action with a free Hand item. */
  swapPreparedAction(
    runId: string,
    characterId: string,
    actionId: string,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.setActionOverride(runId, characterId, actionId, 'swap', expectedDraft);
  }

  /** Drafts a Hand-out Encounter candidate for exactly 1 PlayerCost at Commit. */
  issuePlayerCommand(
    runId: string,
    characterId: string,
    actionId: string,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.setActionOverride(runId, characterId, actionId, 'playerCommand', expectedDraft);
  }

  /** Drafts or clears one explicitly exposed Ability and its Encounter-local target. */
  setAbilityDraft(
    runId: string,
    actionId: string | null,
    target: MapRunEncounterSourceTarget | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    let abilityDraft: MapRunEncounterAbilityDraft | null = null;
    if (actionId === null) {
      if (target !== null) throw new MapRunError(['a cleared Ability draft cannot retain a target']);
    } else {
      const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
      const exposed = resolveNodeEncounter(node, encounter.activityId)?.abilityActionIds ?? [];
      if (!exposed.includes(actionId)) throw new MapRunError([`Ability Action "${actionId}" is not exposed by this Encounter`]);
      const action = actorlessSourceAction(slot, actionId, 'Ability');
      if (target !== null) validateSourceTarget(target, action, slot, 'Ability');
      const current = encounter.abilityDraft ?? null;
      const additionalTarget = current?.actionId === actionId && target !== null ? current.additionalTarget : null;
      if (additionalTarget !== null && target !== null
        && target.kind === additionalTarget.kind
        && ((target.kind === 'partyCharacter' && additionalTarget.kind === 'partyCharacter' && target.characterId === additionalTarget.characterId)
          || (target.kind === 'enemy' && additionalTarget.kind === 'enemy' && target.enemyId === additionalTarget.enemyId))) {
      abilityDraft = { actionId, target: target === null ? null : { ...target }, additionalTarget: null };
      } else {
        abilityDraft = { actionId, target: target === null ? null : { ...target }, additionalTarget };
      }
    }
    const current = encounter.abilityDraft ?? null;
    if (JSON.stringify(current) === JSON.stringify(abilityDraft)) return snapshotOf(slot.run);
    const { abilityDraft: _oldAbilityDraft, ...withoutAbilityDraft } = encounter;
    const nextEncounter = this.withDraftVersion({
      ...withoutAbilityDraft,
      ...(abilityDraft === null ? {} : { abilityDraft }),
    });
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  setAbilityAdditionalTarget(runId: string, target: MapRunEncounterSourceTarget | null,
    expectedDraft: MapRunEncounterDraftToken): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const current = encounter.abilityDraft;
    if (!current) throw new MapRunError(['an Ability must be selected before its additional target']);
    const action = actorlessSourceAction(slot, current.actionId, 'Ability');
    if (target !== null) validateAdditionalSourceTarget(target, action, current.target, slot, 'Ability');
    if (JSON.stringify(current.additionalTarget) === JSON.stringify(target)) return snapshotOf(slot.run);
    const nextEncounter = this.withDraftVersion({ ...encounter,
      abilityDraft: { ...current, additionalTarget: target === null ? null : { ...target } } });
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Drafts or clears one Encounter-mapped Item and its Encounter-local target. */
  setItemDraft(
    runId: string,
    itemId: string | null,
    target: MapRunEncounterSourceTarget | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    let itemDraft: MapRunEncounterItemDraft | null = null;
    if (itemId === null) {
      if (target !== null) throw new MapRunError(['a cleared Item draft cannot retain a target']);
    } else {
      const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
      const mappings = resolveNodeEncounter(node, encounter.activityId)?.itemActions ?? [];
      const mapping = mappings.find(candidate => candidate.itemId === itemId);
      if (!mapping) throw new MapRunError([`Item "${itemId}" is not mapped by this Encounter`]);
      const action = actorlessSourceAction(slot, mapping.actionId, 'Item');
      if (target !== null) validateSourceTarget(target, action, slot, 'Item');
      const current = encounter.itemDraft ?? null;
      const additionalTarget = current?.itemId === itemId && target !== null ? current.additionalTarget : null;
      const conflicts = target !== null && additionalTarget !== null && target.kind === additionalTarget.kind
        && ((target.kind === 'partyCharacter' && additionalTarget.kind === 'partyCharacter' && target.characterId === additionalTarget.characterId)
          || (target.kind === 'enemy' && additionalTarget.kind === 'enemy' && target.enemyId === additionalTarget.enemyId));
      itemDraft = { itemId, actionId: mapping.actionId, target: target === null ? null : { ...target },
        additionalTarget: conflicts ? null : additionalTarget };
    }
    const current = encounter.itemDraft ?? null;
    if (JSON.stringify(current) === JSON.stringify(itemDraft)) return snapshotOf(slot.run);
    const { itemDraft: _oldItemDraft, ...withoutItemDraft } = encounter;
    const nextEncounter = this.withDraftVersion({
      ...withoutItemDraft,
      ...(itemDraft === null ? {} : { itemDraft }),
    });
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  setItemAdditionalTarget(runId: string, target: MapRunEncounterSourceTarget | null,
    expectedDraft: MapRunEncounterDraftToken): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const current = encounter.itemDraft;
    if (!current) throw new MapRunError(['an Item must be selected before its additional target']);
    const action = actorlessSourceAction(slot, current.actionId, 'Item');
    if (target !== null) validateAdditionalSourceTarget(target, action, current.target, slot, 'Item');
    if (JSON.stringify(current.additionalTarget) === JSON.stringify(target)) return snapshotOf(slot.run);
    const nextEncounter = this.withDraftVersion({ ...encounter,
      itemDraft: { ...current, additionalTarget: target === null ? null : { ...target } } });
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Sets or clears one target choice without changing costs, Hand, round, or RNG. */
  setPreparedTarget(
    runId: string,
    characterId: string,
    targetCharacterId: string | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const preview = this.resolveActionPreview(slot);
    const prepared = preview.preparedActions.find(row => row.characterId === characterId);
    if (!prepared) throw new MapRunError([`Character "${characterId}" is not in the fixed party`]);
    if (targetCharacterId !== null && !prepared.legalTargetCharacterIds.includes(targetCharacterId)) {
      throw new MapRunError([`Target "${targetCharacterId}" is not legal for the Prepared Action of "${characterId}"`]);
    }

    const currentSelection = encounter.targetSelections.find(row => row.characterId === characterId);
    const needsStoredSelection = targetCharacterId !== null && prepared.targetKind === 'partyCharacter';
    const oldSecondaryCharacterId = currentSelection?.additionalTargetCharacterId;
    const oldSecondaryEnemyId = currentSelection?.additionalTargetEnemyId;
    const keepSecondaryCharacter = targetCharacterId !== null && oldSecondaryCharacterId !== undefined
      && oldSecondaryCharacterId !== targetCharacterId && prepared.additionalTargetKind === 'partyCharacter'
      && prepared.legalAdditionalTargetCharacterIds?.includes(oldSecondaryCharacterId);
    const keepSecondaryEnemy = targetCharacterId !== null && oldSecondaryEnemyId !== undefined
      && prepared.additionalTargetKind === 'enemy'
      && prepared.legalAdditionalTargetEnemyIds?.includes(oldSecondaryEnemyId);
    const nextTargetSelections = encounter.targetSelections.filter(row => row.characterId !== characterId);
    if (needsStoredSelection) nextTargetSelections.push({ characterId, targetCharacterId: targetCharacterId!,
      ...(keepSecondaryCharacter ? { additionalTargetCharacterId: oldSecondaryCharacterId } : {}),
      ...(keepSecondaryEnemy ? { additionalTargetEnemyId: oldSecondaryEnemyId } : {}) });
    nextTargetSelections.sort((left, right) =>
      slot.run.party.findIndex(member => member.characterId === left.characterId)
      - slot.run.party.findIndex(member => member.characterId === right.characterId),
    );

    const unchanged = currentSelection?.targetCharacterId === targetCharacterId
      || (currentSelection === undefined && !needsStoredSelection
        && (targetCharacterId === null || targetCharacterId === prepared.targetCharacterId));
    if (unchanged) return snapshotOf(slot.run);

    const nextEncounter = this.withDraftVersion({
      ...encounter,
      targetSelections: nextTargetSelections,
    });
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Sets or clears an Enemy target without exposing a GameCommands/UI command yet. */
  setPreparedEnemyTarget(
    runId: string,
    characterId: string,
    targetEnemyId: string | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const prepared = this.resolveActionPreview(slot).preparedActions.find(row => row.characterId === characterId);
    if (!prepared) throw new MapRunError([`Character "${characterId}" is not in the fixed party`]);
    const legalEnemyIds = prepared.legalTargetEnemyIds ?? [];
    if (prepared.targetKind !== 'enemy') throw new MapRunError([`Prepared Action for "${characterId}" does not target an Enemy`]);
    if (targetEnemyId !== null && !legalEnemyIds.includes(targetEnemyId)) {
      throw new MapRunError([`Enemy target "${targetEnemyId}" is not legal for the Prepared Action of "${characterId}"`]);
    }
    const currentSelection = encounter.targetSelections.find(row => row.characterId === characterId);
    const needsStoredSelection = targetEnemyId !== null;
    const oldSecondaryCharacterId = currentSelection?.additionalTargetCharacterId;
    const oldSecondaryEnemyId = currentSelection?.additionalTargetEnemyId;
    const keepSecondaryCharacter = targetEnemyId !== null && oldSecondaryCharacterId !== undefined
      && prepared.additionalTargetKind === 'partyCharacter'
      && prepared.legalAdditionalTargetCharacterIds?.includes(oldSecondaryCharacterId);
    const keepSecondaryEnemy = targetEnemyId !== null && oldSecondaryEnemyId !== undefined
      && oldSecondaryEnemyId !== targetEnemyId && prepared.additionalTargetKind === 'enemy'
      && prepared.legalAdditionalTargetEnemyIds?.includes(oldSecondaryEnemyId);
    const nextTargetSelections = encounter.targetSelections.filter(row => row.characterId !== characterId);
    if (needsStoredSelection) nextTargetSelections.push({ characterId, targetEnemyId: targetEnemyId!,
      ...(keepSecondaryCharacter ? { additionalTargetCharacterId: oldSecondaryCharacterId } : {}),
      ...(keepSecondaryEnemy ? { additionalTargetEnemyId: oldSecondaryEnemyId } : {}) });
    nextTargetSelections.sort((left, right) =>
      slot.run.party.findIndex(member => member.characterId === left.characterId)
      - slot.run.party.findIndex(member => member.characterId === right.characterId),
    );
    const unchanged = currentSelection?.targetEnemyId === targetEnemyId
      || (currentSelection === undefined && !needsStoredSelection
        && (targetEnemyId === null || targetEnemyId === prepared.targetEnemyId));
    if (unchanged) return snapshotOf(slot.run);

    const nextEncounter = this.withDraftVersion({ ...encounter, targetSelections: nextTargetSelections });
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  setPreparedAdditionalTarget(runId: string, characterId: string,
    target: MapRunEncounterSourceTarget | null, expectedDraft: MapRunEncounterDraftToken): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const preview = this.resolveActionPreview(slot);
    const prepared = preview.preparedActions.find(row => row.characterId === characterId);
    if (!prepared?.additionalTargetKind) throw new MapRunError([`Prepared Action for "${characterId}" has no additional target`]);
    const allowed = target === null ? [] : target.kind === 'partyCharacter'
      ? prepared.legalAdditionalTargetCharacterIds ?? [] : prepared.legalAdditionalTargetEnemyIds ?? [];
    if (target !== null && (target.kind !== prepared.additionalTargetKind
      || !(target.kind === 'partyCharacter' ? allowed.includes(target.characterId) : allowed.includes(target.enemyId)))) {
      throw new MapRunError([`Additional target is not legal for the Prepared Action of "${characterId}"`]);
    }
    const current = encounter.targetSelections.find(row => row.characterId === characterId);
    if (current?.targetCard) throw new MapRunError(['An additional target requires a unit primary target']);
    const primaryCharacterId = current?.targetCharacterId ?? (prepared.targetKind === 'partyCharacter' ? prepared.targetCharacterId : null);
    const primaryEnemyId = current?.targetEnemyId ?? (prepared.targetKind === 'enemy' ? prepared.targetEnemyId ?? null : null);
    if (primaryCharacterId === null && primaryEnemyId === null) throw new MapRunError(['An additional target requires a selected unit primary target']);
    const existing: MapRunEncounterSourceTarget | null = current?.additionalTargetCharacterId !== undefined
      ? { kind: 'partyCharacter', characterId: current.additionalTargetCharacterId }
      : current?.additionalTargetEnemyId !== undefined
        ? { kind: 'enemy', enemyId: current.additionalTargetEnemyId } : null;
    if (target === null && existing === null) return snapshotOf(slot.run);
    const nextRow = primaryCharacterId !== null
      ? { characterId, targetCharacterId: primaryCharacterId,
        ...(target?.kind === 'partyCharacter' ? { additionalTargetCharacterId: target.characterId } : {}),
        ...(target?.kind === 'enemy' ? { additionalTargetEnemyId: target.enemyId } : {}) }
      : { characterId, targetEnemyId: primaryEnemyId!,
        ...(target?.kind === 'partyCharacter' ? { additionalTargetCharacterId: target.characterId } : {}),
        ...(target?.kind === 'enemy' ? { additionalTargetEnemyId: target.enemyId } : {}) };
    if (target !== null && existing !== null && target.kind === existing.kind
      && (target.kind === 'partyCharacter'
        ? existing.kind === 'partyCharacter' && target.characterId === existing.characterId
        : existing.kind === 'enemy' && target.enemyId === existing.enemyId)) return snapshotOf(slot.run);
    const nextSelections = encounter.targetSelections.filter(row => row.characterId !== characterId).concat(nextRow)
      .sort((left, right) => slot.run.party.findIndex(member => member.characterId === left.characterId)
        - slot.run.party.findIndex(member => member.characterId === right.characterId));
    const nextEncounter = this.withDraftVersion({ ...encounter, targetSelections: nextSelections });
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Confirms one real card target through the same optimistic draft boundary as unit targets. */
  setPreparedCardTarget(runId: string, characterId: string, target: MapRunCardRef | null,
    expectedDraft: MapRunEncounterDraftToken): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const prepared = this.resolveActionPreview(slot).preparedActions.find(row => row.characterId === characterId);
    if (!prepared || prepared.targetKind !== 'card') throw new MapRunError(['Prepared Action does not accept a card target']);
    const parsed = target === null ? null : parseMapRunCardRef(target);
    const candidates = prepared.legalTargetCards ?? [];
    if (target !== null && (!parsed || !candidates.some(ref => mapRunCardKey(ref) === mapRunCardKey(parsed)))) {
      throw new MapRunError(['Card target is not a current legal candidate']);
    }
    const stored = encounter.targetSelections.find(row => row.characterId === characterId)?.targetCard;
    const needsSelection = parsed !== null && candidates.length > 1;
    if ((!stored && !needsSelection) || (stored && parsed && mapRunCardKey(stored) === mapRunCardKey(parsed))) return snapshotOf(slot.run);
    const selections = encounter.targetSelections.filter(row => row.characterId !== characterId);
    if (needsSelection) selections.push({ characterId, targetCard: parsed });
    selections.sort((a, b) => slot.run.party.findIndex(row => row.characterId === a.characterId)
      - slot.run.party.findIndex(row => row.characterId === b.characterId));
    const nextEncounter = this.withDraftVersion({ ...encounter, targetSelections: selections });
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Drops incoming references only when the domain card is gone, not when its DOM disappears. */
  private pruneRemovedCardTargets(slot: MapRunSlot, encounter: MapRunEncounterSnapshot): MapRunEncounterSnapshot {
    if (!encounter.targetSelections.some(row => row.targetCard)) return encounter;
    const withoutCardChoices = { ...encounter, targetSelections: encounter.targetSelections.filter(row => !row.targetCard) };
    const preview = this.resolveActionPreview(slot, withoutCardChoices);
    const cards = catalogMapRunCards({ ...slot.run, activeEncounter: encounter }, preview);
    const live = new Set(cards.map(card => mapRunCardKey(card.ref)));
    return { ...encounter, targetSelections: encounter.targetSelections.filter(row => !row.targetCard || live.has(mapRunCardKey(row.targetCard))) };
  }

  /** Clears one Character's Swap / PlayerCommand override and restores Hand-first preparation. */
  clearActionOverride(runId: string, characterId: string, expectedDraft: MapRunEncounterDraftToken): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    return this.clearActionOverrideForSlot(slot, characterId);
  }

  private clearActionOverrideForSlot(slot: MapRunSlot, characterId: string): MapRun {
    const encounter = slot.run.activeEncounter!;
    if (!encounter.overrides.some(override => override.characterId === characterId)) return snapshotOf(slot.run);

    const nextEncounter = this.pruneRemovedCardTargets(slot, this.withDraftVersion({
      ...encounter,
      overrides: encounter.overrides.filter(override => override.characterId !== characterId),
      targetSelections: encounter.targetSelections.filter(selection => selection.characterId !== characterId),
    }));
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  private setActionOverride(
    runId: string,
    characterId: string,
    actionId: string,
    kind: MapRunActionOverride['kind'],
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const preview = this.resolveActionPreview(slot);
    const prepared = preview.preparedActions.find(row => row.characterId === characterId);
    if (!prepared) throw new MapRunError([`Character "${characterId}" is not in the fixed party`]);

    if (kind === 'swap') {
      // Selecting the natural Action is observationally identical to having no override at all.
      if (actionId === prepared.naturalActionId) return this.clearActionOverrideForSlot(slot, characterId);
      if (!prepared.handActionIds.includes(actionId)) {
        throw new MapRunError(['Swap must choose another Action in the same Character Hand']);
      }
    } else {
      const option = preview.playerCommandOptions.find(row =>
        row.characterId === characterId && row.actionId === actionId,
      );
      if (!option) throw new MapRunError(['PlayerCommand must choose an Encounter candidate outside the current Hand']);
      if (!option.canPayPlayerCost) throw new MapRunError(['PlayerCommand requires 1 PlayerCost']);
      if (!option.canPayActionCosts) throw new MapRunError(['PlayerCommand Action resource costs are not payable']);
    }

    const existing = encounter.overrides.find(override => override.characterId === characterId);
    if (existing?.kind === kind && existing.actionId === actionId) return snapshotOf(slot.run);

    const partyOrder = new Map(slot.run.party.map((member, index) => [member.characterId, index]));
    const overrides = [
      ...encounter.overrides.filter(override => override.characterId !== characterId),
      { kind, characterId, actionId },
    ].sort((left, right) =>
      (partyOrder.get(left.characterId) ?? 0) - (partyOrder.get(right.characterId) ?? 0));

    const nextEncounter = this.pruneRemovedCardTargets(slot, this.withDraftVersion({
      ...encounter,
      overrides,
      targetSelections: encounter.targetSelections.filter(selection => selection.characterId !== characterId),
    }));
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  private resolveActionPreview(
    slot: MapRunSlot,
    encounter: MapRunEncounterSnapshot = slot.run.activeEncounter!,
  ): GameplayBActionPreview {
    try {
      return resolveGameplayBActionPreview({
        runId: slot.run.runId,
        definition: slot.definition,
        encounter,
        party: slot.run.party,
      partyHp: slot.run.partyHp,
        playerCost: slot.run.playerCost,
        actorResources: slot.run.actorResources,
        teamResources: slot.run.teamResources,
      });
    } catch (error) {
      throw new MapRunError(error instanceof Error ? [error.message] : [String(error)]);
    }
  }

  private requireEncounterDraft(runId: string, expectedDraft: MapRunEncounterDraftToken): MapRunSlot {
    const slot = this.requireActiveRun(runId);
    const encounter = slot.run.activeEncounter;
    if (encounter === null) throw new MapRunError(['there is no active Encounter to prepare']);
    if (!isRecord(expectedDraft)
      || expectedDraft.nodeId !== encounter.nodeId
      || (expectedDraft.activityId ?? null) !== (encounter.activityId ?? null)
      || expectedDraft.round !== encounter.round
      || !Number.isSafeInteger(expectedDraft.draftVersion)
      || expectedDraft.draftVersion !== encounter.draftVersion) {
      throw new MapRunError(['the Encounter action draft is stale']);
    }
    return slot;
  }

  private withDraftVersion(encounter: MapRunEncounterSnapshot): MapRunEncounterSnapshot {
    if (!Number.isSafeInteger(encounter.draftVersion) || encounter.draftVersion >= Number.MAX_SAFE_INTEGER) {
      throw new MapRunError(['the Encounter action draft version is exhausted']);
    }
    return { ...encounter, draftVersion: encounter.draftVersion + 1 };
  }

  private finishSuccess(definition: ResolvedMap, run: MutableMapRun): MapRun {
    const completedRun: MutableMapRun = run.mapRunStatuses === undefined
      ? run
      : { ...run, mapRunStatuses: [] };
    this.result = this.successResultFor(definition, completedRun);
    this.slot = null;
    return snapshotOf(completedRun);
  }

  private successResultFor(definition: ResolvedMap, run: MutableMapRun): MapRunSuccessResult {
    const exitNode = definition.nodes.find(node => node.id === run.currentNodeId);
    if (!exitNode || !definition.exitNodeIds.includes(exitNode.id)) {
      throw new MapRunError(['a successful MapRun must finish on a declared exit Node']);
    }
    return Object.freeze({
      runId: run.runId,
      mapId: run.mapId,
      outcome: 'success',
      exitNodeId: exitNode.id,
      mapName: definition.name,
      exitNodeTitle: exitNode.title,
    });
  }

  /** Creates a detached checkpoint without changing the active Run. */
  createSaveSnapshot(): MapRunSaveSnapshot | null {
    const slot = this.slot;
    const resumeVersion = slot?.definition.resumeVersion;
    if (!slot || slot.run.status !== 'inProgress') return null;
    if (!Number.isSafeInteger(resumeVersion) || resumeVersion! < 1) {
      throw new MapRunError(['the active Map has an invalid resumeVersion and cannot be checkpointed']);
    }
    return Object.freeze({
      mapId: slot.run.mapId,
      resumeVersion: resumeVersion!,
      run: snapshotOf(slot.run),
    });
  }

  /** Validates current Map content, then installs the saved private slot without replaying commands. */
  restoreSaveSnapshot(value: unknown): MapRunRestoreResult {
    if (value === null || value === undefined) return { status: 'none' };
    const candidateMapId = isRecord(value) && isNonEmptyId(value.mapId) ? value.mapId : null;
    if (!isRecord(value) || candidateMapId === null
      || !Number.isSafeInteger(value.resumeVersion) || (value.resumeVersion as number) < 1
      || !isRecord(value.run)) {
      return rejectRestore(candidateMapId, 'invalid-snapshot', 'MapRun checkpoint has an invalid header or run state');
    }
    if (this.slot) {
      return rejectRestore(candidateMapId, 'owner-not-empty', 'clear the current MapRun before restoring a checkpoint');
    }
    if (!this.resolveCharacterIdForVariant) {
      return rejectRestore(candidateMapId, 'invalid-run', 'MapRun checkpoint cannot be verified without a Registry Variant lookup');
    }

    let definition: ResolvedMap | null;
    try {
      definition = this.resolver.resolve(candidateMapId);
    } catch (error) {
      return rejectRestore(candidateMapId, 'invalid-content', 'Map content could not be resolved: '
        + (error instanceof Error ? error.message : String(error)));
    }
    if (!definition) {
      return rejectRestore(candidateMapId, 'unknown-map', 'Map is not available in the current Registry: ' + candidateMapId);
    }
    if (definition.id !== candidateMapId || !Number.isSafeInteger(definition.resumeVersion) || definition.resumeVersion < 1) {
      return rejectRestore(candidateMapId, 'invalid-content', 'resolved Map content has an invalid identity or resumeVersion');
    }
    if (definition.resumeVersion !== value.resumeVersion) {
      return rejectRestore(candidateMapId, 'content-version-mismatch', 'Map resumeVersion changed from '
        + String(value.resumeVersion) + ' to ' + String(definition.resumeVersion));
    }

    let run: MutableMapRun | null;
    try {
      run = restoreRunState(value.run, definition, candidateMapId, this.resolveCharacterIdForVariant);
    } catch {
      run = null;
    }
    if (!run) {
      return rejectRestore(candidateMapId, 'invalid-run', 'MapRun checkpoint state does not match the current Map');
    }
    advanceRunSequence(run.runId);
    if (run.partyHp.every(row => row.currentHp === 0)) {
      this.result = null;
      this.failureResult = Object.freeze({
        runId: run.runId,
        mapId: run.mapId,
        outcome: 'failure',
        failedNodeId: run.currentNodeId,
        reason: 'partyDefeated',
      });
      this.terminalCommitReplay = null;
      return { status: 'failed', mapId: candidateMapId, runId: run.runId, reason: 'partyDefeated' };
    }
    this.slot = { definition, run };
    this.result = null;
    this.failureResult = null;
    this.terminalCommitReplay = null;
    return { status: 'restored', mapId: candidateMapId, runId: run.runId };
  }

  move(runId: string, targetNodeId: string): MapRun {
    const slot = this.requireActiveRun(runId);
    const { run } = slot;
    if (run.activeEncounter !== null) {
      throw new MapRunError(['Map movement is unavailable while an Encounter is active']);
    }
    if (run.activeActivity !== null) {
      throw new MapRunError(['Map movement is unavailable while a Node activity is in progress']);
    }
    const node = slot.definition.nodes.find(candidate => candidate.id === targetNodeId);
    if (!node) throw new MapRunError([`unknown target Node "${targetNodeId}"`]);
    const edge = slot.definition.edges.find(candidate =>
      candidate.fromNodeId === run.currentNodeId && candidate.toNodeId === targetNodeId,
    );
    if (!edge) {
      throw new MapRunError([`Node "${targetNodeId}" is not reachable from current Node "${run.currentNodeId}"`]);
    }
    if (edge.condition !== undefined && !isGameplayMapEdgeConditionSatisfied(edge.condition, run)) {
      throw new MapRunError([`Edge to Node "${targetNodeId}" requires an unsatisfied MapRun condition`]);
    }

    const alreadyVisited = run.visitedNodeIds.includes(targetNodeId);
    const alreadyCompleted = run.completedEncounterNodeIds.includes(targetNodeId);
    const entered: EnteredNodeState = alreadyCompleted
      ? { activeActivity: null, activeEncounter: null }
      : openNodeContent(
        slot.definition,
        node,
        run.party,
        run.actorResources,
        run.teamResources,
        run.partyHp,
        run.completedActivityIds,
        0,
        undefined,
        run.mapRunFacts,
      );
    const blocked = entered.activeActivity !== null || entered.activeEncounter !== null;
    const next: MutableMapRun = {
      ...run,
      currentNodeId: targetNodeId,
      visitedNodeIds: alreadyVisited ? [...run.visitedNodeIds] : [...run.visitedNodeIds, targetNodeId],
      completedEncounterNodeIds: [...run.completedEncounterNodeIds],
      activeActivity: entered.activeActivity,
      activeEncounter: entered.activeEncounter,
      status: !blocked && slot.definition.exitNodeIds.includes(targetNodeId) ? 'success' : 'inProgress',
    };
    if (next.status === 'success') return this.finishSuccess(slot.definition, next);
    this.slot = { ...slot, run: next };
    return snapshotOf(next);
  }

  completeEncounter(runId: string): MapRun {
    const slot = this.requireActiveRun(runId);
    const { run } = slot;
    const encounter = run.activeEncounter;
    if (!encounter) throw new MapRunError(['there is no active Encounter to complete']);
    if (encounter.nodeId !== run.currentNodeId) {
      throw new MapRunError(['active Encounter does not match the current Node']);
    }
    const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
    const encounterDef = resolveNodeEncounter(node, encounter.activityId);
    if (!node || !encounterDef) {
      throw new MapRunError(['active Encounter does not match the current Node']);
    }
    if ((encounterDef.enemies?.length ?? 0) > 0) {
      throw new MapRunError(['Battle Encounters cannot be completed manually']);
    }
    if (encounterDef.rounds !== undefined) {
      throw new MapRunError(['finite-round Encounter ends through its own round count, not manual completion']);
    }
    if (encounterDef.completion?.kind !== 'manual') {
      throw new MapRunError(['the active Encounter does not declare a manual completion action']);
    }

    const advanced = advanceCompletedActivity(slot.definition, run, encounter.nodeId, encounter.activityId);
    const next: MutableMapRun = {
      ...advanced.run,
      status: advanced.success ? 'success' : 'inProgress',
    };
    if (next.status === 'success') return this.finishSuccess(slot.definition, next);
    this.slot = { ...slot, run: next };
    return snapshotOf(next);
  }

  /** Atomically charges shared Team costs and applies one Shop offer's effects. */
  purchaseShopOffer(
    runId: string,
    offerId: string,
    requestId: string,
    expectedDraft: MapRunShopDraftToken,
  ): MapRun {
    if (!isNonEmptyId(offerId) || !isNonEmptyId(requestId)) {
      throw new MapRunError(['the Shop purchase request is malformed']);
    }
    const slot = this.requireActiveRun(runId);
    const currentActivity = slot.run.activeActivity;
    if (!currentActivity || currentActivity.kind !== 'shop') {
      throw new MapRunError(['there is no active Shop activity to interact with']);
    }
    // A retry of the same request stays idempotent even though the draft advanced.
    const previous = currentActivity.lastPurchase;
    if (previous?.requestId === requestId) {
      if (previous.offerId !== offerId
        || !isRecord(expectedDraft)
        || expectedDraft.nodeId !== currentActivity.nodeId
        || expectedDraft.activityId !== currentActivity.activityId) {
        throw new MapRunError(['the Shop purchase request ID was already used with different input']);
      }
      return snapshotOf(slot.run);
    }
    const activity = this.requireShopDraft(slot, expectedDraft);
    const shop = resolveNodeShop(
      slot.definition.nodes.find(candidate => candidate.id === activity.nodeId),
      activity.activityId,
    );
    const offer = shop?.offers.find(candidate => candidate.id === offerId);
    if (!offer) throw new MapRunError([`Shop offer "${offerId}" is not available in this activity`]);
    if (previous !== null && previous.resultingDraftVersion !== activity.shopDraftVersion) {
      throw new MapRunError(['the Shop purchase receipt does not match the current draft']);
    }

    const costs = freezeShopCosts(offer);
    const effects = freezeShopEffects(offer);
    const teamBalances = new Map(slot.run.teamResources.map(row => [row.resourceId, row.value]));
    for (const cost of costs) {
      const balance = teamBalances.get(cost.resourceId);
      if (balance === undefined) throw new MapRunError([`Shop offer "${offerId}" costs an undeclared Team resource`]);
      if (balance < cost.amount) throw new MapRunError([`Shop offer "${offerId}" cannot be paid from "${cost.resourceId}"`]);
      teamBalances.set(cost.resourceId, balance - cost.amount);
    }
    for (const effect of effects) {
      const balance = teamBalances.get(effect.resourceId);
      if (balance === undefined) throw new MapRunError([`Shop offer "${offerId}" grants an undeclared Team resource`]);
      const after = balance + effect.amount;
      if (!Number.isSafeInteger(after) || after < 0) {
        throw new MapRunError([`Shop offer "${offerId}" would leave an invalid balance for "${effect.resourceId}"`]);
      }
      teamBalances.set(effect.resourceId, after);
    }

    let heal: MapRunShopPurchaseReceipt['heal'] = null;
    let partyHp = slot.run.partyHp;
    if (offer.heal !== undefined) {
      const cap = partyHpCaps(slot.definition, slot.run.party).get(offer.heal.characterId);
      const row = partyHp.find(candidate => candidate.characterId === offer.heal!.characterId);
      if (cap === undefined || !row) throw new MapRunError([`Shop offer "${offerId}" heals an unknown party member`]);
      if (row.currentHp <= 0) throw new MapRunError([`Shop offer "${offerId}" cannot revive a downed party member`]);
      const restored = Math.max(0, Math.min(offer.heal.amount, cap - row.currentHp));
      partyHp = partyHp.map(candidate => candidate.characterId === row.characterId
        ? { ...candidate, currentHp: candidate.currentHp + restored }
        : candidate);
      heal = { characterId: offer.heal.characterId, amount: offer.heal.amount, restored };
    }
    if (activity.shopDraftVersion >= Number.MAX_SAFE_INTEGER) {
      throw new MapRunError(['the Shop draft version is exhausted']);
    }

    const receipt: MapRunShopPurchaseReceipt = {
      requestId,
      offerId,
      nodeId: activity.nodeId,
      activityId: activity.activityId,
      resultingDraftVersion: activity.shopDraftVersion + 1,
      costs,
      effects,
      heal,
    };
    const nextRun: MutableMapRun = {
      ...slot.run,
      partyHp,
      teamResources: slot.run.teamResources.map(row => ({
        ...row,
        value: teamBalances.get(row.resourceId) ?? row.value,
      })),
      activeActivity: {
        ...activity,
        shopDraftVersion: activity.shopDraftVersion + 1,
        lastPurchase: receipt,
      },
    };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Ends the active Shop activity and advances the Node's fixed activity order. */
  leaveShop(runId: string, expectedDraft: MapRunShopDraftToken): MapRun {
    const slot = this.requireActiveRun(runId);
    const activity = this.requireShopDraft(slot, expectedDraft);
    const advanced = advanceCompletedActivity(slot.definition, slot.run, activity.nodeId, activity.activityId);
    const next: MutableMapRun = {
      ...advanced.run,
      status: advanced.success ? 'success' : 'inProgress',
    };
    if (next.status === 'success') return this.finishSuccess(slot.definition, next);
    this.slot = { ...slot, run: next };
    return snapshotOf(next);
  }

  private requireShopDraft(slot: MapRunSlot, expectedDraft: MapRunShopDraftToken): MapRunActiveActivity {
    const activity = slot.run.activeActivity;
    if (!activity || activity.kind !== 'shop') {
      throw new MapRunError(['there is no active Shop activity to interact with']);
    }
    if (!isRecord(expectedDraft)
      || Object.keys(expectedDraft).length !== 3
      || Object.keys(expectedDraft).some(key => !['nodeId', 'activityId', 'draftVersion'].includes(key))
      || expectedDraft.nodeId !== activity.nodeId
      || expectedDraft.activityId !== activity.activityId
      || !Number.isSafeInteger(expectedDraft.draftVersion)
      || (expectedDraft.draftVersion as number) !== activity.shopDraftVersion) {
      throw new MapRunError(['the Shop draft is stale']);
    }
    return activity;
  }

  private requireActiveRun(runId: string): MapRunSlot {
    const slot = this.slot;
    if (!slot || slot.run.runId !== runId) throw new MapRunError([`unknown MapRun ID "${runId}"`]);
    if (slot.run.status !== 'inProgress') throw new MapRunError(['the MapRun is already complete']);
    return slot;
  }
}
