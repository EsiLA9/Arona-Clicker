// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft, currentNode, renameStoryNodeId } from '../../src/ui/story-editor/model';
import { compileStoryAuthoring, constructStructuredValue, editStructuredValue, hydrateStoryAuthoring } from '../../src/ui/story-editor/authoring-model';
import { editProperty, moveRowBy, rowIdAt, selectDiscriminant, selectNodeType } from '../../src/ui/story-editor/property-model';
import { withAuthoredStoryCatalog } from '../../src/ui/columns/authored-story-catalog';
import '../../src/ui/runtime/service-definitions';

describe('Story authoring UI and draft API', () => {
  let game: GameInstance, ctrl: UIController, root: HTMLElement;
  const draft = () => currentDraft(ctrl.storyEditor.state)!;
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
    const identity=valueControl(scope,['activeStories',0,'id'],'data-value-input'); identity.focus();
    change(identity,'local:activestory:manual');expect(document.activeElement).toBe(identity);
    expect(entry.id).toBe('local:activestory:manual');
    click('[data-authoring-action="check"]'); expect(ctrl.storyEditor.state.error).toBeNull();
    expect(game.registry.activeStories.has(entry.id)).toBe(false);
    click('[data-authoring-action="apply"]'); expect(ctrl.storyEditor.state.error).toBeNull();
    expect(game.registry.activeStories.get(entry.id)?.storyId).toBe(draft().document.id);
    const id=draft().document.id;
    ctrl.destroy(); ctrl=new UIController(game,root); ctrl.storyEditor.open();
    expect(draft().document.id).toBe(id); expect(draft().authoring!.activeStories[0].id).toBe(entry.id);
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
  it('provides bounded child and Area invitation controls without an after callback editor', () => {
    click('[data-authoring-add="activeStories"]');
    change(q('[data-authoring-field="activeStories"]'),'kizuna');
    const mode=q<HTMLSelectElement>('[data-authoring-kizuna-mode]');change(mode,'area');
    const binding=draft().authoring!.activeStories[0].kizuna!;expect(binding.areaId).toBe('');
    change(valueControl('$authoring',['activeStories',0,'kizuna','areaId'],'data-value-input'),baseDatapack.areas[0].id);
    expect(binding.areaId).toBe(baseDatapack.areas[0].id);
    change(q('[data-authoring-kizuna-mode]'),'direct');expect(binding).not.toHaveProperty('areaId');
    expect(root.textContent).toContain('回传局部标记白名单');expect(binding.returnFlags).toEqual([]);
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
