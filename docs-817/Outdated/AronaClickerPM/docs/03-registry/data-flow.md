# 数据流全景

## 玩家点击聊天按钮

```
→ ChatSystem.calculateReward()
    → 读取 ChatConfig.baseReward
    → 查询所有生效的 chat_reward 类型 Effect
    → 查询当前 Area/Spot 的相关 Effect
    → 计算出最终资源收益
→ 推荐算法筛选 PassiveStoryEntry
    → 输入当前 Area, PlayerState, StoryInstances
    → 检查各 PassiveStoryEntry 的 conditions/weight/cooldown
    → 选出可触发的 PassiveStoryEntry
→ StoryEngine.execute(storyId, storyInstance)
    → 创建 StoryContext (accumulatedLabels = {})
    → 遍历 Talklet:
       - label 检查：非0且不在 accumulatedLabels → 跳过
       - 执行 onPlay（若有）→ 可能 modify 游戏状态
       - 演出 Talklet（渲染对应UI到聊天框）
       - logic_judgment/choice → 执行 StoryAction
    → Story 结束 → accumulatedLabels 合并到 StoryInstance
→ 更新 EventBus 发布事件
    → resource/added, story/started, story/ended 等
→ 汇总结果写入 ChatHistory
→ 更新 PlayerState.resources + storyInstances
→ 检查是否有新内容解锁
→ UI 更新
```

## 自动产出（每tick）

```
→ AutoProductionCalculator.calculate()
    → 遍历当前 Init 所有拥有的 Spot
    → 计算每个 Spot 是否到产出间隔
    → 应用所有 Effect 修正
    → 汇总产出资源
→ PlayerState.resources += production
→ PlayerState.resourceLog 更新（totalGained + perInit）
→ EventBus.publish("resource/added", ...)
→ EventBus.publish("resource/total_changed", ...)
→ EventBus.publish("spot/produced", ...)
→ UnlockChecker 检查解锁
→ 推荐算法按需重算
```

## 玩家手动进入 ActiveStoryEntry

```
→ ActiveStoryEntryManager.enter(activeStoryEntryKey)
    → 检查 prerequisites
    → 获取或创建 StoryInstance
    → 加载重要分岔历史（若有）
    → StoryEngine.execute(storyId, storyInstance)
    → 执行过程同上
    → 重要分岔自动锁定历史选择
    → EventBus.publish("story/started", ...)
    → EventBus.publish("story/ended", ...)
```

## Tag 统计更新流程

```
元素购买/获得时（如 Spot）：
→ 遍历该定义的 tags[]
→ 对每个 tag，更新 tagStats 中的 TagStat
→ EventBus.publish("tag/collected", ...)

元素触发/演出时（如 Story Talklet）：
→ 遍历该定义的 tags[]
→ 对每个 tag，更新 TagStat
→ EventBus.publish("tag/triggered", ...)
```

## 参见

- 各核心模块文档（Init / Area / Spot / Story / Chat 等）
- [EventBus](event-bus.md)
- [三层架构](three-layer.md)
