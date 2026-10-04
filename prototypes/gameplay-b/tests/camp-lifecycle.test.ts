import { describe, expect, it } from "vitest";
import type { BattleEnemyMember, BattlePartyMember, BattlePreparationInput, OrdinaryBattleCardDefinition, RouteInitialPartyMember } from "../src/model.js";
import { prepareBattleRound } from "../src/battle/prepare.js";
import { GameplayBRouteRuntime, type GameplayBRouteNode } from "../src/runtime.js";
import { backstageRestRoomFixture } from "../src/content/short-route.js";

const strike: OrdinaryBattleCardDefinition = { id: "camp-test-strike", name: "攻击", cost: 1, tags: [],
  effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } };
function character(id: string, hp = 10, hpMax = 10, attacks = false, row: "front" | "back" = "front", targetRow: "front" | "back" = "front"): RouteInitialPartyMember {
  const card = { ...strike, effect: { kind: "attack" as const, target: { kind: "lowest" as const, side: "enemy" as const, rows: [targetRow] } } };
  return { roster: { id, name: id, row, hpMax, initialHp: hpMax, atk: 10, def: 0, activityTags: [] },
    battle: { id, name: id, row, hpMax, atk: 10, def: 0, cards: attacks ? [card] : [],
      aiPriority: attacks ? [{ cardId: card.id, condition: { kind: "always" }, holdCost: 0 }] : [] }, hp };
}
const foe = (id: string, hp: number, row: "front" | "back" = "front", atk = 0, intentPattern: BattleEnemyMember["definition"]["intentPattern"] = []): BattleEnemyMember =>
  ({ definition: { id, name: id, row, hpMax: hp, atk, def: 0, intentPattern }, hp });
const battleNode = (id: string, enemy: BattleEnemyMember): Extract<GameplayBRouteNode, { kind: "battle" }> =>
  ({ id, name: id, kind: "battle", battle: { encounterId: `encounter-${id}`, enemies: [enemy] } });

describe("Gameplay B camp sCost lifecycle", () => {
  it("consumes Node 6 opening +1 in the next battle only", () => {
    const camp: GameplayBRouteNode = { id: "node-6", name: "急救站", kind: "activity", activityCount: 1,
      activity: { locationId: "first-aid-station", fixedEffects: [] }, nextBattleModifier: { initialSCostBonus: 1 } };
    const runtime = new GameplayBRouteRuntime({ seed: 7, initialParty: [character("attacker", 10, 10, true)], nodes: [
      battleNode("first", foe("foe-first", 1)), camp, battleNode("boosted", foe("foe-boosted", 1)), battleNode("base", foe("foe-base", 1)),
    ] });
    expect(runtime.getView().party[0]?.currentBattleSCost).toBe(2);
    expect(runtime.click().currentNode.id).toBe("node-6");
    const boosted = runtime.click();
    expect(boosted.currentNode.id).toBe("boosted");
    expect(boosted.currentBattle?.pendingRound?.partyStartSCost).toEqual([{ actorId: "attacker", value: 3 }]);
    const next = runtime.click();
    expect(next.currentNode.id).toBe("base");
    expect(next.currentBattle?.pendingRound?.partyStartSCost).toEqual([{ actorId: "attacker", value: 2 }]);
  });

  it("applies Node 10 healing before combat, starts recharge at round two, caps it, and does not carry it past the Boss", () => {
    const restRoom: GameplayBRouteNode = { ...backstageRestRoomFixture, id: "node-10-fixture", kind: "activity" };
    const boss = battleNode("boss", foe("boss-foe", 15, "back"));
    const route = [restRoom, boss, battleNode("after-boss", foe("next-foe", 1))];
    const runtime = new GameplayBRouteRuntime({ seed: 10, nodes: route, initialParty: [character("striker", 5, 10, true, "front", "back"), character("revived", 0)] });
    expect(runtime.getView().party.map((member) => member.id)).toEqual(["striker", "revived", "reina"]);
    const firstRound = runtime.click();
    expect(firstRound.rngCursor).toBe(0);
    expect(firstRound.party.map(({ id, hp }) => [id, hp])).toEqual([["striker", 7], ["revived", 2], ["reina", 12]]);
    expect(firstRound.currentBattle?.pendingRound?.partyStartSCost.every((entry) => entry.value === 2)).toBe(true);
    const secondRound = runtime.click();
    expect(secondRound.currentBattle?.pendingRound?.round).toBe(2);
    expect(secondRound.currentBattle?.pendingRound?.partyStartSCost.map((entry) => entry.value)).toEqual([3, 5, 5]);
    const afterBoss = runtime.click();
    expect(afterBoss.currentNode.id).toBe("after-boss");
    expect(afterBoss.currentBattle?.pendingRound?.partyStartSCost.map((entry) => entry.value)).toEqual([2, 2, 2]);

    const capParty: BattlePartyMember = { definition: character("capper").battle, hp: 10, currentBattleSCost: 4 };
    const cappedInput: BattlePreparationInput = { encounterId: "cap", round: 2, party: [capParty], enemies: [], rechargeBonus: { amount: 2, fromRound: 2 } };
    expect(prepareBattleRound(cappedInput).partyStartSCost).toEqual([{ actorId: "capper", value: 5 }]);
  });

  it("rejects pending camp recharge bonuses with different fromRound values", () => {
    const camp = (id: string, fromRound: number): GameplayBRouteNode => ({ id, name: id, kind: "activity", activityCount: 1,
      activity: { locationId: `activity-${id}`, fixedEffects: [] }, nextBattleModifier: { rechargeBonus: { amount: 1, fromRound } } });
    const runtime = new GameplayBRouteRuntime({ seed: 2, initialParty: [character("member")],
      nodes: [camp("camp-2", 2), camp("camp-3", 3), battleNode("next", foe("next-foe", 1))] });
    runtime.click();
    expect(() => runtime.click()).toThrow("different start rounds");
  });

  it.each(["defeat", "draw"] as const)("clears route-visible battle sCost on terminal %s", (result) => {
    const intent = [{ id: "hit", name: "攻击", tags: [], effect: { kind: "attack" as const,
      target: { kind: "all" as const, side: "ally" as const, row: "front" as const } } }];
    const enemy = foe("terminal-foe", result === "draw" ? 1 : 10, "front", 20, intent);
    const runtime = new GameplayBRouteRuntime({ seed: result, nodes: [battleNode(`terminal-${result}`, enemy)],
      initialParty: [character("last-member", 1, 1, result === "draw")] });
    const terminal = runtime.click();
    expect(terminal.result).toBe(result);
    expect(terminal.terminal).toBe(true);
    expect(terminal.currentBattle?.state.partySCost.every((entry) => entry.value === 0)).toBe(true);
    expect(runtime.click()).toEqual(terminal);
  });
});
