// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/runtime/context';
import { renderSelectorPage } from '../../../src/ui/components/navigation/selector-page';
import { projectSelectorTheme } from '../../../src/ui/presentation/selector-theme';
import { applyThemeTree } from '../../../src/ui/presentation/theme-tree';

describe('star graph label contrast',()=>{
  let game:GameInstance|undefined;
  afterEach(()=>{game?.stop();document.head.querySelector('[data-selector-label-test]')?.remove();document.body.innerHTML='';});

  it.each(['#ffffff','#101828'])('uses the visible %s scene for every node and state, including after a scene switch',background=>{
    const style=document.createElement('style');style.dataset.selectorLabelTest='';style.textContent=readFileSync('src/ui/css/selectors.css','utf8');document.head.append(style);
    game=new GameInstance();game.init([structuredClone(baseDatapack)]);
    const light=background==='#ffffff', opposite=light?'#101828':'#ffffff';
    const focus=game.world.inits.get('base:init:millennium')!, other=game.world.inits.get('base:init:schale_office')!;
    focus.theme={systemColorLayerIgnored:true,background:[{kind:'solid',value:background}]};
    other.theme={systemColorLayerIgnored:true,background:[{kind:'solid',value:opposite}]};
    const ctx=createUIContext(game);
    const projection=projectSelectorTheme(ctx,'init',focus.id);
    document.body.innerHTML=renderSelectorPage(ctx,'new',focus.id,null,false,'init');
    const canvas=document.querySelector<SVGSVGElement>('.selector-graph-canvas')!;
    const node=canvas.querySelector<SVGGElement>(`[data-node-id="init:${other.id}"]`)!;
    const label=node.querySelector<SVGTextElement>('.selector-node-label')!;
    const expected=document.createElement('span');expected.style.color=projection.background.ink!.text;document.body.append(expected);
    const renderedInk=()=>{
      const computed=getComputedStyle(label);
      const fill=computed.getPropertyValue('fill');
      return fill.toLowerCase()==='currentcolor'?computed.color:fill;
    };
    expect(node.style.getPropertyValue('--ink-on-canvas')).not.toBe(projection.tree['--ink-on-canvas']);
    for(const state of ['', 'is-selected', 'is-fog']){
      node.classList.remove('is-selected','is-fog');if(state)node.classList.add(state);
      expect(renderedInk(),state||'ordinary').toBe(getComputedStyle(expected).color);
      expect(getComputedStyle(label).getPropertyValue('stroke')).toBe('none');
    }
    const changed=projectSelectorTheme(ctx,'init',other.id);
    applyThemeTree(document.querySelector<HTMLElement>('.selector-workspace')!,changed.tree);
    expected.style.color=changed.background.ink!.text;
    expect(renderedInk()).toBe(getComputedStyle(expected).color);
    expect(canvas.querySelector(`[data-node-id="init:${other.id}"]`)===node).toBe(true);
  });
});
