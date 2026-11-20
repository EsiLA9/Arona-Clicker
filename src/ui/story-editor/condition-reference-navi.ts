import type { UIContext } from '../runtime/context';
import { storyReferenceRow, type ConditionReferenceRow } from '../components/shared/condition-reference-picker';
import type { StoryEditorState } from './model';
import { storyReferenceDocuments, storyReferenceOptions, type StoryReferenceKind } from './property-options';

export function conditionReferenceChoices(ctx: UIContext, state: StoryEditorState, kind: StoryReferenceKind, preferred: readonly string[]): ConditionReferenceRow[] {
  const registry = ctx.game.registry;
  const stories = kind === 'story' ? storyReferenceDocuments(ctx, state) : undefined;
  const areaScope = (id: string) => {
    const init = registry.areas.get(id)?.initId;
    return init ? [init] : null;
  };
  const rows = storyReferenceOptions(ctx, kind, state).map((row): ConditionReferenceRow => {
    let initIds: readonly string[] | null = [];
    let description: string | undefined;
    if (kind === 'area') {
      initIds = areaScope(row.value);
      description = registry.areas.get(row.value)?.description;
    } else if (kind === 'spot') {
      const spot = registry.spots.get(row.value);
      initIds = spot?.global ? [] : spot ? areaScope(spot.areaId) : null;
      description = spot?.description;
    } else if (kind === 'enhancement') {
      const enhancement = registry.enhancements.get(row.value);
      const attachment = enhancement?.attachment;
      initIds = !attachment ? null : attachment.kind === 'area' ? areaScope(attachment.areaId)
        : attachment.kind === 'init' ? [attachment.initId] : [];
      description = enhancement?.description;
    } else if (kind === 'variant') {
      const variant = registry.characterVariants.get(row.value);
      description = variant?.description;
    } else if (kind === 'story') return storyReferenceRow(ctx, row, stories?.get(row.value)?.initId);
    const scope = initIds === null ? '未标明 Init' : !initIds.length ? 'Global'
      : initIds.map(id => registry.inits.get(id)?.name || id).join(' / ');
    return { ...row, initIds, scope, description };
  });
  const rank = (row: ConditionReferenceRow) => row.initIds?.some(id => preferred.includes(id)) ? 0
    : row.initIds?.length === 0 ? 1 : row.initIds ? 2 : 3;
  return rows.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}

export function renderConditionReferenceField(label: string, value: string, nodeId: string, rows: readonly ConditionReferenceRow[], escape: UIContext['escapeHtml']): string {
  const matched = rows.find(row => row.value === value);
  const listId = `condition-reference-${nodeId}`;
  return `<div class="condition-reference-control" data-editor-key="condition-label:key">
    <label>${escape(label)}<input data-condition-field="key" data-condition-reference-input list="${listId}" value="${escape(value)}" autocomplete="off"></label>
    <button type="button" class="mini-action" data-condition-open-editor aria-label="搜索${escape(label)}">搜索…</button>
    <datalist id="${listId}">${rows.map(row => `<option value="${escape(row.value)}" label="${escape(`${row.label} · ${row.scope}`)}"></option>`).join('')}</datalist>
    <small class="story-editor-hint" data-condition-reference-summary${matched ? '' : ' hidden'}>${matched ? escape(`${matched.label} · ${matched.scope}`) : ''}</small>
  </div>`;
}
