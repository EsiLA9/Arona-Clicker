// @vitest-environment happy-dom
import { createStoryForTest } from './story-editor-test-helpers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft, createStoryEditorState, type StoryDraft, type StoryDraftNode } from '../../src/ui/story-editor/model';
import { emptyStoryAuthoring } from '../../src/data-services/authoring/story-authoring';
import { buildStoryRelations } from '../../src/ui/story-editor/relations-model';
import { requiredFlagOptions } from '../../src/ui/story-editor/required-flag-dropdown';
import '../../src/ui/runtime/service-definitions';

const writer = (id:string,name:string):StoryDraftNode => ({id,type:'operation',action:{kind:'localFlag',op:'set',name,value:true}});
const document = (id:string,nodes:StoryDraftNode[]):StoryDraft => ({draftId:id,sourceId:null,document:{id,name:id,nodes,stages:{}},dirty:true,persisted:false,savedAt:null});

it('offers flags in the same possible Entry/Transfer chain without global, read-only, removed-only or private child names',()=>{
  const state=createStoryEditorState();
  const parent=document('local:story:parent',[writer('writer','parent-flag'),{id:'next',type:'transfer',transfer:{mode:'insert',storyId:'local:story:body'}}]);
  const body=document('local:story:body',[writer('writer','body-flag'),{id:'read',type:'talklet',stageId:'one',requiresFlag:'read-only',content:{kind:'talk',text:''}},
    {id:'remove',type:'operation',action:{kind:'localFlag',op:'remove',name:'removed-only'}},
    {id:'global',type:'operation',action:{kind:'state',effects:[{op:'setFlag',flagId:'global-flag',value:true}]}},
    {id:'card',type:'click',stageId:'one',interaction:{kind:'entryCard',card:{request:{entryId:'local:activestory:child',entryType:'active',owner:null,intent:'card'},continuation:{returnFlags:['returned']}}}},
    {id:'cycle',type:'transfer',transfer:{mode:'goto',storyId:parent.document.id}},
  ]);
  const child=document('local:story:child',[writer('secret','child-secret')]);
  parent.authoring=emptyStoryAuthoring();child.authoring=emptyStoryAuthoring();
  parent.authoring.activeStories.push({id:'local:activestory:parent',storyId:parent.document.id,availableInits:[],triggerCondition:{type:'AND',conditions:[]}, activation: { kind: 'active' as const } });
  child.authoring.activeStories.push({id:'local:activestory:child',storyId:child.document.id,availableInits:[],triggerCondition:{type:'AND',conditions:[]}, activation: { kind: 'active' as const } });
  state.drafts.push(parent,body,child);state.target={kind:'story',id:body.document.id};
  const relations=buildStoryRelations(state,new Map(),new Map());
  expect(requiredFlagOptions(state,relations)).toEqual(['body-flag','parent-flag','returned']);
  state.target={kind:'story',id:child.document.id};
  expect(requiredFlagOptions(state,relations)).toEqual(['child-secret']);
});

describe('required local flag dropdown',()=>{
  let game:GameInstance,ctrl:UIController,root:HTMLElement,draft:StoryDraft;
  const find=<T extends HTMLElement=HTMLElement>(selector:string):T=>{const node=root.querySelector<T>(selector);expect(node,selector).not.toBeNull();return node!;};
  const refresh=()=>{ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();};
  const field=()=>find<HTMLInputElement>('[data-editor-field="requires-flag"]');
  const menu=()=>find<HTMLElement>('[data-required-flag-options]');
  const option=(name:string)=>[...root.querySelectorAll<HTMLButtonElement>('[data-required-flag-option]')].find(row=>row.dataset.requiredFlagOption===name)!;
  const type=(value:string)=>{field().value=value;field().dispatchEvent(new Event('input',{bubbles:true}));ctrl.flushUIUpdates();};
  beforeEach(()=>{
    localStorage.clear();window.document.body.innerHTML='<div id="app"></div>';root=window.document.querySelector('#app')!;
    game=new GameInstance();game.init([baseDatapack]);ctrl=new UIController(game,root);ctrl.render();ctrl.storyEditor.open();
    createStoryForTest(game,ctrl);ctrl.flushUIUpdates();draft=currentDraft(ctrl.storyEditor.state)!;
    draft.document={...draft.document,startContext:{type:'area',areaId:[...game.registry.areas.keys()][0]},nodes:[writer('alpha','alpha'),writer('beta','beta'),{id:'reader',type:'talklet',stageId:'one',requiresFlag:'beta',content:{kind:'talk',text:'text'}}]};
    ctrl.storyEditor.state.selectedNodeId='reader';refresh();
  });
  afterEach(()=>{ctrl.destroy();game.stop();localStorage.clear();});

  it('opens all matches for an existing value, dims rather than hides unmatched names and fills either kind',()=>{
    const input=field(),container=menu(),alpha=option('alpha');
    expect(input.hasAttribute('list')).toBe(false);expect(container.hidden).toBe(true);
    input.focus();expect(container.hidden).toBe(false);expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(alpha.dataset.filterMatch).toBe('true');expect(option('beta').dataset.filterMatch).toBe('true');
    type('alp');expect(menu()===container).toBe(true);expect(option('alpha')===alpha).toBe(true);expect(field()===input).toBe(true);
    expect(alpha.dataset.filterMatch).toBe('true');expect(option('beta').dataset.filterMatch).toBe('false');
    expect(option('beta').hidden).toBe(false);expect(option('beta').disabled).toBe(false);
    expect(option('beta').classList.contains('is-filter-muted')).toBe(true);
    option('beta').click();ctrl.flushUIUpdates();
    expect(input.value).toBe('beta');expect(draft.document.nodes.at(-1)?.requiresFlag).toBe('beta');expect(menu().hidden).toBe(true);
  });

  it('treats empty and prefilled input as all matches, and keeps typed filtering through refresh',()=>{
    type('');expect(menu().hidden).toBe(false);expect([...menu().querySelectorAll('[data-filter-match="false"]')]).toHaveLength(0);
    type('unlisted-name');expect([...menu().querySelectorAll('[data-filter-match="false"]')]).toHaveLength(2);
    const other=find<HTMLInputElement>('[data-editor-composer-text]');other.focus();expect(menu().hidden).toBe(true);
    field().focus();expect([...menu().querySelectorAll('[data-filter-match="false"]')]).toHaveLength(0);
    type('BeT');refresh();expect(option('alpha').dataset.filterMatch).toBe('false');expect(option('beta').dataset.filterMatch).toBe('true');
    type('');expect(option('alpha').dataset.filterMatch).toBe('true');
  });

  it('closes on outside interaction or leaving, and rechecks a candidate before filling',()=>{
    field().focus();root.dispatchEvent(new Event('pointerdown',{bubbles:true}));expect(menu().hidden).toBe(true);
    field().click();expect(menu().hidden).toBe(false);
    draft.document.nodes=draft.document.nodes.filter(node=>node.id!=='alpha');
    option('alpha').click();ctrl.flushUIUpdates();expect(field().value).toBe('beta');expect(menu().hidden).toBe(true);
    field().click();expect(menu().hidden).toBe(false);expect(ctrl.storyEditor.beforeLeave()).toBe(true);expect(menu().hidden).toBe(true);
  });
});
