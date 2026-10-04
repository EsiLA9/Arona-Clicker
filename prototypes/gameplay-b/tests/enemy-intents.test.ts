import { describe, expect, it } from "vitest";
import { prepareBattleRound } from "../src/battle/prepare.js";
import { GameplayBBattleRuntime } from "../src/runtime.js";
import { firstBattle } from "../src/content/first-battle.js";
import { parkEncounters, parkEnemyTemplates } from "../src/content/enemies.js";
import type { BattleCondition, BattleEnemyMember, BattlePartyMember, BattlePreparationInput, EnemyIntentDefinition } from "../src/model.js";

function enemy(id: string, intentPattern: readonly EnemyIntentDefinition[], previousRoundDamageReaction?: EnemyIntentDefinition): BattleEnemyMember {
  return {
    definition: { id, name: id, row: "front", hpMax: 10, atk: 2, def: 0, intentPattern,
      ...(previousRoundDamageReaction ? { previousRoundDamageReaction } : {}) },
    hp: 10,
  };
}

function attackIntent(id: string, tag: string): EnemyIntentDefinition {
  return { id, name: id, tags: [tag], effect: { kind: "attack", target: { kind: "lowest", side: "ally", rows: ["any"] } } };
}

function input(enemies: readonly BattleEnemyMember[], round = 1, extra: Partial<BattlePreparationInput> = {}): BattlePreparationInput {
  return { ...firstBattle, round, enemies, ...extra };
}

function striker(condition: BattleCondition = { kind: "always" }): BattlePartyMember {
  return {
    definition: { id: "striker", name: "测试攻击者", row: "front", hpMax: 10, atk: 3, def: 0,
      cards: [{ id: "strike", name: "攻击", cost: 1, tags: ["strike"], effect: {
        kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["front"] },
      } }],
      aiPriority: [{ cardId: "strike", condition, holdCost: 0 }] },
    hp: 10, currentBattleSCost: 2,
  };
}

function idleParty(): readonly BattlePartyMember[] {
  return firstBattle.party.map((member) => ({ ...member, definition: { ...member.definition, cards: [], aiPriority: [] } }));
}

function runtimeInput(party: readonly BattlePartyMember[], enemies: readonly BattleEnemyMember[], encounterId = "intent-test"): BattlePreparationInput {
  return { encounterId, round: 1, party, enemies };
}

function parkInput(encounter: keyof typeof parkEncounters, round: number, extra: Partial<BattlePreparationInput> = {}): BattlePreparationInput {
  return { ...firstBattle, ...parkEncounters[encounter], round, ...extra };
}

describe("enemy intent preparation", () => {
  it("configures the three park encounters with the director's roster and small stat line", () => {
    expect(parkEncounters.node5.encounterId).toBe(firstBattle.encounterId);
    expect(parkEncounters.node5.enemies.map((member) => member.definition.id)).toEqual(["charger", "water-gunner"]);
    expect(parkEncounters.node9.enemies.map((member) => member.definition.id)).toEqual(["temporary-leader", "charger", "fireworks-student"]);
    expect(parkEncounters.node11.enemies.map((member) => member.definition.id)).toEqual(["red-mask-leader", "armored-student", "water-gunner"]);
    expect(parkEncounters.node9.encounterId).toBe("node-9-fireworks-plaza");
    expect(parkEncounters.node11.encounterId).toBe("node-11-central-stage-boss");
    expect(parkEnemyTemplates.charger.definition).toMatchObject({ row: "front", hpMax: 8, atk: 2, def: 0 });
    expect(parkEnemyTemplates.waterGunner.definition).toMatchObject({ row: "back", hpMax: 6, atk: 2, def: 0 });
    expect(parkEnemyTemplates.temporaryLeader.definition).toMatchObject({ row: "front", hpMax: 12, atk: 2, def: 1 });
    expect(parkEnemyTemplates.fireworksStudent.definition).toMatchObject({ row: "back", hpMax: 7, atk: 2, def: 0 });
    expect(parkEnemyTemplates.redMaskLeader.definition).toMatchObject({ row: "front", hpMax: 18, atk: 3, def: 1 });
    expect(parkEnemyTemplates.armoredStudent.definition).toMatchObject({ row: "front", hpMax: 9, atk: 1, def: 1 });
  });

  it("preserves the first encounter's front-priority charge and rear-first sniper targets", () => {
    const prepared = prepareBattleRound(parkInput("node5", 1));
    expect(prepared.enemyIntents.find((intent) => intent.actorId === "charger")?.targetIds).toEqual(["yuri"]);
    expect(prepared.enemyIntents.find((intent) => intent.actorId === "water-gunner")?.targetIds).toEqual(["tsumugi"]);

    const partyWithoutRear = firstBattle.party.map((member) => member.definition.row === "back" ? { ...member, hp: 0 } : member);
    const fallback = prepareBattleRound(parkInput("node5", 1, { party: partyWithoutRear }));
    expect(fallback.enemyIntents.find((intent) => intent.actorId === "water-gunner")?.targetIds).toEqual(["yuri"]);
  });

  it("keeps fireworks odd rounds as front-only blast and even rounds as reload", () => {
    const opening = parkInput("node9", 1);
    const openingRound = prepareBattleRound(opening);
    const burst = openingRound.enemyIntents.find((intent) => intent.actorId === "fireworks-student");
    const reload = prepareBattleRound(parkInput("node9", 2)).enemyIntents.find((intent) => intent.actorId === "fireworks-student");
    const nextBurst = prepareBattleRound(parkInput("node9", 3)).enemyIntents.find((intent) => intent.actorId === "fireworks-student");
    const fifthRound = prepareBattleRound(parkInput("node9", 5)).enemyIntents.find((intent) => intent.actorId === "fireworks-student");

    expect(burst).toMatchObject({ intentId: "fireworks-burst", targetIds: ["shiori", "yuri"], resolution: { kind: "fixed-damage", amount: 1 } });
    expect(reload).toMatchObject({ intentId: "fireworks-reload", targetIds: [], resolution: { kind: "no-op" } });
    expect(nextBurst).toEqual(burst);
    expect(fifthRound).toEqual(burst);
    expect(prepareBattleRound(opening)).toEqual(openingRound);
  });

  it("keeps temporary-leader cover/charge cycling while damage overrides one round", () => {
    const first = prepareBattleRound(parkInput("node9", 1)).enemyIntents.find((intent) => intent.actorId === "temporary-leader");
    const second = prepareBattleRound(parkInput("node9", 2)).enemyIntents.find((intent) => intent.actorId === "temporary-leader");
    const reaction = prepareBattleRound(parkInput("node9", 2, { previousRoundDamagedEnemyIds: ["temporary-leader"] }))
      .enemyIntents.find((intent) => intent.actorId === "temporary-leader");
    const third = prepareBattleRound(parkInput("node9", 3, { previousRoundDamagedEnemyIds: [] }))
      .enemyIntents.find((intent) => intent.actorId === "temporary-leader");
    const fourth = prepareBattleRound(parkInput("node9", 4, { previousRoundDamagedEnemyIds: [] }))
      .enemyIntents.find((intent) => intent.actorId === "temporary-leader");

    expect(first).toMatchObject({ intentId: "temporary-leader-cover", targetIds: ["charger"], effect: { kind: "shield", amount: 2 } });
    expect(second?.intentId).toBe("temporary-leader-charge");
    expect(reaction?.intentId).toBe("temporary-leader-reactive-charge");
    expect(third?.intentId).toBe("temporary-leader-cover");
    expect(fourth?.intentId).toBe("temporary-leader-charge");
  });

  it("uses the boss wave every third round with the fixed mixed target", () => {
    const regular = prepareBattleRound(parkInput("node11", 2)).enemyIntents.find((intent) => intent.actorId === "red-mask-leader");
    const wave = prepareBattleRound(parkInput("node11", 3)).enemyIntents.find((intent) => intent.actorId === "red-mask-leader");
    const nextWave = prepareBattleRound(parkInput("node11", 6)).enemyIntents.find((intent) => intent.actorId === "red-mask-leader");
    const nextCycleCharge = prepareBattleRound(parkInput("node11", 4)).enemyIntents.find((intent) => intent.actorId === "red-mask-leader");
    const guard = prepareBattleRound(parkInput("node11", 1)).enemyIntents.find((intent) => intent.actorId === "armored-student");

    expect(regular).toMatchObject({ intentId: "red-mask-charge-2", tags: ["charge"], targetIds: ["yuri"] });
    expect(wave).toMatchObject({ intentId: "red-mask-fireworks", targetIds: ["shiori", "yuri", "tsumugi"], resolution: { kind: "fixed-damage", amount: 1 } });
    expect(nextWave).toEqual(wave);
    expect(nextCycleCharge).toMatchObject({ intentId: "red-mask-charge-1", tags: ["charge"], targetIds: ["yuri"] });
    expect(guard).toMatchObject({ intentId: "armored-student-cover", targetIds: ["armored-student"], effect: { kind: "shield", amount: 2 } });
  });

  it("locks fixed damage to all living fronts and the roster-first lowest-HP rear", () => {
    const boss = enemy("boss", [{ id: "fireworks", name: "烟花齐放", tags: ["boss-wave"], effect: {
      kind: "fixed-damage", amount: 1, target: { kind: "front-and-lowest-rear", side: "ally" },
    } }]);
    const party = firstBattle.party.map((member) => member.definition.id === "mei" || member.definition.id === "tsumugi"
      ? { ...member, hp: 2 } : member);
    const preparedInput = input([boss], 3, { party });
    const prepared = prepareBattleRound(preparedInput);
    const intent = prepared.enemyIntents[0]!;

    expect(intent.targetIds).toEqual(["shiori", "yuri", "mei"]);
    expect(intent).toMatchObject({ effect: null, resolution: { kind: "fixed-damage", amount: 1 } });
    expect(prepareBattleRound(preparedInput)).toEqual(prepared);
  });

  it("uses only eligible mixed-target rows when a side is partly down", () => {
    const boss = enemy("boss", [{ id: "wave", name: "波及", tags: [], effect: {
      kind: "fixed-damage", amount: 1, target: { kind: "front-and-lowest-rear", side: "ally" },
    } }]);
    const noRear = firstBattle.party.map((member) => member.definition.row === "back" ? { ...member, hp: 0 } : member);
    expect(prepareBattleRound(input([boss], 3, { party: noRear })).enemyIntents[0]?.targetIds).toEqual(["shiori", "yuri"]);

    const noFront = firstBattle.party.map((member) => member.definition.row === "front" ? { ...member, hp: 0 } :
      member.definition.id === "mei" ? { ...member, hp: 2 } : { ...member, hp: 1 });
    expect(prepareBattleRound(input([boss], 3, { party: noFront })).enemyIntents[0]?.targetIds).toEqual(["tsumugi"]);

    const everyoneDown = firstBattle.party.map((member) => ({ ...member, hp: 0 }));
    expect(prepareBattleRound(input([boss], 3, { party: everyoneDown })).enemyIntents[0]?.targetIds).toEqual([]);
  });

  it("prepares reload as a visible no-op with no target", () => {
    const reload = enemy("fireworks", [{ id: "reload", name: "装填", tags: ["reload"], effect: { kind: "no-op" } }]);
    expect(prepareBattleRound(input([reload], 2)).enemyIntents[0]).toMatchObject({
      intentId: "reload", intentName: "装填", targetIds: [], effect: null, resolution: { kind: "no-op" },
    });
  });

  it("uses only the immediately supplied damaged-enemy IDs and leaves the base cycle in place", () => {
    const leader = enemy("leader", [attackIntent("base-charge", "charge"), attackIntent("base-cover", "cover"), attackIntent("base-aim", "aim")],
      attackIntent("reactive-charge", "charge"));
    const opening = input([leader]);
    const before = structuredClone(opening);

    expect(prepareBattleRound(opening).enemyIntents[0]?.intentId).toBe("base-charge");
    expect(prepareBattleRound(input([leader], 2)).enemyIntents[0]?.intentId).toBe("base-cover");
    expect(prepareBattleRound(input([leader], 2, { previousRoundDamagedEnemyIds: ["leader"] })).enemyIntents[0]?.intentId).toBe("reactive-charge");
    expect(prepareBattleRound(input([leader], 3, { previousRoundDamagedEnemyIds: [] })).enemyIntents[0]?.intentId).toBe("base-aim");
    expect(opening).toEqual(before);
  });

  it("rejects duplicate or unknown previous-round damage IDs", () => {
    const leader = enemy("leader", [attackIntent("base-charge", "charge")]);
    expect(() => prepareBattleRound(input([leader], 2, { previousRoundDamagedEnemyIds: ["missing"] }))).toThrow("Invalid previous-round damaged enemy IDs");
    expect(() => prepareBattleRound(input([leader], 2, { previousRoundDamagedEnemyIds: ["leader", "leader"] }))).toThrow("Invalid previous-round damaged enemy IDs");
  });

  it("rejects fixed-damage intents without a positive integer amount", () => {
    const invalid = enemy("boss", [{ id: "bad-wave", name: "坏波", tags: [], effect: {
      kind: "fixed-damage", amount: 0, target: { kind: "front-and-lowest-rear", side: "ally" },
    } }]);
    expect(() => prepareBattleRound(input([invalid]))).toThrow("Invalid enemy intent");
  });

  it("settles fixed damage once per frozen target and skips ATK-DEF", () => {
    const boss: BattleEnemyMember = { definition: { id: "boss", name: "Boss", row: "back", hpMax: 20, atk: 20, def: 0,
      intentPattern: [{ id: "wave", name: "烟花齐放", tags: ["boss-wave"], effect: {
        kind: "fixed-damage", amount: 1, target: { kind: "front-and-lowest-rear", side: "ally" },
      } }] }, hp: 20 };
    const runtime = new GameplayBBattleRuntime(runtimeInput(idleParty(), [boss]));
    const prepared = runtime.getView().pendingRound!;

    expect(prepared.enemyIntents[0]?.targetIds).toEqual(["shiori", "yuri", "tsumugi"]);
    const after = runtime.click();
    for (const id of ["shiori", "yuri", "tsumugi"]) {
      expect(after.lastResolution?.deltas.find((delta) => delta.actorId === id)).toMatchObject({ damage: 1, hpAfter: expect.any(Number) });
      const delta = after.lastResolution?.deltas.find((entry) => entry.actorId === id)!;
      expect(delta.hpAfter).toBe(delta.hpBefore - 1);
    }
    expect(after.lastResolution?.events.some((event) => event.includes("烟花齐放") && event.includes("固定 1 点"))).toBe(true);
    expect(after.state.result).toBe("ongoing");
  });

  it("logs reload and leaves HP unchanged", () => {
    const reload = enemy("fireworks", [{ id: "reload", name: "装填", tags: ["reload"], effect: { kind: "no-op" } }]);
    const runtime = new GameplayBBattleRuntime(runtimeInput(idleParty(), [reload]));
    const after = runtime.click();
    const delta = after.lastResolution?.deltas.find((entry) => entry.actorId === "fireworks");

    expect(delta).toMatchObject({ damage: 0, hpBefore: 10, hpAfter: 10 });
    expect(after.lastResolution?.events.some((event) => event.includes("装填") && event.includes("无伤害"))).toBe(true);
    expect(after.pendingRound?.enemyIntents[0]).toMatchObject({ intentId: "reload", targetIds: [], resolution: { kind: "no-op" } });
  });

  it("passes only actual HP loss to the next round and resumes the untouched base cycle", () => {
    const leader = enemy("leader", [attackIntent("base-opening", "opening"), attackIntent("base-cover", "cover"), attackIntent("base-aim", "aim")],
      attackIntent("reactive-charge", "charge"));
    const runtime = new GameplayBBattleRuntime(runtimeInput([striker({ kind: "enemy-intent", tag: "opening" })], [leader]));

    const first = runtime.click();
    expect(first.lastResolution?.deltas.find((delta) => delta.actorId === "leader")).toMatchObject({ hpBefore: 10, hpAfter: 7 });
    expect(first.pendingRound?.enemyIntents[0]?.intentId).toBe("reactive-charge");
    const second = runtime.click();
    expect(second.lastResolution?.deltas.find((delta) => delta.actorId === "leader")?.hpAfter).toBe(7);
    expect(second.pendingRound?.enemyIntents[0]?.intentId).toBe("base-aim");
  });

  it("does not trigger a damage reaction when enemy shield absorbs the prepared hit", () => {
    const leader = enemy("leader", [attackIntent("base-opening", "opening"), attackIntent("base-cover", "cover")],
      attackIntent("reactive-charge", "charge"));
    const guard: BattleEnemyMember = { definition: { id: "guard", name: "guard", row: "back", hpMax: 10, atk: 0, def: 0,
      intentPattern: [{ id: "guard-leader", name: "掩护", tags: ["cover"], effect: {
        kind: "shield", amount: 3, target: { kind: "all", side: "enemy", row: "front" },
      } }] }, hp: 10 };
    const runtime = new GameplayBBattleRuntime(runtimeInput([striker()], [leader, guard]));
    const after = runtime.click();
    const leaderDelta = after.lastResolution?.deltas.find((delta) => delta.actorId === "leader");

    expect(leaderDelta).toMatchObject({ damage: 3, shield: 3, hpBefore: 10, hpAfter: 10 });
    expect(after.pendingRound?.enemyIntents.find((intent) => intent.actorId === "leader")?.intentId).toBe("base-cover");
  });

  it("re-arms only from fresh damage and clears reaction memory on a new battle", () => {
    const leader = enemy("leader", [attackIntent("base-one", "one"), attackIntent("base-two", "two")],
      attackIntent("reactive-charge", "charge"));
    const continuing = new GameplayBBattleRuntime(runtimeInput([striker()], [leader], "continuing"));
    expect(continuing.click().pendingRound?.enemyIntents[0]?.intentId).toBe("reactive-charge");
    expect(continuing.click().pendingRound?.enemyIntents[0]?.intentId).toBe("reactive-charge");

    const terminalEnemy = { ...leader, hp: 2, definition: { ...leader.definition, hpMax: 10 } };
    const terminal = new GameplayBBattleRuntime(runtimeInput([striker()], [terminalEnemy], "terminal"));
    const ended = terminal.click();
    expect(ended.state.result).toBe("victory");
    expect(ended.pendingRound).toBeNull();

    const fresh = new GameplayBBattleRuntime({ ...runtimeInput([striker()], [leader], "fresh"), previousRoundDamagedEnemyIds: ["leader"] });
    expect(fresh.getView().pendingRound?.enemyIntents[0]?.intentId).toBe("base-one");
  });
});
