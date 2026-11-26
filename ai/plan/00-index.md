# ai/plan — 当前计划入口

历史 Task、报告和草稿已归档至 `ai/archive/history.zip`。按 [[ai/archive/README]] 列目录或读取所需条目。新建 Task 时使用 `npm run task -- newTask`。

## Editor Workbench Roadmap

Task 0386 是 Stage 02–07 的长期设计合同及执行索引。下列 0387–0418 是独立施工节点，按依赖顺序核验和执行；完整状态所有权、业务不变量、阶段边界与通过条件见 [[ai/plan/task-0386-editor-workbench-roadmap]]。当前仅建立 Task 文档，均待核验，未开始 Stage 02.5 代码施工。

| Task | 状态 | 下一步 |
| --- | --- | --- |
| [[ai/plan/task-0388-editor-workbench-stage-02-preflight]] | 待核验 | 核对 Stage 02 实际实现、运行服务和遗留人工验收 |
| [[ai/plan/task-0387-editor-workbench-dev-navigation]] | 待核验 | Stage 02.5-A：核实 DEV 导航入口、就绪信号与成功边界 |
| [[ai/plan/task-0389-editor-workbench-dev-navigation-coordinator]] | 待核验 | Stage 02.5-B：实现协调器并读取运行事实 |
| [[ai/plan/task-0390-editor-workbench-dev-url-layout]] | 待核验 | Stage 02.5-C：URL 参数、重定向和临时布局投影 |
| [[ai/plan/task-0391-editor-workbench-dev-navigation-validation]] | 待核验 | Stage 02.5-D：失败恢复、DEV 边界、文档和浏览器验证 |
| [[ai/plan/task-0392-editor-instance-story-contract]] | 待核验 | Stage 03-A：核对 Story/Entry 状态所有权与 Provider 合同 |
| [[ai/plan/task-0393-editor-instance-manager-core]] | 待核验 | Stage 03-B：建立公共实例身份、集合和生命周期核心 |
| [[ai/plan/task-0394-editor-instance-activation-atomicity]] | 待核验 | Stage 03-C：迁移激活与保存门禁原子性 |
| [[ai/plan/task-0395-editor-instance-story-lifecycle]] | 待核验 | Stage 03-D：迁移创建、复用、复制与关闭 |
| [[ai/plan/task-0396-editor-instance-story-authority-removal]] | 待核验 | Stage 03-E：删除 Story 私有实例权威 |
| [[ai/plan/task-0397-editor-world-provider]] | 待核验 | Stage 04-A：抽取只读 World Provider 业务状态 |
| [[ai/plan/task-0398-editor-world-single-instance-policy]] | 待核验 | Stage 04-B：以公共 Manager 策略实现 World 单实例复用 |
| [[ai/plan/task-0399-editor-world-manager-integration]] | 待核验 | Stage 04-C：接入统一 Manager 并保留跨路由实例 |
| [[ai/plan/task-0400-editor-provider-boundary-audit]] | 待核验 | Stage 04-D：审查 Manager 是否含业务硬编码 |
| [[ai/plan/task-0401-editor-workbench-session-owner]] | 待核验 | Stage 05-A：统一 Workbench 会话与外部进出边界 |
| [[ai/plan/task-0402-editor-workbench-independent-explorer]] | 待核验 | Stage 05-B：解耦 Explorer 类型与活动实例 |
| [[ai/plan/task-0403-editor-workbench-resource-activation]] | 待核验 | Stage 05-C：混合资源打开、实例激活和显式定位 |
| [[ai/plan/task-0404-editor-workbench-command-scopes]] | 待核验 | Stage 05-D：按 Workbench/Explorer/Instance/Selection 路由命令 |
| [[ai/plan/task-0405-editor-workbench-host-and-empty-state]] | 待核验 | Stage 05-E：稳定栏位、临时场景和空 Workbench |
| [[ai/plan/task-0406-editor-workbench-cross-business-validation]] | 待核验 | Stage 05-F：完成跨业务集成场景验收 |
| [[ai/plan/task-0407-editor-explorer-provider-identities]] | 待核验 | Stage 06-A：明确资源身份与树放置身份契约 |
| [[ai/plan/task-0408-editor-explorer-state-owner]] | 待核验 | Stage 06-B：迁移通用浏览状态所有权 |
| [[ai/plan/task-0409-editor-explorer-dom-interactions]] | 待核验 | Stage 06-C：统一交互并保持树 DOM 稳定 |
| [[ai/plan/task-0410-editor-explorer-search-and-reveal]] | 待核验 | Stage 06-D：实现可恢复搜索与显式定位生命周期 |
| [[ai/plan/task-0411-editor-explorer-shared-presentation]] | 待核验 | Stage 06-E：收敛 Explorer 公共表现契约 |
| [[ai/plan/task-0412-editor-explorer-story-world-migration]] | 待核验 | Stage 06-F：迁移 Story/World 并退出旧浏览控制器 |
| [[ai/plan/task-0413-editor-workbench-ownership-audit]] | 待核验 | Stage 07-A：核验最终唯一状态所有者 |
| [[ai/plan/task-0414-editor-workbench-remove-transitional-paths]] | 待核验 | Stage 07-B：删除无消费者的过渡路径 |
| [[ai/plan/task-0415-editor-workbench-provider-guide]] | 待核验 | Stage 07-C：编写可追踪至真实代码的接入指南 |
| [[ai/plan/task-0416-editor-workbench-visual-knowledge]] | 待核验 | Stage 07-D：增量维护 Workbench 视觉知识 |
| [[ai/plan/task-0417-editor-workbench-final-integration]] | 待核验 | Stage 07-E：按风险完成集中验证 |
| [[ai/plan/task-0418-editor-workbench-final-delivery]] | 待核验 | Stage 07-F：最终交付、任务收尾并停止 |

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
