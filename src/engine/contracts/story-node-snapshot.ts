import type { StoryRunFlags } from './story-run-flags';
import type { EffectReceipt } from './effect-receipt';
import type { Effect } from '../types/expression';

/** 已提交动作的固定结果与尚待安装的表现意图，不含独立执行游标。 */
export interface StoryNodePresentationData {
  readonly receipts: readonly EffectReceipt[];
  readonly presentation: readonly Effect[];
  readonly order: readonly ({ readonly kind: 'receipt' | 'presentation'; readonly index: number })[];
}

export type StoryNodePendingSnapshot =
  | { readonly kind: 'delivery' }
  | { readonly kind: 'input'; readonly press?: { readonly total: number; readonly done: number } }
  | { readonly kind: 'operation'; readonly data: StoryNodePresentationData }
  | { readonly kind: 'result'; readonly data: StoryNodePresentationData; readonly continuation: { readonly transfer?: { readonly mode: 'goto' | 'insert'; readonly storyId: string } } };

/** 新节点执行快照。没有旧页式游标的兼容解释。 */
export interface StoryNodeSnapshot {
  readonly format: 'story-nodes-v2';
  readonly run: {
    readonly source: { readonly entryId: string; readonly rootStoryId: string; readonly owner: string | null; readonly runId?: string; readonly historyId?: string; readonly causalChainId?: string; readonly handoffCount?: number; readonly replayId?: string; readonly isReplay?: boolean; readonly parentHistoryId?: string };
    readonly storyId: string;
    readonly nodeId: string;
    readonly waitSequence: number;
    /** 当前 Entry 局部键值表，随暂停恢复；不包含其他 Entry 或持久 flags。 */
    readonly localFlags: StoryRunFlags;
    readonly terminalStoryId: string;
    readonly transfers: number;
    readonly visited: readonly string[];
    /** nextNodeId为空表示返回到该文档末尾。 */
    readonly stack: readonly { readonly storyId: string; readonly nextNodeId: string | null }[];
    /** 结果等待点保存已提交结果与已接受续接；恢复不重新执行动作或准入。 */
    readonly pending: StoryNodePendingSnapshot;
  } | null;
}
