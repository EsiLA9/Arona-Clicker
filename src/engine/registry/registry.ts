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
  StoryEntryDef,
  ActiveStoryEntry,
  PassiveStoryEntry,
  PassivePoolDef,
  ItemDef,
  FuncletDef,
  DropTableDef,
  CharacterData,
  CharacterBonusTable,
  Character,
  CharacterPersistConfig,
  CharacterPersistScope,
  CharacterVariantDef,
  ChatMessageDef,
  ColorDef,
  ColorEquipmentDef,
  ColorGroupDef,
  CultivateCurveDef,
  GachaMode,
  GachaPoolDef,
  ResourceDisplayDef,
  TagDef,
  PicDef,
  PicKind,
  parsePicId,
  CharaProfileDef,
  ExtraCompound,
  ExtraPath,
  ExtraValue,
} from '../types';
import { TagPath, tagDisplay } from '../core/tag';
import { expandFlatKeys, extra, getAtPath, mergeExtra } from '../extra/index';
import { RegistryError, validateDatapack } from './registry-validate';

export { RegistryError };

export class Registry {
  // 主存储
  private _inits: Map<string, InitDef> = new Map();
  private _areas: Map<string, AreaDef> = new Map();
  private _spots: Map<string, SpotDef> = new Map();
  private _enhancements: Map<string, EnhancementDef> = new Map();
  private _stories: Map<string, StoryDef> = new Map();
  /**
   * 剧情入口注册表：id 为对外故事 id；演出经 entry.storyId 重定向到 _stories。
   * 含主线 / 支线 / 羁绊剧情入口（原 KizunaStoryEntry 已并入）。
   */
  private _activeStories: Map<string, ActiveStoryEntry> = new Map();
  /** 随机闲聊入口注册表：id 为对外故事 id；演出经 entry.storyId 重定向到 _stories。 */
  private _passiveStories: Map<string, PassiveStoryEntry> = new Map();
  private _passivePools: Map<string, PassivePoolDef> = new Map();
  private _items: Map<string, ItemDef> = new Map();
  private _dropTables: Map<string, DropTableDef> = new Map();
  private _funcletDefs: Map<string, FuncletDef> = new Map();
  private _characters: Map<Character, CharacterData> = new Map();
  private _characterBonuses: CharacterBonusTable[] = [];
  /** Character 重构表（docs-818/12-character-rework.md §2）。 */
  private _characterVariants: Map<string, CharacterVariantDef> = new Map();
  private _cultivateCurves: Map<string, CultivateCurveDef> = new Map();
  private _gachaPools: Map<string, GachaPoolDef> = new Map();
  private _colors: Map<string, ColorDef> = new Map();
  private _colorGroups: Map<string, ColorGroupDef> = new Map();
  private _colorEquipments: Map<string, ColorEquipmentDef> = new Map();
  private _chatMessages: Map<string, ChatMessageDef> = new Map();
  /** 三层归属声明；缺省值见 characterScopeOf。 */
  private _characterPersistConfig: CharacterPersistConfig | undefined;
  /** 资源条显示条目：resourceId → 显示配置（标签、可选策略、排序）。 */
  private _resourceDisplays: Map<string, ResourceDisplayDef> = new Map();
  /** 标签表现定义：路径串（如 'office' / 'office/defense'）→ 名称、简介。 */
  private _tagDefs: Map<string, TagDef> = new Map();
  /** 图片资产表：完整索引（`mod:type(pic):id`）→ Def。 */
  private _pics: Map<string, PicDef> = new Map();
  /** 图片类别索引：typeName → 完整索引集合（由 id 中段推导）。 */
  private _picsByKind: Map<string, Set<string>> = new Map();
  /** Chara 资料表：原型 id → 声明。 */
  private _charaProfiles: Map<Character, CharaProfileDef> = new Map();
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
  /** 剧情入口（对外故事 id → Entry）。 */
  get activeStories(): ReadonlyMap<string, ActiveStoryEntry> { return this._activeStories; }
  /** 随机闲聊入口（对外故事 id → Entry）。 */
  get passiveStories(): ReadonlyMap<string, PassiveStoryEntry> { return this._passiveStories; }
  get passivePools(): ReadonlyMap<string, PassivePoolDef> { return this._passivePools; }
  /**
   * 剧情入口合并只读视图（active + passive）。供需要统一遍历/按 id 查询的消费方（指纹、可见性、剧情服务）。
   */
  get storyEntries(): ReadonlyMap<string, StoryEntryDef> {
    return new Map<string, StoryEntryDef>([...this._activeStories, ...this._passiveStories]);
  }
  get items(): ReadonlyMap<string, ItemDef> { return this._items; }
  get dropTables(): ReadonlyMap<string, DropTableDef> { return this._dropTables; }
  get funcletDefs(): ReadonlyMap<string, FuncletDef> { return this._funcletDefs; }
  get characters(): ReadonlyMap<Character, CharacterData> { return this._characters; }
  /** @deprecated F-02 冻结：恒为空数组，仅保留访问器兼容。 */
  get characterBonuses(): readonly CharacterBonusTable[] { return this._characterBonuses; }
  /** 角色差分表（VariantId → Def）。 */
  get characterVariants(): ReadonlyMap<string, CharacterVariantDef> { return this._characterVariants; }
  /** 培养曲线表。 */
  get cultivateCurves(): ReadonlyMap<string, CultivateCurveDef> { return this._cultivateCurves; }
  /** 卡池表（PoolId → Def）。 */
  get gachaPools(): ReadonlyMap<string, GachaPoolDef> { return this._gachaPools; }
  /** 色彩表（ColorId → Def）。 */
  get colors(): ReadonlyMap<string, ColorDef> { return this._colors; }
  /** 颜色组表（ColorGroupId → Def）。 */
  get colorGroups(): ReadonlyMap<string, ColorGroupDef> { return this._colorGroups; }
  /** 色彩装备表（EquipmentId → Def）。 */
  get colorEquipments(): ReadonlyMap<string, ColorEquipmentDef> { return this._colorEquipments; }
  /** 聊天流内容表（MessageId → Def）。 */
  get chatMessages(): ReadonlyMap<string, ChatMessageDef> { return this._chatMessages; }

  /** CharacterPersistScope 合法值（加载期 fail-fast 校验用）。 */
  private static readonly PERSIST_SCOPES: ReadonlySet<string> = new Set(['global', 'init']);
  /** 归属缺省：收集类资产 global，已读记录随世界线。 */
  private static readonly PERSIST_DEFAULTS: Record<'roster' | 'gacha' | 'equips' | 'chatRead', CharacterPersistScope> = {
    roster: 'global',
    gacha: 'global',
    equips: 'global',
    chatRead: 'init',
  };

  /**
   * 读取某状态块的持久层归属（数据包 characterPersistConfig 声明，未声明用缺省）。
   * 快照逻辑（init-savepoint.ts）据此决定进快照还是跨世界线保留。
   */
  characterScopeOf(key: 'roster' | 'gacha' | 'equips' | 'chatRead'): CharacterPersistScope {
    return this._characterPersistConfig?.[key] ?? Registry.PERSIST_DEFAULTS[key];
  }

  /**
   * Character 表引用完整性校验：卡池引用的差分必须已定义。
   * 在全部数据包加载完成后调用（跨包引用允许后加载补齐）。
   */
  validateCharacterRefs(): void {
    for (const pool of this._gachaPools.values()) {
      for (const id of [...pool.members, ...(pool.featured ?? [])]) {
        if (!this._characterVariants.has(id)) {
          throw new RegistryError(`卡池 ${pool.id} 引用了未定义的差分 "${id}"`);
        }
      }
      for (const v of this._characterVariants.values()) {
        if (v.curve && !this._cultivateCurves.has(v.curve)) {
          throw new RegistryError(`差分 ${v.id} 引用了未定义的培养曲线 "${v.curve}"`);
        }
      }
    }
    for (const g of this._colorGroups.values()) {
      for (const slot of g.slots) {
        if (!this._colors.has(slot.colorId)) {
          throw new RegistryError(`颜色组 ${g.id} 引用了未定义的颜色 "${slot.colorId}"`);
        }
      }
    }
    for (const e of this._colorEquipments.values()) {
      if (!this._colorGroups.has(e.colorGroupId)) {
        throw new RegistryError(`色彩装备 ${e.id} 引用了未定义的颜色组 "${e.colorGroupId}"`);
      }
      if (e.themeColorId && !this._colors.has(e.themeColorId)) {
        throw new RegistryError(`色彩装备 ${e.id} 引用了未定义的主题色 "${e.themeColorId}"`);
      }
    }
  }
  /** 资源条显示条目（数据包声明，驱动 UI 资源条渲染）。 */
  get resourceDisplays(): ReadonlyMap<string, ResourceDisplayDef> { return this._resourceDisplays; }

  /** 标签表现定义（路径串 → 名称、简介，驱动 UI 中 Tag 的展示）。 */
  get tagDefs(): ReadonlyMap<string, TagDef> { return this._tagDefs; }

  /** 图片资产表（完整索引 `mod:type(pic):id` → Def）。 */
  get pics(): ReadonlyMap<string, PicDef> { return this._pics; }

  /** 按用途类别（typeName 段）查询图片完整索引。 */
  picsOfKind(kind: PicKind): string[] {
    return [...(this._picsByKind.get(kind) ?? [])];
  }

  /** Chara 资料表（原型 id → CharaProfileDef）。 */
  get charaProfiles(): ReadonlyMap<Character, CharaProfileDef> { return this._charaProfiles; }

  /**
   * 解析 Tag 的展示名：优先精确匹配 TagDef；否则沿路径逐级向上找最长前缀定义；
   * 都未定义则回退为路径串（tagDisplay）。
   */
  tagName(path: TagPath): string {
    const name = this.resolveTagDef(path)?.name;
    return name !== undefined && name !== '' ? name : tagDisplay(path);
  }

  /**
   * 解析 Tag 的简介（tooltip）：优先精确匹配；否则沿路径向上找最长前缀定义。
   */
  tagDescription(path: TagPath): string | undefined {
    return this.resolveTagDef(path)?.description;
  }

  /** 精确命中再沿路径向上找 TagDef，返回最长匹配（含精确命中本身）。 */
  private resolveTagDef(path: TagPath): TagDef | undefined {
    const segments = path.slice();
    while (segments.length > 0) {
      const def = this._tagDefs.get(tagDisplay(segments));
      if (def) return def;
      segments.pop();
    }
    return undefined;
  }

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
    validateDatapack(datapack);
    this.merge(datapack);
  }

  /** 清空所有注册数据 */
  clear(): void {
    this._inits.clear();
    this._areas.clear();
    this._spots.clear();
    this._enhancements.clear();
    this._stories.clear();
    this._activeStories.clear();
    this._passiveStories.clear();
    this._passivePools.clear();
    this._items.clear();
    this._dropTables.clear();
    this._funcletDefs.clear();
    this._characters.clear();
    this._characterBonuses = [];
    this._characterVariants.clear();
    this._cultivateCurves.clear();
    this._gachaPools.clear();
    this._colors.clear();
    this._colorGroups.clear();
    this._colorEquipments.clear();
    this._chatMessages.clear();
    this._characterPersistConfig = undefined;
    this._resourceDisplays.clear();
    this._tagDefs.clear();
    this._pics.clear();
    this._picsByKind.clear();
    this._charaProfiles.clear();
    this._extras = extra.dict({});
    this._areasByInit.clear();
    this._spotsByArea.clear();
    this._spotsByTag.clear();
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
    for (const entry of dp.activeStories) this._activeStories.set(entry.id, entry);
    for (const entry of dp.passiveStories) this._passiveStories.set(entry.id, entry);
    for (const pool of dp.passivePools ?? []) this._passivePools.set(pool.id, pool);
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
    // F-02：characterBonuses 已废弃，不再存储（GameInstance.init 负责警告）
    if (dp.characterVariants) {
      for (const v of dp.characterVariants) this._characterVariants.set(v.id, v);
    }
    if (dp.cultivateCurves) {
      for (const c of dp.cultivateCurves) this._cultivateCurves.set(c.id, c);
    }
    if (dp.gachaPools) {
      const knownModes = new Set<string>(Object.values(GachaMode));
      for (const pool of dp.gachaPools) {
        if (!knownModes.has(pool.mode)) {
          throw new RegistryError(
            `卡池 ${pool.id} 的抽取模式 "${pool.mode}" 未在引擎注册（GachaMode 为代码定义，不可由数据包扩展）`,
          );
        }
        this._gachaPools.set(pool.id, pool);
      }
    }
    if (dp.colors) {
      for (const c of dp.colors) this._colors.set(c.id, c);
    }
    if (dp.colorGroups) {
      for (const g of dp.colorGroups) this._colorGroups.set(g.id, g);
    }
    if (dp.colorEquipments) {
      for (const e of dp.colorEquipments) this._colorEquipments.set(e.id, e);
    }
    if (dp.chatMessages) {
      for (const m of dp.chatMessages) this._chatMessages.set(m.id, m);
    }
    if (dp.characterPersistConfig) {
      for (const [key, scope] of Object.entries(dp.characterPersistConfig)) {
        if (scope !== undefined && !Registry.PERSIST_SCOPES.has(scope)) {
          throw new RegistryError(`characterPersistConfig.${key} 非法值 "${scope}"（应为 global | init）`);
        }
      }
      this._characterPersistConfig = { ...this._characterPersistConfig, ...dp.characterPersistConfig };
    }
    if (dp.resourceDisplays) {
      for (const rd of dp.resourceDisplays) this._resourceDisplays.set(rd.resourceId, rd);
    }
    if (dp.tags) {
      for (const t of dp.tags) this._tagDefs.set(t.id, t);
    }
    if (dp.pics) {
      for (const p of dp.pics) {
        this._pics.set(p.id, p);
        const parsed = parsePicId(p.id);
        if (!parsed) continue; // 非法 id 由 registry-validate 加载期拦截；此处防御
        if (!this._picsByKind.has(parsed.type)) this._picsByKind.set(parsed.type, new Set());
        this._picsByKind.get(parsed.type)!.add(p.id);
      }
    }
    if (dp.charaProfiles) {
      for (const cp of dp.charaProfiles) this._charaProfiles.set(cp.id, cp);
    }
    // Extra 常量表：扁平键展开为树后深合并进全局树（后加载覆盖同路径叶子）
    if (dp.extras) {
      this._extras = mergeExtra(this._extras, expandFlatKeys(dp.extras));
    }
  }
}
