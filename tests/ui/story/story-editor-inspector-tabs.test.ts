// @vitest-environment happy-dom
import { createStoryForTest } from './story-editor-test-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { UIController } from '../../../src/ui/controller/controller';
import { currentDraft, type StoryDraft } from '../../../src/ui/story-editor/model';
import { emptyStoryAuthoring } from '../../../src/data-services/authoring/story-authoring';
import { currentRelatedFlagCatalog } from '../../../src/ui/story-editor/flag-catalog-view';
import { createUIContext } from '../../../src/ui/runtime/context';
import '../../../src/ui/runtime/service-definitions';

describe('StoryDef inspector pages and flag drops', () => {
  let game: GameInstance, ctrl: UIController, root: HTMLElement, draft: StoryDraft;
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const element = document.querySelector<T>(selector); expect(element,selector).not.toBeNull(); return element!;
  };
  const refresh = () => { ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates(); };
  const tab = (id: string) => { find<HTMLButtonElement>(`[data-column-action="story-editor-inspector-tab:${id}"]`).click(); ctrl.flushUIUpdates(); };
  const panel = (id: string) => find(`[data-story-inspector-panel="${id}"]`);
  const row = (name: string, available = true) => [...root.querySelectorAll<HTMLDetailsElement>('[data-story-drop-target="story-flag-table"]')].find(row => row.dataset.storyFlagName === name && (row.dataset.storyFlagBindable === 'true') === available)!;
  function transfer() {
    const data = new Map<string,string>();
    return {setData:(type:string,value:string) => data.set(type,value),getData:(type:string) => data.get(type) ?? '',get types(){return [...data.keys()];},effectAllowed:'none',dropEffect:'none'} as unknown as DataTransfer;
  }
  function drag(element: HTMLElement, type: string, data: DataTransfer) {
    const event = new Event(type,{bubbles:true,cancelable:true}); Object.defineProperty(event,'dataTransfer',{value:data});
    element.dispatchEvent(event); ctrl.flushUIUpdates(); return event;
  }
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>'; root = find('#app');
    game = new GameInstance(); game.init([structuredClone(baseDatapack)]); ctrl = new UIController(game,root);
    ctrl.render(); ctrl.storyEditor.open(); createStoryForTest(game,ctrl); ctrl.flushUIUpdates();
    draft = currentDraft(ctrl.storyEditor.state)!;
    draft.document = {...draft.document,startContext:{type:'area',areaId:[...game.registry.areas.keys()][0]},stages:{one:{advance:'auto'}},nodes:[
      {id:'writer',type:'operation',action:{kind:'localFlag',op:'set',name:'local',value:true}},
      {id:'reader',type:'talklet',stageId:'one',content:{kind:'talk',text:'正文'}},
      {id:'blocked',type:'talklet',stageId:'one',requiresFlag:'different',content:{kind:'talk',text:'保留条件'}},
      {id:'global',type:'operation',action:{kind:'state',effects:[{op:'setFlag',flagId:'global',value:true}]}},
    ]};
    const authoring = emptyStoryAuthoring();
    authoring.activeStories.push({id:'local:activestory:parent',storyId:'local:story:parent',availableInits:[],triggerCondition:{type:'AND',conditions:[]}, activation: { kind: 'active' as const } },
      {id:'local:activestory:private',storyId:'local:story:private',availableInits:[],triggerCondition:{type:'AND',conditions:[]}, activation: { kind: 'active' as const } });
    const parent: StoryDraft = {...structuredClone(draft),draftId:'parent',sourceId:null,authoring,document:{...structuredClone(draft.document),id:'local:story:parent',name:'上游 Story',nodes:[
      {id:'parent-flag',type:'operation',action:{kind:'localFlag',op:'set',name:'from-parent',value:true}},
      {id:'into-current',type:'transfer',transfer:{mode:'insert',storyId:draft.document.id}},
      {id:'card',type:'click',stageId:'one',interaction:{kind:'entryCard',card:{request:{entryId:'local:activestory:private',entryType:'active',owner:null,intent:'card'}}}},
    ]}};
    const privateStory: StoryDraft = {...structuredClone(draft),draftId:'private',sourceId:null,document:{...structuredClone(draft.document),id:'local:story:private',name:'其他 Entry',nodes:[{id:'secret',type:'operation',action:{kind:'localFlag',op:'set',name:'private',value:true}}]}};
    ctrl.storyEditor.state.drafts.push(parent,privateStory); refresh();
  });
  afterEach(() => { ctrl.modal.close(); ctrl.destroy(); game.stop(); vi.restoreAllMocks(); localStorage.clear(); });

  it('switches stable pages, keeps input and scroll, and restores the chosen page after node properties', () => {
    const pages = ['overview','relations','flags','tools'].map(panel), input = find<HTMLInputElement>('[data-editor-field="name"]');
    const full = vi.spyOn(ctrl,'render'), flow = find('.story-editor-flow');
    expect(panel('overview').hidden).toBe(false); expect(panel('tools').hidden).toBe(true);
    tab('flags'); const body = find('.story-editor-right .workspace-column__body'); body.scrollTop = 74;
    tab('relations'); expect(panel('flags').hidden).toBe(true); expect(body.scrollTop).toBe(0);
    tab('flags'); expect(body.scrollTop).toBe(74);
    pages.forEach((page,index) => expect(panel(['overview','relations','flags','tools'][index]) === page).toBe(true));
    expect(find('[data-editor-field="name"]') === input).toBe(true); expect(find('.story-editor-flow') === flow).toBe(true);
    find('[data-editor-node="reader"]').click(); ctrl.flushUIUpdates();
    const nodeProperties = find('[data-story-node-properties]');
    expect(nodeProperties.querySelector('.story-editor-flag-catalog')).toBeNull();
    expect(nodeProperties.querySelector('[data-editor-field="requires-flag"]')).not.toBeNull();
    find('[data-editor-action="info"]').click(); ctrl.flushUIUpdates();
    expect(panel('flags').hidden).toBe(false); expect(body.scrollTop).toBe(74); expect(full).not.toHaveBeenCalled();
    tab('tools'); expect(panel('tools').querySelector('[data-authoring-action="check"]')).not.toBeNull();
    tab('relations'); expect(panel('relations').querySelector('[data-authoring-add="activeStories"]')).not.toBeNull();
  });

  it('accepts same-Entry flags from upstream without moving nodes or leaving the flag page', () => {
    tab('flags'); const target = row('from-parent'); expect(target).toBeDefined();
    const source = find('[data-editor-node="reader"]'), data = transfer();
    const before = draft.document.nodes.map(node => node.id), running = game.storyService.getCurrentStoryId();
    const body = find('.story-editor-right .workspace-column__body'); body.scrollTop = 48;
    drag(source,'dragstart',data); expect(panel('flags').hidden).toBe(false);
    expect(drag(target,'dragover',data).defaultPrevented).toBe(true); expect(target.dataset.storyFlagDropStatus).toBe('可绑定');
    drag(target,'drop',data); drag(source,'dragend',data);
    expect(draft.document.nodes.find(node => node.id === 'reader')).toMatchObject({requiresFlag:'from-parent',content:{text:'正文'}});
    expect(draft.document.nodes.map(node => node.id)).toEqual(before); expect(game.storyService.getCurrentStoryId()).toBe(running);
    expect(panel('flags').hidden).toBe(false); expect(row('from-parent') === target).toBe(true); expect(body.scrollTop).toBe(48);
    draft.dirty = false; drag(source,'dragstart',data); drag(target,'dragover',data);
    expect(target.dataset.storyFlagDropStatus).toBe('已绑定');
    drag(target,'drop',data); drag(source,'dragend',data); expect(draft.dirty).toBe(false);
    expect(target.dataset.storyFlagDropStatus).toBeUndefined();
  });

  it('discloses coloured flags in place, groups their uses and keeps disclosure through a refresh', () => {
    draft.document.nodes = draft.document.nodes.map(node=>node.id==='reader' ? {...node,requiresFlag:'local'} : node);
    draft.document.nodes.push({id:'remove',type:'operation',action:{kind:'localFlag',op:'remove',name:'local'}});
    refresh(); tab('flags');
    const item = row('local') as HTMLDetailsElement, summary = item.querySelector('summary')!;
    const flow = find('.story-editor-flow'), full = vi.spyOn(ctrl,'render'), refreshEditor = vi.spyOn(ctrl.storyEditor,'requestRefresh');
    const body = find('.story-editor-right .workspace-column__body'); body.scrollTop = 48;
    expect(item.tagName).toBe('DETAILS'); expect(item.open).toBe(false);
    expect(summary.querySelector('code')?.textContent).toBe('local');
    expect(summary.querySelector('.story-editor-flag-roles')?.textContent).toBe('本篇 双向');
    expect(item.parentElement?.getAttribute('style')).toContain('--story-editor-choice-flag-color:hsl(');
    expect(summary.title).toContain('将本 Story 的节点拖到此处');
    expect(item.textContent).not.toContain('将本 Story 的节点拖到此处');
    const cards = () => item.querySelectorAll<HTMLButtonElement>('.story-identity-card[data-editor-story-target]');
    expect(cards()).toHaveLength(1);
    expect(cards()[0].querySelector('code')?.textContent).toBe(draft.document.id);
    expect(cards()[0].querySelector('.story-editor-relation-detail')?.textContent).toBe('双向');
    expect(cards()[0].parentElement?.dataset.storyFlagNode).toBe('writer');
    expect(summary.title).toContain('local:activestory:parent');
    summary.click(); expect(item.open).toBe(true);
    expect(refreshEditor).not.toHaveBeenCalled(); expect(full).not.toHaveBeenCalled();
    expect(body.scrollTop).toBe(48); expect(find('.story-editor-flow')).toBe(flow);
    draft.document.nodes.push({id:'another-reader',type:'talklet',stageId:'one',requiresFlag:'local',content:{kind:'talk',text:'另一需求方'}});
    refresh();
    expect(row('local')).toBe(item); expect(item.open).toBe(true);
    expect(item.querySelector('summary')).toBe(summary);
    expect(cards()).toHaveLength(1);
    expect(cards()[0].parentElement?.dataset.storyFlagNode).toBe('writer');
    expect((row('global',false) as HTMLDetailsElement).open).toBe(false);
    summary.click(); expect(item.open).toBe(false); refresh(); expect(item.open).toBe(false);
    const global = row('global',false) as HTMLDetailsElement;
    global.querySelector('summary')!.click(); expect(global.open).toBe(true);
  });

  it('renames only the current Story, warns about shared references and retains the expanded row', () => {
    const parent = ctrl.storyEditor.state.drafts.find(item => item.draftId === 'parent')!;
    parent.document.nodes.push({ id: 'external-reader', type: 'operation', requiresFlag: 'local' });
    draft.document.nodes.push({ id: 'local-reader', type: 'operation', requiresFlag: 'local' });
    refresh(); tab('flags');
    const flag = row('local');
    flag.querySelector('summary')!.click();
    expect([...flag.querySelectorAll('.story-editor-flag-roles > span')].map(label => label.textContent)).toEqual(['本篇 双向', '其他 依赖']);
    expect([...flag.querySelectorAll('.story-editor-relation-detail')].map(label => label.textContent)).toEqual(['双向', '依赖']);
    flag.parentElement!.querySelector<HTMLButtonElement>('[data-story-flag-rename]')!.click();
    const form = find<HTMLFormElement>('.story-editor-flag-rename-form');
    const input = form.querySelector('input')!;
    expect(form.textContent).toContain('已发现 1 个外部');
    input.value = 'from-parent';
    const submit = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    submit(); expect(form.querySelector('[role="alert"]')?.textContent).toContain('同名');
    input.value = 'local-renamed'; refresh();
    expect(form.querySelector('input')?.value).toBe('local-renamed');
    submit(); ctrl.flushUIUpdates();
    expect(row('local-renamed').open).toBe(true);
    expect(draft.document.nodes.find(node => node.id === 'local-reader')?.requiresFlag).toBe('local-renamed');
    expect(draft.document.nodes.find(node => node.id === 'writer')).toMatchObject({ action: { name: 'local-renamed' } });
    expect(parent.document.nodes.find(node => node.id === 'external-reader')?.requiresFlag).toBe('local');
    expect(row('local', false).querySelector('.story-editor-flag-roles')?.textContent).toBe('其他 依赖');
    const global = row('global', false);
    global.parentElement!.querySelector<HTMLButtonElement>('[data-story-flag-rename]')!.click();
    const globalForm = find<HTMLFormElement>('.story-editor-flag-rename-form');
    globalForm.querySelector('input')!.value = 'global-renamed';
    globalForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); ctrl.flushUIUpdates();
    expect(draft.document.nodes.find(node => node.id === 'global')).toMatchObject({ action: { effects: [{ flagId: 'global-renamed' }] } });
    expect(row('global-renamed', false).open).toBe(false);
  });

  it('remembers each Story page and does not apply pending tab scroll to another document', () => {
    tab('flags'); const body = find('.story-editor-right .workspace-column__body'); body.scrollTop = 96;
    const other = find<HTMLButtonElement>('[data-editor-story="parent"]'); other.click(); ctrl.flushUIUpdates();
    expect(panel('flags').hidden).toBe(false); expect(body.scrollTop).toBe(0);
    tab('tools'); body.scrollTop = 22;
    find<HTMLButtonElement>(`[data-editor-story="${draft.draftId}"]`).click(); ctrl.flushUIUpdates();
    expect(panel('flags').hidden).toBe(false); expect(body.scrollTop).toBe(96);
    find<HTMLButtonElement>('[data-column-action="story-editor-inspector-tab:relations"]').click();
    other.click(); ctrl.flushUIUpdates();
    expect(panel('tools').hidden).toBe(false); expect(body.scrollTop).toBe(22);
    find<HTMLButtonElement>(`[data-editor-story="${draft.draftId}"]`).click(); ctrl.flushUIUpdates();
    expect(panel('relations').hidden).toBe(false); expect(body.scrollTop).toBe(0);
  });

  it('rejects global flags, conflicting conditions, stale payloads and disabled editing', () => {
    tab('flags'); const source = find('[data-editor-node="reader"]'), blocked = find('[data-editor-node="blocked"]'), data = transfer();
    drag(blocked,'dragstart',data); drag(row('local'),'drop',data);
    expect(draft.document.nodes.find(node => node.id === 'blocked')?.requiresFlag).toBe('different');
    drag(source,'dragstart',data); const global = row('global',false); drag(global,'dragover',data); expect(global.classList.contains('is-drop-invalid')).toBe(true);
    drag(global,'drop',data); expect(draft.document.nodes.find(node => node.id === 'reader')?.requiresFlag).toBeUndefined();
    data.setData('application/x-acprogram-story-editor',JSON.stringify({version:1,kind:'story-node',draftId:'other-draft',nodeId:'reader'}));
    drag(row('local'),'drop',data); expect(draft.document.nodes.find(node => node.id === 'reader')?.requiresFlag).toBeUndefined();
    ctrl.storyEditor.state.storageBlocked = true;
    data.setData('application/x-acprogram-story-editor',JSON.stringify({version:1,kind:'story-node',draftId:draft.draftId,nodeId:'reader'}));
    drag(row('local'),'drop',data); expect(draft.document.nodes.find(node => node.id === 'reader')?.requiresFlag).toBeUndefined();
  });

  it('asks before inspecting another Entry, keeps its private flags unbindable and navigates to a flag source separately', () => {
    tab('flags'); expect(row('private',false)).toBeUndefined();
    find<HTMLButtonElement>('[data-story-flag-import]').click(); expect(ctrl.modal.isOpen()).toBe(true);
    find<HTMLButtonElement>('[data-modal-action="flag-import-yes"]').click(); ctrl.flushUIUpdates();
    const privateFlag = row('private',false); expect(privateFlag).toBeDefined();
    const data = transfer(), source = find('[data-editor-node="reader"]'); drag(source,'dragstart',data); drag(privateFlag,'drop',data);
    expect(draft.document.nodes.find(node => node.id === 'reader')?.requiresFlag).toBeUndefined();
    const history = ctrl.storyEditor.state.visitIndex;
    row('from-parent').querySelector('summary')!.click();
    row('from-parent').querySelector<HTMLButtonElement>('[data-editor-story-target]')!.click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target).toEqual({kind:'story',id:'local:story:parent'});
    expect(ctrl.storyEditor.state.selectedNodeId).toBe('parent-flag'); expect(ctrl.storyEditor.state.inspectorView).toBe('story');
    expect(panel('flags').hidden).toBe(false);
    expect(ctrl.storyEditor.state.visitIndex).toBeGreaterThan(history);
    expect(currentRelatedFlagCatalog(createUIContext(game),ctrl.storyEditor.state).uses.length).toBeGreaterThan(0);
    find<HTMLButtonElement>('[data-editor-action="history-back"]').click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target?.id).toBe(draft.document.id);
    expect(panel('flags').hidden).toBe(false);
    find<HTMLButtonElement>('[data-editor-action="history-forward"]').click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target?.id).toBe('local:story:parent'); expect(panel('flags').hidden).toBe(false);
    find('[data-editor-node="parent-flag"]').click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.inspectorView).toBe('node');
  });
});
