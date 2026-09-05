import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { PersistedStats } from '../../engine/contracts/stats';
import type { StoryCursorSnapshot } from '../../engine/contracts/story-cursor';
import type { PlayerState } from '../types/state';
import type { TagOverrideResidue } from '../state/tag-residue';

/** AronaClicker 产品存档 DTO；数据服务只负责将其作为 JSON 文档保存。 */
export interface SaveData {
  version: string;
  timestamp: number;
  playerState: PlayerState;
  visibility: VisibilitySnapshot;
  timers?: Record<string, unknown>;
  pendingStoryId: string | null;
  pendingStoryPageIndex: number;
  pendingStoryChoiceIndex?: number;
  pendingTalkletClicks?: { total: number; done: number } | null;
  pendingStoryDefId?: string | null;
  pendingInsertStack?: { storyId: string; pageIndex: number }[];
  pendingVisitedStoryIds?: string[];
  pendingIsReplay?: boolean;
  chatCursors?: Record<string, StoryCursorSnapshot>;
  chatHistories?: Record<string, unknown[]>;
  stats?: PersistedStats;
  /** 当前 Registry 不识别的动态 Tag 覆盖；原样保留，供重新启用 mod 后复活。 */
  retained?: TagOverrideResidue;
}
