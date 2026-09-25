# Task：Milestone Listener 准入与响应式覆盖能力审计

状态：done — 只读准入与响应式覆盖审计完成；Listener v1 Gate 通过（能力范围受限）

## 目标

依据 [[draft-0152-milestone-listener-and-achievement-packaging]]，核实 Milestone Listener v1 的分区准入、存档恢复、游玩中动态载入及 `target` Condition 唤醒能力，形成源码与测试证据支持的 authoring capability boundary。

本 Task 只做只读审计，不修改代码、数据包、Schema、测试或正式机制文档。审计通过后，按结论另立实现 Task。

## 已裁定边界

- Listener 一次性完成；completed fact 为 Save-level、单调事实。
- 监听范围仅有 `global` 与 `init-bound`。`init-bound` 控制 Registration 的载入/撤出，不分割或重置 completed fact。
- 存档恢复从可持久化的到访事实重建分区准入；游玩中由 `entered` / `firstEntered` 相关行为触发准入重算。**不使用进入次数统计或阈值。**
- Listener 引入后先建立 Registration，再立即完整求值；当前目标已成立时立即完成，并允许连续追赶。
- `next` 表示候选后续 Listener 获得引入资格；后续 Listener 仍须满足自身 `when`，语义为前置资格与自身 `when` 同时满足。它不是 EB-T 事件链。
- Achievement 仅包装已完成事实供展示；v1 不含奖励、领取或独立生命周期。
- Condition 覆盖不足时缩小作者可用范围，不扩张 EB-T，也不建立通用响应式 Condition 框架。

## 审计问题

### A. 分区准入与 PlayerData

1. 核验 Save / PlayerData 中 Init 与 Area 到访事实的字段、作用域、写入时机及读档恢复路径；区分到访、解锁、当前 Init、当前 Area 和本次 session 统计。
2. 中性核验 `initEntered`、`areaEntered` 及领域入口的发布时机和 payload：首次进入发生时，当前哪个领域流程持有 `firstEntered` 判定，Listener admission 是否有最小接入点。无需把它改成 EB-T payload、Condition 或公共接口。
3. 分别说明 Save restore / projection rebuild 如何从持久到访事实恢复资格，以及游玩中 Init/Area 进入后如何及时重新计算；不得把未持久化的过去事件当作存档历史。
4. 给出至少覆盖以下情形的资格恢复矩阵：首次进入、重复进入、读档恢复、切换 Init、Init 内切换 Area、返回曾到访 Init/Area。若事实只支持到访过而不能区分首次历史，明确指出能力边界。

### B. Target Condition reactive coverage

1. 以 [[task-0145-reveal-condition-event-coverage-audit]] 的全集结果为基线，只复核拟进入 Listener v1 的候选 `target`（当前 Milestone P0 支持集）及 0145 后相关代码是否变化；只有发现证据漂移或候选新增时才扩大核验。对候选核对状态读取、producer、状态提交后的事件、EB-T kind/filter identity 与 Registration。
2. ConditionGroup 保持完整表达式重验；采用保守准入：除常量/无需运行期唤醒的静态叶外，所有可能独立令整体从 false 变 true 的状态依赖叶都必须有可靠 activation wake coverage。
3. 明确区分 admission-only、reactive、partial / unsupported；不可用“有同名事件”替代 mutation→event→filter→registration 的完整证据。
4. 明确 `globalResources` 与 Condition evaluator 实际读取状态之间的既有差异是否继续排除在 v1 外；审计不顺带修复该语义裂缝。

### C. Registration 生命周期与重建

1. 核验当前 Milestone Adapter 的 desired watch、Registration withdrawal、Save restore 与 Init 生命周期 reconcile 的真实挂接点。
2. 判断 `global` / `init-bound` 两类监听如何从定义、当前 PlayerData 和 completed facts 派生；列明 Init 离开、返回、存档恢复及投影重建时的注册/撤出期望。
3. 核验同步事件重入、先注册再求值与幂等 completed 提交的现有保证；只记录 Listener 施工所需条件，不在本 Task 设计新事务机制。

## 交付物

1. **准入事实矩阵**：准入来源 / 持久事实字段 / 作用域 / 事件或重算入口 / 首次到访可见性 / 读档可恢复性 / 证据。
2. **Condition capability 矩阵**：ConditionTarget / 状态读取与 identity / 实际 mutation producer / activation event / EB-T filter 精度 / admission 或 reactive 结论 / 盲区与证据。
3. **生命周期图**：Save restore、Init/Area 进入、init-bound 休眠与恢复、完成后撤出的目标行为；区分当前已实现事实和 Listener 需求。
4. **v1 作者能力边界建议**：可用准入事实与运行时重算入口、可用 `target` Condition、明确暂缓项，以及需进入后续施工 Task 的具体 runtime 接入点。
5. **Gate 结论**：逐项说明已有事实是否足以开工；若仍有会影响语义正确性的事实空缺，列出最小补充审计，不自行改写已裁定玩法语义。

所有结论须引用真实源码路径、符号和相关测试。历史 Task 与文档只作调查路由，不能替代当前源码核验。

## Read Set

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/02-modules/world]]
- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/02-modules/expression]]
- [[docs/docs-828/03-data-structures/player-state]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
- [[draft-0152-milestone-listener-and-achievement-packaging]]
- [[task-0145-reveal-condition-event-coverage-audit]]
- [[task-0151-milestone-persistent-arrival-facts-p0]]
- `src/arona-clicker/types/state.ts`
- `src/arona-clicker/state/state-factory.ts`
- `src/arona-clicker/state/state-mutation-service.ts`
- `src/arona-clicker/services/init-service.ts`
- `src/arona-clicker/services/milestone-domain.ts`
- `src/arona-clicker/services/milestone-adapter.ts`
- `src/arona-clicker/runtime-wiring.ts`
- `src/arona-clicker/runtime-save.ts` / Save restore 实际实现文件
- `src/engine/types/events.ts`、`src/arona-clicker/contracts/event-catalog.ts`
- `src/engine/types/expression.ts`、`src/engine/expression/condition-system.ts`、`src/engine/expression/condition-deps.ts`
- `src/engine/types/trigger.ts`、`src/engine/effect/trigger-system.ts`
- 对应 Init / Area 进入、PlayerData 到访事实、Milestone Adapter、Condition/Event 覆盖的定向测试

按当前源码实际位置微调文件路径；仅在回答上述问题所需时扩展 Read Set。

## 执行步骤

1. 对照 PlayerState / Save 生命周期追踪 Init 与 Area 到访事实从写入、存档到恢复的完整路径，并核实 Init / Area 进入事件的触发顺序与首次进入信号。
2. 分别模拟审查“读取存档时重建”与“游玩中收到进入信号后重算”两种准入路径；标注哪些历史资格能恢复、哪些只能由当前行为发现。
3. 以 task-0145 和 Milestone P0 已审计结论为基线，仅对 v1 候选 `target` 及相关源码变更做定向复核；无漂移时引用既有全集审计，不重复审计不进入 v1 的 `flag`、`stat` 等目标。
4. 追踪 Milestone desired watch 与运行时重建入口，覆盖 global / init-bound 的注册、休眠、恢复、完成撤出及已完成事实保持。
5. 确认 predecessor completed fact 与 Listener 自身 `when` 作为两个准入门共同求值；不要求把 predecessor 塞入 ConditionSystem。前置完成后由 Listener Domain reconcile 后续资格，不添加 EB-T 事件假设。
6. 填写三项矩阵与生命周期图，并按四项 Gate 作出结论：持久事实能否恢复 admission、运行时信号能否及时触发 reconcile、已有 Milestone coverage 能否可靠监听 target、现有 lifecycle 能否重建/撤出 watches。
7. 将审计结果、源码证据、限制和下一步施工边界写入本 Task，更新 [[docs/plan-work/00-index]] 状态与链接；保持本 Task 只读范围。

## 明确不做

- 不实现 Milestone Listener、Achievement、`when` / `scope` / `next` / `then` 定义或运行时接线。
- 不新增或修改 PlayerData 字段、事件、ConditionTarget、Trigger kind、EB-T Registration 契约、Schema 或 Datapack 内容。
- 不设计进入次数、按 Init 完成历史、按进入周期重置、重复完成或行为基线。
- 不实现奖励、领取、UI 展示、统计计数或通用 Condition→Event / ReactiveCondition 框架。
- 不运行与只读审计无关的实现测试；只核查已有测试作为事实证据。

## 完成标准

- 准入事实矩阵覆盖 Save restore 与运行中 Init/Area 进入，明确持久到访事实、重算事件及 first-entry 能力。
- Condition capability 矩阵覆盖拟进入 v1 的每个 `when` / `target` 来源，并附实际状态写入、事件、过滤与测试证据。
- Lifecycle 说明覆盖 global / init-bound、读档重建、Init/Area 变化、completed 保持与完成撤出。
- `next` 与自身 `when` 的 AND 语义具备明确运行表达/限制结论。
- 给出可直接用于后续实现 Task 的 authoring boundary、真实代码接入点、验收建议和 Gate 结论；未决事实均明确列出。
- 文档链接检查与 `git diff --check` 通过；不修改源码或数据。

## 当前核验（2026-09-25）

### A. Admission / Partition 事实

| 事实 | 当前证据 | 审计结论 |
|---|---|---|
| Init 到访历史 | `PlayerState.visitedInits` 为顶层 Save 字段；`InitService.enterInit()` 在进入时先计算 `isFirstEnter` 并写入集合。`initEntered` 在此后发出。 | 读档可从到访集合恢复 Init 的历史准入；当前运行的 Init 由 `activeInit` 标识。`unlockedInits` 仅代表解锁，不等于到访。 |
| Area 到访历史 | `visitedAreas` 列在 `PER_INIT_FIELD_SPECS`；InitSavepoint 按 Init 捕获/恢复该字段。`enterInit()` 将默认 Area 加入当前 Init 到访集。 | 读档/切换 Init 可从对应快照恢复 Area 到访历史；`currentAreaId` 只表示当前位置。 |
| Init 运行中进入 | `initEntered` payload 只有 `initId`；`enterInit()` 的 `isFirstEnter` 在领域流程内可见，事件本身不暴露该值。`enterInit()` 结束时已有 post-entry reconcile。 | 能用现有 InitService 领域入口完成准入重算；不要求新增 Event payload、Condition 或通用接口。重算应落在领域状态就绪后的入口。 |
| Area 运行中进入 | `areaEntered` payload 为 `areaId/fromAreaId`；`travelToArea()` 在写入当前位置、到访事实并应用默认 Spot 后发事件，局部 `isFirstEnter` 用于 Area EntryEffect。 | `entered` 可由现有事件驱动重算；`firstEntered` 在 `travelToArea()` 局部流程可知，无需进入 EventBus 公共载荷。 |
| Init 默认 Area | 首次进入 Init 时写入默认 Area 到访事实，但该路径不单独发 `areaEntered`；Init 完成后执行 reconcile。 | 默认 Area 分区从持久集合/currentArea 可准入；审计无需假设一定产生独立 Area entry event。 |

准入行为归纳：

| 场景 | 可恢复/可观察事实 | Listener 最小需求 |
|---|---|---|
| 进入过的存档被读取 | PlayerData 中 `visitedInits` 与恢复后的 per-Init `visitedAreas` | Restore 末尾从当前事实重建资格；不重放过去事件 |
| 本次进入 Init | `initEntered`；首次进入局部布尔量 `isFirstEnter`；完成后的 reconcile | 在 Init 状态写入完成后重算 |
| 本次移动 Area | `areaEntered`；首次进入局部布尔量 `isFirstEnter` | 从事件或领域调用重算；首次标记留在领域入口 |
| 重复进入 / 往返 | 到访集合已包含身份，`isFirstEnter=false`；`entered` 仍再次发生 | 重算幂等；first-entry 准入不重复触发，普通 entered 准入可重新求值 |
| 返回曾到访 Init | 对应快照恢复 Area 历史，Init 再次进入；Save completed 不变 | 重新推导 Init-bound watch；不重置 completed |

证据：`src/arona-clicker/types/state.ts`、`src/arona-clicker/state/per-init-fields.ts`、`src/arona-clicker/state/init-savepoint.ts`、`src/arona-clicker/services/init-service.ts`、`src/arona-clicker/runtime-save.ts`、`src/engine/types/events.ts`。`tests/engine/game-instance.test.ts` 的 “first-entry and conditioned entries for init and area” 覆盖首次/重复 Init 与 Area EntryEffect 行为。

### B. Target reactive coverage 定向复核

0145 已完成全部 ConditionTarget 审计。本次只复核当前 Listener P0 候选及相应实现；没有扩大到明确暂缓目标。

| v1 target 候选 | Condition 读取 / wake identity | 当前结论 | 关键限制 |
|---|---|---|---|
| `alwaysTrue` | 常量求值；无 wake source | Admission-only；可在引入时直接完整求值 | 不建立无意义 Registration |
| `resource` | Condition 读 `state.resources[key]`；`resourceChanged.resource === key` | Reactive，限 per-Init 资源 | `globalResources` 事件不能弥补 ConditionSystem 不读该桶的既有差异，排除 |
| `spotLevel` | 读 `spotLevels[key]`；`spotLevelChanged.spotId === key` | Reactive | 只承诺有 P0 候选映射的精确 Spot identity |
| `hasReadStory` | 查 `storyLog`；`storyCompleted.storyId === key` | Reactive | Init 切换可使原始事实变化，但 completed 仍单调 |
| `hasReadStoryInRun` | 查 StatsService 当前 Run 的 story identity；相同 `storyCompleted.storyId` wake | Reactive | Init/session 重置会清空 Run 事实，不回退已提交的 Milestone |

`ConditionGroup` 继续对原表达式完整求值。P0 采用逐叶保守准入：允许无 wake 的 `alwaysTrue`；其余可能改变结果的状态叶须具备 activation coverage。当前 `deriveDesiredMilestoneWatches()` 与 `MilestoneAdapter` 已实现上述候选映射、精确事件过滤、先注册后求值和完成后撤出；相关证据及既有全集矩阵见 [[task-0145-reveal-condition-event-coverage-audit]]、[[task-0151-milestone-persistent-arrival-facts-p0]]、`src/arona-clicker/services/milestone-domain.ts`、`src/arona-clicker/services/milestone-adapter.ts`、`src/engine/expression/condition-system.ts`、`src/engine/effect/trigger-system.ts`。

不进入 v1 的 `flag`、`stat`、`area` 等目标不因本 Task 重新评估而自动获得能力；发现 0145 后代码漂移时再对该漂移定向扩审。现有 `tests/engine/milestone-adapter.test.ts` 覆盖候选准入、精确资源 wake、unsupported group、alwaysTrue、注册重入、提交幂等及撤出；`tests/engine/milestone-runtime.test.ts` 覆盖 Restore rebuild 与 Reveal/Milestone 共存。

### C. Lifecycle 与资格关系

- `restoreFromSave()` 先撤出 watches，替换 PlayerState 并恢复 stats 等系统，最后调用 `reconcileInformationRevealWatches()`；该入口现也调用 Milestone reconcile。
- Init 转换开始撤出 Reveal/Milestone watches；Init 领域流程完成后统一 reconcile。软重启 / 选择态撤出；返回 Init 后依据当前事实重建。
- `MilestoneAdapter.reconcileCurrent()` 按已完成事实与定义派生 desired watches，注册后重验，completed 后撤出。当前 P0 MilestoneDef 无 Listener scope，因此 Adapter 目前不具备 global/init-bound 过滤语义。
- Listener v1 的 `global` / `init-bound` 可在现有 reconcile 边界派生：global 不随 Init 退出而撤出；init-bound 按 activeInit 过滤，退出时撤出、返回时重建。Area 动态 admission 可在现有 Area 进入事件或 `InitService.travelToArea()` 领域入口触发重算；无需扩 EB-T kind。
- `next prerequisite AND own when` 由 Listener Domain 在资格变化或 reconcile 时合并判定。`completeMilestone()` 当前不发完成事件；下一链的及时处理应由完成路径直接调用 domain reconcile，不能假设有 `milestoneCompleted` event。
- completed Save fact 经 `StateMutationService.completeMilestone()` 幂等提交；Registration 为投影，可撤出/重建；completed 不随 Init scope 休眠清除。

证据：`src/arona-clicker/services/init-service.ts`、`src/arona-clicker/runtime-save.ts`、`src/arona-clicker/services/milestone-domain.ts`、`src/arona-clicker/services/milestone-adapter.ts`、`src/arona-clicker/state/state-mutation-service.ts`、`src/arona-clicker/runtime-wiring.ts`。

### Gate 结论

| Gate | 结论 | 后续实现约束 |
|---|---|---|
| 持久事实恢复 admission | 通过 | 以 `visitedInits` / per-Init `visitedAreas`、当前 active Init/Area 及 completed facts 重建；不用 entry count |
| 运行时信号及时 reconcile admission | 通过 | 从 InitService/现有 Init、Area 进入信号接入；首次进入标记保留在领域调用边界 |
| 已有 Milestone coverage 可靠监听 target | 有条件通过 | 作者范围限 `resource`（per-Init）、`spotLevel`、两类 story completion；`alwaysTrue` admission-only；其余不准入 |
| 现有 lifecycle 能重建/撤出 watches | 通过 | 复用 Save restore 与 Init 转换入口；Listener Domain 增加 scope 过滤和 Area 准入重算，不扩展底层 Condition/EB-T |

**结论：可为 Listener v1 另立施工 Task。** 若具体 `when` / `target` 超出上述事实能力，应删除对应 authoring capability，不补基础设施。`next` completion 后由 Listener Domain 直接 reconcile，不依赖 ConditionSystem 或新增 EB-T completion event。

## 验证与当前核验（2026-09-25）

- 只读复核源码与既有测试；没有运行测试，也没有修改代码、数据包、Schema 或机制正文。
- `npm run check:docs`：通过。
- `git --no-pager diff --check`：通过；仅报告仓库现有 CRLF 转换提示。

## 相关路由

- [[draft-0152-milestone-listener-and-achievement-packaging]]
- [[draft-0144-eventbus-trigger-millstone]]
- [[task-0145-reveal-condition-event-coverage-audit]]
- [[task-0151-milestone-persistent-arrival-facts-p0]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
