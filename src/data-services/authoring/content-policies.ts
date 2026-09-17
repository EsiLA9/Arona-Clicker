import type { AreaDef, InitDef, SpotDef } from '../contracts/world';
import type { RegistryAreaMutation, RegistryInitMutation, RegistrySpotMutation } from '../registry/registry';
import type {
  AuthoringExtension,
  AuthoringMutationReceipt,
  AuthoringMutationRequest,
  AuthoringProblem,
  ContentAuthoringPolicy,
} from './content-policy-types';
import { parseEntityId } from '../../engine/core/entity-id';
import {
  encodeFunctionalityList,
  encodeGachaPoolList,
  encodeLevelUpgradeList,
  encodePaymentOptionList,
  encodeRevealTriggerList,
  encodeTagList,
  encodeEntityRefList,
  encodeResourceAmountList,
  validateFunctionalityList,
  validateGachaPoolList,
  validateLevelUpgradeList,
  validatePaymentOptionList,
  validateRevealTriggerList,
  validateTagList,
  validateEntityRefList,
  validateResourceAmountList,
} from './content-policy-dsl';

type AuthoringValue = Record<string, unknown>;

function reloadMaterialization(field: string, consumers: ('registry-record' | 'area-index' | 'visibility' | 'game-num' | 'affector' | 'spot-service' | 'init-scope' | 'ui-dynamic')[], invalidate: 'none' | 'subtree' | 'index' | 'remount' = 'remount') {
  return { field, consumers, invalidate, ...(invalidate === 'none' ? {} : { trigger: 'Runtime candidate Datapack → reloadPreservingState → Registry / Runtime rebuild' }) } as const;
}

function refListExtension(inputKey: string, definitionKey: string, section: string, refType: string, inputPrefix: string, required = false): AuthoringExtension {
  return {
    inputKey,
    definitionKey,
    section,
    editor: 'reference-list',
    ...(required ? { required: true, preserveEmpty: true, initialValue: [] } : {}),
    validate: value => validateEntityRefList(value, `${inputPrefix}.${inputKey}`, refType),
    encode: encodeEntityRefList,
  };
}

function resourceAmountExtension(inputKey: string, section: string, inputPrefix: string, required = false): AuthoringExtension {
  return {
    inputKey,
    definitionKey: inputKey === 'purchaseCost' ? 'purchaseCost' : 'price',
    section,
    editor: 'resource-amount-list',
    ...(required ? { required: true, preserveEmpty: true, initialValue: [] } : {}),
    validate: (value, context) => validateResourceAmountList(value, `${inputPrefix}.${inputKey}`, context),
    encode: encodeResourceAmountList,
  };
}

function toRegistryInitMutation(request: AuthoringMutationRequest): RegistryInitMutation {
  if (request.operation === 'create' || request.operation === 'replace') {
    return { operation: request.operation, ownerModName: request.ownerModName, init: request.def as InitDef };
  }
  return { operation: 'delete', ownerModName: request.ownerModName, initId: request.defId };
}

function toRegistryAreaMutation(request: AuthoringMutationRequest): RegistryAreaMutation {
  if (request.operation === 'create' || request.operation === 'replace') {
    return { operation: request.operation, ownerModName: request.ownerModName, area: request.def as AreaDef };
  }
  return { operation: 'delete', ownerModName: request.ownerModName, areaId: request.defId };
}

const INIT_DEFAULT_AREAS_EXTENSION = refListExtension('defaultAreas', 'defaultAreas', 'areas', 'area', 'init', true);
const INIT_TAG_EXTENSION: AuthoringExtension = {
  inputKey: 'tags', definitionKey: 'tags', section: 'basics', editor: 'tag-list',
  initialValue: [], preserveEmpty: true, validate: value => validateTagList(value, 'init.tags'), encode: encodeTagList,
};
const INIT_REVEAL_EXTENSION: AuthoringExtension = {
  inputKey: 'revealTriggers', definitionKey: 'revealTriggers', section: 'reveals', editor: 'reveal-trigger',
  validate: value => validateRevealTriggerList(value, 'init.revealTriggers'), encode: encodeRevealTriggerList,
};

const AREA_DEFAULT_SPOTS_EXTENSION = refListExtension('defaultSpots', 'defaultSpots', 'spots', 'spot', 'area', true);
function validateAreaTopology(value: unknown, path: string): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return { code: 'invalid-field', path, message: `${path} 必须是拓扑元素数组` };
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return { code: 'invalid-field', path, message: `${path} 的元素必须包含 Area 和拓扑类型` };
    const record = item as { areaId?: unknown; type?: unknown };
    if (typeof record.areaId !== 'string' || !parseEntityId(record.areaId)?.type || parseEntityId(record.areaId)?.type !== 'area') {
      return { code: 'invalid-field', path, message: `${path} 的目标必须是完整 Area ID` };
    }
    if (record.type !== 'oneWay' && record.type !== 'twoWay') {
      return { code: 'invalid-field', path, message: `${path} 的拓扑类型必须是 oneWay 或 twoWay` };
    }
    if (seen.has(record.areaId)) return { code: 'invalid-field', path, message: `${path} 不能重复添加同一 Area` };
    seen.add(record.areaId);
  }
  return undefined;
}

const AREA_TOPOLOGY_EXTENSION: AuthoringExtension = {
  inputKey: 'topology', definitionKey: 'adjacentAreaIds', section: 'topology', editor: 'area-topology',
  initialValue: [], preserveEmpty: true,
  validate: value => validateAreaTopology(value, 'area.topology'),
  encode: value => Array.isArray(value) ? value.map(item => (item as { areaId: string }).areaId) : [],
};
const AREA_TAG_EXTENSION: AuthoringExtension = {
  inputKey: 'tags', definitionKey: 'tags', section: 'basics', editor: 'tag-list',
  initialValue: [], preserveEmpty: true, validate: value => validateTagList(value, 'area.tags'), encode: encodeTagList,
};
const AREA_REVEAL_EXTENSION: AuthoringExtension = {
  inputKey: 'revealTriggers', definitionKey: 'revealTriggers', section: 'reveals', editor: 'reveal-trigger',
  validate: value => validateRevealTriggerList(value, 'area.revealTriggers'), encode: encodeRevealTriggerList,
};

function validateEnhancementAttachment(value: unknown): AuthoringProblem | undefined {
  if (!value || typeof value !== 'object') return { code: 'invalid-field', path: 'enhancement.attachment', message: '归属必须选择 global、init 或 area' };
  const attachment = value as AuthoringValue;
  if (attachment.kind === 'global') return undefined;
  if (attachment.kind === 'init' && typeof attachment.initId === 'string' && attachment.initId) return undefined;
  if (attachment.kind === 'area' && typeof attachment.areaId === 'string' && attachment.areaId) return undefined;
  return { code: 'invalid-field', path: 'enhancement.attachment', message: '归属引用不能为空且必须匹配归属类型' };
}

const ENHANCEMENT_ATTACHMENT_EXTENSION: AuthoringExtension = {
  inputKey: 'attachment', definitionKey: 'attachment', section: 'ownership', editor: 'attachment',
  validate: validateEnhancementAttachment,
  encode: value => value,
};
const ENHANCEMENT_TAG_EXTENSION: AuthoringExtension = {
  inputKey: 'tags', definitionKey: 'tags', section: 'basics', editor: 'tag-list',
  initialValue: [], preserveEmpty: true, validate: value => validateTagList(value, 'enhancement.tags'), encode: encodeTagList,
};
const ENHANCEMENT_REVEAL_EXTENSION: AuthoringExtension = {
  inputKey: 'revealTriggers', definitionKey: 'revealTriggers', section: 'reveals', editor: 'reveal-trigger',
  validate: value => validateRevealTriggerList(value, 'enhancement.revealTriggers'), encode: encodeRevealTriggerList,
};

export const INIT_CONTENT_POLICY: ContentAuthoringPolicy = {
  key: 'inits', label: 'Init', idType: 'init', inputPrefix: 'init',
  sections: [
    { id: 'overview', label: '概览' }, { id: 'basics', label: '基础' }, { id: 'areas', label: '区域' },
    { id: 'reveals', label: '揭示' }, { id: 'diagnostics', label: '诊断' },
  ],
  fields: [
    { key: 'idName', label: 'Init ID 名', kind: 'entityName', section: 'basics' },
    { key: 'name', label: '名称', kind: 'nonEmptyString', section: 'basics' },
    { key: 'description', label: '描述', kind: 'string', section: 'basics' },
    { key: 'startStoryId', label: '起始剧情', kind: 'ref', refType: 'story', required: false, section: 'basics' },
    { key: 'worldTilt', label: '世界倾斜数值', kind: 'string', required: false, section: 'basics' },
    { key: 'worldTiltAlias', label: '倾斜值展示别名', kind: 'string', required: false, section: 'basics' },
  ],
  extensions: [INIT_DEFAULT_AREAS_EXTENSION, resourceAmountExtension('purchaseCost', 'basics', 'init'), INIT_TAG_EXTENSION, INIT_REVEAL_EXTENSION],
  defaults: { defaultAreas: [] }, apply: 'local-mutation', materialization: [
    reloadMaterialization('idName', ['registry-record'], 'none'),
    reloadMaterialization('name', ['ui-dynamic'], 'none'), reloadMaterialization('description', ['ui-dynamic'], 'none'),
    reloadMaterialization('startStoryId', ['registry-record', 'ui-dynamic']), reloadMaterialization('worldTilt', ['ui-dynamic'], 'none'),
    reloadMaterialization('worldTiltAlias', ['ui-dynamic'], 'none'), reloadMaterialization('defaultAreas', ['registry-record', 'area-index', 'init-scope'], 'index'),
    reloadMaterialization('purchaseCost', ['registry-record', 'ui-dynamic'], 'none'), reloadMaterialization('tags', ['registry-record', 'game-num']),
    reloadMaterialization('revealTriggers', ['registry-record', 'visibility'], 'index'),
  ], state: 'retain', unsupportedFieldHint: 'enterEffects、triggers、theme 与 extra 暂不开放编辑；它们需要独立的 DSL / 表现层回写协议',
  mutate(registry, request): AuthoringMutationReceipt {
    const receipt = registry.applyInitMutation(toRegistryInitMutation(request));
    return {
      table: 'inits', operation: request.operation, ownerModName: request.ownerModName, defId: receipt.initId,
      previousDef: receipt.previousInit, currentDef: receipt.currentInit, rollback: () => receipt.rollback(),
    };
  },
};

export const AREA_CONTENT_POLICY: ContentAuthoringPolicy = {
  key: 'areas', label: 'Area', idType: 'area', inputPrefix: 'area',
  sections: [
    { id: 'overview', label: '概览' }, { id: 'basics', label: '基础' }, { id: 'topology', label: '拓扑' },
    { id: 'spots', label: '设施' }, { id: 'reveals', label: '揭示' }, { id: 'diagnostics', label: '诊断' },
  ],
  fields: [
    { key: 'idName', label: 'Area ID 名', kind: 'entityName', section: 'basics' },
    { key: 'initId', label: '所属 Init', kind: 'ref', refType: 'init', section: 'basics' },
    { key: 'name', label: '名称', kind: 'nonEmptyString', section: 'basics' },
    { key: 'description', label: '描述', kind: 'string', section: 'basics' },
  ],
  extensions: [AREA_DEFAULT_SPOTS_EXTENSION, AREA_TOPOLOGY_EXTENSION, AREA_TAG_EXTENSION, AREA_REVEAL_EXTENSION],
  defaults: { defaultSpots: [] }, apply: 'local-mutation', materialization: [
    reloadMaterialization('idName', ['registry-record'], 'none'), reloadMaterialization('initId', ['registry-record', 'area-index', 'init-scope']),
    reloadMaterialization('name', ['ui-dynamic'], 'none'), reloadMaterialization('description', ['ui-dynamic'], 'none'),
    reloadMaterialization('defaultSpots', ['registry-record', 'spot-service']), reloadMaterialization('topology', ['registry-record', 'ui-dynamic'], 'index'),
    reloadMaterialization('tags', ['registry-record', 'game-num']), reloadMaterialization('revealTriggers', ['registry-record', 'visibility'], 'index'),
  ], state: 'retain', unsupportedFieldHint: 'enterEffects、theme 与 extra 暂不开放编辑；它们需要独立的 DSL / 表现层回写协议',
  mutate(registry, request): AuthoringMutationReceipt {
    const receipt = registry.applyAreaMutation(toRegistryAreaMutation(request));
    return {
      table: 'areas', operation: request.operation, ownerModName: request.ownerModName, defId: receipt.areaId,
      previousDef: receipt.previousArea, currentDef: receipt.currentArea, rollback: () => receipt.rollback(),
    };
  },
};

export const ENHANCEMENT_CONTENT_POLICY: ContentAuthoringPolicy = {
  key: 'enhancements', label: 'Enhancement', idType: 'enhancement', inputPrefix: 'enhancement',
  sections: [
    { id: 'overview', label: '概览' }, { id: 'basics', label: '基础' }, { id: 'ownership', label: '归属与价格' },
    { id: 'reveals', label: '揭示' }, { id: 'diagnostics', label: '诊断' },
  ],
  fields: [
    { key: 'idName', label: 'Enhancement ID 名', kind: 'entityName', section: 'basics' },
    { key: 'name', label: '名称', kind: 'nonEmptyString', section: 'basics' },
    { key: 'description', label: '描述', kind: 'string', section: 'basics' },
    { key: 'autoApply', label: '购买时自动执行效果', kind: 'boolean', required: false, section: 'basics' },
    { key: 'maxStacks', label: '最大层数', kind: 'int', required: false, section: 'basics' },
    { key: 'irreversible', label: '不可撤回', kind: 'boolean', required: false, section: 'basics' },
  ],
  extensions: [ENHANCEMENT_ATTACHMENT_EXTENSION, resourceAmountExtension('price', 'ownership', 'enhancement'), ENHANCEMENT_TAG_EXTENSION, ENHANCEMENT_REVEAL_EXTENSION],
  defaults: { effects: [], autoApply: false }, apply: 'reload', materialization: [
    reloadMaterialization('idName', ['registry-record'], 'none'), reloadMaterialization('name', ['ui-dynamic'], 'none'),
    reloadMaterialization('description', ['ui-dynamic'], 'none'), reloadMaterialization('autoApply', ['registry-record'], 'remount'),
    reloadMaterialization('maxStacks', ['registry-record', 'ui-dynamic'], 'none'), reloadMaterialization('irreversible', ['registry-record'], 'none'),
    reloadMaterialization('attachment', ['registry-record', 'init-scope', 'visibility'], 'remount'), reloadMaterialization('price', ['registry-record', 'ui-dynamic'], 'none'),
    reloadMaterialization('tags', ['registry-record', 'game-num']), reloadMaterialization('revealTriggers', ['registry-record', 'visibility'], 'index'),
  ], state: 'retain', unsupportedFieldHint: 'effects、addsFunctionalities、affectorPackIds 与 theme / extra 暂不开放；已拥有条目不允许改变归属或不可逆语义',
};

/** Spot 功能：六种 kind 的增删改，encode 为 SpotFunctionalityDef[]。 */
const SPOT_FUNCTIONALITY_EXTENSION: AuthoringExtension = {
  inputKey: 'functionalities',
  definitionKey: 'functionalities',
  section: 'functionalities',
  editor: 'functionality',
  validate: (value, context) => validateFunctionalityList(value, 'spot.functionalities', context),
  encode: encodeFunctionalityList,
};

/** 等级升级：等级 / 花费 / 条件 / 效果列表。 */
const SPOT_LEVEL_UPGRADE_EXTENSION: AuthoringExtension = {
  inputKey: 'levelUpgrades',
  definitionKey: 'levelUpgrades',
  section: 'upgrades',
  editor: 'level-upgrade',
  validate: (value, context) => validateLevelUpgradeList(value, 'spot.levelUpgrades', context),
  encode: encodeLevelUpgradeList,
};

/** Spot 解锁支付方案：Resource / Item 的并列费用与条件化方案。 */
const SPOT_PAYMENT_OPTIONS_EXTENSION: AuthoringExtension = {
  inputKey: 'purchaseOptions',
  definitionKey: 'purchaseOptions',
  section: 'payments',
  editor: 'payment-options',
  preserveEmpty: true,
  required: true,
  initialValue: [{ id: 'free', label: '免费', costs: [] }],
  validate: (value, context) => validatePaymentOptionList(value, 'spot.purchaseOptions', context, true),
  encode: encodePaymentOptionList,
};

/** 揭示声明：reveal 目标 + 可选条件；失效链已由 VisibilityEngine 订阅 spotDefinitionChanged 覆盖。 */
const SPOT_REVEAL_TRIGGER_EXTENSION: AuthoringExtension = {
  inputKey: 'revealTriggers',
  definitionKey: 'revealTriggers',
  section: 'reveals',
  editor: 'reveal-trigger',
  validate: value => validateRevealTriggerList(value, 'spot.revealTriggers'),
  encode: encodeRevealTriggerList,
};

/** 层级标签：以 `a/b` 路径形式编辑，encode 为 TagPath[]。 */
const SPOT_TAG_EXTENSION: AuthoringExtension = {
  inputKey: 'tags',
  definitionKey: 'tags',
  section: 'ownership',
  editor: 'tag-list',
  validate: value => validateTagList(value, 'spot.tags'),
  encode: encodeTagList,
};

/** 招募卡池引用：候选来自 Registry.gachaPools。 */
const SPOT_GACHA_POOL_EXTENSION: AuthoringExtension = {
  inputKey: 'gachaPools',
  definitionKey: 'gachaPools',
  // 卡池归属由运行时服务维护；保留编码能力用于 round-trip，但不在 Spot CRUD 中提供入口。
  validate: (value, context) => validateGachaPoolList(value, 'spot.gachaPools', context),
  encode: encodeGachaPoolList,
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
 * spots 行：当前唯一的 P1 授权内容，也是统一编辑器服务的唯一内容样例。
 * 每个可写字段与扩展都必须在 materialization 中登记消费者与失效方式；
 * 指不出触发方的字段不得开放编辑。
 */
export const SPOT_CONTENT_POLICY: ContentAuthoringPolicy = {
  key: 'spots',
  label: 'Spot',
  idType: 'spot',
  inputPrefix: 'spot',
  sections: [
    { id: 'overview', label: '概览' },
    { id: 'basics', label: '基础' },
    { id: 'ownership', label: '归属' },
    { id: 'payments', label: '支付' },
    { id: 'functionalities', label: '功能' },
    { id: 'upgrades', label: '升级' },
    { id: 'reveals', label: '揭示' },
    { id: 'diagnostics', label: '诊断' },
  ],
  fields: [
    { key: 'idName', label: 'Spot ID 名', kind: 'entityName', section: 'basics' },
    { key: 'areaId', label: '所属 Area', kind: 'ref', refType: 'area', section: 'ownership' },
    { key: 'name', label: '名称', kind: 'nonEmptyString', section: 'basics' },
    { key: 'description', label: '描述', kind: 'string', section: 'basics' },
    { key: 'maxLevel', label: '等级上限', kind: 'int', required: false, section: 'upgrades' },
    { key: 'conditionText', label: '条件文本', kind: 'string', required: false, section: 'basics' },
    { key: 'global', label: '跨世界线共享', kind: 'boolean', required: false, section: 'ownership' },
  ],
  extensions: [
    SPOT_FUNCTIONALITY_EXTENSION,
    SPOT_LEVEL_UPGRADE_EXTENSION,
    SPOT_PAYMENT_OPTIONS_EXTENSION,
    SPOT_REVEAL_TRIGGER_EXTENSION,
    SPOT_TAG_EXTENSION,
    SPOT_GACHA_POOL_EXTENSION,
  ],
  defaults: { levelUpgrades: [], tags: [] },
  apply: 'local-mutation',
  materialization: [
    { field: 'idName', consumers: ['registry-record'], invalidate: 'none' },
    { field: 'areaId', consumers: ['registry-record', 'area-index', 'game-num'], invalidate: 'index', trigger: 'registry.applySpotMutation + spotDefinitionChanged' },
    { field: 'name', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'description', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'maxLevel', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'conditionText', consumers: ['ui-dynamic'], invalidate: 'none' },
    { field: 'global', consumers: ['registry-record', 'init-scope'], invalidate: 'none' },
    { field: 'functionalities', consumers: ['registry-record', 'affector', 'game-num', 'ui-dynamic'], invalidate: 'remount', trigger: 'registry.applySpotMutation + spotDefinitionChanged + Affector runtime changed' },
    { field: 'levelUpgrades', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'purchaseOptions', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
    { field: 'revealTriggers', consumers: ['visibility', 'ui-dynamic'], invalidate: 'index', trigger: 'registry.applySpotMutation + spotDefinitionChanged' },
    { field: 'tags', consumers: ['tag-index', 'spot-service', 'ui-dynamic'], invalidate: 'index', trigger: 'registry.applySpotMutation + spotDefinitionChanged' },
    { field: 'gachaPools', consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' },
  ],
  state: 'retain',
  unsupportedFieldHint: '主题（theme）、色彩组引用（colorGroupId）与 extra 树暂不开放编辑：它们涉及色彩失效链与状态分层，需单独裁定',
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
export const CONTENT_POLICIES: readonly ContentAuthoringPolicy[] = [
  INIT_CONTENT_POLICY,
  AREA_CONTENT_POLICY,
  SPOT_CONTENT_POLICY,
  ENHANCEMENT_CONTENT_POLICY,
];
