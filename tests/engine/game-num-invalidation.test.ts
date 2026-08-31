// ============================================================
// engine/game-num-invalidation.test.ts — Phase 5 陈旧读回归
//
// 每条生产相关 mutation 写路径：先求值（建立跨帧缓存）→ 变更 → 立即断言
// evaluateResourceGain 反映新值（不经整树失效、不经 tick）。覆盖：
//   changeResource / setResource（读资源的 gain，Phase 3 依赖定向失效）
//   setSpotLevel / addSpotLevel（owned / levelLinear / 功能 flows）
//   setExtra / addExtra（data 源 gain）
//   addEnhancement / removeEnhancement（zone mul 桥接）
//   zone 记录 expr 读资源（zoneKeyResourceDeps 定向失效）
//   Affector 条件翻转（资源阈值 → flows 进出，notifyGameNum 链）
// 多帧 tick 基线由 game-num-snapshot.test.ts 覆盖。
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { spot, area, init, Expr, value, cond, and } from '../../src/engine/types';
import { extra } from '../../src/engine/extra/index';
import { tagPath } from '../../src/engine/core/tag';
import type { Datapack, EnhancementDef } from '../../src/engine/types';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const PRINTER = 'base:spot:credit_printer';
const RES_SPOT = 'test:spot:res_reader';
const EXTRA_SPOT = 'test:spot:extra_reader';
const AREA = 'test:area:a';
const INIT = 'test:init:a';
const ENH_ZONE = 'test:enhancement:zone-expr';
const ENH_GATE = 'test:enhancement:gate-flows';

const datapack = {
  name: 'test:dp:invalidation',
  version: '1',
  inits: [init(INIT).name('A').desc('测试').areas(AREA).build()],
  areas: [area(AREA, INIT).name('A').desc('测试').spots(RES_SPOT, EXTRA_SPOT).build()],
  spots: [
    // baseYield = 5 + 持有信用点（读资源的 gain，覆盖 gainResourceDeps 定向失效）
    spot(RES_SPOT, AREA)
      .name('ResReader')
      .desc('测试')
      .cost(0)
      .yield(Expr.add(Expr.const(5), Expr.val(value('res', { resource: CREDIT }))))
      .capacity(100)
      .managerBonus(0)
      .tags(tagPath('test'))
      .build(),
    // baseYield = extra 三层合并视图 testprod.bonus（覆盖 extraChanged 失效）
    spot(EXTRA_SPOT, AREA)
      .name('ExtraReader')
      .desc('测试')
      .cost(0)
      .yield(Expr.val(value('data', { path: 'testprod.bonus' })))
      .capacity(100)
      .managerBonus(0)
      .tags(tagPath('test'))
      .build(),
  ],
  items: [],
  enhancements: [
    {
      id: ENH_ZONE,
      name: 'ZoneExpr',
      description: '',
      effects: [],
      autoApply: true,
      affectorPackIds: [
        {
          id: 'test:pack:zone-expr',
          entries: [
            {
              id: 'e1',
              effects: [],
              zoneModifiers: [
                {
                  target: { kind: 'entity', ref: { kind: 'spot', id: '*' } },
                  category: 'flat',
                  value: Expr.val(value('res', { resource: CREDIT })),
                  resource: CREDIT,
                },
              ],
            },
          ],
        },
      ],
    } as EnhancementDef,
    {
      id: ENH_GATE,
      name: 'GateFlows',
      description: '',
      effects: [],
      autoApply: true,
      affectorPackIds: [
        {
          id: 'test:pack:gate-flows',
          entries: [
            {
              id: 'e1',
              effects: [],
              condition: and(cond('resource', CREDIT, '>=', 100)),
              flows: [{ resource: CREDIT, value: 10 }],
            },
          ],
        },
      ],
    } as EnhancementDef,
  ],
  activeStories: [],
  passiveStories: [],
  stories: [],
} as unknown as Datapack;

describe('Phase 5 陈旧读回归（事件驱动精确失效）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack, datapack]);
    game.inits.startNewGame(OFFICE);
    // 干净起点：清空默认等级与余额（走 mutation 入口，事件即失效）
    for (const key of Object.keys(game.state.spotLevels)) game.mutations.setSpotLevel(key, 0);
    game.mutations.setResource(CREDIT, 0);
  });

  afterEach(() => {
    game.stop();
  });

  const gain = () => game.gameNumSystem.evaluateResourceGain(CREDIT, game.state);

  test('changeResource/setResource → 读资源的 gain 子树立即重算', () => {
    game.mutations.setSpotLevel(RES_SPOT, 1);
    expect(gain()).toBe(5);
    game.mutations.setResource(CREDIT, 42);
    expect(gain()).toBe(47);
    game.mutations.changeResource(CREDIT, -35);
    expect(gain()).toBe(12);
  });

  test('setSpotLevel/addSpotLevel → owned/levelLinear/功能 flows 立即反映', () => {
    game.mutations.setSpotLevel(PRINTER, 1);
    expect(gain()).toBe(7); // base 5 + 功能 2
    game.mutations.setSpotLevel(PRINTER, 2);
    expect(gain()).toBe(11); // base 5+2 + 功能 4
    game.mutations.addSpotLevel(PRINTER, 1);
    expect(gain()).toBe(15); // base 5+4 + 功能 6
  });

  test('setExtra/addExtra → data 源 gain 立即重算', () => {
    game.mutations.setSpotLevel(EXTRA_SPOT, 1);
    expect(gain()).toBe(0);
    game.mutations.setExtra('testprod.bonus', extra.int(7));
    expect(gain()).toBe(7);
    game.mutations.addExtra('testprod.bonus', 3);
    expect(gain()).toBe(10);
  });

  test('addEnhancement/removeEnhancement → zone mul 桥接立即生效/撤销', () => {
    game.mutations.setSpotLevel(PRINTER, 1);
    expect(gain()).toBe(7);
    expect(game.mutations.addEnhancement('base:enhancement:credit_system')).toBe(true);
    // zone mul 只乘 spot 子树（5×1.5），功能 flows 在根级加法不受乘区影响
    expect(gain()).toBeCloseTo(9.5, 6);
    expect(game.mutations.removeEnhancement('base:enhancement:credit_system')).toBe(true);
    expect(gain()).toBe(7);
  });

  test('zone 记录 expr 读资源 → zoneKeyResourceDeps 定向失效 zone 节点', () => {
    game.mutations.setSpotLevel(RES_SPOT, 1);
    expect(gain()).toBe(5);
    expect(game.mutations.addEnhancement(ENH_ZONE)).toBe(true);
    // flat zone = res(CREDIT) = 0：值不变，但 zone 节点已缓存
    expect(gain()).toBe(5);
    game.mutations.setResource(CREDIT, 30);
    // baseYield(5+30) + zone flat(30)：zone 节点必须随 resourceChanged 重算
    expect(gain()).toBe(65);
  });

  test('Affector 条件翻转（资源阈值）→ flows 进出立即反映', () => {
    game.mutations.setSpotLevel(RES_SPOT, 1);
    expect(game.mutations.addEnhancement(ENH_GATE)).toBe(true);
    expect(gain()).toBe(5); // 阈值未到，gate Latent
    game.mutations.setResource(CREDIT, 100);
    // resourceChanged → 条件依赖定向 recheck → Active → notifyGameNum → flows +10
    expect(gain()).toBe(115); // base 5+100 + flows 10
    game.mutations.setResource(CREDIT, 50);
    expect(gain()).toBe(55); // 翻回 Latent，flows 撤出
  });

  test('tick 多帧与事件驱动失效一致：变更后逐帧入账正确', () => {
    game.mutations.setSpotLevel(RES_SPOT, 1);
    game.mutations.setSpotLevel(PRINTER, 1);
    game.mutations.setResource(CREDIT, 10);
    expect(gain()).toBe(7 + 15); // printer 7 + res_spot 5+10
    game.mutations.setResource(CREDIT, 0);
    game.tick();
    // 本帧入账以变更时余额（0）求值：res_spot 5 + printer 7
    expect(game.state.resources[CREDIT]).toBe(12);
    game.tick();
    // 上一帧入账触发 resourceChanged 定向失效，本帧 res_spot 读到余额 12（自反增）
    expect(game.state.resources[CREDIT]).toBe(36);
  });
});
