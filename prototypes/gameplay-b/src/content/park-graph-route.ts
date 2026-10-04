import type { RouteInitialPartyMember } from "../model.js";
import type { GameplayBRouteNode, GameplayBRouteRuntimeInput } from "../runtime.js";
import type { LocationActivityDefinition } from "../locations/activity.js";
import { parkEncounters } from "./enemies.js";
import { parkInitialParty } from "./park-route.js";
import { chiseContent, reinaContent } from "./short-route.js";

const emptyActivity = (locationId: string): LocationActivityDefinition => ({ locationId, fixedEffects: [] });

const attributeActivity = (
  locationId: string,
  attribute: "atk" | "def",
  difficulty: number,
  successText: string,
  failureText: string,
  failureDamage = 0,
): LocationActivityDefinition => ({
  locationId,
  fixedEffects: [],
  individualCheck: {
    kind: "attribute",
    dieSides: 6,
    attribute,
    difficulty,
    success: { kind: "clue", text: successText },
    failure: failureDamage > 0
      ? { kind: "effect", text: failureText, effect: { kind: "damage", amount: failureDamage } }
      : { kind: "none", text: failureText },
  },
});

const partyRest = (locationId: string, amount: number, text: string): LocationActivityDefinition => ({
  locationId,
  fixedEffects: [{ kind: "heal-party", amount, text }],
});

function routeNode(
  fields: Omit<Extract<GameplayBRouteNode, { kind: "activity" }>, "kind" | "activity"> & { readonly id: string; readonly name: string },
): Extract<GameplayBRouteNode, { kind: "activity" }> {
  return { ...fields, kind: "activity", activity: emptyActivity(fields.id) };
}

export const parkGraphStartNodeId = "node-1";
export const parkGraphInitialParty: readonly RouteInitialPartyMember[] = parkInitialParty;

export const parkGraphRouteNodes: readonly GameplayBRouteNode[] = [
  routeNode({
    id: "node-1", name: "西门临时执勤点", area: "地面园区", activityCount: 1, costGain: 2, maxCarryCost: 5, maxVisits: 1,
    sceneChoices: { mode: "global", behaviors: [
      { id: "briefing", label: "领取巡查任务", cost: 0, activity: emptyActivity("west-gate-briefing") },
      { id: "check-gear", label: "检查装备", cost: 1, activity: attributeActivity("west-gate-gear", "def", 5, "装备检查完成。", "匆忙整备后出发。") },
    ] },
    exits: [{ id: "gate-to-corridor", label: "沿林荫连廊出发", targetNodeId: "node-2" }],
    noAvailableExitText: "西门通道暂时无法通行；支援人员接管本次巡查。",
  }),
  routeNode({
    id: "node-2", name: "林荫连廊", area: "地面园区", activityCount: 2, costGain: 1, maxCarryCost: 4, maxVisits: 1,
    sceneChoices: { mode: "global", behaviors: [
      { id: "follow-tracks", label: "追踪车轮印", cost: 0,
        activity: attributeActivity("tree-corridor-tracks", "atk", 6, "轮迹指向游园服务亭。", "轮迹中断，但广播仍能提供方向。") },
      { id: "radio-check", label: "联系服务亭", cost: 1,
        activity: { locationId: "tree-corridor-radio", fixedEffects: [], individualCheck: {
          kind: "chance", dieSides: 2, outcomes: {
            1: { success: true, outcome: { kind: "clue", text: "服务亭回复：电玩馆设备异常。" } },
            2: { success: false, outcome: { kind: "none", text: "通讯暂时没有回应。" } },
          },
        } } },
    ] },
    exits: [{ id: "corridor-to-kiosk", label: "前往游园服务亭", targetNodeId: "node-3" }],
    noAvailableExitText: "连廊临时封闭，本次巡查结束。",
  }),
  routeNode({
    id: "node-3", name: "游园服务亭", area: "地面园区", activityCount: 1, costGain: 3, maxCarryCost: 6, maxVisits: 2,
    sceneChoices: { mode: "global", behaviors: [
      { id: "rest-party", label: "全队短暂休整", cost: 2,
        activity: partyRest("service-kiosk-rest", 1, "队员各恢复 1 点 HP。") },
      { id: "check-broadcast", label: "查询员工广播", cost: 1, successItems: ["staff-radio"],
        activity: { locationId: "service-kiosk-broadcast", fixedEffects: [], individualCheck: {
          kind: "chance", dieSides: 1, outcomes: {
            1: { success: true, outcome: { kind: "clue", text: "广播确认设备层仍有备用电源。" } },
          },
        } } },
    ] },
    exits: [
      { id: "kiosk-to-arcade", label: "调查代币电玩馆", targetNodeId: "node-4" },
      { id: "kiosk-to-aid", label: "先到急救补给站", targetNodeId: "node-6" },
    ],
    noAvailableExitText: "服务亭周边已检查完毕，没有剩余通道。",
  }),
  routeNode({
    id: "node-4", name: "代币电玩馆", area: "地面园区", activityCount: 1, costGain: 2, maxCarryCost: 5, maxVisits: 2,
    sceneChoices: { mode: "individual", behaviors: [
      { id: "search-drawer", label: "搜索维修抽屉", cost: 1, successItems: ["maintenance-pass"],
        activity: attributeActivity("token-arcade-drawer", "atk", 6, "找到维修通行证；它可以打开员工设备通道。", "抽屉已空。") },
      { id: "inspect-console", label: "检查控制台", cost: 0,
        activity: attributeActivity("token-arcade-console", "def", 5, "控制台记录了镜面迷宫的停电时间。", "控制台没有留下可用记录。") },
    ] },
    exits: [
      { id: "arcade-to-maze", label: "进入镜面迷宫", targetNodeId: "node-7" },
      { id: "arcade-to-kiosk", label: "返回服务亭", targetNodeId: "node-3" },
    ],
    noAvailableExitText: "电玩馆的通道已封锁，队伍改由工作人员疏散。",
  }),
  {
    id: "node-5", name: "失控碰碰车区", area: "地面园区", kind: "battle", battle: parkEncounters.node5,
    exits: [{ id: "bumper-to-aid", label: "前往急救补给站", targetNodeId: "node-6" }],
    maxVisits: 1, costGain: 1, maxCarryCost: 4, noAvailableExitText: "碰碰车区出口受阻，支援人员接手。",
  },
  routeNode({
    id: "node-6", name: "急救补给站", area: "地面园区", activityCount: 1, costGain: 2, maxCarryCost: 5, maxVisits: 1,
    onEnter: [{ kind: "join-character", character: chiseContent }],
    nextBattleModifier: { initialSCostBonus: 1 },
    sceneChoices: { mode: "global", behaviors: [
      { id: "patch-up", label: "全队急救", cost: 2,
        activity: partyRest("first-aid-station-rest", 2, "全队完成急救，各恢复 2 点 HP。") },
      { id: "sort-supplies", label: "整理补给箱", cost: 1, successItems: ["field-kit"],
        activity: attributeActivity("first-aid-station-supplies", "def", 5, "整理出一套备用敷料。", "补给箱里没有可用物资。") },
    ] },
    exits: [{ id: "aid-to-ferris", label: "前往摩天轮检修廊", targetNodeId: "node-8" }],
    noAvailableExitText: "急救站外通道已封闭；队伍等待园区接驳。",
  }),
  routeNode({
    id: "node-7", name: "镜面迷宫", area: "地面园区", activityCount: 2, costGain: 2, maxCarryCost: 5, maxVisits: 2,
    sceneChoices: { mode: "individual", behaviors: [
      { id: "follow-markers", label: "跟随地面标记", cost: 0,
        activity: attributeActivity("mirror-maze-markers", "def", 6, "沿标记安全通过。", "被反光绕了一段路，损失 1 点 HP。", 1) },
      { id: "search-side-hall", label: "搜索侧廊", cost: 1, successItems: ["maintenance-pass"],
        activity: attributeActivity("mirror-maze-side-hall", "atk", 7, "找到一条员工检修通道，并取得维修通行证。", "侧廊没有通往设备层的入口。") },
    ] },
    exits: [
      { id: "maze-to-arcade", label: "返回电玩馆", targetNodeId: "node-4" },
      { id: "maze-to-bumper", label: "前往失控碰碰车区", targetNodeId: "node-5" },
      { id: "maze-to-aid", label: "前往急救补给站", targetNodeId: "node-6" },
      { id: "maze-to-ferris", label: "前往摩天轮检修廊", targetNodeId: "node-8" },
    ],
    noAvailableExitText: "迷宫的巡查通道已走完，队伍由工作人员引导离场。",
  }),
  routeNode({
    id: "node-8", name: "摩天轮检修廊", area: "地面园区", activityCount: 1, costGain: 1, maxCarryCost: 4, maxVisits: 2,
    sceneChoices: { mode: "individual", behaviors: [
      { id: "inspect-wiring", label: "检查检修面板", cost: 1,
        activity: attributeActivity("ferris-panel", "atk", 6, "面板记录了地下设备层的备用电源位置。", "线路标记模糊不清。") },
      { id: "search-staff-entry", label: "寻找员工入口", cost: 0, successItems: ["maintenance-pass"],
        activity: attributeActivity("ferris-staff-entry", "def", 6, "找到员工通行证与地下设备层入口。", "检修廊没有发现员工入口。") },
    ] },
    exits: [
      { id: "ferris-to-backstage", label: "经后台前往排练广场", targetNodeId: "node-10" },
      { id: "ferris-to-control", label: "进入地下设备层", targetNodeId: "node-13",
        condition: { kind: "any", conditions: [
          { kind: "has-item", itemId: "maintenance-pass" },
          { kind: "has-item", itemId: "staff-radio" },
        ] } },
    ],
    noAvailableExitText: "检修廊出口关闭；园区广播通知全员就地待援。",
  }),
  {
    id: "node-9", name: "烟花排练广场", area: "地面园区", kind: "battle", battle: parkEncounters.node9,
    exits: [{ id: "fireworks-to-boss", label: "进入中央舞台设备井", targetNodeId: "node-11" }],
    maxVisits: 1, costGain: 2, maxCarryCost: 4, noAvailableExitText: "排练广场已封锁，支援人员接手。",
  },
  routeNode({
    id: "node-10", name: "后台休息室", area: "地面园区", activityCount: 1, costGain: 2, maxCarryCost: 4, maxVisits: 1,
    onEnter: [{ kind: "join-character", character: reinaContent }],
    nextBattleModifier: { rechargeBonus: { amount: 1, fromRound: 2 } },
    sceneChoices: { mode: "global", behaviors: [
      { id: "rest-backstage", label: "短暂休整", cost: 2, activity: partyRest("backstage-rest", 2, "队伍恢复 2 点 HP。") },
      { id: "check-props", label: "检查舞台道具", cost: 1,
        activity: attributeActivity("backstage-props", "atk", 6, "定位了控制台的应急开关。", "道具间没有相关记录。") },
    ] },
    exits: [{ id: "backstage-to-fireworks", label: "进入烟花排练广场", targetNodeId: "node-9" }],
    noAvailableExitText: "后台通道已关闭，队伍由工作人员接出。",
  }),
  {
    id: "node-11", name: "中央舞台设备井", area: "地下设备层", kind: "battle", battle: parkEncounters.node11,
    exits: [{ id: "boss-to-east-gate", label: "前往东出口交接", targetNodeId: "node-12" }],
    maxVisits: 1, costGain: 2, maxCarryCost: 4, noAvailableExitText: "设备井出口受阻，支援人员接手交接。",
  },
  {
    id: "node-12", name: "东出口交接处", area: "地面园区", kind: "exit", activityCount: 1,
    completionText: "巡查行动结束。支援人员接手现场，游园会恢复正常。",
    exits: [], maxVisits: 1, costGain: 1, maxCarryCost: 3,
  },
  routeNode({
    id: "node-13", name: "地下设备层控制室", area: "地下设备层", activityCount: 1, costGain: 3, maxCarryCost: 5, maxVisits: 2,
    sceneChoices: { mode: "global", behaviors: [
      { id: "reset-generator", label: "复位备用电源", cost: 2,
        activity: partyRest("control-room-power", 1, "备用电源稳定运行，队员各恢复 1 点 HP。") },
      { id: "record-console", label: "登记控制台记录", cost: 0, successItems: ["stage-record"],
        activity: { locationId: "control-room-console", fixedEffects: [], individualCheck: {
          kind: "chance", dieSides: 1, outcomes: {
            1: { success: true, outcome: { kind: "clue", text: "控制台记录了舞台设备井的应急流程。" } },
          },
        } } },
    ] },
    exits: [
      { id: "control-to-ferris", label: "返回检修廊", targetNodeId: "node-8" },
      { id: "control-to-stage-pass", label: "持维修通行证前往设备井", targetNodeId: "node-11",
        condition: { kind: "has-item", itemId: "maintenance-pass" }, consumeItems: ["maintenance-pass"] },
      { id: "control-to-stage-radio", label: "凭员工广播进入设备井", targetNodeId: "node-11",
        condition: { kind: "has-item", itemId: "staff-radio" }, consumeItems: ["staff-radio"] },
    ],
    noAvailableExitText: "控制室备用通道无法使用；支援人员引导队伍撤离。",
  }),
];

export const parkGraphRouteViewContent = {
  title: "游园会停电巡查",
  descriptions: {
    "node-1": "从西门出发，确认巡查目标与队伍装备。",
    "node-2": "沿林荫连廊追踪异常活动；完成后选择下一处巡查点。",
    "node-3": "服务亭可休整或查询员工广播，再选择调查电玩馆或先去补给。",
    "node-4": "逐人调查控制台或搜索维修抽屉，结果可能改变地下通道是否可用。",
    "node-5": "碰碰车区首战：冲撞者与水枪射手封锁入口。",
    "node-6": "千世在首次到访时加入；可整理补给或为全队急救。",
    "node-7": "镜面迷宫允许回访；每人选择跟随标记或搜索侧廊。",
    "node-8": "逐人检查摩天轮检修廊；持通行证或员工广播可发现地下设备层入口。",
    "node-9": "烟花排练广场强敌战；胜利后前往地下设备井。",
    "node-10": "玲奈在首次到访时加入；整备效果作用于下一场战斗。",
    "node-11": "地下舞台设备井 Boss 战。",
    "node-12": "在东出口完成现场交接。",
    "node-13": "地下控制室有复位电源与登记记录两种全局行动，可回到检修廊或通往 Boss。",
  },
  items: {
    "maintenance-pass": "维修通行证",
    "staff-radio": "员工广播凭证",
    "field-kit": "急救补给包",
    "stage-record": "舞台设备记录",
  },
  areas: [
    { id: "ground", label: "地面园区", nodeIds: ["node-1", "node-2", "node-3", "node-4", "node-5", "node-6", "node-7", "node-8", "node-9", "node-10", "node-12"] },
    { id: "service-level", label: "地下设备层", nodeIds: ["node-13", "node-11"] },
  ],
} as const;

export const parkGraphRouteInput: GameplayBRouteRuntimeInput = {
  seed: "park-inspection-graph-demo",
  nodes: parkGraphRouteNodes,
  initialParty: parkGraphInitialParty,
  startNodeId: parkGraphStartNodeId,
  playerDeck: {
    cards: [
      { id: "light-a", name: "紧急照明", cost: 1, effect: { kind: "check-bonus", amount: 1, targetMode: "one" } },
      { id: "light-b", name: "紧急照明", cost: 1, effect: { kind: "check-bonus", amount: 1, targetMode: "one" } },
      { id: "aid-a", name: "现场急救", cost: 2, effect: { kind: "heal", amount: 2, targetMode: "one" } },
      { id: "aid-b", name: "现场急救", cost: 2, effect: { kind: "heal", amount: 2, targetMode: "one" } },
      { id: "pass-card", name: "维修通行证", cost: 1, effect: { kind: "gain-item", itemId: "maintenance-pass" } },
      { id: "radio-card", name: "广播联络", cost: 1, effect: { kind: "gain-item", itemId: "staff-radio" } },
      { id: "tool-a", name: "便携工具", cost: 1, effect: { kind: "check-bonus", amount: 1, targetMode: "one" } },
      { id: "tool-b", name: "便携工具", cost: 1, effect: { kind: "check-bonus", amount: 1, targetMode: "one" } },
    ],
    openingHandSize: 3,
    handLimit: 4,
    drawPerNodeEntry: 1,
  },
};
