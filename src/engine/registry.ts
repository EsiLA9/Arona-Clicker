// ============================================================
// engine/registry.ts — 注册表 (Datapack 编译、校验、合并)
// ============================================================

import {
  Datapack,
  InitDef,
  AreaDef,
  SpotDef,
  EnhancementDef,
  StoryDef,
  ItemDef,
  FuncletDef,
  DropTableDef,
  CharacterData,
  CharacterBonusTable,
  Character,
  ResourceDisplayDef,
  ExtraCompound,
  ExtraPath,
  ExtraValue,
} from './types';
import { TagPath, tagDisplay } from './tag';
import { assertValidExtra, expandFlatKeys, ExtraError, extra, getAtPath, mergeExtra } from './extra';

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

export class Registry {
  // 主存储
  private _inits: Map<string, InitDef> = new Map();
  private _areas: Map<string, AreaDef> = new Map();
  private _spots: Map<string, SpotDef> = new Map();
  private _enhancements: Map<string, EnhancementDef> = new Map();
  private _stories: Map<string, StoryDef> = new Map();
  private _items: Map<string, ItemDef> = new Map();
  private _dropTables: Map<string, DropTableDef> = new Map();
  private _funcletDefs: Map<string, FuncletDef> = new Map();
  private _characters: Map<Character, CharacterData> = new Map();
  private _characterBonuses: CharacterBonusTable[] = [];
  /** 资源条显示条目：resourceId → 显示配置（标签、可选策略、排序）。 */
  private _resourceDisplays: Map<string, ResourceDisplayDef> = new Map();
  /** Extra 全局常量树：多个数据包 extras 常量表深合并结果（见 docs/13 §5.3）。 */
  private _extras: ExtraCompound = extra.dict({});

  // 关系索引
  private _areasByInit: Map<string, string[]> = new Map();
  private _spotsByArea: Map<string, string[]> = new Map();
  /** 层级标签 → 拥有该标签（或其前缀匹配）的 Spot。key 为路径串（含所有前缀展开）。 */
  private _spotsByTag: Map<string, Set<string>> = new Map();

  // 只读访问器
  get inits(): ReadonlyMap<string, InitDef> { return this._inits; }
  get areas(): ReadonlyMap<string, AreaDef> { return this._areas; }
  get spots(): ReadonlyMap<string, SpotDef> { return this._spots; }
  get enhancements(): ReadonlyMap<string, EnhancementDef> { return this._enhancements; }
  get stories(): ReadonlyMap<string, StoryDef> { return this._stories; }
  get items(): ReadonlyMap<string, ItemDef> { return this._items; }
  get dropTables(): ReadonlyMap<string, DropTableDef> { return this._dropTables; }
  get funcletDefs(): ReadonlyMap<string, FuncletDef> { return this._funcletDefs; }
  get characters(): ReadonlyMap<Character, CharacterData> { return this._characters; }
  get characterBonuses(): readonly CharacterBonusTable[] { return this._characterBonuses; }
  /** 资源条显示条目（数据包声明，驱动 UI 资源条渲染）。 */
  get resourceDisplays(): ReadonlyMap<string, ResourceDisplayDef> { return this._resourceDisplays; }

  /**
   * Extra 全局常量树（数据包 extras 常量表深合并结果）。
   * 返回内部引用，调用方不得直接修改；查询请用 getExtra()。
   */
  get extras(): ExtraCompound { return this._extras; }

  /** 沿路径读取 Extra 全局常量；不存在返回 undefined。 */
  getExtra(path: ExtraPath): ExtraValue | undefined { return getAtPath(this._extras, path); }

  /** 查询 Init 下的所有 Area ID */
  areasOfInit(initId: string): string[] { return this._areasByInit.get(initId) ?? []; }
  /** 查询 Area 下的所有 Spot ID */
  spotsOfArea(areaId: string): string[] { return this._spotsByArea.get(areaId) ?? []; }
  /** 查询 Init 下所有 Area 覆盖的 Spot ID（隔离于其他 Init） */
  spotsOfInit(initId: string): string[] {
    return this.areasOfInit(initId).flatMap(areaId => this.spotsOfArea(areaId));
  }

  /**
   * 查询拥有指定标签（含其 child，前缀匹配）的所有 Spot ID。
   * @param tag 查询标签路径，如 tagPath('office') 命中 office 与 office/*。
   */
  spotsWithTag(tag: TagPath): string[] {
    return [...(this._spotsByTag.get(tagDisplay(tag)) ?? [])];
  }

  /**
   * 运行时给 Spot 新加入一个 Tag（会同步更新层级索引，使 Enhancement 按 Tag
   * 的作用范围、tag 条件等立即生效）。已存在同名 Tag 时无操作。
   */
  addSpotTag(spotId: string, tag: TagPath): boolean {
    const spot = this._spots.get(spotId);
    if (!spot) return false;
    if ((spot.tags ?? []).some(t => tagDisplay(t) === tagDisplay(tag))) return false;
    if (!spot.tags) (spot as { tags?: TagPath[] }).tags = [];
    spot.tags.push(tag);
    this.indexSpotTag(spotId, tag);
    return true;
  }

  /** 运行时让 Spot 撤出一个 Tag（同步更新层级索引）。无该 Tag 时无操作。 */
  removeSpotTag(spotId: string, tag: TagPath): boolean {
    const spot = this._spots.get(spotId);
    if (!spot) return false;
    const idx = (spot.tags ?? []).findIndex(t => tagDisplay(t) === tagDisplay(tag));
    if (idx < 0) return false;
    spot.tags.splice(idx, 1);
    this.unindexSpotTag(spotId, tag);
    return true;
  }

  /** 登记某 Spot 的某 Tag 的所有前缀（父含子）。 */
  private indexSpotTag(spotId: string, tag: TagPath): void {
    for (let i = 1; i <= tag.length; i++) {
      const prefix = tagDisplay(tag.slice(0, i));
      if (!this._spotsByTag.has(prefix)) this._spotsByTag.set(prefix, new Set());
      this._spotsByTag.get(prefix)!.add(spotId);
    }
  }

  /** 撤出某 Spot 的某 Tag 的所有前缀登记。 */
  private unindexSpotTag(spotId: string, tag: TagPath): void {
    for (let i = 1; i <= tag.length; i++) {
      const prefix = tagDisplay(tag.slice(0, i));
      const set = this._spotsByTag.get(prefix);
      if (!set) continue;
      set.delete(spotId);
      if (set.size === 0) this._spotsByTag.delete(prefix);
    }
  }

  /** 加载并验证数据包 */
  load(datapack: Datapack): void {
    this.validate(datapack);
    this.merge(datapack);
  }

  /** 清空所有注册数据 */
  clear(): void {
    this._inits.clear();
    this._areas.clear();
    this._spots.clear();
    this._enhancements.clear();
    this._stories.clear();
    this._items.clear();
    this._dropTables.clear();
    this._funcletDefs.clear();
    this._characters.clear();
    this._characterBonuses = [];
    this._resourceDisplays.clear();
    this._extras = extra.dict({});
    this._areasByInit.clear();
    this._spotsByArea.clear();
    this._spotsByTag.clear();
  }

  /** 校验数据包 */
  private validate(dp: Datapack): void {
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

  /** 合并数据包到注册表 */
  private merge(dp: Datapack): void {
    for (const init of dp.inits) this._inits.set(init.id, init);
    for (const area of dp.areas) {
      this._areas.set(area.id, area);
      if (!this._areasByInit.has(area.initId)) {
        this._areasByInit.set(area.initId, []);
      }
      this._areasByInit.get(area.initId)!.push(area.id);
    }
    for (const spot of dp.spots) {
      this._spots.set(spot.id, spot);
      if (!this._spotsByArea.has(spot.areaId)) {
        this._spotsByArea.set(spot.areaId, []);
      }
      this._spotsByArea.get(spot.areaId)!.push(spot.id);
      // 层级标签索引：把每个声明标签的所有前缀都登记（父含子）
      for (const tag of spot.tags ?? []) this.indexSpotTag(spot.id, tag);
    }
    for (const enh of dp.enhancements) this._enhancements.set(enh.id, enh);
    for (const story of dp.stories) this._stories.set(story.id, story);
    for (const item of dp.items) this._items.set(item.id, item);
    if (dp.dropTables) {
      for (const table of dp.dropTables) this._dropTables.set(table.id, table);
    }
    if (dp.funcletDefs) {
      for (const fd of dp.funcletDefs) this._funcletDefs.set(fd.id, fd);
    }
    if (dp.characters) {
      for (const ch of dp.characters) this._characters.set(ch.id, ch);
    }
    if (dp.characterBonuses) {
      this._characterBonuses.push(...dp.characterBonuses);
    }
    if (dp.resourceDisplays) {
      for (const rd of dp.resourceDisplays) this._resourceDisplays.set(rd.resourceId, rd);
    }
    // Extra 常量表：扁平键展开为树后深合并进全局树（后加载覆盖同路径叶子）
    if (dp.extras) {
      this._extras = mergeExtra(this._extras, expandFlatKeys(dp.extras));
    }
  }
}
