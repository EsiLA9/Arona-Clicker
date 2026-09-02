// ============================================================
// ui/components/errors.ts — 游戏操作错误码 → 用户可读中文文案
// ============================================================

import type { EnhancementPurchaseError, TravelError } from '../../arona-clicker/contracts/results';

// --- Enhancement 购买错误 ---
export const enhPurchaseErrorText: Record<EnhancementPurchaseError, string> = {
  NotFound: '强化不存在',
  NotVisible: '尚未解锁',
  ConditionNotMet: '条件未满足',
  InsufficientResource: '资源不足',
  AlreadyOwned: '已拥有',
};

// --- 区域移动错误 ---
export const travelErrorText: Record<TravelError, string> = {
  NotFound: '区域不存在',
  NotInThisInit: '不在当前世界线',
  NotAdjacent: '未相邻',
  AlreadyThere: '已在当前区域',
  Locked: '区域未解锁',
  StoryBlocked: '剧情进行中，无法移动',
};

// --- 物品使用错误 ---
export const itemUseErrorText: Record<string, string> = {
  NotFound: '物品不存在',
  NotOwned: '未拥有',
  NotUsable: '不可使用',
  ConditionNotMet: '使用条件未满足',
};

// --- Spot 解锁/升级反馈 ---
export const spotUpgradeFeedback: Record<string, string> = {
  notFound: '设施不存在',
  alreadyOwned: '已拥有',
  notVisible: '尚未可见',
  insufficientResource: '资源不足',
  maxLevel: '已达最高等级',
};
