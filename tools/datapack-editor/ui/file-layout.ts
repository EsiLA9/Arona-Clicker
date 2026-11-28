import { writeZipArchive } from '../../../src/data-services/archive/archive-writer';
import { isListField } from '../../../src/data-services/datapack/fragment-parser';
import { planProjectLayout, type Grouping, type LayoutRequest, type LayoutRule } from '../../../src/data-services/datapack/project-layout';
import { projectEntityKey, type ProjectRead } from '../../../src/data-services/datapack/project-source';
import { downloadProjectZip, readEditorProject } from './io';

export function mountFileLayout(root: HTMLElement, callbacks: { close(): void; hasEdits(): boolean }) {
  root.innerHTML = `
    <header class="file-layout-bar">
      <button type="button" class="btn" data-open>打开 JSON / ZIP</button>
      <button type="button" class="btn" data-directory>打开目录</button>
      <input type="file" accept=".json,.zip" data-file hidden>
      <input type="file" webkitdirectory multiple data-files hidden>
      <label>操作
        <select class="field-input" data-mode>
          <option value="table">全拆 · 按表</option><option value="entity">全拆 · 按实体</option>
          <option value="selected">合一 · 已选内容</option><option value="all">合一 · 整个项目</option>
          <option value="type">快速层级化 · 数据类型</option><option value="init">快速层级化 · Init</option>
          <option value="character">快速层级化 · 角色</option><option value="series">快速层级化 · 故事系列</option>
          <option value="custom">快速层级化 · 自定义</option>
        </select>
      </label>
      <label data-compat-label hidden><input type="checkbox" data-compatible> 旧版兼容发行</label>
    </header>
    <p class="file-layout-source" data-source></p>
    <div class="file-layout-columns">
      <section><h2>当前文件结构</h2><div data-source-tree></div></section>
      <section>
        <h2>目标文件结构</h2>
        <label data-merge-label hidden>合一目标 <input class="field-input" data-merge-target value="content.json"></label>
        <label data-rule-label hidden>分组规则（JSON）
          <textarea class="field-input" data-rules rows="3" placeholder='[{"table":"stories","path":"chapters/stories.json"}]'></textarea>
        </label>
        <div class="file-layout-bar" data-adjust hidden>
          <select class="field-input" data-adjust-item aria-label="要调整的来源"></select>
          <input class="field-input" data-adjust-path placeholder="目标相对路径" aria-label="目标相对路径">
          <button type="button" class="btn" data-adjust-apply>调整路径</button>
        </div>
        <p data-result role="status"></p><div data-preview></div>
      </section>
    </div>
    <footer class="file-layout-bar file-layout-actions">
      <button type="button" class="btn" data-cancel>取消</button>
      <button type="button" class="btn" data-export disabled>确认并导出 ZIP 副本</button>
    </footer>`;
  const query = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-${name}]`)!;
  const mode = query<HTMLSelectElement>('mode');
  const confirm = query<HTMLButtonElement>('export');
  const sourceTree = query('source-tree');
  const preview = query('preview');
  const message = query('result');
  const adjustItem = query<HTMLSelectElement>('adjust-item');
  const adjustPath = query<HTMLInputElement>('adjust-path');
  let project: ProjectRead | undefined;
  let sourceName = '';
  let generation = 0;
  let busy = false;
  let files = new Set<string>();
  let rows = new Set<string>();
  let overrides = new Map<string, string>();
  let latest: ReturnType<typeof planProjectLayout> | undefined;

  function setSource(next: ProjectRead | undefined, name = ''): void {
    generation++;
    project = next;
    sourceName = name;
    files = new Set();
    rows = new Set();
    overrides = new Map();
    query<HTMLInputElement>('compatible').checked = false;
    renderSource();
    refresh();
  }

  function renderSource(): void {
    sourceTree.replaceChildren();
    if (!project) return;
    const byFile = new Map<string, typeof project.definitions>();
    for (const row of project.definitions) {
      if (!byFile.has(row.source.path)) byFile.set(row.source.path, []);
      byFile.get(row.source.path)!.push(row);
    }
    renderPaths(sourceTree, project.files.map(file => file.path), (parent, path, name) => {
      const file = project?.files.find(item => item.path === path);
      const sourceRows = byFile.get(path) ?? [];
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      if (file?.role === 'definition') summary.append(selection(files, path, `选择文件 ${path}`));
      summary.append(name);
      details.append(summary);
      for (const row of sourceRows) {
        const line = document.createElement('label');
        if (isListField(row.table)) line.append(selection(rows, row.occurrenceId, `选择 ${path}${row.source.documentPointer}`));
        line.append(`${row.table} · ${projectEntityKey(row.value) ?? row.source.documentPointer}`);
        details.append(line);
      }
      parent.append(details);
    });
  }

  function selection(set: Set<string>, key: string, label: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('aria-label', label);
    input.addEventListener('click', event => event.stopPropagation());
    input.onchange = () => { if (input.checked) set.add(key); else set.delete(key); refresh(); };
    return input;
  }

  function request(): LayoutRequest {
    const by = mode.value;
    if (by === 'all' || by === 'selected') {
      return {
        kind: 'merge', target: query<HTMLInputElement>('merge-target').value.trim() || 'content.json',
        ...(by === 'all' ? { compatible: query<HTMLInputElement>('compatible').checked } : { files: [...files], occurrences: [...rows] }),
      };
    }
    const selectedOverrides = Object.fromEntries(overrides);
    if (by === 'table' || by === 'entity') return { kind: 'split', by, overrides: selectedOverrides };
    const raw = query<HTMLTextAreaElement>('rules').value.trim();
    const rules: LayoutRule[] | undefined = raw && by !== 'type' ? JSON.parse(raw) as LayoutRule[] : undefined;
    if (rules && !Array.isArray(rules)) throw new Error('分组规则必须为数组。');
    return { kind: 'group', by: by as Grouping, rules, overrides: selectedOverrides };
  }

  function refresh(): void {
    generation++;
    latest = undefined;
    confirm.disabled = true;
    preview.replaceChildren();
    message.textContent = '';
    query('source').textContent = project
      ? `来源：${sourceName} · 使用导入时的原文件。${callbacks.hasEdits() ? ' 当前表单修改不参与转换。' : ''}`
      : '打开目录、ZIP 或单个 JSON，开始组织文件。';
    const merging = mode.value === 'all' || mode.value === 'selected';
    query('merge-label').hidden = !merging;
    query('compat-label').hidden = mode.value !== 'all' || !project?.manifest;
    query('rule-label').hidden = merging || ['table', 'entity', 'type'].includes(mode.value);
    query('adjust').hidden = merging || project?.status !== 'complete';
    if (!project) return;
    try { latest = planProjectLayout(project, request()); }
    catch (error) { message.textContent = error instanceof Error ? error.message : String(error); return; }
    const plan = latest;
    const previous = adjustItem.value;
    adjustItem.replaceChildren(new Option('选择文件或实体', ''));
    const filePaths = new Set(plan.placements.map(item => item.source.path));
    for (const path of filePaths) adjustItem.add(new Option(path, path));
    const labels = new Map(project.definitions.map(row => [row.occurrenceId, projectEntityKey(row.value) ?? row.source.documentPointer ?? row.table]));
    for (const item of plan.placements) {
      adjustItem.add(new Option(`${item.source.path} · ${labels.get(item.occurrenceId)}`, item.occurrenceId));
    }
    adjustItem.value = previous;
    const targets = new Map<string, string[]>();
    for (const item of plan.placements) {
      if (!targets.has(item.path)) targets.set(item.path, []);
      targets.get(item.path)!.push(`${labels.get(item.occurrenceId)} · ${item.reason}`);
    }
    const paths = plan.archive?.entries.map(entry => entry.path) ?? [...new Set([...plan.retained, ...targets.keys()])];
    renderPaths(preview, paths, (parent, path, name) => {
      const placements = targets.get(path);
      if (!placements) { parent.textContent = name; return; }
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `${name} (${placements.length})`;
      details.append(summary);
      for (const text of placements) {
        const line = document.createElement('div');
        line.textContent = text;
        details.append(line);
      }
      parent.append(details);
    });
    const diagnostics = plan.diagnostics.map(item => `${item.path}：${item.message}`);
    if (plan.omitted.length) diagnostics.push(`发行副本排除作者附属文件：${plan.omitted.join('、')}`);
    if (plan.requiresLayoutReader) diagnostics.push('此副本保留作者布局，兼容发行需另行全合。');
    message.textContent = diagnostics.join('\n');
    confirm.disabled = busy || !plan.archive;
  }

  let importNonce = 0;
  async function open(input: HTMLInputElement, directory: boolean): Promise<void> {
    const picked = [...input.files ?? []];
    if (!picked.length) return;
    input.value = '';
    const token = ++importNonce;
    busy = true;
    confirm.disabled = true;
    try {
      const opened = await readEditorProject(picked, directory);
      if (token !== importNonce) return;
      busy = false;
      setSource(opened, directory ? picked[0].webkitRelativePath.split('/')[0] : picked[0].name);
    } catch (error) {
      if (token !== importNonce) return;
      busy = false;
      refresh();
      message.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  query<HTMLButtonElement>('open').onclick = () => query<HTMLInputElement>('file').click();
  query<HTMLButtonElement>('directory').onclick = () => query<HTMLInputElement>('files').click();
  query<HTMLInputElement>('file').onchange = event => { void open(event.currentTarget as HTMLInputElement, false); };
  query<HTMLInputElement>('files').onchange = event => { void open(event.currentTarget as HTMLInputElement, true); };
  mode.onchange = () => { overrides.clear(); refresh(); };
  query<HTMLInputElement>('compatible').onchange = refresh;
  query<HTMLInputElement>('merge-target').oninput = refresh;
  query<HTMLTextAreaElement>('rules').onchange = refresh;
  query<HTMLButtonElement>('adjust-apply').onclick = () => {
    if (!adjustItem.value) return;
    const path = adjustPath.value.trim();
    if (path) overrides.set(adjustItem.value, path);
    else overrides.delete(adjustItem.value);
    refresh();
  };
  query<HTMLButtonElement>('cancel').onclick = callbacks.close;
  confirm.onclick = async () => {
    if (!latest?.archive || busy) return;
    const token = generation;
    const archive = latest.archive;
    confirm.disabled = true;
    try {
      const bytes = await writeZipArchive(archive);
      if (token === generation && !root.hidden) downloadProjectZip(bytes, `${project?.manifest?.modName ?? 'datapack'}-layout.zip`);
    } catch (error) {
      if (token === generation) message.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      if (token === generation) confirm.disabled = false;
    }
  };
  return { setSource, refresh };
}

function renderPaths(
  root: HTMLElement, paths: readonly string[], renderFile: (parent: HTMLElement, path: string, name: string) => void,
): void {
  const list = document.createElement('ul');
  const directories = new Map<string, HTMLElement>([['', list]]);
  for (const path of [...paths].sort((a, b) => a.localeCompare(b, 'en'))) {
    const segments = path.split('/');
    let prefix = '';
    let parent: HTMLElement = list;
    for (const segment of segments.slice(0, -1)) {
      prefix += `${segment}/`;
      let directory = directories.get(prefix);
      if (!directory) {
        const item = document.createElement('li');
        const details = document.createElement('details');
        details.open = true;
        const summary = document.createElement('summary');
        summary.textContent = segment;
        directory = document.createElement('ul');
        details.append(summary, directory);
        item.append(details);
        parent.append(item);
        directories.set(prefix, directory);
      }
      parent = directory;
    }
    const item = document.createElement('li');
    renderFile(item, path, segments[segments.length - 1]);
    parent.append(item);
  }
  root.append(list);
}
