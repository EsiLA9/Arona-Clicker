import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import { emptyStoryAuthoring } from '../../src/data-services/authoring/story-authoring';
import type { StoryNode } from '../../src/data-services/contracts/story-node';
import type { StoryAuthoringPreview } from '../../src/arona-clicker/contracts/runtime/story-authoring';

const makePatch = () => ({ ...emptyStoryAuthoring(),
  stories: [{ id: 'test:story:authoring', name: '作者故事', startContext: { type: 'area' as const, areaId: baseDatapack.areas[0].id }, stages: { s: { advance: 'input' as const } }, nodes: [
    { id: 'choice', type: 'click' as const, stageId: 's', interaction: { kind: 'choice' as const, options: [
      { id: 'one', text: '选择后续分支', marks: ['answer'] },
    ] } },
    { id: 'tail', type: 'talklet' as const, stageId: 's', requiresFlag: 'answer', content: { kind: 'narration' as const, text: '正确后续' } },
  ] as StoryNode[] }],
  activeStories: [{ id: 'test:activestory:authoring', storyId: 'test:story:authoring', availableInits: [], triggerCondition: { type: 'AND' as const, conditions: [] }, replayable: true, activation: { kind: 'active' as const } }],
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
  it('projects isolated theme and overlay output as detached visual data', () => {
    vi.useFakeTimers(); const game=start(); const patch=makePatch();
    patch.stories[0].nodes.splice(1, 0,
      { id: 'theme', type: 'operation', requiresFlag: 'answer', action: { kind: 'presentation', command: { command: 'theme', value: { tokens: { primary: '#123456' }, background: [{ kind: 'solid', value: '#abcdef' }] } } } },
      { id: 'overlay', type: 'operation', requiresFlag: 'answer', action: { kind: 'overlay', command: { command: 'show', id: 'preview-note', x: .25, y: .75, align: 'center', content: { kind: 'text', template: 'note', text: '隔离覆盖层' } } } },
    );
    const result=game.createStoryAuthoringPreview(patch,'test:activestory:authoring');expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return;
    preview=result.preview;expect(preview.getProjection()?.scene).toEqual({type:'area',id:baseDatapack.areas[0].id});
    expect(preview.advance('one')).toMatchObject({ok:true});
    const phases:string[]=[];
    for(let i=0;i<25&&!preview.getProjection()?.presentation.overlays.length;i++){
      phases.push(String(preview.getView()?.phase));
      vi.advanceTimersByTime(60000);
      const choiceId=preview.getStory()?.page.choices?.[0]?.id;
      preview.advance(choiceId);
    }
    const projection=preview.getProjection();
    expect(projection?.theme.tokens.primary,JSON.stringify({phases,view:preview.getView(),projection})).toBe('#123456');
    expect(projection?.theme.background.some(layer=>layer.value==='#abcdef')).toBe(true);
    expect(projection?.presentation.overlays).toMatchObject([{id:'preview-note',value:{text:'隔离覆盖层',x:.25,y:.75,align:'center'}}]);
    expect(game.registry.stories.has('test:story:authoring')).toBe(false);
    preview.close();expect(preview.getProjection()).toBeNull();
  });
  it('follows the child channel and returns only the allowed flags during whole-story preview', () => {
    vi.useFakeTimers(); const game = start(); const patch = makePatch();
    patch.stories.push({ id:'test:story:parent',name:'parent',startContext:{type:'area',areaId:baseDatapack.areas[0].id},stages:{s:{advance:'input'}},nodes:[
      {id:'call',type:'click',stageId:'s',interaction:{kind:'kizunaCard'}},
      {id:'back',type:'talklet',stageId:'s',requiresFlag:'answer',content:{kind:'narration',text:'父后文'}},
    ] } as never);
    patch.activeStories.push({id:'test:activestory:parent',storyId:'test:story:parent',availableInits:[],triggerCondition:{type:'AND',conditions:[]},replayable:true,kizuna:{entryId:'test:activestory:authoring',returnFlags:['answer']}, activation: { kind: 'active' as const } } as never);
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

  const identityFixture=()=>{
    const runtime=new AronaClickerRuntime();game=runtime;runtime.init([baseDatapack]);
    const source=runtime.packManager.listPacks().find(pack=>pack.manifest.modName==='base')!;
    const pack=runtime.packManager.cloneAsEditing(source.id).pack, patch=makePatch();
    patch.stories[0].id='base:story:identity_old';patch.activeStories[0].id='base:activestory:identity';patch.activeStories[0].storyId=patch.stories[0].id;
    expect(runtime.saveStoryAuthoringToPack(pack.id,patch)).toMatchObject({ok:true});
    const entry=runtime.getPackCatalog().entries.find(entry=>entry.id===pack.id)!;
    return {runtime,pack:runtime.packManager.getPack(pack.id)!,change:{fromId:patch.stories[0].id,toId:'base:story:identity_new',expectedDigest:entry.contentDigest!,patch:emptyStoryAuthoring()}};
  };
  it('renames stored Story identities and Entry references atomically without changing the live Registry',()=>{
    const {runtime,pack,change}=identityFixture(), live=[...runtime.registry.stories.keys()];
    const result=runtime.renameStoryInPack(pack.id,change);expect(result,result.message).toMatchObject({ok:true});
    const saved=runtime.packManager.getPack(pack.id)!.datapack;
    expect(saved.stories.some(story=>story.id===change.fromId)).toBe(false);
    expect(saved.stories.some(story=>story.id===change.toId)).toBe(true);
    expect(saved.activeStories.find(entry=>entry.id==='base:activestory:identity')?.storyId).toBe(change.toId);
    expect([...runtime.registry.stories.keys()]).toEqual(live);
  });
  it('rejects stale, cross-Mod and colliding rename requests before writing',()=>{
    const {runtime,pack,change}=identityFixture(), before=structuredClone(pack.datapack);
    expect(runtime.renameStoryInPack(pack.id,{...change,expectedDigest:'stale'})).toMatchObject({ok:false});
    expect(runtime.renameStoryInPack(pack.id,{...change,toId:'other:story:identity_new'})).toMatchObject({ok:false});
    expect(runtime.renameStoryInPack(pack.id,{...change,toId:pack.datapack.stories.find(story=>story.id!==change.fromId)!.id})).toMatchObject({ok:false});
    expect(runtime.packManager.getPack(pack.id)!.datapack).toEqual(before);
  });
  it('blocks known external Mod references rather than leaving a dangling Story ID',()=>{
    const {runtime,pack,change}=identityFixture(), external=runtime.packManager.createEmptyEditing({modId:'other',versionId:'1'}).pack;
    runtime.packManager.savePack({...external,datapack:{...external.datapack,stories:[{id:'other:story:caller',name:'调用者',startContext:{type:'area',areaId:baseDatapack.areas[0].id},stages:{},nodes:[{id:'jump',type:'transfer',transfer:{mode:'insert',storyId:change.fromId}}]}]},contentDigest:undefined});
    const result=runtime.renameStoryInPack(pack.id,change);expect(result).toMatchObject({ok:false});expect(result.message).toContain('other:story:caller');
    expect(runtime.packManager.getPack(pack.id)!.datapack).toEqual(pack.datapack);
  });
  it('rolls back a rename when package storage rejects the write',()=>{
    const {runtime,pack,change}=identityFixture(), save=vi.spyOn(runtime.packManager as unknown as {persist():void},'persist').mockImplementationOnce(()=>{throw new Error('storage full');});
    const result=runtime.renameStoryInPack(pack.id,change);expect(result).toMatchObject({ok:false});expect(result.message).toContain('storage full');
    expect(runtime.packManager.getPack(pack.id)!.datapack).toEqual(pack.datapack);save.mockRestore();
  });
});
