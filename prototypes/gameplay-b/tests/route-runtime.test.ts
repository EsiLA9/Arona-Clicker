import { describe, expect, it } from "vitest";
import type { BattleEnemyMember, BattlePreparationInput, OrdinaryBattleCardDefinition, RouteInitialPartyMember } from "../src/model.js";
import { GameplayBRouteRuntime, type GameplayBRouteExit, type GameplayBRouteNode, type GameplayBRouteRuntimeInput } from "../src/runtime.js";
import { chiseContent, shortRouteNodes } from "../src/content/short-route.js";

const strike: OrdinaryBattleCardDefinition = {
  id: "test-strike", name: "攻击", cost: 1, tags: ["attack"],
  effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } },
};
function member(id: string, hp: number, hpMax = 10, attacks = false): RouteInitialPartyMember {
  return { roster: { id, name: id, row: "front", hpMax, initialHp: hpMax, atk: 10, def: 0, activityTags: [] },
    battle: { id, name: id, row: "front", hpMax, atk: 10, def: 0, cards: attacks ? [strike] : [],
      aiPriority: attacks ? [{ cardId: strike.id, condition: { kind: "always" }, holdCost: 0 }] : [] }, hp };
}
const enemy = (id: string, hp = 1, atk = 0, intentPattern: BattleEnemyMember["definition"]["intentPattern"] = []): BattleEnemyMember =>
  ({ definition: { id, name: id, row: "front", hpMax: hp, atk, def: 0, intentPattern }, hp });
const battle = (id: string, foe: BattleEnemyMember = enemy(`foe-${id}`)): BattlePreparationInput =>
  ({ encounterId: `encounter-${id}`, round: 1, party: [], enemies: [foe] });
const battleNode = (id: string, foe?: BattleEnemyMember): Extract<GameplayBRouteNode, { kind: "battle" }> =>
  ({ id, name: id, kind: "battle", battle: battle(id, foe) });
const runInput = (nodes: readonly GameplayBRouteNode[], initialParty: readonly RouteInitialPartyMember[], seed: number | string = 12): GameplayBRouteRuntimeInput =>
  ({ nodes, initialParty, seed });
function graphActivity(id: string, exits: readonly GameplayBRouteExit[], maxVisits = 1): Extract<GameplayBRouteNode, { kind: "activity" }> {
  return { id, name: id, kind: "activity", activityCount: 1, activity: { locationId: `${id}-activity`, fixedEffects: [] },
    exits, maxVisits, costGain: 0, maxCarryCost: 99, noAvailableExitText: `${id}没有可用出口，队伍撤离。` };
}
function graphExit(id: string): Extract<GameplayBRouteNode, { kind: "exit" }> {
  return { id, name: id, kind: "exit", completionText: `${id}完成。`, exits: [], maxVisits: 1, costGain: 0, maxCarryCost: 99 };
}
const chanceActivity = {
  locationId: "activity-id-distinct-from-node", fixedEffects: [{ kind: "heal-party" as const, amount: 1, text: "恢复 1 点 HP。" }],
  individualCheck: { kind: "chance" as const, dieSides: 2, outcomes: {
    1: { success: true, outcome: { kind: "clue" as const, text: "发现线索。" } },
    2: { success: false, outcome: { kind: "none" as const, text: "没有发现。" } },
  } },
};

describe("Gameplay B Route Runtime core", () => {
  it("accepts the U1 short-route content table as generic nodes", () => {
    const nodes: readonly GameplayBRouteNode[] = shortRouteNodes;
    expect(nodes.map((node) => node.id)).toEqual(["node-5", "node-6", "node-7", "node-9", "node-12"]);
  });

  it("ends before first-node entry effects when the initial party is fully down", () => {
    const opening: GameplayBRouteNode = {
      id: "opening", name: "急救站", kind: "activity", activityCount: 1,
      activity: { locationId: "opening-aid", fixedEffects: [{ kind: "heal-party", amount: 5, text: "恢复 5 点 HP。" }] },
      onEnter: [{ kind: "join-character", character: chiseContent }],
    };
    const runtime = new GameplayBRouteRuntime(runInput([opening], [member("down", 0)]));
    const initial = runtime.getView();

    expect(initial).toMatchObject({ clickCount: 0, terminal: true, result: "defeat", currentNode: { id: "opening" },
      activityRemaining: null, currentBattle: null });
    expect(initial.party.map((character) => [character.id, character.hp])).toEqual([["down", 0]]);
    expect(initial.events.map((event) => event.type)).toEqual(["route-terminal"]);
    expect(initial.events[0]?.text).toBe("全队倒地，路线立即结束。");
    expect(runtime.click()).toEqual(initial);
  });

  it("starts from an explicit roster, joins before activity, revives rollers in roster order, and only prepares the next node", () => {
    const runtime = new GameplayBRouteRuntime(runInput([
      { id: "node-6-custom", name: "急救站", kind: "activity", activityCount: 1, activity: chanceActivity,
        onEnter: [{ kind: "join-character", character: chiseContent }] },
      battleNode("node-9-custom"),
    ], [member("down", 0), member("awake", 2)], "activity-seed"));
    const before = runtime.getView();
    expect(before.party.map((c) => c.id)).toEqual(["down", "awake", "chise"]);
    expect(before.events.filter((e) => e.type === "character-joined")).toHaveLength(1);
    expect(runtime.getView()).toEqual(before);
    const after = runtime.click();
    expect(after).toMatchObject({ currentNode: { id: "node-9-custom", kind: "battle" }, rngCursor: 3 });
    expect(after.events.filter((e) => e.type === "activity-result").map((e) => e.actorId)).toEqual(["down", "awake", "chise"]);
    expect(after.party.find((c) => c.id === "down")?.hp).toBe(1);
    expect(after.currentBattle).toMatchObject({ clickCount: 0, pendingRound: { round: 1 } });
  });

  it("replays the activity stream and derives different stable battle seeds by route node", () => {
    const nodes: GameplayBRouteNode[] = [
      { id: "activity", name: "活动", kind: "activity", activityCount: 1, activity: { ...chanceActivity, fixedEffects: [] } },
      battleNode("battle-a"), battleNode("battle-b"),
    ];
    const play = () => {
      const runtime = new GameplayBRouteRuntime(runInput(nodes, [member("attacker", 8, 10, true)], "repeatable"));
      const start = runtime.getView();
      expect(runtime.getView()).toEqual(start);
      runtime.click();
      const seedA = runtime.getView().currentBattle!.seed;
      runtime.click();
      const seedB = runtime.getView().currentBattle!.seed;
      expect(seedA).not.toBe(seedB);
      return runtime.getView();
    };
    expect(play()).toEqual(play());
  });

  it("carries battle HP into the next activity and applies its fixed healing to that value", () => {
    const damagingFoe = enemy("chip-foe", 1, 3, [{ id: "chip", name: "冲撞", tags: ["charge"],
      effect: { kind: "attack", target: { kind: "all", side: "ally", row: "front" } } }]);
    const next = battleNode("after-heal");
    const runtime = new GameplayBRouteRuntime(runInput([
      battleNode("first", damagingFoe),
      { id: "medical-node", name: "医疗点", kind: "activity", activityCount: 1,
        activity: { locationId: "different-location-id", fixedEffects: [{ kind: "heal-party", amount: 2, text: "恢复 2 HP。" }] } },
      next,
    ], [member("striker", 8, 10, true)]));
    const afterBattle = runtime.click();
    const carriedHp = afterBattle.party[0]!.hp;
    expect(afterBattle.currentNode.id).toBe("medical-node");
    expect(carriedHp).toBeLessThan(8);
    const afterActivity = runtime.click();
    expect(afterActivity.currentNode.id).toBe("after-heal");
    expect(afterActivity.party[0]?.hp).toBe(Math.min(10, carriedHp + 2));
    expect(afterActivity.currentBattle?.clickCount).toBe(0);
  });

  it("ends immediately on activity all-down and keeps terminal clicks idempotent", () => {
    const dangerous: GameplayBRouteNode = { id: "danger", name: "危险活动", kind: "activity", activityCount: 2,
      activity: { locationId: "danger-location", fixedEffects: [], individualCheck: { kind: "chance", dieSides: 2, outcomes: {
        1: { success: false, outcome: { kind: "effect", text: "受伤。", effect: { kind: "damage", amount: 1 } } },
        2: { success: false, outcome: { kind: "effect", text: "受伤。", effect: { kind: "damage", amount: 1 } } },
      } } } };
    const runtime = new GameplayBRouteRuntime(runInput([dangerous, battleNode("must-not-enter")], [member("last-member", 1, 10)], 1));
    const defeated = runtime.click();
    expect(defeated).toMatchObject({ terminal: true, result: "defeat", nodeIndex: 0, currentNode: { id: "danger" } });
    expect(defeated.events.at(-1)?.type).toBe("route-terminal");
    expect(runtime.click()).toEqual(defeated);
  });

  it("filters graph exits by nested possession conditions and consumes items only when the selected edge commits", () => {
    const nodes: GameplayBRouteNode[] = [
      graphExit("ordinary-route"),
      graphActivity("junction", [
        { id: "fallback", label: "走后台", targetNodeId: "ordinary-route" },
        { id: "staff-tunnel", label: "走员工通道", targetNodeId: "quick-route",
          condition: { kind: "all", conditions: [
            { kind: "has-item", itemId: "maintenance-pass" },
            { kind: "any", conditions: [
              { kind: "has-item", itemId: "staff-radio" },
              { kind: "not", condition: { kind: "has-item", itemId: "route-sealed" } },
            ] },
          ] }, consumeItems: ["maintenance-pass"] },
      ]),
      graphExit("quick-route"),
    ];
    const party = [member("scout", 10)];
    const withoutPass = new GameplayBRouteRuntime({ ...runInput(nodes, party), startNodeId: "junction" });
    const pending = withoutPass.click();
    expect(pending).toMatchObject({ awaitingExitChoice: true, currentNode: { id: "junction" },
      availableExits: [{ id: "fallback", targetNodeId: "ordinary-route" }] });
    expect(withoutPass.click()).toEqual(pending);
    expect(withoutPass.chooseExit("staff-tunnel")).toMatchObject({ ok: false });
    expect(withoutPass.getView()).toEqual(pending);

    const withPass = new GameplayBRouteRuntime({ ...runInput(nodes, party), startNodeId: "junction",
      initialItems: ["maintenance-pass", "staff-radio"] });
    withPass.click();
    expect(withPass.getView().availableExits.map((exit) => exit.id)).toEqual(["fallback", "staff-tunnel"]);
    expect(withPass.getView().heldItems).toEqual(["maintenance-pass", "staff-radio"]);
    expect(withPass.chooseExit("staff-tunnel")).toEqual({ ok: true });
    expect(withPass.getView()).toMatchObject({ currentNode: { id: "quick-route" }, heldItems: ["staff-radio"],
      nodeVisitCounts: { junction: 1, "quick-route": 1 } });
    expect(withPass.getView().events.filter((event) => event.type === "exit-item-consumed")).toHaveLength(1);
    expect(withPass.getView().events.slice(-3).map((event) => event.type)).toEqual([
      "exit-chosen", "exit-item-consumed", "node-entered",
    ]);

    const negatedBranch = new GameplayBRouteRuntime({ ...runInput(nodes, party), startNodeId: "junction", initialItems: ["maintenance-pass"] });
    negatedBranch.click();
    expect(negatedBranch.getView().availableExits.map((exit) => exit.id)).toContain("staff-tunnel");
    const sealedBranch = new GameplayBRouteRuntime({ ...runInput(nodes, party), startNodeId: "junction",
      initialItems: ["maintenance-pass", "route-sealed"] });
    sealedBranch.click();
    expect(sealedBranch.getView().availableExits.map((exit) => exit.id)).toEqual(["fallback"]);
  });

  it("resolves one individual behavior per living character as a single Cost-paid batch", () => {
    const nodes: GameplayBRouteNode[] = [
      { ...graphActivity("inspection", [{ id: "to-exit", label: "离开检查区", targetNodeId: "handover" }], 1),
        costGain: 3, maxCarryCost: 0,
        sceneChoices: { mode: "individual", behaviors: [
          { id: "rest", label: "短暂休息", cost: 1,
            activity: { locationId: "rest-choice", fixedEffects: [{ kind: "heal-party", amount: 1, text: "稍作休息。" }] } },
          { id: "search", label: "搜索设备柜", cost: 2, successItems: ["maintenance-pass"],
            activity: { locationId: "search-choice", fixedEffects: [], individualCheck: { kind: "attribute", dieSides: 1,
              attribute: "atk", difficulty: 1, success: { kind: "clue", text: "找到维修通行证。" },
              failure: { kind: "none", text: "没有找到通行证。" } } } },
        ] } },
      graphExit("handover"),
    ];
    const runtime = new GameplayBRouteRuntime({ ...runInput(nodes, [member("first", 5), member("second", 5), member("down", 0)]),
      startNodeId: "inspection", initialPlayerCost: 1 });
    expect(runtime.getView()).toMatchObject({ playerCost: 4, sceneChoice: { mode: "individual", requiredActorIds: ["first", "second"] } });
    const initialRng = runtime.getView().rngCursor;
    expect(runtime.selectIndividualBehavior("down", "rest").ok).toBe(false);
    expect(runtime.selectIndividualBehavior("second", "search")).toEqual({ ok: true });
    expect(runtime.selectIndividualBehavior("first", "rest")).toEqual({ ok: true });
    expect(runtime.getView().rngCursor).toBe(initialRng);
    expect(runtime.getView().clickCount).toBe(0);

    const resolved = runtime.click();
    expect(resolved).toMatchObject({ activityRemaining: 0, awaitingExitChoice: true, playerCost: 1,
      heldItems: ["maintenance-pass"], sceneChoice: null });
    expect(resolved.events.filter((event) => event.type === "player-cost-paid")).toHaveLength(1);
    expect(resolved.events.filter((event) => event.type === "activity-result").map((event) => event.actorId)).toEqual(["second"]);
    expect(runtime.chooseExit("to-exit")).toEqual({ ok: true });
    expect(runtime.getView().playerCost).toBe(0);
    expect(runtime.getView().events.some((event) => event.type === "player-cost-capped")).toBe(true);
  });

  it("keeps incomplete or unaffordable individual batches atomic and allows selections to be replaced", () => {
    const node: GameplayBRouteNode = { ...graphActivity("choice-room", [
      { id: "to-exit", label: "离开", targetNodeId: "handover" },
    ]), sceneChoices: { mode: "individual", behaviors: [
      { id: "costly", label: "设备检修", cost: 2, activity: { locationId: "costly", fixedEffects: [] } },
      { id: "free", label: "观察现场", cost: 0, activity: { locationId: "free", fixedEffects: [] } },
    ] } };
    const runtime = new GameplayBRouteRuntime({ ...runInput([node, graphExit("handover")], [member("a", 5), member("b", 5)]),
      startNodeId: "choice-room", initialPlayerCost: 1 });
    runtime.selectIndividualBehavior("a", "costly");
    const incomplete = runtime.getView();
    expect(incomplete.sceneChoice).toMatchObject({ ready: false, canConfirm: false });
    expect(runtime.click()).toEqual(incomplete);
    runtime.selectIndividualBehavior("b", "costly");
    const unaffordable = runtime.getView();
    expect(unaffordable.sceneChoice).toMatchObject({ ready: true, totalCost: 4, canConfirm: false });
    expect(runtime.click()).toEqual(unaffordable);
    expect(runtime.getView()).toMatchObject({ clickCount: 0, rngCursor: 0, playerCost: 1, activityRemaining: 1,
      events: [{ type: "node-entered" }] });

    runtime.selectIndividualBehavior("a", "free");
    runtime.selectIndividualBehavior("b", "free");
    const accepted = runtime.click();
    expect(accepted).toMatchObject({ clickCount: 1, awaitingExitChoice: true, playerCost: 1, activityRemaining: 0 });
  });

  it("supports one global behavior with validated selected targets and shared Cost", () => {
    const node: GameplayBRouteNode = { ...graphActivity("aid-room", [
      { id: "to-exit", label: "离开", targetNodeId: "handover" },
    ]), costGain: 2, maxCarryCost: 0,
    sceneChoices: { mode: "global", behaviors: [{ id: "treat-one", label: "包扎一名队员", cost: 2, targetMode: "one",
      activity: { locationId: "global-treatment", fixedEffects: [{ kind: "heal-party", amount: 2, text: "恢复 2 HP。" }] } }] } };
    const runtime = new GameplayBRouteRuntime({ ...runInput([node, graphExit("handover")], [member("injured", 4), member("other", 8)]),
      startNodeId: "aid-room" });
    expect(runtime.getView()).toMatchObject({ playerCost: 2, sceneChoice: { mode: "global", requiredActorIds: [], ready: false } });
    expect(runtime.selectGlobalBehavior("treat-one")).toMatchObject({ ok: false });
    expect(runtime.selectGlobalBehavior("treat-one", ["missing"])).toMatchObject({ ok: false });
    expect(runtime.selectGlobalBehavior("treat-one", ["injured"])).toEqual({ ok: true });
    expect(runtime.getView().sceneChoice).toMatchObject({ ready: true, canConfirm: true, totalCost: 2,
      selections: [{ behaviorId: "treat-one", targetIds: ["injured"] }] });
    const resolved = runtime.click();
    expect(resolved).toMatchObject({ awaitingExitChoice: true, playerCost: 0,
      party: [{ id: "injured", hp: 6 }, { id: "other", hp: 8 }] });
    expect(resolved.events.filter((event) => event.type === "player-cost-paid")).toHaveLength(1);
  });

  it("plays finite route cards in the same batch as a scene behavior and uses card-granted items for exits", () => {
    const scene: GameplayBRouteNode = { ...graphActivity("power-room", [
      { id: "staff-tunnel", label: "持证走员工通道", targetNodeId: "stage-exit",
        condition: { kind: "has-item", itemId: "maintenance-pass" }, consumeItems: ["maintenance-pass"] },
      { id: "backstage", label: "走后台", targetNodeId: "stage-exit" },
    ]), costGain: 3, maxCarryCost: 1,
    sceneChoices: { mode: "global", behaviors: [{ id: "inspect", label: "检查控制台", cost: 1,
      activity: { locationId: "control-panel", fixedEffects: [], individualCheck: { kind: "chance", dieSides: 2, outcomes: {
        1: { success: false, outcome: { kind: "none", text: "没有确认故障。" } },
        2: { success: true, outcome: { kind: "clue", text: "确认了供电故障。" } },
      } } } }] } };
    const deck = {
      cards: [
        { id: "pass-card", name: "临时通行证", cost: 1, effect: { kind: "gain-item" as const, itemId: "maintenance-pass" } },
        { id: "first-aid-card", name: "现场急救", cost: 1, effect: { kind: "heal" as const, amount: 2, targetMode: "one" as const } },
        { id: "light-card", name: "紧急照明", cost: 1, effect: { kind: "check-bonus" as const, amount: 1, targetMode: "one" as const } },
      ],
      openingHandSize: 3,
      handLimit: 3,
      drawPerNodeEntry: 1,
    };
    const runtime = new GameplayBRouteRuntime({ ...runInput([scene, graphExit("stage-exit")], [member("injured", 3), member("guard", 5)]),
      startNodeId: "power-room", initialPlayerCost: 2, playerDeck: deck });
    const opening = runtime.getView();
    expect(opening).toMatchObject({ playerCost: 5, playerDeck: { drawPileCount: 0, handLimit: 3 } });
    expect(opening.playerDeck?.hand.map((card) => card.id).sort()).toEqual(["first-aid-card", "light-card", "pass-card"]);
    expect(runtime.selectGlobalBehavior("inspect")).toEqual({ ok: true });
    expect(runtime.selectPlayerCard("missing-card")).toMatchObject({ ok: false });
    expect(runtime.selectPlayerCard("first-aid-card")).toMatchObject({ ok: false });
    expect(runtime.selectPlayerCard("pass-card")).toEqual({ ok: true });
    expect(runtime.selectPlayerCard("first-aid-card", ["injured"])).toEqual({ ok: true });
    expect(runtime.selectPlayerCard("light-card", ["injured"])).toEqual({ ok: true });
    expect(runtime.getView().sceneChoice).toMatchObject({ totalCost: 4, canConfirm: true });
    expect(runtime.getView().sceneChoice?.selectedPlayerCards.map((card) => card.cardId).sort()).toEqual(["first-aid-card", "light-card", "pass-card"]);

    const resolved = runtime.click();
    expect(resolved).toMatchObject({ playerCost: 1, heldItems: ["maintenance-pass"], awaitingExitChoice: true,
      party: [{ id: "injured", hp: 5 }, { id: "guard", hp: 5 }], playerDeck: { hand: [], drawPileCount: 0 } });
    expect([...resolved.playerDeck!.usedCardIds].sort()).toEqual(["first-aid-card", "light-card", "pass-card"]);
    expect(resolved.availableExits.map((exit) => exit.id)).toEqual(["staff-tunnel", "backstage"]);
    expect(resolved.events.filter((event) => event.type === "player-card-played")).toHaveLength(3);
    expect(resolved.events.find((event) => event.type === "activity-result" && event.actorId === "injured")?.dice)
      .toMatchObject({ bonus: 1, modifiedValue: 2 });
    expect(runtime.chooseExit("staff-tunnel")).toEqual({ ok: true });
    expect(runtime.getView()).toMatchObject({ currentNode: { id: "stage-exit" }, heldItems: [], playerCost: 1,
      playerDeck: { hand: [], drawPileCount: 0 } });
    expect([...runtime.getView().playerDeck!.usedCardIds].sort()).toEqual(["first-aid-card", "light-card", "pass-card"]);
  });

  it("draws a fixed finite deck deterministically on route start and subsequent node entries", () => {
    const nodes: GameplayBRouteNode[] = [
      { ...graphActivity("first-room", [{ id: "to-next", label: "前往下一场景", targetNodeId: "last-exit" }]),
        sceneChoices: { mode: "global", behaviors: [{ id: "observe", label: "观察现场", cost: 0,
          activity: { locationId: "observation", fixedEffects: [] } }] } },
      graphExit("last-exit"),
    ];
    const deck = {
      cards: ["one", "two", "three"].map((id) => ({ id, name: "卡牌 " + id, cost: 0,
        effect: { kind: "gain-item" as const, itemId: "item-" + id } })),
      openingHandSize: 1,
      handLimit: 2,
      drawPerNodeEntry: 1,
    };
    const play = () => {
      const runtime = new GameplayBRouteRuntime({ ...runInput(nodes, [member("scout", 10)], "fixed-deck-seed"),
        startNodeId: "first-room", playerDeck: deck });
      const opening = runtime.getView();
      expect(opening.playerDeck).toMatchObject({ handLimit: 2, drawPileCount: 2 });
      runtime.selectGlobalBehavior("observe");
      runtime.click();
      runtime.chooseExit("to-next");
      const next = runtime.getView();
      expect(next.playerDeck).toMatchObject({ handLimit: 2, drawPileCount: 1 });
      expect(next.playerDeck?.hand).toHaveLength(2);
      return next;
    };
    expect(play()).toEqual(play());
  });

  it("rejects an unaffordable card without spending or consuming it and supports removing it from the batch", () => {
    const node: GameplayBRouteNode = { ...graphActivity("supply-room", [
      { id: "to-exit", label: "离开", targetNodeId: "handover" },
    ]), costGain: 1, maxCarryCost: 9,
    sceneChoices: { mode: "global", behaviors: [{ id: "inspect", label: "检查补给", cost: 0,
      activity: { locationId: "supply-inspection", fixedEffects: [] } }] } };
    const runtime = new GameplayBRouteRuntime({ ...runInput([node, graphExit("handover")], [member("scout", 8)]),
      startNodeId: "supply-room", playerDeck: { cards: [
        { id: "too-expensive", name: "紧急采购", cost: 2, effect: { kind: "gain-item", itemId: "signal-key" } },
      ], openingHandSize: 1, handLimit: 1, drawPerNodeEntry: 0 } });
    runtime.selectGlobalBehavior("inspect");
    runtime.selectPlayerCard("too-expensive");
    const unaffordable = runtime.getView();
    expect(unaffordable.sceneChoice).toMatchObject({ ready: true, totalCost: 2, canConfirm: false });
    expect(runtime.click()).toEqual(unaffordable);
    expect(runtime.getView()).toMatchObject({ clickCount: 0, rngCursor: 0, playerCost: 1, heldItems: [],
      party: [{ hp: 8 }], activityRemaining: 1,
      playerDeck: { hand: [{ id: "too-expensive" }], drawPileCount: 0, usedCardIds: [] } });
    expect(runtime.unselectPlayerCard("too-expensive")).toEqual({ ok: true });
    expect(runtime.getView().sceneChoice).toMatchObject({ totalCost: 0, canConfirm: true });
    expect(runtime.click()).toMatchObject({ clickCount: 1, awaitingExitChoice: true, heldItems: [],
      playerDeck: { hand: [{ id: "too-expensive" }], usedCardIds: [] } });
  });

  it("adds Cost on every scene entry and clamps only when leaving the scene", () => {
    const nodes: GameplayBRouteNode[] = [
      { ...graphActivity("lobby", [{ id: "lobby-to-service", label: "进入服务亭", targetNodeId: "service" }], 2),
        costGain: 3, maxCarryCost: 10 },
      { ...graphActivity("service", [{ id: "service-to-lobby", label: "返回大厅", targetNodeId: "lobby" }], 2),
        costGain: 4, maxCarryCost: 2 },
    ];
    const runtime = new GameplayBRouteRuntime({ ...runInput(nodes, [member("scout", 10)]), startNodeId: "lobby" });
    expect(runtime.getView().playerCost).toBe(3);
    runtime.click();
    runtime.chooseExit("lobby-to-service");
    expect(runtime.getView()).toMatchObject({ currentNode: { id: "service" }, playerCost: 7 });
    runtime.click();
    runtime.chooseExit("service-to-lobby");
    expect(runtime.getView()).toMatchObject({ currentNode: { id: "lobby" }, playerCost: 5,
      nodeVisitCounts: { lobby: 2, service: 1 } });
    expect(runtime.getView().events.filter((event) => event.type === "player-cost-gained")).toHaveLength(3);
    expect(runtime.getView().events.filter((event) => event.type === "player-cost-capped")).toHaveLength(1);
  });

  it("allows an explicit map cycle, tracks repeat visits, and ends with its configured no-exit result at the visit limit", () => {
    const nodes: GameplayBRouteNode[] = [
      graphActivity("arcade", [{ id: "arcade-to-maze", label: "进入迷宫", targetNodeId: "maze" }], 2),
      graphActivity("maze", [{ id: "maze-to-arcade", label: "返回电玩馆", targetNodeId: "arcade" }], 2),
    ];
    const runtime = new GameplayBRouteRuntime({ ...runInput(nodes, [member("scout", 10)]), startNodeId: "arcade" });
    const travel = (exitId: string): void => {
      runtime.click();
      expect(runtime.chooseExit(exitId)).toEqual({ ok: true });
    };
    travel("arcade-to-maze");
    travel("maze-to-arcade");
    expect(runtime.getView().nodeVisitCounts).toEqual({ arcade: 2, maze: 1 });
    travel("arcade-to-maze");
    runtime.click();
    expect(runtime.getView()).toMatchObject({ terminal: true, result: "stranded", currentNode: { id: "maze" },
      nodeVisitCounts: { arcade: 2, maze: 2 } });
    expect(runtime.getView().events.at(-1)?.text).toBe("maze没有可用出口，队伍撤离。");
  });

  it("waits for an explicit exit choice after a graph battle victory", () => {
    const battleWithExit: GameplayBRouteNode = { ...battleNode("graph-battle"),
      exits: [{ id: "battle-to-exit", label: "前往交接点", targetNodeId: "handover" }],
      maxVisits: 1, costGain: 0, maxCarryCost: 99, noAvailableExitText: "没有可用撤离路线。" };
    const runtime = new GameplayBRouteRuntime({ ...runInput([battleWithExit, graphExit("handover")], [member("attacker", 10, 10, true)]),
      startNodeId: "graph-battle" });

    const victory = runtime.click();
    expect(victory).toMatchObject({ awaitingExitChoice: true, currentNode: { id: "graph-battle", kind: "battle" },
      availableExits: [{ id: "battle-to-exit", targetNodeId: "handover" }], currentBattle: null });
    expect(runtime.chooseExit("battle-to-exit")).toEqual({ ok: true });
    expect(runtime.getView().currentNode.id).toBe("handover");
  });

  it("rejects malformed graph inputs before starting", () => {
    const dangling = graphActivity("start", [{ id: "missing", label: "失效出口", targetNodeId: "unknown" }]);
    expect(() => new GameplayBRouteRuntime({ ...runInput([dangling], [member("scout", 10)]), startNodeId: "start" }))
      .toThrow(/Invalid route exit target/);
    expect(() => new GameplayBRouteRuntime({ ...runInput([graphActivity("start", [
      { id: "bad-condition", label: "非法门", targetNodeId: "end", condition: { kind: "all", conditions: [] } },
      { id: "fallback", label: "常规路线", targetNodeId: "end" },
    ]), graphExit("end")], [member("scout", 10)]), startNodeId: "start" }))
      .toThrow(/Invalid item condition/);
    expect(() => new GameplayBRouteRuntime({ ...runInput([
      graphActivity("start", [{ id: "gated-only", label: "持证通道", targetNodeId: "end",
        condition: { kind: "has-item", itemId: "maintenance-pass" } }]), graphExit("end"),
    ], [member("scout", 10)]), startNodeId: "start" })).toThrow(/unconditional fallback/);
    expect(() => new GameplayBRouteRuntime({ ...runInput([graphActivity("start", [
      { id: "fallback", label: "常规路线", targetNodeId: "end" },
    ]), graphExit("end")], [member("scout", 10)]), startNodeId: "start", playerDeck: {
      cards: [
        { id: "duplicate", name: "第一张", cost: 1, effect: { kind: "gain-item", itemId: "one" } },
        { id: "duplicate", name: "第二张", cost: 1, effect: { kind: "gain-item", itemId: "two" } },
      ], openingHandSize: 1, handLimit: 1, drawPerNodeEntry: 1,
    } })).toThrow(/duplicate player card ID/);
  });
});
