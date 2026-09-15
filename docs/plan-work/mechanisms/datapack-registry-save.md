# 机制聚合：Datapack、Registry 与存档

## 机制范围

- 多 Datapack 的来源、解析、包库、启用集和排序；
- Registry 合并、命名空间、跨包引用与 TagRef；
- 存档残留、惰性恢复、清除和数据包服务工作区。

## 当前事实源

- [[docs/docs-828/02-modules/registry]]
- [[docs/docs-828/03-data-structures/registry]]

## 历史来源与设计理由

| 文档 | 用途 |
| --- | --- |
| [[roadmap-0001-datapack-management]] | S1-S7 实施切片 |
| [[01-registry-plan]] | Registry 与跨包校验 |
| [[02-save-plan]] | 存档、残留与恢复 |
| [[03-rollout-and-acceptance]] | 施工路线与验收矩阵 |
| [[04-service-workspace-plan]] | 数据包/存档工作区交互 |
| [[task-0021-datapack-workspace-repair]] | 数据包工作区修复 |
| [[roadmap-0020-service-workspaces]] | 服务工作区总目标 |

## 当前未完成

Character/Variant 三段式命名空间、完整跨包 dry-run/回滚、文件夹/单文件 Source、惰性存档和通用残留管理仍是 active 计划，不应从“包库 UI 已完成”推断为全部完成。
