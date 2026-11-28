# ai/plan — 当前计划入口

历史 Task 与阶段 Prompt 已归档至 `ai/archive/history.zip`。按 [[ai/archive/README]] 列目录或读取所需条目；归档中未完成 Task 保留归档时的原状态，不代表验收通过。

## 当前活动 Task

| Task | 状态 | 下一步 |
| --- | --- | --- |
| [[ai/plan/task-0442-datapack-reference-consumers]] | 待处理 | 复用 0440/0441，在文件组织区接作者源查询 |
| [[ai/plan/task-0441-datapack-reference-index]] | 待处理 | 沿 0440 目录抽取共同关系解析，接图鉴和 CLI |
| [[ai/plan/task-0440-datapack-definition-catalog]] | 待处理 | 从实际 ProjectRead 建实体目录并接 CLI find |
| [[ai/plan/task-0439-datapack-pipeline-convergence]] | 待处理 | 后续管线。首批完成后迁实际 Base 导出与工具，正式构建随 M03 |
| [[ai/plan/task-0438-datapack-source-save]] | 待处理 | 后续作者工具。首批交付及 M04 草稿就绪后验证同文件两实体写回 |
| [[ai/plan/task-0434-workspace-scrollbar-framework]] | 待处理 | 定义公共悬浮滚动条 controller 与列内容更新通知，再接入 Area/Directory |
| [[ai/plan/task-0433-editor-modal-workbench-style]] | 待审核 | 确认是否继续对 Story workspace 默认堆 OOM 做 heap snapshot 归因 |
| [[ai/plan/task-0432-editor-entity-relations]] | 待处理 | 复用 M02 核心，推进 Workbench 关系展示、定位和编辑 |
| [[ai/plan/task-0429-prototype-architecture-blueprints]] | 待验收 | 评审作者服务与各原型的构造设计。R1/R2/R5 已有施工草案，R8 玩法可单独确认 |

原型调查与设计入口：[[ai/plan/task-0429-prototype-architecture-blueprints]]、[立项范围](../../docs/prototype-blueprints/scope-brief.md)、[蓝图目录](../../docs/prototype-blueprints/README.md)、[[ai/guide/prototype-blueprint-workflow]]。

## 已归档 Task

Tasks 0435–0437 已验收并归档。首批交付多文件来源读取、拆合和快速层级化、独立编辑器及 CLI。最终回归 9 文件、40 项通过。现行入口见 [包 I/O 与定义来源层](../../docs/docs-830/02-data-and-state/package-io-and-source-layers.md) 和 [独立工具与 CLI](../../docs/docs-830/07-tooling/datapack-editor-and-schema.md)。归档原文按 Task 文件名读取。

Task 0431 已统一目录位置、路径与实体操作，覆盖三个生产 Explorer 和 Story 管理中的目录树。实施与验收见归档条目 `ai/plan/task-0431-editor-explorer-placement-actions.md`。

Task 0430 已完成 Datapacks、Storys、IAS 的公共 Explorer 迁移与实例聚焦接线。实施与验收记录见归档条目 `ai/plan/task-0430-advanced-editor-explorer-unification.md`。

本次集中归档包括 Task 0369、0371、0373、0374、0383–0386、0421–0427、已先行归档的 0428，以及 `upper-chat-tasks/` 中的总体合同和施工原文。Workbench 收敛按既定顺序完成；Task 0383–0385、0369、0371、0373、0374 归档时仍含待验收/待复测事项，保持原状态冻结，之后如需恢复，应先从归档读取并复核当前源码。

## 仍保留的调查和设计资料

- 跨 Init 状态 Affector 调查与批量 Init 范围设计已随对应 Task 历史归档至 `ai/archive/history.zip`。
- [[ai/plan/report-engine-performance-2026-11-12|引擎性能报告]]。
- `report-advanced-editor-framework-roadmap-baseline.md` 已随 Workbench 历史归档。
