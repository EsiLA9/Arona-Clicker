import { firstBattle } from "./first-battle.js";
import type { BattleEnemyMember, BattlePreparationInput, EnemyIntentDefinition } from "../model.js";
import {
  armoredStudentIntent, fireworksIntents, redMaskIntents, temporaryLeaderDamageReaction,
  temporaryLeaderIntents,
} from "../battle/enemy-intents.js";

function enemy(id: string, name: string, row: "front" | "back", hp: number, atk: number, def: number,
  intentPattern: readonly EnemyIntentDefinition[], previousRoundDamageReaction?: EnemyIntentDefinition): BattleEnemyMember {
  return {
    definition: { id, name, row, hpMax: hp, atk, def, intentPattern,
      ...(previousRoundDamageReaction ? { previousRoundDamageReaction } : {}) },
    hp,
  };
}

const charger = firstBattle.enemies[0]!;
const waterGunner = firstBattle.enemies[1]!;
const temporaryLeader = enemy("temporary-leader", "临时领头", "front", 12, 2, 1,
  temporaryLeaderIntents, temporaryLeaderDamageReaction);
const fireworksStudent = enemy("fireworks-student", "烟花手", "back", 7, 2, 0, fireworksIntents);
const redMaskLeader = enemy("red-mask-leader", "红面具领队", "front", 18, 3, 1, redMaskIntents);
const armoredStudent = enemy("armored-student", "护具学生", "front", 9, 1, 1, [armoredStudentIntent]);

export const parkEnemyTemplates = {
  charger,
  waterGunner,
  temporaryLeader,
  fireworksStudent,
  redMaskLeader,
  armoredStudent,
} as const;

type ParkEncounter = Pick<BattlePreparationInput, "encounterId" | "enemies">;

export const parkEncounters = {
  node5: { encounterId: firstBattle.encounterId, enemies: [charger, waterGunner] },
  node9: { encounterId: "node-9-fireworks-plaza", enemies: [temporaryLeader, charger, fireworksStudent] },
  node11: { encounterId: "node-11-central-stage-boss", enemies: [redMaskLeader, armoredStudent, waterGunner] },
} satisfies Record<"node5" | "node9" | "node11", ParkEncounter>;
