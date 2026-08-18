// ============================================================
// engine/game-num.test.ts — 统一数值注册 + 懒求值（primitiveGain）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from './game-instance';
import { baseDatapack } from '../data/index';
import { Character } from './types';
import { GameNum } from './game-num';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';

const childrenOf = (node: GameNum | undefined): GameNum[] =>
  (node as { kind: 'add'; children: GameNum[] }).children ?? [];

describe('GameNum (primitiveGain 懒求值)', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('every resource registers a primitiveGain root', () => {
    expect(game.gameNumSystem.getResources()).toContain(CREDIT);
    expect(game.gameNumSystem.getResources()).toContain('base:resource:pyroxene');
    const root = game.gameNumSystem.getGainNode(CREDIT);
    expect(root).toMatchObject({ id: 'primitiveGain:base:resource:credit', kind: 'add' });
  });

  test('spot subtree expands down to owned/baseLine/tag/enh leaves', () => {
    const spotNode = childrenOf(game.gameNumSystem.getGainNode(CREDIT))
      .find(c => c.id === 'spot:base:spot:credit_printer')!;
    expect(spotNode.kind).toBe('mul');
    expect(childrenOf(spotNode).map(c => c.id)).toEqual([
      'owned:base:spot:credit_printer',
      'baseLine:base:spot:credit_printer',
      'tag:base:spot:credit_printer',
      'enh:base:spot:credit_printer',
    ]);
    // baseLine → add[ baseYield(add[expr, levelLinear]), manager(managerBonus) ]
    const baseLine = childrenOf(spotNode).find(c => c.id === 'baseLine:base:spot:credit_printer')!;
    expect(baseLine.kind).toBe('add');
    expect(childrenOf(baseLine).map(c => c.kind)).toEqual(['add', 'managerBonus']);
    // baseYield 含线性升级增量节点
    const baseYield = childrenOf(baseLine).find(c => c.id === 'baseYield:base:spot:credit_printer')!;
    expect(childrenOf(baseYield).map(c => c.kind)).toEqual(['expr', 'levelLinear']);
  });

  test('primitiveGain is lazily evaluated per tick for a resource', () => {
    // 只拥有 credit_printer（base 5 + 功能 2）
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources[CREDIT] = 0;

    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
    game.state.resources[CREDIT] = 0;
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(7);
  });

  test('unowned spots contribute zero via the owned leaf', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.resources[CREDIT] = 0;
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(0);
  });

  test('manager and tag multipliers compose inside the subtree', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.spotManagers['base:spot:credit_printer'] = Character.Arona;
    // base 5 + manager 3 = 8，Arona 对 credit tag ×1.5 → 12，+ 功能 2
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(14);
  });

  test('affectorFlows leaf aggregates addResource into the same resource', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.resources[CREDIT] = 100;
    // 购买 能量饮料后勤 Enhancement（挂载 base:pack:energy_drink，+1 credit/tick）
    game.purchaseEnhancement('base:enh:energy_supply');
    game.state.resources[CREDIT] = 0;
    // 仅 enhancement affector +1（无 spot 产出）
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(1);
  });

  test('evaluateSpotYield returns the final per-spot value including its functionality', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    // base 5 + 功能 2（linearYield 每级 +2）= 7
    expect(game.gameNumSystem.evaluateSpotYield('base:spot:credit_printer', game.state)).toBe(7);

    // 升级到 3：base 5 + 线性 2×2 + 功能 3×2 = 15
    game.state.spotLevels['base:spot:credit_printer'] = 3;
    expect(game.gameNumSystem.evaluateSpotYield('base:spot:credit_printer', game.state)).toBe(15);

    // 未拥有的 spot → 0
    game.state.spotLevels['base:spot:credit_printer'] = 0;
    expect(game.gameNumSystem.evaluateSpotYield('base:spot:credit_printer', game.state)).toBe(0);
  });
});
