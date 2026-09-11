// ============================================================
// engine/gear-system.test.ts — 装备（Gear）三槽、经验成长与 tier 升级
// （装配消耗 / 经验进位 / 满级升阶 / tier 效果整体替换 / 只读视图 / 跨线记忆）
// ============================================================
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { GearDef } from '../../src/arona-clicker/types/character';
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { baseGears } from '../../src/arona-clicker/content/gears';

const BP1 = 'test:item:bp-t1';
const BP2 = 'test:item:bp-t2';
const BP3 = 'test:item:bp-t3';
const EXP = 'test:item:gear-exp';

const credit = (value: number) => ({ op: 'addResource' as const, target: 'credit', value });

function gearOf(id: string, slot: 'attack' | 'defense' | 'special'): GearDef {
  return {
    id,
    name: `${slot}装备`,
    slot,
    tiers: [
      { tier: 1, levelCap: 3, expPerLevel: 100, upgradeCost: [{ itemId: BP1, amount: 1 }], baseEffects: [credit(100)], perLevelEffects: [credit(10)] },
      { tier: 2, levelCap: 6, expPerLevel: 200, upgradeCost: [{ itemId: BP2, amount: 2 }], baseEffects: [credit(300)], perLevelEffects: [credit(20)] },
      { tier: 3, levelCap: 9, expPerLevel: 300, upgradeCost: [{ itemId: BP3, amount: 3 }], baseEffects: [credit(600)], perLevelEffects: [credit(30)] },
    ],
  };
}

function makeDatapack(): Datapack {
  return {
    name: 'test',
    version: '0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: [
      { id: BP1, name: 'T1 图纸', description: '', maxStack: 999, rarity: 'common', type: 'material' },
      { id: BP2, name: 'T2 图纸', description: '', maxStack: 999, rarity: 'rare', type: 'material' },
      { id: BP3, name: 'T3 图纸', description: '', maxStack: 999, rarity: 'epic', type: 'material' },
      { id: EXP, name: '装备经验石', description: '', maxStack: 999, rarity: 'common', type: 'material' },
    ],
    funcletDefs: [],
    characters: [],
    characterVariants: [{
      id: 'Hoshino',
      proto: Character.Hoshino,
      name: 'Hoshino',
      displayName: '星野',
      school: CharacterSchool.Abydos,
      rarity: CharacterRarity.Rare,
      description: '',
      progression: {
        gearSlots: [
          { slot: 'attack', gear: 'test:gear:attack' },
          { slot: 'defense', gear: 'test:gear:defense' },
          { slot: 'special', gear: 'test:gear:special' },
        ],
      },
    }],
    gears: [gearOf('test:gear:attack', 'attack'), gearOf('test:gear:defense', 'defense'), gearOf('test:gear:special', 'special')],
    gearConfig: { expItems: [{ itemId: EXP, exp: 100 }] },
  };
}

describe('装备（Gear）系统', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;
  const gearAt = (slot: number) => state().roster['Hoshino'].gear?.[slot];

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
  });

  test('G-01 三槽声明：攻击 / 防御 / 特殊各自绑定唯一类型线', () => {
    expect(game.gearSystem.slotsOf('Hoshino')).toEqual([
      { slotIndex: 0, kind: 'attack', gear: 'test:gear:attack' },
      { slotIndex: 1, kind: 'defense', gear: 'test:gear:defense' },
      { slotIndex: 2, kind: 'special', gear: 'test:gear:special' },
    ]);
  });

  test('G-02 装配：消耗 T1 图纸×1，写入 tier1/level1/exp0', () => {
    game.mutations.addItem(BP1, 1);
    expect(game.mutations.equipGear('Hoshino', 0).ok).toBe(true);
    expect(gearAt(0)).toEqual({ tier: 1, level: 1, exp: 0 });
    expect(state().inventory[BP1]).toBeUndefined();
  });

  test('G-03 装配拒绝：材料不足 → 不扣款；已装配 → 拒绝', () => {
    expect(game.mutations.equipGear('Hoshino', 0).reason).toBe('insufficient-material');
    expect(gearAt(0)).toBeUndefined();
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    expect(game.mutations.equipGear('Hoshino', 0).reason).toBe('already-equipped');
  });

  test('G-04 升级经验：溢出自动进位，等级受 tier 上限约束', () => {
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    game.mutations.addItem(EXP, 3);
    expect(game.mutations.feedGearExp('Hoshino', 0, EXP, 3).ok).toBe(true);
    // 300 exp / 每级 100 → 连升两级至 Lv3（T1 上限），到顶后 exp 归零
    expect(gearAt(0)).toEqual({ tier: 1, level: 3, exp: 0 });
    expect(state().inventory[EXP]).toBeUndefined();
  });

  test('G-05 升级经验拒绝：非法材料 / 未装配 / 满级', () => {
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    // 非法经验材料（未满级时判定）
    expect(game.mutations.feedGearExp('Hoshino', 0, 'test:item:nope', 1).reason).toBe('invalid-material');
    // 未装配的槽
    expect(game.mutations.feedGearExp('Hoshino', 1, EXP, 1).reason).toBe('not-equipped');
    game.mutations.addItem(EXP, 3);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 3);
    game.mutations.addItem(EXP, 1);
    expect(game.mutations.feedGearExp('Hoshino', 0, EXP, 1).reason).toBe('max-level');
  });

  test('G-06 升 tier：未满级拒绝；满级且图纸足够则 tier+1，等级/经验保留', () => {
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    expect(game.mutations.upgradeGearTier('Hoshino', 0).reason).toBe('not-max-level');
    game.mutations.addItem(EXP, 3);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 3);
    // 图纸不足（需 2 个）
    game.mutations.addItem(BP2, 1);
    expect(game.mutations.upgradeGearTier('Hoshino', 0).reason).toBe('insufficient-material');
    game.mutations.addItem(BP2, 1);
    expect(game.mutations.upgradeGearTier('Hoshino', 0).ok).toBe(true);
    expect(gearAt(0)).toEqual({ tier: 2, level: 3, exp: 0 });
    expect(state().inventory[BP2]).toBeUndefined();
  });

  test('G-07 达最高阶：再升阶返回 max-tier', () => {
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    for (const [bp, expCount] of [[BP2, 3], [BP3, 9]] as const) {
      game.mutations.addItem(EXP, expCount);
      game.mutations.feedGearExp('Hoshino', 0, EXP, expCount);
      game.mutations.addItem(bp, 3);
      expect(game.mutations.upgradeGearTier('Hoshino', 0).ok).toBe(true);
    }
    expect(gearAt(0).tier).toBe(3);
    // T3 上限 9：补满经验后再升阶 → 无更高 tier
    game.mutations.addItem(EXP, 9);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 9);
    expect(gearAt(0).level).toBe(9);
    game.mutations.addItem(BP3, 3);
    expect(game.mutations.upgradeGearTier('Hoshino', 0).reason).toBe('max-tier');
  });

  test('G-08 tier 效果整体替换：升阶后只剩新 tier 效果，按级差线性成长', () => {
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    // T1 Lv1：级差 0 → 只吃 T1 基础效果
    expect(game.gearSystem.effectsOf(state(), 'Hoshino')).toEqual([credit(100)]);
    game.mutations.addItem(EXP, 3);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 3);
    // T1 Lv3：级差 2 → 基础 100 + 每级 10×2 = 20
    expect(game.gearSystem.effectsOf(state(), 'Hoshino')).toEqual([credit(100), credit(20)]);
    game.mutations.addItem(BP2, 2);
    game.mutations.upgradeGearTier('Hoshino', 0);
    // T2 Lv3：T2 基准等级 = T1 上限 3 → 级差 0 → 只吃 T2 基础效果（旧 tier 不再计入）
    expect(game.gearSystem.effectsOf(state(), 'Hoshino')).toEqual([credit(300)]);
    game.mutations.addItem(EXP, 2);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 2);
    // T2 Lv4：级差 1 → 基础 300 + 每级 20×1
    expect(game.gearSystem.effectsOf(state(), 'Hoshino')).toEqual([credit(300), credit(20)]);
  });

  test('G-09 只读视图：空槽 / 已装配 / 满级三态', () => {
    let views = game.gearSystem.viewOf(state(), 'Hoshino');
    expect(views[0]).toMatchObject({ equipped: false, canEquip: false, reason: 'insufficient-material', tier: 0 });
    expect(views[0].equipCost).toEqual([{ itemId: BP1, itemName: 'T1 图纸', amount: 1, owned: 0 }]);
    game.mutations.addItem(BP1, 1);
    views = game.gearSystem.viewOf(state(), 'Hoshino');
    expect(views[0].canEquip).toBe(true);
    game.mutations.equipGear('Hoshino', 0);
    game.mutations.addItem(EXP, 3);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 3);
    views = game.gearSystem.viewOf(state(), 'Hoshino');
    expect(views[0]).toMatchObject({ equipped: true, tier: 1, level: 3, levelCap: 3, canLevelUp: false, canUpgradeTier: false, reason: 'insufficient-material' });
    expect(views[0].upgradeCost).toEqual([{ itemId: BP2, itemName: 'T2 图纸', amount: 2, owned: 0 }]);
    game.mutations.addItem(BP2, 2);
    views = game.gearSystem.viewOf(state(), 'Hoshino');
    expect(views[0].canUpgradeTier).toBe(true);
  });

  test('G-10 跨线记忆：maxGearTier 单调递增', () => {
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    game.mutations.addItem(BP2, 2);
    game.mutations.addItem(EXP, 3);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 3);
    game.mutations.upgradeGearTier('Hoshino', 0);
    const memory = state().characterMemory[Character.Hoshino].variants['Hoshino'];
    expect(memory.maxGearTier).toEqual([2, 0, 0]);
  });

  test('G-11 下发 characterProgressChanged(domain:gear) 伞事件', () => {
    const events: any[] = [];
    game.eventBus.on('characterProgressChanged', e => events.push(e));
    game.mutations.addItem(BP1, 1);
    game.mutations.equipGear('Hoshino', 0);
    game.mutations.addItem(EXP, 1);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 1);
    game.mutations.addItem(BP2, 2);
    game.mutations.addItem(EXP, 3);
    game.mutations.feedGearExp('Hoshino', 0, EXP, 3);
    game.mutations.upgradeGearTier('Hoshino', 0);
    const sources = events.filter(e => e.domain === 'gear').map(e => e.source);
    expect(sources).toEqual(['equipGear', 'feedGearExp', 'feedGearExp', 'upgradeGearTier']);
  });
});

describe('装备（Gear）base 示例内容', () => {
  test('G-12 类型线 T1–T10 连续，装配 ×1 / 升阶 ×N，图纸物品齐备', () => {
    expect(defaultDatapack.gears).toBe(baseGears);
    expect(defaultDatapack.gearConfig?.expItems.length).toBe(2);
    const gear = baseGears[0];
    expect(gear.tiers.map(t => t.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(gear.tiers[0].upgradeCost?.[0].amount).toBe(1);
    expect(gear.tiers[1].upgradeCost?.[0].amount).toBe(2);
    for (const tier of gear.tiers) {
      const itemId = tier.upgradeCost?.[0].itemId;
      expect(defaultDatapack.items.some(i => i.id === itemId)).toBe(true);
    }
  });

  test('G-13 base 数据包可加载，差分三槽解析为攻击 / 防御 / 特殊', () => {
    const game = new GameInstance();
    game.init([defaultDatapack]);
    const variantId = [...(game as any).registry.characterVariants.keys()][0] as string;
    const slots = game.gearSystem.slotsOf(variantId);
    expect(slots.map(s => s.kind)).toEqual(['attack', 'defense', 'special']);
    for (const slot of slots) expect(game.gearSystem.getDef(slot.gear)).toBeDefined();
    // 未拥有该学生时不抛错，且能给出经验材料视图
    const view = game.gearSystem.viewOf((game as any)._state, variantId);
    expect(view).toHaveLength(3);
    expect(view[0].expMaterials.length).toBe(2);
  });
});
