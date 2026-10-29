/**
 * Scroll positions owned by one workspace column, excluding FlowScroll-managed chat streams.
 * Prefer data-scroll-key or data-map-region-key when a column can reorder or add multiple owners;
 * class-based fallback only distinguishes anonymous owners with different class sets.
 */
export function workspaceColumnScrollTargets(column: HTMLElement): Map<string, HTMLElement> {
  const result = new Map<string, HTMLElement>();
  const instance = column.dataset.columnInstance ?? column.dataset.workspaceColumn ?? 'column';
  const isOwnedByColumn = (element: HTMLElement): boolean => element.closest<HTMLElement>('[data-column-instance]') === column;
  [...column.querySelectorAll<HTMLElement>('.workspace-column__body')].filter(isOwnedByColumn).forEach((body, bodyIndex) => {
    const candidates = [body, ...[...body.querySelectorAll<HTMLElement>('[data-scroll-owner="content-region"]')].filter(isOwnedByColumn)];
    const fallbackCounts = new Map<string, number>();
    for (const element of candidates) {
      const explicit = [
        element.dataset.scrollKey,
        element.dataset.mapRegionKey,
        element.dataset.operationRightView,
        element.hasAttribute('data-area-map-detail-scroll') ? 'area-map-detail' : undefined,
        element.hasAttribute('data-operation-party') ? 'operation-party' : undefined,
        element.id,
        element.getAttribute('aria-label') ?? undefined,
      ].find(value => Boolean(value?.trim()));
      const classes = typeof element.className === 'string'
        ? element.className.split(/\s+/).filter(Boolean).sort().join('.')
        : '';
      const fallback = element === body ? 'body' : classes ? `class:${classes}` : 'content-region';
      const base = explicit ?? fallback;
      const duplicate = fallbackCounts.get(base) ?? 0;
      fallbackCounts.set(base, duplicate + 1);
      const key = `${instance}:${bodyIndex}:${base}${duplicate ? `:${duplicate}` : ''}`;
      result.set(key, element);
    }
  });
  return result;
}
