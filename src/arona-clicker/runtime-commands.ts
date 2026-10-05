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
import type { RuntimeSpotMutation, RuntimeSpotMutationResult, RuntimeWorldApplyResult, RuntimeWorldDraft } from './contracts/runtime-content';
import type { RuntimeDefinitionEditorCommands } from './contracts/runtime-content';
import type { RuntimeModDraft, RuntimeModApplyResult } from './contracts/runtime';
import type { PlayerState } from './types/state';
import type { DevLogEntry } from '../engine/core/dev-log';
import type { OperationObservation, OperationObservationInput } from './contracts/operation-observation';
import type { ThemeContentEditorService } from './services/theme-content-editor-service';

export interface GameCommandSource {
  readonly state: Readonly<PlayerState>;
  getDevLogs(): readonly DevLogEntry[];
  recordOperationObservation(input: OperationObservationInput): OperationObservation;
  readonly themeContentEditor?: ThemeContentEditorService;
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
  applyRuntimeSpotMutation?(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult;
  applyRuntimeWorldDraft?(draft: RuntimeWorldDraft): RuntimeWorldApplyResult;
  setRuntimeModMetadata?(metadata: Pick<RuntimeModDraft, 'modName' | 'displayName' | 'version' | 'author' | 'description'>): RuntimeModApplyResult;
  runtimeDefinitionEditor?: RuntimeDefinitionEditorCommands;
}

/** 将 AronaClicker Runtime 的公开命令适配为 UI 能力接口。 */
export function createGameCommands(game: GameCommandSource): GameCommands {
  const snapshotSpotUpgradeState = (spotId: string) => ({
    spotLevel: game.state.spotLevels[spotId] ?? null,
    resources: {
      global: { ...(game.state.globalResources ?? {}) },
      currentInit: { ...game.state.resources },
    },
    inventory: { ...game.state.inventory },
  });

  const highestLogId = (entries: readonly DevLogEntry[]) => entries.reduce((maxId, entry) => Math.max(maxId, entry.id), 0);

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
    unlockSpot: (spotId, paymentOptionId) => game.spot.unlockSpot(spotId, paymentOptionId),
    upgradeSpot: (spotId, paymentOptionId) => {
      const stateBefore = game.state;
      const before = snapshotSpotUpgradeState(spotId);
      const beforeLogId = highestLogId(game.getDevLogs());
      const result = game.spot.upgradeSpot(spotId, paymentOptionId);
      const stateAfter = game.state;
      const after = snapshotSpotUpgradeState(spotId);
      const logsAfter = game.getDevLogs();
      const afterLogId = highestLogId(logsAfter);
      const entries = logsAfter.filter(entry => entry.id > beforeLogId);
      const expectedNewLogs = Math.max(0, afterLogId - beforeLogId);

      game.recordOperationObservation({
        operation: { kind: 'spot-upgrade', spotId, ...(paymentOptionId === undefined ? {} : { paymentOptionId }) },
        result,
        identity: {
          activeInit: stateBefore.activeInit ?? 'none',
          contentRevision: 'unknown',
          reason: 'runtime-content-revision-not-exposed',
        },
        frame: { before: stateBefore.totalFrames, after: stateAfter.totalFrames },
        before,
        after,
        logs: {
          association: 'captured-during-command',
          entries,
          omitted: Math.max(0, expectedNewLogs - entries.length),
        },
      });
      return result;
    },
    purchaseInit: initId => game.inits.purchaseInit(initId),
    hardRestartInit: () => game.inits.hardRestartInit(),
    roll: (poolId, count) => game.gachaService.roll(poolId, count),
    markChatRead: messageId => game.mutations.markChatRead(messageId),
    equipEquipment: (variantId, equipmentId) => game.mutations.equipEquipment(variantId, equipmentId),
    unequipEquipment: variantId => game.mutations.unequipEquipment(variantId),
    equipGear: (variantId, slotIndex) => game.mutations.equipGear(variantId, slotIndex),
    feedGearExp: (variantId, slotIndex, itemId, count) => game.mutations.feedGearExp(variantId, slotIndex, itemId, count),
    upgradeGearTier: (variantId, slotIndex) => game.mutations.upgradeGearTier(variantId, slotIndex),
    addExp: (variantId, amount) => game.mutations.addExp(variantId, amount),
    breakthroughStar: variantId => game.mutations.breakthroughStar(variantId),
    activateTheme: groupId => game.mutations.activateTheme(groupId),
    activateCustomTheme: customThemeId => game.mutations.activateCustomTheme(customThemeId),
    setThemeLayerOrder: order => game.mutations.setThemeLayerOrder(order),
    setEntityThemeSlot: (entityKey, slot) => game.mutations.setEntityThemeSlot(entityKey, slot),
    setEntityPresentationSelection: (entityKey, optionId) => game.mutations.setEntityPresentationSelection(entityKey, optionId),
    clearEntityPresentationSelection: entityKey => game.mutations.clearEntityPresentationSelection(entityKey),
    unlockInit: initId => game.inits.unlockInit(initId),
    startNewGame: initId => game.inits.startNewGame(initId),
    restartInit: () => game.inits.restartInit(),
    resumeInit: initId => game.inits.resumeInit(initId),
    ...(game.applyRuntimeSpotMutation ? { applyRuntimeSpotMutation: mutation => game.applyRuntimeSpotMutation!(mutation) } : {}),
    ...(game.applyRuntimeWorldDraft ? { applyRuntimeWorldDraft: draft => game.applyRuntimeWorldDraft!(draft) } : {}),
    ...(game.setRuntimeModMetadata ? { setRuntimeModMetadata: metadata => game.setRuntimeModMetadata!(metadata) } : {}),
    ...(game.runtimeDefinitionEditor ? { runtimeDefinitionEditor: game.runtimeDefinitionEditor } : {}),
    ...(game.themeContentEditor ? { themeContentEditor: game.themeContentEditor } : {}),
  };
}
