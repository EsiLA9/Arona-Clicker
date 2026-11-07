import { describe,it,expect,vi } from 'vitest';
import { StoryAvailabilityDeliveryMount } from '../../src/arona-clicker/services/story/story-availability-delivery-mount';
import { EventBus } from '../../src/engine/core/event-bus';
import type { Registry } from '../../src/data-services/registry/registry';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import type { ConditionSystem } from '../../src/engine/expression/condition-system';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishStory } from './story-test-fixtures';

describe('explicit active fallback delivery',()=>{
  it('records random-entry cooldown on completion even without a conversation block',()=>{
    const pack=structuredClone(baseDatapack),entry=pack.passiveStories.find(row=>row.activation.kind==='random'&&!row.owner)!;
    entry.activation.cooldownFrames=123;delete entry.block;
    const game=new GameInstance();
    try{
      game.init([pack]);game.storyService.clearCurrentStory(null);
      expect(game.story.startStory(entry.id,'passive',null,{force:true,skipConditions:true}).success).toBe(true);
      finishStory(game);
      expect(game.state.passiveCooldowns?.[entry.id]).toBe(game.state.totalFrames);
    }finally{game.stop();game.storyService.dispose();}
  });
  it('offers an authored fixed-area entry through the real runtime without starting or travelling',()=>{
    const pack=structuredClone(baseDatapack),init=pack.inits[0];
    const area=pack.areas.find(area=>area.initId===init.id&&area.id!==init.defaultAreas[0])!;
    expect(area).toBeDefined();
    const id='base:activestory:fixed_fallback',storyId='base:story:fixed_fallback';
    pack.activeStories.push({id,storyId,availableInits:[init.id],triggerCondition:{type:'AND',conditions:[]},activation:{kind:'active',fallback:{kind:'fixed-area',areaId:area.id}}});
    pack.stories.push({id:storyId,name:'固定地区测试',startContext:{type:'area',areaId:area.id},stages:{one:{advance:'auto'}},nodes:[{id:'line',type:'talklet',stageId:'one',content:{kind:'narration',text:'正文'}}]});
    const game=new GameInstance();
    try{
      game.init([pack]);
      expect(game.state.areaStoryDeliveries?.find(delivery=>delivery.entryId===id)?.areaId).toBe(area.id);
      expect(game.state.currentAreaId).not.toBe(area.id);
      expect(game.story.getCurrentStoryId()).not.toBe(id);
    }finally{game.stop();game.storyService.dispose();}
  });
  it('uses the configured area, excludes other Init and entries without fallback, and retries rejected delivery',()=>{
    const state={activeInit:'init-a',currentAreaId:'here',storyLog:[],areaStoryDeliveries:[]} as unknown as PlayerState;
    const entry=(id:string,fallback?:unknown)=>({id,storyId:id,availableInits:[],triggerCondition:{},activation:{kind:'active',fallback}});
    const entries=[entry('none'),entry('current',{kind:'current-area'}),entry('fixed',{kind:'fixed-area',areaId:'there'}),entry('other',{kind:'fixed-area',areaId:'other'})];
    const registry={activeStories:new Map(entries.map(e=>[e.id,e])),stories:new Map(entries.map(e=>[e.id,{nodes:[{}]}])),areas:new Map([['here',{initId:'init-a'}],['there',{initId:'init-a'}],['other',{initId:'init-b'}]])} as unknown as Registry;
    const create=vi.fn().mockReturnValue(false),conditions={evaluateGroup:()=>true} as unknown as ConditionSystem;
    const mount=new StoryAvailabilityDeliveryMount(registry,conditions,new EventBus(),()=>state,create);
    mount.mountForInit('init-a');mount.reconcileCurrentArea();
    expect(create.mock.calls.map(call=>call.slice(0,2))).toEqual([['current','here'],['fixed','there']]);
    mount.reconcileCurrentArea();expect(create).toHaveBeenCalledTimes(4);
    state.areaStoryDeliveries=[{entryId:'fixed'}] as PlayerState['areaStoryDeliveries'];
    state.storyLog=[{storyId:'current',type:'active',choiceIndex:-1}];mount.reconcileCurrentArea();expect(create).toHaveBeenCalledTimes(4);
    mount.unmountAll();mount.reconcileCurrentArea();expect(create).toHaveBeenCalledTimes(4);
  });
});
