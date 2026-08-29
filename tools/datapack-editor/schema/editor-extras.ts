/**
 * editor-extras.ts —— Editor 本地编辑真相（运行时兜底 + 复杂结构）
 *
 * 分层（与 engine-defs.gen.json 拼合，见 merge.ts）：
 * - 结构 + 简单含义（@label / @enum 中文）由 engine 类型 TSDoc 生成；
 * - 本文件承载「复杂 / 仅编辑需要」：tagged 联动、ref 引用表、optionsFrom 动态枚举、
 *   collapsible、divider 分组、stories/extras 整表自定义构建等。
 *
 * merge 优先级：override（本文件）> 生成 defs > hand 占位（残留即同步遗漏，测试报错）。
 */
import type { FieldDef, FieldType, TableKey, TableSchema } from './types';

// ---------- 基础构造器（自旧 datapack.schema.ts 原样迁移） ----------

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
export const divider = (label: string): FieldDef => ({
  key: '__divider',
  label,
  type: { kind: 'divider' },
});

// ---------- 公共子结构（条件 / 效果 / 表达式 / 揭示 / 条目等） ----------

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
      ['visitedStoryInChain', '链内经过剧情'],
      ['extra', 'Extra'],
      ['affectionLevel', '好感等级'],
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
      { tag: 'hasReadStory', fields: [r('key', 'storyEntries', '剧情入口')] },
      { tag: 'hasReadStoryInRun', fields: [r('key', 'storyEntries', '剧情入口')] },
      { tag: 'visitedStoryInChain', fields: [r('key', 'stories', '演出本体')] },
      { tag: 'extra', fields: [s('key', 'Extra 路径', { required: true })] },
      { tag: 'affectionLevel', fields: [s('key', '差分 VariantId', { required: true })] },
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
      ['addAffectionExp', '增加好感'],
      ['setTheme', '临时主题（演出变色）'],
      ['clearAllChatFlow', '清理聊天流'],
      ['showChatText', '演出专用文本（定位显示）'],
      ['clearIdChatFlow', '擦除演出文本（按临时 id）'],
      ['clearAllChatText', '清空全部演出文本'],
    ], '操作', { required: true }),
    s('target', '目标（资源/Spot/Item/Story/ExtraPath）', { required: true }),
    { key: 'value', label: '值', type: { kind: 'flexible' } },
  ], '效果');

const effectArray = (key: string, label: string, required = false): FieldDef =>
  a(key, effectObject(), label, { required });

/** ThemeDef：{ colorGroupId?, tokens? } —— 场景/演出声明式主题（引用 ColorGroup + 局部覆盖）。 */
const themeField = (key: string, label: string): FieldDef =>
  o(key, [
    s('colorGroupId', '引用色彩组', { description: '引用某个已定义 ColorGroupDef id（如 base:group:indigo）；缺省仅用局部覆盖。' }),
    { key: 'tokens', label: '局部覆盖', type: { kind: 'flexible' }, description: '引擎 token 键（primary / bg / player-bubble 等）→ 颜色值。' },
  ], label);

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
                    ['areaSpotCount', '区域内设施数量'],
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

const tagPathField = (key = 'tags', label = '层级标签'): FieldDef =>
  a(key, {
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

/** Enhancement.attachment 挂靠元数据（判别联合） */
const enhancementAttachmentField = (): FieldDef => ({
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
});

/** TriggerDef 内联对象（InitDef.triggers，on 用引用表下拉） */
const triggerObject = (): FieldDef =>
  o('$', [
    s('id', 'ID', { description: '缺省 = 匿名 Trigger，运行时按结构派生确定性身份' }),
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
          { tag: 'story', label: '剧情', fields: [r('storyId', 'storyEntries', '剧情入口')] },
          { tag: 'init', label: '世界线', fields: [r('initId', 'inits', '世界线')] },
          { tag: 'area', label: '区域', fields: [r('areaId', 'areas', '区域')] },
          { tag: 'character', label: '获得角色', fields: [s('variantId', '差分（可选）')] },
          { tag: 'cultivated', label: '培养变更', fields: [s('variantId', '差分（可选）'), e('cultivation', [['exp', '升级'], ['star', '突破']], '方式（可选）')] },
        ],
      },
    },
    conditionExprField('condition', '条件'),
    effectArray('effects', '效果'),
    b('once', '一次性', { description: '默认 true' }),
    extraF(),
  ], '触发器');

/** triggerDefs 表的 on 字段（自由文本版本，与 inits.triggers 的引用表版本区分） */
const triggerOnFieldFree = (): FieldDef => ({
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
      { tag: 'character', label: '获得角色', fields: [s('variantId', '差分（可选）')] },
      { tag: 'cultivated', label: '培养变更', fields: [s('variantId', '差分（可选）'), e('cultivation', [['exp', '升级'], ['star', '突破']], '方式（可选）')] },
    ],
  },
});

/** DropTableDef.guaranteed：必掉条目 */
const dropGuaranteedObject = (): FieldDef =>
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
  }, '必掉');

/** DropTableDef.entries：随机条目（加权抽选） */
const dropEntryObject = (): FieldDef =>
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
  }, '随机条目', { required: true });

/** AffectorPackDef.entries：条目 */
const affectorEntryObject = (): FieldDef =>
  a('entries', {
    key: 'entry',
    label: '条目',
    type: {
      kind: 'object',
      fields: [
        s('id', 'ID', { required: true }),
        cg('condition', '条件'),
        effectArray('effects', '效果', true),
        alist('flows', o('$', [
          s('resource', '资源', { required: true }),
          { key: 'value', label: '值', type: { kind: 'flexible' } },
        ], '持续流'), '持续流'),
      ],
    },
  }, '条目', { required: true });

/** 主动故事入口（主线 / 支线）整表 */
const activeStoriesTable = (): TableSchema => ({
  key: 'activeStories',
  label: '主动故事入口',
  idField: 'id',
  worldlineSplit: true,
  fields: [
    s('id', 'ID', { required: true }),
    r('storyId', 'stories', '演出本体'),
    a('availableInits', r('$', 'inits'), '可用世界线'),
    divider('揭示与触发'),
    revealTriggersField(),
    cg('triggerCondition', '触发条件'),
    divider('跳转链与重阅读'),
    b('replayable', '允许重阅读'),
    e('completionStrategy', [['simple', '简单'], ['conditional', '条件分支']], '奖励策略'),
    alist('conditionalRewards', o('', [
      cg('condition', '条件'),
      effectArray('effects', '效果', true),
    ], '条件奖励'), '条件分支奖励'),
    alist('branchGuards', o('', [
      r('storyId', 'stories', '受保护分支'),
      alist('prerequisites', o('', [
        r('storyId', 'stories', '前置剧情'),
        i('talkletIndex', 'Talklet 索引（-1=全部）'),
      ]), '前置阅读要求'),
      s('denialMessage', '拒绝提示文本'),
    ], '分歧守卫'), '分歧点准入守卫'),
    extraF(),
  ],
});

/** 被动闲聊入口（无剧情时按权重随机抽取）整表 */
const passiveStoriesTable = (): TableSchema => ({
  key: 'passiveStories',
  label: '被动闲聊入口',
  idField: 'id',
  worldlineSplit: true,
  fields: [
    s('id', 'ID', { required: true }),
    r('storyId', 'stories', '演出本体'),
    a('availableInits', r('$', 'inits'), '可用世界线'),
    divider('揭示与触发'),
    revealTriggersField(),
    cg('triggerCondition', '触发条件'),
    b('repeatable', '可重复'),
    n('weight', '权重'),
    i('affectionRequired', '好感台阶门槛', { description: '声明后退出随机抽取：好感达标即入该角色就绪队列，按需求值升序自动推送（docs-828/06-adr/planning.md §2 轴 B）。' }),
    o('completionReward', [
      a('first', effectObject(), '首次'),
      a('repeat', effectObject(), '重复'),
    ], '完成奖励'),
    extraF(),
  ],
});

/** 虚拟合并引用表：storyEntries = activeStories ∪ passiveStories（不落盘、不编辑） */
const storyEntriesTable = (): TableSchema => ({
  key: 'storyEntries',
  label: '剧情入口（合并引用）',
  virtual: true,
  idField: 'id',
  worldlineSplit: true,
  fields: [
    s('id', 'ID'),
    r('storyId', 'stories', '演出本体'),
  ],
});

/** stories 整表（纯演出：name/talklets/extra，无触发与揭示字段） */
const storiesTable = (): TableSchema => ({
  key: 'stories',
  label: '剧情演出',
  idField: 'id',
  worldlineSplit: true,
  fields: [
    s('id', 'ID', { required: true }),
    s('name', '名称', { required: true }),
    a('talklets', {
      key: 'talklet',
      label: 'Talklet',
      type: {
        kind: 'object',
        fields: [
          s('text', '文本', { required: true }),
          s('speaker', '说话人'),
          e('kind', [['talk', '对话'], ['narration', '旁白'], ['click', '点击阻塞']], '类型'),
          e('align', [['center', '居中'], ['left', '左对齐'], ['right', '右对齐']], '对齐'),
          s('avatar', '头像'),
          s('image', '图片（pic 索引或 URL）'),
          a('choices', {
            key: 'choice',
            label: '选项',
            type: {
              kind: 'object',
              fields: [
                s('text', '文本', { required: true }),
                effectArray('effects', '效果', true),
                cg('condition', '条件'),
                r('jumpToStory', 'stories', '跳转目标'),
                e('jumpMode', [['goto', '转移（不返回）'], ['insert', '插入（返回原地）']], '跳转模式'),
              ],
            },
          }, '选项'),
          effectArray('effects', '效果'),
          s('sendText', '发送文本'),
          b('muteReply', '静默回复（不回显玩家气泡）'),
          o('clickWork', [i('base', '基础次数', { required: true }), i('rand', '随机附加')], '点击工作'),
          e('side', [['left', '靠左'], ['right', '靠右']], '气泡侧'),
          b('noAvatar', '隐藏头像'),
          divider('跳转'),
          r('jumpToStory', 'stories', '跳转目标'),
          e('jumpMode', [['goto', '转移（不返回）'], ['insert', '插入（返回原地）']], '跳转模式'),
        ],
      },
    }, 'Talklet', { required: true }),
    extraF(),
  ],
});

/** extras 整表（record 型：key → Extra 树） */
const extrasTable = (): TableSchema => ({
  key: 'extras',
  label: 'Extra 杂项',
  shape: 'record',
  recordValue: { kind: 'extra' },
  fields: [],
});

// ---------- 表元数据 + 字段覆盖（merge.ts 消费） ----------

export interface TableMeta {
  key: TableKey;
  label: string;
  /** defMap 中的实体类型名（defs 来源）；缺省 = 自定义表（custom） */
  type?: string;
  idField?: string;
  shape?: 'array' | 'record';
  idFormat?: 'tripartite' | 'free';
  worldlineSplit?: boolean;
  /** 在这些生成字段之后插入 divider（UI 分组） */
  dividerAfter?: Record<string, string>;
  /** 字段级覆盖：key → FieldDef 或工厂（复杂 / hand / UI 精修） */
  overrides?: Record<string, FieldDef | (() => FieldDef)>;
  /** 整表自定义构建（stories / extras） */
  custom?: () => TableSchema;
}

/** 13 张表：结构来自 engine defs，编辑语义/复杂结构在此兜底。 */
export const TABLE_META: TableMeta[] = [
  {
    key: 'inits',
    label: '世界线',
    type: 'InitDef',
    idField: 'id',
    worldlineSplit: true,
    dividerAfter: { description: '揭示' },
    overrides: {
      enterEffects: () => entryEffectsArray('enterEffects', '进入条目'),
      revealTriggers: () => revealTriggersField(),
      triggers: () => a('triggers', triggerObject(), '专属触发器'),
      purchaseCost: () => a('purchaseCost', resourceAmountObject(), '解锁费用'),
    },
  },
  {
    key: 'areas',
    label: '区域',
    type: 'AreaDef',
    idField: 'id',
    worldlineSplit: true,
    dividerAfter: { description: '揭示' },
    overrides: {
      enterEffects: () => entryEffectsArray('enterEffects', '进入条目'),
      revealTriggers: () => revealTriggersField(),
      theme: () => themeField('theme', '场景主题'),
    },
  },
  {
    key: 'spots',
    label: '设施',
    type: 'SpotDef',
    idField: 'id',
    worldlineSplit: true,
    dividerAfter: { conditionText: '揭示' },
    overrides: {
      baseCost: () => valueExpressionField('baseCost', '基础造价', true),
      baseCostResource: () => r('baseCostResource', 'resourceDisplays', '造价资源', { required: true }),
      baseYield: () => valueExpressionField('baseYield', '基础产出', true),
      baseYieldResource: () => r('baseYieldResource', 'resourceDisplays', '产出资源', { required: true }),
      managerBonusYield: () => valueExpressionField('managerBonusYield', '经理加成产出'),
      levelUpgrades: () => levelUpgradeField(),
      maxLevel: () => i('maxLevel', '等级上限'),
      tags: () => tagPathField('tags'),
      revealTriggers: () => revealTriggersField(),
      functionalities: () => a('functionalities', functionalityObject(), '功能'),
      theme: () => themeField('theme', '设施主题'),
      colorGroupId: () => s('colorGroupId', '默认色组', { description: 'ColorGroupDef id（如 base:color-group:xxx）；声明后设施卡片以该色组主色构建自身 ThemeTree。' }),
    },
  },
  {
    key: 'enhancements',
    label: '强化',
    type: 'EnhancementDef',
    idField: 'id',
    worldlineSplit: true,
    dividerAfter: { description: '揭示' },
    overrides: {
      effects: () => effectArray('effects', '效果', true),
      maxStacks: () => i('maxStacks', '最大层数'),
      price: () => a('price', resourceAmountObject(), '购买价格'),
      attachment: () => enhancementAttachmentField(),
      addsFunctionalities: () => a('addsFunctionalities', functionalityObject(), '注入功能'),
      affectorPackIds: () => a('affectorPackIds', r('$', 'affectorPacks'), 'Affector 包'),
      revealTriggers: () => revealTriggersField(),
    },
  },
  { key: 'activeStories', label: '主动故事入口', custom: activeStoriesTable },
  { key: 'passiveStories', label: '被动闲聊入口', custom: passiveStoriesTable },
  // 虚拟合并引用表：仅用于跨表引用（active ∪ passive），不落盘、不进 UI 导航
  { key: 'storyEntries', label: '剧情入口（合并引用）', custom: storyEntriesTable },
  { key: 'stories', label: '剧情演出', custom: storiesTable },
  {
    key: 'items',
    label: '物品',
    type: 'ItemDef',
    idField: 'id',
    worldlineSplit: true,
    dividerAfter: { type: '条件与效果' },
    overrides: {
      maxStack: () => i('maxStack', '堆叠上限', { required: true }),
      revealTriggers: () => revealTriggersField(),
      useCondition: () => cg('useCondition', '使用条件'),
      useEffects: () => effectArray('useEffects', '使用效果'),
      pickupEffects: () => effectArray('pickupEffects', '拾取效果'),
      sellPrice: () => o('sellPrice', [r('resourceId', 'resourceDisplays', '资源'), n('amount', '数量')], '出售价格'),
      affectorPackIds: () => a('affectorPackIds', r('$', 'affectorPacks'), 'Affector 包'),
    },
  },
  {
    key: 'dropTables',
    label: '掉落表',
    type: 'DropTableDef',
    idField: 'id',
    worldlineSplit: true,
    overrides: {
      maxRolls: () => i('maxRolls', '最大掷数', { required: true }),
      guaranteed: () => dropGuaranteedObject(),
      entries: () => dropEntryObject(),
      condition: () => cg('condition', '条件'),
    },
  },
  {
    key: 'affectorPacks',
    label: '效果包',
    type: 'AffectorPackDef',
    idField: 'id',
    worldlineSplit: true,
    overrides: {
      entries: () => affectorEntryObject(),
    },
  },
  {
    key: 'gachaPools',
    label: '卡池',
    type: 'GachaPoolDef',
    idField: 'id',
    worldlineSplit: true,
    overrides: {
      closeWhen: () => cg('closeWhen', '关闭条件'),
      featured: () => a('featured', s('$', '差分 ID'), 'UP 差分'),
      members: () => a('members', s('$', '差分 ID'), '成员'),
    },
  },
  {
    key: 'triggerDefs',
    label: '触发器',
    type: 'TriggerDef',
    idField: 'id',
    worldlineSplit: true,
    overrides: {
      on: () => triggerOnFieldFree(),
      condition: () => conditionExprField('condition', '条件'),
      effects: () => effectArray('effects', '效果'),
      once: () => b('once', '一次性', { description: '默认 true' }),
    },
  },
  {
    key: 'characters',
    label: '角色',
    type: 'CharacterData',
    idField: 'id',
    idFormat: 'free',
    worldlineSplit: true,
    overrides: {
      id: () => s('id', 'ID', { required: true }),
      school: () => ({ key: 'school', label: '学校', required: true, type: { kind: 'enum', optionsFrom: { table: 'characters' as TableKey, field: 'school' } } }),
      rarity: () => ({ key: 'rarity', label: '稀有度', required: true, type: { kind: 'enum', optionsFrom: { table: 'characters' as TableKey, field: 'rarity' } } }),
    },
  },
  {
    key: 'characterBonuses',
    label: '角色加成表',
    type: 'CharacterBonusTable',
    idField: 'characterId',
    idFormat: 'free',
    worldlineSplit: true,
    overrides: {
      characterId: () => r('characterId', 'characters', '角色', { required: true }),
      spotId: () => r('spotId', 'spots', '设施', { required: true }),
      multiplier: () => n('multiplier', '倍率', { required: true }),
    },
  },
  {
    key: 'resourceDisplays',
    label: '资源展示',
    type: 'ResourceDisplayDef',
    idField: 'resourceId',
    overrides: {
      order: () => i('order', '排序'),
    },
  },
  {
    key: 'tags',
    label: '标签表现',
    type: 'TagDef',
    idField: 'id',
    overrides: {
      id: () => s('id', '层级路径（如 office 或 office/defense）', { required: true }),
    },
  },
  {
    key: 'pics',
    label: '图片',
    type: 'PicDef',
    idField: 'id',
    idFormat: 'free',
    overrides: {
      id: () => s('id', '三段式索引（modName:typeName(pic):idName，如 base:avatar(pic):hoshino）', { required: true }),
      src: () => s('src', '来源（直连 URL 或 zip:包内路径）', { required: true }),
    },
  },
  {
    key: 'charaProfiles',
    label: '角色资料（头像-人名对）',
    type: 'CharaProfileDef',
    idField: 'id',
    idFormat: 'free',
    overrides: {
      id: () => s('id', '原型 id（如 Hoshino）', { required: true }),
    },
  },
  { key: 'extras', label: 'Extra 杂项', custom: extrasTable },
];
