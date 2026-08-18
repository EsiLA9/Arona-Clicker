# 04 — Init Lifecycle 世界线生命周期

---

## 1. 启动流程（Boot）

**入口**：[[src/main.ts]]（引擎） / [[src/ui/main.ts]]（UI）

```
浏览器加载
  └─ src/main.ts
       ├─ new GameInstance()              构造全部子系统
       ├─ game.init([baseDatapack])       加载数据包 → 进入默认 Init
       ├─ SaveSystem.load()               有存档 → game.load()；无存档 → 解锁首个免费 Init
       └─ game.start()                    启动 1 秒/帧 定时器
  └─ src/ui/main.ts（独立入口，src/ui/index.html）
       ├─ new GameInstance()  + init
       ├─ new UIController(game, root).mount()
       └─ 挂 window.__game / window.__ui 供调试
```

两个入口各建一个 GameInstance：
- `npm run dev`（根入口，纯引擎 + 控制台日志）
- `npm run dev:game`（UI 入口，带完整界面）

### game.init() 关键步骤

1. 加载所有数据包到 Registry
2. 加载 AffectorPack / TriggerDef
3. 同步子系统（valueSystem / funcletExecutor / effectEngine / tickSystem）
4. GameNumSystem.buildAll()（构建所有资源的 gain 树）
5. 加载角色系统
6. 计算可见性
7. 进入默认 Init（无 existence 门槛的那个）

---

## 2. 帧循环（Tick）

**文件**：[[src/engine/tick-system.ts]]

`TICK_INTERVAL_MS = 1000`。[[src/engine/game-instance.ts]] `start()` 用 setInterval 每帧调用 `tick()`。

### tick() 完整流程

```
tick()
  ├─ state.totalFrames += 1
  ├─ GameNumSystem.evaluateResourceGain()    按 GameNum 统一结算各资源产出
  │   └─ mutations.changeResource()          扣/加资源
  │       └─ EventBus.emit('spotProduced')   产出事件
  ├─ AffectorEngine.applyActiveEffects()     全量重估条件，执行非 addResource 效果
  ├─ EffectEngine.setState()
  ├─ VisibilityEngine.compute()              重算可见性快照
  ├─ StatsService.recordTick()               三层帧统计
  ├─ DevLog.recordTick()
  └─ EventBus.flush()                        在 start() 的 setInterval 内调用
```

### 离线收益

`start()` 时按离线的秒数补算，上限 8 小时（28800 帧），产出耗尽提前终止。

**实现位置**：[[src/engine/game-instance.ts]] `processOfflineProgress()`

---

## 3. 世界线（Init）生命周期

### 状态转换

```
初始 → startNewGame(initId)     全新 per-Init 状态，进入
     → resumeInit(initId)       有快照则恢复，无快照则全新
     → restartInit()            保存当前 Init 全量快照 → 清 per-Init → 回世界线选择
     → hardRestartInit()        删除快照 → 清 per-Init → 回世界线选择（下次进入全新）
     → hardResetInit(id)        从选择页删除某 Init 快照
     → reload(datapacks)        运行时整体替换数据包（导入 Mod 用）
```

### enterInit(initId) 关键步骤

**实现位置**：[[src/engine/game-instance.ts]]

1. 清理不属于当前 Init 的非 global Spot 持有状态与 Manager
2. 记录 `visitedInits`（首次进入判定）
3. `statsService.beginSession()`（本次游玩统计起点）
4. 挂载该 Init 专属 Trigger（`mountInitTriggers`）
5. 定位到默认 Area，解锁 defaultSpots（level=1）
6. 自动展开 `startStoryId`（active 剧情）
7. 执行 `enterEffects`（Entry，支持 first / condition）
8. 重算可见性

### startNewGame(initId)

1. 检查 Init 是否存在、是否已购买
2. `stop()` 停止帧循环
3. 保存跨 Init 数据（unlockedInits / globalResources / global Spot）
4. 重置为默认状态
5. 恢复跨 Init 数据
6. 注入 Extra 底座（全局常量表 + per-Init InitDef.extra）
7. 进入 Init

### restartInit()（软重启）

1. 保存当前 Init 全量快照到 `initSnapshots[initId]`
2. `stop()` + 清 per-Init 状态
3. 保留 unlockedInits 和 stats

### hardRestartInit()（硬重启）

1. 删除当前 Init 的快照
2. `stop()` + 清 per-Init 状态
3. 重建 per-Init extras（InitDef.extra 重新注入）

### resumeInit(initId)

1. 有快照 → 恢复全部 per-Init 进度
2. 无快照 → 全新开始
3. 同步子系统，`beginSession()`
4. `enterInit(initId)`

---

## 4. 快照保存/恢复

### 保存快照

`savePerInitSnapshot(initId)`：将 PlayerState 中的 Init 局部字段保存到 `initSnapshots[initId]`。

包含：resources / spotLevels / spotManagers / visitedAreas / storyCooldowns / totalFrames / inventory / unlockedEnhancements / storyLog / flags / triggersCompleted / currentAreaId / extras

**global Spot**（`SpotDef.global=true`）的等级/管理角色不写入快照（跨世界线保留）。

### 恢复快照

`restorePerInitFromSnapshot(snapshot)`：将快照中的 Init 局部字段恢复到 PlayerState。

### 清空 per-Init 状态

`clearPerInitState()`：重置所有 Init 局部字段为默认值，但保留 global Spot。

---

## 5. 移动 Area

**实现位置**：[[src/engine/game-instance.ts]] `travelToArea()`

### 门槛链

**存在 → 同 Init → 非演出锁定 → 相邻 → 可见**

1. 目标 Area 必须存在
2. 必须属于当前 Init
3. 非 passive 剧情演出进行中（Story 自身要求移动时放行）
4. 与当前位置相邻（或当前位置为空时任意可达）
5. 目标 Area 必须可见（existence 门槛满足）

### 进入 Area 时

1. 打断正在播放的 PassiveStory
2. 记录 `visitedAreas`（首次进入判定）
3. 解锁 `defaultSpots`（level=1）
4. 记录统计 `recordAreaEntered`
5. emit `areaEntered` 事件
6. 执行 `enterEffects`
7. 重算可见性
8. AffectorEngine.recheckAll()

---

## 6. 存档

**文件**：[[src/save/storage.ts]]

- 保存：`game.save()` → `SaveSystem.save()`（localStorage，key `acprogram_save`）
- 读取：`game.load()` 做旧档兼容迁移
- 页面关闭（`beforeunload`）自动存档

### 旧档迁移

- `globalResources` 字段缺失时补空
- `extras` / `initExtras` 字段缺失时补空底座
- 全局资源（青辉石）从 `resources` 迁移到 `globalResources`
- `currentAreaId` 缺失时定位到当前 Init 的第一个默认 Area
