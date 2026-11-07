// @vitest-environment happy-dom
import { createStoryForTest } from './story-editor-test-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyStoryNode, pasteStoryNode } from '../../src/ui/story-editor/node-clipboard';
import { createStoryEditorState, currentDraft, editNodeFlag, newStory, type StoryDraft } from '../../src/ui/story-editor/model';
import { editProperty, readProperty, rowIdAt, selectNodeType, toggleOptional } from '../../src/ui/story-editor/property-model';
import { editStructuredValue, structuredKey } from '../../src/ui/story-editor/authoring-model';
import { StoryDraftPersistence } from '../../src/ui/story-editor/persistence';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import '../../src/ui/runtime/service-definitions';

describe('Story node clipboard', () => {
  it('pastes immutable snapshots at a gap, allocates copy numbers and avoids recursive suffixes', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    draft.document.nodes = [{id:'intro',type:'talklet',stageId:'one',content:{kind:'talk',text:'original'}}, {id:'intro-copy-1',type:'operation'}, {id:'end',type:'operation'}];
    const clipboard = copyStoryNode(draft,'intro')!;
    editProperty(draft,'intro',['content','text'],'changed');
    const first = pasteStoryNode(state,clipboard,'end')!;
    const second = pasteStoryNode(state,clipboard,'end')!;
    expect([first.id,second.id]).toEqual(['intro-copy-2','intro-copy-3']);
    expect(draft.document.nodes.map(node => node.id)).toEqual(['intro','intro-copy-1','intro-copy-2','intro-copy-3','end']);
    expect(first).toMatchObject({content:{text:'original'}});
    expect(state.selectedNodeId).toBe(second.id); expect(state.insertionBeforeNodeId).toBe('end');
    expect(pasteStoryNode(state,copyStoryNode(draft,first.id)!,null)?.id).toBe('intro-copy-4');
    editProperty(draft,first.id,['content','text'],'independent');
    expect(second).toMatchObject({content:{text:'original'}}); expect(clipboard.node).toMatchObject({content:{text:'original'}});
    const copiedCopy = copyStoryNode(draft,'intro-copy-1')!;
    newStory(state);
    expect(pasteStoryNode(state,copiedCopy,null)?.id).toBe('intro-copy-2');
  });

  it('keeps IDs within 64 characters, skips cached identities and rejects stale or blocked targets', () => {
    const state = createStoryEditorState(), draft = newStory(state), id = 'a'.repeat(64);
    draft.document.nodes = [{id,type:'transfer',transfer:{mode:'insert',storyId:'local:story:other'}}];
    const clipboard = copyStoryNode(draft,id)!;
    draft.localFlagInputs = {[`${id.slice(0,57)}-copy-1`]:{type:'number',text:'bad'}};
    const pasted = pasteStoryNode(state,clipboard,null)!;
    expect(pasted.id).toBe(`${id.slice(0,57)}-copy-2`); expect(pasted.id).toHaveLength(64);
    const before = JSON.stringify(draft); state.storageBlocked = true;
    expect(pasteStoryNode(state,clipboard,null)).toBeUndefined(); state.storageBlocked = false;
    expect(pasteStoryNode(state,clipboard,'gone')).toBeUndefined();
    expect(JSON.stringify(draft)).toBe(before); expect(copyStoryNode(draft,'gone')).toBeUndefined();
  });

  it('copies parked branches and incomplete row input independently, including after draft reload', () => {
    localStorage.clear();
    const state = createStoryEditorState(), draft = newStory(state);
    draft.document.startContext = {type:'area',areaId:'base:area:schale_main'};
    draft.document.nodes = [{id:'effect',type:'operation',requiresFlag:'same-flag',action:{kind:'state',effects:[{op:'addItem',itemId:'base:item:manual',amount:1}]}}];
    const path = ['action','effects',0,'amount'] as const;
    const parked = ['action','effects',0,'itemId'] as const;
    const oldRow = rowIdAt(draft,'effect',['action','effects'],0);
    editStructuredValue(draft,'effect',path,'number','1e');
    toggleOptional(draft,'effect',parked,false);
    const clipboard = copyStoryNode(draft,'effect')!;
    const pasted = pasteStoryNode(state,clipboard,null)!;
    const newRow = rowIdAt(draft,pasted.id,['action','effects'],0);
    expect(newRow).not.toBe(oldRow);
    expect(draft.structuredInputs![structuredKey(draft,pasted.id,path)]).toMatchObject({text:'1e',error:expect.any(String)});
    toggleOptional(draft,pasted.id,parked,true);
    expect(readProperty(draft,pasted.id,parked)).toBe('base:item:manual');
    expect(readProperty(draft,'effect',parked)).toBeUndefined();
    editStructuredValue(draft,pasted.id,path,'number','3');
    expect(draft.structuredInputs![structuredKey(draft,'effect',path)]).toMatchObject({text:'1e'});
    const saved = new StoryDraftPersistence().save(state); expect(saved,state.error ?? '').toBe(true);
    const restored = createStoryEditorState(); new StoryDraftPersistence().load(restored);
    expect(restored.storageBlocked).toBe(false);
    expect(currentDraft(restored)?.document.nodes[1]).toMatchObject({id:'effect-copy-1',requiresFlag:'same-flag',action:{effects:[{itemId:'base:item:manual',amount:3}]}});
    localStorage.clear();
  });

  it('copies unfinished local flag values without sharing their input buffer', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    draft.document.nodes = [{id:'flag',type:'operation',action:{kind:'localFlag',op:'set',name:'shared',value:1}}];
    state.selectedNodeId = 'flag'; editNodeFlag(state,'local-flag-value','1e');
    const pasted = pasteStoryNode(state,copyStoryNode(draft,'flag')!,null)!;
    expect(draft.localFlagInputs?.[pasted.id]).toMatchObject({text:'1e'});
    editNodeFlag(state,'local-flag-value','2');
    expect(draft.localFlagInputs?.flag.text).toBe('1e');
    expect(pasted).toMatchObject({action:{name:'shared'}});
  });

  it('preserves authored option IDs, runtime references and parked node types across Stories', () => {
    const state = createStoryEditorState(), source = newStory(state);
    source.document = {...source.document,stages:{one:{advance:'input'}}};
    source.document.nodes = [{id:'choice',type:'click',stageId:'one',requiresFlag:'flag',interaction:{kind:'choice',options:[{id:'yes',text:'正文',marks:['flag']}]}}];
    selectNodeType(source,'choice','transfer'); editProperty(source,'choice',['transfer'],{mode:'goto',storyId:'local:story:destination'});
    const clipboard = copyStoryNode(source,'choice')!, target = newStory(state);
    const pasted = pasteStoryNode(state,clipboard,null)!;
    expect(pasted).toMatchObject({id:'choice-copy-1',requiresFlag:'flag',transfer:{mode:'goto',storyId:'local:story:destination'}});
    selectNodeType(target,pasted.id,'click');
    expect(target.document.nodes[0]).toMatchObject({id:'choice-copy-1',stageId:'one',interaction:{options:[{id:'yes',marks:['flag']}]}});
    expect(source.document.nodes[0].type).toBe('transfer');
  });
});

describe('Story node context menu', () => {
  let game: GameInstance, ctrl: UIController, root: HTMLElement, draft: StoryDraft;
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const element = document.querySelector<T>(selector); expect(element,selector).not.toBeNull(); return element!;
  };
  const refresh = () => { ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates(); };
  const context = (element: HTMLElement) => {
    const event = new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:120,clientY:160});
    element.dispatchEvent(event); ctrl.flushUIUpdates(); return event;
  };
  const action = () => { find<HTMLButtonElement>('.story-editor-node-menu button').click(); ctrl.flushUIUpdates(); };
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>'; root = find('#app');
    game = new GameInstance(); game.init([structuredClone(baseDatapack)]); ctrl = new UIController(game,root);
    ctrl.render(); ctrl.storyEditor.open(); createStoryForTest(game,ctrl); ctrl.flushUIUpdates();
    draft = currentDraft(ctrl.storyEditor.state)!;
    draft.document = {...draft.document,startContext:{type:'area',areaId:[...game.registry.areas.keys()][0]},stages:{one:{advance:'auto'}},nodes:[
      {id:'intro',type:'talklet',stageId:'one',content:{kind:'talk',text:'original'}}, {id:'end',type:'operation'},
    ]}; refresh();
  });
  afterEach(() => { ctrl.destroy(); game.stop(); vi.restoreAllMocks(); localStorage.clear(); });

  it('copies on a node and repeatedly pastes at a stable gap while preserving nodes and scroll', () => {
    const intro = find('[data-editor-node="intro"]'), gap = find('[data-story-insertion-before="end"]');
    const body = find('.story-editor-center .workspace-column__body'); body.scrollTop = 91;
    const full = vi.spyOn(ctrl,'render'), running = game.storyService.getCurrentStoryId(); draft.dirty = false;
    context(intro); expect(find('.story-editor-node-menu').textContent).toBe('复制'); action(); expect(draft.dirty).toBe(false);
    editProperty(draft,'intro',['content','text'],'changed'); refresh();
    context(gap); expect(find('.story-editor-node-menu').textContent).toBe('粘贴'); action();
    context(gap); action();
    expect(draft.document.nodes.map(node => node.id)).toEqual(['intro','intro-copy-1','intro-copy-2','end']);
    expect(draft.document.nodes[1]).toMatchObject({content:{text:'original'}});
    expect(ctrl.storyEditor.state.selectedNodeId).toBe('intro-copy-2');
    expect(find('[data-editor-node="intro"]') === intro).toBe(true); expect(find('[data-story-insertion-before="end"]') === gap).toBe(true);
    expect(body.scrollTop).toBe(91); expect(full).not.toHaveBeenCalled(); expect(game.storyService.getCurrentStoryId()).toBe(running);
  });

  it('supports cross-Story and empty-Story end gaps, disables unavailable pastes and rejects stale menus', () => {
    context(find('[data-story-insertion-end]')); expect(find<HTMLButtonElement>('.story-editor-node-menu button').disabled).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    context(find('[data-editor-node="intro"]')); action();
    const next = newStory(ctrl.storyEditor.state); refresh();
    context(find('[data-story-insertion-end]')); action();
    expect(next.document.nodes).toMatchObject([{id:'intro-copy-1',content:{text:'original'},stageId:'one'}]);
    ctrl.storyEditor.state.storageBlocked = true; refresh(); context(find('[data-story-insertion-end]'));
    expect(find<HTMLButtonElement>('.story-editor-node-menu button').disabled).toBe(true);
    ctrl.storyEditor.state.storageBlocked = false;
    const gap = find('[data-story-insertion-before="intro-copy-1"]'); context(gap);
    next.document.nodes = []; refresh(); expect(document.querySelector('.story-editor-node-menu')).toBeNull();
    expect(next.document.nodes).toEqual([]);
  });

  it('dismisses on outside interaction, scrolling or leaving and preserves native text editing menus', () => {
    context(find('[data-editor-node="intro"]'));
    document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})); expect(document.querySelector('.story-editor-node-menu')).toBeNull();
    context(find('[data-editor-node="intro"]'));
    find('.story-editor-center .workspace-column__body').dispatchEvent(new Event('scroll')); expect(document.querySelector('.story-editor-node-menu')).toBeNull();
    const text = find('[data-editor-node="intro"] .chat-bubble > p'); text.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); ctrl.flushUIUpdates();
    expect(context(text).defaultPrevented).toBe(false); expect(document.querySelector('.story-editor-node-menu')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    context(find('[data-editor-node="end"]')); expect(ctrl.storyEditor.beforeLeave()).toBe(true);
    expect(document.querySelector('.story-editor-node-menu')).toBeNull();
  });
});
