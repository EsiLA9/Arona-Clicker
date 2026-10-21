# AGENTS.md — 任务入口

> 本页只负责分流。当前实现以源码、测试和 `docs/docs-829/` 核实；按任务选一条路径，不顺序通读链接。

## 选择入口

- 生产、GameNum、Effect、Trigger：[[docs/ai/context-packs/production]]。
- 角色、招募、培养、好感：[[docs/ai/context-packs/character]]。
- Datapack、Registry、Schema、独立编辑器：[[docs/ai/context-packs/datapack-schema]]。
- 世界线、Init、Spot、Lobby、存档：[[docs/ai/context-packs/world-lifecycle]]。
- 游戏内 UI、主题、表现：[[docs/ai/context-packs/ui-presentation]]。
- 其他机制、模块或状态：[[docs/docs-829/00-INDEX]]；领域未知或跨领域时用 [[docs/ai/task-read-set-routing]]。
- 文档维护：[[docs/docs-829/05-conventions/doc-maintenance]]；正式策划：[[docs/ai/goal-workflow]]；采用 Patch Unit 时：[[docs/ai/PROJECT-CONSTITUTION]]。

“编辑器”默认指游戏内 `src/ui/`；只有明确点名独立 Datapack / Schema Editor 才进入 `tools/datapack-editor/`。

## 工作边界

- 普通小需求直接实施，按影响验证；重要结构设计和已报告 bug 按 [[docs/docs-829/05-conventions/testing]] 优先行为 / 回归测试与严格审查。
- 改状态写入、跨层依赖或世界线归属时读 [[docs/docs-829/05-conventions/architecture-discipline]] 与命中的状态页；改字段 / 枚举时读 [[docs/docs-829/05-conventions/schema-sync]]。设计或重塑 UI 时使用 `frontend-design` skill，并按 UI 领域包读项目视觉约定。
- 游戏内 UI 默认只考虑宽屏鼠标操作，不考虑竖屏布局与键盘行为；具体任务明确要求时再扩展。
- 不修改 `dist/`、`web-dist/`、`src/ui/dist/`、`node_modules/`、生成 Schema 或只读历史快照；具体边界见上述专题页。

## 项目地图

遇到未知实现、新内容或文件关系时，先按客户端当前注册的模式使用项目身份入口（`simple` 为 `graph_project(workspace_path="<任务绝对目录>")`，`legacy` 为 `resolve_project`）核对项目根，后续显式传返回的 `project_id`；按 [[docs/ai/galhcg-project-map]] 查询并回到当前文件核实。

GALHCG 健康管理尽量集中在一个可验收的工作节点完成后，合并直接影响范围统一处理，也可委派 Luna 子 Agent；不在施工中逐次修改、逐文件反复检查。查询和文件改动不授权改图、刷新或写观察；授权内维护时再读 `.galhcg/agent-maintenance.md`，具体时机与委派规则见上述查询页。
