import type { RuntimeDefinitionRef } from '../contracts/runtime-content-browser';
import type { ReferenceEntry, ReferenceLocation, ReferenceRequest } from './runtime-content-reference-types';

type RecordValue = Record<string, unknown>;
type Rule = readonly [RegExp, string, readonly string[]];

const FIELD_RULES: Readonly<Record<string, readonly Rule[]>> = {
  inits: [
    [/^\$\.defaultAreas\[\d+\]$/, '默认 Area', ['areas']],
    [/^\$\.startStoryId$/, '起始剧情入口', ['stories', 'activeStories']],
    [/^\$\.purchaseCost\[\d+\]\.resourceId$/, '支付资源', ['resourceDisplays']],
  ],
  areas: [
    [/^\$\.initId$/, '所属 Init', ['inits']],
    [/^\$\.defaultSpots\[\d+\]$/, '默认 Spot', ['spots']],
    [/^\$\.adjacentAreaIds\[\d+\]$/, '相邻 Area', ['areas']],
  ],
  spots: [
    [/^\$\.areaId$/, '所属 Area', ['areas']],
    [/^\$\.gachaPools\[\d+\]$/, '设施卡池', ['gachaPools']],
    [/^\$\.colorGroupId$/, '默认色组', ['colorGroups']],
  ],
  enhancements: [
    [/^\$\.price\[\d+\]\.resourceId$/, '强化价格资源', ['resourceDisplays']],
    [/^\$\.affectorPackIds\[\d+\]$/, 'Affector Pack', ['affectorPacks']],
  ],
  items: [
    [/^\$\.sellPrice\.resourceId$/, '出售资源', ['resourceDisplays']],
    [/^\$\.affectorPackIds\[\d+\]$/, 'Affector Pack', ['affectorPacks']],
  ],
  stories: [
    [/^\$\.talklets\[\d+\]\.jumpToStory$/, '剧情跳转', ['stories']],
    [/^\$\.talklets\[\d+\]\.choices\[\d+\]\.jumpToStory$/, '选项剧情跳转', ['stories']],
    [/^\$\.talklets\[\d+\]\.kizuna\.storyId$/, '羁绊剧情入口', ['activeStories']],
  ],
  storyEntries: [
    [/^\$\.storyId$/, '所属 Story', ['stories']],
    [/^\$\.availableInits\[\d+\]$/, '可用 Init', ['inits']],
    [/^\$\.branchGuards\[\d+\]\.storyId$/, '分支 Story', ['stories']],
    [/^\$\.branchGuards\[\d+\]\.prerequisites\[\d+\]\.storyId$/, '前置 Story', ['stories']],
    [/^\$\.followUps\[\d+\]\.waitFor\.areaId$/, '后续等待 Area', ['areas']],
    [/^\$\.followUps\[\d+\]\.outcome\.storyEntryId$/, '后续 StoryEntry', ['activeStories', 'passiveStories']],
    [/^\$\.pushAfterStory$/, '前置剧情', ['stories']],
  ],
  characterVariants: [
    [/^\$\.proto$/, '原型角色', ['characters']],
    [/^\$\.colorGroupId$/, '默认色组', ['colorGroups']],
    [/^\$\.curve$/, '培养曲线', ['cultivateCurves']],
    [/^\$\.progression\.favoriteItem$/, '爱用品', ['favoriteItems']],
    [/^\$\.progression\.uniqueWeapon$/, '专武', ['uniqueWeapons']],
    [/^\$\.progression\.initialTraits\[\d+\]$/, '初始特性', ['traits']],
    [/^\$\.progression\.gearSlots\[\d+\]\.gear$/, '装备类型线', ['gears']],
  ],
  favoriteItems: [[/^\$\.owner$/, '所属差分', ['characterVariants']]],
  uniqueWeapons: [[/^\$\.owner$/, '所属差分', ['characterVariants']]],
  gears: [[/^\$\.tiers\[\d+\]\.upgradeCost\[\d+\]\.itemId$/, '装备升级物品', ['items']]],
  gearConfig: [
    [/^\$\.expItems\[\d+\]\.itemId$/, '经验材料', ['items']],
    [/^\$\.levelCost\.itemId$/, '升级物品', ['items']],
  ],
  gachaPools: [
    [/^\$\.currency$/, '抽卡资源', ['resourceDisplays']],
    [/^\$\.members\[\d+\]$/, '卡池成员', ['characterVariants']],
    [/^\$\.featured\[\d+\]$/, 'Featured 成员', ['characterVariants']],
  ],
  passivePools: [[/^\$\.children\[\d+\]\.id$/, '闲聊池成员', ['passiveStories', 'passivePools']]],
  affectorPacks: [
    [/^\$\.entries\[\d+\]\.flows\[\d+\]\.resource$/, 'Affector 产出资源', ['resourceDisplays']],
    [/^\$\.entries\[\d+\]\.areaConnections\[\d+\]\.fromAreaId$/, '连接起点 Area', ['areas']],
    [/^\$\.entries\[\d+\]\.areaConnections\[\d+\]\.toAreaId$/, '连接终点 Area', ['areas']],
  ],
};

const EFFECT_PATHS: Readonly<Record<string, readonly RegExp[]>> = {
  inits: [/^\$\.enterEffects\[\d+\]\.effects\[\d+\]$/, /^\$\.triggers\[\d+\]\.effects\[\d+\]$/],
  areas: [/^\$\.enterEffects\[\d+\]\.effects\[\d+\]$/],
  spots: [/^\$\.levelUpgrades\[\d+\]\.effects\[\d+\]$/, /^\$\.triggers\[\d+\]\.effects\[\d+\]$/],
  enhancements: [/^\$\.effects\[\d+\]$/],
  items: [/^\$\.(useEffects|pickupEffects)\[\d+\]$/],
  stories: [/^\$\.talklets\[\d+\]\.effects\[\d+\]$/, /^\$\.talklets\[\d+\]\.choices\[\d+\]\.effects\[\d+\]$/],
  storyEntries: [/^\$\.conditionalRewards\[\d+\]\.effects\[\d+\]$/, /^\$\.completionReward\.(first|repeat)\[\d+\]$/, /^\$\.reactions\[\d+\]\.effects\[\d+\]$/],
  characters: [/^\$\.bond\.milestones\[\d+\]\.effects\[\d+\]$/],
  characterVariants: [/^\$\.progression\.skills\[\d+\]\.levelEffects\[\d+\]$/],
  favoriteItems: [/^\$\.stages\[\d+\]\.effects\[\d+\]$/],
  uniqueWeapons: [/^\$\.stars\[\d+\]\.effects\[\d+\]$/],
  traits: [/^\$\.effects\[\d+\]$/],
  gears: [/^\$\.tiers\[\d+\]\.(baseEffects|perLevelEffects)\[\d+\]$/],
  triggerDefs: [/^\$\.effects\[\d+\]$/],
  affectorPacks: [/^\$\.entries\[\d+\]\.(effects|perTickEffects)\[\d+\]$/],
};

const CONDITION_ROOTS: Readonly<Record<string, readonly RegExp[]>> = {
  areas: [/^\$\.enterEffects\[\d+\]\.condition$/, /^\$\.revealTriggers\[\d+\]\.condition$/],
  spots: [/^\$\.purchaseOptions\[\d+\]\.condition$/, /^\$\.levelUpgrades\[\d+\]\.condition$/, /^\$\.levelUpgrades\[\d+\]\.paymentOptions\[\d+\]\.condition$/, /^\$\.functionalities\[\d+\]\.condition$/, /^\$\.revealTriggers\[\d+\]\.condition$/],
  inits: [/^\$\.enterEffects\[\d+\]\.condition$/, /^\$\.triggers\[\d+\]\.condition$/, /^\$\.revealTriggers\[\d+\]\.condition$/],
  stories: [/^\$\.talklets\[\d+\]\.choices\[\d+\]\.condition$/],
  storyEntries: [/^\$\.triggerCondition$/, /^\$\.conditionalRewards\[\d+\]\.condition$/, /^\$\.reactions\[\d+\]\.condition$/, /^\$\.block$/],
  gachaPools: [/^\$\.closeWhen$/],
  enhancements: [/^\$\.revealTriggers\[\d+\]\.condition$/, /^\$\.addsFunctionalities\[\d+\]\.condition$/],
  items: [/^\$\.useCondition$/, /^\$\.revealTriggers\[\d+\]\.condition$/],
  passivePools: [/^\$\.condition$/],
  triggerDefs: [/^\$\.condition$/],
  affectorPacks: [/^\$\.entries\[\d+\]\.condition$/],
  favoriteItems: [/^\$\.stages\[\d+\]\.unlock$/],
  traits: [/^\$\.(learnCondition|abandonCondition)$/],
};

const PRESENTATION_CONDITION_KINDS = new Set(['inits', 'areas', 'spots', 'enhancements', 'characters', 'characterVariants']);
const PRESENTATION_CONDITION_ROOTS = [
  /^\$\.presentation\.additions\[\d+\]\.availableWhen$/,
  /^\$\.(theme|presentation\.(default\.theme|additions\[\d+\]\.override\.theme))\.presentation\.(components|infoItems)\[\d+\]\.visibleWhen$/,
];

const TRIGGER_EVENT_PATHS: Readonly<Record<string, readonly RegExp[]>> = {
  inits: [/^\$\.triggers\[\d+\]\.on$/], triggerDefs: [/^\$\.on$/],
  storyEntries: [/^\$\.reactions\[\d+\]\.on$/],
};

const STORY_ENTRY_KINDS = new Set(['storyEntries', 'activeStories', 'passiveStories']);

function rulesFor<T>(rules: Readonly<Record<string, readonly T[]>>, kind: string): readonly T[] {
  const own = rules[kind] ?? [];
  return STORY_ENTRY_KINDS.has(kind) && kind !== 'storyEntries' ? [...own, ...(rules.storyEntries ?? [])] : own;
}

const TARGET_RULES: Readonly<Record<string, readonly [string, string]>> = {
  resource: ['资源', 'resourceDisplays'],
  spotLevel: ['Spot 等级', 'spots'],
  manager: ['Spot 管理者状态', 'spots'],
  hasEnh: ['强化状态', 'enhancements'],
  hasReadStory: ['已读剧情', 'stories'],
  hasReadStoryInRun: ['本 Run 已读剧情', 'stories'],
  visitedStoryInChain: ['剧情链访问', 'stories'],
  protoStat: ['原型角色统计', 'characters'],
  affectionLevel: ['好感等级', 'characterVariants'],
  area: ['当前 Area', 'areas'],
};

const EFFECT_TARGETS: Readonly<Record<string, readonly [string, string, 'target' | 'value']>> = {
  setResource: ['设置资源', 'resourceDisplays', 'target'],
  addResource: ['增加资源', 'resourceDisplays', 'target'],
  setSpotLevel: ['设置 Spot 等级', 'spots', 'target'],
  addSpotLevel: ['增加 Spot 等级', 'spots', 'target'],
  setSpotMaxLevel: ['设置 Spot 等级上限', 'spots', 'target'],
  removeSpotMaxLevel: ['移除 Spot 等级上限', 'spots', 'target'],
  setManager: ['分配管理者的 Spot', 'spots', 'target'],
  addItem: ['增加物品', 'items', 'target'],
  loot: ['掉落表', 'dropTables', 'target'],
  triggerStory: ['触发剧情', 'stories', 'target'],
  travelToArea: ['移动 Area', 'areas', 'target'],
  grantCharacter: ['获得角色差分', 'characterVariants', 'target'],
  addAffectionExp: ['增加好感', 'characterVariants', 'target'],
  addEnhancement: ['获得强化', 'enhancements', 'value'],
  unlockInit: ['解锁 Init', 'inits', 'value'],
};

const ENTITY_KINDS: Readonly<Record<string, string>> = {
  init: 'inits', area: 'areas', spot: 'spots', enhancement: 'enhancements', variant: 'characterVariants',
};

function isRecord(value: unknown): value is RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Map || value instanceof Set) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function safeRecord(value: RecordValue): RecordValue {
  const result: RecordValue = Object.create(null) as RecordValue;
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && 'value' in descriptor) result[key] = descriptor.value;
  }
  return result;
}

function walk(value: unknown, path: string, visit: (value: unknown, path: string, parent: unknown, parentPath: string) => void, parent: unknown = undefined, parentPath = '', ancestors = new WeakSet<object>()): void {
  if (value !== null && typeof value === 'object') {
    if (ancestors.has(value)) return;
    ancestors.add(value);
  }
  const safeValue = isRecord(value) ? safeRecord(value) : value;
  const safeParent = isRecord(parent) ? safeRecord(parent) : parent;
  visit(safeValue, path, safeParent, parentPath);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor && 'value' in descriptor) walk(descriptor.value, `${path}[${index}]`, visit, value, path, ancestors);
    }
  } else if (value instanceof Map) {
    for (const [key, entry] of value) walk(entry, `${path}[${String(key)}]`, visit, value, path, ancestors);
  } else if (isRecord(value)) {
    for (const [key, entry] of Object.entries(safeValue as RecordValue)) walk(entry, path === '$' ? `$.${key}` : `${path}.${key}`, visit, value, path, ancestors);
  }
  if (value !== null && typeof value === 'object') ancestors.delete(value);
}

function isQualifiedId(value: string): boolean {
  return value.split(':').length >= 3 && !/^(https?|data):/i.test(value);
}

function matches(path: string, patterns: readonly RegExp[] | undefined): boolean {
  return patterns?.some(pattern => pattern.test(path)) ?? false;
}

function conditionPath(kind: string, path: string): boolean {
  const roots = [...rulesFor(CONDITION_ROOTS, kind), ...(PRESENTATION_CONDITION_KINDS.has(kind) ? PRESENTATION_CONDITION_ROOTS : [])];
  return roots.some(root => {
    if (root.test(path)) return true;
    const prefix = path.match(/^(.*?)(?:\.conditions\[\d+\])+$/)?.[1];
    if (!prefix) return false;
    return root.test(prefix);
  });
}

function targetKindOfEntityKey(value: string): { readonly kind: string; readonly id: string } | undefined {
  const separator = value.indexOf(':');
  if (separator < 1) return undefined;
  const kind = ENTITY_KINDS[value.slice(0, separator)];
  const id = value.slice(separator + 1);
  return kind && id ? { kind, id } : undefined;
}

function idFieldName(path: string): string {
  const segments = path.split(/[.\[\]]/).filter(Boolean);
  return segments[segments.length - 1]?.toLowerCase() ?? '';
}

function isOperationField(path: string): boolean {
  return /(?:operationevent|action|location|actor|track|fact|position|scene|battle|mission)ids?$/.test(idFieldName(path));
}

function isIdLikeField(path: string): boolean {
  const field = idFieldName(path);
  return field !== 'id' && (/(?:id|ids|ref|refs)$/.test(field) || ['proto', 'curve', 'gear', 'members', 'featured', 'children'].includes(field));
}

function entityPresentationLocations(entry: ReferenceEntry | undefined, optionId: string): readonly ReferenceLocation[] {
  if (!entry || entry.derived || !isRecord(entry.value)) return [];
  const presentation = safeRecord(entry.value).presentation;
  if (!isRecord(presentation) || !Array.isArray(safeRecord(presentation).additions)) return [];
  const additions = safeRecord(presentation).additions as readonly unknown[];
  return additions.flatMap((option, index) =>
    isRecord(option) && safeRecord(option).id === optionId
      ? [{ ref: entry.ref, path: `$.presentation.additions[${index}]` }]
      : [],
  );
}

/** Collect only references whose source schema and discriminant give their meaning. */
export function collectDefinitionReferences(
  source: RuntimeDefinitionRef,
  value: unknown,
  entries: readonly ReferenceEntry[],
): readonly ReferenceRequest[] {
  if (source.definitionKind.toLowerCase().includes('operation')) return [];

  const requests: ReferenceRequest[] = [];
  const declaredPaths = new Set<string>();
  const seenRequests = new Set<string>();
  const themeEffectRoots = new Set<string>();
  const add = (path: string, rawValue: unknown, relation: string, targetKinds?: readonly string[], scope: ReferenceRequest['scope'] = 'global', context?: RuntimeDefinitionRef, locations?: readonly ReferenceLocation[], confidence: ReferenceRequest['confidence'] = 'declared') => {
    if (typeof rawValue !== 'string' || !rawValue.trim()) return;
    const requestKey = `${path}\u0000${rawValue}\u0000${scope}\u0000${context?.definitionKind ?? ''}\u0000${context?.fullId ?? ''}`;
    if (seenRequests.has(requestKey)) return;
    seenRequests.add(requestKey);
    requests.push({ path, value: rawValue, relation, confidence, scope, ...(targetKinds ? { targetKinds } : {}), ...(locations ? { locations } : {}), ...(context ? { context } : {}) });
    if (confidence === 'declared') declaredPaths.add(path);
  };
  const kind = source.definitionKind;

  walk(value, '$', (node, path, parent, parentPath) => {
    const rule = rulesFor(FIELD_RULES, kind).find(([pattern]) => pattern.test(path));
    if (rule) add(path, node, rule[1], rule[2]);

    if (kind === 'spots' && isRecord(node) && /^\$\.purchaseOptions\[\d+\]\.costs\[\d+\]$|^\$\.levelUpgrades\[\d+\]\.paymentOptions\[\d+\]\.costs\[\d+\]$/.test(path)) {
      const type = node.type;
      if (type === 'resource') add(`${path}.resourceId`, node.resourceId, '支付资源', ['resourceDisplays']);
      else if (type === 'item') add(`${path}.itemId`, node.itemId, '支付物品', ['items']);
    }
    if ((kind === 'spots' || kind === 'enhancements') && path.endsWith('.resource') && isRecord(parent) && parent.kind === 'linearYield') {
      add(path, node, '产出资源', ['resourceDisplays']);
    }
    if ((kind === 'spots' || kind === 'enhancements') && path.endsWith('.shopId') && isRecord(parent) && parent.kind === 'shop') {
      add(path, node, '目标商店', ['shops']);
    }
    if (kind === 'spots' && path.startsWith('$.functionalities[') && path.endsWith('.operationEventId') && isRecord(parent) && parent.kind === 'operationEntry') {
      add(path, node, '设施关卡入口', ['operationEvents']);
    }
    if (kind === 'enhancements' && isRecord(parent) && parentPath === '$.attachment') {
      if (parent.kind === 'area' && path === '$.attachment.areaId') add(path, node, '强化挂靠 Area', ['areas']);
      if (parent.kind === 'init' && path === '$.attachment.initId') add(path, node, '强化挂靠 Init', ['inits']);
    }
    const costTarget = (() => {
      if (kind === 'characterVariants' && /^\$\.progression\.skills\[\d+\]\.levelCosts\[\d+\]\.(resource|item)$/.test(path)) return idFieldName(path);
      if (kind === 'favoriteItems' && /^\$\.stages\[\d+\]\.cost\.(resource|item)$/.test(path)) return idFieldName(path);
      if (kind === 'uniqueWeapons' && /^\$\.stars\[\d+\]\.cost\.(resource|item)$/.test(path)) return idFieldName(path);
      return undefined;
    })();
    if (costTarget === 'resource') add(path, node, '养成消耗资源', ['resourceDisplays']);
    if (costTarget === 'item') add(path, node, '养成消耗物品', ['items']);
    if (kind === 'gachaPools' && path.startsWith('$.dupRewards.bonusResources.') && parentPath === '$.dupRewards.bonusResources') {
      add(path, path.slice(parentPath.length + 1), '重复奖励资源', ['resourceDisplays']);
    }

    if (matches(path, rulesFor(TRIGGER_EVENT_PATHS, kind)) && isRecord(node)) {
      const eventKind = node.kind;
      const eventRules: Readonly<Record<string, readonly [string, string]>> = {
        resource: ['resource', 'resourceDisplays'], spotLevel: ['spotId', 'spots'], item: ['itemId', 'items'],
        story: ['storyId', 'stories'], init: ['initId', 'inits'], area: ['areaId', 'areas'],
        shop: ['shopId', 'shops'], character: ['variantId', 'characterVariants'], cultivated: ['variantId', 'characterVariants'],
      };
      const eventRule = typeof eventKind === 'string' ? eventRules[eventKind] : undefined;
      if (eventRule) add(`${path}.${eventRule[0]}`, node[eventRule[0]], `触发事件 ${eventKind}`, [eventRule[1]]);
    }

    if (conditionPath(kind, path) && isRecord(node)) {
      const target = typeof node.target === 'string' ? TARGET_RULES[node.target] : undefined;
      if (target) add(`${path}.key`, node.key, target[0], [target[1]]);
    }

    if (matches(path, rulesFor(EFFECT_PATHS, kind)) && isRecord(node) && typeof node.op === 'string') {
      if (node.op === 'setTheme') themeEffectRoots.add(path);
      const effectRule = EFFECT_TARGETS[node.op];
      if (effectRule) {
        const [relation, targetKind, field] = effectRule;
        const targetKinds = node.op === 'triggerStory' ? ['activeStories', 'passiveStories'] : [targetKind];
        add(`${path}.${field}`, node[field], relation, targetKinds);
        if (node.op === 'setManager') add(`${path}.value`, node.value, '管理者角色', ['characters']);
        if (node.op === 'triggerStory' && typeof node.owner === 'string' && node.owner) add(`${path}.owner`, node.owner, '剧情沙盒角色', ['characterVariants']);
      }
      if (node.op === 'clearAllChatFlow' && typeof node.target === 'string' && node.target) {
        add(`${path}.target`, node.target, '角色聊天流', ['characterVariants']);
      }
      const effectValue = isRecord(node.value) ? safeRecord(node.value) : undefined;
      if (node.op === 'setTheme' && effectValue) {
        if ((effectValue.scope === 'area' || effectValue.scope === 'student') && typeof effectValue.entityKey === 'string') {
          const entity = targetKindOfEntityKey(effectValue.entityKey);
          const expectedKind = effectValue.scope === 'area' ? 'areas' : 'characterVariants';
          if (entity?.kind === expectedKind) add(`${path}.value.entityKey`, entity.id, '实体主题目标', [expectedKind]);
        }
      }
      if ((node.op === 'setEntityPresentation' || node.op === 'clearEntityPresentation') && typeof node.target === 'string') {
        const entity = targetKindOfEntityKey(node.target);
        if (entity) {
          const targetRef = { definitionKind: entity.kind, fullId: entity.id };
          add(`${path}.target`, entity.id, '实体表现目标', [entity.kind]);
          if (node.op === 'setEntityPresentation' && effectValue && typeof effectValue.optionId === 'string') {
            const owner = entries.find(entry => entry.ref.definitionKind === entity.kind && entry.ref.fullId === entity.id);
            add(`${path}.value.optionId`, effectValue.optionId, '实体表现选项', undefined, 'local', targetRef, entityPresentationLocations(owner, effectValue.optionId));
          }
        }
      }
    }

    const expressionValue = isRecord(node) && node.type === 'value' && isRecord(node.value) ? safeRecord(node.value) : undefined;
    if (expressionValue && expressionValue.type === 'value' && isRecord(expressionValue.params)) {
      const expression = expressionValue;
      const params = isRecord(expression.params) ? expression.params : {};
      if (expression.source === 'res') add(`${path}.value.params.resource`, params.resource, '表达式资源', ['resourceDisplays']);
      if (expression.source === 'spotLevel') add(`${path}.value.params.spot`, params.spot, '表达式 Spot', ['spots']);
      if (expression.source === 'areaSpotCount') add(`${path}.value.params.area`, params.area, '表达式 Area', ['areas']);
      if (expression.source === 'managerCount') add(`${path}.value.params.init`, params.init, '表达式 Init', ['inits']);
    }

    const segments = path.split(/[.\[\]]/).filter(Boolean);
    const isThemePath = segments.includes('theme') || segments.includes('customTheme')
      || [...themeEffectRoots].some(root => path.startsWith(`${root}.value.`));
    if (typeof node === 'string' && path.endsWith('.colorGroupId') && isThemePath) add(path, node, '主题色组', ['colorGroups']);
    if (typeof node === 'string' && path.endsWith('.asset') && segments.includes('components') && isThemePath) add(path, node, '表现图片', ['pics']);
    if (isThemePath && path.endsWith('.value') && isRecord(parent) && parent.kind === 'image' && typeof node === 'string') {
      if (isQualifiedId(node)) add(path, node, '背景图片', ['pics']);
      else if (node.trim() && !/^(https?|data):|^[/\\.]/i.test(node)) add(path, node, '可能的背景图片', undefined, 'candidate', undefined, undefined, 'inferred');
    }

    if (isRecord(node) && node.t === 'str' && typeof node.v === 'string' && segments.includes('extra') && isQualifiedId(node.v)) {
      add(`${path}.v`, node.v, 'Extra 扩展候选', undefined, 'candidate', undefined, undefined, 'inferred');
    } else if (typeof node === 'string' && isQualifiedId(node) && isIdLikeField(path) && !declaredPaths.has(path) && !isOperationField(path)) {
      add(path, node, '未知扩展候选', undefined, 'candidate', undefined, undefined, 'inferred');
    }
  });

  return requests;
}
