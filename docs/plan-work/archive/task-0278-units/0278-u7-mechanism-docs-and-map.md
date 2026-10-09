# Unit 0278-U7：当前机制文档与 GALHCG 收尾

## Goal

在 U1–U6 行为与测试稳定后同步唯一当前机制文档，并审查 / 更新直接受影响的 GALHCG Evidence 与 maps_to。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/docs-829/05-conventions/doc-maintenance.md | 当前机制正文与链接规则 |
| 文档 | docs/ai/galhcg-project-map.md | Evidence 与 maps_to 写入流程 |
| 源码 / 测试 | U1–U6 实际变更路径与对应 Receipt | 文档只记录已核实行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 只审查变更路径及相关直接映射 owner |

## Optional Read Set

- docs/ai/context-packs/character.md：仅在 Character Hand 路由需要修改时 |

## Do Not Read by Default

- docs/plan-work/archive/**
- 全库 maps_to 或无关概念 Evidence

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前机制文档为 Operation Runtime；OperationView / Datapack 字段边界分别有数据结构文档。 | docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md；docs/docs-829/03-data-structures/operation-view.md；datapack-contracts.md | 只更新受本 Task 影响处 |

## Constraints

- 只记录源码与测试已验证的行为；不把 Task 或地图摘要当作机制依据。
- 依 GALHCG 要求定向 review_changes、读取版本令牌、预检并写入更新，再做写后检查。

## Allowed Files

- docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md
- docs/docs-829/03-data-structures/operation-view.md
- docs/docs-829/03-data-structures/datapack-contracts.md
- docs/plan-work/task-0278-gameplay-b-unbounded-loop-and-character-autonomy.md
- docs/plan-work/00-index.md
- docs/plan-work/task-0278-units/0278-u7-mechanism-docs-and-map.md
- docs/plan-work/task-0278-units/receipts/0278-u1-receipt.md
- docs/plan-work/task-0278-units/receipts/0278-u2-receipt.md
- docs/plan-work/task-0278-units/receipts/0278-u3-receipt.md
- docs/plan-work/task-0278-units/receipts/0278-u4-receipt.md
- docs/plan-work/task-0278-units/receipts/0278-u5-receipt.md
- docs/plan-work/task-0278-units/receipts/0278-u6-receipt.md
- docs/plan-work/task-0278-units/receipts/0278-u7-receipt.md

## Explicit Non-goals

- 不重写 AI 协作协议或全库地图；不刷新不相关目录。

## Stop Conditions

按 docs/ai/PROJECT-CONSTITUTION.md 停止条件；更新地图前必须读取目标 owner 当前 Evidence 和 maps_to，不可用不完整查询猜测。

## Completion Criteria

- [x] Runtime、View 与 Datapack 当前机制文档描述无上限 / 显式上限、清场与 Scene/Location 分界、Profile / Hand 顺序、单槽干预和长运行存档合同。
- [x] 对每个变更路径调用 review_changes 并按 owner 分页；更新有直接证据且本 Task 改变语义的关系。
- [x] update_map dry-run 有效后提交同批，并用 review_changes / search / traverse 核实。
- [x] check:docs、git diff --check 通过；Task Receipt 记录精确工具范围与验证结果。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 / 结构 | npm run check:docs | 通过 |
| 差异空白 | git diff --check | 通过 |
| 地图 | review_changes + update_map 写后搜索 / 复核 | 结果完整，Evidence token 对应本次实读版本 |
