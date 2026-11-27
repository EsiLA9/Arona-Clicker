import type { StoryAuthoringPatch } from '../../data-services/authoring/story-authoring';
import type { StructuredInputs } from './structured-value';
import type { StoryDef } from '../../data-services/contracts/story';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { StoryNode, StoryOperationNode, StoryTransferNode, StoryTalkletNode, StoryMoveToAreaNode, StoryMoveToCharaspaceNode } from '../../data-services/contracts/story-node';
import { isStoryLocalFlagAction, validStoryFlagName } from '../../data-services/validation/story-run-flags';
import { localFlagAction, localFlagInput, parseLocalFlagInput, type LocalFlagInputs, type LocalFlagInput } from './flag-fields';
import { projectStoryDefinition, stripLegacyStoryReplies } from '../../data-services/authoring/story-definition-projection';
import { applyLiteralKinds, liftLegacyStoryDesign, restoreStoryDraftDesign, clearNodeEditorState, hasActiveStructuredErrors, editProperty as editStoryProperty, removeProperty, missingEnabledOptionalIssues, readProperty as readStoryProperty, selectDiscriminant } from './property-model';

export type StoryDraftNode = Exclude<StoryNode, StoryOperationNode | StoryTransferNode | StoryMoveToAreaNode | StoryMoveToCharaspaceNode>
  | (Omit<StoryOperationNode, 'action'> & { action?: StoryOperationNode['action'] })
  | (Omit<StoryTransferNode, 'transfer'> & { transfer?: StoryTransferNode['transfer'] })
  | (Omit<StoryMoveToAreaNode, 'areaId'> & { areaId?: StoryMoveToAreaNode['areaId'] })
  | (Omit<StoryMoveToCharaspaceNode, 'characterId'> & { characterId?: StoryMoveToCharaspaceNode['characterId'] });
export type StoryDraftDocument = Omit<StoryDef, 'nodes' | 'startContext'> & { nodes: StoryDraftNode[]; startContext?: StoryDef['startContext'] };
export interface StoryEditorDraftState {
  version: 1;
  branches: Record<string, unknown>;
  optionals: Record<string, boolean | string>;
  optionalPaths: Record<string, readonly (string | number)[]>;
  optionalBranches: Record<string, readonly { path: readonly string[]; discriminator: 'kind' | 'command' | 'op' | 'entryType' | 'mode' | 'valueKind' | 'type' | 'entityKind'; value: string }[]>;
  rows: Record<string, string[]>;
  rawInputs: Record<string, string>;
  /** Author-chosen literal type for flag/extra values; projected into the candidate only at submit time. */
  literalKinds?: Record<string, 'string' | 'number' | 'boolean'>;
  /** Stage declarations imported without a referencing node are source diagnostics, not disposable cache. */
  sourceStageIds?: string[];
  sourceUnreferencedStageIds?: string[];
  /** A stage made temporarily unused by an explicit type switch can remain local to the draft. */
  inactiveStageIds?: string[];
}
export interface StoryDraft {
  draftId: string;
  sourceId: string | null;
  /** The chosen editing record owns new content independently of the current UI selection. */
  targetPackId?: string;
  packSource?: import('../../arona-clicker/contracts/runtime/runtime').StoryPackSource & { label: string; digest?: string };
  /** The exact dependency view that produced an unmodified, read-only document. */
  viewSource?: string;
  entryOnly?: string;
  renamedFromId?: string;
  document: StoryDraftDocument;
  savedAt: number | null;
  dirty: boolean;
  persisted: boolean;
  /** Draft-only raw values; invalid numeric input must never publish its last valid value. */
  localFlagInputs?: LocalFlagInputs;
  /** Draft-only bounded cache. Never projected into a StoryDef. */
  editorState?: StoryEditorDraftState;
  /** Transient diagnostics are recalculated from active input and are never persisted. */
  editorIssues?: StoryDraftProjectionIssue[];
  authoring?: StoryAuthoringPatch;
  structuredInputs?: StructuredInputs;
  structuredRows?: Record<string,string[]>;
  /** Per-call Entry flag information choices; never part of authored runtime content. */
  flagImports?: Record<string, boolean>;
}
export interface StoryComposer { sender: string; text: string }
export type StoryEditorTarget = { kind: 'story'; id: string } | { kind: 'entry'; id: string };
export interface StoryEditorVisit {
  target: StoryEditorTarget;
  selectedNodeId: string | null;
  insertionBeforeNodeId: string | null;
  centerScroll: number;
  rightScroll: number;
}
export interface StoryBrowseViewState {
  sourceSelection?: string;
  targetPackId?: string;
  target: StoryEditorTarget | null;
  visits: StoryEditorVisit[];
  visitIndex: number;
  selectedNodeId: string | null;
  /** Transient gap anchor before a node; null means the end of the current Story. */
  insertionBeforeNodeId: string | null;
  inspectorView?: 'story' | 'node';
  nodeDesignerTab?: 'basic' | 'appearance' | 'performance';
  storyInspectorTab: 'overview' | 'relations' | 'flags' | 'tools';
  entryEditorTab?: 'basic' | 'rewards' | 'gates';
  notice?: string | null;
  error: string | null;
}
export interface StoryEditorState extends StoryBrowseViewState {
  sourceRegistry?: import('../../arona-clicker/contracts/runtime/content-catalog').ContentCatalogQueryPort;
  sourcePics?: import('../../arona-clicker/contracts/runtime/runtime').GameReadModel['pics'];
  sourceOptions?: { value: string; label: string; group: 'packs' | 'drafts' }[];
  sourceWarning?: string;
  sourceMod?: string;
  readOnlyReason?: string;
  canApplySource?: boolean;
  parkedDrafts?: StoryDraft[];
  drafts: StoryDraft[];
  /** Session-only positioned previews, independently toggled per draft and node. */
  performanceEditing?: Record<string, string[]>;
  sidebarMode: 'all' | 'stories' | 'entries' | 'senders';
  sidebarDirectoryMode?: 'all' | 'stories' | 'entries';
  sidebarFiltersOpen?: boolean;
  sidebarRuntimeScope?: string;
  sidebarSourceSelection?: string;
  sidebarSource?: Pick<StoryEditorState, 'drafts' | 'sourceRegistry' | 'sourcePics' | 'sourceMod' | 'sourceWarning'>;
  directoryManagement?: ReturnType<typeof import('./directory-management').createStoryDirectoryManagement>;
  storyInitFilter?: string;
  composers: Record<string, StoryComposer>;
  storageBlocked: boolean;
  copyStoryId?: string;
  previewEntryByDraft?: Map<string, string>;
  entryPoolContext?: { entryId: string; poolKeys: string[] };
  preview?: {
    playback: import('../../arona-clicker/contracts/runtime/story-presentation').StoryPresentationView | null;
    story: import('../../arona-clicker/contracts/runtime/results').StoryView | null;
    projection: import('../../arona-clicker/contracts/runtime/story-authoring').StoryAuthoringPreviewProjection | null;
    decisions: import('../../arona-clicker/contracts/runtime/story-authoring').StoryPreviewDecisions;
    send: import('../../arona-clicker/contracts/runtime/results').SendState;
    selections?: Record<string, import('../../arona-clicker/contracts/runtime/story-authoring').StoryPreviewDecision>;
    collapsedCheck?: string;
    error?: string;
  };
  themeContentEdit?: { session: import('../../arona-clicker/services/presentation/theme-content-editor-service').ThemeContentEditSession; draft: import('../../arona-clicker/services/presentation/theme-content-editor-service').EditableThemeContent; previewing: boolean; rows: Record<string,string[]>; error?: string };
}
export interface StorySender { id: string; label: string; speaker?: string }
export interface StoryListItem { key: string; name: string; storyId: string; initId?: string; draft?: StoryDraft }
export interface StoryChoiceFlagBinding { flagName: string; nodeIds: string[] }
export type StoryChoiceFlagBindResult = { ok: true; flagName: string; created: boolean } | { ok: false; reason: string };
export type StoryFlagReaderBindResult = { ok: true; flagName: string; changed: boolean } | { ok: false; reason: string };

export const cloneStory = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const NUMBER_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const identity = (prefix: string): string => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
export function createStoryBrowseViewState(): StoryBrowseViewState {
  return { sourceSelection: undefined, targetPackId: undefined, target: null, visits: [], visitIndex: -1,
    selectedNodeId: null, insertionBeforeNodeId: null, inspectorView: 'story', nodeDesignerTab: 'basic',
    storyInspectorTab: 'overview', entryEditorTab: 'basic', notice: null, error: null };
}
export function createStoryEditorState(): StoryEditorState {
  return { ...createStoryBrowseViewState(), drafts: [], sidebarMode: 'all',
    composers: Object.create(null), storageBlocked: false };
}
export function currentDraft(state: StoryEditorState): StoryDraft | undefined {
  const target = state.target;
  return target?.kind === 'story' ? state.drafts.find(draft => !draft.entryOnly && draft.document.id === target.id) : undefined;
}
/** Entry forms edit the existing owner draft while the viewing target stays an Entry. */
export function currentAuthoringDraft(state: StoryEditorState): StoryDraft | undefined {
  const target = state.target;
  if (target?.kind !== 'entry') return currentDraft(state);
  return state.drafts.find(draft => draft.entryOnly === target.id)
    ?? [...state.drafts].reverse().find(draft => [...(draft.authoring?.activeStories ?? []), ...(draft.authoring?.passiveStories ?? [])].some(entry => entry.id === target.id));
}
export function storyEditorTargetKey(state: StoryEditorState): string {
  const key = state.target ? `${state.target.kind}:${state.target.id}` : '';
  return state.sourceSelection ? `${state.sourceSelection}:${key}` : key;
}

export function storyPreviewEntries(state: StoryEditorState, draft: StoryDraft, sources: ReadonlyMap<string, StoryEntryDef>) {
  const entries = [...storyEntries(state, sources).values()].filter(entry => entry.storyId === draft.document.id);
  const remembered = state.previewEntryByDraft?.get(draft.draftId);
  const entryId = remembered !== undefined && (remembered === '' || entries.some(entry => entry.id === remembered))
    ? remembered : entries[0]?.id ?? '';
  return { entries, entryId };
}
export function storyEntries(state: StoryEditorState, sources: ReadonlyMap<string, StoryEntryDef>): ReadonlyMap<string, StoryEntryDef> {
  const entries = new Map(sources);
  for (const draft of [...state.drafts.filter(item => !item.entryOnly), ...state.drafts.filter(item => item.entryOnly)]) {
    for (const id of [...(draft.authoring?.removed?.activeStories ?? []), ...(draft.authoring?.removed?.passiveStories ?? [])]) entries.delete(id);
    for (const entry of [...(draft.authoring?.activeStories ?? []), ...(draft.authoring?.passiveStories ?? [])]) entries.set(entry.id, entry);
  }
  return entries;
}
export function currentNode(state: StoryEditorState): StoryDraftNode | undefined {
  return currentDraft(state)?.document.nodes.find(node => node.id === state.selectedNodeId);
}
/** Narrow draft-only missing payloads before crossing the typed Runtime command. */
export interface StoryDraftProjectionIssue { path: string; message: string; nodeId?: string; removable?: boolean }
export type StoryDraftProjectionResult = { ok: true; story: StoryDef } | { ok: false; message: string; issues: readonly StoryDraftProjectionIssue[] };
function choiceDraftIssues(document: unknown): StoryDraftProjectionIssue[] {
  const root = mutableRecord(document) ? document : undefined;
  const nodes = Array.isArray(root?.nodes) ? root.nodes : [];
  const issues: StoryDraftProjectionIssue[] = [];
  const markOwners = new Map<string, { nodeIndex: number; nodeId: string }>();
  for (const [nodeIndex, rawNode] of nodes.entries()) {
    if (!mutableRecord(rawNode) || rawNode.type !== 'click' || !mutableRecord(rawNode.interaction)) continue;
    if (rawNode.interaction.kind === 'button' && Object.prototype.hasOwnProperty.call(rawNode.interaction, 'result')) issues.push({
      path: `nodes[${nodeIndex}].interaction.result`, message: '旧按钮 result 不再执行；请先移至后续节点，再显式移除。',
    });
    if (rawNode.interaction.kind !== 'choice') continue;
    const interaction = rawNode.interaction;
    if (Object.prototype.hasOwnProperty.call(interaction, 'sharedActions')) issues.push({
      path: `nodes[${nodeIndex}].interaction.sharedActions`, message: '旧 Choice sharedActions 不支持；请在属性栏显式移除后再保存。',
    });
    if (!Array.isArray(interaction.options)) continue;
    for (const [optionIndex, rawOption] of interaction.options.entries()) {
      if (!mutableRecord(rawOption)) continue;
      const optionPath = `nodes[${nodeIndex}].interaction.options[${optionIndex}]`;
      if (Object.prototype.hasOwnProperty.call(rawOption, 'condition')) issues.push({
        path: `${optionPath}.condition`, message: '旧 Choice condition 的禁用语义与 showWhen 的隐藏语义不同；请显式移除或重新配置。',
      });
      if (Object.prototype.hasOwnProperty.call(rawOption, 'result')) issues.push({
        path: `${optionPath}.result`, message: '旧 Choice result 不再执行；请先处理其中的动作或转移，再显式移除。',
      });
      if (!Array.isArray(rawOption.marks)) continue;
      for (const name of rawOption.marks) {
        if (typeof name !== 'string' || !name) continue;
        const previous = markOwners.get(name);
        if (previous && previous.nodeIndex !== nodeIndex) issues.push({
          path: `${optionPath}.marks`, removable: false,
          message: `局部选择标记「${name}」已由 Choice「${previous.nodeId}」提供；请为复制的 Choice 改名或移除该标记。`,
        });
        else markOwners.set(name, { nodeIndex, nodeId: String(rawNode.id ?? nodeIndex) });
      }
    }
  }
  return issues;
}
/** Rebuild and validate only active draft content. Side caches and raw buffers never cross this boundary. */
export function storyDefinitionFromDraft(draft: StoryDraft): StoryDraftProjectionResult;
/** E0 compatibility entry point. New callers should pass the whole draft to include editorState. */
export function storyDefinitionFromDraft(document: StoryDraftDocument, localFlagInputs?: LocalFlagInputs, editorState?: StoryEditorDraftState): StoryDraftProjectionResult;
export function storyDefinitionFromDraft(input: StoryDraft | StoryDraftDocument, legacyFlags?: LocalFlagInputs, legacyEditorState?: StoryEditorDraftState): StoryDraftProjectionResult {
  const draft = 'document' in input ? input : undefined;
  const document = (draft?.document ?? input) as unknown as Record<string, unknown>;
  const localFlagInputs = draft?.localFlagInputs ?? legacyFlags;
  const editorState = draft?.editorState ?? legacyEditorState;
  if (draft) {
    const optionalIssues = missingEnabledOptionalIssues(draft);
    if (optionalIssues.length) {
      draft.editorIssues = optionalIssues.map(issue => ({ ...issue, nodeId: draft.document.nodes[Number(issue.path.match(/^nodes\[(\d+)\]/)?.[1])]?.id }));
      return { ok: false, message: `${optionalIssues[0].path}：${optionalIssues[0].message}`, issues: optionalIssues };
    }
  }
  if (draft && hasActiveStructuredErrors(draft)) {
    return { ok: false, message: '结构化值仍有无效输入，请先修正。', issues: [{ path: '$', message: '结构化值仍有无效输入' }] };
  }
  const choiceIssues = choiceDraftIssues(document);
  if (choiceIssues.length) {
    const issues = choiceIssues.map(issue => ({ ...issue, nodeId: draft?.document.nodes[Number(issue.path.match(/^nodes\[(\d+)\]/)?.[1])]?.id }));
    if (draft) draft.editorIssues = issues;
    return { ok: false, message: `${issues[0].path}：${issues[0].message}`, issues };
  }
  const candidate = cloneStory(document) as Record<string, unknown>;
  stripLegacyStoryReplies(candidate);
  const nodes = Array.isArray(candidate.nodes) ? candidate.nodes as Record<string, unknown>[] : [];
  const activeStages = new Set<string>();
  for (const [index, node] of nodes.entries()) {
    if (!node || typeof node !== 'object') continue;
    liftLegacyStoryDesign(node);
    const appearance = node.appearance as Record<string, unknown> | undefined;
    const performance = node.performance as Record<string, unknown> | undefined;
    if (node.type === 'click') {
      if (appearance) { delete appearance.presentation; delete appearance.template; }
      if (performance) delete performance.pacing;
    } else if (node.type === 'talklet') {
      const content = node.content as { kind?: string } | undefined;
      const dialogue = appearance?.presentation as { side?: string } | undefined;
      if (performance && (content?.kind !== 'talk' || dialogue?.side === 'right')) delete performance.pacing;
    } else {
      delete node.appearance;
      delete node.performance;
    }
    for (const [key, group, fields] of [
      ['appearance', appearance, ['presentation', 'style']],
      ['performance', performance, ['pacing']],
    ] as const) {
      if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
      for (const field of fields) {
        const value = group[field];
        if (value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) delete group[field];
      }
      if (!Object.keys(group).length) delete node[key];
    }
    if (node.type === 'talklet' || node.type === 'click') if (typeof node.stageId === 'string') activeStages.add(node.stageId);
    if (node.type === 'operation' && node.action && typeof node.action === 'object') {
      const action = node.action as Record<string, unknown>;
      if (action.kind === 'localFlag') {
        const inputValue = localFlagInputs && Object.prototype.hasOwnProperty.call(localFlagInputs, String(node.id)) ? localFlagInputs[String(node.id)] : undefined;
        if (action.op === 'set' && inputValue) {
          const parsed = parseLocalFlagInput(inputValue);
          if (!parsed.ok) {
            const issues = [{ path: `nodes[${index}].action.value`, message: '局部标记值尚未填写完整' }];
            if (draft) draft.editorIssues = issues.map(issue => ({ ...issue, nodeId: draft.document.nodes[index]?.id }));
            return { ok: false, message: `nodes[${index}].action.value：局部标记值尚未填写完整。`, issues };
          }
          action.value = parsed.value;
        }
        if (!isStoryLocalFlagAction(action as never)) {
          const issues = [{ path: `nodes[${index}].action`, message: '请补齐局部标记名称与合法值' }];
          if (draft) draft.editorIssues = issues.map(issue => ({ ...issue, nodeId: draft.document.nodes[index]?.id }));
          return { ok: false, message: `nodes[${index}].action：请补齐局部标记名称与合法值。`, issues };
        }
      }
    }
  }
  const stages = candidate.stages && typeof candidate.stages === 'object' ? candidate.stages as Record<string, unknown> : {};
  const intentionallyInactive = new Set(editorState?.inactiveStageIds ?? []);
  const sourceStages = new Set(editorState?.sourceUnreferencedStageIds ?? []);
  // Preserve source compatibility metadata unless the author explicitly made that stage inactive.
  // Stage declarations no longer encode playback grouping or block an otherwise valid free node flow.
  candidate.stages = Object.fromEntries(Object.entries(stages).filter(([id]) =>
    activeStages.has(id) || sourceStages.has(id) && !intentionallyInactive.has(id)));
  const coerceNumbers = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(coerceNumbers);
    if (!value || typeof value !== 'object') return value;
    const source = value as Record<string, unknown>;
    const conditionLeaf = typeof source.target === 'string' && typeof source.comparator === 'string';
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      const numericKey = ['typing', 'thinking', 'x', 'y', 'base', 'rand', 'amount'].includes(key) || key === 'value' && conditionLeaf;
      if (typeof child === 'string' && numericKey && NUMBER_TEXT.test(child) && Number.isFinite(Number(child))) out[key] = Number(child);
      else out[key] = coerceNumbers(child);
    }
    return out;
  };
  if (draft) applyLiteralKinds(draft, candidate);
  const projected = projectStoryDefinition(coerceNumbers(candidate));
  if (!projected.ok) {
    const first = projected.issues[0];
    if (draft) draft.editorIssues = projected.issues.map(issue => ({ ...issue, nodeId: draft.document.nodes[Number(issue.path.match(/^nodes\[(\d+)\]/)?.[1])]?.id }));
    return { ok: false, message: `${first?.path ?? 'Story'}：${first?.message ?? 'Story 定义无效'}`, issues: projected.issues };
  }
  if (draft) draft.editorIssues = [];
  return { ok: true, story: projected.story };
}
export function composer(state: StoryEditorState): StoryComposer {
  const draft = currentDraft(state);
  return draft ? state.composers[draft.draftId] ??= { sender: 'narrator', text: '' } : { sender: 'narrator', text: '' };
}
export function storyList(state: StoryEditorState, sources: ReadonlyMap<string, StoryDef>, query = ''): StoryListItem[] {
  const drafts = state.drafts.filter(draft => !draft.entryOnly);
  const entries = [...sources.values()].map(source => {
    const draft = drafts.find(item => item.sourceId === source.id || item.document.id === source.id);
    const story = draft?.document ?? source;
    return { key: draft?.draftId ?? `source:${source.id}`, name: story.name, storyId: story.id, initId: story.initId, draft };
  });
  for (const draft of drafts) {
    if (!entries.some(item=>item.draft===draft)) entries.push({ key: draft.draftId, name: draft.document.name, storyId: draft.document.id, initId: draft.document.initId, draft });
  }
  const search = query.trim().toLocaleLowerCase();
  return entries.filter(item => !search || `${item.name}\n${item.storyId}`.toLocaleLowerCase().includes(search));
}
export function selectStory(state: StoryEditorState, key: string, sources: ReadonlyMap<string, StoryDef>): boolean {
  let draft = state.drafts.find(item => !item.entryOnly && item.draftId === key);
  if (!draft && key.startsWith('source:')) {
    const source = sources.get(key.slice(7));
    if (!source) return false;
    draft = state.drafts.find(item => !item.entryOnly && (item.sourceId === source.id || item.document.id === source.id));
    if (!draft) {
      const document = cloneStory({ ...source, nodes: [...source.nodes] }) as StoryDraftDocument;
      stripLegacyStoryReplies(document);
      draft = { draftId: state.sourceOptions ? identity('draft') : `source:${source.id}`, sourceId: source.id, document, savedAt: null, dirty: false, persisted: false,
        editorState: { version: 1, branches: Object.create(null), optionals: Object.create(null), optionalPaths: Object.create(null), optionalBranches: Object.create(null), rows: Object.create(null), rawInputs: Object.create(null), sourceStageIds: Object.keys(source.stages ?? {}),
          sourceUnreferencedStageIds: Object.keys(source.stages ?? {}).filter(id => !source.nodes.some(node => (node.type === 'talklet' || node.type === 'click') && node.stageId === id)), inactiveStageIds: [] } };
      restoreStoryDraftDesign(draft);
      state.drafts.push(draft);
    }
  }
  if (!draft) return false;
  state.target = { kind: 'story', id: draft.document.id };
  state.selectedNodeId = null;
  state.insertionBeforeNodeId = null;
  return true;
}
export function newStory(state: StoryEditorState, modId = 'local', existing: Iterable<string> = [], targetPackId?: string): StoryDraft {
  if (!/^[a-z0-9_-]+$/.test(modId)) throw new Error('Mod ID 无效。');
  const prefix = `${modId}:story:story_`;
  const ids = new Set([...existing,...state.drafts.map(draft=>draft.document.id)]);
  let maximum = 0;
  for (const id of ids) if (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))) {
    const number = Number(id.slice(prefix.length));
    if (Number.isSafeInteger(number)) maximum = Math.max(maximum,number);
  }
  if (!Number.isSafeInteger(maximum + 1)) throw new Error('Story 编号已超出可用范围。');
  const draft: StoryDraft = { draftId: identity('draft'), sourceId: null, ...(targetPackId ? {targetPackId} : {}), document: { id: `${prefix}${maximum + 1}`, name: '未命名 Story', nodes: [], stages: {} }, dirty: true, persisted: false, savedAt: null };
  state.drafts.push(draft);
  state.target = { kind: 'story', id: draft.document.id };
  state.selectedNodeId = null;
  state.insertionBeforeNodeId = null;
  return draft;
}
export function renameStory(state: StoryEditorState, name: string): void {
  const draft = currentDraft(state);
  if (!draft || draft.document.name === name) return;
  draft.document = { ...draft.document, name };
  draft.dirty = true;
}
/** Select a transient insertion gap. The anchor is stable across insertions and node reordering. */
export function setInsertionPoint(state: StoryEditorState, beforeNodeId: string | null): boolean {
  const nodes = currentDraft(state)?.document.nodes;
  if (!nodes || beforeNodeId !== null && !nodes.some(node => node.id === beforeNodeId)) return false;
  state.insertionBeforeNodeId = beforeNodeId;
  return true;
}
export function insertAtCurrentPoint(state: StoryEditorState, draft: StoryDraft, node: StoryDraftNode): boolean {
  const nodes = [...draft.document.nodes];
  let insertionIndex = state.insertionBeforeNodeId === null ? nodes.length : nodes.findIndex(item => item.id === state.insertionBeforeNodeId);
  if (insertionIndex < 0) { insertionIndex = nodes.length; state.insertionBeforeNodeId = null; }
  nodes.splice(insertionIndex, 0, node);
  draft.document = { ...draft.document, nodes };
  draft.dirty = true;
  state.selectedNodeId = node.id;
  return true;
}
const nodeIdPrefixes = { text: 'talk', click: 'click', operation: 'operation', transfer: 'transfer', moveToArea: 'move-area', moveToCharaspace: 'move-chara' } as const;
export function storyNodeIdsInUse(draft: StoryDraft): Set<string> {
  const used = new Set(draft.document.nodes.map(node => node.id));
  const editor = draft.editorState;
  for (const bucket of [editor?.branches,editor?.optionals,editor?.optionalPaths,editor?.optionalBranches,editor?.rows,editor?.rawInputs,editor?.literalKinds,draft.structuredInputs]) {
    for (const key of Object.keys(bucket ?? {})) used.add(key.split('|')[0]);
  }
  for (const id of Object.keys(draft.localFlagInputs ?? {})) used.add(id);
  return used;
}
function nextStoryNodeId(draft: StoryDraft, kind: keyof typeof nodeIdPrefixes): string {
  const used = storyNodeIdsInUse(draft), prefix = nodeIdPrefixes[kind];
  let index = 1;
  while (used.has(`${prefix}-${String(index).padStart(3,'0')}`)) index++;
  return `${prefix}-${String(index).padStart(3,'0')}`;
}
export function appendNode(state: StoryEditorState, kind: 'text' | 'click' | 'operation' | 'transfer' | 'moveToArea' | 'moveToCharaspace', senders: readonly StorySender[]): StoryDraftNode | undefined {
  const draft = currentDraft(state);
  if (!draft) return;
  const input = composer(state);
  const id = nextStoryNodeId(draft,kind);
  const stageId = identity('stage');
  let node: StoryDraftNode;
  if (kind === 'text') {
    if (!input.text.trim()) return;
    const sender = senders.find(item => item.id === input.sender);
    if (!sender) return;
    node = { id, type: 'talklet', stageId, content: sender.id === 'narrator' ? { kind: 'narration', text: input.text }
      : { kind: 'talk', ...(sender.id.startsWith('character:') ? { characterId: sender.id.slice('character:'.length) } : { speaker: sender.speaker }), text: input.text }, ...(sender.id === 'narrator' ? {} : { appearance: { presentation: { side: sender.id === 'teacher' ? 'right' : 'left' } } }) };
    input.text = '';
  } else if (kind === 'click') node = { id, type: 'click', stageId, interaction: { kind: 'button', text: '' } };
  else node = { id, type: kind };
  const stages: StoryDraftDocument['stages'] = (kind === 'text' || kind === 'click')
    ? { ...draft.document.stages, [stageId]: { advance: kind === 'click' ? 'input' as const : 'auto' as const } }
    : draft.document.stages;
  draft.document = { ...draft.document, stages };
  insertAtCurrentPoint(state, draft, node);
  return node;
}
export function senderForNode(node: StoryTalkletNode, senders: readonly StorySender[]): string {
  if (node.content.kind === 'narration') return 'narrator';
  const characterId = node.content.characterId;
  if (characterId !== undefined) return senders.find(sender => sender.id === `character:${characterId}`)?.id ?? 'original';
  if ((node.appearance?.presentation ?? node.presentation)?.side === 'right' && node.content.speaker === '老师') return 'teacher';
  const speaker = node.content.speaker;
  return senders.find(sender => sender.id !== 'teacher' && sender.speaker === speaker && (node.appearance?.presentation ?? node.presentation)?.side !== 'right')?.id ?? 'original';
}
export function senderChangeAllowed(_node: StoryTalkletNode, sender: StorySender): boolean {
  return Boolean(sender.id);
}
export function editNode(state: StoryEditorState, field: 'text' | 'sender', value: string, senders: readonly StorySender[]): boolean {
  const draft = currentDraft(state);
  const node = currentNode(state);
  if (!draft || !node) return false;
  let next: StoryDraftNode = node;
  if (node.type === 'talklet') {
    if (field === 'text') next = { ...node, content: { ...node.content, text: value } };
    else {
      const sender = value === 'anonymous' ? { id: 'anonymous', label: '不指定角色' } : senders.find(item => item.id === value);
      if (!sender || !senderChangeAllowed(node, sender)) return false;
      const oldText = node.content.text;
      if (!selectDiscriminant(draft, node.id, ['content'], 'kind', sender.id === 'narrator' ? 'narration' : 'talk')) return false;
      if (readStoryProperty(draft, node.id, ['content', 'text']) === undefined) editStoryProperty(draft, node.id, ['content', 'text'], oldText);
      if (sender.id !== 'narrator') {
        if (sender.id.startsWith('character:')) {
          editStoryProperty(draft, node.id, ['content', 'characterId'], sender.id.slice('character:'.length));
          removeProperty(draft, node.id, ['content', 'speaker']);
        } else {
          removeProperty(draft, node.id, ['content', 'characterId']);
          if (sender.id==='anonymous') removeProperty(draft,node.id,['content','speaker']);
          else editStoryProperty(draft, node.id, ['content', 'speaker'], sender.speaker ?? '');
        }
        editStoryProperty(draft, node.id, ['appearance', 'presentation', 'side'], sender.id === 'teacher' ? 'right' : 'left');
      }
      const active = currentNode(state);
      if (active?.type !== 'talklet') return false;
      next = active;
    }
  } else if (node.type === 'click' && node.interaction.kind === 'button' && field === 'text') next = { ...node, interaction: { ...node.interaction, text: value } };
  else return false;
  draft.document = { ...draft.document, nodes: draft.document.nodes.map(item => item.id === node.id ? next : item) };
  draft.dirty = true;
  return true;
}
export function moveNode(state: StoryEditorState, delta: -1 | 1): boolean {
  const draft = currentDraft(state);
  if (!draft) return false;
  const nodes = [...draft.document.nodes];
  const index = nodes.findIndex(node => node.id === state.selectedNodeId);
  if (index < 0 || index + delta < 0 || index + delta >= nodes.length) return false;
  [nodes[index], nodes[index + delta]] = [nodes[index + delta], nodes[index]];
  draft.document = { ...draft.document, nodes };
  draft.dirty = true;
  return true;
}
/** Move a node immediately before a stable node anchor, or to the end when the anchor is null. */
export function moveNodeToInsertionPoint(state: StoryEditorState, nodeId: string, beforeNodeId: string | null): boolean {
  const draft = currentDraft(state);
  if (!draft) return false;
  const nodes = [...draft.document.nodes];
  const sourceIndex = nodes.findIndex(node => node.id === nodeId);
  if (sourceIndex < 0 || beforeNodeId === nodeId || beforeNodeId !== null && !nodes.some(node => node.id === beforeNodeId)) return false;
  const [moving] = nodes.splice(sourceIndex, 1);
  const insertionIndex = beforeNodeId === null ? nodes.length : nodes.findIndex(node => node.id === beforeNodeId);
  nodes.splice(insertionIndex < 0 ? nodes.length : insertionIndex, 0, moving);
  const changed = nodes.some((node, index) => node.id !== draft.document.nodes[index]?.id);
  const cursorChanged = state.insertionBeforeNodeId !== beforeNodeId;
  const selectionChanged = state.selectedNodeId !== nodeId;
  state.insertionBeforeNodeId = beforeNodeId;
  state.selectedNodeId = nodeId;
  if (!changed) return cursorChanged || selectionChanged;
  draft.document = { ...draft.document, nodes };
  draft.dirty = true;
  return true;
}
type MutableRecord = Record<string, unknown>;
const mutableRecord = (value: unknown): value is MutableRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
type StoryLocalFlagUsage = 'read' | 'write' | 'remove' | 'return';
type StoryLocalFlagVisitor = (name: string, usage: StoryLocalFlagUsage, replace: (name: string) => void) => void;
function visitLocalFlagAction(value: unknown, visit: StoryLocalFlagVisitor): void {
  if (!mutableRecord(value) || value.kind !== 'localFlag' || (value.op !== 'set' && value.op !== 'remove') || typeof value.name !== 'string') return;
  visit(value.name, value.op === 'set' ? 'write' : 'remove', name => { value.name = name; });
}
function visitStoryLocalFlagReferences(document: StoryDraftDocument, editorState: StoryEditorDraftState | undefined, authoring: StoryDraft['authoring'], visit: StoryLocalFlagVisitor): void {
  const visitContinuation = (value: unknown): void => {
    if (!mutableRecord(value) || !Array.isArray(value.returnFlags)) return;
    const flags = value.returnFlags;
    flags.forEach((name, index) => { if (typeof name === 'string') visit(name, 'return', replacement => { flags[index] = replacement; }); });
  };
  const visitAction = (value: unknown): void => {
    visitLocalFlagAction(value, visit);
    if (!mutableRecord(value) || value.kind !== 'overlay' || !mutableRecord(value.command) || value.command.command !== 'show'
      || !mutableRecord(value.command.content) || value.command.content.kind !== 'entryCard' || !mutableRecord(value.command.content.card)) return;
    visitContinuation(value.command.content.card.continuation);
  };
  const visitInteraction = (value: unknown): void => {
    if (!mutableRecord(value)) return;
    if (value.kind === 'choice' && Array.isArray(value.options)) for (const option of value.options) if (mutableRecord(option)) {
      if (typeof option.requiresFlag === 'string') visit(option.requiresFlag, 'read', name => { option.requiresFlag = name; });
      if (Array.isArray(option.marks)) {
        const marks = option.marks;
        marks.forEach((name, index) => { if (typeof name === 'string') visit(name, 'write', replacement => { marks[index] = replacement; }); });
      }
    }
    if (value.kind === 'entryCard' && mutableRecord(value.card)) visitContinuation(value.card.continuation);
  };
  for (const node of document.nodes) {
    const record = node as unknown as MutableRecord;
    if (typeof record.requiresFlag === 'string') visit(record.requiresFlag, 'read', name => { record.requiresFlag = name; });
    if (record.type === 'operation' && mutableRecord(record.action)) visitAction(record.action);
    if (record.type === 'click') visitInteraction(record.interaction);
  }
  for (const entry of [...(authoring?.activeStories ?? []), ...(authoring?.passiveStories ?? [])]) {
    const kizuna = entry.kizuna as unknown as MutableRecord | undefined;
    visitContinuation(kizuna);
  }
  for (const [key, value] of Object.entries(editorState?.branches ?? {})) {
    if (key.endsWith('|node:operation') && mutableRecord(value)) visitAction(value.action);
    else if (key.endsWith('|node:click') && mutableRecord(value)) visitInteraction(value.interaction);
    const first = key.indexOf('|'), last = key.lastIndexOf('|');
    if (first < 0 || last <= first) continue;
    let path: unknown;
    try { path = JSON.parse(key.slice(first + 1, last)); } catch { continue; }
    if (!Array.isArray(path)) continue;
    if (path.length === 1 && path[0] === 'action') visitAction(value);
    else if (path.length === 1 && path[0] === 'interaction') visitInteraction(value);
    else if (path[0] === 'interaction' && path[1] === 'card') {
      if (path.length === 2 && mutableRecord(value)) visitContinuation(value.continuation);
      else if (path.length === 3 && path[2] === 'continuation') visitContinuation(value);
      else if (path.length === 4 && path[2] === 'continuation' && path[3] === 'returnFlags') visitContinuation({ returnFlags: value });
    }
  }
}
function storyLocalFlagNames(document: StoryDraftDocument, editorState?: StoryEditorDraftState, authoring?: StoryDraft['authoring']): Set<string> {
  const names = new Set<string>();
  visitStoryLocalFlagReferences(document, editorState, authoring, name => { names.add(name); });
  return names;
}
export function storyNodesRequiringFlag(draft: StoryDraft, flagName: string): StoryDraftNode[] {
  return draft.document.nodes.filter(node => node.requiresFlag === flagName);
}
function storyLocalFlagWriters(draft: StoryDraft): Set<string> {
  const names = new Set<string>();
  visitStoryLocalFlagReferences(draft.document, draft.editorState, draft.authoring, (name, usage) => {
    if (usage === 'write' || usage === 'return') names.add(name);
  });
  return names;
}
export function canBindStoryNodeToFlagReader(draft: StoryDraft, flagName: string, targetNodeId: string): StoryFlagReaderBindResult {
  if (!storyLocalFlagWriters(draft).has(flagName)) return { ok: false, reason: `找不到局部标记「${flagName}」的提供方。` };
  const target = draft.document.nodes.find(node => node.id === targetNodeId);
  if (!target) return { ok: false, reason: '目标节点已不存在。' };
  if (target.requiresFlag && target.requiresFlag !== flagName) return { ok: false, reason: `节点已有局部标记条件「${target.requiresFlag}」，请先清除或改用现有条件。` };
  return { ok: true, flagName, changed: target.requiresFlag !== flagName };
}
export function bindStoryNodeToFlagReader(state: StoryEditorState, flagName: string, targetNodeId: string): StoryFlagReaderBindResult {
  const draft = currentDraft(state);
  if (!draft) return { ok: false, reason: '当前没有 Story 草稿。' };
  const plan = canBindStoryNodeToFlagReader(draft, flagName, targetNodeId);
  if (!plan.ok || !plan.changed) return plan;
  const document = cloneStory(draft.document) as StoryDraftDocument;
  const target = document.nodes.find(node => node.id === targetNodeId) as unknown as MutableRecord | undefined;
  if (!target) return { ok: false, reason: '目标节点已不存在。' };
  target.requiresFlag = flagName;
  draft.document = document;
  draft.dirty = true;
  state.selectedNodeId = targetNodeId;
  return plan;
}
export function choiceOptionFlagBindings(draft: StoryDraft, choiceNodeId: string, optionIndex: number, optionId: string): StoryChoiceFlagBinding[] {
  const click = draft.document.nodes.find(node => node.id === choiceNodeId);
  if (click?.type !== 'click' || click.interaction.kind !== 'choice') return [];
  const option = click.interaction.options?.[optionIndex];
  if (!option || option.id !== optionId) return [];
  const names = [...new Set(Array.isArray(option.marks) ? option.marks.filter((name): name is string => typeof name === 'string') : [])];
  return names.flatMap(flagName => {
    const nodeIds = draft.document.nodes.filter(node => node.requiresFlag === flagName).map(node => node.id);
    return nodeIds.length ? [{ flagName, nodeIds }] : [];
  });
}
function storyFlagSlug(value: string): string {
  return value.normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^[-_]+|[-_]+$/g, '') || 'story';
}
function nextChoiceFlagName(draft: StoryDraft, optionId: string): string {
  const prefix = `${storyFlagSlug(draft.document.id)}-${storyFlagSlug(optionId)}-`;
  const names = storyLocalFlagNames(draft.document, draft.editorState, draft.authoring);
  let maximum = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const sequence = Number(name.slice(prefix.length));
    if (Number.isSafeInteger(sequence) && sequence > maximum) maximum = sequence;
  }
  return `${prefix}${maximum + 1}`;
}
function choiceOptionPath(document: StoryDraftDocument, choiceNodeId: string, optionIndex: number, optionId: string): { choiceIndex: number; option: MutableRecord } | undefined {
  const choiceIndex = document.nodes.findIndex(node => node.id === choiceNodeId);
  const choice = document.nodes[choiceIndex] as unknown as MutableRecord | undefined;
  const interaction = choice && mutableRecord(choice.interaction) ? choice.interaction : undefined;
  const options = interaction?.kind === 'choice' && Array.isArray(interaction.options) ? interaction.options : undefined;
  const option = options?.[optionIndex];
  return choice?.type === 'click' && mutableRecord(option) && option.id === optionId ? { choiceIndex, option } : undefined;
}
function choiceMarkHasOtherOwner(document: StoryDraftDocument, choiceNodeId: string, flagName: string): boolean {
  if (!flagName) return false;
  return document.nodes.some(node => node.id !== choiceNodeId && node.type === 'click' && node.interaction.kind === 'choice'
    && node.interaction.options.some(option => option.marks?.includes(flagName)));
}
export function canBindStoryNodeToChoiceOption(draft: StoryDraft, choiceNodeId: string, optionIndex: number, optionId: string, targetNodeId: string): StoryChoiceFlagBindResult {
  const choiceIndex = draft.document.nodes.findIndex(node => node.id === choiceNodeId);
  const choice = draft.document.nodes[choiceIndex];
  if (choice?.type !== 'click' || choice.interaction.kind !== 'choice') return { ok: false, reason: '这个节点不再是选项 Click。' };
  const interaction = choice.interaction as unknown as MutableRecord;
  if (Object.prototype.hasOwnProperty.call(interaction, 'sharedActions')) return { ok: false, reason: 'Choice 含有旧 sharedActions，请先在属性栏显式移除。' };
  const option = choice.interaction.options?.[optionIndex];
  if (!option || option.id !== optionId) return { ok: false, reason: '这个选项已变化，请重新拖放。' };
  const optionRecord = option as unknown as MutableRecord;
  if (Object.prototype.hasOwnProperty.call(optionRecord, 'condition')) return { ok: false, reason: '该选项含有旧 condition，请先显式处理；不能直接转成 showWhen。' };
  if (Object.prototype.hasOwnProperty.call(optionRecord, 'result')) return { ok: false, reason: '该选项含有旧 result，请先显式处理其中的动作或转移。' };
  if (optionRecord.marks !== undefined && (!Array.isArray(optionRecord.marks) || !optionRecord.marks.every(name => typeof name === 'string'))) return { ok: false, reason: '该选项的选择标记结构无效，请先修复。' };
  const targetIndex = draft.document.nodes.findIndex(node => node.id === targetNodeId);
  const target = draft.document.nodes[targetIndex];
  if (!target) return { ok: false, reason: '目标节点已不存在。' };
  if (target.requiresFlag && choiceMarkHasOtherOwner(draft.document, choiceNodeId, target.requiresFlag)) return { ok: false, reason: `局部标记「${target.requiresFlag}」已属于另一个 Choice，不能建立跨组关联。` };
  if (targetIndex <= choiceIndex) return { ok: false, reason: '目标节点必须位于这个 Choice 之后。' };
  if (draft.document.nodes.slice(choiceIndex + 1, targetIndex).some(node => node.type === 'transfer' && node.transfer?.mode === 'goto' && !node.requiresFlag)) {
    return { ok: false, reason: '目标节点之前有无条件 goto，当前 Story 后续不会执行。' };
  }
  const optionNames = new Set(Array.isArray(optionRecord.marks) ? optionRecord.marks as string[] : []);
  if (target.requiresFlag && optionNames.has(target.requiresFlag)) return { ok: true, flagName: target.requiresFlag, created: false };
  if (target.requiresFlag) return { ok: false, reason: `节点已有局部标记条件「${target.requiresFlag}」，请先清除或改用现有条件。` };
  return { ok: true, flagName: nextChoiceFlagName(draft, optionId), created: true };
}
export function bindStoryNodeToChoiceOption(state: StoryEditorState, choiceNodeId: string, optionIndex: number, optionId: string, targetNodeId: string): StoryChoiceFlagBindResult {
  const draft = currentDraft(state);
  if (!draft) return { ok: false, reason: '当前没有 Story 草稿。' };
  const plan = canBindStoryNodeToChoiceOption(draft, choiceNodeId, optionIndex, optionId, targetNodeId);
  if (!plan.ok || !plan.created) return plan;
  const document = cloneStory(draft.document) as StoryDraftDocument;
  const path = choiceOptionPath(document, choiceNodeId, optionIndex, optionId);
  const targetIndex = document.nodes.findIndex(node => node.id === targetNodeId);
  const target = document.nodes[targetIndex] as unknown as MutableRecord | undefined;
  if (!path || !target) return { ok: false, reason: 'Story 在拖放完成前发生了变化，请重试。' };
  const marks = Array.isArray(path.option.marks) ? path.option.marks : [];
  path.option.marks = [...marks, plan.flagName];
  target.requiresFlag = plan.flagName;
  draft.document = document;
  draft.dirty = true;
  state.selectedNodeId = targetNodeId;
  return plan;
}
export function unbindStoryNodeFromChoiceOption(draft: StoryDraft, choiceNodeId: string, optionIndex: number, optionId: string, flagName: string, targetNodeId: string): boolean {
  const document = cloneStory(draft.document) as StoryDraftDocument;
  const path = choiceOptionPath(document, choiceNodeId, optionIndex, optionId);
  const target = document.nodes.find(node => node.id === targetNodeId) as unknown as MutableRecord | undefined;
  if (!path || !target || target.requiresFlag !== flagName || !Array.isArray(path.option.marks) || !path.option.marks.includes(flagName)) return false;
  delete target.requiresFlag;
  // Keep the declared mark: another option condition or continuation may still consume it.
  draft.document = document;
  draft.dirty = true;
  return true;
}
export function renameStoryLocalFlag(draft: StoryDraft, oldName: string, newName: string, includeEntry = true): { ok: true; changed: boolean } | { ok: false; reason: string } {
  if (!validStoryFlagName(newName)) return { ok: false, reason: '标记名称不能为空。' };
  if (oldName === newName) return { ok: true, changed: false };
  const authoring = includeEntry ? draft.authoring : undefined;
  const names = storyLocalFlagNames(draft.document, draft.editorState, authoring);
  if (!names.has(oldName)) return { ok: false, reason: `找不到局部标记「${oldName}」。` };
  if (names.has(newName)) return { ok: false, reason: `局部标记「${newName}」已存在，不能合并标记。` };
  const document = cloneStory(draft.document) as StoryDraftDocument;
  let changed = false;
  visitStoryLocalFlagReferences(document, draft.editorState, authoring, (name, _usage, replace) => {
    if (name === oldName) { replace(newName); changed = true; }
  });
  if (changed) { draft.document = document; draft.dirty = true; }
  return { ok: true, changed };
}
export function insertStoryNodeRequiringFlag(state: StoryEditorState, node: StoryDraftNode, flagName: string): StoryDraftNode | undefined {
  const draft = currentDraft(state);
  if (!draft || !validStoryFlagName(flagName) || draft.document.nodes.some(item => item.id === node.id)
    || node.requiresFlag && node.requiresFlag !== flagName
    || (node.type === 'talklet' || node.type === 'click') && !draft.document.stages[node.stageId]) return;
  const next = { ...cloneStory(node), requiresFlag: flagName } as StoryDraftNode;
  insertAtCurrentPoint(state, draft, next);
  return next;
}
export function renameStoryNodeId(state: StoryEditorState, oldId: string, newId: string): boolean {
  const draft = currentDraft(state);
  if (!draft || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(newId)) return false;
  if (oldId === newId) return true;
  if (draft.document.nodes.some(node => node.id === newId)) return false;
  const index = draft.document.nodes.findIndex(node => node.id === oldId);
  if (index < 0) return false;
  const oldPrefix = `${oldId}|`;
  const newPrefix = `${newId}|`;
  const buckets = [draft.editorState?.branches, draft.editorState?.optionals, draft.editorState?.optionalPaths, draft.editorState?.optionalBranches,
    draft.editorState?.rows, draft.editorState?.rawInputs, draft.editorState?.literalKinds, draft.structuredInputs].filter((bucket): bucket is Record<string, unknown> => Boolean(bucket));
  if (buckets.some(bucket => Object.keys(bucket).some(key => key.startsWith(newPrefix)))) return false;
  if (draft.localFlagInputs && Object.prototype.hasOwnProperty.call(draft.localFlagInputs, newId)) return false;
  for (const bucket of buckets) {
    for (const [key, value] of Object.entries(bucket)) if (key.startsWith(oldPrefix)) { delete bucket[key]; bucket[`${newPrefix}${key.slice(oldPrefix.length)}`] = value; }
  }
  if (draft.localFlagInputs && Object.prototype.hasOwnProperty.call(draft.localFlagInputs, oldId)) {
    draft.localFlagInputs[newId] = draft.localFlagInputs[oldId];
    delete draft.localFlagInputs[oldId];
  }
  draft.document = { ...draft.document, nodes: draft.document.nodes.map((node, nodeIndex) => nodeIndex === index ? { ...node, id: newId } as StoryDraftNode : node) };
  const rewriteDisplayTarget=(value:unknown):boolean=>{
    if(!value||typeof value!=='object') return false;
    let changed=false;
    const row=value as Record<string,unknown>;
    if(row.kind==='clearNode'&&row.storyId===draft.document.id&&row.nodeId===oldId){row.nodeId=newId;changed=true;}
    for(const child of Object.values(row)) changed=rewriteDisplayTarget(child)||changed;
    return changed;
  };
  for(const other of state.drafts) {
    const documentChanged=rewriteDisplayTarget(other.document),cacheChanged=rewriteDisplayTarget(other.editorState?.branches);
    if(documentChanged||cacheChanged) other.dirty=true;
  }
  if (draft.editorIssues) draft.editorIssues = draft.editorIssues.map(issue => issue.nodeId === oldId ? { ...issue, nodeId: newId } : issue);
  if (state.selectedNodeId === oldId) state.selectedNodeId = newId;
  if (state.performanceEditing?.[draft.draftId]) state.performanceEditing[draft.draftId] = state.performanceEditing[draft.draftId].map(id => id === oldId ? newId : id);
  if (state.insertionBeforeNodeId === oldId) state.insertionBeforeNodeId = newId;
  draft.dirty = true;
  return true;
}
export function renameStoryChoiceOptionId(draft: StoryDraft, nodeId: string, optionIndex: number, oldId: string, newId: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(newId)) return false;
  const node = draft.document.nodes.find(item => item.id === nodeId);
  if (node?.type !== 'click' || node.interaction.kind !== 'choice') return false;
  const option = node.interaction.options[optionIndex];
  if (!option || option.id !== oldId) return false;
  if (oldId === newId) return true;
  if (node.interaction.options.some((item, index) => index !== optionIndex && item.id === newId)) return false;
  const nodes = [...draft.document.nodes];
  const options = [...node.interaction.options];
  options[optionIndex] = { ...option, id: newId };
  nodes[draft.document.nodes.indexOf(node)] = { ...node, interaction: { ...node.interaction, options } };
  draft.document = { ...draft.document, nodes };
  draft.dirty = true;
  return true;
}
export function isGeneratedStoryNodeId(nodeId: string): boolean {
  return /^node_[0-9a-f]{32}$/.test(nodeId) || Object.values(nodeIdPrefixes).some(prefix => nodeId.startsWith(`${prefix}-`) && /^\d{3,}$/.test(nodeId.slice(prefix.length+1)));
}
export function suggestStoryNodeId(draft: StoryDraft, nodeId: string, optionId: string): string {
  const node = draft.document.nodes.find(item => item.id === nodeId);
  if (!node) return '';
  const optionSlug = storyFlagSlug(optionId).slice(0, 48);
  const base = `${node.type}-${optionSlug}`.slice(0, 64);
  const used = new Set(draft.document.nodes.map(item => item.id));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 10000; suffix++) {
    const candidate = `${base.slice(0, 63 - String(suffix).length)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return base;
}
/** Minimal flag fields; unrelated Operation branches remain intact. */
export function editNodeFlag(state: StoryEditorState, field: string, value: string): boolean {
  const draft = currentDraft(state);
  const node = currentNode(state);
  if (!draft || !node) return false;
  let next: StoryDraftNode;
  if (field === 'requires-flag') {
    const { requiresFlag: _old, ...base } = node;
    next = value === '' ? base : { ...base, requiresFlag: value };
  } else {
    if (node.type !== 'operation' || node.action !== undefined && node.action.kind !== 'localFlag') return false;
    const action = node.action;
    let input = localFlagInput(node, draft.localFlagInputs);
    if (field === 'local-flag-op') {
      if (value !== 'set' && value !== 'remove') return false;
      input ??= { type: 'string', text: '' };
      draft.localFlagInputs ??= Object.create(null) as LocalFlagInputs;
      draft.localFlagInputs[node.id] = input;
      next = { ...node, action: localFlagAction(value, action?.name ?? '', input) };
    } else {
      if (!action) return false;
      if (field === 'local-flag-name') {
        if (!validStoryFlagName(value)) return false;
        next = { ...node, action: { ...action, name: value } };
      }
      else {
        if (action.op !== 'set') return false;
        if (field === 'local-flag-type') {
          const key = `${node.id}|["action","value"]`;
          for (const input of Object.keys(draft.structuredInputs ?? {})) if (input === key || input.startsWith(key.slice(0,-1)+',')) delete draft.structuredInputs![input];
          if (!['string', 'number', 'boolean', 'null', 'structured'].includes(value)) return false;
          input = { type: value as LocalFlagInput['type'], text: value === 'boolean' ? 'false' : '', ...(value === 'structured' ? { value: {} } : {}) };
        } else if (field === 'local-flag-value' && input && input.type !== 'structured') input = { ...input, text: value };
        else return false;
        draft.localFlagInputs ??= Object.create(null) as LocalFlagInputs;
        draft.localFlagInputs[node.id] = input;
        const parsed = parseLocalFlagInput(input);
        next = { ...node, action: { ...action, value: parsed.ok ? parsed.value : action.value } };
      }
    }
  }
  draft.document = { ...draft.document, nodes: draft.document.nodes.map(item => item.id === node.id ? next : item) };
  draft.dirty = true;
  return true;
}
export function deleteNode(state: StoryEditorState): void {
  const draft = currentDraft(state);
  const node = currentNode(state);
  if (!draft || !node) return;
  const oldNodes = draft.document.nodes;
  const oldIndex = oldNodes.findIndex(item => item.id === node.id);
  const nodes = oldNodes.filter(item => item.id !== node.id);
  if (state.performanceEditing?.[draft.draftId]) state.performanceEditing[draft.draftId] = state.performanceEditing[draft.draftId].filter(id => id !== node.id);
  if (state.insertionBeforeNodeId === node.id) state.insertionBeforeNodeId = nodes[oldIndex]?.id ?? null;
  const stages = { ...draft.document.stages };
  if ((node.type === 'talklet' || node.type === 'click') && !nodes.some(item => (item.type === 'talklet' || item.type === 'click') && item.stageId === node.stageId)) delete stages[node.stageId];
  draft.document = { ...draft.document, nodes, stages };
  draft.dirty = true;
  state.selectedNodeId = null;
  if (draft.localFlagInputs) delete draft.localFlagInputs[node.id];
  clearNodeEditorState(draft, node.id);
}
