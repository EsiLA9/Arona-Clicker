# ai/plan — 当前计划入口

需要持久管理、交接或跟踪的工作，以 Task 为单位放入本目录；创建、执行及收尾见 [[ai/guide/task-workflow]]。普通小需求可直接处理，无需为流程额外建档。

## 活动 Task

| Task | 状态 | 当前进度或下一步 |
| --- | --- | --- |
| [[ai/plan/task-0364-story-operation-display-content-migration]] | 待实施，0362 / 0363 实现已完成 | 先盘点；以流剧场预演为首批，将 Operation 产生的文本 / 气泡 / 卡片迁为真实节点，再退役生成路径 |
| [[ai/plan/task-0361-reveal-area-map-implementation]] | 代码与自动化验收完成，待桌面确认 | 世界信息、AreaMap 图册与直达、Runtime / Story 编辑闭环和混合示例已实施；回归结果与浏览器手工清单见 Task 正文 |
| [[ai/plan/task-0360-reveal-and-area-map-discussion]] | 讨论中，未施工 | 已合入地图获得 / 快速切图与节点导览直达，修订首次探索限制；全部可修订，继续商讨 |
| [[ai/plan/task-0355-story-editor-theme-position-and-flow-tools]] | 实现与自动化验证完成 | 主题专用设置、六点定位预设、信息流 / 控制流影响说明与隔离表现预览已接入；原全量失败项已逐类处理，最终 371 文件 / 3689 项通过；待桌面鼠标验收 |
| [[ai/plan/task-0354-story-editor-authoring-api]] | 代码 / 自动化施工完成 | 作者 API、结构值、Entry / 投放、隔离试播与包保存已接入；新增 16 项通过，待桌面手动验收 |
| [[ai/plan/task-0353-story-editor-remaining-gaps]] | 调查完成，已转入 0354 | 保留调查时缺口快照；施工与验收见 0354 |
| [[ai/plan/task-0352-story-cursor-space-and-history]] | 代码 / 自动化验收完成 | 正式历史、爱心卡片与星野三空间样例已实施；后续取消子结束自动召回，70 项定向及类型 / 架构通过，待浏览器手动验收 |
| [[ai/plan/task-0347-story-context-and-presentation-movement]] | 实施中 | 按裁定扩展 StoryDef、StoryNode、编辑器与重播运行语义 |
| [[ai/plan/task-0348-story-talklet-click-authoring-coverage]] | 实施中，相关范围转入 0362–0364 | 保留字段覆盖与 ID 历史；本轮基础 / 高级设计及 Operation 内容迁出按新 Task 验收，不恢复旧 result 范围 |
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

- Task 0365（已投入 [[ai/archive/README|压缩归档]]，含分类 draft）：Entry 拆分公共信息、catalog 历史归档与 active / random / affection 激活配置；地区兜底、池约束、运行分流、内置内容、Schema 和编辑器基础读写已闭环。79 文件 842 项定向回归、构建／架构／文档／Schema 通过；全局类型仅余原型既有 8 项。未做浏览器或全库验收。机制见 [[story-and-effects]]、[[runtime-editor-and-project-checks]]。

- Task 0359（已投入 [[ai/archive/README|压缩归档]]）：新建 Story 必须确认编辑态 Mod，使用 `mod:story:story_number` 并持久化归属；同 Mod ID 更改会同步正式引用与编辑状态，包内改名原子保存、拒绝过期 / 跨包引用。14 文件 158 项检查：157 通过，1 项位于并行 Operation 属性改动；身份专用验收、导航回归、构建 / 文档 / 架构通过，类型仅余原型既有 8 项。未做浏览器或全库验收。机制见 [[runtime-editor-and-project-checks]]。

- Task 0358（已投入 [[ai/archive/README|压缩归档]]）：Choice 收敛为选项 / 出现条件 / marks 选择记录，删除共同与通用结果动作，保留拖放 / Navi / 标记关联；9 组内置内容与迁移工具、Schema 同步，修复过期解绑及任意 JSON 误扫。去重 71 文件 / 681 项回归、构建 / 文档 / 架构通过；全局类型仅余原型测试既有 8 项，按许可未做浏览器实操。机制见 [[story-and-effects]]、[[runtime-editor-and-project-checks]]。

- Task 0357（已投入 [[ai/archive/README|压缩归档]]）：三个 Luna 交付已整合；9 个内置 Choice 收敛为条件 / 局部 flags，14 个持久效果分支与 4 个转移移至受控 Operation / Transfer，编辑器保留旧字段诊断与导航。整合唯一兼容失败已修复，最终 6 文件 / 80 项复验通过；机制见 [[story-and-effects]]、[[runtime-editor-and-project-checks]]。未做浏览器实操，全局类型检查仍有原型测试的 8 处既有错误。

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
- 0333 完成度复核摘要（2026-10-28）：曾记录五项失败复现；报告正文已随旧归档清理，后续状态与验收以 [[ai/plan/task-0333-semantic-columns-and-workspace-composition]] / [[ai/plan/task-0334-unified-workspace-column-structure]] 为准。
- [[ai/plan/report-gameplay-b-test-alignment-2026-10-29]]：Gameplay B 样例地图演进后 25 项陈旧测试的对齐修复；生产代码与 Registry 校验未放宽，全量 3491 项通过。

- Task 0331（原归档已删除）：本轮 Wiki 编写结果与验证记录；三项定向测试失败原因待后续厘清。
- [[ai/plan/report-wiki-map-and-module-audit-2026-10-28]]：Area Map、MapRun、角色训练与其他模块的 Wiki 缺口和编写顺序。
- Area Map 世界区域导航专题调查（2026-10-28）：调查正文已随旧归档清理；当前机制说明见 [[area-map-overview|Area Map 概览]] 与 [[area-map-projection-and-session|投影与会话]]。
- [[ai/plan/report-wiki-830-coverage-2026-10-28]]：项目地图与现行 Wiki 的覆盖调查及候选编写范围。
- [[ai/plan/report-map-entry-css-structure-2026-10-28]]：地图准备页（MapEntry）CSS 结构调查，及其与通用工作区结构 CSS 的差异与风险。

旧归档正文已全量删除；上方仅保留完成摘要，不表示历史原文仍可读取。后续归档使用 [[ai/archive/README]] 的压缩包脚本，活动 Task 不受此次清理影响。
