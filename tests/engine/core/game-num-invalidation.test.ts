import type { Datapack } from '../../../src/data-services/contracts/datapack';
// ============================================================
// engine/game-num-invalidation.test.ts — Phase 5 陈旧读回归
//
// 每条生产相关 mutation 写路径：先求值（建立跨帧缓存）→ 变更 → 立即断言
// evaluateResourceGain 反映新值（不经整树失效、不经 tick）。覆盖：
//   changeResource / setResource（读资源的 gain，Phase 3 依赖定向失效）
//   setSpotLevel / addSpotLevel（owned / 功能 flows）
//   setExtra / addExtra（data 源 gain）
//   addEnhancement / removeEnhancement（zone mul 桥接）
//   zone 记录 expr 读资源（zoneKeyResourceDeps 定向失效）
//   Affector 条件翻转（资源阈值 → flows 进出，notifyGameNum 链）
// 多帧 tick 基线由 game-num-snapshot.test.ts 覆盖。
// ============================================================
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { Expr, value, cond, and } from '../../../src/engine/types';
import { spot } from '../../../src/arona-clicker/content/def-factory/spot';
import { area } from '../../../src/arona-clicker/content/def-factory/area';
import { init } from '../../../src/arona-clicker/content/def-factory/init';
import { extra } from '../../../src/engine/extra/index';
import { tagPath } from '../../../src/engine/core/tag';
import type { EnhancementDef } from '../../../src/data-services/contracts/enhancement';

const CREDIT = 'base:resource:credit';
const PRINTER = 'test:spot:printer';
const RES_SPOT = 'test:spot:res_reader';
const EXTRA_SPOT = 'test:spot:extra_reader';
const AREA = 'test:area:a';
const INIT = 'test:init:a';
const ENH_ZONE = 'test:enhancement:zone-expr';
const ENH_GATE = 'test:enhancement:gate-flows';
const ACTIVATION = 'test:resource:activation';

const datapack = {
  name: 'test:dp:invalidation',
  version: '1',
  inits: [init(INIT).name('A').desc('测试').areas(AREA).build()],
  areas: [area(AREA, INIT).name('A').desc('测试').spots(PRINTER, RES_SPOT, EXTRA_SPOT).build()],
  spots: [
    spot(PRINTER, AREA)
      .name('Printer')
      .desc('测试')
      .cost(0)
      .flow('test:flow:printer', CREDIT, 5)
      .tags(tagPath('test'))
      .linearYield('test:funclet:printer_linear', CREDIT, 2)
      .genericUpgrade(50, 2, 2)
      .build(),
    // Spot flow = 5 + 持有信用点（读资源的 gain，覆盖 flowsResourceDeps 定向失效）
    spot(RES_SPOT, AREA)
      .name('ResReader')
      .desc('测试')
      .cost(0)
      .flow('test:flow:res-reader', CREDIT, Expr.add(Expr.const(5), Expr.val(value('res', { resource: CREDIT }))))
      .tags(tagPath('test'))
      .build(),
    // Spot flow = extra 三层合并视图 testprod.bonus（覆盖 extraChanged 失效）
    spot(EXTRA_SPOT, AREA)
      .name('ExtraReader')
      .desc('测试')
      .cost(0)
      .flow('test:flow:extra-reader', CREDIT, Expr.val(value('data', { path: 'testprod.bonus' })))
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
              effects: [{ op: 'addResource', target: ACTIVATION, value: 1 }],
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
    game.inits.startNewGame(INIT);
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

  test('固定 flow 不随同资源的动态 flow 一起失效', () => {
    game.mutations.setSpotLevel(PRINTER, 1);
    game.mutations.setSpotLevel(RES_SPOT, 1);
    expect(gain()).toBe(12);
    const fixed = game.gameNumSystem.flowsNodeById.get(`flows:${PRINTER}:${CREDIT}:product`)!;
    expect(fixed.dirty).toBe(false);
    game.mutations.changeResource(CREDIT, 10);
    expect(fixed.dirty).toBe(false);
    expect(gain()).toBe(22);
  });

  test('热替换只撤回原来源，新资源可入账，同桶其他来源继续响应输入', () => {
    const nextResource = 'test:resource:hot';
    const readCredit = Expr.val(value('res', { resource: CREDIT }));
    for (const id of ['test:pack:one', 'test:pack:two']) {
      game.affectorEngine.registerPack({
        id, entries: [{ id: 'entry', effects: [], flows: [{ resource: CREDIT, value: readCredit }] }],
      });
      game.affectorEngine.mount(id, 'test:item:source');
    }
    game.mutations.setResource(CREDIT, 10);
    expect(gain()).toBe(20);
    game.affectorEngine.registerPack({
      id: 'test:pack:one', entries: [{ id: 'entry', effects: [], flows: [{ resource: nextResource, value: 3 }] }],
    });
    expect(gain()).toBe(10);
    expect(game.gameNumSystem.evaluateResourceGain(nextResource, game.state)).toBe(3);
    game.mutations.setResource(CREDIT, 15);
    expect(gain()).toBe(15);
    game.affectorEngine.unmount('test:pack:one@test:item:source');
    expect(game.gameNumSystem.evaluateResourceGain(nextResource, game.state)).toBe(0);
  });

  test('读档重建持续贡献，已发放的激活奖励只记一次', () => {
    game.mutations.setResource(CREDIT, 100);
    game.mutations.addEnhancement(ENH_GATE);
    expect(game.state.resources[ACTIVATION]).toBe(1);
    expect(gain()).toBe(10);
    game.load(game.save());
    expect(game.state.resources[ACTIVATION]).toBe(1);
    expect(gain()).toBe(10);
  });

  test('setSpotLevel/addSpotLevel → owned/功能 flows 立即反映', () => {
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
    // zone mul 只乘 Spot product（flow 在根级加法不受乘区影响）
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
    // Spot flow(5+30) + zone flat(30)：两个动态节点都必须随 resourceChanged 重算
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

  test('读档离线按同一个起始状态批量结算，在线 Tick 恢复后再检查里程碑', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(40_000_000);
    try {
      const pyroxene = 'base:resource:pyroxene';
      game.mutations.setSpotLevel(RES_SPOT, 1);
      game.mutations.setResource(CREDIT, 10);
      game.load({ ...game.save(), timestamp: 0 });
      game.affectorEngine.registerPack({
        id: 'test:pack:offline',
        entries: [{
          id: 'entry', effects: [],
          flows: [{ resource: pyroxene, value: Expr.val(value('res', { resource: CREDIT })) }],
          perTickEffects: [{ op: 'addResource', target: 'test:resource:per-tick', value: 1 }],
        }],
      });
      game.affectorEngine.mount('test:pack:offline', 'test:item:offline');
      const onCredit = vi.fn(() => game.state.globalResources?.[pyroxene]);
      const tickEvent = vi.fn();
      game.eventBus.on('resourceChanged', event => { if (event.resource === CREDIT) onCredit(); });
      game.eventBus.on('tick', tickEvent);
      const priorProduction = game.statsService.evaluate(`$GlobalProducedAmount ${CREDIT}`)!;
      game.start();
      expect(game.state.totalFrames).toBe(28_800);
      expect(game.state.resources[CREDIT]).toBe(10 + 15 * 28_800);
      expect(game.state.globalResources?.[pyroxene]).toBe(10 * 28_800);
      expect(game.statsService.evaluate(`$GlobalProducedAmount ${CREDIT}`)).toBe(priorProduction + 15 * 28_800);
      expect(game.statsService.evaluate('$GlobalFramesActive')).toBe(28_800);
      expect(onCredit.mock.results).toEqual([{ type: 'return', value: 10 * 28_800 }]);
      expect(tickEvent).not.toHaveBeenCalled();
      expect(game.state.resources['test:resource:per-tick']).toBeUndefined();
      const milestone = 'base:trigger:first_credit_milestone';
      expect(game.state.triggersCompleted).not.toContain(milestone);
      game.stop();
      game.start();
      expect(game.state.totalFrames).toBe(28_800);
      game.tick();
      expect(game.state.triggersCompleted).toContain(milestone);
      expect(game.state.resources['test:resource:per-tick']).toBe(1);
    } finally {
      game.stop();
      now.mockRestore();
    }
  });

  test('无产出只累计首帧，期间没有在线 Tick 事件', () => {
    game.sessionService.setLastTick(Date.now() - 20_000);
    const tickEvent = vi.fn();
    game.eventBus.on('tick', tickEvent);
    game.start();
    expect(game.state.totalFrames).toBe(1);
    expect(game.statsService.evaluate('$GlobalFramesActive')).toBe(1);
    expect(tickEvent).not.toHaveBeenCalled();
  });
});
