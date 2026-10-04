# Task 0223：整理 AI 协作入口并强化 GALHCG 发现闭环

状态：done — 入口、规则、模板与 GALHCG 主动发现/证据维护闭环已整理并核验

## 目标

整理 `AGENTS.md` 与 `docs/ai/` 的入口、协作流程、Read Set、模板和专门协议，使新会话能从精简入口找到唯一权威规则；遇到未知领域、新增内容或文件变更时，主动使用 GALHCG 导航、核证并维护相关地图证据。

## 设计边界

- 当前实现事实仍以源码、测试和 `docs/docs-829/` 为准；GALHCG 用于发现与关系导航，不替代源码核验。
- `AGENTS.md` 保留项目入口、必须遵守的稳定护栏、工具路由与专页链接；GALHCG 操作细节移至 `docs/ai/` 专页。
- 活跃 Task 在 `docs/plan-work/` 根目录推进；完成后才归档。Goal Set、Draft、Task、Unit 的职责按 `docs/ai/goal-workflow.md` 与 Constitution 保持一致。
- GALHCG 维护限于本次变更实际影响的路径、owner 与 Concept；不进行无边界全库刷新或猜测性建图。

## 当前事实与问题

| 已核实事实 | 依据 | 影响 |
| --- | --- | --- |
| `AGENTS.md` 包含详细 GALHCG 操作步骤及已不存在的 `docs-824/` 禁改路径。 | `AGENTS.md` | 入口需精简；操作协议另页维护；只读快照禁改路径需指向真实目录。 |
| Patch Unit 模板把活跃 Task 的默认存放路径写入 `archive/`。 | `docs/ai/templates/patch-unit.md`；`docs/ai/goal-workflow.md` | 模板路径与任务生命周期冲突。 |
| Constitution 要求同步文档维护分区表，但该表没有 `docs/ai/` 分区。 | `docs/ai/PROJECT-CONSTITUTION.md`；`docs/docs-829/05-conventions/doc-maintenance.md` | 维护规则缺少可执行落点。 |
| 施工前 GALHCG 已解析到 `acprogram` 正确项目；关键词“AI 协作/文档入口”未命中语义节点。扩大查询并检查文件后，确认需要补充项目协作协议 Concept 与 `docs/ai/` 文件清单。 | GALHCG `resolve_project`、`overview`、`search(mode="map/path")`、`map_inventory` | 零命中不能证明内容不存在；依据当前文件建立映射，并维持源码事实优先。 |

## 施工切片

### U1：精简入口并建立主动 GALHCG 协议

**Goal：**从单一入口定位各项协作权威；对未知、新增与变更内容形成主动发现及维护闭环。

**Read Set：**`AGENTS.md`、`docs/ai/00-index.md`、`docs/ai/galhcg-project-map.md`、`docs/docs-829/00-INDEX.md`、`docs/docs-829/05-conventions/doc-maintenance.md`。

**Allowed Files：**`AGENTS.md`、`docs/ai/00-index.md`、`docs/ai/galhcg-project-map.md`、`docs/docs-829/05-conventions/doc-maintenance.md`。

**验收：**入口职责清晰；GALHCG 新内容主动查询、变更审查、定向刷新、token 预检、批量限制和写后验证可执行；真实只读/历史路径准确。

### U2：统一施工规则与模板

**Goal：**修正施工协议与 Task/Unit/Receipt 模板中的目录、角色和权威来源矛盾。

**Read Set：**`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/goal-workflow.md`、三个施工模板、U1 新建的 GALHCG 协议。

**Allowed Files：**`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-task.md`、`docs/ai/templates/execution-receipt.md`。

**验收：**活动 Task 与拆分 Unit 保存在活动目录、完成后才归档；模板可选适用而不制造无必要的 Task/Unit；角色术语一致；Receipt 可记录 GALHCG 影响闭环。

### U3：收敛工作流、事实核对与领域路由

**Goal：**让未知事实核对和 GALHCG 路由贯穿玩法工作流、Read Set、提示词与领域上下文包。

**Read Set：**`docs/ai/goal-workflow.md`、`docs/ai/task-read-set-routing.md`、`docs/ai/prompts/`、`docs/ai/context-packs/`。

**Allowed Files：**`docs/ai/goal-workflow.md`、`docs/ai/task-read-set-routing.md`、`docs/ai/prompts/local-fact-review.md`、`docs/ai/prompts/sol-discussion.md`。

**验收：**未知和新内容有积极发现路径，GALHCG 结果不冒充事实；默认内容与招募路由指向正确上下文包；所有仍有职责的上下文包、提示词和模板均从 `docs/ai/00-index.md` 可达。

## 验收标准

- [x] `AGENTS.md` 足够精简，仍可路由到全部必要规则与工具专页。
- [x] GALHCG 协议明确：未知/新领域先主动搜图、源码和路径；未命中时继续扩展而不将零结果视作证据；事实以源码、测试及当前文档核证。
- [x] 项目文件变更后主动运行定向 `review_changes`；新增/移动文件按影响刷新清单；有直接受影响的语义映射时按预览 token、dry-run、分批限制和写后检查维护。
- [x] 任务生命周期与模板一致；所有 `docs/ai/` 文件有清晰职责并可从入口到达；不存在死路径或误导性的旧规划入口。
- [x] `npm run check:docs`、`git diff --check` 通过；GALHCG 影响范围检查完成并记录。

## 当前核验

- 最终：`npm run check:docs` 通过（593 篇 Markdown，0 errors）；`git diff --check` 通过，无空白错误。
- 文档范围内未运行代码测试。
- GALHCG：`docs/ai` 定向 refresh 发现 19 个文件；`map_inventory(selection="unassociated")` 完整返回 0 项；`review_changes` 对 19 份 AI 文档、`AGENTS.md`、文档维护页及计划索引均无待处理的内容变更 owner。
- 建立并确认 `concept:project-collaboration-and-map-discovery`，连接全部 19 份 `docs/ai/` 文件及入口/维护文档；相关节点与映射通过预览 token、dry-run、分批提交和 freshness 核验。最终 `audit_map_quality` 对该概念返回 0 个待处理候选；`search(mode="map", query="GALHCG")` 可发现该概念。

## Execution Receipts

- **U1 完成：**精简 `AGENTS.md`，新增 `docs/ai/00-index.md` 与 `docs/ai/galhcg-project-map.md`，明确未知/新增内容主动发现及变更后 Evidence / maps_to 闭环；更新文档维护分区。按项目根路径解析、扩大 map/path 搜索、刷新 `docs/ai/`，并核验新目录。
- **U2 完成：**更新施工角色和 Task/Unit/Receipt 目录约定；活动 Task 留在根目录，结束后再归档；模板新增 GALHCG 影响记录字段。
- **U3 完成：**更新 Goal/Task 工作流、Read Set 与两个提示词，明确零命中扩查与 GALHCG 结果须源码核证；保持所有 19 份 `docs/ai/` 文件均有入口与地图映射。

## 剩余工作

- 无。

## 相关路由

- [[docs/docs-829/00-INDEX]]
- [[docs/ai/goal-workflow]]
- [[docs/ai/task-read-set-routing]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/docs-829/05-conventions/doc-maintenance]]
