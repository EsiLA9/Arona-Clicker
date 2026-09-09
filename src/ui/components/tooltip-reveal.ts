// ============================================================
// ui/components/tooltip-reveal.ts — 信息可知系统：揭示阶段计算
// 从 tooltip.ts 拆出：RevealLevel / conditionMet / resolveRevealTriggers /
//   resolveReveal / get*Reveal（Spot/Enhancement/Init/Area/Story）
// ============================================================

import { Condition, ConditionGroup } from '../../engine/types';
import type { SpotDef, AreaDef, InitDef } from '../../data-services/contracts/world';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import type { RevealStage, RevealTrigger, RevealTarget } from '../../engine/contracts/reveal';
import type { PlayerState } from '../../arona-clicker/types/state';
import type { ConditionQueryPort } from '../../arona-clicker/contracts';
import { existenceMet, unlockCondition } from '../../engine/visibility/reveal';
import { UIContext } from '../context';
import { describeCondition } from './tooltip-enhancement';
import { buildConditionView, renderConditionTree } from '../condition-presentation';

/** 揭示求值所需的游戏只读面（conditionSystem 求值 + 只读状态）。 */
interface RevealGame {
  conditionSystem: ConditionQueryPort;
  state: Readonly<PlayerState>;
}

/**
 * 信息可知系统（Info Reveal）——可知性/可达性层级的第二层：揭示。
 * 可见性（实体是否出现）已统一由 revealTriggers 的 existence 目标承担：
 * - Hidden      ：实体不存在于界面（existence 门槛不满足，由 visibilityEngine 快照过滤）
 * - Obfuscated  ：实体可见，但未满足揭示条件，具体数值以 ??? 遮挡
 * - Revealed    ：完整展示所有字段
 * 对应 AccessStage：hidden → obfuscated → revealed。
 */
export type RevealLevel = 'hidden' | 'obfuscated' | 'revealed';

/** 单一条件的达成判定（缺省条件 = 视为达成）。原子条件与条件组均可。 */
export const conditionMet = (
  cond: Condition | ConditionGroup | undefined,
  game: RevealGame,
): boolean =>
  !cond || game.conditionSystem.evaluateExpr(cond, game.state);

/** 由揭示 Trigger 列表计算信息是否已知：无该目标的 Trigger 视为无揭示门槛（已知）；否则任一满足即揭示。 */
function resolveRevealTriggers(
  triggers: RevealTrigger[] | undefined,
  game: RevealGame,
): { nameKnown: boolean; conditionKnown: boolean; utilityKnown: boolean } {
  const met = (target: RevealTarget) => {
    const list = triggers?.filter(t => t.reveal === target) ?? [];
    if (!list.length) return true;
    return list.some(t => conditionMet(t.condition, game));
  };
  return {
    nameKnown: met('name'),
    conditionKnown: met('condition'),
    utilityKnown: met('utility'),
  };
}

/**
 * 统一揭示求值：适用于 Spot / Enhancement / Init / Area / Story 等实体。
 * 从 L0 不可见到 L6 已拥有，逐级收窄信息；可达（可购买/进入/触发）即进入 L5。
 */
export interface RevealResult {
  stage: RevealStage;
  nameKnown: boolean;
  conditionKnown: boolean;
  utilityKnown: boolean;
}

export interface RevealInput {
  owned: boolean;
  triggers?: RevealTrigger[];
  /** 可达性判定（在阶梯解析后调用）：可购买/进入/触发。 */
  isAccessible: (info: { nameKnown: boolean; conditionKnown: boolean; utilityKnown: boolean }) => boolean;
}

export function resolveReveal(ctx: UIContext, input: RevealInput): RevealResult {
  if (input.owned) return { stage: 'owned', nameKnown: true, conditionKnown: true, utilityKnown: true };
  // L0 存在性：由 revealTriggers 的 existence 目标判定（原 visibilityCondition 的职责）
  if (!existenceMet(input.triggers, cond => conditionMet(cond, ctx.game))) {
    return { stage: 'invisible', nameKnown: false, conditionKnown: false, utilityKnown: false };
  }
  const info = resolveRevealTriggers(input.triggers, ctx.game);
  if (input.isAccessible(info)) {
    return { stage: 'purchaseable', nameKnown: true, conditionKnown: true, utilityKnown: true };
  }
  if (info.nameKnown && info.conditionKnown && info.utilityKnown) return { stage: 'utility', ...info };
  if (info.nameKnown && info.conditionKnown) return { stage: 'known', ...info };
  if (info.nameKnown || info.conditionKnown) return { stage: 'partial', ...info };
  return { stage: 'presence', ...info };
}

/** Enhancement 揭示：解锁条件满足即可购买（L5）。 */
export function getEnhancementReveal(ctx: UIContext, enh: EnhancementDef): RevealResult {
  const { view } = ctx;
  return resolveReveal(ctx, {
    owned: view.unlockedEnhancements.includes(enh.id),
    triggers: enh.revealTriggers,
    isAccessible: () => conditionMet(unlockCondition(enh.revealTriggers), ctx.game),
  });
}

/** Spot 揭示：可购买须先揭示信息（无阶梯时兼容：可见即可购）。 */
export function getSpotReveal(ctx: UIContext, spot: SpotDef): RevealResult {
  const { view } = ctx;
  return resolveReveal(ctx, {
    owned: (view.spotLevels[spot.id] ?? 0) > 0,
    triggers: spot.revealTriggers,
    isAccessible: info => !spot.revealTriggers?.length || (info.nameKnown && info.utilityKnown),
  });
}

/** Init 揭示：已解锁视为已拥有。 */
export function getInitReveal(ctx: UIContext, init: InitDef): RevealResult {
  const { view } = ctx;
  const unlocked = view.unlockedInits.includes(init.id);
  return resolveReveal(ctx, {
    owned: unlocked,
    triggers: init.revealTriggers,
    /** 可购买判定：已解锁或免费，或当前资源足够支付购买费用。 */
    isAccessible: () => {
      if (unlocked) return true;
      const cost = init.purchaseCost;
      if (!cost || cost.length === 0) return true;
      return cost.every(c => (view.resources[c.resourceId] ?? 0) >= c.amount);
    },
  });
}

/** Area 揭示：已访问视为已拥有。 */
export function getAreaReveal(ctx: UIContext, area: AreaDef): RevealResult {
  const { view } = ctx;
  const visited = (view.visitedAreas ?? []).includes(area.id);
  return resolveReveal(ctx, {
    owned: visited,
    triggers: area.revealTriggers,
    isAccessible: () => visited,
  });
}

/** Story 揭示：入口已完成视为已拥有；可触发（条件满足、未完成且知晓名称）视为可达。 */
export function getStoryReveal(ctx: UIContext, entry: StoryEntryDef): RevealResult {
  const { view } = ctx;
  // 完成判定统一按 Story.id 记（storyLog / completedStoryIdsThisRun）
  const completed = view.storyLog.some(s => s.storyId === entry.storyId);
  return resolveReveal(ctx, {
    owned: completed,
    triggers: entry.revealTriggers,
    isAccessible: info =>
      !completed && conditionMet(entry.triggerCondition, ctx.game) && info.nameKnown,
  });
}

/** 占位符，用于遮挡未揭示的数值。 */
export const OBFUSCATED = '???';

/** revealTriggers 各揭示目标的中文标签。 */
export const REVEAL_TARGET_LABEL: Record<RevealTarget, string> = {
  existence: '实体出现',
  name: '名称',
  condition: '解锁条件',
  utility: '效用',
  unlock: '自动解锁',
};

/**
 * 揭示 Trigger 表：列出实体自身全部 revealTriggers（目标 + 条件）。
 * - 目标标签常显（玩家可见"需要揭示哪些信息块"）；
 * - 条件文本仅在该 Trigger 条件已满足（或实体已 owned，allKnown）时展示，
 *   否则以 ??? 遮挡，尊重信息揭示阶梯；
 * - 带 已满足/未满足 标记。
 */
export function renderRevealTriggers(
  ctx: UIContext,
  triggers: RevealTrigger[] | undefined,
  allKnown = false,
): string {
  if (!triggers || triggers.length === 0) return '';
  const rows = triggers.map(t => {
    const label = REVEAL_TARGET_LABEL[t.reveal] ?? t.reveal;
    const met = allKnown || conditionMet(t.condition, ctx.game);
    const tree = buildConditionView(t.condition, {
      nameOf: ctx.nameOf, formatNumber: ctx.formatNumber, style: 'ui',
      evaluate: condition => conditionMet(condition, ctx.game),
    });
    const text = renderConditionTree(tree, ctx.escapeHtml, met);
    const mark = met ? '已满足' : '未满足';
    return `
      <div class="info-row condition-trigger-status">
        <span>${label}</span>
        <span class="${met ? 'info-accent' : 'info-dim'}">${mark}</span>
      </div>
      <div class="condition-trigger-tree">${text}</div>`;
  });
  return `
    <div class="info-divider"></div>
    <div class="info-sub">揭示 Trigger</div>
    ${rows.join('')}`;
}
