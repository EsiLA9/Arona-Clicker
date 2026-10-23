import { describe, expect, test } from 'vitest';
import type { MapContentResolver } from '../../src/arona-clicker/contracts/map/map-content-resolver';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { MapRunError, MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import type { MapRun, MapRunEncounterActionSettlement, MapRunEncounterDraftToken, MapRunEncounterSnapshot, MapRunSaveSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { GAMEPLAY_B_HAND_RNG_ALGORITHM } from '../../src/arona-clicker/contracts/map/map-run';
import { drawGameplayBHands } from '../../src/arona-clicker/services/map/gameplay-b-hand-resolver';
import { resolveGameplayMapCandidateSources } from '../../src/data-services/validation/gameplay-map-candidate-pools';
import { tagRef } from '../../src/engine/core/tag';
import { resolveGameplayBActionPreview } from '../../src/arona-clicker/services/map/gameplay-b-action-preview-resolver';
import { baseDatapack } from '../../src/data/test-datapack';

type TestMap = NonNullable<ReturnType<MapContentResolver['resolve']>>;

const MAP_ID = 'test:map:route';
const ADMITTED_PARTY = [{ characterId: 'shiroko', variantId: 'Shiroko' }] as const;
const ROUTE_MAP: TestMap = {
  id: MAP_ID,
  name: 'Route',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko'],
  initialPartyHp: [{ characterId: 'shiroko', initialHp: 10, maxHp: 10 }],
  initialPlayerCost: 4,
  nodes: [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B', encounter: { title: 'Encounter', completion: { kind: 'manual', label: 'Complete' } } },
    { id: 'c', title: 'C' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ],
};

const HAND_MAP_ID = 'test:map:weighted-hand';
const HAND_PARTY = [
  { characterId: 'shiroko', variantId: 'Shiroko' },
  { characterId: 'serika', variantId: 'Serika' },
  { characterId: 'hoshino', variantId: 'Hoshino' },
  { characterId: 'nonomi', variantId: 'Nonomi' },
] as const;
const HAND_MAP: TestMap = {
  id: HAND_MAP_ID,
  name: 'Weighted Hand',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika', 'hoshino', 'nonomi'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
    { characterId: 'hoshino', initialHp: 10, maxHp: 10 },
    { characterId: 'nonomi', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 5,
  actions: [
    { id: 'favored', name: 'Favored', eligibleCharacterIds: ['shiroko', 'serika', 'hoshino', 'nonomi'], target: { kind: 'none' } },
    { id: 'common-a', name: 'Common A', eligibleCharacterIds: ['shiroko', 'serika', 'hoshino', 'nonomi'], target: { kind: 'none' } },
    { id: 'common-b', name: 'Common B', eligibleCharacterIds: ['shiroko', 'serika', 'hoshino', 'nonomi'], target: { kind: 'none' } },
    { id: 'common-c', name: 'Common C', eligibleCharacterIds: ['shiroko', 'serika', 'hoshino', 'nonomi'], target: { kind: 'none' } },
    { id: 'eligible-not-candidate', name: 'Eligible but Not a Candidate', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' } },
    { id: 'serika-only', name: 'Serika Only', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
    {
      id: 'unpayable-actor-cost',
      name: 'Unpayable Actor Cost',
      eligibleCharacterIds: ['shiroko', 'serika', 'hoshino', 'nonomi'],
      target: { kind: 'none' },
      costs: [{ scope: 'actor', resourceId: 'stamina', amount: 3 }],
    },
    {
      id: 'unpayable-team-cost',
      name: 'Unpayable Team Cost',
      eligibleCharacterIds: ['shiroko', 'serika', 'hoshino', 'nonomi'],
      target: { kind: 'none' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 5 }],
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'stamina', value: 2 },
    { characterId: 'serika', resourceId: 'stamina', value: 3 },
  ],
  initialTeamResources: [{ resourceId: 'supplies', value: 4 }],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b',
      title: 'Encounter',
      encounter: {
        title: 'Weighted Hand',
        completion: { kind: 'manual', label: 'Complete' },
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'favored', tendencyWeight: 9 },
              { actionId: 'common-a', tendencyWeight: 1 },
              { actionId: 'common-b', tendencyWeight: 1 },
              { actionId: 'common-c', tendencyWeight: 1 },
              { actionId: 'unpayable-actor-cost', tendencyWeight: 1000 },
              { actionId: 'unpayable-team-cost', tendencyWeight: 1000 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'common-a', tendencyWeight: 2 },
              { actionId: 'serika-only', tendencyWeight: 1 },
            ],
          },
          { characterId: 'hoshino', actions: [] },
        ],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ],
};

const PREPARED_MAP_ID = 'test:map:prepared-actions';
const PREPARED_PARTY = [
  { characterId: 'shiroko', variantId: 'Shiroko' },
  { characterId: 'serika', variantId: 'Serika' },
] as const;
const PREPARED_MAP: TestMap = {
  id: PREPARED_MAP_ID,
  name: 'Prepared Actions',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 2,
  actions: [
    {
      id: 'inspect',
      name: 'Inspect',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
    },
    {
      id: 'self-care',
      name: 'Self Care',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
    },
    {
      id: 'assist-party',
      name: 'Assist Party',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
    },
  ],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b',
      title: 'Prepared Encounter',
      encounter: {
        title: 'Prepared Encounter',
        completion: { kind: 'manual', label: 'Complete' },
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'inspect', tendencyWeight: 1 },
              { actionId: 'self-care', tendencyWeight: 1 },
              { actionId: 'assist-party', tendencyWeight: 1 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'inspect', tendencyWeight: 1 },
              { actionId: 'self-care', tendencyWeight: 1 },
              { actionId: 'assist-party', tendencyWeight: 1 },
            ],
          },
        ],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ],
};

const COMMIT_PARTY = [
  { characterId: 'shiroko', variantId: 'Shiroko' },
  { characterId: 'serika', variantId: 'Serika' },
] as const;
const TARGET_COMMIT_MAP_ID = 'test:map:target-commit';
const TARGET_COMMIT_MAP: TestMap = {
  id: TARGET_COMMIT_MAP_ID,
  name: 'Target Commit',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['d'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 2,
  actions: [
    {
      id: 'inspect', name: 'Inspect', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 1 }] },
    },
    {
      id: 'aid', name: 'Aid', eligibleCharacterIds: ['serika'], target: { kind: 'partyCharacter' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 }] },
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 0 },
    { characterId: 'serika', resourceId: 'focus', value: 0 },
  ],
  initialTeamResources: [{ resourceId: 'supplies', value: 2 }, { resourceId: 'clues', value: 0 }],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Encounter', encounter: {
        title: 'Target Commit',
        completion: { kind: 'manual', label: 'Finish' },
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'inspect', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'aid', tendencyWeight: 1 }] },
        ],
      },
    },
    {
      id: 'c', title: 'Follow-up', encounter: {
        title: 'Follow-up', completion: { kind: 'manual', label: 'Finish' },
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'inspect', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'aid', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'd', title: 'Exit' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
    { fromNodeId: 'c', toNodeId: 'd' },
  ],
};

const OVERRIDE_COMMIT_MAP_ID = 'test:map:override-commit';
const OVERRIDE_ACTIONS = ['move-a', 'move-b', 'move-c', 'move-d'].map((id, index) => ({
  id,
  name: id,
  eligibleCharacterIds: ['shiroko'] as const,
  target: { kind: 'none' as const },
  effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'clues', delta: index + 1 }] },
}));
const OVERRIDE_COMMIT_MAP: TestMap = {
  id: OVERRIDE_COMMIT_MAP_ID,
  name: 'Override Commit',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 3,
  actions: [
    ...OVERRIDE_ACTIONS,
    { id: 'serika-action', name: 'Observe', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
  ],
  initialTeamResources: [{ resourceId: 'clues', value: 0 }],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Encounter', encounter: {
        title: 'Override Commit',
        participants: [
          { characterId: 'shiroko', actions: OVERRIDE_ACTIONS.map(action => ({ actionId: action.id, tendencyWeight: 1 })) },
          { characterId: 'serika', actions: [{ actionId: 'serika-action', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
};

const LATE_EFFECT_COMMIT_MAP_ID = 'test:map:late-effect-commit';
const LATE_EFFECT_COMMIT_MAP: TestMap = {
  id: LATE_EFFECT_COMMIT_MAP_ID,
  name: 'Late Effect Commit',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [
    {
      id: 'shiroko-spend', name: 'Spend First', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
    },
    {
      id: 'serika-refill', name: 'Spend Then Refill', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] },
    },
  ],
  initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Encounter', encounter: {
        title: 'Late Effect Commit',
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'shiroko-spend', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'serika-refill', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
};

const TEAM_RESERVATION_MAP_ID = 'test:map:team-reservation';
const TEAM_RESERVATION_MAP: TestMap = {
  id: TEAM_RESERVATION_MAP_ID,
  name: 'Team Reservation',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [
    {
      id: 'shiroko-spend-two', name: 'Shiroko Spend Two', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 2 }],
    },
    {
      id: 'serika-spend-two', name: 'Serika Spend Two', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 2 }],
    },
    { id: 'serika-free', name: 'Serika Free Action', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
  ],
  initialTeamResources: [{ resourceId: 'supplies', value: 3 }],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Encounter', encounter: {
        title: 'Team Reservation',
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'shiroko-spend-two', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [
            { actionId: 'serika-spend-two', tendencyWeight: 1 },
            { actionId: 'serika-free', tendencyWeight: 1 },
          ] },
        ],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
};

function resolverOf(...maps: TestMap[]): MapContentResolver {
  const mapById = new Map(maps.map(map => [map.id, map]));
  return { resolve: mapId => mapById.get(mapId) ?? null };
}

function resolveTestVariant(variantId: string): string | null {
  return ({ Shiroko: 'shiroko', Serika: 'serika', Hoshino: 'hoshino', Nonomi: 'nonomi' } as Record<string, string>)[variantId] ?? null;
}

function handService(): MapRunService {
  return new MapRunService(resolverOf(HAND_MAP), resolveTestVariant);
}

function preparedService(): MapRunService {
  return new MapRunService(resolverOf(PREPARED_MAP), resolveTestVariant);
}

function preparedEncounter(hands: MapRunEncounterSnapshot['hands']): MapRunEncounterSnapshot {
  return {
    nodeId: 'b',
    round: 1,
    hands,
    enemyHands: [],
    enemyActorResources: [],
    enemyTeamResources: [],
    overrides: [],
    targetSelections: [],
    enemies: [],
    draftVersion: 0,
    drawCursorStart: 0,
    randomState: { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 5, cursor: 0 },
    lastCommit: null,
  };
}

function draftToken(encounter: MapRunEncounterSnapshot | null | undefined): MapRunEncounterDraftToken {
  if (!encounter) throw new Error('Encounter draft token requires an active Encounter');
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

const BATTLE_MAP_ID = 'test:map:battle-hp';
const BATTLE_PARTY = [
  { characterId: 'shiroko', variantId: 'Shiroko' },
  { characterId: 'serika', variantId: 'Serika' },
  { characterId: 'hoshino', variantId: 'Hoshino' },
] as const;
const BATTLE_ACTIONS: NonNullable<TestMap['actions']> = [
  {
    id: 'shiroko-strike', name: 'Shiroko Strike', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' as const },
    costs: [{ scope: 'team' as const, resourceId: 'ammo', amount: 1 }],
    effectProgram: { resolve: [
      { op: 'damage', target: 'primary', amount: 5 },
      { op: 'resourceChange', account: 'sourceTeam', resourceId: 'ammo', delta: 1 },
    ] },
  },
  {
    id: 'serika-strike', name: 'Serika Strike', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' as const },
    costs: [{ scope: 'team' as const, resourceId: 'ammo', amount: 1 }],
    effectProgram: { resolve: [
      { op: 'damage', target: 'primary', amount: 5 },
      { op: 'resourceChange', account: 'sourceTeam', resourceId: 'ammo', delta: 1 },
    ] },
  },
  {
    id: 'hoshino-strike', name: 'Hoshino Strike', eligibleCharacterIds: ['hoshino'], target: { kind: 'enemy' as const },
    costs: [{ scope: 'team' as const, resourceId: 'ammo', amount: 1 }],
    effectProgram: { resolve: [
      { op: 'damage', target: 'primary', amount: 5 },
      { op: 'resourceChange', account: 'sourceTeam', resourceId: 'ammo', delta: 1 },
    ] },
  },
];
const BATTLE_PARTICIPANTS = BATTLE_PARTY.map((member, index) => ({
  characterId: member.characterId,
  actions: [{ actionId: BATTLE_ACTIONS[index]!.id, tendencyWeight: 1 }],
}));
const BATTLE_MAP: TestMap = {
  id: BATTLE_MAP_ID,
  name: 'Battle HP',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['d'],
  partyCharacterIds: ['shiroko', 'serika', 'hoshino'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 2, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
    { characterId: 'hoshino', initialHp: 5, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  actions: BATTLE_ACTIONS,
  initialTeamResources: [{ resourceId: 'ammo', value: 3 }],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Battle 1', encounter: {
        title: 'Battle 1',
        enemies: [
          { id: 'serika', initialHp: 5, maxHp: 5 },
          { id: 'wolf', initialHp: 5, maxHp: 5 },
        ],
        participants: BATTLE_PARTICIPANTS,
      },
    },
    {
      id: 'c', title: 'Battle 2', encounter: {
        title: 'Battle 2',
        enemies: [{ id: 'serika', initialHp: 3, maxHp: 5 }],
        participants: BATTLE_PARTICIPANTS,
      },
    },
    { id: 'd', title: 'Exit' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
    { fromNodeId: 'c', toNodeId: 'd' },
  ],
};

const DEFEAT_MAP_ID = 'test:map:battle-defeat';
const DEFEAT_PARTY = [
  { characterId: 'shiroko', variantId: 'Shiroko' },
  { characterId: 'serika', variantId: 'Serika' },
] as const;
const DEFEAT_MAP: TestMap = {
  id: DEFEAT_MAP_ID,
  name: 'Battle Defeat',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 1, maxHp: 1 },
    { characterId: 'serika', initialHp: 1, maxHp: 1 },
  ],
  initialPlayerCost: 0,
  actions: [
    { id: 'wait-action', name: 'Wait Action', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' } },
    {
      id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
      tendencyRole: 'attack', effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
    },
  ],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Defeat Battle', encounter: {
        title: 'Defeat Battle',
        enemies: [
          { id: 'enemy-a', initialHp: 4, maxHp: 4, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
          { id: 'enemy-b', initialHp: 4, maxHp: 4, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
          { id: 'enemy-c', initialHp: 4, maxHp: 4, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
        ],
        participants: [
          { characterId: 'shiroko', actions: [] },
          { characterId: 'serika', actions: [] },
        ],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
};

const ENEMY_TURN_MAP_ID = 'test:map:enemy-turn-hp';
const ENEMY_TURN_PARTY = BATTLE_PARTY;
const ENEMY_TURN_MAP: TestMap = {
  id: ENEMY_TURN_MAP_ID,
  name: 'Enemy Turn HP',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika', 'hoshino'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 2, maxHp: 10 },
    { characterId: 'serika', initialHp: 5, maxHp: 10 },
    { characterId: 'hoshino', initialHp: 5, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  actions: [
    { id: 'support', name: 'Support', eligibleCharacterIds: ['hoshino'], target: { kind: 'partyCharacter' } },
    {
      id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
    },
  ],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Enemy Turn', encounter: {
        title: 'Enemy Turn',
        enemies: [
          { id: 'enemy-a', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
          { id: 'enemy-b', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
        ],
        participants: [
          { characterId: 'shiroko', actions: [] },
          { characterId: 'serika', actions: [] },
          { characterId: 'hoshino', actions: [{ actionId: 'support', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
};

const ENEMY_HAND_MAP_ID = 'test:map:enemy-hand-snapshot';
const ENEMY_HAND_MAP: TestMap = {
  id: ENEMY_HAND_MAP_ID,
  name: 'Enemy Hand Snapshot',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko'],
  initialPartyHp: [{ characterId: 'shiroko', initialHp: 10, maxHp: 10 }],
  initialPlayerCost: 0,
  initialActorResources: [{ characterId: 'shiroko', resourceId: 'focus', value: 0 }],
  actions: [{
    id: 'player-card-buff', name: 'Player Card Buff', eligibleCharacterIds: ['shiroko'],
    target: { kind: 'card', side: 'opponent' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] },
  }, {
    id: 'enemy-shot', name: 'Enemy Shot', eligibleCharacterIds: [],
    target: { kind: 'partyCharacter' }, tendencyRole: 'attack',
    costs: [
      { scope: 'actor', resourceId: 'focus', amount: 1 },
      { scope: 'actor', resourceId: 'sCost', amount: 2 },
      { scope: 'team', resourceId: 'charge', amount: 2 },
    ],
    effectProgram: { resolve: [
      { op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 },
      { op: 'resourceChange', account: 'sourceActor', resourceId: 'sCost', delta: 1 },
      { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
      { op: 'resourceChange', account: 'sourceTeam', resourceId: 'charge', delta: 1 },
    ] },
  }],
  nodes: [
    { id: 'a', title: 'Start' },
    {
      id: 'b', title: 'Enemy Hand', encounter: {
        title: 'Enemy Hand',
        participants: [{ characterId: 'shiroko', actions: [{ actionId: 'player-card-buff', tendencyWeight: 1 }] }],
        initialEnemyTeamResources: [{ resourceId: 'charge', value: 3 }],
        enemies: [{
          id: 'robot-a', initialHp: 10, maxHp: 10,
          actions: [{ actionId: 'enemy-shot', tendencyWeight: 2 }],
          initialResources: [{ resourceId: 'focus', value: 1 }, { resourceId: 'sCost', value: 2 }],
        }],
      },
    },
    { id: 'c', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
};

function battleService(...maps: TestMap[]): MapRunService {
  return new MapRunService(resolverOf(...maps), resolveTestVariant);
}

function commitCommand(run: MapRun, requestId: string): { runId: string; requestId: string; expectedCommitVersion: number; draft: MapRunEncounterDraftToken } {
  return {
    runId: run.runId,
    requestId,
    expectedCommitVersion: run.commitVersion,
    draft: draftToken(run.activeEncounter),
  };
}

describe('MapRunService', () => {
  test('merges Party primary and additional target fields and strictly restores the secondary', () => {
    const map: TestMap = {
      id: 'test:map:additional-target-draft', name: 'Additional Target Draft', resumeVersion: 5,
      executionContractId: 'AG-1', startNodeId: 'b', exitNodeIds: ['b'],
      partyCharacterIds: ['shiroko', 'serika', 'hoshino'],
      initialPartyHp: ['shiroko', 'serika', 'hoshino'].map(characterId => ({ characterId, initialHp: 10, maxHp: 10 })),
      initialPlayerCost: 2,
      actions: [{ id: 'aid', name: 'Aid', eligibleCharacterIds: ['shiroko'], target: { kind: 'partyCharacter' }, additionalTarget: 'partyCharacter' }],
      nodes: [{ id: 'b', title: 'Encounter', encounter: { title: 'Encounter', completion: { kind: 'manual', label: 'Finish' }, participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'aid', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] }, { characterId: 'hoshino', actions: [] },
      ] } }], edges: [],
    };
    const service = new MapRunService(resolverOf(map), resolveTestVariant);
    const started = service.start(map.id, [
      { characterId: 'shiroko', variantId: 'Shiroko' },
      { characterId: 'serika', variantId: 'Serika' },
      { characterId: 'hoshino', variantId: 'Hoshino' },
    ]);
    const primary = service.setPreparedTarget(started.runId, 'shiroko', 'serika', draftToken(started.activeEncounter));
    const secondary = service.setPreparedAdditionalTarget(started.runId, 'shiroko', { kind: 'partyCharacter', characterId: 'hoshino' }, draftToken(primary.activeEncounter));
    expect(secondary.activeEncounter?.targetSelections).toContainEqual({
      characterId: 'shiroko', targetCharacterId: 'serika', additionalTargetCharacterId: 'hoshino',
    });
    const changedPrimary = service.setPreparedTarget(started.runId, 'shiroko', 'hoshino', draftToken(secondary.activeEncounter));
    expect(changedPrimary.activeEncounter?.targetSelections).toContainEqual({
      characterId: 'shiroko', targetCharacterId: 'hoshino',
    });

    const selectedAgain = service.setPreparedAdditionalTarget(started.runId, 'shiroko', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(changedPrimary.activeEncounter));
    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected an active Encounter checkpoint');
    const restored = new MapRunService(resolverOf(map), resolveTestVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    const tampered = structuredClone(checkpoint) as unknown as { run: { activeEncounter: { targetSelections: Array<Record<string, unknown>> } } };
    tampered.run.activeEncounter.targetSelections[0].additionalTargetCharacterId = 'shiroko';
    expect(new MapRunService(resolverOf(map), resolveTestVariant).restoreSaveSnapshot(tampered as never))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(selectedAgain.activeEncounter?.targetSelections[0]).toMatchObject({ additionalTargetCharacterId: 'serika' });
  });

  test('stores Enemy Hands and Encounter-local resources in the prepared snapshot and restores them unchanged', () => {
    const source = battleService(ENEMY_HAND_MAP);
    const started = source.start(ENEMY_HAND_MAP_ID, [{ characterId: 'shiroko', variantId: 'Shiroko' }]);
    const entered = source.move(started.runId, 'b');
    expect(entered.activeEncounter).toMatchObject({
      enemyHands: [{ enemyId: 'robot-a', actionIds: ['enemy-shot'] }],
      enemyActorResources: [
        { enemyId: 'robot-a', resourceId: 'focus', value: 1 },
        { enemyId: 'robot-a', resourceId: 'sCost', value: 2 },
      ],
      enemyTeamResources: [{ resourceId: 'charge', value: 3 }],
    });

    const checkpoint = source.createSaveSnapshot();
    expect(checkpoint).not.toBeNull();
    if (!checkpoint) throw new Error('Enemy Hand checkpoint is missing');
    const restored = battleService(ENEMY_HAND_MAP);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(restored.getSnapshot(started.runId)?.activeEncounter).toEqual(entered.activeEncounter);

    const invalidEnemyHand = structuredClone(checkpoint) as unknown as {
      run: { activeEncounter: { enemyHands: { actionIds: string[] }[] } };
    };
    invalidEnemyHand.run.activeEncounter.enemyHands[0]!.actionIds[0] = 'unknown-action';
    expect(battleService(ENEMY_HAND_MAP).restoreSaveSnapshot(invalidEnemyHand))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const unaffordableSavedHand = structuredClone(checkpoint) as unknown as {
      run: { activeEncounter: { enemyActorResources: { value: number }[] } };
    };
    unaffordableSavedHand.run.activeEncounter.enemyActorResources[0]!.value = 0;
    expect(battleService(ENEMY_HAND_MAP).restoreSaveSnapshot(unaffordableSavedHand))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const missingInitialBalance = structuredClone(checkpoint) as unknown as {
      run: { activeEncounter: { enemyActorResources: { enemyId: string; resourceId: string; value: number }[] } };
    };
    missingInitialBalance.run.activeEncounter.enemyActorResources = [];
    expect(battleService(ENEMY_HAND_MAP).restoreSaveSnapshot(missingInitialBalance))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('charges Enemy Actor and Enemy Team costs only on Commit and restores the receipt', () => {
    const source = battleService(ENEMY_HAND_MAP);
    const started = source.start(ENEMY_HAND_MAP_ID, [{ characterId: 'shiroko', variantId: 'Shiroko' }]);
    const entered = source.move(started.runId, 'b');
    const preview = source.previewEncounterCommit(started.runId);
    expect(source.previewActions(started.runId)?.preparedActions[0]).toMatchObject({
      naturalActionId: 'player-card-buff', targetKind: 'card', targetSelectionRequired: false,
    });
    expect(source.previewActions(started.runId)?.preparedActions[0].targetCard).toBeDefined();
    expect(preview).toMatchObject({ canCommit: true, enemyActions: [{
      enemyId: 'robot-a', actionId: 'enemy-shot', targetCharacterId: 'shiroko',
      scostCost: { original: 2, discount: 1, paid: 1 },
      resourceChanges: [
        { kind: 'cost', scope: 'actor', enemyId: 'robot-a', resourceId: 'focus', delta: -1 },
        { kind: 'cost', scope: 'actor', enemyId: 'robot-a', resourceId: 'sCost', delta: -1 },
        { kind: 'cost', scope: 'team', teamSide: 'enemy', resourceId: 'charge', delta: -2 },
        { kind: 'effect', scope: 'actor', enemyId: 'robot-a', resourceId: 'focus', delta: 1 },
        { kind: 'effect', scope: 'actor', enemyId: 'robot-a', resourceId: 'sCost', delta: 1 },
        { kind: 'effect', scope: 'actor', characterId: 'shiroko', resourceId: 'focus', delta: 1 },
        { kind: 'effect', scope: 'team', teamSide: 'enemy', resourceId: 'charge', delta: 1 },
      ],
    }] });
    expect(entered.activeEncounter?.enemyActorResources).toEqual([
      { enemyId: 'robot-a', resourceId: 'focus', value: 1 },
      { enemyId: 'robot-a', resourceId: 'sCost', value: 2 },
    ]);
    const committed = source.commitEncounterRound(commitCommand(entered, 'enemy-resource-cost'));
    expect(committed.activeEncounter?.enemyActorResources).toEqual([
      { enemyId: 'robot-a', resourceId: 'focus', value: 1 },
      { enemyId: 'robot-a', resourceId: 'sCost', value: 2 },
    ]);
    expect(committed.activeEncounter?.enemyTeamResources).toEqual([{ resourceId: 'charge', value: 2 }]);
    expect(committed.actorResources).toEqual([
      { characterId: 'shiroko', resourceId: 'focus', value: 1 },
      { characterId: 'shiroko', resourceId: 'sCost', value: 0 },
    ]);
    expect(committed.lastEncounterCommit?.enemyActions?.[0]).toMatchObject({
      actionId: 'enemy-shot', targetCharacterId: 'shiroko',
    });
    expect(committed.activeEncounter?.enemyHands).toEqual([{ enemyId: 'robot-a', actionIds: ['enemy-shot'] }]);

    const checkpoint = source.createSaveSnapshot();
    if (!checkpoint) throw new Error('Enemy cost receipt checkpoint is missing');
    const restored = battleService(ENEMY_HAND_MAP);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(restored.getSnapshot(started.runId)).toEqual(committed);
  });

  test('skips a defeated Enemy natural action for free and lets later Enemies execute', () => {
    const map: TestMap = {
      ...ENEMY_HAND_MAP,
      id: 'test:map:enemy-killed-before-turn',
      actions: [
        {
          id: 'player-shot', name: 'Player Shot', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
        },
        {
          id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter' }, tendencyRole: 'attack',
          costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
        },
      ],
      nodes: ENEMY_HAND_MAP.nodes.map(node => node.id !== 'b' ? node : ({
        ...node,
        encounter: {
          title: 'Enemy killed before its turn',
          participants: [{ characterId: 'shiroko', actions: [{ actionId: 'player-shot', tendencyWeight: 1 }] }],
          enemies: [
            { id: 'robot-a', initialHp: 2, maxHp: 2,
              actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }], initialResources: [{ resourceId: 'focus', value: 1 }] },
            { id: 'robot-b', initialHp: 10, maxHp: 10,
              actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }], initialResources: [{ resourceId: 'focus', value: 1 }] },
          ],
        },
      })),
    };
    const source = battleService(map);
    const started = source.start(map.id, [{ characterId: 'shiroko', variantId: 'Shiroko' }]);
    const entered = source.move(started.runId, 'b');
    expect(source.previewActions(started.runId)?.preparedEnemyActions.map(row => row.naturalActionId))
      .toEqual(['enemy-hit', 'enemy-hit']);
    const committed = source.commitEncounterRound(commitCommand(entered, 'enemy-killed-before-turn'));
    expect(committed.activeEncounter?.enemies).toEqual([
      { enemyId: 'robot-a', currentHp: 0 },
      { enemyId: 'robot-b', currentHp: 10 },
    ]);
    expect(committed.partyHp).toEqual([{ characterId: 'shiroko', currentHp: 9 }]);
    expect(committed.activeEncounter?.enemyActorResources).toEqual([
      { enemyId: 'robot-a', resourceId: 'focus', value: 1 },
      { enemyId: 'robot-b', resourceId: 'focus', value: 0 },
    ]);
    expect(committed.lastEncounterCommit?.enemyActions).toMatchObject([
      { enemyId: 'robot-a', actionId: 'enemy-hit', skipReason: 'defeated', resourceChanges: [] },
      { enemyId: 'robot-b', actionId: 'enemy-hit', targetCharacterId: 'shiroko',
        resourceChanges: [{ kind: 'cost', scope: 'actor', enemyId: 'robot-b', resourceId: 'focus', delta: -1 }],
        hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -1 }] },
    ]);
  });

  test('projects Enemy unit and card targets from the shared stable target rules', () => {
    const map: TestMap = {
      ...ENEMY_HAND_MAP,
      id: 'test:map:enemy-target-preview',
      partyCharacterIds: ['shiroko', 'serika'],
      initialPartyHp: [
        { characterId: 'shiroko', initialHp: 8, maxHp: 10 },
        { characterId: 'serika', initialHp: 4, maxHp: 10 },
      ],
      initialActorResources: [
        { characterId: 'shiroko', resourceId: 'sCost', value: 1 },
        { characterId: 'serika', resourceId: 'sCost', value: 1 },
      ],
      actions: [
        {
          id: 'player-shot', name: 'Player Shot', eligibleCharacterIds: ['shiroko', 'serika'],
          target: { kind: 'enemy' }, costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }],
        },
        {
          id: 'enemy-aim', name: 'Enemy Aim', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter', preference: 'highestMissingHpRatio' }, tendencyRole: 'attack',
        },
        {
          id: 'enemy-support', name: 'Enemy Support', eligibleCharacterIds: [],
          target: { kind: 'enemy', preference: 'lowestHpRatio' }, tendencyRole: 'recovery',
        },
        {
          id: 'enemy-card', name: 'Enemy Card', eligibleCharacterIds: [],
          target: { kind: 'card', side: 'opponent' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] },
        },
      ],
      nodes: ENEMY_HAND_MAP.nodes.map(node => node.id === 'b' ? {
        ...node,
        encounter: {
          title: 'Enemy target preview',
          participants: ['shiroko', 'serika'].map(characterId => ({
            characterId,
            actions: [{ actionId: 'player-shot', tendencyWeight: 1 }],
          })),
          enemies: [
            { id: 'robot-a', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-aim', tendencyWeight: 1 }] },
            { id: 'robot-b', initialHp: 4, maxHp: 10, actions: [{ actionId: 'enemy-support', tendencyWeight: 1 }] },
            { id: 'robot-c', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-card', tendencyWeight: 1 }] },
          ],
        },
      } : node),
    };
    const service = battleService(map);
    const started = service.start(map.id, [
      { characterId: 'shiroko', variantId: 'Shiroko' },
      { characterId: 'serika', variantId: 'Serika' },
    ]);
    const entered = service.move(started.runId, 'b');
    const before = service.getSnapshot(started.runId);
    const preview = service.previewActions(started.runId);
    expect(preview?.preparedEnemyActions).toMatchObject([
      { enemyId: 'robot-a', naturalActionId: 'enemy-aim', targetCharacterId: 'serika', targetSelectionRequired: false },
      { enemyId: 'robot-b', naturalActionId: 'enemy-support', targetEnemyId: 'robot-b', targetSelectionRequired: false },
      {
        enemyId: 'robot-c', naturalActionId: 'enemy-card', targetKind: 'card',
        targetSelectionRequired: false,
      },
    ]);
    expect(preview?.preparedEnemyActions[2]?.legalTargetCards).toHaveLength(2);
    expect(preview?.preparedEnemyActions[2]?.targetCard).toEqual(preview?.preparedEnemyActions[2]?.legalTargetCards?.[0]);
    expect(service.previewActions(started.runId)).toEqual(preview);
    expect(service.getSnapshot(started.runId)).toEqual(before);
    expect(entered.activeEncounter?.randomState).toEqual(before?.activeEncounter?.randomState);
  });

  test('keeps faction-scoped Enemy targets through Save/Load, settles overkill costs, and auto-wins without an Enemy turn', () => {
    const source = battleService(BATTLE_MAP);
    const started = source.start(BATTLE_MAP_ID, BATTLE_PARTY);
    expect(started.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 2 },
      { characterId: 'serika', currentHp: 8 },
      { characterId: 'hoshino', currentHp: 5 },
    ]);
    const entered = source.move(started.runId, 'b');
    expect(entered.activeEncounter?.enemies).toEqual([
      { enemyId: 'serika', currentHp: 5 },
      { enemyId: 'wolf', currentHp: 5 },
    ]);

    let drafted = entered;
    for (const [characterId, enemyId] of [
      ['shiroko', 'serika'],
      ['serika', 'serika'],
      ['hoshino', 'wolf'],
    ] as const) {
      drafted = source.setPreparedEnemyTarget(drafted.runId, characterId, enemyId, draftToken(drafted.activeEncounter));
    }
    expect(drafted.activeEncounter?.targetSelections).toEqual([
      { characterId: 'shiroko', targetEnemyId: 'serika' },
      { characterId: 'serika', targetEnemyId: 'serika' },
      { characterId: 'hoshino', targetEnemyId: 'wolf' },
    ]);

    const checkpoint = source.createSaveSnapshot();
    expect(checkpoint).not.toBeNull();
    if (!checkpoint) throw new Error('Battle checkpoint is missing');
    const resumed = battleService(BATTLE_MAP);
    expect(resumed.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    const restored = resumed.getSnapshot(started.runId);
    expect(restored?.activeEncounter?.hands).toEqual(drafted.activeEncounter?.hands);
    expect(restored?.activeEncounter?.randomState).toEqual(drafted.activeEncounter?.randomState);
    const restoredPreview = resumed.previewActions(started.runId);
    expect(restoredPreview?.preparedActions.map(row => row.targetEnemyId)).toEqual(['serika', 'serika', 'wolf']);

    const command = commitCommand(restored!, 'battle-victory-1');
    const preview = resumed.previewEncounterCommit(started.runId);
    expect(preview?.canCommit).toBe(true);
    const serikaOverkill = preview?.settlements?.find(row => row.characterId === 'serika');
    expect(serikaOverkill).toMatchObject({
      targetCharacterId: null,
      targetEnemyId: 'serika',
      hpChanges: [{ scope: 'enemy', enemyId: 'serika', delta: 0 }],
      resourceChanges: [
        { kind: 'cost', scope: 'team', resourceId: 'ammo', delta: -1 },
        { kind: 'effect', scope: 'team', resourceId: 'ammo', delta: 1 },
      ],
    });

    const victorious = resumed.commitEncounterRound(command);
    expect(victorious).toMatchObject({
      status: 'inProgress',
      currentNodeId: 'b',
      completedEncounterNodeIds: ['b'],
      activeEncounter: null,
      partyHp: drafted.partyHp,
      teamResources: [{ resourceId: 'ammo', value: 3 }],
      lastEncounterCommit: { requestId: command.requestId, nodeId: 'b' },
    });
    expect(victorious.lastEncounterCommit?.enemyActions).toHaveLength(2);
    expect(victorious.lastEncounterCommit?.enemyActions?.every(row => row.actionId === null)).toBe(true);
    expect(victorious.lastEncounterCommit?.settlements.find(row => row.characterId === 'serika')).toMatchObject({
      targetCharacterId: null,
      targetEnemyId: 'serika',
      hpChanges: [{ scope: 'enemy', enemyId: 'serika', delta: 0 }],
    });
    expect(resumed.commitEncounterRound(command)).toEqual(victorious);

    const postWinSave = resumed.createSaveSnapshot();
    expect(postWinSave?.run.activeEncounter).toBeNull();
    const afterLoad = battleService(BATTLE_MAP);
    expect(afterLoad.restoreSaveSnapshot(postWinSave)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(afterLoad.commitEncounterRound(command)).toEqual(afterLoad.getSnapshot(started.runId));

    const invalidReceipt = structuredClone(postWinSave) as unknown as {
      run: { lastEncounterCommit: { settlements: { characterId: string; targetCharacterId: string | null }[] } };
    };
    invalidReceipt.run.lastEncounterCommit.settlements[1]!.targetCharacterId = 'serika';
    const receiptRestore = battleService(BATTLE_MAP);
    expect(receiptRestore.restoreSaveSnapshot(invalidReceipt)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(receiptRestore.getSnapshot()).toBeNull();

    const nextEncounter = afterLoad.move(started.runId, 'c');
    expect(nextEncounter.partyHp).toEqual(drafted.partyHp);
    expect(nextEncounter.activeEncounter?.enemies).toEqual([{ enemyId: 'serika', currentHp: 3 }]);
    const nextVictory = afterLoad.commitEncounterRound(commitCommand(nextEncounter, 'battle-victory-2'));
    expect(nextVictory.completedEncounterNodeIds).toEqual(['b', 'c']);
    expect(nextVictory.activeEncounter).toBeNull();
    const success = afterLoad.move(started.runId, 'd');
    expect(afterLoad.getResult(started.runId)?.outcome).toBe('success');
    const freshRun = afterLoad.start(BATTLE_MAP_ID, BATTLE_PARTY);
    expect(freshRun.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 2 },
      { characterId: 'serika', currentHp: 8 },
      { characterId: 'hoshino', currentHp: 5 },
    ]);
    expect(success.status).toBe('success');
  });

  test('preserves a manually confirmed sole default target when an earlier action defeats it', () => {
    const singleTargetMap: TestMap = {
      ...BATTLE_MAP,
      id: 'test:map:manual-sole-target',
      nodes: BATTLE_MAP.nodes.map(node => node.id === 'b'
        ? { ...node, encounter: { ...node.encounter!, enemies: [node.encounter!.enemies![0]!] } }
        : node),
    };
    const service = battleService(singleTargetMap);
    const started = service.start(singleTargetMap.id, BATTLE_PARTY);
    const entered = service.move(started.runId, 'b');
    expect(service.previewActions(started.runId)?.preparedActions[1].targetEnemyId).toBe('serika');

    const manuallyLocked = service.setPreparedEnemyTarget(
      started.runId,
      'serika',
      'serika',
      draftToken(entered.activeEncounter),
    );
    expect(manuallyLocked.activeEncounter?.targetSelections).toContainEqual({
      characterId: 'serika',
      targetEnemyId: 'serika',
    });
    const preview = service.previewEncounterCommit(started.runId);
    expect(preview?.settlements?.[1]).toMatchObject({
      targetEnemyId: 'serika',
      resourceChanges: [
        { kind: 'cost', scope: 'team', resourceId: 'ammo', delta: -1 },
        { kind: 'effect', scope: 'team', resourceId: 'ammo', delta: 1 },
      ],
      hpChanges: [{ scope: 'enemy', enemyId: 'serika', delta: 0 }],
    });
    expect(preview?.settlements?.[1]?.skipReason).toBeUndefined();
  });

  test('reselects automatic Character targets in order, skips targetless actions for free, and saves the receipt', () => {
    const source = battleService(BATTLE_MAP);
    const started = source.start(BATTLE_MAP_ID, BATTLE_PARTY);
    const entered = source.move(started.runId, 'b');
    expect(source.previewActions(started.runId)?.preparedActions.map(row => row.targetEnemyId))
      .toEqual(['serika', 'serika', 'serika']);

    const preview = source.previewEncounterCommit(started.runId);
    expect(preview).toMatchObject({ canCommit: true });
    expect(preview?.settlements?.map(row => ({
      characterId: row.characterId,
      targetEnemyId: row.targetEnemyId ?? null,
      skipReason: row.skipReason,
    }))).toEqual([
      { characterId: 'shiroko', targetEnemyId: 'serika', skipReason: undefined },
      { characterId: 'serika', targetEnemyId: 'wolf', skipReason: undefined },
      { characterId: 'hoshino', targetEnemyId: null, skipReason: 'noLegalTarget' },
    ]);
    expect(preview?.settlements?.[2]?.resourceChanges).toEqual([]);
    expect(preview?.settlements?.[2]?.hpChanges).toBeUndefined();

    const command = commitCommand(entered, 'automatic-retarget-round');
    const committed = source.commitEncounterRound(command);
    expect(committed.activeEncounter).toBeNull();
    expect(committed.teamResources).toEqual([{ resourceId: 'ammo', value: 3 }]);
    expect(committed.lastEncounterCommit?.settlements).toEqual(preview?.settlements);

    const checkpoint = source.createSaveSnapshot();
    if (!checkpoint) throw new Error('Retargeted round receipt checkpoint is missing');
    const restored = battleService(BATTLE_MAP);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(restored.getSnapshot(started.runId)?.lastEncounterCommit?.settlements).toEqual(preview?.settlements);
  });

  test('keeps an already paid PlayerCommand fee when its automatic target has no replacement', () => {
    const commandSkipMap: TestMap = {
      id: 'test:map:command-target-skip',
      name: 'Command Target Skip',
      resumeVersion: 1,
      startNodeId: 'a',
      exitNodeIds: ['c'],
      partyCharacterIds: ['shiroko', 'serika'],
      initialPartyHp: [
        { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
        { characterId: 'serika', initialHp: 10, maxHp: 10 },
      ],
      initialPlayerCost: 1,
      initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
      actions: [
        { id: 'shiroko-kill', name: 'Shiroko Kill', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 5 }] } },
        { id: 'serika-natural', name: 'Serika Natural', eligibleCharacterIds: ['serika'],
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
        ...[1, 2, 3].map(index => ({
          id: 'serika-command-' + index,
          name: 'Serika Command ' + index,
          eligibleCharacterIds: ['serika'],
          target: { kind: 'enemy' as const },
          costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }],
          effectProgram: { resolve: [
            { op: 'damage', target: 'primary', amount: 1 },
            { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 2 },
          ] },
        } as const)),
      ],
      nodes: [
        { id: 'a', title: 'Start' },
        {
          id: 'b', title: 'Battle', encounter: {
            title: 'Battle',
            enemies: [{ id: 'enemy-a', initialHp: 5, maxHp: 5 }],
            participants: [
              { characterId: 'shiroko', actions: [{ actionId: 'shiroko-kill', tendencyWeight: 1 }] },
              { characterId: 'serika', actions: [
                { actionId: 'serika-natural', tendencyWeight: 1 },
                ...[1, 2, 3].map(index => ({ actionId: 'serika-command-' + index, tendencyWeight: 1 })),
              ] },
            ],
          },
        },
        { id: 'c', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
    };
    const service = battleService(commandSkipMap);
    const started = service.start(commandSkipMap.id, COMMIT_PARTY);
    const entered = service.move(started.runId, 'b');
    const beforeCommand = service.previewActions(started.runId);
    const commandOption = beforeCommand?.playerCommandOptions.find(row =>
      row.characterId === 'serika' && row.canPayActionCosts,
    );
    if (!commandOption) throw new Error('Expected an affordable Hand-out PlayerCommand candidate');
    const commanded = service.issuePlayerCommand(
      started.runId,
      'serika',
      commandOption.actionId,
      draftToken(entered.activeEncounter),
    );

    const preview = service.previewEncounterCommit(started.runId);
    expect(preview).toMatchObject({ canCommit: true, playerCostRequired: 1 });
    expect(preview?.settlements?.[1]).toMatchObject({
      actionId: commandOption.actionId,
      targetCharacterId: null,
      overrideKind: 'playerCommand',
      playerCostSpent: 1,
      resourceChanges: [],
      skipReason: 'noLegalTarget',
    });

    const committed = service.commitEncounterRound(commitCommand(commanded, 'command-target-skip'));
    expect(committed.playerCost).toBe(0);
    expect(committed.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
    expect(committed.lastEncounterCommit?.settlements[1]).toMatchObject({
      actionId: commandOption.actionId,
      playerCostSpent: 1,
      resourceChanges: [],
      skipReason: 'noLegalTarget',
    });
    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('PlayerCommand skip receipt checkpoint is missing');
    const restored = battleService(commandSkipMap);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(restored.getSnapshot(started.runId)?.lastEncounterCommit?.settlements[1])
      .toEqual(committed.lastEncounterCommit?.settlements[1]);
  });

  test('resolves Enemy turns in declaration order, stops on party defeat, and replays failure outside Save state', () => {
    const source = battleService(DEFEAT_MAP);
    const started = source.start(DEFEAT_MAP_ID, DEFEAT_PARTY);
    const entered = source.move(started.runId, 'b');
    const checkpointBeforeFailure = source.createSaveSnapshot();
    const command = commitCommand(entered, 'defeat-round-1');
    const failed = source.commitEncounterRound(command);
    expect(failed).toMatchObject({ status: 'failure', activeEncounter: null });
    expect(failed.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 0 },
      { characterId: 'serika', currentHp: 0 },
    ]);
    expect(failed.lastEncounterCommit?.enemyActions).toEqual([
      { enemyId: 'enemy-a', actionId: 'enemy-hit', targetCharacterId: 'shiroko', resourceChanges: [], hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -1 }] },
      { enemyId: 'enemy-b', actionId: 'enemy-hit', targetCharacterId: 'serika', resourceChanges: [], hpChanges: [{ scope: 'party', characterId: 'serika', delta: -1 }] },
      { enemyId: 'enemy-c', actionId: 'enemy-hit', skipReason: 'roundEnded', resourceChanges: [] },
    ]);
    expect(source.getSnapshot()).toBeNull();
    expect(source.getFailureResult(started.runId)).toMatchObject({ outcome: 'failure', reason: 'partyDefeated' });
    expect(source.createSaveSnapshot()).toBeNull();
    expect(source.commitEncounterRound(command)).toEqual(failed);
    expect(() => source.commitEncounterRound({ ...command, expectedCommitVersion: 1 })).toThrow(MapRunError);

    const rolledBack = battleService(DEFEAT_MAP);
    expect(rolledBack.restoreSaveSnapshot(checkpointBeforeFailure)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(rolledBack.getSnapshot(started.runId)?.partyHp).toEqual(entered.partyHp);
    const repeatedFailure = rolledBack.commitEncounterRound(command);
    expect(repeatedFailure.partyHp.every(row => row.currentHp === 0)).toBe(true);
    expect(rolledBack.getSnapshot()).toBeNull();

    const immediateExitMap: TestMap = {
      ...DEFEAT_MAP,
      id: 'test:map:instant-exit',
      startNodeId: 'exit',
      exitNodeIds: ['exit'],
      nodes: [{ id: 'exit', title: 'Exit' }],
      edges: [],
    };
    const newRunService = battleService(DEFEAT_MAP, immediateExitMap);
    const failedFirstRun = newRunService.start(DEFEAT_MAP_ID, DEFEAT_PARTY);
    newRunService.move(failedFirstRun.runId, 'b');
    newRunService.commitEncounterRound(commitCommand(newRunService.getSnapshot()!, 'terminal-failure-before-new-run'));
    expect(newRunService.getFailureResult(failedFirstRun.runId)).not.toBeNull();
    const immediatelyCompletedRun = newRunService.start(immediateExitMap.id, DEFEAT_PARTY);
    expect(immediatelyCompletedRun.status).toBe('success');
    expect(newRunService.getFailureResult(failedFirstRun.runId)).toBeNull();
  });

  test('keeps surviving members active after one ally falls, excludes downed targets, and retargets by current HP with stable ties', () => {
    const source = battleService(ENEMY_TURN_MAP);
    const started = source.start(ENEMY_TURN_MAP_ID, ENEMY_TURN_PARTY);
    const entered = source.move(started.runId, 'b');
    const firstDraft = source.setPreparedTarget(entered.runId, 'hoshino', 'serika', draftToken(entered.activeEncounter));
    const afterFirstEnemyTurn = source.commitEncounterRound(commitCommand(firstDraft, 'enemy-turn-1'));
    expect(afterFirstEnemyTurn.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 0 },
      { characterId: 'serika', currentHp: 2 },
      { characterId: 'hoshino', currentHp: 5 },
    ]);
    expect(afterFirstEnemyTurn.lastEncounterCommit?.enemyActions?.map(row => row.targetCharacterId)).toEqual([
      'shiroko',
      'serika',
    ]);

    const secondPreview = source.previewActions(started.runId);
    expect(secondPreview?.preparedActions[0]).toMatchObject({
      characterId: 'shiroko',
      handActionIds: [],
      preparedActionId: null,
    });
    expect(secondPreview?.preparedActions[2]?.legalTargetCharacterIds).toEqual(['serika', 'hoshino']);
    expect(() => source.setPreparedTarget(
      started.runId,
      'hoshino',
      'shiroko',
      draftToken(source.getSnapshot(started.runId)?.activeEncounter),
    )).toThrow(MapRunError);
    const secondDraft = source.setPreparedTarget(
      started.runId,
      'hoshino',
      'hoshino',
      draftToken(source.getSnapshot(started.runId)?.activeEncounter),
    );
    const secondCommand = commitCommand(secondDraft, 'enemy-turn-2');
    const afterSecondEnemyTurn = source.commitEncounterRound(secondCommand);
    expect(afterSecondEnemyTurn.status).toBe('inProgress');
    expect(afterSecondEnemyTurn.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 0 },
      { characterId: 'serika', currentHp: 0 },
      { characterId: 'hoshino', currentHp: 2 },
    ]);
    expect(afterSecondEnemyTurn.lastEncounterCommit?.enemyActions?.map(row => row.targetCharacterId)).toEqual([
      'serika',
      'hoshino',
    ]);

    const checkpoint = source.createSaveSnapshot();
    expect(checkpoint).not.toBeNull();
    if (!checkpoint) throw new Error('Enemy turn checkpoint is missing');
    const validRestore = battleService(ENEMY_TURN_MAP);
    expect(validRestore.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(validRestore.getSnapshot(started.runId)?.partyHp).toEqual(afterSecondEnemyTurn.partyHp);
    expect(validRestore.getSnapshot(started.runId)?.activeEncounter?.enemies).toEqual(afterSecondEnemyTurn.activeEncounter?.enemies);

    const invalidPartyHp = structuredClone(checkpoint) as unknown as { run: { partyHp: { currentHp: number }[] } };
    invalidPartyHp.run.partyHp[0]!.currentHp = 11;
    const partyHpRestore = battleService(ENEMY_TURN_MAP);
    expect(partyHpRestore.restoreSaveSnapshot(invalidPartyHp)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(partyHpRestore.getSnapshot()).toBeNull();

    const invalidEnemyHp = structuredClone(checkpoint) as unknown as { run: { activeEncounter: { enemies: { currentHp: number }[] } } };
    invalidEnemyHp.run.activeEncounter.enemies[0]!.currentHp = 11;
    const enemyHpRestore = battleService(ENEMY_TURN_MAP);
    expect(enemyHpRestore.restoreSaveSnapshot(invalidEnemyHp)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(enemyHpRestore.getSnapshot()).toBeNull();

    const defeatedCheckpoint = structuredClone(checkpoint) as unknown as {
      run: {
        partyHp: { currentHp: number }[];
        activeEncounter: {
          hands: { characterId: string; actionIds: string[] }[];
            enemyHands: { enemyId: string; actionIds: string[] }[];
          drawCursorStart: number;
          randomState: { cursor: number };
        };
      };
    };
    defeatedCheckpoint.run.partyHp[2]!.currentHp = 0;
    defeatedCheckpoint.run.activeEncounter.hands.forEach(hand => { hand.actionIds = []; });
    defeatedCheckpoint.run.activeEncounter.enemyHands.forEach(hand => { hand.actionIds = []; });
    defeatedCheckpoint.run.activeEncounter.randomState.cursor = defeatedCheckpoint.run.activeEncounter.drawCursorStart;
    const defeatedRestore = battleService(ENEMY_TURN_MAP);
    // Damage/heal Receipts authenticate the HP chain; changing HP in a checkpoint
    // without rewriting that Receipt is an invalid save, not a legitimate defeat.
    expect(defeatedRestore.restoreSaveSnapshot(defeatedCheckpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(defeatedRestore.getSnapshot()).toBeNull();
    expect(defeatedRestore.getFailureResult(started.runId)).toBeNull();
  });

  test('draws a weighted, unique Hand once for every fixed party member and leaves Wait Hands empty', () => {
    const service = handService();
    const started = service.start(HAND_MAP_ID, HAND_PARTY);
    const entered = service.move(started.runId, 'b');
    const encounter = entered.activeEncounter;
    expect(encounter).not.toBeNull();
    if (!encounter) throw new Error('Encounter Hand snapshot is missing');

    expect(encounter).toMatchObject({ nodeId: 'b', round: 1, drawCursorStart: 0 });
    expect(encounter.hands.map(hand => hand.characterId)).toEqual(HAND_PARTY.map(member => member.characterId));
    expect(encounter.hands[0].actionIds).toHaveLength(3);
    expect(new Set(encounter.hands[0].actionIds).size).toBe(3);
    expect(encounter.hands[0].actionIds).not.toContain('unpayable-actor-cost');
    expect(encounter.hands[0].actionIds).not.toContain('unpayable-team-cost');
    expect(encounter.hands[0].actionIds).not.toContain('eligible-not-candidate');
    expect(encounter.hands[1].actionIds).toHaveLength(2);
    expect(encounter.hands[1].actionIds).toContain('serika-only');
    expect(encounter.hands[2].actionIds).toEqual([]);
    expect(encounter.hands[3]).toEqual({ characterId: 'nonomi', actionIds: [] });

    expect(entered.activeEncounterNodeId).toBe(encounter.nodeId);
    expect(Object.keys(entered)).not.toContain('activeEncounterNodeId');
    const checkpoint = service.createSaveSnapshot();
    expect(checkpoint).not.toBeNull();
    if (!checkpoint) throw new Error('MapRun checkpoint is missing');
    expect(Object.keys(checkpoint.run)).not.toContain('activeEncounterNodeId');
    const serializedRun = JSON.parse(JSON.stringify(checkpoint.run)) as Record<string, unknown>;
    expect(serializedRun).not.toHaveProperty('activeEncounterNodeId');
    expect((serializedRun.activeEncounter as { nodeId: string }).nodeId).toBe('b');

    expect(service.getSnapshot()).toEqual(entered);
    expect(service.createSaveSnapshot()).toEqual(checkpoint);

    const participants = HAND_MAP.nodes.find(node => node.id === 'b')?.encounter?.participants;
    const shirokoParticipant = participants?.find(participant => participant.characterId === 'shiroko');
    expect(shirokoParticipant).toBeDefined();
    if (!shirokoParticipant) throw new Error('Shiroko candidates are missing');
    let favoredFirstCount = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      const draw = drawGameplayBHands({
        partyCharacterIds: ['shiroko'],
        livingPartyCharacterIds: ['shiroko'],
        livingEnemyIds: [],
        participants: [shirokoParticipant],
        actions: HAND_MAP.actions,
        actorResources: [{ characterId: 'shiroko', resourceId: 'stamina', value: 2 }],
        teamResources: [{ resourceId: 'supplies', value: 4 }],
        randomState: { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed, cursor: 0 },
      });
      if (draw.hands[0].actionIds[0] === 'favored') favoredFirstCount += 1;
    }
    expect(favoredFirstCount).toBeGreaterThan(250);
  });

  test('merges direct and tagged Pool candidates before one weighted draw and restores the same Hand', () => {
    const participant = {
      characterId: 'shiroko',
      actions: [
        { actionId: 'direct-only', tendencyWeight: 1 },
        { actionId: 'shared', tendencyWeight: 4 },
      ],
      candidatePoolIds: ['support-pool'],
    } as const;
    const actions = [
      { id: 'direct-only', name: 'Direct', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' as const } },
      { id: 'shared', name: 'Shared', tags: [tagRef('gameplay-b', ['action', 'support', 'guard'])], eligibleCharacterIds: ['shiroko'], target: { kind: 'none' as const } },
      { id: 'tag-only', name: 'Tagged', tags: [tagRef('gameplay-b', ['action', 'support', 'guard'])], eligibleCharacterIds: ['shiroko'], target: { kind: 'none' as const } },
      { id: 'party-ineligible', name: 'Enemy Only', tags: [tagRef('gameplay-b', ['action', 'support', 'guard'])], eligibleCharacterIds: [], target: { kind: 'partyCharacter' as const } },
      { id: 'role-incompatible', name: 'Wrong Role', tags: [tagRef('gameplay-b', ['action', 'support', 'guard'])], eligibleCharacterIds: ['shiroko'], target: { kind: 'self' as const }, tendencyRole: 'attack' as const },
      { id: 'pool-only', name: 'Pool', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' as const } },
      { id: 'enemy-pool-action', name: 'Enemy Pool', eligibleCharacterIds: [], target: { kind: 'partyCharacter' as const } },
      { id: 'unmatched', name: 'Unmatched', tags: [tagRef('gameplay-b', ['action', 'attack'])], eligibleCharacterIds: ['shiroko'], target: { kind: 'none' as const } },
    ] as const;
    const candidatePools = [{
      id: 'support-pool',
      entries: [
        { kind: 'action' as const, actionId: 'shared', weight: 2 },
        { kind: 'tag' as const, tag: tagRef('gameplay-b', ['action', 'support']), weight: 3 },
        { kind: 'action' as const, actionId: 'pool-only', weight: 1 },
      ],
    }, {
      id: 'enemy-pool',
      entries: [{ kind: 'action' as const, actionId: 'enemy-pool-action', weight: 1 }],
    }] as const;
    const candidateMap = { actions, candidatePools };
    expect(resolveGameplayMapCandidateSources(candidateMap, participant.actions, participant.candidatePoolIds)).toEqual([
      { actionId: 'direct-only', tendencyWeight: 1 },
      { actionId: 'shared', tendencyWeight: 9 },
      { actionId: 'tag-only', tendencyWeight: 3 },
      { actionId: 'party-ineligible', tendencyWeight: 3 },
      { actionId: 'role-incompatible', tendencyWeight: 3 },
      { actionId: 'pool-only', tendencyWeight: 1 },
    ]);

    const randomState = { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 137, cursor: 0 } as const;
    const draw = drawGameplayBHands({
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: ['shiroko'],
      livingEnemyIds: ['robot-a'],
      enemies: [{ id: 'robot-a', initialHp: 10, maxHp: 10, candidatePoolIds: ['enemy-pool'] }],
      enemyHealth: [{ enemyId: 'robot-a', currentHp: 10, maxHp: 10 }],
      participants: [participant],
      actions,
      candidatePools,
      actorResources: [],
      teamResources: [],
      enemyActorResources: [],
      enemyTeamResources: [],
      randomState,
    });
    expect(draw).toEqual(drawGameplayBHands({
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: ['shiroko'],
      livingEnemyIds: ['robot-a'],
      enemies: [{ id: 'robot-a', initialHp: 10, maxHp: 10, candidatePoolIds: ['enemy-pool'] }],
      enemyHealth: [{ enemyId: 'robot-a', currentHp: 10, maxHp: 10 }],
      participants: [participant],
      actions,
      candidatePools,
      actorResources: [],
      teamResources: [],
      enemyActorResources: [],
      enemyTeamResources: [],
      randomState,
    }));
    expect(draw.hands[0]?.actionIds).toHaveLength(3);
    expect(new Set(draw.hands[0]?.actionIds).size).toBe(3);
    expect(draw.hands[0]?.actionIds).not.toContain('unmatched');
    expect(draw.enemyHands).toEqual([{ enemyId: 'robot-a', actionIds: ['enemy-pool-action'] }]);

    const runParticipant = { characterId: 'shiroko', actions: [], candidatePoolIds: ['run-pool'] } as const;
    const runCandidatePools = [{
      id: 'run-pool',
      entries: [{ kind: 'action' as const, actionId: 'pool-only', weight: 1 }],
    }] as const;
    const map: TestMap = {
      ...HAND_MAP,
      id: 'test:map:candidate-pool',
      name: 'Candidate Pool',
      actions: [...HAND_MAP.actions ?? [], ...actions],
      candidatePools: runCandidatePools,
      nodes: HAND_MAP.nodes.map(node => node.id !== 'b' || !node.encounter
        ? node
        : { ...node, encounter: { ...node.encounter,
          participants: (node.encounter.participants ?? [])
          .map(current => current.characterId === 'shiroko' ? runParticipant : current) } }),
    };
    const source = new MapRunService(resolverOf(map), resolveTestVariant);
    const started = source.start(map.id, HAND_PARTY);
    const entered = source.move(started.runId, 'b');
    const activeEncounter = entered.activeEncounter;
    expect(activeEncounter).not.toBeNull();
    if (!activeEncounter) throw new Error('Candidate Pool Encounter is missing');
    expect(activeEncounter.hands[0]?.actionIds).toEqual(['pool-only']);
    const expectedDraw = drawGameplayBHands({
      partyCharacterIds: HAND_PARTY.map(member => member.characterId),
      enemies: map.nodes.find(node => node.id === 'b')?.encounter?.enemies,
      enemyHealth: activeEncounter.enemies.map(enemy => ({
        enemyId: enemy.enemyId,
        currentHp: enemy.currentHp,
        maxHp: map.nodes.find(node => node.id === 'b')?.encounter?.enemies?.find(definition => definition.id === enemy.enemyId)?.maxHp ?? 1,
      })),
      enemyActorResources: activeEncounter.enemyActorResources,
      enemyTeamResources: activeEncounter.enemyTeamResources,
      livingPartyCharacterIds: entered.partyHp.filter(row => row.currentHp > 0).map(row => row.characterId),
      livingEnemyIds: activeEncounter.enemies.filter(enemy => enemy.currentHp > 0).map(enemy => enemy.enemyId),
      participants: map.nodes.find(node => node.id === 'b')?.encounter?.participants,
      actions: map.actions,
      candidatePools: map.candidatePools,
      actorResources: entered.actorResources,
      teamResources: entered.teamResources,
      partyHealth: map.initialPartyHp.map(definition => ({
        characterId: definition.characterId,
        currentHp: entered.partyHp.find(row => row.characterId === definition.characterId)?.currentHp ?? 0,
        maxHp: definition.maxHp,
      })),
      randomState: {
        algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
        seed: activeEncounter.randomState.seed,
        cursor: activeEncounter.drawCursorStart,
      },
    });
    expect(expectedDraw.hands).toEqual(activeEncounter.hands);
    expect(expectedDraw.randomState).toEqual(activeEncounter.randomState);
    const initialCheckpoint = source.createSaveSnapshot();
    expect(initialCheckpoint).not.toBeNull();
    if (!initialCheckpoint) throw new Error('Initial Candidate Pool checkpoint is missing');
    const initialRestore = new MapRunService(resolverOf(map), resolveTestVariant);
    expect(initialRestore.restoreSaveSnapshot(initialCheckpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(initialRestore.getSnapshot(started.runId)?.activeEncounter).toEqual(entered.activeEncounter);
    const committed = source.commitEncounterRound(commitCommand(entered, 'candidate-pool-commit'));
    expect(committed.lastEncounterCommit?.settlements.find(row => row.characterId === 'shiroko'))
      .toMatchObject({ actionId: 'pool-only' });
    const checkpoint = source.createSaveSnapshot();
    expect(checkpoint).not.toBeNull();
    if (!checkpoint) throw new Error('Candidate Pool checkpoint is missing');
    const restored = new MapRunService(resolverOf(map), resolveTestVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toEqual({ status: 'restored', mapId: map.id, runId: started.runId });
    expect(restored.getSnapshot(started.runId)?.activeEncounter).toEqual(committed.activeEncounter);
    expect(restored.getSnapshot(started.runId)?.lastEncounterCommit).toEqual(committed.lastEncounterCommit);
  });

  test('draws Enemy Hands after party Hands with isolated resources and stable replay', () => {
    const input = {
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: ['shiroko'],
      livingEnemyIds: ['robot-a', 'robot-b', 'robot-c'],
      enemies: [
        {
          id: 'robot-a', initialHp: 10, maxHp: 10,
          actions: [{ actionId: 'enemy-spend', tendencyWeight: 1 }],
          initialResources: [{ resourceId: 'focus', value: 1 }],
        },
        {
          id: 'robot-b', initialHp: 10, maxHp: 10,
          actions: [
            { actionId: 'enemy-spend', tendencyWeight: 1 },
            { actionId: 'enemy-free', tendencyWeight: 1 },
          ],
          initialResources: [{ resourceId: 'focus', value: 1 }],
        },
        {
          id: 'robot-c', initialHp: 10, maxHp: 10,
          actions: [{ actionId: 'enemy-spend', tendencyWeight: 1 }],
          initialResources: [{ resourceId: 'focus', value: 1 }],
        },
        { id: 'robot-dead', initialHp: 10, maxHp: 10,
          actions: [{ actionId: 'enemy-spend', tendencyWeight: 1 }] },
      ],
      enemyHealth: [
        { enemyId: 'robot-a', currentHp: 10, maxHp: 10 },
        { enemyId: 'robot-b', currentHp: 10, maxHp: 10 },
        { enemyId: 'robot-c', currentHp: 10, maxHp: 10 },
        { enemyId: 'robot-dead', currentHp: 0, maxHp: 10 },
      ],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'party-spend', tendencyWeight: 1 }] }],
      actions: [
        {
          id: 'party-spend', name: 'Party spend', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'enemy' }, costs: [{ scope: 'team', resourceId: 'supply', amount: 2 }],
        },
        {
          id: 'enemy-spend', name: 'Enemy spend', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter' },
          costs: [
            { scope: 'actor', resourceId: 'focus', amount: 1 },
            { scope: 'team', resourceId: 'supply', amount: 2 },
          ],
        },
        { id: 'enemy-free', name: 'Enemy free', eligibleCharacterIds: [], target: { kind: 'self' } },
      ],
      actorResources: [],
      teamResources: [{ resourceId: 'supply', value: 3 }],
      enemyTeamResources: [{ resourceId: 'supply', value: 2 }],
      randomState: { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 23, cursor: 4 },
    } as const;

    const draw = drawGameplayBHands(input);
    expect(draw).toEqual(drawGameplayBHands(input));
    expect(draw.hands).toEqual([{ characterId: 'shiroko', actionIds: ['party-spend'] }]);
    expect(draw.enemyHands).toEqual([
      { enemyId: 'robot-a', actionIds: ['enemy-spend'] },
      { enemyId: 'robot-b', actionIds: ['enemy-free', 'enemy-spend'] },
      { enemyId: 'robot-c', actionIds: [] },
      { enemyId: 'robot-dead', actionIds: [] },
    ]);
    expect(draw.enemyHands[1]?.actionIds[0]).toBe('enemy-free');
    expect(draw.randomState.cursor).toBe(8);
  });

  test('applies recovery, defense, and attack tendency to the Enemy side using its own HP and legal targets', () => {
    const countEnemySituationalFirst = (
      role: 'recovery' | 'defense' | 'attack',
      enemyHp: number,
      allyHp: number,
      livingPartyCharacterIds: string[] = ['shiroko'],
    ) => {
      let count = 0;
      for (let seed = 0; seed < 500; seed += 1) {
        const target = role === 'recovery'
          ? { kind: 'enemy' as const }
          : role === 'attack'
            ? { kind: 'partyCharacter' as const }
            : { kind: 'self' as const };
        const draw = drawGameplayBHands({
          partyCharacterIds: ['shiroko'],
          livingPartyCharacterIds,
          livingEnemyIds: ['robot-a', 'robot-b'],
          enemies: [{
            id: 'robot-a', initialHp: 10, maxHp: 10,
            actions: [
              { actionId: 'enemy-plain', tendencyWeight: 1 },
              { actionId: 'enemy-situational', tendencyWeight: 1 },
            ],
          }, { id: 'robot-b', initialHp: 10, maxHp: 10 }],
          enemyHealth: [
            { enemyId: 'robot-a', currentHp: enemyHp, maxHp: 10 },
            { enemyId: 'robot-b', currentHp: allyHp, maxHp: 10 },
          ],
          partyHealth: [{ characterId: 'shiroko', currentHp: 10, maxHp: 10 }],
          actions: [
            { id: 'enemy-plain', name: 'Plain', eligibleCharacterIds: [], target: { kind: 'self' } },
            {
              id: 'enemy-situational', name: 'Situational', eligibleCharacterIds: [], target,
              tendencyRole: role,
            },
          ],
          actorResources: [],
          teamResources: [],
          enemyActorResources: [],
          enemyTeamResources: [],
          randomState: { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed, cursor: 0 },
        });
        if (draw.enemyHands[0]?.actionIds[0] === 'enemy-situational') count += 1;
      }
      return count;
    };

    expect(countEnemySituationalFirst('recovery', 10, 7))
      .toBeGreaterThan(countEnemySituationalFirst('recovery', 10, 10) + 50);
    expect(countEnemySituationalFirst('defense', 5, 10))
      .toBeGreaterThan(countEnemySituationalFirst('defense', 6, 10) + 50);
    expect(countEnemySituationalFirst('attack', 10, 10))
      .toBeGreaterThan(countEnemySituationalFirst('attack', 10, 10, []) + 100);

    const randomState = { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 29, cursor: 7 } as const;
    const noLegalEnemyAttack = drawGameplayBHands({
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: [],
      livingEnemyIds: ['robot-a'],
      enemies: [{
        id: 'robot-a', initialHp: 10, maxHp: 10,
        actions: [{ actionId: 'enemy-attack', tendencyWeight: 1 }],
      }],
      enemyHealth: [{ enemyId: 'robot-a', currentHp: 10, maxHp: 10 }],
      partyHealth: [{ characterId: 'shiroko', currentHp: 0, maxHp: 10 }],
      actions: [{
        id: 'enemy-attack', name: 'Enemy attack', eligibleCharacterIds: [],
        target: { kind: 'partyCharacter' }, tendencyRole: 'attack',
      }],
      actorResources: [],
      teamResources: [],
      enemyActorResources: [],
      enemyTeamResources: [],
      randomState,
    });
    expect(noLegalEnemyAttack.enemyHands).toEqual([{ enemyId: 'robot-a', actionIds: [] }]);
    expect(noLegalEnemyAttack.randomState).toEqual(randomState);
  });

  test('applies explicit recovery, defense, and attack weights at their exact HP / target thresholds', () => {
    const countSituationalFirst = (
      role: 'recovery' | 'defense' | 'attack',
      partyHealth: { characterId: string; currentHp: number; maxHp: number }[],
      livingEnemyIds: string[],
    ) => {
      const target = role === 'recovery'
        ? { kind: 'partyCharacter' as const }
        : role === 'attack'
          ? { kind: 'enemy' as const }
          : { kind: 'none' as const };
      let count = 0;
      for (let seed = 0; seed < 500; seed += 1) {
        const draw = drawGameplayBHands({
          partyCharacterIds: ['shiroko', 'serika'],
          livingPartyCharacterIds: partyHealth.filter(row => row.currentHp > 0).map(row => row.characterId),
          livingEnemyIds,
          partyHealth,
          participants: [{
            characterId: 'shiroko',
            actions: [
              { actionId: 'plain', tendencyWeight: 1 },
              { actionId: 'situational', tendencyWeight: 1 },
            ],
          }],
          actions: [
            { id: 'plain', name: 'Plain', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' } },
            { id: 'situational', name: 'Situational', eligibleCharacterIds: ['shiroko'], target, tendencyRole: role },
          ],
          actorResources: [],
          teamResources: [],
          randomState: { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed, cursor: 0 },
        });
        if (draw.hands[0].actionIds[0] === 'situational') count += 1;
      }
      return count;
    };

    const healthy = [
      { characterId: 'shiroko', currentHp: 10, maxHp: 10 },
      { characterId: 'serika', currentHp: 8, maxHp: 8 },
    ];
    const injuredAtQuarter = [
      { characterId: 'shiroko', currentHp: 10, maxHp: 10 },
      { characterId: 'serika', currentHp: 6, maxHp: 8 },
    ];
    expect(countSituationalFirst('recovery', injuredAtQuarter, []))
      .toBeGreaterThan(countSituationalFirst('recovery', healthy, []) + 40);

    const defenseAboveHalf = [
      { characterId: 'shiroko', currentHp: 6, maxHp: 10 },
      { characterId: 'serika', currentHp: 8, maxHp: 8 },
    ];
    const defenseAtHalf = [
      { characterId: 'shiroko', currentHp: 5, maxHp: 10 },
      { characterId: 'serika', currentHp: 8, maxHp: 8 },
    ];
    expect(countSituationalFirst('defense', defenseAtHalf, []))
      .toBeGreaterThan(countSituationalFirst('defense', defenseAboveHalf, []) + 40);

    expect(countSituationalFirst('attack', healthy, ['enemy-a']))
      .toBeGreaterThan(countSituationalFirst('attack', healthy, []) + 40);

    const contextualMap: TestMap = {
      ...HAND_MAP,
      id: 'test:map:contextual-hand',
      initialPartyHp: HAND_MAP.initialPartyHp.map(row => row.characterId === 'shiroko'
        ? { ...row, initialHp: 5 }
        : row),
      actions: HAND_MAP.actions!.map(action => action.id === 'favored'
        ? { ...action, tendencyRole: 'defense' as const }
        : action),
    };
    const source = new MapRunService(resolverOf(contextualMap), resolveTestVariant);
    const started = source.start(contextualMap.id, HAND_PARTY);
    const entered = source.move(started.runId, 'b');
    const saved = source.createSaveSnapshot();
    if (!saved) throw new Error('Context-weighted Encounter save is missing');
    const checkpoint = JSON.parse(JSON.stringify(saved)) as MapRunSaveSnapshot;
    const restored = new MapRunService(resolverOf(contextualMap), resolveTestVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(restored.getSnapshot()?.activeEncounter?.hands).toEqual(entered.activeEncounter?.hands);
    expect(restored.getSnapshot()?.activeEncounter?.randomState).toEqual(entered.activeEncounter?.randomState);
  });

  test('previews Hand-first preparation, Wait, self, and automatic party targets', () => {
    const encounter = preparedEncounter([
      { characterId: 'shiroko', actionIds: ['inspect'] },
      { characterId: 'serika', actionIds: ['self-care'] },
    ]);
    const input = {
      definition: PREPARED_MAP,
      encounter,
      party: PREPARED_PARTY,
      playerCost: PREPARED_MAP.initialPlayerCost,
      actorResources: [],
      teamResources: [],
    };
    const before = structuredClone(input);
    const preview = resolveGameplayBActionPreview(input);
    expect(preview.preparedActions).toMatchObject([
      {
        characterId: 'shiroko',
        naturalActionId: 'inspect',
        preparedActionId: 'inspect',
        targetKind: 'none',
        targetCharacterId: null,
        targetSelectionRequired: false,
      },
      {
        characterId: 'serika',
        naturalActionId: 'self-care',
        preparedActionId: 'self-care',
        targetKind: 'self',
        legalTargetCharacterIds: ['serika'],
        targetCharacterId: 'serika',
        targetSelectionRequired: false,
      },
    ]);
    expect(input).toEqual(before);

    expect(() => resolveGameplayBActionPreview({
      ...input,
      encounter: {
        ...preparedEncounter([
          { characterId: 'shiroko', actionIds: ['self-care'] },
          { characterId: 'serika', actionIds: [] },
        ]),
        targetSelections: [{ characterId: 'shiroko', targetCharacterId: 'shiroko' }],
      },
    })).toThrow(/does not accept an explicit target selection/);

    const partyTargetPreview = resolveGameplayBActionPreview({
      ...input,
      encounter: preparedEncounter([
        { characterId: 'shiroko', actionIds: ['assist-party'] },
        { characterId: 'serika', actionIds: [] },
      ]),
    });
    expect(partyTargetPreview.preparedActions[0]).toMatchObject({
      naturalActionId: 'assist-party',
      preparedActionId: 'assist-party',
      targetKind: 'partyCharacter',
      legalTargetCharacterIds: ['shiroko', 'serika'],
      targetCharacterId: 'shiroko',
      targetSelectionRequired: false,
    });
    const manuallySelectedPartyTarget = resolveGameplayBActionPreview({
      ...input,
      encounter: {
        ...preparedEncounter([
          { characterId: 'shiroko', actionIds: ['assist-party'] },
          { characterId: 'serika', actionIds: [] },
        ]),
        targetSelections: [{ characterId: 'shiroko', targetCharacterId: 'serika' }],
      },
    });
    expect(manuallySelectedPartyTarget.preparedActions[0]).toMatchObject({
      legalTargetCharacterIds: ['shiroko', 'serika'],
      targetCharacterId: 'serika',
      targetSelectionRequired: false,
    });

    const waitPreview = resolveGameplayBActionPreview({
      ...input,
      encounter: preparedEncounter([
        { characterId: 'shiroko', actionIds: [] },
        { characterId: 'serika', actionIds: [] },
      ]),
    });
    expect(waitPreview.preparedActions[0]).toMatchObject({
      naturalActionId: null,
      preparedActionId: null,
      actionName: null,
      targetKind: null,
      targetCharacterId: null,
    });
  });

  test('drops a carried-over Enemy target that fell, keeping the reused card stateless next round', () => {
    // 'serika' died in a previous round; the carried target choice must not crash
    // or make a Character lose its target. The reused card re-decides against the
    // surviving Enemy instead.
    const staleEncounter: MapRunEncounterSnapshot = {
      nodeId: 'b',
      round: 2,
      hands: [
        { characterId: 'shiroko', actionIds: ['shiroko-strike'] },
        { characterId: 'serika', actionIds: ['serika-strike'] },
        { characterId: 'hoshino', actionIds: ['hoshino-strike'] },
      ],
      enemyHands: [{ enemyId: 'serika', actionIds: [] }, { enemyId: 'wolf', actionIds: [] }],
      enemyActorResources: [],
      enemyTeamResources: [],
      overrides: [],
      targetSelections: [{ characterId: 'shiroko', targetEnemyId: 'serika' }],
      enemies: [
        { enemyId: 'serika', currentHp: 0 },
        { enemyId: 'wolf', currentHp: 5 },
      ],
      draftVersion: 0,
      drawCursorStart: 0,
      randomState: { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 5, cursor: 0 },
      lastCommit: null,
    };
    const preview = resolveGameplayBActionPreview({
      definition: BATTLE_MAP,
      encounter: staleEncounter,
      party: BATTLE_PARTY,
      partyHp: [
        { characterId: 'shiroko', currentHp: 2 },
        { characterId: 'serika', currentHp: 8 },
        { characterId: 'hoshino', currentHp: 5 },
      ],
      playerCost: 0,
      actorResources: [],
      teamResources: [{ resourceId: 'ammo', value: 3 }],
    });
    expect(preview.preparedActions.map(row => row.targetEnemyId)).toEqual(['wolf', 'wolf', 'wolf']);
    expect(preview.preparedActions.every(row => !row.targetSelectionRequired)).toBe(true);
  });

  test('chooses preferred legal targets and never creates a Wait Action ID', () => {
    const singlePartyMap: TestMap = {
      ...PREPARED_MAP,
      partyCharacterIds: ['shiroko'],
      initialPartyHp: [PREPARED_MAP.initialPartyHp[0]!],
      nodes: PREPARED_MAP.nodes.map(node => node.id === 'b'
        ? {
            ...node,
            encounter: {
              ...node.encounter!,
              participants: [{
                characterId: 'shiroko',
                actions: [{ actionId: 'assist-party', tendencyWeight: 1 }],
              }],
            },
          }
        : node),
    };
    const preview = resolveGameplayBActionPreview({
      definition: singlePartyMap,
      encounter: preparedEncounter([{ characterId: 'shiroko', actionIds: ['assist-party'] }]),
      party: [PREPARED_PARTY[0]],
      playerCost: 2,
      actorResources: [],
      teamResources: [],
    });
    expect(preview.preparedActions[0]).toMatchObject({
      targetKind: 'partyCharacter',
      legalTargetCharacterIds: ['shiroko'],
      targetCharacterId: 'shiroko',
      targetSelectionRequired: false,
    });

    const wait = resolveGameplayBActionPreview({
      definition: PREPARED_MAP,
      encounter: preparedEncounter([
        { characterId: 'shiroko', actionIds: [] },
        { characterId: 'serika', actionIds: [] },
      ]),
      party: PREPARED_PARTY,
      playerCost: 2,
      actorResources: [],
      teamResources: [],
    }).preparedActions[0];
    expect(wait.preparedActionId).toBeNull();
    expect(wait.handActionIds).toEqual([]);
  });

  test('selects lowest enemy HP ratio and highest party missing-HP ratio with stable ties', () => {
    const enemyDefinitions = [
      { id: 'enemy-a', initialHp: 4, maxHp: 10 },
      { id: 'enemy-b', initialHp: 4, maxHp: 20 },
      { id: 'enemy-c', initialHp: 8, maxHp: 10 },
      { id: 'enemy-d', initialHp: 2, maxHp: 10 },
    ];
    const enemyPreferenceMap: TestMap = {
      ...BATTLE_MAP,
      actions: BATTLE_ACTIONS.map(action => action.id === 'shiroko-strike'
        ? { ...action, target: { kind: 'enemy' as const, preference: 'lowestHpRatio' as const } }
        : action),
      nodes: BATTLE_MAP.nodes.map(node => node.id === 'b'
        ? { ...node, encounter: { ...node.encounter!, enemies: enemyDefinitions } }
        : node),
    };
    const enemyEncounter = {
      ...preparedEncounter(BATTLE_PARTY.map((member, index) => ({
        characterId: member.characterId,
        actionIds: index === 0 ? ['shiroko-strike'] : [BATTLE_ACTIONS[index]!.id],
      }))),
      enemyHands: enemyDefinitions.map(enemy => ({ enemyId: enemy.id, actionIds: [] })),
      enemies: [
        { enemyId: 'enemy-a', currentHp: 4 },
        { enemyId: 'enemy-b', currentHp: 4 },
        { enemyId: 'enemy-c', currentHp: 8 },
        { enemyId: 'enemy-d', currentHp: 2 },
      ],
    };
    const enemyPreview = resolveGameplayBActionPreview({
      definition: enemyPreferenceMap,
      encounter: enemyEncounter,
      party: BATTLE_PARTY,
      partyHp: [
        { characterId: 'shiroko', currentHp: 2 },
        { characterId: 'serika', currentHp: 8 },
        { characterId: 'hoshino', currentHp: 5 },
      ],
      playerCost: 0,
      actorResources: [],
      teamResources: [{ resourceId: 'ammo', value: 3 }],
    });
    expect(enemyPreview.preparedActions[0]).toMatchObject({
      legalTargetEnemyIds: ['enemy-a', 'enemy-b', 'enemy-c', 'enemy-d'],
      targetEnemyId: 'enemy-b',
      targetSelectionRequired: false,
    });

    const manuallySelectedEnemyPreview = resolveGameplayBActionPreview({
      definition: enemyPreferenceMap,
      encounter: { ...enemyEncounter, targetSelections: [{ characterId: 'shiroko', targetEnemyId: 'enemy-c' }] },
      party: BATTLE_PARTY,
      partyHp: [
        { characterId: 'shiroko', currentHp: 2 },
        { characterId: 'serika', currentHp: 8 },
        { characterId: 'hoshino', currentHp: 5 },
      ],
      playerCost: 0,
      actorResources: [],
      teamResources: [{ resourceId: 'ammo', value: 3 }],
    });
    expect(manuallySelectedEnemyPreview.preparedActions[0].targetEnemyId).toBe('enemy-c');

    const stableEnemyPreview = resolveGameplayBActionPreview({
      definition: { ...enemyPreferenceMap, actions: BATTLE_ACTIONS },
      encounter: enemyEncounter,
      party: BATTLE_PARTY,
      partyHp: [
        { characterId: 'shiroko', currentHp: 2 },
        { characterId: 'serika', currentHp: 8 },
        { characterId: 'hoshino', currentHp: 5 },
      ],
      playerCost: 0,
      actorResources: [],
      teamResources: [{ resourceId: 'ammo', value: 3 }],
    });
    expect(stableEnemyPreview.preparedActions[0].targetEnemyId).toBe('enemy-a');

    const partyPreferenceMap: TestMap = {
      ...PREPARED_MAP,
      actions: PREPARED_MAP.actions!.map(action => action.id === 'assist-party'
        ? { ...action, target: { kind: 'partyCharacter' as const, preference: 'highestMissingHpRatio' as const } }
        : action),
    };
    const partyPreview = resolveGameplayBActionPreview({
      definition: partyPreferenceMap,
      encounter: preparedEncounter([
        { characterId: 'shiroko', actionIds: ['assist-party'] },
        { characterId: 'serika', actionIds: [] },
      ]),
      party: PREPARED_PARTY,
      partyHp: [
        { characterId: 'shiroko', currentHp: 6 },
        { characterId: 'serika', currentHp: 4 },
      ],
      playerCost: 2,
      actorResources: [],
      teamResources: [],
    });
    expect(partyPreview.preparedActions[0]).toMatchObject({
      legalTargetCharacterIds: ['shiroko', 'serika'],
      targetCharacterId: 'serika',
      targetSelectionRequired: false,
    });
  });

  test('repeated previews preserve the natural Hand-first Prepared Action and all Run state', () => {
    const service = handService();
    const started = service.start(HAND_MAP_ID, HAND_PARTY);
    service.move(started.runId, 'b');
    const before = service.getSnapshot();
    const beforeCheckpoint = service.createSaveSnapshot();

    const first = service.previewActions(started.runId);
    const second = service.previewActions(started.runId);
    const current = service.getSnapshot();
    const afterCheckpoint = service.createSaveSnapshot();

    expect(first).toEqual(second);
    expect(first?.preparedActions.map(row => row.preparedActionId)).toEqual(
      before?.activeEncounter?.hands.map(hand => hand.actionIds[0] ?? null),
    );
    expect(current).toEqual(before);
    expect(afterCheckpoint).toEqual(beforeCheckpoint);
  });

  test('free Swap uses another Hand item, and both a clear and the natural Action restore the default', () => {
    const service = handService();
    const started = service.start(HAND_MAP_ID, HAND_PARTY);
    const active = service.move(started.runId, 'b');
    const encounter = active.activeEncounter;
    if (!encounter) throw new Error('Encounter is missing');
    const shirokoHand = encounter.hands.find(hand => hand.characterId === 'shiroko');
    if (!shirokoHand || shirokoHand.actionIds.length < 3) throw new Error('Shiroko Hand needs three Actions');
    const naturalActionId = shirokoHand.actionIds[0];
    const firstSwapActionId = shirokoHand.actionIds[1];
    const secondSwapActionId = shirokoHand.actionIds[2];

    const swapped = service.swapPreparedAction(started.runId, 'shiroko', firstSwapActionId, draftToken(encounter));
    expect(swapped.activeEncounter).toMatchObject({
      overrides: [{ kind: 'swap', characterId: 'shiroko', actionId: firstSwapActionId }],
      draftVersion: 1,
    });
    expect(swapped.activeEncounter?.hands).toEqual(encounter.hands);
    expect(swapped.activeEncounter?.round).toBe(encounter.round);
    expect(swapped.activeEncounter?.randomState).toEqual(encounter.randomState);
    expect(swapped.playerCost).toBe(active.playerCost);
    const preparedAfterSwap = service.previewActions(started.runId)?.preparedActions[0];
    expect(preparedAfterSwap).toMatchObject({
      naturalActionId,
      preparedActionId: firstSwapActionId,
      overrideKind: 'swap',
      playerCost: 0,
    });

    const modified = service.swapPreparedAction(started.runId, 'shiroko', secondSwapActionId, draftToken(swapped.activeEncounter));
    expect(modified.activeEncounter?.overrides).toEqual([
      { kind: 'swap', characterId: 'shiroko', actionId: secondSwapActionId },
    ]);
    expect(modified.activeEncounter?.draftVersion).toBe(2);
    const restoredNatural = service.clearActionOverride(started.runId, 'shiroko', draftToken(modified.activeEncounter));
    expect(restoredNatural.activeEncounter?.overrides).toEqual([]);
    expect(restoredNatural.activeEncounter?.draftVersion).toBe(3);
    expect(service.previewActions(started.runId)?.preparedActions[0]).toMatchObject({
      naturalActionId,
      preparedActionId: naturalActionId,
      overrideKind: null,
    });

    const reSwapped = service.swapPreparedAction(started.runId, 'shiroko', firstSwapActionId, draftToken(restoredNatural.activeEncounter));
    const naturalSelection = service.swapPreparedAction(started.runId, 'shiroko', naturalActionId!, draftToken(reSwapped.activeEncounter));
    expect(naturalSelection.activeEncounter?.overrides).toEqual([]);
    expect(naturalSelection.activeEncounter?.draftVersion).toBe(5);
    expect(service.previewActions(started.runId)?.preparedActions[0]).toMatchObject({
      naturalActionId,
      preparedActionId: naturalActionId,
      overrideKind: null,
    });
  });

  test('rejects Hand-out Swap and stale requests while keeping every Character independently overridable', () => {
    const service = handService();
    const started = service.start(HAND_MAP_ID, HAND_PARTY);
    const active = service.move(started.runId, 'b');
    const encounter = active.activeEncounter;
    if (!encounter) throw new Error('Encounter is missing');
    const shirokoHand = encounter.hands.find(hand => hand.characterId === 'shiroko');
    const serikaHand = encounter.hands.find(hand => hand.characterId === 'serika');
    if (!shirokoHand || !serikaHand || serikaHand.actionIds.length < 2) throw new Error('Test Hands are incomplete');
    const missingCandidate = ['favored', 'common-a', 'common-b', 'common-c']
      .find(actionId => !shirokoHand.actionIds.includes(actionId));
    if (!missingCandidate) throw new Error('Expected a Hand-out candidate');
    const beforeInvalidSwap = service.getSnapshot();
    const initialToken = draftToken(encounter);
    expect(() => service.swapPreparedAction(started.runId, 'shiroko', missingCandidate, initialToken))
      .toThrow(/another Action in the same Character Hand/);
    expect(service.getSnapshot()).toEqual(beforeInvalidSwap);
    expect(() => service.swapPreparedAction(started.runId, 'shiroko', shirokoHand.actionIds[1], {
      ...initialToken,
      round: initialToken.round + 1,
    })).toThrow(/draft is stale/);
    expect(service.getSnapshot()).toEqual(beforeInvalidSwap);

    const accepted = service.swapPreparedAction(started.runId, 'shiroko', shirokoHand.actionIds[1], initialToken);
    const afterAccepted = service.getSnapshot();
    expect(() => service.swapPreparedAction(started.runId, 'shiroko', shirokoHand.actionIds[2], initialToken))
      .toThrow(/draft is stale/);
    expect(service.getSnapshot()).toEqual(afterAccepted);
    expect(accepted.activeEncounter?.draftVersion).toBe(1);

    const serikaSwapActionId = serikaHand.actionIds[1];
    const both = service.swapPreparedAction(started.runId, 'serika', serikaSwapActionId, draftToken(accepted.activeEncounter));
    expect(both.activeEncounter?.overrides).toEqual([
      { kind: 'swap', characterId: 'shiroko', actionId: shirokoHand.actionIds[1] },
      { kind: 'swap', characterId: 'serika', actionId: serikaSwapActionId },
    ]);
    expect(both.activeEncounter?.draftVersion).toBe(2);
    const preparedByCharacter = new Map(
      service.previewActions(started.runId)?.preparedActions.map(row => [row.characterId, row]) ?? [],
    );
    expect(preparedByCharacter.get('shiroko')?.preparedActionId).toBe(shirokoHand.actionIds[1]);
    expect(preparedByCharacter.get('serika')?.preparedActionId).toBe(serikaSwapActionId);
  });

  test('rejects a prior Encounter draft token after a new Encounter resets its revision', () => {
    const twoEncounterMap: TestMap = {
      ...HAND_MAP,
      id: 'test:map:two-encounters',
      nodes: HAND_MAP.nodes.flatMap(node => node.id === 'b'
        ? [node, { ...node, id: 'd', title: 'Second Encounter' }]
        : [node]),
      edges: [
        { fromNodeId: 'a', toNodeId: 'b' },
        { fromNodeId: 'b', toNodeId: 'd' },
        { fromNodeId: 'd', toNodeId: 'c' },
      ],
    };
    const service = new MapRunService(resolverOf(twoEncounterMap), resolveTestVariant);
    const started = service.start(twoEncounterMap.id, HAND_PARTY);
    const firstEncounter = service.move(started.runId, 'b');
    const previousToken = draftToken(firstEncounter.activeEncounter);
    service.completeEncounter(started.runId);

    const secondEncounter = service.move(started.runId, 'd');
    const secondHand = secondEncounter.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    if (!secondHand || secondHand.actionIds.length < 2) throw new Error('Second Encounter Hand is incomplete');
    expect(secondEncounter.activeEncounter).toMatchObject({ nodeId: 'd', round: 1, draftVersion: 0 });
    const beforeStaleRequest = service.getSnapshot();
    expect(() => service.swapPreparedAction(started.runId, 'shiroko', secondHand.actionIds[1], previousToken))
      .toThrow(/draft is stale/);
    expect(service.getSnapshot()).toEqual(beforeStaleRequest);
  });

  test('PlayerCommand selects a payable Hand-out candidate for one PlayerCost without deducting it', () => {
    const service = handService();
    const started = service.start(HAND_MAP_ID, HAND_PARTY);
    const active = service.move(started.runId, 'b');
    const encounter = active.activeEncounter;
    if (!encounter) throw new Error('Encounter is missing');
    const shirokoHand = encounter.hands.find(hand => hand.characterId === 'shiroko');
    const participant = HAND_MAP.nodes.find(node => node.id === 'b')?.encounter?.participants
      ?.find(row => row.characterId === 'shiroko');
    if (!shirokoHand || !participant) throw new Error('Shiroko candidates are missing');
    const commandActionId = participant.actions
      .map(candidate => candidate.actionId)
      .find(actionId => !shirokoHand.actionIds.includes(actionId)
        && !['unpayable-actor-cost', 'unpayable-team-cost'].includes(actionId));
    if (!commandActionId) throw new Error('Expected an affordable Hand-out candidate');

    const before = service.getSnapshot();
    const preview = service.previewActions(started.runId);
    const option = preview?.playerCommandOptions.find(row => row.characterId === 'shiroko' && row.actionId === commandActionId);
    expect(option).toMatchObject({ playerCost: 1, canPayPlayerCost: true, canPayActionCosts: true });

    const commanded = service.issuePlayerCommand(started.runId, 'shiroko', commandActionId, draftToken(encounter));
    expect(commanded.activeEncounter?.overrides).toEqual([
      { kind: 'playerCommand', characterId: 'shiroko', actionId: commandActionId },
    ]);
    expect(commanded.activeEncounter?.draftVersion).toBe(1);
    expect(commanded.playerCost).toBe(before?.playerCost);
    expect(commanded.actorResources).toEqual(before?.actorResources);
    expect(commanded.teamResources).toEqual(before?.teamResources);
    expect(commanded.activeEncounter?.hands).toEqual(before?.activeEncounter?.hands);
    expect(commanded.activeEncounter?.round).toBe(before?.activeEncounter?.round);
    expect(commanded.activeEncounter?.randomState).toEqual(before?.activeEncounter?.randomState);
    expect(service.previewActions(started.runId)?.preparedActions[0]).toMatchObject({
      preparedActionId: commandActionId,
      overrideKind: 'playerCommand',
      playerCost: 1,
    });

    const cleared = service.clearActionOverride(started.runId, 'shiroko', draftToken(commanded.activeEncounter));
    expect(cleared.playerCost).toBe(before?.playerCost);
    expect(cleared.activeEncounter?.overrides).toEqual([]);
  });

  test('rejects unpayable Action costs and unavailable PlayerCost Commands with zero writes', () => {
    const service = handService();
    const started = service.start(HAND_MAP_ID, HAND_PARTY);
    const active = service.move(started.runId, 'b');
    const before = service.getSnapshot();
    const preview = service.previewActions(started.runId);
    expect(preview?.playerCommandOptions.find(row => row.actionId === 'unpayable-actor-cost'))
      .toMatchObject({ canPayPlayerCost: true, canPayActionCosts: false });
    expect(() => service.issuePlayerCommand(started.runId, 'shiroko', 'unpayable-actor-cost', draftToken(before?.activeEncounter)))
      .toThrow(/Action resource costs are not payable/);
    expect(service.getSnapshot()).toEqual(before);

    const zeroCostMap = { ...HAND_MAP, initialPlayerCost: 0 };
    const zeroCostService = new MapRunService(resolverOf(zeroCostMap), resolveTestVariant);
    const zeroCostRun = zeroCostService.start(HAND_MAP_ID, HAND_PARTY);
    const zeroCostEncounter = zeroCostService.move(zeroCostRun.runId, 'b');
    const zeroCostHand = zeroCostEncounter.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    if (!zeroCostHand) throw new Error('Shiroko Hand is missing');
    const freeCandidate = HAND_MAP.nodes.find(node => node.id === 'b')?.encounter?.participants
      ?.find(row => row.characterId === 'shiroko')?.actions
      .map(candidate => candidate.actionId)
      .find(actionId => !zeroCostHand.actionIds.includes(actionId)
        && !['unpayable-actor-cost', 'unpayable-team-cost'].includes(actionId));
    if (!freeCandidate) throw new Error('Expected an affordable Hand-out candidate');
    const zeroCostBefore = zeroCostService.getSnapshot();
    expect(() => zeroCostService.issuePlayerCommand(zeroCostRun.runId, 'shiroko', freeCandidate, draftToken(zeroCostEncounter.activeEncounter)))
      .toThrow(/requires 1 PlayerCost/);
    expect(zeroCostService.getSnapshot()).toEqual(zeroCostBefore);
    expect(active.playerCost).toBe(before?.playerCost);
  });

  test('sets, clears, and restores a legal party target while rejecting an invalid or stale target', () => {
    const service = preparedService();
    const started = service.start(PREPARED_MAP_ID, PREPARED_PARTY);
    const active = service.move(started.runId, 'b');
    const shirokoHand = active.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    if (!shirokoHand || !shirokoHand.actionIds.includes('assist-party')) throw new Error('Assist must be in Shiroko Hand');
    let token = draftToken(active.activeEncounter);
    if (shirokoHand.actionIds[0] !== 'assist-party') {
      const swapped = service.swapPreparedAction(started.runId, 'shiroko', 'assist-party', token);
      token = draftToken(swapped.activeEncounter);
    }
    const beforeInvalidTarget = service.getSnapshot();
    expect(() => service.setPreparedTarget(started.runId, 'shiroko', 'nonomi', token))
      .toThrow(/not legal/);
    expect(service.getSnapshot()).toEqual(beforeInvalidTarget);

    const targeted = service.setPreparedTarget(started.runId, 'shiroko', 'serika', token);
    expect(targeted.activeEncounter?.targetSelections).toEqual([
      { characterId: 'shiroko', targetCharacterId: 'serika' },
    ]);
    expect(targeted.activeEncounter?.draftVersion).toBe(token.draftVersion + 1);
    expect(targeted.playerCost).toBe(active.playerCost);
    expect(targeted.activeEncounter?.round).toBe(active.activeEncounter?.round);
    expect(targeted.activeEncounter?.hands).toEqual(active.activeEncounter?.hands);
    expect(targeted.activeEncounter?.randomState).toEqual(active.activeEncounter?.randomState);
    expect(service.previewActions(started.runId)?.preparedActions[0]).toMatchObject({
      preparedActionId: 'assist-party',
      targetCharacterId: 'serika',
      targetSelectionRequired: false,
    });

    const beforeStale = service.getSnapshot();
    expect(() => service.setPreparedTarget(started.runId, 'shiroko', 'shiroko', token))
      .toThrow(/draft is stale/);
    expect(service.getSnapshot()).toEqual(beforeStale);

    const checkpoint = JSON.parse(JSON.stringify(service.createSaveSnapshot())) as MapRunSaveSnapshot;
    const restored = preparedService();
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(restored.getSnapshot()).toEqual(service.getSnapshot());
    expect(restored.previewActions(started.runId)?.preparedActions[0].targetCharacterId).toBe('serika');

    const clearedTarget = service.setPreparedTarget(started.runId, 'shiroko', null, draftToken(targeted.activeEncounter));
    expect(clearedTarget.activeEncounter?.targetSelections).toEqual([]);
    expect(service.previewActions(started.runId)?.preparedActions[0]).toMatchObject({
      targetCharacterId: 'shiroko',
      targetSelectionRequired: false,
    });
  });

  test('treats a missing MapRun resource balance as zero when filtering Hand candidates', () => {
    const draw = drawGameplayBHands({
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: ['shiroko'],
      livingEnemyIds: [],
      participants: [{
        characterId: 'shiroko',
        actions: [{ actionId: 'costly', tendencyWeight: 1 }],
      }],
      actions: [{
        id: 'costly',
        name: 'Costly',
        eligibleCharacterIds: ['shiroko'],
        target: { kind: 'none' },
        costs: [{ scope: 'actor', resourceId: 'missing', amount: 1 }],
      }],
      actorResources: [],
      teamResources: [],
      randomState: { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 5, cursor: 0 },
    });

    expect(draw.hands).toEqual([{ characterId: 'shiroko', actionIds: [] }]);
    expect(draw.randomState.cursor).toBe(0);
  });

  test('reserves natural Hand-first Team costs in party order and does not draw an unaffordable Wait hand', () => {
    const randomState = { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 41, cursor: 7 } as const;
    const draw = drawGameplayBHands({
      partyCharacterIds: ['shiroko', 'serika'],
      livingPartyCharacterIds: ['shiroko', 'serika'],
      livingEnemyIds: [],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'shiroko-spend-two', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'serika-spend-two', tendencyWeight: 1 }] },
      ],
      actions: TEAM_RESERVATION_MAP.actions,
      actorResources: [],
      teamResources: [{ resourceId: 'supplies', value: 3 }],
      randomState,
    });

    expect(draw.hands).toEqual([
      { characterId: 'shiroko', actionIds: ['shiroko-spend-two'] },
      { characterId: 'serika', actionIds: [] },
    ]);
    expect(draw.randomState.cursor).toBe(randomState.cursor + 1);
  });

  test('filters unit Actions without legal targets before drawing and preserves the RNG cursor', () => {
    const randomState = { algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM, seed: 17, cursor: 4 } as const;
    const draw = drawGameplayBHands({
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: ['shiroko'],
      livingEnemyIds: [],
      participants: [{
        characterId: 'shiroko',
        actions: [{ actionId: 'attack', tendencyWeight: 1000 }],
      }],
      actions: [{
        id: 'attack',
        name: 'Attack',
        eligibleCharacterIds: ['shiroko'],
        target: { kind: 'enemy' },
      }],
      actorResources: [],
      teamResources: [],
      randomState,
    });
    expect(draw.hands).toEqual([{ characterId: 'shiroko', actionIds: [] }]);
    expect(draw.randomState).toEqual(randomState);

    const cardDraw = drawGameplayBHands({
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: ['shiroko'],
      livingEnemyIds: [],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'card-action', tendencyWeight: 1 }] }],
      actions: [{
        id: 'card-action',
        name: 'Card Action',
        eligibleCharacterIds: ['shiroko'],
        target: { kind: 'card', side: 'ally' },
          effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] },
      }],
      actorResources: [],
      teamResources: [],
      randomState,
    });
    expect(cardDraw.hands[0].actionIds).toEqual(['card-action']);

    const downedTargetDraw = drawGameplayBHands({
      partyCharacterIds: ['shiroko'],
      livingPartyCharacterIds: [],
      livingEnemyIds: [],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'party-action', tendencyWeight: 1 }] }],
      actions: [{
        id: 'party-action',
        name: 'Party Action',
        eligibleCharacterIds: ['shiroko'],
        target: { kind: 'partyCharacter' },
      }],
      actorResources: [],
      teamResources: [],
      randomState,
    });
    expect(downedTargetDraw.hands).toEqual([{ characterId: 'shiroko', actionIds: [] }]);
    expect(downedTargetDraw.randomState).toEqual(randomState);
  });

  test('clears Encounter-local Hand and RNG while retaining MapRun-local resources', () => {
    const service = handService();
    const started = service.start(HAND_MAP_ID, HAND_PARTY);
    const active = service.move(started.runId, 'b');
    const completed = service.completeEncounter(started.runId);

    expect(active.activeEncounter?.hands).toHaveLength(HAND_PARTY.length);
    expect(completed.activeEncounter).toBeNull();
    expect(completed.activeEncounterNodeId).toBeNull();
    expect(completed.actorResources).toEqual([
      { characterId: 'shiroko', resourceId: 'stamina', value: 2 },
      { characterId: 'serika', resourceId: 'stamina', value: 3 },
      { characterId: 'hoshino', resourceId: 'stamina', value: 0 },
      { characterId: 'nonomi', resourceId: 'stamina', value: 0 },
    ]);
    expect(completed.teamResources).toEqual([{ resourceId: 'supplies', value: 4 }]);
    expect(completed.playerCost).toBe(HAND_MAP.initialPlayerCost);
  });

  test('initializes MapRun Facts once and retains them across Encounter, Node, and Restart lifecycles', () => {
    const factsMap: TestMap = {
      ...ROUTE_MAP,
      exitNodeIds: ['d'],
      mapRunFacts: {
        counters: [{ id: 'progress', initial: 2, min: 0, max: 5 }],
        flags: [{ id: 'signal', initial: true }],
      },
      nodes: [...ROUTE_MAP.nodes, { id: 'd', title: 'D' }],
      edges: [...ROUTE_MAP.edges, { fromNodeId: 'c', toNodeId: 'd' }],
    };
    const service = new MapRunService(resolverOf(factsMap));
    const started = service.start(factsMap.id, ADMITTED_PARTY);
    expect(started.mapRunFacts).toEqual({
      counters: [{ id: 'progress', value: 2 }],
      flags: [{ id: 'signal', value: true }],
    });

    const encounter = service.move(started.runId, 'b');
    expect(service.completeEncounter(encounter.runId).mapRunFacts).toEqual(started.mapRunFacts);
    const moved = service.move(started.runId, 'c');
    expect(moved.mapRunFacts).toEqual(started.mapRunFacts);
    const restarted = service.restart(started.runId);
    expect(restarted.mapRunFacts).toEqual(started.mapRunFacts);

    service.abandon(restarted.runId);
    expect(service.getSnapshot()).toBeNull();
    const nextRun = service.start(factsMap.id, ADMITTED_PARTY);
    expect(nextRun.mapRunFacts).toEqual(started.mapRunFacts);
  });

  test('does not materialize MapRun Facts when the Map has no declaration', () => {
    const service = new MapRunService(resolverOf(ROUTE_MAP));
    const started = service.start(ROUTE_MAP.id, ADMITTED_PARTY);
    expect(started).not.toHaveProperty('mapRunFacts');
  });

  test('rejects a mismatched Encounter Hand checkpoint without partially installing the Run', () => {
    const source = handService();
    const started = source.start(HAND_MAP_ID, HAND_PARTY);
    source.move(started.runId, 'b');
    const saved = source.createSaveSnapshot();
    expect(saved).not.toBeNull();
    if (!saved) throw new Error('MapRun checkpoint is missing');
    const checkpoint = JSON.parse(JSON.stringify(saved)) as MapRunSaveSnapshot;
    const currentEncounter = checkpoint.run.activeEncounter;
    expect(currentEncounter).not.toBeNull();
    if (!currentEncounter) throw new Error('Active Encounter checkpoint is missing');
    const shirokoHand = currentEncounter.hands[0];
    const unusedCandidate = ['favored', 'common-a', 'common-b', 'common-c']
      .find(actionId => !shirokoHand.actionIds.includes(actionId));
    expect(unusedCandidate).toBeDefined();
    if (!unusedCandidate) throw new Error('Expected one undrawn candidate');

    const corrupt = (patch: Record<string, unknown>): MapRunSaveSnapshot => ({
      ...checkpoint,
      run: { ...checkpoint.run, ...patch } as MapRunSaveSnapshot['run'],
    });
    const corruptEncounter = (patch: Record<string, unknown>): MapRunSaveSnapshot => corrupt({
      activeEncounter: { ...currentEncounter, ...patch },
    });

    const invalidCheckpoints: unknown[] = [
      corruptEncounter({ nodeId: 'a' }),
      corruptEncounter({ hands: [
        { ...shirokoHand, actionIds: ['eligible-not-candidate', ...shirokoHand.actionIds.slice(1)] },
        ...currentEncounter.hands.slice(1),
      ] }),
      corruptEncounter({ hands: [
        { ...shirokoHand, actionIds: ['serika-only', ...shirokoHand.actionIds.slice(1)] },
        ...currentEncounter.hands.slice(1),
      ] }),
      corruptEncounter({ hands: [
        { ...shirokoHand, actionIds: [shirokoHand.actionIds[0], shirokoHand.actionIds[0], shirokoHand.actionIds[2]] },
        ...currentEncounter.hands.slice(1),
      ] }),
      corruptEncounter({ hands: [
        { ...shirokoHand, actionIds: [...shirokoHand.actionIds, unusedCandidate] },
        ...currentEncounter.hands.slice(1),
      ] }),
      corruptEncounter({ randomState: { ...currentEncounter.randomState, algorithm: 'unknown' } }),
      corruptEncounter({ randomState: { ...currentEncounter.randomState, cursor: currentEncounter.randomState.cursor + 1 } }),
      corruptEncounter({ drawCursorStart: 1 }),
      corruptEncounter({ hands: currentEncounter.hands.slice(0, -1) }),
      corrupt({ activeEncounter: null }),
      { ...checkpoint, run: { ...checkpoint.run, activeEncounterNodeId: 'a' } },
    ];

    for (const invalid of invalidCheckpoints) {
      const target = handService();
      expect(target.restoreSaveSnapshot(invalid)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
      expect(target.getSnapshot()).toBeNull();
    }

    const legacyEncounter = { ...currentEncounter } as unknown as Record<string, unknown>;
    delete legacyEncounter.overrides;
    delete legacyEncounter.override;
    delete legacyEncounter.targetSelections;
    delete legacyEncounter.draftVersion;
    const legacyTarget = handService();
    expect(legacyTarget.restoreSaveSnapshot(corrupt({ activeEncounter: legacyEncounter })))
      .toMatchObject({ status: 'restored', runId: started.runId });
    expect(legacyTarget.getSnapshot()?.activeEncounter)
      .toMatchObject({ overrides: [], targetSelections: [], draftVersion: 0 });

    const singularOverride = shirokoHand.actionIds[1]!;
    const singularEncounter = { ...currentEncounter } as unknown as Record<string, unknown>;
    delete singularEncounter.overrides;
    singularEncounter.override = { kind: 'swap', characterId: 'shiroko', actionId: singularOverride };
    const singularTarget = handService();
    expect(singularTarget.restoreSaveSnapshot(corrupt({ activeEncounter: singularEncounter })))
      .toMatchObject({ status: 'restored', runId: started.runId });
    expect(singularTarget.getSnapshot()?.activeEncounter?.overrides).toEqual([
      { kind: 'swap', characterId: 'shiroko', actionId: singularOverride },
    ]);

    const invalidOverrides: unknown[] = [
      corruptEncounter({ overrides: [
        { kind: 'swap', characterId: 'shiroko', actionId: shirokoHand.actionIds[0] },
      ] }),
      corruptEncounter({ overrides: [
        { kind: 'swap', characterId: 'shiroko', actionId: singularOverride },
        { kind: 'swap', characterId: 'shiroko', actionId: singularOverride },
      ] }),
      corruptEncounter({ overrides: [
        { kind: 'swap', characterId: 'serika', actionId: singularOverride },
        { kind: 'swap', characterId: 'shiroko', actionId: singularOverride },
      ] }),
    ];
    for (const invalid of invalidOverrides) {
      const target = handService();
      expect(target.restoreSaveSnapshot(invalid)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
      expect(target.getSnapshot()).toBeNull();
    }

    const inactiveSource = handService();
    inactiveSource.start(HAND_MAP_ID, HAND_PARTY);
    const inactiveSave = inactiveSource.createSaveSnapshot();
    expect(inactiveSave).not.toBeNull();
    if (!inactiveSave) throw new Error('Inactive MapRun checkpoint is missing');
    const malformedInactiveCheckpoint = JSON.parse(JSON.stringify(inactiveSave)) as MapRunSaveSnapshot;
    const inactiveTarget = handService();
    expect(inactiveTarget.restoreSaveSnapshot({
      ...malformedInactiveCheckpoint,
      run: { ...malformedInactiveCheckpoint.run, activeEncounter: {} },
    })).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(inactiveTarget.getSnapshot()).toBeNull();
  });

  test('starts from the resolver definition with one fixed current Node', () => {
    const service = new MapRunService(resolverOf(ROUTE_MAP));
    const run = service.start(MAP_ID, ADMITTED_PARTY);

    expect(run).toMatchObject({
      mapId: MAP_ID,
      party: ADMITTED_PARTY,
      playerCost: ROUTE_MAP.initialPlayerCost,
      status: 'inProgress',
      currentNodeId: 'a',
      visitedNodeIds: ['a'],
      completedEncounterNodeIds: [],
      activeEncounterNodeId: null,
    });
    expect(service.getSnapshot()).toEqual(run);
    expect(service.getSnapshot()).not.toBe(service.getSnapshot());
    expect(Object.isFrozen(service.getSnapshot()?.visitedNodeIds)).toBe(true);
    expect(Object.isFrozen(run.party)).toBe(true);
    expect(Object.isFrozen(run.party[0])).toBe(true);
  });

  test('rejects an unknown Map without creating a Run', () => {
    const service = new MapRunService(resolverOf(ROUTE_MAP));

    expect(() => service.start('test:map:missing', ADMITTED_PARTY)).toThrow(MapRunError);
    expect(service.getSnapshot()).toBeNull();
  });

  test('rejects an incomplete admitted party without creating a Run', () => {
    const service = new MapRunService(resolverOf(ROUTE_MAP));

    expect(() => service.start(MAP_ID, [])).toThrow(/complete admitted party snapshot/);
    expect(service.getSnapshot()).toBeNull();
  });

  test('enters an Encounter on the start Node and requires a declared manual completion', () => {
    const startEncounterMap: TestMap = {
      ...ROUTE_MAP,
      nodes: [
        { id: 'a', title: 'A', encounter: { title: 'Starting Encounter' } },
        ...ROUTE_MAP.nodes.slice(1),
      ],
    };
    const service = new MapRunService(resolverOf(startEncounterMap));
    const run = service.start(MAP_ID, ADMITTED_PARTY);
    const beforeRejectedCommands = service.getSnapshot();

    expect(run.activeEncounterNodeId).toBe('a');
    expect(() => service.completeEncounter(run.runId)).toThrow(/does not declare a manual completion action/);
    expect(() => service.move(run.runId, 'b')).toThrow(/while an Encounter is active/);
    expect(service.getSnapshot()).toEqual(beforeRejectedCommands);
  });

  test('requires directed adjacency, completes at B without moving, then succeeds at exit C', () => {
    const service = new MapRunService(resolverOf(ROUTE_MAP));
    const started = service.start(MAP_ID, ADMITTED_PARTY);
    const beforeRejectedMove = service.getSnapshot();

    expect(() => service.move(started.runId, 'c')).toThrow(/not reachable/);
    expect(service.getSnapshot()).toEqual(beforeRejectedMove);

    const atB = service.move(started.runId, 'b');
    expect(atB).toMatchObject({ currentNodeId: 'b', activeEncounterNodeId: 'b', status: 'inProgress' });
    expect(atB.party).toEqual(ADMITTED_PARTY);
    expect(atB.playerCost).toBe(ROUTE_MAP.initialPlayerCost);
    const beforeBlockedMove = service.getSnapshot();
    expect(() => service.move(started.runId, 'c')).toThrow(/while an Encounter is active/);
    expect(service.getSnapshot()).toEqual(beforeBlockedMove);

    const afterEncounter = service.completeEncounter(started.runId);
    expect(afterEncounter).toMatchObject({
      currentNodeId: 'b',
      activeEncounterNodeId: null,
      completedEncounterNodeIds: ['b'],
      status: 'inProgress',
    });
    expect(afterEncounter.party).toEqual(ADMITTED_PARTY);
    expect(afterEncounter.playerCost).toBe(ROUTE_MAP.initialPlayerCost);
    expect(() => service.completeEncounter(started.runId)).toThrow(/no active Encounter/);

    const finished = service.move(started.runId, 'c');
    expect(finished).toMatchObject({ currentNodeId: 'c', visitedNodeIds: ['a', 'b', 'c'], status: 'success' });
    expect(finished.party).toEqual(ADMITTED_PARTY);
    expect(finished.playerCost).toBe(ROUTE_MAP.initialPlayerCost);
    expect(service.getSnapshot()).toBeNull();
    expect(service.createSaveSnapshot()).toBeNull();

    const result = service.getResult(finished.runId);
    expect(result).toEqual({
      runId: finished.runId,
      mapId: MAP_ID,
      outcome: 'success',
      exitNodeId: 'c',
      mapName: 'Route',
      exitNodeTitle: 'C',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(service.getResult(finished.runId)).not.toBe(result);
    expect(service.getResult('another-run')).toBeNull();
    expect(result).not.toHaveProperty('party');
    expect(result).not.toHaveProperty('playerCost');
    expect(result).not.toHaveProperty('visitedNodeIds');
    expect(() => service.move(started.runId, 'b')).toThrow(/unknown MapRun ID/);
    expect(() => service.completeEncounter(started.runId)).toThrow(/unknown MapRun ID/);
    expect(service.getResult(finished.runId)).toEqual(result);
  });

  test('does not reopen a completed Encounter when a directed route revisits its Node', () => {
    const revisitMap: TestMap = {
      ...ROUTE_MAP,
      edges: [...ROUTE_MAP.edges, { fromNodeId: 'b', toNodeId: 'a' }],
    };
    const service = new MapRunService(resolverOf(revisitMap));
    const run = service.start(MAP_ID, ADMITTED_PARTY);

    service.move(run.runId, 'b');
    service.completeEncounter(run.runId);
    service.move(run.runId, 'a');
    const revisited = service.move(run.runId, 'b');

    expect(revisited).toMatchObject({
      currentNodeId: 'b',
      activeEncounterNodeId: null,
      completedEncounterNodeIds: ['b'],
      visitedNodeIds: ['a', 'b'],
    });
  });

  test('refuses a parallel Run without disturbing the active Run and allows a new Run after success', () => {
    const service = new MapRunService(resolverOf(ROUTE_MAP));
    const first = service.start(MAP_ID, ADMITTED_PARTY);
    const beforeRejectedStart = service.getSnapshot();

    expect(() => service.start(MAP_ID, ADMITTED_PARTY)).toThrow(/already in progress/);
    expect(service.getSnapshot()).toEqual(beforeRejectedStart);

    service.move(first.runId, 'b');
    service.completeEncounter(first.runId);
    service.move(first.runId, 'c');
    expect(service.getResult(first.runId)).not.toBeNull();
    const second = service.start(MAP_ID, ADMITTED_PARTY);
    expect(second.runId).not.toBe(first.runId);
    expect(second.currentNodeId).toBe('a');
    expect(service.getResult(first.runId)).toBeNull();
  });

  test('exposes only the terminal success result through GameInstance and clears it on dispose', () => {
    const game = new GameInstance();
    let disposed = false;
    try {
      game.init([baseDatapack, gameplayBMapDatapack], { enterDefaultInit: false });
      const map = gameplayBMapDatapack.maps?.[0];
      expect(map).toBeDefined();
      if (!map) throw new Error('Gameplay B sample Map is missing');

      const shirokoVariant = game.rosterSystem.getAllVariants().find(variant => variant.proto === 'shiroko');
      expect(shirokoVariant).toBeDefined();
      if (!shirokoVariant) throw new Error('Base Datapack has no registered Shiroko Variant');
      game.mutations.acquireCharacter(shirokoVariant.id, 'story');
      const serikaVariant = game.rosterSystem.getAllVariants().find(variant => variant.proto === 'serika');
      expect(serikaVariant).toBeDefined();
      if (!serikaVariant) throw new Error('Base Datapack has no registered Serika Variant');
      game.mutations.acquireCharacter(serikaVariant.id, 'story');

      const started = game.startMap(map.id);
      const encounterEdge = map.edges.find(edge => edge.fromNodeId === started.currentNodeId
        && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
      expect(encounterEdge).toBeDefined();
      if (!encounterEdge) throw new Error('Sample Map start Node has no Encounter edge');
      game.moveMap(started.runId, encounterEdge.toNodeId);
      const completed = game.completeMapEncounter(started.runId);
      const exitEdge = map.edges.find(edge => edge.fromNodeId === completed.currentNodeId
        && map.exitNodeIds.includes(edge.toNodeId));
      expect(exitEdge).toBeDefined();
      if (!exitEdge) throw new Error('Sample Map Encounter Node has no exit edge');

      const terminal = game.moveMap(started.runId, exitEdge.toNodeId);
      expect(terminal.status).toBe('success');
      expect(game.mapRun.getSnapshot()).toBeNull();
      expect(game.save().mapRun).toBeUndefined();

      const result = game.mapRun.getResult(started.runId);
      expect(result).toEqual({
        runId: started.runId,
        mapId: map.id,
        outcome: 'success',
        exitNodeId: exitEdge.toNodeId,
        mapName: map.name,
        exitNodeTitle: map.nodes.find(node => node.id === exitEdge.toNodeId)?.title,
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(game.mapRun.getResult(started.runId)).not.toBe(result);
      expect(result).not.toHaveProperty('party');
      expect(result).not.toHaveProperty('playerCost');
      expect(result).not.toHaveProperty('visitedNodeIds');

      game.dispose();
      disposed = true;
      expect(game.mapRun.getResult(started.runId)).toBeNull();
    } finally {
      if (!disposed) game.dispose();
    }
  });

  test('commits prepared actions and resolved targets atomically, then restores and deduplicates the checkpointed request', () => {
    const service = new MapRunService(resolverOf(TARGET_COMMIT_MAP), resolveTestVariant);
    const started = service.start(TARGET_COMMIT_MAP_ID, COMMIT_PARTY);
    const atEncounter = service.move(started.runId, 'b');
    const initialEncounter = atEncounter.activeEncounter;
    if (!initialEncounter) throw new Error('Target Commit Encounter is missing');

    const drafted = service.setPreparedTarget(
      started.runId,
      'serika',
      'shiroko',
      draftToken(initialEncounter),
    );
    const command = {
      runId: started.runId,
      requestId: 'target-round-1',
      expectedCommitVersion: drafted.commitVersion,
      draft: draftToken(drafted.activeEncounter),
    };
    const beforePreview = service.getSnapshot();
    const commitPreview = service.previewEncounterCommit(started.runId);
    expect(commitPreview).toMatchObject({
      nodeId: 'b', round: 1, draftVersion: drafted.activeEncounter?.draftVersion,
      canCommit: true, playerCostRequired: 0, diagnostics: [],
    });
    expect(commitPreview?.settlements).toMatchObject([
      { characterId: 'shiroko', actionId: 'inspect', targetCharacterId: null, playerCostSpent: 0 },
      { characterId: 'serika', actionId: 'aid', targetCharacterId: 'shiroko', playerCostSpent: 0 },
    ]);
    expect(service.previewEncounterCommit(started.runId)).toEqual(commitPreview);
    expect(service.getSnapshot()).toEqual(beforePreview);
    const committed = service.commitEncounterRound(command);
    expect(committed).toMatchObject({
      commitVersion: 1,
      playerCost: TARGET_COMMIT_MAP.initialPlayerCost,
      activeEncounter: {
        nodeId: 'b',
        round: 2,
        drawCursorStart: drafted.activeEncounter?.randomState.cursor,
        lastCommit: {
          requestId: command.requestId,
          commandVersion: 0,
          resultingCommitVersion: 1,
          nodeId: 'b',
          round: 1,
          draftVersion: 1,
          settlements: [
            { characterId: 'shiroko', actionId: 'inspect', targetCharacterId: null, playerCostSpent: 0 },
            { characterId: 'serika', actionId: 'aid', targetCharacterId: 'shiroko', playerCostSpent: 0 },
          ],
        },
      },
    });
    expect(committed.activeEncounter?.lastCommit?.settlements).toEqual(commitPreview?.settlements);
    expect(committed.teamResources).toContainEqual({ resourceId: 'clues', value: 1 });
    expect(committed.teamResources).toContainEqual({ resourceId: 'supplies', value: 1 });
    expect(committed.actorResources).toContainEqual({ characterId: 'shiroko', resourceId: 'focus', value: 1 });
    expect(committed.actorResources).toContainEqual({ characterId: 'serika', resourceId: 'focus', value: 0 });
    expect(Object.isFrozen(committed.activeEncounter?.lastCommit)).toBe(true);

    const checkpoint = JSON.parse(JSON.stringify(service.createSaveSnapshot())) as MapRunSaveSnapshot;
    const restored = new MapRunService(resolverOf(TARGET_COMMIT_MAP), resolveTestVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', runId: started.runId });
    const beforeRetry = restored.getSnapshot();
    expect(beforeRetry?.activeEncounter?.lastCommit).toEqual(committed.activeEncounter?.lastCommit);
    expect(restored.commitEncounterRound(command)).toEqual(beforeRetry);
    expect(restored.getSnapshot()).toEqual(beforeRetry);

    const staleCommand = {
      ...command,
      requestId: 'stale-round-1',
      draft: draftToken(beforeRetry?.activeEncounter),
    };
    expect(() => restored.commitEncounterRound(staleCommand)).toThrow(/version is stale/);
    expect(restored.getSnapshot()).toEqual(beforeRetry);

    const completed = restored.completeEncounter(started.runId);
    expect(completed.activeEncounter).toBeNull();
    expect(completed.commitVersion).toBe(1);
    expect(completed.teamResources).toEqual(committed.teamResources);
    expect(completed.actorResources).toEqual(committed.actorResources);
    const followUp = restored.move(started.runId, 'c');
    expect(followUp.activeEncounter?.nodeId).toBe('c');
    expect(followUp.commitVersion).toBe(1);
    expect(followUp.teamResources).toEqual(committed.teamResources);
    expect(followUp.actorResources).toEqual(committed.actorResources);
  });

  test('accepts consistent multi-override receipts while rejecting forged override kinds and PlayerCost pairings', () => {
    const source = new MapRunService(resolverOf(OVERRIDE_COMMIT_MAP), resolveTestVariant);
    const started = source.start(OVERRIDE_COMMIT_MAP_ID, COMMIT_PARTY);
    const entered = source.move(started.runId, 'b');
    const committed = source.commitEncounterRound({
      runId: started.runId,
      requestId: 'receipt-source',
      expectedCommitVersion: entered.commitVersion,
      draft: draftToken(entered.activeEncounter),
    });
    const saved = JSON.parse(JSON.stringify(source.createSaveSnapshot())) as MapRunSaveSnapshot;
    const activeEncounter = saved.run.activeEncounter;
    const legalReceipt = activeEncounter?.lastCommit;
    if (!activeEncounter || !legalReceipt) throw new Error('Legal Commit receipt is missing');
    const corruptReceipt = (
      settlementPatch: (settlement: MapRunEncounterActionSettlement) => MapRunEncounterActionSettlement,
    ): MapRunSaveSnapshot => {
      const lastCommit = {
        ...legalReceipt,
        settlements: legalReceipt.settlements.map(settlementPatch),
      };
      return {
        ...saved,
        run: {
          ...saved.run,
          lastEncounterCommit: lastCommit,
          activeEncounter: { ...activeEncounter, lastCommit },
        },
      };
    };

    const forgedSwapCost = corruptReceipt(settlement => ({
      ...settlement, overrideKind: 'swap', playerCostSpent: 1,
    }));
    const swapTarget = new MapRunService(resolverOf(OVERRIDE_COMMIT_MAP), resolveTestVariant);
    expect(swapTarget.restoreSaveSnapshot(forgedSwapCost)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(swapTarget.getSnapshot()).toBeNull();

    const forgedCommandCost = corruptReceipt(settlement => ({
      ...settlement, overrideKind: 'playerCommand', playerCostSpent: 0,
    }));
    const commandTarget = new MapRunService(resolverOf(OVERRIDE_COMMIT_MAP), resolveTestVariant);
    expect(commandTarget.restoreSaveSnapshot(forgedCommandCost)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(commandTarget.getSnapshot()).toBeNull();

    const multiCommand = corruptReceipt(settlement => ({
      ...settlement, overrideKind: 'playerCommand', playerCostSpent: 1,
    }));
    const multiTarget = new MapRunService(resolverOf(OVERRIDE_COMMIT_MAP), resolveTestVariant);
    expect(multiTarget.restoreSaveSnapshot(multiCommand)).toMatchObject({ status: 'restored', runId: started.runId });
    expect(multiTarget.getSnapshot()?.activeEncounter?.lastCommit?.settlements.map(settlement => settlement.overrideKind))
      .toEqual(['playerCommand', 'playerCommand']);
    expect(committed.activeEncounter?.lastCommit?.settlements).toHaveLength(2);
  });

  test('rejects Commit after a Hand Action is removed from the active Encounter candidates without writing', () => {
    type MutableTestMap = { -readonly [K in keyof TestMap]: TestMap[K] };
    const mutableMap: MutableTestMap = { ...TARGET_COMMIT_MAP };
    const service = new MapRunService(resolverOf(mutableMap), resolveTestVariant);
    const started = service.start(TARGET_COMMIT_MAP_ID, COMMIT_PARTY);
    const entered = service.move(started.runId, 'b');
    const shirokoHand = entered.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    const handActionId = shirokoHand?.actionIds[0];
    if (!handActionId) throw new Error('Shiroko Hand Action is missing');
    const before = service.getSnapshot();

    mutableMap.nodes = mutableMap.nodes.map(node => {
      if (node.id !== 'b' || !node.encounter) return node;
      return {
        ...node,
        encounter: {
          ...node.encounter,
          participants: (node.encounter.participants ?? []).map(participant => participant.characterId !== 'shiroko'
            ? participant
            : { ...participant, actions: participant.actions.filter(candidate => candidate.actionId !== handActionId) }),
        },
      };
    });

    expect(() => service.commitEncounterRound({
      runId: started.runId,
      requestId: 'disabled-hand-action',
      expectedCommitVersion: entered.commitVersion,
      draft: draftToken(entered.activeEncounter),
    })).toThrow(/invalid Hand Action/);
    expect(service.getSnapshot()).toEqual(before);
    expect(service.getSnapshot()?.commitVersion).toBe(0);
    expect(service.getSnapshot()?.activeEncounter?.round).toBe(1);
  });

  test('charges Swap as free and PlayerCommand once through the same Commit pipeline', () => {
    const service = new MapRunService(resolverOf(OVERRIDE_COMMIT_MAP), resolveTestVariant);
    const started = service.start(OVERRIDE_COMMIT_MAP_ID, COMMIT_PARTY);
    const atEncounter = service.move(started.runId, 'b');
    const shirokoHand = atEncounter.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    if (!shirokoHand || shirokoHand.actionIds.length < 2) throw new Error('Shiroko Hand lacks a Swap candidate');
    const swapActionId = shirokoHand.actionIds[1];
    const swapped = service.swapPreparedAction(started.runId, 'shiroko', swapActionId, draftToken(atEncounter.activeEncounter));
    const firstActionId = service.previewActions(started.runId)?.preparedActions[0]?.preparedActionId;
    if (!firstActionId) throw new Error('Swap did not produce a Prepared Action');
    const first = service.commitEncounterRound({
      runId: started.runId,
      requestId: 'swap-round-1',
      expectedCommitVersion: swapped.commitVersion,
      draft: draftToken(swapped.activeEncounter),
    });
    expect(first.playerCost).toBe(OVERRIDE_COMMIT_MAP.initialPlayerCost);
    expect(first.activeEncounter?.lastCommit?.settlements[0]).toMatchObject({
      characterId: 'shiroko', actionId: firstActionId, overrideKind: 'swap', playerCostSpent: 0,
    });

    const secondEncounter = first.activeEncounter;
    const secondHand = secondEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    if (!secondEncounter || !secondHand) throw new Error('Second-round Hand is missing');
    const participant = OVERRIDE_COMMIT_MAP.nodes.find(node => node.id === 'b')?.encounter?.participants
      ?.find(row => row.characterId === 'shiroko');
    const handOutActionId = participant?.actions.find(candidate => !secondHand.actionIds.includes(candidate.actionId))?.actionId;
    if (!handOutActionId) throw new Error('No Hand-out PlayerCommand candidate was drawn');
    const commanded = service.issuePlayerCommand(
      started.runId,
      'shiroko',
      handOutActionId,
      draftToken(secondEncounter),
    );
    const secondCommand = {
      runId: started.runId,
      requestId: 'command-round-2',
      expectedCommitVersion: commanded.commitVersion,
      draft: draftToken(commanded.activeEncounter),
    };
    const second = service.commitEncounterRound(secondCommand);
    expect(second.playerCost).toBe(OVERRIDE_COMMIT_MAP.initialPlayerCost - 1);
    expect(second.commitVersion).toBe(2);
    expect(second.activeEncounter?.lastCommit?.settlements[0]).toMatchObject({
      characterId: 'shiroko', actionId: handOutActionId, overrideKind: 'playerCommand', playerCostSpent: 1,
    });
    const actionValue = (actionId: string) => {
      const effect = OVERRIDE_ACTIONS.find(action => action.id === actionId)?.effectProgram?.resolve?.[0];
      return effect?.op === 'resourceChange' ? effect.delta : 0;
    };
    expect(second.teamResources.find(balance => balance.resourceId === 'clues')?.value)
      .toBe(actionValue(firstActionId) + actionValue(handOutActionId));

    const checkpoint = JSON.parse(JSON.stringify(service.createSaveSnapshot())) as MapRunSaveSnapshot;
    const restored = new MapRunService(resolverOf(OVERRIDE_COMMIT_MAP), resolveTestVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    const beforeRetry = restored.getSnapshot();
    expect(restored.commitEncounterRound(secondCommand)).toEqual(beforeRetry);
    expect(restored.getSnapshot()?.teamResources).toEqual(second.teamResources);
    expect(restored.getSnapshot()?.activeEncounter?.randomState).toEqual(second.activeEncounter?.randomState);
  });

  test('keeps the natural Team budget payable, but allows a later Swap to make it unaffordable', () => {
    const service = new MapRunService(resolverOf(TEAM_RESERVATION_MAP), resolveTestVariant);
    const started = service.start(TEAM_RESERVATION_MAP_ID, COMMIT_PARTY);
    const atEncounter = service.move(started.runId, 'b');
    const before = service.getSnapshot();

    expect(atEncounter.activeEncounter?.hands).toEqual([
      { characterId: 'shiroko', actionIds: ['shiroko-spend-two'] },
      { characterId: 'serika', actionIds: ['serika-free', 'serika-spend-two'] },
    ]);
    expect(atEncounter.teamResources).toEqual([{ resourceId: 'supplies', value: 3 }]);
    expect(service.previewEncounterCommit(started.runId)).toMatchObject({ canCommit: true });
    expect(service.previewEncounterCommit(started.runId)).toEqual(service.previewEncounterCommit(started.runId));
    expect(service.getSnapshot()).toEqual(before);

    const checkpoint = JSON.parse(JSON.stringify(service.createSaveSnapshot())) as MapRunSaveSnapshot;
    const restored = new MapRunService(resolverOf(TEAM_RESERVATION_MAP), resolveTestVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()).toEqual(before);
    expect(restored.previewEncounterCommit(started.runId)).toMatchObject({ canCommit: true });

    const naturalCommit = service.commitEncounterRound({
      runId: started.runId,
      requestId: 'natural-team-reservation',
      expectedCommitVersion: atEncounter.commitVersion,
      draft: draftToken(atEncounter.activeEncounter),
    });
    expect(naturalCommit.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
    expect(naturalCommit.lastEncounterCommit?.settlements.map(row => row.actionId))
      .toEqual(['shiroko-spend-two', 'serika-free']);

    const swapService = new MapRunService(resolverOf(TEAM_RESERVATION_MAP), resolveTestVariant);
    const swapStart = swapService.start(TEAM_RESERVATION_MAP_ID, COMMIT_PARTY);
    const swapEncounter = swapService.move(swapStart.runId, 'b');
    const serikaHand = swapEncounter.activeEncounter?.hands.find(hand => hand.characterId === 'serika');
    if (!serikaHand) throw new Error('Serika Hand is missing');
    const swapped = swapService.swapPreparedAction(
      swapStart.runId,
      'serika',
      'serika-spend-two',
      draftToken(swapEncounter.activeEncounter),
    );
    expect(swapped.activeEncounter?.hands).toEqual(swapEncounter.activeEncounter?.hands);
    expect(swapped.activeEncounter?.randomState).toEqual(swapEncounter.activeEncounter?.randomState);
    expect(swapService.previewEncounterCommit(swapStart.runId)).toMatchObject({ canCommit: false });
    expect(swapService.getSnapshot()?.teamResources).toEqual([{ resourceId: 'supplies', value: 3 }]);
  });

  test('keeps a naturally payable round when a later PlayerCommand adds a Team cost conflict', () => {
    const service = new MapRunService(resolverOf(LATE_EFFECT_COMMIT_MAP), resolveTestVariant);
    const started = service.start(LATE_EFFECT_COMMIT_MAP_ID, COMMIT_PARTY);
    const atEncounter = service.move(started.runId, 'b');
    expect(atEncounter.activeEncounter?.hands).toEqual([
      { characterId: 'shiroko', actionIds: ['shiroko-spend'] },
      { characterId: 'serika', actionIds: [] },
    ]);
    expect(service.previewEncounterCommit(started.runId)).toMatchObject({ canCommit: true });
    const commanded = service.issuePlayerCommand(
      started.runId,
      'serika',
      'serika-refill',
      draftToken(atEncounter.activeEncounter),
    );
    const before = service.getSnapshot();
    const preview = service.previewEncounterCommit(started.runId);
    expect(preview).toMatchObject({ canCommit: false });
    expect(preview?.diagnostics[0]).toMatch(/cannot afford resource cost "supplies"/);
    expect(service.previewEncounterCommit(started.runId)).toEqual(preview);
    expect(service.getSnapshot()).toEqual(before);
    expect(() => service.commitEncounterRound({
      runId: started.runId,
      requestId: 'underfunded-round',
      expectedCommitVersion: commanded.commitVersion,
      draft: draftToken(commanded.activeEncounter),
    })).toThrow(preview?.diagnostics[0]);
    expect(service.getSnapshot()).toEqual(before);
    expect(service.getSnapshot()?.commitVersion).toBe(0);
    expect(service.getSnapshot()?.activeEncounter?.round).toBe(1);
    expect(service.getSnapshot()?.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
  });

  test('commits an automatically selected party target and rejects unsafe effects without writing state', () => {
    const targetService = new MapRunService(resolverOf(TARGET_COMMIT_MAP), resolveTestVariant);
    const targetStart = targetService.start(TARGET_COMMIT_MAP_ID, COMMIT_PARTY);
    const targetRun = targetService.move(targetStart.runId, 'b');
    expect(targetService.previewActions(targetStart.runId)?.preparedActions[1]).toMatchObject({
      targetCharacterId: 'shiroko',
      targetSelectionRequired: false,
    });
    const targetCommitPreview = targetService.previewEncounterCommit(targetStart.runId);
    expect(targetCommitPreview).toMatchObject({ canCommit: true });
    const targetCommit = targetService.commitEncounterRound({
      runId: targetStart.runId,
      requestId: 'auto-target',
      expectedCommitVersion: targetRun.commitVersion,
      draft: draftToken(targetRun.activeEncounter),
    });
    expect(targetCommit.lastEncounterCommit?.settlements[1]).toMatchObject({
      actionId: 'aid',
      targetCharacterId: 'shiroko',
    });

    const overflowMap: TestMap = {
      ...TARGET_COMMIT_MAP,
      id: 'test:map:overflow-commit',
      initialTeamResources: [
        { resourceId: 'supplies', value: 2 },
        { resourceId: 'clues', value: Number.MAX_SAFE_INTEGER },
      ],
    };
    const overflowService = new MapRunService(resolverOf(overflowMap), resolveTestVariant);
    const overflowStart = overflowService.start(overflowMap.id, COMMIT_PARTY);
    const overflowRun = overflowService.move(overflowStart.runId, 'b');
    const targeted = overflowService.setPreparedTarget(
      overflowStart.runId,
      'serika',
      'shiroko',
      draftToken(overflowRun.activeEncounter),
    );
    const beforeOverflow = overflowService.getSnapshot();
    const overflowPreview = overflowService.previewEncounterCommit(overflowStart.runId);
    expect(overflowPreview).toMatchObject({ canCommit: false });
    expect(() => overflowService.commitEncounterRound({
      runId: overflowStart.runId,
      requestId: 'overflow-round',
      expectedCommitVersion: targeted.commitVersion,
      draft: draftToken(targeted.activeEncounter),
    })).toThrow(overflowPreview?.diagnostics[0]);
    expect(overflowService.getSnapshot()).toEqual(beforeOverflow);

    const underflowMap: TestMap = {
      ...TARGET_COMMIT_MAP,
      id: 'test:map:underflow-commit',
      actions: (TARGET_COMMIT_MAP.actions ?? []).map(action => action.id !== 'inspect'
        ? action
        : { ...action, effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'clues', delta: -1 }] } }),
    };
    const underflowService = new MapRunService(resolverOf(underflowMap), resolveTestVariant);
    const underflowStart = underflowService.start(underflowMap.id, COMMIT_PARTY);
    const underflowRun = underflowService.move(underflowStart.runId, 'b');
    const underflowTargeted = underflowService.setPreparedTarget(
      underflowStart.runId,
      'serika',
      'shiroko',
      draftToken(underflowRun.activeEncounter),
    );
    const beforeUnderflow = underflowService.getSnapshot();
    const underflowPreview = underflowService.previewEncounterCommit(underflowStart.runId);
    expect(underflowPreview).toMatchObject({ canCommit: false });
    expect(() => underflowService.commitEncounterRound({
      runId: underflowStart.runId,
      requestId: 'underflow-round',
      expectedCommitVersion: underflowTargeted.commitVersion,
      draft: draftToken(underflowTargeted.activeEncounter),
    })).toThrow(underflowPreview?.diagnostics[0]);
    expect(underflowService.getSnapshot()).toEqual(beforeUnderflow);
  });

  test('allows a full Wait round to commit with no resource changes', () => {
    const service = new MapRunService(resolverOf(ROUTE_MAP), resolveTestVariant);
    const started = service.start(MAP_ID, ADMITTED_PARTY);
    const atEncounter = service.move(started.runId, 'b');
    const committed = service.commitEncounterRound({
      runId: started.runId,
      requestId: 'wait-round',
      expectedCommitVersion: atEncounter.commitVersion,
      draft: draftToken(atEncounter.activeEncounter),
    });
    expect(committed.commitVersion).toBe(1);
    expect(committed.activeEncounter).toMatchObject({
      round: 2,
      lastCommit: {
        settlements: [{ characterId: 'shiroko', actionId: null, targetCharacterId: null, playerCostSpent: 0, resourceChanges: [] }],
      },
    });
    expect(committed.playerCost).toBe(ROUTE_MAP.initialPlayerCost);
  });

  test('freezes AG-1 party and Encounter Enemy agility inputs in fixed roster order', () => {
    const agMap: TestMap = {
      ...TARGET_COMMIT_MAP,
      id: 'test:map:agility-snapshot',
      executionContractId: 'AG-1',
      resumeVersion: 5,
      partyAgility: [{ characterId: 'serika', agility: 3 }],
      nodes: TARGET_COMMIT_MAP.nodes.map(node => node.id !== 'b' ? node : ({
        ...node,
        encounter: {
          ...node.encounter!,
          enemies: [
            { id: 'raider', initialHp: 8, maxHp: 10, agility: 5 },
            { id: 'drone', initialHp: 6, maxHp: 6 },
          ],
        },
      })),
    };
    const service = new MapRunService(resolverOf(agMap), resolveTestVariant);
    const started = service.start(agMap.id, COMMIT_PARTY);
    expect(started.partyAgility).toEqual([
      { characterId: 'shiroko', agility: 0 },
      { characterId: 'serika', agility: 3 },
    ]);
    const active = service.move(started.runId, 'b');
    expect(active.activeEncounter?.enemyAgility).toEqual([
      { enemyId: 'raider', agility: 5 },
      { enemyId: 'drone', agility: 0 },
    ]);

    const emptyEncounterMap: TestMap = {
      ...agMap,
      id: 'test:map:agility-empty-encounter',
      startNodeId: 'empty',
      nodes: [{ id: 'empty', title: 'Empty', encounter: { title: 'Empty', completion: { kind: 'manual', label: 'Finish' } } }],
      edges: [],
    };
    const emptyEncounter = new MapRunService(resolverOf(emptyEncounterMap), resolveTestVariant)
      .start(emptyEncounterMap.id, COMMIT_PARTY);
    expect(emptyEncounter.activeEncounter?.enemyAgility).toEqual([]);

    const legacy = new MapRunService(resolverOf(TARGET_COMMIT_MAP), resolveTestVariant)
      .start(TARGET_COMMIT_MAP.id, COMMIT_PARTY);
    expect(Object.prototype.hasOwnProperty.call(legacy, 'partyAgility')).toBe(false);
  });

  test('restores AG-1 agility snapshots only when identities, order, and author values match', () => {
    const agMap: TestMap = {
      ...TARGET_COMMIT_MAP,
      id: 'test:map:agility-restore',
      executionContractId: 'AG-1',
      resumeVersion: 5,
      partyAgility: [{ characterId: 'serika', agility: 3 }],
      nodes: TARGET_COMMIT_MAP.nodes.map(node => node.id !== 'b' ? node : ({
        ...node,
        encounter: {
          ...node.encounter!,
          enemies: [
            { id: 'raider', initialHp: 8, maxHp: 10, agility: 5 },
            { id: 'drone', initialHp: 6, maxHp: 6 },
          ],
        },
      })),
    };
    const source = new MapRunService(resolverOf(agMap), resolveTestVariant);
    const started = source.start(agMap.id, COMMIT_PARTY);
    source.move(started.runId, 'b');
    const saved = source.createSaveSnapshot();
    expect(saved?.run.activeEncounter?.enemyAgility).toEqual([
      { enemyId: 'raider', agility: 5 },
      { enemyId: 'drone', agility: 0 },
    ]);
    if (!saved) throw new Error('AG-1 MapRun checkpoint is missing');
    const checkpoint = JSON.parse(JSON.stringify(saved)) as MapRunSaveSnapshot;

    const restore = (runPatch: Record<string, unknown>, map = agMap) => {
      const owner = new MapRunService(resolverOf(map), resolveTestVariant);
      const result = owner.restoreSaveSnapshot({ ...checkpoint, run: { ...checkpoint.run, ...runPatch } });
      return { owner, result };
    };
    expect(restore({}).result).toMatchObject({ status: 'restored', runId: started.runId });
    const invalidRuns: Record<string, unknown>[] = [
      { partyAgility: [{ characterId: 'serika', agility: 3 }] },
      { partyAgility: [
        { characterId: 'shiroko', agility: 0 },
        { characterId: 'shiroko', agility: 3 },
      ] },
      { partyAgility: [
        { characterId: 'unknown', agility: 0 },
        { characterId: 'serika', agility: 3 },
      ] },
      { partyAgility: [
        { characterId: 'serika', agility: 3 },
        { characterId: 'shiroko', agility: 0 },
      ] },
      { partyAgility: [
        { characterId: 'shiroko', agility: 0, extra: true },
        { characterId: 'serika', agility: 3 },
      ] },
      { partyAgility: [
        { characterId: 'shiroko', agility: 0 },
        { characterId: 'serika', agility: -1 },
      ] },
      { activeEncounter: { ...checkpoint.run.activeEncounter, enemyAgility: [
        { enemyId: 'drone', agility: 0 },
        { enemyId: 'raider', agility: 5 },
      ] } },
      { activeEncounter: { ...checkpoint.run.activeEncounter, enemyAgility: [
        { enemyId: 'raider', agility: 5 },
        { enemyId: 'unknown', agility: 0 },
      ] } },
      { activeEncounter: (() => {
        const encounter = { ...checkpoint.run.activeEncounter! } as Record<string, unknown>;
        delete encounter.enemyAgility;
        return encounter;
      })() },
      { activeEncounter: { ...checkpoint.run.activeEncounter, enemyAgility: [
        { enemyId: 'raider', agility: 5 },
        { enemyId: 'raider', agility: 5 },
      ] } },
      { activeEncounter: { ...checkpoint.run.activeEncounter, enemyAgility: [
        { enemyId: 'raider', agility: 5, extra: true },
        { enemyId: 'drone', agility: 0 },
      ] } },
      { activeEncounter: { ...checkpoint.run.activeEncounter, enemyAgility: [
        { enemyId: 'raider', agility: 1.5 },
        { enemyId: 'drone', agility: 0 },
      ] } },
      { activeEncounter: { ...checkpoint.run.activeEncounter, enemyAgility: [
        { enemyId: 'raider', agility: Number.MAX_SAFE_INTEGER + 1 },
        { enemyId: 'drone', agility: 0 },
      ] } },
    ];
    for (const patch of invalidRuns) {
      const rejected = restore(patch);
      expect(rejected.result).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
      expect(rejected.owner.getSnapshot()).toBeNull();
    }
    const accessorRow = { characterId: 'serika' } as Record<string, unknown>;
    Object.defineProperty(accessorRow, 'agility', {
      enumerable: true,
      get: () => { throw new Error('Save accessors must not execute'); },
    });
    const accessorResult = restore({ partyAgility: [
      { characterId: 'shiroko', agility: 0 }, accessorRow,
    ] });
    expect(accessorResult.result).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(accessorResult.owner.getSnapshot()).toBeNull();

    const symbolRow = { characterId: 'serika', agility: 3 };
    Object.defineProperty(symbolRow, Symbol('extra'), { value: true });
    expect(restore({ partyAgility: [
      { characterId: 'shiroko', agility: 0 }, symbolRow,
    ] }).result).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const changedMap: TestMap = { ...agMap, partyAgility: [{ characterId: 'serika', agility: 4 }] };
    expect(restore({}, changedMap).result).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    const changedEnemyMap: TestMap = {
      ...agMap,
      nodes: agMap.nodes.map(node => node.id !== 'b' ? node : ({
        ...node,
        encounter: {
          ...node.encounter!,
          enemies: [
            { id: 'raider', initialHp: 8, maxHp: 10, agility: 6 },
            { id: 'drone', initialHp: 6, maxHp: 6 },
          ],
        },
      })),
    };
    expect(restore({}, changedEnemyMap).result).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    const wrongVersion: TestMap = { ...agMap, resumeVersion: agMap.resumeVersion + 1 };
    const wrongVersionOwner = new MapRunService(resolverOf(wrongVersion), resolveTestVariant);
    expect(wrongVersionOwner.restoreSaveSnapshot(checkpoint))
      .toMatchObject({ status: 'rejected', reason: 'content-version-mismatch' });

    const legacy = new MapRunService(resolverOf(TARGET_COMMIT_MAP), resolveTestVariant);
    const legacyStart = legacy.start(TARGET_COMMIT_MAP.id, COMMIT_PARTY);
    const legacyRun = legacy.move(legacyStart.runId, 'b');
    const legacySaved = legacy.createSaveSnapshot();
    if (!legacySaved) throw new Error('E1 checkpoint is missing');
    const injectedLegacy = new MapRunService(resolverOf(TARGET_COMMIT_MAP), resolveTestVariant);
    expect(injectedLegacy.restoreSaveSnapshot({ ...legacySaved, run: {
      ...legacySaved.run,
      partyAgility: COMMIT_PARTY.map(member => ({ characterId: member.characterId, agility: 0 })),
    } })).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(new MapRunService(resolverOf(TARGET_COMMIT_MAP), resolveTestVariant).restoreSaveSnapshot({
      ...legacySaved,
      run: {
        ...legacySaved.run,
        activeEncounter: { ...legacyRun.activeEncounter!, enemyAgility: [] },
      },
    })).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(legacyRun.partyAgility).toBeUndefined();
  });
});
