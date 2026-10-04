import { describe, expect, it } from "vitest";
import { firstBattle } from "../src/content/first-battle.js";
import { prepareBattleRound } from "../src/battle/prepare.js";
import type {
  BattleCharacterDefinition,
  BattleEnemyMember,
  BattlePartyMember,
  BattlePreparationInput,
} from "../src/model.js";

function scenario(
  party: readonly BattlePartyMember[] = firstBattle.party,
  enemies: readonly BattleEnemyMember[] = firstBattle.enemies,
  round = 1,
): BattlePreparationInput {
  return { encounterId: firstBattle.encounterId, round, party, enemies };
}

function changeParty(input: BattlePreparationInput, id: string, update: Partial<BattlePartyMember>): BattlePreparationInput {
  return { ...input, party: input.party.map((member) => member.definition.id === id ? { ...member, ...update } : member) };
}

function extraMember(id: string, name: string, row: "front" | "back"): BattlePartyMember {
  const definition: BattleCharacterDefinition = { id, name, row, hpMax: 10, atk: 2, def: 0, cards: [], aiPriority: [] };
  return { definition, hp: 10, currentBattleSCost: 2 };
}

function chise(hp = 9, currentBattleSCost = 2): BattlePartyMember {
  return {
    definition: {
      id: "chise", name: "千世", row: "front", hpMax: 9, atk: 2, def: 0,
      cards: [
        { id: "chise-aid", name: "现场包扎", cost: 2, tags: ["support"], effect: { kind: "heal", amount: 2, target: { kind: "lowest", side: "ally", rows: ["any"], requirement: "injured-half" } } },
        { id: "chise-shot", name: "急救射击", cost: 1, tags: ["shoot"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front", "back"] } } },
      ],
      aiPriority: [
        { cardId: "chise-aid", condition: { kind: "injured-ally-half" }, holdCost: 2, reserveException: "heal-wounded-ally" },
        { cardId: "chise-shot", condition: { kind: "enemy-row-alive", row: "front" }, holdCost: 2 },
      ],
    },
    hp,
    currentBattleSCost,
  };
}

function reina(): BattlePartyMember {
  return {
    definition: {
      id: "reina", name: "玲奈", row: "front", hpMax: 10, atk: 2, def: 0,
      cards: [
        { id: "reina-blast", name: "破阵爆破", cost: 3, tags: ["blast"], effect: { kind: "attack", target: { kind: "all", side: "enemy", row: "front" } } },
        { id: "reina-cover", name: "掩护", cost: 2, tags: ["cover"], effect: { kind: "shield", amount: 2, target: { kind: "intent-target", intentTag: "charge" } } },
        { id: "reina-charge", name: "冲锋", cost: 1, tags: ["charge"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front", "back"] } } },
      ],
      aiPriority: [
        { cardId: "reina-blast", condition: { kind: "enemy-front-count", minimum: 2 }, holdCost: 0 },
        { cardId: "reina-cover", condition: { kind: "enemy-intent", tag: "charge" }, holdCost: 1, reserveException: "cover-enemy-charge" },
        { cardId: "reina-charge", condition: { kind: "enemy-row-alive", row: "front" }, holdCost: 1 },
      ],
    },
    hp: 10,
    currentBattleSCost: 2,
  };
}

describe("prepareBattleRound", () => {
  it("freezes the first 2+2 round in roster order without random draws", () => {
    const before = structuredClone(firstBattle);
    const round = prepareBattleRound(firstBattle);
    const charge = round.enemyIntents.find((intent) => intent.actorId === "charger");
    const sniper = round.enemyIntents.find((intent) => intent.actorId === "water-gunner");
    const yuri = round.playerActions.find((action) => action.actorId === "yuri");

    expect(round.combatants.map((actor) => actor.side)).toEqual(["ally", "ally", "ally", "ally", "enemy", "enemy"]);
    expect(charge?.targetIds).toEqual(["yuri"]);
    expect(sniper?.targetIds).toEqual(["tsumugi"]);
    expect(yuri).toMatchObject({ kind: "card", cardId: "yuri-charge", targetIds: ["charger"], costPaid: 1, sCostAfterPayment: 1 });
    expect(round.playerActions.map((action) => action.actorId)).toEqual(["shiori", "yuri", "mei", "tsumugi"]);
    expect(prepareBattleRound(firstBattle)).toEqual(round);
    expect(firstBattle).toEqual(before);
    expect(Object.isFrozen(round.playerActions[0]?.targetIds)).toBe(true);
  });

  it("skips an unaffordable high-priority card and falls through to a payable card", () => {
    const secondFront: BattleEnemyMember = {
      ...firstBattle.enemies[1]!,
      definition: { ...firstBattle.enemies[1]!.definition, row: "front" },
    };
    const input = changeParty(scenario([ ...firstBattle.party ], [firstBattle.enemies[0]!, secondFront]), "yuri", { currentBattleSCost: 2 });
    const yuri = prepareBattleRound(input).playerActions.find((action) => action.actorId === "yuri");
    expect(yuri).toMatchObject({ kind: "card", cardId: "yuri-charge", costPaid: 1, sCostAfterPayment: 1 });
  });

  it("skips a card without a legal target and enforces an ordinary reserve line", () => {
    const testActor = extraMember("fallback", "回退测试", "front");
    const definition: BattleCharacterDefinition = {
      ...testActor.definition,
      cards: [
        { id: "front-only", name: "前排射击", cost: 1, tags: ["shoot"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } },
        { id: "row-fallback", name: "合法目标射击", cost: 1, tags: ["shoot"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front", "back"] } } },
      ],
      aiPriority: [
        { cardId: "front-only", condition: { kind: "always" }, holdCost: 0 },
        { cardId: "row-fallback", condition: { kind: "enemy-row-alive", row: "back" }, holdCost: 0 },
      ],
    };
    const noFront = { ...firstBattle.enemies[0]!, hp: 0 };
    const actor = { ...testActor, definition, currentBattleSCost: 2 };
    const round = prepareBattleRound(scenario([actor], [noFront, firstBattle.enemies[1]! ]));
    expect(round.playerActions[0]).toMatchObject({ kind: "card", cardId: "row-fallback", targetIds: ["water-gunner"] });

    const noChargeIntent = {
      ...firstBattle.enemies[0]!,
      hp: 0,
      definition: { ...firstBattle.enemies[0]!.definition, intentPattern: firstBattle.enemies[1]!.definition.intentPattern },
    };
    const reinaAction = prepareBattleRound(scenario([...firstBattle.party, reina()], [noChargeIntent, firstBattle.enemies[1]!])).playerActions.find((action) => action.actorId === "reina");
    expect(reinaAction?.kind).toBe("observe");
  });

  it("applies Mei's R06 medical exception only when the full cost is payable", () => {
    let input = changeParty(scenario(), "mei", { currentBattleSCost: 3 });
    input = changeParty(input, "tsumugi", { hp: 4 });
    const paid = prepareBattleRound(input).playerActions.find((action) => action.actorId === "mei");
    expect(paid).toMatchObject({ kind: "card", cardId: "mei-medical", costPaid: 3, sCostAfterPayment: 0, reserveBypassed: true });

    input = changeParty(input, "mei", { currentBattleSCost: 2 });
    const short = prepareBattleRound(input).playerActions.find((action) => action.actorId === "mei");
    expect(short?.kind).toBe("observe");
  });

  it("locks an R11 downed ally as a heal target but does not prepare an action for them", () => {
    let input = changeParty(scenario(), "mei", { currentBattleSCost: 3 });
    input = changeParty(input, "shiori", { hp: 1 });
    input = changeParty(input, "tsumugi", { hp: 0 });
    const round = prepareBattleRound(input);
    const medical = round.playerActions.find((action) => action.actorId === "mei");

    expect(medical).toMatchObject({ kind: "card", cardId: "mei-medical", targetIds: ["tsumugi"] });
    expect(round.combatants.find((actor) => actor.actorId === "tsumugi")?.hp).toBe(0);
    expect(round.playerActions.some((action) => action.actorId === "tsumugi")).toBe(false);
  });

  it("uses R06 Chise and Reina exceptions in a 4+2 fixture", () => {
    let input = scenario([...firstBattle.party, chise(), reina()]);
    input = changeParty(input, "tsumugi", { hp: 4 });
    const round = prepareBattleRound(input);
    const aid = round.playerActions.find((action) => action.actorId === "chise");
    const cover = round.playerActions.find((action) => action.actorId === "reina");

    expect(round.combatants.filter((actor) => actor.side === "ally" && actor.row === "front")).toHaveLength(4);
    expect(round.combatants.filter((actor) => actor.side === "ally" && actor.row === "back")).toHaveLength(2);
    expect(aid).toMatchObject({ kind: "card", cardId: "chise-aid", costPaid: 2, sCostAfterPayment: 0, reserveBypassed: true, targetIds: ["tsumugi"] });
    expect(cover).toMatchObject({ kind: "card", cardId: "reina-cover", costPaid: 2, sCostAfterPayment: 0, reserveBypassed: true, targetIds: ["chise"] });
  });

  it("honors row protection, front fallback, sniper targeting, and stable ties", () => {
    let input = scenario();
    input = changeParty(input, "shiori", { hp: 8 });
    input = changeParty(input, "yuri", { hp: 8 });
    input = changeParty(input, "mei", { hp: 5 });
    input = changeParty(input, "tsumugi", { hp: 5, currentBattleSCost: 3 });
    let round = prepareBattleRound(input);
    expect(round.enemyIntents[0]?.targetIds).toEqual(["shiori"]);
    expect(round.enemyIntents[1]?.targetIds).toEqual(["mei"]);
    expect(round.playerActions.find((action) => action.actorId === "tsumugi")).toMatchObject({ kind: "card", cardId: "tsumugi-sniper", targetIds: ["water-gunner"] });

    const noFront = { ...firstBattle.enemies[0]!, hp: 0 };
    const fallbackInput = scenario([extraMember("fallback", "回退测试", "front")], [noFront, firstBattle.enemies[1]!]);
    const fallback = prepareBattleRound(fallbackInput);
    expect(fallback.playerActions[0]?.kind).toBe("observe");
    expect(fallback.enemyIntents.find((intent) => intent.actorId === "water-gunner")?.targetIds).toEqual(["fallback"]);
  });

  it("falls back to a living rear ally when the front row is empty", () => {
    let input = scenario();
    input = changeParty(input, "shiori", { hp: 0 });
    input = changeParty(input, "yuri", { hp: 0 });
    input = changeParty(input, "mei", { hp: 5 });
    input = changeParty(input, "tsumugi", { hp: 4 });
    const round = prepareBattleRound(input);
    expect(round.enemyIntents.find((intent) => intent.actorId === "charger")?.targetIds).toEqual(["tsumugi"]);
    expect(round.enemyIntents.find((intent) => intent.actorId === "water-gunner")?.targetIds).toEqual(["tsumugi"]);
  });

  it("recharges after round one and preserves the pre-payment snapshot", () => {
    const party = firstBattle.party.map((member) => member.definition.id === "shiori" ? { ...member, currentBattleSCost: 5 } :
      member.definition.id === "tsumugi" ? { ...member, hp: 0, currentBattleSCost: 2 } : member);
    const round = prepareBattleRound(scenario(party, firstBattle.enemies, 2));
    expect(round.partyStartSCost.map((entry) => entry.value)).toEqual([5, 3, 3, 2]);
    expect(round.combatants.find((actor) => actor.actorId === "shiori")?.currentBattleSCost).toBe(5);
    expect(round.playerActions.find((action) => action.actorId === "shiori")).toMatchObject({ sCostBeforePayment: 5, sCostAfterPayment: 4 });
    expect(round.playerActions.some((action) => action.actorId === "tsumugi")).toBe(false);
  });
});
