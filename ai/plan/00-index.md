# ai/plan — 当前计划入口

需要持久管理、交接或跟踪的工作，以 Task 为单位放入本目录；创建、执行及收尾见 [[ai/guide/task-workflow]]。普通小需求可直接处理，无需为流程额外建档。

## 活动 Task

| Task | 状态 | 当前进度或下一步 |
| --- | --- | --- |
| [[ai/plan/task-0338-startup-performance-and-progress]] | 待处理 | 已核对启动链路；先测分段耗时，再优化瓶颈并补真实进度、慢阶段与失败反馈 |
| [[ai/plan/task-0333-semantic-columns-and-workspace-composition]] | 代码/自动化验收通过 | 全量内容/对应调用迁移及 F1–F4 补齐；整合 918 项通过，视觉按用户要求暂缓 |
| [[ai/plan/task-0334-unified-workspace-column-structure]] | 代码/自动化验收通过 | 全部调用方统一结构与公共样式；整合 918 项通过，待实际桌面视觉验收 |
| [[ai/plan/task-0336-story-node-properties-and-safe-projection]] | 代码/自动化验收通过 | 属性面板矩阵、草稿缓存与安全投影闭环；新增 7 项属性 UI 测试，类型/架构/文档/构建通过；全量仅余与本任务无关的 gameplay-b 在飞失败，待浏览器视觉验收 |

创建或分派 Task 时添加其链接；关键进展、受阻或完成时更新本表。表格用于快速定位，详细文件、结果和验证以 Task 正文为准。完成或归档后从活动列表移除，保留其他调查报告和资料。

## 最近完成

- [[ai/archive/plan/task-0337-story-run-flags-and-node-gates]]：Entry 局部 Map、四类节点单键存在条件、初始投入与存档/编辑器闭环；22 文件、163 项通过，未做浏览器验收。
- [[ai/archive/plan/task-0335-story-editor-e0]]：Story Editor E0 原型已交付；独立三栏与本地草稿闭环，全 UI 103 文件、939 项通过；按用户要求不做浏览器验收。

## 调查资料

- [[ai/plan/report-0333-completion-audit-2026-10-28]]：0333 初次独立复核与五项失败复现；后续 F1–F4 已补齐，最新验收以 0333 / 0334 Task 为准。
- [[ai/plan/report-gameplay-b-test-alignment-2026-10-29]]：Gameplay B 样例地图演进后 25 项陈旧测试的对齐修复；生产代码与 Registry 校验未放宽，全量 3491 项通过。

- [[ai/archive/plan/task-0331-wiki-map-and-world]]：本轮 Wiki 编写结果与验证记录；三项定向测试失败原因待后续厘清。
- [[ai/plan/report-wiki-map-and-module-audit-2026-10-28]]：Area Map、MapRun、角色训练与其他模块的 Wiki 缺口和编写顺序。
- [[ai/plan/report-area-map-wiki-2026-10-28]]：世界区域导航地图的专门调查与 Wiki 补写范围。
- [[ai/plan/report-wiki-830-coverage-2026-10-28]]：项目地图与现行 Wiki 的覆盖调查及候选编写范围。
- [[ai/plan/report-map-entry-css-structure-2026-10-28]]：地图准备页（MapEntry）CSS 结构调查，及其与通用工作区结构 CSS 的差异与风险。

此前计划已整体归档至 [[ai/archive/plan/00-index]]。归档状态反映各文档最后记录，不表示仍在推进。
