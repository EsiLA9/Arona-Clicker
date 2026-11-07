import type { Datapack } from '../contracts/datapack';
import { collectDefinitionReferences } from '../registry/runtime-content-reference-rules';
import { patchStoryDatapack, validateStoryAuthoringShape, type StoryAuthoringPatch } from './story-authoring';

export interface StoryIdentityReference { table: string; id: string; path: string }
export interface StoryIdentityChange { fromId: string; toId: string; expectedDigest: string; patch: StoryAuthoringPatch }
export const validStoryId = (id: string): boolean => /^[a-z0-9_-]+:story:[a-z0-9_-]+$/.test(id);

export function storyIdentityReferences(value: unknown, table: string, id: string, storyId: string): StoryIdentityReference[] {
  const kind = table === 'activeStories' || table === 'passiveStories' ? 'storyEntries' : table;
  return collectDefinitionReferences({definitionKind:kind,fullId:id},value,[])
    .filter(ref => ref.confidence === 'declared' && ref.scope === 'global' && ref.value === storyId && ref.targetKinds?.includes('stories'))
    .map(ref => ({table,id,path:ref.path}));
}

export function packStoryIdentityReferences(pack: Datapack, storyId: string): StoryIdentityReference[] {
  return Object.entries(pack).flatMap(([table, rows]) => !Array.isArray(rows) ? [] : rows.flatMap(row =>
    row && typeof row === 'object' && typeof row.id === 'string' ? storyIdentityReferences(row,table,row.id,storyId) : []));
}

/** Only paths declared by the content reference rules may change identity. */
export function replaceStoryIdentityReferences(value: unknown, table: string, id: string, from: string, to: string): void {
  for (const ref of storyIdentityReferences(value,table,id,from)) {
    const path = [...ref.path.slice(1).matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g)];
    if (`$${path.map(part=>part[0]).join('')}` !== ref.path) throw new Error(`无法安全更新引用：${id} ${ref.path}`);
    const keys = path.map(part=>part[1] ?? Number(part[2]));
    let parent = value as Record<string | number, unknown>;
    for (const key of keys.slice(0,-1)) parent = parent[key] as typeof parent;
    if (!parent || parent[keys.at(-1)!] !== from) throw new Error(`引用已变化：${id} ${ref.path}`);
    parent[keys.at(-1)!] = to;
  }
}

export function planStoryIdentityChange(pack: Datapack, patch: StoryAuthoringPatch, fromId: string, toId: string): { datapack: Datapack; references: StoryIdentityReference[] } {
  const mod = pack.modName;
  if (!validStoryId(toId) || fromId === toId || fromId.split(':')[0] !== mod || toId.split(':')[0] !== mod) throw new Error('请输入同一 Mod 内尚未使用的 Story ID。');
  validateStoryAuthoringShape(patch, true);
  const datapack = patchStoryDatapack(structuredClone(pack),structuredClone(patch));
  if (datapack.stories?.some(story=>story.id===toId)) throw new Error(`Story ID 已存在：${toId}`);
  const story = datapack.stories?.find(story=>story.id===fromId);
  if (!story) throw new Error(`找不到原 Story：${fromId}`);
  const references = packStoryIdentityReferences(datapack,fromId);
  for (const [table, rows] of Object.entries(datapack)) if (Array.isArray(rows)) for (const row of rows) {
    if (row && typeof row === 'object' && typeof row.id === 'string') replaceStoryIdentityReferences(row,table,row.id,fromId,toId);
  }
  datapack.stories = datapack.stories.map(item=>item===story ? {...item,id:toId} : item);
  return {datapack,references};
}
