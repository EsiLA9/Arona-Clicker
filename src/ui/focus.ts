export interface FocusSnapshot {
  path: number[];
}

export function captureFocusWithin(root: Element): FocusSnapshot | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
  const path: number[] = [];
  let current: Element = active;
  while (current !== root) {
    const parent = current.parentElement;
    if (!parent) return null;
    path.unshift([...parent.children].indexOf(current));
    current = parent;
  }
  return { path };
}

export function restoreFocusWithin(root: Element, snapshot: FocusSnapshot | null): boolean {
  if (!snapshot) return false;
  let target: Element = root;
  for (const index of snapshot.path) {
    const next = target.children.item(index);
    if (!next) return false;
    target = next;
  }
  if (!(target instanceof HTMLElement)) return false;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}
