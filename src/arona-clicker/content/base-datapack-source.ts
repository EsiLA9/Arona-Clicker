import type { Datapack } from '../../data-services/contracts/datapack';
import type { AreaMapDef } from '../../data-services/contracts/area-map';
import { baseAreas } from './world/areas';
import { allCharacters } from './character/characters';
import { baseDropTables } from './economy/drop-tables';
import { baseEnhancements, baseGlobalEnhancements } from './progression/enhancements';
import { baseInits } from './world/inits';
import { baseItems } from './economy/items';
import { baseSpots } from './world/spots';
import { baseCharaProfiles } from './character/chara-profiles';
import { basePics } from './pics-assets';
import { baseCultivateCurves } from './progression/cultivate-curves';
import { baseCharacterVariants } from './character/character-variants';
import { baseColorGroups } from './progression/colors';
import { baseColorEquipments } from './progression/color-equipments';
import { baseGearConfig, baseGearItems, baseGears } from './progression/gears';
import { baseGachaPools } from './economy/gacha-pools';
import { baseAffectionStepStories, baseAffectionSteps } from './character/affection-content';
import { baseBondStoryEntries, baseBondStories } from './character/bond-content';
import { baseTriggers } from './triggers';
import { baseStories } from './story/stories';
import { baseActiveStories } from './story/story-active-entries';
import { basePassiveStories } from './story/story-passive-entries';
import { basePassivePools } from './story/story-pools';
import type { } from '../../engine/types';
import { baseAffectorPacks } from './affector-packs';
import { baseResourceDisplays } from './resource-displays';
import { baseExtras } from './extras';
import { themeShowcaseAreas, themeShowcaseEnhancements, themeShowcaseInits, themeShowcasePassiveStories, themeShowcaseSpots } from './theme-showcase';
import { baseShops } from './economy/shops';
import type { EntityPresentationDef } from '../../data-services/contracts/entity-presentation';

/** Export-only projection of the existing TypeScript content modules. */
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
const navigationMapId = (initId: string) => initId.replace(':init:', ':area-map:');
const defaultAreas = [...baseAreas, ...themeShowcaseAreas].map(def => ({
  ...withDefaultPresentation(def), navigationMapId: navigationMapId(def.initId),
}));
// One small authored-content projection per Init; travel still uses the Area topology.
const defaultAreaMaps: AreaMapDef[] = defaultInits.map(init => {
  const areas = defaultAreas.filter(area => area.initId === init.id);
  const nodeId = (areaId: string) => areaId.split(':')[2];
  const areaIds = new Set(areas.map(area => area.id));
  const edges = new Map<string, AreaMapDef['edges'][number]>();
  for (const area of areas) {
    for (const adjacentId of area.adjacentAreaIds ?? []) {
      if (!areaIds.has(adjacentId)) continue;
      const [fromNodeId, toNodeId] = [nodeId(area.id), nodeId(adjacentId)].sort();
      edges.set(`${fromNodeId}:${toNodeId}`, { fromNodeId, toNodeId });
    }
  }
  return {
    id: navigationMapId(init.id), name: `${init.name}区域图`,
    nodes: areas.map((area, index) => ({
      id: nodeId(area.id), position: { x: (index % 3) * 240, y: Math.floor(index / 3) * 180 },
      action: { kind: 'attemptAreaTravel', areaId: area.id },
    })),
    edges: [...edges.values()],
  };
});
const defaultSpots = [...baseSpots, ...themeShowcaseSpots].map(def => withDefaultPresentation(def));
const defaultEnhancements = [...baseEnhancements, ...baseGlobalEnhancements, ...themeShowcaseEnhancements]
  .map(def => withDefaultPresentation(def));
const defaultVariants = baseCharacterVariants.map(def => withDefaultPresentation(def, def.displayName || def.name));

/** Kept separate from the runtime JSON package so source modules remain untouched. */
export const baseDatapackSource: Datapack = {
  name: 'AronaClicker',
  version: '1.0.2',
  inits: defaultInits,
  areas: defaultAreas,
  areaMaps: defaultAreaMaps,
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

export const baseDatapackExportAssets = [
  { sourceUrl: basePics[0].src, sourcePath: 'src/data/Hoshino.png', packagePath: 'images/Hoshino.png' },
  { sourceUrl: basePics[3].src, sourcePath: 'src/data/background-triangles.svg', packagePath: 'images/background-triangles.svg' },
  { sourceUrl: basePics[4].src, sourcePath: 'src/data/ba_triangles.svg', packagePath: 'images/ba_triangles.svg' },
] as const;
