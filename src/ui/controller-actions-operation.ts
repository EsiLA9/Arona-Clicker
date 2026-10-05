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
const disposedOperationControllers = new WeakSet<UIController>();

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

function updateCostPreview(workspace: HTMLElement | null): void {
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
}

interface OperationCardDrag {
  readonly source: HTMLButtonElement;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly candidateIds: readonly string[];
  active: boolean;
  hoveredActorId: string | null;
}

const cardDrags = new WeakMap<UIController, OperationCardDrag>();
const suppressedCardClicks = new WeakMap<UIController, HTMLButtonElement>();
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
  return element?.closest<HTMLElement>('[data-workspace-frame="operation"]') ?? null;
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
    element.style.left = `${Math.round(left * 100) / 100}px`;
    element.style.top = `${Math.round(top * 100) / 100}px`;
    element.dataset.positioned = 'true';
    positions.set(element, { left, top, width, height });
  };

  for (const [ownerId, ownerCards] of cardsByOwner) {
    const owner = anchors.get(ownerId);
    if (!owner?.isConnected) {
      ownerCards.forEach(card => { card.hidden = true; });
      continue;
    }
    const ownerRect = owner.getBoundingClientRect();
    if (ownerRect.width <= 0 || ownerRect.height <= 0) continue;
    const current = ownerCards.find(card => card.hasAttribute('data-operation-action-current') || card.hasAttribute('data-operation-action-current-toggle'));
    if (current) {
      const width = dimension(current, 'width', 112);
      const height = dimension(current, 'height', 62);
      const rightLeft = ownerRect.right - layerLeft + 8;
      const leftLeft = ownerRect.left - layerLeft - width - 8;
      const minFrameLeft = hostRect.left - layerLeft + 4;
      const maxFrameRight = hostRect.right - layerLeft - 4;
      const rightFits = rightLeft + width <= maxFrameRight;
      const leftFits = leftLeft >= minFrameLeft;
      // Keep the selected face outside the owner card so its HP / resource row
      // remains readable. At narrow widths, flip to the owner's left when that
      // side fits; if neither side fits, preserve the non-overlapping right anchor.
      const left = rightFits ? rightLeft : leftFits ? leftLeft : rightLeft;
      const top = ownerRect.top - layerTop + 9;
      place(current, left, top, width, height);

      const alternatives = ownerCards.filter(card => card.hasAttribute('data-operation-action-alternative'));
      const panel = [...layer.children].find(child => child instanceof HTMLElement
        && child.matches('[data-operation-action-alternatives-panel]')
        && child.dataset.operationActionOwnerId === ownerId) as HTMLElement | undefined;
      const open = current.getAttribute('aria-expanded') === 'true';
      if (panel) panel.hidden = !open;
      for (const card of alternatives) card.hidden = !open;
      if (open && alternatives.length > 0 && panel) {
        const gap = 8;
        const cardWidth = 112;
        const cardHeight = 62;
        const availableRight = hostRect.right - (layerLeft + left + width + gap);
        const columns = availableRight >= cardWidth * 2 + 24 ? 2 : 1;
        const rows = Math.ceil(alternatives.length / columns);
        const panelWidth = columns * cardWidth + (columns - 1) * 6 + 16;
        const panelHeight = 28 + rows * cardHeight + Math.max(0, rows - 1) * 8 + 12;
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
        alternatives.forEach((card, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          place(card, panelLeft + 8 + column * (cardWidth + 6), panelTop + 27 + row * (cardHeight + 8), cardWidth, cardHeight);
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

  for (const tray of layer.querySelectorAll<HTMLElement>('[data-operation-action-targets][data-operation-prepared-owner-id]')) {
    const ownerId = tray.dataset.operationPreparedOwnerId;
    const actionId = tray.dataset.operationActionId;
    const card = cards.find(item => item.dataset.operationPreparedOwnerId === ownerId && item.dataset.actionId === actionId);
    const position = card ? positions.get(card) : undefined;
    if (!position || tray.hidden) continue;
    tray.style.left = `${position.left}px`;
    tray.style.top = `${position.top + position.height + 8}px`;
    tray.dataset.positioned = 'true';
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

function focusActionTargetChoice(tray: HTMLElement): void {
  const choices = [...tray.querySelectorAll<HTMLButtonElement>('[data-operation-target]:not(:disabled)')];
  (choices.find(button => button.getAttribute('aria-pressed') === 'true')
    ?? choices.find(button => button.hasAttribute('data-default-target'))
    ?? choices[0])?.focus({ preventScroll: true });
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

function setFaceTargetSummary(face: HTMLElement, group: HTMLElement | null, selector: string, defaultText = '无需指定目标'): void {
  const names = [...(group?.querySelectorAll<HTMLElement>(selector) ?? [])]
    .filter(button => button.getAttribute('aria-pressed') === 'true')
    .map(button => button.textContent?.trim())
    .filter((name): name is string => Boolean(name));
  const summary = names.length ? '→ ' + names.join('、') : defaultText;
  face.dataset.targetSummary = summary;
  const summaryNode = face.querySelector<HTMLElement>('[data-operation-card-target-summary]');
  if (summaryNode) summaryNode.textContent = summary;
  updateSceneFaceAccessibleName(face);
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

function drawCardRelation(ctrl: UIController, drag: OperationCardDrag, targetActorId: string | null): void {
  const host = operationWorkspaceHost(drag.source);
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
  const sourceRect = drag.source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x1 = sourceRect.left + sourceRect.width / 2 - svgRect.left;
  const y1 = sourceRect.top + sourceRect.height / 2 - svgRect.top;
  const x2 = targetRect.left + targetRect.width / 2 - svgRect.left;
  const y2 = targetRect.top + targetRect.height / 2 - svgRect.top;
  const bend = Math.max(18, Math.min(90, Math.abs(x2 - x1) * 0.18));
  path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
  path.removeAttribute('visibility');
}

function clearCardDragPresentation(ctrl: UIController, drag: OperationCardDrag): void {
  drag.source.classList.remove('is-card-drag-source');
  for (const actor of ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target].is-card-legal-target, [data-operation-actor-target].is-card-hover-target')) {
    actor.classList.remove('is-card-legal-target', 'is-card-hover-target');
  }
  const host = operationWorkspaceHost(drag.source);
  const path = host?.querySelector<SVGPathElement>('[data-operation-drag-relation]');
  path?.setAttribute('visibility', 'hidden');
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
function saveSceneDraftFromWorkspace(workspace: HTMLElement): OperationSceneDraft | null {
  const source = workspace.querySelector<HTMLElement>('[data-operation-scene-stage]')
    ?? workspace.querySelector<HTMLElement>('[data-operation-scene-choice], [data-operation-card-toggle]');
  const command = source ? readCommandVersion(source) : null;
  const locationId = operationLocationId(workspace);
  if (!command || !locationId) return null;

  const selections: OperationSceneDraft['selections'][number][] = [];
  for (const card of workspace.querySelectorAll<HTMLElement>('[data-operation-scene-card]')) {
    const face = card.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]');
    const option = face?.closest<HTMLElement>('[data-operation-scene-option]');
    if (!face || !option) continue;
    const performerId = card.hasAttribute('data-global-scene-card')
      ? [...option.querySelectorAll<HTMLElement>('[data-operation-scene-performer][aria-pressed="true"]')]
        .map(button => button.dataset.actorId).find((id): id is string => Boolean(id)) ?? face.dataset.actorId
      : card.dataset.actorId;
    const sceneActionId = face.dataset.sceneActionId;
    if (!performerId || !sceneActionId) continue;
    const targetGroup = [...option.querySelectorAll<HTMLElement>('[data-targets-for]')]
      .find(group => group.dataset.targetsFor === performerId);
    const targetActorIds = [...(targetGroup?.querySelectorAll<HTMLElement>('[data-operation-scene-target][aria-pressed="true"]') ?? [])]
      .map(button => button.dataset.targetActorId).filter((id): id is string => Boolean(id));
    selections.push({ sceneActionId, actorId: performerId, targetActorIds });
  }

  const cards: OperationSceneDraft['cards'][number][] = [];
  for (const card of workspace.querySelectorAll<HTMLElement>('[data-operation-player-card].is-selected')) {
    const face = card.querySelector<HTMLElement>('[data-operation-card-toggle]');
    const cardInstanceId = card.dataset.operationPlayerCard;
    const actorId = card.querySelector<HTMLElement>('[data-operation-card-actor][aria-pressed="true"]')?.dataset.actorId
      ?? face?.dataset.actorId;
    if (!face || !cardInstanceId || !actorId) continue;
    const targetGroup = [...card.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]')]
      .find(group => group.dataset.operationCardTargetsFor === actorId);
    const targetActorIds = [...(targetGroup?.querySelectorAll<HTMLElement>('[data-operation-card-target][aria-pressed="true"]') ?? [])]
      .map(button => button.dataset.targetActorId).filter((id): id is string => Boolean(id));
    cards.push({ cardInstanceId, actorId, targetActorIds });
  }

  const draft: OperationSceneDraft = { selections, cards };
  saveOperationSceneDraft(command.runId, command.planVersion, locationId, draft);
  return draft;
}

function saveSceneDraftFromElement(element: HTMLElement): void {
  const workspace = element.closest<HTMLElement>('[data-workspace-frame="operation"]');
  if (workspace) saveSceneDraftFromWorkspace(workspace);
}

/** Initial staging uses the same choices the pure renderer presents before any local edits. */
function defaultSceneDraftFromView(view: OperationView): OperationSceneDraft {
  const selections: OperationSceneDraft['selections'][number][] = [];
  if (view.currentActionMode === 'individual') {
    const students = view.actorStates.filter(actor => actor.participantKind === 'student');
    students.forEach((actor, index) => {
      if (actor.hp <= 0) return;
      const actions = view.currentSceneActions.filter(action => action.scope === 'individual' && action.eligibleActorIds.includes(actor.id));
      const chosen = actions[Math.min(index, Math.max(actions.length - 1, 0))];
      if (!chosen) return;
      selections.push({
        sceneActionId: chosen.id,
        actorId: actor.id,
        targetActorIds: (chosen.legalTargetActorIdsByActorId[actor.id] ?? []).slice(0, 1),
      });
    });
  } else if (view.currentActionMode === 'global') {
    const chosen = view.currentSceneActions.find(action => action.scope === 'global' && action.eligibleActorIds.length > 0);
    const actorId = chosen?.eligibleActorIds[0];
    if (chosen && actorId) {
      selections.push({
        sceneActionId: chosen.id,
        actorId,
        targetActorIds: [...(chosen.legalTargetActorIdsByActorId[actorId] ?? [])],
      });
    }
  }
  return { selections, cards: [] };
}

function selectSceneCardTarget(face: HTMLButtonElement, targetActorId: string): void {
  const option = face.closest<HTMLElement>('[data-operation-scene-option]');
  const card = face.closest<HTMLElement>('[data-operation-scene-card]');
  if (!option || !card) return;
  card.querySelectorAll<HTMLElement>('[data-operation-scene-choice]').forEach(choice => updateFaceSelection(choice, choice === face));
  card.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(row => row.classList.toggle('is-selected', row === option));
  const map = readLegalTargetMap(face);
  const performerId = face.dataset.actorId ?? '';
  const targetGroup = [...option.querySelectorAll<HTMLElement>('[data-targets-for]')].find(group => group.dataset.targetsFor === performerId) ?? null;
  targetGroup?.querySelectorAll<HTMLElement>('[data-operation-scene-target]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.targetActorId === targetActorId));
  });
  face.dataset.legalTargetActorIds = JSON.stringify(map[performerId] ?? []);
  face.dataset.targetSummary = '→ ' + ([...(targetGroup?.querySelectorAll<HTMLElement>('[data-operation-scene-target]') ?? [])].find(button => button.dataset.targetActorId === targetActorId)?.textContent?.trim() ?? '已选择目标');
  const summaryNode = face.querySelector<HTMLElement>('[data-operation-card-target-summary]');
  if (summaryNode) summaryNode.textContent = face.dataset.targetSummary;
  updateSceneFaceAccessibleName(face);
  saveSceneDraftFromElement(face);
  updateCostPreview(face.closest<HTMLElement>('[data-workspace-frame="operation"]'));
}

function applyPlayerCardTarget(face: HTMLButtonElement, targetActorId: string): void {
  const card = face.closest<HTMLElement>('[data-operation-player-card]');
  if (!card) return;
  face.setAttribute('aria-pressed', 'true');
  card.classList.add('is-selected');
  card.querySelector<HTMLElement>('.operation-player-card__tools')?.removeAttribute('hidden');
  const status = face.querySelector<HTMLElement>('[data-operation-card-status]');
  if (status) status.textContent = '已加入';
  const actorId = face.dataset.actorId ?? '';
  const targetGroup = [...card.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]')].find(group => group.dataset.operationCardTargetsFor === actorId) ?? null;
  if (!targetGroup) return;
  targetGroup.querySelectorAll<HTMLElement>('[data-operation-card-target]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.targetActorId === targetActorId));
  });
  setFaceTargetSummary(face, targetGroup, '[data-operation-card-target]');
  saveSceneDraftFromElement(face);
  updateCostPreview(face.closest<HTMLElement>('[data-workspace-frame="operation"]'));
}

function applyCardDrop(ctrl: UIController, drag: OperationCardDrag, targetActorId: string): void {
  const face = drag.source;
  const kind = face.dataset.cardKind;
  if (kind === 'battle-action') {
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
    selectSceneCardTarget(face, targetActorId);
    announceCardDrag(drag, '已把這张行动牌指向合法目标。');
    return;
  }
  if (kind === 'player-card') {
    applyPlayerCardTarget(face, targetActorId);
    announceCardDrag(drag, '已把这张场景卡指向合法目标。');
  }
}

function bindCardTargetGestures(ctrl: UIController): void {
  ctrl.root.addEventListener('pointerdown', event => {
    if (event.button !== 0 || ctrl.panelState.workspace?.type !== 'operation') return;
    const rawTarget = event.target;
    if (!(rawTarget instanceof Element)) return;
    const face = rawTarget.closest<HTMLButtonElement>('[data-operation-action], [data-operation-scene-choice], [data-operation-card-toggle]');
    if (!face || face.disabled) return;
    const candidateIds = readLegalTargetIds(face);
    if (!candidateIds.length) return;
    const drag: OperationCardDrag = {
      source: face,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      candidateIds,
      active: false,
      hoveredActorId: null,
    };
    cardDrags.set(ctrl, drag);
    try { face.setPointerCapture(event.pointerId); } catch { /* Browser may refuse capture when a region is replaced. */ }
  });
  ctrl.root.addEventListener('pointermove', event => {
    const drag = cardDrags.get(ctrl);
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= CARD_DRAG_THRESHOLD) {
      drag.active = true;
      drag.source.classList.add('is-card-drag-source');
      drag.source.closest<HTMLElement>('[data-workspace-frame="operation"]')?.classList.add('is-card-dragging');
      for (const actor of ctrl.root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')) {
        if (drag.candidateIds.includes(actor.dataset.operationActorTarget ?? '')) actor.classList.add('is-card-legal-target');
      }
      announceCardDrag(drag, '拖到高亮人物上设置合法目标；按 Escape 取消。');
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
      drawCardRelation(ctrl, drag, targetId);
    }
  });
  ctrl.root.addEventListener('pointerup', event => {
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
      else announceCardDrag(drag, '未更改目标：请放到高亮人物上。');
    } else {
      clearCardDragPresentation(ctrl, drag);
    }
  });
  const cancel = (event: PointerEvent): void => {
    const drag = cardDrags.get(ctrl);
    if (!drag || drag.pointerId !== event.pointerId) return;
    cardDrags.delete(ctrl);
    clearCardDragPresentation(ctrl, drag);
  };
  ctrl.root.addEventListener('pointercancel', cancel);
  ctrl.root.addEventListener('lostpointercapture', cancel, true);
  ctrl.root.addEventListener('keydown', event => {
    const rawTarget = event.target;
    if (event.key === 'ArrowDown' && rawTarget instanceof Element) {
      const face = rawTarget.closest<HTMLButtonElement>('[data-operation-action][aria-pressed="true"]');
      const legalTargets = face ? readLegalTargetIds(face) : [];
      if (face && legalTargets.length > 0) {
        const host = operationWorkspaceHost(face);
        const tray = [...(host?.querySelectorAll<HTMLElement>('[data-operation-action-targets]') ?? [])]
          .find(item => item.dataset.operationPreparedOwnerId === face.dataset.actorId && item.dataset.operationActionId === face.dataset.actionId);
        if (tray) {
          event.preventDefault();
          tray.hidden = false;
          focusActionTargetChoice(tray);
          requestPreparedCardLayout(ctrl);
          return;
        }
      }
    }
    if (event.key !== 'Escape') return;
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
    const activeTray = rawTarget instanceof Element ? rawTarget.closest<HTMLElement>('[data-operation-action-targets]') : null;
    const targetSource = activeTray
      ? [...(host?.querySelectorAll<HTMLElement>('[data-operation-action]') ?? [])].find(face =>
        face.dataset.actorId === activeTray.dataset.operationPreparedOwnerId && face.dataset.actionId === activeTray.dataset.operationActionId,
      )
      : null;
    const expanded = host?.querySelectorAll<HTMLElement>('[data-operation-action-targets]:not([hidden])') ?? [];
    if (expandedCurrent || targetSource || expanded.length > 0) {
      event.preventDefault();
      for (const panel of host?.querySelectorAll<HTMLElement>('[data-operation-action-alternatives-panel], [data-operation-action-alternative], [data-operation-action-targets]') ?? []) panel.hidden = true;
      expandedCurrent?.setAttribute('aria-expanded', 'false');
      const returnTarget = expandedCurrent ?? targetSource;
      returnTarget?.focus({ preventScroll: true });
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
    '[data-operation-start], [data-operation-resume-run], [data-operation-back], [data-operation-action-current-toggle], [data-operation-action], [data-operation-target], [data-operation-clear], [data-operation-commit], [data-operation-scene-stage], [data-operation-scene-commit], [data-operation-clear-scene], [data-operation-route], [data-operation-reward], [data-operation-scene-choice], [data-operation-scene-target], [data-operation-scene-performer], [data-operation-card-toggle], [data-operation-card-actor], [data-operation-card-target], [data-operation-scene-alternatives]',
  );
  if (!target || target instanceof HTMLButtonElement && target.disabled) return;
  if (target.matches('[data-operation-action-current-toggle]')) {
    const host = operationWorkspaceHost(target);
    const actorId = target.dataset.operationActionOwnerId;
    if (!host || !actorId) return;
    const open = target.getAttribute('aria-expanded') !== 'true';
    target.setAttribute('aria-expanded', String(open));
    const layer = preparedLayer(host);
    for (const option of layer?.querySelectorAll<HTMLElement>('[data-operation-action-alternative]') ?? []) {
      if (option.dataset.operationActionOwnerId === actorId) option.hidden = !open;
    }
    const panel = [...(layer?.querySelectorAll<HTMLElement>('[data-operation-action-alternatives-panel]') ?? [])]
      .find(item => item.dataset.operationActionOwnerId === actorId);
    if (panel) panel.hidden = !open;
    if (open && event.detail === 0) {
      [...(layer?.querySelectorAll<HTMLButtonElement>('[data-operation-action-alternative]') ?? [])]
        .find(option => option.dataset.operationActionOwnerId === actorId && !option.disabled)?.focus({ preventScroll: true });
    }
    requestPreparedCardLayout(ctrl);
    return;
  }
  if (target.matches('[data-operation-action][aria-pressed="true"]')) {
    const host = operationWorkspaceHost(target);
    const actorId = target.dataset.operationActionOwnerId;
    if (!host || !actorId) return;
    const open = target.getAttribute('aria-expanded') !== 'true';
    target.setAttribute('aria-expanded', String(open));
    const layer = preparedLayer(host);
    for (const option of layer?.querySelectorAll<HTMLElement>('[data-operation-action-alternative]') ?? []) {
      if (option.dataset.operationActionOwnerId === actorId) option.hidden = !open;
    }
    const panel = [...(layer?.querySelectorAll<HTMLElement>('[data-operation-action-alternatives-panel]') ?? [])]
      .find(item => item.dataset.operationActionOwnerId === actorId);
    if (panel) panel.hidden = !open;
    if (open && event.detail === 0) {
      [...(layer?.querySelectorAll<HTMLButtonElement>('[data-operation-action-alternative]') ?? [])]
        .find(option => option.dataset.operationActionOwnerId === actorId && !option.disabled)?.focus({ preventScroll: true });
    }
    requestPreparedCardLayout(ctrl);
    return;
  }
  if (target.matches('[data-operation-scene-alternatives]')) {
    const open = target.getAttribute('aria-expanded') !== 'true';
    target.setAttribute('aria-expanded', String(open));
    target.closest<HTMLElement>('[data-operation-scene-card]')?.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(option => {
      option.hidden = !open && !option.classList.contains('is-selected');
    });
    return;
  }
  if (target.matches('[data-operation-action][data-operation-action-alternative]')) {
    const targetIds = readLegalTargetIds(target);
    if (targetIds.length > 0) {
      // Mouse users choose a target by dragging this face onto a legal object.
      // Native button activation (detail 0) remains the keyboard target path.
      if (event.detail !== 0) return;
      const host = operationWorkspaceHost(target);
      const tray = [...(host?.querySelectorAll<HTMLElement>('[data-operation-action-targets]') ?? [])]
        .find(item => item.dataset.operationPreparedOwnerId === target.dataset.actorId && item.dataset.operationActionId === target.dataset.actionId);
      if (tray) {
        tray.hidden = !tray.hidden;
        if (!tray.hidden && event.detail === 0) focusActionTargetChoice(tray);
        requestPreparedCardLayout(ctrl);
      }
      return;
    }
  }
  if (target.matches('[data-operation-scene-choice]')) {
    const card = target.closest<HTMLElement>('[data-operation-scene-card]');
    const selectedOption = target.closest<HTMLElement>('[data-operation-scene-option]');
    if (!card || !selectedOption) return;
    const wasSelected = target.getAttribute('aria-pressed') === 'true';
    card.querySelectorAll<HTMLElement>('[data-operation-scene-choice]').forEach(button => updateFaceSelection(button, button === target));
    card.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(option => option.classList.toggle('is-selected', option === selectedOption));
    card.querySelectorAll<HTMLElement>('.operation-scene-targets').forEach(group => { group.hidden = true; });
    const selectedActorId = target.dataset.actorId ?? '';
    const selectedTargets = [...selectedOption.querySelectorAll<HTMLElement>('[data-targets-for]')].find(group => group.dataset.targetsFor === selectedActorId);
    if (selectedTargets) selectedTargets.hidden = !wasSelected;
    const performerGroup = selectedOption.querySelector<HTMLElement>('.operation-scene-performers');
    if (performerGroup) performerGroup.hidden = !wasSelected;
    const alternativesOpen = card.querySelector<HTMLElement>('[data-operation-scene-alternatives]')?.getAttribute('aria-expanded') === 'true';
    card.querySelectorAll<HTMLElement>('[data-operation-scene-option]').forEach(option => {
      option.hidden = !alternativesOpen && !option.classList.contains('is-selected');
    });
    if (card) card.dataset.selectedSceneActionId = target.dataset.sceneActionId ?? '';
    saveSceneDraftFromElement(target);
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
    const face = target.closest<HTMLElement>('[data-operation-scene-option]')?.querySelector<HTMLElement>('[data-operation-scene-choice]');
    if (face && group) setFaceTargetSummary(face, group, '[data-operation-scene-target]', '选择目标');
    saveSceneDraftFromElement(target);
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-scene-performer]')) {
    const group = target.closest<HTMLElement>('.operation-scene-performers');
    group?.querySelectorAll<HTMLElement>('[data-operation-scene-performer]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    const card = target.closest<HTMLElement>('[data-global-scene-card]');
    const choice = card?.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]');
    if (choice) {
      const actorId = target.dataset.actorId ?? '';
      const actorTargets = readLegalTargetMap(choice)[actorId] ?? [];
      choice.dataset.actorId = actorId;
      choice.dataset.legalTargetActorIds = JSON.stringify(actorTargets);
      const option = choice.closest<HTMLElement>('[data-operation-scene-option]');
      option?.querySelectorAll<HTMLElement>('[data-targets-for]').forEach(targetGroup => {
        targetGroup.hidden = targetGroup.dataset.targetsFor !== actorId;
      });
      const group = [...(option?.querySelectorAll<HTMLElement>('[data-targets-for]') ?? [])].find(item => item.dataset.targetsFor === actorId);
      if (group) group.hidden = false;
      setFaceTargetSummary(choice, group ?? null, '[data-operation-scene-target]', actorTargets.length ? '选择目标' : '无需指定目标');
    }
    saveSceneDraftFromElement(target);
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-card-toggle]')) {
    const selected = target.getAttribute('aria-pressed') !== 'true';
    target.setAttribute('aria-pressed', String(selected));
    const card = target.closest<HTMLElement>('[data-operation-player-card]');
    card?.classList.toggle('is-selected', selected);
    const tools = card?.querySelector<HTMLElement>('.operation-player-card__tools');
    if (tools) tools.hidden = !selected;
    const status = target.querySelector<HTMLElement>('[data-operation-card-status]');
    if (status) status.textContent = selected ? '已加入' : '加入本批';
    updateSceneFaceAccessibleName(target);
    saveSceneDraftFromElement(target);
    updateCostPreview(target.closest<HTMLElement>('[data-workspace-frame="operation"]'));
    return;
  }
  if (target.matches('[data-operation-card-actor]')) {
    const group = target.closest<HTMLElement>('.operation-card-performers');
    group?.querySelectorAll<HTMLElement>('[data-operation-card-actor]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    const card = target.closest<HTMLElement>('[data-operation-player-card]');
    const face = card?.querySelector<HTMLButtonElement>('[data-operation-card-toggle]');
    const actorId = target.dataset.actorId ?? '';
    card?.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]').forEach(targets => {
      targets.hidden = targets.dataset.operationCardTargetsFor !== actorId;
    });
    const selectedGroup = [...(card?.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]') ?? [])].find(targets => targets.dataset.operationCardTargetsFor === actorId);
    const legalTargets = [...(selectedGroup?.querySelectorAll<HTMLElement>('[data-operation-card-target]') ?? [])].map(button => button.dataset.targetActorId).filter((id): id is string => Boolean(id));
    if (face) {
      face.dataset.actorId = actorId;
      face.dataset.legalTargetActorIds = JSON.stringify(legalTargets);
      setFaceTargetSummary(face, selectedGroup ?? null, '[data-operation-card-target]', '选择目标');
    }
    saveSceneDraftFromElement(target);
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
    const face = target.closest<HTMLElement>('[data-operation-player-card]')?.querySelector<HTMLElement>('[data-operation-card-toggle]');
    if (face && group) setFaceTargetSummary(face, group, '[data-operation-card-target]', '选择目标');
    saveSceneDraftFromElement(target);
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
      if (!actorId || !actionId) return;
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
      let draft = readOperationSceneDraft(runId, command.planVersion, view.currentLocationId);
      if (!draft) {
        draft = defaultSceneDraftFromView(view);
        saveOperationSceneDraft(runId, command.planVersion, view.currentLocationId, draft);
      }
      const batch = readSceneBatchCommand(view, command, draft);
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
  view: OperationView,
  command: { readonly runId: string; readonly planVersion: number },
  draft: OperationSceneDraft,
): OperationSceneActionBatchCommand {
  if (!view.currentActionMode) throw new Error('Scene action controls are unavailable');
  const selections: Array<{ sceneActionId: string; actorId: string; targetActorIds: readonly string[] }> = [];
  if (view.currentActionMode === 'individual') {
    const students = view.actorStates.filter(actor => actor.participantKind === 'student' && actor.hp > 0);
    for (const actor of students) {
      const saved = draft.selections.find(selection => selection.actorId === actor.id);
      if (!saved?.sceneActionId) throw new Error('请为每位学生选择一项行动。');
      const action = view.currentSceneActions.find(item => item.id === saved.sceneActionId && item.scope === 'individual');
      if (!action || !action.eligibleActorIds.includes(actor.id)) throw new Error('所选场景行动已经失效，请重新选择。');
      const legalTargets = action.legalTargetActorIdsByActorId[actor.id] ?? [];
      const targetActorIds = saved.targetActorIds.length ? saved.targetActorIds : legalTargets;
      if (targetActorIds.some(id => !legalTargets.includes(id))) throw new Error('所选场景目标已经失效，请重新选择。');
      selections.push({ sceneActionId: action.id, actorId: actor.id, targetActorIds });
    }
  } else {
    const saved = draft.selections[0];
    if (!saved?.sceneActionId || !saved.actorId) throw new Error('请选择全局行动和执行者。');
    const action = view.currentSceneActions.find(item => item.id === saved.sceneActionId && item.scope === 'global');
    if (!action || !action.eligibleActorIds.includes(saved.actorId)) throw new Error('所选场景行动或执行者已经失效，请重新选择。');
    const legalTargets = action.legalTargetActorIdsByActorId[saved.actorId] ?? [];
    if (legalTargets.length > 0 && saved.targetActorIds.length === 0) throw new Error('全局行动至少要选择一名目标。');
    if (saved.targetActorIds.some(id => !legalTargets.includes(id))) throw new Error('所选场景目标已经失效，请重新选择。');
    selections.push({ sceneActionId: action.id, actorId: saved.actorId, targetActorIds: saved.targetActorIds });
  }
  const cards: Array<{ cardInstanceId: string; actorId: string; targetActorIds: readonly string[] }> = [];
  for (const saved of draft.cards) {
    const { cardInstanceId, actorId } = saved;
    if (!cardInstanceId || !actorId) throw new Error('玩家卡牌执行者无效。');
    const viewCard = view.playerCards.hand.find(item => item.cardInstanceId === cardInstanceId);
    if (!viewCard) throw new Error('玩家卡牌已离开手牌，请重新选择。');
    if (!viewCard.eligibleActorIds.includes(actorId)) throw new Error('玩家卡牌执行者已失效，请重新选择。');
    const legalTargets = viewCard.legalTargetActorIdsByActorId[actorId] ?? [];
    if (legalTargets.length > 0 && saved.targetActorIds.length === 0) throw new Error('玩家卡牌至少要选择一名目标。');
    if (saved.targetActorIds.some(id => !legalTargets.includes(id))) throw new Error('玩家卡牌目标已经失效，请重新选择。');
    cards.push({ cardInstanceId, actorId, targetActorIds: saved.targetActorIds });
  }
  return { ...command, selections, ...(cards.length ? { cards } : {}) };
}

/** Stable #app delegation survives Operation region replacements and ordinary selections. */
export function bindOperationActions(ctrl: UIController): void {
  if (disposedOperationControllers.has(ctrl) || boundControllers.has(ctrl)) return;
  boundControllers.add(ctrl);
  bindCardTargetGestures(ctrl);
  ctrl.root.addEventListener('click', event => handleOperationClick(ctrl, event));
}
