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
import { baseGearConfig, baseGearItems, baseGears } from './gears';
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
import { themeShowcaseAreas, themeShowcaseEnhancements, themeShowcaseInits, themeShowcasePassiveStories, themeShowcaseSpots } from './theme-showcase';
import { baseShops } from './shops';
import type { EntityPresentationDef } from '../../data-services/contracts/entity-presentation';

/**
 * 正式内容的组合入口：把仍以旧字段编写的默认内容投影为规范 presentation.default。
 * 这样默认 Datapack 从进入 Registry 起就拥有统一语义，Resolver 仍可兼容外部旧包。
 */
function withDefaultPresentation<T extends {
  name: string;
  description: string;
  theme?: unknown;
  presentation?: EntityPresentationDef;
}>(def: T, displayName = def.name): T {
  if (def.presentation) return def;
  return {
    ...def,
    presentation: {
      default: {
        name: displayName,
        description: def.description,
        ...(def.theme ? { theme: def.theme as EntityPresentationDef['default']['theme'] } : {}),
      },
    },
  };
}

const defaultInits = [...baseInits, ...themeShowcaseInits].map(def => withDefaultPresentation(def));
const defaultAreas = [...baseAreas, ...themeShowcaseAreas].map(def => withDefaultPresentation(def));
const defaultSpots = [...baseSpots, ...themeShowcaseSpots].map(def => withDefaultPresentation(def));
const defaultEnhancements = [...baseEnhancements, ...baseGlobalEnhancements, ...themeShowcaseEnhancements]
  .map(def => withDefaultPresentation(def));
const defaultVariants = baseCharacterVariants.map(def => withDefaultPresentation(def, def.displayName || def.name));

/** Product composition root; it is independent from the test datapack entry. */
export const defaultDatapack: Datapack = {
  name: 'AronaClicker',
  version: '1.0.0',
  inits: defaultInits,
  areas: defaultAreas,
  spots: defaultSpots,
  enhancements: defaultEnhancements,
  items: [...baseItems, ...baseGearItems],
  characters: allCharacters,
  characterVariants: defaultVariants,
  dropTables: baseDropTables,
  pics: basePics,
  charaProfiles: baseCharaProfiles,
  cultivateCurves: baseCultivateCurves,
  colorGroups: baseColorGroups,
  colorEquipments: baseColorEquipments,
  gears: baseGears,
  gearConfig: baseGearConfig,
  gachaPools: baseGachaPools,
  shops: baseShops,
  triggerDefs: baseTriggers,
  passivePools: basePassivePools,
  passiveStories: [...basePassiveStories, ...baseAffectionSteps, ...themeShowcasePassiveStories],
  stories: [...baseStories, ...baseBondStories, ...baseAffectionStepStories],
  activeStories: [...baseActiveStories, ...baseBondStoryEntries],
  affectorPacks: baseAffectorPacks,
  funcletDefs: [],
  resourceDisplays: baseResourceDisplays,
  extras: baseExtras,
};
