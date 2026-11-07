import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { validateStoryEntryActivation } from '../../data-services/validation/story-entry';
import type { StoryDraft } from './model';

export type EntryActivation = StoryEntryDef['activation'];
export function defaultEntryActivation(kind: EntryActivation['kind']): EntryActivation {
  return kind === 'active' ? {kind} : kind === 'random' ? {kind,weight:1,repeatable:false} : {kind,when:{kind:'level',level:1}};
}

/** Commit the reviewed branch as one draft mutation; failure leaves the original row intact. */
export function changeEntryActivation(draft: StoryDraft, id: string, activation: EntryActivation, owner?: string): void {
  const authoring = draft.authoring!;
  const from = authoring.activeStories.some(row=>row.id===id) ? 'activeStories' : 'passiveStories';
  const index = authoring[from].findIndex(row=>row.id===id), row = authoring[from][index];
  if (!row) throw new Error('Entry 已不存在。');
  if (Object.values(draft.structuredInputs ?? {}).some(input=>input.error)) throw new Error('请先修正尚未提交的字段输入。');
  if (activation.kind !== 'random' && authoring.passivePools.some(pool=>pool.children.some(child=>child.id===id))) throw new Error('请先从关联抽取池中移除此 Entry。');
  const candidate = {...structuredClone(row),activation:structuredClone(activation),...(owner ? {owner} : {})};
  if (activation.kind==='active') for (const key of ['block','interruptible','leaveArea','blocksInteraction'] as const) delete candidate[key];
  const to = activation.kind==='active' ? 'activeStories' : 'passiveStories';
  validateStoryEntryActivation(candidate,to==='activeStories'?'active':'passive');
  if (from===to) Object.assign(row,candidate);
  else {
    authoring[from].splice(index,1);
    if(to==='activeStories') authoring.activeStories.push(candidate as import('../../data-services/contracts/story-entry').ActiveStoryEntry);
    else authoring.passiveStories.push(candidate as import('../../data-services/contracts/story-entry').PassiveStoryEntry);
    const oldKey=JSON.stringify(['$authoring',from]),newKey=JSON.stringify(['$authoring',to]);
    const token=draft.structuredRows?.[oldKey]?.splice(index,1)[0];
    if(token){const ids=draft.structuredRows![newKey] ??= [];while(ids.length<authoring[to].length-1)ids.push(crypto.randomUUID());ids.push(token);}
    for(const [key,input] of Object.entries(draft.structuredInputs ?? {})) {
      const parts=JSON.parse(key);if(parts[0]==='$authoring'&&parts[1]===from&&parts[2]===`@${token}`){parts[1]=to;draft.structuredInputs![JSON.stringify(parts)]=input;delete draft.structuredInputs![key];}
    }
    authoring.removed ??= {}; (authoring.removed[from] ??= []).push(id);
    if(authoring.removed[to]) authoring.removed[to]=authoring.removed[to]!.filter(value=>value!==id);
  }
  draft.dirty=true;
}
