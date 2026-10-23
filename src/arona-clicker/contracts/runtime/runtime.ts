import type { AreaId, EntityThemeSlot, SpotId, ThemeOrderScope, VariantId } from '../../../engine/types/index';
import type { MapActionRelation, MapDeclaredEffectSummary } from '../map/map-relations';
import type { MapRunCardInstance, MapRunCardRef } from '../map/map-cards';
import type { InitPurchaseResult } from '../../../data-services/contracts/world';
import type { PlayerState } from '../../types/state';
import type { TickResult } from '../../../engine/contracts/tick';
import type { EnhancementPurchaseResult, GameView, SendResult, SpotUnlockResult, SpotUpgradeResult, StoryAdvanceResult, StoryStartResult, TravelResult, UseItemResult, StoryView } from '../index';
import type { RollSummary } from '../../services/economy/gacha-service';
import type { SaveData } from './save-data';
import type { DevLogEntry } from '../../../engine/core/dev-log';
import type { ContentCatalogQueryPort } from './content-catalog';
import type { AreaMapQueryPort } from '../world/area-map-query';
import type { RuntimeContentBrowserQueryPort } from '../../../data-services/contracts/runtime-content-browser';
import type { ValueQueryPort } from './value-query';
import type { ConditionQueryPort } from './condition-query';
import type { GameNumQueryPort } from '../../../engine/contracts/game-num-query';
import type { AffectorQueryPort } from './affector-query';
import type { AvailabilityQueryPort } from '../character/availability-query';
import type { GachaQueryPort } from '../economy/gacha-query';
import type { SpotFunctionalityQueryPort } from '../../../engine/contracts/spot-functionality-query';
import type { StatsQueryContext } from '../../../engine/contracts/stats';
import type { PicQueryPort } from '../presentation/pic-query';
import type { SpotQueryPort } from '../world/spot-query';
import type { RosterQueryPort } from '../character/roster-query';
import type { ColorQueryPort } from '../progression/color-query';
import type { ColorEquipmentQueryPort } from '../progression/color-equipment-query';
import type { GearQueryPort } from '../progression/gear-query';
import type { StoryQueryPort } from '../story/story-query';
  import type { DatapackIdentity, DatapackSelectionSlot, EditingMode, PackConfigurationDraft, PackDependencyStatus, PackSourceKind, RuntimeApplyPlan, StoredPack } from '../../../data-services/datapack/pack-manager';
import type { WorldCatalogQueryPort } from '../world/world-catalog';
import type { UserThemeService } from '../../services/presentation/user-theme-service';
import type { ShopQueryPort } from '../economy/shop-query';
import type { RuntimeAreaTopologyDraft, RuntimeDefinitionEditorCommands, RuntimeModStateSnapshot, RuntimePaymentOptionDraft, RuntimeSpotFunctionalityDraft, RuntimeSpotLevelUpgradeDraft, RuntimeSpotMutation, RuntimeSpotMutationResult, RuntimeSpotRevealTriggerDraft, RuntimeWorldApplyResult, RuntimeWorldDraft, RuntimeWorldStateSnapshot } from './runtime-content';
import type { DefMetadata } from '../../../data-services/contracts/common';
import type { EnhancementAttachment } from '../../../data-services/contracts/enhancement';
import type { EntityPresentationQueryPort } from '../presentation/entity-presentation-query';
import type { Datapack } from '../../../data-services/contracts/datapack';
import type { AchievementViewItem } from '../../read-model/achievement-view';
import type { OperationObservation } from '../operation/operation-observation';
import type { OperationViewQuery } from '../operation/operation-view';
import type { MapEntryView } from '../map/map-entry';
import type {
  MapRun,
  MapRunActionOverride,
  MapRunEncounterProgramScope,
  MapRunEncounterProgramVisit,
  MapRunEncounterCommitCommand,
  MapRunEncounterDraftToken,
  MapRunFailureResult,
  MapRunEncounterSourcePreview,
  MapRunEncounterSourceTarget,
  MapRunEncounterHpChange,
  MapRunEncounterExecutionSequenceEntry,
  MapRunCardEffectModifierReceipt,
  MapRunEncounterSettlementResourceChange,
  MapRunShopDraftToken,
  MapRunSuccessResult,
} from '../map/map-run';
import type {
  MapEffectLocalsState,
  MapEffectStatusTickTraceEntry,
  MapEffectTraceEntry,
  MapEffectStatusRemoveTraceEntry,
  MapEffectStatusConsumeTraceEntry,
  MapEffectStatusCategoryRemoveTraceEntry,
  MapEffectShieldTraceEntry,
  MapEffectTriggerTraceEntry,
  MapEffectStatusExpiryTriggerTraceEntry,
  MapEffectStatusDamageTriggerTraceEntry,
  MapEncounterStatusInstance,
  MapRunStatusInstance,
} from '../map/map-effects';
import type { GameplayMapEffectConditionDef } from '../../../data-services/contracts/gameplay-map-effects';
import type { PackManifestColor } from '../../../data-services/datapack/manifest';
import type { ThemeContentEditorService } from '../../services/presentation/theme-content-editor-service';

export interface PackCatalogEntry {
  readonly id: string;
  readonly packRecordId?: string;
  readonly modName: string;
  readonly name: string;
  readonly version: string;
  readonly editingMode?: EditingMode;
  readonly sourcePackRecordId?: string;
  readonly sourceDigest?: string;
  readonly contentDigest?: string;
  readonly author?: string;
  readonly color?: PackManifestColor;
  readonly dependencies: readonly string[];
  readonly sourceKind: PackSourceKind;
  readonly sourcePath?: string;
  readonly importedAt: number;
  readonly enabled: boolean;
  readonly capabilities?: {
    readonly required: boolean;
    readonly removable: boolean;
    readonly reorderable: boolean;
    readonly enableable: boolean;
  };
}

/** 包库记录的只读内容面；编辑器通过记录身份读取，不依赖全局临时 Mod。 */
export interface PackCatalogRecord {
  readonly packRecordId: string;
  readonly editingMode: EditingMode;
  readonly sourcePackRecordId?: string;
  readonly manifest: {
    readonly modName: string;
    readonly name: string;
    readonly version: string;
    readonly author?: string;
    readonly color?: PackManifestColor;
    readonly dependencies: readonly string[];
  };
  readonly datapack: Datapack;
}

  export interface PackCatalogDependencyHint {
  readonly packId: string;
  readonly dependency: string;
  readonly status: PackDependencyStatus;
  }

  export interface PackCatalogPane {
    readonly paneKey: string;
    readonly modName: string;
    readonly version: string;
    readonly fixed?: PackCatalogEntry;
    readonly editing?: PackCatalogEntry;
    readonly selectedSlot: DatapackSelectionSlot;
    readonly runtimePackRecordId?: string;
  }

  export interface PackCatalogReadModel {
  getPackCatalog(): { entries: readonly PackCatalogEntry[]; dependencies: readonly PackCatalogDependencyHint[]; panes?: readonly PackCatalogPane[] };
  getPackRecord?(packRecordId: string): PackCatalogRecord | null;
  getEditingPackDraft?(packRecordId: string): RuntimeModDraft | null;
  getPackConfiguration?(): PackConfigurationDraft;
  getRuntimeMod?(): RuntimeModDraft | null;
  getRuntimeContentState?(): RuntimeModStateSnapshot;
  getRuntimeWorldState?(): RuntimeWorldStateSnapshot;
}

export interface PackValidationReport {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

  export interface PackApplyResult {
  readonly ok: boolean;
  readonly message: string;
    readonly validation: PackValidationReport;
    readonly plan?: RuntimeApplyPlan;
}

export interface RuntimeModDraft {
  /** 新建/修改内容必须明确归属的编辑态数据包记录。 */
  readonly targetPackRecordId?: string;
  readonly modName: string;
  readonly displayName: string;
  readonly version: string;
  readonly author: string;
  readonly description: string;
  readonly spots: readonly RuntimeSpotDraftSnapshot[];
  /** Runtime Editor 的 reload 型内容：仅保存临时 Mod 自有的草稿记录。 */
  readonly inits?: readonly RuntimeInitDraft[];
  readonly areas?: readonly RuntimeAreaDraft[];
  readonly enhancements?: readonly RuntimeEnhancementDraft[];
  /** Draft 中保留但当前 Runtime Preview 不物化的 Spot。 */
  readonly suspendedSpotIds?: readonly string[];
  readonly suspendedInitIds?: readonly string[];
  readonly suspendedAreaIds?: readonly string[];
  readonly suspendedEnhancementIds?: readonly string[];
}

export interface RuntimeResourceAmountDraft {
  readonly resourceId: string;
  readonly amount: number;
}

export interface RuntimeInitDraft {
  readonly idName: string;
  readonly name: string;
  readonly description: string;
  readonly defaultAreas: readonly string[];
  readonly startStoryId?: string;
  readonly purchaseCost?: readonly RuntimeResourceAmountDraft[];
  readonly worldTilt?: string;
  readonly worldTiltAlias?: string;
  readonly tags?: readonly string[];
  readonly revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
}

export interface RuntimeAreaDraft {
  readonly navigationMapId?: string;
  readonly idName: string;
  readonly initId: string;
  readonly name: string;
  readonly description: string;
  readonly defaultSpots: readonly string[];
  readonly adjacentAreaIds?: readonly string[];
  readonly topology?: readonly RuntimeAreaTopologyDraft[];
  readonly tags?: readonly string[];
  readonly revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
}

export interface RuntimeEnhancementDraft {
  readonly idName: string;
  readonly name: string;
  readonly description: string;
  readonly autoApply?: boolean;
  readonly maxStacks?: number;
  readonly irreversible?: boolean;
  readonly attachment?: EnhancementAttachment;
  readonly price?: readonly RuntimeResourceAmountDraft[];
  readonly tags?: readonly string[];
  readonly revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
}

/** 运行时侧可编辑 Spot 快照：键与 `ContentAuthoringPolicy` 的输入键对齐（round-trip 投影）。 */
export interface RuntimeSpotDraftSnapshot {
  readonly idName: string;
  readonly metadata?: DefMetadata;
  readonly areaId: string;
  readonly name: string;
  readonly description: string;
  readonly purchaseOptions: readonly RuntimePaymentOptionDraft[];
  readonly maxLevel?: number;
  readonly conditionText?: string;
  readonly global?: boolean;
  readonly functionalities?: readonly RuntimeSpotFunctionalityDraft[];
  readonly levelUpgrades?: readonly RuntimeSpotLevelUpgradeDraft[];
  readonly revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
  /** 层级标签以 `a/b` 路径形式传出。 */
  readonly tags?: readonly string[];
  readonly gachaPools?: readonly string[];
  /** 不能由编辑器 round-trip 的功能 id：仅用于展示诊断并阻止静默覆盖。 */
  readonly unsupportedFunctionalityIds?: readonly string[];
  /** 不能由编辑器无损 round-trip 的支付方案路径；存在时阻止静默覆盖。 */
  readonly unsupportedPaymentOptionPaths?: readonly string[];
}

export interface RuntimeModApplyResult {
  readonly ok: boolean;
  readonly message: string;
}

  export interface PackCatalogCommands {
  setPackEnabled(id: string, enabled: boolean): void;
  reorderPacks(ids: readonly string[]): void;
  applyEnabledPacks(): void;
  /** 从包库移除数据包（仅允许非内置、未启用包；不触发 reload）。 */
    removePack?(id: string, options?: { readonly editorDirty?: boolean }): void;
  createEditingPack?(sourcePackRecordId: string, versionId?: string): { ok: boolean; packRecordId?: string; message: string };
  convertEditingPackToNormal?(sourcePackRecordId: string): { ok: boolean; packRecordId?: string; message: string };
  openEditingPack?(packRecordId: string): RuntimeModApplyResult;
  validatePackConfiguration?(draft: PackConfigurationDraft): PackValidationReport;
    applyPackConfiguration?(draft: PackConfigurationDraft): PackApplyResult;
    setPackSelection?(paneKey: string, selectedSlot: DatapackSelectionSlot): void;
    applyPackSelection?(): PackApplyResult;
    createEmptyEditingPack?(identity: DatapackIdentity): { ok: boolean; packRecordId?: string; message: string };
    clonePackAsEditing?(sourcePackRecordId: string, targetIdentity?: DatapackIdentity): { ok: boolean; packRecordId?: string; message: string };
    exportPackRecord?(packRecordId: string, options?: { readonly versionId?: string }): { ok: boolean; pack?: StoredPack; message: string };
  applyRuntimeMod?(draft: RuntimeModDraft): RuntimeModApplyResult;
  /** 以单个 Spot 为单位提交热内容 CRUD；不接收完整 RuntimeModDraft。 */
  applyRuntimeSpotMutation?(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult;
  /** Init / Area 的局部热 CRUD；不触发整包 reload。 */
  applyRuntimeWorldDraft?(draft: RuntimeWorldDraft): RuntimeWorldApplyResult;
  /** 设置临时 Mod 元信息；不触发数据包重载。 */
  setRuntimeModMetadata?(metadata: Pick<RuntimeModDraft, 'modName' | 'displayName' | 'version' | 'author' | 'description'> & { readonly targetPackRecordId?: string }): RuntimeModApplyResult;
  runtimeDefinitionEditor?: RuntimeDefinitionEditorCommands;
  /** 删除临时 Mod 中单个 Spot 后清理其 PlayerData，不移除整个临时 Mod。 */
  removeRuntimeSpotData?(spotId: string): RuntimeModApplyResult;
  removeRuntimeMod?(preservePlayerData?: boolean): RuntimeModApplyResult;
}

/** UI 可读取的 AronaClicker 运行时快照与查询能力。 */
export interface GameReadModel {
  readonly areaMap: AreaMapQueryPort;
  readonly state: Readonly<PlayerState>;
  readonly registry: ContentCatalogQueryPort;
  /** 当前 Registry 的只读有效内容图鉴；不包含 PackCatalog / 编辑态 Draft。 */
  readonly runtimeContentBrowser: RuntimeContentBrowserQueryPort;
  readonly world: WorldCatalogQueryPort;
  readonly valueSystem: ValueQueryPort;
  readonly conditionSystem: ConditionQueryPort;
  readonly gameNumSystem: GameNumQueryPort;
  readonly affectorEngine: AffectorQueryPort;
  readonly rosterSystem: RosterQueryPort;
  readonly availabilityService: AvailabilityQueryPort;
  readonly colorSystem: ColorQueryPort;
  readonly entityPresentation?: EntityPresentationQueryPort;
  readonly colorEquipmentSystem: ColorEquipmentQueryPort;
  readonly gearSystem: GearQueryPort;
  readonly gachaService: GachaQueryPort;
  readonly spotFunctionalitySystem: SpotFunctionalityQueryPort;
  readonly shopService: ShopQueryPort;
  readonly statsService: StatsQueryContext;
  readonly pics: PicQueryPort;
  readonly userThemeService: UserThemeService;
  readonly story: StoryQueryPort;
  readonly spot: SpotQueryPort;
  /** Read-only Gameplay B projection; excludes EventRun and all mutation commands. */
  readonly operationEntry: OperationViewQuery;
  /** Detached read-only MapRun and current Encounter projection. */
  readonly mapRun: MapRunQuery;
  getView(): GameView;
  getAchievementView(): readonly AchievementViewItem[];
  availableAreaIds(areaId: string): string[];
  /** Current navigation destinations: direct exits and valid explored routes. */
  reachableAreaIds(): string[];
  /** Pure snapshot of normal player travel admission; never performs travel. */
  getAreaTravelStatus(areaId: string): TravelResult;
  getStoryView(owner: string): StoryView | null;
  getDevLogs(): readonly DevLogEntry[];
  getOperationObservations(options?: { readonly limit?: number }): readonly OperationObservation[];
  getOperationObservation(captureId: string): OperationObservation | null;
}

/** Detached presentation facts for the Encounter currently blocking Map movement. */
export interface MapEncounterStatusView {
  /** Stable per-holder identity; includes the declaration source and Action. */
  readonly key: string;
  readonly statusId: string;
  readonly name: string;
  readonly stacks: number;
  readonly remainingRounds: number;
  /** Defense Status explanation; omitted for Status kinds without fixed damage reduction. */
  readonly damageReductionPerStack?: number;
}

export interface MapEncounterQueryView {
  readonly mapId: string;
  readonly nodeId: string;
  readonly activityId?: string;
  readonly title: string;
  readonly description?: string;
  readonly completion?: { readonly kind: 'manual'; readonly label: string } | {
    readonly kind: 'condition';
    readonly label: string;
    /** The declaration and current locals are facts; the ReadModel does not evaluate completion. */
    readonly condition: GameplayMapEffectConditionDef;
    readonly locals?: MapEffectLocalsState;
  };
  /** Current Encounter round; present only for an active Encounter. */
  readonly round?: number;
  /** Declared finite round count for a Rest Encounter. */
  readonly rounds?: number;
  readonly partyHp: readonly { readonly characterId: string; readonly currentHp: number; readonly maxHp: number; readonly shield: number; readonly statuses?: readonly MapEncounterStatusView[] }[];
  readonly enemies: readonly { readonly enemyId: string; readonly currentHp: number; readonly maxHp: number; readonly shield: number; readonly statuses?: readonly MapEncounterStatusView[] }[];
}

/** Display-only Node facts projected for a MapRun Workspace. */
export interface MapWorkspaceNodeView {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly hasEncounter: boolean;
  /** Ordered activity labels for a multi-activity Node; omitted for legacy content. */
  readonly activityTitles?: readonly string[];
}

/** Runtime-evaluated, read-only Edge gate shown to the player. */
export type MapWorkspaceEdgeConditionView =
  | { readonly kind: 'teamResourceAtLeast'; readonly resourceId: string; readonly amount: number; readonly satisfied: boolean }
  | { readonly kind: 'counter'; readonly counterId: string; readonly comparison: 'eq' | 'lt' | 'lte' | 'gt' | 'gte'; readonly value: number; readonly satisfied: boolean }
  | { readonly kind: 'flag'; readonly flagId: string; readonly value: boolean; readonly satisfied: boolean };

/** Display-only directed Edge projected for a MapRun Workspace. */
export interface MapWorkspaceEdgeView {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  /** Present only for a condition-gated Edge. */
  readonly condition?: MapWorkspaceEdgeConditionView;
}

/** Detached subset of the resolved Map definition needed by the UI. */
export interface MapWorkspaceMapView {
  readonly id: string;
  readonly name: string;
  readonly startNodeId: string;
  readonly exitNodeIds: readonly string[];
  readonly nodes: readonly MapWorkspaceNodeView[];
  readonly edges: readonly MapWorkspaceEdgeView[];
}

/** One fixed-order activity of the current Node as seen by the player. */
export interface MapWorkspaceActivityView {
  readonly activityId: string;
  readonly title: string;
  readonly kind: 'battle' | 'rest' | 'encounter' | 'shop';
  readonly index: number;
  readonly total: number;
  readonly completed: boolean;
  readonly active: boolean;
}

/** One shop offer with Runtime-computed affordability. */
export interface MapWorkspaceShopOfferView {
  readonly offerId: string;
  readonly name: string;
  readonly description?: string;
  readonly costs: readonly { readonly resourceId: string; readonly amount: number }[];
  readonly effects: readonly { readonly resourceId: string; readonly amount: number }[];
  readonly heal: { readonly characterId: string; readonly amount: number } | null;
  readonly canPurchase: boolean;
}

/** Detached Shop activity projection for the active MapRun. */
export interface MapWorkspaceShopView {
  readonly nodeId: string;
  readonly activityId: string;
  readonly title: string;
  readonly description?: string;
  readonly draftVersion: number;
  readonly offers: readonly MapWorkspaceShopOfferView[];
  readonly lastPurchase: { readonly offerId: string; readonly requestId: string } | null;
}

/** Detached display facts for one Map-local reusable Action. */
export interface MapWorkspaceActionView {
  readonly actionId: string;
  readonly name: string;
  readonly description?: string;
  readonly targetKind: 'none' | 'self' | 'partyCharacter' | 'enemy' | 'card';
  readonly costs: readonly {
    readonly scope: 'actor' | 'team';
    readonly resourceId: string;
    readonly amount: number;
  }[];
  /** E1 declarations, resolved for this source/primary/scope; never an execution result. */
  readonly declaredEffects?: readonly MapDeclaredEffectSummary[];
}

/** One fixed-party member's full Hand and effective Prepared Action / Target. */
export interface MapWorkspacePreparedActionView {
  readonly characterId: string;
  readonly hand: readonly MapWorkspaceActionView[];
  readonly naturalAction: MapWorkspaceActionView | null;
  readonly preparedAction: MapWorkspaceActionView | null;
  readonly targetKind: 'none' | 'self' | 'partyCharacter' | 'enemy' | 'card' | null;
  readonly legalTargetCards?: readonly MapRunCardRef[];
  /** Read-only candidate amount changes for a currently prepared CardRef modifier source. */
  readonly cardEffectModifierPreviews?: readonly {
    readonly targetCardRef: MapRunCardRef;
    readonly op: 'damage' | 'heal';
    readonly delta: number;
  }[];
  readonly targetCard?: MapRunCardRef | null;
  readonly legalTargetCharacterIds: readonly string[];
  readonly legalTargetEnemyIds: readonly string[];
  readonly targetCharacterId: string | null;
  readonly targetEnemyId: string | null;
  readonly additionalTargetKind?: 'partyCharacter' | 'enemy';
  readonly additionalTargetCharacterId?: string | null;
  readonly additionalTargetEnemyId?: string | null;
  readonly legalAdditionalTargetCharacterIds?: readonly string[];
  readonly legalAdditionalTargetEnemyIds?: readonly string[];
  readonly additionalTargetSelectionRequired?: boolean;
  readonly targetSelectionRequired: boolean;
  readonly overrideKind: MapRunActionOverride['kind'] | null;
  readonly playerCost: 0 | 1;
}

/** One Enemy's read-only Hand-first action and automatic target. */
export interface MapWorkspacePreparedEnemyActionView {
  readonly enemyId: string;
  readonly hand: readonly MapWorkspaceActionView[];
  readonly naturalAction: MapWorkspaceActionView | null;
  readonly targetKind: 'none' | 'self' | 'partyCharacter' | 'enemy' | 'card' | null;
  readonly legalTargetCards?: readonly MapRunCardRef[];
  readonly targetCard?: MapRunCardRef | null;
  readonly legalTargetCharacterIds: readonly string[];
  readonly legalTargetEnemyIds: readonly string[];
  readonly targetCharacterId: string | null;
  readonly targetEnemyId: string | null;
  readonly targetSelectionRequired: false;
  readonly skipReason?: 'noLegalTarget';
}

/** A legal Hand-out candidate with Runtime-computed affordability. */
export interface MapWorkspacePlayerCommandOptionView {
  readonly characterId: string;
  readonly action: MapWorkspaceActionView;
  readonly playerCost: 1;
  readonly canPayPlayerCost: boolean;
  readonly canPayActionCosts: boolean;
}

/** Read-only full-round Commit readiness produced by the MapRun Owner's shared preflight. */
export interface MapWorkspaceCommitPreviewView {
  readonly canCommit: boolean;
  readonly playerCostRequired: number | null;
  readonly diagnostics: readonly string[];
  readonly settlements?: readonly MapWorkspaceActionSettlementView[] | null;
  readonly enemyActions: readonly MapWorkspaceEnemyActionSettlementView[] | null;
  readonly activityId?: string;
  readonly programReceiptVersion?: 1 | 2;
  readonly executionContractId?: 'E1-COMPAT-1' | 'AG-1';
  /** Owner-authored AG-1 order with display names resolved by the ReadModel. */
  readonly executionSequence?: readonly MapWorkspaceExecutionSequenceEntryView[];
  readonly effectScope?: MapRunEncounterProgramScope;
  readonly programVisitCount?: number;
  readonly programVisits?: readonly MapRunEncounterProgramVisit[];
  readonly plannedLocals?: MapEffectLocalsState;
  readonly effectTrace?: readonly MapEffectTraceEntry[];
  readonly cardEffectModifierReceipts?: readonly MapRunCardEffectModifierReceipt[];
  readonly statusReceiptVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly plannedStatuses?: readonly MapEncounterStatusInstance[];
  readonly plannedMapRunStatuses?: readonly MapRunStatusInstance[];
  readonly statusTrace?: readonly MapEffectStatusTickTraceEntry[];
  readonly statusConsumeTrace?: readonly MapEffectStatusConsumeTraceEntry[];
  readonly statusCategoryRemoveTrace?: readonly MapEffectStatusCategoryRemoveTraceEntry[];
  readonly triggerReceiptVersion?: 1 | 2 | 3 | 4;
  readonly triggerTrace?: readonly MapEffectTriggerTraceEntry[];
  readonly statusExpiryTriggerTrace?: readonly MapEffectStatusExpiryTriggerTraceEntry[];
  readonly statusDamageTriggerTrace?: readonly MapEffectStatusDamageTriggerTraceEntry[];
}

/** Detached AG-1 sequence row plus display-only labels; the sequence itself remains Owner ordered. */
export interface MapWorkspaceExecutionSequenceEntryView extends MapRunEncounterExecutionSequenceEntry {
  readonly sourceId: string | null;
  readonly actionName: string;
}

export interface MapWorkspaceActionSettlementView {
  readonly characterId: string;
  readonly action: MapWorkspaceActionView | null;
  readonly targetCharacterId: string | null;
  readonly targetEnemyId: string | null;
  readonly targetCard?: MapRunCardRef;
  readonly skipReason?: 'noLegalTarget';
  readonly overrideKind: MapRunActionOverride['kind'] | null;
  readonly playerCostSpent: 0 | 1;
  readonly scostCost?: { readonly original: number; readonly discount: number; readonly paid: number };
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges: readonly MapRunEncounterHpChange[];
}

/** Readable Enemy action plan or receipt row. */
export interface MapWorkspaceEnemyActionSettlementView {
  readonly enemyId: string;
  readonly action: MapWorkspaceActionView | null;
  readonly targetCharacterId: string | null;
  readonly targetEnemyId: string | null;
  readonly targetCard?: MapRunCardRef;
  readonly scostCost?: { readonly original: number; readonly discount: number; readonly paid: number };
  readonly skipReason?: 'defeated' | 'noLegalTarget' | 'unaffordable' | 'roundEnded';
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges: readonly MapRunEncounterHpChange[];
}

/** Readable latest result, scoped to its original Encounter/activity. */
export interface MapWorkspaceRecentCommitView {
  readonly requestId: string;
  readonly commandVersion: number;
  readonly resultingCommitVersion: number;
  readonly nodeId: string;
  readonly activityId?: string;
  readonly round: number;
  readonly draftVersion: number;
  readonly settlements: readonly MapWorkspaceActionSettlementView[];
  readonly ability: {
    readonly action: MapWorkspaceActionView | null;
    readonly target: MapRunEncounterSourceTarget;
    readonly playerCostSpent: 1;
    readonly resourceChanges?: readonly MapRunEncounterSettlementResourceChange[];
    readonly hpChanges: readonly MapRunEncounterHpChange[];
  } | null;
  readonly item: {
    readonly itemName: string;
    readonly action: MapWorkspaceActionView | null;
    readonly target: MapRunEncounterSourceTarget;
    readonly consumedCount: 1;
    readonly resourceChanges?: readonly MapRunEncounterSettlementResourceChange[];
    readonly hpChanges: readonly MapRunEncounterHpChange[];
  } | null;
  readonly enemyActions: readonly MapWorkspaceEnemyActionSettlementView[];
  readonly programReceiptVersion?: 1 | 2;
  readonly executionContractId?: 'E1-COMPAT-1' | 'AG-1';
  readonly executionSequence?: readonly MapWorkspaceExecutionSequenceEntryView[];
  readonly effectScope?: MapRunEncounterProgramScope;
  readonly programVisitCount?: number;
  readonly programVisits?: readonly MapRunEncounterProgramVisit[];
  readonly plannedLocals?: MapEffectLocalsState;
  readonly effectTrace?: readonly MapEffectTraceEntry[];
  readonly cardEffectModifierReceipts?: readonly MapRunCardEffectModifierReceipt[];
  readonly statusReceiptVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly plannedStatuses?: readonly MapEncounterStatusInstance[];
  readonly plannedMapRunStatuses?: readonly MapRunStatusInstance[];
  readonly statusTrace?: readonly MapEffectStatusTickTraceEntry[];
  readonly statusRemoveTrace?: readonly MapEffectStatusRemoveTraceEntry[];
  readonly statusConsumeTrace?: readonly MapEffectStatusConsumeTraceEntry[];
  readonly statusCategoryRemoveTrace?: readonly MapEffectStatusCategoryRemoveTraceEntry[];
  readonly shieldReceiptVersion?: 1;
  readonly shieldTrace?: readonly MapEffectShieldTraceEntry[];
  readonly triggerReceiptVersion?: 1 | 2 | 3 | 4;
  readonly triggerTrace?: readonly MapEffectTriggerTraceEntry[];
  readonly statusExpiryTriggerTrace?: readonly MapEffectStatusExpiryTriggerTraceEntry[];
  readonly statusDamageTriggerTrace?: readonly MapEffectStatusDamageTriggerTraceEntry[];
}

/** Complete detached action / target / Commit projection for one active Encounter. */
export interface MapRunEncounterWorkspaceView {
  readonly nodeId: string;
  readonly round: number;
  readonly draft: MapRunEncounterDraftToken;
  readonly overrides: readonly MapRunActionOverride[];
  readonly preparedActions: readonly MapWorkspacePreparedActionView[];
  readonly preparedEnemyActions: readonly MapWorkspacePreparedEnemyActionView[];
  readonly playerCommandOptions: readonly MapWorkspacePlayerCommandOptionView[];
  readonly commitPreview: MapWorkspaceCommitPreviewView;
  readonly recentCommit: MapWorkspaceRecentCommitView | null;
}

/** One detached ReadModel snapshot for rendering the current Map / Encounter. */
export interface MapRunActiveWorkspaceView {
  readonly kind: 'active';
  /** Live domain cards; display copies and unselected command offers do not add objects. */
  readonly cards: readonly MapRunCardInstance[];
  /** Current preparation relationships; actual results remain in Commit receipts. */
  readonly relations: readonly MapActionRelation[];
  readonly run: MapRun;
  readonly map: MapWorkspaceMapView;
  readonly currentEncounter: MapEncounterQueryView | null;
  /** Fixed-order activity progress of the current Node; empty for legacy Nodes. */
  readonly activities: readonly MapWorkspaceActivityView[];
  /** Present only while a Shop activity is active. */
  readonly shop: MapWorkspaceShopView | null;
  readonly actionPreview: MapRunEncounterWorkspaceView | null;
  /** Current Encounter's actorless Ability / Item candidates and Item condition view. */
  readonly sourcePreview: MapRunEncounterSourcePreview | null;
}

export interface MapRunSuccessWorkspaceView {
  readonly kind: 'success';
  readonly result: MapRunSuccessResult;
}

export interface MapRunFailureWorkspaceView {
  readonly kind: 'failure';
  readonly result: MapRunFailureResult;
  readonly map: MapWorkspaceMapView;
  readonly failedNodeTitle: string;
  readonly partyHp: readonly { readonly characterId: string; readonly currentHp: 0; readonly maxHp: number }[];
}

export type MapRunWorkspaceView = MapRunActiveWorkspaceView | MapRunSuccessWorkspaceView | MapRunFailureWorkspaceView;

/** Read-only facade over the GameInstance-owned MapRunService. */
export interface MapRunQuery {
  /** Detached, read-only preview for the explicit pre-entry / re-entry workspace. */
  getEntryView(mapId: string): MapEntryView;
  getCards(runId: string): readonly MapRunCardInstance[];
  resolveCardReference(ref: MapRunCardRef): MapRunCardInstance | null;
  /** Hypothetical replacement, validated by the Owner without changing the draft. */
  previewReplacement(runId: string, characterId: string, actionId: string, draft: MapRunEncounterDraftToken): readonly MapActionRelation[];
  getSnapshot(): MapRun | null;
  getResult(runId: string): MapRunSuccessResult | null;
  getFailureResult(runId: string): MapRunFailureResult | null;
  getCurrentEncounter(): MapEncounterQueryView | null;
  getWorkspaceView(runId: string): MapRunWorkspaceView | null;
  getFailureWorkspaceView(runId: string): MapRunFailureWorkspaceView | null;
  previewSources(runId: string): MapRunEncounterSourcePreview | null;
}

/** UI 控制器最终应依赖的运行时命令集合；迁移期由 Runtime 直接实现。 */
export interface GameCommands {
  travelToArea(areaId: AreaId, allowDuringStory?: boolean, checkAdjacency?: boolean): TravelResult;
  tick(): TickResult;
  start(): void;
  stop(): void;
  reset(): void;
  clearDevLogs(): void;
  save(): SaveData;
  load(saveData: SaveData): void;
  startActiveStory(storyId: string, owner?: string | null): StoryStartResult;
  acceptAreaStoryDelivery(storyEntryId: string, areaId: AreaId): StoryStartResult;
  startCardStory(storyId: string, owner?: string | null): StoryStartResult;
  replayStory(storyId: string, owner?: string | null): StoryStartResult;
  triggerPassiveStory(initId?: string, owner?: string | null): StoryStartResult;
  triggerAffectionPush(owner: string): StoryStartResult;
  triggerTailPush(owner: string, storyId: string): StoryStartResult;
  startMap(mapId: string): MapRun;
  restartMap(runId: string): MapRun;
  abandonMap(runId: string): void;
  moveMap(runId: string, targetNodeId: string): MapRun;
  completeMapEncounter(runId: string): MapRun;
  purchaseMapShopOffer(runId: string, offerId: string, requestId: string, draft: MapRunShopDraftToken): MapRun;
  leaveMapShop(runId: string, draft: MapRunShopDraftToken): MapRun;
  swapMapPreparedAction(runId: string, characterId: string, actionId: string, draft: MapRunEncounterDraftToken): MapRun;
  issueMapPlayerCommand(runId: string, characterId: string, actionId: string, draft: MapRunEncounterDraftToken): MapRun;
  setMapPreparedTarget(runId: string, characterId: string, targetCharacterId: string | null, draft: MapRunEncounterDraftToken): MapRun;
  setMapPreparedEnemyTarget(runId: string, characterId: string, targetEnemyId: string | null, draft: MapRunEncounterDraftToken): MapRun;
  setMapPreparedCardTarget(runId: string, characterId: string, target: MapRunCardRef | null, draft: MapRunEncounterDraftToken): MapRun;
  setMapPreparedAdditionalTarget(runId: string, characterId: string, target: MapRunEncounterSourceTarget | null, draft: MapRunEncounterDraftToken): MapRun;
  clearMapActionOverride(runId: string, characterId: string, draft: MapRunEncounterDraftToken): MapRun;
  setMapAbilityDraft(runId: string, actionId: string | null, target: MapRunEncounterSourceTarget | null, draft: MapRunEncounterDraftToken): MapRun;
  setMapItemDraft(runId: string, itemId: string | null, target: MapRunEncounterSourceTarget | null, draft: MapRunEncounterDraftToken): MapRun;
  setMapAbilityAdditionalTarget(runId: string, target: MapRunEncounterSourceTarget | null, draft: MapRunEncounterDraftToken): MapRun;
  setMapItemAdditionalTarget(runId: string, target: MapRunEncounterSourceTarget | null, draft: MapRunEncounterDraftToken): MapRun;
  previewMapEncounterSources(runId: string): MapRunEncounterSourcePreview | null;
  commitMapEncounterRound(command: MapRunEncounterCommitCommand): MapRun;
  advanceStory(choiceIndex?: number | string, owner?: string | null, token?: string): StoryAdvanceResult;
  clickSend(owner?: string | null, token?: string): SendResult;
  useItem(itemId: string): UseItemResult;
  purchaseEnhancement(enhancementId: string): EnhancementPurchaseResult;
  removeEnhancement(enhancementId: string): boolean;
  unlockSpot(spotId: SpotId, paymentOptionId?: string): SpotUnlockResult;
  upgradeSpot(spotId: SpotId, paymentOptionId?: string): SpotUpgradeResult;
  purchaseInit(initId: string): InitPurchaseResult;
  hardRestartInit(): void;
  roll(poolId: string, count: number): RollSummary;
  markChatRead(messageId: string): void;
  equipEquipment(variantId: VariantId, equipmentId: string): { ok: boolean; reason?: string };
  unequipEquipment(variantId: VariantId): boolean;
  equipGear(variantId: VariantId, slotIndex: number): { ok: boolean; reason?: string };
  feedGearExp(variantId: VariantId, slotIndex: number, itemId: string, count: number): { ok: boolean; reason?: string };
  upgradeGearTier(variantId: VariantId, slotIndex: number): { ok: boolean; reason?: string };
  addExp(variantId: VariantId, amount: number): { ok: boolean; newLevel: number; newExp: number };
  breakthroughStar(variantId: VariantId): { ok: boolean; reason?: string; newStars?: number };
  activateTheme(groupId: string | null): boolean;
  activateCustomTheme(customThemeId: string): boolean;
  setThemeLayerOrder(order: ThemeOrderScope[]): boolean;
  setEntityThemeSlot(entityKey: string, slot: EntityThemeSlot | null): boolean;
  setEntityPresentationSelection(entityKey: string, optionId: string | null): boolean;
  clearEntityPresentationSelection(entityKey: string): boolean;
  unlockInit(initId: string): void;
  startNewGame(initId: string): boolean;
  restartInit(): void;
  resumeInit(initId: string): boolean;
  /** 运行时编辑能力：单个 Spot 热内容提交（不接收完整 Draft）。 */
  applyRuntimeSpotMutation?(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult;
  applyRuntimeWorldDraft?(draft: RuntimeWorldDraft): RuntimeWorldApplyResult;
  applyRuntimeMod?(draft: RuntimeModDraft): RuntimeModApplyResult;
  setRuntimeModMetadata?(metadata: Pick<RuntimeModDraft, 'modName' | 'displayName' | 'version' | 'author' | 'description'> & { readonly targetPackRecordId?: string }): RuntimeModApplyResult;
  runtimeDefinitionEditor?: RuntimeDefinitionEditorCommands;
  /** 一般编辑态 ColorGroup / ThemeDesign 的 source-aware 编辑、Preview 与保存服务。 */
  themeContentEditor?: ThemeContentEditorService;
}
