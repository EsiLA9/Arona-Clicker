import { currentRelatedFlagCatalog, currentStoryFlagCatalog } from './flag-catalog-view';
import { changeEntryActivation, defaultEntryActivation, type EntryActivation } from './entry-activation';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { emptyStoryAuthoring, STORY_AUTHORING_TABLES, validateStoryAuthoringShape } from '../../data-services/authoring/story-authoring';
import { storyDirectoryReferences, type StoryDirectoryReference } from '../../data-services/authoring/story-directory-references';
import { acceptEditorStoryRename, knownModStoryIds, planEditorStoryRename, storyEditingMod, storyEditingMods } from './identity';
import { bindFlagTableNode, canBindFlagTableNode } from './flag-table-binding';
import { copyStoryNode, pasteStoryNode, type StoryNodeClipboard } from './node-clipboard';
import { StoryNodeContextMenu } from './node-context-menu';
import { openStoryEditorDialog } from './editor-dialog';
import { openStoryCardGradientDialog } from './card-gradient-dialog';
import { storyCardStyle } from './target-view';
import { isActiveEditingPack, openActiveEditingPackPicker } from '../components/shared/active-editing-pack-picker';
import { openStoryCatalogDialog, type CatalogDialogMemory } from './catalog-dialog';
import { createStoryDirectoryManagement } from './directory-management';
import { createStoryDirectoryManagementState, type StoryDirectoryArchiveTarget, type StoryDirectoryManagementState, type StoryDirectoryResourceRef } from './directory-management-state';
import { createStoryDirectoryBrowseSeed, resolveStoryDirectoryResourceRequest, storyDirectoryBrowseProviderKey, storyDirectoryResourceKey, type StoryDirectoryBrowseState } from './directory-instance';
import { openConditionTreeDialog } from './condition-tree-dialog';
import { conditionReferenceChoices } from './condition-reference-navi';
import { storyReferenceDocuments } from './property-options';
import { resolveStoryIdentity } from '../components/story/story-identity';
import { entryConditionField, STORY_CONDITION_TARGETS } from './condition-fields';
import { openReferenceNavi, prepareReferenceNavi, referenceChoices, type ReferenceField } from './reference-navi';
import { hydrateStoryAuthoring, structuredKey, structuredRoot, editStructuredValue, writeStructuredValue, constructStructuredValue, compileStoryAuthoring, copyStoryIdentity, addStoryAuthoringRow } from './authoring-model';
import { ENTRY_FIELD_SEEDS } from './authoring-view';
import { buildStoryRelations } from './relations-model';
import { buildStoryFlagCatalog, flagImportKey, renameStoryCatalogFlag, storyFlagNames, storyFlagRenameUses } from './flag-catalog';
import { openLocalFlagNavi } from './local-flag-navi';
import { RequiredFlagDropdown, requiredFlagOptions } from './required-flag-dropdown';
import { StoryInlineTextEditor } from './inline-text';
import { currentAuthoringDraft, storyEntries, storyPreviewEntries, type StoryDraft, type StoryEditorState, type StoryEditorTarget, type StoryEditorVisit } from './model';
import { setValueAt, valueAt, type ValuePath } from './structured-value';
import type { StoryAuthoringPatch, StoryAuthoringPreview, StoryAuthoringPreviewTarget, StoryPreviewDecision } from '../../arona-clicker/contracts/runtime/story-authoring';
import type { UIController } from '../controller/controller';
import type { PanelState } from '../components/shared/app-shell';
import type { UIContext } from '../runtime/context';
import { createUIContext } from '../runtime/context';
import { renderWorkspaceFrame } from '../components/shared/workspace-frame';
import { appendNode, bindStoryNodeToChoiceOption, bindStoryNodeToFlagReader, canBindStoryNodeToChoiceOption, canBindStoryNodeToFlagReader, composer, createStoryEditorState, currentDraft, currentNode, deleteNode, editNode, editNodeFlag, isGeneratedStoryNodeId, moveNode, moveNodeToInsertionPoint, newStory, renameStory, renameStoryChoiceOptionId, renameStoryLocalFlag, renameStoryNodeId, selectStory, setInsertionPoint, storyDefinitionFromDraft, suggestStoryNodeId, unbindStoryNodeFromChoiceOption, type StoryDraftNode } from './model';
import { StoryDraftPersistence } from './persistence';
import { ImageStore } from '../../data-services/assets/image-store';
import { PicService } from '../../data-services/assets/pic-service';
import type { PackCatalogReadModel, StoryPackSource } from '../../arona-clicker/contracts/runtime/runtime';
import type { ContentCatalogQueryPort } from '../../arona-clicker/contracts/runtime/content-catalog';
import { createStoryExplorerState, isLoadedStoryPack, parseStoryExplorerSource, storyExplorerSourceValue, storyPackCatalog, storyPackSource, storySourceGame,
  type StoryExplorerProjection } from './pack-source';
import { createStoryDirectoryBusinessProjection, createStoryEditorBusinessColumns, createStoryEditorExplorerColumn, storyEditorBusinessChrome, storyEditorDocumentName, storySenders } from './view';
import { applyEditorWorkspaceWidths, editorLayout, editorWorkspaceViewAttributes, setEditorWorkspaceView, type EditorWorkspaceView, renderEditorWorkspaceRegions } from '../workspace/editor-workspace';
import { captureStoryBrowseInstanceState, captureStoryInstanceState, restoreStoryBrowseInstanceState, restoreStoryInstanceState, createEmptyStoryBrowseInstance, createStoryBrowseInstanceSeed, createStoryTargetBrowseSeed, storyBrowseIdentity, storyBrowseInstancePresentation, editorPanels, storyEditorEdges, storyWorkType, type EditorScroll, type StoryBrowseInstance, type StoryBrowseInstanceState, type StoryInstanceScroll } from './workspace-session';
import type { BrowseInstanceId } from '../workspace/browse-instance-manager';
import type { EditorBrowseInstanceState } from '../workspace/editor-browse-instances';
import type { EditorExplorerProjection, EditorWorkbenchBusinessProjection } from '../workspace/editor-workbench';
import { editorResourceOpenRequest, type EditorResourceOpenRequest } from '../workspace/editor-resource-request';
import { editorDirectoryContentOwner, sidebarInitIds, sidebarSearch, storyExplorerResourceIdentity } from './sidebar-tree';
import { bindEditorDirectoryScrollbars, refreshEditorDirectoryScrollbars } from '../workspace/editor-directory-scroll';
import { storyEditorSceneTarget } from './scene-view';
import { patchEditorDOM } from './dom';
import { captureFocusWithin, restoreFocusWithin } from '../interaction/focus';
import { hasStoryNodeOverlay } from './property-fields';
import { addRow, editProperty, editStoryNodeBody, moveRowBy, readProperty, removeProperty, removeRow, selectBranch, selectDiscriminant, selectLiteralKind, selectNodeType, selectThemeScope, toggleOptional, rowIdAt } from './property-model';
import type { Discriminator, PropertyPath } from './property-model';

const DISCRIMINATORS: readonly string[] = ['kind', 'command', 'op', 'entryType', 'mode', 'valueKind', 'type', 'entityKind'];
const STORY_EDITOR_DRAG_TYPE = 'application/x-acprogram-story-editor';
type StoryEditorDragItem = { version: 1; draftId: string; nodeId: string } &
  ({ kind: 'story-node' } | { kind: 'story-flag'; flagName: string; optionId?: string });
function readStoryDragItem(event: DragEvent): StoryEditorDragItem | undefined {
  const raw = event.dataTransfer?.getData(STORY_EDITOR_DRAG_TYPE);
  if (!raw) return;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return;
    const item = value as Partial<StoryEditorDragItem>;
    return item.version === 1 && typeof item.draftId === 'string' && typeof item.nodeId === 'string'
      && (item.kind === 'story-node' || item.kind === 'story-flag' && typeof item.flagName === 'string' && (item.optionId === undefined || typeof item.optionId === 'string'))
      ? item as StoryEditorDragItem : undefined;
  } catch { return; }
}
function hasFlowFlag(node: StoryDraftNode, flagName: string, optionId?: string): boolean {
  if (optionId === undefined) return node.requiresFlag === flagName;
  if (node.type !== 'click' || node.interaction.kind !== 'choice') return false;
  const option = node.interaction.options?.find(option => option.id === optionId);
  return option?.requiresFlag === flagName || Array.isArray(option?.marks) && option.marks.includes(flagName);
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
function storyFlagBindingDrop(target: Element | null, item: StoryEditorDragItem) {
  const element = target?.closest<HTMLElement>(item.kind === 'story-flag' ? '[data-editor-node]' : '[data-story-drop-target="story-flag-reader"]');
  const flagName = item.kind === 'story-flag' ? item.flagName : element?.dataset.storyFlagName;
  const nodeId = item.kind === 'story-flag' ? element?.dataset.editorNode : item.nodeId;
  return element && flagName && nodeId ? { element, flagName, nodeId } : undefined;
}
function clearStoryFlagDropStates(flow: HTMLElement): void {
  for (const element of flow.querySelectorAll<HTMLElement>('[data-story-flag-drop-status]')) delete element.dataset.storyFlagDropStatus;
}

function flagTableDropTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element && !target.closest('.story-editor-flag-details')
    ? target.closest<HTMLElement>('[data-story-drop-target="story-flag-table"]')
    : null;
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
  readonly explorerState = createStoryExplorerState();
  private get browseInstances() { return this.ctrl.browseInstances; }
  private get explorer() { return this.ctrl.workbench.explorer; }
  private activatingBrowseInstance?: StoryBrowseInstance;
  private restoreInstanceScroll?: StoryInstanceScroll;
  private storyExplorerCatalog?: { key: string; projection: ReturnType<StoryEditorController['readScopedSource']> };
  private cachedExplorerProjection?: StoryExplorerProjection;
  private loaded = false;
  private disposed = false;
  private draggingItem: StoryEditorDragItem | null = null;
  private get activeBrowseInstance(): StoryBrowseInstance {
    const active = this.browseInstances.active;
    if (!active || active.providerKey !== storyWorkType) throw new Error('The active browse instance is not a Story instance.');
    return active as StoryBrowseInstance;
  }
  private get browseStateOwner(): StoryBrowseInstance {
    if (this.activatingBrowseInstance) return this.activatingBrowseInstance;
    const active = this.browseInstances.active;
    if (active?.providerKey === storyWorkType) return active as StoryBrowseInstance;
    const remembered = this.browseInstances.lastActive(storyWorkType);
    if (remembered?.providerKey === storyWorkType) return remembered as StoryBrowseInstance;
    throw new Error('No Story browse state is available.');
  }
  private get inspectorScroll() { return this.browseStateOwner.state.inspectorScroll; }
  private get inspectorTabs() { return this.browseStateOwner.state.inspectorTabs; }
  private get sourceVisits() { return this.browseStateOwner.state.sourceVisits; }
  private get entryTabScroll() { return this.browseStateOwner.state.entryTabScroll; }
  private get entryTabs() { return this.browseStateOwner.state.entryTabs; }
  private readonly catalogMemory: CatalogDialogMemory = { expanded: new Set(), treeScroll: 0 };
  private pendingInspectorScroll?: number;
  private pendingEntryScroll?: number;
  private nodeClipboard?: StoryNodeClipboard;
  private readonly nodeMenu = new StoryNodeContextMenu();
  private overlayDrag?: { pointerId: number; draftId: string; nodeId: string; path: PropertyPath; overlay: HTMLElement; canvas: HTMLElement; pixels: boolean; x: number; y: number; baseX: number; baseY: number; offsetX: number; offsetY: number };
  private revealNodeId: string | null = null;
  private pendingFlagReveal?: { storyId: string; name: string; kind: string; renamed?: { scope: string; open: boolean } };
  private focusName = false;
  private focusWorkspaceMode = false;
  /** Node-relative property path JSON to focus after the next refresh; set by issue location. */
  private pendingFocus?: string | null;
  private preview?: StoryAuthoringPreview;
  private previewLaunch?: { patch: StoryAuthoringPatch; target: StoryAuthoringPreviewTarget; source?: StoryPackSource };
  private previewTimer?: ReturnType<typeof setInterval>;
  private previewSignature = '';
  private previewReturnScroll?: Record<'left' | 'center' | 'right', number> & { launchKey?: string };
  private pendingVisit?: StoryEditorVisit;
  private pendingDirectoryReveal = false;
  private selectionNaviOpen = false;
  private editorDialog?: HTMLElement;
  private readonly requiredFlagDropdown: RequiredFlagDropdown;
  private readonly inlineText: StoryInlineTextEditor;
  private liveRegistry?: ContentCatalogQueryPort;
  private packCatalogSignature?: string;
  private readonly unbindWorkspace: () => void;
  constructor(private readonly ctrl: UIController, readonly persistence = new StoryDraftPersistence()) {
    this.unbindWorkspace = this.bindWorkspace();
    this.inlineText = new StoryInlineTextEditor(ctrl.root, ctrl.game, () => this.isOpen() ? currentDraft(this.state) : undefined,
      () => this.writeBlocked, nodeId => {
        if (nodeId !== this.state.selectedNodeId) this.closeThemeContentEdit();
        this.rememberInspectorScroll(); this.state.inspectorView = 'node'; this.pendingInspectorScroll = undefined;
        this.state.selectedNodeId = nodeId;
      }, () => this.requestRefresh());
    this.requiredFlagDropdown = new RequiredFlagDropdown(ctrl.root,
      () => this.isOpen() ? JSON.stringify([this.state.target,this.state.selectedNodeId]) : '',
      () => requiredFlagOptions(this.state,buildStoryRelations(this.state,this.registry.stories,this.registry.storyEntries)));
  }

  private get packQuery() { return this.ctrl.game as typeof this.ctrl.game & Partial<PackCatalogReadModel>; }
  private get registry() { return this.state.sourceRegistry ?? this.ctrl.game.registry; }
  private get editorGame() { return storySourceGame(this.ctrl.game, this.state); }
  private get advanced() { return editorLayout.state.mode === 'advanced'; }
  private get explorerSnapshot() { return this.explorer.snapshot('story'); }
  private queryChannel(mode = this.explorerState.directoryMode): string { return this.explorerState.auxiliaryTool === 'senders' ? 'senders' : mode === 'entries' ? 'entries' : 'stories'; }
  directoryExplorerSourceKey(): string { return storyExplorerSourceValue(this.explorerState.source); }
  directoryRootResource(initId = this.ctrl.game.state.activeInit): StoryDirectoryResourceRef {
    return { sourceKey: this.directoryExplorerSourceKey(), initId, logicalDirectoryKey: '' };
  }
  directoryArchiveRequest(): { resource: StoryDirectoryResourceRef; target: StoryDirectoryArchiveTarget } | undefined {
    const target = this.state.target;
    const draft = currentAuthoringDraft(this.state);
    if (!target || !draft || this.state.storageBlocked || this.state.readOnlyReason || this.writeBlocked) return undefined;
    const selection = this.state.sourceSelection ?? '';
    const sourceProjection = this.syncStoryExplorerSource(parseStoryExplorerSource(selection) ?? { kind: 'runtime' });
    const document = target.kind === 'story' ? draft.document
      : storyEntries({ drafts: sourceProjection.drafts }, sourceProjection.sourceRegistry?.storyEntries ?? this.registry.storyEntries).get(target.id);
    if (!document) return undefined;
    const initId = target.kind === 'story'
      ? (document as StoryDraft['document']).initId ?? this.ctrl.game.state.activeInit
      : ((document as StoryEntryDef).availableInits[0] ?? this.ctrl.game.state.activeInit);
    const logicalDirectoryKey = target.kind === 'story'
      ? (document as StoryDraft['document']).directoryId ?? ''
      : (document as StoryEntryDef).directoryPlacements?.find(row => row.initId === initId)?.directoryId ?? '';
    const modName = this.registry.storyDirectoryContentOwner(target.id, target.kind) ?? target.id.split(':')[0];
    const packSource = draft.packSource;
    return {
      resource: { sourceKey: this.directoryExplorerSourceKey(), initId, logicalDirectoryKey, ownerModName: modName },
      target: { kind: target.kind, id: target.id, sourceKey: selection, draftId: draft.draftId,
        targetPackId: draft.targetPackId, modName, initId, expectedDigest: packSource?.digest },
    };
  }
  createDirectoryBrowseSeed(resource: StoryDirectoryResourceRef, archiveTarget?: StoryDirectoryArchiveTarget) {
    const normalized = parseStoryExplorerSource(resource.sourceKey) ?? { kind: 'runtime' as const };
    const sourceProjection = this.syncStoryExplorerSource(normalized);
    const packId = normalized.kind === 'pack' && this.packSource(normalized.packId)?.packRecordId === normalized.packId
      ? normalized.packId : !resource.sourceKey && resource.ownerModName ? this.packQuery.getRunningStoryPackId?.(resource.ownerModName) : undefined;
    const packSource = packId ? this.packSource(packId) : undefined;
    const writeBinding = packSource && storyEditingMods(this.ctrl.game).some(pack => (pack.packRecordId ?? pack.id) === packId)
      ? { packRecordId: packId!, modName: packSource.modName, expectedDigest: packSource.digest, purpose: 'directory' as const }
      : undefined;
    const management = createStoryDirectoryManagementState({ resource: { ...resource }, writeBinding, archiveTarget });
    const title = this.buildDirectoryManagement(management).title();
    return createStoryDirectoryBrowseSeed({ management }, title);
  }
  directoryBusinessProjection(ctx: UIContext, instance: import('../workspace/browse-instance-manager').BrowseInstance<StoryDirectoryBrowseState>): EditorWorkbenchBusinessProjection {
    const management = this.buildDirectoryManagement(instance.state.management);
    return createStoryDirectoryBusinessProjection(ctx, management, instance.id, root => this.bindDirectoryInstance(root, instance));
  }
  private bindDirectoryInstance(root: HTMLElement, instance: import('../workspace/browse-instance-manager').BrowseInstance<StoryDirectoryBrowseState>): () => void {
    const abort = new AbortController();
    const options = { signal: abort.signal };
    const managementState = instance.state.management;
    const currentDirectory = () => this.buildDirectoryManagement(managementState);
    root.addEventListener('click', event => {
      const element = event.target instanceof Element ? event.target : null;
      const childResource = element?.closest<HTMLElement>('[data-editor-resource-provider="story-directory"]');
      if (childResource && root.contains(childResource)) {
        const request = editorResourceOpenRequest(childResource, 'instance-link');
        const resource = request && resolveStoryDirectoryResourceRequest(request);
        if (!resource || !this.ctrl.openStoryDirectoryResource(resource, managementState.archiveTarget)) {
          this.ctrl.toast.show('目标目录无法打开；归档目标和当前目录工作状态已保留。', 'error');
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const reference = element?.closest<HTMLButtonElement>('[data-directory-reference-kind]');
      if (reference && root.contains(reference)) {
        event.preventDefault();
        event.stopPropagation();
        const kind = reference.dataset.directoryReferenceKind;
        const id = reference.dataset.directoryReferenceId;
        const sourceKey = reference.dataset.directoryReferenceSource ?? managementState.resource.sourceKey;
        const opened = kind === 'directory' && id
          ? this.ctrl.openStoryDirectoryResource({ sourceKey, initId: reference.dataset.directoryReferenceInit ?? managementState.resource.initId,
              logicalDirectoryKey: id, ownerModName: reference.dataset.directoryReferenceOwner ?? id.split(':')[0] })
          : (kind === 'story' || kind === 'entry') && id
            ? this.openDirectoryDocumentReference(kind, id, sourceKey)
            : false;
        if (!opened) this.ctrl.toast.show('关联资源无法打开；当前目录工作状态已保留。', 'error');
        return;
      }
      const action = element?.closest<HTMLButtonElement>('[data-directory-create], [data-directory-action], [data-column-action^="directory-tab:"]');
      if (!action || !root.contains(action) || action.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      const focusSnapshot = captureFocusWithin(this.ctrl.root);
      const focusedField = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
        ? document.activeElement : undefined;
      const selection = focusedField && 'selectionStart' in focusedField
        ? [focusedField.selectionStart, focusedField.selectionEnd] as const : undefined;
      if (action.dataset.directoryAction === 'reload-latest') {
        const binding = managementState.writeBinding;
        const latest = binding && this.packSource(binding.packRecordId);
        if (!binding || !latest || !isActiveEditingPack(this.packQuery, binding.packRecordId, binding.modName)) {
          this.ctrl.toast.show('原编辑态包已不可用；输入仍保留在此目录实例中。', 'error');
          return;
        }
        if (!window.confirm('重新载入会丢弃此目录实例的未保存输入，并采用当前编辑态包版本。继续吗？')) return;
        managementState.writeBinding = { ...binding, expectedDigest: latest.digest };
        managementState.working = { editingDesign: false, values: new Map(), moving: false, moveQuery: '',
          moveParent: undefined, sorting: undefined, removing: false, status: '已载入编辑态包的最新版本。' };
        this.ctrl.render();
        return;
      }
      const creation = action.dataset.directoryCreate;
      if (creation) {
        const owner = action.dataset.directoryCreateOwner;
        this.closeEditorDialog();
        this.editorDialog = openActiveEditingPackPicker(this.ctrl.modal, {
          catalog: this.packQuery, escapeHtml: createUIContext(this.editorGame).escapeHtml,
          trigger: action, accept: pack => !owner || pack.modName === owner,
          onClose: () => { this.editorDialog = undefined; },
          onSelect: packId => {
            if (this.browseInstances.activeId !== instance.id) return;
            const pack = this.packSource(packId);
            if (!pack || !isActiveEditingPack(this.packQuery, packId, pack.modName)) {
              managementState.working.status = '该包已不在当前活跃的编辑态中，目录修改仍保留。';
              this.ctrl.render();
              return;
            }
            managementState.writeBinding = { packRecordId: packId, modName: pack.modName,
              expectedDigest: pack.digest, purpose: 'new-directory' };
            this.buildDirectoryManagement(managementState).action(creation, root);
            this.ctrl.render();
          },
        });
        return;
      }
      currentDirectory().action(action.dataset.directoryAction ?? action.dataset.columnAction?.slice('directory-'.length) ?? '', root);
      this.syncDirectoryBrowseIdentity(instance);
      this.ctrl.render();
      restoreFocusWithin(this.ctrl.root, focusSnapshot);
      if (selection && document.activeElement instanceof HTMLInputElement || selection && document.activeElement instanceof HTMLTextAreaElement) {
        const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
        active.setSelectionRange(selection[0], selection[1]);
      }
    }, options);
    root.addEventListener('input', event => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
        || !field.hasAttribute('data-directory-field')) return;
      const directory = currentDirectory();
      const update = directory.input(field);
      if (update === 'preview') {
        const preview = root.querySelector<HTMLElement>('[data-directory-preview]');
        if (preview) {
          const next = preview.cloneNode(false) as HTMLElement;
          next.innerHTML = directory.renderPreview();
          patchEditorDOM(preview, next, removed => this.ctrl.popovers.dismissBeforeRootMutation(removed));
        }
      } else if (update === 'region') {
        const current = root.querySelector<HTMLElement>('[data-editor-key="directory-details"]');
        if (current) {
          const next = current.cloneNode(false) as HTMLElement;
          next.innerHTML = directory.renderDetails();
          patchEditorDOM(current, next, removed => this.ctrl.popovers.dismissBeforeRootMutation(removed));
        }
      }
    }, options);
    root.addEventListener('change', event => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
        || !field.hasAttribute('data-directory-field')) return;
      currentDirectory().input(field);
    }, options);
    return () => abort.abort();
  }

  openDirectoryDocumentReference(kind: 'story' | 'entry', id: string, sourceKey: string): boolean {
    return this.openFromExplorer({ kind, id }, sourceKey);
  }

  private syncDirectoryBrowseIdentity(instance: import('../workspace/browse-instance-manager').BrowseInstance<StoryDirectoryBrowseState>): void {
    const state = instance.state;
    const resourceKey = storyDirectoryResourceKey(state.management.resource);
    if (resourceKey === instance.resourceKey && resourceKey === instance.reuseKey) return;
    const collision = this.browseInstances.findReusable(storyDirectoryBrowseProviderKey, resourceKey);
    if (collision && collision.id !== instance.id) {
      state.unavailable = { reason: '目录身份已被另一个打开的实例占用；当前工作状态已保留，请处理冲突后再继续。' };
      this.ctrl.toast.show(state.unavailable.reason, 'error');
      return;
    }
    const title = this.buildDirectoryManagement(state.management).title();
    const updated = this.browseInstances.update(instance.id, { resourceKey, reuseKey: resourceKey,
      presentation: { ...instance.presentation, title, kind: 'directory', icon: 'directory' } });
    if (!updated.ok) {
      state.unavailable = { reason: updated.message };
      this.ctrl.toast.show(updated.message, 'error');
    }
  }
  createExplorerColumn(ctx: UIContext, snapshot = this.explorerSnapshot) {
    const active = this.browseInstances.active;
    return createStoryEditorExplorerColumn(ctx, this.state, this.explorerState, this.syncStoryExplorerSource(), snapshot,
      this.isOpen() && active?.providerKey === storyWorkType,
      active?.providerKey === storyWorkType || active?.providerKey === storyDirectoryBrowseProviderKey ? active.resourceKey : undefined);
  }
  explorerProjection(ctx: UIContext, snapshot = this.explorerSnapshot): EditorExplorerProjection {
    return { type: 'story', state: snapshot, column: this.createExplorerColumn(ctx, snapshot), bindColumn: root => {
      const unbindExplorer = this.bindExplorerColumn(root);
      const unbindStory = this.isOpen() ? this.bind(root) : undefined;
      return () => { unbindExplorer(); unbindStory?.(); };
    } };
  }
  businessProjection(ctx: UIContext): EditorWorkbenchBusinessProjection {
    if (this.browseInstances.active?.providerKey === storyWorkType && this.state.target) this.syncBrowseInstanceIdentity();
    const instances = this.browseInstances.snapshot();
    const projectedColumns = createStoryEditorBusinessColumns(ctx, this.state).map(column => ({ ...column,
      onBack: column.key === 'editor-inspector' ? () => { this.action('info'); this.requestRefresh(); } : column.onBack,
      bind: (root: HTMLElement) => this.bind(root),
    }));
    const previewLeft = this.state.preview ? projectedColumns.find(column => column.slot === 'left') : undefined;
    return { columns: projectedColumns.filter(column => column !== previewLeft),
      ...(previewLeft ? { temporaryLeftColumn: { owner: 'story-preview', column: previewLeft } } : {}),
      ...storyEditorBusinessChrome(ctx, this.state, instances) };
  }
  workspaceBack(): void {
    if (this.preview) { this.closeAuthoringPreview(); this.requestRefresh(); }
    else this.close();
  }
  private revealExplorerTarget(target: StoryEditorTarget | null | undefined): void {
    if (!target) return;
    const scope = this.state.sourceSelection ?? '';
    const owner = this.registry.storyDirectoryContentOwner(target.id, target.kind) ?? target.id.split(':')[0];
    this.explorer.reveal('story', storyExplorerResourceIdentity(target, scope,
      !scope ? this.packQuery.getRunningStoryPackId?.(owner) : undefined));
    this.explorer.selectPlacement('story', undefined);
    this.explorer.requestFocus('story', 'selected');
  }
  private clearExplorerReveal(): void { this.explorer.clearReveal('story'); }
  private get writeBlocked() {
    const draft = currentAuthoringDraft(this.state);
    return this.state.storageBlocked || Boolean(draft && !this.draftSaveAllowed(draft));
  }

  private packSource(id: string): StoryDraft['packSource'] {
    const query = this.packQuery;
    const entry = query.getPackCatalog?.().entries.find(pack => (pack.packRecordId ?? pack.id) === id && isLoadedStoryPack(query, pack));
    return entry && storyPackSource(entry);
  }

  private draftSaveAllowed(draft: StoryDraft): boolean {
    if (!this.state.sourceOptions) return true;
    const source = draft.packSource;
    if (!source || draft.targetPackId !== source.packRecordId || this.state.sourceSelection?.startsWith('draft:')) return false;
    if (this.packQuery.getRunningStoryPackId?.(source.modName) !== source.packRecordId) return false;
    const pack = this.packQuery.getPackCatalog?.().entries.find(item => (item.packRecordId ?? item.id) === source.packRecordId);
    return Boolean(pack?.editingMode === 'editing' && (!source.digest || source.digest === pack.contentDigest)
      && (!this.state.sourceSelection || this.state.sourceSelection === `pack:${source.packRecordId}`));
  }

  private persist(state = this.state, force = false): boolean {
    return this.persistence.save(state, force, draft => this.draftSaveAllowed(draft));
  }

  private refreshPackSource(packId: string, previousDigest?: string): void {
    const source = this.packSource(packId);
    if (!source) return;
    for (const draft of [...this.state.drafts, ...(this.state.parkedDrafts ?? [])]) {
      if (draft.packSource?.packRecordId !== packId || draft.packSource.digest !== previousDigest) continue;
      draft.packSource = source;
      if (draft.persisted) draft.dirty = true;
    }
    this.syncSource(true);
  }

  private draftInLoadedSource(draft: StoryDraft, source: StoryDraft['packSource'], editable: boolean): boolean {
    return Boolean(source && draft.packSource?.packRecordId === source.packRecordId
      && (!draft.targetPackId || editable) && (!draft.packSource.digest || draft.packSource.digest === source.digest));
  }

  private readScopedSource(source: StoryPackSource | undefined) {
    const resolved = source && this.packQuery.getStoryPackSources?.(source);
    const sourceRegistry = storyPackCatalog(resolved?.datapacks ?? []);
    const sourcePics = new PicService(sourceRegistry.pics, new ImageStore());
    for (const pack of resolved?.images ?? []) sourcePics.register(pack.manifest.modName, pack.images);
    return { sourceRegistry, sourcePics, sourceWarning: resolved?.issues.join(' ') || undefined };
  }

  private syncStoryExplorerSource(source = this.explorerState.source): StoryExplorerProjection {
    if (!this.loaded) { this.persistence.load(this.state); this.loaded = true; }
    const bank = [...this.state.drafts, ...(this.state.parkedDrafts ?? [])];
    const catalog = this.packQuery.getPackCatalog?.();
    const loaded = (catalog?.entries ?? []).filter(entry => isLoadedStoryPack(this.packQuery, entry));
    const packs = new Map(loaded.map(entry => [entry.packRecordId ?? entry.id, entry]));
    const sourceOptions: StoryExplorerProjection['sourceOptions'][number][] = loaded.map(entry => {
      const id = entry.packRecordId ?? entry.id;
      const applied = catalog?.panes?.some(pane => pane.runtimePackRecordId === id);
      return { value: `pack:${id}`, group: 'packs' as const,
        label: `${storyPackSource(entry).label} · ${applied ? '已应用' : '临时载入'}` };
    });
    const editing = new Set(loaded.filter(entry => entry.editingMode === 'editing').map(entry => entry.packRecordId ?? entry.id));
    const recoverable = bank.filter(draft => (draft.dirty || draft.persisted)
      && !this.draftInLoadedSource(draft, packs.get(draft.packSource?.packRecordId ?? '')
        ? storyPackSource(packs.get(draft.packSource?.packRecordId ?? '')!) : undefined,
      editing.has(draft.packSource?.packRecordId ?? '')));
    for (const draft of recoverable) sourceOptions.push({ value: `draft:${draft.draftId}`, group: 'drafts',
      label: `${draft.document.name || draft.document.id} · ${draft.packSource?.label ?? draft.document.id}` });

    const pack = source.kind === 'pack' ? packs.get(source.packId) : undefined;
    const recovery = source.kind === 'draft' ? bank.find(draft => draft.draftId === source.draftId) : undefined;
    const available = source.kind === 'runtime' || Boolean(pack) || Boolean(recovery);
    if (!available) sourceOptions.push({ value: storyExplorerSourceValue(source), group: source.kind === 'pack' ? 'packs' : 'drafts',
      label: source.kind === 'pack' ? `不可用数据包 · ${source.packId}` : `不可用草稿 · ${source.draftId}` });
    const selectedPackSource = pack ? storyPackSource(pack) : recovery?.packSource;
    const catalogSignature = JSON.stringify(loaded.map(entry => [entry.packRecordId ?? entry.id, entry.contentDigest]));
    const key = JSON.stringify([storyExplorerSourceValue(source), selectedPackSource?.digest, catalogSignature,
      bank.map(draft => [draft.draftId, draft.dirty, draft.persisted, draft.packSource?.digest])]);
    if (source.kind === 'runtime') this.storyExplorerCatalog = undefined;
    else if (available && this.storyExplorerCatalog?.key !== key) this.storyExplorerCatalog = { key, projection: this.readScopedSource(selectedPackSource) };
    const drafts = !available ? [] : recovery ? [recovery] : source.kind === 'pack'
      ? bank.filter(draft => draft.packSource?.packRecordId === source.packId
        && this.draftInLoadedSource(draft, pack && storyPackSource(pack), pack?.editingMode === 'editing'))
      : source.kind === 'runtime' ? bank.filter(draft => draft.viewSource === '' || draft.viewSource === undefined && !draft.packSource || Boolean(draft.packSource
        && this.packQuery.getRunningStoryPackId?.(draft.packSource.modName) === draft.packSource.packRecordId))
        : bank.filter(draft => draft.packSource && packs.has(draft.packSource.packRecordId)
          && this.draftInLoadedSource(draft, storyPackSource(packs.get(draft.packSource.packRecordId)!), editing.has(draft.packSource.packRecordId)));
    const projection = source.kind === 'runtime' ? undefined : this.storyExplorerCatalog?.projection;
    const sourceWarning = !available ? source.kind === 'pack'
      ? '该目录数据包来源已卸载。请重新载入该包，或切换到其他来源。'
      : '该目录草稿来源已不存在。请选择可用的目录来源。'
      : projection?.sourceWarning;
    this.cachedExplorerProjection = { source, sourceOptions, drafts,
      sourceRegistry: projection?.sourceRegistry, sourcePics: projection?.sourcePics, sourceWarning,
      sourceMod: pack?.modName ?? recovery?.packSource?.modName,
      runtimeScope: JSON.stringify([...packs.keys()].sort()), available };
    return this.cachedExplorerProjection;
  }

  private syncSource(force = false): void {
    const query = this.packQuery;
    if (!query.getRunningStoryPackId || !query.getStoryPackSources) return;
    const catalog = query.getPackCatalog?.();
    const loaded = (catalog?.entries ?? []).filter(entry => isLoadedStoryPack(query, entry));
    const sources = new Map(loaded.map(entry => {
      const source = storyPackSource(entry);
      return [source.packRecordId, source] as const;
    }));
    const editing = new Set(loaded.filter(entry => entry.editingMode === 'editing').map(entry => entry.packRecordId ?? entry.id));
    const state = this.state, selection = state.sourceSelection ?? '';
    const bank = [...state.drafts, ...(state.parkedDrafts ?? [])];
    const previous = currentAuthoringDraft(state);
    const recovery = selection.startsWith('draft:') ? bank.find(draft => draft.draftId === selection.slice(6)) : undefined;
    const selected = selection.startsWith('pack:') ? sources.get(selection.slice(5)) : undefined;
    const live = this.ctrl.game.registry;
    const liveChanged = this.liveRegistry !== live;
    this.liveRegistry = live;
    const signature = JSON.stringify(loaded.map(item => [item.packRecordId ?? item.id, item.contentDigest]));
    const catalogChanged = this.packCatalogSignature !== signature;
    this.packCatalogSignature = signature;
    state.sourceMod = selected?.modName;
    if (liveChanged) {
      if (this.preview) this.closeAuthoringPreview();
      this.sourceVisits.delete('');
      if (!selection) { state.visits = []; state.visitIndex = -1; }
    }
    state.sourceOptions = loaded.map(item => {
      const id = item.packRecordId ?? item.id;
      const applied = catalog?.panes?.some(pane => pane.runtimePackRecordId === id);
      const status = applied ? '已应用' : '临时载入';
      return { value: `pack:${id}`, group: 'packs', label: `${sources.get(id)!.label} · ${status}` };
    });
    if (force || liveChanged || catalogChanged) {
      const projection = selection ? this.readScopedSource(selected ?? recovery?.packSource) : undefined;
      state.sourceRegistry = projection?.sourceRegistry;
      state.sourcePics = projection?.sourcePics;
      state.sourceWarning = projection?.sourceWarning;
    }
    const active: StoryDraft[] = [], parked: StoryDraft[] = [];
    for (const draft of bank) {
      if (!draft.packSource && draft.targetPackId) {
        const source = sources.get(draft.targetPackId);
        const record = source && query.getPackRecord?.(source.packRecordId);
        if (record?.editingMode === 'editing' && (draft.sourceId
          ? record.datapack.stories.some(row => row.id === draft.sourceId)
          : draft.document.id.startsWith(`${source!.modName}:`))) draft.packSource = source;
      }
      const source = draft.packSource;
      const current = source && sources.get(source.packRecordId);
      const inSource = source && this.draftInLoadedSource(draft, current, editing.has(source.packRecordId)) && (selected
        ? selected.packRecordId === source.packRecordId
        : !selection && query.getRunningStoryPackId(source.modName) === source.packRecordId);
      const viewing = !draft.dirty && !draft.persisted && !liveChanged && !catalogChanged && !force && draft.viewSource === selection;
      if (recovery === draft || inSource || viewing) active.push(draft);
      else if (draft.persisted || draft.dirty) parked.push(draft);
    }
    state.drafts = active;
    state.parkedDrafts = parked;
    const recoverable = this.advanced ? bank.filter(draft => (draft.dirty || draft.persisted)
      && !this.draftInLoadedSource(draft, sources.get(draft.packSource?.packRecordId ?? ''), editing.has(draft.packSource?.packRecordId ?? ''))) : parked;
    for (const draft of new Set([...recoverable, ...(recovery ? [recovery] : [])])) {
      state.sourceOptions.push({ value: `draft:${draft.draftId}`, group: 'drafts',
        label: `${draft.document.name || draft.document.id} · ${draft.packSource?.label ?? draft.document.id}` });
    }
    if (previous && !active.includes(previous)) {
      this.closeAuthoringPreview();
      this.closeEditorDialog(); this.closeSelectionNavi(); this.closeThemeContentEdit();
      if (parked.includes(previous)) {
        state.sourceSelection = `draft:${previous.draftId}`;
        state.visits = []; state.visitIndex = -1;
        this.syncSource(true);
        return;
      }
      if (state.target) {
        const instance = this.browseStateOwner;
        instance.state.snapshot = captureStoryInstanceState(state);
        instance.state.scroll = this.captureInstanceScroll();
        instance.state.document = { target: state.target, draftId: previous.draftId, packId: previous.packSource?.packRecordId,
          name: state.target.kind === 'story' ? previous.document.name : state.target.id };
        instance.state.unavailable = true;
      }
      state.target = null; state.selectedNodeId = null; state.insertionBeforeNodeId = null;
    }
    if (selection.startsWith('pack:') && !selected) {
      state.sourceSelection = undefined; state.targetPackId = undefined;
      state.visits = []; state.visitIndex = -1;
      this.syncSource(true);
      state.sourceWarning = '原数据包来源已卸载，已切回当前游戏。';
      return;
    }
    const draft = currentAuthoringDraft(state);
    const source = draft?.packSource;
    const pack = source && catalog?.entries.find(entry => (entry.packRecordId ?? entry.id) === source.packRecordId);
    state.readOnlyReason = recovery
      ? `草稿已保留，暂时无法保存。原来源为 ${recovery.packSource?.label ?? recovery.document.id}。请在数据包管理中载入对应的编辑态 Mod。`
      : draft && !this.draftSaveAllowed(draft) ? '当前内容可查阅和试播。请在数据包管理中载入对应的编辑态 Mod 后编辑。' : undefined;
    state.canApplySource = Boolean(draft && this.draftSaveAllowed(draft) && pack && query.getRunningStoryPackId(pack.modName) === source?.packRecordId);
  }

  private selectSource(selection: string): void {
    if (selection === (this.state.sourceSelection ?? '')) return;
    if (selection.startsWith('pack:') && !this.packSource(selection.slice(5))) {
      this.state.sourceWarning = '该数据包未载入。请先在数据包管理中应用。';
      this.requestRefresh();
      return;
    }
    if (!this.save(false, false)) return;
    this.closeAuthoringPreview(); this.closeEditorDialog(); this.closeSelectionNavi(); this.closeThemeContentEdit();
    this.requiredFlagDropdown.close(); this.nodeMenu.close();
    const state = this.state;
    const previous = currentAuthoringDraft(state);
    this.rememberVisit();
    this.sourceVisits.set(state.sourceSelection ?? '', { visits: state.visits, index: state.visitIndex });
    const history = this.sourceVisits.get(selection);
    state.sourceSelection = selection || undefined;
    state.targetPackId = selection.startsWith('pack:') ? selection.slice(5) : undefined;
    state.target = null; state.selectedNodeId = null; state.insertionBeforeNodeId = null;
    state.visits = history?.visits ?? []; state.visitIndex = history?.index ?? -1;
    if (!this.advanced) {
    this.explorer.setQuery('story', 'stories', ''); this.explorer.setQuery('story', 'entries', ''); this.explorerState.initFilter = '';
      this.explorer.clearSearchExpansions('story'); this.clearExplorerReveal();
    }
    this.syncSource(true);
    const draft = state.drafts.find(item => selection === `draft:${item.draftId}` || item === previous
      || item.entryOnly === previous?.entryOnly && item.document.id === previous?.document.id);
    if (draft) {
      state.target = draft.entryOnly ? { kind: 'entry', id: draft.entryOnly } : { kind: 'story', id: draft.document.id };
      this.pushVisit(); this.syncSource();
    } else {
      const last = state.visits[state.visitIndex]?.target;
      if (last && this.hasTarget(last)) this.browseTarget(last, state.visitIndex);
      else if (previous && this.registry.stories.has(previous.document.id)) this.browseTarget({ kind: 'story', id: previous.document.id });
    }
    if (state.target) this.syncBrowseInstanceIdentity();
    this.requestRefresh();
  }

  private selectDocument(key: string): boolean {
    if (!selectStory(this.state, key, this.registry.stories)) return false;
    const draft = currentDraft(this.state)!;
    if (this.state.sourceOptions && !draft.packSource) {
      const mod = this.registry.storyDirectoryContentOwner(draft.document.id, 'story') ?? draft.document.id.split(':')[0];
      this.bindDraftSource(draft, mod);
    }
    return true;
  }

  private bindDraftSource(draft: StoryDraft, mod?: string): void {
    const scope = this.state.sourceSelection;
    const selected = scope?.startsWith('pack:') ? this.packSource(scope.slice(5)) : undefined;
    const id = mod && (scope ? selected?.modName === mod ? selected.packRecordId : undefined : this.packQuery.getRunningStoryPackId?.(mod));
    if (id) {
      draft.packSource = this.packSource(id);
      const pack = this.packQuery.getPackCatalog?.().entries.find(item => (item.packRecordId ?? item.id) === id);
      if (pack?.editingMode === 'editing') draft.targetPackId = id;
    } else draft.viewSource = scope ?? '';
  }

  private selectEntryDocument(entry: StoryEntryDef): boolean {
    const drafts = this.state.drafts;
    if (drafts.some(draft => draft.entryOnly === entry.id)) return true;
    const entryMod = this.registry.storyDirectoryContentOwner(entry.id);
    const existing = drafts.some(draft => [...(draft.authoring?.activeStories ?? []), ...(draft.authoring?.passiveStories ?? [])].some(row => row.id === entry.id));
    if (existing && (!this.state.sourceOptions || !entryMod)) return true;
    const key = this.storyKey(entry.storyId);
    const linked = key && this.selectDocument(key) ? currentDraft(this.state) : undefined;
    const storyMod = this.registry.storyDirectoryContentOwner(entry.storyId, 'story');
    if (this.state.sourceOptions && (!linked || entryMod && entryMod !== storyMod)) {
      const table = this.registry.activeStories.has(entry.id) ? 'activeStories' : 'passiveStories';
      const draft: StoryDraft = {
        draftId: crypto.randomUUID(), sourceId: linked?.sourceId ?? null, entryOnly: entry.id,
        document: linked ? structuredClone(linked.document) : { id: entry.storyId, name: entry.storyId, nodes: [], stages: {} },
        authoring: { ...emptyStoryAuthoring(), [table]: [structuredClone(entry)] },
        dirty: false, persisted: false, savedAt: null,
      };
      this.bindDraftSource(draft, entryMod);
      for (const pool of this.registry.passivePools.values()) if (draft.targetPackId && pool.id.startsWith(`${entryMod}:`) && pool.children.some(child => child.id === entry.id)) {
        draft.authoring!.passivePools.push(structuredClone(pool));
      }
      drafts.push(draft);
      return true;
    }
    if (!linked) return false;
    hydrateStoryAuthoring(linked, this.registry);
    return true;
  }

  private inspectorScrollKey(): string { return JSON.stringify([this.state.target,this.state.storyInspectorTab]); }
  private rememberInspectorScroll(): void {
    if (this.state.target?.kind !== 'story' || this.state.inspectorView !== 'story' && currentNode(this.state)) return;
    this.inspectorTabs.set(this.state.target.id,this.state.storyInspectorTab);
    const body = this.ctrl.root.querySelector<HTMLElement>('.story-editor-right .workspace-column__body');
    if (body) this.inspectorScroll.set(this.inspectorScrollKey(),this.pendingInspectorScroll ?? this.editorScrollPosition('right'));
  }
  private restoreInspectorScroll(): void { this.pendingInspectorScroll = this.inspectorScroll.get(this.inspectorScrollKey()) ?? 0; }
  private storyKey(storyId: string): string | undefined {
    return this.state.drafts.find(draft => !draft.entryOnly && draft.document.id === storyId)?.draftId
      ?? (this.registry.stories.has(storyId) ? `source:${storyId}` : undefined);
  }
  private captureVisit(): StoryEditorVisit | undefined {
    const target = this.state.target;
    if (!target) return;
    return { target: { ...target }, selectedNodeId: this.state.selectedNodeId, insertionBeforeNodeId: this.state.insertionBeforeNodeId,
      centerScroll: this.editorScrollPosition('center'),
      rightScroll: this.pendingInspectorScroll ?? this.editorScrollPosition('right') };
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
  private browseStory(key: string, openInstance = false): void {
    const id = this.state.drafts.find(draft => draft.draftId === key)?.document.id ?? (key.startsWith('source:') ? key.slice(7) : undefined);
    if (!id) return;
    const target = { kind: 'story' as const, id };
    if (openInstance) this.openBrowseTarget(target);
    else this.browseTarget(target);
  }
  private hasTarget(target: StoryEditorTarget): boolean {
    return target.kind === 'story' ? !!this.storyKey(target.id) : storyEntries(this.state, this.registry.storyEntries).has(target.id)
      || this.state.drafts.some(draft => draft.entryOnly === target.id);
  }
  canNavigateToTarget(target: StoryEditorTarget, source = this.state.sourceSelection ?? ''): boolean {
    if (target.kind !== 'story' && target.kind !== 'entry') return false;
    if (source.startsWith('pack:') && !this.packSource(source.slice(5))) return false;
    if (source && source !== (this.state.sourceSelection ?? '') && !this.advanced) return false;
    return this.hasTarget(target);
  }
  private canOpenFromExplorer(target: StoryEditorTarget, projection: StoryExplorerProjection): boolean {
    if (!projection.available) return false;
    const registry = projection.sourceRegistry ?? this.ctrl.game.registry;
    if (target.kind === 'story') return registry.stories.has(target.id)
      || projection.drafts.some(draft => !draft.entryOnly && draft.document.id === target.id);
    return storyEntries({ drafts: projection.drafts }, registry.storyEntries).has(target.id)
      || projection.drafts.some(draft => draft.entryOnly === target.id);
  }
  openFromExplorer(target: StoryEditorTarget, source = storyExplorerSourceValue(this.explorerState.source)): boolean {
    const normalizedSource = parseStoryExplorerSource(source);
    if (!normalizedSource) return false;
    const projection = this.syncStoryExplorerSource(normalizedSource);
    if (this.isOpen()) {
      if (!this.canOpenFromExplorer(target, projection)) return false;
      this.openBrowseTarget(target, false, source);
      return this.state.target?.kind === target.kind && this.state.target.id === target.id;
    }
    if (!projection.available || !this.canOpenFromExplorer(target, projection)) return false;
    const previousActiveId = this.browseInstances.activeId;
    let previousState: ReturnType<typeof captureStoryInstanceState>;
    try { previousState = captureStoryInstanceState(this.state); }
    catch { return false; }
    const seed = this.storyBrowseSeed(target, source, projection);
    const existing = this.browseInstances.findReusable(storyWorkType, seed.reuseKey) as StoryBrowseInstance | undefined;
    let existingState: StoryBrowseInstanceState | undefined;
    try { existingState = existing && captureStoryBrowseInstanceState(existing.state); }
    catch { return false; }
    const opened = this.browseInstances.openOrReuse(seed, candidate =>
      candidate.providerKey === storyWorkType && this.restoreBrowseInstance(candidate as StoryBrowseInstance, false, false)
        ? { ok: true, value: undefined }
        : { ok: false, message: 'The Story resource could not be prepared.' });
    if (!opened.ok) return false;
    this.ctrl.panelState.storyEditor = this.state;
    if (!this.ctrl.enterEditorRoute('story-editor', true)) {
      if (previousActiveId) this.browseInstances.activate(previousActiveId);
      if (existing && existingState) this.browseInstances.update(existing.id, {
        resourceKey: existing.resourceKey, reuseKey: existing.reuseKey, presentation: existing.presentation, state: existingState,
      });
      else if (!existing) this.browseInstances.close(opened.value.id);
      restoreStoryInstanceState(this.state, previousState);
      return false;
    }
    this.ctrl.render();
    return true;
  }
  openResourceRequest(request: EditorResourceOpenRequest): boolean {
    if (request.resource.providerKey !== storyWorkType
      || request.resource.kind !== 'story' && request.resource.kind !== 'entry'
      || !request.resource.id) return false;
    const target = { kind: request.resource.kind, id: request.resource.id } as StoryEditorTarget;
    const source = request.sourceKey ?? storyExplorerSourceValue(this.explorerState.source);
    const normalized = parseStoryExplorerSource(source);
    if (!normalized) return false;
    const projection = this.syncStoryExplorerSource(normalized);
    const expected = this.storyBrowseSeed(target, source, projection).resourceKey;
    if (expected !== request.resource.resourceKey) return false;
    return this.openFromExplorer(target, source);
  }
  duplicateActiveResource(): boolean {
    if (!this.isOpen() || !this.state.target) return false;
    const previousId = this.browseInstances.activeId;
    this.openBrowseTarget(this.state.target, true);
    const duplicated = Boolean(this.browseInstances.activeId && this.browseInstances.activeId !== previousId);
    if (duplicated) this.requestRefresh();
    return duplicated;
  }
  locateActiveResource(): boolean {
    const target = this.state.target;
    if (!this.isOpen() || !target) return false;
    this.ctrl.setActiveEditorExplorer('story');
    this.revealWorkspaceLeft();
    this.explorerState.auxiliaryTool = undefined;
    this.explorerState.source = parseStoryExplorerSource(this.state.sourceSelection ?? '') ?? { kind: 'runtime' };
    this.syncStoryExplorerSource();
    this.revealExplorerTarget(target);
    this.requestRefresh();
    this.ctrl.flushUIUpdates();
    return true;
  }
  openStoryKeyFromExplorer(key: string, source = storyExplorerSourceValue(this.explorerState.source)): boolean {
    const id = this.state.drafts.find(draft => draft.draftId === key)?.document.id
      ?? (key.startsWith('source:') ? key.slice('source:'.length) : undefined);
    return id ? this.openFromExplorer({ kind: 'story', id }, source) : false;
  }
  navigateToTarget(target: StoryEditorTarget, source = this.state.sourceSelection ?? ''): boolean {
    if (this.isOpen()) {
      if (!this.canNavigateToTarget(target, source)) return false;
      this.openBrowseTarget(target, false, source);
    } else if (!this.openFromExplorer(target, source)) return false;
    const opened = this.state.target?.kind === target.kind && this.state.target.id === target.id;
    if (opened && this.isOpen()) {
      this.ctrl.setActiveEditorExplorer('story');
      this.requestBrowseDirectoryReveal();
      this.requestRefresh();
      this.ctrl.flushUIUpdates();
    }
    return opened;
  }
  private storyBrowseSeed(target: StoryEditorTarget, source: string,
    projection = this.syncStoryExplorerSource(parseStoryExplorerSource(source) ?? this.explorerState.source)): ReturnType<typeof createStoryTargetBrowseSeed> {
    const drafts = projection.drafts;
    const registry = projection.sourceRegistry ?? this.ctrl.game.registry;
    const draft = target.kind === 'story'
      ? drafts.find(item => !item.entryOnly && item.document.id === target.id)
      : drafts.find(item => item.entryOnly === target.id
        || [...(item.authoring?.activeStories ?? []), ...(item.authoring?.passiveStories ?? [])].some(entry => entry.id === target.id));
    const owner = registry.storyDirectoryContentOwner(target.id, target.kind) ?? target.id.split(':')[0];
    const runningPackId = !source ? this.packQuery.getRunningStoryPackId?.(owner) : undefined;
    const recoveryDraftId = source.startsWith('draft:') ? source.slice(6) : undefined;
    const packId = source.startsWith('pack:') ? source.slice(5) : draft?.packSource?.packRecordId ?? runningPackId;
    const identity = storyBrowseIdentity(target, source, packId);
    const name = target.kind === 'story'
      ? draft?.document.name ?? registry.stories.get(target.id)?.name ?? target.id
      : target.id;
    return createStoryTargetBrowseSeed(this.state, source, target, identity,
      { name, packId, draftId: recoveryDraftId ?? draft?.draftId });
  }
  private browseTarget(target: StoryEditorTarget, historyIndex?: number): void {
    if (!this.hasTarget(target)) return;
    if (historyIndex === undefined && this.state.target?.kind === target.kind && this.state.target.id === target.id) return;
    if (!this.save(false, false)) return;
    this.selectBrowseTarget(target, historyIndex);
  }
  private selectBrowseTarget(target: StoryEditorTarget, historyIndex?: number): void {
    const keepFlagInspector = this.state.storyInspectorTab === 'flags' && (this.state.inspectorView === 'story' || !currentNode(this.state));
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
    this.closeAuthoringPreview(); this.previewReturnScroll = undefined; this.closeThemeContentEdit();
    if (target.kind === 'story') {
      if (!this.selectDocument(this.storyKey(target.id)!)) return;
      this.state.targetPackId = currentDraft(this.state)?.targetPackId ?? this.state.targetPackId;
    } else {
      const entry = storyEntries(this.state, this.registry.storyEntries).get(target.id);
      if (entry && !this.selectEntryDocument(entry)) return;
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
    if (!this.advanced) this.explorerState.auxiliaryTool = undefined;
    if (keepFlagInspector && target.kind === 'story') this.restoreInspectorScroll();
    this.browseStateOwner.state.unavailable = false;
    this.state.notice = null;
    this.syncBrowseInstanceIdentity();
  }
  private browseHistory(direction: -1 | 1): void {
    for (let index = this.state.visitIndex + direction; index >= 0 && index < this.state.visits.length; index += direction) {
      const target = this.state.visits[index].target;
      if (this.hasTarget(target)) { this.browseTarget(target, index); return; }
    }
  }

  prepareManagedBrowseActivation(instance: import('../workspace/browse-instance-manager').BrowseInstance<EditorBrowseInstanceState>): (() => void) | undefined {
    if (instance.providerKey !== storyWorkType) return undefined;
    let previous: ReturnType<typeof captureStoryInstanceState>;
    let candidate: ReturnType<typeof captureStoryBrowseInstanceState>;
    try {
      previous = captureStoryInstanceState(this.state);
      candidate = captureStoryBrowseInstanceState((instance as StoryBrowseInstance).state);
    } catch { return undefined; }
    if (!this.restoreBrowseInstance(instance as StoryBrowseInstance, false, true)) return undefined;
    return () => {
      restoreStoryInstanceState(this.state, previous);
      restoreStoryBrowseInstanceState((instance as StoryBrowseInstance).state, candidate);
      try { this.syncSource(true); } catch { /* Keep the pre-activation Story state available. */ }
      this.requestRefresh();
    };
  }
  isOpen(): boolean {
    return !this.disposed && this.ctrl.workbench.isOpen && this.browseInstances.active?.providerKey === storyWorkType;
  }
  dispose(): void {
    this.unbindWorkspace();
    this.inlineText.dispose();
    this.requiredFlagDropdown.dispose();
    this.nodeMenu.close(); this.closeSelectionNavi();
    this.closeEditorDialog();
    this.closeAuthoringPreview();
    this.closeThemeContentEdit();
    this.save(false, false);
    this.disposed = true;
  }
  refreshInstance(instanceId: string): boolean {
    if (!this.isOpen() || !instanceId.startsWith('editor-workbench/')) return false;
    this.requestRefresh();
    return true;
  }
  open(): void {
    if (this.disposed) return;
    if (this.isOpen()) return;
    const enteringWorkbench = !this.ctrl.workbench.isOpen;
    if (!this.loaded) { this.persistence.load(this.state); this.loaded = true; }
    const previousActive = this.browseInstances.active;
    const rememberedStory = this.browseInstances.lastActive(storyWorkType);
    if (!rememberedStory) {
      const opened = this.browseInstances.createPrepared(() => ({ ok: true, value: createStoryBrowseInstanceSeed() }), true,
        () => this.ctrl.enterEditorRoute('story-editor')
          ? { ok: true, value: undefined }
          : { ok: false, message: 'The current editor refused to enter the Story workspace.' });
      if (!opened.ok) return;
    } else {
      if (rememberedStory.id !== previousActive?.id) {
        const activated = this.browseInstances.activate(rememberedStory.id, candidate => {
          if (candidate.providerKey !== storyWorkType) return { ok: false, message: 'The remembered instance is not a Story instance.' };
          return this.restoreBrowseInstance(candidate as StoryBrowseInstance, false, true)
            ? { ok: true, value: undefined }
            : { ok: false, message: 'The remembered Story session could not be restored.' };
        });
        if (!activated.ok) return;
      }
      if (!this.ctrl.enterEditorRoute('story-editor')) {
        if (previousActive) this.browseInstances.activate(previousActive.id);
        return;
      }
    }
    this.ctrl.panelState.storyEditor = this.state;
    this.syncSource(true);
    this.syncStoryExplorerSource();
    if (enteringWorkbench) this.ctrl.workbench.activeExplorerType = 'story';
    this.ctrl.render();
  }
  save(manual = false, refresh = true): boolean {
    this.inlineText.finish();
    if (!this.loaded) return true;
    const draft = currentAuthoringDraft(this.state);
    if (manual && draft && !this.draftSaveAllowed(draft)) {
      this.persist();
      this.state.error = this.state.error ?? this.state.readOnlyReason ?? '当前内容无法保存，请打开对应编辑态 Mod。';
      if (refresh && this.isOpen()) this.requestRefresh();
      return false;
    }
    if (manual && draft && !draft.persisted) draft.dirty = true;
    const saved = this.persist();
    if (refresh && this.isOpen()) this.requestRefresh();
    return saved;
  }
  saveToRuntime(): boolean {
    const draft = currentDraft(this.state);
    if (!draft || this.writeBlocked) return false;
    if (draft.renamedFromId && draft.renamedFromId !== draft.document.id && this.registry.stories.has(draft.renamedFromId)) {
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
    const result = draft.targetPackId
      ? this.ctrl.commands.saveStoryDefinition(compiled.story, draft.targetPackId)
      : this.ctrl.commands.saveStoryDefinition(compiled.story);
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
    if (saved) {
      this.closeAuthoringPreview(); this.previewReturnScroll = undefined;
      this.nodeMenu.close(); this.closeSelectionNavi(); this.closeEditorDialog(); this.requiredFlagDropdown.close(); this.closeThemeContentEdit();
      this.rememberBrowseInstance();
    }
    if (!saved) this.requestRefresh();
    return saved;
  }
  preferAdvancedWorkspace(): void {
    editorLayout.setMode('advanced');
  }

  close(): void {
    if (this.isOpen()) this.ctrl.closeEditorWorkspace();
  }
  requestRefresh(): void {
    if (this.isOpen()) this.ctrl.requestUIUpdate({ type: 'region', hostId: STORY_EDITOR_REGION, reason: 'story-editor-change' });
  }

  private rememberBrowseInstance(): void {
    const active = this.activeBrowseInstance;
    const { state } = this;
    if (active.state.unavailable && !state.target) return;
    this.rememberVisit();
    this.rememberInspectorScroll();
    active.state.snapshot = captureStoryInstanceState(state);
    active.state.scroll = this.captureInstanceScroll();
    const draft = currentAuthoringDraft(state);
    active.state.document = state.target ? {
      target: { ...state.target }, name: storyEditorDocumentName(createUIContext(this.editorGame), state) ?? state.target.id,
      packId: draft?.packSource?.packRecordId, draftId: draft?.draftId,
    } : undefined;
    active.state.unavailable = false;
    if (state.target) this.syncBrowseInstanceIdentity();
  }

  private syncBrowseInstanceIdentity(): void {
    const instance = this.browseStateOwner;
    if (!this.browseInstances.get(instance.id)) return;
    const target = this.state.target;
    if (!target) return;
    const draft = currentAuthoringDraft(this.state);
    const source = this.state.sourceSelection ?? '';
    const owner = this.ctrl.game.registry.storyDirectoryContentOwner(target.id, target.kind) ?? target.id.split(':')[0];
    const packId = source.startsWith('pack:') ? source.slice(5)
      : draft?.packSource?.packRecordId ?? this.packQuery.getRunningStoryPackId?.(owner);
    const identity = storyBrowseIdentity(target, source, packId);
    const name = target.kind === 'story' ? draft?.document.name ?? this.registry.stories.get(target.id)?.name ?? target.id : target.id;
    const current = this.browseInstances.get(instance.id);
    if (current?.resourceKey === identity.resourceKey && current.reuseKey === identity.reuseKey
      && current.presentation.title === name && current.presentation.kind === target.kind) return;
    const updated = this.browseInstances.update(instance.id, {
      ...identity,
      presentation: storyBrowseInstancePresentation(name, target),
    });
    if (!updated.ok) throw new Error(updated.message);
  }

  private activateBrowseInstance(next: StoryBrowseInstance): void {
    if (this.activeBrowseInstance.id === next.id && !next.state.unavailable) return;
    if (this.activeBrowseInstance.id === next.id) {
      if (!this.save(false, false)) return;
      this.restoreBrowseInstance(next, false, true);
      return;
    }
    this.browseInstances.activate(next.id, target => {
      if (!this.save(false, false)) return { ok: false, message: 'The current Story session refused to leave.' };
      if (target.providerKey !== storyWorkType) return { ok: false, message: 'The target is not a Story browse instance.' };
      return this.restoreBrowseInstance(target as StoryBrowseInstance, false, true)
        ? { ok: true, value: undefined }
        : { ok: false, message: 'The target Story session could not be restored.' };
    });
  }

  activateManagedBrowseInstance(id: string): boolean {
    const instance = this.browseInstances.get(id as BrowseInstanceId);
    if (instance?.providerKey !== storyWorkType) return false;
    this.activateBrowseInstance(instance as StoryBrowseInstance);
    const activated = this.browseInstances.activeId === instance.id;
    if (activated) this.requestRefresh();
    return activated;
  }

  private restoreBrowseInstance(next: StoryBrowseInstance, commitActive = true, allowUnavailable = true): boolean {
    if (this.state.preview) return false;
    let previous: ReturnType<typeof captureStoryInstanceState>;
    let nextPrevious: ReturnType<typeof captureStoryBrowseInstanceState>;
    try { previous = captureStoryInstanceState(this.state); }
    catch { return false; }
    try { nextPrevious = captureStoryBrowseInstanceState(next.state); }
    catch { return false; }
    try {
      if (this.browseInstances.active?.providerKey === storyWorkType) this.rememberBrowseInstance();
      this.activatingBrowseInstance = next;
      this.nodeMenu.close();
      this.closeSelectionNavi();
      this.closeEditorDialog();
      this.requiredFlagDropdown.close();
      this.closeThemeContentEdit();
      this.pendingVisit = undefined;
      this.pendingEntryScroll = undefined;
      this.pendingInspectorScroll = undefined;
      this.explorer.takeFocusRequest('story');
      this.pendingFlagReveal = undefined;
      this.revealNodeId = null;
      this.pendingFocus = undefined;
      this.focusName = false;
      const { state } = this;
      const previousSource = state.sourceSelection;
      const snapshot = next.state.snapshot;
      restoreStoryInstanceState(state, snapshot);
      state.target = null;
      state.entryPoolContext = undefined;
      this.syncSource(state.sourceSelection !== previousSource);

      const document = next.state.document;
      if (document) {
        const cached = [...state.drafts, ...(state.parkedDrafts ?? [])].find(draft => draft.draftId === document.draftId);
        const target = cached && document.target.kind === 'story' ? { kind: 'story' as const, id: cached.document.id } : document.target;
        const owner = this.registry.storyDirectoryContentOwner(target.id, target.kind) ?? target.id.split(':')[0];
        if (cached && state.parkedDrafts?.includes(cached)) {
          state.sourceSelection = `draft:${cached.draftId}`;
          state.targetPackId = undefined;
          this.syncSource(true);
        }
        const sourceScopeAvailable = state.sourceSelection === snapshot.sourceSelection
          && (snapshot.sourceSelection?.startsWith('pack:')
            ? !document.packId || snapshot.sourceSelection.slice(5) === document.packId
            : !document.packId || this.packQuery.getRunningStoryPackId?.(owner) === document.packId);
        const available = sourceScopeAvailable
          || Boolean(cached && state.sourceSelection === `draft:${cached.draftId}` && state.drafts.includes(cached));
        if (available && this.hasTarget(target)) {
          if (target.kind === 'story') {
            const key = this.storyKey(target.id);
            if (!key || !this.selectDocument(key)) throw new Error('The Story target could not be restored.');
          } else {
            const entry = storyEntries(state, this.registry.storyEntries).get(target.id);
            if (entry && !this.selectEntryDocument(entry)) throw new Error('The Entry target could not be restored.');
            state.target = target;
          }
        }
        next.state.unavailable = !state.target;
        if (next.state.unavailable) {
          if (!allowUnavailable) throw new Error('The requested Story resource is unavailable.');
          state.notice = '此实例的内容或来源不可用。载入原资料后可再次选择该实例。';
        } else {
          state.visits = captureStoryInstanceState(snapshot).visits;
          state.visitIndex = snapshot.visitIndex;
          if (target.id !== document.target.id) {
            state.visits = state.visits.map(visit => visit.target.kind === document.target.kind && visit.target.id === document.target.id
              ? { ...visit, target } : visit);
            document.target = target;
          }
          const nodes = currentDraft(state)?.document.nodes ?? [];
          state.selectedNodeId = nodes.some(node => node.id === snapshot.selectedNodeId) ? snapshot.selectedNodeId : null;
          state.insertionBeforeNodeId = nodes.some(node => node.id === snapshot.insertionBeforeNodeId) ? snapshot.insertionBeforeNodeId : null;
          this.syncSource();
        }
      }
      this.restoreInstanceScroll = { ...next.state.scroll };
      if (state.target && this.browseInstances.get(next.id)) this.syncBrowseInstanceIdentity();
      if (commitActive) {
        const committed = this.browseInstances.activate(next.id);
        if (!committed.ok) throw new Error(committed.message);
      }
      return true;
    } catch {
      this.activatingBrowseInstance = undefined;
      restoreStoryInstanceState(this.state, previous);
      restoreStoryBrowseInstanceState(next.state, nextPrevious);
      try { this.syncSource(true); } catch { /* Keep the prior usable session if source refresh also fails. */ }
      this.requestRefresh();
      return false;
    } finally {
      this.activatingBrowseInstance = undefined;
    }
  }

  private requestBrowseDirectoryReveal(): void {
    if (!this.state.target) return;
    this.explorerState.auxiliaryTool = undefined;
    this.explorerState.source = parseStoryExplorerSource(this.state.sourceSelection ?? '') ?? { kind: 'runtime' };
    this.syncStoryExplorerSource();
    this.revealExplorerTarget(this.state.target);
  }

  private openBrowseTarget(target: StoryEditorTarget, duplicate = false, source = this.state.sourceSelection ?? ''): void {
    if (!this.advanced) {
      this.browseTarget(target);
      return;
    }
    const sameSource = source === (this.state.sourceSelection ?? '');
    if (sameSource && !this.hasTarget(target)) return;
    if (!sameSource && source.startsWith('pack:') && !this.packSource(source.slice(5))) return;
    const current = this.activeBrowseInstance;
    if (!duplicate && sameSource && this.state.target?.kind === target.kind && this.state.target.id === target.id) return;
    const seed = this.storyBrowseSeed(target, source);
    const reusableRecord = duplicate ? undefined : this.browseInstances.findReusable(storyWorkType, seed.reuseKey);
    const reusable = reusableRecord?.providerKey === storyWorkType ? reusableRecord as StoryBrowseInstance : undefined;
    if (!duplicate && reusable && reusable.id !== current.id) {
      this.browseInstances.openOrReuse(seed, candidate => {
        if (!this.save(false, false)) return { ok: false, message: 'The current Story session refused to leave.' };
        if (candidate.providerKey !== storyWorkType) return { ok: false, message: 'The target is not a Story browse instance.' };
        return this.restoreBrowseInstance(candidate as StoryBrowseInstance, false, false)
          ? { ok: true, value: undefined }
          : { ok: false, message: 'The requested Story target could not be restored.' };
      });
      return;
    }
    if (!duplicate && !this.state.target && sameSource && !reusable) {
      this.browseTarget(target);
      return;
    }
    const replaceEmpty = !this.state.target && !current.state.document;
    const prepareActivation = (candidate: import('../workspace/browse-instance-manager').BrowseInstance<EditorBrowseInstanceState>) => {
      if (!this.save(false, false)) return { ok: false as const, message: 'The current Story session refused to leave.' };
      if (candidate.providerKey !== storyWorkType) return { ok: false as const, message: 'The target is not a Story browse instance.' };
      return this.restoreBrowseInstance(candidate as StoryBrowseInstance, false, false)
        ? { ok: true as const, value: undefined }
        : { ok: false as const, message: 'The requested Story target could not be restored.' };
    };
    const opened = duplicate
      ? this.browseInstances.duplicate(current.id, () => ({ ok: true, value: seed }), prepareActivation)
      : this.browseInstances.openOrReuse(seed, prepareActivation);
    if (!opened.ok) return;
    const openedStory = opened.value as StoryBrowseInstance;
    if (openedStory.id === current.id
      && (this.state.target?.kind !== target.kind || this.state.target.id !== target.id)) {
      if (!this.save(false, false) || !this.restoreBrowseInstance(openedStory, false, false)) return;
      this.browseInstances.activate(openedStory.id);
    }
    if (replaceEmpty && openedStory.id !== current.id) this.browseInstances.close(current.id);
  }

  private closeBrowseInstance(instance: StoryBrowseInstance): void {
    const result = this.browseInstances.close(instance.id, (closing, successor) => {
      if (closing.id !== this.browseInstances.activeId) return { ok: true, value: undefined };
      if (!successor) {
        if (!this.save(false, false)) return { ok: false, message: 'The current Story session refused to close.' };
        this.state.target = null;
        this.state.visits = [];
        this.state.selectedNodeId = null;
        this.state.insertionBeforeNodeId = null;
        return { ok: true, value: undefined };
      }
      if (successor.providerKey === 'world') {
        if (!this.save(false, false)) return { ok: false, message: 'The current Story session refused to leave.' };
        return this.ctrl.enterEditorRoute('world-editor')
          ? { ok: true, value: undefined }
          : { ok: false, message: 'The World editor route could not be activated.' };
      }
      if (successor.providerKey === storyDirectoryBrowseProviderKey) {
        if (!this.save(false, false)) return { ok: false, message: 'The current Story session refused to leave.' };
        return { ok: true, value: undefined };
      }
      if (!this.save(false, false)) return { ok: false, message: 'The current Story session refused to leave.' };
      if (successor.providerKey !== storyWorkType) return { ok: false, message: 'The successor is not a Story browse instance.' };
      return this.restoreBrowseInstance(successor as StoryBrowseInstance, false, true)
        ? { ok: true, value: undefined }
        : { ok: false, message: 'The successor Story session could not be restored.' };
    });
    if (result.ok) {
      this.ctrl.render();
    }
  }

  closeManagedBrowseInstance(id: string): boolean {
    const browseId = id as BrowseInstanceId;
    const instance = this.browseInstances.get(browseId);
    if (instance?.providerKey !== storyWorkType) return false;
    this.closeBrowseInstance(instance as StoryBrowseInstance);
    return !this.browseInstances.get(browseId);
  }

  private setWorkspaceView(view: EditorWorkspaceView): void {
    const shell = this.ctrl.root.querySelector<HTMLElement>('[data-editor-workspace]');
    if (shell) setEditorWorkspaceView(shell, storyEditorEdges, view, this.workspaceViewBinding());
    else editorLayout.setView(view);
  }

  workspaceViewBinding() {
    return {
      onBeforeViewChange: (from: EditorWorkspaceView) => {
        this.activeBrowseInstance.state.scroll = this.captureInstanceScroll();
        if (from !== 'focus') {
          const left = this.editorScrollHost('left');
          if (left) this.explorer.setScrollTop('story', this.sidebarScrollKey, left.scrollTop);
        }
      },
      onViewChange: (view: EditorWorkspaceView) => {
        if (view !== 'focus') this.setEditorScroll('left', this.explorer.scrollTop('story', this.sidebarScrollKey));
        if (view === 'three') this.setEditorScroll('right', this.activeBrowseInstance.state.scroll.right ?? 0);
      },
    };
  }

  onWorkbenchModeChange(): void {
    this.focusWorkspaceMode = true;
    this.requestRefresh();
  }

  private revealWorkspaceLeft(): void {
    if (editorLayout.state.view === 'focus') this.setWorkspaceView('browse');
  }

  private bindWorkspace(): () => void {
    const root = this.ctrl.root;
    const abort = new AbortController();
    const options = { signal: abort.signal };
    const owner = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const shell = event.target.closest<HTMLElement>('[data-editor-workspace]');
      return this.isOpen() ? shell : undefined;
    };
    root.addEventListener('click', event => {
      const shell = owner(event);
      const element = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button[data-editor-workspace-action], [data-editor-workspace-header] button[data-editor-action], [data-editor-workspace-header] button[data-authoring-action]') : null;
      if (!shell || !element || element.disabled) return;
      const intent = element.dataset.editorWorkspaceAction;
      const action = element.dataset.editorAction;
      if (intent === 'mode' || intent === 'back') return;
      if (this.state.preview) {
        if (element.dataset.authoringAction === 'restart-preview' || element.dataset.authoringAction === 'close-preview') this.authoringClick(element);
      } else if (editorLayout.state.mode === 'advanced') {
        if (intent === 'open') {
          this.revealWorkspaceLeft();
          this.explorerState.auxiliaryTool = undefined;
          this.explorerState.filtersOpen = true;
          this.explorer.requestFocus('story', `search:${this.queryChannel()}`);
        } else if (intent === 'issue') {
          const draft = currentDraft(this.state);
          const issue = draft?.editorIssues?.find(item => item.nodeId);
          if (draft && issue) {
            this.setWorkspaceView('three');
            this.locateIssue(draft, issue.path);
            this.revealNodeId = this.state.selectedNodeId;
          }
        } else if (action === 'open-pack-manager') {
          if (this.beforeLeave()) { this.ctrl.navigateToService('datapack'); this.ctrl.render(); }
          return;
        } else if (action) this.action(action, element);
        else if (element.dataset.authoringAction) this.authoringClick(element);
      }
      this.requestRefresh();
    }, options);
    root.addEventListener('change', event => {
      const field = event.target;
      if (!owner(event) || !(field instanceof HTMLSelectElement) || !field.closest('[data-editor-workspace-header]')) return;
      if (field.hasAttribute('data-editor-workspace-view-select')) return;
      if (field.hasAttribute('data-authoring-preview-entry')) {
        const draft = currentDraft(this.state);
        if (draft) (this.state.previewEntryByDraft ??= new Map()).set(draft.draftId, field.value);
      }
      this.requestRefresh();
    }, options);
    return () => abort.abort();
  }

  private get sidebarScrollKey() { return this.explorerState.auxiliaryTool === 'senders' ? 'senders' : 'stories'; }

  private preserveSidebarModeScroll(update: () => void): void {
    const previous = this.editorScrollHost('left');
    const previousKey = previous?.dataset.scrollKey;
    if (previousKey && this.editorPanelVisible('left')) this.explorer.setScrollTop('story', previousKey, previous.scrollTop);
    update();
    const current = this.editorScrollHost('left');
    const currentKey = current?.dataset.scrollKey;
    if (currentKey && currentKey !== previousKey) this.setEditorScroll('left', this.explorer.scrollTop('story', currentKey));
  }

  private refreshSidebar(updateHeader = false): void {
    const body = this.ctrl.root.querySelector<HTMLElement>('.story-editor-left .workspace-column__body');
    if (!body) return;
    const column = this.createExplorerColumn(createUIContext(this.ctrl.game), this.explorerSnapshot);
    const next = body.cloneNode(false) as HTMLElement;
    next.innerHTML = column.content;
    const beforeRemove = (removed: HTMLElement) => this.ctrl.popovers.dismissBeforeRootMutation(removed);
    this.preserveSidebarModeScroll(() => patchEditorDOM(body, next, beforeRemove));
    refreshEditorDirectoryScrollbars(body);
    if (!updateHeader) return;
    const header = body.closest('.workspace-column__slot')?.querySelector<HTMLElement>('.workspace-column__header');
    if (!header) return;
    const nextHeader = header.cloneNode(false) as HTMLElement;
    nextHeader.innerHTML = column.header ?? '';
    patchEditorDOM(header, nextHeader, beforeRemove);
  }

  private revealSidebarSelection(): void {
    const list = this.editorScrollHost('left');
    if (!list || this.explorerState.auxiliaryTool === 'senders') return;
    const column = list.closest<HTMLElement>('.story-editor-left') ?? list;
    const row = [...list.querySelectorAll<HTMLElement>('[data-editor-resource-provider][data-editor-resource-key][data-editor-placement-select][aria-pressed="true"]')]
      .find(item => !item.closest('ul[hidden]'));
    const key = row?.dataset.editorPlacementKey;
    if (key) this.explorer.revealPlacement(column, 'story', key,
      sidebarSearch(this.explorerState, this.explorerSnapshot).trim() ? 'search' : 'normal');
  }

  refresh(ctx: UIContext): boolean {
    if (!this.isOpen()) return false;
    const shell = this.ctrl.root.querySelector<HTMLElement>('[data-editor-workspace]');
    const host = shell?.querySelector<HTMLElement>('[data-editor-workspace-frame-host]');
    if (!shell || !host) return false;
    this.syncSource();
    this.syncStoryExplorerSource();
    if (this.state.target) this.activeBrowseInstance.state.unavailable = false;
    const draft = currentDraft(this.state);
    if (draft) hydrateStoryAuthoring(draft, this.registry);
    const projection = this.ctrl.createEditorWorkbenchProjection(ctx);
    const chrome = projection.chrome;
    const attributes = editorWorkspaceViewAttributes(chrome);
    const layoutChanged = Object.entries(attributes).some(([key, value]) => shell.getAttribute(key) !== value);
    const layoutScroll = layoutChanged && !chrome.temporaryView && shell.dataset.editorWorkspaceTemporary === 'false'
      ? this.captureEditorScroll() : undefined;
    const frame = projection.frame;
    const template = document.createElement('template');
    template.innerHTML = renderWorkspaceFrame(ctx, frame);
    const current = host.querySelector<HTMLElement>(':scope > [data-workspace-frame="editor-workbench"]');
    const next = template.content.firstElementChild as HTMLElement;
    const stream = current?.querySelector<HTMLElement>('[data-preview-stream]');
    const followPreview = !stream || stream.scrollHeight - stream.clientHeight - stream.scrollTop <= 8;
    this.inlineText.prepare(next);
    this.prepareReferenceControls(next);
    if (!current) {
      this.ctrl.columns.mount(host, ctx, frame);
    } else {
      const oldBinding = current.querySelector<HTMLElement>('.story-editor-center')?.dataset.columnBinding;
      const active = document.activeElement instanceof HTMLElement && current.contains(document.activeElement) ? document.activeElement : null;
      const nextColumns = [...next.querySelectorAll<HTMLElement>(':scope > [data-column-instance]')];
      const nextIds = new Set(nextColumns.map(column => column.dataset.columnInstance));
      this.preserveSidebarModeScroll(() => {
        for (const oldColumn of [...current.querySelectorAll<HTMLElement>(':scope > [data-column-instance]')]) {
          if (!nextIds.has(oldColumn.dataset.columnInstance)) {
            this.nodeMenu.dismissBeforeMutation(oldColumn);
            this.ctrl.popovers.dismissBeforeRootMutation(oldColumn);
            oldColumn.remove();
          }
        }
        for (const nextColumn of nextColumns) {
          const id = nextColumn.dataset.columnInstance!;
          const matches = [...current.querySelectorAll<HTMLElement>(':scope > [data-column-instance]')].filter(column => column.dataset.columnInstance === id);
          const mounted = matches.find(column => this.ctrl.columns.node(id) === column) ?? matches[0];
          for (const duplicate of matches) if (duplicate !== mounted) duplicate.remove();
          if (mounted && mounted.outerHTML !== nextColumn.outerHTML) patchEditorDOM(mounted, nextColumn, root => {
            this.nodeMenu.dismissBeforeMutation(root);
            this.ctrl.popovers.dismissBeforeRootMutation(root);
          });
          else current.append(nextColumn);
        }
        current.className = next.className;
        current.dataset.layout = next.dataset.layout ?? '';
        current.dataset.responsive = next.dataset.responsive ?? '';
        current.dataset.composition = next.dataset.composition ?? '';
        current.style.gridTemplateColumns = next.style.gridTemplateColumns;
      });
      this.nodeMenu.retainIfAnchored();
      this.ctrl.columns.adopt(host, ctx, frame);
      if (oldBinding !== current.querySelector<HTMLElement>('.story-editor-center')?.dataset.columnBinding) {
        this.setEditorScroll('center', 0);
        this.setEditorScroll('right', 0);
      }
      if (active?.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
    }
    for (const [key, value] of Object.entries(attributes)) if (shell.getAttribute(key) !== value) shell.setAttribute(key, value);
    applyEditorWorkspaceWidths(shell, chrome.layout, chrome.viewOverride);
    const chromeFocus = document.activeElement instanceof HTMLElement && !host.contains(document.activeElement)
      && shell.contains(document.activeElement) ? document.activeElement : null;
    const regions = renderEditorWorkspaceRegions(ctx, chrome);
    for (const [name, markup] of Object.entries(regions)) {
      const region = shell.querySelector<HTMLElement>(`[data-editor-workspace-${name}]`);
      if (!region) return false;
      template.innerHTML = markup;
      patchEditorDOM(region, template.content.firstElementChild as HTMLElement, removed => this.ctrl.popovers.dismissBeforeRootMutation(removed));
    }
    if (chromeFocus?.isConnected && document.activeElement !== chromeFocus) chromeFocus.focus({ preventScroll: true });
    if (this.focusWorkspaceMode) {
      this.focusWorkspaceMode = false;
      shell.querySelector<HTMLElement>('[data-editor-workspace-action="mode"]')?.focus({ preventScroll: true });
    }
    if (layoutScroll) {
      if (this.restoreInstanceScroll) this.setEditorScroll('left', layoutScroll.left ?? 0);
      else this.restoreEditorScroll(layoutScroll);
    }
    for (const select of shell.querySelectorAll<HTMLSelectElement>('[data-authoring-preview-entry], [data-entry-replay-policy]')) {
      const selected = select.querySelector<HTMLOptionElement>('option[selected]');
      if (selected && select.value !== selected.value) select.value = selected.value;
    }
    if (this.state.preview && followPreview) {
      const body = this.ctrl.root.querySelector<HTMLElement>('[data-preview-stream]');
      if (body) body.scrollTop = body.scrollHeight;
    }
    if (!this.state.preview && this.previewReturnScroll) {
      for (const panel of ['left', 'center', 'right'] as const) {
        this.setEditorScroll(panel, this.previewReturnScroll[panel]);
      }
      const launchKey = this.previewReturnScroll.launchKey;
      this.previewReturnScroll = undefined;
      const controls = [...this.ctrl.root.querySelectorAll<HTMLElement>('[data-authoring-action="preview"]:not([disabled])')];
      (controls.find(control => control.dataset.editorKey === launchKey) ?? controls[0])?.focus({ preventScroll: true });
    }
    if (this.pendingVisit) {
      for (const panel of ['center', 'right'] as const) {
        this.setEditorScroll(panel, this.pendingVisit[`${panel}Scroll`]);
      }
      this.pendingVisit = undefined;
    }
    const explorerFocus = this.explorerSnapshot.focusRequest;
    if (!this.state.preview && (explorerFocus === 'selected' || this.pendingDirectoryReveal)) {
      this.explorer.takeFocusRequest('story');
      this.pendingDirectoryReveal = false;
      this.revealSidebarSelection();
    }
    if (this.pendingInspectorScroll !== undefined) {
      this.setEditorScroll('right', this.pendingInspectorScroll);
      this.pendingInspectorScroll = undefined;
    }
    if (this.pendingFlagReveal) this.revealInspectorFlag();
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
    if (explorerFocus?.startsWith('search:')) {
      const channel = explorerFocus.slice('search:'.length);
      const selector = channel === 'senders' ? '[data-editor-sender-search]' : '[data-sidebar-search]';
      shell.querySelector<HTMLInputElement>(selector)?.focus({ preventScroll: true });
      this.explorer.takeFocusRequest('story');
    }
    if (this.pendingFocus !== undefined) {
      const target = this.pendingFocus;
      this.pendingFocus = undefined;
      this.focusIssueField(target);
    }
    if (this.restoreInstanceScroll) {
      this.restoreEditorScroll(this.restoreInstanceScroll);
      this.restoreInstanceScroll = undefined;
    }
    refreshEditorDirectoryScrollbars(host);
    this.requiredFlagDropdown.refresh();
    return true;
  }
  private focusIssueField(raw: string | null): void {
    if (!raw) { this.ctrl.root.querySelector<HTMLElement>('[data-story-node-type]')?.focus({ preventScroll: true }); return; }
    for (const control of this.ctrl.root.querySelectorAll<HTMLElement>('[data-story-property-path]')) {
      if (control.dataset.storyPropertyPath === raw) { control.focus({ preventScroll: true }); return; }
    }
    for (const control of this.ctrl.root.querySelectorAll<HTMLElement>('[data-choice-condition]')) {
      const path = control.dataset.choiceCondition;
      if (path && (raw === path || raw.startsWith(path.slice(0, -1) + ','))) {
        control.focus({ preventScroll: true });
        return;
      }
    }
  }
  bindExplorerColumn(root: HTMLElement): () => void {
    const abort = new AbortController();
    const options = { signal: abort.signal };
    const unbindScrollbars = bindEditorDirectoryScrollbars(root);
    const unbindInteractions = this.explorer.bindColumn(root, 'story', {
      onExpand: toggle => { if (toggle.hasAttribute('data-editor-expand-deferred')) this.refreshSidebar(); },
      onQuery: () => this.refreshSidebar(),
    });
    root.addEventListener('change', event => {
      const field = event.target;
      if (!(field instanceof HTMLSelectElement) || !root.contains(field)) return;
      if (field.hasAttribute('data-editor-story-init-filter')) {
        this.explorerState.initFilter = field.value;
      } else if (field.hasAttribute('data-editor-source') && this.advanced) {
        const source = parseStoryExplorerSource(field.value);
        if (!source) return;
        this.explorerState.source = source;
      } else return;
      this.clearExplorerReveal();
      this.explorer.clearSearchExpansions('story');
      this.syncStoryExplorerSource();
      this.refreshSidebar();
      event.stopImmediatePropagation();
    }, options);
    root.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-sidebar-action], [data-column-action^="story-editor-sidebar:"]') : null;
      if (!button || !root.contains(button)) return;
      if (button.dataset.sidebarAction === 'filters') {
        this.explorerState.filtersOpen = !this.explorerState.filtersOpen;
        this.refreshSidebar();
        event.stopImmediatePropagation();
        if (this.explorerState.filtersOpen) root.querySelector<HTMLInputElement>('[data-sidebar-search]')?.focus({ preventScroll: true });
        return;
      }
      if (button.dataset.sidebarAction === 'clear') {
        this.explorer.setQuery('story', 'stories', ''); this.explorer.setQuery('story', 'entries', ''); this.explorerState.initFilter = '';
        this.explorerState.directoryMode = 'all'; this.explorerState.auxiliaryTool = undefined;
        this.clearExplorerReveal(); this.explorer.clearSearchExpansions('story');
        this.refreshSidebar();
        event.stopImmediatePropagation();
        return;
      }
      const mode = button.dataset.columnAction?.slice('story-editor-sidebar:'.length);
      if (mode === 'all' || mode === 'stories' || mode === 'entries') {
        this.explorerState.directoryMode = mode; this.explorerState.auxiliaryTool = undefined;
        this.clearExplorerReveal(); this.explorer.clearSearchExpansions('story');
        this.refreshSidebar();
        event.stopImmediatePropagation();
      } else if (mode === 'directory' || mode === 'senders') {
        const menu = root.querySelector<HTMLElement>('#story-editor-sidebar-modes');
        menu?.hidePopover?.();
        if (menu?.contains(button)) root.querySelector<HTMLElement>('[popovertarget="story-editor-sidebar-modes"]')?.focus({ preventScroll: true });
        this.explorerState.auxiliaryTool = mode === 'senders' ? 'senders' : undefined;
        this.refreshSidebar(true);
        event.stopImmediatePropagation();
      }
    }, options);
    return () => { abort.abort(); unbindInteractions(); unbindScrollbars(); };
  }

  bind(root: HTMLElement): () => void {
    this.inlineText.prepare(root);
    this.prepareReferenceControls(root);
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
        this.nodeMenu.open(anchor,event.clientX,event.clientY,'粘贴',!this.nodeClipboard || this.writeBlocked,() => {
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
      const menu = this.ctrl.root.querySelector<HTMLDetailsElement>('.story-editor-sidebar-ops[open]');
      if (menu && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      const sidebar = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-sidebar-action]') : null;
      if (!this.advanced && sidebar && root.contains(sidebar)) {
        if (sidebar.dataset.sidebarAction === 'filters') {
          this.explorerState.filtersOpen = !this.explorerState.filtersOpen;
        } else {
          this.explorer.setQuery('story', 'stories', ''); this.explorer.setQuery('story', 'entries', ''); this.explorerState.initFilter = '';
          this.explorerState.directoryMode = 'all'; this.explorerState.auxiliaryTool = undefined;
          this.clearExplorerReveal(); this.explorer.clearSearchExpansions('story');
        }
        this.refreshSidebar();
        if (sidebar.dataset.sidebarAction === 'filters' && this.explorerState.filtersOpen) {
          root.querySelector<HTMLInputElement>('[data-sidebar-search]')?.focus({ preventScroll: true });
        }
        return;
      }
      const intent = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-action], [data-column-action], [data-authoring-action], [data-editor-directory]') : null;
      if (intent?.dataset.editorAction === 'open-pack-manager') {
        if (this.beforeLeave()) { this.ctrl.navigateToService('datapack'); this.ctrl.render(); }
        return;
      }
      if (intent?.dataset.editorAction === 'copy-recovery') { this.copyRecovery(intent); return; }
      if (intent?.dataset.editorAction === 'recover-source') {
        const source = currentAuthoringDraft(this.state)?.packSource;
        const editable = source && storyEditingMods(this.ctrl.game).some(pack => (pack.packRecordId ?? pack.id) === source.packRecordId);
        const current = editable && source ? this.packSource(source.packRecordId) : undefined;
        if (current && source?.digest && current.digest !== source.digest) {
          this.state.error = '原编辑包已有其他改动，草稿仍保留。可在包库查看新版本，或将正文另存。';
          this.requestRefresh();
        } else if (current) this.selectSource(`pack:${current.packRecordId}`);
        else if (this.beforeLeave()) { this.ctrl.navigateToService('datapack'); this.ctrl.render(); }
        return;
      }
      if (this.writeBlocked && event.target instanceof Element && event.target.closest(
        '[data-story-row-action], [data-story-init-branch], [data-story-init-condition], [data-story-init-object], [data-story-init-value], [data-story-remove-readonly], [data-story-rename-node-id], [data-story-rename-option-id], [data-story-choice-flag-unbind], [data-story-flag-import], [data-story-theme-content-open], [data-theme-content-action], [data-column-action^="story-editor-node-type:"]')) return;
      const previewControl = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-preview-confirm], [data-preview-toggle]') : null;
      if (previewControl && root.contains(previewControl)) {
        const view = this.state.preview;
        const pending = view?.decisions.pending;
        if (!view || !pending || !this.preview) return;
        if (previewControl.hasAttribute('data-preview-confirm')) {
          const id = previewControl.closest<HTMLElement>('[data-preview-check]')?.dataset.previewCheck;
          if (id === pending.id) this.updateAuthoringPreview(this.preview.decide(id, view.selections ?? {}).message);
        } else {
          view.collapsedCheck = previewControl.dataset.previewToggle === 'collapse' ? pending.id : undefined;
          this.requestRefresh();
        }
        return;
      }
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
      const flagRename = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-story-flag-rename], [data-story-flag-rename-cancel]') : null;
      if (flagRename && root.contains(flagRename)) {
        const slot = flagRename.closest<HTMLElement>('[data-story-flag-rename-slot]');
        if (slot && flagRename.hasAttribute('data-story-flag-rename-cancel')) {
          slot.querySelector('form')?.remove();
          slot.querySelector<HTMLButtonElement>('[data-story-flag-rename]')?.focus({ preventScroll: true });
        } else if (slot) this.openFlagRename(slot);
        return;
      }
      const flowFlag = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-flow-flag]') : null;
      if (flowFlag && root.contains(flowFlag)) {
        const nodeId = flowFlag.closest<HTMLElement>('[data-editor-node]')?.dataset.editorNode;
        const name = flowFlag.dataset.storyFlagName;
        if (nodeId && name && this.state.target?.kind === 'story') {
          this.rememberInspectorScroll();
          this.state.inspectorView = 'story';
          this.state.storyInspectorTab = 'flags';
          this.restoreInspectorScroll();
          this.pendingFlagReveal = { storyId: this.state.target.id, name, kind: 'local' };
          this.requestRefresh();
        }
        return;
      }
      const cardEditor = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-story-card-edit]') : null;
      if (cardEditor && root.contains(cardEditor)) {
        this.openCardGradient(cardEditor);
        return;
      }
      const storyLink = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-editor-story-target]') : null;
      if (storyLink && root.contains(storyLink)) {
        if (!storyLink.disabled) {
          const key = this.storyKey(storyLink.dataset.editorStoryTarget ?? '');
          if (key) {
            this.browseStory(key);
            const nodeId = storyLink.closest<HTMLElement>('[data-story-flag-node]')?.dataset.storyFlagNode;
            if (nodeId && this.state.target?.id === storyLink.dataset.editorStoryTarget && currentDraft(this.state)?.document.nodes.some(node => node.id === nodeId)) {
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
        if ((group === 'appearance' || group === 'performance') && draft && node && !this.writeBlocked) {
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
        if(draft&&node&&!performanceToggle.disabled&&!this.writeBlocked&&hasStoryNodeOverlay(node)) {
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
        if (!positionTool.disabled && !this.writeBlocked) this.applyPositionTool(positionTool);
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
            const group=theme?.colorGroupId?this.registry.colorGroups.get(theme.colorGroupId):undefined;
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
      const choiceCondition = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-choice-condition]') : null;
      if (choiceCondition && root.contains(choiceCondition)) {
        if (!choiceCondition.disabled) this.editChoiceCondition(choiceCondition);
        return;
      }
      const authorTarget = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-value-action], [data-authoring-add], [data-authoring-init-rewards], [data-authoring-add-condition-reward], [data-authoring-copy], [data-authoring-catalog], [data-authoring-action], [data-authoring-preview-option]') : null;
      if (authorTarget && root.contains(authorTarget)) { this.authoringClick(authorTarget); this.requestRefresh(); return; }
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-resource-provider], [data-story-insertion-before], [data-story-insertion-end], [data-editor-action], [data-editor-entry-target], [data-editor-sender], [data-column-action^="story-editor-entry-tab:"], [data-column-action^="story-editor-inspector-tab:"], [data-column-action^="story-editor-sidebar:"], [data-column-action^="story-editor-node-type:"], [data-story-row-action], [data-story-init-branch], [data-story-init-condition], [data-story-init-object], [data-story-init-value], [data-story-remove-readonly], [data-story-rename-node-id], [data-story-rename-option-id], [data-story-choice-flag-unbind]') : null;
      if (!element || !root.contains(element) || element instanceof HTMLButtonElement && element.disabled) { select(event); return; }
      if (element.hasAttribute('data-editor-resource-provider')) return;
      if (element.hasAttribute('data-story-insertion-before') || element.hasAttribute('data-story-insertion-end')) {
        const beforeNodeId = element.hasAttribute('data-story-insertion-end') ? null : element.dataset.storyInsertionBefore ?? null;
        if (setInsertionPoint(this.state, beforeNodeId)) this.requestRefresh();
        return;
      }
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
        this.state.storyInspectorTab = inspectorTab as StoryEditorState['storyInspectorTab']; this.restoreInspectorScroll();
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
      } else if (sidebarTab === 'stories' || sidebarTab === 'entries' || sidebarTab === 'all') {
        this.explorerState.directoryMode = sidebarTab; this.explorerState.auxiliaryTool = undefined;
        this.clearExplorerReveal(); this.explorer.clearSearchExpansions('story');
        this.refreshSidebar();
        return;
      } else if (sidebarTab === 'directory' || sidebarTab === 'senders') {
        const menu = root.querySelector<HTMLElement>('#story-editor-sidebar-modes');
        menu?.hidePopover?.();
        if (menu?.contains(element)) root.querySelector<HTMLElement>('[popovertarget="story-editor-sidebar-modes"]')?.focus({ preventScroll: true });
        this.explorerState.auxiliaryTool = sidebarTab === 'senders' ? 'senders' : undefined;
        this.refreshSidebar(true);
        return;
      }
      if (sender) {
        const draft = currentDraft(this.state);
        if (draft && storySenders(createUIContext(this.editorGame)).some(item => item.id === sender)) composer(this.state).sender = sender;
      } else if (element.dataset.editorEntryTarget) {
        this.browseTarget({ kind: 'entry', id: element.dataset.editorEntryTarget });
      } else if (element.hasAttribute('data-story-remove-readonly')) this.removeReadonlyProperty(element);
      else if (element.dataset.storyRowAction || element.dataset.storyConditionAdd || element.dataset.storyInitBranch || element.dataset.storyInitCondition || element.dataset.storyInitObject !== undefined || element.dataset.storyInitValue) this.propertyAction(element);
      else {
        element.closest('details.story-editor-sidebar-ops')?.removeAttribute('open');
        this.action(element.dataset.editorAction ?? '', element);
      }
      this.requestRefresh();
    };
    const input = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      if (target.hasAttribute('data-editor-source')) {
        if (!this.advanced) this.selectSource(target.value);
        return;
      }
      if (target.dataset.previewDecision !== undefined) {
        const view = this.state.preview;
        const id = target.closest<HTMLElement>('[data-preview-check]')?.dataset.previewCheck;
        if (view && id && view.decisions.pending?.id === id && ['actual', 'pass', 'fail'].includes(target.value)) {
          (view.selections ??= Object.create(null))[target.dataset.previewDecision] = target.value as StoryPreviewDecision;
        }
        return;
      }
      if (target instanceof HTMLSelectElement && target.hasAttribute('data-authoring-preview-entry')) {
        const draft = currentAuthoringDraft(this.state);
        if (draft) (this.state.previewEntryByDraft ??= new Map()).set(draft.draftId, target.value);
        this.requestRefresh();
        return;
      }
      if(target.hasAttribute('data-theme-content-path')){
        const edit=this.state.themeContentEdit;const path=this.parsePropertyPath(target.dataset.themeContentPath);if(!edit||!path)return;
        let value:unknown=target.value;
        if(target.dataset.themeContentKind==='boolean')value=target.value==='true';
        else if(target.dataset.themeContentKind==='number'&&target.value.trim()&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(target.value)&&Number.isFinite(Number(target.value)))value=Number(target.value);
        writeThemeContentValue(edit.draft,path,value);edit.error=undefined;this.requestRefresh();return;
      }
      if (this.writeBlocked) return;
      const draft = currentDraft(this.state); const node = currentNode(this.state);
      if (this.authoringInput(target, event.type)) { this.requestRefresh(); return; }
      if (draft && target.hasAttribute('data-story-body-node')) {
        const nodeId = target.dataset.storyBodyNode;
        if (nodeId && node?.id === nodeId) editStoryNodeBody(draft, nodeId, target.value);
        this.requestRefresh(); return;
      }
      const senders = storySenders(createUIContext(this.editorGame));
      if (target.hasAttribute('data-editor-composer-text')) composer(this.state).text = target.value;
      else if (target.dataset.editorField === 'name') renameStory(this.state, target.value);
      else if (draft && target.dataset.editorField === 'story-context-type' && event.type === 'change') {
        const previous = draft.document.startContext;
        draft.document = { ...draft.document, startContext: target.value === 'chara'
          ? { type: 'chara', characterId: previous?.type === 'chara' ? previous.characterId : '' }
          : { type: 'area', areaId: previous?.type === 'area' ? previous.areaId : '' } };
        draft.dirty = true;
      } else if (draft && target.dataset.editorField === 'story-init' && event.type === 'change') {
        if (target.value && !this.registry.inits.has(target.value)) return;
        if ((draft.document.initId ?? '') === target.value) return;
        const { initId, directoryId, ...document } = draft.document;
        draft.document = target.value ? { ...document, initId: target.value } : document;
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
        if (!draft || !node || !path || event.type !== 'change') return;
        if (target.value === 'string' || target.value === 'number' || target.value === 'boolean') selectLiteralKind(draft, node.id, path, target.value);
        else if (target.value) constructStructuredValue(draft, node.id, path, target.value);
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
      if (!target || !draft || this.writeBlocked || !root.contains(target) || !event.dataTransfer) { event.preventDefault(); return; }
      const nodeId = target.dataset.editorNode ?? '';
      const node = draft.document.nodes.find(node => node.id === nodeId);
      if (!node) { event.preventDefault(); return; }
      const flag = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-drop-target="story-flag-reader"]') : null;
      const flagName = flag?.dataset.storyFlagName;
      const optionId = flag?.closest<HTMLElement>('[data-story-option-id]')?.dataset.storyOptionId;
      const origin = { version: 1 as const, draftId: draft.draftId, nodeId };
      if (flagName && !hasFlowFlag(node, flagName, optionId)) { event.preventDefault(); return; }
      const item: StoryEditorDragItem = flagName
        ? { ...origin, kind: 'story-flag', flagName, optionId }
        : { ...origin, kind: 'story-node' };
      this.draggingItem = item;
      event.dataTransfer.setData(STORY_EDITOR_DRAG_TYPE, JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'copyMove';
      (flag ?? target).classList.add('is-dragging');
    };
    const dragOver = (event: DragEvent): void => {
      const flagRow = flagTableDropTarget(event.target);
      if (flagRow && root.contains(flagRow)) {
        const draft = currentDraft(this.state), item = this.draggingItem;
        if (!draft || this.state.target?.kind !== 'story' || this.writeBlocked || item?.kind !== 'story-node' || item.draftId !== draft.draftId || !event.dataTransfer?.types.includes(STORY_EDITOR_DRAG_TYPE)) return;
        for (const row of root.querySelectorAll<HTMLElement>('[data-story-drop-target="story-flag-table"]')) if (row !== flagRow) this.clearFlagTableDrop(row);
        const plan = flagRow.dataset.storyFlagKind === 'local' ? canBindFlagTableNode(draft,currentRelatedFlagCatalog(createUIContext(this.editorGame),this.state),flagRow.dataset.storyFlagName!,flagRow.dataset.storyFlagScope!,item.nodeId) : {ok:false as const};
        flagRow.classList.toggle('is-drop-target',plan.ok); flagRow.classList.toggle('is-drop-invalid',!plan.ok);
        const status = plan.ok ? plan.changed ? '可绑定' : '已绑定' : '不可绑定';
        flagRow.dataset.storyFlagDropStatus = status;
        flagRow.querySelector('summary')?.setAttribute('data-drop-label', status);
        event.preventDefault(); event.dataTransfer.dropEffect = plan.ok ? 'move' : 'none'; return;
      }
      const flow = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-flow') : null;
      const draft = currentDraft(this.state);
      const item = this.draggingItem;
      if (!flow || !draft || this.writeBlocked || !item || draft.draftId !== item.draftId
        || !event.dataTransfer?.types.includes(STORY_EDITOR_DRAG_TYPE)) return;
      clearStoryFlagDropStates(flow);
      const element = event.target instanceof Element ? event.target : null;
      const binding = storyFlagBindingDrop(element, item);
      if (binding) {
        const plan = canBindStoryNodeToFlagReader(draft, binding.flagName, binding.nodeId);
        highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
        binding.element.dataset.storyFlagDropStatus = plan.ok ? plan.changed ? '可绑定' : '已绑定' : '不可绑定';
        event.preventDefault();
        event.dataTransfer.dropEffect = plan.ok ? 'copy' : 'none';
        return;
      }
      if (item.kind !== 'story-node') return;
      const choiceTarget = choiceFlagDropTarget(element);
      const option = element?.closest<HTMLElement>('[data-story-drop-target="choice-flag"]');
      if (choiceTarget && option) {
        const plan = canBindStoryNodeToChoiceOption(draft, choiceTarget.choiceNodeId, choiceTarget.optionIndex, choiceTarget.optionId, item.nodeId);
        highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
        option.dataset.storyFlagDropStatus = plan.ok ? plan.created ? '可绑定' : '已绑定' : '不可绑定';
        event.preventDefault();
        event.dataTransfer.dropEffect = plan.ok ? 'copy' : 'none';
        return;
      }
      const anchor = storyDropAnchor(element, event.clientY, draft);
      if (anchor === undefined || anchor === item.nodeId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      highlightStoryDropAnchor(flow, anchor);
    };
    const dragLeave = (event: DragEvent): void => {
      const binding = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-story-flag-drop-status]') : null;
      if (binding && !(event.relatedTarget instanceof Node && binding.contains(event.relatedTarget))) delete binding.dataset.storyFlagDropStatus;
      const flagRow = flagTableDropTarget(event.target);
      if (flagRow && flagTableDropTarget(event.relatedTarget) !== flagRow) this.clearFlagTableDrop(flagRow);
      const flow = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-flow') : null;
      if (!flow || event.relatedTarget instanceof Node && flow.contains(event.relatedTarget)) return;
      clearStoryFlagDropStates(flow);
      highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
    };
    const drop = (event: DragEvent): void => {
      const flagRow = flagTableDropTarget(event.target);
      if (flagRow && root.contains(flagRow)) {
        const draft = currentDraft(this.state), item = readStoryDragItem(event);
        if (!draft || this.state.target?.kind !== 'story' || this.writeBlocked || item?.kind !== 'story-node' || item.draftId !== draft.draftId) return;
        event.preventDefault();
        const result = flagRow.dataset.storyFlagKind === 'local' ? bindFlagTableNode(draft,currentRelatedFlagCatalog(createUIContext(this.editorGame),this.state),flagRow.dataset.storyFlagName!,flagRow.dataset.storyFlagScope!,item.nodeId) : {ok:false,reason:'全局标记不能作为节点的局部执行条件。'};
        this.state.error = result.ok ? null : result.reason;
        this.state.inspectorView = 'story'; this.state.storyInspectorTab = 'flags';
        this.clearFlagTableDrop(flagRow);
        this.requestRefresh(); return;
      }
      const flow = event.target instanceof Element ? event.target.closest<HTMLElement>('.story-editor-flow') : null;
      const draft = currentDraft(this.state);
      const item = readStoryDragItem(event);
      if (!flow || !draft || this.writeBlocked || !item || item.draftId !== draft.draftId) return;
      const source = draft.document.nodes.find(node => node.id === item.nodeId);
      if (!source || item.kind === 'story-flag' && !hasFlowFlag(source, item.flagName, item.optionId)) return;
      const element = event.target instanceof Element ? event.target : null;
      const binding = storyFlagBindingDrop(element, item);
      if (binding) {
        event.preventDefault();
        const result = bindStoryNodeToFlagReader(this.state, binding.flagName, binding.nodeId);
        if (!result.ok) this.state.error = result.reason;
        else this.state.error = null;
        this.requestRefresh();
        clearStoryFlagDropStates(flow);
        highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId);
        return;
      }
      if (item.kind !== 'story-node') return;
      const choiceTarget = choiceFlagDropTarget(element);
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
    const dragEnd = (): void => {
      for (const row of root.querySelectorAll<HTMLElement>('[data-story-drop-target="story-flag-table"]')) this.clearFlagTableDrop(row);
      this.draggingItem = null;
      const flow = root.matches('.story-editor-flow') ? root : root.querySelector<HTMLElement>('.story-editor-flow');
      for (const target of flow?.querySelectorAll('.is-dragging') ?? []) target.classList.remove('is-dragging');
      if (flow) { clearStoryFlagDropStates(flow); highlightStoryDropAnchor(flow, this.state.insertionBeforeNodeId); }
    };
    const overlayPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || this.writeBlocked) return;
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
      const target = storyEditorSceneTarget(createUIContext(this.editorGame), scene);
      if (!target) return;
      this.ctrl.activeEditorTheme()?.applyEditorTheme({ kind: 'scene', theme: target.theme ?? {}, label: target.name });
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
    const ctx = createUIContext(this.editorGame);
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
  private revealInspectorFlag(): void {
    const flag = this.pendingFlagReveal;
    this.pendingFlagReveal = undefined;
    if (!flag || this.state.target?.kind !== 'story' || this.state.target.id !== flag.storyId) return;
    const body = this.editorScrollHost('right');
    if (!body) return;
    const rows = [...body.querySelectorAll<HTMLDetailsElement>('.story-editor-flag-item')].filter(row =>
      row.dataset.storyFlagName === flag.name && row.dataset.storyFlagKind === flag.kind
      && (flag.renamed ? row.dataset.storyFlagScope === flag.renamed.scope
        : [...row.querySelectorAll<HTMLElement>('[data-editor-story-target]')].some(card => card.dataset.editorStoryTarget === flag.storyId)));
    for (const row of rows) row.open = flag.renamed?.open ?? true;
    if (flag.renamed) {
      rows[0]?.parentElement?.querySelector<HTMLButtonElement>('[data-story-flag-rename]')?.focus({ preventScroll: true });
      return;
    }
    const summary = rows[0]?.querySelector('summary');
    if (!summary) return;
    const bounds = body.getBoundingClientRect(), heading = summary.getBoundingClientRect();
    if (heading.top < bounds.top || heading.bottom > bounds.bottom) body.scrollTop += heading.top - bounds.top;
  }

  private clearFlagTableDrop(row: HTMLElement): void {
    row.classList.remove('is-drop-target', 'is-drop-invalid');
    delete row.dataset.storyFlagDropStatus;
    row.querySelector('summary')?.removeAttribute('data-drop-label');
  }

  private openFlagRename(slot: HTMLElement): void {
    const owner = currentDraft(this.state);
    const row = slot.parentElement?.querySelector<HTMLDetailsElement>('.story-editor-flag-item');
    if (!owner || !row || this.writeBlocked) return;
    const { storyFlagName: name, storyFlagKind: kind, storyFlagScope: scope } = row.dataset;
    if (!name || !kind || !scope) return;
    const ctx = createUIContext(this.editorGame);
    const catalog = () => currentRelatedFlagCatalog(createUIContext(this.editorGame), this.state);
    const { locations, external } = storyFlagRenameUses(catalog(), owner.document.id, kind, name, scope);
    if (!locations.length) return;
    for (const form of this.ctrl.root.querySelectorAll('.story-editor-flag-rename-form')) form.remove();
    const externalCount = new Set(external.map(use => JSON.stringify(use.source))).size;
    const form = document.createElement('form');
    form.className = 'story-editor-flag-rename-form';
    form.innerHTML = `<label class="story-editor-property">新 Flag ID<input data-story-flag-rename-input value="${ctx.escapeHtml(name)}" autocomplete="off"></label>
      <p>将更新本篇 ${locations.length} 处。${externalCount ? `已发现 ${externalCount} 个外部 Story／Entry 仍引用旧名。` : '查阅范围外可能还有引用。'}外部引用可能因此失效。</p>
      <p class="story-editor-error" role="alert" hidden></p>
      <div><button type="button" class="mini-action" data-story-flag-rename-cancel>取消</button><button type="submit" class="mini-action">确认重命名</button></div>`;
    const input = form.querySelector('input')!;
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (this.state.target?.kind !== 'story' || this.state.target.id !== owner.document.id || currentDraft(this.state) !== owner || this.writeBlocked) return;
      const next = input.value.trim();
      const error = renameStoryCatalogFlag(owner, catalog(), kind, name, scope, next);
      if (error) {
        const message = form.querySelector<HTMLElement>('[role="alert"]')!;
        message.textContent = error; message.hidden = false; input.focus();
        return;
      }
      form.remove();
      if (next === name) {
        slot.querySelector<HTMLButtonElement>('[data-story-flag-rename]')?.focus({ preventScroll: true });
        return;
      }
      this.state.error = null;
      this.pendingFlagReveal = { storyId: owner.document.id, name: next, kind, renamed: { scope, open: row.open } };
      this.requestRefresh();
    });
    form.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        form.querySelector<HTMLButtonElement>('[data-story-flag-rename-cancel]')?.click();
      }
    });
    slot.append(form);
    input.focus(); input.select();
  }

  private openChoiceOptionIdPrompt(button: HTMLElement): void {
    const draft = currentDraft(this.state);
    const nodeId = button.dataset.storyNodeId;
    const optionIndex = Number(button.dataset.storyOptionIndex);
    const oldId = button.dataset.storyOptionId;
    if (!draft || !nodeId || !Number.isInteger(optionIndex) || !oldId) return;
    const ctx = createUIContext(this.editorGame);
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
    this.ctrl.activeEditorTheme()?.previewContent();
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
      if(action==='preview'){edit.previewing=true;edit.error=undefined;this.ctrl.activeEditorTheme()?.previewContent(this.ctrl.game.colorSystem.runtimeTheme());this.ctrl.refreshTheme();return;}
      this.ctrl.activeEditorTheme()?.previewContent();
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
      const theme=edit.draft as {colorGroupId?:string;palette?:string[]};const inherited=theme.colorGroupId?this.registry.colorGroups.get(theme.colorGroupId)?.slots.map(slot=>slot.color).slice(0,6)??[]:[];
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
  private editorScrollHost(panel: 'left' | 'center' | 'right'): HTMLElement | null {
    const selector = panel === 'left'
      ? '.story-editor-left .story-editor-sidebar-pane:not([hidden]) :is(.story-editor-list, .story-editor-sender-list)'
      : `.story-editor-${panel} .workspace-column__body`;
    return this.ctrl.root.querySelector<HTMLElement>(selector);
  }

  private editorPanelVisible(panel: typeof editorPanels[number]): boolean {
    const shell = this.ctrl.root.querySelector<HTMLElement>('[data-editor-workspace]');
    if (shell?.dataset.editorWorkspaceMode !== 'advanced') return true;
    const view = shell.dataset.editorWorkspaceView;
    return panel === 'center' || view === 'three' || panel === 'left' && view === 'browse';
  }
  private editorScrollPosition(panel: typeof editorPanels[number]): number {
    const remembered = panel === 'left' ? this.explorer.scrollTop('story', this.sidebarScrollKey) : this.activeBrowseInstance.state.scroll[panel];
    return (this.editorPanelVisible(panel) ? this.editorScrollHost(panel)?.scrollTop ?? remembered : remembered) ?? 0;
  }
  private setEditorScroll(panel: typeof editorPanels[number], position: number): void {
    if (panel === 'left') this.explorer.setScrollTop('story', this.sidebarScrollKey, position);
    else this.activeBrowseInstance.state.scroll[panel] = position;
    const body = this.editorPanelVisible(panel) && this.editorScrollHost(panel);
    if (body) body.scrollTop = position;
  }
  private captureEditorScroll(): Required<EditorScroll> {
    return { left: this.editorScrollPosition('left'), center: this.editorScrollPosition('center'), right: this.editorScrollPosition('right') };
  }
  private captureInstanceScroll(): StoryInstanceScroll {
    return { center: this.editorScrollPosition('center'), right: this.editorScrollPosition('right') };
  }
  private restoreEditorScroll(scroll: EditorScroll): void {
    for (const panel of editorPanels) {
      if (scroll[panel] !== undefined) this.setEditorScroll(panel, scroll[panel]);
    }
  }

  private closeAuthoringPreview(): void {
    if (this.previewTimer) clearInterval(this.previewTimer);
    this.previewTimer = undefined; this.preview?.close(); this.preview = undefined; this.previewLaunch = undefined;
    this.state.preview = undefined; this.previewSignature = '';
  }
  private startAuthoringPreview(patch: StoryAuthoringPatch, target: StoryAuthoringPreviewTarget, trigger?: HTMLElement, source?: StoryPackSource): void {
    const result = source ? this.ctrl.commands.createStoryAuthoringPreview(patch, target, source) : this.ctrl.commands.createStoryAuthoringPreview(patch, target);
    if (!result.ok) {
      if (this.preview) this.updateAuthoringPreview(result.message);
      else this.state.error = result.message;
      return;
    }
    this.closeAuthoringPreview();
    if (trigger) {
      this.closeEditorDialog(); this.closeSelectionNavi(); this.requiredFlagDropdown.close(); this.nodeMenu.close();
      this.previewReturnScroll = {
        ...this.captureEditorScroll(),
        launchKey: trigger.dataset.editorKey,
      };
    }
    this.previewLaunch = { patch, target, source };
    this.preview = result.preview;
    this.updateAuthoringPreview();
    this.previewTimer = setInterval(() => this.updateAuthoringPreview(), 200);
  }
  private updateAuthoringPreview(error = this.state.preview?.error): void {
    if (!this.preview) return;
    if (!this.isOpen()) { this.closeAuthoringPreview(); return; }
    const playback = this.preview.getView(); const story = this.preview.getStory(); const projection = this.preview.getProjection();
    const decisions = this.preview.getDecisions();
    const send = this.preview.getSendState();
    const signature = JSON.stringify([playback?.replayId, playback?.revision, playback?.phase, playback?.banner?.title, story, projection, send,
      decisions.pending?.id, decisions.history.length, decisions.route.length, decisions.message, error]);
    if (signature === this.previewSignature) return;
    const previous = this.state.preview;
    const sameCheck = previous?.decisions.pending?.id === decisions.pending?.id;
    this.previewSignature = signature;
    this.state.preview = { playback, story, projection, decisions, send, error,
      ...(sameCheck ? { selections: previous?.selections, collapsedCheck: previous?.collapsedCheck } : {}) };
    this.requestRefresh();
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
    if (target.hasAttribute('data-authoring-field')) {
      if (eventType === 'change' && ENTRY_FIELD_SEEDS[target.value]) {
        const path = [target.dataset.authoringField!, Number(target.dataset.authoringIndex), target.value];
        writeStructuredValue(draft,'$authoring',path,structuredClone(ENTRY_FIELD_SEEDS[target.value].value));
      }
      return true;
    }
    const scope = target.dataset.valueScope; const path = this.parsePropertyPath(target.dataset.valuePath);
    if (scope === undefined || !path) return false;
    if (target.hasAttribute('data-public-description')) {
      const text = target.value;
      const key = structuredKey(draft, scope, path);
      if (text.trim()) editStructuredValue(draft, scope, path, 'string', text);
      else {
        writeStructuredValue(draft, scope, path, undefined, true);
        draft.structuredInputs ??= {};
        draft.structuredInputs[key] = { text };
      }
    } else if (target.hasAttribute('data-value-type')) {
      if (eventType === 'change') constructStructuredValue(draft,scope,path,target.value);
    } else if (target.hasAttribute('data-entry-replay-policy') && target.value === '') {
      if (eventType === 'change') writeStructuredValue(draft, scope, path, undefined, true);
    } else if (target.hasAttribute('data-value-input')) {
      editStructuredValue(draft,scope,path,target.dataset.valueInput!,target.value);
      if (this.state.target?.kind === 'entry' && scope === '$authoring' && path.length === 3 && (path[0] === 'activeStories' || path[0] === 'passiveStories') && path[2] === 'id') {
        this.state.target = { kind: 'entry', id: String(valueAt(draft.authoring, path)) };
        if (draft.entryOnly) draft.entryOnly = this.state.target.id;
      }
    }
    else if (target.hasAttribute('data-value-key')) {
      draft.structuredInputs ??= {}; draft.structuredInputs[structuredKey(draft,scope,path) + ':new-key'] = { text: target.value };
    }
    return true;
  }
  private reviewEntryActivation(draft: import('./model').StoryDraft, next: EntryActivation, entry?: StoryEntryDef): void {
    const e=createUIContext(this.editorGame).escapeHtml;
    const previous=entry ? JSON.stringify(entry.activation) : undefined;
    const describe=(value:EntryActivation):string=>value.kind==='active'?`主动接取；${value.fallback?.kind==='fixed-area'?`接取地区 ${value.fallback.areaId}`:value.fallback?'当前地区兜底':'不兜底投放'}`:value.kind==='random'?`随机抽取；基础权重 ${value.weight}；${value.repeatable?'可重复触发':'单次触发'}；冷却 ${value.cooldownFrames ?? 0} 帧`:`角色阶段；${value.when.kind==='level'?`好感等级 ${value.when.level}`:`前置故事 ${value.when.storyId}`}；冷却 ${value.cooldownFrames ?? 0} 帧`;
    this.ctrl.modal.open({title:entry?'更改激活配置':'新建好感／角色阶段入口',width:560,
      body:`${entry?`<p>确认替换当前激活配置？</p><p>当前：${e(describe(entry.activation))}</p><p>替换为：${e(describe(next))}</p>${next.kind==='active'?'<p>当前被动播放限制和完结后的对话暂停配置也将移除。</p>':''}`:''}${next.kind==='affection'?`<label>归属角色<select data-entry-activation-owner><option value="">选择角色</option>${[...this.registry.characterVariants.values()].map(role=>`<option value="${e(role.id)}"${entry?.owner===role.id?' selected':''}>${e(role.displayName)} · ${e(role.id)}</option>`).join('')}</select></label>`:''}<p class="story-editor-error" data-entry-activation-error hidden></p>`,
      footer:'<button type="button" class="modal-close">取消</button><button type="button" class="mini-action" data-modal-action="confirm-entry-activation">确认</button>',
      onAction:action=>{
        if(action!=='confirm-entry-activation'||currentAuthoringDraft(this.state)!==draft||this.writeBlocked)return;
        try{
          const owner=next.kind==='affection'?document.querySelector<HTMLSelectElement>('[data-entry-activation-owner]')?.value:entry?.owner;
          if(next.kind==='affection'&&(!owner||!this.registry.characterVariants.has(owner)))throw new Error('请选择归属角色。');
          const candidate=structuredClone(draft);
          if(entry){
            if(JSON.stringify(entry.activation)!==previous)throw new Error('当前激活配置已变化，请关闭后重新核对。');
            if(next.kind!=='random'&&[...this.registry.passivePools.values()].some(pool=>pool.children.some(child=>child.id===entry.id)&&!draft.authoring?.passivePools.some(row=>row.id===pool.id)))throw new Error('请先从关联抽取池中移除此 Entry。');
            changeEntryActivation(candidate,entry.id,next,owner);
          }else addStoryAuthoringRow(candidate,'passiveStories',owner);
          const pending={...this.state,drafts:this.state.drafts.map(row=>row===draft?candidate:row)};
          if(!this.persist(pending))throw new Error(pending.error ?? '草稿保存失败，原配置已保留。');
          Object.assign(draft,candidate);
          this.state.error=null;
          this.ctrl.modal.close();this.requestRefresh();
        }catch(error){const node=document.querySelector<HTMLElement>('[data-entry-activation-error]');if(node){node.textContent=error instanceof Error?error.message:String(error);node.hidden=false;}}
      }});
  }
  private authoringClick(target: HTMLElement): void {
    if (target.hasAttribute('data-authoring-preview-option') || target.dataset.authoringAction === 'advance') {
      const result = this.preview?.advance(target.dataset.authoringPreviewOption, target.dataset.previewToken);
      if (result) this.updateAuthoringPreview(result.message);
      return;
    }
    if (target.dataset.authoringAction === 'close-preview') { this.closeAuthoringPreview(); return; }
    if (target.dataset.authoringAction === 'restart-preview') {
      const launch = this.previewLaunch;
      if (launch) this.startAuthoringPreview(launch.patch, launch.target, undefined, launch.source);
      return;
    }
    if (target.dataset.authoringAction === 'preview') {
      if (this.preview) return;
      const draft = currentAuthoringDraft(this.state);
      if (!draft) return;
      this.inlineText.finish();
      this.state.error = null;
      hydrateStoryAuthoring(draft, this.registry);
      const compiled = compileStoryAuthoring(this.state);
      if (!compiled.ok) { this.state.error = compiled.message; return; }
      const entryId = this.state.target?.kind === 'entry' ? this.state.target.id
        : storyPreviewEntries(this.state, draft, this.registry.storyEntries).entryId;
      const selection = this.state.sourceSelection;
      const source = selection?.startsWith('pack:') ? this.packSource(selection.slice(5))
        : selection?.startsWith('draft:') ? draft.packSource : undefined;
      if ((selection?.startsWith('pack:') && !source) || (draft.packSource && this.packQuery.getRunningStoryPackId?.(draft.packSource.modName) !== draft.packSource.packRecordId)) {
        this.state.error = '试播来源当前未载入，请先在数据包管理中应用所需版本。';
        return;
      }
      this.startAuthoringPreview(compiled.patch, entryId || { storyId: draft.document.id }, target, source);
      return;
    }
    if (this.writeBlocked) return;
    const draft = currentAuthoringDraft(this.state); if (!draft) return;
    hydrateStoryAuthoring(draft,this.registry);
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
        const entry=this.state.target?.kind==='entry'?storyEntries(this.state,this.registry.storyEntries).get(this.state.target.id):undefined;
        if(add==='passivePools'&&entry&&entry.activation.kind!=='random')throw new Error('只有随机入口可以加入抽取池。');
        addStoryAuthoringRow(draft,add);
        if(add==='passivePools'&&entry)draft.authoring!.passivePools.at(-1)!.children.push({id:entry.id,weight:1});
        return;
      }
      if (target.hasAttribute('data-authoring-copy')) {
        const id = this.state.copyStoryId?.trim() ?? '';
        if (draft.packSource && !id.startsWith(`${draft.packSource.modName}:story:`)) throw new Error('请输入当前编辑态 Mod 下的新 Story ID。');
        if (!copyStoryIdentity(this.state,draft,id,new Set(this.registry.stories.keys()))) throw new Error('请输入尚未使用的完整 Story ID：mod:story:name。');
        if (draft.packSource) {
          const copy = currentDraft(this.state)!;
          copy.packSource = draft.packSource;
          copy.targetPackId = draft.targetPackId;
        }
        this.closeAuthoringPreview(); return;
      }
      if (target.dataset.authoringCatalog) {
        this.editEntryCatalog(target, draft);
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
          if (!draft.entryOnly && scope === '$authoring' && path.length === 2 && (path[0] === 'activeStories' || path[0] === 'passiveStories') && this.state.target?.kind === 'entry') this.browseTarget({ kind: 'story', id: draft.document.id });
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
      const kind = target.dataset.authoringAction;
      const ownerPackId = draft.targetPackId;
      const previousDigest = draft.packSource?.digest;
      const compiled = compileStoryAuthoring(this.state, this.state.sourceOptions
        ? item => item.targetPackId === ownerPackId && this.draftSaveAllowed(item) : undefined);
      if (!compiled.ok) throw new Error(compiled.message);
      if (kind==='apply' && draft.renamedFromId && draft.renamedFromId!==draft.document.id && this.registry.stories.has(draft.renamedFromId)) throw new Error('此 Story 已在 Mod 中更改 ID，请先重新载入该 Mod。');
      if (kind==='pack') {
        const id=draft.targetPackId ?? this.state.targetPackId;
        if (!id) throw new Error('请选择允许编辑的目标包。');
        const {record}=storyEditingMod(this.ctrl.game,id);
        if (!draft.sourceId && record.datapack.stories?.some(story=>story.id===draft.document.id)) throw new Error('目标 Mod 已出现同名 Story，请更改 ID，避免覆盖。');
        this.state.targetPackId=id;
      }
      if (ownerPackId && this.state.sourceOptions && kind !== 'copy') {
        const pack = storyEditingMod(this.ctrl.game, ownerPackId).record;
        for (const table of STORY_AUTHORING_TABLES) {
          const rows = compiled.patch[table] as { id: string }[];
          for (let index = rows.length - 1; index >= 0; index--) {
            const row = rows[index];
            const existing = this.registry[table].get(row.id);
            if ((pack.datapack[table] ?? []).some(item => item.id === row.id) || !existing && row.id.startsWith(`${pack.manifest.modName}:`)) continue;
            if (JSON.stringify(existing) !== JSON.stringify(row)) throw new Error(`${row.id} 属于其他 Mod，请打开其编辑态记录。`);
            rows.splice(index, 1);
          }
        }
      }
      const hasDirectoryPlacement = compiled.patch.stories.some(story => story.directoryId || story.hierarchyString)
        || [...compiled.patch.activeStories, ...compiled.patch.passiveStories].some(entry => entry.directoryPlacements?.length);
      const result = kind === 'check' ? this.ctrl.commands.validateStoryAuthoring(compiled.patch, this.state.sourceOptions || hasDirectoryPlacement ? ownerPackId : undefined)
        : kind === 'apply' ? this.ctrl.commands.applyStoryAuthoring(compiled.patch, ownerPackId)
        : kind === 'pack' && this.state.targetPackId && this.ctrl.commands.saveStoryAuthoringToPack ? this.ctrl.commands.saveStoryAuthoringToPack(this.state.targetPackId,compiled.patch)
        : { ok: false, message: '请选择允许编辑的目标包。' };
      if (!result.ok) throw new Error(result.message);
      if (kind==='pack') for (const item of this.state.drafts) if (!item.entryOnly && compiled.patch.stories.some(story=>story.id===item.document.id)) {
        item.targetPackId=this.state.targetPackId;item.sourceId ??= item.document.id;item.dirty=true;
        if (this.state.sourceOptions && item.targetPackId) item.packSource = this.packSource(item.targetPackId);
      }
      if (kind === 'pack' && this.state.sourceOptions && ownerPackId) this.refreshPackSource(ownerPackId, previousDigest);
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
    const path=this.parsePropertyPath(element.dataset.storyRowPath ?? element.dataset.storyPath);
    if(element.dataset.storyInitBranch&&path) { toggleOptional(draft,node.id,path,true); selectBranch(draft,node.id,path,element.dataset.storyInitBranch); return; }
    if(element.dataset.storyInitCondition&&path) { toggleOptional(draft,node.id,path,true); if(readProperty(draft,node.id,path)===undefined) editProperty(draft,node.id,path,{type:'AND',conditions:[]}); return; }
    if(element.dataset.storyInitObject!==undefined&&path) { toggleOptional(draft,node.id,path,true); if(readProperty(draft,node.id,path)===undefined) editProperty(draft,node.id,path,{}); return; }
    if(element.dataset.storyInitValue&&path) { toggleOptional(draft,node.id,path,true); editProperty(draft,node.id,path,{}); return; }
    const action=element.dataset.storyRowAction; const rowPath=this.parsePropertyPath(element.dataset.storyRowPath);
    if(!action||!rowPath)return;
    if(action==='add') {
      if(!Array.isArray(readProperty(draft,node.id,rowPath)))editProperty(draft,node.id,rowPath,[]);
      const choice=node.type==='click'&&node.interaction.kind==='choice';
      const choiceMarks=choice&&rowPath[0]==='interaction'&&rowPath[1]==='options'&&rowPath.at(-1)==='marks';
      const row=rowPath.at(-1)==='options'?{id:`option_${crypto.randomUUID().replace(/-/g,'')}`,text:''}:choiceMarks||rowPath.at(-1)==='returnFlags'?'':{};
      addRow(draft,node.id,rowPath,row); return;
    }
    const rowId=element.dataset.storyRowId;
    if(action==='remove'&&rowId)removeRow(draft,node.id,rowPath,rowId);
    if((action==='up'||action==='down')&&rowId)moveRowBy(draft,node.id,rowPath,rowId,action==='up'?-1:1);
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
  private prepareReferenceControls(root: ParentNode): void {
    const ctx = createUIContext(this.editorGame);
    const stories = storyReferenceDocuments(ctx, this.state);
    const entries = storyEntries(this.state, ctx.game.registry.storyEntries);
    prepareReferenceNavi(root, target => this.hasTarget(target), {
      ctx, resolve: target => resolveStoryIdentity(target, stories, entries),
    });
  }

  private openContentNavi(field: ReferenceField): void {
    const target = this.state.target, nodeId = this.state.selectedNodeId;
    const live = () => this.isOpen() && field.isConnected && !field.disabled
      && !(field instanceof HTMLInputElement && field.readOnly) && !this.writeBlocked
      && this.state.target?.kind === target?.kind && this.state.target?.id === target?.id && this.state.selectedNodeId === nodeId;
    if (!target || !live()) return;
    this.requiredFlagDropdown.close(); this.selectionNaviOpen = true;
    const ctx = createUIContext(this.editorGame);
    const kind = field.dataset.storyReference;
    const fieldChoices = new Set(referenceChoices(field).filter(row => !row.disabled).map(row => row.value));
    const storyRows = kind === 'story' ? conditionReferenceChoices(ctx, this.state, kind, [])
      : kind === 'entry' || kind === 'activeEntry' || kind === 'passiveEntry'
        ? conditionReferenceChoices(ctx, this.state, kind, []).filter(row => fieldChoices.has(row.value)) : undefined;
    openReferenceNavi(this.ctrl.modal, ctx, field, {
      storyRows,
      close: () => { this.selectionNaviOpen = false; if (field.isConnected) field.focus({ preventScroll: true }); },
      select: value => {
        if (!live()) { this.ctrl.modal.close(); return; }
        const fitsField = referenceChoices(field).some(row => row.value === value && !row.disabled);
        if (!fitsField && !(kind === 'story' && field instanceof HTMLInputElement && this.storyKey(value))) return;
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
    if (!target || this.writeBlocked) return;
    const nodeId = this.state.selectedNodeId;
    const catalog = () => buildStoryFlagCatalog(this.state,buildStoryRelations(this.state,this.registry.stories,this.registry.storyEntries),target);
    const live = () => this.isOpen() && input.isConnected && !input.disabled && !input.readOnly && !this.writeBlocked
      && this.state.target?.kind === target.kind && this.state.target.id === target.id && this.state.selectedNodeId === nodeId;
    this.selectionNaviOpen = true;
    openLocalFlagNavi(this.ctrl.modal,createUIContext(this.editorGame),catalog(),{
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
    if (!owner || this.writeBlocked) return;
    const relations = buildStoryRelations(this.state, this.registry.stories, this.registry.storyEntries);
    const boundary = buildStoryFlagCatalog(this.state, relations, { kind: 'story', id: owner.document.id },true).boundaries.find(item => item.key === key);
    if (!boundary || boundary.missing) return;
    const entry = relations.entries.get(boundary.call.to.id)!;
    const name = entry.openingTitle || entry.id;
    this.ctrl.modal.open({ title: '获取 Entry 的 flag 信息', body: `<p>是否将“${createUIContext(this.editorGame).escapeHtml(name)}”涉及的 flag 纳入当前故事的清单？内部局部标记仍属于该 Entry，不会自动添加到回传白名单。</p>`,
      footer: '<button type="button" class="mini-action" data-modal-action="flag-import-no">不获取</button><button type="button" class="mini-action" data-modal-action="flag-import-yes">获取信息</button>',
      onAction: action => {
        if (!['flag-import-no', 'flag-import-yes'].includes(action) || currentDraft(this.state) !== owner) return;
        // Materialize the source draft so action-row identities survive edits and reloads.
        const previousTarget = this.state.target;
        const previousNode = this.state.selectedNodeId;
        const previousGap = this.state.insertionBeforeNodeId;
        if (boundary.call.from.kind === 'story' && !this.state.drafts.some(draft => draft.document.id === boundary.call.from.id)) this.selectDocument(`source:${boundary.call.from.id}`);
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
    const packs=storyEditingMods(this.ctrl.game), e=createUIContext(this.editorGame).escapeHtml;
    const preferred=currentAuthoringDraft(this.state)?.targetPackId ?? this.state.targetPackId;
    this.ctrl.modal.open({title:'选择新 Story 所属 Mod',panelClass:'story-editor-identity',width:520,
      body:`<label class="story-editor-property">编辑态 Mod<select data-story-new-mod><option value="">选择编辑态 Mod</option>${packs.map(pack=>`<option value="${e(pack.packRecordId ?? pack.id)}"${(pack.packRecordId ?? pack.id)===preferred?' selected':''}>${e(pack.name)} · ${e(pack.modName)} · ${e(pack.version)}</option>`).join('')}</select></label>${packs.length?'':'<p>暂无已载入的编辑态 Mod，请在数据包管理中创建并应用编辑副本。</p>'}<p class="story-editor-error" data-story-identity-error hidden></p>`,
      footer:`<button type="button" class="modal-close">取消</button><button type="button" class="mini-action" data-modal-action="create-story-in-mod"${packs.length?'':' disabled'}>确认并新建</button>`,
      onAction:action=>{
        if (action!=='create-story-in-mod' || !this.isOpen() || this.state.storageBlocked) return;
        try {
          const id=document.querySelector<HTMLSelectElement>('[data-story-new-mod]')?.value ?? '';
          const {record}=storyEditingMod(this.ctrl.game,id);
          if (!this.save(false,false)) throw new Error(this.state.error ?? '请先保存当前草稿。');
          if (this.state.sourceOptions) this.selectSource(`pack:${id}`);
          const known=new Set([...this.registry.stories.keys(),...knownModStoryIds(this.ctrl.game,record.manifest.modName)]);
          this.rememberVisit();this.closeAuthoringPreview();this.closeThemeContentEdit();
          const draft = newStory(this.state,record.manifest.modName,known,id);this.state.targetPackId=id;
          if (this.state.sourceOptions) draft.packSource = this.packSource(id);
          this.state.inspectorView=undefined;this.state.storyInspectorTab='overview';this.pushVisit();
          this.ctrl.modal.close();this.requestRefresh();
        } catch (error) {
          const message=document.querySelector<HTMLElement>('[data-story-identity-error]');
          if(message){message.textContent=error instanceof Error?error.message:String(error);message.hidden=false;}
        }
      }});
  }

  private copyRecovery(trigger: HTMLElement): void {
    const draft = currentAuthoringDraft(this.state);
    if (!draft || this.state.storageBlocked || !this.state.sourceSelection?.startsWith('draft:')) return;
    const packs = storyEditingMods(this.ctrl.game);
    const e = createUIContext(this.editorGame).escapeHtml;
    this.closeEditorDialog();
    this.editorDialog = openStoryEditorDialog(this.ctrl.modal, {
      title: '另存正文', panelClass: 'story-editor-identity',
      body: `<p>复制正文到新的 Story。原草稿和关联入口会保留在原来源。</p>
        <label class="story-editor-property">目标编辑态包<select data-recovery-pack>${packs.map(pack =>
          `<option value="${e(pack.packRecordId ?? pack.id)}">${e(pack.name)} · ${e(pack.version)}</option>`).join('')}</select></label>
        <label class="story-editor-property">新 Story ID<input data-recovery-story-id placeholder="mod:story:name"></label>
        <p class="story-editor-error" data-recovery-error role="status"></p>`,
      footer: `<button type="button" class="modal-cancel" data-modal-action="cancel">取消</button><button type="button" class="mini-action" data-modal-action="copy-recovery"${packs.length ? '' : ' disabled'}>核对并建立副本</button>`,
      onClose: () => { this.editorDialog = undefined; },
      onAction: action => {
        if (action === 'cancel') { this.closeEditorDialog(); return; }
        if (action !== 'copy-recovery' || currentAuthoringDraft(this.state) !== draft) return;
        const panel = this.editorDialog;
        const packId = panel?.querySelector<HTMLSelectElement>('[data-recovery-pack]')?.value ?? '';
        const id = panel?.querySelector<HTMLInputElement>('[data-recovery-story-id]')?.value.trim() ?? '';
        try {
          const { record } = storyEditingMod(this.ctrl.game, packId);
          if (!id.startsWith(`${record.manifest.modName}:story:`)) throw new Error('新 Story ID 必须使用所选包的 Mod ID。');
          const candidate = createStoryEditorState();
          const used = new Set([...knownModStoryIds(this.ctrl.game, record.manifest.modName), ...this.state.drafts.map(item => item.document.id),
            ...(this.state.parkedDrafts ?? []).map(item => item.document.id)]);
          if (!copyStoryIdentity(candidate, draft, id, used)) throw new Error('请填写尚未使用的完整 Story ID。');
          const copy = currentDraft(candidate)!;
          const projected = storyDefinitionFromDraft(copy);
          if (!projected.ok) throw new Error(projected.message);
          const checked = this.ctrl.commands.validateStoryAuthoring({ ...emptyStoryAuthoring(), stories: [projected.story] }, packId);
          if (!checked.ok) throw new Error(checked.message);
          if (!this.save(false, false)) throw new Error(this.state.error ?? '无法保留原草稿。');
          this.selectSource(`pack:${packId}`);
          copy.targetPackId = packId; copy.packSource = this.packSource(packId);
          this.state.drafts.push(copy);
          this.browseTarget({ kind: 'story', id });
          this.requestRefresh();
        } catch (error) {
          const message = panel?.querySelector('[data-recovery-error]');
          if (message) message.textContent = error instanceof Error ? error.message : String(error);
        }
      },
    }, trigger);
  }

  private openCardGradient(trigger: HTMLElement): void {
    const target = this.state.target;
    const draft = currentAuthoringDraft(this.state);
    if (!target || !draft || this.writeBlocked || this.state.readOnlyReason) return;
    const { kind, id } = target;
    const entry = kind === 'entry' ? storyEntries(this.state, this.registry.storyEntries).get(id) : undefined;
    if (kind === 'entry' && !entry) return;
    const original = kind === 'story' ? draft.document.cardGradient : entry?.cardGradient;
    const name = trigger.querySelector('strong')?.textContent ?? id;
    const scope = kind === 'story' ? '$document' : '$authoring';
    this.closeEditorDialog();
    this.editorDialog = openStoryCardGradientDialog(this.ctrl.modal, createUIContext(this.editorGame), trigger, target, name, original, gradient => {
      const style = storyCardStyle(kind, id, gradient);
      for (const card of this.ctrl.root.querySelectorAll<HTMLElement>('[data-story-target-kind][data-story-target-id]')) {
        if (card.dataset.storyTargetKind === kind && card.dataset.storyTargetId === id) card.setAttribute('style', style);
      }
    }, gradient => {
      if (!this.isOpen() || this.state.target?.kind !== kind || this.state.target.id !== id
        || currentAuthoringDraft(this.state) !== draft || this.writeBlocked || this.state.readOnlyReason) return false;
      if (gradient?.start === original?.start && gradient?.end === original?.end) return true;
      let path: ValuePath = ['cardGradient'];
      if (kind === 'entry') {
        const table = entry?.activation.kind === 'active' ? 'activeStories' : 'passiveStories';
        const index = draft.authoring?.[table].findIndex(row => row.id === id) ?? -1;
        if (index === -1) return false;
        path = [table, index, 'cardGradient'];
      }
      if (!writeStructuredValue(draft, scope, path, gradient, gradient === undefined)) return false;
      this.requestRefresh();
      return true;
    }, () => { this.editorDialog = undefined; });
  }

  private closeEditorDialog(): void {
    if (this.editorDialog?.isConnected) this.ctrl.modal.close();
    this.editorDialog = undefined;
  }

  private directoryReferences(packId: string, id: string, automatic: boolean) {
    const own = this.packSource(packId)?.modName;
    const refs = new Map<string, StoryDirectoryReference & { source?: string; sourceLabel?: string }>();
    const add = (rows: readonly StoryDirectoryReference[], source?: string, sourceLabel?: string) => {
      for (const row of rows) {
        const key = JSON.stringify([row.kind, row.id, source ?? this.state.sourceSelection ?? '']);
        if (!refs.has(key)) refs.set(key, { ...row, source, sourceLabel });
      }
    };
    for (const draft of [...this.state.drafts, ...(this.state.parkedDrafts ?? [])]) {
      if (automatic && (draft.packSource?.modName ?? draft.document.id.split(':')[0]) === own) continue;
      const parked = !this.state.drafts.includes(draft);
      add(storyDirectoryReferences(id, {
        stories: draft.entryOnly ? [] : [draft.document], activeStories: draft.authoring?.activeStories ?? [], passiveStories: draft.authoring?.passiveStories ?? [],
      }), parked ? `draft:${draft.draftId}` : undefined, '草稿');
    }
    for (const entry of this.packQuery.getPackCatalog?.().entries ?? []) {
      const recordId = entry.packRecordId ?? entry.id;
      if (!isLoadedStoryPack(this.packQuery, entry) || (recordId === packId ? automatic : entry.modName === own)) continue;
      const root = recordId === packId ? this.packQuery.getPackRecord?.(recordId)?.datapack
        : this.packQuery.getStoryPackSources?.(storyPackSource(entry)).datapacks.at(-1);
      if (root?.modName === entry.modName) add(storyDirectoryReferences(id, root), `pack:${recordId}`, `${entry.name} · ${entry.version}`);
    }
    const registry = this.registry;
    add(storyDirectoryReferences(id, {
      storyDirectories: [...registry.storyDirectories.values()].filter(row => row.modName !== own).map(row => row.definition),
      stories: [...registry.stories.values()].filter(row => registry.storyDirectoryContentOwner(row.id, 'story') !== own),
      activeStories: [...registry.activeStories.values()].filter(row => registry.storyDirectoryContentOwner(row.id) !== own),
      passiveStories: [...registry.passiveStories.values()].filter(row => registry.storyDirectoryContentOwner(row.id) !== own),
    }));
    return [...refs.values()];
  }

  private buildDirectoryManagement(state: StoryDirectoryManagementState) {
    const resource = state.resource;
    const source = parseStoryExplorerSource(resource.sourceKey) ?? { kind: 'runtime' as const };
    const sourceProjection = this.syncStoryExplorerSource(source);
    const archiveSource = state.archiveTarget && state.archiveTarget.sourceKey !== resource.sourceKey
      ? parseStoryExplorerSource(state.archiveTarget.sourceKey) : undefined;
    const archiveProjection = archiveSource ? this.syncStoryExplorerSource(archiveSource) : sourceProjection;
    const ctx = createUIContext(storySourceGame(this.ctrl.game, sourceProjection));
    const registry = ctx.game.registry;
    const directoryDrafts = [...new Map([...sourceProjection.drafts, ...archiveProjection.drafts].map(draft => [draft.draftId, draft])).values()];
    const archiveRegistry = archiveProjection.sourceRegistry ?? registry;
    const entryRegistry = new Map([...registry.storyEntries, ...archiveRegistry.storyEntries]);
    const entries = storyEntries({ drafts: directoryDrafts }, entryRegistry);
    const targetRef = state.archiveTarget;
    const id = targetRef?.id;
    const draft = targetRef?.draftId
      ? [...this.state.drafts, ...(this.state.parkedDrafts ?? [])].find(item => item.draftId === targetRef.draftId)
      : undefined;
    const entry = targetRef?.kind === 'entry' ? entries.get(targetRef.id) : undefined;
    const targetEntry = targetRef?.kind === 'entry'
      ? [...(draft?.authoring?.activeStories ?? []), ...(draft?.authoring?.passiveStories ?? [])].find(row => row.id === targetRef.id)
      : undefined;
    const story = targetRef?.kind === 'story' ? archiveRegistry.stories.get(targetRef.id) ?? draft?.document : undefined;
    const stories = new Map<string, import('../../arona-clicker/content/story/story-directory').StoryDirectoryDocument>([...registry.stories, ...archiveRegistry.stories]);
    for (const item of directoryDrafts) {
      if (item.sourceId && item.sourceId !== item.document.id) stories.delete(item.sourceId);
      if (!item.entryOnly || !stories.has(item.document.id)) stories.set(item.document.id, item.document);
    }
    const modName = targetRef?.modName ?? (id ? registry.storyDirectoryContentOwner(id, targetRef?.kind) ?? id.split(':')[0] : undefined);
    const selection = resource.sourceKey;
    const runningOwner = !selection && !draft ? resource.ownerModName : undefined;
    const binding = state.writeBinding;
    const packSource = binding && this.packSource(binding.packRecordId);
    const creatingPackDirectory = binding?.purpose === 'new-directory';
    const sourceLabel = packSource
      ? `${packSource.label}${creatingPackDirectory || !selection ? ' · 目录资料保存后需应用到当前游戏' : ''}`
      : sourceProjection.sourceOptions.find(item => item.value === selection)?.label ?? '当前游戏';
    return createStoryDirectoryManagement(ctx, {
      state, stories, entries,
      appliedCatalog: () => this.ctrl.game.registry,
      sourceMod: sourceProjection.sourceMod,
      initIds: sidebarInitIds(ctx, sourceProjection), contentOwner: editorDirectoryContentOwner(ctx, sourceProjection),
      sourceLabel,
      references: (packId, node) => this.directoryReferences(packId, node.id, node.source === 'AutoCreated'),
      save: this.ctrl.commands.saveStoryDirectoryToPack && ((packId, directory, remove) => {
        const livePackSource = this.packSource(packId);
        const bindingMatches = Boolean(binding && binding.packRecordId === packId && livePackSource
          && livePackSource.modName === binding.modName && livePackSource.digest === binding.expectedDigest
          && isActiveEditingPack(this.packQuery, packId, binding.modName));
        if (!bindingMatches || creatingPackDirectory && !livePackSource
          || (runningOwner && this.packQuery.getRunningStoryPackId?.(runningOwner) !== packId)
          || (binding?.purpose === 'content' && this.writeBlocked)) {
          return { ok: false, message: '编辑态 Mod 已变化。当前修改已保留，请核对原包和最新版本后重试。' };
        }
        const previous = this.packQuery.getPackRecord?.(packId)?.datapack.storyDirectories ?? [];
        const updates = 'id' in directory ? [directory] : directory;
        const relocate = remove || updates.some(update => {
          const original = previous.find(row => row.id === update.id);
          return original ? original.parentId !== update.parentId || original.hierarchyString !== update.hierarchyString : !update.characterId;
        });
        const result = this.ctrl.commands.saveStoryDirectoryToPack!(packId, directory, remove);
        if (result.ok && binding) {
          this.refreshPackSource(packId, binding.expectedDigest);
          binding.expectedDigest = this.packSource(packId)?.digest;
        }
        if (result.ok && relocate) this.pendingDirectoryReveal = true;
        return result;
      }),
      place: (initId, placement) => {
        if (!targetRef || !draft || !id || !targetRef.draftId || draft.draftId !== targetRef.draftId
          || !this.state.drafts.includes(draft) || !targetRef.targetPackId) return '归档目标草稿已不存在或不可编辑。';
        const targetPackId = targetRef.targetPackId;
        const targetPackSource = this.packSource(targetPackId);
        if (!targetPackSource || targetPackSource.modName !== targetRef.modName
          || targetPackSource.digest !== targetRef.expectedDigest
          || !isActiveEditingPack(this.packQuery, targetPackId, targetRef.modName ?? '')) return '目标编辑包已变化；归档草稿保持不变，请重新打开归档操作。';
        if (draft.targetPackId !== targetPackId) return '目标草稿的写入包已变化。';
        if (placement?.order !== undefined && !Number.isFinite(placement.order)) return '请填写有效的顺序。';
        try {
          const { record } = storyEditingMod(this.ctrl.game, targetPackId);
          const owner = record.manifest.modName;
          const rows = targetRef.kind === 'entry' ? [...record.datapack.activeStories, ...record.datapack.passiveStories] : record.datapack.stories;
          if (owner !== targetRef.modName || !rows.some(row => row.id === id)) return '目标编辑态 Mod 不拥有此文档。';
          if (targetRef.kind === 'entry') {
            if (!targetEntry || targetEntry.availableInits.length && !targetEntry.availableInits.includes(initId)) return '此入口不适用于该世界线。';
            const placements = (targetEntry.directoryPlacements ?? []).filter(row => row.initId !== initId);
            if (placement) placements.push({ initId, ...placement });
            if (placements.length) targetEntry.directoryPlacements = placements;
            else delete targetEntry.directoryPlacements;
          } else if (story) {
            const { directoryId: _previousDirectory, hierarchyString: _previousHierarchy, ...document } = draft.document;
            if (!placement) draft.document = document;
            else {
              const { initId: _previousInit, ...storyFields } = document;
              const { order, ...position } = placement;
              draft.document = { ...storyFields, ...(initId ? { initId } : {}), ...position };
            }
          }
          draft.targetPackId = targetPackId;
          draft.dirty = true;
          return '目录位置已更新到目标草稿。';
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });
  }

  private editEntryCatalog(trigger: HTMLElement, draft: StoryDraft): void {
    const table = trigger.dataset.authoringCatalog;
    if (table !== 'activeStories' && table !== 'passiveStories') return;
    const index = Number(trigger.dataset.authoringIndex);
    const entry = draft.authoring?.[table][index];
    if (!entry || this.state.target?.kind !== 'entry' || this.state.target.id !== entry.id) return;
    const scope = '$authoring';
    const path = [table, index, 'catalog'];
    const pendingOrderKey = structuredKey(draft, scope, [...path, 'order']);
    const signature = JSON.stringify(entry.catalog);
    const entries = storyEntries(this.state, this.registry.storyEntries);
    const editTargets = this.catalogEditTargets(entries);
    const originalCatalogs = new Map([...entries].map(([id, row]) => [id, JSON.stringify(row.catalog)]));
    const draftNames = new Map(this.state.drafts.map(item => [item.document.id, item.document.name]));
    const ctx = createUIContext(this.editorGame);
    this.closeEditorDialog();
    this.editorDialog = openStoryCatalogDialog(this.ctrl.modal, ctx, trigger, {
      entry,
      entries,
      storyName: id => draftNames.get(id) ?? ctx.game.registry.stories.get(id)?.name,
      canEdit: row => editTargets.has(row.id),
      memory: this.catalogMemory,
      pendingOrder: draft.structuredInputs?.[pendingOrderKey]?.text,
      beforeRemove: element => this.ctrl.popovers.dismissBeforeRootMutation(element),
      onClose: () => { this.editorDialog = undefined; },
      commit: (value, orders) => {
        if (!this.isOpen() || this.writeBlocked || this.state.target?.kind !== 'entry' || this.state.target.id !== entry.id
          || currentAuthoringDraft(this.state) !== draft || draft.authoring?.[table][index] !== entry
          || JSON.stringify(entry.catalog) !== signature) return '目录位置已变化，请关闭后重新打开。';
        const live = storyEntries(this.state, this.registry.storyEntries);
        const changes = new Map<string, StoryEntryDef['catalog']>();
        if (JSON.stringify(value) !== signature || editTargets.has(entry.id) && draft.structuredInputs?.[pendingOrderKey]) changes.set(entry.id, value);
        for (const [id, order] of orders) {
          const peer = live.get(id);
          if (!peer?.catalog || JSON.stringify(peer.catalog) !== originalCatalogs.get(id)) return '同级条目的目录位置已变化，请重新打开。';
          if (peer.catalog.order === order) continue;
          const catalog = { ...peer.catalog };
          if (order === undefined) delete catalog.order;
          else catalog.order = order;
          changes.set(id, catalog);
        }
        if (!changes.size) return;
        const liveTargets = this.catalogEditTargets(new Map([...live].filter(([id]) => changes.has(id))));
        const candidate = { ...this.state, drafts: [...this.state.drafts] };
        const writes: { owner: StoryDraft; row: StoryEntryDef; catalog: StoryEntryDef['catalog']; packId: string; path: ValuePath }[] = [];
        try {
          for (const [id, catalog] of changes) {
            const pack = liveTargets.get(id);
            const peer = live.get(id);
            if (!pack || pack.packRecordId !== editTargets.get(id)?.packRecordId || !peer) return '条目所属 Mod 已不再可编辑，请重新打开。';
            const ownerTable = peer.activation.kind === 'active' ? 'activeStories' : 'passiveStories';
            const owners = candidate.drafts.filter(item => item.authoring?.[ownerTable].some(row => row.id === id));
            if (owners.length > 1) return '条目在多个草稿中存在，请先处理冲突。';
            let owner: StoryDraft | undefined = owners[0];
            if (!owner) {
              const source = this.registry.stories.get(peer.storyId) ?? pack.datapack.stories.find(story => story.id === peer.storyId);
              if (!source || !selectStory(candidate, `source:${peer.storyId}`, new Map([[source.id, source]]))) return '找不到条目所属 Story。';
              owner = currentDraft(candidate);
              if (!owner) return '找不到条目所属草稿。';
              if (this.state.drafts.includes(owner)) {
                const position = candidate.drafts.indexOf(owner);
                owner = { ...owner };
                candidate.drafts[position] = owner;
              }
              hydrateStoryAuthoring(owner, this.registry);
            }
            const rowIndex = owner.authoring?.[ownerTable].findIndex(row => row.id === id) ?? -1;
            const row = owner.authoring?.[ownerTable][rowIndex];
            if (!row) return '找不到条目所属草稿。';
            if (this.state.sourceOptions && !owner.packSource) {
              owner.packSource = this.packSource(pack.packRecordId);
              owner.targetPackId = pack.packRecordId;
            }
            const checked = { ...row };
            if (catalog) checked.catalog = catalog;
            else delete checked.catalog;
            validateStoryAuthoringShape({ ...emptyStoryAuthoring(), [ownerTable]: [checked] }, true);
            writes.push({ owner, row, catalog, packId: pack.packRecordId, path: [ownerTable, rowIndex, 'catalog'] });
          }
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
        for (const write of writes) {
          if (write.catalog) write.row.catalog = write.catalog;
          else delete write.row.catalog;
          write.owner.targetPackId ??= write.packId;
          write.owner.dirty = true;
          const key = structuredKey(write.owner, scope, write.path);
          for (const input of Object.keys(write.owner.structuredInputs ?? {})) {
            if (input === key || input.startsWith(key.slice(0, -1) + ',')) delete write.owner.structuredInputs![input];
          }
        }
        this.state.drafts = candidate.drafts;
        this.requestRefresh();
      },
    });
  }

  private catalogEditTargets(entries: ReadonlyMap<string, StoryEntryDef>) {
    const packs = storyEditingMods(this.ctrl.game).flatMap(pack => {
      try {
        const { record } = storyEditingMod(this.ctrl.game, pack.packRecordId ?? pack.id);
        return [{ record, stories: new Set(record.datapack.stories.map(story => story.id)),
          entries: new Set([...(record.datapack.activeStories ?? []), ...(record.datapack.passiveStories ?? [])].map(row => row.id)) }];
      } catch {
        return [];
      }
    });
    const owners = new Map(this.state.drafts.flatMap(draft =>
      [...(draft.authoring?.activeStories ?? []), ...(draft.authoring?.passiveStories ?? [])].map(row => [row.id, draft] as const)));
    const targets = new Map<string, (typeof packs)[number]['record']>();
    for (const [id, row] of entries) {
      const owner = owners.get(id);
      const matches = packs.filter(pack => {
        if (this.state.sourceOptions && pack.record.packRecordId !== currentAuthoringDraft(this.state)?.targetPackId) return false;
        if (owner?.targetPackId && owner.targetPackId !== pack.record.packRecordId) return false;
        const mod = pack.record.manifest.modName;
        const ownsStory = pack.stories.has(row.storyId)
          || owner?.targetPackId === pack.record.packRecordId && row.storyId.startsWith(`${mod}:`);
        return (this.state.sourceOptions && pack.entries.has(id)) || ownsStory && (pack.entries.has(id) || owner?.document.id === row.storyId && id.startsWith(`${mod}:`));
      });
      if (matches.length === 1) targets.set(id, matches[0].record);
    }
    return targets;
  }

  private editChoiceCondition(trigger: HTMLButtonElement): void {
    const draft = currentDraft(this.state), node = currentNode(this.state);
    const path = this.parsePropertyPath(trigger.dataset.choiceCondition);
    if (!draft || node?.type !== 'click' || node.interaction.kind !== 'choice' || !path || this.writeBlocked) return;
    const listPath = ['interaction', 'options'];
    const rowId = trigger.dataset.choiceConditionRow;
    const original = readProperty(draft, node.id, path);
    const signature = JSON.stringify(original);
    const ctx = createUIContext(this.editorGame);
    this.editorDialog = openConditionTreeDialog(this.ctrl.modal, ctx, trigger, {
      original,
      label: '出现条件',
      plainRoot: true,
      targets: STORY_CONDITION_TARGETS,
      state: this.state,
      availableInits: draft.document.initId ? [draft.document.initId] : [],
      globalFlags: storyFlagNames(currentStoryFlagCatalog(ctx, this.state), 'global'),
      pendingValue: suffix => {
        const value = valueAt(original, suffix);
        return typeof value === 'string' ? value : undefined;
      },
      beforeRemove: element => this.ctrl.popovers.dismissBeforeRootMutation(element),
      onClose: () => { this.editorDialog = undefined; },
      commit: condition => {
        const current = currentNode(this.state);
        if (!this.isOpen() || this.writeBlocked || currentDraft(this.state) !== draft || current?.id !== node.id
          || current.type !== 'click' || current.interaction.kind !== 'choice') return '条件所属的选项已变化。';
        const index = current.interaction.options.findIndex((_, index) => rowIdAt(draft, node.id, listPath, index) === rowId);
        const nextPath = [...listPath, index, 'showWhen'];
        if (index < 0 || JSON.stringify(readProperty(draft, node.id, nextPath)) !== signature) return '条件已变化，请重新打开。';
        if (!editProperty(draft, node.id, nextPath, condition)) return '无法写入出现条件。';
        this.state.error = null;
        this.requestRefresh();
      },
    });
  }

  private editEntryCondition(trigger: HTMLButtonElement): void {
    const target = this.state.target;
    const draft = currentAuthoringDraft(this.state);
    if (target?.kind !== 'entry' || !draft?.authoring || this.writeBlocked) return;
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
    const ctx = createUIContext(this.editorGame);
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
        if (!this.isOpen() || this.writeBlocked || this.state.target?.kind !== 'entry'
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
    if (!draft || this.writeBlocked) return;
    const fromId=draft.document.id, mod=fromId.split(':')[0], e=createUIContext(this.editorGame).escapeHtml;
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
        const plan=planEditorStoryRename(this.state,id,selected.record.datapack,draft.draftId,to,new Set([...this.registry.stories.keys(),...knownModStoryIds(this.ctrl.game,mod)]));
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
        if(action!=='rename-story-id' || !this.isOpen() || currentDraft(this.state)!==draft || draft.document.id!==fromId)return;
        try {
          if (this.writeBlocked) throw new Error('目标 Mod 已变化，暂时无法保存。');
          if(!selected)throw new Error('请选择编辑态 Mod。');
          const packId=selected.record.packRecordId, live=storyEditingMod(this.ctrl.game,packId);
          if(live.entry.contentDigest!==selected.entry.contentDigest)throw new Error('目标 Mod 已变化，请重新选择 Mod 并核对引用。');
          const toId = toStoryId();
          const plan=planEditorStoryRename(this.state,packId,live.record.datapack,draft.draftId,toId,new Set([...this.registry.stories.keys(),...knownModStoryIds(this.ctrl.game,mod)]));
          if(plan.published){
            const result=this.ctrl.commands.renameStoryInPack?.(packId,{fromId,toId,expectedDigest:selected.entry.contentDigest ?? '',patch:plan.patch});
            if(!result?.ok)throw new Error(result?.message ?? '当前运行环境不支持包内更改 ID。');
          } else {
            const candidate={...this.state,drafts:plan.drafts,target:this.state.target ? {...this.state.target}:null,visits:this.state.visits.map(visit=>({...visit,target:{...visit.target}}))};
            acceptEditorStoryRename(candidate,plan.drafts,fromId,toId);
            if(!this.persist(candidate))throw new Error(candidate.error ?? '草稿保存失败，原 ID 已保留。');
          }
          this.closeAuthoringPreview();this.closeThemeContentEdit();this.closeSelectionNavi();this.requiredFlagDropdown.close();
          acceptEditorStoryRename(this.state,plan.drafts,fromId,toId);this.state.targetPackId=packId;
          if (plan.published && this.state.sourceOptions) this.refreshPackSource(packId, live.entry.contentDigest);
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
    if (this.writeBlocked && !['info', 'new', 'save'].includes(action)) return;
    if (action === 'save-to-runtime') { this.saveToRuntime(); return; }
    if (action === 'restore-source') { this.confirmRestoreSource(); return; }
    if (['new', 'delete-node', 'up', 'down', 'send', 'click', 'operation', 'transfer', 'moveToArea', 'moveToCharaspace'].includes(action)) this.state.notice = null;
    if (action === 'new') {
      this.createStoryInMod();
    } else if (action === 'rename-id') this.changeStoryId(trigger);
    else if (action === 'save') this.save(true, false);
    else if (action === 'choose-sender') {
      if (this.advanced) this.revealWorkspaceLeft();
      this.explorerState.auxiliaryTool = 'senders';
    }
    else if (action === 'info' || action === 'rename') {
      this.closeThemeContentEdit();
      this.rememberInspectorScroll();
      this.state.selectedNodeId = null;
      this.state.inspectorView = 'story';
      this.focusName = action === 'rename';
      if (action === 'rename') {
        this.state.storyInspectorTab = 'overview';
        if (this.advanced) {
          this.setWorkspaceView('three');
        }
      }
      this.restoreInspectorScroll();
    }
    else if (action === 'delete-node') deleteNode(this.state);
    else if (action === 'up' || action === 'down') moveNode(this.state, action === 'up' ? -1 : 1);
    else if (action === 'send' || action === 'click' || action === 'operation' || action === 'transfer' || action === 'moveToArea' || action === 'moveToCharaspace') {
      const added = appendNode(this.state, action === 'send' ? 'text' : action, storySenders(createUIContext(this.editorGame)));
      if (added) { this.state.inspectorView = 'node'; this.revealNodeId = added.id; }
    } else if (action === 'delete-draft') this.confirmDelete();
  }
  private confirmDelete(): void {
    const draft = currentDraft(this.state);
    if (!draft || !draft.persisted && !draft.dirty) return;
    this.ctrl.modal.open({ title: '删除草稿', body: '<p>删除这份本地草稿？已注册的来源 Story 会保留。</p>',
      footer: '<button class="modal-close">取消</button><button class="mini-action mini-action--danger" data-modal-action="delete-story-draft">删除草稿</button>',
      onAction: action => {
        if (action !== 'delete-story-draft' || this.writeBlocked || currentDraft(this.state) !== draft) return;
        const drafts = this.state.drafts;
        this.state.drafts = drafts.filter(item => item !== draft);
        if (!this.persist(this.state, true)) { this.state.drafts = drafts; this.ctrl.modal.close(); this.requestRefresh(); return; }
        delete this.state.composers[draft.draftId];
        this.state.target = null;
        this.state.selectedNodeId = null;
        this.state.insertionBeforeNodeId = null;
        if (draft.sourceId) this.selectDocument(`source:${draft.sourceId}`);
        this.ctrl.modal.close();
        this.requestRefresh();
      } });
  }

  private confirmRestoreSource(): void {
    const draft = currentDraft(this.state);
    if (!draft || this.writeBlocked) return;
    const storyId = draft.document.id;
    const escapedName = storyId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    this.ctrl.modal.open({ title: '还原来源版本', body: `<p>丢弃“${escapedName}”的本地草稿，并将当前运行中的 Story 还原到本次加载的数据包版本吗？没有来源版本的新建 Story 会从当前 Registry 移除。其他草稿和玩家存档不受影响。</p>`,
      footer: '<button type="button" class="modal-close">取消</button><button type="button" class="mini-action mini-action--danger" data-modal-action="restore-story-source">还原来源版本</button>',
      onAction: action => {
        if (action !== 'restore-story-source' || this.writeBlocked || currentDraft(this.state) !== draft) return;
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
        if (!this.persist(this.state, true)) {
          this.state.drafts = previousDrafts;
          this.state.target = previousTarget;
          this.state.selectedNodeId = previousSelectedNodeId;
          this.state.insertionBeforeNodeId = previousInsertionBeforeNodeId;
          if (previousComposer) this.state.composers[draft.draftId] = previousComposer;
          this.ctrl.modal.close();
          this.requestRefresh();
          return;
        }
        const result = draft.targetPackId
          ? this.ctrl.commands.restoreStoryDefinition(storyId, draft.targetPackId)
          : this.ctrl.commands.restoreStoryDefinition(storyId);
        if (!result.ok) {
          this.state.drafts = previousDrafts;
          this.state.target = previousTarget;
          this.state.selectedNodeId = previousSelectedNodeId;
          this.state.insertionBeforeNodeId = previousInsertionBeforeNodeId;
          if (previousComposer) this.state.composers[draft.draftId] = previousComposer;
          this.persist(this.state, true);
          this.state.error = result.message;
          this.ctrl.modal.close();
          this.requestRefresh();
          return;
        }
        if (result.operation === 'restore') this.selectDocument(`source:${storyId}`);
        this.state.error = null;
        this.state.notice = result.operation === 'restore'
          ? '已读取当前加载的数据包版本；本地草稿已丢弃。'
          : '本地草稿已丢弃；该 Story 已从当前运行 Registry 移除。';
        this.ctrl.modal.close();
        this.requestRefresh();
      } });
  }
}
