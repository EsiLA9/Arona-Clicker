// ============================================================
// data-services/authoring/content-policy-dsl.ts — 声明式 DSL 的编辑期校验与编码
//
// 供 Spot 内容扩展（功能 / 升级 / 揭示 / 标签 / 卡池）复用：
//   validate* → 写入前的结构校验（含递归深度与条数上限）
//   encode*   → 草稿 → 引擎 Def
//   decode*   → 引擎 Def → 草稿（round-trip 投影）
//
// 枚举白名单与引擎保持一致；引擎扩展枚举时此处需同步，未同步时一律 fail closed。
// ============================================================

import { Expr } from '../../engine/types';
import { parseEntityId } from '../../engine/core/entity-id';
import type { Comparator, Condition, ConditionGroup, ConditionTarget, Effect, EffectOp } from '../../engine/types/expression';
import type { RevealTarget } from '../../engine/contracts/reveal';
import type { CostItem, PaymentOptionDef } from '../contracts/cost';
import type { LevelUpgradeDef, SpotDef, SpotFunctionalityDef } from '../contracts/world';
import type {
  AuthoringProblem,
  AuthoringValidationContext,
  PaymentCostDraft,
  PaymentOptionDraft,
  SpotFunctionalityDraft,
  SpotFunctionalityKind,
  SpotLevelUpgradeDraft,
  SpotRevealTriggerDraft,
} from './content-policy-types';

/** 递归结构上限：超过即拒绝写入，提示改在 Datapack 中编辑。 */
export const MAX_CONDITION_DEPTH = 4;
export const MAX_CONDITION_ITEMS = 8;

const COMPARATORS: readonly Comparator[] = ['==', '!=', '>=', '<=', '>', '<'];

const CONDITION_TARGETS: readonly ConditionTarget[] = [
  'alwaysTrue',
  'resource', 'spotLevel', 'manager', 'flag', 'hasEnh', 'hasTag', 'countTags', 'tagCount', 'stat',
  'hasReadStory', 'hasReadStoryInRun', 'visitedStoryInChain', 'extra', 'protoStat', 'affectionLevel', 'area',
];

const EFFECT_OPS: readonly EffectOp[] = [
  'setResource', 'addResource', 'setSpotLevel', 'addSpotLevel', 'setManager', 'addEnhancement', 'addItem',
  'loot', 'unlockInit', 'setFlag', 'triggerStory', 'travelToArea', 'setSpotMaxLevel', 'removeSpotMaxLevel',
  'setExtra', 'addExtra', 'removeExtra', 'grantCharacter', 'addAffectionExp', 'setTheme',
  'clearAllChatFlow', 'showChatText', 'clearIdChatFlow', 'clearAllChatText', 'showOpeningTitle',
];

const REVEAL_TARGETS: readonly RevealTarget[] = ['existence', 'name', 'condition', 'utility', 'unlock'];

const FUNCTIONALITY_KINDS: readonly SpotFunctionalityKind[] = ['flow', 'linearYield', 'restartInit', 'hardResetInit', 'gacha', 'shop'];

const FUNCTIONALITY_ID_PATTERN = /^[a-z0-9_-]+$/;
const PAYMENT_OPTION_ID_PATTERN = /^[a-z0-9_-]+$/;
const PAYMENT_OPTION_KEYS = ['id', 'label', 'condition', 'costs'];
const PAYMENT_COST_KEYS = ['type', 'resourceId', 'itemId', 'amount'];

/** 功能草稿允许的键：未列出的键一律 fail closed，避免静默写入引擎 Def。 */
const FUNCTIONALITY_DRAFT_KEYS = ['id', 'kind', 'resource', 'amount', 'amountPerLevel', 'startLevel', 'shopId', 'condition'];

function fail(path: string, message: string): AuthoringProblem {
  return { code: 'invalid-field', path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// --- 条件（可嵌套） ---

export function validateConditionGroup(
  value: unknown,
  path: string,
  depth = 1,
): AuthoringProblem | undefined {
  if (!isRecord(value)) return fail(path, '条件组必须是对象');
  if (value.type !== 'AND' && value.type !== 'OR') return fail(`${path}.type`, '条件组 type 必须是 AND 或 OR');
  if (!Array.isArray(value.conditions)) return fail(`${path}.conditions`, '条件组 conditions 必须是数组');
  if (depth > MAX_CONDITION_DEPTH) {
    return fail(path, `条件组嵌套超过 ${MAX_CONDITION_DEPTH} 层；请改在 Datapack 中编辑`);
  }
  if (value.conditions.length > MAX_CONDITION_ITEMS) {
    return fail(`${path}.conditions`, `单个条件组最多 ${MAX_CONDITION_ITEMS} 项；请改在 Datapack 中编辑`);
  }
  for (let index = 0; index < value.conditions.length; index += 1) {
    const item = value.conditions[index];
    const itemPath = `${path}.conditions[${index}]`;
    if (isRecord(item) && (item.type === 'AND' || item.type === 'OR')) {
      const nested = validateConditionGroup(item, itemPath, depth + 1);
      if (nested) return nested;
      continue;
    }
    const problem = validateCondition(item, itemPath);
    if (problem) return problem;
  }
  return undefined;
}

function validateCondition(value: unknown, path: string): AuthoringProblem | undefined {
  if (!isRecord(value)) return fail(path, '条件必须是对象');
  if (!CONDITION_TARGETS.includes(value.target as ConditionTarget)) {
    return fail(`${path}.target`, `不支持的条件目标：${String(value.target)}`);
  }
  if (value.target === 'alwaysTrue') {
    if (value.comparator !== '==' || value.value !== 1) {
      return fail(path, '恒真条件必须保持为 == 1');
    }
    return undefined;
  }
  if (typeof value.key !== 'string' || value.key.trim() === '') return fail(`${path}.key`, '条件 key 不能为空');
  if (!COMPARATORS.includes(value.comparator as Comparator)) {
    return fail(`${path}.comparator`, `不支持的比较符：${String(value.comparator)}`);
  }
  if (!isFiniteNumber(value.value)) return fail(`${path}.value`, '条件比较值必须是有限数字');
  return undefined;
}

// --- 效果 ---

export function validateEffectList(value: unknown, path: string): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return fail(path, '效果必须是数组');
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) return fail(itemPath, '效果必须是对象');
    if (!EFFECT_OPS.includes(item.op as EffectOp)) return fail(`${itemPath}.op`, `不支持的效果 op：${String(item.op)}`);
    if (typeof item.target !== 'string') return fail(`${itemPath}.target`, '效果 target 必须是字符串');
    if (item.value === undefined || item.value === null) return fail(`${itemPath}.value`, '效果 value 不能为空');
  }
  return undefined;
}

// --- Spot 功能 ---

export function validateFunctionalityList(
  value: unknown,
  path: string,
  context?: AuthoringValidationContext,
): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return fail(path, '功能必须是数组');
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) return fail(itemPath, '功能行必须是对象');
    const extra = Object.keys(item).find(key => !FUNCTIONALITY_DRAFT_KEYS.includes(key));
    if (extra) return fail(`${itemPath}.${extra}`, `当前功能不支持字段：${extra}`);
    if (typeof item.id !== 'string' || !FUNCTIONALITY_ID_PATTERN.test(item.id)) {
      return fail(`${itemPath}.id`, '功能行 ID 必须是非空 [a-z0-9_-]+ 名称');
    }
    if (ids.has(item.id)) return fail(`${itemPath}.id`, `功能行 ID 重复：${item.id}`);
    ids.add(item.id);
    if (!FUNCTIONALITY_KINDS.includes(item.kind as SpotFunctionalityKind)) {
      return fail(`${itemPath}.kind`, `不支持的功能类型：${String(item.kind)}`);
    }
    const kind = item.kind as SpotFunctionalityKind;
    if (kind === 'flow' || kind === 'linearYield') {
      if (typeof item.resource !== 'string' || item.resource.trim() === '') {
        return fail(`${itemPath}.resource`, '产出资源必须是非空字符串');
      }
      if (context?.resourceIds && !context.resourceIds.has(item.resource)) {
        return fail(`${itemPath}.resource`, `资源未出现在 resourceDisplays 中：${item.resource}`);
      }
      const amount = kind === 'flow' ? item.amount : item.amountPerLevel;
      if (!isFiniteNumber(amount) || amount <= 0) {
        return fail(`${itemPath}.amount`, '产出数值必须是大于 0 的有限数字');
      }
      if (kind === 'linearYield' && item.startLevel !== undefined) {
        if (!Number.isInteger(item.startLevel) || (item.startLevel as number) < 0) {
          return fail(`${itemPath}.startLevel`, '起算等级必须是非负整数');
        }
      }
    }
    if (kind === 'shop') {
      if (typeof item.shopId !== 'string' || item.shopId.trim() === '') {
        return fail(`${itemPath}.shopId`, '商店功能必须选择商店');
      }
      if (context?.shopIds && !context.shopIds.has(item.shopId)) {
        return fail(`${itemPath}.shopId`, `商店未注册：${item.shopId}`);
      }
    }
    if (item.condition !== undefined && item.condition !== null) {
      const problem = validateConditionGroup(item.condition, `${itemPath}.condition`);
      if (problem) return problem;
    }
  }
  return undefined;
}

/** 草稿局部键 → 引擎功能 id；已带 runtime: 前缀的输入保持原样（encode 幂等）。 */
function functionalityEngineId(draft: SpotFunctionalityDraft): string {
  if (draft.id.startsWith('runtime:')) return draft.id;
  return draft.kind === 'flow' || draft.kind === 'linearYield'
    ? `runtime:resource:${draft.id}`
    : `runtime:${draft.kind}:${draft.id}`;
}

export function encodeFunctionalityList(value: unknown): SpotFunctionalityDef[] {
  return (value as readonly SpotFunctionalityDraft[]).map(draft => {
    const base = {
      id: functionalityEngineId(draft),
      kind: draft.kind,
      ...(draft.condition ? { condition: draft.condition } : {}),
    };
    switch (draft.kind) {
      case 'flow':
        return { ...base, kind: 'flow', resource: draft.resource, amount: draft.amount };
      case 'linearYield':
        return {
          ...base,
          kind: 'linearYield',
          resource: draft.resource,
          amountPerLevel: draft.amountPerLevel,
          ...(draft.startLevel ? { startLevel: draft.startLevel } : {}),
        };
      case 'shop':
        return { ...base, kind: 'shop', shopId: draft.shopId };
      default:
        return base;
    }
  });
}

// --- 支付方案（purchaseOptions / levelUpgrades.paymentOptions） ---

export function validatePaymentOptionList(
  value: unknown,
  path: string,
  context?: AuthoringValidationContext,
  allowEmpty = false,
): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return fail(path, '支付方案必须是数组');
  if (value.length === 0 && !allowEmpty) return fail(path, '至少需要一个支付方案；免费支付请声明 costs: [] 的方案');
  const optionIds = new Set<string>();
  for (let optionIndex = 0; optionIndex < value.length; optionIndex += 1) {
    const option = value[optionIndex];
    const optionPath = `${path}[${optionIndex}]`;
    if (!isRecord(option)) return fail(optionPath, '支付方案必须是对象');
    const extra = Object.keys(option).find(key => !PAYMENT_OPTION_KEYS.includes(key));
    if (extra) return fail(`${optionPath}.${extra}`, `支付方案不支持字段：${extra}`);
    if (typeof option.id !== 'string' || !PAYMENT_OPTION_ID_PATTERN.test(option.id)) {
      return fail(`${optionPath}.id`, '支付方案 ID 必须是非空 [a-z0-9_-]+ 名称');
    }
    if (optionIds.has(option.id)) return fail(`${optionPath}.id`, `支付方案 ID 重复：${option.id}`);
    optionIds.add(option.id);
    if (option.label !== undefined && typeof option.label !== 'string') {
      return fail(`${optionPath}.label`, '支付方案名称必须是字符串');
    }
    if (option.condition !== undefined && option.condition !== null) {
      const conditionProblem = validateConditionGroup(option.condition, `${optionPath}.condition`);
      if (conditionProblem) return conditionProblem;
    }
    if (!Array.isArray(option.costs)) return fail(`${optionPath}.costs`, '支付费用必须是数组');
    for (let costIndex = 0; costIndex < option.costs.length; costIndex += 1) {
      const cost = option.costs[costIndex];
      const costPath = `${optionPath}.costs[${costIndex}]`;
      if (!isRecord(cost)) return fail(costPath, '支付费用项必须是对象');
      const costExtra = Object.keys(cost).find(key => !PAYMENT_COST_KEYS.includes(key));
      if (costExtra) return fail(`${costPath}.${costExtra}`, `支付费用项不支持字段：${costExtra}`);
      if (cost.type !== 'resource' && cost.type !== 'item') return fail(`${costPath}.type`, '支付费用项 type 必须是 resource 或 item');
      const targetKey = cost.type === 'resource' ? 'resourceId' : 'itemId';
      const target = cost[targetKey];
      if (typeof target !== 'string' || target.trim() === '') return fail(`${costPath}.${targetKey}`, '支付资产引用不能为空');
      if (cost.type === 'resource' && context?.resourceIds && !context.resourceIds.has(target)) {
        return fail(`${costPath}.resourceId`, `资源未出现在 resourceDisplays 中：${target}`);
      }
      if (cost.type === 'item' && context?.itemIds && !context.itemIds.has(target)) {
        return fail(`${costPath}.itemId`, `物品未注册：${target}`);
      }
      if (!isFiniteNumber(cost.amount) || cost.amount < 0) {
        return fail(`${costPath}.amount`, '支付金额必须是非负有限数字');
      }
      if (cost.type === 'item' && !Number.isInteger(cost.amount)) {
        return fail(`${costPath}.amount`, '物品支付金额必须是非负整数');
      }
    }
  }
  return undefined;
}

export function encodePaymentOptionList(value: unknown): PaymentOptionDef[] {
  return (value as readonly PaymentOptionDraft[]).map(option => ({
    id: option.id,
    ...(option.label ? { label: option.label.trim() } : {}),
    ...(option.condition ? { condition: option.condition } : {}),
    costs: option.costs.map(cost => ({
      type: cost.type,
      ...(cost.type === 'resource' ? { resourceId: cost.resourceId! } : { itemId: cost.itemId! }),
      amount: Expr.const(cost.amount),
    })) as CostItem[],
  }));
}

// --- 等级升级 ---

export function validateLevelUpgradeList(
  value: unknown,
  path: string,
  context?: AuthoringValidationContext,
): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return fail(path, '升级列表必须是数组');
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) return fail(itemPath, '升级行必须是对象');
    if (!Number.isInteger(item.level) || (item.level as number) < 1) {
      return fail(`${itemPath}.level`, '升级等级必须是不小于 1 的整数');
    }
    if (item.paymentOptions === undefined || item.paymentOptions === null) {
      return fail(`${itemPath}.paymentOptions`, '升级条目必须声明至少一个支付方案；免费升级请使用 costs: []');
    }
    const paymentProblem = validatePaymentOptionList(item.paymentOptions, `${itemPath}.paymentOptions`, context);
    if (paymentProblem) return paymentProblem;
    if (item.condition !== undefined && item.condition !== null) {
      const problem = validateConditionGroup(item.condition, `${itemPath}.condition`);
      if (problem) return problem;
    }
    const effects = validateEffectList(item.effects ?? [], `${itemPath}.effects`);
    if (effects) return effects;
  }
  return undefined;
}

export function encodeLevelUpgradeList(value: unknown): LevelUpgradeDef[] {
  return (value as readonly SpotLevelUpgradeDraft[]).map(draft => ({
    level: draft.level,
    paymentOptions: encodePaymentOptionList(draft.paymentOptions),
    ...(draft.condition ? { condition: draft.condition } : {}),
    effects: draft.effects ?? [],
  }));
}

// --- 揭示声明 ---

export function validateRevealTriggerList(value: unknown, path: string): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return fail(path, '揭示列表必须是数组');
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) return fail(itemPath, '揭示行必须是对象');
    if (!REVEAL_TARGETS.includes(item.reveal as RevealTarget)) {
      return fail(`${itemPath}.reveal`, `不支持的揭示目标：${String(item.reveal)}`);
    }
    if (item.condition !== undefined && item.condition !== null) {
      const problem = validateConditionGroup(item.condition, `${itemPath}.condition`);
      if (problem) return problem;
    }
  }
  return undefined;
}

export function encodeRevealTriggerList(value: unknown): unknown[] {
  return (value as readonly SpotRevealTriggerDraft[]).map(draft => ({
    reveal: draft.reveal,
    ...(draft.condition ? { condition: draft.condition } : {}),
  }));
}

// --- 标签（TagPath 以 `a/b` 显示形式编辑） ---

export function validateTagList(value: unknown, path: string): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return fail(path, '标签必须是数组');
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== 'string' || item.trim() === '') return fail(`${path}[${index}]`, '标签必须是非空字符串');
    if (item.split('/').some(segment => segment.trim() === '')) {
      return fail(`${path}[${index}]`, `标签路径不能有空段：${item}`);
    }
  }
  return undefined;
}

export function encodeTagList(value: unknown): string[][] {
  return (value as readonly string[]).map(tag => tag.split('/').map(segment => segment.trim()).filter(Boolean));
}

// --- 卡池引用 ---

export function validateGachaPoolList(
  value: unknown,
  path: string,
  context?: AuthoringValidationContext,
): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return fail(path, '卡池必须是数组');
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== 'string' || item.trim() === '') return fail(`${path}[${index}]`, '卡池引用必须是非空字符串');
    if (context?.gachaPoolIds && !context.gachaPoolIds.has(item)) {
      return fail(`${path}[${index}]`, `卡池未注册：${item}`);
    }
  }
  return undefined;
}

export function encodeGachaPoolList(value: unknown): string[] {
  return [...(value as readonly string[])];
}

// --- 反解析（Def → 草稿）：编辑器 round-trip 投影 ---

export interface SpotDecodedDraft {
  functionalities?: SpotFunctionalityDraft[];
  levelUpgrades?: SpotLevelUpgradeDraft[];
  purchaseOptions: PaymentOptionDraft[];
  revealTriggers?: SpotRevealTriggerDraft[];
  tags?: string[];
  gachaPools?: string[];
  /** 无法 round-trip 的功能 id：编辑器只展示诊断并阻止静默覆盖。 */
  unsupportedFunctionalityIds?: string[];
  /** 使用动态表达式或非法结构、无法由 Runtime Editor 无损回写的支付方案路径。 */
  unsupportedPaymentOptionPaths?: string[];
}

export function decodeSpotContent(spot: SpotDef): SpotDecodedDraft {
  const decoded: SpotDecodedDraft = { purchaseOptions: [] };
  const unsupported: string[] = [];
  const unsupportedPayments: string[] = [];
  const functionalities: SpotFunctionalityDraft[] = [];

  (spot.functionalities ?? []).forEach((functionality, index) => {
    const draft = toFunctionalityDraft(functionality, index);
    if (draft) functionalities.push(draft);
    else unsupported.push(functionality.id);
  });

  if (functionalities.length > 0) decoded.functionalities = functionalities;
  if (unsupported.length > 0) decoded.unsupportedFunctionalityIds = unsupported;

  const purchaseOptions = decodePaymentOptions(spot.purchaseOptions, 'purchaseOptions', unsupportedPayments);
  decoded.purchaseOptions = purchaseOptions ?? [];

  if (spot.levelUpgrades?.length) {
    decoded.levelUpgrades = spot.levelUpgrades.map((upgrade, index) => {
      const paymentOptions = decodePaymentOptions(upgrade.paymentOptions, `levelUpgrades[${index}].paymentOptions`, unsupportedPayments);
      return {
        level: upgrade.level,
        paymentOptions: paymentOptions ?? [],
        ...(upgrade.condition ? { condition: upgrade.condition } : {}),
        effects: [...upgrade.effects],
      };
    });
  }

  if (spot.revealTriggers?.length) {
    decoded.revealTriggers = spot.revealTriggers.map(trigger => ({
      reveal: trigger.reveal,
      ...(trigger.condition && 'type' in trigger.condition ? { condition: trigger.condition } : {}),
    }));
  }

  if (spot.tags?.length) decoded.tags = spot.tags.map(tag => tag.join('/'));
  if (spot.gachaPools?.length) decoded.gachaPools = [...spot.gachaPools];
  if (unsupportedPayments.length > 0) decoded.unsupportedPaymentOptionPaths = unsupportedPayments;

  return decoded;
}

function decodePaymentOptions(
  options: PaymentOptionDef[] | undefined,
  path: string,
  unsupported: string[],
): PaymentOptionDraft[] | undefined {
  if (options === undefined) return undefined;
  const start = unsupported.length;
  const decoded: PaymentOptionDraft[] = [];
  options.forEach((option, optionIndex) => {
    const costs: PaymentCostDraft[] = [];
    for (const [costIndex, cost] of option.costs.entries()) {
      const amount = constantExpressionValue(cost.amount);
      if (amount === undefined) {
        unsupported.push(`${path}[${option.id || optionIndex}].costs[${costIndex}].amount`);
        continue;
      }
      if (cost.type === 'resource') costs.push({ type: 'resource', resourceId: cost.resourceId, amount });
      else if (cost.type === 'item') costs.push({ type: 'item', itemId: cost.itemId, amount });
      else unsupported.push(`${path}[${option.id || optionIndex}].costs[${costIndex}].type`);
    }
    if (unsupported.length !== start) return;
    decoded.push({
      id: option.id,
      ...(option.label ? { label: option.label } : {}),
      ...(option.condition ? { condition: option.condition } : {}),
      costs,
    });
  });
  return unsupported.length === start ? decoded : undefined;
}

function constantExpressionValue(value: unknown): number | undefined {
  if (typeof value === 'number') return isFiniteNumber(value) ? value : undefined;
  if (!isRecord(value) || value.type !== 'const' || !isFiniteNumber(value.value)) return undefined;
  return value.value;
}

function toFunctionalityDraft(functionality: SpotFunctionalityDef, index: number): SpotFunctionalityDraft | undefined {
  const id = localFunctionalityId(functionality.id, index);
  const condition = functionality.condition ? { condition: functionality.condition } : {};
  switch (functionality.kind) {
    case 'flow':
      return typeof functionality.amount === 'number' && isFiniteNumber(functionality.amount) && functionality.resource
        ? { id, kind: 'flow', resource: functionality.resource, amount: functionality.amount, ...condition }
        : undefined;
    case 'linearYield':
      return typeof functionality.amountPerLevel === 'number' && functionality.resource
        ? {
            id,
            kind: 'linearYield',
            resource: functionality.resource,
            amountPerLevel: functionality.amountPerLevel,
            ...(functionality.startLevel ? { startLevel: functionality.startLevel } : {}),
            ...condition,
          }
        : undefined;
    case 'shop':
      return functionality.shopId
        ? { id, kind: 'shop', shopId: functionality.shopId, ...condition }
        : undefined;
    case 'restartInit':
    case 'hardResetInit':
    case 'gacha':
      return { id, kind: functionality.kind, ...condition };
    default:
      return undefined;
  }
}

/** 引擎功能 id → 编辑器局部键：已知前缀剥离，其余回退为稳定占位键。 */
function localFunctionalityId(engineId: string, index: number): string {
  const prefix = 'runtime:resource:';
  const raw = engineId.startsWith(prefix) ? engineId.slice(prefix.length) : '';
  return FUNCTIONALITY_ID_PATTERN.test(raw) ? raw : `legacy-${index + 1}`;
}

/** 简单实体引用列表：编辑器只接受完整 ID，候选存在性由 candidate Registry 统一检查。 */
export function validateEntityRefList(value: unknown, path: string, refType: string): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return problem('invalid-field', path, `${path} 必须是数组`);
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || !item.trim()) return problem('invalid-field', `${path}[${index}]`, '引用必须是非空字符串');
    const parsed = parseEntityId(item);
    if (!parsed || parsed.type !== refType) return problem('invalid-field', `${path}[${index}]`, `引用必须是完整 ${refType} ID：${item}`);
    if (seen.has(item)) return problem('invalid-field', `${path}[${index}]`, '引用不能重复');
    seen.add(item);
  }
  return undefined;
}

export function encodeEntityRefList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item).trim()) : [];
}

/** ResourceAmount 草稿只允许资源引用与有限非负金额。 */
export function validateResourceAmountList(value: unknown, path: string, context?: AuthoringValidationContext): AuthoringProblem | undefined {
  if (!Array.isArray(value)) return problem('invalid-field', path, `${path} 必须是数组`);
  for (const [index, item] of value.entries()) {
    if (!isRecord(item) || typeof item.resourceId !== 'string' || !item.resourceId.trim()) {
      return problem('invalid-field', `${path}[${index}].resourceId`, '资源引用不能为空');
    }
    if (context?.resourceIds && !context.resourceIds.has(item.resourceId)) {
      return problem('invalid-field', `${path}[${index}].resourceId`, `未知资源：${item.resourceId}`);
    }
    if (!isFiniteNumber(item.amount) || item.amount < 0) {
      return problem('invalid-field', `${path}[${index}].amount`, '金额必须是非负有限数字');
    }
  }
  return undefined;
}

export function encodeResourceAmountList(value: unknown): Array<{ resourceId: string; amount: number }> {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    resourceId: String((item as Record<string, unknown>).resourceId ?? '').trim(),
    amount: Number((item as Record<string, unknown>).amount ?? 0),
  }));
}

function problem(code: AuthoringProblem['code'], path: string, message: string): AuthoringProblem {
  return { code, path, message };
}
