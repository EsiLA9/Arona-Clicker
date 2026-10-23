// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import {
  gameplayBMapDatapack,
  gameplayBForkedRouteDefinition,
  gameplayBScostTrainingDefinition,
} from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { mapLocationObjectKey } from '../../src/ui/cards/card-host';
import { GAMEPLAY_B_REVIVE_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-revive-example';
import { GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-status-expiry-reward-example';
import { Resource } from '../../src/arona-clicker/types/ids';
import type { GameplayMapActionDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { UIController } from '../../src/ui/controller/controller';
import { createUIContext } from '../../src/ui/runtime/context';
import { renderMapWorkspace } from '../../src/ui/components/map/map-workspace';
import { mapCardEffectModifierPreviewLabel } from '../../src/ui/flow/map-flow-model';
import { mapObjectKey } from '../../src/ui/workspace/map-relation-presentation';
import {
  createWorkspaceNavigation,
  resolveCurrentWorkspaceRoute,
  workspaceRouteKey,
} from '../../src/ui/workspace/workspace-router';

describe('Gameplay B Map Workspace', () => {
  let game: ReturnType<typeof createAppRuntime> | undefined;
  let controller: UIController | undefined;

  function mapFixture(datapack: Datapack = gameplayBMapDatapack) {
    const entry = datapack.spots
      .flatMap(spot => spot.functionalities ?? [])
      .find(functionality => functionality.kind === 'mapEntry');
    if (!entry?.mapId) throw new Error('The Gameplay B sample Spot is missing its Map Entry reference.');
    const map = datapack.maps?.find(candidate => candidate.id === entry.mapId);
    if (!map) throw new Error('The Gameplay B sample Map Entry does not resolve to a declared Map.');
    return map;
  }

  function autonomousBattleDatapack(): Datapack {
    return {
      ...gameplayBMapDatapack,
      spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot,
        functionalities: (spot.functionalities ?? []).map(functionality => functionality.kind === 'mapEntry'
          ? { ...functionality, mapId: 'gameplay-b:map:autonomous-target-battle' }
          : functionality),
      })),
    };
  }

  function reviveExampleDatapack(): Datapack {
    return {
      ...gameplayBMapDatapack,
      spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot,
        functionalities: (spot.functionalities ?? []).map(functionality => functionality.kind === 'mapEntry'
          ? { ...functionality, mapId: GAMEPLAY_B_REVIVE_EXAMPLE_MAP_ID }
          : functionality),
      })),
    };
  }

  function statusExpiryRewardDatapack(): Datapack {
    return {
      ...gameplayBMapDatapack,
      spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot,
        functionalities: (spot.functionalities ?? []).map(functionality => functionality.kind === 'mapEntry'
          ? { ...functionality, mapId: GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID }
          : functionality),
      })),
    };
  }

  function actionWorkspaceDatapack(waitForSerika = false, initialPlayerCost?: number): typeof gameplayBMapDatapack {
    const source = mapFixture();
    const actions = (source.actions ?? []).map(action => ({
      id: action.id,
      name: action.name,
      ...(action.description === undefined ? {} : { description: action.description }),
      eligibleCharacterIds: action.eligibleCharacterIds,
      target: { kind: 'partyCharacter' as const },
    }));
    actions.push({
      id: 'workspace-command-candidate',
      name: '玩家指令候选',
      description: '用于验证手牌外指令。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' as const },
    });
    const actionCandidates = actions.map(action => ({ actionId: action.id, tendencyWeight: 1 }));
    const extendedMap: GameplayMapDef = {
      ...source,
      resumeVersion: source.resumeVersion + 1,
      ...(initialPlayerCost === undefined ? {} : { initialPlayerCost }),
      actions,
      nodes: source.nodes.map(node => node.encounter ? {
        ...node,
        encounter: {
          ...node.encounter,
          participants: (node.encounter.participants ?? []).map(participant => ({
            ...participant,
            actions: waitForSerika && participant.characterId === 'serika' ? [] : actionCandidates,
          })),
        },
      } : node),
    };
    return {
      ...gameplayBMapDatapack,
      maps: gameplayBMapDatapack.maps?.map(map => map.id === source.id ? extendedMap : map),
    };
  }

  function battleWorkspaceDatapack(options: { readonly partyHp?: number; readonly enemyDamage?: number; readonly emptyParty?: boolean; readonly playerCost?: number; readonly executionContractId?: 'E1-COMPAT-1' | 'AG-1'; readonly partyActionAdditionalTarget?: 'partyCharacter' | 'enemy'; readonly abilityAdditionalTarget?: 'partyCharacter' | 'enemy' } = {}): Datapack {
    const source = mapFixture();
    const encounterNode = source.nodes.find(node => node.encounter);
    if (!encounterNode?.encounter) throw new Error('Sample Map has no Encounter Node');
    const { completion: _completion, ...battleEncounter } = encounterNode.encounter;
    void _completion;
    const characterActions: GameplayMapActionDef[] = [
      {
      id: 'workspace-battle-hit',
      name: '攻击 Enemy',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      ...(options.partyActionAdditionalTarget === undefined ? {} : { additionalTarget: options.partyActionAdditionalTarget }),
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
      },
      {
        id: 'workspace-battle-hit-2',
        name: '攻击 Enemy 2',
        eligibleCharacterIds: ['shiroko', 'serika'],
        target: { kind: 'enemy' },
      ...(options.partyActionAdditionalTarget === undefined ? {} : { additionalTarget: options.partyActionAdditionalTarget }),
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
      },
      {
        id: 'workspace-battle-hit-3',
        name: '攻击 Enemy 3',
        eligibleCharacterIds: ['shiroko', 'serika'],
        target: { kind: 'enemy' },
      ...(options.partyActionAdditionalTarget === undefined ? {} : { additionalTarget: options.partyActionAdditionalTarget }),
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
      },
    ];
    const playerCommand: GameplayMapActionDef = {
      id: 'workspace-battle-command',
      name: '手牌外指令',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      ...(options.partyActionAdditionalTarget === undefined ? {} : { additionalTarget: options.partyActionAdditionalTarget }),
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
    };
    const ability: GameplayMapActionDef = {
      id: 'workspace-battle-ability',
      name: '地图 Ability',
      eligibleCharacterIds: [],
      target: { kind: 'enemy' },
      ...(options.abilityAdditionalTarget === undefined ? {} : { additionalTarget: options.abilityAdditionalTarget }),
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
    };
    const itemAction: GameplayMapActionDef = {
      id: 'workspace-battle-item-action',
      name: '急救道具',
      eligibleCharacterIds: [],
      target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] },
    };
    const enemyAction: GameplayMapActionDef = {
      id: 'workspace-enemy-hit',
      name: '敌方攻击',
      eligibleCharacterIds: [],
      target: { kind: 'partyCharacter' },
      tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: options.enemyDamage ?? 1 }] },
    };
    const items = [{
      id: 'gameplay-b:item:workspace-kit',
      name: '地图急救包',
      description: '为当前战斗目标恢复 HP。',
      maxStack: 3,
      rarity: 'common' as const,
      type: 'consumable' as const,
      useCondition: {
        type: 'AND' as const,
        conditions: [{ target: 'resource' as const, key: Resource.Credit, comparator: '>=' as const, value: 10 }],
      },
    }];
    const map: GameplayMapDef = {
      ...source,
      resumeVersion: source.resumeVersion + 4,
      ...(options.executionContractId === undefined ? {} : { executionContractId: options.executionContractId }),
      initialPlayerCost: options.playerCost ?? 3,
      initialPartyHp: source.initialPartyHp.map(member => ({
        ...member,
        initialHp: options.partyHp ?? member.initialHp,
      })),
      actions: [...characterActions, playerCommand, ability, itemAction, enemyAction],
      nodes: source.nodes.map(node => node.id !== encounterNode.id ? node : ({
        ...node,
        encounter: {
          ...battleEncounter,
          enemies: [
            { id: 'wolf', initialHp: 20, maxHp: 24,
              actions: [{ actionId: enemyAction.id, tendencyWeight: 1 }] },
            { id: 'wolf-2', initialHp: 20, maxHp: 24,
              actions: [{ actionId: enemyAction.id, tendencyWeight: 1 }] },
          ],
          abilityActionIds: [ability.id],
          itemActions: [{ itemId: items[0]!.id, actionId: itemAction.id }],
          participants: (options.emptyParty ? [] : ['shiroko', 'serika']).map(characterId => ({
            characterId,
            actions: [...characterActions, playerCommand].map(action => ({ actionId: action.id, tendencyWeight: 1 })),
          })),
        },
      })),
    };
    return {
      ...gameplayBMapDatapack,
      maps: gameplayBMapDatapack.maps?.map(candidate => candidate.id === source.id ? map : candidate),
      items,
    };
  }

  function statusBattleWorkspaceDatapack(consumeBurn = false, cleanseHarmful = false): Datapack {
    const datapack = battleWorkspaceDatapack();
    const source = mapFixture(datapack);
    const statusMap: GameplayMapDef = {
      ...source,
      resumeVersion: source.resumeVersion + (cleanseHarmful ? 2 : 1),
      ...(consumeBurn || cleanseHarmful ? { executionContractId: 'AG-1' as const } : {}),
      statuses: [
        { id: 'burn', name: '灼烧', kind: 'burn', hpPerStack: 1, maxStacks: 3,
          ...(cleanseHarmful ? { category: 'harmful' as const } : {}) },
        { id: 'regen', name: '再生', kind: 'regen', hpPerStack: 1, maxStacks: 3,
          ...(cleanseHarmful ? { category: 'beneficial' as const } : {}) },
      ],
      actions: (source.actions ?? []).map(action => {
        if (action.id === 'workspace-enemy-hit') return {
          ...action,
          effectProgram: { resolve: [
            ...(action.effectProgram?.resolve ?? []),
            { op: 'statusApply' as const, target: 'primary' as const, statusId: 'regen', stacks: 1, durationRounds: 2 },
          ] },
        };
        if (action.target.kind === 'enemy' && action.eligibleCharacterIds.length > 0) return {
          ...action,
          effectProgram: { resolve: [
            ...(action.effectProgram?.resolve ?? []),
            { op: 'statusApply' as const, target: 'primary' as const, statusId: 'burn', stacks: 1, durationRounds: 2 },
            ...(consumeBurn ? [{ op: 'statusConsume' as const, target: 'primary' as const, statusId: 'burn', stacks: 1 }] : []),
            ...(cleanseHarmful ? [{ op: 'statusRemoveCategory' as const, target: 'primary' as const, category: 'harmful' as const }] : []),
          ] },
        };
        return action;
      }),
    };
    return { ...datapack, maps: datapack.maps?.map(candidate => candidate.id === source.id ? statusMap : candidate) };
  }

  function acquireMapParty(map: ReturnType<typeof mapFixture>): void {
    if (!game) throw new Error('Game runtime has not been initialized');
    for (const characterId of map.partyCharacterIds) {
      const variant = game.rosterSystem.getAllVariants()
        .filter(candidate => candidate.proto === characterId)
        .sort((left, right) => left.id.localeCompare(right.id))[0];
      if (!variant) throw new Error(`No registered Variant for Map party Character "${characterId}"`);
      if (!game.state.roster?.[variant.id]) game.mutations.acquireCharacter(variant.id, 'story');
    }
  }

  function cardWorkspaceDatapack(): typeof gameplayBMapDatapack {
    const source = mapFixture();
    const map: GameplayMapDef = { ...source, resumeVersion: source.resumeVersion + 10,
      initialActorResources: source.partyCharacterIds.map(characterId => ({ characterId, resourceId: 'sCost', value: 5 })),
      actions: [
        ...['plan-a', 'plan-b'].map(id => ({ id, name: `筹划 ${id}`, eligibleCharacterIds: ['shiroko'],
          target: { kind: 'card' as const, side: 'ally' as const }, effectProgram: { prepare: [{ op: 'discountSCost' as const, amount: 1 }] } })),
        ...['shot-a', 'shot-b', 'shot-c', 'shot-d'].map(id => ({ id, name: `射击 ${id}`, eligibleCharacterIds: ['serika'],
          target: { kind: 'enemy' as const }, costs: [{ scope: 'actor' as const, resourceId: 'sCost', amount: 2 }], effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 1 }] } })),
      ],
      nodes: source.nodes.map(node => !node.encounter ? node : { ...node, encounter: {
        title: '卡牌作用演练', enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
        participants: [{ characterId: 'shiroko', actions: ['plan-a', 'plan-b'].map(actionId => ({ actionId, tendencyWeight: 1 })) },
          { characterId: 'serika', actions: ['shot-a', 'shot-b', 'shot-c', 'shot-d'].map(actionId => ({ actionId, tendencyWeight: 1 })) }],
      } }),
    };
    return { ...gameplayBMapDatapack, maps: gameplayBMapDatapack.maps!.map(row => row.id === source.id ? map : row) };
  }

  function cardModifierWorkspaceDatapack(options: {
    readonly sourceAgility?: number;
    readonly targetAgility?: number;
    readonly targetPartyAgility?: number;
    readonly reverseParty?: boolean;
    readonly thirdOwner?: boolean;
    readonly targetCount?: number;
    readonly sourceCount?: number;
  } = {}): typeof gameplayBMapDatapack {
    const source = mapFixture();
    const targetRows = Array.from({ length: options.targetCount ?? 1 }, (_, index) => ({
      id: `modifier-target-${index}`, owner: 'serika',
    }));
    if (options.thirdOwner) targetRows.push({ id: 'modifier-target-third', owner: 'hoshino' });
    const sourceIds = Array.from({ length: options.sourceCount ?? 1 }, (_, index) => `modifier-source-${index}`);
    const actions: GameplayMapActionDef[] = [
      ...sourceIds.map(id => ({ id, name: `修正 ${id}`, eligibleCharacterIds: ['shiroko'],
        agility: { base: options.sourceAgility ?? 8, max: 10 }, target: { kind: 'card' as const, side: 'ally' as const },
        effectProgram: { resolve: [{ op: 'cardEffectModifier' as const, path: 'resolve[0].amount' as const,
          operation: 'add' as const, delta: 2 }] } })),
      ...targetRows.map(({ id, owner }) => ({ id, name: `攻击 ${id}`, eligibleCharacterIds: [owner],
        agility: { base: options.targetAgility ?? 8, max: 10 }, target: { kind: 'enemy' as const },
        effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 3 }] } })),
    ];
    const partyCharacterIds = options.thirdOwner ? ['shiroko', 'serika', 'hoshino']
      : options.reverseParty ? ['serika', 'shiroko'] : ['shiroko', 'serika'];
    const map: GameplayMapDef = { ...source, resumeVersion: source.resumeVersion + 30, executionContractId: 'AG-1',
      partyCharacterIds, partyAgility: options.targetPartyAgility ? [{ characterId: 'serika', agility: options.targetPartyAgility }] : [],
      initialPartyHp: options.thirdOwner
        ? [...source.initialPartyHp, { characterId: 'hoshino', initialHp: 10, maxHp: 10 }]
        : options.reverseParty ? [...source.initialPartyHp].reverse() : source.initialPartyHp,
      actions, nodes: source.nodes.map(node => !node.encounter ? node : { ...node, encounter: {
        title: 'CardRef 修正演练', enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
        participants: [
          { characterId: 'shiroko', actions: sourceIds.map(actionId => ({ actionId, tendencyWeight: 1 })) },
          { characterId: 'serika', actions: targetRows.filter(row => row.owner === 'serika').map(row => ({ actionId: row.id, tendencyWeight: 1 })) },
          ...(options.thirdOwner ? [{ characterId: 'hoshino', actions: targetRows.filter(row => row.owner === 'hoshino')
            .map(row => ({ actionId: row.id, tendencyWeight: 1 })) }] : []),
        ],
      } }) };
    return { ...gameplayBMapDatapack, maps: gameplayBMapDatapack.maps?.map(row => row.id === source.id ? map : row) };
  }

  function activeWorkspaceView(runId: string) {
    const view = game!.mapRun.getWorkspaceView(runId);
    if (!view || view.kind !== 'active') throw new Error(`MapRun "${runId}" has no active Workspace view`);
    return view;
  }

  function expectSharedMapTopbar(scope: ParentNode): void {
    for (const panel of ['left', 'right']) {
      expect(scope.querySelector(`[data-theme-host-id="${panel}Panel.tabs"]`)).not.toBeNull();
    }
  }

  function mount(datapack: Datapack = gameplayBMapDatapack): { root: HTMLElement; mapId: string } {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, datapack], { enterDefaultInit: true });
    acquireMapParty(mapFixture(datapack));
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    return { root, mapId: mapFixture(datapack).id };
  }

  function commitFlowLocation(root: HTMLElement, nodeId: string): void {
    const card = root.querySelector<HTMLElement>(`[data-map-location-node-id="${nodeId}"]`);
    const submit = root.querySelector<HTMLButtonElement>('[data-map-location-submit]');
    if (!card || !submit) throw new Error(`Map Workspace did not render location ${nodeId}`);
    card.click();
    if (submit.disabled) throw new Error(`Map Workspace did not allow location ${nodeId}`);
    submit.click();
  }

  function forkedLocationDatapack(): Datapack {
    return {
      ...gameplayBMapDatapack,
      spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot,
        functionalities: spot.functionalities?.map(functionality => functionality.kind === 'mapEntry'
          && functionality.id === 'field-investigation-map'
          ? { ...functionality, mapId: gameplayBForkedRouteDefinition.id }
          : functionality),
      })),
    };
  }

  function locationConditionDatapack(requiredAmount = 100): Datapack {
    const source = mapFixture();
    const firstEdge = source.edges.find(edge => edge.fromNodeId === source.startNodeId);
    if (!firstEdge) throw new Error('The sample Map has no outgoing start Edge.');
    const map: GameplayMapDef = {
      ...source,
      id: 'gameplay-b:map:locked-location-test',
      resumeVersion: source.resumeVersion + 100,
      edges: source.edges.map(edge => edge === firstEdge ? {
        ...edge,
        condition: { kind: 'teamResourceAtLeast', resourceId: 'supplies', amount: requiredAmount },
      } : edge),
    };
    return {
      ...gameplayBMapDatapack,
      maps: [...(gameplayBMapDatapack.maps ?? []).filter(candidate => candidate.id !== map.id), map],
      spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot,
        functionalities: spot.functionalities?.map(functionality => functionality.kind === 'mapEntry'
          && functionality.id === 'field-investigation-map'
          ? { ...functionality, mapId: map.id }
          : functionality),
      })),
    };
  }

  function enterEncounter(root: HTMLElement, map: ReturnType<typeof mapFixture>): string {
    if (!controller) throw new Error('UI controller has not been initialized');
    const started = controller.commands.startMap(map.id);
    controller.enterWorkspaceRoute({ kind: 'map', runId: started.runId });
    controller.render();
    const encounterNode = map.nodes.find(node => node.encounter);
    if (!encounterNode) throw new Error('Sample Map has no Encounter Node');
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === map.startNodeId && edge.toNodeId === encounterNode.id);
    if (!encounterEdge) throw new Error('Sample Map has no route into its Encounter');
    commitFlowLocation(root, encounterNode.id);
    return started.runId;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    controller?.destroy();
    controller = undefined;
    if (game?.running) game.stop();
    game?.dispose();
    game = undefined;
    localStorage.clear();
    document.body.innerHTML = '';
  });

  test('hovering the hero progress badge opens the current Encounter end-condition Tooltip', () => {
    vi.useFakeTimers();
    try {
      const { root } = mount();
      const map = mapFixture();
      const runId = enterEncounter(root, map);
      const anchor = root.querySelector<HTMLElement>('.map-workspace__hero-progress');

      expect(anchor).not.toBeNull();
      expect(anchor?.classList.contains('hover-wrap')).toBe(true);
      expect(anchor?.dataset.tooltip).toBe(`map-scene-end:${runId}`);
      expect(anchor?.dataset.mapRegionKey).toContain(`hero-progress:${activeWorkspaceView(runId).run.currentNodeId}:`);

      controller!.popovers.bind();
      anchor!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 400, clientY: 180 }));
      vi.advanceTimersByTime(80);

      const tooltip = document.querySelector<HTMLElement>('#floating-tooltip');
      expect(tooltip?.classList.contains('is-open')).toBe(true);
      expect(tooltip?.textContent).toContain('场景结束条件');
      expect(tooltip?.textContent).toContain('现场调查');
      expect(tooltip?.textContent).toContain('完成调查');
    } finally {
      vi.useRealTimers();
    }
  });

  test('shows AG-1 Preview and recent Commit rows in the Owner execution sequence order', () => {
    const datapack = battleWorkspaceDatapack({ executionContractId: 'AG-1' });
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    let preview = activeWorkspaceView(runId).actionPreview!;
    for (const row of preview.preparedActions) {
      if (!row.targetSelectionRequired) continue;
      const targetEnemyId = row.legalTargetEnemyIds[0];
      if (!targetEnemyId) throw new Error(`No legal target was projected for ${row.characterId}`);
      root.querySelector<HTMLButtonElement>(
        `[data-map-target-enemy][data-character-id="${row.characterId}"][data-target-enemy-id="${targetEnemyId}"]`,
      )!.click();
    }
    preview = activeWorkspaceView(runId).actionPreview!;
    const sequence = preview.commitPreview.executionSequence;
    expect(preview.commitPreview.executionContractId).toBe('AG-1');
    expect(sequence?.length).toBeGreaterThan(0);
    const previewSummary = root.querySelector<HTMLElement>('.map-workspace__execution-sequence');
    expect(previewSummary?.getAttribute('aria-label')).toBe('AG-1 执行顺序预览');
    const previewText = previewSummary?.textContent ?? '';
    expect(previewText).toContain('执行 1：');
    for (const row of sequence ?? []) {
      expect(previewText).toContain(row.actionName);
      expect(previewText).toContain(row.skipReason ? '跳过' : row.resourceChanges.length + row.hpChanges.length > 0
        ? row.hpChanges.length > 0 ? 'HP' : 'PlayerCost'
        : '没有 HP 或资源变化');
    }
    const previewActionPositions = (sequence ?? []).map(row => previewText.indexOf(row.actionName));
    expect(previewActionPositions).toEqual([...previewActionPositions].sort((a, b) => a - b));

    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    const receipt = activeWorkspaceView(runId).actionPreview?.recentCommit;
    expect(receipt?.executionContractId).toBe('AG-1');
    expect(receipt?.executionSequence?.map(row => row.executionIndex)).toEqual(sequence?.map(row => row.executionIndex));
    const feedEntry = root.querySelector<HTMLElement>('[data-map-recent-commit]');
    const feedText = feedEntry?.textContent ?? '';
    expect(feedText).toContain('执行 1：');
    const feedPositions = (receipt?.executionSequence ?? []).map(row => feedText.indexOf(`执行 ${row.executionIndex + 1}：`));
    expect(feedPositions.every(position => position >= 0)).toBe(true);
    expect(feedPositions).toEqual([...feedPositions].sort((a, b) => a - b));
  });

  test('shows active Status values from the ReadModel and keeps keyed rows through round-end updates', () => {
    const datapack = statusBattleWorkspaceDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    const workspace = root.querySelector('[data-map-workspace-region]');
    const frame = root.querySelector('[data-workspace-frame="map"]');
    const partyScroll = root.querySelector('[data-map-region-key="party-scroll"]');
    const contextScroll = root.querySelector('[data-map-region-key="context-scroll"]');
    const partyMember = root.querySelector('[data-map-region-key="party-member:shiroko"]');
    const enemyUnit = root.querySelector('[data-map-enemy-hp="wolf"]');
    partyScroll!.scrollTop = 21;
    contextScroll!.scrollTop = 34;

    const commit = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
    commit.focus();
    commit.click();

    const committedView = activeWorkspaceView(runId);
    const enemyBurn = committedView.currentEncounter!.enemies.find(enemy => enemy.enemyId === 'wolf')!.statuses!
      .find(status => status.statusId === 'burn')!;
    const partyRegen = committedView.currentEncounter!.partyHp.find(member => member.characterId === 'shiroko')!.statuses!
      .find(status => status.statusId === 'regen')!;
    expect(enemyBurn).toMatchObject({ name: '灼烧', stacks: 1, remainingRounds: 2 });
    expect(partyRegen).toMatchObject({ name: '再生', stacks: 1, remainingRounds: 2 });

    const enemyStatusHost = root.querySelector<HTMLElement>('[data-map-region-key="unit-statuses:enemy:wolf"]')!;
    const partyStatusHost = root.querySelector<HTMLElement>('[data-map-region-key="unit-statuses:partyCharacter:shiroko"]')!;
    const enemyStatusRow = [...enemyStatusHost.querySelectorAll<HTMLElement>('[data-map-region-key^="status:"]')]
      .find(row => row.dataset.mapRegionKey === `status:${enemyBurn.key}`)!;
    const partyStatusRow = [...partyStatusHost.querySelectorAll<HTMLElement>('[data-map-region-key^="status:"]')]
      .find(row => row.dataset.mapRegionKey === `status:${partyRegen.key}`)!;
    expect(enemyStatusRow.textContent).toBe('灼烧 · 1层 · 剩余2轮');
    expect(partyStatusRow.textContent).toBe('再生 · 1层 · 剩余2轮');
    expect(root.querySelector('[data-map-commit]')).toBe(commit);
    expect(document.activeElement).toBe(commit);

    commit.click();

    const nextView = activeWorkspaceView(runId);
    const nextEnemyBurn = nextView.currentEncounter!.enemies.find(enemy => enemy.enemyId === 'wolf')!.statuses!
      .find(status => status.key === enemyBurn.key)!;
    const nextPartyRegen = nextView.currentEncounter!.partyHp.find(member => member.characterId === 'shiroko')!.statuses!
      .find(status => status.key === partyRegen.key)!;
    expect(nextEnemyBurn.remainingRounds).toBe(1);
    expect(nextPartyRegen.remainingRounds).toBe(1);
    expect(enemyStatusRow.isConnected).toBe(true);
    expect(partyStatusRow.isConnected).toBe(true);
    expect(root.querySelector('[data-map-region-key="unit-statuses:enemy:wolf"]')).toBe(enemyStatusHost);
    expect(root.querySelector('[data-map-region-key="unit-statuses:partyCharacter:shiroko"]')).toBe(partyStatusHost);
    expect(enemyStatusRow.textContent).toBe(`${nextEnemyBurn.name} · ${nextEnemyBurn.stacks}层 · 剩余1轮`);
    expect(partyStatusRow.textContent).toBe(`${nextPartyRegen.name} · ${nextPartyRegen.stacks}层 · 剩余1轮`);
    expect(root.querySelector('[data-map-workspace-region]')).toBe(workspace);
    expect(root.querySelector('[data-workspace-frame="map"]')).toBe(frame);
    expect(root.querySelector('[data-map-region-key="party-scroll"]')).toBe(partyScroll);
    expect(root.querySelector('[data-map-region-key="context-scroll"]')).toBe(contextScroll);
    expect(root.querySelector('[data-map-region-key="party-member:shiroko"]')).toBe(partyMember);
    expect(root.querySelector('[data-map-enemy-hp="wolf"]')).toBe(enemyUnit);
    expect(partyScroll!.scrollTop).toBe(21);
    expect(contextScroll!.scrollTop).toBe(34);
    expect(root.querySelector('[data-map-commit]')).toBe(commit);
    expect(document.activeElement).toBe(commit);
  });

  test('projects the detached Status consumption receipt into the recent Commit feed', () => {
    const datapack = statusBattleWorkspaceDatapack(true);
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const preview = activeWorkspaceView(runId).actionPreview!;
    for (const row of preview.preparedActions) {
      if (!row.targetSelectionRequired) continue;
      const targetEnemyId = row.legalTargetEnemyIds[0];
      if (!targetEnemyId) continue;
      root.querySelector<HTMLButtonElement>(
        `[data-map-target-enemy][data-character-id="${row.characterId}"][data-target-enemy-id="${targetEnemyId}"]`,
      )?.click();
    }

    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    const recentCommit = activeWorkspaceView(runId).actionPreview?.recentCommit;
    expect(recentCommit?.statusReceiptVersion).toBe(3);
    expect(recentCommit?.statusConsumeTrace?.length).toBeGreaterThan(0);
    const trace = recentCommit!.statusConsumeTrace![0]!;
    expect(trace).toMatchObject({ op: 'statusConsume', statusId: 'burn', requestedStacks: 1, consumedStacks: 1, unmetStacks: 0 });
    expect(Object.isFrozen(recentCommit!.statusConsumeTrace)).toBe(true);
    expect(Object.isFrozen(trace.changes)).toBe(true);
    expect(Object.isFrozen(trace.changes[0]?.statusBefore)).toBe(true);
    const feedText = root.querySelector<HTMLElement>('[data-map-recent-commit]')?.textContent ?? '';
    expect(feedText).toContain('Status burn');
    expect(feedText).toContain('请求 1层 / 已消费 1层 / 缺额 0层');
    expect(feedText).toContain('1 → 0层');
  });

  test('projects and freezes the Status category removal receipt in the recent Commit feed', () => {
    const datapack = statusBattleWorkspaceDatapack(false, true);
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const preview = activeWorkspaceView(runId).actionPreview!;
    for (const row of preview.preparedActions) {
      if (!row.targetSelectionRequired) continue;
      const targetEnemyId = row.legalTargetEnemyIds[0];
      if (!targetEnemyId) continue;
      root.querySelector<HTMLButtonElement>(
        `[data-map-target-enemy][data-character-id="${row.characterId}"][data-target-enemy-id="${targetEnemyId}"]`,
      )?.click();
    }

    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    const recentCommit = activeWorkspaceView(runId).actionPreview?.recentCommit;
    expect(recentCommit?.statusReceiptVersion).toBe(4);
    expect(recentCommit?.statusCategoryRemoveTrace?.length).toBeGreaterThan(0);
    const trace = recentCommit!.statusCategoryRemoveTrace![0]!;
    expect(trace).toMatchObject({ op: 'statusRemoveCategory', category: 'harmful', removed: expect.arrayContaining([
      expect.objectContaining({ status: expect.objectContaining({ statusId: 'burn' }) }),
    ]) });
    expect(Object.isFrozen(recentCommit!.statusCategoryRemoveTrace)).toBe(true);
    expect(Object.isFrozen(trace.removed)).toBe(true);
    expect(Object.isFrozen(trace.removed[0]?.status)).toBe(true);
    expect(Object.isFrozen(trace.removed[0]?.status.holder)).toBe(true);
    const feedText = root.querySelector<HTMLElement>('[data-map-recent-commit]')?.textContent ?? '';
    expect(feedText).toContain('harmful 类 Status');
    expect(feedText).toContain('移除实例 Status burn（1层');
  });

  test('projects the frozen Status expiry Trigger v2 through ReadModel into Flow without a fake Action source', () => {
    const datapack = statusExpiryRewardDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    root.querySelector<HTMLButtonElement>('[data-map-ability-draft][data-action-id="apply-regen"]')!.click();
    root.querySelector<HTMLButtonElement>(
      '[data-map-ability-target][data-action-id="apply-regen"][data-target-character-id="serika"]',
    )!.click();

    const commit = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
    commit.click();
    expect(activeWorkspaceView(runId).actionPreview?.recentCommit).not.toHaveProperty('statusExpiryTriggerTrace');
    commit.click();
    expect(activeWorkspaceView(runId).actionPreview?.recentCommit).not.toHaveProperty('statusExpiryTriggerTrace');
    commit.click();

    const receipt = activeWorkspaceView(runId).actionPreview?.recentCommit;
    expect(receipt).toMatchObject({
      triggerReceiptVersion: 2,
      triggerTrace: [],
      executionSequence: [],
      statusExpiryTriggerTrace: [{
        queueIndex: 1, event: 'statusExpired', statusTraceIndex: 0,
        status: { holder: { kind: 'partyCharacter', id: 'serika' }, statusId: 'patient-regen', remainingRounds: 1 },
        holder: { kind: 'partyCharacter', id: 'serika' }, resourceId: 'focus', balanceBefore: 0, balanceAfter: 1,
      }],
    });
    const trace = receipt!.statusExpiryTriggerTrace![0]!;
    expect(Object.isFrozen(receipt!.statusExpiryTriggerTrace)).toBe(true);
    expect(Object.isFrozen(trace)).toBe(true);
    expect(Object.isFrozen(trace.status)).toBe(true);
    expect(Object.isFrozen(trace.status.holder)).toBe(true);
    expect(Object.isFrozen(trace.status.source)).toBe(true);
    const feedText = root.querySelector<HTMLElement>('[data-map-recent-commit]')?.textContent ?? '';
    expect(feedText).toContain('Status 到期回馈 1');
    expect(feedText).toContain('patient-regen');
    expect(feedText).toContain('持有者 黑见芹香');
    expect(feedText).toContain('来源 Ability · apply-regen');
    expect(feedText).toContain('1 轮');
    expect(feedText).toContain('focus +1（0 → 1）');
    expect(feedText).not.toContain('执行 1：Ability');
    expect(feedText).not.toContain('statusExpired');
  });

  test('does not add keyed Status subregions to a Map without Status definitions', () => {
    const datapack = battleWorkspaceDatapack();
    const { root } = mount(datapack);
    enterEncounter(root, mapFixture(datapack));

    expect(root.querySelector('[data-map-region-key^="unit-statuses:"]')).toBeNull();
  });

  test('shows positive Encounter Shield separately from HP and omits zero Shield', () => {
    const datapack = statusBattleWorkspaceDatapack();
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const view = activeWorkspaceView(runId);
    const encounter = view.currentEncounter!;
    const partyCharacterId = encounter.partyHp[0]!.characterId;
    const enemyId = encounter.enemies[0]!.enemyId;
    const withShield = {
      ...view,
      currentEncounter: {
        ...encounter,
        partyHp: encounter.partyHp.map((member, index) => ({ ...member, shield: index === 0 ? 3 : 0,
          ...(index === 0 ? { statuses: [{ key: 'defense-ward', statusId: 'ward', name: '防御姿态', stacks: 2,
            remainingRounds: 3, damageReductionPerStack: 2 }] } : {}) })),
        enemies: encounter.enemies.map(enemy => ({ ...enemy, shield: 0 })),
      },
    };
    root.innerHTML = renderMapWorkspace(createUIContext(game!), runId, withShield);

    const partyShield = root.querySelector<HTMLElement>(
      `[data-map-region-key="party-face:${partyCharacterId}"] .map-workspace__unit-stat--shield`,
    );
    expect(partyShield?.getAttribute('aria-label')).toBe('Shield 3');
    expect(partyShield?.textContent).toContain('3');
    expect(root.querySelector('[data-map-region-key="status:defense-ward"]')?.textContent)
      .toBe('防御姿态 · 2层 · 减伤 2/层（共 4） · 剩余3轮');
    expect(root.querySelector(
      `[data-map-region-key="enemy-face:${enemyId}"] .map-workspace__unit-stat--shield`,
    )).toBeNull();
  });

  test('selects and drags a real card target without lines or Swap, then explicitly commits the discount', async () => {
    const datapack = cardWorkspaceDatapack();
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const frame = root.querySelector('[data-workspace-frame]');
    const flow = root.querySelector('[data-map-flow-host]');
    const render = vi.spyOn(controller!, 'render');
    const confirm = vi.spyOn(controller!.commands, 'setMapPreparedCardTarget');
    const commit = vi.spyOn(controller!.commands, 'commitMapEncounterRound');
    const initial = activeWorkspaceView(runId);
    expect(root.textContent).toContain('声明：受用卡牌 sCost −1');
    expect(root.querySelector('[data-map-party-member="serika"] .map-workspace__unit-stat--scost strong')?.textContent).toBe('5');
    expect(root.querySelector('[data-map-player-command]')?.hasAttribute('data-map-object-key')).toBe(false);
    const source = root.querySelector<HTMLButtonElement>('[data-map-hand-stack-toggle][data-character-id="shiroko"]')!;
    const recipient = root.querySelector<HTMLButtonElement>('[data-map-hand-stack-toggle][data-character-id="serika"]')!;
    const sourceGroup = root.querySelector('[data-map-party-member="shiroko"]')!;
    sourceGroup.querySelector<HTMLButtonElement>('[data-map-relation-pin]')!.click();
    await Promise.resolve();
    recipient.click(); // A legal recipient also opens its own replacement Popover.
    sourceGroup.querySelector<HTMLButtonElement>('[data-map-target-edit]')!.click();
    expect(recipient.getAttribute('aria-expanded')).toBe('false');
    expect(confirm).not.toHaveBeenCalled();
    expect(activeWorkspaceView(runId).run).toEqual(initial.run);
    const preparedCard = initial.cards.find(card => card.owner.id === 'serika' && card.prepared)!;
    const unusedCard = initial.cards.find(card => card.owner.id === 'serika' && !card.prepared)!;
    const choices = [...root.querySelectorAll<HTMLButtonElement>('[data-map-card-target]')];
    const unused = choices.find(node => node.dataset.mapObjectKey === mapObjectKey(unusedCard.ref))!;
    unused.click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(activeWorkspaceView(runId).actionPreview!.preparedActions[0].targetCard).toEqual(unusedCard.ref);
    expect(activeWorkspaceView(runId).run.activeEncounter!.round).toBe(1);
    expect(commit).not.toHaveBeenCalled();
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(recipient);
    source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, button: 0, clientX: 10, clientY: 10 }));
    root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: 50, clientY: 10 }));
    expect(recipient.dataset.mapRoleRecipient).toBe('接收');
    expect(recipient.dataset.mapRoleDrop).toBe('接收');
    expect(root.querySelectorAll('.map-workspace__target-drag-preview')).toHaveLength(1);
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: 50, clientY: 10 }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(activeWorkspaceView(runId).actionPreview!.preparedActions[0].targetCard).toEqual(preparedCard.ref);
    expect(root.querySelector('.map-workspace__target-drag-preview')).toBeNull();
    expect(root.querySelector('[data-workspace-frame]')).toBe(frame);
    expect(root.querySelector('[data-map-flow-host]')).toBe(flow);
    expect(root.querySelector('svg')).toBeNull();
    expect(render).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    const submit = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
    submit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, button: 0 }));
    submit.click();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(activeWorkspaceView(runId).run.lastEncounterCommit!.settlements[1].scostCost).toEqual({ original: 2, discount: 1, paid: 1 });
    expect(activeWorkspaceView(runId).run.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'sCost')?.value).toBe(4);
    expect(activeWorkspaceView(runId).run.activeEncounter!.round).toBe(2);
    vi.restoreAllMocks();
  });

  test.each([
    ['same agility follows Party declaration order', { sourceAgility: 8, targetAgility: 8 }, true],
    ['target with higher final agility precedes the source and is hidden', { sourceAgility: 8, targetAgility: 8, targetPartyAgility: 1 }, false],
    ['target with lower final agility follows the source and is offered', { sourceAgility: 8, targetAgility: 7 }, true],
    ['same agility target declared earlier is hidden', { sourceAgility: 8, targetAgility: 8, reverseParty: true }, false],
  ] as const)('filters modifier target Cards by AG-1 order: %s', (_label, options, offered) => {
    const datapack = cardModifierWorkspaceDatapack(options);
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const view = activeWorkspaceView(runId);
    const source = view.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')!;
    const target = view.cards.find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika'
      && card.prepared)!;
    expect(source.cardEffectModifierPreviews?.some(row => mapObjectKey(row.targetCardRef) === mapObjectKey(target.ref)) ?? false)
      .toBe(offered);
    const choices = [...root.querySelectorAll<HTMLButtonElement>('[data-map-card-target]')];
    expect(choices.some(button => button.dataset.mapObjectKey === mapObjectKey(target.ref))).toBe(offered);
    if (offered) {
      expect(choices).toHaveLength(1);
      expect(choices[0]?.querySelectorAll('small')).toHaveLength(2);
      expect(choices[0]?.querySelectorAll('small')[1]?.textContent).toBe('伤害 +2');
    } else {
      expect(choices).toHaveLength(0);
    }
  });

  test.each([
    ['modifier source', 'shiroko'],
    ['modifier target', 'serika'],
  ] as const)('uses the actual PlayerCommand CardRef for a %s', (label, characterId) => {
    void label;
    const datapack = cardModifierWorkspaceDatapack({ sourceCount: 4, targetCount: 4 });
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const before = activeWorkspaceView(runId);
    const option = before.actionPreview!.playerCommandOptions.find(row => row.characterId === characterId);
    if (!option) throw new Error(`Expected a hand-out PlayerCommand for ${characterId}`);
    root.querySelector<HTMLButtonElement>(`[data-map-player-command][data-character-id="${characterId}"][data-action-id="${option.action.actionId}"]`)!.click();
    const current = activeWorkspaceView(runId);
    const ref = characterId === 'shiroko'
      ? current.cards.find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika' && card.prepared)?.ref
      : current.cards.find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika'
        && card.zone === 'playerCommand' && card.prepared)?.ref;
    expect(ref).toBeDefined();
    if (characterId === 'shiroko') {
      const commandCard = current.cards.find(card => card.owner.kind === 'partyCharacter'
        && card.owner.id === 'shiroko' && card.zone === 'playerCommand' && card.prepared);
      expect(commandCard).toBeDefined();
      expect(commandCard?.logicalIndex).toBe(current.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')!.hand.length);
    }
    if (characterId === 'serika') {
      expect(ref?.id.startsWith('["playerCommand","partyCharacter","serika",')).toBe(true);
      expect(current.cards.find(card => mapObjectKey(card.ref) === mapObjectKey(ref!))?.logicalIndex)
        .toBe(current.actionPreview!.preparedActions.find(row => row.characterId === 'serika')!.hand.length);
    }
    expect(current.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')?.cardEffectModifierPreviews)
      .toContainEqual(expect.objectContaining({ targetCardRef: ref }));
    const choice = [...root.querySelectorAll<HTMLButtonElement>('[data-map-card-target]')]
      .find(button => button.dataset.mapObjectKey === mapObjectKey(ref!));
    expect(choice).toBeDefined();
    expect(choice?.textContent).toContain('伤害 +2');
  });

  test('does not rebind a selected CardRef when the target Prepared Action changes', () => {
    const datapack = cardModifierWorkspaceDatapack({ targetCount: 2, thirdOwner: true });
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const initial = activeWorkspaceView(runId);
    const target = initial.cards.find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika' && card.prepared)!;
    const frame = root.querySelector('[data-workspace-frame="map"]');
    const targetButton = [...root.querySelectorAll<HTMLButtonElement>('[data-map-card-target]')]
      .find(button => button.dataset.mapObjectKey === mapObjectKey(target.ref))!;
    targetButton.click();
    const selected = activeWorkspaceView(runId);
    expect(selected.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')?.targetCard).toEqual(target.ref);
    expect(selected.run.activeEncounter!.targetSelections.find(row => row.characterId === 'shiroko')?.targetCard).toEqual(target.ref);
    expect(root.querySelector('[data-workspace-frame="map"]')).toBe(frame);
    expect(targetButton.isConnected).toBe(true);
    const serika = selected.actionPreview!.preparedActions.find(row => row.characterId === 'serika')!;
    const replacement = serika.hand.find(action => action.actionId !== serika.preparedAction?.actionId);
    if (!replacement) throw new Error('Expected another Serika Hand card');
    const encounter = selected.run.activeEncounter!;
    expect(() => game!.swapMapPreparedAction(runId, 'serika', replacement.actionId, {
      nodeId: encounter.nodeId, activityId: encounter.activityId, round: encounter.round, draftVersion: encounter.draftVersion,
    })).toThrow(/Card target selection is not legal/);
    const after = activeWorkspaceView(runId);
    expect(after.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')?.targetCard).toEqual(target.ref);
    expect(after.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')?.cardEffectModifierPreviews)
      .toContainEqual(expect.objectContaining({ targetCardRef: target.ref }));
    expect([...root.querySelectorAll('[data-map-card-target]')]
      .some(button => (button as HTMLElement).dataset.mapObjectKey === mapObjectKey(target.ref))).toBe(true);
  });

  test('formats CardRef modifier preview signs with the operation label', () => {
    expect(mapCardEffectModifierPreviewLabel({ op: 'heal', delta: 2 })).toBe('治疗 +2');
    expect(mapCardEffectModifierPreviewLabel({ op: 'damage', delta: -1 })).toBe('伤害 −1');
  });

  test('the shipped cooperation sample offers real card targets and settles a chosen discount', () => {
    const { root } = mount(gameplayBMapDatapack);
    const runId = enterEncounter(root, gameplayBScostTrainingDefinition);
    const prepare = (characterId: string, actionId: string) => {
      if (activeWorkspaceView(runId).actionPreview!.preparedActions.find(row => row.characterId === characterId)!.preparedAction!.actionId === actionId) return;
      root.querySelector<HTMLButtonElement>(`[data-map-hand-stack-toggle][data-character-id="${characterId}"]`)!.click();
      root.querySelector<HTMLButtonElement>(`[data-map-action-swap][data-character-id="${characterId}"][data-action-id="${actionId}"]`)!.click();
    };
    prepare('shiroko', 'planning');
    prepare('serika', 'rifle-shot');
    const before = activeWorkspaceView(runId);
    const target = before.cards.find(card => card.owner.id === 'serika' && card.actionId === 'rifle-shot')!.ref;
    const choice = [...root.querySelectorAll<HTMLButtonElement>('[data-map-card-target]')].find(node => node.dataset.mapObjectKey === mapObjectKey(target))!;
    choice.click();
    expect(activeWorkspaceView(runId).actionPreview!.preparedActions[0].targetCard).toEqual(target);
    expect(root.querySelector('[data-map-party-member="serika"] .map-workspace__unit-stat--scost strong')?.textContent).toBe('6');
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    expect(activeWorkspaceView(runId).run.lastEncounterCommit!.settlements[1].scostCost).toEqual({ original: 2, discount: 1, paid: 1 });
    expect(root.querySelector('[data-map-party-member="serika"] .map-workspace__unit-stat--scost strong')?.textContent).toBe('5');
    expect(root.querySelector('svg')).toBeNull();
  });

  test('keeps prepared cards in the party workspace and omits the per-round Flow card row', async () => {
    const { root } = mount(gameplayBMapDatapack);
    const runId = enterEncounter(root, gameplayBScostTrainingDefinition);
    const prepare = (characterId: string, actionId: string) => {
      if (activeWorkspaceView(runId).actionPreview!.preparedActions.find(row => row.characterId === characterId)!.preparedAction!.actionId === actionId) return;
      root.querySelector<HTMLButtonElement>(`[data-map-hand-stack-toggle][data-character-id="${characterId}"]`)!.click();
      root.querySelector<HTMLButtonElement>(`[data-map-action-swap][data-character-id="${characterId}"][data-action-id="${actionId}"]`)!.click();
    };
    prepare('shiroko', 'planning');
    prepare('serika', 'rifle-shot');

    const before = activeWorkspaceView(runId);
    const rifle = before.cards.find(card => card.owner.id === 'serika' && card.actionId === 'rifle-shot')!;
    const rifleKey = mapObjectKey(rifle.ref);
    const mapRifle = root.querySelector<HTMLElement>(`[data-map-party-member="serika"] .map-workspace__unit-action-card`)!;
    expect(mapRifle.dataset.mapObjectKey).toBe(rifleKey);
    expect(root.querySelector('[data-map-current-cards]')).toBeNull();
    expect(root.querySelector('[data-flow-host-key] .map-card-face')).toBeNull();
    expect(root.querySelector('[data-map-region-key="talk-feed"]')?.textContent).not.toContain('本轮当前玩法卡');

    const confirm = vi.spyOn(controller!.commands, 'setMapPreparedCardTarget');
    const mapSource = root.querySelector<HTMLElement>('[data-map-party-member="shiroko"] .map-workspace__unit-action-card')!;
    mapSource.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await Promise.resolve();
    const targetChoice = [...root.querySelectorAll<HTMLElement>('[data-map-card-target]')]
      .find(card => card.dataset.mapObjectKey === rifleKey)!;
    const sourceRelation = before.relations.find(row => row.source.id === 'shiroko');
    const alreadySelected = sourceRelation?.selectedTarget !== null
      && sourceRelation?.selectedTarget !== undefined
      && mapObjectKey(sourceRelation.selectedTarget) === rifleKey;
    expect(targetChoice.dataset.mapRoleRecipient ?? targetChoice.dataset.mapRoleCandidate)
      .toBe(alreadySelected ? '接收' : '候选');

    targetChoice.click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(activeWorkspaceView(runId).actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')!.targetCard).toEqual(rifle.ref);
    expect(activeWorkspaceView(runId).run.activeEncounter!.round).toBe(before.run.activeEncounter!.round);
    expect(activeWorkspaceView(runId).run.activeEncounter!.randomState).toEqual(before.run.activeEncounter!.randomState);
    expect(root.querySelector('.map-workspace__target-drag-preview')).toBeNull();
    vi.restoreAllMocks();
  });

  test('projects detached Map, Node, Edge, start and exit facts from the current Run', () => {
    mount();
    const map = mapFixture();
    const started = controller!.commands.startMap(map.id);
    const view = activeWorkspaceView(started.runId);

    expect(view.run).toMatchObject({ runId: started.runId, mapId: map.id, currentNodeId: map.startNodeId });
    expect(view.map).toMatchObject({
      id: map.id,
      name: map.name,
      startNodeId: map.startNodeId,
      exitNodeIds: map.exitNodeIds,
    });
    expect(view.map.nodes).toEqual(map.nodes.map(node => ({
      id: node.id,
      title: node.title,
      ...(node.description === undefined ? {} : { description: node.description }),
      hasEncounter: node.encounter !== undefined,
    })));
    expect(view.map.edges).toEqual(map.edges);
    expect(view.map.nodes.find(node => node.hasEncounter)?.hasEncounter).toBe(true);
    expect(game!.mapRun.getWorkspaceView('other-run')).toBeNull();

    expect(view).not.toBe(map);
    expect(view.map).not.toBe(map);
    expect(view.map.nodes).not.toBe(map.nodes);
    expect(view.map.edges).not.toBe(map.edges);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.run)).toBe(true);
    expect(Object.isFrozen(view.map)).toBe(true);
    expect(Object.isFrozen(view.map.exitNodeIds)).toBe(true);
    expect(Object.isFrozen(view.map.nodes)).toBe(true);
    expect(Object.isFrozen(view.map.nodes[0])).toBe(true);
    expect(Object.isFrozen(view.map.edges)).toBe(true);
    expect(Object.isFrozen(view.map.edges[0])).toBe(true);
  });

  test('renders Map and active Encounter from one route, then returns to the completed Node and exit', () => {
    const { root, mapId } = mount();
    const map = mapFixture();
    const started = controller!.commands.startMap(mapId);
    const route = { kind: 'map', runId: started.runId } as const;
    controller!.enterWorkspaceRoute(route);
    controller!.render();

    expect(controller!.panelState.workspace).toBeUndefined();
    expect(resolveCurrentWorkspaceRoute(controller!.panelState.workspaceNavigation, {
      service: 'game',
      workspace: null,
    })).toEqual(route);
    expect(workspaceRouteKey(route)).toBe(`map:${started.runId}`);
    expect(root.querySelector('[data-workspace-frame="map"]')).not.toBeNull();
    expectSharedMapTopbar(root.querySelector('[data-workspace-frame="map"]')!);
    expect(root.querySelector('[data-workspace-column="left"][data-workspace-role="party"]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-column="center"][data-workspace-role="information-flow"]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-column="right"][data-workspace-role="opponents-background"]')).not.toBeNull();
    expect(root.querySelector('[data-map-workspace-region][data-map-run-id="' + started.runId + '"]')).not.toBeNull();

    let view = activeWorkspaceView(started.runId);
    const firstEdge = view.map.edges.find(edge => edge.fromNodeId === view.run.currentNodeId)!;
    const firstTarget = view.map.nodes.find(node => node.id === firstEdge.toNodeId)!;
    const locationCards = [...root.querySelectorAll<HTMLElement>('[data-map-location-node-id]')];
    expect(locationCards.map(card => card.dataset.mapLocationNodeId)).toEqual([firstTarget.id]);
    expect(root.querySelector('[data-map-show-map]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-column="right"] [data-map-location-node-id]')).toBeNull();
    expect(root.querySelector('[data-flow-host-key] [data-map-location-node-id]')).not.toBeNull();
    const remoteNode = view.map.nodes.find(node => node.id !== view.run.currentNodeId
      && !view.map.edges.some(edge => edge.fromNodeId === view.run.currentNodeId && edge.toNodeId === node.id));
    expect(remoteNode).toBeDefined();
    expect(root.querySelector('[data-map-location-node-id="' + remoteNode!.id + '"]')).toBeNull();

    const startNodeId = view.run.currentNodeId;
    const selectedLocation = root.querySelector<HTMLElement>(`[data-map-location-node-id="${firstTarget.id}"]`)!;
    const confirmMove = root.querySelector<HTMLButtonElement>('[data-map-location-submit]')!;
    expect(confirmMove.disabled).toBe(true);
    selectedLocation.click();
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(startNodeId);
    expect(root.querySelector('[data-map-movement]')).toBeNull();
    expect(confirmMove.disabled).toBe(false);
    confirmMove.click();

    view = activeWorkspaceView(started.runId);
    expect(view.currentEncounter).toMatchObject({ mapId: map.id, nodeId: firstTarget.id });
    expect(root.querySelector(`[data-workspace-column="center"] [data-map-region-key="feed-encounter:${firstTarget.id}"]`)?.textContent).toContain(view.currentEncounter?.title);
    expect(view.actionPreview?.preparedActions).toHaveLength(map.partyCharacterIds.length);
    expect(root.querySelectorAll('[data-workspace-column="left"] [data-map-party-member]')).toHaveLength(map.partyCharacterIds.length);
    expect(root.querySelector('[data-map-region-key="action-dock"]')).not.toBeNull();
    const displayedResources = root.querySelector('.map-workspace__commit-balance')?.textContent ?? '';
    expect(displayedResources).toContain('PlayerCost');
    expect(displayedResources).toContain(String(view.run.playerCost));
    expect(root.querySelector('[data-map-commit]') !== null)
      .toBe(view.actionPreview?.commitPreview.canCommit === true);
    expect(root.querySelector('[data-map-move-choices]')).toBeNull();
    const blockedTarget = view.map.edges.find(edge => edge.fromNodeId === view.run.currentNodeId)?.toNodeId;
    expect(blockedTarget).toBeDefined();
    expect(root.querySelector('[data-map-location-node-id="' + blockedTarget + '"]')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('.map-workspace__commit')?.getAttribute('aria-label'))
      .toBe(view.actionPreview?.commitPreview.canCommit ? '提交本轮' : view.currentEncounter?.completion?.label);

    controller!.commands.completeMapEncounter(started.runId);
    controller!.render();
    view = activeWorkspaceView(started.runId);
    expect(view.run.currentNodeId).toBe(firstTarget.id);
    expect(view.run.completedEncounterNodeIds).toContain(firstTarget.id);
    expect(view.currentEncounter).toBeNull();
    expect(root.querySelector('[data-map-region-key="map-hero"] h1')?.textContent).toBe(firstTarget.title);
    expect(root.querySelector('[data-map-move-choices]')).not.toBeNull();

    const exitEdge = view.map.edges.find(edge => edge.fromNodeId === view.run.currentNodeId)!;
    const exitNode = view.map.nodes.find(node => node.id === exitEdge.toNodeId)!;
    controller!.commands.moveMap(started.runId, exitNode.id);
    controller!.render();
    const terminalView = game!.mapRun.getWorkspaceView(started.runId);
    expect(terminalView).toMatchObject({
      kind: 'success',
      result: {
        runId: started.runId,
        mapId: map.id,
        outcome: 'success',
        exitNodeId: exitNode.id,
        mapName: map.name,
        exitNodeTitle: exitNode.title,
      },
    });
    expect(game!.mapRun.getSnapshot()).toBeNull();
    expect(root.querySelector('[data-map-run-result="success"]')).not.toBeNull();
    expectSharedMapTopbar(root.querySelector('[data-workspace-frame="map"]')!);
    expect(root.querySelector('[data-map-node-id]')).toBeNull();
    expect(root.querySelector('[data-map-location-node-id]')).toBeNull();
    expect(root.querySelector('[data-map-back]')).not.toBeNull();
    expect(root.textContent).toContain(map.name);
    expect(root.textContent).toContain(exitNode.title);

    const fullRendersBeforeBack = controller!.getRefreshStats().fullRenders;
    root.querySelector<HTMLButtonElement>('[data-map-back]')!.click();
    expect(controller!.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(controller!.getRefreshStats().fullRenders).toBe(fullRendersBeforeBack + 1);
    expect(root.querySelector('[data-workspace-frame="map"]')).toBeNull();
    expect(root.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
    expect(game!.mapRun.getSnapshot()).toBeNull();
  });

  test('location selection waits for Click, recovers from failed movement and preserves the mounted workspace', () => {
    const datapack = actionWorkspaceDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const started = controller!.commands.startMap(map.id);
    controller!.enterWorkspaceRoute({ kind: 'map', runId: started.runId });
    controller!.render();
    const view = activeWorkspaceView(started.runId);
    const from = view.map.nodes.find(node => node.id === view.run.currentNodeId)!;
    const edge = view.map.edges.find(candidate => candidate.fromNodeId === from.id)!;
    const to = view.map.nodes.find(node => node.id === edge.toNodeId)!;
    const frame = root.querySelector('[data-workspace-frame="map"]');
    const feed = root.querySelector('[data-flow-host-key]');
    const party = root.querySelector('[data-map-region-key="party-scroll"]');
    const right = root.querySelector('[data-map-region-key="context-scroll"]');
    const mover = root.querySelector<HTMLElement>('[data-map-move-choices]')!;
    const card = mover.querySelector<HTMLElement>(`[data-map-location-node-id="${to.id}"]`)!;
    const confirm = root.querySelector<HTMLButtonElement>('[data-map-location-submit]')!;
    card.focus();
    card.click();
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(from.id);
    expect(confirm.disabled).toBe(false);
    const renders = controller!.getRefreshStats().fullRenders;
    controller!.requestMapWorkspaceRefresh(started.runId);
    expect(root.querySelector('[data-map-move-choices]')).toBe(mover);
    expect(root.querySelector(`[data-map-location-node-id="${to.id}"]`)).toBe(card);
    expect(confirm.disabled).toBe(false);
    const failed = vi.spyOn(controller!.commands, 'moveMap').mockImplementationOnce(() => { throw new Error('移动失败'); });
    confirm.click();
    expect(root.querySelector('[data-map-move-choices]')).toBe(mover);
    expect(root.querySelector('[data-map-movement]')).toBeNull();
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(from.id);
    expect(confirm.disabled).toBe(false);
    expect(root.querySelector('[data-map-commit-status]')?.textContent).toContain('移动未执行');
    failed.mockRestore();
    confirm.click();
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(to.id);
    expect(mover.isConnected).toBe(false);
    expect(root.querySelector('[data-map-move-choices]')).toBeNull();
    expect(root.querySelector('[data-map-movement]')?.textContent).toBe(`从${from.title}移动到了${to.title}`);
    expect(document.activeElement).toBe(root.querySelector('[data-map-focus-heading]'));
    expect(root.querySelector('[data-workspace-frame="map"]')).toBe(frame);
    expect(root.querySelector('[data-flow-host-key]')).toBe(feed);
    expect(root.querySelector('[data-map-region-key="party-scroll"]')).toBe(party);
    expect(root.querySelector('[data-map-region-key="context-scroll"]')).toBe(right);
    controller!.requestMapWorkspaceRefresh(started.runId);
    expect(root.querySelectorAll('[data-map-movement]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-map-movement]')).toHaveLength(1);
    expect(controller!.getRefreshStats().fullRenders).toBe(renders);
    // Complete the declared manual Encounter to expose the following flow mover.
    controller!.commands.completeMapEncounter(started.runId);
    controller!.render();
    expect(root.querySelector('[data-flow-host-key] [data-map-move-choices]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-column="right"] [data-map-location-node-id]')).toBeNull();
    const exitEdge = activeWorkspaceView(started.runId).map.edges.find(candidate => candidate.fromNodeId === to.id)!;
    commitFlowLocation(root, exitEdge.toNodeId);
    expect(root.querySelector('[data-map-run-result="success"]')).not.toBeNull();
    expect(root.querySelector('[data-map-move-choices]')).toBeNull();
    expect(root.querySelectorAll('[data-map-movement]')).toHaveLength(2);
  });

  test('two outgoing location cards can be reselected and a stale source cannot move twice', () => {
    const datapack = forkedLocationDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const started = controller!.commands.startMap(map.id);
    controller!.enterWorkspaceRoute({ kind: 'map', runId: started.runId });
    controller!.render();
    const startNodeId = activeWorkspaceView(started.runId).run.currentNodeId;
    const chooser = root.querySelector<HTMLElement>('[data-map-location-choices]')!;
    const cards = [...chooser.querySelectorAll<HTMLElement>('[data-map-location-node-id]')];
    expect(cards.map(card => card.dataset.mapLocationNodeId)).toEqual(['b', 'c']);
    const battle = cards.find(card => card.dataset.mapLocationNodeId === 'b')!;
    const supply = cards.find(card => card.dataset.mapLocationNodeId === 'c')!;
    const confirm = root.querySelector<HTMLButtonElement>('[data-map-location-submit]')!;
    expect(confirm.disabled).toBe(true);

    battle.click();
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(startNodeId);
    expect(battle.getAttribute('aria-pressed')).toBe('true');
    supply.click();
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(startNodeId);
    expect(battle.getAttribute('aria-pressed')).toBe('false');
    expect(supply.getAttribute('aria-pressed')).toBe('true');
    confirm.click();

    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe('c');
    expect(root.querySelectorAll('[data-map-movement]')).toHaveLength(1);
    const staleRef = { kind: 'mapNode' as const, runId: started.runId, mapId: map.id, nodeId: 'c' };
    expect(controller!.commitMapLocationFromFlow({
      ref: staleRef,
      objectKey: mapLocationObjectKey(staleRef),
      fromNodeId: startNodeId,
    })).toMatchObject({ moved: false });
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe('c');
    expect(root.querySelectorAll('[data-map-movement]')).toHaveLength(1);
  });

  test('a locked location cannot be selected or confirmed against the current Map View', () => {
    const datapack = locationConditionDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const started = controller!.commands.startMap(map.id);
    controller!.enterWorkspaceRoute({ kind: 'map', runId: started.runId });
    controller!.render();
    const view = activeWorkspaceView(started.runId);
    const targetNodeId = view.map.edges.find(edge => edge.fromNodeId === view.run.currentNodeId)!.toNodeId;
    const card = root.querySelector<HTMLElement>(`[data-map-location-node-id="${targetNodeId}"]`)!;
    const confirm = root.querySelector<HTMLButtonElement>('[data-map-location-submit]')!;
    expect(card.dataset.mapLocationSelectable).toBe('false');
    expect(card.dataset.mapCardEntry).toBeUndefined();
    expect(confirm.disabled).toBe(true);

    card.click();
    expect(confirm.disabled).toBe(true);
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(view.run.currentNodeId);
    const ref = { kind: 'mapNode' as const, runId: started.runId, mapId: map.id, nodeId: targetNodeId };
    expect(controller!.commitMapLocationFromFlow({
      ref,
      objectKey: mapLocationObjectKey(ref),
      fromNodeId: view.run.currentNodeId,
    })).toMatchObject({ moved: false, message: '当前路线条件未满足，该地点无法到达。' });
    expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(view.run.currentNodeId);
  });

  test('rechecks a route condition after selection and refuses a now-locked destination', () => {
    const datapack = locationConditionDatapack(1);
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const started = controller!.commands.startMap(map.id);
    controller!.enterWorkspaceRoute({ kind: 'map', runId: started.runId });
    controller!.render();
    const view = activeWorkspaceView(started.runId);
    const edge = view.map.edges.find(candidate => candidate.fromNodeId === view.run.currentNodeId)!;
    expect(edge.condition?.satisfied).toBe(true);
    const card = root.querySelector<HTMLElement>(`[data-map-location-node-id="${edge.toNodeId}"]`)!;
    const confirm = root.querySelector<HTMLButtonElement>('[data-map-location-submit]')!;
    card.click();
    expect(confirm.disabled).toBe(false);

    const originalGame = controller!.game;
    const descriptor = Object.getOwnPropertyDescriptor(controller!, 'game')!;
    const mapRun = {
      ...originalGame.mapRun,
      getWorkspaceView: (runId: string) => {
        const latest = originalGame.mapRun.getWorkspaceView(runId);
        if (runId !== started.runId || latest?.kind !== 'active') return latest;
        return {
          ...latest,
          map: { ...latest.map, edges: latest.map.edges.map(candidate => candidate.fromNodeId === edge.fromNodeId
            && candidate.toNodeId === edge.toNodeId && candidate.condition
            ? { ...candidate, condition: { ...candidate.condition, satisfied: false } }
            : candidate) },
        };
      },
    };
    const gameWithLatestView = new Proxy(originalGame, {
      get(target, property, receiver) {
        return property === 'mapRun' ? mapRun : Reflect.get(target, property, receiver);
      },
    });
    const move = vi.spyOn(controller!.commands, 'moveMap');
    Object.defineProperty(controller!, 'game', { ...descriptor, value: gameWithLatestView });
    try {
      confirm.click();
      expect(move).not.toHaveBeenCalled();
      expect(activeWorkspaceView(started.runId).run.currentNodeId).toBe(view.run.currentNodeId);
      expect(root.querySelector<HTMLButtonElement>('[data-map-location-submit]')?.disabled).toBe(true);
      expect(root.querySelector('[data-map-commit-status]')?.textContent).toContain('路线条件未满足');
    } finally {
      Object.defineProperty(controller!, 'game', { ...descriptor, value: originalGame });
    }
  });

  test('does not preserve a Map route over a different top-level service', () => {
    const navigation = createWorkspaceNavigation({ kind: 'map', runId: 'map-run-1' });
    expect(resolveCurrentWorkspaceRoute(navigation, { service: 'settings', workspace: null }))
      .toEqual({ kind: 'service', page: 'settings' });
  });

  test('projects full Hands and routes Swap, PlayerCommand, Target and Commit through Controller commands', () => {
    const datapack = actionWorkspaceDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    const beforePreview = game!.mapRun.getSnapshot();
    const firstView = activeWorkspaceView(runId);
    const secondView = activeWorkspaceView(runId);
    const firstPreview = firstView.actionPreview;
    expect(firstPreview).not.toBeNull();
    if (!firstPreview) throw new Error('Encounter action preview was not projected.');
    expect(firstPreview.preparedActions).toHaveLength(map.partyCharacterIds.length);
    expect(firstPreview.preparedActions.map(member => member.hand.length)).toEqual([3, 3]);
    expect(firstPreview.preparedActions.every(member => member.naturalAction?.actionId === member.hand[0]?.actionId)).toBe(true);
    expect(Object.isFrozen(firstPreview)).toBe(true);
    expect(Object.isFrozen(firstPreview.preparedActions)).toBe(true);
    expect(Object.isFrozen(firstPreview.preparedActions[0]?.hand)).toBe(true);
    expect(secondView.actionPreview).toEqual(firstPreview);
    expect(game!.mapRun.getSnapshot()).toEqual(beforePreview);
    expect(root.querySelectorAll('[data-workspace-column="left"] [data-map-party-member]')).toHaveLength(map.partyCharacterIds.length);
    expect(root.querySelector('[data-workspace-column="left"] [data-map-party-member="shiroko"] [data-map-action-swap]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-column="left"] [data-map-party-member="serika"] [data-map-action-swap]')).not.toBeNull();
    expect(root.querySelector('.map-workspace__commit-balance')?.textContent).toContain('PlayerCost');
    expect(root.querySelector('[data-map-commit]') !== null)
      .toBe(firstPreview.commitPreview.canCommit);

    const shiroko = firstPreview.preparedActions.find(member => member.characterId === 'shiroko')!;
    const swapAction = shiroko.hand.find(action => action.actionId !== shiroko.naturalAction?.actionId)!;
    const swapButton = root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="shiroko"][data-action-id="${swapAction.actionId}"]`,
    )!;
    swapButton.focus();
    swapButton.click();
    expect(activeWorkspaceView(runId).actionPreview?.overrides).toEqual([
      { kind: 'swap', characterId: 'shiroko', actionId: swapAction.actionId },
    ]);
    expect(swapButton.isConnected).toBe(false); // Candidate becomes the mounted effective card.
    expect((document.activeElement as HTMLElement | null)?.dataset.actionId).toBe(swapAction.actionId);
    const swappedPreview = activeWorkspaceView(runId).actionPreview!;
    const shirokoTarget = swappedPreview.preparedActions.find(member => member.characterId === 'shiroko')!;
    const swapTarget = shirokoTarget.legalTargetCharacterIds[0]!;
    root.querySelector<HTMLButtonElement>(
      `[data-map-target][data-character-id="shiroko"][data-target-character-id="${swapTarget}"]`,
    )!.click();
    expect(activeWorkspaceView(runId).actionPreview?.preparedActions.find(member => member.characterId === 'shiroko')?.targetCharacterId)
      .toBe(swapTarget);

    const serikaMember = firstPreview.preparedActions.find(member => member.characterId === 'serika')!;
    const serikaSwapAction = serikaMember.hand.find(action => action.actionId !== serikaMember.naturalAction?.actionId)!;
    root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="serika"][data-action-id="${serikaSwapAction.actionId}"]`,
    )!.click();
    expect(activeWorkspaceView(runId).actionPreview?.overrides).toEqual([
      { kind: 'swap', characterId: 'shiroko', actionId: swapAction.actionId },
      { kind: 'swap', characterId: 'serika', actionId: serikaSwapAction.actionId },
    ]);
    expect(root.querySelectorAll('[data-map-hand-stack-toggle]')).toHaveLength(2);
    root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="serika"][data-action-id="${serikaMember.naturalAction!.actionId}"]`,
    )!.click();
    expect(activeWorkspaceView(runId).actionPreview?.overrides).toEqual([
      { kind: 'swap', characterId: 'shiroko', actionId: swapAction.actionId },
    ]);

    const naturalButton = root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="shiroko"][data-action-id="${shiroko.naturalAction!.actionId}"]`,
    )!;
    expect(naturalButton.disabled).toBe(false);
    naturalButton.click();
    const naturalPreview = activeWorkspaceView(runId).actionPreview!;
    expect(naturalPreview.overrides).toEqual([]);
    expect(naturalPreview.preparedActions.find(member => member.characterId === 'shiroko')?.preparedAction?.actionId)
      .toBe(shiroko.naturalAction!.actionId);

    root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="shiroko"][data-action-id="${swapAction.actionId}"]`,
    )!.click();
    expect(activeWorkspaceView(runId).actionPreview?.overrides).toHaveLength(1);
    root.querySelector<HTMLButtonElement>(`[data-map-action-swap][data-character-id="shiroko"][data-action-id="${shiroko.naturalAction!.actionId}"]`)!.click();
    const clearedPreview = activeWorkspaceView(runId).actionPreview!;
    expect(clearedPreview.overrides).toEqual([]);
    expect(clearedPreview.preparedActions.find(member => member.characterId === 'shiroko')?.preparedAction?.actionId)
      .toBe(clearedPreview.preparedActions.find(member => member.characterId === 'shiroko')?.naturalAction?.actionId);

    const command = clearedPreview.playerCommandOptions.find(option => option.characterId === 'shiroko')!;
    const commandButton = root.querySelector<HTMLButtonElement>(
      `[data-map-player-command][data-character-id="shiroko"][data-action-id="${command.action.actionId}"]`,
    )!;
    commandButton.focus();
    commandButton.click();
    const commandedPreview = activeWorkspaceView(runId).actionPreview!;
    expect(commandedPreview.overrides).toEqual([
      { kind: 'playerCommand', characterId: 'shiroko', actionId: command.action.actionId },
    ]);
    expect(commandedPreview.preparedActions.find(member => member.characterId === 'shiroko')?.preparedAction?.actionId)
      .toBe(command.action.actionId);
    expect((document.activeElement as HTMLElement | null)?.dataset.actionId).toBe(command.action.actionId);
    expect(root.querySelector<HTMLButtonElement>('[data-map-action-swap][data-character-id="serika"]')?.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-map-player-command][data-character-id="serika"]')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-map-commit]')?.disabled).toBe(false);
    expect(commandedPreview.preparedActions.find(member => member.characterId === 'shiroko')?.targetCharacterId)
      .toBe(commandedPreview.preparedActions.find(member => member.characterId === 'shiroko')?.legalTargetCharacterIds[0]);

    const shirokoCommandTarget = commandedPreview.preparedActions.find(member => member.characterId === 'shiroko')!.legalTargetCharacterIds[0]!;
    root.querySelector<HTMLButtonElement>(
      `[data-map-target][data-character-id="shiroko"][data-target-character-id="${shirokoCommandTarget}"]`,
    )!.click();
    const serikaTarget = activeWorkspaceView(runId).actionPreview!.preparedActions
      .find(member => member.characterId === 'serika')!.legalTargetCharacterIds[0]!;
    const serikaTargetButton = root.querySelector<HTMLButtonElement>(
      `[data-map-target][data-character-id="serika"][data-target-character-id="${serikaTarget}"]`,
    )!;
    expect(serikaTargetButton.disabled).toBe(false);
    serikaTargetButton.click();

    const readyPreview = activeWorkspaceView(runId).actionPreview!;
    expect(readyPreview.commitPreview.canCommit).toBe(true);
    expect(readyPreview.commitPreview.playerCostRequired).toBe(1);
    expect(root.querySelector<HTMLButtonElement>('[data-map-commit]')?.disabled).toBe(false);
    expect(root.querySelector('[data-map-commit-status]')?.textContent).toContain('可提交');
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();

    const committed = game!.mapRun.getSnapshot()!;
    expect(committed.activeEncounter?.round).toBe(2);
    expect(committed.playerCost).toBe(0);
    expect(committed.activeEncounter?.lastCommit?.settlements).toContainEqual(expect.objectContaining({
      characterId: 'shiroko',
      actionId: command.action.actionId,
      targetCharacterId: shirokoCommandTarget,
      overrideKind: 'playerCommand',
      playerCostSpent: 1,
    }));
    expect(root.querySelector('[data-map-region-key="feed-recent-commit"]')?.textContent).toContain('PlayerCommand');
    expect(root.querySelector('[data-map-region-key="feed-recent-commit"]')?.textContent).toContain('−1 PlayerCost');
  });

  test('shows only the effective card and opens existing candidates without drawing or replacing workspace owners', () => {
    const datapack = actionWorkspaceDatapack();
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const party = root.querySelector('[data-map-region-key="party-scroll"]');
    const feed = root.querySelector('[data-map-region-key="talk-feed"]');
    const toggle = root.querySelector<HTMLButtonElement>('[data-map-hand-stack-toggle][data-character-id="shiroko"]')!;
    const before = game!.mapRun.getSnapshot();
    const stack = toggle.closest('.map-workspace__unit-card-stack')!;
    expect(stack.querySelectorAll('.map-workspace__unit-action-card')).toHaveLength(1);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(stack.querySelector('[data-map-hand-picker]')).not.toBeNull();
    expect(game!.mapRun.getSnapshot()).toEqual(before);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('[data-map-region-key="party-scroll"]')).toBe(party);
    expect(root.querySelector('[data-map-region-key="talk-feed"]')).toBe(feed);
    expect(game!.mapRun.getSnapshot()).toEqual(before);
  });

  test('renders Wait as the prepared state without inventing a Hand card', () => {
    const datapack = actionWorkspaceDatapack(true);
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    const view = activeWorkspaceView(runId);
    const serika = view.actionPreview?.preparedActions.find(member => member.characterId === 'serika');
    expect(serika).toMatchObject({ hand: [], naturalAction: null, preparedAction: null });
    const serikaCard = root.querySelector('[data-workspace-column="left"] [data-map-party-member="serika"]');
    expect(serikaCard?.textContent).toContain('Wait');
    expect(serikaCard?.querySelector('[data-map-action-swap]')).toBeNull();
    expect(serikaCard?.querySelector('[data-map-player-command]')).toBeNull();
    expect(root.querySelector('[data-action-id="Wait"]')).toBeNull();
  });

  test('renders Enemy Hands as same-size read-only Action cards with automatic targets', () => {
    const datapack = battleWorkspaceDatapack();
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const view = activeWorkspaceView(runId);
    const enemyCards = [...root.querySelectorAll<HTMLElement>(
      '[data-workspace-column="right"] .map-workspace__enemy-action-card',
    )];

    expect(view.actionPreview?.preparedEnemyActions).toHaveLength(2);
    expect(enemyCards).toHaveLength(2);
    for (const [index, card] of enemyCards.entries()) {
      const enemyId = index === 0 ? 'wolf' : 'wolf-2';
      const prepared = view.actionPreview!.preparedEnemyActions.find(row => row.enemyId === enemyId)!;
      const handCard = view.cards.find(row => row.owner.kind === 'enemy' && row.owner.id === enemyId)!;
      expect(prepared.naturalAction?.name).toBe('敌方攻击');
      expect(prepared.targetCharacterId).toBe('shiroko');
      expect(card.tagName).toBe('DIV');
      expect(card.getAttribute('role')).toBe('group');
      expect(card.dataset.mapCardUsage).toBe('live');
      expect(card.dataset.mapCardEntry).toBe('inspect');
      expect(card.dataset.mapObjectKey).toBe(mapObjectKey(handCard.ref));
      expect(card.dataset.mapCardHostRef).toBe(`enemy-hand:${runId}:${enemyId}`);
      expect(card.getAttribute('aria-label')).toContain('只读');
      expect(card.textContent).toContain('敌方自然行动');
      expect(card.closest('.map-workspace__unit-slot.has-cards')).not.toBeNull();
      expect(card.closest('.map-workspace__unit-card-stack')).not.toBeNull();
      expect(card.closest('button')).toBeNull();
      expect(card.dataset.mapCardEntry).not.toMatch(/target|replace|command/);
    }
    expect(root.querySelectorAll('[data-map-enemy-info]')).toHaveLength(0);
    expect(root.querySelector('[data-map-region-key="enemy-action:wolf"]')?.textContent)
      .toContain('目标角色：砂狼白子');
    expect(root.querySelector('[data-workspace-column="right"] [data-map-target-enemy]')).toBeNull();
    expect(root.querySelector('[data-workspace-column="right"] [data-map-action-swap]')).toBeNull();
    expect(root.querySelector('[data-workspace-column="right"] [data-map-player-command]')).toBeNull();

    const target = root.querySelector<HTMLElement>(
      '[data-workspace-column="left"] [data-map-party-member="shiroko"] .map-workspace__unit-face',
    )!;
    enemyCards[0]!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(enemyCards[0]!.dataset.mapRoleSource).toBe('发起');
    expect(root.querySelector('[data-workspace-column="right"] [data-map-region-key="enemy-face:wolf"]')?.getAttribute('data-map-role-source')).toBeNull();
    expect(target.dataset.mapRoleRecipient).toBe('接收');

    const beforeInspect = game!.mapRun.getSnapshot();
    enemyCards[0]!.click();
    expect(game!.mapRun.getSnapshot()).toEqual(beforeInspect);
  });

  test('shows Enemy Wait without inventing a card when its Action pool is empty', () => {
    const base = battleWorkspaceDatapack();
    const source = mapFixture(base);
    const map: GameplayMapDef = {
      ...source,
      resumeVersion: source.resumeVersion + 1,
      nodes: source.nodes.map(node => node.encounter ? {
        ...node,
        encounter: { ...node.encounter, enemies: (node.encounter.enemies ?? []).map(enemy => ({ ...enemy, actions: [] })) },
      } : node),
    };
    const datapack: Datapack = {
      ...base,
      maps: base.maps?.map(candidate => candidate.id === map.id ? map : candidate),
    };
    const { root } = mount(datapack);
    const runId = enterEncounter(root, map);
    const view = activeWorkspaceView(runId);

    expect(view.actionPreview?.preparedEnemyActions).toHaveLength(2);
    expect(view.actionPreview?.preparedEnemyActions.every(row => row.naturalAction === null && row.hand.length === 0)).toBe(true);
    expect(root.querySelectorAll('[data-workspace-column="right"] .map-workspace__enemy-action-card')).toHaveLength(0);
    expect(root.querySelector('[data-map-region-key="enemy-action:wolf"]')?.textContent).toContain('本轮待机');
  });

  test('runs the official three-Robot sample through the Map Workspace without selecting targets', () => {
    const datapack = autonomousBattleDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    const view = activeWorkspaceView(runId);

    expect(view.actionPreview?.preparedActions.map(row => row.targetEnemyId)).toEqual(['robot-a', 'robot-a']);
    expect(view.actionPreview?.preparedEnemyActions.map(row => row.enemyId)).toEqual(['robot-a', 'robot-b', 'robot-c']);
    expect(root.querySelectorAll('[data-workspace-column="right"] .map-workspace__enemy-action-card')).toHaveLength(3);
    expect(root.querySelector<HTMLButtonElement>('[data-map-commit]')?.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();

    const committed = game!.mapRun.getSnapshot()!;
    expect(committed.activeEncounter?.enemies.map(row => [row.enemyId, row.currentHp])).toEqual([
      ['robot-a', 0], ['robot-b', 6], ['robot-c', 8],
    ]);
    expect(committed.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 4 },
      { characterId: 'serika', currentHp: 10 },
    ]);
    expect(committed.activeEncounter?.lastCommit?.enemyActions).toMatchObject([
      { enemyId: 'robot-a', skipReason: 'defeated' },
      { enemyId: 'robot-b', actionId: 'robot-counterattack', targetCharacterId: 'shiroko' },
      { enemyId: 'robot-c', actionId: 'robot-counterattack', targetCharacterId: 'shiroko' },
    ]);
    expect(root.querySelector('[data-map-region-key="feed-recent-commit"]')?.textContent).toContain('机器人射击');
  });

  test('renders Action, Ability and Item names from a receipt as text instead of markup', () => {
    const { root } = mount();
    const map = mapFixture();
    const runId = enterEncounter(root, map);
    const view = activeWorkspaceView(runId);
    const actionName = '<img src=x onerror=alert(1)>';
    const abilityName = '<script>alert(2)</script>';
    const itemName = '<svg onload=alert(3)>';
    const projectedAction = {
      actionId: 'html-action', name: actionName, targetKind: 'none' as const, costs: [],
    };
    const recentCommit = {
      requestId: 'html-receipt', commandVersion: 0, resultingCommitVersion: 1,
      nodeId: view.run.currentNodeId, round: 1, draftVersion: 0,
      settlements: [{
        characterId: 'shiroko', action: projectedAction, targetCharacterId: null, targetEnemyId: null,
        overrideKind: null, playerCostSpent: 0 as const, resourceChanges: [], hpChanges: [],
      }],
      ability: {
        action: { ...projectedAction, actionId: 'html-ability', name: abilityName },
        target: { kind: 'enemy' as const, enemyId: 'wolf' }, playerCostSpent: 1 as const, hpChanges: [],
      },
      item: {
        itemName, action: null, target: { kind: 'partyCharacter' as const, characterId: 'serika' },
        consumedCount: 1 as const, hpChanges: [],
      },
      enemyActions: [],
    } as NonNullable<typeof view.actionPreview>['recentCommit'];
    const actionPreview = view.actionPreview;
    expect(actionPreview).not.toBeNull();
    if (!actionPreview) throw new Error('Encounter action preview was not projected.');

    root.innerHTML = renderMapWorkspace(createUIContext(game!), runId, {
      ...view,
      actionPreview: { ...actionPreview, recentCommit },
    });

    const receipt = root.querySelector<HTMLElement>('[data-map-recent-commit]');
    expect(receipt?.textContent).toContain(actionName);
    expect(receipt?.textContent).toContain(abilityName);
    expect(receipt?.textContent).toContain(itemName);
    expect(receipt?.querySelector('img, script, svg')).toBeNull();
  });

  test('disables hand-out PlayerCommand options when Runtime says PlayerCost is insufficient', () => {
    const datapack = actionWorkspaceDatapack(false, 0);
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    const options = activeWorkspaceView(runId).actionPreview?.playerCommandOptions
      .filter(option => option.characterId === 'shiroko');
    expect(options).toHaveLength(1);
    expect(options?.[0]?.canPayPlayerCost).toBe(false);
    const commandButton = root.querySelector<HTMLButtonElement>('[data-map-player-command][data-character-id="shiroko"]');
    expect(commandButton?.disabled).toBe(true);
    expect(commandButton?.textContent).toContain('需要 1 PlayerCost');
  });

  test('selects Party and Ability additional targets through separate workspace groups without replacing primary targets', () => {
    const datapack = battleWorkspaceDatapack({ executionContractId: 'AG-1',
      partyActionAdditionalTarget: 'partyCharacter', abilityAdditionalTarget: 'partyCharacter' });
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const primaryEnemy = root.querySelector<HTMLButtonElement>(
      '[data-map-target-enemy][data-character-id="shiroko"][data-target-enemy-id="wolf-2"]',
    )!;
    primaryEnemy.click();

    const partyPicker = root.querySelector<HTMLElement>(
      '[data-map-region-key="additional-targets:shiroko"][role="group"]',
    );
    expect(partyPicker?.getAttribute('aria-label')).toContain('额外目标');
    const partySecondary = root.querySelector<HTMLButtonElement>(
      '[data-map-target-additional][data-character-id="shiroko"][data-target-character-id="serika"]',
    )!;
    const partyScroll = root.querySelector('[data-map-region-key="party-scroll"][data-scroll-owner="content-region"]');
    const feed = root.querySelector('[data-map-region-key="talk-feed"][data-scroll-owner="content-region"]');
    const partyMember = root.querySelector('[data-map-region-key="party-member:serika"]');
    const partyFocusKey = partySecondary.dataset.mapFocusKey;
    partySecondary.focus();
    partySecondary.click();

    expect(game!.mapRun.getSnapshot()?.activeEncounter?.targetSelections).toContainEqual({
      characterId: 'shiroko', targetEnemyId: 'wolf-2', additionalTargetCharacterId: 'serika',
    });
    const selectedParty = activeWorkspaceView(runId).actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')!;
    expect(selectedParty).toMatchObject({ targetEnemyId: 'wolf-2', additionalTargetKind: 'partyCharacter',
      additionalTargetCharacterId: 'serika', additionalTargetSelectionRequired: false });
    expect(root.querySelector<HTMLButtonElement>(
      '[data-map-target-enemy][data-character-id="shiroko"][data-target-enemy-id="wolf-2"]',
    )?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector<HTMLButtonElement>(
      '[data-map-target-additional][data-character-id="shiroko"][data-target-character-id="serika"]',
    )?.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(partySecondary);
    expect((document.activeElement as HTMLElement).dataset.mapFocusKey).toBe(partyFocusKey);
    expect(root.querySelector('[data-map-region-key="party-scroll"][data-scroll-owner="content-region"]')).toBe(partyScroll);
    expect(root.querySelector('[data-map-region-key="talk-feed"][data-scroll-owner="content-region"]')).toBe(feed);
    expect(root.querySelector('[data-map-region-key="party-member:serika"]')).toBe(partyMember);
    expect(activeWorkspaceView(runId).actionPreview?.commitPreview.canCommit).toBe(false);

    const serikaSecondary = root.querySelector<HTMLButtonElement>(
      '[data-map-target-additional][data-character-id="serika"][data-target-character-id="shiroko"]',
    )!;
    serikaSecondary.click();
    expect(game!.mapRun.getSnapshot()?.activeEncounter?.targetSelections).toContainEqual({
      characterId: 'serika', targetEnemyId: 'wolf', additionalTargetCharacterId: 'shiroko',
    });
    expect(activeWorkspaceView(runId).actionPreview?.commitPreview.canCommit).toBe(true);
    expect(root.querySelector('[data-map-commit]')).not.toBeNull();
    expect(root.querySelector('[data-map-commit-status]')?.textContent).toContain('本轮可提交');

    const abilityChoice = root.querySelector<HTMLButtonElement>('[data-map-ability-draft]')!;
    abilityChoice.click();
    root.querySelector<HTMLButtonElement>(
      '[data-map-ability-target][data-action-id="workspace-battle-ability"][data-target-enemy-id="wolf-2"]',
    )!.click();
    const abilitySecondary = root.querySelector<HTMLButtonElement>(
      '[data-map-ability-target-additional][data-target-character-id="serika"]',
    )!;
    abilitySecondary.focus();
    abilitySecondary.click();
    expect(game!.mapRun.getSnapshot()?.activeEncounter?.abilityDraft).toMatchObject({
      actionId: 'workspace-battle-ability',
      target: { kind: 'enemy', enemyId: 'wolf-2' },
      additionalTarget: { kind: 'partyCharacter', characterId: 'serika' },
    });
    expect(activeWorkspaceView(runId).sourcePreview).toMatchObject({
      selectedAbilityTarget: { kind: 'enemy', enemyId: 'wolf-2' },
      selectedAbilityAdditionalTarget: { kind: 'partyCharacter', characterId: 'serika' },
    });
    expect(root.querySelector<HTMLButtonElement>(
      '[data-map-ability-target-additional][data-target-character-id="serika"]',
    )?.getAttribute('aria-pressed')).toBe('true');
    expect(activeWorkspaceView(runId).actionPreview?.commitPreview.canCommit).toBe(true);
    expect(root.querySelector('[data-map-commit]')).not.toBeNull();
    expect(root.querySelector('[data-map-commit-status]')?.textContent).toContain('本轮可提交');

    const clearAbilityAdditional = root.querySelector<HTMLButtonElement>('[data-map-ability-target-additional-clear]')!;
    clearAbilityAdditional.focus();
    clearAbilityAdditional.click();
    expect(game!.mapRun.getSnapshot()?.activeEncounter?.abilityDraft).toMatchObject({
      target: { kind: 'enemy', enemyId: 'wolf-2' }, additionalTarget: null,
    });
    expect(activeWorkspaceView(runId).actionPreview?.commitPreview.canCommit).toBe(false);
    expect(root.querySelector('[data-map-commit]')).toBeNull();
    const abilitySecondaryAfterClear = root.querySelector<HTMLButtonElement>(
      '[data-map-ability-target-additional][data-target-character-id="serika"]',
    )!;
    expect((document.activeElement as HTMLElement | null)?.hasAttribute('data-map-ability-target-additional')).toBe(true);
    expect(document.activeElement?.closest('[data-map-region-key="ability-additional-targets:workspace-battle-ability"]'))
      .not.toBeNull();
    abilitySecondaryAfterClear.click();
    expect(activeWorkspaceView(runId).actionPreview?.commitPreview.canCommit).toBe(true);
    expect(root.querySelector('[data-map-commit]')).not.toBeNull();
  });

  test('renders battle HP, routes Enemy targets, keeps Ability and Item drafts separate, and shows the round result', () => {
    const datapack = battleWorkspaceDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const itemId = 'gameplay-b:item:workspace-kit';
    game!.mutations.setResource(Resource.Credit, 10);
    game!.mutations.addItem(itemId, 1, 3);
    const runId = enterEncounter(root, map);
    const workspaceRegion = root.querySelector<HTMLElement>('[data-map-workspace-region]')!;
    const partyScroll = root.querySelector<HTMLElement>('[data-map-region-key="party-scroll"][data-scroll-owner="content-region"]')!;
    const feed = root.querySelector<HTMLElement>('[data-map-region-key="talk-feed"][data-scroll-owner="content-region"]')!;
    const contextScroll = root.querySelector<HTMLElement>('[data-map-region-key="context-scroll"][data-scroll-owner="content-region"]')!;
    const encounterRegion = root.querySelector<HTMLElement>('[data-map-encounter-region]')!;
    expect(partyScroll).not.toBeNull();
    expect(feed).not.toBeNull();
    expect(contextScroll).not.toBeNull();
    partyScroll.scrollTop = 23;
    feed.scrollTop = 37;
    contextScroll.scrollTop = 51;
    const unrelatedPartyMember = root.querySelector('[data-map-region-key="party-member:serika"]');
    const view = activeWorkspaceView(runId);

    expect(view.currentEncounter?.partyHp).toHaveLength(2);
    expect(view.currentEncounter?.enemies).toEqual([
      { enemyId: 'wolf', currentHp: 20, maxHp: 24, shield: 0 },
      { enemyId: 'wolf-2', currentHp: 20, maxHp: 24, shield: 0 },
    ]);
    expect(root.querySelectorAll('[data-workspace-column="left"] .map-workspace__unit-face')).toHaveLength(2);
    expect(root.querySelector('[data-map-region-key="party-face:shiroko"]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-column="right"] [data-map-enemy-hp="wolf-2"]')?.textContent).toContain('20 / 24');
    expect(root.querySelector('[data-map-complete-encounter]')).toBeNull();
    expect(root.querySelector('[data-map-commit-status]')?.textContent).toContain('本轮可提交');
    expect(root.querySelectorAll('[data-map-target-enemy]')).toHaveLength(4);
    expect(root.querySelector('[data-workspace-column="left"] [data-map-target-enemy]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-column="center"] [data-map-ability-draft]')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-workspace-column="center"] .map-workspace__commit')?.disabled).toBe(false);
    expect(root.querySelector('[data-map-ability-draft]')?.textContent).toContain('1 PlayerCost');
    expect(root.querySelector('[data-map-ability-draft]')?.textContent).toContain('费用充足');
    expect(root.querySelector('[data-map-item-draft]')?.textContent).toContain('库存 1');
    expect(root.querySelector('[data-map-item-draft]')?.textContent).toContain('条件满足');

    const shirokoEnemyTarget = root.querySelector<HTMLButtonElement>(
      '[data-map-target-enemy][data-character-id="shiroko"][data-target-enemy-id="wolf-2"]',
    )!;
    shirokoEnemyTarget.focus();
    shirokoEnemyTarget.click();
    expect(activeWorkspaceView(runId).actionPreview?.preparedActions.find(row => row.characterId === 'shiroko')?.targetEnemyId)
      .toBe('wolf-2');
    expect(root.querySelector('[data-map-workspace-region]')).toBe(workspaceRegion);
    expect(root.querySelector('[data-map-region-key="party-scroll"][data-scroll-owner="content-region"]')).toBe(partyScroll);
    expect(root.querySelector('[data-map-region-key="talk-feed"][data-scroll-owner="content-region"]')).toBe(feed);
    expect(root.querySelector('[data-map-region-key="context-scroll"][data-scroll-owner="content-region"]')).toBe(contextScroll);
    expect(partyScroll.scrollTop).toBe(23);
    expect(feed.scrollTop).toBe(37);
    expect(contextScroll.scrollTop).toBe(51);
    expect(root.querySelector('[data-map-region-key="party-member:serika"]')).toBe(unrelatedPartyMember);
    expect(root.querySelector('[data-map-encounter-region]')).toBe(encounterRegion);
    expect(document.activeElement).toBe(shirokoEnemyTarget);
    expect((document.activeElement as HTMLElement | null)?.dataset.mapFocusKey).toBe(shirokoEnemyTarget.dataset.mapFocusKey);

    const serikaTarget = root.querySelector<HTMLButtonElement>('[data-map-target-enemy][data-character-id="serika"][data-target-enemy-id="wolf"]')!;
    serikaTarget.click();
    const ability = root.querySelector<HTMLButtonElement>('[data-map-ability-draft]')!;
    ability.focus();
    ability.click();
    expect(activeWorkspaceView(runId).sourcePreview).toMatchObject({ selectedAbilityActionId: 'workspace-battle-ability' });
    expect(document.activeElement).toBe(ability);
    expect((document.activeElement as HTMLElement | null)?.dataset.mapFocusKey).toBe(ability.dataset.mapFocusKey);
    root.querySelector<HTMLButtonElement>('[data-map-ability-target][data-target-enemy-id="wolf-2"]')!.click();
    expect(activeWorkspaceView(runId).sourcePreview?.selectedAbilityTarget)
      .toEqual({ kind: 'enemy', enemyId: 'wolf-2' });

    const itemButton = root.querySelector<HTMLButtonElement>('[data-map-item-draft]')!;
    itemButton.focus();
    itemButton.click();
    expect(activeWorkspaceView(runId).sourcePreview).toMatchObject({
      selectedAbilityActionId: 'workspace-battle-ability',
      selectedItemId: itemId,
    });
    expect((document.activeElement as HTMLElement | null)?.dataset.mapFocusKey).toBe(itemButton.dataset.mapFocusKey);
    expect(document.activeElement).toBe(itemButton);
    root.querySelector<HTMLButtonElement>('[data-map-item-target][data-target-character-id="serika"]')!.click();
    expect(activeWorkspaceView(runId).sourcePreview?.selectedItemTarget)
      .toEqual({ kind: 'partyCharacter', characterId: 'serika' });
    const clearAbility = root.querySelector<HTMLButtonElement>('[data-map-ability-clear]')!;
    clearAbility.focus();
    clearAbility.click();
    expect(activeWorkspaceView(runId).sourcePreview).toMatchObject({ selectedAbilityActionId: null, selectedItemId: itemId });
    expect((document.activeElement as HTMLElement | null)?.dataset.mapFocusKey).toBe('ability:workspace-battle-ability');

    root.querySelector<HTMLButtonElement>('[data-map-ability-draft]')!.click();
    root.querySelector<HTMLButtonElement>('[data-map-ability-target][data-target-enemy-id="wolf-2"]')!.click();
    const committedView = activeWorkspaceView(runId);
    expect(committedView.actionPreview?.commitPreview.canCommit).toBe(true);
    const talkFeed = root.querySelector<HTMLElement>('[data-map-region-key="talk-feed"]')!;
    Object.defineProperties(talkFeed, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
    });
    talkFeed.scrollTop = 792;
    const partyHpBeforeCommit = committedView.currentEncounter?.partyHp.map(member => member.currentHp);
    const enemyHpBeforeCommit = committedView.currentEncounter?.enemies.map(enemy => enemy.currentHp);
    const stableFrame = root.querySelector('[data-workspace-frame="map"]');
    const stableLeft = root.querySelector('[data-workspace-column="left"]');
    const stableCenter = root.querySelector('[data-workspace-column="center"]');
    const stableRight = root.querySelector('[data-workspace-column="right"]');
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    const receipt = game!.mapRun.getSnapshot()?.activeEncounter?.lastCommit;
    expect(receipt?.ability).toMatchObject({ target: { kind: 'enemy', enemyId: 'wolf-2' }, playerCostSpent: 1 });
    expect(receipt?.item).toMatchObject({ itemId, target: { kind: 'partyCharacter', characterId: 'serika' }, consumedCount: 1 });
    expect(receipt?.enemyActions).toHaveLength(2);
    const resultText = root.querySelector('[data-map-region-key="feed-recent-commit"]')?.textContent ?? '';
    expect(resultText).toContain('Ability');
    expect(resultText).toContain('地图急救包');
    expect(resultText).toContain('敌方 wolf');
    expect(resultText).toContain('敌方攻击');
    expect(resultText).toContain('砂狼白子 HP -1');
    expect(root.querySelector('[data-workspace-frame="map"]')).toBe(stableFrame);
    expect(root.querySelector('[data-workspace-column="left"]')).toBe(stableLeft);
    expect(root.querySelector('[data-workspace-column="center"]')).toBe(stableCenter);
    expect(root.querySelector('[data-workspace-column="right"]')).toBe(stableRight);
    // 共享滚动跟随到真实可滚动底部（scrollHeight - clientHeight），与浏览器夹取一致。
    expect(talkFeed.scrollTop).toBe(talkFeed.scrollHeight - talkFeed.clientHeight);
    const committedEncounter = activeWorkspaceView(runId).currentEncounter;
    expect(committedEncounter?.partyHp.map(member => member.currentHp)).not.toEqual(partyHpBeforeCommit);
    expect(committedEncounter?.enemies.map(enemy => enemy.currentHp)).not.toEqual(enemyHpBeforeCommit);
    for (const member of committedEncounter?.partyHp ?? []) {
      expect(root.querySelector(`[data-map-region-key="party-face:${member.characterId}"] .map-workspace__unit-stat--hp strong`)?.textContent)
        .toBe(`${member.currentHp} / ${member.maxHp}`);
    }
    for (const enemy of committedEncounter?.enemies ?? []) {
      expect(root.querySelector(`[data-workspace-column="right"] [data-map-enemy-hp="${enemy.enemyId}"]`)?.textContent)
        .toContain(`${enemy.currentHp} / ${enemy.maxHp}`);
    }

    const nextPreview = activeWorkspaceView(runId).actionPreview!;
    for (const member of nextPreview.preparedActions) {
      if (!member.targetSelectionRequired) continue;
      const targetEnemyId = member.legalTargetEnemyIds[0];
      if (!targetEnemyId) throw new Error(`No legal Enemy target was projected for ${member.characterId}.`);
      root.querySelector<HTMLButtonElement>(
        `[data-map-target-enemy][data-character-id="${member.characterId}"][data-target-enemy-id="${targetEnemyId}"]`,
      )!.click();
    }
    expect(activeWorkspaceView(runId).actionPreview?.commitPreview.canCommit).toBe(true);
    talkFeed.scrollTop = 300;
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    expect(talkFeed.scrollTop).toBe(300);

    const currentView = activeWorkspaceView(runId);
    const currentReceipt = currentView.actionPreview?.recentCommit;
    expect(currentReceipt).not.toBeNull();
    if (!currentView.actionPreview || !currentReceipt) throw new Error('Expected a projected recent Commit receipt.');
    const receiptElement = root.querySelector<HTMLElement>('[data-map-recent-commit]')!;
    const receiptText = receiptElement.textContent;
    const nextRequestId = `${currentReceipt.requestId}:same-text`;
    const nextReceipt = { ...currentReceipt, requestId: nextRequestId };
    const nextRun = {
      ...currentView.run,
      lastEncounterCommit: currentView.run.lastEncounterCommit
        ? { ...currentView.run.lastEncounterCommit, requestId: nextRequestId }
        : null,
    };
    const nextView = {
      ...currentView,
      run: nextRun,
      actionPreview: { ...currentView.actionPreview, recentCommit: nextReceipt },
    };
    const viewOwner = game as unknown as {
      getMapWorkspaceView: (targetRunId: string) => typeof nextView;
    };
    const viewSpy = vi.spyOn(viewOwner, 'getMapWorkspaceView').mockReturnValue(nextView);
    const feedBeforeIdChange = root.querySelector('[data-map-region-key="talk-feed"]');
    talkFeed.scrollTop = 792;
    try {
      controller!.requestMapWorkspaceRefresh(runId);
      expect(root.querySelector('[data-map-region-key="talk-feed"]')).toBe(feedBeforeIdChange);
      expect(talkFeed.scrollTop).toBe(1000 - 200);
      const updatedReceiptElement = root.querySelector<HTMLElement>('[data-map-recent-commit]');
      expect(updatedReceiptElement?.dataset.mapRecentCommit).toBe(nextRequestId);
      expect(updatedReceiptElement?.textContent).toBe(receiptText);
    } finally {
      viewSpy.mockRestore();
    }
  });

  test('labels downed Party members in the Revive target picker and completes the revive from Workspace', () => {
    const datapack = reviveExampleDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);

    // Let the first round's fast Enemy source down Serika without selecting the Ability.
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    expect(activeWorkspaceView(runId).run.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(0);

    const ability = root.querySelector<HTMLButtonElement>('[data-map-ability-draft][data-action-id="revive-serika"]');
    expect(ability).not.toBeNull();
    ability!.click();
    const target = root.querySelector<HTMLButtonElement>(
      '[data-map-ability-target][data-action-id="revive-serika"][data-target-character-id="serika"]',
    );
    expect(target?.textContent).toContain('（倒地）');
    target!.click();
    expect(activeWorkspaceView(runId).sourcePreview?.selectedAbilityTarget)
      .toEqual({ kind: 'partyCharacter', characterId: 'serika' });
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    const completed = activeWorkspaceView(runId);
    expect(completed.run.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(3);
    expect(completed.actionPreview?.recentCommit?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'revive', identity: { kind: 'partyCharacter', id: 'serika' }, beforeHp: 0, afterHp: 3,
    }));
  });

  test('edits real Enemy targets by unit click and card drag without Commit or replacing the three columns', async () => {
    const datapack = battleWorkspaceDatapack();
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const before = game!.mapRun.getSnapshot()!;
    const columns = [...root.querySelectorAll('[data-workspace-column]')];
    const scroll = root.querySelector<HTMLElement>('[data-map-region-key="talk-feed"]')!;
    const fullRenders = controller!.getRefreshStats().fullRenders;
    const edit = root.querySelector<HTMLButtonElement>('[data-map-party-member="shiroko"] [data-map-target-edit]')!;
    edit.click();
    const secondEnemy = root.querySelector<HTMLElement>('[data-map-region-key="enemy-face:wolf-2"]')!;
    expect(secondEnemy.dataset.mapRoleCandidate).toBe('候选');
    secondEnemy.click();
    await Promise.resolve();
    let current = game!.mapRun.getSnapshot()!;
    expect(current.activeEncounter!.targetSelections).toContainEqual({ characterId: 'shiroko', targetEnemyId: 'wolf-2' });
    expect(current.activeEncounter!.draftVersion).toBe(before.activeEncounter!.draftVersion + 1);
    expect(current.activeEncounter!.round).toBe(before.activeEncounter!.round);
    expect(current.activeEncounter!.randomState).toEqual(before.activeEncounter!.randomState);
    expect(current.playerCost).toBe(before.playerCost);

    const source = root.querySelector<HTMLElement>('[data-map-party-member="shiroko"] .map-workspace__unit-action-card')!;
    const firstEnemy = root.querySelector<HTMLElement>('[data-map-region-key="enemy-face:wolf"]')!;
    const hit = vi.spyOn(document, 'elementFromPoint').mockReturnValue(firstEnemy);
    source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0, clientX: 10, clientY: 10 }));
    root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: 100, clientY: 20 }));
    expect(firstEnemy.dataset.mapRoleRecipient).toBe('接收');
    expect(firstEnemy.dataset.mapRoleDrop).toBe('接收');
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: 100, clientY: 20 }));
    await Promise.resolve();
    current = game!.mapRun.getSnapshot()!;
    expect(current.activeEncounter!.targetSelections).toContainEqual({ characterId: 'shiroko', targetEnemyId: 'wolf' });
    expect(current.activeEncounter!.draftVersion).toBe(before.activeEncounter!.draftVersion + 2);
    expect(current.activeEncounter!.round).toBe(1);
    expect(current.activeEncounter!.lastCommit).toBeNull();
    expect([...root.querySelectorAll('[data-workspace-column]')]).toEqual(columns);
    expect(root.querySelector('[data-map-region-key="talk-feed"]')).toBe(scroll);
    expect(controller!.getRefreshStats().fullRenders).toBe(fullRenders);
    expect(root.querySelector('svg, .map-workspace__target-drag-preview')).toBeNull();

    hit.mockReturnValue(document.body);
    const beforeCancel = current;
    source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, button: 0 }));
    root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: 100 }));
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: 100 }));
    expect(game!.mapRun.getSnapshot()).toEqual(beforeCancel);
    hit.mockRestore();
  });

  test('shows unavailable Ability cost and Item inventory/condition without enabling their drafts', () => {
    const datapack = battleWorkspaceDatapack({ playerCost: 0 });
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const ability = root.querySelector<HTMLButtonElement>('[data-map-ability-draft]')!;
    const item = root.querySelector<HTMLButtonElement>('[data-map-item-draft]')!;
    expect(ability.disabled).toBe(true);
    expect(ability.textContent).toContain('PlayerCost 不足');
    expect(item.disabled).toBe(true);
    expect(item.textContent).toContain('库存 0');
    expect(item.textContent).toContain('条件未满足');
    expect(activeWorkspaceView(runId).sourcePreview).toMatchObject({
      abilityOptions: [expect.objectContaining({ canPayPlayerCost: false })],
      itemOptions: [expect.objectContaining({ canUse: false, inventoryCount: 0, useConditionSatisfied: false })],
    });
  });

  test('reports when an Item use condition changes after its draft was selected', () => {
    const datapack = battleWorkspaceDatapack({ emptyParty: true });
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const itemId = 'gameplay-b:item:workspace-kit';
    game!.mutations.setResource(Resource.Credit, 10);
    game!.mutations.addItem(itemId, 1, 3);
    const runId = enterEncounter(root, map);
    root.querySelector<HTMLButtonElement>('[data-map-item-draft]')!.click();
    root.querySelector<HTMLButtonElement>('[data-map-item-target][data-target-character-id="serika"]')!.click();

    game!.mutations.setResource(Resource.Credit, 0);
    controller!.requestMapWorkspaceRefresh(runId);
    const item = root.querySelector<HTMLButtonElement>('[data-map-item-draft]')!;
    expect(item.disabled).toBe(true);
    expect(item.textContent).toContain('条件未满足');
    const commit = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
    expect(commit.disabled).toBe(false);
    commit.click();
    expect(document.querySelector('#toast-stack')?.textContent).toContain('道具条件或库存已变化，请重新检查');
  });

  test('explains combined Ability and PlayerCommand PlayerCost and lets the player clear Ability', () => {
    const datapack = battleWorkspaceDatapack({ playerCost: 1 });
    const { root } = mount(datapack);
    const runId = enterEncounter(root, mapFixture(datapack));
    const preview = activeWorkspaceView(runId).actionPreview!;
    const command = preview.playerCommandOptions.find(option => option.characterId === 'shiroko');
    expect(command).toBeDefined();
    if (!command) throw new Error('No hand-out PlayerCommand candidate is available');
    root.querySelector<HTMLButtonElement>(`[data-map-player-command][data-character-id="shiroko"][data-action-id="${command.action.actionId}"]`)!.click();
    root.querySelector<HTMLButtonElement>('[data-map-target-enemy][data-character-id="shiroko"][data-target-enemy-id="wolf"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-map-target-enemy][data-character-id="serika"][data-target-enemy-id="wolf-2"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-map-ability-draft]')!.click();
    root.querySelector<HTMLButtonElement>('[data-map-ability-target][data-target-enemy-id="wolf"]')!.click();

    const current = activeWorkspaceView(runId).actionPreview!;
    expect(current.commitPreview.canCommit).toBe(false);
    expect(root.querySelector('[data-map-commit-status]')?.textContent)
      .toContain('本轮总 PlayerCost 不足，请清除 Ability 或 PlayerCommand');
    root.querySelector<HTMLButtonElement>('[data-map-ability-clear]')!.click();
    expect(activeWorkspaceView(runId).sourcePreview?.selectedAbilityActionId).toBeNull();
    expect(activeWorkspaceView(runId).actionPreview?.commitPreview.canCommit).toBe(true);
  });

  test('renders defeat as a read-only three-column result and returns to the game on request', () => {
    const datapack = battleWorkspaceDatapack({ partyHp: 1, enemyDamage: 2, emptyParty: true });
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    const commit = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
    expect(commit.disabled).toBe(false);
    commit.focus();
    commit.click();

    const failure = game!.mapRun.getWorkspaceView(runId);
    expect(failure).toMatchObject({ kind: 'failure', result: { outcome: 'failure', reason: 'partyDefeated' } });
    expect(root.querySelector('[data-workspace-frame="map"]')).not.toBeNull();
    expectSharedMapTopbar(root.querySelector('[data-workspace-frame="map"]')!);
    expect(root.querySelectorAll('.workspace-column')).toHaveLength(3);
    expect(root.querySelector('[data-map-run-result="failure"]')?.textContent).toContain('探索失败');
    expect(root.querySelector('[data-map-encounter-state="failure"]')).not.toBeNull();
    expect(root.querySelector('[data-map-commit], [data-map-ability-draft], [data-map-item-draft], [data-map-complete-encounter]')).toBeNull();
    expect(root.querySelector('[data-map-run-result="failure"] [data-map-focus-heading]')).toBe(document.activeElement);
    expect(root.querySelector('[data-map-back]')?.textContent).toContain('返回游戏');

    root.querySelector<HTMLButtonElement>('[data-map-back]')!.click();
    expect(controller!.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(root.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
  });

  test('reports illegal targets and stale Commit tokens without changing the MapRun', () => {
    const datapack = actionWorkspaceDatapack();
    const { root } = mount(datapack);
    const map = mapFixture(datapack);
    const runId = enterEncounter(root, map);
    const targetButton = root.querySelector<HTMLButtonElement>('[data-map-target][data-character-id="shiroko"]')!;
    const beforeIllegalTarget = game!.mapRun.getSnapshot();
    targetButton.dataset.targetCharacterId = 'not-a-party-member';
    targetButton.click();
    expect(game!.mapRun.getSnapshot()).toEqual(beforeIllegalTarget);
    expect(document.querySelector('#toast-stack')?.textContent).toContain('目标已失效');

    for (const characterId of ['shiroko', 'serika']) {
      const view = activeWorkspaceView(runId);
      const member = view.actionPreview!.preparedActions.find(candidate => candidate.characterId === characterId)!;
      const targetCharacterId = member.legalTargetCharacterIds[0]!;
      root.querySelector<HTMLButtonElement>(
        `[data-map-target][data-character-id="${characterId}"][data-target-character-id="${targetCharacterId}"]`,
      )!.click();
    }
    const ready = activeWorkspaceView(runId).actionPreview!;
    expect(ready.commitPreview.canCommit).toBe(true);
    const commitButton = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
    commitButton.dataset.mapDraftVersion = String(ready.draft.draftVersion - 1);
    const beforeStaleCommit = game!.mapRun.getSnapshot();
    commitButton.click();
    expect(game!.mapRun.getSnapshot()).toEqual(beforeStaleCommit);
    expect(document.querySelector('#toast-stack')?.textContent).toContain('行动状态已更新');
  });

  test('renders only the minimal terminal result without reconstructing map progress', () => {
    const { root } = mount();
    const map = mapFixture();
    const exitNode = map.nodes.find(node => map.exitNodeIds.includes(node.id));
    expect(exitNode).toBeDefined();
    if (!exitNode) throw new Error('Sample Map has no exit Node');
    const runId = 'map-run-result-only';
    const terminalResultView = {
      kind: 'success' as const,
      result: {
        runId,
        mapId: map.id,
        outcome: 'success' as const,
        exitNodeId: exitNode.id,
        mapName: map.name,
        exitNodeTitle: exitNode.title,
      },
    };

    root.innerHTML = renderMapWorkspace(createUIContext(game!), runId, terminalResultView);
    expectSharedMapTopbar(root.querySelector('[data-workspace-frame="map"]')!);

    const result = root.querySelector('[data-map-run-result="success"]');
    expect(result?.textContent).toContain('地图路线已完成');
    expect(result?.textContent).toContain(`出口地点 ${exitNode.title}`);
    expect(root.textContent).toContain(map.name);
    expect(root.querySelector('[data-map-node-id]')).toBeNull();
    expect(root.querySelector('[data-map-region-key^="feed-node:"]')).toBeNull();
    expect(root.querySelector('[data-map-location-node-id]')).toBeNull();
    expect(root.querySelector('[data-map-complete-encounter]')).toBeNull();
    expect(root.querySelector('[data-map-encounter-state="completed"]')).toBeNull();
    expect(root.querySelector('[data-map-back]')).not.toBeNull();
  });

  test('renders the shared three panel tab hosts when a Map route is unavailable', () => {
    const { mapId } = mount();
    const template = document.createElement('template');
    template.innerHTML = renderMapWorkspace(createUIContext(game!), `missing:${mapId}`, null);
    const frame = template.content.querySelector('[data-workspace-frame="map"]');
    expect(frame).not.toBeNull();
    expectSharedMapTopbar(frame!);
  });

});
