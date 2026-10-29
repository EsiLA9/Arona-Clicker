import type { UIContext } from '../runtime/context';
import { captureFocusWithin, restoreFocusWithin } from '../interaction/focus';
import { bindColumnActions } from './column-actions';
import { renderWorkspaceColumn, renderWorkspaceFrame, workspaceColumns, workspaceScope, columnInstanceId, type WorkspaceColumnSpec, type WorkspaceFrameSpec } from '../components/shared/workspace-frame';
import { workspaceColumnScrollTargets } from '../interaction/workspace-scroll';

export interface ColumnToken { readonly instanceId: string; readonly generation: number }
interface MountedColumn {
  node: HTMLElement;
  ctx: UIContext;
  spec: WorkspaceColumnSpec;
  markup: string;
  token: ColumnToken;
  cleanup: () => void;
  workspaceBack?: (() => void) | null;
}

function chatStreamIdentity(host: HTMLElement): string {
  const stream = host.dataset.flowStreamKey?.trim();
  if (stream) return stream;
  const owner = host.closest<HTMLElement>('[data-chat-owner]')?.dataset.chatOwner?.trim();
  return owner ? `conversation:${owner}` : 'chat:global';
}

export interface ColumnMountOptions {
  onBack?: (() => void) | null;
}
export interface ColumnMutationHooks {
  beforeReplace?: (root: HTMLElement) => void;
  afterReplace?: (root: HTMLElement) => void;
}

/** Keyed DOM ownership only. Scheduling and business commands stay with the caller. */
export class WorkspaceColumns {
  private readonly mounted = new Map<string, MountedColumn>();
  private generation = 0;

  constructor(private readonly hooks: ColumnMutationHooks = {}) {}

  token(instanceId: string): ColumnToken | undefined { return this.mounted.get(instanceId)?.token; }
  node(instanceId: string): HTMLElement | undefined { return this.mounted.get(instanceId)?.node; }
  spec(instanceId: string): WorkspaceColumnSpec | undefined { return this.mounted.get(instanceId)?.spec; }
  ids(): string[] { return [...this.mounted.keys()]; }

  private create(ctx: UIContext, scope: string, spec: WorkspaceColumnSpec): HTMLElement {
    const template = document.createElement('template');
    template.innerHTML = renderWorkspaceColumn(ctx, spec, scope);
    return template.content.firstElementChild as HTMLElement;
  }

  private bind(node: HTMLElement, ctx: UIContext, scope: string, spec: WorkspaceColumnSpec, workspaceBack: (() => void) | null = null): MountedColumn {
    const id = columnInstanceId(scope, spec);
    const record: MountedColumn = { node, ctx, spec, workspaceBack, markup: renderWorkspaceColumn(ctx, spec, scope), token: { instanceId: id, generation: ++this.generation }, cleanup: () => {} };
    const back = (event: Event): void => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest(record.spec.backSelector ?? '[data-column-back], [data-workspace-back]');
      if (!button || button.closest('[data-column-instance]') !== node) return;
      const action = record.spec.onBack === undefined ? record.workspaceBack : record.spec.onBack;
      event.preventDefault();
      event.stopImmediatePropagation();
      action?.();
    };
    node.addEventListener('click', back, true);
    const unbindActions = bindColumnActions(node, () => record.spec.actions ?? {});
    const dispose = spec.bind?.(node);
    record.cleanup = () => { node.removeEventListener('click', back, true); unbindActions(); dispose?.(); };
    this.mounted.set(id, record);
    this.backVisibility(record);
    return record;
  }

  private backVisibility(record: MountedColumn): void {
    // Navigation belongs to this mount, including explicit disabling via null.
    const action = record.spec.onBack === undefined ? record.workspaceBack : record.spec.onBack;
    record.node.querySelectorAll<HTMLElement>(record.spec.backSelector ?? '[data-column-back], [data-workspace-back]').forEach(node => { node.hidden = !action; });
  }

  /** Attach to string-rendered game DOM; no second render or scheduling system. */
  adopt(root: ParentNode, ctx: UIContext, spec: WorkspaceFrameSpec): void {
    for (const column of workspaceColumns(spec).filter(item => item.visible !== false)) {
      const id = columnInstanceId(workspaceScope(spec), column);
      const node = [...root.querySelectorAll<HTMLElement>('[data-column-instance]')].find(item => item.dataset.columnInstance === id);
      if (!node) continue;
      const current = this.mounted.get(id);
      if (current?.node === node && current.spec.bindingKey === column.bindingKey && current.spec.definitionId === column.definitionId) {
        current.spec = column;
        current.ctx = ctx;
        current.workspaceBack = spec.onBack;
        this.backVisibility(current);
      } else {
        current?.cleanup();
        this.bind(node, ctx, workspaceScope(spec), column, spec.onBack);
      }
    }
    this.releaseDetached();
  }

  /** Reorder and resize existing keyed roots; render only new or changed content. */
  mount(root: HTMLElement, ctx: UIContext, spec: WorkspaceFrameSpec): void {
    const columns = workspaceColumns(spec).filter(item => item.visible !== false);
    const template = document.createElement('template');
    template.innerHTML = renderWorkspaceFrame(ctx, { ...spec, columns });
    const nextFrame = template.content.firstElementChild as HTMLElement;
    let frame = [...root.children].find(node => node.getAttribute('data-workspace-instance') === workspaceScope(spec)) as HTMLElement | undefined;
    if (!frame) {
      this.releaseWithin(root);
      this.hooks.beforeReplace?.(root);
      root.replaceChildren(nextFrame);
      frame = nextFrame;
      this.adopt(root, ctx, spec);
      this.hooks.afterReplace?.(root);
      return;
    }
    const active = document.activeElement instanceof HTMLElement && frame.contains(document.activeElement) ? document.activeElement : null;
    const expected = new Set(columns.map(column => columnInstanceId(workspaceScope(spec), column)));
    const overlayNodes = [...frame.children].filter(node => !node.hasAttribute('data-column-instance'));
    const nextOverlays = [...nextFrame.children].filter(node => !node.hasAttribute('data-column-instance'));
    const retainOverlay = overlayNodes.map(node => node.outerHTML).join('') === nextOverlays.map(node => node.outerHTML).join('');
    for (const node of [...frame.children]) {
      const id = node.getAttribute('data-column-instance');
      if (id && expected.has(id)) continue;
      if (!id && retainOverlay) continue;
      this.hooks.beforeReplace?.(node as HTMLElement);
      if (id) this.release(id);
      node.remove();
    }
    columns.forEach((column, index) => {
      const id = columnInstanceId(workspaceScope(spec), column);
      let current = this.mounted.get(id);
      if (current && current.node.parentElement !== frame) { this.release(id); current = undefined; }
      if (current) {
        current.ctx = ctx;
        current.workspaceBack = spec.onBack;
        const markup = renderWorkspaceColumn(ctx, column, workspaceScope(spec));
        if (current.markup !== markup || current.spec.bindingKey !== column.bindingKey || current.spec.definitionId !== column.definitionId) this.update(id, column, current.token, ctx);
        else { current.spec = column; current.workspaceBack = spec.onBack; this.backVisibility(current); }
      } else {
        const node = this.create(ctx, workspaceScope(spec), column);
        frame!.append(node);
        this.bind(node, ctx, workspaceScope(spec), column, spec.onBack);
        this.hooks.afterReplace?.(node);
      }
      const node = this.mounted.get(id)!.node;
      if (frame!.children[index] !== node) frame!.insertBefore(node, frame!.children[index] ?? null);
    });
    frame.style.gridTemplateColumns = nextFrame.style.gridTemplateColumns;
    if (!retainOverlay) for (const child of nextOverlays) frame.append(child);
    if (active?.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
  }

  mountColumn(root: HTMLElement, ctx: UIContext, instanceId: string, spec: WorkspaceColumnSpec, options: ColumnMountOptions = {}): void {
    const slash = instanceId.lastIndexOf('/');
    const scope = slash >= 0 ? instanceId.slice(0, slash) : 'embedded';
    const key = slash >= 0 ? decodeURIComponent(instanceId.slice(slash + 1)) : instanceId;
    this.releaseWithin(root);
    this.hooks.beforeReplace?.(root);
    const column = { ...spec, key, onBack: options.onBack === undefined ? spec.onBack : options.onBack };
    const node = this.create(ctx, scope, column);
    root.replaceChildren(node);
    this.bind(node, ctx, scope, column);
    this.hooks.afterReplace?.(node);
  }

  update(instanceId: string, spec: WorkspaceColumnSpec, token?: ColumnToken, ctx?: UIContext): boolean {
    const current = this.mounted.get(instanceId);
    if (!current || (token && (token.instanceId !== instanceId || token.generation !== current.token.generation))) return false;
    const scope = instanceId.slice(0, instanceId.lastIndexOf('/'));
    if (columnInstanceId(scope, spec) !== instanceId) return false;
    const nextCtx = ctx ?? current.ctx;
    const next = this.create(nextCtx, scope, { ...spec, key: current.spec.key ?? decodeURIComponent(instanceId.slice(instanceId.lastIndexOf('/') + 1)) });
    const focus = captureFocusWithin(current.node);
    const positions = new Map([...workspaceColumnScrollTargets(current.node)].map(([key, node]) => [key, node.scrollTop]));
    const chatPositions = new Map([...current.node.querySelectorAll<HTMLElement>('.chat-stream')]
      .map(host => [chatStreamIdentity(host), host.scrollTop]));
    this.hooks.beforeReplace?.(current.node);
    current.cleanup();
    current.node.replaceWith(next);
    this.bind(next, nextCtx, scope, spec, current.workspaceBack);
    this.hooks.afterReplace?.(next);
    for (const [key, node] of workspaceColumnScrollTargets(next)) {
      const position = positions.get(key);
      if (position !== undefined) node.scrollTop = position;
    }
    for (const host of next.querySelectorAll<HTMLElement>('.chat-stream')) {
      const position = chatPositions.get(chatStreamIdentity(host));
      if (position !== undefined) host.scrollTop = position;
    }
    restoreFocusWithin(next, focus);
    return true;
  }

  release(instanceId: string): void {
    this.mounted.get(instanceId)?.cleanup();
    this.mounted.delete(instanceId);
  }
  releaseWithin(root: HTMLElement): void {
    for (const [id, item] of this.mounted) if (root.contains(item.node)) this.release(id);
  }
  releaseDetached(): void {
    for (const [id, item] of this.mounted) if (!item.node.isConnected) this.release(id);
  }
  dispose(): void { for (const id of this.mounted.keys()) this.release(id); }
}
