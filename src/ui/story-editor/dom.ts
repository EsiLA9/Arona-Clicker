/** Reconcile only editor regions. Keys preserve author nodes and live form controls. */
function key(node: Node): string | null {
  if (!(node instanceof HTMLElement)) return null;
  // Theme projection may insert a background before the content wrapper. Both
  // are DIVs: positional/tag matching must never replace the live content with it.
  for (const role of ['presentation-host-background', 'presentation-host-content', 'workspace-column__slot', 'workspace-column__viewport', 'workspace-column__body']) {
    if (node.classList.contains(role)) return role;
  }
  if (node.dataset.columnInstance) return `column:${node.dataset.columnInstance}`;
  return node.dataset.editorKey ?? (node.dataset.directoryField ? `directory-field:${node.dataset.directoryField}`
    : node.dataset.editorAction ? `action:${node.dataset.editorAction}` : null);
}
function compatible(current: Node, next: Node): boolean {
  return current.nodeType === next.nodeType && (!(current instanceof Element) || current.tagName === (next as Element).tagName);
}
const editorDisclosure = 'details.story-editor-flag-item, details.story-editor-entry-pool, details.story-preview-record, details.story-editor-advanced, details.story-editor-sidebar-ops, details.story-editor-story-pack';
export function patchEditorDOM(current: HTMLElement, next: HTMLElement, beforeRemove: (root: HTMLElement) => void): void {
  for (const attribute of [...current.attributes]) {
    // Disclosure state belongs to the mounted item.
    if (attribute.name === 'open' && current.matches(editorDisclosure) && next.matches(editorDisclosure)) continue;
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of [...next.attributes]) if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  if (current.hasAttribute('data-story-flag-rename-slot') && next.hasAttribute('data-story-flag-rename-slot') && current.querySelector('form')) return;
  // The browser owns the active text subtree, including its selection and IME composition.
  if (current.hasAttribute('data-story-inline-active') && next.hasAttribute('data-story-inline-active')
    && current.dataset.storyInlineKey === next.dataset.storyInlineKey) return;
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
  if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement) {
    const value = next.querySelector<HTMLOptionElement>('option[selected]')?.value ?? next.value;
    if (current.value !== value) current.value = value;
  }
}
