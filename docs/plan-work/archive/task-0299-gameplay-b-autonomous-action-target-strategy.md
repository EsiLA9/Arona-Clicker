# Task 0299：Gameplay B 自主行动与目标策略

状态：in progress — P0 产品规则已冻结，按 P0—P5 分 Patch Unit 施工。领域 Owner 与 Workspace / UI 接线分开；遇到真实共享接口冲突时只暂停受影响 Unit。

> 归档冻结：2026-10-19。保留原状态；P0—P5 施工与 Workspace 验收尚未全部闭环。

## 目标

在新版 Gameplay B 的 MapRun / Encounter 中，让角色每轮基于当前角色池、倾向、双方状态和资源自主准备 Hand 与合法默认目标；准备结果在本轮稳定，提交按明确顺序结算。玩家可干预行动和目标，但只在希望改变结果时操作。

普通多目标行动必须能够在玩家不点敌人的情况下正常 Commit。不得恢复旧 Operation Planner、增加长期策略 Owner、根据名称 / 描述猜行动用途，或让 UI 推断领域目标。

## 产品规则裁定（P0，已冻结）

### 单位目标

- Action 可选声明 target preference：stableOrder、lowestHpRatio、highestMissingHpRatio。未声明时为 stableOrder。
- preference 只在当前合法目标中选择：enemy 支持 stableOrder / lowestHpRatio；partyCharacter 支持 stableOrder / highestMissingHpRatio；不兼容组合由 Registry 拒绝。none / self 不接受 preference。
- lowestHpRatio 比较当前 HP / 最大 HP；highestMissingHpRatio 比较损失 HP / 最大 HP。比较使用精确整数比例；相同优先级依次按 Encounter 敌人定义顺序或 Map 固定队伍顺序。不能读取 Action 名称、描述、图片或阵营猜策略。
- 多目标的自动默认目标在当前准备快照下确定。玩家手动选择任一合法目标（包括当前默认目标）后作为本轮显式覆盖保存；刷新与 Preview 不覆盖。清除选择恢复当前策略结果。
- 若抽卡前单位目标 Action 没有任何合法对象，将它从资格候选中排除；没有可抽 Action 时保持空 Hand / Wait，不创建虚构 Wait 卡，也不为满足攻击行为补资源。

### 情境权重与自然行动资源预留

- Action 可选声明 tendencyRole：recovery、defense、attack。缺省仍只使用 Encounter 候选原有 tendencyWeight。
- recovery：目标为 partyCharacter 时，至少一个存活合法队友损失 HP 达最大 HP 的 25% 或以上时权重乘 2；目标为 self 时，仅检查行动者。defense：行动者当前 HP 不高于最大 HP 的 50% 时乘 2。attack：目标为 enemy 且存在至少一个存活合法敌人时乘 2。
- 不满足条件时乘 1；倍率总上限为 2，不叠乘。用途只能来自显式 role；role 与 target 类型不兼容时 Registry 拒绝。情境权重只进入本轮加权不放回抽 Hand，不得抽完后替换 Hand[0]。
- 每轮按 Map 固定队伍顺序准备。为当前角色抽自然 Hand[0] 时，使用先前角色自然行动预留后的虚拟 Team 余额过滤；选定 Hand[0] 后仅在计算中扣留其 Team cost。虚拟预留不写资源、不计入 receipt、不改变 Commit 扣费。
- Hand 后续候选仍按现有单个 Action / 当前实际余额资格与加权不放回规则抽取，不受虚拟预留过滤；因此玩家 Swap 到其他牌后可以使整轮费用冲突，Commit Preview 必须重新校验。PlayerCommand、Ability、Item 也可能造成玩家干预后的费用冲突，按现有整轮校验处理。
- 若剩余虚拟预算下没有可承担的自然 Action，则该角色 Hand 为空 / Wait，后续角色继续按剩余预算准备。不得暗改 Hand 顺序、隐藏 Override、重抽直到满意或增加资源。

### 同轮目标失效与费用

- 只针对 Character Action 的单位目标。Commit 按固定队伍顺序实际模拟 HP；若自动目标在该角色执行前已死亡或失去资格，则用当前 Action preference 从此刻剩余合法对象中重选。仍合法的原目标保持不变。不得重抽 Hand、重新规划其他角色或重新计算 PlayerCommand。
- 自动目标没有剩余合法对象时，Action 不执行、目标相关的 Action effects / HP effects 不应用、Actor / Team Action costs 不收取，并在纯 Commit Plan / Preview / 实际 Commit receipt 中一致标为 noLegalTarget。若该行动来自 PlayerCommand，已支付的 1 PlayerCost 指令费仍收取；该费用属于指令，不属于未执行 Action 的 Actor / Team cost。
- 玩家手动目标在本轮执行前失效时不改锁、不自动换目标，沿用 Task 0291 的既有明示战术结果：该 Character Action 仍付 Actor / Team cost，HP 实际变化为 0。提交前已经失效的选择仍由 Preview 按非法草稿拒绝，允许玩家重新选择。
- 本 Task 的 P1—P5 实现仍只直接修改 Character Action。Ability / Item 的显式目标、PlayerCost / Item 消耗和玩家执行顺序继续遵循 Task 0291。原 Enemy 固定回击与隐藏意图规则已由用户后续明确替换：双方共用自主行动策略，Enemy 回合准备结果只读展示、不可被玩家操作；具体实现见 [[docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards]]。
- 换牌（Swap 或 PlayerCommand）立刻清除该行动旧显式目标，再依据新 Action 和当前状态计算；即使新结果与旧目标相同，也不得继承旧值。恢复自然行动也重新计算。此重算不抽牌、不重复扣指令费、不自动提交。

### 卡牌目标与回合稳定

- 先确定本轮全部 Hand / Prepared Actions，再从现有 MapRun 真实卡牌目录建立合法卡牌目标；同 Action ID 的不同卡牌实例是不同目标。按稳定目录逻辑顺序选择缺省目标，绝不使用 DOM 顺序。
- 卡牌目标无合法实例时不重抽、不暗中换用 Hand 其他牌、不永久阻止 Commit：Preview 明确标记该准备行动将以 noLegalTarget 跳过，当前 Action 不收 Actor / Team costs；玩家仍可使用合法 Swap / PlayerCommand 修改行动。不得把它静默伪装为空 Hand / Wait。
- 同一回合打开 UI、Hover、Focus、读取角色信息和重复 Preview 不改变 Hand、目标或 RNG。自动目标从相同保存快照确定性重建；手动目标随存档保留。只有成功 Commit 后的新回合才按最新 HP / Enemy / 资源状态重新抽取。
- 若未来引入随机目标或无法从保存快照稳定重建的准备结果，必须保存其结果或相应随机状态；本版本不引入随机目标。

## 对旧任务合同的明确修改

| 原合同 | 新合同 | 影响 |
| --- | --- | --- |
| Task 0290：多合法目标必须等待玩家选择。 | 由本 Task 替换：只在合法目标中按 Action preference 或稳定领域顺序确定默认目标，同时允许手动改选。 | Hand、Swap、PlayerCommand、Owner、RNG 和 Save / Resume 其余合同保留；以现行源码的“每位角色各自拥有 Override”行为为准，不沿用 0290 共享单槽文字。 |
| Task 0291 C4：Commit 起始目标在较早行动击倒后仍照付费用并产生 0 HP delta。 | 只对自动准备的 Character Action 目标增加执行前重选；无剩余对象时该行动跳过且免 Actor / Team Action costs。手动目标仍按 C4 付费并产生 0 delta。 | 有意覆盖 0291 的自动目标冻结规则；不改变 Ability / Item、手动目标、玩家阶段顺序和敌方目标时点。Commit Preview、实际费用与 receipt 共用同一纯顺序计划。 |
| Task 0298 F4：换牌清除目标，由 Owner 重新解析。 | 保留并明确“新卡按自身规则重新决策，不继承旧目标”，包括结果碰巧相同的情况。 | 复用现有命令和 Owner，不重做 UI、目标命令或卡牌身份。 |
| Task 0291：Enemy 仅在 Character / Ability / Item 阶段之后以固定 damage 回击；Task 0299：Enemy 目标不提前准备或公开。 | 双方共享自主抽牌、行动倾向、目标选择与自动失效修复；Enemy 在回合准备阶段确定 Hand 与自然行动，UI 只读展示且不能替换或手动改目标。 | 有意扩展 Task 0299 的 Character-only 策略范围，并替换 C4 固定回击规则；由 Task 0301 独立实施，既有 Character 合同保持。 |

## 当前实现事实与范围边界

| 已核实事实 | 源码 / 测试依据 | 实施影响 |
| --- | --- | --- |
| Hand 是按固定队序加权不放回抽取，最多 3 张；逐角色 Action affordability 当前只比较起始余额。Hand[0] 是自然行动，空 Hand 为 Wait。 | src/arona-clicker/services/gameplay-b-hand-resolver.ts：drawGameplayBHands / resolveCandidates；src/arona-clicker/services/map-run-service.ts：createEncounterSnapshot | 加入显式目标资格、局势权重和自然 Team 费用虚拟预留；Save 恢复须用同快照重演并校验。 |
| 当前单位多目标只在唯一候选时自动选；敌方零目标会抛 Preview 错误，队友 / 卡牌零目标会进入待选。 | src/arona-clicker/services/gameplay-b-action-preview-resolver.ts：resolveGameplayBActionPreview；tests/engine/gameplay-b-map-run.test.ts | 修复普通单位多目标与零目标行为，保持完整合法候选。 |
| targetSelections 只保存玩家显式目标；Preview 纯读。换牌、恢复自然行动都会清目标并由 Owner 重新解析。 | src/arona-clicker/contracts/map-run.ts；src/arona-clicker/services/map-run-service.ts：setPreparedTarget、setPreparedEnemyTarget、setActionOverride、clearActionOverrideForSlot；Task 0298 U7 Receipt | 复用现有状态；自动目标由 Encounter 快照确定性派生，手动目标保存在本轮。 |
| Commit Preview 与真实 Commit 调用同一个 resolveEncounterCommitPlan；当前计划先汇总费用，再顺序模拟 HP。 | src/arona-clicker/services/map-run-service.ts：resolveEncounterCommitPlan、previewEncounterCommit、prepareEncounterRoundCommit；tests/engine/gameplay-b-map-run.test.ts | 在该纯计划中加入执行时目标重检与跳过标记，让预览、费用与 receipt 使用同一结果。 |
| MapRun 卡牌有真实引用、目录、合法候选、目标命令、Save / Resume 与 scost Commit；Flow 独立玩法卡的身份仍未完成。 | src/arona-clicker/services/map-card-catalog.ts；tests/engine/gameplay-b-map-cards.test.ts；Task 0298 U11、U13—U15 Receipts | P4 只实现已有真实 MapRun 卡牌；Flow 卡身份未准备好时作为独立 follow-up，不建第二套目录。 |
| Task 0291 U4 仍标为 Workspace 施工中，范围为 View / Query / Controller / UI；当前没有单独 U4 文件白名单或 Receipt。 | docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md：U4；当前 git status | 先执行不改其共享 Workspace / Runtime View 接口的领域 Unit；若 P5 确需修改该共享接口，届时只暂停该接线 Unit。 |

## P0—P5 执行顺序

### P0：合同更新与范围准入

- 将本节产品规则写入权威 Task，标明已确认的规则覆盖、费用账、稳定顺序和 C4 例外。
- 复用当前源码与测试结论，不重新做全仓审计或全面设计评审；P0 通过后直接进入 P1。

### P1：普通单位多目标自动选择

- 在 Action 目标合同中加入可选 preference；按目标类型校验兼容性。Resolver 先取当前合法对象，再依 preference 稳定选择默认值。
- 保留完整合法候选和手动改选。玩家选择自动默认值也存成手动选择；清除后回到策略默认值。
- 验收：三个敌人时，白子自然准备射击无需点击敌人即有合法目标；最低 HP 比例、友方最高缺失比例、平局队序、无偏好稳定顺序、Swap 重算和 Save / Resume 稳定。

### P2：有限情境权重

- Action 的可选 tendencyRole 仅有 recovery / defense / attack。按 P0 的精确条件以 1 或 2 倍调整基础 tendencyWeight；不引入任意公式。
- Unit legality 和零目标硬过滤先于权重；权重改变 Hand 抽取概率，不在抽卡后换掉自然 Hand[0]。
- 验收基准 / 修正权重、资格优先、确定性 RNG、重复 Preview 无 RNG 游标变化及 Save / Resume 手牌重演。

### P3：同轮目标失效与多人自然费用准备

- 顺序模拟 Character Actions；自动目标失效时按当前卡策略重选，无对象时跳过且不收其 Actor / Team Action costs；手动失效目标维持 C4 战术结果。Ability / Item 保持 C4。
- Commit Preview、正式 Commit、资源变化与 receipt 必须复用同一计划；Receipt 可区分执行目标与 noLegalTarget 跳过原因。
- Hand 准备按固定队序虚拟预留自然 Hand[0] 的 Team costs；不真实扣费。Hand 替代候选按原资格抽取；玩家 Swap / Command 后重新做整轮 Readiness 检查。
- 验收：A 先被击败时自动选择 B；无剩余敌人时自动行动跳过且不付 Action cost；手动指定 A 不改锁；Team=3、两自然 Action 各 2 时仅前序角色自然承担费用，另一角色按明确空 Hand / Wait 规则准备。

### P4：真实 MapRun 卡牌目标

- 保持两阶段准备，在所有 Hand 确定后从既有真实卡牌目录和合法候选中按稳定目录顺序选默认实例。
- 同 Action ID 的卡牌实例身份不合并；换牌重算；卡牌没有目标时按 P0 标记跳过，不循环重抽或阻塞 Commit。
- 复用 Task 0298 已完成的身份、命令、保存与效果合同。Flow 卡独立身份及 P6 作用线不是 MapRun 卡牌策略的前置条件。

### P5：真实路径战斗验收与交接

- 以真实 Gameplay B Datapack 经过 Registry、Resolver、Runtime / MapRun 与现有 Workspace 运行白子、芹香对机器人 A/B/C 的多轮战斗，不加载旧 Operation、不依赖作用线或 UI 目标推断。
- 第一轮零玩家干预直接 Commit；较早击杀后后手按策略重选；第二轮按 HP、存活敌人和资源重新抽牌选目标；再验收 Swap、手动目标覆盖、Save / Resume。
- 覆盖 Runtime / UI 只读投影、正式费用与实际 receipt。UI 仅展示 Owner 结果和转发命令。
- 稳定后按文档维护规范更新相关机制页，运行直接受影响的测试、类型检查、Schema 同步（遵守生成文件边界）、文档检查和差异空白检查。

## Patch Units

本 Task 超过 3 个 Unit，详细 Read Set、Allowed Files、Non-goals、Stop Conditions 与 Receipt 位于 docs/plan-work/archive/task-0299-units/：

| Unit | 阶段 | 目标 | 状态 |
| --- | --- | --- | --- |
| U0 | P0 | 记录已冻结合同、旧任务覆盖和施工边界。 | 完成 |
| U1 | P1 | 加入单位目标 preference 与稳定自动默认目标。 | 完成 |
| U2 | P1 | 抽卡前过滤无合法单位目标。 | 完成 |
| U3 | P2 | 加入显式 tendencyRole 配置和 Registry 兼容校验。 | 完成 |
| U4 | P2 | 加入有限情境权重和存档重演上下文。 | 完成 |
| U5 | P3 | 加入同轮自动目标修复、无目标跳过与一致费用 / Receipt。 | 完成 |
| U6 | P3 | 加入固定队序的自然 Team cost 虚拟预留。 | 完成 |
| U7 | P4 | 接入现有真实 MapRun 卡牌目标并提供零候选安全行为。 | 完成 |
| U8 | P5 | 完成真实多角色战斗样例、Save / Resume 与 Runtime 验收。 | 完成 |
| U9 | P5 | 完成 Skip / Receipt 的 Workspace 投影与 UI 验收。 | 等 Task 0291 U4 共享接口稳定 |

## 验收清单

- [x] P1 单位 Action 按显式 preference / 稳定顺序自动有合法目标；玩家可改选且手动选择持续有效。
- [x] P2 用途显式、最多 2 倍；权重仅影响抽卡资格池内的概率，不换掉 Hand[0]。
- [x] P3 顺序结算时自动目标按当前行动策略重选；无合法对象时跳过并免 Action resource cost；手动目标保留 C4 语义。
- [x] P3 自然 Hand[0] 的 Team cost 按队序虚拟预留；资源只在 Commit 扣除，Preview 与 Commit 校验一致。
- [x] P4 目标使用真实 MapRunCardRef；同 ID 多实例不混淆；零卡牌候选不阻塞回合，也不隐式重抽 / 换牌。
- [x] 同回合重复 Preview、目标干预、Save / Resume 均保持已准备 Hand / RNG / 费用；成功 Commit 后下一回合才重决策。
- [x] 真实 Map-only Datapack / Runtime 样例覆盖白子、芹香、三敌、首轮零干预击杀后重选、第二轮换牌 / 手动目标 / Save / Resume。
- [ ] Workspace Hover / Focus / Skip reason 投影与真实样例 UI 操作验收；U9 等 Task 0291 U4 共享接口稳定后继续。
- [x] 不加载旧 Operation Planner、不建立第二 Owner、不依赖 UI 目标推断；领域测试与文档检查记录在各 Unit Receipt。

## 停止条件

- 源码 / 测试与 Task 事实冲突：回到直接源码和调用方核对，记录冲突后停止受影响 Unit。
- 需要新增超出上述枚举的小型字段、改变 Hand[0] / Wait / Swap / PlayerCommand 费用，或改变 Ability / Item 行为：停止对应 Unit 并说明具体冲突。
- 修改 Task 0291 U4 当前可能使用的 Workspace / Runtime View / Controller 文件：只暂停该接线 Unit，继续不冲突的领域施工。
- Flow 卡牌目标需要其尚未完成的领域身份 / 生命周期合同：只暂停 Flow 子范围；MapRun 真实卡牌不因此等待。
- 需要编辑生成 Schema 文件、影响禁改路径或超出 Unit Allowed Files：停止该 Unit，先找可维护源或收窄范围。
- 任何 Unit 的关键验证无法执行或结果无法解释：写 Receipt 记录并暂停依赖项，不以推断通过替代。

## 当前进展（2026-10-19）

- 三路只读核查曾覆盖 Runtime 实现、任务边界和策略方案；本轮按用户已明确的 P0 规则修订产品合同，直接复核了 Hand resolver、Action Preview、MapRun Commit、目标命令、MapRun 卡牌和 Task 0291 / 0298 依赖。
- Task 0291 U4 当前仍标为进行中，但其计划白名单是 Workspace / View / Controller / UI；本 Task 的前置领域切片可避免修改这些接口。
- Task 0298 的 MapRun 卡牌身份、候选、命令、存档与 Commit 已有可复用实现；Flow 独立牌未完成，未纳入 P4 MapRun 卡范围。
- 当前工作树已有 map relation UI 文件改动，保持原样，不纳入本 Task 的代码 Unit。
- U6 已完成：固定队序抽自然 Hand[0] 时使用本地虚拟 Team 余额；自然组合可直接 Commit，替代手牌仍按起始余额抽取并允许玩家干预后触发正常费用校验；虚拟预留不写资源或额外存档状态。
- U7 正在复用 MapRun 真实卡牌目录实现稳定首目标；零候选 Action 将写明 noLegalTarget 并走无 Action resource / card effect 的安全 Commit / Receipt 分支。Workspace / UI Skip 投影继续等待 Task 0291 U4 稳定后由 U9 处理。
- U7 已完成：真实多候选卡牌默认取目录首个合法实例，零候选写 `noLegalTarget` 并可无费用 / Effect 阻塞地提交；实际目标经过既有 card effect、Commit 与可恢复 Receipt。领域实现未修改 Task 0291 U4 的 View / UI 文件。
- U8 已完成：Map-only Datapack 新增白子 / 芹香对机器人 A / B / C 的正式自主战斗演练；真实 Runtime 第一轮零干预 Commit 后击败 A、后手改攻 B；第二轮验证新 Hand、掩护 Swap、自然目标恢复、手动改攻 C 与 Save / Resume 提交确定性。Registry / Runtime / Save / Resume 140 项相关测试与类型检查通过。
- U9 暂停：Task 0291 仍标记 U4 Workspace 施工中，其写集与 Skip Runtime / Workspace 投影直接重叠。已保存 U9 精确边界和恢复条件；当前 UI 定向回归 3 项仍期待旧手动目标门槛，待共享接口稳定后由 U9 更新并完成真实 UI 样例验收。

## GALHCG 影响闭环

- 已用 graph_project 核对 ACProgram 项目身份；对 Task-0299 的 path 搜索定位当前文件，对宽泛 Gameplay B 搜索因结果过多收窄到具体 Task。
- 本 Task 与 Unit 修改只读复核直接影响文件；不改项目图、不刷新图、不写 Evidence / freshness。维护图谱不在本 Task 授权内。

## 相关路由

- docs/ai/task-read-set-routing.md、docs/ai/PROJECT-CONSTITUTION.md、docs/docs-829/05-conventions/testing.md
- docs/ai/context-packs/production.md、docs/ai/context-packs/character.md、docs/ai/context-packs/datapack-schema.md
- docs/plan-work/archive/task-0290-gameplay-b-action-draw-hand-swap-commit.md
- docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md
- docs/plan-work/archive/task-0298-gameplay-b-relations-hover-and-target-interaction.md
