import type { ModalManager } from '../../interaction/modal';
import type { UIContext } from '../../runtime/context';

export interface ConditionReferenceRow {
  value: string;
  label: string;
  initIds: readonly string[] | null;
  scope: string;
  description?: string;
}

export function storyReferenceRow(
  ctx: UIContext,
  row: { value: string; label: string },
  initId?: string,
): ConditionReferenceRow {
  return { ...row, initIds: initId ? [initId] : null, scope: initId ? ctx.game.registry.inits.get(initId)?.name || initId : '其他' };
}

interface PickerOptions {
  otherLabel?: string;
  cancelLabel?: string;
  navigate?(id: string): void;
}

export function createConditionReferencePicker(ctx: UIContext, label: string, rows: readonly ConditionReferenceRow[], value: string, select: (id: string) => void, options: PickerOptions = {}) {
  const escape = ctx.escapeHtml;
  const inits = [...new Set(rows.flatMap(row => row.initIds ?? []))].sort((a, b) =>
    (ctx.game.registry.inits.get(a)?.name || a).localeCompare(ctx.game.registry.inits.get(b)?.name || b));
  const filters = [
    ['all', '全部'], ...(rows.some(row => row.initIds?.length === 0) ? [['global', 'Global']] : []),
    ...inits.map(id => [id, ctx.game.registry.inits.get(id)?.name || id]),
    ...(rows.some(row => row.initIds === null) ? [['unknown', options.otherLabel ?? '未标明 Init']] : []),
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
        <section class="condition-reference-filters" aria-label="按世界线筛选">
          <h3>按世界线筛选</h3>
          ${filters.map(([id, title]) => `<button type="button" class="mini-action" data-condition-picker-filter="${escape(id)}" aria-pressed="${filter === id}">${escape(title)}</button>`).join('')}
        </section>
        <section class="condition-reference-results" aria-label="搜索结果">
          <label>搜索${escape(label)}<input type="search" data-condition-subfield="search" value="${escape(query)}" placeholder="名称或 ID" autocomplete="off"></label>
          <div class="condition-reference-cards">${results.map(row => `<button type="button" class="condition-reference-card story-editor-list-item" data-editor-key="reference:${escape(row.value)}" data-condition-picker-choice="${escape(row.value)}" aria-pressed="${choice === row}"><strong>${escape(row.label)}</strong><code>${escape(row.value)}</code><small>${escape(row.scope)}</small></button>`).join('') || '<p class="story-editor-empty">没有匹配的内容。</p>'}</div>
        </section>
        <section class="condition-reference-detail" aria-label="实体详情">
          <h3>实体详情</h3>
          ${choice ? `<strong>${escape(choice.label)}</strong><code>${escape(choice.value)}</code><small>${escape(choice.scope)}</small>${choice.description ? `<p>${escape(choice.description)}</p>` : ''}` : '<p class="story-editor-empty">选择一张卡片查看详情。</p>'}
          <div class="story-editor-actions"><button type="button" class="mini-action" data-condition-subeditor="back">${escape(options.cancelLabel ?? '返回')}</button>${options.navigate && choice ? '<button type="button" class="mini-action" data-condition-subeditor="source">查看来源</button>' : ''}<button type="button" class="primary-button" data-condition-subeditor="confirm"${choice ? '' : ' disabled'}>确认选择</button></div>
        </section>
      </div>`;
    },
    update: (field: string, value: string) => {
      if (field === 'search') query = value;
      else if (field === 'filter') filter = value;
      else if (field === 'choice') choice = rows.find(row => row.value === value);
    },
    navigate: () => { if (choice) options.navigate?.(choice.value); },
    confirm: () => {
      if (!choice) return false;
      select(choice.value);
      return true;
    },
  };
}

/** Standalone host for the same picker used inside the condition tree. */
export function openStoryReferencePicker(
  modal: ModalManager,
  ctx: UIContext,
  label: string,
  rows: readonly ConditionReferenceRow[],
  value: string,
  select: (id: string) => void,
  options: { close(): void; navigate?(id: string): void },
): void {
  const picker = createConditionReferencePicker(ctx, label, rows, value, select, {
    otherLabel: '其他', cancelLabel: '取消', navigate: options.navigate,
  });
  const panel = modal.open({
    title: `选择${label}`,
    panelClass: 'story-editor-dialog story-condition-dialog story-editor-reference-navi',
    body: picker.render(),
    onClose: options.close,
  });
  bindConditionReferencePicker(panel, picker, () => modal.close());
}

export function bindConditionReferencePicker(
  panel: HTMLElement,
  picker: ReturnType<typeof createConditionReferencePicker>,
  back: () => void,
): void {
  const search = panel.querySelector<HTMLInputElement>('[data-condition-subfield="search"]')!;
  const render = (field: string, value: string) => {
    picker.update(field, value);
    const next = document.createElement('template');
    next.innerHTML = picker.render();
    const results = panel.querySelector('.condition-reference-cards')!;
    if (field === 'choice') {
      for (const card of results.querySelectorAll<HTMLButtonElement>('[data-condition-picker-choice]')) {
        card.setAttribute('aria-pressed', String(card.dataset.conditionPickerChoice === value));
      }
      panel.querySelector('.condition-reference-detail')!.innerHTML = next.content.querySelector('.condition-reference-detail')!.innerHTML;
    } else {
      results.innerHTML = next.content.querySelector('.condition-reference-cards')!.innerHTML;
      results.scrollTop = 0;
    }
    if (field === 'filter') {
      for (const filter of panel.querySelectorAll<HTMLButtonElement>('[data-condition-picker-filter]')) {
        filter.setAttribute('aria-pressed', String(filter.dataset.conditionPickerFilter === value));
      }
    }
  };
  search.addEventListener('input', () => render('search', search.value));
  panel.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : undefined;
    if (!button) return;
    const { conditionPickerFilter, conditionPickerChoice, conditionSubeditor } = button.dataset;
    if (conditionPickerFilter !== undefined) render('filter', conditionPickerFilter);
    else if (conditionPickerChoice !== undefined) render('choice', conditionPickerChoice);
    else if (conditionSubeditor === 'back') back();
    else if (conditionSubeditor === 'confirm') picker.confirm();
    else if (conditionSubeditor === 'source') picker.navigate();
  });
  search.focus();
}
