import type { SpotDef } from '../contracts/world';
import type { RegistrySpotMutation } from '../registry/registry-spot-mutation';
import type {
  AuthoringMutationReceipt,
  AuthoringMutationRequest,
  ContentAuthoringPolicy,
} from './content-policy-types';

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
    { key: 'baseYield', label: '基础产出', kind: 'constNumberExpression' },
    { key: 'baseYieldResource', label: '产出资源', kind: 'nonEmptyString', initialValue: 'base:resource:credit' },
    { key: 'baseCapacity', label: '容量', kind: 'nonNegativeNumber' },
    { key: 'yieldPerLevel', label: '每级产出', kind: 'int', required: false },
    { key: 'maxLevel', label: '等级上限', kind: 'int', required: false },
    { key: 'upgradeCostBase', label: '升级基价', kind: 'nonNegativeNumber', required: false },
    { key: 'upgradeCostGrowth', label: '升级增长', kind: 'nonNegativeNumber', required: false },
  ],
  defaults: { levelUpgrades: [], tags: [] },
  apply: 'local-mutation',
  materialization: [
    { field: 'idName', consumers: ['registry-record'], invalidate: 'none' },
    { field: 'areaId', consumers: ['registry-record', 'area-index', 'game-num'], invalidate: 'index', trigger: 'registry.applySpotMutation + spotDefinitionChanged' },
    { field: 'name', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'description', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'baseCost', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'baseCostResource', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'baseYield', consumers: ['game-num', 'ui-dynamic'], invalidate: 'subtree', trigger: 'spotDefinitionChanged → GameNum.applySpotDefinitionChange' },
    { field: 'baseYieldResource', consumers: ['game-num'], invalidate: 'subtree', trigger: 'spotDefinitionChanged → GameNum.applySpotDefinitionChange' },
    { field: 'baseCapacity', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'yieldPerLevel', consumers: ['game-num'], invalidate: 'subtree', trigger: 'spotDefinitionChanged → GameNum.applySpotDefinitionChange' },
    { field: 'maxLevel', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'upgradeCostBase', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'upgradeCostGrowth', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
  ],
  state: 'retain',
  unsupportedFieldHint: '不接受 functionalities、gachaPools、color/theme 或复杂引用',
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

/** 已授权内容表：新增可编辑内容 = 在此追加一行。 */
export const CONTENT_POLICIES: readonly ContentAuthoringPolicy[] = [SPOT_CONTENT_POLICY];
