import type { UIController } from '../controller/controller';
import type { PanelState } from '../components/shared/app-shell';
import type { UIContext } from '../runtime/context';
import { createUIContext } from '../runtime/context';
import { renderWorkspaceFrame, workspaceColumns, type WorkspaceFrameSpec } from '../components/shared/workspace-frame';
import type { WorkspaceLocation, WorkspaceNavigationState } from '../workspace/workspace-router';
import { appendNode, bindStoryNodeToChoiceOption, bindStoryNodeToFlagReader, canBindStoryNodeToChoiceOption, canBindStoryNodeToFlagReader, composer, createStoryEditorState, currentDraft, currentNode, deleteNode, editNode, editNodeFlag, isGeneratedStoryNodeId, moveNode, moveNodeToInsertionPoint, newStory, renameStory, renameStoryLocalFlag, renameStoryNodeId, selectStory, setInsertionPoint, storyDefinitionFromDraft, suggestStoryNodeId } from './model';
import { StoryDraftPersistence } from './persistence';
import { createStoryEditorFrame, storySenders } from './view';
import { patchEditorDOM } from './dom';
import { addRow, editProperty, moveRowBy, readProperty, removeProperty, removeRow, selectBranch, selectDiscriminant, selectLiteralKind, selectNodeType, selectThemeScope, toggleOptional, rowIdAt } from './property-model';
import type { Discriminator, LiteralKind, PropertyPath } from './property-model';

const DISCRIMINATORS: readonly string[] = ['kind', 'command', 'op', 'entryType', 'mode', 'valueKind', 'type'];
const STORY_EDITOR_DRAG_TYPE = 'application/x-acprogram-story-editor';
interface StoryEditorDragItem { version: 1; kind: 'story-node'; draftId: string; nodeId: string }
function readStoryDragItem(event: DragEvent): StoryEditorDragItem | undefined {
  const raw = event.dataTransfer?.getData(STORY_EDITOR_DRAG_TYPE);
  if (!raw) return;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return;
    const item = value as Partial<StoryEditorDragItem>;
    return item.version === 1 && item.kind === 'story-node' && typeof item.draftId === 'string' && typeof item.nodeId === 'string'
      ? item as StoryEditorDragItem : undefined;
  } catch { return; }
}
function storyDropAnchor(target: Element | null, clientY: number, draft: NonNullable<ReturnType<typeof currentDraft>>): string | null | undefined {
  const dropTarget = target?.closest<HTMLElement>('[data-story-drop-target]');
  if (dropTarget?.dataset.storyDropTarget === 'insertion-point') {
    if (dropTarget.hasAttribute('data-story-insertion-end')) return null;
    return dropTarget.dataset.storyInsertionBefore;
  }
  if (dropTarget?.dataset.storyDropTarget === 'story-node') {
    const nodeId = dropTarget.dataset.editorNode;
    const index = draft.document.nodes.findIndex(node => node.id === nodeId);
    if (index < 0) return undefined;
    const rect = dropTarget.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? nodeId! : draft.document.nodes[index + 1]?.id ?? null;
  }
  return undefined;
}
interface ChoiceFlagDropTarget { choiceNodeId: string; optionIndex: number; optionId: string }
function choiceFlagDropTarget(target: Element | null): ChoiceFlagDropTarget | undefined {
  const card = target?.closest<HTMLElement>('[data-story-drop-target="choice-flag"]');
  if (!card) return;
  const optionIndex = Number(card.dataset.storyOptionIndex);
  const choiceNodeId = card.dataset.storyChoiceNode;
  const optionId = card.dataset.storyOptionId;
  return choiceNodeId && optionId && Number.isInteger(optionIndex) && optionIndex >= 0 ? { choiceNodeId, optionIndex, optionId } : undefined;
}
function storyFlagReaderDropTarget(target: Element | null): string | undefined {
  return target?.closest<HTMLElement>('[data-story-drop-target="story-flag-reader"]')?.dataset.storyFlagName;
}
function clearStoryFlagDropStates(flow: HTMLElement): void {
  for (const card of flow.querySelectorAll<HTMLElement>('[data-story-drop-target="choice-flag"]')) card.classList.remove('is-drop-target', 'is-drop-invalid');
  for (const record of flow.querySelectorAll<HTMLElement>('[data-story-drop-target="story-flag-reader"]')) record.classList.remove('is-drop-target', 'is-drop-invalid');
}
function highlightStoryDropAnchor(flow: HTMLElement, beforeNodeId: string | null): void {
  for (const slot of flow.querySelectorAll<HTMLElement>('[data-story-drop-target="insertion-point"]')) {
    const active = beforeNodeId === null ? slot.hasAttribute('data-story-insertion-end') : slot.dataset.storyInsertionBefore === beforeNodeId;
    slot.classList.toggle('is-drop-target', active);
  }
}
/** Split `nodes[3].action.effects[1].op` into the node index and the node-relative property path. */
function splitIssuePath(raw: string): { index: number; path: (string | number)[] } | null {
  const head = /^nodes\[(\d+)\]/.exec(raw);
  if (!head) return null;
  const path: (string | number)[] = [];
  const pattern = /\.([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw.slice(head[0].length)))) path.push(match[1] === undefined ? Number(match[2]) : match[1]);
  return { index: Number(head[1]), path };
}

export const STORY_EDITOR_REGION = 'workspace.story-editor';

/** Draft owner; explicit Runtime saves go through GameCommands, never playback. */
export class StoryEditorController {
  readonly state = createStoryEditorState();
  private loaded = false;
  private disposed = false;
  private draggingNodeId: string | null = null;
  private returnState?: { location: WorkspaceLocation; navigation?: WorkspaceNavigationState; workspace: PanelState['workspace']; mapEntrySource: PanelState['mapEntrySource']; init: string | null };
  private revealNodeId: string | null = null;
  private focusName = false;
  /** Node-relative property path JSON to focus after the next refresh; set by issue location. */
  private pendingFocus?: string | null;
  constructor(private readonly ctrl: UIController, readonly persistence = new StoryDraftPersistence()) {}

  isOpen(): boolean { return !this.disposed && this.ctrl.panelState.workspaceNavigation?.current.kind === 'story-editor'; }
  dispose(): void {
    this.save(false, false);
    this.abandonReturn();
    this.disposed = true;
  }
  refreshInstance(instanceId: string): boolean {
    if (!this.isOpen() || !instanceId.startsWith('story-editor/')) return false;
    this.requestRefresh();
    return true;
  }
  open(): void {
    if (this.disposed) return;
    if (this.isOpen()) return;
    if (!this.loaded) { this.persistence.load(this.state); this.loaded = true; }
    const panel = this.ctrl.panelState;
    this.returnState = { location: this.ctrl.workspaceLocation(), navigation: panel.workspaceNavigation, workspace: panel.workspace, mapEntrySource: panel.mapEntrySource, init: this.ctrl.game.state.activeInit };
    panel.storyEditor = this.state;
    this.ctrl.enterWorkspaceRoute({ kind: 'story-editor' });
    panel.workspace = undefined;
    this.ctrl.render();
  }
  configureFrame(frame: WorkspaceFrameSpec): WorkspaceFrameSpec {
    return { ...frame, onBack: () => this.close(), columns: workspaceColumns(frame).map(column => ({ ...column, bind: root => this.bind(root) })) };
  }
  save(manual = false, refresh = true): boolean {
    if (!this.loaded) return true;
    const draft = currentDraft(this.state);
    if (manual && draft && !draft.persisted) draft.dirty = true;
    const saved = this.persistence.save(this.state);
    if (refresh && this.isOpen()) this.requestRefresh();
    return saved;
  }
  saveToRuntime(): boolean {
    const draft = currentDraft(this.state);
    if (!draft || this.state.storageBlocked) return false;
    this.state.notice = null;
    const compiled = storyDefinitionFromDraft(draft);
    if (!compiled.ok) {
      this.state.error = compiled.message;
      const issue = compiled.issues[0];
      if (issue) this.locateIssue(draft, issue.path);
      this.requestRefresh(); return false;
    }
    const result = this.ctrl.commands.saveStoryDefinition(compiled.story);
    if (!result.ok) { this.state.error = result.message; this.requestRefresh(); return false; }
    // Associate newly registered local stories so the source and draft stay one row.
    draft.sourceId = result.storyId;
    draft.dirty = true;
    const localSaved = this.save(false, false);
    this.state.notice = localSaved ? '已保存到运行内容，仅当前运行有效。' : '运行内容已更新，本地草稿保存失败；请重试保存草稿。';
    this.requestRefresh();
    return true;
  }
  beforeLeave(): boolean {
    if (!this.isOpen()) return true;
    const saved = this.save(false, false);
    if (!saved) this.requestRefresh();
    return saved;
  }
  /** A topbar/other route exit abandons the suspended return target. */
  abandonReturn(): void {
    const workspace = this.returnState?.workspace;
    if (workspace?.type === 'shop') {
      workspace.session.clear();
      this.ctrl.game.colorSystem.popEphemeralTheme(workspace.themeId);
    }
    this.returnState = undefined;
  }
  close(): void {
    if (!this.isOpen() || !this.beforeLeave()) return;
    const panel = this.ctrl.panelState;
    const saved = this.returnState;
    const route = saved?.location.route;
    const target = route && typeof route !== 'string' ? route : { kind: 'game' as const };
    const sameInit = saved?.init === this.ctrl.game.state.activeInit;
    const valid = target.kind === 'service' || sameInit && (
      target.kind === 'game' || target.kind === 'contacts' || target.kind === 'story' || target.kind === 'shop'
      || target.kind === 'character' && this.ctrl.game.rosterSystem.isOwned(this.ctrl.game.state, target.variantId)
      || target.kind === 'area' && this.ctrl.game.world.areas.has(target.areaId)
      || target.kind === 'map' && this.ctrl.game.mapRun.getSnapshot()?.runId === target.runId
      || target.kind === 'map-entry' && this.ctrl.game.registry.maps.has(target.mapId)
      || target.kind === 'operation' && Boolean(this.ctrl.game.operationEntry.getView(target.runId))
      || target.kind === 'area-map' && panel.areaMapSession?.sessionId === target.sessionId);
    if (saved && valid) {
      panel.workspace = saved.workspace;
      panel.workspaceNavigation = saved.navigation ?? { current: target };
      panel.service = target.kind === 'service' ? target.page : 'game';
      panel.leftTab = saved.location.leftTab;
      panel.centerTab = saved.location.centerTab;
      panel.rightTab = saved.location.rightTab;
      panel.selectedVariantId = saved.location.selectedVariantId;
      panel.conversationVariantId = saved.location.conversationVariantId;
      panel.mapEntrySource = saved.mapEntrySource;
    } else {
      this.abandonReturn();
      panel.workspace = undefined;
      panel.workspaceNavigation = { current: { kind: 'game' } };
      panel.service = 'game';
    }
    this.returnState = undefined;
    this.ctrl.render();
  }
  requestRefresh(): void {
    if (this.isOpen()) this.ctrl.requestUIUpdate({ type: 'region', hostId: STORY_EDITOR_REGION, reason: 'story-editor-change' });
  }
  refresh(ctx: UIContext): boolean {
    if (!this.isOpen()) return false;
    const frame = this.configureFrame(createStoryEditorFrame(ctx, this.state));
    const template = document.createElement('template');
    template.innerHTML = renderWorkspaceFrame(ctx, frame);
    const current = this.ctrl.root.querySelector<HTMLElement>('[data-workspace-frame="story-editor"]');
    const next = template.content.firstElementChild as HTMLElement;
    if (!current) {
      const page = this.ctrl.root.querySelector<HTMLElement>('.workspace-page-content');
      if (!page) return false;
      this.ctrl.columns.mount(page, ctx, frame);
    } else {
      const oldBinding = current.querySelector<HTMLElement>('[data-column-binding]')?.dataset.columnBinding;
      const active = document.activeElement instanceof HTMLElement && current.contains(document.activeElement) ? document.activeElement : null;
      patchEditorDOM(current, next, root => this.ctrl.popovers.dismissBeforeRootMutation(root));
      this.ctrl.columns.adopt(this.ctrl.root, ctx, frame);
      if (oldBinding !== (currentDraft(this.state)?.draftId ?? '')) {
        for (const column of current.querySelectorAll<HTMLElement>('.story-editor-center, .story-editor-right')) {
          const body = column.querySelector<HTMLElement>('.workspace-column__body');
          if (body) body.scrollTop = 0;
        }
      }
      if (active?.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
    }
    if (this.revealNodeId) {
      const nodeId = this.revealNodeId;
      const body = this.ctrl.root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body');
      const node = [...(body?.querySelectorAll<HTMLElement>('[data-editor-node]') ?? [])].find(item => item.dataset.editorNode === nodeId);
      if (node?.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
      this.revealNodeId = null;
    }
    if (this.focusName) {
      this.ctrl.root.querySelector<HTMLInputElement>('[data-editor-field="name"]')?.focus();
      this.focusName = false;
    }
    if (this.pendingFocus !== undefined) {
      const target = this.pendingFocus;
      this.pendingFocus = undefined;
      this.focusIssueField(target);
    }
    return true;
  }
  private focusIssueField(raw: string | null): void {
    if (!raw) { this.ctrl.root.querySelector<HTMLElement>('[data-story-node-type]')?.focus({ preventScroll: true }); return; }
    for (const control of this.ctrl.root.querySelectorAll<HTMLElement>('[data-story-property-path]')) {
      if (control.dataset.storyPropertyPath === raw) { control.focus({ preventScroll: true }); return; }
    }
  }
  bind(root: HTMLElement): () => void {
    const select = (event: Event): void => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null;
      if (!target || !root.contains(target)) return;
      if (event.type === 'contextmenu') event.preventDefault();
      this.state.selectedNodeId = target.dataset.editorNode ?? null;
      this.requestRefresh();
    };
    const click = (event: Event): void => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-insertion-before], [data-story-insertion-end], [data-editor-action], [data-editor-story], [data-editor-sender], [data-column-action^="story-editor-sidebar:"], [data-column-action^="story-editor-node-type:"], [data-story-row-action], [data-story-condition-add], [data-story-init-branch], [data-story-init-condition], [data-story-init-object], [data-story-init-value], [data-story-remove-readonly]') : null;
      if (!element || !root.contains(element) || element instanceof HTMLButtonElement && element.disabled) { select(event); return; }
      if (element.hasAttribute('data-story-insertion-before') || element.hasAttribute('data-story-insertion-end')) {
        const beforeNodeId = element.hasAttribute('data-story-insertion-end') ? null : element.dataset.storyInsertionBefore ?? null;
        if (setInsertionPoint(this.state, beforeNodeId)) this.requestRefresh();
        return;
      }
      const source = element.dataset.editorStory;
      const sender = element.dataset.editorSender;
      const nodeTypeTab = element.dataset.columnAction?.slice('story-editor-node-type:'.length);
      const sidebarTab = element.dataset.columnAction?.slice('story-editor-sidebar:'.length);
      if (nodeTypeTab && ['talklet', 'click', 'operation', 'transfer', 'moveToArea', 'moveToCharaspace'].includes(nodeTypeTab)) {
        const draft = currentDraft(this.state);
        const node = currentNode(this.state);
        if (draft && node) selectNodeType(draft, node.id, nodeTypeTab as import('./property-model').StoryNodeType);
      } else if (sidebarTab === 'stories' || sidebarTab === 'senders') this.state.sidebarMode = sidebarTab;
      else if (sender) {
        const draft = currentDraft(this.state);
        if (draft && storySenders(createUIContext(this.ctrl.game)).some(item => item.id === sender)) composer(this.state).sender = sender;
      } else if (source) {
        if (this.save(false, false)) { selectStory(this.state, source, this.ctrl.game.registry.stories); this.state.notice = null; }
      } else if (element.hasAttribute('data-story-remove-readonly')) this.removeReadonlyProperty(element);
      else if (element.dataset.storyRowAction || element.dataset.storyConditionAdd || element.dataset.storyInitBranch || element.dataset.storyInitCondition || element.dataset.storyInitObject !== undefined || element.dataset.storyInitValue) this.propertyAction(element);
      else this.action(element.dataset.editorAction ?? '');
      this.requestRefresh();
    };
    const input = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      if (this.state.storageBlocked && !target.hasAttribute('data-editor-search') && !target.hasAttribute('data-editor-sender-search')) return;
      const draft = currentDraft(this.state); const node = currentNode(this.state);
      const senders = storySenders(createUIContext(this.ctrl.game));
      if (target.hasAttribute('data-editor-search')) this.state.search = target.value;
      else if (target.hasAttribute('data-editor-sender-search')) this.state.senderSearch = target.value;
      else if (target.hasAttribute('data-editor-composer-text')) composer(this.state).text = target.value;
      else if (target.dataset.editorField === 'name') renameStory(this.state, target.value);
      else if (draft && target.dataset.editorField === 'story-context-type' && event.type === 'change') {
        const previous = draft.document.startContext;
        draft.document = { ...draft.document, startContext: target.value === 'chara'
          ? { type: 'chara', characterId: previous?.type === 'chara' ? previous.characterId : '' }
          : { type: 'area', areaId: previous?.type === 'area' ? previous.areaId : '' } };
        draft.dirty = true;
      } else if (draft && target.dataset.editorField === 'story-context-area' && event.type === 'change') {
        draft.document = { ...draft.document, startContext: { type: 'area', areaId: target.value } };
        draft.dirty = true;
      } else if (draft && target.dataset.editorField === 'story-context-character' && event.type === 'change') {
        draft.document = { ...draft.document, startContext: { type: 'chara', characterId: target.value } };
        draft.dirty = true;
      }
      else if (target.dataset.editorField === 'text' || target.dataset.editorField === 'sender') editNode(this.state, target.dataset.editorField, target.value, senders);
      else if (target.dataset.editorField === 'local-flag-name') {
        if (event.type !== 'change') return;
        const action = node?.type === 'operation' && node.action?.kind === 'localFlag' ? node.action : undefined;
        if (!draft || !node || !action) return;
        if (action.name) {
          const result = renameStoryLocalFlag(draft, action.name, target.value.trim());
          this.state.error = result.ok ? null : result.reason;
        } else {
          this.state.error = editNodeFlag(this.state, 'local-flag-name', target.value.trim()) ? null : '标记名称不能为空。';
        }
      }
      else if (target.dataset.editorField && ['requires-flag', 'local-flag-op', 'local-flag-type', 'local-flag-value'].includes(target.dataset.editorField)) editNodeFlag(this.state, target.dataset.editorField, target.value);
      else if (target instanceof HTMLSelectElement && target.hasAttribute('data-story-theme-scope-path')) {
        const path = this.parsePropertyPath(target.dataset.storyThemeScopePath);
        if (draft && node && path && (target.value === 'ephemeral' || target.value === 'area' || target.value === 'student')) selectThemeScope(draft, node.id, path, target.value);
      } else if (target instanceof HTMLSelectElement && target.hasAttribute('data-story-branch-path')) {
        const path = this.parsePropertyPath(target.dataset.storyBranchPath);
        const field = target.dataset.storyBranchField;
        if (draft && node && path) {
          if (DISCRIMINATORS.includes(field ?? '')) selectDiscriminant(draft, node.id, path, field as Discriminator, target.value);
          else selectBranch(draft, node.id, path, target.value);
        }
      } else if (target instanceof HTMLSelectElement && target.hasAttribute('data-story-literal-kind-path')) {
        const path = this.parsePropertyPath(target.dataset.storyLiteralKindPath);
        if (draft && node && path && (target.value === 'string' || target.value === 'number' || target.value === 'boolean')) selectLiteralKind(draft, node.id, path, target.value as LiteralKind);
      } else if (target instanceof HTMLInputElement && target.hasAttribute('data-story-optional-path')) {
        const path = this.parsePropertyPath(target.dataset.storyOptionalPath);
        if (draft && node && path) toggleOptional(draft, node.id, path, target.checked);
      } else if (target.hasAttribute('data-story-property-path')) this.editStoryProperty(target);
      else return;
      if (target.dataset.editorField) this.state.notice = null;
      this.requestRefresh();
    };
    const dragStart = (event: DragEvent): void => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null;
      const draft = currentDraft(this.state);
      if (!target || !draft || this.state.storageBlocked || !root.contains(target) || !event.dataTransfer) { event.preventDefault(); return; }
      const nodeId = target.dataset.editorNode ?? '';
      if (!nodeId || !draft.document.nodes.some(node => node.id === nodeId)) { event.preventDefault(); return; }
      const item: StoryEditorDragItem = { version: 1, kind: 'story-node', draftId: draft.draftId, nodeId };
      this.draggingNodeId = nodeId;
      event.dataTransfer.setData(STORY_EDITOR_DRAG_TYPE, JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'move';
      target.classList.add('is-dragging');
    };
    const dragOver = (event: DragEvent): void => {
      const flow = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-flow') : null;
      const draft = currentDraft(this.state);
      const nodeId = this.draggingNodeId;
      if (!flow || !draft || this.state.storageBlocked || !nodeId || !draft.document.nodes.some(node => node.id === nodeId)
        || !event.dataTransfer?.types.includes(STORY_EDITOR_DRAG_TYPE)) return;
      clearStoryFlagDropStates(flow);
      const readerFlag = storyFlagReaderDropTarget(event.target instanceof Element ? event.target : null);
      if (readerFlag) {
        const plan = canBindStoryNodeToFlagReader(draft, readerFlag, nodeId);
        const record = (event.target as Element).closest<HTMLElement>('[data-story-drop-target="story-flag-reader"]');
        highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
        record?.classList.toggle('is-drop-target', plan.ok && plan.changed);
        record?.classList.toggle('is-drop-invalid', !plan.ok);
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = plan.ok && plan.changed ? 'move' : plan.ok ? 'copy' : 'none';
        return;
      }
      const choiceTarget = choiceFlagDropTarget(event.target instanceof Element ? event.target : null);
      if (choiceTarget) {
        const plan = canBindStoryNodeToChoiceOption(draft, choiceTarget.choiceNodeId, choiceTarget.optionIndex, choiceTarget.optionId, nodeId);
        const card = (event.target as Element).closest<HTMLElement>('[data-story-drop-target="choice-flag"]');
        highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
        card?.classList.toggle('is-drop-target', plan.ok);
        card?.classList.toggle('is-drop-invalid', !plan.ok);
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = plan.ok ? 'move' : 'none';
        return;
      }
      const anchor = storyDropAnchor(event.target instanceof Element ? event.target : null, event.clientY, draft);
      if (anchor === undefined || anchor === nodeId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      highlightStoryDropAnchor(flow, anchor);
    };
    const dragLeave = (event: DragEvent): void => {
      const flow = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-flow') : null;
      if (!flow || event.relatedTarget instanceof Node && flow.contains(event.relatedTarget)) return;
      clearStoryFlagDropStates(flow);
      highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
    };
    const drop = (event: DragEvent): void => {
      const flow = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-flow') : null;
      const draft = currentDraft(this.state);
      const item = readStoryDragItem(event);
      if (!flow || !draft || this.state.storageBlocked || !item || item.draftId !== draft.draftId || !draft.document.nodes.some(node => node.id === item.nodeId)) return;
      const readerFlag = storyFlagReaderDropTarget(event.target instanceof Element ? event.target : null);
      if (readerFlag) {
        event.preventDefault();
        const result = bindStoryNodeToFlagReader(this.state, readerFlag, item.nodeId);
        if (!result.ok) this.state.error = result.reason;
        else this.state.error = null;
        this.requestRefresh();
        clearStoryFlagDropStates(flow);
        highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
        return;
      }
      const choiceTarget = choiceFlagDropTarget(event.target instanceof Element ? event.target : null);
      if (choiceTarget) {
        event.preventDefault();
        const result = bindStoryNodeToChoiceOption(this.state, choiceTarget.choiceNodeId, choiceTarget.optionIndex, choiceTarget.optionId, item.nodeId);
        if (!result.ok) {
          this.state.error = result.reason;
          this.requestRefresh();
        } else {
          this.state.error = null;
          this.requestRefresh();
          if (result.created && isGeneratedStoryNodeId(item.nodeId)) this.openGeneratedNodeIdPrompt(draft.draftId, item.nodeId, choiceTarget.optionId);
        }
        clearStoryFlagDropStates(flow);
        highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
        return;
      }
      const anchor = storyDropAnchor(event.target instanceof Element ? event.target : null, event.clientY, draft);
      if (anchor === undefined || anchor === item.nodeId) return;
      event.preventDefault();
      if (moveNodeToInsertionPoint(this.state, item.nodeId, anchor)) this.requestRefresh();
      highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
    };
    const dragEnd = (event: DragEvent): void => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null;
      target?.classList.remove('is-dragging');
      this.draggingNodeId = null;
      const flow = target?.closest<HTMLElement>('.story-editor-flow');
      if (flow) { clearStoryFlagDropStates(flow); highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId); }
    };
    const nodeKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null;
      if (!target || !root.contains(target)) return;
      event.preventDefault();
      this.state.selectedNodeId = target.dataset.editorNode ?? null;
      this.requestRefresh();
    };
    root.addEventListener('click', click);
    root.addEventListener('contextmenu', select);
    root.addEventListener('input', input);
    root.addEventListener('change', input);
    root.addEventListener('dragstart', dragStart);
    root.addEventListener('dragover', dragOver);
    root.addEventListener('dragleave', dragLeave);
    root.addEventListener('drop', drop);
    root.addEventListener('dragend', dragEnd);
    root.addEventListener('keydown', nodeKeydown);
    return () => {
      root.removeEventListener('click', click); root.removeEventListener('contextmenu', select);
      root.removeEventListener('input', input); root.removeEventListener('change', input);
      root.removeEventListener('dragstart', dragStart); root.removeEventListener('dragover', dragOver);
      root.removeEventListener('dragleave', dragLeave); root.removeEventListener('drop', drop); root.removeEventListener('dragend', dragEnd);
      root.removeEventListener('keydown', nodeKeydown);
    };
  }
  private parsePropertyPath(raw?: string): PropertyPath | null {
    if (!raw) return null;
    try { const value: unknown = JSON.parse(raw); return Array.isArray(value) && value.every(part => typeof part === 'string' || typeof part === 'number') ? value as PropertyPath : null; }
    catch { return null; }
  }
  private openGeneratedNodeIdPrompt(draftId: string, nodeId: string, optionId: string): void {
    const draft = currentDraft(this.state);
    if (!draft || draft.draftId !== draftId || !isGeneratedStoryNodeId(nodeId)) return;
    const suggestion = suggestStoryNodeId(draft, nodeId, optionId);
    if (!suggestion) return;
    const ctx = createUIContext(this.ctrl.game);
    this.ctrl.modal.open({ title: '让节点 ID 更易读？', width: 440,
      body: `<p>这个节点使用系统生成的随机 ID。你可以为后续编辑和排查改成更容易识别的名称；取消只会保留局部标记绑定。</p><label class="story-editor-property">节点 ID<input data-story-generated-node-id value="${ctx.escapeHtml(suggestion)}" autocomplete="off"></label><p class="story-editor-error" data-story-generated-node-id-error hidden></p>`,
      footer: '<button type="button" class="modal-close">保留当前 ID</button><button type="button" class="primary-button" data-modal-action="rename-story-node-id">更改 ID</button>',
      onAction: action => {
        if (action !== 'rename-story-node-id' || currentDraft(this.state)?.draftId !== draftId) return;
        const input = document.querySelector<HTMLInputElement>('.app-modal [data-story-generated-node-id]');
        const requested = input?.value.trim() ?? '';
        if (!renameStoryNodeId(this.state, nodeId, requested)) {
          const error = document.querySelector<HTMLElement>('.app-modal [data-story-generated-node-id-error]');
          if (error) { error.textContent = '请输入合法且未被使用的节点 ID（字母开头，最多 64 个字母、数字、下划线或连字符）。'; error.hidden = false; }
          input?.focus();
          return;
        }
        this.state.error = null;
        this.ctrl.modal.close();
        this.requestRefresh();
      } });
    document.querySelector<HTMLInputElement>('.app-modal [data-story-generated-node-id]')?.focus();
  }
  private editStoryProperty(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
    const draft=currentDraft(this.state); const node=currentNode(this.state); const path=this.parsePropertyPath(target.dataset.storyPropertyPath);
    if(!draft||!node||!path)return;
    if(target instanceof HTMLSelectElement) {
      // An empty enumeration choice means "keep the runtime default": delete the field instead of writing ''.
      if(!target.value) { removeProperty(draft,node.id,path); return; }
      if(target.value==='__global__') { editProperty(draft,node.id,path,null); return; }
      if(target.value==='true') { editProperty(draft,node.id,path,true); return; }
      if(target.value==='false') { editProperty(draft,node.id,path,false); return; }
    }
    editProperty(draft,node.id,path,target.value);
  }
  private removeReadonlyProperty(element: HTMLElement): void {
    const draft=currentDraft(this.state); const node=currentNode(this.state); const path=this.parsePropertyPath(element.dataset.storyOptionalPath);
    if(draft&&node&&path) removeProperty(draft,node.id,path);
  }
  private propertyAction(element: HTMLElement): void {
    const draft=currentDraft(this.state); const node=currentNode(this.state); if(!draft||!node)return;
    const path=this.parsePropertyPath(element.dataset.storyRowPath ?? element.dataset.storyConditionPath ?? element.dataset.storyPath);
    if(element.dataset.storyInitBranch&&path) { toggleOptional(draft,node.id,path,true); selectBranch(draft,node.id,path,element.dataset.storyInitBranch); return; }
    if(element.dataset.storyInitCondition&&path) { toggleOptional(draft,node.id,path,true); editProperty(draft,node.id,path,{type:'AND',conditions:[]}); return; }
    if(element.dataset.storyInitObject!==undefined&&path) { toggleOptional(draft,node.id,path,true); editProperty(draft,node.id,path,{}); return; }
    if(element.dataset.storyInitValue&&path) { toggleOptional(draft,node.id,path,true); editProperty(draft,node.id,path,{}); return; }
    if(element.dataset.storyConditionAdd&&path) {
      const seed=element.dataset.storyConditionAdd==='group'?{type:'AND',conditions:[]}:{target:'alwaysTrue',key:'',comparator:'==',value:1};
      if(!Array.isArray(readProperty(draft,node.id,path)))editProperty(draft,node.id,path,[]);
      addRow(draft,node.id,path,seed); return;
    }
    const action=element.dataset.storyRowAction; const rowPath=this.parsePropertyPath(element.dataset.storyRowPath);
    if(!action||!rowPath)return;
    if(action==='add') {
      if(!Array.isArray(readProperty(draft,node.id,rowPath)))editProperty(draft,node.id,rowPath,[]);
      const row=rowPath.at(-1)==='options'?{id:`option_${crypto.randomUUID().replace(/-/g,'')}`,text:''}:{};
      addRow(draft,node.id,rowPath,row); return;
    }
    const rowId=element.dataset.storyRowId;
    if(action==='remove'&&rowId)removeRow(draft,node.id,rowPath,rowId);
    if((action==='up'||action==='down')&&rowId)moveRowBy(draft,node.id,rowPath,rowId,action==='up'?-1:1);
    if(action==='remove-index') {
      const index=Number(element.dataset.storyRowIndex); const stable=rowIdAt(draft,node.id,rowPath,index); if(stable)removeRow(draft,node.id,rowPath,stable);
    }
  }
  /** Select the failing node and remember the field; `refresh` focuses it once the patched DOM exists. */
  private locateIssue(draft: NonNullable<ReturnType<typeof currentDraft>>, issuePath: string): void {
    const parsed=splitIssuePath(issuePath);
    if(!parsed)return;
    const node=draft.document.nodes[parsed.index]; if(!node)return;
    this.state.selectedNodeId=node.id;
    this.pendingFocus=parsed.path.length?JSON.stringify(parsed.path):null;
  }
  private action(action: string): void {
    if (this.state.storageBlocked && action !== 'info') return;
    if (action === 'save-to-runtime') { this.saveToRuntime(); return; }
    if (action === 'restore-source') { this.confirmRestoreSource(); return; }
    if (['new', 'delete-node', 'up', 'down', 'send', 'click', 'operation', 'transfer', 'moveToArea', 'moveToCharaspace'].includes(action)) this.state.notice = null;
    if (action === 'new') {
      if (this.save(false, false)) newStory(this.state);
    } else if (action === 'save') this.save(true, false);
    else if (action === 'choose-sender') this.state.sidebarMode = 'senders';
    else if (action === 'info' || action === 'rename') { this.state.selectedNodeId = null; this.focusName = action === 'rename'; }
    else if (action === 'delete-node') deleteNode(this.state);
    else if (action === 'up' || action === 'down') moveNode(this.state, action === 'up' ? -1 : 1);
    else if (action === 'send' || action === 'click' || action === 'operation' || action === 'transfer' || action === 'moveToArea' || action === 'moveToCharaspace') {
      const added = appendNode(this.state, action === 'send' ? 'text' : action, storySenders(createUIContext(this.ctrl.game)));
      if (added) this.revealNodeId = added.id;
    } else if (action === 'delete-draft') this.confirmDelete();
  }
  private confirmDelete(): void {
    const draft = currentDraft(this.state);
    if (!draft || !draft.persisted && !draft.dirty) return;
    this.ctrl.modal.open({ title: '删除草稿', body: '<p>删除这份本地草稿？已注册的来源 Story 会保留。</p>',
      footer: '<button class="modal-close">取消</button><button class="mini-action mini-action--danger" data-modal-action="delete-story-draft">删除草稿</button>',
      onAction: action => {
        if (action !== 'delete-story-draft' || currentDraft(this.state) !== draft) return;
        const drafts = this.state.drafts;
        this.state.drafts = drafts.filter(item => item !== draft);
        if (!this.persistence.save(this.state, true)) { this.state.drafts = drafts; this.ctrl.modal.close(); this.requestRefresh(); return; }
        delete this.state.composers[draft.draftId];
        this.state.currentId = null;
        this.state.selectedNodeId = null;
        this.state.insertionBeforeNodeId = null;
        if (draft.sourceId) selectStory(this.state, `source:${draft.sourceId}`, this.ctrl.game.registry.stories);
        this.ctrl.modal.close();
        this.requestRefresh();
      } });
  }

  private confirmRestoreSource(): void {
    const draft = currentDraft(this.state);
    if (!draft || this.state.storageBlocked) return;
    const storyId = draft.document.id;
    const escapedName = storyId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    this.ctrl.modal.open({ title: '读取本地/系统数据', body: `<p>丢弃“${escapedName}”的本地草稿，并将当前运行中的 Story 还原到本次加载的数据包版本吗？没有来源版本的新建 Story 会从当前 Registry 移除。其他草稿和玩家存档不受影响。</p>`,
      footer: '<button class="modal-close">取消</button><button class="mini-action mini-action--danger" data-modal-action="restore-story-source">读取本地/系统数据</button>',
      onAction: action => {
        if (action !== 'restore-story-source' || currentDraft(this.state) !== draft) return;
        const previousDrafts = this.state.drafts;
        const previousCurrentId = this.state.currentId;
        const previousSelectedNodeId = this.state.selectedNodeId;
        const previousInsertionBeforeNodeId = this.state.insertionBeforeNodeId;
        const previousComposer = this.state.composers[draft.draftId];
        this.state.drafts = previousDrafts.filter(item => item !== draft);
        this.state.currentId = null;
        this.state.selectedNodeId = null;
        this.state.insertionBeforeNodeId = null;
        delete this.state.composers[draft.draftId];
        if (!this.persistence.save(this.state, true)) {
          this.state.drafts = previousDrafts;
          this.state.currentId = previousCurrentId;
          this.state.selectedNodeId = previousSelectedNodeId;
          this.state.insertionBeforeNodeId = previousInsertionBeforeNodeId;
          if (previousComposer) this.state.composers[draft.draftId] = previousComposer;
          this.ctrl.modal.close();
          this.requestRefresh();
          return;
        }
        const result = this.ctrl.commands.restoreStoryDefinition(storyId);
        if (!result.ok) {
          this.state.drafts = previousDrafts;
          this.state.currentId = previousCurrentId;
          this.state.selectedNodeId = previousSelectedNodeId;
          this.state.insertionBeforeNodeId = previousInsertionBeforeNodeId;
          if (previousComposer) this.state.composers[draft.draftId] = previousComposer;
          this.persistence.save(this.state, true);
          this.state.error = result.message;
          this.ctrl.modal.close();
          this.requestRefresh();
          return;
        }
        if (result.operation === 'restore') selectStory(this.state, `source:${storyId}`, this.ctrl.game.registry.stories);
        this.state.error = null;
        this.state.notice = result.operation === 'restore'
          ? '已读取当前加载的数据包版本；本地草稿已丢弃。'
          : '本地草稿已丢弃；该 Story 已从当前运行 Registry 移除。';
        this.ctrl.modal.close();
        this.requestRefresh();
      } });
  }
}
