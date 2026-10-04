import { describe, expect, it } from "vitest";
import { matchPreparedBattleRound } from "../src/battle/match.js";
import type {
  BattleActionEffect, PreparedBattleRound, PreparedEnemyIntent, PreparedPlayerAction,
  SupplementalFreeBattleAction,
} from "../src/model.js";

const shot: BattleActionEffect = { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front", "back"] } };
const cover: BattleActionEffect = { kind: "shield", amount: 2, target: { kind: "all", side: "ally", row: "front" } };

function player(actorId: string, tags: readonly string[], targetIds: readonly string[], effect: BattleActionEffect = shot): PreparedPlayerAction {
  return {
    actorId, kind: "card", cardId: `${actorId}-card`, cardName: `${actorId} card`, tags, effect, targetIds,
    costPaid: 1, sCostBeforePayment: 2, sCostAfterPayment: 1, reserveBypassed: false,
  };
}

function intent(actorId: string, tags: readonly string[], targetIds: readonly string[], effect: BattleActionEffect = shot): PreparedEnemyIntent {
  return { actorId, intentId: `${actorId}-intent`, intentName: `${actorId} intent`, tags, effect, targetIds };
}

function round(playerActions: readonly PreparedPlayerAction[], enemyIntents: readonly PreparedEnemyIntent[] = []): PreparedBattleRound {
  return { encounterId: "recipe-fixture", round: 1, combatants: [], partyStartSCost: [], playerActions, enemyIntents };
}

function freeAction(id: string, actorId: string, tags: readonly string[], targetIds: readonly string[] = [], effect: BattleActionEffect = cover): SupplementalFreeBattleAction {
  return { id, actorId, tags, targetIds, effect };
}

describe("matchPreparedBattleRound", () => {
  it("replaces enemy cover and a same-target sniper with shield removal and one normal attack", () => {
    const prepared = round(
      [player("sniper", ["sniper"], ["covered-enemy"]), player("idle", [], [])],
      [intent("enemy-cover", ["cover"], ["covered-enemy"], cover)],
    );
    const plan = matchPreparedBattleRound(prepared);

    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0]).toMatchObject({
      recipeId: "enemy-cover-ally-sniper",
      priority: 1,
      leftActorId: "enemy-cover",
      rightActorId: "sniper",
      replacementEffects: [
        { kind: "remove-round-shield", targetIds: ["covered-enemy"], amount: 2 },
        { kind: "attack", actorId: "sniper", targetIds: ["covered-enemy"], damageAdjustment: 0 },
      ],
    });
    expect(plan.consumedActionIds).toEqual([plan.matches[0]!.leftActionId, plan.matches[0]!.rightActionId]);
    expect(plan.unmatchedActions.map((action) => action.actorId)).toEqual(["idle"]);
    expect(plan.matches[0]).not.toHaveProperty("originalEffects");
  });

  it("replaces enemy charge and same-target cover with weakened damage and the original two shield", () => {
    const plan = matchPreparedBattleRound(round(
      [player("coverer", ["cover"], ["ally-target"], cover)],
      [intent("charger", ["charge"], ["ally-target"])],
    ));

    expect(plan.matches[0]).toMatchObject({
      recipeId: "enemy-charge-ally-cover",
      priority: 2,
      replacementEffects: [
        { kind: "gain-round-shield", targetIds: ["ally-target"], amount: 2 },
        { kind: "attack", actorId: "charger", targetIds: ["ally-target"], damageAdjustment: -1 },
      ],
    });
    expect(plan.unmatchedActions).toEqual([]);
  });

  it("replaces ally charge and a different actor's cover, including a free skill action", () => {
    const charge = player("charge-ally", ["charge"], ["enemy-target"]);
    const supplement = freeAction("shiori-cover", "shiori", ["cover"], ["charge-ally"]);
    const plan = matchPreparedBattleRound(round([charge]), [supplement]);

    expect(plan.matches[0]).toMatchObject({
      recipeId: "ally-charge-ally-cover",
      priority: 3,
      leftActorId: "charge-ally",
      rightActorId: "shiori",
      replacementEffects: [
        { kind: "gain-round-shield", targetIds: ["charge-ally"], amount: 1 },
        { kind: "attack", actorId: "charge-ally", targetIds: ["enemy-target"], damageAdjustment: 1 },
      ],
    });
    expect(plan.consumedActionIds).toHaveLength(2);
    expect(plan.unmatchedActions).toEqual([]);
  });

  it("requires a shared single target for cross-side recipes", () => {
    const sniperMismatch = matchPreparedBattleRound(round(
      [player("sniper", ["sniper"], ["enemy-b"])],
      [intent("cover", ["cover"], ["enemy-a"], cover)],
    ));
    const coverMismatch = matchPreparedBattleRound(round(
      [player("coverer", ["cover"], ["ally-b"], cover)],
      [intent("charger", ["charge"], ["ally-a"])],
    ));

    expect(sniperMismatch.matches).toEqual([]);
    expect(sniperMismatch.unmatchedActions.map((action) => action.effect)).toEqual([shot, cover]);
    expect(coverMismatch.matches).toEqual([]);
    expect(coverMismatch.unmatchedActions).toHaveLength(2);
  });

  it("requires different Chara for ally charge plus cover", () => {
    const sameActor = matchPreparedBattleRound(round([player("same", ["charge", "cover"], ["enemy-target"], shot)]));
    const differentActors = matchPreparedBattleRound(round([
      player("charger", ["charge"], ["enemy-target"]), player("coverer", ["cover"], ["charger"], cover),
    ]));
    const coverFirst = matchPreparedBattleRound(round([
      player("coverer", ["cover"], ["charger"], cover), player("charger", ["charge"], ["enemy-target"]),
    ]));

    expect(sameActor.matches).toEqual([]);
    expect(sameActor.unmatchedActions).toHaveLength(1);
    expect(differentActors.matches[0]?.recipeId).toBe("ally-charge-ally-cover");
    expect(coverFirst.matches[0]).toMatchObject({ leftActorId: "charger", rightActorId: "coverer" });
  });

  it("uses priority before tag-list order when multi-tag actions compete", () => {
    const prepared = round(
      [player("multi-player", ["cover", "sniper"], ["shared-target"], shot)],
      [intent("multi-enemy", ["charge", "cover"], ["shared-target"], cover)],
    );
    const reversedTags = round(
      [player("multi-player", ["sniper", "cover"], ["shared-target"], shot)],
      [intent("multi-enemy", ["cover", "charge"], ["shared-target"], cover)],
    );

    const first = matchPreparedBattleRound(prepared);
    const second = matchPreparedBattleRound(reversedTags);
    expect(first.matches.map((match) => match.recipeId)).toEqual(["enemy-cover-ally-sniper"]);
    expect(second.matches.map((match) => match.recipeId)).toEqual(["enemy-cover-ally-sniper"]);
    expect(first.consumedActionIds).toHaveLength(2);
    expect(first.unmatchedActions).toEqual([]);
  });

  it("pairs competing same-side actions in column order and consumes each at most once", () => {
    const prepared = round([
      player("charge-a", ["charge"], ["enemy-a"]),
      player("charge-b", ["charge"], ["enemy-b"]),
    ]);
    const supplements = [
      freeAction("first-cover", "cover-a", ["cover"], ["charge-a"]),
      freeAction("second-cover", "cover-b", ["cover"], ["charge-b"]),
    ];
    const plan = matchPreparedBattleRound(prepared, supplements);

    expect(plan.matches.map((match) => [match.leftActorId, match.rightActorId])).toEqual([
      ["charge-a", "cover-a"],
      ["charge-b", "cover-b"],
    ]);
    expect(new Set(plan.consumedActionIds).size).toBe(plan.consumedActionIds.length);
    expect(plan.matches.flatMap((match) => [match.leftActionId, match.rightActionId])).toEqual(plan.consumedActionIds);
    expect(plan.unmatchedActions).toEqual([]);
  });

  it("preserves unmatched action effects and does not mutate prepared or free-action input", () => {
    const prepared = round([player("idle", ["shoot"], ["enemy"], shot)]);
    const supplemental = [freeAction("unmatched", "skill-user", ["support"], ["ally"], cover)];
    const before = structuredClone({ prepared, supplemental });
    const plan = matchPreparedBattleRound(prepared, supplemental);

    expect(plan.matches).toEqual([]);
    expect(plan.unmatchedActions.map((action) => action.effect)).toEqual([shot, cover]);
    expect(prepared).toEqual(before.prepared);
    expect(supplemental).toEqual(before.supplemental);
  });
});
