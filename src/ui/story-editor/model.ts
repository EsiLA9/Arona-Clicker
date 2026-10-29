import type { StoryDef } from '../../data-services/contracts/story';
import type { StoryNode, StoryOperationNode, StoryTransferNode, StoryTalkletNode } from '../../data-services/contracts/story-node';
import { isStoryLocalFlagAction, validStoryFlagName } from '../../data-services/validation/story-run-flags';
import { localFlagAction, localFlagInput, parseLocalFlagInput, type LocalFlagInputs, type LocalFlagInput } from './flag-fields';
import { projectStoryDefinition } from '../../data-services/authoring/story-definition-projection';
import { applyLiteralKinds, clearNodeEditorState, editProperty as editStoryProperty, missingEnabledOptionalIssues, readProperty as readStoryProperty, selectDiscriminant } from './property-model';

export type StoryDraftNode = Exclude<StoryNode, StoryOperationNode | StoryTransferNode>
  | (Omit<StoryOperationNode, 'action'> & { action?: StoryOperationNode['action'] })
  | (Omit<StoryTransferNode, 'transfer'> & { transfer?: StoryTransferNode['transfer'] });
export type StoryDraftDocument = Omit<StoryDef, 'nodes'> & { nodes: StoryDraftNode[] };
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
}
export interface StoryComposer { sender: string; text: string }
export interface StoryEditorState {
  drafts: StoryDraft[];
  currentId: string | null;
  selectedNodeId: string | null;
  search: string;
  composers: Record<string, StoryComposer>;
  error: string | null;
  notice?: string | null;
  storageBlocked: boolean;
}
export interface StorySender { id: string; label: string; speaker?: string }
export interface StoryListItem { key: string; name: string; storyId: string; draft?: StoryDraft }

export const cloneStory = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const NUMBER_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const identity = (prefix: string): string => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
export function createStoryEditorState(): StoryEditorState {
  return { drafts: [], currentId: null, selectedNodeId: null, search: '', composers: Object.create(null), error: null, storageBlocked: false };
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
  const candidate = cloneStory(document) as Record<string, unknown>;
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
  const unreferenced = Object.keys(stages).filter(id => !activeStages.has(id) && sourceStages.has(id) && !intentionallyInactive.has(id));
  if (unreferenced.length) {
    const issues = unreferenced.map(id => ({ path: `stages.${id}`, message: '来源阶段没有节点引用；请显式修复或清理来源问题' }));
    if (draft) draft.editorIssues = issues;
    return { ok: false, message: issues[0].message, issues };
  }
  candidate.stages = Object.fromEntries(Object.entries(stages).filter(([id]) => activeStages.has(id)));
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
      draft = { draftId: `source:${source.id}`, sourceId: source.id, document: cloneStory({ ...source, nodes: [...source.nodes] }), savedAt: null, dirty: false, persisted: false,
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
  return true;
}
export function newStory(state: StoryEditorState): StoryDraft {
  const id = identity('story');
  const draft: StoryDraft = { draftId: id, sourceId: null, document: { id: `local:story:${id}`, name: '未命名 Story', nodes: [], stages: {} }, dirty: true, persisted: false, savedAt: null };
  state.drafts.push(draft);
  state.currentId = id;
  state.selectedNodeId = null;
  return draft;
}
export function renameStory(state: StoryEditorState, name: string): void {
  const draft = currentDraft(state);
  if (!draft || draft.document.name === name) return;
  draft.document = { ...draft.document, name };
  draft.dirty = true;
}
export function appendNode(state: StoryEditorState, kind: 'text' | 'click' | 'operation' | 'transfer', senders: readonly StorySender[]): StoryDraftNode | undefined {
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
  draft.document = { ...draft.document, nodes: [...draft.document.nodes, node], stages: (kind === 'text' || kind === 'click')
    ? { ...draft.document.stages, [stageId]: { advance: kind === 'click' ? 'input' : 'auto' } } : draft.document.stages };
  draft.dirty = true;
  state.selectedNodeId = id;
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
      if (field === 'local-flag-name') next = { ...node, action: { ...action, name: value } };
      else {
        if (action.op !== 'set') return false;
        if (field === 'local-flag-type') {
          if (!['string', 'number', 'boolean', 'null'].includes(value)) return false;
          input = { type: value as LocalFlagInput['type'], text: value === 'boolean' ? 'false' : '' };
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
  const nodes = draft.document.nodes.filter(item => item.id !== node.id);
  const stages = { ...draft.document.stages };
  if ((node.type === 'talklet' || node.type === 'click') && !nodes.some(item => (item.type === 'talklet' || item.type === 'click') && item.stageId === node.stageId)) delete stages[node.stageId];
  draft.document = { ...draft.document, nodes, stages };
  draft.dirty = true;
  state.selectedNodeId = null;
  if (draft.localFlagInputs) delete draft.localFlagInputs[node.id];
  clearNodeEditorState(draft, node.id);
}
