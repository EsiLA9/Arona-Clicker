import type { BattleEnemyIntentEffect, BattleTargetRule, EnemyIntentDefinition } from "../model.js";

function intent(id: string, name: string, tag: string, effect: BattleEnemyIntentEffect): EnemyIntentDefinition {
  return { id, name, tags: [tag], effect };
}

function charge(id: string, name = "冲锋"): EnemyIntentDefinition {
  const target: BattleTargetRule = { kind: "lowest", side: "ally", rows: ["front", "back"] };
  return intent(id, name, "charge", { kind: "attack", target });
}

function bossCharge(id: string): EnemyIntentDefinition {
  const target: BattleTargetRule = { kind: "lowest", side: "ally", rows: ["front"] };
  return intent(id, "冲锋", "charge", { kind: "attack", target });
}

function cover(id: string, name = "掩护"): EnemyIntentDefinition {
  const target: BattleTargetRule = { kind: "lowest", side: "enemy", rows: ["front"] };
  return intent(id, name, "cover", { kind: "shield", amount: 2, target });
}

const fireworksBurst = intent("fireworks-burst", "爆破", "blast", {
  kind: "fixed-damage", amount: 1, target: { kind: "all", side: "ally", row: "front" },
});
const fireworksReload = intent("fireworks-reload", "装填", "reload", { kind: "no-op" });
const bossWave = intent("red-mask-fireworks", "烟花齐放", "blast", {
  kind: "fixed-damage", amount: 1, target: { kind: "front-and-lowest-rear", side: "ally" },
});

export const armoredStudentIntent = cover("armored-student-cover");
export const temporaryLeaderIntents = [cover("temporary-leader-cover"), charge("temporary-leader-charge")] as const;
export const temporaryLeaderDamageReaction = charge("temporary-leader-reactive-charge");
export const fireworksIntents = [fireworksBurst, fireworksReload] as const;
export const redMaskIntents = [bossCharge("red-mask-charge-1"), bossCharge("red-mask-charge-2"), bossWave] as const;
