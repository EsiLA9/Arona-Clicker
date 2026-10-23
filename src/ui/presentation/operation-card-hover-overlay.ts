type OperationPopoverElement = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

type PreferredCardInput = 'pointer' | 'focus' | null;

interface OperationCardHoverOverlayState {
  readonly root: HTMLElement;
  readonly layer: OperationPopoverElement;
  readonly resizeObserver: ResizeObserver | null;
  pointerFace: HTMLButtonElement | null;
  focusFace: HTMLButtonElement | null;
  preferredInput: PreferredCardInput;
  selectedKey: string | null;
  pendingClickKey: string | null;
  presentationSource: HTMLButtonElement | null;
  presentation: HTMLButtonElement | null;
  presentationMarkup: string;
  isOpen: boolean;
  nativePopoverOpen: boolean;
  suspended: boolean;
  frame: number | null;
  readonly pointerOverListener: EventListener;
  readonly pointerOutListener: EventListener;
  readonly focusInListener: EventListener;
  readonly focusOutListener: EventListener;
  readonly clickListener: EventListener;
  readonly scrollListener: EventListener;
  readonly resizeListener: EventListener;
  readonly mutationObserver: MutationObserver | null;
}

const operationCardHoverOverlays = new WeakMap<HTMLElement, OperationCardHoverOverlayState>();

function cardFaceFrom(root: HTMLElement, target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const face = target.closest<HTMLButtonElement>('.operation-card-fan .operation-card-face');
  return face instanceof HTMLButtonElement && root.contains(face) && !face.disabled ? face : null;
}

function cardKey(face: HTMLButtonElement): string | null {
  if (face.dataset.cardInstanceId) return 'player:' + face.dataset.cardInstanceId;
  if (face.dataset.sceneActionId) {
    return 'scene:' + (face.dataset.runId ?? '') + ':' + face.dataset.sceneActionId + ':' + (face.dataset.actorId ?? '');
  }
  return null;
}

function isSelected(face: HTMLButtonElement): boolean {
  return face.getAttribute('aria-pressed') === 'true' || face.classList.contains('is-selected');
}

function activeTransform(face: HTMLButtonElement, computed: CSSStyleDeclaration): string {
  const angle = computed.getPropertyValue('--card-angle').trim() || '0deg';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return `rotate(${angle})`;
  return isSelected(face)
    ? `translateY(-5px) rotate(${angle}) scale(1.045)`
    : `translateY(-4px) rotate(${angle}) scale(1.04)`;
}

function findCardByKey(root: HTMLElement, key: string): HTMLButtonElement | null {
  for (const face of root.querySelectorAll<HTMLButtonElement>('.operation-card-fan .operation-card-face')) {
    if (!face.disabled && cardKey(face) === key && isSelected(face)) return face;
  }
  return null;
}

function intersectsVisibleClips(face: HTMLElement): boolean {
  const rect = face.getBoundingClientRect();
  let left = Math.max(0, rect.left);
  let top = Math.max(0, rect.top);
  let right = Math.min(window.innerWidth, rect.right);
  let bottom = Math.min(window.innerHeight, rect.bottom);
  if (right <= left || bottom <= top) return false;

  for (let parent = face.parentElement; parent; parent = parent.parentElement) {
    const style = window.getComputedStyle(parent);
    const clipX = style.overflowX !== 'visible' && style.overflowX !== 'overlay';
    const clipY = style.overflowY !== 'visible' && style.overflowY !== 'overlay';
    const paintClip = style.contain.split(/\s+/).includes('paint') || style.clipPath !== 'none';
    if (!clipX && !clipY && !paintClip) continue;

    const parentRect = parent.getBoundingClientRect();
    const clipLeft = parentRect.left + parent.clientLeft;
    const clipTop = parentRect.top + parent.clientTop;
    const clipRight = clipLeft + parent.clientWidth;
    const clipBottom = clipTop + parent.clientHeight;
    if (clipX || paintClip) {
      left = Math.max(left, clipLeft);
      right = Math.min(right, clipRight);
    }
    if (clipY || paintClip) {
      top = Math.max(top, clipTop);
      bottom = Math.min(bottom, clipBottom);
    }
    if (right <= left || bottom <= top) return false;
  }
  return true;
}

function copyComputedStyles(source: Element, target: Element): void {
  const sourceStyle = window.getComputedStyle(source);
  const targetStyle = (target as HTMLElement).style;
  for (let index = 0; index < sourceStyle.length; index += 1) {
    const property = sourceStyle.item(index);
    targetStyle.setProperty(property, sourceStyle.getPropertyValue(property), sourceStyle.getPropertyPriority(property));
  }
  const sourceChildren = [...source.children];
  const targetChildren = [...target.children];
  for (let index = 0; index < Math.min(sourceChildren.length, targetChildren.length); index += 1) {
    copyComputedStyles(sourceChildren[index], targetChildren[index]);
  }
}

function removeInteractionAttributes(element: HTMLElement): void {
  for (const attribute of [...element.attributes]) {
    if (attribute.name === 'id' || attribute.name.startsWith('data-')
      || attribute.name === 'aria-label' || attribute.name === 'aria-pressed'
      || attribute.name === 'aria-controls' || attribute.name === 'aria-expanded'
      || attribute.name === 'tabindex' || attribute.name === 'title') {
      element.removeAttribute(attribute.name);
    }
  }
  element.style.pointerEvents = 'none';
  for (const child of element.children) removeInteractionAttributes(child as HTMLElement);
}

function ensureLayerConnected(state: OperationCardHoverOverlayState): void {
  if (state.layer.isConnected) return;
  state.isOpen = false;
  state.nativePopoverOpen = false;
  state.presentation = null;
  state.presentationSource = null;
  state.presentationMarkup = '';
  state.layer.replaceChildren();
  state.root.ownerDocument.body.append(state.layer);
}

function showLayer(state: OperationCardHoverOverlayState): void {
  if (state.isOpen) return;
  state.layer.classList.add('is-open');
  if (typeof state.layer.showPopover === 'function') {
    try {
      state.layer.showPopover();
      state.nativePopoverOpen = true;
    } catch {
      state.nativePopoverOpen = false;
    }
  }
  state.isOpen = true;
}

function hideLayer(state: OperationCardHoverOverlayState, clearPresentation: boolean): void {
  if (state.nativePopoverOpen && typeof state.layer.hidePopover === 'function') {
    try { state.layer.hidePopover(); } catch { /* A detached or already-closed popover needs no further action. */ }
  }
  state.nativePopoverOpen = false;
  state.isOpen = false;
  state.layer.classList.remove('is-open');
  if (clearPresentation) {
    state.layer.replaceChildren();
    state.presentation = null;
    state.presentationSource = null;
    state.presentationMarkup = '';
  }
}

function syncPresentation(state: OperationCardHoverOverlayState, face: HTMLButtonElement): void {
  ensureLayerConnected(state);
  const markup = face.outerHTML;
  if (state.presentationSource !== face || state.presentationMarkup !== markup || !state.presentation?.isConnected) {
    state.layer.replaceChildren();
    const presentation = face.cloneNode(true) as HTMLButtonElement;
    copyComputedStyles(face, presentation);
    presentation.classList.add('operation-card-hover-presentation');
    removeInteractionAttributes(presentation);
    presentation.setAttribute('aria-hidden', 'true');
    presentation.tabIndex = -1;
    presentation.inert = true;

    const computed = window.getComputedStyle(face);
    const rect = face.getBoundingClientRect();
    const width = Math.max(1, face.offsetWidth || rect.width);
    const height = Math.max(1, face.offsetHeight || rect.height);
    let translateX = 0;
    let translateY = 0;
    try {
      if (computed.transform !== 'none') {
        const matrix = new DOMMatrixReadOnly(computed.transform);
        translateX = matrix.m41;
        translateY = matrix.m42;
      }
    } catch { /* Keep the measured rectangle if a browser cannot parse the source transform. */ }

    presentation.style.position = 'absolute';
    presentation.style.left = `${rect.left + rect.width / 2 - width / 2 - translateX}px`;
    presentation.style.top = `${rect.top + rect.height / 2 - height / 2 - translateY}px`;
    presentation.style.width = `${width}px`;
    presentation.style.height = `${height}px`;
    presentation.style.boxSizing = 'border-box';
    presentation.style.margin = '0';
    presentation.style.zIndex = '2147483647';
    presentation.style.pointerEvents = 'none';
    presentation.style.setProperty('--card-angle', computed.getPropertyValue('--card-angle').trim() || '0deg');
    presentation.style.transform = activeTransform(face, computed);
    presentation.style.borderColor = '#d49d25';
    presentation.style.outline = '2px solid #d49d25';
    presentation.style.outlineOffset = '2px';
    presentation.style.boxShadow = '0 0 0 4px #f4dc8d70, 0 9px 18px #142f3a40';

    state.layer.append(presentation);
    state.presentation = presentation;
    state.presentationSource = face;
    state.presentationMarkup = markup;
    state.resizeObserver?.disconnect();
    state.resizeObserver?.observe(face);
    const fan = face.closest('.operation-card-fan');
    if (fan) state.resizeObserver?.observe(fan);
  }

  const rect = face.getBoundingClientRect();
  const computed = window.getComputedStyle(face);
  let translateX = 0;
  let translateY = 0;
  try {
    if (computed.transform !== 'none') {
      const matrix = new DOMMatrixReadOnly(computed.transform);
      translateX = matrix.m41;
      translateY = matrix.m42;
    }
  } catch { /* Retain the last stable position on unsupported transform syntax. */ }
  const width = Math.max(1, face.offsetWidth || rect.width);
  const height = Math.max(1, face.offsetHeight || rect.height);
  if (state.presentation) {
    state.presentation.style.left = `${rect.left + rect.width / 2 - width / 2 - translateX}px`;
    state.presentation.style.top = `${rect.top + rect.height / 2 - height / 2 - translateY}px`;
    state.presentation.style.transform = activeTransform(face, computed);
    state.presentation.style.setProperty('--card-angle', computed.getPropertyValue('--card-angle').trim() || '0deg');
  }
  showLayer(state);
}

function resolveActiveFace(state: OperationCardHoverOverlayState): HTMLButtonElement | null {
  if (state.pointerFace && (!state.pointerFace.isConnected || !state.root.contains(state.pointerFace))) state.pointerFace = null;
  if (state.focusFace && (!state.focusFace.isConnected || !state.root.contains(state.focusFace))) state.focusFace = null;
  if (state.preferredInput === 'pointer' && state.pointerFace) return state.pointerFace;
  if (state.preferredInput === 'focus' && state.focusFace) return state.focusFace;
  if (state.pointerFace) return state.pointerFace;
  if (state.focusFace) return state.focusFace;
  if (!state.selectedKey) return null;
  const selected = findCardByKey(state.root, state.selectedKey);
  if (!selected) state.selectedKey = null;
  return selected;
}

function syncOverlay(state: OperationCardHoverOverlayState): void {
  if (state.suspended) {
    hideLayer(state, true);
    return;
  }
  if (state.pendingClickKey) {
    const clicked = findCardByKey(state.root, state.pendingClickKey);
    state.selectedKey = clicked ? state.pendingClickKey : state.selectedKey === state.pendingClickKey ? null : state.selectedKey;
    state.pendingClickKey = null;
  }
  const face = resolveActiveFace(state);
  if (!face || !intersectsVisibleClips(face)) {
    hideLayer(state, true);
    return;
  }
  if (isSelected(face)) state.selectedKey = cardKey(face);
  syncPresentation(state, face);
}

function scheduleSync(state: OperationCardHoverOverlayState): void {
  if (state.frame !== null) return;
  state.frame = window.requestAnimationFrame(() => {
    state.frame = null;
    syncOverlay(state);
  });
}

export function bindOperationCardHoverOverlay(root: HTMLElement): void {
  if (operationCardHoverOverlays.has(root)) return;
  const layer = root.ownerDocument.createElement('div') as OperationPopoverElement;
  layer.className = 'operation-card-hover-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  if (typeof layer.showPopover === 'function') layer.setAttribute('popover', 'manual');

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(() => {
      const state = operationCardHoverOverlays.get(root);
      if (state) {
        state.presentationMarkup = '';
        scheduleSync(state);
      }
    });
  let state: OperationCardHoverOverlayState;

  const pointerOverListener: EventListener = event => {
    const pointerEvent = event as PointerEvent;
    const face = cardFaceFrom(root, pointerEvent.target);
    if (!face || pointerEvent.relatedTarget instanceof Node && face.contains(pointerEvent.relatedTarget)) return;
    state.pointerFace = face;
    state.preferredInput = 'pointer';
    scheduleSync(state);
  };
  const pointerOutListener: EventListener = event => {
    const pointerEvent = event as PointerEvent;
    const face = cardFaceFrom(root, pointerEvent.target);
    if (!face || pointerEvent.relatedTarget instanceof Node && face.contains(pointerEvent.relatedTarget)) return;
    if (state.pointerFace === face) state.pointerFace = null;
    if (state.preferredInput === 'pointer') state.preferredInput = state.focusFace ? 'focus' : null;
    scheduleSync(state);
  };
  const focusInListener: EventListener = event => {
    const face = cardFaceFrom(root, event.target);
    if (!face) return;
    state.focusFace = face;
    state.preferredInput = 'focus';
    scheduleSync(state);
  };
  const focusOutListener: EventListener = event => {
    const focusEvent = event as FocusEvent;
    const face = cardFaceFrom(root, focusEvent.target);
    if (!face || focusEvent.relatedTarget instanceof Node && face.contains(focusEvent.relatedTarget)) return;
    if (state.focusFace === face) state.focusFace = null;
    if (state.preferredInput === 'focus') state.preferredInput = state.pointerFace ? 'pointer' : null;
    scheduleSync(state);
  };
  const clickListener: EventListener = event => {
    const face = cardFaceFrom(root, event.target);
    const key = face ? cardKey(face) : null;
    if (!face || !key) return;
    state.pendingClickKey = key;
    if (event instanceof MouseEvent && event.detail === 0) {
      state.focusFace = face;
      state.preferredInput = 'focus';
    } else {
      state.pointerFace = face;
      state.preferredInput = 'pointer';
    }
    scheduleSync(state);
  };
  const scrollListener: EventListener = () => scheduleSync(state);
  const resizeListener: EventListener = () => {
    state.presentationMarkup = '';
    scheduleSync(state);
  };
  const mutationObserver = typeof MutationObserver === 'undefined'
    ? null
    : new MutationObserver(records => {
      const changedOutsideOverlay = records.some(record => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return !target || target !== layer && !layer.contains(target);
      });
      if (changedOutsideOverlay) {
        state.presentationMarkup = '';
        scheduleSync(state);
      }
    });

  state = {
    root,
    layer,
    resizeObserver,
    pointerFace: null,
    focusFace: null,
    preferredInput: null,
    selectedKey: null,
    pendingClickKey: null,
    presentationSource: null,
    presentation: null,
    presentationMarkup: '',
    isOpen: false,
    nativePopoverOpen: false,
    suspended: false,
    frame: null,
    pointerOverListener,
    pointerOutListener,
    focusInListener,
    focusOutListener,
    clickListener,
    scrollListener,
    resizeListener,
    mutationObserver,
  };
  operationCardHoverOverlays.set(root, state);
  root.addEventListener('pointerover', pointerOverListener);
  root.addEventListener('pointerout', pointerOutListener);
  root.addEventListener('focusin', focusInListener);
  root.addEventListener('focusout', focusOutListener);
  root.addEventListener('click', clickListener);
  window.addEventListener('scroll', scrollListener, true);
  window.addEventListener('resize', resizeListener);
  mutationObserver?.observe(root, { attributes: true, characterData: true, childList: true, subtree: true });
}

export function suspendOperationCardHoverOverlay(root: HTMLElement): void {
  const state = operationCardHoverOverlays.get(root);
  if (!state) return;
  state.suspended = true;
  hideLayer(state, true);
}

export function resumeOperationCardHoverOverlay(root: HTMLElement): void {
  const state = operationCardHoverOverlays.get(root);
  if (!state) return;
  state.suspended = false;
  scheduleSync(state);
}

export function disposeOperationCardHoverOverlay(root: HTMLElement): void {
  const state = operationCardHoverOverlays.get(root);
  if (!state) return;
  root.removeEventListener('pointerover', state.pointerOverListener);
  root.removeEventListener('pointerout', state.pointerOutListener);
  root.removeEventListener('focusin', state.focusInListener);
  root.removeEventListener('focusout', state.focusOutListener);
  root.removeEventListener('click', state.clickListener);
  window.removeEventListener('scroll', state.scrollListener, true);
  window.removeEventListener('resize', state.resizeListener);
  state.mutationObserver?.disconnect();
  state.resizeObserver?.disconnect();
  if (state.frame !== null) window.cancelAnimationFrame(state.frame);
  hideLayer(state, true);
  state.layer.remove();
  operationCardHoverOverlays.delete(root);
}
