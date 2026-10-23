# 06-wiki/40-engine/tick-session — 单帧结算与自动会话

TickSystem 结算一帧的游戏产出；SessionService 决定自动循环何时启动、停止，以及重新加载后是否补算离线帧。两者分开，便于手动单帧调用与定时调度复用相同结算逻辑。

## 单帧怎样结算

`TickSystem.tick()` 当前顺序如下：

1. 直接把 `TickState.totalFrames` 加一。
2. 遍历 GameNum 已登记的资源，调用 `evaluateResourceGain(resource, state)`；每种资源在该帧求一次聚合产出。
3. 只对正产出调用 `StateMutationPort.changeResource()` 入账。该写入先更新资源并发 `resourceChanged`；TickSystem 随后发汇总的 `spotProduced`，其中 `spotId` 为空。
4. 所有资源处理完成后发 `tick` 事件，并返回帧号与本帧产出列表。

因此事件顺序是：帧计数 → 资源写入和对应 `resourceChanged` → 汇总 `spotProduced` → `tick`。产出不是逐 Spot 分别入账，也不由 TickSystem 自己重新构建 GameNum 数值树。相关测试：`tests/engine/tick-system.test.ts`。

## Session 怎样调度

`SessionService.start()` 先处理读档时间戳对应的离线进度，再启动每秒一次的 interval。离线补算上限为 8 小时；不足 6 帧时不补算，达到阈值时逐帧调用注入的 `doTick`，遇到返回空产出列表便提前结束。自动 interval 每次调用 `doTick()` 后同步 EffectEngine 的当前状态并执行 `EventBus.flush()`。产品 Runtime 把 `doTick` 接到 `GameInstance.tick()`，见 `src/arona-clicker/runtime/runtime-wiring.ts`。

`stop()` 清除 interval 并把当前时间设为新的基准；所以普通 stop/start 不补算暂停时长。读档恢复调用 `setLastTick()`，下一次 start 才会根据存档时间补算。测试 `tests/engine/session-service.test.ts` 覆盖读档时间戳与普通停止重启的差别。

## 写入边界审查记录

资源变化通过 `StateMutationPort` 写入；帧号则由 `TickSystem.tick()` 直接执行 `state.totalFrames += 1`。这是已观察到的写入边界，但本页不将它判为缺陷：`docs/docs-829/05-conventions/architecture-discipline` 明确要求按状态类型、Port 契约和测试裁定，不能仅由通用写入规则推断它是违规或批准例外。此项仍待项目裁定；本轮 Receipt 不给它 P0–P3 严重度。

## 继续阅读

GameNum 的资源树和缓存失效：[[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]。EventBus 派发与 Trigger 响应区别：[[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]]。端口定义：[[docs/docs-829/03-data-structures/engine-contracts]]。生产结算权威机制页：[[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/production]]；返回 [[docs/docs-829/06-wiki/40-engine/00-index]]。
