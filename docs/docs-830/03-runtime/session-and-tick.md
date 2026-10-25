# docs-830/03-runtime/session-and-tick — 会话与 Tick

本文回答：游戏开始后，自动推进由谁调度，每个 Tick 做什么。

## 会话调度

`SessionService` 管理运行标志和定时器。开始会话时，它处理可用的离线进度，然后按一秒间隔调用注入的 `GameInstance.tick()`；停止会话会清除定时器。`GameInstance` 将 `start()`、`stop()` 和 `tick()` 作为产品 Runtime 的门面。

恢复存档时，存档时间戳作为离线收益起点；开始会话时最多补算 8 小时，产出耗尽时可以提前结束补算。重复调用 `start()` 不会再创建第二个定时器。

## 单次 Tick

```text
SessionService → GameInstance.tick() → TickSystem
  → 推进帧数、计算资源产出、提交资源变化、发布 Tick / 产出事件
```

`TickSystem` 通过 `GameNumSystem` 计算资源产出，并经状态写入接口提交变化。Tick 完成后发布帧事件；`SessionService` 随后同步效果引擎状态并刷新事件队列。其他业务命令也可能在 Tick 之外改变状态。

`GameInstance.tick()` 在 `TickSystem` 之后还会应用活动 Affector、同步 EffectEngine 状态、复检被阻断的学生对话，并记录统计帧。可见性由相关事件增量更新，不会每帧全量重算。因此 Tick 是一组明确的周期性工作入口，事件响应仍由各自订阅者完成。

关键源码：`src/engine/runtime/session-service.ts`、`src/engine/system/tick-system.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`。相关测试见 `tests/engine/tick-system.test.ts`。

继续阅读：[[docs/docs-830/02-data-and-state/state-and-events]]、[[docs/docs-830/04-presentation/read-model-and-ui]]。
