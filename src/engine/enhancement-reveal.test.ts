// ============================================================
// engine/enhancement-reveal.test.ts — 信息揭示阶梯（RevealStage）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from './game-instance';
import { baseDatapack } from '../data/index';
import { createUIContext } from '../ui/context';
import { getEnhancementReveal } from '../ui/components/tooltip';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const PRINTER = 'base:spot:credit_printer';
const OFFICE_LAYOUT = 'base:enh:office_layout';
const CREDIT_SYSTEM = 'base:enh:credit_system';

const revealOf = (game: GameInstance, enhId: string) =>
  getEnhancementReveal(createUIContext(game), game.registry.enhancements.get(enhId)!);

describe('Enhancement 信息揭示阶梯', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('def without a reveal ladder stays fully known and purchaseable', () => {
    // credit_system 无 reveal 定义 → 名字/条件/效用全可见；解锁条件满足即可购买
    game.state.resources[CREDIT] = 500;
    expect(revealOf(game, CREDIT_SYSTEM)).toMatchObject({ stage: 'purchaseable', nameKnown: true });
  });

  test('office_layout: presence/partial → known → purchaseable as printer levels rise', () => {
    // credit_printer 初始 1：条件已揭示（>=1），名称未揭示（>=2）→ partial
    expect(revealOf(game, OFFICE_LAYOUT)).toMatchObject({
      stage: 'partial',
      nameKnown: false,
      conditionKnown: true,
      utilityKnown: false,
    });

    // credit_printer → 2：名称揭示，且解锁条件满足 → 可购买
    game.state.spotLevels[PRINTER] = 2;
    expect(revealOf(game, OFFICE_LAYOUT)).toMatchObject({ stage: 'purchaseable', nameKnown: true });
  });

  test('utility stays hidden until its own condition is met', () => {
    // 构造：credit_printer = 3 → 效用揭示（utility），但仍受解锁条件限制（>=2 已满足 → purchaseable）
    game.state.spotLevels[PRINTER] = 3;
    const reveal = revealOf(game, OFFICE_LAYOUT);
    expect(reveal.stage).toBe('purchaseable');
    expect(reveal.utilityKnown).toBe(true);
  });

  test('owned enhancement reports stage owned', () => {
    game.state.resources[CREDIT] = 500;
    game.state.spotLevels[PRINTER] = 2;
    expect(game.purchaseEnhancement(OFFICE_LAYOUT).success).toBe(true);
    expect(revealOf(game, OFFICE_LAYOUT).stage).toBe('owned');
  });

  test('invisible when existence trigger is unmet', () => {
    // 临时给 credit_system 加 existence Trigger（永假）→ invisible
    const enh = game.registry.enhancements.get(CREDIT_SYSTEM)!;
    const original = enh.revealTriggers;
    (enh as { revealTriggers?: unknown }).revealTriggers = [
      { reveal: 'existence', condition: { type: 'AND', conditions: [{ target: 'resource', key: CREDIT, comparator: '>=', value: 99999 }] } },
    ];
    expect(revealOf(game, CREDIT_SYSTEM).stage).toBe('invisible');
    (enh as { revealTriggers?: unknown }).revealTriggers = original;
  });
});
