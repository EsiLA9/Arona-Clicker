import type { UIContext } from '../context';

export type RuntimeEditorReferenceKind = 'resource' | 'spot' | 'area' | 'init' | 'story' | 'enhancement';

export interface RuntimeEditorReferenceOption {
  readonly value: string;
  readonly label: string;
}

/** RuntimeEditor 中所有实体引用候选的统一来源。 */
export function runtimeEditorReferenceOptions(
  ctx: UIContext,
  kind: RuntimeEditorReferenceKind,
): RuntimeEditorReferenceOption[] {
  switch (kind) {
    case 'resource':
      return [...ctx.game.registry.resourceDisplays.values()].map(resource => ({ value: resource.resourceId, label: resource.label || resource.resourceId }));
    case 'spot':
      return [...ctx.game.registry.spots.values()].map(spot => ({ value: spot.id, label: spot.name || spot.id }));
    case 'area':
      return [...ctx.game.registry.areas.values()].map(area => ({ value: area.id, label: area.name || area.id }));
    case 'init':
      return [...ctx.game.registry.inits.values()].map(init => ({ value: init.id, label: init.name || init.id }));
    case 'story':
      return [...ctx.game.registry.stories.values()].map(story => ({ value: story.id, label: story.name || story.id }));
    case 'enhancement':
      return [...ctx.game.registry.enhancements.values()].map(enhancement => ({ value: enhancement.id, label: enhancement.name || enhancement.id }));
  }
}

export function mergeRuntimeEditorReferenceOptions(
  ...sources: readonly RuntimeEditorReferenceOption[][]
): RuntimeEditorReferenceOption[] {
  const merged = new Map<string, RuntimeEditorReferenceOption>();
  for (const source of sources) {
    for (const option of source) {
      if (!merged.has(option.value)) merged.set(option.value, option);
    }
  }
  return [...merged.values()];
}

export function renderRuntimeEditorReferenceOptions(
  esc: (value: string) => string,
  options: readonly RuntimeEditorReferenceOption[],
): string {
  return options
    .map(option => `<option value="${esc(option.value)}" label="${esc(option.label)}">${esc(option.label)}</option>`)
    .join('');
}
