# Task 0320：Gameplay B AG-1 与 E2–E5 后续能力统一闭环

状态：active（P1 AG-1、P2 E2、P3 E3、U16–U30 与 U14g 试玩台操作参数已实现；U31 Status holder 实际受伤回馈合同已冻结、实现待完成；U07/U14/U17–U30 屏幕验收按限制交付需求单，不记为人工通过；E4 Shield/damage、Encounter/MapRun Status 生命周期与操作、Revive、Modifier、healing/damage/到期 Trigger、单次受击保护，以及 E5 MapRun Fact Edge 门控和单体击杀回馈均已通过专项自动化）— E4 其他 Modifier/Trigger 与待裁定/实施的 E5/P6 尾项仍在本 Task 跟踪；E1 U18 明确排除。AG-1 作者字段、纯排序器、Run/Encounter 快照、来源适配器、统一执行队列、历史独立重算与执行序列呈现均已完成。

## 目标

把 E1 U18 以外的 Gameplay B 未完成范围集中到一个可跟踪、可统一结项的 Task：按已批准合同实施 AG-1 统一调度／支付／终局，再冻结并完成 Draft 0312 中 E2–E5 的剩余能力。实现、作者样例、回执／存档验证和文档收尾均在本 Task 完成，不把已记录的尾项继续散落为多个独立后续入口。

Task 0316 的确定性集合／Value／单语句 repeat、Task 0317 的静态 Tag／候选池、Task 0318 的 Encounter-local burn／regen，以及 Task 0319 的 Prepared Tag 数量条件与顺序连携均视为已完成基线。本 Task 不重做这些切片。

## 设计边界

- 本 Task 包含：Draft 0312 中尚未交付且不属于 E1 U18 的 AG-1 批准合同、§6–8 及 §3 行为样例中的 E2–E5 能力，具体清单见“待完成能力”。
- 明确排除：Task 0312 的 E1 U18 实屏／浏览器验收。该项已按用户指示豁免；豁免不等于产品验收通过，也不在本 Task 重开。
- AG-1 已获批准的调度、费用、skip、终局与存档合同按 Draft 0312 §13 实施，不在本 Task 重裁；此前 E1 阶段结项状态与 U18 豁免不因此改写。
- 明确排除：已完成 Task 0316–0319 的重复实施、已移除的 Map Action 旧效果数组、旧 Operation CardPool、以及独立 Shop Offer `effects`。
- 技术边界：继续使用 MapRun 唯一 Owner 与 detached 整轮计划、Receipt 重放、Save/Resume 和 Schema/Registry 路径。扩展必须有界、可重放、原子安装；不得接入 AC Tick／EventBus 回调写 Run、任意表达式求值或无界递归。
- Draft 0312 是待裁定能力与示例来源；真正施工前，P0 需为开放能力冻结作者合同、计算时点、Owner、版本与可观察结果。不能把提案描述误写成已批准合同。

## 当前事实与代码落点

| 已核实事实 | 源码／测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 确定性 TargetSet damage/heal、受限整数 Value、每条 damage/heal 的 repeat 已实现 | [[docs/plan-work/task-0316-gameplay-b-effect-collections-and-values]] | 任意语句体 `forTargets` 与随机抽选是新增合同，不能把 repeat 当成循环已交付 |
| 静态 Action Tag、Map-local candidatePools 和候选来源合并已实现 | [[docs/plan-work/task-0317-gameplay-b-static-tags-and-candidate-pools]] | 动态 Tag、成长／临时来源等需要定义快照与恢复语义 |
| `burn`／`regen` 已在 Encounter roundEnd 结算并贯通 Receipt／存档 | [[docs/plan-work/task-0318-gameplay-b-encounter-statuses]] | U18 已闭环 Shield/damage，U16/U19/U20/U21/U22/U30 已完成 Status 清除、层数消费、类别净化、Revive、damageReduction 与 Party MapRun 生命周期；U23/U24/U26/U27 已覆盖窄 Trigger/保护片；其他 Modifier 与 Trigger 仍待范围裁定 |
| `preparedTagCount` 已从本轮 Party Prepared 快照计算并由 Receipt 重算 | [[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]] | 该首片不包含相对 CardRef、Modifier、排序变更或 Adapter |
| 当前阶段状态和设计缺口集中记录在 Draft 0312 | [[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]] | 本 Task 将其 E2–E5 未完成项作为统一范围，E1 U18 除外 |
| AG-1 统一来源序列与逐来源支付已由 P1 实施，Restore 从 `schedulerStartSnapshot` 重跑实际 planner | U05/U05b/U06 Receipt、`map-run-service.ts`、`tests/engine/gameplay-b-map-ag1-restore.test.ts` | E2 余额条件以 P1 来源开始可见 Owner 工作余额为基础；不重裁 AG-1 合同 |

## 待完成能力

以下能力在 P0 逐项冻结最小可观察合同，并在本 Task 内完成；同一主题如经核对已由当前源码交付，须记录证据并从实施清单移除，不能重复建设。

### E2：集合与 Value 后续

- **E2R 随机目标集合**：有限、无放回抽选；Owner 持有独立于 Hand RNG 的算法／种子／游标；Preview 克隆随机状态，只有成功 Commit 安装游标；Receipt 与 Save/Resume 可独立重放。
- **任意受限语句体 `forTargets`**：对一次解析并固定的有限集合执行有序语句体；冻结目标顺序、嵌套／展开预算、错误原子性和 Receipt 访问记录。与现有单条 damage/heal 的 per-target repeat 明确区分。
- **资源余额 Value／条件**：覆盖 Actor 与 Team 资源读数及其受限运算；冻结各来源可见余额时点、费用预检和资源效果兑现顺序，避免资源读取与可付性形成循环依赖。
- **显式额外目标选择（P2纳入）**：Draft §3「掩护后鼓舞」需要主目标外另选一名队友作为资源受用者；确定性 TargetSet 不是玩家指定单个账户。P2仅纳入每来源一个、非 CardRef 的领域单位目标与完整重验；不扩成任意多目标。
- **跨 Encounter／Node 的 MapRun Facts（P2纳入）**：简单有界 Counter/Flag 属于单次 MapRun，跨 Encounter/Node 保留并保存恢复；新 Run 初始化、Run 清除时清理。不得混用长期 AC 资源或 Story 状态。Fact 驱动 Edge 解锁、跨 Map Pool 和临时 Item 仍归 P5/E5。

### E3：动态候选来源

- 当前 Task 纳入 U15 的 MapRun Counter/Flag 门控静态 Map-local Pool：Encounter 入场冻结 Fact 输入，同 Encounter 每轮 Hand、资格过滤和 Restore 重放共用；保持 Task 0317 合并、权重与抽取行为。
- Prepared-source filter、成长/临时来源、动态 Tag 与跨 Map Pool 按 U15 明确延期或不纳入，并在 P7 记录依赖；不得将这些能力描述为 U15 已实现。

### E4：状态、Shield、修正与有限触发

- 独立 Shield 账本和 damage 结算顺序；保护／减伤 Modifier 的明确计算点。
- Status 清除、层数消费、类别过滤、复苏资格、Encounter/MapRun 生命周期与活动状态清理。
- `damageApplied`、`healApplied`、holder 受损、到期等闭合触发时机；受限事件队列与单 Commit 次数预算。U31 仅纳入 holder 实际受伤后的资源回馈，不把它扩成反击 Damage 或通用 Status 监听器。
- 所有 HP、Shield、Status、资源、触发游标和 Receipt 变化处于同一 detached 原子计划；不通过 AC EventBus 或 Tick 回调写入 MapRun。

### E5：卡牌组合与外部 Adapter

- U17、U25、U28、U29 已交付窄 CardRef Modifier、实际结果门槛、Fact Edge 和单体击杀首片；不把这些首片描述成通用 Modifier/Trigger。相对位置 previous/next 需证明当轮存在真实受用来源，否则应裁定延期；U17 已支持真实后序 Prepared CardRef 的窄交互。
- 战术排位／逻辑邻接／区域、有限链式目标选择仍缺领域拓扑与顺序合同；不得以 UI 坐标替代领域位置。可拆成明确最小主题，链传播另行限定。
- AG-1 执行顺序交换、复制／生成／替换／移除卡牌逐项裁定；现有 Prepared swap 不改变 executionSequence。卡牌生命周期若纳入，必须定义实例身份、容器、费用和预算并拒绝无界增殖。
- Encounter 临时 Item 必须与 AC Consumable 持久库存分开，并先冻结获得、持有、使用、消费与 Receipt 语义。跨 Map Pool 依 U15 已延期，不与 U28 同 Map Fact-gated Edge 混为一项。
- Cultivate／Gear／Skill 成长快照、版本化 MapRun Result Adapter 无现行运行合同；须分别冻结输入白名单/算法版本/快照格式和跨 Owner 结果事务/幂等键/长期奖励边界，不由普通 Effect Program 直接写 AC 资源或 Story。

### AG-1：已批准但尚未实施的统一调度

- 按 Draft 0312 §13 将实际来源按批准的敏捷／次级键和稳定尾键形成统一顺序；覆盖 Party Action、PlayerCommand、Ability、Item 与 Enemy 来源，不改变 Hand 的候选资格与抽取概率。
- 保持批准的准备期折扣、来源开始时的费用／库存支付、同源完整执行、失败优先和终局后跳过规则；Party 整轮前置费用不足仍全轮拒绝，Enemy 单源不足按合同 skip。
- Receipt 与 Save/Resume 保存并独立重算完整执行来源序列、排序输入快照、skip／terminal 原因和已提交的费用、资源、HP 结果；保留旧分组作为投影，不再用分组顺序伪装执行顺序。
- 统一队列是 E2 资源条件与 E5 顺序效果的依赖；同一来源不能用自身奖励付费，后续来源只能读取按批准队列已兑现的结果。

## 施工切片

### P0：范围合并与 AG-1 合同准入（completed，2026-10-22）

- 复核 Task 0316–0319 与 Draft 0312 §3、§6–8、§13，确认实现基线和未完成主题，不重复建设已完成切片。
- 按用户“除去 E1 U18”的要求，把已批准但未实施的 AG-1 纳入 Task 0320；保留其既有合同，不将 U18 豁免写为验收通过。
- 通过只读源码核对确认：AG-1 统一来源序列目前不存在；随机 TargetSet、任意语句体 `forTargets`、资源余额读取、动态候选、Shield／净化／反应后片和 E5 Adapter 仍未交付。
- E2–E5 的开放作者合同在对应 P2–P6 开工前，作为该阶段首项完成合同冻结、当前实现复核与范围裁定；不在本 P0 预先假定尚未批准的玩法。

### P1：AG-1 统一调度、支付与终局

- 将当前分组式 MapRun 结算切换为 Draft 0312 §13 已批准的统一来源顺序与逐来源费用／效果处理。
- Receipt、Save/Resume 与恢复校验独立重算实际执行序列；保持 MapRun Owner 与双 Owner Item 安装原子性。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U01-ag1-author-contract]]：作者合同与 Registry/Schema 边界已完成；定义 Map 执行合同选择及敏捷输入。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U02-ag1-pure-source-order]]：纯排序器已完成，只提供独立 helper 与行为测试，不接触 MapRun。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U03-ag1-runtime-agility-snapshots]]：Run/Encounter 冻结 Actor 补足输入及 Save/Resume 校验已完成；仅改初始化与 Restore 路径，没有碰唯一 Owner 计划器。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U04-ag1-source-adapter]]：纯适配器已完成，从实际 Prepared／Actorless 选择与当前 Card Catalog 生成唯一可排序来源；校验敏捷快照与当前 Map 作者值相符，不改 Owner。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U05-ag1-unified-execution-queue]]：已完成；接通唯一 MapRun Owner 的来源顺序、逐来源费用／效果、skip／终局与实际执行序列 Receipt。定向新增测试11/11、MapRun49/49、Item transaction7/7、类型与差异检查通过。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U05b-ag1-replay-input-evidence]]：已完成；保存提交开始 HP／资源／locals／Status／Hands/RNG／目标输入、完整 U02 排序键与终局检查点，供 U06 独立重跑关闭 Encounter 的历史计划；AG-1 commit14/14、MapRun49/49、Item transaction7/7、类型与全工作树差异检查通过。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U06-ag1-restore-replay]]：已完成；从 schedulerStartSnapshot 重建起点并重跑真实 AG-1 planner，验证 executionSequence、旧分组投影和 Program／Status Receipt。Restore 篡改测试29/29；与 U07、MapRun／Effect Save/Resume 合计定向测试100/100，类型、架构、文档和差异检查通过。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U07-ag1-execution-sequence-readmodel-ui]]：实现与自动化验证已完成；将 Owner 实际执行序列投影到 Preview 与 Recent Commit ReadModel/UI，E1 保留旧分组显示。按用户指示跳过宽屏桌面浏览器屏幕验收；需求单见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U07-screen-acceptance-report]]，未声称人工验收通过。

### P2：E2 随机、循环、资源 Value、额外目标与 MapRun Facts

- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U08-e2-contract-freeze]]：已完成；冻结 E2R 独立 Effect RNG、可直接实现的 AST 形状、AG-1 准入、有限嵌套 `forTargets`、来源开始资源读数、每来源一个额外单位目标、MapRun-local Facts 与 P5 Edge/临时 Item 边界。随机 RNG 状态后续进入 scheduler 时须升 v3。AST 补充后的 `npm run check:docs` 通过（errors: 0），`git --no-pager diff --check` 通过。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U09a-maprun-fact-author-contract]]：已完成；增加 MapRun Facts Counter/Flag 作者定义、Registry 校验与生成 Schema，不接运行时状态或 Effect AST。Registry 175/175、Schema 同步15/15，类型和差异检查通过。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U09b-maprun-fact-owner-save-resume]]：已完成；Facts 在 MapRun 根持有，跨 Activity/Encounter/Node 保留并经 Save/Resume 校验。生命周期与恢复测试59/59，类型及差异检查通过。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U09c-maprun-facts-ag1-replay]]：已完成；将 Facts 纳入 AG-1 scheduler v2 起点快照和计划 Receipt，Restore 重建历史 Run 并重算；篡改和 scheduler v1 拒绝。Commit/Restore 测试48/48、类型及差异检查通过。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10a-e2-effect-ast-and-context]]：已完成；补齐随机 TargetSet/有限循环/资源余额读取/MapRun Facts 的闭合作者类型和严格语法，输出 AG-1 专属构造标记。`gameplay-b-effect-syntax` 10/10、类型及差异检查通过；不含 Context、Normalizer、Schema、Planner 或 UI。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10a-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10b-e2-effect-context-and-registry]]：已完成；新 AST 按 AG-1 与具体来源绑定；Party Actor/Team 资源集合匹配 Owner 的 Map 初值和 Action cost 物化，Enemy 资源匹配当前 Encounter 初值；Fact 命名域及 completion 限制已覆盖。Registry 定向测试19/19，类型检查、文档和差异检查结果见 Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10b-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10c-e2-normalizer-loop-metadata]]：已完成；Normalizer 递归保留循环 body、嵌套分支与 MapRun Fact 写入叶节点来源元数据；摘要对暂无表达合同的新语句显式报 unsupported，不错误投影为 Flag。Normalizer/摘要投影测试16/16，类型、文档、差异检查通过。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10c-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10d-e2-authoring-schema]]：已完成；生成 Schema 与 E2 Effect AST/MapRun Facts 同步，更新随机 TargetSet、资源余额、Fact 条件/写入和循环递归结构断言；Schema 同步测试15/15，类型、文档、差异检查通过。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10d-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U11-additional-target-author-contract]]：已完成；实现 U08 冻结的每来源一个 `additionalTarget` 作者字段与 AG-1/单位主目标/Party 来源 Registry Context 限制；不含运行时目标选择或 Schema。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U11-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U11b-additional-target-schema-sync]]：已完成；将已实现字段生成至独立 Datapack Editor Schema 并锁定字段可选性和值域；不含任何运行时目标选择。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U11b-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U12a-e2-deterministic-loop-planner]]：已完成；纯 Planner 实现确定性 `forTargets`、loopTarget 词法身份与 Loop Trace，并显式拒绝随机 TargetSet；不含 Owner/Receipt、MapRun Facts、资源余额或额外目标运行态。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U12a-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U12b-e2-planner-resource-and-fact-semantics]]：已完成；纯 Planner 实现来源起点余额读取、MapRun Counter/Flag 有序读取/写入及 detached Trace；不接 Owner、AG-1 Receipt 或 Restore。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U12b-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U12c-e2-owner-facts-and-balance-replay]]：已完成；把 U12b Planner 结果接入 AG-1 每来源费用后快照、MapRun 根 Facts 安装与已有 scheduler v2 Receipt/Restore 重算。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U12c-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U13a-e2-effect-rng-and-planner-random-targets]]：已完成；实现冻结算法与纯 Planner 随机 TargetSet/forTargets 的显式游标消费和 Trace；不接 MapRun Owner、scheduler v3、Receipt 或 Save/Restore。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U13a-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U13b-e2-owner-effect-rng-scheduler-v3]]：已完成；Effect RNG 从新 Encounter 初始 Hand seed 派生、独立持有并跨 Round 延续，AG-1 来源共用连续游标；成功 Commit 安装 after-state，scheduler v3 Restore 全量重放并拒绝旧版/篡改。Commit 19/19、Restore 48/48、类型、文档及差异检查通过。独立 `validateMapEffectCommitReceipt` 只走 E1/legacy 分支，不另作 AG-1 随机回放单元。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U13b-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14-e2-additional-target-runtime]]：已完成；Owner Draft/API、作者资源写账户与 Schema、Planner/AG-1 Owner Receipt replay、Workspace secondary target-picker 均闭环。scheduler v3 升至 v4，受影响测试 Map `resumeVersion` 升至5。自动化共433/433通过；屏幕验收无法触发新按钮，需求单：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14-screen-acceptance-report]]。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U14-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14e-gameplay-b-console-map-launch]]：已完成；本地试玩台新增严格三段 `startMap <mapId>`，仅启动当前加载 Map，要求夏莱办公室且拒绝覆盖进行中的 MapRun。Parser/UI 定向测试10/10、类型检查与差异检查通过。它不替代 U14 additionalTarget 示例内容；当前实屏验收限制见 U14-screen-acceptance-report 与 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U14e-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14g-gameplay-b-console-map-operations]]：已完成白名单参数与有限关卡操作：`--move-to`、`--ability`、Party/Enemy target 和 `--commit-rounds 1–20`；各步沿现有 GameCommands 与 Owner ReadModel/Commit 校验执行，结果只在当前浏览器内存。Parser + U22 演练图集成测试16/16通过；人工屏幕验收仍按报告执行。回执：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U14g-receipt]]。
- 实现并验证 E2R 随机 TargetSet、有限嵌套语句体 `forTargets`、资源余额 Value／条件、一个显式额外单位目标与简单 MapRun-local Counter/Flag。余额条件依据 P1 队列中来源开始时的可见 Owner 工作余额求值。
- 保持 Preview 纯读；失败、重试或恢复不能多消耗随机游标或留下部分账本变化。

### P3：E3 动态候选

- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U15-e3-maprun-fact-gated-static-pools]]：已完成；作者 gate/Registry/Schema 与运行时候选快照、Hand/Preview/CardRef/Status资格、scheduler v5 Receipt/Restore 和正式示例闭环。Task Owner 定向复核325/325，类型、架构、文档1256篇/0 errors与差异检查通过。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U15-receipt]]。
- Prepared-source filter、成长／临时来源、动态 Tag 与跨 Map Pool 按 U15 裁定延期/不纳入并记录依赖；E3 结项不宣称这些能力已交付。

### P4：E4 状态与反应后片

- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U16-e4-status-cleanse-by-id]]：已完成；新增 AG-1 按已解析 source/primary 与精确 Map-local Status ID 清除目标所有活动实例，Status Receipt v2 经 scheduler v5 起点重放，E1/legacy v1 保持。正式 Status 示例升至 AG-1 `resumeVersion: 2`，宽屏走查已覆盖施加、清除和空匹配 no-op。U16 只完成 E4 精确 ID 清除首片；Shield、部分层数/类别净化、Revive、Modifier、Trigger 与跨 Encounter Status 仍未完成。
- U16、U19、U20、U21 已完成 Status 精确清除、部分层数消费、类别全清与 Revive；U30 已完成 Party `lifetime: 'mapRun'` Status 的 root Owner、跨 Encounter/Shop 保存恢复与 roundEnd 时钟。其他 Modifier/Trigger 仍需逐项冻结合同；不从现有 Status 原语推定行为。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U18-e4-shield-damage-pipeline-contract]]：U18a1–e 已完成；AG-1 Shield Map 使用 Encounter-local ledger、scheduler v6 与 Shield Receipt v1，旧 v5 / E1 路径保持。正式 Map、Save/Restore 和只读 Workspace 展示均已接通。回执：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U18-receipt]]；浏览器人工验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U18-screen-acceptance-report]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U19-e4-status-stack-consumption-contract]]：已完成按精确 Status ID 消费至多 N 层；按最早到期实例优先，层数不足尽量消费，Status Receipt v3 与 scheduler/Program Receipt 各自独立。U19a–e 已实现；定向测试260/260、Schema sync 15/15、类型/架构/文档/差异检查通过。人工屏幕验收未执行，见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U19-screen-acceptance-report]]；回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U19-receipt]]。类别净化、Revive、Trigger 与跨 Encounter Status 不包含在 U19。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U20-e4-status-category-cleanse-contract]]：已完成 `harmful`/`beneficial` Map-local Status 分类和 `statusRemoveCategory` 全量净化；Status Receipt v4 独立于 scheduler/Program Receipt。U20a–e 定向 10 文件 269/269；Schema、类型、架构、文档与差异检查通过。人工屏幕验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U20-screen-acceptance-report]]，详细回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U20-receipt]]。Revive、Trigger 与跨 Encounter Status 不包含在 U20。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U21-e4-revive-contract]]：已完成 AG-1 `revive` 与显式 `includeDefeated` Party 目标：复苏专用 Trace、HP 上限/no-op、倒地目标重验、后序来源恢复资格、Owner Restore 篡改拒绝、Workspace 目标与 Flow、正式演练 Map 均已接通。U21a–e 的 11 个定向测试文件 455/455 通过；人工屏幕验收未执行，见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U21-screen-acceptance-report]]；回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U21-receipt]]。Trigger、跨 Encounter Status 与 Modifier 不包含在 U21。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U22-e4-round-limited-damage-reduction-contract]]：已完成 E4 回合限时固定伤害减免 Status：Map 定义使用 `kind: damageReduction` / `damageReductionPerStack`，按每次 hit 在 Shield 前减免；活跃状态 roundEnd 只推进 duration；Status Receipt v5 独立于 scheduler v5/v6 与 Program v1/v2。新正式 Map 覆盖 3→减2→Shield吸收1，后续轮生效并按期到期；Restore 重放拒绝减免 Trace 篡改。定向 11 个文件 462/462 通过，Schema sync 15/15、类型/架构及文档（1278 篇/0 errors）通过；详细回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U22-receipt]]。人工屏幕验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U22-screen-acceptance-report]]，作者样例见 [[docs/examples/gameplay-b-damage-reduction]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U23-e4-heal-applied-resource-trigger-contract]]：已完成 AG-1 实际 primary Heal delta>0 的同来源受治回馈，按 Heal hit × Trigger 声明顺序派发有限队列；资源只在父来源结算后对后序来源可见，单 Commit 最多 32 次，无递归或跨 Action/Status 订阅。独立 Trigger Receipt v1，现有 Scheduler/Program/Status/Shield 版本保持；Planner/Owner/Restore/Flow/正式 Map 已覆盖。14 个定向文件 457/457，类型、架构、文档及差异检查通过。屏幕验收按用户限制交付需求单且仍待人工执行；详见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U23-receipt]] 与 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U23-screen-acceptance-report]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U24-e4-damage-applied-resource-trigger-contract]]：已完成第二种闭合 Trigger event；仅实际减少 primary HP 的 AG-1 Damage 派发 `damageApplied`，Shield 全吸收、DamageReduction/HP clamp 导致无实际 HP delta 时不触发。与 `healApplied` 共用 FIFO 与 32 次 Commit 预算、同一 Receipt v1 和 Restore 重算；正式 Enemy 受击样例证明后续 Party 来源可读到资源。15 文件 462/462 合并回归、类型、架构、文档及差异检查通过。屏幕验收需求单待人工执行，详见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U24-receipt]] 和 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U24-screen-acceptance-report]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U26-e4-status-natural-expiry-reward-contract]]：已实现 Status `onExpire` holder Actor 资源回馈；自然 roundEnd 最后一次 tick 后按 `statusTrace` 顺序结算，排在所有 Action Trigger 后并共用 32 次 Commit 预算。独立 Trigger Receipt v2、Save/Restore 重算、只读 ReadModel/Flow 与可进入 regen 样例已接通；移除/消费/净化/刷新/teardown/终局前跳过 tick 均不触发。自动化覆盖两个 Actor 阵营、倒地 holder、damageReduction、预算边界与原子拒绝。屏幕验收需求单待人工执行，详见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U26-receipt]] 和 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U26-screen-acceptance-report]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U27-e4-one-time-damage-protection-contract]]：已完成 AG-1 单次受击保护。新 `damageProtection` Status 每层拦截一个正向 hit；顺序为 outgoing CardRef Modifier → 保护 → damageReduction → Shield → HP。拦截 hit 不改 HP/Shield、不触发 `damageApplied`，独立 Trace 与 Status Receipt v6 可从 scheduler 起点重算并拒绝篡改；已有 scheduler/Program/Shield/Action Trigger 版本保持。正式两段攻击样例与屏幕需求单已交付，人工屏幕验收未标记通过；11 个定向测试文件 280/280、类型、架构、文档与差异检查通过，回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U27-receipt]]。
- 验证伤害、治疗、护盾、状态、费用、结果条件和触发游标以一次提交原子安装。

### P5：E5 卡牌互动

- 实现新冻结且实际可观察的 CardRef／Prepared 组合、效果修正与结果条件；U28 MapRun Fact Edge 已完成，不重复建设。跨 Map Pool 依 U15 延期；位置/邻接/区域/链目标、Prepared swap 与复制/生成/替换/移除仍须各自裁定后再决定纳入或明确后续路由。
- 对准备、费用、来源执行顺序和已经结算结果分别定义边界，不回溯改写 Receipt 历史。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U17-e5-cardref-effect-modifier-contract]]：Task Owner 已冻结首片合同；只支持 Party source 给另一名 Party 后序 Prepared Action 的唯一顶层 damage/heal amount 加一个 signed safe-integer delta。U17a1/2、Planner、AG-1 Owner/Receipt/Restore、ReadModel、UI候选/预览和正式示例均已完成；223/223定向测试、类型与架构检查通过。人工屏幕验收未执行，步骤与原因见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U17-screen-acceptance-report]]。此首片不代表 E5 整体完成。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U25-e5-actual-amount-trigger-threshold-contract]]：已完成实际 HP 变化阈值首片；`minimumActualAmount` 为可选正安全整数，依据 HP cap/减伤/Shield 后的真实结果过滤 Handler，未命中不入队、无 Trace、不耗预算，命中仍复用 FIFO 与 Trigger Receipt v1。定向 16 文件 466/466、Schema/类型/架构/文档/差异检查通过；正式样例覆盖 Shield 下 1 点未命中、2 点命中、后续来源读到奖励与改门槛后 Restore 拒绝。屏幕验收单仍待人工执行：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U25-screen-acceptance-report]]；回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U25-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-e5-maprun-fact-edge-gates]]：已完成；Edge 可引用同 Map Counter/Flag 单项门控，AG-1 move 与 Workspace 投影共享当前 MapRun Facts 判定，Fact gate 不改 Receipt/Save 结构。定向 4 文件 241/241，Schema、类型、架构和文档检查通过；屏幕需求单与回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-screen-acceptance-report]]、[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U28-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U29-e5-single-hit-defeat-reward-contract]]：已完成单体击杀回馈；`enemyDefeated` 仅匹配 Party 来源对 Enemy primary 的直接命中使 HP `>0→0`，资源写给来源 Actor。独立 Trigger Receipt v3 同时保存击败目标与奖励领取者，并兼容自然到期 Trace；FIFO/32 次预算、Save/Restore 重算与篡改拒绝已闭环。TargetSet、`forTargets`、Status tick 与已有倒地不触发；11 个定向测试文件 218/218、类型、架构和文档检查通过。正式演练见 [[docs/examples/gameplay-b-enemy-defeated-reward]]，屏幕需求单见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U29-screen-acceptance-report]]，回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U29-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U30-e4-maprun-status-contract]]：已完成 Party MapRun Status 的单一 root Owner、Origin/来源资格校验、跨 Encounter 与 Shop 保留、成功 roundEnd 全局计时、Status Receipt/scheduler v7 和 Restore 重算；新示例验证 Shop gap Save/Resume、状态自然到期、到期后完整伤害、失败与成功 Exit 清理。首提交版本 0 和通用成功 Exit 状态清理已修复。Registry 186/186，新样例 3/3，Runtime integration 8/8，兼容回归 9 文件 206/206，类型检查通过；屏幕验收需求单待人工执行，不记为通过。Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U30-receipt]]。
- [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U31-e4-status-holder-actual-damage-reward]]：合同已冻结、实现待完成；只增加 Status holder 对真实 HP 受损的正向资源回馈，复用 `damageApplied` 结算边界与共享 FIFO/32 次预算，不实现反击 Damage、通用 Status 事件或 EventBus。

### P6：成长与结果 Adapter

- 当前 admission 只冻结固定 Party 身份，不导入 Cultivate/Gear/Skill 数值；先选定成长来源与白名单、算法/快照版本、缺省值及 Map `resumeVersion` 关系，再决定是否实现。Preview 只消费已安装快照。
- 临时 Item 必须单列局内 MapRun Owner 与 AC 库存事务，不借用普通 Consumable Inventory；需要先有正式来源与演练合同。
- Result Adapter 当前无执行 API；如纳入，限定由 GameInstance 协调 Result Request，验证 MapRun 结果、Owner `canInstall` 与 `(runId, requestId)` 幂等键，所有 Owner 预检后无回调连续安装，再发布结果。永久奖励、Story 写入与清档/重入策略必须冻结；Effect Program 不直写。

### P7：统一收尾

- 补齐正式 DataPack、作者示例、机制文档和 0312 计划路由；逐项同步 U15 中延期/不纳入的 E3 范围裁定；验证所有本 Task 纳入能力及 E1–E4 已交付基线的兼容性。
- 逐项对照“待完成能力”，提供实现或明确范围裁定证据；本 Task 结束后不留下没有归属的 E2–E5 旧路由。

## 测试与验收

- [x] P0 已统一范围并确认 AG-1 已批准合同的实施准入；E2–E5 各开放合同须在其对应阶段开工前冻结。
- [x] AG-1 按已批准全序执行并逐来源处理费用、效果、skip 与终局；Receipt／Save/Resume 可独立重算顺序和结果，原子安装与重复请求幂等。P1/U05–U06 与保存恢复定向测试已通过。
- [x] U07 屏幕验收按用户指示跳过；逐项需求单已交付，明确记录未执行且不代表人工验收通过，见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U07-screen-acceptance-report]]。
- [x] E2 随机 TargetSet、有限循环、资源余额 Value/条件、额外目标与 MapRun Facts 已按 U08–U14 闭环，并由 Receipt/Save/Restore 重算；Preview、失败提交与重试保持一致。屏幕验收受限项已交需求单。
- [x] E3 Fact-gated 静态候选快照、权重合并、过滤、Hand 抽取与恢复由 U15 闭环；动态 Tag、成长／临时来源与跨 Map Pool 明确延后。
- [ ] E4 已完成 Shield/damage pipeline、Status 清除/消费/类别净化、Revive、damageReduction/damageProtection、healApplied/damageApplied、自然到期资源 Trigger 与 Party MapRun Status 跨 Encounter 生命周期；仍需裁定其他 Modifier/Trigger。预算或任一 Owner 安装失败时无部分状态变化，Receipt／存档篡改会被拒绝。
- [ ] E5 相对 CardRef、Modifier、结果条件、战术位置、临时 Item、成长快照和 Result Adapter 均有正式样例覆盖，或按 P0 形成明确不纳入裁定并同步原 Draft。
- [ ] 生成 Schema 与作者合同同步；定向行为测试、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git --no-pager diff --check` 通过。
- [ ] 更新 `docs/plan-work/00-index.md`、Draft 0312、受影响的作者合同／机制页和 Task 0316–0319 的剩余范围路由。
- [ ] 收尾时对直接影响范围完成一次 GALHCG 只读健康核对并记录分页／未完成项；没有单独授权时不编辑图、不刷新或写 freshness。

## 当前核验（2026-10-22）

- P0 与 P1 AG-1 Runtime／Restore／ReadModel/UI 已完成。U06 Restore 篡改拒绝29/29；U06/U07 联合定向测试100/100；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（errors: 0）与 `git --no-pager diff --check` 均通过。U08 E2 合同冻结的文档检查 errors 0、差异检查通过。U07 屏幕验收按用户指示跳过；需求单已交付，不计作人工验收通过。
- 已核对 Task 0316、0317、0318、0319 的结项记录及 Draft 0312 §3、§6–8、§13。AG-1 合同已获批准并按用户最新要求纳入；E2–E5 开放合同在各自施工阶段前冻结。
- U01 实际字段为 `executionContractId`、Action `agility:{base,max}`、Map `partyAgility:[{characterId,agility}]`、Enemy numeric `agility`；Schema 已由生成器同步，验证与边界见 U01 Receipt。
- U01–U06 Receipt 中的实现与测试均已完成；U05/U05b 与 U06/U07 联合验证摘要见本 Task 上文及对应 Receipt。
- P2 MapRun Facts 实现与回放：U09a Registry 175/175、Schema 同步15/15；U09b MapRun/Save-Resume 51+8=59/59；U09c AG-1 Commit/Restore 14+34=48/48；`npx tsc --noEmit` 与 `git --no-pager diff --check` 通过。U08 AST 合同补充后 `npm run check:docs` 通过，扫描1222篇、errors: 0。
- U10a E2 AST/严格语法：定向语法测试10/10，`npx tsc --noEmit` 和差异检查通过。U08 补充了资源读取账户/Owner 物化来源与 MapRun Fact 条件上下文；`resourceChange` 额外/循环 Actor 写账户仍待 Planner Runtime Unit。
- U10b Context/Registry：Registry 定向测试19/19，`npx tsc --noEmit` 通过；`npm run check:docs` 扫描1227篇、errors: 0；`git --no-pager diff --check` 通过，仅有共享工作树 CRLF 提示。覆盖 Party cost-only Actor/Team 资源、Enemy 声明边界、嵌套 loopTarget、MapRun Fact 命名域与 completion 限制。
- U10c Normalizer/摘要边界：Normalization 与投影测试8+8=16/16，`npx tsc --noEmit` 通过；`npm run check:docs` 扫描1229篇、errors: 0；`git --no-pager diff --check` 通过，仅有共享工作树 CRLF 提示。循环/MapRun Fact 写入的摘要表现暂明确拒绝，待后续运行与 UI 单元实现。
- U10d 作者 Schema：Schema 同步测试15/15，`npx tsc --noEmit` 通过；`npm run check:docs` 扫描1231篇、errors: 0；`git --no-pager diff --check` 通过，仅有共享工作树 CRLF 提示。`engine-defs.gen.json` 完全由 `npm run gen:schema` 生成。
- 未修改 GALHCG 图、未刷新索引、未写 freshness。

## 延续核验（2026-10-23）

- U11b 作者 Schema 同步完成：`npm run gen:schema`、Schema sync 15/15、`npx tsc --noEmit`、`npm run check:docs`（1237 篇，errors: 0）与 `git --no-pager diff --check` 通过；仅说明作者结构同步，不代表运行时额外目标可选/提交。
- U12a 确定性纯 Planner Loop 完成：定向 Planner 测试21/21、`npx tsc --noEmit`、`npm run check:docs`（1235 篇，errors: 0）和差异检查通过；随机 TargetSet 仍显式拒绝，MapRun Facts/资源余额与 Owner 接线未完成。
- U12b 纯 Planner 余额与 Facts 完成：Planner 测试25/25、`npx tsc --noEmit`、`npm run check:docs`（1239 篇，errors: 0）与差异检查通过；`additionalActor` 因缺少运行时身份绑定仍明确拒绝，AG-1 Owner/Receipt/Restore 由 U12c 接线。
- U12c AG-1 Owner 接线完成：Commit 15/15、Restore 37/37，`npx tsc --noEmit`、文档和差异检查通过；余额在来源 cost 扣除后读取，MapRun Facts 已原子进入根状态、Receipt 并由 scheduler v2 Restore 重算。
- U13a 纯 Effect RNG/Planner 完成：RNG+Planner 测试31/31、类型检查和文档（1243篇，errors: 0）通过；随机 Set/Loop 现在只在纯 Planner 有显式 state 时执行，尚未能通过 MapRun Commit/Save/Restore。
- U13b MapRun Owner 接线完成：AG-1 Commit 19/19、Restore 48/48，`npx tsc --noEmit`、`npm run check:docs`（1245篇，errors: 0）和 `git --no-pager diff --check` 通过；Effect state 从初始 Hand seed 派生但与 Hand RNG 游标分离，跨 Round/来源续用，scheduler v3 从 start snapshot 重放并校验 after-state 与随机 Trace。AG-1 测试 Map `resumeVersion` 升至4，独立 E1 Validator 未改。
- U14 Runtime 闭环完成：Party Prepared/PlayerCommand/Ability/Item 的主次目标按字段合并、保存并重验；跨侧目标身份和来源队列绑定、倒地不 fallback、secondary Actor 账本、scheduler v4 Receipt/Restore 均已接通。
- U14 定向复核：Owner/Draft 59/59、作者/Registry/Schema 232/232、Planner/Projection/AG-1 Commit/Restore 110/110、Workspace DOM 32/32；`npx tsc --noEmit --pretty false`、`npm run check:architecture`、`npm run check:docs`（1251 篇，0 errors）和 `git --no-pager diff --check` 通过。当前正式 Map 无 `additionalTarget` Action，屏幕验收未能验证，已交付需求单。
- U14e 本地试玩台快捷进入命令完成，测试10/10、类型检查与差异检查通过；命令只在开发试玩台执行已加载 Map，并拒绝覆盖进行中的 MapRun。U14f 增加显式 `startMap <mapId> --enter-office` 参数，通过既有 Init 恢复流程从 Init 选择页进入夏莱办公室后启动；自动化验证完成，人工屏幕验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14f-screen-acceptance-report]]。
- U15-A 作者合同完成：`GameplayMapCandidatePoolDef.gate` 仅允许单一 Counter/Flag 条件；作者静态校验以 `allPotentialSources` 遍历所有可能候选，运行时 `runtime` 必须传 Encounter Facts 快照。Registry/Context/Schema、作者说明与示例已接齐；Map Registry+Schema sync 194/194，`npm run gen:schema`、类型、架构、文档与差异检查通过。
- U15-B 运行闭环完成：新 Node/Activity/Encounter 从当时安装的 MapRun Facts 采样 version 1 `candidateSourceSnapshot`，同一 Encounter 后续 Round 保留原快照；Hand、Preview、CardRef、Status、Commit 与 Save/Restore 全部共用。scheduler v4 升至 v5，Map `resumeVersion` 6，Restore 拒绝 scheduler v4 与快照篡改；测试325/325通过，类型/架构/文档1256篇/0 errors/差异检查通过。独立 E1/legacy Validator 未修改；AG-1 恢复从 scheduler 起点重放。详细记录见 U15 Receipt。
- U16 前置版本核验完成：U14 scheduler v4/受影响 Map resumeVersion 5，U15 scheduler v5/门控示例 resumeVersion 6；U16 保持 scheduler v5、AG-1 Status Receipt v2，E1/legacy Status Receipt v1 保持。正式 Status 示例仅从 E1 `resumeVersion: 1` 切换为 AG-1 并升至2；没有升级无关 Map。最终 13 个定向测试文件377/377通过；Schema unchanged、类型/架构/文档1256篇0 errors/差异检查通过。存档测试 fixture 明确维持 E1/v1 路径，单文件复跑7/7。
- U14f 本地试玩台入口参数完成：开发模式 `startMap <mapId> --enter-office` 经正常 Controller Init 恢复流程从选择页进入办公室后启动已加载 Map；未知 Map、活动 Run、固定队伍准入仍由现有规则保护。定向 UI 测试14/14、类型、架构、文档1262篇/0 errors与差异检查通过；人工浏览器验收未执行，步骤见 U14f-screen-acceptance-report。
- U14g 本地试玩台支持受限的关卡操作参数：可在启动后移动到指定节点、配置一次 Ability/目标，并最多自动提交20轮；步骤复用 MapRun Owner 命令与最新预览，越界或未知参数安全拒绝。U22屏幕验收命令已更新为一次执行准备和四轮演练；人工验收仍待用户操作。
- U18-E4 Shield/damage pipeline 合同由 Task Owner 冻结并已完成 U18a1–e：Encounter-local 聚合池；仅 AG-1 `shieldAdd` 和 damage→Shield→HP；heal、hpChange、burn/regen 与 E1 不接 Shield；Shield Map 使用 scheduler v6 + 独立 Shield Receipt v1，非 Shield Map/历史回放保留 v5。定向 9 个文件 237/237、Schema sync 15/15、`npx tsc --noEmit --pretty false`、`npm run check:architecture`、`npm run check:docs`（1265 篇 / 0 errors）与 `git --no-pager diff --check` 通过。屏幕验收步骤已交付，尚无人工验收记录；Task 0320 仍 active。
- U19-E4 Status 部分层数消费合同已冻结并完成 U19a–e：`statusConsume` 只按精确 Map-local Status ID，按到期优先消费指定层数；AG-1 Status Receipt v3 独立于 scheduler v5/v6 与 Program v1/v2；Status 示例 Map `resumeVersion` 2→3。定向 10 个文件 260/260、Schema sync 15/15、`npx tsc --noEmit --pretty false`、`npm run check:architecture`、`npm run check:docs`（1267 篇 / 0 errors）与差异检查通过。屏幕需求单已交付但尚无人工验收记录。
- U20-E4 Status 类别净化合同已冻结并完成 U20a–e：可选 `harmful` / `beneficial` 分类、按类别全量清除、类别 trace、Receipt v4 独立重放与正式示例均已接通；Status 示例 Map `resumeVersion` 3→4。定向 10 个文件 269/269、Schema sync 15/15、类型、架构、文档（1268 篇 / 0 errors）与差异检查通过。屏幕验收未执行，需求单和回执见 U20 报告文件；Task 0320 继续 active。
- U21-E4 Revive 合同已冻结并完成 U21a–e：只允许 AG-1 Party primary 复苏，`includeDefeated` 打开倒地目标选择；普通 heal/hpChange、E1/legacy、scheduler v5 与 Program Receipt v1 不变。正式复苏演练 Map 已注册，覆盖先击倒、Ability 复苏、后序 Prepared 来源继续行动；Restore 从起点重放并拒绝 HP Trace 篡改。定向 11 个测试文件 455/455；Schema 生成/同步、类型、架构、文档与差异检查通过。屏幕验收未执行，需求单和回执已交付；Task 0320 继续 active。
- U22-E4 回合限时伤害减免合同已冻结并完成 U22a–d：显式 beneficial `damageReduction` Status 每层减免 AG-1 damage 请求，顺序为 outgoing CardRef Modifier→Status 减免→Shield→HP；活动状态的 roundEnd 只消耗时长，不改变 HP。Scheduler v5/v6、Program Receipt v1/v2、Shield Receipt v1 与 Status Receipt v1–v4 历史保持；新 Status 语义使用独立 Receipt v5。定向 11 个测试文件 462/462、Schema sync 15/15、类型/架构/文档（1278 篇/0 errors）/差异检查通过。新演练 Map 覆盖减免、Shield、到期、Save/Restore 与 Trace 篡改拒绝；屏幕验收未执行，步骤、作者示例和回执已交付。
- U25-E5 实际结果门槛已冻结并完成：`minimumActualAmount` 只观察 `healApplied`/`damageApplied` 的最终实际 HP 变化；未达到门槛的事件不留 Trigger Trace、不产生资源意图、不消耗队列预算。Planner 覆盖请求量与最终 HP 差异、阈值低于/等于/高于、低于门槛候选不占预算；独立正式 Map 覆盖 Shield 先吸收、一次未命中、下一次命中和后序来源读到资源。16 个定向测试文件 466/466、`npx tsc --noEmit --pretty false`、架构检查、文档检查（1292 篇/0 errors）及差异检查通过；屏幕验收按报告待人工执行。

## U26 延续核验（2026-10-23）

- U26 Status 自然到期资源回馈完成：Status `onExpire` 只在自然 roundEnd 最后 tick 后为 holder 的 MapRun Actor 余额加资源；所有 Action Trigger 和 Status tick 后按 `statusTrace` 顺序结算，同轮显式清除/消费/净化、刷新、teardown、终局前跳过 tick 不触发。Trigger Receipt v2 与 Action Trigger 共享 32 次 Commit 预算并保留独立生命周期 trace，不新增伪 Action 来源；Restore 从 scheduler 起点重算，拒绝被删除、重排或篡改的 Receipt。Owner 覆盖自然 Regen/Burn、damageReduction、刷新/显式移除族、倒地 Party holder、Enemy holder 余额、terminal-before-tick、31+1 精确预算/32+1 原子拒绝、Save/Restore 篡改。只读 ReadModel 深冻结 trace，Flow 在 Action Trigger 后显示 Status/holder/source/剩余轮数/资源变化。Schema 生成 unchanged；12 个定向文件 350/350、类型/架构/文档/差异检查通过。屏幕验收需求单仍待人工执行。

## U27 延续实施（2026-10-23）

- U27 单次受击保护完成：`damageProtection` 可由 Map-local Status 声明；每个存活目标的正向 AG-1 damage hit 在 outgoing Modifier 后优先消费一层，拦截整次请求，再进入 damageReduction、Shield 与 HP 顺序。零请求、倒地目标和未执行来源不消费；repeat/TargetSet 按命中顺序独立判定；拦截不触发 `damageApplied`。
- Receipt 使用 Status v6，Trace 深冻结并在 Save/Restore 中重放；覆盖保护与减伤/护盾顺序、同轮先施加后命中、TargetSet/repeat、剩余保护 Status 轮末零 HP tick、实际伤害 Trigger、保存恢复与拦截 Trace 篡改拒绝。正式 Map `gameplay-b:map:damage-protection-example` 展示首击拦截、次击护盾吸收与实际伤害回馈；迷你控制台命令和屏幕记录单见作者示例与 U27-screen-acceptance-report。屏幕验收按用户约定交付需求单，不宣称人工通过。

## U30 延续实施（2026-10-23）

- U30 为 `GameplayMapStatusDef` 增加可选 `lifetime: 'mapRun'`；省略时仍为 Encounter-local。仅 AG-1 固定 Party 的直接 Action 可将现有 Status kind 施加给 Party holder，记录来源 Node/Activity、Status 首次应用的 Commit 起始版本与跨 Run tick 时钟。
- `MapRun.mapRunStatuses` 是唯一持久 Owner；活动 Encounter 只读合并本地与 MapRun 投影，按 Status 定义分区写回。Shop、节点和 Activity 转场不 tick；成功的非终局 Encounter roundEnd 才递减一次。中间胜利保留 Status，Run 失败或 Exit 清理，终局清理不触发 `onExpire`。
- U30 Map 使用 scheduler v7 / Status Receipt v7，Root 起点、Origin、双 Owner、统一 tick/expiry Trace 与最终列表由 Restore 重算；Status Receipt v1–v6、scheduler v5/v6 与 E1/legacy v1 分支保留。首个 Commit 起始版本 0 的 tick 校验已修正；通用成功 Exit 路径也清空 Root Status。
- 正式 Map `gameplay-b:map:maprun-status-example` 演示施加 → Shop → 后续 Encounter 的 3 次减伤 tick、自然到期、第四次完整伤害及出口清理。独立测试覆盖 Shop gap Save/Resume、Root/Receipt Origin 篡改拒绝、Shop 购买/离开不 tick、活动 Encounter 恢复重算与仍有效 Status 在成功 Exit 清理；Runtime ReadModel 测试确认只读合并并保持 Owner 不复制；另测失败终局清理不伪造自然到期。定向样例测试 3/3、Runtime integration 8/8、全 Map Registry 186/186、9 文件兼容回归 206/206、`npx tsc --noEmit --pretty false` 通过；屏幕验收需求单待人工执行，不标记通过。
- 正式作者说明见 [[docs/examples/gameplay-b-maprun-status]]；宽屏人工步骤和实际记录字段见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U30-screen-acceptance-report]]；实现回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U30-receipt]]。

## 剩余工作

- P1 AG-1、P2-U08 至 U15、U16–U30、U17 CardRef Modifier 窄首片、U18 Shield/damage pipeline、U19 部分层数消费、U20 类别净化、U21 Revive、U22 damageReduction、U23/U24 行为 Trigger、U26 Status 到期 Trigger、U27 damageProtection、U28 Fact-gated Edge、U29 单体击杀回馈与 U30 Party MapRun Status 均已实现；U07/U14/U17–U30 屏幕验收按各自需求单处理，U16 正式示例宽屏走查通过。之后仍需裁定 E4 其他 Modifier/Trigger，以及 E5/P6 相对 CardRef、位置、临时 Item、成长和 Result Adapter 的实施/延期/排除范围。独立 Validator 仍限 E1/legacy 兼容路径；E1 U18 不属于剩余工作，也不由本 Task 重开。
- 所有被纳入的 E2–E5 尾项均由本 Task 统一结项。若 P0 因证据发现某项已完成，记录现行实现与测试依据并从实施范围删去；不为它新建重复 Task。

## 相关路由

- [[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]]
- [[docs/plan-work/task-0316-gameplay-b-effect-collections-and-values]]、[[docs/plan-work/task-0317-gameplay-b-static-tags-and-candidate-pools]]、[[docs/plan-work/task-0318-gameplay-b-encounter-statuses]]、[[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]]
- [[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/testing]]
