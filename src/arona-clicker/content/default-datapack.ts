import type { Datapack } from '../../data-services/contracts/datapack';
import { baseAreas } from './areas';
import { allCharacters } from './characters';
import { baseDropTables } from './drop-tables';
import { baseEnhancements, baseGlobalEnhancements } from './enhancements';
import { baseInits } from './inits';
import { baseItems } from './items';
import { baseSpots } from './spots';
import { baseCharaProfiles } from './chara-profiles';
import { basePics } from './pics-assets';
import { baseCultivateCurves } from './cultivate-curves';
import { baseCharacterVariants } from './character-variants';
import { baseColorGroups } from './colors';
import { baseColorEquipments } from './color-equipments';
import { baseGachaPools } from './gacha-pools';
import { baseAffectionStepStories, baseAffectionSteps } from './affection-content';
import { baseBondStoryEntries, baseBondStories } from './bond-content';
import { baseTriggers } from './triggers';
import { baseStories } from './stories';
import { baseActiveStories } from './story-active-entries';
import { basePassiveStories } from './story-passive-entries';
import { basePassivePools } from './story-pools';
import type { } from '../../engine/types';
import { baseAffectorPacks } from './affector-packs';
import { baseResourceDisplays } from './resource-displays';
import { baseExtras } from './extras';

/** Product composition root; it is independent from the test datapack entry. */
export const defaultDatapack: Datapack = {
  name: 'AronaClicker',
  version: '1.0.0',
  inits: baseInits,
  areas: baseAreas,
  spots: baseSpots,
  enhancements: [...baseEnhancements, ...baseGlobalEnhancements],
  items: baseItems,
  characters: allCharacters,
  characterVariants: baseCharacterVariants,
  dropTables: baseDropTables,
  pics: basePics,
  charaProfiles: baseCharaProfiles,
  cultivateCurves: baseCultivateCurves,
  colorGroups: baseColorGroups,
  colorEquipments: baseColorEquipments,
  gachaPools: baseGachaPools,
  triggerDefs: baseTriggers,
  passivePools: basePassivePools,
  passiveStories: [...basePassiveStories, ...baseAffectionSteps],
  stories: [...baseStories, ...baseBondStories, ...baseAffectionStepStories],
  activeStories: [...baseActiveStories, ...baseBondStoryEntries],
  affectorPacks: baseAffectorPacks,
  funcletDefs: [],
  characterBonuses: [],
  resourceDisplays: baseResourceDisplays,
  extras: baseExtras,
};
