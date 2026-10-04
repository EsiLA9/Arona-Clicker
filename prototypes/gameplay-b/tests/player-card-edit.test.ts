import { describe, expect, it } from "vitest";
import { getPlayerTargetGroup, listPlayerCardChoices, buildEditedPlayerAction, validatePlayerTargetSelection } from "../src/battle/player-card-edit.js";
import { firstBattle } from "../src/content/first-battle.js";
import { prepareBattleRound } from "../src/battle/prepare.js";
import type { BattlePreparationInput, PreparedBattleRound, PreparedPlayerAction } from "../src/model.js";

function prepared(input: BattlePreparationInput = firstBattle): PreparedBattleRound {
  return prepareBattleRound(input);
}

function definitions(input: BattlePreparationInput = firstBattle) {
  return input.party.map((member) => member.definition);
}

function roundWithTwoEnemyFronts(): PreparedBattleRound {
  const second = {
    ...firstBattle.enemies[0]!,
    definition: { ...firstBattle.enemies[0]!.definition, id: "second-charger", name: "第二名冲撞者" },
  };
  const secondRear = {
    ...firstBattle.enemies[1]!,
    definition: { ...firstBattle.enemies[1]!.definition, id: "second-gunner", name: "第二名射手" },
  };
  const input = {
    ...firstBattle,
    party: firstBattle.party.map((member) => member.definition.id === "yuri" ? { ...member, currentBattleSCost: 3 } : member),
    enemies: [firstBattle.enemies[0]!, second, firstBattle.enemies[1]!, secondRear],
  };
  const withChargePriority = {
    ...input,
    party: input.party.map((member) => member.definition.id === "yuri"
      ? { ...member, definition: { ...member.definition, aiPriority: member.definition.aiPriority.filter((entry) => entry.cardId !== "yuri-blast") } }
      : member),
  };
  return prepared(withChargePriority);
}

describe("player card edit", () => {
  it("shows every ordinary card, ignores AI hold cost, and reports sCost and target failures", () => {
    const round = prepared();
    const choices = listPlayerCardChoices(round, definitions(), "mei");
    expect(choices.map((choice) => choice.cardId)).toEqual([null, "mei-medical", "mei-inspire", "mei-shot"]);
    expect(choices.find((choice) => choice.cardId === "mei-inspire")).toMatchObject({ available: true, disabledReason: null, cost: 2 });
    expect(choices.find((choice) => choice.cardId === "mei-medical")).toMatchObject({ available: false, disabledReason: "需要 3 sCost，当前回合起始值为 2" });
  });

  it("keeps ordered rows as the default preference and allows retargeting across every listed row", () => {
    const round = prepared();
    const yuri = round.playerActions.find((action) => action.actorId === "yuri")!;
    const group = getPlayerTargetGroup(round, yuri)!;
    expect(group.candidateIds).toEqual(["charger", "water-gunner"]);
    expect(group.defaultIds).toEqual(["charger"]);
    const sniperRound = roundWithTwoEnemyFronts();
    const sniper = sniperRound.playerActions.find((action) => action.actorId === "yuri")!;
    expect(getPlayerTargetGroup(sniperRound, sniper)).toMatchObject({
      candidateIds: ["charger", "second-charger", "water-gunner", "second-gunner"],
      defaultIds: ["charger"],
    });
    expect(buildEditedPlayerAction(round, definitions(), "yuri", "yuri-charge", ["water-gunner"])).toMatchObject({
      ok: true, action: { targetIds: ["water-gunner"] },
    });
    expect(validatePlayerTargetSelection(round, yuri, ["charger", "charger"])).toBe("目标不能重复");
  });

  it("shows cards without a legal target and keeps HP-zero allies available only to half-health healing", () => {
    const emptyEnemies = firstBattle.enemies.map((member) => ({ ...member, hp: 0 }));
    const noTargetRound = prepared({ ...firstBattle, enemies: emptyEnemies });
    const noTargetChoices = listPlayerCardChoices(noTargetRound, definitions(), "mei");
    expect(noTargetChoices.find((choice) => choice.cardId === "mei-shot")).toMatchObject({
      available: false, disabledReason: "当前没有符合规则的目标",
    });

    const injuredInput = {
      ...firstBattle,
      party: firstBattle.party.map((member) => member.definition.id === "mei" ? { ...member, currentBattleSCost: 3 } :
        member.definition.id === "shiori" ? { ...member, hp: 1 } :
          member.definition.id === "tsumugi" ? { ...member, hp: 0 } : member),
    };
    const healingRound = prepared(injuredInput);
    const medical = healingRound.playerActions.find((action) => action.actorId === "mei")!;
    expect(medical.targetIds).toEqual(["tsumugi"]);
    expect(getPlayerTargetGroup(healingRound, medical)?.candidateIds).toEqual(["shiori", "tsumugi"]);
  });

  it("keeps all-target cards at full row size", () => {
    const round = roundWithTwoEnemyFronts();
    const result = buildEditedPlayerAction(round, definitions(),
      "yuri", "yuri-blast", ["charger"]);
    expect(result).toMatchObject({ ok: false, reason: "需要选择 2 个目标" });
    const full = buildEditedPlayerAction(round, definitions(), "yuri", "yuri-blast", ["charger", "second-charger"]);
    expect(full.ok).toBe(true);
  });

  it("limits intent-target groups to frozen matching intents and preserves their original count", () => {
    const secondCharge: BattlePreparationInput["enemies"][number] = {
      ...firstBattle.enemies[1]!,
      definition: { ...firstBattle.enemies[1]!.definition, intentPattern: [{ id: "rear-charge", name: "后排冲锋", tags: ["charge"],
        effect: { kind: "attack", target: { kind: "lowest", side: "ally", rows: ["back"] } } }] },
    };
    const round = prepared({ ...firstBattle, enemies: [firstBattle.enemies[0]!, secondCharge] });
    const cover = round.playerActions.find((action) => action.actorId === "shiori")!;
    const group = getPlayerTargetGroup(round, cover)!;
    expect(cover.targetIds).toEqual(["yuri", "tsumugi"]);
    expect(group).toMatchObject({ candidateIds: ["yuri", "tsumugi"], requiredCount: 2, canChange: false });
    expect(validatePlayerTargetSelection(round, cover, ["yuri"])).toBe("需要选择 2 个目标");
    expect(validatePlayerTargetSelection(round, cover, ["yuri", "charger"])).toBe("包含不合法目标");
  });

  it("preserves every front slot and lets the rear slot move within the mixed group", () => {
    const round = roundWithTwoEnemyFronts();
    const intentAction: PreparedPlayerAction = {
      actorId: "test-mixed", kind: "card", cardId: "mixed", cardName: "混合测试", tags: [],
      effect: { kind: "attack", target: { kind: "front-and-lowest-rear", side: "enemy" } },
      targetIds: ["charger", "second-charger", "water-gunner"], costPaid: 1, sCostBeforePayment: 2,
      sCostAfterPayment: 1, reserveBypassed: false,
    };
    const group = getPlayerTargetGroup(round, intentAction)!;
    expect(group).toMatchObject({ fixedIds: ["charger", "second-charger"], requiredCount: 3, canChange: true });
    expect(validatePlayerTargetSelection(round, intentAction, ["charger", "second-charger", "second-gunner"])).toBeNull();
    expect(validatePlayerTargetSelection(round, intentAction, ["charger", "water-gunner"])).toBe("需要选择 3 个目标");
  });

  it("falls dependent cards back to observe and refunds their round-start sCost when an attack disappears", () => {
    const source = structuredClone(prepared()) as Omit<PreparedBattleRound, "playerActions"> & { playerActions: PreparedPlayerAction[] };
    source.playerActions = source.playerActions.map((action) => {
      if (action.actorId === "mei") return {
        ...action, kind: "card", cardId: "mei-inspire", cardName: "鼓舞", tags: ["support"],
        effect: { kind: "attack-buff", amount: 1, target: { kind: "lowest", side: "ally", rows: ["any"], requirement: "prepared-attack" } },
        targetIds: ["yuri"], costPaid: 2, sCostAfterPayment: 0,
      };
      if (action.actorId === "tsumugi") return {
        ...action, kind: "observe", cardId: null, cardName: null, tags: [], effect: null, targetIds: [],
        costPaid: 0, sCostAfterPayment: action.sCostBeforePayment,
      };
      return action;
    });
    const round = source as PreparedBattleRound;
    const original = round.playerActions.find((action) => action.actorId === "yuri")!;
    const result = buildEditedPlayerAction(round, definitions(), "yuri", null, []);
    expect(result).toMatchObject({
      ok: true,
      action: { actorId: "yuri", kind: "observe" },
      fallbacks: [{ actorId: "mei", cardName: "鼓舞", reason: "当前没有合法目标组" }],
    });
    if (!result.ok) throw new Error("Expected target-dependent action to fall back.");
    expect(result.playerActions.find((action) => action.actorId === "mei")).toMatchObject({
      kind: "observe", costPaid: 0, sCostBeforePayment: 2, sCostAfterPayment: 2,
    });
    expect(original).toBe(round.playerActions.find((action) => action.actorId === "yuri"));
  });

  it("falls the requested card back when its candidate action set has no eligible target group", () => {
    const source = structuredClone(prepared()) as Omit<PreparedBattleRound, "playerActions"> & { playerActions: PreparedPlayerAction[] };
    source.playerActions = source.playerActions.map((action) => ({
      ...action, kind: "observe", cardId: null, cardName: null, tags: [], effect: null, targetIds: [],
      costPaid: 0, sCostAfterPayment: action.sCostBeforePayment,
    }));
    const round = source as PreparedBattleRound;
    const result = buildEditedPlayerAction(round, definitions(), "mei", "mei-inspire", ["yuri"]);
    expect(result).toMatchObject({
      ok: true,
      action: { actorId: "mei", kind: "observe", sCostAfterPayment: 2 },
      fallbacks: [{ actorId: "mei", cardName: "鼓舞", reason: "当前行动已无合法目标组" }],
    });
  });
});
