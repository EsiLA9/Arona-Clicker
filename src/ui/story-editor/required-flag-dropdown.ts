import type { UIContext } from '../runtime/context';
import type { StoryEditorState } from './model';
import { buildStoryRelations, storyTransferContext, type StoryRelations } from './relations-model';
import { buildStoryFlagCatalog } from './flag-catalog';
import { renderLocalFlagNaviButton } from './local-flag-navi';

/** Transfers share an Entry's flags; crossing into another Entry does not inherit its private names. */
export function requiredFlagOptions(state: StoryEditorState, relations: StoryRelations): string[] {
  if (state.target?.kind !== 'story') return [];
  const { storyIds, entries } = storyTransferContext(relations, state.target.id);
  const names = new Set<string>();
  const collect = (target: {kind:'story'|'entry';id:string}) => {
    for (const use of buildStoryFlagCatalog(state,relations,target).uses) {
      if (use.kind==='local' && use.available && (use.usage==='write' || use.usage==='return')) names.add(use.name);
    }
  };
  for (const id of storyIds) collect({kind:'story',id});
  for (const entry of entries) collect({kind:'entry',id:entry.id});
  return [...names].sort((a,b)=>a.localeCompare(b));
}

export function renderRequiredFlagControl(ctx:UIContext,state:StoryEditorState,input:string):string {
  const names = requiredFlagOptions(state,buildStoryRelations(state,ctx.game.registry.stories,ctx.game.registry.storyEntries));
  const id = `required-flag-options-${state.selectedNodeId ?? 'node'}`;
  input = input.replace(/ list="[^"]*"/g,'').replace('<input ',`<input role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="${ctx.escapeHtml(id)}" `);
  return `<span class="story-editor-flag-control story-editor-required-flag" data-required-flag-control>${input}${renderLocalFlagNaviButton(state.storageBlocked)}<span class="story-editor-required-flag-options" data-required-flag-options data-editor-key="required-flag-options" id="${ctx.escapeHtml(id)}" role="listbox" aria-label="可用局部标记" hidden>${names.map(name=>`<button type="button" role="option" class="story-editor-required-flag-option" data-editor-key="required-flag:${ctx.escapeHtml(name)}" data-required-flag-option="${ctx.escapeHtml(name)}" aria-selected="false">${ctx.escapeHtml(name)}</button>`).join('') || '<span class="story-editor-empty">暂无可用局部标记</span>'}</span></span>`;
}

/** One delegated session, kept across editor patches; filtering changes row styles only. */
export class RequiredFlagDropdown {
  private active?: {input:HTMLInputElement;query:string;context:string};
  private committing = false;
  constructor(private root:HTMLElement,private context:()=>string,private candidates:()=>readonly string[]) {
    root.addEventListener('focusin',this.focus);
    root.addEventListener('input',this.input);
    root.addEventListener('click',this.click);
    root.addEventListener('focusout',this.blur);
    root.addEventListener('keydown',this.keydown);
    document.addEventListener('pointerdown',this.outside);
  }
  close():void {
    const control = this.active?.input.closest('[data-required-flag-control]');
    const list = control?.querySelector<HTMLElement>('[data-required-flag-options]');
    if (list) list.hidden=true;
    this.active?.input.setAttribute('aria-expanded','false'); this.active=undefined;
  }
  refresh():void {
    const active=this.active;
    if (!active) return;
    if (!active.input.isConnected || active.input.readOnly || active.input.disabled || active.context!==this.context()) {this.close();return;}
    const list=active.input.closest('[data-required-flag-control]')?.querySelector<HTMLElement>('[data-required-flag-options]');
    if (!list) {this.close();return;}
    list.hidden=false;active.input.setAttribute('aria-expanded','true');
    const query=active.query.trim().toLocaleLowerCase();
    for (const row of list.querySelectorAll<HTMLElement>('[data-required-flag-option]')) {
      const matches=!query || row.dataset.requiredFlagOption!.toLocaleLowerCase().includes(query);
      row.classList.toggle('is-filter-muted',!matches);row.dataset.filterMatch=String(matches);
      row.setAttribute('aria-selected',String(row.dataset.requiredFlagOption===active.input.value));
    }
  }
  private open(input:HTMLInputElement):void {
    if (!this.context() || !input.closest('[data-required-flag-control]') || input.readOnly || input.disabled) return;
    if (this.active?.input!==input) {this.close();this.active={input,query:'',context:this.context()};}
    this.refresh();
  }
  private focus=(event:Event):void=>{
    if(event.target instanceof HTMLInputElement && event.target.closest('[data-required-flag-control]'))this.open(event.target);
    else if(this.active && event.target instanceof Node && !this.active.input.closest('[data-required-flag-control]')?.contains(event.target))this.close();
  };
  private input=(event:Event):void=>{
    if(this.committing || !(event.target instanceof HTMLInputElement) || !event.target.closest('[data-required-flag-control]'))return;
    this.open(event.target);if(this.active)this.active.query=event.target.value;this.refresh();
  };
  private click=(event:Event):void=>{
    if(event.target instanceof HTMLInputElement){this.open(event.target);return;}
    const option=event.target instanceof Element?event.target.closest<HTMLElement>('[data-required-flag-option]'):null;
    if(!option || !this.active)return;
    event.preventDefault();const {input,context}=this.active;const name=option.dataset.requiredFlagOption!;
    if(!input.isConnected || input.readOnly || input.disabled || context!==this.context() || !this.candidates().includes(name)){this.close();return;}
    this.close();input.value=name;this.committing=true;
    try {input.dispatchEvent(new Event('input',{bubbles:true}));}finally{this.committing=false;}
    input.focus({preventScroll:true});this.close();
  };
  private blur=(event:FocusEvent):void=>{
    if(this.active && !(event.relatedTarget instanceof Node && this.active.input.closest('[data-required-flag-control]')?.contains(event.relatedTarget)))this.close();
  };
  private outside=(event:Event):void=>{
    if(this.active && !(event.target instanceof Node && this.active.input.closest('[data-required-flag-control]')?.contains(event.target)))this.close();
  };
  private keydown=(event:KeyboardEvent):void=>{if(event.key==='Escape' && this.active){event.preventDefault();this.close();}};
  dispose():void {
    this.close();this.root.removeEventListener('focusin',this.focus);this.root.removeEventListener('input',this.input);
    this.root.removeEventListener('click',this.click);this.root.removeEventListener('focusout',this.blur);
    this.root.removeEventListener('keydown',this.keydown);document.removeEventListener('pointerdown',this.outside);
  }
}
