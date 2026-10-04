import { describe, expect, it } from "vitest";
import { resolveActivity, type ActivityCharacterSnapshot } from "../src/locations/activity.js";
import { backstageRestRoomFixture, chiseContent, firstAidStationActivity, mirrorMazeActivity, reinaContent, shortRouteNodes } from "../src/content/short-route.js";

function character(id: string, hp: number, options: Partial<ActivityCharacterSnapshot> = {}): ActivityCharacterSnapshot {
  return {
    id,
    name: id,
    inParty: true,
    hp,
    hpMax: 8,
    atk: 2,
    def: 0,
    activityTags: [],
    ...options,
  };
}

describe("pure location activity resolution", () => {
  it("applies fixed camp healing before the provisional personal-roll eligibility check", () => {
    const party = [
      character("shiori", 8),
      character("chise", 0, { hpMax: 9 }),
      character("not-in-party", 4, { inParty: false }),
    ];
    const resolution = resolveActivity({
      party,
      activity: firstAidStationActivity.activity,
      rolls: [
        { actorId: "shiori", value: 2 },
        { actorId: "chise", value: 1 },
      ],
    });

    expect(resolution.hpDeltas).toEqual([
      { actorId: "shiori", hpBefore: 8, hpAfter: 8, hpDelta: 0 },
      { actorId: "chise", hpBefore: 0, hpAfter: 3, hpDelta: 3 },
    ]);
    expect(resolution.individualResults.map((result) => result.actorId)).toEqual(["shiori", "chise"]);
    expect(resolution.individualResults.map((result) => [result.dice.value, result.hpDelta])).toEqual([[2, 0], [1, 1]]);
    expect(resolution.events.map((event) => event.type)).toEqual(["fixed-effect", "individual-result", "individual-result"]);
    expect(resolution.events[0]).toMatchObject({ type: "fixed-effect", changes: [{ actorId: "shiori", hpDelta: 0 }, { actorId: "chise", hpDelta: 2 }] });
    expect(resolution.partyDefeated).toBe(false);
  });

  it("returns defeat immediately when the dangerous activity downs every party member", () => {
    const party = [
      character("shiori", 1, { def: 1 }),
      character("yuri", 1),
      character("chise", 1),
      character("mei", 1),
      character("tsumugi", 1),
    ];
    const resolution = resolveActivity({
      party,
      activity: mirrorMazeActivity.activity,
      rolls: [1, 2, 3, 4, 5].map((value, index) => ({ actorId: party[index]!.id, value })),
    });

    expect(resolution.individualResults.map((result) => [result.checkValue, result.success])).toEqual([[2, false], [2, false], [3, false], [4, false], [5, false]]);
    expect(resolution.hpDeltas.map((delta) => [delta.hpAfter, delta.hpDelta])).toEqual(Array(5).fill([0, -1]));
    expect(resolution.events.map((event) => event.type)).toEqual(Array(5).fill("individual-result"));
    expect(resolution.partyDefeated).toBe(true);
  });

  it("uses an inclusive attribute threshold and clamps failure damage at zero", () => {
    const success = resolveActivity({
      party: [character("threshold", 4, { def: 1 })],
      activity: mirrorMazeActivity.activity,
      rolls: [{ actorId: "threshold", value: 5 }],
    });
    const failureAtZero = resolveActivity({
      party: [character("last-breath", 1, { def: 0 })],
      activity: mirrorMazeActivity.activity,
      rolls: [{ actorId: "last-breath", value: 1 }],
    });

    expect(success.individualResults[0]).toMatchObject({ success: true, checkValue: 6, outcome: "clue", hpDelta: 0 });
    expect(failureAtZero.individualResults[0]).toMatchObject({ success: false, hpBefore: 1, hpAfter: 0, hpDelta: -1 });
    expect(failureAtZero.partyDefeated).toBe(true);
  });

  it("lets a fixed-only backstage fixture revive the party without consuming dice", () => {
    const resolution = resolveActivity({
      party: [character("living", 6), character("down", 0)],
      activity: backstageRestRoomFixture.activity,
      rolls: [],
    });

    expect(resolution.individualResults).toEqual([]);
    expect(resolution.hpDeltas.map((delta) => delta.hpAfter)).toEqual([8, 2]);
    expect(resolution.events).toHaveLength(1);
    expect(resolution.partyDefeated).toBe(false);
    expect(backstageRestRoomFixture.nextBattleModifier).toEqual({
      rechargeBonus: { amount: 1, fromRound: 2 },
    });
    expect(backstageRestRoomFixture.onEnter[0]?.character.id).toBe("reina");
  });

  it("exports the ordered five-node route and explicit recruit fixtures", () => {
    expect(shortRouteNodes.map((node) => [node.nodeNumber, node.kind])).toEqual([[5, "battle"], [6, "activity"], [7, "activity"], [9, "battle"], [12, "exit"]]);
    expect(chiseContent.id).toBe("chise");
    expect(reinaContent.id).toBe("reina");
    expect(shortRouteNodes[1]).toMatchObject({ nodeNumber: 6, kind: "activity", onEnter: [{ kind: "join-character", character: { id: "chise", roster: { initialHp: 9, row: "front" } } }], nextBattleModifier: { initialSCostBonus: 1 } });
    const battleNodes = shortRouteNodes.filter((node) => node.kind === "battle");
    expect(battleNodes[0]?.battle.encounterId).toBe("node-5-first-battle");
    expect(battleNodes[1]?.battle.encounterId).not.toBe(battleNodes[0]?.battle.encounterId);
    expect(battleNodes[1]?.temporarySample).toEqual({ sourceEncounterId: "node-5-first-battle", replacementTask: "0191" });
    expect(shortRouteNodes.some((node) => node.nodeNumber === 10)).toBe(false);
    expect(backstageRestRoomFixture).toMatchObject({ nodeNumber: 10, fixtureFor: "0190-U3", onEnter: [{ kind: "join-character", character: { id: "reina" } }], nextBattleModifier: { rechargeBonus: { amount: 1, fromRound: 2 } } });
  });

  it("is deterministic, leaves inputs unchanged, and requires roster-ordered rolls", () => {
    const party = Object.freeze([
      Object.freeze(character("first", 3)),
      Object.freeze(character("second", 3, { def: 1 })),
    ]);
    const rolls = Object.freeze([
      Object.freeze({ actorId: "first", value: 5 }),
      Object.freeze({ actorId: "second", value: 4 }),
    ]);
    const inputSnapshot = JSON.stringify({ party, rolls });
    const input = { party, rolls, activity: mirrorMazeActivity.activity };

    expect(resolveActivity(input)).toEqual(resolveActivity(input));
    expect(JSON.stringify({ party, rolls })).toBe(inputSnapshot);
    expect(() => resolveActivity({ ...input, rolls: [...rolls].reverse() })).toThrow(/must belong to first/);
    expect(() => resolveActivity({ ...input, rolls: rolls.slice(0, 1) })).toThrow(/Expected 2 activity rolls/);
  });
});
