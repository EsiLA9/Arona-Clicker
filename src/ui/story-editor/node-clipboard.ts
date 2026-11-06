import { currentDraft, insertAtCurrentPoint, storyNodeIdsInUse, type StoryDraft, type StoryDraftNode, type StoryEditorState, type StoryEditorDraftState } from './model';
import type { LocalFlagInput } from './flag-fields';

const buckets = ['branches','optionals','optionalPaths','optionalBranches','rows','rawInputs','literalKinds'] as const;
const emptyEditorState = (): StoryEditorDraftState => ({ version: 1, branches: {}, optionals: {}, optionalPaths: {}, optionalBranches: {}, rows: {}, rawInputs: {}, literalKinds: {} });

export interface StoryNodeClipboard {
  node: StoryDraftNode;
  editorState?: StoryEditorDraftState;
  structuredInputs?: StoryDraft['structuredInputs'];
  localFlagInput?: LocalFlagInput;
}

export function copyStoryNode(draft: StoryDraft, nodeId: string): StoryNodeClipboard | undefined {
  const node = draft.document.nodes.find(node => node.id === nodeId);
  if (!node) return;
  const prefix = `${nodeId}|`;
  const ownEntries = (bucket: Record<string, unknown> = {}) => Object.entries(bucket).filter(([key]) => key.startsWith(prefix));
  const snapshot: StoryNodeClipboard = { node: structuredClone(node) };
  if (draft.editorState) {
    snapshot.editorState = emptyEditorState();
    for (const bucket of buckets) Object.assign(snapshot.editorState[bucket]!, structuredClone(Object.fromEntries(ownEntries(draft.editorState[bucket]))));
  }
  snapshot.structuredInputs = structuredClone(Object.fromEntries(ownEntries(draft.structuredInputs))) as StoryDraft['structuredInputs'];
  if (draft.localFlagInputs?.[nodeId]) snapshot.localFlagInput = structuredClone(draft.localFlagInputs[nodeId]);
  return snapshot;
}

export function pasteStoryNode(state: StoryEditorState, clipboard: StoryNodeClipboard, beforeNodeId: string | null): StoryDraftNode | undefined {
  const draft = currentDraft(state);
  if (!draft || state.target?.kind !== 'story' || state.storageBlocked
    || beforeNodeId !== null && !draft.document.nodes.some(node => node.id === beforeNodeId)) return;
  const used = storyNodeIdsInUse(draft); used.add(clipboard.node.id);
  const copy = structuredClone(clipboard), originalId = copy.node.id;
  const base = originalId.replace(/(?:-copy-\d+)+$/, '');
  let id: string, index = 1;
  do { const suffix = `-copy-${index++}`; id = `${base.slice(0,64-suffix.length)}${suffix}`; } while (used.has(id));
  copy.node = { ...copy.node, id };
  // Row identities belong to the new node; authored option IDs and all runtime references remain unchanged.
  const rowIds = new Map<string,string>();
  for (const rows of Object.values(copy.editorState?.rows ?? {})) for (const row of rows) {
    if (!rowIds.has(row)) rowIds.set(row, `row_${crypto.randomUUID().replace(/-/g,'')}`);
  }
  const remapKey = (key: string): string => {
    let next = `${id}|${key.slice(originalId.length+1)}`;
    for (const [oldRow,newRow] of rowIds) next = next.split(JSON.stringify(`@${oldRow}`)).join(JSON.stringify(`@${newRow}`));
    return next;
  };
  if (copy.editorState) {
    draft.editorState ??= emptyEditorState();
    for (const bucket of buckets) for (const [key,value] of Object.entries(copy.editorState[bucket] ?? {})) {
      Object.assign(draft.editorState[bucket] ??= {}, { [remapKey(key)]: value });
    }
    for (const [key,rows] of Object.entries(copy.editorState.rows)) draft.editorState.rows[remapKey(key)] = rows.map(row => rowIds.get(row)!);
    for (const [key,guards] of Object.entries(copy.editorState.optionalBranches)) {
      draft.editorState.optionalBranches[remapKey(key)] = guards.map(guard => ({ ...guard, path: guard.path.map(part => part.startsWith('@') && rowIds.has(part.slice(1)) ? `@${rowIds.get(part.slice(1))}` : part) }));
    }
  }
  draft.structuredInputs ??= {};
  for (const [key,value] of Object.entries(copy.structuredInputs ?? {})) draft.structuredInputs[remapKey(key)] = value;
  if (copy.localFlagInput) { draft.localFlagInputs ??= {}; draft.localFlagInputs[id] = copy.localFlagInput; }
  state.insertionBeforeNodeId = beforeNodeId;
  insertAtCurrentPoint(state,draft,copy.node);
  return copy.node;
}
