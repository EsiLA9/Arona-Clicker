import { describe, expect, it } from "vitest";
import type { BattleActionEffect, BattleEnemyMember, BattlePartyMember, BattlePreparationInput, RunConfig } from "../src/model.js";
import { firstBattle } from "../src/content/first-battle.js";
import { matchPreparedBattleRound } from "../src/battle/match.js";
import { prepareBattleRound } from "../src/battle/prepare.js";
import { resolveBattleRound } from "../src/battle/resolve.js";
import { GameplayBBattleRuntime, GameplayBRuntime, GameplayBRouteRuntime } from "../src/runtime.js";

function makeConfig(seed: number | string, initialHp = [8, 8, 8, 8]): RunConfig {
  return {
    seed,
    characters: [
      { id: "shiori", name: "小栞", row: "front", hpMax: 8, initialHp: initialHp[0], atk: 2, def: 1, activityTags: ["observe"] },
      { id: "yuri", name: "由理", row: "front", hpMax: 8, initialHp: initialHp[1], atk: 3, def: 0, activityTags: ["search"] },
      { id: "mei", name: "芽衣", row: "back", hpMax: 8, initialHp: initialHp[2], atk: 2, def: 0, activityTags: ["support"] },
      { id: "tsumugi", name: "纺希", row: "back", hpMax: 8, initialHp: initialHp[3], atk: 3, def: 0, activityTags: ["aim"] },
    ],
    activityLocation: {
      id: "arcade-walkway",
      name: "林荫连廊",
      activityCount: 2,
      activityRule: {
        dieSides: 2,
        outcomes: {
          1: { kind: "clue", text: "发现一条线索，只记录在日志中。" },
          2: { kind: "none", text: "没有发现新线索。" },
        },
      },
    },
    exitLocation: { id: "exit", name: "游乐场出口" },
  };
}

describe("Gameplay B deterministic location runtime", () => {
  it("runs one group activity per Click and enters the exit after activity two", () => {
    const runtime = new GameplayBRuntime(makeConfig(42));
    const initial = runtime.getView();

    expect(initial.phase).toBe("activity");
    expect(initial.currentLocation.id).toBe("arcade-walkway");
    expect(initial.activityRemaining).toBe(2);
    expect(initial.characters).toHaveLength(4);
    expect(initial.events[0]?.type).toBe("location-entered");

    const firstClick = runtime.click();
    const firstResults = firstClick.events.filter((event) => event.type === "activity-result");
    expect(firstClick.activityRemaining).toBe(1);
    expect(firstResults).toHaveLength(4);
    expect(firstResults.every((event) => event.dice?.value !== undefined)).toBe(true);
    expect(firstResults.every((event) => event.outcome !== undefined)).toBe(true);
    expect(firstClick.rngCursor).toBe(4);

    const secondClick = runtime.click();
    expect(secondClick.phase).toBe("exit");
    expect(secondClick.currentLocation).toEqual({ id: "exit", name: "游乐场出口", kind: "exit" });
    expect(secondClick.activityRemaining).toBeNull();
    expect(secondClick.events.filter((event) => event.type === "activity-result")).toHaveLength(8);
    expect(secondClick.events.filter((event) => event.type === "location-entered")).toHaveLength(2);
    expect(secondClick.events.at(-1)?.type).toBe("location-entered");
    expect(secondClick.events.at(-1)?.text).toContain("出口尚未执行");
    expect(secondClick.terminal).toBe(false);
    expect(secondClick.rngCursor).toBe(8);
  });

  it("finishes on the third Click and makes terminal Clicks idempotent", () => {
    const runtime = new GameplayBRuntime(makeConfig("exit-check"));
    runtime.click();
    runtime.click();

    const completed = runtime.click();
    expect(completed.phase).toBe("complete");
    expect(completed.terminal).toBe(true);
    expect(completed.clickCount).toBe(3);
    expect(completed.events.at(-1)?.type).toBe("demo-completed");

    expect(runtime.click()).toEqual(completed);
    expect(runtime.getView()).toEqual(completed);
  });

  it("replays the same events for the same seed and Click sequence", () => {
    const run = (seed: number | string) => {
      const runtime = new GameplayBRuntime(makeConfig(seed));
      runtime.click();
      runtime.click();
      return runtime.click();
    };

    expect(run("repeatable-seed")).toEqual(run("repeatable-seed"));
    const rollsA = run(1).events.filter((event) => event.type === "activity-result").map((event) => event.dice?.value);
    const rollsB = run(2).events.filter((event) => event.type === "activity-result").map((event) => event.dice?.value);
    expect(rollsA).not.toEqual(rollsB);
  });

  it("skips downed characters and only draws during activity Clicks", () => {
    const runtime = new GameplayBRuntime(makeConfig(7, [8, 0, 8, 8]));

    runtime.getView();
    runtime.getView();
    expect(runtime.getView().rngCursor).toBe(0);

    const afterClick = runtime.click();
    const results = afterClick.events.filter((event) => event.type === "activity-result");
    expect(results.map((event) => event.sourceId)).toEqual(["shiori", "mei", "tsumugi"]);
    expect(afterClick.rngCursor).toBe(3);
  });

  it("isolates both input configuration and returned views from runtime state", () => {
    const config = makeConfig(1);
    const runtime = new GameplayBRuntime(config);
    const mutableConfig = config as unknown as {
      characters: Array<{ name: string }>;
      activityLocation: {
        activityRule: { outcomes: Record<number, { kind: "clue" | "none"; text: string }> };
      };
    };
    mutableConfig.characters[0]!.name = "外部改名";
    mutableConfig.activityLocation.activityRule.outcomes[1]!.text = "外部改写";

    const view = runtime.click();
    expect(view.characters[0]?.name).toBe("小栞");
    expect(view.events.some((event) => event.text.includes("外部改写"))).toBe(false);

    const mutableView = view as unknown as {
      characters: Array<{ hp: number; activityTags: string[] }>;
      events: Array<{ text: string; dice?: { value: number } }>;
    };
    expect(() => {
      mutableView.characters[0]!.hp = 0;
    }).toThrow();
    expect(() => {
      mutableView.characters[0]!.activityTags.push("tampered");
    }).toThrow();
    expect(() => {
      mutableView.events[0]!.text = "篡改日志";
    }).toThrow();
    if (mutableView.events[1]?.dice) {
      expect(() => {
        mutableView.events[1]!.dice!.value = 99;
      }).toThrow();
    }

    const nextView = runtime.getView();
    expect(nextView.characters[0]?.hp).toBe(8);
    expect(nextView.characters[0]?.activityTags).not.toContain("tampered");
    expect(nextView.events.some((event) => event.text === "篡改日志")).toBe(false);
  });

  it("rejects an initial party other than four or an activity count other than two", () => {
    const tooFew = makeConfig(3);
    const mutableParty = tooFew as unknown as { characters: RunConfig["characters"] };
    mutableParty.characters = tooFew.characters.slice(0, 3);
    expect(() => new GameplayBRuntime(tooFew)).toThrow(/exactly four/);

    const wrongActivityCount = makeConfig(3);
    const mutableLocation = wrongActivityCount as unknown as {
      activityLocation: { id: string; name: string; activityCount: number; activityRule: RunConfig["activityLocation"]["activityRule"] };
    };
    mutableLocation.activityLocation.activityCount = 1;
    expect(() => new GameplayBRuntime(wrongActivityCount)).toThrow(/activity count 2/);
  });
});

function makeBattleResultFixture(result: "victory" | "defeat" | "draw"): BattlePreparationInput {
  const party = firstBattle.party.map((member, index) => {
    const hp = result === "draw" ? (index === 0 ? 1 : 0) : result === "defeat" ? 1 : 10;
    if (index !== 0) return { ...member, hp, definition: { ...member.definition, hpMax: Math.max(member.definition.hpMax, hp), cards: [], aiPriority: [] } };
    const sweep = { id: "fixture-sweep", name: "横扫", cost: 0, tags: ["blast"], effect: { kind: "attack" as const, target: { kind: "all" as const, side: "enemy" as const, row: "front" as const } } };
    return { ...member, hp, definition: { ...member.definition, hpMax: Math.max(member.definition.hpMax, hp), atk: 20, cards: [sweep], aiPriority: [{ cardId: sweep.id, condition: { kind: "always" as const }, holdCost: 0 }] } };
  });
  const enemies = firstBattle.enemies.map((member, index) => ({
    ...member,
    hp: result === "victory" || result === "draw" ? 1 : 8,
    definition: {
      ...member.definition,
      row: result === "defeat" ? member.definition.row : "front" as const,
      hpMax: Math.max(member.definition.hpMax, result === "victory" || result === "draw" ? 1 : 8),
      atk: result === "defeat" ? 10 : 1,
      intentPattern: [{
        id: "fixture-intent-" + index,
        name: "攻击",
        tags: ["charge"],
        effect: {
          kind: "attack" as const,
          target: result === "draw"
            ? { kind: "all" as const, side: "ally" as const, row: "front" as const }
            : { kind: "all" as const, side: "ally" as const, row: index === 0 ? "front" as const : "back" as const },
        },
      }],
    },
  }));
  return { encounterId: "runtime-" + result, round: 1, party, enemies };
}

describe("Gameplay B first-battle runtime", () => {
  it("shows four allies and two enemies with one frozen round before the first Click", () => {
    const runtime = new GameplayBBattleRuntime(firstBattle);
    const initial = runtime.getView();
    expect(initial.state.combatants.filter((actor) => actor.side === "ally")).toHaveLength(4);
    expect(initial.state.combatants.filter((actor) => actor.side === "enemy")).toHaveLength(2);
    expect(initial.pendingRound?.round).toBe(1);
    expect(initial.clickCount).toBe(0);
    expect(runtime.getView()).toEqual(initial);
    expect(Object.isFrozen(initial.pendingRound)).toBe(true);
    expect(() => { (initial.pendingRound!.playerActions as unknown[]).push({}); }).toThrow();
  });

  it("one Click resolves exactly the displayed frozen round and prepares the next", () => {
    const runtime = new GameplayBBattleRuntime(firstBattle);
    const prepared = runtime.getView().pendingRound!;
    const resolved = runtime.click();
    expect(resolved.clickCount).toBe(1);
    expect(resolved.lastResolution?.prepared).toEqual(prepared);
    expect(resolved.state.round).toBe(1);
    expect(resolved.pendingRound?.round).toBe(2);
    expect(resolved.events.length).toBeGreaterThan(0);
    expect(runtime.getView()).toEqual(resolved);
  });

  it.each(["victory", "defeat", "draw"] as const)("keeps %s terminal Clicks idempotent and clears battle sCost", (result) => {
    const runtime = new GameplayBBattleRuntime(makeBattleResultFixture(result));
    const terminal = runtime.click();
    expect(terminal.state.result).toBe(result);
    expect(terminal.terminal).toBe(true);
    expect(terminal.pendingRound).toBeNull();
    expect(terminal.state.partySCost.every((entry) => entry.value === 0)).toBe(true);
    expect(runtime.click()).toEqual(terminal);
    expect(runtime.getView()).toEqual(terminal);
  });
});

function secondFrontEnemy(): BattleEnemyMember {
  return { definition: { ...firstBattle.enemies[1]!.definition, id: "second-front", name: "备用前排", row: "front", hpMax: 7, intentPattern: [] }, hp: 7 };
}

function testReina(): BattlePartyMember {
  const cover: BattleActionEffect = { kind: "shield", amount: 2, target: { kind: "intent-target", intentTag: "charge" } };
  return { definition: { id: "reina", name: "玲奈", row: "front", hpMax: 12, atk: 2, def: 1, cards: [
    { id: "reina-blast", name: "破阵爆破", cost: 2, tags: ["blast"], effect: { kind: "attack", target: { kind: "all", side: "enemy", row: "front" } } },
    { id: "reina-cover", name: "掩护", cost: 2, tags: ["cover"], effect: cover },
  ], aiPriority: [
    { cardId: "reina-blast", condition: { kind: "enemy-front-count", minimum: 2 }, holdCost: 0 },
    { cardId: "reina-cover", condition: { kind: "enemy-intent", tag: "charge" }, holdCost: 1, reserveException: "cover-enemy-charge" },
  ] }, hp: 12, currentBattleSCost: 2 };
}

function testChise(): BattlePartyMember {
  return { definition: { id: "chise", name: "千世", row: "front", hpMax: 9, atk: 1, def: 0, cards: [], aiPriority: [] }, hp: 9, currentBattleSCost: 2 };
}

function editRouteRuntime(): GameplayBRouteRuntime {
  const attacker: BattlePartyMember = { definition: { id: "attacker", name: "射手", row: "back", hpMax: 10, atk: 3, def: 0,
    cards: [
      { id: "sniper", name: "狙击", cost: 1, tags: ["sniper"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } },
      { id: "heavy", name: "重击", cost: 2, tags: ["blast"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } },
    ],
    aiPriority: [{ cardId: "sniper", condition: { kind: "always" }, holdCost: 0 }] }, hp: 10, currentBattleSCost: 2 };
  const cover: BattleEnemyMember = { definition: { id: "guard", name: "护具学生", row: "front", hpMax: 5, atk: 0, def: 1,
    intentPattern: [{ id: "guard-cover", name: "掩护", tags: ["cover"], effect: { kind: "shield", amount: 2, target: { kind: "lowest", side: "enemy", rows: ["front"] } } }] }, hp: 5 };
  const other = secondFrontEnemy();
  return new GameplayBRouteRuntime({
    seed: "card-edit-route",
    nodes: [
      { id: "battle", name: "测试战斗", kind: "battle", battle: { encounterId: "edit-route", enemies: [cover, other] } },
      { id: "exit", name: "出口", kind: "exit", completionText: "完成" },
    ],
    initialParty: [{
      roster: { id: "attacker", name: "射手", row: "back", hpMax: 10, initialHp: 10, atk: 3, def: 0, activityTags: [] },
      battle: attacker.definition,
    }],
  });
}

describe("Gameplay B pending player edits", () => {
  it("atomically redirects a single target, recomputes recipes, and leaves Click/RNG/events untouched", () => {
    const runtime = editRouteRuntime();
    const before = runtime.getView();
    const initialBattle = before.currentBattle!;
    expect(initialBattle.pendingRecipePlan?.matches[0]).toMatchObject({ recipeId: "enemy-cover-ally-sniper" });
    expect(initialBattle.playerCardChoices.find((choice) => choice.actorId === "attacker" && choice.cardId === "sniper")).toMatchObject({
      available: true, targetIds: ["guard"], candidateTargetIds: ["guard", "second-front"],
    });

    expect(runtime.editPlayerAction("attacker", "sniper", ["second-front"])).toEqual({ ok: true });
    const edited = runtime.getView();
    expect(edited.currentBattle?.pendingRound?.playerActions[0]?.targetIds).toEqual(["second-front"]);
    expect(edited.currentBattle?.pendingRecipePlan?.matches).toEqual([]);
    expect(edited.currentBattle?.pendingSkills).toEqual(initialBattle.pendingSkills);
    expect(edited.currentBattle?.rngCursor).toBe(initialBattle.rngCursor);
    expect(edited.currentBattle?.clickCount).toBe(0);
    expect(edited.clickCount).toBe(0);
    expect(edited.events).toEqual(before.events);

    expect(runtime.editPlayerAction("attacker", "heavy", ["guard"])).toEqual({ ok: true });
    const reselected = runtime.getView();
    expect(reselected.currentBattle?.pendingRound?.playerActions[0]).toMatchObject({
      cardId: "heavy", costPaid: 2, sCostBeforePayment: 2, sCostAfterPayment: 0, targetIds: ["guard"],
    });
    expect(runtime.editPlayerAction("attacker", "heavy", ["missing"])).toMatchObject({ ok: false });
    expect(runtime.getView()).toEqual(reselected);
    const resolved = runtime.click();
    expect(resolved.currentBattle?.lastResolution?.prepared.playerActions[0]).toMatchObject({ cardId: "heavy", targetIds: ["guard"] });
    expect(resolved.clickCount).toBe(1);
  });

  it("exposes and commits front-to-rear retargeting for a normal single-target action", () => {
    let runtime: GameplayBBattleRuntime | undefined;
    for (let seed = 0; seed < 100; seed += 1) {
      const candidate = new GameplayBBattleRuntime(firstBattle, seed);
      const checks = candidate.getView().pendingSkills?.checks ?? [];
      if (!checks.some((check) => check.triggered && ["yuri-follow-up", "mei-encouragement"].includes(check.skillId))) {
        runtime = candidate;
        break;
      }
    }
    expect(runtime).toBeDefined();
    const before = runtime!.getView();
    expect(before.targetEditOptions.find((option) => option.actorId === "yuri" && option.kind === "ordinary")).toMatchObject({
      editable: true, candidateIds: ["charger", "water-gunner"], targetIds: ["charger"],
    });
    expect(before.playerCardChoices.find((choice) => choice.actorId === "yuri" && choice.cardId === "yuri-charge")).toMatchObject({
      targetIds: ["charger"], candidateTargetIds: ["charger", "water-gunner"],
    });
    expect(runtime!.editPlayerAction("yuri", "yuri-charge", ["water-gunner"])).toEqual({ ok: true });
    expect(runtime!.getView().pendingRound?.playerActions.find((action) => action.actorId === "yuri")?.targetIds).toEqual(["water-gunner"]);
  });

  it("redirects an independent free-skill target without rechecking its frozen die", () => {
    const woundedParty = [...firstBattle.party.map((member) => member.definition.id === "shiori" ? { ...member, hp: 4 } :
      member.definition.id === "yuri" ? { ...member, hp: 5 } : member), testChise()];
    const runtimeForSeed = (seed: number) => new GameplayBBattleRuntime({ ...firstBattle, party: woundedParty }, seed);
    let runtime: GameplayBBattleRuntime | undefined;
    for (let seed = 0; seed < 80; seed += 1) {
      const candidate = runtimeForSeed(seed);
      if (candidate.getView().pendingSkills?.checks.some((check) => check.skillId === "chise-first-aid-instinct" && check.triggered)) {
        runtime = candidate;
        break;
      }
    }
    expect(runtime).toBeDefined();
    const before = runtime!.getView();
    expect(before.targetEditOptions.find((option) => option.skillId === "chise-first-aid-instinct")).toMatchObject({ editable: true, targetIds: ["shiori"] });
    const dice = before.pendingSkills?.checks;
    expect(runtime!.editFreeSkillTargets("chise", "chise-first-aid-instinct", ["yuri"])).toEqual({ ok: true });
    const after = runtime!.getView();
    expect(after.pendingSkills?.supplementalFreeActions.find((action) => action.id === "chise-first-aid-instinct")?.targetIds).toEqual(["yuri"]);
    expect(after.pendingSkills?.checks).toEqual(dice);
    expect(after.rngCursor).toBe(before.rngCursor);
    expect(after.clickCount).toBe(before.clickCount);
  });

  it("commits target-dependent observe fallbacks atomically and returns the spent sCost", () => {
    const input: BattlePreparationInput = {
      ...firstBattle,
      party: firstBattle.party.map((member) => member.definition.id === "mei"
        ? { ...member, currentBattleSCost: 4 }
        : member),
    };
    let runtime: GameplayBBattleRuntime | undefined;
    for (let seed = 0; seed < 100; seed += 1) {
      const candidate = new GameplayBBattleRuntime(input, seed);
      const checks = candidate.getView().pendingSkills?.checks ?? [];
      if (!checks.some((check) => check.triggered && ["yuri-follow-up", "mei-encouragement"].includes(check.skillId))) {
        runtime = candidate;
        break;
      }
    }
    expect(runtime).toBeDefined();
    const before = runtime!.getView();
    expect(before.pendingRound?.playerActions.find((action) => action.actorId === "yuri")).toMatchObject({ cardId: "yuri-charge", effect: { kind: "attack" } });
    expect(before.pendingRound?.playerActions.find((action) => action.actorId === "mei")).toMatchObject({ cardId: "mei-inspire", costPaid: 2, sCostAfterPayment: 2 });

    const outcome = runtime!.editPlayerAction("yuri", null, []);
    expect(outcome).toMatchObject({ ok: true, fallbacks: [{ actorId: "mei", cardName: "鼓舞" }] });
    const edited = runtime!.getView();
    expect(edited.pendingRound?.playerActions.find((action) => action.actorId === "yuri")).toMatchObject({ kind: "observe", sCostBeforePayment: 2, sCostAfterPayment: 2 });
    expect(edited.pendingRound?.playerActions.find((action) => action.actorId === "mei")).toMatchObject({ kind: "observe", costPaid: 0, sCostBeforePayment: 4, sCostAfterPayment: 4 });
    expect(edited.pendingSkills).toEqual(before.pendingSkills);
    expect(edited.rngCursor).toBe(before.rngCursor);
    expect(edited.clickCount).toBe(before.clickCount);
    expect(edited.events).toEqual(before.events);

    const resolved = runtime!.click();
    expect(resolved.lastResolution?.prepared.playerActions.find((action) => action.actorId === "mei")).toMatchObject({ kind: "observe", sCostAfterPayment: 4 });
    expect(resolved.state.partySCost.find((entry) => entry.actorId === "mei")?.value).toBe(5);
  });

  it("keeps an action-coupled skill target locked and dims incompatible ordinary-card replacements", () => {
    const party = firstBattle.party.map((member) => member.definition.id === "shiori" ? { ...member, currentBattleSCost: 0 } :
      member.definition.id === "yuri" ? { ...member, currentBattleSCost: 3,
        definition: { ...member.definition, aiPriority: member.definition.aiPriority.filter((entry) => entry.cardId !== "yuri-blast") } } : member);
    const runtime = new GameplayBBattleRuntime({ ...firstBattle, party, enemies: [...firstBattle.enemies, secondFrontEnemy()] }, 8);
    const view = runtime.getView();
    expect(view.pendingSkills?.effects.some((effect) => effect.skillId === "yuri-follow-up")).toBe(true);
    expect(view.targetEditOptions.find((option) => option.cardRef === "player-action:1:yuri")).toMatchObject({ editable: false });
    expect(view.playerCardChoices.find((choice) => choice.actorId === "yuri" && choice.cardId === "yuri-blast")).toMatchObject({
      available: false, disabledReason: "本轮免费技能已绑定原行动与目标，不能改选或改目标",
    });
    expect(runtime.editPlayerAction("yuri", "yuri-blast", ["charger", "second-front"])).toMatchObject({
      ok: false, reason: "本轮免费技能已绑定原行动与目标，不能改选或改目标",
    });
    expect(runtime.getView()).toEqual(view);
  });
});

describe("Gameplay B skill and recipe Runtime", () => {
  it("prepares once before Click, freezes skills and matcher plan, and keeps reads RNG-pure", () => {
    const input = { ...firstBattle, party: firstBattle.party.map((member) => member.definition.id === "shiori" ? { ...member, currentBattleSCost: 0 } : member) };
    const runtime = new GameplayBBattleRuntime(input, 8);
    const prepared = runtime.getView();
    expect(prepared).toMatchObject({ seed: 8, rngCursor: 3, clickCount: 0 });
    expect(prepared.pendingSkills?.checks.slice(0, 3).map(({ actorId, status, dieRoll }) => [actorId, status, dieRoll])).toEqual([
      ["shiori", "triggered", 1], ["yuri", "triggered", 1], ["mei", "not-triggered", 2],
    ]);
    expect(runtime.getView()).toEqual(prepared);
    const clicked = runtime.click();
    expect(clicked.lastResolution?.prepared).toEqual(prepared.pendingRound);
    expect(clicked.lastResolution?.recipePlan).toEqual(prepared.pendingRecipePlan);
    expect(clicked.lastResolution?.skills).toEqual(prepared.pendingSkills);
    expect(clicked.lastResolution?.recipePlan.matches[0]).toMatchObject({ recipeId: "enemy-charge-ally-cover", rightActionId: "free-skill:0:shiori:shiori-companion-cover" });
    expect(clicked.lastResolution?.deltas.find((delta) => delta.actorId === "charger")?.damage).toBe(4);
    expect(clicked.lastResolution?.skills.effects.filter((effect) => effect.skillId === "yuri-follow-up")).toHaveLength(1);
    expect(clicked.lastResolution?.events.filter((event) => event.includes("追击") && event.includes("固定 1 点")).length).toBe(1);
    expect(runtime.getView()).toEqual(clicked);
  });

  it("replays the same seed and Click sequence in the view and event log", () => {
    const replay = () => {
      const runtime = new GameplayBBattleRuntime(firstBattle, 8);
      runtime.click(); runtime.click();
      return runtime.getView();
    };
    expect(replay()).toEqual(replay());
  });

  it("consumes Mei's free and ordinary +1 buff as one provisional R09 marker on every AoE target", () => {
    const party = firstBattle.party.map((member) => member.definition.id === "mei" ? { ...member, currentBattleSCost: 5 } :
      member.definition.id === "yuri" ? { ...member, currentBattleSCost: 3 } : member);
    const runtime = new GameplayBBattleRuntime({ ...firstBattle, party, enemies: [...firstBattle.enemies, secondFrontEnemy()] }, 257);
    const prepared = runtime.getView();
    expect(prepared.pendingSkills?.modifiers).toHaveLength(1);
    expect(prepared.pendingSkills?.modifiers[0]).toMatchObject({ skillId: "mei-encouragement", actorId: "yuri", actionId: "player-action:1:yuri", sourceFreeActionId: "mei-encouragement" });
    expect(prepared.pendingRound?.playerActions.find((action) => action.actorId === "mei")).toMatchObject({ cardId: "mei-inspire", costPaid: 2, sCostAfterPayment: 3 });
    expect(prepared.pendingSkills?.supplementalFreeActions.find((action) => action.actorId === "mei")).toMatchObject({ effect: { kind: "attack-buff", amount: 1 }, targetIds: ["yuri"] });
    const result = runtime.click();
    expect(result.lastResolution?.deltas.filter((delta) => ["charger", "second-front"].includes(delta.actorId)).map((delta) => delta.damage)).toEqual([4, 4]);
    expect(result.lastResolution?.consumedAttackMarkerActorIds).toEqual(["yuri"]);
    expect(result.attackMarkers).toEqual([]);
    expect(result.state.partySCost.find((entry) => entry.actorId === "mei")?.value).toBe(3);
  });

  it("cancels Tsumugi's calibrated sight when the ordinary sniper is replaced by a recipe", () => {
    const tsumugi: BattlePartyMember = { definition: { id: "tsumugi", name: "纺希", row: "back", hpMax: 8, atk: 3, def: 0,
      cards: [{ id: "tsumugi-sniper", name: "狙击", cost: 3, tags: ["sniper"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } }],
      aiPriority: [{ cardId: "tsumugi-sniper", condition: { kind: "enemy-row-alive", row: "front" }, holdCost: 0, minimumCurrentSCost: 3 }] }, hp: 8, currentBattleSCost: 3 };
    const target: BattleEnemyMember = { definition: { id: "guard", name: "护具学生", row: "front", hpMax: 5, atk: 0, def: 1,
      intentPattern: [{ id: "guard-cover", name: "掩护", tags: ["cover"], effect: { kind: "shield", amount: 2, target: { kind: "lowest", side: "enemy", rows: ["front"] } } }] }, hp: 5 };
    const runtime = new GameplayBBattleRuntime({ encounterId: "sniper-cover", round: 1, party: [tsumugi], enemies: [target] }, 4);
    expect(runtime.getView().pendingSkills?.modifiers[0]?.skillId).toBe("tsumugi-calibrated-sight");
    const result = runtime.click();
    expect(result.lastResolution?.recipePlan.matches[0]).toMatchObject({ recipeId: "enemy-cover-ally-sniper", rightActionId: "player-action:0:tsumugi" });
    expect(result.lastResolution?.deltas.find((delta) => delta.actorId === "guard")?.damage).toBe(2);
    expect(result.lastResolution?.events.some((event) => event.includes("校准镜") && event.includes("取消"))).toBe(true);
  });

  it("runs the remaining friendly charge-cover recipe after the enemy charge-cover recipe", () => {
    const party = [...firstBattle.party, testReina()];
    const runtime = new GameplayBBattleRuntime({ ...firstBattle, party }, 1);
    const view = runtime.click();
    expect(view.lastResolution?.recipePlan.matches.map((match) => match.recipeId)).toEqual(["enemy-charge-ally-cover", "ally-charge-ally-cover"]);
    expect(view.lastResolution?.deltas.find((delta) => delta.actorId === "charger")?.damage).toBe(4);
    expect(view.lastResolution?.deltas.find((delta) => delta.actorId === "yuri")).toMatchObject({ damage: 1, shield: 2, hpAfter: 11 });
  });

  it("resolves Reina's aftershock from its locked target as fixed damage, without the carrier attack formula", () => {
    const runtime = new GameplayBBattleRuntime({ encounterId: "reina-blast", round: 1, party: [testReina()], enemies: [firstBattle.enemies[0]!, secondFrontEnemy()] }, 4);
    expect(runtime.getView().pendingSkills?.effects[0]).toMatchObject({ skillId: "reina-aftershock", targetIds: ["second-front"], kind: "fixed-damage", amount: 1 });
    const result = runtime.click();
    expect(result.lastResolution?.deltas.find((delta) => delta.actorId === "second-front")?.damage).toBe(3);
    expect(result.lastResolution?.events.filter((event) => event.includes("余波") && event.includes("固定 1 点")).length).toBe(1);
  });

  it("applies the existing R09 marker across rounds to the next damaging card, then consumes it", () => {
    const attacker: BattlePartyMember = { definition: { id: "attacker", name: "攻击者", row: "front", hpMax: 10, atk: 3, def: 0,
      cards: [{ id: "hit", name: "攻击", cost: 1, tags: ["shoot"], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } }],
      aiPriority: [{ cardId: "hit", condition: { kind: "always" }, holdCost: 0 }] }, hp: 10, currentBattleSCost: 0 };
    const enemy: BattleEnemyMember = { definition: { id: "target", name: "目标", row: "front", hpMax: 10, atk: 0, def: 1, intentPattern: [] }, hp: 10 };
    const input: BattlePreparationInput = { encounterId: "marker-carry", round: 1, party: [attacker], enemies: [enemy] };
    const first = prepareBattleRound(input);
    const firstState = { encounterId: input.encounterId, round: 0, combatants: first.combatants, partySCost: first.partyStartSCost, result: "ongoing" as const };
    const emptySkills = { checks: [], supplementalFreeActions: [], modifiers: [], effects: [] };
    const waiting = resolveBattleRound(firstState, first, { recipePlan: matchPreparedBattleRound(first), skills: emptySkills, attackMarkers: ["attacker"] });
    expect(waiting.pendingAttackMarkers).toEqual(["attacker"]);
    const second = prepareBattleRound({ ...input, round: 2, party: [{ ...attacker, currentBattleSCost: waiting.state.partySCost[0]!.value }] });
    const hit = resolveBattleRound(waiting.state, second, { recipePlan: matchPreparedBattleRound(second), skills: emptySkills, attackMarkers: waiting.pendingAttackMarkers });
    expect(hit.deltas.find((delta) => delta.actorId === "target")?.damage).toBe(3);
    expect(hit.consumedAttackMarkerActorIds).toEqual(["attacker"]);
    expect(hit.pendingAttackMarkers).toEqual([]);
  });

  it("uses the R11 provisional HP-zero Chise target for net healing until 2026-10-04 review", () => {
    const down: BattlePartyMember = { definition: { id: "down", name: "倒地队员", row: "front", hpMax: 10, atk: 2, def: 0,
      cards: [{ id: "down-hit", name: "攻击", cost: 1, tags: [], effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] } } }],
      aiPriority: [{ cardId: "down-hit", condition: { kind: "always" }, holdCost: 0 }] }, hp: 0, currentBattleSCost: 2 };
    const foe = { definition: { ...firstBattle.enemies[0]!.definition, intentPattern: [] }, hp: 8 };
    const runtime = new GameplayBBattleRuntime({ encounterId: "chise-revive", round: 1, party: [testChise(), down], enemies: [foe] }, 4);
    expect(runtime.getView().pendingSkills?.supplementalFreeActions[0]?.targetIds).toEqual(["down"]);
    const result = runtime.click();
    expect(result.lastResolution?.prepared.playerActions.some((action) => action.actorId === "down")).toBe(false);
    expect(result.state.combatants.find((actor) => actor.actorId === "down")?.hp).toBe(1);
    expect(result.pendingRound?.playerActions.find((action) => action.actorId === "down")?.kind).toBe("card");
  });
});
