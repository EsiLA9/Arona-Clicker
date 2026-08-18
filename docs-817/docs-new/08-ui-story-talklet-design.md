# UI-Story / Entry / Talklet 架构设计

> 状态: 说明文档 | 日期: 2026-08-08

---

## 1. 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│ UI 层                                                           │
│ ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│ │ rail.ts      │  │ center-panel.ts  │  │ tooltip.ts          │ │
│ │ 故事列表入口  │  │ 聊天流 + 选项    │  │ Reveal 信息遮蔽     │ │
│ └──────┬───────┘  └────────┬─────────┘  └──────────┬──────────┘ │
│        │                   │                        │            │
│ 点击 ActiveStory   Send/Advance/Choice     getStoryReveal()      │
│        │                   │                        │            │
│ ┌──────┴───────────────────┴────────────────────────┴──────────┐ │
│ │ controller.ts  — 事件分发中枢                                 │ │
│ └──────┬───────────────────────────────────────────────────────┘ │
├────────┼────────────────────────────────────────────────────────┤
│ 引擎层 │                                                        │
│ ┌──────┴───────────────────────────────────────────────────────┐ │
│ │ GameInstance                                                 │ │
│ │ ├─ startActiveStory(id)    → private startStory(id,'active') │ │
│ │ ├─ triggerPassiveStory()   → private startStory(id,'passive')│ │
│ │ ├─ advanceStory(choice?)   → 推进 Talklet                    │ │
│ │ ├─ clickSend()             → 统一回复入口                     │ │
│ │ └─ getSendState()          → 当前按钮状态                     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Registry: Map<StoryId, StoryDef>  (ActiveStoryDef | Passive) │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**核心设计理念**：聊天流 UI 中只有一个"故事槽位"（`currentStoryId`）。同一时刻只有一段故事在播放。玩家通过底部回复按钮与这个故事交互。

---

## 2. 两种 Story 定义

### 2.1 共享基底 `BaseStoryDef`

```typescript
interface BaseStoryDef {
  id: StoryId;                    // "pack:story:name"
  name: string;                   // 展示名
  availableInits: InitId[];       // 哪些 Init 下可触发（空=全部）
  pages: StoryPage[];             // Talklet 页面列表
  revealTriggers?: RevealTrigger[]; // 揭示 Trigger 列表：每个 Trigger 负责单纯揭示一个信息块
}
```

### 2.2 `ActiveStoryDef` — 主线/支线

```typescript
interface ActiveStoryDef extends BaseStoryDef {
  type: 'active';
  triggerCondition: ConditionGroup;  // 触发条件
  // 无 weight, repeatable, cooldownFrames
}
```

**特点**：
- **不可重复**：完成后写入 `storyLog`，不会再触发
- **不参与抽选池**：没有 weight，不由 `triggerPassiveStory()` 随机抽取
- **触发方式**：
  - 玩家在侧栏 Story 列表点击 → `startActiveStory(id)`
  - InitDef 的 `startStoryId` 指定 → 进入 Init 时自动展开
- **播放期间锁定移动**：`isStoryBlockingMovement()` 对 active 类型返回 true
- **可打断 PassiveStory**：ActiveStory 启动时会清除正在播放的 PassiveStory

### 2.3 `PassiveStoryDef` — 随机闲聊

```typescript
interface PassiveStoryDef extends BaseStoryDef {
  type: 'passive';
  triggerCondition: ConditionGroup;  // 触发条件
  repeatable: boolean;               // 是否可重复
  cooldownFrames: number;            // 冷却帧数
  weight: number;                    // 抽选权重
}
```

**特点**：
- **可重复**：`repeatable = true` 的故事可多次触发
- **参与抽选池**：`triggerPassiveStory()` 按权重随机选一个符合条件的
- **触发方式**：玩家点回复按钮（idle 状态时）→ `clickSend()` → `triggerPassiveStory()`
- **播放期间不锁定移动**：玩家可自由移动，但移动会打断 PassiveStory
- **可被 ActiveStory 打断**

---

## 3. Talklet 页面结构

```typescript
interface StoryPage {
  text: string;                    // 对话文本
  speaker?: string;                // 说话人
  choices?: StoryChoice[];         // 选项（有选项时，回复按钮让位）
  effects?: Effect[];              // 推进本页时执行的效果
  sendText?: string;               // 回复按钮文案（默认=text）
}

interface StoryChoice {
  text: string;                    // 选项文案
  effects: Effect[];               // 选择后的效果
  condition?: ConditionGroup;      // 该选项是否可见/可选
}
```

---

## 4. 运行时状态

### 4.1 故事槽位（单例）

```typescript
// GameInstance 内部
private currentStoryId: StoryId | null = null;   // 当前播放的故事
private currentStoryPageIndex: number = 0;        // 当前 Talklet 页索引
private currentStoryChoiceIndex: number = -1;     // 玩家做出的选项索引
```

**同一时刻只有一段故事**。这个设计简化了状态管理：不存在"同时播放两个故事"的场景。

### 4.2 故事日志

```typescript
// PlayerState
storyLog: CompletedStory[];  // 已完成的 ActiveStory / PassiveStory 记录
```

用于：
- `hasReadStory` Condition：检查是否读过某故事（跨 run 持久）
- 防止 ActiveStory 重复触发

### 4.3 故事冷却

```
// 仅 PassiveStory 有冷却
cooldowns: Record<StoryId, number>;  // storyId → 触发时的 totalFrames
```

---

## 5. 交互流程

### 5.1 ActiveStory 触发流程

```
玩家在侧栏点击故事条目
  │
  ▼
controller.handleStoryClick(storyId)
  │
  ▼
game.startActiveStory(storyId)
  │
  ├─ 校验: currentStoryId 是否冲突
  │   └─ 如果是 passive → 清除 (打断)
  │   └─ 如果是 active  → 返回 AlreadyActive
  ├─ 校验: story.type === 'active'
  ├─ 校验: triggerCondition 满足
  ├─ 校验: 未完成过 (storyLog 检查)
  │
  ├─ currentStoryId = storyId
  ├─ currentStoryPageIndex = 0
  ├─ emit { type: 'storyTriggered', storyId }
  │
  └─ 返回 StoryView → UI 渲染第一页
```

### 5.2 PassiveStory 触发流程

```
玩家点击底部回复按钮 (idle 状态)
  │
  ▼
controller.handleSend()
  │
  ▼
game.clickSend()
  │
  ├─ getSendState() → { mode: 'idle' }
  │
  ├─ triggerPassiveStory()
  │   ├─ 筛选当前 Init 下 weight > 0 的 passive story
  │   ├─ 过滤: triggerCondition 满足
  │   ├─ 过滤: repeatable 或未完成
  │   ├─ 过滤: 不在冷却期
  │   ├─ 按权重随机选一个
  │   └─ startStory(selected.id, 'passive')
  │
  └─ 返回结果 → UI 渲染第一页
```

### 5.3 推进 Talklet 流程

```
玩家再次点击回复按钮 (advance 状态)
  │
  ▼
game.clickSend()
  │
  ├─ getSendState() → { mode: 'advance', text: '...' }
  │
  ├─ advanceStory()
  │   ├─ 获取当前 page
  │   ├─ 如果有 choices → 报错 ChoiceRequired (需先选)
  │   ├─ 执行 page.effects
  │   ├─ currentStoryPageIndex += 1
  │   │
  │   ├─ 还有下一页 → 返回 next StoryView
  │   └─ 没有下一页 → completeStory() + clearCurrentStory()
  │
  └─ 渲染下一页 / 结束
```

### 5.4 选项流程

```
当前 page 有 choices (>=1 个)
  │
  ▼
getSendState() → { mode: 'choice' }
  │  回复按钮隐藏，选项按钮显示
  │
  ▼
玩家点击某个选项
  │
  ▼
controller.handleChoice(choiceIndex)
  │
  ▼
game.advanceStory(choiceIndex)
  │
  ├─ 校验: choiceIndex 有效
  ├─ 校验: choice.condition 满足
  ├─ 执行 page.effects + choice.effects
  ├─ currentStoryPageIndex += 1
  │
  └─ 推进到下一页
```

---

## 6. Send 状态机

```
          idle ──────────────────────────┐
          (无故事)                        │
           │ clickSend()                 │
           │ triggerPassiveStory()       │
           ▼                             │
       advance ─────────────────────► idle
       (推进 Talklet)  finished=true     │
           │                             │
           │ 当前 page.choices.length>0  │
           ▼                             │
        choice ── advanceStory(n) ──────┘
        (等待选选项)
```

```
getSendState():
  currentStoryId === null     → { mode: 'idle' }
  page.choices.length > 0     → { mode: 'choice' }
  else                        → { mode: 'advance', text, storyId, pageIndex }
```

---

## 7. UI 组件职责

### 7.1 `story.ts` — 故事条目渲染

**故事条目列表**（侧栏 Story tab）中，每个条目渲染：

```
[reveal遮罩名称] [条件摘要] [状态标签]
    ├─ 可触发 → 点击启动 ActiveStory
    ├─ 已完成 → 显示 ✓
    └─ 条件不满足 → 灰显
```

条目信息来源：
- `storyDef.name` → 通过 `getStoryReveal()` 判断是否遮罩
- `storyDef.triggerCondition` → 通过 `getStoryReveal()` 判断是否遮罩
- `storyDef.type` → active/passive 区分样式
- 运行时检查：是否已完成 (`storyLog`)、是否在冷却中

### 7.2 `center-panel.ts` — 聊天流 + 回复按钮

当前故事播放时：
- **聊天流区域**：展示当前 `StoryPage.text`（说话人 + 内容）
- **选项区域**：当 `sendState.mode === 'choice'` 时渲染选项按钮
- **回复按钮**：
  - `idle` → 显示占位文本，点击触发 PassiveStory
  - `advance` → 显示 `sendText` 或 `text`，点击推进一页
  - `choice` → 隐藏（让位给选项）

### 7.3 `tooltip.ts` — 信息揭示

`getStoryReveal(story, game)` 返回：
```typescript
{
  stage: RevealStage;         // presence → partial → known → utility → purchaseable → owned
  nameKnown: boolean;         // 名称是否可见
  conditionKnown: boolean;    // 触发条件是否可见
  utilityKnown: boolean;      // 效用是否可见
}
```

基于 `story.revealTriggers`（RevealTrigger[]）中的 Trigger 求值：无某目标的 Trigger 视为无揭示门槛，否则任一满足即揭示。

### 7.4 `controller.ts` — 事件中枢

| 事件 | 来源 | 调用 |
|---|---|---|
| `handleStoryClick(storyId)` | story.ts 条目点击 | `game.startActiveStory(storyId)` |
| `handleSend()` | center-panel 回复按钮 | `game.clickSend()` |
| `handleChoice(index)` | center-panel 选项按钮 | `game.advanceStory(index)` |

---

## 8. 打断机制（新增）

```
ActiveStory 启动时:
  currentStory.type === 'passive' → clearCurrentStory() → 继续启动 ActiveStory
  currentStory.type === 'active'  → 报错 AlreadyActive

移动出 Area 时:
  currentStory.type === 'passive' → clearCurrentStory()
  currentStory.type === 'active'  → 不移除（移动本身被锁定）
```

---

## 9. 小结

| 维度 | 设计 |
|---|---|
| 槽位 | 单槽 (`currentStoryId`)，同时只播一个故事 |
| 触发 | ActiveStory 手动点击 / Init 自动；PassiveStory 按权重随机 |
| 推进 | 统一的回复按钮 (`clickSend`)，选项自动切换 |
| 状态 | `StoryView` 只读快照，挂载到 `GameView` |
| 揭示 | `RevealTrigger[]` 遮蔽名称/条件/效用（任一满足即揭示） |
| 打断 | ActiveStory 可打断 PassiveStory；移动可打断 PassiveStory |
