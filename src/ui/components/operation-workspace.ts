import type { OperationView, OperationViewActionOption, OperationViewActor, OperationViewSceneAction } from '../../arona-clicker/contracts/operation-view';
import { CAROUSEL_SAFETY_IDS } from '../../arona-clicker/content/operation-samples/carousel-safety-ids';
import { CAROUSEL_SCENE_ACTION_IDS as SCENE } from '../../arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SAFETY_PRESENTATION } from '../../arona-clicker/content/operation-samples/carousel-safety-copy';
import { GAMEPLAY_B_PRESENTATION as COPY } from '../../arona-clicker/content/operation-samples/gameplay-b-presentation';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as PARK_IDS } from '../../arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids';
import { GAMEPLAY_B_STRATEGY_PARK_MAP as PARK_MAP } from '../../arona-clicker/content/operation-samples/gameplay-b-strategy-park-map';
import type { UIContext } from '../context';
import { renderWorkspaceFrame } from './workspace-frame';

const REASONS = CAROUSEL_SAFETY_PRESENTATION.reasons as Record<string, string>;
const ABILITIES = CAROUSEL_SAFETY_PRESENTATION.abilities as Record<string, string>;
const TRACKS = COPY.tracks as Record<string, { name: string; description: string }>;
const ACTORS = COPY.actors as Record<string, { role: string; description: string }>;
const LOCATIONS = COPY.locations as Record<string, { name: string; description: string }>;
const MAX_COST_SLOTS = 5;

type OperationWorkspaceTransient = { stage: string; rightTab: 'enemies' | 'background'; seenMaps: Set<string>; closedMapCards: Set<string>; popupMap: string | null; mapPosition: { x: number; y: number } };
const operationWorkspaceTransient = new Map<string, OperationWorkspaceTransient>();

function operationUIState(view: OperationView): OperationWorkspaceTransient {
  const stage = `${view.eventId}:${view.currentLocationId}`;
  let state = operationWorkspaceTransient.get(view.runId);
  if (!state) {
    state = { stage, rightTab: 'enemies', seenMaps: new Set(), closedMapCards: new Set(), popupMap: null, mapPosition: { x: 24, y: 24 } };
    operationWorkspaceTransient.set(view.runId, state);
    while (operationWorkspaceTransient.size > 8) {
      const oldestRunId = operationWorkspaceTransient.keys().next().value;
      if (!oldestRunId || oldestRunId === view.runId) break;
      operationWorkspaceTransient.delete(oldestRunId);
    }
  } else if (state.stage !== stage) {
    state.stage = stage;
    state.rightTab = 'enemies';
  }
  return state;
}

export function setOperationWorkspaceTab(runId: string, tab: 'enemies' | 'background'): void {
  const state = operationWorkspaceTransient.get(runId);
  if (state) state.rightTab = tab;
}

export function closeOperationWorkspaceMap(runId: string, mapId: string): void {
  const state = operationWorkspaceTransient.get(runId);
  if (!state) return;
  state.popupMap = null;
}

export function closeOperationMapCard(runId: string, mapId: string): void { operationWorkspaceTransient.get(runId)?.closedMapCards.add(mapId); }

export function toggleOperationWorkspaceMap(runId: string, mapId: string): void {
  const state = operationWorkspaceTransient.get(runId);
  if (state) state.popupMap = state.popupMap === mapId ? null : mapId;
}

export function moveOperationWorkspaceMap(runId: string, x: number, y: number): void {
  const state = operationWorkspaceTransient.get(runId);
  if (state) state.mapPosition = { x, y };
}

function e(ctx: UIContext, value: unknown): string {
  return ctx.escapeHtml(String(value ?? ''));
}

function actorLabel(actor: OperationViewActor): string {
  return actor.displayName || (actor.participantKind === 'opponent' ? '对手' : actor.participantKind === 'environment' ? '现场设施' : '学生');
}

function actionLabel(view: OperationView, actionId: string): string {
  return actionId === 'operation:action:wait' ? '待命' : view.actionPresentations[actionId]?.title ?? actionId;
}

function actionDescription(view: OperationView, actionId: string): string | undefined {
  return view.actionPresentations[actionId]?.description ?? undefined;
}

function sceneActionLabel(view: OperationView, sceneActionId: string): string {
  return view.sceneActionPresentations[sceneActionId]?.title
    ?? view.currentSceneActions.find(action => action.id === sceneActionId)?.title
    ?? sceneActionId;
}

function sceneCardLabel(view: OperationView, cardInstanceId: string, actionId: string): string {
  return view.playerSceneCardPresentations[cardInstanceId]?.title
    ?? view.playerCards.hand.find(card => card.cardInstanceId === cardInstanceId)?.title
    ?? actionLabel(view, actionId);
}

function locationPresentation(view: OperationView, locationId: string): { readonly name: string; readonly description?: string } | undefined {
  if (view.eventId === PARK_IDS.event) {
    const copy = PARK_MAP.locations[locationId as keyof typeof PARK_MAP.locations];
    return copy ? { name: copy.label } : undefined;
  }
  return LOCATIONS[locationId];
}

function actorPresentation(view: OperationView, actorId: string): { readonly role: string; readonly description: string } | undefined {
  return view.eventId === PARK_IDS.event
    ? PARK_MAP.actors[actorId as keyof typeof PARK_MAP.actors]
    : ACTORS[actorId];
}

function operationItemName(view: OperationView, itemId: string): string {
  if (view.eventId === PARK_IDS.event) {
    if (itemId === PARK_IDS.items.maintenancePass) return '维修通行证';
    if (itemId === PARK_IDS.items.staffRadio) return '员工广播凭证';
  }
  return itemId === SCENE.item ? COPY.itemName : itemId;
}

function planLabel(actor: OperationViewActor, view: OperationView): string {
  const plan = actor.currentPlan;
  if (!plan) return '尚未生成计划';
  const name = actionLabel(view, plan.actionId);
  const target = plan.targetActorId ? view.actorStates.find(item => item.id === plan.targetActorId)?.displayName ?? '场景目标' : null;
  if (plan.kind === 'wait') return plan.reasonIds.map(id => REASONS[id]).filter(Boolean).join(' ') || '等待指示';
  return target ? name + ' · 目标：' + target : name;
}

function optionReasons(option: OperationViewActionOption): string[] {
  return [...new Set([...option.missingCapabilityIds, ...option.blockedReasonIds, ...option.reasonIds.filter(id => id.startsWith('operation:'))])];
}

function actorResourceLabel(resourceId: string): string {
  if (resourceId === 'stamina') return '体力';
  if (resourceId === 'focus') return '专注';
  if (resourceId === 'coordination') return '个人协调';
  return resourceId;
}

function renderStudentVitals(ctx: UIContext, actor: OperationViewActor): string {
  const hpPercent = actor.maxHp > 0 ? Math.max(0, Math.min(100, actor.hp / actor.maxHp * 100)) : 0;
  const personalResources = Object.entries(actor.resources)
    .sort(([left], [right]) => left.localeCompare(right));
  const balance = personalResources.length
    ? personalResources.map(([resourceId, value]) => actorResourceLabel(resourceId) + ' ' + value).join(' · ')
    : '—';
  const balanceLabel = personalResources.length
    ? personalResources.map(([resourceId, value]) => actorResourceLabel(resourceId) + ' ' + value).join('，')
    : '没有个人行动资源';
  return '<div class="operation-student-vitals" aria-label="角色状态">' +
    '<div class="operation-student-vitals__hp"><span>HP</span><strong>' + actor.hp + ' / ' + actor.maxHp + '</strong>' +
    '<span class="operation-student-vitals__bar" role="meter" aria-label="生命值" aria-valuemin="0" aria-valuemax="' + actor.maxHp + '" aria-valuenow="' + actor.hp + '"><span style="--operation-hp-fill:' + hpPercent + '%"></span></span></div>' +
    '<div class="operation-student-vitals__scost" data-operation-scost><span>sCost</span><strong aria-label="' + e(ctx, balanceLabel) + '">' + e(ctx, balance) + '</strong></div></div>';
}

function targetName(view: OperationView, targetActorId: string): string {
  return view.actorStates.find(actor => actor.id === targetActorId)?.displayName ?? '场景目标';
}

const operationSceneDrafts = new Map<string, OperationSceneDraft>();

export interface OperationSceneDraft {
  readonly selections: readonly { readonly sceneActionId: string; readonly actorId?: string; readonly targetActorIds: readonly string[] }[];
  readonly cards: readonly { readonly cardInstanceId: string; readonly actorId?: string; readonly targetActorIds: readonly string[] }[];
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
  return operationSceneDrafts.get(sceneDraftKey(runId, planVersion, locationId));
}

export interface OperationActorHandCardView {
  readonly identity: string;
  readonly kind: 'battle-action' | 'scene-action' | 'player-card';
  readonly source: 'character-hand' | 'location-scene-actions' | 'shared-player-deck';
  readonly ownerActorId: string;
  readonly selectionPolicy: 'planned' | 'required' | 'fixed';
  readonly selected: boolean;
  readonly locked: boolean;
  readonly performerCandidateIds: readonly string[];
  readonly legalTargetActorIds: readonly string[];
  readonly playerCost: number | null;
}

/** Normalized, read-only actor-hand surface over OperationView and the reversible UI scene draft. */
export function projectOperationActorHand(view: OperationView, ownerActorId: string): readonly OperationActorHandCardView[] {
  const actor = view.actorStates.find(item => item.id === ownerActorId && item.participantKind === 'student');
  if (!actor) return [];
  const battle = view.currentLocationId === SCENE.locations.platform && !view.locationProgress[view.currentLocationId]?.completed;
  if (battle) {
    const activePlan = view.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? actor.currentPlan;
    return (actor.profile?.actionOptions ?? []).map(option => ({
      identity: option.actionId,
      kind: 'battle-action',
      source: 'character-hand',
      ownerActorId: actor.id,
      selectionPolicy: 'planned',
      selected: activePlan?.actionId === option.actionId,
      locked: !option.selectable,
      performerCandidateIds: [actor.id],
      legalTargetActorIds: [...option.legalTargetActorIds],
      playerCost: null,
    }));
  }
  const draft = readOperationSceneDraft(view.runId, view.planVersion, view.currentLocationId);
  const projected: OperationActorHandCardView[] = [];
  if (view.currentActionMode === 'global') {
    const saved = draft?.selections.find(row => row.actorId === actor.id);
    const action = saved && view.currentSceneActions.find(row => row.id === saved.sceneActionId && row.scope === 'global');
    if (action) projected.push({
      identity: action.id,
      kind: 'scene-action',
      source: 'location-scene-actions',
      ownerActorId: actor.id,
      selectionPolicy: action.selectionPolicy,
      selected: true,
      locked: action.selectionPolicy === 'fixed',
      performerCandidateIds: [...action.eligibleActorIds],
      legalTargetActorIds: [...(action.legalTargetActorIdsByActorId[actor.id] ?? [])],
      playerCost: action.playerCost,
    });
  } else if (view.currentActionMode === 'individual') {
    const actions = view.currentSceneActions.filter(action => action.scope === 'individual' && action.selectionPolicy === 'required' && action.eligibleActorIds.includes(actor.id));
    const saved = draft?.selections.find(row => row.actorId === actor.id);
    const selectedId = saved?.sceneActionId;
    for (const action of actions) projected.push({
      identity: action.id,
      kind: 'scene-action',
      source: 'location-scene-actions',
      ownerActorId: actor.id,
      selectionPolicy: action.selectionPolicy,
      selected: action.id === selectedId,
      locked: action.selectionPolicy === 'fixed',
      performerCandidateIds: [actor.id],
      legalTargetActorIds: [...(action.legalTargetActorIdsByActorId[actor.id] ?? [])],
      playerCost: action.playerCost,
    });
  }
  for (const selection of draft?.cards ?? []) {
    if (selection.actorId !== actor.id) continue;
    const card = view.playerCards.hand.find(item => item.cardInstanceId === selection.cardInstanceId);
    if (!card) continue;
    projected.push({
      identity: card.cardInstanceId,
      kind: 'player-card',
      source: 'shared-player-deck',
      ownerActorId: actor.id,
      selectionPolicy: card.selectionPolicy,
      selected: true,
      locked: card.selectionPolicy === 'fixed',
      performerCandidateIds: [...card.eligibleActorIds],
      legalTargetActorIds: [...(card.legalTargetActorIdsByActorId[actor.id] ?? [])],
      playerCost: card.playerCost,
    });
  }
  return projected;
}

function renderSceneActionOption(
  ctx: UIContext,
  view: OperationView,
  actorId: string,
  action: OperationViewSceneAction,
  isSelected: boolean,
  selectedTargetIds: readonly string[],
  index: number,
  attachedPerformerActorId: string | null = null,
): string {
  const selectedActorId = action.performerPolicy === 'none' ? '' : attachedPerformerActorId ?? actorId;
  const performerIds = action.performerPolicy === 'none' ? ['']
    : attachedPerformerActorId !== null ? [selectedActorId]
      : view.currentActionMode === 'global'
        ? action.performerPolicy === 'optional-student' ? ['', ...action.eligibleActorIds] : action.eligibleActorIds
        : [selectedActorId];
  const legalTargetMap = Object.fromEntries(performerIds.map(id => [id, actionTargets(action, id)]));
  const targets = actionTargets(action, selectedActorId);
  const description = action.description ?? actionDescription(view, action.actionId) ?? '执行一项现场行动。';
  const actionName = action.title || sceneActionLabel(view, action.id);
  const targetSummary = action.performerPolicy === 'selected-student' && view.currentActionMode === 'global' && !selectedActorId
    ? '拖到角色卡上选择执行者'
    : selectedTargetIds.length
    ? '→ ' + selectedTargetIds.map(id => targetName(view, id)).join('、')
    : targets.length ? '拖到目标上指定' : '无需指定目标';
  const performerActorIds = view.currentActionMode === 'global' && action.performerPolicy !== 'none'
    ? action.eligibleActorIds : [];
  const performerStatus = performerActorIds.length
    ? '<small class="operation-card-status" data-operation-scene-performer-status>' + (selectedActorId ? '执行者：' + e(ctx, targetName(view, selectedActorId)) : action.performerPolicy === 'optional-student' ? '可就地激活；拖到学生可指定执行者' : '拖到角色卡上选择执行者') + '</small>'
    : '';
  const face = '<button type="button" class="operation-card-face operation-card-face--scene ' + (view.currentActionMode === 'global' ? 'is-global' : 'is-individual') + (isSelected ? ' is-selected' : '') + '" data-operation-scene-choice data-card-kind="scene-action" data-target-mode="' + e(ctx, view.currentActionMode ?? 'individual') + '" data-selected-target-actor-ids="' + e(ctx, JSON.stringify(selectedTargetIds)) + '" data-scene-action-scope="' + e(ctx, action.scope) + '" data-performer-policy="' + action.performerPolicy + '" data-operation-performer-candidate-actor-ids="' + e(ctx, JSON.stringify(performerActorIds)) + '" data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-player-cost="' + action.playerCost + '" data-actor-id="' + e(ctx, selectedActorId) + '" data-legal-target-actor-ids="' + e(ctx, JSON.stringify(targets)) + '" data-legal-target-map="' + e(ctx, JSON.stringify(legalTargetMap)) + '" data-target-summary="' + e(ctx, targetSummary) + '" data-scene-action-id="' + e(ctx, action.id) + '" style="--card-angle:' + (((index % 3) - 1) * 1.8) + 'deg" aria-pressed="' + String(isSelected) + '" aria-label="' + e(ctx, actionName + '。' + description + '。' + action.playerCost + ' Cost。' + targetSummary) + '">' +
    '<strong class="operation-card-title">' + e(ctx, actionName) + '</strong>' + performerStatus + '<small class="operation-card-description">' + e(ctx, description) + '</small><span class="operation-card-footer"><b>' + action.playerCost + ' Cost</b><span data-operation-card-target-summary>' + e(ctx, targetSummary) + '</span></span></button>';
  return '<div class="operation-scene-option' + (isSelected ? ' is-selected' : '') + '" data-operation-scene-option data-operation-scene-option-card data-actor-id="' + e(ctx, selectedActorId) + '" data-scene-action-id="' + e(ctx, action.id) + '"' + (isSelected || index === 0 ? '' : ' hidden') + '>' + face + '</div>';
}

function renderSceneActionCard(ctx: UIContext, view: OperationView, actorId: string, actions: OperationViewSceneAction[], chosen: OperationViewSceneAction | undefined, extraContent = '', attachedPerformerActorId: string | null = null): string {
  if (!chosen) return '<div class="operation-scene-card is-empty" data-operation-scene-card data-actor-id="' + e(ctx, actorId) + '"><span class="operation-eyebrow">行动牌</span><strong>暂无可用行动</strong></div>';
  const draft = readOperationSceneDraft(view.runId, view.planVersion, view.currentLocationId);
  const saved = draft?.selections.find(selection => (selection.actorId ?? '') === actorId);
  const selected = saved ? actions.find(action => action.id === saved.sceneActionId) ?? null : null;
  const displayAction = selected ?? chosen;
  if (!displayAction) return '<div class="operation-scene-card is-empty" data-operation-scene-card data-actor-id="' + e(ctx, actorId) + '"><span class="operation-eyebrow">行动牌</span><strong>暂无可用行动</strong></div>';
  const chosenTargets = actionTargets(displayAction, actorId);
  const selectedTargetIds = saved?.sceneActionId === displayAction.id ? saved.targetActorIds : chosenTargets.length === 1 ? chosenTargets : [];
  const alternatives = actions.filter(action => action.id !== displayAction.id);
  const orderedActions = [displayAction, ...alternatives];
  const actionOptions = orderedActions.map((action, index) => {
    const targets = actionTargets(action, actorId);
    const targetIds = saved?.sceneActionId === action.id ? saved.targetActorIds : targets.length === 1 ? targets : [];
    return renderSceneActionOption(ctx, view, actorId, action, selected?.id === action.id, targetIds, index, attachedPerformerActorId);
  }).join('');
  return '<div class="operation-scene-card' + (view.currentActionMode === 'global' ? ' operation-scene-card--global' : '') + (attachedPerformerActorId !== null ? ' operation-scene-card--attached' : '') + '" data-operation-scene-card data-actor-id="' + e(ctx, actorId) + '" role="listitem"' + (view.currentActionMode === 'global' ? ' data-global-scene-card' : '') + '>' +
    '<div class="operation-scene-choice-list" data-operation-scene-options>' + actionOptions + '</div>' +
    (alternatives.length ? '<button type="button" class="operation-scene-alternatives" data-operation-scene-alternatives aria-expanded="false">其他行动牌 · ' + alternatives.length + '</button>' : '') + extraContent + '</div>';
}

function renderGlobalAttachedSceneAction(ctx: UIContext, view: OperationView, actor: OperationViewActor): string {
  if (view.currentActionMode !== 'global' || actor.hp <= 0 || view.sceneActionBatchesRemaining < 1 || view.pendingSceneActionBatch) return '';
  const selection = readOperationSceneDraft(view.runId, view.planVersion, view.currentLocationId)?.selections
    .find(row => row.actorId === actor.id);
  if (!selection) return '';
  const action = view.currentSceneActions.find(row => row.id === selection.sceneActionId
    && row.scope === 'global' && row.performerPolicy !== 'none'
    && row.eligibleActorIds.includes(actor.id));
  if (!action) return '';
  const choices = view.currentSceneActions.filter(row => row.scope === 'global' && row.selectionPolicy === 'required'
    && row.performerPolicy !== 'none' && row.eligibleActorIds.includes(actor.id));
  return renderSceneActionCard(ctx, view, actor.id, choices, action, '', actor.id);
}

function renderPlayerSceneCard(ctx: UIContext, view: OperationView, card: OperationView['playerCards']['hand'][number], index: number, ownerActorId = ''): string {
  const draft = readOperationSceneDraft(view.runId, view.planVersion, view.currentLocationId);
  const saved = draft?.cards.find(item => item.cardInstanceId === card.cardInstanceId);
  const assignedActorId = ownerActorId || '';
  const selected = card.selectionPolicy === 'fixed' || Boolean(saved);
  const label = card.title || actionLabel(view, card.actionId);
  const targets = assignedActorId
    ? card.legalTargetActorIdsByActorId[assignedActorId] ?? []
    : card.performerPolicy === 'none' || card.performerPolicy === 'optional-student' ? card.legalActorlessTargetActorIds : [];
  const selectedTargets = saved?.actorId === assignedActorId ? saved.targetActorIds : targets.length === 1 ? targets : [];
  const targetSummary = selectedTargets.length ? '→ ' + selectedTargets.map(id => targetName(view, id)).join('、')
    : card.performerPolicy === 'selected-student' && !assignedActorId ? '拖到角色卡上分配执行者'
      : targets.length ? '拖到目标上指定' : '无需指定目标';
  const eligible = card.performerPolicy !== 'none' ? card.eligibleActorIds : [];
  const description = card.description ?? actionDescription(view, card.actionId) ?? '在现场使用这张卡。';
  const status = card.selectionPolicy === 'fixed' ? '固定纳入 · 不可取消' : selected ? '已加入本批' : assignedActorId ? '归属角色 · 点按退回公共手牌' : card.performerPolicy === 'optional-student' ? '可现场直接使用；也可交给学生' : '拖到角色卡以加入本批';
  const face = '<button type="button" class="operation-card-face operation-card-face--player" data-operation-card-toggle data-card-kind="player-card" data-target-mode="' + e(ctx, view.currentActionMode ?? 'individual') + '" data-selected-target-actor-ids="' + e(ctx, JSON.stringify(selectedTargets)) + '" data-performer-policy="' + card.performerPolicy + '" data-operation-performer-candidate-actor-ids="' + e(ctx, JSON.stringify(eligible)) + '" data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-player-cost="' + card.playerCost + '" data-actor-id="' + e(ctx, assignedActorId) + '" data-legal-target-actor-ids="' + e(ctx, JSON.stringify(targets)) + '" data-target-summary="' + e(ctx, targetSummary) + '" aria-pressed="' + String(selected) + '"' + (card.selectionPolicy === 'fixed' ? ' aria-disabled="true"' : '') + ' aria-label="' + e(ctx, label + '。' + description + '。' + card.playerCost + ' Cost。' + targetSummary + (card.selectionPolicy === 'fixed' ? '。固定加入，不可取消' : '')) + '"><strong class="operation-card-title">' + e(ctx, label) + '</strong><small class="operation-card-status" data-operation-card-status>' + status + '</small>' + (card.selectionPolicy === 'fixed' ? '<small class="operation-card-fixed-status">✓ 固定纳入 · 不可取消</small>' : '') + '<small class="operation-card-description">' + e(ctx, description) + '</small><span class="operation-card-footer"><b>' + card.playerCost + ' Cost</b><span data-operation-card-target-summary>' + e(ctx, targetSummary) + '</span></span></button>';
  return '<div class="operation-player-card' + (selected ? ' is-selected' : '') + (card.selectionPolicy === 'fixed' ? ' is-fixed' : '') + (assignedActorId ? ' is-attached' : '') + '" data-operation-player-card="' + e(ctx, card.cardInstanceId) + '"' + (assignedActorId ? ' data-operation-actor-held-card="' + e(ctx, assignedActorId) + '"' : '') + ' role="listitem" style="--card-angle:' + (((index % 3) - 1) * 1.4) + 'deg">' + face + '</div>';
}

function renderIndividualSceneCard(ctx: UIContext, view: OperationView, actor: OperationViewActor, index: number): string {
  const actions = view.currentSceneActions.filter(action => action.scope === 'individual' && action.selectionPolicy === 'required' && action.eligibleActorIds.includes(actor.id));
  const chosen = actions[Math.min(index, Math.max(actions.length - 1, 0))];
  const fixed = view.currentSceneActions.filter(action => action.scope === 'individual' && action.selectionPolicy === 'fixed');
  const fixedSummary = fixed.map(action => renderFixedSceneAction(ctx, action)).join('');
  return renderSceneActionCard(ctx, view, actor.id, actions, chosen, fixedSummary);
}

function renderFixedSceneAction(ctx: UIContext, action: OperationViewSceneAction): string {
  return '<div class="operation-card-face operation-card-face--scene is-selected is-fixed" data-operation-fixed-scene-action="' + e(ctx, action.id) + '" data-player-cost="' + action.playerCost + '" role="group" aria-label="固定纳入，不可取消：' + e(ctx, action.title) + '"><strong class="operation-card-title">' + e(ctx, action.title) + '</strong><small class="operation-card-fixed-status">✓ 固定纳入 · 不可取消</small>' + (action.description ? '<small class="operation-card-description">' + e(ctx, action.description) + '</small>' : '') + '<span class="operation-card-footer"><b>' + action.playerCost + ' Cost</b></span></div>';
}

function renderAction(ctx: UIContext, view: OperationView, actor: OperationViewActor, option: OperationViewActionOption, selected: boolean, alternative: boolean): string {
  const disabled = !option.selectable || view.status !== 'inProgress' || Boolean(view.locationProgress[view.currentLocationId]?.completed);
  const reasonText = optionReasons(option).map(id => REASONS[id] ?? ABILITIES[id]).filter(Boolean).join(' ');
  const actionCopy = actionDescription(view, option.actionId) ?? '';
  const disabledReason = disabled ? reasonText || (view.status !== 'inProgress' ? '本次行动已结束' : '当前无法采用') : '';
  const cost = option.cost
    ? (option.cost.scope === 'actor' ? '' : '小组·') + (option.cost.resourceId === 'stamina' ? '体力' : option.cost.resourceId === 'coordination' ? '协调' : '专注') + ' ' + option.cost.amount
    : '';
  const selectedTargetId = selected
    ? actor.currentPlan?.targetActorId ?? option.defaultTargetActorId
    : option.defaultTargetActorId;
  const targetSummary = selectedTargetId ? '→ ' + targetName(view, selectedTargetId) : option.legalTargetActorIds.length ? '选择目标' : '无需指定目标';
  const kind = option.actionId.includes('skill') || option.actionId.includes('ability') ? 'is-skill' : 'is-player-action';
  const basePlan = view.basePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id);
  const activePlan = view.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? actor.currentPlan;
  const hasIntervention = Boolean(selected && basePlan && activePlan
    && (basePlan.actionId !== activePlan.actionId || basePlan.targetActorId !== activePlan.targetActorId));
  const classes = 'operation-card-face operation-prepared-card operation-card-face--battle ' + kind + (selected ? ' is-selected' : '') + (hasIntervention ? ' is-intervention-changed' : '') + (disabled ? ' is-disabled' : '');
  const cardLabel = actorLabel(actor) + '，行动牌：' + actionLabel(view, option.actionId) + '。' + (actionCopy || disabledReason || '按计划执行。') + '。' + (cost || targetSummary) + (disabledReason ? '。不可用：' + disabledReason : '');
  return '<button type="button" class="' + classes + '" data-operation-prepared-owner-id="' + e(ctx, actor.id) + '" data-operation-action-option data-operation-action-owner-id="' + e(ctx, actor.id) + '"' +
    (alternative ? ' data-operation-action-alternative' : ' data-operation-action-current') + ' data-card-kind="battle-action" data-operation-action data-operation-action-card="' + e(ctx, option.actionId) +
    '" data-legal-target-actor-ids="' + e(ctx, JSON.stringify(disabled ? [] : option.legalTargetActorIds)) + '" data-target-summary="' + e(ctx, targetSummary) + '" data-run-id="' + e(ctx, view.runId) +
    '" data-plan-version="' + e(ctx, view.planVersion) + '" data-actor-id="' + e(ctx, actor.id) + '" data-action-id="' + e(ctx, option.actionId) +
    '" data-default-target-actor-id="' + e(ctx, option.defaultTargetActorId ?? '') + '" data-selected-target-actor-id="' + e(ctx, selectedTargetId ?? '') + '" aria-pressed="' + String(selected) + '"' + (selected ? ' aria-expanded="false" aria-controls="operation-action-alternatives-' + e(ctx, actor.id) + '"' : '') +
    ' aria-label="' + e(ctx, cardLabel) + '" title="' + e(ctx, disabledReason || actionCopy) + '"' + (alternative ? ' hidden' : '') + (alternative && disabled ? ' disabled' : '') + ' style="--card-angle:' + (alternative ? '0deg' : '-1deg') + '">' +
    '<strong class="operation-card-title">' + e(ctx, actionLabel(view, option.actionId)) + '</strong>' +
    '<small class="operation-card-description">' + e(ctx, disabledReason || actionCopy || '按计划执行。') + '</small><span class="operation-card-footer"><b>' + e(ctx, cost || '无费用') + '</b><span data-operation-card-target-summary>' + e(ctx, targetSummary) + '</span></span></button>';
}

function renderAutomaticActionCard(ctx: UIContext, view: OperationView, actor: OperationViewActor, hasAlternatives: boolean): string {
  const summary = actor.currentPlan ? planLabel(actor, view) : '打开替代行动牌选择一项计划';
  return '<button type="button" class="operation-card-face operation-prepared-card operation-card-face--battle is-player-action is-selected" data-operation-prepared-owner-id="' + e(ctx, actor.id) +
    '" data-operation-action-current-toggle data-operation-action-owner-id="' + e(ctx, actor.id) + '" aria-pressed="true" aria-expanded="false" aria-controls="operation-action-alternatives-' + e(ctx, actor.id) +
    '" aria-label="' + e(ctx, actorLabel(actor) + '当前计划：' + summary + (hasAlternatives ? '。打开替代行动牌' : '')) + '" style="--card-angle:-1deg"><strong class="operation-card-title">' +
    e(ctx, actor.currentPlan ? actionLabel(view, actor.currentPlan.actionId) : '选择行动') + '</strong><small class="operation-card-description">' + e(ctx, summary) +
    '</small><span class="operation-card-footer"><b>计划</b><span>等待结算</span></span></button>';
}

function renderStudent(ctx: UIContext, view: OperationView, actor: OperationViewActor, battle: boolean): string {
  const basePlan = view.basePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? null;
  const activePlan = view.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? actor.currentPlan;
  const changed = Boolean(basePlan && activePlan && (basePlan.actionId !== activePlan.actionId || basePlan.targetActorId !== activePlan.targetActorId));
  const name = actorLabel(actor);
  const avatar = actor.avatarRef
    ? '<img src="' + e(ctx, actor.avatarRef) + '" alt="" loading="lazy">'
    : e(ctx, name.slice(0, 1));
  const planMarkup = battle
      ? changed && basePlan ? '<small class="operation-automatic-plan">自动计划：' + e(ctx, actionLabel(view, basePlan.actionId)) + '</small>' : ''
    : '';
  const actorHand = projectOperationActorHand(view, actor.id);
  const attachedSceneAction = battle ? '' : view.currentActionMode === 'individual'
    ? renderIndividualSceneCard(ctx, view, actor, view.actorStates.filter(item => item.participantKind === 'student' && item.hp > 0).findIndex(item => item.id === actor.id))
    : renderGlobalAttachedSceneAction(ctx, view, actor);
  const actorPlayerCards = !battle ? actorHand.flatMap(projectedCard => {
    if (projectedCard.source !== 'shared-player-deck') return [];
    const card = view.playerCards.hand.find(item => item.cardInstanceId === projectedCard.identity);
    if (!card) return [];
    const index = view.playerCards.hand.findIndex(item => item.cardInstanceId === card.cardInstanceId);
    return [renderPlayerSceneCard(ctx, view, card, index, actor.id)];
  }).join('') : '';
  const actorCardSlot = attachedSceneAction || actorPlayerCards
    ? '<div class="operation-actor-hand-cards" data-operation-actor-hand-cards role="list" aria-label="' + e(ctx, name) + '持有的行动牌">' + attachedSceneAction + actorPlayerCards + '</div>' : '';
  return '<article class="operation-student-card" data-operation-student="' + e(ctx, actor.id) + '" data-operation-actor-hand="' + e(ctx, actor.id) + '" data-operation-card-anchor="' + e(ctx, actor.id) + '"' + (battle ? ' data-operation-action-anchor="' + e(ctx, actor.id) + '"' : '') + ' data-operation-actor-target="' + e(ctx, actor.id) + '">' +
    '<header class="operation-student-card__header"><span class="operation-student-card__avatar" aria-hidden="true">' + avatar + '</span><span><strong>' + e(ctx, name) + '</strong></span></header>' +
    renderStudentVitals(ctx, actor) + planMarkup + actorCardSlot + '</article>';
}

function actorsInCurrentScene(view: OperationView): ReadonlySet<string> {
  const actorIds = new Set<string>();
  for (const actor of view.actorStates) {
    if (actor.participantKind !== 'student' && actor.currentPlan?.kind === 'intent') actorIds.add(actor.id);
    for (const option of actor.profile?.actionOptions ?? []) {
      for (const targetActorId of option.legalTargetActorIds) actorIds.add(targetActorId);
    }
  }
  const addTargets = (byActorId: Readonly<Record<string, readonly string[]>>): void => {
    for (const targetIds of Object.values(byActorId)) for (const targetActorId of targetIds) actorIds.add(targetActorId);
  };
  for (const action of view.currentSceneActions) {
    addTargets(action.legalTargetActorIdsByActorId);
    for (const targetActorId of action.legalActorlessTargetActorIds) actorIds.add(targetActorId);
  }
  for (const card of view.playerCards.hand) {
    addTargets(card.legalTargetActorIdsByActorId);
    for (const targetActorId of card.legalActorlessTargetActorIds) actorIds.add(targetActorId);
  }
  return actorIds;
}

function renderOpponents(ctx: UIContext, view: OperationView, visible: boolean): string {
  const sceneActorIds = actorsInCurrentScene(view);
  const opponents = view.actorStates.filter(actor => actor.participantKind === 'opponent' && sceneActorIds.has(actor.id));
  const environment = view.actorStates.filter(actor => actor.participantKind === 'environment' && sceneActorIds.has(actor.id));
  const opponentGroup = opponents.length
    ? '<section class="operation-actor-group" data-operation-opponents><header class="operation-column-heading"><span class="operation-eyebrow">敌方</span><strong>' + opponents.length + ' 名</strong></header>' +
    opponents.map(actor => '<article class="operation-opponent-card" data-operation-opponent="' + e(ctx, actor.id) + '" data-operation-card-anchor="' + e(ctx, actor.id) + '" data-operation-actor-target="' + e(ctx, actor.id) + '">' +
      '<header class="operation-opponent-card__header"><span class="operation-opponent-card__avatar">' + e(ctx, actor.displayName.slice(0, 1)) + '</span><span><strong>' + e(ctx, actorLabel(actor)) + '</strong><small>' + e(ctx, actorPresentation(view, actor.id)?.role ?? '行动者') + '</small></span></header>' +
      '<div class="operation-hp"><span>状态</span><strong>' + actor.hp + ' / ' + actor.maxHp + '</strong></div></article>').join('') + '</section>'
    : '';
  const environmentGroup = environment.length
    ? '<section class="operation-actor-group operation-environment-group" data-operation-environment><header class="operation-column-heading"><span class="operation-eyebrow">场景 / 设施</span><strong>' + environment.length + ' 项</strong></header>' +
    environment.map(actor => '<article class="operation-environment-card" data-operation-environment-actor="' + e(ctx, actor.id) + '" data-operation-card-anchor="' + e(ctx, actor.id) + '" data-operation-actor-target="' + e(ctx, actor.id) + '"><strong>' + e(ctx, actorLabel(actor)) + '</strong><p>' + e(ctx, actorPresentation(view, actor.id)?.description ?? '现场环境状态') + '</p></article>').join('') +
    '</section>'
    : '';
  return '<div class="operation-opponent-column" data-operation-right-view="enemies" data-scroll-owner="content-region"' + (visible ? '' : ' hidden') + '>' + opponentGroup + environmentGroup + '</div>';
}

function renderBackground(view: OperationView, ctx: UIContext, visible: boolean): string {
  const location = locationPresentation(view, view.currentLocationId);
  const knownFacts = view.knownFactIds.length
    ? '<section class="operation-background-section"><strong>已知信息</strong><ul>' + view.knownFactIds.map(id => '<li>' + e(ctx, id === SCENE.fact ? '旋转木马控制台已检查' : id) + '</li>').join('') + '</ul></section>'
    : '<p class="operation-muted">尚无已记录的现场信息。</p>';
  const items = view.heldItemIds.length
    ? '<div class="operation-current-items" aria-label="当前持有物">' + view.heldItemIds.map(id => '<span>' + e(ctx, operationItemName(view, id)) + '</span>').join('') + '</div>'
    : '<p class="operation-muted">当前没有持有物。</p>';
  return '<div class="operation-background-view" data-operation-right-view="background" data-scroll-owner="content-region"' + (visible ? '' : ' hidden') + '><section class="operation-background-section"><span class="operation-eyebrow">当前地点</span><strong>' + e(ctx, location?.name ?? '行动现场') + '</strong><p>' + e(ctx, location?.description ?? '') + '</p></section>' + knownFacts + '<section class="operation-background-section"><strong>持有物</strong>' + items + '</section></div>';
}

function renderIntentCard(ctx: UIContext, view: OperationView, actor: OperationViewActor): string {
  if (actor.currentPlan?.kind !== 'intent') return '';
  const kind = actor.participantKind === 'environment' ? 'is-location-effect' : 'is-enemy-intent';
  return '<article class="operation-card-face operation-prepared-card operation-card-face--intent ' + kind + '" data-operation-prepared-owner-id="' + e(ctx, actor.id) +
    '" data-operation-intent="' + e(ctx, actor.id) + '" tabindex="0" aria-label="' + e(ctx, actorLabel(actor) + '意图：' + planLabel(actor, view)) + '"><strong class="operation-card-title">' + e(ctx, actionLabel(view, actor.currentPlan.actionId)) +
    '</strong><small class="operation-card-description">' + e(ctx, planLabel(actor, view)) + '</small><span class="operation-card-footer"><b>公开意图</b><span>本回合</span></span></article>';
}

function renderPreparedCardLayer(ctx: UIContext, view: OperationView, battle: boolean, students: readonly OperationViewActor[]): string {
  const panels: string[] = [];
  const cards: string[] = [];
  if (battle) {
    for (const actor of students) {
      const options = actor.profile?.actionOptions ?? [];
      const activePlan = view.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === actor.id) ?? actor.currentPlan;
      const selectedOption = options.find(option => option.actionId === activePlan?.actionId);
      const alternatives = options.filter(option => option.actionId !== selectedOption?.actionId);
      const interventionDraft = view.interventionDraft?.actorId === actor.id;
      const clearAction = interventionDraft
        ? '<button type="button" class="operation-clear-intervention" data-operation-clear data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-actor-id="' + e(ctx, actor.id) + '">取消修订</button>'
        : '';
      panels.push(alternatives.length || interventionDraft
        ? '<div class="operation-action-alternatives-panel" id="operation-action-alternatives-' + e(ctx, actor.id) + '" data-operation-action-alternatives-panel data-operation-action-owner-id="' + e(ctx, actor.id) + '" aria-label="' + e(ctx, actorLabel(actor) + '的替代行动牌') + '" hidden><span>替代行动</span>' + clearAction + '</div>'
        : '');
      cards.push(selectedOption
        ? renderAction(ctx, view, actor, selectedOption, true, false)
        : renderAutomaticActionCard(ctx, view, actor, alternatives.length > 0));
      for (const option of alternatives) {
        cards.push(renderAction(ctx, view, actor, option, false, true));
      }
    }
  }
  const intents = view.actorStates
    .filter(actor => actor.participantKind !== 'student' && actor.currentPlan?.kind === 'intent')
    .map(actor => renderIntentCard(ctx, view, actor));
  return '<div class="operation-prepared-card-layer" data-operation-prepared-card-layer aria-label="人物锚定行动牌层">' + panels.join('') + cards.join('') + intents.join('') + '</div>';
}

function renderProgress(ctx: UIContext, view: OperationView): string {
  const location = locationPresentation(view, view.currentLocationId);
  const tracks = Object.entries(view.tracks).map(([id, value]) => '<div class="operation-track" data-operation-track="' + e(ctx, id) + '"><span>' +
    e(ctx, TRACKS[id]?.name ?? '现场状态') + '</span><strong>' + e(ctx, value) + '</strong><small>' + e(ctx, TRACKS[id]?.description ?? '') + '</small></div>').join('');
  const objectives = view.objectives.map(objective => '<li class="' + (objective.achieved ? 'is-achieved' : '') + '" data-operation-objective="' + e(ctx, objective.id) + '">' +
    '<span aria-hidden="true">' + (objective.achieved ? '✓' : '○') + '</span><span>' + e(ctx, objective.description) + '</span></li>').join('');
  const currentFacts = view.knownFactIds.includes(SCENE.fact) ? '<span>当前已知：控制台已检查</span>' : '';
  const heldItemNames = view.eventId === PARK_IDS.event ? view.heldItemIds.map(id => operationItemName(view, id)) : [];
  const heldItems = heldItemNames.length ? '<span>当前持有：' + e(ctx, heldItemNames.join('、')) + '</span>'
    : view.heldItemIds.includes(SCENE.item) ? '<span>当前持有：' + e(ctx, COPY.itemName) + '</span>' : '';
  const facts = currentFacts || heldItems ? '<div class="operation-current-items" aria-label="当前行动状态">' + currentFacts + heldItems + '</div>' : '';
  return '<section class="operation-context-card" data-operation-location="' + e(ctx, view.currentLocationId) + '">' +
    '<span class="operation-eyebrow">游乐园 · 当前场所</span><h2>' + e(ctx, location?.name ?? '行动现场') + '</h2><p>' + e(ctx, location?.description ?? '') + '</p>' +
    '<div class="operation-track-list">' + tracks + '</div><ul class="operation-objectives" aria-label="行动目标">' + objectives + '</ul>' + facts + '</section>';
}

function actionTargets(action: OperationViewSceneAction, actorId: string): string[] {
  return [...(actorId ? action.legalTargetActorIdsByActorId[actorId] ?? [] : action.legalActorlessTargetActorIds)];
}

function renderSceneControls(ctx: UIContext, view: OperationView): string {
  if (!view.currentActionMode || view.sceneActionBatchesRemaining < 1 || view.pendingSceneActionBatch) return '';
  const actions = view.currentSceneActions.filter(action => action.scope === view.currentActionMode);
  const students = view.actorStates.filter(actor => actor.participantKind === 'student' && actor.hp > 0);
  const draft = readOperationSceneDraft(view.runId, view.planVersion, view.currentLocationId);
  let controls = '';
  if (view.currentActionMode === 'global') {
    const fixed = actions.filter(action => action.selectionPolicy === 'fixed');
      const eligibleActions = actions.filter(action => action.selectionPolicy === 'required' && (action.performerPolicy !== 'selected-student' || action.eligibleActorIds.length > 0));
    const chosen = eligibleActions[0];
    const saved = draft?.selections[0];
    const selectedAction = eligibleActions.find(action => action.id === saved?.sceneActionId) ?? chosen;
    const fixedSummary = fixed.map(action => renderFixedSceneAction(ctx, action)).join('');
    const assignedActor = selectedAction?.performerPolicy !== 'none'
      ? students.find(actor => actor.id === saved?.actorId && selectedAction.eligibleActorIds.includes(actor.id))
      : undefined;
    controls = fixedSummary + (assignedActor
      ? '<p class="operation-muted">“' + e(ctx, selectedAction!.title) + '”已挂靠到' + e(ctx, actorLabel(assignedActor)) + '；拖动该行动卡到其他角色卡可更换执行者。</p>'
      : selectedAction
        ? renderSceneActionCard(ctx, view, '', eligibleActions, selectedAction)
        : '<p class="operation-muted">当前没有可执行的全队行动。</p>');
  } else {
    // Individual SceneActions are projected into each actor's shared card slot.
    controls = '';
  }
  const hand = view.playerCards.hand.length ? '<section class="operation-hand" data-operation-player-hand aria-label="玩家场景手牌"><header><strong>玩家手牌</strong><span>' +
    view.playerCards.hand.filter(card => !draft?.cards.some(selection => selection.cardInstanceId === card.cardInstanceId && selection.actorId)).length + ' 张在公共手牌 · 抽牌堆 ' + view.playerCards.drawPileCount + '</span></header><div class="operation-hand__fan" role="list">' + view.playerCards.hand.filter(card => !draft?.cards.some(selection => selection.cardInstanceId === card.cardInstanceId && selection.actorId)).map((card, index) => {
      const performers = card.eligibleActorIds;
      const label = card.title || actionLabel(view, card.actionId);
      const saved = draft?.cards.find(item => item.cardInstanceId === card.cardInstanceId);
      const selected = card.selectionPolicy === 'fixed' ? true : Boolean(saved);
      const selectedActorId = card.performerPolicy === 'none' ? '' : card.performerPolicy === 'optional-student'
        ? performers.includes(saved?.actorId ?? '') ? saved?.actorId ?? '' : ''
        : performers.includes(saved?.actorId ?? '') ? saved?.actorId ?? '' : card.selectionPolicy === 'fixed' ? performers[0] ?? '' : '';
      const targetIds = card.performerPolicy === 'none' || card.performerPolicy === 'optional-student' && !selectedActorId ? card.legalActorlessTargetActorIds : card.legalTargetActorIdsByActorId[selectedActorId] ?? [];
      const selectedTargetIds = saved?.targetActorIds ?? (targetIds.length === 1 ? targetIds : []);
      const selectedTargets = saved?.targetActorIds ?? (targetIds.length === 1 ? targetIds : []);
      const selectedTargetSummary = selectedTargets.length ? '→ ' + selectedTargets.map(id => targetName(view, id)).join('、') : targetIds.length ? '拖到目标上指定' : '无需指定目标';
      const actionCopy = card.description ?? actionDescription(view, card.actionId) ?? '在现场使用这张卡。';
      const cardAngle = (((index % 3) - 1) * 2.1);
      return '<div class="operation-player-card' + (selected ? ' is-selected' : '') + (card.selectionPolicy === 'fixed' ? ' is-fixed' : '') + '" data-operation-player-card="' + e(ctx, card.cardInstanceId) + '" role="listitem" style="--card-angle:' + cardAngle + 'deg"><button type="button" class="operation-card-face operation-card-face--player" data-operation-card-toggle data-card-kind="player-card" data-target-mode="' + e(ctx, view.currentActionMode ?? 'individual') + '" data-selected-target-actor-ids="' + e(ctx, JSON.stringify(selectedTargets)) + '" data-performer-policy="' + card.performerPolicy + '" data-operation-performer-candidate-actor-ids="' + e(ctx, JSON.stringify(performers)) + '" data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-player-cost="' + card.playerCost + '" data-actor-id="' + e(ctx, selectedActorId) + '" data-legal-target-actor-ids="' + e(ctx, JSON.stringify(targetIds)) + '" data-target-summary="' + e(ctx, selectedTargetSummary) + '" aria-pressed="' + String(Boolean(selected)) + '"' + (card.selectionPolicy === 'fixed' ? ' aria-disabled="true"' : '') + ' aria-label="' + e(ctx, label + '。' + actionCopy + '。' + card.playerCost + ' Cost。' + selectedTargetSummary + (card.selectionPolicy === 'fixed' ? '。固定加入，不可取消' : selected ? '。已加入本批' : '。拖到角色卡分配并加入')) + '"><strong class="operation-card-title">' + e(ctx, label) + '</strong><small class="operation-card-status" data-operation-card-status>' + (card.selectionPolicy === 'fixed' ? '固定纳入 · 不可取消' : selected ? '已加入' : '拖到角色卡分配执行者') + '</small>' + (card.selectionPolicy === 'fixed' ? '<small class="operation-card-fixed-status">✓ 固定纳入 · 不可取消</small>' : '') + '<small class="operation-card-description">' + e(ctx, actionCopy) + '</small><span class="operation-card-footer"><b>' + card.playerCost + ' Cost</b><span data-operation-card-target-summary>' + e(ctx, selectedTargetSummary) + '</span></span></button></div>';
    }).join('') + '</div><small class="operation-hand-note">打出的牌进入弃牌堆，本次行动不会洗回。</small></section>' :
    '<section class="operation-hand is-empty" data-operation-player-hand><strong>玩家手牌</strong><span>手牌 0 张 · 抽牌堆 ' + view.playerCards.drawPileCount + ' · 弃牌堆 ' + view.playerCards.discardCount + '</span></section>';
  const fixedSceneActions = actions.filter(action => action.selectionPolicy === 'fixed');
  const fixedSceneCost = view.currentActionMode === 'individual'
    ? students.length * fixedSceneActions.filter(action => action.scope === 'individual').reduce((sum, action) => sum + action.playerCost, 0)
    : fixedSceneActions.filter(action => action.scope === 'global').reduce((sum, action) => sum + action.playerCost, 0);
  const plannedSceneCost = fixedSceneCost + (draft?.selections ?? []).reduce((sum, selection) => {
    const action = actions.find(item => item.id === selection.sceneActionId && item.selectionPolicy !== 'fixed');
    return sum + (action?.playerCost ?? 0);
  }, 0);
  const fixedHandCost = view.playerCards.hand.filter(card => card.selectionPolicy === 'fixed').reduce((sum, card) => sum + card.playerCost, 0);
  const plannedCardCost = draft?.cards.reduce((total, selection) => {
    const card = view.playerCards.hand.find(item => item.cardInstanceId === selection.cardInstanceId);
    return total + (card?.selectionPolicy === 'required' ? card.playerCost : 0);
  }, fixedHandCost) ?? fixedHandCost;
  const estimatedCost = plannedSceneCost + plannedCardCost;
  const deficit = Math.max(0, estimatedCost - view.playerCost);
  return '<section class="operation-scene-actions" data-operation-scene-actions aria-label="场景行动"><header class="operation-section-heading"><span class="operation-eyebrow">' +
    (view.currentActionMode === 'individual' ? '每名学生可选 0–1 项' : '全队可选一项或跳过') + '</span><span>剩余批次 ' + view.sceneActionBatchesRemaining +
    '</span></header>' + (controls ? '<div class="operation-scene-selections">' + controls + '</div>' : '') + hand +
    '<p class="operation-cost-hint" data-operation-cost-preview data-player-cost="' + view.playerCost + '">本批实际支付 ' + estimatedCost + ' Cost · 余额 ' + view.playerCost + (deficit ? ' · 超出 ' + deficit + '，请取消部分选择' : ' · 未用余额保留') + '。不必花完 Cost；可部分选择或跳过本批。</p></section>';
}

function renderPending(ctx: UIContext, view: OperationView): string {
  const draft = view.pendingSceneActionBatch;
  if (!draft) return '';
  const labels = draft.preview.selections.map(selection => {
    const actor = view.actorStates.find(row => row.id === selection.actorId);
    return (actor?.displayName ?? (selection.actorId ? '学生' : '现场效果')) + '：' + sceneActionLabel(view, selection.sceneActionId);
  });
  labels.push(...draft.preview.cards.map(card => sceneCardLabel(view, card.cardInstanceId, card.actionId)));
  const actionCosts = draft.preview.actionCosts.map(cost => {
    const actor = view.actorStates.find(row => row.id === cost.actorId);
    const payer = cost.scope === 'team' ? '小组' : actor?.displayName ?? '角色';
    const resource = cost.resourceId === 'stamina' ? '体力' : cost.resourceId === 'coordination' ? '协调' : cost.resourceId;
    return payer + ' ' + resource + ' ' + cost.amount;
  });
  return '<section class="operation-pending-batch" data-operation-pending-batch><strong>待确认：' + e(ctx, labels.join('、')) +
    '</strong><span>本批次将支付 ' + draft.preview.cost.totalCost + ' Player Cost' + (actionCosts.length ? '；另扣执行费用：' + e(ctx, actionCosts.join('、')) : '') + '。</span></section>';
}

function renderRoutes(ctx: UIContext, view: OperationView): string {
  if (!view.currentRoutes.length) return '';
  const lockText = (reason: string | null): string => {
    if (reason === 'operation:route:location-incomplete') return '先完成当前地点目标。';
    if (reason === 'operation:route:max-visits-reached' || reason === 'operation:route:location-max-visits-reached') return '该地点已达访问上限。';
    if (reason === 'operation:route:required-held-item-missing') return '需要持有对应物品才能通过。';
    if (reason === 'operation:route:any-of-held-items-missing') return '需要至少一种所列凭证才能通过。';
    return reason ? '路线暂不可用。' : '';
  };
  const parkItemName = (itemId: string): string => itemId === PARK_IDS.items.maintenancePass ? '维修通行证'
    : itemId === PARK_IDS.items.staffRadio ? '员工广播凭证' : itemId;
  return '<section class="operation-route-choices" data-operation-routes aria-label="路线选择"><header><span class="operation-eyebrow">下一站</span><strong>选择离开方式</strong></header>' +
    view.currentRoutes.map(route => {
      const requirement = view.eventId !== PARK_IDS.event ? '' : route.requiredHeldItemId ? '需要：' + parkItemName(route.requiredHeldItemId)
        : route.anyOfHeldItemIds.length ? '需要其一：' + route.anyOfHeldItemIds.map(parkItemName).join(' / ') : '';
      return '<article class="operation-route-card" data-operation-route-card="' + e(ctx, route.routeId) + '"><div><strong>' + e(ctx, route.label) + '</strong><p>' +
      e(ctx, route.description) + '</p>' + (requirement ? '<small data-operation-route-requirement>' + e(ctx, requirement) + '</small>' : '') +
      (route.lockedReason ? '<small>' + e(ctx, lockText(route.lockedReason)) + '</small>' : '') + '</div><button type="button" data-operation-route data-run-id="' +
      e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '" data-route-id="' + e(ctx, route.routeId) + '"' + (route.available ? '' : ' disabled') +
      '>' + (route.available ? '前往' : '尚未开放') + '</button></article>';
    }).join('') + '</section>';
}

function renderStrategyParkMap(ctx: UIContext, view: OperationView): string {
  if (view.eventId !== PARK_IDS.event) return '';
  const nodeById = new Map(view.map.nodes.map(node => [node.locationId, node]));
  const locationIds = Object.keys(PARK_MAP.locations);
  if (locationIds.length !== 13 || locationIds.some(id => !nodeById.has(id))) return '';

  const position = (locationId: string): readonly [number, number] => PARK_MAP.locations[locationId as keyof typeof PARK_MAP.locations].position;
  const coordinate = (value: number, lower: number, upper: number): number => Math.max(lower, Math.min(upper, value));
  const lockText = (reason: string | null): string => {
    if (reason === 'operation:route:location-incomplete') return '先完成当前地点。';
    if (reason === 'operation:route:max-visits-reached' || reason === 'operation:route:location-max-visits-reached') return '该地点已达访问上限。';
    if (reason === 'operation:route:required-held-item-missing') return '缺少所需凭证。';
    if (reason === 'operation:route:any-of-held-items-missing') return '缺少任一可用凭证。';
    return reason ? '路线暂不可用。' : '';
  };
  const edges = view.map.edges.map(edge => {
    const source = position(edge.sourceLocationId);
    const target = position(edge.targetLocationId);
    const availability = edge.available === true ? 'available' : edge.available === false ? 'locked' : 'inactive';
    const fromName = PARK_MAP.locations[edge.sourceLocationId as keyof typeof PARK_MAP.locations].label;
    const targetName = PARK_MAP.locations[edge.targetLocationId as keyof typeof PARK_MAP.locations].label;
    const status = edge.available === true ? '当前出口可用' : edge.available === false ? '当前出口锁定' : '其他地点的路线';
    const requirement = edge.requiredHeldItemId ? '，需要' + operationItemName(view, edge.requiredHeldItemId)
      : edge.anyOfHeldItemIds.length ? '，需要其一：' + edge.anyOfHeldItemIds.map(id => operationItemName(view, id)).join(' / ') : '';
    return '<line class="operation-map-edge is-' + availability + '" data-operation-map-edge="' + e(ctx, edge.routeId) + '" data-edge-availability="' + availability +
      '" x1="' + coordinate(source[0], 9, 91) + '" y1="' + coordinate(source[1], 12, 88) + '" x2="' + coordinate(target[0], 9, 91) + '" y2="' + coordinate(target[1], 12, 88) + '" aria-label="' +
      e(ctx, fromName + '至' + targetName + '，' + status + requirement + (edge.lockedReason ? '：' + lockText(edge.lockedReason) : '')) + '"></line>';
  }).join('');
  const nodes = view.map.nodes.map(node => {
    const copy = PARK_MAP.locations[node.locationId as keyof typeof PARK_MAP.locations];
    const status = node.current ? 'current' : node.visited ? 'visited' : 'unvisited';
    const stateText = node.current ? '当前位置' : node.visited ? (node.completed ? '已访问 · 已完成' : '已访问') : '未访问';
    const x = coordinate(copy.position[0], 9, 91);
    const y = coordinate(copy.position[1], 12, 88);
    const visits = node.maxVisits === null ? '访问 ' + node.visitCount + ' 次' : '访问 ' + node.visitCount + ' / ' + node.maxVisits + ' 次';
    return '<div class="operation-map-node is-' + status + (node.completed ? ' is-completed' : '') + '" data-operation-map-node data-map-location-id="' + e(ctx, node.locationId) +
      '" data-map-status="' + status + '" data-map-completed="' + String(node.completed) + '" aria-label="' + e(ctx, copy.label + '，' + stateText + '，' + visits) +
      '" style="--map-x:' + x + '%;--map-y:' + y + '%"><strong>' + e(ctx, copy.label) + '</strong><small>' + e(ctx, stateText) + '</small></div>';
  }).join('');
  const areas = PARK_MAP.areas.map(area => '<span class="operation-map-area" data-operation-map-area="' + e(ctx, area.id) + '"><strong>' + e(ctx, area.label) +
    '</strong><small>' + area.locationIds.length + ' 个地点</small></span>').join('');
  const availableCount = view.map.edges.filter(edge => edge.sourceLocationId === view.currentLocationId && edge.available === true).length;
  const lockedCount = view.map.edges.filter(edge => edge.sourceLocationId === view.currentLocationId && edge.available === false).length;
  const blockedExit = view.locationProgress[view.currentLocationId]?.completed && availableCount === 0
    ? PARK_MAP.blockedExitMessages[view.currentLocationId as keyof typeof PARK_MAP.blockedExitMessages]
    : undefined;
  const regions = PARK_MAP.areas.map(area => {
    const coords = area.locationIds.map(position);
    const left = coordinate(Math.min(...coords.map(point => point[0])) - 5, 2, 92);
    const top = coordinate(Math.min(...coords.map(point => point[1])) - 8, 3, 88);
    const width = Math.max(8, Math.min(96 - left, Math.max(...coords.map(point => point[0])) - Math.min(...coords.map(point => point[0])) + 10));
    const height = Math.max(8, Math.min(94 - top, Math.max(...coords.map(point => point[1])) - Math.min(...coords.map(point => point[1])) + 16));
    return '<div class="operation-map-region" data-map-region="' + e(ctx, area.id) + '" style="--region-left:' + left + '%;--region-top:' + top + '%;--region-width:' + width + '%;--region-height:' + height + '%"><strong>' + e(ctx, area.label) + '</strong></div>';
  }).join('');
  return '<section class="operation-strategy-park-map" data-operation-strategy-park-map aria-label="Strategy Park 全地图"><header class="operation-strategy-park-map__heading"><div><span class="operation-eyebrow">路线总览</span><strong>' +
    e(ctx, PARK_MAP.title) + '</strong></div><div class="operation-map-exit-summary"><span class="is-available">当前可用出口 ' + availableCount + '</span><span class="is-locked">当前锁定出口 ' + lockedCount +
    '</span></div></header>' + (blockedExit ? '<p class="operation-map-blocked-exit" data-operation-map-blocked-exit>' + e(ctx, blockedExit) + '</p>' : '') +
    '<div class="operation-map-areas" aria-label="地图区域">' + areas + '</div><div class="operation-map-canvas" data-operation-map-canvas>' + regions + '<svg class="operation-map-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="路线连接图"><defs><marker id="strategy-park-map-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0 L8 4 L0 8 Z"></path></marker></defs>' +
    edges + '</svg>' + nodes + '</div><footer class="operation-map-legend"><span><i class="is-current"></i>当前位置</span><span><i class="is-visited"></i>已访问</span><span><i class="is-unvisited"></i>未访问</span><span><i class="is-available"></i>当前出口可用</span><span><i class="is-locked"></i>当前出口锁定</span></footer></section>';
}

interface OperationMapPresentation { readonly mapId: string; readonly title: string; readonly content: string; }

/** UI adapter: map availability and presentation are selected from the current OperationView context. */
function operationMapPresentation(ctx: UIContext, view: OperationView): OperationMapPresentation | null {
  if (view.status !== 'inProgress') return null;
  if (view.eventId === PARK_IDS.event) return { mapId: 'gameplay-b:strategy-park', title: PARK_MAP.title, content: renderStrategyParkMap(ctx, view) };
  return null;
}

function renderInlineMapCard(ctx: UIContext, view: OperationView): string {
  const map = operationMapPresentation(ctx, view);
  if (!map) return '';
  const mapId = map.mapId;
  const state = operationUIState(view);
  state.seenMaps.add(mapId);
  if (state.closedMapCards.has(mapId)) return '';
  return '<section class="operation-map-intro" data-operation-map-intro="' + e(ctx, mapId) + '"><header><strong>' + e(ctx, map.title) + '</strong><button type="button" data-operation-map-card-close="' + e(ctx, mapId) + '" data-run-id="' + e(ctx, view.runId) + '" aria-label="关闭流内地图">关闭</button></header>' + map.content + '</section>';
}

function renderMapPopup(ctx: UIContext, view: OperationView): string {
  const map = operationMapPresentation(ctx, view);
  const state = operationUIState(view);
  const mapId = map?.mapId ?? '';
  if (!mapId) state.popupMap = null;
  else if (state.popupMap && state.popupMap !== mapId) state.popupMap = mapId;
  return '<section class="operation-map-popup" id="operation-map-popup" data-operation-map-popup="' + e(ctx, mapId) + '" role="dialog" aria-label="地图窗口"' + (state.popupMap === mapId && mapId ? '' : ' hidden') + ' style="--operation-map-x:' + state.mapPosition.x + 'px;--operation-map-y:' + state.mapPosition.y + 'px"><header class="operation-map-popup__bar" data-operation-map-drag-handle tabindex="0" aria-label="拖动地图窗口；方向键移动，按 Escape 关闭"><strong>' + e(ctx, map?.title ?? '地图') + '</strong><button type="button" data-operation-map-popup-close aria-label="关闭地图窗口">×</button></header><div class="operation-map-popup__content">' + (map?.content ?? '') + '</div></section>';
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
      .map(plan => actorName(plan.actorId) + '使用' + actionLabel(view, plan.actionId));
    const selections = batch.selections.map(selection => {
      const actor = selection.actorId ? actorName(selection.actorId) : '现场效果';
      const action = sceneActionLabel(view, selection.sceneActionId);
      const target = selection.targetActorIds.length ? ' → ' + selection.targetActorIds.map(actorName).join('、') : '';
      return actor + '使用' + action + target;
    });
    const cards = batch.cards.map(card => {
      const label = sceneCardLabel(view, card.cardInstanceId, card.actionId);
      const target = card.targetActorIds.length ? ' → ' + card.targetActorIds.map(actorName).join('、') : '';
      return (card.actorId ? actorName(card.actorId) : '现场效果') + '打出' + label + target + '（' + card.playerCost + ' Cost）';
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
    const locationName = locationPresentation(view, resolution.locationId)?.name ?? '行动现场';
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
      const from = locationPresentation(view, record.fromLocationId)?.name ?? '行动现场';
      const to = locationPresentation(view, record.toLocationId)?.name ?? '行动现场';
      const item = record.consumedHeldItemId ? ' · 消耗' + operationItemName(view, record.consumedHeldItemId) : '';
      const cost = record.playerCostBeforeExit === undefined ? '' : ' · 离场 Cost ' + record.playerCostBeforeExit + (record.playerCostAfterCarryLimit === undefined ? '' : ' → ' + record.playerCostAfterCarryLimit);
      return '<li data-operation-route-history-item data-route-id="' + e(ctx, record.routeId) + '" data-from-location-id="' + e(ctx, record.fromLocationId) + '" data-to-location-id="' + e(ctx, record.toLocationId) + '"><span>' + e(ctx, from + ' → ' + to + item + cost) + '</span></li>';
    }).join('') + '</ol>' : '';
  const entries = view.locationEntryCostHistory.length
    ? '<ol aria-label="地点入场费用记录">' + view.locationEntryCostHistory.map(record => '<li data-operation-entry-cost-item><span>第 ' + record.visitSequence + ' 次进入' + e(ctx, locationPresentation(view, record.locationId)?.name ?? '行动现场') + ' · Cost ' + record.balanceBefore + ' + ' + record.costGain + ' = ' + record.balanceAfter + '</span></li>').join('') + '</ol>'
    : '';
  const label = view.routeHistory.length ? '路线履历 · ' + view.routeHistory.length + ' 次转场' : '地点费用记录';
  return '<details class="operation-route-history" data-operation-route-history><summary>' + label + '</summary>' + routes + entries + '</details>';
}

function renderMain(ctx: UIContext, view: OperationView, notice: string | null): string {
  const location = locationPresentation(view, view.currentLocationId);
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
    title = view.currentLocationId === SCENE.locations.concourse ? '战斗已结束 · 处理现场行动' : '处理出口现场行动';
    description = '只结算已选行动；未用 Cost 保留，也可跳过本批。';
    button = '<button type="button" class="operation-commit-button" data-operation-scene-submit data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '">确认本批</button><button type="button" class="operation-clear-scene" data-operation-scene-skip data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) + '">跳过本批</button>';
  } else if (canBattle) {
    title = view.canCommit ? '旋转木马安全战斗 · 本回合方案已就绪' : '旋转木马安全战斗 · 还需要处理计划问题';
    description = view.commitBlockedReasonIds.map(id => REASONS[id]).filter(Boolean).join(' ') || '学生计划附在左侧角色卡，可修订一名学生。';
    button = '<button type="button" class="operation-commit-button" data-operation-commit data-run-id="' + e(ctx, view.runId) + '" data-plan-version="' + e(ctx, view.planVersion) +
      '"' + (view.canCommit ? '' : ' disabled') + '>提交本回合</button>';
  } else {
    title = view.currentLocationId === SCENE.locations.concourse ? '安全战斗已结束 · 选择离场通道' : '出口现场已处理';
    description = view.currentLocationId === SCENE.locations.concourse
      ? '员工通道与游客通道都会前往出口；战斗只在旋转木马平台进行。'
      : '查看当前地点可用的行动或结案状态。';
  }
  const eventTitle = view.eventId === PARK_IDS.event ? PARK_MAP.title : COPY.event.title;
  return '<main class="operation-chat" aria-label="行动对话与决策"><header class="operation-chat-heading"><div><span class="operation-eyebrow">夏莱行动记录 · 游乐园</span><h1>' +
    e(ctx, eventTitle) + '</h1><small>' + e(ctx, location?.name ?? '行动现场') + ' · 第 ' + (view.beatIndex + 1) + ' 次推进</small></div><button type="button" class="operation-back-button" data-operation-back>返回聊天流</button></header>' +
    '<div class="operation-chat-stream" data-scroll="content-region" data-operation-log role="log" aria-live="polite" aria-relevant="additions text">' +
    (notice ? '<p class="operation-command-notice" data-operation-command-notice role="alert" tabindex="-1">' + e(ctx, notice) + '</p>' : '') +
    '<div class="chat-talk chat-talk-npc operation-opening-message"><span class="chat-avatar"><span class="chat-avatar-fallback">安</span></span><div class="chat-talk-main"><div class="chat-name"><span>游乐园安全员</span></div>' +
    '<div class="chat-bubble chat-bubble-npc"><p>' + e(ctx, COPY.event.introduction) + '</p></div></div></div>' + renderProgress(ctx, view) + renderInlineMapCard(ctx, view) +
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
  const transient = view ? operationUIState(view) : null;
  const mapId = view ? operationMapPresentation(ctx, view)?.mapId ?? '' : '';
  if (transient) {
    if (!mapId) transient.popupMap = null;
    else if (transient.popupMap && transient.popupMap !== mapId) transient.popupMap = mapId;
  }
  const left = view
    ? '<aside class="operation-party-column" aria-label="我方学生" data-operation-party data-scroll-owner="content-region"><div class="operation-party-list">' + students.map(actor => renderStudent(ctx, view, actor, battle)).join('') + '</div></aside>'
    : '<aside class="operation-party-column" aria-hidden="true"></aside>';
  const center = view ? renderMain(ctx, view, notice) : renderUnavailable(ctx, notice);
  const right = view ? renderOpponents(ctx, view, transient?.rightTab !== 'background') + renderBackground(view, ctx, transient?.rightTab === 'background') : '<aside class="operation-opponent-column" aria-hidden="true"></aside>';
  const leftHeader = '<span class="operation-eyebrow">我方</span><strong>' + students.length + ' 位学生</strong>';
  const rightHeader = view
    ? '<div class="operation-right-header"><div class="operation-right-tabs" role="tablist" aria-label="行动信息"><button type="button" role="tab" data-operation-right-tab="enemies" data-run-id="' + e(ctx, view!.runId) + '" aria-selected="' + String(transient?.rightTab === 'enemies') + '" tabindex="' + (transient?.rightTab === 'enemies' ? '0' : '-1') + '">敌人</button><button type="button" role="tab" data-operation-right-tab="background" data-run-id="' + e(ctx, view!.runId) + '" aria-selected="' + String(transient?.rightTab === 'background') + '" tabindex="' + (transient?.rightTab === 'background' ? '0' : '-1') + '">背景 / 持有物</button></div>' + (mapId ? '<button type="button" class="operation-map-open" data-operation-map-open="' + e(ctx, mapId) + '" data-run-id="' + e(ctx, view!.runId) + '" aria-controls="operation-map-popup" aria-expanded="' + String(transient?.popupMap === mapId) + '">地图</button>' : '') + '</div>'
    : '<span class="operation-eyebrow">行动信息</span>';
  const popup = view ? renderMapPopup(ctx, view) : '';
  const preparedCards = view ? renderPreparedCardLayer(ctx, view, battle, students) : '';
  const relationLayer = '<svg class="operation-relation-layer" data-operation-relation-layer aria-hidden="true" focusable="false"><defs><marker id="operation-card-arrowhead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L8 4 L0 8 Z"></path></marker></defs><path class="operation-relation-path" data-operation-drag-relation visibility="hidden"></path></svg>';
  const dragStatus = '<p class="operation-card-drag-status" data-operation-drag-status role="status" aria-live="polite" hidden></p>';
  return renderWorkspaceFrame(ctx, {
    id: 'operation',
    layout: { composition: 'columns', responsive: 'default' },
    left: { slot: 'left', role: 'our-team', workspaceOwner: 'operation', hostId: 'leftPanel.operation.party', themeScope: 'left.operation.party', surface: 'panel', header: leftHeader, className: 'operation-workspace__party', content: left, scroll: 'none' },
    center: { slot: 'center', role: 'information', workspaceOwner: 'operation', hostId: 'centerPanel.operation.chat', themeScope: 'center.operation.chat', surface: 'panel', className: 'operation-workspace__center', content: center, scroll: 'none' },
    right: { slot: 'right', role: 'opponents', workspaceOwner: 'operation', hostId: 'rightPanel.operation.opponents', themeScope: 'right.operation.opponents', surface: 'panel', header: rightHeader, className: 'operation-workspace__opponents', content: right, scroll: 'none' },
    overlay: preparedCards + relationLayer + dragStatus + popup,
  });
}
