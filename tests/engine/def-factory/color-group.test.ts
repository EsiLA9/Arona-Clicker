// ============================================================
// engine/def-factory/color-group.test.ts — ColorGroup 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  colorGroup,
  cond,
  Character,
} from '../../../src/engine/types';
import type { ColorGroupDef } from '../../../src/engine/types';

describe('ColorGroupBuilder', () => {
  test('colorGroup() 返回 builder 实例', () => {
    expect(colorGroup('base:group:x')).toBeDefined();
  });

  test('build() 产出最小 ColorGroupDef（primary 快捷追加主色位）', () => {
    const def = colorGroup('base:group:x').name('测试').type('solid').primary('#3b82f6').build();
    expect(def).toEqual<ColorGroupDef>({
      id: 'base:group:x',
      name: '测试',
      compositionType: 'solid',
      slots: [{ role: 'primary', color: '#3b82f6' }],
    });
  });

  test('缺 name / slot 时 build() 抛错', () => {
    expect(() => colorGroup('base:group:x').build()).toThrow(/name/);
    expect(() => colorGroup('base:group:x').name('x').build()).toThrow(/色位/);
  });

  test('slot() 追加多色位（role + 内联 hex）', () => {
    const def = colorGroup('base:group:duo')
      .name('双色组')
      .type('gradient')
      .primary('#3ec6e0')
      .slot('secondary', '#38bdf8')
      .build();
    expect(def.slots).toEqual([
      { role: 'primary', color: '#3ec6e0' },
      { role: 'secondary', color: '#38bdf8' },
    ]);
  });

  test('unlockProtoStat / unlockFlag 糖构造解锁条件', () => {
    const protoDef = colorGroup('base:group:abydos-sand')
      .name('阿比多斯黄沙')
      .desc('被沙漠侵蚀的学园配色。拥有星野（任一差分）后解锁。')
      .primary('#eab308')
      .unlockProtoStat(Character.Hoshino)
      .build();
    expect(protoDef.unlock).toEqual(cond('protoStat', String(Character.Hoshino), '>=', 1));

    const flagDef = colorGroup('base:group:momotalk-pink')
      .name('Momotalk 粉')
      .desc('聊天软件的主题色。完成欢迎剧情（flag）后解锁。')
      .primary('#ec4899')
      .unlockFlag('momotalk_pink_unlocked')
      .build();
    expect(flagDef.unlock).toEqual(cond('flag', 'momotalk_pink_unlocked', '>=', 1));
  });

  test('theme() 部分覆盖合并', () => {
    const def = colorGroup('base:group:coral')
      .name('珊瑚')
      .desc('全量自定义覆盖示例。')
      .primary('#ff7a59')
      .theme({ bg: '#fff3ee', border: '#ffd0c0' })
      .unlockFlag('momotalk_pink_unlocked')
      .build();
    expect(def.theme).toEqual({ bg: '#fff3ee', border: '#ffd0c0' });
  });

  test('description / theme / unlock 均可选', () => {
    const def = colorGroup('base:group:x').name('x').primary('#000').build();
    expect(def).not.toHaveProperty('description');
    expect(def).not.toHaveProperty('theme');
    expect(def).not.toHaveProperty('unlock');
  });
});
