import { describe, expect, it, vi } from 'vitest';
import type { MapEffectTraceEntry } from '../../src/arona-clicker/contracts/map/map-effects';
import type { MapRunEncounterCommitCommand } from '../../src/arona-clicker/contracts/map/map-run';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import {
  copyMapEffectTrace,
  copyMapEncounterLocalsState,
  initializeMapEncounterLocals,
} from '../../src/arona-clicker/services/map/map-encounter-locals';
import {
  createLegacyGoldenRuntime,
  LEGACY_GOLDEN_ITEM_ID,
  legacyGoldenMap,
} from './gameplay-b-effect-test-fixtures';

function runtimeEncounterCommand(game: GameInstance, gameRunId: string, requestId: string): MapRunEncounterCommitCommand {
  const run = game.mapRun.getSnapshot();
  const encounter = run?.activeEncounter;
  if (!run || !encounter) throw new Error('Expected an active runtime Encounter');
  return {
    runId: gameRunId,
    requestId,
    expectedCommitVersion: run.commitVersion,
    draft: {
      nodeId: encounter.nodeId,
      ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
      round: encounter.round,
      draftVersion: encounter.draftVersion,
    },
  };
}

function commitWaitRound(game: ReturnType<typeof createLegacyGoldenRuntime>, runId: string) {
  const run = game.mapRun.getSnapshot();
  const encounter = run?.activeEncounter;
  if (!run || !encounter) throw new Error('Expected an active Encounter');
  const command: MapRunEncounterCommitCommand = {
    runId,
    requestId: `locals-wait-round-${encounter.round}`,
    expectedCommitVersion: run.commitVersion,
    draft: {
      nodeId: encounter.nodeId,
      ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
      round: encounter.round,
      draftVersion: encounter.draftVersion,
    },
  };
  return game.commitMapEncounterRound(command);
}

function encounterMap(id: string): GameplayMapDef {
  const base = legacyGoldenMap({
    id,
    actions: [],
    participants: [{ characterId: 'shiroko', actions: [] }],
  });
  return {
    ...base,
    nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
      id: 'battle',
      title: 'Encounter activities',
      activities: [
        {
          id: 'first',
          encounter: {
            title: 'First Encounter',
            completion: { kind: 'manual', label: 'Continue' },
            participants: [{ characterId: 'shiroko', actions: [] }],
            locals: {
              counters: [{ id: 'progress', initial: 4, min: 0, max: 8 }],
              flags: [{ id: 'opened', initial: true }],
            },
          },
        },
        {
          id: 'second',
          encounter: {
            title: 'Second Encounter',
            completion: { kind: 'manual', label: 'Finish' },
            participants: [{ characterId: 'shiroko', actions: [] }],
            locals: {
              counters: [{ id: 'progress', initial: 11, min: 10, max: 20 }],
              flags: [{ id: 'opened', initial: false }],
            },
          },
        },
      ],
    }),
  };
}

describe('Gameplay B Encounter locals lifecycle', () => {
  it('condition transition preparations are reproducible and do not consume global RNG', () => {
    const base = legacyGoldenMap({
      id: 'test:map:effect-lifecycle-seed-repro',
      actions: [],
      participants: [{ characterId: 'shiroko', actions: [] }],
    });
    const map: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Activities', activities: [
          { id: 'first', encounter: {
            title: 'First', completion: { kind: 'condition', label: 'Ready', condition: { kind: 'flag', flagId: 'ready', value: true } },
            participants: [{ characterId: 'shiroko', actions: [] }], locals: { flags: [{ id: 'ready', initial: true }] },
          } },
          { id: 'second', encounter: { title: 'Second', completion: { kind: 'manual', label: 'Finish' }, participants: [{ characterId: 'shiroko', actions: [] }] } },
        ],
      }),
    };
    const game = createLegacyGoldenRuntime(map);
    try {
      const admitted = game.startMap(map.id);
      const moved = game.moveMap(admitted.runId, 'battle');
      const party = moved.party;
      const service = new MapRunService({ resolve: id => id === map.id ? map : null },
        variantId => game.rosterSystem.getAllVariants().find(variant => variant.id === variantId)?.proto ?? null);
      const run = service.start(map.id, party);
      service.move(run.runId, 'battle');
      const current = service.getSnapshot()!;
      const encounter = current.activeEncounter!;
      const command = (requestId: string) => ({
        runId: current.runId, requestId, expectedCommitVersion: current.commitVersion,
        draft: { nodeId: encounter.nodeId, activityId: encounter.activityId, round: encounter.round, draftVersion: encounter.draftVersion },
      });
      const random = vi.spyOn(Math, 'random');
      expect(service.previewEncounterCommit(run.runId)?.canCommit).toBe(true);
      const first = service.prepareEncounterRoundCommit(command('repro-first'));
      const second = service.prepareEncounterRoundCommit(command('repro-second'));
      expect(first.snapshot.activeEncounter?.randomState).toEqual(second.snapshot.activeEncounter?.randomState);
      expect(random).not.toHaveBeenCalled();
      expect(service.canInstallPreparedEncounterCommit(first)).toBe(true);
      service.installPreparedEncounterCommit(first);
      expect(service.getSnapshot()?.activeEncounter?.activityId).toBe('second');
      expect(service.getSnapshot()?.activeEncounter?.randomState).toEqual(first.snapshot.activeEncounter?.randomState);
      expect(service.canInstallPreparedEncounterCommit(second)).toBe(false);
      random.mockRestore();
    } finally {
      game.dispose();
    }
  });

  it('reuses the condition kernel at the inclusive 64-node completion boundary', () => {
    const participants = [{ characterId: 'shiroko', actions: [] }];
    const base = legacyGoldenMap({ id: 'test:map:effect-condition-64', actions: [], participants });
    const leaves = Array.from({ length: 63 }, () => ({ kind: 'counter' as const, counterId: 'trust', comparison: 'gte' as const, value: 0 }));
    const map: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Activities', activities: [
          { id: 'wide-condition', encounter: {
            title: 'Wide condition', participants,
            completion: { kind: 'condition', label: 'All checks', condition: { kind: 'all', conditions: leaves } },
            locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 1 }] },
          } },
          { id: 'next', encounter: { title: 'Next', completion: { kind: 'manual', label: 'Finish' }, participants } },
        ],
      }),
    };
    const game = createLegacyGoldenRuntime(map);
    try {
      const started = game.startMap(map.id);
      game.moveMap(started.runId, 'battle');
      const workspace = game.mapRun.getWorkspaceView(started.runId);
      if (workspace?.kind !== 'active' || !workspace.actionPreview) throw new Error('Expected an active condition workspace');
      const preview = workspace.actionPreview.commitPreview;
      expect(preview.canCommit).toBe(true);
      const committed = game.commitMapEncounterRound(runtimeEncounterCommand(game, started.runId, 'condition-64'));
      expect(committed.activeEncounter?.activityId).toBe('next');
    } finally {
      game.dispose();
    }
  });

  it('Registry rejects a 65-node completion condition before Owner start', () => {
    const participants = [{ characterId: 'shiroko', actions: [] }];
    const base = legacyGoldenMap({ id: 'test:map:effect-condition-65', actions: [], participants });
    const leaves = Array.from({ length: 64 }, () => ({ kind: 'counter' as const, counterId: 'trust', comparison: 'gte' as const, value: 0 }));
    const map: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Activities', activities: [{ id: 'wide-condition', encounter: {
          title: 'Invalid wide condition', participants,
          completion: { kind: 'condition', label: 'Too many checks', condition: { kind: 'all', conditions: leaves } },
          locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 1 }] },
        } }],
      }),
    };
    expect(() => createLegacyGoldenRuntime(map)).toThrow(/Static program node limit exceeded/);
  });

  it('Service revalidates an over-budget completion condition from a custom resolver', () => {
    const participants = [{ characterId: 'shiroko', actions: [] }];
    const registryMap = legacyGoldenMap({ id: 'test:map:effect-condition-custom-owner', actions: [], participants });
    const game = createLegacyGoldenRuntime(registryMap);
    try {
      const started = game.startMap(registryMap.id);
      const admittedParty = game.mapRun.getSnapshot()?.party;
      if (!admittedParty) throw new Error('Registry Owner did not admit a party snapshot');
      const leaves = Array.from({ length: 64 }, () => ({ kind: 'counter' as const, counterId: 'trust', comparison: 'gte' as const, value: 0 }));
      const invalidMap: GameplayMapDef = {
        ...legacyGoldenMap({ id: 'test:map:effect-condition-custom-invalid', actions: [], participants }),
        nodes: registryMap.nodes.map(node => node.id !== 'battle' ? node : {
          id: 'battle', title: 'Activities', activities: [{ id: 'invalid', encounter: {
            title: 'Invalid condition', participants,
            completion: { kind: 'condition', label: 'Too many checks', condition: { kind: 'all', conditions: leaves } },
            locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 1 }] },
          } }],
        }),
      };
      const service = new MapRunService(
        { resolve: mapId => mapId === invalidMap.id ? invalidMap : null },
        variantId => game.rosterSystem.getAllVariants().find(variant => variant.id === variantId)?.proto ?? null,
      );
      const customRun = service.start(invalidMap.id, admittedParty);
      service.move(customRun.runId, 'battle');
      expect(service.previewEncounterCommit(customRun.runId)).toMatchObject({
        canCommit: false,
        diagnostics: [expect.stringContaining('Static program node limit exceeded')],
      });
      expect(game.mapRun.getSnapshot()?.runId).toBe(started.runId);
    } finally {
      game.dispose();
    }
  });

  it('rejects invalid local declaration shapes and names', () => {
    const invalidDeclarations: unknown[] = [
      [],
      { counters: [], flags: [], extra: true },
      { counters: [{ id: 7, initial: 0, min: 0, max: 1 }] },
      {
        counters: [{ id: 'shared', initial: 0, min: 0, max: 1 }],
        flags: [{ id: 'shared', initial: false }],
      },
    ];
    for (const declaration of invalidDeclarations) {
      expect(() => initializeMapEncounterLocals(declaration as Parameters<typeof initializeMapEncounterLocals>[0]))
        .toThrow(/Invalid Encounter locals/);
    }
    expect(() => copyMapEncounterLocalsState({ counters: { 'bad id': { value: 0, min: 0, max: 1 } }, flags: {} }))
      .toThrow(/Invalid Encounter locals/);
  });

  it('initializes once, survives a real Wait round, resets on the next activity, and clears on exit', () => {
    const map = encounterMap('test:map:effect-lifecycle');
    const game = createLegacyGoldenRuntime(map);
    try {
      const started = game.startMap(map.id);
      const entered = game.moveMap(started.runId, 'battle');
      const firstLocals = entered.activeEncounter?.locals;
      expect(entered.activeEncounter?.activityId).toBe('first');
      expect(firstLocals).toEqual({
        counters: { progress: { value: 4, min: 0, max: 8 } },
        flags: { opened: true },
      });
      expect(Object.isFrozen(firstLocals)).toBe(true);
      expect(Object.isFrozen(firstLocals?.counters)).toBe(true);
      expect(Object.isFrozen(firstLocals?.counters.progress)).toBe(true);
      expect(Object.isFrozen(firstLocals?.flags)).toBe(true);

      const nextRound = commitWaitRound(game, started.runId);
      expect(nextRound.activeEncounter?.round).toBe(2);
      expect(nextRound.activeEncounter?.locals).toEqual(firstLocals);
      expect(nextRound.activeEncounter?.locals).not.toBe(firstLocals);
      expect(nextRound.activeEncounter?.locals?.counters).not.toBe(firstLocals?.counters);

      const secondActivity = game.completeMapEncounter(started.runId);
      expect(secondActivity.activeEncounter?.activityId).toBe('second');
      expect(secondActivity.activeEncounter?.locals).toEqual({
        counters: { progress: { value: 11, min: 10, max: 20 } },
        flags: { opened: false },
      });
      expect(secondActivity.activeEncounter?.locals).not.toBe(nextRound.activeEncounter?.locals);

      const completed = game.completeMapEncounter(started.runId);
      expect(completed.activeEncounter).toBeNull();
      expect(completed.activeActivity).toBeNull();
    } finally {
      game.dispose();
    }
  });

  it('NEW05 checks condition after every paid source, saturates trust, and retains the final receipt across transition', () => {
    const actions = [
      { id: 'trust-first', name: 'Trust first', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' as const },
        effectProgram: { resolve: [{ op: 'counterAdd' as const, counterId: 'trust', delta: 1 }] } },
      { id: 'paid-reward', name: 'Paid reward', eligibleCharacterIds: ['serika'], target: { kind: 'none' as const },
        costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }],
        effectProgram: { resolve: [
          { op: 'counterAdd' as const, counterId: 'trust', delta: 1 },
          { op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'supplies', delta: 2 },
        ] } },
    ];
    const participants = [
      { characterId: 'shiroko', actions: [{ actionId: 'trust-first', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'paid-reward', tendencyWeight: 1 }] },
    ];
    const base = legacyGoldenMap({
      id: 'test:map:effect-condition-new05', actions, participants,
      teamResources: [{ resourceId: 'supplies', value: 1 }],
    });
    const map: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Activities', activities: [
          { id: 'trust', encounter: {
            title: 'Trust', participants,
            completion: { kind: 'condition', label: 'Trust 3', condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 3 } },
            locals: { counters: [{ id: 'trust', initial: 2, min: 0, max: 3 }] },
          } },
          { id: 'after-trust', encounter: {
            title: 'After trust', completion: { kind: 'manual', label: 'Finish' }, participants,
            locals: { counters: [{ id: 'trust', initial: 9, min: 0, max: 10 }] },
          } },
        ],
      }),
    };
    const game = createLegacyGoldenRuntime(map);
    try {
      const started = game.startMap(map.id);
      const entered = game.moveMap(started.runId, 'battle');
      expect(entered.activeEncounter?.locals?.counters.trust.value).toBe(2);

      const committed = game.commitMapEncounterRound(runtimeEncounterCommand(game, started.runId, 'new05-condition-transition'));
      expect(committed.activeEncounter?.activityId).toBe('after-trust');
      expect(committed.activeEncounter?.locals).toEqual({ counters: { trust: { value: 9, min: 0, max: 10 } }, flags: {} });
      expect(committed.teamResources).toContainEqual({ resourceId: 'supplies', value: 2 });
      expect(committed.lastEncounterCommit?.settlements).toHaveLength(2);
      expect(committed.lastEncounterCommit?.plannedLocals?.counters.trust).toEqual({ value: 3, min: 0, max: 3 });
      expect(committed.lastEncounterCommit?.programVisitCount).toBe(3);
      expect(committed.lastEncounterCommit?.programVisits?.map(visit => visit.actionId)).toEqual([
        'trust-first', 'paid-reward', 'paid-reward',
      ]);
      expect(committed.lastEncounterCommit?.effectTrace?.some(row => row.actionId === 'Encounter.completion')).toBe(false);
      expect(committed.lastEncounterCommit?.effectTrace?.filter(row => row.op === 'counterAdd').map(row => row.op === 'counterAdd'
        && [row.before, row.after, row.delta])).toEqual([[2, 3, 1], [3, 3, 0]]);
      expect(committed.lastEncounterCommit?.effectTrace?.find(row => row.op === 'resourceSettlement')).toMatchObject({
        account: 'sourceTeam', resourceId: 'supplies', intentDelta: 2, before: 0, after: 2, delta: 2,
      });
    } finally {
      game.dispose();
    }
  });

  it('F reaches condition after three committed rounds and resets locals for the next activity', () => {
    const participants = [
      { characterId: 'shiroko', actions: [{ actionId: 'trust-step', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
    ];
    const base = legacyGoldenMap({
      id: 'test:map:effect-condition-three-rounds',
      actions: [
        { id: 'trust-step', name: 'Trust step', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'progress', delta: 1 }] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants,
    });
    const map: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Activities', activities: [
          { id: 'three-rounds', encounter: {
            title: 'Three rounds', participants,
            completion: { kind: 'condition', label: 'Progress 3', condition: { kind: 'counter', counterId: 'progress', comparison: 'gte', value: 3 } },
            locals: { counters: [{ id: 'progress', initial: 0, min: 0, max: 3 }] },
          } },
          { id: 'next', encounter: {
            title: 'Next', completion: { kind: 'manual', label: 'Finish' }, participants,
            locals: { counters: [{ id: 'progress', initial: 8, min: 0, max: 10 }] },
          } },
        ],
      }),
    };
    const game = createLegacyGoldenRuntime(map);
    try {
      const started = game.startMap(map.id);
      game.moveMap(started.runId, 'battle');
      for (let round = 1; round <= 3; round += 1) {
        const committed = game.commitMapEncounterRound(runtimeEncounterCommand(game, started.runId, `f-round-${round}`));
        if (round < 3) {
          expect(committed.activeEncounter).toMatchObject({ activityId: 'three-rounds', round: round + 1,
            locals: { counters: { progress: { value: round, min: 0, max: 3 } } } });
        } else {
          expect(committed.activeEncounter).toMatchObject({ activityId: 'next', round: 1,
            locals: { counters: { progress: { value: 8, min: 0, max: 10 } } } });
          expect(committed.lastEncounterCommit?.plannedLocals?.counters.progress).toEqual({ value: 3, min: 0, max: 3 });
          expect(committed.lastEncounterCommit?.effectTrace?.some(row => row.op === 'counterAdd' && row.before === 2 && row.after === 3)).toBe(true);
        }
      }
    } finally {
      game.dispose();
    }
  });

  it('failure wins over a satisfied condition after all legal source effects install', () => {
    const participants = ['shiroko', 'serika'].map(characterId => ({
      characterId, actions: [{ actionId: 'fall-and-trust', tendencyWeight: 1 }],
    }));
    const base = legacyGoldenMap({
      id: 'test:map:effect-condition-failure-priority',
      actions: [{ id: 'fall-and-trust', name: 'Fall and trust', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' },
        effectProgram: { resolve: [
          { op: 'counterAdd', counterId: 'trust', delta: 1 },
          { op: 'hpChange', target: 'source', delta: -10 },
        ] } }],
      participants,
    });
    const map: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Activities', activities: [{ id: 'failure', encounter: {
          title: 'Failure priority', participants,
          completion: { kind: 'condition', label: 'Trust 1', condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 1 } },
          locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 2 }] },
        } }],
      }),
    };
    const game = createLegacyGoldenRuntime(map);
    try {
      const started = game.startMap(map.id);
      game.moveMap(started.runId, 'battle');
      const committed = game.commitMapEncounterRound(runtimeEncounterCommand(game, started.runId, 'condition-failure-priority'));
      expect(committed.status).toBe('failure');
      expect(committed.activeEncounter).toBeNull();
      expect(committed.partyHp).toEqual([{ characterId: 'shiroko', currentHp: 0 }, { characterId: 'serika', currentHp: 0 }]);
      expect(committed.lastEncounterCommit?.plannedLocals?.counters.trust.value).toBe(2);
      expect(committed.lastEncounterCommit?.effectTrace?.filter(row => row.op === 'hpChange')).toHaveLength(2);
    } finally {
      game.dispose();
    }
  });

  it('Item preflight failure leaves a prepared Battle transition retryable without RNG drift', () => {
    const participants = [
      { characterId: 'shiroko', actions: [{ actionId: 'finish-battle', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
    ];
    const base = legacyGoldenMap({
      id: 'test:map:effect-condition-item-retry',
      actions: [
        { id: 'finish-battle', name: 'Finish battle', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
          effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: -5 }] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
        { id: 'item-trust', name: 'Item trust', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }] } },
      ],
      participants,
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-trust' }],
      enemies: [{ id: 'robot', initialHp: 5, maxHp: 5 }],
    });
    const map: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Activities', activities: [
          { id: 'first', encounter: {
            title: 'Item trust', participants, enemies: [{ id: 'robot', initialHp: 5, maxHp: 5 }],
            itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-trust' }],
            locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 1 }] },
          } },
          { id: 'second', encounter: {
            title: 'Next', participants, enemies: [{ id: 'robot', initialHp: 5, maxHp: 5 }],
            locals: { counters: [{ id: 'trust', initial: 7, min: 0, max: 10 }] },
          } },
        ],
      }),
    };
    const game = createLegacyGoldenRuntime(map, 1);
    try {
      const started = game.startMap(map.id);
      const entered = game.moveMap(started.runId, 'battle');
      game.setMapItemDraft(started.runId, LEGACY_GOLDEN_ITEM_ID, { kind: 'partyCharacter', characterId: 'serika' }, {
        nodeId: entered.activeEncounter!.nodeId,
        activityId: entered.activeEncounter!.activityId,
        round: entered.activeEncounter!.round,
        draftVersion: entered.activeEncounter!.draftVersion,
      });
      game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
      const drafted = game.mapRun.getSnapshot()!;
      game.mutations.removeItem(LEGACY_GOLDEN_ITEM_ID, 1);
      const before = game.mapRun.getSnapshot();
      const random = vi.spyOn(Math, 'random');
      const command = runtimeEncounterCommand(game, started.runId, 'condition-item-preflight-retry');
      expect(() => game.commitMapEncounterRound(command)).toThrow(/inventory/i);
      expect(game.mapRun.getSnapshot()).toEqual(before);
      expect(drafted.activeEncounter?.itemDraft?.itemId).toBe(LEGACY_GOLDEN_ITEM_ID);
      expect(random).not.toHaveBeenCalled();

      game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
      const committed = game.commitMapEncounterRound(command);
      expect(committed.activeEncounter).toMatchObject({ activityId: 'second', locals: {
        counters: { trust: { value: 7, min: 0, max: 10 } },
      } });
      expect(committed.lastEncounterCommit?.item).toMatchObject({ itemId: LEGACY_GOLDEN_ITEM_ID, consumedCount: 1 });
      expect(random).not.toHaveBeenCalled();
      random.mockRestore();
    } finally {
      game.dispose();
    }
  });

  it('installs declared program balances and keeps Enemy balances separate from party balances', () => {
    const base = legacyGoldenMap({
      id: 'test:map:effect-resource-install',
      actions: [],
      participants: [{ characterId: 'shiroko', actions: [] }],
    });
    const map: GameplayMapDef = {
      ...base,
      initialActorResources: [
        { characterId: 'shiroko', resourceId: 'program-actor', value: 3 },
        { characterId: 'shiroko', resourceId: 'shared-id', value: 3 },
      ],
      initialTeamResources: [
        { resourceId: 'program-team', value: 4 },
        { resourceId: 'shared-id', value: 5 },
      ],
      actions: [{
        id: 'program-resource-keys',
        name: 'Program resource keys',
        eligibleCharacterIds: [],
        target: { kind: 'none' },
        effectProgram: {
          resolve: [
            { op: 'resourceChange', account: 'sourceActor', resourceId: 'program-actor', delta: 1 },
            {
              op: 'when',
              condition: { kind: 'hpAtLeast', target: 'primary', value: 0 },
              then: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'program-team', delta: 1 }],
            },
          ],
        },
      }],
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
        ...node,
        encounter: {
          title: 'Resources',
          participants: [{ characterId: 'shiroko', actions: [] }],
          enemies: [{
            id: 'foe',
            initialHp: 5,
            maxHp: 5,
            initialResources: [{ resourceId: 'shared-id', value: 2 }],
          }],
          initialEnemyTeamResources: [{ resourceId: 'shared-id', value: 7 }],
        },
      }),
    };
    const game = createLegacyGoldenRuntime(map);
    try {
      const started = game.startMap(map.id);
      const entered = game.moveMap(started.runId, 'battle');
      expect(entered.actorResources).toContainEqual({ characterId: 'shiroko', resourceId: 'program-actor', value: 3 });
      expect(entered.actorResources).toContainEqual({ characterId: 'serika', resourceId: 'program-actor', value: 0 });
      expect(entered.teamResources).toContainEqual({ resourceId: 'program-team', value: 4 });
      expect(entered.actorResources).toContainEqual({ characterId: 'shiroko', resourceId: 'shared-id', value: 3 });
      expect(entered.teamResources).toContainEqual({ resourceId: 'shared-id', value: 5 });
      expect(entered.activeEncounter?.enemyActorResources).toEqual([
        { enemyId: 'foe', resourceId: 'shared-id', value: 2 },
      ]);
      expect(entered.activeEncounter?.enemyTeamResources).toEqual([
        { resourceId: 'shared-id', value: 7 },
      ]);
      expect(entered.activeEncounter?.enemyActorResources).not.toContainEqual({ resourceId: 'shared-id', value: 3 });
      expect(entered.activeEncounter?.enemyTeamResources).not.toContainEqual({ resourceId: 'shared-id', value: 5 });
    } finally {
      game.dispose();
    }
  });

  it('deeply detaches trace entries and condition reads for immutable snapshots', () => {
    const source: MapEffectTraceEntry[] = [{
      sourceKey: 'party:shiroko',
      actionId: 'program',
      path: 'resolve/0',
      op: 'when',
      result: true,
      reads: [{
        path: 'resolve/0/condition',
        op: 'counter',
        identity: { kind: 'encounterLocal' },
        counterId: 'progress',
        current: 4,
        comparison: 'gte',
        value: 4,
        result: true,
      }],
    }];
    const snapshot = copyMapEffectTrace(source);
    const sourceWhen = source[0];
    const when = snapshot[0];
    if (when.op !== 'when' || sourceWhen.op !== 'when') throw new Error('Expected condition trace');
    const copiedRead = when.reads[0];
    const sourceRead = sourceWhen.reads[0];
    if (!('identity' in copiedRead) || !('identity' in sourceRead)) throw new Error('Expected identity-bearing read');
    expect(snapshot).toEqual(source);
    expect(snapshot).not.toBe(source);
    expect(snapshot[0]).not.toBe(source[0]);
    expect(when.reads).not.toBe(sourceWhen.reads);
    expect(copiedRead.identity).not.toBe(sourceRead.identity);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(Object.isFrozen(when.reads[0])).toBe(true);
    expect(Object.isFrozen(copiedRead.identity)).toBe(true);
  });

  it('ticks in fixed Party-then-Enemy order and gives simultaneous Status defeat failure priority', () => {
    const actions = [
      { id: 'mark-self-and-enemy', name: 'Mark both', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' as const },
        effectProgram: { resolve: [
          { op: 'statusApply' as const, target: 'source' as const, statusId: 'burn', stacks: 1, durationRounds: 2 },
          { op: 'statusApply' as const, target: 'primary' as const, statusId: 'burn', stacks: 1, durationRounds: 2 },
        ] } },
      { id: 'mark-serika', name: 'Mark Serika', eligibleCharacterIds: ['serika'], target: { kind: 'self' as const },
        effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'source' as const, statusId: 'burn', stacks: 1, durationRounds: 2 }] } },
    ];
    const base = legacyGoldenMap({
      id: 'test:map:status-terminal-priority',
      partyCharacterIds: ['shiroko', 'serika'],
      partyHp: { shiroko: 1, serika: 1 },
      actions,
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'mark-self-and-enemy', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'mark-serika', tendencyWeight: 1 }] },
      ],
      enemies: [{ id: 'foe', initialHp: 1, maxHp: 1 }],
    });
    const map: GameplayMapDef = {
      ...base,
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 1 }],
      initialPartyHp: [
        { characterId: 'shiroko', initialHp: 1, maxHp: 1 },
        { characterId: 'serika', initialHp: 1, maxHp: 1 },
      ],
    };
    const game = createLegacyGoldenRuntime(map);
    try {
      const started = game.startMap(map.id);
      game.moveMap(started.runId, 'battle');
      const first = game.commitMapEncounterRound(runtimeEncounterCommand(game, started.runId, 'status-death-round-one'));
      expect(first.activeEncounter?.statuses).toHaveLength(3);

      const second = game.commitMapEncounterRound(runtimeEncounterCommand(game, started.runId, 'status-death-round-two'));
      expect(second.status).toBe('failure');
      expect(second.activeEncounter).toBeNull();
      expect(second.partyHp.map(row => row.currentHp)).toEqual([0, 0]);
      expect(second.lastEncounterCommit?.plannedStatuses).toHaveLength(3);
      expect(second.lastEncounterCommit?.plannedStatuses?.every(status => status.remainingRounds === 1)).toBe(true);
      expect(second.lastEncounterCommit?.statusTrace).toMatchObject([
        { holder: { kind: 'partyCharacter', id: 'shiroko' }, hpBefore: 1, hpAfter: 0 },
        { holder: { kind: 'partyCharacter', id: 'serika' }, hpBefore: 1, hpAfter: 0 },
        { holder: { kind: 'enemy', id: 'foe' }, hpBefore: 1, hpAfter: 0 },
      ]);
    } finally {
      game.dispose();
    }
  });
});
