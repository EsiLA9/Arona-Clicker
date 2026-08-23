// ============================================================
// engine/game/passive-picker.ts — 被动闲聊候选筛 + 权重抽选
//
// 从 story-service 拆出的纯逻辑：给定候选入口与过滤谓词，按 weight
// 抽选一条被动闲聊。选择与调度解耦，便于单测与复用。
// ============================================================

import type { PassiveStoryEntry } from '../types';

/** 参与加权抽选/筛除的条目仅需提供 weight（实际即被动闲聊入口）。 */
interface Weighted {
  weight: number;
}

/** 逐个应用过滤谓词，返回仍合格的被动闲聊候选。 */
export function eligiblePassiveStories(
  entries: readonly PassiveStoryEntry[],
  filter: (entry: PassiveStoryEntry) => boolean,
): PassiveStoryEntry[] {
  return entries.filter(filter);
}

/** 在候选列表中按 weight 加权随机抽选一条；无候选返回 undefined。 */
export function pickPassiveStory<T extends Weighted>(candidates: readonly T[]): T | undefined {
  if (candidates.length === 0) return undefined;
  const totalWeight = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll < 0) {
      selected = candidate;
      break;
    }
  }
  return selected;
}