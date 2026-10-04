# 04-mechanisms/engine/production — Tick 生产结算

一次 Engine Tick 推进一帧，并按资源汇总结算正向产出。

## 单帧结算

`TickSystem.tick()` 先将 `TickState.totalFrames` 加一，再遍历 `GameNumSystem.getResources()`，对每个资源调用 `evaluateResourceGain(resource, state)`。只有大于零的结果会经 `StateMutationPort.changeResource` 入账，随后发出 `spotProduced`；产出按资源聚合，事件中的 `spotId` 为空。最后发出 `tick` 并返回 `TickResult`。`TICK_INTERVAL_MS` 为 1000 毫秒。

`tests/engine/tick-system.test.ts` 覆盖连续 Tick 入账、未解锁 Spot 不产出、管理角色不改变产出、每帧事件及恢复状态首次结算。生产并非逐 Spot 容量截断，实际资源值由 GameNum 产出树决定。

## 自动会话与离线补算

`SessionService` 持有 interval 与运行状态，通过 `doTick` 回调调用宿主帧逻辑。启动时先按保存的最后 Tick 时间计算离线帧，最多补算 8 小时；不足 6 帧不补算。每次补算后若返回产出列表为空则停止追赶。自动 interval 每秒执行一帧，更新 EffectEngine 当前状态并 flush EventBus。停止时刷新离线基准，普通 stop/start 不会把暂停时长补算为离线进度。`tests/engine/session-service.test.ts` 验证读档基准和停止重启行为。

## 写入纪律待核实

当前 `TickSystem.tick()` 直接递增 `state.totalFrames`，资源写入则走 `StateMutationPort`。Tick 测试验证可观察行为，但尚未证明帧计数属于统一 Mutation 服务管理的状态，也未证明其被明确排除；该边界应结合宿主状态契约进一步裁定。

## 相关页面

[[docs/docs-829/06-wiki/40-engine/tick-session]] · [[docs/docs-829/03-data-structures/engine-contracts]]
