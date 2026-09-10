// ============================================================
// data-services/contracts/datapack.ts — Datapack 汇总类型
// ============================================================

import type { FuncletDef } from '../../engine/types/expression';
import type { CharacterData } from './character-data';
import type { CharacterVariantDef } from './character-variant';
import type { CultivateCurveDef } from './cultivate-curve';
import type { AffectionConfigDef } from './affection-config';
import type { DropTableDef } from './drop-table';
import type { ItemDef } from './item';
import type { EnhancementDef } from './enhancement';
import type { PassivePoolDef } from './passive-pool';
import type { StoryDef } from './story';
import type { ActiveStoryEntry, PassiveStoryEntry } from './story-entry';
import type {
  CharacterBonusTable,
  ResourceDisplayDef,
  TagDef,
} from './common';
import type {
  AffectorPackDef,
  TriggerDef,
} from '../../engine/types/trigger';
import type {
  AreaDef,
  InitDef,
  SpotDef,
} from './world';
import type {
  ColorEquipmentDef,
  ColorGroupDef,
  ThemeDesignDef,
} from './color';
import type { ExtraValue } from '../../engine/types/extra';
import type { PicDef } from './pic';
import type { CharaProfileDef } from './chara-profile';
import type { CharacterPersistConfig } from './character-persist';
import type { GachaPoolDef } from './gacha-pool';
import type { ShopDef } from './shop';

// --- Datapack 汇总 ---

export interface Datapack {
  /** manifest 提供的 Tag 默认命名空间；内置/测试包缺省为 base。 */
  modName?: string;
  name: string;
  version: string;
  inits: InitDef[];
  areas: AreaDef[];
  spots: SpotDef[];
  enhancements: EnhancementDef[];
  /** 主线 / 支线 / 羁绊剧情入口。 */
  activeStories: ActiveStoryEntry[];
  /** 随机闲聊入口：当无剧情进行时，按权重随机抽取。 */
  passiveStories: PassiveStoryEntry[];
  /**
   * 被动闲聊池（可选）：树状抽选结构。未声明时全部 entry 进入引擎默认根池。
   */
  passivePools?: PassivePoolDef[];
  stories: StoryDef[];
  items: ItemDef[];
  dropTables?: DropTableDef[];
  affectorPacks?: AffectorPackDef[];
  triggerDefs?: TriggerDef[];
  funcletDefs: FuncletDef[];
  characters: CharacterData[];
  /**
   * @deprecated 冻结：Character 重构后不再参与任何计算（见 docs-818/12-character-rework.md §4.4）。
   * 加载期忽略并 devLog 警告；字段将在 M7 冻结回归时移除。
   */
  characterBonuses: CharacterBonusTable[];
  /**
   * 角色差分（变体）表
   * @label 角色差分
   */
  characterVariants?: CharacterVariantDef[];
  /**
   * 培养曲线表（缺省曲线由引擎默认提供）
   * @label 培养曲线
   */
  cultivateCurves?: CultivateCurveDef[];
  /**
   * 色彩组表（唯一色彩实体：重点色彩组 + 头像渲染方案 + theme-tree 预设）
   * @label 色彩组
   */
  colorGroups?: ColorGroupDef[];
  /**
   * 色彩装备表（收集品：色彩组 + 效用）
   * @label 色彩装备
   */
  colorEquipments?: ColorEquipmentDef[];
  /**
   * 实体配色设计表（Area / 学生差分的可解锁命名主题）
   * @label 配色设计
   */
  themeDesigns?: ThemeDesignDef[];
  /**
   * 卡池表
   * @label 卡池
   */
  gachaPools?: GachaPoolDef[];
  /** Spot 商店表 */
  shops?: ShopDef[];
  /**
   * 图片资产表：`mod:type(pic):id` 三段式索引 → URL / zip 包内图片
   * @label 图片
   */
  pics?: PicDef[];
  /**
   * Chara 头像-人名对声明表：chara 持有自己的 name 表 + avatar 表 + 当前使用 id
   * @label 角色资料
   */
  charaProfiles?: CharaProfileDef[];
  /**
   * Character 系统三层归属声明（缺省见各字段说明）
   * @label 归属配置
   * @collapsible
   */
  characterPersistConfig?: CharacterPersistConfig;
  /**
   * 好感数值配置（缺省 = 引擎内置蔚蓝档案阶梯，见 system/affection-system.ts）
   * @label 好感配置
   * @collapsible
   */
  affectionConfig?: AffectionConfigDef;
  /** 资源条显示条目（可选）：数据包自定义 UI 中展示的资源、标签与可选策略。 */
  resourceDisplays?: ResourceDisplayDef[];
  /** 标签表现定义（可选）：为层级 Tag 提供名称、简介等辅助表现，未定义的 Tag 回退路径串。 */
  tags?: TagDef[];
  /**
   * Extra 全局常量表（扁平键 → 节点值）：加载时展开为树并合并进 Registry.extras。
   * 键即 ExtraPath（如 'meta/author'）、/ 分隔、禁空段；与各 Def 的 extra 字段、
   * 运行时 PlayerState.extras 构成三层合并视图（见 docs/13 §5.3）。
   */
  extras?: Record<string, ExtraValue>;
}
