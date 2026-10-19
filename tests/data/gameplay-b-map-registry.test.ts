import { describe, expect, test } from 'vitest';
import type { Datapack, GameplayMapDef } from '../../src/data-services';
import type { SpotFunctionalityDef } from '../../src/data-services/contracts/world';
import { Registry } from '../../src/data-services/registry/registry';
import { SpotFunctionalitySystem } from '../../src/arona-clicker/services/spot-functionality';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import type { FunctionalityState } from '../../src/engine/contracts/state-query';

const MAP_ID = 'test:map:vertical_slice';
const TEST_CHARACTER_ID = 'shiroko';
const TEST_CHARACTER: NonNullable<Datapack['characters']>[number] = {
  id: TEST_CHARACTER_ID,
  name: 'Shiroko',
  displayName: 'Shiroko',
  school: 'Abydos',
  rarity: 'super_rare',
  description: '',
};
const TEST_CHARACTER_2: NonNullable<Datapack['characters']>[number] = {
  id: 'serika',
  name: 'Serika',
  displayName: 'Serika',
  school: 'Abydos',
  rarity: 'super_rare',
  description: '',
};
const TEST_MEDKIT: NonNullable<Datapack['items']>[number] = {
  id: 'test:item:medkit',
  name: 'Medkit',
  description: '',
  maxStack: 10,
  rarity: 'common',
  type: 'consumable',
};
const TEST_MATERIAL: NonNullable<Datapack['items']>[number] = {
  ...TEST_MEDKIT,
  id: 'test:item:material',
  type: 'material',
};
const VALID_MAP: GameplayMapDef = {
  id: MAP_ID,
  name: 'Vertical Slice',
  resumeVersion: 1,
  startNodeId: 'start',
  exitNodeIds: ['exit'],
  partyCharacterIds: [TEST_CHARACTER_ID],
  initialPartyHp: [{ characterId: TEST_CHARACTER_ID, initialHp: 5, maxHp: 10 }],
  initialPlayerCost: 1,
  nodes: [
    { id: 'start', title: 'Start' },
    {
      id: 'middle',
      title: 'Middle',
      encounter: { title: 'Simple Encounter', completion: { kind: 'manual', label: 'Complete' } },
    },
    { id: 'exit', title: 'Exit' },
  ],
  edges: [
    { fromNodeId: 'start', toNodeId: 'middle' },
    { fromNodeId: 'middle', toNodeId: 'exit' },
  ],
};

const VALID_MAP_ACTIONS: NonNullable<GameplayMapDef['actions']> = [
  {
    id: 'inspect',
    name: 'Inspect',
    eligibleCharacterIds: [TEST_CHARACTER_ID],
    target: { kind: 'none' },
    effects: [{ scope: 'team', resourceId: 'clues', amount: 1 }],
  },
  {
    id: 'focus',
    name: 'Focus',
    eligibleCharacterIds: [TEST_CHARACTER_ID],
    target: { kind: 'self' },
    costs: [{ scope: 'actor', resourceId: 'stamina', amount: 1 }],
    effects: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
  },
  {
    id: 'assist',
    name: 'Assist',
    eligibleCharacterIds: [TEST_CHARACTER_ID],
    target: { kind: 'partyCharacter' },
    costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
    effects: [{ scope: 'actor', resourceId: 'focus', amount: 1, recipient: 'target' }],
  },
];
const VALID_ACTION_MAP: GameplayMapDef = {
  ...VALID_MAP,
  actions: VALID_MAP_ACTIONS,
  initialActorResources: [{ characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 2 }],
  initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
  nodes: VALID_MAP.nodes.map(node => node.id === 'middle'
    ? {
        ...node,
        encounter: {
          ...node.encounter!,
          participants: [{
            characterId: TEST_CHARACTER_ID,
            actions: [
              { actionId: 'inspect', tendencyWeight: 5 },
              { actionId: 'focus', tendencyWeight: 3 },
              { actionId: 'assist', tendencyWeight: 1 },
            ],
          }],
        },
      }
    : node),
};

const VALID_BATTLE_ACTIONS: NonNullable<GameplayMapDef['actions']> = [
  {
    id: 'strike',
    name: 'Strike',
    eligibleCharacterIds: [TEST_CHARACTER_ID],
    target: { kind: 'enemy' },
    hpEffects: [{ amount: -2 }],
  },
  {
    id: 'ability',
    name: 'Ability',
    eligibleCharacterIds: [],
    target: { kind: 'enemy' },
    hpEffects: [{ amount: -3 }],
  },
  {
    id: 'medkit-use',
    name: 'Use Medkit',
    eligibleCharacterIds: [],
    target: { kind: 'partyCharacter' },
    hpEffects: [{ amount: 4 }],
  },
];
const VALID_BATTLE_ENCOUNTER: NonNullable<GameplayMapDef['nodes'][number]['encounter']> = {
  title: 'Battle',
  enemies: [{ id: 'raider', initialHp: 8, maxHp: 10, damage: 2 }],
  abilityActionIds: ['ability'],
  itemActions: [{ itemId: TEST_MEDKIT.id, actionId: 'medkit-use' }],
  participants: [{ characterId: TEST_CHARACTER_ID, actions: [{ actionId: 'strike', tendencyWeight: 1 }] }],
};
const VALID_BATTLE_MAP: GameplayMapDef = {
  ...VALID_MAP,
  actions: VALID_BATTLE_ACTIONS,
  nodes: VALID_MAP.nodes.map(node => node.id === 'middle'
    ? { ...node, encounter: VALID_BATTLE_ENCOUNTER }
    : node),
};

function mapWithActions(actions: unknown): GameplayMapDef {
  return { ...VALID_ACTION_MAP, actions: actions as GameplayMapDef['actions'] };
}

function mapWithParticipants(participants: unknown): GameplayMapDef {
  return {
    ...VALID_ACTION_MAP,
    nodes: VALID_ACTION_MAP.nodes.map(node => node.id === 'middle'
      ? {
          ...node,
          encounter: {
            ...node.encounter!,
            participants: participants as NonNullable<GameplayMapDef['nodes'][number]['encounter']>['participants'],
          },
        }
      : node),
  };
}

function mapWithInitialResources(
  initialActorResources: unknown,
  initialTeamResources: unknown,
): GameplayMapDef {
  return {
    ...VALID_ACTION_MAP,
    initialActorResources: initialActorResources as GameplayMapDef['initialActorResources'],
    initialTeamResources: initialTeamResources as GameplayMapDef['initialTeamResources'],
  };
}

function battleMapWithEncounter(
  encounter: unknown,
  actions: unknown = VALID_BATTLE_ACTIONS,
): GameplayMapDef {
  return {
    ...VALID_BATTLE_MAP,
    actions: actions as GameplayMapDef['actions'],
    nodes: VALID_BATTLE_MAP.nodes.map(node => node.id === 'middle'
      ? { ...node, encounter: encounter as GameplayMapDef['nodes'][number]['encounter'] }
      : node),
  };
}

function battleMapWithAbilityAction(action: unknown): GameplayMapDef {
  return battleMapWithEncounter(
    { ...VALID_BATTLE_ENCOUNTER, abilityActionIds: ['source-action'] },
    [
      ...VALID_BATTLE_ACTIONS.filter(candidate => candidate.id !== 'ability'),
      action,
    ],
  );
}

function makeDatapack(options: {
  maps?: GameplayMapDef[];
  functionalities?: SpotFunctionalityDef[];
  characters?: Datapack['characters'];
  items?: Datapack['items'];
} = {}): Datapack {
  return {
    name: 'map registry test',
    version: '1.0.0',
    modName: 'test',
    inits: [{ id: 'test:init:init', name: 'Init', description: '', defaultAreas: ['test:area:area'] }],
    areas: [{
      id: 'test:area:area', initId: 'test:init:init', name: 'Area', description: '',
      defaultSpots: ['test:spot:entry'],
    }],
    spots: [{
      id: 'test:spot:entry', areaId: 'test:area:area', name: 'Entry', description: '',
      purchaseOptions: [{ id: 'free', costs: [] }],
      tags: [],
      functionalities: options.functionalities,
    }],
    maps: options.maps,
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: options.items ?? [],
    funcletDefs: [],
    characters: options.characters ?? [TEST_CHARACTER],
  };
}

const invalidTopologies: Array<{ label: string; map: GameplayMapDef; error: RegExp }> = [
  {
    label: 'duplicate local Node IDs',
    map: { ...VALID_MAP, nodes: [...VALID_MAP.nodes, { id: 'start', title: 'Duplicate' }] },
    error: /重复 Node id/,
  },
  { label: 'unknown start Node', map: { ...VALID_MAP, startNodeId: 'missing' }, error: /unknown start Node/ },
  { label: 'unknown exit Node', map: { ...VALID_MAP, exitNodeIds: ['missing'] }, error: /unknown exit Node/ },
  {
    label: 'unknown Edge source',
    map: { ...VALID_MAP, edges: [{ fromNodeId: 'missing', toNodeId: 'middle' }] },
    error: /unknown source Node/,
  },
  {
    label: 'unknown Edge destination',
    map: { ...VALID_MAP, edges: [{ fromNodeId: 'start', toNodeId: 'missing' }] },
    error: /unknown destination Node/,
  },
  {
    label: 'self-loop Edge',
    map: { ...VALID_MAP, edges: [{ fromNodeId: 'middle', toNodeId: 'middle' }] },
    error: /cannot connect Node .* to itself/,
  },
  {
    label: 'duplicate directed Edge',
    map: {
      ...VALID_MAP,
      edges: [
        { fromNodeId: 'start', toNodeId: 'middle' },
        { fromNodeId: 'start', toNodeId: 'middle' },
      ],
    },
    error: /重复 Edge/,
  },
];

const invalidResumeVersions: readonly [string, number][] = [
  ['zero', 0],
  ['negative', -1],
  ['fractional', 1.5],
  ['NaN', Number.NaN],
  ['infinite', Number.POSITIVE_INFINITY],
  ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
];

const invalidMapRunValues: Array<{
  label: string;
  map: GameplayMapDef;
  error: RegExp;
  characters?: Datapack['characters'];
}> = [
  {
    label: 'missing fixed party',
    map: { ...VALID_MAP, partyCharacterIds: undefined } as unknown as GameplayMapDef,
    error: /partyCharacterIds 必须是非空数组/,
  },
  { label: 'empty fixed party', map: { ...VALID_MAP, partyCharacterIds: [] }, error: /partyCharacterIds 必须是非空数组/ },
  { label: 'empty Character ID', map: { ...VALID_MAP, partyCharacterIds: [''] }, error: /必须是非空 Character ID/ },
  {
    label: 'duplicate Character ID',
    map: { ...VALID_MAP, partyCharacterIds: [TEST_CHARACTER_ID, TEST_CHARACTER_ID] },
    error: /partyCharacterIds 含重复 Character ID/,
  },
  {
    label: 'unknown Character ID',
    map: { ...VALID_MAP, partyCharacterIds: ['missing-character'] },
    error: /references unknown Character/,
  },
  {
    label: 'missing fixed party HP configuration',
    map: { ...VALID_MAP, initialPartyHp: undefined } as unknown as GameplayMapDef,
    error: /initialPartyHp 必须显式配置固定队伍每名角色的 HP/,
  },
  {
    label: 'missing one party member HP row',
    map: {
      ...VALID_MAP,
      partyCharacterIds: [TEST_CHARACTER_ID, TEST_CHARACTER_2.id],
      initialPartyHp: [{ characterId: TEST_CHARACTER_ID, initialHp: 5, maxHp: 10 }],
    },
    error: /缺少固定队员 "serika" 的 initialPartyHp 配置/,
    characters: [TEST_CHARACTER, TEST_CHARACTER_2],
  },
  {
    label: 'duplicate fixed party HP row',
    map: {
      ...VALID_MAP,
      initialPartyHp: [
        { characterId: TEST_CHARACTER_ID, initialHp: 5, maxHp: 10 },
        { characterId: TEST_CHARACTER_ID, initialHp: 4, maxHp: 10 },
      ],
    },
    error: /initialPartyHp 含重复 Character/,
  },
  {
    label: 'non-positive fixed party max HP',
    map: {
      ...VALID_MAP,
      initialPartyHp: [{ characterId: TEST_CHARACTER_ID, initialHp: 1, maxHp: 0 }],
    },
    error: /maxHp 必须是正安全整数/,
  },
  {
    label: 'initial fixed party HP outside 1..maxHp',
    map: {
      ...VALID_MAP,
      initialPartyHp: [{ characterId: TEST_CHARACTER_ID, initialHp: 11, maxHp: 10 }],
    },
    error: /initialHp 必须在 1\.\.maxHp 范围内/,
  },
  {
    label: 'zero initial fixed party HP',
    map: {
      ...VALID_MAP,
      initialPartyHp: [{ characterId: TEST_CHARACTER_ID, initialHp: 0, maxHp: 10 }],
    },
    error: /initialHp 必须在 1\.\.maxHp 范围内/,
  },
  {
    label: 'unsafe fixed party max HP',
    map: {
      ...VALID_MAP,
      initialPartyHp: [{ characterId: TEST_CHARACTER_ID, initialHp: 1, maxHp: Number.MAX_SAFE_INTEGER + 1 }],
    },
    error: /maxHp 必须是正安全整数/,
  },
  {
    label: 'missing initial PlayerCost',
    map: { ...VALID_MAP, initialPlayerCost: undefined } as unknown as GameplayMapDef,
    error: /initialPlayerCost must be a non-negative safe integer/,
  },
  { label: 'negative initial PlayerCost', map: { ...VALID_MAP, initialPlayerCost: -1 }, error: /initialPlayerCost/ },
  { label: 'fractional initial PlayerCost', map: { ...VALID_MAP, initialPlayerCost: 0.5 }, error: /initialPlayerCost/ },
  {
    label: 'unsafe initial PlayerCost',
    map: { ...VALID_MAP, initialPlayerCost: Number.MAX_SAFE_INTEGER + 1 },
    error: /initialPlayerCost/,
  },
  { label: 'NaN initial PlayerCost', map: { ...VALID_MAP, initialPlayerCost: Number.NaN }, error: /initialPlayerCost/ },
  {
    label: 'infinite initial PlayerCost',
    map: { ...VALID_MAP, initialPlayerCost: Number.POSITIVE_INFINITY },
    error: /initialPlayerCost/,
  },
];

describe('Gameplay B Map Registry', () => {
  test('merges, overrides, queries, and clears Map definitions', () => {
    const registry = new Registry();
    registry.load(makeDatapack({ maps: [VALID_MAP] }));
    expect(registry.maps.get(MAP_ID)).toEqual(VALID_MAP);

    const override = { ...VALID_MAP, name: 'Overridden Map' };
    registry.load(makeDatapack({ maps: [override] }));
    expect(registry.maps.get(MAP_ID)).toEqual(override);

    registry.clear();
    expect(registry.maps.size).toBe(0);
  });

  test.each([1, Number.MAX_SAFE_INTEGER])('accepts positive safe integer resumeVersion %s', resumeVersion => {
    const registry = new Registry();
    registry.load(makeDatapack({ maps: [{ ...VALID_MAP, resumeVersion }] }));
    expect(registry.maps.get(MAP_ID)?.resumeVersion).toBe(resumeVersion);
  });

  test.each(invalidResumeVersions)('rejects %s resumeVersion', (_label, resumeVersion) => {
    const invalidMap = { ...VALID_MAP, resumeVersion };
    expect(() => new Registry().load(makeDatapack({ maps: [invalidMap] })))
      .toThrow(/resumeVersion must be a positive safe integer/);
  });

  test.each(invalidTopologies)('rejects $label', ({ map, error }) => {
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow(error);
  });

  test.each(invalidMapRunValues)('rejects $label', ({ map, error, characters }) => {
    expect(() => new Registry().load(makeDatapack({ maps: [map], characters }))).toThrow(error);
  });

  test('accepts a Map party Character defined in an already loaded Datapack', () => {
    const registry = new Registry();
    registry.load(makeDatapack({ maps: [] }));
    registry.load(makeDatapack({ maps: [VALID_MAP], characters: [] }));
    expect(registry.maps.get(MAP_ID)?.partyCharacterIds).toEqual([TEST_CHARACTER_ID]);
  });

  test('rejects Map IDs with a different registered entity type', () => {
    const wrongType = { ...VALID_MAP, id: 'test:operation-event:vertical_slice' };
    expect(() => new Registry().load(makeDatapack({ maps: [wrongType] }))).toThrow(/Map id .*须为 "map"/);
  });

  test('rejects duplicate Map IDs in a Datapack', () => {
    expect(() => new Registry().load(makeDatapack({ maps: [VALID_MAP, VALID_MAP] }))).toThrow(/Duplicate map id/);
  });

  test.each([undefined, 'test:map:missing'])('rejects a mapEntry without a registered Map: %s', mapId => {
    const registry = new Registry();
    registry.load(makeDatapack({
      maps: [VALID_MAP],
      functionalities: [{ id: 'entry', kind: 'mapEntry', mapId }],
    }));
    expect(() => registry.validateShopRefs()).toThrow(/mapEntry.*未定义的 Map/);
  });

  test('accepts a mapEntry that references a registered Map', () => {
    const registry = new Registry();
    registry.load(makeDatapack({
      maps: [VALID_MAP],
      functionalities: [{ id: 'entry', kind: 'mapEntry', mapId: MAP_ID }],
    }));
    expect(() => registry.validateShopRefs()).not.toThrow();
  });

  test('preserves the mapEntry target in SpotFunctionalityView', () => {
    const functionalityState: FunctionalityState = {
      resources: {},
      spotLevels: {},
      spotManagers: {},
      unlockedEnhancements: [],
      flags: {},
      storyLog: [],
    };
    const system = new SpotFunctionalitySystem(new Registry());
    const view = system.definitionsOf({
      id: 'test:spot:entry',
      functionalities: [{ id: 'entry', kind: 'mapEntry', requiresOwned: false, mapId: MAP_ID }],
    }, functionalityState);

    expect(view[0]).toMatchObject({ kind: 'mapEntry', mapId: MAP_ID });
  });

  test('keeps operationEntry reference validation unchanged', () => {
    const registry = new Registry();
    registry.load(makeDatapack({
      functionalities: [{
        id: 'entry', kind: 'operationEntry', operationEventId: 'test:operation-event:missing',
      }],
    }));
    expect(() => registry.validateShopRefs()).toThrow(/operationEntry.*未定义的 OperationEvent/);
  });
});

describe('Gameplay B Map Action Registry', () => {
  const cardAction = { id: 'discount', name: 'Discount', eligibleCharacterIds: [TEST_CHARACTER_ID],
    target: { kind: 'card', side: 'ally' }, cardEffects: [{ kind: 'scostDiscount', amount: 1 }] };
  test('accepts a real card target and round-local scost discount definition', () => {
    const registry = new Registry();
    const map = mapWithActions([...VALID_MAP_ACTIONS, cardAction]);
    expect(() => registry.load(makeDatapack({ maps: [map] }))).not.toThrow();
  });
  test.each([
    { target: { kind: 'card', side: 'left' } },
    { target: { kind: 'card' } },
    { target: { kind: 'card', side: ['ally'] } },
    { target: { kind: 'card', side: 'ally', anchor: 'left' } },
    { cardEffects: [] },
    { cardEffects: [{ kind: 'scostDiscount', amount: 0 }] },
    { cardEffects: [{ kind: 'scostDiscount', amount: -1 }] },
    { cardEffects: [{ kind: 'scostDiscount', amount: 1.5 }] },
    { cardEffects: [{ kind: 'scostDiscount', amount: Number.MAX_SAFE_INTEGER + 1 }] },
    { cardEffects: [{ kind: 'scostDiscount', amount: 1, resourceId: 'PlayerCost' }] },
    { cardEffects: [{ kind: 'playerCostDiscount', amount: 1 }] },
    { target: { kind: 'enemy' } },
    { hpEffects: [{ amount: 1 }] },
    { effects: [{ scope: 'actor', resourceId: 'focus', amount: 1, recipient: 'target' }] },
  ])('rejects invalid card discount semantics %#', change => {
    const map = mapWithActions([...VALID_MAP_ACTIONS, { ...cardAction, ...change }]);
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow();
  });
  const loadMap = (
    map: GameplayMapDef,
    characters: NonNullable<Datapack['characters']> = [TEST_CHARACTER],
    items: Datapack['items'] = [],
  ): Registry => {
    const registry = new Registry();
    registry.load(makeDatapack({ maps: [map], characters, items }));
    return registry;
  };

  test('accepts map-local Actions, weighted participants, and explicit actor/team resources', () => {
    const registry = loadMap(VALID_ACTION_MAP);
    expect(registry.maps.get(MAP_ID)).toEqual(VALID_ACTION_MAP);
  });

  test('loads a real Battle Datapack with HP, Enemy, Ability, and Consumable references through Registry', () => {
    const registry = loadMap(VALID_BATTLE_MAP, [TEST_CHARACTER], [TEST_MEDKIT]);
    expect(registry.maps.get(MAP_ID)).toEqual(VALID_BATTLE_MAP);
  });

  test('resolves an Encounter Item mapping to a Consumable in an earlier loaded Datapack', () => {
    const registry = new Registry();
    registry.load(makeDatapack({ maps: [], items: [TEST_MEDKIT] }));
    registry.load(makeDatapack({ maps: [VALID_BATTLE_MAP], items: [] }));
    expect(registry.maps.get(MAP_ID)?.nodes[1]?.encounter?.itemActions).toEqual([
      { itemId: TEST_MEDKIT.id, actionId: 'medkit-use' },
    ]);
  });

  test('allows the same Item to map once in each of two different Encounters', () => {
    const mapWithTwoEncounters: GameplayMapDef = {
      ...VALID_BATTLE_MAP,
      nodes: VALID_BATTLE_MAP.nodes.map(node => node.id === 'start'
        ? { ...node, encounter: VALID_BATTLE_ENCOUNTER }
        : node),
    };
    expect(() => loadMap(mapWithTwoEncounters, [TEST_CHARACTER], [TEST_MEDKIT])).not.toThrow();
  });

  test.each([
    {
      label: 'an empty Enemy roster',
      map: battleMapWithEncounter({ ...VALID_BATTLE_ENCOUNTER, enemies: [] }),
      items: [TEST_MEDKIT],
      error: /enemies 必须是非空 Enemy roster/,
    },
    {
      label: 'duplicate Encounter-local Enemy IDs',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [
          { id: 'raider', initialHp: 8, maxHp: 10, damage: 2 },
          { id: 'raider', initialHp: 3, maxHp: 3, damage: 1 },
        ],
      }),
      items: [TEST_MEDKIT],
      error: /含重复 Enemy ID "raider"/,
    },
    {
      label: 'non-positive Enemy max HP',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 1, maxHp: 0, damage: 2 }],
      }),
      items: [TEST_MEDKIT],
      error: /maxHp 必须是正安全整数/,
    },
    {
      label: 'Enemy initial HP outside its bounds',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 11, maxHp: 10, damage: 2 }],
      }),
      items: [TEST_MEDKIT],
      error: /initialHp 必须在 1\.\.maxHp 范围内/,
    },
    {
      label: 'zero Enemy initial HP',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 0, maxHp: 10, damage: 2 }],
      }),
      items: [TEST_MEDKIT],
      error: /initialHp 必须在 1\.\.maxHp 范围内/,
    },
    {
      label: 'non-positive Enemy damage',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 8, maxHp: 10, damage: 0 }],
      }),
      items: [TEST_MEDKIT],
      error: /damage 必须是正安全整数/,
    },
    {
      label: 'manual completion on a Battle',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        completion: { kind: 'manual', label: 'Complete' },
      }),
      items: [TEST_MEDKIT],
      error: /Battle 不允许声明手动 completion/,
    },
    {
      label: 'duplicate Ability Action IDs',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        abilityActionIds: ['ability', 'ability'],
      }),
      items: [TEST_MEDKIT],
      error: /abilityActionIds 含重复 Action ID "ability"/,
    },
    {
      label: 'an unknown Ability Action reference',
      map: battleMapWithEncounter({ ...VALID_BATTLE_ENCOUNTER, abilityActionIds: ['missing'] }),
      items: [TEST_MEDKIT],
      error: /abilityActionIds\[0\] 引用了 Map .*未定义的 Action "missing"/,
    },
    {
      label: 'duplicate Item mappings in one Encounter',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        itemActions: [
          { itemId: TEST_MEDKIT.id, actionId: 'medkit-use' },
          { itemId: TEST_MEDKIT.id, actionId: 'medkit-use' },
        ],
      }),
      items: [TEST_MEDKIT],
      error: /itemActions 含重复 Item ID/,
    },
    {
      label: 'an unknown Item reference',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        itemActions: [{ itemId: 'test:item:missing', actionId: 'medkit-use' }],
      }),
      items: [TEST_MEDKIT],
      error: /引用了未定义的 Item "test:item:missing"/,
    },
    {
      label: 'a non-Consumable Item reference',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        itemActions: [{ itemId: TEST_MATERIAL.id, actionId: 'medkit-use' }],
      }),
      items: [TEST_MATERIAL],
      error: /必须引用 Consumable Item/,
    },
    {
      label: 'an unknown Item Action reference',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        itemActions: [{ itemId: TEST_MEDKIT.id, actionId: 'missing' }],
      }),
      items: [TEST_MEDKIT],
      error: /itemActions\[0\]\.actionId 引用了 Map .*未定义的 Action "missing"/,
    },
  ] as Array<{ label: string; map: GameplayMapDef; items: Datapack['items']; error: RegExp }>)(
    'rejects $label',
    ({ map, items, error }) => {
      expect(() => loadMap(map, [TEST_CHARACTER], items)).toThrow(error);
    },
  );

  test.each([
    {
      label: 'a Character performer field',
      action: {
        id: 'source-action', name: 'Source', eligibleCharacterIds: [TEST_CHARACTER_ID],
        target: { kind: 'enemy' }, hpEffects: [{ amount: -1 }],
      },
      error: /是 Character Action，不能作为 Ability \/ Item 来源/,
    },
    {
      label: 'a self target',
      action: { id: 'source-action', name: 'Source', eligibleCharacterIds: [], target: { kind: 'self' } },
      error: /必须明确选择 enemy 或 partyCharacter target/,
    },
    {
      label: 'an Action cost',
      action: {
        id: 'source-action', name: 'Source', eligibleCharacterIds: [], target: { kind: 'enemy' },
        costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      },
      error: /不允许额外 Action cost/,
    },
    {
      label: 'an actor-relative effect',
      action: {
        id: 'source-action', name: 'Source', target: { kind: 'enemy' },
        eligibleCharacterIds: [],
        effects: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      },
      error: /不允许 actor-relative effect/,
    },
  ])('rejects Ability / Item Actions with $label', ({ action, error }) => {
    expect(() => loadMap(battleMapWithAbilityAction(action), [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(error);
  });

  test.each([
    { label: 'a zero HP change', amount: 0, target: 'enemy', error: /非零安全整数/ },
    { label: 'an HP change larger than a safe integer', amount: Number.MAX_SAFE_INTEGER + 1, target: 'enemy', error: /非零安全整数/ },
    { label: 'healing applied to an Enemy', amount: 1, target: 'enemy', error: /符号必须与 Enemy 伤害/ },
    { label: 'damage applied to a party target', amount: -1, target: 'partyCharacter', error: /符号必须与 Enemy 伤害/ },
    { label: 'an HP effect with no selected target', amount: -1, target: 'none', error: /HP 效果必须选择 Enemy 或 partyCharacter target/ },
  ])('rejects $label', ({ amount, target, error }) => {
    const actions = VALID_BATTLE_ACTIONS.map(action => action.id === 'strike'
      ? { ...action, target: { kind: target } as NonNullable<GameplayMapDef['actions']>[number]['target'], hpEffects: [{ amount }] }
      : action);
    const map = battleMapWithEncounter(VALID_BATTLE_ENCOUNTER, actions);
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(error);
  });

  test('allows empty candidate lists and omitted participants for Wait encounters', () => {
    expect(() => loadMap(mapWithParticipants([{ characterId: TEST_CHARACTER_ID, actions: [] }]))).not.toThrow();
    expect(() => loadMap({ ...VALID_MAP, actions: [] })).not.toThrow();
  });

  test('loads the normal Gameplay B Datapack sample with two fixed party members', () => {
    const registry = loadMap(
      gameplayBCarouselDatapack.maps?.[0] as GameplayMapDef,
      [TEST_CHARACTER, TEST_CHARACTER_2],
    );
    const map = registry.maps.get('gameplay-b:map:field-investigation');
    expect(map?.partyCharacterIds).toEqual(['shiroko', 'serika']);
    expect(map?.actions).toHaveLength(3);
    expect(map?.initialActorResources).toHaveLength(2);
    expect(map?.initialTeamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
  });

  test.each([
    {
      label: 'Action',
      map: mapWithActions([{ ...VALID_MAP_ACTIONS[0], profileId: 'legacy-profile' }, ...VALID_MAP_ACTIONS.slice(1)]),
      error: /actions\[0\] 含合同外字段 "profileId"/,
    },
    {
      label: 'Target',
      map: mapWithActions([{ ...VALID_MAP_ACTIONS[0], target: { kind: 'none', actorIds: [] } }, ...VALID_MAP_ACTIONS.slice(1)]),
      error: /actions\[0\]\.target 含合同外字段 "actorIds"/,
    },
    {
      label: 'Cost',
      map: mapWithActions([
        VALID_MAP_ACTIONS[0],
        { ...VALID_MAP_ACTIONS[1], costs: [{ scope: 'actor', resourceId: 'stamina', amount: 1, formula: 'strength' }] },
        VALID_MAP_ACTIONS[2],
      ]),
      error: /actions\[1\]\.costs\[0\] 含合同外字段 "formula"/,
    },
    {
      label: 'Effect',
      map: mapWithActions([
        { ...VALID_MAP_ACTIONS[0], effects: [{ scope: 'team', resourceId: 'clues', amount: 1, eventId: 'old-event' }] },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /actions\[0\]\.effects\[0\] 含合同外字段 "eventId"/,
    },
    {
      label: 'Participant',
      map: mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [{ actionId: 'inspect', tendencyWeight: 1 }],
        profileId: 'legacy-profile',
      }]),
      error: /participants\[0\] 含合同外字段 "profileId"/,
    },
    {
      label: 'Candidate',
      map: mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [{ actionId: 'inspect', tendencyWeight: 1, cardPoolId: 'legacy-pool' }],
      }]),
      error: /actions\[0\] 含合同外字段 "cardPoolId"/,
    },
    {
      label: 'initial Actor resource',
      map: mapWithInitialResources(
        [{ characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 1, source: 'playerState' }],
        [{ resourceId: 'supplies', value: 1 }],
      ),
      error: /initialActorResources\[0\] 含合同外字段 "source"/,
    },
    {
      label: 'initial Team resource',
      map: mapWithInitialResources(
        [{ characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 1 }],
        [{ resourceId: 'supplies', value: 1, source: 'eventRun' }],
      ),
      error: /initialTeamResources\[0\] 含合同外字段 "source"/,
    },
  ] as Array<{ label: string; map: GameplayMapDef; error: RegExp }>)('rejects contract-external fields on $label objects', ({ map, error }) => {
    expect(() => loadMap(map)).toThrow(error);
  });

  test('rejects a duplicate Encounter participant Character', () => {
    const map = mapWithParticipants([
      { characterId: TEST_CHARACTER_ID, actions: [] },
      { characterId: TEST_CHARACTER_ID, actions: [] },
    ]);
    expect(() => loadMap(map)).toThrow(/participants 含重复 Character "shiroko"/);
  });

  test('rejects duplicate eligible Character IDs for an Action', () => {
    const map = mapWithActions([
      { ...VALID_MAP_ACTIONS[0], eligibleCharacterIds: [TEST_CHARACTER_ID, TEST_CHARACTER_ID] },
      ...VALID_MAP_ACTIONS.slice(1),
    ]);
    expect(() => loadMap(map)).toThrow(/eligibleCharacterIds 含重复 Character "shiroko"/);
  });

  test.each([
    {
      label: 'duplicate map-local Action IDs',
      map: mapWithActions([...VALID_MAP_ACTIONS, { ...VALID_MAP_ACTIONS[0] }]),
      error: /含重复 Action id "inspect"/,
    },
    {
      label: 'empty Action ID',
      map: mapWithActions([{ ...VALID_MAP_ACTIONS[0], id: '  ' }, ...VALID_MAP_ACTIONS.slice(1)]),
      error: /actions\[0\]\.id 必须是非空/,
    },
    {
      label: 'empty action name',
      map: mapWithActions([{ ...VALID_MAP_ACTIONS[0], name: '' }, ...VALID_MAP_ACTIONS.slice(1)]),
      error: /actions\[0\]\.name 必须是非空/,
    },
    {
      label: 'unsupported target rule',
      map: mapWithActions([{ ...VALID_MAP_ACTIONS[0], target: { kind: 'unknown' } }, ...VALID_MAP_ACTIONS.slice(1)]),
      error: /target\.kind 必须是 none、self、partyCharacter、enemy 或 card/,
    },
    {
      label: 'zero resource cost',
      map: mapWithActions([
        { ...VALID_MAP_ACTIONS[0], costs: [{ scope: 'actor', resourceId: 'stamina', amount: 0 }] },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /costs\[0\]\.amount 必须是正安全整数/,
    },
    {
      label: 'fractional resource cost',
      map: mapWithActions([
        { ...VALID_MAP_ACTIONS[0], costs: [{ scope: 'team', resourceId: 'supplies', amount: 0.5 }] },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /costs\[0\]\.amount 必须是正安全整数/,
    },
    {
      label: 'zero resource effect',
      map: mapWithActions([
        { ...VALID_MAP_ACTIONS[0], effects: [{ scope: 'team', resourceId: 'clues', amount: 0 }] },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /effects\[0\]\.amount 必须是非零安全整数/,
    },
    {
      label: 'target resource effect with no target',
      map: mapWithActions([
        {
          ...VALID_MAP_ACTIONS[0],
          effects: [{ scope: 'actor', resourceId: 'focus', amount: 1, recipient: 'target' }],
        },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /recipient 为 target 时 Action 必须声明 self 或 partyCharacter target/,
    },
    {
      label: 'target resource effect with an Enemy target',
      map: mapWithActions([
        {
          ...VALID_MAP_ACTIONS[0],
          target: { kind: 'enemy' },
          effects: [{ scope: 'actor', resourceId: 'focus', amount: 1, recipient: 'target' }],
        },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /recipient 为 target 时 Action 必须声明 self 或 partyCharacter target/,
    },
    {
      label: 'empty actor resource key',
      map: mapWithActions([
        { ...VALID_MAP_ACTIONS[0], costs: [{ scope: 'actor', resourceId: ' ', amount: 1 }] },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /costs\[0\]\.resourceId 必须是非空字符串/,
    },
    {
      label: 'unknown candidate Action',
      map: mapWithParticipants([{ characterId: TEST_CHARACTER_ID, actions: [{ actionId: 'missing', tendencyWeight: 1 }] }]),
      error: /引用了 Map .*未定义的 Action "missing"/,
    },
    {
      label: 'duplicate participant candidate',
      map: mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [
          { actionId: 'inspect', tendencyWeight: 1 },
          { actionId: 'inspect', tendencyWeight: 2 },
        ],
      }]),
      error: /actions 含重复 Action id "inspect"/,
    },
    {
      label: 'participant outside fixed party',
      map: mapWithParticipants([{ characterId: 'serika', actions: [] }]),
      error: /participants\[0\]\.characterId 必须属于 Map partyCharacterIds/,
      characters: [TEST_CHARACTER, TEST_CHARACTER_2],
    },
    {
      label: 'candidate action not eligible for participant',
      map: {
        ...VALID_ACTION_MAP,
        partyCharacterIds: [TEST_CHARACTER_ID, TEST_CHARACTER_2.id],
        initialPartyHp: [
          { characterId: TEST_CHARACTER_ID, initialHp: 5, maxHp: 10 },
          { characterId: TEST_CHARACTER_2.id, initialHp: 5, maxHp: 10 },
        ],
        nodes: VALID_ACTION_MAP.nodes.map(node => node.id === 'middle'
          ? {
              ...node,
              encounter: {
                ...node.encounter,
                participants: [{ characterId: TEST_CHARACTER_2.id, actions: [{ actionId: 'inspect', tendencyWeight: 1 }] }],
              },
            }
          : node),
      },
      error: /不允许 Character "serika" 执行/,
      characters: [TEST_CHARACTER, TEST_CHARACTER_2],
    },
  ] as Array<{
    label: string;
    map: GameplayMapDef;
    error: RegExp;
    characters?: NonNullable<Datapack['characters']>;
  }>)('rejects $label', ({ map, error, characters }) => {
    expect(() => loadMap(map, characters)).toThrow(error);
  });

  test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN])(
    'rejects invalid Tendency weight %s',
    tendencyWeight => {
      const map = mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [{ actionId: 'inspect', tendencyWeight }],
      }]);
      expect(() => loadMap(map)).toThrow(/tendencyWeight 必须是正安全整数/);
    },
  );

  test.each([
    {
      label: 'actor resource for a non-party Character',
      actorResources: [{ characterId: 'serika', resourceId: 'stamina', value: 1 }],
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      error: /initialActorResources\[0\]\.characterId 必须属于 Map partyCharacterIds/,
      characters: [TEST_CHARACTER, TEST_CHARACTER_2],
    },
    {
      label: 'negative actor resource value',
      actorResources: [{ characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: -1 }],
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      error: /initialActorResources\[0\]\.value 必须是非负安全整数/,
    },
    {
      label: 'fractional actor resource value',
      actorResources: [{ characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 0.5 }],
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      error: /initialActorResources\[0\]\.value 必须是非负安全整数/,
    },
    {
      label: 'duplicate actor resource key',
      actorResources: [
        { characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 1 },
        { characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 2 },
      ],
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      error: /initialActorResources 含重复 Character/,
    },
    {
      label: 'negative team resource value',
      actorResources: [{ characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 1 }],
      teamResources: [{ resourceId: 'supplies', value: -1 }],
      error: /initialTeamResources\[0\]\.value 必须是非负安全整数/,
    },
    {
      label: 'duplicate team resource key',
      actorResources: [{ characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 1 }],
      teamResources: [
        { resourceId: 'supplies', value: 1 },
        { resourceId: 'supplies', value: 2 },
      ],
      error: /initialTeamResources 含重复 resourceId "supplies"/,
    },
  ] as Array<{
    label: string;
    actorResources: unknown;
    teamResources: unknown;
    error: RegExp;
    characters?: NonNullable<Datapack['characters']>;
  }>)('rejects $label', ({ actorResources, teamResources, error, characters }) => {
    expect(() => loadMap(
      mapWithInitialResources(actorResources, teamResources),
      characters,
    )).toThrow(error);
  });
});
