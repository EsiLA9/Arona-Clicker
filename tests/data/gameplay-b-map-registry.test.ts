import { describe, expect, test } from 'vitest';
import type { Datapack, GameplayMapDef } from '../../src/data-services';
import type { SpotFunctionalityDef } from '../../src/data-services/contracts/world';
import { Registry } from '../../src/data-services/registry/registry';
import { SpotFunctionalitySystem } from '../../src/arona-clicker/services/world/spot-functionality';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import type { FunctionalityState } from '../../src/engine/contracts/state-query';
import { tagRef } from '../../src/engine/core/tag';
import { resolveGameplayMapCandidateSources } from '../../src/data-services/validation/gameplay-map-candidate-pools';

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
    effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 1 }] },
  },
  {
    id: 'focus',
    name: 'Focus',
    eligibleCharacterIds: [TEST_CHARACTER_ID],
    target: { kind: 'self' },
    costs: [{ scope: 'actor', resourceId: 'stamina', amount: 1 }],
    effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
  },
  {
    id: 'assist',
    name: 'Assist',
    eligibleCharacterIds: [TEST_CHARACTER_ID],
    target: { kind: 'partyCharacter' },
    costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
    effectProgram: { resolve: [{ op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 }] },
  },
];
const VALID_ACTION_MAP: GameplayMapDef = {
  ...VALID_MAP,
  actions: VALID_MAP_ACTIONS,
  initialActorResources: [
    { characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 2 },
    { characterId: TEST_CHARACTER_ID, resourceId: 'focus', value: 0 },
  ],
  initialTeamResources: [{ resourceId: 'supplies', value: 1 }, { resourceId: 'clues', value: 0 }],
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
    effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
  },
  {
    id: 'ability',
    name: 'Ability',
    eligibleCharacterIds: [],
    target: { kind: 'enemy' },
    effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
  },
  {
    id: 'medkit-use',
    name: 'Use Medkit',
    eligibleCharacterIds: [],
    target: { kind: 'partyCharacter' },
    effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 4 }] },
  },
];
const VALID_BATTLE_ENCOUNTER: NonNullable<GameplayMapDef['nodes'][number]['encounter']> = {
  title: 'Battle',
  enemies: [{ id: 'raider', initialHp: 8, maxHp: 10 }],
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

function battleMapWithPools(
  actions: unknown,
  participants: unknown,
  enemies: unknown = VALID_BATTLE_ENCOUNTER.enemies,
  extraEncounterFields: Record<string, unknown> = {},
): GameplayMapDef {
  return battleMapWithEncounter({
    ...VALID_BATTLE_ENCOUNTER,
    ...extraEncounterFields,
    enemies,
    participants,
  }, actions);
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
  test('accepts a single declared MapRun Counter or Flag gate on an AG-1 Edge', () => {
    const mapRunFacts = {
      counters: [{ id: 'progress', initial: 0, min: 0, max: 4 }],
      flags: [{ id: 'route-open', initial: false }],
    };
    for (const condition of [
      { kind: 'counter', counterId: 'progress', comparison: 'gte', value: 2 },
      { kind: 'flag', flagId: 'route-open', value: true },
    ] as const) {
      const map: GameplayMapDef = {
        ...VALID_MAP,
        executionContractId: 'AG-1',
        mapRunFacts,
        edges: [{ fromNodeId: 'start', toNodeId: 'middle', condition }, { fromNodeId: 'middle', toNodeId: 'exit' }],
      };
      expect(() => new Registry().load(makeDatapack({ maps: [map] }))).not.toThrow();
    }
  });

  test.each([
    ['undeclared Counter', { kind: 'counter', counterId: 'missing', comparison: 'gte', value: 1 }, { counters: [], flags: [] }, /未声明为 MapRun Counter/],
    ['wrong Fact kind', { kind: 'counter', counterId: 'route-open', comparison: 'gte', value: 1 }, { counters: [], flags: [{ id: 'route-open', initial: false }] }, /未声明为 MapRun Counter/],
    ['unknown comparison', { kind: 'counter', counterId: 'progress', comparison: 'neq', value: 1 }, { counters: [{ id: 'progress', initial: 0, min: 0, max: 2 }] }, /comparison/],
    ['non-boolean Flag value', { kind: 'flag', flagId: 'route-open', value: 1 }, { flags: [{ id: 'route-open', initial: false }] }, /value 必须是 boolean/],
    ['Edge Fact gate on E1', { kind: 'flag', flagId: 'route-open', value: true }, { flags: [{ id: 'route-open', initial: false }] }, /需要 executionContractId AG-1/],
    ['extra gate field', { kind: 'flag', flagId: 'route-open', value: true, anyOf: [] }, { flags: [{ id: 'route-open', initial: false }] }, /合同外字段/],
  ])('rejects invalid Edge Fact gate: %s', (_label, condition, mapRunFacts, error) => {
    const usesFactGate = condition.kind === 'counter' || condition.kind === 'flag';
    const map = {
      ...VALID_MAP,
      ...(usesFactGate && _label !== 'Edge Fact gate on E1' ? { executionContractId: 'AG-1' } : {}),
      mapRunFacts,
      edges: [{ fromNodeId: 'start', toNodeId: 'middle', condition }, { fromNodeId: 'middle', toNodeId: 'exit' }],
    } as unknown as GameplayMapDef;
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow(error);
  });

  test('accepts the AG-1 contract with capped Action agility and sparse fixed-party supplements', () => {
    const base = battleMapWithEncounter({
      title: 'Battle',
      enemies: [{ id: 'raider', initialHp: 8, maxHp: 10 }],
      participants: [{ characterId: TEST_CHARACTER_ID, actions: [{ actionId: 'strike', tendencyWeight: 1 }] }],
    }, [VALID_BATTLE_ACTIONS[0]!]);
    const ag1Map: GameplayMapDef = {
      ...base,
      executionContractId: 'AG-1',
      partyAgility: [{ characterId: TEST_CHARACTER_ID, agility: 3 }],
      actions: [{ ...VALID_BATTLE_ACTIONS[0]!, agility: { base: 2, max: 8 } }],
      nodes: base.nodes.map(node => node.id === 'middle'
        ? { ...node, encounter: { ...node.encounter!, enemies: [{ id: 'raider', initialHp: 8, maxHp: 10, agility: 4 }] } }
        : node),
    };
    const registry = new Registry();
    registry.load(makeDatapack({ maps: [ag1Map] }));
    expect(registry.maps.get(MAP_ID)).toEqual(ag1Map);
  });

  test('keeps omitted and explicit E1 execution contracts compatible', () => {
    const base = battleMapWithEncounter({
      title: 'Battle',
      enemies: [{ id: 'raider', initialHp: 8, maxHp: 10 }],
      participants: [{ characterId: TEST_CHARACTER_ID, actions: [{ actionId: 'strike', tendencyWeight: 1 }] }],
    }, [VALID_BATTLE_ACTIONS[0]!]);
    for (const map of [base, { ...base, executionContractId: 'E1-COMPAT-1' as const }]) {
      const registry = new Registry();
      registry.load(makeDatapack({ maps: [map] }));
      expect(registry.maps.get(MAP_ID)).toEqual(map);
    }
  });

  test('accepts only AG-1 additionalTarget values on unit-target Actions', () => {
    const base = battleMapWithEncounter({
      title: 'Battle', enemies: [{ id: 'raider', initialHp: 8, maxHp: 10 }],
      participants: [{ characterId: TEST_CHARACTER_ID, actions: [{ actionId: 'strike', tendencyWeight: 1 }] }],
    }, [VALID_BATTLE_ACTIONS[0]!]);
    for (const additionalTarget of ['partyCharacter', 'enemy'] as const) {
      expect(() => new Registry().load(makeDatapack({ maps: [{ ...base, executionContractId: 'AG-1',
        actions: [{ ...VALID_BATTLE_ACTIONS[0]!, target: { kind: 'enemy' }, additionalTarget }] }] }))).not.toThrow();
    }
    for (const [label, map, error] of [
      ['E1', { ...base, actions: [{ ...VALID_BATTLE_ACTIONS[0]!, target: { kind: 'self' }, additionalTarget: 'enemy' }] }, /additionalTarget 只允许用于 AG-1 Map/],
      ['unknown value', { ...base, executionContractId: 'AG-1', actions: [{ ...VALID_BATTLE_ACTIONS[0]!, target: { kind: 'self' }, additionalTarget: 'all' }] }, /partyCharacter 或 enemy/],
      ['self target', { ...base, executionContractId: 'AG-1', actions: [{ ...VALID_BATTLE_ACTIONS[0]!, target: { kind: 'self' }, additionalTarget: 'enemy' }] }, /requires a partyCharacter or enemy unit target/],
      ['none target', { ...base, executionContractId: 'AG-1', actions: [{ ...VALID_BATTLE_ACTIONS[0]!, target: { kind: 'none' }, additionalTarget: 'enemy' }] }, /requires a partyCharacter or enemy unit target/],
      ['card target', { ...base, executionContractId: 'AG-1', actions: [{ ...VALID_BATTLE_ACTIONS[0]!, target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] }, additionalTarget: 'enemy' }] }, /requires a partyCharacter or enemy unit target/],
    ] as const) {
      expect(() => new Registry().load(makeDatapack({ maps: [map as unknown as GameplayMapDef] })), label).toThrow(error);
    }
  });

  test.each([
    ['unknown execution contract', { executionContractId: 'AG-2' }, /executionContractId/],
    ['Action agility on an E1 Map', { actions: VALID_BATTLE_ACTIONS.map(action => action.id === 'strike' ? { ...action, agility: { base: 1, max: 2 } } : action) }, /agility 只允许用于 AG-1 Map/],
    ['Party agility on an E1 Map', { partyAgility: [{ characterId: TEST_CHARACTER_ID, agility: 1 }] }, /partyAgility 只允许用于 AG-1/],
    ['Enemy agility on an E1 Map', { nodes: VALID_BATTLE_MAP.nodes.map(node => node.id === 'middle' ? { ...node, encounter: { ...node.encounter!, enemies: [{ id: 'raider', initialHp: 8, maxHp: 10, agility: 1 }] } } : node) }, /agility 只允许用于 AG-1 Map/],
  ])('rejects $label', (_label, overrides, error) => {
    const map = { ...VALID_BATTLE_MAP, ...overrides } as unknown as GameplayMapDef;
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow(error);
  });

  test.each([
    ['missing max', { base: 1 }],
    ['extra field', { base: 1, max: 2, source: 3 }],
    ['negative base', { base: -1, max: 2 }],
    ['fractional maximum', { base: 1, max: 2.5 }],
    ['unsafe maximum', { base: 1, max: Number.MAX_SAFE_INTEGER + 1 }],
    ['base above maximum', { base: 3, max: 2 }],
  ])('rejects AG-1 Action agility with %s', (_label, agility) => {
    const action = { ...VALID_BATTLE_ACTIONS[0]!, agility };
    const map = { ...VALID_BATTLE_MAP, executionContractId: 'AG-1', actions: [action, ...VALID_BATTLE_ACTIONS.slice(1)] } as unknown as GameplayMapDef;
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow(/agility/);
  });

  test.each([
    ['duplicate party Character', [{ characterId: TEST_CHARACTER_ID, agility: 1 }, { characterId: TEST_CHARACTER_ID, agility: 2 }], /重复 Character/],
    ['outside fixed party', [{ characterId: TEST_CHARACTER_2.id, agility: 1 }], /必须属于 Map partyCharacterIds/],
    ['negative supplement', [{ characterId: TEST_CHARACTER_ID, agility: -1 }], /非负安全整数/],
    ['fractional supplement', [{ characterId: TEST_CHARACTER_ID, agility: 1.5 }], /非负安全整数/],
    ['unsafe supplement', [{ characterId: TEST_CHARACTER_ID, agility: Number.MAX_SAFE_INTEGER + 1 }], /非负安全整数/],
    ['extra field', [{ characterId: TEST_CHARACTER_ID, agility: 1, source: 2 }], /合同外字段/],
  ])('rejects AG-1 party agility with %s', (_label, partyAgility, error) => {
    const map = { ...VALID_BATTLE_MAP, executionContractId: 'AG-1', partyAgility } as unknown as GameplayMapDef;
    expect(() => new Registry().load(makeDatapack({ maps: [map], characters: [TEST_CHARACTER, TEST_CHARACTER_2] }))).toThrow(error);
  });

  test.each([
    ['negative value', -1],
    ['fractional value', 1.5],
    ['unsafe value', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects AG-1 Enemy agility with %s', (_label, agility) => {
    const map = {
      ...VALID_BATTLE_MAP,
      executionContractId: 'AG-1',
      nodes: VALID_BATTLE_MAP.nodes.map(node => node.id === 'middle'
        ? { ...node, encounter: { ...node.encounter!, enemies: [{ id: 'raider', initialHp: 8, maxHp: 10, agility }] } }
        : node),
    } as unknown as GameplayMapDef;
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow(/agility 必须是非负安全整数/);
  });

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

  test('accepts optional MapRun Facts and keeps their namespace separate from Encounter locals', () => {
    const map: GameplayMapDef = {
      ...VALID_MAP,
      mapRunFacts: {
        counters: [{ id: 'progress', initial: 2, min: 0, max: 5 }],
        flags: [{ id: 'opened', initial: false }],
      },
      nodes: VALID_MAP.nodes.map(node => node.id === 'middle'
        ? { ...node, encounter: { ...node.encounter!, locals: { counters: [{ id: 'progress', initial: 1, min: 0, max: 3 }] } } }
        : node),
    };
    const registry = new Registry();
    registry.load(makeDatapack({ maps: [map] }));
    expect(registry.maps.get(MAP_ID)?.mapRunFacts).toEqual(map.mapRunFacts);

    const legacyRegistry = new Registry();
    legacyRegistry.load(makeDatapack({ maps: [VALID_MAP] }));
    expect(legacyRegistry.maps.get(MAP_ID)?.mapRunFacts).toBeUndefined();
  });

  test.each([
    {
      label: 'duplicate Counter IDs',
      mapRunFacts: { counters: [
        { id: 'progress', initial: 0, min: 0, max: 1 },
        { id: 'progress', initial: 0, min: 0, max: 1 },
      ] },
      error: /含重复 Counter \/ Flag id "progress"/,
    },
    {
      label: 'duplicate Flag IDs',
      mapRunFacts: { flags: [{ id: 'opened', initial: false }, { id: 'opened', initial: true }] },
      error: /含重复 Counter \/ Flag id "opened"/,
    },
    {
      label: 'Counter and Flag IDs that collide',
      mapRunFacts: {
        counters: [{ id: 'shared', initial: 0, min: 0, max: 1 }],
        flags: [{ id: 'shared', initial: false }],
      },
      error: /含重复 Counter \/ Flag id "shared"/,
    },
    {
      label: 'Counter initial below min',
      mapRunFacts: { counters: [{ id: 'progress', initial: -1, min: 0, max: 1 }] },
      error: /min ≤ initial ≤ max/,
    },
    {
      label: 'Counter initial above max',
      mapRunFacts: { counters: [{ id: 'progress', initial: 2, min: 0, max: 1 }] },
      error: /min ≤ initial ≤ max/,
    },
    {
      label: 'unsafe Counter bounds',
      mapRunFacts: { counters: [{ id: 'progress', initial: 0, min: Number.MAX_SAFE_INTEGER + 1, max: Number.MAX_SAFE_INTEGER + 2 }] },
      error: /min ≤ initial ≤ max/,
    },
    {
      label: 'non-boolean Flag initial',
      mapRunFacts: { flags: [{ id: 'opened', initial: 0 }] },
      error: /initial 必须是 boolean/,
    },
    {
      label: 'blank Fact ID',
      mapRunFacts: { flags: [{ id: '  ', initial: false }] },
      error: /id 必须是非空字符串/,
    },
    {
      label: 'unknown MapRun Facts field',
      mapRunFacts: { counters: [], surprises: [] },
      error: /含合同外字段 "surprises"/,
    },
    {
      label: 'unknown Counter field',
      mapRunFacts: { counters: [{ id: 'progress', initial: 0, min: 0, max: 1, extra: true }] },
      error: /counters\[0\] 含合同外字段 "extra"/,
    },
    {
      label: 'unknown Flag field',
      mapRunFacts: { flags: [{ id: 'opened', initial: false, extra: true }] },
      error: /flags\[0\] 含合同外字段 "extra"/,
    },
    {
      label: 'more than 64 combined declarations',
      mapRunFacts: {
        counters: Array.from({ length: 33 }, (_, index) => ({ id: `c${index}`, initial: 0, min: 0, max: 1 })),
        flags: Array.from({ length: 32 }, (_, index) => ({ id: `f${index}`, initial: false })),
      },
      error: /Counter \/ Flag 总数不能超过 64/,
    },
  ] as Array<{ label: string; mapRunFacts: unknown; error: RegExp }>)('rejects invalid MapRun Facts: $label', ({ mapRunFacts, error }) => {
    const map = { ...VALID_MAP, mapRunFacts } as unknown as GameplayMapDef;
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow(error);
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
    target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] } };
  test('accepts a real card target and round-local scost discount definition', () => {
    const registry = new Registry();
    const map = mapWithActions([...VALID_MAP_ACTIONS, cardAction]);
    expect(() => registry.load(makeDatapack({ maps: [map] }))).not.toThrow();
  });
  test('accepts full Action TagRefs and nested candidate Pools without TagDef declarations', () => {
    const actions = VALID_MAP_ACTIONS.map(action => action.id === 'inspect'
      ? { ...action, tags: [tagRef('gameplay-b', ['action', 'explosive'])] }
      : action.id === 'focus'
        ? { ...action, tags: [tagRef('gameplay-b', ['action', 'explosive', 'fast'])] }
        : action);
    const map: GameplayMapDef = {
      ...mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [{ actionId: 'focus', tendencyWeight: 2 }],
        candidatePoolIds: ['explosive', 'repeat-explosive'],
      }]),
      actions,
      candidatePools: [
        {
          id: 'explosive',
          entries: [
            { kind: 'tag', tag: tagRef('gameplay-b', ['action', 'explosive']), weight: 3 },
            { kind: 'action', actionId: 'assist', weight: 1 },
          ],
        },
        {
          id: 'repeat-explosive',
          entries: [{ kind: 'pool', poolId: 'explosive', weight: 2 }],
        },
      ],
    };
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).not.toThrow();
    expect(resolveGameplayMapCandidateSources(map, [{ actionId: 'focus', tendencyWeight: 2 }], ['explosive', 'repeat-explosive']))
      .toEqual([
        { actionId: 'focus', tendencyWeight: 11 },
        { actionId: 'inspect', tendencyWeight: 9 },
        { actionId: 'assist', tendencyWeight: 3 },
      ]);
  });
  test('evaluates Fact-gated Pools from explicit runtime snapshots and separates all-potential validation', () => {
    const map: GameplayMapDef = {
      ...mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [],
        candidatePoolIds: ['root'],
      }]),
      executionContractId: 'AG-1',
      mapRunFacts: {
        counters: [{ id: 'wins', initial: 0, min: 0, max: 3 }],
        flags: [{ id: 'ready', initial: false }],
      },
      candidatePools: [
        { id: 'root', entries: [
          { kind: 'action', actionId: 'inspect', weight: 1 },
          { kind: 'pool', poolId: 'ready-pool', weight: 3 },
        ] },
        { id: 'ready-pool', gate: { kind: 'flag', flagId: 'ready', value: true }, entries: [
          { kind: 'pool', poolId: 'wins-pool', weight: 2 },
          { kind: 'action', actionId: 'assist', weight: 1 },
        ] },
        { id: 'wins-pool', gate: { kind: 'counter', counterId: 'wins', comparison: 'gt', value: 0 },
          entries: [{ kind: 'action', actionId: 'focus', weight: 4 }] },
      ],
    };
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).not.toThrow();

    expect(resolveGameplayMapCandidateSources(map, [], ['root'], {
      mode: 'runtime', mapRunFacts: { counters: [{ id: 'wins', value: 0 }], flags: [{ id: 'ready', value: false }] },
    })).toEqual([{ actionId: 'inspect', tendencyWeight: 1 }]);
    expect(resolveGameplayMapCandidateSources(map, [], ['root'], {
      mode: 'runtime', mapRunFacts: { counters: [{ id: 'wins', value: 0 }], flags: [{ id: 'ready', value: true }] },
    })).toEqual([
      { actionId: 'inspect', tendencyWeight: 1 },
      { actionId: 'assist', tendencyWeight: 3 },
    ]);
    expect(resolveGameplayMapCandidateSources(map, [], ['root'], {
      mode: 'runtime', mapRunFacts: { counters: [{ id: 'wins', value: 1 }], flags: [{ id: 'ready', value: true }] },
    })).toEqual([
      { actionId: 'inspect', tendencyWeight: 1 },
      { actionId: 'focus', tendencyWeight: 24 },
      { actionId: 'assist', tendencyWeight: 3 },
    ]);

    const comparisons = [
      { comparison: 'eq', value: 1 },
      { comparison: 'lt', value: 2 },
      { comparison: 'lte', value: 1 },
      { comparison: 'gt', value: 0 },
      { comparison: 'gte', value: 1 },
    ] as const;
    for (const gate of comparisons) {
      const comparisonMap: GameplayMapDef = {
        ...map,
        candidatePools: [{ id: 'comparison', gate: { kind: 'counter', counterId: 'wins', ...gate },
          entries: [{ kind: 'action', actionId: 'focus', weight: 1 }] }],
      };
      expect(resolveGameplayMapCandidateSources(comparisonMap, [], ['comparison'], {
        mode: 'runtime', mapRunFacts: { counters: [{ id: 'wins', value: 1 }], flags: [{ id: 'ready', value: false }] },
      })).toEqual([{ actionId: 'focus', tendencyWeight: 1 }]);
    }

    expect(resolveGameplayMapCandidateSources(map, [], ['root'], { mode: 'allPotentialSources' })).toEqual([
      { actionId: 'inspect', tendencyWeight: 1 },
      { actionId: 'focus', tendencyWeight: 24 },
      { actionId: 'assist', tendencyWeight: 3 },
    ]);
    expect(() => resolveGameplayMapCandidateSources(map, [], ['root'])).toThrow(/explicit runtime Fact snapshot/);
    expect(() => resolveGameplayMapCandidateSources(map, [], ['root'], { mode: 'runtime' }))
      .toThrow(/snapshot is required/);
    expect(() => resolveGameplayMapCandidateSources(map, [], ['root'], {
      mode: 'runtime', mapRunFacts: { counters: [], flags: [] },
    })).toThrow(/every declared Counter and Flag/);
  });
  test('rejects undeclared, mistyped, unknown, and non-AG-1 Pool gate contracts', () => {
    const base = {
      ...mapWithParticipants([{ characterId: TEST_CHARACTER_ID, actions: [], candidatePoolIds: ['gate'] }]),
      executionContractId: 'AG-1' as const,
      mapRunFacts: {
        counters: [{ id: 'wins', initial: 0, min: 0, max: 3 }],
        flags: [{ id: 'ready', initial: false }],
      },
    };
    const withGate = (gate: unknown, overrides: Partial<GameplayMapDef> = {}): GameplayMapDef => ({
      ...base,
      ...overrides,
      candidatePools: [{ id: 'gate', gate: gate as NonNullable<GameplayMapDef['candidatePools']>[number]['gate'],
        entries: [{ kind: 'action', actionId: 'inspect', weight: 1 }] }],
    });

    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'counter', counterId: 'missing', comparison: 'eq', value: 0,
    })] }))).toThrow(/undeclared MapRun Counter "missing"/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'counter', counterId: 'ready', comparison: 'eq', value: 0,
    })] }))).toThrow(/undeclared MapRun Counter "ready"/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'flag', flagId: 'wins', value: true,
    })] }))).toThrow(/undeclared MapRun Flag "wins"/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'other', flagId: 'ready', value: false,
    })] }))).toThrow(/kind must be counter or flag/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'counter', counterId: 'wins', comparison: 'near', value: 0,
    })] }))).toThrow(/comparison must be eq, lt, lte, gt, or gte/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'counter', counterId: 'wins', comparison: 'eq', value: Number.MAX_SAFE_INTEGER + 1,
    })] }))).toThrow(/value must be a safe integer/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'flag', flagId: 'ready', value: 1,
    })] }))).toThrow(/value must be a boolean/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'flag', flagId: 'ready', value: false, extra: true,
    })] }))).toThrow(/must contain exactly flagId, kind, value/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'counter', counterId: 'wins', comparison: 'eq', value: 0,
    }, { executionContractId: undefined })] }))).toThrow(/requires executionContractId AG-1/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'counter', counterId: 'wins', comparison: 'eq', value: 0,
    }, { executionContractId: 'E1-COMPAT-1' })] }))).toThrow(/requires executionContractId AG-1/);
    expect(() => new Registry().load(makeDatapack({ maps: [withGate({
      kind: 'flag', flagId: 'ready', value: false,
    }, { mapRunFacts: undefined })] }))).toThrow(/undeclared MapRun Flag "ready"/);
  });
  test('validates gated-only Action Effect contexts using all potentially enabled Pool sources', () => {
    const gatedOnly: NonNullable<GameplayMapDef['actions']>[number] = {
      id: 'gated-only', name: 'Gated Only', eligibleCharacterIds: [TEST_CHARACTER_ID], target: { kind: 'self' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'undeclared', delta: 1 }] },
    };
    const map: GameplayMapDef = {
      ...mapWithParticipants([{ characterId: TEST_CHARACTER_ID, actions: [], candidatePoolIds: ['gate'] }]),
      executionContractId: 'AG-1',
      mapRunFacts: { flags: [{ id: 'ready', initial: false }] },
      actions: [...VALID_MAP_ACTIONS, gatedOnly],
      candidatePools: [{ id: 'gate', gate: { kind: 'flag', flagId: 'ready', value: true },
        entries: [{ kind: 'action', actionId: 'gated-only', weight: 1 }] }],
    };
    expect(() => new Registry().load(makeDatapack({ maps: [map] }))).toThrow(/not declared for source party "shiroko"/);
  });
  test('rejects invalid TagRefs, Pool references, Pool cycles, duplicates, and unsafe accumulated weights', () => {
    const withPools = (candidatePools: unknown, candidatePoolIds: unknown = []): GameplayMapDef => ({
      ...mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [],
        candidatePoolIds,
      }]),
      candidatePools: candidatePools as GameplayMapDef['candidatePools'],
    });

    const invalidActionTag = mapWithActions([
      { ...VALID_MAP_ACTIONS[0], tags: ['invalid-tag-ref'] },
      ...VALID_MAP_ACTIONS.slice(1),
    ]);
    expect(() => new Registry().load(makeDatapack({ maps: [invalidActionTag] }))).toThrow(/tags\[0\] 必须是完整 TagRef/);

    expect(() => new Registry().load(makeDatapack({ maps: [withPools([
      { id: 'bad-tag', entries: [{ kind: 'tag', tag: 'invalid-tag-ref', weight: 1 }] },
    ])] }))).toThrow(/entries\[0\]\.tag 必须是完整 TagRef/);

    expect(() => new Registry().load(makeDatapack({ maps: [withPools([
      { id: 'bad-action', entries: [{ kind: 'action', actionId: 'missing', weight: 1 }] },
    ])] }))).toThrow(/引用了 Map .*未定义的 Action "missing"/);

    expect(() => new Registry().load(makeDatapack({ maps: [withPools([
      { id: 'bad-pool', entries: [{ kind: 'pool', poolId: 'missing', weight: 1 }] },
    ])] }))).toThrow(/引用了 Map .*未定义的 candidate Pool "missing"/);

    expect(() => new Registry().load(makeDatapack({ maps: [withPools([
      { id: 'first', entries: [{ kind: 'pool', poolId: 'second', weight: 1 }] },
      { id: 'second', entries: [{ kind: 'pool', poolId: 'first', weight: 1 }] },
    ])] }))).toThrow(/candidate Pool reference cycle/);

    expect(() => new Registry().load(makeDatapack({ maps: [withPools([
      { id: 'duplicate', entries: [] },
      { id: 'duplicate', entries: [] },
    ])] }))).toThrow(/重复 candidate Pool id "duplicate"/);

    expect(() => new Registry().load(makeDatapack({ maps: [withPools([
      { id: 'inspect', entries: [{ kind: 'action', actionId: 'inspect', weight: 1 }] },
    ], ['inspect', 'inspect'])] }))).toThrow(/candidatePoolIds 含重复 Pool ID "inspect"/);

    const overflowMap = {
      ...mapWithParticipants([{
        characterId: TEST_CHARACTER_ID,
        actions: [{ actionId: 'inspect', tendencyWeight: Number.MAX_SAFE_INTEGER }],
        candidatePoolIds: ['one-more'],
      }]),
      candidatePools: [{ id: 'one-more', entries: [{ kind: 'action', actionId: 'inspect', weight: 1 }] }],
    } as GameplayMapDef;
    expect(() => new Registry().load(makeDatapack({ maps: [overflowMap] })))
      .toThrow(/accumulated candidate weight exceeds Number\.MAX_SAFE_INTEGER/);

    const multiplyOverflowMap = withPools([
      { id: 'large', entries: [{ kind: 'action', actionId: 'inspect', weight: Number.MAX_SAFE_INTEGER }] },
      { id: 'double', entries: [{ kind: 'pool', poolId: 'large', weight: 2 }] },
    ], ['double']);
    expect(() => new Registry().load(makeDatapack({ maps: [multiplyOverflowMap] })))
      .toThrow(/multiplied candidate weight exceeds Number\.MAX_SAFE_INTEGER/);
  });
  test('accepts unit target preferences and stable card preference', () => {
    const registry = new Registry();
    const map = mapWithActions([
      ...VALID_MAP_ACTIONS,
      { id: 'attack-pref', name: 'Attack Preference', eligibleCharacterIds: [TEST_CHARACTER_ID],
        target: { kind: 'enemy', preference: 'lowestHpRatio' } },
      { id: 'heal-pref', name: 'Healing Preference', eligibleCharacterIds: [TEST_CHARACTER_ID],
        target: { kind: 'partyCharacter', preference: 'highestMissingHpRatio' } },
      { id: 'party-low-pref', name: 'Party Lowest HP Preference', eligibleCharacterIds: [TEST_CHARACTER_ID],
        target: { kind: 'partyCharacter', preference: 'lowestHpRatio' } },
      { id: 'enemy-missing-pref', name: 'Enemy Missing HP Preference', eligibleCharacterIds: [],
        target: { kind: 'enemy', preference: 'highestMissingHpRatio' } },
      { ...cardAction, target: { kind: 'card', side: 'ally', preference: 'stableOrder' } },
    ]);
    expect(() => registry.load(makeDatapack({ maps: [map] }))).not.toThrow();
  });
  test('accepts the finite explicit tendencyRole values when compatible with the candidate actor side', () => {
    const actions = [
      ...VALID_MAP_ACTIONS,
      ...VALID_BATTLE_ACTIONS,
      { id: 'recovery', name: 'Recovery', eligibleCharacterIds: [TEST_CHARACTER_ID],
        target: { kind: 'partyCharacter' }, tendencyRole: 'recovery' },
      { id: 'defense', name: 'Defense', eligibleCharacterIds: [TEST_CHARACTER_ID],
        target: { kind: 'self' }, tendencyRole: 'defense' },
      { id: 'attack', name: 'Attack', eligibleCharacterIds: [TEST_CHARACTER_ID],
        target: { kind: 'enemy' }, tendencyRole: 'attack' },
      { id: 'enemy-attack', name: 'Enemy Attack', eligibleCharacterIds: [],
        target: { kind: 'partyCharacter' }, tendencyRole: 'attack' },
      { id: 'enemy-recovery', name: 'Enemy Recovery', eligibleCharacterIds: [],
        target: { kind: 'enemy' }, tendencyRole: 'recovery' },
    ];
    const map = {
      ...battleMapWithPools(actions, [{
      characterId: TEST_CHARACTER_ID,
      actions: ['inspect', 'focus', 'assist', 'recovery', 'defense', 'attack']
        .map(actionId => ({ actionId, tendencyWeight: 1 })),
    }], [{
      id: 'raider', initialHp: 8, maxHp: 10,
      actions: ['enemy-attack', 'enemy-recovery'].map(actionId => ({ actionId, tendencyWeight: 1 })),
      }]),
      initialActorResources: [
        { characterId: TEST_CHARACTER_ID, resourceId: 'stamina', value: 2 },
        { characterId: TEST_CHARACTER_ID, resourceId: 'focus', value: 0 },
      ],
      initialTeamResources: [{ resourceId: 'clues', value: 0 }, { resourceId: 'supplies', value: 1 }],
    };
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).not.toThrow();
  });
  test('accepts Enemy-owned Action pools and Encounter-local Actor / Team resources', () => {
    const actions = [
      ...VALID_BATTLE_ACTIONS,
      {
        id: 'enemy-attack', name: 'Enemy Attack', eligibleCharacterIds: [],
        target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
        effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
      },
      {
        id: 'enemy-aid', name: 'Enemy Aid', eligibleCharacterIds: [],
        target: { kind: 'enemy', preference: 'highestMissingHpRatio' }, tendencyRole: 'recovery',
        costs: [
          { scope: 'actor', resourceId: 'focus', amount: 1 },
          { scope: 'team', resourceId: 'supplies', amount: 1 },
        ],
        effectProgram: { resolve: [
          { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
          { op: 'heal', target: 'primary', amount: 2 },
        ] },
      },
    ];
    const map = battleMapWithPools(actions, [], [
      {
        id: 'raider', initialHp: 8, maxHp: 10,
        actions: [
          { actionId: 'enemy-attack', tendencyWeight: 3 },
          { actionId: 'enemy-aid', tendencyWeight: 1 },
        ],
        initialResources: [{ resourceId: 'focus', value: 2 }],
      },
      { id: 'scout', initialHp: 5, maxHp: 5, actions: [], initialResources: [{ resourceId: 'focus', value: 0 }] },
    ], {
      initialEnemyTeamResources: [{ resourceId: 'supplies', value: 3 }],
    });
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).not.toThrow();
  });
  test.each([
    {
      label: 'Enemy attack aimed at Enemy',
      action: { id: 'enemy-action', name: 'Enemy Action', eligibleCharacterIds: [], target: { kind: 'enemy' }, tendencyRole: 'attack' },
    },
    {
      label: 'Enemy recovery aimed at Character',
      action: { id: 'enemy-action', name: 'Enemy Action', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, tendencyRole: 'recovery' },
    },
  ])('rejects $label', ({ action }) => {
    const map = battleMapWithPools([...VALID_BATTLE_ACTIONS, action], [], [
      { id: 'raider', initialHp: 8, maxHp: 10, actions: [{ actionId: 'enemy-action', tendencyWeight: 1 }] },
    ]);
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(/tendencyRole.*Enemy target/);
  });
  test('rejects malformed Enemy candidates and duplicate Encounter-local resources', () => {
    const enemyAction = { id: 'enemy-action', name: 'Enemy Action', eligibleCharacterIds: [], target: { kind: 'partyCharacter' } };
    const invalidCandidateMap = battleMapWithPools([...VALID_BATTLE_ACTIONS, enemyAction], [], [
      { id: 'raider', initialHp: 8, maxHp: 10, actions: [{ actionId: 'unknown', tendencyWeight: 1 }] },
    ]);
    expect(() => loadMap(invalidCandidateMap)).toThrow(/enemies\[0\]\.actions.*未定义的 Action/);

    const duplicateResourceMap = battleMapWithPools([...VALID_BATTLE_ACTIONS, enemyAction], [], [
      {
        id: 'raider', initialHp: 8, maxHp: 10,
        actions: [{ actionId: 'enemy-action', tendencyWeight: 1 }],
        initialResources: [
          { resourceId: 'focus', value: 1 },
          { resourceId: 'focus', value: 2 },
        ],
      },
    ]);
    expect(() => loadMap(duplicateResourceMap)).toThrow(/initialResources 含重复 resourceId/);
  });
  test.each([
    {
      label: 'duplicate Action candidates',
      actions: [
        { actionId: 'enemy-action', tendencyWeight: 1 },
        { actionId: 'enemy-action', tendencyWeight: 2 },
      ],
      error: /enemies\[0\]\.actions 含重复 Action id/,
    },
    {
      label: 'non-positive Tendency weight',
      actions: [{ actionId: 'enemy-action', tendencyWeight: 0 }],
      error: /tendencyWeight 必须是正安全整数/,
    },
  ])('rejects Enemy $label', ({ actions: candidates, error }) => {
    const enemyAction = { id: 'enemy-action', name: 'Enemy Action', eligibleCharacterIds: [], target: { kind: 'partyCharacter' } };
    const map = battleMapWithPools([...VALID_BATTLE_ACTIONS, enemyAction], [], [
      { id: 'raider', initialHp: 8, maxHp: 10, actions: candidates },
    ]);
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(error);
  });
  test('rejects duplicate Enemy Team resource balances', () => {
    const map = battleMapWithPools(VALID_BATTLE_ACTIONS, [], VALID_BATTLE_ENCOUNTER.enemies, {
      initialEnemyTeamResources: [
        { resourceId: 'supplies', value: 1 },
        { resourceId: 'supplies', value: 2 },
      ],
    });
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(/initialEnemyTeamResources 含重复 resourceId/);
  });
  test('does not treat an Enemy-pool Action as an actorless Ability or Item Action', () => {
    const enemyAction = { id: 'enemy-action', name: 'Enemy Action', eligibleCharacterIds: [], target: { kind: 'partyCharacter' } };
    const map = battleMapWithPools([...VALID_BATTLE_ACTIONS, enemyAction], [], [
      { id: 'raider', initialHp: 8, maxHp: 10, actions: [{ actionId: 'enemy-action', tendencyWeight: 1 }] },
    ], { abilityActionIds: ['enemy-action'] });
    expect(() => loadMap(map)).toThrow(/已属于 Enemy 行动池，不能作为 Ability \/ Item 来源/);
  });
  test.each([
    { id: 'unknown-role', name: 'Unknown Role', eligibleCharacterIds: [TEST_CHARACTER_ID],
      target: { kind: 'enemy' }, tendencyRole: 'support' },
    { id: 'attack-party', name: 'Attack Party', eligibleCharacterIds: [TEST_CHARACTER_ID],
      target: { kind: 'partyCharacter' }, tendencyRole: 'attack' },
    { id: 'recovery-enemy', name: 'Recovery Enemy', eligibleCharacterIds: [TEST_CHARACTER_ID],
      target: { kind: 'enemy' }, tendencyRole: 'recovery' },
    { id: 'recovery-card', name: 'Recovery Card', eligibleCharacterIds: [TEST_CHARACTER_ID],
      target: { kind: 'card', side: 'ally' }, tendencyRole: 'recovery',
      effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] } },
  ])('rejects invalid tendencyRole configuration %#', action => {
    if (action.id === 'unknown-role') {
      expect(() => loadMap(mapWithActions([...VALID_MAP_ACTIONS, action]))).toThrow(/tendencyRole/);
      return;
    }
    const map = battleMapWithPools([...VALID_BATTLE_ACTIONS, action], [{
      characterId: TEST_CHARACTER_ID,
      actions: [{ actionId: action.id, tendencyWeight: 1 }],
    }]);
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(/tendencyRole/);
  });
  test.each([
    { id: 'bad-card-pref', name: 'Bad Card Preference', eligibleCharacterIds: [TEST_CHARACTER_ID],
      target: { kind: 'card', side: 'ally', preference: 'lowestHpRatio' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] } },
    { id: 'bad-none-pref', name: 'Bad None Preference', eligibleCharacterIds: [TEST_CHARACTER_ID],
      target: { kind: 'none', preference: 'stableOrder' } },
    { id: 'unknown-pref', name: 'Unknown Preference', eligibleCharacterIds: [TEST_CHARACTER_ID],
      target: { kind: 'enemy', preference: 'random' } },
  ])('rejects an invalid target preference %#', action => {
    expect(() => loadMap(mapWithActions([...VALID_MAP_ACTIONS, action]))).toThrow(/target.preference 与 target.kind 不兼容/);
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

  test('accepts effectProgram Actions and keeps Shop Offer effects in their separate contract', () => {
    const shopMap: GameplayMapDef = {
      ...VALID_BATTLE_MAP,
      initialTeamResources: [{ resourceId: 'supplies', value: 2 }],
      nodes: VALID_MAP.nodes.map(node => node.id !== 'middle' ? node : {
        id: node.id, title: node.title,
        activities: [{ id: 'market', shop: { offers: [{
          id: 'supply-pack', name: 'Supply Pack', costs: [{ resourceId: 'supplies', amount: 1 }],
          effects: [{ resourceId: 'supplies', amount: 2 }],
        }] } }],
      }),
    };
    const registry = loadMap(shopMap, [TEST_CHARACTER], [TEST_MEDKIT]);
    expect(registry.maps.get(MAP_ID)?.actions?.some(action => action.effectProgram?.resolve?.some(row => row.op === 'damage' || row.op === 'heal'))).toBe(true);
    const market = registry.maps.get(MAP_ID)?.nodes.find(node => node.id === 'middle')?.activities?.[0];
    expect(market?.shop?.offers[0]?.effects).toEqual([{ resourceId: 'supplies', amount: 2 }]);
  });

  test.each(['effects', 'hpEffects', 'cardEffects'] as const)(
    'rejects raw Action field %s in both first-party load and imported-pack validation', field => {
      const invalidAction = { ...VALID_MAP_ACTIONS[0], [field]: [] };
      const invalidMap = mapWithActions([invalidAction, ...VALID_MAP_ACTIONS.slice(1)]);
      const importedRegistry = new Registry();
      importedRegistry.load(makeDatapack({ maps: [] }));
      expect(() => new Registry().load(makeDatapack({ maps: [invalidMap] })))
        .toThrow(new RegExp(`actions\\[0\\] 含合同外字段 "${field}"`));
      expect(() => importedRegistry.validate(makeDatapack({ maps: [invalidMap] })))
        .toThrow(new RegExp(`actions\\[0\\] 含合同外字段 "${field}"`));
    },
  );

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
          { id: 'raider', initialHp: 8, maxHp: 10 },
          { id: 'raider', initialHp: 3, maxHp: 3 },
        ],
      }),
      items: [TEST_MEDKIT],
      error: /含重复 Enemy ID "raider"/,
    },
    {
      label: 'non-positive Enemy max HP',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 1, maxHp: 0 }],
      }),
      items: [TEST_MEDKIT],
      error: /maxHp 必须是正安全整数/,
    },
    {
      label: 'Enemy initial HP outside its bounds',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 11, maxHp: 10 }],
      }),
      items: [TEST_MEDKIT],
      error: /initialHp 必须在 1\.\.maxHp 范围内/,
    },
    {
      label: 'zero Enemy initial HP',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 0, maxHp: 10 }],
      }),
      items: [TEST_MEDKIT],
      error: /initialHp 必须在 1\.\.maxHp 范围内/,
    },
    {
      label: 'legacy fixed Enemy damage field',
      map: battleMapWithEncounter({
        ...VALID_BATTLE_ENCOUNTER,
        enemies: [{ id: 'raider', initialHp: 8, maxHp: 10, damage: 2 }],
      }),
      items: [TEST_MEDKIT],
      error: /enemies\[0\].*合同外字段 "damage"/,
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
        target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
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
        effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
      },
      error: /actorless Ability \/ Item cannot reference sourceActor/,
    },
  ])('rejects Ability / Item Actions with $label', ({ action, error }) => {
    expect(() => loadMap(battleMapWithAbilityAction(action), [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(error);
  });

  test.each([
    { label: 'a zero HP change', amount: 0, target: 'enemy', error: /effectProgram/ },
    { label: 'an HP change larger than a safe integer', amount: Number.MAX_SAFE_INTEGER + 1, target: 'enemy', error: /effectProgram/ },
    { label: 'an HP effect with no selected target', amount: -1, target: 'none', error: /primary requires a possible unit target/ },
  ])('rejects $label', ({ amount, target, error }) => {
    const actions = VALID_BATTLE_ACTIONS.map(action => action.id === 'strike'
      ? { ...action, target: { kind: target } as NonNullable<GameplayMapDef['actions']>[number]['target'],
        effectProgram: { resolve: [{ op: 'hpChange' as const, target: 'primary' as const, delta: amount }] } }
      : action);
    const map = battleMapWithEncounter(VALID_BATTLE_ENCOUNTER, actions);
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).toThrow(error);
  });
  test('allows damage and heal primitives to address either legal unit collection', () => {
    const actions = [
      ...VALID_BATTLE_ACTIONS,
      { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
        effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
      { id: 'enemy-heal', name: 'Enemy Heal', eligibleCharacterIds: [], target: { kind: 'enemy' },
        effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 1 }] } },
    ];
    const map = battleMapWithPools(actions, [], [{
      id: 'raider', initialHp: 8, maxHp: 10,
      actions: [
        { actionId: 'enemy-hit', tendencyWeight: 1 },
        { actionId: 'enemy-heal', tendencyWeight: 1 },
      ],
    }]);
    expect(() => loadMap(map, [TEST_CHARACTER], [TEST_MEDKIT])).not.toThrow();
  });

  test('allows empty candidate lists and omitted participants for Wait encounters', () => {
    expect(() => loadMap(mapWithParticipants([{ characterId: TEST_CHARACTER_ID, actions: [] }]))).not.toThrow();
    expect(() => loadMap({ ...VALID_MAP, actions: [] })).not.toThrow();
  });

  test('loads the normal Gameplay B Datapack sample with two fixed party members', () => {
    const maps = gameplayBMapDatapack.maps ?? [];
    const expectedResumeVersions: Readonly<Record<string, number>> = {
      'gameplay-b:map:field-investigation': 4,
      'gameplay-b:map:minimal-battle': 5,
      'gameplay-b:map:linear-battle': 4,
      'gameplay-b:map:activity-hall': 4,
      'gameplay-b:map:forked-route': 4,
      'gameplay-b:map:continuous-conditional': 4,
      'gameplay-b:map:scost-training': 4,
      'gameplay-b:map:autonomous-target-battle': 4,
      'gameplay-b:map:effect-program-example': 4,
      'gameplay-b:map:status-example': 4,
      'gameplay-b:map:prepared-tag-combo': 1,
      'gameplay-b:map:fact-gated-pool-example': 7,
      'gameplay-b:map:card-modifier-example': 7,
      'gameplay-b:map:shield-example': 1,
      'gameplay-b:map:revive-example': 1,
      'gameplay-b:map:damage-reduction-example': 1,
      'gameplay-b:map:heal-applied-resource-example': 1,
      'gameplay-b:map:damage-applied-resource-example': 1,
      'gameplay-b:map:actual-amount-threshold-example': 1,
      'gameplay-b:map:status-expiry-reward-example': 1,
      'gameplay-b:map:damage-protection-example': 1,
      'gameplay-b:map:enemy-defeated-reward-example': 1,
      'gameplay-b:map:maprun-status-example': 1,
    };
    const registries = maps.map(mapDefinition => {
      expect(expectedResumeVersions[mapDefinition.id], mapDefinition.id).toBeDefined();
      expect(mapDefinition.resumeVersion, mapDefinition.id).toBe(expectedResumeVersions[mapDefinition.id]);
      for (const action of mapDefinition.actions ?? []) {
        expect(action).not.toHaveProperty('effects');
        expect(action).not.toHaveProperty('hpEffects');
        expect(action).not.toHaveProperty('cardEffects');
      }
      const registry = loadMap(mapDefinition as GameplayMapDef, [TEST_CHARACTER, TEST_CHARACTER_2], [TEST_MEDKIT]);
      expect(registry.maps.get(mapDefinition.id)).toEqual(mapDefinition);
      return registry;
    });
    const registry = registries[0]!;
    const map = registry.maps.get('gameplay-b:map:field-investigation');
    expect(map?.partyCharacterIds).toEqual(['shiroko', 'serika']);
    expect(map?.actions).toHaveLength(3);
    expect(map?.initialActorResources).toHaveLength(4);
    expect(map?.initialTeamResources).toEqual([
      { resourceId: 'clues', value: 0 },
      { resourceId: 'supplies', value: 1 },
    ]);
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
      label: 'legacy Action effects field',
      map: mapWithActions([
        { ...VALID_MAP_ACTIONS[0], effects: [{ scope: 'team', resourceId: 'clues', amount: 1, eventId: 'old-event' }] },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /actions\[0\] 含合同外字段 "effects"/,
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
        { ...VALID_MAP_ACTIONS[0], effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 0 }] } },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /effectProgram/,
    },
    {
      label: 'target resource effect with no target',
      map: mapWithActions([
        {
          ...VALID_MAP_ACTIONS[0],
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 }] },
        },
        ...VALID_MAP_ACTIONS.slice(1),
      ]),
      error: /primaryActor requires a possible unit target/,
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
