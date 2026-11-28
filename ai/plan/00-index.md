# ai/plan — 当前计划入口

历史 Task 与阶段 Prompt 已归档至 `ai/archive/history.zip`。按 [[ai/archive/README]] 列目录或读取所需条目；归档中未完成 Task 保留归档时的原状态，不代表验收通过。

## 当前活动 Task

| Task | 状态 | 下一步 |
| --- | --- | --- |
| [[ai/plan/task-0439-datapack-pipeline-convergence]] | 待处理 | 后续管线。原文件保存及适用的 M03 成果就绪后迁移生产消费者 |
| [[ai/plan/task-0438-datapack-source-save]] | 待处理 | 后续作者工具。首批交付及 M04 草稿就绪后验证同文件两实体写回 |
| [[ai/plan/task-0437-datapack-layout-tools]] | 待处理 | 首批交付 3/3。独立编辑器与 CLI 实际接入预览和副本输出 |
| [[ai/plan/task-0436-datapack-layout-transform]] | 待处理 | 首批交付 2/3。复用共同计划先交付拆合，再接快速层级化 |
| [[ai/plan/task-0435-datapack-multifile-source]] | 待处理 | 首批交付 1/3。固定实物输入，沿现有解析补多文件来源 |
| [[ai/plan/task-0434-workspace-scrollbar-framework]] | 待处理 | 定义公共悬浮滚动条 controller 与列内容更新通知，再接入 Area/Directory |
| [[ai/plan/task-0433-editor-modal-workbench-style]] | 待审核 | 确认是否继续对 Story workspace 默认堆 OOM 做 heap snapshot 归因 |
| [[ai/plan/task-0432-editor-entity-relations]] | 待处理 | 按现有引用规则核对首批关系字段，编制读取、定位与编辑覆盖矩阵 |
| [[ai/plan/task-0429-prototype-architecture-blueprints]] | 待验收 | 评审作者服务与各原型的构造设计。R1/R2/R5 已有施工草案，R8 玩法可单独确认 |

原型调查与设计入口：[[ai/plan/task-0429-prototype-architecture-blueprints]]、[立项范围](../../docs/prototype-blueprints/scope-brief.md)、[蓝图目录](../../docs/prototype-blueprints/README.md)、[[ai/guide/prototype-blueprint-workflow]]。

## 已归档 Task

Task 0431 已统一目录位置、路径与实体操作，覆盖三个生产 Explorer 和 Story 管理中的目录树。实施与验收见归档条目 `ai/plan/task-0431-editor-explorer-placement-actions.md`。

Task 0430 已完成 Datapacks、Storys、IAS 的公共 Explorer 迁移与实例聚焦接线。实施与验收记录见归档条目 `ai/plan/task-0430-advanced-editor-explorer-unification.md`。

本次集中归档包括 Task 0369、0371、0373、0374、0383–0386、0421–0427、已先行归档的 0428，以及 `upper-chat-tasks/` 中的总体合同和施工原文。Workbench 收敛按既定顺序完成；Task 0383–0385、0369、0371、0373、0374 归档时仍含待验收/待复测事项，保持原状态冻结，之后如需恢复，应先从归档读取并复核当前源码。

## 仍保留的调查和设计资料

- 跨 Init 状态 Affector 调查与批量 Init 范围设计已随对应 Task 历史归档至 `ai/archive/history.zip`。
- [[ai/plan/report-engine-performance-2026-11-12|引擎性能报告]]。
- `report-advanced-editor-framework-roadmap-baseline.md` 已随 Workbench 历史归档。
