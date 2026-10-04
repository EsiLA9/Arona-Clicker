import type { CharacterDefinition, RouteInitialPartyMember } from "../model.js";
import type { GameplayBRouteNode } from "../runtime.js";
import { firstAidStationActivity, backstageRestRoomActivityFixture, chiseContent, mirrorMazeActivity, reinaContent } from "./short-route.js";
import { parkEncounters } from "./enemies.js";
import { firstBattle } from "./first-battle.js";

function roster(definition: typeof firstBattle.party[number]["definition"], initialHp: number): CharacterDefinition {
  return { id: definition.id, name: definition.name, row: definition.row, hpMax: definition.hpMax, initialHp,
    atk: definition.atk, def: definition.def, activityTags: [] };
}

export const parkInitialParty: readonly RouteInitialPartyMember[] = firstBattle.party.map((member) => ({
  roster: roster(member.definition, member.hp),
  battle: member.definition,
  hp: member.hp,
}));

function chanceActivity(locationId: string, successText: string, failureText: string, successEffect?: { readonly kind: "heal"; readonly amount: number }) {
  return {
    locationId,
    fixedEffects: [],
    individualCheck: {
      kind: "chance" as const,
      dieSides: 2,
      outcomes: {
        1: { success: true, outcome: successEffect
          ? { kind: "effect" as const, text: successText, effect: successEffect }
          : { kind: "clue" as const, text: successText } },
        2: { success: false, outcome: { kind: "none" as const, text: failureText } },
      },
    },
  };
}

export const parkRouteNodes: readonly GameplayBRouteNode[] = [
  {
    id: "node-1", name: "西门临时执勤点", kind: "activity", activityCount: 1,
    activity: { locationId: "west-gate-duty-point", fixedEffects: [] },
  },
  {
    id: "node-2", name: "林荫连廊", kind: "activity", activityCount: 2,
    activity: chanceActivity("tree-lined-corridor", "发现轮迹与散落代币，线索只记入日志。", "没有找到新线索，但碰碰车区仍有骚动。"),
  },
  {
    id: "node-3", name: "游园服务亭", kind: "activity", activityCount: 1,
    activity: chanceActivity("garden-service-kiosk", "稍作休息，恢复 1 点 HP。", "休息后没有额外恢复。", { kind: "heal", amount: 1 }),
  },
  {
    id: "node-4", name: "代币电玩馆", kind: "activity", activityCount: 1,
    activity: chanceActivity("token-arcade", "发现写着“碰碰车”的纸条，线索只记入日志。", "没有找到纸条，但确认有人朝碰碰车区去了。"),
  },
  { id: "node-5", name: "失控碰碰车区", kind: "battle", battle: parkEncounters.node5 },
  {
    id: "node-6", name: firstAidStationActivity.name, kind: "activity", activityCount: firstAidStationActivity.activityCount,
    activity: firstAidStationActivity.activity, nextBattleModifier: firstAidStationActivity.nextBattleModifier,
    onEnter: [{ kind: "join-character", character: chiseContent }],
  },
  {
    id: "node-7", name: mirrorMazeActivity.name, kind: "activity", activityCount: mirrorMazeActivity.activityCount,
    activity: mirrorMazeActivity.activity,
  },
  {
    id: "node-8", name: "摩天轮检修廊", kind: "activity", activityCount: 1,
    activity: {
      locationId: "ferris-wheel-maintenance", fixedEffects: [],
      individualCheck: {
        kind: "attribute", dieSides: 6, attribute: "atk", difficulty: 6,
        success: { kind: "clue", text: "在日志中记录备用烟花的位置。" },
        failure: { kind: "none", text: "记下安全入口，仍可继续前进。" },
      },
    },
  },
  { id: "node-9", name: "烟花排练广场", kind: "battle", battle: parkEncounters.node9 },
  {
    id: "node-10", name: backstageRestRoomActivityFixture.name, kind: "activity", activityCount: backstageRestRoomActivityFixture.activityCount,
    activity: backstageRestRoomActivityFixture.activity, nextBattleModifier: backstageRestRoomActivityFixture.nextBattleModifier,
    onEnter: [{ kind: "join-character", character: reinaContent }],
  },
  { id: "node-11", name: "中央舞台设备井", kind: "battle", battle: parkEncounters.node11 },
  {
    id: "node-12", name: "东出口交接处", kind: "exit", activityCount: 1,
    completionText: "巡查行动结束。支援人员接手现场，游园会恢复正常。",
  },
];
