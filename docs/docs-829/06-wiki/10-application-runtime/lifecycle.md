# 06-wiki/10-application-runtime/lifecycle — Lobby、Init 与会话生命周期

> 本文回答：内容装入后为什么先停在 Lobby，玩家何时进入 Init 并开始 Tick？

**Lobby** 是尚未进入世界线的界面状态；此时没有活动 Init，也不运行 Tick。**Init** 是一条世界线定义以及玩家在该线上的当前进度。选择新 Init、恢复已有 Init 和从存档加载，都属于不同入口。

## 从 Lobby 开始游戏

首次浏览器启动会先把启用包装入 Runtime。游戏 UI 的 Apply target 显式以 `enterDefaultInit: false` 重载，因此加载完仍停在 Lobby。这个选择也由 `tests/engine/arona-runtime-pack.test.ts` 验证：默认包装载后 `activeInit` 为空，`running` 为 false。

玩家选择新游戏时，`UIController.startNewGame(initId)` 先向 Runtime 命令层请求创建新进度；成功后切换到游戏界面并调用 `commands.start()`。选择恢复时，`resumeInit(initId)` 先执行重启/快照恢复命令，再调用 `start()`。两条路径都由 UI Controller 发起，底层 Init 状态由 `InitService` 协调，Tick 定时循环则通过 `GameInstance.start()` 交给 `SessionService`。

```text
浏览器首次启动
  → restore PackManager → applyEnabledPacks()
  → load Registry → Lobby（没有 active Init，未 start Session）

新游戏：UIController.startNewGame(initId)
  → Runtime commands.startNewGame(initId)
  → commands.start() → GameInstance.start() → SessionService

恢复已有 Init：UIController.resumeInit(initId)
  → restartInit() / resumeInit(initId)
  → commands.start() → GameInstance.start() → SessionService
```

`SessionService` 的 `doTick` 回调在 `runtime-wiring.ts` 接到 `GameInstance.tick()`。所以，“创建/接线 SessionService”“进入 Init”“开始会话”和“每帧执行 tick”是四个不同动作。完整启动与调用关系见 [[docs/docs-829/01-architecture/run-logic]]。

## 几种重建入口不相同

| 操作 | 主要入口 | 作用边界 |
| --- | --- | --- |
| 应用启用包 / 重载定义 | `AronaClickerRuntime.applyEnabledPacks()`、`GameInstance.reload()` | 停止会话、重建 Registry 与机制，再按选项初始化；Lobby 中重载仍留在 Lobby |
| 新建或恢复 Init | UI Controller 命令、`InitService` | 建立或恢复一条世界线的当前状态；成功后 UI 再启动会话 |
| 存档保存 / 读档 | `GameInstance.save()` / `load()` | 导出或恢复玩家进度及支持恢复的运行态内容；读档会重建相关派生状态 |
| 重置 | `GameInstance.reset()`、`runtime-reset.ts` | 停会话并清除玩家运行状态和相关缓存 |
| 停止 / 释放 | `GameInstance.stop()` / `dispose()` | `stop()` 结束 Tick 会话；`dispose()` 还释放局内服务 |

切换区域不是重载 Registry；停会话也不自动等于清空存档或清除所有局内数据。状态归属详见 [[docs/docs-829/03-data-structures/player-state]]，写入边界见 [[docs/docs-829/04-mechanisms/state-mutation]]。

## 源码与测试

- 浏览器启动选项：`src/ui/main.ts`、`src/arona-clicker/runtime.ts` 的 `createPackApplyTarget()`。
- 新游戏 / 恢复的 UI 调用：`src/ui/controller.ts` 的 `startNewGame()`、`resumeInit()`。
- Init、存档和重置门面：`src/arona-clicker/runtime-game-instance.ts` 的 `init()`、`save()`、`load()`、`reset()`。
- 会话接线：`src/arona-clicker/runtime-wiring.ts` 中 `SessionService` 的 `doTick` 回调；`start()` / `stop()` 见 `runtime-game-instance.ts`。
- 指定测试验证首次包应用保持 Lobby、包库快照恢复和应用恢复；本 Unit 未逐项执行或审查所有 Init、旅行及存档测试。
