import type { MapActionRelation, MapTargetRef } from '../../arona-clicker/contracts/map-relations';
import { mapObjectKey, presentMapRelations } from './map-relation-presentation';

/** UI session only. All rules and current target identities come from the Owner. */
export class MapRelationInteraction {
  private pointer: HTMLElement | null = null;
  private focus: HTMLElement | null = null;
  private preferred: 'pointer' | 'focus' = 'pointer';
  private pinned: string | null = null;
  private context = '';
  private disposed = false;
  private editing: { key: string; version: string } | null = null;
  private drag: { key: string; x: number; y: number; pointerId: number; source: HTMLElement; active: boolean } | null = null;
  private drop: MapTargetRef | null = null;
  private ghost: HTMLElement | null = null;
  private suppressClickUntil = 0;
  private readonly listeners: [string, EventListener][] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly query: (runId: string) => readonly MapActionRelation[],
    private readonly previewReplacement?: (relation: MapActionRelation, actionId: string) => readonly MapActionRelation[],
    private readonly confirmTarget?: (relation: MapActionRelation, target: MapTargetRef) => void,
  ) {
    const listen = (name: string, listener: EventListener) => {
      this.listeners.push([name, listener]);
      root.addEventListener(name, listener, true);
    };
    listen('pointerover', event => { this.pointer = this.face(event.target); this.preferred = 'pointer'; this.reconcile(); });
    listen('pointerout', event => {
      this.pointer = this.face((event as PointerEvent).relatedTarget);
      this.reconcile();
    });
    listen('focusin', event => { this.focus = this.face(event.target); this.preferred = 'focus'; this.reconcile(); });
    listen('focusout', event => { this.focus = this.face((event as FocusEvent).relatedTarget); this.reconcile(); });
    listen('click', event => {
      if (performance.now() < this.suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const edit = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-map-target-edit]') : null;
      if (edit) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.editing?.key === edit.dataset.mapTargetEdit) this.cancelEdit();
        else this.beginEdit(edit.dataset.mapTargetEdit ?? '');
        this.reconcile(); return;
      }
      if (this.editing) {
        const hit = this.targetAt(event.target);
        if (hit) { event.preventDefault(); event.stopImmediatePropagation(); this.confirm(hit); return; }
        const replacement = event.target instanceof Element ? event.target.closest<HTMLElement>(
          '[data-map-hand-stack-toggle], [data-map-hand-picker] [data-map-action-swap], [data-map-hand-picker] [data-map-player-command]',
        ) : null;
        // Closing an existing Popover must still reach its normal lifecycle in beginEdit.
        if (replacement && !(replacement.hasAttribute('data-map-hand-stack-toggle') && replacement.getAttribute('aria-expanded') === 'true')) {
          event.preventDefault(); event.stopImmediatePropagation(); return;
        }
      }
      const cardChoice = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-map-card-target]') : null;
      if (cardChoice) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.editing) return; // A different source's picker cannot override the current edit lock.
        const relation = this.current().find(row => row.key === cardChoice.dataset.mapCardTarget);
        const target = relation?.candidates.find(ref => mapObjectKey(ref) === cardChoice.dataset.mapObjectKey);
        if (relation && target && this.beginEdit(relation.key)) this.confirm(target);
        return;
      }
      const pin = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-map-relation-pin]') : null;
      if (pin) this.pinned = this.pinned === pin.dataset.mapRelationPin ? null : pin.dataset.mapRelationPin ?? null;
      // Existing Map delegation owns the Popover toggle. Observe its resulting attributes.
      queueMicrotask(() => this.reconcile());
    });
    listen('toggle', () => this.reconcile());
    listen('keydown', event => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') this.suppressClickUntil = 0;
      if (this.editing && (key === 'Enter' || key === ' ')) {
        const target = this.targetAt(event.target);
        if (target) { event.preventDefault(); event.stopImmediatePropagation(); this.confirm(target); return; }
      }
      if (key !== 'Escape') return;
      if (this.editing || this.drag) {
        event.preventDefault(); event.stopImmediatePropagation(); this.cancelEdit(); this.reconcile(); return;
      }
      const opener = this.root.querySelector<HTMLButtonElement>('[data-map-hand-stack-toggle][aria-expanded="true"]');
      if (opener) opener.click(); // Reuse the existing close lifecycle.
      else this.pinned = null;
      this.reconcile();
    });
    listen('pointerdown', event => {
      const pointer = event as PointerEvent;
      if (pointer.button !== 0) return;
      this.suppressClickUntil = 0; // A fresh gesture is not the previous drag's trailing click.
      const source = event.target instanceof Element ? event.target.closest<HTMLElement>('.map-workspace__unit-action-card[data-map-relation-key], [data-map-target-edit]') : null;
      const key = source?.dataset.mapRelationKey ?? source?.dataset.mapTargetEdit;
      if (source && key && this.current().find(row => row.key === key)?.canSelectTarget) {
        this.drag = { key, x: pointer.clientX, y: pointer.clientY, pointerId: pointer.pointerId, source, active: false };
      }
    });
    listen('pointermove', event => {
      const pointer = event as PointerEvent;
      const drag = this.drag;
      if (!drag || pointer.pointerId !== drag.pointerId) return;
      if (!drag.active && Math.hypot(pointer.clientX - drag.x, pointer.clientY - drag.y) >= 6) {
        if (!this.beginEdit(drag.key)) { this.drag = null; return; }
        drag.active = true;
        this.root.setPointerCapture?.(pointer.pointerId);
        this.ghost = drag.source.cloneNode(true) as HTMLElement;
        for (const attr of [...this.ghost.attributes]) if (attr.name.startsWith('data-') || attr.name === 'id') this.ghost.removeAttribute(attr.name);
        this.ghost.className = 'map-workspace__target-drag-preview';
        this.ghost.setAttribute('aria-hidden', 'true');
        this.ghost.tabIndex = -1;
        this.ghost.style.pointerEvents = 'none';
        this.root.append(this.ghost);
      }
      if (!drag.active) return;
      pointer.preventDefault();
      if (this.ghost) { this.ghost.style.left = `${pointer.clientX + 12}px`; this.ghost.style.top = `${pointer.clientY + 12}px`; }
      this.drop = this.targetAt(document.elementFromPoint(pointer.clientX, pointer.clientY));
      this.reconcile();
    });
    listen('pointerup', event => {
      const pointer = event as PointerEvent;
      if (!this.drag || pointer.pointerId !== this.drag.pointerId) return;
      if (!this.drag.active) { this.drag = null; return; }
      event.preventDefault(); event.stopImmediatePropagation();
      this.suppressClickUntil = performance.now() + 350;
      const target = this.targetAt(document.elementFromPoint(pointer.clientX, pointer.clientY));
      if (target) this.confirm(target);
      else { this.cancelEdit(); this.reconcile(); }
    });
    const cancelPointer: EventListener = () => { if (this.drag) { this.cancelEdit(); this.reconcile(); } };
    listen('pointercancel', cancelPointer);
    listen('lostpointercapture', cancelPointer);
  }

  private current(): readonly MapActionRelation[] {
    const runId = this.root.querySelector<HTMLElement>('[data-map-workspace-region]')?.dataset.mapRunId;
    return runId ? this.query(runId) : [];
  }

  private version(relation: MapActionRelation): string { return JSON.stringify([relation.scope, relation.draft]); }

  private beginEdit(key: string): boolean {
    const relation = this.current().find(row => row.key === key);
    if (!relation?.canSelectTarget || !this.confirmTarget) return false;
    const opener = this.root.querySelector<HTMLButtonElement>('[data-map-hand-stack-toggle][aria-expanded="true"]');
    if (opener) opener.click();
    // Close before installing the edit lock: the opener may itself represent a legal target card.
    this.editing = { key, version: this.version(relation) };
    return true;
  }

  private targetAt(target: EventTarget | null): MapTargetRef | null {
    const node = target instanceof Element ? target.closest<HTMLElement>('[data-map-object-key]') : null;
    if (!node || !this.root.contains(node)) return null;
    const relation = this.current().find(row => row.key === this.editing?.key);
    return relation?.candidates.find(ref => mapObjectKey(ref) === node.dataset.mapObjectKey) ?? null;
  }

  private confirm(target: MapTargetRef): void {
    const relation = this.current().find(row => row.key === this.editing?.key);
    if (!relation || this.version(relation) !== this.editing?.version) { this.cancelEdit(); this.reconcile(); return; }
    try { this.confirmTarget?.(relation, target); }
    catch {
      this.cancelEdit(); this.reconcile();
      const status = this.root.querySelector('[data-map-relation-status]');
      if (status) status.textContent = '目标状态已变化，请重新检查后选择。';
      return;
    }
    this.cancelEdit(); this.reconcile();
  }

  private cancelEdit(): void {
    const pointerId = this.drag?.pointerId;
    this.drag = null;
    this.editing = null;
    this.drop = null;
    this.ghost?.remove(); this.ghost = null;
    if (pointerId !== undefined && this.root.hasPointerCapture?.(pointerId)) this.root.releasePointerCapture(pointerId);
  }

  private face(target: EventTarget | null): HTMLElement | null {
    const node = target instanceof Element ? target.closest<HTMLElement>('[data-map-relation-key], [data-map-object-key], [data-map-hand-picker] [data-map-action-swap], [data-map-hand-picker] [data-map-player-command]') : null;
    return node && this.root.contains(node) ? node : null;
  }

  reconcile(): void {
    if (this.disposed) return;
    const workspace = this.root.querySelector<HTMLElement>('[data-map-workspace-region]');
    const runId = workspace?.dataset.mapRunId;
    const relations = runId ? this.query(runId) : [];
    const scope = relations[0]?.scope;
    const context = scope ? JSON.stringify([scope.runId, scope.mapId, scope.nodeId, scope.activityId, scope.round]) : '';
    if (context !== this.context) {
      this.cancelEdit();
      this.pinned = null;
      this.focus = this.face(document.activeElement);
      this.context = context;
    }
    if (this.pointer && !this.root.contains(this.pointer)) this.pointer = null;
    if (this.focus && !this.root.contains(this.focus)) this.focus = null;
    if (this.pinned && !relations.some(row => row.key === this.pinned)) this.pinned = null;
    const editing = relations.find(row => row.key === this.editing?.key);
    if (this.editing && (!editing || this.version(editing) !== this.editing.version)) this.cancelEdit();
    if (!workspace) return;
    const popup = workspace.querySelector<HTMLElement>('[data-map-hand-stack-toggle][aria-expanded="true"]');
    const fixed = this.pinned ? relations.filter(row => row.key === this.pinned) : [];
    const transient = this.preferred === 'pointer' ? this.pointer ?? this.focus : this.focus ?? this.pointer;
    let selected = this.editing && editing ? [editing] : popup ? this.forNode(popup, relations) : fixed.length ? fixed : this.forNode(transient, relations);
    let previewError = false;
    const candidate = transient?.closest<HTMLElement>('[data-map-hand-picker] [data-action-id]');
    if (!this.editing && popup && candidate && candidate.closest('[data-map-hand-picker]')?.getAttribute('data-character-id') === selected[0]?.source.id
      && !(candidate instanceof HTMLButtonElement && candidate.disabled) && candidate.dataset.actionId && this.previewReplacement) {
      try { selected = this.previewReplacement(selected[0], candidate.dataset.actionId); }
      catch { previewError = true; }
    }
    presentMapRelations(workspace, selected, true);
    for (const node of workspace.querySelectorAll<HTMLElement>('[data-map-role-drop]')) delete node.dataset.mapRoleDrop;
    if (this.drop) {
      const dropKey = mapObjectKey(this.drop);
      for (const node of workspace.querySelectorAll<HTMLElement>('[data-map-object-key]')) if (node.dataset.mapObjectKey === dropKey) {
        node.dataset.mapRoleRecipient = '接收';
        node.dataset.mapRoleDrop = '接收';
      }
    }
    // A preview does not replace the mounted source card or mint a combat instance.
    if (popup && selected.some(row => row.phase === 'replacementPreview')) popup.dataset.mapRoleSource = '发起';
    workspace.dataset.mapRelationMode = this.editing ? this.drag?.active ? 'dragging' : 'editing' : popup ? 'replacement' : fixed.length ? 'pinned' : selected.length ? this.preferred : 'idle';
    for (const pin of workspace.querySelectorAll<HTMLElement>('[data-map-relation-pin]')) {
      pin.setAttribute('aria-pressed', String(pin.dataset.mapRelationPin === this.pinned));
    }
    for (const edit of workspace.querySelectorAll<HTMLElement>('[data-map-target-edit]')) edit.setAttribute('aria-pressed', String(edit.dataset.mapTargetEdit === this.editing?.key));
    const status = workspace.querySelector<HTMLElement>('[data-map-relation-status]');
    if (status) {
      const text = this.editing ? '选择虚线候选，点击或按 Enter 确认；Escape 取消。'
        : previewError ? '候选状态已变化，请重新检查当前准备行为。'
        : (selected.some(row => row.phase === 'replacementPreview') ? '替换预览：' : '') + (selected.some(row => row.targetState === 'unknown') ? '目标尚未确定，结算时决定。'
        : selected.some(row => row.targetState === 'pending') ? '目标待选择，虚线表示合法候选。'
          : selected.length && selected.every(row => row.targetState === 'none') ? '此行为无目标。'
            : selected.length ? `${fixed.length && !popup ? '已固定关系。' : ''}当前行为的目标已高亮。` : '');
      if (status.textContent !== text) status.textContent = text;
    }
  }

  private forNode(node: HTMLElement | null, relations: readonly MapActionRelation[]): readonly MapActionRelation[] {
    if (!node) return [];
    const objectKey = node.dataset.mapObjectKey;
    if (objectKey) return relations.filter(row => row.key === node.dataset.mapRelationKey
      || row.selectedTarget && mapObjectKey(row.selectedTarget) === objectKey
      || row.source.performer && mapObjectKey(row.source.performer) === objectKey);
    return relations.filter(row => row.key === node.dataset.mapRelationKey);
  }

  reset(): void {
    this.cancelEdit();
    this.pointer = this.focus = null;
    this.pinned = null;
    this.context = '';
    presentMapRelations(this.root, []);
    for (const pin of this.root.querySelectorAll('[data-map-relation-pin]')) pin.setAttribute('aria-pressed', 'false');
    for (const node of this.root.querySelectorAll<HTMLElement>('[data-map-role-drop]')) delete node.dataset.mapRoleDrop;
    for (const edit of this.root.querySelectorAll('[data-map-target-edit]')) edit.setAttribute('aria-pressed', 'false');
  }

  dispose(): void {
    this.disposed = true;
    for (const [name, listener] of this.listeners) this.root.removeEventListener(name, listener, true);
    this.reset();
  }
}
