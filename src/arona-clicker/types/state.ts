import type { EnhancementAttachment } from '../../data-services/contracts/enhancement';
import type { AreaId, EnhancementId, InitId, ItemId, SpotId, StoryId } from '../../engine/types/ids';
import type { ExtraCompound } from '../../engine/types/extra';
import type { CharaCustomOverride } from './chara-profile';
import type { TagEffectRecord } from '../../engine/expression/tag-effect';
import type {
  CharacterAcquireVia,
  ChatMessageId,
  ColorGroupId,
  EquipmentId,
  GachaPoolId,
  VariantId,
} from '../../engine/types/character';
import type { ActiveThemeSelection, EntityThemeSlot, ThemeOrderScope } from '../../engine/types/theme';
import type { SpotTagOverrideState } from '../../engine/contracts/state-query';
import type { Character } from './ids';
import type { StoredCustomTheme, ThemeAttachment, UserThemeState } from './user-theme';
import type { CompletedStory, StoryReadLog } from './story-state';
import type { CharacterMemory, GachaPoolState, ProtoStat, VariantProgress } from './character';
import type { ShopPurchaseRecord } from '../../data-services/contracts/shop';

export type SpotTagOverride = SpotTagOverrideState;

export interface PlayerState {
  resources: Record<string, number>;
  globalResources?: Record<string, number>;
  spotLevels: Record<SpotId, number>;
  spotManagers: Record<SpotId, Character>;
  unlockedEnhancements: EnhancementId[];
  enhancementAttachments?: Record<EnhancementId, EnhancementAttachment>;
  activeInit: InitId;
  currentAreaId?: AreaId;
  visitedAreas?: AreaId[];
  visitedInits?: InitId[];
  totalFrames: number;
  tagEffects?: Record<string, TagEffectRecord[]>;
  entityEffects?: Record<string, TagEffectRecord[]>;
  storyLog: CompletedStory[];
  storyReadLogs?: Record<StoryId, StoryReadLog>;
  inventory: Record<ItemId, number>;
  flags: Record<string, string>;
  unlockedInits: InitId[];
  triggersCompleted?: string[];
  initExtras?: ExtraCompound;
  initSnapshots?: Record<InitId, InitSnapshot>;
  extras?: ExtraCompound;
  roster?: Record<VariantId, VariantProgress>;
  fragments?: Record<VariantId, number>;
  gachaState?: Record<GachaPoolId, GachaPoolState>;
  activeTheme?: ActiveThemeSelection;
  themeLayerOrder?: ThemeOrderScope[];
  groupsOwned?: ColorGroupId[];
  equipmentsOwned?: EquipmentId[];
  spotTagOverrides?: Record<SpotId, SpotTagOverrideState>;
  entityThemeSlots?: Record<string, EntityThemeSlot>;
  entityThemeDesignsOwned?: Record<string, string[]>;
  chatRead?: Record<ChatMessageId, true>;
  passiveCooldowns?: Record<string, number>;
  studentBlocks?: Record<VariantId, { entryId: string; setAtFrame: number }>;
  charaCustom?: Partial<Record<Character, CharaCustomOverride>>;
  userTheme?: UserThemeState;
  customThemes?: Record<string, StoredCustomTheme>;
  themeAttachments?: Record<string, ThemeAttachment>;
  worldPool?: VariantId[];
  protoStats?: Record<string, ProtoStat>;
  /** 跨世界线角色记忆（永远 global，不随 Init 重置；不进 PER_INIT_FIELD_SPECS）。 */
  characterMemory?: Record<Character, CharacterMemory>;
  /** 账号级角色等级开放上限（缺省 = 无上限）；提升机制后续接入。 */
  accountLevelCap?: number;
  /** 跨世界线的 Shop 购买事实（key 经 ShopPurchaseRecord resolver 生成）。 */
  globalShopPurchaseRecords?: Record<string, ShopPurchaseRecord>;
  /** 当前 Init 的 Shop 购买事实（随 InitSnapshot 保存）。 */
  shopPurchaseRecords?: Record<string, ShopPurchaseRecord>;
}

export interface InitSnapshot {
  resources: Record<string, number>;
  spotLevels: Record<SpotId, number>;
  spotManagers: Record<SpotId, Character>;
  visitedAreas: AreaId[];
  totalFrames: number;
  inventory: Record<ItemId, number>;
  unlockedEnhancements: EnhancementId[];
  storyLog: CompletedStory[];
  storyReadLogs?: Record<StoryId, StoryReadLog>;
  flags: Record<string, string>;
  triggersCompleted: string[];
  currentAreaId?: AreaId;
  extras?: ExtraCompound;
  roster?: Record<VariantId, VariantProgress>;
  fragments?: Record<VariantId, number>;
  gachaState?: Record<GachaPoolId, GachaPoolState>;
  chatRead?: Record<ChatMessageId, true>;
  equipmentsOwned?: EquipmentId[];
  shopPurchaseRecords?: Record<string, ShopPurchaseRecord>;
}

export type AronaClickerState = PlayerState;
export type AronaClickerInitSnapshot = InitSnapshot;
