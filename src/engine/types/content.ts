// ============================================================
// engine/types/content.ts — 内容实体（强化 / 剧情 / 物品 / 掉落表）
// ============================================================

import type { TagPath } from '../core/tag';
import type {
  AreaId,
  EnhancementId,
  InitId,
  ItemId,
  StoryId,
} from './ids';
import type { PicId } from './pics';
import type { ExtraCompound } from './extra';
import type {
  Condition,
  ConditionGroup,
  Effect,
} from './expression';
import type { ResourceAmount } from './common';
import type { RevealTrigger } from './reveal';
import type { AffectorPackRef } from './trigger';
import type { SpotFunctionalityDef } from './world';

// --- 强化 (Enhancement) ---

/**
 * Enhancement 的挂靠元数据（仅 UI 展示用，不参与作用域结算）。
 * 作用域统一为全局（一般即当前 Init，除非有特别的全局特性）。
 * - area / init / global 描述该增强"挂靠/来源"的位置信息。
 */
export type EnhancementAttachment =
  | { kind: 'area'; areaId: AreaId }
  | { kind: 'init'; initId: InitId }
  | { kind: 'global' };

export interface EnhancementDef {
  /** @label ID */
  id: EnhancementId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  effects: Effect[];
  /** @label 自动应用 */
  autoApply: boolean;
  /** @label 最大层数 */
  maxStacks?: number;
  /** 购买所需资源（为空表示仅需满足条件即可获得）。 */
  price?: ResourceAmount[];
  /**
   * 层级标签（用于按 tag 聚合的收集统计）。
   * @label 标签
   */
  tags?: TagPath[];
  /** 挂靠元数据（仅 UI 展示用，不参与作用域结算）。 */
  attachment?: EnhancementAttachment;
  /**
   * 不可撤回：获得后禁止移除（无热插拔）。缺省 false = 可自由启用/停用。
   * @label 不可撤回
   */
  irreversible?: boolean;
  /** 获得后为匹配 Spot 注入的外源功能（作用范围由该 Enhancement 的 Affector 包 zoneModifiers 的 tag 目标决定；无 tag 目标 = 全局）。 */
  addsFunctionalities?: SpotFunctionalityDef[];
  /**
   * 获得后挂载的 Affector 包引用列表（用于持续被动效果）。
   * 推荐用法：消耗品的效果应在 useEffects 中声明；需要"持有即生效"的持续效果应
   * 通过 Enhancement 的此字段挂载，而非直接挂在 Item 上。所有产出加成（按 tag 或
   * 指定实体的加区/乘区/上下限）都经这些 Affector 包的 zoneModifiers 声明。
   * 每项既可是全局注册的 pack id 字符串，也可是内联的完整 AffectorPackDef（匿名）。
   */
  affectorPackIds?: AffectorPackRef[];
  /**
   * 揭示 Trigger 列表：每个 Trigger 独立负责一个信息块的揭示。
   * unlock 目标 = 实际解锁条件（条件满足才可购买 / 获得，缺省 = 无条件）。
   * 缺省 = 立即可见（兼容现状）。级别见 RevealStage。
   */
  revealTriggers?: RevealTrigger[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

// --- 剧情 (Story) ---

/**
 * 条件分支奖励包：完结时按条件评估，首个满足的生效。
 * 用于 Story 跳转链产生不同 flag/判定后，Entry 输出不同奖励。
 */
export interface ConditionalReward {
  /** 生效条件：满足时发放此奖励包。 */
  condition: ConditionGroup;
  /** 奖励效果列表。 */
  effects: Effect[];
}

/**
 * 分歧点准入守卫：重阅读时，若玩家尝试进入某条分支（jumpToStory 目标 Story），
 * 但 storyReadLogs 中缺乏指定前置阅读记录，则拒绝该跳转。
 */
export interface BranchGuard {
  /** 受保护的分支目标 Story.id（进入该 Story 前需满足前置阅读）。 */
  storyId: StoryId;
  /**
   * 前置阅读要求列表。
   * talkletIndex = -1 表示要求该 Story 的全部 Talklet 已读。
   */
  prerequisites: { storyId: StoryId; talkletIndex: number }[];
  /** 拒绝时的提示文本。 */
  denialMessage: string;
}

export interface StoryEntryBase {
  /** @label ID */
  id: StoryId;
  /** 演出本体引用：指向 stories 表。当前与 id 1:1 同值，未来允许多 Entry 复用同一 Story。 */
  storyId: StoryId;
  /** 可触发的初始场景（空数组表示所有 Init 均可触发）。 */
  availableInits: InitId[];
  /**
   * 层级标签（用于按 tag 聚合的收集统计与池归类）。
   * @label 标签
   */
  tags?: TagPath[];
  /** 触发条件 —— 仅当条件满足时才会被自动展开 / 进入抽选池。 */
  triggerCondition: ConditionGroup;
  /** 揭示 Trigger 列表：未满足时名称/触发条件被遮挡。 */
  revealTriggers?: RevealTrigger[];
  /**
   * 是否允许重阅读。缺省 false = 不提供重阅读入口。
   * true 时玩家可从 StoryEntry 入口重新阅读关联的 Story 链。
   */
  replayable?: boolean;
  /**
   * 完结奖励策略。缺省 'simple' 兼容现有行为。
   * - simple: PassiveStoryEntry 使用 completionReward 的 first/repeat
   * - conditional: 使用 conditionalRewards 按条件评估，首个满足的生效
   */
  completionStrategy?: 'simple' | 'conditional';
  /**
   * 条件分支奖励列表（completionStrategy = 'conditional' 时使用）。
   * 按声明顺序评估，第一个满足条件的奖励包生效。
   * 适用于：Story 跳转链中不同分支产生不同 flag/判定后，Entry 输出不同奖励。
   */
  conditionalRewards?: ConditionalReward[];
  /**
   * 分歧点准入守卫列表（replayable = true 时生效）。
   * 重阅读时，若玩家尝试进入某个 Talklet 索引（该索引指向一个重大分歧点），
   * 但 storyReadLogs 中缺乏指定的前置 Talklet 阅读记录，则拒绝进入。
   */
  branchGuards?: BranchGuard[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/**
 * 主线 / 支线 / 羁绊剧情入口。
 * 入口点由消费侧决定：故事栏内容表（rail）引用该 entry，或聊天流 Talklet.kizuna 卡片引用该 entry。
 * 启动语义（normal / skipConditions / force）由调用方选择，见 story-flow.startStory。
 */
export interface ActiveStoryEntry extends StoryEntryBase {
  type: 'active';
  /**
   * 完结奖励：剧情完整播放到最后一页后发放。
   * first = 首次完成该 Story；repeat = 仅显式配置时重复完成发放（一般不提供多次奖励）。
   * 与被动闲聊的 completionReward 语义一致。
   */
  completionReward?: { first?: Effect[]; repeat?: Effect[] };
  /**
   * 归属某学生差分的聊天空间（VariantId）。
   * 用于通讯录/故事栏按角色分组展示，以及聊天卡片在对应对话空间路由。
   */
  owner?: string;
}

/** 随机闲聊入口：当无剧情进行时，按权重随机抽取。 */
export interface PassiveStoryEntry extends StoryEntryBase {
  type: 'passive';
  /** 是否允许多次触发。 */
  repeatable: boolean;
  /** 抽选权重。 */
  weight: number;
  /**
   * 完结奖励：闲聊完整播放到最后一页后发放。
   * first = 当前世界线内首次完成该闲聊；repeat = 重复完成。
   * 用于发放跨世界线保留的全局资源（如青辉石）。
   * 当 completionStrategy = 'conditional' 时，此字段被 conditionalRewards 替代。
   */
  completionReward?: { first?: Effect[]; repeat?: Effect[] };
  /**
   * 归属某学生差分的聊天空间（VariantId）。设置后该闲聊仅在该学生的对话空间被抽取，
   * 一般聊天空间只抽 owner 为空的全局闲聊。实现「聊天空间壁垒」。
   */
  owner?: string;
  /**
   * 抽取后冷却帧数：被抽取（最后一页播完）后需经过 N 帧（tick）才能再次被选取。
   * 复用 PlayerState.totalFrames 计数。0 或不设置表示无冷却。
   */
  cooldownFrames?: number;
  /**
   * 阻断/重启条件：播完最后一页后锁定该学生的对话空间，直到该条件组满足才「重启」
   * （解除锁定）。用于如「剧情结束后要求玩家前往某地继续下一步」的关卡式剧情。
   */
  block?: ConditionGroup;
  /**
   * 是否可被「移动 Area」打断（默认 true）。false 时进入该闲聊后不会被移动打断，
   * 其播放状态一直保留，直到剧情自然播完或主动切换。
   */
  interruptible?: boolean;
  /**
   * 播放中是否允许离开 Area（默认 true）。false 时该闲聊播放期间禁止移动
   * （等同 active 的移动锁定，配合 interruptible:false 实现「演出中途不可离场」）。
   */
  leaveArea?: boolean;
}

/** 被动闲聊池子节点：子池引用或叶子 entry 引用。 */
export interface PassivePoolChild {
  /** 子池 id 或 被动闲聊 Entry id。 */
  id: string;
  /** 抽选权重（缺省 1）。叶子实际权重 = 路径上各池权重连乘 × entry 自身权重。 */
  weight?: number;
  /**
   * 抽取后冷却帧数：该子池（或叶子 entry）被选中后需经过 N 帧才能再次被选取。
   * 0 或不设置表示无冷却。
   */
  cooldownFrames?: number;
}

/**
 * 被动闲聊池：把 passiveStories 包装为可策划的树状抽选结构。
 * - gate（condition）经 EventDrivenReactor 反射判定（条件翻转事件定向失效）；
 * - 树状抽取：gate 不过的分支整枝剪除，叶子按「路径权重连乘」加权抽取；
 * - 未被任何池引用的 entry 由引擎自动归入默认根池（平铺语义的退化形态）；
 *   未声明任何池时，全部 entry 进入默认根池——等价于无池的旧模型。
 */
export interface PassivePoolDef {
  /** @label ID */
  id: string;
  /** @label 名称 */
  name?: string;
  /** 层级标签（用于统计与外部 lock/boost 机制定位池）。 @label 标签 */
  tags?: TagPath[];
  /** 池 gate：不满足时整棵子树退出候选。缺省 = 无条件可用。 */
  condition?: ConditionGroup;
  /**
   * 归属某学生差分的聊天空间（VariantId）。设置后该池仅在该学生的对话空间被抽取。
   * 与 PassiveStoryEntry.owner 共同决定壁垒路由。
   */
  owner?: string;
  /**
   * 抽取后冷却帧数：该池被抽取（命中任一内条目）后需经过 N 帧才能再次被选取。
   * 0 或不设置表示无冷却。
   */
  cooldownFrames?: number;
  /** 子节点列表：子池 id 或被动闲聊 Entry id。 */
  children: PassivePoolChild[];
}

/** 活跃剧情入口 与 被动闲聊入口 的联合类型。 */
export type StoryEntryDef = ActiveStoryEntry | PassiveStoryEntry;

/**
 * Story —— 纯演出本体，不含任何触发/揭示逻辑。
 * 仅保留自身 id 供日志记录（storyLog / storyReadLogs 均按 Story.id 记），
 * 支持通过 Talklet.jumpToStory 进行跨 Story 跳转（goto/insert）。
 */
export interface StoryDef {
  /** @label ID */
  id: StoryId;
  /** @label 名称 */
  name: string;
  /** @label Talklet 列表 */
  talklets: Talklet[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/** Talklet：微小的演示片段，内嵌于 Story，不可跨故事复用。 */
export interface Talklet {
  /** @label 文本 */
  text: string;
  /** @label 说话人 */
  speaker?: string;
  /** @label 选项 */
  choices?: StoryChoice[];
  /** @label 效果 */
  effects?: Effect[];
  /**
   * 回复按钮文案（该 Talklet 由底部"回复"按钮承载推进）。
   * 缺省 = 用 text 作为按钮文案。
   * 完成本页推进时，该文案默认会作为「老师」回复气泡回显到聊天流；
   * 若无需回显（按钮文案不便以玩家口吻进流），设 muteReply = true。
   */
  sendText?: string;
  /**
   * @label 静默回复
   * 完成本页推进时，是否把 sendText 作为玩家回复回显到聊天流。
   * 缺省 false = 回显；true = 仅推进、不回显。
   * click 页恒不回显（与 muteReply 无关）。
   */
  muteReply?: boolean;
  /**
   * 点击工作：要求玩家连续点击该 Talklet 的回复按钮 `base + rand(0, rand)` 次
   * （rand 缺省 = 0）从左往右填满进度条（进入该页时计数为 0/N）；填满后还需再点一次才结束该页并推进。
   * 按钮上会显示进度条，用于模拟回消息/完成复杂任务。
   * click 页缺省视为 { base: 1 }（"点一下推进"为最小形态，增强健壮性）。
   * 注意：页面存在 choices 时该字段被忽略（选项优先）。
   */
  clickWork?: { base: number; rand?: number };
  /**
   * @label 类型
   * @enum talk=对话
   * @enum narration=旁白
   * @enum click=点击阻塞
   * 演出类型。缺省 = talk（普通对话气泡）。
   * narration 渲染为横跨聊天流宽度的场间旁白（align 控制对齐）。
   * click 为纯底部按钮交互页：text/sendText 作按钮文案，不进入聊天流，默认不承载选项/联动效果。
   */
  kind?: 'talk' | 'narration' | 'click';
  /**
   * @label 对齐
   * @enum center=居中
   * @enum left=靠左
   * @enum right=靠右
   * 仅 narration 生效。缺省 = center。
   */
  align?: 'center' | 'left' | 'right';
  /**
   * @label 头像
   * 头像图片索引（`mod:type(pic):id`，见 pics 表；不得持有裸 URL）。
   * 实际图片经 PicDef → getPicUrl 解析。缺省渲染首字母圆形占位。
   */
  avatar?: PicId;
  /**
   * @label 气泡侧
   * @enum left=靠左
   * @enum right=靠右
   * 仅 talk 生效：本气泡出现于聊天流左侧或右侧。
   * 缺省 = left。右侧通常表示玩家/对话方（speaker 为该侧自定义名）；
   * 玩家回复回显（sendText）恒为 right，与本字段无关。
   */
  side?: 'left' | 'right';
  /**
   * @label 隐藏头像
   * 是否不渲染圆形头像（纯文本气泡）。缺省 false = 渲染圆形头像
   * （有 avatar 渲染图片，否则渲染首字母占位）。
   */
  noAvatar?: boolean;
  /**
   * 聊天流发送图片：图片索引（`mod:type(pic):id`，见 pics 表；不得持有裸 URL）。
   * 实际图片经 PicDef → getPicUrl 解析。图片渲染在聊天气泡内（text 上方）。缺省不发送图片。
   * @label 图片
   */
  image?: PicId;
  /**
   * 跳转到另一个 Story（当前 Talklet 的效果执行完毕后跳转）。
   * - goto（缺省）: 转移演出流到目标 Story，本 Story 不再返回。目标 Story 完结即 Entry 完结。
   * - insert: 暂停当前 Story，播放目标 Story；播完后返回当前 Story 的下一页继续。
   *
   * 适用于：将超长 Story 拆分为多个短 Story 串联演出（goto），
   * 或在主 Story 中插入一段子剧情后返回（insert）。
   */
  jumpToStory?: StoryId;
  /**
   * 跳转模式。缺省 'goto'。
   * goto = 完全转移，不返回；insert = 插入子剧情，播完后返回原地。
   */
  jumpMode?: 'goto' | 'insert';
  /**
   * 羁绊剧情入口：当前 Talklet 位置渲染羁绊卡片（yuzu 风格），
   * 玩家点击后启动目标 ActiveStoryEntry 的演出 Story（尊重单次完成态）。
   * 与 choices 互斥（choices 优先）。
   */
  kizuna?: {
    /** 目标剧情入口 id（指向 ActiveStoryEntry，非 StoryDef）。 */
    storyId: StoryId;
    /** 卡片标题（可选，缺省从 entry 取）。 */
    title?: string;
    /** 按钮文案（可选，缺省从 entry 取）。 */
    buttonText?: string;
    /**
     * 卡片对齐（缺省 left）。仅支持 left / right，不允许居中。
     * @enum left=靠左
     * @enum right=靠右
     */
    align?: 'left' | 'right';
  };
}

export interface StoryChoice {
  text: string;
  effects: Effect[];
  condition?: ConditionGroup;
  /**
   * 选择本选项后跳转到另一个 Story（选项效果执行完毕后跳转）。
   * 语义与 Talklet.jumpToStory 一致：
   * - goto（缺省）: 完全转移，不返回；目标 Story 完结即 Entry 完结。
   * - insert: 插入子剧情，播完后返回当前 Story 的下一页。
   */
  jumpToStory?: StoryId;
  /**
   * 跳转模式。缺省 'goto'。
   */
  jumpMode?: 'goto' | 'insert';
}

// --- 物品 (Item) ---

export interface ItemDef {
  /** @label ID */
  id: ItemId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  /** @label 图标 */
  icon?: string;
  /** @label 堆叠上限 */
  maxStack: number;
  /** @label 稀有度 @enum common=普通 @enum rare=稀有 @enum epic=史诗 @enum legendary=传说 */
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** @label 类型 @enum consumable=消耗品 @enum material=材料 @enum key=钥匙 */
  type: 'consumable' | 'material' | 'key';
  /** 揭示 Trigger 列表：existence 目标即「实体是否出现」（原 visibilityCondition 的职责，已并入本系统）。 */
  revealTriggers?: RevealTrigger[];
  useCondition?: ConditionGroup;
  useEffects?: Effect[];
  pickupEffects?: Effect[];
  sellPrice?: ResourceAmount;
  /** 持有即生效的 Affector 包引用列表（每项可为 pack id 字符串或内联 AffectorPackDef）。 */
  affectorPackIds?: AffectorPackRef[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

// --- 掉落表 (DropTable) ---

export interface DropTableDef {
  /** @label ID */
  id: string;
  entries: DropTableEntry[];
  guaranteed?: { itemId: ItemId; count: number }[];
  /** @label 最大掷数 */
  maxRolls: number;
  condition?: ConditionGroup;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface DropTableEntry {
  itemId: ItemId;
  min: number;
  max: number;
  weight: number;
  condition?: ConditionGroup;
}
