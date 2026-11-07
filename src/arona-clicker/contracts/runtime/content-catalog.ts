import type { FuncletDef } from '../../../engine/types/expression';
import type { AreaDef, InitDef, SpotDef } from '../../../data-services/contracts/world';
import type { AreaMapDef } from '../../../data-services/contracts/area-map';
import type { ResourceDisplayDef } from '../../../data-services/contracts/common';
import type { ItemDef } from '../../../data-services/contracts/item';
import type { EnhancementDef } from '../../../data-services/contracts/enhancement';
import type { PassivePoolDef } from '../../../data-services/contracts/passive-pool';
import type { StoryDef } from '../../../data-services/contracts/story';
import type { ActiveStoryEntry, PassiveStoryEntry, StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { GachaPoolDef } from '../../../data-services/contracts/gacha-pool';
import type { ColorEquipmentDef, ColorGroupDef } from '../../../data-services/contracts/color';
import type { TagPath } from '../../../engine/core/tag';
import type { ShopDef } from '../../../data-services/contracts/shop';
import type { CharacterVariantDef } from '../../../data-services/contracts/character-variant';
import type { PicDef } from '../../../data-services/contracts/pic';
import type { OperationEventContentDef, StudentOperationProfileDef } from '../../../data-services/contracts/operation';

export interface CharacterCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly tags?: TagPath[];
}

export interface ContentCatalogQueryPort {
  readonly inits: ReadonlyMap<string, InitDef>;
  readonly areas: ReadonlyMap<string, AreaDef>;
  readonly areaMaps: ReadonlyMap<string, AreaMapDef>;
  readonly spots: ReadonlyMap<string, SpotDef>;
  readonly enhancements: ReadonlyMap<string, EnhancementDef>;
  readonly funcletDefs: ReadonlyMap<string,FuncletDef>;
  readonly stories: ReadonlyMap<string, StoryDef>;
  readonly activeStories: ReadonlyMap<string, ActiveStoryEntry>;
  readonly passiveStories: ReadonlyMap<string, PassiveStoryEntry>;
  readonly passivePools: ReadonlyMap<string, PassivePoolDef>;
  readonly items: ReadonlyMap<string, ItemDef>;
  readonly characters: ReadonlyMap<string, CharacterCatalogEntry>;
  readonly characterVariants: ReadonlyMap<string, CharacterVariantDef>;
  readonly pics: ReadonlyMap<string, PicDef>;
  readonly gachaPools: ReadonlyMap<string, GachaPoolDef>;
  readonly shops: ReadonlyMap<string, ShopDef>;
  readonly operationEvents: ReadonlyMap<string, OperationEventContentDef>;
  readonly studentOperationProfiles: ReadonlyMap<string, StudentOperationProfileDef>;
  readonly colorGroups: ReadonlyMap<string, ColorGroupDef>;
  readonly colorEquipments: ReadonlyMap<string, ColorEquipmentDef>;
  readonly storyEntries: ReadonlyMap<string, StoryEntryDef>;
  readonly resourceDisplays: ReadonlyMap<string, ResourceDisplayDef>;
}
