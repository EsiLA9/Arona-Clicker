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
} from '../../src/arona-clicker/contracts/runtime';

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

  it('空闲地点投影地点卡候选，活动中收起；刷新／恢复不虚构移动历史', () => {
    const model = new MapFlowModel('run-1', port);
    const base = activeView();
    const idle = {
      ...base,
      map: { ...base.map, edges: [{ fromNodeId: 'node-a', toNodeId: 'node-b', condition: { resourceId: 'key', amount: 2, satisfied: false } }] },
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
