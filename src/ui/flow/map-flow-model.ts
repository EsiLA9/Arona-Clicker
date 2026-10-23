// ============================================================
// ui/flow/map-flow-model.ts — Gameplay B Map 的 Flow 适配与按 Run 隔离的流模型
// 只读 MapRunWorkspaceView 生成呈现条目；不写 MapRun、不发命令、不伪造历史。
// 有序序列与回收策略由 U1 的 reducer 承担，渲染交给 flow/flow-render.ts。
// ============================================================

import type {
  MapEncounterQueryView,
  MapRunActiveWorkspaceView,
  MapRunFailureWorkspaceView,
  MapRunSuccessWorkspaceView,
  MapRunWorkspaceView,
  MapWorkspaceEnemyActionSettlementView,
  MapWorkspaceEdgeConditionView,
  MapWorkspaceNodeView,
} from '../../arona-clicker/contracts/runtime/runtime';
import type {
  MapRunEncounterCommitReceipt,
  MapRunEncounterExecutionSequenceEntry,
  MapRunEncounterEnemyActionSettlement,
  MapRunEncounterHpChange,
  MapRunEncounterSettlementResourceChange,
  MapRunEncounterSourceTarget,
} from '../../arona-clicker/contracts/map/map-run';
import type {
  MapEffectDamageProtectionTrace,
  MapEffectShieldTraceEntry,
  MapEffectStatusCategoryRemoveTraceEntry,
  MapEffectStatusConsumeTraceEntry,
  MapEffectStatusExpiryTriggerTraceEntry,
  MapEffectStatusDamageTriggerTraceEntry,
  MapEffectTraceEntry,
  MapEffectTriggerTraceEntry,
} from '../../arona-clicker/contracts/map/map-effects';
import type { MapRunCardInstance, MapRunCardRef } from '../../arona-clicker/contracts/map/map-cards';
import {
  FLOW_STREAM_MAX,
  applyFlowEntryInPlace,
  mapInstanceKey,
  type FlowEntry,
  type FlowMapLocation,
  type FlowMapLocations,
} from './flow-entry';
import { mapCardInstanceKey, mapLocationObjectKey, type MapLocationRef } from '../cards/card-host';

/** 当前地点说明的逻辑槽。 */
export const MAP_FLOW_CURRENT_NODE_SLOT = 'gameplay-b:current-node';
/** 玩家主动查看的地图地点概览逻辑槽。 */
export const MAP_FLOW_MAP_OVERVIEW_SLOT = 'gameplay-b:map-overview';
/** 当前遭遇说明的逻辑槽。 */
export const MAP_FLOW_CURRENT_ENCOUNTER_SLOT = 'gameplay-b:current-encounter';
export const MAP_FLOW_MOVE_CHOICES_SLOT = 'gameplay-b:move-choices';

/**
 * Current location choices derived only from the active detached Map View.
 * Controller uses the same projection when it validates a movement commit.
 */
export function mapLocationChoices(
  view: MapRunActiveWorkspaceView,
  port: MapFlowTextPort,
  streamKey: string,
): FlowMapLocations | null {
  if (view.run.status !== 'inProgress' || view.run.activeEncounterNodeId !== null
    || view.run.activeActivity !== null || view.activities.some(activity => !activity.completed)) return null;
  const fromNodeId = view.run.currentNodeId;
  const entryInstanceKey = mapInstanceKey('move-choices', fromNodeId);
  const locations: FlowMapLocation[] = view.map.edges
    .filter(edge => edge.fromNodeId === fromNodeId)
    .flatMap(edge => {
      const node = view.map.nodes.find(candidate => candidate.id === edge.toNodeId);
      if (!node) return [];
      const ref: MapLocationRef = { kind: 'mapNode', runId: view.run.runId, mapId: view.map.id, nodeId: node.id };
      const objectKey = mapLocationObjectKey(ref);
      const locked = edge.condition !== undefined && !edge.condition.satisfied;
      const requirement = edge.condition
        ? `需要 ${mapEdgeConditionRequirement(edge.condition, port)}${locked ? '（未满足）' : '（已满足）'}`
        : '';
      return [{
        instanceKey: mapCardInstanceKey(`flow:${streamKey}`, `${entryInstanceKey}:location:${node.id}`, objectKey),
        objectKey,
        ref,
        title: node.title,
        ...(node.description ? { description: node.description } : {}),
        stateLabel: [mapNodeProgressLabel(view, node), requirement].filter(Boolean).join(' · '),
        selectable: !locked,
        ...(locked ? { unavailableReason: `需要 ${mapEdgeConditionRequirement(edge.condition!, port)}` } : {}),
      }];
    });
  return locations.length ? {
    runId: view.run.runId,
    mapId: view.map.id,
    fromNodeId,
    hostLayout: { alignment: 'left', gapPx: 12 },
    locations,
  } : null;
}

function mapEdgeConditionRequirement(
  condition: MapWorkspaceEdgeConditionView,
  port: MapFlowTextPort,
): string {
  if (condition.kind === 'teamResourceAtLeast') {
    return `${port.nameOf('resource', condition.resourceId)} ≥ ${port.formatNumber(condition.amount)}`;
  }
  if (condition.kind === 'counter') {
    const comparison = { eq: '=', lt: '<', lte: '≤', gt: '>', gte: '≥' }[condition.comparison];
    return `地图计数 ${condition.counterId} ${comparison} ${port.formatNumber(condition.value)}`;
  }
  return `地图标记 ${condition.flagId} = ${condition.value ? 'true' : 'false'}`;
}

/** 地点进度文案由地图列表与流内移动选项共用。 */
export function mapNodeProgressLabel(view: MapRunActiveWorkspaceView, node: MapWorkspaceNodeView): string {
  const completed = view.run.completedEncounterNodeIds.includes(node.id);
  const labels = [node.id === view.run.currentNodeId ? '当前位置'
    : view.run.visitedNodeIds.includes(node.id) ? '已访问' : '未到达'];
  if (completed) labels.push('遭遇已完成');
  if (node.id === view.map.startNodeId) labels.push('起点');
  if (view.map.exitNodeIds.includes(node.id)) labels.push('出口');
  if (node.hasEncounter && !completed) labels.push('含遭遇');
  return labels.join(' · ');
}

/** 供逐行正文使用的只读文案端口（UIContext 结构兼容）。 */
export interface MapFlowTextPort {
  nameOf(type: string, id: string): string;
  formatNumber(value: number): string;
}

/** One concise target-card modifier label, shared with the existing CardRef picker. */
export function mapCardEffectModifierPreviewLabel(
  preview: { readonly op: 'damage' | 'heal'; readonly delta: number },
  formatNumber: (value: number) => string = value => String(value),
): string {
  const sign = preview.delta < 0 ? '−' : '+';
  return `${preview.op === 'heal' ? '治疗' : '伤害'} ${sign}${formatNumber(Math.abs(preview.delta))}`;
}

/** 归一化后的结算视图：投影回执与持久回执共用同一套逐行格式化。 */
interface CommitView {
  readonly requestId: string;
  readonly nodeId: string;
  readonly activityId?: string;
  readonly round: number;
  readonly executionContractId?: 'E1-COMPAT-1' | 'AG-1';
  readonly executionSequence?: readonly (MapRunEncounterExecutionSequenceEntry & {
    readonly sourceId?: string | null;
    readonly actionName?: string;
    readonly targetCardActionName?: string;
  })[];
  readonly settlements: readonly {
    readonly characterId: string;
    readonly actionName: string;
    readonly targetCharacterId: string | null;
    readonly targetEnemyId: string | null;
    readonly overrideKind: 'swap' | 'playerCommand' | null;
    readonly playerCostSpent: 0 | 1;
    readonly scostCost?: { readonly original: number; readonly discount: number; readonly paid: number };
    readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
    readonly hpChanges: readonly MapRunEncounterHpChange[];
  }[];
  readonly ability: {
    readonly actionName: string;
    readonly target: MapRunEncounterSourceTarget;
    readonly playerCostSpent: 1;
    readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
    readonly hpChanges: readonly MapRunEncounterHpChange[];
  } | null;
  readonly item: {
    readonly itemName: string;
    readonly target: MapRunEncounterSourceTarget;
    readonly consumedCount: 1;
    readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
    readonly hpChanges: readonly MapRunEncounterHpChange[];
  } | null;
  readonly enemyActions: readonly {
    readonly enemyId: string;
    readonly actionName: string;
    readonly targetCharacterId: string | null;
    readonly targetEnemyId: string | null;
    readonly targetCard: boolean;
    readonly skipReason?: MapRunEncounterEnemyActionSettlement['skipReason'];
    readonly scostCost?: { readonly original: number; readonly discount: number; readonly paid: number };
    readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
    readonly hpChanges: readonly MapRunEncounterHpChange[];
  }[];
  readonly effectTrace?: readonly MapEffectTraceEntry[];
  readonly statusConsumeTrace?: readonly MapEffectStatusConsumeTraceEntry[];
  readonly statusCategoryRemoveTrace?: readonly MapEffectStatusCategoryRemoveTraceEntry[];
  readonly triggerTrace?: readonly MapEffectTriggerTraceEntry[];
  readonly statusExpiryTriggerTrace?: readonly MapEffectStatusExpiryTriggerTraceEntry[];
  readonly statusDamageTriggerTrace?: readonly MapEffectStatusDamageTriggerTraceEntry[];
  readonly shieldTrace?: readonly MapEffectShieldTraceEntry[];
}

function port_name(port: MapFlowTextPort, type: string, id: string): string {
  return port.nameOf(type, id);
}

function targetLabel(port: MapFlowTextPort, target: MapRunEncounterSourceTarget | null): string {
  if (!target) return '待选择目标';
  return target.kind === 'partyCharacter'
    ? port_name(port, 'character', target.characterId)
    : `敌方 ${target.enemyId}`;
}

function hpLabel(delta: number): string {
  return `HP ${delta > 0 ? '+' : ''}${delta}`;
}

function hpChangesLabel(port: MapFlowTextPort, changes: readonly MapRunEncounterHpChange[]): string {
  return changes.map(change => {
    const target = change.scope === 'party'
      ? port_name(port, 'character', change.characterId)
      : `敌方 ${change.enemyId}`;
    return `${target} ${hpLabel(change.delta)}`;
  }).join(' · ');
}

function resourcesLabel(port: MapFlowTextPort, changes: readonly MapRunEncounterSettlementResourceChange[]): string {
  return changes
    .map(change => `${port_name(port, 'resource', change.resourceId)} ${change.delta > 0 ? '+' : ''}${change.delta}`)
    .join(' · ');
}

function signedDeltaLabel(port: MapFlowTextPort, delta: number): string {
  return `${delta > 0 ? '+' : ''}${port.formatNumber(delta)}`;
}

function effectTraceSourceLabel(port: MapFlowTextPort, trace: MapEffectTraceEntry): string {
  const action = port_name(port, 'action', trace.actionId);
  const source = trace.source;
  if (!source) return `行动：${action}`;
  if (source.kind === 'partyCharacter') return `${port_name(port, 'character', source.id)}：${action}`;
  if (source.kind === 'enemy') return `敌方 ${port_name(port, 'enemy', source.id)}：${action}`;
  if (source.kind === 'ability') return `Ability：${action}`;
  return `Item ${port_name(port, 'item', source.itemId)}：${action}`;
}

function damageProtectionSourceLabel(port: MapFlowTextPort, trace: MapEffectDamageProtectionTrace): string {
  const source = trace.statusBefore.source;
  if (source.kind === 'partyCharacter') return port.nameOf('character', source.id);
  if (source.kind === 'enemy') return `敌方 ${port.nameOf('enemy', source.id)}`;
  if (source.kind === 'ability') return 'Ability';
  return `Item ${port.nameOf('item', source.itemId)}`;
}

function effectTraceLines(port: MapFlowTextPort, trace: readonly MapEffectTraceEntry[] | undefined): string[] {
  const lines: string[] = [];
  for (const entry of trace ?? []) {
    const source = effectTraceSourceLabel(port, entry);
    if (entry.op === 'targetSet') {
      const members = entry.identities.map(identity => identity.kind === 'partyCharacter'
        ? port_name(port, 'character', identity.id)
        : `敌方 ${port_name(port, 'enemy', identity.id)}`);
      lines.push(`${source}：解析${entry.selection === 'set' ? '目标集合' : '主目标'}（${entry.identities.length}名${members.length ? `：${members.join('、')}` : ''}）`);
    } else if (entry.op === 'when') {
      lines.push(`${source}：条件${entry.result ? '成立' : '不成立'}`);
    } else if (entry.op === 'revive') {
      const target = port.nameOf('character', entry.identity.id);
      lines.push(entry.outcome === 'revived'
        ? `${source}：复苏 ${target} 至 ${port.formatNumber(entry.afterHp)} HP（请求 ${port.formatNumber(entry.requestedHp)}，实际恢复 ${port.formatNumber(entry.restoredHp)}）`
        : `${source}：${target} 已存活，复苏 no-op（HP ${port.formatNumber(entry.beforeHp)} → ${port.formatNumber(entry.afterHp)}）`);
    } else if (entry.op === 'damage') {
      const damage = entry;
      const protection = damage.damageProtection;
      const reduction = damage.damageReduction;
      if (protection !== undefined) {
        const status = protection.statusBefore;
        const target = status.holder.kind === 'partyCharacter'
          ? port.nameOf('character', status.holder.id)
          : `敌方 ${port.nameOf('enemy', status.holder.id)}`;
        lines.push(`${source} → ${target}：Status ${status.statusId}（${damageProtectionSourceLabel(port, protection)} · ${port.nameOf('action', status.actionId)}）层数 ${port.formatNumber(status.stacks)} → ${port.formatNumber(protection.statusAfter?.stacks ?? 0)}层 · 拦截伤害 ${port.formatNumber(protection.blockedAmount)}；HP 不变；Shield 未消耗`);
      } else if (reduction !== undefined) {
        const target = damage.identity?.kind === 'partyCharacter'
          ? port.nameOf('character', damage.identity.id)
          : damage.identity?.kind === 'enemy'
            ? `敌方 ${port.nameOf('enemy', damage.identity.id)}` : '目标';
        const sourceDetails = reduction.sources.map(row => {
          const statusSource = row.source?.kind === 'partyCharacter'
            ? port.nameOf('character', row.source.id ?? '')
            : row.source?.kind === 'enemy' ? `敌方 ${port.nameOf('enemy', row.source.id ?? '')}`
              : row.source?.kind === 'ability' ? 'Ability'
                : row.source?.kind === 'item' ? `Item ${port.nameOf('item', row.source.itemId ?? '')}` : '来源未知';
          return `Status ${row.statusId}（${statusSource} · ${port.nameOf('action', row.actionId)} · ${port.formatNumber(row.stacks)}层 × ${port.formatNumber(row.damageReductionPerStack)}，减免 ${port.formatNumber(row.reducedAmount)}）`;
        });
        const preStatusRequest = damage.amount + reduction.total;
        const rawRequest = damage.requestedAmount ?? preStatusRequest;
        const modifiedRequest = damage.modifiedRequestedAmount ?? preStatusRequest;
        const modifier = modifiedRequest === rawRequest ? '' : ` · Modifier 后 ${port.formatNumber(modifiedRequest)}`;
        const details = sourceDetails.length ? `（${sourceDetails.join('、')}）` : '（没有贡献来源）';
        lines.push(`${source} → ${target}：原始伤害请求 ${port.formatNumber(rawRequest)}${modifier} · 防御 Status 减免 ${port.formatNumber(reduction.total)}${details}`);
      }
    } else if (entry.op === 'counterAdd') {
      lines.push(`${source}：Counter ${entry.counterId} ${port.formatNumber(entry.before)} → ${port.formatNumber(entry.after)}（变化 ${signedDeltaLabel(port, entry.delta)}）`);
    } else if (entry.op === 'flagSet') {
      lines.push(`${source}：Flag ${entry.flagId} ${entry.before ? '是' : '否'} → ${entry.after ? '是' : '否'}`);
    }
  }
  return lines;
}

function shieldActorLabel(port: MapFlowTextPort, identity: MapEffectShieldTraceEntry['identity']): string {
  return identity.kind === 'partyCharacter'
    ? port.nameOf('character', identity.id)
    : `敌方 ${port.nameOf('enemy', identity.id)}`;
}

function shieldSourceLabel(port: MapFlowTextPort, trace: MapEffectShieldTraceEntry): string {
  const source = trace.source;
  if (!source) return port.nameOf('action', trace.actionId);
  if (source.kind === 'partyCharacter') return `${port.nameOf('character', source.id)} · ${port.nameOf('action', trace.actionId)}`;
  if (source.kind === 'enemy') return `敌方 ${port.nameOf('enemy', source.id)} · ${port.nameOf('action', trace.actionId)}`;
  if (source.kind === 'ability') return `Ability · ${port.nameOf('action', trace.actionId)}`;
  return `Item ${port.nameOf('item', source.itemId)} · ${port.nameOf('action', trace.actionId)}`;
}

function shieldTraceLines(port: MapFlowTextPort, trace: readonly MapEffectShieldTraceEntry[] | undefined): string[] {
  return (trace ?? []).map(entry => {
    const target = shieldActorLabel(port, entry.identity);
    const source = shieldSourceLabel(port, entry);
    if (entry.op === 'shieldAdd') {
      return entry.outcome === 'applied'
        ? `${source} → ${target}：获得 Shield ${port.formatNumber(entry.added)}（Shield ${port.formatNumber(entry.shieldBefore)} → ${port.formatNumber(entry.shieldAfter)}）`
        : `${source} → ${target}：目标已倒下，未获得 Shield`;
    }
    return `${source} → ${target}：伤害 ${port.formatNumber(entry.requestedAmount)} · Shield 吸收 ${port.formatNumber(entry.absorbed)} · 剩余伤害 ${port.formatNumber(entry.remainingDamage)}（Shield ${port.formatNumber(entry.shieldBefore)} → ${port.formatNumber(entry.shieldAfter)}，HP ${port.formatNumber(entry.hpBefore)} → ${port.formatNumber(entry.hpAfter)}）`;
  });
}

function statusConsumeSourceLabel(port: MapFlowTextPort, trace: MapEffectStatusConsumeTraceEntry): string {
  const action = port.nameOf('action', trace.actionId);
  const source = trace.source;
  if (!source) return action;
  if (source.kind === 'partyCharacter') return `${port.nameOf('character', source.id)} · ${action}`;
  if (source.kind === 'enemy') return `敌方 ${port.nameOf('enemy', source.id)} · ${action}`;
  if (source.kind === 'ability') return `Ability · ${action}`;
  return `Item ${port.nameOf('item', source.itemId)} · ${action}`;
}

function statusConsumeTraceLines(port: MapFlowTextPort, trace: readonly MapEffectStatusConsumeTraceEntry[] | undefined): string[] {
  return (trace ?? []).map(entry => {
    const holder = entry.identity.kind === 'partyCharacter'
      ? port.nameOf('character', entry.identity.id)
      : `敌方 ${port.nameOf('enemy', entry.identity.id)}`;
    const instances = entry.changes.map(change =>
      `${port.formatNumber(change.statusBefore.stacks)} → ${port.formatNumber(change.statusAfter?.stacks ?? 0)}层`);
    const details = instances.length ? `；实例 ${instances.join('、')}` : '；没有匹配实例';
    return `${statusConsumeSourceLabel(port, entry)}：${holder} 的 Status ${entry.statusId} · 请求 ${port.formatNumber(entry.requestedStacks)}层 / 已消费 ${port.formatNumber(entry.consumedStacks)}层 / 缺额 ${port.formatNumber(entry.unmetStacks)}层${details}`;
  });
}

function statusCategoryRemoveSourceLabel(port: MapFlowTextPort, trace: MapEffectStatusCategoryRemoveTraceEntry): string {
  const action = port.nameOf('action', trace.actionId);
  const source = trace.source;
  if (!source) return action;
  if (source.kind === 'partyCharacter') return `${port.nameOf('character', source.id)} · ${action}`;
  if (source.kind === 'enemy') return `敌方 ${port.nameOf('enemy', source.id)} · ${action}`;
  if (source.kind === 'ability') return `Ability · ${action}`;
  return `Item ${port.nameOf('item', source.itemId)} · ${action}`;
}

function statusCategoryRemoveTraceLines(port: MapFlowTextPort, trace: readonly MapEffectStatusCategoryRemoveTraceEntry[] | undefined): string[] {
  return (trace ?? []).map(entry => {
    const holder = entry.identity.kind === 'partyCharacter'
      ? port.nameOf('character', entry.identity.id)
      : `敌方 ${port.nameOf('enemy', entry.identity.id)}`;
    const instances = entry.removed.map(row =>
      `Status ${row.status.statusId}（${port.formatNumber(row.status.stacks)}层，原数组位置 ${port.formatNumber(row.statusIndexBefore + 1)}）`);
    const details = instances.length ? `；移除实例 ${instances.join('、')}` : '；没有匹配实例';
    return `${statusCategoryRemoveSourceLabel(port, entry)}：${holder} 的 ${entry.category} 类 Status${details}`;
  });
}

function triggerTraceLines(
  port: MapFlowTextPort,
  trace: readonly MapEffectTriggerTraceEntry[] | undefined,
): string[] {
  return (trace ?? []).map(entry => {
    const target = entry.target.kind === 'partyCharacter'
      ? port.nameOf('character', entry.target.id)
      : `敌方 ${port.nameOf('enemy', entry.target.id)}`;
    const label = entry.event === 'healApplied' ? 'Heal Trigger'
      : entry.event === 'damageApplied' ? 'Damage Trigger' : 'Defeat Trigger';
    const parent = entry.event === 'healApplied' ? 'Heal' : 'Damage';
    const requested = entry.event === 'healApplied'
      ? `请求治疗 ${port.formatNumber(entry.requestedAmount)}`
      : `请求伤害 ${port.formatNumber(entry.requestedAmount)}（减伤/Shield 前）`;
    const actual = entry.event === 'healApplied' ? '实际恢复'
      : entry.event === 'damageApplied' ? '实际损失 HP' : '致死命中实际损失 HP';
    const recipient = entry.event === 'enemyDefeated'
      ? `；奖励领取者 ${port.nameOf('character', entry.rewardRecipient.id)}` : '';
    return `${label} ${port.formatNumber(entry.queueIndex)} · ${entry.triggerId} · ${entry.event} · 执行 ${port.formatNumber(entry.parentExecutionIndex + 1)} ${port.nameOf('action', entry.actionId)}（父 ${parent} ${entry.eventPath}）→ ${target}${recipient}：${requested}，${actual} ${port.formatNumber(entry.actualAppliedAmount)} → ${port.nameOf('resource', entry.resourceId)} ${signedDeltaLabel(port, entry.delta)}（${entry.path}）`;
  });
}

function statusExpirySourceLabel(port: MapFlowTextPort, status: MapEffectStatusExpiryTriggerTraceEntry['status']): string {
  const action = port.nameOf('action', status.actionId);
  if (status.source.kind === 'partyCharacter') return `${port.nameOf('character', status.source.id)} · ${action}`;
  if (status.source.kind === 'enemy') return `敌方 ${port.nameOf('enemy', status.source.id)} · ${action}`;
  if (status.source.kind === 'ability') return `Ability · ${action}`;
  return `Item ${port.nameOf('item', status.source.itemId)} · ${action}`;
}

function statusExpiryTriggerLines(
  port: MapFlowTextPort,
  trace: readonly MapEffectStatusExpiryTriggerTraceEntry[] | undefined,
): string[] {
  return (trace ?? []).map(entry => {
    const holder = entry.holder.kind === 'partyCharacter'
      ? port.nameOf('character', entry.holder.id)
      : `敌方 ${port.nameOf('enemy', entry.holder.id)}`;
    const reward = `${port.nameOf('resource', entry.resourceId)} ${signedDeltaLabel(port, entry.delta)}`
      + `（${port.formatNumber(entry.balanceBefore)} → ${port.formatNumber(entry.balanceAfter)}）`;
    return `Status 到期回馈 ${port.formatNumber(entry.queueIndex)} · ${entry.status.statusId} · 持有者 ${holder}`
      + ` · 来源 ${statusExpirySourceLabel(port, entry.status)}`
      + ` · 剩余 ${port.formatNumber(entry.status.remainingRounds)} 轮 → ${reward}`;
  });
}

function statusDamageTriggerLines(
  port: MapFlowTextPort,
  trace: readonly MapEffectStatusDamageTriggerTraceEntry[] | undefined,
): string[] {
  return (trace ?? []).map(entry => {
    const holder = entry.holder.kind === 'partyCharacter'
      ? port.nameOf('character', entry.holder.id)
      : `敌方 ${port.nameOf('enemy', entry.holder.id)}`;
    return `Status 受伤回馈 ${port.formatNumber(entry.queueIndex)} · ${port.nameOf('action', entry.actionId)} ${entry.hitPath} · 持有者 ${holder} · Status ${entry.status.statusId}（来源 ${statusExpirySourceLabel(port, entry.status)}）· 实际损失 HP ${port.formatNumber(entry.actualAppliedAmount)} → ${port.nameOf('resource', entry.resourceId)} ${signedDeltaLabel(port, entry.delta)}（${port.formatNumber(entry.balanceBefore)}→${port.formatNumber(entry.balanceAfter)}）`;
  });
}

function triggerQueueLines(
  port: MapFlowTextPort,
  actionTrace: readonly MapEffectTriggerTraceEntry[] | undefined,
  statusDamageTrace: readonly MapEffectStatusDamageTriggerTraceEntry[] | undefined,
): string[] {
  return [
    ...(actionTrace ?? []).map(entry => ({ queueIndex: entry.queueIndex, line: triggerTraceLines(port, [entry])[0]! })),
    ...(statusDamageTrace ?? []).map(entry => ({ queueIndex: entry.queueIndex, line: statusDamageTriggerLines(port, [entry])[0]! })),
  ].sort((left, right) => left.queueIndex - right.queueIndex).map(row => row.line);
}

function enemySkipLabel(reason: MapRunEncounterEnemyActionSettlement['skipReason']): string {
  switch (reason) {
    case 'defeated': return '行动前已倒下，跳过';
    case 'noLegalTarget': return '没有合法目标，跳过';
    case 'unaffordable': return '费用不足，跳过';
    case 'roundEnded': return '本场战斗已结束，跳过';
    default: return '';
  }
}

function enemyActionRows(
  port: MapFlowTextPort,
  rows: readonly (MapRunEncounterEnemyActionSettlement | MapWorkspaceEnemyActionSettlementView)[],
): CommitView['enemyActions'] {
  return rows.map(row => ({
    enemyId: row.enemyId,
    actionName: 'action' in row
      ? row.action?.name ?? '待机'
      : row.actionId ? port_name(port, 'action', row.actionId) : '待机',
    targetCharacterId: row.targetCharacterId ?? null,
    targetEnemyId: row.targetEnemyId ?? null,
    targetCard: row.targetCard !== undefined,
    ...(row.skipReason === undefined ? {} : { skipReason: row.skipReason }),
    ...(row.scostCost ? { scostCost: row.scostCost } : {}),
    resourceChanges: row.resourceChanges,
    hpChanges: row.hpChanges ?? [],
  }));
}

/** 持久回执 → 归一化视图；动作名称走 UIContext 查询。 */
function commitViewFromReceipt(port: MapFlowTextPort, receipt: MapRunEncounterCommitReceipt, cards: readonly MapRunCardInstance[]): CommitView {
  const triggerTrace = receipt.triggerTrace;
  return {
    requestId: receipt.requestId,
    nodeId: receipt.nodeId,
    ...(receipt.activityId === undefined ? {} : { activityId: receipt.activityId }),
    round: receipt.round,
    ...(receipt.executionContractId === undefined ? {} : { executionContractId: receipt.executionContractId }),
    ...(receipt.executionSequence === undefined ? {} : { executionSequence: receipt.executionSequence.map(row => {
      const actionName = targetCardActionName(port, row, cards);
      return { ...row, ...(actionName === undefined ? {} : { targetCardActionName: actionName }) };
    }) }),
    settlements: receipt.settlements.map(settlement => ({
      characterId: settlement.characterId,
      actionName: settlement.actionId ? port_name(port, 'action', settlement.actionId) : 'Wait',
      targetCharacterId: settlement.targetCharacterId,
      targetEnemyId: settlement.targetEnemyId ?? null,
      overrideKind: settlement.overrideKind,
      playerCostSpent: settlement.playerCostSpent,
      scostCost: settlement.scostCost,
      resourceChanges: settlement.resourceChanges,
      hpChanges: settlement.hpChanges ?? [],
    })),
    ability: receipt.ability ? {
      actionName: port_name(port, 'action', receipt.ability.actionId),
      target: receipt.ability.target,
      playerCostSpent: receipt.ability.playerCostSpent,
      resourceChanges: receipt.ability.resourceChanges,
      hpChanges: receipt.ability.hpChanges,
    } : null,
    item: receipt.item ? {
      itemName: port_name(port, 'item', receipt.item.itemId),
      target: receipt.item.target,
      consumedCount: receipt.item.consumedCount,
      resourceChanges: receipt.item.resourceChanges,
      hpChanges: receipt.item.hpChanges,
    } : null,
    enemyActions: enemyActionRows(port, receipt.enemyActions ?? []),
    ...(receipt.effectTrace === undefined ? {} : { effectTrace: receipt.effectTrace }),
    ...(receipt.statusConsumeTrace === undefined ? {} : { statusConsumeTrace: receipt.statusConsumeTrace }),
    ...(receipt.statusCategoryRemoveTrace === undefined ? {} : { statusCategoryRemoveTrace: receipt.statusCategoryRemoveTrace }),
    ...(triggerTrace === undefined ? {} : { triggerTrace }),
    ...(receipt.statusExpiryTriggerTrace === undefined ? {} : { statusExpiryTriggerTrace: receipt.statusExpiryTriggerTrace }),
    ...(receipt.statusDamageTriggerTrace === undefined ? {} : { statusDamageTriggerTrace: receipt.statusDamageTriggerTrace }),
    ...(receipt.shieldTrace === undefined ? {} : { shieldTrace: receipt.shieldTrace }),
  };
}

/** 结算逐行正文：角色结算 → Ability → Item → 敌方行动。 */
function commitLines(port: MapFlowTextPort, commit: CommitView): string[] {
  const lines: string[] = [];
  if (commit.executionContractId === 'AG-1') {
    lines.push(...(commit.executionSequence === undefined
      ? ['AG-1 执行序列暂不可用。']
      : executionSequenceLines(port, commit.executionSequence)));
    lines.push(...effectTraceLines(port, commit.effectTrace));
    lines.push(...statusConsumeTraceLines(port, commit.statusConsumeTrace));
    lines.push(...statusCategoryRemoveTraceLines(port, commit.statusCategoryRemoveTrace));
    lines.push(...triggerQueueLines(port, commit.triggerTrace, commit.statusDamageTriggerTrace));
    lines.push(...statusExpiryTriggerLines(port, commit.statusExpiryTriggerTrace));
    lines.push(...shieldTraceLines(port, commit.shieldTrace));
    return lines;
  }
  if (commit.settlements.length === 0) lines.push('本轮没有队员行动结算。');
  for (const settlement of commit.settlements) {
    const actor = port_name(port, 'character', settlement.characterId);
    const target = settlement.targetCharacterId
      ? ` → ${port_name(port, 'character', settlement.targetCharacterId)}`
      : settlement.targetEnemyId ? ` → 敌方 ${settlement.targetEnemyId}` : '';
    const override = settlement.overrideKind === 'playerCommand' ? ' · PlayerCommand'
      : settlement.overrideKind === 'swap' ? ' · Swap' : '';
    const playerCost = settlement.playerCostSpent > 0 ? ` · −${settlement.playerCostSpent} PlayerCost` : '';
    const resources = resourcesLabel(port, settlement.resourceChanges);
    const cost = settlement.scostCost;
    const scost = cost ? ` · sCost 原费 ${port.formatNumber(cost.original)} / 减免 ${port.formatNumber(cost.discount)} / 实扣 ${port.formatNumber(cost.paid)}` : '';
    const hp = settlement.hpChanges.length ? hpChangesLabel(port, settlement.hpChanges) : '';
    lines.push(`${actor}：${settlement.actionName}${override}${target}${playerCost}${resources ? ` · ${resources}` : ''}${scost}${hp ? ` · ${hp}` : ''}`);
  }
  if (commit.ability) {
    const resources = resourcesLabel(port, commit.ability.resourceChanges);
    const hp = commit.ability.hpChanges.length ? ` · ${hpChangesLabel(port, commit.ability.hpChanges)}` : '';
    lines.push(`Ability：${commit.ability.actionName} → ${targetLabel(port, commit.ability.target)} · −${commit.ability.playerCostSpent} PlayerCost${resources ? ` · ${resources}` : ''}${hp}`);
  }
  if (commit.item) {
    const resources = resourcesLabel(port, commit.item.resourceChanges);
    const hp = commit.item.hpChanges.length ? ` · ${hpChangesLabel(port, commit.item.hpChanges)}` : '';
    lines.push(`Item：${commit.item.itemName} → ${targetLabel(port, commit.item.target)} · 消耗 ${commit.item.consumedCount}${resources ? ` · ${resources}` : ''}${hp}`);
  }
  for (const action of commit.enemyActions) {
    const actor = `敌方 ${port_name(port, 'enemy', action.enemyId)}`;
    if (action.skipReason) {
      lines.push(`${actor}：${action.actionName} · ${enemySkipLabel(action.skipReason)}`);
      continue;
    }
    const target = action.targetCharacterId
      ? ` → ${port_name(port, 'character', action.targetCharacterId)}`
      : action.targetEnemyId ? ` → 敌方 ${port_name(port, 'enemy', action.targetEnemyId)}`
        : action.targetCard ? ' → 卡牌目标' : '';
    const cost = action.scostCost
      ? ` · sCost 实扣 ${port.formatNumber(action.scostCost.paid)}` : '';
    const resources = resourcesLabel(port, action.resourceChanges);
    const hp = action.hpChanges.length ? hpChangesLabel(port, action.hpChanges) : '';
    lines.push(`${actor}：${action.actionName}${target}${cost}${resources ? ` · ${resources}` : ''}${hp ? ` · ${hp}` : ''}`);
  }
  lines.push(...effectTraceLines(port, commit.effectTrace));
  lines.push(...triggerQueueLines(port, commit.triggerTrace, commit.statusDamageTriggerTrace));
  lines.push(...statusExpiryTriggerLines(port, commit.statusExpiryTriggerTrace));
  lines.push(...shieldTraceLines(port, commit.shieldTrace));
  return lines;
}

function sourceIdFromSequenceKey(row: MapRunEncounterExecutionSequenceEntry): string | null {
  if (row.owner) return row.owner.id;
  try {
    const identity: unknown = JSON.parse(row.sourceKey);
    if (Array.isArray(identity) && identity[5] === row.sourceKind && identity[7] === row.actionId
      && typeof identity[6] === 'string') return identity[6];
  } catch { /* Keep the source kind and Action as the readable fallback. */ }
  return null;
}

function executionSourceLabel(
  port: MapFlowTextPort,
  row: MapRunEncounterExecutionSequenceEntry & { readonly sourceId?: string | null },
): string {
  if (row.sourceKind === 'partyAction' && row.owner?.kind === 'partyCharacter') {
    const owner = port.nameOf('character', row.owner.id);
    return row.cardRef === null ? `${owner} · 指令` : owner;
  }
  if (row.sourceKind === 'enemyAction' && row.owner?.kind === 'enemy') return `敌方 ${port.nameOf('enemy', row.owner.id)}`;
  if (row.sourceKind === 'ability') return 'Ability';
  const itemId = row.sourceId ?? sourceIdFromSequenceKey(row) ?? row.actionId;
  return `Item ${port.nameOf('item', itemId)}`;
}

function executionTargetLabel(port: MapFlowTextPort, row: MapRunEncounterExecutionSequenceEntry & { readonly targetCardActionName?: string }): string {
  if (row.target.kind === 'partyCharacter') return port.nameOf('character', row.target.characterId);
  if (row.target.kind === 'enemy') return `敌方 ${port.nameOf('enemy', row.target.enemyId)}`;
  if (row.target.kind === 'card') return row.targetCardActionName ? `卡牌目标：${row.targetCardActionName}` : '卡牌目标';
  return '无单位目标';
}

function executionSkipLabel(reason: NonNullable<MapRunEncounterExecutionSequenceEntry['skipReason']>): string {
  switch (reason) {
    case 'defeated': return '来源开始时已倒下，跳过';
    case 'noLegalTarget': return '没有合法目标，跳过';
    case 'unaffordable': return '费用不足，跳过';
    case 'roundEnded': return '本轮已终结，跳过';
  }
}

function executionSequenceLines(
  port: MapFlowTextPort,
  sequence: readonly (MapRunEncounterExecutionSequenceEntry & {
    readonly sourceId?: string | null;
    readonly actionName?: string;
    readonly targetCardActionName?: string;
  })[],
): string[] {
  if (sequence.length === 0) return ['本轮没有已选执行来源。'];
  return sequence.map(row => {
    const action = row.actionName ?? port.nameOf('action', row.actionId);
    const details: string[] = [];
    if (row.skipReason) details.push(executionSkipLabel(row.skipReason));
    if (row.playerCostSpent > 0) details.push(`−${port.formatNumber(row.playerCostSpent)} PlayerCost`);
    if (row.sourceKind === 'item') details.push(row.itemConsumed ? '消耗道具' : '未消耗道具');
    if (!row.skipReason) {
      for (const change of row.resourceChanges) {
        const enemyId = change.enemyId;
        const owner = change.scope === 'actor'
          ? change.characterId ? `${port.nameOf('character', change.characterId)} `
            : `敌方 ${enemyId ? port.nameOf('enemy', enemyId) : '单位'} `
          : change.teamSide === 'enemy' ? '敌方共用 ' : '队伍 ';
        details.push(`${owner}${port.nameOf('resource', change.resourceId)} ${signedDeltaLabel(port, change.delta)}`);
      }
      details.push(...row.hpChanges.map(change => {
        const owner = change.scope === 'party' ? port.nameOf('character', change.characterId)
          : `敌方 ${port.nameOf('enemy', change.enemyId)}`;
        return `${owner} ${hpLabel(change.delta)}`;
      }));
    }
    if (details.length === 0) details.push('没有 HP 或资源变化');
    return `执行 ${port.formatNumber(row.executionIndex + 1)}：${executionSourceLabel(port, row)} · ${action} → ${executionTargetLabel(port, row)} · ${details.join(' · ')}`;
  });
}

function targetCardActionName(
  port: MapFlowTextPort,
  row: MapRunEncounterExecutionSequenceEntry,
  cards: readonly MapRunCardInstance[],
): string | undefined {
  if (row.target.kind !== 'card') return undefined;
  const targetCardRef = row.target.cardRef;
  if (!targetCardRef) return undefined;
  const card = cards.find(candidate => sameMapCardRef(candidate.ref, targetCardRef));
  return card?.actionId ? port.nameOf('action', card.actionId) : undefined;
}

function sameMapCardRef(left: MapRunCardRef, right: MapRunCardRef): boolean {
  return left.kind === right.kind && left.id === right.id
    && left.scope.runId === right.scope.runId && left.scope.mapId === right.scope.mapId
    && left.scope.nodeId === right.scope.nodeId && left.scope.activityId === right.scope.activityId
    && left.scope.round === right.scope.round;
}

/** 把活动 View 的当前活动 ID 收敛为「属于当前地点」的那一个。 */
function currentActivityId(view: MapRunActiveWorkspaceView, nodeId: string): string | null {
  const activity = view.run.activeActivity;
  return activity && activity.nodeId === nodeId ? activity.activityId : null;
}

function nodeView(view: MapRunActiveWorkspaceView): MapWorkspaceNodeView | undefined {
  return view.map.nodes.find(node => node.id === view.run.currentNodeId);
}

/**
 * 一个 MapRun 的 UI 临时流：基线来自 detached View，查询条目来自当前会话。
 * 只在 UI 层持有，不进入 MapRun Save；`dispose()` 于离开 Run 时清空。
 */
export class MapFlowModel {
  readonly runId: string;
  readonly streamKey: string;
  private readonly port: MapFlowTextPort;
  private entries: FlowEntry[] = [];
  private sequence = 0;

  constructor(runId: string, port: MapFlowTextPort) {
    this.runId = runId;
    this.streamKey = `map:${runId}`;
    this.port = port;
  }

  /** 当前有序条目（只读快照）。 */
  get snapshot(): readonly FlowEntry[] {
    return this.entries;
  }

  /**
   * 用一份 detached View 校正基线：
   * 同键原位更新、来源消失的当前条目移除、新来源按基线顺序尾插；
   * 查询条目与会话内观察到的回执不参与重排。
   */
  sync(view: MapRunWorkspaceView): readonly FlowEntry[] {
    const baseline = this.baselineFor(view);
    const pending = new Map(baseline.map(entry => [entry.instanceKey, entry]));
    const next: FlowEntry[] = [];

    for (const existing of this.entries) {
      if (existing.lifecycle !== 'current') {
        next.push(existing);
        continue;
      }
      const updated = pending.get(existing.instanceKey);
      if (!updated) continue;
      next.push(updated);
      pending.delete(existing.instanceKey);
    }
    // 会话内保留的 observed 条目也已在 next 中，不能再次追加同一实例键。
    const present = new Set(next.map(entry => entry.instanceKey));
    for (const entry of baseline) {
      if (!pending.has(entry.instanceKey) || present.has(entry.instanceKey)) continue;
      applyFlowEntryInPlace(next, entry, FLOW_STREAM_MAX);
      present.add(entry.instanceKey);
      pending.delete(entry.instanceKey);
    }

    this.entries = next;
    this.markLatestCommit();
    return this.entries;
  }

  /**
   * 只有最新一条回执带 `data-map-recent-commit`：会话内保留的旧回执继续显示，
   * 但不与“最近提交结果”的单例语义（焦点／跟随）冲突。
   */
  private markLatestCommit(): void {
    let latest = -1;
    for (let index = 0; index < this.entries.length; index += 1) {
      if (this.entries[index].source?.kind === 'map.commit') latest = index;
    }
    if (latest < 0) return;
    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      if (entry.source?.kind !== 'map.commit') continue;
      const requestId = entry.source.id;
      const marks: Record<string, string | true> = {};
      for (const [name, value] of Object.entries(entry.marks ?? {})) {
        if (name === 'data-map-recent-commit' || name === 'data-map-region-key') continue;
        marks[name] = value;
      }
      const isLatest = index === latest && requestId !== undefined;
      marks['data-map-region-key'] = isLatest ? 'feed-recent-commit' : `feed-commit:${requestId ?? index}`;
      if (isLatest) marks['data-map-recent-commit'] = requestId;
      this.entries[index] = { ...entry, marks };
    }
  }

  /**
   * 查看地图：概览不在流末两条时按同一逻辑 ID 定向替换并移到末尾；
   * 已在末两条时移除。条目仅属于当前 Run 的 UI 会话。
   */
  toggleMapOverview(view: MapRunActiveWorkspaceView): readonly FlowEntry[] {
    const existingIndex = this.entries.findIndex(entry => entry.contentId === MAP_FLOW_MAP_OVERVIEW_SLOT);
    if (existingIndex >= 0 && existingIndex >= this.entries.length - 2) {
      this.entries.splice(existingIndex, 1);
      return this.entries;
    }

    this.sequence += 1;
    const currentNodeExists = view.map.nodes.some(node => node.id === view.run.currentNodeId);
    const mapIsReadable = view.map.nodes.length > 0 && currentNodeExists;
    const entry: FlowEntry = {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('map-overview', String(this.sequence)),
      contentId: MAP_FLOW_MAP_OVERVIEW_SLOT,
      repeatPolicy: 'replaceSameId',
      lifecycle: 'observed',
      kind: mapIsReadable ? 'map' : 'narration',
      ...(mapIsReadable ? {
        noAvatar: true,
        speaker: view.map.name,
        text: '地图地点',
        mapOverview: {
          mapName: view.map.name,
          nodes: view.map.nodes.map(node => {
            const completed = view.run.completedEncounterNodeIds.includes(node.id);
            const visited = view.run.visitedNodeIds.includes(node.id);
            const state = node.id === view.run.currentNodeId ? 'current'
              : completed ? 'completed' : visited ? 'visited' : 'unvisited';
            const stateLabel = state === 'current' ? '当前位置'
              : state === 'completed' ? '已完成'
                : state === 'visited' ? '已访问' : '未到达';
            return { title: node.title, state, stateLabel };
          }),
        },
      } : {
        text: '当前地图地点信息暂不可读取。',
        align: 'center' as const,
      }),
      marks: { 'data-map-overview': this.runId },
      source: { kind: 'map.overview', id: this.runId },
    };
    applyFlowEntryInPlace(this.entries, entry, FLOW_STREAM_MAX);
    return this.entries;
  }

  /** 仅由成功的移动命令调用；不通过快照差异猜测移动历史。 */
  recordMovement(from: MapWorkspaceNodeView, to: MapWorkspaceNodeView): void {
    this.entries = this.entries.filter(entry => entry.contentId !== MAP_FLOW_MOVE_CHOICES_SLOT);
    this.sequence += 1;
    applyFlowEntryInPlace(this.entries, {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('movement', String(this.sequence)),
      lifecycle: 'observed',
      kind: 'narration',
      text: `从${from.title}移动到了${to.title}`,
      marks: { 'data-map-movement': true },
      source: { kind: 'map.movement', id: String(this.sequence) },
    }, FLOW_STREAM_MAX);
  }

  /** 离开 Run：清空临时序列与查询事实。 */
  dispose(): void {
    this.entries.length = 0;
    this.sequence = 0;
  }

  private baselineFor(view: MapRunWorkspaceView): FlowEntry[] {
    if (view.kind === 'success') return [this.resultEntry(view)];
    if (view.kind === 'failure') return [this.failureEntry(view)];
    return this.activeBaseline(view);
  }

  private activeBaseline(view: MapRunActiveWorkspaceView): FlowEntry[] {
    const entries: FlowEntry[] = [];
    const node = nodeView(view);
    if (node) entries.push(this.nodeEntry(view, node));
    if (view.currentEncounter) entries.push(this.encounterEntry(view, view.currentEncounter));
    const commit = this.commitView(view);
    if (commit) entries.push(this.commitEntry(view, commit));
    const purchase = this.shopPurchaseEntry(view);
    if (purchase) entries.push(purchase);
    const movement = this.moveChoicesEntry(view);
    if (movement) entries.push(movement);
    return entries;
  }

  private moveChoicesEntry(view: MapRunActiveWorkspaceView): FlowEntry | null {
    const locations = mapLocationChoices(view, this.port, this.streamKey);
    if (!locations) return null;
    return {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('move-choices', view.run.currentNodeId),
      contentId: MAP_FLOW_MOVE_CHOICES_SLOT,
      repeatPolicy: 'replaceSameId',
      lifecycle: 'current',
      kind: 'talk', noAvatar: true,
      speaker: '移动', text: '选择目的地点', heading: 2,
      mapLocations: locations,
      marks: { 'data-map-move-choices': view.run.currentNodeId },
      source: { kind: 'map.move-choices', id: view.run.currentNodeId },
    };
  }

  private nodeEntry(view: MapRunActiveWorkspaceView, node: MapWorkspaceNodeView): FlowEntry {
    const activityId = currentActivityId(view, node.id);
    return {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('node', `${node.id}:${activityId ?? '-'}`),
      contentId: MAP_FLOW_CURRENT_NODE_SLOT,
      repeatPolicy: 'replaceSameId',
      lifecycle: 'current',
      kind: 'talk',
      noAvatar: true,
      speaker: `${view.map.name} · 当前地点`,
      text: node.title,
      heading: 1,
      lines: node.description ? [node.description] : [],
      marks: {
        'data-map-current-node': node.id,
        'data-map-region-key': `feed-node:${node.id}`,
      },
      headingMarks: view.currentEncounter
        ? undefined
        : { 'data-map-focus-heading': true, tabindex: '-1' },
      source: { kind: 'map.node', id: node.id },
    };
  }

  private encounterEntry(view: MapRunActiveWorkspaceView, encounter: MapEncounterQueryView): FlowEntry {
    const activityId = currentActivityId(view, encounter.nodeId);
    const lines: string[] = [];
    if (encounter.description) lines.push(encounter.description);
    if (encounter.rounds !== undefined && encounter.round !== undefined) {
      lines.push(`休整进度：第 ${encounter.round} / ${encounter.rounds} 轮`);
    }
    lines.push('移动已锁定。完成当前遭遇后会回到此地点。');
    return {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('encounter', `${encounter.nodeId}:${activityId ?? '-'}`),
      contentId: MAP_FLOW_CURRENT_ENCOUNTER_SLOT,
      repeatPolicy: 'replaceSameId',
      lifecycle: 'current',
      kind: 'talk',
      noAvatar: true,
      speaker: '当前遭遇',
      text: encounter.title,
      heading: 2,
      lines,
      marks: {
        'data-map-region-key': `feed-encounter:${encounter.nodeId}`,
        'data-map-encounter-state': 'active',
        ...(encounter.rounds !== undefined && encounter.round !== undefined
          ? { 'data-map-rest-rounds': true }
          : {}),
      },
      headingMarks: { 'data-map-focus-heading': true, tabindex: '-1' },
      source: { kind: 'map.encounter', id: encounter.nodeId },
    };
  }

  private commitView(view: MapRunActiveWorkspaceView): CommitView | null {
    const projected = view.actionPreview?.recentCommit;
    if (projected) {
      const triggerTrace = projected.triggerTrace;
      return {
        requestId: projected.requestId,
        nodeId: projected.nodeId,
        ...(projected.activityId === undefined ? {} : { activityId: projected.activityId }),
        round: projected.round,
        ...(projected.executionContractId === undefined ? {} : { executionContractId: projected.executionContractId }),
        ...(projected.executionSequence === undefined ? {} : { executionSequence: projected.executionSequence.map(row => {
          const actionName = targetCardActionName(this.port, row, view.cards);
          return { ...row, ...(actionName === undefined ? {} : { targetCardActionName: actionName }) };
        }) }),
        settlements: projected.settlements.map(settlement => ({
          characterId: settlement.characterId,
          actionName: settlement.action?.name ?? 'Wait',
          scostCost: settlement.scostCost,
          targetCharacterId: settlement.targetCharacterId,
          targetEnemyId: settlement.targetEnemyId,
          overrideKind: settlement.overrideKind,
          playerCostSpent: settlement.playerCostSpent,
          resourceChanges: settlement.resourceChanges,
          hpChanges: settlement.hpChanges,
        })),
        ability: projected.ability ? {
          actionName: projected.ability.action?.name ?? '行动',
          target: projected.ability.target,
          playerCostSpent: projected.ability.playerCostSpent,
          resourceChanges: projected.ability.resourceChanges ?? [],
          hpChanges: projected.ability.hpChanges,
        } : null,
        item: projected.item ? {
          itemName: projected.item.itemName,
          target: projected.item.target,
          consumedCount: projected.item.consumedCount,
          resourceChanges: projected.item.resourceChanges ?? [],
          hpChanges: projected.item.hpChanges,
        } : null,
        enemyActions: enemyActionRows(this.port, projected.enemyActions),
        ...(projected.effectTrace === undefined ? {} : { effectTrace: projected.effectTrace }),
        ...(projected.statusConsumeTrace === undefined ? {} : { statusConsumeTrace: projected.statusConsumeTrace }),
        ...(projected.statusCategoryRemoveTrace === undefined ? {} : { statusCategoryRemoveTrace: projected.statusCategoryRemoveTrace }),
        ...(triggerTrace === undefined ? {} : { triggerTrace }),
        ...(projected.statusExpiryTriggerTrace === undefined ? {} : { statusExpiryTriggerTrace: projected.statusExpiryTriggerTrace }),
        ...(projected.statusDamageTriggerTrace === undefined ? {} : { statusDamageTriggerTrace: projected.statusDamageTriggerTrace }),
        ...(projected.shieldTrace === undefined ? {} : { shieldTrace: projected.shieldTrace }),
      };
    }
    const receipt = view.run.lastEncounterCommit;
    return receipt ? commitViewFromReceipt(this.port, receipt, view.cards) : null;
  }

  private commitEntry(view: MapRunActiveWorkspaceView, commit: CommitView): FlowEntry {
    const origin = view.map.nodes.find(node => node.id === commit.nodeId)?.title ?? commit.nodeId;
    const sameNode = commit.nodeId === view.run.currentNodeId;
    const originalActivity = commit.activityId !== undefined
      && commit.activityId !== currentActivityId(view, commit.nodeId);
    const locationLabel = !sameNode ? '最近结算 · 原地点'
      : originalActivity ? '最近结算 · 原活动' : '最近提交结果';
    return {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('commit', commit.requestId),
      lifecycle: 'observed',
      kind: 'talk',
      noAvatar: true,
      speaker: `${locationLabel} · ${origin} · 第 ${commit.round} 轮结果`,
      text: '',
      lines: commitLines(this.port, commit),
      marks: {
        'data-map-commit-receipt': commit.requestId,
        'data-map-commit-node-id': commit.nodeId,
        ...(commit.activityId === undefined ? {} : { 'data-map-commit-activity-id': commit.activityId }),
        role: 'status',
      },
      source: { kind: 'map.commit', id: commit.requestId },
    };
  }

  private shopPurchaseEntry(view: MapRunActiveWorkspaceView): FlowEntry | null {
    const shop = view.shop;
    const purchase = shop?.lastPurchase;
    if (!shop || !purchase) return null;
    const offerName = shop.offers.find(offer => offer.offerId === purchase.offerId)?.name ?? purchase.offerId;
    return {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('shop-purchase', purchase.requestId),
      lifecycle: 'current',
      kind: 'talk',
      noAvatar: true,
      speaker: shop.title,
      text: `最近购买：${offerName}`,
      lines: [],
      marks: {
        'data-map-shop-purchase': purchase.requestId,
        'data-map-region-key': 'feed-shop-purchase',
      },
      source: { kind: 'map.shop-purchase', id: purchase.requestId },
    };
  }

  private resultEntry(view: MapRunSuccessWorkspaceView): FlowEntry {
    return {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('result', 'success'),
      lifecycle: 'current',
      kind: 'talk',
      noAvatar: true,
      speaker: view.result.mapName,
      text: '地图路线已完成',
      heading: 1,
      lines: [`本次探索已到达出口地点 ${view.result.exitNodeTitle}。`],
      marks: {
        'data-map-run-result': 'success',
        'data-map-region-key': 'feed-success',
      },
      headingMarks: { 'data-map-focus-heading': true, tabindex: '-1' },
      source: { kind: 'map.result', id: 'success' },
    };
  }

  private failureEntry(view: MapRunFailureWorkspaceView): FlowEntry {
    const failedNode = view.map.nodes.find(node => node.id === view.result.failedNodeId);
    const lines = ['队伍已无法继续战斗，本次地图探索结束。'];
    if (failedNode) lines.push(`失败地点：${failedNode.title}`);
    return {
      streamKey: this.streamKey,
      instanceKey: mapInstanceKey('result', 'failure'),
      lifecycle: 'current',
      kind: 'talk',
      noAvatar: true,
      speaker: view.map.name,
      text: '探索失败',
      heading: 1,
      lines,
      marks: {
        'data-map-run-result': 'failure',
        'data-map-region-key': 'feed-failure',
      },
      headingMarks: { 'data-map-focus-heading': true, tabindex: '-1' },
      source: { kind: 'map.result', id: 'failure' },
    };
  }
}
