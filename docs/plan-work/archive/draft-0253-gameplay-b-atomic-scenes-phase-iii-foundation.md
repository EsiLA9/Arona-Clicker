# Draft：玩法 B 阶段 III — 原子场景骨架

状态：completed — PB-13～18 已按 Goal Owner 裁定实施并完成定向行为验证、当前机制文档和 GALHCG 收尾。实现证据见本 Draft 的“实施收尾”与归档 Tasks。
> Goal Owner 统一裁定（2026-10-08）：本阶段适用的 PB 默认合同与升级条件见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；本 Draft 中相同主题的早期“待裁定”记录保留为讨论历史，不再阻塞已定默认规则。

> 实施结果：Scene 是 `OperationLocationDef` 内嵌的有序内容；无 `scenes` 的旧 Location 投影隐式 `main`。Scene-local 完成和批次数由现有 `EventRun.locationProgress` 保存，View 从内容与进度推导状态；未增加 Scene Runtime owner、SaveData 顶层字段、实例 ID 或历史迁移。

## 目标与最终方向

让一个由 Datapack 声明的微型 Scene 在现有 Operation 工作区中具有独立身份，并闭合可观察的选择、纯预览、受版本保护的原子结算与完成循环。Scene 组合参与者、行为和结果；Location / Event 继续负责空间、路线和全局结局，现有 Operation Runtime 继续负责其拥有的 Run 状态与提交边界，AC 继续负责最终奖励。

路线图提供了 ready → active → completed、SceneDef / SceneRuntime / ScenePlan / SceneResolution 的概念示例；它们是提案，不是当前源合同或已经批准的类型。施工实现可复用现有 Operation 合同，但须等状态 owner、ID 身份、状态持续时间和必要存档语义被裁定后再冻结实现方案。

## 本阶段玩法语义与边界

- 目标切片：同一 Operation Event 中含两位学生、一个环境对象、一项需执行者的行为和一项无需执行者的行为；作者声明的身份与状态能直接驱动通用 Operation UI。
- UI 只读取 Runtime 的只读投影；选择、预览和提交走受控命令，不让 Scene/UI 保存一份竞争的权威状态。
- 同一个 OperationResolution 机制可以被复用；不要求把战斗 Beat、SceneAction 批次、路线转场合并成一种命令或创建万能 SceneManager。
- Scene 自己不拥有 Event 地图、路线/空间、AC 全局奖励服务或存档系统。若人类决定 Scene 的局部状态随既有 EventRun checkpoint 保存，那仍由既有 SaveData / EventRun 流程承载，不代表 Scene 拥有存档。
- 不沿用 interactionSceneId 表示新的 Scene 身份；不把 SceneAction、sceneActionBatches 或 SceneCard 与 SceneRuntime 混为一谈。
- 样例应进入可从 Operation 工作区启动的正式可选 gameplay-b@1.0.0 内容包；src/data/test-datapack.ts 是测试/示例内容，不作为最终玩家验收入口。

## 施工前事实与待核对问题（历史记录）

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| 当前有无独立 Scene 定义或实例？ | src/data-services/contracts/operation.ts：OperationLocationDef / OperationEventContentDef；src/arona-clicker/contracts/operation.ts：EventRun；对 src/arona-clicker/services/operation-runtime-service.ts 的 MutableRun、createRun、OperationRuntimeService.start 核对；GALHCG source 搜索 sceneInstanceId、SceneRuntime 在范围内完整无命中。现有合同没有 SceneDef、sceneId、sceneInstanceId 或 Scene 生命周期。 | 新身份是计划新增概念；不能称现有 Operation 已可独立运行 Scene。 | 已核实 |
| interactionSceneId 的实际含义是什么？ | src/data-services/contracts/operation.ts：OperationLocationDef.interactionSceneId 与 OperationCardConditionDef.sceneIds；src/arona-clicker/services/operation-card-candidate-resolver.ts：matchesCardCondition / interactionSceneId 匹配。GALHCG source 查询该字段命中合同、候选解析器和策略园样例。 | 此 ID 是 CardPool / Action 候选的有限上下文，不是新 Scene 实例或 Scene 状态字段。新 Scene 身份须避免同名复用。 | 已核实 |
| SceneAction 是否等同于 Scene？ | src/data-services/contracts/operation.ts：OperationSceneActionDef 是 Location-local 的 actionId / scope / playerCost / 文案包装；src/arona-clicker/contracts/operation-scene-action.ts：OperationSceneActionBatchCommand 与 OperationSceneActionBatchDraft；src/arona-clicker/contracts/operation-resolution.ts：OperationResolution.sceneBatch。 | SceneAction 是一个现成行动来源和批次合同，不能推断它已提供 Scene identity / lifecycle。 | 已核实 |
| 目前谁拥有局内状态和生命周期？ | src/arona-clicker/runtime-game-instance.ts：GameInstance.#operationRuntimeOwner / operationEntry；src/arona-clicker/services/operation-runtime-service.ts：MutableRun、RunSlot、createRun、getSnapshot；src/arona-clicker/contracts/operation.ts：EventRun、OperationLocationProgress、OperationLifecycleEvent。 | EventRun 由每 GameInstance 的 Operation Runtime owner 持有并返回 detached snapshot。是否在其中增加 Scene 局部状态，或采用其他 owner，仍是人类裁定。 | owner 已核实；Scene owner 待裁定 |
| Location / Event 状态是什么？ | src/arona-clicker/contracts/operation.ts：OperationRunStatus、OperationLocationProgress、EventRun；src/arona-clicker/services/operation-runtime-service.ts：evaluateLocationProgress、commitBeat、completeCurrentLocation、finish、commitRouteTransition；tests/engine/operation-runtime-service.test.ts：publishes only Run and Location lifecycle boundaries、路线 Gate / stale route 测试。 | Event 当前状态为 inProgress 或终局结果；Location 具有独立 completed/result、Beat 与 SceneAction 批次计数。路线评估和 Location 完成不是 Scene 状态。 | 已核实 |
| sceneActionBatches 是不是 Scene 运行数？ | src/arona-clicker/contracts/operation.ts：OperationLocationProgress.sceneActionBatchesUsed；src/arona-clicker/services/operation-runtime-service.ts：evaluateLocationProgress、commitSceneActionBatch、commitRouteTransition。它限制当前 Location 访问的行动批次，并可作为 Location 完成条件。 | 新 Scene lifecycle 不能借用该计数或把批次耗尽直接解释成 Scene.completed。 | 已核实 |
| Beat、场景批次和原子 Resolution 当前怎样关联？ | src/arona-clicker/services/operation-runtime-service.ts：commitBeat / commitSceneActionBatch；src/arona-clicker/services/operation-resolution-planner.ts：planOperationResolution；src/arona-clicker/contracts/operation-resolution.ts：OperationResolutionBatch / OperationResolution.sceneBatch；tests/engine/operation-scene-actions.test.ts：纯 preview 不写状态、批次结算、不可负担时快照不变。 | 两条已版本保护的提交分别结算战术 Beat 和场景批次，共用 OperationResolution 形状与 delta 应用能力；阶段 III 应薄适配复用，不重建效果引擎。 | 已核实 |
| 当前是否已有 ActionOffer / ScenePlan？ | src/arona-clicker/contracts/operation-view.ts：OperationViewActionOption、OperationViewSceneAction、OperationViewSceneCard；src/ui/components/operation-workspace.ts：OperationActorHandCardView / projectOperationActorHand（现有角色持牌 adapter）；src/ui/controller-actions-operation.ts：OperationSceneDraft。Runtime 没有通用 ActionOffer / ScenePlan 合同。 | 可复用 view-safe 候选、场景 draft 与 Runtime preview；Offer / Plan 是新拟议投影，具体 shape 尚待裁定。 | 已核实 |
| 目前 preview / stage / commit 有何写状态差异？ | src/arona-clicker/services/operation-runtime-service.ts：previewSceneActionBatch、stageSceneActionBatch、clearSceneActionBatchDraft、commitStagedSceneActionBatch、commitSceneActionBatch；src/arona-clicker/contracts/operation-scene-action.ts。 | preview 为纯计算；stage 将接受的批次和费用预览存入 Run；未 stage 的 UI 草稿为局部 UI 状态。ScenePlan 是否复用此模式待裁定。 | 已核实 |
| EventRun 与 Save / Resume 是什么关系？ | src/arona-clicker/contracts/save-data.ts：SaveData.operationRun；src/arona-clicker/contracts/operation-save.ts：OperationRunSaveSnapshot；src/arona-clicker/runtime-game-instance.ts：save / load；src/arona-clicker/services/operation-runtime-service.ts：createSaveSnapshot / restoreSaveSnapshot / validateRestoredRun；tests/engine/gameplay-b-save-resume.test.ts：暂存批次恢复、版本不匹配拒绝。 | EventRun 不属于 PlayerState 或 InitSnapshot；主 SaveData 可选保存 bounded checkpoint，内容按当前 Registry 与 resumeVersion 重建。Scene 本地状态如何参与此 checkpoint 尚未裁定，不得编写迁移兼容层。 | 已核实 |
| 当前 Datapack 有何 Operation 内容及表现字段？ | src/data-services/contracts/datapack.ts：operationEvents、operationLocations、operationActions、studentOperationProfiles、operationStrategyProfiles、operationCardPools；src/data-services/contracts/operation.ts：OperationActorDef.displayName、OperationActionDef.title/description、SceneAction/Card 文案、Event factIds/itemIds；src/arona-clicker/services/operation-view-projector.ts：作者文案投影。OperationView 只投影 knownFactIds / heldItemIds ID，并无通用事实/物品名称表。 | Scene 表现字段和事实/物品名称不能假定已经存在。若源类型变化，须走 Schema 生成同步，不手改 generated schema。 | 已核实；具体合同待裁定 |
| Gameplay B 的示例 / UI 从何进入？ | src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts：operationEvents、operationLocations、operationActions、studentOperationProfiles；AGENTS.md 声明正式 Gameplay B 样例由 Runtime 装配的可选 gameplay-b@1.0.0 bundle 进入同一 PackManager/Registry；tests/ui/gameplay-b-operation-controller.test.ts：data-operation-start Event ID 入口与 Operation workspace。 | 可点击微型验收需要正式 bundle 中可启动的样例内容，不以单元测试或接口存在代替玩家验收。 | 已核实 |
| PB-0245～0248 与当前边界是什么？ | docs/plan-work/00-index.md 将四个 Task 列为归档完成；docs/plan-work/archive/task-0245... 至 task-0248... 分别记录 performer/target/cost、统一角色卡交互、拖放目标语义、optional-student / 部分选择 / 跳过。当前对应接口见 operation.ts、operation-view.ts 与 operation-scene-action.ts。 | 继承其现有操作语义，不再次引入卡牌系统、目标系统或批次规则。此记录不是实现事实的唯一来源。 | 已核实 |
| task-0250 是否是前置？ | 冻结清单 `docs/plan-work/archive/active-work-freeze-2026-10-08-gameplay-b-atomic-scenes.md` 记录其冻结状态为已交 Luna 子代理施工、主代理复核未完成；该 Task 只处理 GALHCG 节点职责、映射归属与协议粒度，不改游戏源码/测试。 | 不假定职责提取已经完成。其任何可用结果都须重新以当前源码核验；它不是 Scene Runtime 的实现依赖或阻塞门槛。 | 已核实冻结状态与范围 |
| 当前 Operation 顶层内容表与文档记录是否一致？ | `src/data-services/contracts/datapack.ts` 声明 `operationEvents`、`operationLocations`、`operationActions`、`studentOperationProfiles`、`operationStrategyProfiles`、`operationCardPools`；`src/data-services/registry/registry.ts` 为六表登记 Registry；`registry-validate.ts` 对应六类 Entity ID。原来的 `operation-runtime.md`、`datapack-contracts.md` 与 `definition-authoring.md` 曾仅列四表。 | 本轮按源契约把三篇当前文档的表数与表名更新为六张。六表进入 Registry 不等于独立 Datapack Editor 已提供编辑 UI；后者由 PB-25 另行查证。 | 已核实并同步当前文档 |

## 裁定记录

| 待裁定问题 | SolChat / Roadmap 建议 | 本项目决定 | 依据 / 待验证项 |
| --- | --- | --- | --- |
| 场景身份与状态模型 | 提出 locationId、sceneId、sceneInstanceId 三身份，以及 ready / active / completed；示例类型仅作概念边界。 | 暂不采纳为字段合同；仅确认 G03 必须在 UI 显示不同于 Location 的场景身份与完成结果。由人类在 Task 0263 裁定稳定 ID、实例创建/重入和状态 owner。 | 当前源码无独立 SceneDef / Runtime；已有 Location / Run owner 与 save/resume 必须保持单一权威。 |
| Scene 状态持久化 | 要求 Scene 不承担全局存档；Roadmap 示例的局部状态又称“可持续”。 | 不把 Scene 变成 SaveSystem owner；局部状态是否纳入现有 EventRun checkpoint、是否仅在活动 Run 内存在，待人类裁定。 | Operation 当前会保存 EventRun、Location progress 和显式暂存批次；SceneRuntime 尚无合同。无存档迁移。 |
| 表现合同 | 建议标题、描述、状态名、参与者、事实和物品名称由内容提供。 | 采纳内容驱动、UI 不按 Event / Location ID 查文案的方向；字段位置、是否复用 Actor/Action 文案、事实/物品名称采用哪种内容 owner 尚待 PB-14 人类裁定。 | 当前已有 Actor/Action/Objective 文案；事实/物品主要为 ID，不能谎称已有名称投影。 |
| ActionOffer / ScenePlan / SceneResolution | 建议 Offer 只作行为投影，Plan 只描述选择，Resolution 承载结果；复用 ActionDef / Runtime。 | 采纳责任边界，暂不冻结结构、状态机或将 Battle / Scene 批次合并成同一命令。由 PB-15～17 分别限定。 | 现有 view、scene draft、preview、OperationResolution 见上表；不同命令均有明确边界。 |
| Location 完成与 Scene 完成 | Scene 仅负责自身完成；Location / Event 决定空间流程。 | 采纳两类完成不可等同、UI 不按地点 ID 推断的产品目标；如何允许 Location 前进仍依既有 Location objective / Route / Event 流程，交 PB-18 明确，不新增 SceneManager。 | 当前 Location 完成会评估目标、路由和自动单出口转场。 |
| 各阶段 Task 与施工状态 | Roadmap 给出 PB-13～18 顺序、微型可玩切片。 | 施工准入前按 PB-13 identity → PB-14 presentation → PB-15 offer → PB-16 plan/preview → PB-17 resolution → PB-18 completion/exit 拆分六个 Task；当前六项均已完成，逐项验证见归档 Task 的“实施收尾与证据”。 | docs/ai/goal-workflow.md：未达准入门槛的决定留 Draft / Task 记录，不把建议升格为现状。 |

## 阶段 Task 切分与准入状态

| Task | 独立交付边界 | 前置与后续 | 状态 |
| --- | --- | --- | --- |
| task-0263-pb-13-scene-identity-lifecycle.md | Scene 稳定身份、最小生命周期及只读当前 Scene 投影；不重写 Beat / 场景行动。 | 已按裁定采用嵌入 Location 的定义、Location-local ID 与 EventRun owner。 | completed |
| task-0264-pb-14-scene-content-presentation.md | 正式内容包声明并展示 Scene 标题、说明、状态和必要参与者文案；不创建大型 Narrative。 | 已由内容合同与通用 View/UI 投影支持；作者编辑器留 G05。 | completed |
| task-0265-pb-15-action-offer-projection.md | 从学生行动、SceneAction、PlayerSceneCard 形成 UI-safe 行为候选；保留各自提交边界。 | 三种来源均由同一只读 Offer 联合投影，选择仍交各自 Runtime 命令。 | completed |
| task-0266-pb-16-scene-plan-preview.md | 将当前 Scene 选择投影成可撤销计划并提供纯 preview，复用资格、目标与费用计算。 | `OperationScenePlan` 是值投影；UI-local draft 与 Run 内显式 staged batch 分开。 | completed |
| task-0267-pb-17-scene-atomic-resolution.md | 以薄适配提交版本匹配的选择，结果与 Run 原子一致；复用现有原子 owner write。 | Battle Beat 与 SceneAction batch 使用不同命令，共用 Resolution 形状及 copy-on-write 边界。 | completed |
| task-0268-pb-18-scene-completion-location-exit.md | 区分 Scene 完成与 Location 完成 / Route 转场，Scene 完成不擅自推进地图。 | Scene 完成由 commit 后条件写入；Location / Route 仍按既有条件处理。 | completed |

阶段验收使用正式 Gameplay B 可选内容包中的微型 Event。`tests/ui/gameplay-b-operation-entry-registry.test.ts` 真实点击 Operation 入口、启动 Event、选择 SceneAction、确认提交并检查 Scene completed / Location inProgress；相应 Runtime 测试覆盖两 Scene 原地推进与 checkpoint 恢复。

## Draft → Task 准入

- [x] 语义：说明了单个微型 Scene 的独立玩家结果，以及地图、存档 owner、全局奖励等非目标。
- [x] 事实：核对了方案关键处的 Operation Runtime / Run、Location、SceneAction、Beat / Resolution、Save / Resume、Datapack、OperationView、任务历史和测试入口。
- [x] 架构决定：已按 draft-0256 采用嵌入 Location、Location-local ID、EventRun 内进度及 checkpoint 持久化；不创建 sceneInstanceId、独立 owner 或新 SaveData 层。
- [x] 验收：六个 Task 均有可从 Operation 工作区点击的案例，且注明必须在该 Task 实现后实测。
- [x] 依赖：每项继承既有接口并声明前置；task-0250 是参考而非阻塞。
- [x] 后续：Strategy Park / Carousel 迁移、单 Location 多 Scene、复杂目标、M/N / 商店、编辑器与旧代码清理留给后续 Goals。

## 下一步

G03 已完成。下一阶段按 Goal Set 进入 G04：等价迁移真实玩法并单独验证由 SceneAction 驱动的 A→B 多 Scene Event；不能把本阶段战术 Beat 双 Scene 用例当作 PB-22 SceneAction 案例。作者编辑器和旧特判清理留 G05。

## 实施收尾与验证（2026-10-08）

- **身份 / owner：** `OperationSceneDef` 嵌入 `OperationLocationDef.scenes[]`，ID 在 Location 内稳定；无显式列表时虚拟 singleton ID 为 `main`。完整身份路径由 Event、Location、Scene 组成，不添加 `sceneInstanceId`。
- **状态 / 持久化：** 现有 `EventRun.locationProgress` 持有有序 `completedSceneIds` 与每 Scene 批次计数。当前 Scene、ready/active/completed、ActionOffer 和 Scene copy 都由内容与 progress 推导。已完成 Scene 前缀在 checkpoint 和同一 Run 的 Location revisit 中保留。没有独立 Scene owner、SaveData 顶层字段或历史迁移。
- **提交：** `OperationScenePlan` 是只读选择值；UI SceneDraft 是可撤销本地态；显式 staged batch 是既有 EventRun 状态。SceneAction/SceneCard 与战斗 Beat 仍走各自的 Runtime 入口，复用 OperationResolution 和同一个 detached copy-on-write owner。空 SceneAction skip 消耗 batch budget 但不推进 Scene。`commitBeat()` 只接受 `stage: combat`；Scene Location 内保留的 PreparedBeat 是只读资格投影 / checkpoint 校验快照，Runtime stage guard 决定它不可提交为战斗 Beat。
- **玩家样例：** 正式 `gameplay-b@1.0.0` 中的 atomic-scene-demo Event 由 Registry profiles 派生恰好两名学生与一个环境参与者；它含 selected-student SceneAction 与无需执行者的 0-cost SceneCard。通用 Operation 入口按钮携带对应 Registry 派生 `characterIds`，Controller 用同一名单启动，不自动补发。
- **行为证据：** `tests/ui/gameplay-b-operation-entry-registry.test.ts` 点击 Registry 卡片、检查两人+环境 roster、Scene 文案和 actorless Offer、选择 SceneAction 并提交，断言 Scene completed 但 Location 仍 inProgress，Resolution 有 Scene ID 且无 Route history。`tests/ui/operation-workspace-view.test.ts` 通过 Controller 点击正式的 actorless PlayerSceneCard，检查公开手牌显示“可就地加入本批”、无 Performer 拖放文案、点按后进入可撤销 SceneDraft 且 Run snapshot 不变。Engine tests 覆盖有序 Scene A→B、checkpoint / Location revisit、empty skip 不完成、纯 preview 与失败原子性、Scene-stage direct Beat rejection、隐式 `main` 在 Location 完成后的 status。
- **定向 G03 验证：** Actorless Workspace 修订前，`npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/operation-scene-actions.test.ts tests/engine/operation-view-projector.test.ts tests/ui/gameplay-b-operation-entry-registry.test.ts` — 4 files / 55 tests passed（55/55）。Actorless Workspace 修订后，`npx vitest run tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-entry-registry.test.ts` — 2 files / 11 tests passed（11/11）。`npx tsc --noEmit`、`npm run gen:schema` 已在本次 UI-only 修订前通过；因 G02 正并行编辑共享 Runtime 文件，本次未重跑其 Runtime 验证。
- **合并范围验证：** G02 修订前的 10-file broader run 为 144 passed、1 failed。唯一失败是 `tests/ui/gameplay-b-operation-controller.test.ts:1013` 的 G02 旧文案断言：实际提示为“请至少选择一名行动目标；也可以取消这张行动并跳过本批”，断言仍期待“请至少选择一名目标”。该断言不属于 G03；G02 正并行修复，根任务会做最终合并验证，因此该旧运行不记为全绿。
- **已知基线：** `tests/engine/gameplay-b-event-runtime-integration.test.ts` 的 7 个保护/观察、combination、skill check/reason failures 经 detached HEAD 独立重跑，与本轮前基线一致；不归因 G03，保持现有断言并在 Task closeout 记录。
- **独立浏览器复核：** 代码与自动真实 Controller click-flow 已稳定；主代理将在本轮冻结后刷新 IAB 核验点击页面、Scene 阶段战斗控件隐藏与可见完成/Location 文案。

## GALHCG 事实发现记录

- 项目绑定：GALHCG resolve_project 对 ACProgram 返回 project_id=acprogram，root_path 与工作区均为本仓库。
- 项目图导航：overview 确认 module:domain-operation；map 搜索 EventRun 命中 concept:operation-event-run-runtime、concept:operation-run-lifecycle、concept:operation-view-projection 及角色 Hand 概念。SceneAction、OperationResolution、sceneInstanceId 的概念查询零命中且 complete=true；按协议继续核对源码，而未把零命中当不存在证明。
- 源码导航：对 src/arona-clicker/**/*.ts 与 src/data-services/**/*.ts 搜索 sceneInstanceId 和 SceneRuntime，结果 complete=true 且无命中；interactionSceneId 命中 OperationLocationDef、候选解析器和 Strategy Park 样例，再由源码确认其 CardPool / Action selector 用途。
- 相关 Concept 核验：concept:operation-run-lifecycle 的可见 evidence 指向 operation-runtime.md、operation-runtime-service.ts、operation-save.ts 与 save-resume 测试；concept:operation-view-projection 指向 operation-view.md、operation-view.ts 与 operation-view-projector.ts。GALHCG freshness 为最近保存观察，不视作实时源码版本证明；本 Draft 引用的机制事实均已直接读相应工作区文件和测试。
- 变更审查：本轮新增 nested Scene 内容、Run progress、OperationView/Resolution 合同、generic Registry entry 与 Runtime stage guard；已复核 Operation Runtime、View、content-validation、sample-content、UI command / workspace 的直接路径。
- 地图维护：复用既有 Operation Run Lifecycle、EventRun Runtime、View Projection、Sample Content、Content Validation、Action Planning / Resolution、Scene Deck、UI Command-to-Runtime、Operation Workspace 与 Workspace Renderer concepts；已将本轮直接实现、机制文档、正式 demo 和行为测试映射到相应概念，并刷新相关 Evidence。未创建宽泛 Scene concept，也未把规划文件作为实现证据。共享 G01/G02 变更仍由主代理按其复核范围维护。

## 相关路由

[[AGENTS.md]] · [[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/galhcg-project-map]] · [[docs/ai/context-packs/datapack-schema]] · [[docs/ai/context-packs/world-lifecycle]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/03-data-structures/player-state]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/schema-sync]] · [[docs/docs-829/05-conventions/testing]]
