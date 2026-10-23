import type { MapActionRelation, MapTargetRef } from '../../arona-clicker/contracts/map/map-relations';
import { mapCardHasEntry, mapCardInstanceAt, mapLocationObjectKey, type MapLocationRef } from '../cards/card-host';
import { mapObjectKey, presentMapRelations } from './map-relation-presentation';

/** One confirmed selection intent; the Controller adapts it to the existing Owner command. */
export interface MapRelationIntent {
  readonly relation: MapActionRelation;
  readonly target: MapTargetRef;
  /** Visual copy that started the intent; never a domain identity. */
  readonly sourceInstanceKey: string | null;
}

/** One transient Map node selection; it carries no movement authority by itself. */
export interface MapLocationSelectionIntent {
  readonly ref: MapLocationRef;
  readonly objectKey: string;
  readonly fromNodeId: string;
}

export type MapLocationCommitResult =
  | { readonly moved: true }
  | { readonly moved: false; readonly message: string };

export interface MapRelationInteractionOptions {
  readonly root: HTMLElement;
  readonly query: (runId: string) => readonly MapActionRelation[];
  readonly sendIntent: (intent: MapRelationIntent) => void;
  /** Optional hypothetical projection for an unconfirmed replacement candidate. */
  readonly previewReplacement?: (relation: MapActionRelation, actionId: string) => readonly MapActionRelation[];
  /** Controller rechecks current MapRun state before using the existing move command. */
  readonly commitLocation?: (intent: MapLocationSelectionIntent) => MapLocationCommitResult;
}

interface MountedLocationChoice {
  readonly ref: MapLocationRef;
  readonly objectKey: string;
  readonly selectable: boolean;
  readonly element: HTMLElement;
}

interface MountedLocationChoices {
  readonly runId: string;
  readonly mapId: string;
  readonly fromNodeId: string;
  readonly choices: readonly MountedLocationChoice[];
}

/** UI session only. All rules and current target identities come from the Owner. */
export class MapRelationInteraction {
  private pointer: HTMLElement | null = null;
  private focus: HTMLElement | null = null;
  private preferred: 'pointer' | 'focus' = 'pointer';
  private pinned: string | null = null;
  private context = '';
  private disposed = false;
  private editing: { key: string; version: string; instanceKey: string | null } | null = null;
  private selectedLocation: MapLocationSelectionIntent | null = null;
  private locationNotice: string | null = null;
  private drag: { key: string; x: number; y: number; pointerId: number; source: HTMLElement; active: boolean } | null = null;
  private drop: MapTargetRef | null = null;
  private ghost: HTMLElement | null = null;
  private suppressClickUntil = 0;
  private readonly listeners: [string, EventListener][] = [];
  private readonly root: HTMLElement;
  private readonly query: (runId: string) => readonly MapActionRelation[];
  private readonly sendIntent: (intent: MapRelationIntent) => void;
  private readonly previewReplacement?: (relation: MapActionRelation, actionId: string) => readonly MapActionRelation[];
  private readonly commitLocation?: (intent: MapLocationSelectionIntent) => MapLocationCommitResult;

  constructor(options: MapRelationInteractionOptions) {
    const { root } = options;
    this.root = root;
    this.query = options.query;
    this.sendIntent = options.sendIntent;
    this.previewReplacement = options.previewReplacement;
    this.commitLocation = options.commitLocation;
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
      const locationChoice = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-map-location-node-id]') : null;
      if (locationChoice && this.root.contains(locationChoice)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!this.editing) this.selectLocation(locationChoice);
        return;
      }
      const locationSubmit = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-map-location-submit]') : null;
      if (locationSubmit && this.root.contains(locationSubmit)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!this.editing && !locationSubmit.disabled) this.commitSelectedLocation();
        return;
      }
      const edit = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-map-target-edit]') : null;
      if (edit) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.editing?.key === edit.dataset.mapTargetEdit) this.cancelEdit();
        else this.beginEdit(edit.dataset.mapTargetEdit ?? '', edit);
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
        // A target-picker control must be a bound card instance that provides the target entry.
        if (!mapCardHasEntry(cardChoice, 'target')) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.editing) return; // A different source's picker cannot override the current edit lock.
        const relation = this.current().find(row => row.key === cardChoice.dataset.mapCardTarget);
        const target = relation?.candidates.find(ref => mapObjectKey(ref) === cardChoice.dataset.mapObjectKey);
        if (relation && target && this.beginEdit(relation.key, null)) this.confirm(target);
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
      if (key === 'Enter' || key === ' ') {
        const locationChoice = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-map-location-node-id]') : null;
        if (locationChoice && this.root.contains(locationChoice)) {
          event.preventDefault(); event.stopImmediatePropagation();
          if (!this.editing) this.selectLocation(locationChoice);
          return;
        }
      }
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
      const source = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-map-card-entry~="editTarget"]')
        : null;
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
        if (!this.beginEdit(drag.key, drag.source)) { this.drag = null; return; }
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

  private mountedLocationChoices(): MountedLocationChoices | null {
    const workspace = this.root.querySelector<HTMLElement>('[data-map-workspace-region]');
    const section = this.root.querySelector<HTMLElement>('[data-map-location-choices]');
    const runId = section?.dataset.mapRunId;
    const mapId = section?.dataset.mapMapId;
    const fromNodeId = section?.dataset.mapFromNode;
    if (!workspace || !section || !runId || runId !== workspace.dataset.mapRunId || !mapId || !fromNodeId) return null;
    const choices = [...section.querySelectorAll<HTMLElement>('[data-map-location-node-id]')].flatMap(element => {
      const nodeId = element.dataset.mapLocationNodeId;
      const objectKey = element.dataset.mapObjectKey;
      if (!nodeId || !objectKey || !element.dataset.mapInstanceKey || element.dataset.mapCardUsage !== 'live') return [];
      const ref: MapLocationRef = { kind: 'mapNode', runId, mapId, nodeId };
      if (mapLocationObjectKey(ref) !== objectKey) return [];
      return [{
        ref,
        objectKey,
        selectable: element.dataset.mapLocationSelectable === 'true' && mapCardHasEntry(element, 'selectLocation'),
        element,
      }];
    });
    return choices.length ? { runId, mapId, fromNodeId, choices } : null;
  }

  private selectLocation(element: HTMLElement): void {
    if (this.editing) return;
    const current = this.mountedLocationChoices();
    const choice = current?.choices.find(candidate => candidate.element === element && candidate.selectable);
    if (!current || !choice || !this.root.contains(element)) return;
    this.selectedLocation = { ref: choice.ref, objectKey: choice.objectKey, fromNodeId: current.fromNodeId };
    this.locationNotice = null;
    this.reconcile();
  }

  private commitSelectedLocation(): void {
    const selected = this.selectedLocation;
    const current = this.mountedLocationChoices();
    const choice = current?.choices.find(candidate => candidate.objectKey === selected?.objectKey && candidate.selectable);
    if (!selected || !current || !choice || selected.ref.runId !== current.runId
      || selected.ref.mapId !== current.mapId || selected.fromNodeId !== current.fromNodeId) {
      this.selectedLocation = null;
      this.locationNotice = '所选地点已失效，请根据当前候选重新选择。';
      this.reconcile();
      return;
    }
    const result = this.commitLocation?.(selected);
    if (result?.moved) {
      this.selectedLocation = null;
      this.locationNotice = null;
    } else {
      this.locationNotice = result?.message ?? '移动未执行，请检查当前地点和路线条件。';
    }
    this.reconcile();
  }

  private updateLocationPresentation(current = this.mountedLocationChoices()): void {
    const cards = [...this.root.querySelectorAll<HTMLElement>('[data-map-location-choices] [data-map-location-node-id]')];
    for (const card of cards) {
      const choice = current?.choices.find(candidate => candidate.element === card);
      const selected = !!choice && !!this.selectedLocation && choice.objectKey === this.selectedLocation.objectKey
        && current?.runId === this.selectedLocation.ref.runId && current.mapId === this.selectedLocation.ref.mapId
        && current.fromNodeId === this.selectedLocation.fromNodeId;
      card.dataset.mapLocationSelected = String(selected);
      card.setAttribute('aria-pressed', String(selected));
      card.setAttribute('aria-disabled', String(!choice?.selectable));
    }
    if (!current) return;
    const selectedChoice = current.choices.find(choice => choice.objectKey === this.selectedLocation?.objectKey && choice.selectable);
    const submit = this.root.querySelector<HTMLButtonElement>('[data-map-location-submit]');
    if (submit) {
      const disabled = this.editing !== null || !selectedChoice;
      submit.disabled = disabled;
      submit.classList.toggle('disabled', disabled);
      submit.querySelector('.send-bubble')?.classList.toggle('disabled', disabled);
      const title = selectedChoice?.element.querySelector('strong')?.textContent ?? selectedChoice?.ref.nodeId;
      const label = title ? `前往${title}` : '选择目的地点';
      const text = submit.querySelector<HTMLElement>('.send-text');
      if (text && text.textContent !== label) text.textContent = label;
      submit.setAttribute('aria-label', label);
    }
    const status = this.root.querySelector<HTMLElement>('[data-map-commit-status]');
    if (status) {
      const title = selectedChoice?.element.querySelector('strong')?.textContent ?? selectedChoice?.ref.nodeId;
      const message = this.locationNotice ?? (title
        ? `已选择“${title}”，点击下方按钮前往。`
        : '请选择目的地点，然后点击下方按钮。');
      if (status.textContent !== message) status.textContent = message;
    }
  }

  private version(relation: MapActionRelation): string { return JSON.stringify([relation.scope, relation.draft]); }

  private beginEdit(key: string, source: HTMLElement | null): boolean {
    if (this.mountedLocationChoices()) return false;
    const relation = this.current().find(row => row.key === key);
    if (!relation?.canSelectTarget) return false;
    const sourceNode = mapCardInstanceAt(source) ?? this.instanceForRelation(key);
    // A source copy that provides no edit entry cannot start an Owner command.
    if (!sourceNode || !mapCardHasEntry(sourceNode, 'editTarget')) return false;
    const opener = this.root.querySelector<HTMLButtonElement>('[data-map-hand-stack-toggle][aria-expanded="true"]');
    if (opener) opener.click();
    // Close before installing the edit lock: the opener may itself represent a legal target card.
    this.editing = {
      key,
      version: this.version(relation),
      instanceKey: sourceNode.dataset.mapInstanceKey ?? null,
    };
    return true;
  }

  /** Find a currently mounted live copy of the relation source. */
  private instanceForRelation(key: string): HTMLElement | null {
    return [...this.root.querySelectorAll<HTMLElement>('[data-map-instance-key]')]
      .find(node => node.dataset.mapRelationKey === key) ?? null;
  }

  private targetAt(target: EventTarget | null): MapTargetRef | null {
    const node = target instanceof Element ? target.closest<HTMLElement>('[data-map-object-key]') : null;
    if (!node || !this.root.contains(node)) return null;
    const relation = this.current().find(row => row.key === this.editing?.key);
    const ref = relation?.candidates.find(candidate => mapObjectKey(candidate) === node.dataset.mapObjectKey) ?? null;
    // Unit copies need no card binding; a card copy must explicitly provide target entry.
    if (ref?.kind === 'card' && !mapCardHasEntry(mapCardInstanceAt(node), 'target')) return null;
    return ref;
  }

  private confirm(target: MapTargetRef): void {
    const relation = this.current().find(row => row.key === this.editing?.key);
    if (!relation || this.version(relation) !== this.editing?.version) { this.cancelEdit(); this.reconcile(); return; }
    const sourceInstanceKey = this.editing?.instanceKey ?? null;
    try { this.sendIntent({ relation, target, sourceInstanceKey }); }
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
    // A removed drag source must release capture and its ghost; other copies stay valid.
    if (this.drag && !this.root.contains(this.drag.source)) this.cancelEdit();
    if (this.pinned && !relations.some(row => row.key === this.pinned)) this.pinned = null;
    const editing = relations.find(row => row.key === this.editing?.key);
    if (this.editing && (!editing || this.version(editing) !== this.editing.version)) this.cancelEdit();
    const locationChoices = this.mountedLocationChoices();
    if (locationChoices && this.editing) this.cancelEdit();
    if (this.selectedLocation) {
      const selectedChoice = locationChoices?.choices.find(choice => choice.objectKey === this.selectedLocation?.objectKey && choice.selectable);
      if (!locationChoices || !selectedChoice || locationChoices.runId !== this.selectedLocation.ref.runId
        || locationChoices.mapId !== this.selectedLocation.ref.mapId || locationChoices.fromNodeId !== this.selectedLocation.fromNodeId) {
        this.selectedLocation = null;
        this.locationNotice = '所选地点已失效，请根据当前候选重新选择。';
      }
    }
    if (!workspace) { this.updateLocationPresentation(null); return; }
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
    this.updateLocationPresentation(locationChoices);
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
    this.selectedLocation = null;
    this.locationNotice = null;
    this.context = '';
    presentMapRelations(this.root, []);
    for (const pin of this.root.querySelectorAll('[data-map-relation-pin]')) pin.setAttribute('aria-pressed', 'false');
    for (const node of this.root.querySelectorAll<HTMLElement>('[data-map-role-drop]')) delete node.dataset.mapRoleDrop;
    for (const edit of this.root.querySelectorAll('[data-map-target-edit]')) edit.setAttribute('aria-pressed', 'false');
    for (const card of this.root.querySelectorAll<HTMLElement>('[data-map-location-node-id]')) {
      card.dataset.mapLocationSelected = 'false';
      card.setAttribute('aria-pressed', 'false');
    }
    for (const submit of this.root.querySelectorAll<HTMLButtonElement>('[data-map-location-submit]')) {
      submit.disabled = true;
      submit.classList.add('disabled');
      submit.querySelector('.send-bubble')?.classList.add('disabled');
      submit.querySelector<HTMLElement>('.send-text')?.replaceChildren('选择目的地点');
      submit.setAttribute('aria-label', '选择目的地点');
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const [name, listener] of this.listeners) this.root.removeEventListener(name, listener, true);
    this.reset();
  }
}
