# Task：PB-26 删除旧特判并完成跨版本回归

状态：completed — 已按可替代证据清理 Carousel UI fallback，并完成 Operation 样例、Strategy Park 地图、作者 Scene 与虚拟游玩的交叉回归（2026-10-08）。
> Goal Owner 统一裁定（2026-10-08）：PB-26 的施工规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在裁定前写成“待定 / 待确认”的历史措辞。仅符合总裁定列出的升级条件时暂停。本 Task 已完成，裁定正文未改。

## 目标

在真实 Operation 内容迁移到最终 Scene 合同后，删除已经没有内容消费者的 Carousel 阶段判断、旧表现回退、重复选择器和无意义适配；旋转木马作为普通内容仍完整可玩。Strategy Park 专属地图版式保留。通过 Operation 的实际点击流程交叉回归 V1 旧内容与 V2 原子场景流程。

## 设计边界

- 本 Task 包含：逐条证明旧 UI 分支已由内容/View 合同取代；只删除已迁移且无消费者的 Carousel 分支；复测阶段 III/IV 引入的多 Scene、群体目标、M 选 N、小商店、重入和 Save/Resume。
- 新增 Scene 的状态、行为、目标、费用、完成与下一 Scene 由 Operation Runtime / 唯一内容合同负责；UI 只显示 View 投影并经 Controller 发命令。
- 旋转木马内容本身保留作普通 Operation 内容和回归用例，不得因为移除 UI 特判而删事件、规则或测试数据。
- Strategy Park 的 13 地点地图、布局、路线可用状态和地图弹层是合法的内容专属表现；保留 renderStrategyParkMap、相应 MAP 数据及可见回归。它不等于 Carousel 阶段判定，也不是本 Task 的删除目标。
- 与事件标题、学生阵容或自定义地图等相关的其他硬编码，只有确认已被阶段 IV/V 的稳定内容表现合同取代时才处理；缺少替代表现时保留或上报，不显示空白。
- 明确非目标：再改写 Scene Runtime、引入通用地图编辑器或万能 SceneManager、删掉已迁移的 Carousel 样例、给旧存档加兼容迁移。
- 已裁定来源：draft-0255-gameplay-b-atomic-scenes-phase-v-authoring；PB-13～PB-25 的已实现内容与测试是删除判断依据。

## 施工前基线与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Operation UI 当前对 Carousel 有具体内容绑定：operation-workspace.ts 导入 CAROUSEL_SAFETY_IDS、CAROUSEL_SCENE_ACTION_IDS、CAROUSEL_SAFETY_PRESENTATION；依地点 ID 推断 battle/标题，依 Fact/Item ID 显示专用名称，并为普通 Event 回退到 Gameplay B Presentation。 | src/ui/components/operation-workspace.ts；src/arona-clicker/content/operation-samples/carousel-*.ts；src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts | 这些分支须逐条映射到 PB-13～PB-25 已交付的 Scene 状态/内容表现/View 字段后才删；不能只删除 import 造成通用 UI 丢失标题、状态或名称。 |
| 办公室入口目前静态列出 Carousel 与 Strategy Park 示例 Event；Controller 收到 data-operation-start 后以 eventId 启动。 | src/ui/components/center-panel.ts；src/ui/controller-actions-operation.ts；tests/ui/gameplay-b-operation-controller.test.ts | 先完成 PB-25 数据驱动入口；PB-26 删除 Carousel 专用入口卡或由普通内容列表呈现，不破坏通用 Event 启动和 Run 恢复。 |
| Strategy Park 地图显示被限于 Strategy Park Event；测试覆盖 13 个节点、地图区域、当前/已访问状态、出口可用/锁定以及其他 Carousel Event 不显示该图。 | src/ui/components/operation-workspace.ts 的 renderStrategyParkMap()/operationMapPresentation()；src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts；tests/ui/gameplay-b-strategy-park-map.test.ts | 此 Event 专属地图条件属于应保护的版式表现，不要把“移除旧地点/Event 特判”概括成删除全部内容专属表现。 |
| Operation 的运行内容改包后由 PackManager 验证、应用并 reload；保存 Run 的兼容由 event.resumeVersion 显式控制。旧版本不匹配会拒绝且不留部分 Run。 | src/arona-clicker/runtime.ts；src/arona-clicker/services/operation-entry-service.ts；tests/engine/gameplay-b-authoring-workflow.test.ts；tests/engine/gameplay-b-save-resume.test.ts | 清理后继续覆盖兼容版本恢复和不兼容版本拒绝；破坏性状态变化按清档策略处理，不加 migration layer。 |

## 施工切片

### P0：建立逐分支删除证据

- 列出 operation-workspace、center-panel、controller actions 中每个 Carousel 引用/条件/回退的消费者及对应已迁移内容/View 字段。
- 确认 PB-19～PB-25 的数据能复现标题、阶段、战斗/非战斗状态、参与者/事实/物品名称、行动禁用理由和 Operation 启动。
- 任一字段/规则没有内容或通用 View 替代时，停止该分支删除并报告缺口，不用 ID 回退掩盖上游迁移不足。

### P1：删除无消费者 Carousel 特判

- 删除由 Scene Runtime 状态与内容表现投影取代的旧 Carousel 地点阶段判断、文本/物品/事实名称 fallback 及重复适配。
- 由 PB-25 普通数据驱动 Event 入口呈现 Carousel 内容，移除专为该 Event 固定的入口文案/分支。
- 清除确认无用的 Carousel UI 导入和适配函数；保留仍被开发调试或正式回归使用的内容定义，不批量删除整个 operation-samples 目录。
- 不删除或弱化 Strategy Park 专属地图入口、地图数据、地图 SVG 线条/区域布局、路线摘要或相关 CSS。

### P2：完成交叉点击回归

- 从办公室进入标准 Operation 入口，点击启动已迁移的旋转木马 Event，完成战斗、现场行动、出口和结束流程；内容结果与既有玩法一致，无旧 UI 分支依赖。
- 点击进入完整 Strategy Park，完成至少一次战斗、探索/交互与分支路线，确认 13 地点地图仍显示当前位置、访问状态和锁定/开放出口，地图命令仍由 Runtime 处理。
- 在 G04 的真实样例中完成同一 Location 连续 Scene、群体目标过滤、M 选 N 和临时小商店，并确认费用、取消、结算和 Scene 完成状态一致。
- 保存后重新进入游戏，兼容版本 Run 按现有规则恢复；不兼容 Event 内容递增 resumeVersion 后旧 checkpoint 明确拒绝，玩家可开始新 Run。

## 测试与验收

- [x] PB26 定向引擎与 UI 回归：14 个测试文件、149 项测试通过，覆盖 Carousel / Park 样例、虚拟全路线、目标选择、SceneActions、Controller、作者入口、Save/Resume 和 Strategy Park 地图。
- [x] UI 旧静态入口改为通用 Registry/View 数据驱动入口；workspace 标题/说明消费 OperationView 字段，保留通用默认文案；删除无用 Carousel ID 导入。
- [x] PB-23/PB-24 群体、位置、M-of-N、临时购买与多 Scene 行为由既有 Runtime/View/Controller 回归覆盖；没有建立第二套实现。
- [x] 人工浏览器回归：Carousel 从办公室入口启动并完成战斗、控制台检查、员工证路线与成功结案；Strategy Park 展示 13 地点（地面 11、地下 2）及锁定/开放出口，实际完成出发简报、线索追踪、查询员工广播、在服务亭看到两个可用出口并选择代币电玩馆、搜索维修抽屉、经过镜面迷宫进入碰碰车区并提交一轮战斗，确认伤害与风险投影更新。浏览器只走了代币电玩馆分支；完整经典路线及两类控制室凭证分支由固定 seed 的虚拟游玩测试覆盖。
- [x] 旧 Carousel 标题/说明回退及无用 import 已移除；现有内容未提供通用替代字段的静态 Carousel 轨道、事实、物品、地点、角色/行动原因文案映射保留并记录，避免空白或错误显示。Strategy Park 专属地图、数据、CSS 与地图测试保留。
- [x] 未改变 SaveData 结构；`gameplay-b-save-resume.test.ts` 4 项通过，保留 `resumeVersion` 版本拒绝行为，无迁移层。

### 实际清理范围与发现的回归（2026-10-08）

- `operation-workspace.ts` 不再按 Carousel Presentation/ID 回退 Event 标题与说明；显示 `OperationView.eventTitle/eventDescription`，缺字段时使用通用默认文本。`controller-actions-operation.ts` 移除了不再使用的 Carousel SceneAction ID import。
- 逐类核对后保留仍无通用内容/View 等价物的静态 maps（轨道、Fact、Item、Location、角色/原因表现名）；Strategy Park 的专属地图 renderer、13 地点数据、路线 SVG 与布局样式完整保留。PB26 不把“删除旧特判”扩大成删除内容表现。
- 保留依据更细分如下：OperationView 提供轨道当前值及 Fact/Item ID，但不包含这些样例 ID 对应的作者显示名/说明；`OperationLocationDef` 也没有 Location 显示名字段。Actor 的通用 `displayName` 已存在，Carousel map 只补充角色职责/描述；Reason map 提供样例解释文案。缺少这些内容/View 字段时继续保留专属副本，避免空白或错误文案。
- 14 文件 / 149 项定向测试全通过。PB26 回归最初暴露 `operation-resolution-planner` preparation snapshot 漏掉 Actor 的实时 HP 与 positionId，导致重算把已击倒角色重新纳入可选目标；已保留这两个字段。虚拟全路线、Runtime Service、Planner 与 Plan Preparation 共 4 文件 / 68 项测试通过。
- 精确 14 文件命令：`npx vitest run tests/engine/gameplay-b-operation-sample.test.ts tests/engine/gameplay-b-scene-action-sample.test.ts tests/engine/gameplay-b-route-sample.test.ts tests/engine/gameplay-b-strategy-park-sample.test.ts tests/engine/gameplay-b-strategy-park-virtual-play.test.ts tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-save-resume.test.ts tests/engine/operation-target-selection.test.ts tests/engine/operation-scene-actions.test.ts tests/engine/operation-card-candidate-resolver.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-entry-registry.test.ts tests/ui/gameplay-b-strategy-park-map.test.ts --reporter=dot --silent`。移除最后一条未使用 import 后追加 `npx vitest run tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-controller.test.ts --reporter=dot --silent`，2 文件、40 项通过。
- 两处过时测试预期已按当前行为校正：Carousel SceneAction/卡组的急救执行策略已是 `optional-student`；Strategy Park 地图点击行动打开行内执行者选择器（`aria-pressed=true`），符合 PB-07 点击分配语义，拖拽分配也继续覆盖。地图数据与实际行为没有被弱化。

## 依赖与责任归属

- 前置 Task：PB-19～PB-24（Task 0269～0274）所有被清理分支对应的内容迁移、样例及测试完成；PB-25 Task 0275 的独立编辑器与通用可点击入口通过验收。
- Operation Runtime 持有运行阶段、状态、合法性和结算；Datapack/Registry 持有作者内容与引用约束；OperationView 提供 UI 所需只读状态；Controller 负责命令。
- Workspace 组件只消费通用 Scene View/Presentation；Strategy Park 地图 renderer 继续负责这一明确专属版式。
- 此 Task 不可以“精简代码”为由删除独立内容表现或向 Engine 搬入产品专用全局规则。

## 非目标与已关闭的前置条件

- 非目标：删除 Carousel 普通内容、Strategy Park 地图和测试、历史 Save migration、重做 Runtime/API、建立通用地图作者工具。
- 删除前置条件已由 PB-19～PB-25 的实现与回归满足：通用标题、说明、阶段和 Scene 状态来自作者内容与 OperationView；旧 Carousel 标题/说明回退已移除。
- PB-25 的通用 Event 入口及事件表现合同已通过 Editor/Runtime 包闭环验收；PB-26 复用通用入口，没有另加 Event ID 分支。

## 完成核验（2026-10-08）

- Carousel 的通用 Event 标题/说明不再通过 ID 或旧 Presentation fallback；办公室入口已由 PB25 改为通用可启动 Event 列表。未迁移为通用内容/View 字段的旧静态表现映射保留。
- Strategy Park 专属地图测试覆盖 13 个地点、路线状态与其他 Event 不渲染此地图；浏览器还确认地图与锁定/开放出口状态随 Runtime 进度变化。
- 最新定向回归：14 个测试文件、149 项通过；删除最终未使用 import 后另跑 2 个 UI 测试文件、40 项通过。`npx tsc --noEmit`、`npm run check:docs`、`npm run check:architecture` 与 `git diff --check` 于 2026-10-08 最终文档收尾后全部通过。

## GALHCG 影响闭环

- 发现路径：project_id=acprogram；只读查 Operation Workspace、Controller、Strategy Park 地图与 Operation Action Planning 对应 Concept/File，并以当前源码、测试及 `docs/docs-829/` 机制文档确认。宽泛 Operation 检索曾截断，随后缩小到实际修改路径与直接 owner。
- 精确范围：PB-25 有 19 个直接源码/测试路径，PB-26 有 7 个，`controller-actions-operation.ts` 与 `gameplay-b-operation-controller.test.ts` 两者共享，合计 24 个唯一源码/测试路径；另对两份归档 Task 与四份受影响 `docs/docs-829/` 当前机制文档逐路径运行 `review_changes`，总计 30 个直接复核路径。四份机制文档的映射 Evidence 全部 unchanged，没有重复写入。为保全节点完整 Evidence 集，节点 upsert 另预览了 6 个 unchanged 支撑文件。
- 新文件与身份：两份 PB25 新测试和两份 Task 归档文件经精确 include 定向刷新、`resolve_paths` 索引。Search 中 `Datapack Editor UI` 同时命中游戏内 Runtime Editor；按稳定节点 ID 与源码职责消歧，仅关联独立 Editor 概念。
- 路径迁移：地图搜索最初同时返回归档路径和已不存在的 `docs/plan-work/` 根路径同名 File。对两个旧路径的 `review_changes` 均发现 `missing`，且各自只有 Goal/Task 工作流的 documentation `maps_to`。确认 archive File 可解析且拿到新 Evidence 后，将两条关系迁到归档路径；随后精确刷新旧/新路径，`removed_entry_count=2`，旧路径 `resolve_paths` 现为 `not_found`，文件名搜索各只返回归档 File。
- 写入批次：A 更新 4 个节点、20 条关系、32 条 owner Evidence、18 个唯一 Evidence 路径；B 更新 2 个节点、16 条关系、22 条 owner Evidence、12 个唯一 Evidence 路径；C 建立两条 Task 主职责记录；D 更新两条主职责关系并新增两条 Goal/Task 工作流追溯关系；E 在最终 Task 文本定稿后刷新这 4 条归档文档关系的 Evidence token。五批均完整 plan、dry-run `valid=true` / `errors_complete=true` 后正式提交；共执行 46 次 edge upsert（其中 6 次是最终文档边的重复刷新）。A/B/C 的 38 次 edge upsert 和 56 条 owner Evidence 是批次写入小计，不代表完整图快照；D/E 又执行 8 次 upsert。最终图中保留 6 个节点、40 条关系（38 条 `maps_to`、1 条 `depends_on`、1 条 `contains`）、58 条 Evidence references、32 个唯一 Evidence 路径；相较本轮前新增 10 条关系、刷新 30 条既有关系。定向 refresh 清理 2 个缺失旧根路径 File 节点及各自一条过期 Goal/Task 文档追溯边；对应归档 File 的两条新 Goal/Task 追溯边迁移了该关系，另由 C 建立的两条 Task 主职责边是新增关系。故两条旧边与两条归档追溯边净抵，Task 主职责映射另增加两条关系和两个 Evidence 引用；38/56 是 A/B/C 写入小计，不作为迁移前完整图快照。最终统计以 40 条关系、58 条 Evidence references、32 个路径为准。
- 写后核验：24 个唯一源码/测试路径、2 个归档 Task 路径和 4 个当前机制文档路径的 `review_changes` 文件/owner 页完整；26 个当前映射路径 stale=0，机制文档映射均 unchanged。两个旧根路径在刷新前曾为 missing 且各只有一个 owner；refresh 后 resolve 为 `not_found`，不再有直接 owner，Search 每个 basename 只返回归档 File。Schema JSON（7 owners）、Editor→Runtime 集成测试（8 owners）、Operation Runtime 文档（9 owners）和 Definition Authoring 文档（6 owners）页均续读至 `owner_complete`。`search(mode="map")` 与有界 `traverse`（depth 1、edge_limit 100）确认目标 Concept、归档 File、边方向和 roles，结果 complete=true。Batch E 后 `verify_freshness` 覆盖 6 个节点及 10 条新增关系，16/16 fresh，观察时间为 2026-10-08 15:17:46.064–15:17:46.569 UTC；随后最终 Task 文案 token 提交后已再次核验这 16 个 owner，结果仍 16/16 fresh，最终时间见本轮收尾回报。Task 记录只作 documentation trace，不作为实现依据；没有删除 Carousel 普通内容表现、静态 Carousel 文案映射或 Strategy Park 专属地图关系，也没有扩大为全库审计。

## 剩余工作

- 本 Task 完成只代表 PB26 范围的旧 UI fallback 清理与阶段 V 回归闭合，不表示整个玩法 B、地图创作工具或更多编辑器体验完成。

## 相关路由

- [[draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]]
- [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]
- [[docs/docs-829/03-data-structures/operation-view]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/docs-829/06-wiki/50-ui/read-model-context]]
- [[docs/docs-829/06-wiki/50-ui/controller-commands]]
- [[docs/docs-829/06-wiki/20-data-services/definition-authoring]]
- [[docs/docs-829/05-conventions/testing]]
