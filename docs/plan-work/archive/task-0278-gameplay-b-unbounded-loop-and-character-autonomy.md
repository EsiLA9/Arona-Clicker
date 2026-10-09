# Task：Gameplay B 无上限循环与角色自动战斗计划

状态：completed — U1–U8 已完成；2026-10-09 复核并补齐 selectable SceneAction 默认 Target，定向验证、GALHCG 复核完成；已归档并更新索引。

## 目标

让 Gameplay B 的 combat Beat 与 SceneAction batch 在没有作者上限时可由玩家逐次显式提交并持续运行；每次有效提交后沿现有 Scene、Location、Event 规则及时推进。修正角色持牌计划顺序和默认干预语义，使自动生成的 PreparedBeat 可直接提交，Carousel 双行动卡及多名学生均使用各自 Profile 优先级、当前 Character Hand、资格、资源和合法单目标。对玩家已明确选择的 SceneAction，Runtime 还须按同一合法目标优先级补全默认单目标；不替玩家自动选择 SceneAction 或其执行者。

本 Task 覆盖玩法 B 原子场景重构完成后的 Runtime 基础循环与 Character 战斗计划，不改变 EventRun、Location、Scene、PreparedBeat、OperationResolution 的职责归属。

## 事实核查与修订后的施工决定

| 已核实事实 | 源码 / 测试依据 | 对范围的修订 |
| --- | --- | --- |
| maxBeats 已可缺省；显式值须为正安全整数，达到显式上限且结果条件仍未满足时按现有规则失败。成功 Commit 已重算作者谓词和硬失败，但首次事实核查发现 `evaluateOperationLocationOutcome()` 在无上限且没有 Location 结果谓词时只会返回 null，没有通用清场完成分支。Beat 与 Location 计数在 copy-on-write Commit 中递增并检查安全整数。 | src/arona-clicker/services/operation-progress-evaluator.ts：evaluateOperationLocationOutcome；src/arona-clicker/services/operation-runtime-service.ts：commitBeat、evaluateLocationProgress | U2 补齐当前 Location / Scene 启用的 opponent Participant 清场成功出口，并保留显式上限及作者 Location 谓词语义；Runtime 不自动连续 Commit。Registry 继续拒绝明显没有清场 / 谓词 / 硬失败出口的无上限 Combat。 |
| 成功战斗 / 场景 Commit 已重新计算 Event 硬失败、Scene completion、Location outcome，并由完成地点路径自动转场或在没有出口时计算 Event outcome。结算通过 detached Run 后一次安装；不在一次命令内自动循环。 | src/arona-clicker/services/operation-runtime-service.ts：commitBeat、commitSceneActionBatch、evaluateLocationProgress、advanceCompletedLocation、finish | 保持现有调用次序和单次事务边界；仅保证无上限路径继续使用这一流程。Scene completion 仍不等于 Location completion。 |
| sceneActionBatches 虽在类型上可选，但 Registry 与 Runtime 定义校验、Resolution planner 和 Runtime batch preview 都要求正数有限值；View 把缺省解释成 0，Resume 也只为配置了有限批次的 Location / Scene 存计数。 | src/data-services/registry/operation-content-validation.ts；src/arona-clicker/services/operation-definition-validation.ts；src/arona-clicker/services/operation-resolution-planner.ts：planSceneBatch；src/arona-clicker/services/operation-runtime-service.ts：createRun、validateRestoredRun、sceneActionBatchPreview；src/arona-clicker/services/operation-view-projector.ts | 这是主要 A 类缺口。缺省改为不限；作者显式上限的 1–10 范围和耗尽行为不变。缺省上限时仍存安全整数批次计数，投影以 null 表示剩余不限。 |
| 显式 Scene 必须声明 completion 谓词；仅非空成功提交才会尝试标记该 Scene 完成，skip 只消耗已配置的批次且不执行效果。Location outcome 仍独立决定地点完成和路线。 | src/arona-clicker/services/operation-runtime-service.ts：completeCurrentSceneAfterCommit、commitSceneActionBatch、evaluateLocationProgress；tests/engine/gameplay-b-multiscene-location.test.ts | 保留 Wait / Skip 不产生无进展胜利。无上限 SceneAction 需有 Location primary objective、partial outcome、failure condition 或 Event 硬失败出口；secondary objective 与 Scene completion 都不能单独充当 Location 结果。 |
| Character Hand 在入场 / 地点切换时解析；准备快照会把所有学生当前持有行动送进 studentActionIdsByActorId。准备器会按传入顺序逐项检查启用、能力、目标与资源，并在失败时继续尝试，最后 Wait。但 Runtime 当前把手牌抽取顺序覆盖为 Profile actionPriorityIds，故持牌顺序而非原 Profile 优先级决定默认行动。 | src/arona-clicker/services/operation-runtime-service.ts：resolveCharacterHands、bindTacticalContentToCharacterHands、preparationSnapshot；src/arona-clicker/services/operation-plan-preparation.ts：candidateActionsForActor、prepareOperationBeat；src/arona-clicker/content/operation-samples/carousel-safety-slice.ts | 这是主要 B 类缺口。保留手牌实际集合与 UI 次序；规划顺序取 Profile 优先级与当前手牌交集，再追加 Profile 未排序的持牌行动。正式 Carousel 的星野、芹香各有两个候选行动；补测试直接断言 Hand、默认 target 与可直接 Commit。 |
| Target 选择只从当前存活合法目标中按 targetPriorityActorIds 排序，Beat 目标是单 Actor；Scene batch 才支持显式 all-eligible。 | src/arona-clicker/services/operation-target-selection.ts；src/arona-clicker/contracts/operation-action.ts；docs/docs-829/03-data-structures/datapack-contracts.md | 保留单 Actor 战斗目标，不扩展战术群体目标；没有合法目标时继续试下一个行动，最后 Wait。 |
| Resolution planner 已按 targetPriorityActorIds 过滤并排序合法候选；但默认目标归一化目前只对 fixed SceneAction / fixed PlayerSceneCard 执行。Selectable SceneAction 的空 targetActorIds 会被 Planner 拒绝；UI 也仅在唯一合法目标时显示默认值，多候选时要求玩家再次选目标。 | src/arona-clicker/services/operation-resolution-planner.ts：planSceneBatch / resolveDefaultTargets；src/arona-clicker/services/operation-target-selection.ts：getOperationTargetActorIds；src/ui/components/operation-workspace.ts：renderSceneActionCard、renderSceneActionChoiceCard；src/ui/controller-actions-operation.ts：targetsAfterPerformerChange、buildOperationSceneActionBatchCommand；tests/engine/operation-scene-actions.test.ts | U8 在“已明确选择 Action 与 performer”之后使用当前候选的第一合法目标作为 Runtime 默认；手动合法 targetActorIds 覆盖默认。UI 展示同一默认目标。保持 SceneAction 选择 / 执行者选择显式，保持 PlayerSceneCard 独立，不借用 UI 隐式值掩盖 Planner。 |
| Intervention 是单槽且通过 Runtime Preview 重建一名学生方案；UI 已显示当前计划和默认 Target，但明确选回当前默认行动时仍可能把无变化方案写成 Intervention。 | src/arona-clicker/services/operation-intervention-preview.ts；src/arona-clicker/services/operation-runtime-service.ts：reviseIntervention、clearIntervention；src/ui/components/operation-workspace.ts：renderAction、renderPreparedCardLayer；src/ui/controller-actions-operation.ts | 基础计划保持非干预状态；与基础计划完全相同的选择归一化为无干预 / 清除当前干预。合法替代行动或 Target 仍只能修订同一名学生。当前费用与行动合法性继续在 Runtime Preview / Planner 位置校验，不引入新货币。 |
| Run 保存安全整数计数，Resolution history 固定保留最近 32 条，恢复要求序号、时间线及对应窗口完整；计数器在 Number.MAX_SAFE_INTEGER 边界前失败，不存在任意小的循环上限。 | src/arona-clicker/services/operation-runtime-service.ts：validateRestoredRun、commitBeat、commitSceneActionBatch、advancePlanVersion；docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md | 不加人工回合上限、不改存档版本或写迁移；验证多轮提交、32 条历史裁剪、保存恢复后继续及确定性计划。安全整数边界仍作为实现边界。 |

### 已裁定的自动完成与校验边界

- 无 maxBeats 且没有 Location primary objective、partial outcome 或 failure condition 的 combat Location：当当前 Location / Scene 启用的敌方 Participant 候选行动中至少有一名 opponent，所有这类 opponent HP 降至 0 后以普通 Location success 完成。Secondary objective 不阻止该清场出口。仅以当前 Location / Scene 的启用行动识别对手，不用 Carousel ID 或全 Event 的对手总表特判。事实核查发现此先前裁定原未接入 Runtime；U2 实现后以多 Beat 回归验证。
- combat 有作者 Location 结果谓词时，仍由这些谓词控制结果；maxBeats 显式值仍是现有超时失败条件。Event hardFailureConditions 仍立即失败。
- 无上限 SceneAction 的 Location 必须声明至少一个 Location primary objective、partial outcome 或 failure condition，或 Event hardFailureConditions。Secondary objective 不构成完成出口。静态检查只识别明显缺少出口的配置，不证明复杂谓词的可达性。
- 无进展的 Wait / Skip 不满足 Scene completion 或敌方清场；每次推进仍由一次有效 Commit 命令触发。

## 设计边界

- 本 Task 包含：SceneAction 缺省上限、运行时批次数和 View 的不限语义；无上限的显然无出口配置校验；无作者 Location 结果谓词时的通用 combat 清场完成；Profile 优先级与当前 Character Hand 的规划次序；默认计划 / 单槽 Intervention 区分；选定 SceneAction 的 Runtime 默认 Target 与 UI 展示；存档恢复、长计数、历史窗口与确定性回归；同步当前机制文档。
- 明确非目标：新增 Runtime owner、AI 框架、结算服务或存档顶层键；自动运行多个 Beat / batch；非战斗 SceneAction 自动选牌；战斗 all-eligible / 多 Actor Target；Character Hand 与玩家 SceneCard 合并；Scene completion 自动完成 Location；新增干预货币 / 费用系统；Schema 字段变更、生成文件手改、存档迁移；Carousel 或某个示例 Event 特判。
- 已裁定来源：用户本轮提供的 Gameplay B 需求；范围修订依据本 Task 的源码事实表。Gameplay B 原子场景既有边界见 draft-0256-gameplay-b-atomic-scenes-task-rulings.md；它作为历史裁定背景，不覆盖本 Task 已核实的当前源码事实。

## 施工切片

单个 Task 超过 3 个 Unit，白名单与 Receipt 见 task-0278-units/。

1. [[task-0278-units/0278-u1-unbounded-author-validation]]：Datapack 校验接受缺省批次上限并拒绝明显没有退出路径的无上限内容。
2. [[task-0278-units/0278-u2-unbounded-runtime-count-and-resume]]：Runtime / Planner 支持不限批次计数、无上限 Combat 清场完成、原子提交及恢复。
3. [[task-0278-units/0278-u3-unlimited-view-and-workspace]]：OperationView 与 Workspace 将不限剩余批次表达清楚并保持提交入口可用。
4. [[task-0278-units/0278-u4-profile-priority-prepared-beat]]：自动计划按 Profile 优先级约束到当前 Character Hand，并回归正式 Carousel 双卡路径。
5. [[task-0278-units/0278-u5-intervention-default-normalization]]：Runtime 不保存与基础计划完全相同的干预方案；撤销后回到自动计划。
6. [[task-0278-units/0278-u6-intervention-plan-ui]]：UI 明确显示自动 Action / Target 与玩家覆盖，并验证默认点击不改 Run。
7. [[task-0278-units/0278-u7-mechanism-docs-and-map]]：更新当前机制文档并完成定向 GALHCG 影响闭环。
8. [[task-0278-units/0278-u8-scene-action-target-default]]：将合法目标优先级接入已选 SceneAction 的 Runtime 默认目标与 UI 表现，保留显式 Action / performer 选择及玩家 Target 覆盖。

## 测试与验收

- [x] 无 maxBeats 的 combat 可跨多次 Commit 运行；最后一名当前战斗对手被击倒时按通用规则完成 Location / Event；Wait 不因无进展自动获胜。
- [x] 显式 maxBeats 的超时结果保持原合同。
- [x] 缺省 sceneActionBatches 的 implicit 与 explicit Scene 均可多次 Commit；每次仍只执行一批；Scene completion 与 Location outcome 分开评估。
- [x] 显式 sceneActionBatches 上限仍按现有范围与耗尽规则工作；缺省配置在 View 显示不限且无上限无出口的明显无效内容被拒绝。
- [x] 正式 Carousel 双卡学生的 studentActionIdsByActorId 与 PreparedBeat 反映当前 Hand；所有合法默认 Target 由 Runtime 填入，PreparedBeat 无需 UI 补 target 即可提交。
- [x] 多名学生独立按 Profile 优先级、卡牌资格、资源与 Target 选择行动；高优先级行动因条件失败时尝试下一个合法行动，最终才 Wait。
- [x] 一名学生的合法 Action / Target 覆盖不改变其他学生基础计划；选择与基础方案完全相同不创建干预；取消后恢复自动目标。
- [x] 已选取且需要 Actor Target 的 SceneAction，在 targetActorIds 为空时由 Runtime 按当前合法候选优先级归一到首选目标；合法显式 Target 仍覆盖默认，无合法目标仍失败；玩家 SceneCard 保持独立。
- [x] UI 对 SceneAction 显示同一默认目标；点击改选后保留合法用户覆盖，但不自动选中 SceneAction 或 performer。Carousel“检查故障设备”可提交明确选中的 Action / performer 与空 targetActorIds，由 Runtime 定向到设备。
- [x] 失败提交前后 Run 完全相同；Save/Resume 后可继续不限循环并得到相同默认计划；历史保持最近 32 条且序号继续递增。
- [x] 当前机制文档与 Datapack 校验说明同步；npm run check:docs 与 git diff --check 通过。

## 验证计划（减少浏览器验收）

- 运行 operation-runtime-service、operation-scene-actions、operation-plan-preparation、Carousel 样例与相关 registry / authoring 定向 Vitest。
- U8 追加定向 SceneAction Planner / Runtime 与 Workspace / Controller 测试，核实空目标默认、优先级顺序、显式覆盖、失败不变和无自动 Action 选择。
- 运行相关 UI View / Controller 定向 Vitest，覆盖自动 Action/Target 文案、默认选项无干预以及不限批次入口。无新增布局结构，不安排桌面或窄屏浏览器回放。
- 运行 npx tsc --noEmit 与 npm run check:docs；不跑全量测试，除非定向验证暴露跨域风险。
- 不改引擎 Schema 源字段；Datapack 字段原本已是可选，故不运行 npm run gen:schema。

## GALHCG 影响闭环

- 项目绑定：resolve_project 返回 project_id=acprogram；workspace_path 与 root_path 均为 C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram，与本 Task 工作目录一致。
- 发现：overview(project_id=acprogram) 的返回因 page_limit 不完整；search(mode=map, query=Operation Runtime, node_types=[Concept]) 返回 Operation EventRun Runtime、Operation Character Hand Resolution、Operation Run Lifecycle and Persistence、Operation View Projection 等候选。source 搜索 studentActionIdsByActorId、sceneActionBatches、interventionDraft 均因 result_limit / timeout 截断，不把它们当完整文件覆盖；随后用 rg 与具体源文件核实。
- 源码核证：operation-runtime-service.ts、operation-plan-preparation.ts、operation-resolution-planner.ts、operation-view-projector.ts、operation-intervention-preview.ts、operation-content-validation.ts、operation-progress-evaluator.ts、operation-workspace.ts、controller-actions-operation.ts 及下方定向测试。
- 变更审查、Evidence 与 maps_to 更新：施工后对实际变更路径调用 review_changes；仅为本次直接受影响且有源码证据的 Operation Runtime、Character Hand、Operation View、内容校验与 UI 概念更新映射，按协议预检并写后复核。具体路径和令牌记录在 U7 Receipt。

## 当前核验（2026-10-09）

- U1–U7 完成后，补充事实核查发现 selectable SceneAction 缺少 Runtime 默认目标归一；U8 已按首选合法候选补齐 Planner 与 Workspace，并保留 Action / performer 显式选择。
- U1–U7 聚合定向验证为 15 个 Engine / UI 文件、230 项通过；U8 再运行 4 个 Engine / UI 文件、61 项通过。`npx tsc --noEmit`、归档后的 `npm run check:docs` 与 `git diff --check` 均通过。分阶段测试与 GALHCG 令牌见 U1–U8 Receipts。
- U4 核实到：遵循 Carousel 现有 Profile 优先级后，无干预固定种子流程为 partialSuccess、奖励 80 credit；此前成功结果来自 Hand 抽取顺序覆盖 Profile 优先级。现有行动覆盖仍可选其他合法方案。保留 Profile 原值并记录于 U4 Receipt，没有加 Carousel 特判。
- U6 进一步核实：Carousel 星野的 Brace 是 Profile 默认目标型行动；再次选择当前自动 Brace 会清除此前干预并恢复自动 target，不应形成 Intervention。UI 持续显示“自动计划”与默认目标，实际改选仍标注“玩家已修订”。

## 剩余工作

- 无。本 Task 与 U1–U8 Unit / Receipts 已归档并登记在 `docs/plan-work/00-index.md`。
- 后续玩法方向：无。本 Task 不包括自动选择非战斗 SceneAction / performer、更广泛的 Gameplay B 策略、UI 重塑、内容重平衡或事件编辑器增强。

## 相关路由

- docs/docs-829/00-INDEX.md
- docs/docs-829/03-data-structures/datapack-contracts.md
- docs/docs-829/03-data-structures/operation-view.md
- docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md
- docs/docs-829/05-conventions/architecture-discipline.md
- docs/docs-829/05-conventions/testing.md
- docs/ai/context-packs/character.md
- docs/ai/galhcg-project-map.md
- docs/plan-work/draft-0256-gameplay-b-atomic-scenes-task-rulings.md
