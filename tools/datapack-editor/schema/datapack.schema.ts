/**
 * datapack.schema.ts —— 13 张表的手工 Schema 定义
 *
 * 初稿由 scripts/gen-datapack-schema.mjs 从 src/engine/types.ts 生成，
 * 本文件在此基础上人工映射为 schema DSL（union/object/ref/extra/flexible 等）。
 *
 * 规则：不与 src/** 有任何 import；以 datapack 实际 JSON 形状 + engine types 为唯一依据。
 */
import type { FieldDef, FieldType, TableSchema } from './types';

// ---------- 基础构造器 ----------

const s = (key: string, label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'string' },
  ...extra,
});
const n = (key: string, label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'float' },
  ...extra,
});
const i = (key: string, label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'int' },
  ...extra,
});
const b = (key: string, label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'bool' },
  ...extra,
});
/** 枚举选项：string 为纯英文值；[值, 中文含义] 二元组在前端显示为"英文（中文）" */
type EnumOption = string | [value: string, meaning: string];
const e = (key: string, options: EnumOption[], label?: string, extra: Partial<FieldDef> = {}): FieldDef => {
  const meaning: Record<string, string> = {};
  for (const o of options) {
    if (Array.isArray(o)) meaning[o[0]] = o[1];
  }
  return {
    key,
    label: label ?? key,
    type: {
      kind: 'enum',
      options: options.map((o) => (Array.isArray(o) ? o[0] : o)),
      ...(Object.keys(meaning).length > 0 ? { meaning } : {}),
    },
    ...extra,
  };
};
const o = (key: string, fields: FieldDef[], label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'object', fields },
  ...extra,
});
const a = (key: string, item: FieldDef, label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'array', item },
  ...extra,
});
/** 可变列表（折叠式）：可增删，每项默认折叠为摘要，点击展开编辑 */
const alist = (key: string, item: FieldDef, label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'array', item, collapsible: true },
  ...extra,
});
const r = (key: string, table: TableSchema['key'], label?: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: { kind: 'ref', table },
  ...extra,
});
const extraF = (key = 'extra'): FieldDef => ({
  key,
  label: 'Extra',
  type: { kind: 'extra' },
  group: 'Extra',
});
/** 分隔横条：仅用于 UI 语义分组，不参与 JSON 合并/校验（数据行中不存在该字段） */
const divider = (label: string): FieldDef => ({
  key: '__divider',
  label,
  type: { kind: 'divider' },
});

// ---------- 公共子结构 ----------

/**
 * 叶子条件 tagged 联动：第一个枚举字段 target 决定后续 key 的类型/引用表，
 * 切换 target 时 key 控件随之重建（如 resource → 资源下拉，hasTag → 自由文本）；
 * comparator/value 作为公共尾部字段（after）在所有 target 下渲染。
 */
function conditionTagged(): FieldType & { kind: 'tagged' } {
  return {
    kind: 'tagged',
    tagField: e('target', [
      ['resource', '资源'],
      ['spotLevel', '设施等级'],
      ['manager', '经理'],
      ['flag', '标记'],
      ['hasEnh', '持有强化'],
      ['hasTag', '持有标签'],
      ['countTags', '标签数量'],
      ['stat', '统计'],
      ['hasReadStory', '已读剧情'],
      ['hasReadStoryInRun', '本世界线已读剧情'],
      ['extra', 'Extra'],
    ], '目标', { required: true }),
    combos: [
      { tag: 'resource', fields: [r('key', 'resourceDisplays', '资源')] },
      { tag: 'spotLevel', fields: [r('key', 'spots', '设施')] },
      { tag: 'manager', fields: [r('key', 'spots', '设施')] },
      { tag: 'flag', fields: [s('key', '标记名', { required: true })] },
      { tag: 'hasEnh', fields: [r('key', 'enhancements', '强化')] },
      { tag: 'hasTag', fields: [s('key', '标签', { required: true })] },
      { tag: 'countTags', fields: [s('key', '标签', { required: true })] },
      { tag: 'stat', fields: [s('key', '统计键', { required: true })] },
      { tag: 'hasReadStory', fields: [r('key', 'stories', '剧情')] },
      { tag: 'hasReadStoryInRun', fields: [r('key', 'stories', '剧情')] },
      { tag: 'extra', fields: [s('key', 'Extra 路径', { required: true })] },
    ],
    after: [
      e('comparator', [
        ['==', '等于'],
        ['!=', '不等于'],
        ['>=', '大于等于'],
        ['<=', '小于等于'],
        ['>', '大于'],
        ['<', '小于'],
      ], '比较符', { required: true }),
      { key: 'value', label: '值', required: true, type: { kind: 'flexible' } },
    ],
  };
}

/** 叶子条件字段：root 字段——tagged 联动直接作用于条件对象整体（{target,key,comparator,value}） */
function leafConditionFields(): FieldDef[] {
  return [{ key: '', label: '条件', type: conditionTagged(), root: true }];
}

/**
 * 条件列表数组字段。元素为判别联合：AND 组 / OR 组 / 叶子条件。
 * 组的 type 判别字段由 union 下拉占用（不再重复渲染"组合"枚举），嵌套组递归渲染。
 */
function conditionsField(label: string): FieldDef {
  return {
    key: 'conditions',
    label,
    required: true,
    type: {
      kind: 'array',
      item: {
        key: 'cond',
        label: '条件',
        type: {
          kind: 'union',
          tagField: 'type',
          variants: [
            { tag: 'AND', label: 'AND 组', fields: () => [conditionsField('全部满足条件列表')] },
            { tag: 'OR', label: 'OR 组', fields: () => [conditionsField('任一满足条件列表')] },
            { tag: '__leaf', label: '叶子条件', fields: leafConditionFields, noTag: true },
          ],
        },
      },
    },
  };
}

/** ConditionGroup 判别对象联合：第一个枚举字段 type(AND/OR) 决定后续 conditions 组合 */
function conditionGroupTagged(): FieldType & { kind: 'tagged' } {
  return {
    kind: 'tagged',
    tagField: e('type', [['AND', '全部满足'], ['OR', '任一满足']], '组合', { required: true }),
    combos: [
      { tag: 'AND', fields: [conditionsField('全部满足条件列表')] },
      { tag: 'OR', fields: [conditionsField('任一满足条件列表')] },
    ],
  };
}

/** 条件组对象字段：key 由调用方指定（如 visibilityCondition / triggerCondition） */
const cg = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: label ?? key,
  type: conditionGroupTagged(),
  ...extra,
});

/**
 * 条件表达式字段：单条原子条件（Condition）或 AND/OR 条件组（ConditionGroup）。
 * 用于 Trigger 的 condition —— 可直接监听一条原子条件，不必强制套组。
 * 叶子变体 noTag：数据里不写 type 判别键（{target,key,comparator,value}）。
 */
const conditionExprField = (key: string, label: string): FieldDef => ({
  key,
  label: label ?? key,
  type: {
    kind: 'union',
    tagField: 'type',
    variants: [
      { tag: 'AND', label: 'AND 组', fields: () => [conditionsField('全部满足条件列表')] },
      { tag: 'OR', label: 'OR 组', fields: () => [conditionsField('任一满足条件列表')] },
      { tag: '__leaf', label: '单条条件', fields: leafConditionFields, noTag: true },
    ],
  },
});

/** Effect：{ op, target, value } */
const effectObject = (): FieldDef =>
  o('$', [
    e('op', [
      ['setResource', '设置资源'],
      ['addResource', '增加资源'],
      ['setSpotLevel', '设置设施等级'],
      ['addSpotLevel', '增加设施等级'],
      ['setManager', '设置经理'],
      ['addEnhancement', '添加强化'],
      ['addItem', '添加物品'],
      ['loot', '掉落'],
      ['unlockInit', '解锁世界线'],
      ['setFlag', '设置标记'],
      ['triggerStory', '触发剧情'],
      ['travelToArea', '前往区域'],
      ['setSpotMaxLevel', '设置设施等级上限'],
      ['removeSpotMaxLevel', '移除设施等级上限'],
      ['setExtra', '设置 Extra'],
      ['addExtra', '增加 Extra'],
      ['removeExtra', '移除 Extra'],
    ], '操作', { required: true }),
    s('target', '目标（资源/Spot/Item/Story/ExtraPath）', { required: true }),
    { key: 'value', label: '值', type: { kind: 'flexible' } },
  ], '效果');

const effectArray = (key: string, label: string, required = false): FieldDef =>
  a(key, effectObject(), label, { required });

/** EntryEffectDef：进入条目（first / condition / effects）。 */
const entryObject = (): FieldDef =>
  o('$', [
    b('first', '仅首次进入', { description: '仅该实体首次被进入时执行' }),
    cg('condition', '进入条件'),
    effectArray('effects', '效果', true),
  ], '条目');

/** 进入条目列表：折叠式，每条目摘要显示 first/condition/effects 概要。 */
const entryEffectsArray = (key: string, label: string): FieldDef =>
  alist(key, entryObject(), label);

/** SpotFunctionalityDef */
const functionalityObject = (): FieldDef =>
  o('$', [
    s('id', '功能 ID', { required: true }),
    cg('condition', '生效条件'),
    e('kind', [
      ['linearYield', '线性产出'],
      ['restartInit', '重启世界线'],
      ['hardResetInit', '硬重置世界线'],
    ], '类型', { required: true }),
    r('resource', 'resourceDisplays', '资源'),
    n('amountPerLevel', '每级量'),
    extraF(),
  ], '功能');

/** ResourceAmount：{ resourceId, amount } */
const resourceAmountObject = (): FieldDef =>
  o('$', [
    r('resourceId', 'resourceDisplays', '资源', { required: true }),
    n('amount', '数量', { required: true }),
  ], '资源量');

/** ValueExpression：const / value / mul 三变体 */
function valueExpressionField(key: string, label: string, required = false): FieldDef {
  return {
    key,
    label,
    required,
    type: {
      kind: 'union',
      tagField: 'type',
      variants: [
        { tag: 'const', label: '常量', fields: [n('value', '数值', { required: true })] },
        {
          tag: 'value',
          label: '引用值',
          fields: [
            {
              key: 'value',
              label: '值',
              required: true,
              type: {
                kind: 'object',
                fields: [
                  e('type', [
                    ['res', '资源'],
                    ['spotLevel', '设施等级'],
                    ['spotCount', '设施数量'],
                    ['managerCount', '经理数量'],
                    ['funclet', '功能'],
                    ['data', '数据'],
                  ], '来源', { required: true }),
                  s('source', '来源 ID/路径'),
                  { key: 'params', label: '参数', type: { kind: 'flexible' } },
                ],
              },
            },
          ],
        },
        {
          tag: 'mul',
          label: '相乘',
          fields: () => [
            valueExpressionField('left', '左项', true),
            valueExpressionField('right', '右项', true),
          ],
        },
      ],
    },
  };
}

/** 揭示 Trigger：单条揭示任务（负责单纯揭示一个信息块） */
const revealTriggerObject = (): FieldDef =>
  o('$', [
    e('reveal', [
      ['existence', '实体出现'],
      ['name', '名称'],
      ['condition', '条件'],
      ['utility', '工具'],
      ['unlock', '解锁'],
    ], '揭示', {
      required: true,
      description: 'existence = 实体是否出现（原可见条件）；name/condition/utility = 信息块揭示；unlock = 实际解锁 / 自动解锁条件（engine 消费）',
    }),
    conditionExprField('condition', '条件'),
  ], '揭示 Trigger');

/** 揭示 Trigger 列表：可变列表，每个 Trigger 负责单纯揭示一个信息块，条件满足即揭示 */
const revealTriggersField = (): FieldDef =>
  alist('revealTriggers', revealTriggerObject(), '揭示 Trigger 列表', {
    description: '每个 Trigger 负责揭示一个信息块（条件满足即揭示）。可增删多条。existence 目标即「可见条件」；unlock 目标即「解锁 / 自动解锁条件」。',
  });

/** LevelUpgradeDef */
const levelUpgradeField = (): FieldDef =>
  a('levelUpgrades', {
    key: 'upgrade',
    label: '等级升级',
    type: {
      kind: 'object',
      fields: [
        i('level', '等级', { required: true }),
        o('cost', [r('resourceId', 'resourceDisplays', '资源'), n('amount', '数量')], '费用'),
        cg('condition', '条件'),
        effectArray('effects', '效果'),
      ],
    },
  }, '等级升级');

const tagPathField = (label = '层级标签'): FieldDef =>
  a('tags', {
    key: 'path',
    label: '路径',
    type: {
      kind: 'array',
      item: { key: 'seg', label: '段', type: { kind: 'string' } },
    },
  }, label, {
    required: false,
    description: '路径数组，如 [["office"],["production"]]',
  });

/** TriggerDef 内联对象（InitDef.triggers） */
const triggerObject = (): FieldDef =>
  o('$', [
    s('id', 'ID', { required: true }),
    {
      key: 'on',
      label: '侦测事件',
      required: true,
      type: {
        kind: 'union',
        tagField: 'kind',
        variants: [
          { tag: 'tick', label: 'Tick', fields: [i('every', '每 N 帧')] },
          { tag: 'resource', label: '资源变化', fields: [r('resource', 'resourceDisplays', '资源')] },
          { tag: 'spotLevel', label: '设施等级', fields: [r('spotId', 'spots', '设施')] },
          { tag: 'item', label: '物品', fields: [r('itemId', 'items', '物品')] },
          { tag: 'story', label: '剧情', fields: [r('storyId', 'stories', '剧情')] },
          { tag: 'init', label: '世界线', fields: [r('initId', 'inits', '世界线')] },
          { tag: 'area', label: '区域', fields: [r('areaId', 'areas', '区域')] },
        ],
      },
    },
    conditionExprField('condition', '条件'),
    effectArray('effects', '效果'),
    b('once', '一次性', { description: '默认 true' }),
    extraF(),
  ], '触发器');

// ---------- 13 张表 ----------

export const TABLES: TableSchema[] = [
  {
    key: 'inits',
    label: '世界线',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      s('name', '名称', { required: true }),
      s('description', '描述', { required: true }),
      divider('揭示'),
      revealTriggersField(),
      entryEffectsArray('enterEffects', '进入条目'),
      a('defaultAreas', r('$', 'areas'), '默认区域', { required: true }),
      r('startStoryId', 'stories', '起始剧情'),
      a('triggers', triggerObject(), '专属触发器'),
      a('purchaseCost', resourceAmountObject(), '解锁费用'),
      extraF(),
    ],
  },
  {
    key: 'areas',
    label: '区域',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      r('initId', 'inits', '所属世界线', { required: true }),
      s('name', '名称', { required: true }),
      s('description', '描述', { required: true }),
      divider('揭示'),
      revealTriggersField(),
      entryEffectsArray('enterEffects', '进入条目'),
      a('defaultSpots', r('$', 'spots'), '默认设施', { required: true }),
      a('adjacentAreaIds', r('$', 'areas'), '相邻区域'),
      extraF(),
    ],
  },
  {
    key: 'spots',
    label: '设施',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      r('areaId', 'areas', '所属区域', { required: true }),
      s('name', '名称', { required: true }),
      s('description', '描述', { required: true }),
      valueExpressionField('baseCost', '基础造价', true),
      r('baseCostResource', 'resourceDisplays', '造价资源', { required: true }),
      valueExpressionField('baseYield', '基础产出', true),
      r('baseYieldResource', 'resourceDisplays', '产出资源', { required: true }),
      n('baseCapacity', '基础容量', { required: true }),
      valueExpressionField('managerBonusYield', '经理加成产出'),
      s('conditionText', '条件文本'),
      divider('揭示'),
      revealTriggersField(),
      levelUpgradeField(),
      n('yieldPerLevel', '每级产出'),
      n('upgradeCostBase', '升级基价'),
      n('upgradeCostGrowth', '升级增长'),
      i('maxLevel', '等级上限'),
      tagPathField(),
      b('global', '跨世界线共享', { description: '脱离 Init 的共享设施' }),
      a('functionalities', functionalityObject(), '功能'),
      extraF(),
    ],
  },
  {
    key: 'enhancements',
    label: '强化',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      s('name', '名称', { required: true }),
      s('description', '描述', { required: true }),
      divider('揭示'),
      revealTriggersField(),
      effectArray('effects', '效果', true),
      b('autoApply', '自动应用', { required: true }),
      i('maxStacks', '最大层数'),
      a('price', resourceAmountObject(), '购买价格'),
      n('productionMultiplier', '产出倍率', { description: '1.5 = +50%' }),
      tagPathField('作用标签'),
      {
        key: 'attachment',
        label: '挂靠元数据',
        type: {
          kind: 'union',
          tagField: 'kind',
          variants: [
            { tag: 'area', label: '区域', fields: [r('areaId', 'areas', '区域')] },
            { tag: 'init', label: '世界线', fields: [r('initId', 'inits', '世界线')] },
            { tag: 'global', label: '全局', fields: [] },
          ],
        },
      },
      a('addsFunctionalities', functionalityObject(), '注入功能'),
      a('affectorPackIds', r('$', 'affectorPacks'), 'Affector 包'),
      extraF(),
    ],
  },
  {
    key: 'stories',
    label: '剧情',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      s('name', '名称', { required: true }),
      e('type', [
        ['active', '主动'],
        ['passive', '被动'],
      ], '类型', { required: true }),
      a('availableInits', r('$', 'inits'), '可用世界线'),
      a('pages', {
        key: 'page',
        label: '页面',
        type: {
          kind: 'object',
          fields: [
            s('text', '文本', { required: true }),
            s('speaker', '说话人'),
            a('choices', {
              key: 'choice',
              label: '选项',
              type: {
                kind: 'object',
                fields: [
                  s('text', '文本', { required: true }),
                  effectArray('effects', '效果', true),
                  cg('condition', '条件'),
                ],
              },
            }, '选项'),
            effectArray('effects', '效果'),
            s('sendText', '发送文本'),
            o('clickWork', [i('base', '基础次数', { required: true }), i('rand', '随机附加')], '点击工作'),
          ],
        },
      }, '页面', { required: true }),
      divider('揭示与触发'),
      revealTriggersField(),
      cg('triggerCondition', '触发条件'),
      b('repeatable', '可重复'),
      i('cooldownFrames', '冷却帧'),
      n('weight', '权重'),
      o('completionReward', [
        a('first', effectObject(), '首次'),
        a('repeat', effectObject(), '重复'),
      ], '完成奖励'),
      extraF(),
    ],
  },
  {
    key: 'items',
    label: '物品',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      s('name', '名称', { required: true }),
      s('description', '描述', { required: true }),
      s('icon', '图标'),
      i('maxStack', '堆叠上限', { required: true }),
      e('rarity', [
        ['common', '普通'],
        ['rare', '稀有'],
        ['epic', '史诗'],
        ['legendary', '传说'],
      ], '稀有度', { required: true }),
      e('type', [
        ['consumable', '消耗品'],
        ['material', '材料'],
        ['key', '钥匙'],
      ], '类型', { required: true }),
      divider('条件与效果'),
      revealTriggersField(),
      cg('useCondition', '使用条件'),
      effectArray('useEffects', '使用效果'),
      effectArray('pickupEffects', '拾取效果'),
      o('sellPrice', [r('resourceId', 'resourceDisplays', '资源'), n('amount', '数量')], '出售价格'),
      a('affectorPackIds', r('$', 'affectorPacks'), 'Affector 包'),
      extraF(),
    ],
  },
  {
    key: 'dropTables',
    label: '掉落表',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      i('maxRolls', '最大掷数', { required: true }),
      a('guaranteed', {
        key: 'entry',
        label: '条目',
        type: {
          kind: 'object',
          fields: [
            r('itemId', 'items', '物品', { required: true }),
            i('count', '数量', { required: true }),
          ],
        },
      }, '必掉'),
      a('entries', {
        key: 'entry',
        label: '条目',
        type: {
          kind: 'object',
          fields: [
            r('itemId', 'items', '物品', { required: true }),
            i('min', '最小', { required: true }),
            i('max', '最大', { required: true }),
            n('weight', '权重'),
            cg('condition', '条件'),
          ],
        },
      }, '随机条目', { required: true }),
      cg('condition', '条件'),
      extraF(),
    ],
  },
  {
    key: 'affectorPacks',
    label: '效果包',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      b('persistent', '持久'),
      a('entries', {
        key: 'entry',
        label: '条目',
        type: {
          kind: 'object',
          fields: [
            s('id', 'ID', { required: true }),
            cg('condition', '条件'),
            effectArray('effects', '效果', true),
          ],
        },
      }, '条目', { required: true }),
      extraF(),
    ],
  },
  {
    key: 'triggerDefs',
    label: '触发器',
    idField: 'id',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      {
        key: 'on',
        label: '侦测事件',
        required: true,
        type: {
          kind: 'union',
          tagField: 'kind',
          variants: [
            { tag: 'tick', label: 'Tick', fields: [i('every', '每 N 帧')] },
            { tag: 'resource', label: '资源变化', fields: [s('resource', '资源')] },
            { tag: 'spotLevel', label: '设施等级', fields: [s('spotId', '设施')] },
            { tag: 'item', label: '物品', fields: [s('itemId', '物品')] },
            { tag: 'story', label: '剧情', fields: [s('storyId', '剧情')] },
            { tag: 'init', label: '世界线', fields: [s('initId', '世界线')] },
            { tag: 'area', label: '区域', fields: [s('areaId', '区域')] },
          ],
        },
      },
      conditionExprField('condition', '条件'),
      effectArray('effects', '效果'),
      b('once', '一次性', { description: '默认 true' }),
      extraF(),
    ],
  },
  {
    key: 'characters',
    label: '角色',
    idField: 'id',
    idFormat: 'free',
    worldlineSplit: true,
    fields: [
      s('id', 'ID', { required: true }),
      s('name', '名称', { required: true }),
      s('displayName', '显示名', { required: true }),
      { key: 'school', label: '学校', required: true, type: { kind: 'enum', optionsFrom: { table: 'characters', field: 'school' } } },
      { key: 'rarity', label: '稀有度', required: true, type: { kind: 'enum', optionsFrom: { table: 'characters', field: 'rarity' } } },
      s('description', '描述', { required: true }),
      {
        key: 'spotTagBonus',
        label: '标签产出加成',
        required: true,
        type: { kind: 'record', value: { key: 'bonus', label: '加成', type: { kind: 'float' } } },
      },
      s('passiveDescription', '被动描述'),
      a('affectorPackIds', r('$', 'affectorPacks'), 'Affector 包'),
      extraF(),
    ],
  },
  {
    key: 'characterBonuses',
    label: '角色加成表',
    idField: 'characterId',
    idFormat: 'free',
    worldlineSplit: true,
    fields: [
      r('characterId', 'characters', '角色', { required: true }),
      r('spotId', 'spots', '设施', { required: true }),
      n('multiplier', '倍率', { required: true }),
      cg('condition', '条件'),
      extraF(),
    ],
  },
  {
    key: 'resourceDisplays',
    label: '资源展示',
    idField: 'resourceId',
    fields: [
      s('resourceId', '资源 ID', { required: true }),
      s('label', '标签', { required: true }),
      s('detailLabel', '详情标签'),
      s('showWhen', '显示条件'),
      i('order', '排序'),
      extraF(),
    ],
  },
  {
    key: 'extras',
    label: 'Extra 杂项',
    shape: 'record',
    recordValue: { kind: 'extra' },
    fields: [],
  },
];

const BY_KEY = new Map<TableSchema['key'], TableSchema>(TABLES.map((t) => [t.key, t]));
export const getTable = (key: TableSchema['key']): TableSchema => {
  const t = BY_KEY.get(key);
  if (!t) throw new Error(`Unknown table: ${key}`);
  return t;
};
