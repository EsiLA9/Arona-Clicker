import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import { emptyStoryAuthoring } from '../../src/data-services/authoring/story-authoring';
import type { StoryAuthoringPreview } from '../../src/arona-clicker/contracts/runtime/story-authoring';

const makePatch = () => ({ ...emptyStoryAuthoring(),
  stories: [{ id: 'test:story:authoring', name: '作者故事', startContext: { type: 'area' as const, areaId: baseDatapack.areas[0].id }, stages: { s: { advance: 'input' as const } }, nodes: [
    { id: 'choice', type: 'click' as const, stageId: 's', interaction: { kind: 'choice' as const, options: [
      { id: 'one', text: '写入本次结果', result: { actions: [{ kind: 'localFlag' as const, op: 'set' as const, name: 'answer', value: { count: 2 } }] } },
    ] } },
    { id: 'tail', type: 'talklet' as const, stageId: 's', requiresFlag: 'answer', content: { kind: 'narration' as const, text: '正确后续' } },
  ] }],
  activeStories: [{ id: 'test:activestory:authoring', type: 'active' as const, storyId: 'test:story:authoring', availableInits: [], triggerCondition: { type: 'AND' as const, conditions: [] }, replayable: true }],
});
describe('Story authoring transactions', () => {
  let game: GameInstance | undefined; let preview: StoryAuthoringPreview | undefined;
  afterEach(() => { preview?.close(); preview = undefined; game?.storyService.dispose(); game?.stop(); vi.useRealTimers(); });
  const start = () => { game = new GameInstance(); game.init([baseDatapack]); return game; };
  it('checks without writing and commits related documents and entries together', () => {
    const game = start(); const patch = makePatch();
    Object.assign(patch.stories[0],{extra:{t:'dict',v:Object.assign(Object.create(null),{note:{t:'str',v:'作者扩展'}})}});
    Object.assign(patch.activeStories[0],{tags:[['test:story/author']]});
    const checked = game.validateStoryAuthoring(patch); expect(checked,checked.message).toMatchObject({ ok: true });
    expect(game.registry.stories.has(patch.stories[0].id)).toBe(false);
    expect(game.applyStoryAuthoring(patch)).toMatchObject({ ok: true });
    patch.stories[0].name = '外部改动';
    expect(game.registry.stories.get('test:story:authoring')?.name).toBe('作者故事');
    expect(game.registry.activeStories.has('test:activestory:authoring')).toBe(true);
    expect(game.tagStatService.declaredCount('activeStories','test:story/author')).toBe(1);
  });
  it('rejects an invalid reference without publishing any row', () => {
    const game = start(); const patch = makePatch(); patch.activeStories[0].storyId = 'missing:story:no';
    expect(game.applyStoryAuthoring(patch)).toMatchObject({ ok: false });
    expect(game.registry.stories.has('test:story:authoring')).toBe(false);
    expect(game.registry.activeStories.has('test:activestory:authoring')).toBe(false);
  });
  it('rejects recursive pools and malformed entry fields before writing', () => {
    const game = start(); const patch = makePatch();
    patch.passivePools.push({ id: 'test:passivepool:loop', children: [{ id: 'test:passivepool:loop' }] });
    expect(game.applyStoryAuthoring(patch)).toMatchObject({ ok: false });
    patch.passivePools = []; (patch.activeStories[0] as unknown as Record<string,unknown>).replayable = 'true';
    expect(game.applyStoryAuthoring(patch)).toMatchObject({ ok: false });
    expect(game.registry.stories.has('test:story:authoring')).toBe(false);
  });
  it('plays unpublished candidate input and flags in an isolated instance', () => {
    const game = start(); const before = structuredClone(game.state);
    const result = game.createStoryAuthoringPreview(makePatch(),'test:activestory:authoring');
    expect(result.ok,JSON.stringify(result)).toBe(true); if (!result.ok) return;
    preview = result.preview;
    expect(preview.getView()?.phase).toBe('input');
    expect(preview.advance('one')).toMatchObject({ ok: true });
    expect(game.registry.stories.has('test:story:authoring')).toBe(false);
    expect(game.state).toEqual(before);
    preview.close(); expect(preview.getView()).toBeNull();
  });
  it('follows the child channel and returns only the allowed flags during whole-story preview', () => {
    vi.useFakeTimers(); const game = start(); const patch = makePatch();
    patch.stories.push({ id:'test:story:parent',name:'parent',startContext:{type:'area',areaId:baseDatapack.areas[0].id},stages:{s:{advance:'input'}},nodes:[
      {id:'call',type:'click',stageId:'s',interaction:{kind:'kizunaCard'}},
      {id:'back',type:'talklet',stageId:'s',requiresFlag:'answer',content:{kind:'narration',text:'父后文'}},
    ] } as never);
    patch.activeStories.push({id:'test:activestory:parent',type:'active',storyId:'test:story:parent',availableInits:[],triggerCondition:{type:'AND',conditions:[]},replayable:true,kizuna:{entryId:'test:activestory:authoring',returnFlags:['answer']}} as never);
    const result=game.createStoryAuthoringPreview(patch,'test:activestory:parent');expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return;
    preview=result.preview;expect(preview.advance()).toMatchObject({ok:true});
    expect(preview.getStory()?.storyId).toBe('test:activestory:authoring');
    expect(preview.advance('one')).toMatchObject({ok:true});
    for(let i=0;i<10 && preview.getView()?.phase!=='idle';i++){vi.advanceTimersByTime(60000);preview.advance();}
    expect(preview.getView()?.entries.some(x=>x.text==='父后文')).toBe(true);
    expect(game.state.flags).not.toHaveProperty('answer');
  });
  it('saves only to an editing pack, preserves unrelated content, and reloads the exported result', () => {
    const runtime=new AronaClickerRuntime();game=runtime;runtime.init([baseDatapack]);
    const source=runtime.packManager.listPacks().find(x=>x.manifest.modName==='base')!;
    const editing=runtime.packManager.cloneAsEditing(source.id).pack;
    const patch=makePatch();patch.stories[0].id='base:story:authoring';patch.activeStories[0].id='base:activestory:authoring';patch.activeStories[0].storyId='base:story:authoring';
    expect(runtime.saveStoryAuthoringToPack(source.id,patch)).toMatchObject({ok:false});
    const checked=runtime.saveStoryAuthoringToPack(editing.id,patch);expect(checked,checked.message).toMatchObject({ok:true});
    const saved=runtime.packManager.getPack(editing.id)!;
    expect(saved.datapack.items).toEqual(editing.datapack.items);
    expect(saved.datapack.stories.some(x=>x.id==='base:story:authoring')).toBe(true);
    expect(runtime.registry.stories.has('base:story:authoring')).toBe(false);
    const exported=runtime.exportPackRecord(editing.id);expect(exported.ok).toBe(true);
    const reloaded=new GameInstance();try{reloaded.init([exported.pack!.datapack]);expect(reloaded.registry.activeStories.has('base:activestory:authoring')).toBe(true);}finally{reloaded.storyService.dispose();reloaded.stop();}
  });
  it('rejects a referenced deletion and leaves all live content untouched', () => {
    const game=start();expect(game.applyStoryAuthoring(makePatch())).toMatchObject({ok:true});
    const patch={...emptyStoryAuthoring(),removed:{stories:['test:story:authoring']}};
    expect(game.applyStoryAuthoring(patch)).toMatchObject({ok:false});expect(game.registry.stories.has('test:story:authoring')).toBe(true);
    patch.removed={...patch.removed,activeStories:['test:activestory:authoring']} as never;
    expect(game.applyStoryAuthoring(patch)).toMatchObject({ok:true});expect(game.registry.stories.has('test:story:authoring')).toBe(false);
  });
  it('rejects deleting an Entry still referenced by an independent follow-up', () => {
    const game=start();const patch=makePatch();
    patch.activeStories.push({...patch.activeStories[0],id:'test:activestory:second'});
    Object.assign(patch.activeStories[0],{followUps:[{id:'later',waitFor:{kind:'next-enter-area',areaId:baseDatapack.areas[0].id},outcome:{kind:'start-story-entry',storyEntryId:'test:activestory:second'}}]});
    expect(game.applyStoryAuthoring(patch)).toMatchObject({ok:true});
    expect(game.applyStoryAuthoring({...emptyStoryAuthoring(),removed:{activeStories:['test:activestory:second']}})).toMatchObject({ok:false});
    expect(game.registry.activeStories.has('test:activestory:second')).toBe(true);
  });
  it('retains the previous pack when its storage write fails', () => {
    let fail=false;
    const runtime=new AronaClickerRuntime({packStore:{load:()=>null,clear:()=>{},save:()=>{if(fail)throw new Error('storage full');}}});game=runtime;runtime.init([baseDatapack]);
    const source=runtime.packManager.listPacks().find(x=>x.manifest.modName==='base')!;
    const editing=runtime.packManager.cloneAsEditing(source.id).pack;
    const before=structuredClone(editing.datapack);const patch=makePatch();
    patch.stories[0].id='base:story:authoring';patch.activeStories[0].id='base:activestory:authoring';patch.activeStories[0].storyId='base:story:authoring';
    fail=true;expect(runtime.saveStoryAuthoringToPack(editing.id,patch)).toMatchObject({ok:false});
    expect(runtime.packManager.getPack(editing.id)?.datapack).toEqual(before);
  });
});
