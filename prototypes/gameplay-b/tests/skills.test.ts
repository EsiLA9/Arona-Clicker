import { describe, expect, it } from "vitest";
import { matchPreparedBattleRound } from "../src/battle/match.js";
import { prepareBattleRound, prepareBattleRoundWithSkills } from "../src/battle/prepare.js";
import { prepareSkills, type SkillRandom } from "../src/battle/skills.js";
import { firstBattle } from "../src/content/first-battle.js";
import type { BattleEnemyMember, BattlePartyMember, BattlePreparationInput } from "../src/model.js";

function fixedDice(values: readonly number[]): SkillRandom & { readonly calls: () => number } {
  let calls = 0;
  return { nextInt: () => values[calls++] ?? 4, calls: () => calls };
}

function chise(hp = 9): BattlePartyMember {
  return { definition: { id: "chise", name: "千世", row: "front", hpMax: 9, atk: 1, def: 0,
    cards: [], aiPriority: [] }, hp, currentBattleSCost: 2 };
}

function reina(): BattlePartyMember {
  return { definition: { id: "reina", name: "玲奈", row: "front", hpMax: 12, atk: 2, def: 1,
    cards: [{ id: "reina-blast", name: "破阵爆破", cost: 2, tags: ["blast"], effect: { kind: "attack", target: { kind: "all", side: "enemy", row: "front" } } }],
    aiPriority: [{ cardId: "reina-blast", condition: { kind: "enemy-front-count", minimum: 2 }, holdCost: 0 }] }, hp: 12, currentBattleSCost: 3 };
}

function secondFront(): BattleEnemyMember {
  return { definition: { ...firstBattle.enemies[1]!.definition, id: "second-front", name: "备用前排", row: "front", hpMax: 7, intentPattern: [] }, hp: 7 };
}

function sixSkillRound(): ReturnType<typeof prepareBattleRound> {
  const party = firstBattle.party.map((member) => {
    if (member.definition.id === "yuri") return { ...member, definition: { ...member.definition, aiPriority: member.definition.aiPriority.filter((entry) => entry.cardId === "yuri-charge") } };
    if (member.definition.id === "mei") return { ...member, hp: 4 };
    if (member.definition.id === "tsumugi") return { ...member, currentBattleSCost: 3 };
    return member;
  });
  const enemies = [firstBattle.enemies[0]!, firstBattle.enemies[1]!, secondFront()];
  return prepareBattleRound({ ...firstBattle, party: [...party, chise(), reina()], enemies });
}

function frozenDeep(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(frozenDeep);
}

describe("prepareSkills", () => {
  it("checks all six eligible skills in party order with one injected d4 each", () => {
    const round = sixSkillRound();
    const random = fixedDice([1, 1, 1, 1, 1, 1]);
    const result = prepareSkills(round, random);

    expect(result.checks.map(({ actorId, dieRoll, status }) => [actorId, dieRoll, status])).toEqual([
      ["shiori", 1, "triggered"], ["yuri", 1, "triggered"], ["mei", 1, "triggered"],
      ["tsumugi", 1, "triggered"], ["chise", 1, "triggered"], ["reina", 1, "triggered"],
    ]);
    expect(random.calls()).toBe(6);
    expect(result.supplementalFreeActions.map((action) => action.tags[0])).toEqual(["cover", "pursuit", "support", "support", "blast"]);
    expect(result.supplementalFreeActions[0]).toMatchObject({ actorId: "shiori", effect: { kind: "shield", amount: 2 }, targetIds: ["chise"] });
    expect(result.supplementalFreeActions[2]).toMatchObject({ actorId: "mei", effect: { kind: "attack-buff", amount: 1 }, targetIds: ["tsumugi"] });
    expect(result.supplementalFreeActions[3]).toMatchObject({ actorId: "chise", effect: { kind: "heal", amount: 1 }, targetIds: ["mei"] });
    expect(result.supplementalFreeActions[4]?.targetIds).toEqual(["second-front"]);
    expect(result.supplementalFreeActions.some((action) => action.actorId === "tsumugi")).toBe(false);
    expect(result.modifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ skillId: "mei-encouragement", sourceActorId: "mei", sourceFreeActionId: "mei-encouragement", actorId: "tsumugi", kind: "attack-damage-bonus", amount: 1, actionId: "player-action:3:tsumugi" }),
      expect.objectContaining({ skillId: "tsumugi-calibrated-sight", sourceActorId: "tsumugi", actorId: "tsumugi", kind: "attack-damage-bonus", amount: 1, actionId: "player-action:3:tsumugi" }),
    ]));
    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ skillId: "yuri-follow-up", kind: "fixed-damage", amount: 1, targetIds: ["second-front"] }),
      expect.objectContaining({ skillId: "reina-aftershock", kind: "fixed-damage", amount: 1, targetIds: ["second-front"] }),
    ]));
  });

  it("does not roll when a condition is false, and reports a successful cover with no target", () => {
    const noChargeInput: BattlePreparationInput = { ...firstBattle, party: [firstBattle.party[0]!], enemies: [
      { ...firstBattle.enemies[0]!, definition: { ...firstBattle.enemies[0]!.definition, intentPattern: [] } },
    ] };
    const noChargeRound = prepareBattleRound(noChargeInput);
    const unused = fixedDice([]);
    expect(prepareSkills(noChargeRound, unused).checks[0]).toMatchObject({ actorId: "shiori", status: "condition-not-met", dieRoll: null });
    expect(unused.calls()).toBe(0);

    const backShiori = { ...firstBattle.party[0]!, definition: { ...firstBattle.party[0]!.definition, row: "back" as const } };
    const frontOnlyCharge = { ...firstBattle.enemies[0]!, definition: { ...firstBattle.enemies[0]!.definition,
      intentPattern: [{ ...firstBattle.enemies[0]!.definition.intentPattern[0]!, effect: { kind: "attack" as const, target: { kind: "all" as const, side: "ally" as const, row: "front" as const } } }] } };
    const noTargetRound = prepareBattleRound({ ...firstBattle, party: [backShiori], enemies: [frontOnlyCharge] });
    const oneRoll = fixedDice([1]);
    const noTarget = prepareSkills(noTargetRound, oneRoll);
    expect(noTarget.checks[0]).toMatchObject({ status: "triggered-no-target", dieRoll: 1, triggered: true });
    expect(noTarget.supplementalFreeActions).toEqual([]);
    expect(oneRoll.calls()).toBe(1);
  });

  it("freezes the result, preserves the prepared input, and is deterministic for the same rolls", () => {
    const round = sixSkillRound();
    const before = structuredClone(round);
    const first = prepareSkills(round, fixedDice([1, 2, 3, 4, 1, 2]));
    const second = prepareSkills(round, fixedDice([1, 2, 3, 4, 1, 2]));
    expect(second).toEqual(first);
    expect(round).toEqual(before);
    expect(frozenDeep(first)).toBe(true);
    expect(round.playerActions.map((action) => action.actorId)).toEqual(before.playerActions.map((action) => action.actorId));
  });

  it("exposes the pure prepared-round plus frozen-skill handoff for Runtime callers", () => {
    const input: BattlePreparationInput = { ...firstBattle, party: [firstBattle.party[0]!], enemies: [firstBattle.enemies[0]!] };
    const before = structuredClone(input);
    const prepared = prepareBattleRoundWithSkills(input, fixedDice([1]));
    expect(input).toEqual(before);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.round)).toBe(true);
    expect(frozenDeep(prepared.skills)).toBe(true);
  });

  it("does not create free actions or modifiers when eligible rolls miss", () => {
    const random = fixedDice([2, 2, 2, 2, 2, 2]);
    const result = prepareSkills(sixSkillRound(), random);
    expect(result.checks.every((check) => check.status === "not-triggered" && !check.triggered)).toBe(true);
    expect(result.supplementalFreeActions).toEqual([]);
    expect(result.modifiers).toEqual([]);
    expect(result.effects).toEqual([]);
    expect(random.calls()).toBe(6);
  });

  it("hands a free cover action to the U1 matcher without charging or replacing the ordinary action", () => {
    const shiori = { ...firstBattle.party[0]!, currentBattleSCost: 0 };
    const round = prepareBattleRound({ ...firstBattle, party: [shiori], enemies: [firstBattle.enemies[0]!] });
    const prepared = prepareSkills(round, fixedDice([1]));
    const plan = matchPreparedBattleRound(round, prepared.supplementalFreeActions);

    expect(round.playerActions[0]).toMatchObject({ actorId: "shiori", kind: "observe", costPaid: 0, sCostAfterPayment: 0 });
    expect(plan.matches).toContainEqual(expect.objectContaining({ recipeId: "enemy-charge-ally-cover", rightActionId: "free-skill:0:shiori:shiori-companion-cover" }));
    expect(prepared.supplementalFreeActions[0]).not.toHaveProperty("costPaid");
    expect(round.partyStartSCost).toEqual([{ actorId: "shiori", value: 0 }]);
  });
});
