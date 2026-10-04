import type { LocationActivityDefinition } from "../locations/activity.js";
import type { BattleActionEffect, BattleCharacterDefinition, BattlePreparationInput, BattleSide, BattleTargetRule, CharacterDefinition, OrdinaryBattleCardDefinition } from "../model.js";
import { firstBattle } from "./first-battle.js";

export interface ShortRouteActivityContent {
  readonly nodeNumber: number;
  readonly id: string;
  readonly name: string;
  readonly activityCount: number;
  readonly activity: LocationActivityDefinition;
  readonly nextBattleModifier?: {
    readonly initialSCostBonus?: number;
    readonly rechargeBonus?: { readonly amount: number; readonly fromRound: number };
  };
}

export interface ShortRouteCharacterContent {
  readonly id: string;
  readonly roster: CharacterDefinition;
  readonly battle: BattleCharacterDefinition;
}

interface ShortRouteNodeBase {
  readonly nodeNumber: number;
  readonly id: string;
  readonly name: string;
}

export type ShortRouteNode =
  | (ShortRouteNodeBase & { readonly kind: "battle"; readonly battle: BattlePreparationInput; readonly temporarySample?: { readonly sourceEncounterId: string; readonly replacementTask: "0191" } })
  | (ShortRouteNodeBase & ShortRouteActivityContent & { readonly kind: "activity"; readonly onEnter?: readonly { readonly kind: "join-character"; readonly character: ShortRouteCharacterContent }[] })
  | (ShortRouteNodeBase & { readonly kind: "exit"; readonly activityCount: 1; readonly completionText: string });

const low = (side: BattleSide, rows: readonly ("front" | "back" | "any")[], requirement?: "injured-half" | "prepared-attack"): BattleTargetRule =>
  ({ kind: "lowest", side, rows, ...(requirement ? { requirement } : {}) });
const attack = (target: BattleTargetRule): BattleActionEffect => ({ kind: "attack", target });
const heal = (target: BattleTargetRule, amount: number): BattleActionEffect => ({ kind: "heal", amount, target });
const shield = (target: BattleTargetRule, amount: number): BattleActionEffect => ({ kind: "shield", amount, target });
const card = (id: string, name: string, cost: number, tag: string, effect: BattleActionEffect): OrdinaryBattleCardDefinition =>
  ({ id, name, cost, tags: [tag], effect });

export const chiseContent: ShortRouteCharacterContent = {
  id: "chise",
  roster: { id: "chise", name: "千世", row: "front", hpMax: 9, initialHp: 9, atk: 1, def: 0, activityTags: [] },
  battle: {
    id: "chise", name: "千世", row: "front", hpMax: 9, atk: 1, def: 0,
    cards: [
      card("chise-first-aid-shot", "急救射击", 1, "shoot", attack(low("enemy", ["front"]))),
      card("chise-field-dressing", "现场包扎", 2, "support", heal(low("ally", ["any"], "injured-half"), 2)),
    ],
    aiPriority: [
      { cardId: "chise-field-dressing", condition: { kind: "injured-ally-half" }, holdCost: 2, reserveException: "heal-wounded-ally" },
      { cardId: "chise-first-aid-shot", condition: { kind: "enemy-row-alive", row: "front" }, holdCost: 2 },
    ],
  },
};

export const reinaContent: ShortRouteCharacterContent = {
  id: "reina",
  roster: { id: "reina", name: "玲奈", row: "front", hpMax: 12, initialHp: 12, atk: 2, def: 1, activityTags: [] },
  battle: {
    id: "reina", name: "玲奈", row: "front", hpMax: 12, atk: 2, def: 1,
    cards: [
      card("reina-charge", "冲锋", 1, "charge", attack(low("enemy", ["front"]))),
      card("reina-cover", "掩护", 2, "cover", shield({ kind: "intent-target", intentTag: "charge" }, 2)),
      card("reina-break-formation", "破阵爆破", 3, "blast", attack({ kind: "all", side: "enemy", row: "front" })),
    ],
    aiPriority: [
      { cardId: "reina-break-formation", condition: { kind: "enemy-front-count", minimum: 2 }, holdCost: 0 },
      { cardId: "reina-cover", condition: { kind: "enemy-intent", tag: "charge" }, holdCost: 1, reserveException: "cover-enemy-charge" },
      { cardId: "reina-charge", condition: { kind: "enemy-row-alive", row: "front" }, holdCost: 1 },
    ],
  },
};

export const firstAidStationActivity: ShortRouteActivityContent = {
  nodeNumber: 6,
  id: "first-aid-station",
  name: "急救补给站",
  activityCount: 1,
  activity: {
    locationId: "first-aid-station",
    fixedEffects: [{ kind: "heal-party", amount: 2, text: "全队每人恢复 2 点 HP。" }],
    individualCheck: {
      kind: "chance",
      dieSides: 2,
      outcomes: {
        1: {
          success: true,
          outcome: { kind: "effect", text: "额外找到敷料，恢复 1 点 HP。", effect: { kind: "heal", amount: 1 } },
        },
        2: { success: false, outcome: { kind: "none", text: "没有额外找到敷料。" } },
      },
    },
  },
  nextBattleModifier: { initialSCostBonus: 1 },
};

export const mirrorMazeActivity: ShortRouteActivityContent = {
  nodeNumber: 7,
  id: "mirror-maze",
  name: "镜面迷宫",
  activityCount: 2,
  activity: {
    locationId: "mirror-maze",
    fixedEffects: [],
    individualCheck: {
      kind: "attribute",
      dieSides: 6,
      attribute: "def",
      difficulty: 6,
      success: { kind: "clue", text: "找到正确转角；线索只记入事件日志。" },
      failure: { kind: "effect", text: "被反光绕了一段路，损失 1 点 HP。", effect: { kind: "damage", amount: 1 } },
    },
  },
};

export const backstageRestRoomActivityFixture: ShortRouteActivityContent = {
  nodeNumber: 10,
  id: "backstage-rest-room",
  name: "后台休息室",
  activityCount: 1,
  activity: {
    locationId: "backstage-rest-room",
    fixedEffects: [{ kind: "heal-party", amount: 2, text: "全队每人恢复 2 点 HP。" }],
  },
  nextBattleModifier: { rechargeBonus: { amount: 1, fromRound: 2 } },
};

export const shortRouteActivities = [firstAidStationActivity, mirrorMazeActivity] as const;

const temporarySecondBattle: BattlePreparationInput = {
  ...firstBattle,
  encounterId: "node-9-temporary-short-route-sample",
};

export const shortRouteNodes: readonly ShortRouteNode[] = [
  { nodeNumber: 5, id: "node-5", name: "失控碰碰车区", kind: "battle", battle: firstBattle },
  { ...firstAidStationActivity, nodeNumber: 6, id: "node-6", kind: "activity", onEnter: [{ kind: "join-character", character: chiseContent }] },
  { ...mirrorMazeActivity, nodeNumber: 7, id: "node-7", kind: "activity" },
  {
    nodeNumber: 9,
    id: "node-9",
    name: "烟花排练广场（临时短路线样例）",
    kind: "battle",
    battle: temporarySecondBattle,
    temporarySample: { sourceEncounterId: firstBattle.encounterId, replacementTask: "0191" },
  },
  { nodeNumber: 12, id: "node-12", name: "东出口交接处", kind: "exit", activityCount: 1, completionText: "固定交接完成，Demo 结束。" },
];

export const backstageRestRoomFixture = {
  ...backstageRestRoomActivityFixture,
  onEnter: [{ kind: "join-character" as const, character: reinaContent }],
  fixtureFor: "0190-U3" as const,
};
