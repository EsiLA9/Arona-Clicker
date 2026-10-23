// ============================================================
// ui/components/tooltip-detail-map-run.ts — MapRun 场景结束条件提示
// ============================================================

import type { MapEncounterQueryView, MapRunActiveWorkspaceView } from '../../../arona-clicker/contracts/runtime/runtime';
import type { GameplayMapEffectConditionDef } from '../../../data-services/contracts/gameplay-map-effects';
import type { MapEffectLocalsState } from '../../../arona-clicker/contracts/map/map-effects';
import type { UIContext } from '../../runtime/context';

type ConditionCompletion = Extract<NonNullable<MapEncounterQueryView['completion']>, { readonly kind: 'condition' }>;

function infoRow(ctx: UIContext, label: string, value: string): string {
  return `<div class="info-row"><span>${ctx.escapeHtml(label)}</span><span>${ctx.escapeHtml(value)}</span></div>`;
}

function localValueText(ctx: UIContext, value: number | boolean | undefined): string {
  if (value === undefined) return '当前值暂不可用';
  return `当前值 ${typeof value === 'boolean' ? value ? '是' : '否' : ctx.formatNumber(value)}`;
}

function renderConditionRows(
  ctx: UIContext,
  condition: GameplayMapEffectConditionDef,
  locals: MapEffectLocalsState | undefined,
  depth = 0,
): string[] {
  const prefix = depth > 0 ? `${'　'.repeat(depth)}↳ ` : '';
  if (condition.kind === 'all' || condition.kind === 'any') {
    const label = condition.kind === 'all' ? '全部满足' : '任一满足';
    return [
      infoRow(ctx, `${prefix}条件组合`, label),
      ...condition.conditions.flatMap(child => renderConditionRows(ctx, child, locals, depth + 1)),
    ];
  }
  if (condition.kind === 'not') {
    return [
      infoRow(ctx, `${prefix}条件组合`, '以下条件不成立'),
      ...renderConditionRows(ctx, condition.condition, locals, depth + 1),
    ];
  }
  if (condition.kind === 'counter') {
    const comparison = { eq: '=', lt: '<', lte: '≤', gt: '>', gte: '≥' }[condition.comparison];
    const current = locals?.counters[condition.counterId]?.value;
    return [infoRow(ctx, `${prefix}Counter ${condition.counterId} ${comparison} ${ctx.formatNumber(condition.value)}`, localValueText(ctx, current))];
  }
  if (condition.kind === 'flag') {
    const current = locals?.flags[condition.flagId];
    return [infoRow(ctx, `${prefix}Flag ${condition.flagId} 为${condition.value ? '是' : '否'}`, localValueText(ctx, current))];
  }
  return [];
}

function renderConditionCompletion(ctx: UIContext, completion: ConditionCompletion): string[] {
  return [
    infoRow(ctx, '完成条件', completion.label),
    ...renderConditionRows(ctx, completion.condition, completion.locals),
  ];
}

function completionRows(ctx: UIContext, view: MapRunActiveWorkspaceView): string[] {
  const activity = view.activities.find(candidate => candidate.active);
  const encounter = view.currentEncounter;
  if (activity?.kind === 'shop') return [infoRow(ctx, '结束方式', '玩家选择离开商店后结束')];
  if (!encounter) return [];
  if (activity?.kind === 'battle' || encounter.enemies.length > 0) {
    return [
      infoRow(ctx, '胜利条件', '所有敌人的 HP 均为 0'),
      infoRow(ctx, '失败条件', '我方全员的 HP 均为 0'),
    ];
  }
  if (activity?.kind === 'rest' || encounter.rounds !== undefined) {
    const currentRound = encounter.round === undefined ? '未知' : ctx.formatNumber(encounter.round);
    const totalRounds = encounter.rounds === undefined ? '未知' : ctx.formatNumber(encounter.rounds);
    return [
      infoRow(ctx, '结束条件', `完成第 ${totalRounds} 回合后结束`),
      infoRow(ctx, '当前进度', `${currentRound} / ${totalRounds} 回合`),
    ];
  }
  if (encounter.completion?.kind === 'manual') {
    return [infoRow(ctx, '结束方式', `玩家手动执行「${encounter.completion.label}」`)];
  }
  if (encounter.completion?.kind === 'condition') return renderConditionCompletion(ctx, encounter.completion);
  return [infoRow(ctx, '结束条件', '当前遭遇未声明结束规则')];
}

/** Resolve the latest active MapRun view when the progress badge is hovered. */
export function renderMapSceneCompletionTooltip(ctx: UIContext, runId: string): string {
  const view = ctx.game.mapRun.getWorkspaceView(runId);
  if (!view || view.kind !== 'active') return '';
  const activity = view.activities.find(candidate => candidate.active);
  const encounter = view.currentEncounter;
  const title = activity?.title ?? encounter?.title ?? view.shop?.title;
  const rows = completionRows(ctx, view);
  if (!title && rows.length === 0) return '';
  return `<div class="info-popover">
    <div class="info-head"><span class="info-kind">MAP</span><strong>场景结束条件</strong></div>
    <div class="info-divider"></div>
    ${title ? infoRow(ctx, '当前场景', title) : ''}
    ${rows.join('')}
  </div>`;
}
