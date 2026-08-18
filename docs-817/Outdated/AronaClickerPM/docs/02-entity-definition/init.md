# Init（世界线/起始点）

## 概念

Init 是一个**箱庭世界**——自包含的独立游玩空间。玩家从0开始存档时进入 Init 选择界面，选定一个 Init 进入后**暂时无法退出**，直到该 Init 提供了退出手段（如完成了主要剧情等）。

```
游戏启动 → Init选择 → 进入Init → 探索Area → 达成Exit条件 → 完成Init → 选择新Init（NG+）
```

## 数据结构

```
InitDefinition:
  - id: string                         # FullKey: ModName/init/idName
  - name: string
  - description: string
  - icon: string

  # ── 区域 ──
  - areas: string[]                    # 包含的区域 FullKey 列表
  - startingArea: string               # 初始所在区域的 FullKey（保险传送目标）
  - defaultArea: string                # 默认返回区域的 FullKey
  - defaultAreaCooldown: number        # 返回默认Area的冷却刻数

  # ── 进入/退出 ──
  - entryRequirements: UnlockCondition?
  - exitConditions: ExitCondition[]

  # ── 起始内容 ──
  # 新存档首次进入该Init时，依次执行这些行为
  # play_story 引用的是 ActiveStoryEntry（起始故事作为语境入口）
  - startingActions: FuncList

  # ── 数据包继承策略 ──
  # 退出该Init时，以下内容是否保留到下一个Init
  - inheritResources: boolean          # 默认false
  - inheritSpots: boolean              # 默认false
  - inheritEnhancements: boolean       # 默认false
```

### UnlockCondition

```
UnlockCondition:
  - type: "has_enhancement" | "area_explored" | "resource_threshold"
        | "active_story_completed" | "flag_equals" | "any" | "all"
  - target: string          # FullKey
  - value?: number
  - conditions?: UnlockCondition[]  # type = any/all 时的子条件
```

### ExitCondition

```
ExitCondition:
  - type: "active_story_completed" | "all_areas_explored" | "resource_threshold"
  - target: string          # FullKey
  - value?: number
```

### startingActions（FuncList）

`startingActions` 复用引擎统一的 [FuncList](value-condition.md#funclist---funclet统一状态修改)。

```
startingActions: FuncList

# 可用 Funclet:
#   add_resource       → 添加初始资源
#   set_player_flag    → 设置存档Flag
#   give_spot          → 给予指定等级的Spot
#   give_enhancement   → 给予Enhancement
#   travel_to_area     → 移动到指定 Area（如起始故事中引导玩家到下一个区域）
#   play_story         → 播放起始 Story（引擎将其作为 ActiveStoryEntry 语境入口处理）
#   set_context_flag   → 在语境激活时无意义（仅在Init语境外执行时静默跳过）

# 注意：play_story 引用的是 ActiveStoryEntry，因为起始故事是语境的入口。
#       起始故事运行期间，其 ContextBehavior 在语境结束时被评估，
#       且故事内的 Funclet（如 travel_to_area）可移动玩家到其他 Area。

# 示例：
# { "type": "add_resource", "target": "arona/resource/gold", "value": { "type": "const", "value": 100 } }
# { "type": "give_spot", "target": "arona/spot/crystal", "level": { "type": "const", "value": 1 } }
# { "type": "play_story", "storyId": "arona/story/prologue" }
```

## 执行流程

### 进入 Init

```
玩家选择 Init → 检查 entryRequirements
  → 未通过 → 提示条件不足
  → 通过 → 创建新存档（或切换 Init）
    → 初始化所有 Area 的 AreaState（见 save-construction.md）
    → 依次执行 startingActions（FuncList，顺序执行）:
       - add_resource → 写入 player.resources
       - give_spot → 写入 player.spots
       - give_enhancement → 写入 player.enhancements
       - set_player_flag → 写入 player.flags
       - travel_to_area → 移动到目标 Area（立即切换 currentArea）
       - play_story → 启动 Story 语境演出（相当于 ActiveStoryEntry 入口）
          （故事内可通过 Funclet `travel_to_area` 移动玩家）
    → 设置 player.currentInit = Init FullKey
    → 验证 player.currentArea 有效性:
       - 若 AreaState.unlocked == false 或 Area 不存在
       - 则回退到 player.currentArea = startingArea（保险）
    → EventBus.publish("init/changed", { to: InitKey })
```

**保险逻辑：** startingActions 执行过程中（如 play_story 内的 Funclet `travel_to_area`）会更新 `currentArea`。
startingActions 执行完毕后 **不会自动重置** `currentArea`，仅在 Area 无效时才回退到 startingArea。
这使得起始故事可以通过 `travel_to_area` 将玩家引导到第一个真实探索的 Area。

> **设计建议：** 起始故事（ActiveStoryEntry）通常包含开场剧情 + 首次引导，
> 故事内用 Funclet `travel_to_area` 将玩家带到第一个真实探索的 Area。
> startingArea 作为保险目的地，仅在故事意外中断/Area 状态异常时发挥作用。

### 返回默认 Area

```
玩家请求返回默认 Area:
  → 检查 context 中 defaultAreaCooldown 是否已冷却
    → 未冷却 → 提示剩余冷却时间
    → 已冷却 → player.currentArea = defaultArea
              → 重置冷却计时器
              → EventBus.publish("area/entered", { area: defaultArea, init: currentInit })
```

### 退出 Init（通过 Area 出口 + ExitCondition）

玩家完成主线故事后，引擎自动满足 `exitConditions`，然后需在带有 `isExitPoint` 标记的 Area 中触发离开：

```
前提：exitConditions[] 中的所有条件已全部满足

1. 引擎检测到 exitConditions 满足后通知 UI
   → 若当前 Area 的 isExitPoint == true → 出现"离开 Init"按钮
   → 若当前 Area 的 isExitPoint == false → UI 提示"请前往出口区域"

2. 玩家在 isExitPoint Area 中点击"离开 Init"：
   → Init 标记为"完成"（player.completedInits 添加该 Init FullKey）
   → 根据 inheritResources / inheritSpots / inheritEnhancements 决定哪些内容保留
   → scope = "global" 的 Enhancement 始终保留
   → 非全局实体进入休眠（→ [Save Construction](../06-persistence/save-construction.md) 休眠机制）
   → 玩家回到 Init 选择界面（或全局购买页）
   → EventBus.publish("init/completed", { init: initId })
   → EventBus.publish("init/changed", { from: oldInit, to: undefined })
```

## 行为规则

- 玩家一局游戏只能处在一个 Init 中
- 返回默认 Area 有冷却限制，冷却期间无法使用
- 退出 Init 后，该 Init 进入"完成"状态，可选择新 Init（类似 NG+）或进入全局购买页
- 进入已完成的 Init 不会再执行 startingActions
- 不同 Init 之间的资源/Spot/Enhancement 是否继承取决于 `inherit*` 字段
- `scope = "global"` 的 Enhancement 始终保留，不受继承策略影响
- 若一个 Init 的 `exitConditions` 已满足但没有 `isExitPoint` 的 Area，玩家将无法正常离开（设计错误）

## 数据包示例

```json
{
  "id": "arona",
  "contents": {
    "inits": [{
      "id": "main_world",
      "name": "主世界",
      "description": "一切的起点",
      "startingArea": "arona/area/hometown",
      "defaultArea": "arona/area/hometown",
      "defaultAreaCooldown": 6000,
      "areas": ["arona/area/hometown", "arona/area/forest", "arona/area/cave"],
      "exitConditions": [
        { "type": "active_story_completed", "target": "arona/activeStoryEntry/final_chapter" }
      ],
      "inheritEnhancements": true,
      "startingActions": [
        { "type": "add_resource", "target": "arona/resource/gold", "value": { "type": "const", "value": 50 } },
        { "type": "play_story", "storyId": "arona/story/prologue" }
      ]
    }]
  }
}
```

## 参见

- [Area](area.md) — Init 包含的区域
- [Player](player.md) — PlayerState 中保存 currentInit / completedInits
- [Save Construction](save-construction.md) — 新游戏时 Init 选择与存档构建
- [EventBus](event-bus.md) — 切换 Init 时发布 `init/changed` 事件
- [Value & Condition](value-condition.md) — startingActions 使用的 FuncList 定义
- [Story](story.md) — startingActions 中的 play_story 启动 ActiveStoryEntry 语境
- [StoryEntry](story-entry.md) — ContextBehavior 评估起始故事的语境结束行为
- [Chat](chat.md) — 玩家在聊天框中体验 Init 的内容
