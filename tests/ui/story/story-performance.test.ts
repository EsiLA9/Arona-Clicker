// @vitest-environment happy-dom
import {describe,expect,it} from 'vitest';
import type {UIContext} from '../../../src/ui/runtime/context';
import {renderChatEntry,renderChatHistory,renderPositionedStoryHistory,renderCurrentStory,type ChatEntry} from '../../../src/ui/components/story/story';
import {renderChatContent} from '../../../src/ui/columns/chat-content';
import type {StoryView} from '../../../src/arona-clicker/contracts/runtime/results';

describe('Story node performance rendering',()=>{
  const ctx={escapeHtml:(value:string)=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),game:{registry:{activeStories:new Map()}},view:{storyLog:[]}} as unknown as UIContext;
  const mount=(html:string)=>{const root=document.createElement('div');root.innerHTML=html;return root;};
  const layout={mode:'positioned' as const,x:.25,y:.8,align:'right' as const};
  const input=(page:StoryView['page']):StoryView=>({storyId:'test:activestory:one',storyDefId:'test:story:one',pageIndex:0,totalPages:1,page,availableChoiceIndexes:[0],nodeId:'click',token:'ticket',phase:'input',runId:'run',performance:{layout,style:{fontSize:'24px',color:'#123456'}}, type: 'active' });
  it('styles standard narration and template text while keeping flow identity and escaping body text',()=>{
    const root=mount(renderChatEntry(ctx,{kind:'narration',text:'<img onerror=bad>',performance:{style:{fontSize:'24px',color:'#123456',background:false}}},{instanceKey:'line'}));
    expect(root.querySelector<HTMLElement>('.chat-narration-text')?.style.fontSize).toBe('24px');
    expect(root.querySelector('img')).toBeNull();
    const invalid=mount(renderChatEntry(ctx,{kind:'narration',text:'draft',performance:{style:{color:'red;background:url(https://bad)'}}}));
    expect(invalid.querySelector<HTMLElement>('.chat-narration-text')?.getAttribute('style')).toBeNull();
    const title=mount(renderChatEntry(ctx,{kind:'narration',text:'title',performance:{template:'title'}},{instanceKey:'stable'}));
    expect(title.querySelector('[data-flow-entry-key="stable"]')).not.toBeNull();
    const aligned=mount(renderChatEntry(ctx,{kind:'narration',text:'note',align:'right',performance:{template:'note',style:{background:true}}}));
    expect(aligned.querySelector<HTMLElement>('.chat-text-note')?.style.textAlign).toBe('right');
    expect(aligned.querySelector<HTMLElement>('.chat-text-note')?.style.background).toBe('var(--panel-light)');
  });
  it('renders positioned output once outside the scrolling history and leaves completed choices disabled',()=>{
    const entry:ChatEntry={id:1,kind:'narration',text:'positioned',timestamp:0,storyOutputId:'output',performance:{layout,style:{color:'#123456'}},choice:{options:[{id:'yes',text:'yes'}],selectedOptionId:'yes'}};
    expect(renderChatHistory([entry],ctx)).toBe('');
    const root=mount(renderPositionedStoryHistory([entry],ctx));
    expect(root.querySelector<HTMLElement>('.story-node-positioned')?.style.getPropertyValue('--story-overlay-x')).toBe('25%');
    expect(root.querySelector<HTMLButtonElement>('.choice-option')?.disabled).toBe(true);
    expect(root.querySelector('[data-story-token]')).toBeNull();
    expect(root.querySelector<HTMLElement>('.choice-option')?.style.color).toBe('#123456');
  });
  it('keeps exactly one active positioned button with its current input ticket and press progress',()=>{
    const story={...input({kind:'click',text:'Press'}),press:{total:3,done:1}};
    const context={...ctx,view:{...ctx.view,currentStory:story}};
    const root=mount(renderChatContent(context,[],[],{mode:'advance',storyId:story.storyId,pageIndex:0,text:'Press',token:story.token},null,null,null));
    expect(root.querySelectorAll('[data-send]')).toHaveLength(1);
    expect(root.querySelector('[data-send]')?.closest('.story-node-positioned')).not.toBeNull();
    expect(root.querySelector('.chat-stream [data-send]')).toBeNull();
    expect(root.querySelector('[data-send]')?.getAttribute('data-story-token')).toBe('ticket');
    expect(root.textContent).toContain('1/3');
  });
  it('preserves Choice filtering and card routing tokens in positioned inputs',()=>{
    const choice=mount(renderCurrentStory(ctx,input({kind:'click',text:'',choices:[{id:'yes',text:'yes'},{id:'hidden',text:'hidden'}]})));
    expect(choice.querySelectorAll('[data-story-choice-id]')).toHaveLength(1);
    expect(choice.querySelector('[data-story-choice-id]')?.getAttribute('data-story-token')).toBe('ticket');
    const card=mount(renderCurrentStory(ctx,input({kind:'click',text:'',kizuna:{storyId:'test:activestory:target',title:'Target'}})));
    expect(card.querySelector('[data-story-card-token]')?.getAttribute('data-story-card-token')).toBe('ticket');
    expect(card.querySelector('[data-kizuna]')).toBeNull();
    expect(card.querySelector('.kizuna-card')?.closest('.story-node-positioned')).not.toBeNull();
  });
});
