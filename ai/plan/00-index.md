# ai/plan — 当前计划入口

需要持久管理、交接或跟踪的工作，以 Task 为单位放入本目录；创建、执行及收尾见 [[ai/guide/task-workflow]]。普通小需求可直接处理，无需为流程额外建档。

## 活动 Task

| Task | 状态 | 当前进度或下一步 |
| --- | --- | --- |
| [[ai/plan/task-0352-story-cursor-space-and-history]] | 代码 / 自动化验收完成 | 正式历史、爱心卡片与星野三空间样例已实施；后续取消子结束自动召回，70 项定向及类型 / 架构通过，待浏览器手动验收 |
| [[ai/plan/task-0347-story-context-and-presentation-movement]] | 实施中 | 按裁定扩展 StoryDef、StoryNode、编辑器与重播运行语义 |
| [[ai/plan/task-0348-story-talklet-click-authoring-coverage]] | 实施中 | ID 手写入口与游标 / 内容失配后从 Entry 重启已接入；其它字段覆盖待逐项完成 |
| [[ai/plan/task-0344-story-operation-checkpoints]] | 代码与构建验收完成 | Operation 作者语义已承接到 0345 的 Runtime 队列；对应自动化随 0345 全量通过，浏览器视觉验收未运行 |
| [[ai/plan/task-0343-story-authoring-full-coverage]] | 待审阅，未施工 | 已核对 StoryNode 契约与编辑/保存链路；含入口—含义全覆盖清单、缺口、投放闭环和分组验收，等待审阅 |
| [[ai/plan/task-0342-free-story-flow]] | 代码与静态验收完成 | 自由 nodes 及 Click 衔接语义已承接到 0345；对应自动化随 0345 全量通过，浏览器视觉验收未运行 |
| [[ai/plan/task-0341-story-choice-flag-bindings]] | 代码与静态验收完成 | 绑定卡、pair 维护、反查 API 与随机 ID 提示已实现；自动化/浏览器验收未运行 |
| [[ai/plan/task-0340-story-editor-insertion-and-drag]] | 实施中 | 插入光标和节点拖放代码/静态检查完成；浏览器交互验收待完成 |
| [[ai/plan/task-0338-startup-performance-and-progress]] | 实施中 | 八步流程及前序加载、绘制等待、并行模块耗时可导出，保留最近三次启动；待收集偶发重启慢的现场占比，再测量与优化 |
| [[ai/plan/task-0333-semantic-columns-and-workspace-composition]] | 代码/自动化验收通过 | 全量内容/对应调用迁移及 F1–F4 补齐；整合 918 项通过，视觉按用户要求暂缓 |
| [[ai/plan/task-0334-unified-workspace-column-structure]] | 代码/自动化验收通过 | 全部调用方统一结构与公共样式；整合 918 项通过，待实际桌面视觉验收 |
| [[ai/plan/task-0336-story-node-properties-and-safe-projection]] | 代码/自动化验收通过 | 属性面板矩阵、草稿缓存与安全投影闭环；新增 7 项属性 UI 测试，类型/架构/文档/构建通过；全量仅余与本任务无关的 gameplay-b 在飞失败，待浏览器视觉验收 |

创建或分派 Task 时添加其链接；关键进展、受阻或完成时更新本表。表格用于快速定位，详细文件、结果和验证以 Task 正文为准。完成或归档后从活动列表移除，保留其他调查报告和资料。

## 最近完成

- [[ai/plan/task-0351-story-continuation-implementation]]：0350 的地点续播、直接 / Area 赴约单层子调用、局部结果回传、存档和回放隔离已实施；定向 82 项通过，全量无新增失败（既有失败由 71 降至 44）；浏览器人工验收未运行。

- Task 0345（原归档已删除）：Runtime 单游标表现队列、UI 显式意图、真实回执及存档 3.0 完成；全量 356 文件、3573 项通过，类型/架构/构建通过，未做浏览器视觉验收。

- Task 0339（原归档已删除）：移除 Story Button / ChoiceOption 内嵌回复与自动回显；61 条基础包文本改为显式老师 Talklet，静态验收通过，自动化测试未运行。
- Task 0337（原归档已删除）：Entry 局部 Map、四类节点单键存在条件、初始投入与存档/编辑器闭环；22 文件、163 项通过，未做浏览器验收。
- Task 0335（原归档已删除）：Story Editor E0 原型已交付；独立三栏与本地草稿闭环，全 UI 103 文件、939 项通过；按用户要求不做浏览器验收。

## 调查资料

- [[ai/plan/task-0350-story-continuation-and-cursor-design]]：故事续播、受限子调用及 Area 赴约的综合设计；已由 0351 实施。

- [[ai/plan/task-0349-story-multi-cursor-discussion]]：游标、空间、羁绊回调和 FollowUp 替代的阶段讨论；后续已整合至 0350。
- [[ai/plan/report-0349-story-cursor-topologies]]：100 个玩法 / 拓扑样本、禁嵌套准入与 FollowUp / 尾段替代调查，作为 0350 的边界依据。
- [[ai/plan/report-storynode-playback-mechanisms-2026-10-29]]：StoryNode、编辑器与演出链调用和状态边界；含 294 项定向测试基线、已确认差异及后续排查入口。
- [[ai/plan/report-gameplay-b-narrative-flow-2026-10-29]]：玩法 B 的流内剧情、战斗短句与里程碑对话调查；提出 MapRun 流程、Story 片段复用及统一叙事调度的组织建议。
- [[ai/plan/report-0333-completion-audit-2026-10-28]]：0333 初次独立复核与五项失败复现；后续 F1–F4 已补齐，最新验收以 0333 / 0334 Task 为准。
- [[ai/plan/report-gameplay-b-test-alignment-2026-10-29]]：Gameplay B 样例地图演进后 25 项陈旧测试的对齐修复；生产代码与 Registry 校验未放宽，全量 3491 项通过。

- Task 0331（原归档已删除）：本轮 Wiki 编写结果与验证记录；三项定向测试失败原因待后续厘清。
- [[ai/plan/report-wiki-map-and-module-audit-2026-10-28]]：Area Map、MapRun、角色训练与其他模块的 Wiki 缺口和编写顺序。
- [[ai/plan/report-area-map-wiki-2026-10-28]]：世界区域导航地图的专门调查与 Wiki 补写范围。
- [[ai/plan/report-wiki-830-coverage-2026-10-28]]：项目地图与现行 Wiki 的覆盖调查及候选编写范围。
- [[ai/plan/report-map-entry-css-structure-2026-10-28]]：地图准备页（MapEntry）CSS 结构调查，及其与通用工作区结构 CSS 的差异与风险。

旧归档正文已全量删除；上方仅保留完成摘要，不表示历史原文仍可读取。后续归档使用 [[ai/archive/README]] 的压缩包脚本，活动 Task 不受此次清理影响。
