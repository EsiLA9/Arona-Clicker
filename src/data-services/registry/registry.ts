import type { Datapack } from '../contracts/datapack';
import type { CharacterData } from '../contracts/character-data';
import type { CharacterVariantDef } from '../contracts/character-variant';
import type { CultivateCurveDef } from '../contracts/cultivate-curve';
import type { AffectionConfigDef } from '../contracts/affection-config';
import type { CharaProfileDef } from '../contracts/chara-profile';
import type { DropTableDef } from '../contracts/drop-table';
import type { ItemDef } from '../contracts/item';
import type { EnhancementDef } from '../contracts/enhancement';
import type { PassivePoolDef } from '../contracts/passive-pool';
import type { StoryDef } from '../contracts/story';
import type { ActiveStoryEntry, PassiveStoryEntry } from '../contracts/story-entry';
import type { StoryEntryDef } from '../contracts/story-entry';
import type { CharacterPersistConfig, CharacterPersistScope } from '../contracts/character-persist';
import { GachaMode } from '../contracts/gacha-pool';
import type { GachaPoolDef } from '../contracts/gacha-pool';
import type { ColorEquipmentDef, ColorGroupDef, ThemeDesignDef } from '../contracts/color';
// ============================================================
// data-services/registry.ts — 注册表 (Datapack 编译、校验、合并)
// ============================================================

import {
  FuncletDef,
  Character,
  ExtraCompound,
  ExtraPath,
  ExtraValue,
} from '../../engine/types';
import type { SpotTagOverrideState as SpotTagOverride } from '../../engine/contracts/state-query';
import { TagPath, tagDisplay, tagKey, parseTagRef, isTagRef, qualifyTagPath, tagRef } from '../../engine/core/tag';
import { expandFlatKeys, extra, getAtPath, mergeExtra } from '../../engine/extra/index';
import { RegistryError, validateDatapack } from './registry-validate';
import type { CharacterBonusTable, ResourceDisplayDef, ResolvedTagDef } from '../contracts/common';
import type { AreaDef, InitDef, SpotDef } from '../contracts/world';
import type { PicDef, PicKind } from '../contracts/pic';
import { parsePicId } from '../contracts/pic';

export { RegistryError };

/** 数据包表合并/清空步骤：merge 与 clear 共用的单一表清单（docs-824/08 T6）。 */
interface TableStep {
  /** 表名（清单可读性记录）。 */
  readonly table: string;
  /** 合并一个数据包的该表（含表专属索引/校验）。 */
  merge(dp: Datapack): void;
  /** 清空该表及其专属索引。 */
  clear(): void;
}

export class Registry {
  /**
   * 表步骤清单（构造期建一次）：新增一张表 = 私有字段 + getter + 本清单 1 条 step，
   * merge/clear 自动同步，不再各自手写清单。
   */
  private readonly tableSteps: readonly TableStep[];
  // 主存储
  private _inits: Map<string, InitDef> = new Map();
  private _areas: Map<string, AreaDef> = new Map();
  private _spots: Map<string, SpotDef> = new Map();
  private _spotTagModNames = new Map<string, string>();
  private _tagOwnerModNames = new Map<string, string>();
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
  private _colorGroups: Map<string, ColorGroupDef> = new Map();
  private _colorEquipments: Map<string, ColorEquipmentDef> = new Map();
  private _themeDesigns: Map<string, ThemeDesignDef> = new Map();
  /** 三层归属声明；缺省值见 characterScopeOf。 */
  private _characterPersistConfig: CharacterPersistConfig | undefined;
  /** 好感数值配置（部分覆盖合并；缺省字段用引擎内置阶梯，见 system/affection-system.ts）。 */
  private _affectionConfig: AffectionConfigDef | undefined;
  /** 资源条显示条目：resourceId → 显示配置（标签、可选策略、排序）。 */
  private _resourceDisplays: Map<string, ResourceDisplayDef> = new Map();
  /** 标签表现定义：路径串（如 'office' / 'office/defense'）→ 名称、简介。 */
  private _tagDefs: Map<string, ResolvedTagDef> = new Map();
  private _tagDefSources = new Map<string, string>();
  private _loadedModNames = new Set<string>(['base']);
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
  private currentPackModName = 'base';

  constructor() {
    this.tableSteps = [
      {
        table: 'inits',
        merge: dp => { for (const init of dp.inits) this._inits.set(init.id, init); },
        clear: () => this._inits.clear(),
      },
      {
        table: 'areas',
        merge: dp => {
          for (const area of dp.areas) {
            this._areas.set(area.id, area);
            if (!this._areasByInit.has(area.initId)) {
              this._areasByInit.set(area.initId, []);
            }
            this._areasByInit.get(area.initId)!.push(area.id);
          }
        },
        clear: () => { this._areas.clear(); this._areasByInit.clear(); },
      },
      {
        table: 'spots',
        merge: dp => {
          for (const spot of dp.spots) {
            this._spots.set(spot.id, spot);
            this._spotTagModNames.set(spot.id, this.currentPackModName);
            if (!this._spotsByArea.has(spot.areaId)) {
              this._spotsByArea.set(spot.areaId, []);
            }
            this._spotsByArea.get(spot.areaId)!.push(spot.id);
            // 层级标签索引：把每个声明标签的所有前缀都登记（父含子）
            for (const tag of spot.tags ?? []) this.indexSpotTag(spot.id, tag, this.currentPackModName);
          }
        },
        clear: () => { this._spots.clear(); this._spotsByArea.clear(); this._spotsByTag.clear(); this._spotTagModNames.clear(); },
      },
      {
        table: 'enhancements',
        merge: dp => { for (const enh of dp.enhancements) this._enhancements.set(enh.id, enh); },
        clear: () => this._enhancements.clear(),
      },
      {
        table: 'stories',
        merge: dp => { for (const story of dp.stories) this._stories.set(story.id, story); },
        clear: () => this._stories.clear(),
      },
      {
        table: 'activeStories',
        merge: dp => { for (const entry of dp.activeStories) this._activeStories.set(entry.id, entry); },
        clear: () => this._activeStories.clear(),
      },
      {
        table: 'passiveStories',
        merge: dp => { for (const entry of dp.passiveStories) this._passiveStories.set(entry.id, entry); },
        clear: () => this._passiveStories.clear(),
      },
      {
        table: 'passivePools',
        merge: dp => { for (const pool of dp.passivePools ?? []) this._passivePools.set(pool.id, pool); },
        clear: () => this._passivePools.clear(),
      },
      {
        table: 'items',
        merge: dp => { for (const item of dp.items) this._items.set(item.id, item); },
        clear: () => this._items.clear(),
      },
      {
        table: 'dropTables',
        merge: dp => {
          if (dp.dropTables) for (const table of dp.dropTables) this._dropTables.set(table.id, table);
        },
        clear: () => this._dropTables.clear(),
      },
      {
        table: 'funcletDefs',
        merge: dp => {
          if (dp.funcletDefs) for (const fd of dp.funcletDefs) this._funcletDefs.set(fd.id, fd);
        },
        clear: () => this._funcletDefs.clear(),
      },
      {
        table: 'characters',
        merge: dp => {
          if (dp.characters) for (const ch of dp.characters) this._characters.set(ch.id, ch);
        },
        clear: () => this._characters.clear(),
      },
      {
        // F-02：characterBonuses 已废弃，不再存储（GameInstance.init 负责警告）
        table: 'characterBonuses',
        merge: () => {},
        clear: () => { this._characterBonuses = []; },
      },
      {
        table: 'characterVariants',
        merge: dp => {
          if (dp.characterVariants) for (const v of dp.characterVariants) this._characterVariants.set(v.id, v);
        },
        clear: () => this._characterVariants.clear(),
      },
      {
        table: 'cultivateCurves',
        merge: dp => {
          if (dp.cultivateCurves) for (const c of dp.cultivateCurves) this._cultivateCurves.set(c.id, c);
        },
        clear: () => this._cultivateCurves.clear(),
      },
      {
        table: 'gachaPools',
        merge: dp => {
          if (!dp.gachaPools) return;
          const knownModes = new Set<string>(Object.values(GachaMode));
          for (const pool of dp.gachaPools) {
            if (!knownModes.has(pool.mode)) {
              throw new RegistryError(
                `卡池 ${pool.id} 的抽取模式 "${pool.mode}" 未在引擎注册（GachaMode 为代码定义，不可由数据包扩展）`,
              );
            }
            this._gachaPools.set(pool.id, pool);
          }
        },
        clear: () => this._gachaPools.clear(),
      },
      {
        table: 'colorGroups',
        merge: dp => {
          if (dp.colorGroups) for (const g of dp.colorGroups) this._colorGroups.set(g.id, g);
        },
        clear: () => this._colorGroups.clear(),
      },
      {
        table: 'colorEquipments',
        merge: dp => {
          if (dp.colorEquipments) for (const e of dp.colorEquipments) this._colorEquipments.set(e.id, e);
        },
        clear: () => this._colorEquipments.clear(),
      },
      {
        table: 'themeDesigns',
        merge: dp => {
          if (dp.themeDesigns) for (const d of dp.themeDesigns) this._themeDesigns.set(d.id, d);
        },
        clear: () => this._themeDesigns.clear(),
      },
      {
        table: 'characterPersistConfig',
        merge: dp => {
          if (!dp.characterPersistConfig) return;
          for (const [key, scope] of Object.entries(dp.characterPersistConfig)) {
            if (scope !== undefined && !Registry.PERSIST_SCOPES.has(scope)) {
              throw new RegistryError(`characterPersistConfig.${key} 非法值 "${scope}"（应为 global | init）`);
            }
          }
          this._characterPersistConfig = { ...this._characterPersistConfig, ...dp.characterPersistConfig };
        },
        clear: () => { this._characterPersistConfig = undefined; },
      },
      {
        table: 'affectionConfig',
        merge: dp => {
          if (!dp.affectionConfig) return;
          const cfg = dp.affectionConfig;
          for (const key of ['expBeyond', 'maxLevel'] as const) {
            const v = cfg[key];
            if (v !== undefined && (!Number.isFinite(v) || v < 0)) {
              throw new RegistryError(`affectionConfig.${key} 非法值 "${v}"（应为非负数）`);
            }
          }
          if (cfg.expCurve?.some(v => !Number.isFinite(v) || v <= 0)) {
            throw new RegistryError('affectionConfig.expCurve 含非法值（应为正数阶梯）');
          }
          if (cfg.defaultLevelCapByStar?.some(v => !Number.isFinite(v) || v <= 0)) {
            throw new RegistryError('affectionConfig.defaultLevelCapByStar 含非法值（应为正数上限）');
          }
          this._affectionConfig = { ...this._affectionConfig, ...cfg };
        },
        clear: () => { this._affectionConfig = undefined; },
      },
      {
        table: 'resourceDisplays',
        merge: dp => {
          if (dp.resourceDisplays) for (const rd of dp.resourceDisplays) this._resourceDisplays.set(rd.resourceId, rd);
        },
        clear: () => this._resourceDisplays.clear(),
      },
      {
        table: 'tags',
        merge: dp => {
          if (dp.tags) for (const t of dp.tags) {
            const parsedId = parseTagRef(t.id);
            const resolvedId = tagRef(parsedId?.modName ?? this.currentPackModName, parsedId?.path ?? [t.id]);
            const parsedParent = t.parent ? parseTagRef(t.parent) : undefined;
            const resolvedParent = parsedParent ? tagRef(parsedParent.modName, parsedParent.path) : undefined;
            const { parent: _parent, ...tagWithoutParent } = t;
            void _parent;
            this._tagDefs.set(resolvedId, { ...tagWithoutParent, id: resolvedId, ...(resolvedParent ? { parent: resolvedParent } : {}) });
          }
          this.rebuildSpotTagIndex();
        },
          clear: () => { this._tagDefs.clear(); this._tagDefSources.clear(); },
      },
      {
        table: 'pics',
        merge: dp => {
          if (!dp.pics) return;
          for (const p of dp.pics) {
            this._pics.set(p.id, p);
            const parsed = parsePicId(p.id);
            if (!parsed) continue; // 非法 id 由 registry-validate 加载期拦截；此处防御
            if (!this._picsByKind.has(parsed.type)) this._picsByKind.set(parsed.type, new Set());
            this._picsByKind.get(parsed.type)!.add(p.id);
          }
        },
        clear: () => { this._pics.clear(); this._picsByKind.clear(); },
      },
      {
        table: 'charaProfiles',
        merge: dp => {
          if (dp.charaProfiles) for (const cp of dp.charaProfiles) this._charaProfiles.set(cp.id, cp);
        },
        clear: () => this._charaProfiles.clear(),
      },
      {
        // Extra 常量表：扁平键展开为树后深合并进全局树（后加载覆盖同路径叶子）
        table: 'extras',
        merge: dp => {
          if (dp.extras) this._extras = mergeExtra(this._extras, expandFlatKeys(dp.extras));
        },
        clear: () => { this._extras = extra.dict({}); },
      },
    ];
  }

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
  /** 色彩组表（ColorGroupId → Def；唯一色彩实体）。 */
  get colorGroups(): ReadonlyMap<string, ColorGroupDef> { return this._colorGroups; }
  /** 色彩装备表（EquipmentId → Def）。 */
  get colorEquipments(): ReadonlyMap<string, ColorEquipmentDef> { return this._colorEquipments; }
  /** 实体配色设计表（DesignId → Def）。 */
  get themeDesigns(): ReadonlyMap<string, ThemeDesignDef> { return this._themeDesigns; }
  /** 好感数值配置（数据包声明；未声明返回 undefined = 引擎内置阶梯）。 */
  get affectionConfig(): AffectionConfigDef | undefined { return this._affectionConfig; }

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
    for (const e of this._colorEquipments.values()) {
      if (!this._colorGroups.has(e.colorGroupId)) {
        throw new RegistryError(`色彩装备 ${e.id} 引用了未定义的颜色组 "${e.colorGroupId}"`);
      }
      if (e.theme?.colorGroupId && !this._colorGroups.has(e.theme.colorGroupId)) {
        throw new RegistryError(`色彩装备 ${e.id} 的主题引用了未定义的颜色组 "${e.theme.colorGroupId}"`);
      }
    }
    for (const d of this._themeDesigns.values()) {
      if (d.theme.colorGroupId && !this._colorGroups.has(d.theme.colorGroupId)) {
        throw new RegistryError(`配色设计 ${d.id} 引用了未定义的颜色组 "${d.theme.colorGroupId}"`);
      }
    }
  }
  /** 资源条显示条目（数据包声明，驱动 UI 资源条渲染）。 */
  get resourceDisplays(): ReadonlyMap<string, ResourceDisplayDef> { return this._resourceDisplays; }

  /** 标签表现定义（完整 TagRef → 名称、简介，驱动 UI 中 Tag 的展示）。 */
  get tagDefs(): ReadonlyMap<string, ResolvedTagDef> { return this._tagDefs; }

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

  tagNameForSpotTag(spotId: string, path: TagPath): string {
    return this.tagName(qualifyTagPath(path, this._spotTagModNames.get(spotId) ?? 'base'));
  }

  tagDescriptionForSpotTag(spotId: string, path: TagPath): string | undefined {
    return this.tagDescription(qualifyTagPath(path, this._spotTagModNames.get(spotId) ?? 'base'));
  }

  /** 精确命中再沿路径向上找 TagDef，返回最长匹配（含精确命中本身）。 */
  private resolveTagDef(path: TagPath): ResolvedTagDef | undefined {
    for (const key of this.tagAncestorKeys(path)) {
      const def = this._tagDefs.get(key);
      if (def) return def;
    }
    return undefined;
  }

  /** 校验已合并 Registry 中所有显式 Tag parent；应在完整启用集 merge 后调用。 */
  validateTagRefs(): void {
    const parents = new Map<string, string>();
    for (const [key, def] of this._tagDefs) {
      if (def.parent === undefined) continue;
      const parentKey = tagKey([def.parent]);
      if (!this._tagDefs.has(parentKey)) {
        throw new RegistryError(`Tag "${key}" references unknown parent: "${def.parent}"`);
      }
      if (parentKey === key) {
        throw new RegistryError(`Tag "${key}" cannot parent itself`);
      }
      parents.set(key, parentKey);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string): void => {
      if (visited.has(key)) return;
      if (visiting.has(key)) throw new RegistryError(`Tag parent cycle detected at "${key}"`);
      visiting.add(key);
      const parent = parents.get(key);
      if (parent) visit(parent);
      visiting.delete(key);
      visited.add(key);
    }
    for (const key of parents.keys()) visit(key);
  }

  private tagAncestorKeys(path: TagPath, defaultModName = this.currentPackModName): string[] {
    const keys: string[] = [];
    const visited = new Set<string>();
    let currentKey = tagKey(path, defaultModName);
    while (currentKey && !visited.has(currentKey)) {
      visited.add(currentKey);
      keys.push(currentKey);
      const def = this._tagDefs.get(currentKey);
      if (def?.parent !== undefined) {
        currentKey = tagKey([def.parent], defaultModName);
        continue;
      }
      const parsed = parseTagRef(currentKey);
      if (!parsed || parsed.path.length <= 1) break;
      currentKey = tagKey([`${parsed.modName}:${parsed.path.slice(0, -1).join('/')}`], defaultModName);
    }
    return keys;
  }

  tagKeysForTag(path: TagPath, defaultModName = 'base'): string[] {
    return this.tagAncestorKeys(path, defaultModName);
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
   * @param overrides 运行时 tag 增撤覆盖（PlayerState.spotTagOverrides）；缺省只查声明。
   */
  spotsWithTag(tag: TagPath, overrides?: Record<string, SpotTagOverride>): string[] {
    const key = tagKey(tag);
    const result = new Set(this._spotsByTag.get(key) ?? []);
    // 运行时新增的 tag 不在声明索引里：按覆盖表补齐（含其前缀命中）
    for (const [spotId, override] of Object.entries(overrides ?? {})) {
      for (const added of override.added) {
        if (this.tagAncestorKeys(added).includes(key)) result.add(spotId);
      }
    }
    // 声明索引命中可能已被运行时撤出；按有效 tags 前缀匹配复核
    return [...result].filter(spotId => this.effectiveSpotTags(spotId, overrides)
      .some(t => this.tagAncestorKeys(t, this._spotTagModNames.get(spotId) ?? this.currentPackModName).includes(key)));
  }

  /**
   * Spot 的有效 tags = 声明 tags + 运行时新增 − 运行时撤出。
   * 纯查询：Registry 恒只读，运行时增撤经 mutations 落 PlayerState.spotTagOverrides（docs-824/08 T6）。
   */
  effectiveSpotTags(spotId: string, overrides?: Record<string, SpotTagOverride>): TagPath[] {
    const spot = this._spots.get(spotId);
    if (!spot) return [];
    const override = overrides?.[spotId];
    const defaultModName = this._spotTagModNames.get(spotId) ?? this.currentPackModName;
    const removed = new Set((override?.removed ?? []).map(path => tagKey(path)));
    const out: TagPath[] = [];
    for (const t of spot.tags ?? []) {
      if (!removed.has(tagKey(t, defaultModName))) out.push(t);
    }
    for (const t of override?.added ?? []) {
      if (!removed.has(tagKey(t))) out.push(t);
    }
    return out;
  }

  /** 登记某 Spot 的某 Tag 的所有前缀（父含子）——数据包加载时建立声明索引用。 */
  private indexSpotTag(spotId: string, tag: TagPath, defaultModName = this._spotTagModNames.get(spotId) ?? this.currentPackModName): void {
    for (const key of this.tagAncestorKeys(tag, defaultModName)) {
      if (!this._spotsByTag.has(key)) this._spotsByTag.set(key, new Set());
      this._spotsByTag.get(key)!.add(spotId);
    }
  }

  private rebuildSpotTagIndex(): void {
    this._spotsByTag.clear();
    for (const spot of this._spots.values()) {
      for (const tag of spot.tags ?? []) this.indexSpotTag(spot.id, tag);
    }
  }


  /** 加载并验证数据包 */
  load(datapack: Datapack): void {
    validateDatapack(datapack);
    this.currentPackModName = datapack.modName ?? 'base';
    const incomingTagKeys = new Set<string>();
    for (const tag of datapack.tags ?? []) {
      const key = tagKey([tag.id], this.currentPackModName);
      if (incomingTagKeys.has(key) || (this._tagDefs.has(key) && this._tagDefSources.get(key) !== this.currentPackModName)) {
        throw new RegistryError(`Duplicate canonical tag id: "${key}"`);
      }
      incomingTagKeys.add(key);
    }
    this._loadedModNames.add(this.currentPackModName);
    this.merge(datapack);
    for (const tag of datapack.tags ?? []) this._tagDefSources.set(tagKey([tag.id], this.currentPackModName), this.currentPackModName);
  }

  get loadedModNames(): ReadonlySet<string> { return this._loadedModNames; }

  /** 清空所有注册数据（遍历表步骤清单，与 merge 共用同一清单） */
  clear(): void {
    for (const step of this.tableSteps) step.clear();
    this._tagOwnerModNames.clear();
    this._loadedModNames = new Set(['base']);
  }


  /** 合并数据包到注册表（遍历表步骤清单，与 clear 共用同一清单） */
  private merge(dp: Datapack): void {
    for (const step of this.tableSteps) step.merge(dp);
    for (const table of [
      dp.inits, dp.areas, dp.spots, dp.enhancements, dp.passiveStories,
      dp.activeStories, dp.characters, dp.characterVariants,
    ]) {
      for (const entity of table ?? []) {
        if ('tags' in entity && entity.tags) this._tagOwnerModNames.set(entity.id, this.currentPackModName);
      }
    }
  }

  tagOwnerOf(entityId: string): string { return this._tagOwnerModNames.get(entityId) ?? 'base'; }

  tagKeyForSpotTag(spotId: string, path: TagPath): string {
    return tagKey(path, this._spotTagModNames.get(spotId) ?? this.currentPackModName);
  }
}
