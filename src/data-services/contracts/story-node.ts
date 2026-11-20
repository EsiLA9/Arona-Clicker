import type { ExtraCompound } from '../../engine/types/extra';
import type { ConditionGroup } from '../../engine/types/expression';
import type { InitId, StoryId } from '../../engine/types/ids';
import type { StoryAction, StoryEntryCard, StoryTransfer } from './story-node-actions';
import type { AreaId } from '../../engine/types/ids';
import type { VariantId } from '../../engine/types/character';
import type { ChatTextStyle, StoryNodeLayout, StoryNodeTemplate } from '../../engine/contracts/chat-presentation';

/** 文档内唯一的稳定局部身份：1–64位ASCII名，首位字母，后续字母/数字/_/-。 */
export type StoryNodeId = string;

/** 兼容旧 StoryDef 的阶段局部名；播放顺序由 nodes 决定。 */
export type StoryStageId = string;

/** 兼容旧 StoryDef 的推进标记；当前播放不读取它。 */
export type StoryStageAdvance = 'auto' | 'input';

/** 旧阶段声明，保留以兼容已有定义；不约束节点顺序、等待点或播放。 */
export interface StoryStageDeclaration {
  /** 历史标记；当前播放器不按 auto/input 分组。 */
  readonly advance: StoryStageAdvance;
}

/**
 * 正式 StoryDef 的作者文档结构。
 *
 * nodes 是唯一执行顺序；stages 是兼容旧数据的元信息，不复制节点成员或阶段顺序。
 * StoryDef、Datapack、Registry 与节点播放器均直接使用此格式；不包含旧 Talklet 作者格式。
 */
export interface StoryNodeDocument {
  /** 剧情身份，与现有 StoryDef 使用同一 StoryId 域。 */
  readonly id: StoryId;
  /** 作者可读名称。 */
  readonly name: string;
  /** 作者目录归属。省略时归入「其他」，不限制入口、播放或重读。 */
  readonly initId?: InitId;
  /** Authoring location within initId. Affects directory placement only. */
  readonly directoryId?: string;
  /** 起始对话空间由故事本体声明，不从 Active/Passive Entry 推断。 */
  readonly startContext: StoryStartContext;
  /** 按执行顺序排列的顶层节点。 */
  readonly nodes: readonly StoryNode[];
  /** 旧阶段兼容元数据；可继续保存，但不参与播放与节点顺序校验。 */
  readonly stages: Readonly<Record<StoryStageId, StoryStageDeclaration>>;
  /** 剧情附加数据。 */
  readonly extra?: ExtraCompound;
}

export type StoryStartContext =
  | { readonly type: 'area'; readonly areaId: AreaId }
  | { readonly type: 'chara'; readonly characterId: VariantId };

/** 新作者原语允许的顶层执行节点。 */
export type StoryNode =
  | StoryTalkletNode
  | StoryClickNode
  | StoryOperationNode
  | StoryTransferNode
  | StoryMoveToAreaNode
  | StoryMoveToCharaspaceNode;

/** 四类顶层节点共有的稳定作者身份。 */
export interface StoryNodeBase {
  /** 在当前 StoryNodeDocument 内唯一的节点身份。 */
  readonly id: StoryNodeId;
  /** 本次 Entry 局部表必须存在此键才执行；仅一个名称，不比较值。建议 StoryName-flagid，不强制前缀。 */
  readonly requiresFlag?: string;
}

/** 节点的流内及定位展示共用外观。 */
export interface StoryNodeAppearance {
  readonly template?: StoryNodeTemplate;
  readonly style?: ChatTextStyle;
  readonly presentation?: StoryPresentation;
}

/** 节点的定位与时间编排。 */
export interface StoryClickDirection {
  readonly layout?: StoryNodeLayout;
  /** @deprecated 旧定义兼容字段。新内容使用 appearance.style。 */
  readonly style?: ChatTextStyle;
}

export interface StoryNodeDirection extends StoryClickDirection {
  /** @deprecated 旧定义兼容字段。新内容使用 appearance.template。 */
  readonly template?: StoryNodeTemplate;
  readonly pacing?: StoryPacing;
}

/** 正文呈现节点；stageId 仅为旧定义兼容元数据。 */
export interface StoryTalkletNode extends StoryNodeBase {
  /** 顶层节点类型，固定为 talklet。 */ readonly type: 'talklet';
  /** 旧阶段兼容 ID；不会控制相邻 Click 或节点顺序。 */ readonly stageId: StoryStageId;
  /** 对话或旁白内容。 */
  readonly content: StoryContent;
  /** @deprecated 旧定义兼容字段。新内容使用 appearance.presentation。 */
  readonly presentation?: StoryPresentation;
  /** @deprecated 旧定义兼容字段。新内容使用 performance.pacing。 */
  readonly pacing?: StoryPacing;
  /** 流内与定位展示共用的外观。 */
  readonly appearance?: StoryNodeAppearance;
  /** 定位与时间编排。 */
  readonly performance?: StoryNodeDirection;
}

/** 交互输入节点；选择候选属于本 Click，不由相邻 Click 推断。 */
export interface StoryClickNode extends StoryNodeBase {
  /** 顶层节点类型，固定为 click。 */ readonly type: 'click';
  /** 旧阶段兼容 ID；当前输入次序完全由 nodes 顺序决定。 */ readonly stageId: StoryStageId;
  /** 本次输入的明确形式。 */
  readonly interaction: StoryClickInteraction;
  /** 交互局部样式与定位；不提供正文文本模板。 */
  readonly appearance?: { readonly style?: ChatTextStyle };
  readonly performance?: StoryClickDirection;
}

/** 独立执行一项有界行为的节点；不属于呈现阶段。 */
export interface StoryOperationNode extends StoryNodeBase {
  /** 顶层节点类型，固定为 operation。 */ readonly type: 'operation';
  /** 到达该节点时执行的行为载荷。 */
  readonly action: StoryAction;
}

/** 独立控制流节点；不属于呈现阶段。 */
export interface StoryTransferNode extends StoryNodeBase {
  /** 顶层节点类型，固定为 transfer。 */ readonly type: 'transfer';
  /** goto 或 insert 控制流意图。 */
  readonly transfer: StoryTransfer;
}

/** 强制切换正式 Area，或在重播中仅呈现空间移动。 */
export interface StoryMoveToAreaNode extends StoryNodeBase {
  readonly type: 'moveToArea';
  readonly areaId: AreaId;
}

/** 切换到指定角色通讯录空间；重播时只改变呈现目标。 */
export interface StoryMoveToCharaspaceNode extends StoryNodeBase {
  readonly type: 'moveToCharaspace';
  readonly characterId: VariantId;
}

/** 可作为 Story 正文的有限呈现内容。 */
export type StoryContent = StoryTalkContent | StoryNarrationContent;

/** 角色对话正文；图片仅属于 talk。 */
export interface StoryTalkContent {
  /** 内容类型，固定为角色对话。 */ readonly kind: 'talk';
  /** 正文文字。 */ readonly text: string;
  /** 默认发出方角色；名称与头像来自该角色。@ref characters */ readonly characterId?: string;
  /** 旧内容的发出方名称；没有角色引用时保留旧头像匹配方式。 */ readonly speaker?: string;
  /** 临时显示名；只覆盖名称，不改变角色头像。 */ readonly displayName?: string;
  /** 可选对话图片。 */ readonly image?: string;
}

/** 旁白正文。 */
export interface StoryNarrationContent {
  /** 内容类型，固定为旁白。 */ readonly kind: 'narration';
  /** 旁白文字。 */ readonly text: string;
}

/** 正文的左右侧、对齐和头像意图。 */
export interface StoryPresentation {
  /** 气泡所在侧。 */ readonly side?: 'left' | 'right';
  /** 正文对齐方式。 */ readonly align?: 'center' | 'left' | 'right';
  /** 可选头像资源标识。 */ readonly avatar?: string;
  /** 头像显示策略。 */ readonly avatarMode?: 'auto' | 'hide' | 'show';
}

/** 正文节奏意图；不决定节点顺序或 Click 输入次数。 */
export interface StoryPacing {
  /** 对方文字输入节奏参数。 */
  readonly typing?: number;
  /** 对方思考停顿参数。 */
  readonly thinking?: number;
}

/** Click 内部的单按钮、互斥候选组或入口卡交互。 */
export type StoryClickInteraction =
  | StoryButtonInteraction
  | StoryChoiceInteraction
  | StoryEntryCardInteraction
  | {
      readonly kind: 'kizunaCard';
      /** 空白时沿用羁绊入口默认文案。 */ readonly buttonText?: string;
    }
  | {
      readonly kind: 'areaContinue'; readonly areaId: AreaId;
      /** 空白时沿用地点续播默认文案。 */ readonly buttonText?: string;
    };

/** 单按钮输入；可声明按击工作量，完成后继续后继节点。 */
export interface StoryButtonInteraction {
  /** 交互类型，固定为单按钮。 */ readonly kind: 'button';
  /** 按钮文案。 */ readonly text: string;
  /** 可选基础与随机按击工作量。 */ readonly press?: StoryClickPress;
}

/** 单按钮所需的基础与随机按击工作量。 */
export interface StoryClickPress {
  /** 基础按击次数。 */ readonly base: number;
  /** 可选随机增量上限。 */ readonly rand?: number;
}

/** 一个 Click 内互斥的一组候选项。 */
export interface StoryChoiceInteraction {
  /** 交互类型，固定为一组互斥候选。 */ readonly kind: 'choice';
  /** 候选项；每个选项是本 Click 内独立分支。 */ readonly options: readonly StoryChoiceOption[];
}

/** 互斥选择中的候选项；只声明出现条件与本 Entry 局部选择标记。 */
export interface StoryChoiceOption {
  /** 稳定候选身份。 */ readonly id: string;
  /** 候选显示文案。 */ readonly text: string;
  /** 持久状态条件；与 requiresFlag 同时满足时才显示候选。 */ readonly showWhen?: ConditionGroup;
  /** 本次 Entry 局部表必须存在此键才显示候选；只判断存在，不比较值。 */ readonly requiresFlag?: string;
  /** 选择成功后设置为 true；本组其他选项声明的标记会先清除。 */ readonly marks?: readonly string[];
}

/** 以入口卡片邀请进入目标 Entry 的交互。 */
export interface StoryEntryCardInteraction {
  /** 交互类型，固定为入口卡片。 */ readonly kind: 'entryCard';
  /** 入口卡片的显示与目标声明。 */ readonly card: StoryEntryCard;
}
