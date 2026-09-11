import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/color-equipment-system.test.ts — 色彩装备系统
// （收集/级联解锁色彩组/单装备槽/条件拒绝/效果聚合）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { } from '../../src/engine/types';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

function v(id: string, proto: Character) {
  return {
    id,
    proto,
    name: id,
    displayName: id,
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.Rare,
    description: '',
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
    items: [],
    funcletDefs: [],
    characters: [],
    
    characterVariants: [v('Hoshino', Character.Hoshino), v('Multi', Character.Mika)],
    colorGroups: [
      {
        id: 'test:colorgroup:group-solid',
        name: '单色组',
        compositionType: 'solid',
        slots: [{ role: 'primary', color: '#22c55e' }],
      },
      {
        id: 'test:colorgroup:group-duo',
        name: '双色组',
        compositionType: 'duotone',
        slots: [
          { role: 'primary', color: '#3b82f6' },
          { role: 'shadow', color: '#1e3a5f' },
        ],
      },
    ],
    colorEquipments: [
      {
        id: 'test:colorequipment:equip-free',
        name: '无条件装备',
        colorGroupId: 'test:colorgroup:group-solid',
        effects: [{ op: 'addResource', target: 'credit', value: 1 }],
      },
      {
        id: 'test:colorequipment:equip-flag',
        name: '旗标装备',
        colorGroupId: 'test:colorgroup:group-duo',
        effects: [{ op: 'addResource', target: 'credit', value: 2 }],
        unlock: { target: 'flag', key: 'equip_unlocked', comparator: '>=', value: 1 },
      },
      {
        id: 'test:colorequipment:equip-proto',
        name: '经历装备',
        colorGroupId: 'test:colorgroup:group-duo',
        effects: [],
        unlock: { target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 2 },
      },
    ],
  };
}

describe('色彩装备系统', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;
  const events: any[] = [];

  beforeEach(() => {
    events.length = 0;
    game = new GameInstance();
    game.eventBus.on('equipmentCollected', e => events.push(e));
    game.eventBus.on('equipmentEquipped', e => events.push(e));
    game.eventBus.on('groupUnlocked', e => events.push(e));
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
  });

  test('EQ-01 无条件装备 tryUnlock 直接收集并发事件', () => {
    expect(game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free')).toBe('unlocked');
    expect(game.colorEquipmentSystem.isOwned(state(), 'test:colorequipment:equip-free')).toBe(true);
    expect(state().equipmentsOwned).toEqual(['test:colorequipment:equip-free']);
    expect(events.filter(e => e.type === 'equipmentCollected' && e.equipmentId === 'test:colorequipment:equip-free')).toHaveLength(1);
  });

  test('EQ-02 收集即级联解锁其引用的色彩组', () => {
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free');
    expect(game.colorSystem.isGroupOwned(state(), 'test:colorgroup:group-solid')).toBe(true);
    // 双色组：满足装备解锁条件（flag）后收集，整体解锁该组
    game.mutations.setFlag('equip_unlocked', '1');
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-flag');
    expect(game.colorSystem.isGroupOwned(state(), 'test:colorgroup:group-duo')).toBe(true);
    // 级联经 mutations.unlockGroup 发 groupUnlocked
    expect(events.filter(e => e.type === 'groupUnlocked' && e.groupId === 'test:colorgroup:group-solid')).toHaveLength(1);
  });

  test('EQ-03 条件不满足拒绝；条件满足后（recheck/主动）入库存', () => {
    expect(game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-flag')).toBe(false);
    expect(game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-proto')).toBe(false);
    game.mutations.setFlag('equip_unlocked', '1');
    // flagChanged 触发 recheckUnlocks 自动收集（与 EQ-10 一致）；再 tryUnlock 即为幂等
    expect(game.colorEquipmentSystem.isOwned(state(), 'test:colorequipment:equip-flag')).toBe(true);
    expect(game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-flag')).toBe('already');
  });

  test('EQ-04 重复收集幂等：不重复入库存、不重复发事件', () => {
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free');
    const n = state().equipmentsOwned.length;
    expect(game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free')).toBe('already');
    expect(state().equipmentsOwned.length).toBe(n);
    expect(events.filter(e => e.type === 'equipmentCollected' && e.equipmentId === 'test:colorequipment:equip-free')).toHaveLength(1);
  });

  test('EQ-05 单装备槽：可换装；未拥有 / 同装备拒绝', () => {
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free');
    game.mutations.setFlag('equip_unlocked', '1');
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-flag');

    expect(game.mutations.equipEquipment('Hoshino', 'test:colorequipment:equip-free').ok).toBe(true);
    expect(state().roster['Hoshino'].colorEquipment).toBe('test:colorequipment:equip-free');
    // 同装备幂等拒绝
    expect(game.mutations.equipEquipment('Hoshino', 'test:colorequipment:equip-free').reason).toBe('already-equipped');
    // 未拥有拒绝
    expect(game.mutations.equipEquipment('Hoshino', 'test:colorequipment:equip-proto').reason).toBe('not-owned');
    // 换装：直接替换为另一件
    expect(game.mutations.equipEquipment('Hoshino', 'test:colorequipment:equip-flag').ok).toBe(true);
    expect(state().roster['Hoshino'].colorEquipment).toBe('test:colorequipment:equip-flag');
  });

  test('EQ-06 卸下后装备槽回 null', () => {
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free');
    game.mutations.equipEquipment('Hoshino', 'test:colorequipment:equip-free');
    expect(game.mutations.unequipEquipment('Hoshino')).toBe(true);
    expect(state().roster['Hoshino'].colorEquipment).toBeNull();
    expect(game.mutations.unequipEquipment('Hoshino')).toBe(false); // 已空
  });

  test('EQ-07 effectsOf 按 colorEquipment 聚合，卸下后消失', () => {
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free');
    expect(game.colorEquipmentSystem.effectsOf(state(), 'Hoshino')).toEqual([]);
    game.mutations.equipEquipment('Hoshino', 'test:colorequipment:equip-free');
    expect(game.colorEquipmentSystem.effectsOf(state(), 'Hoshino')).toEqual([{ op: 'addResource', target: 'credit', value: 1 }]);
    game.mutations.unequipEquipment('Hoshino');
    expect(game.colorEquipmentSystem.effectsOf(state(), 'Hoshino')).toEqual([]);
  });

  test('EQ-08 groupOf / avatarColors 解析', () => {
    const group = game.colorEquipmentSystem.groupOf('test:colorequipment:equip-free');
    expect(group?.compositionType).toBe('solid');
    expect(game.colorEquipmentSystem.avatarColors('test:colorequipment:equip-free')).toEqual(['#22c55e']);
    // 双色组按 slot 顺序返回内联 hex
    expect(game.colorEquipmentSystem.avatarColors('test:colorequipment:equip-flag')).toEqual(['#3b82f6', '#1e3a5f']);
    // 未定义装备 → undefined / 空数组
    expect(game.colorEquipmentSystem.groupOf('nope')).toBeUndefined();
    expect(game.colorEquipmentSystem.avatarColors('nope')).toEqual([]);
  });

  test('EQ-09 ownedEquipments / getDef / getAll', () => {
    game.colorEquipmentSystem.tryUnlock('test:colorequipment:equip-free');
    expect(game.colorEquipmentSystem.ownedEquipments(state()).map(e => e.id)).toEqual(['test:colorequipment:equip-free']);
    expect(game.colorEquipmentSystem.getDef('test:colorequipment:equip-free')?.name).toBe('无条件装备');
    expect(game.colorEquipmentSystem.getAll()).toHaveLength(3);
  });

  test('EQ-10 characterAcquired / flagChanged 自动 recheck 收集', () => {
    // acquire Hoshino ×2（beforeEach 已有 1 次）→ equip-proto 条件满足自动收集
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    expect(game.colorEquipmentSystem.isOwned(state(), 'test:colorequipment:equip-proto')).toBe(true);
    // flag 满足自动收集
    game.mutations.setFlag('equip_unlocked', '1');
    expect(game.colorEquipmentSystem.isOwned(state(), 'test:colorequipment:equip-flag')).toBe(true);
    // 无条件装备无 unlock → 不自动收集（约定：缺省 unlock = 不可自动解锁）
    expect(game.colorEquipmentSystem.isOwned(state(), 'test:colorequipment:equip-free')).toBe(false);
  });
});
