# 01-architecture/data-flow — 定义、状态与 UI 投影

> 本文回答：Datapack 定义、玩家运行状态、派生计算和 UI 查询视图怎样分工。

## 四种不同数据

```text
Datapack definitions → Registry
PlayerState ──────────┐
Visibility / Stats ───┼→ GameView / GameReadModel → UIContext → Components
Story / Affector ─────┘

GameInstance.operationEntry.start(eventId, characterIds)
        ↓ constructor-configured trusted OperationContentResolver
OperationParticipantAdmission (AC Character/Roster/Profile validation)
        ↓ admitted OperationEventDef
private OperationRuntimeService owner → EventRun
        └→ operationEntry.getSnapshot() → detached read-only snapshot
```

- **定义**描述游戏可用内容，来源包括正式内容包和导入数据包，由 `Registry` 形成查询表及索引。
- **玩家状态**记录解锁、资源、等级、阅读记录等运行进度；字段按 global、per-Init 快照、per-Init 当前归属。
- **派生结果**由 Engine 系统从定义和状态计算，可经事件定向更新或重建，不默认写入存档。
- **UI 投影**由 Runtime `getView()` 和 `GameReadModel` 提供；`UIContext` 进一步组合组件需要的格式、主题和表现查询。

Gameplay B 的 `EventRun` 是独立的局内状态 owner，由每个 `GameInstance` 内部私有的 `OperationRuntimeService` 管理。调用方只能经 `GameInstance.operationEntry.start(eventId, characterIds)` 按 ID 请求入场；构造时配置的受信 `OperationContentResolver` 查出事件/Profile 内容，`OperationParticipantAdmission` 在启动 Run 前校验学生的 Character 定义、真实且持有的 Variant、`CharacterSystem.getUnlocked()` 结果与 Profile 配对。校验成功后 EntryService 才把事件定义传给私有 owner。它不写入 `PlayerState` 或 `InitSnapshot`，也不由 `GameView` 投影；`stop()` 保留 Run，`init`、`load`、`reload` 和 `reset` 清除当前 Run，`dispose()` 清除并释放 owner。U1 当前 ActorState 仍只有事件定义中的 Actor ID/type/HP/resources；已准入的 Character、Profile 与 faction 信息尚未进入 EventRun Actor 快照。只读 detached Run 快照经 `operationEntry.getSnapshot()` 读取。细节见 [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]。

## 关键代码入口

| 数据 | 入口 |
| --- | --- |
| 正式产品声明 | `src/arona-clicker/content/default-datapack.ts` |
| 汇总契约 | `src/data-services/contracts/datapack.ts` |
| 定义装载与索引 | `src/data-services/registry/registry.ts` |
| 玩家状态 | `src/arona-clicker/types/state.ts`、`src/arona-clicker/state/` |
| 状态写入 | `src/arona-clicker/state/state-mutation-service.ts` |
| 读模型 | `src/arona-clicker/read-model/game-view-builder.ts` |
| UI 上下文 | `src/ui/context.ts` |

状态归属详见 [[docs/docs-829/03-data-structures/player-state]]；字段写入和跨层规则见 [[docs/docs-829/04-mechanisms/state-mutation]]。
