import type { ModalManager } from '../interaction/modal';
import type { UIContext } from '../runtime/context';
import type { StoryEditorTarget } from './model';
import { openStoryReferencePicker, type ConditionReferenceRow } from '../components/shared/condition-reference-picker';

export type ReferenceField = HTMLInputElement | HTMLSelectElement;

function referenceTargetKind(kind?: string): StoryEditorTarget['kind'] | undefined {
  if (kind === 'story') return 'story';
  if (kind === 'entry' || kind === 'activeEntry' || kind === 'passiveEntry') return 'entry';
}

export function referenceTarget(field: ReferenceField): StoryEditorTarget | undefined {
  const kind = referenceTargetKind(field.dataset.storyReference);
  if (kind && field.value) return { kind, id: field.value };
}

/** Decorate the next render before keyed reconciliation, keeping the original field as the write entry. */
export function prepareReferenceNavi(root: ParentNode, hasTarget: (target: StoryEditorTarget) => boolean): void {
  for (const field of root.querySelectorAll<ReferenceField>('[data-story-reference]')) {
    if (field.closest('[data-reference-control]')) continue;
    const label = field.dataset.referenceLabel || field.closest('label')?.firstChild?.textContent?.trim() || '内容';
    const row = document.createElement('span'); row.className = 'story-editor-flag-control';
    row.dataset.referenceControl = ''; row.dataset.editorKey = `reference:${field.dataset.editorKey ?? field.dataset.editorField}`;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'mini-action';
    button.dataset.referenceNavi = ''; button.textContent = '选择…'; button.title = `打开${label} Navi`;
    button.setAttribute('aria-label', `选择${label}`); button.disabled = field.disabled || field instanceof HTMLInputElement && field.readOnly;
    field.before(row); row.append(field, button);
    if (referenceTargetKind(field.dataset.storyReference)) {
      const target = referenceTarget(field);
      const jump = document.createElement('button');
      jump.type = 'button'; jump.className = 'mini-action'; jump.dataset.referenceJump = '';
      jump.textContent = '前往'; jump.setAttribute('aria-label', `前往${label}`);
      jump.disabled = !target || !hasTarget(target);
      jump.title = target ? jump.disabled ? `当前来源中找不到 ${target.id}` : `前往${label} · ${target.id}` : '尚未设置目标';
      row.append(jump);
    }
  }
}

export function referenceChoices(field: ReferenceField): Array<{ value: string; label: string; disabled: boolean }> {
  const options = field instanceof HTMLSelectElement ? field.options : field.list?.options;
  return [...new Map([...(options ?? [])].filter(option => option.value !== '').map(option => [option.value, {
    value: option.value, label: option.label || option.textContent || option.value,
    disabled: option.disabled || option.hasAttribute('data-reference-missing'),
  }])).values()];
}

export function openReferenceNavi(modal: ModalManager, ctx: UIContext, field: ReferenceField, options: {
  select(value: string): void;
  navigate(target: StoryEditorTarget): void;
  close(): void;
  storyRows?: readonly ConditionReferenceRow[];
}): void {
  const rows = referenceChoices(field), kind = field.dataset.storyReference;
  const targetKind = referenceTargetKind(kind);
  const label = field.dataset.referenceLabel || field.closest('label')?.firstChild?.textContent?.trim() || '内容';
  if (kind === 'story' && options.storyRows) {
    openStoryReferencePicker(modal, ctx, label, options.storyRows, field.value, options.select, {
      close: options.close, navigate: id => options.navigate({ kind: 'story', id }),
    });
    return;
  }
  const e = ctx.escapeHtml;
  modal.open({ title: `${label} Navi`, panelClass: 'story-editor-flag-navi story-editor-reference-navi', width: 640,
    body: `<label>搜索${e(label)}<input type="search" data-reference-query placeholder="名称或 ID" autocomplete="off"></label><p class="story-editor-hint">选择后填回原字段。</p><div>${rows.map((row,index) => `<section class="story-editor-flag-navi-row" data-reference-search="${e(`${row.label} ${row.value}`.toLocaleLowerCase())}"><button type="button" class="story-editor-list-item" data-modal-action="reference-select:${index}"${row.disabled ? ' disabled' : ''}${field.value === row.value ? ' aria-current="true"' : ''}><strong>${e(row.label)}</strong><small>${e(row.value)}</small></button>${targetKind && !row.disabled ? `<button type="button" class="mini-action" data-modal-action="reference-source:${index}">查看来源</button>` : ''}</section>`).join('')}</div><p class="story-editor-empty" data-reference-empty${rows.length ? ' hidden' : ''}>没有匹配的内容。</p>`,
    footer: '<button type="button" class="mini-action modal-close">取消</button>', onClose: options.close,
    onAction: action => {
      const [type, raw] = action.split(':'), index = Number(raw), row = rows[index];
      if (!Number.isInteger(index) || !row || row.disabled) return;
      if (type === 'reference-select') options.select(row.value);
      else if (type === 'reference-source' && targetKind) options.navigate({ kind: targetKind, id: row.value });
    },
  });
  const panel = document.querySelector<HTMLElement>('.story-editor-reference-navi')!;
  const input = panel.querySelector<HTMLInputElement>('[data-reference-query]')!;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase(); let visible = 0;
    for (const row of panel.querySelectorAll<HTMLElement>('[data-reference-search]')) {
      row.hidden = !row.dataset.referenceSearch!.includes(query); if (!row.hidden) visible++;
    }
    panel.querySelector<HTMLElement>('[data-reference-empty]')!.hidden = visible > 0;
  });
  input.focus();
}
