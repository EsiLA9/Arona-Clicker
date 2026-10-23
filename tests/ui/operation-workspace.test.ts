// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { OperationEventDef, OperationRunStartInput } from '../../src/arona-clicker/contracts/operation/operation';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation/operation-action';
import type { OperationCardPoolDef, OperationStrategyProfileDef } from '../../src/data-services/contracts/operation';
import { OperationRuntimeService } from '../../src/arona-clicker/services/operation/operation-runtime-service';
import { createUIContext } from '../../src/ui/runtime/context';
import { renderOperationWorkspace } from '../../src/ui/components/operation/operation-workspace';

const ACTOR_ID = 'test:actor:operation-workspace';
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
    characterId: 'test:character:operation-workspace',
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

  afterEach(() => {
    if (game?.running) game.stop();
    game = undefined;
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
});
