// ============================================================
// engine/types/expression.ts — 数值表达式 / 条件 / 效果 / Funclet
// ============================================================

import type { ExtraCompound, ExtraPath, ExtraValue } from './extra';
import type { FuncletId } from './ids';
import type { ChatTextEffectValue } from '../contracts/chat-presentation';
export { type ValueSource, type Value, type ValueExpression } from '../contracts/expression';
import type { Value, ValueExpression } from '../contracts/expression';

// --- Value 系统 ---

// --- ValueExpression (GameNum 连携) ---

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
  /** 好感等级（key = VariantId，actual = 该角色当前好感等级，未拥有/缺失 → 0）。 */
  | 'affectionLevel'
  /** 当前所在 Area 是否为指定 Area（key = AreaId，actual = currentAreaId === key ? 1 : 0）。 */
  | 'area';

export interface Condition {
  target: ConditionTarget;
  key: string;
  comparator: Comparator;
  value: number;
}

export type ConditionGroup = { type: 'AND' | 'OR'; conditions: (Condition | ConditionGroup)[] };

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
   * 增加好感小值（好感系统统一写入口 addAffectionExp）：target = VariantId，
   * value = 差分（未拥有/非法量拒绝）。走 affectionChanged 事件。
   */
  | 'addAffectionExp'
  /**
   * 临时演出主题（运行时非持久 UI 效果）：value 为 ThemeEffectValue。
   * 由 effect-engine 转发给 ColorSystem.handleThemeEffect，mutations 保持 no-op。
   */
  | 'setTheme'
  /**
   * 清理聊天流（Talklet 演出服务）：清空目标流的全部聊天内容（含演出专用文本）。
   * target = 对话空间 VariantId（空字符串 = 当前/一般聊天流），value 忽略。
   * 由 effect-engine 转发给 ChatFlowService，mutations 保持 no-op。
   */
  | 'clearAllChatFlow'
  /**
   * 演出专用文本（Talklet 演出服务）：在聊天窗格内以百分比坐标定位显示一段文本。
   * target = 临时 id（唯一名，供 clearIdChatFlow 后续擦除）；value = ChatTextEffectValue。
   * 由 effect-engine 转发给 ChatFlowService，mutations 保持 no-op。
   */
  | 'showChatText'
  /**
   * 按临时 id 清理聊天内容（Talklet 演出服务）：擦除 showChatText 创建的演出专用文本。
   * target = 临时 id；value 忽略。由 effect-engine 转发给 ChatFlowService，mutations 保持 no-op。
   */
  | 'clearIdChatFlow'
  /**
   * 删除全部可变位置的演出文本（Talklet 演出服务）：清空所有 showChatText 覆盖层，不清聊天历史。
   * target 忽略；value 忽略。由 effect-engine 转发给 ChatFlowService，mutations 保持 no-op。
   * Story 完结时引擎默认自动执行一次（UI 订阅 storyCompleted 清理）。
   */
  | 'clearAllChatText'
  /**
   * 呼出开幕标题横幅（Talklet 演出服务）：在当前活跃聊天流中央显示横幅状标题
   * （30 秒自动淡出，展示期间 UI 阻断该流的剧情推进点击）。target 忽略（''）；
   * value = 横幅标题文本（覆盖式优先），空字符串/缺省时 UI 回退 entry.openingTitle ?? StoryDef.name。
   * 时机：声明在首页时随剧情开始（含重读）立即呼出（推进离开首页时跳过防重复）；
   * 声明在非首页时于离开该页时呼出（幕间标题）。
   * 由 effect-engine 转发给 ChatFlowService，mutations 保持 no-op。
   */
  | 'showOpeningTitle';

/**
 * 声明类效果 op：不进执行流（mutations 静默、Affector 激活沿过滤），
 * 由消费方按声明动态读取（现役：Affector 区等级上限，getSpotMaxLevelOverrides）。
 * 新增声明类 op = EffectOp 联合加成员 + 本集合加一项。
 */
export const DECLARATIVE_EFFECT_OPS: ReadonlySet<EffectOp> = new Set<EffectOp>(['setSpotMaxLevel', 'removeSpotMaxLevel']);

/**
 * 临时演出主题声明：引用某 ColorGroup 打底 + 可选局部 token 覆盖。
 * 见 engine/theme-runtime.ts 的 ThemeLayer（缺省 scope 视为 ephemeral）。
 */
export interface ThemeEffectValue {
  /** 引用 ColorGroupDef id；缺省仅用 tokens 覆盖。 */
  colorGroupId?: string;
  /** 有序主题色列表（最多六个）。 */
  palette?: string[];
  /** 局部 token 覆盖表（引擎 token 键，如 primary / bg / player-bubble）。 */
  tokens?: Record<string, string>;
  /** 语义颜色节点显式覆盖。 */
  nodes?: Partial<Record<import('./theme').ThemeNodeName, string>>;
  /** 临时背景视觉层，规则同 ThemeDef.background。 */
  background?: import('./theme').BackgroundLayerDef[];
  /**
   * 作用范围：ephemeral（临时演出，默认）| area（场景）| student（学生）。
   * ephemeral 走 ColorSystem 临时层；area/student 改写实体主题槽。
   */
  scope?: 'ephemeral' | 'area' | 'student';
  /**
   * 目标实体键（`area:<id>` / `variant:<id>`），scope 为 area/student 时必填。
   */
  entityKey?: string;
}

export interface Effect {
  op: EffectOp;
  target: string;
  /** 数值、字符串、布尔、ValueExpression（引擎结算时按当前状态求值）、ExtraValue（setExtra）、ThemeEffectValue（setTheme）或 ChatTextEffectValue（showChatText）。 */
  value: number | string | boolean | ValueExpression | ExtraValue | ThemeEffectValue | ChatTextEffectValue;
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
