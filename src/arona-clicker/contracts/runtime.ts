import type { AreaId, EntityThemeSlot, SpotId, ThemeOrderScope, VariantId } from '../../engine/types';
import type { InitPurchaseResult } from '../../data-services/contracts/world';
import type { PlayerState } from '../types/state';
import type { TickResult } from '../../engine/contracts/tick';
import type { EnhancementPurchaseResult, GameView, SendResult, SpotUnlockResult, SpotUpgradeResult, StoryAdvanceResult, StoryStartResult, TravelResult, UseItemResult, StoryView } from './index';
import type { RollSummary } from '../services/gacha-service';
import type { SaveData } from './save-data';
import type { DevLogEntry } from '../../engine/core/dev-log';
import type { ContentCatalogQueryPort } from './content-catalog';
import type { ValueQueryPort } from './value-query';
import type { ConditionQueryPort } from './condition-query';
import type { GameNumQueryPort } from '../../engine/contracts/game-num-query';
import type { AffectorQueryPort } from './affector-query';
import type { AvailabilityQueryPort } from './availability-query';
import type { GachaQueryPort } from './gacha-query';
import type { SpotFunctionalityQueryPort } from '../../engine/contracts/spot-functionality-query';
import type { StatsQueryContext } from '../../engine/contracts/stats';
import type { PicQueryPort } from './pic-query';
import type { SpotQueryPort } from './spot-query';
import type { RosterQueryPort } from './roster-query';
import type { ColorQueryPort } from './color-query';
import type { ColorEquipmentQueryPort } from './color-equipment-query';
import type { StoryQueryPort } from './story-query';
import type { PackDependencyStatus, PackSourceKind } from '../../data-services/datapack/pack-manager';
import type { WorldCatalogQueryPort } from './world-catalog';
import type { UserThemeService } from '../services/user-theme-service';

export interface PackCatalogEntry {
  readonly id: string;
  readonly modName: string;
  readonly name: string;
  readonly version: string;
  readonly author?: string;
  readonly dependencies: readonly string[];
  readonly sourceKind: PackSourceKind;
  readonly importedAt: number;
  readonly enabled: boolean;
}

export interface PackCatalogDependencyHint {
  readonly packId: string;
  readonly dependency: string;
  readonly status: PackDependencyStatus;
}

export interface PackCatalogReadModel {
  getPackCatalog(): { entries: readonly PackCatalogEntry[]; dependencies: readonly PackCatalogDependencyHint[] };
}

export interface PackCatalogCommands {
  setPackEnabled(id: string, enabled: boolean): void;
  reorderPacks(ids: readonly string[]): void;
  applyEnabledPacks(): void;
}

/** UI 可读取的 AronaClicker 运行时快照与查询能力。 */
export interface GameReadModel {
  readonly state: Readonly<PlayerState>;
  readonly registry: ContentCatalogQueryPort;
  readonly world: WorldCatalogQueryPort;
  readonly valueSystem: ValueQueryPort;
  readonly conditionSystem: ConditionQueryPort;
  readonly gameNumSystem: GameNumQueryPort;
  readonly affectorEngine: AffectorQueryPort;
  readonly rosterSystem: RosterQueryPort;
  readonly availabilityService: AvailabilityQueryPort;
  readonly colorSystem: ColorQueryPort;
  readonly colorEquipmentSystem: ColorEquipmentQueryPort;
  readonly gachaService: GachaQueryPort;
  readonly spotFunctionalitySystem: SpotFunctionalityQueryPort;
  readonly statsService: StatsQueryContext;
  readonly pics: PicQueryPort;
  readonly userThemeService: UserThemeService;
  readonly story: StoryQueryPort;
  readonly spot: SpotQueryPort;
  getView(): GameView;
  getStoryView(owner: string): StoryView | null;
  getDevLogs(): readonly DevLogEntry[];
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
  startCardStory(storyId: string, owner?: string | null): StoryStartResult;
  replayStory(storyId: string, owner?: string | null): StoryStartResult;
  triggerPassiveStory(initId?: string, owner?: string | null): StoryStartResult;
  triggerAffectionPush(owner: string): StoryStartResult;
  triggerTailPush(owner: string, storyId: string): StoryStartResult;
  advanceStory(choiceIndex?: number, owner?: string | null): StoryAdvanceResult;
  clickSend(owner?: string | null): SendResult;
  useItem(itemId: string): UseItemResult;
  purchaseEnhancement(enhancementId: string): EnhancementPurchaseResult;
  removeEnhancement(enhancementId: string): boolean;
  unlockSpot(spotId: SpotId): SpotUnlockResult;
  upgradeSpot(spotId: SpotId): SpotUpgradeResult;
  purchaseInit(initId: string): InitPurchaseResult;
  hardRestartInit(): void;
  roll(poolId: string, count: number): RollSummary;
  markChatRead(messageId: string): void;
  equipEquipment(variantId: VariantId, equipmentId: string): { ok: boolean; reason?: string };
  unequipEquipment(variantId: VariantId): boolean;
  addExp(variantId: VariantId, amount: number): { ok: boolean; newLevel: number; newExp: number };
  breakthroughStar(variantId: VariantId): { ok: boolean; reason?: string; newStars?: number };
  activateTheme(groupId: string | null): boolean;
  setThemeLayerOrder(order: ThemeOrderScope[]): boolean;
  setEntityThemeSlot(entityKey: string, slot: EntityThemeSlot | null): boolean;
  unlockInit(initId: string): void;
  startNewGame(initId: string): boolean;
  restartInit(): void;
  resumeInit(initId: string): boolean;
}
