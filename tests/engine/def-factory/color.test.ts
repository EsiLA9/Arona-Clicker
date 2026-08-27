// ============================================================
// engine/def-factory/color.test.ts — Color 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  color,
  ColorBuilder,
  cond,
  Character,
} from '../../../src/engine/types';
import type { ColorDef } from '../../../src/engine/types';

describe('ColorBuilder', () => {
  test('color() 返回 ColorBuilder 实例', () => {
    expect(color('base:color:x')).toBeInstanceOf(ColorBuilder);
  });

  test('build() 产出最小 ColorDef', () => {
    const def = color('base:color:x').name('测试').primary('#3b82f6').build();
    expect(def).toEqual<ColorDef>({
      id: 'base:color:x',
      name: '测试',
      theme: { primary: '#3b82f6' },
    });
  });

  test('缺 name / primary 时 build() 抛错', () => {
    expect(() => color('base:color:x').build()).toThrow(/name/);
    expect(() => color('base:color:x').name('x').build()).toThrow(/primary/);
  });

  test('unlockProtoStat / unlockFlag 糖构造解锁条件', () => {
    const protoDef = color('base:color:abydos-sand')
      .name('阿比多斯黄沙')
      .desc('被沙漠侵蚀的学园配色。拥有星野（任一差分）后解锁。')
      .primary('#eab308')
      .unlockProtoStat(Character.Hoshino)
      .build();
    expect(protoDef.unlock).toEqual(cond('protoStat', String(Character.Hoshino), '>=', 1));

    const flagDef = color('base:color:momotalk-pink')
      .name('Momotalk 粉')
      .desc('聊天软件的主题色。完成欢迎剧情（flag）后解锁。')
      .primary('#ec4899')
      .unlockFlag('momotalk_pink_unlocked')
      .build();
    expect(flagDef.unlock).toEqual(cond('flag', 'momotalk_pink_unlocked', '>=', 1));
  });

  test('theme() 全量覆盖与 tokens() 增量覆盖', () => {
    const def = color('base:color:coral')
      .name('珊瑚')
      .desc('全量自定义覆盖示例。')
      .theme({ primary: '#ff7a59' })
      .tokens({ bg: '#fff3ee', border: '#ffd0c0' })
      .unlockFlag('momotalk_pink_unlocked')
      .build();
    expect(def.theme).toEqual({ primary: '#ff7a59', bg: '#fff3ee', border: '#ffd0c0' });
  });

  test('description 可选', () => {
    const def = color('base:color:x').name('x').primary('#000').build();
    expect(def).not.toHaveProperty('description');
    expect(def).not.toHaveProperty('effects');
    expect(def).not.toHaveProperty('unlock');
  });
});
