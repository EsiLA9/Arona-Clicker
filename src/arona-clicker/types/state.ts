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
import type { EntityThemeSlot, ThemeOrderScope } from '../../engine/types/theme';
import type { SpotTagOverrideState } from '../../engine/contracts/state-query';
import type { Character } from './ids';
import type { UserThemeState } from './user-theme';
import type { CompletedStory, StoryReadLog } from './story-state';
import type { GachaPoolState, ProtoStat, RosterEntry } from './character';

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
  roster?: Record<VariantId, RosterEntry>;
  fragments?: Record<VariantId, number>;
  gachaState?: Record<GachaPoolId, GachaPoolState>;
  activeGroupId?: ColorGroupId | null;
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
  worldPool?: VariantId[];
  protoStats?: Record<string, ProtoStat>;
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
  roster?: Record<VariantId, RosterEntry>;
  fragments?: Record<VariantId, number>;
  gachaState?: Record<GachaPoolId, GachaPoolState>;
  chatRead?: Record<ChatMessageId, true>;
}

export type AronaClickerState = PlayerState;
export type AronaClickerInitSnapshot = InitSnapshot;
