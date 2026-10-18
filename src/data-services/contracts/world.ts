// ============================================================
// data-services/contracts/world.ts — 世界数据包声明
// ============================================================

import type { TagPath } from '../../engine/core/tag';
import type { AreaId, InitId, SpotId, StoryId } from '../../engine/types/ids';
import type { ConditionGroup, Effect, ValueExpression } from '../../engine/types/expression';
import type { ColorGroupId, GachaPoolId } from '../../engine/types/character';
import type { ThemeDef } from '../../engine/types/theme';
import type { ResourceAmount } from '../../engine/contracts/resource';
import type { RevealTrigger } from '../../engine/types/reveal';
import type { TriggerDef } from '../../engine/types/trigger';
import type { ExtraCompound } from '../../engine/types/extra';
import type { ShopId } from './shop';
import type { PaymentOptionDef } from './cost';
import type { DefMetadata } from './common';
import type { EntityPresentationDef } from './entity-presentation';

export interface EntryEffectDef {
  first?: boolean;
  condition?: ConditionGroup;
  effects: Effect[];
}

export interface InitDef {
  /** @label ID */
  id: InitId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  enterEffects?: EntryEffectDef[];
  /** @label 默认区域 */
  defaultAreas: AreaId[];
  /** @label 起始剧情 */
  startStoryId?: StoryId;
  triggers?: TriggerDef[];
  revealTriggers?: RevealTrigger[];
  /** @label 购买费用 */
  purchaseCost?: ResourceAmount[];
  /** @label 世界倾斜数值 */
  worldTilt?: string;
  /** @label 倾斜值展示别名 */
  worldTiltAlias?: string;
  /** @label 选择页主题 */
  theme?: ThemeDef;
  /** @label 实体表现内容 */
  presentation?: EntityPresentationDef;
  /** @label 标签 */
  tags?: TagPath[];
  extra?: ExtraCompound;
}

export type InitPurchaseError = 'NotFound' | 'AlreadyUnlocked' | 'InsufficientResource';

export type InitPurchaseResult =
  | { success: true; initId: InitId }
  | { success: false; initId: InitId; error: InitPurchaseError };

export interface AreaDef {
  /** @label ID */
  id: AreaId;
  /** @label 所属世界线 */
  initId: InitId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  /** @label 默认设施 */
  defaultSpots: SpotId[];
  enterEffects?: EntryEffectDef[];
  /** @label 相邻区域 */
  adjacentAreaIds?: AreaId[];
  revealTriggers?: RevealTrigger[];
  /** @label 标签 */
  tags?: TagPath[];
  theme?: ThemeDef;
  /** @label 实体表现内容 */
  presentation?: EntityPresentationDef;
  extra?: ExtraCompound;
}

export interface SpotDef {
  /** @label ID */
  id: SpotId;
  /** 创建 / 修改时间；历史内容可缺省，由 Registry 查询层按极早值处理。 */
  metadata?: DefMetadata;
  /** @label 所属区域 */
  areaId: AreaId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  /** Spot 解锁支付方案；多个方案之间为 OR，同一方案的 costs 为 AND。 */
  purchaseOptions: PaymentOptionDef[];
  /** @label 条件文本 */
  conditionText?: string;
  levelUpgrades?: LevelUpgradeDef[];
  /** @label 等级上限 */
  maxLevel?: number;
  /** @label 标签 */
  tags: TagPath[];
  /** @label 跨世界线共享 */
  global?: boolean;
  revealTriggers?: RevealTrigger[];
  functionalities?: SpotFunctionalityDef[];
  gachaPools?: GachaPoolId[];
  /** @label 设施主题 */
  theme?: ThemeDef;
  /** @label 实体表现内容 */
  presentation?: EntityPresentationDef;
  /** @label 默认色组 @ref colorGroups */
  colorGroupId?: ColorGroupId;
  extra?: ExtraCompound;
}

export interface SpotFunctionalityDef {
  id: string;
  /** 默认 true；为 false 时可在未持有 Spot 时纳入可用功能列表。 */
  requiresOwned?: boolean;
  condition?: ConditionGroup;
  /** operationEntry 指向旧 Operation Event；mapEntry 单独指向新 Map。 */
  kind: 'flow' | 'linearYield' | 'restartInit' | 'hardResetInit' | 'gacha' | 'shop' | 'operationEntry' | 'mapEntry';
  /** @ref shops */
  shopId?: ShopId;
  /** operationEntry 的目标关卡；阵容、标题与准入状态由行动入口查询提供。 @ref operationEvents */
  operationEventId?: string;
  /** mapEntry 的目标地图。 @ref maps */
  mapId?: string;
  /**
   * mapEntry 的入口按钮文案，作者可直接写成“进入 XXX”；缺省时使用内置
   * “开始地图 / 继续地图”。只影响按钮文字，不改变入口校验或状态。
   */
  mapEntryLabel?: string;
  resource?: string;
  amount?: number | ValueExpression;
  amountPerLevel?: number;
  /** 可选起算等级；0 表示 Lv.1 即按等级计入，1 表示从 Lv.2 开始增加。 */
  startLevel?: number;
  extra?: ExtraCompound;
}

export interface LevelUpgradeDef {
  level: number;
  /** 该等级的支付方案；多个方案之间为 OR，同一方案的 costs 为 AND。 */
  paymentOptions: PaymentOptionDef[];
  condition?: ConditionGroup;
  effects: Effect[];
}
