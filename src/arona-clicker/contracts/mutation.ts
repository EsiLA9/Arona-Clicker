import type { StateMutationPort } from '../../engine/contracts/mutation';
import type { CompletedStory } from '../types/story-state';
import type { CharaCustomOverride } from '../types/chara-profile';
import type { PlayerState } from '../types/state';

export interface StateMutationHostPort extends StateMutationPort {
  setState(state: PlayerState): void;
}

export interface EnhancementMutationPort extends StateMutationHostPort {
  addEnhancement(enhancementId: string): boolean;
  removeEnhancement(enhancementId: string): boolean;
}

export interface InventoryMutationPort extends StateMutationHostPort {
  addItem(itemId: string, count: number, maxStack?: number): number;
  removeItem(itemId: string, count: number): boolean;
}

export interface SpotMutationPort extends StateMutationHostPort {
  setSpotLevel(spotId: string, level: number): void;
  setManager(spotId: string, character: import('../../engine/types').Character): void;
  applySpotTagChange(spotId: string, tag: import('../../engine/core/tag').TagPath, added: boolean): void;
}

export interface InitMutationPort extends StateMutationHostPort {
  unlockInit(initId: string): boolean;
  setSpotLevel(spotId: string, level: number): void;
}

export interface GachaMutationPort extends StateMutationHostPort {
  acquireCharacter(variantId: string, via: import('../../engine/types').CharacterAcquireVia, dupRewards?: import('../../data-services/contracts/gacha-pool').DupRewards): { duplicate: boolean; shards: number; bonusResources: Record<string, number> };
  setGachaCounters(poolId: string, counters: { pity: number; pulls: number }): void;
}

export interface AvailabilityMutationPort extends StateMutationHostPort {
  mergeIntoWorldPool(variantIds: string[]): void;
}

export interface ColorMutationPort extends StateMutationHostPort {
  unlockEntityDesign(entityKey: string, designId: string): boolean;
  setEntityThemeSlot(entityKey: string, slot: import('../../engine/types').EntityThemeSlot | null): boolean;
  unlockGroup(groupId: string): boolean;
}

export interface ColorEquipmentMutationPort extends StateMutationHostPort {
  collectEquipment(equipmentId: string): boolean;
  unlockGroup(groupId: string): boolean;
}

export interface CharacterProfileMutationPort extends StateMutationHostPort {
  setCharaCustom(character: import('../../engine/types').Character, override: CharaCustomOverride): void;
  clearCharaCustom(character: import('../../engine/types').Character): void;
}

export interface StoryMutationPort extends StateMutationHostPort {
  completeStory(story: CompletedStory): void;
  recordStoryRead(storyId: string, talkletIndex: number, choiceIndex?: number): void;
  setPassiveCooldowns(cooldowns: Record<string, number>): void;
  setStudentBlock(variantId: string, entryId: string): void;
}

export interface UiMutationPort extends StateMutationHostPort {
  markChatRead(messageId: string): void;
  equipEquipment(variantId: string, equipmentId: string): { ok: boolean; reason?: string };
  unequipEquipment(variantId: string): boolean;
  /** 装备（Gear）：装配到空槽 / 喂经验 / 升 tier。不提供卸下。 */
  equipGear(variantId: string, slotIndex: number): { ok: boolean; reason?: string };
  feedGearExp(variantId: string, slotIndex: number, itemId: string, count: number): { ok: boolean; reason?: string };
  upgradeGearTier(variantId: string, slotIndex: number): { ok: boolean; reason?: string };
  addExp(variantId: string, amount: number): { ok: boolean; newLevel: number; newExp: number };
  breakthroughStar(variantId: string): { ok: boolean; reason?: string; newStars?: number };
  activateTheme(groupId: string | null): boolean;
  activateCustomTheme(customThemeId: string): boolean;
  setThemeLayerOrder(order: import('../../engine/types').ThemeOrderScope[]): boolean;
  setEntityThemeSlot(entityKey: string, slot: import('../../engine/types').EntityThemeSlot | null): boolean;
}

export interface RuntimeMutationPort extends StateMutationHostPort {
  clearStudentBlock(variantId: string): void;
}
