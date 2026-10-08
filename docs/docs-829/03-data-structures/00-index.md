# 03-data-structures/00-index — 数据结构入口

> 本文按主要定义与运行数据对象路由；字段和类型以 `src/` 契约为准。

第一次阅读时，可以按“内容定义 → 查询登记表 → 玩家进度 → UI 查询结果”的顺序走：Datapack 是作者声明的内容，Registry 是运行时整理后供服务查询的定义表，PlayerState 记录玩家进度，GameView 把当前状态与派生结果整理成 UI 可读的视图。后面的页面分别说明这四层，不要把它们当作同一份数据。

| 主题 | 文档 | 源码入口 |
| --- | --- | --- |
| PlayerState 与三层归属 | [[docs/docs-829/03-data-structures/player-state]] | `src/arona-clicker/types/state.ts`、`src/arona-clicker/state/` |
| Registry 表、查询索引 | [[docs/docs-829/03-data-structures/registry]] | `src/data-services/registry/registry.ts` |
| Datapack 汇总契约 | [[docs/docs-829/03-data-structures/datapack-contracts]] | `src/data-services/contracts/` |
| GameView / UI 查询投影 | [[docs/docs-829/03-data-structures/game-view]] | `src/arona-clicker/contracts/`、`read-model/` |
| Gameplay B Operation UI 投影 | [[docs/docs-829/03-data-structures/operation-view]] | `src/arona-clicker/contracts/operation-view.ts`、`services/operation-view-projector.ts` |
| 声明式机制类型 | [[docs/docs-829/03-data-structures/engine-contracts]] | `src/engine/types/`、`src/engine/contracts/` |

如果你在追查某个游戏功能如何使用这些对象，从 [[docs/docs-829/06-wiki/00-index]] 按功能阅读；写入顺序见 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]。字段同步步骤见 [[docs/docs-829/05-conventions/schema-sync]]。
