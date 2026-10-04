import { describe, expect, it } from "vitest";
import type { BattleEnemyMember, EnemyIntentDefinition, OrdinaryBattleCardDefinition, RouteInitialPartyMember } from "../src/model.js";
import { parkInitialParty, parkRouteNodes } from "../src/content/park-route.js";
import { parkTextEntries } from "../src/content/texts.js";
import { validateParkRoute } from "../src/content/validate.js";
import { GameplayBRouteRuntime, type GameplayBRouteNode } from "../src/runtime.js";

const replaySeed = "park-inspection-demo";

interface ParkRoundTrace {
  readonly round: number;
  readonly startSCost: readonly { actorId: string; value: number }[];
  readonly intents: readonly { id: string; targetIds: readonly string[] }[];
}

interface ParkBattleTrace {
  startSCost?: readonly { actorId: string; value: number }[];
  readonly rounds: ParkRoundTrace[];
  readonly events: string[];
}

function route(nodes: readonly GameplayBRouteNode[] = parkRouteNodes, seed: number | string = "park-entry-test"): GameplayBRouteRuntime {
  return new GameplayBRouteRuntime({ nodes, initialParty: parkInitialParty, seed });
}

function playRoute(seed: number | string, maxClicks = 100) {
  const runtime = route(parkRouteNodes, seed);
  const battleRounds: Record<string, number> = {};
  const battleTrace: Record<string, ParkBattleTrace> = {};
  let view = runtime.getView();
  while (!view.terminal && view.clickCount < maxClicks) {
    const nodeId = view.currentNode.id;
    if (view.currentNode.kind === "battle" && view.currentBattle?.pendingRound) {
      battleRounds[nodeId] = (battleRounds[nodeId] ?? 0) + 1;
      const round = view.currentBattle.pendingRound;
      const encounter = battleTrace[nodeId] ??= { rounds: [], events: [] };
      if (round.round === 1) encounter.startSCost = round.partyStartSCost;
      encounter.rounds.push({ round: round.round, startSCost: round.partyStartSCost,
        intents: round.enemyIntents.map((intent) => ({ id: intent.intentId, targetIds: intent.targetIds })) });
      const eventCount = view.events.length;
      view = runtime.click();
      encounter.events.push(...view.events.slice(eventCount)
        .filter((event) => event.type === "battle-event").map((event) => event.text));
      continue;
    }
    view = runtime.click();
  }
  return { runtime, view, battleRounds, battleTrace };
}

function routeMember(
  id: string,
  hpMax: number,
  atk: number,
  cards: readonly OrdinaryBattleCardDefinition[] = [],
  aiPriority: RouteInitialPartyMember["battle"]["aiPriority"] = [],
): RouteInitialPartyMember {
  const definition = { id, name: id, row: "front" as const, hpMax, atk, def: 0, cards, aiPriority };
  return {
    roster: { id, name: id, row: "front", hpMax, initialHp: hpMax, atk, def: 0, activityTags: [] },
    battle: definition,
    hp: hpMax,
  };
}

function foe(id: string, hp: number, atk: number, intent: EnemyIntentDefinition): BattleEnemyMember {
  return { definition: { id, name: id, row: "front", hpMax: hp, atk, def: 0, intentPattern: [intent] }, hp };
}

function battleNode(id: string, enemy: BattleEnemyMember): GameplayBRouteNode {
  return { id, name: id, kind: "battle", battle: { encounterId: `${id}-encounter`, enemies: [enemy] } };
}

describe("park demo route entry", () => {
  it("starts at node one with the opening 2+2 roster and advances once into node two", () => {
    expect(validateParkRoute(parkRouteNodes)).toEqual([]);
    const runtime = route();
    const initial = runtime.getView();

    expect(initial).toMatchObject({ clickCount: 0, nodeCount: 12, currentNode: { id: "node-1", kind: "activity" } });
    expect(initial.party.map((member) => member.row)).toEqual(["front", "front", "back", "back"]);
    expect(initial.currentBattle).toBeNull();

    const after = runtime.click();
    expect(after).toMatchObject({ clickCount: 1, nodeIndex: 1, currentNode: { id: "node-2", kind: "activity" }, activityRemaining: 2 });
    expect(after.rngCursor).toBe(0);
  });

  it("keeps the second Node 2 summary accurate when the fixed seed discovers clues", () => {
    const runtime = route(parkRouteNodes, replaySeed);
    runtime.click();
    runtime.click();
    const previousEventCount = runtime.getView().events.length;
    const afterSecondSearch = runtime.click();
    const results = afterSecondSearch.events.slice(previousEventCount).filter((event) => event.type === "activity-result");
    const summary = parkTextEntries.find((entry) => entry.nodeId === "node-2" && entry.trigger === "activity-click" && entry.activityIndex === 2)?.text;

    expect(results.some((event) => event.success)).toBe(true);
    expect(summary).toContain("各项检定结果已记入日志");
    expect(summary).not.toMatch(/没有新发现|没有找到/);
  });

  it("enters node six and ten with five then six party members before each activity", () => {
    const campNodes = [
      parkRouteNodes.find((node) => node.id === "node-6")!,
      parkRouteNodes.find((node) => node.id === "node-10")!,
      parkRouteNodes.find((node) => node.id === "node-12")!,
    ];
    const runtime = route(campNodes, "park-camps-test");

    expect(runtime.getView().party.map((member) => member.id)).toEqual(["shiori", "yuri", "mei", "tsumugi", "chise"]);
    const afterNode6 = runtime.click();
    expect(afterNode6).toMatchObject({ clickCount: 1, currentNode: { id: "node-10" } });
    expect(afterNode6.party.map((member) => member.id)).toEqual(["shiori", "yuri", "mei", "tsumugi", "chise", "reina"]);
    const afterNode10 = runtime.click();
    expect(afterNode10).toMatchObject({ clickCount: 2, currentNode: { id: "node-12", kind: "exit" }, terminal: false });
  });

  it("resolves one displayed battle round and leaves the next round pending", () => {
    const battle = parkRouteNodes.find((node) => node.id === "node-5")!;
    const nextActivity = parkRouteNodes.find((node) => node.id === "node-6")!;
    const runtime = route([battle, nextActivity], "park-first-battle-test");
    expect(runtime.getView().currentBattle?.pendingRound?.round).toBe(1);

    const after = runtime.click();
    expect(after.clickCount).toBe(1);
    expect(after.currentNode.id).toBe("node-5");
    expect(after.currentBattle?.lastResolution?.prepared.round).toBe(1);
    expect(after.currentBattle?.pendingRound?.round).toBe(2);
    expect(after.currentBattle?.clickCount).toBe(1);
  });
});

describe("canonical twelve-node replay", () => {
  it("replays the complete route with the audited battle rounds, recruits, intents, and 26 Clicks", () => {
    const first = playRoute(replaySeed);
    const replay = playRoute(replaySeed);
    const { view, battleRounds, battleTrace } = first;

    expect({ view, battleRounds, battleTrace }).toEqual({ view: replay.view, battleRounds: replay.battleRounds, battleTrace: replay.battleTrace });
    expect(view).toMatchObject({ seed: replaySeed, clickCount: 26, nodeIndex: 11, nodeCount: 12,
      currentNode: { id: "node-12", kind: "exit" }, result: "complete", terminal: true });
    expect(view.events.filter((event) => event.type === "node-entered").map((event) => event.nodeId))
      .toEqual(parkRouteNodes.map((node) => node.id));
    expect(view.events.filter((event) => event.type === "activity-progress")).toHaveLength(10);
    expect(view.events.filter((event) => event.type === "route-terminal" && event.nodeId === "node-12")).toHaveLength(1);
    expect(view.events.find((event) => event.type === "route-terminal")?.text)
      .toBe("巡查行动结束。支援人员接手现场，游园会恢复正常。");
    expect(view.events.filter((event) => event.type === "battle-ended").map((event) => [event.nodeId, event.text]))
      .toEqual([["node-5", "战斗结束：victory。"], ["node-9", "战斗结束：victory。"], ["node-11", "战斗结束：victory。"]]);
    expect(battleRounds).toEqual({ "node-5": 4, "node-9": 5, "node-11": 6 });
    expect(Object.values(battleRounds).reduce((total, rounds) => total + rounds, 0)).toBe(15);
    expect(10 + 1 + Object.values(battleRounds).reduce((total, rounds) => total + rounds, 0)).toBe(view.clickCount);
    expect(view.party.map((member) => member.id)).toEqual(["shiori", "yuri", "mei", "tsumugi", "chise", "reina"]);
    expect(view.party.every((member) => member.currentBattleSCost === null)).toBe(true);
    expect(first.runtime.click()).toEqual(view);

    expect(battleTrace["node-5"]?.startSCost?.map((entry) => entry.value)).toEqual([2, 2, 2, 2]);
    expect(battleTrace["node-9"]?.startSCost?.map((entry) => entry.value)).toEqual([3, 3, 3, 3, 3]);
    expect(battleTrace["node-11"]?.rounds[1]?.startSCost.map((entry) => entry.value)).toEqual([3, 3, 5, 5, 5, 2]);

    const fireworksReload = battleTrace["node-9"]?.rounds[1]?.intents.find((intent) => intent.id === "fireworks-reload");
    expect(fireworksReload?.targetIds).toEqual([]);
    expect(battleTrace["node-9"]?.events).toContain("烟花手 · 装填：本轮无伤害。");
    expect(battleTrace["node-9"]?.events.some((event) => event.includes("temporary-leader: HP 12→10"))).toBe(true);
    expect(battleTrace["node-9"]?.rounds[1]?.intents[0]?.id).toBe("temporary-leader-reactive-charge");

    const bossWave = battleTrace["node-11"]?.rounds[2]?.intents.find((intent) => intent.id === "red-mask-fireworks");
    expect(bossWave?.targetIds).toEqual(["shiori", "yuri", "chise", "reina", "tsumugi"]);
    expect(battleTrace["node-11"]?.events).toContain("红面具领队 · 烟花齐放：对 小栞、由理、千世、玲奈、纺希 各结算固定 1 点伤害。");
  });

  it("records a deterministic failed battle and leaves its terminal view unchanged", () => {
    const lethalIntent: EnemyIntentDefinition = { id: "lethal-shot", name: "致命一击", tags: ["sniper"],
      effect: { kind: "attack", target: { kind: "all", side: "ally", row: "front" } } };
    const runtime = new GameplayBRouteRuntime({ seed: "park-defeat-fixture",
      nodes: [battleNode("node-5-defeat", foe("strong-foe", 5, 2, lethalIntent))],
      initialParty: [routeMember("last-student", 1, 0)] });

    const defeated = runtime.click();
    expect(defeated).toMatchObject({ clickCount: 1, terminal: true, result: "defeat", currentNode: { id: "node-5-defeat" } });
    expect(defeated.events.filter((event) => event.type === "battle-ended").map((event) => event.text)).toEqual(["战斗结束：defeat。"]);
    expect(runtime.click()).toEqual(defeated);
  });

  it("records a same-round mutual knockout as a draw and leaves its terminal view unchanged", () => {
    const tradeCard: OrdinaryBattleCardDefinition = { id: "trade-strike", name: "同归冲锋", cost: 1, tags: ["charge"],
      effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } };
    const mutualIntent: EnemyIntentDefinition = { id: "mutual-hit", name: "迎面冲撞", tags: ["charge"],
      effect: { kind: "attack", target: { kind: "all", side: "ally", row: "front" } } };
    const runtime = new GameplayBRouteRuntime({ seed: "park-draw-fixture",
      nodes: [battleNode("node-5-draw", foe("last-foe", 1, 1, mutualIntent))],
      initialParty: [routeMember("last-student", 1, 2, [tradeCard], [{ cardId: tradeCard.id, condition: { kind: "always" }, holdCost: 0 }])] });

    const drawn = runtime.click();
    expect(drawn).toMatchObject({ clickCount: 1, terminal: true, result: "draw", currentNode: { id: "node-5-draw" } });
    expect(drawn.events.filter((event) => event.type === "battle-ended").map((event) => event.text)).toEqual(["战斗结束：draw。"]);
    expect(runtime.click()).toEqual(drawn);
  });
});
