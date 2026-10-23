import type { Datapack } from '../../data-services/contracts/datapack';
import type {
  GameplayEncounterDef,
  GameplayMapActionDef,
  GameplayMapActivityDef,
  GameplayMapNodeDef,
} from '../../data-services/contracts/gameplay-map';
import type { GameplayMapEffectConditionDef } from '../../data-services/contracts/gameplay-map-effects';
import { normalizeMapActionEffects } from '../../data-services/normalization/gameplay-map-effect-program';
// ============================================================
// arona-clicker/runtime-game-instance.ts — AronaClicker Runtime（组合根 + 门面）
//
// 子系统装配细节在 runtime-wiring.ts（构造器只保留 wire 调用与私有钩子）；
// story / spot / init / item / enhancement / charaProfile / pic 门面
// 以只读别名直接暴露对应服务（game.story.* 等），编排类方法
// （init / tick / travelToArea / 存档 / Extra）保留在本体。
// ============================================================

import {
  AreaId,
  ExtraCompound,
  ExtraPath,
  ExtraValue,
} from '../../engine/types/index';
import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { PlayerState } from '../types/state';
import type { GameView, StoryView } from '../contracts/index';
import type { RuntimeAreaTopologyConnection } from '../contracts/runtime/runtime-content';
import type { TickResult } from '../../engine/contracts/tick';
import type { TravelResult } from '../contracts/runtime/results';
import { StoryService } from '../services/story/story-service';
import { SpotService } from '../services/world/spot-service';
import { InitService } from '../services/world/init-service';
import { ItemService } from '../services/economy/item-service';
import { EnhancementService } from '../services/progression/enhancement-service';
import { SessionService } from '../../engine/runtime/session-service';
import { ChatFlowService } from '../services/story/chat-flow-service';
import { buildGameView } from '../read-model/game-view-builder';
import { buildAchievementView } from '../read-model/achievement-view';
import type { AchievementViewItem } from '../read-model/achievement-view';
import { OperationObservationStore } from '../services/operation/operation-observation';
import type { OperationObservation, OperationObservationInput } from '../contracts/operation/operation-observation';
import type { MapEntryPartyMemberView, MapEntryView } from '../contracts/map/map-entry';
import type {
  MapRun,
  MapRunEncounterCommitCommand,
  MapRunEncounterDraftToken,
  MapRunPartyMember,
  MapRunEncounterSourcePreview,
  MapRunEncounterSourceTarget,
  MapRunCardEffectModifierReceipt,
  MapRunShopDraftToken,
} from '../contracts/map/map-run';
import type {
  MapEncounterQueryView,
  MapRunEncounterWorkspaceView,
  MapRunQuery,
  MapRunFailureWorkspaceView,
  MapRunWorkspaceView,
  MapWorkspaceActionView,
  MapWorkspaceActivityView,
  MapWorkspaceEdgeView,
  MapWorkspaceNodeView,
  MapWorkspaceShopView,
} from '../contracts/runtime/runtime';
import { OperationRuntimeService } from '../services/operation/operation-runtime-service';
import { createOperationEntry } from '../services/operation/operation-entry-service';
import type { OperationEntryFacade } from '../services/operation/operation-entry-service';
import { createRegistryOperationContentResolver } from '../services/operation/registry-operation-content-resolver';
import { MapRunError, MapRunService } from '../services/map/map-run-service';
import { isGameplayMapEdgeConditionSatisfied } from '../services/map/map-edge-conditions';
import { projectMapRelations } from '../services/map/map-relation-projector';
import { summarizeMapActionEffects, type MapEffectSummaryContext } from '../services/map/map-effect-summary';
import { copyMapEncounterStatusInstances, copyMapRunStatusInstances } from '../services/map/map-encounter-statuses';
import type { MapRelationScope, MapTargetRef, MapUnitRef } from '../contracts/map/map-relations';
import type { MapEffectLocalsState, MapEffectShieldTraceEntry, MapEffectStatusCategoryRemoveTraceEntry, MapEffectStatusConsumeTraceEntry, MapEffectStatusExpiryTriggerTraceEntry, MapEffectStatusDamageTriggerTraceEntry, MapEffectStatusRemoveTraceEntry, MapEffectStatusTickTraceEntry, MapEffectTraceEntry, MapEffectTriggerTraceEntry } from '../contracts/map/map-effects';
import type { MapRunCardRef } from '../contracts/map/map-cards';
import { mapRunCardKey, parseMapRunCardRef } from '../services/map/map-card-catalog';
import type { GameplayBActionPreview } from '../services/map/gameplay-b-action-preview-resolver';
import { createRegistryMapContentResolver } from '../services/map/registry-map-content-resolver';
import type { MapContentResolver } from '../contracts/map/map-content-resolver';
import { createDefaultState as createDefaultPlayerState } from '../state/state-factory';
import { buildSaveData } from './runtime-save-codec';
import { restoreFromSave } from './runtime-save';
import { recheckStudentBlocks as recheckBlocks, reloadRuntime, resetRuntime } from './runtime-reset';
import { wireGameInstance } from './runtime-wiring';

import { extra, getAtPath, mergeExtra, setAtPath } from '../../engine/extra/index';
import { ImageStore } from '../../data-services/assets/image-store';
import { hasExistenceGate } from '../../engine/visibility/reveal';
import { Registry } from '../../data-services/registry/registry';
import { createRuntimeContentBrowser } from '../../data-services/registry/runtime-content-browser';
import type { RuntimeContentBrowserQueryPort } from '../../data-services/contracts/runtime-content-browser';
import type { WorldCatalogQueryPort } from '../contracts/world/world-catalog';
import { EventBus } from '../../engine/core/event-bus';
import { ValueSystem } from '../../engine/expression/value-system';
import { ConditionSystem } from '../../engine/expression/condition-system';
import { FuncletExecutor } from '../../engine/expression/funclet-executor';
import { EffectEngine } from '../../engine/effect/effect-engine';
import { TickSystem } from '../../engine/system/tick-system';
import { LootSystem } from '../services/economy/loot-system';
import { VisibilityEngine } from '../../engine/visibility/visibility-engine';
import { StateMutationService } from '../state/state-mutation-service';
import { AffectorEngine } from '../../engine/effect/affector-engine';
import { DevLog, DevLogEntry, DevLogOptions } from '../../engine/core/dev-log';
import { StatsService } from '../../engine/stats/stats';
import { SpotFunctionalitySystem } from '../services/world/spot-functionality';
import { GameNumSystem } from '../../engine/expression/game-num';
import { TriggerSystem } from '../../engine/effect/trigger-system';

import { CharacterSystem } from '../services/character/character-system';
import { RosterSystem } from '../services/character/roster-system';
import { CharacterAvailabilityService } from '../services/character/character-availability';
import { ColorSystem } from '../services/progression/color-system';
import type { EntityPresentationQueryPort } from '../contracts/presentation/entity-presentation-query';
import { ColorEquipmentSystem } from '../services/progression/color-equipment-system';
import { GearSystem } from '../services/progression/gear-system';
import { GachaService } from '../services/economy/gacha-service';
import { TagStatService } from '../../engine/stats/tag-stats';
import { PassivePoolSystem } from '../services/economy/passive-pool-system';
import { CharaProfileService } from '../services/character/chara-profile-service';
import { PicService } from '../../data-services/assets/pic-service';
import { UserThemeService } from '../services/presentation/user-theme-service';
import { ShopService } from '../services/economy/shop-service';
import type { StoryFollowUpMount } from '../services/story/story-follow-up-mount';
import { AreaMapQuery } from '../services/world/area-map-query';
import { AreaTravelGraph } from '../services/world/area-travel-routes';

import type { SaveData } from '../contracts/runtime/save-data';
import { clearTagResidueByMod, summarizeTagResidue, type TagOverrideResidue } from '../state/tag-residue';
import type { SaveBuildContext } from '../contracts/runtime/save-codec';
import type { GameInstanceOptions } from './runtime-options';
export type { SaveData };

export interface RuntimeInitOptions {
  /** Whether loading the registry should also enter the first visible Init. */
  enterDefaultInit?: boolean;
}

/** Resolves a Node's Encounter or one ordered activity Encounter. */
function resolveMapEncounterDef(
  node: GameplayMapNodeDef | undefined,
  activityId?: string,
): GameplayEncounterDef | null {
  if (!node) return null;
  const activities = node.activities ?? [];
  if (activities.length === 0) return activityId === undefined ? node.encounter ?? null : null;
  if (activityId === undefined) return null;
  return activities.find(activity => activity.id === activityId)?.encounter ?? null;
}

function mapActivityTitle(activity: GameplayMapActivityDef): string {
  return activity.title ?? activity.encounter?.title ?? activity.shop?.title ?? activity.id;
}

function mapNodeActivityTitles(node: GameplayMapNodeDef): readonly string[] {
  return Object.freeze((node.activities ?? []).map(mapActivityTitle));
}

function cloneMapEffectCondition(condition: GameplayMapEffectConditionDef): GameplayMapEffectConditionDef {
  if (condition.kind === 'not') {
    return Object.freeze({ kind: 'not', condition: cloneMapEffectCondition(condition.condition) });
  }
  if (condition.kind === 'all' || condition.kind === 'any') {
    return Object.freeze({ kind: condition.kind, conditions: Object.freeze(condition.conditions.map(cloneMapEffectCondition)) });
  }
  return Object.freeze({ ...condition });
}

function cloneMapEffectLocals(locals: MapEffectLocalsState): MapEffectLocalsState {
  const counters = Object.fromEntries(Object.entries(locals.counters)
    .map(([id, value]) => [id, Object.freeze({ ...value })]));
  return Object.freeze({
    counters: Object.freeze(counters),
    flags: Object.freeze({ ...locals.flags }),
  });
}

function freezeMapEffectStatusRemoveTrace(entry: MapEffectStatusRemoveTraceEntry): MapEffectStatusRemoveTraceEntry {
  return Object.freeze({
    ...entry,
    ...(entry.source === undefined ? {} : { source: Object.freeze({ ...entry.source }) }),
    identity: Object.freeze({ ...entry.identity }),
    removed: Object.freeze(entry.removed.map(row => Object.freeze({
      statusIndexBefore: row.statusIndexBefore,
      status: Object.freeze({
        ...row.status,
        holder: Object.freeze({ ...row.status.holder }),
        source: Object.freeze({ ...row.status.source }),
      }),
    }))),
  });
}

function freezeMapEffectStatusConsumeTrace(entry: MapEffectStatusConsumeTraceEntry): MapEffectStatusConsumeTraceEntry {
  const copyStatus = (status: MapEffectStatusConsumeTraceEntry['changes'][number]['statusBefore']) => Object.freeze({
    ...status,
    holder: Object.freeze({ ...status.holder }),
    source: Object.freeze({ ...status.source }),
  });
  return Object.freeze({
    ...entry,
    ...(entry.source === undefined ? {} : { source: Object.freeze({ ...entry.source }) }),
    identity: Object.freeze({ ...entry.identity }),
    changes: Object.freeze(entry.changes.map(change => Object.freeze({
      ...change,
      statusBefore: copyStatus(change.statusBefore),
      statusAfter: change.statusAfter === null ? null : copyStatus(change.statusAfter),
    }))),
  });
}

function freezeMapEffectStatusCategoryRemoveTrace(entry: MapEffectStatusCategoryRemoveTraceEntry): MapEffectStatusCategoryRemoveTraceEntry {
  return Object.freeze({
    ...entry,
    ...(entry.source === undefined ? {} : { source: Object.freeze({ ...entry.source }) }),
    identity: Object.freeze({ ...entry.identity }),
    removed: Object.freeze(entry.removed.map(row => Object.freeze({
      statusIndexBefore: row.statusIndexBefore,
      status: Object.freeze({
        ...row.status,
        holder: Object.freeze({ ...row.status.holder }),
        source: Object.freeze({ ...row.status.source }),
      }),
    }))),
  });
}

function freezeMapEffectTrace(entry: MapEffectTraceEntry): MapEffectTraceEntry {
  const damageProtection = entry.op === 'damage' && entry.damageProtection ? Object.freeze({
    ...entry.damageProtection,
    statusBefore: Object.freeze({
      ...entry.damageProtection.statusBefore,
      holder: Object.freeze({ ...entry.damageProtection.statusBefore.holder }),
      source: Object.freeze({ ...entry.damageProtection.statusBefore.source }),
    }),
    statusAfter: entry.damageProtection.statusAfter === null ? null : Object.freeze({
      ...entry.damageProtection.statusAfter,
      holder: Object.freeze({ ...entry.damageProtection.statusAfter.holder }),
      source: Object.freeze({ ...entry.damageProtection.statusAfter.source }),
    }),
  }) : undefined;
  return Object.freeze({
    ...entry,
    ...(entry.source === undefined ? {} : { source: Object.freeze({ ...entry.source }) }),
    ...('identity' in entry && entry.identity ? { identity: Object.freeze({ ...entry.identity }) } : {}),
    ...('batch' in entry && entry.batch ? { batch: Object.freeze({ ...entry.batch }) } : {}),
    ...('selector' in entry && entry.selector ? { selector: Object.freeze({ ...entry.selector }) } : {}),
    ...('identities' in entry ? { identities: Object.freeze(entry.identities.map(identity => Object.freeze({ ...identity }))) } : {}),
    ...('reads' in entry ? { reads: Object.freeze(entry.reads.map(read => Object.freeze({ ...read,
      ...('identity' in read && read.identity ? { identity: Object.freeze({ ...read.identity }) } : {}),
    }))) } : {}),
    ...(damageProtection === undefined ? {} : { damageProtection }),
  }) as MapEffectTraceEntry;
}

function freezeMapEffectShieldTrace(entry: MapEffectShieldTraceEntry): MapEffectShieldTraceEntry {
  return Object.freeze({
    ...entry,
    ...(entry.source === undefined ? {} : { source: Object.freeze({ ...entry.source }) }),
    identity: Object.freeze({ ...entry.identity }),
  });
}

function freezeMapEffectTriggerTrace(entry: MapEffectTriggerTraceEntry): MapEffectTriggerTraceEntry {
  if (entry.event === 'enemyDefeated') return Object.freeze({
    ...entry,
    target: Object.freeze({ kind: 'enemy' as const, id: entry.target.id }),
    rewardRecipient: Object.freeze({ kind: 'partyCharacter' as const, id: entry.rewardRecipient.id }),
  });
  return Object.freeze({ ...entry, target: Object.freeze({ ...entry.target }) });
}

function freezeMapEffectStatusExpiryTriggerTrace(entry: MapEffectStatusExpiryTriggerTraceEntry): MapEffectStatusExpiryTriggerTraceEntry {
  return Object.freeze({
    ...entry,
    status: Object.freeze({
      ...entry.status,
      holder: Object.freeze({ ...entry.status.holder }),
      source: Object.freeze({ ...entry.status.source }),
    }),
    holder: Object.freeze({ ...entry.holder }),
  });
}

function freezeMapEffectStatusDamageTriggerTrace(entry: MapEffectStatusDamageTriggerTraceEntry): MapEffectStatusDamageTriggerTraceEntry {
  return Object.freeze({ ...entry,
    status: Object.freeze({ ...entry.status, holder: Object.freeze({ ...entry.status.holder }), source: Object.freeze({ ...entry.status.source }) }),
    holder: Object.freeze({ ...entry.holder }),
  });
}

function freezeCardEffectModifierReceipt(entry: MapRunCardEffectModifierReceipt): MapRunCardEffectModifierReceipt {
  return Object.freeze({
    ...entry,
    sourceCardRef: Object.freeze({ ...parseMapRunCardRef(entry.sourceCardRef)!, scope: Object.freeze({ ...entry.sourceCardRef.scope }) }),
    targetCardRef: Object.freeze({ ...parseMapRunCardRef(entry.targetCardRef)!, scope: Object.freeze({ ...entry.targetCardRef.scope }) }),
    hits: Object.freeze(entry.hits.map(hit => Object.freeze({
      ...hit,
      identity: Object.freeze({ ...hit.identity }),
      ...(hit.batch === undefined ? {} : { batch: Object.freeze({ ...hit.batch }) }),
    }))),
  });
}

function relationUnit(scope: MapRelationScope, kind: MapUnitRef['kind'], id: string): MapUnitRef {
  return Object.freeze({ scope, kind, id });
}

function relationTarget(
  scope: MapRelationScope,
  target: MapRunEncounterSourceTarget | null | undefined,
  targetCard?: MapRunCardRef | null,
): MapTargetRef | null {
  if (targetCard) return targetCard;
  if (!target) return null;
  return target.kind === 'partyCharacter'
    ? relationUnit(scope, 'partyCharacter', target.characterId)
    : relationUnit(scope, 'enemy', target.enemyId);
}

function summarizeProgramAction(
  action: GameplayMapActionDef,
  context: MapEffectSummaryContext,
) {
  if (action.effectProgram === undefined) return undefined;
  try {
    return summarizeMapActionEffects(normalizeMapActionEffects(action), context);
  } catch {
    return undefined;
  }
}

function isActorlessSourceOptionAction(action: GameplayMapActionDef): boolean {
  if (action.eligibleCharacterIds.length !== 0
    || (action.target.kind !== 'partyCharacter' && action.target.kind !== 'enemy')
    || (action.costs?.length ?? 0) > 0 || action.effectProgram === undefined) return false;
  try {
    const effects = normalizeMapActionEffects(action);
    if (effects.prepare.length > 0) return false;
    const referencesActorlessSource = (instructions: typeof effects.resolve): boolean => instructions.some(instruction => {
      if (instruction.op === 'hpChange' && instruction.target === 'source') return true;
      if (instruction.op === 'resourceChange' && instruction.account === 'sourceActor') return true;
      return instruction.op === 'when'
        && (referencesActorlessSource(instruction.then) || referencesActorlessSource(instruction.else ?? []));
    });
    return !referencesActorlessSource(effects.resolve);
  } catch {
    return false;
  }
}

function mapActivityKind(activity: GameplayMapActivityDef): MapWorkspaceActivityView['kind'] {
  if (activity.shop !== undefined) return 'shop';
  const encounter = activity.encounter;
  if (!encounter) return 'encounter';
  if ((encounter.enemies?.length ?? 0) > 0) return 'battle';
  return Number.isSafeInteger(encounter.rounds) ? 'rest' : 'encounter';
}

/**
 * GameInstance 是游戏的核心运行时管理器。
 * 它组装所有引擎子系统并暴露统一的 API 给 UI 层。
 */
export class GameInstance {
  // 子系统（构造期由 game/wiring.ts 装配赋值）
  readonly eventBus!: EventBus;
  readonly registry!: Registry;
  readonly areaMap = new AreaMapQuery({
    registry: () => this.registry, state: () => this._state,
    conditions: () => this.conditionSystem, travelStatus: areaId => this.getAreaTravelStatus(areaId),
    travelQuery: () => this.initService.createAreaTravelQuery(),
    connections: () => this.getAreaTravelGraph(),
  });
  /** Read-only snapshot/query facade over the currently loaded effective Registry. */
  readonly runtimeContentBrowser: RuntimeContentBrowserQueryPort;
  get world(): WorldCatalogQueryPort { return this.registry; }
  readonly valueSystem!: ValueSystem;
  readonly conditionSystem!: ConditionSystem;
  readonly funcletExecutor!: FuncletExecutor;
  readonly effectEngine!: EffectEngine;
  readonly tickSystem!: TickSystem;
  readonly lootSystem!: LootSystem;
  readonly visibilityEngine!: VisibilityEngine;
  readonly characterSystem!: CharacterSystem;
  readonly rosterSystem!: RosterSystem;
  readonly availabilityService!: CharacterAvailabilityService;
  readonly colorSystem!: ColorSystem;
  readonly entityPresentation!: EntityPresentationQueryPort;
  readonly colorEquipmentSystem!: ColorEquipmentSystem;
  readonly gearSystem!: GearSystem;
  readonly gachaService!: GachaService;
  readonly tagStatService!: TagStatService;
  readonly passivePoolSystem!: PassivePoolSystem;
  readonly mutations!: StateMutationService;
  readonly affectorEngine!: AffectorEngine;
  readonly devLog!: DevLog;
  readonly statsService!: StatsService;
  readonly spotFunctionalitySystem!: SpotFunctionalitySystem;
  readonly gameNumSystem!: GameNumSystem;
  readonly triggerSystem!: TriggerSystem;
  readonly storyService!: StoryService;
  /** StoryFollowUp 只读运行时诊断投影。 */
  readonly storyFollowUps!: StoryFollowUpMount;
  readonly spotService!: SpotService;
  readonly initService!: InitService;
  readonly itemService!: ItemService;
  readonly enhancementService!: EnhancementService;
  readonly sessionService!: SessionService;
  /** 聊天流演出服务（Talklet 专用）：clearAllChatFlow / showChatText / clearIdChatFlow 的运行时桥。 */
  readonly chatFlowService!: ChatFlowService;
  /** 图片存储：Mod 压缩包解出的本地图片（UI 导入流程填充；见 pics.urlOf）。 */
  readonly imageStore!: ImageStore;
  /** Chara 头像-人名对服务（game.charaProfiles 门面）。 */
  readonly charaProfileService!: CharaProfileService;
  /** 图片资产服务（game.pics 门面）。 */
  readonly picService!: PicService;
  readonly userThemeService!: UserThemeService;
  /** Spot 商店交易门面。 */
  readonly shopService!: ShopService;
  /** Gameplay B 的 ID-only 入场与 detached read-only Run 快照入口。 */
  private _operationEntry!: OperationEntryFacade;
  get operationEntry(): OperationEntryFacade { return this._operationEntry; }
  /** Read-only MapRun query; its owner remains private to this GameInstance. */
  private _mapRunQuery!: MapRunQuery;
  get mapRun(): MapRunQuery { return this._mapRunQuery; }

  // 运行时状态
  private _state!: PlayerState;
  #operationRuntimeOwner = new OperationRuntimeService();
  #mapRunOwner!: MapRunService;
  #mapContentResolver!: MapContentResolver;
  private _tagResidue: TagOverrideResidue = { spotTagOverrides: {} };
  private runtimeAreaTopology: readonly RuntimeAreaTopologyConnection[] = [];
  private readonly operationObservationStore = new OperationObservationStore();

  private readonly saveCodec: (ctx: SaveBuildContext) => SaveData;

  constructor(options: GameInstanceOptions = {}) {
    this.saveCodec = options.saveCodec ?? buildSaveData;
    (options.wiring ?? wireGameInstance)(this, {
      getState: () => this._state,
      setState: next => { this._state = next; },
      refreshVisibility: () => this.refreshVisibility(),
    }, options);
    this.replaceMapRunOwner();
    this._mapRunQuery = Object.freeze({
      getCards: (runId: string) => this.#mapRunOwner.getCards(runId),
      getEntryView: (mapId: string) => this.getMapEntryView(mapId),
      resolveCardReference: (ref: MapRunCardRef) => this.#mapRunOwner.resolveCardReference(ref),
      getSnapshot: () => this.#mapRunOwner.getSnapshot(),
      getResult: (runId: string) => this.#mapRunOwner.getResult(runId),
      getFailureResult: (runId: string) => this.#mapRunOwner.getFailureResult(runId),
      getFailureWorkspaceView: (runId: string): MapRunFailureWorkspaceView | null => {
        const result = this.#mapRunOwner.getFailureResult(runId);
        return result ? this.getMapFailureWorkspaceView(result) : null;
      },
      getCurrentEncounter: () => this.getCurrentMapEncounter(),
      getWorkspaceView: (runId: string) => this.getMapWorkspaceView(runId),
      previewSources: (runId: string) => this.previewMapEncounterSources(runId),
      previewReplacement: (runId: string, characterId: string, actionId: string, draft: MapRunEncounterDraftToken) => {
        const preview = this.#mapRunOwner.previewActionReplacement(runId, characterId, actionId, draft);
        const run = this.#mapRunOwner.getSnapshot(runId)!;
        const definition = this.#mapContentResolver.resolve(run.mapId)!;
        const actionPreview = this.getMapEncounterWorkspaceView(run, definition, preview);
        return Object.freeze(projectMapRelations({ run, actionPreview, currentEncounter: null, sourcePreview: null }, definition)
          .filter(row => row.source.kind === 'preparedAction' && row.source.id === characterId)
          .map(row => Object.freeze({ ...row, phase: 'replacementPreview' as const })));
      },
    });
    // Resolver data is trusted constructor input; AC ownership queries always come from this instance.
    this._operationEntry = createOperationEntry({
      characterSystem: this.characterSystem,
      rosterSystem: this.rosterSystem,
      getState: () => this._state,
      resolveStudentPresentation: (characterId, variantId) => {
        const profile = this.charaProfileService.characterProfile(characterId);
        const variant = this.rosterSystem.getVariant(variantId);
        return {
          displayName: profile.name || variant?.displayName || characterId,
          avatarRef: profile.avatar ?? this.picService.urlOf(variant?.avatar) ?? null,
        };
      },
      applyReward: reward => this.mutations.changeResource(reward.resourceId, reward.amount),
      resolver: options.operationContentResolver ?? createRegistryOperationContentResolver(this.registry),
      owner: this.#operationRuntimeOwner,
    }).facade;
    this.runtimeContentBrowser = createRuntimeContentBrowser(this.registry, {
      affectorPacks: {
        getEntries: () => this.affectorEngine.getPacks(),
        getRevision: () => this.affectorEngine.getPacksRevision(),
      },
      triggerDefs: {
        getEntries: () => this.triggerSystem.getDefinitions(),
        getRevision: () => this.triggerSystem.getDefinitionsRevision(),
      },
    });
  }

  // --- 访问器 ---

  get state(): Readonly<PlayerState> { return this._state; }
  get visibility(): Readonly<VisibilitySnapshot> { return this.visibilityEngine.getVisibility(this._state); }
  get running(): boolean { return this.sessionService.running; }
  getTagResidueSummary(): Readonly<Record<string, number>> { return summarizeTagResidue(this._tagResidue); }
  clearTagResidueByMod(modName: string): number {
    const result = clearTagResidueByMod(this._tagResidue, modName);
    this._tagResidue = result.residue;
    return result.removed;
  }

  private replaceMapRunOwner(): void {
    this.#mapContentResolver = createRegistryMapContentResolver(this.registry);
    this.#mapRunOwner = new MapRunService(
      this.#mapContentResolver,
      variantId => this.registry.characterVariants.get(variantId)?.proto,
    );
  }

  private getCurrentMapEncounter(): MapEncounterQueryView | null {
    const run = this.#mapRunOwner.getSnapshot();
    const nodeId = run?.activeEncounterNodeId;
    if (!run || nodeId === null || nodeId === undefined) return null;
    const definition = this.#mapContentResolver.resolve(run.mapId);
    const encounter = resolveMapEncounterDef(
      definition?.nodes.find(node => node.id === nodeId),
      run.activeEncounter?.activityId,
    );
    if (!definition || !encounter) return null;
    const statusDefinitions = definition.statuses ?? [];
    const activeStatuses = [...(run.activeEncounter?.statuses ?? []), ...(run.mapRunStatuses ?? [])];
    const statusDefinitionsById = new Map(statusDefinitions.map(status => [status.id, status]));
    const statusesFor = (kind: 'partyCharacter' | 'enemy', id: string) => Object.freeze(activeStatuses
      .filter(status => status.holder.kind === kind && status.holder.id === id)
      .map(status => {
        const statusDefinition = statusDefinitionsById.get(status.statusId);
        if (statusDefinition === undefined) {
          throw new MapRunError([`Map Status name for "${status.statusId}" is unavailable to the Workspace projection`]);
        }
        const sourceKey = status.source.kind === 'partyCharacter' || status.source.kind === 'enemy'
          ? [status.source.kind, status.source.id]
          : status.source.kind === 'ability'
            ? [status.source.kind, status.source.actionId]
            : [status.source.kind, status.source.actionId, status.source.itemId];
        return Object.freeze({
          key: JSON.stringify([status.statusId, sourceKey, status.actionId]),
          statusId: status.statusId,
          name: statusDefinition.name,
          stacks: status.stacks,
          remainingRounds: status.remainingRounds,
          ...(statusDefinition.kind === 'damageReduction' && statusDefinition.damageReductionPerStack !== undefined
            ? { damageReductionPerStack: statusDefinition.damageReductionPerStack } : {}),
        });
      })
      .sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    const partyHp = Object.freeze(run.partyHp.map(row => {
      const hp = definition?.initialPartyHp.find(candidate => candidate.characterId === row.characterId);
      if (!hp) throw new MapRunError([`Map party HP cap for "${row.characterId}" is unavailable to the Workspace projection`]);
      return Object.freeze({ characterId: row.characterId, currentHp: row.currentHp, maxHp: hp.maxHp,
        shield: run.activeEncounter?.shields?.[`partyCharacter:${row.characterId}`] ?? 0,
        ...(statusDefinitions.length > 0 ? { statuses: statusesFor('partyCharacter', row.characterId) } : {}) });
    }));
    const enemyHpById = new Map((run.activeEncounter?.enemies ?? []).map(row => [row.enemyId, row.currentHp]));
    const enemies = Object.freeze((encounter.enemies ?? []).map(enemy => Object.freeze({
      enemyId: enemy.id,
      currentHp: enemyHpById.get(enemy.id) ?? enemy.initialHp,
      maxHp: enemy.maxHp,
      shield: run.activeEncounter?.shields?.[`enemy:${enemy.id}`] ?? 0,
      ...(statusDefinitions.length > 0 ? { statuses: statusesFor('enemy', enemy.id) } : {}),
    })));
    const completion = encounter.completion?.kind === 'manual'
      ? Object.freeze({ kind: 'manual' as const, label: encounter.completion.label })
      : encounter.completion?.kind === 'condition'
        ? Object.freeze({
          kind: 'condition' as const,
          label: encounter.completion.label,
          condition: cloneMapEffectCondition(encounter.completion.condition),
          ...(run.activeEncounter?.locals ? { locals: cloneMapEffectLocals(run.activeEncounter.locals) } : {}),
        })
        : undefined;
    return Object.freeze({
      mapId: run.mapId,
      nodeId,
      ...(run.activeEncounter?.activityId === undefined ? {} : { activityId: run.activeEncounter.activityId }),
      title: encounter.title,
      ...(encounter.description === undefined ? {} : { description: encounter.description }),
      ...(completion ? { completion } : {}),
      ...(run.activeEncounter ? { round: run.activeEncounter.round } : {}),
      ...(Number.isSafeInteger(encounter.rounds) ? { rounds: encounter.rounds as number } : {}),
      partyHp,
      enemies,
    });
  }

  private getMapEncounterWorkspaceView(
    run: MapRun,
    definition: NonNullable<ReturnType<MapContentResolver['resolve']>>,
    replacement?: GameplayBActionPreview,
  ): MapRunEncounterWorkspaceView | null {
    const encounter = run.activeEncounter;
    if (!encounter) return null;
    const preview = replacement ?? this.#mapRunOwner.previewActions(run.runId);
    const commitPreview = this.#mapRunOwner.previewEncounterCommit(run.runId);
    if (!preview || !commitPreview) return null;

    const actionById = new Map((definition.actions ?? []).map(action => [action.id, action]));
    const actionViewByContext = new Map<string, MapWorkspaceActionView>();
    const scopeFor = (nodeId: string, activityId: string | null, round: number): MapRelationScope => Object.freeze({
      runId: run.runId, mapId: definition.id, nodeId, activityId, round,
    });
    const currentScope = scopeFor(encounter.nodeId, encounter.activityId ?? null, encounter.round);
    const currentCards = this.#mapRunOwner.getCards(run.runId);
    const contextFor = (scope: MapRelationScope, source: MapUnitRef | null, primary: MapTargetRef | null): MapEffectSummaryContext => ({
      scope, source, primary,
    });
    const projectAction = (actionId: string | null, context: MapEffectSummaryContext): MapWorkspaceActionView | null => {
      if (actionId === null) return null;
      const cacheKey = JSON.stringify([actionId, context.scope, context.source, context.primary]);
      const cached = actionViewByContext.get(cacheKey);
      if (cached) return cached;
      const action = actionById.get(actionId);
      if (!action) throw new MapRunError([`Map Action "${actionId}" is unavailable to the Workspace projection`]);
      const declaredEffects = summarizeProgramAction(action, context);
      const projected = Object.freeze({
        actionId: action.id,
        name: action.name,
        ...(action.description === undefined ? {} : { description: action.description }),
        targetKind: action.target.kind,
        costs: Object.freeze((action.costs ?? []).map(cost => Object.freeze({
          scope: cost.scope,
          resourceId: cost.resourceId,
          amount: cost.amount,
        }))),
        ...(declaredEffects === undefined ? {} : { declaredEffects }),
      });
      actionViewByContext.set(cacheKey, projected);
      return projected;
    };
    const requiredActionView = (actionId: string, context: MapEffectSummaryContext): MapWorkspaceActionView => {
      const action = projectAction(actionId, context);
      if (!action) throw new MapRunError([`Map Action "${actionId}" is unavailable to the Workspace projection`]);
      return action;
    };
    const projectExecutionSequence = (
      sequence: NonNullable<typeof commitPreview.executionSequence>,
    ) => Object.freeze(sequence.map(entry => {
      let sourceId = entry.owner?.id ?? null;
      if (sourceId === null && (entry.sourceKind === 'ability' || entry.sourceKind === 'item')) {
        try {
          const identity: unknown = JSON.parse(entry.sourceKey);
          if (Array.isArray(identity) && identity[5] === entry.sourceKind && identity[7] === entry.actionId
            && typeof identity[6] === 'string') sourceId = identity[6];
        } catch { /* A validated receipt normally has a canonical sourceKey; keep a safe display fallback. */ }
      }
      const action = actionById.get(entry.actionId);
      return Object.freeze({
        ...entry,
        sourceId,
        actionName: action?.name ?? entry.actionId,
        owner: entry.owner === null ? null : Object.freeze({ ...entry.owner }),
        cardRef: entry.cardRef === null ? null : parseMapRunCardRef(entry.cardRef),
        target: entry.target.kind === 'card'
          ? Object.freeze({ kind: 'card' as const, cardRef: entry.target.cardRef === null ? null : parseMapRunCardRef(entry.target.cardRef) })
          : Object.freeze({ ...entry.target }),
        resourceChanges: Object.freeze(entry.resourceChanges.map(change => Object.freeze({ ...change }))),
        hpChanges: Object.freeze(entry.hpChanges.map(change => Object.freeze({ ...change }))),
      });
    }));
    const primaryFor = (
      scope: MapRelationScope,
      targetCharacterId: string | null | undefined,
      targetEnemyId: string | null | undefined,
      targetCard?: MapRunCardRef | null,
    ): MapTargetRef | null => relationTarget(scope,
      targetCharacterId ? { kind: 'partyCharacter', characterId: targetCharacterId }
        : targetEnemyId ? { kind: 'enemy', enemyId: targetEnemyId } : null,
      targetCard);

    const projectCardEffectModifierPreviews = (prepared: typeof preview.preparedActions[number]) => {
      const sourceAction = prepared.preparedActionId ? actionById.get(prepared.preparedActionId) : undefined;
      const resolve = sourceAction?.effectProgram?.resolve;
      if (!Array.isArray(resolve) || resolve.length !== 1 || resolve[0]?.op !== 'cardEffectModifier'
        || resolve[0].path !== 'resolve[0].amount' || resolve[0].operation !== 'add'
        || !Number.isSafeInteger(resolve[0].delta) || resolve[0].delta === 0
        || !prepared.legalTargetCards?.length) return undefined;
      const candidates = new Map(currentCards.map(card => [mapRunCardKey(card.ref), card]));
      const rows = prepared.legalTargetCards.flatMap(targetCardRef => {
        const targetCard = candidates.get(mapRunCardKey(targetCardRef));
        const targetAction = targetCard?.actionId ? actionById.get(targetCard.actionId) : undefined;
        const targetResolve = targetAction?.effectProgram?.resolve;
        const leaf = targetResolve?.length === 1 ? targetResolve[0] : undefined;
        if (leaf?.op !== 'damage' && leaf?.op !== 'heal') return [];
        return [Object.freeze({ targetCardRef: Object.freeze({
          ...parseMapRunCardRef(targetCardRef)!, scope: Object.freeze({ ...targetCardRef.scope }),
        }), op: leaf.op, delta: resolve[0].delta })];
      });
      return rows.length ? Object.freeze(rows) : undefined;
    };

    const preparedActions = Object.freeze(preview.preparedActions.map(prepared => Object.freeze({
      characterId: prepared.characterId,
      hand: Object.freeze(prepared.handActionIds.map(actionId => requiredActionView(actionId,
        contextFor(currentScope, relationUnit(currentScope, 'partyCharacter', prepared.characterId), null)))),
      naturalAction: projectAction(prepared.naturalActionId, contextFor(currentScope,
        relationUnit(currentScope, 'partyCharacter', prepared.characterId),
        prepared.naturalActionId === prepared.preparedActionId
          ? primaryFor(currentScope, prepared.targetCharacterId, prepared.targetEnemyId, prepared.targetCard) : null)),
      preparedAction: projectAction(prepared.preparedActionId, contextFor(currentScope,
        relationUnit(currentScope, 'partyCharacter', prepared.characterId),
        primaryFor(currentScope, prepared.targetCharacterId, prepared.targetEnemyId, prepared.targetCard))),
      targetKind: prepared.targetKind,
      ...(prepared.targetKind === 'card' ? { legalTargetCards: prepared.legalTargetCards, targetCard: prepared.targetCard } : {}),
      ...(projectCardEffectModifierPreviews(prepared) === undefined ? {} : {
        cardEffectModifierPreviews: projectCardEffectModifierPreviews(prepared),
      }),
      legalTargetCharacterIds: Object.freeze([...prepared.legalTargetCharacterIds]),
      legalTargetEnemyIds: Object.freeze([...(prepared.legalTargetEnemyIds ?? [])]),
      targetCharacterId: prepared.targetCharacterId,
      targetEnemyId: prepared.targetEnemyId ?? null,
      ...(prepared.additionalTargetKind === undefined ? {} : { additionalTargetKind: prepared.additionalTargetKind }),
      ...(prepared.additionalTargetKind === 'partyCharacter' ? {
        legalAdditionalTargetCharacterIds: Object.freeze([...(prepared.legalAdditionalTargetCharacterIds ?? [])]),
        additionalTargetCharacterId: prepared.additionalTargetCharacterId ?? null,
      } : {}),
      ...(prepared.additionalTargetKind === 'enemy' ? {
        legalAdditionalTargetEnemyIds: Object.freeze([...(prepared.legalAdditionalTargetEnemyIds ?? [])]),
        additionalTargetEnemyId: prepared.additionalTargetEnemyId ?? null,
      } : {}),
      additionalTargetSelectionRequired: prepared.additionalTargetSelectionRequired ?? false,
      targetSelectionRequired: prepared.targetSelectionRequired,
      overrideKind: prepared.overrideKind,
      playerCost: prepared.playerCost,
      ...(prepared.skipReason === undefined ? {} : { skipReason: prepared.skipReason }),
    })));
    const preparedEnemyActions = Object.freeze(preview.preparedEnemyActions.map(prepared => Object.freeze({
      enemyId: prepared.enemyId,
      hand: Object.freeze(prepared.handActionIds.map(actionId => requiredActionView(actionId,
        contextFor(currentScope, relationUnit(currentScope, 'enemy', prepared.enemyId), null)))),
      naturalAction: projectAction(prepared.naturalActionId, contextFor(currentScope,
        relationUnit(currentScope, 'enemy', prepared.enemyId),
        primaryFor(currentScope, prepared.targetCharacterId, prepared.targetEnemyId, prepared.targetCard))),
      targetKind: prepared.targetKind,
      ...(prepared.targetKind === 'card' ? { legalTargetCards: prepared.legalTargetCards, targetCard: prepared.targetCard } : {}),
      legalTargetCharacterIds: Object.freeze([...prepared.legalTargetCharacterIds]),
      legalTargetEnemyIds: Object.freeze([...prepared.legalTargetEnemyIds]),
      targetCharacterId: prepared.targetCharacterId,
      targetEnemyId: prepared.targetEnemyId,
      targetSelectionRequired: false as const,
      ...(prepared.skipReason === undefined ? {} : { skipReason: prepared.skipReason }),
    })));
    const playerCommandOptions = Object.freeze(preview.playerCommandOptions.map(option => Object.freeze({
      characterId: option.characterId,
      action: requiredActionView(option.actionId, contextFor(currentScope,
        relationUnit(currentScope, 'partyCharacter', option.characterId), null)),
      playerCost: option.playerCost,
      canPayPlayerCost: option.canPayPlayerCost,
      canPayActionCosts: option.canPayActionCosts,
    })));
    const recentReceipt = encounter.lastCommit ?? run.lastEncounterCommit ?? null;
    const recentScope = recentReceipt === null ? currentScope
      : scopeFor(recentReceipt.nodeId, recentReceipt.activityId ?? null, recentReceipt.round);
    const recentCommit = recentReceipt === null ? null : Object.freeze({
      requestId: recentReceipt.requestId,
      commandVersion: recentReceipt.commandVersion,
      resultingCommitVersion: recentReceipt.resultingCommitVersion,
      nodeId: recentReceipt.nodeId,
      ...(recentReceipt.activityId === undefined ? {} : { activityId: recentReceipt.activityId }),
      round: recentReceipt.round,
      draftVersion: recentReceipt.draftVersion,
      settlements: Object.freeze(recentReceipt.settlements.map(settlement => Object.freeze({
        characterId: settlement.characterId,
        action: projectAction(settlement.actionId, contextFor(recentScope,
          relationUnit(recentScope, 'partyCharacter', settlement.characterId),
          primaryFor(recentScope, settlement.targetCharacterId, settlement.targetEnemyId, settlement.targetCard))),
        targetCharacterId: settlement.targetCharacterId,
        targetEnemyId: settlement.targetEnemyId ?? null,
        ...(settlement.targetCard ? { targetCard: parseMapRunCardRef(settlement.targetCard)! } : {}),
        ...(settlement.skipReason === undefined ? {} : { skipReason: settlement.skipReason }),
        overrideKind: settlement.overrideKind,
        playerCostSpent: settlement.playerCostSpent,
        ...(settlement.scostCost ? { scostCost: Object.freeze({ ...settlement.scostCost }) } : {}),
        resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
        hpChanges: Object.freeze([...(settlement.hpChanges ?? [])].map(change => Object.freeze({ ...change }))),
      }))),
      ability: recentReceipt.ability ? Object.freeze({
        action: projectAction(recentReceipt.ability.actionId, contextFor(recentScope, null,
          relationTarget(recentScope, recentReceipt.ability.target))),
        target: Object.freeze({ ...recentReceipt.ability.target }),
        playerCostSpent: recentReceipt.ability.playerCostSpent,
        resourceChanges: Object.freeze(recentReceipt.ability.resourceChanges.map(change => Object.freeze({ ...change }))),
        hpChanges: Object.freeze(recentReceipt.ability.hpChanges.map(change => Object.freeze({ ...change }))),
      }) : null,
      item: recentReceipt.item ? Object.freeze({
        itemName: this.registry.items.get(recentReceipt.item.itemId)?.name ?? recentReceipt.item.itemId,
        action: projectAction(recentReceipt.item.actionId, contextFor(recentScope, null,
          relationTarget(recentScope, recentReceipt.item.target))),
        target: Object.freeze({ ...recentReceipt.item.target }),
        consumedCount: recentReceipt.item.consumedCount,
        resourceChanges: Object.freeze(recentReceipt.item.resourceChanges.map(change => Object.freeze({ ...change }))),
        hpChanges: Object.freeze(recentReceipt.item.hpChanges.map(change => Object.freeze({ ...change }))),
      }) : null,
      enemyActions: Object.freeze((recentReceipt.enemyActions ?? []).map(row => Object.freeze({
        enemyId: row.enemyId,
        action: projectAction(row.actionId, contextFor(recentScope, relationUnit(recentScope, 'enemy', row.enemyId),
          primaryFor(recentScope, row.targetCharacterId, row.targetEnemyId, row.targetCard))),
        targetCharacterId: row.targetCharacterId ?? null,
        targetEnemyId: row.targetEnemyId ?? null,
        ...(row.targetCard ? { targetCard: parseMapRunCardRef(row.targetCard)! } : {}),
        ...(row.scostCost ? { scostCost: Object.freeze({ ...row.scostCost }) } : {}),
        ...(row.skipReason === undefined ? {} : { skipReason: row.skipReason }),
        resourceChanges: Object.freeze(row.resourceChanges.map(change => Object.freeze({ ...change }))),
        hpChanges: Object.freeze([...(row.hpChanges ?? [])].map(change => Object.freeze({ ...change }))),
      }))),
      ...(recentReceipt.programReceiptVersion === undefined ? {} : { programReceiptVersion: recentReceipt.programReceiptVersion }),
      ...(recentReceipt.executionContractId === undefined ? {} : { executionContractId: recentReceipt.executionContractId }),
      ...(recentReceipt.executionSequence === undefined ? {} : { executionSequence: projectExecutionSequence(recentReceipt.executionSequence) }),
      ...(recentReceipt.effectScope === undefined ? {} : { effectScope: Object.freeze({ ...recentReceipt.effectScope }) }),
      ...(recentReceipt.programVisitCount === undefined ? {} : { programVisitCount: recentReceipt.programVisitCount }),
      ...(recentReceipt.programVisits === undefined ? {} : { programVisits: Object.freeze([...recentReceipt.programVisits]) }),
      ...(recentReceipt.plannedLocals === undefined ? {} : { plannedLocals: cloneMapEffectLocals(recentReceipt.plannedLocals) }),
      ...(recentReceipt.effectTrace === undefined ? {} : { effectTrace: Object.freeze(recentReceipt.effectTrace.map(freezeMapEffectTrace)) }),
      ...(recentReceipt.cardEffectModifierReceipts === undefined ? {} : { cardEffectModifierReceipts: Object.freeze(recentReceipt.cardEffectModifierReceipts.map(freezeCardEffectModifierReceipt)) }),
      ...(recentReceipt.statusReceiptVersion === undefined ? {} : { statusReceiptVersion: recentReceipt.statusReceiptVersion }),
      ...(recentReceipt.plannedStatuses === undefined ? {} : { plannedStatuses: copyMapEncounterStatusInstances(recentReceipt.plannedStatuses) }),
      ...(recentReceipt.plannedMapRunStatuses === undefined ? {} : { plannedMapRunStatuses: copyMapRunStatusInstances(recentReceipt.plannedMapRunStatuses) }),
      ...(recentReceipt.statusTrace === undefined ? {} : { statusTrace: Object.freeze(recentReceipt.statusTrace.map(entry => Object.freeze({
        ...entry,
        holder: Object.freeze({ ...entry.holder }),
        source: Object.freeze({ ...entry.source }),
        statusBefore: Object.freeze({ ...entry.statusBefore, holder: Object.freeze({ ...entry.statusBefore.holder }), source: Object.freeze({ ...entry.statusBefore.source }) }),
        statusAfter: entry.statusAfter === null ? null : Object.freeze({ ...entry.statusAfter, holder: Object.freeze({ ...entry.statusAfter.holder }), source: Object.freeze({ ...entry.statusAfter.source }) }),
      }) as MapEffectStatusTickTraceEntry)) }),
      ...(recentReceipt.statusRemoveTrace === undefined ? {} : {
        statusRemoveTrace: Object.freeze(recentReceipt.statusRemoveTrace.map(freezeMapEffectStatusRemoveTrace)),
      }),
      ...(recentReceipt.statusConsumeTrace === undefined ? {} : {
        statusConsumeTrace: Object.freeze(recentReceipt.statusConsumeTrace.map(freezeMapEffectStatusConsumeTrace)),
      }),
      ...(recentReceipt.statusCategoryRemoveTrace === undefined ? {} : {
        statusCategoryRemoveTrace: Object.freeze(recentReceipt.statusCategoryRemoveTrace.map(freezeMapEffectStatusCategoryRemoveTrace)),
      }),
      ...(recentReceipt.shieldReceiptVersion === undefined ? {} : { shieldReceiptVersion: recentReceipt.shieldReceiptVersion }),
      ...(recentReceipt.shieldTrace === undefined ? {} : {
        shieldTrace: Object.freeze(recentReceipt.shieldTrace.map(freezeMapEffectShieldTrace)),
      }),
      ...(recentReceipt.triggerReceiptVersion === undefined ? {} : { triggerReceiptVersion: recentReceipt.triggerReceiptVersion }),
      ...(recentReceipt.triggerTrace === undefined ? {} : {
        triggerTrace: Object.freeze(recentReceipt.triggerTrace.map(freezeMapEffectTriggerTrace)),
      }),
      ...(recentReceipt.statusExpiryTriggerTrace === undefined ? {} : {
        statusExpiryTriggerTrace: Object.freeze(recentReceipt.statusExpiryTriggerTrace.map(freezeMapEffectStatusExpiryTriggerTrace)),
      }),
      ...(recentReceipt.statusDamageTriggerTrace === undefined ? {} : {
        statusDamageTriggerTrace: Object.freeze(recentReceipt.statusDamageTriggerTrace.map(freezeMapEffectStatusDamageTriggerTrace)),
      }),
    });

    return Object.freeze({
      nodeId: preview.nodeId,
      round: preview.round,
      draft: Object.freeze({
        nodeId: preview.nodeId,
        ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
        round: preview.round,
        draftVersion: preview.draftVersion,
      }),
      overrides: Object.freeze(preview.overrides.map(override => Object.freeze({ ...override }))),
      preparedActions,
      preparedEnemyActions,
      playerCommandOptions,
      commitPreview: Object.freeze({
        canCommit: commitPreview.canCommit,
        playerCostRequired: commitPreview.playerCostRequired,
        diagnostics: Object.freeze([...commitPreview.diagnostics]),
        settlements: commitPreview.settlements === null ? null : Object.freeze(commitPreview.settlements.map(settlement => Object.freeze({
          characterId: settlement.characterId,
          action: projectAction(settlement.actionId, contextFor(currentScope,
            relationUnit(currentScope, 'partyCharacter', settlement.characterId),
            primaryFor(currentScope, settlement.targetCharacterId, settlement.targetEnemyId, settlement.targetCard))),
          targetCharacterId: settlement.targetCharacterId,
          targetEnemyId: settlement.targetEnemyId ?? null,
          ...(settlement.targetCard ? { targetCard: parseMapRunCardRef(settlement.targetCard)! } : {}),
          ...(settlement.skipReason === undefined ? {} : { skipReason: settlement.skipReason }),
          overrideKind: settlement.overrideKind,
          playerCostSpent: settlement.playerCostSpent,
          ...(settlement.scostCost ? { scostCost: Object.freeze({ ...settlement.scostCost }) } : {}),
          resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
          hpChanges: Object.freeze([...(settlement.hpChanges ?? [])].map(change => Object.freeze({ ...change }))),
        }))),
        enemyActions: commitPreview.enemyActions === null ? null : Object.freeze(commitPreview.enemyActions.map(row => Object.freeze({
          enemyId: row.enemyId,
          action: projectAction(row.actionId, contextFor(currentScope, relationUnit(currentScope, 'enemy', row.enemyId),
            primaryFor(currentScope, row.targetCharacterId, row.targetEnemyId, row.targetCard))),
          targetCharacterId: row.targetCharacterId ?? null,
          targetEnemyId: row.targetEnemyId ?? null,
          ...(row.targetCard ? { targetCard: parseMapRunCardRef(row.targetCard)! } : {}),
          ...(row.scostCost ? { scostCost: Object.freeze({ ...row.scostCost }) } : {}),
          ...(row.skipReason === undefined ? {} : { skipReason: row.skipReason }),
          resourceChanges: Object.freeze(row.resourceChanges.map(change => Object.freeze({ ...change }))),
          hpChanges: Object.freeze([...(row.hpChanges ?? [])].map(change => Object.freeze({ ...change }))),
        }))),
        ...(commitPreview.activityId === undefined ? {} : { activityId: commitPreview.activityId }),
        ...(commitPreview.programReceiptVersion === undefined ? {} : { programReceiptVersion: commitPreview.programReceiptVersion }),
        ...(commitPreview.executionContractId === undefined ? {} : { executionContractId: commitPreview.executionContractId }),
        ...(commitPreview.executionSequence === undefined ? {} : { executionSequence: projectExecutionSequence(commitPreview.executionSequence) }),
        ...(commitPreview.effectScope === undefined ? {} : { effectScope: Object.freeze({ ...commitPreview.effectScope }) }),
        ...(commitPreview.programVisitCount === undefined ? {} : { programVisitCount: commitPreview.programVisitCount }),
        ...(commitPreview.programVisits === undefined ? {} : { programVisits: Object.freeze([...commitPreview.programVisits]) }),
        ...(commitPreview.plannedLocals === undefined ? {} : { plannedLocals: cloneMapEffectLocals(commitPreview.plannedLocals) }),
        ...(commitPreview.effectTrace === undefined ? {} : { effectTrace: Object.freeze(commitPreview.effectTrace.map(freezeMapEffectTrace)) }),
        ...(commitPreview.statusReceiptVersion === undefined ? {} : { statusReceiptVersion: commitPreview.statusReceiptVersion }),
        ...(commitPreview.plannedStatuses === undefined ? {} : { plannedStatuses: copyMapEncounterStatusInstances(commitPreview.plannedStatuses) }),
        ...(commitPreview.plannedMapRunStatuses === undefined ? {} : { plannedMapRunStatuses: copyMapRunStatusInstances(commitPreview.plannedMapRunStatuses) }),
        ...(commitPreview.statusTrace === undefined ? {} : { statusTrace: Object.freeze(commitPreview.statusTrace.map(entry => Object.freeze({
          ...entry,
          holder: Object.freeze({ ...entry.holder }),
          source: Object.freeze({ ...entry.source }),
          statusBefore: Object.freeze({ ...entry.statusBefore, holder: Object.freeze({ ...entry.statusBefore.holder }), source: Object.freeze({ ...entry.statusBefore.source }) }),
          statusAfter: entry.statusAfter === null ? null : Object.freeze({ ...entry.statusAfter, holder: Object.freeze({ ...entry.statusAfter.holder }), source: Object.freeze({ ...entry.statusAfter.source }) }),
        }) as MapEffectStatusTickTraceEntry)) }),
        ...(commitPreview.statusConsumeTrace === undefined ? {} : {
          statusConsumeTrace: Object.freeze(commitPreview.statusConsumeTrace.map(freezeMapEffectStatusConsumeTrace)),
        }),
        ...(commitPreview.statusCategoryRemoveTrace === undefined ? {} : {
          statusCategoryRemoveTrace: Object.freeze(commitPreview.statusCategoryRemoveTrace.map(freezeMapEffectStatusCategoryRemoveTrace)),
        }),
        ...(commitPreview.triggerReceiptVersion === undefined ? {} : { triggerReceiptVersion: commitPreview.triggerReceiptVersion }),
        ...(commitPreview.triggerTrace === undefined ? {} : {
          triggerTrace: Object.freeze(commitPreview.triggerTrace.map(freezeMapEffectTriggerTrace)),
        }),
        ...(commitPreview.statusExpiryTriggerTrace === undefined ? {} : {
          statusExpiryTriggerTrace: Object.freeze(commitPreview.statusExpiryTriggerTrace.map(freezeMapEffectStatusExpiryTriggerTrace)),
        }),
        ...(commitPreview.statusDamageTriggerTrace === undefined ? {} : {
          statusDamageTriggerTrace: Object.freeze(commitPreview.statusDamageTriggerTrace.map(freezeMapEffectStatusDamageTriggerTrace)),
        }),
      }),
      recentCommit,
    });
  }

  private getMapWorkspaceView(runId: string): MapRunWorkspaceView | null {
    const run = this.#mapRunOwner.getSnapshot(runId);
    if (!run) {
      const result = this.#mapRunOwner.getResult(runId);
      if (result) return Object.freeze({ kind: 'success' as const, result });
      const failure = this.#mapRunOwner.getFailureResult(runId);
      return failure ? this.getMapFailureWorkspaceView(failure) : null;
    }
    const definition = this.#mapContentResolver.resolve(run.mapId);
    if (!definition || definition.id !== run.mapId) return null;

    const map = Object.freeze({
      id: definition.id,
      name: definition.name,
      startNodeId: definition.startNodeId,
      exitNodeIds: Object.freeze([...definition.exitNodeIds]),
      nodes: Object.freeze(definition.nodes.map((node): MapWorkspaceNodeView => Object.freeze({
        id: node.id,
        title: node.title,
        ...(node.description === undefined ? {} : { description: node.description }),
        hasEncounter: node.encounter !== undefined || (node.activities?.length ?? 0) > 0,
        ...(mapNodeActivityTitles(node).length === 0 ? {} : { activityTitles: mapNodeActivityTitles(node) }),
      }))),
      edges: Object.freeze(definition.edges.map((edge): MapWorkspaceEdgeView => Object.freeze({
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        ...(edge.condition === undefined ? {} : {
          condition: Object.freeze({
            ...edge.condition,
            satisfied: isGameplayMapEdgeConditionSatisfied(edge.condition, run),
          }),
        }),
      }))),
    });
    const actionPreview = this.getMapEncounterWorkspaceView(run, definition);

    const workspace = {
      kind: 'active' as const,
      cards: this.#mapRunOwner.getCards(runId),
      run,
      map,
      currentEncounter: this.getCurrentMapEncounter(),
      activities: this.getMapActivitiesView(run, definition),
      shop: this.getMapShopView(run, definition),
      actionPreview,
      sourcePreview: this.previewMapEncounterSources(runId),
    };
    return Object.freeze({ ...workspace, relations: projectMapRelations(workspace, definition) });
  }

  private getMapActivitiesView(
    run: MapRun,
    definition: NonNullable<ReturnType<MapContentResolver['resolve']>>,
  ): readonly MapWorkspaceActivityView[] {
    const node = definition.nodes.find(candidate => candidate.id === run.currentNodeId);
    const activities = node?.activities ?? [];
    if (activities.length === 0) return Object.freeze([]);
    const completed = new Set(run.completedActivityIds);
    return Object.freeze(activities.map((activity, index): MapWorkspaceActivityView => Object.freeze({
      activityId: activity.id,
      title: mapActivityTitle(activity),
      kind: mapActivityKind(activity),
      index,
      total: activities.length,
      completed: completed.has(`${run.currentNodeId}/${activity.id}`),
      active: run.activeActivity?.activityId === activity.id,
    })));
  }

  private getMapShopView(
    run: MapRun,
    definition: NonNullable<ReturnType<MapContentResolver['resolve']>>,
  ): MapWorkspaceShopView | null {
    const activeActivity = run.activeActivity;
    if (!activeActivity || activeActivity.kind !== 'shop') return null;
    const node = definition.nodes.find(candidate => candidate.id === activeActivity.nodeId);
    const activity = node?.activities?.find(candidate => candidate.id === activeActivity.activityId);
    const shop = activity?.shop;
    if (!shop) return null;
    const teamBalances = new Map(run.teamResources.map(row => [row.resourceId, row.value]));
    const hpCaps = new Map(definition.initialPartyHp.map(row => [row.characterId, row.maxHp]));
    const offers = shop.offers.map(offer => {
      const costs = (offer.costs ?? []).map(cost => Object.freeze({ resourceId: cost.resourceId, amount: cost.amount }));
      const effects = (offer.effects ?? []).map(effect => Object.freeze({ resourceId: effect.resourceId, amount: effect.amount }));
      const simulated = new Map(teamBalances);
      let affordable = true;
      for (const cost of costs) {
        const balance = simulated.get(cost.resourceId);
        if (balance === undefined || balance < cost.amount) {
          affordable = false;
          break;
        }
        simulated.set(cost.resourceId, balance - cost.amount);
      }
      if (affordable) {
        for (const effect of effects) {
          const balance = simulated.get(effect.resourceId);
          if (balance === undefined || balance + effect.amount < 0) {
            affordable = false;
            break;
          }
          simulated.set(effect.resourceId, balance + effect.amount);
        }
      }
      const healRow = offer.heal === undefined
        ? null
        : run.partyHp.find(row => row.characterId === offer.heal!.characterId) ?? null;
      const healAllowed = offer.heal === undefined
        || (healRow !== null && healRow.currentHp > 0 && healRow.currentHp < (hpCaps.get(offer.heal.characterId) ?? 0));
      return Object.freeze({
        offerId: offer.id,
        name: offer.name,
        ...(offer.description === undefined ? {} : { description: offer.description }),
        costs: Object.freeze(costs),
        effects: Object.freeze(effects),
        heal: offer.heal === undefined ? null : Object.freeze({ characterId: offer.heal.characterId, amount: offer.heal.amount }),
        canPurchase: affordable && healAllowed,
      });
    });
    return Object.freeze({
      nodeId: activeActivity.nodeId,
      activityId: activeActivity.activityId,
      title: shop.title ?? activity?.title ?? '商店',
      ...(shop.description === undefined ? {} : { description: shop.description }),
      draftVersion: activeActivity.shopDraftVersion,
      offers: Object.freeze(offers),
      lastPurchase: activeActivity.lastPurchase === null ? null : Object.freeze({
        offerId: activeActivity.lastPurchase.offerId,
        requestId: activeActivity.lastPurchase.requestId,
      }),
    });
  }

  private getMapFailureWorkspaceView(result: NonNullable<ReturnType<MapRunService['getFailureResult']>>): MapRunFailureWorkspaceView {
    const definition = this.#mapContentResolver.resolve(result.mapId);
    if (!definition || definition.id !== result.mapId) {
      throw new MapRunError([`Map "${result.mapId}" is unavailable to the failure Workspace projection`]);
    }
    const failedNode = definition.nodes.find(node => node.id === result.failedNodeId);
    if (!failedNode) throw new MapRunError([`Failed Node "${result.failedNodeId}" is unavailable to the failure Workspace projection`]);
    const map = Object.freeze({
      id: definition.id,
      name: definition.name,
      startNodeId: definition.startNodeId,
      exitNodeIds: Object.freeze([...definition.exitNodeIds]),
      nodes: Object.freeze(definition.nodes.map((node): MapWorkspaceNodeView => Object.freeze({
        id: node.id,
        title: node.title,
        ...(node.description === undefined ? {} : { description: node.description }),
        hasEncounter: node.encounter !== undefined || (node.activities?.length ?? 0) > 0,
        ...(mapNodeActivityTitles(node).length === 0 ? {} : { activityTitles: mapNodeActivityTitles(node) }),
      }))),
      edges: Object.freeze(definition.edges.map((edge): MapWorkspaceEdgeView => Object.freeze({
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
      }))),
    });
    const partyHp = Object.freeze(definition.initialPartyHp.map(hp => Object.freeze({
      characterId: hp.characterId,
      currentHp: 0 as const,
      maxHp: hp.maxHp,
    })));
    return Object.freeze({ kind: 'failure' as const, result, map, failedNodeTitle: failedNode.title, partyHp });
  }

  /** Starts a MapRun through the GameCommands adapter. */
  startMap(mapId: string): MapRun {
    const definition = this.#mapContentResolver.resolve(mapId);
    if (!definition) return this.#mapRunOwner.start(mapId, []);
    const admittedParty = this.admitMapParty(mapId, definition.partyCharacterIds);
    return this.#mapRunOwner.start(mapId, admittedParty);
  }

  private getMapEntryView(mapId: string): MapEntryView {
    const definition = this.#mapContentResolver.resolve(mapId);
    if (!definition || definition.id !== mapId) {
      return Object.freeze({
        mapId,
        name: null,
        mode: 'unavailable',
        reason: 'map-not-found',
        partyMode: 'fixed',
        party: Object.freeze([]),
        playerCost: null,
        actorResources: Object.freeze([]),
        teamResources: Object.freeze([]),
      });
    }

    const entryInfo = definition.entryInfo
      ? Object.freeze({
          ...(definition.entryInfo.description === undefined ? {} : { description: definition.entryInfo.description }),
          ...(definition.entryInfo.tips === undefined ? {} : { tips: Object.freeze([...definition.entryInfo.tips]) }),
        })
      : undefined;
    const initialHpByCharacter = new Map(definition.initialPartyHp.map(row => [row.characterId, row]));
    const freshParty = this.resolveMapPartyAdmission(definition.partyCharacterIds).map(member => {
      const hp = initialHpByCharacter.get(member.characterId);
      return Object.freeze({
        ...member,
        ...(hp ? { initialHp: hp.initialHp, maxHp: hp.maxHp } : {}),
      });
    });
    const actorResources = Object.freeze((definition.initialActorResources ?? []).map(row => Object.freeze({
      characterId: row.characterId,
      resourceId: row.resourceId,
      value: row.value,
    })));
    const teamResources = Object.freeze((definition.initialTeamResources ?? []).map(row => Object.freeze({
      resourceId: row.resourceId,
      value: row.value,
    })));
    const activeRun = this.#mapRunOwner.getSnapshot();

    if (activeRun?.mapId === mapId) {
      const snapshot = this.#mapRunOwner.getEntrySnapshot(activeRun.runId);
      if (!snapshot || snapshot.run.mapId !== mapId) {
        return Object.freeze({
          mapId,
          name: definition.name,
          ...(entryInfo ? { entryInfo } : {}),
          mode: 'unavailable',
          reason: 'run-content-unavailable',
          partyMode: 'fixed',
          party: Object.freeze([]),
          playerCost: null,
          actorResources: Object.freeze([]),
          teamResources: Object.freeze([]),
        });
      }
      const hpByCharacter = new Map(snapshot.partyHp.map(row => [row.characterId, row]));
      const party = Object.freeze(snapshot.run.party.map(member => Object.freeze({
        ...this.projectMapEntryPartyMember(member.characterId, member.variantId, 'admitted'),
        ...(hpByCharacter.has(member.characterId) ? {
          currentHp: hpByCharacter.get(member.characterId)!.currentHp,
          maxHp: hpByCharacter.get(member.characterId)!.maxHp,
        } : {}),
      })));
      return Object.freeze({
        mapId,
        name: snapshot.mapName,
        ...(snapshot.entryInfo ? { entryInfo: snapshot.entryInfo } : {}),
        mode: 'resume',
        partyMode: 'fixed',
        party,
        playerCost: snapshot.run.playerCost,
        actorResources: Object.freeze(snapshot.run.actorResources.map(row => Object.freeze({ ...row }))),
        teamResources: Object.freeze(snapshot.run.teamResources.map(row => Object.freeze({ ...row }))),
        progress: Object.freeze({
          runId: snapshot.run.runId,
          currentNodeId: snapshot.run.currentNodeId,
          currentNodeTitle: snapshot.currentNodeTitle,
          ...(snapshot.activity ? { activity: snapshot.activity } : {}),
          ...(snapshot.round === undefined ? {} : { round: snapshot.round }),
        }),
      });
    }

    if (activeRun) {
      const blockingSnapshot = this.#mapRunOwner.getEntrySnapshot(activeRun.runId);
      return Object.freeze({
        mapId,
        name: definition.name,
        ...(entryInfo ? { entryInfo } : {}),
        mode: 'blocked',
        reason: 'other-map-active',
        ...(blockingSnapshot ? { blockedByMapName: blockingSnapshot.mapName } : { blockedByMapName: activeRun.mapId }),
        partyMode: 'fixed',
        party: Object.freeze(freshParty),
        playerCost: definition.initialPlayerCost,
        actorResources,
        teamResources,
      });
    }

    const partyEligible = freshParty.every(member => member.admission === 'admitted');
    return Object.freeze({
      mapId,
      name: definition.name,
      ...(entryInfo ? { entryInfo } : {}),
      mode: partyEligible ? 'fresh' : 'blocked',
      ...(partyEligible ? {} : { reason: 'party-ineligible' as const }),
      partyMode: 'fixed',
      party: Object.freeze(freshParty),
      playerCost: definition.initialPlayerCost,
      actorResources,
      teamResources,
    });
  }

  /** Restarts the matching MapRun from its Map start using the same admitted party. */
  restartMap(runId: string): MapRun {
    return this.#mapRunOwner.restart(runId);
  }

  /** Discards the matching active MapRun without changing Persistent PlayerState. */
  abandonMap(runId: string): void {
    this.#mapRunOwner.abandon(runId);
  }

  /** Resolves the Map's fixed party against current ownership without writing PlayerState. */
  private admitMapParty(mapId: string, characterIds: readonly string[]): MapRunPartyMember[] {
    const diagnostics: string[] = [];
    const party = this.resolveMapPartyAdmission(characterIds);
    for (const member of party) {
      if (member.admission === 'character-locked') {
        diagnostics.push(`Map "${mapId}" party Character "${member.characterId}" is not currently owned or unlocked`);
      } else if (member.admission === 'variant-unavailable') {
        diagnostics.push(`Map "${mapId}" party Character "${member.characterId}" has no owned registered Variant`);
      }
    }
    if (diagnostics.length > 0) throw new MapRunError(diagnostics);
    return party.map(member => ({ characterId: member.characterId, variantId: member.variantId! }));
  }

  private resolveMapPartyAdmission(characterIds: readonly string[]): MapEntryPartyMemberView[] {
    const currentState = this._state;
    const unlockedCharacterIds = new Set(this.characterSystem.getUnlocked(currentState).map(character => character.id));
    const variantIdByCharacter = new Map<string, string>();
    for (const variantId of Object.keys(currentState.roster ?? {}).sort()) {
      if (!this.rosterSystem.getOwned(currentState, variantId)) continue;
      const variant = this.rosterSystem.getVariant(variantId);
      if (!variant || typeof variant.proto !== 'string' || variant.proto.trim().length === 0
        || variantIdByCharacter.has(variant.proto)) continue;
      variantIdByCharacter.set(variant.proto, variant.id);
    }
    return characterIds.map(characterId => {
      if (!unlockedCharacterIds.has(characterId)) {
        return this.projectMapEntryPartyMember(characterId, null, 'character-locked');
      }
      const variantId = variantIdByCharacter.get(characterId);
      if (!variantId) return this.projectMapEntryPartyMember(characterId, null, 'variant-unavailable');
      return this.projectMapEntryPartyMember(characterId, variantId, 'admitted');
    });
  }

  private projectMapEntryPartyMember(
    characterId: string,
    variantId: string | null,
    admission: MapEntryPartyMemberView['admission'],
  ): MapEntryPartyMemberView {
    const profile = this.charaProfileService.characterProfile(characterId);
    const variant = variantId ? this.rosterSystem.getVariant(variantId) : null;
    return Object.freeze({
      characterId,
      variantId,
      displayName: profile.name || variant?.displayName || characterId,
      avatarRef: profile.avatar ?? this.picService.urlOf(variant?.avatar) ?? null,
      admission,
    });
  }

  /** Moves to a directed adjacent Node through the GameCommands adapter. */
  moveMap(runId: string, targetNodeId: string): MapRun {
    return this.#mapRunOwner.move(runId, targetNodeId);
  }

  /** Completes only the active Encounter's declared manual action. */
  completeMapEncounter(runId: string): MapRun {
    return this.#mapRunOwner.completeEncounter(runId);
  }

  /** Buys one Shop offer through the sole MapRun Owner with request-level idempotency. */
  purchaseMapShopOffer(runId: string, offerId: string, requestId: string, draft: MapRunShopDraftToken): MapRun {
    return this.#mapRunOwner.purchaseShopOffer(runId, offerId, requestId, draft);
  }

  /** Leaves the active Shop and advances the Node's fixed activity order. */
  leaveMapShop(runId: string, draft: MapRunShopDraftToken): MapRun {
    return this.#mapRunOwner.leaveShop(runId, draft);
  }

  swapMapPreparedAction(
    runId: string,
    characterId: string,
    actionId: string,
    draft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.#mapRunOwner.swapPreparedAction(runId, characterId, actionId, draft);
  }

  issueMapPlayerCommand(
    runId: string,
    characterId: string,
    actionId: string,
    draft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.#mapRunOwner.issuePlayerCommand(runId, characterId, actionId, draft);
  }

  setMapPreparedTarget(
    runId: string,
    characterId: string,
    targetCharacterId: string | null,
    draft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.#mapRunOwner.setPreparedTarget(runId, characterId, targetCharacterId, draft);
  }

  setMapPreparedEnemyTarget(
    runId: string,
    characterId: string,
    targetEnemyId: string | null,
    draft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.#mapRunOwner.setPreparedEnemyTarget(runId, characterId, targetEnemyId, draft);
  }

  setMapPreparedCardTarget(runId: string, characterId: string, target: MapRunCardRef | null,
    draft: MapRunEncounterDraftToken): MapRun {
    return this.#mapRunOwner.setPreparedCardTarget(runId, characterId, target, draft);
  }

  setMapPreparedAdditionalTarget(runId: string, characterId: string, target: MapRunEncounterSourceTarget | null,
    draft: MapRunEncounterDraftToken): MapRun {
    return this.#mapRunOwner.setPreparedAdditionalTarget(runId, characterId, target, draft);
  }

  clearMapActionOverride(runId: string, characterId: string, draft: MapRunEncounterDraftToken): MapRun {
    return this.#mapRunOwner.clearActionOverride(runId, characterId, draft);
  }

  setMapAbilityDraft(
    runId: string,
    actionId: string | null,
    target: MapRunEncounterSourceTarget | null,
    draft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.#mapRunOwner.setAbilityDraft(runId, actionId, target, draft);
  }

  setMapItemDraft(
    runId: string,
    itemId: string | null,
    target: MapRunEncounterSourceTarget | null,
    draft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.#mapRunOwner.setItemDraft(runId, itemId, target, draft);
  }

  setMapAbilityAdditionalTarget(runId: string, target: MapRunEncounterSourceTarget | null,
    draft: MapRunEncounterDraftToken): MapRun {
    return this.#mapRunOwner.setAbilityAdditionalTarget(runId, target, draft);
  }

  setMapItemAdditionalTarget(runId: string, target: MapRunEncounterSourceTarget | null,
    draft: MapRunEncounterDraftToken): MapRun {
    return this.#mapRunOwner.setItemAdditionalTarget(runId, target, draft);
  }

  /** Read-only current-state source candidates; Item useCondition is evaluated without mutation. */
  previewMapEncounterSources(runId: string): MapRunEncounterSourcePreview | null {
    const run = this.#mapRunOwner.getSnapshot(runId);
    const encounter = run?.activeEncounter;
    if (!run || !encounter) return null;
    const definition = this.#mapContentResolver.resolve(run.mapId);
    const node = definition?.nodes.find(candidate => candidate.id === encounter.nodeId);
    const encounterDef = resolveMapEncounterDef(node, encounter.activityId);
    if (!definition || !encounterDef) return null;
    const actions = new Map((definition.actions ?? []).map(action => [action.id, action]));
    const livingCharacters = run.partyHp.filter(row => row.currentHp > 0).map(row => row.characterId);
    const livingEnemies = encounter.enemies.filter(row => row.currentHp > 0).map(row => row.enemyId);
    const scope: MapRelationScope = Object.freeze({
      runId: run.runId,
      mapId: definition.id,
      nodeId: encounter.nodeId,
      activityId: encounter.activityId ?? null,
      round: encounter.round,
    });
    const sourceOption = (actionId: string, selectedTarget: MapRunEncounterSourceTarget | null,
      selectedAdditionalTarget: MapRunEncounterSourceTarget | null) => {
      const action = actions.get(actionId);
      if (!action || !isActorlessSourceOptionAction(action)) return null;
      if (action.target.kind !== 'partyCharacter' && action.target.kind !== 'enemy') return null;
      const declaredEffects = summarizeProgramAction(action, {
        scope,
        source: null,
        primary: relationTarget(scope, selectedTarget),
      });
      return Object.freeze({
        actionId,
        name: action.name,
        description: action.description ?? null,
        targetKind: action.target.kind,
        legalTargetCharacterIds: Object.freeze(action.target.kind === 'partyCharacter'
          ? action.target.includeDefeated === true ? run.party.map(member => member.characterId) : [...livingCharacters] : []),
        legalTargetEnemyIds: Object.freeze(action.target.kind === 'enemy' ? [...livingEnemies] : []),
        ...(action.additionalTarget === undefined ? {} : {
          additionalTargetKind: action.additionalTarget,
          legalAdditionalTargetCharacterIds: Object.freeze(action.additionalTarget === 'partyCharacter'
            ? livingCharacters.filter(id => !(selectedTarget?.kind === 'partyCharacter' && selectedTarget.characterId === id)) : []),
          legalAdditionalTargetEnemyIds: Object.freeze(action.additionalTarget === 'enemy'
            ? livingEnemies.filter(id => !(selectedTarget?.kind === 'enemy' && selectedTarget.enemyId === id)) : []),
          additionalTargetSelectionRequired: selectedTarget !== null && selectedAdditionalTarget === null
            && ((action.additionalTarget === 'partyCharacter'
              ? livingCharacters.filter(id => !(selectedTarget.kind === 'partyCharacter' && selectedTarget.characterId === id)).length
              : livingEnemies.filter(id => !(selectedTarget.kind === 'enemy' && selectedTarget.enemyId === id)).length) > 0),
        }),
        ...(declaredEffects === undefined ? {} : { declaredEffects }),
      });
    };
    const abilityOptions = (encounterDef.abilityActionIds ?? []).flatMap(actionId => {
      const selected = encounter.abilityDraft?.actionId === actionId;
      const option = sourceOption(actionId, selected ? encounter.abilityDraft?.target ?? null : null,
        selected ? encounter.abilityDraft?.additionalTarget ?? null : null);
      return option ? [Object.freeze({
        ...option,
        canPayPlayerCost: run.playerCost >= 1,
        selected,
      })] : [];
    });
    const itemOptions = (encounterDef.itemActions ?? []).flatMap(mapping => {
      const selected = encounter.itemDraft?.itemId === mapping.itemId;
      const option = sourceOption(mapping.actionId, selected ? encounter.itemDraft?.target ?? null : null,
        selected ? encounter.itemDraft?.additionalTarget ?? null : null);
      const item = this.registry.items.get(mapping.itemId);
      if (!option || !item) return [];
      const inventoryCount = this._state.inventory[mapping.itemId] ?? 0;
      let useConditionSatisfied = true;
      try {
        if (item.useCondition) useConditionSatisfied = this.conditionSystem.evaluateGroup(item.useCondition, this._state);
      } catch {
        useConditionSatisfied = false;
      }
      return [Object.freeze({
        ...option,
        itemId: mapping.itemId,
        itemName: item.name,
        itemDescription: item.description ?? null,
        inventoryCount,
        useConditionSatisfied,
        canUse: item.type === 'consumable' && inventoryCount > 0 && useConditionSatisfied,
        selected,
      })];
    });
    return Object.freeze({
      nodeId: encounter.nodeId,
      round: encounter.round,
      draftVersion: encounter.draftVersion,
      selectedAbilityActionId: encounter.abilityDraft?.actionId ?? null,
      selectedAbilityTarget: encounter.abilityDraft?.target ? Object.freeze({ ...encounter.abilityDraft.target }) : null,
      selectedAbilityAdditionalTarget: encounter.abilityDraft?.additionalTarget ? Object.freeze({ ...encounter.abilityDraft.additionalTarget }) : null,
      selectedItemId: encounter.itemDraft?.itemId ?? null,
      selectedItemTarget: encounter.itemDraft?.target ? Object.freeze({ ...encounter.itemDraft.target }) : null,
      selectedItemAdditionalTarget: encounter.itemDraft?.additionalTarget ? Object.freeze({ ...encounter.itemDraft.additionalTarget }) : null,
      abilityOptions: Object.freeze(abilityOptions),
      itemOptions: Object.freeze(itemOptions),
    });
  }

  /** Commits one complete Encounter round through the sole MapRun Owner. */
  commitMapEncounterRound(command: MapRunEncounterCommitCommand): MapRun {
    const preparedRun = this.#mapRunOwner.prepareEncounterRoundCommit(command);
    if (!this.#mapRunOwner.canInstallPreparedEncounterCommit(preparedRun)) {
      throw new MapRunError(['the prepared Encounter Commit is stale']);
    }
    if (preparedRun.replayed) {
      this.#mapRunOwner.installPreparedEncounterCommit(preparedRun);
      return preparedRun.snapshot;
    }

    const preparedItem = preparedRun.itemId === null ? null : (() => {
      const item = this.registry.items.get(preparedRun.itemId);
      if (!item || item.type !== 'consumable') {
        throw new MapRunError([`Item "${preparedRun.itemId}" is missing or is not a Consumable`]);
      }
      if (item.useCondition && !this.conditionSystem.evaluateGroup(item.useCondition, this._state)) {
        throw new MapRunError([`Item "${preparedRun.itemId}" no longer meets its useCondition`]);
      }
      const debit = this.mutations.prepareMapRunItemConsumption(preparedRun.itemId);
      if (!debit) throw new MapRunError([`Item "${preparedRun.itemId}" is not in the current PlayerState inventory`]);
      return debit;
    })();
    if (!this.#mapRunOwner.canInstallPreparedEncounterCommit(preparedRun)
      || (preparedItem !== null && !this.mutations.canInstallPreparedMapRunItemConsumption(preparedItem))) {
      throw new MapRunError(['the prepared Encounter Commit or Item debit is stale']);
    }

    // No callbacks, events, awaits, or planning occur between the two owner installs.
    this.#mapRunOwner.installPreparedEncounterCommit(preparedRun);
    if (preparedItem !== null) this.mutations.installPreparedMapRunItemConsumption(preparedItem);
    if (preparedItem !== null) this.mutations.publishPreparedMapRunItemConsumption(preparedItem);
    return preparedRun.snapshot;
  }

  /** 剧情门面：story flow 统一入口（startStory / advanceStory / clickSend 等）。 */
  get story(): StoryService { return this.storyService; }
  /** 设施门面：升级 / 经理 / 产出 / tag 增撤。 */
  get spot(): SpotService { return this.spotService; }
  /** 世界线门面：进入 / 购买 / 三种重启路径。 */
  get inits(): InitService { return this.initService; }
  /** 物品门面：发放 / 使用 / 掉落表。 */
  get items(): ItemService { return this.itemService; }
  /** 强化门面：购买 / 移除 / 诊断。 */
  get enhancements(): EnhancementService { return this.enhancementService; }
  /** Chara 头像-人名对门面。 */
  get charaProfiles(): CharaProfileService { return this.charaProfileService; }
  /** 图片资产门面。 */
  get pics(): PicService { return this.picService; }

  getDevLogs(): readonly DevLogEntry[] { return this.devLog.getEntries(); }
  clearDevLogs(): void { this.devLog.clear(); }
  getOperationObservations(options?: { readonly limit?: number }): readonly OperationObservation[] {
    return this.operationObservationStore.list(options?.limit);
  }
  getOperationObservation(captureId: string): OperationObservation | null {
    return this.operationObservationStore.get(captureId);
  }
  recordOperationObservation(input: OperationObservationInput): OperationObservation {
    return this.operationObservationStore.capture(input);
  }

  /** 强制重算可见性快照（服务/门面共用）。 */
  private refreshVisibility(): void {
    this.visibilityEngine.recomputeAll(this._state);
  }

  /** 返回供 UI 使用的不可变数据快照，不暴露 PlayerState 写引用。 */
  getView(): GameView {
    return buildGameView({
      state: this._state,
      visibility: this.visibility,
      currentStory: this.storyService.getCurrentStoryView(),
      activeAffectors: this.affectorEngine.getActiveInstances(),
      stats: this.statsService.getSnapshot(),
    });
  }

  getAchievementView(): readonly AchievementViewItem[] {
    return buildAchievementView(this.registry, this._state, this.statsService.getSnapshot());
  }

  /**
   * 返回指定聊天沙盒（owner = VariantId）的当前剧情视图。
   * 与 getView().currentStory（全局游标）并行互不干扰——各角色对话空间有独立游标。
   */
  getStoryView(owner: string): StoryView | null {
    return this.storyService.getCurrentStoryView(owner);
  }

  setRuntimeAreaTopology(connections: readonly RuntimeAreaTopologyConnection[]): void {
    this.runtimeAreaTopology = connections.map(connection => ({ ...connection }));
  }

  clearRuntimeAreaTopology(): void {
    this.runtimeAreaTopology = [];
  }

  /** 静态 AreaDef、Runtime Editor Overlay 与 Affector 动态连接的统一可达性查询。 */
  availableAreaIds(areaId: string): string[] {
    return this.getAreaTravelGraph().neighbours(areaId);
  }

  reachableAreaIds(): string[] { return this.initService.reachableAreaIds(); }

  getAreaTravelGraph(): AreaTravelGraph {
    return new AreaTravelGraph(this.registry.areas, [
      ...this.runtimeAreaTopology.map(link => ({ fromAreaId: link.fromAreaId, toAreaId: link.toAreaId, direction: link.type })),
      ...this.affectorEngine.getActiveAreaConnections(),
    ], this.affectorEngine.getActiveAreaTransitNetworks());
  }

  // --- 初始化 ---

  /** 加载数据包并初始化游戏 */
  init(datapacks: Datapack[], options: RuntimeInitOptions = {}): void {
    // Prove the complete navigation reference set before disposing any live owners/state.
    const candidate = new Registry();
    for (const datapack of datapacks) candidate.load(datapack);
    candidate.validateAreaMapRefs();
    this.operationObservationStore.clear();
    this.#operationRuntimeOwner.reset();
    this.replaceMapRunOwner();
    this.sessionService.touchLastTick();
    // 加载所有数据包
    for (const dp of datapacks) {
      this.registry.load(dp);
      if (dp.affectorPacks) this.affectorEngine.load(dp.affectorPacks);
      if (dp.triggerDefs) this.triggerSystem.load(dp.triggerDefs);
    }

    // 同步子系统
    this.valueSystem.setFuncletDefs(this.registry.funcletDefs as Map<string, import('../../engine/types/index').FuncletDef>);
    this.funcletExecutor.setDefs(this.registry.funcletDefs as Map<string, import('../../engine/types/index').FuncletDef>);
    // Character 引用完整性：全部数据包加载完成后统一校验（跨包引用允许）
    this.registry.validateCharacterRefs();
    this.registry.validateAreaMapRefs();
    this.registry.validateShopRefs();
    this.registry.validateTagRefs();
    this.effectEngine.setState(this._state);
    this.tickSystem.setState(this._state);

    // 统一数值注册：构建每个 Resource 的 primitiveGain 树（懒求值）
    this.gameNumSystem.buildAll(this._state);
    this.tagStatService.setState(this._state);
    this.tagStatService.rebuildDeclared();
    // 被动闲聊池：数据包加载后重建 gate 依赖索引
    this.passivePoolSystem.rebuildIndex();

    // 加载角色系统
    this.characterSystem.clear();
    for (const dp of datapacks) {
      if (dp.characters) this.characterSystem.load(dp.characters);
    }

    // 计算可见性（事件驱动：建立反向索引并全量重算）
    this.visibilityEngine.rebuild(this._state);

    if (options.enterDefaultInit !== false) {
      // 兼容非 UI 调用方：传统初始化默认进入第一个可见 Init。
      const defaultInit = [...this.registry.inits.values()].find(
        i => !hasExistenceGate(i.revealTriggers),
      );
      if (defaultInit) {
        this.initService.enterInit(defaultInit.id);
      }
    }
    this.devLog.record(`已加载数据包 ${datapacks.length} 个`, {
      source: 'registry',
      level: 'success',
      details: `${this.registry.inits.size} init / ${this.registry.spots.size} spot / ${this.registry.items.size} item`,
    });
  }

  /**
   * 运行时整体替换数据包（多文件 Mod 载入后使用）：
   * 清空注册表与各子系统，重置运行时状态后重新 init。
   * 注意：数据包更换后旧存档语义失效，调用方应自行清除存档。
   */
  reload(datapacks: Datapack[], options: RuntimeInitOptions = {}): void {
    // 重载保持调用前的运行阶段：Lobby 重载后仍停留 Lobby，Active Init 才恢复默认 Init 接线。
    const enterDefaultInit = options.enterDefaultInit ?? Boolean(this._state.activeInit);
    reloadRuntime({
      stop: () => this.stop(),
      registry: this.registry,
      affectorEngine: this.affectorEngine,
      triggerSystem: this.triggerSystem,
      reset: () => this.reset(),
      init: d => this.init(d, { enterDefaultInit }),
    }, datapacks);
  }

  /** 重载数据包并恢复当前存档状态，供运行时编辑等短生命周期 Overlay 使用。 */
  reloadPreservingState(datapacks: Datapack[]): void {
    const saved = this.save();
    this.reload(datapacks, { enterDefaultInit: false });
    this.load(saved);
  }

  /** 手动推进一帧并返回本帧生产结果。 */
  tick(): TickResult {
    this.tickSystem.setState(this._state);
    // 产出求值走事件驱动精确失效（Phase 5）：mutation 写路径经事件定向 markDirty，
    // 未受影响的 gain 子树跨帧保持缓存。直接改 state 的调用方须走 StateMutationService。
    const result = this.tickSystem.tick();
    // Affector 贯穿 Area / 整个 Init 持续生效：每帧应用挂载中的效果
    this.affectorEngine.applyActiveEffects();
    this.effectEngine.setState(this._state);
    // 阻断态的对话空间：每帧检查 block 条件是否已满足（如到达指定区域/持有物品）
    this.recheckStudentBlocks();
    // 可见性由事件驱动增量更新，不在每帧全量重算
    this.statsService.recordTick();
    this.devLog.recordTick(result);
    return result;
  }

  /**
   * 对话空间阻断态复检（壁垒重启）：遍历当前被 block 锁定的学生，若其触发 entry 的
   * block 条件组现已满足，则解除锁定（StateMutationService.clearStudentBlock）。
   * 由 tick 与区域进入后调用，实现「剧情要求前往某地 → 到达后对话空间重启」的关卡式剧情。
   */
  private recheckStudentBlocks(): void {
    recheckBlocks({
      state: this._state,
      registry: this.registry,
      mutations: this.mutations,
      conditionSystem: this.conditionSystem,
    });
  }

  // --- 生命周期 ---

  /** 开始 Tick 循环 (1 tick/秒)。 */
  start(): void {
    this.sessionService.start();
  }

  /** 停止 Tick 循环 */
  stop(): void {
    this.sessionService.stop();
  }

  /** 结束该 Runtime 持有的局内服务，并停止 Tick 循环。 */
  dispose(): void {
    this.stop();
    this.#operationRuntimeOwner.dispose();
    this.replaceMapRunOwner();
  }

  /**
   * 移动到 Area（玩家入口）——可达性层。
   * 门槛链：存在 → 同 Init → 非演出锁定 → 相邻（checkAdjacency=true）→ 可见。
   * 非 passive 剧情演出进行中时禁止移动（防止演出背景被切换）；该限制对
   * Story 自身要求移动（travelToArea effect）放开；Story 移动可跳过拓扑（checkAdjacency=false）。
   */
  travelToArea(areaId: AreaId, allowDuringStory = false, checkAdjacency = true): TravelResult {
    const result = this.initService.travelToArea(areaId, allowDuringStory, checkAdjacency);
    if (result.success) this.recheckStudentBlocks(); // 到达新区域可能满足对话空间阻断条件
    return result;
  }

  getAreaTravelStatus(areaId: AreaId): TravelResult {
    return this.initService.getAreaTravelStatus(areaId);
  }

  // --- Extra 运行时 API（docs/13 §5.3） ---

  /**
   * 沿路径读取额外数据：按 全局 → per-Init → 数据包常量表 优先级查询（命中即返回）。
   * @param path Extra 路径，如 'story/choice/3'，'/' 分隔、禁空段。
   */
  getExtra(path: ExtraPath): ExtraValue | undefined {
    const global = getAtPath(this._state?.extras, path);
    if (global !== undefined) return global;
    const perInit = getAtPath(this._state?.initExtras, path);
    if (perInit !== undefined) return perInit;
    return getAtPath(this.registry.extras, path);
  }

  /** 写全局层额外数据（运行时动态数据；数据包常量表与 Def.extra 保持只读）。 */
  setExtra(path: ExtraPath, value: ExtraValue): void {
    if (!this._state.extras) this._state.extras = extra.dict({});
    setAtPath(this._state.extras, path, value);
  }

  /** 显式写当前 Init 的 per-Init 层额外数据（低频；随快照保存/恢复，软重启清空重建）。 */
  setPerInitExtra(path: ExtraPath, value: ExtraValue): void {
    if (!this._state.initExtras) this._state.initExtras = extra.dict({});
    setAtPath(this._state.initExtras, path, value);
  }

  /** 合并额外数据到全局层（深合并，同名路径叶子被覆盖；source 需为 dict）。 */
  mergeExtras(source: ExtraCompound): void {
    if (!this._state.extras) this._state.extras = extra.dict({});
    mergeExtra(this._state.extras, source);
  }

  // --- 存档 ---

  /** 导出存档数据 */
  save(): SaveData {
    // visibility 是派生数据：生成存档时按当前 Registry/State 重算，避免旧快照
    // 缺少新增的 Init 或 GlobalEnh 条目而在下次读档时被误判为不可见。
    this.refreshVisibility();
    const saveData = this.saveCodec({
      state: this._state,
      visibility: () => this.visibilityEngine.getVisibility(this._state),
      storyCursor: () => this.storyService.saveCursor(),
      chatCursors: () => this.storyService.saveChatCursors(),
      persistedStats: () => this.statsService.getPersistable(),
      activeModNames: this.registry.loadedModNames,
      retainedTagResidue: this._tagResidue,
      operationRun: () => this._operationEntry.createSaveSnapshot(),
      mapRun: () => this.#mapRunOwner.createSaveSnapshot(),
    });
    this._tagResidue = saveData.retained ?? { spotTagOverrides: {} };
    return saveData;
  }

  /** 从存档数据恢复 */
  load(saveData: SaveData): void {
    this.operationObservationStore.clear();
    this.#operationRuntimeOwner.reset();
    this.replaceMapRunOwner();
    restoreFromSave({
      registry: this.registry,
      devLog: this.devLog,
      mutations: this.mutations,
      statsService: this.statsService,
      affectorEngine: this.affectorEngine,
      triggerSystem: this.triggerSystem,
      effectEngine: this.effectEngine,
      tickSystem: this.tickSystem,
      tagStatService: this.tagStatService,
      visibilityEngine: this.visibilityEngine,
      storyService: this.storyService,
      initService: this.initService,
      sessionService: this.sessionService,
      eventBus: this.eventBus,
      setState: next => {
        this._state = next;
        this.gameNumSystem.buildAll(this._state);
      },
      setTagResidue: residue => { this._tagResidue = residue; },
    }, saveData);
    const mapResume = this.#mapRunOwner.restoreSaveSnapshot(saveData.mapRun);
    if (mapResume.status === 'rejected') {
      this.devLog.record('地图续局未恢复，可重新进入地图', {
        source: 'map-run',
        level: 'warning',
        details: mapResume.diagnostics.join('; '),
      });
    }
    const operationResume = this._operationEntry.restoreSaveSnapshot(saveData.operationRun);
    if (operationResume.status === 'rejected') {
      this.devLog.record('玩法 B 续局未恢复，可重新开始事件', {
        source: 'operation',
        level: 'warning',
        details: operationResume.diagnostics.join('; '),
      });
    }
  }

  /** 重置为默认状态 */
  reset(): void {
    this.operationObservationStore.clear();
    this.#operationRuntimeOwner.reset();
    this.replaceMapRunOwner();
    this._tagResidue = { spotTagOverrides: {} };
    resetRuntime({
      stop: () => this.stop(),
      createDefaultState: () => createDefaultPlayerState(),
      setState: next => {
        this._state = next;
        this.gameNumSystem.buildAll(this._state);
      },
      sessionService: this.sessionService,
      eventBus: this.eventBus,
      mutations: this.mutations,
      statsService: this.statsService,
      affectorEngine: this.affectorEngine,
      triggerSystem: this.triggerSystem,
      tagStatService: this.tagStatService,
      initService: this.initService,
      visibilityEngine: this.visibilityEngine,
      storyService: this.storyService,
      devLog: this.devLog,
    });
  }

  // --- 默认状态 ---

  private createDefaultState(): PlayerState {
    return createDefaultPlayerState();
  }

}
