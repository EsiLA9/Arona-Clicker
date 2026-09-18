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
import type { FavoriteItemDef, GearConfigDef, GearDef, TraitDef, UniqueWeaponDef } from '../contracts/character-progression-def';
import type { ShopDef } from '../contracts/shop';
import type { PaymentOptionDef } from '../contracts/cost';
import type { EntityPresentationDef } from '../contracts/entity-presentation';
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
import { effectiveDefMetadata } from '../contracts/common';
import type { EffectiveDefMetadata, ResourceDisplayDef, ResolvedTagDef } from '../contracts/common';
import type { AreaDef, InitDef, SpotDef } from '../contracts/world';
import type { PicDef, PicKind } from '../contracts/pic';
import { parsePicId } from '../contracts/pic';
import { parseEntityId } from '../../engine/core/entity-id';
import type { RegistrySpotMutation, RegistrySpotMutationReceipt } from './registry-spot-mutation';
import type {
  RegistryAreaMutation,
  RegistryAreaMutationReceipt,
  RegistryInitMutation,
  RegistryInitMutationReceipt,
} from './registry-world-mutation';

export { RegistryError };
export type { RegistrySpotMutation, RegistrySpotMutationReceipt } from './registry-spot-mutation';
export type {
  RegistryAreaMutation,
  RegistryAreaMutationReceipt,
  RegistryInitMutation,
  RegistryInitMutationReceipt,
} from './registry-world-mutation';

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
  private _suspendedSpots = new Map<string, { spot: SpotDef; ownerModName: string }>();
  private _initSourceModNames = new Map<string, string>();
  private _areaSourceModNames = new Map<string, string>();
  private _spotSourceModNames = new Map<string, string>();
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
  /** Character 重构表（docs-818/12-character-rework.md §2）。 */
  private _characterVariants: Map<string, CharacterVariantDef> = new Map();
  private _cultivateCurves: Map<string, CultivateCurveDef> = new Map();
  /** 角色养成声明表（A 段只声明，无消费）。 */
  private _favoriteItems: Map<string, FavoriteItemDef> = new Map();
  private _uniqueWeapons: Map<string, UniqueWeaponDef> = new Map();
  private _traits: Map<string, TraitDef> = new Map();
  /** 装备类型线表（GearId → Def）。 */
  private _gears: Map<string, GearDef> = new Map();
  /** 装备成长全局配置（多包覆盖合并）。 */
  private _gearConfig: GearConfigDef | undefined;
  private _gachaPools: Map<string, GachaPoolDef> = new Map();
  private _shops: Map<string, ShopDef> = new Map();
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
  private _spotMutationRevision = 0;

  constructor() {
    this.tableSteps = [
      {
        table: 'inits',
        merge: dp => {
          for (const init of dp.inits) {
            this._inits.set(init.id, init);
            this._initSourceModNames.set(init.id, this.currentPackModName);
          }
        },
        clear: () => { this._inits.clear(); this._initSourceModNames.clear(); },
      },
      {
        table: 'areas',
        merge: dp => {
          for (const area of dp.areas) {
            this._areas.set(area.id, area);
            this._areaSourceModNames.set(area.id, this.currentPackModName);
            if (!this._areasByInit.has(area.initId)) {
              this._areasByInit.set(area.initId, []);
            }
            this._areasByInit.get(area.initId)!.push(area.id);
          }
        },
        clear: () => { this._areas.clear(); this._areaSourceModNames.clear(); this._areasByInit.clear(); },
      },
      {
        table: 'spots',
        merge: dp => {
          for (const spot of dp.spots) {
            const previous = this._spots.get(spot.id);
            if (previous) {
              this.removeSpotFromIndexes(previous, this._spotSourceModNames.get(spot.id) ?? this.currentPackModName);
            }
            this._suspendedSpots.delete(spot.id);
            this._spots.set(spot.id, spot);
            this._spotSourceModNames.set(spot.id, this.currentPackModName);
            this._spotTagModNames.set(spot.id, this.currentPackModName);
            // 层级标签索引：把每个声明标签的所有前缀都登记（父含子）
            this.addSpotToIndexes(spot, this.currentPackModName);
          }
        },
        clear: () => {
          this._spots.clear();
          this._suspendedSpots.clear();
          this._spotSourceModNames.clear();
          this._spotsByArea.clear();
          this._spotsByTag.clear();
          this._spotTagModNames.clear();
          this._spotMutationRevision = 0;
        },
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
        table: 'favoriteItems',
        merge: dp => {
          if (dp.favoriteItems) for (const f of dp.favoriteItems) this._favoriteItems.set(f.id, f);
        },
        clear: () => this._favoriteItems.clear(),
      },
      {
        table: 'uniqueWeapons',
        merge: dp => {
          if (dp.uniqueWeapons) for (const w of dp.uniqueWeapons) this._uniqueWeapons.set(w.id, w);
        },
        clear: () => this._uniqueWeapons.clear(),
      },
      {
        table: 'traits',
        merge: dp => {
          if (dp.traits) for (const t of dp.traits) this._traits.set(t.id, t);
        },
        clear: () => this._traits.clear(),
      },
      {
        table: 'gears',
        merge: dp => {
          if (dp.gears) for (const g of dp.gears) this._gears.set(g.id, g);
        },
        clear: () => this._gears.clear(),
      },
      {
        table: 'gearConfig',
        merge: dp => {
          if (!dp.gearConfig) return;
          this._gearConfig = { ...this._gearConfig, ...dp.gearConfig };
        },
        clear: () => { this._gearConfig = undefined; },
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
        table: 'shops',
        merge: dp => { for (const shop of dp.shops ?? []) this._shops.set(shop.id, shop); },
        clear: () => this._shops.clear(),
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
  /** 当前 Init / Area 定义的来源 Mod；不存在时返回 undefined。 */
  initOwnerOf(initId: string): string | undefined { return this._initSourceModNames.get(initId); }
  areaOwnerOf(areaId: string): string | undefined { return this._areaSourceModNames.get(areaId); }
  /** 当前 Spot 的来源 Mod；不存在时返回 undefined。 */
  spotOwnerOf(spotId: string): string | undefined { return this._spotSourceModNames.get(spotId); }
  /** 当前解析结果之外仍保留的 Spot source record（仅供编辑/撤回协调层读取）。 */
  spotIncludingSuspended(spotId: string): SpotDef | undefined {
    return this._spots.get(spotId) ?? this._suspendedSpots.get(spotId)?.spot;
  }
  /** 当前 Spot 是否被 Registry 的 blocking record 挂起。 */
  isSpotSuspended(spotId: string): boolean { return this._suspendedSpots.has(spotId); }

  /**
   * 对单个 Spot 执行受控局部变更，并返回可回滚 receipt。
   * 校验在任何索引或主表写入前完成；本方法不触碰其他 Definition 或 Runtime 子系统。
   */
  applySpotMutation(mutation: RegistrySpotMutation): RegistrySpotMutationReceipt {
    const ownerModName = mutation.ownerModName;
    this.validateSpotOwner(ownerModName);

    const spotId = mutation.operation === 'delete' || mutation.operation === 'suspend' || mutation.operation === 'resume'
      ? mutation.spotId
      : mutation.spot.id;
    this.validateSpotId(spotId, ownerModName);
    const previousSpot = this._spots.get(spotId);
    const previousSuspended = this._suspendedSpots.get(spotId);
    const previousSourceSpot = previousSpot ?? previousSuspended?.spot;
    const previousOwner = this._spotSourceModNames.get(spotId) ?? previousSuspended?.ownerModName;

    if (mutation.operation === 'create') {
      if (previousSpot || previousSuspended) {
        throw new RegistryError(`Spot "${spotId}" 已存在；局部变更应使用 replace`);
      }
      this.validateSpotCandidate(mutation.spot, ownerModName);
    } else {
      if (!previousSourceSpot) {
        throw new RegistryError(`Spot "${spotId}" 不存在`);
      }
      if (previousOwner !== ownerModName) {
        throw new RegistryError(`Spot "${spotId}" 属于 Mod "${previousOwner ?? 'unknown'}"，不能由 Mod "${ownerModName}" 修改`);
      }
      if (mutation.operation === 'replace') {
        if (previousSuspended) throw new RegistryError(`Spot "${spotId}" 当前已挂起；请先 resume 后再 replace`);
        this.validateSpotCandidate(mutation.spot, ownerModName);
        if (mutation.spot.id !== spotId) {
          throw new RegistryError(`replace 的 Spot id 必须保持为 "${spotId}"`);
        }
      }
    }

    const previousAreaIndex = previousSpot ? this.removeSpotFromIndexes(previousSpot, previousOwner ?? ownerModName) : -1;
    if (mutation.operation === 'delete') {
      this._spots.delete(spotId);
      this._suspendedSpots.delete(spotId);
      this._spotSourceModNames.delete(spotId);
      this._spotTagModNames.delete(spotId);
      this._tagOwnerModNames.delete(spotId);
    } else if (mutation.operation === 'suspend') {
      if (previousSuspended) throw new RegistryError(`Spot "${spotId}" 已经处于挂起状态`);
      this._spots.delete(spotId);
      this._suspendedSpots.set(spotId, { spot: previousSourceSpot!, ownerModName });
    } else if (mutation.operation === 'resume') {
      if (!previousSuspended) throw new RegistryError(`Spot "${spotId}" 当前未挂起`);
      this._suspendedSpots.delete(spotId);
      this._spots.set(spotId, previousSuspended.spot);
      this.addSpotToIndexes(previousSuspended.spot, ownerModName);
    } else {
      this._spots.set(spotId, mutation.spot);
      this._spotSourceModNames.set(spotId, ownerModName);
      this._spotTagModNames.set(spotId, ownerModName);
      this._tagOwnerModNames.set(spotId, ownerModName);
      this.addSpotToIndexes(mutation.spot, ownerModName, mutation.operation === 'replace' && mutation.spot.areaId === previousSpot?.areaId ? previousAreaIndex : undefined);
    }

    const mutationRevision = ++this._spotMutationRevision;
    let rolledBack = false;
    return {
      operation: mutation.operation,
      ownerModName,
      spotId,
      previousSpot: previousSourceSpot,
      currentSpot: mutation.operation === 'delete' || mutation.operation === 'suspend'
        ? undefined
        : mutation.operation === 'resume' ? previousSuspended?.spot : mutation.spot,
      rollback: () => {
        if (rolledBack) return;
        if (this._spotMutationRevision !== mutationRevision) {
          throw new RegistryError(`Spot "${spotId}" 在 receipt 创建后已再次变更，不能安全回滚`);
        }
        const currentSpot = this._spots.get(spotId);
        const currentSuspended = this._suspendedSpots.get(spotId);
        const currentOwner = this._spotSourceModNames.get(spotId);
        const expectedCurrent = mutation.operation === 'delete'
          ? undefined
          : mutation.operation === 'suspend' ? undefined
          : mutation.operation === 'resume' ? previousSuspended?.spot : mutation.spot;
        const expectedSuspended = mutation.operation === 'suspend' ? previousSourceSpot : undefined;
        if (currentSpot !== expectedCurrent || currentSuspended?.spot !== expectedSuspended || ((expectedCurrent || expectedSuspended) && currentOwner !== ownerModName)) {
          throw new RegistryError(`Spot "${spotId}" 当前状态与 receipt 不一致，不能安全回滚`);
        }

        if (currentSpot) {
          this.removeSpotFromIndexes(currentSpot, currentOwner ?? ownerModName);
          this._spots.delete(spotId);
        }
        this._suspendedSpots.delete(spotId);
        if (previousSourceSpot) {
          if (previousSuspended) {
            this._suspendedSpots.set(spotId, { spot: previousSourceSpot, ownerModName: previousOwner ?? 'base' });
          } else {
            this._spots.set(spotId, previousSourceSpot);
            this.addSpotToIndexes(previousSourceSpot, previousOwner ?? 'base', previousAreaIndex >= 0 ? previousAreaIndex : undefined);
          }
          this._spotSourceModNames.set(spotId, previousOwner ?? 'base');
          this._spotTagModNames.set(spotId, previousOwner ?? 'base');
          this._tagOwnerModNames.set(spotId, previousOwner ?? 'base');
        } else {
          this._spots.delete(spotId);
          this._spotSourceModNames.delete(spotId);
          this._spotTagModNames.delete(spotId);
          this._tagOwnerModNames.delete(spotId);
        }
        this._spotMutationRevision++;
        rolledBack = true;
      },
    };
  }

  /**
   * 对 Init 执行局部热 CRUD。归属由实体 ID 的 mod 段和 ownerModName 双重约束，
   * 因而基础包 / 其他 Mod 的定义不能被 Runtime Editor 越权覆盖。
   */
  applyInitMutation(mutation: RegistryInitMutation): RegistryInitMutationReceipt {
    const initId = mutation.operation === 'delete' ? mutation.initId : mutation.init.id;
    this.validateWorldId(initId, 'init', mutation.ownerModName, 'Init');
    const previousInit = this._inits.get(initId);
    const previousOwner = this._initSourceModNames.get(initId);

    if (previousInit && previousOwner !== undefined && previousOwner !== mutation.ownerModName) {
      throw new RegistryError(`Init "${initId}" 属于 Mod "${previousOwner}"，不能由 Mod "${mutation.ownerModName}" 修改`);
    }

    if (mutation.operation === 'create') {
      if (previousInit) throw new RegistryError(`Init "${initId}" 已存在；局部变更应使用 replace`);
      this.validateInitCandidate(mutation.init, mutation.ownerModName);
      this._inits.set(initId, mutation.init);
      this._initSourceModNames.set(initId, mutation.ownerModName);
    } else if (mutation.operation === 'replace') {
      if (!previousInit) throw new RegistryError(`Init "${initId}" 不存在`);
      this.validateInitCandidate(mutation.init, mutation.ownerModName);
      this._inits.set(initId, mutation.init);
      this._initSourceModNames.set(initId, mutation.ownerModName);
    } else {
      if (!previousInit) throw new RegistryError(`Init "${initId}" 不存在`);
      const areas = [...this._areas.values()].filter(area => area.initId === initId);
      if (areas.length > 0) {
        throw new RegistryError(`Init "${initId}" 仍被 Area 引用：${areas.map(area => area.id).join('、')}`);
      }
      this._inits.delete(initId);
      this._initSourceModNames.delete(initId);
    }

    let rolledBack = false;
    const currentInit = mutation.operation === 'delete' ? undefined : mutation.init;
    return {
      operation: mutation.operation,
      ownerModName: mutation.ownerModName,
      initId,
      previousInit,
      currentInit,
      rollback: () => {
        if (rolledBack) return;
        const current = this._inits.get(initId);
        const expected = currentInit;
        if (current !== expected) {
          throw new RegistryError(`Init "${initId}" 当前状态与 receipt 不一致，不能安全回滚`);
        }
        if (previousInit) this._inits.set(initId, previousInit);
        else this._inits.delete(initId);
        if (previousInit && previousOwner !== undefined) this._initSourceModNames.set(initId, previousOwner);
        else this._initSourceModNames.delete(initId);
        rolledBack = true;
      },
    };
  }

  /**
   * 对 Area 执行局部热 CRUD，并同步 `_areasByInit`。Area 的 initId 在 replace 中保持不变，
   * 避免单条热编辑隐式改变世界线归属和 per-Init 状态边界。
   */
  applyAreaMutation(mutation: RegistryAreaMutation): RegistryAreaMutationReceipt {
    const areaId = mutation.operation === 'delete' ? mutation.areaId : mutation.area.id;
    this.validateWorldId(areaId, 'area', mutation.ownerModName, 'Area');
    const previousArea = this._areas.get(areaId);
    const previousOwner = this._areaSourceModNames.get(areaId);
    let previousAreaIndex = -1;

    if (previousArea && previousOwner !== undefined && previousOwner !== mutation.ownerModName) {
      throw new RegistryError(`Area "${areaId}" 属于 Mod "${previousOwner}"，不能由 Mod "${mutation.ownerModName}" 修改`);
    }

    if (mutation.operation === 'create') {
      if (previousArea) throw new RegistryError(`Area "${areaId}" 已存在；局部变更应使用 replace`);
      this.validateAreaCandidate(mutation.area, mutation.ownerModName);
      this._areas.set(areaId, mutation.area);
      this.addAreaToIndex(mutation.area);
      this._areaSourceModNames.set(areaId, mutation.ownerModName);
    } else if (mutation.operation === 'replace') {
      if (!previousArea) throw new RegistryError(`Area "${areaId}" 不存在`);
      if (previousArea.initId !== mutation.area.initId) {
        throw new RegistryError(`Area "${areaId}" 的所属 Init 不能在热 CRUD 中变更`);
      }
      this.validateAreaCandidate(mutation.area, mutation.ownerModName);
      const index = this.removeAreaFromIndex(previousArea);
      previousAreaIndex = index;
      this._areas.set(areaId, mutation.area);
      this.addAreaToIndex(mutation.area, index);
      this._areaSourceModNames.set(areaId, mutation.ownerModName);
    } else {
      if (!previousArea) throw new RegistryError(`Area "${areaId}" 不存在`);
      const spots = this.spotsOfArea(areaId);
      if (spots.length > 0) throw new RegistryError(`Area "${areaId}" 仍被 Spot 引用：${spots.join('、')}`);
      const defaultAreas = [...this._inits.values()].filter(init => init.defaultAreas.includes(areaId));
      if (defaultAreas.length > 0) {
        throw new RegistryError(`Area "${areaId}" 仍是 Init 默认区域：${defaultAreas.map(init => init.id).join('、')}`);
      }
      const adjacentAreas = [...this._areas.values()].filter(area => area.id !== areaId && area.adjacentAreaIds?.includes(areaId));
      if (adjacentAreas.length > 0) {
        throw new RegistryError(`Area "${areaId}" 仍被邻接关系引用：${adjacentAreas.map(area => area.id).join('、')}`);
      }
      previousAreaIndex = this.removeAreaFromIndex(previousArea);
      this._areas.delete(areaId);
      this._areaSourceModNames.delete(areaId);
    }

    let rolledBack = false;
    const currentArea = mutation.operation === 'delete' ? undefined : mutation.area;
    return {
      operation: mutation.operation,
      ownerModName: mutation.ownerModName,
      areaId,
      previousArea,
      currentArea,
      rollback: () => {
        if (rolledBack) return;
        const current = this._areas.get(areaId);
        if (current !== currentArea) {
          throw new RegistryError(`Area "${areaId}" 当前状态与 receipt 不一致，不能安全回滚`);
        }
        if (current) this.removeAreaFromIndex(current);
        this._areas.delete(areaId);
        if (previousArea) {
          this._areas.set(areaId, previousArea);
          this.addAreaToIndex(previousArea, previousAreaIndex >= 0 ? previousAreaIndex : undefined);
          if (previousOwner !== undefined) this._areaSourceModNames.set(areaId, previousOwner);
        } else {
          this._areaSourceModNames.delete(areaId);
        }
        rolledBack = true;
      },
    };
  }
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
  /** 角色差分表（VariantId → Def）。 */
  get characterVariants(): ReadonlyMap<string, CharacterVariantDef> { return this._characterVariants; }
  /** 培养曲线表。 */
  get cultivateCurves(): ReadonlyMap<string, CultivateCurveDef> { return this._cultivateCurves; }
  /** 爱用品表。 */
  get favoriteItems(): ReadonlyMap<string, FavoriteItemDef> { return this._favoriteItems; }
  /** 专武表。 */
  get uniqueWeapons(): ReadonlyMap<string, UniqueWeaponDef> { return this._uniqueWeapons; }
  /** 特性表。 */
  get traits(): ReadonlyMap<string, TraitDef> { return this._traits; }
  /** 装备类型线表（GearId → Def）。 */
  get gears(): ReadonlyMap<string, GearDef> { return this._gears; }
  /** 装备成长全局配置（数据包声明；未声明返回 undefined）。 */
  get gearConfig(): GearConfigDef | undefined { return this._gearConfig; }
  /** 卡池表（PoolId → Def）。 */
  get gachaPools(): ReadonlyMap<string, GachaPoolDef> { return this._gachaPools; }
  get shops(): ReadonlyMap<string, ShopDef> { return this._shops; }
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
    const checkPresentationThemes = (id: string, presentation: EntityPresentationDef | undefined, label: string): void => {
      if (!presentation) return;
      const themes = [
        { source: 'default', theme: presentation.default.theme },
        ...(presentation.additions ?? []).map(option => ({ source: `option:${option.id}`, theme: option.override.theme })),
      ];
      for (const { source, theme } of themes) {
        if (theme?.colorGroupId && !this._colorGroups.has(theme.colorGroupId)) {
          throw new RegistryError(`${label} ${id} 的 presentation ${source} 引用了未定义的颜色组 "${theme.colorGroupId}"`);
        }
      }
    };
    for (const init of this._inits.values()) checkPresentationThemes(init.id, init.presentation, 'Init');
    for (const area of this._areas.values()) checkPresentationThemes(area.id, area.presentation, 'Area');
    for (const spot of this._spots.values()) checkPresentationThemes(spot.id, spot.presentation, 'Spot');
    for (const enhancement of this._enhancements.values()) checkPresentationThemes(enhancement.id, enhancement.presentation, 'Enhancement');
    for (const variant of this._characterVariants.values()) checkPresentationThemes(variant.id, variant.presentation, 'CharacterVariant');
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
    for (const v of this._characterVariants.values()) {
      const p = v.progression;
      if (p?.favoriteItem && !this._favoriteItems.has(p.favoriteItem)) {
        throw new RegistryError(`差分 ${v.id} 引用了未定义的爱用品 "${p.favoriteItem}"`);
      }
      if (p?.uniqueWeapon && !this._uniqueWeapons.has(p.uniqueWeapon)) {
        throw new RegistryError(`差分 ${v.id} 引用了未定义的专武 "${p.uniqueWeapon}"`);
      }
      for (const t of p?.initialTraits ?? []) {
        if (!this._traits.has(t)) throw new RegistryError(`差分 ${v.id} 引用了未定义的特性 "${t}"`);
      }
      for (const slot of p?.gearSlots ?? []) {
        if (!this._gears.has(slot.gear)) {
          throw new RegistryError(`差分 ${v.id} 的装备槽引用了未定义的装备 "${slot.gear}"`);
        }
      }
    }
    for (const gear of this._gears.values()) {
      const tiers = new Set<number>();
      for (const tier of gear.tiers) {
        if (tiers.has(tier.tier)) throw new RegistryError(`装备 ${gear.id} 含重复层级 "${tier.tier}"`);
        tiers.add(tier.tier);
        for (const cost of tier.upgradeCost ?? []) {
          if (!this._items.has(cost.itemId)) {
            throw new RegistryError(`装备 ${gear.id} 的层级 ${tier.tier} 引用了未定义的物品 "${cost.itemId}"`);
          }
        }
      }
    }
    for (const material of this._gearConfig?.expItems ?? []) {
      if (!this._items.has(material.itemId)) {
        throw new RegistryError(`gearConfig 引用了未定义的经验材料 "${material.itemId}"`);
      }
    }
  }
  /** 资源条显示条目（数据包声明，驱动 UI 资源条渲染）。 */
  get resourceDisplays(): ReadonlyMap<string, ResourceDisplayDef> { return this._resourceDisplays; }

  /** Spot 审计时间查询；缺失时间只在查询结果中按极早值表达，不改写 Def。 */
  getEffectiveSpotMetadata(spotId: string): EffectiveDefMetadata {
    return effectiveDefMetadata(this._spots.get(spotId)?.metadata);
  }

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

  /** Shop / Spot 支付项 / Item / Spot Function 的跨包引用完整性。 */
  validateShopRefs(): void {
    for (const spot of this._spots.values()) {
      const checkPaymentOptions = (options: readonly PaymentOptionDef[], label: string): void => {
        const paymentOptionIds = new Set<string>();
        for (const option of options) {
          if (!option.id || paymentOptionIds.has(option.id)) {
            throw new RegistryError(`Spot ${spot.id} 的${label}支付方案 ID 重复或为空："${option.id}"`);
          }
          paymentOptionIds.add(option.id);
          for (const cost of option.costs) {
            if (cost.type === 'item' && !this._items.has(cost.itemId)) {
              throw new RegistryError(`Spot ${spot.id} 的支付方案 ${option.id} 引用了未定义的 Item "${cost.itemId}"`);
            }
          }
        }
      };
      checkPaymentOptions(spot.purchaseOptions, '购买');
      for (const upgrade of spot.levelUpgrades ?? []) checkPaymentOptions(upgrade.paymentOptions, `Lv.${upgrade.level} `);
      for (const functionality of spot.functionalities ?? []) {
        if (functionality.kind === 'shop' && (!functionality.shopId || !this._shops.has(functionality.shopId))) {
          throw new RegistryError(`Spot ${spot.id} 的 shop Function ${functionality.id} 引用了未定义的 Shop "${functionality.shopId ?? ''}"`);
        }
      }
    }
    for (const shop of this._shops.values()) {
      const sections = new Set<string>();
      for (const section of shop.sections ?? []) {
        if (sections.has(section.id)) throw new RegistryError(`Shop ${shop.id} 含重复 Section id "${section.id}"`);
        sections.add(section.id);
      }
      const entries = new Set<string>();
      for (const entry of shop.entries) {
        if (entries.has(entry.id)) throw new RegistryError(`Shop ${shop.id} 含重复 Entry id "${entry.id}"`);
        entries.add(entry.id);
        if (entry.sectionId && !sections.has(entry.sectionId)) throw new RegistryError(`Shop ${shop.id} 的 Entry ${entry.id} 引用了未定义的 Section "${entry.sectionId}"`);
        const itemRefs = [
          ...(entry.offer.type === 'item' ? [entry.offer.itemId] : []),
          ...entry.price.unitCosts.filter(cost => cost.type === 'item').map(cost => cost.itemId),
        ];
        for (const itemId of itemRefs) if (!this._items.has(itemId)) throw new RegistryError(`Shop ${shop.id} 的 Entry ${entry.id} 引用了未定义的 Item "${itemId}"`);
      }
    }
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
  areasOfInit(initId: string): string[] { return [...(this._areasByInit.get(initId) ?? [])]; }
  /** 查询 Area 下的所有 Spot ID */
  spotsOfArea(areaId: string): string[] { return [...(this._spotsByArea.get(areaId) ?? [])]; }
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

  private validateWorldId(id: string, expectedType: 'init' | 'area', ownerModName: string, label: string): void {
    if (!/^[a-z0-9-]+$/.test(ownerModName)) {
      throw new RegistryError(`${label} owner Mod "${ownerModName}" 格式无效`);
    }
    const parts = parseEntityId(id);
    if (!parts || parts.type !== expectedType) {
      throw new RegistryError(`${label} id "${id}" 不符合 mod:${expectedType}:id 格式`);
    }
    if (parts.mod !== ownerModName) {
      throw new RegistryError(`${label} id "${id}" 不属于 Mod "${ownerModName}"`);
    }
  }

  private validateInitCandidate(init: InitDef, ownerModName: string): void {
    this.validateWorldId(init.id, 'init', ownerModName, 'Init');
    const startStoryEntry = init.startStoryId ? this._activeStories.get(init.startStoryId) : undefined;
    if (init.startStoryId && !this._stories.has(init.startStoryId) && !startStoryEntry?.storyId) {
      throw new RegistryError(`Init "${init.id}" references unknown start story: "${init.startStoryId}"`);
    }
    validateDatapack({
      modName: ownerModName,
      name: 'runtime-init-mutation',
      version: '0',
      inits: [{ ...init, defaultAreas: [] }],
      areas: [],
      spots: [],
      enhancements: [],
      activeStories: [],
      passiveStories: [],
      stories: [],
      items: [],
      funcletDefs: [],
      characters: [],
    });
    for (const areaId of init.defaultAreas) {
      const area = this._areas.get(areaId);
      if (!area) throw new RegistryError(`Init "${init.id}" references unknown default area: "${areaId}"`);
      if (area.initId !== init.id) {
        throw new RegistryError(`Init "${init.id}" 的默认区域 "${areaId}" 不属于该 Init`);
      }
    }
  }

  private validateAreaCandidate(area: AreaDef, ownerModName: string): void {
    this.validateWorldId(area.id, 'area', ownerModName, 'Area');
    validateDatapack({
      modName: ownerModName,
      name: 'runtime-area-mutation',
      version: '0',
      inits: [],
      areas: [{ ...area, defaultSpots: [], adjacentAreaIds: [] }],
      spots: [],
      enhancements: [],
      activeStories: [],
      passiveStories: [],
      stories: [],
      items: [],
      funcletDefs: [],
      characters: [],
    }, { initIds: new Set(this._inits.keys()) });
    const init = this._inits.get(area.initId);
    if (!init) throw new RegistryError(`Area "${area.id}" references unknown init: "${area.initId}"`);
    for (const spotId of area.defaultSpots) {
      const spot = this._spots.get(spotId);
      if (!spot) throw new RegistryError(`Area "${area.id}" references unknown default spot: "${spotId}"`);
      if (spot.areaId !== area.id) throw new RegistryError(`Area "${area.id}" 的默认 Spot "${spotId}" 不属于该 Area`);
    }
    for (const adjacentId of area.adjacentAreaIds ?? []) {
      if (adjacentId === area.id) throw new RegistryError(`Area "${area.id}" 不能与自身相邻`);
      const adjacent = this._areas.get(adjacentId);
      if (!adjacent) throw new RegistryError(`Area "${area.id}" references unknown adjacent area: "${adjacentId}"`);
      if (adjacent.initId !== area.initId) throw new RegistryError(`Area "${area.id}" 的邻接区域必须属于同一 Init`);
    }
    void init;
  }

  private addAreaToIndex(area: AreaDef, index?: number): void {
    const areaIds = this._areasByInit.get(area.initId);
    if (!areaIds) {
      this._areasByInit.set(area.initId, [area.id]);
      return;
    }
    if (index === undefined || index < 0 || index >= areaIds.length) areaIds.push(area.id);
    else areaIds.splice(index, 0, area.id);
  }

  private removeAreaFromIndex(area: AreaDef): number {
    const areaIds = this._areasByInit.get(area.initId);
    if (!areaIds) return -1;
    const index = areaIds.indexOf(area.id);
    const remaining = areaIds.filter(id => id !== area.id);
    if (remaining.length === 0) this._areasByInit.delete(area.initId);
    else this._areasByInit.set(area.initId, remaining);
    return index;
  }

  private validateSpotOwner(ownerModName: string): void {
    if (!/^[a-z0-9-]+$/.test(ownerModName)) {
      throw new RegistryError(`Spot owner Mod "${ownerModName}" 格式无效`);
    }
  }

  private validateSpotId(spotId: string, ownerModName: string): void {
    const parts = parseEntityId(spotId);
    if (!parts || parts.type !== 'spot') {
      throw new RegistryError(`Spot id "${spotId}" 不符合 mod:spot:id 格式`);
    }
    if (parts.mod !== ownerModName) {
      throw new RegistryError(`Spot id "${spotId}" 不属于 Mod "${ownerModName}"`);
    }
  }

  private validateSpotCandidate(spot: SpotDef, ownerModName: string): void {
    this.validateSpotId(spot.id, ownerModName);
    if (!this._areas.has(spot.areaId)) {
      throw new RegistryError(`Spot "${spot.id}" references unknown area: "${spot.areaId}"`);
    }
    validateDatapack({
      modName: ownerModName,
      name: 'runtime-spot-mutation',
      version: '0',
      inits: [],
      areas: [],
      spots: [spot],
      enhancements: [],
      activeStories: [],
      passiveStories: [],
      stories: [],
      items: [],
      funcletDefs: [],
      characters: [],
    }, {
      initIds: new Set(this._inits.keys()),
      areaIds: new Set(this._areas.keys()),
    });
  }

  /** 登记某 Spot 的某 Tag 的所有前缀（父含子）——数据包加载时建立声明索引用。 */
  private indexSpotTag(spotId: string, tag: TagPath, defaultModName = this._spotTagModNames.get(spotId) ?? this.currentPackModName): void {
    for (const key of this.tagAncestorKeys(tag, defaultModName)) {
      if (!this._spotsByTag.has(key)) this._spotsByTag.set(key, new Set());
      this._spotsByTag.get(key)!.add(spotId);
    }
  }

  private addSpotToIndexes(spot: SpotDef, ownerModName: string, areaIndex?: number): void {
    const spotIds = this._spotsByArea.get(spot.areaId);
    if (!spotIds) {
      this._spotsByArea.set(spot.areaId, [spot.id]);
    } else if (areaIndex === undefined || areaIndex < 0 || areaIndex >= spotIds.length) {
      spotIds.push(spot.id);
    } else {
      spotIds.splice(areaIndex, 0, spot.id);
    }
    for (const tag of spot.tags ?? []) this.indexSpotTag(spot.id, tag, ownerModName);
  }

  private removeSpotFromIndexes(spot: SpotDef, ownerModName: string): number {
    const spotIds = this._spotsByArea.get(spot.areaId);
    let areaIndex = -1;
    if (spotIds) {
      areaIndex = spotIds.indexOf(spot.id);
      const remaining = spotIds.filter(id => id !== spot.id);
      if (remaining.length === 0) this._spotsByArea.delete(spot.areaId);
      else this._spotsByArea.set(spot.areaId, remaining);
    }

    for (const tag of spot.tags ?? []) {
      for (const key of this.tagAncestorKeys(tag, ownerModName)) {
        const spotSet = this._spotsByTag.get(key);
        if (!spotSet) continue;
        spotSet.delete(spot.id);
        if (spotSet.size === 0) this._spotsByTag.delete(key);
      }
    }
    return areaIndex;
  }

  private rebuildSpotTagIndex(): void {
    this._spotsByTag.clear();
    for (const spot of this._spots.values()) {
      for (const tag of spot.tags ?? []) this.indexSpotTag(spot.id, tag);
    }
  }


  /** 加载并验证数据包 */
  load(datapack: Datapack): void {
    validateDatapack(datapack, { initIds: new Set(this._inits.keys()), areaIds: new Set(this._areas.keys()) });
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

  /** 使用当前注册表的已知 Init / Area 校验一个待合并数据包，不改变注册表。 */
  validate(datapack: Datapack): void {
    validateDatapack(datapack, { initIds: new Set(this._inits.keys()), areaIds: new Set(this._areas.keys()) });
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
