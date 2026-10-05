import { Character } from '../arona-clicker/types/ids';
import { CAROUSEL_SCENE_ACTION_IDS } from '../arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { OperationAdmissionError } from '../arona-clicker/services/operation-participant-admission';
import { OperationInterventionPreviewError } from '../arona-clicker/services/operation-intervention-preview';
import { OperationRuntimeError } from '../arona-clicker/services/operation-runtime-service';
import type { OperationSceneActionBatchCommand } from '../arona-clicker/contracts/operation-scene-action';
import type { OperationView } from '../arona-clicker/contracts/operation-view';
import type { UIController } from './controller';
import { readOperationSceneDraft, saveOperationSceneDraft, type OperationSceneDraft } from './components/operation-workspace';

const OPERATION_INIT_ID = 'base:init:schale_office';
const OPERATION_REGION_HOST_ID = 'workspace.operation';
const DEMO_STUDENTS = [
  { id: Character.Hoshino, name: '星野' },
  { id: Character.Serika, name: '芹香' },
  { id: Character.Shiroko, name: '白子' },
] as const;

export type OperationFocusTarget =
  | { readonly type: 'action'; readonly actorId: string; readonly actionId: string }
  | { readonly type: 'target'; readonly actorId: string; readonly actionId: string; readonly targetActorId: string }
  | { readonly type: 'clear'; readonly actorId: string }
  | { readonly type: 'commit' };

const boundControllers = new WeakSet<UIController>();

function operationErrorText(error: unknown): string {
  if (error instanceof OperationAdmissionError) {
    const missing = DEMO_STUDENTS.filter(student => error.diagnostics.some(diagnostic =>
      diagnostic.includes(`Character ${student.id}`)
      && (diagnostic.includes('has no owned Registry Variant') || diagnostic.includes('is not unlocked')),
    ));
    if (missing.length > 0) {
      return `还需要持有并解锁${missing.map(student => student.name).join('、')}；这次试玩不会自动补发学生。`;
    }
    return '试玩准入检查没有通过，请确认星野、芹香与白子都已持有并解锁。';
  }
  if (error instanceof OperationInterventionPreviewError) {
    if (error.code === 'operation:intervention:action-not-affordable') return '剩余行动资源不足，无法采用这个方案。';
    if (error.code === 'operation:intervention:plan-conflict') return '这个方案与当前其他行动冲突；可以先取消已有修订。';
    if (error.code === 'operation:intervention:no-legal-target' || error.code === 'operation:intervention:invalid-target') return '目标已经变化，请检查当前行动计划后重选。';
    if (error.code === 'operation:intervention:stale-plan') return '行动计划刚刚更新了，已刷新状态，请再试一次。';
    return '这个行动现在无法修改，已刷新当前计划。';
  }
  if (error instanceof OperationRuntimeError && error.diagnostics.some(message => message.includes('stale'))) {
    return '行动计划刚刚更新了，已刷新状态，请再试一次。';
  }
  return '操作暂时无法完成，已刷新当前行动状态。';
}

function readCommandVersion(element: HTMLElement): { runId: string; planVersion: number } | null {
  const runId = element.dataset.runId;
  const planVersion = Number(element.dataset.planVersion);
  if (!runId || !Number.isSafeInteger(planVersion) || planVersion < 0) return null;
  return { runId, planVersion };
}

function refreshAfterCommand(ctrl: UIController, runId: string, focus: OperationFocusTarget, notice: string | null = null): void {
  const view = ctrl.game.operationEntry.getView(runId);
  ctrl.requestOperationWorkspaceRefresh(view, focus, notice);
}

function startSample(ctrl: UIController): void {
  if (ctrl.game.state.activeInit !== OPERATION_INIT_ID) return;
  try {
    const run = ctrl.game.operationEntry.start(CAROUSEL_SCENE_ACTION_IDS.event, DEMO_STUDENTS.map(student => student.id));
    ctrl.openOperationWorkspace(run.runId);
    // Route identity changes once; renderWorkspace reads the newly started OperationView once.
    ctrl.render();
  } catch (error) {
    const message = operationErrorText(error);
    // The single authoritative view query happens inside the ensuing center-region render.
    ctrl.pushChat({ kind: 'system', text: `游乐园试玩未能开始：${message}` });
    ctrl.requestUIUpdate({ type: 'region', hostId: 'centerPanel.chat', reason: 'operation-admission-failed' });
    ctrl.flushUIUpdates();
  }
}

function handleOperationClick(ctrl: UIController, event: MouseEvent): void {
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) return;
  const target = rawTarget.closest<HTMLElement>(
    '[data-operation-start], [data-operation-resume-run], [data-operation-back], [data-operation-action], [data-operation-target], [data-operation-clear], [data-operation-commit], [data-operation-scene-stage], [data-operation-scene-commit], [data-operation-clear-scene], [data-operation-route], [data-operation-reward], [data-operation-scene-choice], [data-operation-scene-target], [data-operation-scene-performer], [data-operation-card-toggle], [data-operation-card-actor], [data-operation-card-target]',
  );
  if (!target || target instanceof HTMLButtonElement && target.disabled) return;
  const updateCostPreview = (workspace: HTMLElement | null): void => {
    if (!workspace) return;
    const preview = workspace.querySelector<HTMLElement>('[data-operation-cost-preview]');
    if (!preview) return;
    const sceneCards = [...workspace.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')];
    const globalCard = workspace.querySelector<HTMLElement>('[data-global-scene-card]');
    const selectedSceneCards = globalCard ? [globalCard] : sceneCards;
    const sceneCost = selectedSceneCards.reduce((sum, card) => {
      const selected = card.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]');
      return sum + Number(selected?.dataset.playerCost ?? 0);
    }, 0);
    const selectedCardCost = [...workspace.querySelectorAll<HTMLElement>('[data-operation-player-card].is-selected [data-operation-card-toggle]')]
      .reduce((sum, button) => sum + Number(button.dataset.playerCost ?? 0), 0);
    const total = sceneCost + selectedCardCost;
    const balance = Number(preview.dataset.playerCost ?? 0);
    const deficit = Math.max(0, total - balance);
    preview.textContent = '本批预计 ' + total + ' Cost · 余额 ' + balance + (deficit ? ' · 超出 ' + deficit : ' · 余额足够') + '。确认整批行动时统一扣除费用。';
  };

  if (target.matches('[data-operation-scene-choice]')) {
    const card = target.closest<HTMLElement>('[data-operation-scene-card]');
    const selectedOption = target.closest<HTMLElement>('[data-operation-scene-option]');
    card?.querySelectorAll<HTMLElement>('[data-operation-scene-choice]').forEach(button => {
      const selected = button === target;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
    });
    card?.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(option => option.classList.toggle('is-selected', option === selectedOption));
    const currentAction = card?.querySelector<HTMLElement>('.operation-scene-card__current [data-operation-scene-choice] strong');
    const selectedAction = target.querySelector('strong')?.textContent;
    if (currentAction && selectedAction) currentAction.textContent = selectedAction;
    if (card) card.dataset.selectedSceneActionId = target.dataset.sceneActionId ?? '';
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-scene-target]')) {
    const group = target.closest<HTMLElement>('.operation-scene-targets');
    if (group?.dataset.targetMode === 'global') {
      target.setAttribute('aria-pressed', String(target.getAttribute('aria-pressed') !== 'true'));
    } else {
      group?.querySelectorAll<HTMLElement>('[data-operation-scene-target]').forEach(button => {
        const selected = button === target;
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-scene-performer]')) {
    const group = target.closest<HTMLElement>('.operation-scene-performers');
    group?.querySelectorAll<HTMLElement>('[data-operation-scene-performer]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    const card = target.closest<HTMLElement>('[data-global-scene-card]');
    const choice = card?.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]');
    if (choice) choice.dataset.actorId = target.dataset.actorId ?? '';
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-card-toggle]')) {
    const selected = target.getAttribute('aria-pressed') !== 'true';
    target.setAttribute('aria-pressed', String(selected));
    target.closest<HTMLElement>('[data-operation-player-card]')?.classList.toggle('is-selected', selected);
    const status = target.querySelector<HTMLElement>('span:last-child');
    if (status) status.textContent = selected ? '已选择' : '加入本批';
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-card-actor]')) {
    const group = target.closest<HTMLElement>('.operation-card-performers');
    group?.querySelectorAll<HTMLElement>('[data-operation-card-actor]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    const card = target.closest<HTMLElement>('[data-operation-player-card]');
    card?.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]').forEach(targets => {
      targets.hidden = targets.dataset.operationCardTargetsFor !== target.dataset.actorId;
    });
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-card-target]')) {
    const group = target.closest<HTMLElement>('.operation-card-targets');
    if (group?.dataset.targetMode === 'global') {
      target.setAttribute('aria-pressed', String(target.getAttribute('aria-pressed') !== 'true'));
    } else {
      group?.querySelectorAll<HTMLElement>('[data-operation-card-target]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    }
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }

  if (target.hasAttribute('data-operation-start')) {
    startSample(ctrl);
    return;
  }
  if (target.hasAttribute('data-operation-resume-run')) {
    if (ctrl.game.state.activeInit !== OPERATION_INIT_ID) return;
    const runId = target.dataset.operationResumeRun;
    if (!runId) return;
    ctrl.openOperationWorkspace(runId);
    ctrl.render();
    return;
  }
  if (target.hasAttribute('data-operation-back')) {
    if (ctrl.panelState.workspace?.type === 'operation') ctrl.disposeWorkspace();
    return;
  }

  if (ctrl.panelState.workspace?.type !== 'operation') return;
  const command = readCommandVersion(target);
  if (!command || command.runId !== ctrl.panelState.workspace.runId) return;
  const runId = command.runId;

  try {
    if (target.hasAttribute('data-operation-action')) {
      const actorId = target.dataset.actorId;
      const actionId = target.dataset.actionId;
      if (!actorId || !actionId || target.getAttribute('aria-pressed') === 'true') return;
      const targetActorId = target.dataset.defaultTargetActorId;
      ctrl.game.operationEntry.reviseIntervention({
        ...command,
        draft: { actorId, actionId, ...(targetActorId ? { targetActorId } : {}) },
      });
      refreshAfterCommand(ctrl, runId, { type: 'action', actorId, actionId });
      return;
    }

    if (target.hasAttribute('data-operation-target')) {
      const actorId = target.dataset.actorId;
      const actionId = target.dataset.actionId;
      const targetActorId = target.dataset.targetActorId;
      if (!actorId || !actionId || !targetActorId || target.getAttribute('aria-pressed') === 'true') return;
      ctrl.game.operationEntry.reviseIntervention({
        ...command,
        draft: { actorId, actionId, targetActorId },
      });
      refreshAfterCommand(ctrl, runId, { type: 'target', actorId, actionId, targetActorId });
      return;
    }

    if (target.hasAttribute('data-operation-clear')) {
      const actorId = target.dataset.actorId;
      if (!actorId) return;
      ctrl.game.operationEntry.clearIntervention(command);
      refreshAfterCommand(ctrl, runId, { type: 'clear', actorId });
      return;
    }

    if (target.hasAttribute('data-operation-commit')) {
      ctrl.game.operationEntry.commitBeat(command);
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
      return;
    }

    if (target.hasAttribute('data-operation-scene-stage')) {
      const view = ctrl.game.operationEntry.getView(runId);
      if (!view) return;
      const batch = readSceneBatchCommand(target, view, command);
      saveOperationSceneDraft(runId, command.planVersion, view.currentLocationId, batch as OperationSceneDraft);
      ctrl.game.operationEntry.stageSceneActionBatch(batch);
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
      return;
    }

    if (target.hasAttribute('data-operation-scene-commit')) {
      ctrl.game.operationEntry.commitStagedSceneActionBatch(command);
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
      return;
    }

    if (target.hasAttribute('data-operation-clear-scene')) {
      const view = ctrl.game.operationEntry.getView(runId);
      const locationId = view?.currentLocationId;
      const pending = view?.pendingSceneActionBatch?.preview;
      ctrl.game.operationEntry.clearSceneActionBatchDraft(command);
      const updated = locationId ? ctrl.game.operationEntry.getView(runId) : null;
      if (pending && updated) {
        const draft: OperationSceneDraft = {
          selections: pending.selections.map(selection => ({ sceneActionId: selection.sceneActionId, actorId: selection.actorId, targetActorIds: selection.targetActorIds })),
          cards: pending.cards.map(card => ({ cardInstanceId: card.cardInstanceId, actorId: card.actorId, targetActorIds: card.targetActorIds })),
        };
        saveOperationSceneDraft(runId, updated.planVersion, updated.currentLocationId, draft);
        ctrl.requestOperationWorkspaceRefresh(updated, { type: 'commit' });
        return;
      }
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
      return;
    }

    if (target.hasAttribute('data-operation-route')) {
      const routeId = target.dataset.routeId;
      if (!routeId) return;
      ctrl.game.operationEntry.transitionRoute({ ...command, routeId });
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
      return;
    }

    if (target.hasAttribute('data-operation-reward')) {
      ctrl.game.operationEntry.claimOutcomeReward();
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
    }
  } catch (error) {
    const message = operationErrorText(error);
    try {
      refreshAfterCommand(ctrl, runId, { type: 'commit' }, message);
    } catch {
      ctrl.toast.show(message, 'error');
    }
  }
}

function readSceneBatchCommand(
  target: HTMLElement,
  view: OperationView,
  command: { readonly runId: string; readonly planVersion: number },
): OperationSceneActionBatchCommand {
  const workspace = target.closest<HTMLElement>('[data-workspace-frame="operation"]');
  if (!workspace || !view.currentActionMode) throw new Error('Scene action controls are unavailable');
  const selections: Array<{ sceneActionId: string; actorId: string; targetActorIds: readonly string[] }> = [];
  if (view.currentActionMode === 'individual') {
    for (const card of workspace.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')) {
      const actorId = card.dataset.actorId;
      const selected = card.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]');
      const sceneActionId = selected?.dataset.sceneActionId;
      if (!actorId || !sceneActionId) throw new Error('请为每位学生选择一项行动。');
      const action = view.currentSceneActions.find(item => item.id === sceneActionId);
      if (!action) throw new Error('所选场景行动已经失效，请重新选择。');
      const chosenTargets = [...(selected.closest<HTMLElement>('[data-operation-scene-option]')?.querySelectorAll<HTMLElement>('.operation-scene-targets [data-operation-scene-target][aria-pressed="true"]') ?? [])].map(button => button.dataset.targetActorId).filter((id): id is string => Boolean(id));
      selections.push({ sceneActionId, actorId, targetActorIds: chosenTargets.length ? chosenTargets : action.legalTargetActorIdsByActorId[actorId] ?? [] });
    }
  } else {
    const global = workspace.querySelector<HTMLElement>('[data-global-scene-card]');
    const selected = global?.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]');
    const performer = global?.querySelector<HTMLElement>('[data-operation-scene-performer][aria-pressed="true"]');
    if (!selected?.dataset.sceneActionId || !performer?.dataset.actorId) throw new Error('请选择全局行动和执行者。');
    const action = view.currentSceneActions.find(item => item.id === selected.dataset.sceneActionId);
    if (!action) throw new Error('所选场景行动已经失效，请重新选择。');
    const targetGroup = selected.closest<HTMLElement>('[data-operation-scene-option]')?.querySelector<HTMLElement>('.operation-scene-targets');
    const selectedTargets = [...(targetGroup?.querySelectorAll<HTMLElement>('[data-operation-scene-target][aria-pressed="true"]') ?? [])].map(button => button.dataset.targetActorId).filter((id): id is string => Boolean(id));
    if (targetGroup?.dataset.targetMode === 'global' && selectedTargets.length === 0) throw new Error('全局行动至少要选择一名目标。');
    selections.push({ sceneActionId: action.id, actorId: performer.dataset.actorId, targetActorIds: selectedTargets.length ? selectedTargets : action.legalTargetActorIdsByActorId[performer.dataset.actorId] ?? [] });
  }
  const cards: Array<{ cardInstanceId: string; actorId: string; targetActorIds: readonly string[] }> = [];
  for (const card of workspace.querySelectorAll<HTMLElement>('[data-operation-player-card].is-selected')) {
    const cardInstanceId = card.dataset.operationPlayerCard;
    const actorId = card.querySelector<HTMLElement>('[data-operation-card-actor][aria-pressed="true"]')?.dataset.actorId;
    if (!cardInstanceId || !actorId) throw new Error('玩家卡牌执行者无效。');
    const viewCard = view.playerCards.hand.find(item => item.cardInstanceId === cardInstanceId);
    if (!viewCard) throw new Error('玩家卡牌已离开手牌，请重新选择。');
    const action = view.currentSceneActions.find(item => item.actionId === viewCard.actionId && item.eligibleActorIds.includes(actorId));
    if (!viewCard.eligibleActorIds.includes(actorId)) throw new Error('玩家卡牌执行者已失效，请重新选择。');
    const targetGroup = [...card.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]')]
      .find(group => group.dataset.operationCardTargetsFor === actorId);
    const selectedTargets = [...(targetGroup?.querySelectorAll<HTMLElement>('[data-operation-card-target][aria-pressed="true"]') ?? [])]
      .map(button => button.dataset.targetActorId).filter((id): id is string => Boolean(id));
    if (targetGroup && selectedTargets.length === 0) throw new Error('玩家卡牌至少要选择一名目标。');
    cards.push({ cardInstanceId, actorId, targetActorIds: selectedTargets });
  }
  return { ...command, selections, ...(cards.length ? { cards } : {}) };
}

/** Stable #app delegation survives Operation region replacements and ordinary selections. */
export function bindOperationActions(ctrl: UIController): void {
  if (boundControllers.has(ctrl)) return;
  boundControllers.add(ctrl);
  ctrl.root.addEventListener('click', event => handleOperationClick(ctrl, event));
}
