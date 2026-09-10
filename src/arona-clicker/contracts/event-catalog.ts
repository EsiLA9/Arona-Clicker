import type { GameEvent } from '../../engine/types/events';

export interface EventCatalogEntry {
  readonly purpose: string;
  readonly emit: readonly string[];
  readonly subscribe: readonly string[];
}

export const EVENT_CATALOG: Record<GameEvent['type'], EventCatalogEntry> = {
  resourceChanged: { purpose: '资源增减（生产失效驱动核心）', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'game-num', 'trigger-system'] },
  spotLevelChanged: { purpose: '设施等级变化', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num', 'tag-stats', 'trigger-system'] },
  managerChanged: { purpose: '设施经理变更', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'game-num'] },
  enhancementAdded: { purpose: '强化获得（Affector 挂载 + 区表失效）', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num', 'tag-stats'] },
  enhancementRemoved: { purpose: '强化移除（Affector 卸载 + 区表失效）', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num', 'tag-stats'] },
  itemCollected: { purpose: '物品收集（Affector 挂载 + Trigger）', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'trigger-system'] },
  initEntered: { purpose: '进入世界线', emit: ['init-service'], subscribe: ['condition-deps', 'tag-stats', 'trigger-system'] },
  initUnlocked: { purpose: '世界线解锁', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'tag-stats'] },
  areaEntered: { purpose: '进入区域', emit: ['init-service'], subscribe: ['condition-deps', 'tag-stats', 'trigger-system'] },
  storyAreaTraveled: { purpose: 'Story 的 travelToArea 成功（notice=true）', emit: ['story-flow'], subscribe: ['ui-controller-events'] },
  storyTriggered: { purpose: '剧情开始', emit: ['story-flow'], subscribe: ['condition-deps', 'ui-controller-events'] },
  storyCompleted: { purpose: '剧情完成', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'tag-stats', 'trigger-system', 'ui-controller-events'] },
  storyRewarded: { purpose: '完结奖励已结算', emit: ['story-jump'], subscribe: ['ui-controller-events'] },
  poolGateChanged: { purpose: '闲聊池 gate 翻转', emit: ['passive-pool-system'], subscribe: ['ui-controller-events'] },
  tick: { purpose: '每帧', emit: ['tick-system'], subscribe: ['trigger-system'] },
  flagChanged: { purpose: 'flag 写入', emit: ['state-mutation-service'], subscribe: ['color-unlock-reactor', 'condition-deps'] },
  extraChanged: { purpose: 'Extra 树写入', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'game-num'] },
  spotProduced: { purpose: 'Spot 产出结算', emit: ['tick-system'], subscribe: [] },
  spotTagChanged: { purpose: 'Spot tag 增撤', emit: ['spot-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num'] },
  tagCollectedChanged: { purpose: 'tag 收集集合变化', emit: ['tag-stats'], subscribe: ['condition-deps'] },
  affectorMounted: { purpose: 'Affector 实例挂载', emit: ['affector-engine'], subscribe: ['game-num'] },
  affectorStateChanged: { purpose: 'Affector 状态翻转', emit: ['affector-engine'], subscribe: ['game-num'] },
  affectorUnmounted: { purpose: 'Affector 实例卸载', emit: ['affector-engine'], subscribe: ['game-num'] },
  affectorEntriesChanged: { purpose: 'Affector 激活 entry 集变化', emit: ['affector-engine'], subscribe: ['game-num'] },
  affectorRuntimeChanged: { purpose: 'Affector 一次运行时变更已合并', emit: ['affector-engine'], subscribe: ['game-num'] },
  userThemeChanged: { purpose: '用户自定主题保存或启停', emit: ['state-mutation-service'], subscribe: ['color-system', 'ui-controller'] },
  characterAcquired: { purpose: '角色差分获得', emit: ['state-mutation-service'], subscribe: ['color-unlock-reactor', 'tag-stats', 'trigger-system'] },
  cultivated: { purpose: '培养变更', emit: ['state-mutation-service'], subscribe: ['trigger-system'] },
  affectionChanged: { purpose: '好感变更', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'trigger-system', 'ui-controller-events'] },
  groupUnlocked: { purpose: '色彩组解锁', emit: ['state-mutation-service'], subscribe: [] }, equipmentCollected: { purpose: '色彩装备收集', emit: ['state-mutation-service'], subscribe: [] }, equipmentEquipped: { purpose: '装备装配', emit: ['state-mutation-service'], subscribe: [] },
  themeChanged: { purpose: '系统 / 色彩组 / 用户自定义主题来源切换', emit: ['state-mutation-service'], subscribe: ['ui-controller'] }, entityThemeChanged: { purpose: '实体主题变化', emit: ['state-mutation-service'], subscribe: ['ui-controller'] }, entityDesignUnlocked: { purpose: '实体配色设计解锁', emit: ['state-mutation-service'], subscribe: [] },
  chatReadChanged: { purpose: '聊天消息已读', emit: ['state-mutation-service'], subscribe: [] }, gachaResolved: { purpose: '抽卡结算完成', emit: ['gacha-service'], subscribe: [] }, passiveCooldownsChanged: { purpose: '被动闲聊冷却更新', emit: ['state-mutation-service'], subscribe: [] }, studentBlockChanged: { purpose: '学生对话空间阻断变化', emit: ['state-mutation-service'], subscribe: [] }, charaCustomChanged: { purpose: 'Chara 覆写变化', emit: ['state-mutation-service'], subscribe: [] },
  shopPurchased: { purpose: '商店购物车 line 已完整提交', emit: ['state-mutation-service'], subscribe: ['trigger-system'] },
  themeEffectRequested: { purpose: '主题效果请求', emit: ['effect-engine'], subscribe: ['runtime-effect-reactor'] }, storyEffectRequested: { purpose: '剧情效果请求', emit: ['effect-engine'], subscribe: ['runtime-effect-reactor'] }, chatFlowEffectRequested: { purpose: '聊天流效果请求', emit: ['effect-engine'], subscribe: ['runtime-effect-reactor'] },
  chatFlowCleared: { purpose: '清理聊天流', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] }, chatTextClearedAll: { purpose: '清理演出文本', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] }, chatTextShown: { purpose: '显示演出文本', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] }, chatTextCleared: { purpose: '擦除演出文本', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] }, openingTitleShown: { purpose: '显示开幕标题', emit: ['chat-flow-service', 'story-flow'], subscribe: ['ui-controller-events'] },
};
