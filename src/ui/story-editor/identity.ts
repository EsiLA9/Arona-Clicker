import type { PackCatalogReadModel } from '../../arona-clicker/contracts/runtime/runtime';
import type { Datapack } from '../../data-services/contracts/datapack';
import type { StoryDef } from '../../data-services/contracts/story';
import { emptyStoryAuthoring, STORY_AUTHORING_TABLES } from '../../data-services/authoring/story-authoring';
import { planStoryIdentityChange, replaceStoryIdentityReferences, storyIdentityReferences } from '../../data-services/authoring/story-identity';
import { cloneStory, storyDefinitionFromDraft, type StoryDraft, type StoryEditorState } from './model';

export function storyEditingMods(game: object) {
  return ((game as Partial<PackCatalogReadModel>).getPackCatalog?.().entries ?? []).filter(pack=>pack.editingMode==='editing');
}
export function knownModStoryIds(game: object, mod: string): string[] {
  const query=game as Partial<PackCatalogReadModel>;
  return (query.getPackCatalog?.().entries ?? []).filter(pack=>pack.modName===mod).flatMap(pack=>
    query.getPackRecord?.(pack.packRecordId ?? pack.id)?.datapack.stories.map(story=>story.id) ?? []);
}
export function storyEditingMod(game: object, id: string) {
  const entry = storyEditingMods(game).find(pack=>(pack.packRecordId ?? pack.id)===id);
  const record = (game as Partial<PackCatalogReadModel>).getPackRecord?.(id);
  if (!entry || !record || record.editingMode !== 'editing' || record.manifest.modName !== record.datapack.modName) throw new Error('请选择仍可编辑的 Mod。');
  return {entry,record};
}

function rewriteDraft(draft: StoryDraft, from: string, to: string): void {
  replaceStoryIdentityReferences(draft.document,'stories',draft.document.id,from,to);
  for (const table of STORY_AUTHORING_TABLES) for (const row of draft.authoring?.[table] ?? []) replaceStoryIdentityReferences(row,table,row.id,from,to);
  for (const [key,value] of Object.entries(draft.editorState?.branches ?? {})) {
    let fragment: unknown;
    if (/\|node:(transfer|click|operation)$/.test(key)) fragment=value;
    else {
      const first=key.indexOf('|'),last=key.lastIndexOf('|');
      let path: unknown; try {path=JSON.parse(key.slice(first+1,last));} catch {continue;}
      if (!Array.isArray(path) || !['transfer','interaction','action'].includes(path[0])) continue;
      fragment=value;
      for (const segment of [...path].reverse()) fragment=typeof segment==='number' || String(segment).startsWith('@') ? [fragment] : {[segment]:fragment};
    }
    replaceStoryIdentityReferences({nodes:[fragment]},'stories',draft.document.id,from,to);
  }
  if (draft.flagImports) draft.flagImports=Object.fromEntries(Object.entries(draft.flagImports).map(([key,choice])=>{
    try {const parts=JSON.parse(key);if(Array.isArray(parts) && parts[0]==='story' && parts[1]===from){parts[1]=to;return [JSON.stringify(parts),choice];}} catch { /* Preserve unknown historical keys. */ }
    return [key,choice];
  }));
}

export function planEditorStoryRename(state: StoryEditorState, packId: string, pack: Datapack, draftId: string, toId: string, registered: ReadonlySet<string>) {
  const original=state.drafts.find(draft=>draft.draftId===draftId);
  if (!original) throw new Error('原 Story 草稿已不存在。');
  const fromId=original.document.id;
  if (registered.has(toId) || state.drafts.some(draft=>draft!==original && draft.document.id===toId)) throw new Error(`Story ID 已存在：${toId}`);
  const published=Boolean(pack.stories?.some(story=>story.id===fromId));
  if (!published && (original.sourceId || registered.has(fromId))) throw new Error('请先将此 Story 保存到所属编辑态 Mod，再更改 ID。');
  const patch=emptyStoryAuthoring(), drafts=state.drafts.map(cloneStory);
  const affected=new Set<string>();
  for (const draft of drafts) {
    const hasReference=storyIdentityReferences(draft.document,'stories',draft.document.id,fromId).length>0
      || STORY_AUTHORING_TABLES.some(table=>(draft.authoring?.[table] ?? []).some(row=>storyIdentityReferences(row,table,row.id,fromId).length));
    const rewritten=cloneStory(draft);rewriteDraft(rewritten,fromId,toId);
    const hasCachedReference=JSON.stringify(rewritten.editorState)!==JSON.stringify(draft.editorState);
    if (draft.draftId!==draftId && !hasReference && !hasCachedReference) continue;
    if (draft.document.id.split(':')[0]!==pack.modName || draft.targetPackId && draft.targetPackId!==packId
      || draft.sourceId && !pack.stories?.some(story=>story.id===draft.document.id)) throw new Error(`其他 Mod / 草稿仍引用此 Story：${draft.document.id}`);
    if (published) {
      const projected=storyDefinitionFromDraft(draft);
      if (!projected.ok) throw new Error(`${draft.document.id}：${projected.message}`);
      patch.stories.push(projected.story);
    } else patch.stories.push(cloneStory(draft.document) as StoryDef);
    for (const table of STORY_AUTHORING_TABLES) if (table!=='stories') for (const row of draft.authoring?.[table] ?? []) {
      const previous=patch[table].find(item=>item.id===row.id);
      if (previous && JSON.stringify(previous)!==JSON.stringify(row)) throw new Error(`多个草稿对 ${row.id} 的修改冲突。`);
      if (!previous) (patch[table] as {id:string}[]).push(cloneStory(row));
    }
    if (Object.values(draft.authoring?.removed ?? {}).some(ids=>ids?.length)) throw new Error('请先保存待删除内容，再更改 Story ID。');
    affected.add(draft.draftId);
  }
  if (published) for (const table of STORY_AUTHORING_TABLES) for (const row of patch[table]) {
    if (!(pack[table] ?? []).some(item=>item.id===row.id)) throw new Error(`请先将 ${row.id} 保存到目标 Mod，再更改 Story ID。`);
  }
  const plan=planStoryIdentityChange(pack,patch,fromId,toId);
  for (const draft of drafts) if (affected.has(draft.draftId)) {
    rewriteDraft(draft,fromId,toId);
    if (draft.draftId===draftId) {
      draft.document={...draft.document,id:toId};draft.targetPackId=packId;
      if (published) {draft.sourceId ??= fromId;draft.renamedFromId=draft.sourceId;}
    }
    draft.dirty=true;
  }
  for (const draft of drafts) if (!affected.has(draft.draftId) && draft.flagImports) {
    const metadata=cloneStory(draft);rewriteDraft(metadata,fromId,toId);
    if (JSON.stringify(metadata.flagImports)!==JSON.stringify(draft.flagImports)) {draft.flagImports=metadata.flagImports;draft.dirty=true;}
  }
  return {...plan,patch,drafts,affected,fromId,published};
}

export function acceptEditorStoryRename(state: StoryEditorState, drafts: StoryDraft[], fromId: string, toId: string): void {
  for (const draft of state.drafts) Object.assign(draft,drafts.find(next=>next.draftId===draft.draftId)!);
  if (state.target?.kind==='story' && state.target.id===fromId) state.target={kind:'story',id:toId};
  for (const visit of state.visits) if (visit.target.kind==='story' && visit.target.id===fromId) visit.target={kind:'story',id:toId};
}
