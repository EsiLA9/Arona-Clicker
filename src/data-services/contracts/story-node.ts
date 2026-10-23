import type { ExtraCompound } from '../../engine/types/extra';
import type { ConditionGroup } from '../../engine/types/expression';
import type { StoryId } from '../../engine/types/ids';
import type { StoryAction, StoryEntryCard, StoryTransfer } from './story-node-actions';

/** 文档内唯一的稳定局部身份：1–64位ASCII名，首位字母，后续字母/数字/_/-。 */
export type StoryNodeId = string;

/** 一组正文与至多一个输入点的显式阶段局部名；词法与StoryNodeId一致。 */
export type StoryStageId = string;

/** 阶段结束时的作者推进意图。 */
export type StoryStageAdvance = 'auto' | 'input';

/** 声明一个阶段是否自动继续或等待其显式 Click。 */
export interface StoryStageDeclaration {
  /** auto 阶段有正文且无 Click；input 阶段恰有一个末位 Click，正文可为空。 */
  readonly advance: StoryStageAdvance;
}

/**
 * 正式 StoryDef 的作者文档结构。
 *
 * nodes 是唯一执行顺序；stages 只声明阶段推进方式，不复制节点成员或阶段顺序。
 * StoryDef、Datapack、Registry 与节点播放器均直接使用此格式；不包含旧 Talklet 作者格式。
 */
export interface StoryNodeDocument {
  /** 剧情身份，与现有 StoryDef 使用同一 StoryId 域。 */
  readonly id: StoryId;
  /** 作者可读名称。 */
  readonly name: string;
  /** 按执行顺序排列的四类顶层节点。 */
  readonly nodes: readonly StoryNode[];
  /** 以 stageId 为键的阶段模式声明；键的枚举顺序不表示播放顺序。 */
  readonly stages: Readonly<Record<StoryStageId, StoryStageDeclaration>>;
  /** 剧情附加数据。 */
  readonly extra?: ExtraCompound;
}

/** 新作者原语允许的四类顶层执行节点。 */
export type StoryNode =
  | StoryTalkletNode
  | StoryClickNode
  | StoryOperationNode
  | StoryTransferNode;

/** 四类顶层节点共有的稳定作者身份。 */
export interface StoryNodeBase {
  /** 在当前 StoryNodeDocument 内唯一的节点身份。 */
  readonly id: StoryNodeId;
}

/** 正文呈现节点；stageId 指定它所属的显式呈现阶段。 */
export interface StoryTalkletNode extends StoryNodeBase {
  /** 顶层节点类型，固定为 talklet。 */ readonly type: 'talklet';
  /** 此正文所属的显式阶段。 */ readonly stageId: StoryStageId;
  /** 对话或旁白内容。 */
  readonly content: StoryContent;
  /** 左右侧、对齐和头像呈现意图。 */
  readonly presentation?: StoryPresentation;
  /** 对方输入中与思考节奏意图。 */
  readonly pacing?: StoryPacing;
}

/** 交互输入节点；选择候选属于本 Click，不由相邻 Click 推断。 */
export interface StoryClickNode extends StoryNodeBase {
  /** 顶层节点类型，固定为 click。 */ readonly type: 'click';
  /** 此交互所属的显式阶段。 */ readonly stageId: StoryStageId;
  /** 本次输入的明确形式。 */
  readonly interaction: StoryClickInteraction;
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

/** 可作为正文、按钮回复或选项回复的有限呈现内容。 */
export type StoryContent = StoryTalkContent | StoryNarrationContent;

/** 角色对话正文；图片仅属于 talk。 */
export interface StoryTalkContent {
  /** 内容类型，固定为角色对话。 */ readonly kind: 'talk';
  /** 正文文字。 */ readonly text: string;
  /** 可选说话人显示名。 */ readonly speaker?: string;
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

/** 正文节奏意图；不决定阶段推进或输入次数。 */
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
  | StoryEntryCardInteraction;

/** 单按钮输入；可声明按击工作量、回复和成功结果。 */
export interface StoryButtonInteraction {
  /** 交互类型，固定为单按钮。 */ readonly kind: 'button';
  /** 按钮文案。 */ readonly text: string;
  /** 可选基础与随机按击工作量。 */ readonly press?: StoryClickPress;
  /** 输入成功后可选呈现的玩家回复。 */ readonly reply?: StoryContent;
  /** 输入成功后的动作与控制流结果。 */ readonly result?: StoryNodeResult;
}

/** 单按钮所需的基础与随机按击工作量。 */
export interface StoryClickPress {
  /** 基础按击次数。 */ readonly base: number;
  /** 可选随机增量上限。 */ readonly rand?: number;
}

/** 一个 Click 内互斥的一组候选项。 */
export interface StoryChoiceInteraction {
  /** 交互类型，固定为一组互斥候选。 */ readonly kind: 'choice';
  /** 成功选择后、候选结果前执行的共同动作。 */
  readonly sharedActions?: readonly StoryAction[];
  /** 候选项；每个选项是本 Click 内独立分支。 */ readonly options: readonly StoryChoiceOption[];
}

/** 互斥选择中的单个候选项；候选项不声明独立多击。 */
export interface StoryChoiceOption {
  /** 稳定候选身份。 */ readonly id: string;
  /** 候选显示文案。 */ readonly text: string;
  /** 候选可选条件。 */ readonly condition?: ConditionGroup;
  /** 选择后可选呈现的玩家回复。 */ readonly reply?: StoryContent;
  /** 该候选的动作与控制流结果。 */ readonly result?: StoryNodeResult;
}

/** 输入成功后先执行动作，再可选执行控制流转移。 */
export interface StoryNodeResult {
  /** 输入成功后执行的动作。 */ readonly actions?: readonly StoryAction[];
  /** 动作之后可选执行的控制流转移。 */ readonly transfer?: StoryTransfer;
}

/** 以入口卡片邀请进入目标 Entry 的交互。 */
export interface StoryEntryCardInteraction {
  /** 交互类型，固定为入口卡片。 */ readonly kind: 'entryCard';
  /** 入口卡片的显示与目标声明。 */ readonly card: StoryEntryCard;
}
