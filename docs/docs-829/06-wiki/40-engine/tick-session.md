# 06-wiki/40-engine/tick-session — 帧结算与会话

TickSystem 完成单帧产出结算，SessionService 管理自动帧循环和启动时离线追赶。

## 职责拆分

`TickSystem` 不创建 interval；它递增帧计数、读取 GameNum 的每资源产出、通过 mutation 入账并发事件。`SessionService` 持有运行标记、interval 和上次 Tick 时间，通过注入的 `doTick` 委托宿主帧逻辑。这样单帧结算和自动调度是不同职责。

## 自动与离线运行流

```text
SessionService.start
  → 按存档时间计算离线帧（最多 8 小时，超过 5 帧才补算）
  → doTick 重复结算，产出为空时提前停止
  → 每秒 interval 调用 doTick
  → 更新 EffectEngine 状态并 flush EventBus
```

`stop()` 清除 interval 并更新基准时间。读档恢复可通过 `setLastTick()` 保留时间戳用于下一次启动追赶；普通停止再启动则不会补算暂停期间。

## 静态与运行时关系

静态上，SessionService 依赖 Tick 间隔常量、事件总线、EffectEngine 与宿主回调类型；它不直接依赖 TickSystem 类。运行时宿主把 `doTick` 绑定到单帧处理并提供状态读取。此回调关系不应画成 SessionService import/创建 TickSystem。

测试：`tick-system.test.ts` 覆盖每帧结算和事件；`session-service.test.ts` 覆盖存档时间戳与 stop/start 基准。帧计数直接写入状态的问题见 [[docs/docs-829/04-mechanisms/engine/production]]。

[[docs/docs-829/04-mechanisms/engine/production]] · [[docs/docs-829/06-wiki/40-engine/00-index]]
