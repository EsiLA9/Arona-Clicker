// ============================================================
// ui/flow/flow-entry.ts — 呈现条目 DTO 与投递策略（纯数据）
// 由普通 Chat / Story 与 Gameplay B Map 共用：只描述「怎么画一条流内条目」
// 与「同一逻辑内容如何回收」，不含任何剧情门控、命令或无 Host 的 DOM 行为。
// ============================================================

import type { Talklet } from '../../data-services/contracts/story';
import type { ChatEntry } from '../components/story';

/** 单条流的上限：与既有聊天流一致，先执行回收再裁剪。 */
export const FLOW_STREAM_MAX = 200;

/** 缺省策略是追加；只有显式声明且提供非空逻辑 ID 时才回收同 ID 旧条目。 */
export type FlowRepeatPolicy = 'append' | 'replaceSameId';

/** 流条目种类：Chat / Story 共用，并包含 UI 专用的 Gameplay B 地图条目。 */
export type FlowEntryKind = 'talk' | 'map' | 'narration' | 'system' | 'reward' | 'typing';

export type FlowAlign = 'center' | 'left' | 'right';
export type FlowSide = 'left' | 'right';

/**
 * 条目生命周期：
 * - `current`（缺省）：由当前状态派生，来源消失即移除，快照刷新原位更新。
 * - `observed`：本次 UI 会话观察到的历史（如最近回执），会话内保留，不由快照重建。
 */
export type FlowEntryLifecycle = 'current' | 'observed';

/** 来源身份：区分同一流内的不同业务来源，仅供诊断与协调，不参与回收。 */
export interface FlowEntrySource {
  readonly kind: string;
  readonly id?: string;
}

/**
 * 受控语义标记：只允许 `data-*`／`role`／`tabindex`／`aria-*`，
 * 由渲染器统一转义，不接受任意 HTML 或事件属性。
 * `true` 渲染为无值属性。
 */
export type FlowMarks = Readonly<Record<string, string | true>>;

/** 允许出现在条目上的标记名白名单。 */
export const FLOW_MARK_NAME = /^(?:data-[a-z0-9-]+|role|tabindex|aria-[a-z-]+)$/i;

/** 受控的流内操作；行为由宿主委托，禁止 HTML／内联事件。 */
export interface FlowAction {
  readonly label: string;
  readonly detail?: string;
  readonly disabled?: boolean;
  readonly marks: FlowMarks;
}

/** Gameplay B 地图 Talklet 专用的地点胶囊投影。 */
export interface FlowMapOverview {
  readonly mapName: string;
  readonly nodes: readonly {
    readonly title: string;
    readonly state: 'current' | 'completed' | 'visited' | 'unvisited';
    readonly stateLabel: string;
  }[];
}

/** 通用呈现字段：普通 Chat 与 Map 都以它进入同一渲染入口。 */
export interface FlowContent {
  readonly kind: FlowEntryKind;
  readonly speaker?: string;
  readonly text: string;
  /** 正文标题等级：`text` 作为标题呈现（Map 的地点／遭遇／结果标题）。 */
  readonly heading?: 1 | 2;
  /** 正文附加行：纯文本，按行渲染为段落。 */
  readonly lines?: readonly string[];
  readonly actions?: readonly FlowAction[];
  /** 仅 `kind === 'map'` 使用；不进入作者 StoryDef / Datapack Talklet。 */
  readonly mapOverview?: FlowMapOverview;
  /** 条目根元素的受控语义标记。 */
  readonly marks?: FlowMarks;
  /** 标题元素的受控语义标记（焦点锚点等）。 */
  readonly headingMarks?: FlowMarks;
  /** 是否为玩家（老师）发出的回复。 */
  readonly isPlayer?: boolean;
  /** 旁白对齐，仅 kind === 'narration' 生效。 */
  readonly align?: FlowAlign;
  readonly avatar?: string;
  /** 气泡内图片：直连 URL 或 `mod:type(pic):id` 三段式索引。 */
  readonly image?: string;
  /** talk 气泡显示侧（缺省：isPlayer ? right : left）。 */
  readonly side?: FlowSide;
  /** 不渲染圆形头像。 */
  readonly noAvatar?: boolean;
  /** 连发分组中强制完整显示头像与名称。 */
  readonly showAvatar?: boolean;
}

/** 参与投递策略的最小形状。 */
export interface FlowIdentified {
  /** 逻辑内容身份；仅用于 `replaceSameId`，为空字符串时不允许回收。 */
  readonly contentId?: string;
  /** 缺省 `append`。 */
  readonly repeatPolicy?: FlowRepeatPolicy;
}

/** 流内条目：呈现字段 + 流实例身份 + 条落实例键 + 可选逻辑身份。 */
export interface FlowEntry extends FlowContent, FlowIdentified {
  /** 所属流实例键；同一 Run 的条目共享同一 streamKey。 */
  readonly streamKey: string;
  /** 条落实例键：DOM 协调与阅读锚点使用，不承担回收语义。 */
  readonly instanceKey: string;
  readonly lifecycle?: FlowEntryLifecycle;
  readonly source?: FlowEntrySource;
}

/** 一个按 Run / 对话方隔离的流实例。 */
export interface FlowStream {
  readonly streamKey: string;
  readonly entries: FlowEntry[];
}

/** 共享 DOM 约定：宿主、流实例与条落实例键属性名。 */
export const FLOW_HOST_KEY_ATTRIBUTE = 'data-flow-host-key';
export const FLOW_STREAM_KEY_ATTRIBUTE = 'data-flow-stream-key';
export const FLOW_ENTRY_KEY_ATTRIBUTE = 'data-flow-entry-key';

/** 生成一个空流实例。 */
export function createFlowStream(streamKey: string): FlowStream {
  return { streamKey, entries: [] };
}

/** 普通 Chat 条目的实例键：数字 ID 只用于协调，不参与回收。 */
export function chatInstanceKey(id: number): string {
  return `chat:${id}`;
}

/** Map 条目的实例键：来源种类 + 来源 ID，由 Map 适配层提供稳定来源标识。 */
export function mapInstanceKey(sourceKind: string, sourceId: string): string {
  return `map:${sourceKind}:${sourceId}`;
}

/** 逻辑 ID 规范化为空字符串（用于比较与空值判定）。 */
function normalizedContentId(contentId: string | undefined): string {
  return (contentId ?? '').trim();
}

/**
 * 投递一条条目所需的策略与身份校验。
 * 非法组合在写入前就抛出，避免半写入状态被渲染或存档。
 */
export function assertFlowIdentity(entry: FlowIdentified): void {
  const policy = entry.repeatPolicy ?? 'append';
  if (policy !== 'append' && policy !== 'replaceSameId') {
    throw new Error(`FlowEntry 不支持的 repeatPolicy: ${String(policy)}`);
  }
  if (policy === 'replaceSameId' && normalizedContentId(entry.contentId) === '') {
    throw new Error('FlowEntry 的 replaceSameId 需要非空的 contentId。');
  }
}

function normalizedLimit(max: number): number {
  if (!Number.isFinite(max)) return FLOW_STREAM_MAX;
  return Math.max(0, Math.floor(max));
}

/**
 * 对一条流执行 `append` 或 `replaceSameId`，返回新数组（纯函数）。
 * 回收先于上限裁剪：被回收的旧实例不再占用上限名额。
 */
export function applyFlowEntry<T extends FlowIdentified>(
  entries: readonly T[],
  entry: T,
  max: number = FLOW_STREAM_MAX,
): T[] {
  const next = [...entries];
  applyFlowEntryInPlace(next, entry, max);
  return next;
}

/**
 * 就地版本：普通 Chat 的历史数组由 PanelState 持有，需要保持数组 identity。
 * 返回同一个数组；语义与纯函数版本完全一致。
 */
export function applyFlowEntryInPlace<T extends FlowIdentified>(
  entries: T[],
  entry: T,
  max: number = FLOW_STREAM_MAX,
): T[] {
  assertFlowIdentity(entry);
  if ((entry.repeatPolicy ?? 'append') === 'replaceSameId') {
    const contentId = normalizedContentId(entry.contentId);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (normalizedContentId(entries[index].contentId) === contentId) entries.splice(index, 1);
    }
  }
  entries.push(entry);
  const limit = normalizedLimit(max);
  const overflow = entries.length - limit;
  if (overflow > 0) entries.splice(0, overflow);
  return entries;
}

/** 向指定流实例投递，拒绝跨流写入。 */
export function deliverFlowEntry(
  stream: FlowStream,
  entry: FlowEntry,
  max: number = FLOW_STREAM_MAX,
): FlowStream {
  if (entry.streamKey !== stream.streamKey) {
    throw new Error(`FlowEntry 的 streamKey 与目标流不一致: ${entry.streamKey} !== ${stream.streamKey}`);
  }
  applyFlowEntryInPlace(stream.entries, entry, max);
  return stream;
}

/** 作者 Talklet 的投递形态：`id`／`repeatPolicy` 为投递层扩展，不写入 StoryDef。 */
export interface FlowTalkletInput extends Talklet {
  /** 逻辑内容身份（作者字段叫 `id`）；非空字符串才允许 `replaceSameId`。 */
  readonly id?: string;
  readonly repeatPolicy?: FlowRepeatPolicy;
}

/** 类型化投递入参：显式声明流实例、实例键、来源，逻辑身份原样透传。 */
export interface FlowTalkletDelivery {
  readonly streamKey: string;
  /** 条落实例键；同流内必须唯一且稳定。 */
  readonly instanceKey: string;
  readonly talklet: FlowTalkletInput;
  readonly lifecycle?: FlowEntryLifecycle;
  readonly source?: FlowEntrySource;
}

/**
 * 把带可选逻辑身份的 Talklet 形态输入适配为 FlowEntry。
 * `click` 页是纯底部按钮交互页，不进入信息流（与现有 ChatStream 行为一致）。
 * 匿名 Talklet（无 `id`／`repeatPolicy`）默认追加，仍保留合法重复。
 */
export function flowEntryFromTalklet(delivery: FlowTalkletDelivery): FlowEntry | null {
  const { talklet } = delivery;
  const kind = talklet.kind ?? 'talk';
  if (kind === 'click') return null;
  // 作者字段叫 id，FlowEntry 里叫 contentId：校验放在适配后的形状上，避免两套命名各判一次。
  assertFlowIdentity({ contentId: talklet.id, repeatPolicy: talklet.repeatPolicy });
  return {
    streamKey: delivery.streamKey,
    instanceKey: delivery.instanceKey,
    ...(talklet.id === undefined ? {} : { contentId: talklet.id }),
    ...(talklet.repeatPolicy === undefined ? {} : { repeatPolicy: talklet.repeatPolicy }),
    kind,
    ...(talklet.speaker === undefined ? {} : { speaker: talklet.speaker }),
    text: talklet.text,
    ...(talklet.align === undefined ? {} : { align: talklet.align }),
    ...(talklet.avatar === undefined ? {} : { avatar: talklet.avatar }),
    ...(talklet.image === undefined ? {} : { image: talklet.image }),
    ...(talklet.side === undefined ? {} : { side: talklet.side }),
    ...(talklet.noAvatar === undefined ? {} : { noAvatar: talklet.noAvatar }),
    ...(talklet.showAvatar === undefined ? {} : { showAvatar: talklet.showAvatar }),
    ...(delivery.lifecycle === undefined ? {} : { lifecycle: delivery.lifecycle }),
    ...(delivery.source === undefined ? {} : { source: delivery.source }),
  };
}

/** 普通 Chat 条目的呈现投影：不写 contentId／repeatPolicy，因此永不触发回收。 */
export function chatEntryToFlowContent(entry: ChatEntry): FlowContent {
  return {
    kind: entry.kind,
    ...(entry.speaker === undefined ? {} : { speaker: entry.speaker }),
    text: entry.text,
    ...(entry.isPlayer === undefined ? {} : { isPlayer: entry.isPlayer }),
    ...(entry.align === undefined ? {} : { align: entry.align }),
    ...(entry.avatar === undefined ? {} : { avatar: entry.avatar }),
    ...(entry.image === undefined ? {} : { image: entry.image }),
    ...(entry.side === undefined ? {} : { side: entry.side }),
    ...(entry.noAvatar === undefined ? {} : { noAvatar: entry.noAvatar }),
    ...(entry.showAvatar === undefined ? {} : { showAvatar: entry.showAvatar }),
  };
}

/** 普通 Chat 条目 → 流条目：实例键映射数字 ID，`storyPageKey` 仍留在原条目上。 */
export function chatEntryToFlowEntry(streamKey: string, entry: ChatEntry): FlowEntry {
  return {
    streamKey,
    instanceKey: chatInstanceKey(entry.id),
    lifecycle: 'observed',
    source: { kind: 'chat', id: String(entry.id) },
    ...chatEntryToFlowContent(entry),
  };
}
