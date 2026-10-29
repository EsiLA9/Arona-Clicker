# Task：补齐地图、训练与世界进度 Wiki

状态：完成 — 机制专题、入口及示例已编写；定向测试有三项失败，已记录原因与限制。

## 目标与验收

根据 [[ai/plan/report-wiki-map-and-module-audit-2026-10-28]] 补写 Area Map、Gameplay B MapRun、Variant 转译/训练与世界进度揭示，并完善调查中列出的 Trigger 注册、Operation 作者流程和主题编辑说明；修正已核实的过时作者示例。通过索引和相关页面连接专题，以真实源码、测试、示例和限制说明当前行为。

不修改游戏代码、生成 Schema、历史归档或 GALHCG 地图；文档静态检查通过，行为事实以源码和测试交叉审阅，按需选择验证并如实记录。

## 进度与分工

- Area Map：子 Agent 交付总览、旅行与交通、公开投影与会话三篇；已整合领域与世界入口。
- MapRun：子 Agent 交付生命周期、遭遇、效果与事实、保存与工作区四篇；已整合地图与领域入口。
- Variant 与世界进度：子 Agent 分别交付转译训练和揭示/Milestone 两篇；已整合角色和世界入口。
- 主 Agent：修订作者示例与 Trigger 注册、主题编辑，新增 Operation 作者案例，核对关键源码、示例及索引。

## 文件与依据

| 路径 | 用途 | 状态 |
| --- | --- | --- |
| `docs/docs-830/05-domains/` | 地图、训练及世界进度机制页 | 新增九篇并整合已有入口 |
| `docs/docs-830/03-engine/trigger-mechanism.md` | 运行时注册的行为 | 已修改 |
| `docs/docs-830/07-tooling/operation-content-authoring.md`、`editor-schema-to-form.md` | Operation 作者案例及入口 | 已新增 / 修改 |
| `docs/docs-830/04-presentation/story-chat-and-theme-presentation.md` | 主题编辑案例 | 已修改 |
| `ai/guide/examples/gameplay-b-effect-program-e1.md` | 效果程序范围 | 已修订，按 E1 与 AG-1 区分 |
| `docs/docs-830/00-INDEX.md`、`05-domains/00-INDEX.md` | 总入口与领域导航 | 已整合 |

源码和测试入口见调查报告及最终专题页。任务开始前工作区已有大量改动，均需保留；本 Task 不将既有改动当作此次交付。

## 验证与交接

- `npm run check:docs`：归档前通过，扫描 100 篇现行 Markdown；Task 归档后再次通过，扫描 99 篇。
- 19 个相关测试文件通过 `npm test -- ...` 定向运行：17 个文件通过、2 个失败；共 226 项通过、3 项失败，完整输出 `.test-artifacts/latest.log`。Area Map、AG-1 提交、事实门控、Variant、信息揭示、Milestone、Trigger、Operation 编辑器和主题选定文件均通过。
- `tests/engine/gameplay-b-map-run.test.ts` 一项及 `tests/engine/gameplay-b-map-save-resume.test.ts` 一项都对默认 `field-investigation` 调用手动完成；当前内容使用条件完成，`completeEncounter()` 拒绝该调用。另一个存档测试将运行快照中存在的 `partyAgility: undefined` 与保存快照比较，同时又断言保存快照不含该字段，导致断言失败。相关源码和测试均非本 Task 修改；调查未证明这两类差异是产品缺陷或仅是过时测试，未修改运行代码或测试。
- 新增页全文中的完整源码/测试路径经文件存在性核对，未发现缺失；现有跟踪文件通过 `git diff --check`，新增页面未发现行尾空白。源码和测试阅读不等同所有行为均已验证。
- GALHCG 对本 Task 的直接变更路径进行只读核对：四个已有文档存在内容变化的旧依据，其他 18 个路径没有直接 Evidence 或 `maps_to` 关联。检查未刷新 freshness；本 Task 未获授权改图或回填。

后续如需让全部定向测试通过，应分别厘清默认地图的条件完成与测试预期，以及运行快照与保存快照的可选字段表达，再针对确认的责任边界修正。机制文档现有示例以源码和其他通过的相关场景为依据，不把失败测试记为通过。
