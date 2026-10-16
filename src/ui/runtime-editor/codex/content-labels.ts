const OTHER_CATEGORY = '其它内容';

const CATEGORY_BY_KIND: Readonly<Record<string, string>> = {
  inits: '世界与设施',
  areas: '世界与设施',
  spots: '世界与设施',
  enhancements: '世界与设施',

  characters: '角色与培养',
  characterVariants: '角色与培养',
  charaProfiles: '角色与培养',
  cultivateCurves: '角色与培养',
  favoriteItems: '角色与培养',
  uniqueWeapons: '角色与培养',
  traits: '角色与培养',
  gears: '角色与培养',
  gearConfig: '角色与培养',
  affectionConfig: '角色与培养',

  items: '物品与经济',
  dropTables: '物品与经济',
  gachaPools: '物品与经济',
  shops: '物品与经济',
  resourceDisplays: '物品与经济',

  stories: '剧情与对话',
  storyEntries: '剧情与对话',
  activeStories: '剧情与对话',
  passiveStories: '剧情与对话',
  passivePools: '剧情与对话',

  operationEvents: '行动与场景',
  operationLocations: '行动与场景',
  operationActions: '行动与场景',
  studentOperationProfiles: '行动与场景',
  operationStrategyProfiles: '行动与场景',
  operationCardPools: '行动与场景',

  colorGroups: '外观与素材',
  colorEquipments: '外观与素材',
  themeDesigns: '外观与素材',
  pics: '外观与素材',
  tagDefs: '外观与素材',

  affectorPacks: '规则与配置',
  triggerDefs: '规则与配置',
  funcletDefs: '规则与配置',
  milestones: '规则与配置',
  milestoneListeners: '规则与配置',
  achievements: '规则与配置',
  extras: '规则与配置',
};

const LABEL_BY_KIND: Readonly<Record<string, string>> = {
  inits: '世界线',
  areas: '区域',
  spots: '设施',
  enhancements: '强化',
  characters: '角色原型',
  characterVariants: '角色差分',
  charaProfiles: '角色显示资料',
  cultivateCurves: '培养曲线',
  favoriteItems: '爱用品',
  uniqueWeapons: '专武',
  traits: '特性',
  gears: '装备类型线',
  gearConfig: '装备成长配置',
  affectionConfig: '好感配置',
  items: '物品',
  dropTables: '掉落表',
  gachaPools: '卡池',
  shops: '商店',
  resourceDisplays: '资源',
  stories: '剧情',
  storyEntries: '合并剧情入口',
  activeStories: '剧情入口',
  passiveStories: '闲聊入口',
  passivePools: '闲聊池',
  operationEvents: '行动关卡',
  operationLocations: '行动地点',
  operationActions: '行动',
  studentOperationProfiles: '学生行动档案',
  operationStrategyProfiles: '行动策略档案',
  operationCardPools: '行动卡池',
  colorGroups: '色彩组',
  colorEquipments: '色彩装备',
  themeDesigns: '主题设计',
  pics: '图片素材',
  tagDefs: '标签定义',
  affectorPacks: '产出规则',
  triggerDefs: '触发规则',
  funcletDefs: '函数片段',
  milestones: '里程碑',
  milestoneListeners: '里程碑监听器',
  achievements: '成就',
  extras: '扩展数据',
};

/** Return one stable Chinese primary category for each known runtime content kind. */
export function codexKindGroup(kind: string): string {
  return CATEGORY_BY_KIND[kind] ?? OTHER_CATEGORY;
}

/** Prefer concise Chinese labels; unknown kinds stay identifiable without affecting category routing. */
export function codexKindLabel(kind: string): string {
  return LABEL_BY_KIND[kind] ?? (kind ? `其它类型（${kind}）` : '其它类型');
}
