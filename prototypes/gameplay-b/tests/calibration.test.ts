import { describe, expect, it } from "vitest";
import { parkInitialParty, parkRouteNodes } from "../src/content/park-route.js";
import type { BattleCombatantSnapshot } from "../src/model.js";
import { GameplayBRouteRuntime, type GameplayBRouteView } from "../src/runtime.js";
import { CALIBRATION_CONFIGURATION_VERSION, CALIBRATION_SEEDS, DIAGNOSTIC_CLICK_CAP } from "./calibration-seeds.js";

const SCOST_CAP = 5;

interface CalibrationStats {
  seed: string;
  result: GameplayBRouteView["result"];
  clicks: number;
  battleRounds: number;
  battleRoundsByNode: Record<string, number>;
  activityDice: number;
  allyDownTransitions: number;
  enemyDownTransitions: number;
  observeActions: number;
  skillChecks: number;
  triggeredSkills: number;
  freeSkillActions: number;
  recipeMatches: number;
  diagnosticCapReached: boolean;
}

interface CalibrationRun {
  trace: GameplayBRouteView[];
  stats: CalibrationStats;
}

function configurationFingerprint(): string {
  const json = JSON.stringify({ nodes: parkRouteNodes, initialParty: parkInitialParty });
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${CALIBRATION_CONFIGURATION_VERSION}:fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function assertCombatant(combatant: BattleCombatantSnapshot): void {
  expect(Number.isInteger(combatant.hp)).toBe(true);
  expect(combatant.hp).toBeGreaterThanOrEqual(0);
  expect(combatant.hp).toBeLessThanOrEqual(combatant.hpMax);
  if (combatant.side === "ally") {
    expect(combatant.currentBattleSCost).not.toBeNull();
    expect(combatant.currentBattleSCost).toBeGreaterThanOrEqual(0);
    expect(combatant.currentBattleSCost).toBeLessThanOrEqual(SCOST_CAP);
  } else {
    expect(combatant.currentBattleSCost).toBeNull();
  }
}

function assertViewInvariants(view: GameplayBRouteView): void {
  expect(view.nodeCount).toBe(parkRouteNodes.length);
  expect(view.nodeIndex).toBeGreaterThanOrEqual(0);
  expect(view.nodeIndex).toBeLessThan(view.nodeCount);
  expect(view.currentNode.id).toBe(parkRouteNodes[view.nodeIndex]?.id);
  expect(view.terminal).toBe(view.result !== "ongoing");

  const partyIds = new Set<string>();
  for (const member of view.party) {
    expect(partyIds.has(member.id)).toBe(false);
    partyIds.add(member.id);
    expect(Number.isInteger(member.hp)).toBe(true);
    expect(member.hp).toBeGreaterThanOrEqual(0);
    expect(member.hp).toBeLessThanOrEqual(member.hpMax);
    if (view.currentNode.kind === "battle") {
      expect(member.currentBattleSCost).not.toBeNull();
      expect(member.currentBattleSCost).toBeGreaterThanOrEqual(0);
      expect(member.currentBattleSCost).toBeLessThanOrEqual(SCOST_CAP);
    } else {
      expect(member.currentBattleSCost).toBeNull();
    }
  }

  for (const [index, event] of view.events.entries()) {
    expect(event.sequence).toBe(index + 1);
    expect(event.click).toBeGreaterThanOrEqual(0);
    expect(event.click).toBeLessThanOrEqual(view.clickCount);
    if (index > 0) expect(event.click).toBeGreaterThanOrEqual(view.events[index - 1]!.click);
  }

  if (!view.currentBattle) {
    expect(view.currentNode.kind).not.toBe("battle");
    return;
  }
  expect(view.currentNode.kind).toBe("battle");
  const combatantIds = new Set<string>();
  for (const combatant of view.currentBattle.state.combatants) {
    expect(combatantIds.has(combatant.actorId)).toBe(false);
    combatantIds.add(combatant.actorId);
    assertCombatant(combatant);
  }
  for (const combatant of view.currentBattle.pendingRound?.combatants ?? []) assertCombatant(combatant);
  for (const cost of view.currentBattle.pendingRound?.partyStartSCost ?? []) {
    expect(cost.value).toBeGreaterThanOrEqual(0);
    expect(cost.value).toBeLessThanOrEqual(SCOST_CAP);
  }
}

function countDownTransitions(before: GameplayBRouteView, after: GameplayBRouteView): Pick<CalibrationStats, "allyDownTransitions" | "enemyDownTransitions"> {
  let allyDownTransitions = 0;
  let enemyDownTransitions = 0;
  const afterParty = new Map(after.party.map((member) => [member.id, member.hp]));
  for (const member of before.party) {
    if (member.hp > 0 && afterParty.get(member.id) === 0) allyDownTransitions += 1;
  }

  const pendingCombatants = before.currentBattle?.pendingRound?.combatants ?? [];
  if (pendingCombatants.length > 0) {
    const afterCombatants = after.currentBattle?.state.combatants;
    if (afterCombatants) {
      const afterHp = new Map(afterCombatants.map((combatant) => [combatant.actorId, combatant.hp]));
      for (const combatant of pendingCombatants) {
        if (combatant.side === "enemy" && combatant.hp > 0 && afterHp.get(combatant.actorId) === 0) enemyDownTransitions += 1;
      }
    } else if (after.currentNode.kind !== "battle") {
      // A victory clears the battle projection only after every enemy has reached 0 HP.
      enemyDownTransitions += pendingCombatants.filter((combatant) => combatant.side === "enemy" && combatant.hp > 0).length;
    }
  }
  return { allyDownTransitions, enemyDownTransitions };
}

function runCalibration(seed: string, diagnosticClickCap = DIAGNOSTIC_CLICK_CAP): CalibrationRun {
  if (!Number.isInteger(diagnosticClickCap) || diagnosticClickCap < 0) throw new RangeError("Diagnostic click cap must be a non-negative integer.");
  const runtime = new GameplayBRouteRuntime({ seed, nodes: parkRouteNodes, initialParty: parkInitialParty });
  const trace: GameplayBRouteView[] = [runtime.getView()];
  let view = trace[0]!;
  const stats: CalibrationStats = {
    seed,
    result: "ongoing",
    clicks: 0,
    battleRounds: 0,
    battleRoundsByNode: {},
    activityDice: 0,
    allyDownTransitions: 0,
    enemyDownTransitions: 0,
    observeActions: 0,
    skillChecks: 0,
    triggeredSkills: 0,
    freeSkillActions: 0,
    recipeMatches: 0,
    diagnosticCapReached: false,
  };

  assertViewInvariants(view);
  while (!view.terminal && view.clickCount < diagnosticClickCap) {
    const before = view;
    const battle = before.currentBattle;
    if (battle?.pendingRound) {
      stats.battleRounds += 1;
      stats.battleRoundsByNode[before.currentNode.id] = (stats.battleRoundsByNode[before.currentNode.id] ?? 0) + 1;
      stats.observeActions += battle.pendingRound.playerActions.filter((action) => action.kind === "observe").length;
      stats.skillChecks += battle.pendingSkills?.checks.length ?? 0;
      stats.triggeredSkills += battle.pendingSkills?.checks.filter((check) => check.triggered).length ?? 0;
      stats.freeSkillActions += battle.pendingSkills?.supplementalFreeActions.length ?? 0;
      stats.recipeMatches += battle.pendingRecipePlan?.matches.length ?? 0;
    }

    view = runtime.click();
    expect(view.clickCount).toBe(before.clickCount + 1);
    stats.activityDice += view.events.slice(before.events.length).filter((event) => event.dice !== undefined).length;
    const downTransitions = countDownTransitions(before, view);
    stats.allyDownTransitions += downTransitions.allyDownTransitions;
    stats.enemyDownTransitions += downTransitions.enemyDownTransitions;
    assertViewInvariants(view);
    trace.push(view);
  }

  stats.clicks = view.clickCount;
  stats.result = view.result;
  stats.diagnosticCapReached = !view.terminal && view.clickCount >= diagnosticClickCap;
  return { trace, stats };
}

describe("fixed-seed route calibration", () => {
  it("records deterministic full-view traces and descriptive play metrics", () => {
    const reports = CALIBRATION_SEEDS.map((seed) => {
      const first = runCalibration(seed);
      const replay = runCalibration(seed);
      expect(replay.trace).toEqual(first.trace);
      expect(replay.stats).toEqual(first.stats);
      return first.stats;
    });

    console.info("GAMEPLAY_B_CALIBRATION", JSON.stringify({
      configurationFingerprint: configurationFingerprint(),
      seedCount: CALIBRATION_SEEDS.length,
      diagnosticClickCap: DIAGNOSTIC_CLICK_CAP,
      reports,
    }));
    expect(reports).toHaveLength(CALIBRATION_SEEDS.length);
  });

  it("uses the cap only to stop diagnostics while leaving the game ongoing", () => {
    const capped = runCalibration("gameplay-b-calibration-cap-check", 1);
    expect(capped.stats).toMatchObject({ clicks: 1, result: "ongoing", diagnosticCapReached: true });
    expect(capped.trace.at(-1)?.terminal).toBe(false);
  });
});
