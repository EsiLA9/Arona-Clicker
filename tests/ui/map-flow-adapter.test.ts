// ============================================================
// tests/ui/map-flow-adapter.test.ts — Map View → Flow 适配与按 Run 隔离的流
// 覆盖：基线顺序 / 快照刷新不重排 / requestId 幂等 / 观察条目 / dispose
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  MapFlowModel,
  type MapFlowTextPort,
} from '../../src/ui/flow/map-flow-model';
import type {
  MapRunActiveWorkspaceView,
  MapRunFailureWorkspaceView,
  MapRunSuccessWorkspaceView,
  MapRunWorkspaceView,
} from '../../src/arona-clicker/contracts/runtime/runtime';
import type {
  MapEffectShieldTraceEntry,
  MapEffectStatusCategoryRemoveTraceEntry,
  MapEffectStatusConsumeTraceEntry,
  MapEffectStatusExpiryTriggerTraceEntry,
  MapEffectTraceEntry,
  MapEffectTriggerTraceEntry,
} from '../../src/arona-clicker/contracts/map/map-effects';
import type { MapRunEncounterCommitReceipt, MapRunEncounterExecutionSequenceEntry } from '../../src/arona-clicker/contracts/map/map-run';

const port: MapFlowTextPort = {
  nameOf: (type, id) => `${type}:${id}`,
  formatNumber: value => String(value),
};

interface ActivePatch {
  readonly run?: Record<string, unknown>;
  readonly currentNodeId?: string;
  readonly encounter?: { readonly enemyHp?: number } | null;
  readonly commit?: { readonly requestId: string; readonly round: number; readonly nodeId?: string } | null;
  readonly shop?: { readonly lastPurchase: string | null } | null;
}

/** 只填适配器实际读取的字段，其余用例不依赖完整 View。 */
function activeView(patch: ActivePatch = {}): MapRunActiveWorkspaceView {
  const currentNodeId = patch.currentNodeId ?? 'node-a';
  const encounter = patch.encounter === null ? null : patch.encounter ? {
    mapId: 'map-1',
    nodeId: currentNodeId,
    title: '遭遇标题',
    description: '遭遇说明',
    partyHp: [],
    enemies: [{ enemyId: 'robot', currentHp: patch.encounter.enemyHp ?? 6, maxHp: 6 }],
  } : null;
  const commit = patch.commit === null ? null : patch.commit ? {
    requestId: patch.commit.requestId,
    nodeId: patch.commit.nodeId ?? currentNodeId,
    round: patch.commit.round,
    settlements: [{
      characterId: 'shiroko',
      action: { name: '攻击' },
      targetCharacterId: null,
      targetEnemyId: 'robot',
      overrideKind: null,
      playerCostSpent: 0,
      resourceChanges: [],
      hpChanges: [{ scope: 'enemy', enemyId: 'robot', delta: -2 }],
    }],
    ability: null,
    item: null,
    enemyActions: [{
      enemyId: 'robot', action: { name: '反击' }, targetCharacterId: 'shiroko', targetEnemyId: null,
      resourceChanges: [], hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -1 }],
    }],
  } : null;
  return {
    kind: 'active',
    run: {
      runId: 'run-1',
      mapId: 'map-1',
      party: [],
      partyHp: [],
      lastEncounterCommit: null,
      playerCost: 3,
      commitVersion: 0,
      actorResources: [],
      teamResources: [],
      status: 'inProgress',
      currentNodeId,
      visitedNodeIds: [currentNodeId],
      completedEncounterNodeIds: [],
      completedActivityIds: [],
      activeActivity: null,
      activeEncounter: null,
      activeEncounterNodeId: encounter ? currentNodeId : null,
      ...patch.run,
    },
    map: {
      id: 'map-1',
      name: '测试地图',
      startNodeId: 'node-a',
      exitNodeIds: [],
      nodes: [
        { id: 'node-a', title: '地点 A', description: 'A 的说明', hasEncounter: false },
        { id: 'node-b', title: '地点 B', description: 'B 的说明', hasEncounter: true },
      ],
      edges: [],
    },
    currentEncounter: encounter,
    activities: [],
    shop: patch.shop === undefined ? null : patch.shop && {
      nodeId: currentNodeId,
      activityId: 'shop-1',
      title: '测试商店',
      draftVersion: 1,
      offers: [{ offerId: 'spare-parts', name: '备用零件', costs: [], effects: [], heal: null, canPurchase: true }],
      lastPurchase: { offerId: 'spare-parts', requestId: patch.shop.lastPurchase ?? '' },
    },
    actionPreview: commit ? { nodeId: currentNodeId, round: 1, draft: {}, overrides: [], preparedActions: [], preparedEnemyActions: [], playerCommandOptions: [], commitPreview: { canCommit: true, playerCostRequired: 0, diagnostics: [], enemyActions: [] }, recentCommit: commit } : null,
    sourcePreview: null,
  } as unknown as MapRunActiveWorkspaceView;
}

function keys(model: MapFlowModel): string[] {
  return model.snapshot.map(entry => entry.instanceKey);
}

describe('Map Flow Adapter', () => {
  it('shows Shield grants and per-hit absorption from the latest Commit projection or saved receipt', () => {
    const base = activeView({ commit: { requestId: 'shield-commit', round: 2 } });
    const shieldTrace: readonly MapEffectShieldTraceEntry[] = [
      {
        sourceKey: 'ability:shiroko:grant', actionId: 'grant', path: 'actions.grant.resolve.0',
        op: 'shieldAdd', source: { kind: 'ability', actionId: 'grant' }, mode: 'program',
        identity: { kind: 'partyCharacter', id: 'shiroko' },
        requestedAmount: 3, shieldBefore: 0, added: 3, shieldAfter: 3, outcome: 'applied',
      },
      {
        sourceKey: 'enemy:robot:counter', actionId: 'counter', path: 'actions.counter.resolve.0',
        op: 'damage', source: { kind: 'enemy', id: 'robot' }, mode: 'program',
        identity: { kind: 'partyCharacter', id: 'shiroko' },
        requestedAmount: 3, shieldBefore: 2, absorbed: 2, shieldAfter: 0,
        remainingDamage: 1, hpBefore: 5, hpAfter: 4,
      },
    ];
    const projected = {
      ...base.actionPreview!.recentCommit!,
      shieldTrace,
    } as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const active = {
      ...base,
      actionPreview: { ...base.actionPreview!, recentCommit: projected },
    } as MapRunActiveWorkspaceView;
    const saved = {
      ...base,
      actionPreview: null,
      run: { ...base.run, lastEncounterCommit: projected as unknown as MapRunEncounterCommitReceipt },
    } as MapRunActiveWorkspaceView;

    for (const view of [active, saved]) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:shield-commit')!.lines ?? [];
      expect(lines).toContain('Ability · action:grant → character:shiroko：获得 Shield 3（Shield 0 → 3）');
      expect(lines).toContain('敌方 enemy:robot · action:counter → character:shiroko：伤害 3 · Shield 吸收 2 · 剩余伤害 1（Shield 2 → 0，HP 5 → 4）');
    }
  });

  it('explains damage reduction sources before the existing Shield absorption and HP result', () => {
    const base = activeView({ commit: { requestId: 'damage-reduction-flow', round: 2 } });
    const effectTrace = [{
      sourceKey: 'enemy:robot:attack', actionId: 'attack', path: 'actions.attack.resolve.0',
      op: 'damage', source: { kind: 'enemy', id: 'robot' }, mode: 'program',
      identity: { kind: 'partyCharacter', id: 'shiroko' }, amount: 3, requestedAmount: 6,
      modifierDelta: -1, modifiedRequestedAmount: 5,
      before: 5, after: 3, delta: -2,
      damageReduction: {
        total: 2,
        sources: [{ statusId: 'ward', source: { kind: 'partyCharacter', id: 'serika' }, actionId: 'guard',
          stacks: 1, damageReductionPerStack: 2, reducedAmount: 2 }],
      },
    }] as unknown as MapEffectTraceEntry[];
    const shieldTrace: readonly MapEffectShieldTraceEntry[] = [{
      sourceKey: 'enemy:robot:attack', actionId: 'attack', path: 'actions.attack.resolve.0', op: 'damage',
      source: { kind: 'enemy', id: 'robot' }, mode: 'program',
      identity: { kind: 'partyCharacter', id: 'shiroko' }, requestedAmount: 3,
      shieldBefore: 1, absorbed: 1, shieldAfter: 0, remainingDamage: 2, hpBefore: 5, hpAfter: 3,
    }];
    const projected = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence: [], effectTrace, shieldTrace,
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const saved = { ...projected, requestId: 'damage-reduction-flow' } as unknown as MapRunEncounterCommitReceipt;
    const views = [
      { ...base, actionPreview: { ...base.actionPreview!, recentCommit: projected } } as MapRunActiveWorkspaceView,
      { ...base, actionPreview: null, run: { ...base.run, lastEncounterCommit: saved } } as MapRunActiveWorkspaceView,
    ];
    for (const view of views) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:damage-reduction-flow')!.lines ?? [];
      expect(lines).toContain('敌方 enemy:robot：action:attack → character:shiroko：原始伤害请求 6 · Modifier 后 5 · 防御 Status 减免 2（Status ward（character:serika · action:guard · 1层 × 2，减免 2））');
      expect(lines).toContain('敌方 enemy:robot · action:attack → character:shiroko：伤害 3 · Shield 吸收 1 · 剩余伤害 2（Shield 1 → 0，HP 5 → 3）');
    }
  });

  it('shows one-time damage protection provenance, stack consumption, and prevented hit outcome', () => {
    const base = activeView({ commit: { requestId: 'damage-protection-flow', round: 2 } });
    const effectTrace = [{
      sourceKey: 'enemy:robot:attack', actionId: 'attack', path: 'actions.attack.resolve.0',
      op: 'damage', source: { kind: 'enemy', id: 'robot' }, mode: 'program',
      identity: { kind: 'partyCharacter', id: 'shiroko' }, amount: 0, requestedAmount: 5,
      before: 5, after: 5, delta: 0,
      damageProtection: {
        statusIndexBefore: 0, requestedAmount: 5, blockedAmount: 5,
        statusBefore: {
          holder: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'aegis',
          source: { kind: 'partyCharacter', id: 'serika' }, actionId: 'guard',
          appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
        },
        statusAfter: null,
      },
    }] as unknown as MapEffectTraceEntry[];
    const projected = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence: [], effectTrace,
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const view = {
      ...base,
      actionPreview: { ...base.actionPreview!, recentCommit: projected },
    } as MapRunActiveWorkspaceView;
    const model = new MapFlowModel('run-1', port);
    model.sync(view);
    const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:damage-protection-flow')!.lines ?? [];
    expect(lines).toContain('敌方 enemy:robot：action:attack → character:shiroko：Status aegis（character:serika · action:guard）层数 1 → 0层 · 拦截伤害 5；HP 不变；Shield 未消耗');
    expect(lines.filter(line => line.includes('Status aegis'))).toHaveLength(1);
  });

  it('shows mixed healApplied and damageApplied resource feedback in queue order', () => {
    const base = activeView({ commit: { requestId: 'heal-trigger-flow', round: 2 } });
    const executionSequence = [
      {
        executionIndex: 0, sourceKey: 'party:shiroko', sourceKind: 'partyAction',
        owner: { kind: 'partyCharacter', id: 'shiroko' }, actionId: 'heal-serika', cardRef: null,
        baseAgility: 1, actorAgility: 0, finalAgility: 1, sideRank: 0, sourceRank: 0,
        ownerDeclarationIndex: 0, logicalIndex: 0,
        target: { kind: 'partyCharacter', characterId: 'serika' }, additionalTarget: null,
        skipReason: null, playerCostSpent: 0, itemConsumed: false, resourceChanges: [],
        hpChanges: [{ scope: 'party', characterId: 'serika', delta: 1 }],
      },
      {
        executionIndex: 1, sourceKey: 'enemy:robot', sourceKind: 'enemyAction',
        owner: { kind: 'enemy', id: 'robot' }, actionId: 'enemy-hit', cardRef: null,
        baseAgility: 0, actorAgility: 0, finalAgility: 0, sideRank: 1, sourceRank: 0,
        ownerDeclarationIndex: 0, logicalIndex: 0,
        target: { kind: 'partyCharacter', characterId: 'serika' }, additionalTarget: null,
        skipReason: null, playerCostSpent: 0, itemConsumed: false, resourceChanges: [],
        hpChanges: [{ scope: 'party', characterId: 'serika', delta: -1 }],
      },
      {
        executionIndex: 2, sourceKey: 'ability:heal-shiroko', sourceKind: 'ability', owner: null,
        actionId: 'heal-shiroko', cardRef: null,
        baseAgility: 0, actorAgility: 0, finalAgility: 0, sideRank: 0, sourceRank: 1,
        ownerDeclarationIndex: 0, logicalIndex: 0,
        target: { kind: 'partyCharacter', characterId: 'shiroko' }, additionalTarget: null,
        skipReason: null, playerCostSpent: 1, itemConsumed: false, resourceChanges: [],
        hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: 2 }],
      },
      {
        executionIndex: 3, sourceKey: 'party:shiroko', sourceKind: 'partyAction',
        owner: { kind: 'partyCharacter', id: 'shiroko' }, actionId: 'finish-training-target', cardRef: null,
        baseAgility: 20, actorAgility: 0, finalAgility: 20, sideRank: 0, sourceRank: 0,
        ownerDeclarationIndex: 1, logicalIndex: 1,
        target: { kind: 'enemy', enemyId: 'training-target' }, additionalTarget: null,
        skipReason: null, playerCostSpent: 0, itemConsumed: false, resourceChanges: [],
        hpChanges: [{ scope: 'enemy', enemyId: 'training-target', delta: -3 }],
      },
    ] as unknown as readonly MapRunEncounterExecutionSequenceEntry[];
    const triggerTrace: readonly MapEffectTriggerTraceEntry[] = [
      {
        queueIndex: 1, event: 'healApplied', triggerId: 'favor-back', parentExecutionIndex: 0,
        sourceKey: 'party:shiroko', actionId: 'heal-serika', path: 'triggers[0].resourceChange', eventPath: 'resolve[0]',
        target: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 3, actualAppliedAmount: 1,
        resourceId: 'focus', delta: 1,
      },
      {
        queueIndex: 2, event: 'damageApplied', triggerId: 'guard-on-hit', parentExecutionIndex: 1,
        sourceKey: 'enemy:robot', actionId: 'enemy-hit', path: 'triggers[0].resourceChange', eventPath: 'resolve[0]',
        target: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 3, actualAppliedAmount: 1,
        resourceId: 'guard', delta: 1,
      },
      {
        queueIndex: 3, event: 'healApplied', triggerId: 'focus-return', parentExecutionIndex: 2,
        sourceKey: 'ability:heal-shiroko', actionId: 'heal-shiroko', path: 'triggers[0].resourceChange', eventPath: 'resolve[0]',
        target: { kind: 'partyCharacter', id: 'shiroko' }, requestedAmount: 2, actualAppliedAmount: 2,
        resourceId: 'focus', delta: 2,
      },
      {
        queueIndex: 4, event: 'enemyDefeated', triggerId: 'ammo-on-defeat', parentExecutionIndex: 3,
        sourceKey: 'party:shiroko', actionId: 'finish-training-target', path: 'triggers[0].effect', eventPath: 'resolve[0]',
        target: { kind: 'enemy', id: 'training-target' }, rewardRecipient: { kind: 'partyCharacter', id: 'shiroko' },
        requestedAmount: 3, actualAppliedAmount: 3, resourceId: 'ammo', delta: 1,
      },
    ] as const;
    const projected = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence, triggerTrace,
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const saved = { ...projected, requestId: 'heal-trigger-flow' } as unknown as MapRunEncounterCommitReceipt;
    const views = [
      { ...base, actionPreview: { ...base.actionPreview!, recentCommit: projected } } as MapRunActiveWorkspaceView,
      { ...base, actionPreview: null, run: { ...base.run, lastEncounterCommit: saved } } as MapRunActiveWorkspaceView,
    ];

    for (const view of views) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:heal-trigger-flow')!.lines ?? [];
      expect(lines[0]).toContain('执行 1：character:shiroko');
      expect(lines[1]).toContain('执行 2：敌方 enemy:robot');
      expect(lines[2]).toContain('执行 3：Ability');
      const triggerLines = lines.filter(line => line.includes('Trigger '));
      expect(triggerLines).toEqual([
        'Heal Trigger 1 · favor-back · healApplied · 执行 1 action:heal-serika（父 Heal resolve[0]）→ character:serika：请求治疗 3，实际恢复 1 → resource:focus +1（triggers[0].resourceChange）',
        'Damage Trigger 2 · guard-on-hit · damageApplied · 执行 2 action:enemy-hit（父 Damage resolve[0]）→ character:serika：请求伤害 3（减伤/Shield 前），实际损失 HP 1 → resource:guard +1（triggers[0].resourceChange）',
        'Heal Trigger 3 · focus-return · healApplied · 执行 3 action:heal-shiroko（父 Heal resolve[0]）→ character:shiroko：请求治疗 2，实际恢复 2 → resource:focus +2（triggers[0].resourceChange）',
        'Defeat Trigger 4 · ammo-on-defeat · enemyDefeated · 执行 4 action:finish-training-target（父 Damage resolve[0]）→ 敌方 enemy:training-target；奖励领取者 character:shiroko：请求伤害 3（减伤/Shield 前），致死命中实际损失 HP 3 → resource:ammo +1（triggers[0].effect）',
      ]);
    }
  });

  it('shows natural Status expiry feedback after Action Triggers in the projected and saved Flow', () => {
    const base = activeView({ commit: { requestId: 'status-expiry-flow', round: 3 } });
    const triggerTrace: readonly MapEffectTriggerTraceEntry[] = [{
      queueIndex: 1, event: 'healApplied', triggerId: 'focus-on-heal', parentExecutionIndex: 0,
      sourceKey: 'party:shiroko', actionId: 'encourage', path: 'triggers[0].resourceChange', eventPath: 'resolve[0]',
      target: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 3, actualAppliedAmount: 1,
      resourceId: 'focus', delta: 1,
    }];
    const statusExpiryTriggerTrace: readonly MapEffectStatusExpiryTriggerTraceEntry[] = [{
      queueIndex: 2, event: 'statusExpired', statusTraceIndex: 0, round: 3,
      status: {
        holder: { kind: 'partyCharacter', id: 'serika' }, statusId: 'patient-regen',
        source: { kind: 'ability', actionId: 'apply-regen' }, actionId: 'apply-regen', appliedRound: 1,
        lastTriggeredRound: 2, stacks: 1, remainingRounds: 1,
      },
      holder: { kind: 'partyCharacter', id: 'serika' }, resourceId: 'focus', delta: 1,
      balanceBefore: 0, balanceAfter: 1,
    }];
    const projected = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence: [],
      triggerReceiptVersion: 2, triggerTrace, statusExpiryTriggerTrace,
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const saved = { ...projected, requestId: 'status-expiry-flow' } as unknown as MapRunEncounterCommitReceipt;
    const views = [
      { ...base, actionPreview: { ...base.actionPreview!, recentCommit: projected } } as MapRunActiveWorkspaceView,
      { ...base, actionPreview: null, run: { ...base.run, lastEncounterCommit: saved } } as MapRunActiveWorkspaceView,
    ];

    for (const view of views) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:status-expiry-flow')!.lines ?? [];
      const actionTriggerIndex = lines.findIndex(line => line.startsWith('Heal Trigger 1'));
      const expiryTriggerIndex = lines.findIndex(line => line.startsWith('Status 到期回馈 2'));
      expect(actionTriggerIndex).toBeGreaterThanOrEqual(0);
      expect(expiryTriggerIndex).toBeGreaterThan(actionTriggerIndex);
      expect(lines[expiryTriggerIndex]).toBe(
        'Status 到期回馈 2 · patient-regen · 持有者 character:serika · 来源 Ability · action:apply-regen · 剩余 1 轮 → resource:focus +1（0 → 1）',
      );
    }
  });

  it('projects Status holder damage callbacks in FIFO position for preview and saved receipts', () => {
    const base = activeView({ commit: { requestId: 'status-damage-flow', round: 1 } });
    const triggerTrace: readonly MapEffectTriggerTraceEntry[] = [{
      queueIndex: 1, event: 'damageApplied', triggerId: 'damage-signal', parentExecutionIndex: 1,
      sourceKey: 'enemy:robot', actionId: 'enemy-hit', path: 'triggers[0].resourceChange', eventPath: 'resolve[0]',
      target: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 2, actualAppliedAmount: 1,
      resourceId: 'guard', delta: 1,
    }];
    const statusDamageTriggerTrace = [{ queueIndex: 2, event: 'statusDamageTaken' as const, sourceKey: 'enemy:robot',
      actionId: 'enemy-hit', path: 'status:steadfast.onDamageTaken', parentExecutionIndex: 1, hitPath: 'resolve[0]',
      requestedAmount: 2, actualAppliedAmount: 1,
      status: { holder: { kind: 'partyCharacter' as const, id: 'serika' }, statusId: 'steadfast',
        source: { kind: 'partyCharacter' as const, id: 'shiroko' }, actionId: 'apply-steadfast', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 },
      holder: { kind: 'partyCharacter' as const, id: 'serika' }, resourceId: 'focus', delta: 1,
      balanceBefore: 0, balanceAfter: 1 }];
    const projected = { ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence: [],
      triggerReceiptVersion: 4, triggerTrace, statusExpiryTriggerTrace: [], statusDamageTriggerTrace };
    const views = [
      { ...base, actionPreview: { ...base.actionPreview!, recentCommit: projected } } as MapRunActiveWorkspaceView,
      { ...base, actionPreview: null, run: { ...base.run,
        lastEncounterCommit: { ...projected, requestId: 'status-damage-flow' } } } as unknown as MapRunActiveWorkspaceView,
    ];
    for (const view of views) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:status-damage-flow')!.lines ?? [];
      const actionIndex = lines.findIndex(line => line.startsWith('Damage Trigger 1'));
      const statusIndex = lines.findIndex(line => line.startsWith('Status 受伤回馈 2'));
      expect(actionIndex).toBeGreaterThanOrEqual(0);
      expect(statusIndex).toBeGreaterThan(actionIndex);
      expect(lines[statusIndex]).toContain('持有者 character:serika · Status steadfast');
      expect(lines[statusIndex]).toContain('实际损失 HP 1');
      expect(lines[statusIndex]).toContain('resource:focus +1（0→1）');
    }
  });

  it('shows Status consumption in Owner order with requested, consumed, unmet, and each instance stack change', () => {
    const base = activeView({ commit: { requestId: 'consume-status', round: 2 } });
    const statusConsumeTrace: readonly MapEffectStatusConsumeTraceEntry[] = [
      {
        sourceKey: 'ability:consume', actionId: 'consume', path: 'actions.consume.resolve.0',
        op: 'statusConsume', source: { kind: 'ability', actionId: 'consume' }, mode: 'program',
        identity: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'burn',
        requestedStacks: 3, consumedStacks: 2, unmetStacks: 1,
        changes: [
          { statusIndexBefore: 1, statusBefore: {
            holder: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'burn',
            source: { kind: 'partyCharacter', id: 'serika' }, actionId: 'apply-one', appliedRound: 1,
            lastTriggeredRound: null, stacks: 2, remainingRounds: 1,
          }, consumedStacks: 1, statusAfter: {
            holder: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'burn',
            source: { kind: 'partyCharacter', id: 'serika' }, actionId: 'apply-one', appliedRound: 1,
            lastTriggeredRound: null, stacks: 1, remainingRounds: 1,
          } },
          { statusIndexBefore: 0, statusBefore: {
            holder: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'burn',
            source: { kind: 'enemy', id: 'robot' }, actionId: 'apply-two', appliedRound: 1,
            lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
          }, consumedStacks: 1, statusAfter: null },
        ],
      },
      {
        sourceKey: 'enemy:robot:consume', actionId: 'enemy-consume', path: 'actions.enemy-consume.resolve.1',
        op: 'statusConsume', source: { kind: 'enemy', id: 'robot' }, mode: 'program',
        identity: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'regen',
        requestedStacks: 2, consumedStacks: 0, unmetStacks: 2, changes: [],
      },
    ];
    const projected = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', statusConsumeTrace,
    } as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    if (!projected) throw new Error('Expected projected Status Consume receipt');
    const saved = {
      ...projected,
      settlements: projected.settlements.map(row => ({ ...row, actionId: 'attack' })),
    } as unknown as MapRunEncounterCommitReceipt;
    const views = [
      { ...base, actionPreview: { ...base.actionPreview!, recentCommit: projected } } as MapRunActiveWorkspaceView,
      { ...base, actionPreview: null, run: { ...base.run, lastEncounterCommit: saved } } as MapRunActiveWorkspaceView,
    ];

    for (const view of views) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:consume-status')!.lines ?? [];
      expect(lines).toContain('Ability · action:consume：character:shiroko 的 Status burn · 请求 3层 / 已消费 2层 / 缺额 1层；实例 2 → 1层、1 → 0层');
      expect(lines).toContain('敌方 enemy:robot · action:enemy-consume：character:shiroko 的 Status regen · 请求 2层 / 已消费 0层 / 缺额 2层；没有匹配实例');
      expect(lines.indexOf(lines.find(line => line.includes('Status burn'))!))
        .toBeLessThan(lines.indexOf(lines.find(line => line.includes('Status regen'))!));
    }
  });

  it('shows Status category, resolved holder, and each removed instance in Owner order', () => {
    const base = activeView({ commit: { requestId: 'cleanse-status-category', round: 2 } });
    const statusCategoryRemoveTrace: readonly MapEffectStatusCategoryRemoveTraceEntry[] = [
      {
        sourceKey: 'ability:cleanse', actionId: 'cleanse', path: 'actions.cleanse.resolve.0',
        op: 'statusRemoveCategory', source: { kind: 'ability', actionId: 'cleanse' }, mode: 'program',
        identity: { kind: 'partyCharacter', id: 'shiroko' }, category: 'harmful',
        removed: [
          { statusIndexBefore: 1, status: {
            holder: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'burn',
            source: { kind: 'partyCharacter', id: 'serika' }, actionId: 'apply-one', appliedRound: 1,
            lastTriggeredRound: null, stacks: 2, remainingRounds: 1,
          } },
          { statusIndexBefore: 0, status: {
            holder: { kind: 'partyCharacter', id: 'shiroko' }, statusId: 'burn',
            source: { kind: 'enemy', id: 'robot' }, actionId: 'apply-two', appliedRound: 1,
            lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
          } },
        ],
      },
      {
        sourceKey: 'enemy:robot:empty-cleanse', actionId: 'empty-cleanse', path: 'actions.empty-cleanse.resolve.1',
        op: 'statusRemoveCategory', source: { kind: 'enemy', id: 'robot' }, mode: 'program',
        identity: { kind: 'enemy', id: 'robot' }, category: 'beneficial', removed: [],
      },
    ];
    const projected = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', statusCategoryRemoveTrace,
    } as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    if (!projected) throw new Error('Expected projected Status Category Remove receipt');
    const saved = {
      ...projected,
      settlements: projected.settlements.map(row => ({ ...row, actionId: 'attack' })),
    } as unknown as MapRunEncounterCommitReceipt;
    const views = [
      { ...base, actionPreview: { ...base.actionPreview!, recentCommit: projected } } as MapRunActiveWorkspaceView,
      { ...base, actionPreview: null, run: { ...base.run, lastEncounterCommit: saved } } as MapRunActiveWorkspaceView,
    ];

    for (const view of views) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:cleanse-status-category')!.lines ?? [];
      expect(lines).toContain('Ability · action:cleanse：character:shiroko 的 harmful 类 Status；移除实例 Status burn（2层，原数组位置 2）、Status burn（1层，原数组位置 1）');
      expect(lines).toContain('敌方 enemy:robot · action:empty-cleanse：敌方 enemy:robot 的 beneficial 类 Status；没有匹配实例');
      expect(lines.indexOf(lines.find(line => line.includes('harmful 类 Status'))!))
        .toBeLessThan(lines.indexOf(lines.find(line => line.includes('beneficial 类 Status'))!));
    }
  });

  it('uses AG-1 Owner order and shows command, enemy Actor balance, and safe card-target fallback', () => {
    const base = activeView({ commit: { requestId: 'ag1-order', round: 1 } });
    const sequence = [
      {
        executionIndex: 0, sourceKey: 'party-command', sourceKind: 'partyAction',
        owner: { kind: 'partyCharacter', id: 'shiroko' }, actionId: 'command', cardRef: null,
        baseAgility: 1, actorAgility: 0, finalAgility: 1, sideRank: 0, sourceRank: 0,
        ownerDeclarationIndex: 0, logicalIndex: 0, target: { kind: 'card', cardRef: {
          kind: 'card', id: 'opaque-card-id', scope: { runId: 'run-1', mapId: 'map-1', nodeId: 'node-a', activityId: null, round: 1 },
        } }, skipReason: 'roundEnded', playerCostSpent: 1, itemConsumed: false, resourceChanges: [], hpChanges: [],
        sourceId: 'shiroko', actionName: '手牌外指令',
      },
      {
        executionIndex: 1, sourceKey: 'enemy-action', sourceKind: 'enemyAction',
        owner: { kind: 'enemy', id: 'robot' }, actionId: 'counter', cardRef: null,
        baseAgility: 0, actorAgility: 0, finalAgility: 0, sideRank: 1, sourceRank: 0,
        ownerDeclarationIndex: 0, logicalIndex: 0, target: { kind: 'partyCharacter', characterId: 'shiroko' },
        skipReason: null, playerCostSpent: 0, itemConsumed: false,
        resourceChanges: [{ kind: 'effect', scope: 'actor', enemyId: 'robot', resourceId: 'supplies', delta: -2 }],
        hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -1 }], sourceId: 'robot', actionName: '反击',
      },
    ] as unknown as readonly MapRunEncounterExecutionSequenceEntry[];
    const recentCommit = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence: sequence,
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const view = {
      ...base,
      actionPreview: { ...base.actionPreview!, recentCommit },
      cards: [{
        ref: { kind: 'card' as const, id: 'opaque-card-id', scope: { runId: 'run-1', mapId: 'map-1', nodeId: 'node-a', activityId: null, round: 2 } },
        owner: { kind: 'partyCharacter' as const, id: 'serika' }, zone: 'hand' as const,
        actionId: 'wrong-scope-action', logicalIndex: 0, prepared: false, controllable: true,
      }],
    } as MapRunActiveWorkspaceView;
    const model = new MapFlowModel('run-1', port);
    model.sync(view);
    const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:ag1-order')!.lines ?? [];
    expect(lines[0]).toContain('执行 1：character:shiroko · 指令 · 手牌外指令 → 卡牌目标');
    expect(lines[0]).toContain('本轮已终结，跳过');
    expect(lines[0]).toContain('−1 PlayerCost');
    expect(lines[1]).toContain('执行 2：敌方 enemy:robot · 反击 → character:shiroko');
    expect(lines[1]).toContain('敌方 enemy:robot resource:supplies -2');
    expect(lines[1]).toContain('character:shiroko HP -1');
    expect(lines.join('\n')).not.toContain('opaque-card-id');
    expect(lines.join('\n')).not.toContain('wrong-scope-action');

    const resolvedView = {
      ...view,
      cards: [{
        ref: { kind: 'card' as const, id: 'opaque-card-id', scope: { runId: 'run-1', mapId: 'map-1', nodeId: 'node-a', activityId: null, round: 1 } },
        owner: { kind: 'partyCharacter' as const, id: 'serika' }, zone: 'hand' as const,
        actionId: 'resolved-target', logicalIndex: 0, prepared: false, controllable: true,
      }],
    } as MapRunActiveWorkspaceView;
    const resolved = new MapFlowModel('run-1', port);
    resolved.sync(resolvedView);
    const resolvedLines = resolved.snapshot.find(entry => entry.instanceKey === 'map:commit:ag1-order')!.lines ?? [];
    expect(resolvedLines[0]).toContain('卡牌目标：action:resolved-target');
    expect(resolvedLines.join('\n')).not.toContain('opaque-card-id');
  });

  it('renders an empty AG-1 sequence without falling back to grouped settlements', () => {
    const base = activeView({ commit: { requestId: 'ag1-empty', round: 1 } });
    const recentCommit = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence: [],
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const view = { ...base, actionPreview: { ...base.actionPreview!, recentCommit } } as MapRunActiveWorkspaceView;
    const model = new MapFlowModel('run-1', port);
    model.sync(view);
    const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:ag1-empty')!.lines ?? [];
    expect(lines).toEqual(['本轮没有已选执行来源。']);
  });

  it('does not use legacy groups as an AG-1 sequence when the Owner field is absent', () => {
    const base = activeView({ commit: { requestId: 'ag1-missing', round: 1 } });
    const recentCommit = {
      ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1',
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const view = { ...base, actionPreview: { ...base.actionPreview!, recentCommit } } as MapRunActiveWorkspaceView;
    const model = new MapFlowModel('run-1', port);
    model.sync(view);
    const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:ag1-missing')!.lines ?? [];
    expect(lines).toEqual(['AG-1 执行序列暂不可用。']);
    expect(lines.join('\n')).not.toContain('攻击');
  });

  it('explains revive and already-alive no-op in both preview Flow and stored Receipt', () => {
    const base = activeView({ commit: { requestId: 'revive-flow', round: 2 } });
    const effectTrace: MapEffectTraceEntry[] = [
      { sourceKey: 'ability:revive', actionId: 'revive-serika', path: 'resolve[0]', op: 'revive',
        source: { kind: 'ability', actionId: 'revive-serika' }, mode: 'program',
        identity: { kind: 'partyCharacter', id: 'serika' }, requestedHp: 3, restoredHp: 3,
        beforeHp: 0, afterHp: 3, outcome: 'revived' },
      { sourceKey: 'ability:revive', actionId: 'revive-serika', path: 'resolve[0]', op: 'revive',
        source: { kind: 'ability', actionId: 'revive-serika' }, mode: 'program',
        identity: { kind: 'partyCharacter', id: 'serika' }, requestedHp: 3, restoredHp: 0,
        beforeHp: 3, afterHp: 3, outcome: 'alreadyAlive' },
    ];
    const projected = ({ ...base.actionPreview!.recentCommit!, executionContractId: 'AG-1', executionSequence: [], effectTrace }) as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const saved = { ...projected, requestId: 'revive-flow' } as unknown as NonNullable<MapRunActiveWorkspaceView['run']['lastEncounterCommit']>;
    const views = [
      { ...base, actionPreview: { ...base.actionPreview!, recentCommit: projected } } as MapRunActiveWorkspaceView,
      { ...base, actionPreview: null, run: { ...base.run, lastEncounterCommit: saved } } as MapRunActiveWorkspaceView,
    ];
    for (const view of views) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const lines = model.snapshot.find(entry => entry.instanceKey === 'map:commit:revive-flow')!.lines ?? [];
      expect(lines.some(line => line.includes('复苏 character:serika') && line.includes('至 3 HP'))).toBe(true);
      expect(lines.some(line => line.includes('character:serika 已存活') && line.includes('复苏 no-op'))).toBe(true);
    }
  });

  it.each([0, 1])('活动投影与持久回执均显示实际 sCost 明细（实扣 %s）', paid => {
    const base = activeView({ commit: { requestId: 'cost', round: 1 } });
    const cost = { original: 2, discount: 2 - paid, paid };
    const projected = base.actionPreview!.recentCommit!;
    const settlement = { ...projected.settlements[0], scostCost: cost };
    const active = { ...base, actionPreview: { ...base.actionPreview!, recentCommit: { ...projected, settlements: [settlement] } } };
    const saved = { ...base, actionPreview: null, run: { ...base.run, lastEncounterCommit: {
      ...projected, settlements: [{ ...settlement, actionId: 'attack' }],
    } } } as unknown as MapRunActiveWorkspaceView;
    for (const view of [active, saved]) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const line = model.snapshot.find(entry => entry.instanceKey === 'map:commit:cost')!.lines![0];
      expect(line).toContain(`sCost 原费 2 / 减免 ${2 - paid} / 实扣 ${paid}`);
      model.sync(view);
      expect(model.snapshot.filter(entry => entry.instanceKey === 'map:commit:cost')).toHaveLength(1);
    }
  });

  it('ReadModel 投影与持久 Receipt 都显示 E1 实际分支、零变化、Flag 与来源资源结果', () => {
    const trace: MapEffectTraceEntry[] = [
      {
        sourceKey: 'party:shiroko', actionId: 'attack', path: 'actions.attack.resolve.0', op: 'when',
        source: { kind: 'partyCharacter', id: 'shiroko' }, mode: 'program', result: false,
        reads: [{ path: 'actions.attack.resolve.0.condition', op: 'counter', identity: { kind: 'encounterLocal' },
          counterId: 'stacks', current: 2, comparison: 'gte', value: 3, result: false }],
      },
      {
        sourceKey: 'party:shiroko', actionId: 'attack', path: 'actions.attack.resolve.1', op: 'counterAdd',
        source: { kind: 'partyCharacter', id: 'shiroko' }, mode: 'program', identity: { kind: 'encounterLocal' },
        counterId: 'stacks', before: 2, after: 2, delta: 0,
      },
      {
        sourceKey: 'party:shiroko', actionId: 'attack', path: 'actions.attack.resolve.2', op: 'flagSet',
        source: { kind: 'partyCharacter', id: 'shiroko' }, mode: 'program', identity: { kind: 'encounterLocal' },
        flagId: 'ready', before: false, after: true,
      },
    ];
    const base = activeView({ encounter: { enemyHp: 6 }, commit: { requestId: 'e1-receipt', round: 1 } });
    const projected = {
      ...base.actionPreview!.recentCommit!,
      activityId: 'battle-one',
      settlements: [{
        ...base.actionPreview!.recentCommit!.settlements[0]!,
        action: { actionId: 'attack', name: '攻击' },
        hpChanges: [{ scope: 'enemy' as const, enemyId: 'robot', delta: 0 }],
      }],
      ability: {
        action: { actionId: 'ability', name: '恢复术' },
        target: { kind: 'partyCharacter' as const, characterId: 'shiroko' },
        playerCostSpent: 1 as const,
        resourceChanges: [{ kind: 'effect' as const, scope: 'team' as const, resourceId: 'supplies', delta: 3 }],
        hpChanges: [],
      },
      item: {
        itemName: '急救包', action: { actionId: 'item-action', name: '使用急救包' },
        target: { kind: 'partyCharacter' as const, characterId: 'shiroko' }, consumedCount: 1 as const,
        resourceChanges: [{ kind: 'effect' as const, scope: 'actor' as const, characterId: 'shiroko', resourceId: 'credits', delta: -2 }],
        hpChanges: [{ scope: 'party' as const, characterId: 'shiroko', delta: 0 }],
      },
      effectTrace: trace,
    } as unknown as NonNullable<MapRunActiveWorkspaceView['actionPreview']>['recentCommit'];
    const projectedView = {
      ...base,
      actionPreview: { ...base.actionPreview!, recentCommit: projected },
    } as MapRunActiveWorkspaceView;
    const savedReceipt = {
      requestId: 'e1-receipt', commandVersion: 1, resultingCommitVersion: 1, nodeId: 'node-a', activityId: 'battle-one',
      round: 1, draftVersion: 1,
      settlements: [{
        characterId: 'shiroko', actionId: 'attack', targetCharacterId: null, targetEnemyId: 'robot',
        overrideKind: null, playerCostSpent: 0, resourceChanges: [],
        hpChanges: [{ scope: 'enemy' as const, enemyId: 'robot', delta: 0 }],
      }],
      ability: {
        actionId: 'ability', target: { kind: 'partyCharacter' as const, characterId: 'shiroko' }, playerCostSpent: 1,
        resourceChanges: [{ kind: 'effect' as const, scope: 'team' as const, resourceId: 'supplies', delta: 3 }], hpChanges: [],
      },
      item: {
        itemId: 'medkit', actionId: 'item-action',
        target: { kind: 'partyCharacter' as const, characterId: 'shiroko' }, consumedCount: 1,
        resourceChanges: [{ kind: 'effect' as const, scope: 'actor' as const, characterId: 'shiroko', resourceId: 'credits', delta: -2 }],
        hpChanges: [{ scope: 'party' as const, characterId: 'shiroko', delta: 0 }],
      },
      enemyActions: [],
      programReceiptVersion: 1, executionContractId: 'E1-COMPAT-1',
      effectScope: { runId: 'run-1', mapId: 'map-1', nodeId: 'node-a', activityId: 'battle-one', round: 1 },
      programVisitCount: 3, programVisits: [], plannedLocals: { counters: { stacks: { value: 2, min: 0, max: 5 } }, flags: { ready: true } },
      effectTrace: trace,
    } as unknown as MapRunEncounterCommitReceipt;
    const restoredView = {
      ...base,
      actionPreview: null,
      run: { ...base.run, lastEncounterCommit: savedReceipt },
    } as MapRunActiveWorkspaceView;

    for (const view of [projectedView, restoredView]) {
      const model = new MapFlowModel('run-1', port);
      model.sync(view);
      const entry = model.snapshot.find(candidate => candidate.instanceKey === 'map:commit:e1-receipt')!;
      const lines = entry.lines ?? [];
      expect(entry.speaker).toContain('原活动');
      expect(entry.marks).toMatchObject({ 'data-map-commit-activity-id': 'battle-one' });
      expect(lines.some(line => line.includes('条件不成立'))).toBe(true);
      expect(lines.some(line => line.includes('敌方 robot HP 0'))).toBe(true);
      expect(lines.some(line => line.includes('Ability：') && line.includes('resource:supplies +3')), lines.join('\n')).toBe(true);
      expect(lines.some(line => line.includes('Item：') && line.includes('resource:credits -2') && line.includes('HP 0'))).toBe(true);
      expect(lines.some(line => line.includes('Counter stacks 2 → 2（变化 0）'))).toBe(true);
      expect(lines.some(line => line.includes('Flag ready 否 → 是'))).toBe(true);
      expect(lines.join(' ')).not.toContain('actions.attack.resolve');
      model.sync(view);
      expect(model.snapshot.filter(candidate => candidate.instanceKey === 'map:commit:e1-receipt')).toHaveLength(1);
    }
  });

  it('空闲地点投影地点卡候选，活动中收起；刷新／恢复不虚构移动历史', () => {
    const model = new MapFlowModel('run-1', port);
    const base = activeView();
    const idle = {
      ...base,
      map: { ...base.map, edges: [{ fromNodeId: 'node-a', toNodeId: 'node-b', condition: {
        kind: 'teamResourceAtLeast', resourceId: 'key', amount: 2, satisfied: false,
      } }] },
    } as MapRunActiveWorkspaceView;
    model.sync(idle);
    const mover = model.snapshot.find(entry => entry.source?.kind === 'map.move-choices')!;
    expect(mover.actions).toBeUndefined();
    expect(mover.mapLocations).toMatchObject({ runId: 'run-1', mapId: 'map-1', fromNodeId: 'node-a' });
    expect(mover.mapLocations?.locations[0]).toMatchObject({
      ref: { kind: 'mapNode', runId: 'run-1', mapId: 'map-1', nodeId: 'node-b' },
      title: '地点 B',
      selectable: false,
      unavailableReason: '需要 resource:key ≥ 2',
    });
    expect(mover.mapLocations?.locations[0].stateLabel).toContain('resource:key ≥ 2（未满足）');
    expect(mover.mapLocations?.locations[0].instanceKey).toContain(mover.mapLocations?.locations[0].objectKey ?? '');
    model.sync(idle);
    expect(model.snapshot.filter(entry => entry.source?.kind === 'map.move-choices')).toHaveLength(1);
    model.sync({ ...idle, run: { ...idle.run, activeActivity: { nodeId: 'node-a', activityId: 'shop', kind: 'shop' } } } as MapRunActiveWorkspaceView);
    expect(model.snapshot.some(entry => entry.mapLocations)).toBe(false);
    model.sync(idle);
    model.recordMovement(base.map.nodes[0], base.map.nodes[1]);
    const destination = activeView({ currentNodeId: 'node-b', encounter: {} });
    model.sync(destination);
    model.sync(destination);
    expect(model.snapshot.filter(entry => entry.source?.kind === 'map.movement').map(entry => entry.text))
      .toEqual(['从地点 A移动到了地点 B']);
    expect(model.snapshot.some(entry => entry.mapLocations)).toBe(false);
    model.dispose();
    model.sync(destination);
    expect(model.snapshot.some(entry => entry.source?.kind === 'map.movement')).toBe(false);
  });

  it('shows Fact Edge requirements and mirrors their Runtime eligibility', () => {
    const model = new MapFlowModel('run-1', port);
    const base = activeView();
    const counterView = {
      ...base,
      map: { ...base.map, edges: [{ fromNodeId: 'node-a', toNodeId: 'node-b', condition: {
        kind: 'counter', counterId: 'cluesFound', comparison: 'gte', value: 2, satisfied: false,
      } }] },
    } as unknown as MapRunActiveWorkspaceView;
    model.sync(counterView);
    let location = model.snapshot.find(entry => entry.source?.kind === 'map.move-choices')!.mapLocations!.locations[0]!;
    expect(location.selectable).toBe(false);
    expect(location.unavailableReason).toBe('需要 地图计数 cluesFound ≥ 2');
    expect(location.stateLabel).toContain('地图计数 cluesFound ≥ 2（未满足）');

    const flagView = {
      ...base,
      map: { ...base.map, edges: [{ fromNodeId: 'node-a', toNodeId: 'node-b', condition: {
        kind: 'flag', flagId: 'alarmRaised', value: true, satisfied: true,
      } }] },
    } as unknown as MapRunActiveWorkspaceView;
    model.sync(flagView);
    location = model.snapshot.find(entry => entry.source?.kind === 'map.move-choices')!.mapLocations!.locations[0]!;
    expect(location.selectable).toBe(true);
    expect(location.stateLabel).toContain('地图标记 alarmRaised = true（已满足）');
    model.dispose();
  });

  it('首次生成当前地点基线：键、标题、说明与焦点标记', () => {
    const model = new MapFlowModel('run-1', port);
    const entries = model.sync(activeView());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      streamKey: 'map:run-1',
      instanceKey: 'map:node:node-a:-',
      contentId: 'gameplay-b:current-node',
      repeatPolicy: 'replaceSameId',
      lifecycle: 'current',
      kind: 'talk',
      speaker: '测试地图 · 当前地点',
      text: '地点 A',
      heading: 1,
      lines: ['A 的说明'],
      marks: { 'data-map-current-node': 'node-a', 'data-map-region-key': 'feed-node:node-a' },
      headingMarks: { 'data-map-focus-heading': true, tabindex: '-1' },
    });
  });

  it('不把每轮准备行动重复投影到 Flow', () => {
    const model = new MapFlowModel('run-1', port);
    const view = activeView({ encounter: { enemyHp: 6 } });
    const entries = model.sync(view);
    expect(entries.map(entry => entry.speaker)).toEqual(['测试地图 · 当前地点', '当前遭遇']);
    expect(entries.some(entry => entry.mapCards?.length)).toBe(false);
    expect(entries.some(entry => entry.contentId === 'gameplay-b:current-cards')).toBe(false);
  });

  it('地点 → 遭遇 → 回执按发生时序排列，回执带可读结算行', () => {
    const model = new MapFlowModel('run-1', port);
    const entries = model.sync(activeView({
      encounter: { enemyHp: 4 },
      commit: { requestId: 'R1', round: 2 },
    }));
    expect(keys(model)).toEqual(['map:node:node-a:-', 'map:encounter:node-a:-', 'map:commit:R1']);
    const commit = entries.find(entry => entry.instanceKey === 'map:commit:R1')!;
    expect(commit.speaker).toBe('最近提交结果 · 地点 A · 第 2 轮结果');
    expect(commit.lines?.[0]).toBe('character:shiroko：攻击 → 敌方 robot · 敌方 robot HP -2');
    expect(commit.lines?.[1]).toBe('敌方 enemy:robot：反击 → character:shiroko · character:shiroko HP -1');
    expect(commit.marks).toMatchObject({
      'data-map-recent-commit': 'R1',
      'data-map-commit-receipt': 'R1',
      'data-map-region-key': 'feed-recent-commit',
      role: 'status',
    });
  });

  it('只有最新回执带 data-map-recent-commit，旧回执继续显示但不占用单例语义', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView({ commit: { requestId: 'R1', round: 1 } }));
    model.sync(activeView({ commit: { requestId: 'R2', round: 2 } }));
    const recent = model.snapshot.filter(entry => entry.marks?.['data-map-recent-commit'] !== undefined);
    expect(recent.map(entry => entry.marks?.['data-map-recent-commit'])).toEqual(['R2']);
    const old = model.snapshot.find(entry => entry.instanceKey === 'map:commit:R1')!;
    expect(old.marks?.['data-map-commit-receipt']).toBe('R1');
    expect(old.marks?.['data-map-region-key']).toBe('feed-commit:R1');
  });

  it('重复刷新同一 View 不增加、不重排条目', () => {
    const model = new MapFlowModel('run-1', port);
    const view = activeView({ encounter: { enemyHp: 4 }, commit: { requestId: 'R1', round: 2 } });
    model.sync(view);
    const first = keys(model);
    model.sync(view);
    model.sync(view);
    expect(keys(model)).toEqual(first);
  });

  it('新 requestId 只尾插一次，先前回执仍在会话内可见', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView({ commit: { requestId: 'R1', round: 1 } }));
    model.sync(activeView({ commit: { requestId: 'R2', round: 2 } }));
    expect(keys(model)).toEqual(['map:node:node-a:-', 'map:commit:R1', 'map:commit:R2']);
    model.sync(activeView({ commit: { requestId: 'R2', round: 2 } }));
    expect(keys(model)).toEqual(['map:node:node-a:-', 'map:commit:R1', 'map:commit:R2']);
  });

  it('地点变更移除旧说明并在末尾追加新说明', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView({ commit: { requestId: 'R1', round: 1 } }));
    model.sync(activeView({ currentNodeId: 'node-b' }));
    expect(keys(model)).toEqual(['map:commit:R1', 'map:node:node-b:-']);
  });

  it('商店最近购买只在来源仍可读取时呈现', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView({ shop: { lastPurchase: 'P1' } }));
    const purchase = model.snapshot.find(entry => entry.instanceKey === 'map:shop-purchase:P1');
    expect(purchase).toMatchObject({
      lifecycle: 'current',
      speaker: '测试商店',
      text: '最近购买：备用零件',
    });
    model.sync(activeView({ shop: null }));
    expect(keys(model)).toEqual(['map:node:node-a:-']);
  });

  it('dispose 清空临时序列，重新进入只重建有权威来源的内容', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView({ commit: { requestId: 'R1', round: 1 } }));
    model.dispose();
    expect(model.snapshot).toHaveLength(0);

    model.sync(activeView());
    expect(keys(model)).toEqual(['map:node:node-a:-']);
  });
});

describe('Map Flow 终态条目', () => {
  it('成功结果使用 retained result 的只读字段', () => {
    const model = new MapFlowModel('run-1', port);
    const view = {
      kind: 'success',
      result: { runId: 'run-1', mapId: 'map-1', outcome: 'success', exitNodeId: 'node-b', mapName: '测试地图', exitNodeTitle: '出口' },
    } as MapRunSuccessWorkspaceView;
    const entries = model.sync(view);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      instanceKey: 'map:result:success',
      speaker: '测试地图',
      text: '地图路线已完成',
      heading: 1,
      lines: ['本次探索已到达出口地点 出口。'],
      marks: { 'data-map-run-result': 'success', 'data-map-region-key': 'feed-success' },
      headingMarks: { 'data-map-focus-heading': true, tabindex: '-1' },
    });
  });

  it('失败结果只使用 Runtime-only 结果与地点标题', () => {
    const model = new MapFlowModel('run-1', port);
    const view = {
      kind: 'failure',
      result: { runId: 'run-1', mapId: 'map-1', outcome: 'failure', failedNodeId: 'node-b', reason: 'partyDefeated' },
      map: {
        id: 'map-1', name: '测试地图', startNodeId: 'node-a', exitNodeIds: [], edges: [],
        nodes: [{ id: 'node-b', title: '地点 B', hasEncounter: true }],
      },
      failedNodeTitle: '地点 B',
      partyHp: [],
    } as unknown as MapRunFailureWorkspaceView;
    const entries = model.sync(view);
    expect(entries[0].lines).toEqual(['队伍已无法继续战斗，本次地图探索结束。', '失败地点：地点 B']);
    expect(entries[0].marks).toMatchObject({ 'data-map-run-result': 'failure' });
  });

  it('终态与活动态共用同一流实例', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView());
    const success = {
      kind: 'success',
      result: { runId: 'run-1', mapId: 'map-1', outcome: 'success', exitNodeId: 'node-b', mapName: '测试地图', exitNodeTitle: '出口' },
    } as MapRunSuccessWorkspaceView;
    model.sync(success as MapRunWorkspaceView);
    expect(keys(model)).toEqual(['map:result:success']);
  });
});
