// ============================================================
// engine/spot-reveal.test.ts — Spot 信息揭示阶梯（RevealStage）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { createUIContext } from '../../src/ui/context';
import { getSpotReveal } from '../../src/ui/components/tooltip';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const FIELD_WORK = 'base:spot:field_work';
const PRINTER = 'base:spot:credit_printer';

const revealOf = (game: GameInstance, spotId: string) =>
  getSpotReveal(createUIContext(game), game.registry.spots.get(spotId)!);

describe('Spot 信息揭示阶梯', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('unrevealed purchaseable spot is not purchaseable until its utility is revealed', () => {
    // 初始 credit 0：name（>=10）与 utility（>=40）未揭示；condition 缺省视为已知 → partial，不可购买
    expect(revealOf(game, FIELD_WORK)).toMatchObject({
      stage: 'partial',
      nameKnown: false,
      conditionKnown: true,
      utilityKnown: false,
    });

    // credit 10：名称揭示，效用未揭示 → known，仍不可购买
    game.state.resources[CREDIT] = 10;
    expect(revealOf(game, FIELD_WORK)).toMatchObject({ stage: 'known', nameKnown: true, utilityKnown: false });

    // credit 40：效用揭示 → 可购买
    game.state.resources[CREDIT] = 40;
    expect(revealOf(game, FIELD_WORK)).toMatchObject({ stage: 'purchaseable', nameKnown: true, utilityKnown: true });
  });

  test('granted spot is owned and fully revealed', () => {
    // credit_printer 开局赠送 → owned
    expect(revealOf(game, PRINTER)).toMatchObject({ stage: 'owned', nameKnown: true, utilityKnown: true });
  });
});
