// ============================================================
// engine/types/expression.ts — 数值表达式 / 条件 / 效果 / Funclet
// ============================================================

import type { ExtraCompound, ExtraPath, ExtraValue } from './extra';
import type { FuncletId } from './ids';

// --- Value 系统 ---

export type ValueSource =
  | 'const'
  | 'res'
  | 'spotLevel'
  | 'spotCount'
  | 'managerCount'
  | 'funclet'
  /** 读 Extra 三层合并视图（全局 → per-Init → 数据包常量表），params.path = ExtraPath，数值语义同 toNumber（见 docs/13 §6.1）。 */
  | 'data';

export interface Value {
  type: 'value';
  source: ValueSource;
  params: Record<string, string | number>;
}

export const value = (source: ValueSource, params: Record<string, string | number> = {}): Value => ({
  type: 'value',
  source,
  params,
});

// --- ValueExpression (GameNum 连携) ---

export type ValueExpression =
  | { type: 'const'; value: number }
  | { type: 'value'; value: Value }
  | { type: 'mul'; left: ValueExpression; right: ValueExpression };

export const Expr = {
  const: (v: number): ValueExpression => ({ type: 'const', value: v }),
  val: (v: Value): ValueExpression => ({ type: 'value', value: v }),
  mul: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'mul', left, right }),
};

// --- Condition 系统 ---

export type Comparator = '==' | '!=' | '>=' | '<=' | '>' | '<';
export type ConditionTarget =
  | 'resource'
  | 'spotLevel'
  | 'manager'
  | 'flag'
  | 'hasEnh'
  /** 存在拥有指定 tag 的已拥有 Spot（value 语义同 flag：0=不存在，1=存在）。 */
  | 'hasTag'
  /** 拥有指定 tag 的已拥有 Spot 数量（层级 tag，含 child）。 */
  | 'countTags'
  /**
   * 按 tag 聚合的收集数（TagStatService，各类型统计独立）。
   * key = `<kind>:<tagDisplay>`，如 `spots:office` / `characters:school/millennium`；
   * actual = 该类型下已收集且声明命中该 tag（含祖先前缀）的实体数量。
   */
  | 'tagCount'
  /** 统计函数 DSL 求值（key 为 `$FunctionName 参数...`），返回数值与 value 比较。 */
  | 'stat'
  /** 是否完成过某个 Story（跨 Run，全局）。key = StoryId，0 或 1。 */
  | 'hasReadStory'
  /** 是否在当前 Run 完成过某个 Story。key = StoryId，0 或 1。 */
  | 'hasReadStoryInRun'
  /** 当前 Entry 跳转链中是否经过某个 Story（含初始 Story 与所有 jumpToStory 目标，去重）。key = StoryId，0 或 1。 */
  | 'visitedStoryInChain'
  /** Extra 三层合并视图数值比较。key = ExtraPath，actual = toNumber(合并视图)，缺失 → 0（见 docs/13 §6.2）。 */
  | 'extra'
  /**
   * 原型聚合统计（Character 重构，docs-818/12-character-rework.md §3）。
   * key = 原型角色 id，actual = protoStats[key].acquiredTotal，缺失 → 0。
   */
  | 'protoStat'
  /** 当前所在 Area 是否为指定 Area（key = AreaId，actual = currentAreaId === key ? 1 : 0）。 */
  | 'area';

export interface Condition {
  target: ConditionTarget;
  key: string;
  comparator: Comparator;
  value: number;
}

export const cond = (
  target: ConditionTarget,
  key: string,
  comparator: Comparator,
  value: number,
): Condition => ({ target, key, comparator, value });

export type ConditionGroup = { type: 'AND' | 'OR'; conditions: (Condition | ConditionGroup)[] };

export const and = (...conditions: (Condition | ConditionGroup)[]): ConditionGroup => ({
  type: 'AND',
  conditions,
});

export const or = (...conditions: (Condition | ConditionGroup)[]): ConditionGroup => ({
  type: 'OR',
  conditions,
});

// --- Effect 系统 ---

export type EffectOp =
  | 'setResource'
  | 'addResource'
  | 'setSpotLevel'
  | 'addSpotLevel'
  | 'setManager'
  | 'addEnhancement'
  | 'addItem'
  | 'loot'
  | 'unlockInit'
  | 'setFlag'
  | 'triggerStory'
  /** 剧情演出要求移动 Area（由 Story 自身发起，不受玩家移动限制）。 */
  | 'travelToArea'
  /** Affector 专有：设定 Spot 等级上限（多个 Affector 取最高者）。 */
  | 'setSpotMaxLevel'
  /** Affector 专有：解除 Spot 等级限制（最高优先级，任意提升）。 */
  | 'removeSpotMaxLevel'
  /** 写 Extra 全局层：target = ExtraPath，value = ExtraValue 或 数值/字符串/布尔字面量（见 docs/13 §6.3）。 */
  | 'setExtra'
  /** Extra 全局层数值增量（仅对 int/float 有效，缺失按 0）：target = ExtraPath，value = 增量（数值或 ValueExpression）。 */
  | 'addExtra'
  /** 删除 Extra 全局层节点：target = ExtraPath（不存在时静默忽略；value 忽略）。 */
  | 'removeExtra'
  /**
   * 获得角色差分（Character 重构统一获得入口，docs-818/12-character-rework.md §1）：
   * target = VariantId；重复获得自动转碎片。via 记为 story/event 类奖励。
   */
  | 'grantCharacter'
  /**
   * 临时演出主题（运行时非持久 UI 效果）：value 为 ThemeEffectValue。
   * 由 effect-engine 转发给 ColorSystem.handleThemeEffect，mutations 保持 no-op。
   */
  | 'setTheme';

/**
 * 临时演出主题声明：引用某 Color 打底 + 可选局部 token 覆盖。
 * 见 engine/theme-runtime.ts 的 ThemeLayer（缺省 scope 视为 ephemeral）。
 */
export interface ThemeEffectValue {
  /** 引用 ColorDef id；缺省仅用 tokens 覆盖。 */
  colorId?: string;
  /** 局部 token 覆盖表（引擎 token 键，如 primary / bg / player-bubble）。 */
  tokens?: Record<string, string>;
}

export interface Effect {
  op: EffectOp;
  target: string;
  /** 数值、字符串、布尔、ValueExpression（引擎结算时按当前状态求值）、ExtraValue（setExtra）或 ThemeEffectValue（setTheme）。 */
  value: number | string | boolean | ValueExpression | ExtraValue | ThemeEffectValue;
  /**
   * 沙盒归属（仅 triggerStory / startStory 使用）：决定剧情启动到哪个游标。
   * 缺省 = 全局游标（active 主线 / 一般闲聊）；设为 VariantId 则启动到该角色聊天沙盒游标。
   */
  owner?: string;
  /**
   * 展示通知（仅 travelToArea 使用）：移动成功后是否在聊天流显示一条「移动到了 XX」的
   * 迷你展示条目（REWARD 风格、无小字符）。缺省 false = 不显示。
   */
  notice?: boolean;
}

// --- Funclet 系统 ---

export interface FuncletDef {
  id: FuncletId;
  description: string;
  params: { name: string; type: 'number' | 'string' }[];
  calc: ValueExpression;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface FuncletCall {
  funcletId: string;
  args: Record<string, number | string>;
}
