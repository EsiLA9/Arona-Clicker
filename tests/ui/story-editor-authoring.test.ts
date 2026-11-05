// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { currentAuthoringDraft, currentNode, renameStoryNodeId } from '../../src/ui/story-editor/model';
import { compileStoryAuthoring, constructStructuredValue, editStructuredValue, hydrateStoryAuthoring } from '../../src/ui/story-editor/authoring-model';
import { editProperty, moveRowBy, rowIdAt, selectDiscriminant, selectNodeType } from '../../src/ui/story-editor/property-model';
import { withAuthoredStoryCatalog } from '../../src/ui/columns/authored-story-catalog';
import '../../src/ui/runtime/service-definitions';

describe('Story authoring UI and draft API', () => {
  let game: GameInstance, ctrl: UIController, root: HTMLElement;
  const draft = () => currentAuthoringDraft(ctrl.storyEditor.state)!;
  const q = <T extends HTMLElement = HTMLElement>(selector: string): T => { const item = root.querySelector<T>(selector); expect(item,selector).not.toBeNull(); return item!; };
  const click = (selector: string) => { q<HTMLButtonElement>(selector).click(); ctrl.flushUIUpdates(); };
  const change = (element: HTMLInputElement | HTMLSelectElement, value: string) => { element.value=value; element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true})); ctrl.flushUIUpdates(); };
  const valueControl = (scope: string, path: (string|number)[], attr: string) => {
    const found = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[${attr}]`)].find(x=>x.dataset.valueScope===scope&&x.dataset.valuePath===JSON.stringify(path));
    expect(found,JSON.stringify(path)).toBeTruthy(); return found!;
  };
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML='<div id="app"></div>'; root=document.querySelector('#app')!;
    game=new GameInstance(); game.init([baseDatapack]); ctrl=new UIController(game,root);
    ctrl.storyEditor.open(); click('[data-editor-action="new"]');
    change(q('[data-editor-field="story-context-area"]'),baseDatapack.areas[0].id);
  });
  afterEach(()=>{ctrl.destroy();game.storyService.dispose();game.stop();localStorage.clear();});
  it('creates and edits an Entry, checks/applies it, and retains it after draft reload', () => {
    click('[data-authoring-add="activeStories"]');
    const entry=draft().authoring!.activeStories[0]; const scope='$authoring';
    expect(root.querySelector('[data-authoring-field="activeStories"]')).toBeNull();
    click(`[data-editor-entry-target="${entry.id}"]`);
    expect(q('[data-authoring-field="activeStories"]').closest('.story-editor-center')).not.toBeNull();
    expect(root.querySelector('.story-editor-right [data-value-input]')).toBeNull();
    const identity=valueControl(scope,['activeStories',0,'id'],'data-value-input'); identity.focus();
    change(identity,'local:activestory:manual');expect(document.activeElement).toBe(identity);
    expect(entry.id).toBe('local:activestory:manual');
    expect(ctrl.storyEditor.state.target).toEqual({kind:'entry',id:entry.id});
    click('[data-authoring-action="check"]'); expect(ctrl.storyEditor.state.error).toBeNull();
    expect(game.registry.activeStories.has(entry.id)).toBe(false);
    click('[data-authoring-action="apply"]'); expect(ctrl.storyEditor.state.error).toBeNull();
    expect(game.registry.activeStories.get(entry.id)?.storyId).toBe(draft().document.id);
    const id=draft().document.id;
    ctrl.destroy(); ctrl=new UIController(game,root); ctrl.storyEditor.open();
    expect(draft().document.id).toBe(id); expect(draft().authoring!.activeStories[0].id).toBe(entry.id);
  });
  it('edits a registered Passive Entry in the center and retains invalid input through navigation and reload', () => {
    const entry = [...game.registry.passiveStories.values()][0];
    const original = structuredClone(entry);
    click('[data-column-action="story-editor-sidebar:entries"]');
    click(`[data-editor-entry="${entry.id}"]`);
    const owner = draft();
    const index = owner.authoring!.passiveStories.findIndex(row => row.id === entry.id);
    const weight = valueControl('$authoring',['passiveStories',index,'weight'],'data-value-input');
    weight.focus(); change(weight,'-');
    expect(document.activeElement).toBe(weight);
    expect(weight.closest('.story-editor-center')).not.toBeNull();
    click('[data-authoring-action="check"]'); expect(ctrl.storyEditor.state.error).toBeTruthy();
    expect(game.registry.passiveStories.get(entry.id)).toEqual(original);
    click('[data-editor-action="save"]');
    ctrl.destroy(); ctrl=new UIController(game,root); ctrl.storyEditor.open();
    click(`[data-editor-entry-target="${entry.id}"]`);
    expect(valueControl('$authoring',['passiveStories',index,'weight'],'data-value-input').value).toBe('-');
    change(valueControl('$authoring',['passiveStories',index,'weight'],'data-value-input'),'2');
    click('[data-authoring-catalog="passiveStories"]');
    expect(draft().authoring!.passiveStories[index].extra).toBeTruthy();
    click('[data-authoring-action="check"]'); expect(ctrl.storyEditor.state.error).toBeNull();
  });

  it('removes an Entry from its center form and returns to its owner Story', () => {
    click('[data-authoring-add="activeStories"]');
    const owner = draft(); const entry = owner.authoring!.activeStories[0];
    click(`[data-editor-entry-target="${entry.id}"]`);
    const remove = [...root.querySelectorAll<HTMLButtonElement>('[data-value-action="remove"]')].find(button => button.dataset.valuePath === JSON.stringify(['activeStories',0]))!;
    remove.click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target).toEqual({kind:'story',id:owner.document.id});
    expect(owner.authoring!.activeStories).toHaveLength(0);
    expect(owner.authoring!.removed?.activeStories).toContain(entry.id);
  });

  it('edits, saves and removes Passive Pools in the Entry center without switching the selected Entry', () => {
    expect(root.querySelector('[data-authoring-add="passivePools"]')).toBeNull();
    click('[data-authoring-add="passiveStories"]');
    const owner = draft(); const entry = owner.authoring!.passiveStories[0];
    click(`[data-editor-entry-target="${entry.id}"]`);
    const center = q('.story-editor-center .workspace-column__body');
    const right = q('.story-editor-right .workspace-column__body');
    click('[data-authoring-add="passivePools"]');
    const pool = owner.authoring!.passivePools[0];
    const identity = valueControl('$authoring',['passivePools',0,'id'],'data-value-input');
    identity.focus(); change(identity,'local:passivepool:manual');
    expect(document.activeElement).toBe(identity);
    expect(identity.closest('.story-editor-center')).not.toBeNull();
    expect(ctrl.storyEditor.state.target).toEqual({kind:'entry',id:entry.id});
    const children = [...root.querySelectorAll<HTMLButtonElement>('[data-value-action="add"]')].find(button => button.dataset.valuePath === JSON.stringify(['passivePools',0,'children']))!;
    children.click(); ctrl.flushUIUpdates();
    change(valueControl('$authoring',['passivePools',0,'children',0],'data-value-type'),'pool-child');
    change(valueControl('$authoring',['passivePools',0,'children',0,'id'],'data-value-input'),entry.id);
    const weightPath = ['passivePools',0,'children',0,'weight'];
    change(valueControl('$authoring',weightPath,'data-value-input'),'-');
    click('[data-authoring-action="check"]'); expect(ctrl.storyEditor.state.error).toBeTruthy();
    expect(game.registry.passivePools.has(pool.id)).toBe(false);
    expect(q('.story-editor-center .workspace-column__body')).toBe(center);
    expect(q('.story-editor-right .workspace-column__body')).toBe(right);
    click('[data-editor-action="save"]');
    ctrl.destroy(); ctrl=new UIController(game,root); ctrl.storyEditor.open();
    expect(root.querySelector('[data-authoring-add="passivePools"]')).toBeNull();
    click(`[data-editor-entry-target="${entry.id}"]`);
    expect(valueControl('$authoring',weightPath,'data-value-input').value).toBe('-');
    change(valueControl('$authoring',weightPath,'data-value-input'),'2');
    click('[data-authoring-action="apply"]'); expect(ctrl.storyEditor.state.error).toBeNull();
    expect(game.registry.passivePools.get(pool.id)?.children).toEqual([{id:entry.id,weight:2}]);
    const remove = [...root.querySelectorAll<HTMLButtonElement>('[data-value-action="remove"]')].find(button => button.dataset.valuePath === JSON.stringify(['passivePools',0]))!;
    remove.click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target).toEqual({kind:'entry',id:entry.id});
    expect(draft().authoring!.passivePools).toHaveLength(0);
    expect(draft().authoring!.removed?.passivePools).toContain(pool.id);
    click('[data-authoring-action="apply"]'); expect(ctrl.storyEditor.state.error).toBeNull();
    expect(game.registry.passivePools.has(pool.id)).toBe(false);
  });

  it('shows live calls and callers in Story/Entry properties and navigates them through shared history', () => {
    const gameplay = game.storyService.getCurrentStoryId();
    click('[data-authoring-add="activeStories"]');
    const first = draft(), firstEntry = first.authoring!.activeStories[0];
    click('[data-editor-action="new"]');
    const second = draft();
    change(q('[data-editor-field="story-context-area"]'),baseDatapack.areas[0].id);
    click('[data-authoring-add="activeStories"]');
    const secondEntry = second.authoring!.activeStories[0];
    first.document.nodes = [
      {id:'next',type:'transfer',transfer:{mode:'insert',storyId:second.document.id}},
      {id:'invite',type:'operation',action:{kind:'entryRequest',request:{entryId:secondEntry.id,entryType:'active',owner:null,intent:'ordinary'}}},
      {id:'missing',type:'transfer',transfer:{mode:'goto',storyId:'test:story:missing'}},
    ];
    first.dirty = true;
    click(`[data-editor-story="${first.draftId}"]`);
    const relations = q('.story-editor-right .story-editor-relations');
    expect(relations.textContent).toContain('调用表');
    expect(relations.textContent).toContain('被调用表');
    expect(q<HTMLButtonElement>('.story-editor-relations [data-editor-story-target="test:story:missing"]').disabled).toBe(true);
    expect(q(`.story-editor-relations [data-editor-entry-target="${firstEntry.id}"]`).textContent).toContain('起始 Story');
    const name = q<HTMLInputElement>('[data-editor-field="name"]');
    name.focus(); change(name,'关系测试');
    expect(document.activeElement).toBe(name);
    expect(q('.story-editor-relations')).toBe(relations);
    first.document.nodes = first.document.nodes.filter(node=>node.id!=='missing');
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    expect(root.querySelector('.story-editor-relations [data-editor-story-target="test:story:missing"]')).toBeNull();
    click(`.story-editor-relations [data-editor-entry-target="${firstEntry.id}"]`);
    const potential = q('.story-editor-right .story-editor-relations');
    expect(potential.textContent).toContain('潜在调用集');
    expect(potential.querySelector(`[data-editor-story-target="${first.document.id}"]`)).not.toBeNull();
    expect(potential.querySelector(`[data-editor-story-target="${second.document.id}"]`)).not.toBeNull();
    click(`.story-editor-relations [data-editor-entry-target="${secondEntry.id}"]`);
    expect(ctrl.storyEditor.state.target).toEqual({kind:'entry',id:secondEntry.id});
    expect(q('.story-editor-relations').textContent).toContain('节点 invite');
    click(`.story-editor-relations [data-editor-story-target="${first.document.id}"]`);
    expect(ctrl.storyEditor.state.target).toEqual({kind:'story',id:first.document.id});
    click('[data-editor-action="history-back"]');
    expect(ctrl.storyEditor.state.target).toEqual({kind:'entry',id:secondEntry.id});
    click('[data-editor-action="history-back"]');
    expect(ctrl.storyEditor.state.target).toEqual({kind:'entry',id:firstEntry.id});
    change(valueControl('$authoring',['activeStories',0,'storyId'],'data-value-input'),second.document.id);
    expect(root.querySelector(`.story-editor-relations [data-editor-story-target="${first.document.id}"]`)).toBeNull();
    expect(q(`.story-editor-relations [data-editor-story-target="${second.document.id}"]`)).toBeTruthy();
    expect(game.registry.stories.has(first.document.id)).toBe(false);
    expect(game.registry.activeStories.has(firstEntry.id)).toBe(false);
    expect(game.storyService.getCurrentStoryId()).toBe(gameplay);
  });

  it('exposes nested localFlag fields and structured values in a Button result', () => {
    click('[data-editor-action="click"]'); const node=currentNode(ctrl.storyEditor.state)!;
    editProperty(draft(),node.id,['interaction','text'],'继续');
    editProperty(draft(),node.id,['interaction','result'],{actions:[{kind:'localFlag',op:'set',name:'answer',value:{number:1}}]});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    const name=[...root.querySelectorAll<HTMLInputElement>('[data-story-property-path]')].find(x=>x.dataset.storyPropertyPath===JSON.stringify(['interaction','result','actions',0,'name']))!;
    expect(name.closest('label')?.textContent).toContain('局部标记名称'); change(name,'selected');
    const path=['interaction','result','actions',0,'value','number'];
    const input=valueControl(node.id,path,'data-value-input') as HTMLInputElement;
    input.focus(); change(input,'-');
    expect(compileStoryAuthoring(ctrl.storyEditor.state)).toMatchObject({ok:false});
    expect(document.activeElement).toBe(input); expect(input.value).toBe('-');
    change(input,'3');
    const compiled=compileStoryAuthoring(ctrl.storyEditor.state); expect(compiled.ok).toBe(true);
    if(compiled.ok) expect(compiled.patch.stories[0].nodes[0]).toMatchObject({interaction:{result:{actions:[{kind:'localFlag',name:'selected',value:{number:3}}]}}});
  });
  it('does not expose legacy bounded child association controls', () => {
    click('[data-authoring-add="activeStories"]');
    click(`[data-editor-entry-target="${draft().authoring!.activeStories[0].id}"]`);
    expect([...q<HTMLSelectElement>('[data-authoring-field="activeStories"]').options].some(option=>option.value==='kizuna')).toBe(false);
    expect(root.querySelector('[data-authoring-kizuna-mode]')).toBeNull();
  });
  it('keeps pending numeric input with its stable action row after reorder and reload', () => {
    click('[data-editor-action="click"]');const node=currentNode(ctrl.storyEditor.state)!;
    selectDiscriminant(draft(),node.id,['interaction'],'kind','choice');
    editProperty(draft(),node.id,['interaction','sharedActions'],[{kind:'localFlag',op:'set',name:'first',value:1},{kind:'localFlag',op:'set',name:'second',value:2}]);
    const list=['interaction','sharedActions'];const first=rowIdAt(draft(),node.id,list,0)!;
    editStructuredValue(draft(),node.id,[...list,0,'value'],'number','-');
    moveRowBy(draft(),node.id,list,first,1);
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(valueControl(node.id,[...list,1,'value'],'data-value-input').value).toBe('-');
    expect(valueControl(node.id,[...list,0,'value'],'data-value-input').value).toBe('2');
    click('[data-editor-action="save"]');ctrl.destroy();ctrl=new UIController(game,root);ctrl.storyEditor.open();
    expect(Object.values(draft().structuredInputs!).some(x=>x.text==='-'&&x.error)).toBe(true);
  });
  it('constructs expressions and Extra without raw JSON and protects published identities', () => {
    constructStructuredValue(draft(),'$document',['extra'],'extra-dict');
    expect(draft().document.extra).toEqual({t:'dict',v:{}});
    click('[data-editor-action="operation"]');const node=currentNode(ctrl.storyEditor.state)!;
    selectDiscriminant(draft(),node.id,['action'],'kind','state');
    editProperty(draft(),node.id,['action','effects'],[{op:'addResource',resourceId:[...game.registry.resourceDisplays.values()][0].resourceId,amount:1}]);
    constructStructuredValue(draft(),node.id,['action','effects',0,'amount'],'mul');
    const compiled=compileStoryAuthoring(ctrl.storyEditor.state);expect(compiled.ok).toBe(true);
    if(compiled.ok) expect(compiled.patch.stories[0].nodes[0]).toMatchObject({action:{effects:[{amount:{type:'mul',left:{type:'const',value:0}}}]}});
    click('[data-editor-action="info"]'); const original=draft().document.id;
    change(q('[data-authoring-copy-id]'),'local:story:copy');click('[data-authoring-copy]');
    expect(draft().document.id).toBe('local:story:copy');expect(ctrl.storyEditor.state.drafts.some(x=>x.document.id===original)).toBe(true);
  });
  it('suspends invalid structured input with its branch and keeps it after a node ID change', () => {
    click('[data-editor-action="operation"]');const node=currentNode(ctrl.storyEditor.state)!;
    editProperty(draft(),node.id,['action'],{kind:'localFlag',op:'set',name:'answer',value:1});
    editStructuredValue(draft(),node.id,['action','value'],'number','-');
    expect(compileStoryAuthoring(ctrl.storyEditor.state).ok).toBe(false);
    selectNodeType(draft(),node.id,'transfer');expect(compileStoryAuthoring(ctrl.storyEditor.state).ok).toBe(true);
    selectNodeType(draft(),node.id,'operation');expect(compileStoryAuthoring(ctrl.storyEditor.state).ok).toBe(false);
    expect(renameStoryNodeId(ctrl.storyEditor.state,node.id,'renamed')).toBe(true);
    expect(compileStoryAuthoring(ctrl.storyEditor.state).ok).toBe(false);
    editStructuredValue(draft(),'renamed',['action','value'],'number','4');
    expect(compileStoryAuthoring(ctrl.storyEditor.state).ok).toBe(true);
  });
  it('projects Entry-owned catalog metadata without changing the base table', () => {
    const base={categories:[]}; const entry={id:'test:activestory:one',type:'active' as const,storyId:'test:story:one',availableInits:[],triggerCondition:{type:'AND' as const,conditions:[]},extra:{t:'dict' as const,v:{storyCatalog:{t:'dict' as const,v:{category:{t:'str' as const,v:'剧情:分类'},part:{t:'str' as const,v:'篇章'},chapter:{t:'str' as const,v:'章节'}}}}}};
    const catalog=withAuthoredStoryCatalog(base,[entry]);expect(base.categories).toHaveLength(0);
    expect(catalog.categories[0].id).not.toContain(':');expect(catalog.categories[0].parts[0].chapters?.[0].items[0].entryId).toBe(entry.id);
  });
});
