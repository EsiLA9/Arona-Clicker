// @vitest-environment happy-dom
import {describe,it,expect} from 'vitest';
import {createStoryEditorState,newStory} from '../../src/ui/story-editor/model';
import {emptyStoryAuthoring} from '../../src/data-services/authoring/story-authoring';
import {changeEntryActivation} from '../../src/ui/story-editor/entry-activation';

function fixture(){
  const draft=newStory(createStoryEditorState(),'local');draft.authoring=emptyStoryAuthoring();
  draft.authoring.passiveStories.push({id:'local:passivestory:one',storyId:draft.document.id,availableInits:[],triggerCondition:{type:'AND',conditions:[]},activation:{kind:'random',weight:3,repeatable:true},interruptible:false,block:{type:'AND',conditions:[]}});
  return draft;
}
describe('Entry activation draft commit',()=>{
  it('moves the same identity between partitions and removes only reviewed passive-only fields',()=>{
    const draft=fixture(),row=draft.authoring!.passiveStories[0];
    changeEntryActivation(draft,row.id,{kind:'active',fallback:{kind:'current-area'}});
    expect(draft.authoring!.passiveStories).toEqual([]);
    expect(draft.authoring!.activeStories[0]).toMatchObject({id:row.id,storyId:row.storyId,activation:{kind:'active'}});
    expect(draft.authoring!.activeStories[0]).not.toHaveProperty('block');
    expect(draft.authoring!.activeStories[0]).not.toHaveProperty('interruptible');
    expect(draft.authoring!.removed?.passiveStories).toContain(row.id);
  });
  it('preserves the existing row and public fields when switching to affection',()=>{
    const draft=fixture(),row=draft.authoring!.passiveStories[0];
    changeEntryActivation(draft,row.id,{kind:'affection',when:{kind:'level',level:2}},'Hoshino');
    expect(draft.authoring!.passiveStories[0]).toBe(row);
    expect(row).toMatchObject({owner:'Hoshino',interruptible:false,activation:{kind:'affection',when:{kind:'level',level:2}}});
    expect(row.activation).not.toHaveProperty('weight');
  });
  it('leaves the original unchanged on invalid owner, pool membership or pending invalid input',()=>{
    const draft=fixture(),id=draft.authoring!.passiveStories[0].id;
    const original=structuredClone(draft);
    expect(()=>changeEntryActivation(draft,id,{kind:'affection',when:{kind:'level',level:1}})).toThrow();
    expect(draft).toEqual(original);
    draft.authoring!.passivePools.push({id:'local:passivepool:one',children:[{id}]});
    expect(()=>changeEntryActivation(draft,id,{kind:'active'})).toThrow('抽取池');
    draft.authoring!.passivePools=[];draft.structuredInputs={invalid:{text:'-',error:'invalid'}};
    expect(()=>changeEntryActivation(draft,id,{kind:'active'})).toThrow('尚未提交');
    expect(draft.authoring!.passiveStories[0].activation.kind).toBe('random');
  });
});
