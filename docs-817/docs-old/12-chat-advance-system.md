# 聊天推进系统（Chat Advance System）

> 本文档定义 AronaClicker 的核心交互玩法：将"聊天回复点击"与剧情演出结合。
> 底部一个宽按钮扮演"正在发送的聊天消息"，玩家通过连点完成该消息的点击次数要求，
> 完成后推进剧情/聊天流；剧情流结束后按钮转为随机抽取 PassiveTalkEntry 并演出。

## 一句话描述

中央聊天流的底部是一条**可点击的聊天消息**：它看起来像聊天气泡，玩家连点它来"发送"，发送完成后剧情随之推进；当一段聊天自然结束时，再点这条消息会按当前场景抽出一条新的被动闲聊。

## 核心循环

```
                ┌──────────────────────────────────────────┐
                │  聊天流（Passive/Active Talk 演出）        │
                └────────────────────┬─────────────────────┘
                                     │ 当前页无选项
                                     ▼
                ┌──────────────────────────────────────────┐
                │  底部"发送"按钮（一条聊天消息）             │
                │  · 显示待发送文本                          │
                │  · 显示点击进度 n / requiredClicks         │
                │  · 每次点击 += 1                          │
                └────────────────────┬─────────────────────┘
                                     │ 达到 requiredClicks
                                     ▼
                ┌──────────────────────────────────────────┐
                │  推进剧情（advanceStory）                  │
                │  · 本页消息进入聊天流                     │
                │  · 载入下一页                             │
                │  · 若下一页有选项 → 显示选项（按钮隐藏）     │
                │  · 若下一页无选项 → 重新生成发送按钮         │
                └────────────────────┬─────────────────────┘
                                     │ 剧情流结束（无进行中剧情）
                                     ▼
                ┌──────────────────────────────────────────┐
                │  按钮变为"继续聊天"                        │
                │  · 点击 → 按当前场景随机抽 PassiveTalkEntry │
                │  · 抽取成功 → 开始演出（回到顶部循环）       │
                └──────────────────────────────────────────┘
```

## 核心概念

### 1. 发送按钮（Send Button）

UI 演出设备（聊天流底部）生成的一个**宽按钮**。它本身是一条聊天信息：

- **文本**：按钮展示的"待发送消息"内容（如「我想了解更多…」）
- **点击次数要求** `requiredClicks`：玩家需要连点多少次才能"发送"完成
- **进度显示**：按钮上显示 `n / requiredClicks`，每点一次 +1
- **发送完成**：进度满 → 按钮短暂变为"已发送"反馈 → 推进内容

按钮的 `requiredClicks` 由**数据驱动**：每页剧情可定义自己的点击次数，节奏可调。

### 2. 聊天推进（Advance）

发送完成后的"推进内容"动作，取决于当前状态：

| 当前状态 | 推进内容 |
|----------|----------|
| 有进行中剧情（StoryDef） | 调用 `advanceStory()`：当前页进入聊天流，载入下一页 |
| 下一页有选项 | 选项页：底部按钮**隐藏**，改为显示 `story-choice` 选项 |
| 剧情流结束 | 底部按钮变为"继续聊天"模式 |

### 3. 随机被动闲聊（PassiveTalk）

当没有进行中的剧情时，点击"继续聊天"按钮：

- 按**当前场景**（当前 Area / Init / 可用池）随机抽取一条 PassiveTalkEntry
- 抽取成功 → 开始该剧情的演出（进入聊天流）
- 抽取失败（无可用的）→ 按钮显示短暂提示，不推进

> 本阶段不实现复杂的推荐/权重管理架构，仅用现有的 `weight` + `triggerCondition` + `availableInits` 过滤后按权重随机抽取。

### 4. 与选项的关系

- **无选项页**：显示底部发送按钮推进
- **有选项页**：隐藏发送按钮，显示 `story-choice` 选项；玩家选择后回到无选项流程
- 两种交互不会同时出现

## 数据驱动设计

### StoryPage 扩展

现有 `StoryPage` 增加可选字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `sendClicks?: number` | int | 本页发送按钮的点击次数要求；缺省 = 默认值（如 1） |
| `sendText?: string` | String | 发送按钮显示的待发送文本；缺省 = 默认文案 |
| `sendCompleteEffects?: Effect[]` | Effect[] | 发送完成后额外触发的效果（可选） |

示例：

```ts
{
  speaker: '阿罗娜',
  text: '设备运转正常。',
  sendText: '收到，辛苦了。',
  sendClicks: 3,
  sendCompleteEffects: [{ op: 'addResource', target: 'credit', value: 5 }],
}
```

### PassiveTalkEntry

现有 `StoryDef`（type=passive）即被动闲聊的来源，不新增实体。通过以下字段过滤与抽取：

- `type === 'passive'`
- `availableInits` 包含当前 Init
- `triggerCondition` 满足
- `repeatable` 或未完成过
- 冷却未生效
- 按 `weight` 加权随机抽取

## 引擎层扩展（规划）

### GameInstance 新增

| 方法 | 说明 |
|------|------|
| `clickSend(): SendResult` | 玩家点击一次发送按钮 |
| `getSendState(): SendState` | 查询当前发送按钮状态（供 UI 渲染） |

### SendState（UI 只读状态）

```
type SendState =
  | { mode: 'advance'; pageIndex; requiredClicks; currentClicks; sendText }
  | { mode: 'idle'; reason: string }       // 无进行中剧情，点击抽 PassiveTalk
  | { mode: 'choice' }                      // 当前页有选项，按钮隐藏
  | { mode: 'completed' }                   // 刚发送完成，短暂反馈
```

### clickSend 流程

```
clickSend():
  1. 若 currentStory 存在:
     a. 若当前页有选项 → 返回 { mode:'choice' }（不推进）
     b. currentClicks += 1
     c. 若 currentClicks >= requiredClicks:
        - 执行 sendCompleteEffects
        - 调用 advanceStory()
        - currentClicks 重置为 0（依据下一页的 requiredClicks）
        - 返回发送完成 + 下一页 SendState
     d. 否则返回 { mode:'advance', currentClicks }
  2. 若 currentStory 为 null:
     - 按当前场景随机抽 PassiveTalkEntry
     - 成功 → startStory → 返回 { mode:'advance', ... }
     - 失败 → 返回 { mode:'idle', reason:'noAvailable' }
```

## UI 演出设计

### 聊天流底部按钮形态

```
┌────────────────────────────────────────────────────┐
│  聊天流（历史气泡）                                  │
│  ...                                               │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  发件中：收到，辛苦了。   [ 2 / 3 ]           │  │  ← 发送按钮（宽）
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

- 按钮以**聊天消息外观**呈现（左侧气泡样式 + "正在发送"动画点）
- 每次点击：进度数字 +1，气泡内小动画反馈
- 进度满：气泡短暂切换为"已发送 ✓"，随即推进

### 状态呈现

| 状态 | 按钮外观 | 交互 |
|------|----------|------|
| `advance` | 待发送消息 + 进度 | 点击 +1 |
| `idle` | "继续聊天" + 场景提示 | 点击抽 PassiveTalk |
| `choice` | 隐藏，显示选项 | 选项交互 |
| `completed` | "已发送 ✓"（~500ms） | 无，自动推进 |

## 数据流

### 剧情推进数据流

```
UI 点击发送按钮
  → GameInstance.clickSend()
  → currentStory 存在 & 无选项
  → currentClicks + 1
  → 达到 requiredClicks?
      是 → 执行 sendCompleteEffects
          → advanceStory()
          → 返回下一页 SendState（或 finished）
      否 → 返回当前进度 SendState
  → UI 依据 SendState 渲染（推进/选项/完成）
```

### 被动闲聊数据流

```
无进行中剧情 → UI 点击"继续聊天"
  → GameInstance.clickSend()（idle 分支）
  → 按当前场景过滤 passive stories
  → 按 weight 加权随机抽取
  → 抽取成功 → startStory → 返回聊天演出
  → 抽取失败 → 返回 idle + 提示
```

## 与现有系统的关系

| 系统 | 角色 |
|------|------|
| StorySystem（advanceStory/startStory） | 底层推进；发送按钮是它的"推进器" |
| Chat 聊天流（center-panel） | 演出载体；发送按钮渲染在聊天流底部 |
| StoryChoice | 选项页时按钮让位 |
| Reveal 信息可知系统 | 不影响按钮（按钮不涉及数值揭示） |
| DevLog | 记录发送/推进行为日志 |

## 克制边界

- 不引入独立的"消息队列/调度"系统——按钮直接驱动现有 `advanceStory`
- 不实现按住累积（仅单击连点）
- 不做多主题选择——单按钮随机抽取
- 不实现复杂的 PassiveTalkEntry 推荐/权重管理架构
- `requiredClicks` 默认值 1，缺省即单击推进（兼容现有行为）

## 实施要点（后续）

1. 引擎：`StoryPage` 增加 `sendClicks` / `sendText` / `sendCompleteEffects`
2. 引擎：`GameInstance.clickSend()` + `getSendState()` + `SendState` 类型
3. UI：center-panel 聊天流底部渲染发送按钮（聊天消息形态）
4. controller：绑定发送按钮点击 → `clickSend()` → 更新聊天流与按钮状态
5. 随机抽取：复用现有 `triggerPassiveStory()` 逻辑抽取 PassiveTalk
6. 测试：发送推进、选项页隐藏、idle 随机抽取、requiredClicks 边界
