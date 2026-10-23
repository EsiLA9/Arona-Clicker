import type { ConditionGroup } from '../../../engine/types/expression';
import type { StoryClickNode, StoryContent, StoryNodeDocument, StoryTalkletNode } from '../../../data-services/contracts/story-node';
import type { StoryAction } from '../../../data-services/contracts/story-node-actions';
import type { StoryTransfer } from '../../../data-services/contracts/story-node-actions';

/** 新节点内存播放的来源身份；不代表旧Entry已入场或结算。 */
export interface StoryNodeSource {
  readonly entryId: string;
  readonly rootStoryId: string;
  readonly owner: string | null;
  /** 正式协调器分配的运行身份，用于定向演出与生命周期清理。 */
  readonly runId?: string;
  /** 跨保存恢复保持不变的逻辑播放身份；与新的演出运行身份分离。 */
  readonly historyId?: string;
}

/** 同步行为端口；applied沿用领域的上限/零增量政策，不保证数值增长或可回滚。 */
export type StoryNodeActionOutcome =
  | { readonly status: 'applied' | 'replaced' }
  | { readonly status: 'rejected'; readonly error: string };

export interface StoryNodePlaybackHost {
  evaluate(condition: ConditionGroup, visitedStoryIds: readonly string[]): boolean;
  random(): number;
  /** 纯静态引用/能力预检；动态资格按每个Action执行前的最新状态检查。 */
  preflight(action: StoryAction, source: StoryNodeSource): string | undefined;
  execute(action: StoryAction, source: StoryNodeSource): StoryNodeActionOutcome;
  /** 如重读分支守卫；在分支动作执行之前核验控制流。 */
  preflightTransfer?(transfer: StoryTransfer, source: StoryNodeSource): string | undefined;
}

/** 完整链结束的本地回执，不写旧StoryLog、不触发奖励/FollowUp。 */
export interface StoryNodeCompletion extends StoryNodeSource {
  readonly terminalStoryId: string;
}

export type StoryNodePlaybackView =
  | { readonly status: 'idle' | 'running' | 'replaced' }
  | { readonly status: 'completed'; readonly completion: StoryNodeCompletion }
  | { readonly status: 'failed'; readonly error: string }
  | { readonly status: 'delivery'; readonly token: string; readonly storyId: string; readonly sequence: number; readonly node: StoryTalkletNode }
  | {
      readonly status: 'input'; readonly token: string; readonly storyId: string; readonly node: StoryClickNode;
      readonly sequence: number;
      readonly availableOptionIds: readonly string[];
      readonly press?: { readonly total: number; readonly done: number };
    };

/** 命令回执中的有序交付事件；不是GameEvent，不发布到全局EventBus。 */
export type StoryNodePlaybackEvent =
  | { readonly type: 'view'; readonly view: StoryNodePlaybackView }
  | { readonly type: 'reply'; readonly source: StoryNodeSource; readonly storyId: string; readonly clickId: string; readonly content: StoryContent }
  | { readonly type: 'completed'; readonly completion: StoryNodeCompletion }
  | { readonly type: 'replaced'; readonly source: StoryNodeSource };

export interface StoryNodeCommandResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly view: StoryNodePlaybackView;
  readonly events: readonly StoryNodePlaybackEvent[];
}

/** 内容目录只提供新作者文档；没有旧Talklet解释或转换入口。 */
export type StoryNodeDocuments = ReadonlyMap<string, StoryNodeDocument>;
