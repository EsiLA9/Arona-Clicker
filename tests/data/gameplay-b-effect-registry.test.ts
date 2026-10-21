import { describe, expect, test } from 'vitest';
import type { Datapack, GameplayMapDef } from '../../src/data-services';
import { Registry } from '../../src/data-services/registry/registry';
import { validateGameplayMapEffectContext } from '../../src/data-services/validation/gameplay-map-effect-context';
import { MapRunService } from '../../src/arona-clicker/services/map-run-service';
import type { MapContentResolver } from '../../src/arona-clicker/contracts/map-content-resolver';

const ITEM = {
  id: 'test:item:tonic', name: 'Tonic', description: '', maxStack: 5, rarity: 'common' as const, type: 'consumable' as const,
};
const characters: NonNullable<Datapack['characters']> = ['shiroko', 'serika'].map(id => ({
  id, name: id, displayName: id, school: 'Abydos', rarity: 'super_rare', description: '',
}));
const baseAction: NonNullable<GameplayMapDef['actions']>[number] = { id: 'observe', name: 'Observe', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' } };
const baseMap: GameplayMapDef = {
  id: 'test:map:effects', name: 'Effect Registry', resumeVersion: 1,
  startNodeId: 'start', exitNodeIds: ['exit'], partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 8, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [baseAction],
  nodes: [
    { id: 'start', title: 'Start' },
    { id: 'middle', title: 'Encounter', encounter: {
      title: 'Talk', completion: { kind: 'manual', label: 'Finish' },
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }],
    } },
    { id: 'exit', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'start', toNodeId: 'middle' }, { fromNodeId: 'middle', toNodeId: 'exit' }],
};

function datapack(map: GameplayMapDef): Datapack {
  return {
    name: 'effect registry tests', version: '1.0.0', modName: 'test',
    inits: [{ id: 'test:init:init', name: 'Init', description: '', defaultAreas: ['test:area:area'] }],
    areas: [{ id: 'test:area:area', initId: 'test:init:init', name: 'Area', description: '', defaultSpots: ['test:spot:entry'] }],
    spots: [{ id: 'test:spot:entry', areaId: 'test:area:area', name: 'Entry', description: '', purchaseOptions: [{ id: 'free', costs: [] }], tags: [] }],
    enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [ITEM], funcletDefs: [], characters, maps: [map],
  };
}
function load(map: GameplayMapDef): Registry {
  const registry = new Registry(); registry.load(datapack(map)); return registry;
}
function withActions(actions: unknown, changes: Partial<GameplayMapDef> = {}): GameplayMapDef {
  return { ...baseMap, ...changes, actions: actions as GameplayMapDef['actions'] };
}
function withEncounter(encounter: unknown, actions: unknown = [baseAction]): GameplayMapDef {
  return withActions(actions, { nodes: baseMap.nodes.map(node => node.id === 'middle' ? { ...node, encounter: encounter as GameplayMapDef['nodes'][number]['encounter'] } : node) });
}
function actorlessAction(id: string, target: unknown, effectProgram: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, name: id, eligibleCharacterIds: [], target, effectProgram, ...extra };
}

describe('Gameplay B E1 Registry context', () => {
  test('loads a legal program across party, Enemy, Ability, Item and card-prepare contexts', () => {
    const localCondition = { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 1 };
    const actions = [
      { id: 'party', name: 'Party', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' }, effectProgram: { resolve: [
        { op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: -1 },
        { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'signal', delta: 1 },
        { op: 'when', condition: localCondition, then: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }], else: [{ op: 'flagSet', flagId: 'seen', value: true }] },
      ] } },
      { id: 'enemy', name: 'Enemy', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, effectProgram: { resolve: [
        { op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: -1 },
        { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'signal', delta: 1 },
      ] } },
      actorlessAction('ability', { kind: 'enemy' }, { resolve: [{ op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 }, { op: 'resourceChange', account: 'sourceTeam', resourceId: 'signal', delta: 1 }] }),
      actorlessAction('item', { kind: 'partyCharacter' }, { resolve: [{ op: 'hpChange', target: 'primary', delta: 1 }, { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 }] }),
      { id: 'prepare', name: 'Prepare', eligibleCharacterIds: ['shiroko'], target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] } },
    ];
    const battle = {
      title: 'Battle',
      locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 3 }], flags: [{ id: 'seen', initial: false }] },
      enemies: [{ id: 'raider', initialHp: 4, maxHp: 5, initialResources: [{ resourceId: 'focus', value: 0 }], actions: [{ actionId: 'enemy', tendencyWeight: 1 }] }],
      initialEnemyTeamResources: [{ resourceId: 'signal', value: 0 }],
      abilityActionIds: ['ability'], itemActions: [{ itemId: ITEM.id, actionId: 'item' }],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'party', tendencyWeight: 1 }, { actionId: 'prepare', tendencyWeight: 1 }] }],
    };
    const map = withEncounter(battle, actions);
    const withBalances: GameplayMapDef = {
      ...map,
      initialActorResources: [
        { characterId: 'shiroko', resourceId: 'focus', value: 0 },
        { characterId: 'serika', resourceId: 'focus', value: 0 },
      ],
      initialTeamResources: [{ resourceId: 'signal', value: 0 }],
    };
    expect(() => load(withBalances)).not.toThrow();
  });

  test('requires complete per-identity resources and does not mix party and Enemy balances', () => {
    const program = { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'shared', delta: 1 }] };
    const action = { id: 'actor', name: 'Actor', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' }, effectProgram: program };
    const encounter = { title: 'Talk', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'actor', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'actor', tendencyWeight: 1 }] },
    ] };
    const map = withEncounter(encounter, [action]);
    expect(() => load({ ...map, initialActorResources: [{ characterId: 'shiroko', resourceId: 'shared', value: 0 }] }))
      .toThrow(/source party "serika"/);

    const enemyAction = { id: 'enemy-source', name: 'Enemy', eligibleCharacterIds: [], target: { kind: 'none' }, effectProgram: program };
    const battle = { title: 'Battle', enemies: [
      { id: 'e1', initialHp: 2, maxHp: 2, initialResources: [{ resourceId: 'shared', value: 0 }], actions: [{ actionId: 'enemy-source', tendencyWeight: 1 }] },
      { id: 'e2', initialHp: 2, maxHp: 2, actions: [{ actionId: 'enemy-source', tendencyWeight: 1 }] },
    ] };
    expect(() => load(withEncounter(battle, [enemyAction]))).toThrow(/source enemy "e2"/);

    const primaryAction = { id: 'primary', name: 'Primary', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' }, effectProgram: {
      resolve: [{ op: 'resourceChange', account: 'primaryActor', resourceId: 'shared', delta: 1 }],
    } };
    const primaryBattle = { title: 'Battle', enemies: [
      { id: 'e1', initialHp: 2, maxHp: 2, initialResources: [{ resourceId: 'shared', value: 0 }] },
      { id: 'e2', initialHp: 2, maxHp: 2 },
    ], participants: [{ characterId: 'shiroko', actions: [{ actionId: 'primary', tendencyWeight: 1 }] }] };
    expect(() => load(withEncounter(primaryBattle, [primaryAction]))).toThrow(/possible primary enemy "e2"/);
  });

  test('checks every branch and each direct or activity Encounter independently', () => {
    const action = { ...baseAction, effectProgram: { resolve: [{ op: 'when', condition: { kind: 'flag', flagId: 'known', value: true }, then: [], else: [{ op: 'counterAdd', counterId: 'missing', delta: 1 }] }] } };
    const direct = { title: 'Direct', locals: { flags: [{ id: 'known', initial: false }] }, participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] };
    const map = withEncounter(direct, [action]);
    expect(() => load(map)).toThrow(/else\[0\]\.counterId/);

    const nodes = baseMap.nodes.map(node => node.id === 'middle' ? { id: 'middle', title: 'Activities', activities: [
      { id: 'first', encounter: { ...direct, locals: { flags: [{ id: 'known', initial: false }], counters: [{ id: 'missing', initial: 0, min: 0, max: 1 }] } } },
      { id: 'second', encounter: direct },
    ] } : node);
    const activityMap = withActions([action], { nodes });
    expect(() => load(activityMap)).toThrow(/activities\[1\].*else\[0\]\.counterId/);
  });

  test('rejects primary identity on none/card and rejects mixing even empty legacy arrays', () => {
    const nonePrimary = { ...baseAction, effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: 1 }] } };
    expect(() => load(withEncounter({ title: 'No target', participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] }, [nonePrimary])))
      .toThrow(/primary requires a possible unit target/);
    const cardPrimary = { ...baseAction, target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: [{ op: 'resourceChange', account: 'primaryActor', resourceId: 'x', delta: 1 }] } };
    expect(() => load(withEncounter({ title: 'Card', participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] }, [cardPrimary])))
      .toThrow(/primaryActor requires a possible unit target/);
    const mixed = { ...baseAction, effects: [], effectProgram: { resolve: [{ op: 'flagSet', flagId: 'x', value: true }] } };
    expect(() => load(withEncounter({ title: 'Mixed', locals: { flags: [{ id: 'x', initial: false }] }, participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] }, [mixed])))
      .toThrow(/cannot be combined with legacy/);
    const unknown = { ...baseAction, effectProgram: { resolve: [{ op: 'flagSet', flagId: 'x', value: true, unexpected: 1 }] } };
    expect(() => load(withEncounter({ title: 'Unknown', locals: { flags: [{ id: 'x', initial: false }] }, participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] }, [unknown])))
      .toThrow(/effectProgram\.resolve\[0\]\.unexpected/);
  });

  test('allows legacy and E1 Action definitions to coexist within one Map', () => {
    const program = { ...baseAction, effectProgram: { resolve: [{ op: 'flagSet', flagId: 'ready', value: true }] } };
    const legacy = { id: 'legacy', name: 'Legacy', eligibleCharacterIds: ['serika'], target: { kind: 'none' }, effects: [{ scope: 'team', resourceId: 'clues', amount: 1 }] };
    const encounter = { title: 'Mixed Map', locals: { flags: [{ id: 'ready', initial: false }] }, participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'legacy', tendencyWeight: 1 }] },
    ] };
    const map = withEncounter(encounter, [program, legacy]);
    expect(() => load({ ...map, initialTeamResources: [{ resourceId: 'clues', value: 0 }] })).not.toThrow();
  });

  test('accepts prepare in place of cardEffects and rejects actorless costs/source access', () => {
    const card = { id: 'card', name: 'Card', eligibleCharacterIds: ['shiroko'], target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 2 }] } };
    expect(() => load(withEncounter({ title: 'Prepare', participants: [{ characterId: 'shiroko', actions: [{ actionId: 'card', tendencyWeight: 1 }] }] }, [card]))).not.toThrow();
    const emptyPrepare = { ...baseAction, effectProgram: { prepare: [], resolve: [{ op: 'flagSet', flagId: 'ready', value: true }] } };
    expect(() => load(withEncounter({ title: 'No discount', locals: { flags: [{ id: 'ready', initial: false }] }, participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] }, [emptyPrepare]))).not.toThrow();
    const ability = actorlessAction('ability', { kind: 'enemy' }, { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'x', delta: 1 }] });
    expect(() => load(withEncounter({ title: 'Battle', enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1 }], abilityActionIds: ['ability'] }, [ability]))).toThrow(/actorless Ability \/ Item cannot reference sourceActor/);
    const sourceCondition = actorlessAction('ability', { kind: 'enemy' }, { resolve: [{
      op: 'when', condition: { kind: 'hpAtLeast', target: 'source', value: 1 }, then: [],
    }] });
    expect(() => load(withEncounter({ title: 'Battle', enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1 }], abilityActionIds: ['ability'] }, [sourceCondition])))
      .toThrow(/actorless Ability \/ Item cannot reference source HP/);
    const costed = actorlessAction('ability', { kind: 'enemy' }, { resolve: [] }, { costs: [{ scope: 'team', resourceId: 'x', amount: 1 }] });
    expect(() => load(withEncounter({ title: 'Battle', enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1 }], abilityActionIds: ['ability'] }, [costed]))).toThrow(/不允许额外 Action cost/);
  });

  test('the shared context helper independently enforces actorless eligibility, target and cost rules', () => {
    const contextMap = (action: Record<string, unknown>) => ({
      id: 'test:map:direct-helper', partyCharacterIds: ['shiroko'], actions: [action],
      nodes: [{ id: 'battle', encounter: { title: 'Battle', enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1 }], abilityActionIds: ['ability'] } }],
    });
    const none = actorlessAction('ability', { kind: 'none' }, { resolve: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }] });
    expect(validateGameplayMapEffectContext(contextMap(none)).map(issue => issue.message).join(' ')).toMatch(/requires a partyCharacter or enemy unit target/);
    const extraCost = actorlessAction('ability', { kind: 'enemy' }, { resolve: [] }, { costs: [{ scope: 'team', resourceId: 'x', amount: 1 }] });
    expect(validateGameplayMapEffectContext(contextMap(extraCost)).map(issue => issue.message).join(' ')).toMatch(/requires costs to be omitted or an empty array/);
    const malformedCost = actorlessAction('ability', { kind: 'enemy' }, { resolve: [] }, { costs: {} });
    expect(validateGameplayMapEffectContext(contextMap(malformedCost)).map(issue => issue.message).join(' ')).toMatch(/requires costs to be omitted or an empty array/);
    const eligible = { ...actorlessAction('ability', { kind: 'enemy' }, { resolve: [] }), eligibleCharacterIds: ['shiroko'] };
    expect(validateGameplayMapEffectContext(contextMap(eligible)).map(issue => issue.message).join(' ')).toMatch(/requires an empty eligibleCharacterIds list/);
  });

  test('binds Team resources by side and condition completion to a non-battle local context', () => {
    const teamProgram = { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'signal', delta: 1 }] };
    const party = { ...baseAction, effectProgram: teamProgram };
    const battle = { title: 'Battle', enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1, actions: [{ actionId: 'observe', tendencyWeight: 1 }] }], initialEnemyTeamResources: [{ resourceId: 'signal', value: 0 }], participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] };
    expect(() => load(withEncounter(battle, [party]))).toThrow(/party Team initial balances/);
    const enemyTeamAction = { id: 'enemy-team', name: 'Enemy Team', eligibleCharacterIds: [], target: { kind: 'none' }, effectProgram: teamProgram };
    const enemyTeamBattle = { title: 'Battle', enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1, actions: [{ actionId: 'enemy-team', tendencyWeight: 1 }] }] };
    expect(() => load({ ...withEncounter(enemyTeamBattle, [enemyTeamAction]), initialTeamResources: [{ resourceId: 'signal', value: 0 }] })).toThrow(/enemy Team initial balances/);

    const condition = { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 2 } as const;
    const rest = { title: 'Rest', locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 3 }] }, completion: { kind: 'condition', label: 'Finish', condition } } as const;
    expect(() => load(withEncounter(rest))).not.toThrow();
    const activityNodes = baseMap.nodes.map(node => node.id === 'middle'
      ? { id: 'middle', title: 'Activities', activities: [{ id: 'rest', encounter: rest }] }
      : node);
    expect(() => load(withActions([baseAction], { nodes: activityNodes as GameplayMapDef['nodes'] }))).not.toThrow();
    expect(() => load(withEncounter({ ...rest, rounds: 2 }))).toThrow(/completion cannot be combined with rounds/);
    expect(() => load(withEncounter({ ...rest, enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1 }] }))).toThrow(/Battle does not allow manual completion|不允许声明手动 completion/);
    expect(() => load(withEncounter({ ...rest, completion: { kind: 'condition', label: 'HP', condition: { kind: 'hpAtLeast', target: 'primary', value: 1 } } })))
      .toThrow(/no source or primary unit context/);
    expect(() => load(withEncounter({ ...rest, futureEncounterField: true } as unknown))).toThrow(/合同外字段 "futureEncounterField"/);
    let deep: unknown = { kind: 'flag', flagId: 'ready', value: true };
    for (let index = 0; index < 2000; index += 1) deep = { kind: 'not', condition: deep };
    const deepAction = { ...baseAction, effectProgram: { resolve: [{ op: 'when', condition: deep, then: [] }] } };
    expect(() => load(withEncounter({ title: 'Deep', locals: { flags: [{ id: 'ready', initial: false }] }, participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] }, [deepAction])))
      .toThrow(/Condition depth limit exceeded/);
  });

  test('blocks custom-resolver program and condition content in Preview and before Commit writes', () => {
    const runtimeMap: GameplayMapDef = {
      ...baseMap,
      actions: [{ ...baseAction, effectProgram: { resolve: [{ op: 'flagSet', flagId: 'unused', value: true }] } }],
    };
    const resolver: MapContentResolver = { resolve: id => id === runtimeMap.id ? runtimeMap : null };
    const service = new MapRunService(resolver, id => ({ Shiroko: 'shiroko', Serika: 'serika' } as Record<string, string>)[id] ?? null);
    const started = service.start(runtimeMap.id, [{ characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' }]);
    const entered = service.move(started.runId, 'middle');
    const before = service.getSnapshot();
    expect(service.previewEncounterCommit(started.runId)).toMatchObject({ canCommit: false, diagnostics: [expect.stringContaining('effectProgram')] });
    expect(() => service.commitEncounterRound({
      runId: started.runId, requestId: 'blocked-program', expectedCommitVersion: entered.commitVersion,
      draft: { nodeId: 'middle', round: entered.activeEncounter!.round, draftVersion: entered.activeEncounter!.draftVersion },
    })).toThrow(/effectProgram.*not implemented/);
    expect(service.getSnapshot()).toEqual(before);

    const conditionMap: GameplayMapDef = {
      ...baseMap, actions: [baseAction], nodes: baseMap.nodes.map(node => node.id === 'middle' ? { ...node, encounter: {
        title: 'Condition', locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 2 }] },
        completion: { kind: 'condition', label: 'Finish', condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 1 } },
      } } : node),
    };
    const conditionService = new MapRunService({ resolve: id => id === conditionMap.id ? conditionMap : null }, id => ({ Shiroko: 'shiroko', Serika: 'serika' } as Record<string, string>)[id] ?? null);
    const conditionStart = conditionService.start(conditionMap.id, [{ characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' }]);
    conditionService.move(conditionStart.runId, 'middle');
    expect(conditionService.previewEncounterCommit(conditionStart.runId)).toMatchObject({ canCommit: false, diagnostics: expect.arrayContaining([expect.stringContaining('condition completion')]) });
  });
});
