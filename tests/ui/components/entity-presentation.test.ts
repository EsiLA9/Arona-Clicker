import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../../src/data-services/contracts/datapack';
import { Character, CharacterRarity, CharacterSchool } from '../../../src/arona-clicker/types/ids';
import { GameInstance } from '../../../src/arona-clicker/runtime-game-instance';
import { createUIContext } from '../../../src/ui/context';
import { renderEntityPresentationOptions } from '../../../src/ui/components/entity-presentation';

const datapack = (): Datapack => ({
  name: 'entity-presentation-ui-test',
  version: '1.0.0',
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
  characterVariants: [{
    id: 'test:variant:main',
    proto: Character.Hoshino,
    name: 'Main',
    displayName: 'Main Display',
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.Common,
    description: 'Base description',
    presentation: {
      default: { name: 'Default name', description: 'Default description' },
      additions: [
        { id: 'alternate', label: 'Alternate', override: { description: 'Alternate description', theme: { tokens: { primary: '#123456' } } } },
        {
          id: 'locked',
          label: 'Secret label',
          override: { description: 'Secret description' },
          availableWhen: { target: 'flag', key: 'locked', comparator: '==', value: 1 },
        },
      ],
    },
  }],
});

describe('实体表现选择 UI', () => {
  test('显示默认与可用 addition，并将不可用内容遮罩', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const html = renderEntityPresentationOptions(createUIContext(game), 'variant', 'test:variant:main');

    expect(html).toContain('表现内容');
    expect(html).toContain('名称 · 描述 · 主题');
    expect(html).toContain('Alternate');
    expect(html).toContain('Alternate description');
    expect(html).toContain('data-entity-presentation-select');
    expect(html).toContain('???');
    expect(html).not.toContain('Secret description');
  });

  test('玩家选择后标记 active，默认按钮通过 null payload 回退', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'variant:test:variant:main' as const;
    game.mutations.setEntityPresentationSelection(key, 'alternate');

    const html = renderEntityPresentationOptions(createUIContext(game), 'variant', 'test:variant:main');
    expect(html).toMatch(/entity-presentation-option active[\s\S]*Alternate/);
    expect(html).toContain('&quot;optionId&quot;:null');
  });
});
