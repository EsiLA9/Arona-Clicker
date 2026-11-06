// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft, type StoryDraft, type StoryDraftNode } from '../../src/ui/story-editor/model';
import { buildStoryFlagCatalog } from '../../src/ui/story-editor/flag-catalog';
import { buildStoryRelations } from '../../src/ui/story-editor/relations-model';
import { emptyStoryAuthoring } from '../../src/data-services/authoring/story-authoring';
import '../../src/ui/runtime/service-definitions';

describe('local flag Navi',()=>{
  let game: GameInstance, ctrl: UIController, root: HTMLElement, draft: StoryDraft;
  const find = <T extends HTMLElement=HTMLElement>(selector:string):T => {
    const element=document.querySelector<T>(selector); expect(element,selector).not.toBeNull(); return element!;
  };
  const refresh = () => { ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates(); };
  const selectNode = (id:string) => { root.querySelector<HTMLElement>(`[data-editor-node="${id}"]`)!.click(); ctrl.flushUIUpdates(); };
  const open = (field:HTMLInputElement) => { field.closest('label')!.querySelector<HTMLButtonElement>('[data-local-flag-navi]')!.click(); };
  const choose = (name:string) => {
    const button=[...document.querySelectorAll<HTMLButtonElement>('[data-modal-action^="flag-navi-select:"]')].find(button=>button.querySelector('strong')?.textContent===name);
    expect(button).toBeDefined(); button!.click(); ctrl.flushUIUpdates();
  };
  const writer = (id:string,name:string):StoryDraftNode => ({id,type:'operation',action:{kind:'localFlag',op:'set',name,value:true}});
  beforeEach(()=>{
    localStorage.clear(); document.body.innerHTML='<div id="app"></div>'; root=find('#app');
    game=new GameInstance(); game.init([baseDatapack]); ctrl=new UIController(game,root);
    ctrl.render(); ctrl.storyEditor.open();
    find<HTMLButtonElement>('[data-editor-action="new"]').click(); ctrl.flushUIUpdates();
    draft=currentDraft(ctrl.storyEditor.state)!;
    draft.document={...draft.document,startContext:{type:'area',areaId:[...game.registry.areas.keys()][0]},nodes:[
      writer('write','available'),writer('old','old-name'),
      {id:'global',type:'operation',action:{kind:'state',effects:[{op:'setFlag',flagId:'global-only',value:true}]}},
      {id:'reader',type:'talklet',stageId:'one',requiresFlag:'old-name',content:{kind:'talk',text:'正文'}},
    ]}; refresh();
  });
  afterEach(()=>{ctrl.modal.close();ctrl.destroy();game.stop();localStorage.clear();});

  it('searches mounted rows, selects a local name and preserves the original input, scroll and focus',()=>{
    selectNode('reader');
    const input=find<HTMLInputElement>('[data-editor-field="requires-flag"]');
    const body=find('.story-editor-right .workspace-column__body'); body.scrollTop=73;
    const history=ctrl.storyEditor.state.visitIndex, running=game.storyService.getCurrentStoryId();
    open(input); const search=find<HTMLInputElement>('[data-flag-navi-query]');
    const row=find('[data-flag-navi-search]');
    search.value='NOT-FOUND'; search.dispatchEvent(new Event('input',{bubbles:true}));
    expect(find('[data-flag-navi-empty]').hidden).toBe(false);
    expect(draft.document.nodes.find(node=>node.id==='reader')!.requiresFlag).toBe('old-name');
    search.value='WRITE'; search.dispatchEvent(new Event('input',{bubbles:true}));
    expect(find('[data-flag-navi-search]')===row).toBe(true);
    expect(document.querySelector('.story-editor-flag-navi')!.textContent).not.toContain('global-only');
    choose('available');
    expect(input.value).toBe('available'); expect(find('[data-editor-field="requires-flag"]')===input).toBe(true);
    expect(document.activeElement===input).toBe(true); expect(body.scrollTop).toBe(73);
    expect(ctrl.storyEditor.state.visitIndex).toBe(history); expect(game.storyService.getCurrentStoryId()).toBe(running);
    open(input); find<HTMLButtonElement>('.story-editor-flag-navi .modal-close').click();
    expect(input.value).toBe('available'); expect(document.activeElement===input).toBe(true);
  });

  it('assigns writer and nested result names without cascading into other flag readers',()=>{
    selectNode('old'); open(find<HTMLInputElement>('[data-editor-field="local-flag-name"]')); choose('available');
    expect(draft.document.nodes.find(node=>node.id==='reader')!.requiresFlag).toBe('old-name');
    expect(draft.document.nodes.find(node=>node.id==='old')).toMatchObject({action:{name:'available'}});
    draft.document.nodes.push({id:'choice',type:'click',stageId:'one',interaction:{kind:'choice',options:[{id:'a',text:'a',result:{actions:[{kind:'localFlag',op:'remove',name:'old-name'}]}}]}});refresh();selectNode('choice');
    const path=JSON.stringify(['interaction','options',0,'result','actions',0,'name']);
    const input=[...root.querySelectorAll<HTMLInputElement>('[data-story-property-path]')].find(input=>input.dataset.storyPropertyPath===path)!;
    open(input);choose('available');
    expect(draft.document.nodes.at(-1)).toMatchObject({interaction:{options:[{result:{actions:[{name:'available'}]}}]}});
  });

  it('shows internal Entry flags as disabled for conditions but permits selecting them for a return whitelist',()=>{
    const state=ctrl.storyEditor.state, authoring=emptyStoryAuthoring();
    const child:StoryDraft={draftId:'child',sourceId:null,document:{id:'local:story:child',name:'child',nodes:[writer('secret','child-secret')],stages:{}},dirty:true,persisted:false,savedAt:null,authoring};
    authoring.activeStories.push({id:'local:activestory:child',type:'active',storyId:child.document.id,availableInits:[],triggerCondition:{type:'AND',conditions:[]}});
    state.drafts.push(child);
    draft.document.nodes.push({id:'card',type:'click',stageId:'one',interaction:{kind:'entryCard',card:{request:{entryId:'local:activestory:child',entryType:'active',owner:null,intent:'card'},continuation:{returnFlags:['returned']}}}});
    const relations=buildStoryRelations(state,game.registry.stories,game.registry.storyEntries);
    const info=buildStoryFlagCatalog(state,relations,state.target!);draft.flagImports={[info.boundaries[0].key]:true};refresh();selectNode('reader');
    open(find<HTMLInputElement>('[data-editor-field="requires-flag"]'));
    const internal=[...document.querySelectorAll<HTMLButtonElement>('[data-modal-action^="flag-navi-select:"]')].find(button=>button.textContent?.includes('child-secret'))!;
    expect(internal.disabled).toBe(true);internal.click();expect(ctrl.modal.isOpen()).toBe(true);ctrl.modal.close();
    selectNode('card');
    const path=JSON.stringify(['interaction','card','continuation','returnFlags',0]);
    const input=[...root.querySelectorAll<HTMLInputElement>('[data-value-input]')].find(input=>input.dataset.valuePath===path)!;
    expect(input).toBeDefined();open(input);choose('child-secret');
    expect(draft.document.nodes.at(-1)).toMatchObject({interaction:{card:{continuation:{returnFlags:['child-secret']}}}});
  });

  it('navigates separately to a source and refuses to fill a field that has disappeared',()=>{
    selectNode('reader');const input=find<HTMLInputElement>('[data-editor-field="requires-flag"]');open(input);
    const source=[...document.querySelectorAll<HTMLButtonElement>('[data-modal-action^="flag-navi-source:"]')].find(button=>button.textContent?.endsWith(' / write'))!;
    source.click();ctrl.flushUIUpdates();expect(ctrl.storyEditor.state.selectedNodeId).toBe('write');expect(ctrl.modal.isOpen()).toBe(false);
    selectNode('reader');open(find<HTMLInputElement>('[data-editor-field="requires-flag"]'));
    draft.document.nodes=draft.document.nodes.filter(node=>node.id!=='reader');refresh();
    choose('available');expect(ctrl.modal.isOpen()).toBe(false);expect(draft.document.nodes.some(node=>node.id==='reader')).toBe(false);
    selectNode('write');open(find<HTMLInputElement>('[data-editor-field="local-flag-name"]'));
    expect(ctrl.storyEditor.beforeLeave()).toBe(true);expect(ctrl.modal.isOpen()).toBe(false);
  });
});
