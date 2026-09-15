import type { SpotDef, SpotFunctionalityDef } from '../contracts/world';
import type { RegistrySpotMutation } from '../registry/registry-spot-mutation';
import type {
  AuthoringExtension,
  AuthoringMutationReceipt,
  AuthoringMutationRequest,
  AuthoringValidationContext,
  ContentAuthoringPolicy,
  SpotResourceAffectorDraft,
} from './content-policy-types';

const SPOT_RESOURCE_AFFECTOR_EXTENSION: AuthoringExtension = {
  inputKey: 'affectors',
  definitionKey: 'functionalities',
  validate(value: unknown, context?: AuthoringValidationContext) {
    if (!Array.isArray(value)) return affectorProblem('spot.affectors', 'affectors 必须是可变列表');
    const ids = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const path = `spot.affectors[${index}]`;
      const row = value[index];
      if (!isRecord(row)) return affectorProblem(path, 'Affector 行必须是对象');
      const extra = Object.keys(row).find(key => !['id', 'type', 'mode', 'resource', 'amount'].includes(key));
      if (extra) return affectorProblem(`${path}.${extra}`, `当前 Affector 类型不支持字段：${extra}`);
      if (typeof row.id !== 'string' || !/^[a-z0-9_-]+$/.test(row.id)) {
        return affectorProblem(`${path}.id`, '行 ID 必须是非空 [a-z0-9_-]+ 名称');
      }
      if (ids.has(row.id)) return affectorProblem(`${path}.id`, `行 ID 重复：${row.id}`);
      ids.add(row.id);
      if (row.type !== 'resource-flow') return affectorProblem(`${path}.type`, '当前 Demo 只支持持续资源');
      if (row.mode !== 'fixed' && row.mode !== 'per-level') {
        return affectorProblem(`${path}.mode`, '持续资源模式必须是 fixed 或 per-level');
      }
      if (typeof row.resource !== 'string' || !row.resource.trim()) {
        return affectorProblem(`${path}.resource`, '资源必须是非空字符串');
      }
      if (context?.resourceIds && !context.resourceIds.has(row.resource)) {
        return affectorProblem(`${path}.resource`, `资源未出现在 resourceDisplays 中：${row.resource}`);
      }
      if (!isFinitePositiveNumber(row.amount)) {
        return affectorProblem(`${path}.amount`, '产出数值必须是大于 0 的有限数字');
      }
    }
    return undefined;
  },
  encode(value: unknown): SpotFunctionalityDef[] {
    return (value as readonly SpotResourceAffectorDraft[]).map(affector => {
      const id = `runtime:resource:${affector.id}`;
      return affector.mode === 'fixed'
        ? { id, kind: 'flow', resource: affector.resource, amount: affector.amount }
        : { id, kind: 'linearYield', resource: affector.resource, amountPerLevel: affector.amount };
    });
  },
};

function toRegistrySpotMutation(request: AuthoringMutationRequest): RegistrySpotMutation {
  if (request.operation === 'create' || request.operation === 'replace') {
    return {
      operation: request.operation,
      ownerModName: request.ownerModName,
      spot: request.def as SpotDef,
    };
  }
  return { operation: request.operation, ownerModName: request.ownerModName, spotId: request.defId };
}

/**
 * spots 行：首期唯一 P1 授权内容。
 * 每个可写字段都必须在 materialization 中登记消费者与失效方式；指不出触发方的字段不得开放编辑。
 */
export const SPOT_CONTENT_POLICY: ContentAuthoringPolicy = {
  key: 'spots',
  label: 'Spot',
  idType: 'spot',
  inputPrefix: 'spot',
  fields: [
    { key: 'idName', label: 'Spot ID 名', kind: 'entityName' },
    { key: 'areaId', label: '所属 Area', kind: 'ref', refType: 'area' },
    { key: 'name', label: '名称', kind: 'nonEmptyString' },
    { key: 'description', label: '描述', kind: 'string' },
    { key: 'baseCost', label: '基础花费', kind: 'constNumberExpression' },
    { key: 'baseCostResource', label: '花费资源', kind: 'nonEmptyString', initialValue: 'base:resource:credit' },
    { key: 'baseCapacity', label: '容量', kind: 'nonNegativeNumber' },
    { key: 'maxLevel', label: '等级上限', kind: 'int', required: false },
    { key: 'upgradeCostBase', label: '升级基价', kind: 'nonNegativeNumber', required: false },
    { key: 'upgradeCostGrowth', label: '升级增长', kind: 'nonNegativeNumber', required: false },
  ],
  extensions: [SPOT_RESOURCE_AFFECTOR_EXTENSION],
  defaults: { levelUpgrades: [], tags: [] },
  apply: 'local-mutation',
  materialization: [
    { field: 'idName', consumers: ['registry-record'], invalidate: 'none' },
    { field: 'areaId', consumers: ['registry-record', 'area-index', 'game-num'], invalidate: 'index', trigger: 'registry.applySpotMutation + spotDefinitionChanged' },
    { field: 'name', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'description', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'baseCost', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'baseCostResource', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'baseCapacity', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'maxLevel', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'upgradeCostBase', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'upgradeCostGrowth', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'affectors', consumers: ['registry-record', 'affector', 'game-num', 'ui-dynamic'], invalidate: 'remount', trigger: 'registry.applySpotMutation + spotDefinitionChanged + Affector runtime changed' },
  ],
  state: 'retain',
  unsupportedFieldHint: '复杂 Affector 能力仍须在 Datapack 中声明；Runtime Editor 当前仅开放持续资源，其他 functionalities、gachaPools、color/theme 或复杂引用不会进入 Demo UI',
  mutate(registry, request): AuthoringMutationReceipt {
    const receipt = registry.applySpotMutation(toRegistrySpotMutation(request));
    return {
      table: 'spots',
      operation: request.operation,
      ownerModName: request.ownerModName,
      defId: receipt.spotId,
      previousDef: receipt.previousSpot,
      currentDef: receipt.currentSpot,
      rollback: () => receipt.rollback(),
    };
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function affectorProblem(path: string, message: string) {
  return { code: 'invalid-field' as const, path, message };
}

/** 已授权内容表：新增可编辑内容 = 在此追加一行。 */
export const CONTENT_POLICIES: readonly ContentAuthoringPolicy[] = [SPOT_CONTENT_POLICY];
