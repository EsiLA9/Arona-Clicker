# Draft：Gameplay B / MapRun 现况与外部引擎接线调查

状态：draft — 当前检出调查已完成并生成独立报告；后续玩法优先级与架构合同仍待讨论。

## 目标与最终方向

建立一份以当前源码、测试和 `docs/docs-829/` 为依据的 MapRun 现况与接线调查，为后续 MapRun 系列玩法优化提供可复用的架构基线和施工排序依据。调查应让未直接访问本地仓库的设计者能够分辨：哪些能力已在正式路径形成闭环，哪些只有部分支持、样例或测试，哪些尚未实现，以及 AC 现有系统能通过什么边界向 MapRun 提供能力。

本阶段交付为一份独立、完整的 Markdown 报告；内容较长时可拆成连续报告并提供总索引。报告说明源码证据、验证结果、设计推论和未来建议各自的边界，不实现功能、不裁定仍有争议的玩法规则，也不新建执行 Task。

## 本阶段玩法语义与边界

- 调查对象是当前 Gameplay B 的 `GameplayMapDef / MapRun` 运行路径及其与 AC 其他领域的接线。须从正式入口追到准入、内容解析、Runtime Owner、地图与 Encounter、行动准备、Preview / Commit、结果、保存恢复和 UI。
- 将 MapRun 内的 Map / Node / Encounter、Character / Unit、Action / Card / Hand / Target、Cost / Effect / Resolution、Workspace / Flow / Save 纳入一条责任与生命周期分析；实际调用顺序以源码为准。
- 将 AC 领域边界外的 Condition、Effect / Affector、Trigger、Reveal / Visibility、Character 与培养、Inventory / Item、Resource / GameNum、Shop / Transaction、Passive / Skill、Area / Spot、Story / Talklet / Flow、Tick、Save / Snapshot、PackManager / Registry、Runtime Editor、Theme / Presentation 纳入接线目录。发现明显相关的系统时可补充。
- 专项审查：Effect 能力及系统边界；受限、可验证、可序列化的声明式效果原语；Card Tag；CardPool；长期角色培养数据到 MapRun 的只读适配器。
- **内容作者侧不允许任意 TypeScript Handler 或任意脚本。** 引擎内部可用 TypeScript 实现受限解释器、Resolver 和原语；Datapack 内容应保持声明式并可验证。
- 旧 Operation / EventRun 仅作为边界辨析对象：核实兼容、共享或残留耦合，不清理、不迁移、不将其功能误计为 MapRun 能力。按本轮要求，不追读归档 Task；归档材料不作为当前实现证据。
- 主世界 Area / Area-Map 与 MapRun Map 分别辨析各自 Owner、导航和状态。当前活动的 MapRun 行前／续行准备页 Task 0309 是相邻 UI 工作，不替代本调查；活动区域导航 Task 0310 不扩展本调查的 MapRun 领域范围。
- 可运行现有、无破坏性的定向检查并记录命令、结果和失败原因。不得修改源码、测试、Datapack 或生成文件，不以样例或模拟环境成功替代正式 Datapack 路径，不以 UI 展示推断领域执行能力。
- 本 Draft 只组织调查范围；不预设 Effect 合并方案、费用公式、奖励回写、队伍成长规则或其他尚未裁定的玩法合同。

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| MapRun 的实现与测试从哪些当前文件进入？ | 当前检出有 `src/arona-clicker/services/map-run-service.ts`、`src/arona-clicker/contracts/map-run.ts`、`src/data-services/contracts/gameplay-map.ts`、`tests/engine/gameplay-b-map-run.test.ts` 和 `tests/engine/gameplay-b-map-runtime-integration.test.ts`；目录存在不等于完整运行路径已验收。 | 报告须从正式 Runtime 装配和 UI 命令调用方追踪，不可把服务或测试文件单独视为端到端证明。 | 路径已定位；语义待核对 |
| MapRun 的唯一 Owner、GameInstance 装配与公开 Query / Command 边界是什么？ | `src/arona-clicker/contracts/runtime.ts` 暴露 MapRun Query、Workspace 投影及命令接口；`map-run-service.ts` 实现具体服务路径。 | 需要沿实际调用方确认所有权、旁路入口及写入责任。 | 待核对 |
| 当前机制文档是否覆盖新版 MapRun？ | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` 和 `docs/docs-829/02-modules/arona-clicker.md` 中可见 Gameplay B EventRun / Operation 描述；MapRun 源码另有独立服务与合同。 | 必须逐条以当前源码和测试复核文档与实现的适用范围；不能沿用文档标题或旧状态得出 MapRun 结论。 | 存在待澄清范围 |
| 是否有相邻活动工作影响 MapRun UI / 入口事实？ | 当前非归档 Task 0309 提议 MapRun 行前／续行准备页；Task 0310 明确处理独立 Area 导航。两者均为工作文档，不能当作已验收实现。 | 先记录其与本调查的范围接口；调查时以实际工作树及正式路径复核。 | 已定位；影响待核对 |
| 本 Draft 编写时仓库基线是否干净？ | 2026-10-21，分支 `main`、HEAD `9e2c85f`（`beforeHover`）、相对 `origin/main` ahead 10；工作树有多项源码、测试、Schema、索引和活动 Task 变更，其中包含 MapRun 服务及 UI 文件。 | 正式调查启动时必须重新记录分支、HEAD 和工作树状态；不得覆盖、回滚或把并行改动描述成已合并/已验收合同。对结论注明所调查的检出状态。 | 已核实（仅 Draft 编写时基线） |
| 相关测试是否已运行、结果如何？ | 报告第 14 节记录本轮实测：11 个核心 MapRun 文件 256/259 通过；Workspace 生命周期 18/18 通过；基础 P0–P3 两文件 13/18 通过。`check:docs` 扫描 1046 篇 Markdown，报告 26 个并行 Task 重名 / 既有 Operation 路径问题。 | 核心 Runtime / Registry / Save / Workspace 证据多数通过；新 Map Entry 竖切片未闭环，另有一个空 Enemy Actions 测试夹具与合同冲突；新 Entry 未做浏览器验收。 | 已核验（详细命令及失败归因见报告第 14 节） |
| 当前检出下各调查问题与端到端验收状态是什么？ | 见 [[docs/plan-work/report-0311-gameplay-b-maprun-engine-integration-investigation]]，内含源码 / 测试证据、外部接线矩阵、缺口与三张图。 | 核心 Runtime 已有独立闭环；外部成长/效果池等仍未接线；新 Map Entry 准备页转场尚未完成当前测试与视觉验收。 | 已核对（仅当前检出） |

## 建议调查 Read Set 与方法

Read Set 按问题逐层扩展，遵循 `docs/ai/task-read-set-routing.md`，不把整个目录设为必读：

1. **身份与基线**：调查开始时记录分支、最近提交、工作树状态、调查时间和可运行的验证入口；保护已有变更。
2. **MapRun 路径**：从当前 Spot / Gameplay B 入口追到 admission、Registry / Resolver、GameInstance 装配、MapRun Owner、UI Query / Command、保存恢复及实际 Datapack；读取直接调用方、被调服务、状态合同和 MapRun 专项测试。
3. **动作与结算**：核对 Action / Card / Hand / Tendency / Target / Cost / Effect / Result 的 Datapack 合同、运行时求解与 UI 投影；比较 Preview 和 Commit 的状态、事务、RNG 与失败行为。
4. **外部系统**：按领域入口分别读取 Effect / Trigger / Condition / GameNum、Character / 培养、Inventory / Shop、Area / Spot、Story / Flow、Save / Pack / Runtime Editor 和 Presentation 的 Owner、API、Schema、直接调用方及相关测试；逐项确认 MapRun 是否已有调用方。
5. **文档与验证**：选取命中的 `docs/docs-829/` 机制页并与当前代码核对。功能结论至少区分源码阅读、行为测试和 UI 验收；对每项重要判断记录相对路径、符号、行号、测试名及验证方式。只有事实不足以回答问题时才扩展 Read Set。

若 Read Set、文档和源码相冲突，记录冲突并继续以当前源码及测试核实，不将历史 Task、Draft 或单份机制文档升格为实现事实。

## 需要回答的事实门槛

### MapRun 本体和运行生命周期

- 正式入口、准入条件、内容解析、GameInstance 装配、唯一活动 Owner、开始／恢复／结束责任分别在哪里？是否有旁路写入？
- Map / Node / Edge 的静态声明与运行进度如何分层？当前节点、可达性、可见性、移动历史、重访、出口、胜败／撤退、节点活动重置分别由谁持有和更新？
- Encounter 如何从节点内容创建，参与者和 Snapshot 来自何处，Encounter-local 状态及完成条件如何表示，结果怎样回到 MapRun？Battle、Rest、Shop、Talk 等实际共用哪些合同或执行器？不得从 UI 名称推断共用引擎。
- Encounter 之间哪些状态延续、重置或进入 PlayerState？失败、中断、保存、恢复、内容版本变化时分别发生什么？是否有 Phase / Scene 或其他阶段合同？
- 区分新版 MapRun、旧 Operation、样例、原型、兼容层及测试夹具；识别共享于 MapRun 和其他 AC 系统的文件及残余耦合。

### Character、Action、Card、Hand 与 Target

- 描述角色准入、角色 ID / Variant / Participant 关系、敌我中立单位、个人与队伍资源、HP / 倒地、阵型、环境资格、倾向、技能 / 被动、敌方意图与目标策略。
- 分开长期 Character 定义、外部培养数据、MapRun 角色快照 / 跨 Encounter 状态、Encounter 临时状态，核对每项数值的唯一权威写入方。
- 分别定义 Action、自然行为卡、Character Hand、Prepared Action、具备实例身份的 MapRun Card、单位附属 Card、Flow 玩法卡、持有物／技能／玩家牌和仅供展示的历史副本；核对来源、身份、目标和生命周期，避免把 UI 卡片视为同一对象。
- 追踪候选来源、资格过滤、权重、Tendency 调整、CardPool 参与情况、是否放回、RNG 来源与存档、Hand[0] / Wait、Preview 是否纯读、Commit 后抽取时机，以及 Swap / Override / PlayerCommand 的语义。
- 核对 `none`、`self`、友方、敌方、真实 Card 目标等支持范围；候选生成、0 / 1 / 多候选、相对顺序、治疗／攻击等受益方、换牌后目标、目标失效与跨轮 / 跨 Encounter 引用清理、手动选择和自动策略的优先关系。

### Preview、Commit、Effect、Cost、Result 与 UI

- 追踪 Draft 建立、完整行动合法性和费用预检、效果计划、执行顺序、 detached 状态、Owner 写回、失败的零写入保证、Result / Resolution 记录及 Save / Resume 一致性。
- 列出可声明 Effect 的类型、目标、作用范围和限制：单位 HP、Actor / Team resources、Track / Fact / Item、真实 Card 等分别支持到什么程度；记录费用账户、聚合支付及 UI Preview 是否推进 RNG 或产生副作用。
- 核实三栏 MapRun Workspace、Flow、Hover / 作用关系、行动编辑与目标交互调用的 Query / Command，区分临时 UI 状态与 Runtime 状态；UI 验收单独记录。
- 复核 Battle、Rest、Shop、Talk / Story 等实际行为和结束条件，识别是否只有单独内容声明、投影或样例，没有统一 Encounter 结算闭环。

### AC 外部引擎接线与五项专项

- 每个外部系统记录：Owner、入口 API、输入 / 输出、只读查询、写命令、副作用、Context 限制、Datapack 声明、异步／Tick／事件行为，以及当前 MapRun 调用方。
- 对拟用能力区分：当前已接入、可直接复用、需 Adapter、需扩展外部合同、不宜共享；明确读取、转换、校验、快照持有、提交、失败回滚、存档和循环依赖责任。
- Effect 专项比较 MapRun 瞬时效果与 AC Effect / Affector / Trigger 的持续时间、事件时机、状态范围和事务边界，提出最小可共用边界，不主张合并全部系统。
- 声明式原语专项检查数值表达式、目标集合、条件、组合、有界重复、随机数、生成／修改其他效果和静态验证；不引入任意 TS 扩展。
- Card Tag 专项核对现有 Action / Strategy / qualification 标签，区分抽取权重标签与未来分类、筛选、枚举、条件、目标、合成标签；记录命名空间、验证、跨包引用及局内修改能力。
- CardPool 专项核对角色逐项枚举、共享池、多来源组合、重复引用合并、条件过滤和倾向权重顺序、同卡多来源资格／权重、权威池数量，以及其与实体卡、Hand 和 Player Deck 的区别。
- 角色培养 Adapter 专项覆盖 Character / Variant、等级经验、技能、装备槽、星级 / 专武、爱用品、好感与加成、持有／解锁和其他成长来源。分析入场快照、冻结数据、跨 Encounter 保留、运行中变化、结束时写回、双 Owner 防护，以及数据损坏／缺失／版本变化的降级方式；只提出边界，不施工。

### 风险、阶段依赖与关键未决

- 以证据区分真实缺陷、合同空缺和一般设计风险；特别检查 Effect / Condition 语义冲突、Schema 不一致、引用失效、双向写入、快照与实时读取不一致、Tick / 回合冲突、Preview RNG、副本 / UI 身份混淆、Resume 兼容、运行中更新、Area 与 MapRun 命名／Owner、跨系统原子性及旧 Operation 耦合。
- 根据实际依赖比较：当前闭环修复、Action / Target / Preview / Commit、Effect 和声明式原语、Card Tag、CardPool、培养 Adapter、Ability / Item、跨栏交互、Datapack 作者工具、存档版本与综合回归。找出可并行部分、表现层扩展和长期高级内容，并指出能由真实 Datapack 验证的最小端到端切片。
- 玩法合同或架构边界若仍需产品裁定，列入未决问题；不在 Draft 中替项目选择费用公式、效果语义或外部成长写回规则。

## 预期报告结构与验收

调查报告至少包括：

1. 执行摘要与分项完成度矩阵；
2. 调查基准、活动工作区状态与资料范围；
3. 实际模块依赖和调用链；
4. Map / Node / Encounter / 状态分层；
5. Character、Action、Card、Hand、Tendency、Target 和 Cost；
6. Preview、Commit、Effect、Resolution、Result 和 Save；
7. 三栏 Workspace、Flow、Hover、作用关系与目标选择；
8. AC 外部系统能力目录和接线矩阵；
9. Effect、声明式原语、Card Tag、CardPool、培养 Adapter 五项专项；
10. 接线方向、状态所有权、事务、生命周期和保存边界；
11. 带证据的风险与缺口矩阵；
12. 施工依赖图、分阶段建议及三项优先独立工作；
13. 关键未决设计问题；
14. 测试、浏览器验收与源码证据索引。

报告至少包含三张 Mermaid 图：当前实际架构、未来候选外部接线（标出已存在／可复用／需 Adapter／需扩展合同）、状态所有权及提交边界。矩阵需逐项区分**完整可用、部分可用、仅测试或样例可用、已设计未实施、未实现、无法确认**，每项附源码 / 测试证据；外部接线矩阵需有 Owner、API、现用情况、接线需求、推荐入口、风险和优先级。

每个推荐施工阶段写明前置依赖、可复用能力、新增能力、可能涉及模块、独立验收、主要风险和优先级；至少展示一个真实 Datapack 的最小端到端切片。重要结论须引用仓库相对路径、符号、行号、对应测试名及核验方式，并标明它是源码事实、测试事实、设计推论还是建议。

报告结尾必须逐一回答：

1. 当前 MapRun 能完整完成怎样的一次游戏过程？
2. 最简单的 Datapack 卡牌能执行哪些真实效果？
3. 复杂战斗、爆破、治疗、环境、交涉、休息行动还缺哪些基础原语？
4. AC Effect / Affector / Trigger / Condition 中哪些可复用、哪些不应直接复用？
5. Card Tag / CardPool 现有基础和合理新增位置是什么？
6. 如何导出稳定的 MapRun 初始角色快照并避免双 Owner？
7. Ability、Item、Shop、Story 与 MapRun 的真实接线和未来设想分别是什么？
8. MapRun 与主世界 Area / Area-Map 应共享及隔离哪些能力？
9. 哪些已有计划所描述的能力仍无正式路径或视觉验收？仅检查当前非归档材料及源码，不追读归档 Task。
10. 若后续只能施工三个独立 Task，应优先哪些、各自最小验收是什么？

## 裁定记录

| 待裁定问题 | SolChat 建议 | 本项目决定 | 依据/待验证项 |
| --- | --- | --- | --- |
| 调查结果是否需要独立只读 Task 承载，或在本 Draft 内完成并附报告？ | 暂无 | 本轮已由 Draft 承载调查范围并完成独立报告；不另建调查 Task。后续功能施工仍需按各自准入另立 Task。 | `docs/ai/goal-workflow.md` 的独立只读审计准入；用户要求执行调查，未授权创建 Task。 |
| MapRun 是否应复用 AC Effect / Condition / Trigger？ | 先查清 Owner、语义、事务和生命周期，只找最小共用边界。 | 调查确认当前没有直接 MapRun 接线；建议维持局内 Owner，并按明确事件 / Snapshot Adapter 接入有限能力。是否扩展合同待产品裁定。 | [[docs/plan-work/report-0311-gameplay-b-maprun-engine-integration-investigation]] 第 6、8、11 节；`EffectEngine` / Affector / Trigger 与 MapRun 状态上下文不同。 |
| MapRun 结束时是否写回长期培养、物品或其他 PlayerState？ | 按状态 Owner 和明确结算合同设计。 | 调查确认当前只存在 Encounter Consumable 库存消费的跨 Owner 事务；没有通用成长、奖励或 ItemDef.useEffects 写回。是否新增写回规则暂缓。 | 报告第 6、8、9.5、13 节；PlayerState 与 MapRun checkpoint 分开保存。 |
| MapRun Card 是否应采用统一 Card Tag 与 CardPool？ | 先区分 Action、候选、Hand、实体卡和 UI 投影，再评估最小新增归属。 | 调查确认当前 Map Action 没有 Tag 或 Pool；建议在静态 Action 合同与抽 Hand 前的 Candidate Resolver 评估最小能力。具体语义待裁定。 | 报告第 5、9.3–9.4、12 节；当前 Encounter 仍显式列 Action IDs。 |

## Draft → Task 准入

- [x] 语义和明确非目标已界定为只读调查；玩法结论和施工决定暂缓。
- [x] 会改变方案的事实已核对：报告已核对当前入口、Owner、Preview / Commit、保存恢复、外部调用及关键冲突。
- [x] 有独立完成定义及依赖关系：调查报告已验收，后续施工分期、依赖和独立结果在报告中列出。
- [x] 能给出施工 Read Set 与验收入口：报告列出实际源码、测试路径、已运行命令和后续验收缺口。
- [x] 已写明本阶段之后仍未完成的最终方向：本 Draft / 报告不实施 MapRun 优化、不裁定未决合同；项目讨论未决问题后，再决定优化分期及是否独立立项。

## 下一步

调查报告已完成：[[docs/plan-work/report-0311-gameplay-b-maprun-engine-integration-investigation]]。下一步由项目讨论哪些未决合同要裁定、是否按报告建议继续 Task 0309 或进入新施工 Task；本次没有创建 Task，也没有改动源码。跨任务生效的 Owner、事务或 Schema 裁定仍需单独讨论。

## 相关路由

[[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/galhcg-project-map]] · [[docs/docs-829/00-INDEX]] · [[docs/docs-829/02-modules/00-index]] · [[docs/docs-829/04-mechanisms/00-index]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/schema-sync]] · [[docs/docs-829/05-conventions/testing]] · [[docs/plan-work/task-0309-maprun-staging-and-reentry-workspace]] · [[docs/plan-work/archive/task-0310-area-map-navigation-service-v1]]
