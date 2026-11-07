import { describe,expect,it } from 'vitest';
import { projectStoryDefinition } from '../../src/data-services/authoring/story-definition-projection';
import { storyPerformanceIssues } from '../../src/data-services/validation/story-performance';
import {collectDefinitionReferences} from '../../src/data-services/registry/runtime-content-reference-rules';

describe('Story node performance author boundary',()=>{
  const story=(performance:unknown)=>({id:'test:story:performance',name:'Performance',startContext:{type:'area',areaId:'base:area:schale_main'},stages:{body:{advance:'auto'}},nodes:[{id:'body',type:'talklet',stageId:'body',content:{kind:'narration',text:'only body'},performance}]});
  it('projects numeric drafts and styles without duplicating text or copying editor fields',()=>{
    const result=projectStoryDefinition(story({template:'title',layout:{mode:'positioned',x:0,y:1,align:'right'},style:{font:'serif',fontSize:'2rem',color:'#abcdef',background:false}}));
    expect(result).toMatchObject({ok:true,story:{nodes:[{content:{text:'only body'},performance:{layout:{x:0,y:1},style:{background:false}}}]}});
  });
  it.each([
    {layout:{mode:'positioned',x:'-',y:.5}}, {layout:{mode:'positioned',x:2,y:0}},
    {layout:{mode:'positioned',unit:'px',x:-1,y:0}}, {layout:{mode:'positioned',unit:'em',x:.2,y:0}},
    {layout:{mode:'positioned',x:0,y:0,anchor:{x:'right',y:'middle'}}},
    {layout:{mode:'positioned',x:-1.1,y:0,anchor:{x:'right',y:'top'}}},
    {layout:{mode:'positioned',x:0,y:0,anchor:{x:'right',y:'top'},align:'left'}},
    {layout:{mode:'flow',x:.2}}, {style:{color:'red;background:url(bad)'}},
    {style:{fontSize:'calc(1px + 2vw)'}}, {style:{color:'" onmouseover="bad'}},
    {style:{background:'false'}}, {style:{color:'#abcde'}}, {style:{font:'unknown'}}, {html:'<b>bad</b>'},
  ])('rejects invalid performance without inventing defaults (%j)',performance=>{
    expect(projectStoryDefinition(story(performance)).ok).toBe(false);
  });
  it.each([
    {mode:'positioned',unit:'px',x:135.5,y:40,align:'right'},
    {mode:'positioned',unit:'px',x:-24,y:-16,anchor:{x:'right',y:'top'}},
    {mode:'positioned',x:.125,y:-.25,anchor:{x:'center',y:'center'}},
  ])('preserves the authored positioning layout (%j)',layout=>{
    expect(projectStoryDefinition(story({layout}))).toMatchObject({ok:true,story:{nodes:[{performance:{layout}}]}});
  });
  it('keeps templates off Click and validates real node targets for explicit clearing',()=>{
    expect(storyPerformanceIssues({template:'title'},true)).not.toHaveLength(0);
    const source=story({});source.nodes.push({id:'clear',type:'operation',action:{kind:'clearNode',storyId:source.id,nodeId:'body'}} as never);
    expect(projectStoryDefinition(source).ok).toBe(true);
    (source.nodes[1] as unknown as {action:{nodeId:string}}).action.nodeId='missing';
    expect(projectStoryDefinition(source)).toMatchObject({ok:false,issues:[{path:'nodes[1].action.nodeId'}]});
  });
  it('checks qualified avatar resources and records clear targets as references',()=>{
    const source=story({});
    Object.assign(source.nodes[0],{presentation:{avatar:'test:avatar(pic):face'}});
    expect(projectStoryDefinition(source,{pics:new Map()}).ok).toBe(false);
    expect(projectStoryDefinition(source,{pics:new Map([['test:avatar(pic):face',{}]])}).ok).toBe(true);
    source.nodes.push({id:'clear',type:'operation',action:{kind:'clearNode',storyId:source.id,nodeId:'body'}} as never);
    const refs=collectDefinitionReferences({definitionKind:'stories',fullId:source.id},source,[]);
    expect(refs.find(ref=>ref.path==='$.nodes[0].presentation.avatar')).toMatchObject({targetKinds:['pics'],confidence:'declared'});
    expect(refs.find(ref=>ref.path==='$.nodes[1].action.storyId')).toMatchObject({targetKinds:['stories'],confidence:'declared'});
  });
});
