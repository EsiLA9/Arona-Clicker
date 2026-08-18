# ChatSystem（聊天系统）

## 概念

中间栏的聊天框是游戏的核心交互区。它包含：
1. **聊天历史** — 显示 Story Talklet 的演出内容（来自 ActiveStoryEntry/PassiveStoryEntry）
2. **点击按钮** — 核心交互入口，行为取决于当前状态：

### 点击按钮状态机

```
状态：无 ActiveStoryEntry 进行中
  → 点击 → 抽取 PassiveStoryEntry（推荐算法）
  │
  ├─ 抽中 →
  │    → 进入 PassiveStoryEntry 演出
  │    → 玩家手动点击推进 Talklet 直至故事结束
  │    → 语境结束时评估 ContextBehavior → 获得收益（→ [StoryEntry](story-entry.md)）
  │    → 回到无 ActiveStoryEntry 状态
  │
  └─ 未抽中（无可用 PassiveStoryEntry）→
       → 计算保底收益（baseReward × Effect 修正）
       → 返回收益

状态：有 ActiveStoryEntry 进行中
  → 点击 → 直接推进当前 ActiveStoryEntry 的 Talklet
  → 不抽取 PassiveStoryEntry，不计算收益

状态：PassiveStoryEntry 演出中
  → 点击 → 推进当前 PassiveStoryEntry 的 Talklet
  → 不计算收益，不抽取额外故事
  → PassiveStoryEntry 结束 → 回到无 ActiveStoryEntry 状态
```

**关键规则：**
- PassiveStoryEntry 是主要收益来源（通过 ContextBehavior 发放），非抽中时触发保底
- PassiveStoryEntry 需要玩家手动点击推进，不会自动结束
- 一次只允许一个故事演出（ActiveStoryEntry 或 PassiveStoryEntry），不叠加
- PassiveTalk 是 PassiveStoryEntry 的别名，两者为同一系统

## 数据结构

```
ChatConfig:
  - baseReward: number                     # 每次点击的基础收益
  - baseIntervalTicks: number              # 基础点击间隔限制
  - passiveStoryEntrySlots: number         # 每次点击抽取的PassiveStoryEntry数量

ChatRewardCalculation:
  - baseValue: number                      # 固有基础值
  - modifiers: ChatRewardModifier[]        # 所有生效的修正器
  - totalValue: number                     # 最终值

ChatRewardModifier:
  - source: string                         # 来源的 FullKey（Enhancement/Effect）
  - operation: "add" | "multiply" | "percent"
  - value: number

ChatAction:
  - timestamp: GameTick
  - calculatedReward: ResourceAmount[]      # → [Resource](resource.md) ResourceAmount
  - triggeredStories: StoryEntryInfo[]
  - triggeredContext?: StoryContext         # → [Story](story.md) StoryContext
  - unlockedContent: string[]

StoryEntryInfo:
  - ownerId: string                        # activeStoryEntry/passiveStoryEntry FullKey
  - storyId: string                        # Story FullKey
  - triggerType: "passive" | "active"

ChatHistoryEntry:
  - tick: GameTick
  - type: "story_talklet" | "system" | "action_result"
  - data: any
  - isNew: boolean
```

## 点击收益计算流程

```
前提：玩家当前不处于任何故事演出中（无 ActiveStoryEntry 或 PassiveStoryEntry 在运行）

1. 运行 PassiveStoryEntry 推荐算法（→ [StoryEntry](story-entry.md) PassiveStoryEntry）

2. 若有 PassiveStoryEntry 被抽中：
   → 不计算点击收益
   → 进入故事演出模式
   → 收益在故事语境结束时通过 ContextBehavior 发放
   → 数据包编辑者在 PassiveStoryEntry 的 contextBehavior 中定义奖励

3. 若无 PassiveStoryEntry 被抽中（所有候选均不满足条件/冷却中）：
   → 计算保底收益：
      a. 取基础值 (ChatConfig.baseReward)
      b. 遍历所有对 chat_reward 生效的 Effect（→ [Effect](effect.md)）
         - 按 operation 叠加计算
      c. 遍历当前 Area 的 Spot 中对此资源有加成的 Effect
      d. 遍历所有 global Enhancement 中对此有影响的 Effect
         （init Enhancement 在此场景下不影响聊天收益）
      e. 生成最终保底收益
   → 返回计算结果并显示在聊天框
## 参见

- [Story](story.md) — Talklet 在聊天框演出
- [StoryEntry](story-entry.md) — PassiveStoryEntry / ActiveStoryEntry 的触发（PassiveTalk = PassiveStoryEntry）
- [Effect](effect.md) — 聊天收益修正
- [Save Construction](../06-persistence/save-construction.md) — 存档构建时聊天配置的初始化
- [Player](player.md) — ChatHistory 存在 PlayerState 中
