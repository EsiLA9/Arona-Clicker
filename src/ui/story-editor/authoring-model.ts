import type { ContentCatalogQueryPort } from '../../arona-clicker/contracts/runtime/content-catalog';
import { emptyStoryAuthoring, STORY_AUTHORING_TABLES, type StoryAuthoringPatch } from '../../data-services/authoring/story-authoring';
import { currentAuthoringDraft, storyDefinitionFromDraft, type StoryDraft, type StoryEditorState } from './model';
import { editProperty, propertyKey, addRow, removeRow, rowIdAt } from './property-model';
import { setValueAt, valueAt, readStructuredInput, presetValue, type ValuePath } from './structured-value';

export function hydrateStoryAuthoring(draft: StoryDraft, registry: ContentCatalogQueryPort): void {
  if (draft.authoring) return;
  const authoring = emptyStoryAuthoring();
  authoring.activeStories = structuredClone([...registry.activeStories.values()].filter(x => x.storyId === draft.document.id));
  authoring.passiveStories = structuredClone([...registry.passiveStories.values()].filter(x => x.storyId === draft.document.id));
  const entries = new Set([...authoring.activeStories, ...authoring.passiveStories].map(x => x.id));
  authoring.passivePools = structuredClone([...registry.passivePools.values()].filter(x => x.children.some(child => entries.has(child.id))));
  draft.authoring = authoring;
}

/** Stable action-row identities keep pending numeric input with its row after a move. */
export function structuredKey(draft: StoryDraft, scope: string, path: ValuePath): string {
  if (!scope.startsWith('$')) {
    path.forEach((segment,index)=>{if(typeof segment==='number')rowIdAt(draft,scope,path.slice(0,index),segment);});
    return propertyKey(draft, scope, path);
  }
  const root = scope === '$document' ? draft.document : draft.authoring;
  const stable: (string | number)[] = [];
  let value: unknown = root;
  for (const segment of path) {
    const next = valueAt(value, [segment]);
    if (typeof segment === 'number' && Array.isArray(value)) {
      draft.structuredRows ??= {}; const rowKey = JSON.stringify([scope,...stable]);
      const ids = draft.structuredRows[rowKey] ??= [];
      while(ids.length < value.length) ids.push(crypto.randomUUID());
      stable.push(`@${ids[segment] ?? segment}`);
    } else stable.push(segment);
    value = next;
  }
  return JSON.stringify([scope, ...stable]);
}
export function structuredRoot(draft: StoryDraft, scope: string): unknown {
  return scope === '$document' ? draft.document : scope === '$authoring' ? draft.authoring : draft.document.nodes.find(x => x.id === scope);
}
export function editStructuredValue(draft: StoryDraft, scope: string, path: ValuePath, kind: string, text: string): boolean {
  const input = readStructuredInput(kind, text); const key = structuredKey(draft, scope, path);
  draft.structuredInputs ??= {};
  draft.structuredInputs[key] = { text, ...(!input.ok ? { error: input.message } : {}) };
  draft.dirty = true;
  if (!input.ok) return true;
  const changed = writeStructuredValue(draft, scope, path, input.value);
  if (changed) delete draft.structuredInputs[key];
  return changed;
}
export function writeStructuredValue(draft: StoryDraft, scope: string, path: ValuePath, value: unknown, remove = false): boolean {
  if (path.some(key=>typeof key==='string' && ['__proto__','constructor','prototype'].includes(key))) return false;
  let changed: boolean;
  const parentPath = path.slice(0,-1); const index = path[path.length-1]; const parent = valueAt(structuredRoot(draft,scope),parentPath);
  if (!scope.startsWith('$') && Array.isArray(parent) && typeof index === 'number' && remove) changed = removeRow(draft,scope,parentPath,rowIdAt(draft,scope,parentPath,index) ?? '');
  else if (!scope.startsWith('$') && Array.isArray(parent) && typeof index === 'number' && index === parent.length) changed = Boolean(addRow(draft,scope,parentPath,value));
  else if (!scope.startsWith('$') && !remove) changed = editProperty(draft, scope, path, value);
  else {
    const rowKey = structuredKey(draft,scope,parentPath);
    changed = setValueAt(structuredRoot(draft, scope), path, value, remove);
    if (changed && remove && Array.isArray(parent) && typeof index === 'number') draft.structuredRows?.[rowKey]?.splice(index,1);
  }
  if (!changed) return false;
  if (!scope.startsWith('$') && path[0] === 'action' && path[1] === 'value' && draft.localFlagInputs) delete draft.localFlagInputs[scope];
  draft.dirty = true;
  return true;
}
export function constructStructuredValue(draft: StoryDraft, scope: string, path: ValuePath, kind: string): boolean {
  if (!kind) return false;
  const key = structuredKey(draft, scope, path);
  for (const input of Object.keys(draft.structuredInputs ?? {})) if (input === key || input.startsWith(key.slice(0, -1) + ',')) delete draft.structuredInputs![input];
  return writeStructuredValue(draft, scope, path, presetValue(kind));
}
export function compileStoryAuthoring(state: StoryEditorState): { ok: true; patch: StoryAuthoringPatch } | { ok: false; message: string } {
  const patch = emptyStoryAuthoring();
  const current = currentAuthoringDraft(state);
  if (!current) return { ok: false, message: '先选择 Story。' };
  const needed = new Set([current.document.id]);
  const entries = new Map(state.drafts.flatMap(x => [...(x.authoring?.activeStories ?? []), ...(x.authoring?.passiveStories ?? [])]).map(x => [x.id,x]));
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'storyId' && typeof child === 'string') needed.add(child);
      if ((key === 'entryId' || key === 'storyEntryId' || key === 'id') && typeof child === 'string' && entries.has(child)) needed.add(entries.get(child)!.storyId);
      visit(child);
    }
  };
  let size = 0;
  while (size !== needed.size) { size = needed.size; for (const draft of state.drafts) if (needed.has(draft.document.id)) { visit(draft.document); visit(draft.authoring); } }
  for (const draft of state.drafts) {
    if (!needed.has(draft.document.id)) continue;
    const result = storyDefinitionFromDraft(draft);
    if (!result.ok) return result;
    patch.stories.push(result.story);
    for (const [table, ids] of Object.entries(draft.authoring?.removed ?? {})) {
      patch.removed ??= {}; const key = table as keyof NonNullable<StoryAuthoringPatch['removed']>;
      patch.removed[key] = [...new Set([...(patch.removed[key] ?? []), ...ids])];
    }
    for (const table of STORY_AUTHORING_TABLES) if (table !== 'stories') for (const row of draft.authoring?.[table] ?? []) {
      const prior = patch[table].find(x => x.id === row.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(row)) return { ok: false, message: `${row.id} 在多个草稿中有冲突修改，请统一后再提交。` };
      if (!prior) (patch[table] as { id: string }[]).push(structuredClone(row));
    }
  }
  return { ok: true, patch };
}
export function copyStoryIdentity(state: StoryEditorState, draft: StoryDraft, id: string, existing: ReadonlySet<string>): boolean {
  if (!/^[a-z0-9_-]+:story:[a-z0-9_-]+$/.test(id) || existing.has(id) || state.drafts.some(x => x.document.id === id)) return false;
  const copy: StoryDraft = structuredClone(draft);
  copy.draftId = crypto.randomUUID(); copy.sourceId = null; copy.document = { ...copy.document, id };
  delete copy.renamedFromId; delete copy.targetPackId;
  const rebindDisplayTargets=(value:unknown):void=>{
    if(!value||typeof value!=='object')return;
    const row=value as Record<string,unknown>;
    if(row.kind==='clearNode'&&row.storyId===draft.document.id)row.storyId=id;
    Object.values(row).forEach(rebindDisplayTargets);
  };
  rebindDisplayTargets(copy.document);rebindDisplayTargets(copy.editorState?.branches);
  copy.authoring = emptyStoryAuthoring(); copy.dirty = true; copy.persisted = false; copy.savedAt = null;
  state.drafts.push(copy); state.target = { kind: 'story', id }; state.selectedNodeId = null;
  return true;
}
export function addStoryAuthoringRow(draft: StoryDraft, table: 'activeStories' | 'passiveStories' | 'passivePools', affectionOwner?: string): void {
  draft.authoring ??= emptyStoryAuthoring();
  const mod = draft.document.id.split(':')[0]; const name = `entry_${crypto.randomUUID().replace(/-/g, '')}`;
  const id = `${mod}:${table === 'passivePools' ? 'passivepool' : table === 'activeStories' ? 'activestory' : 'passivestory'}:${name}`;
  if (table === 'passivePools') draft.authoring.passivePools.push({ id, name: '新被动池', children: [] });
  else {
    const entry = { id, storyId: draft.document.id, availableInits: [], triggerCondition: { type: 'OR' as const, conditions: [] } };
    if (table === 'activeStories') draft.authoring.activeStories.push({ ...entry, activation: {kind:'active'} });
    else if(affectionOwner) draft.authoring.passiveStories.push({...entry,owner:affectionOwner,activation:{kind:'affection',when:{kind:'level',level:1}}});
    else draft.authoring.passiveStories.push({ ...entry, activation: { kind: 'random' as const, weight: 1, repeatable: false } });
  }
  draft.dirty = true;
}
