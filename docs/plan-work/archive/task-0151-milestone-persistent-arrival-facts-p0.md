# Task：Milestone Persistent Arrival Facts P0

状态：done — P0-A–D 与 PU-1–5 已完成；2026-09-25 最终验收通过，待归档并完成 AOCI 收尾

## 目标

实现一个最小 EB-T 领域消费者：当 Datapack 声明的 Condition 第一次被观察为成立时，将对应 ID 写入 Save 级 MilestoneProgress；之后即使 Condition 变回 false，完成事实仍保留。运行时 Registration 是可重建投影，MilestoneProgress 是权威历史事实。

本 Task 从 [[draft-0144-eventbus-trigger-millstone]] 的已裁定主体设计派生。它建立 Milestone 内核，不实现 Achievement / Quest 产品层。

## 设计边界

- `Condition` 表达当前真值，可在 true / false 间变化；Milestone 只固化第一次观察到的 true。完成事实单调：`incomplete := id ∉ completed`，不持久化 incomplete 状态。
- Milestone 不拥有累计计数器；计数 / 当前进度仍归 Statistics / Game State。Def 不预设 `scope: 'save'` 字段。
- `MilestoneProgress` v1 只记录 `milestoneId ∈ completed`：不保存 incomplete、当前 Condition 真值、Registration identity 或完成时间。具体序列化形状由 P0-B 按 Save 习惯裁定。
- Milestone 身份使用数据包声明的稳定 Def ID；具体命名空间校验沿用实际 Datapack / Registry 契约，不另造身份格式。
- desired registration 由当前 Definition、Current State 与 MilestoneProgress 推导。Registration 可以丢弃并重建；completed 事实不能因重建或原 Condition 变假而清除。
- Definition 删除或暂时缺失不得自动删除已有 completed ID；Progress 可以保留当前没有 Definition 的 orphan ID。P0 不实现 orphan 清理 / 迁移或展示。
- 完成判断必须先重新读取当前状态，再由 ConditionSystem 求完整 Condition / ConditionGroup；事件只唤醒，不代表条件已成立。
- 只支持经覆盖核验具备可靠激活唤醒的状态依赖 Condition。`alwaysTrue` 等恒定/静态叶子不要求运行时唤醒，可在 admission 求值。
- ConditionGroup 沿用现有 AND / OR。P0 可保守要求每个非恒定状态依赖叶子都有可靠 activation wake；不得把 `alwaysTrue` 等无需事件的叶子判成 coverage 缺失，也不做布尔 wake minimization。
- 只通过 `StateMutationService` 写入 Save Progress；完成提交幂等，成功后撤出该目标的所有 Registration。
- Projection admission 必须 register-before-evaluate，并具备 completed 提交幂等性。Admission 与事件唤醒可发生竞争或重入，但仅允许一次权威 completed 写入；后续路径观察到 completed 后必须 no-op，并最终撤出该 Milestone 的全部 Registration。
- P0 终点是完成事实提交并撤出 Registration；不发 `milestoneCompleted` 事件，不让 Milestone 形成链式依赖。
- 不扩大 EB-T 事件面，不增加 tick 轮询或通用 Condition → Event 框架。Reveal 与 Milestone 两个消费者尚不足以证明共享抽象。

## 当前事实与代码落点

| 已核实事实 | 位置 | 对本 Task 的影响 |
| --- | --- | --- |
| ConditionWakeProfile 已分别审计 17 种 ConditionTarget 的 DepIndex 与 EB-T 覆盖，并提供 activation / invalidation 结论 | [[task-0145-reveal-condition-event-coverage-audit]] | P0 能力边界只由可靠激活覆盖决定，不把 DepIndex 覆盖误当 EB-T 覆盖 |
| 覆盖审计的首期事件候选为 `resource`、`spotLevel`、`hasReadStory`、`hasReadStoryInRun`；`alwaysTrue` 适合 admission 求值，不需事件 | [[task-0145-reveal-condition-event-coverage-audit]] §首个 Reveal 消费者建议 | 作为 P0 边界基线；施工前逐项核对现有 TriggerEventDef 与实际状态写入路径 |
| `stat` 缺乏统一唤醒链；`hasEnh`、`countTags`、`flag`、`extra` 等存在 EB-T 缺口；`visitedStoryInChain` 无唤醒事件 | [[task-0145-reveal-condition-event-coverage-audit]] §首个 Reveal 消费者建议 | 不纳入 reactive P0，不通过新增 EB-T 事件补足 |
| TriggerSystem 支持 Registration register / withdraw、事件桶和 runtime action；Information Reveal 已有 Domain + Adapter 先注册唤醒源、重验完整条件、提交后撤出的实现 | `src/engine/effect/trigger-system.ts`、`src/arona-clicker/services/information-reveal-adapter.ts` | 可作为窄领域适配模式参考，不复制其 Reveal 数据模型 |
| `triggersCompleted` 是 `PER_INIT_FIELD_SPECS` 中的 Init 快照字段；`informationRevealProgress` 是 PlayerState 顶层 Save 事实，Save codec 对 PlayerState 整体 JSON 克隆 | `src/arona-clicker/types/state.ts`、`src/arona-clicker/state/per-init-fields.ts`、`src/arona-clicker/runtime-save-codec.ts`、`src/arona-clicker/runtime-save.ts` | Milestone 采用何种集合序列化仍未裁定；不得机械照搬示例数组，继续遵循 Save 状态习惯 |
| 既有 Task 0134 的 P3 提及轻量实体获得 / 解锁 / 里程碑记录；该方向不实现 EB-T Condition 达成事实，也不要求高频 Event 因果链 | [[task-0134-runtime-content-static-reverse-query-and-milestones]] | 本 Task 不实现其 Inspector / 实体获得 / 解锁展示；若需共享查询展示另行裁定 |

## 施工切片

### P0-A：能力边界与运行时接入核验

- 将 Task 0145 的审计结论映射到本 Task 的实际 Condition / TriggerEventDef 支持边界。静态恒定叶子可 admission-only；保守准入要求每个非恒定状态依赖叶子均有可靠 activation wake，不能因 OR 中存在无事件状态叶而误判安全。
- 只读核验 Datapack contract、Def factory、Registry、PlayerState / Save、StateMutationService、TriggerSystem 装配及现有 projection rebuild 入口，形成实际文件职责图。
- 确认 Save Progress 所属层、定义变化后的 reconcile 入口，以及每类支持事件的 payload/filter identity 和 mutation producer；只确认存在事件 kind 不足以通过核验。
- 核验并发/同步语义：projection 必须先注册后 admission-evaluate；即使事件唤醒与 admission 重入或竞争，也只能有一次 StateMutationService completed 提交，之后撤出所有 Registration。P0-D 增加这一路径的幂等回归测试。
- 保持持久结构待裁定：核对 `triggersCompleted`、`informationRevealProgress` 与故事完成事实的现有存储习惯，不在 P0-A 决定数组、record 或 set-like 编码。
- P0 不发 `milestoneCompleted`，完成后以 Save completed fact + Registration withdrawal 为终点。
- 若真实事实与本 Task 的边界冲突，停止并更新 Task 裁定；不得自行扩展 ConditionTarget 或 EB-T 事件面。

### P0-B：Datapack 定义与持久完成事实

- 提供最小 Milestone Def（稳定 ID + 现有 Condition / ConditionGroup）；不含 scope、标题、奖励、领取、统计值或阶段字段。
- 在 Registry 中提供只读定义访问；按项目 Schema 同步流程更新派生 Schema。
- 为 Save 增加只含 completed 身份的 Progress 权威事实，并通过 StateMutationService 提供验证与幂等提交；不写 migration。

### P0-C：Desired Watch 与 EB-T Adapter

- 根据当前 Definitions、Save Progress 与当前状态推导未完成目标的 desired watches。
- 为 P0 支持的每个唤醒源建立一个或多个精确 EB-T Registration；projection 建立时先注册，再 admission-evaluate 当前完整 Condition。
- 事件唤醒后重读并重验当前 Condition；首次为真时提交 completed，成功后撤出该目标的全部监听。
- 已完成目标在 projection rebuild 后不注册、不重复提交；Progress 保留且不依赖 Registration token / key。

### P0-D：真实 Runtime 接线与回归验收

- 在 P0-A 查明的现有装配与重建入口接线；覆盖真实 Save 加载、相关内容重建及状态更新路径。由当前生命周期决定哪些入口需要重建，不新增 Milestone 专属 Init 契约。
- 用集成测试验证四项 P0 验收；只读用户界面或奖励消费者不在本 Task 内。
- 另测注册完成后，Admission 求值与事件唤醒在同一投影周期重入且都观察到 Condition=true 时，StateMutationService 的有效 completed 提交数为 1，最终该目标 Registration 数为 0。

## 验收标准

- [x] **Admission correctness**：projection 建立时 Condition 已成立，Milestone 立即完成，无需等待后续事件。
- [x] **Reactive correctness**：Condition 从 false 变为 true，相关事件唤醒后重读、重验并完成一次。
- [x] **Monotonic persistence**：完成后 Condition 变回 false，Save 完成事实仍成立。
- [x] **Reconstruction correctness**：runtime projection 重建后，已完成目标不重新监听、不重复提交。
- [x] 不完整覆盖或不支持的 ConditionTarget 不进入 reactive P0；没有新增 EB-T 事件、tick 扫描或通用 ReactiveConditionService。
- [x] 所有 Save 写入经过 StateMutationService；新字段与数据包定义的测试、文档和 Schema 同步完成；不编写存档迁移。
- [x] 不改 Task 0134 的静态关系查询、Inspector 或 UI 展示范围。

## 明确非目标

Achievement / Quest / Tutorial / Challenge；奖励与领取；成就 UI、编辑器呈现与图鉴展示；累计计数器或独立进度 owner；多阶段 / 前置 / 隐藏 / 周期重置；不完整覆盖的 ConditionTarget；新增 TriggerEventKind；通用 Condition dependency 编译器或共享 ReactiveConditionService；历史 Event / Effect 因果记录；存档迁移。

## 测试与验收

- Datapack / Registry：最小 Def 构建、ID 与 Condition 引用校验、Schema 同步测试。
- Domain / Adapter：Admission、精确事件唤醒、事件后完整重验、幂等提交、撤出与重建测试。
- Save / Runtime：完成事实序列化保留、原 Condition 回退后仍完成、已完成目标重建不监听的集成测试。
- 命令：定向 Vitest、`npx tsc --noEmit`、`npm run gen:schema`（如修改 `src/engine/types/`）、Schema 同步测试、`npm run check:architecture`（触及数据服务边界时）。

## 当前核验（2026-09-25）

- 已读取 Task 0145 已完成的 Condition / Event 覆盖结论、Task 0148 / 0149 Reveal 实现 Task，以及 Task 0134 的里程碑边界。
- 已按用户批准执行 P0-A 只读核验；未修改源码、数据包、Schema 或测试。
- 资源、Spot 等级、故事完成两类事件均存在精确 ID filter，但 `resource` 目标有待解决的状态语义边界：Condition evaluator 读取 `state.resources[key]`，而 StateMutationService 对 global resource 写 `globalResources`。因此 P0 的 `resource` reactive 准入目前只可覆盖确认由 Condition evaluator 实际读取的 per-Init `resources`；不得把 globalResources 事件存在误认作 Condition 覆盖完整。
- P0-A capability matrix：

| ConditionTarget | Activation event | 精确 filter identity | 实际状态变更 producer | Admission | Reactive P0 结论 |
| --- | --- | --- | --- | --- | --- |
| `alwaysTrue` | 无 | 不适用 | 不适用 | ConditionSystem 直接求值 | admission-only；无需 Registration |
| `resource` | `resourceChanged` | `event.resource === condition.key`（TriggerEventDef: `resource`） | `changeResource` / `setResource`；Spot transaction 在完整写入后逐资源发事件 | 直接求值 | 对 evaluator 读取的 per-Init `resources` 候选可精确唤醒；global resource 存于 `globalResources` 而 evaluator 只读 `resources`，该范围不通过 P0-A，需在 Task 裁定时排除或另行解决 |
| `spotLevel` | `spotLevelChanged` | `event.spotId === condition.key`（TriggerEventDef: `spotId`） | `setSpotLevel` / `incrementSpotLevel` 与 `commitSpotTransaction`；Init 默认 Spot 通过 mutation service 初始化 | 直接求值 | 精确 activation coverage；静默删除只造成 invalidation，不影响一次性抵达语义 |
| `hasReadStory` | `storyCompleted` | `event.storyId === condition.key`（TriggerEventDef: `storyId`） | `completeStory` 先追加 `storyLog` 再发事件 | 直接求值 | 精确 activation coverage；`storyLog` 是 per-Init 状态，Init 重置可导致 false，completed 仍然单调 |
| `hasReadStoryInRun` | `storyCompleted` | `event.storyId === condition.key`（TriggerEventDef: `storyId`） | `completeStory` 先调用 `StatsService.recordStoryCompleted` 再发事件；ConditionSystem checker 读取 `hasCompletedStoryThisRun` | 直接求值 | 精确 activation coverage；`beginSession` 会清空本 Run 事实，属于 Condition invalidation，不回退已完成 Milestone |
| ConditionGroup 中恒定叶 | 无 | 不适用 | 不适用 | 完整 ConditionGroup 求值 | 不作为缺失 coverage；其他非恒定状态依赖叶仍需逐叶满足可靠 activation coverage |

- ConditionGroup 采用保守逐叶准入：`AND(reactive, alwaysTrue)` 可准入；`OR(reactive, unsupportedStateLeaf)` 不可承诺 reactive correctness。事件唤醒后始终重验完整 ConditionGroup，不编译布尔树。
- Registry / Datapack 事实：`Datapack` 当前定义 `triggerDefs`，两个分片解析入口都显式列入 `triggerDefs`；TriggerDefs 直接加载进 TriggerSystem，不属于 Registry Def map。Registry 校验器对 trigger ID 有既有验证路径。新增 Milestone Def 若经 Registry 持有，应有自己的汇总类型、解析、验证与 Schema 同步落点。
- PU-2 实施后，`ENTITY_TYPES` 登记 `milestone`，Registry 有 Milestone map/getter/table step；新 Def ID 精确使用 `milestone` typeName。其专属校验未改变其他 Def 的既有 ID 行为。
- PU-3 采用 PlayerState 顶层 `milestoneProgress.completed: string[]`，只保存 completed ID；`StateMutationService.completeMilestone` 需通过 Domain validator，重复 ID 返回 false 且不会重复写入。
- Runtime 事实：`runtime-wiring.ts` 构造 ConditionSystem 并注入 Story Run checker，创建 Reveal Adapter；`InitService` 在进入 Init 开始时撤出 Reveal watches、流程完成时 reconcile；`restoreFromSave` 替换 PlayerState 并在重建末尾 reconcile；`reloadPreservingState` 经 save → reload → load 触发读档重建。Milestone 应依据这些已查明入口设计 projection rebuild，但 Save-scope 契约不绑定 Init。
- Save 事实：`buildSaveData` / `restoreFromSave` 对 PlayerState 整体克隆，顶层 `informationRevealProgress` 随 Save 持久化；`triggersCompleted` 则进入 Init snapshot。当前数据模型没有故事完成的独立 global history ledger，`storyLog` 是 per-Init。MilestoneProgress 的具体序列化形状继续开放。
- 同步语义：EventBus 正常发事件为同步派发；TriggerSystem 按候选快照派发并校验 Registration token，runtime action 可重入，因此 Adapter 仍须靠领域幂等提交和撤出保证 exactly-once 的有效状态结果。P0-D 需测试一次有效 mutation、最终零 Registration。
- 真实接入职责图：`src/data-services/contracts/datapack.ts` + 两个 datapack list parser（Def contract / 解包）；`src/data-services/registry/registry.ts` + `registry-validate.ts`（定义持有 / 校验）；`src/arona-clicker/types/state.ts` + `state-factory.ts` + `runtime-save-codec.ts` / `runtime-save.ts`（Save 事实）；`state-mutation-service.ts`（权威写入）；`runtime-wiring.ts`、`init-service.ts`、`runtime-save.ts`、`runtime-game-instance.ts`（projection 装配 / 重建）。
- TriggerSystem 当前只有一个 `runtimeActionHandler` 插槽，InformationRevealAdapter 构造时会设置它；Milestone 不能覆盖该处理器导致 Reveal 失效。Runtime 接线必须让两种领域 action 都可达，同时不引入通用 Condition→Event 编译器或共享 ReactiveConditionService。
- 裁定：Milestone P0 的 `resource` reactive capability 仅覆盖 ConditionSystem 实际读取且有可靠 activation wake 的 per-Init `resources`；`globalResources` 明确排除。P0 不修复资源系统与 Condition evaluator 的既有语义裂缝；global resource Condition 另立任务。
- P0-A 已接受。P0-B/C/D 获准进入 Patch Unit 规划；不代表批准跨 Unit 一次性施工。P0 不发 `milestoneCompleted`。

## Patch Unit 规划

P0-B/C/D 已批准拆分 Patch Units。以下 Unit 各自独立验收，任何 Unit 的执行都不能扩大到其他 Unit；开工前仍按 Constitution 复述 Goal、Allowed Files、Explicit Non-goals 与 Stop Conditions。由于共 5 个 Unit，详细模板按 [[docs/ai/PROJECT-CONSTITUTION]] C1 存入 `docs/plan-work/archive/task-0151-units/`。

| Unit | 阶段 | Goal | 文件预算 / 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| [[pu-1-datapack-contract-and-parsing]] | P0-B | 增加最小 MilestoneDef Datapack contract 并接入两种列表解析 | 5 files；无前置代码 Unit | done；[[pu-1-execution-receipt]] |
| [[pu-2-registry-validation-and-schema]] | P0-B | Registry 持有 / 校验 Definition、登记实体 ID typeName 并生成同步 Schema | 5 files；依赖 PU-1 | done；[[pu-2-execution-receipt]] |
| [[pu-3-save-progress-mutation]] | P0-B | 增加只含 completed ID 的 Save fact 和幂等 StateMutation 提交 | 4 files；依赖 PU-1 | done；[[pu-3-execution-receipt]] |
| [[pu-4-milestone-domain-and-ebt-adapter]] | P0-C | 实现窄能力准入、desired watches、EB-T Registration 与重验 | 5 files；依赖 PU-2、PU-3 | done；[[pu-4-execution-receipt]] |
| [[pu-5-runtime-projection-and-reentry]] | P0-D | 接入 Reveal 与 Milestone runtime action 路由、生命周期重建与 exactly-once 验收 | 5 files；依赖 PU-4 | done；[[pu-5-execution-receipt]] |

PU-4/PU-5 已将 TriggerSystem 的单一 runtime action handler 与 Reveal 的现有占用列为实施依赖；具体改法限于保证两个领域 handler 都能收到其 action，不得顺便抽取通用响应式 Condition 框架。若真实代码要求超出 Allowed Files 或改变 EB-T 契约，停止并回交重新拆分。

## 剩余工作

- PU-1 至 PU-5 均完成并分别记录 Execution Receipt；P0-A–D 验收完成。
- 单独另立任务处理 global resource Condition 语义裂缝；Milestone P0 不承担该修复。

## 最终施工结果（2026-09-25）

- Datapack / Registry / Schema / Save Progress / Domain / EB-T Adapter / runtime projection 均已接通；Milestone 事实保存在 `PlayerState.milestoneProgress.completed`，Def 缺失不清理既有完成 ID。
- P0 reactive capability 仅包含 per-Init `resource`、`spotLevel`、`hasReadStory`、`hasReadStoryInRun`；`alwaysTrue` admission-only；不支持叶与 global resource 不进入 reactive Watch。
- Reveal 与 Milestone action 共用 TriggerSystem 时由 runtime-wiring 组合路由；Save restore 和 Init 生命周期复用 InitService 既有重建入口。
- 定向验证：6 个 Vitest 文件、39 项测试通过；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git --no-pager diff --check` 通过。
- P0-D 的同步注册重入验收确认仅一次有效 completed mutation，提交后该目标无剩余 Registration。

## 相关路由

- [[draft-0144-eventbus-trigger-millstone]]
- [[task-0145-reveal-condition-event-coverage-audit]]
- [[task-0148-information-reveal-adapter-v1]]
- [[task-0149-information-reveal-runtime-lifecycle]]
- [[task-0134-runtime-content-static-reverse-query-and-milestones]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
