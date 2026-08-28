// ============================================================
// engine/types/expression.ts — 数值表达式 / 条件 / 效果 / Funclet
// ============================================================

import type { ExtraCompound, ExtraPath, ExtraValue } from './extra';
import type { FuncletId } from './ids';
import type { Talklet } from './content';

// --- Value 系统 ---

export type ValueSource =
  | 'const'
  | 'res'
  | 'spotLevel'
  | 'areaSpotCount'
  | 'managerCount'
  | 'funclet'
  /** 读 Extra 三层合并视图（全局 → per-Init → 数据包常量表），params.path = ExtraPath，数值语义同 toNumber（见 docs/13 §6.1）。 */
  | 'data';

export interface Value {
  type: 'value';
  source: ValueSource;
  params: Record<string, string | number>;
}

// --- ValueExpression (GameNum 连携) ---

/**
 * 表达式运算节点。支持二元运算（add/sub/mul/div/min/max/pow）、一元取整
 * （floor/ceil/round）与区间夹取（clamp）。仍为纯函数式树，由
 * ValueSystem.evaluate 递归求值。
 */
export type ValueExpression =
  | { type: 'const'; value: number }
  | { type: 'value'; value: Value }
  | { type: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max' | 'pow'; left: ValueExpression; right: ValueExpression }
  | { type: 'floor' | 'ceil' | 'round'; expr: ValueExpression }
  | { type: 'clamp'; expr: ValueExpression; min: ValueExpression; max: ValueExpression };

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
  | 'clearAllChatText';

/**
 * 临时演出主题声明：引用某 ColorGroup 打底 + 可选局部 token 覆盖。
 * 见 engine/theme-runtime.ts 的 ThemeLayer（缺省 scope 视为 ephemeral）。
 */
export interface ThemeEffectValue {
  /** 引用 ColorGroupDef id；缺省仅用 tokens 覆盖。 */
  colorGroupId?: string;
  /** 局部 token 覆盖表（引擎 token 键，如 primary / bg / player-bubble）。 */
  tokens?: Record<string, string>;
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

/** 演出专用文本的视觉格式类别（showChatText.kind，无 talklet 时生效）。 */
export type ChatTextKind = 'default' | 'kizuna' | 'title' | 'badge' | 'note';

/** 字型类别（showChatText.style.font）。 */
export type ChatTextFont = 'default' | 'serif' | 'sans' | 'mono' | 'handwritten';

/**
 * 演出专用文本的样式覆写（showChatText.style）：
 * 通过 CSS 自定义属性应用到覆盖层及其内嵌内容（旁白/气泡均可继承）。
 */
export interface ChatTextStyle {
  /** 字型类别（缺省 default = 跟随界面默认字型）。 */
  font?: ChatTextFont;
  /** 字型大小（CSS 值，如 '18px'、'1.4em'）。 */
  fontSize?: string;
  /** 强制文字颜色（CSS 色值，如 '#ff6b6b' 或 'var(--primary)'）。 */
  color?: string;
  /** 是否有背景衬底/气泡背景（缺省 true = 有背景）。 */
  background?: boolean;
  /** 强制背景色（CSS 色值，如 '#2d2d2d'；缺省跟随模板默认背景）。 */
  backgroundColor?: string;
}

/**
 * 演出专用文本声明（showChatText 的 value）：
 * 以聊天窗格为百分比坐标轴定位（0,0 = 左下，1,1 = 右上），作为该文本的锚点。
 * 内容既可直接给 text，也可嵌入一个标准 Talklet（复用 speaker/avatar/kind/side/kizuna 渲染）。
 */
export interface ChatTextEffectValue {
  /** 文本内容（无 talklet 时使用）。 */
  text?: string;
  /**
   * 复用标准 Talklet 渲染：嵌入一个 Talklet（含 speaker/avatar/kind/side/kizuna 等）。
   * 与 text 二选一，talklet 优先。用于把一个已声明的 talklet 片段定位重放到聊天窗格上。
   */
  talklet?: Talklet;
  /** 锚点横坐标（0..1，0=左，1=右）。缺省 0。 */
  x?: number;
  /** 锚点纵坐标（0..1，0=下，1=上）。缺省 1（贴近窗格顶部）。 */
  y?: number;
  /** 相对锚点的对齐方式。缺省 left（文本从锚点向右展开）。 */
  align?: 'left' | 'center' | 'right';
  /** 视觉格式类别（无 talklet 时生效）。缺省 'default'。 */
  kind?: ChatTextKind;
  /** 样式覆写：字型 / 强制文字颜色 / 是否有背景 / 强制背景色。 */
  style?: ChatTextStyle;
  /** 标题（仅 kind='kizuna' 使用）。 */
  title?: string;
  /** 按钮文案（仅 kind='kizuna' 使用）。 */
  buttonText?: string;
  /**
   * 交互目标剧情入口 id（仅 kind='kizuna' 或 talklet.kizuna 使用）：
   * 点击卡片后启动该 ActiveStoryEntry（沿用 data-kizuna → startCardStory 语义）。
   */
  targetStoryId?: string;
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
