import type { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import type { UIController } from '../../../src/ui/controller/controller';
import { baseDatapack } from '../../../src/data/test-datapack';

/** Existing editor fixtures use GameInstance, which deliberately has no package library. */
export function createStoryForTest(game: GameInstance, ctrl: UIController): void {
  if (!('getPackCatalog' in game)) {
    const entry={id:'test-editing',packRecordId:'test-editing',modName:'local',name:'测试 Mod',version:'1',editingMode:'editing',contentDigest:'test'};
    const record={packRecordId:entry.id,editingMode:'editing',manifest:{modName:'local',name:entry.name,version:'1',dependencies:[]},datapack:{...baseDatapack,modName:'local',stories:[],activeStories:[],passiveStories:[],passivePools:[]}};
    Object.assign(game,{getPackCatalog:()=>({entries:[entry],dependencies:[]}),getPackRecord:(id:string)=>id===entry.id?structuredClone(record):null});
  }
  document.querySelector<HTMLButtonElement>('[data-editor-action="new"]')!.click();ctrl.flushUIUpdates();
  const select=document.querySelector<HTMLSelectElement>('[data-story-new-mod]');
  if (!select) return;
  select.value=[...select.options].find(option=>option.value)?.value ?? '';
  document.querySelector<HTMLButtonElement>('[data-modal-action="create-story-in-mod"]')!.click();ctrl.flushUIUpdates();
}
