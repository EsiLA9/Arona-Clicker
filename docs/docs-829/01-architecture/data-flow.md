# 01-architecture/data-flow — 定义、状态与 UI 投影

> 本文回答：Datapack 定义、玩家运行状态、派生计算和 UI 查询视图怎样分工。

## 四种不同数据

```text
Datapack definitions → Registry
PlayerState ──────────┐
Visibility / Stats ───┼→ GameView / GameReadModel → UIContext → Components
Story / Affector ─────┘
```

- **定义**描述游戏可用内容，来源包括正式内容包和导入数据包，由 `Registry` 形成查询表及索引。
- **玩家状态**记录解锁、资源、等级、阅读记录等运行进度；字段按 global、per-Init 快照、per-Init 当前归属。
- **派生结果**由 Engine 系统从定义和状态计算，可经事件定向更新或重建，不默认写入存档。
- **UI 投影**由 Runtime `getView()` 和 `GameReadModel` 提供；`UIContext` 进一步组合组件需要的格式、主题和表现查询。

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
