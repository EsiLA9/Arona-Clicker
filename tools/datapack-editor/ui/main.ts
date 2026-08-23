/**
 * main.ts —— Datapack Editor 入口
 *
 * 独立于游戏运行时的 Schema 驱动编辑器，三栏布局：
 * 类型选择（侧栏） → ID-名称列表 → 详情面板（完整信息）。
 * 支持校验、撤销/重做、导入/导出（M6 fixture 导出见 io.ts）。
 */
import { EditorModel } from '../model/editor-model';
import { TABLES } from '../schema/datapack.schema';
import type { TableKey } from '../schema/types';
import { copyDatapack, downloadDatapack, loadDefaultDatapack, pasteImport, fileInputImport } from './io';
import { renderList, type Selection } from './components/list-view';
import { renderDetail } from './components/detail-view';
import { NaviService } from './navi';
import type { ValidationIssue } from '../validate';

const model = new EditorModel();
const navi = new NaviService();
let currentTable: TableKey = 'spots';
let selection: Selection = null;
let listFilter = '';

const sidebarEl = document.getElementById('sidebar')!;
const toolbarEl = document.getElementById('toolbar')!;
const listEl = document.getElementById('list-container')!;
const detailEl = document.getElementById('detail-container')!;
const errorPanelEl = document.getElementById('error-panel')!;

// ---------- 侧栏 ----------

function renderSidebar(): void {
  sidebarEl.replaceChildren();
  const title = document.createElement('div');
  title.className = 'sidebar-title';
  title.textContent = 'Datapack';
  sidebarEl.appendChild(title);

  for (const t of TABLES) {
    if (t.virtual) continue; // 虚拟合并引用表不展示在导航
    const btn = document.createElement('button');
    btn.className = 'table-link' + (t.key === currentTable ? ' active' : '');
    btn.textContent = t.label;
    btn.onclick = () => {
      currentTable = t.key;
      selection = null;
      listFilter = '';
      renderAll();
    };
    sidebarEl.appendChild(btn);
  }
}

// ---------- 工具栏 ----------

function renderToolbar(): void {
  toolbarEl.replaceChildren();
  const title = document.createElement('div');
  title.className = 'toolbar-title';
  const table = TABLES.find((t) => t.key === currentTable)!;
  title.textContent = `${table.label}（${table.key}）`;

  const actions = document.createElement('div');
  actions.className = 'toolbar-actions';

  actions.appendChild(toolBtn('⟲ 撤销', () => model.undo(), !model.canUndo()));
  actions.appendChild(toolBtn('⟳ 重做', () => model.redo(), !model.canRedo()));
  actions.appendChild(toolBtn('校验', () => renderErrors(model.validate())));
  actions.appendChild(toolBtn('加载默认数据', () => { model.loadDatapack(loadDefaultDatapack()); }));
  actions.appendChild(toolBtn('导入文件', async () => { const d = await fileInputImport(); if (d) model.loadDatapack(d); }));
  actions.appendChild(toolBtn('粘贴导入', async () => { const d = await pasteImport(); if (d) model.loadDatapack(d); }));
  actions.appendChild(toolBtn('复制当前表', () => void copyTableJson()));
  actions.appendChild(toolBtn('复制全量', () => void copyDatapack(model.toDatapack())));
  actions.appendChild(toolBtn('下载', () => downloadDatapack(model.toDatapack())));

  toolbarEl.append(title, actions);
}

function toolBtn(text: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = text;
  b.disabled = disabled;
  b.onclick = onClick;
  return b;
}

/** M6 fixture 导出：复制当前表 JSON 到剪贴板 */
async function copyTableJson(): Promise<void> {
  const table = TABLES.find((t) => t.key === currentTable)!;
  const payload: Record<string, unknown> = {};
  if (table.shape === 'record') {
    payload[table.key] = model.recordOf(table.key);
  } else {
    payload[table.key] = model.rowsOf(table.key);
  }
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
}

// ---------- 错误面板 ----------

function renderErrors(issues: ValidationIssue[]): void {
  const errors = issues.filter((i) => i.severity === 'error');
  errorPanelEl.replaceChildren();
  if (errors.length === 0) {
    errorPanelEl.textContent = '✓ 校验通过，无错误';
    errorPanelEl.className = 'error-panel ok';
    errorPanelEl.hidden = false;
    return;
  }
  errorPanelEl.className = 'error-panel';
  errorPanelEl.hidden = false;

  const summary = document.createElement('div');
  summary.className = 'error-summary';
  summary.textContent = `共 ${errors.length} 个错误`;
  errorPanelEl.appendChild(summary);

  const list = document.createElement('ul');
  for (const e of errors.slice(0, 200)) {
    const li = document.createElement('li');
    li.textContent = `[${e.table}] ${e.path} → ${e.message}`;
    li.onclick = () => {
      currentTable = e.table as TableKey;
      selection =
        e.rowIndex >= 0
          ? { kind: 'row', index: e.rowIndex }
          : e.key
            ? { kind: 'record', key: e.key }
            : null;
      renderAll();
      // 重渲染后滚动并高亮目标列表项
      requestAnimationFrame(() => {
        const sel = listEl.querySelector(
          e.rowIndex >= 0
            ? `.list-item[data-row-index="${e.rowIndex}"]`
            : `.list-item[data-record-key="${CSS.escape(e.key ?? '')}"]`,
        );
        if (sel) {
          sel.classList.add('list-navi');
          sel.scrollIntoView({ block: 'center' });
          setTimeout(() => sel.classList.remove('list-navi'), 2400);
        }
      });
    };
    list.appendChild(li);
  }
  errorPanelEl.appendChild(list);
}

// ---------- 列表 / 详情渲染 ----------

/** 本表校验出错误的行索引 */
function rowErrorSet(issues: ValidationIssue[]): Set<number> {
  const s = new Set<number>();
  for (const i of issues) {
    if (i.severity === 'error' && i.table === currentTable && i.rowIndex >= 0) s.add(i.rowIndex);
  }
  return s;
}

/** 本表校验出错误的 record key */
function recordErrorSet(issues: ValidationIssue[]): Set<string> {
  const s = new Set<string>();
  for (const i of issues) {
    if (i.severity === 'error' && i.table === currentTable && i.rowIndex < 0 && i.key) s.add(i.key);
  }
  return s;
}

const listViewOpts = (issues?: ValidationIssue[]) => {
  const errs = issues ?? model.validate();
  return {
    filter: listFilter,
    selection,
    rowErrors: rowErrorSet(errs),
    recordErrors: recordErrorSet(errs),
    onFilter: (f: string) => {
      listFilter = f;
      renderListOnly();
    },
    onSelect: (sel: Selection) => {
      selection = sel;
      renderListOnly();
      renderDetailOnly();
    },
    onAddRow: () => {
      selection = { kind: 'row', index: model.addRow(currentTable) };
    },
    onAddRecordKey: (key: string) => {
      model.setRecordKey(currentTable, key, { t: 'null', v: null });
      selection = { kind: 'record', key };
    },
  };
};

const detailViewOpts = {
  navi,
  onSelect: (sel: Selection) => {
    selection = sel;
  },
  onDeleted: () => {
    selection = null;
  },
};

function renderListOnly(): void {
  renderList(listEl, model, currentTable, listViewOpts());
}

function renderDetailOnly(): void {
  renderDetail(detailEl, model, currentTable, selection, detailViewOpts);
}

function renderAll(): void {
  renderSidebar();
  renderToolbar();
  const issues = model.validate();
  renderList(listEl, model, currentTable, listViewOpts(issues));
  renderDetail(detailEl, model, currentTable, selection, detailViewOpts);
  renderErrors(issues);
}

// ---------- 导航 ----------

let naviTimer: ReturnType<typeof setTimeout> | undefined;
navi.onNavigate((target) => {
  currentTable = target.table;
  selection =
    target.recordKey !== undefined
      ? { kind: 'record', key: target.recordKey }
      : { kind: 'row', index: target.rowIndex };
  renderAll();
  // 重渲染后定位并高亮目标列表项
  requestAnimationFrame(() => {
    clearTimeout(naviTimer);
    const sel = listEl.querySelector(
      target.recordKey !== undefined
        ? `.list-item[data-record-key="${CSS.escape(target.recordKey)}"]`
        : `.list-item[data-row-index="${target.rowIndex}"]`,
    );
    listEl.querySelectorAll('.list-item.list-navi').forEach((e) => e.classList.remove('list-navi'));
    if (sel) {
      sel.classList.add('list-navi');
      sel.scrollIntoView({ block: 'center' });
      naviTimer = setTimeout(() => sel.classList.remove('list-navi'), 2400);
    }
  });
});

model.onChange(() => renderAll());

// 初始化
model.loadDatapack(loadDefaultDatapack());
renderAll();
