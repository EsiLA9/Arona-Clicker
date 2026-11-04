import type { StoryAuthoringPatch } from '../../data-services/authoring/story-authoring';
import type { StructuredInputs } from './structured-value';
import type { StoryDef } from '../../data-services/contracts/story';
import type { StoryNode, StoryOperationNode, StoryTransferNode, StoryTalkletNode, StoryMoveToAreaNode, StoryMoveToCharaspaceNode } from '../../data-services/contracts/story-node';
import { isStoryLocalFlagAction, validStoryFlagName } from '../../data-services/validation/story-run-flags';
import { localFlagAction, localFlagInput, parseLocalFlagInput, type LocalFlagInputs, type LocalFlagInput } from './flag-fields';
import { projectStoryDefinition, stripLegacyStoryReplies } from '../../data-services/authoring/story-definition-projection';
import { applyLiteralKinds, clearNodeEditorState, hasActiveStructuredErrors, editProperty as editStoryProperty, missingEnabledOptionalIssues, readProperty as readStoryProperty, selectDiscriminant } from './property-model';

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
  optionalBranches: Record<string, readonly { path: readonly string[]; discriminator: 'kind' | 'command' | 'op' | 'entryType' | 'mode' | 'valueKind' | 'type'; value: string }[]>;
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
}
export interface StoryComposer { sender: string; text: string }
export interface StoryEditorState {
  drafts: StoryDraft[];
  currentId: string | null;
  selectedNodeId: string | null;
  /** Transient gap anchor before a node; null means the end of the current Story. */
  insertionBeforeNodeId: string | null;
  sidebarMode: 'stories' | 'senders';
  search: string;
  senderSearch: string;
  composers: Record<string, StoryComposer>;
  error: string | null;
  notice?: string | null;
  storageBlocked: boolean;
  targetPackId?: string;
  copyStoryId?: string;
  previewEntryId?: string;
  preview?: { playback: import('../../arona-clicker/contracts/runtime/story-presentation').StoryPresentationView | null; story: import('../../arona-clicker/contracts/runtime/results').StoryView | null };
}
export interface StorySender { id: string; label: string; speaker?: string }
export interface StoryListItem { key: string; name: string; storyId: string; draft?: StoryDraft }
export interface StoryChoiceFlagBinding { flagName: string; nodeIds: string[] }
export type StoryChoiceFlagBindResult = { ok: true; flagName: string; created: boolean } | { ok: false; reason: string };
export type StoryFlagReaderBindResult = { ok: true; flagName: string; changed: boolean } | { ok: false; reason: string };

export const cloneStory = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const NUMBER_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const identity = (prefix: string): string => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
export function createStoryEditorState(): StoryEditorState {
  return { drafts: [], currentId: null, selectedNodeId: null, insertionBeforeNodeId: null, sidebarMode: 'stories', search: '', senderSearch: '', composers: Object.create(null), error: null, storageBlocked: false };
}
export function currentDraft(state: StoryEditorState): StoryDraft | undefined {
  return state.drafts.find(draft => draft.draftId === state.currentId);
}
export function currentNode(state: StoryEditorState): StoryDraftNode | undefined {
  return currentDraft(state)?.document.nodes.find(node => node.id === state.selectedNodeId);
}
/** Narrow draft-only missing payloads before crossing the typed Runtime command. */
export interface StoryDraftProjectionIssue { path: string; message: string; nodeId?: string }
export type StoryDraftProjectionResult = { ok: true; story: StoryDef } | { ok: false; message: string; issues: readonly StoryDraftProjectionIssue[] };
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
  const candidate = cloneStory(document) as Record<string, unknown>;
  stripLegacyStoryReplies(candidate);
  const nodes = Array.isArray(candidate.nodes) ? candidate.nodes as Record<string, unknown>[] : [];
  const activeStages = new Set<string>();
  for (const [index, node] of nodes.entries()) {
    if (!node || typeof node !== 'object') continue;
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
  return state.currentId ? state.composers[state.currentId] ??= { sender: 'narrator', text: '' } : { sender: 'narrator', text: '' };
}
export function storyList(state: StoryEditorState, sources: ReadonlyMap<string, StoryDef>): StoryListItem[] {
  const entries = [...sources.values()].map(source => {
    const draft = state.drafts.find(item => item.sourceId === source.id);
    return { key: draft?.draftId ?? `source:${source.id}`, name: draft?.document.name ?? source.name, storyId: source.id, draft };
  });
  for (const draft of state.drafts) {
    if (!draft.sourceId || !sources.has(draft.sourceId)) entries.push({ key: draft.draftId, name: draft.document.name, storyId: draft.document.id, draft });
  }
  const search = state.search.trim().toLocaleLowerCase();
  return entries.filter(item => !search || `${item.name}\n${item.storyId}`.toLocaleLowerCase().includes(search));
}
export function selectStory(state: StoryEditorState, key: string, sources: ReadonlyMap<string, StoryDef>): boolean {
  let draft = state.drafts.find(item => item.draftId === key);
  if (!draft && key.startsWith('source:')) {
    const source = sources.get(key.slice(7));
    if (!source) return false;
    draft = state.drafts.find(item => item.sourceId === source.id);
    if (!draft) {
      const document = cloneStory({ ...source, nodes: [...source.nodes] }) as StoryDraftDocument;
      stripLegacyStoryReplies(document);
      draft = { draftId: `source:${source.id}`, sourceId: source.id, document, savedAt: null, dirty: false, persisted: false,
        editorState: { version: 1, branches: Object.create(null), optionals: Object.create(null), optionalPaths: Object.create(null), optionalBranches: Object.create(null), rows: Object.create(null), rawInputs: Object.create(null), sourceStageIds: Object.keys(source.stages ?? {}),
          sourceUnreferencedStageIds: Object.keys(source.stages ?? {}).filter(id => !source.nodes.some(node => (node.type === 'talklet' || node.type === 'click') && node.stageId === id)), inactiveStageIds: [] } };
      const editorState = draft.editorState!;
      for (const node of draft.document.nodes) if (node.type === 'talklet' && node.pacing !== undefined
        && (node.content.kind === 'narration' || node.presentation?.side === 'right')) {
        editorState.branches[`${node.id}|side:pacing`] = cloneStory(node.pacing);
        const { pacing: _pacing, ...active } = node;
        const index = draft.document.nodes.findIndex(item => item.id === node.id);
        if (index >= 0) draft.document.nodes[index] = active;
      }
      state.drafts.push(draft);
    }
  }
  if (!draft) return false;
  state.currentId = draft.draftId;
  state.selectedNodeId = null;
  state.insertionBeforeNodeId = null;
  return true;
}
export function newStory(state: StoryEditorState): StoryDraft {
  const id = identity('story');
  const draft: StoryDraft = { draftId: id, sourceId: null, document: { id: `local:story:${id}`, name: '未命名 Story', nodes: [], stages: {} }, dirty: true, persisted: false, savedAt: null };
  state.drafts.push(draft);
  state.currentId = id;
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
function insertAtCurrentPoint(state: StoryEditorState, draft: StoryDraft, node: StoryDraftNode): boolean {
  const nodes = [...draft.document.nodes];
  let insertionIndex = state.insertionBeforeNodeId === null ? nodes.length : nodes.findIndex(item => item.id === state.insertionBeforeNodeId);
  if (insertionIndex < 0) { insertionIndex = nodes.length; state.insertionBeforeNodeId = null; }
  nodes.splice(insertionIndex, 0, node);
  draft.document = { ...draft.document, nodes };
  draft.dirty = true;
  state.selectedNodeId = node.id;
  return true;
}
export function appendNode(state: StoryEditorState, kind: 'text' | 'click' | 'operation' | 'transfer' | 'moveToArea' | 'moveToCharaspace', senders: readonly StorySender[]): StoryDraftNode | undefined {
  const draft = currentDraft(state);
  if (!draft) return;
  const input = composer(state);
  const id = identity('node');
  const stageId = identity('stage');
  let node: StoryDraftNode;
  if (kind === 'text') {
    if (!input.text.trim()) return;
    const sender = senders.find(item => item.id === input.sender);
    if (!sender) return;
    node = { id, type: 'talklet', stageId, content: sender.id === 'narrator' ? { kind: 'narration', text: input.text }
      : { kind: 'talk', speaker: sender.speaker, text: input.text }, ...(sender.id === 'narrator' ? {} : { presentation: { side: sender.id === 'teacher' ? 'right' : 'left' } }) };
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
  if (node.presentation?.side === 'right' && node.content.speaker === '老师') return 'teacher';
  const speaker = node.content.speaker;
  return senders.find(sender => sender.id !== 'teacher' && sender.speaker === speaker && node.presentation?.side !== 'right')?.id ?? 'original';
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
      const sender = senders.find(item => item.id === value);
      if (!sender || !senderChangeAllowed(node, sender)) return false;
      const oldText = node.content.text;
      if (!selectDiscriminant(draft, node.id, ['content'], 'kind', sender.id === 'narrator' ? 'narration' : 'talk')) return false;
      if (readStoryProperty(draft, node.id, ['content', 'text']) === undefined) editStoryProperty(draft, node.id, ['content', 'text'], oldText);
      if (sender.id !== 'narrator') {
        editStoryProperty(draft, node.id, ['content', 'speaker'], sender.speaker ?? '');
        editStoryProperty(draft, node.id, ['presentation', 'side'], sender.id === 'teacher' ? 'right' : 'left');
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
function storyLocalFlagNames(document: StoryDraftDocument, editorState?: StoryEditorDraftState): Set<string> {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!mutableRecord(value)) return;
    if (value.kind === 'localFlag' && typeof value.name === 'string') names.add(value.name);
    if (typeof value.requiresFlag === 'string') names.add(value.requiresFlag);
    Object.values(value).forEach(visit);
  };
  visit(document.nodes);
  visit(editorState);
  return names;
}
export function storyNodesRequiringFlag(draft: StoryDraft, flagName: string): StoryDraftNode[] {
  return draft.document.nodes.filter(node => node.requiresFlag === flagName);
}
function storyLocalFlagWriters(draft: StoryDraft): Set<string> {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!mutableRecord(value)) return;
    if (value.kind === 'localFlag' && value.op === 'set' && typeof value.name === 'string') names.add(value.name);
    Object.values(value).forEach(visit);
  };
  visit(draft.document.nodes);
  visit(draft.editorState);
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
  const actions = option.result?.actions ?? [];
  const names = [...new Set(actions.filter(action => action.kind === 'localFlag' && action.op === 'set').map(action => action.name))];
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
  const names = storyLocalFlagNames(draft.document, draft.editorState);
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
function syncChoiceFlagClears(document: StoryDraftDocument, choiceNodeId: string): void {
  const choice = document.nodes.find(node => node.id === choiceNodeId) as unknown as MutableRecord | undefined;
  const interaction = choice && mutableRecord(choice.interaction) ? choice.interaction : undefined;
  if (!choice || interaction?.kind !== 'choice' || !Array.isArray(interaction.options)) return;
  if (interaction.sharedActions !== undefined && !Array.isArray(interaction.sharedActions)) return;
  const written = new Set<string>();
  for (const optionValue of interaction.options) {
    if (!mutableRecord(optionValue) || !mutableRecord(optionValue.result) || !Array.isArray(optionValue.result.actions)) continue;
    for (const action of optionValue.result.actions) if (mutableRecord(action) && action.kind === 'localFlag' && action.op === 'set' && typeof action.name === 'string') written.add(action.name);
  }
  const readers = new Set(document.nodes.flatMap(node => typeof node.requiresFlag === 'string' ? [node.requiresFlag] : []));
  const active = [...written].filter(name => readers.has(name));
  if (!active.length && !Array.isArray(interaction.sharedActions)) return;
  const shared = Array.isArray(interaction.sharedActions) ? interaction.sharedActions : [];
  const activeSet = new Set(active);
  const preserved = shared.filter(action => !mutableRecord(action) || action.kind !== 'localFlag' || action.op !== 'remove' || typeof action.name !== 'string' || !activeSet.has(action.name));
  const existingNames = new Set(preserved.filter(mutableRecord).filter(action => action.kind === 'localFlag' && action.op === 'remove').map(action => action.name));
  const cleanup = active.filter(name => !existingNames.has(name)).map(name => ({ kind: 'localFlag', op: 'remove', name }));
  if (preserved.length || cleanup.length) interaction.sharedActions = [...preserved, ...cleanup];
  else delete interaction.sharedActions;
}
export function canBindStoryNodeToChoiceOption(draft: StoryDraft, choiceNodeId: string, optionIndex: number, optionId: string, targetNodeId: string): StoryChoiceFlagBindResult {
  const choiceIndex = draft.document.nodes.findIndex(node => node.id === choiceNodeId);
  const choice = draft.document.nodes[choiceIndex];
  if (choice?.type !== 'click' || choice.interaction.kind !== 'choice') return { ok: false, reason: '这个节点不再是选项 Click。' };
  const interaction = choice.interaction as unknown as MutableRecord;
  if (interaction.sharedActions !== undefined && !Array.isArray(interaction.sharedActions)) return { ok: false, reason: 'Choice 共同动作结构不完整，请先修复该字段。' };
  const option = choice.interaction.options?.[optionIndex];
  if (!option || option.id !== optionId) return { ok: false, reason: '这个选项已变化，请重新拖放。' };
  const optionRecord = option as unknown as MutableRecord;
  if (optionRecord.result !== undefined && !mutableRecord(optionRecord.result)) return { ok: false, reason: '选项结果结构不完整，请先修复该字段。' };
  const optionResult = mutableRecord(optionRecord.result) ? optionRecord.result : undefined;
  if (optionResult?.actions !== undefined && !Array.isArray(optionResult.actions)) return { ok: false, reason: '选项结果动作不是列表，请先修复该字段。' };
  if (option.result?.transfer?.mode === 'goto') return { ok: false, reason: '该选项会跳转离开当前 Story，后续节点不会执行。' };
  const targetIndex = draft.document.nodes.findIndex(node => node.id === targetNodeId);
  const target = draft.document.nodes[targetIndex];
  if (!target) return { ok: false, reason: '目标节点已不存在。' };
  if (targetIndex <= choiceIndex) return { ok: false, reason: '目标节点必须位于这个 Choice 之后。' };
  if (draft.document.nodes.slice(choiceIndex + 1, targetIndex).some(node => node.type === 'transfer' && node.transfer?.mode === 'goto' && !node.requiresFlag)) {
    return { ok: false, reason: '目标节点之前有无条件 goto，当前 Story 后续不会执行。' };
  }
  const optionActions = Array.isArray(optionResult?.actions) ? optionResult.actions as unknown[] : [];
  const optionNames = new Set(optionActions.filter(mutableRecord).filter(action => action.kind === 'localFlag' && action.op === 'set' && typeof action.name === 'string').map(action => action.name as string));
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
  const result = mutableRecord(path.option.result) ? path.option.result : {};
  const actions = Array.isArray(result.actions) ? result.actions : [];
  path.option.result = { ...result, actions: [...actions, { kind: 'localFlag', op: 'set', name: plan.flagName, value: true }] };
  target.requiresFlag = plan.flagName;
  draft.document = document;
  syncChoiceFlagClears(document, choiceNodeId);
  draft.dirty = true;
  state.selectedNodeId = targetNodeId;
  return plan;
}
export function unbindStoryNodeFromChoiceOption(draft: StoryDraft, choiceNodeId: string, optionIndex: number, optionId: string, flagName: string, targetNodeId: string): boolean {
  const document = cloneStory(draft.document) as StoryDraftDocument;
  const path = choiceOptionPath(document, choiceNodeId, optionIndex, optionId);
  const target = document.nodes.find(node => node.id === targetNodeId) as unknown as MutableRecord | undefined;
  if (!path || !target || target.requiresFlag !== flagName) return false;
  delete target.requiresFlag;
  const hasReaders = document.nodes.some(node => node.id !== targetNodeId && node.requiresFlag === flagName);
  if (!hasReaders) {
    const result = mutableRecord(path.option.result) ? path.option.result : undefined;
    if (result && Array.isArray(result.actions)) {
      const actions = (result.actions as unknown[]).filter(action => !mutableRecord(action) || action.kind !== 'localFlag' || action.op !== 'set' || action.name !== flagName);
      result.actions = actions;
      if (!actions.length) delete result.actions;
      if (!Object.keys(result).length) delete path.option.result;
    }
    const choice = document.nodes.find(node => node.id === choiceNodeId) as unknown as MutableRecord | undefined;
    const interaction = choice && mutableRecord(choice.interaction) ? choice.interaction : undefined;
    if (interaction?.kind === 'choice' && Array.isArray(interaction.sharedActions)) {
      const sharedActions = (interaction.sharedActions as unknown[]).filter(action => !mutableRecord(action) || action.kind !== 'localFlag' || action.op !== 'remove' || action.name !== flagName);
      interaction.sharedActions = sharedActions;
      if (!sharedActions.length) delete interaction.sharedActions;
    }
  }
  syncChoiceFlagClears(document, choiceNodeId);
  draft.document = document;
  draft.dirty = true;
  return true;
}
export function renameStoryLocalFlag(draft: StoryDraft, oldName: string, newName: string): { ok: true; changed: boolean } | { ok: false; reason: string } {
  if (!validStoryFlagName(newName)) return { ok: false, reason: '标记名称不能为空。' };
  if (oldName === newName) return { ok: true, changed: false };
  const names = storyLocalFlagNames(draft.document, draft.editorState);
  if (!names.has(oldName)) return { ok: false, reason: `找不到局部标记「${oldName}」。` };
  if (names.has(newName)) return { ok: false, reason: `局部标记「${newName}」已存在，不能合并标记。` };
  const document = cloneStory(draft.document) as StoryDraftDocument;
  let changed = false;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!mutableRecord(value)) return;
    if (value.kind === 'localFlag' && value.name === oldName) { value.name = newName; changed = true; }
    if (value.requiresFlag === oldName) { value.requiresFlag = newName; changed = true; }
    Object.values(value).forEach(visit);
  };
  visit(document.nodes);
  visit(draft.editorState);
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
  if (draft.editorIssues) draft.editorIssues = draft.editorIssues.map(issue => issue.nodeId === oldId ? { ...issue, nodeId: newId } : issue);
  if (state.selectedNodeId === oldId) state.selectedNodeId = newId;
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
export function isGeneratedStoryNodeId(nodeId: string): boolean { return /^node_[0-9a-f]{32}$/.test(nodeId); }
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
  if (state.insertionBeforeNodeId === node.id) state.insertionBeforeNodeId = nodes[oldIndex]?.id ?? null;
  const stages = { ...draft.document.stages };
  if ((node.type === 'talklet' || node.type === 'click') && !nodes.some(item => (item.type === 'talklet' || item.type === 'click') && item.stageId === node.stageId)) delete stages[node.stageId];
  draft.document = { ...draft.document, nodes, stages };
  draft.dirty = true;
  state.selectedNodeId = null;
  if (draft.localFlagInputs) delete draft.localFlagInputs[node.id];
  clearNodeEditorState(draft, node.id);
}
