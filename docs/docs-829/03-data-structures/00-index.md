# 03-data-structures/00-index — 数据结构入口

> 本文按主要定义与运行数据对象路由；字段和类型以 `src/` 契约为准。

| 主题 | 文档 | 源码入口 |
| --- | --- | --- |
| PlayerState 与三层归属 | [[docs/docs-829/03-data-structures/player-state]] | `src/arona-clicker/types/state.ts`、`src/arona-clicker/state/` |
| Registry 表、查询索引 | [[docs/docs-829/03-data-structures/registry]] | `src/data-services/registry/registry.ts` |
| Datapack 汇总契约 | [[docs/docs-829/03-data-structures/datapack-contracts]] | `src/data-services/contracts/` |
| GameView / UI 查询投影 | [[docs/docs-829/03-data-structures/game-view]] | `src/arona-clicker/contracts/`、`read-model/` |
| Gameplay B Operation UI 投影 | [[docs/docs-829/03-data-structures/operation-view]] | `src/arona-clicker/contracts/operation-view.ts`、`services/operation-view-projector.ts` |
| 声明式机制类型 | [[docs/docs-829/03-data-structures/engine-contracts]] | `src/engine/types/`、`src/engine/contracts/` |

功能之间如何交互见 [[docs/docs-829/06-wiki/00-index]]；字段同步步骤见 [[docs/docs-829/05-conventions/schema-sync]]。
