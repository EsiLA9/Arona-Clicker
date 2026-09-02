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
  extra?: ExtraCompound;
}

export interface SpotDef {
  /** @label ID */
  id: SpotId;
  /** @label 所属区域 */
  areaId: AreaId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  baseCost: ValueExpression;
  baseCostResource: string;
  baseYield: ValueExpression;
  baseYieldResource: string;
  /** @label 基础容量 */
  baseCapacity: number;
  managerBonusYield: ValueExpression;
  /** @label 条件文本 */
  conditionText?: string;
  levelUpgrades?: LevelUpgradeDef[];
  /** @label 每级产出 */
  yieldPerLevel?: number;
  /** @label 升级基价 */
  upgradeCostBase?: number;
  /** @label 升级增长 */
  upgradeCostGrowth?: number;
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
  /** @label 默认色组 @ref colorGroups */
  colorGroupId?: ColorGroupId;
  extra?: ExtraCompound;
}

export interface SpotFunctionalityDef {
  id: string;
  condition?: ConditionGroup;
  kind: 'linearYield' | 'restartInit' | 'hardResetInit' | 'gacha';
  resource?: string;
  amountPerLevel?: number;
  extra?: ExtraCompound;
}

export interface LevelUpgradeDef {
  level: number;
  cost?: ValueExpression;
  condition?: ConditionGroup;
  effects: Effect[];
}
