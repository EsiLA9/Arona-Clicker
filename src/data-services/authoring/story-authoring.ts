import { validateStoryEntryActivation } from '../validation/story-entry';
import { storyEntryType } from '../contracts/story-entry';
import { projectStoryDefinition } from './story-definition-projection';
import { validateEffectList } from './content-policy-dsl';
import type { Datapack } from '../contracts/datapack';
import type { StoryDef } from '../contracts/story';
import type { ActiveStoryEntry, PassiveStoryEntry } from '../contracts/story-entry';
import type { PassivePoolDef } from '../contracts/passive-pool';

/** One author transaction; omitted rows remain unchanged. IDs are never implicitly renamed. */
export interface StoryAuthoringPatch {
  stories: StoryDef[];
  activeStories: ActiveStoryEntry[];
  passiveStories: PassiveStoryEntry[];
  passivePools: PassivePoolDef[];
  removed?: Partial<Record<'stories' | 'activeStories' | 'passiveStories' | 'passivePools', string[]>>;
}
export type StoryAuthoringResult = { ok: true; message: string } | { ok: false; message: string };
// shortcut: author input is limited to 128 JSON levels; raise with matching renderer limits if deeper authored data is needed.
export const STORY_AUTHORING_MAX_DEPTH = 128;
export const STORY_AUTHORING_TABLES = ['stories', 'activeStories', 'passiveStories', 'passivePools'] as const;
export function emptyStoryAuthoring(): StoryAuthoringPatch { return { stories: [], activeStories: [], passiveStories: [], passivePools: [] }; }
export function mergeStoryRows<T extends { id: string }>(current: Iterable<T>, updates: readonly T[]): T[] {
  if (!Array.isArray(updates)) throw new Error('作者内容必须是列表');
  const seen = new Set<string>(); const map = new Map([...current].map(row => [row.id, row]));
  for (const row of updates) {
    if (!row || typeof row.id !== 'string' || !row.id.trim() || seen.has(row.id)) throw new Error(`内容身份缺失或重复：${row?.id}`);
    seen.add(row.id); map.set(row.id, structuredClone(row));
  }
  return [...map.values()];
}
export function patchStoryDatapack(pack: Datapack, patch: StoryAuthoringPatch): Datapack {
  const result = structuredClone(pack);
  for (const table of STORY_AUTHORING_TABLES) {
    const rows = mergeStoryRows<{ id: string }>((pack[table] ?? []).filter(x => !patch.removed?.[table]?.includes(x.id)), patch[table]);
    (result as unknown as Record<string, unknown>)[table] = rows;
  }
  return result;
}

/** Guard author input before the existing document/reference validators inspect it. */
export function validateStoryAuthoringShape(patch: StoryAuthoringPatch, draftOnly = false): void {
  const walk = (v: unknown, depth: number, active: Set<object>): void => {
    if (depth > STORY_AUTHORING_MAX_DEPTH) throw new Error('作者数据结构过深');
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (!v || typeof v !== 'object' || active.has(v) || Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null && !Array.isArray(v)) throw new Error('作者数据必须是无循环的 JSON');
    active.add(v);
    for (const [k, child] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('作者字段名称非法');
      walk(child, depth + 1, active);
    }
    active.delete(v);
  };
  walk(patch, 0, new Set());
  for (const table of STORY_AUTHORING_TABLES) if (!Array.isArray(patch[table])) throw new Error(`${table} 必须是列表`);
  if (patch.removed) for (const [table, ids] of Object.entries(patch.removed)) {
    if (!STORY_AUTHORING_TABLES.includes(table as never) || !Array.isArray(ids) || !ids.every(x => typeof x === 'string') || ids.some(id => patch[table as keyof Pick<StoryAuthoringPatch, 'stories' | 'activeStories' | 'passiveStories' | 'passivePools'>].some(x => x.id === id))) throw new Error('不能同时删除与更新同一内容');
  }
  for (const table of STORY_AUTHORING_TABLES) if (!patch[table].every(row=>row && typeof row==='object' && !Array.isArray(row))) throw new Error(`${table} 的行必须是对象`);
  for (const entry of patch.activeStories) validateStoryEntryActivation(entry,'active',draftOnly);
  for (const entry of patch.passiveStories) validateStoryEntryActivation(entry,'passive',draftOnly);
  if (draftOnly) return;
  for (const [table, type] of [['activeStories', 'active'], ['passiveStories', 'passive']] as const) for (const entry of patch[table]) {
    if (storyEntryType(entry) !== type || typeof entry.storyId !== 'string' || !Array.isArray(entry.availableInits) || !entry.availableInits.every(x => typeof x === 'string')) throw new Error(`${entry.id} 的类型、Story 或 Init 列表非法`);
    const condition = (c: unknown): boolean => {
      const group = c && typeof c === 'object' && 'conditions' in c ? c : { type: 'AND', conditions: [c] };
      return projectStoryDefinition({ id: 'authoring:story:condition', name: 'condition', startContext: {type:'area',areaId:'authoring:area:context'}, stages: {s:{advance:'input'}}, nodes: [{id:'choice',type:'click',stageId:'s',interaction:{kind:'choice',options:[{id:'one',text:'one',showWhen:group}]}}] }).ok;
    };
    if (!entry.triggerCondition || !('conditions' in entry.triggerCondition) || !condition(entry.triggerCondition)) throw new Error(`${entry.id} 的触发条件非法`);
    const raw = entry as unknown as Record<string, unknown>;
    const allowed = ['id','storyId','availableInits','tags','triggerCondition','revealTriggers','replayable','travelToStartContext','completionStrategy','conditionalRewards','branchGuards','openingTitle','extra','kizuna','reactions','followUps','activation','catalog','directoryPlacements','completionReward','owner',...(type === 'passive' ? ['block','interruptible','leaveArea','blocksInteraction'] : [])];
    if (Object.keys(raw).some(key => !allowed.includes(key))) throw new Error(`${entry.id} 含未知的 Entry 字段`);
    for (const key of ['owner','openingTitle']) if (raw[key] !== undefined && typeof raw[key] !== 'string') throw new Error(`${entry.id}.${key} 必须是文字`);
    if (entry.kizuna && (typeof entry.kizuna !== 'object' || Array.isArray(entry.kizuna) || Object.keys(entry.kizuna).some(key=>!['entryId','areaId','returnFlags'].includes(key)))) throw new Error(`${entry.id} 的羁绊关联只能配置目标、赴约地点和回传白名单`);
    if (entry.completionReward && (typeof entry.completionReward !== 'object' || Array.isArray(entry.completionReward) || Object.keys(entry.completionReward).some(key=>!['first','repeat'].includes(key)))) throw new Error(`${entry.id} 完成奖励结构非法`);
    if (entry.completionStrategy !== undefined && !['simple','conditional'].includes(entry.completionStrategy)) throw new Error(`${entry.id} 完成策略非法`);
    const effects = (value: unknown, path: string): void => {
      const problem = validateEffectList(value,path); if (problem) throw new Error(`${problem.path}：${problem.message}`);
      for (const raw of value as Record<string,unknown>[]) {
        const op = String(raw.op); let action: Record<string,unknown> | undefined;
        const keys: Record<string,string> = {setResource:'resourceId',addResource:'resourceId',setSpotLevel:'spotId',addSpotLevel:'spotId',addItem:'itemId',addAffectionExp:'variantId',addExtra:'path'};
        if (keys[op]) action={kind:'state',effects:[{op,[keys[op]]:raw.target,amount:raw.value}]};
        else if (op==='setFlag') action={kind:'state',effects:[{op,flagId:raw.target,value:raw.value}]};
        else if (op==='setExtra') action={kind:'state',effects:[{op,path:raw.target,value:raw.value}]};
        if (!action) continue;
        const projected=projectStoryDefinition({id:'authoring:story:effect',name:'effect',startContext:{type:'area',areaId:'authoring:area:context'},stages:{},nodes:[{id:'effect',type:'operation',action}]});
        if (!projected.ok) throw new Error(`${path}：${projected.issues[0]?.message}`);
      }
    };
    if (entry.completionReward) for (const key of ['first','repeat'] as const) if (entry.completionReward[key] !== undefined) effects(entry.completionReward[key],`${entry.id}.completionReward.${key}`);
    if (storyEntryType(entry) === 'passive' && entry.block !== undefined && !condition(entry.block)) throw new Error(`${entry.id}.block 非法`);
    for (const reward of entry.conditionalRewards ?? []) { if (!condition(reward.condition)) throw new Error(`${entry.id} 条件奖励条件非法`); effects(reward.effects,`${entry.id}.conditionalRewards.effects`); }
    for (const reveal of entry.revealTriggers ?? []) if (!['existence','name','condition','utility','unlock'].includes(reveal.reveal) || reveal.condition !== undefined && !condition(reveal.condition)) throw new Error(`${entry.id} 揭示配置非法`);
    for (const guard of entry.branchGuards ?? []) if (!guard || typeof guard.storyId!=='string' || typeof guard.denialMessage!=='string' || !Array.isArray(guard.prerequisites) || !guard.prerequisites.every(x=>typeof x.storyId==='string'&&Number.isInteger(x.talkletIndex)&&x.talkletIndex>=-1)) throw new Error(`${entry.id} 分支门控结构非法`);
    for (const follow of entry.followUps ?? []) if (typeof follow?.id!=='string') throw new Error(`${entry.id} 独立后续身份非法`);
    const reactionIds = new Set<string>();
    for (const reaction of entry.reactions ?? []) {
      if (!reaction || typeof reaction.id!=='string' || !reaction.id || reactionIds.has(reaction.id) || !reaction.on || !['tick','resource','spotLevel','item','story','init','area','shop','character','cultivated'].includes(reaction.on.kind)) throw new Error(`${entry.id} 完结反应身份 / 事件非法`);
      reactionIds.add(reaction.id);
      for (const [key,value] of Object.entries(reaction.on)) if(key!=='kind' && key!=='every' && typeof value!=='string') throw new Error(`${entry.id} 反应事件参数非法`);
      if(reaction.on.kind==='tick'&&reaction.on.every!==undefined&&(!Number.isFinite(reaction.on.every)||reaction.on.every<=0)) throw new Error(`${entry.id} 反应间隔必须为正数`);
      if (reaction.condition !== undefined && !condition(reaction.condition)) throw new Error(`${entry.id} 完结反应条件非法`);
      if (reaction.activation !== undefined && reaction.activation !== 'after-completion' || reaction.lifetime !== undefined && !['current-init','until-consumed'].includes(reaction.lifetime) || reaction.once !== undefined && typeof reaction.once !== 'boolean') throw new Error(`${entry.id} 完结反应生命周期非法`);
      effects(reaction.effects,`${entry.id}.reactions.effects`);
    }
    for (const name of ['replayable', 'travelToStartContext', 'interruptible', 'leaveArea', 'blocksInteraction']) {
      const value = (entry as unknown as Record<string, unknown>)[name];
      if (value !== undefined && typeof value !== 'boolean') throw new Error(`${entry.id}.${name} 必须是布尔值`);
    }

  }
}
