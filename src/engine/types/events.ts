import type { StatsContext } from '../contracts/stats';
import type { AffectorState } from '../contracts/affector';
import type { Effect } from './expression';
import type { ChatTextKind, ChatTextStyle } from '../contracts/chat-presentation';
import type { Character } from './ids';
import type { ExtraPath, ExtraValue } from './extra';
import type { EngineTalklet } from '../contracts/talklet';
import type { ActiveThemeSelection } from './theme';

export type GameEvent =
  | { type: 'resourceChanged'; resource: string; delta: number; newValue: number }
  | { type: 'spotLevelChanged'; spotId: string; newLevel: number; oldLevel?: number }
  | { type: 'managerChanged'; spotId: string; newManager: Character }
  | { type: 'enhancementAdded'; enhancementId: string }
  | { type: 'enhancementRemoved'; enhancementId: string }
  | { type: 'itemCollected'; itemId: string; count: number; newTotal: number }
  | { type: 'initEntered'; initId: string }
  | { type: 'initUnlocked'; initId: string }
  | { type: 'areaEntered'; areaId: string; fromAreaId: string | null }
  | { type: 'storyAreaTraveled'; areaId: string }
  | { type: 'storyTriggered'; storyId: string }
  | { type: 'storyCompleted'; storyId: string }
  | { type: 'storyRewarded'; storyId: string; source: 'first' | 'repeat' | 'conditional'; effects: Effect[]; flags: string[] }
  | { type: 'poolGateChanged'; poolId: string; available: boolean }
  | { type: 'tick'; frame: number }
  | { type: 'flagChanged'; flag: string; value: string }
  | { type: 'extraChanged'; path: ExtraPath; value?: ExtraValue }
  | { type: 'spotProduced'; spotId: string; resource: string; amount: number }
  | { type: 'spotTagChanged'; spotId: string; tag: string; added: boolean }
  | { type: 'tagCollectedChanged'; kind: string }
  | { type: 'affectorMounted'; instanceId: string; packId: string; mountEntityId: string }
  | { type: 'affectorStateChanged'; instanceId: string; oldState: AffectorState; newState: AffectorState }
  | { type: 'affectorUnmounted'; instanceId: string; reason: string }
  | { type: 'affectorEntriesChanged'; instanceId: string }
  | { type: 'affectorRuntimeChanged'; instanceIds: string[] }
  | { type: 'userThemeChanged'; enabled: boolean }
  | { type: 'characterAcquired'; variantId: string; via: 'gacha' | 'story' | 'event'; duplicate: boolean; shards: number; bonusResources: Record<string, number> }
  | { type: 'cultivated'; variantId: string; kind: 'exp' | 'star'; newLevel?: number; newStars?: number }
  | { type: 'affectionChanged'; variantId: string; delta: number; newLevel: number; newExp: number; leveledUp: boolean }
  | { type: 'groupUnlocked'; groupId: string }
  | { type: 'equipmentCollected'; equipmentId: string }
  | { type: 'equipmentEquipped'; variantId: string; equipmentId: string }
  | { type: 'themeChanged'; groupId: string | null; selection: ActiveThemeSelection }
  | { type: 'entityThemeChanged'; entityKey: string }
  | { type: 'entityDesignUnlocked'; entityKey: string; designId: string }
  | { type: 'chatReadChanged'; messageId: string }
  | { type: 'gachaResolved'; poolId: string; count: number }
  | { type: 'passiveCooldownsChanged'; cooldowns: Record<string, number> }
  | { type: 'studentBlockChanged'; variantId: string; blocked: boolean; entryId?: string }
  | { type: 'charaCustomChanged'; character: Character }
  | { type: 'themeEffectRequested'; effect: Effect }
  | { type: 'storyEffectRequested'; effect: Effect }
  | { type: 'chatFlowEffectRequested'; effect: Effect }
  | { type: 'chatFlowCleared' }
  | { type: 'chatTextClearedAll' }
  | { type: 'chatTextShown'; id: string; text?: string; talklet?: EngineTalklet; x?: number; y?: number; align?: 'left' | 'center' | 'right'; kind?: ChatTextKind; style?: ChatTextStyle; title?: string; buttonText?: string; targetStoryId?: string }
  | { type: 'chatTextCleared'; id: string }
  | { type: 'openingTitleShown'; title?: string }
  & { stats?: StatsContext };

export type EventHandler = (event: GameEvent) => void;
