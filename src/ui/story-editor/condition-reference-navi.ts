import type { UIContext } from '../runtime/context';
import { storyEntries, type StoryEditorState } from './model';
import { storyReferenceOptions, type StoryReferenceKind } from './property-options';

export interface ConditionReferenceRow {
  value: string;
  label: string;
  initIds: readonly string[] | null;
  scope: string;
  description?: string;
}

export function conditionReferenceChoices(ctx: UIContext, state: StoryEditorState, kind: StoryReferenceKind, preferred: readonly string[]): ConditionReferenceRow[] {
  const registry = ctx.game.registry;
  const entries = kind === 'story' ? [...storyEntries(state, registry.storyEntries).values()] : [];
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
    } else if (kind === 'story') {
      const linked = entries.filter(entry => entry.storyId === row.value);
      initIds = !linked.length ? null : linked.some(entry => !entry.availableInits?.length)
        ? [] : [...new Set(linked.flatMap(entry => entry.availableInits ?? []))];
    }
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

export function createConditionReferencePicker(ctx: UIContext, label: string, rows: readonly ConditionReferenceRow[], value: string, select: (id: string) => void) {
  const escape = ctx.escapeHtml;
  const inits = [...new Set(rows.flatMap(row => row.initIds ?? []))];
  const filters = [
    ['all', '全部'], ['global', 'Global'],
    ...inits.map(id => [id, ctx.game.registry.inits.get(id)?.name || id]),
    ...(rows.some(row => row.initIds === null) ? [['unknown', '未标明 Init']] : []),
  ];
  let query = '';
  let filter = 'all';
  let choice = rows.find(row => row.value === value);
  return {
    render: () => {
      const term = query.trim().toLowerCase();
      const matches = rows.filter(row => (filter === 'all' || (filter === 'global' ? row.initIds?.length === 0
        : filter === 'unknown' ? row.initIds === null : row.initIds?.includes(filter)))
        && `${row.label} ${row.value}`.toLowerCase().includes(term));
      const exact = term && matches.find(row => row.value.toLowerCase() === term);
      const results = exact ? [exact, ...matches.filter(row => row !== exact)] : matches;
      return `<div class="condition-reference-picker">
        <section class="condition-reference-filters" aria-label="按 Init 筛选">
          <h3>按 Init 筛选</h3>
          ${filters.map(([id, title]) => `<button type="button" class="mini-action" data-condition-picker-filter="${escape(id)}" aria-pressed="${filter === id}">${escape(title)}</button>`).join('')}
        </section>
        <section class="condition-reference-results" aria-label="搜索结果">
          <label>搜索${escape(label)}<input type="search" data-condition-subfield="search" value="${escape(query)}" placeholder="名称或 ID" autocomplete="off"></label>
          <div class="condition-reference-cards">${results.map(row => `<button type="button" class="condition-reference-card story-editor-list-item" data-editor-key="reference:${escape(row.value)}" data-condition-picker-choice="${escape(row.value)}" aria-pressed="${choice === row}"><strong>${escape(row.label)}</strong><code>${escape(row.value)}</code><small>${escape(row.scope)}</small></button>`).join('') || '<p class="story-editor-empty">没有匹配的内容。</p>'}</div>
        </section>
        <section class="condition-reference-detail" aria-label="实体详情">
          <h3>实体详情</h3>
          ${choice ? `<strong>${escape(choice.label)}</strong><code>${escape(choice.value)}</code><small>${escape(choice.scope)}</small>${choice.description ? `<p>${escape(choice.description)}</p>` : ''}` : '<p class="story-editor-empty">选择一张卡片查看详情。</p>'}
          <div class="story-editor-actions"><button type="button" class="mini-action" data-condition-subeditor="back">返回</button><button type="button" class="primary-button" data-condition-subeditor="confirm"${choice ? '' : ' disabled'}>确认选择</button></div>
        </section>
      </div>`;
    },
    update: (field: string, value: string) => {
      if (field === 'search') query = value;
      else if (field === 'filter') filter = value;
      else if (field === 'choice') choice = rows.find(row => row.value === value);
    },
    confirm: () => {
      if (choice) select(choice.value);
      return Boolean(choice);
    },
  };
}
