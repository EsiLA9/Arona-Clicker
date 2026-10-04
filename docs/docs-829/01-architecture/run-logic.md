# 01-architecture/run-logic — 启动、会话与 Tick

> 本文回答：游戏从 UI 启动到内容装载、进入世界线和运行会话时，各入口如何协作。

## 应用启动

`src/ui/main.ts` 创建 `AronaClickerRuntime`，恢复包管理器快照，应用默认启用包，再构造并挂载 `UIController`。默认包从 `src/arona-clicker/content/default-datapack.ts` 进入产品内容目录；测试示例包不是正式默认内容。

```text
src/ui/main.ts
  → src/app/runtime-bootstrap.ts:createAppRuntime()
  → AronaClickerRuntime / PackManager
  → applyEnabledPacks()
  → GameInstance.init(datapacks)
  → Registry.load() / 跨表核验 / 系统状态接线
  → UIController.mount()
```

## Runtime 装配

`GameInstance` 在 `src/arona-clicker/runtime-game-instance.ts` 提供产品门面和生命周期入口；`src/arona-clicker/runtime-wiring.ts` 创建并连接 EventBus、Registry、表达式、状态写入、效果、派生系统和产品服务。装配顺序表示依赖创建关系，不是单次操作的执行顺序。

## Lobby、Init 与会话

默认 UI 启动应用启用包后保持 Lobby，`activeInit` 为空，不启动 Tick。选择或恢复 Init 后，Runtime 执行状态建立/恢复、系统接线和会话启动。Init 切换、重启、读档和重置通过 Runtime 生命周期入口清理并重建相应运行态；完整产品边界由 `src/arona-clicker/runtime-game-instance.ts` 与 `runtime-reset.ts` 实现。

## Tick 和事件

`SessionService` 调用宿主 `doTick`，管理定时会话和事件队列 flush；`GameInstance.tick()` 组织 `TickSystem`、持续效果、复检和统计。`TickSystem` 使用 GameNum 计算每帧资源产出，通过状态写入 Port 入账并发出生产与 Tick 事件；订阅者更新响应式派生系统。

帧计数 `totalFrames` 当前在 `TickSystem` 直接递增；它与产品状态写入口纪律之间的边界单独记录在 [[docs/docs-829/05-conventions/architecture-discipline]]，本页不将其预裁定为通用写入规则的例外。

## 继续阅读

- 状态层次：[[docs/docs-829/03-data-structures/player-state]]。
- 数据流：[[docs/docs-829/01-architecture/data-flow]]。
- Runtime 与领域服务：[[docs/docs-829/06-wiki/10-application-runtime/00-index]]、[[docs/docs-829/06-wiki/30-arona-clicker-domain/00-index]]。
