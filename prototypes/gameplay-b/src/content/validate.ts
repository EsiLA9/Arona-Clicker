import type { GameplayBRouteNode } from "../runtime.js";
import { parkEncounters } from "./enemies.js";

const nodeOrder = ["node-1", "node-2", "node-3", "node-4", "node-5", "node-6", "node-7", "node-8", "node-9", "node-10", "node-11", "node-12"];
const battleNodes = new Map([
  ["node-5", parkEncounters.node5],
  ["node-9", parkEncounters.node9],
  ["node-11", parkEncounters.node11],
]);
const expectedJoins = new Map([["node-6", ["chise"]], ["node-10", ["reina"]]]);

function expectedKind(id: string): GameplayBRouteNode["kind"] {
  if (battleNodes.has(id)) return "battle";
  return id === "node-12" ? "exit" : "activity";
}

export function validateParkRoute(nodes: readonly GameplayBRouteNode[]): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const locationIds = new Set<string>();
  const encounterIds = new Set<string>();
  let noncombatActivityCount = 0;

  if (nodes.length !== nodeOrder.length) errors.push(`路线必须有 ${nodeOrder.length} 个节点，实际为 ${nodes.length} 个。`);
  for (const [index, node] of nodes.entries()) {
    const location = node.id || `第 ${index + 1} 个节点`;
    if (!node.id.trim()) errors.push(`${location}的 Route node ID 不能为空。`);
    else if (nodeIds.has(node.id)) errors.push(`路线节点 ID 重复：${node.id}。`);
    nodeIds.add(node.id);

    const expectedId = nodeOrder[index];
    if (expectedId !== node.id) errors.push(`路线顺序错误：第 ${index + 1} 位应为 ${expectedId ?? "<无额外节点>"}，实际为 ${node.id || "<空>"}。`);
    const kind = expectedKind(node.id);
    if (node.kind !== kind) errors.push(`${location} 类型应为 ${kind}，实际为 ${node.kind}。`);

    if (node.kind === "activity") {
      if (!Number.isInteger(node.activityCount) || node.activityCount < 1) errors.push(`${location} activityCount 必须为正整数。`);
      else noncombatActivityCount += node.activityCount;
      const locationId = node.activity.locationId;
      if (!locationId.trim()) errors.push(`${location} 的 activity.locationId 不能为空。`);
      else if (locationIds.has(locationId)) errors.push(`Activity location ID 重复：${locationId}。`);
      locationIds.add(locationId);
      const joins = (node.onEnter ?? []).map((entry) => entry.character.id);
      const expected = expectedJoins.get(node.id) ?? [];
      if (joins.length !== expected.length || joins.some((id, joinIndex) => id !== expected[joinIndex])) {
        errors.push(`${location} 入场招募应为 [${expected.join(", ")}]，实际为 [${joins.join(", ")}]。`);
      }
      for (const entry of node.onEnter ?? []) {
        const character = entry.character;
        if (!character.id || character.id !== character.roster.id || character.id !== character.battle.id) {
          errors.push(`${location} 招募引用 ID 不一致：${character.id || "<空>"}。`);
        }
      }
    } else if (node.kind === "battle") {
      const encounterId = node.battle.encounterId;
      const expected = battleNodes.get(node.id);
      if (!encounterId.trim()) errors.push(`${location} 的 encounterId 不能为空。`);
      else if (encounterIds.has(encounterId)) errors.push(`Battle encounter ID 重复：${encounterId}。`);
      encounterIds.add(encounterId);
      if (!expected || encounterId !== expected.encounterId) errors.push(`${location} 引用了未知或错误的 U3 遭遇 ID：${encounterId}。`);
      if (!node.battle.enemies.length) errors.push(`${location} 遭遇必须至少包含一名敌人。`);
      const enemyIds = node.battle.enemies.map((enemy) => enemy.definition.id);
      if (enemyIds.some((id) => !id) || new Set(enemyIds).size !== enemyIds.length) errors.push(`${location} 敌人 ID 不能为空或重复。`);
      if (expected && enemyIds.join("\u0000") !== expected.enemies.map((enemy) => enemy.definition.id).join("\u0000")) {
        errors.push(`${location} 敌人引用/顺序与 U3 遭遇配置不一致。`);
      }
    } else {
      if (node.activityCount !== 1) errors.push(`${location} 出口 activityCount 必须为 1。`);
      noncombatActivityCount += Number.isInteger(node.activityCount) && node.activityCount! > 0 ? node.activityCount! : 0;
    }
  }

  if (noncombatActivityCount !== 11) errors.push(`九个非战斗节点的 activityCount 合计必须为 11，实际为 ${noncombatActivityCount}。`);
  for (const nodeId of ["node-5", "node-9", "node-11"]) {
    if (!nodes.some((node) => node.id === nodeId && node.kind === "battle")) errors.push(`${nodeId} 必须是战斗节点。`);
  }
  for (const id of locationIds) if (nodeIds.has(id) || encounterIds.has(id)) errors.push(`Activity location ID ${id} 与其他 Route ID 冲突。`);
  for (const id of encounterIds) if (nodeIds.has(id)) errors.push(`Battle encounter ID ${id} 与 Route node ID 冲突。`);
  return errors;
}
