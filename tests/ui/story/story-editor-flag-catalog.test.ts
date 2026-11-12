import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../../src/data-services/contracts/story';
import type { StoryNode } from '../../../src/data-services/contracts/story-node';
import type { ActiveStoryEntry } from '../../../src/data-services/contracts/story-entry';
import { createStoryEditorState, currentDraft, selectStory } from '../../../src/ui/story-editor/model';
import { buildStoryRelations } from '../../../src/ui/story-editor/relations-model';
import { buildStoryFlagCatalog, storyFlagNames } from '../../../src/ui/story-editor/flag-catalog';
import { StoryDraftPersistence } from '../../../src/ui/story-editor/persistence';
import type { StorageAdapter } from '../../../src/data-services/persistence/storage-adapter';
import { bindFlagTableNode, canBindFlagTableNode } from '../../../src/ui/story-editor/flag-table-binding';

const story = (id: string, nodes: StoryNode[] = []): StoryDef => ({ id, name: id, startContext: {type:'area',areaId:'test:area:home'}, nodes, stages: {} });
const flag = (id: string, name: string): StoryNode => ({id,type:'operation',action:{kind:'localFlag',op:'set',name,value:false}});
const entry = (id: string, storyId: string): ActiveStoryEntry => ({id,storyId,availableInits:[],triggerCondition:{type:'AND',conditions:[{target:'flag',key:'unlocked',comparator:'==',value:1}]},completionReward:{first:[{op:'setFlag',target:'rewarded',value:1}]}, activation: { kind: 'active' as const } });
const card = (entryId: string): StoryNode => ({id:'card',type:'click',stageId:'input',interaction:{kind:'entryCard',card:{request:{entryId,entryType:'active',owner:null,intent:'card'},continuation:{returnFlags:['returned']}}}});
const setup = (stories: StoryDef[], entries: ActiveStoryEntry[] = []) => {
  const state = createStoryEditorState(), sources = new Map(stories.map(item=>[item.id,item])), entrySources = new Map(entries.map(item=>[item.id,item]));
  selectStory(state,`source:${stories[0].id}`,sources);
  const catalog = (start = state.target!) => buildStoryFlagCatalog(state,buildStoryRelations(state,sources,entrySources),start);
  return {state,sources,entrySources,catalog};
};

describe('Story relation group flag table', () => {
  it('includes incoming transfer Stories and separates each attached Entry scope, while bounding cycles', () => {
    const leaf = story('test:story:leaf',[{id:'reader',type:'talklet',stageId:'one',content:{kind:'talk',text:'正文'}}]);
    const parent = story('test:story:parent',[flag('write','from-parent'),{id:'next',type:'transfer',transfer:{mode:'insert',storyId:leaf.id}}]);
    const a = entry('test:activestory:a',parent.id), b = entry('test:activestory:b',parent.id);
    const {state,sources,entrySources,catalog} = setup([leaf,parent],[a,b]);
    expect(catalog().uses.some(use => use.name === 'from-parent')).toBe(false);
    const related = buildStoryFlagCatalog(state,buildStoryRelations(state,sources,entrySources),state.target!,true);
    expect(new Set(related.uses.filter(use => use.name === 'from-parent').map(use => use.scope))).toEqual(new Set([`entry:${a.id}`,`entry:${b.id}`]));
    expect(related.uses.filter(use => use.name === 'from-parent')).toHaveLength(2);
    expect(related.uses.some(use => use.name === 'rewarded')).toBe(true);
  });

  it('requires consent for another Entry and rejects private, unwritten or conflicting bindings', () => {
    const leaf = story('test:story:leaf',[{id:'reader',type:'talklet',stageId:'one',content:{kind:'talk',text:'正文'}},{id:'read-only',type:'talklet',stageId:'one',requiresFlag:'unwritten',content:{kind:'talk',text:'正文'}}]);
    const parent = story('test:story:parent',[flag('write','available'),card('test:activestory:child'),{id:'next',type:'transfer',transfer:{mode:'goto',storyId:leaf.id}}]);
    const child = story('test:story:child',[flag('secret','private')]);
    const {state,sources,entrySources} = setup([leaf,parent,child],[entry('test:activestory:child',child.id)]);
    const relations = buildStoryRelations(state,sources,entrySources);
    const read = () => buildStoryFlagCatalog(state,relations,state.target!,true);
    expect(read().uses.some(use => use.name === 'private')).toBe(false);
    currentDraft(state)!.flagImports = {[read().boundaries[0].key]:true};
    const catalog = read(), draft = currentDraft(state)!, privateFlag = catalog.uses.find(use => use.name === 'private')!;
    expect(privateFlag.available).toBe(false);
    expect(canBindFlagTableNode(draft,catalog,'private',privateFlag.scope,'reader').ok).toBe(false);
    const scope = catalog.uses.find(use => use.name === 'available')!.scope;
    expect(canBindFlagTableNode(draft,catalog,'unwritten',scope,'reader').ok).toBe(false);
    expect(canBindFlagTableNode(draft,catalog,'available',scope,'read-only').ok).toBe(false);
    const before = draft.document.nodes.map(node => node.id);
    expect(bindFlagTableNode(draft,catalog,'available',scope,'reader')).toEqual({ok:true,changed:true});
    expect(draft.document.nodes[0]).toMatchObject({type:'talklet',requiresFlag:'available',content:{text:'正文'}});
    expect(draft.document.nodes.map(node => node.id)).toEqual(before);
    draft.dirty = false;
    expect(bindFlagTableNode(draft,catalog,'available',scope,'reader')).toEqual({ok:true,changed:false}); expect(draft.dirty).toBe(false);
    expect(bindFlagTableNode(draft,catalog,'available',scope,'gone').ok).toBe(false);
  });
});

describe('Story flag author information', () => {
  it('collects active operations, branches and transferred documents, bounds cycles and reports missing stories', () => {
    const root = story('test:story:root', [flag('write','route'),
      {id:'reader',type:'talklet',stageId:'one',requiresFlag:'route',content:{kind:'talk',text:'text'}},
      {id:'choice',type:'click',stageId:'one',interaction:{kind:'choice',options:[{id:'a',text:'a',showWhen:{type:'AND',conditions:[{target:'flag',key:'global',comparator:'==',value:1}]},marks:['branch']}]}},
      {id:'next',type:'transfer',transfer:{mode:'goto',storyId:'test:story:next'}},
      {id:'missing',type:'transfer',transfer:{mode:'insert',storyId:'test:story:missing'}},
    ]);
    const next = story('test:story:next',[flag('other','external'),{id:'back',type:'transfer',transfer:{mode:'goto',storyId:root.id}}]);
    const {state,catalog,sources} = setup([root,next]);
    currentDraft(state)!.document = {...currentDraft(state)!.document, extra:{t:'dict',v:{example:{t:'str',v:'{"kind":"localFlag","op":"set","name":"fake"}'}}}};
    currentDraft(state)!.editorState!.branches['write|inactive'] = {kind:'localFlag',op:'set',name:'dormant',value:true};
    expect(storyFlagNames(catalog(),'local')).toEqual(['branch','external','route']);
    expect(catalog().uses.filter(use=>use.name==='route').map(use=>use.usage)).toEqual(['write','read']);
    expect(catalog().uses.filter(use=>use.name==='branch').map(use=>use.usage)).toEqual(['write']);
    expect(storyFlagNames(catalog(),'global')).toEqual(['global']);
    expect(catalog().missing).toEqual([{kind:'story',id:'test:story:missing'}]);
    selectStory(state,`source:${next.id}`,sources);
    currentDraft(state)!.document.nodes[0] = flag('other','edited');
    expect(storyFlagNames(catalog({kind:'story',id:root.id}),'local')).toContain('edited');
    expect(storyFlagNames(catalog({kind:'story',id:root.id}),'local')).not.toContain('external');
  });

  it('asks at Entry boundaries, keeps internal scopes separate and aggregates complete Entry information', () => {
    const root = story('test:story:root',[flag('own','same'),card('test:activestory:child')]);
    const child = story('test:story:child',[flag('same','same'),flag('private','private'),flag('return','returned')]);
    const {state,catalog} = setup([root,child],[entry('test:activestory:child',child.id)]);
    expect(catalog().uses.some(use=>use.name==='private')).toBe(false);
    const boundary = catalog().boundaries[0];
    currentDraft(state)!.flagImports = {[boundary.key]:true};
    const info = catalog();
    expect(info.uses.find(use=>use.name==='private')?.available).toBe(false);
    expect(new Set(info.uses.filter(use=>use.name==='same').map(use=>use.scope)).size).toBe(2);
    expect(storyFlagNames(info,'local')).toEqual(['returned','same']);
    expect(storyFlagNames(info,'global')).toEqual(['rewarded','unlocked']);
    const wholeEntry = catalog({kind:'entry',id:'test:activestory:child'});
    expect(wholeEntry.boundaries).toEqual([]);
    expect(storyFlagNames(wholeEntry,'local')).toEqual(['private','returned','same']);
    currentDraft(state)!.flagImports![boundary.key] = false;
    expect(catalog().uses.some(use=>use.name==='private')).toBe(false);
    currentDraft(state)!.document.nodes[1] = card('test:activestory:missing');
    expect(catalog().boundaries[0].included).toBeUndefined();
    expect(catalog().boundaries[0].missing).toBe(true);
  });

  it('preserves per-call decisions across node reordering and draft reload without publishing metadata', () => {
    const root = story('test:story:root',[{id:'button',type:'click',stageId:'one',interaction:{ kind:'button', text:'go' }},
  { id: "button-effect-1", type: 'operation', action: {kind:'localFlag',op:'remove',name:'old'} },
  { id: "button-effect-2", type: 'operation', action: {kind:'entryRequest',request:{entryId:'test:activestory:child',entryType:'active',owner:null,intent:'ordinary'}} },flag('own','root')]);
    const {state,sources,entrySources,catalog} = setup([root,story('test:story:child',[flag('private','private')])],[entry('test:activestory:child','test:story:child')]);
    const draft = currentDraft(state)!;
    draft.flagImports = {[catalog().boundaries[0].key]:true}; draft.dirty = true;
    draft.document.nodes.reverse();
    expect(catalog().boundaries[0].included).toBe(true);
    let raw: string | null = null;
    const storage: StorageAdapter = {get:()=>raw,set:(_key,value)=>{raw=value;},remove:()=>{raw=null;}};
    const persistence = new StoryDraftPersistence(storage);
    expect(persistence.save(state)).toBe(true);
    expect(JSON.parse(raw!).drafts[0].document.flagImports).toBeUndefined();
    const restored = createStoryEditorState(); persistence.load(restored);
    const info = buildStoryFlagCatalog(restored,buildStoryRelations(restored,sources,entrySources),{kind:'story',id:root.id});
    expect(info.boundaries[0].included).toBe(true);
    const input = JSON.parse(raw!); input.drafts[0].flagImports = {bad:'yes'}; raw=JSON.stringify(input);
    const damaged = createStoryEditorState(); persistence.load(damaged);
    expect(damaged.storageBlocked).toBe(true);
    expect(raw).toContain('yes');
  });
});
