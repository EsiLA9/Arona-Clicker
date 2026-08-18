# 01 — 运行逻辑（Run Loop）

## 1. 启动流程（Boot）

```
浏览器加载
  └─ src/main.ts（引擎入口）
       ├─ new GameInstance()              构造全部子系统
       ├─ game.init([baseDatapack])       加载数据包 → 进入默认 Init
       ├─ SaveSystem.load()               有存档 → game.load()；无存档 → 解锁首个免费 Init
       └─ game.start()                    启动 1 秒/帧 定时器
  └─ src/ui/main.ts（UI 入口，独立入口，src/ui/index.html）
       ├─ new GameInstance()  + init
       ├─ new UIController(game, root).mount()
       └─ 挂 window.__game / window.__ui 供调试
```

两个入口各建一个 `GameInstance`：
- `npm run dev`（根入口，`index.html` → `src/main.ts`，纯引擎 + 控制台日志）
- `npm run dev:game`（`src/ui/index.html` → `src/ui/main.ts`，带 UI）

## 2. 帧循环（Tick，1 秒 = 1 帧）

`TICK_INTERVAL_MS = 1000`（`src/engine/tick-system.ts:20`）。

`GameInstance.start()` 用 `setInterval` 每帧调用 `GameInstance.tick()`（`src/engine/game-instance.ts:367`）：

```
tick()
  ├─ TickSystem.tick()             # 帧号 +1；按 GameNumSystem 统一结算各资源产出
  ├─ AffectorEngine.applyActiveEffects()  # 全量重估条件，执行非 addResource 效果
  ├─ EffectEngine.setState()
  ├─ VisibilityEngine.compute()    # 重算可见性快照
  ├─ StatsService.recordTick()     # 三层帧统计
  ├─ DevLog.recordTick()
  └─ EventBus.flush()              # 在 start() 的 setInterval 内调用（事件排队→派发）
```

- 产出结算主路径是 **GameNumSystem**（见 03-§5）：每个资源一棵 `primitiveGain` 树，懒求值。
- 旧路径（无 GameNum 时，单元测试直用）是逐 Spot 结算，逻辑在 `tick-system.ts` 中保留。
- 离线收益：`start()` 时按离线的秒数补算，上限 8 小时，产出耗尽提前终止（`game-instance.ts:459`）。

## 3. 世界线（Init）生命周期

游戏以"世界线"（Init）为单位。`PlayerState` 分两层：**全局层**（跨世界线保留）与 **per-Init 层**（随世界线隔离）。

```
初始 → startNewGame(initId)  全新 per-Init 状态，进入
     → resumeInit(initId)    有快照则恢复，无快照则全新
     → restartInit()         保存当前 Init 全量快照 → 清 per-Init → 回世界线选择
     → hardRestartInit()     删除快照 → 清 per-Init → 回世界线选择（下次进入全新）
     → hardResetInit(id)     从选择页删除某 Init 快照
     → reload(datapacks)     运行时整体替换数据包（导入 Mod 用），清档语义
```

`enterInit()`（`game-instance.ts:495`）关键步骤：
1. 清理不属于当前 Init 的非 global Spot 持有状态
2. 记录 `visitedInits`（首次进入判定）
3. `statsService.beginSession()`（本次游玩统计起点）
4. 挂载该 Init 专属 Trigger（`mountInitTriggers`）
5. 定位到默认 Area，解锁 defaultSpots（level=1）
6. 自动展开 `startStoryId`（active 剧情）
7. 执行 `enterEffects`（Entry，支持 first / condition）
8. 重算可见性

移动 Area：`travelToArea()`（`game-instance.ts:599`）门槛链：
**存在 → 同 Init → 非演出锁定 → 相邻 → 可见**；进入时解锁 defaultSpots、执行 area enterEffects、`affectorEngine.recheckAll()`。

## 4. 存档

`SaveData`（`game-instance.ts:69`）= playerState + visibility + 剧情游标 + 统计。
- 保存：`game.save()` → `SaveSystem.save()`（localStorage，key `acprogram_save`）。
- 读取：`game.load()` 做旧档兼容迁移（globalResources 迁移、extras 底座补齐、currentAreaId 兜底）。
- 页面关闭（`beforeunload`）自动存档。

## 5. UI 刷新（UIController）

`src/ui/controller.ts`。两种刷新路径：

- **轻量刷新** `refreshLight()`：每秒只更新资源数字 / spot 产出的 `textContent`，不重建 DOM。
- **事件驱动重建** `render()`：EventBus 任意非高频事件 → 重算"揭示指纹"
  （所有实体 reveal stage 的拼接串），指纹变化才 `innerHTML` 重建整个 `#app` 并重新绑定事件。

重建副作用处理：聊天流滚动比例捕获/恢复、tooltip 弹层隐藏、事件委托（`bindActions` / `bindPopovers`）。

## 6. 事件驱动数据流（核心思想）

所有状态写入集中在 `StateMutationService`，每个 mutation 固定管道：

```
① 写 PlayerState（自身改变）
② 同步更新 StatsService 三层统计
③ emit 事件到 EventBus（事件携带变更时点的 stats 上下文）
④ 订阅者（TriggerSystem / AffectorEngine / UIController / DevLog）按兴趣判断并执行
```

这保证内容作者只需声明 `TriggerDef`（事件模式 + 条件 + 效果），
不直接接触 EventBus —— "这些触发应该被包装好，不允许被数据包编辑者观察"（AC-Canvas.md）。

## 7. 可知性 → 可达性 → 生效（AccessStage）

所有实体按 `AccessStage` 分层（`types.ts:909`）：`hidden → obfuscated → revealed → accessible → active`。

- **可见性**：`VisibilityEngine` 依据 revealTriggers 的 `existence` 目标。
- **揭示**：UI 依据 reveal 各级 Trigger 展示名称/条件/效用。
- **可达性**：`unlockMet`（解锁条件）在购买/进入/使用前逐层放行。
- **生效**：Affector（每 tick 重估）与 Trigger（事件命中）在运行时执行效果。
