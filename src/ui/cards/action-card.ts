/** Shared button-card shape for Map actions and clickable Flow choices. */
export interface MapActionCardContent {
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
}

export interface MapActionCardButtonView extends MapActionCardContent {
  /** Feature-specific layout/state classes; the shared card class is added here. */
  readonly className: string;
  /** Caller-generated, escaped semantic and card-binding attributes. */
  readonly attributes?: string;
  readonly disabled?: boolean;
}

/** Stable, small rotation used to give cards a paper-card feel without changing on refresh. */
export function stableMapActionCardAngle(key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }
  return `${(hash >>> 0) % 17 - 8}deg`;
}

/** Shared visible content used by both action-card buttons and static card copies. */
export function renderMapActionCardContent(
  escape: (value: string) => string,
  view: MapActionCardContent,
): string {
  return `<strong>${escape(view.title)}</strong>`
    + (view.subtitle ? `<small>${escape(view.subtitle)}</small>` : '')
    + (view.description ? `<span class="map-workspace__action-card-description">${escape(view.description)}</span>` : '');
}

/** Render a button using the same card shell as the Map workspace action stack. */
export function renderMapActionCardButton(
  escape: (value: string) => string,
  view: MapActionCardButtonView,
): string {
  return `<button type="button" class="map-workspace__action-card ${escape(view.className)}"`
    + `${view.attributes ?? ''}${view.disabled ? ' disabled' : ''}>`
    + renderMapActionCardContent(escape, view)
    + '</button>';
}
