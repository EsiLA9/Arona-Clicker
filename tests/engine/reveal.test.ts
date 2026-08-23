// ============================================================
// engine/reveal.test.ts — 揭示系统共享辅助（existence 目标）
// existence 目标即原 visibilityCondition 的职责（实体是否出现）。
// ============================================================
import { describe, test, expect } from 'vitest';
import { Condition, ConditionGroup, RevealTrigger } from '../../src/engine/types';
import { existenceCondition, existenceMet, hasExistenceGate, unlockCondition, unlockMet, unlockTriggers } from '../../src/engine/reveal';

const TRUE_COND: ConditionGroup = { type: 'AND', conditions: [] };
const FALSE_COND: ConditionGroup = {
  type: 'AND',
  conditions: [{ target: 'stat', key: '$GlobalUnlockedInits', comparator: '>=', value: 9999 }],
};
const nameTrigger: RevealTrigger = { reveal: 'name' };
const nameWithCond: RevealTrigger = { reveal: 'name', condition: TRUE_COND };
/** 模拟 ConditionSystem 求值：空 AND 组为真，其余为假（单条原子条件视为满足） */
const evaluate = (c: Condition | ConditionGroup) => !('conditions' in c) || (c.type === 'AND' && c.conditions.length === 0);

describe('reveal.existence（原 visibilityCondition 的统一入口）', () => {
  test('无 revealTriggers / 无 existence 目标 → 恒可见', () => {
    expect(hasExistenceGate(undefined)).toBe(false);
    expect(hasExistenceGate([nameWithCond])).toBe(false);
    expect(existenceMet(undefined, evaluate)).toBe(true);
    expect(existenceMet([nameTrigger], evaluate)).toBe(true);
  });

  test('存在 existence 门槛：任一满足即可见', () => {
    const triggers: RevealTrigger[] = [
      { reveal: 'existence', condition: FALSE_COND },
      { reveal: 'existence', condition: TRUE_COND },
    ];
    expect(hasExistenceGate(triggers)).toBe(true);
    expect(existenceMet(triggers, evaluate)).toBe(true);
  });

  test('存在 existence 门槛：全部不满足 → 不可见', () => {
    const blocked: RevealTrigger[] = [{ reveal: 'existence', condition: FALSE_COND }];
    expect(existenceMet(blocked, evaluate)).toBe(false);
  });

  test('existence 目标缺省条件 = 恒真', () => {
    const bare: RevealTrigger[] = [{ reveal: 'existence' }];
    expect(existenceMet(bare, evaluate)).toBe(true);
  });

  test('存在性门槛支持单条原子条件（无需套组）', () => {
    const atomic: RevealTrigger = {
      reveal: 'existence',
      condition: { target: 'stat', key: '$GlobalUnlockedInits', comparator: '>=', value: 1 },
    };
    expect(existenceCondition([atomic])).toEqual(atomic.condition);
    expect(existenceMet([atomic], evaluate)).toBe(true);
  });

  test('existenceCondition 取首个带条件的 existence 条件（供 UI 展示）', () => {
    const bare: RevealTrigger[] = [{ reveal: 'existence' }];
    const mixed: RevealTrigger[] = [
      { reveal: 'existence', condition: FALSE_COND },
      { reveal: 'existence' },
    ];
    expect(existenceCondition(undefined)).toBeUndefined();
    expect(existenceCondition(bare)).toBeUndefined();
    expect(existenceCondition([nameWithCond])).toBeUndefined();
    expect(existenceCondition(mixed)).toEqual(FALSE_COND);
  });
});

describe('reveal.unlock（实际解锁 / 自动解锁条件的统一入口）', () => {
  test('无 unlock 目标 → 无解锁门槛（恒可达）', () => {
    expect(unlockTriggers(undefined)).toEqual([]);
    expect(unlockTriggers([nameTrigger])).toEqual([]);
    expect(unlockCondition(undefined)).toBeUndefined();
    expect(unlockCondition([nameTrigger])).toBeUndefined();
    expect(unlockMet(undefined, evaluate)).toBe(true);
    expect(unlockMet([nameTrigger], evaluate)).toBe(true);
  });

  test('unlockCondition 取首个带条件的 unlock Trigger（供 UI 展示）', () => {
    const bare: RevealTrigger[] = [{ reveal: 'unlock' }];
    const mixed: RevealTrigger[] = [
      { reveal: 'unlock' },
      { reveal: 'unlock', condition: FALSE_COND },
      { reveal: 'name', condition: TRUE_COND },
    ];
    expect(unlockCondition(bare)).toBeUndefined();
    expect(unlockCondition(mixed)).toEqual(FALSE_COND);
  });

  test('解锁门槛：任一 unlock Trigger 满足即可解锁（OR）', () => {
    const triggers: RevealTrigger[] = [
      { reveal: 'unlock', condition: FALSE_COND },
      { reveal: 'unlock', condition: TRUE_COND },
    ];
    expect(unlockMet(triggers, evaluate)).toBe(true);
  });

  test('解锁门槛：全部不满足 → 拒绝解锁', () => {
    const blocked: RevealTrigger[] = [{ reveal: 'unlock', condition: FALSE_COND }];
    expect(unlockMet(blocked, evaluate)).toBe(false);
  });

  test('unlock 目标缺省条件 = 恒真', () => {
    const bare: RevealTrigger[] = [{ reveal: 'unlock' }];
    expect(unlockMet(bare, evaluate)).toBe(true);
  });

  test('unlock 与 existence 互不干扰（各自独立过滤）', () => {
    const mixed: RevealTrigger[] = [
      { reveal: 'existence', condition: TRUE_COND },
      { reveal: 'unlock', condition: FALSE_COND },
    ];
    expect(hasExistenceGate(mixed)).toBe(true);
    expect(existenceMet(mixed, evaluate)).toBe(true);
    expect(unlockMet(mixed, evaluate)).toBe(false);
  });
});
