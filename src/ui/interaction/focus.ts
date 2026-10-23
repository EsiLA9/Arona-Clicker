export interface FocusSnapshot {
  path: number[];
  tagName: string;
  id: string;
  ariaLabel: string | null;
  text: string;
  className: string | null;
  title: string | null;
  name: string | null;
  value: string | null;
  dataAttributes: Array<[string, string]>;
  rootChildCount: number;
  ancestors: Array<{
    tagName: string;
    id: string;
    className: string | null;
    childCount: number;
    dataAttributes: Array<[string, string]>;
  }>;
}

function stableDataAttributes(element: Element): Array<[string, string]> {
  return [...element.attributes]
    .filter(attribute => attribute.name.startsWith('data-') && !attribute.name.startsWith('data-theme-'))
    .map(attribute => [attribute.name, attribute.value]);
}

function focusAncestorDescriptor(element: Element) {
  return {
    tagName: element.tagName,
    id: (element as HTMLElement).id ?? '',
    className: element.getAttribute('class'),
    childCount: element.childElementCount,
    dataAttributes: stableDataAttributes(element),
  };
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
  return {
    path,
    tagName: active.tagName,
    id: active.id,
    ariaLabel: active.getAttribute('aria-label'),
    text: active.textContent?.trim() ?? '',
    className: active.getAttribute('class'),
    title: active.getAttribute('title'),
    name: active.getAttribute('name'),
    value: active.getAttribute('value'),
    dataAttributes: stableDataAttributes(active),
    rootChildCount: root.childElementCount,
    ancestors: (() => {
      const ancestors: FocusSnapshot['ancestors'] = [];
      let ancestor = active.parentElement;
      while (ancestor && ancestor !== root) {
        ancestors.unshift(focusAncestorDescriptor(ancestor));
        ancestor = ancestor.parentElement;
      }
      return ancestors;
    })(),
  };
}

export function restoreFocusWithin(root: Element, snapshot: FocusSnapshot | null): boolean {
  if (!snapshot) return false;
  let target: Element | null = root;
  for (const index of snapshot.path) {
    const next: Element | null = target?.children.item(index) ?? null;
    if (!next) {
      target = null;
      break;
    }
    target = next;
  }
  const matchesIdentity = (candidate: Element): boolean => {
    if (candidate.tagName !== snapshot.tagName) return false;
    if (snapshot.id) return candidate.id === snapshot.id;
    if (snapshot.dataAttributes.length) {
      return snapshot.dataAttributes.every(([name, value]) => candidate.getAttribute(name) === value);
    }
    return candidate.getAttribute('aria-label') === snapshot.ariaLabel
      && (candidate.textContent?.trim() ?? '') === snapshot.text
      && candidate.getAttribute('class') === snapshot.className
      && candidate.getAttribute('title') === snapshot.title
      && candidate.getAttribute('name') === snapshot.name
      && candidate.getAttribute('value') === snapshot.value
      && (() => {
      let ancestor = candidate.parentElement;
      for (let index = snapshot.ancestors.length - 1; index >= 0; index -= 1) {
        const expected = snapshot.ancestors[index];
        if (!ancestor || ancestor.tagName !== expected.tagName
          || (ancestor as HTMLElement).id !== expected.id
          || ancestor.getAttribute('class') !== expected.className
          || ancestor.childElementCount !== expected.childCount
          || !expected.dataAttributes.every(([name, value]) => ancestor!.getAttribute(name) === value)) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    })();
  };
  const candidates = [...root.querySelectorAll<HTMLElement>(snapshot.tagName)].filter(matchesIdentity);
  const pathTarget = target instanceof HTMLElement ? target : null;
  const pathTargetMatches = pathTarget !== null
    && root.childElementCount === snapshot.rootChildCount
    && matchesIdentity(pathTarget);
  const focusTarget = pathTargetMatches
    ? pathTarget
    : candidates.length === 1
      ? candidates[0]
      : null;
  if (!focusTarget) return false;
  focusTarget.focus({ preventScroll: true });
  return document.activeElement === focusTarget;
}
