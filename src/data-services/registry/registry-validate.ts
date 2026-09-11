import type { Datapack } from '../contracts/datapack';
// ============================================================
// data-services/registry-validate.ts — 数据包静态校验（纯函数）
// 从 registry.ts 拆出：只读检查 Datapack，不触碰注册表实例状态。
// 校验项：ID 唯一性、引用完整性（init/area/spot/story）、Extra 合法性。
// ============================================================

import { ExtraValue } from '../../engine/types';
import { parsePicId } from '../contracts/pic';
import { isTagRef } from '../../engine/core/tag';
import type { TagPath } from '../../engine/core/tag';
import { validateEntityId } from '../../engine/core/entity-id';
import { assertValidExtra, expandFlatKeys, ExtraError } from '../../engine/extra/index';

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

/**
 * 三段式 id 校验（docs/docs-828/06-adr/0004 §2）：
 * formatOnly = true 时只查格式（story / character 表待 S1b/c 中段归位后收紧）。
 */
const checkEntityIds = (
  items: { id: string }[] | undefined,
  expectedType: string,
  label: string,
  formatOnly = false,
) => {
  if (!items) return;
  for (const item of items) {
    const issue = validateEntityId(item.id);
    if (issue === 'format') {
      throw new RegistryError(
        `${label} id "${item.id}" 不符合三段式格式 modName:typeName:idName（段字符集 [a-z0-9-_]）`,
      );
    }
    if (formatOnly || issue === null) continue;
    throw new RegistryError(
      `${label} id "${item.id}" 的 typeName 段须为 "${expectedType}"（注册表见 core/entity-id.ts ENTITY_TYPES）`,
    );
  }
};

/** 校验数据包；非法即抛 RegistryError。 */
export function validateDatapack(dp: Datapack): void {
  if (dp.modName !== undefined && !/^[a-z0-9-]+$/.test(dp.modName)) {
    throw new RegistryError(`Datapack modName "${dp.modName}" 格式无效`);
  }
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
  if (dp.shops) checkDup(dp.shops, 'shop');
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
      if (t.id.includes(':') && !isTagRef(t.id)) {
        throw new RegistryError(`Tag id "${t.id}" 不符合 modName:tagPath 格式`);
      }
      if (t.parent !== undefined && !isTagRef(t.parent)) {
        throw new RegistryError(`Tag "${t.id}" 的 parent 必须是完整 TagRef`);
      }
    }
  }
  checkTaggedItems(dp.inits, 'Init');
  checkTaggedItems(dp.areas, 'Area');
  checkTaggedItems(dp.spots, 'Spot');
  checkTaggedItems(dp.enhancements, 'Enhancement');
  checkTaggedItems(dp.activeStories, 'Active story entry');
  checkTaggedItems(dp.passiveStories, 'Passive story entry');
  checkTaggedItems(dp.passivePools, 'Passive pool');
  checkTaggedItems(dp.characters, 'Character');
  for (const pack of dp.affectorPacks ?? []) for (const entry of pack.entries) {
    for (const modifier of entry.zoneModifiers ?? []) if (modifier.target.kind === 'tag') {
      checkTagPath(modifier.target.tag, `Affector pack "${pack.id}" zone modifier tag`);
    }
  }
  if (dp.pics) {
    checkDup(dp.pics, 'pic');
    for (const p of dp.pics) {
      if (!p.id) throw new RegistryError('Pic def missing id');
      const parsed = parsePicId(p.id);
      if (!parsed) {
        throw new RegistryError(`Pic id "${p.id}" 不符合三段式格式（modName:typeName(pic):idName，中段须以 (pic) 结尾）`);
      }
      if (!p.src) {
        throw new RegistryError(`Pic "${p.id}" missing src`);
      }
    }
  }
  if (dp.charaProfiles) {
    checkDup(dp.charaProfiles, 'chara profile');    for (const cp of dp.charaProfiles) {
      if (!cp.names || cp.names.length === 0) {
        throw new RegistryError(`Chara profile "${cp.id}" name 表至少一条`);
      }
      for (const n of cp.names) {
        if (!n.id || !n.text) {
          throw new RegistryError(`Chara profile "${cp.id}" name 条目缺 id 或 text`);
        }
      }
      const nameIds = new Set(cp.names.map(n => n.id));
      if (cp.activeName !== undefined && !nameIds.has(cp.activeName)) {
        throw new RegistryError(`Chara profile "${cp.id}" activeName "${cp.activeName}" 不在 name 表`);
      }
      const avatarIds = new Set((cp.avatars ?? []).map(a => a.id));
      if (cp.activeAvatar !== undefined && !avatarIds.has(cp.activeAvatar)) {
        throw new RegistryError(`Chara profile "${cp.id}" activeAvatar "${cp.activeAvatar}" 不在 avatar 表`);
      }
      for (const a of cp.avatars ?? []) {
        if (!a.id || !a.pic) {
          throw new RegistryError(`Chara profile "${cp.id}" avatar 条目缺 id 或 pic`);
        }
        if (!parsePicId(a.pic)) {
          throw new RegistryError(`Chara profile "${cp.id}" avatar "${a.id}" 的 pic 非 PicId（须为 mod:type(pic):id，不得持有裸 URL）`);
        }
      }
    }
  }

  if (dp.colorGroups) checkDup(dp.colorGroups, 'color group');
  if (dp.colorEquipments) checkDup(dp.colorEquipments, 'color equipment');
  if (dp.gears) checkDup(dp.gears, 'gear');
  if (dp.favoriteItems) checkDup(dp.favoriteItems, 'favorite item');
  if (dp.uniqueWeapons) checkDup(dp.uniqueWeapons, 'unique weapon');
  if (dp.traits) checkDup(dp.traits, 'trait');

  // 三段式 id 规范校验（§2）：强校验表按表名核对 typeName；
  // story / character 域 S1b/c 归位前仅查格式。
  checkEntityIds(dp.inits, 'init', 'Init');
  checkEntityIds(dp.areas, 'area', 'Area');
  checkEntityIds(dp.spots, 'spot', 'Spot');
  checkEntityIds(dp.enhancements, 'enhancement', 'Enhancement');
  checkEntityIds(dp.items, 'item', 'Item');
  checkEntityIds(dp.shops, 'shop', 'Shop');
  checkEntityIds(dp.dropTables, 'droptable', 'Drop table');
  // 匿名 Trigger（id 缺省 / anon: 派生前缀）不参与三段式校验
  checkEntityIds(
    dp.triggerDefs?.filter(t => t.id !== undefined && !t.id.startsWith('anon:')) as { id: string }[] | undefined,
    'trigger',
    'Trigger',
  );
  checkEntityIds(dp.affectorPacks, 'affectorpack', 'Affector pack');
  checkEntityIds(dp.funcletDefs, 'funclet', 'Funclet');
  checkEntityIds(dp.passivePools, 'passivepool', 'Passive pool');
  checkEntityIds(dp.gachaPools, 'gachapool', 'Gacha pool');
  checkEntityIds(dp.cultivateCurves, 'cultivatecurve', 'Cultivate curve');
  checkEntityIds(dp.colorGroups, 'colorgroup', 'Color group');
  checkEntityIds(dp.colorEquipments, 'colorequipment', 'Color equipment');
  checkEntityIds(dp.gears, 'gear', 'Gear');
  checkEntityIds(dp.themeDesigns, 'themedesign', 'Theme design');
  checkEntityIds(dp.resourceDisplays?.map(rd => ({ id: rd.resourceId })), 'resource', 'Resource display');
  // story 三表强校验（S1b 落地）：本体 / 主动投放位 / 被动投放位各自中段归位；
  // characters / characterVariants 裸名（S1c 命名空间化）暂不校验。
  checkEntityIds(dp.stories, 'story', 'Story');
  checkEntityIds(dp.activeStories, 'activestory', 'Active story entry');
  checkEntityIds(dp.passiveStories, 'passivestory', 'Passive story entry');

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
  const checkDefExtras = <T extends { id?: unknown; extra?: ExtraValue }>(
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
          throw new RegistryError(`Invalid extra on ${label} "${item.id ?? '<anonymous>'}": ${e.message}`);
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

function checkTagPath(path: TagPath, label: string): void {
  if (!Array.isArray(path) || path.length === 0 || path.some(segment => typeof segment !== 'string' || segment.length === 0)) {
    throw new RegistryError(`${label} 必须是非空 TagPath`);
  }
  const key = path.join('/');
  if (path.some((segment, index) => segment.includes(':') && index !== 0) || (path[0].includes(':') && !isTagRef(key))) {
    throw new RegistryError(`${label} 不符合 modName:tagPath 格式`);
  }
  const normalized = path[0].includes(':') ? key : `base:${key}`;
  if (!isTagRef(normalized)) throw new RegistryError(`${label} 含非法 TagPath 段`);
}

function checkTaggedItems(items: Array<{ id: string; tags?: TagPath[] }> | undefined, label: string): void {
  for (const item of items ?? []) for (const [index, path] of (item.tags ?? []).entries()) {
    checkTagPath(path, `${label} "${item.id}" tags[${index}]`);
  }
}
