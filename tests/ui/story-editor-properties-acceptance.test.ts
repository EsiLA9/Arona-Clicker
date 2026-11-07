import {copyStoryIdentity} from '../../src/ui/story-editor/authoring-model';
import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { createStoryEditorState, currentDraft, selectStory, storyDefinitionFromDraft } from '../../src/ui/story-editor/model';
import { editProperty, editStoryNodeBody, moveRow, readProperty, readStoryNodeBody, removeProperty, removeRow, rowIdAt, selectBranch, selectDiscriminant, selectNodeType, toggleOptional } from '../../src/ui/story-editor/property-model';
import { StoryDraftPersistence } from '../../src/ui/story-editor/persistence';
import type { StorageAdapter } from '../../src/data-services/persistence/storage-adapter';

function open(story: StoryDef) {
  const state = createStoryEditorState();
  selectStory(state, `source:${story.id}`, new Map([[story.id, story]]));
  return { state, draft: currentDraft(state)! };
}
const operation: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:properties_acceptance', name: '验收', stages: {}, nodes: [{ id: 'node', type: 'operation', requiresFlag: 'initial', action: { kind: 'state', effects: [{ op: 'addItem', itemId: 'test:item:one', amount: 1 }] } }] };
class MemoryStorage implements StorageAdapter {
  data = new Map<string, string>();
  get(key: string) { return this.data.get(key) ?? null; }
  set(key: string, value: string) { this.data.set(key, value); }
  remove(key: string) { this.data.delete(key); }
}

describe('0336 independent draft acceptance', () => {
  it('keeps one Story body across Talklet and Click subtype switches without overwriting existing Choice options', () => {
    const story: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:shared-body', name: '正文', stages: { talk: { advance: 'auto' } }, nodes: [
      { id: 'node', type: 'talklet', stageId: 'talk', content: { kind: 'talk', text: '共享正文', speaker: '老师' } },
    ] };
    const { state, draft } = open(story);
    expect(readStoryNodeBody(draft, 'node')).toBe('共享正文');
    selectNodeType(draft, 'node', 'click');
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'button');
    expect(readProperty(draft, 'node', ['interaction', 'text'])).toBe('共享正文');
    editStoryNodeBody(draft, 'node', '更新正文');
    selectNodeType(draft, 'node', 'talklet');
    expect(readProperty(draft, 'node', ['content', 'text'])).toBe('更新正文');
    selectDiscriminant(draft, 'node', ['content'], 'kind', 'narration');
    expect(readProperty(draft, 'node', ['content', 'text'])).toBe('更新正文');
    selectNodeType(draft, 'node', 'click');
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'choice');
    expect(readProperty(draft, 'node', ['interaction', 'options'])).toEqual([{ id: 'option1', text: '更新正文' }]);
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'button');
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'choice');
    expect(readProperty(draft, 'node', ['interaction', 'options'])).toEqual([{ id: 'option1', text: '更新正文' }]);
    const storage = new MemoryStorage(); expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState(); new StoryDraftPersistence(storage).load(restored);
    expect(readStoryNodeBody(currentDraft(restored)!, 'node')).toBe('更新正文');
    expect(storyDefinitionFromDraft(draft)).toMatchObject({ ok: true, story: { nodes: [{ interaction: { kind: 'choice', options: [{ text: '更新正文' }] } }] } });
    const projected = storyDefinitionFromDraft(draft);
    expect(projected.ok).toBe(true);
    if (projected.ok) expect(projected.story).not.toHaveProperty('editorState');
  });

  it('keeps the shared body separate from a nonempty Choice option group and maps it to entry-card button copy', () => {
    const story: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:body-card', name: '入口文案', stages: { input: { advance: 'input' } }, nodes: [
      { id: 'node', type: 'click', stageId: 'input', interaction: { kind: 'choice', options: [{ id: 'first', text: '既有选项' }] } },
    ] };
    const { draft } = open(story);
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'button');
    editStoryNodeBody(draft, 'node', '通用正文');
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'choice');
    expect(readProperty(draft, 'node', ['interaction', 'options', 0, 'text'])).toBe('既有选项');
    expect(readStoryNodeBody(draft, 'node')).toBe('通用正文');
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'entryCard');
    expect(readProperty(draft, 'node', ['interaction', 'card', 'buttonText'])).toBe('通用正文');
    editStoryNodeBody(draft, 'node', '');
    expect(readProperty(draft, 'node', ['interaction', 'card', 'buttonText'])).toBeUndefined();
    const storage = new MemoryStorage(); const state = createStoryEditorState();
    state.drafts.push(draft); state.target = { kind: 'story', id: draft.document.id };
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState(); new StoryDraftPersistence(storage).load(restored);
    expect(readStoryNodeBody(currentDraft(restored)!, 'node')).toBe('');
  });

  it('uses the shared body for continuation-card labels and clears it back to runtime defaults', () => {
    const story: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:body-continuation', name: '续播文案', stages: { input: { advance: 'input' } }, nodes: [
      { id: 'node', type: 'click', stageId: 'input', interaction: { kind: 'button', text: '进入羁绊' } },
    ] };
    const { draft } = open(story);
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'entryCard');
    expect(readProperty(draft, 'node', ['interaction', 'card', 'buttonText'])).toBe('进入羁绊');
    editStoryNodeBody(draft, 'node', '');
    expect(readProperty(draft, 'node', ['interaction', 'card', 'buttonText'])).toBeUndefined();
    selectDiscriminant(draft, 'node', ['interaction'], 'kind', 'areaContinue');
    editProperty(draft, 'node', ['interaction', 'areaId'], 'base:area:schale_main');
    expect(readProperty(draft, 'node', ['interaction', 'buttonText'])).toBeUndefined();
    expect(storyDefinitionFromDraft(draft).ok).toBe(true);
  });

  it('keeps common requiresFlag edits across top-level type cache restores, including clearing it', () => {
    const { draft } = open(operation);
    selectNodeType(draft, 'node', 'transfer');
    editProperty(draft, 'node', ['requiresFlag'], 'latest');
    selectNodeType(draft, 'node', 'operation');
    expect(readProperty(draft, 'node', ['requiresFlag'])).toBe('latest');
    selectNodeType(draft, 'node', 'transfer');
    toggleOptional(draft, 'node', ['requiresFlag'], false);
    selectNodeType(draft, 'node', 'operation');
    expect(readProperty(draft, 'node', ['requiresFlag'])).toBeUndefined();
  });

  it('restores each branch raw input without displaying a different branch value at the same path', () => {
    const { state, draft } = open(operation);
    const row = ['action', 'effects', 0] as const;
    editProperty(draft, 'node', [...row, 'amount'], '12');
    selectDiscriminant(draft, 'node', row, 'op', 'addResource');
    expect(readProperty(draft, 'node', [...row, 'amount'])).toBeUndefined();
    editProperty(draft, 'node', [...row, 'resourceId'], 'test:resource:one');
    editProperty(draft, 'node', [...row, 'amount'], '37');
    selectDiscriminant(draft, 'node', row, 'op', 'addItem');
    expect(readProperty(draft, 'node', [...row, 'amount'])).toBe('12');
    const storage = new MemoryStorage();
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState();
    new StoryDraftPersistence(storage).load(restored);
    const next = currentDraft(restored)!;
    expect(storyDefinitionFromDraft(next)).toMatchObject({ ok: true, story: { nodes: [{ action: { effects: [{ op: 'addItem', amount: 12 }] } }] } });
    selectDiscriminant(next, 'node', row, 'op', 'addResource');
    expect(readProperty(next, 'node', [...row, 'amount'])).toBe('37');
  });

  it('garbage-collects deleted-row branch values rather than retaining ghost author input', () => {
    const { draft } = open(operation);
    const rows = ['action', 'effects'] as const;
    const id = rowIdAt(draft, 'node', rows, 0)!;
    editProperty(draft, 'node', [...rows, 0, 'itemId'], 'do-not-resurrect');
    selectDiscriminant(draft, 'node', [...rows, 0], 'op', 'addResource');
    expect(JSON.stringify(draft.editorState)).toContain('do-not-resurrect');
    expect(removeRow(draft, 'node', rows, id)).toBe(true);
    expect(JSON.stringify(draft.editorState)).not.toContain('do-not-resurrect');
  });

  it('tracks enabled-but-empty optional fields through row moves and suspends them with their branch', () => {
    const story: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:rows', name: 'Rows', stages: {}, nodes: [{ id: 'node', type: 'operation', action: {kind:'state',effects:[
      {op:'addResource',resourceId:'test:resource:one',amount:1}, {op:'addResource',resourceId:'test:resource:two',amount:2},
    ]} }] };
    const { draft } = open(story);
    const rows = ['action', 'effects'] as const;
    const first = rowIdAt(draft, 'node', rows, 0)!;
    removeProperty(draft, 'node', [...rows, 0, 'amount']);
    toggleOptional(draft, 'node', [...rows, 0, 'amount'], true);
    moveRow(draft, 'node', rows, first, 1);
    const incomplete = storyDefinitionFromDraft(draft);
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) expect(incomplete.issues.some(issue => issue.path === 'nodes[0].action.effects[1].amount')).toBe(true);
    selectDiscriminant(draft, 'node', [...rows, 1], 'op', 'setFlag');
    editProperty(draft, 'node', [...rows, 1, 'flagId'], 'ready');
    editProperty(draft, 'node', [...rows, 1, 'value'], true);
    expect(storyDefinitionFromDraft(draft).ok).toBe(true);
  });
  it('rebinds copied display clears to the new Story while leaving the source and external references intact',()=>{
    const {state,draft}=open({...operation,nodes:[
      {id:'body',type:'talklet',stageId:'body',content:{kind:'narration',text:'body'},performance:{template:'title',style:{fontSize:'2rem'}}},
      {id:'clear',type:'operation',action:{kind:'clearNode',storyId:operation.id,nodeId:'body'}},
    ],stages:{body:{advance:'auto'}}});
    selectDiscriminant(draft,'clear',['action'],'kind','localFlag');
    expect(copyStoryIdentity(state,draft,'test:story:copy',new Set())).toBe(true);
    const copy=currentDraft(state)!;
    selectDiscriminant(copy,'clear',['action'],'kind','clearNode');
    expect(readProperty(copy,'clear',['action'])).toEqual({kind:'clearNode',storyId:'test:story:copy',nodeId:'body'});
    expect(readProperty(copy,'body',['performance'])).toEqual({template:'title',style:{fontSize:'2rem'}});
    selectDiscriminant(draft,'clear',['action'],'kind','clearNode');
    expect(readProperty(draft,'clear',['action','storyId'])).toBe(operation.id);
  });

});
