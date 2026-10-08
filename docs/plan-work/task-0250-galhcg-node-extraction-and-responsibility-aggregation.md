# Task 0250：GALHCG 节点提取与职责聚合

状态：active — 已裁定整理方向，交由 Luna 子代理施工，主代理复核后关闭。

## 目标

把 ACProgram 图谱中大型模块的平铺结构和大型 Concept 的混合文件映射，整理为可以逐层导航的职责分区与具体机制节点。查询具体机制时能到达有限的源码、测试和当前文档；查询大模块时能看清子职责与协作关系。

用户于 2026-10-07 接受“提取具体机制、按职责聚合、顶层保留导航”的方向，并明确要求建立 Task、交予 Luna 子模型执行。此 Task 授权在下列范围内维护实际图谱与协议，不只是输出候选清单。

## 设计边界与已裁定规则

- 保留现有大模块与既有 Concept 的稳定 ID；不删除既有节点。旧 Concept 根据当前源码收窄职责，或保留为聚合入口；不得任意变更节点类型。
- 聚合优先采用 Module → 子 Module → Concept；施工前先核对工具实际支持的 contains 端点及无环要求，dry-run 验证。服务不支持时上报，不自行改变服务。
- 具体 Concept 按可独立解释的职责或机制提取，不按文件一对一建节点。先查同义词、别名和相邻节点；已有节点优先复用。
- 具体实现、测试与机制文档的 maps_to 下沉到对应职责节点。聚合节点主要保留职责总览、公开入口和组合证据，不复制所有子节点文件。
- contains 表达主要职责归属，depends_on 表达已核实依赖，related_to 表达弱关联；不能把调用顺序、共同文件或主题相近当成依赖。
- 一个概念尽量保持一个主要归属。跨层协作用依赖/关联边，不重复创建同一概念。
- Task、Receipt 与历史材料保留追溯能力，但不能作为当前实现的唯一依据；不因文件处于 archive 就批量删除映射或更改生命周期。
- 提取映射必须先建立并核验新落点，再删除明确被替代的旧 maps_to/contains。每条原映射记录为保留、迁移或经说明移除，防止漏项。
- 直接子节点约 10–15 个、直接文件映射约 20 个作为人工复核提醒，不作为硬性拆分配额。
- 非目标：修改游戏源码/测试、重构源码目录、修改 GALHCG 服务、全库刷新/清理、存档迁移、新增自动化脚本、恢复冻结 Draft、补完无关模块全部映射。

## 当前事实与依据

| 调查结果（2026-10-07） | 依据及限制 | 施工影响 |
| --- | --- | --- |
| 项目身份为 acprogram，root_path/workspace_path 均指向当前 ACProgram。 | resolve_project 实际返回；子代理开工须重新解析。 | 每次项目调用显式传入核对后的 ID。 |
| 当前有 8 个顶层 Module；领域、Engine、UI 各直接包含 36、18、5 个 Concept。 | overview 三页完整读取，complete=true、truncated=false；统计只含 contains 的语义节点。 | 优先为领域/Engine 增加职责分组；UI 需同时处理大 Concept。 |
| Operation EventRun Runtime 直接映射 79 个文件，含源码 35、测试 21、当前文档 6、规划材料 17。 | concept:operation-event-run-runtime 的 map_view(files) 两页完整读取；不是 freshness 核验。 | 合同、运行、校验、投影、样例和历史材料需逐项判定落点。 |
| UI Workspace Renderer 直接映射 99 个文件，含源码 67、测试 22、当前文档 2、规划材料 8。 | concept:ui-workspace-renderer 的 map_view(files) 两页完整读取；不是 freshness 核验。 | 路由、刷新、具体工作区、浮层与交互需要分开解释。 |
| Operation 已有学生准入与 Observation Concept。 | overview；候选 ID 为 concept:operation-student-profile-admission、concept:operation-observation。 | 先复用，不重复建节点。 |
| 当前 Wiki 已按领域功能、Engine 能力和 UI 路由/刷新组织入口。 | docs/docs-829/06-wiki/30-arona-clicker-domain/00-index.md、40-engine/00-index.md、50-ui/00-index.md。 | 作为聚合候选；实际职责须核对源码与测试。 |
| Task 0223 完成维护流程；Draft 0195 已冻结，未裁定粒度治理。 | task-0223-ai-collaboration-docs-and-galhcg-discovery、draft-0195-galhcg-content-maintenance-experience、active-work-freeze-2026-10-04。 | 本 Task 独立实施，不复活旧 Draft。 |

## 执行责任与共同约束

- Luna 子代理执行 U1–U3 并把 Receipt 内联写入本 Task；主代理复核范围、图谱前后差异和实际验收结果。
- 共同文件修改白名单：本 Task、docs/plan-work/00-index.md、docs/ai/galhcg-project-map.md。Task 完成后的归档由主代理处理。
- 图谱写入白名单：module:arona-clicker-domain、module:engine、module:game-ui 及其直接/间接职责节点、两个目标 Concept 的映射与受影响关系、新增职责子模块/Concept；本 Task/索引/协议的直接维护关系。跨模块已有协作节点只可补有源码依据的关联，不改无关职责与生命周期。
- Read Set：AGENTS.md、docs/docs-829/00-INDEX.md、docs/ai/task-read-set-routing.md、docs/ai/galhcg-project-map.md、docs/ai/PROJECT-CONSTITUTION.md、docs/docs-829/05-conventions/doc-maintenance.md、本 Task，以及各 Unit 下列入口。
- 本 Task 是图谱维护，不采用游戏代码的 3–5 文件阅读上限。每 Unit 可按目标映射定向阅读其源码、相关测试和当前文档；避免整目录全文读取。预览每批最多 8 文件，Evidence 每提交批最多 32 个 owner 引用，严格按工具返回游标续读。
- 工作区已有大量其他任务未提交修改；保留它们，只改白名单。不得 reset、提交、回滚或顺手修复范围外文件。
- 发现边界事实冲突、必须修改白名单外文件、工具不支持候选层级、必需检查无法执行或出现解释不了的失败时，暂停受影响 Unit 并向主代理报告；可继续独立且已裁定的工作。
- 多批提交不是整体事务；失败时记录已提交、失败和待提交批次，不声称整体回滚。

## 施工切片

### U1：提取 Operation 与 Workspace Renderer 的具体职责

- Goal：完整盘点两节点的映射，逐项核证、建立具体职责落点，迁移过宽映射。
- Allowed Files：本 Task；图谱限两个目标 Concept、其所属模块、提取/复用节点及相关 maps_to/contains/直接协作边。
- Read Set 入口：operation-runtime.md、operation-view.md、UI workspace-routing.md、refresh-update.md；图谱候选映射到的 src/arona-clicker/contracts/、services/、content/operation-samples/、src/ui/ 及相关 tests/。
- Operation 提取候选：入场与生命周期、行动准备与目标、结算与费用、场景牌与牌组、路线与结局、存档恢复、View 投影、内容校验、样例内容；既有准入与 Observation 节点复用。候选可依实际职责合并，不要求固定数量。
- UI 提取候选：工作区路由、渲染生命周期、增量刷新、Operation 工作区、通用浮层、焦点与滚动交互；已有内容编辑、剧情、表现节点优先复用。
- 先保存基线节点/边与逐路径落点表，再取得实际读取版本的 token、预检、提交；写后验证新节点可发现、方向正确、映射可达。
- Receipt：前后映射数、节点 ID/职责、保留/迁移/移除分类及原因、依据路径、批次提交状态、未处理项。

### U2：按职责聚合领域、Engine 与游戏 UI

- Goal：大模块下按稳定职责分组，具体 Concept 有主要归属，大模块不再平铺不同层级机制。
- Allowed Files：本 Task；图谱限三个模块及其既有/新职责节点的 contains、直接协作关系和必要 Evidence。
- Read Set 入口：三个模块卡和对应 Wiki 索引；候选 Concept 的当前证据源码与测试。节点生命周期以已有状态及真实依据为准。
- 领域分组候选：状态与读模型、世界生命周期、角色获取与成长、设施与经济、剧情、主题与表现、Operation、内容装配。
- Engine 分组候选：表达式与数值、事件与 Effect/Trigger/Affector、派生查询、Tick/Session。
- UI 分组候选：命令与读取、导航与刷新、功能工作区、主题表现、内容编辑。命令节点已有跨模块归属时保留稳定 owner，核对真实协作边，不为凑组而迁移。
- 每组须有当前文件支持名称、职责和成员；合理单项可直接保留，不强制制造空层级。先 dry-run 确认嵌套 Module 关系合法。
- Receipt：模块前后直接子节点数、分组成员表、主要归属/跨模块关系核验、孤立/循环/重复检查。

### U3：固化粒度规则与查询验收

- Goal：把本次已验证的粒度与维护规则写入唯一协议页，并形成完整验收记录。
- Allowed Files：本 Task、docs/ai/galhcg-project-map.md、docs/plan-work/00-index.md；三文件直接 Evidence/maps_to 及 U1/U2 写入项的必要核验。
- 协议补充：Module/具体 Concept 的职责、提取与合并条件、单一主要归属、父节点 Evidence 不复制子节点、软阈值提醒、映射迁移防丢与历史追溯边界。
- 定向查询验收至少覆盖：Operation 目标选择、场景牌组、Save/Resume、View 投影；UI 路由、增量刷新、浮层/焦点；Engine Affector 与 Tick。查找应到达具体节点与相关证据，避免只返回大型混合节点。
- 完整读取本次范围的结构/文件分页，核对主要归属、无环、前后映射守恒或经说明移除；audit_map_quality 提示逐项说明。preview/token/dry-run 成功不等于语义正确。
- 运行 npm run check:docs、git --no-pager diff --check -- 三个白名单文件；范围外既有文档失败要记录，不修复、不声称通过。纯图谱/文档任务不运行游戏全量测试，不新增测试。
- 对实际变更文档运行 review_changes，维护直接受影响 Evidence/maps_to；定向 refresh 只更新必要清单，不全库刷新。Task 的基线/决策记录用于 proposed 维护计划，不把计划本身标作游戏实现证据。

## 测试与验收

- [x] U1 两个大型 Concept 的每条基线映射都有明确落点或保留/移除依据，无静默丢失。
- [x] 新/复用具体节点的名称、摘要、Evidence 与 maps_to 角色匹配实际职责，当前实现有源码或测试证据。
- [x] 三个大模块的主要职责可逐层浏览，子分区无空节点、无环、无重复概念与不必要多重归属。
- [x] 聚合入口不机械复制子节点全部文件，既有 ID 和追溯路线保留。
- [x] 指定机制查询可直接找到具体职责、源码、测试和当前文档；所有本次查询按分页完成，受限结果明确说明。
- [x] 协议页已加入经本次施工验证的粒度规则；文档检查、范围 diff 检查和直接地图维护结果如实记录。
- [ ] Luna Receipt 完整，等待主代理复核后再标记 completed；后续扩展与本 Task 验收缺口已区分。

## 当前核验（2026-10-08）

- 本轮独立 resolve_project 返回 project_id=acprogram；workspace_path 与 root_path 均精确指向本仓库。
- U1–U3 图谱施工与写后结构/文件分页验收已完成；本 Task、协议页和索引的直接 maps_to/Evidence 已维护并通过 review_changes（均 complete=true、status=unchanged）。
- 最终 npm run check:docs 通过（720 篇 Markdown，0 errors）；三个白名单文件的 git diff --check 通过。未运行游戏测试，未修改游戏源码或测试。

## GALHCG 影响闭环

- 基线：overview 全部分页；Operation 与 UI 两个目标 Concept 的 map_view(files) 分别完整读取 79/99 条原映射。
- 写后：U1 所有职责 Concept 和三个目标 Module 的结构/文件视图按返回游标完整读取；审计了相关 map_quality 项并修正角色未指定与重复宽映射。
- Task 文件定向 refresh 后建立到 Goal/Task 工作流 Concept 的直接 maps_to；Task、协议页、00-index 的 review_changes 均 complete=true 且 unchanged。未写 freshness 观察。

## Execution Receipts

- U1：完成。两个基线映射逐路径登记最终落点；Operation 迁移 58 条、保留 21 条于聚合入口；UI 迁移 58 条、保留 41 条于聚合入口。无节点删除。
- U2：完成。新增领域 7、Engine 4、UI 5 个职责 Module，70 个 Concept 分配一次且结构无环。
- U3：完成。粒度规则进入唯一协议页；指定机制查询、Evidence 与文档闭环完成；最终 docs 与 diff 检查通过。
- 主代理复核：待执行；复核后由主代理更新 Task 状态并归档。

## U1–U3 施工回执（Luna，2026-10-08）

### U1：两个宽映射的逐路径落点

基线来自 2026-10-07 按返回游标完整读取的 map_view(files)：Operation 79 条、UI Workspace Renderer 99 条，complete=true、truncated=false。以下逐条列出 178 条原映射的最终 Concept 落点和保留/迁移依据。

#### Operation EventRun Runtime（79 条基线；21 条仍留在聚合入口）

| 原路径 | 当前直接 Concept 落点 | 处置与理由 |
| --- | --- | --- |
| tests/engine/operation-combination-resolver.test.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-plan-preparation.test.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-scene-actions.test.ts | concept:operation-scene-deck | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-units/receipts/receipt-u0-c-intervention-and-resolution-target-checks.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/arona-clicker/services/operation-target-selection.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-gameplay-b-typed-action-cards-and-target-layers.md | concept:operation-event-run-runtime; concept:ui-workspace-renderer | 保留共享落点；跨机制/跨域证据：concept:operation-event-run-runtime、concept:ui-workspace-renderer |
| docs/plan-work/task-0236-units/u0-b-target-selection-and-preparation.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| docs/docs-829/02-modules/arona-clicker.md | concept:operation-event-run-runtime | 保留跨模块架构/机制导航，不代表单一 Operation 机制 |
| src/arona-clicker/content/operation-samples/carousel-scene-action-slice.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-tactical-rng.test.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0241-units/receipts/receipt-0241-u12-scene-action-admission-separation.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| tests/engine/operation-player-scene-deck.test.ts | concept:operation-scene-deck | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-target-selection.test.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-units/u0-a-target-scope-contract.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| tests/engine/operation-card-candidate-resolver.test.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/gameplay-b-save-resume.test.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-route-evaluator.ts | concept:operation-route-outcome | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/contracts/operation-save.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md | concept:operation-run-lifecycle; concept:operation-student-profile-admission | 保留共享落点；跨机制/跨域证据：concept:operation-run-lifecycle、concept:operation-student-profile-admission |
| src/arona-clicker/services/operation-plan-preparation.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-resolution-planner.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/archive/task-0247-gameplay-b-card-drag-target-and-semantic-audit.md | concept:operation-event-run-runtime; concept:ui-workspace-renderer | 保留共享落点；跨机制/跨域证据：concept:operation-event-run-runtime、concept:ui-workspace-renderer |
| docs/plan-work/task-0236-units/receipts/receipt-u0-d-projection-sample-and-runtime-docs.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/arona-clicker/services/operation-intervention-preview.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0241-units/receipts/receipt-0241-u13-context-card-condition-admission.md | concept:operation-student-profile-admission | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-intervention-preview.test.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-resolution-planner.test.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0240-gameplay-b-operation-card-presentation-and-action-targeting.md | concept:operation-event-run-runtime; concept:ui-workspace-renderer | 保留共享落点；跨机制/跨域证据：concept:operation-event-run-runtime、concept:ui-workspace-renderer |
| tests/engine/gameplay-b-operation-sample.test.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/docs-829/04-mechanisms/00-index.md | concept:operation-event-run-runtime | 保留跨模块架构/机制导航，不代表单一 Operation 机制 |
| src/arona-clicker/services/operation-card-candidate-resolver.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-tactical-definition-validation.ts | concept:operation-content-validation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/runtime-wiring.ts | concept:operation-event-run-runtime | 保留 Runtime 跨服务装配入口 |
| docs/plan-work/archive/task-0244-gameplay-b-demo-graph-map-near-complete-port.md | concept:operation-event-run-runtime | 聚合节点保留追溯；归档 Task 不作当前实现唯一依据 |
| src/arona-clicker/runtime-game-instance.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/carousel-route-slice.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-action-content-validation.ts | concept:operation-content-validation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/contracts/operation-skill.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-units/u0-c-intervention-and-resolution-target-checks.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/arona-clicker/contracts/operation-beat.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/docs-829/06-wiki/20-data-services/definition-authoring.md | concept:operation-content-validation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/carousel-safety-slice.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/gameplay-b-authoring-workflow.test.ts | concept:operation-content-validation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/gameplay-b-strategy-park-virtual-play.test.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md | concept:operation-event-run-runtime | 聚合节点保留追溯；归档 Task 不作当前实现唯一依据 |
| src/arona-clicker/services/operation-tactical-rng.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-units/u0-d-projection-sample-and-runtime-docs.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/arona-clicker/contracts/operation-scene-action.ts | concept:operation-scene-deck | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/data-services/contracts/operation.ts | concept:operation-event-run-runtime | 保留 Data Services 跨模块合同 owner |
| docs/plan-work/task-0236-units/receipts/receipt-u0-a-target-scope-contract.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| docs/plan-work/task-0241-units/receipts/0241-d1-gameplay-b-strategy-park.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| docs/docs-829/03-data-structures/operation-view.md | concept:operation-view-projection | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/docs-829/01-architecture/data-flow.md | concept:operation-event-run-runtime | 保留跨模块架构/机制导航，不代表单一 Operation 机制 |
| docs/plan-work/task-0241-units/receipts/0241-d2-headless-virtual-play.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| tests/engine/student-operation-runtime.test.ts | concept:operation-student-profile-admission | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-progress-evaluator.ts | concept:operation-route-outcome | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/contracts/operation-action.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-units/receipts/receipt-u0-b-target-selection-and-preparation.md | concept:operation-event-run-runtime | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| tests/engine/gameplay-b-scene-action-sample.test.ts | concept:operation-scene-deck | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/gameplay-b-route-sample.test.ts | concept:operation-route-outcome | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-player-scene-deck.ts | concept:operation-scene-deck | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-runtime-service.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/contracts/operation-view.ts | concept:operation-view-projection | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/runtime-options.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-runtime-service.test.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-view-projector.ts | concept:operation-view-projection | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/registry-operation-content-resolver.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/gameplay-b-event-runtime-integration.test.ts | concept:operation-run-lifecycle | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/contracts/operation-resolution.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-definition-validation.ts | concept:operation-content-validation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/contracts/operation.ts | concept:operation-run-lifecycle; concept:operation-student-profile-admission | 保留共享落点；跨机制/跨域证据：concept:operation-run-lifecycle、concept:operation-student-profile-admission |
| tests/engine/operation-participant-admission.test.ts | concept:operation-student-profile-admission | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-entry-service.ts | concept:operation-student-profile-admission | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/operation-view-projector.test.ts | concept:operation-view-projection | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/services/operation-combination-resolver.ts | concept:operation-action-planning | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/engine/gameplay-b-strategy-park-sample.test.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |

提取或复用节点：concept:operation-action-planning、concept:operation-route-outcome、concept:operation-view-projection、concept:operation-content-validation、concept:operation-run-lifecycle、concept:operation-scene-deck、concept:operation-sample-content、复用 concept:operation-student-profile-admission。operation-observation 与 Operation EventRun Runtime 的稳定 ID 均保留；聚合摘要收窄为共享合同、装配和整体上下文。历史 Task/Receipt 仅保留追溯作用。无节点被删除。

#### UI Workspace Renderer（99 条基线；41 条仍留在聚合入口）

| 原路径 | 当前直接 Concept 落点 | 处置与理由 |
| --- | --- | --- |
| src/ui/css/conversation.css | concept:ui-story-chat-presentation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/css/cards.css | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| tests/ui/shop-modal.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| docs/plan-work/task-0236-gameplay-b-typed-action-cards-and-target-layers.md | concept:operation-event-run-runtime; concept:ui-workspace-renderer | 保留共享落点；跨机制/跨域证据：concept:operation-event-run-runtime、concept:ui-workspace-renderer |
| src/ui/components/inventory-workspace.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/update/ui-behaviors.ts | concept:ui-incremental-refresh | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/workspace/workspace-router.ts | concept:ui-workspace-routing | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/tooltip-detail-spot.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/popovers.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/inventory-workspace.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| src/ui/components/tabs.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| tests/ui/service-workspace.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| src/ui/components/tooltip-reveal.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/global-enhancement-select.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/selector-page.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/overlay-drag.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/css/layout.css | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/components/workspace-frame.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| tests/ui/modal.test.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/inventory-view.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/components/init-select.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| tests/ui/gameplay-b-operation-controller.test.ts | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/import-export.ts | concept:runtime-datapack-editor-ui | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/css/toast.css | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/tooltip-detail-area.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/workspace-frame.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| docs/plan-work/task-0236-units/u1-attached-action-card-layer.md | concept:ui-workspace-renderer | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| docs/plan-work/task-0236-units/receipts/receipt-u1-b-card-position-and-interaction.md | concept:ui-workspace-renderer | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/ui/components/tooltip-detail-resource.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/datapack-workspace-state.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| src/ui/components/tooltip.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/archive/task-0247-gameplay-b-card-drag-target-and-semantic-audit.md | concept:operation-event-run-runtime; concept:ui-workspace-renderer | 保留共享落点；跨机制/跨域证据：concept:operation-event-run-runtime、concept:ui-workspace-renderer |
| src/ui/components/production.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/css/chat.css | concept:ui-story-chat-presentation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/inventory-view.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| src/ui/css/codex.css | concept:runtime-datapack-editor-ui | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/enhancements.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/file-download.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/css/story-overlays.css | concept:ui-story-chat-presentation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/tooltip-detail-item.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/css/modal.css | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/update/ui-surface.ts | concept:ui-workspace-routing | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0240-gameplay-b-operation-card-presentation-and-action-targeting.md | concept:operation-event-run-runtime; concept:ui-workspace-renderer | 保留共享落点；跨机制/跨域证据：concept:operation-event-run-runtime、concept:ui-workspace-renderer |
| src/ui/css/contacts.css | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/update/ui-update-types.ts | concept:ui-incremental-refresh | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/scroll.test.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/spot-payment-modal.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| src/ui/components/story-workspace.ts | concept:ui-story-chat-presentation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/operation-card-relation.test.ts | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/css/operation-workspace.css | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/contacts-workspace.ts | concept:ui-story-chat-presentation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/rail.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/update/ui-update-dispatcher.ts | concept:ui-incremental-refresh | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/service-workspace.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/operation-card-relation.ts | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/right-panels.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/components/tooltip-detail-codex.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/topbar-settings-workspace.test.ts | concept:ui-workspace-renderer | 保留本轮非目标页面/框架的集成验证 |
| src/ui/components/tooltip-detail-init.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0249-gameplay-b-operation-workspace-panels-and-map-popup.md | concept:ui-workspace-renderer | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/ui/components/workspace-titlebar.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/css/chat-input.css | concept:ui-story-chat-presentation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/tooltip-enhancement.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/ui-update-dispatcher.test.ts | concept:ui-incremental-refresh | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/workspace-lifecycle.test.ts | concept:ui-workspace-routing | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/focus.test.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/css/equipment.css | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/components/tooltip.test.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/popovers.test.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/center-panel.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/components/errors.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/workspace/datapack-workspace-state.ts | concept:runtime-datapack-editor-ui | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-units/u1-b-card-position-and-interaction.md | concept:ui-workspace-renderer | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/ui/css/popover.css | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/main.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/components/tooltip-detail-enh.ts | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/shop.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/components/character-workspace.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/components/operation-workspace.ts | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/gameplay-b-strategy-park-map.test.ts | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/plan-work/task-0236-units/receipts/receipt-u1-attached-action-card-layer.md | concept:ui-workspace-renderer | 聚合节点保留追溯；Task/Unit/Receipt 以源码和当前机制页核实 |
| src/ui/components/settings-workspace.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| tests/ui/toast.test.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/docs-829/06-wiki/50-ui/workspace-routing.md | concept:ui-workspace-routing | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/datapack-workspace-order.test.ts | concept:runtime-datapack-editor-ui | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/workspace/workspace-renderer.ts | concept:ui-workspace-renderer | 保留 Workspace 聚合渲染入口 |
| src/ui/controller-actions-operation.ts | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/focus.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| docs/docs-829/06-wiki/50-ui/refresh-update.md | concept:ui-incremental-refresh | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/workspace-router.test.ts | concept:ui-workspace-routing | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/css/story-nav.css | concept:ui-story-chat-presentation | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/modal.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/arona-clicker/content/operation-samples/carousel-safety-copy.ts | concept:operation-sample-content | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/components/app-shell.ts | concept:ui-workspace-renderer | 保留通用 Workspace 页面与框架组合入口 |
| src/ui/css/gear.css | concept:ui-presentation-layer | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| src/ui/scroll.ts | concept:ui-overlay-focus-scroll | 迁移/复用到该职责节点；Evidence 与角色已核验 |
| tests/ui/operation-workspace-view.test.ts | concept:ui-operation-workspace | 迁移/复用到该职责节点；Evidence 与角色已核验 |

提取节点：concept:ui-workspace-routing、concept:ui-incremental-refresh、concept:ui-operation-workspace、concept:ui-overlay-focus-scroll；复用 concept:ui-presentation-layer、concept:ui-story-chat-presentation 和 concept:runtime-datapack-editor-ui。Operation sample 的数据文件归入 concept:operation-sample-content。Workspace Renderer 保留为组合入口；无节点被删除。

迁移批次对每个 Evidence 文件通过 preview_many 获取 available token，每批最多 8 个请求。plan_map_updates 只支持纯 upsert；先规划 upsert，再对含旧边删除的同一原子批运行 update_map(dry_run=true)，valid=true 后正式提交。全部批次成功。纯 delete 无 planner 支持，由 update_map dry-run 校验后提交，并在本回执列明。写后 map_view(files) 对相关 Concept 逐页验收。audit_map_quality 的新鲜度 unknown 表示没有此前保存的观察；不据此推断 stale。

### U2：职责分区

施工前完整结构读取了领域 43、Engine 18、UI 9 个直系 Concept（合计 70，含 U1 新节点）。保留既有节点 ID，新增 16 个有当前文档 Evidence 的子 Module，逐项替换 70 条父 Module→Concept 边。plan_map_updates 对 16 nodes、86 edges 规划完整；dry-run valid=true，正式提交成功。70 个 Concepts 恰好分配一次，contains 结构无环、无空节点。

| 父 Module | 职责子 Module | Concept 成员（完整稳定 ID） |
| --- | --- | --- |
| module:arona-clicker-domain | module:domain-state-query — 领域状态与只读查询 (3) | concept:player-state-init-lifecycle, concept:player-state-read-model-boundary, concept:state-mutation-event-reconciliation |
| module:arona-clicker-domain | module:domain-world-lifecycle — 世界线与设施运行 (4) | concept:init-service, concept:runtime-world-content-coordinator, concept:spot-functionality-system, concept:milestone-system |
| module:arona-clicker-domain | module:domain-character-growth — 角色获取与成长 (6) | concept:affection-system, concept:character-roster-and-acquisition, concept:character-system, concept:cultivate-system, concept:gear-system, concept:gacha-service |
| module:arona-clicker-domain | module:domain-facilities-economy — 设施与经济服务 (6) | concept:enhancement-service, concept:item-service, concept:loot-system, concept:passive-pool-system, concept:shop-service, concept:spot-service |
| module:arona-clicker-domain | module:domain-story-presentation — 剧情与主题表现 (8) | concept:color-equipment-system, concept:color-system, concept:color-unlock-reactor, concept:entity-presentation-service, concept:story-content-catalog, concept:story-service, concept:theme-content-editor-service, concept:user-theme-service |
| module:arona-clicker-domain | module:domain-operation — Operation 运行域 (10) | concept:operation-action-planning, concept:operation-content-validation, concept:operation-event-run-runtime, concept:operation-observation, concept:operation-route-outcome, concept:operation-run-lifecycle, concept:operation-sample-content, concept:operation-scene-deck, concept:operation-student-profile-admission, concept:operation-view-projection |
| module:arona-clicker-domain | module:domain-content-assembly — 内容与 Runtime 装配 (6) | concept:content-definition-builders, concept:default-datapack, concept:game-instance-runtime-composition, concept:information-reveal-system, concept:runtime-content-lifecycle, concept:runtime-effect-reactor |
| module:engine | module:engine-expression-numeric — 表达式与数值 (6) | concept:engine-definition-factories, concept:extra-value-system, concept:game-num-system, concept:stats-service, concept:tag-stat-service, concept:value-system |
| module:engine | module:engine-events-effects — 事件、Effect 与 Trigger/Affector (7) | concept:affector-active-contributions, concept:affector-condition-freshness, concept:affector-lifecycle, concept:affector-per-tick-effects, concept:effect-engine, concept:event-runtime, concept:trigger-system |
| module:engine | module:engine-derived-queries — 条件与派生查询 (3) | concept:condition-dependency-invalidation, concept:condition-system, concept:visibility-condition-refresh |
| module:engine | module:engine-tick-session — Tick 与 Session (2) | concept:session-service, concept:tick-resource-settlement |
| module:game-ui | module:ui-command-read — 命令与只读上下文 (1) | concept:ui-command-to-runtime |
| module:game-ui | module:ui-navigation-refresh — 导航与增量刷新 (2) | concept:ui-incremental-refresh, concept:ui-workspace-routing |
| module:game-ui | module:ui-feature-workspaces — 功能工作区与交互 (3) | concept:ui-operation-workspace, concept:ui-overlay-focus-scroll, concept:ui-workspace-renderer |
| module:game-ui | module:ui-theme-story-presentation — 主题与剧情表现 (2) | concept:ui-presentation-layer, concept:ui-story-chat-presentation |
| module:game-ui | module:ui-content-authoring — 游戏内内容编辑 (1) | concept:runtime-datapack-editor-ui |

写后 map_view(structure)：Engine 23 nodes/22 edges、UI 15/14，均 complete=true；领域首面 50 nodes/50 edges，按 next_cursor 续读剩余 1 Concept 后 complete=true。命令 Concept 保持稳定 owner，未增加推测性协作边。

### U3：协议与定向查询

已在 docs/ai/galhcg-project-map.md 加入 Module/Concept 粒度、复用/提取、聚合 Evidence 不重复、单一主要归属、软阈值、历史追溯与逐路径迁移防丢规则。docs/plan-work/00-index.md 的 Task 入口由主代理先前登记，本轮未改索引。

map 搜索 Operation Action Planning、Scene Deck、Run Lifecycle/Save-Resume、View Projection，UI Workspace Routing、Incremental Refresh、Overlay Focus/Scroll，Engine Affector、Tick，均 complete=true、truncated=false。map_view(files) 已读完具体节点：Action Planning 18 个文件按 next_cursor 读两页；其余均完整单页；证据覆盖源码/测试，View Projection 也有当前结构文档。

audit_map_quality 对本轮 17 个新建/复用/聚合 Concepts 逐项分页完毕，所有角色提示 roles=unspecified 已处理；保留边中未发现 Evidence 缺失。剩余 saved_freshness_unknown 是地图没有持久 freshness 观察。本轮以 version_token 读取了本次迁移文件，但没有运行 verify_freshness，故不声称 freshness 本轮已检查。

主代理报告的开工验证：npm run check:docs 通过（720 篇 Markdown，0 errors），两条既有路径 git diff --check 通过。本轮最终 npm run check:docs 再次通过（720 篇 Markdown，0 errors）；三个白名单文件的范围 git diff --check 通过。未运行游戏测试；未修改源码/测试；保留工作区其他既有变更；未 git commit。
## 剩余工作

- 本 Task：仅待主代理复核；复核完成后由主代理关闭并按项目规则归档。
- 后续方向：Data Services、工程支持和规划记录等其他模块的粒度治理，GALHCG 服务产品体验改造；本 Task 不承诺全图质量已完成。

## 相关路由

- [[docs/ai/galhcg-project-map]]
- [[docs/ai/task-read-set-routing]]
- [[docs/docs-829/06-wiki/00-index]]
- [[task-0223-ai-collaboration-docs-and-galhcg-discovery]]
- [[draft-0195-galhcg-content-maintenance-experience]]
