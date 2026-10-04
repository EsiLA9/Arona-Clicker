import { describe, expect, it } from "vitest";
import { GameplayBRouteRuntime } from "../src/runtime.js";
import { parkGraphRouteInput, parkGraphRouteNodes } from "../src/content/park-graph-route.js";
import { describeRouteExit, playerCardInstanceLabel, playerCardSelectionSummary, playerCardTargetSelectionReady, projectIndividualBehaviorRow, projectPlayerCardTargetDraft, projectPlayerCostDock, projectRouteMapSummary, projectTraversedRouteEdgeKeys, summarizePlayerCard, summarizeSceneBehavior } from "../src/view.js";

describe("route map presentation", () => {
  it("summarizes the entered route and current wait without exposing structural links as choices", () => {
    const initial = new GameplayBRouteRuntime(parkGraphRouteInput).getView();
    const view = {
      ...initial,
      sceneChoice: null,
      nodeVisitCounts: { ...initial.nodeVisitCounts, "node-1": 1, "node-2": 1, "node-4": 2 },
      currentNode: { id: "node-4", name: "代币电玩馆", kind: "activity" as const, area: "地面园区" },
      events: [
        { ...initial.events[0]!, type: "node-entered" as const, nodeId: "node-1" },
        { ...initial.events[0]!, type: "node-entered" as const, nodeId: "node-2" },
        { ...initial.events[0]!, type: "node-entered" as const, nodeId: "node-4" },
        { ...initial.events[0]!, type: "node-entered" as const, nodeId: "node-4" },
      ],
    };

    expect(projectRouteMapSummary(view, parkGraphRouteNodes)).toContain("当前位置：代币电玩馆 ×2");
    expect(projectRouteMapSummary(view, parkGraphRouteNodes)).toContain("西门临时执勤点 → 林荫连廊 → 代币电玩馆 → 代币电玩馆");
    expect(projectRouteMapSummary(view, parkGraphRouteNodes)).toContain("等待场景推进");
    expect(projectRouteMapSummary(view, parkGraphRouteNodes)).not.toContain("开放出口");
  });

  it("describes every returned exit with its destination and actual item consumption", () => {
    const maze = parkGraphRouteNodes.find((node) => node.id === "node-7")!;
    const exits = maze.exits!.map((definition) => ({
      id: definition.id,
      label: definition.label,
      targetNodeId: definition.targetNodeId,
    }));
    expect(exits).toHaveLength(4);
    expect(exits.map((exit) => describeRouteExit(exit, parkGraphRouteNodes))).toEqual([
      "返回电玩馆 → 代币电玩馆 · 不消耗持有物",
      "前往失控碰碰车区 → 失控碰碰车区 · 不消耗持有物",
      "前往急救补给站 → 急救补给站 · 不消耗持有物",
      "前往摩天轮检修廊 → 摩天轮检修廊 · 不消耗持有物",
    ]);

    const passExit = parkGraphRouteNodes.find((node) => node.id === "node-13")!.exits!.find((exit) => exit.id === "control-to-stage-pass")!;
    expect(describeRouteExit(passExit, parkGraphRouteNodes, { "maintenance-pass": "维修通行证" }))
      .toBe("持维修通行证前往设备井 → 中央舞台设备井 · 消耗：维修通行证");
  });

  it("does not highlight a parallel route when visit history only identifies its endpoints", () => {
    expect(projectTraversedRouteEdgeKeys(parkGraphRouteNodes, ["node-13", "node-11"]))
      .not.toContain("node-13→node-11");
    expect(projectTraversedRouteEdgeKeys(parkGraphRouteNodes, ["node-1", "node-2"]))
      .toContain("node-1→node-2");
  });

  it("summarizes current content effects, card copies, and explicit target readiness", () => {
    const arcadeSearch = parkGraphRouteNodes.find((node) => node.id === "node-4")!;
    const behavior = arcadeSearch.kind === "activity" ? arcadeSearch.sceneChoices!.behaviors[0]! : undefined;
    expect(summarizeSceneBehavior(behavior!, { "maintenance-pass": "维修通行证" }))
      .toContain("d6 + ATK 对抗 6；成功：找到维修通行证；它可以打开员工设备通道。；未达：抽屉已空。");
    expect(summarizeSceneBehavior(behavior!, { "maintenance-pass": "维修通行证" })).toContain("成功时获得维修通行证");
    expect(projectIndividualBehaviorRow(undefined)).toEqual({ state: "待选", summary: "先为该角色选择本批行为。" });
    expect(projectIndividualBehaviorRow(behavior!, { "maintenance-pass": "维修通行证" })).toMatchObject({
      state: "已选",
      summary: expect.stringContaining("搜索维修抽屉 · 1 Cost · d6 + ATK 对抗 6"),
    });

    const deck = parkGraphRouteInput.playerDeck!;
    const lightA = deck.cards.find((card) => card.id === "light-a")!;
    const lightB = deck.cards.find((card) => card.id === "light-b")!;
    expect(playerCardInstanceLabel(lightA, 0)).toBe("紧急照明 #A");
    expect(playerCardInstanceLabel(lightB, 1)).toBe("紧急照明 #B");
    expect(summarizePlayerCard(lightA)).toBe("选择一名角色的检定 +1");
    const passCard = deck.cards.find((card) => card.id === "pass-card")!;
    expect(playerCardSelectionSummary(passCard, [])).toBe("已选入本批 · 无需角色目标");
    expect(playerCardSelectionSummary(lightA, ["shiori"], { shiori: "小栞" })).toBe("已确认目标：小栞");
    expect(playerCardTargetSelectionReady("one", [])).toBe(false);
    expect(playerCardTargetSelectionReady("one", ["shiori"])).toBe(true);
    expect(playerCardTargetSelectionReady("many", [])).toBe(false);
    expect(playerCardTargetSelectionReady("many", ["shiori", "yuri"])).toBe(true);
    const drafts = new Map<string, readonly string[]>();
    expect(projectPlayerCardTargetDraft(lightA.id, drafts)).toBeNull();
    drafts.set(lightA.id, []);
    expect(projectPlayerCardTargetDraft(lightA.id, drafts)).toEqual({ selectedIds: [] });
    drafts.set(lightA.id, ["shiori"]);
    expect(projectPlayerCardTargetDraft(lightA.id, drafts)).toEqual({ selectedIds: ["shiori"] });
  });
});

describe("player Cost action dock", () => {
  it("marks the selected fee inside the single held Cost slot preview", () => {
    expect(projectPlayerCostDock(6, 2)).toEqual({ heldCost: 6, consumingCost: 2, afterClickCost: 4, afterClickLabel: "4", state: "ready" });
    expect(projectPlayerCostDock(4, 0)).toEqual({ heldCost: 4, consumingCost: 0, afterClickCost: 4, afterClickLabel: "4", state: "ready" });
  });

  it("marks tentative consumption while withholding the balance until choices and targets are confirmed", () => {
    expect(projectPlayerCostDock(6, 3, "needs-choice")).toMatchObject({ consumingCost: 3, afterClickCost: null, afterClickLabel: "待选择", state: "needs-choice" });
    expect(projectPlayerCostDock(6, 3, "needs-target")).toMatchObject({ consumingCost: 3, afterClickCost: null, afterClickLabel: "待确认", state: "needs-target" });
  });

  it("does not animate unaffordable fees or invent a balance while no Click is available", () => {
    expect(projectPlayerCostDock(1, 3)).toMatchObject({ consumingCost: 0, afterClickCost: null, afterClickLabel: "不足 2", state: "insufficient" });
    expect(projectPlayerCostDock(1, 3, "needs-target")).toMatchObject({ consumingCost: 0, afterClickCost: null, afterClickLabel: "不足 2", state: "insufficient" });
    expect(projectPlayerCostDock(5, 0, "awaiting-exit")).toMatchObject({ consumingCost: 0, afterClickCost: null, afterClickLabel: "先选出口", state: "awaiting-exit" });
    expect(projectPlayerCostDock(2, 0, "terminal")).toMatchObject({ consumingCost: 0, afterClickCost: null, afterClickLabel: "已结束", state: "terminal" });
  });
});
