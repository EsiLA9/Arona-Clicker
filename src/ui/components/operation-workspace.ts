import type { OperationView, OperationViewActionOption, OperationViewActor } from '../../arona-clicker/contracts/operation-view';
import { CAROUSEL_SAFETY_IDS } from '../../arona-clicker/content/operation-samples/carousel-safety-ids';
import { CAROUSEL_SAFETY_PRESENTATION } from '../../arona-clicker/content/operation-samples/carousel-safety-copy';
import type { UIContext } from '../context';
import { renderWorkspaceFrame } from './workspace-frame';

const presentation = CAROUSEL_SAFETY_PRESENTATION;
const actorCopy = presentation.actors as Record<string, { name: string; role: string; description: string }>;
const actionCopy = presentation.actions as Record<string, { name: string; description: string }>;
const trackCopy = presentation.tracks as Record<string, { name: string; description: string }>;
const reasonCopy = presentation.reasons as Record<string, string>;
const capabilityCopy = presentation.abilities as Record<string, string>;

const RUNTIME_REASON_COPY: Readonly<Record<string, string>> = {
  'operation:intervention:action-not-enabled': '这个场景暂时不能使用该行动。',
  'operation:intervention:action-not-affordable': '剩余资源不够支付这项行动。',
  'operation:intervention:student-slot-occupied': '本回合已修改另一位学生的行动。',
  'operation:intervention:no-legal-target': '当前没有合适的目标。',
  'operation:intervention:plan-conflict': '这个方案与另一项行动冲突。',
  'operation:intervention:invalid-action': '这个行动当前无法执行。',
  'operation:plan:insufficient-resource': '现有资源不足，自动计划无法完成。',
  'operation:plan:no-legal-target': '当前没有合适的目标，行动暂时无法完成。',
  'operation:plan:no-enabled-action': '当前没有可用行动。',
  'operation:plan:no-candidate-action': '当前没有准备好的行动。',
  'operation:view:no-prepared-beat': '行动仍在准备，暂时无法提交。',
  'operation:run:terminal': '本次行动已经结束。',
};

function safeText(ctx: UIContext, value: string): string {
  return ctx.escapeHtml(value);
}

function actorName(actorId: string, kind?: OperationViewActor['participantKind']): string {
  return actorCopy[actorId]?.name ?? (kind === 'opponent' ? '对手' : kind === 'environment' ? '现场设施' : '学生');
}

function actorDescription(actorId: string): string {
  return actorCopy[actorId]?.description ?? '';
}

function actionName(actionId: string): string {
  if (actionId === 'operation:action:wait') return '待命';
  return actionCopy[actionId]?.name ?? '准备行动';
}

function reasonText(reasonId: string): string | undefined {
  return reasonCopy[reasonId] ?? RUNTIME_REASON_COPY[reasonId] ?? capabilityCopy[reasonId];
}

function resourceName(resourceId: string): string {
  if (resourceId === 'stamina') return '体力';
  if (resourceId === 'coordination') return '协调';
  if (resourceId === 'focus') return '专注';
  return '资源';
}

function targetName(view: OperationView, targetActorId: string | null): string {
  if (!targetActorId) return '无指定目标';
  const target = view.actorStates.find(actor => actor.id === targetActorId);
  return target ? actorName(target.id, target.participantKind) : '场景目标';
}

function describePlan(view: OperationView, actor: OperationViewActor, plan: OperationViewActor['currentPlan']): string {
  if (!plan) return '尚未生成计划';
  const action = actionName(plan.actionId);
  if (plan.kind === 'wait') return plan.reasonIds.map(reasonText).filter(Boolean).join(' ') || '等待指示';
  if (plan.kind === 'intent') return `${action} · 目标：${targetName(view, plan.targetActorId)}`;
  return `${action} · 目标：${targetName(view, plan.targetActorId)}`;
}

function displayReasons(reasonIds: readonly string[], ctx: UIContext): string {
  return reasonIds.map(reasonText).filter((value): value is string => Boolean(value))
    .map(value => `<small>${safeText(ctx, value)}</small>`).join('');
}

function costLabel(view: OperationView, actor: OperationViewActor, option: OperationViewActionOption): string {
  if (!option.cost) return '';
  const { cost } = option;
  let balance: number | undefined;
  let owner = '小组';
  if (cost.scope === 'actor') {
    balance = actor.resources[cost.resourceId];
    owner = actorName(actor.id, actor.participantKind);
  } else {
    const team = view.teamStates.find(state => state.id === actor.teamId);
    balance = team?.resources[cost.resourceId];
  }
  return `${owner} · ${resourceName(cost.resourceId)} ${cost.amount}${balance === undefined ? '' : `（现有 ${balance}）`}`;
}

function optionDisabledReasons(option: OperationViewActionOption): readonly string[] {
  return [...new Set([...option.blockedReasonIds, ...option.reasonIds.filter(id => id.startsWith('operation:'))])];
}

function renderTargets(ctx: UIContext, view: OperationView, actor: OperationViewActor, option: OperationViewActionOption, selected: boolean, disabled: boolean): string {
  if (!selected || option.legalTargetActorIds.length < 2) return '';
  const chosen = actor.currentPlan?.targetActorId ?? option.defaultTargetActorId;
  return `<span class="operation-action-targets" aria-label="选择目标">${option.legalTargetActorIds.map(targetId => `
    <button type="button" class="operation-target-choice${targetId === chosen ? ' is-selected' : ''}" data-operation-target data-actor-id="${safeText(ctx, actor.id)}" data-action-id="${safeText(ctx, option.actionId)}" data-target-actor-id="${safeText(ctx, targetId)}" aria-pressed="${String(targetId === chosen)}"${disabled ? ' disabled' : ''}>${safeText(ctx, targetName(view, targetId))}</button>`).join('')}
  </span>`;
}

function renderActionOption(ctx: UIContext, view: OperationView, actor: OperationViewActor, option: OperationViewActionOption): string {
  const plan = actor.currentPlan;
  const selected = plan?.actionId === option.actionId;
  const reasons = [...new Set([...option.missingCapabilityIds, ...optionDisabledReasons(option)])];
  const disabled = !option.selectable || view.status !== 'inProgress';
  const cost = costLabel(view, actor, option);
  const actionDescription = actionCopy[option.actionId]?.description;
  const hasReasonText = reasons.some(id => Boolean(reasonText(id)));
  const note = hasReasonText ? displayReasons(reasons, ctx) : actionDescription ? `<small>${safeText(ctx, actionDescription)}</small>` : '';
  return `<div class="operation-action-choice${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}">
    <button type="button" class="operation-action-button" data-operation-action data-actor-id="${safeText(ctx, actor.id)}" data-action-id="${safeText(ctx, option.actionId)}" aria-pressed="${String(selected)}"${disabled ? ' disabled' : ''}>
      <span class="operation-action-button__copy"><strong>${safeText(ctx, actionName(option.actionId))}</strong>${cost ? `<small class="operation-action-cost">${safeText(ctx, cost)}</small>` : ''}</span>
      <span class="operation-action-button__mark" aria-hidden="true">${selected ? '✓' : '＋'}</span>
    </button>
    ${note ? `<div class="operation-action-note">${note}</div>` : ''}
    ${renderTargets(ctx, view, actor, option, selected, disabled)}
  </div>`;
}

function renderStudentPlan(ctx: UIContext, view: OperationView, actor: OperationViewActor): string {
  const basePlan = view.basePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? null;
  const effectivePlan = view.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? actor.currentPlan;
  const changed = Boolean(basePlan && effectivePlan && (
    basePlan.actionId !== effectivePlan.actionId || basePlan.targetActorId !== effectivePlan.targetActorId
  ));
  const options = actor.profile?.actionOptions ?? [];
  const currentReason = displayReasons(effectivePlan?.reasonIds ?? [], ctx);
  const content = options.length
    ? `<div class="operation-action-list">${options.map(option => renderActionOption(ctx, view, actor, option)).join('')}</div>`
    : '<p class="operation-muted">当前没有可修改的行动。</p>';
  return `<article class="operation-student-card" data-operation-student="${safeText(ctx, actor.id)}">
    <header class="operation-student-card__header"><span class="operation-student-card__avatar" aria-hidden="true">${safeText(ctx, actorName(actor.id, actor.participantKind).slice(0, 1))}</span><span><strong>${safeText(ctx, actorName(actor.id, actor.participantKind))}</strong><small>${safeText(ctx, actorDescription(actor.id))}</small></span></header>
    <div class="operation-plan-comparison" data-operation-plan="${safeText(ctx, actor.id)}">
      <p><span>自动计划</span><strong>${safeText(ctx, describePlan(view, actor, basePlan))}</strong></p>
      ${changed ? `<p class="is-revised"><span>本回合修订</span><strong>${safeText(ctx, describePlan(view, actor, effectivePlan))}</strong></p>` : ''}
      ${currentReason}
    </div>
    ${content}
  </article>`;
}

function renderIntent(ctx: UIContext, view: OperationView, actor: OperationViewActor): string {
  const plan = actor.currentPlan;
  if (!plan || plan.kind === 'studentAction' || plan.kind === 'wait') return '';
  const reason = displayReasons(plan.reasonIds, ctx);
  return `<li class="operation-intent" data-operation-intent="${safeText(ctx, actor.id)}">
    <span class="operation-intent__kind">${actor.participantKind === 'environment' ? '设施动向' : '对手意图'}</span>
    <strong>${safeText(ctx, actorName(actor.id, actor.participantKind))}</strong>
    <span>${safeText(ctx, describePlan(view, actor, plan))}</span>${reason}
  </li>`;
}

function renderResolution(ctx: UIContext, view: OperationView): string {
  if (view.resolutions.length === 0) {
    return `<div class="operation-log-empty" data-operation-log-empty><span class="operation-log-empty__dot" aria-hidden="true"></span><p>第一回合尚未结算。先查看行动计划，再确认本回合方案。</p></div>`;
  }
  return view.resolutions.map(resolution => {
    const changes = resolution.numericChanges.flatMap(change => {
      const target = change.target;
      if (target.kind === 'track') {
        const track = trackCopy[target.trackId];
        return track ? [`${track.name} ${change.before} → ${change.after}`] : [];
      }
      if (target.kind === 'actorHp') {
        const changedActor = view.actorStates.find(actor => actor.id === target.actorId);
        return changedActor ? `${actorName(changedActor.id, changedActor.participantKind)} 状态 ${change.before} → ${change.after}` : [];
      }
      return [];
    });
    const summary = changes.length ? changes.join(' · ') : '行动已经结算，现场情况已更新。';
    return `<div class="chat-talk chat-talk-npc operation-resolution" data-operation-resolution="${resolution.resolutionSequence}">
      <span class="chat-avatar" aria-hidden="true"><span class="chat-avatar-fallback">记</span></span>
      <div class="chat-talk-main"><div class="chat-name"><span>夏莱行动记录</span><small>第 ${resolution.resolutionSequence} 回合</small></div><div class="chat-bubble chat-bubble-npc"><p>${safeText(ctx, summary)}</p></div></div>
    </div>`;
  }).join('');
}

function renderUnavailable(): string {
  return `<section class="operation-unavailable" data-operation-unavailable role="status">
    <span class="operation-unavailable__mark" aria-hidden="true">!</span>
    <div><h1>这次行动暂时无法读取</h1><p>请从夏莱办公室重新开始试玩，并确认账号已持有且解锁星野、芹香与白子。</p></div>
  </section>`;
}

function renderSidebar(ctx: UIContext, view: OperationView): string {
  const location = presentation.locations[CAROUSEL_SAFETY_IDS.location];
  const track = trackCopy[CAROUSEL_SAFETY_IDS.track];
  const value = view.tracks[CAROUSEL_SAFETY_IDS.track];
  const safe = value !== undefined && value <= presentation.event.localOutcome.safeAtOrBelow;
  const beat = Math.min(view.beatIndex + 1, presentation.event.maximumBeats);
  const studentCount = view.actorStates.filter(actor => actor.participantKind === 'student').length;
  return `<aside class="operation-sidebar" aria-label="地点与风险侧栏">
    <section class="operation-sidebar-card operation-location-card">
      <span class="operation-eyebrow">当前场所 · 游乐园</span><h2>${safeText(ctx, location.name)}</h2><p>${safeText(ctx, location.description)}</p>
    </section>
    <section class="operation-sidebar-card operation-risk-card" aria-label="设施风险">
      <div class="operation-sidebar-card__heading"><span class="operation-eyebrow">安全轨道</span><strong class="operation-risk-value${safe ? ' is-contained' : ' is-elevated'}">${value === undefined ? '—' : safeText(ctx, String(value))}</strong></div>
      <h2>${safeText(ctx, track?.name ?? '设施风险')}</h2><p>${safeText(ctx, track?.description ?? '')}</p>
      <span class="operation-risk-state${safe ? ' is-contained' : ' is-elevated'}">${safe ? '暂时稳定' : '仍需处理'}</span>
      <small>试玩目标：结束时降至 ${presentation.event.localOutcome.safeAtOrBelow} 或以下</small>
    </section>
    <section class="operation-sidebar-card operation-status-card">
      <span class="operation-eyebrow">本地试玩进度</span><strong>第 ${beat} / ${presentation.event.maximumBeats} 回合</strong>
      <span>${studentCount} 位已准入学生</span><span>本回合干预 ${view.interventionDraft ? '1' : '0'} / 1</span>
    </section>
  </aside>`;
}

function renderMain(ctx: UIContext, view: OperationView): string {
  const event = presentation.event;
  const students = view.actorStates.filter(actor => actor.participantKind === 'student');
  const intents = view.actorStates.map(actor => renderIntent(ctx, view, actor)).filter(Boolean).join('');
  const finished = view.status !== 'inProgress';
  const resultLabel = view.status === 'success' ? '行动成功' : view.status === 'partialSuccess' ? '行动部分达成' : '行动未能完成';
  const beat = Math.min(view.beatIndex + 1, event.maximumBeats);
  const blockerText = view.commitBlockedReasonIds.map(reasonText).filter((value): value is string => Boolean(value)).join(' ');
  const dockTitle = finished ? resultLabel : view.canCommit ? '本回合方案已就绪' : '还需要处理计划问题';
  const dockDescription = finished
    ? `试玩已经结算。${view.tracks[CAROUSEL_SAFETY_IDS.track] !== undefined && view.tracks[CAROUSEL_SAFETY_IDS.track] <= event.localOutcome.safeAtOrBelow ? '设施危险已降到目标范围。' : '设施风险仍高于目标范围。'}`
    : blockerText || `第 ${beat} 回合等待确认；可以调整一位学生的行动。`;
  const commitDisabled = finished || !view.canCommit;
  return `<main class="operation-chat" aria-label="行动对话与决策">
    <header class="operation-chat-heading"><span class="operation-eyebrow">夏莱行动记录 · 旋转木马安全事件</span><h1>${safeText(ctx, event.title)}</h1></header>
    <div class="operation-chat-stream" data-scroll="content-region" data-operation-log role="log" aria-live="polite" aria-relevant="additions text">
      <div class="chat-talk chat-talk-npc operation-opening-message">
        <span class="chat-avatar" aria-hidden="true"><span class="chat-avatar-fallback">安</span></span>
        <div class="chat-talk-main"><div class="chat-name"><span>游乐园安全员</span></div><div class="chat-bubble chat-bubble-npc"><p>${safeText(ctx, event.introduction)}</p></div></div>
      </div>
      <section class="operation-planning" data-operation-plans aria-label="学生行动计划">
        <div class="operation-section-heading"><span class="operation-eyebrow">学生计划 · 可修订一项</span><span class="operation-plan-version">PLAN ${safeText(ctx, String(view.planVersion))}</span></div>
        <div class="operation-student-list">${students.map(actor => renderStudentPlan(ctx, view, actor)).join('')}</div>
      </section>
      ${intents ? `<section class="operation-intents" data-operation-intents aria-label="对手与设施意图"><div class="operation-section-heading"><span class="operation-eyebrow">对手 / 设施 Intent</span></div><ul>${intents}</ul></section>` : ''}
      <section class="operation-resolution-log" data-operation-resolution-log aria-label="行动结算记录">${renderResolution(ctx, view)}</section>
    </div>
    <footer class="operation-commit-dock" data-operation-commit-dock>
      <div class="operation-commit-status" role="status"><strong>${safeText(ctx, dockTitle)}</strong><span>${safeText(ctx, dockDescription.replace(/<[^>]*>/g, ''))}</span></div>
      <button type="button" class="operation-commit-button" data-operation-commit${commitDisabled ? ' disabled' : ''}><span>${finished ? '本次试玩已结束' : `提交第 ${beat} 回合`}</span><span aria-hidden="true">→</span></button>
    </footer>
  </main>`;
}

export function renderOperationWorkspace(ctx: UIContext, view: OperationView | null): string {
  const unavailable = view ? '' : renderUnavailable();
  const sidebar = view ? renderSidebar(ctx, view) : '<aside class="operation-sidebar" aria-hidden="true"></aside>';
  const main = view ? renderMain(ctx, view) : unavailable;
  return renderWorkspaceFrame(ctx, {
    id: 'operation',
    layout: { composition: 'center-right', responsive: 'default' },
    left: {
      slot: 'left', workspaceOwner: 'operation', hostId: 'leftPanel.operation.sidebar', themeScope: 'left.operation.sidebar',
      className: 'operation-workspace__sidebar', content: sidebar, scroll: 'auto',
    },
    center: {
      slot: 'center', workspaceOwner: 'operation', hostId: 'centerPanel.operation.chat', themeScope: 'center.operation.chat',
      className: 'operation-workspace__center', content: main, scroll: 'none',
    },
    right: {
      slot: 'right', workspaceOwner: 'operation', hostId: 'rightPanel.operation.unused', visible: false,
      content: '', scroll: 'none',
    },
  });
}
