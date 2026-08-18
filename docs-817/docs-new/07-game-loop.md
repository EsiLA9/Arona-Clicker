# 07 — 游戏循环与核心流程

## 完整游戏循环

```
┌──────────────────────────────────────┐
│          启动 / 读档                 │
│     UIController.mount()             │
└──────────────┬───────────────────────┘
               │
        有存档？
        ├─ 是 → GameInstance.load(data)
        │       → 恢复 state, stats, triggers
        │       → game.start()
        │
        └─ 否 → renderInitSelect()
                → 玩家选择 Init
                  → game.startNewGame(initId)
                    → mutation.enterInit(initId)
                    → eventBus.emit('initEntered')
                    → game.start()

               ↓
┌──────────────────────────────────────┐
│          主循环  (1帧/秒)            │
│                                     │
│  TickSystem.tick()                  │
│    ├─ totalFrames++                │
│    ├─ 冷却更新                      │
│    ├─ Spot 结算（产量+容量+Affector）│
│    ├─ Enhancement 自动购买检查       │
│    ├─ Story 触发检查                │
│    ├─ 自动存档                      │
│    ├─ StatsService.recordTick()     │
│    └─ EventBus.emit('tick')         │
│                                     │
│  UIController.refreshTimer (1秒)    │
│    ├─ 刷新资源显示                  │
│    ├─ 刷新 Spot 状态                │
│    └─ 刷新揭示状态（条件变化时）     │
└──────────────────────────────────────┘
```

## 新游戏流程

```
1. UIController: renderInitSelect()
   → 展示所有 visible 的 Init 卡片

2. 玩家点击 Init
   → UIController.startNewGame(initId)
     → game.startNewGame(initId)
       → 重置 state 为空白
       → mutation.enterInit(initId)
         → state.activeInit = initId
         → 初始化 defaultAreas → defaultSpots (level=1)
         → 触发 onEnterEffects
       → eventBus.emit({ type: 'initEntered', initId })
       → stats.beginSession()
       → SaveSystem.save(game.save())

3. game.start()
   → tickSystem.start()

4. UIController: renderAppShell()
   → 左栏: Area/Spot 列表
   → 中栏: Chat + Story 面板
   → 右栏: Spot 详情 / Enhancement / 背包
```

## 世界线切换 (软重启)

玩家在已有 Init 中，通过 UI 选择进入另一个已解锁的 Init：

```
game.switchInit(newInitId)
  → ① 执行当前 Init 的 onExitEffects
  → ② 保存当前 Progress（spotLevels, etc.）
  → ③ 切换 activeInit
  → ④ 初始化新 Init 的 Areas/Spots（如未解锁）
  → ⑤ 执行新 Init 的 onEnterEffects
  → ⑥ stats.beginSession()
  → ⑦ 存档
```

**关键**：不同 Init 的 Spot 等级是**独立记录**的。离开 Init A 时其 Spot 等级保留，下次回来时恢复。

## 存档 / 读档

### 存档 (SaveSystem.save)

```typescript
save(): SaveData {
  return {
    version: 1,
    timestamp: Date.now(),
    state: deepClone(state),         // PlayerState
    stats: stats.getPersistable(),   // PersistedStats
    createdAt: createdAt || Date.now(),
  };
}

SaveSystem.save(data)  →  localStorage.setItem('arona-save', JSON.stringify(data))
```

### 读档 (SaveSystem.load)

```typescript
load(data: SaveData) {
  state = data.state;
  stats.restore(data.stats);
  characterSystem.load(state);  // 恢复角色分配
  triggers.setState(state);     // 恢复 once 完成状态
  // 不恢复 currentStoryProgress（读档从第一页开始）
}
```

### 自动存档

每帧结束后自动调用 `SaveSystem.save(game.save())`。

## 离线进度

当游戏暂停后重新启动，TickSystem 检测时间差距：

```
时间差 = 实际经过时间 - 上次 tick 时间
补帧数 = Math.floor(时间差 / 帧间隔)

for (let i = 0; i < Math.min(补帧数, MAX_OFFLINE_FRAMES); i++) {
  tickSystem.tick();  // 手动触发每帧结算
}
```

- `MAX_OFFLINE_FRAMES` 限制离线追赶上限（防止长时间离线造成性能问题）
- 每帧补帧时正常执行所有结算逻辑（产量、Affector、Story 触发等）
- 补帧期间**不触发 active 类型 Story**（仅被动积累）

## 剧情播放流程

### Active Story（主动触发）

```
UI 检测 story 可用
  → 玩家点击触发
    → UIController.startStory(storyId)
      → 检查 triggerCondition
      → 进入 story 播放模式
        → 逐页展示 pages[]
        → 如有 choices → 展示选项 → 执行对应 effects
        → 每页文本 + sendText 渲染为 MomoTalk 聊天风格
        → 末页结算 → mutation.completeStory(storyId)
          → eventBus.emit('storyCompleted')
```

### Passive Story（被动触发）

```
TickSystem 每帧检查
  → 筛选当前 Init 可用的 passive story
    → triggerCondition 满足
    → 冷却完毕
    → 排除已完成的（非 repeatable）
  → 按 weight 加权随机选择
  → 自动推送 story 到 UI（不需要玩家触发）
```

## MVC 数据流

```
┌──────────┐        ┌──────────┐        ┌──────────┐
│  Model   │  ←───  │   View   │  ←───  │Controller│
│ (Engine) │        │  (DOM)   │        │ (UI)     │
└────┬─────┘        └──────────┘        └────┬─────┘
     │                                       │
     │  EventBus event                       │  player action
     │  → TriggerSystem                      │  → game.method()
     │  → StatsService                       │  → save/load
     │                                       │  → render()
     │  自动存档 ←───────────────────────────│
     │                                       │
     └─── refreshLight() 每秒更新数值 ───────┘
```

UIController 同时承担 Controller 和 View 的职责，直接操作 DOM。

## 揭示系统 (Reveal)

每个实体可配置 `reveal: RevealDef`，定义三个阶段：

```typescript
interface RevealDef {
  name: ConditionGroup;      // 何时揭示名称
  utility: ConditionGroup;   // 何时揭示功能/数值
  effect: ConditionGroup;    // 何时揭示效果
}
```

UIController 通过 `computeRevealFingerprint()` 定期检查揭示状态变化，变化时重建 UI。

## 开发日志 (DevLog)

`devLog` 作为全局变量注入 window，提供快速的游戏状态调试入口：

```typescript
window.devLog.state   // → PlayerState 快照
window.devLog.stats   // → StatsSnapshot
window.devLog.save    // → 导出存档 JSON
window.devLog.reset   // → 重置游戏
```
