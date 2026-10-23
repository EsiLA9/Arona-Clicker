import { describe, expect, test } from 'vitest';
import type { Datapack, GameplayMapDef } from '../../src/data-services';
import { Registry } from '../../src/data-services/registry/registry';
import { gameplayMapUsesDamageProtection, gameplayMapUsesShieldAdd, gameplayMapUsesStatusConsume, gameplayMapUsesStatusRemoveCategory, validateGameplayMapEffectContext } from '../../src/data-services/validation/gameplay-map-effect-context';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import type { MapContentResolver } from '../../src/arona-clicker/contracts/map/map-content-resolver';

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
function withEncounter(encounter: unknown, actions: unknown = [baseAction], changes: Partial<GameplayMapDef> = {}): GameplayMapDef {
  return withActions(actions, { ...changes, nodes: baseMap.nodes.map(node => node.id === 'middle' ? { ...node, encounter: encounter as GameplayMapDef['nodes'][number]['encounter'] } : node) });
}
function actorlessAction(id: string, target: unknown, effectProgram: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, name: id, eligibleCharacterIds: [], target, effectProgram, ...extra };
}

describe('Gameplay B E1/E2 Registry context', () => {
  test('limits revive and downed primary selection to Party AG-1 sources', () => {
    const encounter = { title: 'Revive', participants: [{ characterId: 'shiroko', actions: [
      { actionId: 'revive', tendencyWeight: 1 },
    ] }] };
    const revive = { ...baseAction, id: 'revive', target: { kind: 'partyCharacter', includeDefeated: true },
      effectProgram: { resolve: [{ op: 'revive', target: 'primary', amount: 3 }] } };
    expect(() => load(withEncounter(encounter, [revive], { executionContractId: 'AG-1' }))).not.toThrow();
    expect(() => load(withEncounter(encounter, [{ ...revive, target: { kind: 'partyCharacter' } }], { executionContractId: 'AG-1' })))
      .toThrow(/revive requires target.kind partyCharacter and includeDefeated true/);
    expect(() => load(withEncounter(encounter, [{ ...revive, effectProgram: { resolve: [{ op: 'flagSet', flagId: 'x', value: true }] } }],
      { executionContractId: 'AG-1' }))).toThrow(/includeDefeated requires a revive statement/);
    expect(() => load(withEncounter(encounter, [revive]))).toThrow(/includeDefeated 只允许用于 AG-1 Map/);
    expect(() => load(withEncounter({ ...encounter, enemies: [{ id: 'raider', initialHp: 5, maxHp: 5,
      actions: [{ actionId: 'revive', tendencyWeight: 1 }] }] }, [revive], { executionContractId: 'AG-1' })))
      .toThrow(/Enemy sources cannot use revive/);

    const ability = actorlessAction('revive-ability', { kind: 'partyCharacter', includeDefeated: true },
      { resolve: [{ op: 'revive', target: 'primary', amount: 2 }] });
    expect(() => load(withEncounter({ title: 'Ability Revive', enemies: [{ id: 'raider', initialHp: 5, maxHp: 5 }],
      abilityActionIds: ['revive-ability'] }, [ability],
      { executionContractId: 'AG-1' }))).not.toThrow();
    expect(() => load(withEncounter(encounter, [{ ...revive, target: { kind: 'enemy', includeDefeated: true } }],
      { executionContractId: 'AG-1' }))).toThrow(/合同外字段 "includeDefeated"/);
  });

  test('validates the static Party CardRef Modifier contract and target Action shape', () => {
    const modifier = { id: 'boost', name: 'Boost', eligibleCharacterIds: ['shiroko'],
      target: { kind: 'card', side: 'ally' }, effectProgram: { resolve: [
        { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 },
      ] } };
    const target = { id: 'heal', name: 'Heal', eligibleCharacterIds: ['serika'], target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] } };
    const attackCard = { id: 'attack-card', name: 'Attack card', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } };
    const unrelated = { id: 'unrelated', name: 'Unrelated', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'flagSet', flagId: 'unrelated', value: true }] } };
    const encounter = { title: 'Modifier', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'boost', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'heal', tendencyWeight: 1 }] },
    ] };
    expect(() => load(withEncounter(encounter, [modifier, target], { executionContractId: 'AG-1' }))).not.toThrow();
    const attackEncounter = { ...encounter, enemies: [{ id: 'raider', initialHp: 5, maxHp: 5 }], participants: [encounter.participants[0], {
      characterId: 'serika', actions: [{ actionId: 'attack-card', tendencyWeight: 1 }],
    }] };
    expect(() => load(withEncounter(attackEncounter, [modifier, attackCard, unrelated], { executionContractId: 'AG-1' }))).not.toThrow();
    const expectInvalid = (actions: unknown[], error: RegExp, changes: Partial<GameplayMapDef> = {}) => {
      const ids = new Set(actions.flatMap(action => typeof action === 'object' && action !== null && 'id' in action
        ? [String((action as { id: unknown }).id)] : []));
      const candidateEncounter = { ...encounter, participants: encounter.participants.map(participant => ({
        ...participant, actions: participant.actions.filter(candidate => ids.has(candidate.actionId)),
      })) };
      expect(() => load(withEncounter(candidateEncounter, actions, { executionContractId: 'AG-1', ...changes }))).toThrow(error);
    };
    expectInvalid([{ ...modifier, target: { kind: 'card', side: 'any' } }, target], /side ally/);
    const noEligible = withEncounter({ title: 'Modifier', participants: [{ characterId: 'serika', actions: [{ actionId: 'heal', tendencyWeight: 1 }] }] },
      [{ ...modifier, eligibleCharacterIds: [] }, target], { executionContractId: 'AG-1' });
    expect(validateGameplayMapEffectContext(noEligible).some(issue => /Party eligibility/.test(issue.message))).toBe(true);
    expectInvalid([{ ...modifier, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: modifier.effectProgram.resolve } }, target], /cannot declare prepare/);
    expectInvalid([{ ...modifier, effectProgram: { resolve: [...modifier.effectProgram.resolve, { op: 'flagSet', flagId: 'x', value: true }] } }, target], /exactly one top-level/);
    expectInvalid([{ ...modifier, effectProgram: { resolve: [{ op: 'when', condition: { kind: 'counter', counterId: 'x', comparison: 'gte', value: 0 }, then: modifier.effectProgram.resolve }] } }, target], /exactly one top-level/);
    expectInvalid([modifier, { ...target, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }, { op: 'heal', target: 'primary', amount: 1 }] } }], /requires at least one other-owner Party Action/);
    expectInvalid([modifier, unrelated], /requires at least one other-owner Party Action/);
    expectInvalid([modifier, target], /AG-1/, { executionContractId: undefined });
  });
  test('checks additionalTarget against every actual source, including Pool-only and no-program Actions', () => {
    const action = { id: 'secondary', name: 'Secondary', eligibleCharacterIds: ['shiroko'],
      target: { kind: 'enemy' }, additionalTarget: 'partyCharacter' };
    const partyUse = withActions([action], { executionContractId: 'AG-1', nodes: baseMap.nodes.map(node => node.id === 'middle'
      ? { ...node, encounter: { title: 'Party use', enemies: [{ id: 'raider', initialHp: 5, maxHp: 5 }],
        participants: [{ characterId: 'shiroko', actions: [{ actionId: 'secondary', tendencyWeight: 1 }] }] } }
      : node) });
    expect(() => load(partyUse)).not.toThrow();

    const enemyEncounter = { title: 'Enemy use', enemies: [{ id: 'raider', initialHp: 5, maxHp: 5,
      actions: [{ actionId: 'secondary', tendencyWeight: 1 }] }] };
    expect(() => load(withActions([action], { executionContractId: 'AG-1', nodes: baseMap.nodes.map(node => node.id === 'middle'
      ? { ...node, encounter: enemyEncounter } : node) }))).toThrow(/additionalTarget Actions cannot be referenced by Enemy sources/);

    const poolOnly = withActions([action], { executionContractId: 'AG-1', candidatePools: [
      { id: 'enemy-pool', entries: [{ kind: 'action', actionId: 'secondary', weight: 1 }] },
    ], nodes: baseMap.nodes.map(node => node.id === 'middle' ? { ...node, encounter: { title: 'Enemy Pool',
      enemies: [{ id: 'raider', initialHp: 5, maxHp: 5, candidatePoolIds: ['enemy-pool'] }] } } : node) });
    expect(() => load(poolOnly)).toThrow(/additionalTarget Actions cannot be referenced by Enemy sources/);

    const mixed = withActions([action], { executionContractId: 'AG-1', nodes: baseMap.nodes.map(node => node.id === 'middle'
      ? { ...node, encounter: { title: 'Mixed', participants: [{ characterId: 'shiroko', actions: [{ actionId: 'secondary', tendencyWeight: 1 }] }],
        enemies: [{ id: 'raider', initialHp: 5, maxHp: 5, actions: [{ actionId: 'secondary', tendencyWeight: 1 }] }] } }
      : node) });
    expect(() => load(mixed)).toThrow(/additionalTarget Actions cannot be referenced by Enemy sources/);

    const ability = { ...action, eligibleCharacterIds: [] };
    const actorless = withActions([ability], { executionContractId: 'AG-1', nodes: baseMap.nodes.map(node => node.id === 'middle'
      ? { ...node, encounter: { title: 'Ability', enemies: [{ id: 'raider', initialHp: 5, maxHp: 5 }], abilityActionIds: ['secondary'] } } : node) });
    expect(() => load(actorless)).not.toThrow();
  });

  test('binds Prepared Tag count reads to Action programs and rejects them in completion conditions', () => {
    const condition = { kind: 'preparedTagCount', side: 'party', tag: 'gameplay-b:action/explosive', comparison: 'gte', value: 2 };
    const comboAction = { ...baseAction, target: { kind: 'enemy' }, tags: ['gameplay-b:action/explosive'],
      effectProgram: { resolve: [{ op: 'when', condition, then: [{ op: 'damage', target: 'primary', amount: 1 }] }] } };
    expect(() => load(withEncounter({ title: 'Combo', enemies: [{ id: 'raider', initialHp: 5, maxHp: 5 }], participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] },
    ] }, [comboAction]))).not.toThrow();

    const completion = { title: 'Rest', completion: { kind: 'condition', label: 'Finish', condition } };
    expect(() => load(withEncounter(completion))).toThrow(/Prepared Tag conditions are not available to Encounter completion/);
  });

  test('binds statusApply to a declared Map Status and validates unit target, stacks and duration', () => {
    const apply = { ...baseAction, target: { kind: 'enemy' }, effectProgram: { resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 3,
    }] } };
    const map = withEncounter({ title: 'Status', enemies: [{ id: 'raider', initialHp: 4, maxHp: 5 }], participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }],
    }] }, [apply]);
    expect(() => load({ ...map, statuses: [
      { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 },
    ] })).not.toThrow();
    expect(() => load({ ...map, statuses: [] })).toThrow(/status "burn" is not declared/);
    expect(() => load({ ...map, statuses: [
      { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 1 },
    ] })).toThrow(/stacks exceeds Status/);
    const sourceApply = { ...apply, effectProgram: { resolve: [{
      op: 'statusApply', target: 'source', statusId: 'burn', stacks: 1, durationRounds: 1,
    }] } } as unknown as NonNullable<GameplayMapDef['actions']>[number];
    expect(() => load(withActions([sourceApply], { nodes: map.nodes, statuses: [
      { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 },
    ] })))
      .not.toThrow();

    const noneTarget = { ...baseAction, effectProgram: { resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 1,
    }] } };
    expect(() => load({ ...withEncounter({ title: 'No target', participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }],
    }] }, [noneTarget]), statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 1 }] }))
      .toThrow(/primary requires a possible unit target/);
    const actorless = actorlessAction('ability', { kind: 'enemy' }, { resolve: [{
      op: 'statusApply', target: 'source', statusId: 'burn', stacks: 1, durationRounds: 1,
    }] });
    expect(() => load({ ...withEncounter({ title: 'Ability', enemies: [{ id: 'enemy', initialHp: 1, maxHp: 1 }], abilityActionIds: ['ability'] }, [actorless]),
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 1 }] }))
      .toThrow(/actorless Ability \/ Item cannot reference source HP/);
  });

  test('binds MapRun Status applications to a direct Party Action and preserves their origin path', () => {
    const statuses = [{ id: 'map-ward', name: 'Map Ward', kind: 'regen', hpPerStack: 1, maxStacks: 3, lifetime: 'mapRun' }];
    const statusApply = (target: 'source' | 'primary' | 'loopTarget' = 'primary') => ({
      op: 'statusApply', target, statusId: 'map-ward', stacks: 1, durationRounds: 2,
    });
    const action = (id: string, target: unknown, unit: 'source' | 'primary' | 'loopTarget' = 'primary') => ({
      id, name: id, eligibleCharacterIds: ['shiroko'], target,
      effectProgram: { resolve: [statusApply(unit)] },
    });
    const map = (encounter: unknown, actions: unknown, extras: Record<string, unknown> = {}) => ({
      ...withEncounter(encounter, actions, { executionContractId: 'AG-1' }), statuses, ...extras,
    } as unknown as GameplayMapDef);

    const partyPrimary = action('apply-primary', { kind: 'partyCharacter' });
    expect(() => load(map({ title: 'Direct Party', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'apply-primary', tendencyWeight: 1 }] },
    ] }, [partyPrimary]))).not.toThrow();

    const partySource = action('apply-source', { kind: 'enemy' }, 'source');
    expect(() => load(map({ title: 'Direct Party source', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'apply-source', tendencyWeight: 1 }] },
    ], enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }] }, [partySource]))).not.toThrow();

    const enemyAction = { ...partySource, id: 'enemy-apply', eligibleCharacterIds: [] };
    expect(() => load(map({ title: 'Enemy source', participants: [{ characterId: 'shiroko', actions: [] }], enemies: [
      { id: 'raider', initialHp: 3, maxHp: 3, actions: [{ actionId: 'enemy-apply', tendencyWeight: 1 }] },
    ] }, [enemyAction]))).toThrow(/direct Party participant Action/);

    const poolAction = action('pool-apply', { kind: 'enemy' }, 'source');
    const poolOnly = map({ title: 'Pool only', participants: [{
      characterId: 'shiroko', actions: [], candidatePoolIds: ['pool'],
    }], enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }] }, [poolAction], {
      candidatePools: [{ id: 'pool', entries: [{ kind: 'action', actionId: 'pool-apply', weight: 1 }] }],
    });
    const poolIssues = validateGameplayMapEffectContext(poolOnly);
    expect(poolIssues.some(issue => issue.message.includes('direct Party participant Action'))).toBe(true);

    const activityMap = {
      ...poolOnly,
      nodes: [{ id: 'middle', title: 'Encounter', activities: [{ id: 'origin-activity', encounter: {
        title: 'Pool only', participants: [{ characterId: 'shiroko', actions: [], candidatePoolIds: ['pool'] }],
        enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }],
      } }] }],
    } as unknown as GameplayMapDef;
    expect(validateGameplayMapEffectContext(activityMap).some(issue =>
      issue.path.includes('activities[0]') && issue.path.includes('participants[0].candidatePoolIds'))).toBe(true);

    const actorless = actorlessAction('ability-apply', { kind: 'partyCharacter' }, { resolve: [statusApply('primary')] });
    expect(() => load(map({ title: 'Ability source', enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }], abilityActionIds: ['ability-apply'] }, [actorless])))
      .toThrow(/direct Party participant Action/);
    const item = { ...actorless, id: 'item-apply' };
    expect(() => load(map({ title: 'Item source', enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }], itemActions: [{ itemId: ITEM.id, actionId: 'item-apply' }] }, [item])))
      .toThrow(/direct Party participant Action/);

    const enemyPrimary = action('enemy-primary', { kind: 'enemy' });
    expect(() => load(map({ title: 'Enemy primary', participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'enemy-primary', tendencyWeight: 1 }],
    }], enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }] }, [enemyPrimary])))
      .toThrow(/primary' target must resolve to a Party Character/);
    const loopTarget = { ...action('loop-target', { kind: 'enemy' }), effectProgram: { resolve: [{
      op: 'forTargets', targetSet: { side: 'party' }, body: [statusApply('loopTarget')],
    }] } };
    expect(() => load(map({ title: 'Loop target', participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'loop-target', tendencyWeight: 1 }],
    }], enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }] }, [loopTarget])))
      .toThrow(/MapRun-lifetime Status target must be 'source' or 'primary'/);

    expect(() => load({ ...baseMap, statuses: statuses as unknown as GameplayMapDef['statuses'] }))
      .toThrow(/MapRun-lifetime Status requires executionContractId AG-1/);
  });

  test('binds Status onExpire resources to every possible holder including actorless primary and loopTarget', () => {
    const expiringStatus = [{ id: 'regen', name: 'Regen', category: 'beneficial', kind: 'regen',
      hpPerStack: 1, maxStacks: 2, onExpire: { resourceId: 'focus', delta: 1 } }] as const;
    const actorlessPrimary = actorlessAction('ability', { kind: 'enemy' }, { resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'regen', stacks: 1, durationRounds: 2,
    }] });
    const actorlessEncounter = { title: 'Expiry reward', enemies: [{ id: 'enemy', initialHp: 3, maxHp: 3,
      initialResources: [{ resourceId: 'focus', value: 0 }] }], abilityActionIds: ['ability'] };
    const actorlessMap = withEncounter(actorlessEncounter, [actorlessPrimary], {
      executionContractId: 'AG-1', statuses: expiringStatus,
    });
    const registry = load(actorlessMap);
    expect(registry.maps.get(actorlessMap.id)?.statuses?.[0]?.onExpire).toEqual({ resourceId: 'focus', delta: 1 });

    const missingActorResource = { ...actorlessEncounter, enemies: [{ id: 'enemy', initialHp: 3, maxHp: 3 }] };
    expect(() => load(withEncounter(missingActorResource, [actorlessPrimary], {
      executionContractId: 'AG-1', statuses: expiringStatus,
    }))).toThrow(/onExpire resource "focus" is not declared for possible holder enemy "enemy"/);

    const applyToEveryEnemy = { ...baseAction, id: 'apply-each', target: { kind: 'enemy' }, effectProgram: { resolve: [{
      op: 'forTargets', targetSet: { side: 'enemy' }, body: [{
        op: 'statusApply', target: 'loopTarget', statusId: 'regen', stacks: 1, durationRounds: 2,
      }],
    }] } };
    const partyEncounter = { title: 'Expiry loop', enemies: [
      { id: 'e1', initialHp: 3, maxHp: 3, initialResources: [{ resourceId: 'focus', value: 0 }] },
      { id: 'e2', initialHp: 3, maxHp: 3 },
    ], participants: [{ characterId: 'shiroko', actions: [{ actionId: 'apply-each', tendencyWeight: 1 }] }] };
    expect(() => load(withEncounter(partyEncounter, [applyToEveryEnemy], {
      executionContractId: 'AG-1', statuses: expiringStatus,
    }))).toThrow(/onExpire resource "focus" is not declared for possible holder enemy "e2"/);

    expect(() => load(withEncounter(actorlessEncounter, [actorlessPrimary], { statuses: expiringStatus })))
      .toThrow(/Status onExpire requires executionContractId AG-1/);
  });

  test('gates onDamageTaken to AG-1 and requires a resource balance for every possible holder', () => {
    const status = [{ id: 'steadfast', name: 'Steadfast', kind: 'regen', hpPerStack: 1, maxStacks: 1,
      onDamageTaken: { resourceId: 'focus', delta: 1 } }] as const;
    const encounter = { title: 'Damage reward', enemies: [
      { id: 'e1', initialHp: 3, maxHp: 3, initialResources: [{ resourceId: 'focus', value: 0 }] },
      { id: 'e2', initialHp: 3, maxHp: 3 },
    ], participants: [{ characterId: 'shiroko', actions: [] }] };
    const withPartyBalances = { initialActorResources: [
      { characterId: 'shiroko', resourceId: 'focus', value: 0 },
      { characterId: 'serika', resourceId: 'focus', value: 0 },
    ] };
    expect(() => load(withEncounter(encounter, [baseAction], { executionContractId: 'AG-1', statuses: status,
      ...withPartyBalances }))).toThrow(/onDamageTaken resource "focus" is not declared for possible holder enemy "e2"/);
    const validEncounter = { ...encounter, enemies: encounter.enemies.map(enemy => ({ ...enemy,
      initialResources: [{ resourceId: 'focus', value: 0 }] })) };
    expect(() => load(withEncounter(validEncounter, [baseAction], { executionContractId: 'AG-1', statuses: status,
      ...withPartyBalances }))).not.toThrow();
    expect(() => load(withEncounter(validEncounter, [baseAction], { statuses: status, ...withPartyBalances })))
      .toThrow(/Status onDamageTaken requires executionContractId AG-1/);
  });

  test('requires AG-1 for damageReduction Status definitions', () => {
    const status = { id: 'cover', name: 'Cover', category: 'beneficial',
      kind: 'damageReduction', damageReductionPerStack: 2, maxStacks: 1 } as const;
    expect(() => load({ ...baseMap, statuses: [status] }))
      .toThrow(/damageReduction Status requires executionContractId AG-1/);
    expect(() => load({ ...baseMap, executionContractId: 'AG-1', statuses: [status] })).not.toThrow();
  });

  test('requires AG-1 for damageProtection Status definitions', () => {
    const status = { id: 'ward', name: 'Ward', category: 'beneficial',
      kind: 'damageProtection', maxStacks: 2 } as const;
    expect(() => load({ ...baseMap, statuses: [status] }))
      .toThrow(/damageProtection Status requires executionContractId AG-1/);
    expect(() => load({ ...baseMap, executionContractId: 'AG-1', statuses: [status] })).not.toThrow();
    expect(gameplayMapUsesDamageProtection({ statuses: [status] })).toBe(true);
    expect(gameplayMapUsesDamageProtection({ statuses: [{ ...status, kind: 'burn' }] })).toBe(false);
  });

  test('binds statusRemove to a declared Map Status and requires a reachable unit target', () => {
    const remove = { ...baseAction, target: { kind: 'enemy' }, effectProgram: { resolve: [{
      op: 'statusRemove', target: 'primary', statusId: 'burn',
    }] } };
    const status: NonNullable<GameplayMapDef['statuses']> = [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 }];
    const encounter = { title: 'Status removal', enemies: [{ id: 'raider', initialHp: 4, maxHp: 5 }], participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }],
    }] };
    expect(() => load({ ...withEncounter(encounter, [remove]), statuses: status })).not.toThrow();
    const removeSource = { ...baseAction, effectProgram: { resolve: [{
      op: 'statusRemove', target: 'source', statusId: 'burn',
    }] } };
    expect(() => load({ ...withEncounter(encounter, [removeSource]), statuses: status })).not.toThrow();
    expect(() => load({ ...withEncounter(encounter, [remove]), statuses: [] }))
      .toThrow(/status "burn" is not declared/);

    const noTarget = { ...baseAction, effectProgram: { resolve: [{
      op: 'statusRemove', target: 'primary', statusId: 'burn',
    }] } };
    expect(() => load({ ...withEncounter({ title: 'No target', participants: encounter.participants }, [noTarget]), statuses: status }))
      .toThrow(/primary requires a possible unit target/);

    const actorless = actorlessAction('ability', { kind: 'enemy' }, { resolve: [{
      op: 'statusRemove', target: 'source', statusId: 'burn',
    }] });
    expect(() => load({
      ...withEncounter({ title: 'Ability', enemies: encounter.enemies, abilityActionIds: ['ability'] }, [actorless]),
      statuses: status,
    })).toThrow(/actorless Ability \/ Item cannot reference source HP/);
  });

  test('binds statusConsume to a declared Map Status and requires AG-1 with a reachable unit target', () => {
    const consume = { ...baseAction, target: { kind: 'enemy' }, effectProgram: { resolve: [
      { op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 2 },
    ] } };
    const status: NonNullable<GameplayMapDef['statuses']> = [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 }];
    const encounter = { title: 'Status consumption', enemies: [{ id: 'raider', initialHp: 4, maxHp: 5 }], participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }],
    }] };
    const ag1Map = withEncounter(encounter, [consume], { executionContractId: 'AG-1' });
    expect(() => load({ ...ag1Map, statuses: status })).not.toThrow();
    expect(gameplayMapUsesStatusConsume(ag1Map)).toBe(true);
    expect(gameplayMapUsesStatusConsume(withEncounter(encounter, [baseAction]))).toBe(false);
    expect(() => load({ ...withEncounter(encounter, [consume]), statuses: status }))
      .toThrow(/statusConsume 只允许用于 AG-1/);
    expect(() => load({ ...ag1Map, statuses: [] })).toThrow(/status "burn" is not declared/);

    const noTarget = { ...consume, target: { kind: 'none' } };
    expect(() => load({ ...withEncounter({ title: 'No target', participants: encounter.participants }, [noTarget], { executionContractId: 'AG-1' }), statuses: status }))
      .toThrow(/primary requires a possible unit target/);
    const actorless = actorlessAction('ability', { kind: 'enemy' }, { resolve: [
      { op: 'statusConsume', target: 'source', statusId: 'burn', stacks: 1 },
    ] });
    expect(() => load({ ...withEncounter({ title: 'Ability', enemies: encounter.enemies, abilityActionIds: ['ability'] }, [actorless], { executionContractId: 'AG-1' }), statuses: status }))
      .toThrow(/actorless Ability \/ Item cannot reference source HP/);
  });

  test('binds statusRemoveCategory to a declared category and requires AG-1 with a reachable Actor holder', () => {
    const cleanse = { ...baseAction, target: { kind: 'enemy' }, effectProgram: { resolve: [
      { op: 'statusRemoveCategory', target: 'primary', category: 'harmful' },
    ] } };
    const encounter = { title: 'Category cleanse', enemies: [{ id: 'raider', initialHp: 1, maxHp: 5 }], participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] },
    ] };
    const ag1Map = withEncounter(encounter, [cleanse], { executionContractId: 'AG-1' });
    expect(() => load({ ...ag1Map, statuses: [
      { id: 'burn', name: 'Burn', category: 'harmful', kind: 'burn', hpPerStack: 1, maxStacks: 3 },
      { id: 'unclassified', name: 'Unclassified', kind: 'burn', hpPerStack: 1, maxStacks: 3 },
    ] })).not.toThrow();
    expect(gameplayMapUsesStatusRemoveCategory(ag1Map)).toBe(true);
    expect(gameplayMapUsesStatusRemoveCategory(withEncounter(encounter, [baseAction]))).toBe(false);
    expect(() => load({ ...ag1Map, statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3 }] }))
      .toThrow(/no Status declares category "harmful"/);
    expect(() => load({ ...withEncounter(encounter, [cleanse]), statuses: [
      { id: 'burn', name: 'Burn', category: 'harmful', kind: 'burn', hpPerStack: 1, maxStacks: 3 },
    ] })).toThrow(/statusRemoveCategory 只允许用于 AG-1/);

    const noPrimary = { ...cleanse, target: { kind: 'none' } };
    expect(() => load({ ...withEncounter({ title: 'No primary', participants: encounter.participants }, [noPrimary], { executionContractId: 'AG-1' }),
      statuses: [{ id: 'burn', name: 'Burn', category: 'harmful', kind: 'burn', hpPerStack: 1, maxStacks: 3 }] }))
      .toThrow(/primary requires a possible unit target/);
    const actorless = actorlessAction('ability', { kind: 'enemy' }, { resolve: [
      { op: 'statusRemoveCategory', target: 'source', category: 'harmful' },
    ] });
    expect(() => load({ ...withEncounter({ title: 'Ability', enemies: encounter.enemies, abilityActionIds: ['ability'] }, [actorless], { executionContractId: 'AG-1' }),
      statuses: [{ id: 'burn', name: 'Burn', category: 'harmful', kind: 'burn', hpPerStack: 1, maxStacks: 3 }] }))
      .toThrow(/actorless Ability \/ Item cannot reference source HP/);
  });

  test('binds shieldAdd to a source Actor or a possible unit primary and keeps its Map marker', () => {
    const primaryShield = { ...baseAction, target: { kind: 'partyCharacter' }, effectProgram: { resolve: [
      { op: 'shieldAdd', target: 'primary', amount: 3 },
    ] } };
    const sourceShield = { ...baseAction, target: { kind: 'none' }, effectProgram: { resolve: [
      { op: 'shieldAdd', target: 'source', amount: 3 },
    ] } };
    const partyEncounter = { title: 'Shield', participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }],
    }] };
    const enemyEncounter = { title: 'Shield', enemies: [{ id: 'raider', initialHp: 4, maxHp: 5 }] };
    expect(() => load(withEncounter(partyEncounter, [primaryShield], { executionContractId: 'AG-1' }))).not.toThrow();
    expect(() => load(withEncounter(partyEncounter, [sourceShield], { executionContractId: 'AG-1' }))).not.toThrow();
    expect(gameplayMapUsesShieldAdd(withEncounter(partyEncounter, [primaryShield], { executionContractId: 'AG-1' }))).toBe(true);
    expect(gameplayMapUsesShieldAdd(withEncounter(partyEncounter))).toBe(false);

    const actorlessSource = actorlessAction('ability', { kind: 'partyCharacter' }, { resolve: [
      { op: 'shieldAdd', target: 'source', amount: 1 },
    ] });
    expect(() => load(withEncounter({ ...enemyEncounter, abilityActionIds: ['ability'] }, [actorlessSource], { executionContractId: 'AG-1' })))
      .toThrow(/actorless Ability \/ Item cannot reference source HP/);

    const noPrimary = { ...primaryShield, target: { kind: 'none' } };
    expect(() => load(withEncounter(partyEncounter, [noPrimary], { executionContractId: 'AG-1' })))
      .toThrow(/primary requires a possible unit target/);
    const cardPrimary = { ...primaryShield, target: { kind: 'card', side: 'ally' }, effectProgram: {
      prepare: [{ op: 'discountSCost', amount: 1 }], resolve: [{ op: 'shieldAdd', target: 'primary', amount: 1 }],
    } };
    expect(() => load(withEncounter(partyEncounter, [cardPrimary], { executionContractId: 'AG-1' })))
      .toThrow(/primary requires a possible unit target/);
    expect(() => load(withEncounter(partyEncounter, [primaryShield], { executionContractId: 'E1-COMPAT-1' })))
      .toThrow(/shieldAdd 只允许用于 AG-1 Map|requires executionContractId AG-1/);
  });

  test('validates shieldAdd amount references in normal and forTargets scopes', () => {
    const encounter = { title: 'Shield amount', enemies: [{ id: 'raider', initialHp: 4, maxHp: 5 }], participants: [{
      characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }],
    }] };
    const shield = (amount: unknown) => ({ ...baseAction, target: { kind: 'enemy' }, effectProgram: { resolve: [
      { op: 'shieldAdd', target: 'primary', amount },
    ] } });
    expect(() => load(withEncounter(encounter, [shield({ kind: 'counter', counterId: 'missing' })], { executionContractId: 'AG-1' })))
      .toThrow(/counter "missing" is not declared in this Encounter/);
    expect(() => load(withEncounter(encounter, [shield({ kind: 'mapRunCounter', counterId: 'missing' })], { executionContractId: 'AG-1' })))
      .toThrow(/mapRunCounter "missing" is not declared in Map mapRunFacts/);
    expect(() => load(withEncounter(encounter, [shield({ kind: 'resourceBalance', account: 'sourceActor', resourceId: 'missing' })], { executionContractId: 'AG-1' })))
      .toThrow(/resource "missing" is not declared for source party "shiroko"/);
    expect(() => load(withEncounter(encounter, [shield({ kind: 'targetCount' })], { executionContractId: 'AG-1' })))
      .toThrow(/targetCount Value requires a damage\/heal target set or forTargets body/);
    expect(() => load(withEncounter(encounter, [shield({ kind: 'hp', unit: 'target' })], { executionContractId: 'AG-1' })))
      .toThrow(/target HP Value requires a damage\/heal target set/);

    const actorless = actorlessAction('ability', { kind: 'enemy' }, { resolve: [{
      op: 'shieldAdd', target: 'primary', amount: { kind: 'hp', unit: 'source' },
    }] });
    expect(() => load(withEncounter({ title: 'Actorless amount', enemies: encounter.enemies, abilityActionIds: ['ability'] }, [actorless], { executionContractId: 'AG-1' })))
      .toThrow(/actorless Ability \/ Item cannot reference source HP/);

    const loopShield = { ...baseAction, target: { kind: 'enemy' }, effectProgram: { resolve: [{
      op: 'forTargets', targetSet: { side: 'party' }, body: [{
        op: 'shieldAdd', target: 'primary', amount: { kind: 'add', left: { kind: 'hp', unit: 'loopTarget' }, right: { kind: 'targetCount' } },
      }],
    }] } };
    expect(() => load(withEncounter(encounter, [loopShield], { executionContractId: 'AG-1' }))).not.toThrow();
    const loopTargetValue = { ...loopShield, effectProgram: { resolve: [{
      op: 'forTargets', targetSet: { side: 'party' }, body: [{
        op: 'shieldAdd', target: 'primary', amount: { kind: 'hp', unit: 'target' },
      }],
    }] } };
    expect(() => load(withEncounter(encounter, [loopTargetValue], { executionContractId: 'AG-1' })))
      .toThrow(/target HP Value requires a damage\/heal target set/);
    const missingLoopResource = { ...loopShield, effectProgram: { resolve: [{
      op: 'forTargets', targetSet: { side: 'party' }, body: [{
        op: 'shieldAdd', target: 'primary', amount: { kind: 'resourceBalance', account: 'loopTargetActor', resourceId: 'missing' },
      }],
    }] } };
    expect(() => load(withEncounter(encounter, [missingLoopResource], { executionContractId: 'AG-1' })))
      .toThrow(/resource "missing" is not declared for possible loopTarget party "shiroko"/);
  });

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

  test('materializes Party Actor resource IDs across the fixed party and does not mix Enemy balances', () => {
    const program = { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'shared', delta: 1 }] };
    const action = { id: 'actor', name: 'Actor', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' }, effectProgram: program };
    const encounter = { title: 'Talk', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'actor', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'actor', tendencyWeight: 1 }] },
    ] };
    const map = withEncounter(encounter, [action]);
    expect(() => load({ ...map, initialActorResources: [{ characterId: 'shiroko', resourceId: 'shared', value: 0 }] }))
      .not.toThrow();

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

  test('binds Party Actor and Team balance reads to resources materialized by Action costs alone', () => {
    const costOnly = {
      ...baseAction,
      eligibleCharacterIds: ['shiroko'],
      target: { kind: 'enemy' },
      costs: [
        { scope: 'actor', resourceId: 'actor-cost-only', amount: 1 },
        { scope: 'team', resourceId: 'team-cost-only', amount: 1 },
      ],
      effectProgram: { resolve: [
        { op: 'when', condition: { kind: 'resourceAtLeast', account: 'sourceActor', resourceId: 'actor-cost-only', value: 0 }, then: [] },
        { op: 'when', condition: { kind: 'resourceAtLeast', account: 'sourceTeam', resourceId: 'team-cost-only', value: 0 }, then: [] },
        { op: 'heal', target: 'primary', amount: { kind: 'resourceBalance', account: 'sourceActor', resourceId: 'actor-cost-only' } },
      ] },
    };
    const encounter = { title: 'Cost-only resource', enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }], participants: [
      { characterId: 'shiroko', actions: [{ actionId: costOnly.id, tendencyWeight: 1 }] },
    ] };
    expect(() => load({
      ...withEncounter(encounter, [costOnly]), executionContractId: 'AG-1',
    })).not.toThrow();
  });

  test('validates Effect Program context for a Pool-only Action source', () => {
    const pooledAction = {
      id: 'pooled-source', name: 'Pooled source', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
    };
    const map = {
      ...withEncounter({ title: 'Pool source', participants: [{
        characterId: 'shiroko', actions: [], candidatePoolIds: ['source-pool'],
      }] }, [pooledAction]),
      candidatePools: [{ id: 'source-pool', entries: [{ kind: 'action', actionId: 'pooled-source', weight: 1 }] }],
    } as GameplayMapDef;

    expect(() => load(map)).toThrow(/resource "focus" is not declared for source party "shiroko"/);
    expect(() => load({ ...map, initialActorResources: [{ characterId: 'shiroko', resourceId: 'focus', value: 0 }] }))
      .not.toThrow();
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
      .toThrow(/actions\[0\].*含合同外字段 "effects"/);
    const unknown = { ...baseAction, effectProgram: { resolve: [{ op: 'flagSet', flagId: 'x', value: true, unexpected: 1 }] } };
    expect(() => load(withEncounter({ title: 'Unknown', locals: { flags: [{ id: 'x', initial: false }] }, participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] }, [unknown])))
      .toThrow(/effectProgram\.resolve\[0\]\.unexpected/);
  });

  test('binds E2 target HP / Counter Values only in a valid TargetSet context', () => {
    const setAction = { ...baseAction, effectProgram: { resolve: [{
      op: 'damage', target: { set: { side: 'enemy', filter: 'living' } },
      amount: { kind: 'min', left: { kind: 'missingHp', unit: 'target' }, right: { kind: 'literal', value: 3 } },
    }] } };
    const battle = { title: 'E2', enemies: [{ id: 'raider', initialHp: 4, maxHp: 5 }],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] }] };
    expect(() => load(withEncounter(battle, [setAction]))).not.toThrow();

    const targetOutsideSet = { ...baseAction, target: { kind: 'enemy' }, effectProgram: { resolve: [{
      op: 'damage', target: 'primary', amount: { kind: 'hp', unit: 'target' },
    }] } };
    expect(() => load(withEncounter(battle, [targetOutsideSet]))).toThrow(/target HP Value requires a damage\/heal target set/);

    const undeclaredCounter = { ...baseAction, effectProgram: { resolve: [{
      op: 'heal', target: { set: { side: 'party' } }, amount: { kind: 'counter', counterId: 'missing' },
    }] } };
    expect(() => load(withEncounter(battle, [undeclaredCounter]))).toThrow(/counter "missing" is not declared/);
  });

  test('binds new Effect AST to explicit AG-1, MapRun Facts declarations, and possible loop Actors', () => {
    const action = {
      ...baseAction,
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{
        op: 'forTargets', targetSet: { side: 'party', filter: 'living' }, body: [
          { op: 'when', condition: { kind: 'all', conditions: [
            { kind: 'mapRunCounter', counterId: 'steps', comparison: 'gte', value: 1 },
            { kind: 'resourceAtLeast', account: 'loopTargetActor', resourceId: 'focus', value: 1 },
          ] }, then: [
            { op: 'mapRunCounterAdd', counterId: 'steps', delta: 1 },
            { op: 'mapRunFlagSet', flagId: 'opened', value: true },
          ] },
        ],
      }] },
    };
    const encounter = { title: 'AG-1', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] },
    ], enemies: [{ id: 'enemy', initialHp: 3, maxHp: 3 }] };
    const encounterUsing = (actionId: string) => ({
      ...encounter,
      participants: [{ characterId: 'shiroko', actions: [{ actionId, tendencyWeight: 1 }] }],
    });
    const ag1Map = {
      ...withEncounter(encounter, [action]), executionContractId: 'AG-1' as const,
      mapRunFacts: { counters: [{ id: 'steps', initial: 0, min: 0, max: 3 }], flags: [{ id: 'opened', initial: false }] },
      initialActorResources: [
        { characterId: 'shiroko', resourceId: 'focus', value: 0 },
        { characterId: 'serika', resourceId: 'focus', value: 0 },
      ],
    };
    expect(() => load(ag1Map)).not.toThrow();

    expect(() => load({ ...ag1Map, executionContractId: 'E1-COMPAT-1' }))
      .toThrow(/requires executionContractId AG-1/);
    const legacyMap = { ...ag1Map } as Record<string, unknown>;
    delete legacyMap.executionContractId;
    expect(() => load(legacyMap as unknown as GameplayMapDef)).toThrow(/requires executionContractId AG-1/);

    const undeclaredFact = {
      ...action, id: 'missing-fact',
      effectProgram: { resolve: [{ op: 'mapRunFlagSet', flagId: 'missing', value: true }] },
    };
    expect(() => load({
      ...withEncounter(encounterUsing('missing-fact'), [undeclaredFact]), executionContractId: 'AG-1',
      mapRunFacts: { counters: [{ id: 'steps', initial: 0, min: 0, max: 3 }] },
    })).toThrow(/mapRunFlag "missing" is not declared/);

    const undeclaredLoopResource = {
      ...action, id: 'missing-loop-resource',
      effectProgram: { resolve: [{
        op: 'forTargets', targetSet: { side: 'party' }, body: [
          { op: 'when', condition: { kind: 'resourceAtLeast', account: 'loopTargetActor', resourceId: 'missing', value: 1 }, then: [] },
        ],
      }] },
    };
    expect(() => load({
      ...withEncounter(encounterUsing('missing-loop-resource'), [undeclaredLoopResource]), executionContractId: 'AG-1',
    })).toThrow(/not declared for possible loopTarget party "shiroko"/);

    const additionalActor = {
      ...action, id: 'additional-actor', additionalTarget: 'partyCharacter',
      effectProgram: { resolve: [
        { op: 'when', condition: {
          kind: 'resourceAtLeast', account: 'additionalActor', resourceId: 'focus', value: 1,
        }, then: [] },
        { op: 'heal', target: 'primary', amount: { kind: 'resourceBalance', account: 'additionalActor', resourceId: 'focus' } },
        { op: 'resourceChange', account: 'additionalActor', resourceId: 'focus', delta: 1 },
        { op: 'forTargets', targetSet: { side: 'party' }, body: [
          { op: 'resourceChange', account: 'loopTargetActor', resourceId: 'focus', delta: -1 },
        ] },
      ] },
    };
    const mapWithAdditionalResources = {
      ...withEncounter(encounterUsing('additional-actor'), [additionalActor]), executionContractId: 'AG-1' as const,
      initialActorResources: [
        { characterId: 'shiroko', resourceId: 'focus', value: 0 },
        { characterId: 'serika', resourceId: 'focus', value: 0 },
      ],
    };
    expect(() => load(mapWithAdditionalResources)).not.toThrow();
    expect(() => load({ ...mapWithAdditionalResources, executionContractId: 'E1-COMPAT-1' }))
      .toThrow(/additionalTarget 只允许用于 AG-1 Map|requires executionContractId AG-1/);

    const missingContract = { ...additionalActor, additionalTarget: undefined };
    expect(() => load({
      ...mapWithAdditionalResources, actions: [missingContract],
    } as unknown as GameplayMapDef)).toThrow(/additionalActor requires an additionalTarget/);

    const missingPartyResource = { ...additionalActor, effectProgram: { resolve: [
      { op: 'resourceChange', account: 'additionalActor', resourceId: 'missing', delta: 1 },
    ] } };
    expect(() => load({
      ...mapWithAdditionalResources, actions: [missingPartyResource],
    } as unknown as GameplayMapDef)).toThrow(/not declared for possible additionalTarget party "serika"/);

    const enemyTarget = {
      ...additionalActor, id: 'additional-enemy', additionalTarget: 'enemy', target: { kind: 'partyCharacter' },
    };
    const enemyTargetMap = {
      ...withEncounter({ ...encounterUsing('additional-enemy'), enemies: [
        { id: 'enemy', initialHp: 3, maxHp: 3, initialResources: [{ resourceId: 'focus', value: 0 }] },
      ] }, [enemyTarget]), executionContractId: 'AG-1' as const,
      initialActorResources: [
        { characterId: 'shiroko', resourceId: 'focus', value: 0 },
        { characterId: 'serika', resourceId: 'focus', value: 0 },
      ],
    };
    expect(() => load(enemyTargetMap)).not.toThrow();

    const enemyNatural = {
      ...enemyTarget, eligibleCharacterIds: [], effectProgram: { resolve: [
        { op: 'resourceChange', account: 'additionalActor', resourceId: 'focus', delta: 1 },
      ] },
    };
    expect(() => load({
      ...withEncounter({ title: 'Enemy additional writer', enemies: [{ id: 'enemy', initialHp: 3, maxHp: 3,
        initialResources: [{ resourceId: 'focus', value: 0 }], actions: [{ actionId: 'additional-enemy', tendencyWeight: 1 }] }] }, [enemyNatural]),
      executionContractId: 'AG-1',
    })).toThrow(/Enemy natural sources cannot write to additionalActor|additionalTarget Actions cannot be referenced by Enemy sources/);
  });

  test('rejects MapRun Fact Conditions in Encounter completion and binds Fact IDs by separate domains', () => {
    const mapFacts = {
      counters: [{ id: 'steps', initial: 0, min: 0, max: 3 }],
      flags: [{ id: 'opened', initial: false }],
    };
    const completion = {
      title: 'Fact completion',
      completion: { kind: 'condition', label: 'Finish', condition: {
        kind: 'not', condition: { kind: 'mapRunCounter', counterId: 'steps', comparison: 'gte', value: 1 },
      } },
    };
    expect(() => load({
      ...withEncounter(completion), executionContractId: 'AG-1', mapRunFacts: mapFacts,
    })).toThrow(/MapRun Fact conditions are only available in Action Effect Program when statements/);

    const resourceCompletion = {
      title: 'Resource completion',
      completion: { kind: 'condition', label: 'Finish', condition: {
        kind: 'resourceAtLeast', account: 'sourceActor', resourceId: 'focus', value: 0,
      } },
    };
    expect(() => load({
      ...withEncounter(resourceCompletion), executionContractId: 'AG-1',
      initialActorResources: [{ characterId: 'shiroko', resourceId: 'focus', value: 0 }],
    })).toThrow(/Encounter completion has no Action source context for resource balance conditions/);

    const wrongDomain = {
      ...baseAction,
      effectProgram: { resolve: [{ op: 'when', condition: { kind: 'all', conditions: [
        { kind: 'mapRunFlag', flagId: 'steps', value: true },
        { kind: 'mapRunCounter', counterId: 'opened', comparison: 'gte', value: 1 },
      ] }, then: [] }] },
    };
    const encounter = { title: 'Fact domains', participants: [
      { characterId: 'shiroko', actions: [{ actionId: wrongDomain.id, tendencyWeight: 1 }] },
    ] };
    expect(() => load({
      ...withEncounter(encounter, [wrongDomain]), executionContractId: 'AG-1', mapRunFacts: mapFacts,
    })).toThrow(/mapRunFlag "steps" is not declared in Map mapRunFacts/);

    const wrongCounterDomain = {
      ...baseAction, id: 'wrong-counter-domain',
      effectProgram: { resolve: [{ op: 'when', condition: {
        kind: 'mapRunCounter', counterId: 'opened', comparison: 'gte', value: 1,
      }, then: [] }] },
    };
    const counterEncounter = { title: 'Counter domain', participants: [
      { characterId: 'shiroko', actions: [{ actionId: wrongCounterDomain.id, tendencyWeight: 1 }] },
    ] };
    expect(() => load({
      ...withEncounter(counterEncounter, [wrongCounterDomain]), executionContractId: 'AG-1', mapRunFacts: mapFacts,
    })).toThrow(/mapRunCounter "opened" is not declared in Map mapRunFacts/);

    const validFactReads = {
      ...baseAction, id: 'valid-fact-reads',
      effectProgram: { resolve: [{ op: 'when', condition: {
        kind: 'mapRunFlag', flagId: 'opened', value: false,
      }, then: [{ op: 'heal', target: { set: { side: 'party' } }, amount: {
        kind: 'mapRunCounter', counterId: 'steps',
      } }] }] },
    };
    const validFactEncounter = { title: 'Valid Fact reads', participants: [
      { characterId: 'shiroko', actions: [{ actionId: validFactReads.id, tendencyWeight: 1 }] },
    ] };
    expect(() => load({
      ...withEncounter(validFactEncounter, [validFactReads]), executionContractId: 'AG-1', mapRunFacts: mapFacts,
    })).not.toThrow();

    const wrongFactWrites = [
      { ...baseAction, id: 'counter-to-flag', effectProgram: { resolve: [
        { op: 'mapRunCounterAdd', counterId: 'opened', delta: 1 },
      ] } },
      { ...baseAction, id: 'flag-to-counter', effectProgram: { resolve: [
        { op: 'mapRunFlagSet', flagId: 'steps', value: true },
      ] } },
    ];
    for (const action of wrongFactWrites) {
      const actionEncounter = { title: action.id, participants: [
        { characterId: 'shiroko', actions: [{ actionId: action.id, tendencyWeight: 1 }] },
      ] };
      expect(() => load({
        ...withEncounter(actionEncounter, [action]), executionContractId: 'AG-1', mapRunFacts: mapFacts,
      })).toThrow(new RegExp(`(?:mapRunCounter|mapRunFlag) "(?:opened|steps)" is not declared in Map mapRunFacts`));
    }
  });

  test('binds nested loopTarget resource accounts to the innermost side and restores the outer side afterward', () => {
    const nestedLoop = {
      ...baseAction,
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'forTargets', targetSet: { side: 'party' }, body: [
        { op: 'forTargets', targetSet: { side: 'enemy' }, body: [
          { op: 'when', condition: { kind: 'resourceAtLeast', account: 'loopTargetActor', resourceId: 'enemy-focus', value: 0 }, then: [] },
        ] },
        { op: 'when', condition: { kind: 'resourceAtLeast', account: 'loopTargetActor', resourceId: 'party-focus', value: 0 }, then: [] },
      ] }] },
    };
    const encounter = { title: 'Nested loop', enemies: [{ id: 'raider', initialHp: 3, maxHp: 3,
      initialResources: [{ resourceId: 'enemy-focus', value: 0 }] }], participants: [
      { characterId: 'shiroko', actions: [{ actionId: nestedLoop.id, tendencyWeight: 1 }] },
    ] };
    expect(() => load({
      ...withEncounter(encounter, [nestedLoop]), executionContractId: 'AG-1',
      initialActorResources: [{ characterId: 'shiroko', resourceId: 'party-focus', value: 0 }],
    })).not.toThrow();
  });

  test.each(['effects', 'hpEffects', 'cardEffects'] as const)('rejects legacy Action %s as an unknown raw Registry field', field => {
    const program = { ...baseAction, effectProgram: { resolve: [{ op: 'flagSet', flagId: 'ready', value: true }] } };
    const rawLegacy = { id: 'legacy', name: 'Legacy', eligibleCharacterIds: ['serika'], target: { kind: 'none' }, [field]: [] };
    const encounter = { title: 'Mixed Map', locals: { flags: [{ id: 'ready', initial: false }] }, participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'observe', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'legacy', tendencyWeight: 1 }] },
    ] };
    const map = withEncounter(encounter, [program, rawLegacy]);
    expect(() => load(map)).toThrow(new RegExp(`actions\\[1\\].*合同外字段 "${field}"`));
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

  test('binds healApplied triggers to an AG-1 primary Heal and validates the primary resource', () => {
    const trigger = { id: 'heal-reward', event: 'healApplied', minimumActualAmount: 1, effect: {
      op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1,
    } };
    const healer = actorlessAction('healer', { kind: 'enemy' }, {
      resolve: [{ op: 'heal', target: 'primary', amount: 2 }], triggers: [trigger],
    });
    const encounter = { title: 'Heal trigger', enemies: [{ id: 'enemy', initialHp: 3, maxHp: 5,
      initialResources: [{ resourceId: 'focus', value: 0 }] }], abilityActionIds: ['healer'] };
    expect(() => load(withEncounter(encounter, [healer], { executionContractId: 'AG-1' }))).not.toThrow();
    expect(() => load(withEncounter(encounter, [healer]))).toThrow(/executionContractId AG-1/);

    const missingHeal = { ...healer, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }], triggers: [trigger] } };
    expect(validateGameplayMapEffectContext(withActions([missingHeal], { executionContractId: 'AG-1' }))
      .map(issue => issue.message).join(' ')).toMatch(/requires a primary heal in the same Action Program/);
    const setHeal = { ...healer, effectProgram: { resolve: [{ op: 'heal', target: { set: { side: 'enemy' } }, amount: 1 }], triggers: [trigger] } };
    expect(validateGameplayMapEffectContext(withActions([setHeal], { executionContractId: 'AG-1' }))
      .map(issue => issue.message).join(' ')).toMatch(/requires a primary heal in the same Action Program/);

    const undeclaredResource = { ...encounter, enemies: [{ id: 'enemy', initialHp: 3, maxHp: 5 }] };
    expect(() => load(withEncounter(undeclaredResource, [healer], { executionContractId: 'AG-1' })))
      .toThrow(/resource "focus" is not declared for possible primary enemy "enemy"/);
    const cardTarget = { ...healer, target: { kind: 'card', side: 'ally' } };
    expect(validateGameplayMapEffectContext(withActions([cardTarget], { executionContractId: 'AG-1' }))
      .map(issue => issue.message).join(' ')).toMatch(/single unit primary target/);

    const damageTrigger = { ...trigger, id: 'damage-reward', event: 'damageApplied' };
    const damager = actorlessAction('damager', { kind: 'enemy' }, {
      resolve: [{ op: 'damage', target: 'primary', amount: 2 }], triggers: [damageTrigger],
    });
    expect(() => load(withEncounter({ ...encounter, abilityActionIds: ['damager'] }, [damager], { executionContractId: 'AG-1' }))).not.toThrow();
    const wrongDamageBinding = { ...damager, effectProgram: {
      resolve: [{ op: 'heal', target: 'primary', amount: 2 }], triggers: [damageTrigger],
    } };
    expect(validateGameplayMapEffectContext(withActions([wrongDamageBinding], { executionContractId: 'AG-1' }))
      .map(issue => issue.message).join(' ')).toMatch(/damageApplied trigger requires a primary damage/);
    const setDamageBinding = { ...damager, effectProgram: {
      resolve: [{ op: 'damage', target: { set: { side: 'enemy' } }, amount: 2 }], triggers: [damageTrigger],
    } };
    expect(validateGameplayMapEffectContext(withActions([setDamageBinding], { executionContractId: 'AG-1' }))
      .map(issue => issue.message).join(' ')).toMatch(/damageApplied trigger requires a primary damage/);
  });

  test('binds enemyDefeated only to a Party direct Enemy hit and source Actor resource', () => {
    const trigger = { id: 'ammo-on-defeat', event: 'enemyDefeated', effect: {
      op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1,
    } };
    const finisher = { id: 'finisher', name: 'Finisher', eligibleCharacterIds: ['shiroko'],
      target: { kind: 'enemy' }, effectProgram: {
        resolve: [{ op: 'damage', target: 'primary', amount: 3 }], triggers: [trigger],
      } };
    const encounter = { title: 'Defeat trigger', enemies: [{ id: 'enemy', initialHp: 3, maxHp: 3 }],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'finisher', tendencyWeight: 1 }] }] };
    const resources = [{ characterId: 'shiroko', resourceId: 'ammo', value: 0 }];
    expect(() => load(withEncounter(encounter, [finisher], {
      executionContractId: 'AG-1', initialActorResources: resources,
    }))).not.toThrow();

    const missingSourceResource = { ...encounter, enemies: [{ id: 'enemy', initialHp: 3, maxHp: 3 }] };
    expect(() => load(withEncounter(missingSourceResource, [finisher], { executionContractId: 'AG-1' })))
      .toThrow(/resource "ammo" is not declared for source party "shiroko"/);

    const wrongTarget = { ...finisher, target: { kind: 'partyCharacter' } };
    expect(validateGameplayMapEffectContext(withEncounter(encounter, [wrongTarget], { executionContractId: 'AG-1' }))
      .map(issue => issue.message).join(' ')).toMatch(/enemyDefeated requires target: 'enemy'/);

    const loopOnly = { ...finisher, effectProgram: { resolve: [{ op: 'forTargets', targetSet: { side: 'enemy' },
      body: [{ op: 'damage', target: 'primary', amount: 1 }] }], triggers: [trigger] } };
    expect(validateGameplayMapEffectContext(withEncounter(encounter, [loopOnly], { executionContractId: 'AG-1' }))
      .map(issue => issue.message).join(' ')).toMatch(/requires a direct primary damage statement outside forTargets/);

    const actorless = actorlessAction('ability-kill', { kind: 'enemy' }, {
      resolve: [{ op: 'damage', target: 'primary', amount: 1 }], triggers: [trigger],
    });
    expect(() => load(withEncounter({ ...encounter, participants: [], abilityActionIds: ['ability-kill'] }, [actorless], {
      executionContractId: 'AG-1', initialActorResources: resources,
    }))).toThrow(/enemyDefeated requires a Party Actor source/);

    expect(() => load(withEncounter(encounter, [{ ...finisher, effectProgram: { ...finisher.effectProgram,
      triggers: [{ ...trigger, minimumActualAmount: 1 }] } }], {
      executionContractId: 'AG-1', initialActorResources: resources,
    }))).toThrow(/enemyDefeated does not accept a damage threshold/);
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

  test('rejects undeclared locals but allows a legal condition completion round', () => {
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
    })).toThrow(/flag "unused" is not declared/);
    expect(service.getSnapshot()).toEqual(before);

    const conditionMap: GameplayMapDef = {
      ...baseMap, actions: [baseAction], nodes: baseMap.nodes.map(node => node.id === 'middle' ? { ...node, encounter: {
        title: 'Condition', locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 2 }] },
        completion: { kind: 'condition', label: 'Finish', condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 1 } },
      } } : node),
    };
    const conditionService = new MapRunService({ resolve: id => id === conditionMap.id ? conditionMap : null }, id => ({ Shiroko: 'shiroko', Serika: 'serika' } as Record<string, string>)[id] ?? null);
    const conditionStart = conditionService.start(conditionMap.id, [{ characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' }]);
    const conditionEntered = conditionService.move(conditionStart.runId, 'middle');
    expect(conditionService.previewEncounterCommit(conditionStart.runId)).toMatchObject({ canCommit: true, diagnostics: [] });
    const conditionRound = conditionService.commitEncounterRound({
      runId: conditionStart.runId,
      requestId: 'condition-round',
      expectedCommitVersion: conditionEntered.commitVersion,
      draft: {
        nodeId: 'middle',
        round: conditionEntered.activeEncounter!.round,
        draftVersion: conditionEntered.activeEncounter!.draftVersion,
      },
    });
    expect(conditionRound.activeEncounter?.round).toBe(conditionEntered.activeEncounter!.round + 1);
    expect(conditionRound.activeEncounter?.locals?.counters.trust?.value).toBe(0);
    expect(conditionRound.completedEncounterNodeIds).not.toContain('middle');
  });
});
