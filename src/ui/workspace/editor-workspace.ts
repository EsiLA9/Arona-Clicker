import type { WorkspaceSlot } from '../components/shared/workspace-frame';
import type { UIContext } from '../runtime/context';
import { LocalStorageAdapter } from '../../data-services/persistence/storage-adapter';

export type EditorWorkspaceMode = 'classic' | 'advanced';
export type EditorWorkspaceView = 'three' | 'browse' | 'focus';
export type EditorWorkspaceEdge = 'left' | 'right';
type EditorRibbonDensity = 'compact' | 'expanded';

const preferencesKey = 'acprogram.editor-workspace.v1';
const layoutKey = 'acprogram.editor-layout.v1';
const storage = new LocalStorageAdapter();
const workspaceViews = { three: '三栏', browse: '双栏查阅', focus: '专注正文' } as const;
export const editorDefaultWidths = { left: 300, right: 320 };
export const editorWidth = (width: number): number => Math.max(150, Math.min(720, Math.round(width)));

export interface EditorLayoutState {
  mode: EditorWorkspaceMode;
  ribbon: EditorRibbonDensity;
  view: EditorWorkspaceView;
  widths: Record<EditorWorkspaceEdge, number>;
}

const defaults = (): EditorLayoutState => ({ mode: 'classic', ribbon: 'expanded', view: 'three', widths: { ...editorDefaultWidths } });

function preferenceRecord(key: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(storage.get(key) ?? 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

function applyRecord(state: EditorLayoutState, record: Record<string, unknown> | undefined): void {
  if (!record) return;
  if (record.mode === 'advanced' || record.mode === 'classic') state.mode = record.mode;
  if (record.ribbon === 'compact' || record.ribbon === 'expanded') state.ribbon = record.ribbon;
  if (record.view === 'three' || record.view === 'browse' || record.view === 'focus') state.view = record.view;
  const widths = record.widths && typeof record.widths === 'object' ? record.widths as Record<string, unknown> : {};
  for (const edge of ['left', 'right'] as const) {
    if (typeof widths[edge] === 'number' && Number.isFinite(widths[edge])) state.widths[edge] = editorWidth(widths[edge]);
  }
}

function persistLayout(state: EditorLayoutState): void {
  try { storage.set(layoutKey, JSON.stringify(state)); }
  catch { /* Layout remains usable with session-only preferences. */ }
}

export class EditorLayoutService {
  private value = defaults();

  constructor() {
    const current = preferenceRecord(layoutKey);
    if (current) applyRecord(this.value, current);
    else {
      // Deterministic one-time migration: Story wins field by field; World fills its gaps.
      applyRecord(this.value, preferenceRecord(`${preferencesKey}.world`));
      applyRecord(this.value, preferenceRecord(`${preferencesKey}.story`));
      persistLayout(this.value);
    }
    for (const workType of ['story', 'world']) {
      try { storage.remove(`${preferencesKey}.${workType}`); } catch { /* Ignore unavailable storage. */ }
    }
  }

  get state(): Readonly<EditorLayoutState> {
    return { ...this.value, widths: { ...this.value.widths } };
  }

  setMode(mode: EditorWorkspaceMode): void { this.value.mode = mode; persistLayout(this.value); }
  setView(view: EditorWorkspaceView): void { this.value.view = view; persistLayout(this.value); }
  revealLeft(): void {
    if (this.value.view === 'focus') this.setView('browse');
  }
  setRibbon(ribbon: EditorRibbonDensity, persist = true): void {
    this.value.ribbon = ribbon;
    if (persist) persistLayout(this.value);
  }
  setWidth(edge: EditorWorkspaceEdge, width: number, persist = true): void {
    this.value.widths[edge] = editorWidth(width);
    if (persist) persistLayout(this.value);
  }
}

export const editorLayout = new EditorLayoutService();

const editorCenterMinWidth = 340;
const editorPaneInsetTotal = 12;

export function actualEditorWidths(stageWidth: number, widths: EditorLayoutState['widths'], view: EditorWorkspaceView): EditorLayoutState['widths'] {
  if (view === 'focus') return { left: 0, right: 0 };
  const available = Math.max(0, stageWidth - editorCenterMinWidth - editorPaneInsetTotal);
  if (view === 'browse') return { left: Math.min(widths.left, available), right: 0 };
  const total = widths.left + widths.right;
  if (total <= available || total === 0) return { ...widths };
  const scale = available / total;
  return { left: widths.left * scale, right: widths.right * scale };
}

export interface EditorWorkspaceChrome {
  layout: Readonly<EditorLayoutState>;
  viewOverride?: EditorWorkspaceView;
  temporaryView: boolean;
  instancesVisible?: boolean;
  edges: readonly EditorWorkspaceEdge[];
  workTypes: readonly { id: string; name: string; icon: string; active: boolean }[];
  instances: readonly { id: number; title: string; typeLabel?: string; label?: string; icon?: string; active: boolean }[];
  canDuplicate: boolean;
  commands: string;
  status: string;
}

const toolPaths = {
  open: 'M2.5 7V5h7l2 2h8v3M2.5 7v12h16l3-9H7l-3 9',
  new: 'M13 3H5v18h14V9l-6-6v6h6M8 14h8m-4-4v8',
  save: 'M4 3h13l3 3v15H4zM7 3v6h9V3M8 21v-8h8v8',
  play: 'M8 4v16l13-8z',
  check: 'M14 3H5v18h14V8l-5-5v5h5M8 14l2.5 2.5L16 11',
  pack: 'M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9m-5-16 9 5',
  apply: 'M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6',
  layout: 'M3 4h18v16H3zM8 4v16m8-16v16',
  mode: 'M4 4h16v12H4zM8 20h8m-4-4v4',
  locate: 'M12 3v4m0 10v4M3 12h4m10 0h4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  edit: 'm4 20 1-5L16 4l4 4L9 19l-5 1M14 6l4 4',
  trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  back: 'm10 5-7 7 7 7M3 12h17',
  exit: 'M10 20H4V4h6m-1 8h12m-5-5 5 5-5 5',
  restart: 'M4 11a8 8 0 1 1 2 7M4 5v6h6',
  stop: 'M6 6h12v12H6z',
} as const;

export function editorToolIcon(icon: keyof typeof toolPaths): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${toolPaths[icon]}"/></svg>`;
}

export function renderEditorTool(ctx: UIContext, icon: keyof typeof toolPaths, label: string, action: string,
  options: { kind?: 'editor' | 'authoring' | 'workspace'; large?: boolean; reason?: string; key?: string } = {}): string {
  const e = ctx.escapeHtml;
  return `<button type="button" class="editor-workspace__tool${options.large ? ' editor-workspace__tool--large' : ''}"
    data-${options.kind === 'authoring' ? 'authoring' : options.kind === 'editor' ? 'editor' : 'editor-workspace'}-action="${e(action)}"
    data-editor-key="${e(options.key ?? `ribbon:${action}`)}"${options.reason ? ` disabled title="${e(options.reason)}"` : ''}>${editorToolIcon(icon)}<span>${e(label)}</span></button>`;
}

export function renderEditorToolGroup(label: string, tools: string): string {
  return `<div class="editor-workspace__group" role="group" aria-label="${label}" data-editor-key="ribbon-group:${label}">
    <div class="editor-workspace__group-body">${tools}</div><span class="editor-workspace__group-label" aria-hidden="true">${label}</span>
  </div>`;
}

export function editorWorkspaceEdges(slots: readonly WorkspaceSlot[]): EditorWorkspaceEdge[] {
  return slots.filter((slot): slot is EditorWorkspaceEdge => slot !== 'center');
}

export function editorWorkspaceViews(edges: readonly EditorWorkspaceEdge[]): EditorWorkspaceView[] {
  const views: EditorWorkspaceView[] = [];
  if (edges.includes('right')) views.push('three');
  if (edges.includes('left')) views.push('browse');
  views.push('focus');
  return views;
}

export function editorWorkspaceView(edges: readonly EditorWorkspaceEdge[], view: EditorWorkspaceView): EditorWorkspaceView {
  const views = editorWorkspaceViews(edges);
  return views.includes(view) ? view : views[0];
}

export function editorWorkspaceViewAttributes(spec: EditorWorkspaceChrome) {
  const view = editorWorkspaceView(spec.edges, spec.viewOverride ?? spec.layout.view);
  return {
    'data-editor-workspace-mode': spec.layout.mode,
    'data-editor-workspace-view': view,
    'data-editor-workspace-temporary': String(spec.temporaryView),
  };
}

export function applyEditorWorkspaceWidths(shell: HTMLElement, layout = editorLayout.state, view?: EditorWorkspaceView): void {
  const stage = shell.querySelector<HTMLElement>('.editor-workspace__stage');
  const effective = editorWorkspaceView(['left', 'right'], view ?? layout.view);
  const widths = actualEditorWidths(stage?.clientWidth ?? 0, layout.widths, effective);
  shell.style.setProperty('--editor-left-width', `${layout.widths.left}px`);
  shell.style.setProperty('--editor-right-width', `${layout.widths.right}px`);
  shell.style.setProperty('--editor-track-left', `${widths.left}px`);
  shell.style.setProperty('--editor-track-right', `${widths.right}px`);
}

export function bindEditorWorkspaceResize(root: HTMLElement, signal: AbortSignal): void {
  const shellFor = () => root.matches('[data-editor-workspace]') ? root : root.querySelector<HTMLElement>('[data-editor-workspace]');
  const view = (shell: HTMLElement) => editorWorkspaceView(['left', 'right'], shell.dataset.editorWorkspaceView as EditorWorkspaceView);
  let observedStage: HTMLElement | undefined;
  const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
    const shell = shellFor();
    if (shell) applyEditorWorkspaceWidths(shell, editorLayout.state, view(shell));
  });
  const observeShell = (): void => {
    const shell = shellFor();
    if (!shell) return;
    applyEditorWorkspaceWidths(shell, editorLayout.state, view(shell));
    const stage = shell.querySelector<HTMLElement>('.editor-workspace__stage');
    if (stage && stage !== observedStage) {
      if (observedStage) resizeObserver?.unobserve(observedStage);
      observedStage = stage;
      resizeObserver?.observe(stage);
    }
  };
  const mutationObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(observeShell);
  mutationObserver?.observe(root, { childList: true, subtree: true });
  observeShell();
  signal.addEventListener('abort', () => { mutationObserver?.disconnect(); resizeObserver?.disconnect(); }, { once: true });
  bindRibbonResize(root, signal);
  const options = { signal };
  let drag: { shell: HTMLElement; handle: HTMLElement; pointerId: number; edge: EditorWorkspaceEdge; start: number; width: number; max: number; original: number } | undefined;
  const splitter = (event: Event) => event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-editor-workspace-edge]') : null;
  const advancedShell = (handle: HTMLElement | null) => handle?.closest<HTMLElement>(
    '[data-editor-workspace-mode="advanced"][data-editor-workspace-temporary="false"]',
  );
  root.addEventListener('pointerdown', event => {
    const handle = splitter(event);
    const shell = advancedShell(handle);
    if (!shell || !handle || event.button !== 0 || drag) return;
    const edge = handle.dataset.editorWorkspaceEdge as EditorWorkspaceEdge;
    const stage = handle.parentElement!;
    const column = stage.querySelector<HTMLElement>(`.workspace-column--${edge}`);
    if (!column) return;
    const visibleEdges = [...stage.querySelectorAll<HTMLElement>('[data-editor-workspace-edge]')]
      .filter(splitter => getComputedStyle(splitter).display !== 'none').length;
    if (!visibleEdges || getComputedStyle(handle).display === 'none') return;
    const actual = actualEditorWidths(stage.clientWidth, editorLayout.state.widths, view(shell));
    const width = actual[edge];
    const available = Math.max(150, stage.clientWidth - editorCenterMinWidth - editorPaneInsetTotal);
    const other: EditorWorkspaceEdge = edge === 'left' ? 'right' : 'left';
    const max = Math.min(720, available - actual[other]);
    if (!width || max < 150) return;
    handle.setPointerCapture?.(event.pointerId);
    handle.dataset.dragging = '';
    drag = { shell, handle, pointerId: event.pointerId, edge, max, width, start: event.clientX, original: editorLayout.state.widths[edge] };
    event.preventDefault();
  }, options);
  root.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId || !drag.handle.isConnected) return;
    const delta = (event.clientX - drag.start) * (drag.edge === 'left' ? 1 : -1);
    editorLayout.setWidth(drag.edge, Math.min(drag.max, drag.width + delta), false);
    applyEditorWorkspaceWidths(drag.shell, editorLayout.state, view(drag.shell));
  }, options);
  const end = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    delete drag.handle.dataset.dragging;
    if (event.type === 'pointercancel') {
      editorLayout.setWidth(drag.edge, drag.original, false);
      applyEditorWorkspaceWidths(drag.shell, editorLayout.state, view(drag.shell));
    } else persistLayout(editorLayout.state as EditorLayoutState);
    drag = undefined;
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) root.addEventListener(type, end, options);
  root.addEventListener('dblclick', event => {
    const handle = splitter(event);
    const shell = advancedShell(handle);
    if (!shell || !handle) return;
    const edge = handle.dataset.editorWorkspaceEdge as EditorWorkspaceEdge;
    editorLayout.setWidth(edge, editorDefaultWidths[edge]);
    applyEditorWorkspaceWidths(shell, editorLayout.state, view(shell));
  }, options);
}

function ribbonGripValue(ribbon: EditorRibbonDensity) {
  return ribbon === 'expanded' ? { value: '1', label: '展开' } : { value: '0', label: '紧凑' };
}

function bindRibbonResize(root: HTMLElement, signal: AbortSignal): void {
  const options = { signal };
  const gripFor = (event: Event) => event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-editor-workspace-ribbon-grip]') : null;
  let drag: { grip: HTMLElement; pointerId: number; start: number; original: EditorRibbonDensity } | undefined;
  const set = (grip: HTMLElement, ribbon: EditorRibbonDensity): void => {
    editorLayout.setRibbon(ribbon, false);
    grip.closest('[data-editor-workspace-header]')?.setAttribute('data-editor-workspace-ribbon', ribbon);
    const { value, label } = ribbonGripValue(ribbon);
    grip.setAttribute('aria-valuenow', value);
    grip.setAttribute('aria-valuetext', label);
  };
  root.addEventListener('pointerdown', event => {
    const grip = gripFor(event);
    if (!grip || event.button !== 0 || drag) return;
    grip.setPointerCapture?.(event.pointerId);
    drag = { grip, pointerId: event.pointerId, start: event.clientY, original: editorLayout.state.ribbon };
    event.preventDefault();
  }, options);
  root.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId || !drag.grip.isConnected) return;
    const delta = event.clientY - drag.start;
    const ribbon = delta >= 20 ? 'expanded' : delta <= -20 ? 'compact' : drag.original;
    if (ribbon !== editorLayout.state.ribbon) set(drag.grip, ribbon);
  }, options);
  const end = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.type === 'pointercancel') set(drag.grip, drag.original);
    else if (editorLayout.state.ribbon !== drag.original) persistLayout(editorLayout.state as EditorLayoutState);
    drag = undefined;
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) root.addEventListener(type, end, options);
  root.addEventListener('keydown', event => {
    const grip = gripFor(event);
    if (!grip || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    set(grip, event.key === 'ArrowUp' ? 'compact' : 'expanded');
    persistLayout(editorLayout.state as EditorLayoutState);
  }, options);
}

export function renderEditorWorkspaceRegions(ctx: UIContext, spec: EditorWorkspaceChrome) {
  const e = ctx.escapeHtml;
  const advanced = spec.layout.mode === 'advanced';
  const view = spec.temporaryView ? '' : `<label class="editor-workspace__tool editor-workspace__view">
    ${editorToolIcon('layout')}<select data-editor-workspace-view-select aria-label="浏览视图">${editorWorkspaceViews(spec.edges).map(value => `<option value="${value}"${value === editorWorkspaceView(spec.edges, spec.viewOverride ?? spec.layout.view) ? ' selected' : ''}>${workspaceViews[value]}</option>`).join('')}</select></label>`;
  const mode = renderEditorTool(ctx, 'mode', '经典模式', 'mode', { key: 'editor-workspace-mode' });
  const exit = spec.temporaryView ? '' : renderEditorTool(ctx, 'exit', '退出编辑器', 'back');
  const ribbon = spec.layout.ribbon;
  const grip = ribbonGripValue(ribbon);
  return {
    header: `<header class="editor-workspace__header" data-editor-workspace-header${advanced ? ` data-editor-workspace-ribbon="${ribbon}"` : ''}>
      ${advanced ? `<div class="editor-workspace__ribbon" data-editor-key="ribbon-tools">${spec.commands}${renderEditorToolGroup('工作区', `<div class="editor-workspace__tool-stack">${view}${mode}${exit}</div>`)}</div>
        <div class="editor-workspace__ribbon-grip" data-editor-workspace-ribbon-grip data-editor-key="ribbon-grip"
          role="separator" tabindex="0" aria-orientation="horizontal" aria-label="工具栏高度" aria-valuemin="0" aria-valuemax="1"
          aria-valuenow="${grip.value}" aria-valuetext="${grip.label}" title="向下拖动展开，向上拖动收起"></div>`
        : '<button type="button" class="mini-action editor-workspace__mode" data-editor-workspace-action="mode" data-editor-key="editor-workspace-mode">高级模式</button>'}
    </header>`,
    documents: `<nav class="editor-workspace__documents" data-editor-workspace-documents aria-label="浏览实例"${advanced && (!spec.temporaryView || spec.instancesVisible) ? '' : ' hidden'}>
        ${advanced && (!spec.temporaryView || spec.instancesVisible) ? `
          ${spec.instances.map(item => {
            const name = e(item.typeLabel ? `${item.typeLabel} · ${item.title}` : item.title);
            return `<div class="editor-workspace__document" data-editor-key="browse-instance:${item.id}" data-current="${item.active}">
              <button type="button" class="mini-action" data-editor-workspace-action="activate" data-editor-instance="${item.id}" aria-label="${name}" aria-pressed="${item.active}" title="${e(item.label ?? item.title)}">${item.icon ?? ''}<span class="editor-workspace__document-title">${e(item.title)}</span></button>
              <button type="button" class="mini-action" data-editor-workspace-action="close" data-editor-instance="${item.id}" aria-label="关闭 ${name}" title="关闭实例">×</button>
            </div>`;
          }).join('')}
          ${spec.temporaryView ? '' : `<button type="button" class="mini-action" data-editor-workspace-action="duplicate"${spec.canDuplicate ? '' : ' disabled'} title="在新实例中打开当前内容">＋ 新建实例</button>`}` : ''}
    </nav>`,
    rail: `<nav class="editor-workspace__rail" data-editor-workspace-rail aria-label="工作类型"${advanced && (spec.temporaryView || editorWorkspaceView(spec.edges, spec.viewOverride ?? spec.layout.view) !== 'focus') ? '' : ' hidden'}>${spec.workTypes.map(type => `
      <button type="button" class="editor-workspace__work-type" data-editor-workspace-action="work-type" data-editor-work-type="${e(type.id)}" title="${e(type.name)}" aria-label="${e(type.name)}" aria-pressed="${type.active}">${type.icon}</button>`).join('')}</nav>`,
    status: `<footer class="editor-workspace__status" data-editor-workspace-status${advanced ? '' : ' hidden'}>${spec.status}</footer>`,
  };
}

export function renderEditorWorkspace(ctx: UIContext, spec: EditorWorkspaceChrome, frame: string): string {
  const { header, documents, rail, status } = renderEditorWorkspaceRegions(ctx, spec);
  const attributes = Object.entries(editorWorkspaceViewAttributes(spec)).map(([key, value]) => `${key}="${value}"`).join(' ');
  return `<section class="editor-workspace" data-editor-workspace ${attributes}
    style="--editor-left-width:${spec.layout.widths.left}px;--editor-right-width:${spec.layout.widths.right}px;--editor-track-left:${spec.layout.widths.left}px;--editor-track-right:${spec.layout.widths.right}px;--editor-track-center:minmax(0,1fr)">
    <div class="editor-workspace__top">${header}${documents}</div>
    <div class="editor-workspace__body">
      ${rail}
      <div class="editor-workspace__stage">
        <div class="editor-workspace__frame" data-editor-workspace-frame-host>${frame}</div>
        ${spec.edges.map(edge => `<div class="editor-workspace__splitter" data-editor-workspace-edge="${edge}" role="separator" aria-orientation="vertical" aria-label="调整${edge === 'left' ? '导航' : '属性'}栏宽度" title="拖动调整栏宽度，双击复位"></div>`).join('')}
      </div>
    </div>
    ${status}
  </section>`;
}
