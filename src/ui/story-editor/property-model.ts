import type { StoryDraft, StoryDraftNode } from './model';

/** Paths are relative to the selected node. Numeric segments address the current row position only. */
export type PropertyPath = readonly (string | number)[];
export type StoryNodeType = 'talklet' | 'click' | 'operation' | 'transfer' | 'moveToArea' | 'moveToCharaspace';
export type Discriminator = 'kind' | 'command' | 'op' | 'entryType' | 'mode' | 'valueKind' | 'type';

type PropertyEditorState = NonNullable<StoryDraft['editorState']>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const record = (value: unknown): Record<string, unknown> => object(value) ? value : Object.create(null) as Record<string, unknown>;
const newId = (): string => `row_${crypto.randomUUID().replace(/-/g, '')}`;

function editorState(draft: StoryDraft): PropertyEditorState {
  return draft.editorState ??= { version: 1, branches: Object.create(null), optionals: Object.create(null), optionalPaths: Object.create(null), optionalBranches: Object.create(null), rows: Object.create(null), rawInputs: Object.create(null) };
}
function nodeIndex(draft: StoryDraft, nodeId: string): number { return draft.document.nodes.findIndex(node => node.id === nodeId); }
function pathSegments(draft: StoryDraft, nodeId: string, path: PropertyPath): string[] {
  const state = editorState(draft);
  const index = nodeIndex(draft, nodeId);
  const node = index < 0 ? undefined : draft.document.nodes[index] as unknown as Record<string, unknown>;
  const result: string[] = [];
  let current: unknown = node;
  for (const part of path) {
    if (typeof part === 'number') {
      const parentKey = JSON.stringify(result);
      const list = Array.isArray(current) ? current : [];
      const rowKey = `${nodeId}|${parentKey}`;
      let ids = state.rows[rowKey];
      if (!ids) { ids = list.map(item => object(item) && typeof item.id === 'string' ? item.id : newId()); state.rows[rowKey] = ids; }
      result.push(`@${ids[part] ?? `missing:${part}`}`);
      current = list[part];
    } else {
      result.push(part);
      current = object(current) ? current[part] : undefined;
    }
  }
  return result;
}
function keyFor(draft: StoryDraft, nodeId: string, path: PropertyPath): string { return `${nodeId}|${JSON.stringify(pathSegments(draft, nodeId, path))}`; }
function valueAt(root: unknown, path: PropertyPath): unknown {
  let value = root;
  for (const segment of path) {
    if (typeof segment === 'number') value = Array.isArray(value) ? value[segment] : undefined;
    else value = object(value) ? value[segment] : undefined;
  }
  return value;
}
function assignAt(root: unknown, path: PropertyPath, value: unknown, remove = false): boolean {
  if (!path.length || !object(root)) return false;
  let parent: unknown = root;
  for (const [index, segment] of path.slice(0, -1).entries()) {
    const nextSegment = path[index + 1];
    if (typeof segment === 'number') parent = Array.isArray(parent) ? parent[segment] : undefined;
    else if (object(parent)) {
      if (parent[segment] === undefined && !remove && typeof nextSegment === 'string') parent[segment] = {};
      parent = parent[segment];
    } else parent = undefined;
    if (parent === undefined || parent === null) return false;
  }
  const last = path[path.length - 1];
  if (typeof last === 'number') {
    if (!Array.isArray(parent) || last < 0 || last >= parent.length) return false;
    if (remove) parent.splice(last, 1); else parent[last] = value;
  } else {
    if (!object(parent)) return false;
    if (remove) delete parent[last]; else parent[last] = value;
  }
  return true;
}
function selectedNode(draft: StoryDraft, nodeId: string): Record<string, unknown> | undefined {
  const index = nodeIndex(draft, nodeId);
  return index < 0 ? undefined : draft.document.nodes[index] as unknown as Record<string, unknown>;
}
export type LiteralKind = 'string' | 'number' | 'boolean';
function literalKinds(draft: StoryDraft): Record<string, LiteralKind> {
  const state = editorState(draft);
  return state.literalKinds ??= Object.create(null) as Record<string, LiteralKind>;
}
const NUMERIC_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function mutateNode(draft: StoryDraft, nodeId: string, mutate: (node: Record<string, unknown>) => boolean): boolean {
  const index = nodeIndex(draft, nodeId);
  if (index < 0) return false;
  const node = draft.document.nodes[index] as unknown as Record<string, unknown>;
  if (!mutate(node)) return false;
  draft.dirty = true;
  return true;
}

export function readProperty(draft: StoryDraft, nodeId: string, path: PropertyPath): unknown {
  const node = selectedNode(draft, nodeId);
  return node ? valueAt(node, path) : undefined;
}
/** Values are stored exactly as entered. In particular, numeric text remains text until projection. */
export function editProperty(draft: StoryDraft, nodeId: string, path: PropertyPath, value: unknown): boolean {
  if (!path.length || !selectedNode(draft, nodeId)) return false;
  const changed = mutateNode(draft, nodeId, node => assignAt(node, path, value));
  if (changed) {
    const rawKey = keyFor(draft, nodeId, path);
    const state = editorState(draft);
    if (typeof value === 'string') state.rawInputs[rawKey] = value;
    else delete state.rawInputs[rawKey];
    const node = selectedNode(draft, nodeId);
    if (node?.type === 'talklet' && path.length === 2 && path[0] === 'presentation' && path[1] === 'side') {
      if (value === 'right') parkPacing(draft, nodeId, node, state);
      else if (value === 'left' && (node.content as Record<string, unknown> | undefined)?.kind === 'talk') restorePacing(draft, nodeId, node, state);
    }
  }
  return changed;
}
/** Switch a discriminated object such as content, interaction, action, or command. */
export function selectBranch(draft: StoryDraft, nodeId: string, path: PropertyPath, branch: string): boolean {
  if (!path.length) return selectNodeType(draft, nodeId, branch as StoryNodeType);
  const current = readProperty(draft, nodeId, path);
  if (current !== undefined && !object(current)) return false;
  const discriminator = object(current) && ['kind', 'command', 'op', 'entryType', 'mode', 'valueKind', 'type'].find(key => typeof current[key] === 'string') || 'kind';
  return selectDiscriminant(draft, nodeId, path, discriminator as Discriminator, branch);
}
/** New branches carry only contract-fixed structure; text, options, effects and targets are never invented. */
function branchSeed(discriminator: Discriminator, branch: string): Record<string, unknown> {
  const base: Record<string, unknown> = { [discriminator]: branch };
  // An entry card always requests an active/card entry, so that combination is structure, not author data.
  if (discriminator === 'kind' && branch === 'entryCard') return { ...base, card: { request: { entryType: 'active', intent: 'card', owner: null } } };
  return base;
}
export function selectDiscriminant(draft: StoryDraft, nodeId: string, path: PropertyPath, discriminator: Discriminator, branch: string): boolean {
  if (!path.length) return false;
  const current = valueAt(selectedNode(draft, nodeId), path);
  if (current !== undefined && !object(current)) return false;
  if (object(current) && current[discriminator] !== undefined && typeof current[discriminator] !== 'string') return false;
  const previous = object(current) ? String(current[discriminator]) : '';
  if (previous === branch) return true;
  const state = editorState(draft);
  const baseKey = keyFor(draft, nodeId, path);
  if (object(current)) state.branches[`${baseKey}|${discriminator}:${previous}`] = structuredClone(current);
  const key = `${baseKey}|${discriminator}:${branch}`;
  const restored = state.branches[key];
  const next = restored === undefined ? branchSeed(discriminator, branch) : structuredClone(restored);
  const changed = mutateNode(draft, nodeId, node => assignAt(node, path, next));
  if (changed) state.optionals[`${baseKey}|activeBranch`] = branch;
  // A passive entry request has no card intent; the author must choose a legal intent again.
  if (changed && discriminator === 'entryType' && branch === 'passive') {
    const request = valueAt(selectedNode(draft, nodeId), path);
    if (object(request) && request.intent === 'card') mutateNode(draft, nodeId, node => assignAt(node, [...path, 'intent'], undefined, true));
  }
  const node = selectedNode(draft, nodeId);
  if (changed && path.length === 1 && path[0] === 'content' && node?.type === 'talklet') {
    if (branch === 'narration') parkPacing(draft, nodeId, node, state);
    else if (branch === 'talk' && (node.presentation as Record<string, unknown> | undefined)?.side !== 'right') restorePacing(draft, nodeId, node, state);
  }
  return changed;
}
/** Theme scope changes only its entity slot; the rest of the theme object remains active. */
export function selectThemeScope(draft: StoryDraft, nodeId: string, themePath: PropertyPath, scope: 'ephemeral' | 'area' | 'student'): boolean {
  if (!['ephemeral', 'area', 'student'].includes(scope)) return false;
  const node = selectedNode(draft, nodeId);
  if (!node) return false;
  const current = valueAt(node, themePath);
  if (current !== undefined && !object(current)) return false;
  const theme = object(current) ? structuredClone(current) : {};
  const oldScope = theme.scope === 'area' || theme.scope === 'student' ? theme.scope : 'ephemeral';
  const state = editorState(draft);
  const base = keyFor(draft, nodeId, themePath);
  if (typeof theme.entityKey === 'string') state.branches[`${base}|theme-entity:${oldScope}`] = theme.entityKey;
  if (scope === 'ephemeral') delete theme.entityKey;
  else {
    const restored = state.branches[`${base}|theme-entity:${scope}`];
    if (typeof restored === 'string') theme.entityKey = restored;
    else delete theme.entityKey;
  }
  theme.scope = scope;
  const changed = mutateNode(draft, nodeId, target => assignAt(target, themePath, theme));
  return changed;
}
function parkPacing(draft: StoryDraft, nodeId: string, node: Record<string, unknown>, state: PropertyEditorState): void {
  if (node.pacing === undefined) return;
  state.branches[`${nodeId}|side:pacing`] = structuredClone(node.pacing);
  delete node.pacing;
  // A parked pacing branch is asleep, not an enabled-but-empty optional: clear the switch too.
  state.optionals[keyFor(draft, nodeId, ['pacing'])] = false;
  draft.dirty = true;
}
function restorePacing(draft: StoryDraft, nodeId: string, node: Record<string, unknown>, state: PropertyEditorState): void {
  const pacing = state.branches[`${nodeId}|side:pacing`];
  if (pacing === undefined || node.pacing !== undefined) return;
  node.pacing = structuredClone(pacing);
  delete state.branches[`${nodeId}|side:pacing`];
  state.optionals[keyFor(draft, nodeId, ['pacing'])] = true;
  draft.dirty = true;
}
/** Enable/disable an optional field. A new optional starts absent until the author enters a value. */
export function toggleOptional(draft: StoryDraft, nodeId: string, path: PropertyPath, enabled: boolean): boolean {
  const node = selectedNode(draft, nodeId);
  if (!node || !path.length) return false;
  const state = editorState(draft);
  const key = keyFor(draft, nodeId, path);
  const hasValue = valueAt(node, path) !== undefined;
  if (!enabled && hasValue) state.branches[`${key}|optional`] = structuredClone(valueAt(node, path));
  const changed = enabled
    ? true
    : mutateNode(draft, nodeId, target => assignAt(target, path, undefined, true));
  state.optionals[key] = enabled;
  state.optionalPaths[key] = [...path];
  const guards: { path: readonly string[]; discriminator: Discriminator; value: string }[] = [];
  for (let length = 1; length < path.length; length++) {
    const prefix = path.slice(0, length);
    const value = valueAt(node, prefix);
    if (object(value)) {
      const discriminator = (['kind', 'command', 'op', 'entryType', 'mode', 'valueKind', 'type'] as const).find(name => typeof value[name] === 'string');
      if (discriminator) guards.push({ path: pathSegments(draft, nodeId, prefix), discriminator, value: String(value[discriminator]) });
    }
  }
  state.optionalBranches[key] = guards;
  if (enabled && !hasValue) {
    const cached = state.branches[`${key}|optional`];
    if (cached !== undefined) mutateNode(draft, nodeId, target => assignAt(target, path, structuredClone(cached)));
  }
  draft.dirty = true;
  return changed;
}
export function isOptionalEnabled(draft: StoryDraft, nodeId: string, path: PropertyPath): boolean {
  const key = keyFor(draft, nodeId, path);
  const saved = editorState(draft).optionals[key];
  return typeof saved === 'boolean' ? saved : readProperty(draft, nodeId, path) !== undefined;
}
export const optionalEnabled = isOptionalEnabled;

export function missingEnabledOptionalIssues(draft: StoryDraft): { path: string; message: string }[] {
  const state = draft.editorState;
  if (!state) return [];
  const issues: { path: string; message: string }[] = [];
  for (const [key, enabled] of Object.entries(state.optionals)) {
    if (enabled !== true) continue;
    const split = key.indexOf('|');
    if (split < 0) continue;
    const nodeId = key.slice(0, split);
    const node = selectedNode(draft, nodeId);
    if (!node) continue;
    const canonical = JSON.parse(key.slice(split + 1)) as string[];
    const resolved = resolveStablePath(draft, nodeId, canonical);
    if (!resolved) continue;
    const guards = state.optionalBranches[key] ?? [];
    const inactive = guards.some(guard => {
      const path = resolveStablePath(draft, nodeId, [...guard.path]);
      const parent = path ? valueAt(node, path) : undefined;
      return !object(parent) || parent[guard.discriminator] !== guard.value;
    });
    if (inactive) continue;
    const parent = valueAt(node, resolved.slice(0, -1));
    const target = valueAt(node, resolved);
    if (parent !== undefined && target === undefined) {
      const nodeIndex = nodeIndexFor(draft, nodeId);
      const field = resolved.map(segment => typeof segment === 'number' ? `[${segment}]` : `.${segment}`).join('').replace(/^\./, '');
      issues.push({ path: `nodes[${nodeIndex}].${field}`, message: '已启用的可选项尚未配置' });
    }
  }
  return issues;
}
function nodeIndexFor(draft: StoryDraft, nodeId: string): number { return draft.document.nodes.findIndex(node => node.id === nodeId); }
function resolveStablePath(draft: StoryDraft, nodeId: string, stable: readonly string[]): (string | number)[] | undefined {
  const node = selectedNode(draft, nodeId);
  return node ? resolveStableIn(node, draft, nodeId, stable) : undefined;
}
function resolveStableIn(node: Record<string, unknown>, draft: StoryDraft, nodeId: string, stable: readonly string[]): (string | number)[] | undefined {
  const resolved: (string | number)[] = [];
  let current: unknown = node;
  for (const part of stable) {
    if (part.startsWith('@')) {
      if (!Array.isArray(current)) return undefined;
      const ids = editorState(draft).rows[keyFor(draft, nodeId, resolved)];
      const index = ids?.indexOf(part.slice(1)) ?? -1;
      if (index < 0) return undefined;
      resolved.push(index); current = current[index];
    } else {
      resolved.push(part); current = object(current) ? current[part] : undefined;
    }
  }
  return resolved;
}

function listAt(draft: StoryDraft, nodeId: string, path: PropertyPath): unknown[] | undefined {
  const value = readProperty(draft, nodeId, path);
  return Array.isArray(value) ? value : undefined;
}
function rowIds(draft: StoryDraft, nodeId: string, path: PropertyPath, rows: readonly unknown[]): string[] {
  const state = editorState(draft);
  const key = keyFor(draft, nodeId, path);
  let ids = state.rows[key];
  if (!ids) { ids = rows.map(item => object(item) && typeof item.id === 'string' ? item.id : newId()); state.rows[key] = ids; }
  if (ids.length !== rows.length) state.rows[key] = [...rows].map((item, index) => object(item) && typeof item.id === 'string' ? item.id : ids[index] ?? newId());
  return state.rows[key];
}
export function rowIdAt(draft: StoryDraft, nodeId: string, path: PropertyPath, index: number): string | undefined {
  const rows = listAt(draft, nodeId, path);
  return rows && index >= 0 && index < rows.length ? rowIds(draft, nodeId, path, rows)[index] : undefined;
}
export function addRow(draft: StoryDraft, nodeId: string, path: PropertyPath, row: unknown = {}): string | undefined {
  const rows = listAt(draft, nodeId, path);
  if (!rows) return undefined;
  const id = object(row) && typeof row.id === 'string' ? row.id : newId();
  if (!mutateNode(draft, nodeId, node => assignAt(node, path, [...rows, row]))) return undefined;
  rowIds(draft, nodeId, path, rows).push(id);
  return id;
}
export function removeRow(draft: StoryDraft, nodeId: string, path: PropertyPath, rowId: string): boolean {
  const rows = listAt(draft, nodeId, path);
  if (!rows) return false;
  const ids = rowIds(draft, nodeId, path, rows);
  const index = ids.indexOf(rowId);
  if (index < 0 || !mutateNode(draft, nodeId, node => assignAt(node, [...path, index], undefined, true))) return false;
  clearRowEditorState(draft, nodeId, rowId);
  ids.splice(index, 1);
  return true;
}
function clearRowEditorState(draft: StoryDraft, nodeId: string, rowId: string): void {
  const state = draft.editorState;
  if (!state) return;
  const marker = `"@${rowId}"`;
  for (const bucket of [state.branches, state.optionals, state.optionalPaths, state.optionalBranches, state.rows, state.rawInputs]) {
    for (const key of Object.keys(bucket)) if (key.startsWith(`${nodeId}|`) && key.includes(marker)) delete bucket[key];
  }
}
export function moveRow(draft: StoryDraft, nodeId: string, path: PropertyPath, rowId: string, targetIndex: number): boolean {
  const rows = listAt(draft, nodeId, path);
  if (!rows) return false;
  const ids = rowIds(draft, nodeId, path, rows);
  const from = ids.indexOf(rowId);
  if (from < 0 || targetIndex < 0 || targetIndex >= rows.length || from === targetIndex) return false;
  const nextRows = [...rows]; const [row] = nextRows.splice(from, 1); nextRows.splice(targetIndex, 0, row);
  const nextIds = [...ids]; const [id] = nextIds.splice(from, 1); nextIds.splice(targetIndex, 0, id);
  if (!mutateNode(draft, nodeId, node => assignAt(node, path, nextRows))) return false;
  const key = keyFor(draft, nodeId, path); editorState(draft).rows[key] = nextIds;
  return true;
}
export function moveRowBy(draft: StoryDraft, nodeId: string, path: PropertyPath, rowId: string, delta: -1 | 1): boolean {
  const rows = listAt(draft, nodeId, path);
  if (!rows) return false;
  const index = rowIds(draft, nodeId, path, rows).indexOf(rowId);
  return moveRow(draft, nodeId, path, rowId, index + delta);
}

export function selectNodeType(draft: StoryDraft, nodeId: string, type: StoryNodeType): boolean {
  if (!['talklet', 'click', 'operation', 'transfer', 'moveToArea', 'moveToCharaspace'].includes(type)) return false;
  const node = selectedNode(draft, nodeId);
  if (!node || node.type === type) return Boolean(node);
  const state = editorState(draft);
  const oldType = String(node.type);
  const payload = structuredClone(node); delete payload.type; delete payload.id;
  delete payload.requiresFlag;
  state.branches[`${nodeId}|node:${oldType}`] = payload;
  const oldStage = (oldType === 'talklet' || oldType === 'click') && typeof node.stageId === 'string' ? node.stageId : undefined;
  if (oldStage && !draft.document.nodes.some(item => item.id !== nodeId && (item.type === 'talklet' || item.type === 'click') && item.stageId === oldStage)) {
    state.inactiveStageIds ??= [];
    if (!state.inactiveStageIds.includes(oldStage)) state.inactiveStageIds.push(oldStage);
  }
  const saved = state.branches[`${nodeId}|node:${type}`];
  const seed = type === 'moveToArea' ? { areaId: '' } : type === 'moveToCharaspace' ? { characterId: '' } : {};
  const next: Record<string, unknown> = { id: nodeId, ...(typeof node.requiresFlag === 'string' ? { requiresFlag: node.requiresFlag } : {}), ...seed, ...(object(saved) ? structuredClone(saved) : {}), type };
  // Talklet and Click require their own stage declaration; a switched node keeps its cached stage or gets a fresh one.
  if (type === 'talklet' || type === 'click') {
    const stages = { ...draft.document.stages } as Record<string, { advance: 'auto' | 'input' }>;
    const declared = typeof next.stageId === 'string' && validStageId(next.stageId) && Boolean(stages[next.stageId]);
    if (!declared) {
      const stageId = typeof next.stageId === 'string' && validStageId(next.stageId) ? next.stageId : `stage_${crypto.randomUUID().replace(/-/g, '')}`;
      next.stageId = stageId;
      stages[stageId] = { advance: type === 'click' ? 'input' : 'auto' };
      draft.document = { ...draft.document, stages };
    }
  }
  const index = nodeIndex(draft, nodeId);
  const nodes = [...draft.document.nodes] as unknown as Record<string, unknown>[];
  nodes[index] = next;
  draft.document = { ...draft.document, nodes: nodes as unknown as StoryDraftNode[] };
  const newStage = (type === 'talklet' || type === 'click') && typeof next.stageId === 'string' ? next.stageId : undefined;
  if (newStage && state.inactiveStageIds) state.inactiveStageIds = state.inactiveStageIds.filter(id => id !== newStage);
  draft.dirty = true;
  return true;
}
export function clearNodeEditorState(draft: StoryDraft, nodeId: string): void {
  const state = draft.editorState;
  if (!state) return;
  for (const bucket of [state.branches, state.optionals, state.optionalPaths, state.optionalBranches, state.rawInputs, state.literalKinds]) if (bucket) for (const key of Object.keys(bucket)) if (key.startsWith(`${nodeId}|`)) delete bucket[key];
  for (const key of Object.keys(state.rows)) if (key.startsWith(`${nodeId}|`)) delete state.rows[key];
}

const validStageId = (id: string): boolean => /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id);
export function editStage(draft: StoryDraft, nodeId: string, stageId: string, advance: 'auto' | 'input'): boolean {
  const node = selectedNode(draft, nodeId);
  if (!node || (node.type !== 'talklet' && node.type !== 'click') || !validStageId(stageId) || (advance !== 'auto' && advance !== 'input')) return false;
  const stages = draft.document.stages as Record<string, unknown>;
  draft.document = { ...draft.document, stages: { ...stages, [stageId]: { advance } } as StoryDraft['document']['stages'] };
  if (draft.editorState?.sourceUnreferencedStageIds) draft.editorState.sourceUnreferencedStageIds = draft.editorState.sourceUnreferencedStageIds.filter(id => id !== stageId);
  draft.dirty = true;
  return setNodeStage(draft, nodeId, stageId);
}
export function setNodeStage(draft: StoryDraft, nodeId: string, stageId: string): boolean {
  if (!validStageId(stageId) || !(draft.document.stages as Record<string, unknown>)[stageId]) return false;
  const existing = selectedNode(draft, nodeId);
  const previous = existing && (existing.type === 'talklet' || existing.type === 'click') && typeof existing.stageId === 'string' ? existing.stageId : undefined;
  const changed = mutateNode(draft, nodeId, node => (node.type === 'talklet' || node.type === 'click') && assignAt(node, ['stageId'], stageId));
  if (changed && previous && previous !== stageId && !draft.document.nodes.some(item => item.id !== nodeId && (item.type === 'talklet' || item.type === 'click') && item.stageId === previous)) {
    const state = editorState(draft);
    state.inactiveStageIds ??= [];
    if (!state.inactiveStageIds.includes(previous)) state.inactiveStageIds.push(previous);
  }
  if (changed && draft.editorState?.inactiveStageIds) draft.editorState.inactiveStageIds = draft.editorState.inactiveStageIds.filter(id => id !== stageId);
  return changed;
}

/** Explicit author removal. Unlike a branch switch this does not keep the old value in the branch cache. */
export function removeProperty(draft: StoryDraft, nodeId: string, path: PropertyPath): boolean {
  if (!path.length || !selectedNode(draft, nodeId)) return false;
  if (!mutateNode(draft, nodeId, node => assignAt(node, path, undefined, true))) return false;
  const state = editorState(draft);
  delete state.rawInputs[keyFor(draft, nodeId, path)];
  delete literalKinds(draft)[keyFor(draft, nodeId, path)];
  return true;
}

/** Literal type choice for flag/extra values; the active value keeps its own type until the author re-enters it. */
export function literalKindAt(draft: StoryDraft, nodeId: string, path: PropertyPath): LiteralKind | undefined {
  return literalKinds(draft)[keyFor(draft, nodeId, path)];
}
export function selectLiteralKind(draft: StoryDraft, nodeId: string, path: PropertyPath, kind: LiteralKind): boolean {
  const node = selectedNode(draft, nodeId);
  if (!node || !path.length || !['string', 'number', 'boolean'].includes(kind)) return false;
  const current = valueAt(node, path);
  const kinds = literalKinds(draft);
  const key = keyFor(draft, nodeId, path);
  const wanted = kind === 'boolean' ? typeof current === 'boolean' : kind === 'number' ? typeof current === 'number' : typeof current === 'string';
  kinds[key] = kind;
  if (wanted) { draft.dirty = true; return true; }
  // A number starts empty: never turn a blank or temporary '-' into 0.
  return editProperty(draft, nodeId, path, kind === 'boolean' ? false : '');
}
/** Apply the chosen literal type to the projection copy; text that is not a number stays text so validation reports it. */
export function applyLiteralKinds(draft: StoryDraft, document: unknown): void {
  const state = draft.editorState;
  if (!state?.literalKinds) return;
  const root = document as { nodes?: unknown };
  if (!Array.isArray(root.nodes)) return;
  for (const [key, kind] of Object.entries(state.literalKinds)) {
    const split = key.indexOf('|');
    if (split < 0) continue;
    const nodeId = key.slice(0, split);
    const index = root.nodes.findIndex(item => object(item) && item.id === nodeId);
    if (index < 0) continue;
    const node = root.nodes[index] as Record<string, unknown>;
    let stable: string[];
    try { stable = JSON.parse(key.slice(split + 1)) as string[]; } catch { continue; }
    if (!Array.isArray(stable)) continue;
    const resolved = resolveStableIn(node, draft, nodeId, stable);
    if (!resolved) continue;
    const current = valueAt(node, resolved);
    if (kind === 'number' && typeof current === 'string' && NUMERIC_TEXT.test(current)) assignAt(node, resolved, Number(current));
    else if (kind === 'boolean' && (current === 'true' || current === 'false')) assignAt(node, resolved, current === 'true');
  }
}
