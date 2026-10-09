# 工作文档冻结清单（2026-10-08）

本批按用户要求将 `docs/plan-work/` 根目录现有 Draft / Task 冻结并移入 `archive/`，为重新组织玩法 B 原子场景规划腾出活动区。归档保留最后已知状态，不代表工作完成、方向撤销或施工结果已验收。

| 文档 | 冻结时最后已知状态 |
| --- | --- |
| [[draft-0231-b]] | 2026-10-05 已完成审阅并转制为 [[task-0232]]；Draft 保留设计来源，不证明 UI 已实现。 |
| [[draft-0231-gameplay-b-original-demo-activity-and-battle-round]] | 原始 `prototypes/gameplay-b/` 活动/战斗事实索引，记录源码和定向测试；它描述独立 Demo，不是 AC 当前移植规格。 |
| [[task-0232]] | in progress；U0–U3、当前机制文档、自动化验证与 GALHCG 已完成；Edge 实际流程和现场键盘验收仍待完成。 |
| [[task-0234-gameplay-b-demo-card-surface]] | in progress；U0、U1/U2 和独立严格审查已完成；Edge 常规/窄视口、键盘验收及最终 GALHCG 写后核验仍未闭环。 |
| [[archive/task-0236-gameplay-b-typed-action-cards-and-target-layers]] | in progress；U0/U1 实施、独立审查及 IAB 常规/窄视口验收已完成；Edge 实测仍待完成。拆出的 Unit / Receipt 也随 Task 一并归档。 |
| [[task-0237-event-bus-flush-exception-recovery]] | proposed；尚未修改产品代码。 |
| [[task-0238-remove-stale-architecture-check-exemptions]] | proposed；尚未修改架构检查脚本。 |
| [[task-0239-base-free-abydos-student-spot]] | in progress；U0、定向测试、类型检查与 GALHCG 已完成；`check:docs` 仍待修复并行 `first-read.md` 的范围外 R1 后重跑。 |
| [[task-0240-gameplay-b-operation-card-presentation-and-action-targeting]] | in progress；U0 候选隔离、U1 学生牌/战术牌面、U2 Hover/focus 目标线已实施；定向测试与类型检查通过，浏览器验收尚未执行。 |
| [[task-0249-gameplay-b-operation-workspace-panels-and-map-popup]] | 实现、定向 UI 测试和类型检查已完成；实际视口布局与遮挡检查仍待人工验收。 |
| [[task-0250-galhcg-node-extraction-and-responsibility-aggregation]] | active；已裁定节点整理方向并交 Luna 子代理施工，主代理复核尚未完成。冻结时不把提取结果视为完成或当前事实；后续按源码重新核证。 |

冻结时没有活动 Goal Set 文件（`goalsets/` 仅含稳定 `README.md`），当前 Codex Goal 也为空。此前已归档的 Task 0245–0248 不属于本批根目录活动文件；其正文仍是历史来源，不能替代源码核查。

本批新规划以 `gs-20261008-gameplay-b-atomic-scenes` 为可删除 Goal Set；五阶段 Goal Card 及正式 Draft / Task 在活动根目录中有各自入口。任何 proposed 状态仍需按 Draft → Task 门槛及人类优先级裁定后才能进入施工。
