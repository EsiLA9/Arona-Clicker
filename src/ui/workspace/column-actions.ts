/** Scoped callbacks supplied by the workspace/controller; reusable views own no commands. */
export type ColumnActions = Readonly<Record<string, (element: HTMLElement, event: MouseEvent) => void>>;

export function bindColumnActions(root: HTMLElement, actions: ColumnActions | (() => ColumnActions)): () => void {
  const click = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    for (const [selector, action] of Object.entries(typeof actions === 'function' ? actions() : actions)) {
      const element = event.target.closest<HTMLElement>(selector);
      if (!element || element.closest('[data-column-instance]') !== root) continue;
      event.preventDefault();
      event.stopImmediatePropagation();
      action(element, event);
      return;
    }
  };
  root.addEventListener('click', click, true);
  return () => root.removeEventListener('click', click, true);
}
