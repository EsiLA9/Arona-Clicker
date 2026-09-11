// ============================================================
// engine/def-factory/character-drop-curve.test.ts
// CharacterData / DropTableDef / CultivateCurveDef Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import { dropTable, DropTableBuilder, character, CharacterBuilder, cultivateCurve, CultivateCurveBuilder } from '../../../src/arona-clicker/content/def-factory';
import type { CharacterData } from '../../../src/arona-clicker/types/character';
import type { DropTableDef } from '../../../src/data-services/contracts/drop-table';
import type { CultivateCurveDef } from '../../../src/arona-clicker/types/character';
import { Character, CharacterRarity, CharacterSchool } from '../../../src/arona-clicker/types/ids';

describe('CharacterBuilder', () => {
  test('character() 返回 CharacterBuilder 实例', () => {
    expect(character(Character.Arona)).toBeInstanceOf(CharacterBuilder);
  });

  test('build() 等价于字面量（阿罗娜参照）', () => {
    const def = character(Character.Arona)
      .name('阿罗娜').displayName('阿罗娜')
      .school(CharacterSchool.Schale).rarity(CharacterRarity.SuperRare)
      .desc('什亭之匣的系统管理员AI，有些冒失但很关心老师。')
      .build();
    expect(def).toEqual<CharacterData>({
      id: Character.Arona,
      name: '阿罗娜',
      displayName: '阿罗娜',
      school: CharacterSchool.Schale,
      rarity: CharacterRarity.SuperRare,
      description: '什亭之匣的系统管理员AI，有些冒失但很关心老师。',
    });
  });

  test('缺必填字段时 build() 抛错', () => {
    expect(() => character(Character.Arona).build()).toThrow(/name/);
    expect(() => character(Character.Arona).name('x').displayName('x').build()).toThrow(/school/);
    expect(() => character(Character.Arona).name('x').displayName('x').school(CharacterSchool.Schale).build()).toThrow(/rarity/);
  });
});

describe('DropTableBuilder', () => {
  test('dropTable() 返回 DropTableBuilder 实例', () => {
    expect(dropTable('base:droptable:x')).toBeInstanceOf(DropTableBuilder);
  });

  test('build() 等价于字面量（basic_field_reward 参照）', () => {
    const def = dropTable('base:droptable:basic_field_reward')
      .maxRolls(1)
      .guaranteed('base:item:field_note', 1)
      .entry('base:item:energy_drink', 1, 1, 1)
      .build();
    expect(def).toEqual<DropTableDef>({
      id: 'base:droptable:basic_field_reward',
      maxRolls: 1,
      guaranteed: [{ itemId: 'base:item:field_note', count: 1 }],
      entries: [{ itemId: 'base:item:energy_drink', min: 1, max: 1, weight: 1 }],
    });
  });

  test('多条目追加与未调用字段省略', () => {
    const def = dropTable('base:droptable:t').maxRolls(2)
      .entry('a', 1, 2, 3)
      .entry('b', 2, 3, 4)
      .build();
    expect(def.entries).toHaveLength(2);
    expect(def).not.toHaveProperty('guaranteed');
  });
});

describe('CultivateCurveBuilder', () => {
  test('cultivateCurve() 返回 CultivateCurveBuilder 实例', () => {
    expect(cultivateCurve('base:cultivatecurve:standard')).toBeInstanceOf(CultivateCurveBuilder);
  });

  test('build() 等价于字面量（standard 参照）', () => {
    const def = cultivateCurve('base:cultivatecurve:standard')
      .maxLevel(30)
      .expTable(...Array.from({ length: 34 }, (_, i) => 100 * (i + 1)))
      .starMax(5)
      .starCost(1, 3, 10, 30, 60)
      .build();
    expect(def).toEqual<CultivateCurveDef>({
      id: 'base:cultivatecurve:standard',
      maxLevel: 30,
      expTable: Array.from({ length: 34 }, (_, i) => 100 * (i + 1)),
      starMax: 5,
      starCost: [1, 3, 10, 30, 60],
    });
  });

  test('最小曲线（仅 maxLevel）', () => {
    const def = cultivateCurve('test:cultivatecurve:c').maxLevel(10).build();
    expect(def).toEqual<CultivateCurveDef>({ id: 'test:cultivatecurve:c', maxLevel: 10 });
  });
});
