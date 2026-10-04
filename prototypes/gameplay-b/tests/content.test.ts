import { describe, expect, it } from "vitest";
import { parkEncounters } from "../src/content/enemies.js";
import { parkInitialParty, parkRouteNodes } from "../src/content/park-route.js";
import { parkTextEntries } from "../src/content/texts.js";
import { validateParkRoute } from "../src/content/validate.js";
import { GameplayBRouteRuntime, type GameplayBRouteNode } from "../src/runtime.js";
import { chiseContent, reinaContent } from "../src/content/short-route.js";

describe("twelve-node park content", () => {
  it("accepts the canonical route without mutating its nodes", () => {
    const before = structuredClone(parkRouteNodes);
    expect(validateParkRoute(parkRouteNodes)).toEqual([]);
    expect(parkRouteNodes).toEqual(before);
  });

  it("keeps the director's node order, battle locations, and eleven noncombat Clicks", () => {
    expect(parkRouteNodes.map((node) => node.name)).toEqual([
      "西门临时执勤点", "林荫连廊", "游园服务亭", "代币电玩馆", "失控碰碰车区", "急救补给站",
      "镜面迷宫", "摩天轮检修廊", "烟花排练广场", "后台休息室", "中央舞台设备井", "东出口交接处",
    ]);
    expect(parkRouteNodes.filter((node) => node.kind === "battle").map((node) => [node.id, node.battle.encounterId])).toEqual([
      ["node-5", parkEncounters.node5.encounterId],
      ["node-9", parkEncounters.node9.encounterId],
      ["node-11", parkEncounters.node11.encounterId],
    ]);
    expect([parkEncounters.node5, parkEncounters.node9, parkEncounters.node11]
      .map((encounter) => encounter.enemies.map((member) => member.definition.id))).toEqual([
      ["charger", "water-gunner"],
      ["temporary-leader", "charger", "fireworks-student"],
      ["red-mask-leader", "armored-student", "water-gunner"],
    ]);
    const leader = parkEncounters.node9.enemies[0]!.definition;
    const fireworks = parkEncounters.node9.enemies[2]!.definition.intentPattern;
    const bossWave = parkEncounters.node11.enemies[0]!.definition.intentPattern[2]!;
    expect(leader.previousRoundDamageReaction?.id).toBe("temporary-leader-reactive-charge");
    expect(fireworks.map((intent) => [intent.id, intent.effect.kind])).toEqual([
      ["fireworks-burst", "fixed-damage"], ["fireworks-reload", "no-op"],
    ]);
    expect(bossWave.effect).toMatchObject({ kind: "fixed-damage", amount: 1,
      target: { kind: "front-and-lowest-rear", side: "ally" } });
    const activityNodes = parkRouteNodes.filter((node) => node.kind === "activity");
    const exit = parkRouteNodes.find((node) => node.kind === "exit")!;
    expect(activityNodes.map((node) => node.activityCount)).toEqual([1, 2, 1, 1, 1, 2, 1, 1]);
    expect(activityNodes.reduce((total, node) => total + node.activityCount, exit.kind === "exit" ? exit.activityCount ?? 0 : 0)).toBe(11);
    expect(exit).toMatchObject({ id: "node-12", kind: "exit", activityCount: 1 });
  });

  it("starts with the four ordered 2+2 members and joins Chise/Reina before their camp activity", () => {
    expect(parkInitialParty.map((member) => [member.roster.id, member.roster.row])).toEqual([
      ["shiori", "front"], ["yuri", "front"], ["mei", "back"], ["tsumugi", "back"],
    ]);
    expect(parkInitialParty.map((member) => [member.roster.hpMax, member.roster.atk, member.roster.def])).toEqual([
      [13, 2, 1], [11, 3, 0], [9, 2, 0], [8, 3, 0],
    ]);
    const node6 = parkRouteNodes.find((node) => node.id === "node-6")!;
    const node10 = parkRouteNodes.find((node) => node.id === "node-10")!;
    expect(node6).toMatchObject({ kind: "activity", activity: { locationId: "first-aid-station" }, nextBattleModifier: { initialSCostBonus: 1 }, onEnter: [{ kind: "join-character", character: { id: "chise" } }] });
    expect(node10).toMatchObject({ kind: "activity", activity: { locationId: "backstage-rest-room" }, nextBattleModifier: { rechargeBonus: { amount: 1, fromRound: 2 } }, onEnter: [{ kind: "join-character", character: { id: "reina" } }] });
  });

  it("runs the join event before the camp activity and includes each recruit in that Click", () => {
    const node6 = parkRouteNodes.find((node) => node.id === "node-6")!;
    const node7 = parkRouteNodes.find((node) => node.id === "node-7")!;
    const firstCamp = new GameplayBRouteRuntime({ seed: "node-6-order", nodes: [node6, node7], initialParty: parkInitialParty });
    const entered6 = firstCamp.getView();
    expect(entered6.party.map((member) => member.id)).toEqual(["shiori", "yuri", "mei", "tsumugi", "chise"]);
    expect(entered6.events.map((event) => event.type)).toEqual(["node-entered", "character-joined"]);
    const after6 = firstCamp.click();
    expect(after6.currentNode.id).toBe("node-7");
    expect(after6.events.filter((event) => event.type === "activity-result").map((event) => event.actorId)).toEqual([
      "shiori", "yuri", "mei", "tsumugi", "chise",
    ]);

    const node10 = parkRouteNodes.find((node) => node.id === "node-10")!;
    const node12 = parkRouteNodes.find((node) => node.id === "node-12")!;
    const afterChise = [...parkInitialParty, { roster: chiseContent.roster, battle: chiseContent.battle }];
    const secondCamp = new GameplayBRouteRuntime({ seed: "node-10-order", nodes: [node10, node12], initialParty: afterChise });
    const entered10 = secondCamp.getView();
    expect(entered10.party.map((member) => member.id)).toEqual(["shiori", "yuri", "mei", "tsumugi", "chise", "reina"]);
    expect(entered10.events.map((event) => event.type)).toEqual(["node-entered", "character-joined"]);
    const after10 = secondCamp.click();
    expect(after10.events.findIndex((event) => event.type === "character-joined"))
      .toBeLessThan(after10.events.findIndex((event) => event.type === "activity-fixed-effect"));
    expect(after10.currentNode.id).toBe("node-12");
  });

  it("uses one Click for the fixed opening location and enters node two without rolling", () => {
    const runtime = new GameplayBRouteRuntime({ seed: "park-opening", nodes: parkRouteNodes, initialParty: parkInitialParty });
    expect(runtime.getView()).toMatchObject({ currentNode: { id: "node-1" }, activityRemaining: 1, rngCursor: 0 });
    const after = runtime.click();
    expect(after).toMatchObject({ clickCount: 1, currentNode: { id: "node-2" }, activityRemaining: 2, rngCursor: 0 });
    expect(after.events.some((event) => event.type === "activity-result")).toBe(false);
  });

  it("keeps route, activity, and encounter IDs separate and unique", () => {
    const routeIds = parkRouteNodes.map((node) => node.id);
    const locationIds = parkRouteNodes.filter((node) => node.kind === "activity").map((node) => node.activity.locationId);
    const encounterIds = parkRouteNodes.filter((node) => node.kind === "battle").map((node) => node.battle.encounterId);

    expect(new Set(routeIds).size).toBe(12);
    expect(new Set(locationIds).size).toBe(locationIds.length);
    expect(new Set(encounterIds).size).toBe(3);
    expect(locationIds.every((id) => !routeIds.includes(id))).toBe(true);
    expect(encounterIds.every((id) => !routeIds.includes(id) && !locationIds.includes(id))).toBe(true);
  });

  it("keeps each location's activity rule within the existing chance/attribute/heal contract", () => {
    const activity = (id: string) => parkRouteNodes.find((node): node is Extract<GameplayBRouteNode, { kind: "activity" }> => node.id === id && node.kind === "activity")!;
    expect(activity("node-1").activity).toEqual({ locationId: "west-gate-duty-point", fixedEffects: [] });
    expect(activity("node-2").activity.individualCheck).toMatchObject({ kind: "chance", dieSides: 2,
      outcomes: { 1: { outcome: { kind: "clue" } }, 2: { outcome: { kind: "none" } } } });
    expect(activity("node-3").activity.individualCheck).toMatchObject({ kind: "chance", dieSides: 2,
      outcomes: { 1: { outcome: { kind: "effect", effect: { kind: "heal", amount: 1 } } }, 2: { outcome: { kind: "none" } } } });
    expect(activity("node-4").activity.individualCheck?.kind).toBe("chance");
    expect(activity("node-6").activity).toMatchObject({ fixedEffects: [{ kind: "heal-party", amount: 2 }],
      individualCheck: { kind: "chance", dieSides: 2, outcomes: { 1: { outcome: { effect: { kind: "heal", amount: 1 } } } } } });
    expect(activity("node-7").activity.individualCheck).toMatchObject({ kind: "attribute", attribute: "def", difficulty: 6, dieSides: 6 });
    expect(activity("node-8").activity.individualCheck).toMatchObject({ kind: "attribute", attribute: "atk", difficulty: 6, dieSides: 6 });
    expect(activity("node-10").activity).toMatchObject({ fixedEffects: [{ kind: "heal-party", amount: 2 }] });
    expect(activity("node-10").activity).not.toHaveProperty("individualCheck");
  });

  it("provides matching text triggers for every node, battle intent, result, and activity", () => {
    const nodeIds = new Set(parkRouteNodes.map((node) => node.id));
    expect(parkTextEntries.every((entry) => nodeIds.has(entry.nodeId))).toBe(true);
    for (const node of parkRouteNodes) {
      const entries = parkTextEntries.filter((entry) => entry.nodeId === node.id);
      expect(entries.some((entry) => entry.trigger === "node-entered")).toBe(true);
      if (node.kind === "activity") {
        expect(entries.some((entry) => entry.trigger === "activity-completed")).toBe(true);
        expect(entries.filter((entry) => entry.trigger === "activity-click").map((entry) => entry.activityIndex).sort())
          .toEqual(Array.from({ length: node.activityCount }, (_, index) => index + 1));
      }
      if (node.kind === "battle") {
        const configuredIds = node.battle.enemies.flatMap(({ definition }) => [
          ...definition.intentPattern.map((intent) => intent.id),
          ...(definition.previousRoundDamageReaction ? [definition.previousRoundDamageReaction.id] : []),
        ]);
        const textIds = entries.filter((entry) => entry.trigger === "battle-intent").map((entry) => entry.referenceId).sort();
        expect(textIds).toEqual([...new Set(configuredIds)].sort());
        expect(entries.some((entry) => entry.trigger === "battle-intro")).toBe(true);
        expect(entries.filter((entry) => entry.trigger === "battle-ended").map((entry) => entry.referenceId).sort()).toEqual(["defeat", "draw", "victory"]);
      }
      if (node.kind === "exit") {
        expect(entries.some((entry) => entry.trigger === "route-completed")).toBe(true);
        expect(entries.filter((entry) => entry.trigger === "activity-click").map((entry) => entry.activityIndex)).toEqual([1]);
      }
    }
    expect(parkTextEntries.filter((entry) => entry.trigger === "character-joined").map((entry) => [entry.nodeId, entry.referenceId])).toEqual([
      ["node-6", "chise"], ["node-10", "reina"],
    ]);
  });

  it("reports empty or repeated Route IDs and node order errors", () => {
    const duplicate = parkRouteNodes.map((node, index) => index === 1 ? { ...node, id: "node-1" } : node);
    const duplicateErrors = validateParkRoute(duplicate);
    expect(duplicateErrors).toContain("路线节点 ID 重复：node-1。");
    expect(duplicateErrors.some((error) => error.includes("路线顺序错误"))).toBe(true);

    const empty = parkRouteNodes.map((node, index) => index === 0 ? { ...node, id: " " } : node);
    expect(validateParkRoute(empty).some((error) => error.includes("Route node ID 不能为空"))).toBe(true);

    const swapped = [...parkRouteNodes];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(validateParkRoute(swapped).some((error) => error.includes("路线顺序错误"))).toBe(true);
  });

  it("rejects a missing/extra node and a malformed exit count", () => {
    expect(validateParkRoute(parkRouteNodes.slice(0, 11)).some((error) => error.includes("必须有 12 个节点"))).toBe(true);
    expect(validateParkRoute([...parkRouteNodes, parkRouteNodes[0]!]).some((error) => error.includes("必须有 12 个节点"))).toBe(true);
    const badExit = parkRouteNodes.map((node) => node.id === "node-12" && node.kind === "exit" ? { ...node, activityCount: 2 } : node);
    expect(validateParkRoute(badExit).some((error) => error.includes("出口 activityCount 必须为 1"))).toBe(true);
  });

  it("reports misplaced battles, unknown encounter references, and missing enemies", () => {
    const badEncounter = parkRouteNodes.map((node) => node.id === "node-9" && node.kind === "battle"
      ? { ...node, battle: { ...node.battle, encounterId: "unknown-encounter" } } : node);
    const encounterErrors = validateParkRoute(badEncounter);
    expect(encounterErrors.some((error) => error.includes("未知或错误的 U3 遭遇 ID"))).toBe(true);

    const noEnemies = parkRouteNodes.map((node) => node.id === "node-11" && node.kind === "battle"
      ? { ...node, battle: { ...node.battle, enemies: [] } } : node);
    expect(validateParkRoute(noEnemies).some((error) => error.includes("必须至少包含一名敌人"))).toBe(true);

    const duplicateEncounter = parkRouteNodes.map((node) => node.id === "node-11" && node.kind === "battle"
      ? { ...node, battle: { ...node.battle, encounterId: parkEncounters.node9.encounterId } } : node);
    expect(validateParkRoute(duplicateEncounter).some((error) => error.includes("Battle encounter ID 重复"))).toBe(true);

    const wrongEnemyOrder = parkRouteNodes.map((node) => node.id === "node-11" && node.kind === "battle"
      ? { ...node, battle: { ...node.battle, enemies: [...node.battle.enemies].reverse() } } : node);
    expect(validateParkRoute(wrongEnemyOrder).some((error) => error.includes("敌人引用/顺序与 U3 遭遇配置不一致"))).toBe(true);

    const duplicateEnemies = parkRouteNodes.map((node) => node.id === "node-9" && node.kind === "battle"
      ? { ...node, battle: { ...node.battle, enemies: [node.battle.enemies[0]!, node.battle.enemies[0]!] } } : node);
    expect(validateParkRoute(duplicateEnemies).some((error) => error.includes("敌人 ID 不能为空或重复"))).toBe(true);

    const misplaced = parkRouteNodes.map((node) => node.id === "node-5" ? { ...node, kind: "activity" as const, activityCount: 1,
      activity: { locationId: "misplaced-battle", fixedEffects: [] } } : node);
    expect(validateParkRoute(misplaced).some((error) => error.includes("类型应为 battle"))).toBe(true);
  });

  it("reports activity totals, duplicate location IDs, and recruit reference errors", () => {
    const badCount = parkRouteNodes.map((node) => node.id === "node-2" && node.kind === "activity" ? { ...node, activityCount: 3 } : node);
    expect(validateParkRoute(badCount).some((error) => error.includes("合计必须为 11"))).toBe(true);

    const nonpositiveCount = parkRouteNodes.map((node) => node.id === "node-2" && node.kind === "activity" ? { ...node, activityCount: 0 } : node);
    expect(validateParkRoute(nonpositiveCount).some((error) => error.includes("activityCount 必须为正整数"))).toBe(true);

    const badLocation = parkRouteNodes.map((node) => node.id === "node-2" && node.kind === "activity"
      ? { ...node, activity: { ...node.activity, locationId: "west-gate-duty-point" } } : node);
    expect(validateParkRoute(badLocation).some((error) => error.includes("Activity location ID 重复"))).toBe(true);

    const collidingLocation = parkRouteNodes.map((node) => node.id === "node-2" && node.kind === "activity"
      ? { ...node, activity: { ...node.activity, locationId: "node-5" } } : node);
    expect(validateParkRoute(collidingLocation).some((error) => error.includes("与其他 Route ID 冲突"))).toBe(true);

    const node6 = parkRouteNodes.find((node): node is Extract<GameplayBRouteNode, { kind: "activity" }> => node.id === "node-6" && node.kind === "activity")!;
    const misplacedRecruit = parkRouteNodes.map((node) => node.id === "node-6" && node.kind === "activity"
      ? { ...node, onEnter: [] } : node.id === "node-7" && node.kind === "activity"
        ? { ...node, onEnter: node6.onEnter } : node);
    const recruitErrors = validateParkRoute(misplacedRecruit);
    expect(recruitErrors.some((error) => error.includes("node-6 入场招募"))).toBe(true);
    expect(recruitErrors.some((error) => error.includes("node-7 入场招募"))).toBe(true);

    const brokenCharacter = parkRouteNodes.map((node) => node.id === "node-6" && node.kind === "activity"
      ? { ...node, onEnter: node.onEnter?.map((entry) => ({ ...entry, character: { ...entry.character, id: "wrong-id" } })) } : node);
    expect(validateParkRoute(brokenCharacter).some((error) => error.includes("招募引用 ID 不一致"))).toBe(true);
  });

  it("rejects empty activity and encounter references", () => {
    const emptyLocation = parkRouteNodes.map((node) => node.id === "node-1" && node.kind === "activity"
      ? { ...node, activity: { ...node.activity, locationId: " " } } : node);
    expect(validateParkRoute(emptyLocation).some((error) => error.includes("activity.locationId 不能为空"))).toBe(true);

    const emptyEncounter = parkRouteNodes.map((node) => node.id === "node-5" && node.kind === "battle"
      ? { ...node, battle: { ...node.battle, encounterId: " " } } : node);
    expect(validateParkRoute(emptyEncounter).some((error) => error.includes("encounterId 不能为空"))).toBe(true);
  });
});
