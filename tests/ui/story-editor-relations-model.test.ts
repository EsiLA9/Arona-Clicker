import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StoryNode } from '../../src/data-services/contracts/story-node';
import type { StoryAction } from '../../src/data-services/contracts/story-node-actions';
import type { ActiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import { emptyStoryAuthoring } from '../../src/data-services/authoring/story-authoring';
import { createStoryEditorState, selectStory, currentDraft } from '../../src/ui/story-editor/model';
import { buildStoryRelations, potentialStoryCalls } from '../../src/ui/story-editor/relations-model';

const story = (id: string, nodes: StoryNode[] = []): StoryDef => ({ id, name: id, startContext: {type:'area',areaId:'test:area:home'}, nodes, stages: {} });
const entry = (id: string, storyId: string): ActiveStoryEntry => ({ id, type:'active', storyId, availableInits:[], triggerCondition:{type:'AND',conditions:[]} });
const request = (entryId: string): StoryAction => ({kind:'entryRequest',request:{entryId,entryType:'active',owner:null,intent:'ordinary'}});
const card = (entryId: string) => ({request:{entryId,entryType:'active' as const,owner:null,intent:'card' as const}});
const build = (stories: StoryDef[], entries: ActiveStoryEntry[] = []) => buildStoryRelations(createStoryEditorState(),new Map(stories.map(x=>[x.id,x])),new Map(entries.map(x=>[x.id,x])));

describe('Story editor call relations', () => {
  it('records deferred branch calls at their Operation and Transfer nodes', () => {
    const relations = build([story('test:story:root',[
      {id:'choice',type:'click',stageId:'one',interaction:{kind:'choice',sharedActions:[{kind:'localFlag',op:'remove',name:'route'}],options:[
        {id:'go',text:'go',result:{actions:[{kind:'localFlag',op:'set',name:'route',value:true}]}},
      ]}},
      {id:'invite',type:'operation',requiresFlag:'route',action:request('test:activestory:next')},
      {id:'next',type:'transfer',requiresFlag:'route',transfer:{mode:'insert',storyId:'test:story:next'}},
    ])]);
    expect(relations.calls.map(call=>({to:call.to,path:call.path}))).toEqual([
      {to:{kind:'entry',id:'test:activestory:next'},path:'$.nodes[1].action.request.entryId'},
      {to:{kind:'story',id:'test:story:next'},path:'$.nodes[2].transfer.storyId'},
    ]);
    expect(relations.calls.map(call=>call.label)).toEqual(['剧情入口请求 · 节点 invite','剧情转移 · 节点 next']);
  });
  it('collects transfers and Entry calls from every executable node/action position', () => {
    const target = 'test:activestory:target', next = 'test:story:next';
    const overlay: StoryAction = {kind:'overlay',command:{command:'show',id:'invite',content:{kind:'entryCard',card:card(target)}}};
    const relations = build([story('test:story:root',[
      {id:'transfer',type:'transfer',transfer:{mode:'goto',storyId:next}},
      {id:'button',type:'click',stageId:'one',interaction:{kind:'button',text:'go',result:{transfer:{mode:'insert',storyId:next},actions:[request(target),overlay]}}},
      {id:'choice',type:'click',stageId:'two',interaction:{kind:'choice',sharedActions:[request(target)],options:[{id:'one',text:'one',result:{transfer:{mode:'goto',storyId:next},actions:[request(target),overlay]}}]}},
      {id:'request',type:'operation',action:request(target)},
      {id:'overlay',type:'operation',action:overlay},
      {id:'card',type:'click',stageId:'three',interaction:{kind:'entryCard',card:{...card(target),continuation:{returnFlags:['answer']}}}},
    ])]);
    expect(relations.calls.filter(x=>x.to.kind==='story')).toHaveLength(3);
    expect(relations.calls.filter(x=>x.to.kind==='entry')).toHaveLength(8);
    expect(relations.calls.every(x=>x.from.id==='test:story:root')).toBe(true);
    expect(relations.calls.find(x=>x.path==='$.nodes[5].interaction.card.request.entryId')?.label).toContain('节点 card');
  });

  it('expands an Entry potential set across branches and cycles, retaining missing targets once', () => {
    const root = 'test:story:root', branch = 'test:story:branch', child = 'test:story:child', missing = 'test:story:missing';
    const first = entry('test:activestory:first',root), second = entry('test:activestory:second',child);
    const relations = build([
      story(root,[{id:'choice',type:'click',stageId:'one',interaction:{kind:'choice',options:[
        {id:'yes',text:'yes',result:{transfer:{mode:'insert',storyId:branch}}},
        {id:'no',text:'no',result:{transfer:{mode:'goto',storyId:missing}}},
      ]}}]),
      story(branch,[{id:'loop',type:'transfer',transfer:{mode:'goto',storyId:root}},{id:'invite',type:'operation',action:request(second.id)}]),
      story(child,[{id:'return',type:'operation',action:request(first.id)}]),
    ],[first,second]);
    const targets = potentialStoryCalls(relations,{kind:'entry',id:first.id}).map(x=>`${x.to.kind}:${x.to.id}`);
    expect(new Set(targets)).toEqual(new Set([`story:${root}`,`story:${branch}`,`story:${missing}`,`entry:${second.id}`,`story:${child}`]));
    expect(targets).toHaveLength(5);
    expect(relations.calls.filter(x=>x.to.kind==='entry'&&x.to.id===second.id).map(x=>x.from)).toEqual([{kind:'story',id:branch}]);
    expect(relations.calls.filter(x=>x.to.kind==='story'&&x.to.id===root).map(x=>x.from)).toEqual([{kind:'story',id:branch},{kind:'entry',id:first.id}]);
  });

  it('counts Entry launches, follow-ups and trigger effects, excluding read-only references and Extra', () => {
    const first = entry('test:activestory:first','test:story:root');
    first.followUps=[{id:'later',waitFor:{kind:'next-enter-area',areaId:'test:area:home'},outcome:{kind:'start-story-entry',storyEntryId:'test:activestory:later'}}];
    first.completionReward={first:[{op:'triggerStory',target:'test:activestory:reward',value:0}]};
    first.reactions=[{id:'reaction',on:{kind:'area'},effects:[{op:'triggerStory',target:'test:activestory:reaction',value:0}]}];
    first.conditionalRewards=[{condition:{type:'AND',conditions:[]},effects:[{op:'triggerStory',target:'test:activestory:conditional',value:0}]}];
    first.triggerCondition={type:'AND',conditions:[{target:'hasReadStory',key:'test:story:read',comparator:'==',value:1}]};
    first.branchGuards=[{storyId:'test:story:guard',prerequisites:[{storyId:'test:story:prerequisite',talkletIndex:0}],denialMessage:'wait'}];
    first.extra={t:'dict',v:{entryId:{t:'str',v:'test:activestory:extra'}}};
    expect(build([], [first]).calls.map(x=>x.to)).toEqual([
      {kind:'story',id:first.storyId}, {kind:'entry',id:'test:activestory:later'},
      {kind:'entry',id:'test:activestory:reward'}, {kind:'entry',id:'test:activestory:reaction'}, {kind:'entry',id:'test:activestory:conditional'},
    ]);
  });

  it('uses current draft edits and explicit Entry removals without modifying registry inputs', () => {
    const original = story('test:story:root',[{id:'next',type:'transfer',transfer:{mode:'goto',storyId:'test:story:old'}}]);
    const first = entry('test:activestory:first',original.id), removed = entry('test:activestory:removed',original.id);
    const stories = new Map([[original.id,original]]), entries = new Map([[first.id,first],[removed.id,removed]]);
    const state = createStoryEditorState(); selectStory(state,`source:${original.id}`,stories);
    const draft = currentDraft(state)!;
    draft.document.nodes=[{id:'next',type:'transfer',transfer:{mode:'insert',storyId:'test:story:new'}},{id:'incomplete',type:'operation'}];
    draft.authoring=emptyStoryAuthoring();
    draft.authoring.activeStories=[{...first,storyId:'test:story:new'}];
    draft.authoring.removed={activeStories:[removed.id]};
    const relations = buildStoryRelations(state,stories,entries);
    expect(relations.calls.map(x=>x.to.id)).toEqual(['test:story:new','test:story:new']);
    expect(relations.entries.has(removed.id)).toBe(false);
    expect(original.nodes[0]).toMatchObject({transfer:{storyId:'test:story:old'}});
    expect(first.storyId).toBe(original.id);
    draft.document.nodes=[];
    expect(buildStoryRelations(state,stories,entries).calls).toHaveLength(1);
  });

  it('resolves legacy cards through Entry bindings even in transferred Story documents', () => {
    const first=entry('test:activestory:first','test:story:root'); first.kizuna={entryId:'test:activestory:child'};
    const relations=build([
      story(first.storyId,[{id:'next',type:'transfer',transfer:{mode:'goto',storyId:'test:story:invitation'}}]),
      story('test:story:invitation',[{id:'card',type:'click',stageId:'one',interaction:{kind:'kizunaCard'}}]),
    ],[first]);
    expect(relations.calls.filter(x=>x.to.id===first.kizuna!.entryId).map(x=>x.from)).toEqual([
      {kind:'entry',id:first.id},{kind:'story',id:'test:story:invitation'},
    ]);
  });
});
