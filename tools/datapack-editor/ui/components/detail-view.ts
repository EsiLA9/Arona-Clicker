/**
 * detail-view.ts —— 右侧详情面板
 *
 * 点击左侧列表项后在此展开完整信息。编辑采用本地工作对象 +
 * 保存/放弃按钮，编辑期间不触发全局重渲染（避免输入失焦）。
 */
import type { EditorModel } from '../../model/editor-model';
import type { TableKey } from '../../schema/types';
import { getTable } from '../../schema/datapack.schema';
import { renderField, renderType, type FieldEditorCtx } from './field-editor';
import type { NaviService } from '../navi';
import { rowSummary, type Selection } from './list-view';

export interface DetailViewOpts {
  navi?: NaviService;
  /** 移动/复制行后更新选中项 */
  onSelect(sel: Selection): void;
  /** 删除当前项后清空选中 */
  onDeleted(): void;
}

export function renderDetail(
  container: HTMLElement,
  model: EditorModel,
  table: TableKey,
  selection: Selection,
  opts: DetailViewOpts,
): void {
  container.replaceChildren();
  if (!selection) {
    container.appendChild(el('div', 'detail-empty', '← 从左侧列表选择一条记录查看完整信息'));
    return;
  }
  if (selection.kind === 'record') renderRecordDetail(container, model, table, selection.key, opts);
  else renderRowDetail(container, model, table, selection.index, opts);
}

// ---------- array 表：整行表单 ----------

function renderRowDetail(
  container: HTMLElement,
  model: EditorModel,
  table: TableKey,
  index: number,
  opts: DetailViewOpts,
): void {
  const schema = getTable(table);
  const rows = model.rowsOf(table);
  const row = rows[index];
  if (!row) {
    opts.onDeleted();
    return;
  }
  const { id, sub } = rowSummary(schema, row);
  const work = structuredClone(row);
  const ctx: FieldEditorCtx = { table, model, navi: opts.navi };
  let dirty = false;

  // 头部：标题 + 行操作
  const header = el('div', 'detail-header');
  const titleBox = el('div', 'detail-title');
  titleBox.appendChild(el('h2', undefined, id || '（空 ID）'));
  if (sub) titleBox.appendChild(el('span', 'detail-sub', sub));
  header.appendChild(titleBox);

  const actions = el('div', 'detail-actions');
  const copyBtn = btn('复制 JSON', 'btn btn-small');
  const upBtn = btn('↑', 'btn btn-small');
  const downBtn = btn('↓', 'btn btn-small');
  const dupBtn = btn('⧉', 'btn btn-small');
  const delBtn = btn('删除', 'btn btn-small btn-danger');
  upBtn.title = '上移';
  downBtn.title = '下移';
  dupBtn.title = '复制行';
  delBtn.title = '删除行';
  upBtn.disabled = index <= 0;
  downBtn.disabled = index >= rows.length - 1;
  actions.append(copyBtn, upBtn, downBtn, dupBtn, delBtn);
  header.appendChild(actions);
  container.appendChild(header);

  // 主体：字段表单
  const body = el('div', 'detail-body');
  const statusEl = el('span', 'detail-status');
  const saveBtn = btn('保存', 'btn');
  const cancelBtn = btn('放弃', 'btn');
  const markDirty = () => {
    if (dirty) return;
    dirty = true;
    saveBtn.classList.add('btn-primary');
    statusEl.textContent = '有未保存更改';
  };
  body.appendChild(renderType({ kind: 'object', fields: schema.fields }, work, ctx, () => {}));
  body.addEventListener('input', markDirty, true);
  body.addEventListener('change', markDirty, true);
  container.appendChild(body);

  // 底部：状态 + 放弃 / 保存
  const footer = el('div', 'detail-footer');
  footer.append(statusEl, cancelBtn, saveBtn);
  container.appendChild(footer);

  cancelBtn.addEventListener('click', () =>
    renderDetail(container, model, table, { kind: 'row', index }, opts),
  );
  saveBtn.addEventListener('click', () => {
    model.setValue(table, index, [], work);
    dirty = false;
  });
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(work, null, 2));
    flash(copyBtn, '已复制');
  });
  upBtn.addEventListener('click', () => {
    if (index <= 0) return;
    opts.onSelect({ kind: 'row', index: index - 1 });
    model.moveRow(table, index, index - 1);
  });
  downBtn.addEventListener('click', () => {
    if (index >= rows.length - 1) return;
    opts.onSelect({ kind: 'row', index: index + 1 });
    model.moveRow(table, index, index + 1);
  });
  dupBtn.addEventListener('click', () => {
    const newIndex = model.duplicateRow(table, index);
    opts.onSelect({ kind: 'row', index: newIndex });
  });
  delBtn.addEventListener('click', () => {
    if (!window.confirm(`删除该行？\n${id || '（空 ID）'}`)) return;
    opts.onDeleted();
    model.removeRow(table, index);
  });
}

// ---------- record 表：extra 值编辑 ----------

function renderRecordDetail(
  container: HTMLElement,
  model: EditorModel,
  table: TableKey,
  key: string,
  opts: DetailViewOpts,
): void {
  const schema = getTable(table);
  const rec = model.recordOf(table);
  if (!(key in rec)) {
    opts.onDeleted();
    return;
  }
  let work = structuredClone(rec[key]);
  const ctx: FieldEditorCtx = { table, model, navi: opts.navi };
  let dirty = false;

  // 头部：key + 操作
  const header = el('div', 'detail-header');
  const titleBox = el('div', 'detail-title');
  titleBox.appendChild(el('h2', undefined, key));
  titleBox.appendChild(el('span', 'detail-sub', schema.label));
  header.appendChild(titleBox);

  const actions = el('div', 'detail-actions');
  const copyBtn = btn('复制 JSON', 'btn btn-small');
  const delBtn = btn('删除键', 'btn btn-small btn-danger');
  delBtn.title = '删除该键';
  actions.append(copyBtn, delBtn);
  header.appendChild(actions);
  container.appendChild(header);

  // 主体：extra JSON 编辑
  const body = el('div', 'detail-body');
  const statusEl = el('span', 'detail-status');
  const saveBtn = btn('保存', 'btn');
  const cancelBtn = btn('放弃', 'btn');
  const markDirty = () => {
    if (dirty) return;
    dirty = true;
    saveBtn.classList.add('btn-primary');
    statusEl.textContent = '有未保存更改';
  };
  const field = schema.recordValue ?? {
    key,
    label: key,
    required: false,
    description: '',
    type: { kind: 'extra' },
  };
  body.appendChild(
    renderField(field, work, (v) => {
      work = v;
      markDirty();
    }, ctx),
  );
  body.addEventListener('input', markDirty, true);
  container.appendChild(body);

  // 底部：状态 + 放弃 / 保存
  const footer = el('div', 'detail-footer');
  footer.append(statusEl, cancelBtn, saveBtn);
  container.appendChild(footer);

  cancelBtn.addEventListener('click', () =>
    renderDetail(container, model, table, { kind: 'record', key }, opts),
  );
  saveBtn.addEventListener('click', () => {
    model.setRecordKey(table, key, work);
    dirty = false;
  });
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(work, null, 2));
    flash(copyBtn, '已复制');
  });
  delBtn.addEventListener('click', () => {
    if (!window.confirm(`删除键 ${key}？`)) return;
    opts.onDeleted();
    model.removeRecordKey(table, key);
  });
}

// ---------- 工具 ----------

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(text: string, cls: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  return b;
}

function flash(btnEl: HTMLElement, text: string): void {
  const old = btnEl.textContent;
  btnEl.textContent = text;
  setTimeout(() => (btnEl.textContent = old), 1200);
}
