import {
  AREA_CONTENT_POLICY,
  ENHANCEMENT_CONTENT_POLICY,
  INIT_CONTENT_POLICY,
  SPOT_CONTENT_POLICY,
} from '../content-policies';
import type {
  ContentApplyStrategy,
  ContentAuthoringPolicy,
  ContentKey,
  FieldConsumer,
  FieldInvalidation,
  FieldMaterialization,
} from '../content-policy-types';

export const WORLD_DOMAIN_KEY = 'world-domain' as const;
export const WORLD_DOMAIN_CONTRACT_VERSION = 'def-editor-world-domain/1' as const;

export type WorldContentKey = Extract<ContentKey, 'inits' | 'areas' | 'spots' | 'enhancements'>;
export type WorldCapabilityLevel = 'R0' | 'R1' | 'D1' | 'A1';
export type WorldMaterializationStatus =
  | 'ready'
  | 'missing-materialization'
  | 'missing-consumer'
  | 'missing-invalidation-trigger'
  | 'orphaned';

export type WorldCapabilityReasonCode =
  | 'no-writable-surface'
  | 'missing-materialization'
  | 'missing-consumer'
  | 'missing-invalidation-trigger'
  | 'reload-strategy'
  | 'runtime-mutation-unavailable'
  | 'opaque-structure';

export interface WorldCapabilityReason {
  readonly code: WorldCapabilityReasonCode;
  readonly level: 'D1' | 'A1' | 'opaqueSafe' | 'runtimeReady';
  readonly message: string;
  readonly fields?: readonly string[];
}

export interface WorldCapabilitySummary {
  readonly browse: boolean;
  readonly inspect: boolean;
  readonly draft: boolean;
  readonly apply: boolean;
  readonly r0: boolean;
  readonly r1: boolean;
  readonly d1: boolean;
  readonly a1: boolean;
  readonly levels: readonly WorldCapabilityLevel[];
  readonly level: WorldCapabilityLevel;
  readonly reasons: readonly WorldCapabilityReason[];
}

export interface WorldMaterializationSummary {
  readonly field: string;
  readonly status: WorldMaterializationStatus;
  readonly consumers: readonly FieldConsumer[];
  readonly invalidate: FieldInvalidation;
  readonly trigger?: string;
}

export interface WorldPolicyCapabilitySummary {
  readonly table: WorldContentKey;
  readonly defKind: string;
  readonly label: string;
  readonly idType: string;
  readonly applyStrategy: ContentApplyStrategy;
  readonly opaqueSafe: boolean;
  readonly runtimeReady: boolean;
  readonly capabilities: WorldCapabilitySummary;
  readonly materialization: readonly WorldMaterializationSummary[];
}

export interface WorldDomainPolicySummary {
  readonly domainKey: typeof WORLD_DOMAIN_KEY;
  readonly contractVersion: typeof WORLD_DOMAIN_CONTRACT_VERSION;
  readonly capabilities: readonly WorldPolicyCapabilitySummary[];
  readonly materialization: readonly (WorldMaterializationSummary & { readonly table: WorldContentKey; readonly defKind: string })[];
}

const WORLD_POLICY_ENTRIES: readonly { readonly table: WorldContentKey; readonly defKind: string; readonly policy: ContentAuthoringPolicy }[] = [
  { table: 'inits', defKind: 'InitDef', policy: INIT_CONTENT_POLICY },
  { table: 'areas', defKind: 'AreaDef', policy: AREA_CONTENT_POLICY },
  { table: 'spots', defKind: 'SpotDef', policy: SPOT_CONTENT_POLICY },
  { table: 'enhancements', defKind: 'EnhancementDef', policy: ENHANCEMENT_CONTENT_POLICY },
];

function writableSurfaceKeys(policy: ContentAuthoringPolicy): readonly string[] {
  return [
    ...policy.fields.map(field => field.key),
    ...(policy.extensions ?? []).map(extension => extension.inputKey),
  ];
}

function cloneMaterialization(entry: FieldMaterialization): WorldMaterializationSummary {
  return {
    field: entry.field,
    status: 'ready',
    consumers: [...entry.consumers],
    invalidate: entry.invalidate,
    ...(entry.trigger === undefined ? {} : { trigger: entry.trigger }),
  };
}

function materializationStatus(
  field: string,
  entries: readonly FieldMaterialization[],
): WorldMaterializationSummary {
  const entry = entries.find(candidate => candidate.field === field);
  if (!entry) return { field, status: 'missing-materialization', consumers: [], invalidate: 'none' };
  if (entry.consumers.length === 0) {
    return {
      field,
      status: 'missing-consumer',
      consumers: [],
      invalidate: entry.invalidate,
      ...(entry.trigger === undefined ? {} : { trigger: entry.trigger }),
    };
  }
  if (entry.invalidate !== 'none' && !entry.trigger) {
    return {
      field,
      status: 'missing-invalidation-trigger',
      consumers: [...entry.consumers],
      invalidate: entry.invalidate,
    };
  }
  return cloneMaterialization(entry);
}

function capabilityReasons(
  policy: ContentAuthoringPolicy,
  materialization: readonly WorldMaterializationSummary[],
  surfaceKeys: readonly string[],
): readonly WorldCapabilityReason[] {
  const reasons: WorldCapabilityReason[] = [];
  if (surfaceKeys.length === 0) {
    reasons.push({ code: 'no-writable-surface', level: 'D1', message: 'Policy 没有登记可写字段或扩展' });
  }

  const incomplete = materialization.filter(entry => entry.status !== 'ready');
  for (const status of ['missing-materialization', 'missing-consumer', 'missing-invalidation-trigger'] as const) {
    const fields = incomplete.filter(entry => entry.status === status).map(entry => entry.field);
    if (fields.length === 0) continue;
    const message = status === 'missing-materialization'
      ? '部分字段缺少 materialization 登记'
      : status === 'missing-consumer'
        ? '部分字段没有运行时消费者'
        : '部分字段没有失效触发方';
    const level = status === 'missing-materialization' ? 'D1' : 'runtimeReady';
    reasons.push({ code: status, level, message, fields });
  }

  const runtimeMutationAvailable = policy.apply === 'local-mutation' && typeof policy.mutate === 'function';
  if (!runtimeMutationAvailable) {
    reasons.push(policy.apply === 'reload'
      ? { code: 'reload-strategy', level: 'runtimeReady', message: '当前 Policy 需要 reload；仅凭本契约不声明 Runtime Apply 已闭合' }
      : { code: 'runtime-mutation-unavailable', level: 'runtimeReady', message: '当前 Policy 没有局部 mutation 实现' });
  }
  if (policy.unsupportedFieldHint) {
    reasons.push({ code: 'opaque-structure', level: 'opaqueSafe', message: 'Policy 包含未声明的结构，不能承诺无损 opaque 回写' });
  }
  return reasons;
}

function summarizePolicy(
  table: WorldContentKey,
  defKind: string,
  policy: ContentAuthoringPolicy,
): WorldPolicyCapabilitySummary {
  const surfaceKeys = writableSurfaceKeys(policy);
  const materialization = surfaceKeys.map(field => materializationStatus(field, policy.materialization));
  const draft = surfaceKeys.length > 0 && materialization.every(entry => entry.status === 'ready');
  const runtimeReady = draft && policy.apply === 'local-mutation' && typeof policy.mutate === 'function';
  const opaqueSafe = !policy.unsupportedFieldHint;
  const reasons = capabilityReasons(policy, materialization, surfaceKeys);
  const levels: WorldCapabilityLevel[] = ['R0', 'R1'];
  if (draft) levels.push('D1');
  if (runtimeReady) levels.push('A1');

  return {
    table,
    defKind,
    label: policy.label,
    idType: policy.idType,
    applyStrategy: policy.apply,
    opaqueSafe,
    runtimeReady,
    capabilities: {
      browse: true,
      inspect: true,
      draft,
      apply: runtimeReady,
      r0: true,
      r1: true,
      d1: draft,
      a1: runtimeReady,
      levels,
      level: levels[levels.length - 1],
      reasons,
    },
    materialization,
  };
}

/**
 * World domain 的纯只读摘要；Policy 仍由集中式 Policy 表拥有，本模块不注册、不修改、不执行 Apply。
 */
export function createWorldDomainPolicySummary(): WorldDomainPolicySummary {
  const capabilities = WORLD_POLICY_ENTRIES.map(entry => summarizePolicy(entry.table, entry.defKind, entry.policy));
  return {
    domainKey: WORLD_DOMAIN_KEY,
    contractVersion: WORLD_DOMAIN_CONTRACT_VERSION,
    capabilities,
    materialization: capabilities.flatMap(summary => summary.materialization.map(entry => ({
      ...entry,
      table: summary.table,
      defKind: summary.defKind,
    }))),
  };
}

export const WORLD_DOMAIN_POLICY_SUMMARY = createWorldDomainPolicySummary();
