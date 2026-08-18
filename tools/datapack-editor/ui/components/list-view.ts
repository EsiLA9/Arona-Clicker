/**
 * list-view.ts —— 中间列表栏
 *
 * 布局：最左侧类型选择 → 本栏为 ID-名称小项列表 → 点击后在右侧展开完整信息。
 * record 表（extras）列表显示 key；array 表显示 idField 值 + 名称摘要。
 */
import type { EditorModel } from '../../model/editor-model';
import type { TableKey } from '../../schema/types';
import { getTable } from '../../schema/datapack.schema';

/** 选择状态：array 表按行索引；record 表按 key */
export type Selection =
  | { kind: 'row'; index: number }
  | { kind: 'record'; key: string }
  | null;

export interface ListViewOpts {
  filter: string;
  selection: Selection;
  /** 本表校验出错误的行索引（列表标红） */
  rowErrors: Set<number>;
  /** 本表校验出错误的 record key */
  recordErrors: Set<string>;
  onFilter(filter: string): void;
  onSelect(sel: Selection): void;
  onAddRow(): void;
  onAddRecordKey(key: string): void;
}

/** 列表项摘要：主标题 = idField 值，副标题 = name/label 或首个字符串字段 */
export function rowSummary(
  schema: ReturnType<typeof getTable>,
  row: Record<string, unknown>,
): { id: string; sub: string } {
  const idField = schema.idField ?? 'id';
  const id = String(row[idField] ?? '');
  let sub = '';
  for (const f of schema.fields) {
    if (f.type.kind === 'divider') continue; // 横条非数据字段
    if (f.key === idField) continue;
    if (f.key === 'name' || f.key === 'label' || f.key === 'displayName') {
      if (typeof row[f.key] === 'string') {
        sub = String(row[f.key]);
        break;
      }
    }
  }
  if (!sub) {
    for (const f of schema.fields) {
      if (f.type.kind === 'divider') continue; // 横条非数据字段
      if (f.key === idField) continue;
      const t = f.type.kind;
      if ((t === 'string' || t === 'ref' || t === 'flexible') && typeof row[f.key] === 'string') {
        sub = `${f.label}: ${String(row[f.key])}`;
        break;
      }
    }
  }
  return { id, sub };
}

export function renderList(
  container: HTMLElement,
  model: EditorModel,
  table: TableKey,
  opts: ListViewOpts,
): void {
  const schema = getTable(table);

  // 过滤框正在回显时（用户正在输入）仅重建条目区，避免输入框失焦
  const existingInput = container.querySelector<HTMLInputElement>(
    ':scope > .list-toolbar > .list-filter',
  );
  const existingItems = container.querySelector<HTMLElement>(':scope > .list-items');
  if (existingInput && existingInput.value === opts.filter && existingItems) {
    existingItems.remove();
  } else {
    container.replaceChildren();
    const toolbar = document.createElement('div');
    toolbar.className = 'list-toolbar';

    const input = document.createElement('input');
    input.className = 'list-filter';
    input.placeholder = '过滤 ID / 名称';
    input.value = opts.filter;
    input.addEventListener('input', () => opts.onFilter(input.value));
    toolbar.appendChild(input);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-small btn-primary';
    if (schema.shape === 'record') {
      addBtn.textContent = '+ 新增键';
      addBtn.title = '新增键';
      addBtn.addEventListener('click', () => {
        const key = window.prompt('输入新键名：');
        if (key && key.trim()) opts.onAddRecordKey(key.trim());
      });
    } else {
      addBtn.textContent = '+ 新增';
      addBtn.addEventListener('click', () => opts.onAddRow());
    }
    toolbar.appendChild(addBtn);

    container.append(toolbar);
  }

  const itemsEl = document.createElement('div');
  itemsEl.className = 'list-items';
  container.appendChild(itemsEl);

  const q = opts.filter.trim().toLowerCase();
  if (schema.shape === 'record') {
    const rec = model.recordOf(table);
    for (const k of Object.keys(rec)) {
      if (q && !k.toLowerCase().includes(q)) continue;
      const item = document.createElement('div');
      item.className = 'list-item';
      item.dataset.recordKey = k;
      if (opts.recordErrors.has(k)) item.classList.add('error');
      if (opts.selection?.kind === 'record' && opts.selection.key === k) item.classList.add('active');
      item.appendChild(el('div', 'item-id', k));
      item.addEventListener('click', () => opts.onSelect({ kind: 'record', key: k }));
      itemsEl.appendChild(item);
    }
  } else {
    const rows = model.rowsOf(table);
    rows.forEach((row, idx) => {
      const { id, sub } = rowSummary(schema, row as Record<string, unknown>);
      if (q && !id.toLowerCase().includes(q) && !sub.toLowerCase().includes(q)) return;
      const item = document.createElement('div');
      item.className = 'list-item';
      item.dataset.rowIndex = String(idx);
      if (opts.rowErrors.has(idx)) item.classList.add('error');
      if (opts.selection?.kind === 'row' && opts.selection.index === idx) item.classList.add('active');
      item.appendChild(el('div', 'item-id', id || '（空 ID）'));
      if (sub) item.appendChild(el('div', 'item-sub', sub));
      item.addEventListener('click', () => opts.onSelect({ kind: 'row', index: idx }));
      itemsEl.appendChild(item);
    });
  }

  if (itemsEl.children.length === 0) {
    itemsEl.appendChild(el('div', 'list-empty', '（无条目）'));
  }
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
