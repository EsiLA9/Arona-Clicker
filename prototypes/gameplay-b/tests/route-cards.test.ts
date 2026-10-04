import { describe, expect, it } from "vitest";
import type { RouteEventRecord, RoutePartyView } from "../src/model.js";
import type { GameplayBRouteNode } from "../src/runtime.js";
import { overlappingFanCardCurve, projectRouteActivityCards, relationEdgePoint } from "../src/view.js";

type ActivityNode = Extract<GameplayBRouteNode, { kind: "activity" }>;

const partyMember = (id: string, hp: number): RoutePartyView => ({
  id, name: id.toUpperCase(), row: "front", hp, hpMax: 10, atk: 5, def: 1, activityTags: [], currentBattleSCost: null,
});

const activityNode = (id: string, fixedEffects: ActivityNode["activity"]["fixedEffects"] = []): ActivityNode => ({
  id, name: id, kind: "activity", activityCount: 1,
  activity: {
    locationId: `location-${id}`, fixedEffects,
    individualCheck: { kind: "chance", dieSides: 4, outcomes: {
      1: { success: true, outcome: { kind: "clue", text: "发现线索。" } },
      2: { success: false, outcome: { kind: "none", text: "没有发现。" } },
      3: { success: true, outcome: { kind: "effect", text: "恢复 1 点 HP。", effect: { kind: "heal", amount: 1 } } },
      4: { success: false, outcome: { kind: "none", text: "没有发现。" } },
    } },
  },
});

const routeEvent = (overrides: Partial<RouteEventRecord> & Pick<RouteEventRecord, "sequence" | "click" | "nodeId" | "locationId" | "type" | "text">): RouteEventRecord => overrides;

describe("route activity cards", () => {
  it("shows personal exploration intents and declared group effects before Click", () => {
    const node = activityNode("service-kiosk", [{ kind: "heal-party", amount: 1, text: "全队恢复 1 点 HP。" }]);
    const batch = projectRouteActivityCards({
      currentNode: { id: node.id, name: node.name, kind: "activity" }, clickCount: 0,
      events: [routeEvent({ sequence: 1, click: 0, nodeId: node.id, locationId: node.id, type: "node-entered", text: "进入场所。" })],
      party: [partyMember("shiori", 8), partyMember("yuri", 0)], activityNode: node,
    });

    expect(batch?.cards.filter((card) => card.kind === "exploration-intent")).toHaveLength(2);
    expect(batch?.cards.find((card) => card.kind === "exploration-intent" && card.actorId === "yuri")).toMatchObject({ detail: "d4 · 待探索" });
    const locationEffect = batch?.cards.find((card) => card.placement === "field");
    expect(locationEffect).toMatchObject({ title: "场所效果", description: "全队恢复 1 点 HP。", detail: "待本次 Click · 全队" });
    expect(batch?.relations).toContainEqual({ from: locationEffect?.id, to: "character:shiori", kind: "effect-target" });
    expect(batch?.relations).toContainEqual({ from: locationEffect?.id, to: "character:yuri", kind: "effect-target" });
    expect(batch?.relations).toContainEqual({ from: "exploration-intent:service-kiosk:0:shiori", to: "location:location-service-kiosk", kind: "exploration-target" });
  });

  it("does not preview an individual check for an unhealed downed character", () => {
    const node = activityNode("dark-ride");
    const batch = projectRouteActivityCards({
      currentNode: { id: node.id, name: node.name, kind: "activity" }, clickCount: 0, events: [],
      party: [partyMember("shiori", 0), partyMember("yuri", 8)], activityNode: node,
    });

    expect(batch?.cards.filter((card) => card.kind === "exploration-intent").map((card) => card.actorId)).toEqual(["yuri"]);
  });

  it("projects only current-Click results and points actual effects at the affected character", () => {
    const node = activityNode("arcade");
    const events = [
      routeEvent({ sequence: 1, click: 3, nodeId: node.id, locationId: node.activity.locationId, type: "activity-result", actorId: "shiori", dice: { sides: 4, value: 3 }, outcome: "effect", success: true, text: "SHIORI：恢复 1 点 HP。" }),
      routeEvent({ sequence: 2, click: 3, nodeId: node.id, locationId: node.activity.locationId, type: "activity-result", actorId: "yuri", dice: { sides: 4, value: 2 }, outcome: "none", success: false, text: "YURI：没有发现。" }),
      routeEvent({ sequence: 3, click: 3, nodeId: node.id, locationId: node.id, type: "activity-progress", text: "本次活动完成。" }),
      routeEvent({ sequence: 4, click: 2, nodeId: node.id, locationId: node.activity.locationId, type: "activity-result", actorId: "mei", dice: { sides: 4, value: 1 }, outcome: "clue", success: true, text: "MEI：发现线索。" }),
    ];
    const batch = projectRouteActivityCards({
      currentNode: { id: node.id, name: node.name, kind: "activity" }, clickCount: 3, events,
      party: [partyMember("shiori", 8), partyMember("yuri", 8)], activityNode: node,
    });

    expect(batch?.id).toBe("route:arcade:3:resolved");
    expect(batch?.cards.filter((card) => card.kind === "exploration-result")).toHaveLength(2);
    expect(batch?.cards.find((card) => card.actorId === "shiori" && card.kind === "exploration-result"))
      .toMatchObject({ description: "恢复 1 点 HP。", detail: "d4 · 3 · 效果结算" });
    const locationEffect = batch?.cards.find((card) => card.placement === "field");
    expect(locationEffect).toMatchObject({ description: "恢复 1 点 HP。", detail: "已结算 · 单人" });
    expect(batch?.relations).toContainEqual({ from: locationEffect?.id, to: "character:shiori", kind: "effect-target" });
    expect(batch?.relations).not.toContainEqual({ from: locationEffect?.id, to: "character:yuri", kind: "effect-target" });
    expect(batch?.relations).toContainEqual({ from: "exploration-result:arcade:3:1", to: "location:location-arcade", kind: "exploration-target" });
    expect(batch?.cards.some((card) => card.actorId === "mei")).toBe(false);
  });

  it("does not draw results for a prior click when an activity node is awaiting its first Click", () => {
    const node = activityNode("next-node");
    const batch = projectRouteActivityCards({
      currentNode: { id: node.id, name: node.name, kind: "activity" }, clickCount: 4,
      events: [routeEvent({ sequence: 1, click: 3, nodeId: "previous-node", locationId: "old-location", type: "activity-result", actorId: "shiori", outcome: "clue", success: true, text: "SHIORI：发现线索。" })],
      party: [partyMember("shiori", 8)], activityNode: node,
    });

    expect(batch?.id).toBe("route:next-node:4:prepared");
    expect(batch?.cards.map((card) => card.kind)).toEqual(["exploration-intent"]);
    expect(batch?.relations).toContainEqual({ from: "exploration-intent:next-node:4:shiori", to: "location:location-next-node", kind: "exploration-target" });
  });

  it("does not target characters who joined after a fixed effect already resolved", () => {
    const next = activityNode("next-node");
    const effectId = "location-effect:previous-node:5:10";
    const batch = projectRouteActivityCards({
      currentNode: { id: next.id, name: next.name, kind: "activity" }, clickCount: 5,
      events: [
        routeEvent({ sequence: 10, click: 5, nodeId: "previous-node", locationId: "previous-place", type: "activity-fixed-effect", text: "全队恢复 2 点 HP。" }),
        routeEvent({ sequence: 11, click: 5, nodeId: "previous-node", locationId: "previous-place", type: "activity-progress", text: "活动完成。" }),
        routeEvent({ sequence: 12, click: 5, nodeId: next.id, locationId: next.id, type: "character-joined", actorId: "chise", text: "千世加入队伍。" }),
      ],
      party: [partyMember("shiori", 8), partyMember("yuri", 8), partyMember("chise", 10)], activityNode: next,
    });

    expect(batch?.relations).toContainEqual({ from: effectId, to: "character:shiori", kind: "effect-target" });
    expect(batch?.relations).toContainEqual({ from: effectId, to: "character:yuri", kind: "effect-target" });
    expect(batch?.relations).not.toContainEqual({ from: effectId, to: "character:chise", kind: "effect-target" });
    expect(batch?.cards.find((card) => card.id === effectId)).toMatchObject({ title: "上一处效果" });
  });

  it("finds the rectangle boundary toward the opposite center instead of using a fixed side midpoint", () => {
    const rect = { left: 0, top: 0, width: 100, height: 50 };

    expect(relationEdgePoint(rect, { x: 200, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(relationEdgePoint(rect, { x: 50, y: 150 })).toEqual({ x: 50, y: 50 });
    expect(relationEdgePoint(rect, { x: 200, y: 100 })).toEqual({ x: 100, y: 50 });
  });

  it("routes a link around the exposed edges when same-character fan cards overlap", () => {
    const source = { left: 170, top: 100, width: 112, height: 62 };
    const target = { left: 151, top: 100, width: 112, height: 62 };
    const curve = overlappingFanCardCurve(source, target);

    expect(curve).toEqual({
      start: { x: 282, y: 131 },
      controlOne: { x: 310, y: 82 },
      controlTwo: { x: 123, y: 82 },
      end: { x: 151, y: 131 },
    });
    expect(overlappingFanCardCurve(source, { left: 300, top: 100, width: 112, height: 62 })).toBeNull();
  });
});
