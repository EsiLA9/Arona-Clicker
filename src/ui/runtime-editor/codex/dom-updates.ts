/** DOM reconciliation is restricted to the content tool's owning pane. */
export interface CodexOverlayBoundary {
  dismissBeforeRootMutation(scope: ParentNode): void;
  retainIfAnchored(): void;
}

function keyOf(node: Node): string | null {
  if (!(node instanceof Element)) return null;
  for (const attribute of ['data-codex-entry', 'data-codex-kind', 'data-codex-category', 'data-codex-mod', 'data-codex-navigation-mode', 'data-codex-inspector-tab']) {
    if (attribute === 'data-codex-inspector-tab' && !node.matches('button[data-codex-inspector-tab]')) continue;
    if (node.hasAttribute(attribute)) return `${attribute}:${node.getAttribute(attribute)}`;
  }
  return node.id ? `id:${node.id}` : null;
}

function compatible(current: Node, next: Node): boolean {
  return current.nodeType === next.nodeType && current.nodeName === next.nodeName && keyOf(current) === keyOf(next);
}

function reconcileNode(current: Node, next: Node, overlays: CodexOverlayBoundary): void {
  if (!(current instanceof Element) || !(next instanceof Element)) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  if (current.matches('.hover-wrap[data-tooltip]')
    && (current.getAttribute('data-tooltip') !== next.getAttribute('data-tooltip') || current.innerHTML !== next.innerHTML)) {
    overlays.dismissBeforeRootMutation(current);
  }
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name) && attribute.name !== 'open') current.removeAttribute(attribute.name);
  }
  for (const attribute of [...next.attributes]) {
    if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement && current.value !== next.value) {
    current.value = next.value;
  }
  const existing = [...current.childNodes];
  const keyed = new Map(existing.flatMap(node => keyOf(node) ? [[keyOf(node)!, node] as const] : []));
  const retained = new Set<Node>();
  let cursor: ChildNode | null = current.firstChild;
  for (const desired of [...next.childNodes]) {
    const key = keyOf(desired);
    const matched = key ? keyed.get(key) : cursor && compatible(cursor, desired) ? cursor : undefined;
    const node = matched && compatible(matched, desired) ? matched : desired.cloneNode(true);
    if (node !== cursor) current.insertBefore(node, cursor);
    if (matched === node) reconcileNode(node, desired, overlays);
    retained.add(node);
    cursor = node.nextSibling;
  }
  for (const node of existing) {
    if (retained.has(node)) continue;
    if (node instanceof Element) overlays.dismissBeforeRootMutation(node);
    node.parentNode?.removeChild(node);
  }
}

export function patchCodexPane(
  scope: HTMLElement,
  pane: 'mods' | 'entries' | 'detail',
  html: string,
  overlays: CodexOverlayBoundary,
  resetDetail = false,
): void {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const next = template.content.firstElementChild;
  if (!(next instanceof HTMLElement)) return;
  next.querySelectorAll<HTMLElement>('.codex-inspector[data-codex-inspector-tab]')
    .forEach(inspector => inspector.removeAttribute('data-codex-inspector-tab'));
  const current = scope.querySelector<HTMLElement>(`[data-codex-pane="${pane}"]`);
  if (!current) {
    const grid = scope.querySelector<HTMLElement>('.runtime-editor-codex__grid');
    if (grid) {
      const order = ['mods', 'entries', 'detail'] as const;
      const paneIndex = order.indexOf(pane);
      const following = order.slice(paneIndex + 1)
        .map(id => [...grid.children].find(child => child instanceof HTMLElement && child.dataset.codexPane === id))
        .find((node): node is Element => node !== undefined);
      if (following) grid.insertBefore(next, following);
      else grid.append(next);
    }
    overlays.retainIfAnchored();
    return;
  }
  const scrollNodes = [current, ...current.querySelectorAll<HTMLElement>('.runtime-editor-codex__entries-wrap, .runtime-editor-codex__detail-body')];
  const positions = scrollNodes.map(node => [node, node.scrollTop] as const);
  if (resetDetail) {
    const slot = current.querySelector('[data-codex-detail-slot]');
    const nextSlot = next.querySelector('[data-codex-detail-slot]');
    if (slot && nextSlot) {
      overlays.dismissBeforeRootMutation(slot);
      slot.replaceChildren(...[...nextSlot.childNodes].map(node => node.cloneNode(true)));
    }
  }
  reconcileNode(current, next, overlays);
  for (const [node, top] of positions) if (node.isConnected) node.scrollTop = top;
  overlays.retainIfAnchored();
}
