// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AronaClickerRuntime } from '../../../src/arona-clicker/runtime/runtime';
import { baseDatapack } from '../../../src/data/test-datapack';
import { UIController } from '../../../src/ui/controller/controller';
import { currentDraft, storyDefinitionFromDraft } from '../../../src/ui/story-editor/model';
import { emptyStoryAuthoring } from '../../../src/data-services/authoring/story-authoring';
import { LocalStorageAdapter } from '../../../src/data-services/persistence/storage-adapter';
import '../../../src/ui/runtime/service-definitions';

describe('Story identity UI',()=>{
  let game:AronaClickerRuntime,ctrl:UIController,root:HTMLElement;
  const q=<T extends HTMLElement=HTMLElement>(selector:string):T=>{const element=document.querySelector<T>(selector);expect(element,selector).not.toBeNull();return element!;};
  const click=(selector:string)=>{q<HTMLButtonElement>(selector).click();ctrl.flushUIUpdates();};
  const change=(selector:string,value:string)=>{const input=q<HTMLInputElement|HTMLSelectElement>(selector);input.value=value;input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));ctrl.flushUIUpdates();};
  const editing=()=>game.packManager.cloneAsEditing(game.packManager.listPacks().find(pack=>pack.manifest.modName==='base')!.id).pack;
  const create=(id:string)=>{click('[data-editor-action="new"]');change('[data-story-new-mod]',id);click('[data-modal-action="create-story-in-mod"]');return currentDraft(ctrl.storyEditor.state)!;};
  beforeEach(()=>{
    localStorage.clear();document.body.innerHTML='<div id="app"></div>';root=q('#app');
    game=new AronaClickerRuntime();game.init([structuredClone(baseDatapack)]);ctrl=new UIController(game,root);ctrl.render();ctrl.storyEditor.open();
  });
  afterEach(()=>{ctrl.modal.close();ctrl.destroy();game.storyService.dispose();game.stop();vi.restoreAllMocks();localStorage.clear();});

  it('requires an explicit Mod confirmation, supports cancellation and explains an empty editing library',()=>{
    click('[data-editor-action="new"]');
    expect(q<HTMLButtonElement>('[data-modal-action="create-story-in-mod"]').disabled).toBe(true);
    expect(q('.story-editor-identity').textContent).toContain('创建编辑副本');
    click('.story-editor-identity .modal-close');expect(ctrl.storyEditor.state.drafts).toHaveLength(0);
    editing();click('[data-editor-action="new"]');click('[data-modal-action="create-story-in-mod"]');
    expect(ctrl.storyEditor.state.drafts).toHaveLength(0);expect(q('[data-story-identity-error]').hidden).toBe(false);
    click('.story-editor-identity .modal-close');expect(ctrl.storyEditor.state.visits).toHaveLength(0);
  });
  it('allocates IDs from the chosen Mod and its existing content, prompts every time and persists ownership',()=>{
    const pack=editing(), patch=emptyStoryAuthoring();
    patch.stories=[{id:'base:story:story_4',name:'已占用',startContext:{type:'area',areaId:baseDatapack.areas[0].id},stages:{},nodes:[]}];
    const result=game.saveStoryAuthoringToPack(pack.id,patch);expect(result,result.message).toMatchObject({ok:true});
    const first=create(pack.id);expect(first.document.id).toBe('base:story:story_5');expect(first.targetPackId).toBe(pack.id);
    click('[data-editor-action="new"]');expect(currentDraft(ctrl.storyEditor.state)).toBe(first);expect(ctrl.modal.isOpen()).toBe(true);
    click('[data-modal-action="create-story-in-mod"]');
    const second=currentDraft(ctrl.storyEditor.state)!;expect(second.document.id).toBe('base:story:story_6');
    click('[data-editor-action="save"]');ctrl.destroy();ctrl=new UIController(game,root);ctrl.storyEditor.open();
    expect(currentDraft(ctrl.storyEditor.state)).toMatchObject({targetPackId:pack.id,document:{id:second.document.id}});
  });
  it('rejects a removed editing target without creating a draft',()=>{
    const pack=editing();click('[data-editor-action="new"]');change('[data-story-new-mod]',pack.id);
    game.packManager.removePack(pack.id);click('[data-modal-action="create-story-in-mod"]');
    expect(ctrl.storyEditor.state.drafts).toHaveLength(0);expect(q('[data-story-identity-error]').textContent).toContain('仍可编辑');
  });
  it('shows one current ID and only shows the original ID when it differs',()=>{
    const draft=create(editing().id);
    const refresh=()=>{ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();};
    expect(q('[aria-label="Story ID"] code').textContent).toBe(draft.document.id);
    expect(document.querySelector('[aria-label="原 Story ID"]')).toBeNull();
    draft.sourceId=draft.document.id;refresh();
    expect(document.querySelector('[aria-label="原 Story ID"]')).toBeNull();
    draft.sourceId='base:story:original';refresh();
    expect(q('[aria-label="Story ID"] code').textContent).toBe(draft.document.id);
    expect(q('[aria-label="原 Story ID"] code').textContent).toBe('base:story:original');
    expect(q('[data-editor-action="rename-id"]').closest('[aria-label="Story ID"]')).not.toBeNull();
  });
  it('renames an unfinished draft without changing its internal identity or the Flag page',()=>{
    const pack=editing(), draft=create(pack.id), old=draft.document.id, draftId=draft.draftId;
    ctrl.storyEditor.state.storyInspectorTab='flags';ctrl.storyEditor.state.inspectorView='story';ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    click('[data-editor-action="rename-id"]');change('[data-story-new-id]','opening');click('[data-modal-action="rename-story-id"]');
    expect(ctrl.modal.isOpen()).toBe(false);expect(draft.draftId).toBe(draftId);expect(draft.document.id).toBe('base:story:opening');
    expect(ctrl.storyEditor.state.target?.id).toBe(draft.document.id);expect(ctrl.storyEditor.state.visits.some(visit=>visit.target.id===old)).toBe(false);
    expect(q('[data-story-inspector-panel="flags"]').hidden).toBe(false);expect(game.packManager.getPack(pack.id)!.datapack.stories.some(story=>story.id===draft.document.id)).toBe(false);
  });
  it('fixes the ModId after creation and rejects a full cross-Mod ID in the name field',()=>{
    const pack=editing(), draft=create(pack.id), old=draft.document.id;
    const other=game.packManager.createEmptyEditing({modId:'other',versionId:'1'}).pack;
    click('[data-editor-action="rename-id"]');
    const mod=q<HTMLInputElement>('[name="story-mod-id"]');
    expect(mod.value).toBe('base');expect(mod.readOnly).toBe(true);
    expect([...q<HTMLSelectElement>('[data-story-rename-mod]').options].map(option=>option.value)).not.toContain(other.id);
    change('[data-story-new-id]','other:story:opening');click('[data-modal-action="rename-story-id"]');
    expect(draft.document.id).toBe(old);expect(ctrl.modal.isOpen()).toBe(true);
    expect(q('[data-story-identity-error]').hidden).toBe(false);
  });
  it('preserves the original draft when rename is cancelled or its local storage write fails',()=>{
    const pack=editing(), draft=create(pack.id), old=draft.document.id;
    click('[data-editor-action="rename-id"]');change('[data-story-new-id]','cancelled');click('.story-editor-identity .modal-close');
    expect(draft.document.id).toBe(old);
    click('[data-editor-action="rename-id"]');change('[data-story-new-id]','opening');
    const save=vi.spyOn(LocalStorageAdapter.prototype,'set').mockImplementationOnce(()=>{throw new Error('storage full');});
    click('[data-modal-action="rename-story-id"]');
    expect(draft.document.id).toBe(old);expect(ctrl.storyEditor.state.target?.id).toBe(old);expect(ctrl.modal.isOpen()).toBe(true);
    expect(q('[data-story-identity-error]').textContent).toContain('storage full');save.mockRestore();
  });
  it('keeps the original on save failure, then commits pack identity and references together and reloads the draft',()=>{
    const pack=editing(), draft=create(pack.id), old=draft.document.id;
    draft.document={...draft.document,startContext:{type:'area',areaId:baseDatapack.areas[0].id},nodes:[{id:'jump',type:'transfer',transfer:{mode:'goto',storyId:old}}]};
    const projected=storyDefinitionFromDraft(draft);if(!projected.ok)throw new Error(projected.message);
    const patch={...emptyStoryAuthoring(),stories:[projected.story]};
    expect(game.saveStoryAuthoringToPack(pack.id,patch)).toMatchObject({ok:true});draft.sourceId=old;
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();click('[data-editor-action="rename-id"]');change('[data-story-new-id]','opening');
    const save=vi.spyOn(game,'renameStoryInPack').mockReturnValueOnce({ok:false,message:'storage full'});
    click('[data-modal-action="rename-story-id"]');expect(draft.document.id).toBe(old);expect(ctrl.modal.isOpen()).toBe(true);
    expect(game.packManager.getPack(pack.id)!.datapack.stories.some(story=>story.id===old)).toBe(true);
    click('[data-modal-action="rename-story-id"]');expect(save).toHaveBeenCalledTimes(2);expect(ctrl.modal.isOpen()).toBe(false);
    const saved=game.packManager.getPack(pack.id)!.datapack;
    expect(saved.stories.some(story=>story.id===old)).toBe(false);expect(saved.stories.find(story=>story.id===draft.document.id)!.nodes[0]).toMatchObject({transfer:{storyId:draft.document.id}});
    ctrl.destroy();ctrl=new UIController(game,root);ctrl.storyEditor.open();
    expect(ctrl.storyEditor.state.storageBlocked).toBe(false);expect(currentDraft(ctrl.storyEditor.state)).toMatchObject({sourceId:old,renamedFromId:old,document:{id:'base:story:opening'}});
  });
  it('rejects a Mod changed after preview and retains the original draft',()=>{
    const pack=editing(), draft=create(pack.id), old=draft.document.id;
    click('[data-editor-action="rename-id"]');change('[data-story-new-id]','opening');
    game.packManager.savePack({...pack,datapack:{...pack.datapack,stories:pack.datapack.stories.map((story,index)=>index===0?{...story,name:'changed'}:story)},contentDigest:undefined});
    click('[data-modal-action="rename-story-id"]');
    expect(draft.document.id).toBe(old);expect(q('[data-story-identity-error]').textContent).toContain('已变化');
  });
});
