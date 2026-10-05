import type { OperationView, OperationViewActionOption, OperationViewActor, OperationViewSceneAction } from '../../arona-clicker/contracts/operation-view';
import { CAROUSEL_SAFETY_IDS } from '../../arona-clicker/content/operation-samples/carousel-safety-ids';
import { CAROUSEL_SCENE_ACTION_IDS as SCENE } from '../../arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SAFETY_PRESENTATION } from '../../arona-clicker/content/operation-samples/carousel-safety-copy';
import { GAMEPLAY_B_PRESENTATION as COPY } from '../../arona-clicker/content/operation-samples/gameplay-b-presentation';
import type { UIContext } from '../context';
import { renderWorkspaceFrame } from './workspace-frame';

const ACTIONS = CAROUSEL_SAFETY_PRESENTATION.actions as Record<string, { name: string; description: string }>;
const REASONS = CAROUSEL_SAFETY_PRESENTATION.reasons as Record<string, string>;
const ABILITIES = CAROUSEL_SAFETY_PRESENTATION.abilities as Record<string, string>;
const TRACKS = COPY.tracks as Record<string, { name: string; description: string }>;
const ACTORS = COPY.actors as Record<string, { role: string; description: string }>;
const LOCATIONS = COPY.locations as Record<string, { name: string; description: string }>;
const SCENE_NAMES = COPY.sceneActions as Record<string, string>;
const CARDS = COPY.playerCards as Record<string, string>;
const MAX_COST_SLOTS = 5;

function e(ctx: UIContext, value: unknown): string {
  return ctx.escapeHtml(String(value ?? ''));
}

function actorLabel(actor: OperationViewActor): string {
  return actor.displayName || (actor.participantKind === 'opponent' ? '对手' : actor.participantKind === 'environment' ? '现场设施' : '学生');
}

function actionLabel(actionId: string): string {
  return actionId === 'operation:action:wait' ? '待命' : ACTIONS[actionId]?.name ?? '准备行动';
}

function planLabel(actor: OperationViewActor, view: OperationView): string {
  const plan = actor.currentPlan;
  if (!plan) return '尚未生成计划';
  const name = actionLabel(plan.actionId);
  const target = plan.targetActorId ? view.actorStates.find(item => item.id === plan.targetActorId)?.displayName ?? '场景目标' : null;
  if (plan.kind === 'wait') return plan.reasonIds.map(id => REASONS[id]).filter(Boolean).join(' ') || '等待指示';
  return target ? name + ' · 目标：' + target : name;
}

function optionReasons(option: OperationViewActionOption): string[] {
  return [...new Set([...option.missingCapabilityIds, ...option.blockedReasonIds, ...option.reasonIds.filter(id => id.startsWith('operation:'))])];
}

function targetName(view: OperationView, targetActorId: string): string {
  return view.actorStates.find(actor => actor.id === targetActorId)?.displayName ?? '场景目标';
}

const operationSceneDrafts = new Map<string, OperationSceneDraft>();

export interface OperationSceneDraft {
  readonly selections: readonly { readonly sceneActionId: string; readonly actorId: string; readonly targetActorIds: readonly string[] }[];
  readonly cards: readonly { readonly cardInstanceId: string; readonly actorId: string; readonly targetActorIds: readonly string[] }[];
}

function sceneDraftKey(runId: string, planVersion: number, locationId: string): string {
  return `${runId}\u0000${planVersion}\u0000${locationId}`;
}

export function saveOperationSceneDraft(runId: string, planVersion: number, locationId: string, draft: OperationSceneDraft): void {
  const key = sceneDraftKey(runId, planVersion, locationId);
  for (const oldKey of operationSceneDrafts.keys()) if (oldKey.startsWith(`${runId}\u0000`) || operationSceneDrafts.size >= 8) operationSceneDrafts.delete(oldKey);
  operationSceneDrafts.set(key, draft);
}

export function readOperationSceneDraft(runId: string, planVersion: number, locationId: string): OperationSceneDraft | undefined {
  const key = sceneDraftKey(runId, planVersion, locationId);
  for (const oldKey of operationSceneDrafts.keys()) if (oldKey.startsWith(`${runId}\u0000`) && oldKey !== key) operationSceneDrafts.delete(oldKey);
  return operationSceneDrafts.get(key);
}

function renderSceneActionCard(ctx: UIContext, view: OperationView, actorId: string, actions: OperationViewSceneAction[], chosen: OperationViewSceneAction | undefined): string {
  if (!chosen) return '<section class="operation-scene-card is-empty" data-operation-scene-card data-actor-id="' + e(ctx, actorId) + '"><strong>暂无可用行动</strong></section>';
  const draft = readOperationSceneDraft(view.runId, view.planVersion, view.currentLocationId);
  const saved = draft?.selections.find(selection => selection.actorId === actorId);
  const selected = saved ? actions.find(action => action.id === saved.sceneActionId) ?? chosen : chosen;
  const actionButton = (action: OperationViewSceneAction, isSelected: boolean) => '<button type="button" class="operation-scene-action' + (isSelected ? ' is-selected' : '') + '" data-operation-scene-choice data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-player-cost="' + action.playerCost + '" data-actor-id="' + e(ctx, actorId) + '" data-scene-action-id="' + e(ctx, action.id) + '" aria-pressed="' + String(isSelected) + '"><span><strong>' + e(ctx, SCENE_NAMES[action.id] ?? action.id) + '</strong><small>' + action.playerCost + ' Cost</small></span>' + (isSelected ? '✓' : '选择') + '</button>';
  const actionOption = (action: OperationViewSceneAction, isSelected: boolean) => {
    const targets = actionTargets(action, actorId);
    const selectedTargetIds = saved?.sceneActionId === action.id ? saved.targetActorIds : view.currentActionMode === 'global' ? targets : targets.slice(0, 1);
    const targetButtons = targets.length > 1 ? '<div class="operation-scene-targets" data-target-mode="' + e(ctx, view.currentActionMode ?? 'individual') + '" aria-label="选择场景目标">' + targets.map(targetId =>
      '<button type="button" data-operation-scene-target data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-target-actor-id="' + e(ctx, targetId) + '" aria-pressed="' + String(selectedTargetIds.includes(targetId)) + '">' + e(ctx, targetName(view, targetId)) + '</button>',
    ).join('') + '</div>' : '';
    return '<div class="operation-scene-option' + (isSelected ? ' is-selected' : '') + '" data-operation-scene-option>' + actionButton(action, isSelected) + targetButtons + '</div>';
  };
  return '<section class="operation-scene-card" data-operation-scene-card data-actor-id="' + e(ctx, actorId) + '"><div class="operation-scene-card__current"><span class="operation-eyebrow">本批行动</span>' + actionOption(selected, true) + '</div>' +
    (actions.length > 1 ? '<details class="operation-scene-alternatives"><summary>更改行动</summary><div>' + actions.filter(action => action.id !== selected.id).map(action => actionOption(action, false)).join('') + '</div></details>' : '') + '</section>';
}

function renderIndividualSceneCard(ctx: UIContext, view: OperationView, actor: OperationViewActor, index: number): string {
  const actions = view.currentSceneActions.filter(action => action.scope === 'individual' && action.eligibleActorIds.includes(actor.id));
  const chosen = actions[Math.min(index, Math.max(actions.length - 1, 0))];
  return renderSceneActionCard(ctx, view, actor.id, actions, chosen);
}

function renderAction(ctx: UIContext, view: OperationView, actor: OperationViewActor, option: OperationViewActionOption): string {
  const selected = actor.currentPlan?.actionId === option.actionId;
  const disabled = !option.selectable || view.status !== 'inProgress' || Boolean(view.locationProgress[view.currentLocationId]?.completed);
  const reasonText = optionReasons(option).map(id => REASONS[id] ?? ABILITIES[id]).filter(Boolean).join(' ');
  const actionCopy = ACTIONS[option.actionId]?.description ?? '';
  const cost = option.cost
    ? (option.cost.scope === 'actor' ? actorLabel(actor) : '小组') + ' · ' + (option.cost.resourceId === 'stamina' ? '体力' : option.cost.resourceId === 'coordination' ? '协调' : '专注') + ' ' + option.cost.amount
    : '';
  const targets = selected && option.legalTargetActorIds.length > 1
    ? '<div class="operation-action-targets">' + option.legalTargetActorIds.map(targetId =>
      '<button type="button" class="operation-target-choice' + (targetId === (actor.currentPlan?.targetActorId ?? option.defaultTargetActorId) ? ' is-selected' : '') +
      '" data-operation-target data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) +
      '" data-actor-id="' + e(ctx, actor.id) + '" data-action-id="' + e(ctx, option.actionId) + '" data-target-actor-id="' + e(ctx, targetId) +
      '" aria-pressed="' + String(targetId === (actor.currentPlan?.targetActorId ?? option.defaultTargetActorId)) + '"' + (disabled ? ' disabled' : '') + '>' +
      e(ctx, targetName(view, targetId)) + '</button>').join('') + '</div>'
    : '';
  return '<article class="operation-action-choice' + (selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '') + '" data-operation-action-card="' + e(ctx, option.actionId) + '">' +
    '<button type="button" class="operation-action-button" data-operation-action data-run-id="' + e(ctx, view.runId) +
    '" data-plan-version="' + e(ctx, view.planVersion) + '" data-actor-id="' + e(ctx, actor.id) + '" data-action-id="' + e(ctx, option.actionId) +
    '" data-default-target-actor-id="' + e(ctx, option.defaultTargetActorId ?? '') + '" aria-pressed="' + String(selected) + '"' + (disabled ? ' disabled' : '') + '>' +
    '<span><strong>' + e(ctx, actionLabel(option.actionId)) + '</strong>' + (cost ? '<small>' + e(ctx, cost) + '</small>' : '') + '</span><span aria-hidden="true">' + (selected ? '✓' : '＋') + '</span></button>' +
    ((reasonText || actionCopy) ? '<p class="operation-action-note">' + e(ctx, reasonText || actionCopy) + '</p>' : '') + targets + '</article>';
}

function renderStudent(ctx: UIContext, view: OperationView, actor: OperationViewActor, battle: boolean, studentIndex: number): string {
  const basePlan = view.basePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? null;
  const activePlan = view.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? actor.currentPlan;
  const changed = Boolean(basePlan && activePlan && (basePlan.actionId !== activePlan.actionId || basePlan.targetActorId !== activePlan.targetActorId));
  const name = actorLabel(actor);
  const avatar = actor.avatarRef
    ? '<img src="' + e(ctx, actor.avatarRef) + '" alt="" loading="lazy">'
    : e(ctx, name.slice(0, 1));
  const options = actor.profile?.actionOptions ?? [];
  const reasonMarkup = (activePlan?.reasonIds ?? []).map(id => REASONS[id] ?? ABILITIES[id]).filter(Boolean).map(text => '<small>' + e(ctx, text) + '</small>').join('');
  const clear = view.interventionDraft?.actorId === actor.id
    ? '<button type="button" class="operation-clear-intervention" data-operation-clear data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-actor-id="' + e(ctx, actor.id) + '">取消修订</button>'
    : '';
  const actionCards = battle
    ? '<details class="operation-action-disclosure" data-operation-action-disclosure data-operation-action-list="' + e(ctx, actor.id) + '"><summary>更改行动 · ' + options.length + ' 项可选</summary><div class="operation-action-list">' +
      options.map(option => renderAction(ctx, view, actor, option)).join('') + '</div></details>'
    : view.currentActionMode === 'individual' && view.sceneActionBatchesRemaining > 0 && !view.pendingSceneActionBatch
      ? renderIndividualSceneCard(ctx, view, actor, studentIndex)
      : '<p class="operation-muted">当前行动计划</p>';
  return '<article class="operation-student-card" data-operation-student="' + e(ctx, actor.id) + '">' +
    '<header class="operation-student-card__header"><span class="operation-student-card__avatar" aria-hidden="true">' + avatar + '</span><span><strong>' + e(ctx, name) + '</strong><small>' + e(ctx, ACTORS[actor.id]?.description ?? '行动队员') + '</small></span></header>' +
    '<section class="operation-attached-plan" data-operation-plan="' + e(ctx, actor.id) + '"><span class="operation-plan-label">' + (changed ? '本回合修订' : '当前计划') + '</span><strong>' + e(ctx, planLabel(actor, view)) + '</strong>' +
    (changed && basePlan ? '<small>自动计划：' + e(ctx, actionLabel(basePlan.actionId)) + '</small>' : '') + reasonMarkup + '</section>' + clear + actionCards + '</article>';
}

function renderOpponents(ctx: UIContext, view: OperationView): string {
  const opponents = view.actorStates.filter(actor => actor.participantKind === 'opponent');
  const environment = view.actorStates.filter(actor => actor.participantKind === 'environment');
  const intent = (actor: OperationViewActor) => actor.currentPlan?.kind === 'intent'
    ? '<section class="operation-intent" data-operation-intent="' + e(ctx, actor.id) + '"><span>' + (actor.participantKind === 'environment' ? '设施动向' : '对手意图') + '</span><strong>' + e(ctx, planLabel(actor, view)) + '</strong></section>'
    : '<p class="operation-muted">当前没有公开意图。</p>';
  return '<aside class="operation-opponent-column" aria-label="敌方与现场">' +
    '<section class="operation-actor-group" data-operation-opponents><header class="operation-column-heading"><span class="operation-eyebrow">敌方</span><strong>' + opponents.length + ' 名</strong></header>' +
    opponents.map(actor => '<article class="operation-opponent-card" data-operation-opponent="' + e(ctx, actor.id) + '">' +
      '<header class="operation-opponent-card__header"><span class="operation-opponent-card__avatar">' + e(ctx, actor.displayName.slice(0, 1)) + '</span><span><strong>' + e(ctx, actorLabel(actor)) + '</strong><small>' + e(ctx, ACTORS[actor.id]?.role ?? '行动者') + '</small></span></header>' +
      intent(actor) + '<div class="operation-hp"><span>状态</span><strong>' + actor.hp + ' / ' + actor.maxHp + '</strong></div></article>').join('') + '</section>' +
    '<section class="operation-actor-group operation-environment-group" data-operation-environment><header class="operation-column-heading"><span class="operation-eyebrow">场景 / 设施</span><strong>' + environment.length + ' 项</strong></header>' +
    environment.map(actor => '<article class="operation-environment-card" data-operation-environment-actor="' + e(ctx, actor.id) + '"><strong>' + e(ctx, actorLabel(actor)) + '</strong><p>' + e(ctx, ACTORS[actor.id]?.description ?? '现场环境状态') + '</p>' + intent(actor) + '</article>').join('') +
    '</section></aside>';
}

function renderProgress(ctx: UIContext, view: OperationView): string {
  const location = LOCATIONS[view.currentLocationId];
  const tracks = Object.entries(view.tracks).map(([id, value]) => '<div class="operation-track" data-operation-track="' + e(ctx, id) + '"><span>' +
    e(ctx, TRACKS[id]?.name ?? '现场状态') + '</span><strong>' + e(ctx, value) + '</strong><small>' + e(ctx, TRACKS[id]?.description ?? '') + '</small></div>').join('');
  const objectives = view.objectives.map(objective => '<li class="' + (objective.achieved ? 'is-achieved' : '') + '" data-operation-objective="' + e(ctx, objective.id) + '">' +
    '<span aria-hidden="true">' + (objective.achieved ? '✓' : '○') + '</span><span>' + e(ctx, objective.description) + '</span></li>').join('');
  const currentFacts = view.knownFactIds.includes(SCENE.fact) ? '<span>当前已知：控制台已检查</span>' : '';
  const heldItems = view.heldItemIds.includes(SCENE.item) ? '<span>当前持有：' + e(ctx, COPY.itemName) + '</span>' : '';
  const facts = currentFacts || heldItems ? '<div class="operation-current-items" aria-label="当前行动状态">' + currentFacts + heldItems + '</div>' : '';
  return '<section class="operation-context-card" data-operation-location="' + e(ctx, view.currentLocationId) + '">' +
    '<span class="operation-eyebrow">游乐园 · 当前场所</span><h2>' + e(ctx, location?.name ?? '行动现场') + '</h2><p>' + e(ctx, location?.description ?? '') + '</p>' +
    '<div class="operation-track-list">' + tracks + '</div><ul class="operation-objectives" aria-label="行动目标">' + objectives + '</ul>' + facts + '</section>';
}

function actionTargets(action: OperationViewSceneAction, actorId: string): string[] {
  return [...(action.legalTargetActorIdsByActorId[actorId] ?? [])];
}

function renderSceneControls(ctx: UIContext, view: OperationView): string {
  if (!view.currentActionMode || view.sceneActionBatchesRemaining < 1 || view.pendingSceneActionBatch) return '';
  const actions = view.currentSceneActions.filter(action => action.scope === view.currentActionMode);
  const students = view.actorStates.filter(actor => actor.participantKind === 'student' && actor.hp > 0);
  const draft = readOperationSceneDraft(view.runId, view.planVersion, view.currentLocationId);
  let controls = '';
  if (view.currentActionMode === 'global') {
    const eligibleActions = actions.filter(action => action.eligibleActorIds.length > 0);
    const chosen = eligibleActions[0];
    const performers = chosen?.eligibleActorIds ?? [];
    const performerButtons = (action: OperationViewSceneAction, selectedActorId: string) => action.eligibleActorIds.map(actorId => {
      const actor = view.actorStates.find(row => row.id === actorId);
      return '<button type="button" data-operation-scene-performer data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-actor-id="' + e(ctx, actorId) + '" aria-pressed="' + String(actorId === selectedActorId) + '">' + e(ctx, actor?.displayName ?? '学生') + '</button>';
    }).join('');
    const saved = draft?.selections[0];
    const selectedAction = eligibleActions.find(action => action.id === saved?.sceneActionId) ?? chosen;
    const selectedActor = selectedAction?.eligibleActorIds.includes(saved?.actorId ?? '') ? saved!.actorId : selectedAction?.eligibleActorIds[0] ?? '';
    controls = selectedAction
      ? '<section class="operation-scene-card operation-scene-card--global" data-operation-scene-card data-global-scene-card><span class="operation-eyebrow">全队共同行动</span>' +
        renderSceneActionCard(ctx, view, selectedActor, eligibleActions, selectedAction) +
        '<div class="operation-scene-performers" aria-label="选择执行者">' + performerButtons(selectedAction, selectedActor) + '</div></section>'
      : '<p class="operation-muted">当前没有可执行的全队行动。</p>';
  }
  const hand = view.playerCards.hand.length ? '<section class="operation-hand" data-operation-player-hand aria-label="玩家场景手牌"><header><strong>玩家手牌</strong><span>' +
    view.playerCards.hand.length + ' 张 · 抽牌堆 ' + view.playerCards.drawPileCount + '</span></header>' + view.playerCards.hand.map(card => {
      const performers = card.eligibleActorIds;
      const label = CARDS[card.actionId] ?? (ACTIONS[card.actionId]?.name ?? '场景卡');
      const selected = draft?.cards.find(item => item.cardInstanceId === card.cardInstanceId);
      const selectedActorId = performers.includes(selected?.actorId ?? '') ? selected!.actorId : performers[0] ?? '';
      const performerButtons = performers.map(actorId => {
        const actor = view.actorStates.find(row => row.id === actorId);
        return '<button type="button" data-operation-card-actor data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-actor-id="' + e(ctx, actorId) + '" aria-pressed="' + String(actorId === (selected?.actorId ?? performers[0])) + '">' + e(ctx, actor?.displayName ?? '学生') + '</button>';
      }).join('');
      const targetIds = card.legalTargetActorIdsByActorId[selectedActorId] ?? [];
      const selectedTargetIds = selected?.targetActorIds ?? targetIds.slice(0, 1);
      const targetButtons = performers.map(actorId => {
        const actorTargets = card.legalTargetActorIdsByActorId[actorId] ?? [];
        const actorSelectedTargets = selected?.actorId === actorId ? selected.targetActorIds : view.currentActionMode === 'global' ? actorTargets : actorTargets.slice(0, 1);
        return actorTargets.length ? '<div class="operation-card-targets" data-operation-card-targets-for="' + e(ctx, actorId) + '" data-target-mode="' + e(ctx, view.currentActionMode ?? 'individual') + '" aria-label="选择卡牌目标"' + (actorId === selectedActorId ? '' : ' hidden') + '>' + actorTargets.map(targetId =>
          '<button type="button" data-operation-card-target data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-target-actor-id="' + e(ctx, targetId) + '" aria-pressed="' + String(actorSelectedTargets.includes(targetId)) + '">' + e(ctx, targetName(view, targetId)) + '</button>',
        ).join('') + '</div>' : '';
      }).join('');
      return '<article class="operation-player-card' + (selected ? ' is-selected' : '') + '" data-operation-player-card="' + e(ctx, card.cardInstanceId) + '"><button type="button" class="operation-player-card__toggle" data-operation-card-toggle data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-player-cost="' + card.playerCost + '" aria-pressed="' + String(Boolean(selected)) + '"><span><strong>' + e(ctx, label) + '</strong><small>场景卡 · ' + card.playerCost + ' Cost</small></span><span>' + (selected ? '已选择' : '加入本批') + '</span></button><div class="operation-card-performers" aria-label="选择卡牌执行者">' + performerButtons + '</div>' + targetButtons + '</article>';
    }).join('') + '<small class="operation-hand-note">打出的牌进入弃牌堆，本次行动不会洗回。</small></section>' :
    '<section class="operation-hand is-empty" data-operation-player-hand><strong>玩家手牌</strong><span>手牌 0 张 · 抽牌堆 ' + view.playerCards.drawPileCount + ' · 弃牌堆 ' + view.playerCards.discardCount + '</span></section>';
  const plannedSceneCost = view.currentActionMode === 'individual'
    ? students.reduce((total, actor, index) => {
      const saved = draft?.selections.find(selection => selection.actorId === actor.id);
      const selected = actions.find(action => action.id === saved?.sceneActionId) ?? actions[Math.min(index, Math.max(actions.length - 1, 0))];
      return total + (selected?.playerCost ?? 0);
    }, 0)
    : (() => {
      const saved = draft?.selections[0];
      const selected = actions.find(action => action.id === saved?.sceneActionId) ?? actions[0];
      return selected?.playerCost ?? 0;
    })();
  const plannedCardCost = draft?.cards.reduce((total, selection) => {
    const card = view.playerCards.hand.find(item => item.cardInstanceId === selection.cardInstanceId);
    return total + (card?.playerCost ?? 0);
  }, 0) ?? 0;
  const estimatedCost = plannedSceneCost + plannedCardCost;
  const deficit = Math.max(0, estimatedCost - view.playerCost);
  return '<section class="operation-scene-actions" data-operation-scene-actions aria-label="场景行动"><header class="operation-section-heading"><span class="operation-eyebrow">' +
    (view.currentActionMode === 'individual' ? '行动附在学生卡上' : '全队共同选择') + '</span><span>剩余批次 ' + view.sceneActionBatchesRemaining +
    '</span></header>' + (controls ? '<div class="operation-scene-selections">' + controls + '</div>' : '') + hand +
    '<p class="operation-cost-hint" data-operation-cost-preview data-player-cost="' + view.playerCost + '">本批预计 ' + estimatedCost + ' Cost · 余额 ' + view.playerCost + (deficit ? ' · 超出 ' + deficit : ' · 余额足够') + '。确认整批行动时统一扣除费用。</p></section>';
}

function renderPending(ctx: UIContext, view: OperationView): string {
  const draft = view.pendingSceneActionBatch;
  if (!draft) return '';
  const labels = draft.preview.selections.map(selection => {
    const actor = view.actorStates.find(row => row.id === selection.actorId);
    return (actor?.displayName ?? '学生') + '：' + (SCENE_NAMES[selection.sceneActionId] ?? selection.sceneActionId);
  });
  labels.push(...draft.preview.cards.map(card => CARDS[card.actionId] ?? ACTIONS[card.actionId]?.name ?? '玩家场景卡'));
  return '<section class="operation-pending-batch" data-operation-pending-batch><strong>待确认：' + e(ctx, labels.join('、')) +
    '</strong><span>本批次将支付 ' + draft.preview.cost.totalCost + ' Cost。</span></section>';
}

function renderRoutes(ctx: UIContext, view: OperationView): string {
  if (!view.currentRoutes.length) return '';
  const lockText = (reason: string | null): string => {
    if (reason === 'operation:route:location-incomplete') return '先完成当前地点目标。';
    if (reason === 'operation:route:max-visits-reached') return '本次行动已达到地点访问上限。';
    if (reason === 'operation:route:required-held-item-missing') return '需要持有对应物品才能通过。';
    return reason ? '路线暂不可用。' : '';
  };
  return '<section class="operation-route-choices" data-operation-routes aria-label="路线选择"><header><span class="operation-eyebrow">下一站</span><strong>选择离开方式</strong></header>' +
    view.currentRoutes.map(route => '<article class="operation-route-card" data-operation-route-card="' + e(ctx, route.routeId) + '"><div><strong>' + e(ctx, route.label) + '</strong><p>' +
      e(ctx, route.description) + '</p>' + (route.lockedReason ? '<small>' + e(ctx, lockText(route.lockedReason)) + '</small>' : '') + '</div><button type="button" data-operation-route data-run-id="' +
      e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-route-id="' + e(ctx, route.routeId) + '"' + (route.available ? '' : ' disabled') +
      '>' + (route.available ? '前往' : '尚未开放') + '</button></article>').join('') + '</section>';
}

function renderResolutions(ctx: UIContext, view: OperationView): string {
  if (!view.resolutions.length) return '';
  const actorName = (id: string) => view.actorStates.find(actor => actor.id === id)?.displayName ?? '行动者';
  const valueLabel = (change: OperationView['resolutions'][number]['numericChanges'][number]): string => {
    const target = change.target;
    if (target.kind === 'track') return (TRACKS[target.trackId]?.name ?? '现场状态') + ' ' + change.before + ' → ' + change.after;
    if (target.kind === 'actorHp') return actorName(target.actorId) + ' 状态 ' + change.before + ' → ' + change.after;
    const resource = target.resourceId === 'stamina' ? '体力' : target.resourceId === 'coordination' ? '协调' : target.resourceId === 'focus' ? '专注' : target.resourceId;
    if (target.kind === 'actorResource') return actorName(target.actorId) + ' ' + resource + ' ' + change.before + ' → ' + change.after;
    const teamName = view.teamStates.find(team => team.id === target.teamId)?.id ?? '小组';
    return teamName + ' ' + resource + ' ' + change.before + ' → ' + change.after;
  };
  const membershipLabel = (change: OperationView['resolutions'][number]['membershipChanges'][number]): string => {
    const itemName = change.target.id === SCENE.item ? COPY.itemName : change.target.id;
    if (change.target.kind === 'knownFact') return change.after ? '记录事实：旋转木马控制台已检查' : '事实记录已撤销：旋转木马控制台已检查';
    return (change.after ? '获得' : '消耗') + itemName;
  };
  const sceneLabel = (resolution: OperationView['resolutions'][number]): string[] => {
    const batch = resolution.sceneBatch;
    if (!batch) return resolution.actorPlans.filter(plan => plan.participantKind === 'student' && plan.kind === 'studentAction')
      .map(plan => actorName(plan.actorId) + '使用' + actionLabel(plan.actionId));
    const selections = batch.selections.map(selection => {
      const actor = actorName(selection.actorId);
      const action = SCENE_NAMES[selection.sceneActionId] ?? selection.sceneActionId;
      const target = selection.targetActorIds.length ? ' → ' + selection.targetActorIds.map(actorName).join('、') : '';
      return actor + '使用' + action + target;
    });
    const cards = batch.cards.map(card => {
      const label = CARDS[card.actionId] ?? ACTIONS[card.actionId]?.name ?? '玩家场景卡';
      const target = card.targetActorIds.length ? ' → ' + card.targetActorIds.map(actorName).join('、') : '';
      return actorName(card.actorId) + '打出' + label + target + '（' + card.playerCost + ' Cost）';
    });
    return [...selections, ...cards, '本批实际支付 ' + batch.playerCostPaid + ' PlayerCost（' + batch.playerCostBefore + ' → ' + batch.playerCostAfter + '）'];
  };
  const entries = view.resolutions.map(resolution => {
    const details = [
      ...sceneLabel(resolution),
      ...resolution.studentSkillChecks.map(check => actorName(check.actorId) + '技能' + (check.succeeded ? '成功' : '未成功')),
      ...resolution.numericChanges.map(valueLabel),
      ...resolution.membershipChanges.map(membershipLabel),
    ];
    const locationName = LOCATIONS[resolution.locationId]?.name ?? '行动现场';
    return '<article class="chat-talk chat-talk-npc operation-resolution" data-operation-resolution="' + resolution.resolutionSequence + '"><span class="chat-avatar"><span class="chat-avatar-fallback">记</span></span>' +
      '<div class="chat-talk-main"><div class="chat-name"><span>夏莱行动记录</span><small>' + e(ctx, locationName) + ' · 第 ' + resolution.resolutionSequence + ' 次结算</small></div><div class="chat-bubble chat-bubble-npc"><p>' +
      e(ctx, details.length ? details.join(' · ') : '行动已经结算，现场情况已更新。') + '</p></div></div></article>';
  }).join('');
  const trimmed = view.resolutionSequence > view.resolutions.length
    ? '<p class="operation-history-limit" data-operation-history-limit>这里只保留最近 32 条结算记录。</p>'
    : '';
  return trimmed + entries;
}

function renderRouteHistory(ctx: UIContext, view: OperationView): string {
  if (!view.routeHistory.length && !view.locationEntryCostHistory.length) return '';
  const routes = view.routeHistory.length
    ? '<ol aria-label="已确认转场">' + view.routeHistory.map(record => {
      const from = LOCATIONS[record.fromLocationId]?.name ?? '行动现场';
      const to = LOCATIONS[record.toLocationId]?.name ?? '行动现场';
      const item = record.consumedHeldItemId ? ' · 消耗' + (record.consumedHeldItemId === SCENE.item ? COPY.itemName : record.consumedHeldItemId) : '';
      const cost = record.playerCostBeforeExit === undefined ? '' : ' · 离场 Cost ' + record.playerCostBeforeExit + (record.playerCostAfterCarryLimit === undefined ? '' : ' → ' + record.playerCostAfterCarryLimit);
      return '<li data-operation-route-history-item data-route-id="' + e(ctx, record.routeId) + '" data-from-location-id="' + e(ctx, record.fromLocationId) + '" data-to-location-id="' + e(ctx, record.toLocationId) + '"><span>' + e(ctx, from + ' → ' + to + item + cost) + '</span></li>';
    }).join('') + '</ol>' : '';
  const entries = view.locationEntryCostHistory.length
    ? '<ol aria-label="地点入场费用记录">' + view.locationEntryCostHistory.map(record => '<li data-operation-entry-cost-item><span>第 ' + record.visitSequence + ' 次进入' + e(ctx, LOCATIONS[record.locationId]?.name ?? '行动现场') + ' · Cost ' + record.balanceBefore + ' + ' + record.costGain + ' = ' + record.balanceAfter + '</span></li>').join('') + '</ol>'
    : '';
  const label = view.routeHistory.length ? '路线履历 · ' + view.routeHistory.length + ' 次转场' : '地点费用记录';
  return '<details class="operation-route-history" data-operation-route-history><summary>' + label + '</summary>' + routes + entries + '</details>';
}

function renderMain(ctx: UIContext, view: OperationView, notice: string | null): string {
  const location = LOCATIONS[view.currentLocationId];
  const terminal = view.status !== 'inProgress';
  const resultText = view.status === 'success' ? COPY.resultText.success : view.status === 'partialSuccess' ? COPY.resultText.partialSuccess : COPY.resultText.failure;
  const canBattle = view.currentLocationId === SCENE.locations.platform && !view.locationProgress[view.currentLocationId]?.completed;
  const slots = Array.from({ length: MAX_COST_SLOTS }, (_, index) => '<span class="operation-cost-slot ' + (index < view.playerCost ? 'is-available' : 'is-spent') +
    '" data-cost-index="' + index + '" aria-hidden="true"></span>').join('');
  let title = '';
  let description = '';
  let button = '';
  if (terminal) {
    title = view.status === 'success' ? '行动成功' : view.status === 'partialSuccess' ? '行动部分达成' : '行动未能完成';
    description = view.rewardClaimed ? '结案奖励已领取。' : '结案奖励待领取。';
    button = '<button type="button" class="operation-commit-button" data-operation-reward data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '"' +
      (view.rewardClaimed ? ' disabled' : '') + '>' + (view.rewardClaimed ? '奖励已领取' : '领取结案奖励') + '</button>';
  } else if (view.pendingSceneActionBatch) {
    title = '行动方案已暂存';
    description = '确认后一次扣除 PlayerCost 并结算全部效果。';
    button = '<button type="button" class="operation-clear-scene" data-operation-clear-scene data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) +
      '">返回修改</button><button type="button" class="operation-commit-button" data-operation-scene-commit data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '">确认行动</button>';
  } else if (view.currentActionMode && view.sceneActionBatchesRemaining > 0) {
    title = '选择现场行动';
    description = '所有选择会作为一个批次校验与提交。';
    button = '<button type="button" class="operation-commit-button" data-operation-scene-stage data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '">暂存方案</button>';
  } else if (canBattle) {
    title = view.canCommit ? '本回合方案已就绪' : '还需要处理计划问题';
    description = view.commitBlockedReasonIds.map(id => REASONS[id]).filter(Boolean).join(' ') || '学生计划附在左侧角色卡，可修订一名学生。';
    button = '<button type="button" class="operation-commit-button" data-operation-commit data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) +
      '"' + (view.canCommit ? '' : ' disabled') + '>提交本回合</button>';
  } else {
    title = '现场状态已更新';
    description = '查看路线选择或当前地点可用的行动。';
  }
  return '<main class="operation-chat" aria-label="行动对话与决策"><header class="operation-chat-heading"><div><span class="operation-eyebrow">夏莱行动记录 · 游乐园</span><h1>' +
    e(ctx, COPY.event.title) + '</h1><small>' + e(ctx, location?.name ?? '行动现场') + ' · 第 ' + (view.beatIndex + 1) + ' 次推进</small></div><button type="button" class="operation-back-button" data-operation-back>返回聊天流</button></header>' +
    '<div class="operation-chat-stream" data-scroll="content-region" data-operation-log role="log" aria-live="polite" aria-relevant="additions text">' +
    (notice ? '<p class="operation-command-notice" data-operation-command-notice role="alert" tabindex="-1">' + e(ctx, notice) + '</p>' : '') +
    '<div class="chat-talk chat-talk-npc operation-opening-message"><span class="chat-avatar"><span class="chat-avatar-fallback">安</span></span><div class="chat-talk-main"><div class="chat-name"><span>游乐园安全员</span></div>' +
    '<div class="chat-bubble chat-bubble-npc"><p>' + e(ctx, COPY.event.introduction) + '</p></div></div></div>' + renderProgress(ctx, view) +
    renderRouteHistory(ctx, view) + '<section class="operation-resolution-log" data-operation-resolution-log aria-label="行动结算记录">' + renderResolutions(ctx, view) + '</section>' +
    renderSceneControls(ctx, view) + renderPending(ctx, view) + renderRoutes(ctx, view) +
    (terminal ? '<section class="operation-outcome" data-operation-outcome><span class="operation-eyebrow">行动结论</span><h2>' + e(ctx, title) + '</h2><p>' + e(ctx, resultText) +
      '</p><small>' + (view.rewardClaimed ? '奖励已提交到账。' : '确认后将通过正式状态服务写入奖励。') + '</small></section>' : '') +
    '</div>' +
    '<footer class="operation-commit-dock" data-operation-commit-dock=""><div class="operation-dock-cost" aria-label="当前剩余 PlayerCost"><span class="operation-dock-cost__label">Cost ' +
    view.playerCost + '</span><div class="operation-cost-slots" data-operation-cost-balance>' + slots + '</div></div><div class="operation-commit-status" role="status"><strong>' +
    e(ctx, title) + '</strong><span>' + e(ctx, description) + '</span></div><div class="operation-commit-actions">' + button + '</div></footer></main>';
}

function renderUnavailable(ctx: UIContext, notice: string | null): string {
  return '<section class="operation-unavailable" data-operation-unavailable role="status"><span class="operation-unavailable__mark">!</span><div><h1>这次行动暂时无法读取</h1>' +
    '<p>请从夏莱办公室重新开始试玩，并确认账号已持有且解锁星野、芹香与白子。</p>' +
    (notice ? '<p class="operation-command-notice" data-operation-command-notice tabindex="-1">' + e(ctx, notice) + '</p>' : '') +
    '<button type="button" class="operation-back-button" data-operation-back>返回聊天流</button></div></section>';
}

export function renderOperationWorkspace(ctx: UIContext, view: OperationView | null, notice: string | null = null): string {
  const students = view?.actorStates.filter(actor => actor.participantKind === 'student') ?? [];
  const battle = Boolean(view && view.currentLocationId === SCENE.locations.platform && !view.locationProgress[view.currentLocationId]?.completed);
  const left = view
    ? '<aside class="operation-party-column" aria-label="我方学生" data-operation-party><header class="operation-column-heading"><span class="operation-eyebrow">我方</span><strong>' +
      students.length + ' 位学生</strong></header><div class="operation-party-list">' + students.map((actor, index) => renderStudent(ctx, view, actor, battle, index)).join('') + '</div></aside>'
    : '<aside class="operation-party-column" aria-hidden="true"></aside>';
  const center = view ? renderMain(ctx, view, notice) : renderUnavailable(ctx, notice);
  const right = view ? renderOpponents(ctx, view) : '<aside class="operation-opponent-column" aria-hidden="true"></aside>';
  return renderWorkspaceFrame(ctx, {
    id: 'operation',
    layout: { composition: 'columns', responsive: 'default' },
    left: { slot: 'left', role: 'our-team', workspaceOwner: 'operation', hostId: 'leftPanel.operation.party', themeScope: 'left.operation.party', className: 'operation-workspace__party', content: left, scroll: 'content' },
    center: { slot: 'center', role: 'information', workspaceOwner: 'operation', hostId: 'centerPanel.operation.chat', themeScope: 'center.operation.chat', className: 'operation-workspace__center', content: center, scroll: 'none' },
    right: { slot: 'right', role: 'opponents', workspaceOwner: 'operation', hostId: 'rightPanel.operation.opponents', themeScope: 'right.operation.opponents', className: 'operation-workspace__opponents', content: right, scroll: 'content' },
  });
}
