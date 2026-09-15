import { parseEntityId } from '../../engine/core/entity-id';
import { Expr } from '../../engine/types';
import type { Registry } from '../registry/registry';
import { CONTENT_POLICIES } from './content-policies';
import type {
  AuthoringExtension,
  AuthoringMutationReceipt,
  AuthoringMutationRequest,
  AuthoringProblem,
  AuthoringValidationContext,
  ContentAuthoringPolicy,
  ContentKey,
  FieldConsumer,
  FieldMaterialization,
  WritableFieldDef,
} from './content-policy-types';

const ENTITY_NAME_PATTERN = /^[a-z0-9_-]+$/;

export { CONTENT_POLICIES, SPOT_CONTENT_POLICY } from './content-policies';

export type {
  AuthoringExtension,
  AuthoringMutationReceipt,
  AuthoringMutationRequest,
  AuthoringProblem,
  AuthoringProblemCode,
  ContentApplyStrategy,
  ContentAuthoringPolicy,
  ContentKey,
  ContentStatePolicy,
  FieldConsumer,
  FieldInvalidation,
  FieldMaterialization,
  SpotAffectorMode,
  SpotResourceAffectorDraft,
  AuthoringValidationContext,
  WritableFieldDef,
  WritableFieldKind,
} from './content-policy-types';

export function listContentPolicies(): readonly ContentAuthoringPolicy[] {
  return CONTENT_POLICIES;
}

export function getContentPolicy(key: ContentKey): ContentAuthoringPolicy | undefined {
  return CONTENT_POLICIES.find(policy => policy.key === key);
}

export function isContentAuthorable(key: ContentKey): boolean {
  return getContentPolicy(key) !== undefined;
}

export function requireContentPolicy(key: ContentKey): ContentAuthoringPolicy {
  const policy = getContentPolicy(key);
  if (!policy) throw new Error(`内容表未授权编辑：${key}`);
  return policy;
}

export function getWritableField(policy: ContentAuthoringPolicy, fieldKey: string): WritableFieldDef | undefined {
  return policy.fields.find(field => field.key === fieldKey);
}

export function getAuthoringExtension(policy: ContentAuthoringPolicy, inputKey: string): AuthoringExtension | undefined {
  return policy.extensions?.find(extension => extension.inputKey === inputKey);
}

export function getFieldMaterialization(policy: ContentAuthoringPolicy, fieldKey: string): FieldMaterialization | undefined {
  return policy.materialization.find(entry => entry.field === fieldKey);
}

/** 表级消费者视图：由字段级台账求并集，避免表级与字段级两份清单漂移。 */
export function policyFieldConsumers(policy: ContentAuthoringPolicy): FieldConsumer[] {
  const consumers = new Set<FieldConsumer>(['registry-record']);
  for (const entry of policy.materialization) {
    for (const consumer of entry.consumers) consumers.add(consumer);
  }
  return [...consumers];
}

export function isNumericAuthoringKind(kind: WritableFieldDef['kind']): boolean {
  return kind === 'number' || kind === 'nonNegativeNumber' || kind === 'constNumberExpression' || kind === 'int';
}

/**
 * 字段值缺席（未设置）：可选字段的合法取值，编码时整键省略。
 * 数值类的空输入视为「未设置」；字符串类的空串是合法值，不算缺席。
 */
export function isAbsentAuthoringValue(field: WritableFieldDef, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (!isNumericAuthoringKind(field.kind)) return false;
  return typeof value === 'string' && value.trim() === '';
}

export function inputFieldPath(policy: ContentAuthoringPolicy, fieldKey: string): string {
  return `${policy.inputPrefix}.${fieldKey}`;
}

/** 单字段校验：字段本身未授权时归为 invalid-field，避免调用方自行维护白名单。 */
export function validateAuthoringFieldValue(
  policy: ContentAuthoringPolicy,
  fieldKey: string,
  value: unknown,
  context?: AuthoringValidationContext,
): AuthoringProblem | undefined {
  const field = getWritableField(policy, fieldKey);
  if (!field) {
    const extension = getAuthoringExtension(policy, fieldKey);
    if (extension) {
      if (value === undefined || value === null) return undefined;
      return extension.validate(value, context);
    }
    const hint = policy.unsupportedFieldHint ? `；${policy.unsupportedFieldHint}` : '';
    return problem('invalid-field', inputFieldPath(policy, fieldKey), `${policy.label} 字段未授权：${fieldKey}${hint}`);
  }
  if (isAbsentAuthoringValue(field, value)) {
    return field.required === false
      ? undefined
      : problem('invalid-field', inputFieldPath(policy, field.key), `缺少字段：${field.key}`);
  }
  switch (field.kind) {
    case 'entityName':
      return typeof value === 'string' && ENTITY_NAME_PATTERN.test(value)
        ? undefined
        : problem('invalid-content-id', field.key, `${field.key} 必须是非空 [a-z0-9_-]+ 名称，不能传入完整实体 ID`);
    case 'ref': {
      if (typeof value !== 'string' || !value.trim()) {
        return problem('invalid-field', inputFieldPath(policy, field.key), `${field.key} 必须是非空字符串`);
      }
      const parts = parseEntityId(value);
      if (!parts || (field.refType !== undefined && parts.type !== field.refType)) {
        return problem('invalid-field', inputFieldPath(policy, field.key), `${field.key} 必须是完整 ${field.refType ?? '内容'} ID：${value}`);
      }
      return undefined;
    }
    case 'string':
      return typeof value === 'string'
        ? undefined
        : problem('invalid-field', inputFieldPath(policy, field.key), `${field.key} 必须是字符串`);
    case 'nonEmptyString':
      return typeof value === 'string' && value.trim().length > 0
        ? undefined
        : problem('invalid-field', inputFieldPath(policy, field.key), `${field.key} 必须是非空字符串`);
    case 'number':
      return isFiniteNumber(value)
        ? undefined
        : problem('invalid-field', inputFieldPath(policy, field.key), `${field.key} 必须是有限数字`);
    case 'nonNegativeNumber':
    case 'constNumberExpression':
      return isFiniteNumber(value) && value >= 0
        ? undefined
        : problem('invalid-field', inputFieldPath(policy, field.key), `${field.key} 必须是非负有限数字`);
    case 'int':
      return Number.isInteger(value) && (value as number) >= 0
        ? undefined
        : problem('invalid-field', inputFieldPath(policy, field.key), `${field.key} 必须是非负整数`);
  }
}

/** 整表校验：未授权字段优先报告，与「先拒绝未知能力、再报字段错误」的 UI 顺序一致。 */
export function validateAuthoringInput(
  policy: ContentAuthoringPolicy,
  input: object,
  context?: AuthoringValidationContext,
): AuthoringProblem | undefined {
  const raw = input as Record<string, unknown>;
  const allowed = new Set(policy.fields.map(field => field.key));
  for (const extension of policy.extensions ?? []) allowed.add(extension.inputKey);
  const extra = Object.keys(raw).find(key => !allowed.has(key));
  if (extra !== undefined) return validateAuthoringFieldValue(policy, extra, raw[extra], context);

  for (const field of policy.fields) {
    const issue = validateAuthoringFieldValue(policy, field.key, raw[field.key], context);
    if (issue) return issue;
  }
  for (const extension of policy.extensions ?? []) {
    const value = raw[extension.inputKey];
    if (value === undefined || value === null) continue;
    const issue = extension.validate(value, context);
    if (issue) return issue;
  }
  return undefined;
}

export function authoringEntityId(policy: ContentAuthoringPolicy, modName: string, idName: string): string {
  return `${modName}:${policy.idType}:${idName}`;
}

export function authoringDefId(policy: ContentAuthoringPolicy, modName: string, input: object): string {
  const idField = policy.fields.find(field => field.kind === 'entityName');
  const raw = input as Record<string, unknown>;
  const idName = idField ? raw[idField.key] : undefined;
  return authoringEntityId(policy, modName, typeof idName === 'string' ? idName : '');
}

/** 由策略表构建完整 Def：实体 ID + 字段编码 + 合同要求但不可编辑的默认值。 */
export function buildAuthoringDef(policy: ContentAuthoringPolicy, modName: string, input: object): unknown {
  const raw = input as Record<string, unknown>;
  const def: Record<string, unknown> = {
    id: authoringDefId(policy, modName, raw),
    ...(policy.defaults ?? {}),
  };
  for (const field of policy.fields) {
    if (field.kind === 'entityName') continue;
    if (isAbsentAuthoringValue(field, raw[field.key])) continue;
    def[field.key] = encodeFieldValue(field, raw[field.key]);
  }
  for (const extension of policy.extensions ?? []) {
    const value = raw[extension.inputKey];
    if (value === undefined || value === null) continue;
    const encoded = extension.encode(value);
    if (Array.isArray(encoded) && encoded.length === 0) continue;
    def[extension.definitionKey] = encoded;
  }
  return def;
}

/** 单字段编码值：Diff 与 Def 构建共用同一编码，避免 UI 自行解释表达式；未设置返回 undefined。 */
export function encodedAuthoringFieldValue(
  policy: ContentAuthoringPolicy,
  fieldKey: string,
  value: unknown,
): unknown {
  const field = getWritableField(policy, fieldKey);
  if (!field || isAbsentAuthoringValue(field, value)) return undefined;
  return encodeFieldValue(field, value);
}

export function encodedAuthoringExtensionValue(
  policy: ContentAuthoringPolicy,
  inputKey: string,
  value: unknown,
): unknown {
  const extension = getAuthoringExtension(policy, inputKey);
  if (!extension || value === undefined || value === null) return undefined;
  const encoded = extension.encode(value);
  return Array.isArray(encoded) && encoded.length === 0 ? undefined : encoded;
}

export function cloneAuthoringDef<T>(def: T): T {
  return structuredClone(def);
}

export function applyAuthoringMutation(registry: Registry, request: AuthoringMutationRequest): AuthoringMutationReceipt {
  return requireContentPolicy(request.table).mutate(registry, request);
}

function encodeFieldValue(field: WritableFieldDef, value: unknown): unknown {
  switch (field.kind) {
    case 'entityName':
      return value;
    case 'ref':
    case 'string':
    case 'nonEmptyString':
      return (value as string).trim();
    case 'number':
    case 'nonNegativeNumber':
    case 'int':
      return value;
    case 'constNumberExpression':
      return Expr.const(value as number);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function problem(code: AuthoringProblem['code'], path: string, message: string): AuthoringProblem {
  return { code, path, message };
}
