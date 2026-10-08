# Task 0235：面向零背景读者的全项目 Code Review 与 Wiki 导览

状态：completed — 2026-10-05 完成 15 个 Patch Unit 的并行代码审查、Wiki 修订、Receipt 与覆盖矩阵；已建立 P2/P3 修复后续 Task。

## 目标

以完全不熟悉 ACProgram 的读者为对象，对当前项目实现开展按模块分批的 Code Review，并据源码与测试补齐、简化和互相索引 `docs/docs-829/` 中的架构、模块、数据、机制与功能 Wiki。交付既要说明“系统由什么组成、一次操作如何运行、状态在哪里变化”，也要留下有代码和测试依据、可执行跟进的审查发现。

本 Task 的核心验收是：读者从 `docs/docs-829/00-INDEX` 的新人入口出发，不借助本 Task 的聊天背景，可以循序回答项目入口、Datapack 装载、状态归属、事件联动、UI 读写边界、主要玩法流程和验证命令，并能从每个解释跳到对应源码、测试和更深层权威文档。

## 设计边界

- 本 Task 包含：审查 `src/` 与 `tools/datapack-editor/` 中当前非生成实现；按主要模块核对关键测试；检查 `01-architecture/`、`02-modules/`、`03-data-structures/`、`04-mechanisms/` 和 `06-wiki/` 的当前说明；建立新人首读页；按 15 个 Patch Unit 重写或修正 Wiki 和跨页路由；在 Receipt 中记录代码审查发现与未覆盖边界。
- 审查主路径至少包括：应用启动和 Runtime 装配、Datapack 启用与 Registry、Lobby/Init/会话/Tick、PlayerState 和写入/事件/派生、只读 ReadModel/UI 更新、Save/Load/Reset、角色获取与成长、Gameplay B EventRun 生命周期、Runtime Editor 与独立 Datapack Editor 的职责边界、测试/Schema/架构检查工具。
- 代码审查范围：建立 `src/`、`tools/datapack-editor/`、`scripts/` 的源文件清单，覆盖所有代码 Module 的职责/依赖边界，并围绕主用户路径和高影响跨模块路径检查具体实现及相邻代码。此为项目级边界和流程 Review，不宣称逐行审查每个源文件。`tests/` 用于验证被审查行为与测试缺口，不要求逐行审查全部测试辅助代码。初次盘点基线为 `src/` 497 个文件、`tests/` 219 个文件，后续以施工开始时重新生成的清单为准。
- 新人文字规则：先用简明中文回答页面标题提出的问题；术语首次出现时解释；把静态依赖、运行时调用、数据流、事件响应分别标清；每页给出适用的源码符号、验证测试、前后阅读链接。概览先讲用途，再逐步展开入口、状态 owner、调用顺序、失败边界和深入细节。
- Wiki 维持单一权威：字段和类型归 `03-data-structures/`，算法和状态变更步骤归 `04-mechanisms/`，职责和源码入口归 `02-modules/`，跨模块概念流程归 `06-wiki/`；概览只摘要并链接，不复制完整字段表或算法正文。
- 受众边界：`docs/docs-829/` 是人类读者与 Agent 共用的当前项目事实层；文字以新人可读为标准，同时保留精确源码符号、测试路径、owner 和流程关系。Agent 通过 `AGENTS.md` 路由到 `docs/docs-829/00-INDEX`，所以新人导览会同时改善 Agent 获取项目上下文的入口。本 Task 不改写 `AGENTS.md` 或 `docs/ai/` 中的协作/提示协议；当前 Wiki 不是单纯的人类说明页。
- Code Review 发现采用 P0–P3 严重度：P0 为数据丢失/安全或无法继续使用的阻断问题；P1 为主要用户流程错误；P2 为局部功能/边界条件错误；P3 为低影响但有证据的健壮性/可维护性问题。每项列出触发条件、实际行为、影响、源码符号/路径、相关测试证据、修复建议和置信度。仅记录能从当前实现证明的问题；文档缺口与代码问题分开。有效缺陷的修复另立 Task，本 Task 不顺手修改产品源码。
- 明确非目标：本 Task 不修复运行时代码、不改玩法或数据合同、不做 Schema/存档变更、不写迁移层、不恢复或引用 `docs-828` 快照正文、不重写 `AGENTS.md` / `docs/ai/` 协议、不把所有源码逐文件复述成 Wiki、不按页数或字数制造重复内容。
- 当前项目 Wiki 为六个功能分区，模块卡涵盖应用、Data Services、Engine、AronaClicker Domain、UI 与独立 Datapack Editor；未发现独立新人首读页面。以上为本轮路径盘点结果，仍须在审查中回到源文件和测试核实实现。

## 当前事实与代码落点

| 已核实事实 | 依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 总入口把主干阅读路由为 UI → App/Runtime → Datapack/Registry → Engine/领域服务 → PlayerState/派生 → GameView/UIContext/UI。 | `docs/docs-829/00-INDEX.md`、`01-architecture/overview.md` | 新人页可沿已有骨架展开，但须对照真实启动与调用代码校验。 |
| 架构、模块卡、数据结构、机制与功能 Wiki 有各自索引；06-Wiki 分为 App Runtime、Data Services、领域、Engine、UI、Engineering Support 六区。 | `01-architecture/`、`02-modules/00-index.md`、`03-data-structures/00-index.md`、`04-mechanisms/00-index.md`、`06-wiki/00-index.md` 及六个分区索引 | 15 个 Unit 按现有职责分区核对并改进互链。 |
| 当前有启动/数据流/依赖说明、6 张模块卡、7 张数据结构页和多张机制及功能流程页。 | 当前上述目录 `rg --files` 清单 | 以补全和分层为主；只有缺少稳定概念入口时才新建页。 |
| `src/` 与 `tests/` 在本轮盘点分别有 497、219 个文件；GALHCG 概况有 8 个 Module 和 78 个 Concept，但本轮结构遍历分页未完成。 | `rg --files src/tests`；`mcp__galhcg_project_map__overview(project_id="acprogram")` 的汇总字段 | 仅作为开工基线和导航，不等同于逐文件审查完成，也不把未完成的分页当作完整地图。 |
| 按 `onboarding`、`新手入门`、`project overview` 等词查询 Concept 未发现明确新人导览概念。 | GALHCG `search(mode="map", node_types=["Concept"])` | 配合实际文件清单，在 06-Wiki/01-architecture 中确认唯一新手入口位置。 |

上述文档与地图只作 Read Set 路由；实现事实须由每个 Unit 指定的当前源码和测试确认。`docs/plan-work/archive/` 与 `docs-828` 不作默认 Read Set。

## 施工切片

本 Task 有 15 个 Unit，因此 Unit 正文与 Receipt 放在 `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/` 下。按下方列出的顺序执行；每个 Unit 必须先完成其分配模块和关键路径的代码/测试审查，再改它白名单中的 Wiki。若审查发现缺陷，Receipt 记录证据并建立后续修复 Task，不在 Wiki Unit 内改产品代码。

1. [[archive/task-0235-newcomer-oriented-project-code-review-units/u01-newcomer-entry]] — 新人首读路线与总览
2. [[archive/task-0235-newcomer-oriented-project-code-review-units/u02-startup-and-modules]] — 启动、装载与模块入口
3. [[archive/task-0235-newcomer-oriented-project-code-review-units/u03-module-cards]] — Engine、领域、UI 与编辑器模块卡
4. [[archive/task-0235-newcomer-oriented-project-code-review-units/u04-data-structures]] — 数据结构与状态归属
5. [[archive/task-0235-newcomer-oriented-project-code-review-units/u05-state-and-events]] — 状态变更、事件和操作投影
6. [[archive/task-0235-newcomer-oriented-project-code-review-units/u06-mechanisms]] — 装载、生产与领域生命周期
7. [[archive/task-0235-newcomer-oriented-project-code-review-units/u07-wiki-app-runtime]] — App Runtime 功能 Wiki
8. [[archive/task-0235-newcomer-oriented-project-code-review-units/u08-wiki-data-services]] — Data Services 功能 Wiki
9. [[archive/task-0235-newcomer-oriented-project-code-review-units/u09-wiki-domain]] — AronaClicker 领域功能 Wiki
10. [[archive/task-0235-newcomer-oriented-project-code-review-units/u10a-wiki-engine-foundations]] — Engine 契约与求值 Wiki
11. [[archive/task-0235-newcomer-oriented-project-code-review-units/u10b-wiki-engine-reactive]] — Engine 响应、可见性与 Tick Wiki
12. [[archive/task-0235-newcomer-oriented-project-code-review-units/u11a-wiki-ui-input-read]] — UI 输入与只读查询 Wiki
13. [[archive/task-0235-newcomer-oriented-project-code-review-units/u11b-wiki-ui-navigation]] — UI 路由、刷新与表现 Wiki
14. [[archive/task-0235-newcomer-oriented-project-code-review-units/u12a-wiki-tooling-tests]] — 测试与 Schema 工具 Wiki
15. [[archive/task-0235-newcomer-oriented-project-code-review-units/u12b-wiki-tooling-analysis]] — 架构、调用图与文档工具 Wiki

## Review 覆盖矩阵、发现与边界

开工时重新盘点得到 `src/` 498 个文件、`tests/` 220 个文件、`tools/datapack-editor/` 28 个文件、`scripts/` 8 个文件。下表按代码模块、Wiki 功能区与关键玩家流程记录审查路径；这是一轮有 Read Set 和高影响流程边界的项目级 Review，不声称逐行审查全部文件。

### 代码模块与功能 Wiki

| 范围 | 入口 / 主题 | Patch Unit | 主要代码/测试证据 |
| --- | --- | --- | --- |
| App 与产品 Runtime | 启动、组合、PackManager、服务装配与 GameInstance 生命周期 | U01、U02、U07 | `src/ui/main.ts`、`src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime*.ts`；`arona-runtime-pack.test.ts`、`pack-manager.test.ts` |
| Data Services | Datapack 解析/启用、Registry、authoring、存储与资源 | U02、U04、U08 | `src/data-services/`；pack parser/manager、registry、definition resolution、storage 对应测试 |
| Engine | 事件/契约/求值、Effect/Trigger/Affector、Visibility/Stats、GameNum/Tick | U05、U06、U10a、U10b | `src/engine/` 与 Runtime wiring；EventBus、Trigger、GameNum、Tick、Session、Visibility、Stats 对应测试 |
| AronaClicker Domain | PlayerState、状态写入口、Init/Spot、角色招募与培养、Story/Chat、Operation owner | U03、U04、U05、U06、U09 | `src/arona-clicker/`；mutation、Init lifecycle、gacha/cultivate、story、Operation 对应测试 |
| 游戏 UI | Controller 命令、UIContext/ReadModel、Workspace route、刷新、主题与表现 | U03、U11a、U11b | `src/ui/`；controller、context、workspace、refresh 和 presentation 对应测试 |
| 独立 Datapack Editor | Editor 启动、Schema 来源与同步 | U03、U12a | `tools/datapack-editor/`、`scripts/gen-engine-schema.mjs`；Schema sync 与 Runtime Editor launcher 测试 |
| 工程分析与开发验证 | 架构边界检查、UI callgraph、文档检查/报告、Vitest 命令 | U12a、U12b | `scripts/`、`package.json`；本轮实际执行 architecture check 与 UI callgraph summary，不运行产品 Vitest |
| Wiki：App Runtime | App 启动、包应用、GameInstance 生命周期 | U07 | 启动 / Registry / Session 源码及包装载、Runtime pack 测试 |
| Wiki：Data Services | Datapack 流、Registry、authoring、持久化与资产 | U08 | Registry、PackManager、作者策略和 storage 源码及测试 |
| Wiki：AronaClicker Domain | 状态、世界线、角色获得成长、Story/Chat | U09 | 领域服务、PlayerState、状态生命周期和测试 |
| Wiki：Engine | 核心契约、表达式、响应事件、Visibility/Stats、Tick | U10a、U10b | Engine 契约与求值/事件/Tick 源码及对应测试 |
| Wiki：UI | 命令/查询、Workspace 路由、刷新、主题与表现 | U11a、U11b | Controller/ReadModel/UIContext/Workspace 源码与相应测试 |
| Wiki：Engineering Support | 测试/Schema、架构检查、UI callgraph、文档工具 | U12a、U12b | package scripts 与工具脚本；静态能力和工具限制与实现对照 |

### 玩家与运行关键流程

| 流程 | 读者可走的代码关系 | 证据 / 边界 |
| --- | --- | --- |
| 浏览器启动并装载内容 | `main.ts` 调用 bootstrap、恢复包库、应用启用集；Runtime 将定义装入 Registry 后挂载 Controller | U01/U02/U07/U08；`arona-runtime-pack.test.ts`、`pack-manager.test.ts` |
| 升级一个 Spot | UI Controller → GameCommands → SpotService 校验 → Mutation 原子提交资源与等级 → EventBus 通知订阅系统；Controller 独立刷新右面板，UIContext 查询 GameView | U05/U09/U11a；`game-instance.test.ts`、`spot-payment-modal.test.ts`、`controller-events.test.ts`。三个测试各证明自己的局部断言，没有端到端集成测试，本轮未将其说成端到端覆盖。 |
| 切换世界线或移动区域 | InitService 校验/快照/重绑服务；Area 移动更新位置、访问记录并触发对应进入流程 | U06/U09；`init-global-lifecycle.test.ts` 与领域生命周期测试 |
| 招募、培养与读取结果 | GachaService / 培养计算 → mutation 写入 PlayerState 与统计 → GameView/通讯录查询投影供 UI 消费 | U06/U09/U11a；`gacha-service.test.ts`、`cultivate-system.test.ts`、角色存档测试 |
| Tick 与事件响应 | SessionService 调用宿主 Tick；事件按 EventBus 当前同步/flush 状态派发；Trigger/Affector 只按声明订阅并更新或重算派生系统 | U05/U06/U10b；`event-bus.test.ts`、`trigger-system.test.ts`、`tick-system.test.ts`、`session-service.test.ts` |
| Gameplay B Run | ID-only Operation Entry 进行准入；私有 OperationRuntimeService 持有 EventRun；冻结规则上的纯计划/目标选择与原子提交经 OperationView 向 UI 提供只读投影，checkpoint 可通过 SaveData 单独保存 | U03/U05/U06/U10a/U10b；Operation Runtime / target selection / plan preparation / save-runtime 测试。本轮不声称完成 Task 0236 的 Edge 视觉验收；Operation Workspace 组件细节和关联 Evidence 需待该 Task 稳定后复核。 |

### 已确认的 Review 发现

| 严重度 | 发现 | 依据与处理 |
| --- | --- | --- |
| P2 | EventBus 在 `flush()` 批量派发期间若任一订阅者抛错，`flushing` 不会复位；后续 `emit()` 只排队、后续 `flush()` 直接返回，当前取出批次中的后续事件也会丢失，事件响应停止。 | `src/engine/core/event-bus.ts`、`src/engine/runtime/session-service.ts`；既有 `tests/engine/event-bus.test.ts` 覆盖正常嵌套排队，但无处理器异常恢复案例。仅记录，不改产品代码；修复另立 [[task-0237-event-bus-flush-exception-recovery]]。 |
| P3 | 架构检查器仍保留两个指向当前不存在文件的精确整文件豁免；若同路径文件重新出现，依赖边界检查将跳过它。 | `scripts/check-architecture-boundaries.mjs` 中 `compatibilityShims`/`checkBoundary()`；以工具工作原理证据确认。仅记录，不改脚本；清理另立 [[task-0238-remove-stale-architecture-check-exemptions]]。 |

非缺陷测试覆盖观察：`buildGameView()` 没有单独直接调用的单元测试；已有 `GameInstance.getView()` 集成断言覆盖多个可观察字段。本轮将此记为低优先级覆盖建议，不推断为产品行为缺陷，也未单独立 Task。`TickSystem` 直接递增 `totalFrames` 仍是待裁定的 owner concern；[[docs/docs-829/05-conventions/architecture-discipline]] 明确要求结合契约与测试裁定，本轮未把它评级为违规。

范围限制：未逐行阅读所有 498 个 `src/` 文件或 220 个测试文件；每页按 Unit Read Set 审查关键入口和拒绝/失败路径。未运行产品 Vitest。Task 0236 的 Gameplay B Operation 代码当前已有源/测试审查，但 Edge 实际视觉验收由其未完成工作负责，本 Task 不覆盖该验收；相关两个聚合地图概念的 Evidence 仍等待该 Task 稳定后统一复核。

## 测试与验收

- [x] 覆盖矩阵包含全部代码 Module、六个 Wiki 功能区和关键路径；记录源码入口/调用关系、测试证据、审查状态与明确排除项；未声称逐行审查全部文件。
- [x] 新人首读页从 `docs/docs-829/00-INDEX` 可达，提供术语和渐进路线，回答启动、包装载、状态/事件、UI 查询、持久化与验证工具问题。
- [x] 新人首读页也可从 `AGENTS.md` 使用的当前 Wiki 总入口发现；保留项目事实所需源码/测试定位信息；未改 Agent 专用协作规则。
- [x] 至少一条 Spot 升级操作从 UI Controller 经 Runtime / Service / Mutation 追到 PlayerState 更新、事件通知、派生响应、只读查询与相关测试；文档区分直接调用、事件和数据流，并注明各测试断言边界。
- [x] 01–04 当前分区和 06-Wiki 六个功能区的范围页均在覆盖矩阵与 Unit Receipt 中记录审查结果，并按需修订术语、源码、测试和前后阅读链接。
- [x] Code Review 发现均记录严重度、条件、实际行为、影响、源码/测试证据、建议与置信度；未证实的 `totalFrames` owner 问题标记为待裁定 concern。P2/P3 修复另立 Task。
- [x] 新人页和分区 Wiki 使用渐进解释，并区分静态依赖、运行时调用、数据流和事件响应；未以目录清单或术语堆叠取代说明。
- [x] `npm run check:docs` 通过；`git --no-pager diff --check` 通过；任务负责人按首读路线检查总入口可回答的核心问题并能定位源码/测试。
- [x] 全部 15 个 Unit 均写入 Receipt；覆盖边界、并发 Task 0236 未完成的 Edge 视觉验收，以及需另立的修复 Task 均已说明。

## 当前核验（2026-10-05）

- 已按 `AGENTS.md` 和 `docs/ai/` 协作协议施工；每个 Unit 按自身最小 Read Set 审查源码与测试并填写 Receipt。
- 初始盘点 497 个 `src/` / 219 个 `tests/` 文件；施工期间并行 Task 0236 增加文件，收尾盘点为 498 / 220；另覆盖 28 个 Datapack Editor 文件与 8 个脚本文件的模块/入口职责，不宣称逐文件审查。
- GALHCG 已确认项目 `acprogram`；搜索未发现既有新人首读 Concept，已补 Wiki 首读页。项目树遍历不完整，不用作全图覆盖证明。
- `npm run check:docs` 通过（681 篇 Markdown，0 errors）；`git --no-pager diff --check` 通过。`npm run check:architecture` 与 `npm run ui:callgraph -- --summary` 均通过。未运行 Vitest；Receipt 列出已阅读的现有测试及未执行状态。
- 新人冷读：从 `00-INDEX` 首读链接依次回答“从哪启动、内容如何进 Runtime、状态由谁持有、UI 从哪里读、遇到具体问题接下来读什么”，并能从各页定位源码和测试。

## GALHCG 影响闭环

- 发现路径：搜索 `onboarding`、`新手入门`、`project overview`、`architecture overview` 未发现新人首读 Concept；检查总入口、架构路由和六个 Wiki 分区后新增 `01-architecture/first-read.md`。
- 变更审查：15 个 Unit 分别对其修改页面和 Receipt 执行 `review_changes`，读取直接 Evidence owner 与分页；负责人对新增 Task、索引和 U01/U03/U05/U06/U11a 改动补做收尾复核。
- 地图维护：各 Unit 更新 Wiki 直接 maps_to / Evidence；归档后为 Task 根文件、15 个 Unit、两个修复 Task、计划索引及新人入口完成映射和 freshness 核验。新增已确认的 `concept:newcomer-first-read` 连接 docs-829 总入口和新人首读页。最终 Wiki 复核只剩两个聚合节点待 Task 0236 稳定后复核：`concept:operation-event-run-runtime` 的 Evidence 涉及 `operation-view.md`、`operation-runtime.md` 与 Operation Runtime 契约/验证源码；`concept:ui-workspace-renderer` 涉及 `refresh-update.md`、`workspace-routing.md`、Operation workspace 组件/CSS/测试。对应文档级 maps_to 边已刷新；保留聚合节点的 stale 状态，不将其写成 Edge 视觉验收完成。

## 剩余工作

- 本 Task：已完成审查和 Wiki 导览交付；Task 与全部 15 个 Unit 已归档。
- 后续：EventBus P2 修复见 [[task-0237-event-bus-flush-exception-recovery]]；架构检查器 P3 失效豁免见 [[task-0238-remove-stale-architecture-check-exemptions]]。`totalFrames` 写入 owner 仍等待架构裁定；Task 0236 的 Edge 视觉验收由其自身继续，不属于本 Task 的验收。

## 相关路由

[[docs/docs-829/00-INDEX]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/goal-workflow]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/docs-829/05-conventions/doc-maintenance]] · [[docs/ai/galhcg-project-map]]
