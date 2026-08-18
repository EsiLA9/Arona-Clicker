# ActiveStoryEntry & PassiveStoryEntry（故事入口 / 语境提供者）

## 概念

ActiveStoryEntry 和 PassiveStoryEntry 是包裹 [Story](story.md) 的包装层，同时是**语境（Context）的提供者**。它们负责：
1. 定义 Story 什么时候可以被触发（prerequisites / conditions）
2. 持有 Story 的引用（storyId）
3. 定义**语境行为集（ContextBehavior）**：语境结束时，根据累积的标号和 ContextFlag 统一执行行为
4. 管理重要分岔的历史记录

引擎内部的事件监听系统负责在适当时机触发它们，这部分不向数据包编辑者暴露。

## ActiveStoryEntry

玩家在聊天框或菜单中**手动选择进入**的主线/支线剧情。

```
ActiveStoryEntryDefinition:
  - id: string                         # FullKey: ModName/activeStoryEntry/idName
  - storyId: string                    # 引用的 Story FullKey（一对一固定）
  - title: string
  - description: string
  - area: string                       # 所属 Area 的 FullKey
  - visibility?: Record<1|2|3|4, Condition>  # → [Visibility](visibility.md) 5级可见性
  - prerequisites: Condition[]               # → 保留（购买时二次校验）
  - mutuallyExclusiveWith?: string[]         # 此故事完成后，禁止其他 ActiveStoryEntry 在当前 Init 中访问
  - icon?: string
  - sortOrder: number
  - repeatable: boolean                # 完成后是否可以重玩（默认true）
  - tags: string[]
  - contextBehavior?: ContextBehavior  # 语境行为集（语境结束时评估）
```

### 进入流程

```
1. 玩家在故事列表/菜单中看到 ActiveStoryEntry
   → 可见性由 visibility 字段决定（达到 Lv.4 Purchasable 可进入）

2. 玩家点击"开始"
   → 检查 mutuallyExclusiveWith：
      - 遍历 toExclude[]，检查 player.storyInstances[excludedId].triggerCount > 0
      - 若有已触发的 → 此 ActiveStoryEntry 在当前 Init 中不可用
      - 显示锁定提示："此路线与已完成的故事冲突"
   → 检查 prerequisites（二次校验）
   → 检查是否已有进行中的故事（一次只能一个）

3. 创建语境
   → 加载 storyId 对应的 StoryDefinition
   → 创建 StoryContext
   → isActive = true，进入故事演出（→ [Story](story.md) 语境生命周期）

4. 故事结束后
   → 评估 ContextBehavior
   → 若 mutuallyExclusiveWith 不为空：
      - 将这些 ActiveStoryEntry 的可见性在当前 Init 中设为不可用
      - 通过 visibilityState 或独立的互斥标记实现
   → 语境销毁
```

**互斥实现方式（方案 B：独立互斥标记）：**

```
PlayerState.mutuallyExcluded: Record<string, string[]>
例：
  "arona/activeStoryEntry/choose_a": ["arona/activeStoryEntry/choose_b"]
  // 完成 choose_a 后，choose_b 在当前 Init 中永久不可用

工作流程：
  1. ActiveStoryEntry A 完成 → 执行其 ContextBehavior
  2. 引擎检测 A 的 mutuallyExclusiveWith 不为空
  3. 对每个 excludedId:
     写入 player.mutuallyExcluded[A.id].push(excludedId)
  4. 后续展示 ActiveStoryEntry 列表时:
     → 对所有 candidate ActiveStoryEntry:
        if player.mutuallyExcluded 的任一 value 包含该 storyId
        → 显示为"已锁定"，不可进入
  5. 检查顺序：互斥标记 → visibility Condition → prerequisites

生命周期：
  → 随 Instance 持久化（写死在 PlayerState 中）
  → 切换 Init 时保留（同 Init 内互斥跨游玩周期仍有效）
  → 全新存档/未触发时为空
```

## PassiveStoryEntry

在特定条件下**随机抽取**触发的故事。PassiveStoryEntry 是整个游戏系统中唯一的"被动触发"故事形式（即 PassiveTalk 是 PassiveStoryEntry 的别名，两者为同一系统）。

当玩家不处于任何 ActiveStoryEntry 中时，点击聊天按钮可随机抽取 PassiveStoryEntry。
抽取到的 PassiveStoryEntry 需要玩家手动点击推进 Talklet 直至结束。

**收益来源：** PassiveStoryEntry 本身不产生收益。点击聊天按钮的主收益来自 PassiveStoryEntry
语境结束时的 [ContextBehavior](#contextbehavior语境行为集) — 数据包编辑者在
`contextBehavior.branches` 或 `base` 中定义奖励（FuncList `add_resource` 等）。
仅当无 PassiveStoryEntry 可抽取时，引擎才提供基础点击收益作为保底（见 [Chat](chat.md)）。

```
PassiveStoryEntryDefinition:
  - id: string                         # FullKey: ModName/passiveStoryEntry/idName
  - storyId: string                    # 引用的 Story FullKey（一对一固定）
  - area: string                       # 所属 Area 的 FullKey
  - prerequisites: Prerequisite[]
  - rarity: Rarity
  - conditions: Condition[]            # → [Value & Condition](../01-foundation/value-condition.md) Condition
  - weight: number
  - cooldownTicks: number
  - tags: string[]
  - contextBehavior?: ContextBehavior  # 语境行为集（语境结束时评估）
```

## ContextBehavior（语境行为集）

语境结束时，引擎将累积的 accumulatedLabels + accumulatedFlags 作为输入，按以下结构评估：

```
ContextBehavior:
  base?: FuncList                    # □ 无论如何都执行
  branches?: ContextEndRule[]        # ■ 条件匹配则叠加执行
  fallback?: FuncList                # □ 仅当 branches 全部未命中时执行

ContextEndRule:
  - condition?: Condition            # 缺省 = always（→ [Value & Condition](../01-foundation/value-condition.md)）
  - effects: FuncList                # 条件匹配时叠加执行的 FuncList
```

### 执行逻辑

```
1. 执行 base FuncList（如有）
2. 遍历 branches:
   - 对每条规则的 condition 求值（labels + contextFlags 作为 EvaluationContext）
   - 匹配 → 执行该规则的 effects，继续检查下一条（叠加）
   - 不匹配 → 跳过
3. 若没有 branch 的 condition 匹配（0条命中），执行 fallback FuncList
```

### 示例

```json
{
  "base": [
    { "type": "add_resource", "target": "arona/resource/gold", "value": { "type": "const", "value": 10 } }
  ],
  "branches": [
    {
      "condition": { "type": "has_label", "label": 1 },
      "effects": [
        { "type": "add_resource", "target": "arona/resource/gold", "value": { "type": "const", "value": 50 } }
      ]
    },
    {
      "condition": {
        "type": "and",
        "conditions": [
          { "type": "has_label", "label": 2 },
          { "type": "cmp", "op": "gte", "left": { "type": "context_flag", "key": "affection" }, "right": { "type": "const", "value": 5 } }
        ]
      },
      "effects": [
        { "type": "give_enhancement", "target": "arona/enhancement/rare_reward" }
      ]
    }
  ],
  "fallback": [
    { "type": "add_resource", "target": "arona/resource/gold", "value": { "type": "const", "value": 5 } }
  ]
}
```

## StoryInstance（执行档案）

每个 activeStoryEntry/passiveStoryEntry 被首次触发时创建 Instance，记录其所有执行历史。

```
StoryInstance:
  - storyId: string                    # 对应的 Story FullKey
  - ownerId: string                    # 所属的 activeStoryEntry/passiveStoryEntry FullKey
  - triggerCount: number
  - lastTriggeredAt: GameTick
  - accumulatedLabels: Set<number>

  # 重要分支 Playthrough 记录（用于回看历史）
  - playthroughs?: PlaythroughRecord[]

PlaythroughRecord:
  - playedAt: GameTick
  - labelsEarned: number[]
  - flagsAccumulated: Record<string, any>   # 语境存活期间累积的 ContextFlag
  - seenTalklets: string[]
  - importantChoices: {
      talkletId: string
      chosen: string
    }[]
```

## 重要分岔 vs 不重要分岔

由数据包编写者在 TalkletChoice 上手动标记 `isMajorBranch`。

重要分支必须通过 StoryAction `jump_story` 跳转到另一个 Story。其回放封锁逻辑基于 **StoryInstance 是否存在**判断：

```
判别依据：目标 Story（jump_story 的 storyId）是否已有 StoryInstance

重玩时的分支处理：
  1. 遍历所有 TalkletChoice（含 isMajorBranch = true/false）
  2. 对每条 choice:
     → 提取 action.data.storyId（jump_story 的目标）
     → 遍历 player.storyInstances，查找 storyId 匹配的 Instance
     → 若找到（triggerCount > 0）→ 该分支已走过
        • 若 isMajorBranch == true  → 锁定，显示历史文本，不可更改
        • 若 isMajorBranch == false → 不锁定，允许自由选择
     → 若未找到 → 该分支未走过，按正常流程渲染

isMajorBranch = true:
  - 有 Instance → 锁定为历史选择，不可更改
  - 无 Instance → 首次选择，正常渲染
  - 回看历史时，只能看到已走过的分支序列（有 Instance 的）

isMajorBranch = false（默认）:
  - 不锁定，无论有无 Instance 都允许自由选择
  - 回看历史时，所有选项内容均可查看

无重要分岔的 Story:
  - 不检测 Instance
  - 每次重玩都是全新的自由体验

示例：
  Talklet 是选择分支点：
  choices:
    - text: "进入森林"
      condition: ...
      isMajorBranch: true
      action: { type: "jump_story", data: { storyId: "arona/story/forest_path" } }
    - text: "进入山洞"
      condition: ...
      isMajorBranch: true
      action: { type: "jump_story", data: { storyId: "arona/story/cave_path" } }

  重玩时：
    若 player.storyInstances 中存在 storyId = "arona/story/forest_path" 的 Instance
      → forest_path 已走过 → 锁定，显示历史
      → cave_path 未锁定 → 但若有 forest 的 Instance 说明已走过 forest 线
```

## 推荐算法（用于 PassiveStoryEntry 抽取）

推荐算法从当前 Area 的 PassiveStoryEntry 池中筛选可触发的 Story。

```
推荐算法输入:
  - areaId: string                    # Area 的 FullKey
  - playerState: PlayerState
  - storyInstances: Map<string, StoryInstance>
  - count: number
  - context: {
      lastTriggeredIds: string[]
      tick: GameTick
      currentTags: string[]
    }

推荐算法输出:
  - selected: PassiveStoryEntryDefinition[]
  - weights: number[]

考虑因素:
  1. 基础权重 (weight)
  2. 稀有度修正
  3. 去重（最近触发过的优先排除）
  4. 冷却检查（cooldownTicks）
  5. 条件过滤
  6. 未完成Story的权重提升
  7. 标签匹配度
```

## 参见

- [Story](story.md) — 被包裹的纯演出载体
- [Value & Condition](value-condition.md) — 条件表达和状态修改统一系统
- [Chat](chat.md) — 聊天框触发 ActiveStoryEntry / PassiveStoryEntry
- [Player](player.md) — PlayerState 中保存 storyInstances
