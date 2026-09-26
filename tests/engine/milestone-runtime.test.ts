import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Datapack, MilestoneDef, MilestoneListenerDef } from '../../src/data-services/contracts/datapack';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { RevealTrigger } from '../../src/engine/types/reveal';

const OFFICE = 'base:init:schale_office';
const CREDIT = 'test:resource:milestone-runtime-credit';
const MILESTONE = 'test:milestone:runtime-credit';
const condition = { target: 'resource' as const, key: CREDIT, comparator: '>=' as const, value: 10 };

function pack(milestones: MilestoneDef[], milestoneListeners: MilestoneListenerDef[] = []): Datapack {
  return {
    name: 'Milestone runtime test', version: '1.0.0', modName: 'test',
    inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [],
    stories: [], items: [], funcletDefs: [], characters: [], milestones, milestoneListeners,
  };
}

describe('Milestone runtime projection', () => {
  let game: GameInstance | undefined;

  afterEach(() => { game?.stop(); game = undefined; });

  function setup(
    defs: MilestoneDef[] = [{ id: MILESTONE, condition }],
    listeners: MilestoneListenerDef[] = [],
  ): GameInstance {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.registry.load(pack(defs, listeners));
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
    return game;
  }

  function milestoneRegistrations(g: GameInstance) {
    return g.triggerSystem.getDefinitions().filter(def => def.id?.startsWith('milestone-runtime:'));
  }

  function areaListener(
    id: string,
    milestoneId: string,
    areaId: string,
    then: MilestoneListenerDef['then'] = [],
  ): MilestoneListenerDef {
    return { id, milestoneId, areaId, then };
  }

  function defaultAreaId(): string {
    return baseDatapack.inits.find(init => init.id === OFFICE)!.defaultAreas[0];
  }

  function firstAdjacentAreaId(): string {
    const currentArea = baseDatapack.areas.find(area => area.id === defaultAreaId())!;
    const areaId = (currentArea.adjacentAreaIds ?? []).find(id => baseDatapack.areas.some(area => area.id === id && area.initId === OFFICE));
    expect(areaId).toBeDefined();
    return areaId!;
  }

  test('routes a matching event to both Reveal and Milestone handlers', () => {
    const g = setup();
    const office = g.registry.inits.get(OFFICE)!;
    const reveal: RevealTrigger = { reveal: 'name', condition };
    (g.registry.inits as unknown as Map<string, typeof office>).set(OFFICE, { ...office, revealTriggers: [reveal] });
    g.inits.reconcileInformationRevealWatches();

    expect(g.triggerSystem.getDefinitions().some(def => def.id?.startsWith('information-reveal-runtime:'))).toBe(true);
    expect(milestoneRegistrations(g)).toHaveLength(1);
    g.mutations.setResource(CREDIT, 10);

    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'name' });
    expect(milestoneRegistrations(g)).toHaveLength(0);
  });

  test('rebuilds unfinished watches after Save restore and keeps completed orphan facts', () => {
    const g = setup();
    expect(milestoneRegistrations(g)).toHaveLength(1);
    g.load(g.save());
    expect(milestoneRegistrations(g)).toHaveLength(1);

    g.mutations.setResource(CREDIT, 10);
    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    const save = g.save();
    (g.registry.milestones as unknown as Map<string, MilestoneDef>).delete(MILESTONE);
    g.load(save);

    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(milestoneRegistrations(g)).toHaveLength(0);
  });

  test('admits the default Area listener after Init entry records its visit', () => {
    const startAreaId = defaultAreaId();
    const g = setup([{ id: MILESTONE, condition }], [areaListener('test:milestone-listener:default', MILESTONE, startAreaId)]);

    expect(g.state.visitedAreas).toContain(startAreaId);
    expect(milestoneRegistrations(g)).toHaveLength(1);
  });

  test('admits first-visit listeners on travel and rebuilds unfinished watches after Init return and Save restore', () => {
    const travelMilestone = 'test:milestone:travel-area';
    const pendingMilestone = 'test:milestone:travel-area-pending';
    const pendingCondition = { ...condition, value: 20 };
    const targetAreaId = firstAdjacentAreaId();
    const g = setup([
      { id: travelMilestone, condition },
      { id: pendingMilestone, condition: pendingCondition },
    ], [
      areaListener('test:milestone-listener:travel', travelMilestone, targetAreaId),
      areaListener('test:milestone-listener:travel-pending', pendingMilestone, targetAreaId),
    ]);
    const pendingKey = `milestone-runtime:${pendingMilestone}:0`;

    expect(g.state.visitedAreas).not.toContain(targetAreaId);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    g.mutations.setResource(CREDIT, 10);
    expect(g.state.milestoneProgress?.completed).not.toContain(travelMilestone);

    expect(g.inits.travelToArea(targetAreaId, true).success).toBe(true);
    expect(g.state.visitedAreas).toContain(targetAreaId);
    expect(g.state.milestoneProgress?.completed).toContain(travelMilestone);
    expect(g.state.milestoneProgress?.completed).not.toContain(pendingMilestone);
    expect(milestoneRegistrations(g)).toHaveLength(1);

    const save = g.save();
    g.load(save);
    expect(g.state.milestoneProgress?.completed).toContain(travelMilestone);
    expect(milestoneRegistrations(g)).toHaveLength(1);

    const originalWithdraw = g.triggerSystem.withdraw.bind(g.triggerSystem);
    const withdrawSpy = vi.spyOn(g.triggerSystem, 'withdraw').mockImplementation(key => originalWithdraw(key));
    expect(g.inits.resumeInit(OFFICE)).toBe(true);
    expect(withdrawSpy).toHaveBeenCalledWith(pendingKey);
    withdrawSpy.mockRestore();
    expect(g.state.visitedAreas).toContain(targetAreaId);
    expect(g.state.milestoneProgress?.completed).toContain(travelMilestone);
    expect(milestoneRegistrations(g)).toHaveLength(1);

    const originalComplete = g.mutations.completeMilestone.bind(g.mutations);
    let pendingCompletions = 0;
    const completionSpy = vi.spyOn(g.mutations, 'completeMilestone').mockImplementation(id => {
      const committed = originalComplete(id);
      if (id === pendingMilestone && committed) pendingCompletions += 1;
      return committed;
    });
    g.mutations.setResource(CREDIT, 20);
    expect(g.state.milestoneProgress?.completed).toContain(pendingMilestone);
    expect(pendingCompletions).toBe(1);
    expect(milestoneRegistrations(g)).toHaveLength(0);

    g.load(g.save());
    expect(g.state.milestoneProgress?.completed).toContain(pendingMilestone);
    expect(pendingCompletions).toBe(1);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    completionSpy.mockRestore();
  });

  test('register-time event reentry and admission produce one effective completion and withdraw all sources', () => {
    const g = setup([{ id: MILESTONE, condition: {
      type: 'AND', conditions: [condition, { target: 'alwaysTrue', key: '', comparator: '==', value: 1 }],
    } }]);
    g.inits.withdrawInformationRevealWatches();
    const originalRegister = g.triggerSystem.register.bind(g.triggerSystem);
    let emitted = false;
    vi.spyOn(g.triggerSystem, 'register').mockImplementation(request => {
      const token = originalRegister(request);
      if (request.key.startsWith('milestone-runtime:') && !emitted) {
        emitted = true;
        g.mutations.setResource(CREDIT, 10);
      }
      return token;
    });
    const originalComplete = g.mutations.completeMilestone.bind(g.mutations);
    let successfulWrites = 0;
    const completeSpy = vi.spyOn(g.mutations, 'completeMilestone').mockImplementation(id => {
      const result = originalComplete(id);
      if (result) successfulWrites += 1;
      return result;
    });

    g.inits.reconcileInformationRevealWatches();

    expect(successfulWrites).toBe(1);
    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    completeSpy.mockRestore();
  });

  test('applies Listener then once after commit and does not replay it on save, return, or definition update', () => {
    const id = 'test:milestone:then-once';
    const listenerId = 'test:milestone-listener:then-once';
    const thenEffect: MilestoneListenerDef['then'][number] = { op: 'addResource', target: CREDIT, value: 5 };
    const g = setup([{ id, condition }], [areaListener(listenerId, id, defaultAreaId(), [thenEffect])]);
    const originalApply = g.effectEngine.applyEffects.bind(g.effectEngine);
    let thenExecutions = 0;
    let committedBeforeThen = false;
    let watchWithdrawnBeforeThen = false;
    const applySpy = vi.spyOn(g.effectEngine, 'applyEffects').mockImplementation(effects => {
      if (JSON.stringify(effects) === JSON.stringify([thenEffect])) {
        thenExecutions += 1;
        committedBeforeThen = g.state.milestoneProgress?.completed.includes(id) ?? false;
        watchWithdrawnBeforeThen = !g.triggerSystem.getDefinitions().some(def => def.id?.startsWith(`milestone-runtime:${id}:`));
      }
      originalApply(effects);
    });

    g.mutations.setResource(CREDIT, 10);

    expect(g.state.milestoneProgress?.completed).toContain(id);
    expect(g.state.resources[CREDIT]).toBe(15);
    expect(thenExecutions).toBe(1);
    expect(committedBeforeThen).toBe(true);
    expect(watchWithdrawnBeforeThen).toBe(true);

    g.load(g.save());
    expect(g.inits.resumeInit(OFFICE)).toBe(true);
    const updatedEffect: MilestoneListenerDef['then'][number] = { ...thenEffect, value: 20 };
    g.registry.load(pack(
      [{ id, condition: { ...condition, value: 20 } }],
      [areaListener(listenerId, id, defaultAreaId(), [updatedEffect])],
    ));
    g.inits.reconcileInformationRevealWatches();

    expect(g.state.milestoneProgress?.completed).toContain(id);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    expect(thenExecutions).toBe(1);
    applySpy.mockRestore();
  });

  test('keeps completion after a throwing Listener then, logs both IDs, and does not retry', () => {
    const id = 'test:milestone:then-failure';
    const listenerId = 'test:milestone-listener:then-failure';
    const thenEffect: MilestoneListenerDef['then'][number] = { op: 'addResource', target: CREDIT, value: 5 };
    const g = setup([{ id, condition }], [areaListener(listenerId, id, defaultAreaId(), [thenEffect])]);
    const originalApply = g.effectEngine.applyEffects.bind(g.effectEngine);
    let thenExecutions = 0;
    const applySpy = vi.spyOn(g.effectEngine, 'applyEffects').mockImplementation(effects => {
      if (JSON.stringify(effects) === JSON.stringify([thenEffect])) {
        thenExecutions += 1;
        throw new Error('test Listener effect failure');
      }
      originalApply(effects);
    });

    expect(() => g.mutations.setResource(CREDIT, 10)).not.toThrow();
    expect(g.state.milestoneProgress?.completed).toContain(id);
    const error = g.devLog.getEntries().find(entry => entry.source === 'milestone'
      && entry.level === 'error' && entry.message.includes(listenerId) && entry.message.includes(id));
    expect(error?.details).toContain('test Listener effect failure');
    expect(thenExecutions).toBe(1);

    g.load(g.save());
    expect(g.inits.resumeInit(OFFICE)).toBe(true);
    const updatedEffect: MilestoneListenerDef['then'][number] = { ...thenEffect, value: 20 };
    g.registry.load(pack(
      [{ id, condition: { ...condition, value: 20 } }],
      [areaListener(listenerId, id, defaultAreaId(), [updatedEffect])],
    ));
    g.inits.reconcileInformationRevealWatches();

    expect(g.state.milestoneProgress?.completed).toContain(id);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    expect(thenExecutions).toBe(1);
    applySpy.mockRestore();
  });

  test('keeps unassociated legacy Milestones effect-free', () => {
    const id = 'test:milestone:legacy-no-then';
    const g = setup([{ id, condition }]);
    const applySpy = vi.spyOn(g.effectEngine, 'applyEffects');

    g.mutations.setResource(CREDIT, 10);

    expect(g.state.milestoneProgress?.completed).toContain(id);
    expect(applySpy).not.toHaveBeenCalled();
    applySpy.mockRestore();
  });
});
