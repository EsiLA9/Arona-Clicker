export type CharacterSkillCondition =
  | "enemy-charge"
  | "own-front-charge"
  | "prepared-ally-attack"
  | "own-sniper"
  | "injured-ally-half"
  | "own-blast-front";

export type CharacterSkillOutput =
  | "companion-cover"
  | "follow-up"
  | "encouragement"
  | "calibrated-sight"
  | "first-aid-instinct"
  | "aftershock";

export interface CharacterSkillDefinition {
  readonly actorId: string;
  readonly id: string;
  readonly condition: CharacterSkillCondition;
  readonly output: CharacterSkillOutput;
  readonly dieSides: 4;
  readonly triggerValue: 1;
}

// The 1d4 threshold and probability are provisional prototype defaults from 0184/R02.
export const characterSkills: readonly CharacterSkillDefinition[] = [
  { actorId: "shiori", id: "shiori-companion-cover", condition: "enemy-charge", output: "companion-cover", dieSides: 4, triggerValue: 1 },
  { actorId: "yuri", id: "yuri-follow-up", condition: "own-front-charge", output: "follow-up", dieSides: 4, triggerValue: 1 },
  { actorId: "mei", id: "mei-encouragement", condition: "prepared-ally-attack", output: "encouragement", dieSides: 4, triggerValue: 1 },
  { actorId: "tsumugi", id: "tsumugi-calibrated-sight", condition: "own-sniper", output: "calibrated-sight", dieSides: 4, triggerValue: 1 },
  { actorId: "chise", id: "chise-first-aid-instinct", condition: "injured-ally-half", output: "first-aid-instinct", dieSides: 4, triggerValue: 1 },
  { actorId: "reina", id: "reina-aftershock", condition: "own-blast-front", output: "aftershock", dieSides: 4, triggerValue: 1 },
];
