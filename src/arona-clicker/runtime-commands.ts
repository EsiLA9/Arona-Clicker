import type { GameCommands } from './contracts';
import type { StoryService } from './services/story-service';
import type { SpotService } from './services/spot-service';
import type { InitService } from './services/init-service';
import type { ItemService } from './services/item-service';
import type { EnhancementService } from './services/enhancement-service';
import type { UiMutationPort } from './contracts/mutation';
import type { GachaService } from './services/gacha-service';
import type { AreaId } from '../engine/types';
import type { TickResult } from '../engine/contracts/tick';
import type { TravelResult } from './contracts/results';
import type { SaveData } from './contracts/save-data';

export interface GameCommandSource {
  travelToArea(areaId: AreaId, allowDuringStory?: boolean, checkAdjacency?: boolean): TravelResult;
  tick(): TickResult;
  start(): void;
  stop(): void;
  reset(): void;
  clearDevLogs(): void;
  save(): SaveData;
  load(saveData: SaveData): void;
  story: Pick<StoryService, 'startActiveStory' | 'startCardStory' | 'replayStory' | 'triggerPassiveStory' | 'triggerAffectionPush' | 'triggerTailPush' | 'advanceStory' | 'clickSend'>;
  items: Pick<ItemService, 'useItem'>;
  enhancements: Pick<EnhancementService, 'purchaseEnhancement' | 'removeEnhancement'>;
  spot: Pick<SpotService, 'unlockSpot' | 'upgradeSpot'>;
  inits: Pick<InitService, 'purchaseInit' | 'hardRestartInit' | 'unlockInit' | 'startNewGame' | 'restartInit' | 'resumeInit'>;
  gachaService: Pick<GachaService, 'roll'>;
  mutations: UiMutationPort;
}

/** 将 AronaClicker Runtime 的公开命令适配为 UI 能力接口。 */
export function createGameCommands(game: GameCommandSource): GameCommands {
  return {
    travelToArea: (areaId, allowDuringStory, checkAdjacency) => game.travelToArea(areaId, allowDuringStory, checkAdjacency),
    tick: () => game.tick(),
    start: () => game.start(),
    stop: () => game.stop(),
    reset: () => game.reset(),
    clearDevLogs: () => game.clearDevLogs(),
    save: () => game.save(),
    load: saveData => game.load(saveData),
    startActiveStory: (storyId, owner) => game.story.startActiveStory(storyId, owner),
    startCardStory: (storyId, owner) => game.story.startCardStory(storyId, owner),
    replayStory: (storyId, owner) => game.story.replayStory(storyId, owner),
    triggerPassiveStory: (initId, owner) => game.story.triggerPassiveStory(initId, owner),
    triggerAffectionPush: owner => game.story.triggerAffectionPush(owner),
    triggerTailPush: (owner, storyId) => game.story.triggerTailPush(owner, storyId),
    advanceStory: (choiceIndex, owner) => game.story.advanceStory(choiceIndex, owner),
    clickSend: owner => game.story.clickSend(owner),
    useItem: itemId => game.items.useItem(itemId),
    purchaseEnhancement: enhancementId => game.enhancements.purchaseEnhancement(enhancementId),
    removeEnhancement: enhancementId => game.enhancements.removeEnhancement(enhancementId),
    unlockSpot: spotId => game.spot.unlockSpot(spotId),
    upgradeSpot: spotId => game.spot.upgradeSpot(spotId),
    purchaseInit: initId => game.inits.purchaseInit(initId),
    hardRestartInit: () => game.inits.hardRestartInit(),
    roll: (poolId, count) => game.gachaService.roll(poolId, count),
    markChatRead: messageId => game.mutations.markChatRead(messageId),
    equipEquipment: (variantId, equipmentId) => game.mutations.equipEquipment(variantId, equipmentId),
    unequipEquipment: variantId => game.mutations.unequipEquipment(variantId),
    addExp: (variantId, amount) => game.mutations.addExp(variantId, amount),
    breakthroughStar: variantId => game.mutations.breakthroughStar(variantId),
    activateTheme: groupId => game.mutations.activateTheme(groupId),
    setThemeLayerOrder: order => game.mutations.setThemeLayerOrder(order),
    setEntityThemeSlot: (entityKey, slot) => game.mutations.setEntityThemeSlot(entityKey, slot),
    unlockInit: initId => game.inits.unlockInit(initId),
    startNewGame: initId => game.inits.startNewGame(initId),
    restartInit: () => game.inits.restartInit(),
    resumeInit: initId => game.inits.resumeInit(initId),
  };
}
