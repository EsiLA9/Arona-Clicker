import { describe, it, expect } from 'vitest';
import { validateStoryEntryActivation as validate } from '../../../src/data-services/validation/story-entry';
import { storyIdentityReferences } from '../../../src/data-services/authoring/story-identity';
import { withAuthoredStoryCatalog } from '../../../src/ui/columns/authored-story-catalog';
import { Registry } from '../../../src/data-services/registry/registry';
import { baseDatapack } from '../../../src/data/test-datapack';
import type { StoryEntryDef } from '../../../src/data-services/contracts/story-entry';

const common={id:'test:activestory:one',storyId:'test:story:one',availableInits:[],triggerCondition:{type:'AND' as const,conditions:[]}};
describe('StoryEntry explicit activation',()=>{
  it('rejects changing a member of an already-loaded random pool to active before any write',()=>{
    const registry=new Registry();registry.load(structuredClone(baseDatapack));
    const source=[...registry.passiveStories.values()].find(row=>row.activation.kind==='random'&&[...registry.passivePools.values()].some(pool=>pool.children.some(child=>child.id===row.id)))!;
    expect(source).toBeDefined();
    expect(()=>registry.load({name:'change',version:'1',modName:'base',inits:[],areas:[],spots:[],enhancements:[],stories:[],activeStories:[{id:source.id,storyId:source.storyId,availableInits:[],triggerCondition:{type:'AND',conditions:[]},activation:{kind:'active'}}],passiveStories:[],items:[],characters:[],funcletDefs:[]})).toThrow('闲聊池');
    expect(registry.passiveStories.get(source.id)).toBe(source);expect(source.activation.kind).toBe('random');
  });
  it.each([
    ['active',{kind:'active'}],['active',{kind:'active',fallback:{kind:'current-area'}}],['active',{kind:'active',fallback:{kind:'fixed-area',areaId:'test:area:one'}}],
    ['passive',{kind:'random',weight:1,repeatable:true}],['passive',{kind:'affection',when:{kind:'level',level:2}}],['passive',{kind:'affection',when:{kind:'after-story',storyId:'test:story:before'}}],
  ] as const)('accepts %s configuration %j',(partition,activation)=>expect(()=>validate({...common,owner:'Hoshino',activation},partition)).not.toThrow());
  it.each([
    {activation:{kind:'active'},weight:2}, {type:'active'}, {activation:{kind:'random',weight:1,repeatable:true,affectionRequired:1}},
    {activation:{kind:'random',weight:-1,repeatable:true}}, {activation:{kind:'random',weight:1,repeatable:true,cooldownFrames:-1}},
    {activation:{kind:'affection',when:{kind:'level',level:2}}},
    {owner:'Hoshino',activation:{kind:'affection',when:{kind:'level',level:2,storyId:'test:story:before'}}},
    {activation:{kind:'active',fallback:{kind:'fixed-area'}}},
  ])('rejects malformed / mixed configuration %j',row=>expect(()=>validate({...common,...row},(row.activation?.kind ?? 'active')==='active'?'active':'passive')).toThrow());
  it('rejects partition mismatch and preserves unfinished draft values without accepting the legacy format',()=>{
    expect(()=>validate({...common,activation:{kind:'active'}},'passive')).toThrow();
    expect(()=>validate({...common,activation:{kind:'affection',when:{kind:'level',level:-1}},catalog:{category:'',part:''}},'passive',true)).not.toThrow();
    expect(()=>validate({...common,type:'passive',weight:1,repeatable:false},'passive',true)).toThrow();
  });
  it('declares both new reference paths for identity and deletion checks',()=>{
    const row={...common,activation:{kind:'affection',when:{kind:'after-story',storyId:common.storyId}}};
    expect(storyIdentityReferences(row,'activeStories',common.id,common.storyId).map(ref=>ref.path)).toEqual(['$.storyId','$.activation.when.storyId']);
  });
  it('projects catalog placement for every activation kind without altering eligibility or source data',()=>{
    const rows=['active','random','affection'].map((kind,index):StoryEntryDef=>{
      const row={...common,id:`test:activestory:${kind}`,owner:'Hoshino',catalog:{category:'main',part:'one',order:3-index}};
      return kind==='active'?{...row,activation:{kind:'active'}}:kind==='random'?{...row,activation:{kind:'random',weight:1,repeatable:false}}:{...row,activation:{kind:'affection',when:{kind:'level',level:1}}};
    });
    const before=structuredClone(rows),base={categories:[]};
    const projected=withAuthoredStoryCatalog(base,rows);
    expect(projected.categories[0].parts[0].items!.map(item=>item.entryId)).toEqual([...rows].reverse().map(row=>row.id));
    expect(rows).toEqual(before);expect(base.categories).toEqual([]);
  });
});
