import { describe, expect, it } from "vitest";
import { shortRouteNodes } from "../src/content/short-route.js";
import type { GameplayBRouteNode, GameplayBRouteView } from "../src/runtime.js";
import { GameplayBRouteRuntime } from "../src/runtime.js";

const openingBattle = shortRouteNodes.find((node) => node.kind === "battle");
const dangerousActivity = shortRouteNodes.find((node) => node.id === "node-7");

if (!openingBattle || openingBattle.kind !== "battle" || !dangerousActivity || dangerousActivity.kind !== "activity") {
  throw new Error("The short route is missing a required fixture node.");
}

const openingBattleNode = openingBattle;

function createInitialParty() {
  return openingBattleNode.battle.party.map((member) => ({
    roster: {
      id: member.definition.id,
      name: member.definition.name,
      row: member.definition.row,
      hpMax: member.definition.hpMax,
      initialHp: member.hp,
      atk: member.definition.atk,
      def: member.definition.def,
      activityTags: [],
    },
    battle: member.definition,
    hp: member.hp,
  }));
}

function clickUntilNode(runtime: GameplayBRouteRuntime, nodeId: string, maxClicks: number) {
  let view = runtime.getView();
  for (let count = 0; count < maxClicks && view.currentNode.id !== nodeId && !view.terminal; count += 1) {
    view = runtime.click();
  }
  return view;
}

describe("short route UI handoff contract", () => {
  it("runs the opening battle, Chise activity, dangerous activity, temporary battle, and exit one current action per Click", () => {
    const runtime = new GameplayBRouteRuntime({
      seed: "park-inspection-demo",
      nodes: shortRouteNodes,
      initialParty: createInitialParty(),
    });

    expect(runtime.getView().currentNode.id).toBe("node-5");
    let view = clickUntilNode(runtime, "node-6", 8);
    expect(view.terminal).toBe(false);
    expect(view.currentNode.id).toBe("node-6");
    expect(view.activityRemaining).toBe(1);
    expect(view.party.map((member) => member.id)).toContain("chise");
    expect(view.events.filter((event) => event.type === "character-joined" && event.actorId === "chise")).toHaveLength(1);
    expect(view.events.some((event) => event.nodeId === "node-6" && event.type === "activity-result")).toBe(false);

    const beforeCampClick = view;
    const hpBeforeCamp = new Map(view.party.map((member) => [member.id, member.hp]));
    view = runtime.click();
    expect(view.clickCount).toBe(beforeCampClick.clickCount + 1);
    expect(view.currentNode.id).toBe("node-7");
    expect(view.activityRemaining).toBe(2);
    expect(view.events.some((event) => event.nodeId === "node-7" && event.type === "activity-result")).toBe(false);
    for (const member of view.party) {
      const previousHp = hpBeforeCamp.get(member.id);
      if (previousHp !== undefined) expect(member.hp).toBeGreaterThanOrEqual(Math.min(member.hpMax, previousHp + 2));
    }

    view = runtime.click();
    expect(view.currentNode.id).toBe("node-7");
    expect(view.activityRemaining).toBe(1);
    const beforeNextBattleEntry = view;
    view = runtime.click();
    expect(view.clickCount).toBe(beforeNextBattleEntry.clickCount + 1);
    expect(view.terminal).toBe(false);
    expect(view.currentNode.id).toBe("node-9");
    expect(view.currentBattle?.clickCount).toBe(0);
    expect(view.currentBattle?.pendingRound?.round).toBe(1);
    expect(view.events.some((event) => event.nodeId === "node-9" && event.type === "battle-event")).toBe(false);
    expect(view.currentBattle?.pendingRound?.partyStartSCost.every((entry) => entry.value === 3)).toBe(true);

    const beforeNode9Battle = view.clickCount;
    view = clickUntilNode(runtime, "node-12", 8);
    expect(view.terminal).toBe(false);
    expect(view.currentNode.id).toBe("node-12");
    expect(view.clickCount).toBeGreaterThan(beforeNode9Battle);
    expect(view.currentBattle).toBeNull();
    expect(view.party.every((member) => member.currentBattleSCost === null)).toBe(true);
    const node9BattleEnd = view.events.findIndex((event) => event.nodeId === "node-9" && event.type === "battle-ended");
    const exitEntry = view.events.findIndex((event) => event.nodeId === "node-12" && event.type === "node-entered");
    expect(node9BattleEnd).toBeGreaterThanOrEqual(0);
    expect(exitEntry).toBeGreaterThan(node9BattleEnd);
    expect(view.events.map((event) => event.sequence)).toEqual(view.events.map((_, index) => index + 1));

    view = runtime.click();
    expect(view.terminal).toBe(true);
    expect(view.result).toBe("complete");
    const terminalView = view;
    expect(runtime.click()).toEqual(terminalView);
  });

  it("ends immediately when the current dangerous activity downs the whole party", () => {
    const routeNode: GameplayBRouteNode = dangerousActivity;
    const member = createInitialParty()[0]!;
    const initialParty = [{ ...member, hp: 1 }];
    let defeatView: GameplayBRouteView | null = null;
    for (let seed = 0; seed < 24 && !defeatView; seed += 1) {
      const runtime = new GameplayBRouteRuntime({ seed, nodes: [routeNode], initialParty });
      const candidate = runtime.click();
      if (candidate.terminal && candidate.result === "defeat") defeatView = candidate;
    }
    expect(defeatView).not.toBeNull();
    expect(defeatView?.currentNode.id).toBe("node-7");
    expect(defeatView?.party[0]?.hp).toBe(0);
    expect(defeatView?.events.at(-1)?.type).toBe("route-terminal");
  });
});
