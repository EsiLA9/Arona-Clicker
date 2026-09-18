import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { Registry, RegistryError, validateDatapack } from '../../src/data-services';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';

const datapack = (): Datapack => ({
  name: 'presentation-test',
  version: '1.0.0',
  inits: [{
    id: 'test:init:main',
    name: 'Main',
    description: 'Main description',
    defaultAreas: [],
  }],
  areas: [],
  spots: [],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
});

describe('实体表现内容契约', () => {
  test('接受默认内容、局部覆盖与条件门控', () => {
    const dp = datapack();
    dp.inits[0].presentation = {
      default: { name: 'Default name', description: 'Default description' },
      additions: [{
        id: 'winter',
        label: '冬季内容',
        override: { description: 'Winter description' },
        availableWhen: { type: 'AND', conditions: [{ target: 'alwaysTrue', key: '', comparator: '==', value: 1 }] },
      }],
    };

    expect(() => validateDatapack(dp)).not.toThrow();
  });

  test.each([
    ['duplicate option id', (dp: Datapack) => {
      dp.inits[0].presentation = {
        default: { name: 'Default', description: '' },
        additions: [
          { id: 'same', label: 'A', override: { name: 'A' } },
          { id: 'same', label: 'B', override: { description: 'B' } },
        ],
      };
    }],
    ['empty override', (dp: Datapack) => {
      dp.inits[0].presentation = {
        default: { name: 'Default', description: '' },
        additions: [{ id: 'empty', label: 'Empty', override: {} }],
      };
    }],
    ['invalid condition', (dp: Datapack) => {
      dp.inits[0].presentation = {
        default: { name: 'Default', description: '' },
        additions: [{
          id: 'broken',
          label: 'Broken',
          override: { name: 'Broken' },
          availableWhen: { target: 'alwaysTrue', key: '', comparator: '???' as never, value: 1 },
        }],
      };
    }],
  ])('拒绝%s', (_name, mutate) => {
    const dp = datapack();
    mutate(dp);
    expect(() => validateDatapack(dp)).toThrow(RegistryError);
  });

  test('在全部数据包加载后拒绝未定义的表现主题色组', () => {
    const dp = datapack();
    dp.inits[0].presentation = {
      default: {
        name: 'Default',
        description: '',
        theme: { colorGroupId: 'test:colorgroup:missing' },
      },
    };
    const registry = new Registry();
    registry.load(dp);
    expect(() => registry.validateCharacterRefs()).toThrow(/presentation default.*未定义的颜色组/);
  });

  test('正式默认 Datapack 在组合入口具备规范 default 表现', () => {
    expect(defaultDatapack.inits.every(def => Boolean(def.presentation?.default))).toBe(true);
    expect(defaultDatapack.areas.every(def => Boolean(def.presentation?.default))).toBe(true);
    expect(defaultDatapack.spots.every(def => Boolean(def.presentation?.default))).toBe(true);
    expect(defaultDatapack.enhancements.every(def => Boolean(def.presentation?.default))).toBe(true);
    expect((defaultDatapack.characterVariants ?? []).every(def => def.presentation?.default.name === (def.displayName || def.name))).toBe(true);
  });
});
