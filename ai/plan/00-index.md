# ai/plan — 当前计划入口

历史 Task、报告和草稿已归档至 `ai/archive/history.zip`。按 [[ai/archive/README]] 列目录或读取所需条目。新建 Task 时使用 `npm run task -- newTask`。

## Editor Workbench Roadmap

Task 0386 记录原 Stage 02–07 Roadmap（已完成）。第二轮 Convergence 的总合同、依赖顺序与 8 份原始施工指令保存在 [[ai/plan/upper-chat-tasks/00-roadmap]] 与 upper-chat-tasks 源文件夹；正式任务编号及逐项施工内容见下表。Task 0421 与 0422 保留原编号；当前顺序为 0421、0423、0424、0425、0426、0422、0427、0428，完成 0428 后停止。upper-chat-tasks/00-index.md 是转换前输入快照；本文件是当前活动索引。源文件夹在独立复核完成前保留。旧 Task 0383／0384／0385 的真实浏览器验收仍待用户处理。

| Task | 状态 | 下一步 |
| --- | --- | --- |
| [[ai/plan/task-0421-editor-convergence-host-lifecycle]] | 已完成 | CP1 九项回归已归因；CP2 Host/绑定迁移与旧入口退出完成；定向 5 suites / 96 tests 通过。待继续 0423 |
| [[ai/plan/task-0423-story-directory-state]] | 已完成 | `StoryDirectoryManagementState` 成为目录状态唯一 payload；真实目录工厂消费它并按来源/写入绑定重建投影。3 suites / 61 tests 与静态检查通过，接续 0424 |
| [[ai/plan/task-0424-story-directory-instance]] | 已完成 | `story-directory` Provider 已接入公共 Manager，归档目标独立，Story 特殊模式退出；3 suites / 27 tests 与静态检查通过。浏览器留用户手验，下一步 0425 |
| [[ai/plan/task-0425-editor-explorer-node-contract]] | 已完成 | Story 真实 sidebar 已消费搜索前节点投影；2 suites / 27 tests 通过。私有搜索与递归渲染保留至必需后继 0426 |
| [[ai/plan/task-0426-story-explorer-public-search]] | 已完成 | Story 已使用公共搜索投影、递归渲染和交互；4 suites / 86 tests 与静态检查通过，浏览器留用户手验。下一步 0422 |
| [[ai/plan/task-0422-editor-convergence-search-integration]] | 已完成 | World 已接入 Story 同一公共 Explorer 管线并移除私有递归/滚动状态写入；4 suites / 88 tests 与静态检查通过，浏览器留用户手验。下一步 0427 |
| [[ai/plan/task-0427-editor-instance-presentation]] | 进行中 | Browse Instance Provider 声明类型和表现，公共实例条停止猜测图标 |
| [[ai/plan/task-0428-editor-convergence-final-integration]] | 待处理 | 完成连续行为矩阵、旧路径审计、接入文档与最终交付 |
| Task 0391（已归档：`ai/plan/task-0391-editor-workbench-dev-navigation-validation.md`） | 已完成 | Stage 02.5-D 交付摘要见 Task 0386 |
| Task 0392（已归档：`ai/plan/task-0392-editor-instance-story-contract.md`） | 已完成 | Stage 03-A 调查摘要见 Task 0386 |
| Task 0393（已归档：`ai/plan/task-0393-editor-instance-manager-core.md`） | 已完成 | Stage 03-B 交付摘要见 Task 0386 |
| Task 0394（已归档：`ai/plan/task-0394-editor-instance-activation-atomicity.md`） | 已完成 | Stage 03-C 交付摘要见 Task 0386 |
| Task 0395（已归档：`ai/plan/task-0395-editor-instance-story-lifecycle.md`） | 已完成 | Stage 03-D 交付摘要见 Task 0386 |
| Task 0396（已归档：`ai/plan/task-0396-editor-instance-story-authority-removal.md`） | 已完成 | Stage 03-E / Stage03 集中验收摘要见 Task 0386 |
| Task 0397（已归档：`ai/plan/task-0397-editor-world-provider.md`） | 已完成 | Stage 04-A 摘要见 Task 0386；当前推进 0398 |
| Task 0398（已归档：`ai/plan/task-0398-editor-world-single-instance-policy.md`） | 已完成 | Stage 04-B 摘要见 Task 0386；当前推进 0399 |
| Task 0399（已归档：`ai/plan/task-0399-editor-world-manager-integration.md`） | 已完成 | Stage 04-C 摘要见 Task 0386；当前推进 0400 |
| Task 0400（已归档：`ai/plan/task-0400-editor-provider-boundary-audit.md`） | 已完成 | Stage 04-D / Stage04集中验收摘要见 Task 0386；当前推进 0401 |
| Task 0401（已归档：`ai/plan/task-0401-editor-workbench-session-owner.md`） | 已完成 | Stage 05-A 摘要见 Task 0386；当前推进 0402 |
| Task 0402（已归档：`ai/plan/task-0402-editor-workbench-independent-explorer.md`） | 已完成 | Stage 05-B 摘要见 Task 0386；当前推进 0403 |
| Task 0403（已归档：`ai/plan/task-0403-editor-workbench-resource-activation.md`） | 已完成 | Stage 05-C 摘要见 Task 0386；当前推进 0404 |
| Task 0404（已归档：`ai/plan/task-0404-editor-workbench-command-scopes.md`） | 已完成 | Stage 05-D 摘要见 Task 0386；当前推进 0405 |
| Task 0405（已归档：`ai/plan/task-0405-editor-workbench-host-and-empty-state.md`） | 已完成 | Stage 05-E 摘要见 Task 0386；Story/World 浏览器行为留待手动验收 |
| Task 0406（已归档：`ai/plan/task-0406-editor-workbench-cross-business-validation.md`） | 已完成 | Stage 05-F 自动化集中验收摘要见 Task 0386；浏览器交互待手动验收 |
| Task 0407（已归档：`ai/plan/task-0407-editor-explorer-provider-identities.md`） | 已完成 | Stage 06-A 身份契约摘要见 Task 0386 |
| Task 0408（已归档：`ai/plan/task-0408-editor-explorer-state-owner.md`） | 已完成 | Stage 06-B 公共 Explorer 状态 owner 摘要见 Task 0386 |
| Task 0409（已归档：`ai/plan/task-0409-editor-explorer-dom-interactions.md`） | 已完成 | Stage 06-C 交互绑定/DOM 稳定摘要见 Task 0386 |
| Task 0410（已归档：`ai/plan/task-0410-editor-explorer-search-and-reveal.md`） | 已完成 | Stage 06-D 搜索与显式定位摘要见 Task 0386 |
| Task 0411（已归档：`ai/plan/task-0411-editor-explorer-shared-presentation.md`） | 已完成 | Stage 06-E 公共 Explorer 表现契约摘要见 Task 0386 |
| Task 0412（已归档：`ai/plan/task-0412-editor-explorer-story-world-migration.md`） | 已完成 | Stage 06-F Explorer 迁移摘要见 Task 0386 |
| Task 0413（已归档：`ai/plan/task-0413-editor-workbench-ownership-audit.md`） | 已完成 | Stage 07-A 唯一状态所有者审计见 Task 0386 |
| Task 0414（已归档：`ai/plan/task-0414-editor-workbench-remove-transitional-paths.md`） | 已完成 | Stage 07-B 过渡路径清理摘要见 Task 0386 |
| Task 0415（已归档：`ai/plan/task-0415-editor-workbench-provider-guide.md`） | 已完成 | Stage 07-C Provider 接入指南见 Workspace 机制页 |
| Task 0416（已归档：`ai/plan/task-0416-editor-workbench-visual-knowledge.md`） | 已完成 | Stage 07-D Authoring Workbench/Explorer 视觉知识见 ui-style |
| Task 0417（已归档：`ai/plan/task-0417-editor-workbench-final-integration.md`） | 已完成 | Stage 07-E 7 suites/140 tests 通过；真实视觉/交互待人工验收 |
| Task 0418（已归档：`ai/plan/task-0418-editor-workbench-final-delivery.md`） | 已完成 | Stage 07-F 最终交付见 Task 0386；Roadmap 到此停止 |

## 其他活动 Task

| Task | 状态 | 下一步 |
| --- | --- | --- |
| [[ai/plan/task-0385-editor-workspace-host]] | 待验收 | 完成 Story 正文输入、Entry 属性、悬浮滚动条、目录管理/试播浏览器核对 |
| [[ai/plan/task-0384-editor-directory-navigation]] | 待验收 | 完成目录定位、实例切换与共享树形行宽屏验收 |
| [[ai/plan/task-0383-editor-session-and-review-tools]] | 进行中 | 等待用户浏览器验收 |
| [[ai/plan/task-0374-arona-vite-watch-and-progressive-css]] | 进行中 | Windows 自然重启后复测 |
| [[ai/plan/task-0373-arona-dev-cold-start]] | 进行中 | Windows 自然重启后复测首次大厅及刷新 |
| [[ai/plan/task-0371-cross-init-state-affector-implementation]] | 待处理 | 固定跨 Init 写入与 Operation 越线回归用例 |
| [[ai/plan/task-0369-story-entry-editor-tabs]] | 进行中 | 完成宽屏浏览器走查 |

## 调查报告与设计资料

- [[ai/plan/report-advanced-editor-framework-roadmap-baseline|高级编辑器框架改造基线（Stage 00）]]，记录初始状态所有权、浏览器行为和已裁定总体目标。
- [[ai/plan/report-cross-init-state-affector-audit|跨 Init 状态 Affector 调查]]及[[ai/plan/design-engine-batch-affectors-init-scope|批量 Affector Init 范围设计]]，支撑 Task 0371。
- [[ai/plan/report-engine-performance-2026-11-12|引擎性能报告]]，支撑开发启动优化记录。
