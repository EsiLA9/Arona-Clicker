import { describe, expect, it } from "vitest";
import { prepareBattleRound } from "../src/battle/prepare.js";
import { resolveBattleRound } from "../src/battle/resolve.js";
import { GameplayBBattleRuntime } from "../src/runtime.js";
import type {
  BattleActionEffect, BattleCombatantSnapshot, BattleResolutionState, PreparedBattleRound,
  PreparedEnemyIntent, PreparedPlayerAction,
} from "../src/model.js";

const actor = (actorId: string, side: "ally" | "enemy", hp: number, atk = 2, def = 0): BattleCombatantSnapshot => ({
  actorId, side, name: actorId, row: "front", hp, hpMax: 10, atk, def, currentBattleSCost: side === "ally" ? 2 : null,
});
const attack: BattleActionEffect = { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["any"] } };
const action = (actorId: string, effect: BattleActionEffect, targetIds: string[], kind: "card" | "observe" = "card"): PreparedPlayerAction => ({
  actorId, kind, cardId: kind === "card" ? `${actorId}-card` : null, cardName: kind === "card" ? "action" : null,
  tags: [], effect: kind === "card" ? effect : null, targetIds, costPaid: kind === "card" ? 1 : 0,
  sCostBeforePayment: 2, sCostAfterPayment: kind === "card" ? 1 : 2, reserveBypassed: false,
});
const intent = (actorId: string, targetId: string, atk = 2): PreparedEnemyIntent => ({
  actorId, intentId: `${actorId}-intent`, intentName: "hit", tags: [],
  effect: { kind: "attack", target: { kind: "lowest", side: "ally", rows: ["any"] } }, targetIds: [targetId],
});
function round(combatants: BattleCombatantSnapshot[], players: PreparedPlayerAction[] = [], enemies: PreparedEnemyIntent[] = [], n = 1): PreparedBattleRound {
  return { encounterId: "test", round: n, combatants, partyStartSCost: combatants.filter((a) => a.side === "ally").map((a) => ({ actorId: a.actorId, value: a.currentBattleSCost ?? 0 })), enemyIntents: enemies, playerActions: players };
}
function state(prepared: PreparedBattleRound, scost?: Record<string, number>): BattleResolutionState {
  return { encounterId: prepared.encounterId, round: prepared.round - 1, combatants: prepared.combatants,
    partySCost: prepared.combatants.filter((a) => a.side === "ally").map((a) => ({ actorId: a.actorId, value: scost?.[a.actorId] ?? a.currentBattleSCost ?? 0 })), result: "ongoing" };
}

describe("resolveBattleRound", () => {
  it("resolves frozen attacks even when their attacker is hit, then nets treatment against damage", () => {
    const actors = [actor("attacker", "ally", 2, 3), actor("medic", "ally", 10), actor("foe", "enemy", 2)];
    const prep = round(actors, [action("attacker", attack, ["foe"]), action("medic", { kind: "heal", amount: 2, target: { kind: "lowest", side: "ally", rows: ["any"] } }, ["attacker"])], [intent("foe", "attacker")]);
    const result = resolveBattleRound(state(prep), prep);
    expect(result.state.combatants.map((a) => [a.actorId, a.hp])).toEqual([["attacker", 2], ["medic", 10], ["foe", 0]]);
    expect(result.state.result).toBe("victory");
    expect(result.deltas.find((d) => d.actorId === "attacker")).toMatchObject({ damage: 2, healing: 2, hpAfter: 2 });
    expect(result.prepared.enemyIntents[0]?.targetIds).toEqual(["attacker"]);
  });

  it("uses the largest temporary shield once against aggregated damage and does not transfer overkill", () => {
    const actors = [actor("guard", "ally", 5), actor("cover1", "ally", 10), actor("cover2", "ally", 10), actor("foe1", "enemy", 10, 4), actor("foe2", "enemy", 10, 3)];
    const shield = (amount: number): BattleActionEffect => ({ kind: "shield", amount, target: { kind: "all", side: "ally", row: "front" } });
    const prep = round(actors, [action("cover1", shield(2), ["guard"]), action("cover2", shield(1), ["guard"])], [intent("foe1", "guard", 4), intent("foe2", "guard", 3)]);
    const result = resolveBattleRound(state(prep), prep);
    expect(result.deltas.find((d) => d.actorId === "guard")).toMatchObject({ damage: 7, shield: 2, hpAfter: 0 });
    expect(result.state.combatants.find((a) => a.actorId === "cover1")?.hp).toBe(10);
    expect(result.state.result).toBe("ongoing");
  });

  it("applies HP cap and minimum attack damage after defense", () => {
    const actors = [actor("ally", "ally", 9, 1), actor("foe", "enemy", 10, 1, 8)];
    const prep = round(actors, [action("ally", { kind: "heal", amount: 5, target: { kind: "lowest", side: "ally", rows: ["any"] } }, ["ally"])], [intent("foe", "ally")]);
    const result = resolveBattleRound(state(prep), prep);
    expect(result.state.combatants.find((a) => a.actorId === "ally")?.hp).toBe(10);
    expect(result.deltas.find((d) => d.actorId === "ally")).toMatchObject({ damage: 1, healing: 5, hpAfter: 10 });
  });

  it("applies a prepared attack modifier to the targeted actor's frozen attack", () => {
    const actors = [actor("attacker", "ally", 10, 3), actor("support", "ally", 10), actor("foe", "enemy", 10, 1, 1)];
    const prep = round(actors, [action("attacker", attack, ["foe"]), action("support", { kind: "attack-buff", amount: 1, target: { kind: "lowest", side: "ally", rows: ["any"], requirement: "prepared-attack" } }, ["attacker"])]);
    const result = resolveBattleRound(state(prep), prep);
    expect(result.deltas.find((d) => d.actorId === "foe")?.damage).toBe(3);
  });

  it("keeps locked targets and never transfers overkill to another actor", () => {
    const actors = [actor("locked", "ally", 1), actor("other", "ally", 8), actor("foe", "enemy", 10, 6)];
    const prep = round(actors, [], [intent("foe", "locked")]);
    const result = resolveBattleRound(state(prep), prep);
    expect(result.state.combatants.find((a) => a.actorId === "locked")?.hp).toBe(0);
    expect(result.state.combatants.find((a) => a.actorId === "other")?.hp).toBe(8);
    expect(result.prepared.enemyIntents[0]?.targetIds).toEqual(["locked"]);
  });

  it("resolves a same-Click mutual knockout as a draw", () => {
    const actors = [actor("ally", "ally", 1, 3), actor("foe", "enemy", 2, 2)];
    const prep = round(actors, [action("ally", attack, ["foe"])], [intent("foe", "ally")]);
    const result = resolveBattleRound(state(prep, { ally: 4 }), prep);
    expect(result.state.combatants.map((a) => a.hp)).toEqual([0, 0]);
    expect(result.state.result).toBe("draw");
    expect(result.state.partySCost[0]?.value).toBe(0);
  });

  it("applies R11 treatment to a downed ally without giving them a late current-round action", () => {
    const input = {
      encounterId: "revive", round: 1,
      party: [
        { definition: { id: "medic", name: "medic", row: "back" as const, hpMax: 10, atk: 1, def: 0,
          cards: [{ id: "heal", name: "heal", cost: 1, tags: [], effect: { kind: "heal" as const, amount: 2, target: { kind: "lowest" as const, side: "ally" as const, rows: ["any" as const], requirement: "injured-half" as const } } }],
          aiPriority: [{ cardId: "heal", condition: { kind: "always" as const }, holdCost: 0 }] }, hp: 10, currentBattleSCost: 2 },
        { definition: { id: "down", name: "down", row: "front" as const, hpMax: 10, atk: 2, def: 0,
          cards: [{ id: "down-hit", name: "hit", cost: 1, tags: [], effect: attack }],
          aiPriority: [{ cardId: "down-hit", condition: { kind: "always" as const }, holdCost: 0 }] }, hp: 0, currentBattleSCost: 2 },
      ],
      enemies: [{ definition: { id: "foe", name: "foe", row: "front" as const, hpMax: 10, atk: 1, def: 0,
        intentPattern: [{ id: "wait", name: "wait", tags: [], effect: { kind: "attack" as const, target: { kind: "lowest" as const, side: "ally" as const, rows: ["any" as const] } } }] }, hp: 10 }],
    };
    const runtime = new GameplayBBattleRuntime(input);
    expect(runtime.getView().pendingRound?.playerActions.some((a) => a.actorId === "down")).toBe(false);
    const after = runtime.click();
    expect(after.state.combatants.find((a) => a.actorId === "down")?.hp).toBe(2);
    expect(after.state.result).toBe("ongoing");
    expect(after.pendingRound?.round).toBe(2);
    expect(after.pendingRound?.playerActions.find((a) => a.actorId === "down")?.kind).toBe("card");
  });

  it("recharges only observing survivors after settlement and caps sCost at five", () => {
    const actors = [actor("waiter", "ally", 10), actor("cardUser", "ally", 10), actor("down", "ally", 0), actor("foe", "enemy", 10)];
    const roundActors = actors.map((a) => a.side === "ally" ? { ...a, currentBattleSCost: a.actorId === "down" ? 3 : 5 } : a);
    const waiter = { ...action("waiter", attack, [], "observe"), sCostBeforePayment: 5, sCostAfterPayment: 5 };
    const cardUser = { ...action("cardUser", attack, ["foe"]), sCostBeforePayment: 5, sCostAfterPayment: 4 };
    const prep = round(roundActors, [waiter, cardUser], [intent("foe", "waiter")], 2);
    const result = resolveBattleRound(state(prep, { waiter: 4, cardUser: 4, down: 3 }), prep);
    expect(result.state.partySCost).toEqual([{ actorId: "waiter", value: 5 }, { actorId: "cardUser", value: 4 }, { actorId: "down", value: 3 }]);
  });

  it.each([
    ["victory", [2], [0]], ["defeat", [0], [2]], ["draw", [0], [0]],
  ] as const)("clears battle sCost at terminal %s", (expected, allyHP, foeHP) => {
    const actors = [actor("ally", "ally", allyHP[0]!), actor("foe", "enemy", foeHP[0]!)];
    const prep = round(actors);
    // A terminal state can be reached after a prepared Click; both sides' existing HP decide the simultaneous result.
    const ended = resolveBattleRound(state(prep, { ally: 4 }), prep);
    expect(ended.state.result).toBe(expected);
    expect(ended.state.partySCost[0]?.value).toBe(0);
  });

  it("makes terminal Click idempotent with no additional battle events", () => {
    const input = {
      encounterId: "terminal", round: 1,
      party: [{ definition: { id: "ally", name: "ally", row: "front" as const, hpMax: 2, atk: 3, def: 0,
        cards: [{ id: "kill", name: "kill", cost: 1, tags: [], effect: attack }],
        aiPriority: [{ cardId: "kill", condition: { kind: "always" as const }, holdCost: 0 }] }, hp: 2, currentBattleSCost: 2 }],
      enemies: [{ definition: { id: "foe", name: "foe", row: "front" as const, hpMax: 1, atk: 1, def: 0, intentPattern: [] }, hp: 1 }],
    };
    const runtime = new GameplayBBattleRuntime(input);
    const ended = runtime.click();
    const repeated = runtime.click();
    expect(ended.terminal).toBe(true);
    expect(repeated).toEqual(ended);
  });
});
