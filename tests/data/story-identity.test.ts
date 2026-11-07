import { describe, expect, it } from 'vitest';
import { baseDatapack } from '../../src/data/test-datapack';
import { emptyStoryAuthoring } from '../../src/data-services/authoring/story-authoring';
import { packStoryIdentityReferences, planStoryIdentityChange } from '../../src/data-services/authoring/story-identity';
import { createStoryEditorState, newStory } from '../../src/ui/story-editor/model';
import { acceptEditorStoryRename, planEditorStoryRename } from '../../src/ui/story-editor/identity';
import { StoryDraftPersistence } from '../../src/ui/story-editor/persistence';

const from='test:story:old', to='test:story:opening';
function fixture() {
  const pack=structuredClone(baseDatapack);pack.modName='test';
  const startContext={type:'area' as const,areaId:baseDatapack.areas[0].id};
  pack.stories=[{id:from,name:'原故事',startContext,stages:{},nodes:[],extra:{t:'dict',v:{text:{t:'str',v:from}}}},
    {id:'test:story:caller',name:'调用方',startContext,stages:{},nodes:[{id:'jump',type:'transfer',requiresFlag:from,transfer:{mode:'insert',storyId:from}}]}];
  pack.activeStories=[{id:'test:activestory:entry',storyId:from,availableInits:[],triggerCondition:{type:'AND',conditions:[]},branchGuards:[{storyId:from,denialMessage:'等待',prerequisites:[{storyId:from,talkletIndex:-1}]}], activation: { kind: 'active' as const } }];
  pack.passiveStories=[];pack.passivePools=[];
  pack.inits=[{...pack.inits[0],startStoryId:from}];
  return pack;
}
describe('Story identity plans',()=>{
  it('renames only declared references, including Init and Entry guards, without touching source or flag names',()=>{
    const pack=fixture(), before=structuredClone(pack);
    const result=planStoryIdentityChange(pack,emptyStoryAuthoring(),from,to);
    expect(pack).toEqual(before);
    expect(result.datapack.stories.some(story=>story.id===from)).toBe(false);
    expect(result.datapack.stories[0]).toMatchObject({id:to,extra:before.stories[0].extra});
    expect(result.datapack.stories[1].nodes[0]).toMatchObject({id:'jump',requiresFlag:from,transfer:{storyId:to}});
    expect(result.datapack.activeStories[0]).toMatchObject({id:before.activeStories[0].id,storyId:to,branchGuards:[{storyId:to,prerequisites:[{storyId:to}]}]});
    expect(result.datapack.inits[0].startStoryId).toBe(to);
    expect(result.references).toHaveLength(5);
    expect(packStoryIdentityReferences(result.datapack,from)).toEqual([]);
  });
  it('rejects duplicate, cross-Mod, malformed and missing identities without mutation',()=>{
    const pack=fixture(), before=structuredClone(pack);
    for(const next of ['test:story:caller','other:story:new','test:story:bad name',from]) expect(()=>planStoryIdentityChange(pack,emptyStoryAuthoring(),from,next)).toThrow();
    expect(()=>planStoryIdentityChange(pack,emptyStoryAuthoring(),'test:story:missing',to)).toThrow();
    expect(pack).toEqual(before);
  });
  it('allocates readable numbers across source IDs and drafts and keeps draft identity separate',()=>{
    const state=createStoryEditorState();
    const one=newStory(state,'test',['test:story:story_8','other:story:story_99'],'editing');
    const two=newStory(state,'test',[],'editing');
    expect(one.document.id).toBe('test:story:story_9');expect(two.document.id).toBe('test:story:story_10');
    expect(one.draftId).not.toBe(one.document.id);expect(one.targetPackId).toBe('editing');
  });
  it('renames incomplete drafts and cached transfers while retaining metadata, and survives a draft reload',()=>{
    const state=createStoryEditorState(), root=newStory(state,'test',[],'editing'), caller=newStory(state,'test',[],'editing');
    const old=root.document.id, next='test:story:renamed';
    caller.document.nodes=[{id:'jump',type:'transfer',transfer:{mode:'goto',storyId:old}}];
    caller.editorState={version:1,branches:{'jump|node:transfer':{transfer:{mode:'insert',storyId:old}}},optionals:{},optionalPaths:{},optionalBranches:{},rows:{},rawInputs:{}};
    caller.flagImports={[JSON.stringify(['story',old,'location','entry'])]:true};
    state.target={kind:'story',id:old};state.storyInspectorTab='flags';state.selectedNodeId='existing';
    state.visits=[{target:{kind:'story',id:old},selectedNodeId:null,insertionBeforeNodeId:null,centerScroll:1,rightScroll:2}];
    const pack=fixture();pack.stories=[];pack.activeStories=[];
    const plan=planEditorStoryRename(state,'editing',pack,root.draftId,next,new Set());
    expect(root.document.id).toBe(old);expect(plan.published).toBe(false);
    acceptEditorStoryRename(state,plan.drafts,old,next);
    expect(root.document.id).toBe(next);expect(caller.document.nodes[0]).toMatchObject({transfer:{storyId:next}});
    expect(caller.editorState!.branches['jump|node:transfer']).toMatchObject({transfer:{storyId:next}});
    expect(Object.keys(caller.flagImports!)[0]).toContain(next);
    expect(state.target?.id).toBe(next);expect(state.visits[0].target.id).toBe(next);expect(state.storyInspectorTab).toBe('flags');
    let saved:string|null=null;const persistence=new StoryDraftPersistence({get:()=>saved,set:(_key,value)=>{saved=value;},remove:()=>{saved=null;}});
    expect(persistence.save(state)).toBe(true);const reloaded=createStoryEditorState();persistence.load(reloaded);
    expect(reloaded.storageBlocked).toBe(false);expect(reloaded.drafts[0]).toMatchObject({draftId:root.draftId,targetPackId:'editing',document:{id:next}});
  });
  it('blocks references in another draft Mod before mutating any content',()=>{
    const state=createStoryEditorState(), root=newStory(state,'test',[],'editing'), caller=newStory(state,'other',[],'other-editing');
    caller.document.nodes=[{id:'jump',type:'transfer',transfer:{mode:'goto',storyId:root.document.id}}];
    const before=structuredClone(state), pack=fixture();pack.stories=[];pack.activeStories=[];
    expect(()=>planEditorStoryRename(state,'editing',pack,root.draftId,to,new Set())).toThrow('其他 Mod');
    expect(state).toEqual(before);
  });
});
