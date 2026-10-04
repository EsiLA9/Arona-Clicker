import type {
  BattleActionEffect, BattleCondition, BattleEnemyMember, BattlePartyMember,
  BattlePreparationInput, BattleRow, BattleSide, BattleTargetRule,
  EnemyIntentDefinition, OrdinaryBattleCardDefinition,
} from "../model.js";

const low = (side: BattleSide, rows: readonly (BattleRow | "any")[], requirement?: "injured-half" | "prepared-attack"): BattleTargetRule =>
  ({ kind: "lowest", side, rows, ...(requirement ? { requirement } : {}) });
const attack = (target: BattleTargetRule): BattleActionEffect => ({ kind: "attack", target });
const shield = (target: BattleTargetRule): BattleActionEffect => ({ kind: "shield", amount: 2, target });
const heal = (target: BattleTargetRule, amount: number): BattleActionEffect => ({ kind: "heal", amount, target });
const buff = (target: BattleTargetRule): BattleActionEffect => ({ kind: "attack-buff", amount: 1, target });
const card = (id: string, name: string, cost: number, tag: string, effect: BattleActionEffect): OrdinaryBattleCardDefinition =>
  ({ id, name, cost, tags: [tag], effect });
const step = (cardId: string, condition: BattleCondition, holdCost: number, reserveException?: "heal-wounded-ally" | "cover-enemy-charge", minimumCurrentSCost?: number) =>
  ({ cardId, condition, holdCost, ...(reserveException ? { reserveException } : {}), ...(minimumCurrentSCost === undefined ? {} : { minimumCurrentSCost }) });
const member = (id: string, name: string, row: BattleRow, hpMax: number, atk: number, def: number,
  cards: OrdinaryBattleCardDefinition[], aiPriority: ReturnType<typeof step>[], hp = hpMax): BattlePartyMember =>
  ({ definition: { id, name, row, hpMax, atk, def, cards, aiPriority }, hp, currentBattleSCost: 2 });
const intent = (id: string, name: string, tag: string, target: BattleTargetRule): EnemyIntentDefinition =>
  ({ id, name, tags: [tag], effect: attack(target) });
const enemy = (id: string, name: string, row: BattleRow, hp: number, atk: number, def: number,
  intentPattern: EnemyIntentDefinition[]): BattleEnemyMember =>
  ({ definition: { id, name, row, hpMax: hp, atk, def, intentPattern }, hp });
const frontThenAny = low("enemy", ["front", "back"]);

export const firstBattle = {
  encounterId: "node-5-first-battle",
  round: 1,
  party: [
    member("shiori", "小栞", "front", 13, 2, 1,
      [card("shiori-cover", "掩护", 1, "cover", shield({ kind: "intent-target", intentTag: "charge" })), card("shiori-charge", "冲锋", 2, "charge", attack(frontThenAny))],
      [step("shiori-cover", { kind: "enemy-intent", tag: "charge" }, 0, "cover-enemy-charge"), step("shiori-charge", { kind: "enemy-row-alive", row: "front" }, 1)]),
    member("yuri", "由理", "front", 11, 3, 0,
      [card("yuri-blast", "爆破", 3, "blast", attack({ kind: "all", side: "enemy", row: "front" })), card("yuri-charge", "冲锋", 1, "charge", attack(frontThenAny))],
      [step("yuri-blast", { kind: "enemy-front-count", minimum: 2 }, 0), step("yuri-charge", { kind: "enemy-row-alive", row: "front" }, 0)]),
    member("mei", "芽衣", "back", 9, 2, 0,
      [card("mei-medical", "医疗", 3, "support", heal(low("ally", ["any"], "injured-half"), 2)), card("mei-inspire", "鼓舞", 2, "support", buff(low("ally", ["any"], "prepared-attack"))), card("mei-shot", "连携射击", 1, "shoot", attack(frontThenAny))],
      [step("mei-medical", { kind: "injured-ally-half" }, 2, "heal-wounded-ally"), step("mei-inspire", { kind: "prepared-ally-attack" }, 2), step("mei-shot", { kind: "enemy-row-alive", row: "front" }, 2)]),
    member("tsumugi", "纺希", "back", 8, 3, 0,
      [card("tsumugi-quick-shot", "快速射击", 1, "shoot", attack(frontThenAny)), card("tsumugi-sniper", "狙击", 3, "sniper", attack(low("enemy", ["back", "front"])))],
      [step("tsumugi-sniper", { kind: "enemy-row-alive", row: "back" }, 0, undefined, 3), step("tsumugi-quick-shot", { kind: "enemy-row-alive", row: "front" }, 2)]),
  ],
  enemies: [
    enemy("charger", "冲撞者", "front", 8, 2, 0, [intent("charger-charge", "冲锋", "charge", low("ally", ["front", "back"]))]),
    enemy("water-gunner", "水枪射手", "back", 6, 2, 0, [intent("water-gunner-sniper", "狙击", "sniper", low("ally", ["back", "front"]))]),
  ],
} satisfies BattlePreparationInput;
