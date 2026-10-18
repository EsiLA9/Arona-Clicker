// ============================================================
// tests/ui/map-flow-adapter.test.ts — Map View → Flow 适配与按 Run 隔离的流
// 覆盖：基线顺序 / 快照刷新不重排 / requestId 幂等 / 查询回收与失效 / dispose
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  MAP_FLOW_ENEMY_INFO_SLOT,
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
    enemies: [{ enemyId: 'robot', currentHp: patch.encounter.enemyHp ?? 6, maxHp: 6, damage: 1 }],
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
    enemyAttacks: [],
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
    actionPreview: commit ? { nodeId: currentNodeId, round: 1, draft: {}, overrides: [], preparedActions: [], playerCommandOptions: [], commitPreview: { canCommit: true, playerCostRequired: 0, diagnostics: [] }, recentCommit: commit } : null,
    sourcePreview: null,
  } as unknown as MapRunActiveWorkspaceView;
}

function keys(model: MapFlowModel): string[] {
  return model.snapshot.map(entry => entry.instanceKey);
}

function last<T>(items: readonly T[]): T {
  return items[items.length - 1];
}

describe('Map Flow Adapter', () => {
  it('空闲地点唤起单个移动器，活动中收起；刷新／恢复不虚构移动历史', () => {
    const model = new MapFlowModel('run-1', port);
    const base = activeView();
    const idle = {
      ...base,
      map: { ...base.map, edges: [{ fromNodeId: 'node-a', toNodeId: 'node-b', condition: { resourceId: 'key', amount: 2, satisfied: false } }] },
    } as MapRunActiveWorkspaceView;
    model.sync(idle);
    const mover = model.snapshot.find(entry => entry.source?.kind === 'map.move-choices')!;
    expect(mover.actions?.[0]).toMatchObject({ label: '前往 地点 B', disabled: true });
    expect(mover.actions?.[0].detail).toContain('resource:key ≥ 2（未满足）');
    model.sync(idle);
    expect(model.snapshot.filter(entry => entry.source?.kind === 'map.move-choices')).toHaveLength(1);
    model.sync({ ...idle, run: { ...idle.run, activeActivity: { nodeId: 'node-a', activityId: 'shop', kind: 'shop' } } } as MapRunActiveWorkspaceView);
    expect(model.snapshot.some(entry => entry.actions?.length)).toBe(false);
    model.sync(idle);
    model.recordMovement(base.map.nodes[0], base.map.nodes[1]);
    const destination = activeView({ currentNodeId: 'node-b', encounter: {} });
    model.sync(destination);
    model.sync(destination);
    expect(model.snapshot.filter(entry => entry.source?.kind === 'map.movement').map(entry => entry.text))
      .toEqual(['从地点 A移动到了地点 B']);
    expect(model.snapshot.some(entry => entry.actions?.length)).toBe(false);
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

  it('查询情报使用逻辑槽回收旧条目并尾插', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView());
    model.pushEnemyInfo({ enemyId: 'robot', currentHp: 6, maxHp: 6 });
    expect(last(model.snapshot)).toMatchObject({
      contentId: MAP_FLOW_ENEMY_INFO_SLOT,
      repeatPolicy: 'replaceSameId',
      text: '敌方 robot',
      lines: ['HP 6 / 6'],
    });

    model.pushEnemyInfo({ enemyId: 'robot', currentHp: 3, maxHp: 6 });
    const queries = model.snapshot.filter(entry => entry.contentId === MAP_FLOW_ENEMY_INFO_SLOT);
    expect(queries).toHaveLength(1);
    expect(queries[0].lines).toEqual(['HP 3 / 6']);
    expect(last(model.snapshot)).toBe(queries[0]);

    model.pushEnemyInfo({ enemyId: 'drone', currentHp: 2, maxHp: 2 });
    const afterSwitch = model.snapshot.filter(entry => entry.contentId === MAP_FLOW_ENEMY_INFO_SLOT);
    expect(afterSwitch).toHaveLength(1);
    expect(afterSwitch[0].text).toBe('敌方 drone');
  });

  it('重复读同一 View 不复活旧查询，也不改变查询位置', () => {
    const model = new MapFlowModel('run-1', port);
    const view = activeView({ encounter: { enemyHp: 6 } });
    model.sync(view);
    model.pushEnemyInfo({ enemyId: 'robot', currentHp: 6, maxHp: 6 });
    const keysAfterQuery = keys(model);
    model.sync(view);
    model.sync(view);
    expect(keys(model)).toEqual(keysAfterQuery);
  });

  it('被查询事实变化时旧情报失效且不自动重投递', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView({ encounter: { enemyHp: 6 } }));
    model.pushEnemyInfo({ enemyId: 'robot', currentHp: 6, maxHp: 6 });
    model.sync(activeView({ encounter: { enemyHp: 3 } }));
    expect(model.snapshot.some(entry => entry.contentId === MAP_FLOW_ENEMY_INFO_SLOT)).toBe(false);
  });

  it('离开遭遇或读档后不再保留无法重建的查询', () => {
    const model = new MapFlowModel('run-1', port);
    model.sync(activeView({ encounter: { enemyHp: 6 } }));
    model.pushEnemyInfo({ enemyId: 'robot', currentHp: 6, maxHp: 6 });
    model.sync(activeView({ encounter: null }));
    expect(model.snapshot.some(entry => entry.contentId === MAP_FLOW_ENEMY_INFO_SLOT)).toBe(false);
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
    model.pushEnemyInfo({ enemyId: 'robot', currentHp: 6, maxHp: 6 });
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
