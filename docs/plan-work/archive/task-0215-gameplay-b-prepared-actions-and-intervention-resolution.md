# Task 0215 — 玩法 B 行动准备、有限指挥与统一结算

状态：completed — U1–U9 实现、验证与收据均已完成；按 Task Owner 指示于 2026-10-05 归档。本次只修正文档状态，不重新施工。

## 目标

以 Task 0213 的 EventRun owner 和 Task 0214 的受控参与者/Profile 快照为基础，建立确定、可解释且可重放的战术 Beat：按有限内容准备学生行动和敌对/环境 Intent，允许 Sensei 提交一个学生计划修订，再以单次 Commit 原子结算并产生一条 Resolution。

## 范围

- 建立唯一权威 `OperationActionDef` 合同、当前 Run 的 Team 战术资源状态、已有 Location ID 对应的临时战术规则块。
- 学生的候选行动来自已入场 `StudentOperationProfileDef`；对手/环境的候选行动来自对应 `OperationParticipantSpec`。两者都必须引用受信内容入口解析到的 `OperationResolvedContent.actionDefinitions`。
- 纯准备器依当前 Run 快照、行动资格/优先级、合法目标及资源预算生成稳定 `PreparedBeat`；敌方/环境 Intent 仅按内容声明顺序选取，不运行通用 AI。
- 单个战术 Beat 只保留一个 `InterventionDraft` 槽，最多修改一名学生的行动和/或目标。准备、修改、预览、撤销和拒绝命令不消费随机数或改变局面状态。
- Commit 校验当前 Run、计划版本、唯一指挥槽、行动/目标资格和 Actor/Team 资源后，计算协同、角色技能和有限局部效果；全部写回 Run 并追加 Resolution 必须是一次原子转移。
- Actor 与 Team 战术资源属于 EventRun。`PlayerRouteState.playerCost` 是另一资源域；本 Task 不读取、不扣除它，也不接入 SceneAction 或玩家场景卡。

## 当前已实现基础与边界

| 当前事实 | 证据 | Task 0215 的处理 |
| --- | --- | --- |
| EventRun 是每个 GameInstance 私有 Operation owner 的唯一可变局内状态；公开 `operationEntry` 只暴露 ID-only start 与 detached snapshot。 | `src/arona-clicker/runtime-game-instance.ts`、`src/arona-clicker/services/operation-entry-service.ts`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 通过窄入口增加专用 Beat 命令；不重新暴露 raw owner 或通用 `applyStateDelta`。 |
| Actor 当前已有 bounded HP / resources；OperationEventDef 只有 Location ID 集合，尚无 LocationDef。 | `src/arona-clicker/contracts/operation.ts`、`src/arona-clicker/services/operation-definition-validation.ts` | 增加最小 Team Run state；战术规则以已声明 Location ID 为键，不建立路线/完整 Location 内容系统。 |
| 学生 Profile snapshot 已固定 candidate/priority/capability/reason 投影和 Wait fallback；Profile 不持有可执行代码。 | `src/arona-clicker/contracts/student-operation-profile.ts`、`src/arona-clicker/services/student-operation-profile-resolver.ts`、`tests/engine/student-operation-runtime.test.ts` | 行动资格的唯一权威字段迁移至完整 `OperationActionDef`；现有 snapshot 由它投影，不保留平行 `actionRequirements` 合同。 |
| `EventRun.random` 目前只含 seed/cursor 槽，没有 Operation 专用 RNG 消费器；现有 AC 的 `Math.random()` 机制不是 EventRun 的确定性流。 | `src/arona-clicker/contracts/operation.ts`、源码中的 Gacha/Story 随机入口 | 使用本 Task 明确的 counter-addressed SplitMix64；不复用产品全局随机。 |
| Engine Effect 通过宿主 Port，不由通用 Engine 解释产品内容；Engine EventBus 与 Mutation 是跨系统写入/通知边界。 | `docs/docs-829/03-data-structures/engine-contracts.md`、`docs/docs-829/04-mechanisms/engine/effect-trigger.md`、`docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md` | 战术结果由 AronaClicker Operation 产品服务在 EventRun 内结算；不扩展通用 Effect 或逐行动广播。 |

## 本 Task 的实现裁定

### Action、参与者与临时 Location 战术合同

- `OperationResolvedContent.actionDefinitions` 是本 Task 唯一可信 Action 定义入口。`OperationEventDef.actionRequirements` 删除；`OperationActionDef.requiredCapabilityIds` 是唯一能力门槛来源，`reasonIds` 是行动理由来源。Task 0215 不建立 Datapack 表或 Registry 表；Task 0220 再规范化正式内容合同。
- 每个学生行动候选由 Profile 的 `actionPriorityIds`（优先）及 `candidateActionIds`（次序补足）给出；资格投影要求候选 ID 在受信 Action definitions 中存在。每个对手/环境 `OperationParticipantSpec` 声明自己的有序 `candidateActionIds`。当前 Location 的 `enabledActionIds` 只过滤可用项，不建立另一套优先序。U2/U3 在 Run-start input 中投影这些候选；U8 将 Event、Action、Skill 和参与者候选数据深拷贝/冻结在私有 per-Run rules，之后准备、预览和 Commit 不重新查询 resolver 或 Registry。
- Action 定义含稳定 ID、允许的参与者 kind、能力需求、理由、标签、可选单一资源费用、单体目标合同及有限局部效果。Task 0215 的效果仅覆盖 Actor HP/resource、Team resource、EventState 数值轨道的 delta；事件事实、Predicate、地点/事件目标与结局属于 Task 0217。
- `OperationResolution` 定义在 src/arona-clicker/contracts/operation-resolution.ts；它是 Run 持有的有界结算记录类型，包含 consumed base planVersion、行动与指挥、支付/协同/随机结果及状态差异，不携带完整 Run 或规则定义。
- `OperationEventDef.teams` 声明 Team ID 与 bounded tactical resources；`OperationActorDef.teamId` 关联唯一 Team。Team membership 只按此字段确定，不从 `factionId`、角色或阵营推断。Actor/Team 都是 EventRun 局部状态，均与 PlayerCost 隔离。
- 在当前尚无 `LocationDef` 时，Event 定义包含 `locationTactics[]` 临时块，以已有 `locationId` 索引；块内只声明该地点启用的 Action ID 与协同规则。学生候选顺序唯一来自 Profile，非学生唯一来自 ParticipantSpec；Location block 只做 `enabledActionIds` 过滤，不重复定义候选次序。不加入 RouteEdge、Objective、场景模式或 Location 生命周期。Task 0218 可将该块合入正式 Location；Task 0220 冻结其 Datapack / Registry 形状。

### 确定性准备、目标和共享 Team 资源

- `PreparedBeat` 是 EventRun 内冻结且可 detached 读取的计划。U4 纯准备器只计算该值，不写 Run、发事件或消费 RNG；U8 的唯一 Run owner 在启动、有效提交和合法状态变更后保存/替换当前 PreparedBeat。0219 随 Run 保存该当前值。相同 Run 快照与同一份 Run-start frozen rules 必得相同 plans、target、cost 和 reason。
- 学生行动优先顺序为 Profile `actionPriorityIds` 的合法候选，再按 `candidateActionIds` 次序补足；每项还必须在当前 Location 启用、满足 ActionDef 能力门槛、允许该参与者并通过预算/目标检查。对手/环境仅按其 ParticipantSpec `candidateActionIds` 顺序尝试；不引入 AI 策略语言。
- 当前 Location 缺少 `locationTactics` 块时，视作 `enabledActionIds=[]`，关闭该地点全部行动并产生 Wait；不回退为启用整个 Action catalog，也不查找其他地点。自动目标不可用或成本不足只淘汰当前候选并继续尝试下一项；只有候选最终可执行时才预留成本，Wait 永不扣费。动态 Wait reasons 以 `operation:plan:no-candidate-action`、`operation:plan:no-enabled-action`、`operation:plan:no-legal-target`、`operation:plan:insufficient-resource` 区分并按候选顺序聚合；学生静态能力无合格候选时保留 Profile fallback reason。
- Actor 遍历顺序以 `OperationEventDef.actors` 声明顺序为唯一规范顺序；所有 Team 共享资源预留、Action/Intent 选择、Combination pair 搜索和 Student Skill roll 均按该顺序执行。成本不足时尝试同一候选序列的下一项；无可执行项时生成无成本 Wait 与稳定原因 ID。
- 目标合同仅支持无目标或单个 Actor 目标。ActionDef 声明是否需要目标及 team relation（self/sameTeam/otherTeam/any）；来源 Actor slot 的 `targetPriorityActorIds` 提供场景偏好并只能引用本 Event 声明的 Actor。`self` 只匹配行动者自身；`sameTeam` 要求双方 teamId 都已声明且相同；`otherTeam` 要求双方都属于已声明且不同的 Team；`any` 包含无 Team 的 Actor。自动目标先取来源 Actor slot 明确优先且仍合法的 ID，之后按 Event Actor 声明顺序取第一个；不得把具体 Actor ID 放入可复用 ActionDef，也不得用对象迭代偶然顺序、随机数或动态全图查询破同分。玩家可干预时必须传入一个当前合法 Actor ID。
- Team 与 Actor 资源均按 Actor 声明顺序预留；同一 Beat 的新资源效果不能资助该 Beat 的 Action。Intervention 后只替换该学生的计划；若该修改使任何计划无法支付或目标不再合法，则拒绝修改，不暗中改写其他 Actor 原计划。

### Sensei 指挥、Combination 与局部效果

- 一个 Beat 最终提交至多一个学生计划修订。草稿可由交互更新/撤销，但任一时刻只允许一个学生 Actor 的 action/target 覆盖；切换目标 Actor 前先清除旧草稿。未编辑 Actor 的计划必须逐字段保持原值。
- 此“一指挥位”是实现约束，仍是 Draft 0212 标记为新提案的玩法假设；Task 0216 必须检查冲突机会和实际取舍是否让玩家理解并愿意使用。若体验不成立，在 UI 验收后重议，不提前伪称为用户确认规则。
- Combination 规则嵌入当前 Location 的临时战术块；只配对两名不同学生的 PreparedAction，输入 Actor 按 Event Actor 声明顺序分别匹配规则有序 tag slot A/B；按 `(priority 升序, rule ID code-unit ordinal, slot A Actor index, slot B Actor index)` 总序枚举并消费，第一个未被使用且匹配的 pair 获胜。target match 仅支持 `same-target` 或 `no-target`。每个学生行动最多被一条规则消费；无多输入搜索。匹配时组合结果替代两个原始行动效果，但两项输入费用照常支付；角色 Skill 仍根据原始已提交行动判断是否触发。
- 所有 Action、Combination 与 Student Skill 效果均依据同一 Commit 前 EventRun 快照生成局部 delta，数值 delta 按 target/key 累加后一次限幅写回。资源费用先按 Commit 前余额校验并预留；本 Beat 的效果资源产出不能反向用于支付本 Beat 费用。细化事实集合、Predicate、目标/结局和跨效果冲突语义由 Task 0217 承接。

### RNG、原子性、版本与历史

- 使用 counter-addressed SplitMix64 v1；Algorithm ID 为 `splitmix64-counter-v1`，BigInt 64-bit 运算，随机快照字段为 `algorithm`、`seed`、`tacticalCursor`。固定 stream tag 为 ASCII `tactical`（`0x746163746963616c`），版本由 Algorithm ID 表达；不同系统不得共用此 stream。`tacticalCursor` 表示已消费的 raw 64-bit word 数。
- Student Skill 使用整数 basis points `[0,10000]` 的机会规则；只有 Profile 引用的规则存在、**干预应用后的最终学生 Action ID** 满足规则 trigger、且该 Run 有效 Commit 到达结算时才抽取。触发检查发生在 Combination 消费前；组合替代 Action 效果，但不改变玩家最终提交的 Skill trigger Action。每个实际检查都用 rejection sampling 取 `[0,10000)`，每个 raw word（含被 rejection 的 word）推进一次 provisional cursor。roll 顺序是 Event Actor 声明顺序；同一有效输入与 seed 得到同一结果。准备、Intervention、预览、撤销、非法/过期 Commit 和任何失败结算都不写回 cursor。内容规则与效果仍来自受信临时 resolver，Task 0220 负责正式内容合同。
- Commit 输入只携带 `runId` 与当前 `planVersion`；干预 Draft 已经作为 EventRun 状态经单独版本命令写入，不随 Commit payload 重复发送。只有当前 in-progress Run、当前 PreparedBeat 版本、唯一有效 Intervention、全部行动/目标/预算检查通过后才计算 Resolution。纯 planner 产生临时的 resolved batch；Run owner 再将 Actor/Team/Track delta、tacticalCursor、Beat/Resolution sequence、草稿清理和历史 append 一次写回。任何验证或结果合并失败均不写 Run，也不消耗游标。Resolved content 在 start 时已冻结，结算过程中不重新调用 resolver。
- 每个 Run 的 `planVersion` 单调递增。Commit request 的 `planVersion` 是提交时消费的 base version；最新 Resolution 保留此版本。对最新一次已消费的 `{runId, base planVersion}` 重试时，在通常的 stale 检查前返回同一 Resolution，不重复通知；更早版本或其他旧 run 明确返回 stale，不改变状态。Commit 命令不再接收 Draft payload，修改草稿本身须先以当前版本写入 Run，因此同一个 base version 不可能代表不同 Draft。更新后的新 Beat 不能被旧版本命令覆盖。
- Run 仅保存最近 32 条 compact Resolution；每条保留计划/指挥/Intent/协同/技能结果/支付及局部状态差异，不内嵌完整 Run 或内容定义。`resolutionSequence` 单调递增，不因裁剪回退。更早版本的重试只返回 stale，不要求保留完整无限历史。Task 0220 负责限制单条内容规模，Task 0219 另定存档字节上限。

## 保留的后续 Task 边界

| Task | 本 Task 提供 / 本 Task 不接手 |
| --- | --- |
| 0216 核心切片 UI | 提供窄入口命令及 detached PreparedBeat/Intervention/Resolution 投影所需数据；不建 UI。0216 体验验收“一指挥位”、干预竞争与行动差异。 |
| 0217 目标与部分结局 | 提供低层快照结算、局部 actor/resource/team/track delta 和 Resolution 容器；0217 负责 Predicate、facts 效果、目标/地点/事件结果、奖励和完整效果规则。 |
| 0218 因果地点/路线 | 当前战术定义仅以已有 Location ID 临时索引；0218 负责完整多 Location、出口、持有物 gate、回访上限与转场。 |
| 0220 Datapack/Registry | Action definitions 通过受信 `OperationResolvedContent.actionDefinitions` 提供；当前 TS/resolver 形状是临时入口，不建正式 Schema/Registry 表。0220 冻结作者合同、内容规模上限与兼容身份。 |
| 0219 Save/Resume | 本 Task 在 EventRun 内维护 PreparedBeat、InterventionDraft、Team resources、tactical cursor 与有界 Resolution；不改 SaveData、编解码或兼容版本。0219 负责精确保存/恢复。 |
| 0224/0225 SceneAction 与玩家场景卡 | 两者后续共用 Resolution 边界；本 Task 不接入 SceneAction、PlayerCost、场景卡费用或抽牌流。 |

## 验收

- [x] Task 0214 Profile 静态候选资格从 `OperationResolvedContent.actionDefinitions` 投影，`OperationEventDef.actionRequirements` 不再作为第二权威来源；学生候选和非学生 ParticipantSpec 候选都经完整 ActionDef 引用校验。
- [x] Team 定义与 Actor `teamId` 形成 Run 内独立 Team resource state；Actor/Team 两种 Action 费用只读写各自战术资源，永不读写 PlayerCost。
- [x] 每个已准备 Actor 恰有一个带清晰来源/理由的 PreparedAction 或 Intent/Wait；相同输入得到相同计划、目标和组合预览，准备与预览不改 Run/RNG。
- [x] 对手/环境 Intent 来自 ParticipantSpec 声明候选次序；无 generic AI、Registry 扫描或随机准备。
- [x] 同一 Beat 至多一名学生的行动/目标经单一草稿槽修订；合法提交时其余 Actor 计划逐字段不变。错误 actor/action/target、预算不足或 stale planVersion 的命令无状态写入。
- [x] Combination 仅使用两个不同学生、当前 Location 的局部规则、确定标签槽、同目标/无目标匹配；优先序和 pair 顺序固定；输入至多消费一次，组合效果替代原输入效果且原输入费用只扣一次。
- [x] Student Skill 只在已验证的有效 Commit 中按规定顺序消耗 tactical stream；同 seed/replay 完全一致；预览/撤销/拒绝和失败结算不推进游标。
- [x] 同一冻结 Run 快照计算全部效果与费用；Actor/Team/track 一次合并限幅/原子写回；无有效 Commit 不产生 Resolution；最新 consumed base planVersion 的 retry 返回同一 Resolution 且不重复写入或通知，更早版本 stale。
- [x] Resolution 为有界的最近 32 条记录，内容能解释计划、指挥修改、Intent、成本、协同、技能与局部状态差异；不保存完整 Run 或定义副本。
- [x] 不修改通用 Engine Event/Effect、PlayerState、InitSnapshot、Datapack Schema、SaveData 或 UI；相关责任分别留给后续 Task。

## Patch Units 与 Receipt

本 Task 超过三个 Unit，按职责拆分至下列目录；每个 Unit 的 Read Set 与 `Allowed Files` 见对应文件，施工结束或中断均填写对应 Receipt。**优先保持文件职责清楚；不要为满足代码行数预算拆散职责。每个 Unit 通常围绕 3–5 个相关文件组织，确需跨越时由 Receipt 解释。**

U1–U8 在各自收尾时只写入白名单内的对应 Receipt；U9 负责机制文档、GALHCG 与最终 Task Receipt/归档检查。Task 完成后，Task 文件与单位目录一并移至 `docs/plan-work/archive/`；Receipt 路径为 `docs/plan-work/archive/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/`。

1. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u01-action-and-team-contracts]] — Action/Team 基础合同与 Team Run 状态。
2. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u02-action-catalog-and-profile-gates]] — 受信 Action Catalog 与学生 Profile 门槛迁移。
3. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u03-nonstudent-action-candidates]] — ParticipantSpec 的非学生候选投影与 admission 校验。
4. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u04-pure-preparation-and-targeting]] — 纯准备、Intent、资源预留和目标稳定顺序。
5. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u05-intervention-draft-and-preview]] — 单槽干预草稿校验与纯预览。
6. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u06-combination-and-seeded-rng]] — 二输入协同匹配与可恢复 SplitMix64 战术随机流。
7. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u07-pure-resolution-planning]] — 同一冻结快照上的费用、技能与局部效果计划。
8. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u08-atomic-run-commit]] — Run owner 原子提交、幂等/stale、有限历史与窄命令接线。
9. [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/0215-u09-mechanism-docs-and-galhcg]] — 当前机制文档、定向 GALHCG 证据与 Task 收尾。

归档状态修正（2026-10-05）：Task Owner 已确认 U1–U9 全部完成并直接归档。本次只修正文档状态和归档位置，不增加施工或验收步骤。

## Dependencies

- 已完成 Task 0213（EventRun owner/lifecycle）与 Task 0214（学生准入/Profile 静态快照）。
- U1 → U2 → U3 → U4 → U5 → U6 → U7 → U8 → U9；U4 依赖 U2 与 U3，U6 依赖 U1 的 Action/Effect 合同。U9 仅在 U1–U8 机制稳定后执行。
- Task 0216、0217 使用 Task 0215 的战术计划与结算边界；Task 0216 另验体验，不把它的玩法验证替代为单测。

## 验证与机制文档

- 代码 Unit：每个 Unit 运行定向 Vitest 与 `npx tsc --noEmit`；Runtime owner 变更另跑 `npm run check:architecture`。按实际触及面运行并记录 `git diff --check`。
- 文档 Unit：运行 `npm run check:docs`、`git diff --check`；按 `docs/ai/galhcg-project-map` 对修改源码/测试/当前文档逐路径 `review_changes`，稳定 Action/Prepared Action/Intent/Resolution 语义后维护图谱。
- 当前权威机制页为 `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`。代码稳定后在该页补充现状；数据流/模块卡仅在真实入口职责发生变化时同步，不复制 Runtime 正文。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[task-0214-gameplay-b-student-participation-and-autonomy]]
- [[task-0216-gameplay-b-command-loop-vertical-slice-ui]]
- [[task-0217-gameplay-b-objectives-and-partial-outcomes]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[docs/docs-829/05-conventions/testing]]
