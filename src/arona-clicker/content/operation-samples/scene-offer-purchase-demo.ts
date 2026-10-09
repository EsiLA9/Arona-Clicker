import type {
  OperationActorDef,
  OperationActionDef,
  OperationEventContentDef,
  OperationLocationDef,
  StudentOperationProfileDef,
} from '../../../data-services/contracts/operation';
import { Character } from '../../types/ids';
import { atomicSceneDemoEvent } from './atomic-scene-demo';
import { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';

export const SCENE_OFFER_PURCHASE_DEMO_IDS = Object.freeze({
  event: 'gameplay-b:operation-event:scene-offer-purchase-demo',
  location: 'gameplay-b:operation-location:scene-offer-purchase-demo',
  exitLocation: 'gameplay-b:operation-location:scene-offer-purchase-demo-exit',
  choiceScene: 'choose-response',
  purchaseScene: 'purchase-supplies',
  route: 'leave-supply-site',
  hoshinoProfile: 'gameplay-b:student-operation-profile:scene-offer-purchase-demo-hoshino',
  choiceA: 'stabilize-gate',
  choiceB: 'inspect-radio',
  choiceC: 'secure-perimeter',
  choiceD: 'record-stock-count',
  removeSpentWater: 'remove-spent-water',
  finalInventoryCheck: 'confirm-final-inventory',
  fixedBriefing: 'daily-briefing',
  choiceActionA: 'gameplay-b:operation-action:offer-demo-stabilize-gate',
  choiceActionB: 'gameplay-b:operation-action:offer-demo-inspect-radio',
  choiceActionC: 'gameplay-b:operation-action:offer-demo-secure-perimeter',
  choiceActionD: 'gameplay-b:operation-action:offer-demo-record-stock-count',
  removeSpentWaterAction: 'gameplay-b:operation-action:offer-demo-remove-water-after-purchase',
  finalInventoryCheckAction: 'gameplay-b:operation-action:offer-demo-final-inventory-check',
  fixedBriefingAction: 'gameplay-b:operation-action:offer-demo-briefing',
  purchaseWaterAction: 'gameplay-b:operation-action:offer-demo-buy-water',
  purchaseMedkitAction: 'gameplay-b:operation-action:offer-demo-buy-medkit',
  waterOffer: 'water',
  medkitOffer: 'medkit',
  waterFact: 'bought-water',
  medkitFact: 'bought-medkit',
  waterItem: 'emergency-water',
  medkitItem: 'field-medkit',
  track: 'supply-readiness',
});

const ids = SCENE_OFFER_PURCHASE_DEMO_IDS;
const actorId = CAROUSEL_SAFETY_IDS.actors.hoshino;
const sourceStudentActor = atomicSceneDemoEvent.actors.find(actor => actor.id === actorId);
const studentActor: OperationActorDef | undefined = sourceStudentActor ? {
  id: sourceStudentActor.id,
  type: sourceStudentActor.type,
  ...(sourceStudentActor.displayName ? { displayName: sourceStudentActor.displayName } : {}),
  ...(sourceStudentActor.avatarRef ? { avatarRef: sourceStudentActor.avatarRef } : {}),
  ...(sourceStudentActor.description ? { description: sourceStudentActor.description } : {}),
  hp: sourceStudentActor.hp,
} : undefined;
const studentParticipant = atomicSceneDemoEvent.participants.find(participant => participant.actorId === actorId);
if (!studentActor || studentParticipant?.kind !== 'student') throw new Error('Scene Offer demo requires the admitted Hoshino student profile');

function choiceAction(id: string, title: string, amount: number): OperationActionDef {
  return {
    id,
    title,
    description: '记录一种现场处置方案；第一场景要求同批从四个方案中恰好选择两个。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: ids.track, amount }],
  };
}

export const sceneOfferPurchaseDemoActions: readonly OperationActionDef[] = [
  choiceAction(ids.choiceActionA, '稳定闸门', 1),
  choiceAction(ids.choiceActionB, '检查无线电', 2),
  choiceAction(ids.choiceActionC, '加固外围', 3),
  {
    id: ids.choiceActionD,
    title: '核对现有库存',
    description: '记录当前库存数量，并提升现场准备度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: ids.track, amount: 4 }],
  },
  {
    id: ids.removeSpentWaterAction,
    title: '移除已耗用饮水',
    description: '移除持有饮水，并更新库存复核记录；购买事实标记保持不变。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [
      { kind: 'heldItem', itemId: ids.waterItem, op: 'remove' },
      { kind: 'eventTrackDelta', trackId: ids.track, amount: 1 },
    ],
  },
  choiceAction(ids.finalInventoryCheckAction, '完成库存复核', 2),
  choiceAction(ids.fixedBriefingAction, '固定现场简报', 1),
  {
    id: ids.purchaseWaterAction,
    title: '应急饮水',
    description: '补给一箱饮水，并提升现场准备度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [
      { kind: 'heldItem', itemId: ids.waterItem, op: 'grant' },
      { kind: 'eventTrackDelta', trackId: ids.track, amount: 1 },
    ],
  },
  {
    id: ids.purchaseMedkitAction,
    title: '现场医疗包',
    description: '补给医疗包，并提升现场准备度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [
      { kind: 'heldItem', itemId: ids.medkitItem, op: 'grant' },
      { kind: 'eventTrackDelta', trackId: ids.track, amount: 2 },
    ],
  },
];

export const sceneOfferPurchaseDemoHoshinoProfile: StudentOperationProfileDef = {
  id: ids.hoshinoProfile,
  characterId: Character.Hoshino,
  candidateActionIds: [ids.choiceActionA, ids.choiceActionB, ids.choiceActionC, ids.choiceActionD, ids.removeSpentWaterAction, ids.finalInventoryCheckAction],
  actionPriorityIds: [ids.choiceActionA, ids.choiceActionB, ids.choiceActionC, ids.choiceActionD, ids.removeSpentWaterAction, ids.finalInventoryCheckAction],
  capabilityIds: [],
  reasonIds: [],
};

export const sceneOfferPurchaseDemoLocation: OperationLocationDef = {
  id: ids.location,
  stage: 'scene',
  enabledActionIds: [],
  combinationRules: [],
  scenes: [{
    id: ids.choiceScene,
    title: '现场行动选择',
    description: '本场景从四个行动方案中恰好选择两个；固定简报自动纳入且不计入选择数。',
    actionMode: 'global',
    sceneActionBatches: 2,
    sceneActions: [
      { id: ids.choiceA, actionId: ids.choiceActionA, scope: 'global', playerCost: 1, performerPolicy: 'none', selectionPolicy: 'required' },
      { id: ids.choiceB, actionId: ids.choiceActionB, scope: 'global', playerCost: 1, performerPolicy: 'none', selectionPolicy: 'required' },
      { id: ids.choiceC, actionId: ids.choiceActionC, scope: 'global', playerCost: 1, performerPolicy: 'none', selectionPolicy: 'required' },
      { id: ids.choiceD, actionId: ids.choiceActionD, scope: 'global', playerCost: 1, performerPolicy: 'none', selectionPolicy: 'required' },
      { id: ids.fixedBriefing, actionId: ids.fixedBriefingAction, scope: 'global', playerCost: 0, performerPolicy: 'none', selectionPolicy: 'fixed' },
    ],
    sceneActionChoice: { candidateSceneActionIds: [ids.choiceA, ids.choiceB, ids.choiceC, ids.choiceD], chooseExactly: 2 },
    completion: { kind: 'track', trackId: ids.track, operator: 'gte', value: 3 },
  }, {
    id: ids.purchaseScene,
    title: '补给采购与库存复核',
    description: '在独立补给场景查看不同价格的一次性购买项；两项可在同一批次原子结算。购买后还需完成库存复核。',
    actionMode: 'global',
    sceneActionBatches: 3,
    sceneActions: [
      { id: ids.removeSpentWater, actionId: ids.removeSpentWaterAction, scope: 'global', playerCost: 0, performerPolicy: 'none', selectionPolicy: 'required' },
      { id: ids.finalInventoryCheck, actionId: ids.finalInventoryCheckAction, scope: 'global', playerCost: 0, performerPolicy: 'none', selectionPolicy: 'required' },
    ],
    purchaseOffers: [
      {
        id: ids.waterOffer,
        actionId: ids.purchaseWaterAction,
        playerCost: 2,
        purchaseFactId: ids.waterFact,
        title: '购买应急饮水',
        description: '每次 Run 只能购买一次；防重标记独立于获得的物品。',
      },
      {
        id: ids.medkitOffer,
        actionId: ids.purchaseMedkitAction,
        playerCost: 3,
        purchaseFactId: ids.medkitFact,
        title: '购买现场医疗包',
        description: '每次 Run 只能购买一次；防重标记独立于获得的物品。',
      },
    ],
    completion: { kind: 'track', trackId: ids.track, operator: 'gte', value: 10 },
  }],
  objectives: [
    { id: 'water-delivered', description: '应急饮水已购买。', kind: 'primary', predicate: { kind: 'knownFact', factId: ids.waterFact, present: true } },
    { id: 'medkit-delivered', description: '医疗包已购买。', kind: 'primary', predicate: { kind: 'knownFact', factId: ids.medkitFact, present: true } },
  ],
  routeEdges: [{
    id: ids.route,
    targetLocationId: ids.exitLocation,
    label: '离开补给点',
    description: '两项补给都已购买，可以离开。',
  }],
};

export const sceneOfferPurchaseDemoExitLocation: OperationLocationDef = {
  id: ids.exitLocation,
  stage: 'scene',
  enabledActionIds: [],
  combinationRules: [],
  routeEdges: [],
};

export const sceneOfferPurchaseDemoEvent: OperationEventContentDef = {
  id: ids.event,
  title: '场景选择与临时购买演示',
  description: '同一地点依次展示 exact 2-of-4 行动候选与独立补给场景；补给项共享 PlayerCost 且可同批购买。',
  initId: 'base:init:schale_office',
  resumeVersion: 1,
  locationIds: [ids.location, ids.exitLocation],
  initialLocationId: ids.location,
  maxLocationVisits: 2,
  tracks: [{ id: ids.track, initial: 0, min: 0, max: 20 }],
  factIds: [ids.waterFact, ids.medkitFact],
  knownFactIds: [],
  itemIds: [ids.waterItem, ids.medkitItem],
  heldItemIds: [],
  actors: [studentActor],
  participants: [{ ...studentParticipant, profileId: ids.hoshinoProfile }],
  playerRouteState: { playerCost: 11 },
};
