import type { AreaDef, InitDef, SpotDef } from '../../data-services/contracts/world';
import type { ResourceDisplayDef } from '../../data-services/contracts/common';
import type { ItemDef } from '../../data-services/contracts/item';
import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import type { PassivePoolDef } from '../../data-services/contracts/passive-pool';
import type { StoryDef } from '../../data-services/contracts/story';
import type { ActiveStoryEntry, PassiveStoryEntry, StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { GachaPoolDef } from '../../data-services/contracts/gacha-pool';
import type { ColorEquipmentDef, ColorGroupDef } from '../../data-services/contracts/color';
import type { TagPath } from '../../engine/core/tag';
import type { ShopDef } from '../../data-services/contracts/shop';

export interface CharacterCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly tags?: TagPath[];
}

export interface ContentCatalogQueryPort {
  readonly inits: ReadonlyMap<string, InitDef>;
  readonly areas: ReadonlyMap<string, AreaDef>;
  readonly spots: ReadonlyMap<string, SpotDef>;
  readonly enhancements: ReadonlyMap<string, EnhancementDef>;
  readonly stories: ReadonlyMap<string, StoryDef>;
  readonly activeStories: ReadonlyMap<string, ActiveStoryEntry>;
  readonly passiveStories: ReadonlyMap<string, PassiveStoryEntry>;
  readonly passivePools: ReadonlyMap<string, PassivePoolDef>;
  readonly items: ReadonlyMap<string, ItemDef>;
  readonly characters: ReadonlyMap<string, CharacterCatalogEntry>;
  readonly gachaPools: ReadonlyMap<string, GachaPoolDef>;
  readonly shops: ReadonlyMap<string, ShopDef>;
  readonly colorGroups: ReadonlyMap<string, ColorGroupDef>;
  readonly colorEquipments: ReadonlyMap<string, ColorEquipmentDef>;
  readonly storyEntries: ReadonlyMap<string, StoryEntryDef>;
  readonly resourceDisplays: ReadonlyMap<string, ResourceDisplayDef>;
}
