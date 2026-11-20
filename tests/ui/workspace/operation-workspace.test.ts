// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAppRuntime } from '../../../src/app/runtime-bootstrap';
import { defaultDatapack } from '../../../src/arona-clicker/content/default-datapack';
import type { OperationEventDef, OperationRunStartInput } from '../../../src/arona-clicker/contracts/operation/operation';
import type { OperationActionDef } from '../../../src/arona-clicker/contracts/operation/operation-action';
import type { OperationCardPoolDef, OperationStrategyProfileDef } from '../../../src/data-services/contracts/operation';
import { OperationRuntimeService } from '../../../src/arona-clicker/services/operation/operation-runtime-service';
import { createUIContext } from '../../../src/ui/runtime/context';
import { renderOperationWorkspace } from '../../../src/ui/components/operation/operation-workspace';
import { UIController } from '../../../src/ui/controller/controller';
import type { OperationEventLaunchEntry } from '../../../src/arona-clicker/contracts/operation/operation-view';

const ACTOR_ID = 'test:actor:operation-workspace';
const CHARACTER_ID = 'test:character:operation-workspace';
const ACTION_ID = 'test:action:operation-workspace';
const POOL_ID = 'test:pool:operation-workspace';
const STRATEGY_ID = 'test:strategy:operation-workspace';

function operationInput(): OperationRunStartInput {
  const eventDefinition: OperationEventDef = {
    id: 'test:operation:workspace',
    title: '通用 Operation 工作区',
    description: '渲染来自 OperationView 的说明。',
    cardPoolIds: [POOL_ID],
    characterHandSize: 1,
    locations: [{
      id: 'test:location:workspace',
      stage: 'combat',
      enabledActionIds: [ACTION_ID],
      combinationRules: [],
      maxVisits: 1,
      routeEdges: [],
    }],
    maxLocationVisits: 1,
    initialLocationId: 'test:location:workspace',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors: [{ id: ACTOR_ID, type: 'student', positionId: 'front', hp: { initial: 4, min: 0, max: 4 } }],
    playerRouteState: { playerCost: 0 },
    randomSeed: 29,
  };
  const action: OperationActionDef = {
    id: ACTION_ID,
    title: '通用行动',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    strategyTagIds: [],
    target: { kind: 'none' },
    effects: [],
  };
  const profile = {
    id: 'test:profile:operation-workspace',
    characterId: CHARACTER_ID,
    candidateActionIds: [ACTION_ID],
    actionPriorityIds: [ACTION_ID],
    capabilityIds: [],
    reasonIds: [],
    strategyProfileId: STRATEGY_ID,
    cardPoolIds: [],
    actionCandidates: [{
      actionId: ACTION_ID,
      eligible: true,
      requiredCapabilityIds: [],
      missingCapabilityIds: [],
      reasonIds: [],
    }],
    eligibleActionIds: [ACTION_ID],
  } as const;
  const operationCardPools: readonly OperationCardPoolDef[] = [{
    id: POOL_ID,
    selector: { positionIds: ['front'] },
    entries: [{ actionId: ACTION_ID, weight: 1 }],
  }];
  const operationStrategyProfiles: readonly OperationStrategyProfileDef[] = [{ id: STRATEGY_ID, biases: [] }];
  return {
    eventDefinition,
    actors: [{ actorId: ACTOR_ID, participantKind: 'student', characterId: profile.characterId, profile }],
    actionDefinitions: [action],
    studentSkillRules: [],
    operationCardPools,
    operationStrategyProfiles,
  };
}

describe('Operation workspace renderer', () => {
  let game: ReturnType<typeof createAppRuntime> | undefined;
  let controller: UIController | undefined;

  afterEach(() => {
    controller?.destroy();
    controller = undefined;
    if (game?.running) game.stop();
    game = undefined;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('renders generic OperationView content in the three workspace regions', () => {
    game = createAppRuntime();
    game.init([defaultDatapack], { enterDefaultInit: false });
    const operation = new OperationRuntimeService();
    operation.start(operationInput());
    const view = operation.getView();
    expect(view).not.toBeNull();
    if (!view) throw new Error('Operation runtime did not project its view.');

    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), view);

    expect(host.querySelectorAll('[data-workspace-column]')).toHaveLength(3);
    expect(host.querySelector('[data-workspace-role="our-team"]')).not.toBeNull();
    expect(host.querySelector('[data-workspace-role="information"] h1')?.textContent).toBe('通用 Operation 工作区');
    expect(host.querySelector('[data-operation-student="' + ACTOR_ID + '"]')).not.toBeNull();
    expect(host.textContent).toContain('渲染来自 OperationView 的说明。');
    expect(host.textContent).not.toContain('Strategy Park');
    expect(host.textContent).not.toContain('旋转木马');
  });

  test.each(['start', 'resume'])('waits for Operation styles before %s from the Spot', async mode => {
    game = createAppRuntime();
    game.init([defaultDatapack], { enterDefaultInit: true });
    const operation = new OperationRuntimeService();
    const input = operationInput();
    const eventId = input.eventDefinition.id;
    const start = vi.fn(() => operation.start(input));
    const resumed = mode === 'resume' ? operation.start(input) : null;
    const entry: OperationEventLaunchEntry = {
      eventId, title: '测试行动', description: null, characterIds: [CHARACTER_ID],
      admission: { eventId, available: true, participants: [], missingCharacterIds: [], unavailableReason: null },
    };
    Object.defineProperty(game, 'operationEntry', {
      value: { ...game.operationEntry, start, getView: () => operation.getView(), getLaunchEntries: () => [entry] },
    });
    const spotId = 'base:spot:variant_training';
    const query = game.spotFunctionalitySystem;
    const functionalitiesOf = query.functionalitiesOf.bind(query);
    vi.spyOn(query, 'functionalitiesOf').mockImplementation((spot, state) =>
      spot.id === spotId
        ? [...functionalitiesOf(spot, state), { id: 'test:operation-entry', kind: 'operationEntry', operationEventId: eventId }]
        : functionalitiesOf(spot, state));

    let markReady!: () => void;
    const loading = new Promise<void>(resolve => { markReady = resolve; });
    const root = document.body.appendChild(document.createElement('div'));
    controller = new UIController(game, root, surface => surface === 'operation' ? loading : undefined);
    controller.started = true;
    controller.render();
    root.querySelector<HTMLButtonElement>(`[data-upgrade="${spotId}"]`)!.click();
    const button = root.querySelector<HTMLButtonElement>(mode === 'start' ? '[data-operation-start]' : '[data-operation-resume-run]')!;

    button.click();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(start).not.toHaveBeenCalled();
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBeNull();
    markReady();
    await loading;
    expect(start).toHaveBeenCalledTimes(resumed ? 0 : 1);
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'operation', runId: operation.getView()?.runId });
    expect(root.querySelector('[data-workspace-frame="operation"]')).not.toBeNull();
  });
});
