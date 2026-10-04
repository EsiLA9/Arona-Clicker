export type ActivityOutcomeKind = "clue" | "none" | "effect";
export type ActivityHpEffect =
  | { readonly kind: "heal"; readonly amount: number }
  | { readonly kind: "damage"; readonly amount: number };
export type ActivityOutcome =
  | { readonly kind: "clue" | "none"; readonly text: string }
  | { readonly kind: "effect"; readonly text: string; readonly effect: ActivityHpEffect };

export interface ActivityFixedEffect { readonly kind: "heal-party"; readonly amount: number; readonly text: string }
export interface ChanceActivityCheck {
  readonly kind: "chance";
  readonly dieSides: number;
  readonly outcomes: Readonly<Record<number, { readonly success: boolean; readonly outcome: ActivityOutcome }>>;
}
export interface AttributeActivityCheck {
  readonly kind: "attribute";
  readonly dieSides: number;
  readonly attribute: "atk" | "def";
  readonly activityTag?: string;
  readonly difficulty: number;
  readonly success: ActivityOutcome;
  readonly failure: ActivityOutcome;
}
export interface LocationActivityDefinition {
  readonly locationId: string;
  readonly fixedEffects: readonly ActivityFixedEffect[];
  readonly individualCheck?: ChanceActivityCheck | AttributeActivityCheck;
}
export interface ActivityCharacterSnapshot {
  readonly id: string;
  readonly name: string;
  readonly inParty: boolean;
  readonly hp: number;
  readonly hpMax: number;
  readonly atk: number;
  readonly def: number;
  readonly activityTags: readonly string[];
}
export interface ActivityRoll { readonly actorId: string; readonly value: number }
export interface ActivityCharacterDelta { readonly actorId: string; readonly hpBefore: number; readonly hpAfter: number; readonly hpDelta: number }
export interface ActivityIndividualResult extends ActivityCharacterDelta {
  readonly dice: { readonly sides: number; readonly value: number };
  readonly checkValue?: number;
  readonly success: boolean;
  readonly outcome: ActivityOutcomeKind;
  readonly effect?: ActivityHpEffect;
  readonly text: string;
}
export type ActivityResolutionEvent =
  | { readonly type: "fixed-effect"; readonly locationId: string; readonly effect: ActivityHpEffect; readonly changes: readonly ActivityCharacterDelta[]; readonly text: string }
  | { readonly type: "individual-result"; readonly locationId: string; readonly result: ActivityIndividualResult };
export interface ActivityResolutionInput {
  readonly party: readonly ActivityCharacterSnapshot[];
  readonly activity: LocationActivityDefinition;
  readonly rolls: readonly ActivityRoll[];
}
export interface ActivityResolution {
  readonly individualResults: readonly ActivityIndividualResult[];
  readonly hpDeltas: readonly ActivityCharacterDelta[];
  readonly events: readonly ActivityResolutionEvent[];
  readonly partyDefeated: boolean;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive integer.`);
}

function applyHpEffect(hp: number, hpMax: number, effect: ActivityHpEffect): number {
  assertPositiveInteger(effect.amount, "Activity effect amount");
  return effect.kind === "heal" ? Math.min(hpMax, hp + effect.amount) : Math.max(0, hp - effect.amount);
}

function validateParty(party: readonly ActivityCharacterSnapshot[]): void {
  const ids = new Set<string>();
  for (const character of party) {
    if (ids.has(character.id)) throw new RangeError(`Duplicate activity character ID: ${character.id}`);
    ids.add(character.id);
    if (!Number.isInteger(character.hpMax) || character.hpMax < 1 || !Number.isInteger(character.hp) || character.hp < 0 || character.hp > character.hpMax) {
      throw new RangeError(`Invalid activity HP for character ${character.id}.`);
    }
  }
}

function validateActivity(activity: LocationActivityDefinition): void {
  for (const effect of activity.fixedEffects) assertPositiveInteger(effect.amount, "Fixed activity effect amount");
  const check = activity.individualCheck;
  if (!check) return;
  assertPositiveInteger(check.dieSides, "Activity die sides");
  if (check.kind === "chance") {
    for (let value = 1; value <= check.dieSides; value += 1) {
      if (!check.outcomes[value]) throw new RangeError(`Missing activity outcome for die value ${value}.`);
    }
  } else if (!Number.isInteger(check.difficulty)) {
    throw new RangeError("Activity difficulty must be an integer.");
  }
}

function validateRolls(rolls: readonly ActivityRoll[], ids: readonly string[], dieSides?: number): void {
  if (rolls.length !== ids.length) throw new RangeError(`Expected ${ids.length} activity rolls; received ${rolls.length}.`);
  for (let index = 0; index < ids.length; index += 1) {
    const roll = rolls[index]!;
    if (roll.actorId !== ids[index]) throw new RangeError(`Activity roll ${index + 1} must belong to ${ids[index]}.`);
    if (!dieSides || !Number.isInteger(roll.value) || roll.value < 1 || roll.value > dieSides) {
      throw new RangeError(`Invalid activity die value for character ${roll.actorId}.`);
    }
  }
}

export function resolveActivity(input: ActivityResolutionInput): ActivityResolution {
  validateParty(input.party);
  validateActivity(input.activity);
  const party = input.party.filter((character) => character.inParty);
  const currentHp = new Map(input.party.map((character) => [character.id, character.hp]));
  const events: ActivityResolutionEvent[] = [];

  for (const fixedEffect of input.activity.fixedEffects) {
    const changes = party.map((character): ActivityCharacterDelta => {
      const hpBefore = currentHp.get(character.id)!;
      const hpAfter = Math.min(character.hpMax, hpBefore + fixedEffect.amount);
      currentHp.set(character.id, hpAfter);
      return { actorId: character.id, hpBefore, hpAfter, hpDelta: hpAfter - hpBefore };
    });
    events.push({
      type: "fixed-effect", locationId: input.activity.locationId,
      effect: { kind: "heal", amount: fixedEffect.amount }, changes, text: fixedEffect.text,
    });
  }

  const check = input.activity.individualCheck;
  const eligible = party.filter((character) => currentHp.get(character.id)! > 0);
  validateRolls(input.rolls, check ? eligible.map((character) => character.id) : [], check?.dieSides);
  const individualResults: ActivityIndividualResult[] = [];

  if (check) eligible.forEach((character, index) => {
    const roll = input.rolls[index]!;
    let success: boolean;
    let outcome: ActivityOutcome;
    let checkValue: number | undefined;
    if (check.kind === "chance") {
      const rolled = check.outcomes[roll.value]!;
      success = rolled.success;
      outcome = rolled.outcome;
    } else {
      const tagBonus = check.activityTag && character.activityTags.includes(check.activityTag) ? 1 : 0;
      checkValue = roll.value + character[check.attribute] + tagBonus;
      success = checkValue >= check.difficulty;
      outcome = success ? check.success : check.failure;
    }

    const hpBefore = currentHp.get(character.id)!;
    const effect = outcome.kind === "effect" ? outcome.effect : undefined;
    const hpAfter = effect ? applyHpEffect(hpBefore, character.hpMax, effect) : hpBefore;
    currentHp.set(character.id, hpAfter);
    const result: ActivityIndividualResult = {
      actorId: character.id, dice: { sides: check.dieSides, value: roll.value },
      ...(checkValue === undefined ? {} : { checkValue }), success, outcome: outcome.kind,
      ...(effect ? { effect } : {}), hpBefore, hpAfter, hpDelta: hpAfter - hpBefore, text: outcome.text,
    };
    individualResults.push(result);
    events.push({ type: "individual-result", locationId: input.activity.locationId, result });
  });

  const hpDeltas = party.map((character): ActivityCharacterDelta => {
    const hpAfter = currentHp.get(character.id)!;
    return { actorId: character.id, hpBefore: character.hp, hpAfter, hpDelta: hpAfter - character.hp };
  });
  const partyDefeated = party.length > 0 && party.every((character) => currentHp.get(character.id) === 0);
  return { individualResults, hpDeltas, events, partyDefeated };
}
