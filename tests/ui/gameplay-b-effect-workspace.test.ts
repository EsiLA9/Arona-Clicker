// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createGameCommands } from '../../src/arona-clicker/runtime/runtime-commands';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import type { MapRunActiveWorkspaceView, MapWorkspaceActionView } from '../../src/arona-clicker/contracts/runtime/runtime';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { renderMapWorkspace } from '../../src/ui/components/map/map-workspace';
import type { UIContext } from '../../src/ui/runtime/context';

const ctx = {
  escapeHtml: (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!)),
  formatNumber: String,
  nameOf: (_type: string, id: string) => id,
  game: { pics: { urlOf: () => undefined } },
  presentation: { hasHost: () => false, host: () => ({ layers: [] }) },
  backgroundForHost: () => ({ layers: [] }),
  presentationHostState: () => ({ background: { layers: [] }, ink: null, textColorMode: 'auto', source: 'auto' }),
  textColorModeForHost: () => 'auto',
  hoverTextColorModeForHost: () => 'auto',
} as unknown as UIContext;

const condition = { kind: 'counter', counterId: 'charges', comparison: 'gte', value: 3 } as const;
const scope = { runId: 'run-1', mapId: 'map-1', nodeId: 'node-a', activityId: 'battle', round: 1 } as const;
const declarations: MapWorkspaceActionView['declaredEffects'] = [
  { declaration: 'declared', certainty: 'unconditional', path: 'damage.path', branches: [], kind: 'damage', target: 'primary', amount: 3, recipient: { scope, kind: 'enemy', id: 'robot' } },
  { declaration: 'declared', certainty: 'unconditional', path: 'area.path', branches: [], kind: 'damage', target: 'set', set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 3 }, amount: { kind: 'missingHp', unit: 'target' }, repeat: 2, recipient: null },
  { declaration: 'declared', certainty: 'unconditional', path: 'heal.path', branches: [], kind: 'heal', target: 'primary', amount: 2, recipient: { scope, kind: 'partyCharacter', id: 'shiroko' } },
  { declaration: 'declared', certainty: 'conditional', path: 'hidden.path', branches: [{ whenPath: 'when', conditionPath: 'when.condition', branch: 'then', condition }], kind: 'counter', counterId: 'charges', delta: 1, recipient: null },
  { declaration: 'declared', certainty: 'conditional', path: 'hidden.path', branches: [{ whenPath: 'when', conditionPath: 'when.condition', branch: 'else', condition }], kind: 'flag', flagId: 'ready', value: false, recipient: null },
];
const trace = [
  { sourceKey: 'ability', actionId: 'u16-action', path: 'area.path', op: 'targetSet', source: { kind: 'ability', actionId: 'u16-action' }, mode: 'program', selection: 'set', selector: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 3 }, identities: [{ kind: 'enemy', id: 'robot' }], repeatCount: 2 },
  { sourceKey: 'ability', actionId: 'u16-action', path: 'hidden.path', op: 'when', source: { kind: 'ability', actionId: 'u16-action' }, mode: 'program', result: true, reads: [] },
  { sourceKey: 'ability', actionId: 'u16-action', path: 'hidden.path', op: 'counterAdd', source: { kind: 'ability', actionId: 'u16-action' }, mode: 'program', counterId: 'charges', before: 3, after: 3, delta: 0 },
  { sourceKey: 'ability', actionId: 'u16-action', path: 'hidden.path', op: 'flagSet', source: { kind: 'ability', actionId: 'u16-action' }, mode: 'program', flagId: 'ready', before: false, after: true },
  { sourceKey: 'ability', actionId: 'u16-action', path: 'hidden.path', op: 'hpChange', source: { kind: 'ability', actionId: 'u16-action' }, mode: 'program', identity: { kind: 'partyCharacter', id: 'shiroko' }, delta: 0, before: 10, after: 10 },
  { sourceKey: 'ability', actionId: 'u16-action', path: 'damage.path', op: 'damage', source: { kind: 'ability', actionId: 'u16-action' }, mode: 'program', identity: { kind: 'enemy', id: 'robot' }, amount: 3, delta: 0, before: 0, after: 0 },
  { sourceKey: 'ability', actionId: 'u16-action', path: 'heal.path', op: 'heal', source: { kind: 'ability', actionId: 'u16-action' }, mode: 'program', identity: { kind: 'partyCharacter', id: 'shiroko' }, amount: 2, delta: 2, before: 10, after: 12 },
] as const;

function workspace(current: { readonly charges: number; readonly ready: boolean }, canCommit = true): MapRunActiveWorkspaceView {
  const action = { actionId: 'u16-action', name: '局部状态演练', targetKind: 'enemy', costs: [], declaredEffects: declarations };
  const activity = { activityId: 'battle', title: '战斗', kind: 'battle', index: 0, total: 1, active: true, completed: false };
  return {
    kind: 'active', cards: [], relations: [],
    run: { runId: 'run-1', mapId: 'map-1', party: [], partyHp: [], lastEncounterCommit: null, playerCost: 1, commitVersion: 1,
      actorResources: [], teamResources: [], status: 'inProgress', currentNodeId: 'node-a', visitedNodeIds: ['node-a'],
      completedEncounterNodeIds: [], completedActivityIds: [], activeActivity: { nodeId: 'node-a', activityId: 'battle', kind: 'battle' },
      activeEncounter: null, activeEncounterNodeId: 'node-a' },
    map: { id: 'map-1', name: '地图', startNodeId: 'node-a', exitNodeIds: [], nodes: [{ id: 'node-a', title: '地点', hasEncounter: true }], edges: [] },
    currentEncounter: { mapId: 'map-1', nodeId: 'node-a', title: '遭遇', partyHp: [], enemies: [], completion: {
      kind: 'condition', label: '达到4次', condition: { ...condition, value: 4 },
      locals: { counters: { charges: { value: current.charges, min: 0, max: 3 } }, flags: { ready: current.ready } },
    } },
    activities: [activity], shop: null,
    actionPreview: { nodeId: 'node-a', round: 1, draft: { nodeId: 'node-a', round: 1, draftVersion: 1 }, overrides: [],
      preparedActions: [], preparedEnemyActions: [], playerCommandOptions: [],
      commitPreview: { canCommit, playerCostRequired: 1, diagnostics: canCommit ? [] : ['target selection required'], settlements: [], enemyActions: [], effectTrace: trace },
      recentCommit: null },
    sourcePreview: { nodeId: 'node-a', round: 1, draftVersion: 1,
      abilityOptions: [{ ...action, description: null, targetKind: 'enemy', legalTargetCharacterIds: [], legalTargetEnemyIds: [], canPayPlayerCost: true, selected: false }],
      itemOptions: [], selectedAbilityActionId: null, selectedItemId: null, selectedAbilityTarget: null, selectedItemTarget: null },
  } as unknown as MapRunActiveWorkspaceView;
}

function render(view: MapRunActiveWorkspaceView): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = renderMapWorkspace(ctx, 'run-1', view);
  return root;
}

describe('Gameplay B E1/E2 Workspace', () => {
  it('shows declarations, current locals, Owner Preview deltas, refreshed progress and diagnostics', () => {
    const before = workspace({ charges: 3, ready: false });
    const root = render(before);
    const declaration = root.querySelector('[data-map-ability-draft]')?.textContent ?? '';
    expect(declaration).toContain('声明：');
    expect(declaration).toContain('Counter charges');
    expect(declaration).toContain('Flag ready');
    expect(declaration).toContain('robot 受到 3 点伤害');
    expect(declaration).toContain('敌方存活单位（按 HP 比例升序），最多 3 名 受到 按公式计算 点伤害，每个目标 2 次');
    expect(declaration).toContain('shiroko 恢复 2 点 HP');
    expect(declaration).not.toContain('hidden.path');
    expect(root.querySelector('[data-map-region-key="activity-progress"]')?.textContent).toContain('当前值 3');
    expect(root.querySelector('[data-map-region-key="activity-progress"]')?.textContent).toContain('当前值 否');
    expect(root.querySelector('[aria-label="Owner 预览结果"]')?.textContent).toContain('条件成立');
    expect(root.querySelector('[aria-label="Owner 预览结果"]')?.textContent).toContain('解析目标集合：1 名，重复 2 次');
    expect(root.querySelector('[aria-label="Owner 预览结果"]')?.textContent).toContain('Counter charges 3 → 3（变化 0）');
    expect(root.querySelector('[aria-label="Owner 预览结果"]')?.textContent).toContain('Flag ready 否 → 是');
    expect(root.querySelector('[aria-label="Owner 预览结果"]')?.textContent).toContain('HP 0');
    expect(root.querySelector('[aria-label="Owner 预览结果"]')?.textContent).toContain('受到 3 点伤害（实际 HP 变化 0）');
    expect(root.querySelector('[aria-label="Owner 预览结果"]')?.textContent).toContain('恢复 2 点 HP（实际 HP 变化 +2）');
    const snapshot = JSON.stringify(before);
    root.querySelector<HTMLElement>('[data-map-ability-draft]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    render(before);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(render(workspace({ charges: 3, ready: true })).querySelector('[data-map-region-key="activity-progress"]')?.textContent).toContain('当前值 是');
    const failed = render(workspace({ charges: 3, ready: false }, false));
    expect(failed.querySelector('[data-map-commit-status]')?.textContent).toContain('请为所有需要目标的行动选择对象');
    expect(failed.querySelector('[aria-label="Owner 预览结果"]')).toBeNull();
  });

  it('projects and deeply freezes AG-1 Status Remove Receipt v2 on RecentCommit', () => {
    const statusMap: GameplayMapDef = {
      id: 'test:map:workspace-status-remove', name: 'Status Remove Workspace', resumeVersion: 1,
      executionContractId: 'AG-1', startNodeId: 'start', exitNodeIds: ['exit'],
      partyCharacterIds: ['shiroko', 'serika'],
      initialPartyHp: [
        { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
        { characterId: 'serika', initialHp: 10, maxHp: 10 },
      ],
      initialPlayerCost: 1,
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2 }],
      actions: [{ id: 'apply-remove', name: 'Apply and Remove', eligibleCharacterIds: ['shiroko'],
        target: { kind: 'enemy' },
        effectProgram: { resolve: [
          { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 },
          { op: 'statusRemove', target: 'primary', statusId: 'burn' },
        ] } }],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 10, maxHp: 10 },
        ], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'apply-remove', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
    };
    const datapack = { ...gameplayBMapDatapack, maps: [...(gameplayBMapDatapack.maps ?? []), statusMap] };
    const game = new GameInstance();
    try {
      game.init([baseDatapack, datapack], { enterDefaultInit: false });
      for (const proto of ['shiroko', 'serika']) {
        const variant = game.rosterSystem.getAllVariants().find(row => row.proto === proto);
        if (!variant) throw new Error(`Base party Variant ${proto} is missing`);
        game.mutations.acquireCharacter(variant.id, 'story');
      }
      const started = game.startMap(statusMap.id);
      game.moveMap(started.runId, 'battle');
      const before = game.mapRun.getSnapshot()!;
      const encounter = before.activeEncounter!;
      createGameCommands(game).commitMapEncounterRound({
        runId: started.runId,
        requestId: 'workspace-status-remove',
        expectedCommitVersion: before.commitVersion,
        draft: { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion },
      });

      const view = game.mapRun.getWorkspaceView(started.runId) as MapRunActiveWorkspaceView;
      const preview = view.actionPreview?.commitPreview;
      const receipt = view.actionPreview?.recentCommit;
      expect(preview?.programReceiptVersion).toBe(1);
      expect(receipt?.programReceiptVersion).toBe(1);
      expect(preview?.statusReceiptVersion).toBe(2);
      expect(receipt).toMatchObject({
        statusReceiptVersion: 2,
        statusRemoveTrace: [{ statusId: 'burn', identity: { kind: 'enemy', id: 'e1' }, removed: [{
          statusIndexBefore: 0,
          status: { holder: { kind: 'enemy', id: 'e1' }, statusId: 'burn', actionId: 'apply-remove' },
        }] }],
      });
      const trace = receipt?.statusRemoveTrace?.[0];
      expect(trace).toBeDefined();
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(Object.isFrozen(receipt?.statusRemoveTrace)).toBe(true);
      expect(Object.isFrozen(trace)).toBe(true);
      expect(Object.isFrozen(trace?.identity)).toBe(true);
      expect(Object.isFrozen(trace?.removed)).toBe(true);
      expect(Object.isFrozen(trace?.removed[0])).toBe(true);
      expect(Object.isFrozen(trace?.removed[0]?.status)).toBe(true);
      expect(Object.isFrozen(trace?.removed[0]?.status.holder)).toBe(true);
      expect(Object.isFrozen(trace?.removed[0]?.status.source)).toBe(true);
    } finally {
      game.dispose();
    }
  });

  it('projects Program Receipt v2 modifier CardRefs and per-hit amount evidence as deeply frozen read-only data', () => {
    const modifierMap: GameplayMapDef = {
      id: 'test:map:workspace-card-modifier', name: 'Card Modifier Workspace', resumeVersion: 6,
      executionContractId: 'AG-1', startNodeId: 'start', exitNodeIds: ['exit'],
      partyCharacterIds: ['shiroko', 'serika'],
      initialPartyHp: [
        { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
        { characterId: 'serika', initialHp: 10, maxHp: 10 },
      ],
      initialPlayerCost: 1,
      actions: [
        { id: 'boost', name: 'Boost', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'card', side: 'ally' }, effectProgram: { resolve: [
            { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 },
          ] } },
        { id: 'heal', name: 'Heal', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [
            { op: 'heal', target: 'primary', amount: 3 },
          ] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 10, maxHp: 10 },
        ], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'boost', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'heal', tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
    };
    const datapack = { ...gameplayBMapDatapack, maps: [...(gameplayBMapDatapack.maps ?? []), modifierMap] };
    const game = new GameInstance();
    try {
      game.init([baseDatapack, datapack], { enterDefaultInit: false });
      for (const proto of ['shiroko', 'serika']) {
        const variant = game.rosterSystem.getAllVariants().find(row => row.proto === proto);
        if (!variant) throw new Error(`Base party Variant ${proto} is missing`);
        game.mutations.acquireCharacter(variant.id, 'story');
      }
      const started = game.startMap(modifierMap.id);
      game.moveMap(started.runId, 'battle');
      const before = game.mapRun.getSnapshot()!;
      const encounter = before.activeEncounter!;
      const target = game.mapRun.getCards(started.runId).find(card => card.owner.kind === 'partyCharacter'
        && card.owner.id === 'serika' && card.actionId === 'heal')?.ref;
      if (!target) throw new Error('Expected the selected target CardRef');
      game.setMapPreparedCardTarget(started.runId, 'shiroko', target,
        { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion });

      const preview = game.mapRun.getWorkspaceView(started.runId) as MapRunActiveWorkspaceView;
      expect(preview.actionPreview?.commitPreview.programReceiptVersion).toBe(2);
      const preparedModifier = preview.actionPreview?.preparedActions.find(row => row.characterId === 'shiroko');
      expect(preparedModifier?.cardEffectModifierPreviews).toEqual([{ targetCardRef: target, op: 'heal', delta: 2 }]);
      expect(Object.isFrozen(preparedModifier?.cardEffectModifierPreviews)).toBe(true);
      expect(Object.isFrozen(preparedModifier?.cardEffectModifierPreviews?.[0]?.targetCardRef.scope)).toBe(true);
      expect(preview.actionPreview?.commitPreview.effectTrace).toContainEqual(expect.objectContaining({ op: 'cardEffectModifier', delta: 2 }));
      const preTrace = preview.actionPreview?.commitPreview.effectTrace?.find(row => row.op === 'cardEffectModifier');
      expect(preTrace && Object.isFrozen(preTrace)).toBe(true);

      createGameCommands(game).commitMapEncounterRound({
        runId: started.runId,
        requestId: 'workspace-card-modifier',
        expectedCommitVersion: game.mapRun.getSnapshot()!.commitVersion,
        draft: { nodeId: encounter.nodeId, round: encounter.round, draftVersion: game.mapRun.getSnapshot()!.activeEncounter!.draftVersion },
      });
      const view = game.mapRun.getWorkspaceView(started.runId) as MapRunActiveWorkspaceView;
      const receipt = view.actionPreview?.recentCommit;
      expect(receipt).toMatchObject({ programReceiptVersion: 2, cardEffectModifierReceipts: [{
        sourceOwnerId: 'shiroko', targetOwnerId: 'serika', targetCardRef: target, delta: 2, outcome: 'applied', hits: [{
          op: 'heal', requestedAmount: 3, modifierDelta: 2, modifiedRequestedAmount: 5,
        }],
      }] });
      const modifier = receipt?.cardEffectModifierReceipts?.[0];
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(Object.isFrozen(receipt?.cardEffectModifierReceipts)).toBe(true);
      expect(Object.isFrozen(modifier)).toBe(true);
      expect(Object.isFrozen(modifier?.sourceCardRef)).toBe(true);
      expect(Object.isFrozen(modifier?.sourceCardRef.scope)).toBe(true);
      expect(Object.isFrozen(modifier?.targetCardRef)).toBe(true);
      expect(Object.isFrozen(modifier?.targetCardRef.scope)).toBe(true);
      expect(Object.isFrozen(modifier?.hits)).toBe(true);
      expect(Object.isFrozen(modifier?.hits[0])).toBe(true);
      expect(Object.isFrozen(modifier?.hits[0]?.identity)).toBe(true);
      expect(receipt?.effectTrace?.some(row => row.op === 'heal' && row.amount === 5)).toBe(true);
    } finally {
      game.dispose();
    }
  });
});
