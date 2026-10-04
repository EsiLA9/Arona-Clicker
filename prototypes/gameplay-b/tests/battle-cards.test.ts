import { describe, expect, it } from "vitest";
import { matchPreparedBattleRound } from "../src/battle/match.js";
import { prepareBattleRoundWithSkills } from "../src/battle/prepare.js";
import { firstBattle } from "../src/content/first-battle.js";
import type { BattlePreparationInput, BattleRecipePlan } from "../src/model.js";
import { initialPlayerTargetsAfterDrop, playerCardCanStartTargetDrag, playerTargetSelectionIsComplete, pointerMovedPastCardDragThreshold, preparedCardPosition, projectPreparedBattleCards, togglePlayerTargetSelection } from "../src/view.js";
import type { PlayerTargetEditOption } from "../src/runtime.js";

function preparedFixture(round = 1) {
  const input: BattlePreparationInput = {
    ...firstBattle,
    round,
    party: firstBattle.party.map((member) => ({ ...member, currentBattleSCost: 5 })),
  };
  const prepared = prepareBattleRoundWithSkills(input, { nextInt: () => 1 });
  const plan = matchPreparedBattleRound(prepared.round, prepared.skills.supplementalFreeActions);
  return { ...prepared, plan };
}

describe("prepared battle cards", () => {
  it("starts drag only for editable target groups after the pointer threshold", () => {
    expect(playerCardCanStartTargetDrag(undefined)).toBe(false);
    expect(playerCardCanStartTargetDrag({ editable: false })).toBe(false);
    expect(playerCardCanStartTargetDrag({ editable: true })).toBe(true);
    expect(pointerMovedPastCardDragThreshold(10, 10, 15.99, 10)).toBe(false);
    expect(pointerMovedPastCardDragThreshold(10, 10, 16, 10)).toBe(true);
    expect(pointerMovedPastCardDragThreshold(10, 10, 14, 15)).toBe(true);
  });

  it("gives every stacked card its own visible drag surface and reserves its full lane", () => {
    const action = preparedCardPosition(2, 0);
    const skill = preparedCardPosition(2, 1);

    expect(skill.topInset).toBeGreaterThan(action.topInset + 62);
    expect(action.rightInset).toBeGreaterThan(skill.rightInset);
    expect(action.reservedHeight).toBeGreaterThan(skill.topInset + 62);
    expect(action.reservedWidth).toBeGreaterThan(112 + action.rightInset);
    expect(() => preparedCardPosition(2, 2)).toThrow(RangeError);
  });

  it("keeps a dragged multi-target group at its required shape until explicit confirmation", () => {
    const mixed: PlayerTargetEditOption = {
      cardRef: "player-action:0:attacker", actorId: "attacker", kind: "ordinary", skillId: null,
      candidateIds: ["front-a", "front-b", "rear-a", "rear-b"], fixedIds: ["front-a", "front-b"],
      defaultIds: ["front-a", "front-b", "rear-a"], targetIds: ["front-a", "front-b", "rear-a"],
      requiredCount: 3, canChange: true, editable: true, disabledReason: null,
    };
    const selected = initialPlayerTargetsAfterDrop(mixed, "rear-b");
    expect(selected).toEqual(["front-a", "front-b", "rear-b"]);
    expect(playerTargetSelectionIsComplete(mixed.fixedIds, mixed.requiredCount, selected)).toBe(true);

    const variableGroup = { candidateIds: ["ally-a", "ally-b", "ally-c"], fixedIds: [], requiredCount: 2 };
    let draft = initialPlayerTargetsAfterDrop({ ...mixed, ...variableGroup }, "ally-a");
    expect(playerTargetSelectionIsComplete([], 2, draft)).toBe(false);
    draft = togglePlayerTargetSelection(variableGroup.candidateIds, [], 2, draft, "ally-b").selectedIds;
    expect(playerTargetSelectionIsComplete([], 2, draft)).toBe(true);
    expect(togglePlayerTargetSelection(variableGroup.candidateIds, [], 2, draft, "ally-c")).toMatchObject({
      selectedIds: ["ally-a", "ally-b"], error: "目标数量已满；请先取消一个已选目标。",
    });
  });

  it("projects only frozen player actions, enemy intents, and triggered skills with their displayed costs", () => {
    const { round, skills, plan } = preparedFixture();
    const beforeRound = structuredClone(round);
    const beforeSkills = structuredClone(skills);
    const batch = projectPreparedBattleCards(round, skills, plan);

    expect(batch.id).toBe(`${round.encounterId}:1`);
    expect(batch.cards.filter((card) => card.kind === "player-action")).toHaveLength(round.playerActions.length);
    expect(batch.cards.filter((card) => card.kind === "enemy-intent")).toHaveLength(round.enemyIntents.length);
    expect(batch.cards.filter((card) => card.kind === "special-skill").map((card) => card.title)).toEqual(
      skills.checks.filter((check) => check.triggered).map((check) => ({
        "shiori-companion-cover": "并肩掩护",
        "yuri-follow-up": "乘势追击",
        "mei-encouragement": "鼓劲",
        "tsumugi-calibrated-sight": "校准镜",
      }[check.skillId] ?? check.skillId)),
    );
    expect(batch.cards.find((card) => card.actorId === "tsumugi" && card.kind === "player-action"))
      .toMatchObject({ title: "狙击", costLabel: "sCost −3" });
    expect(batch.cards.filter((card) => card.kind === "enemy-intent").every((card) => card.costLabel === "sCost —")).toBe(true);
    expect(batch.cards.filter((card) => card.kind === "special-skill").every((card) => card.costLabel === "免费 · sCost 0")).toBe(true);
    expect(round).toEqual(beforeRound);
    expect(skills).toEqual(beforeSkills);
  });

  it("maps effects to character cards, modifiers to action cards, and recipes to other cards", () => {
    const { round, skills, plan } = preparedFixture();
    const shioriActionIndex = round.playerActions.findIndex((action) => action.actorId === "shiori");
    const meiSkillActionIndex = skills.supplementalFreeActions.findIndex((action) => action.actorId === "mei");
    const shioriActionId = `player-action:${shioriActionIndex}:shiori`;
    const meiFreeActionId = `free-skill:${meiSkillActionIndex}:mei:mei-encouragement`;
    const recipePlan: BattleRecipePlan = {
      ...plan,
      matches: [...plan.matches, {
        recipeId: "test-action-card-partner", priority: 99,
        leftActionId: shioriActionId, leftActorId: "shiori",
        rightActionId: meiFreeActionId, rightActorId: "mei", replacementEffects: [],
      }],
    };
    const batch = projectPreparedBattleCards(round, skills, recipePlan);
    const meiSkillCard = "special-skill:mei:mei-encouragement";
    const tsumugiAction = `player-action:${round.playerActions.findIndex((action) => action.actorId === "tsumugi")}:tsumugi`;

    expect(batch.relations).toContainEqual({ from: meiSkillCard, to: "character:tsumugi", kind: "effect-target" });
    expect(batch.relations).toContainEqual({ from: meiSkillCard, to: tsumugiAction, kind: "modifies-action" });
    expect(batch.relations).toContainEqual({ from: shioriActionId, to: meiSkillCard, kind: "recipe-partner" });
    expect(batch.relations).toContainEqual({ from: meiSkillCard, to: shioriActionId, kind: "recipe-partner" });
    expect(batch.relations.some((relation) => relation.to.startsWith("character:"))).toBe(true);
    expect(batch.relations.some((relation) => relation.to.startsWith("player-action:"))).toBe(true);
    expect(batch.relations.some((relation) => relation.to.startsWith("special-skill:"))).toBe(true);
  });

  it("gives each prepared round a new batch identity for one-time entry and recycling", () => {
    const first = preparedFixture(1);
    const second = preparedFixture(2);

    const firstBatch = projectPreparedBattleCards(first.round, first.skills, first.plan);
    const repeatedFirstBatch = projectPreparedBattleCards(first.round, first.skills, first.plan);
    const secondBatch = projectPreparedBattleCards(second.round, second.skills, second.plan);

    expect(repeatedFirstBatch).toEqual(firstBatch);
    expect(firstBatch.id).not.toBe(secondBatch.id);
    expect(new Set(firstBatch.cards.map((card) => card.id)).size).toBe(firstBatch.cards.length);
    expect(new Set(secondBatch.cards.map((card) => card.id)).size).toBe(secondBatch.cards.length);
  });

  it("does not create a special-skill card for a failed prepared trigger", () => {
    const input: BattlePreparationInput = {
      ...firstBattle,
      party: firstBattle.party.map((member) => ({ ...member, currentBattleSCost: 5 })),
    };
    const prepared = prepareBattleRoundWithSkills(input, { nextInt: () => 4 });
    const plan = matchPreparedBattleRound(prepared.round, prepared.skills.supplementalFreeActions);
    const batch = projectPreparedBattleCards(prepared.round, prepared.skills, plan);

    expect(prepared.skills.checks.some((check) => check.status === "not-triggered")).toBe(true);
    expect(batch.cards.filter((card) => card.kind === "special-skill")).toEqual([]);
  });

  it("shows observation as a zero-cost action with capped recovery", () => {
    const input: BattlePreparationInput = {
      ...firstBattle,
      party: firstBattle.party.map((member) => ({ ...member, currentBattleSCost: 0 })),
    };
    const prepared = prepareBattleRoundWithSkills(input, { nextInt: () => 4 });
    const plan = matchPreparedBattleRound(prepared.round, prepared.skills.supplementalFreeActions);
    const batch = projectPreparedBattleCards(prepared.round, prepared.skills, plan);
    const observations = batch.cards.filter((card) => card.kind === "player-action");

    expect(observations.every((card) => card.title === "观察 / 待机")).toBe(true);
    expect(observations.every((card) => card.costLabel === "sCost 0")).toBe(true);
    expect(observations.every((card) => card.description.includes("最多回复 1 点 sCost"))).toBe(true);
  });
});
