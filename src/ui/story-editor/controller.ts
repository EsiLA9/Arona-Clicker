import { currentRelatedFlagCatalog, currentStoryFlagCatalog } from './flag-catalog-view';
import { changeEntryActivation, defaultEntryActivation, type EntryActivation } from './entry-activation';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { emptyStoryAuthoring, validateStoryAuthoringShape } from '../../data-services/authoring/story-authoring';
import { acceptEditorStoryRename, knownModStoryIds, planEditorStoryRename, storyEditingMod, storyEditingMods } from './identity';
import { bindFlagTableNode, canBindFlagTableNode } from './flag-table-binding';
import { copyStoryNode, pasteStoryNode, type StoryNodeClipboard } from './node-clipboard';
import { StoryNodeContextMenu } from './node-context-menu';
import { openStoryEditorDialog } from './editor-dialog';
import { openConditionTreeDialog } from './condition-tree-dialog';
import { entryConditionField, STORY_CONDITION_TARGETS } from './condition-fields';
import { openReferenceNavi, prepareReferenceNavi, referenceChoices, type ReferenceField } from './reference-navi';
import { hydrateStoryAuthoring, structuredKey, structuredRoot, editStructuredValue, writeStructuredValue, constructStructuredValue, compileStoryAuthoring, copyStoryIdentity, addStoryAuthoringRow } from './authoring-model';
import { ENTRY_FIELD_SEEDS } from './authoring-view';
import { buildStoryRelations } from './relations-model';
import { buildStoryFlagCatalog, flagImportKey, storyFlagNames } from './flag-catalog';
import { openLocalFlagNavi } from './local-flag-navi';
import { RequiredFlagDropdown, requiredFlagOptions } from './required-flag-dropdown';
import { StoryInlineTextEditor } from './inline-text';
import { currentAuthoringDraft, storyEntries, storyEditorTargetKey, type StoryEditorState, type StoryEditorTarget, type StoryEditorVisit } from './model';
import { setValueAt, valueAt, type ValuePath } from './structured-value';
import type { StoryAuthoringPreview } from '../../arona-clicker/contracts/runtime/story-authoring';
import type { UIController } from '../controller/controller';
import type { PanelState } from '../components/shared/app-shell';
import type { UIContext } from '../runtime/context';
import { createUIContext } from '../runtime/context';
import { renderWorkspaceFrame, workspaceColumns, type WorkspaceFrameSpec } from '../components/shared/workspace-frame';
import type { WorkspaceLocation, WorkspaceNavigationState } from '../workspace/workspace-router';
import { appendNode, bindStoryNodeToChoiceOption, bindStoryNodeToFlagReader, canBindStoryNodeToChoiceOption, canBindStoryNodeToFlagReader, composer, createStoryEditorState, currentDraft, currentNode, deleteNode, editNode, editNodeFlag, isGeneratedStoryNodeId, moveNode, moveNodeToInsertionPoint, newStory, renameStory, renameStoryChoiceOptionId, renameStoryLocalFlag, renameStoryNodeId, selectStory, setInsertionPoint, storyDefinitionFromDraft, suggestStoryNodeId, unbindStoryNodeFromChoiceOption } from './model';
import { StoryDraftPersistence } from './persistence';
import { createStoryEditorFrame, storySenders } from './view';
import { StoryEditorTheme } from './theme';
import { storyEditorSceneTarget } from './scene-view';
import { patchEditorDOM } from './dom';
import { hasStoryNodeOverlay } from './property-fields';
import { addRow, editProperty, editStoryNodeBody, moveRowBy, readProperty, removeProperty, removeRow, selectBranch, selectDiscriminant, selectLiteralKind, selectNodeType, selectThemeScope, toggleOptional, rowIdAt } from './property-model';
import type { Discriminator, LiteralKind, PropertyPath } from './property-model';

const DISCRIMINATORS: readonly string[] = ['kind', 'command', 'op', 'entryType', 'mode', 'valueKind', 'type', 'entityKind'];
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
function writeThemeContentValue(root: unknown,path: readonly (string|number)[],value: unknown,remove=false): boolean {
  if(!path.length||path.some(part=>typeof part==='string'&&['__proto__','constructor','prototype'].includes(part)))return false;
  let current=root as Record<string|number,unknown>;
  for(let i=0;i<path.length-1;i++){
    const key=path[i]!;let child=current[key];
    if(!child||typeof child!=='object'){child=typeof path[i+1]==='number'?[]:{};Object.defineProperty(current,key,{value:child,writable:true,enumerable:true,configurable:true});}
    current=child as Record<string|number,unknown>;
  }
  const key=path.at(-1)!;if(Array.isArray(current)&&typeof key==='number'){if(remove)current.splice(key,1);else current[key]=value;return true;}
  if(typeof key==='string'){if(remove)delete current[key];else Object.defineProperty(current,key,{value,writable:true,enumerable:true,configurable:true});return true;}
  return false;
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
  private readonly inspectorScroll = new Map<string,number>();
  private readonly inspectorTabs = new Map<string,StoryEditorState['storyInspectorTab']>();
  private readonly entryTabScroll = new Map<string,Partial<Record<'basic'|'rewards'|'gates',number>>>();
  private readonly entryTabs = new Map<string,'basic'|'rewards'|'gates'>();
  private pendingInspectorScroll?: number;
  private pendingEntryScroll?: number;
  private nodeClipboard?: StoryNodeClipboard;
  private readonly nodeMenu = new StoryNodeContextMenu();
  private overlayDrag?: { pointerId: number; draftId: string; nodeId: string; path: PropertyPath; overlay: HTMLElement; canvas: HTMLElement; pixels: boolean; x: number; y: number; baseX: number; baseY: number; offsetX: number; offsetY: number };
  private returnState?: { location: WorkspaceLocation; navigation?: WorkspaceNavigationState; workspace: PanelState['workspace']; mapEntrySource: PanelState['mapEntrySource']; init: string | null };
  private revealNodeId: string | null = null;
  private focusName = false;
  /** Node-relative property path JSON to focus after the next refresh; set by issue location. */
  private pendingFocus?: string | null;
  private preview?: StoryAuthoringPreview;
  private previewTimer?: ReturnType<typeof setInterval>;
  private previewSignature = '';
  private pendingVisit?: StoryEditorVisit;
  private selectionNaviOpen = false;
  private editorDialog?: HTMLElement;
  private readonly requiredFlagDropdown: RequiredFlagDropdown;
  private readonly inlineText: StoryInlineTextEditor;
  constructor(private readonly ctrl: UIController, readonly persistence = new StoryDraftPersistence()) {
    this.inlineText = new StoryInlineTextEditor(ctrl.root, ctrl.game, () => this.isOpen() ? currentDraft(this.state) : undefined,
      () => this.state.storageBlocked, nodeId => {
        if (nodeId !== this.state.selectedNodeId) this.closeThemeContentEdit();
        this.rememberInspectorScroll(); this.state.inspectorView = 'node'; this.pendingInspectorScroll = undefined;
        this.state.selectedNodeId = nodeId;
      }, () => this.requestRefresh());
    this.requiredFlagDropdown = new RequiredFlagDropdown(ctrl.root,
      () => this.isOpen() ? JSON.stringify([this.state.target,this.state.selectedNodeId]) : '',
      () => requiredFlagOptions(this.state,buildStoryRelations(this.state,ctrl.game.registry.stories,ctrl.game.registry.storyEntries)));
  }

  private inspectorScrollKey(): string { return JSON.stringify([this.state.target,this.state.storyInspectorTab]); }
  private rememberInspectorScroll(): void {
    if (this.state.target?.kind !== 'story' || this.state.inspectorView !== 'story' && currentNode(this.state)) return;
    this.inspectorTabs.set(this.state.target.id,this.state.storyInspectorTab);
    const body = this.ctrl.root.querySelector<HTMLElement>('.story-editor-right .workspace-column__body');
    if (body) this.inspectorScroll.set(this.inspectorScrollKey(),this.pendingInspectorScroll ?? body.scrollTop);
  }
  private restoreInspectorScroll(): void { this.pendingInspectorScroll = this.inspectorScroll.get(this.inspectorScrollKey()) ?? 0; }
  private storyKey(storyId: string): string | undefined {
    return this.state.drafts.find(draft => draft.document.id === storyId)?.draftId
      ?? (this.ctrl.game.registry.stories.has(storyId) ? `source:${storyId}` : undefined);
  }
  private captureVisit(): StoryEditorVisit | undefined {
    const target = this.state.target;
    if (!target) return;
    return { target: { ...target }, selectedNodeId: this.state.selectedNodeId, insertionBeforeNodeId: this.state.insertionBeforeNodeId,
      centerScroll: this.ctrl.root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body')?.scrollTop ?? 0,
      rightScroll: this.pendingInspectorScroll ?? this.ctrl.root.querySelector<HTMLElement>('.story-editor-right .workspace-column__body')?.scrollTop ?? 0 };
  }
  private rememberVisit(): void {
    const visit = this.captureVisit();
    if (!visit) return;
    if (this.state.visitIndex >= 0) this.state.visits[this.state.visitIndex] = visit;
    else { this.state.visits.push(visit); this.state.visitIndex = this.state.visits.length - 1; }
  }
  private pushVisit(): void {
    const visit = this.captureVisit();
    if (!visit) return;
    visit.centerScroll = visit.rightScroll = 0;
    this.state.visits.splice(this.state.visitIndex + 1);
    this.state.visits.push(visit);
    if (this.state.visits.length > 50) this.state.visits.shift();
    this.state.visitIndex = this.state.visits.length - 1;
  }
  private browseStory(key: string): void {
    const id = this.state.drafts.find(draft => draft.draftId === key)?.document.id ?? (key.startsWith('source:') ? key.slice(7) : undefined);
    if (id) this.browseTarget({ kind: 'story', id });
  }
  private hasTarget(target: StoryEditorTarget): boolean {
    return target.kind === 'story' ? !!this.storyKey(target.id) : storyEntries(this.state, this.ctrl.game.registry.storyEntries).has(target.id);
  }
  private browseTarget(target: StoryEditorTarget, historyIndex?: number): void {
    if (!this.hasTarget(target) || historyIndex === undefined && this.state.target?.kind === target.kind && this.state.target.id === target.id) return;
    const keepFlagInspector = this.state.storyInspectorTab === 'flags' && (this.state.inspectorView === 'story' || !currentNode(this.state));
    if (!this.save(false, false)) return;
    this.nodeMenu.close(); this.closeSelectionNavi();
    this.closeEditorDialog();
    this.requiredFlagDropdown.close();
    this.rememberInspectorScroll();
    this.rememberVisit();
    if(this.state.target?.kind==='entry'){
      const body=this.ctrl.root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body');
      const scrolls=this.entryTabScroll.get(this.state.target.id)??{};
      scrolls[this.state.entryEditorTab??'basic']=body?.scrollTop??0;
      this.entryTabScroll.set(this.state.target.id,scrolls);
      this.entryTabs.set(this.state.target.id,this.state.entryEditorTab??'basic');
    }
    const visit = historyIndex === undefined
      ? [...this.state.visits].reverse().find(visit => visit.target.kind === target.kind && visit.target.id === target.id)
      : this.state.visits[historyIndex];
    this.closeAuthoringPreview(); this.closeThemeContentEdit();
    if (target.kind === 'story') {
      if (!selectStory(this.state, this.storyKey(target.id)!, this.ctrl.game.registry.stories)) return;
      this.state.targetPackId = currentDraft(this.state)?.targetPackId ?? this.state.targetPackId;
    } else {
      const entry = storyEntries(this.state, this.ctrl.game.registry.storyEntries).get(target.id)!;
      const owner = [...this.state.drafts].reverse().find(draft => [...(draft.authoring?.activeStories ?? []), ...(draft.authoring?.passiveStories ?? [])].some(row => row.id === target.id));
      if (!owner) {
        const key = this.storyKey(entry.storyId);
        if (!key || !selectStory(this.state, key, this.ctrl.game.registry.stories)) return;
        hydrateStoryAuthoring(currentDraft(this.state)!, this.ctrl.game.registry);
      }
      this.state.target = { ...target };
      this.state.selectedNodeId = null;
      this.state.insertionBeforeNodeId = null;
      this.state.entryEditorTab=this.entryTabs.get(target.id)??'basic';
      this.pendingEntryScroll=this.entryTabScroll.get(target.id)?.[this.state.entryEditorTab]??0;
    }
    this.revealNodeId = null; this.pendingFocus = undefined; this.focusName = false;
    if (visit && target.kind === 'story') {
      const nodes = currentDraft(this.state)!.document.nodes;
      this.state.selectedNodeId = nodes.some(node => node.id === visit.selectedNodeId) ? visit.selectedNodeId : null;
      this.state.insertionBeforeNodeId = nodes.some(node => node.id === visit.insertionBeforeNodeId) ? visit.insertionBeforeNodeId : null;
    }
    this.state.inspectorView = keepFlagInspector ? 'story' : this.state.selectedNodeId ? 'node' : 'story';
    if (target.kind === 'story') this.state.storyInspectorTab = keepFlagInspector ? 'flags' : this.inspectorTabs.get(target.id) ?? 'overview';
    this.pendingInspectorScroll = undefined;
    if (historyIndex !== undefined) this.state.visitIndex = historyIndex;
    else this.pushVisit();
    this.pendingVisit = visit;
    if (keepFlagInspector && target.kind === 'story') this.restoreInspectorScroll();
    this.state.notice = null;
  }
  private browseHistory(direction: -1 | 1): void {
    for (let index = this.state.visitIndex + direction; index >= 0 && index < this.state.visits.length; index += direction) {
      const target = this.state.visits[index].target;
      if (this.hasTarget(target)) { this.browseTarget(target, index); return; }
    }
  }

  isOpen(): boolean { return !this.disposed && this.ctrl.panelState.workspaceNavigation?.current.kind === 'story-editor'; }
  dispose(): void {
    this.inlineText.dispose();
    this.requiredFlagDropdown.dispose();
    this.nodeMenu.close(); this.closeSelectionNavi();
    this.closeEditorDialog();
    this.closeAuthoringPreview();
    this.closeThemeContentEdit();
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
    const initialTheme = this.ctrl.selectorPage.currentTheme() ?? this.ctrl.game.colorSystem.runtimeTheme();
    if (this.state.uiTheme) this.state.uiTheme.setInitial(initialTheme);
    else this.state.uiTheme = new StoryEditorTheme(this.ctrl.game, initialTheme);
    const panel = this.ctrl.panelState;
    this.returnState = { location: this.ctrl.workspaceLocation(), navigation: panel.workspaceNavigation, workspace: panel.workspace, mapEntrySource: panel.mapEntrySource, init: this.ctrl.game.state.activeInit };
    panel.storyEditor = this.state;
    this.ctrl.enterWorkspaceRoute({ kind: 'story-editor' });
    panel.workspace = undefined;
    this.ctrl.render();
  }
  configureFrame(frame: WorkspaceFrameSpec): WorkspaceFrameSpec {
    return { ...frame, onBack: () => this.close(), columns: workspaceColumns(frame).map(column => ({ ...column,
      onBack: column.key === 'story-editor-inspector' ? () => { this.action('info'); this.requestRefresh(); } : column.onBack,
      bind: root => this.bind(root) })) };
  }
  save(manual = false, refresh = true): boolean {
    this.inlineText.finish();
    if (!this.loaded) return true;
    const draft = currentAuthoringDraft(this.state);
    if (manual && draft && !draft.persisted) draft.dirty = true;
    const saved = this.persistence.save(this.state);
    if (refresh && this.isOpen()) this.requestRefresh();
    return saved;
  }
  saveToRuntime(): boolean {
    const draft = currentDraft(this.state);
    if (!draft || this.state.storageBlocked) return false;
    if (draft.renamedFromId && draft.renamedFromId !== draft.document.id && this.ctrl.game.registry.stories.has(draft.renamedFromId)) {
      this.state.error = '此 Story 已在 Mod 中更改 ID，请先重新载入该 Mod。'; this.requestRefresh(); return false;
    }
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
    this.closeAuthoringPreview();
    if (!this.isOpen()) return true;
    const saved = this.save(false, false);
    if (saved) { this.nodeMenu.close(); this.closeSelectionNavi(); this.closeEditorDialog(); this.requiredFlagDropdown.close(); this.closeThemeContentEdit(); }
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
    this.nodeMenu.close(); this.closeSelectionNavi();
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
    const draft = currentDraft(this.state);
    if (draft) hydrateStoryAuthoring(draft, this.ctrl.game.registry);
    const frame = this.configureFrame(createStoryEditorFrame(ctx, this.state));
    const template = document.createElement('template');
    template.innerHTML = renderWorkspaceFrame(ctx, frame);
    const current = this.ctrl.root.querySelector<HTMLElement>('[data-workspace-frame="story-editor"]');
    const next = template.content.firstElementChild as HTMLElement;
    this.inlineText.prepare(next);
    prepareReferenceNavi(next);
    if (!current) {
      const page = this.ctrl.root.querySelector<HTMLElement>('.workspace-page-content');
      if (!page) return false;
      this.ctrl.columns.mount(page, ctx, frame);
    } else {
      const oldBinding = current.querySelector<HTMLElement>('[data-column-binding]')?.dataset.columnBinding;
      const active = document.activeElement instanceof HTMLElement && current.contains(document.activeElement) ? document.activeElement : null;
      patchEditorDOM(current, next, root => { this.nodeMenu.dismissBeforeMutation(root); this.ctrl.popovers.dismissBeforeRootMutation(root); });
      this.nodeMenu.retainIfAnchored();
      this.ctrl.columns.adopt(this.ctrl.root, ctx, frame);
      if (oldBinding !== storyEditorTargetKey(this.state)) {
        for (const column of current.querySelectorAll<HTMLElement>('.story-editor-center, .story-editor-right')) {
          const body = column.querySelector<HTMLElement>('.workspace-column__body');
          if (body) body.scrollTop = 0;
        }
      }
      if (active?.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
    }
    if (this.pendingVisit) {
      for (const panel of ['center', 'right'] as const) {
        const body = this.ctrl.root.querySelector<HTMLElement>(`.story-editor-${panel} .workspace-column__body`);
        if (body) body.scrollTop = this.pendingVisit[`${panel}Scroll`];
      }
      this.pendingVisit = undefined;
    }
    if (this.pendingInspectorScroll !== undefined) {
      const body = this.ctrl.root.querySelector<HTMLElement>('.story-editor-right .workspace-column__body');
      if (body) body.scrollTop = this.pendingInspectorScroll;
      this.pendingInspectorScroll = undefined;
    }
    if (this.pendingEntryScroll !== undefined) {
      const body = this.ctrl.root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body');
      if (body) body.scrollTop = this.pendingEntryScroll;
      this.pendingEntryScroll = undefined;
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
    this.requiredFlagDropdown.refresh();
    return true;
  }
  private focusIssueField(raw: string | null): void {
    if (!raw) { this.ctrl.root.querySelector<HTMLElement>('[data-story-node-type]')?.focus({ preventScroll: true }); return; }
    for (const control of this.ctrl.root.querySelectorAll<HTMLElement>('[data-story-property-path]')) {
      if (control.dataset.storyPropertyPath === raw) { control.focus({ preventScroll: true }); return; }
    }
  }
  bind(root: HTMLElement): () => void {
    this.inlineText.prepare(root);
    prepareReferenceNavi(root);
    const select = (event: Event): void => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null;
      if (!target || !root.contains(target)) return;
      if (event.type === 'contextmenu') event.preventDefault();
      this.rememberInspectorScroll(); this.state.inspectorView = 'node'; this.pendingInspectorScroll = undefined;
      const selected=target.dataset.editorNode??null;if(selected!==this.state.selectedNodeId)this.closeThemeContentEdit();this.state.selectedNodeId = selected;
      this.requestRefresh();
    };
    const contextMenu = (event: MouseEvent): void => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element || element.closest('input, textarea, select, [contenteditable]')) return;
      const gap = element.closest<HTMLElement>('[data-story-insertion-before], [data-story-insertion-end]');
      const node = element.closest<HTMLElement>('[data-editor-node]');
      const anchor = gap ?? node;
      const draft = currentDraft(this.state), targetId = this.state.target?.id;
      if (!anchor || !root.contains(anchor) || !draft || this.state.target?.kind !== 'story') return;
      event.preventDefault();
      const live = () => this.isOpen() && anchor.isConnected && currentDraft(this.state) === draft && this.state.target?.kind === 'story' && this.state.target.id === targetId;
      if (gap) {
        const before = gap.hasAttribute('data-story-insertion-end') ? null : gap.dataset.storyInsertionBefore!;
        if (!setInsertionPoint(this.state,before)) return;
        this.requestRefresh();
        this.nodeMenu.open(anchor,event.clientX,event.clientY,'粘贴',!this.nodeClipboard || this.state.storageBlocked,() => {
          if (!live() || !this.nodeClipboard) return;
          const pasted = pasteStoryNode(this.state,this.nodeClipboard,before);
          if (!pasted) return;
          this.state.inspectorView = 'node'; this.state.error = null; this.state.notice = `已粘贴节点 ${pasted.id}`; this.requestRefresh();
        });
      } else {
        select(event);
        const nodeId = node!.dataset.editorNode!;
        this.nodeMenu.open(anchor,event.clientX,event.clientY,'复制',false,() => {
          if (!live()) return;
          const copied = copyStoryNode(draft,nodeId);
          if (!copied) return;
          this.nodeClipboard = copied; this.state.notice = `已复制节点 ${nodeId}`; this.requestRefresh();
        });
      }
    };
    const click = (event: Event): void => {
      const referenceNavi = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-reference-navi]') : null;
      if (referenceNavi && root.contains(referenceNavi)) {
        event.preventDefault();
        const field = referenceNavi.closest('[data-reference-control]')?.querySelector<ReferenceField>('[data-story-reference]');
        if (!referenceNavi.disabled && field) this.openContentNavi(field);
        return;
      }
      const flagNavi = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-local-flag-navi]') : null;
      if (flagNavi && root.contains(flagNavi)) {
        event.preventDefault();
        const input = flagNavi.closest('label')?.querySelector<HTMLInputElement>('input');
        if (!flagNavi.disabled && input && !input.disabled && !input.readOnly) this.openFlagNavi(input,flagNavi.hasAttribute('data-local-flag-internal'));
        return;
      }
      const flagImport = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-story-flag-import]') : null;
      if (flagImport && root.contains(flagImport)) {
        if (!flagImport.disabled) this.confirmFlagImport(flagImport.dataset.storyFlagImport ?? '');
        return;
      }
      const storyLink = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-editor-story-target]') : null;
      if (storyLink && root.contains(storyLink)) {
        if (!storyLink.disabled) {
          const key = this.storyKey(storyLink.dataset.editorStoryTarget ?? '');
          if (key) {
            this.browseStory(key);
            const nodeId = storyLink.dataset.storyFlagNode;
            if (nodeId && currentDraft(this.state)?.document.nodes.some(node => node.id === nodeId)) {
              if (!storyLink.closest('.story-editor-flag-catalog')) this.state.inspectorView = 'node';
              this.state.selectedNodeId = nodeId; this.revealNodeId = nodeId;
            }
          }
          this.requestRefresh();
        }
        return;
      }
      const designerTarget=event.target instanceof Element?event.target.closest<HTMLElement>('[data-column-action^="story-editor-designer:"], [data-story-reset-design], [data-story-display-target]'):null;
      if(designerTarget&&root.contains(designerTarget)&&!(designerTarget instanceof HTMLButtonElement&&designerTarget.disabled)) {
        const draft=currentDraft(this.state),node=currentNode(this.state);
        const group = designerTarget.dataset.storyResetDesign;
        if ((group === 'appearance' || group === 'performance') && draft && node && !this.state.storageBlocked) {
          removeProperty(draft,node.id,[group]);
          const prefix=`${node.id}|[${JSON.stringify(group)}`;
          for(const bucket of [draft.editorState?.branches,draft.editorState?.optionals,draft.editorState?.optionalPaths,draft.editorState?.optionalBranches,draft.editorState?.rawInputs]) if(bucket) for(const key of Object.keys(bucket)) if(key.startsWith(prefix)) delete bucket[key];
        } else if(designerTarget.dataset.storyDisplayTarget) {
          this.browseTarget({kind:'story',id:designerTarget.dataset.storyDisplayTarget});this.state.selectedNodeId=designerTarget.dataset.storyDisplayNode??null;this.state.inspectorView='node';
        } else {const page=designerTarget.dataset.columnAction?.slice('story-editor-designer:'.length);if(page==='basic'||page==='appearance'||page==='performance')this.state.nodeDesignerTab=page;}
        this.requestRefresh();return;
      }
      const contentTarget=event.target instanceof Element?event.target.closest<HTMLElement>('[data-story-theme-content-open], [data-theme-content-action]'):null;
      if(contentTarget&&root.contains(contentTarget)&&!(contentTarget instanceof HTMLButtonElement&&contentTarget.disabled)){this.themeContentClick(contentTarget);this.requestRefresh();return;}
      const performanceToggle=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-story-performance-toggle]'):null;
      if(performanceToggle&&root.contains(performanceToggle)) {
        const draft=currentDraft(this.state),id=performanceToggle.dataset.storyPerformanceToggle;
        const node=draft?.document.nodes.find(node=>node.id===id);
        if(draft&&node&&!performanceToggle.disabled&&!this.state.storageBlocked&&hasStoryNodeOverlay(node)) {
          const sessions=this.state.performanceEditing??={};
          const editing=sessions[draft.draftId]??[];
          if(editing.includes(node.id)) {
            sessions[draft.draftId]=editing.filter(id=>id!==node.id);
            this.requestRefresh();
          } else {
            sessions[draft.draftId]=[...editing,node.id];
            if(node.type==='talklet'||node.type==='click') this.state.nodeDesignerTab='performance';
            select(event);
          }
        }
        return;
      }
      const positionTool = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-story-position-x], [data-story-position-y], [data-story-position-unit]') : null;
      if (positionTool && root.contains(positionTool)) {
        if (!positionTool.disabled && !this.state.storageBlocked) this.applyPositionTool(positionTool);
        return;
      }
      const overlayPreset=event.target instanceof Element?event.target.closest<HTMLElement>('[data-story-overlay-preset]'):null;
      if(overlayPreset&&root.contains(overlayPreset)&&!(overlayPreset instanceof HTMLButtonElement&&overlayPreset.disabled)){
        const draft=currentDraft(this.state);const node=currentNode(this.state);const path=this.parsePropertyPath(overlayPreset.dataset.storyOverlayPath);
        const placements:Record<string,readonly[number,number,'left'|'center'|'right']>={'top-left':[.08,.9,'left'],'top-center':[.5,.9,'center'],'top-right':[.92,.9,'right'],'bottom-left':[.08,.1,'left'],'bottom-center':[.5,.1,'center'],'bottom-right':[.92,.1,'right']};
        const placement=placements[overlayPreset.dataset.storyOverlayPreset??''];
        if(draft&&node&&path&&placement){editProperty(draft,node.id,[...path,'x'],placement[0]);editProperty(draft,node.id,[...path,'y'],placement[1]);editProperty(draft,node.id,[...path,'align'],placement[2]);}
        this.requestRefresh();return;
      }
      const themeTarget = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-theme-add], [data-story-theme-remove], [data-story-theme-add-key], [data-story-theme-add-palette], [data-story-theme-add-background]') : null;
      if (themeTarget && root.contains(themeTarget) && !(themeTarget instanceof HTMLButtonElement && themeTarget.disabled)) {
        const draft=currentDraft(this.state); const node=currentNode(this.state);
        if(draft&&node) {
          const path=this.parsePropertyPath(themeTarget.dataset.storyThemeAdd ?? themeTarget.dataset.storyThemeRemove ?? themeTarget.dataset.storyThemeAddKey ?? themeTarget.dataset.storyThemeAddPalette ?? themeTarget.dataset.storyThemeAddBackground);
          if(path&&themeTarget.dataset.storyThemeAdd) editProperty(draft,node.id,path,themeTarget.dataset.storyThemeValue ?? '');
          else if(path&&themeTarget.dataset.storyThemeRemove) removeProperty(draft,node.id,path);
          else if(path&&themeTarget.dataset.storyThemeAddKey) {
            const name=themeTarget.parentElement?.querySelector<HTMLInputElement>('[data-story-theme-key]')?.value.trim() ?? '';
            if(!name||['__proto__','constructor','prototype'].includes(name)||readProperty(draft,node.id,[...path,name])!==undefined) this.state.error='请输入未重复的合法键名。';
            else { editProperty(draft,node.id,[...path,name],''); this.state.error=null; }
          } else if(path&&themeTarget.dataset.storyThemeAddPalette) {
            const theme=valueAt(node,path.slice(0,-1)) as {colorGroupId?:string;palette?:unknown[]} | undefined;
            const group=theme?.colorGroupId?this.ctrl.game.registry.colorGroups.get(theme.colorGroupId):undefined;
            const inherited=group?.slots.map(slot=>slot.color).slice(0,6) ?? [];
            const colors=readProperty(draft,node.id,path);
            if(!Array.isArray(colors)) editProperty(draft,node.id,path,inherited);
            else addRow(draft,node.id,path,inherited[colors.length] ?? inherited.at(-1) ?? '');
          } else if(path&&themeTarget.dataset.storyThemeAddBackground) {
            if(!Array.isArray(readProperty(draft,node.id,path))) editProperty(draft,node.id,path,[]);
            addRow(draft,node.id,path,{id:`story-bg-${crypto.randomUUID().replace(/-/g,'')}`,kind:'solid',value:'var(--bg)'});
          }
        }
        this.requestRefresh(); return;
      }
      const conditionTrigger = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-entry-condition]') : null;
      if (conditionTrigger && root.contains(conditionTrigger)) {
        if (!conditionTrigger.disabled) this.editEntryCondition(conditionTrigger);
        return;
      }
      const authorTarget = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-value-action], [data-authoring-add], [data-authoring-init-rewards], [data-authoring-add-condition-reward], [data-authoring-copy], [data-authoring-catalog], [data-authoring-action], [data-authoring-preview-option]') : null;
      if (authorTarget && root.contains(authorTarget)) { this.authoringClick(authorTarget); this.requestRefresh(); return; }
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-insertion-before], [data-story-insertion-end], [data-editor-action], [data-editor-story], [data-editor-entry], [data-editor-entry-target], [data-editor-sender], [data-column-action^="story-editor-entry-tab:"], [data-column-action^="story-editor-inspector-tab:"], [data-column-action^="story-editor-sidebar:"], [data-column-action^="story-editor-node-type:"], [data-story-row-action], [data-story-condition-add], [data-story-init-branch], [data-story-init-condition], [data-story-init-object], [data-story-init-value], [data-story-remove-readonly], [data-story-rename-node-id], [data-story-rename-option-id], [data-story-choice-flag-unbind]') : null;
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
      const inspectorTab = element.dataset.columnAction?.startsWith('story-editor-inspector-tab:') ? element.dataset.columnAction.slice('story-editor-inspector-tab:'.length) : undefined;
      const entryTab = element.dataset.columnAction?.startsWith('story-editor-entry-tab:') ? element.dataset.columnAction.slice('story-editor-entry-tab:'.length) : undefined;
      if (entryTab && ['basic','rewards','gates'].includes(entryTab) && this.state.target?.kind==='entry') {
        if (entryTab !== this.state.entryEditorTab) this.closeEditorDialog();
        const body=this.ctrl.root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body');
        const scrolls=this.entryTabScroll.get(this.state.target.id)??{};
        scrolls[this.state.entryEditorTab??'basic']=body?.scrollTop??0;
        this.entryTabScroll.set(this.state.target.id,scrolls);
        this.state.entryEditorTab=entryTab as NonNullable<StoryEditorState['entryEditorTab']>;
        this.entryTabs.set(this.state.target.id,this.state.entryEditorTab);
        this.pendingEntryScroll=scrolls[this.state.entryEditorTab]??0;
      } else if (inspectorTab && ['overview','relations','flags','tools'].includes(inspectorTab)) {
        this.rememberInspectorScroll(); this.state.inspectorView = 'story';
        this.state.storyInspectorTab = inspectorTab as typeof this.state.storyInspectorTab; this.restoreInspectorScroll();
      } else if (element.dataset.storyRenameNodeId) this.openNodeIdPrompt(element.dataset.storyRenameNodeId, element.dataset.storyRenameNodeId);
      else if (element.hasAttribute('data-story-rename-option-id')) this.openChoiceOptionIdPrompt(element);
      else if (element.hasAttribute('data-story-choice-flag-unbind')) {
        const draft=currentDraft(this.state); const optionIndex=Number(element.dataset.storyOptionIndex);
        const choiceNodeId=element.dataset.storyChoiceNode, optionId=element.dataset.storyOptionId;
        const flagName=element.dataset.storyFlagName, targetNodeId=element.dataset.storyNodeId;
        const removed=draft&&Number.isInteger(optionIndex)&&choiceNodeId&&optionId&&flagName&&targetNodeId
          ? unbindStoryNodeFromChoiceOption(draft,choiceNodeId,optionIndex,optionId,flagName,targetNodeId) : false;
        this.state.error=removed?null:'该局部标记关联已变化，请刷新后重试。';
      }
      else if (nodeTypeTab && ['talklet', 'click', 'operation', 'transfer', 'moveToArea', 'moveToCharaspace'].includes(nodeTypeTab)) {
        const draft = currentDraft(this.state);
        const node = currentNode(this.state);
        if (draft && node && selectNodeType(draft, node.id, nodeTypeTab as import('./property-model').StoryNodeType)) {
          const next = currentNode(this.state);
          if (next?.type !== node.type) {
            this.state.nodeDesignerTab = 'basic';
            if (this.state.performanceEditing && (!next || !hasStoryNodeOverlay(next) || next.type === 'operation' || node.type === 'operation')) {
              this.state.performanceEditing[draft.draftId] = this.state.performanceEditing[draft.draftId]?.filter(id => id !== node.id) ?? [];
            }
          }
        }
      } else if (sidebarTab === 'stories' || sidebarTab === 'entries' || sidebarTab === 'senders') this.state.sidebarMode = sidebarTab;
      else if (sender) {
        const draft = currentDraft(this.state);
        if (draft && storySenders(createUIContext(this.ctrl.game)).some(item => item.id === sender)) composer(this.state).sender = sender;
      } else if (element.dataset.editorEntry || element.dataset.editorEntryTarget) {
        this.browseTarget({ kind: 'entry', id: (element.dataset.editorEntry ?? element.dataset.editorEntryTarget)! });
      } else if (source) {
        this.browseStory(source);
      } else if (element.hasAttribute('data-story-remove-readonly')) this.removeReadonlyProperty(element);
      else if (element.dataset.storyRowAction || element.dataset.storyConditionAdd || element.dataset.storyInitBranch || element.dataset.storyInitCondition || element.dataset.storyInitObject !== undefined || element.dataset.storyInitValue) this.propertyAction(element);
      else this.action(element.dataset.editorAction ?? '', element);
      this.requestRefresh();
    };
    const input = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      if(target.hasAttribute('data-theme-content-path')){
        const edit=this.state.themeContentEdit;const path=this.parsePropertyPath(target.dataset.themeContentPath);if(!edit||!path)return;
        let value:unknown=target.value;
        if(target.dataset.themeContentKind==='boolean')value=target.value==='true';
        else if(target.dataset.themeContentKind==='number'&&target.value.trim()&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(target.value)&&Number.isFinite(Number(target.value)))value=Number(target.value);
        writeThemeContentValue(edit.draft,path,value);edit.error=undefined;this.requestRefresh();return;
      }
      if (this.state.storageBlocked && !target.hasAttribute('data-editor-search') && !target.hasAttribute('data-editor-entry-search') && !target.hasAttribute('data-editor-sender-search')) return;
      const draft = currentDraft(this.state); const node = currentNode(this.state);
      if (this.authoringInput(target, event.type)) { this.requestRefresh(); return; }
      if (draft && target.hasAttribute('data-story-body-node')) {
        const nodeId = target.dataset.storyBodyNode;
        if (nodeId && node?.id === nodeId) editStoryNodeBody(draft, nodeId, target.value);
        this.requestRefresh(); return;
      }
      const senders = storySenders(createUIContext(this.ctrl.game));
      if (target.hasAttribute('data-editor-search')) this.state.search = target.value;
      else if (target.hasAttribute('data-editor-entry-search')) this.state.entrySearch = target.value;
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
      if(event.target instanceof Element&&event.target.closest('[data-story-performance-toggle], [data-story-overlay-canvas]')) {event.preventDefault();return;}
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
      const flagRow = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-drop-target="story-flag-table"]') : null;
      if (flagRow && root.contains(flagRow)) {
        const draft = currentDraft(this.state), nodeId = this.draggingNodeId;
        if (!draft || this.state.target?.kind !== 'story' || this.state.storageBlocked || !nodeId || !event.dataTransfer?.types.includes(STORY_EDITOR_DRAG_TYPE)) return;
        for (const row of root.querySelectorAll('[data-story-drop-target="story-flag-table"]')) row.classList.remove('is-drop-target','is-drop-invalid');
        const plan = flagRow.dataset.storyFlagKind === 'local' ? canBindFlagTableNode(draft,currentRelatedFlagCatalog(createUIContext(this.ctrl.game),this.state),flagRow.dataset.storyFlagName!,flagRow.dataset.storyFlagScope!,nodeId) : {ok:false};
        flagRow.classList.toggle('is-drop-target',plan.ok); flagRow.classList.toggle('is-drop-invalid',!plan.ok);
        event.preventDefault(); event.dataTransfer.dropEffect = plan.ok ? 'move' : 'none'; return;
      }
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
      const flagRow = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-drop-target="story-flag-table"]') : null;
      if (flagRow && !(event.relatedTarget instanceof Node && flagRow.contains(event.relatedTarget))) flagRow.classList.remove('is-drop-target','is-drop-invalid');
      const flow = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-flow') : null;
      if (!flow || event.relatedTarget instanceof Node && flow.contains(event.relatedTarget)) return;
      clearStoryFlagDropStates(flow);
      highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
    };
    const drop = (event: DragEvent): void => {
      const flagRow = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-drop-target="story-flag-table"]') : null;
      if (flagRow && root.contains(flagRow)) {
        const draft = currentDraft(this.state), item = readStoryDragItem(event);
        if (!draft || this.state.target?.kind !== 'story' || this.state.storageBlocked || !item || item.draftId !== draft.draftId) return;
        event.preventDefault();
        const result = flagRow.dataset.storyFlagKind === 'local' ? bindFlagTableNode(draft,currentRelatedFlagCatalog(createUIContext(this.ctrl.game),this.state),flagRow.dataset.storyFlagName!,flagRow.dataset.storyFlagScope!,item.nodeId) : {ok:false,reason:'全局标记不能作为节点的局部执行条件。'};
        this.state.error = result.ok ? null : result.reason;
        this.state.inspectorView = 'story'; this.state.storyInspectorTab = 'flags';
        for (const row of root.querySelectorAll('[data-story-drop-target="story-flag-table"]')) row.classList.remove('is-drop-target','is-drop-invalid');
        this.requestRefresh(); return;
      }
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
      for (const row of root.querySelectorAll('[data-story-drop-target="story-flag-table"]')) row.classList.remove('is-drop-target','is-drop-invalid');
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null;
      target?.classList.remove('is-dragging');
      this.draggingNodeId = null;
      const flow = target?.closest<HTMLElement>('.story-editor-flow');
      if (flow) { clearStoryFlagDropStates(flow); highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId); }
    };
    const overlayPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || this.state.storageBlocked) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-chat-text]') : null;
      const canvas = target?.closest<HTMLElement>('[data-story-overlay-canvas]'); const draft = currentDraft(this.state);
      const node = draft?.document.nodes.find(node=>node.id===canvas?.dataset.storyOverlayNode);
      const path = this.parsePropertyPath(canvas?.dataset.storyOverlayPath);
      if (!target || !canvas || !draft || canvas.dataset.storyOverlayDraft!==draft.draftId || !node || !path || !root.contains(canvas)) return;
      const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const positionX = target.style.getPropertyValue('--story-overlay-x');
      const pixels = positionX.endsWith('px');
      const x = Number.parseFloat(positionX) / (pixels ? 1 : 100);
      const y = Number.parseFloat(target.style.getPropertyValue('--story-overlay-y')) / (pixels ? 1 : 100);
      const baseX = (Number.parseFloat(target.style.getPropertyValue('--story-overlay-base-x')) || 0) / 100;
      const baseY = (Number.parseFloat(target.style.getPropertyValue('--story-overlay-base-y')) || 0) / 100;
      const pointX = Math.min(1, Math.max(0, baseX + (pixels ? x/rect.width : x)));
      const pointY = Math.min(1, Math.max(0, baseY + (pixels ? y/rect.height : y)));
      this.overlayDrag = { pointerId: event.pointerId, draftId: draft.draftId, nodeId: node.id, path, overlay: target, canvas, pixels, x, y, baseX, baseY,
        offsetX:(event.clientX-rect.left)/rect.width-pointX,
        offsetY:(rect.bottom-event.clientY)/rect.height-pointY };
      canvas.setPointerCapture(event.pointerId); target.classList.add('is-positioning'); event.preventDefault();
    };
    const overlayPointerMove = (event: PointerEvent): void => {
      const drag = this.overlayDrag; if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = drag.canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      if(!drag.canvas.isConnected||currentDraft(this.state)?.draftId!==drag.draftId) {this.overlayDrag=undefined;return;}
      const pointX = Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width-drag.offsetX));
      const pointY = Math.min(1,Math.max(0,(rect.bottom-event.clientY)/rect.height-drag.offsetY));
      drag.x = (pointX - drag.baseX) * (drag.pixels ? rect.width : 1);
      drag.y = (pointY - drag.baseY) * (drag.pixels ? rect.height : 1);
      drag.overlay.style.setProperty('--story-overlay-x', drag.pixels ? `${drag.x}px` : `${drag.x*100}%`);
      drag.overlay.style.setProperty('--story-overlay-y', drag.pixels ? `${drag.y}px` : `${drag.y*100}%`);
      for (const input of this.state.selectedNodeId===drag.nodeId ? root.querySelectorAll<HTMLInputElement>('[data-story-property-path]') : []) {
        if (input.dataset.storyPropertyPath === JSON.stringify([...drag.path,'x'])) input.value = drag.x.toFixed(3);
        if (input.dataset.storyPropertyPath === JSON.stringify([...drag.path,'y'])) input.value = drag.y.toFixed(3);
      }
      event.preventDefault();
    };
    const overlayPointerEnd = (event: PointerEvent): void => {
      const drag = this.overlayDrag; if (!drag || drag.pointerId !== event.pointerId) return;
      this.overlayDrag = undefined; drag.overlay.classList.remove('is-positioning');
      if(drag.canvas.hasPointerCapture?.(event.pointerId))drag.canvas.releasePointerCapture(event.pointerId);
      const draft = currentDraft(this.state); const node = draft?.document.nodes.find(node=>node.id===drag.nodeId);
      if (!draft || draft.draftId!==drag.draftId || !node || !drag.canvas.isConnected) return;
      if(event.type==='pointercancel'){this.requestRefresh();return;}
      editProperty(draft,node.id,[...drag.path,'x'],drag.x); editProperty(draft,node.id,[...drag.path,'y'],drag.y);
      this.state.notice = null; this.requestRefresh();
    };
    const nodeKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null;
      if (!target || !root.contains(target) || event.target !== target) return;
      event.preventDefault();
      this.rememberInspectorScroll(); this.state.inspectorView = 'node'; this.pendingInspectorScroll = undefined;
      const selected=target.dataset.editorNode??null;if(selected!==this.state.selectedNodeId)this.closeThemeContentEdit();this.state.selectedNodeId = selected;
      this.requestRefresh();
    };
    const doubleClick = (event: MouseEvent): void => {
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-scene-card') : null;
      const draft = currentDraft(this.state);
      if (!card || !root.contains(card) || !draft) return;
      const node = draft.document.nodes.find(node => node.id === card.closest<HTMLElement>('[data-editor-node]')?.dataset.editorNode);
      const scene = card.hasAttribute('data-editor-start-context') ? draft.document.startContext
        : node?.type === 'moveToArea' ? { type: 'area' as const, areaId: node.areaId ?? '' }
          : node?.type === 'moveToCharaspace' ? { type: 'chara' as const, characterId: node.characterId ?? '' } : undefined;
      const target = storyEditorSceneTarget(createUIContext(this.ctrl.game), scene);
      if (!target) return;
      this.state.uiTheme?.selectDefinition(target.theme ?? {}, target.name);
      this.ctrl.refreshTheme();
    };
    root.addEventListener('dblclick', doubleClick);
    root.addEventListener('click', click);
    root.addEventListener('contextmenu', contextMenu);
    root.addEventListener('input', input);
    root.addEventListener('change', input);
    root.addEventListener('dragstart', dragStart);
    root.addEventListener('dragover', dragOver);
    root.addEventListener('dragleave', dragLeave);
    root.addEventListener('drop', drop);
    root.addEventListener('dragend', dragEnd);
    root.addEventListener('pointerdown', overlayPointerDown);
    root.addEventListener('pointermove', overlayPointerMove);
    root.addEventListener('pointerup', overlayPointerEnd);
    root.addEventListener('pointercancel', overlayPointerEnd);
    root.addEventListener('keydown', nodeKeydown);
    return () => {
      root.removeEventListener('dblclick', doubleClick);
      root.removeEventListener('click', click); root.removeEventListener('contextmenu', contextMenu);
      this.nodeMenu.close();
      root.removeEventListener('input', input); root.removeEventListener('change', input);
      root.removeEventListener('dragstart', dragStart); root.removeEventListener('dragover', dragOver);
      root.removeEventListener('dragleave', dragLeave); root.removeEventListener('drop', drop); root.removeEventListener('dragend', dragEnd);
      root.removeEventListener('pointerdown', overlayPointerDown); root.removeEventListener('pointermove', overlayPointerMove);
      root.removeEventListener('pointerup', overlayPointerEnd); root.removeEventListener('pointercancel', overlayPointerEnd);
      root.removeEventListener('keydown', nodeKeydown);
    };
  }
  private applyPositionTool(button: HTMLButtonElement): void {
    const draft = currentDraft(this.state), node = currentNode(this.state);
    if (!draft || !node || (node.type !== 'talklet' && node.type !== 'click')) return;
    const layout = node.performance?.layout;
    if (layout?.mode !== 'positioned' || this.state.inspectorView === 'story' || !this.state.performanceEditing?.[draft.draftId]?.includes(node.id)) return;
    const path = ['performance', 'layout'];
    const { storyPositionUnit: unit, storyPositionX: horizontal, storyPositionY: vertical } = button.dataset;
    const pixels = layout.unit === 'px';
    const anchorX = horizontal === 'left' || horizontal === 'center' || horizontal === 'right' ? horizontal : undefined;
    const anchorY = vertical === 'bottom' || vertical === 'center' || vertical === 'top' ? vertical : undefined;
    if (layout.anchor && (anchorX || anchorY)) {
      if (anchorX) editProperty(draft, node.id, [...path, 'anchor', 'x'], anchorX);
      if (anchorY) editProperty(draft, node.id, [...path, 'anchor', 'y'], anchorY);
    } else {
      const changingUnit = unit === 'px' || unit === 'percent';
      if (changingUnit ? pixels === (unit === 'px') : !anchorX && !anchorY) return;
      const rect = this.ctrl.root.querySelector('.story-editor-center .workspace-column__viewport')?.getBoundingClientRect();
      const width = rect?.width ?? 0, height = rect?.height ?? 0;
      if ((changingUnit || pixels) && (!width || !height)) return;
      const x = Number(layout.x), y = Number(layout.y);
      const valid = [layout.x, layout.y].every(value => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(value)))
        && [x, y].every(value => Number.isFinite(value) && (layout.anchor || value >= 0) && (pixels || Math.abs(value) <= 1));
      if (!valid) {
        this.state.error = '请先填写有效的定位坐标。';
        this.requestRefresh();
        return;
      }
      if (changingUnit) {
        editProperty(draft,node.id,[...path,'x'],pixels ? Math.min(1,Math.max(-1,x/width)) : x*width);
        editProperty(draft,node.id,[...path,'y'],pixels ? Math.min(1,Math.max(-1,y/height)) : y*height);
        if (unit === 'px') editProperty(draft,node.id,[...path,'unit'],unit);
        else removeProperty(draft,node.id,[...path,'unit']);
      } else {
        // When binding a legacy position, only the chosen axis moves to the new baseline.
        const align = layout.align === 'left' || layout.align === 'right' ? layout.align : 'center';
        const baseX = { left: 0, center: .5, right: 1 }[align];
        editProperty(draft,node.id,[...path,'x'],anchorX ? 0 : x-baseX*(pixels ? width : 1));
        editProperty(draft,node.id,[...path,'y'],anchorY ? 0 : y-.5*(pixels ? height : 1));
        removeProperty(draft,node.id,[...path,'align']);
        editProperty(draft,node.id,[...path,'anchor'],{x:anchorX ?? align,y:anchorY ?? 'center'});
      }
    }
    this.state.error = null;
    this.state.notice = null;
    this.requestRefresh();
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
    this.openNodeIdPrompt(nodeId, suggestion);
  }
  private openNodeIdPrompt(nodeId: string, initialValue: string): void {
    const draftId = currentDraft(this.state)?.draftId;
    if (!draftId) return;
    const ctx = createUIContext(this.ctrl.game);
    this.ctrl.modal.open({ title: '更改节点 ID', width: 440,
      body: `<p>建议使用便于辨认的手写 ID。ID 会定位已保存的播放游标；改名后旧游标将从 StoryEntry 重新开始。发布内容后尽量不要再改。</p><label class="story-editor-property">节点 ID<input data-story-generated-node-id value="${ctx.escapeHtml(initialValue)}" autocomplete="off"></label><p class="story-editor-error" data-story-generated-node-id-error hidden></p>`,
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
  private openChoiceOptionIdPrompt(button: HTMLElement): void {
    const draft = currentDraft(this.state);
    const nodeId = button.dataset.storyNodeId;
    const optionIndex = Number(button.dataset.storyOptionIndex);
    const oldId = button.dataset.storyOptionId;
    if (!draft || !nodeId || !Number.isInteger(optionIndex) || !oldId) return;
    const ctx = createUIContext(this.ctrl.game);
    this.ctrl.modal.open({ title: '更改选项 ID', width: 440,
      body: `<p>建议使用便于辨认的手写 ID。保存内容后若旧游标无法匹配，会从 StoryEntry 重新开始；发布后尽量不要改。</p><label class="story-editor-property">选项 ID<input data-story-option-id-input value="${ctx.escapeHtml(oldId)}" autocomplete="off"></label><p class="story-editor-error" data-story-option-id-error hidden></p>`,
      footer: '<button type="button" class="modal-close">取消</button><button type="button" class="primary-button" data-modal-action="rename-story-option-id">更改 ID</button>',
      onAction: action => {
        if (action !== 'rename-story-option-id' || currentDraft(this.state) !== draft) return;
        const input = document.querySelector<HTMLInputElement>('.app-modal [data-story-option-id-input]');
        const requested = input?.value.trim() ?? '';
        if (!renameStoryChoiceOptionId(draft, nodeId, optionIndex, oldId, requested)) {
          const error = document.querySelector<HTMLElement>('.app-modal [data-story-option-id-error]');
          if (error) { error.textContent = '请输入合法且未被此 Choice 使用的选项 ID。'; error.hidden = false; }
          input?.focus();
          return;
        }
        this.state.error = null;
        this.ctrl.modal.close();
        this.requestRefresh();
      } });
    document.querySelector<HTMLInputElement>('.app-modal [data-story-option-id-input]')?.focus();
  }
  private closeThemeContentEdit(): void {
    const edit=this.state.themeContentEdit;if(!edit)return;this.ctrl.commands.themeContentEditor?.cancel(edit.session.sessionId);
    this.state.uiTheme?.previewContent();
    this.state.themeContentEdit=undefined; this.ctrl.refreshTheme();
  }
  private themeContentNumbersValid(value:unknown,path:string[]=[]):string|undefined {
    if(Array.isArray(value)){for(let i=0;i<value.length;i++){const issue=this.themeContentNumbersValid(value[i],[...path,String(i)]);if(issue)return issue;}return;}
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value as Record<string,unknown>)){
      if(['opacity','scale','rotation','width','height','x','y'].includes(key)&&child!==undefined&&(typeof child!=='number'||!Number.isFinite(child)))return `${[...path,key].join('.')} 必须是有效数字。`;
      const issue=this.themeContentNumbersValid(child,[...path,key]);if(issue)return issue;
    }
  }
  private themeContentClick(target:HTMLElement):void {
    const editor=this.ctrl.commands.themeContentEditor;
    if(target.dataset.storyThemeContentOpen){
      const kind=target.dataset.storyThemeContentOpen;const packRecordId=target.dataset.storyThemeContentPack??'';const contentId=target.dataset.storyThemeContentId??'';
      if(!editor||!packRecordId||!contentId){this.state.error='主题内容编辑服务不可用或目标包未选择。';return;}
      this.closeThemeContentEdit();
      let owner:import('../../arona-clicker/services/presentation/theme-content-editor-service').ThemeContentTarget['owner'];
      if(kind==='theme-def')try{owner=JSON.parse(target.dataset.storyThemeContentOwner??'') as typeof owner;}catch{this.state.error='ThemeDef 内容定位信息无效。';return;}
      if(kind!=='color-group'&&kind!=='theme-def'){this.state.error='不支持此主题内容类型。';return;}
      const result=editor.beginEdit({packRecordId,kind:kind as 'color-group'|'theme-def',contentId,...(owner?{owner}:{})});
      if(!result.ok){this.state.error=result.message;return;}
      this.state.themeContentEdit={session:result.value,draft:structuredClone(result.value.draft),previewing:false,rows:{}};this.state.error=null;return;
    }
    const edit=this.state.themeContentEdit;const action=target.dataset.themeContentAction;
    if(!edit||!action)return;
    if(action==='cancel'){this.closeThemeContentEdit();return;}
    if(action==='preview'||action==='save'){
      const invalid=this.themeContentNumbersValid(edit.draft);
      if(invalid){edit.error=invalid;return;}
      const result=action==='preview'?editor?.preview(edit.session.sessionId,edit.draft):editor?.save(edit.session.sessionId,edit.draft);
      if(!result){edit.error='主题内容编辑服务不可用。';return;}
      if(!result.ok){edit.error=result.message;return;}
      if(action==='preview'){edit.previewing=true;edit.error=undefined;this.state.uiTheme?.previewContent(this.ctrl.game.colorSystem.runtimeTheme());this.ctrl.refreshTheme();return;}
      this.state.uiTheme?.previewContent();
      this.state.themeContentEdit=undefined;this.state.notice='主题定义已保存到所选编辑态数据包。';this.ctrl.refreshTheme();return;
    }
    const path=this.parsePropertyPath(target.dataset.themeContentPath);if(!path)return;
    const current=valueAt(edit.draft,path);
    if(action==='add-key'){
      const name=target.parentElement?.querySelector<HTMLInputElement>('[data-theme-content-key]')?.value.trim()??'';
      if(!name||['__proto__','constructor','prototype'].includes(name)||(current&&typeof current==='object'&&Object.prototype.hasOwnProperty.call(current,name))){edit.error='请输入未重复的合法键名。';return;}
      writeThemeContentValue(edit.draft,[...path,name],'');edit.error=undefined;return;
    }
    if(action==='add-slot'){
      if(!Array.isArray(current)||current.length>=6){edit.error='色槽最多六个。';return;}current.push({role:'accent',color:'#ffffff'});edit.error=undefined;return;
    }
    if(action==='add-palette'){
      const theme=edit.draft as {colorGroupId?:string;palette?:string[]};const inherited=theme.colorGroupId?this.ctrl.game.registry.colorGroups.get(theme.colorGroupId)?.slots.map(slot=>slot.color).slice(0,6)??[]:[];
      const palette=Array.isArray(current)?current as string[]:[];if(palette.length>=6){edit.error='色板最多六色。';return;}
      if(!Array.isArray(current)&&inherited.length)theme.palette=[...inherited];else{theme.palette=palette;theme.palette.push(inherited[palette.length]??inherited.at(-1)??'');}edit.error=undefined;return;
    }
    if(action==='add-layer'){
      if(!Array.isArray(current))writeThemeContentValue(edit.draft,path,[]);
      const layers=valueAt(edit.draft,path) as unknown[];layers.push({id:`theme-layer-${crypto.randomUUID().replace(/-/g,'')}`,kind:'solid',value:'var(--bg)',...(path[0]==='presentation'?{region:'story'}:{})});edit.error=undefined;return;
    }
    if(action==='add-component'){
      if(!Array.isArray(current))writeThemeContentValue(edit.draft,path,[]);
      (valueAt(edit.draft,path) as unknown[]).push({id:`component-${crypto.randomUUID().replace(/-/g,'')}`,parent:'story',anchor:'center',size:{unit:'auto'}});edit.error=undefined;return;
    }
    const index=Number(target.dataset.themeContentIndex);
    if(action==='remove'&&target.dataset.themeContentIndex===undefined){writeThemeContentValue(edit.draft,path,undefined,true);edit.error=undefined;return;}
    if((action==='remove'||action==='up'||action==='down')&&Array.isArray(current)&&Number.isInteger(index)&&index>=0&&index<current.length){
      const key=JSON.stringify(path);const ids=edit.rows[key]??[];
      if(action==='remove'){current.splice(index,1);ids.splice(index,1);}
      else{const next=index+(action==='up'?-1:1);if(next<0||next>=current.length)return;[current[index],current[next]]=[current[next],current[index]];[ids[index],ids[next]]=[ids[next]!,ids[index]!];}
      edit.rows[key]=ids;edit.error=undefined;
    }
  }
  private closeAuthoringPreview(): void {
    if (this.previewTimer) clearInterval(this.previewTimer);
    this.previewTimer = undefined; this.preview?.close(); this.preview = undefined; this.state.preview = undefined; this.previewSignature = '';
  }
  private updateAuthoringPreview(): void {
    if (!this.preview) return;
    if (!this.isOpen()) { this.closeAuthoringPreview(); return; }
    const playback = this.preview.getView(); const story = this.preview.getStory(); const projection = this.preview.getProjection();
    const signature = JSON.stringify([playback?.revision, playback?.phase, playback?.banner?.title, story, projection?.scene]);
    if (signature === this.previewSignature) return;
    this.previewSignature = signature; this.state.preview = { playback, story, projection }; this.requestRefresh();
  }
  private authoringInput(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, eventType: string): boolean {
    const draft = currentAuthoringDraft(this.state);
    if (!draft) return false;
    if (target.dataset.entryActivationPart) {
      if(eventType!=='change') return true;
      const table=target.dataset.entryTable as 'activeStories'|'passiveStories',row=draft.authoring?.[table][Number(target.dataset.entryIndex)];
      if(!row)return true;
      const part=target.dataset.entryActivationPart,previous=row.activation;
      let next:EntryActivation;
      if(part==='kind') next=defaultEntryActivation(target.value as EntryActivation['kind']);
      else if(part==='fallback'&&previous.kind==='active') next={kind:'active',...(target.value==='none'?{}:{fallback:target.value==='current-area'?{kind:'current-area'}:{kind:'fixed-area',areaId:this.ctrl.game.state.currentAreaId ?? ''}})};
      else if(part==='when'&&previous.kind==='affection') next={...previous,when:target.value==='level'?{kind:'level',level:1}:{kind:'after-story',storyId:draft.document.id}};
      else return true;
      target.value=part==='kind'?previous.kind:part==='when'&&previous.kind==='affection'?previous.when.kind:previous.kind==='active'?previous.fallback?.kind ?? 'none':'';
      this.reviewEntryActivation(draft,next,row);return true;
    }
    if (target.hasAttribute('data-authoring-copy-id')) { this.state.copyStoryId = target.value; return true; }
    if (target.hasAttribute('data-authoring-target')) {
      const bound=currentAuthoringDraft(this.state)?.targetPackId;
      if (bound && target.value!==bound) {this.state.error='此 Story 已归属指定编辑态 Mod；跨 Mod 请另存为新身份。';return true;}
      if(this.state.targetPackId!==target.value)this.closeThemeContentEdit();this.state.targetPackId = target.value; return true;
    }
    if (target.hasAttribute('data-authoring-preview-entry')) { this.state.previewEntryId = target.value; return true; }
    if (target.hasAttribute('data-authoring-field')) {
      if (eventType === 'change' && ENTRY_FIELD_SEEDS[target.value]) {
        const path = [target.dataset.authoringField!, Number(target.dataset.authoringIndex), target.value];
        writeStructuredValue(draft,'$authoring',path,structuredClone(ENTRY_FIELD_SEEDS[target.value].value));
      }
      return true;
    }
    const scope = target.dataset.valueScope; const path = this.parsePropertyPath(target.dataset.valuePath);
    if (scope === undefined || !path) return false;
    if (target.hasAttribute('data-value-type')) {
      if (eventType === 'change') constructStructuredValue(draft,scope,path,target.value);
    } else if (target.hasAttribute('data-value-input')) {
      editStructuredValue(draft,scope,path,target.dataset.valueInput!,target.value);
      if (this.state.target?.kind === 'entry' && scope === '$authoring' && path.length === 3 && (path[0] === 'activeStories' || path[0] === 'passiveStories') && path[2] === 'id') {
        this.state.target = { kind: 'entry', id: String(valueAt(draft.authoring, path)) };
      }
    }
    else if (target.hasAttribute('data-value-key')) {
      draft.structuredInputs ??= {}; draft.structuredInputs[structuredKey(draft,scope,path) + ':new-key'] = { text: target.value };
    }
    return true;
  }
  private reviewEntryActivation(draft: import('./model').StoryDraft, next: EntryActivation, entry?: StoryEntryDef): void {
    const e=createUIContext(this.ctrl.game).escapeHtml;
    const previous=entry ? JSON.stringify(entry.activation) : undefined;
    const describe=(value:EntryActivation):string=>value.kind==='active'?`主动接取；${value.fallback?.kind==='fixed-area'?`接取地区 ${value.fallback.areaId}`:value.fallback?'当前地区兜底':'不兜底投放'}`:value.kind==='random'?`随机抽取；基础权重 ${value.weight}；${value.repeatable?'可重复触发':'单次触发'}；冷却 ${value.cooldownFrames ?? 0} 帧`:`角色阶段；${value.when.kind==='level'?`好感等级 ${value.when.level}`:`前置故事 ${value.when.storyId}`}；冷却 ${value.cooldownFrames ?? 0} 帧`;
    this.ctrl.modal.open({title:entry?'更改激活配置':'新建好感／角色阶段入口',width:560,
      body:`${entry?`<p>确认替换当前激活配置？</p><p>当前：${e(describe(entry.activation))}</p><p>替换为：${e(describe(next))}</p>${next.kind==='active'?'<p>当前被动播放限制和完结后的对话暂停配置也将移除。</p>':''}`:''}${next.kind==='affection'?`<label>归属角色<select data-entry-activation-owner><option value="">选择角色</option>${[...this.ctrl.game.registry.characterVariants.values()].map(role=>`<option value="${e(role.id)}"${entry?.owner===role.id?' selected':''}>${e(role.displayName)} · ${e(role.id)}</option>`).join('')}</select></label>`:''}<p class="story-editor-error" data-entry-activation-error hidden></p>`,
      footer:'<button type="button" class="modal-close">取消</button><button type="button" class="mini-action" data-modal-action="confirm-entry-activation">确认</button>',
      onAction:action=>{
        if(action!=='confirm-entry-activation'||currentAuthoringDraft(this.state)!==draft||this.state.storageBlocked)return;
        try{
          const owner=next.kind==='affection'?document.querySelector<HTMLSelectElement>('[data-entry-activation-owner]')?.value:entry?.owner;
          if(next.kind==='affection'&&(!owner||!this.ctrl.game.registry.characterVariants.has(owner)))throw new Error('请选择归属角色。');
          const candidate=structuredClone(draft);
          if(entry){
            if(JSON.stringify(entry.activation)!==previous)throw new Error('当前激活配置已变化，请关闭后重新核对。');
            if(next.kind!=='random'&&[...this.ctrl.game.registry.passivePools.values()].some(pool=>pool.children.some(child=>child.id===entry.id)&&!draft.authoring?.passivePools.some(row=>row.id===pool.id)))throw new Error('请先从关联抽取池中移除此 Entry。');
            changeEntryActivation(candidate,entry.id,next,owner);
          }else addStoryAuthoringRow(candidate,'passiveStories',owner);
          const pending={...this.state,drafts:this.state.drafts.map(row=>row===draft?candidate:row)};
          if(!this.persistence.save(pending))throw new Error(pending.error ?? '草稿保存失败，原配置已保留。');
          Object.assign(draft,candidate);
          this.state.error=null;
          this.ctrl.modal.close();this.requestRefresh();
        }catch(error){const node=document.querySelector<HTMLElement>('[data-entry-activation-error]');if(node){node.textContent=error instanceof Error?error.message:String(error);node.hidden=false;}}
      }});
  }
  private authoringClick(target: HTMLElement): void {
    if (this.state.storageBlocked) return;
    const draft = currentAuthoringDraft(this.state); if (!draft) return;
    hydrateStoryAuthoring(draft,this.ctrl.game.registry);
    this.state.error = null; this.state.notice = null;
    try {
      const add = target.dataset.authoringAdd;
      if(target.hasAttribute('data-authoring-init-rewards')){
        const id=this.state.target?.kind==='entry'?this.state.target.id:undefined;
        const table=draft.authoring!.activeStories.some(item=>item.id===id)?'activeStories':'passiveStories';
        const index=draft.authoring![table].findIndex(item=>item.id===id);
        if(index<0)throw new Error('Entry 已不存在。');
        writeStructuredValue(draft,'$authoring',[table,index,'completionReward'],{first:[],repeat:[]});
        return;
      }
      if(target.hasAttribute('data-authoring-add-condition-reward')){
        const id=this.state.target?.kind==='entry'?this.state.target.id:undefined;
        const table=draft.authoring!.activeStories.some(item=>item.id===id)?'activeStories':'passiveStories';
        const index=draft.authoring![table].findIndex(item=>item.id===id);
        if(index<0)throw new Error('Entry 已不存在。');
        const rows=(draft.authoring![table][index] as StoryEntryDef).conditionalRewards??[];
        writeStructuredValue(draft,'$authoring',[table,index,'conditionalRewards'],[...rows,{condition:{type:'AND',conditions:[]},effects:[]}]);
        structuredKey(draft,'$authoring',[table,index,'conditionalRewards',rows.length]);
        return;
      }
      if(add==='affection'){this.reviewEntryActivation(draft,defaultEntryActivation('affection'));return;}
      if (add === 'activeStories' || add === 'passiveStories' || add === 'passivePools') {
        const entry=this.state.target?.kind==='entry'?storyEntries(this.state,this.ctrl.game.registry.storyEntries).get(this.state.target.id):undefined;
        if(add==='passivePools'&&entry&&entry.activation.kind!=='random')throw new Error('只有随机入口可以加入抽取池。');
        addStoryAuthoringRow(draft,add);
        if(add==='passivePools'&&entry)draft.authoring!.passivePools.at(-1)!.children.push({id:entry.id,weight:1});
        return;
      }
      if (target.hasAttribute('data-authoring-copy')) {
        if (!copyStoryIdentity(this.state,draft,this.state.copyStoryId?.trim() ?? '',new Set(this.ctrl.game.registry.stories.keys()))) throw new Error('请输入尚未使用的完整 Story ID：mod:story:name。');
        this.closeAuthoringPreview(); return;
      }
      if (target.dataset.authoringCatalog) {
        const path = [target.dataset.authoringCatalog, Number(target.dataset.authoringIndex), 'catalog'];
        if(!valueAt(draft.authoring,path))writeStructuredValue(draft,'$authoring',path,{category:'作者故事',part:'自定义篇章'});
        return;
      }
      const action = target.dataset.valueAction;
      if (action) {
        const scope = target.dataset.valueScope!; const path = this.parsePropertyPath(target.dataset.valuePath); if (!path) return;
        const current = valueAt(structuredRoot(draft,scope),path);
        if (action === 'remove') {
          if (scope === '$authoring' && path.length === 2 && typeof path[0] === 'string' && ['activeStories','passiveStories','passivePools'].includes(path[0]) && current && typeof current === 'object' && 'id' in current) {
            draft.authoring!.removed ??= {}; const table = path[0] as 'activeStories' | 'passiveStories' | 'passivePools';
            (draft.authoring!.removed[table] ??= []).push(String(current.id));
          }
          const key = structuredKey(draft,scope,path);
          for (const input of Object.keys(draft.structuredInputs ?? {})) if (input === key || input.startsWith(key.slice(0,-1)+',')) delete draft.structuredInputs![input];
          writeStructuredValue(draft,scope,path,undefined,true);
          if (scope === '$authoring' && path.length === 2 && (path[0] === 'activeStories' || path[0] === 'passiveStories') && this.state.target?.kind === 'entry') this.browseTarget({ kind: 'story', id: draft.document.id });
        } else if (action === 'up' || action === 'down') {
          const parentPath = path.slice(0,-1); const parent = valueAt(structuredRoot(draft,scope),parentPath); const from = Number(path[path.length-1]); const to = from + (action === 'up' ? -1 : 1);
          if (Array.isArray(parent) && to >= 0 && to < parent.length) {
            if (!scope.startsWith('$')) moveRowBy(draft,scope,parentPath,rowIdAt(draft,scope,parentPath,from)!,action === 'up' ? -1 : 1);
            else {
              const key = structuredKey(draft,scope,parentPath); const next = [...parent]; [next[from],next[to]]=[next[to],next[from]];
              const ids = draft.structuredRows?.[key]; if(ids) [ids[from],ids[to]]=[ids[to],ids[from]];
              writeStructuredValue(draft,scope,parentPath,next);
            }
          }
        } else if (action === 'add') {
          const key = draft.structuredInputs?.[structuredKey(draft,scope,path)+':new-key']?.text.trim() ?? '';
          if (Array.isArray(current)) writeStructuredValue(draft,scope,[...path,current.length],'');
          else if (current && typeof current === 'object' && key && !Object.prototype.hasOwnProperty.call(current,key)) {
            if (!writeStructuredValue(draft,scope,[...path,key],'')) throw new Error('字段名称非法。');
          } else throw new Error('请输入未重复的字段名称。');
        }
        return;
      }
      if (target.hasAttribute('data-authoring-preview-option') || target.dataset.authoringAction === 'advance') {
        const result = this.preview?.advance(target.dataset.authoringPreviewOption); if (result && !result.ok) this.state.error = result.message;
        this.updateAuthoringPreview(); return;
      }
      if (target.dataset.authoringAction === 'close-preview') { this.closeAuthoringPreview(); return; }
      const compiled = compileStoryAuthoring(this.state); if (!compiled.ok) throw new Error(compiled.message);
      const kind = target.dataset.authoringAction;
      if (kind==='apply' && draft.renamedFromId && draft.renamedFromId!==draft.document.id && this.ctrl.game.registry.stories.has(draft.renamedFromId)) throw new Error('此 Story 已在 Mod 中更改 ID，请先重新载入该 Mod。');
      if (kind==='pack') {
        const id=draft.targetPackId ?? this.state.targetPackId;
        if (!id) throw new Error('请选择允许编辑的目标包。');
        const {record}=storyEditingMod(this.ctrl.game,id);
        if (!draft.sourceId && record.datapack.stories?.some(story=>story.id===draft.document.id)) throw new Error('目标 Mod 已出现同名 Story，请更改 ID，避免覆盖。');
        this.state.targetPackId=id;
      }
      if (kind === 'preview') {
        this.closeAuthoringPreview();
        const result = this.ctrl.commands.createStoryAuthoringPreview(compiled.patch,this.state.previewEntryId ?? '');
        if (!result.ok) throw new Error(result.message);
        this.preview = result.preview; this.updateAuthoringPreview();
        this.previewTimer = setInterval(()=>this.updateAuthoringPreview(),200); return;
      }
      const result = kind === 'check' ? this.ctrl.commands.validateStoryAuthoring(compiled.patch)
        : kind === 'apply' ? this.ctrl.commands.applyStoryAuthoring(compiled.patch)
        : kind === 'pack' && this.state.targetPackId && this.ctrl.commands.saveStoryAuthoringToPack ? this.ctrl.commands.saveStoryAuthoringToPack(this.state.targetPackId,compiled.patch)
        : { ok: false, message: '请选择允许编辑的目标包。' };
      if (!result.ok) throw new Error(result.message);
      if (kind==='pack') for (const item of this.state.drafts) if (compiled.patch.stories.some(story=>story.id===item.document.id)) {
        item.targetPackId=this.state.targetPackId;item.sourceId ??= item.document.id;item.dirty=true;
      }
      this.save(false,false); this.state.notice = result.message;
    } catch (error) { this.state.error = error instanceof Error ? error.message : String(error); }
  }
  private editStoryProperty(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
    const draft=currentDraft(this.state); const node=currentNode(this.state); const path=this.parsePropertyPath(target.dataset.storyPropertyPath);
    if(!draft||!node||!path)return;
    if (target.hasAttribute('data-story-omit-empty') && target.value === '') {
      removeProperty(draft,node.id,path);
      const parentPath=path.slice(0,-1), parent=readProperty(draft,node.id,parentPath);
      if (parent && typeof parent==='object' && !Array.isArray(parent) && Object.keys(parent).length===0) removeProperty(draft,node.id,parentPath);
      return;
    }
    if (path[path.length - 1] === 'displayName' && !target.value.trim()) { removeProperty(draft, node.id, path); return; }
    if (path[path.length - 1] === 'requiresFlag' && !target.value.trim()) { removeProperty(draft, node.id, path); return; }
    if(target instanceof HTMLSelectElement) {
      // An empty enumeration choice means "keep the runtime default": delete the field instead of writing ''.
      if(!target.value) { removeProperty(draft,node.id,path); return; }
      if(path[path.length-1] === 'op' && target.value === 'remove') removeProperty(draft,node.id,[...path.slice(0,-1),'value']);
      if(target.value==='__global__') { editProperty(draft,node.id,path,null); return; }
      if(target.value==='true') { editProperty(draft,node.id,path,true); return; }
      if(target.value==='false') { editProperty(draft,node.id,path,false); return; }
    }
    editProperty(draft,node.id,path,target.value);
  }
  private removeReadonlyProperty(element: HTMLElement): void {
    const draft=currentDraft(this.state); const node=currentNode(this.state); const path=this.parsePropertyPath(element.dataset.storyOptionalPath);
    if(draft&&node&&path) {
      const parent=path.length>1?readProperty(draft,node.id,path.slice(0,-1)):undefined;
      if(typeof path.at(-1)==='number'&&Array.isArray(parent)) {
        const rowId=rowIdAt(draft,node.id,path.slice(0,-1),Number(path.at(-1)));
        if(rowId){removeRow(draft,node.id,path.slice(0,-1),rowId);return;}
      }
      removeProperty(draft,node.id,path);
    }
  }
  private propertyAction(element: HTMLElement): void {
    const draft=currentDraft(this.state); const node=currentNode(this.state); if(!draft||!node)return;
    const path=this.parsePropertyPath(element.dataset.storyRowPath ?? element.dataset.storyConditionPath ?? element.dataset.storyPath);
    if(element.dataset.storyInitBranch&&path) { toggleOptional(draft,node.id,path,true); selectBranch(draft,node.id,path,element.dataset.storyInitBranch); return; }
    if(element.dataset.storyInitCondition&&path) { toggleOptional(draft,node.id,path,true); if(readProperty(draft,node.id,path)===undefined) editProperty(draft,node.id,path,{type:'AND',conditions:[]}); return; }
    if(element.dataset.storyInitObject!==undefined&&path) { toggleOptional(draft,node.id,path,true); if(readProperty(draft,node.id,path)===undefined) editProperty(draft,node.id,path,{}); return; }
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
      const choice=node.type==='click'&&node.interaction.kind==='choice';
      const choiceMarks=choice&&rowPath[0]==='interaction'&&rowPath[1]==='options'&&rowPath.at(-1)==='marks';
      const row=rowPath.at(-1)==='options'?{id:`option_${crypto.randomUUID().replace(/-/g,'')}`,text:''}:choiceMarks?'':{};
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
    this.rememberInspectorScroll(); this.state.inspectorView = 'node'; this.pendingInspectorScroll = undefined;
    this.state.selectedNodeId=node.id;
    if(parsed.path[0]==='appearance') this.state.nodeDesignerTab='appearance';
    else if(parsed.path[0]==='performance') this.state.nodeDesignerTab='performance';
    else if(node.type==='talklet'||node.type==='click') this.state.nodeDesignerTab='basic';
    this.pendingFocus=parsed.path.length?JSON.stringify(parsed.path):null;
  }
  private closeSelectionNavi(): void { if (this.selectionNaviOpen) this.ctrl.modal.close(); }
  private openContentNavi(field: ReferenceField): void {
    const target = this.state.target, nodeId = this.state.selectedNodeId;
    const live = () => this.isOpen() && field.isConnected && !field.disabled
      && !(field instanceof HTMLInputElement && field.readOnly) && !this.state.storageBlocked
      && this.state.target?.kind === target?.kind && this.state.target?.id === target?.id && this.state.selectedNodeId === nodeId;
    if (!target || !live()) return;
    this.requiredFlagDropdown.close(); this.selectionNaviOpen = true;
    openReferenceNavi(this.ctrl.modal, createUIContext(this.ctrl.game), field, {
      close: () => { this.selectionNaviOpen = false; if (field.isConnected) field.focus({ preventScroll: true }); },
      select: value => {
        if (!live()) { this.ctrl.modal.close(); return; }
        if (!referenceChoices(field).some(row => row.value === value && !row.disabled)) return;
        this.ctrl.modal.close(); field.value = value;
        field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      },
      navigate: source => {
        if (!live()) { this.ctrl.modal.close(); return; }
        this.ctrl.modal.close(); this.browseTarget(source); this.requestRefresh();
      },
    });
  }
  private openFlagNavi(input: HTMLInputElement, includeInternal: boolean): void {
    this.requiredFlagDropdown.close();
    const target = this.state.target;
    if (!target || this.state.storageBlocked) return;
    const nodeId = this.state.selectedNodeId;
    const catalog = () => buildStoryFlagCatalog(this.state,buildStoryRelations(this.state,this.ctrl.game.registry.stories,this.ctrl.game.registry.storyEntries),target);
    const live = () => this.isOpen() && input.isConnected && !input.disabled && !input.readOnly && !this.state.storageBlocked
      && this.state.target?.kind === target.kind && this.state.target.id === target.id && this.state.selectedNodeId === nodeId;
    this.selectionNaviOpen = true;
    openLocalFlagNavi(this.ctrl.modal,createUIContext(this.ctrl.game),catalog(),{
      current:input.value,includeInternal,
      close:()=>{ this.selectionNaviOpen=false; if (input.isConnected) input.focus({preventScroll:true}); },
      select:(name,scope)=>{
        if (!live()) { this.ctrl.modal.close(); return; }
        if (!catalog().uses.some(use=>use.kind==='local' && use.name===name && use.scope===scope && (includeInternal || use.available))) return;
        this.ctrl.modal.close();
        input.value = name;
        if (input.dataset.editorField==='local-flag-name') {
          // Selecting an existing writer name is a field assignment, not a cascading rename.
          editNodeFlag(this.state,'local-flag-name',name); this.requestRefresh();
        } else input.dispatchEvent(new Event('input',{bubbles:true}));
      },
      navigate:(source,sourceNode)=>{
        this.ctrl.modal.close(); this.browseTarget(source);
        if (source.kind==='story' && currentDraft(this.state)?.document.id===source.id && sourceNode && currentDraft(this.state)!.document.nodes.some(node=>node.id===sourceNode)) {
          this.state.inspectorView='node'; this.state.selectedNodeId=sourceNode; this.revealNodeId=sourceNode;
        }
        this.requestRefresh();
      },
    });
  }
  private confirmFlagImport(key: string): void {
    const owner = currentDraft(this.state);
    if (!owner || this.state.storageBlocked) return;
    const relations = buildStoryRelations(this.state, this.ctrl.game.registry.stories, this.ctrl.game.registry.storyEntries);
    const boundary = buildStoryFlagCatalog(this.state, relations, { kind: 'story', id: owner.document.id },true).boundaries.find(item => item.key === key);
    if (!boundary || boundary.missing) return;
    const entry = relations.entries.get(boundary.call.to.id)!;
    const name = entry.openingTitle || entry.id;
    this.ctrl.modal.open({ title: '获取 Entry 的 flag 信息', body: `<p>是否将“${createUIContext(this.ctrl.game).escapeHtml(name)}”涉及的 flag 纳入当前故事的清单？内部局部标记仍属于该 Entry，不会自动添加到回传白名单。</p>`,
      footer: '<button type="button" class="mini-action" data-modal-action="flag-import-no">不获取</button><button type="button" class="mini-action" data-modal-action="flag-import-yes">获取信息</button>',
      onAction: action => {
        if (!['flag-import-no', 'flag-import-yes'].includes(action) || currentDraft(this.state) !== owner) return;
        // Materialize the source draft so action-row identities survive edits and reloads.
        const previousTarget = this.state.target;
        const previousNode = this.state.selectedNodeId;
        const previousGap = this.state.insertionBeforeNodeId;
        if (boundary.call.from.kind === 'story' && !this.state.drafts.some(draft => draft.document.id === boundary.call.from.id)) selectStory(this.state, `source:${boundary.call.from.id}`, this.ctrl.game.registry.stories);
        this.state.target = previousTarget; this.state.selectedNodeId = previousNode; this.state.insertionBeforeNodeId = previousGap;
        const stableKey = flagImportKey(this.state, relations, boundary.call);
        owner.flagImports ??= {};
        owner.flagImports[stableKey] = action === 'flag-import-yes'; owner.dirty = true;
        const source = this.state.drafts.find(draft => draft.document.id === boundary.call.from.id);
        if (source) source.dirty = true;
        this.save(false, false); this.ctrl.modal.close(); this.requestRefresh();
      } });
  }
  private createStoryInMod(): void {
    if (this.state.storageBlocked) return;
    const packs=storyEditingMods(this.ctrl.game), e=createUIContext(this.ctrl.game).escapeHtml;
    const preferred=currentAuthoringDraft(this.state)?.targetPackId ?? this.state.targetPackId;
    this.ctrl.modal.open({title:'选择新 Story 所属 Mod',panelClass:'story-editor-identity',width:520,
      body:`<label class="story-editor-property">编辑态 Mod<select data-story-new-mod><option value="">选择编辑态 Mod</option>${packs.map(pack=>`<option value="${e(pack.packRecordId ?? pack.id)}"${(pack.packRecordId ?? pack.id)===preferred?' selected':''}>${e(pack.name)} · ${e(pack.modName)} · ${e(pack.version)}</option>`).join('')}</select></label>${packs.length?'':'<p>暂无编辑态 Mod，请先在包管理创建编辑副本。</p>'}<p class="story-editor-error" data-story-identity-error hidden></p>`,
      footer:`<button type="button" class="modal-close">取消</button><button type="button" class="mini-action" data-modal-action="create-story-in-mod"${packs.length?'':' disabled'}>确认并新建</button>`,
      onAction:action=>{
        if (action!=='create-story-in-mod' || !this.isOpen() || this.state.storageBlocked) return;
        try {
          const id=document.querySelector<HTMLSelectElement>('[data-story-new-mod]')?.value ?? '';
          const {record}=storyEditingMod(this.ctrl.game,id);
          if (!this.save(false,false)) throw new Error(this.state.error ?? '请先保存当前草稿。');
          const known=new Set([...this.ctrl.game.registry.stories.keys(),...knownModStoryIds(this.ctrl.game,record.manifest.modName)]);
          this.rememberVisit();this.closeAuthoringPreview();this.closeThemeContentEdit();
          newStory(this.state,record.manifest.modName,known,id);this.state.targetPackId=id;
          this.state.inspectorView=undefined;this.state.storyInspectorTab='overview';this.pushVisit();
          this.ctrl.modal.close();this.requestRefresh();
        } catch (error) {
          const message=document.querySelector<HTMLElement>('[data-story-identity-error]');
          if(message){message.textContent=error instanceof Error?error.message:String(error);message.hidden=false;}
        }
      }});
  }

  private closeEditorDialog(): void {
    if (this.editorDialog?.isConnected) this.ctrl.modal.close();
    this.editorDialog = undefined;
  }

  private editEntryCondition(trigger: HTMLButtonElement): void {
    const target = this.state.target;
    const draft = currentAuthoringDraft(this.state);
    if (target?.kind !== 'entry' || !draft?.authoring || this.state.storageBlocked) return;
    const table = draft.authoring.activeStories.some(row => row.id === target.id) ? 'activeStories' : 'passiveStories';
    const index = draft.authoring[table].findIndex(row => row.id === target.id);
    const entry = draft.authoring[table][index];
    const path = this.parsePropertyPath(trigger.dataset.valuePath);
    if (!entry || path?.[0] !== table || path[1] !== index) return;
    const relative = path.slice(2);
    const field = entryConditionField(relative);
    if (!field || relative[0] === 'block' && table !== 'passiveStories') return;
    const scope = '$authoring';
    const parentPath = relative.slice(0, -1);
    const rule = valueAt(entry, parentPath);
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return;
    const key = structuredKey(draft, scope, path);
    const original = valueAt(entry, relative);
    const originalSignature = JSON.stringify(original);
    const ctx = createUIContext(this.ctrl.game);
    this.editorDialog = openConditionTreeDialog(this.ctrl.modal, ctx, trigger, {
      original,
      label: field.label,
      defaultTrue: field.optional,
      targets: relative[0] === 'conditionalRewards' ? STORY_CONDITION_TARGETS
        : STORY_CONDITION_TARGETS.filter(([target]) => target !== 'visitedStoryInChain'),
      state: this.state,
      availableInits: entry.availableInits ?? [],
      globalFlags: storyFlagNames(currentStoryFlagCatalog(ctx, this.state), 'global'),
      pendingValue: suffix => draft.structuredInputs?.[structuredKey(draft, scope, [...path, ...suffix])]?.text,
      beforeRemove: element => this.ctrl.popovers.dismissBeforeRootMutation(element),
      onClose: () => { this.editorDialog = undefined; },
      commit: condition => {
        if (!this.isOpen() || this.state.storageBlocked || this.state.target?.kind !== 'entry'
          || this.state.target.id !== target.id || currentAuthoringDraft(this.state) !== draft) {
          return '条件所属 Entry 已变化，请关闭后重新打开。';
        }
        const currentIndex = draft.authoring?.[table].findIndex(row => row === entry) ?? -1;
        const currentRelative = [...relative];
        if (relative.length === 3) {
          const rows = valueAt(entry, [relative[0]]);
          currentRelative[1] = Array.isArray(rows) ? rows.indexOf(rule) : -1;
        }
        const currentPath = [table, currentIndex, ...currentRelative];
        if (currentIndex < 0 || currentRelative[1] === -1 || structuredKey(draft, scope, currentPath) !== key
          || JSON.stringify(valueAt(entry, currentRelative)) !== originalSignature) {
          return '条件已变化，请关闭后重新打开。';
        }
        try {
          const candidate = structuredClone(entry);
          if (!setValueAt(candidate, currentRelative, condition)) return '无法写入条件。';
          validateStoryAuthoringShape({ ...emptyStoryAuthoring(), [table]: [candidate] }, true);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
        if (!writeStructuredValue(draft, scope, currentPath, condition)) return '无法写入条件。';
        for (const values of [draft.structuredInputs, draft.structuredRows]) {
          if (!values) continue;
          for (const item of Object.keys(values)) if (item === key || item.startsWith(key.slice(0, -1) + ',')) delete values[item];
        }
        this.state.error = null;
        this.state.notice = null;
        this.requestRefresh();
      },
    });
  }

  private changeStoryId(trigger?: HTMLElement): void {
    const draft=currentDraft(this.state);
    if (!draft || this.state.storageBlocked) return;
    const fromId=draft.document.id, mod=fromId.split(':')[0], e=createUIContext(this.ctrl.game).escapeHtml;
    const packs=storyEditingMods(this.ctrl.game).filter(pack=>pack.modName===mod && (!draft.targetPackId || (pack.packRecordId ?? pack.id)===draft.targetPackId));
    const preferred=draft.targetPackId ?? this.state.targetPackId ?? (packs.length===1 ? packs[0].packRecordId ?? packs[0].id : '');
    let selected: ReturnType<typeof storyEditingMod> | undefined;
    const showError = (error: unknown) => {
      message.textContent = error instanceof Error ? error.message : String(error);
      message.hidden = false;
    };
    const toStoryId = () => `${mod}:story:${name.value.trim()}`;
    const selectPack=()=>{
      const id = packSelect.value;
      selected=undefined;
      preview.textContent = '请选择编辑副本并输入有效的新名称。';
      try {
        selected=storyEditingMod(this.ctrl.game,id);
        const to = toStoryId();
        const plan=planEditorStoryRename(this.state,id,selected.record.datapack,draft.draftId,to,new Set([...this.ctrl.game.registry.stories.keys(),...knownModStoryIds(this.ctrl.game,mod)]));
        preview.textContent=`${fromId} → ${to}\n${plan.published?'确认后将保存到此 Mod，重新载入后生效。':'仅修改草稿，正式保存沿用目标 Mod。'}\n${plan.references.length} 处引用${plan.references.length?'：\n'+plan.references.map(ref=>`${ref.id} ${ref.path}`).join('\n'):''}`;
        message.hidden = true;
      } catch(error) {showError(error);}
    };
    const panel = openStoryEditorDialog(this.ctrl.modal, {
      title: '更改 Story ID', panelClass: 'story-editor-identity',
      body: `<div class="story-editor-dialog__split">
        <div class="story-editor-dialog__fields">
          <label class="story-editor-property">所属 ModId（创建后固定）<input name="story-mod-id" value="${e(mod)}" readonly></label>
          <label class="story-editor-property">保存到编辑副本<select data-story-rename-mod><option value="">选择编辑副本</option>${packs.map(pack=>`<option value="${e(pack.packRecordId ?? pack.id)}"${(pack.packRecordId ?? pack.id)===preferred?' selected':''}>${e(pack.name)} · ${e(pack.modName)}</option>`).join('')}</select></label>
          <label class="story-editor-property">Story ID 名称<input data-story-new-id value="${e(fromId.split(':')[2])}" placeholder="story_1"></label>
          ${packs.length ? '' : '<p>请先为此 Mod 创建编辑副本。</p>'}
          <p class="story-editor-error" data-story-identity-error hidden></p>
        </div>
        <section class="story-editor-dialog__preview" aria-label="引用影响">
          <h3>引用影响</h3>
          <p class="story-editor-dialog__preview-text" data-story-rename-preview></p>
        </section>
      </div>`,
      footer:'<button type="button" class="modal-close">取消</button><button type="button" class="primary-button" data-modal-action="rename-story-id">确认更改</button>',
      onClose: () => { this.editorDialog = undefined; },
      onAction:action=>{
        if(action!=='rename-story-id' || !this.isOpen() || this.state.storageBlocked || currentDraft(this.state)!==draft || draft.document.id!==fromId)return;
        try {
          if(!selected)throw new Error('请选择编辑态 Mod。');
          const packId=selected.record.packRecordId, live=storyEditingMod(this.ctrl.game,packId);
          if(live.entry.contentDigest!==selected.entry.contentDigest)throw new Error('目标 Mod 已变化，请重新选择 Mod 并核对引用。');
          const toId = toStoryId();
          const plan=planEditorStoryRename(this.state,packId,live.record.datapack,draft.draftId,toId,new Set([...this.ctrl.game.registry.stories.keys(),...knownModStoryIds(this.ctrl.game,mod)]));
          if(plan.published){
            const result=this.ctrl.commands.renameStoryInPack?.(packId,{fromId,toId,expectedDigest:selected.entry.contentDigest ?? '',patch:plan.patch});
            if(!result?.ok)throw new Error(result?.message ?? '当前运行环境不支持包内更改 ID。');
          } else {
            const candidate={...this.state,drafts:plan.drafts,target:this.state.target ? {...this.state.target}:null,visits:this.state.visits.map(visit=>({...visit,target:{...visit.target}}))};
            acceptEditorStoryRename(candidate,plan.drafts,fromId,toId);
            if(!this.persistence.save(candidate))throw new Error(candidate.error ?? '草稿保存失败，原 ID 已保留。');
          }
          this.closeAuthoringPreview();this.closeThemeContentEdit();this.closeSelectionNavi();this.requiredFlagDropdown.close();
          acceptEditorStoryRename(this.state,plan.drafts,fromId,toId);this.state.targetPackId=packId;
          const tab=this.inspectorTabs.get(fromId);if(tab){this.inspectorTabs.set(toId,tab);this.inspectorTabs.delete(fromId);}
          for(const [key,value] of this.inspectorScroll){const parts=JSON.parse(key);if(parts[0]?.kind==='story' && parts[0].id===fromId){parts[0].id=toId;this.inspectorScroll.set(JSON.stringify(parts),value);this.inspectorScroll.delete(key);}}
          const saved=this.save(false,false);
          this.state.notice=plan.published?(saved?'Story ID 与引用已保存到 Mod，请重新载入后使用。':'Mod 已保存，但本地草稿保存失败；当前内容仍在编辑中，请勿关闭。'):'Story ID 与草稿引用已更新。';
          this.closeEditorDialog();this.requestRefresh();
        }catch(error){showError(error);}
      },
    }, trigger);
    this.editorDialog = panel;
    const name = panel.querySelector<HTMLInputElement>('[data-story-new-id]')!;
    const packSelect = panel.querySelector<HTMLSelectElement>('[data-story-rename-mod]')!;
    const preview = panel.querySelector<HTMLElement>('[data-story-rename-preview]')!;
    const message = panel.querySelector<HTMLElement>('[data-story-identity-error]')!;
    packSelect.addEventListener('change', selectPack);
    name.addEventListener('input', selectPack);
    name.focus({ preventScroll: true });
    selectPack();
  }

  private action(action: string, trigger?: HTMLElement): void {
    if (action === 'history-back' || action === 'history-forward') { this.browseHistory(action === 'history-back' ? -1 : 1); return; }
    if (this.state.storageBlocked && action !== 'info') return;
    if (action === 'save-to-runtime') { this.saveToRuntime(); return; }
    if (action === 'restore-source') { this.confirmRestoreSource(); return; }
    if (['new', 'delete-node', 'up', 'down', 'send', 'click', 'operation', 'transfer', 'moveToArea', 'moveToCharaspace'].includes(action)) this.state.notice = null;
    if (action === 'new') {
      this.createStoryInMod();
    } else if (action === 'rename-id') this.changeStoryId(trigger);
    else if (action === 'save') this.save(true, false);
    else if (action === 'choose-sender') this.state.sidebarMode = 'senders';
    else if (action === 'info' || action === 'rename') { this.closeThemeContentEdit();this.rememberInspectorScroll(); this.state.selectedNodeId = null; this.state.inspectorView = 'story'; if (action === 'rename') this.state.storyInspectorTab = 'overview'; this.restoreInspectorScroll(); this.focusName = action === 'rename'; }
    else if (action === 'delete-node') deleteNode(this.state);
    else if (action === 'up' || action === 'down') moveNode(this.state, action === 'up' ? -1 : 1);
    else if (action === 'send' || action === 'click' || action === 'operation' || action === 'transfer' || action === 'moveToArea' || action === 'moveToCharaspace') {
      const added = appendNode(this.state, action === 'send' ? 'text' : action, storySenders(createUIContext(this.ctrl.game)));
      if (added) { this.state.inspectorView = 'node'; this.revealNodeId = added.id; }
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
        this.state.target = null;
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
        const previousTarget = this.state.target;
        const previousSelectedNodeId = this.state.selectedNodeId;
        const previousInsertionBeforeNodeId = this.state.insertionBeforeNodeId;
        const previousComposer = this.state.composers[draft.draftId];
        this.state.drafts = previousDrafts.filter(item => item !== draft);
        this.state.target = null;
        this.state.selectedNodeId = null;
        this.state.insertionBeforeNodeId = null;
        delete this.state.composers[draft.draftId];
        if (!this.persistence.save(this.state, true)) {
          this.state.drafts = previousDrafts;
          this.state.target = previousTarget;
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
          this.state.target = previousTarget;
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
