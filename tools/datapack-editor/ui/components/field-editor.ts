/**
 * field-editor.ts —— 递归字段表单（弹层子编辑器）
 *
 * 支持 object / array / union / record / extra 等复杂类型的结构化编辑。
 * 编辑期间维护本地工作对象（共享引用），保存时一次性提交到 EditorModel。
 */
import type { EditorModel } from '../model/editor-model';
import type { FieldDef, FieldType, TableKey } from '../schema/types';
import { collectEnumOptions } from './enum-options';
import {
  collectRefOptions,
  resolveOptionsFrom,
  resolveRef,
  type NaviService,
  type RefOption,
} from '../navi';

export interface FieldEditorCtx {
  table: TableKey;
  model: EditorModel;
  /** 导航系统：ref / optionsFrom 字段跳转目标行 */
  navi?: NaviService;
}

export function openFieldEditor(opts: {
  model: EditorModel;
  table: TableKey;
  rowIndex: number;
  path: (string | number)[];
  field: FieldDef;
  value: unknown;
  navi?: NaviService;
}): void {
  const { model, table, rowIndex, path, field, value, navi } = opts;
  let work = deepClone(value);
  const ctx: FieldEditorCtx = { table, model, navi };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const box = document.createElement('div');
  box.className = 'modal-box field-editor';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `<strong>${escapeHtml(field.label)}</strong><span class="path">${escapeHtml(path.join('.'))}</span>`;
  const body = document.createElement('div');
  body.className = 'modal-body';
  const form = renderType(field.type, work, ctx, (v) => (work = v));
  body.appendChild(form);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const btnCancel = document.createElement('button');
  btnCancel.textContent = '取消';
  btnCancel.className = 'btn';
  const btnSave = document.createElement('button');
  btnSave.textContent = '保存';
  btnSave.className = 'btn btn-primary';
  footer.append(btnCancel, btnSave);

  box.append(header, body, footer);
  overlay.appendChild(box);
  document.getElementById('modal-root')!.appendChild(overlay);

  const close = () => overlay.remove();
  btnCancel.onclick = close;
  btnSave.onclick = () => {
    model.setValue(table, rowIndex, path, work);
    close();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}

// ---------- 入口：按类型渲染 ----------

export function renderType(
  type: FieldType,
  value: unknown,
  ctx: FieldEditorCtx,
  commit: (v: unknown) => void,
): HTMLElement {
  switch (type.kind) {
    case 'string':
    case 'int':
    case 'float':
    case 'flexible':
      return renderScalar(type, value, commit);
    case 'bool':
      return renderBool(value, commit);
    case 'enum':
      return renderEnum(type, value, ctx, commit);
    case 'multiEnum':
      return renderMultiEnum(type, value, commit);
    case 'ref':
      return renderRef(type, value, ctx, commit);
    case 'object':
      return renderObject(type, value, ctx);
    case 'array':
      return renderArray(type, value, ctx);
    case 'record':
      return renderRecord(type, value, ctx);
    case 'union':
      return renderUnion(type, value, ctx);
    case 'tagged':
      return renderTagged(type, value, ctx, commit);
    case 'extra':
      return renderExtra(value, commit);
    case 'divider':
      // renderField 在字段遍历处已直接渲染横条，此处仅作类型完备
      return document.createElement('div');
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return document.createElement('div');
    }
  }
}

// ---------- 标量 ----------

function renderScalar(
  type: FieldType & { kind: 'string' | 'int' | 'float' | 'flexible' },
  value: unknown,
  commit: (v: unknown) => void,
): HTMLElement {
  const input = document.createElement('input');
  input.type = type.kind === 'int' || type.kind === 'float' ? 'number' : 'text';
  input.className = 'field-input';
  input.value = value == null ? '' : String(value);
  input.onchange = () => {
    const raw = input.value;
    if (type.kind === 'int') {
      const n = parseInt(raw, 10);
      commit(Number.isNaN(n) ? null : n);
    } else if (type.kind === 'float') {
      const n = parseFloat(raw);
      commit(Number.isNaN(n) ? null : n);
    } else if (type.kind === 'flexible') {
      const n = Number(raw);
      commit(raw.trim() !== '' && raw !== 'NaN' && !Number.isNaN(n) ? n : raw);
    } else {
      commit(raw);
    }
  };
  return input;
}

function renderBool(value: unknown, commit: (v: unknown) => void): HTMLElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'field-input';
  input.checked = Boolean(value);
  input.onchange = () => commit(input.checked);
  return input;
}

/** 枚举值显示文本：有中文含义时显示"英文（中文）"，否则仅显示英文 */
function enumDisplayText(meaning: Record<string, string> | undefined, value: string): string {
  const zh = meaning?.[value];
  return zh ? `${value}（${zh}）` : value;
}

function renderEnum(
  type: FieldType & { kind: 'enum' },
  value: unknown,
  ctx: FieldEditorCtx,
  commit: (v: unknown) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'enum-editor';
  const select = document.createElement('select');
  select.className = 'field-input';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '（空）';
  select.appendChild(blank);
  for (const o of collectEnumOptions(type, ctx.table, ctx.model)) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = enumDisplayText(type.meaning, o);
    select.appendChild(opt);
  }
  select.value = typeof value === 'string' ? value : '';
  select.onchange = () => commit(select.value);
  wrap.appendChild(select);

  // optionsFrom：一键跳转到来源表首个匹配行
  if (type.optionsFrom && ctx.navi) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-small navi-btn';
    btn.textContent = '↗';
    btn.title = `跳转到 ${type.optionsFrom.table} 中该值的来源行`;
    btn.onclick = () => {
      const target = resolveOptionsFrom(ctx.model, type.optionsFrom, select.value);
      if (target) ctx.navi?.navigate(target);
      else btn.classList.add('navi-miss');
    };
    wrap.appendChild(btn);
  }
  return wrap;
}

function renderMultiEnum(
  type: FieldType & { kind: 'multiEnum' },
  value: unknown,
  commit: (v: unknown) => void,
): HTMLElement {
  const current = Array.isArray(value) ? (value as string[]) : [];
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  for (const opt of type.options ?? []) {
    const chip = document.createElement('label');
    chip.className = 'chip' + (current.includes(opt) ? ' on' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = current.includes(opt);
    chip.appendChild(cb);
    chip.appendChild(document.createTextNode(enumDisplayText(type.meaning, opt)));
    cb.onchange = () => {
      const next = cb.checked ? [...current, opt] : current.filter((c) => c !== opt);
      commit(next);
    };
    wrap.appendChild(chip);
  }
  return wrap;
}

function renderRef(
  type: FieldType & { kind: 'ref' },
  value: unknown,
  ctx: FieldEditorCtx,
  commit: (v: unknown) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ref-editor';
  const box = document.createElement('div');
  box.className = 'ref-combo';

  const options = collectRefOptions(ctx.model, type.table);
  const labelOf = (id: string): string => {
    const opt = options.find((o) => o.id === id);
    return opt && opt.name ? `${opt.name} (${opt.id})` : id;
  };

  let committed = typeof value === 'string' ? value : '';

  const input = document.createElement('input');
  input.className = 'field-input';
  input.placeholder = `引用 ${type.table}`;
  input.autocomplete = 'off';
  input.spellcheck = false;

  // 空闲显示"名 (id)"，聚焦时显示原始 id 便于编辑
  const showLabel = () => {
    input.value = committed ? labelOf(committed) : '';
  };
  showLabel();

  // 下拉栏
  const dropdown = document.createElement('div');
  dropdown.className = 'ref-dropdown';
  dropdown.hidden = true;
  let activeIdx = -1;
  let items: { el: HTMLElement; id: string }[] = [];

  const filtered = (q: string): RefOption[] => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) => o.id.toLowerCase().includes(s) || o.name.toLowerCase().includes(s),
    );
  };

  const renderList = (q: string, cap?: number) => {
    dropdown.replaceChildren();
    activeIdx = -1;
    items = [];
    const all = filtered(q);
    const list = cap ? all.slice(0, cap) : all;
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ref-dropdown-empty';
      empty.textContent = '（无匹配）';
      dropdown.appendChild(empty);
      return;
    }
    list.forEach((o, i) => {
      const item = document.createElement('div');
      item.className = 'ref-option' + (o.id === committed ? ' active' : '');
      const name = document.createElement('span');
      name.className = 'ref-option-name';
      name.textContent = o.name || '—';
      const id = document.createElement('span');
      id.className = 'ref-option-id';
      id.textContent = o.id;
      item.append(name, id);
      item.addEventListener('mousedown', (e) => e.preventDefault()); // 避免 blur 先触发
      item.addEventListener('click', () => pick(o.id));
      dropdown.appendChild(item);
      items.push({ el: item, id: o.id });
    });
    // 默认高亮当前值
    const cur = items.findIndex((x) => x.id === committed);
    if (cur >= 0) setActive(cur);
    // 截断提示：还有更多候选项，输入以过滤
    if (cap && all.length > cap) {
      const more = document.createElement('div');
      more.className = 'ref-dropdown-more';
      more.textContent = `… 共 ${all.length} 项，输入以过滤`;
      dropdown.appendChild(more);
    }
  };

  const setActive = (i: number) => {
    if (!items.length) return;
    activeIdx = (i + items.length) % items.length;
    items.forEach((it, j) => it.el.classList.toggle('hover', j === activeIdx));
  };

  const DEFAULT_VISIBLE = 10; // 初始展开时展示的前 N 个候选项
  const openList = (q: string, cap?: number) => {
    renderList(q, cap);
    dropdown.hidden = false;
  };
  const closeList = () => {
    dropdown.hidden = true;
  };
  let suppressBlur = false; // 点击/回车选中后 blur 不再提交显示文本
  const notifyChange = () => input.dispatchEvent(new Event('change', { bubbles: true }));
  const pick = (id: string) => {
    committed = id;
    commit(id);
    notifyChange();
    closeList();
    showLabel();
    suppressBlur = true;
    input.blur();
  };

  input.addEventListener('focus', () => {
    input.value = committed;
    // 初次展开（空值或已 ref 其他内容）都展示全部候选项，提示可选取范围
    openList('', DEFAULT_VISIBLE);
  });
  input.addEventListener('input', () => {
    // 输入新内容后按输入搜索，不再截断
    openList(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) setActive(activeIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) setActive(activeIdx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = items[activeIdx];
      if (target) {
        pick(target.id);
      } else {
        // 无选中项：按当前输入提交（兼容手输任意 id）
        suppressBlur = true;
        const raw = input.value.trim();
        committed = raw;
        commit(raw);
        notifyChange();
        showLabel();
        input.blur();
      }
    } else if (e.key === 'Escape') {
      closeList();
      showLabel();
      suppressBlur = true;
      input.blur();
    }
  });
  input.addEventListener('blur', () => {
    // 失焦提交当前输入（延迟关闭下拉，避免点击选项时先触发）
    setTimeout(() => closeList(), 120);
    if (suppressBlur) {
      suppressBlur = false;
      return;
    }
    const raw = input.value.trim();
    if (raw !== committed) {
      committed = raw;
      commit(raw);
      notifyChange();
    }
    showLabel();
  });

  box.append(input, dropdown);
  wrap.appendChild(box);

  // 跳转到被引用目标行
  const btn = document.createElement('button');
  btn.className = 'btn btn-small navi-btn';
  btn.textContent = '↗';
  btn.title = `跳转到 ${type.table} 中的目标行`;
  btn.onclick = () => {
    const target = resolveRef(ctx.model, type.table, committed);
    if (target) ctx.navi?.navigate(target);
    else btn.classList.add('navi-miss');
  };
  wrap.appendChild(btn);
  return wrap;
}

// ---------- 组合 ----------

function renderObject(
  type: FieldType & { kind: 'object' },
  value: unknown,
  ctx: FieldEditorCtx,
): HTMLElement {
  const obj = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const wrap = document.createElement('div');
  wrap.className = 'field-group';
  for (const f of type.fields) {
    wrap.appendChild(
      f.root
        ? renderField(f, obj, (v) => Object.assign(obj, v), ctx)
        : renderField(f, obj[f.key], (v) => (obj[f.key] = v), ctx),
    );
  }
  return wrap;
}

function renderArray(
  type: FieldType & { kind: 'array' },
  value: unknown,
  ctx: FieldEditorCtx,
): HTMLElement {
  const arr = Array.isArray(value) ? (value as unknown[]) : [];
  const wrap = document.createElement('div');
  wrap.className = 'field-group array-editor';
  const list = document.createElement('div');
  list.className = 'array-list';

  // 折叠式可变列表：已展开的条目索引
  const open = new Set<number>();

  const refresh = () => {
    list.replaceChildren();
    arr.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'array-item';
      if (type.collapsible) {
        row.classList.add('collapsible');
        if (open.has(idx)) row.classList.add('open');
        const head = document.createElement('div');
        head.className = 'array-item-head';
        const caret = document.createElement('span');
        caret.className = 'array-item-caret';
        caret.textContent = open.has(idx) ? '▾' : '▸';
        const summary = document.createElement('span');
        summary.className = 'array-item-summary';
        summary.textContent = summarizeItem(type.item, item) || '（空）';
        const del = document.createElement('button');
        del.textContent = '×';
        del.className = 'btn btn-small btn-danger';
        del.onclick = () => {
          arr.splice(idx, 1);
          open.delete(idx);
          for (const k of [...open]) {
            if (k > idx) {
              open.delete(k);
              open.add(k - 1);
            }
          }
          refresh();
        };
        head.append(caret, summary, del);
        const body = document.createElement('div');
        body.className = 'array-item-body';
        if (open.has(idx)) {
          body.appendChild(renderField(type.item, item, (v) => (arr[idx] = v), ctx));
        }
        head.onclick = (e) => {
          if (e.target === del) return;
          if (open.has(idx)) open.delete(idx);
          else open.add(idx);
          refresh();
        };
        row.append(head, body);
      } else {
        row.appendChild(renderField(type.item, item, (v) => (arr[idx] = v), ctx));
        const del = document.createElement('button');
        del.textContent = '×';
        del.className = 'btn btn-small btn-danger';
        del.onclick = () => {
          arr.splice(idx, 1);
          refresh();
        };
        row.appendChild(del);
      }
      list.appendChild(row);
    });
  };
  refresh();

  const add = document.createElement('button');
  add.textContent = '+ 添加';
  add.className = 'btn btn-small';
  add.onclick = () => {
    const idx = arr.length;
    arr.push(initValue(type.item.type));
    if (type.collapsible) open.add(idx);
    refresh();
  };
  wrap.append(list, add);
  return wrap;
}

function renderRecord(
  type: FieldType & { kind: 'record' },
  value: unknown,
  ctx: FieldEditorCtx,
): HTMLElement {
  const rec = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const wrap = document.createElement('div');
  wrap.className = 'field-group record-editor';
  const list = document.createElement('div');

  const refresh = () => {
    list.replaceChildren();
    for (const [k, v] of Object.entries(rec)) {
      const row = document.createElement('div');
      row.className = 'record-item';
      const keyInput = document.createElement('input');
      keyInput.className = 'field-input record-key';
      keyInput.value = k;
      keyInput.onchange = () => {
        const nk = keyInput.value;
        if (nk !== k && !(nk in rec)) {
          rec[nk] = rec[k];
          delete rec[k];
          refresh();
        }
      };
      const del = document.createElement('button');
      del.textContent = '×';
      del.className = 'btn btn-small btn-danger';
      del.onclick = () => {
        delete rec[k];
        refresh();
      };
      row.append(keyInput, renderField(type.value, v, (nv) => (rec[k] = nv), ctx), del);
      list.appendChild(row);
    }
  };
  refresh();

  const add = document.createElement('button');
  add.textContent = '+ 添加键';
  add.className = 'btn btn-small';
  add.onclick = () => {
    rec['key'] = initValue(type.value.type);
    refresh();
  };
  wrap.append(list, add);
  return wrap;
}

function renderUnion(
  type: FieldType & { kind: 'union' },
  value: unknown,
  ctx: FieldEditorCtx,
): HTMLElement {
  const obj = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const wrap = document.createElement('div');
  wrap.className = 'field-group';

  const sel = document.createElement('select');
  sel.className = 'field-input';
  for (const v of type.variants) {
    const opt = document.createElement('option');
    opt.value = v.tag;
    opt.textContent = v.label;
    sel.appendChild(opt);
  }
  const tag = typeof obj[type.tagField] === 'string' ? (obj[type.tagField] as string) : '';
  // 判别键缺失/非法：优先 noTag 变体（如叶子条件不写 type），否则回退第一个变体
  const fallbackTag = type.variants.find((v) => v.noTag)?.tag ?? type.variants[0]?.tag ?? '';
  const selTag = type.variants.some((v) => v.tag === tag) ? tag : fallbackTag;
  sel.value = selTag;

  const fieldsEl = document.createElement('div');
  const renderVariant = () => {
    fieldsEl.replaceChildren();
    const variant = type.variants.find((v) => v.tag === sel.value) ?? type.variants[0];
    const fields = typeof variant.fields === 'function' ? variant.fields() : variant.fields;
    for (const f of fields) {
      fieldsEl.appendChild(
        f.root
          ? renderField(f, obj, (v) => Object.assign(obj, v), ctx)
          : renderField(f, obj[f.key], (v) => (obj[f.key] = v), ctx),
      );
    }
  };
  sel.onchange = () => {
    const variant = type.variants.find((v) => v.tag === sel.value);
    if (variant?.noTag) delete obj[type.tagField];
    else obj[type.tagField] = sel.value;
    renderVariant();
  };
  renderVariant();
  wrap.append(sel, fieldsEl);
  return wrap;
}

/**
 * 判别对象联合（tagged）：第一个字段为枚举下拉（必选 combos 之一，不提供空选项），
 * 后续字段组合随枚举值切换。数据形状 { tagKey: 枚举值, ...combo 字段 }。
 */
function renderTagged(
  type: FieldType & { kind: 'tagged' },
  value: unknown,
  ctx: FieldEditorCtx,
  commit: (v: unknown) => void,
): HTMLElement {
  const isObj = typeof value === 'object' && value !== null;
  const obj = (isObj ? value : {}) as Record<string, unknown>;
  if (!isObj) commit(obj); // 值缺失：立即挂载到上层，后续编辑写入共享引用
  const wrap = document.createElement('div');
  wrap.className = 'field-group';

  // 第一个元素：判别枚举下拉
  const tagRow = document.createElement('div');
  tagRow.className = 'field-item required';
  const label = document.createElement('label');
  label.className = 'field-label';
  label.textContent = type.tagField.label + ' *';
  label.title = type.tagField.description ?? '';
  const select = document.createElement('select');
  select.className = 'field-input';
  const tags = type.combos.map((c) => c.tag);
  const meaning = type.tagField.type.kind === 'enum' ? type.tagField.type.meaning : undefined;
  for (const t of tags) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = enumDisplayText(meaning, t);
    select.appendChild(opt);
  }
  const cur = typeof obj[type.tagField.key] === 'string' ? (obj[type.tagField.key] as string) : '';
  if (tags.includes(cur)) {
    select.value = cur;
  } else {
    select.value = tags[0] ?? '';
    obj[type.tagField.key] = select.value; // 兜底：判别键取首个合法值
  }

  const body = document.createElement('div');
  body.className = 'field-group';

  const renderCombo = () => {
    body.replaceChildren();
    const combo = type.combos.find((c) => c.tag === obj[type.tagField.key]) ?? type.combos[0];
    if (!combo) return;
    for (const f of combo.fields) {
      body.appendChild(
        f.root
          ? renderField(f, obj, (v) => Object.assign(obj, v), ctx)
          : renderField(f, obj[f.key], (v) => (obj[f.key] = v), ctx),
      );
    }
    // 公共尾部字段：所有组合之后渲染（如条件叶子的比较符/值）
    for (const f of type.after ?? []) {
      body.appendChild(
        f.root
          ? renderField(f, obj, (v) => Object.assign(obj, v), ctx)
          : renderField(f, obj[f.key], (v) => (obj[f.key] = v), ctx),
      );
    }
  };

  select.onchange = () => {
    obj[type.tagField.key] = select.value;
    renderCombo();
  };

  tagRow.append(label, select);
  wrap.append(tagRow, body);
  renderCombo();
  return wrap;
}

function renderExtra(value: unknown, commit: (v: unknown) => void): HTMLElement {
  const textarea = document.createElement('textarea');
  textarea.className = 'field-input extra-editor';
  textarea.rows = 8;
  textarea.value = JSON.stringify(value ?? null, null, 2);
  textarea.onchange = () => {
    try {
      textarea.classList.remove('invalid');
      commit(JSON.parse(textarea.value));
    } catch {
      textarea.classList.add('invalid');
    }
  };
  textarea.oninput = () => textarea.classList.remove('invalid');
  return textarea;
}

// ---------- 字段行包装 ----------

export function renderField(
  field: FieldDef,
  value: unknown,
  commit: (v: unknown) => void,
  ctx: FieldEditorCtx,
): HTMLElement {
  // 分隔横条：仅用于 UI 语义分组，不属于数据字段
  if (field.type.kind === 'divider') {
    const div = document.createElement('div');
    div.className = 'field-divider';
    div.textContent = field.label;
    return div;
  }
  const row = document.createElement('div');
  row.className = 'field-item' + (field.required && isEmptyish(value) ? ' required' : '');
  const label = document.createElement('label');
  label.className = 'field-label';
  label.textContent = field.label + (field.required ? ' *' : '');
  label.title = field.description ?? '';
  // root 字段描述宿主对象整体：提交时把渲染结果合并回对象（如叶子条件的 tagged 联动）
  const control = field.root
    ? renderType(field.type, value, ctx, (v) => Object.assign(value as Record<string, unknown>, v))
    : renderType(field.type, value, ctx, commit);
  row.append(label, control);
  return row;
}

function isEmptyish(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

// ---------- 折叠列表摘要 ----------

/** 将某个条目的值转为一句话摘要（用于折叠列表头）。 */
function summarizeItem(def: FieldDef, value: unknown): string {
  if (def.type.kind === 'object') {
    const obj = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const parts: string[] = [];
    for (const f of def.type.fields) {
      if (f.type.kind === 'divider') continue; // 横条非数据字段
      const s = summarizeFieldType(f.type, obj[f.key]);
      if (s !== '—') parts.push(`${f.label}: ${s}`);
    }
    return parts.join(' · ');
  }
  return summarizeFieldType(def.type, value);
}

function summarizeFieldType(type: FieldType, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  switch (type.kind) {
    case 'string':
    case 'ref':
    case 'flexible':
    case 'int':
    case 'float':
      return String(value);
    case 'enum':
      return typeof value === 'string' ? enumDisplayText(type.meaning, value) : String(value);
    case 'bool':
      return value ? '是' : '否';
    case 'multiEnum':
      return Array.isArray(value) && value.length
        ? (value as string[]).map((v) => enumDisplayText(type.meaning, v)).join('、')
        : '—';
    case 'object': {
      const obj = value as Record<string, unknown>;
      const parts: string[] = [];
      for (const f of type.fields) {
        if (f.type.kind === 'divider') continue; // 横条非数据字段
        const s = summarizeFieldType(f.type, obj[f.key]);
        if (s !== '—') parts.push(`${f.label}: ${s}`);
      }
      return parts.join(' · ') || '—';
    }
    case 'array':
      return Array.isArray(value) ? `${value.length} 项` : '—';
    case 'record':
      return typeof value === 'object' ? `${Object.keys(value).length} 键` : '—';
    case 'union': {
      const obj = value as Record<string, unknown>;
      const tag = String(obj[type.tagField] ?? '');
      const hit = type.variants.find((x) => x.tag === tag);
      if (hit) return hit.label;
      // 判别键缺失：回退 noTag 变体（如叶子条件），输出其内容摘要保持可读
      const leaf = type.variants.find((x) => x.noTag);
      if (leaf) {
        const fields = typeof leaf.fields === 'function' ? leaf.fields() : leaf.fields;
        const parts: string[] = [];
        for (const f of fields) {
          if (f.type.kind === 'divider') continue;
          const s = f.root ? summarizeFieldType(f.type, obj) : summarizeFieldType(f.type, obj[f.key]);
          if (s !== '—') parts.push(s);
        }
        return parts.length ? parts.join(' · ') : leaf.label;
      }
      return tag || '—';
    }
    case 'tagged': {
      const obj = value as Record<string, unknown>;
      const tag = typeof obj[type.tagField.key] === 'string' ? (obj[type.tagField.key] as string) : '';
      const tagText = tag
        ? enumDisplayText(
            type.tagField.type.kind === 'enum' ? type.tagField.type.meaning : undefined,
            tag,
          )
        : '—';
      const combo = type.combos.find((c) => c.tag === tag) ?? type.combos[0];
      if (!combo) return tagText;
      const parts: string[] = [];
      for (const f of combo.fields) {
        if (f.type.kind === 'divider') continue; // 横条非数据字段
        const s = f.root ? summarizeFieldType(f.type, obj) : summarizeFieldType(f.type, obj[f.key]);
        if (s !== '—') parts.push(`${f.label}: ${s}`);
      }
      for (const f of type.after ?? []) {
        if (f.type.kind === 'divider') continue; // 横条非数据字段
        const s = f.root ? summarizeFieldType(f.type, obj) : summarizeFieldType(f.type, obj[f.key]);
        if (s !== '—') parts.push(`${f.label}: ${s}`);
      }
      return parts.length ? `${tagText} · ${parts.join(' · ')}` : tagText;
    }
    case 'extra':
      return 'JSON';
    case 'divider':
      return '—';
    default:
      return '—';
  }
}

// ---------- 工具 ----------

function deepClone<T>(v: T): T {
  return v === undefined ? ({} as T) : structuredClone(v);
}

export function initValue(type: FieldType): unknown {
  switch (type.kind) {
    case 'string':
    case 'enum':
    case 'ref':
    case 'flexible':
      return '';
    case 'int':
    case 'float':
      return 0;
    case 'bool':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    case 'record':
      return {};
    case 'multiEnum':
      return [];
    case 'union': {
      const first = type.variants[0];
      // noTag 变体（如叶子条件）不写判别键
      if (first?.noTag) return {};
      return { [type.tagField]: first.tag };
    }
    case 'tagged': {
      const first = type.combos[0];
      return { [type.tagField.key]: first?.tag ?? '' };
    }
    case 'extra':
      return { t: 'null', v: null };
    case 'divider':
      return null; // 横条非数据字段，不产生默认值
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return null;
    }
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
