# docs-830/03-runtime/session-and-tick — 会话与 Tick

本文回答：游戏开始后，自动推进由谁调度，每个 Tick 做什么。

## 会话调度

`SessionService` 管理运行标志和定时器。开始会话时，它处理可用的离线进度，然后按一秒间隔调用注入的 `GameInstance.tick()`；停止会话会清除定时器。`GameInstance` 将 `start()`、`stop()` 和 `tick()` 作为产品 Runtime 的门面。

恢复存档时，存档时间戳作为离线收益起点；开始会话时最多补算 8 小时，若某帧没有生产记录则提前结束补算。重复调用 `start()` 不会再创建第二个定时器。

### 三种推进入口

| 入口 | 触发方式 | 说明 |
| --- | --- | --- |
| 手动推进 | 调用 `GameInstance.tick()` | 单次执行帧逻辑并返回结果，不需要启动定时器。 |
| 自动推进 | `SessionService.start()` 启动一秒间隔 | 每次调用注入的 `doTick()`，随后同步 EffectEngine 状态并 flush 事件队列。 |
| 离线补算 | 恢复的时间基准在启动时处理 | 循环调用相同的 `doTick()`；补算结束后同步 EffectEngine 并 flush。 |

恢复存档通过 `setLastTick()` 保留存档时间作为基准；普通 stop/start 不会把停止前的时间误算成离线时长。测试见 `tests/engine/session-service.test.ts`。

离线秒数向下取整，超过 8 小时截断；当前实现只在计算出的帧数**大于 5**时执行补算。每次补算先实际调用一次 `doTick()`，如果该次返回的 `productions` 为空则提前结束剩余补算；这条判断不等价于对每种原因的精确容量诊断。

## 单次 Tick

```text
SessionService → GameInstance.tick() → TickSystem
  → 推进帧数、计算资源产出、提交资源变化、发布 Tick / 产出事件
```

`TickSystem` 通过 `GameNumSystem` 计算资源产出，并经状态写入接口提交变化。Tick 完成后发布帧事件；`SessionService` 随后同步效果引擎状态并刷新事件队列。其他业务命令也可能在 Tick 之外改变状态。

`GameInstance.tick()` 在 `TickSystem` 之后还会应用活动 Affector、同步 EffectEngine 状态、复检被阻断的学生对话，并记录统计帧。可见性由相关事件增量更新，不会每帧全量重算。因此 Tick 是一组明确的周期性工作入口，事件响应仍由各自订阅者完成。

### 一帧的先后顺序

1. `TickSystem` 先增加 `totalFrames`；对每个注册资源向 GameNum 请求产出。
2. 正产出经状态写入口提交，并发出 `spotProduced`；循环结束后发出携带帧号的 `tick`。产出按资源聚合，结果中的 `spotId` 为空字符串，并非逐 Spot 分条结算。
3. 回到 `GameInstance.tick()`，应用活动 Affector、同步 EffectEngine、重查被阻断的学生对话并记录统计帧。
4. 由自动会话驱动时，定时器回调在 `doTick()` 返回后再同步 EffectEngine 并 flush。手动调用 `GameInstance.tick()` 本身并不包含这一层会话回调。

事件的普通派发是同步的；只有在 EventBus 正在 flush 时再次发出的事件才排入队列，具体语义见 [[event-effects-triggers]]。因此不要把“发布事件”和“每次都等待 Tick 结束才处理”视作等价。

Story 的 typing、thinking、通知间隔和横幅由 `StoryPlaybackCoordinator` 的独立时钟唤醒，与一秒生产 Tick 分开。`GameInstance.stop()/start()` 暂停和恢复剩余表现时间；读档和 Init 恢复也沿此路径继续，不使用离线收益补算跳过表现或替玩家确认。正文送达与 Operation 自动交接不要求 UI 存在，查询或重建 DOM 不推进 Story。执行/表现的状态边界见 [[story-and-effects]]。

关键源码：`src/engine/runtime/session-service.ts`、`src/engine/system/tick-system.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`。相关测试见 `tests/engine/tick-system.test.ts`。

继续阅读：[[state-and-events]]、[[read-model-and-ui]]。
