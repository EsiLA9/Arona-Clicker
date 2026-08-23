// ============================================================
// engine/registry-validate.ts — 数据包静态校验（纯函数）
// 从 registry.ts 拆出：只读检查 Datapack，不触碰注册表实例状态。
// 校验项：ID 唯一性、引用完整性（init/area/spot/story）、Extra 合法性。
// ============================================================

import { Datapack, ExtraValue } from '../types';
import { assertValidExtra, expandFlatKeys, ExtraError } from '../extra/index';

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

/** 校验数据包；非法即抛 RegistryError。 */
export function validateDatapack(dp: Datapack): void {
  // 检查 ID 唯一性
  const checkDup = <T extends { id: string }>(items: T[], label: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) {
        throw new RegistryError(`Duplicate ${label} id: "${item.id}"`);
      }
      seen.add(item.id);
    }
  };

  checkDup(dp.inits, 'init');
  checkDup(dp.areas, 'area');
  checkDup(dp.spots, 'spot');
  checkDup(dp.enhancements, 'enhancement');
  checkDup(dp.stories, 'story');
  checkDup(dp.activeStories, 'active story entry');
  checkDup(dp.passiveStories, 'passive story entry');
  checkDup(dp.items, 'item');
  if (dp.dropTables) checkDup(dp.dropTables, 'drop table');
  if (dp.funcletDefs) checkDup(dp.funcletDefs, 'funclet');
  if (dp.characters) checkDup(dp.characters, 'character');
  if (dp.resourceDisplays) {
    checkDup(
      dp.resourceDisplays.map(rd => ({ id: rd.resourceId })),
      'resource display',
    );
    for (const rd of dp.resourceDisplays) {
      if (!rd.resourceId) {
        throw new RegistryError('Resource display entry missing resourceId');
      }
    }
  }
  if (dp.tags) {
    checkDup(dp.tags, 'tag');
    for (const t of dp.tags) {
      if (!t.id) {
        throw new RegistryError('Tag def missing id');
      }
    }
  }

  // 检查引用完整性
  const initIds = new Set(dp.inits.map(i => i.id));
  const areaIds = new Set(dp.areas.map(a => a.id));

  for (const area of dp.areas) {
    if (!initIds.has(area.initId)) {
      throw new RegistryError(`Area "${area.id}" references unknown init: "${area.initId}"`);
    }
  }
  for (const spot of dp.spots) {
    if (!areaIds.has(spot.areaId)) {
      throw new RegistryError(`Spot "${spot.id}" references unknown area: "${spot.areaId}"`);
    }
  }
  for (const init of dp.inits) {
    for (const aid of init.defaultAreas) {
      if (!areaIds.has(aid)) {
        throw new RegistryError(`Init "${init.id}" references unknown default area: "${aid}"`);
      }
    }
  }
  for (const area of dp.areas) {
    for (const sid of area.defaultSpots) {
      const spotExists = dp.spots.some(s => s.id === sid);
      if (!spotExists) {
        throw new RegistryError(`Area "${area.id}" references unknown default spot: "${sid}"`);
      }
    }
  }
  // StoryEntry.storyId 引用完整性：必须能解析到 stories 表中的纯演出 Story
  const storyIds = new Set(dp.stories.map(s => s.id));
  for (const entry of [...dp.activeStories, ...dp.passiveStories]) {
    if (!storyIds.has(entry.storyId)) {
      throw new RegistryError(`Story entry "${entry.id}" references unknown story: "${entry.storyId}"`);
    }
  }

  // 校验 Extra 数据：各 Def 的 extra 字段 + 数据包 extras 常量表（统一规则，见 docs/13 §8）
  const checkDefExtras = <T extends { id: unknown; extra?: ExtraValue }>(
    items: T[] | undefined,
    label: string,
  ): void => {
    if (!items) return;
    for (const item of items) {
      if (item.extra === undefined) continue;
      try {
        assertValidExtra(item.extra);
      } catch (e) {
        if (e instanceof ExtraError) {
          throw new RegistryError(`Invalid extra on ${label} "${String(item.id)}": ${e.message}`);
        }
        throw e;
      }
    }
  };
  checkDefExtras(dp.inits, 'init');
  checkDefExtras(dp.areas, 'area');
  checkDefExtras(dp.spots, 'spot');
  checkDefExtras(dp.enhancements, 'enhancement');
  checkDefExtras(dp.stories, 'story');
  checkDefExtras(dp.activeStories, 'active story entry');
  checkDefExtras(dp.passiveStories, 'passive story entry');
  checkDefExtras(dp.items, 'item');
  checkDefExtras(dp.dropTables, 'drop table');
  checkDefExtras(dp.funcletDefs, 'funclet');
  checkDefExtras(dp.characters, 'character');
  checkDefExtras(dp.affectorPacks, 'affector pack');
  checkDefExtras(dp.triggerDefs, 'trigger');
  if (dp.extras) {
    try {
      assertValidExtra(expandFlatKeys(dp.extras));
    } catch (e) {
      if (e instanceof ExtraError) {
        throw new RegistryError(`Invalid datapack extras: ${e.message}`);
      }
      throw e;
    }
  }
}