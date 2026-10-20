/** Map-only reconciliation: keep columns, scroll owners and keyed controls mounted. */
function mapNodeKey(node: Node): string | null {
  if (!(node instanceof HTMLElement)) return null;
  // 信息流条目先按共享实例键协调：同一条目刷新数值时保持节点身份。
  if (node.dataset.flowEntryKey) return `flow:${node.dataset.flowEntryKey}`;
  // 卡牌视觉实例：同一对象的多个副本各有独立且稳定的键。
  if (node.dataset.mapInstanceKey) return `card:${node.dataset.mapInstanceKey}`;
  if (node.dataset.mapFocusKey) return `control:${node.dataset.mapFocusKey}`;
  if (node.dataset.mapRegionKey) return `region:${node.dataset.mapRegionKey}`;
  if (node.dataset.mapPartyMember) return `party:${node.dataset.mapPartyMember}`;
  if (node.dataset.mapNodeId) return `node:${node.dataset.mapNodeId}`;
  if (node.dataset.mapEnemyHp) return `enemy:${node.dataset.mapEnemyHp}`;
  if (node.dataset.workspaceFrame) return `frame:${node.dataset.workspaceFrame}`;
  if (node.dataset.workspaceColumn) return `column:${node.dataset.workspaceColumn}`;
  if (node.dataset.themeHostId) return `host:${node.dataset.themeHostId}`;
  // Runtime presentation may add/remove background siblings before these owners.
  if (node.classList.contains('presentation-host-content')) return 'host-content';
  if (node.classList.contains('presentation-host-background')) return 'host-background';
  if (node.classList.contains('workspace-column__header')) return 'column-header';
  if (node.classList.contains('workspace-column__body')) return 'column-body';
  return node.id ? `id:${node.id}` : null;
}

function compatible(current: Node, next: Node): boolean {
  return current.nodeType === next.nodeType
    && (!(current instanceof Element) || (next instanceof Element && current.tagName === next.tagName));
}

/** Notify only ranges that actually lose nodes, so unrelated anchored overlays survive. */
export function patchMapDOM(
  current: Node,
  next: Node,
  beforeRemove: (range: HTMLElement) => void,
): void {
  if (current.isEqualNode(next)) return;
  if (current.nodeType === Node.TEXT_NODE || current.nodeType === Node.COMMENT_NODE) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  if (!(current instanceof Element) || !(next instanceof Element)) return;
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of [...next.attributes]) {
    if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  const original = [...current.childNodes];
  const desiredChildren = [...next.childNodes];
  const desiredKeys = new Set(desiredChildren.map(mapNodeKey).filter(key => key !== null));
  // Remove obsolete keyed siblings first: do not move a focused content owner
  // merely to place it ahead of a theme background that is about to disappear.
  for (const child of original) {
    const key = mapNodeKey(child);
    if (key === null || desiredKeys.has(key)) continue;
    if (child instanceof HTMLElement) beforeRemove(child);
    current.removeChild(child);
  }
  const used = new Set<Node>();
  let cursor = current.firstChild;
  desiredChildren.forEach((desired, index) => {
    const key = mapNodeKey(desired);
    const positional = original[index];
    const retained = key
      ? original.find(child => child.parentNode === current && !used.has(child) && mapNodeKey(child) === key && compatible(child, desired))
      : positional && positional.parentNode === current && !used.has(positional) && mapNodeKey(positional) === null && compatible(positional, desired)
        ? positional : undefined;
    if (retained) {
      patchMapDOM(retained, desired, beforeRemove);
      used.add(retained);
      if (retained !== cursor) current.insertBefore(retained, cursor);
      cursor = retained.nextSibling;
    } else {
      const added = desired.cloneNode(true);
      current.insertBefore(added, cursor);
      used.add(added);
      cursor = added.nextSibling;
    }
  });
  for (const child of original) {
    if (used.has(child) || child.parentNode !== current) continue;
    if (child instanceof HTMLElement) beforeRemove(child);
    current.removeChild(child);
  }
}
