import type { UIController } from '../controller/controller';
import type { PanelState } from '../components/shared/app-shell';
import type { UIContext } from '../runtime/context';
import { createUIContext } from '../runtime/context';
import { renderWorkspaceFrame, workspaceColumns, type WorkspaceFrameSpec } from '../components/shared/workspace-frame';
import type { WorkspaceLocation, WorkspaceNavigationState } from '../workspace/workspace-router';
import { appendNode, composer, createStoryEditorState, currentDraft, currentNode, deleteNode, editNode, editNodeFlag, moveNode, newStory, renameStory, selectStory, storyDefinitionFromDraft } from './model';
import { StoryDraftPersistence } from './persistence';
import { createStoryEditorFrame, storySenders } from './view';
import { patchEditorDOM } from './dom';
import { addRow, editProperty, editStage, moveRowBy, readProperty, removeProperty, removeRow, selectBranch, selectDiscriminant, selectLiteralKind, selectNodeType, selectThemeScope, setNodeStage, toggleOptional, rowIdAt } from './property-model';
import type { Discriminator, LiteralKind, PropertyPath } from './property-model';

const DISCRIMINATORS: readonly string[] = ['kind', 'command', 'op', 'entryType', 'mode', 'valueKind', 'type'];
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
  private returnState?: { location: WorkspaceLocation; navigation?: WorkspaceNavigationState; workspace: PanelState['workspace']; mapEntrySource: PanelState['mapEntrySource']; init: string | null };
  private revealEnd = false;
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
    if (this.revealEnd) {
      const body = this.ctrl.root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body');
      if (body) body.scrollTop = body.scrollHeight;
      this.revealEnd = false;
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
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-action], [data-editor-story], [data-story-row-action], [data-story-condition-add], [data-story-init-branch], [data-story-init-condition], [data-story-init-object], [data-story-init-value], [data-story-create-stage], [data-story-remove-readonly]') : null;
      if (!element || !root.contains(element) || element instanceof HTMLButtonElement && element.disabled) { select(event); return; }
      const source = element.dataset.editorStory;
      if (source) {
        if (this.save(false, false)) { selectStory(this.state, source, this.ctrl.game.registry.stories); this.state.notice = null; }
      } else if (element.hasAttribute('data-story-remove-readonly')) this.removeReadonlyProperty(element);
      else if (element.dataset.storyRowAction || element.dataset.storyConditionAdd || element.dataset.storyInitBranch || element.dataset.storyInitCondition || element.dataset.storyInitObject !== undefined || element.dataset.storyInitValue || element.dataset.storyCreateStage !== undefined) this.propertyAction(element);
      else this.action(element.dataset.editorAction ?? '');
      this.requestRefresh();
    };
    const input = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      if (this.state.storageBlocked && !target.hasAttribute('data-editor-search')) return;
      const draft = currentDraft(this.state); const node = currentNode(this.state);
      const senders = storySenders(createUIContext(this.ctrl.game));
      if (target.hasAttribute('data-editor-search')) this.state.search = target.value;
      else if (target.hasAttribute('data-editor-composer-text')) composer(this.state).text = target.value;
      else if (target.hasAttribute('data-editor-composer-sender')) composer(this.state).sender = target.value;
      else if (target.dataset.editorField === 'name') renameStory(this.state, target.value);
      else if (target.dataset.editorField === 'text' || target.dataset.editorField === 'sender') editNode(this.state, target.dataset.editorField, target.value, senders);
      else if (target.dataset.editorField && ['requires-flag', 'local-flag-op', 'local-flag-name', 'local-flag-type', 'local-flag-value'].includes(target.dataset.editorField)) editNodeFlag(this.state, target.dataset.editorField, target.value);
      else if (target instanceof HTMLSelectElement && target.hasAttribute('data-story-node-type')) {
        if (draft && node) selectNodeType(draft, node.id, target.value as 'talklet' | 'click' | 'operation' | 'transfer');
      } else if (target instanceof HTMLSelectElement && target.hasAttribute('data-story-theme-scope-path')) {
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
    root.addEventListener('click', click);
    root.addEventListener('contextmenu', select);
    root.addEventListener('input', input);
    root.addEventListener('change', input);
    return () => {
      root.removeEventListener('click', click); root.removeEventListener('contextmenu', select);
      root.removeEventListener('input', input); root.removeEventListener('change', input);
    };
  }
  private parsePropertyPath(raw?: string): PropertyPath | null {
    if (!raw) return null;
    try { const value: unknown = JSON.parse(raw); return Array.isArray(value) && value.every(part => typeof part === 'string' || typeof part === 'number') ? value as PropertyPath : null; }
    catch { return null; }
  }
  private editStoryProperty(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
    const draft=currentDraft(this.state); const node=currentNode(this.state); const path=this.parsePropertyPath(target.dataset.storyPropertyPath);
    if(!draft||!node||!path)return;
    if(path.length===1&&path[0]==='stageId') { if(target instanceof HTMLSelectElement&&target.value) setNodeStage(draft,node.id,target.value); return; }
    if(path.length===3&&path[0]==='stages'&&path[2]==='advance') { editStage(draft,node.id,String(path[1]),target.value as 'auto'|'input'); return; }
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
    if(element.dataset.storyCreateStage!==undefined) {
      const input=element.closest<HTMLElement>('[data-story-node-properties]')?.querySelector<HTMLInputElement>('[data-story-stage-name]');
      const stageId=input?.value.trim();
      if(stageId) {
        const owner=node.type==='talklet'||node.type==='click'?node.stageId:undefined;
        const current=typeof owner==='string'?draft.document.stages[owner]?.advance:'auto';
        editStage(draft,node.id,stageId,current==='input'?'input':'auto');
      }
      return;
    }
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
    if (['new', 'delete-node', 'up', 'down', 'send', 'click', 'operation', 'transfer'].includes(action)) this.state.notice = null;
    if (action === 'new') {
      if (this.save(false, false)) newStory(this.state);
    } else if (action === 'save') this.save(true, false);
    else if (action === 'info' || action === 'rename') { this.state.selectedNodeId = null; this.focusName = action === 'rename'; }
    else if (action === 'delete-node') deleteNode(this.state);
    else if (action === 'up' || action === 'down') moveNode(this.state, action === 'up' ? -1 : 1);
    else if (action === 'send' || action === 'click' || action === 'operation' || action === 'transfer') {
      const added = appendNode(this.state, action === 'send' ? 'text' : action, storySenders(createUIContext(this.ctrl.game)));
      if (added) this.revealEnd = true;
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
        if (draft.sourceId) selectStory(this.state, `source:${draft.sourceId}`, this.ctrl.game.registry.stories);
        this.ctrl.modal.close();
        this.requestRefresh();
      } });
  }
}
