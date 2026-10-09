# Draft：Gameplay B 阶段 II — 统一玩家可感知的操作语义

状态：completed — PB-06～12 已按 Goal Owner 默认裁定实施并完成定向行为 / UI 验证。历史 Task 已归档；实现、测试和剩余基线说明见“实施收尾与证据”。
> Goal Owner 统一裁定（2026-10-08）：本阶段适用的 PB 默认合同与升级条件见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；本 Draft 中相同主题的早期“待裁定”记录保留为讨论历史，不再阻塞已定默认规则。

> 记录边界：下方“施工前事实与待核对问题”与早期裁定表记录的是实现前状态；若与 Owner 裁定或下方实施收尾冲突，以 Owner 裁定和实施证据为准。PB-08 的显式目标规则、PB-11 的单次确认路径和 PB-12 的 Run 时间序号均已裁定并落地。

## 目标与最终方向

让玩家在现有 Operation 工作区里，对学生战斗行动牌、Location SceneAction 和有限玩家场景手牌使用一套可理解的浏览、选中、执行者、目标、合法性与费用预览、撤销、确认和结果阅读语义。完成后，从战斗进入场景行动，再转场时，玩家无需重新猜测“牌面亮起是否代表已选择”“费用是否可支付”或“谁会受到效果”。

该目标刻意保留当前命令与状态 owner：战斗通过 Operation Entry 的干预预览/修订和 commitBeat；场景通过 SceneDraft 与场景批次预览/暂存/提交；路线通过 transitionRoute。共用交互投影不等于合并事务。阶段 III 的 Scene 身份、生命周期与计划入口仍未建立。

## 本阶段玩法语义与边界

- 已裁定：Run 状态和战斗干预由 OperationRuntimeService 持有；场景牌草稿是以 runId、planVersion、currentLocationId 为键的 UI 内存态，未提交前不写 Run 或 SaveData。
- 已裁定：已有 OperationView 与窄 Operation Entry 是 UI 读取和写命令边界；费用、目标资格与提交结果由 Runtime 可信内容和纯规划服务校验。UI 不自算游戏规则。
- 已裁定：保留三种牌源、不同批次规模、不同费用归属与各自提交命令；只统一面向玩家的状态标签、选择路径、预览反馈和结果流。
- 已裁定：点击、聚焦、悬停等浏览状态不得冒充已选；固定纳入表示“已选且不可撤销”，不可用表示“当前不能执行并说明原因”，二者不混为一种锁定。
- 已裁定默认：SceneAction / PlayerSceneCard 的已选目标与合法候选集合分开；Individual 多候选目标显式单选，Global / 多目标来源显式选择；所需目标为空时拒绝并给出理由。空数组不代表“全部合法候选”；PB-23 的 `all-eligible` 也必须由内容显式声明。
- 明确暂缓：创建 ActionOffer / ScenePlan / SceneRuntime 新合同、合并 battle 和 scene Runtime 命令、调整 SceneAction / PlayerCost / Actor 或 Team 资源规则、通用 M 选 N / 商店 / 群体目标、Datapack Schema 与样例迁移、阶段 III 的场景原语、旧地点特判清理。

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| 三类牌的当前选择状态是否同义？ | src/ui/components/operation-workspace.ts：OperationActorHandCardView、projectOperationActorHand、renderSceneActionCard、renderIndividualSceneCard、renderPlayerSceneCard；OperationView 的 selectable / selectionPolicy；tests/ui/operation-workspace-view.test.ts：shows the three roles and keeps plans attached to their owning cards。 | 战斗的 selected 来自有效计划；SceneAction 首个候选可被展示但 aria-pressed 仍为 false；可用性与固定锁定当前由不同来源判断。应给“浏览/焦点、已选、不可用、固定”分开表达。 | 已核实 |
| 纯点击能否指定执行者？ | src/ui/controller-actions-operation.ts：bindCardTargetGestures、applyCardDrop、applyGlobalScenePerformer、applyPlayerCardPerformer、handleOperationClick；tests/ui/gameplay-b-operation-controller.test.ts：PlayerSceneCard 挂靠后通过拖拽切换执行者与效果目标，单击退出。 | 尚未分配的 selected-student SceneAction / PlayerSceneCard 通过拖放挂靠；点击处理会拒绝没有 actorId 的 selected-student 牌。增加可访问的点击分配路径，不改变拖放路径与 Runtime 命令边界。 | 已核实 |
| 当前目标入口是否已表达“未指定 / 单个 / 多个”？ | src/arona-clicker/contracts/operation-action.ts：OperationActionTargetDef；src/arona-clicker/contracts/operation-beat.ts：OperationInterventionDraft.targetActorId；src/arona-clicker/contracts/operation-scene-action.ts：targetActorIds；src/arona-clicker/services/operation-target-selection.ts：selectOperationTarget；src/arona-clicker/services/operation-resolution-planner.ts：planSceneBatch；tests/engine/operation-target-selection.test.ts、operation-scene-actions.test.ts。 | 战斗行动目标为 none 或 Runtime 选择的单一 Actor；场景批次接收 targetActorIds 数组；候选数不是已选目标数。src/ui/controller-actions-operation.ts：readSceneBatchCommand 在 Individual SceneAction 的空目标数组上回填全部合法目标。必须补显式目标/数量语义与回归，禁止静默全选。 | 部分已核实；Individual 的预期数量需裁定 |
| 费用预览由谁计算？ | src/arona-clicker/contracts/operation-scene-action.ts：OperationSceneActionBatchPreview；src/arona-clicker/services/operation-runtime-service.ts：previewSceneActionBatch；src/arona-clicker/services/operation-entry-service.ts：OperationEntryFacade.previewSceneActionBatch；src/ui/controller-actions-operation.ts：updateCostPreview；src/ui/components/operation-workspace.ts：renderSceneControls。 | Runtime 已提供纯场景预览，含 PlayerCost 和 Action Actor/Team 资源费用；当前 UI 预览只把 DOM 中 PlayerCost 相加，未调用 Runtime 预览。应以纯预览替代 UI 规则推算，并呈现不足及理由。 | 已核实 |
| 场景 UI 是否有待确认阶段？ | src/arona-clicker/services/operation-runtime-service.ts：previewSceneActionBatch、stageSceneActionBatch、clearSceneActionBatchDraft、commitStagedSceneActionBatch；src/ui/controller-actions-operation.ts：data-operation-scene-submit 分支直接调用 commitSceneActionBatch，data-operation-scene-commit 处理 pending；src/ui/components/operation-workspace.ts：renderMain。 | Runtime 有暂存流，但常规场景 UI 当前在“确认本批”后直接结算；另有待确认分支只对已有 pending 生效。PB-11 需决定是否将常规路径接入暂存确认。 | 结构已核实；产品操作步骤待裁定 |
| 时间流能否从现有 Read-only View 拼出？ | src/arona-clicker/contracts/operation-resolution.ts：OperationResolution / sceneBatch；src/arona-clicker/contracts/operation.ts：OperationRouteTransitionRecord、OperationLocationEntryCostRecord；src/arona-clicker/contracts/operation-view.ts：resolutions / routeHistory / locationEntryCostHistory / resolutionSequence；src/ui/components/operation-workspace.ts：renderResolutions、renderRouteHistory、renderMain。 | Resolution 有单调 resolutionSequence，但转场和入场费用没有共享序号，且数值变化是结算汇总。UI 当前将路线履历单独折叠并排在结算列表前。先定义可证的原子分组与跨记录顺序；若不可重建，新增轻量投影顺序须另裁定，不能虚构细粒度顺序。 | 已核实 |
| 阶段 II 可否直接以现有 UI 作为验收基线？ | docs/plan-work/00-index.md：task-0234 Edge 常规/窄视口与键盘验收、task-0236 Edge 常规/窄视口验收、task-0240 浏览器验收、task-0249 人工视口检查有待办描述；同页列 task-0250 正在进行。另有 tests/ui/gameplay-b-operation-controller.test.ts 的确定性 DOM 交互覆盖。 | 测试证明已断言的交互路径，不替代真实浏览器/窄视口基线。阶段 I PB-01～05 在本次读取时还没有独立正式条目可供验收核对。先完成阶段 I 运行基线，才关闭阶段 II 集成验收。 | 已核实待办；阻塞范围已裁定 |

### GALHCG 导航结果

- resolve_project 对工作区绝对路径返回 project_id=acprogram，workspace_path 与 root_path 匹配。
- project_info 显示 .galhcg/project.toml 缺失、map_scopes/source_scopes 为空；项目图 freshness 是已保存观察，不代表本次实时扫描。本轮不以 freshness 摘要作为实现事实。
- lookup Operation 命中 Operation Action Planning、Operation Run Lifecycle、Operation View Projection、Operation Scene Deck、UI Operation Workspace 等概念；Actor Hand / SceneDraft 字样未命中时改用 source search 和 path 查询，分别定位 operation-workspace、controller-actions-operation、operation-runtime。
- 源码字面检索命中 projectOperationActorHand 与 previewSceneActionBatch；path 查询命中 operation-runtime 机制页、operation-runtime-service.ts、operation-workspace.ts、controller-actions-operation.ts 及对应测试。之后回到代码、测试与 docs/docs-829 逐项核实。
- 地图写入状态：本阶段只完成只读发现与事实核对；不单独执行 refresh / update_map。由主代理在所有阶段文档定稿后统一判断本批 Goal / Draft / Task 是否映射到 concept:goal-workflow，并集中写入与写后核验。

## 裁定记录

| 待裁定问题 | SolChat 建议 | 本项目决定 | 依据/待验证项 |
| --- | --- | --- | --- |
| Phase I 交互基线是否阻止 Phase II？ | Roadmap 要求先修复 V1；后续操作语义建立在可靠基线上。 | 不阻止 Draft / Task 建立及定向开发；阻止阶段 II 集成验收与宣告完成。PB-01～05 完成后，至少重跑战斗、场景行动、牌费、站位与窄窗口的实际操作流程。 | 当前 0234 / 0236 / 0240 / 0249 各自仍有浏览器或人工视口记录；PB-01～05 本身的落地状态需主代理在索引合并时复核。 |
| Phase II 是否统一 Runtime 命令？ | 统一玩家操作含义，但明确暂缓合并不同 Runtime 命令。 | 采纳。保留 preview/revise/commitBeat、preview/stage/commitSceneActionBatch、transitionRoute 各自入口。 | docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md：公开命令与原子提交边界。 |
| 目标空数组的含义是什么？ | 不应无提示地把未指定目标解释成所有合法目标。 | 已裁定：空集合表示没有手动选择；所需目标缺失则预览 / Runtime 拒绝。Individual 目标在多候选中单选；支持多目标的 Scene 来源显式选择每个目标。未来 `all-eligible` 必须由目标定义声明，不从空数组推断。 | `tests/engine/operation-scene-actions.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts` 与 G04/PB-23 后续合同。 |
| 场景确认路径如何统一？ | 清楚表达“编辑 → 待确认 → 结算”；简单战斗可一键确认；跳过与待命含义不同。 | 已裁定默认：一般编辑后即时预览并单次确认；Battle 使用 `commitBeat`，Scene 使用 `commitSceneActionBatch`；不强制所有 Scene 两次确认。只有不可逆后果或复杂批次经证据需要时才采用已有 stage/commit。跳过继续使用显式空批次规则。 | `tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/engine/operation-scene-actions.test.ts`。 |
| 结果流如何描述原子 Resolution？ | 以实际发生顺序写行动、费用、事实道具、转场与入场费用。 | 已裁定：每条 Resolution 是不可拆分的原子结算块；Resolution / Route / Location entry Cost 使用共同 Run-wide `timelineSequence` 排序，不描述未存储的内部 Effect 微时序。 | `OperationRuntimeService` 校验完整 history counts / 序号，`OperationView` 按可证明顺序交织呈现。 |

## Draft → Task 准入

- [x] 语义和明确非目标已裁定
- [x] 会改变方案的源码事实已核对；尚未裁定项均写明其局部影响
- [x] 七个 Task 均有独立完成定义、依赖及玩家可操作验收案例
- [x] 每个 Task 均列最小施工 Read Set、责任归属和针对性回归入口
- [x] 已写明本阶段后仍未完成的 Scene 原语、内容迁移和作者工具方向

## 实施收尾与证据（2026-10-08）

- **PB-06～09 — 选择、执行者、目标与本地计划：** Runtime View 与 Workspace 分开表达 browsing / selected / unavailable / fixed；selected-student SceneAction / PlayerSceneCard 可点按或键盘指定 / 改派 / 清除执行者，并与拖放共用 UI-local `OperationSceneDraft`。改派保留仍合法的既有目标，不会把已失效目标静默替换成新执行者的唯一候选。目标候选不等于已选集合；所需目标为空时提交被拒绝。
- **PB-10～11 — Runtime 预览与确认：** UI 每次编辑调用纯 `previewSceneActionBatch()`，读取费用、Actor/Team action cost、合法性和阻塞原因；不从 DOM 费用标签自算。常规 Scene 流程为修改 → 即时预览 → 单次确认；Battle 仍走 `commitBeat`，Scene 仍走 `commitSceneActionBatch`。显式 skip 沿既有空批次规则，不把跳过解释为成功。
- **PB-12 — 统一时间流与完整 checkpoint：** Commit Resolution、Route transition 与 Location entry Cost 共用单调 Run-wide `timelineSequence`。恢复校验要求总访问数至少为 1、`routeHistory.length = totalLocationVisits - 1`；若 Event 声明任何 entry-cost rule，则 Cost history 存在且长度等于总访问数，无此规则时不得带多余 Cost history；Resolution 历史长度精确为 `min(resolutionSequence, 32)` 且序号覆盖最近连续窗口；`timelineSequence` 等于所有 Resolution sequence 总数 + Route 数 + entry Cost 数。每个损坏夹具都验证 checkpoint 被整体拒绝、不安装 Run；不新增迁移层。
- **内容 / View 与正式示例：** 当前 View 提供 detached Resolution、Route、Entry Cost 记录及共同序号；Timeline 按共同序号排序，记录不全时保留不猜序的提示。正式 Carousel 和 Strategy Park 为新增 checkpoint 字段递增 `resumeVersion`；G03 随后又因 Scene identity 再递增，当前值以内容定义为准（Carousel 3、Strategy Park 4）。
- **验证：** `tests/engine/operation-runtime-service.test.ts`、`tests/engine/gameplay-b-save-resume.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts` 及相关 G02 定向文件共 4 个文件 / **81 tests passed**；`npx tsc --noEmit` 与 `git diff --check` 通过。最初的单一路线夹具触发既有自动转场，已按真实生命周期修正后重新验证。
- **剩余工程基线：** `tests/engine/gameplay-b-event-runtime-integration.test.ts` 中 7 个既有失败经 detached HEAD 重跑与本轮前基线一致，后续在 G03 Draft 记录；未通过改预期或放宽行为掩盖。

G02 已完成。G03 原子 Scene 骨架见归档 Draft/Tasks；本轮继续 G04 真实玩法迁移。早期“PB-08 数量仍待裁定”“PB-11 必须接入暂存”文字保留为实施前讨论记录，不代表当前开放决定。

## 相关路由

[[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/06-wiki/50-ui/refresh-update]] · [[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/galhcg-project-map]]
