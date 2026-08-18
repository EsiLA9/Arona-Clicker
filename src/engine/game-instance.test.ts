// ============================================================
// engine/game-instance.test.ts — 集成测试
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from './game-instance';
import { baseDatapack } from '../data/index';
import { Character, Datapack, Resource, Expr, cond, and, value } from './types';
import { tagPath } from './tag';
import { extra } from './extra';

/** 推进完当前自动展开的剧情（active 欢迎剧情会锁定移动）。 */
function finishWelcome(g: GameInstance): void {
  while (g.getView().currentStory) {
    const r = g.advanceStory();
    if (r.success && 'finished' in r && r.finished) break;
    if (!r.success && r.error === 'ChoiceRequired') g.advanceStory(0);
  }
}

describe('GameInstance (integration)', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('should initialize with base datapack', () => {
    game.init([baseDatapack]);
    expect(game.registry.inits.has('base:init:schale_office')).toBe(true);
    expect(game.registry.areas.has('base:area:schale_main')).toBe(true);
    expect(game.registry.spots.has('base:spot:credit_printer')).toBe(true);
  });

  test('should auto-enter default init', () => {
    game.init([baseDatapack]);
    expect(game.state.activeInit).toBe('base:init:schale_office');
  });

  test('should unlock init', () => {
    game.init([baseDatapack]);
    game.unlockInit('base:init:schale_office');
    expect(game.state.unlockedInits).toContain('base:init:schale_office');
  });

  test('should upgrade spot', () => {
    game.init([baseDatapack]);
    // 给足够资源
    game.state.resources['base:resource:credit'] = 200;
    game.state.spotLevels['base:spot:credit_printer'] = 1;

    // Lv1 → Lv2 通用升级花费 floor(50 × 2^1) = 100；升级触发 schale_first_upgrade（+10），净 -90
    const result = game.upgradeSpot('base:spot:credit_printer');
    expect(result.success).toBe(true);
    expect(game.state.spotLevels['base:spot:credit_printer']).toBe(2);
    expect(game.state.resources['base:resource:credit']).toBe(110);
  });

  test('should reject upgrade when insufficient resources', () => {
    game.init([baseDatapack]);
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources['base:resource:credit'] = 10;

    const result = game.upgradeSpot('base:spot:credit_printer');
    expect(result.success).toBe(false);
    expect(game.state.spotLevels['base:spot:credit_printer']).toBe(1);
  });

  test('should assign manager', () => {
    game.init([baseDatapack]);
    game.assignManager('base:spot:credit_printer', 'shiroko' as any);
    expect(game.state.spotManagers['base:spot:credit_printer']).toBe('shiroko');
  });

  test('should start and stop tick loop', () => {
    game.init([baseDatapack]);
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources['base:resource:credit'] = 0;

    game.start();
    expect(game.running).toBe(true);
    game.stop();
    expect(game.running).toBe(false);
  });

  test('should produce resources via tickSystem directly', () => {
    game.init([baseDatapack]);
    for (const spotId of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[spotId];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources['base:resource:credit'] = 0;

    // Each unified tick settles the Spot once. 含功能：base 5 + 每级 +2
    game.tickSystem.setState(game.state as any);
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(7);
  });

  test('should evaluate manager bonus on every unified tick', () => {
    game.init([baseDatapack]);
    for (const spotId of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[spotId];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.spotManagers['base:spot:credit_printer'] = 'shiroko' as any;
    game.state.resources['base:resource:credit'] = 0;

    game.tick();
    // 5 base + 3 manager + 2 功能
    expect(game.state.resources['base:resource:credit']).toBe(10);
  });

  test('should apply manager tag multiplier on the same unified tick', () => {
    game.init([baseDatapack]);
    for (const spotId of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[spotId];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.spotManagers['base:spot:credit_printer'] = Character.Arona;
    game.state.resources['base:resource:credit'] = 0;

    game.tick();
    // 5 base + 3 manager + 2 功能（tag 加成作用于 base 部分，功能不乘）
    expect(game.state.resources['base:resource:credit']).toBe(14);
    expect(game.getSpotYield('base:spot:credit_printer').total).toBe(12);
  });

  test('should run an active story with choice, effects, reward, and completion record', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 0;

    // 欢迎剧情因 schale_office 的 startStoryId 自动展开，已处于 page0
    expect(game.getView().currentStory).toMatchObject({
      storyId: 'base:story:schale_welcome', pageIndex: 0, totalPages: 4,
    });

    // page0 → page1（发送页，无选项）
    const secondPage = game.advanceStory();
    expect(secondPage).toMatchObject({ success: true, finished: false, story: { pageIndex: 1 } });

    // page1 → page2（选项页）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false, story: { pageIndex: 2 } });
    // 选项页必须先选
    expect(game.advanceStory()).toEqual({
      success: false,
      storyId: 'base:story:schale_welcome',
      error: 'ChoiceRequired',
    });

    const choicePage = game.advanceStory(1);
    expect(choicePage).toMatchObject({ success: true, finished: false, story: { pageIndex: 3 } });
    expect(game.state.flags.welcome_choice).toBe('production');

    const finished = game.advanceStory();
    expect(finished).toMatchObject({
      success: true,
      finished: true,
      storyId: 'base:story:schale_welcome',
      completed: { type: 'active', choiceIndex: 1 },
    });
    expect(game.state.resources['base:resource:credit']).toBe(10);
    expect(game.state.storyLog).toContainEqual({
      type: 'active', storyId: 'base:story:schale_welcome', choiceIndex: 1,
    });
    expect(game.getView().currentStory).toBeNull();
    expect(game.startActiveStory('base:story:schale_welcome')).toEqual({
      success: false,
      storyId: 'base:story:schale_welcome',
      error: 'AlreadyCompleted',
    });
  });

  test('should trigger passive stories without cooldown limits', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 0;

    // 先完成自动展开的欢迎剧情（遇选项页选第 0 项），进入剧情空闲状态
    while (game.getView().currentStory) {
      const r = game.advanceStory();
      if (r.success && 'finished' in r && r.finished) break;
      if (!r.success && r.error === 'ChoiceRequired') {
        game.advanceStory(0);
      }
    }
    expect(game.getView().currentStory).toBeNull();

    // 触发一条被动闲聊（多条之一，随机）
    const started = game.triggerPassiveStory();
    expect(started).toMatchObject({ success: true });
    if (!started.success) throw new Error('expected passive start');

    // 点击回复推进（支持多击任务：连续点击直到 completed），应用页面效果（小额奖励）
    expect(game.getSendState()).toMatchObject({ mode: 'advance' });
    let done = game.clickSend();
    while (done.type === 'working') done = game.clickSend();
    expect(done.type).toBe('completed');

    // 无时间限制：完成后立即可再次触发被动闲聊
    expect(game.triggerPassiveStory()).toMatchObject({ success: true });
  });

  test('should grant passive completion rewards: first 15, repeat 5 pyroxene', () => {
    game.init([baseDatapack]);
    finishWelcome(game);
    const api = game as unknown as { startStory(id: string, t: 'passive'): { success: boolean } };

    // 首次完成被动闲聊 → +15 青辉石（Global）
    expect(api.startStory('base:story:schale_tea', 'passive').success).toBe(true);
    let r = game.advanceStory();
    while (r.success && 'finished' in r && !r.finished) r = game.advanceStory();
    expect(r.success && 'finished' in r && r.finished).toBe(true);
    expect(game.getView().resources[Resource.Pyroxene]).toBe(15);
    expect(game.state.globalResources?.[Resource.Pyroxene]).toBe(15);

    // 清除冷却后重复完成同一闲聊 → 只 +5
    game.state.storyCooldowns!['base:story:schale_tea'] = 0;
    expect(api.startStory('base:story:schale_tea', 'passive').success).toBe(true);
    r = game.advanceStory();
    while (r.success && 'finished' in r && !r.finished) r = game.advanceStory();
    expect(game.getView().resources[Resource.Pyroxene]).toBe(20);
    expect(game.state.globalResources?.[Resource.Pyroxene]).toBe(20);
  });

  test('should keep global resources across init switches', () => {
    game.init([baseDatapack]);
    finishWelcome(game);
    // 通过闲聊获得青辉石（Global）
    const api = game as unknown as { startStory(id: string, t: 'passive'): { success: boolean } };
    expect(api.startStory('base:story:schale_tea', 'passive').success).toBe(true);
    let r = game.advanceStory();
    while (r.success && 'finished' in r && !r.finished) r = game.advanceStory();
    expect(game.getView().resources[Resource.Pyroxene]).toBe(15);

    // 保存式重启（快照 + 恢复）：青辉石跨世界线保留
    game.unlockInit('base:init:millennium');
    game.restartInit();
    game.resumeInit('base:init:millennium');
    expect(game.getView().resources[Resource.Pyroxene]).toBe(15);

    // 不保存式重启（删快照）：同样保留
    game.hardRestartInit();
    game.resumeInit('base:init:millennium');
    expect(game.getView().resources[Resource.Pyroxene]).toBe(15);
    expect(game.state.globalResources?.[Resource.Pyroxene]).toBe(15);
  });

  test('should consume global pyroxene when purchasing an init', () => {
    game.init([baseDatapack]);
    finishWelcome(game);
    game.mutations.changeResource(Resource.Pyroxene, 30);
    expect(game.state.globalResources?.[Resource.Pyroxene]).toBe(30);

    // 千禧年购买成本 20 青辉石（Global 货币）
    const r = game.purchaseInit('base:init:millennium');
    expect(r.success).toBe(true);
    expect(game.state.unlockedInits).toContain('base:init:millennium');
    expect(game.state.globalResources?.[Resource.Pyroxene]).toBe(10);
    expect(game.getView().resources[Resource.Pyroxene]).toBe(10);
  });

  test('should settle every owned spot on the same tick', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 0;
    game.tick();

    // 开局仅赠送 schale_main 的 credit_printer（其余 spot 需购买/进入 Area/完成剧情获得）
    // 含 Spot 功能：level 1 时无条件 linearYield 功能每级 +amountPerLevel
    const expected = [...game.registry.spotsOfInit('base:init:schale_office')]
      .filter(spotId => (game.state.spotLevels[spotId] ?? 0) > 0)
      .reduce((sum, spotId) => {
        const spot = game.registry.spots.get(spotId)!;
        let total = game.valueSystem.evaluate(spot.baseYield, game.state);
        for (const fn of spot.functionalities ?? []) {
          if (fn.condition) continue; // 条件功能：测试初始条件不满足
          if (fn.kind === 'linearYield') total += 1 * (fn.amountPerLevel ?? 0);
        }
        return sum + total;
      }, 0);
    expect(game.state.resources['base:resource:credit']).toBe(expected);
  });

  test('should not rely on per-spot timer state when loading a save', () => {
    game.init([baseDatapack]);
    for (const spotId of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[spotId];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources['base:resource:credit'] = 0;
    const saveData = { ...game.save(), timers: { obsolete: { elapsed: 99 } } };

    const game2 = new GameInstance();
    game2.init([baseDatapack]);
    game2.load(saveData);
    game2.tick();
    // 5 base + 2 功能
    expect(game2.state.resources['base:resource:credit']).toBe(7);
  });

  test('should save and load state', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 500;
    game.state.spotLevels['base:spot:credit_printer'] = 3;

    const saveData = game.save();
    expect(saveData.version).toBe('1.0.0');
    expect(saveData.playerState.resources['base:resource:credit']).toBe(500);

    // 加载到新实例
    const game2 = new GameInstance();
    game2.init([baseDatapack]);
    game2.load(saveData);
    expect(game2.state.resources['base:resource:credit']).toBe(500);
    expect(game2.state.spotLevels['base:spot:credit_printer']).toBe(3);
  });

  test('should reset state', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 1000;
    game.reset();
    expect(game.state.resources['base:resource:credit']).toBeUndefined();
    expect(game.visibility.spots['base:spot:credit_printer']).toBeUndefined();
  });

  test('should unlock default spot via unlockSpot API', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 100;

    // init 后 credit_printer 已由默认区域授予 level=1，先清除再手动解锁
    delete game.state.spotLevels['base:spot:credit_printer'];
    const result = game.unlockSpot('base:spot:credit_printer');
    expect(result.success).toBe(true);
    expect(game.state.spotLevels['base:spot:credit_printer']).toBe(1);
  });

  test('should compute visibility after init', () => {
    game.init([baseDatapack]);
    const vis = game.visibility;
    // schale_office 没有 existence 门槛（revealTriggers）→ 可见
    expect(vis.inits['base:init:schale_office']).toBe(true);
    expect(vis.areas['base:area:schale_main']).toBe(true);
    // spot_credit_printer 没有 existence 门槛（revealTriggers）→ 可见
    expect(vis.spots['base:spot:credit_printer']).toBe(true);
  });

  test('should expose a detached UI view snapshot', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 20;

    const view = game.getView();
    view.resources['base:resource:credit'] = 999;
    view.spotLevels['base:spot:credit_printer'] = 99;

    expect(game.state.resources['base:resource:credit']).toBe(20);
    expect(game.state.spotLevels['base:spot:credit_printer']).not.toBe(99);
  });

  test('should give and use a consumable item', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 0;

    expect(game.giveItem('base:item:energy_drink', 99)).toBe(true);
    expect(game.state.inventory['base:item:energy_drink']).toBe(5);

    const result = game.useItem('base:item:energy_drink');
    expect(result).toEqual({ success: true, itemId: 'base:item:energy_drink' });
    expect(game.state.inventory['base:item:energy_drink']).toBe(4);
    expect(game.state.resources['base:resource:credit']).toBe(25);
  });

  test('should roll a registered drop table into inventory', () => {
    game.init([baseDatapack]);

    const result = game.rollDropTable('base:drop:basic_field_reward');

    expect(result.get('base:item:field_note')).toBe(1);
    expect(game.state.inventory['base:item:field_note']).toBe(1);
  });

  test('should mount item affectors when item is obtained', () => {
    game.init([baseDatapack]);

    game.giveItem('base:item:energy_drink', 1);

    // 消耗品的使用效果在 useEffects 中声明，不通过 Affector 挂载
    // 验证物品已正确入包
    expect(game.state.inventory['base:item:energy_drink']).toBe(1);
  });

  test('should mount enhancement affector packs when purchased', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 100;
    for (const spotId of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[spotId];

    // 购买带有 affectorPackIds 的 Enhancement
    const result = game.purchaseEnhancement('base:enh:energy_supply');
    expect(result.success).toBe(true);

    // Enhancement 的 Affector 被挂载
    expect(game.affectorEngine.getActiveInstances().some(i => i.mountEntityId === 'base:enh:energy_supply')).toBe(true);
  });

  test('should apply enhancement affector packs every tick', () => {
    game.init([baseDatapack]);
    for (const spotId of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[spotId];
    game.state.resources['base:resource:credit'] = 100;

    // 购买 能量饮料后勤（base:pack:energy_drink，每 tick +1 credit）
    game.purchaseEnhancement('base:enh:energy_supply');
    game.state.resources['base:resource:credit'] = 0;

    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(1);
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(2);
  });

  test('should expose multiple selectable inits from the base datapack', () => {
    game.init([baseDatapack]);
    const inits = [...game.registry.inits.values()].map(init => init.id);
    expect(inits).toEqual(expect.arrayContaining([
      'base:init:schale_office',
      'base:init:abydos',
      'base:init:millennium',
    ]));
    expect(game.registry.areasOfInit('base:init:abydos')).toContain('base:area:abydos_campus');
    expect(game.registry.areasOfInit('base:init:millennium')).toContain('base:area:millennium_lab');
  });

  test('should start a new game in a selected init with only that init settled', () => {
    game.init([baseDatapack]);
    // 先进入默认 Init，给 schale 的 Spot 产生一些残留状态
    expect(game.state.activeInit).toBe('base:init:schale_office');
    expect(game.state.spotLevels['base:spot:credit_printer']).toBe(1);

    // 千禧年需要购买解锁，先通过 purchaseInit 解锁（购买货币为青辉石 = Global 资源）
    game.mutations.changeResource('base:resource:pyroxene', 20);
    expect(game.purchaseInit('base:init:millennium').success).toBe(true);

    // 开启千禧年新游戏：应重置旧状态，仅初始化所选世界线的 Spot
    expect(game.startNewGame('base:init:millennium')).toBe(true);
    expect(game.state.activeInit).toBe('base:init:millennium');
    expect(game.state.unlockedInits).toContain('base:init:millennium');
    expect(game.state.spotLevels['base:spot:credit_printer']).toBeUndefined();
    expect(game.state.spotLevels['base:spot:millennium_lab']).toBe(1);
    // millennium_game 为购买获得，开局未赠送
    expect(game.state.spotLevels['base:spot:millennium_game']).toBeUndefined();
  });

  test('should reject starting a new game with an unknown init', () => {
    game.init([baseDatapack]);
    expect(game.startNewGame('unknown_init')).toBe(false);
  });

  test('should keep spot state isolated between different inits', () => {
    game.init([baseDatapack]);
    // 进入夏莱，先让主厅 Spot 有等级
    expect(game.state.activeInit).toBe('base:init:schale_office');
    game.state.spotLevels['base:spot:credit_printer'] = 3;

    // 进入千禧年：夏莱的 Spot 持有与 Manager 应被清理
    game.unlockInit('base:init:millennium');
    game.enterInit('base:init:millennium');
    expect(game.state.activeInit).toBe('base:init:millennium');
    expect(game.state.spotLevels['base:spot:credit_printer']).toBeUndefined();
    expect(game.state.spotLevels['base:spot:millennium_lab']).toBe(1);

    // 进入阿比多斯：千禧年 Spot 清理，只保留阿比多斯
    game.unlockInit('base:init:abydos');
    game.enterInit('base:init:abydos');
    expect(game.state.spotLevels['base:spot:millennium_lab']).toBeUndefined();
    expect(game.state.spotLevels['base:spot:abydos_rehab']).toBe(1);
    // pool_train 在 abydos_pool 区域，非默认区域，需要 travelToArea 后才会授予
    expect(game.state.spotLevels['base:spot:pool_train']).toBeUndefined();
  });

  test('should not share spot ids across inits', () => {
    game.init([baseDatapack]);
    const schaleSpots = new Set(game.registry.spotsOfInit('base:init:schale_office'));
    const abydosSpots = new Set(game.registry.spotsOfInit('base:init:abydos'));
    const millSpots = new Set(game.registry.spotsOfInit('base:init:millennium'));
    for (const id of schaleSpots) {
      expect(abydosSpots.has(id)).toBe(false);
      expect(millSpots.has(id)).toBe(false);
    }
  });

  test('should travel to an adjacent area within the current init', () => {
    game.init([baseDatapack]);
    finishWelcome(game); // 结束 active 欢迎剧情，解除移动锁定
    expect(game.state.currentAreaId).toBe('base:area:schale_main');

    // 夏莱主厅 → 资料室（相邻）
    const result = game.travelToArea('base:area:schale_library');
    expect(result).toEqual({ success: true, areaId: 'base:area:schale_library', fromAreaId: 'base:area:schale_main' });
    expect(game.state.currentAreaId).toBe('base:area:schale_library');
    expect(game.getView().currentAreaId).toBe('base:area:schale_library');

    // 资料室 → 机库（相邻）
    expect(game.travelToArea('base:area:schale_hangar').success).toBe(true);
    expect(game.state.currentAreaId).toBe('base:area:schale_hangar');
  });

  test('should reject non-adjacent or cross-init travel', () => {
    game.init([baseDatapack]);
    finishWelcome(game); // 解除移动锁定
    expect(game.state.currentAreaId).toBe('base:area:schale_main');

    // 主厅 → 机库：不相邻（必须经过资料室）
    expect(game.travelToArea('base:area:schale_hangar')).toMatchObject({ success: false, error: 'NotAdjacent' });

    // 主厅 → 阿比多斯：跨世界线
    expect(game.travelToArea('base:area:abydos_campus')).toMatchObject({ success: false, error: 'NotInThisInit' });

    // 未知 Area
    expect(game.travelToArea('unknown_area')).toMatchObject({ success: false, error: 'NotFound' });

    // 原地停留
    expect(game.travelToArea('base:area:schale_main')).toMatchObject({ success: false, error: 'AlreadyThere' });
  });

  test('should persist current area when saving and loading', () => {
    game.init([baseDatapack]);
    finishWelcome(game);
    game.travelToArea('base:area:schale_library');
    expect(game.state.currentAreaId).toBe('base:area:schale_library');

    const saveData = game.save();
    const game2 = new GameInstance();
    game2.init([baseDatapack]);
    game2.load(saveData);
    expect(game2.state.currentAreaId).toBe('base:area:schale_library');
  });

  test('should require adjacency even for a previously visited area', () => {
    game.init([baseDatapack]);
    finishWelcome(game);
    // 主厅 → 资料室 → 机库
    game.travelToArea('base:area:schale_library');
    game.travelToArea('base:area:schale_hangar');
    expect(game.state.currentAreaId).toBe('base:area:schale_hangar');

    // 机库 → 主厅：不相邻（机库仅邻资料室），即使此前访问过也拒绝
    expect(game.travelToArea('base:area:schale_main')).toMatchObject({ success: false, error: 'NotAdjacent' });
    expect(game.state.currentAreaId).toBe('base:area:schale_hangar');
  });

  test('should reject travel to a locked area', () => {
    game.init([baseDatapack]);
    finishWelcome(game);
    // 给资料室临时加一个永假 existence 门槛，模拟锁定区域（结束需还原，避免污染共享数据）
    const area = game.registry.areas.get('base:area:schale_library');
    const original = (area as { revealTriggers?: unknown } | undefined)?.revealTriggers;
    (area as { revealTriggers?: unknown }).revealTriggers = [
      { reveal: 'existence', condition: {
        type: 'AND',
        conditions: [{ target: 'resource', key: 'base:resource:credit', comparator: '>=', value: 99999 }],
      } },
    ];

    // 资料室是主厅的相邻区域，但被锁定 → 拒绝移动
    expect(game.travelToArea('base:area:schale_library')).toMatchObject({ success: false, error: 'Locked' });
    expect(game.state.currentAreaId).toBe('base:area:schale_main');

    (area as { revealTriggers?: unknown }).revealTriggers = original;
  });

  test('should purchase an enhancement and apply production multiplier', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 200;

    // 条件：credit >= 100 且可见 → 可购买
    const result = game.purchaseEnhancement('base:enh:credit_system');
    expect(result).toEqual({ success: true, enhancementId: 'base:enh:credit_system' });
    expect(game.state.unlockedEnhancements).toContain('base:enh:credit_system');
    // 扣费 100 credit
    expect(game.state.resources['base:resource:credit']).toBe(100);

    // Tick 产出应被 ×1.5：主厅信用点制造机 5 × 1.5 + 功能 2 = 9.5
    game.state.resources['base:resource:credit'] = 0;
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(9.5);
  });

  test('should reject enhancement purchase when resource is insufficient', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 50; // 需要 100

    const result = game.purchaseEnhancement('base:enh:credit_system');
    expect(result).toMatchObject({ success: false, error: 'InsufficientResource' });
    expect(game.state.unlockedEnhancements).not.toContain('base:enh:credit_system');
  });

  test('should reject duplicate enhancement purchase', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 500;
    expect(game.purchaseEnhancement('base:enh:credit_system').success).toBe(true);

    const second = game.purchaseEnhancement('base:enh:credit_system');
    expect(second).toMatchObject({ success: false, error: 'AlreadyOwned' });
  });

  test('should only apply tag-scoped enhancement to matching spots', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 500;
    // 满足办公区整合计划的解锁条件：信用点制造机等级 >= 2
    game.state.spotLevels['base:spot:credit_printer'] = 2;

    // 办公区整合计划：只作用于带 office tag 的 Spot（×1.25）
    expect(game.purchaseEnhancement('base:enh:office_layout').success).toBe(true);

    // 单独结算信用点制造机（tags: credit/office → 命中 office）
    game.state.resources['base:resource:credit'] = 0;
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1; // base 5 ×1.25 + 功能 2
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(5 * 1.25 + 2);

    // 单独结算战术指挥台（tags: tactical/intel/office → 命中 office）
    game.state.resources['base:resource:credit'] = 0;
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:tactical_desk'] = 1; // base 10
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(10 * 1.25);

    // 野外调查站（tags: field/combat → 无 office，不被办公强化影响）
    game.state.resources['base:resource:credit'] = 0;
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:field_work'] = 1; // base 8
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(8);
  });

  test('should apply tag-scoped enhancement to child tags via prefix matching', () => {
    game.init([baseDatapack]);
    game.state.resources['base:resource:credit'] = 500;
    // 满足办公区整合计划的解锁条件
    game.state.spotLevels['base:spot:credit_printer'] = 2;
    expect(game.purchaseEnhancement('base:enh:office_layout').success).toBe(true);

    // 把战术指挥台临时改标为 office/command（office 的 child），office_layout（office）应命中
    const spot = game.registry.spots.get('base:spot:tactical_desk')!;
    (spot as { tags: unknown }).tags = [tagPath('office', 'command')];

    game.state.resources['base:resource:credit'] = 0;
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:tactical_desk'] = 1; // base 10
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(10 * 1.25);
  });

  test('should advance story via single reply button click', () => {
    game.init([baseDatapack]);
    // 欢迎剧情已自动展开，处于 page0
    expect(game.getSendState()).toMatchObject({ mode: 'advance' });

    // 单次点击推进 page0 → page1
    const first = game.clickSend();
    expect(first.type).toBe('completed');
    expect(game.getSendState()).toMatchObject({ mode: 'advance' });

    // 再次单次点击 → page2（选项页）
    expect(game.clickSend().type).toBe('completed');
    expect(game.getSendState()).toMatchObject({ mode: 'choice' });
  });

  test('should not advance via reply button when current page has choices', () => {
    game.init([baseDatapack]);
    // 推进到选项页（page2）
    game.clickSend();
    game.clickSend();
    expect(game.getSendState()).toMatchObject({ mode: 'choice' });

    // 选项页点击回复按钮 → 返回 choice，不推进
    expect(game.clickSend()).toEqual({ type: 'choice' });
    expect(game.getSendState()).toMatchObject({ mode: 'choice' });
  });

  test('multi-click Talklet: clickWork requires N clicks before advancing', () => {
    game.init([baseDatapack]);
    // 完成自动展开的欢迎剧情，避免干扰
    while (game.getView().currentStory) {
      const r = game.advanceStory();
      if (r.success && 'finished' in r && r.finished) break;
      if (!r.success && r.error === 'ChoiceRequired') game.advanceStory(0);
    }
    expect(game.getView().currentStory).toBeNull();

    // 切到阿比多斯并启动 serika_side_1（第二页为 clickWork 页）
    game.enterInit('base:init:abydos');
    const started = game.startActiveStory('base:story:serika_side_1');
    expect(started.success).toBe(true);
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });

    // 首次 getSendState 会 roll 随机 total：base 4 + rand 0..1（rand: 2 → 0/1）
    const send = game.getSendState();
    if (send.mode !== 'advance') throw new Error('expected advance');
    const total = send.clickWork!.total;
    expect(total).toBeGreaterThanOrEqual(4);
    expect(total).toBeLessThanOrEqual(5);
    expect(send.clickWork!.done).toBe(0);
    // 多次调用不重新 roll
    const again = game.getSendState();
    if (again.mode !== 'advance') throw new Error('expected advance');
    expect(again.clickWork!.total).toBe(total);

    // 前 total-1 次点击：返回 working、不推进，进度逐次累加
    for (let i = 1; i < total; i++) {
      const r = game.clickSend();
      expect(r.type).toBe('working');
      if (r.type === 'working') {
        expect(r.clicksDone).toBe(i);
        expect(r.clicksTotal).toBe(total);
      }
      expect(game.getView().currentStory!.pageIndex).toBe(1);
      const st = game.getSendState();
      if (st.mode !== 'advance') throw new Error('expected advance');
      expect(st.clickWork).toEqual({ total, done: i });
    }

    // 最后一次点击：completed 且剧情结束（serika_side_1 共 2 页）
    const last = game.clickSend();
    expect(last.type).toBe('completed');
    expect(game.getSendState().mode).toBe('idle');
    expect(game.getView().currentStory).toBeNull();
  });

  test('multi-click Talklet: clickWork progress persists across save/load', () => {
    game.init([baseDatapack]);
    // 完成欢迎剧情
    while (game.getView().currentStory) {
      const r = game.advanceStory();
      if (r.success && 'finished' in r && r.finished) break;
      if (!r.success && r.error === 'ChoiceRequired') game.advanceStory(0);
    }
    // 启动 serika_side_1 并推进到 clickWork 页
    game.enterInit('base:init:abydos');
    expect(game.startActiveStory('base:story:serika_side_1').success).toBe(true);
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });

    // 点击两次（working），存档
    expect(game.clickSend().type).toBe('working');
    expect(game.clickSend().type).toBe('working');
    const snapshot = game.save();

    // 读档：进度应恢复（total/done 均不变，不重新 roll）
    game.load(snapshot);
    const st = game.getSendState();
    if (st.mode !== 'advance' || !st.clickWork) throw new Error('expected advance with clickWork');
    expect(st.clickWork.done).toBe(2);
    expect(st.clickWork.total).toBe(snapshot.pendingTalkletClicks!.total);
    expect(game.getView().currentStory!.pageIndex).toBe(1);
  });

  test('should idle-send trigger a passive talk when no story is active', () => {
    game.init([baseDatapack]);
    // 先完成自动展开的欢迎剧情（遇选项页选第 0 项）
    while (game.getView().currentStory) {
      const r = game.advanceStory();
      if (r.success && 'finished' in r && r.finished) break;
      if (!r.success && r.error === 'ChoiceRequired') {
        game.advanceStory(0);
      }
    }
    // 剧情空闲 → getSendState idle
    expect(game.getSendState()).toMatchObject({ mode: 'idle', reason: 'noStory' });

    const result = game.clickSend();
    // 应触发被动闲聊并开始演出（getSendState 转为 advance）
    if (result.type !== 'idle') throw new Error('expected idle');
    expect(result.started).toBe(true);
    expect(game.getSendState().mode).toBe('advance');
  });

  test('should auto-expand InitStory on enterInit', () => {
    game.init([baseDatapack]);
    // schale_office 有 startStoryId → init 后自动展开欢迎剧情
    expect(game.state.activeInit).toBe('base:init:schale_office');
    expect(game.getSendState().mode).toBe('advance');

    // 自动展开的是欢迎剧情（未手动启动）
    const started = game.startActiveStory('base:story:schale_welcome');
    expect(started).toMatchObject({ success: false, error: 'AlreadyActive' });
  });

  test('player travel is blocked while a non-passive story is performing', () => {
    game.init([baseDatapack]);
    // 欢迎剧情（active）自动展开，演出中
    expect(game.getView().currentStory?.type).toBe('active');
    expect(game.getView().currentAreaId).toBe('base:area:schale_main');

    // 玩家移动被拒绝（StoryBlocked）
    const result = game.travelToArea('base:area:schale_library');
    expect(result).toMatchObject({ success: false, error: 'StoryBlocked' });
    // 位置未变化
    expect(game.getView().currentAreaId).toBe('base:area:schale_main');
  });

  test('travel is allowed again once the story finishes', () => {
    game.init([baseDatapack]);
    // 推进完欢迎剧情
    while (game.getView().currentStory) {
      const r = game.advanceStory();
      if (r.success && 'finished' in r && r.finished) break;
      if (!r.success && r.error === 'ChoiceRequired') game.advanceStory(0);
    }
    expect(game.getView().currentStory).toBeNull();

    const result = game.travelToArea('base:area:schale_library');
    expect(result.success).toBe(true);
    expect(game.getView().currentAreaId).toBe('base:area:schale_library');
  });

  test('travel is allowed while a passive story is performing', () => {
    game.init([baseDatapack]);
    // 完成欢迎剧情
    while (game.getView().currentStory) {
      const r = game.advanceStory();
      if (r.success && 'finished' in r && r.finished) break;
      if (!r.success && r.error === 'ChoiceRequired') game.advanceStory(0);
    }
    // 触发被动闲聊演出
    game.clickSend();
    const passiveStory = game.getView().currentStory;
    if (passiveStory?.type !== 'passive') return; // 池内无可用 passive 时跳过
    expect(passiveStory.type).toBe('passive');

    const result = game.travelToArea('base:area:schale_library');
    expect(result.success).toBe(true);
  });

  test('story can require an area move via travelToArea effect during performance', () => {
    game.init([baseDatapack]);
    // 给欢迎剧情第 0 页注入 travelToArea effect，模拟"Story 自身要求移动"
    const story = game.registry.stories.get('base:story:schale_welcome')!;
    const originalEffects = story.pages[0].effects;
    (story.pages[0] as { effects?: unknown[] }).effects = [
      { op: 'travelToArea', target: 'base:area:schale_library', value: '1' },
    ];

    // 推进一页（page0 无选项，推进时执行 travelToArea effect）
    const result = game.advanceStory();
    expect(result.success).toBe(true);
    expect(game.getView().currentAreaId).toBe('base:area:schale_library');
    expect(game.getView().currentStory).not.toBeNull();

    (story.pages[0] as { effects?: unknown[] }).effects = originalEffects;
  });

  test('spots are acquired via purchase / area-grant / story-grant', () => {
    game.init([baseDatapack]);
    // 开局赠送：仅 credit_printer；field_work / tactical_desk / hangar_supply 未拥有
    expect(game.state.spotLevels['base:spot:credit_printer']).toBe(1);
    expect(game.state.spotLevels['base:spot:field_work']).toBeUndefined();
    expect(game.state.spotLevels['base:spot:tactical_desk']).toBeUndefined();
    expect(game.state.spotLevels['base:spot:hangar_supply']).toBeUndefined();

    // 购买 field_work（baseCost 20）
    game.state.resources['base:resource:credit'] = 100;
    expect(game.unlockSpot('base:spot:field_work').success).toBe(true);
    expect(game.state.spotLevels['base:spot:field_work']).toBe(1);
    expect(game.state.resources['base:resource:credit']).toBe(80);

    // 进入 schale_library → archive 赠送
    finishWelcome(game);
    game.travelToArea('base:area:schale_library');
    expect(game.state.spotLevels['base:spot:archive']).toBe(1);
    // 购买项 hangar_supply 不因进入赠送
    expect(game.state.spotLevels['base:spot:hangar_supply']).toBeUndefined();
  });

  test('completing the welcome story grants tactical_desk', () => {
    game.init([baseDatapack]);
    expect(game.state.spotLevels['base:spot:tactical_desk']).toBeUndefined();

    finishWelcome(game);
    expect(game.state.spotLevels['base:spot:tactical_desk']).toBe(1);
  });

  test('generic upgrade uses linear per-level yield and exponential floored cost', () => {
    game.init([baseDatapack]);

    // 产出随等级线性：Lv1 = 7，Lv3 = 5 + 线性(2×2) + 功能(3×2) = 15
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 3;
    game.state.resources['base:resource:credit'] = 0;
    game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(15);

    // 指数花费：Lv2 → Lv3 = floor(50 × 2^2) = 200；首次升到 Lv2+ 触发 schale_first_upgrade（+10）
    game.state.resources['base:resource:credit'] = 1000;
    game.state.spotLevels['base:spot:credit_printer'] = 2;
    expect(game.upgradeSpot('base:spot:credit_printer').success).toBe(true);
    expect(game.state.resources['base:resource:credit']).toBe(810);
    expect(game.state.spotLevels['base:spot:credit_printer']).toBe(3);
  });
});

describe('Extra 运行时（M3）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  /** 带三层 extras 的测试数据包：常量表（base/k、both/k）⊕ InitDef.extra（init/k、both/k）。 */
  const extrasDatapack: Datapack = {
    name: 'extras-test',
    version: '1.0.0',
    inits: [
      {
        id: 'init_a',
        name: 'Extra Init',
        description: '',
        defaultAreas: ['area_1'],
        // Def 级 extra 是 dict 树：键为单段（路径分隔符 '/' 仅用于 ExtraPath 与常量表扁平键）
        extra: extra.dict({
          init: extra.dict({ k: extra.int(10) }),
          both: extra.dict({ k: extra.int(2) }),
        }),
      },
    ],
    areas: [
      { id: 'area_1', initId: 'init_a', name: 'Extra Area', description: '', defaultSpots: [] },
    ],
    spots: [],
    enhancements: [],
    stories: [],
    items: [],
    funcletDefs: [],
    characters: [],
    characterBonuses: [],
    extras: {
      'base/k': extra.int(100),
      'both/k': extra.int(1),
    },
  };

  test('should read datapack constant extras via getExtra (registry fallback)', () => {
    game.init([baseDatapack]);
    // init() 不注入底座；数据包常量表层兜底可读
    expect(game.getExtra('meta/author')).toEqual(extra.str('AronaClicker Team'));
    expect(game.getExtra('meta/nope')).toBeUndefined();
  });

  test('should seed global extras on startNewGame (deep copy, isolated from registry)', () => {
    game.init([baseDatapack]);
    expect(game.state.extras).toEqual(extra.dict({}));
    game.startNewGame('base:init:schale_office');
    expect(game.state.extras).not.toEqual(extra.dict({}));
    expect(game.getExtra('meta/author')).toEqual(extra.str('AronaClicker Team'));
    // 独立性：写全局层不污染数据包常量层
    game.setExtra('meta/author', extra.str('overridden'));
    expect(game.getExtra('meta/author')).toEqual(extra.str('overridden'));
    expect(game.registry.getExtra('meta/author')).toEqual(extra.str('AronaClicker Team'));
  });

  test('should read three layers with priority global > per-init > registry', () => {
    game.init([extrasDatapack]);
    game.startNewGame('init_a');
    // per-Init 独有键
    expect(game.getExtra('init/k')).toEqual(extra.int(10));
    // 常量表独有键（底座已深拷贝进全局层）
    expect(game.getExtra('base/k')).toEqual(extra.int(100));
    // 三层同键：全局底座（常量拷贝）遮蔽 per-Init
    expect(game.getExtra('both/k')).toEqual(extra.int(1));
  });

  test('should write global layer via setExtra and per-init layer via setPerInitExtra', () => {
    game.init([extrasDatapack]);
    game.startNewGame('init_a');
    game.setExtra('both/k', extra.int(9));
    expect(game.getExtra('both/k')).toEqual(extra.int(9));
    // per-Init 层保持 InitDef.extra 原样
    expect(game.state.initExtras).toEqual(
      extra.dict({
        init: extra.dict({ k: extra.int(10) }),
        both: extra.dict({ k: extra.int(2) }),
      }),
    );
    game.setPerInitExtra('mut/k', extra.int(5));
    expect(game.getExtra('mut/k')).toEqual(extra.int(5));
  });

  test('should merge extras into global layer via mergeExtras', () => {
    game.init([extrasDatapack]);
    game.startNewGame('init_a');
    game.mergeExtras(extra.dict({ merged: extra.dict({ k: extra.int(7) }) }));
    expect(game.getExtra('merged/k')).toEqual(extra.int(7));
    expect(game.getExtra('init/k')).toEqual(extra.int(10));
  });

  test('should clear per-init extras on soft restart but keep global extras, and restore from snapshot', () => {
    game.init([extrasDatapack]);
    game.startNewGame('init_a');
    game.setPerInitExtra('mut/k', extra.int(5));

    game.restartInit();
    expect(game.state.activeInit).toBe('');
    // 全局层保留
    expect(game.getExtra('both/k')).toEqual(extra.int(1));
    // per-Init 已清：独有键退回常量层（不存在 → undefined）
    expect(game.getExtra('init/k')).toBeUndefined();
    expect(game.getExtra('mut/k')).toBeUndefined();

    // 断点续玩：从快照恢复 per-Init extras
    game.resumeInit('init_a');
    expect(game.getExtra('init/k')).toEqual(extra.int(10));
    expect(game.getExtra('mut/k')).toEqual(extra.int(5));
  });

  test('should rebuild per-init extras on hard restart (keep global extras)', () => {
    game.init([extrasDatapack]);
    game.startNewGame('init_a');
    game.setPerInitExtra('mut/k', extra.int(5));

    game.hardRestartInit();
    // per-Init 重建为 InitDef.extra（mut/k 丢弃）
    expect(game.getExtra('mut/k')).toBeUndefined();
    expect(game.getExtra('init/k')).toEqual(extra.int(10));
    // 全局层保留
    expect(game.getExtra('both/k')).toEqual(extra.int(1));
  });

  test('should tolerate old saves without extras fields', () => {
    game.init([baseDatapack]);
    game.startNewGame('base:init:schale_office');
    game.setPerInitExtra('run/k', extra.int(3));
    game.restartInit(); // 生成含 extras 的快照
    const data = game.save();
    delete data.playerState.extras;
    delete data.playerState.initExtras;
    delete data.playerState.initSnapshots!['base:init:schale_office'].extras;

    game.load(data);
    expect(game.state.extras).toEqual(extra.dict({}));
    expect(game.state.initExtras).toEqual(extra.dict({}));
    // 常量层兜底仍可读
    expect(game.getExtra('meta/author')).toEqual(extra.str('AronaClicker Team'));
    // 快照无 extras → 恢复后 per-Init 为空
    game.resumeInit('base:init:schale_office');
    expect(game.getExtra('run/k')).toBeUndefined();
  });
});

describe('Extra 引擎消费（M4）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  /** 端到端数据包：enterEffects 用 setExtra/addExtra/data 源初始化，剧情驱动 setExtra/addExtra/removeExtra 与 extra 条件。 */
  const engineDatapack: Datapack = {
    name: 'extra-engine-test',
    version: '1.0.0',
    inits: [
      {
        id: 'init_a',
        name: 'Extra Engine Init',
        description: '',
        defaultAreas: ['area_1'],
        startStoryId: 'story_a',
        // 进入世界线时初始化全局层运行时数据（per-Init 底座来自 InitDef.extra）
        enterEffects: [
          {
            effects: [
              { op: 'setExtra', target: 'meta/kills', value: 0 },
              { op: 'addExtra', target: 'meta/kills', value: 5 }, // 0 + 5
              { op: 'addExtra', target: 'init/count', value: 10 }, // per-Init 1 + 10（三层读取器生效）
              {
                op: 'addExtra',
                target: 'meta/constant_copy',
                value: Expr.val(value('data', { path: 'meta/constant' })),
              }, // data 源读常量表兜底 → 1000（批内解析，引用已就绪值）
            ],
          },
        ],
        extra: extra.dict({
          init: extra.dict({ mark: extra.str('perinit'), count: extra.int(1) }),
        }),
      },
    ],
    areas: [{ id: 'area_1', initId: 'init_a', name: 'Area', description: '', defaultSpots: [] }],
    spots: [],
    enhancements: [],
    stories: [
      {
        id: 'story_a',
        name: 'Extra Story',
        type: 'active',
        availableInits: ['init_a'],
        triggerCondition: and(cond('extra', 'meta/constant', '==', 1000)), // 恒真（常量表兜底）
        pages: [
          {
            text: 'page0',
            effects: [
              { op: 'addExtra', target: 'meta/kills', value: 2 }, // 5 + 2 = 7
              {
                op: 'addExtra',
                target: 'meta/power',
                value: Expr.val(value('data', { path: 'meta/kills' })),
              }, // data 源读全局层 kills=5（批内解析先于写入）→ power = 0 + 5
            ],
            choices: [
              {
                text: 'A',
                condition: and(cond('extra', 'meta/kills', '>=', 5)),
                effects: [{ op: 'addExtra', target: 'meta/kills', value: 3 }], // 7 + 3 = 10
              },
              {
                text: 'B',
                condition: and(cond('extra', 'meta/kills', '>=', 100)),
                effects: [{ op: 'addExtra', target: 'meta/kills', value: 99 }],
              },
            ],
          },
          {
            text: 'end',
            effects: [{ op: 'removeExtra', target: 'meta/power', value: 0 }],
          },
        ],
      },
    ],
    items: [],
    funcletDefs: [],
    characters: [],
    characterBonuses: [],
    extras: {
      meta: extra.dict({ constant: extra.int(1000) }),
    },
  };

  test('should run extra effects on enter, gate choices by extra condition, and remove on finish', () => {
    game.init([engineDatapack]);
    expect(game.startNewGame('init_a')).toBe(true);

    // enterEffects：setExtra + addExtra（含以 per-Init 层为基数）+ value data 源读常量表
    expect(game.getExtra('meta/kills')).toEqual(extra.int(5));
    expect(game.getExtra('init/count')).toEqual(extra.int(11));
    expect(game.getExtra('meta/constant_copy')).toEqual(extra.int(1000));

    // 页面0含选项 → 必须显式选择
    expect(game.advanceStory()).toMatchObject({ success: false, error: 'ChoiceRequired' });
    // 不满足 extra 条件的选项被拒（kills=5 < 100）
    expect(game.advanceStory(1)).toMatchObject({ success: false, error: 'ChoiceConditionNotMet' });
    // 满足 extra 条件的选项推进：页面 effects（kills 5→7、power 0+5）+ 选项 effects（kills 7→10）
    expect(game.advanceStory(0)).toMatchObject({ success: true });
    expect(game.getExtra('meta/power')).toEqual(extra.int(5));

    // 末页：removeExtra meta/power 后剧情完结
    expect(game.advanceStory()).toMatchObject({ success: true, finished: true });

    expect(game.getExtra('meta/kills')).toEqual(extra.int(10));
    expect(game.getExtra('meta/power')).toBeUndefined();
    expect(game.getExtra('meta/constant')).toEqual(extra.int(1000));
    expect(game.getExtra('init/count')).toEqual(extra.int(11));
  });

  test('should keep extra ops scoped to global layer (per-init layer untouched)', () => {
    game.init([engineDatapack]);
    game.startNewGame('init_a');
    game.setExtra('only/global', extra.str('x'));

    expect(game.state.initExtras).toEqual(
      extra.dict({
        init: extra.dict({ mark: extra.str('perinit'), count: extra.int(1) }),
      }),
    );
    expect(game.state.extras).toEqual(
      extra.dict({
        meta: extra.dict({
          kills: extra.int(5),
          constant: extra.int(1000),
          constant_copy: extra.int(1000),
        }),
        init: extra.dict({ count: extra.int(11) }),
        only: extra.dict({ global: extra.str('x') }),
      }),
    );
  });

  test('should run first-entry and conditioned entries for init and area', () => {
    const entryDatapack: Datapack = {
      name: 'entry-gate-test',
      version: '1.0.0',
      inits: [
        {
          id: 'init_gate',
          name: 'Gate Init',
          description: '',
          defaultAreas: ['area_a'],
          // first：仅首次进入执行；condition：meta/gate_open 就绪才执行；无条件：每次进入都执行
          enterEffects: [
            { first: true, effects: [{ op: 'addExtra', target: 'meta/init_first_count', value: 1 }] },
            {
              condition: and(cond('extra', 'meta/gate_open', '==', 1)),
              effects: [{ op: 'addExtra', target: 'meta/init_conditioned', value: 1 }],
            },
            { effects: [{ op: 'addExtra', target: 'meta/init_entries', value: 1 }] },
          ],
        },
      ],
      areas: [
        { id: 'area_a', initId: 'init_gate', name: 'A', description: '', defaultSpots: [], adjacentAreaIds: ['area_b'] },
        {
          id: 'area_b',
          initId: 'init_gate',
          name: 'B',
          description: '',
          defaultSpots: [],
          adjacentAreaIds: ['area_a'],
          // first：仅首次进入该 Area 执行
          enterEffects: [
            { first: true, effects: [{ op: 'addExtra', target: 'meta/area_first_count', value: 1 }] },
            { effects: [{ op: 'addExtra', target: 'meta/area_entries', value: 1 }] },
          ],
        },
      ],
      spots: [],
      enhancements: [],
      stories: [],
      items: [],
      funcletDefs: [],
      characters: [],
      characterBonuses: [],
      extras: {
        meta: extra.dict({
          init_first_count: extra.int(0),
          init_conditioned: extra.int(0),
          init_entries: extra.int(0),
          area_first_count: extra.int(0),
          area_entries: extra.int(0),
        }),
      },
    };

    // init() 自动进入默认 Init（首次进入）：first + 无条件生效；condition 未满足（gate_open 未就绪）
    game.init([entryDatapack]);
    expect(game.getExtra('meta/init_first_count')).toEqual(extra.int(1));
    expect(game.getExtra('meta/init_conditioned')).toEqual(extra.int(0));
    expect(game.getExtra('meta/init_entries')).toEqual(extra.int(1));

    // 解锁条件后，同 Run 再次进入：first 跳过（已首次进入），condition 生效，无条件继续
    game.setExtra('meta/gate_open', extra.int(1));
    game.resumeInit('init_gate');
    expect(game.getExtra('meta/init_first_count')).toEqual(extra.int(1));
    expect(game.getExtra('meta/init_conditioned')).toEqual(extra.int(1));
    expect(game.getExtra('meta/init_entries')).toEqual(extra.int(2));

    // Area first：首次进入 area_b → first + 无条件
    expect(game.travelToArea('area_b')).toMatchObject({ success: true });
    expect(game.getExtra('meta/area_first_count')).toEqual(extra.int(1));
    expect(game.getExtra('meta/area_entries')).toEqual(extra.int(1));

    // 往返后再次进入 area_b：first 跳过，无条件继续
    expect(game.travelToArea('area_a')).toMatchObject({ success: true });
    expect(game.travelToArea('area_b')).toMatchObject({ success: true });
    expect(game.getExtra('meta/area_first_count')).toEqual(extra.int(1));
    expect(game.getExtra('meta/area_entries')).toEqual(extra.int(2));
  });
});
