import type { RuntimeContentDefinitionDetail } from '../../../data-services/contracts/runtime-content-browser';
import type { InspectorReference, InspectorSummaryField } from './types';

interface RecordLike {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueAt(raw: unknown, key: string): unknown {
  return isRecord(raw) ? raw[key] : undefined;
}

function countOf(raw: unknown, key: string): number | undefined {
  const value = valueAt(raw, key);
  if (Array.isArray(value)) return value.length;
  if (value instanceof Map) return value.size;
  if (isRecord(value) && value.$type === 'map' && Array.isArray(value.entries)) return value.entries.length;
  return undefined;
}

function addIfPresent(fields: InspectorSummaryField[], raw: unknown, key: string, label: string): void {
  const value = valueAt(raw, key);
  if (value === undefined || value === null || value === '') return;
  fields.push({ label, value });
}

function addCountIfPresent(fields: InspectorSummaryField[], raw: unknown, key: string, label: string): void {
  const count = countOf(raw, key);
  if (count !== undefined) fields.push({ label, value: count });
}

const KIND_FIELDS: Readonly<Record<string, readonly [string, string][]>> = {
  inits: [['startStoryId', '起始剧情'], ['worldTilt', '世界倾斜'], ['worldTiltAlias', '倾斜值别名']],
  areas: [['initId', '所属 Init']],
  spots: [['areaId', '所属 Area'], ['maxLevel', '等级上限'], ['global', '跨世界线共享']],
  enhancements: [['autoApply', '自动应用'], ['maxStacks', '最大层数'], ['irreversible', '不可撤回']],
  stories: [['name', '剧情名称']],
  characters: [['school', '学校'], ['rarity', '稀有度']],
  charaProfiles: [['activeName', '当前名称'], ['activeAvatar', '当前头像']],
  characterVariants: [['proto', '原型角色'], ['curve', '培养曲线'], ['favoriteItem', '爱用品'], ['uniqueWeapon', '专武'], ['school', '学校'], ['rarity', '稀有度'], ['isDefault', '默认差分']],
  favoriteItems: [['owner', '所属差分']],
  uniqueWeapons: [['owner', '所属差分']],
  gears: [['slot', '装备槽类别']],
  colorGroups: [['compositionType', '色彩构成']],
  colorEquipments: [['colorGroupId', '所属色彩组']],
  themeDesigns: [['colorGroupId', '所属色彩组']],
  pics: [['kind', '图片类型'], ['src', '资源路径']],
  activeStories: [['storyId', '目标 Story']],
  passiveStories: [['poolId', '所属闲聊池']],
  storyEntries: [['storyId', '目标 Story'], ['type', '入口类型'], ['replayable', '可重播'], ['completionStrategy', '完成策略']],
  passivePools: [['owner', '所属来源'], ['cooldownFrames', '冷却帧数']],
  items: [['maxStack', '最大堆叠'], ['rarity', '稀有度'], ['type', '物品类型']],
  gachaPools: [['mode', '卡池模式'], ['currency', '抽卡资源'], ['costPerPull', '单抽成本']],
  cultivateCurves: [['maxLevel', '等级上限'], ['starMax', '星级上限']],
  affectionConfig: [['expBeyond', '超出经验需求'], ['maxLevel', '好感上限']],
  resourceDisplays: [['resourceId', '资源 ID'], ['label', '显示标签'], ['showWhen', '显示条件']],
  tagDefs: [['parent', '父标签']],
  gearConfig: [['levelCost', '每级附加消耗']],
  extras: [['$type', '数据形态']],
  dropTables: [['maxRolls', '最大抽取次数']],
  triggerDefs: [['once', '一次性触发']],
  funcletDefs: [['description', '规则描述']],
};

const KIND_COUNTS: Readonly<Record<string, readonly [string, string][]>> = {
  spots: [['functionalities', '功能项数量'], ['purchaseOptions', '支付方案数量'], ['levelUpgrades', '升级数量'], ['revealTriggers', '揭示触发器数量'], ['tags', '标签数量']],
  stories: [['talklets', 'Talklet 数量'], ['chapters', '章节数量']],
  activeStories: [['talklets', 'Talklet 数量']],
  passiveStories: [['talklets', 'Talklet 数量']],
  passivePools: [['children', '成员数量']],
  characterVariants: [['initialTraits', '初始特性数量'], ['gearSlots', '装备槽数量'], ['affectionLevelCapByStar', '好感星级锁数量']],
  inits: [['defaultAreas', '默认 Area 数量'], ['tags', '标签数量']],
  areas: [['defaultSpots', '默认 Spot 数量'], ['adjacentAreaIds', '相邻 Area 数量'], ['tags', '标签数量']],
  enhancements: [['effects', '效果数量'], ['tags', '标签数量']],
  gachaPools: [['members', '成员数量'], ['featured', 'Featured 数量']],
  gears: [['tiers', '成长层级数量']],
  favoriteItems: [['stages', '成长阶段数量']],
  uniqueWeapons: [['stars', '星级数量']],
  colorGroups: [['slots', '色彩槽数量']],
  colorEquipments: [['effects', '效果数量']],
  tagDefs: [['children', '子标签数量']],
  dropTables: [['entries', '掉落条目数量'], ['guaranteed', '保底掉落数量']],
  shops: [['entries', '商品数量'], ['sections', '分区数量']],
  items: [['useEffects', '使用效果数量'], ['pickupEffects', '拾取效果数量'], ['revealTriggers', '揭示触发器数量']],
  cultivateCurves: [['expTable', '经验表长度'], ['starCost', '突破消耗数量']],
  triggerDefs: [['effects', '效果数量']],
  funcletDefs: [['effects', '效果数量']],
  traits: [['effects', '效果数量']],
  characters: [['tags', '标签数量']],
  charaProfiles: [['names', '名称数量'], ['avatars', '头像数量']],
  affectionConfig: [['expCurve', '经验阶梯长度'], ['defaultLevelCapByStar', '星级锁数量']],
  gearConfig: [['expItems', '经验材料数量']],
  affectorPacks: [['entries', '持续效果条目数量'], ['capabilities', '服务能力数量']],
};

/** 当前 Registry getter 与 Runtime 补充源的全部 Def kind。 */
export const DEFINITION_PROFILE_KINDS: readonly string[] = Object.freeze([
  'inits', 'areas', 'spots', 'enhancements', 'stories', 'activeStories', 'passiveStories',
  'passivePools', 'storyEntries', 'items', 'dropTables', 'funcletDefs', 'characters',
  'characterVariants', 'cultivateCurves', 'favoriteItems', 'uniqueWeapons', 'traits',
  'gears', 'gearConfig', 'gachaPools', 'shops', 'colorGroups', 'colorEquipments',
  'themeDesigns', 'affectionConfig', 'resourceDisplays', 'tagDefs', 'pics', 'charaProfiles',
  'extras', 'affectorPacks', 'triggerDefs',
]);

const PROFILE_KIND_SET = new Set(DEFINITION_PROFILE_KINDS);

export function hasDefinitionProfile(kind: string): boolean {
  return PROFILE_KIND_SET.has(kind);
}

export function profileSummaryFields(detail: RuntimeContentDefinitionDetail): readonly InspectorSummaryField[] {
  const fields: InspectorSummaryField[] = [];
  for (const [key, label] of KIND_FIELDS[detail.summary.ref.definitionKind] ?? []) addIfPresent(fields, detail.raw, key, label);
  for (const [key, label] of KIND_COUNTS[detail.summary.ref.definitionKind] ?? []) addCountIfPresent(fields, detail.raw, key, label);
  return fields;
}

const RELATION_LABELS: Readonly<Record<string, string>> = {
  defaultareas: '默认 Area',
  defaultspots: '默认 Spot',
  adjacentareaids: '相邻 Area',
  areaid: '所属 Area',
  initid: '所属 Init',
  startstoryid: '起始剧情',
  storyid: '目标 Story',
  availableinits: '可用 Init',
  spotid: '目标 Spot',
  variantid: '角色差分',
  characterid: '原型角色',
  proto: '原型角色',
  curve: '培养曲线',
  favoriteitem: '爱用品',
  uniqueweapon: '专武',
  colorgroupid: '色彩组',
  poolid: '所属卡池',
  children: '闲聊成员',
  pushafterstory: '前置剧情',
  owner: '所属来源',
  gachapools: '卡池',
  members: '成员',
  featured: 'Featured 成员',
  itemid: '物品',
  resourceid: '资源',
  resource: '资源',
  currency: '抽卡资源',
  shopid: '商店',
  entryid: '商店商品',
  gear: '装备',
  gearslots: '装备槽',
  fromareaid: '连接起点 Area',
  toareaid: '连接终点 Area',
  affectorpackids: 'Affector Pack',
  defaultgear: '默认装备',
  effects: '效果目标',
  tags: '标签',
  story: '剧情',
};

function normalizedTail(path: string): string {
  const tail = path.split(/[.[\]]/).filter(Boolean).pop() ?? path;
  return tail.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

export function labelInspectorReference(reference: InspectorReference): InspectorReference {
  const relation = RELATION_LABELS[normalizedTail(reference.path ?? '')] ?? reference.relation;
  return relation ? { ...reference, relation } : reference;
}
