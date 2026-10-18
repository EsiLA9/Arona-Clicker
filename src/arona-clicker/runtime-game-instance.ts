import type { Datapack } from '../data-services/contracts/datapack';
import type {
  GameplayEncounterDef,
  GameplayMapActivityDef,
  GameplayMapNodeDef,
} from '../data-services/contracts/gameplay-map';
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
} from '../engine/types';
import type { VisibilitySnapshot } from '../engine/contracts/reveal';
import type { PlayerState } from './types/state';
import type { GameView, StoryView } from './contracts';
import type { RuntimeAreaTopologyConnection } from './contracts/runtime-content';
import type { TickResult } from '../engine/contracts/tick';
import type { TravelResult } from './contracts/results';
import { StoryService } from './services/story-service';
import { SpotService } from './services/spot-service';
import { InitService } from './services/init-service';
import { ItemService } from './services/item-service';
import { EnhancementService } from './services/enhancement-service';
import { SessionService } from '../engine/runtime/session-service';
import { ChatFlowService } from './services/chat-flow-service';
import { buildGameView } from './read-model/game-view-builder';
import { buildAchievementView } from './read-model/achievement-view';
import type { AchievementViewItem } from './read-model/achievement-view';
import { OperationObservationStore } from './operation-observation';
import type { OperationObservation, OperationObservationInput } from './contracts/operation-observation';
import type {
  MapRun,
  MapRunEncounterCommitCommand,
  MapRunEncounterDraftToken,
  MapRunPartyMember,
  MapRunEncounterSourcePreview,
  MapRunEncounterSourceTarget,
  MapRunShopDraftToken,
} from './contracts/map-run';
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
} from './contracts/runtime';
import { OperationRuntimeService } from './services/operation-runtime-service';
import { createOperationEntry } from './services/operation-entry-service';
import type { OperationEntryFacade } from './services/operation-entry-service';
import { createRegistryOperationContentResolver } from './services/registry-operation-content-resolver';
import { MapRunError, MapRunService } from './services/map-run-service';
import { createRegistryMapContentResolver } from './services/registry-map-content-resolver';
import type { MapContentResolver } from './contracts/map-content-resolver';
import { createDefaultState as createDefaultPlayerState } from './state/state-factory';
import { buildSaveData } from './runtime-save-codec';
import { restoreFromSave } from './runtime-save';
import { recheckStudentBlocks as recheckBlocks, reloadRuntime, resetRuntime } from './runtime-reset';
import { wireGameInstance } from './runtime-wiring';

import { extra, getAtPath, mergeExtra, setAtPath } from '../engine/extra/index';
import { ImageStore } from '../data-services/assets/image-store';
import { hasExistenceGate } from '../engine/visibility/reveal';
import { Registry } from '../data-services/registry/registry';
import { createRuntimeContentBrowser } from '../data-services/registry/runtime-content-browser';
import type { RuntimeContentBrowserQueryPort } from '../data-services/contracts/runtime-content-browser';
import type { WorldCatalogQueryPort } from './contracts/world-catalog';
import { EventBus } from '../engine/core/event-bus';
import { ValueSystem } from '../engine/expression/value-system';
import { ConditionSystem } from '../engine/expression/condition-system';
import { FuncletExecutor } from '../engine/expression/funclet-executor';
import { EffectEngine } from '../engine/effect/effect-engine';
import { TickSystem } from '../engine/system/tick-system';
import { LootSystem } from './services/loot-system';
import { VisibilityEngine } from '../engine/visibility/visibility-engine';
import { StateMutationService } from './state/state-mutation-service';
import { AffectorEngine } from '../engine/effect/affector-engine';
import { DevLog, DevLogEntry, DevLogOptions } from '../engine/core/dev-log';
import { StatsService } from '../engine/stats/stats';
import { SpotFunctionalitySystem } from './services/spot-functionality';
import { GameNumSystem } from '../engine/expression/game-num';
import { TriggerSystem } from '../engine/effect/trigger-system';

import { CharacterSystem } from './services/character-system';
import { RosterSystem } from './services/roster-system';
import { CharacterAvailabilityService } from './services/character-availability';
import { ColorSystem } from './services/color-system';
import type { EntityPresentationQueryPort } from './contracts/entity-presentation-query';
import { ColorEquipmentSystem } from './services/color-equipment-system';
import { GearSystem } from './services/gear-system';
import { GachaService } from './services/gacha-service';
import { TagStatService } from '../engine/stats/tag-stats';
import { PassivePoolSystem } from './services/passive-pool-system';
import { CharaProfileService } from './services/chara-profile-service';
import { PicService } from '../data-services/assets/pic-service';
import { UserThemeService } from './services/user-theme-service';
import { ShopService } from './services/shop-service';
import type { StoryFollowUpMount } from './services/story-follow-up-mount';

import type { SaveData } from './contracts/save-data';
import { clearTagResidueByMod, summarizeTagResidue, type TagOverrideResidue } from './state/tag-residue';
import type { SaveBuildContext } from './contracts/save-codec';
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
    const partyHp = Object.freeze(run.partyHp.map(row => {
      const hp = definition?.initialPartyHp.find(candidate => candidate.characterId === row.characterId);
      if (!hp) throw new MapRunError([`Map party HP cap for "${row.characterId}" is unavailable to the Workspace projection`]);
      return Object.freeze({ characterId: row.characterId, currentHp: row.currentHp, maxHp: hp.maxHp });
    }));
    const enemyHpById = new Map((run.activeEncounter?.enemies ?? []).map(row => [row.enemyId, row.currentHp]));
    const enemies = Object.freeze((encounter.enemies ?? []).map(enemy => Object.freeze({
      enemyId: enemy.id,
      currentHp: enemyHpById.get(enemy.id) ?? enemy.initialHp,
      maxHp: enemy.maxHp,
      damage: enemy.damage,
    })));
    const completion = encounter.completion?.kind === 'manual'
      ? Object.freeze({ kind: 'manual' as const, label: encounter.completion.label })
      : undefined;
    return Object.freeze({
      mapId: run.mapId,
      nodeId,
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
  ): MapRunEncounterWorkspaceView | null {
    const encounter = run.activeEncounter;
    if (!encounter) return null;
    const preview = this.#mapRunOwner.previewActions(run.runId);
    const commitPreview = this.#mapRunOwner.previewEncounterCommit(run.runId);
    if (!preview || !commitPreview) return null;

    const actionById = new Map((definition.actions ?? []).map(action => [action.id, action]));
    const actionViewById = new Map<string, MapWorkspaceActionView>();
    const projectAction = (actionId: string | null): MapWorkspaceActionView | null => {
      if (actionId === null) return null;
      const cached = actionViewById.get(actionId);
      if (cached) return cached;
      const action = actionById.get(actionId);
      if (!action) throw new MapRunError([`Map Action "${actionId}" is unavailable to the Workspace projection`]);
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
        hpEffects: Object.freeze((action.hpEffects ?? []).map(effect => Object.freeze({ amount: effect.amount }))),
      });
      actionViewById.set(actionId, projected);
      return projected;
    };
    const requiredActionView = (actionId: string): MapWorkspaceActionView => {
      const action = projectAction(actionId);
      if (!action) throw new MapRunError([`Map Action "${actionId}" is unavailable to the Workspace projection`]);
      return action;
    };

    const preparedActions = Object.freeze(preview.preparedActions.map(prepared => Object.freeze({
      characterId: prepared.characterId,
      hand: Object.freeze(prepared.handActionIds.map(requiredActionView)),
      naturalAction: projectAction(prepared.naturalActionId),
      preparedAction: projectAction(prepared.preparedActionId),
      targetKind: prepared.targetKind,
      legalTargetCharacterIds: Object.freeze([...prepared.legalTargetCharacterIds]),
      legalTargetEnemyIds: Object.freeze([...(prepared.legalTargetEnemyIds ?? [])]),
      targetCharacterId: prepared.targetCharacterId,
      targetEnemyId: prepared.targetEnemyId ?? null,
      targetSelectionRequired: prepared.targetSelectionRequired,
      overrideKind: prepared.overrideKind,
      playerCost: prepared.playerCost,
    })));
    const playerCommandOptions = Object.freeze(preview.playerCommandOptions.map(option => Object.freeze({
      characterId: option.characterId,
      action: requiredActionView(option.actionId),
      playerCost: option.playerCost,
      canPayPlayerCost: option.canPayPlayerCost,
      canPayActionCosts: option.canPayActionCosts,
    })));
    const recentCommit = encounter.lastCommit === null ? null : Object.freeze({
      requestId: encounter.lastCommit.requestId,
      commandVersion: encounter.lastCommit.commandVersion,
      resultingCommitVersion: encounter.lastCommit.resultingCommitVersion,
      nodeId: encounter.lastCommit.nodeId,
      round: encounter.lastCommit.round,
      draftVersion: encounter.lastCommit.draftVersion,
      settlements: Object.freeze(encounter.lastCommit.settlements.map(settlement => Object.freeze({
        characterId: settlement.characterId,
        action: projectAction(settlement.actionId),
        targetCharacterId: settlement.targetCharacterId,
        targetEnemyId: settlement.targetEnemyId ?? null,
        overrideKind: settlement.overrideKind,
        playerCostSpent: settlement.playerCostSpent,
        resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
        hpChanges: Object.freeze([...(settlement.hpChanges ?? [])].map(change => Object.freeze({ ...change }))),
      }))),
      ability: encounter.lastCommit.ability ? Object.freeze({
        action: projectAction(encounter.lastCommit.ability.actionId),
        target: Object.freeze({ ...encounter.lastCommit.ability.target }),
        playerCostSpent: encounter.lastCommit.ability.playerCostSpent,
        hpChanges: Object.freeze(encounter.lastCommit.ability.hpChanges.map(change => Object.freeze({ ...change }))),
      }) : null,
      item: encounter.lastCommit.item ? Object.freeze({
        itemName: this.registry.items.get(encounter.lastCommit.item.itemId)?.name ?? encounter.lastCommit.item.itemId,
        action: projectAction(encounter.lastCommit.item.actionId),
        target: Object.freeze({ ...encounter.lastCommit.item.target }),
        consumedCount: encounter.lastCommit.item.consumedCount,
        hpChanges: Object.freeze(encounter.lastCommit.item.hpChanges.map(change => Object.freeze({ ...change }))),
      }) : null,
      enemyAttacks: Object.freeze([...(encounter.lastCommit.enemyAttacks ?? [])].map(attack => Object.freeze({ ...attack }))),
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
      playerCommandOptions,
      commitPreview: Object.freeze({
        canCommit: commitPreview.canCommit,
        playerCostRequired: commitPreview.playerCostRequired,
        diagnostics: Object.freeze([...commitPreview.diagnostics]),
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

    const teamBalances = new Map(run.teamResources.map(row => [row.resourceId, row.value]));
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
            resourceId: edge.condition.resourceId,
            amount: edge.condition.amount,
            satisfied: (teamBalances.get(edge.condition.resourceId) ?? 0) >= edge.condition.amount,
          }),
        }),
      }))),
    });
    const actionPreview = this.getMapEncounterWorkspaceView(run, definition);

    return Object.freeze({
      kind: 'active' as const,
      run,
      map,
      currentEncounter: this.getCurrentMapEncounter(),
      activities: this.getMapActivitiesView(run, definition),
      shop: this.getMapShopView(run, definition),
      actionPreview,
      sourcePreview: this.previewMapEncounterSources(runId),
    });
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

  /** Resolves the Map's fixed party against current ownership without writing PlayerState. */
  private admitMapParty(mapId: string, characterIds: readonly string[]): MapRunPartyMember[] {
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

    const diagnostics: string[] = [];
    const admittedParty: MapRunPartyMember[] = [];
    for (const characterId of characterIds) {
      if (!unlockedCharacterIds.has(characterId)) {
        diagnostics.push(`Map "${mapId}" party Character "${characterId}" is not currently owned or unlocked`);
        continue;
      }
      const variantId = variantIdByCharacter.get(characterId);
      if (!variantId) {
        diagnostics.push(`Map "${mapId}" party Character "${characterId}" has no owned registered Variant`);
        continue;
      }
      admittedParty.push({ characterId, variantId });
    }

    if (diagnostics.length > 0) throw new MapRunError(diagnostics);
    return admittedParty;
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
    const sourceOption = (actionId: string) => {
      const action = actions.get(actionId);
      if (!action || action.eligibleCharacterIds.length !== 0
        || (action.target.kind !== 'partyCharacter' && action.target.kind !== 'enemy')) return null;
      return Object.freeze({
        actionId,
        name: action.name,
        description: action.description ?? null,
        targetKind: action.target.kind,
        legalTargetCharacterIds: Object.freeze(action.target.kind === 'partyCharacter' ? [...livingCharacters] : []),
        legalTargetEnemyIds: Object.freeze(action.target.kind === 'enemy' ? [...livingEnemies] : []),
        hpEffects: Object.freeze((action.hpEffects ?? []).map(effect => Object.freeze({ amount: effect.amount }))),
      });
    };
    const abilityOptions = (encounterDef.abilityActionIds ?? []).flatMap(actionId => {
      const option = sourceOption(actionId);
      return option ? [Object.freeze({
        ...option,
        canPayPlayerCost: run.playerCost >= 1,
        selected: encounter.abilityDraft?.actionId === actionId,
      })] : [];
    });
    const itemOptions = (encounterDef.itemActions ?? []).flatMap(mapping => {
      const option = sourceOption(mapping.actionId);
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
        selected: encounter.itemDraft?.itemId === mapping.itemId,
      })];
    });
    return Object.freeze({
      nodeId: encounter.nodeId,
      round: encounter.round,
      draftVersion: encounter.draftVersion,
      selectedAbilityActionId: encounter.abilityDraft?.actionId ?? null,
      selectedAbilityTarget: encounter.abilityDraft?.target ? Object.freeze({ ...encounter.abilityDraft.target }) : null,
      selectedItemId: encounter.itemDraft?.itemId ?? null,
      selectedItemTarget: encounter.itemDraft?.target ? Object.freeze({ ...encounter.itemDraft.target }) : null,
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
    if (!this.registry.areas.has(areaId)) return [];
    const result = new Set<string>(this.registry.areas.get(areaId)?.adjacentAreaIds ?? []);
    for (const connection of this.runtimeAreaTopology) {
      if (connection.fromAreaId === areaId) result.add(connection.toAreaId);
      if (connection.type === 'twoWay' && connection.toAreaId === areaId) result.add(connection.fromAreaId);
    }
    for (const connection of this.affectorEngine.getActiveAreaConnections()) {
      if (connection.fromAreaId === areaId) result.add(connection.toAreaId);
      if (connection.direction === 'twoWay' && connection.toAreaId === areaId) result.add(connection.fromAreaId);
    }
    return [...result];
  }

  // --- 初始化 ---

  /** 加载数据包并初始化游戏 */
  init(datapacks: Datapack[], options: RuntimeInitOptions = {}): void {
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
    this.valueSystem.setFuncletDefs(this.registry.funcletDefs as Map<string, import('../engine/types').FuncletDef>);
    this.funcletExecutor.setDefs(this.registry.funcletDefs as Map<string, import('../engine/types').FuncletDef>);
    // Character 引用完整性：全部数据包加载完成后统一校验（跨包引用允许）
    this.registry.validateCharacterRefs();
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
