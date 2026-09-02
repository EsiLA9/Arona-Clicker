import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/character-availability.test.ts — 可及性管理（A 组）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { } from '../../src/engine/types';
import { GachaMode } from '../../src/data-services/contracts/gacha-pool';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

const LIMITED = 'test:gachapool:pool-limited';
const PERM = 'test:gachapool:pool-perm';

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
    characterBonuses: [],
    characterVariants: [
      v('Limited1', Character.Mika),
      v('Perm1', Character.Shiroko),
      v('Nowhere', Character.Yuuka), // 不在任何池
    ],
    gachaPools: [
      {
        id: LIMITED,
        name: '限定池',
        mode: GachaMode.BaClassic,
        currency: 'base:resource:pyroxene',
        costPerPull: 120,
        rates: [{ rarity: CharacterRarity.Rare, weight: 1 }],
        members: ['Limited1'],
        closeWhen: { target: 'flag', key: 'event_over', comparator: '>=', value: 1 },
      },
      {
        id: PERM,
        name: '常驻池',
        mode: GachaMode.BaClassic,
        currency: 'base:resource:pyroxene',
        costPerPull: 120,
        rates: [{ rarity: CharacterRarity.Rare, weight: 1 }],
        members: ['Perm1'],
      },
    ],
  };
}

describe('availability（A-01 ~ A-05）', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
  });

  test('A-01 限定池独占：关闭前可抽、关闭后从任何池消失；直发授予不受限', () => {
    // 关闭前：Limited1 在限定池可抽集合中
    expect(game.availabilityService.availableVariantIds(state())).toContain('Limited1');
    // 关闭条件未满足时限定池仍开放
    const limited = game.registry.gachaPools.get(LIMITED)!;
    expect(game.availabilityService.isPoolClosed(limited, state())).toBe(false);

    // 满足关闭条件 → 刷新世界 Pool 后 Limited1 并入常驻
    game.mutations.setFlag('event_over', '1');
    game.availabilityService.refreshWorldPool();
    expect(game.availabilityService.worldPool(state())).toContain('Limited1');

    // story/event 直发不受可及性限制
    game.mutations.acquireCharacter('Nowhere', 'story');
    expect(game.rosterSystem.isOwned(state(), 'Nowhere')).toBe(true);
  });

  test('A-02 closeWhen 满足 → 成员并入世界 Pool（幂等）', () => {
    game.mutations.setFlag('event_over', '1');
    game.availabilityService.refreshWorldPool();
    game.availabilityService.refreshWorldPool(); // 二次刷新不重复
    expect(game.availabilityService.worldPool(state()).filter(id => id === 'Limited1')).toHaveLength(1);
  });

  test('A-03 世界 Pool 查询 + 常驻池可抽到常驻角色', () => {
    game.mutations.setFlag('event_over', '1');
    game.availabilityService.refreshWorldPool();
    const perm = game.registry.gachaPools.get(PERM)!;
    const drawable = game.availabilityService.drawableOf(perm, state());
    expect(drawable).toContain('Perm1');
    expect(drawable).toContain('Limited1'); // 已入常驻的限定角色出现在开放池
  });

  test('A-04 未入任何池的角色不可被任何渠道抽到', () => {
    expect(game.availabilityService.availableVariantIds(state())).not.toContain('Nowhere');
  });

  test('A-05 卡池引用未知差分 → 加载期报错', () => {
    const bad = makeDatapack();
    bad.gachaPools![0].members = ['GhostVariant'];
    expect(() => new GameInstance().init([bad])).toThrow(/引用了未定义的差分/);
  });

  test('已关闭限定池 roll 拒绝', () => {
    game.mutations.setFlag('event_over', '1');
    game.availabilityService.refreshWorldPool();
    (state() as any).globalResources = { 'base:resource:pyroxene': 10000 };
    expect(() => game.gachaService.roll(LIMITED, 1)).toThrow(/已关闭或无可抽成员/);
  });
});
