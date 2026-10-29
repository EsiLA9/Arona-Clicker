/** Reconcile only editor regions. Keys preserve author nodes and live form controls. */
function key(node: Node): string | null {
  if (!(node instanceof HTMLElement)) return null;
  // Theme projection may insert a background before the content wrapper. Both
  // are DIVs: positional/tag matching must never replace the live content with it.
  for (const role of ['presentation-host-background', 'presentation-host-content', 'workspace-column__slot', 'workspace-column__body']) {
    if (node.classList.contains(role)) return role;
  }
  if (node.dataset.columnInstance) return `column:${node.dataset.columnInstance}`;
  return node.dataset.editorKey ?? (node.dataset.editorAction ? `action:${node.dataset.editorAction}` : null);
}
function compatible(current: Node, next: Node): boolean {
  return current.nodeType === next.nodeType && (!(current instanceof Element) || current.tagName === (next as Element).tagName);
}
export function patchEditorDOM(current: HTMLElement, next: HTMLElement, beforeRemove: (root: HTMLElement) => void): void {
  for (const attribute of [...current.attributes]) if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  for (const attribute of [...next.attributes]) if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  if (current instanceof HTMLTextAreaElement && next instanceof HTMLTextAreaElement) {
    if (current.value !== next.value) current.value = next.value;
    return;
  }
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement && current.value !== next.value) current.value = next.value;
  const children = [...current.childNodes];
  const used = new Set<Node>();
  for (const [index, expected] of [...next.childNodes].entries()) {
    const expectedKey = key(expected);
    const actual = children.find(node => !used.has(node) && compatible(node, expected) && (expectedKey !== null ? key(node) === expectedKey : key(node) === null));
    const child = actual ?? expected.cloneNode(true);
    if (current.childNodes[index] !== child) current.insertBefore(child, current.childNodes[index] ?? null);
    if (actual) {
      used.add(actual);
      if (actual instanceof HTMLElement && expected instanceof HTMLElement) patchEditorDOM(actual, expected, beforeRemove);
      else if (actual.nodeValue !== expected.nodeValue) actual.nodeValue = expected.nodeValue;
    }
  }
  for (const child of children) {
    if (used.has(child)) continue;
    if (child instanceof HTMLElement) beforeRemove(child);
    child.remove();
  }
  if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement && current.value !== next.value) current.value = next.value;
}
