import { Character } from '../arona-clicker/types/ids';
import { OperationAdmissionError } from '../arona-clicker/services/operation-participant-admission';
import { OperationInterventionPreviewError } from '../arona-clicker/services/operation-intervention-preview';
import { OperationRuntimeError } from '../arona-clicker/services/operation-runtime-service';
import type { OperationSceneActionBatchCommand } from '../arona-clicker/contracts/operation-scene-action';
import type { OperationView } from '../arona-clicker/contracts/operation-view';
import type { UIController } from './controller';
import { clearOperationSceneDraft, closeOperationMapCard, closeOperationWorkspaceMap, moveOperationWorkspaceMap, readOperationSceneDraft, saveOperationSceneDraft, setOperationWorkspaceTab, toggleOperationWorkspaceMap, type OperationSceneDraft } from './components/operation-workspace';
import { operationRelationAnchors, operationRelationPath } from './operation-card-relation';
import { createUIContext } from './context';
import { getSpotReveal } from './components/tooltip';

const OPERATION_REGION_HOST_ID = 'workspace.operation';
const DEMO_STUDENTS = [
  { id: Character.Hoshino, name: '星野' },
  { id: Character.Serika, name: '芹香' },
  { id: Character.Shiroko, name: '白子' },
] as const;

export type OperationFocusTarget =
  | { readonly type: 'action'; readonly actorId: string; readonly actionId: string }
  | { readonly type: 'clear'; readonly actorId: string }
  | { readonly type: 'commit' };

const boundControllers = new WeakSet<UIController>();
const disposedOperationControllers = new WeakSet<UIController>();

function operationErrorText(error: unknown, selectedCharacterIds?: readonly string[]): string {
  if (error instanceof OperationAdmissionError) {
    const roster = selectedCharacterIds ?? DEMO_STUDENTS.map(student => student.id);
    const missing = roster.filter(characterId => error.diagnostics.some(diagnostic =>
      diagnostic.includes(`Character ${characterId}`)
      && (diagnostic.includes('has no owned Registry Variant') || diagnostic.includes('is not unlocked')),
    ));
    if (missing.length > 0) {
      const names = missing.map(characterId => DEMO_STUDENTS.find(student => student.id === characterId)?.name ?? characterId);
      return `还需要持有并解锁${names.join('、')}；这次试玩不会自动补发学生。`;
    }
    return '试玩准入检查没有通过，请确认入口卡列出的学生均已持有并解锁；不会自动补发角色。';
  }
  if (error instanceof OperationInterventionPreviewError) {
    if (error.code === 'operation:intervention:action-not-affordable') return '剩余行动资源不足，无法采用这个方案。';
    if (error.code === 'operation:intervention:plan-conflict') return '这个方案与当前其他行动冲突；可以先取消已有修订。';
    if (error.code === 'operation:intervention:group-target-scene-only') return '全体合格目标仅支持场景行动。';
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
  updateCostPreview(ctrl, operationWorkspaceHost(ctrl.root));
}

function scenePreviewErrorText(error: unknown): string {
  const detail = error instanceof OperationRuntimeError ? error.diagnostics.join(' ') : error instanceof Error ? error.message : '';
  if (/恰好选择/.test(detail)) return detail;
  const exactChoice = detail.match(/SceneAction choice requires exactly (\d+) of (\d+) offers; received (\d+)/);
  if (exactChoice) return '请从 ' + exactChoice[2] + ' 项候选中恰好选择 ' + exactChoice[1] + ' 项；当前选择 ' + exactChoice[3] + ' 项。';
  if (/unaffordable|resource costs exceed|cost exceeds/i.test(detail)) return '本批费用不足；请取消部分选择或改选执行者。';
  if (/target count is invalid|at least one|至少选择一名|选择一名目标/i.test(detail)) return '请为已选行动明确指定合法目标。';
  if (/target.*outside|target.*invalid|目标已经失效|所选场景目标/i.test(detail)) return '目标已经变化，请重新选择合法目标。';
  if (/performer|执行者|qualified/i.test(detail)) return '请为所选行动分配一名合格执行者。';
  if (/stale|planVersion/i.test(detail)) return '行动计划刚刚更新了，请重新检查本批。';
  return '当前方案无法结算；请检查执行者、目标和费用。';
}

function updateCostPreview(ctrl: UIController, workspace: HTMLElement | null): void {
  if (!workspace) return;
  const previewNode = workspace.querySelector<HTMLElement>('[data-operation-cost-preview]');
  const submit = workspace.querySelector<HTMLButtonElement>('[data-operation-scene-submit]');
  if (!previewNode || !submit) return;
  const command = readCommandVersion(submit);
  const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
  if (!command || !view || view.planVersion !== command.planVersion
    || view.currentActionMode === null && view.currentScene?.autoCharacterActions !== true) {
    previewNode.dataset.previewStatus = 'unavailable';
    previewNode.textContent = '行动计划已更新，请重新检查本批。';
    submit.disabled = true;
    return;
  }
  try {
    const draft = saveSceneDraftFromWorkspace(workspace) ?? { selections: [], cards: [] };
    const choiceCount = workspace.querySelector<HTMLElement>('[data-scene-choice-count]');
    if (choiceCount && view.currentSceneActionChoice) {
      const count = draft.selections.filter(selection => view.currentSceneActionChoice!.candidateSceneActionIds.includes(selection.sceneActionId)).length;
      choiceCount.textContent = '已选 ' + count + ' / ' + view.currentSceneActionChoice.chooseExactly;
    }
    const batch = readOperationSceneBatchCommand(view, command, draft);
    const result = ctrl.game.operationEntry.previewSceneActionBatch(batch);
    const actionCosts = result.actionCosts.map(cost => {
      const actorName = view.actorStates.find(actor => actor.id === cost.actorId)?.displayName ?? '角色';
      const payer = cost.scope === 'team' ? '小组' : actorName;
      const resource = cost.resourceId === 'stamina' ? '体力' : cost.resourceId === 'coordination' ? '协调' : cost.resourceId === 'focus' ? '专注' : cost.resourceId;
      return payer + ' ' + resource + ' ' + cost.amount;
    });
    const balance = result.cost;
    previewNode.dataset.previewStatus = 'valid';
    previewNode.textContent = '本批支付 ' + balance.totalCost + ' PlayerCost · 余额 ' + balance.balanceBefore + ' → ' + balance.balanceAfter +
      (actionCosts.length ? ' · 执行费用：' + actionCosts.join('、') : ' · 无额外执行费用') +
      '。Runtime 预览未写入状态；确认后一次结算。';
    submit.disabled = false;
  } catch (error) {
    previewNode.dataset.previewStatus = 'invalid';
    previewNode.textContent = scenePreviewErrorText(error);
    submit.disabled = true;
  }
}

interface OperationCardDrag {
  readonly source: HTMLButtonElement;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly candidateIds: readonly string[];
  readonly dropMode: 'target' | 'scene-performer';
  readonly performerCandidateIds: readonly string[];
  active: boolean;
  hoveredActorId: string | null;
}

const cardDrags = new WeakMap<UIController, OperationCardDrag>();
const suppressedCardClicks = new WeakMap<UIController, HTMLButtonElement>();
interface OperationMapDrag { readonly pointerId: number; readonly runId: string; readonly startX: number; readonly startY: number; readonly originX: number; readonly originY: number; readonly popup: HTMLElement; }
const operationMapDrags = new WeakMap<UIController, OperationMapDrag>();
const operationMapResizeListeners = new WeakMap<UIController, EventListener>();
interface CardRelationPreviewState {
  pointer: HTMLButtonElement | null;
  focus: HTMLButtonElement | null;
}
const cardRelationPreviews = new WeakMap<UIController, CardRelationPreviewState>();
interface PreparedLayerFrame {
  readonly id: number;
  readonly cancel: (id: number) => void;
}

const preparedLayerFrames = new WeakMap<UIController, PreparedLayerFrame>();
const CARD_DRAG_THRESHOLD = 7;

interface PreparedLayerResizeState {
  readonly observer: ResizeObserver;
  readonly observed: Set<Element>;
}

const preparedLayerResizeStates = new WeakMap<UIController, PreparedLayerResizeState>();

interface PreparedLayerObservationState {
  readonly root: HTMLElement;
  readonly scrollListener: EventListener;
  readonly mutationObserver: MutationObserver | null;
}

const preparedLayerObservationStates = new WeakMap<UIController, PreparedLayerObservationState>();

function operationWorkspaceHost(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>('[data-workspace-frame="operation"]')
    ?? element?.querySelector<HTMLElement>('[data-workspace-frame="operation"]')
    ?? null;
}

function preparedLayer(host: HTMLElement): HTMLElement | null {
  return [...host.children].find(child => child instanceof HTMLElement && child.matches('[data-operation-prepared-card-layer]')) as HTMLElement | undefined ?? null;
}

function layoutPreparedCardsForHost(host: HTMLElement): void {
  const layer = preparedLayer(host);
  if (!layer) return;
  const layerRect = layer.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const layerLeft = layerRect.width > 0 ? layerRect.left : hostRect.left;
  const layerTop = layerRect.height > 0 ? layerRect.top : hostRect.top;
  const layerWidth = layerRect.width > 0 ? layerRect.width : hostRect.width;
  if (layerWidth <= 0 || hostRect.height <= 0) return;

  const anchors = new Map<string, HTMLElement>();
  for (const anchor of host.querySelectorAll<HTMLElement>('[data-operation-card-anchor]')) {
    const actorId = anchor.dataset.operationCardAnchor;
    if (actorId) anchors.set(actorId, anchor);
  }
  const cards = [...layer.children].filter((child): child is HTMLElement =>
    child instanceof HTMLElement && child.classList.contains('operation-prepared-card'),
  );
  const cardsByOwner = new Map<string, HTMLElement[]>();
  for (const card of cards) {
    const ownerId = card.dataset.operationPreparedOwnerId;
    if (!ownerId) continue;
    const owned = cardsByOwner.get(ownerId) ?? [];
    owned.push(card);
    cardsByOwner.set(ownerId, owned);
  }
  const positions = new Map<HTMLElement, { left: number; top: number; width: number; height: number }>();
  const dimension = (element: HTMLElement, axis: 'width' | 'height', fallback: number): number => {
    const rect = element.getBoundingClientRect();
    return rect[axis] || element[axis === 'width' ? 'offsetWidth' : 'offsetHeight'] || fallback;
  };
  const place = (element: HTMLElement, left: number, top: number, width: number, height: number): void => {
    element.hidden = false;
    element.style.left = `${Math.round(left * 100) / 100}px`;
    element.style.top = `${Math.round(top * 100) / 100}px`;
    element.dataset.positioned = 'true';
    positions.set(element, { left, top, width, height });
  };

  for (const [ownerId, ownerCards] of cardsByOwner) {
    const panel = [...layer.children].find(child => child instanceof HTMLElement
      && child.matches('[data-operation-action-alternatives-panel]')
      && child.dataset.operationActionOwnerId === ownerId) as HTMLElement | undefined;
    const hideOwnerCards = (): void => {
      ownerCards.forEach(card => {
        card.hidden = true;
        card.removeAttribute('data-positioned');
      });
      if (panel) panel.hidden = true;
    };
    const owner = anchors.get(ownerId);
    if (!owner?.isConnected) {
      hideOwnerCards();
      continue;
    }
    const current = ownerCards.find(card => card.hasAttribute('data-operation-action-current') || card.hasAttribute('data-operation-action-current-toggle'));
    const currentWidth = current ? dimension(current, 'width', 112) : 0;
    const currentHeight = current ? dimension(current, 'height', 62) : 0;
    const placeInsideOwner = Boolean(current && owner.getBoundingClientRect().width >= currentWidth + 16);
    if (placeInsideOwner) {
      const reserve = `${Math.ceil(currentHeight + 16)}px`;
      if (owner.style.getPropertyValue('--operation-action-card-reserve') !== reserve) {
        owner.style.setProperty('--operation-action-card-reserve', reserve);
      }
    } else {
      owner.style.removeProperty('--operation-action-card-reserve');
    }
    const ownerRect = owner.getBoundingClientRect();
    if (ownerRect.width <= 0 || ownerRect.height <= 0) {
      hideOwnerCards();
      continue;
    }
    if (current) {
      const width = currentWidth;
      const height = currentHeight;
      const insideLeft = ownerRect.right - layerLeft - width - 8;
      const rightLeft = ownerRect.right - layerLeft + 8;
      const leftLeft = ownerRect.left - layerLeft - width - 8;
      const minFrameLeft = hostRect.left - layerLeft + 4;
      const maxFrameRight = hostRect.right - layerLeft - 4;
      const rightFits = rightLeft + width <= maxFrameRight;
      const leftFits = leftLeft >= minFrameLeft;
      // Keep the selected face inside the reserved lower-right area of its owner card.
      // Fall back to the old exterior anchor only when the owner cannot contain its width.
      const left = placeInsideOwner ? insideLeft : rightFits ? rightLeft : leftFits ? leftLeft : rightLeft;
      const top = placeInsideOwner
        ? ownerRect.bottom - layerTop - height - 8
        : ownerRect.top - layerTop + 9;
      place(current, left, top, width, height);

      const alternatives = ownerCards.filter(card => card.hasAttribute('data-operation-action-alternative'));
      const open = current.getAttribute('aria-expanded') === 'true';
      if (panel) panel.hidden = !open;
      for (const card of alternatives) card.hidden = !open;
      const clearAction = panel?.querySelector<HTMLElement>('[data-operation-clear]');
      if (open && (alternatives.length > 0 || clearAction) && panel) {
        const gap = 8;
        const cardSizes = alternatives.map(card => ({
          width: dimension(card, 'width', 112),
          height: dimension(card, 'height', 62),
        }));
        const cardWidth = cardSizes.length ? Math.max(...cardSizes.map(size => size.width)) : 112;
        const availableRight = hostRect.right - (layerLeft + left + width + gap);
        const columns = alternatives.length > 0 && availableRight >= cardWidth * 2 + 24 ? 2 : 1;
        const rows = Math.ceil(alternatives.length / columns);
        const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(...cardSizes
          .slice(row * columns, (row + 1) * columns).map(size => size.height)));
        const panelWidth = columns * cardWidth + (columns - 1) * 6 + 16;
        const panelHeight = 28 + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0)
          + Math.max(0, rows - 1) * 8 + 12 + (clearAction ? 34 : 0);
        let panelLeft = left + width + gap;
        if (availableRight < panelWidth) {
          const leftCandidate = left - panelWidth - gap;
          const minLeft = hostRect.left - layerLeft + 8;
          const maxLeft = Math.max(minLeft, hostRect.right - layerLeft - panelWidth - 8);
          panelLeft = leftCandidate >= minLeft ? leftCandidate : maxLeft;
        }
        const minPanelLeft = hostRect.left - layerLeft + 8;
        const maxPanelLeft = Math.max(minPanelLeft, hostRect.right - layerLeft - panelWidth - 8);
        panelLeft = Math.max(minPanelLeft, Math.min(panelLeft, maxPanelLeft));
        const minTop = hostRect.top - layerTop + 4;
        const maxTop = hostRect.bottom - layerTop - panelHeight - 4;
        const panelTop = Math.max(minTop, Math.min(top - 4, maxTop));
        panel.style.left = `${panelLeft}px`;
        panel.style.top = `${panelTop}px`;
        panel.style.width = `${panelWidth}px`;
        panel.style.height = `${panelHeight}px`;
        panel.dataset.positioned = 'true';
        if (clearAction) {
          clearAction.style.left = '8px';
          clearAction.style.bottom = '6px';
        }
        alternatives.forEach((card, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const rowTop = rowHeights.slice(0, row).reduce((sum, rowHeight) => sum + rowHeight + 8, 0);
          place(card, panelLeft + 8 + column * (cardWidth + 6), panelTop + 27 + rowTop, cardWidth, cardSizes[index].height);
        });
      }
    }

    for (const card of ownerCards.filter(item => item.matches('[data-operation-intent]'))) {
      card.hidden = false;
      const width = dimension(card, 'width', 112);
      const height = dimension(card, 'height', 62);
      place(card, ownerRect.right - layerLeft - width + 8, ownerRect.bottom - layerTop - height + 8, width, height);
    }
  }

}

function updatePreparedLayerResizeObservations(ctrl: UIController): void {
  if (typeof ResizeObserver === 'undefined') return;
  let state = preparedLayerResizeStates.get(ctrl);
  if (!state) {
    const observer = new ResizeObserver(() => requestPreparedCardLayout(ctrl));
    state = { observer, observed: new Set<Element>() };
    preparedLayerResizeStates.set(ctrl, state);
  }
  const next = new Set<Element>();
  for (const host of ctrl.root.querySelectorAll<HTMLElement>('[data-workspace-frame="operation"]')) {
    next.add(host);
    const layer = preparedLayer(host);
    if (layer) next.add(layer);
    for (const anchor of host.querySelectorAll<HTMLElement>('[data-operation-card-anchor]')) next.add(anchor);
  }
  for (const element of state.observed) {
    if (next.has(element) && element.isConnected) continue;
    state.observer.unobserve(element);
    state.observed.delete(element);
  }
  for (const element of next) {
    if (state.observed.has(element)) continue;
    state.observer.observe(element);
    state.observed.add(element);
  }
}

function requestPreparedCardLayout(ctrl: UIController): void {
  if (disposedOperationControllers.has(ctrl)) return;
  if (preparedLayerFrames.has(ctrl)) return;
  const usesAnimationFrame = typeof window.requestAnimationFrame === 'function';
  const request = usesAnimationFrame
    ? (callback: FrameRequestCallback) => window.requestAnimationFrame(callback)
    : (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0);
  const cancel = usesAnimationFrame && typeof window.cancelAnimationFrame === 'function'
    ? (id: number) => window.cancelAnimationFrame(id)
    : (id: number) => window.clearTimeout(id);
  let scheduledFrame: PreparedLayerFrame | null = null;
  const frame = request(() => {
    if (scheduledFrame && preparedLayerFrames.get(ctrl) === scheduledFrame) preparedLayerFrames.delete(ctrl);
    if (disposedOperationControllers.has(ctrl)) return;
    for (const host of ctrl.root.querySelectorAll<HTMLElement>('[data-workspace-frame="operation"]')) layoutPreparedCardsForHost(host);
    updatePreparedLayerResizeObservations(ctrl);
  });
  scheduledFrame = { id: frame, cancel };
  preparedLayerFrames.set(ctrl, scheduledFrame);
}

function observePreparedCardLayout(ctrl: UIController): void {
  if (disposedOperationControllers.has(ctrl) || preparedLayerObservationStates.has(ctrl)) return;
  const schedule = () => requestPreparedCardLayout(ctrl);
  ctrl.root.addEventListener('scroll', schedule, true);
  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(records => {
      const changedOperation = records.some(record => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (target?.closest('[data-workspace-frame="operation"]')) return true;
        return [...record.addedNodes].some(node => node instanceof Element
          && (node.matches('[data-workspace-frame="operation"]') || node.querySelector('[data-workspace-frame="operation"]')));
      });
      if (changedOperation) schedule();
    });
    observer.observe(ctrl.root, { childList: true, subtree: true });
  }
  preparedLayerObservationStates.set(ctrl, { root: ctrl.root, scrollListener: schedule, mutationObserver: observer });
  requestPreparedCardLayout(ctrl);
}

/** Release long-lived Operation card observers owned by this controller. Safe to call repeatedly. */
export function disposeOperationActions(ctrl: UIController): void {
  if (disposedOperationControllers.has(ctrl)) return;
  disposedOperationControllers.add(ctrl);
  const mapResizeListener = operationMapResizeListeners.get(ctrl);
  if (mapResizeListener) { window.removeEventListener('resize', mapResizeListener); operationMapResizeListeners.delete(ctrl); }

  const observation = preparedLayerObservationStates.get(ctrl);
  if (observation) {
    observation.root.removeEventListener('scroll', observation.scrollListener, true);
    observation.mutationObserver?.disconnect();
    preparedLayerObservationStates.delete(ctrl);
  }

  const resizeState = preparedLayerResizeStates.get(ctrl);
  if (resizeState) {
    resizeState.observer.disconnect();
    resizeState.observed.clear();
    preparedLayerResizeStates.delete(ctrl);
  }

  const pendingFrame = preparedLayerFrames.get(ctrl);
  if (pendingFrame) {
    pendingFrame.cancel(pendingFrame.id);
    preparedLayerFrames.delete(ctrl);
  }

  const drag = cardDrags.get(ctrl);
  if (drag) {
    cardDrags.delete(ctrl);
    clearCardDragPresentation(ctrl, drag);
  }
  cardRelationPreviews.delete(ctrl);
  suppressedCardClicks.delete(ctrl);
}

function readLegalTargetIds(face: HTMLElement): string[] {
  try {
    const value = JSON.parse(face.dataset.legalTargetActorIds ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function readLegalTargetMap(face: HTMLElement): Record<string, string[]> {
  try {
    const value = JSON.parse(face.dataset.legalTargetMap ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).map(([actorId, targets]) => [actorId,
      Array.isArray(targets) ? targets.filter((id): id is string => typeof id === 'string') : [],
    ]));
  } catch {
    return {};
  }
}

function updateSceneFaceAccessibleName(face: HTMLElement): void {
  const title = face.querySelector<HTMLElement>('.operation-card-title')?.textContent?.trim() ?? '';
  const description = face.querySelector<HTMLElement>('.operation-card-description')?.textContent?.trim() ?? '';
  const cost = face.dataset.playerCost;
  const summary = face.dataset.targetSummary
    ?? face.querySelector<HTMLElement>('[data-operation-card-target-summary]')?.textContent?.trim()
    ?? '';
  const pieces = [title, description, cost ? `${cost} Cost` : '', summary];
  if (face.dataset.cardKind === 'player-card') {
    pieces.push(face.getAttribute('aria-pressed') === 'true' ? '已加入本批' : '加入本批');
  }
  face.setAttribute('aria-label', pieces.filter(Boolean).join('。'));
}

function actorTargetAtPoint(ctrl: UIController, x: number, y: number, allowedIds: readonly string[]): string | null {
  const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-operation-actor-target]');
  if (hit?.dataset.operationActorTarget && allowedIds.includes(hit.dataset.operationActorTarget)) return hit.dataset.operationActorTarget;
  for (const actor of ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')) {
    const id = actor.dataset.operationActorTarget;
    if (!id || !allowedIds.includes(id)) continue;
    const rect = actor.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return id;
  }
  return null;
}

function drawCardRelation(ctrl: UIController, source: HTMLElement, targetActorId: string | null): void {
  const host = operationWorkspaceHost(source);
  const path = host?.querySelector<SVGPathElement>('[data-operation-drag-relation]');
  const target = targetActorId
    ? [...(host?.querySelectorAll<HTMLElement>('[data-operation-actor-target]') ?? [])].find(actor => actor.dataset.operationActorTarget === targetActorId)
    : null;
  if (!path || !target) {
    path?.setAttribute('visibility', 'hidden');
    return;
  }
  const svg = path.ownerSVGElement;
  if (!svg) return;
  path.removeAttribute('visibility');
  const svgRect = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, svgRect.width)} ${Math.max(1, svgRect.height)}`);
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const anchors = operationRelationAnchors(sourceRect, targetRect);
  const pathAnchors = {
    ...anchors,
    source: [anchors.source[0] - svgRect.left, anchors.source[1] - svgRect.top] as const,
    target: [anchors.target[0] - svgRect.left, anchors.target[1] - svgRect.top] as const,
  };
  path.setAttribute('d', operationRelationPath(pathAnchors));
  path.dataset.sourcePort = anchors.sourcePort;
  path.dataset.targetPort = anchors.targetPort;
  path.removeAttribute('visibility');
}

function currentActionRelationTarget(face: HTMLButtonElement): string | null {
  if (face.disabled || face.getAttribute('aria-pressed') !== 'true'
    || face.dataset.targetSelectionMode === 'all-eligible') return null;
  const legalTargetIds = readLegalTargetIds(face);
  if (!legalTargetIds.length) return null;
  let selectedTarget: string | undefined;
  if (face.matches('[data-operation-scene-choice], [data-operation-card-toggle]')) {
    try {
      const values = JSON.parse(face.dataset.selectedTargetActorIds ?? '[]') as unknown;
      selectedTarget = Array.isArray(values) ? values.find((id): id is string => typeof id === 'string' && legalTargetIds.includes(id)) : undefined;
    } catch { selectedTarget = undefined; }
  } else selectedTarget = face.dataset.selectedTargetActorId;
  const targetActorId = selectedTarget && legalTargetIds.includes(selectedTarget)
    ? selectedTarget
    : face.dataset.defaultTargetActorId || legalTargetIds[0];
  return targetActorId && legalTargetIds.includes(targetActorId) ? targetActorId : null;
}

function renderCardRelationPreview(ctrl: UIController): void {
  if (cardDrags.get(ctrl)?.active) return;
  const state = cardRelationPreviews.get(ctrl);
  const face = [state?.pointer, state?.focus].find(candidate =>
    candidate?.isConnected && currentActionRelationTarget(candidate),
  ) ?? null;
  if (!face) {
    const path = ctrl.root.querySelector<SVGPathElement>('[data-operation-drag-relation]');
    path?.setAttribute('visibility', 'hidden');
    return;
  }
  drawCardRelation(ctrl, face, currentActionRelationTarget(face));
}

function clearCardDragPresentation(ctrl: UIController, drag: OperationCardDrag): void {
  drag.source.classList.remove('is-card-drag-source');
  for (const actor of ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target].is-card-legal-target, [data-operation-actor-target].is-card-hover-target')) {
    actor.classList.remove('is-card-legal-target', 'is-card-hover-target');
  }
  const host = operationWorkspaceHost(drag.source);
  const path = host?.querySelector<SVGPathElement>('[data-operation-drag-relation]');
  path?.setAttribute('visibility', 'hidden');
  const preview = cardRelationPreviews.get(ctrl);
  if (preview?.pointer === drag.source) preview.pointer = null;
  if (preview?.focus === drag.source) preview.focus = null;
  const status = host?.querySelector<HTMLElement>('[data-operation-drag-status]');
  if (status) status.hidden = true;
  drag.source.closest<HTMLElement>('[data-workspace-frame="operation"]')?.classList.remove('is-card-dragging');
}

function announceCardDrag(drag: OperationCardDrag, message: string): void {
  const host = operationWorkspaceHost(drag.source);
  const status = host?.querySelector<HTMLElement>('[data-operation-drag-status]');
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
}

function announceCurrentOperationDrag(ctrl: UIController, message: string): void {
  const status = ctrl.root.querySelector<HTMLElement>('[data-workspace-frame="operation"] [data-operation-drag-status]');
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
}

function updateFaceSelection(face: HTMLElement, selected: boolean): void {
  face.setAttribute('aria-pressed', String(selected));
  face.classList.toggle('is-selected', selected);
  face.closest<HTMLElement>('[data-operation-scene-option]')?.classList.toggle('is-selected', selected);
}

function operationLocationId(element: HTMLElement): string {
  return element.closest<HTMLElement>('[data-workspace-frame="operation"]')
    ?.querySelector<HTMLElement>('[data-operation-location]')?.dataset.operationLocation ?? '';
}

/** Copy reversible card choices from the mounted controls without consulting OperationView. */
export function saveSceneDraftFromWorkspace(workspace: HTMLElement): OperationSceneDraft | null {
  const source = workspace.querySelector<HTMLElement>('[data-operation-scene-submit]')
    ?? workspace.querySelector<HTMLElement>('[data-operation-scene-choice], [data-operation-card-toggle], [data-operation-purchase-toggle]');
  const command = source ? readCommandVersion(source) : null;
  const locationId = operationLocationId(workspace);
  if (!command || !locationId) return null;

  const selections: OperationSceneDraft['selections'][number][] = [];
  for (const card of workspace.querySelectorAll<HTMLElement>('[data-operation-scene-card]')) {
    const face = card.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]');
    const option = face?.closest<HTMLElement>('[data-operation-scene-option]');
    if (!face || !option) continue;
    const performerId = card.hasAttribute('data-global-scene-card') ? face.dataset.actorId : card.dataset.actorId;
    const sceneActionId = face.dataset.sceneActionId;
    if (!sceneActionId) continue;
    let targetActorIds: string[] = [];
    try {
      const values = JSON.parse(face.dataset.selectedTargetActorIds ?? '[]') as unknown;
      if (Array.isArray(values)) targetActorIds = values.filter((id): id is string => typeof id === 'string' && readLegalTargetIds(face).includes(id));
    } catch { targetActorIds = []; }
    selections.push({ sceneActionId, ...(performerId ? { actorId: performerId } : {}), targetActorIds });
  }

  const cards: OperationSceneDraft['cards'][number][] = [];
  for (const card of workspace.querySelectorAll<HTMLElement>('[data-operation-player-card].is-selected')) {
    const face = card.querySelector<HTMLElement>('[data-operation-card-toggle]');
    const cardInstanceId = card.dataset.operationPlayerCard;
    const actorId = face?.dataset.actorId;
    if (!face || !cardInstanceId || (!actorId && face.dataset.performerPolicy !== 'none' && face.dataset.performerPolicy !== 'optional-student')) continue;
    let targetActorIds: string[] = [];
    try {
      const values = JSON.parse(face.dataset.selectedTargetActorIds ?? '[]') as unknown;
      if (Array.isArray(values)) targetActorIds = values.filter((id): id is string => typeof id === 'string' && readLegalTargetIds(face).includes(id));
    } catch { targetActorIds = []; }
    cards.push({ cardInstanceId, ...(actorId ? { actorId } : {}), targetActorIds });
  }

  const purchases = [...workspace.querySelectorAll<HTMLButtonElement>('[data-operation-purchase-toggle][aria-pressed="true"]')]
    .flatMap(face => face.dataset.offerId ? [{ offerId: face.dataset.offerId }] : []);
  const draft: OperationSceneDraft = { selections, cards, ...(purchases.length ? { purchases } : {}) };
  saveOperationSceneDraft(command.runId, command.planVersion, locationId, draft);
  return draft;
}

function saveSceneDraftFromElement(element: HTMLElement): void {
  const workspace = element.closest<HTMLElement>('[data-workspace-frame="operation"]');
  if (workspace) saveSceneDraftFromWorkspace(workspace);
}

/** Initial staging uses the same choices the pure renderer presents before any local edits. */
function defaultSceneDraftFromView(view: OperationView): OperationSceneDraft {
  void view;
  return { selections: [], cards: [] };
}

function selectSceneCardTarget(ctrl: UIController, face: HTMLButtonElement, targetActorId: string): void {
  if (face.dataset.targetSelectionMode === 'all-eligible') return;
  const option = face.closest<HTMLElement>('[data-operation-scene-option]');
  const card = face.closest<HTMLElement>('[data-operation-scene-card]');
  if (!option || !card) return;
  card.querySelectorAll<HTMLElement>('[data-operation-scene-choice]').forEach(choice => updateFaceSelection(choice, choice === face));
  card.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(row => row.classList.toggle('is-selected', row === option));
  const map = readLegalTargetMap(face);
  const performerId = face.dataset.actorId ?? '';
  const legalTargets = map[performerId] ?? [];
  if (!legalTargets.includes(targetActorId)) return;
  let selectedTargets: string[] = [];
  try { const values = JSON.parse(face.dataset.selectedTargetActorIds ?? '[]') as unknown; if (Array.isArray(values)) selectedTargets = values.filter((id): id is string => typeof id === 'string' && legalTargets.includes(id)); } catch { /* use an empty draft */ }
  if (face.dataset.targetMode === 'global') {
    if (face.dataset.targetDefaulted === 'true') selectedTargets = [targetActorId];
    else if (selectedTargets.includes(targetActorId)) {
      selectedTargets = selectedTargets.length === 1 ? selectedTargets : selectedTargets.filter(id => id !== targetActorId);
    } else selectedTargets.push(targetActorId);
  } else selectedTargets = [targetActorId];
  face.dataset.targetDefaulted = 'false';
  face.dataset.selectedTargetActorIds = JSON.stringify(selectedTargets);
  face.dataset.legalTargetActorIds = JSON.stringify(legalTargets);
  const host = operationWorkspaceHost(face);
  const names = selectedTargets.map(id => [...(host?.querySelectorAll<HTMLElement>('[data-operation-actor-target]') ?? [])].find(actor => actor.dataset.operationActorTarget === id)?.querySelector<HTMLElement>('header strong')?.textContent?.trim() ?? '已选择目标');
  face.dataset.targetSummary = names.length ? '→ ' + names.join('、') : '拖到人物上指定目标';
  const summaryNode = face.querySelector<HTMLElement>('[data-operation-card-target-summary]');
  if (summaryNode) summaryNode.textContent = face.dataset.targetSummary;
  updateSceneFaceAccessibleName(face);
  saveSceneDraftFromElement(face);
  updateCostPreview(ctrl, face.closest<HTMLElement>('[data-workspace-frame="operation"]'));
}

function applyPlayerCardTarget(ctrl: UIController, face: HTMLButtonElement, targetActorId: string): void {
  if (face.dataset.targetSelectionMode === 'all-eligible') return;
  const card = face.closest<HTMLElement>('[data-operation-player-card]');
  if (!card) return;
  face.setAttribute('aria-pressed', 'true');
  card.classList.add('is-selected');
  const actorId = face.dataset.actorId ?? '';
  const legalTargets = readLegalTargetIds(face);
  if (!legalTargets.includes(targetActorId)) return;
  let selectedTargets: string[] = [];
  try { const values = JSON.parse(face.dataset.selectedTargetActorIds ?? '[]') as unknown; if (Array.isArray(values)) selectedTargets = values.filter((id): id is string => typeof id === 'string' && legalTargets.includes(id)); } catch { /* use an empty draft */ }
  selectedTargets = face.dataset.targetMode === 'global'
    ? selectedTargets.includes(targetActorId) ? selectedTargets.filter(id => id !== targetActorId) : [...selectedTargets, targetActorId]
    : [targetActorId];
  face.dataset.selectedTargetActorIds = JSON.stringify(selectedTargets);
  const host = operationWorkspaceHost(face);
  const names = selectedTargets.map(id => [...(host?.querySelectorAll<HTMLElement>('[data-operation-actor-target]') ?? [])].find(actor => actor.dataset.operationActorTarget === id)?.querySelector<HTMLElement>('header strong')?.textContent?.trim() ?? '已选择目标');
  face.dataset.targetSummary = names.length ? '→ ' + names.join('、') : '拖到人物上指定目标';
  const summary = face.querySelector<HTMLElement>('[data-operation-card-target-summary]');
  if (summary) summary.textContent = face.dataset.targetSummary;
  updateSceneFaceAccessibleName(face);
  saveSceneDraftFromElement(face);
  updateCostPreview(ctrl, face.closest<HTMLElement>('[data-workspace-frame="operation"]'));
}

export function targetsAfterPerformerChange(
  previous: { readonly actorId?: string; readonly targetActorIds: readonly string[] } | undefined,
  nextActorId: string | undefined,
  legalTargets: readonly string[],
): string[] {
  if (previous && previous.actorId === nextActorId) return [...previous.targetActorIds];
  if (!previous?.actorId) return legalTargets.length === 1 ? [legalTargets[0]!] : [];
  return previous.targetActorIds.filter(targetActorId => legalTargets.includes(targetActorId));
}

function sceneActionTargetsAfterPerformerChange(
  previous: { readonly actorId?: string; readonly targetActorIds: readonly string[] } | undefined,
  nextActorId: string | undefined,
  legalTargets: readonly string[],
): string[] {
  if (previous && previous.actorId === nextActorId && previous.targetActorIds.length > 0) return [...previous.targetActorIds];
  const retained = previous?.targetActorIds.filter(targetActorId => legalTargets.includes(targetActorId)) ?? [];
  return retained.length ? retained : legalTargets[0] ? [legalTargets[0]] : [];
}

function applyCardDrop(ctrl: UIController, drag: OperationCardDrag, targetActorId: string): void {
  const face = drag.source;
  const kind = face.dataset.cardKind;
  if (kind === 'battle-action' || kind === 'scene-character-action') {
    const command = readCommandVersion(face);
    const actorId = face.dataset.actorId;
    const actionId = face.dataset.actionId;
    if (!command || !actorId || !actionId) return;
    const target = [...ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')]
      .find(actor => actor.dataset.operationActorTarget === targetActorId);
    const targetName = target?.querySelector<HTMLElement>('header strong')?.textContent?.trim()
      ?? target?.querySelector<HTMLElement>('strong')?.textContent?.trim()
      ?? '指定人物';
    try {
      ctrl.game.operationEntry.reviseIntervention({ ...command, draft: { actorId, actionId, targetActorId } });
      refreshAfterCommand(ctrl, command.runId, { type: 'action', actorId, actionId });
      announceCurrentOperationDrag(ctrl, '已把行动目标设为 ' + targetName + '。');
    } catch (error) {
      const message = operationErrorText(error);
      try { refreshAfterCommand(ctrl, command.runId, { type: 'action', actorId, actionId }, message); } catch { ctrl.toast.show(message, 'error'); }
    }
    return;
  }
  if (kind === 'scene-action') {
    if (drag.dropMode === 'scene-performer') {
      applyGlobalScenePerformer(ctrl, face, targetActorId);
      announceCardDrag(drag, '行动卡已挂靠到角色卡；再次拖动可选择作用目标。');
      return;
    }
    if (face.dataset.targetSelectionMode === 'all-eligible') {
      announceCardDrag(drag, '全体合格目标会按当前状态自动确定，不接受手动目标。');
      return;
    }
    selectSceneCardTarget(ctrl, face, targetActorId);
    announceCardDrag(drag, '已把這张行动牌指向合法目标。');
    return;
  }
  if (kind === 'player-card') {
    if (drag.dropMode === 'scene-performer') {
      applyPlayerCardPerformer(ctrl, face, targetActorId);
      announceCardDrag(drag, '场景牌已加入并挂靠到角色卡；再次拖动可选择作用目标。');
      return;
    }
    if (face.dataset.targetSelectionMode === 'all-eligible') {
      announceCardDrag(drag, '全体合格目标会按当前状态自动确定，不接受手动目标。');
      return;
    }
    applyPlayerCardTarget(ctrl, face, targetActorId);
    announceCardDrag(drag, '已把这张场景卡指向合法目标。');
  }
}

function applyPlayerCardPerformer(ctrl: UIController, face: HTMLButtonElement, actorId: string): void {
  const command = readCommandVersion(face);
  const locationId = operationLocationId(face);
  const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
  const cardInstanceId = face.closest<HTMLElement>('[data-operation-player-card]')?.dataset.operationPlayerCard;
  const card = view?.playerCards.hand.find(item => item.cardInstanceId === cardInstanceId);
  const localActivation = card?.performerPolicy === 'optional-student' && actorId === '';
  if (!command || !locationId || !view || !card || card.performerPolicy === 'none'
    || (!localActivation && !card.eligibleActorIds.includes(actorId))) return;
  const workspace = operationWorkspaceHost(face);
  const mountedDraft = workspace ? saveSceneDraftFromWorkspace(workspace) : null;
  const draft = mountedDraft ?? readOperationSceneDraft(command.runId, command.planVersion, locationId) ?? { selections: [], cards: [] };
  const legalTargets = localActivation ? card.legalActorlessTargetActorIds : card.legalTargetActorIdsByActorId[actorId] ?? [];
  const previous = draft.cards.find(item => item.cardInstanceId === card.cardInstanceId);
  const targetActorIds = card.targetSelectionMode === 'all-eligible'
    ? []
    : targetsAfterPerformerChange(previous, actorId || undefined, legalTargets);
  const cards = draft.cards.filter(item => item.cardInstanceId !== card.cardInstanceId);
  cards.push({ cardInstanceId: card.cardInstanceId, ...(actorId ? { actorId } : {}), targetActorIds });
  saveOperationSceneDraft(command.runId, command.planVersion, locationId, { ...draft, cards });
  ctrl.requestOperationWorkspaceRefresh(view, null);
  updateCostPreview(ctrl, workspace);
}

function applyGlobalScenePerformer(ctrl: UIController, face: HTMLButtonElement, actorId: string): void {
  const command = readCommandVersion(face);
  const locationId = operationLocationId(face);
  const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
  const action = view?.currentSceneActions.find(row => row.id === face.dataset.sceneActionId
    && row.scope === 'global' && row.performerPolicy !== 'none');
  if (!command || !locationId || !view || !action || actorId && !action.eligibleActorIds.includes(actorId)
    || !actorId && action.performerPolicy !== 'optional-student') return;
  const workspace = operationWorkspaceHost(face);
  const mountedDraft = workspace ? saveSceneDraftFromWorkspace(workspace) : null;
  const draft = mountedDraft ?? readOperationSceneDraft(command.runId, command.planVersion, locationId) ?? { selections: [], cards: [] };
  const previous = draft.selections.find(selection => selection.sceneActionId === action.id);
  const legalTargets = actorId ? action.legalTargetActorIdsByActorId[actorId] ?? [] : action.legalActorlessTargetActorIds;
  const targetActorIds = action.targetSelectionMode === 'all-eligible'
    ? []
    : sceneActionTargetsAfterPerformerChange(previous, actorId || undefined, legalTargets);
  saveOperationSceneDraft(command.runId, command.planVersion, locationId, {
    ...draft,
    selections: [
      ...draft.selections.filter(selection => selection.sceneActionId !== action.id),
      { sceneActionId: action.id, ...(actorId ? { actorId } : {}), targetActorIds },
    ],
  });
  ctrl.requestOperationWorkspaceRefresh(view, null);
  updateCostPreview(ctrl, workspace);
}

function focusPerformerPicker(ctrl: UIController, identity: string): void {
  const picker = [...ctrl.root.querySelectorAll<HTMLDetailsElement>('[data-operation-performer-picker]')]
    .find(node => node.dataset.cardKind === 'player-card' && node.dataset.cardIdentity === identity);
  const summary = picker?.querySelector<HTMLElement>(':scope > summary');
  summary?.focus({ preventScroll: true });
}

function togglePreparedActionAlternatives(ctrl: UIController, current: HTMLElement, actorId: string, focusAlternative: boolean): void {
  const host = operationWorkspaceHost(current);
  if (!host) return;
  const layer = preparedLayer(host);
  if (!layer) return;
  const alternatives = [...layer.querySelectorAll<HTMLElement>('[data-operation-action-alternative]')]
    .filter(option => option.dataset.operationActionOwnerId === actorId);
  const panel = [...layer.querySelectorAll<HTMLElement>('[data-operation-action-alternatives-panel]')]
    .find(item => item.dataset.operationActionOwnerId === actorId);
  const isExpanded = current.getAttribute('aria-expanded') === 'true'
    || alternatives.some(option => !option.hidden)
    || Boolean(panel && !panel.hidden);
  const expanded = !isExpanded;
  current.setAttribute('aria-expanded', String(expanded));
  alternatives.forEach(option => { option.hidden = !expanded; });
  if (panel) panel.hidden = !expanded;
  if (expanded && focusAlternative) {
    alternatives.find(option => option instanceof HTMLButtonElement && !option.disabled)?.focus({ preventScroll: true });
  }
  requestPreparedCardLayout(ctrl);
}

function focusPublicPlayerCard(ctrl: UIController, identity: string): void {
  const card = [...ctrl.root.querySelectorAll<HTMLElement>('[data-operation-player-hand] [data-operation-player-card]')]
    .find(node => node.dataset.operationPlayerCard === identity);
  card?.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')?.focus({ preventScroll: true });
}

function assignClickedPerformer(ctrl: UIController, target: HTMLElement): void {
  const cardKind = target.dataset.cardKind;
  const identity = target.dataset.cardIdentity;
  const actorId = target.dataset.performerActorId;
  const command = readCommandVersion(target);
  const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
  if (!command || !view || view.planVersion !== command.planVersion || !actorId) return;
  if (cardKind === 'player-card' && identity) {
    const face = [...ctrl.root.querySelectorAll<HTMLButtonElement>('[data-operation-card-toggle]')]
      .find(button => button.dataset.cardInstanceId === identity);
    if (!face) return;
    applyPlayerCardPerformer(ctrl, face, actorId);
    focusPerformerPicker(ctrl, identity);
  }
}

function clearClickedPerformer(ctrl: UIController, target: HTMLElement): void {
  const cardKind = target.dataset.cardKind;
  const identity = target.dataset.cardIdentity;
  const command = readCommandVersion(target);
  const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
  if (!command || cardKind !== 'player-card' || !identity || !view || view.planVersion !== command.planVersion) return;
  const workspace = operationWorkspaceHost(target);
  const locationId = view.currentLocationId;
  const draft = workspace ? saveSceneDraftFromWorkspace(workspace) : readOperationSceneDraft(command.runId, command.planVersion, locationId);
  if (!draft) return;
  const next: OperationSceneDraft = { ...draft, cards: draft.cards.filter(card => card.cardInstanceId !== identity) };
  saveOperationSceneDraft(command.runId, command.planVersion, locationId, next);
  ctrl.requestOperationWorkspaceRefresh(view, null);
  updateCostPreview(ctrl, operationWorkspaceHost(ctrl.root));
  focusPublicPlayerCard(ctrl, identity);
}

function restoreMapOpenerFocus(ctrl: UIController, workspace: HTMLElement, runId: string, opener: HTMLElement | null): void {
  if (opener?.closest<HTMLElement>('[data-operation-right-view="background"]')?.hidden) {
    setOperationWorkspaceTab(runId, 'background');
    for (const tab of workspace.querySelectorAll<HTMLElement>('[data-operation-right-tab]')) {
      const selected = tab.dataset.operationRightTab === 'background';
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of workspace.querySelectorAll<HTMLElement>('[data-operation-right-view]')) panel.hidden = panel.dataset.operationRightView !== 'background';
    requestPreparedCardLayout(ctrl);
  }
  opener?.focus({ preventScroll: true });
}

function bindCardTargetGestures(ctrl: UIController): void {
  const relationPreviewState = (): CardRelationPreviewState => {
    let state = cardRelationPreviews.get(ctrl);
    if (!state) {
      state = { pointer: null, focus: null };
      cardRelationPreviews.set(ctrl, state);
    }
    return state;
  };
  const actionFaceFrom = (target: EventTarget | null): HTMLButtonElement | null => {
    if (!(target instanceof Element)) return null;
    const face = target.closest<HTMLButtonElement>('[data-operation-action-current][data-operation-action], [data-operation-scene-choice], [data-operation-card-toggle]');
    return face && currentActionRelationTarget(face) ? face : null;
  };
  ctrl.root.addEventListener('pointerover', event => {
    if (cardDrags.get(ctrl)?.active) return;
    const face = actionFaceFrom(event.target);
    if (!face) return;
    if (event.relatedTarget instanceof Node && face.contains(event.relatedTarget)) return;
    relationPreviewState().pointer = face;
    renderCardRelationPreview(ctrl);
  });
  ctrl.root.addEventListener('pointerout', event => {
    const face = actionFaceFrom(event.target);
    if (!face || event.relatedTarget instanceof Node && face.contains(event.relatedTarget)) return;
    const state = relationPreviewState();
    if (state.pointer === face) state.pointer = null;
    renderCardRelationPreview(ctrl);
  });
  ctrl.root.addEventListener('focusin', event => {
    const face = actionFaceFrom(event.target);
    if (!face) return;
    relationPreviewState().focus = face;
    renderCardRelationPreview(ctrl);
  });
  ctrl.root.addEventListener('focusout', event => {
    const face = actionFaceFrom(event.target);
    if (!face || event.relatedTarget instanceof Node && face.contains(event.relatedTarget)) return;
    const state = relationPreviewState();
    if (state.focus === face) state.focus = null;
    renderCardRelationPreview(ctrl);
  });
  ctrl.root.addEventListener('pointerdown', event => {
    if (event.button !== 0 || ctrl.panelState.workspace?.type !== 'operation') return;
    const rawTarget = event.target;
    if (!(rawTarget instanceof Element)) return;
    const mapHandle = rawTarget.closest<HTMLElement>('[data-operation-map-drag-handle]');
    if (mapHandle && !rawTarget.closest('button')) {
      const popup = mapHandle.closest<HTMLElement>('[data-operation-map-popup]');
      const opener = ctrl.root.querySelector<HTMLElement>('[data-operation-map-open]');
      const runId = opener?.dataset.runId;
      if (!popup || popup.hidden || !runId) return;
      const rect = popup.getBoundingClientRect();
      const drag: OperationMapDrag = { pointerId: event.pointerId, runId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, popup };
      operationMapDrags.set(ctrl, drag);
      try { mapHandle.setPointerCapture(event.pointerId); } catch { /* Capture can fail if the workspace is being disposed. */ }
      event.preventDefault();
      return;
    }
    const face = rawTarget.closest<HTMLButtonElement>('[data-operation-action], [data-operation-scene-choice], [data-operation-card-toggle]');
    if (!face || face.disabled) return;
    const performerCandidateIds = (face.dataset.sceneActionScope === 'global' || face.dataset.cardKind === 'player-card')
      && face.dataset.performerPolicy !== 'none'
      && (face.dataset.performerPolicy === 'selected-student' || face.getAttribute('aria-pressed') !== 'true')
      ? (() => {
        try {
          const value = JSON.parse(face.dataset.operationPerformerCandidateActorIds ?? '[]') as unknown;
          return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
        } catch { return []; }
      })()
      : [];
    const dropMode: OperationCardDrag['dropMode'] = performerCandidateIds.length > 0 && !face.dataset.actorId
      ? 'scene-performer'
      : 'target';
    if (dropMode === 'target' && face.dataset.targetSelectionMode === 'all-eligible') return;
    const candidateIds = dropMode === 'scene-performer' ? performerCandidateIds : readLegalTargetIds(face);
    if (!candidateIds.length || dropMode === 'target' && candidateIds.length < 2 && face.dataset.cardKind === 'battle-action') return;
    const drag: OperationCardDrag = {
      source: face,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      candidateIds,
      dropMode,
      performerCandidateIds,
      active: false,
      hoveredActorId: null,
    };
    cardDrags.set(ctrl, drag);
    try { face.setPointerCapture(event.pointerId); } catch { /* Browser may refuse capture when a region is replaced. */ }
  });
  ctrl.root.addEventListener('pointermove', event => {
    const mapDrag = operationMapDrags.get(ctrl);
    if (mapDrag && mapDrag.pointerId === event.pointerId) {
      const rect = mapDrag.popup.getBoundingClientRect();
      const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, mapDrag.originX + event.clientX - mapDrag.startX));
      const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, mapDrag.originY + event.clientY - mapDrag.startY));
      mapDrag.popup.style.setProperty('--operation-map-x', `${x}px`);
      mapDrag.popup.style.setProperty('--operation-map-y', `${y}px`);
      moveOperationWorkspaceMap(mapDrag.runId, x, y);
      if (event.cancelable) event.preventDefault();
      return;
    }
    const drag = cardDrags.get(ctrl);
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= CARD_DRAG_THRESHOLD) {
      drag.active = true;
      drawCardRelation(ctrl, drag.source, null);
      drag.source.classList.add('is-card-drag-source');
      drag.source.closest<HTMLElement>('[data-workspace-frame="operation"]')?.classList.add('is-card-dragging');
      for (const actor of ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')) {
        if (drag.candidateIds.includes(actor.dataset.operationActorTarget ?? '')) actor.classList.add('is-card-legal-target');
      }
      announceCardDrag(drag, drag.dropMode === 'scene-performer'
        ? '拖到角色卡上，将行动挂靠到该角色；按 Escape 取消。'
        : '拖到高亮人物上设置合法目标；执行者归属不会改变。按 Escape 取消。');
    }
    if (!drag.active) return;
    if (event.cancelable) event.preventDefault();
    const targetId = actorTargetAtPoint(ctrl, event.clientX, event.clientY, drag.candidateIds);
    if (drag.hoveredActorId !== targetId) {
      for (const actor of ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target].is-card-hover-target')) actor.classList.remove('is-card-hover-target');
      drag.hoveredActorId = targetId;
      if (targetId) {
        for (const actor of ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')) {
          if (actor.dataset.operationActorTarget === targetId) actor.classList.add('is-card-hover-target');
        }
      }
      drawCardRelation(ctrl, drag.source, targetId);
    }
  });
  ctrl.root.addEventListener('pointerup', event => {
    const mapDrag = operationMapDrags.get(ctrl);
    if (mapDrag && mapDrag.pointerId === event.pointerId) { operationMapDrags.delete(ctrl); return; }
    const drag = cardDrags.get(ctrl);
    if (!drag || drag.pointerId !== event.pointerId) return;
    cardDrags.delete(ctrl);
    if (drag.active) {
      suppressedCardClicks.set(ctrl, drag.source);
      window.setTimeout(() => {
        if (suppressedCardClicks.get(ctrl) === drag.source) suppressedCardClicks.delete(ctrl);
      }, 0);
      const targetId = actorTargetAtPoint(ctrl, event.clientX, event.clientY, drag.candidateIds);
      clearCardDragPresentation(ctrl, drag);
      if (targetId) applyCardDrop(ctrl, drag, targetId);
      else announceCardDrag(drag, drag.dropMode === 'scene-performer' ? '未指定执行者：请把卡牌放到角色卡上。' : '未更改目标：请放到高亮人物上。');
    } else {
      // A normal click should keep the focused/hovered current-action preview visible.
    }
  });
  const cancel = (event: PointerEvent): void => {
    const mapDrag = operationMapDrags.get(ctrl);
    if (mapDrag && mapDrag.pointerId === event.pointerId) { operationMapDrags.delete(ctrl); return; }
    const drag = cardDrags.get(ctrl);
    if (!drag || drag.pointerId !== event.pointerId) return;
    cardDrags.delete(ctrl);
    clearCardDragPresentation(ctrl, drag);
  };
  ctrl.root.addEventListener('pointercancel', cancel);
  ctrl.root.addEventListener('lostpointercapture', cancel, true);
  ctrl.root.addEventListener('keydown', event => {
    const rawTarget = event.target;
    if (rawTarget instanceof Element && rawTarget.matches('[data-operation-right-tab]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = [...(operationWorkspaceHost(rawTarget)?.querySelectorAll<HTMLButtonElement>('[data-operation-right-tab]') ?? [])];
      const index = tabs.indexOf(rawTarget as HTMLButtonElement);
      const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next?.focus({ preventScroll: true });
      next?.click();
      return;
    }
    const mapHandle = rawTarget instanceof Element ? rawTarget.closest<HTMLElement>('[data-operation-map-drag-handle]') : null;
    if (mapHandle && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const popup = mapHandle.closest<HTMLElement>('[data-operation-map-popup]');
      const opener = operationWorkspaceHost(mapHandle)?.querySelector<HTMLElement>('[data-operation-map-open]');
      const runId = opener?.dataset.runId;
      if (popup && runId) {
        const rect = popup.getBoundingClientRect();
        const delta = 24;
        const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, rect.left + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0)));
        const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, rect.top + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0)));
        popup.style.setProperty('--operation-map-x', `${x}px`);
        popup.style.setProperty('--operation-map-y', `${y}px`);
        moveOperationWorkspaceMap(runId, x, y);
      }
      return;
    }
    if (event.key !== 'Escape') return;
    const popup = ctrl.root.querySelector<HTMLElement>('[data-operation-map-popup]:not([hidden])');
    if (popup) {
      event.preventDefault();
      const workspace = operationWorkspaceHost(popup) ?? ctrl.root;
      const opener = workspace.querySelector<HTMLElement>('[data-operation-map-open][aria-expanded="true"]')
        ?? workspace.querySelector<HTMLElement>('[data-operation-map-open]');
      const runId = opener?.dataset.runId;
      const mapId = popup.dataset.operationMapPopup;
      if (runId && mapId) closeOperationWorkspaceMap(runId, mapId);
      popup.hidden = true;
      for (const mapOpener of workspace.querySelectorAll<HTMLElement>('[data-operation-map-open]')) {
        mapOpener.setAttribute('aria-expanded', 'false');
      }
      if (runId) restoreMapOpenerFocus(ctrl, workspace, runId, opener);
      return;
    }
    const drag = cardDrags.get(ctrl);
    if (drag) {
      event.preventDefault();
      event.stopPropagation();
      cardDrags.delete(ctrl);
      clearCardDragPresentation(ctrl, drag);
      drag.source.focus({ preventScroll: true });
      return;
    }
    const host = operationWorkspaceHost(rawTarget instanceof Element ? rawTarget : null);
    const expandedCurrent = host?.querySelector<HTMLElement>('[data-operation-action-current][aria-expanded="true"], [data-operation-action-current-toggle][aria-expanded="true"]');
    if (expandedCurrent) {
      event.preventDefault();
      for (const panel of host?.querySelectorAll<HTMLElement>('[data-operation-action-alternatives-panel], [data-operation-action-alternative]') ?? []) panel.hidden = true;
      expandedCurrent?.setAttribute('aria-expanded', 'false');
      expandedCurrent.focus({ preventScroll: true });
    }
  }, true);
  ctrl.root.addEventListener('click', event => {
    if (event.detail === 0) return;
    const source = suppressedCardClicks.get(ctrl);
    const rawTarget = event.target;
    if (!source || !(rawTarget instanceof Element)) return;
    const clickedFace = rawTarget.closest<HTMLElement>('[data-operation-action], [data-operation-scene-choice], [data-operation-card-toggle]');
    if (clickedFace !== source) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressedCardClicks.delete(ctrl);
  }, true);
  observePreparedCardLayout(ctrl);
}

function startSample(ctrl: UIController, eventId: string, characterIds: readonly string[]): void {
  if (!ctrl.game.operationEntry.getLaunchEntries().some(entry => entry.eventId === eventId)) return;
  if (characterIds.length === 0 || characterIds.some(id => typeof id !== 'string' || id.trim().length === 0)
    || new Set(characterIds).size !== characterIds.length) return;
  try {
    const run = ctrl.game.operationEntry.start(eventId, [...characterIds]);
    ctrl.openOperationWorkspace(run.runId);
    // Route identity changes once; renderWorkspace reads the newly started OperationView once.
    ctrl.render();
    updateCostPreview(ctrl, operationWorkspaceHost(ctrl.root));
  } catch (error) {
    const message = operationErrorText(error, characterIds);
    ctrl.toast.show(message, 'error');
  }
}

/** 抽象关卡入口：调用方提供 Event ID，阵容和当前世界线准入由领域查询决定。 */
export function enterOperationEvent(ctrl: UIController, eventId: string, restart = false): void {
  const entry = ctrl.game.operationEntry.getLaunchEntries().find(candidate => candidate.eventId === eventId);
  if (!entry) return;
  const current = ctrl.game.operationEntry.getView();
  if (!restart && current?.eventId === eventId) {
    ctrl.openOperationWorkspace(current.runId);
    ctrl.render();
    updateCostPreview(ctrl, operationWorkspaceHost(ctrl.root));
    return;
  }
  if (!entry.admission.available || current?.status === 'inProgress') return;
  startSample(ctrl, eventId, entry.characterIds);
}

function operationFunctionAvailable(ctrl: UIController, target: HTMLElement, eventId: string): boolean {
  const spotId = target.dataset.operationSpot;
  const spot = spotId ? ctrl.game.world.spots.get(spotId) : undefined;
  if (!spot || spot.areaId !== ctrl.game.getView().currentAreaId || !getSpotReveal(createUIContext(ctrl.game), spot).utilityKnown) return false;
  const fn = ctrl.game.spotFunctionalitySystem.functionalitiesOf(spot, ctrl.game.state)
    .find(candidate => candidate.id === target.dataset.operationFunctionality && candidate.kind === 'operationEntry' && candidate.operationEventId === eventId);
  return !!fn && (!fn.condition || ctrl.game.conditionSystem.evaluateGroup(fn.condition, ctrl.game.state));
}

function handleOperationClick(ctrl: UIController, event: MouseEvent): void {
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) return;
  const workspace = operationWorkspaceHost(rawTarget);
  const rightTab = rawTarget.closest<HTMLElement>('[data-operation-right-tab]');
  if (rightTab && workspace) {
    const runId = rightTab.dataset.runId;
    const tab = rightTab.dataset.operationRightTab as 'enemies' | 'background' | undefined;
    if (!runId || !tab) return;
    setOperationWorkspaceTab(runId, tab);
    for (const button of workspace.querySelectorAll<HTMLElement>('[data-operation-right-tab]')) {
      const selected = button === rightTab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const panel of workspace.querySelectorAll<HTMLElement>('[data-operation-right-view]')) panel.hidden = panel.dataset.operationRightView !== tab;
    requestPreparedCardLayout(ctrl);
    return;
  }
  const mapOpen = rawTarget.closest<HTMLElement>('[data-operation-map-open]');
  if (mapOpen && workspace) {
    const runId = mapOpen.dataset.runId;
    const mapId = mapOpen.dataset.operationMapOpen;
    if (!runId || !mapId) return;
    const popup = workspace.querySelector<HTMLElement>('[data-operation-map-popup]');
    if (!popup) return;
    const opening = popup.hidden;
    toggleOperationWorkspaceMap(runId, mapId);
    popup.hidden = !opening;
    for (const opener of workspace.querySelectorAll<HTMLElement>('[data-operation-map-open]')) {
      opener.setAttribute('aria-expanded', String(opening && opener === mapOpen));
    }
    if (opening) popup.querySelector<HTMLElement>('[data-operation-map-drag-handle]')?.focus({ preventScroll: true });
    return;
  }
  const popupClose = rawTarget.closest<HTMLElement>('[data-operation-map-popup-close]');
  if (popupClose && workspace) {
    const popup = popupClose.closest<HTMLElement>('[data-operation-map-popup]');
    const opener = workspace.querySelector<HTMLElement>('[data-operation-map-open][aria-expanded="true"]')
      ?? workspace.querySelector<HTMLElement>('[data-operation-map-open]');
    const runId = opener?.dataset.runId;
    const mapId = popup?.dataset.operationMapPopup;
    if (runId && mapId) closeOperationWorkspaceMap(runId, mapId);
    if (popup) popup.hidden = true;
    for (const mapOpener of workspace.querySelectorAll<HTMLElement>('[data-operation-map-open]')) {
      mapOpener.setAttribute('aria-expanded', 'false');
    }
    if (runId) restoreMapOpenerFocus(ctrl, workspace, runId, opener);
    return;
  }
  const mapCardClose = rawTarget.closest<HTMLElement>('[data-operation-map-card-close]');
  if (mapCardClose && workspace) {
    const runId = mapCardClose.dataset.runId;
    const mapId = mapCardClose.dataset.operationMapCardClose;
    if (runId && mapId) closeOperationMapCard(runId, mapId);
    const card = mapCardClose.closest<HTMLElement>('[data-operation-map-intro]');
    if (card) card.hidden = true;
    return;
  }
  const target = rawTarget.closest<HTMLElement>(
    '[data-operation-start], [data-operation-resume-run], [data-operation-back], [data-operation-action-current-toggle], [data-operation-action], [data-operation-clear], [data-operation-commit], [data-operation-scene-submit], [data-operation-scene-skip], [data-operation-scene-commit], [data-operation-clear-scene], [data-operation-route], [data-operation-reward], [data-operation-scene-choice], [data-operation-purchase-toggle], [data-operation-card-toggle], [data-operation-card-actor], [data-operation-performer-clear]',
  );
  if (!target || target instanceof HTMLButtonElement && target.disabled) return;
  if (target.hasAttribute('data-operation-card-actor')) {
    assignClickedPerformer(ctrl, target);
    return;
  }
  if (target.hasAttribute('data-operation-performer-clear')) {
    clearClickedPerformer(ctrl, target);
    return;
  }
  if (target.matches('[data-operation-purchase-toggle]')) {
    const command = readCommandVersion(target);
    const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
    const offerId = target.dataset.offerId;
    const workspace = operationWorkspaceHost(target);
    if (!command || !view || !offerId || !workspace || view.planVersion !== command.planVersion) return;
    const offer = view.currentScenePurchaseOffers.find(item => item.id === offerId);
    if (!offer || offer.purchased || !offer.affordable) return;
    const draft = saveSceneDraftFromWorkspace(workspace) ?? { selections: [], cards: [] };
    const selected = target.getAttribute('aria-pressed') === 'true';
    const purchases = selected
      ? (draft.purchases ?? []).filter(item => item.offerId !== offerId)
      : [...(draft.purchases ?? []).filter(item => item.offerId !== offerId), { offerId }];
    const draftWithoutPurchases: OperationSceneDraft = { selections: draft.selections, cards: draft.cards };
    saveOperationSceneDraft(command.runId, command.planVersion, view.currentLocationId, {
      ...draftWithoutPurchases,
      ...(purchases.length ? { purchases } : {}),
    });
    ctrl.requestOperationWorkspaceRefresh(view, null);
    updateCostPreview(ctrl, workspace);
    return;
  }
  if (target.matches('[data-operation-action-current-toggle]')) {
    const actorId = target.dataset.operationActionOwnerId;
    if (!actorId) return;
    togglePreparedActionAlternatives(ctrl, target, actorId, event.detail === 0);
    return;
  }
  if (target.matches('[data-operation-action][aria-pressed="true"]')) {
    const actorId = target.dataset.operationActionOwnerId;
    if (!actorId) return;
    togglePreparedActionAlternatives(ctrl, target, actorId, event.detail === 0);
    return;
  }
  if (target.matches('[data-operation-action][data-operation-action-alternative]')) {
    const targetIds = readLegalTargetIds(target);
    if (targetIds.length > 1 && !target.dataset.defaultTargetActorId) return;
  }
  if (target.matches('[data-operation-scene-choice]')) {
    const card = target.closest<HTMLElement>('[data-operation-scene-card]');
    const selectedOption = target.closest<HTMLElement>('[data-operation-scene-option]');
    if (!card || !selectedOption) return;
    const wasSelected = target.getAttribute('aria-pressed') === 'true';
    if (target.dataset.performerPolicy === 'selected-student' && !target.dataset.actorId) {
      if (wasSelected) {
        updateFaceSelection(target, false);
        selectedOption.classList.remove('is-selected');
        saveSceneDraftFromElement(target);
      } else {
        card.querySelectorAll<HTMLElement>('[data-operation-scene-choice]').forEach(button => updateFaceSelection(button, button === target));
        card.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(option => option.classList.toggle('is-selected', option === selectedOption));
        card.dataset.selectedSceneActionId = target.dataset.sceneActionId ?? '';
        saveSceneDraftFromElement(target);
      }
      updateCostPreview(ctrl, target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
      return;
    }
    if (wasSelected) {
      updateFaceSelection(target, false);
      selectedOption.classList.remove('is-selected');
      saveSceneDraftFromElement(target);
      const command = readCommandVersion(target);
      const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
      const workspace = operationWorkspaceHost(target);
      if (view && workspace) {
        ctrl.requestOperationWorkspaceRefresh(view, null);
        updateCostPreview(ctrl, workspace);
      }
      return;
    }
    card.querySelectorAll<HTMLElement>('[data-operation-scene-choice]').forEach(button => updateFaceSelection(button, button === target));
    card.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(option => option.classList.toggle('is-selected', option === selectedOption));
    if (card) card.dataset.selectedSceneActionId = target.dataset.sceneActionId ?? '';
    saveSceneDraftFromElement(target);
    updateCostPreview(ctrl, target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-card-toggle]')) {
    if (target.getAttribute('aria-disabled') === 'true') return;
    if (target.dataset.performerPolicy === 'selected-student' && !target.dataset.actorId) {
      const card = target.closest<HTMLElement>('[data-operation-player-card]');
      const picker = card?.querySelector<HTMLElement>('[data-operation-performer-picker]');
      if (picker) {
        (picker as HTMLDetailsElement).open = true;
        picker.querySelector<HTMLButtonElement>('[data-operation-card-actor]')?.focus({ preventScroll: true });
      }
      return;
    }
    if (target.dataset.actorId) {
      target.setAttribute('aria-pressed', 'false');
      target.closest<HTMLElement>('[data-operation-player-card]')?.classList.remove('is-selected');
      saveSceneDraftFromElement(target);
      const command = readCommandVersion(target);
      const view = command ? ctrl.game.operationEntry.getView(command.runId) : null;
      if (view) {
        ctrl.requestOperationWorkspaceRefresh(view, null);
        updateCostPreview(ctrl, operationWorkspaceHost(ctrl.root));
      }
      return;
    }
    const selected = target.getAttribute('aria-pressed') !== 'true';
    target.setAttribute('aria-pressed', String(selected));
    const card = target.closest<HTMLElement>('[data-operation-player-card]');
    card?.classList.toggle('is-selected', selected);
    saveSceneDraftFromElement(target);
    updateCostPreview(ctrl, target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }

  if (target.hasAttribute('data-operation-start')) {
    const eventId = target.dataset.operationStart;
    if (!eventId || !operationFunctionAvailable(ctrl, target, eventId)) return;
    enterOperationEvent(ctrl, eventId, true);
    return;
  }
  if (target.hasAttribute('data-operation-resume-run')) {
    const runId = target.dataset.operationResumeRun;
    const eventId = target.dataset.operationEventId;
    if (!runId || !eventId || !operationFunctionAvailable(ctrl, target, eventId) || ctrl.game.operationEntry.getView(runId)?.eventId !== eventId) return;
    enterOperationEvent(ctrl, eventId);
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
      if (!actorId || !actionId) return;
      const targetActorId = target.dataset.defaultTargetActorId;
      ctrl.game.operationEntry.reviseIntervention({
        ...command,
        draft: { actorId, actionId, ...(targetActorId ? { targetActorId } : {}) },
      });
      refreshAfterCommand(ctrl, runId, { type: 'action', actorId, actionId });
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

    if (target.hasAttribute('data-operation-scene-skip')) {
      ctrl.game.operationEntry.commitSceneActionBatch({ ...command, selections: [], cards: [], purchases: [], skip: true });
      clearOperationSceneDraft(runId);
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
      return;
    }

    if (target.hasAttribute('data-operation-scene-submit')) {
      const view = ctrl.game.operationEntry.getView(runId);
      if (!view) return;
      if (command.planVersion !== view.planVersion) {
        // Preserve the current in-memory SceneDraft: a stale DOM control must not evict it while reporting the stale command.
        ctrl.game.operationEntry.commitSceneActionBatch({ ...command, selections: [], cards: [] });
        refreshAfterCommand(ctrl, runId, { type: 'commit' });
        return;
      }
      let draft = readOperationSceneDraft(runId, command.planVersion, view.currentLocationId);
      if (!draft) {
        draft = defaultSceneDraftFromView(view);
        saveOperationSceneDraft(runId, command.planVersion, view.currentLocationId, draft);
      }
      const batch = readOperationSceneBatchCommand(view, command, draft);
      saveOperationSceneDraft(runId, command.planVersion, view.currentLocationId, batch as OperationSceneDraft);
      ctrl.game.operationEntry.previewSceneActionBatch(batch);
      ctrl.game.operationEntry.commitSceneActionBatch(batch);
      clearOperationSceneDraft(runId);
      refreshAfterCommand(ctrl, runId, { type: 'commit' });
      return;
    }

    if (target.hasAttribute('data-operation-scene-commit')) {
      ctrl.game.operationEntry.commitStagedSceneActionBatch(command);
      clearOperationSceneDraft(runId);
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
          ...(pending.purchases?.length ? { purchases: pending.purchases.map(purchase => ({ offerId: purchase.offerId })) } : {}),
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
      clearOperationSceneDraft(runId);
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

export function readOperationSceneBatchCommand(
  view: OperationView,
  command: { readonly runId: string; readonly planVersion: number },
  draft: OperationSceneDraft,
): OperationSceneActionBatchCommand {
  if (!view.currentActionMode && view.currentScene?.autoCharacterActions !== true) throw new Error('Scene action controls are unavailable');
  if (!view.currentActionMode && draft.selections.length > 0) throw new Error('This Scene does not accept player SceneAction selections.');
  const choice = view.currentSceneActionChoice;
  if (choice) {
    const selectedIds = draft.selections.map(selection => selection.sceneActionId);
    if (selectedIds.some(id => !choice.candidateSceneActionIds.includes(id))) throw new Error('本批包含不属于当前 M 选 N 候选组的行动。');
    if (new Set(selectedIds).size !== selectedIds.length) throw new Error('同一候选行动只能选择一次。');
    if (selectedIds.length !== choice.chooseExactly) {
      throw new Error('请从 ' + choice.candidateSceneActionIds.length + ' 项候选中恰好选择 ' + choice.chooseExactly + ' 项；当前选择 ' + selectedIds.length + ' 项。');
    }
  }
  const selections: OperationSceneActionBatchCommand['selections'][number][] = [];
  if (view.currentActionMode === 'individual') {
    for (const saved of draft.selections) {
      if (!saved?.sceneActionId || !saved.actorId) throw new Error('所选个人行动缺少执行者。');
      const action = view.currentSceneActions.find(item => item.id === saved.sceneActionId && item.scope === 'individual');
      if (!action || !action.eligibleActorIds.includes(saved.actorId)) throw new Error('所选场景行动已经失效，请重新选择。');
      const legalTargets = action.legalTargetActorIdsByActorId[saved.actorId] ?? [];
      const targetActorIds = saved.targetActorIds;
      if (action.targetSelectionMode === 'all-eligible') {
        if (legalTargets.length === 0) throw new Error('当前没有合格目标，无法执行全体目标行动。');
        if (targetActorIds.length > 0) throw new Error('全体目标行动不接受手动目标列表。');
      }
      if (action.targetSelectionMode !== 'all-eligible' && legalTargets.length > 0 && targetActorIds.length === 0) throw new Error('请为个人行动选择一名目标。');
      if (targetActorIds.some(id => !legalTargets.includes(id))) throw new Error('所选场景目标已经失效，请重新选择。');
      selections.push({ sceneActionId: action.id, actorId: saved.actorId, targetActorIds });
    }
  } else if (view.currentActionMode === 'global') {
    if (!choice && draft.selections.length > 1) throw new Error('全队批次最多选择一项行动。');
    for (const saved of draft.selections) {
      const action = view.currentSceneActions.find(item => item.id === saved.sceneActionId && item.scope === 'global');
      if (!action) throw new Error('所选场景行动已经失效，请重新选择。');
      if (action.performerPolicy === 'selected-student' && (!saved.actorId || !action.eligibleActorIds.includes(saved.actorId))) {
        throw new Error('请先把这张行动牌分配给一名学生。');
      }
      if (action.performerPolicy === 'none' && saved.actorId) throw new Error('免执行者行动不能绑定学生。');
      if (saved.actorId && !action.eligibleActorIds.includes(saved.actorId)) throw new Error('所选执行者已经失效，请重新选择。');
      const legalTargets = saved.actorId
        ? action.legalTargetActorIdsByActorId[saved.actorId] ?? []
        : action.legalActorlessTargetActorIds;
      if (action.targetSelectionMode === 'all-eligible') {
        if (legalTargets.length === 0) throw new Error('当前没有合格目标，无法执行全体目标行动。');
        if (saved.targetActorIds.length > 0) throw new Error('全体目标行动不接受手动目标列表。');
      }
      if (action.targetSelectionMode !== 'all-eligible' && legalTargets.length > 0 && saved.targetActorIds.length === 0) throw new Error('请至少选择一名行动目标；也可以取消这张行动并跳过本批。');
      if (saved.targetActorIds.some(id => !legalTargets.includes(id))) throw new Error('所选场景目标已经失效，请重新选择。');
      selections.push({ sceneActionId: action.id, ...(saved.actorId ? { actorId: saved.actorId } : {}), targetActorIds: saved.targetActorIds });
    }
  } else if (draft.selections.length > 0) {
    throw new Error('This Scene does not accept player SceneAction selections.');
  }
  const cards: NonNullable<OperationSceneActionBatchCommand['cards']>[number][] = [];
  for (const saved of draft.cards) {
    const { cardInstanceId, actorId } = saved;
    if (!cardInstanceId) throw new Error('玩家卡牌无效。');
    const viewCard = view.playerCards.hand.find(item => item.cardInstanceId === cardInstanceId);
    if (!viewCard) throw new Error('玩家卡牌已离开手牌，请重新选择。');
    if (viewCard.performerPolicy === 'selected-student' && (!actorId || !viewCard.eligibleActorIds.includes(actorId))) throw new Error('玩家卡牌执行者已失效，请重新选择。');
    if (viewCard.performerPolicy === 'optional-student' && actorId && !viewCard.eligibleActorIds.includes(actorId)) throw new Error('玩家卡牌执行者已失效，请重新选择。');
    if (viewCard.performerPolicy === 'none' && actorId) throw new Error('免执行者玩家卡不能绑定学生。');
    const legalTargets = actorId
      ? viewCard.legalTargetActorIdsByActorId[actorId] ?? []
      : viewCard.legalActorlessTargetActorIds;
    if (viewCard.targetSelectionMode === 'all-eligible') {
      if (legalTargets.length === 0) throw new Error('当前没有合格目标，无法执行全体目标卡牌。');
      if (saved.targetActorIds.length > 0) throw new Error('全体目标卡牌不接受手动目标列表。');
    }
    if (viewCard.targetSelectionMode !== 'all-eligible' && legalTargets.length > 0 && saved.targetActorIds.length === 0) throw new Error('玩家卡牌至少要选择一名目标。');
    if (saved.targetActorIds.some(id => !legalTargets.includes(id))) throw new Error('玩家卡牌目标已经失效，请重新选择。');
    cards.push({ cardInstanceId, ...(actorId ? { actorId } : {}), targetActorIds: saved.targetActorIds });
  }
  const purchases: NonNullable<OperationSceneActionBatchCommand['purchases']>[number][] = [];
  for (const saved of draft.purchases ?? []) {
    const offer = view.currentScenePurchaseOffers.find(item => item.id === saved.offerId);
    if (!offer || offer.purchased) throw new Error('所选购买项已失效或已在本次 Run 购买，请重新检查。');
    purchases.push({ offerId: offer.id });
  }
  return { ...command, selections, ...(cards.length ? { cards } : {}), ...(purchases.length ? { purchases } : {}) };
}

/** Stable #app delegation survives Operation region replacements and ordinary selections. */
export function bindOperationActions(ctrl: UIController): void {
  if (disposedOperationControllers.has(ctrl) || boundControllers.has(ctrl)) return;
  boundControllers.add(ctrl);
  const resizeMap: EventListener = () => {
    const popup = ctrl.root.querySelector<HTMLElement>('[data-operation-map-popup]:not([hidden])');
    const opener = ctrl.root.querySelector<HTMLElement>('[data-operation-map-open]');
    const runId = opener?.dataset.runId;
    if (!popup || !runId) return;
    const rect = popup.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, rect.left));
    const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, rect.top));
    popup.style.setProperty('--operation-map-x', `${x}px`);
    popup.style.setProperty('--operation-map-y', `${y}px`);
    moveOperationWorkspaceMap(runId, x, y);
  };
  operationMapResizeListeners.set(ctrl, resizeMap);
  window.addEventListener('resize', resizeMap);
  bindCardTargetGestures(ctrl);
  ctrl.root.addEventListener('click', event => handleOperationClick(ctrl, event));
}
