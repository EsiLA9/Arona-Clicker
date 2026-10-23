# Draft 0312：Gameplay B 卡牌行为与局内效果原语

状态：E0-contract-approved — 用户于2026-10-21回复“全部按推荐”，批准Task0313决策表P1–P8；本文保留经批准的设计与当时实现基线。实现状态已由 Task 0312 / Task 0315 后续推进。

本文回答：数据包作者如何用少量概念写出战斗、支援、休息、交涉与探索行为，并沿现有 MapRun 结算逐步扩展。

需求来源：用户于 2026-10-21 提供的《AronaClicker · Gameplay B 卡牌与游戏内效果原语设计需求》（完整附件，共二十节）。本文覆盖其 A—G 交付；首期实施交接见 [[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]。Report 0311 只作调查入口，当前事实以本轮检出源码为准，不读取归档来推断实现。

## 实现状态与当前路由（2026-10-23）

本文是设计与裁定来源，不是当前作者字段清单。Task 0312 的 E1 实施阶段已按用户要求豁免 U18 验收并关闭施工流；后续 [[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 已将八张内置 Map 与作者示例迁至 `effectProgram`，并移除 Map Action 旧 `effects` / `hpEffects` / `cardEffects` 合同和兼容执行路径。Task 0315 为迁移内容加入语义明确的 `damage` / `heal` 原语；E1 AST 仍保留签名 `hpChange` 节点，它不是旧 Action 数组。Task 0316 实现确定性 TargetSet damage/heal、有限整数 Value 和每目标 repeat；Task 0317 完成静态 Action Tag、Map-local 候选池及 MapRun 多来源候选合并；Task 0318 已完成 Encounter-local burn / regen 首片；E5 Prepared Tag 连携首片已由 [[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]] 完成。Task 0320 已完成 U14 additionalTarget、U15 MapRun Fact 门控静态候选池、U16 Status ID 清除、U17 CardRef Modifier 窄首片、U18 Shield/damage、U19 部分层数消费、U20 类别净化、U21 Revive、U22 回合限时伤害减免、U23/U24 healApplied/damageApplied 回馈、U25 实际 HP 变化门槛、U26 Status 自然到期回馈、U27 单次受击保护、U28 MapRun Fact Edge 门控、U29 单体击杀回馈和 U30 MapRun-lifetime Party Status。U23/U24/U25 使用独立 Trigger Receipt v1，U26 使用独立 Trigger Receipt v2，U27 使用独立 Status Receipt v6，U29 使用独立 Trigger Receipt v3 并保持旧 v1/v2 路径。U14 自动化定向测试433/433、U15定向测试325/325、U23/U24 15文件462/462、U25 16文件466/466、U26 12文件350/350通过。U14 宽屏实屏验收因当前正式 Map 没有可触发 additionalTarget 按钮的 Action，需求单记录为未能验证，不等于通过。U07/U14/U17–U30 屏幕验收未标记人工通过；具体剩余 E4/E5/P6 范围见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]。Task 0316–0319 已完成部分不重做。当前 Map Action 作者合同以 [[docs/docs-829/03-data-structures/datapack-contracts]] 和 [[docs/examples/gameplay-b-effect-program-e1]] 为准，Tag／候选池示例见 [[docs/examples/gameplay-b-card-tags-and-pools]] 与 [[docs/examples/gameplay-b-maprun-fact-gated-pools]]，状态示例见 [[docs/examples/gameplay-b-statuses]]、[[docs/examples/gameplay-b-damage-reduction]]、[[docs/examples/gameplay-b-damage-protection]]、[[docs/examples/gameplay-b-status-expiry-reward]]、[[docs/examples/gameplay-b-maprun-status]]；U23/U24 样例见 [[docs/examples/gameplay-b-heal-applied-resource]] 与 [[docs/examples/gameplay-b-damage-applied-resource]]、[[docs/examples/gameplay-b-actual-amount-threshold]]；U29 击杀回馈见 [[docs/examples/gameplay-b-enemy-defeated-reward]]；逐 Action 迁移依据见 [[docs/plan-work/task-0315-units/receipts/task-0315-u04-receipt]]。Shop Offer `effects` 仍是独立合同。U18 豁免不等于 E1 产品验收通过。

U28 延续把 MapRun Counter / Flag 用作 AG-1 地图 Edge 的单项路线门槛：候选池继续读取 Encounter 入场快照，移动路线读取当前已安装事实；合同、作者示例、回执与屏幕记录单见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-e5-maprun-fact-edge-gates]]、[[docs/examples/gameplay-b-maprun-fact-gated-pools]]、[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U28-receipt]] 和 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-screen-acceptance-report]]。

U29 为 Draft §3「击杀奖励」冻结并实现窄 `enemyDefeated`：仅 Party Actor 来源的直接 primary Damage 命中使 Enemy HP 从正数降至零时触发，资源回馈给来源 Actor。TargetSet、`forTargets`、Status tick、已倒地目标和非致死结果不触发。独立 Trigger Receipt v3 区分击败目标与奖励领取者，并可与 Status 自然到期 Trace 同次重放；旧 Trigger Receipt v1/v2 不变。合同、演练和屏幕需求单见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U29-e5-single-hit-defeat-reward-contract]]、[[docs/examples/gameplay-b-enemy-defeated-reward]] 与 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U29-screen-acceptance-report]]。

## 1. 先说明玩家和作者得到什么

一张卡仍然表示一个 Action。作者先写“谁能用、主目标是什么、费用多少”，再列“对谁做什么，接着做什么，什么条件下追加”。准备行动、抽牌、换牌、目标选择和提交仍走现在的 MapRun，不增加第二套 Hand、卡牌库存或结算服务。

最值得先增加的不是几十种攻击名字，而是三件事：**几个效果按顺序组合、在局内条件成立时执行一段效果、用少量局内计数与事实表达进度**。已有 HP／资源／卡牌费用效果接入同一解释路径。这样“治疗后奖励物资”“交流增加信任”“调查后记录发现”先能表达，再逐步增加群体、状态、范围和连携。

概念只保留必要区别：Action 是行为；Target 是需要确认的对象；Cost 是先检查的支付；Condition 是是否执行；Effect 是发生的变化；EndCondition 是何时结束遭遇。持续 Status、Modifier 与触发时机留到后期，不把所有玩法都压成一个万能数值效果。

## 2. 调查时事实基线与已完成前置（2026-10-21；历史记录）

调查基线：2026-10-21，HEAD `dff0061`（before MapRun primitive），开始调查时工作树无改动。Report 0311 中关于准备页未完成和旧 UI 入口测试失败的描述是历史工作树快照，本轮不继承这些结论。

| 调查时事实 | 当时实际依据 | 对原设计的影响 |
| --- | --- | --- |
| 0309 已完成，入口为 map-entry 再显式开始／继续 | 当前 Task 0309 状态 complete；`tests/ui/gameplay-b-map-vertical-slice.test.ts` 已使用 data-map-entry-open、start、leave 和 resume | 不把完成 0309 列为前置，不重做准备页 |
| Action 只有固定整数 costs、资源 effects、hpEffects、cardEffects | `src/data-services/contracts/gameplay-map.ts` 的 GameplayMapActionDef | 需求中的 actorResourceEffects/teamResourceEffects 不是当前作者字段名；资源是 effects 的 scope/recipient 分支 |
| HP 是带符号变化，无独立伤害／治疗类别；HP=0 不被普通正值复活 | `map-run-service.ts` 的 resolveEncounterCommitPlan/applyHpEffects | E1 保留 hpChange 窄语义；damage/heal/revive 的差异到 E2／E4 明确定义 |
| 资源有 performer／target 与 actor/team 区分 | 同服务 settlementChangesFor；GameplayMapActionResourceEffectDef | 可复用资源账本，不能与 PlayerCost 或 AC Resource 混用 |
| 现有角色 HP、费用、资源、Ability/Item 与 Enemy 有特定结算次序 | resolveEncounterCommitPlan：角色 HP 规划→整轮己方费用验证→资源变化→Ability/Item HP→终态检查→Enemy 有序行动 | 新顺序／条件不是只换字段；E0 必须保护旧结果，不能在抽象化时悄悄改玩法 |
| 无法支付己方整轮费用会拒绝，不能靠本轮奖励先凑费用 | requiredCosts 按起始余额聚合；PlayerCost 独立累计 | 保留费用预检，不允许先赚钱再支付本轮预定费用 |
| 自动目标可按规划 HP 重新选择；显式选择不悄悄换对象；原位倒地 HP 变化可为 0 | resolveEncounterCommitPlan 及 `gameplay-b-target-selection.ts` | 区分外来非法身份与本轮自己造成的倒地，不能把后者误作整轮失败 |
| Enemy 在己方侧结算后逐个行动，有 defeated/noLegalTarget/unaffordable/roundEnded 跳过 | resolveEncounterCommitPlan 的 preparedEnemyActions 分支 | 不误称双方同时支付／同时行动；敌方费用与己方整轮预检不是同一时机 |
| 实际卡牌有 Scope、Owner、zone、logicalIndex；不是 actionId | `contracts/map-cards.ts`；`services/map-card-catalog.ts` | 跨轮引用失效；左右相邻只能来自显式领域容器，不能来自 DOM |
| scostDiscount 在费用处理前按实际 CardRef 计算，正数叠加并截到原始 sCost；不减 PlayerCost | `services/map-card-effects.ts` 的 resolveMapCardEffects/mapScostCost | 保留准备阶段；敌方折扣只影响其后续可受用来源，不把它改成全局同时折扣 |
| Preview 与 Commit 共用 resolveEncounterCommitPlan；安装使用 prepared token | MapRunService.previewEncounterCommit/prepareEncounterRoundCommit/canInstallPreparedEncounterCommit/installPreparedEncounterCommit | 新效果进入这条链，不另建 effectCommit，不给解释器真实 State 写引用 |
| 外部 Consumable 已有双 Owner 安装协调 | `runtime-game-instance.ts` 的 commitMapEncounterRound；StateMutation 的 prepare/canInstall/install/publishMapRunItemConsumption | 保留库存扣除与局内计划的一次性提交；局内效果不执行 ItemDef.useEffects |
| checkpoint 校验 Hand、草稿、Receipt、定义与 resumeVersion | map-run-service.ts 的 restoreRunState/restoreEncounterCommitReceipt/restoreSaveSnapshot；map-run.ts | 新 Counter/Flag/Receipt 字段必须贯通验证，不只在保存 JSON 时“顺带带上” |
| 目前没有 MapRun Card Tag、CardPool、Status、Counter/Flag 和统一条件程序 | gameplay-map.ts、map-run.ts；Hand resolver 仍消费各参与者手写候选 | 这些是待建设能力，旧 Operation 的同名能力不算已接线 |
| 抽牌使用可保存的确定性 Hand RNG；新 Encounter 种子仍由 Owner 的 initializeEncounterSeed 使用 Math.random 取得 | map-run-service.ts；gameplay-b-hand-resolver.ts | E1 不新增效果随机数；E2 随机目标须单独定义流，不假定已具备任意随机效果合同 |

本轮实测：卡牌、Save/Resume、Source transactions、Map Registry 四文件 **167/167 通过**。这不是所有 Runtime／UI 测试或浏览器验收通过的声明。

## 3. 行为样例库：原始设计场景与缺口（非当前功能清单）

本节的“原／当前与缺口”以 2026-10-21 调查时的窄合同为基线，目的是保留原始设计问题，不表示当前功能。已实现范围看当前机制文档和示例；当前迁移结果看 Task 0315。

表中“原”表示调查时已有；“E1”等表示当时推荐阶段。每行按“行动者／目标；结果；费用与条件；缺口”展开。数字仅为设计演示，不是平衡批准。通常费用可以是零或作者声明的固定 Actor／Team 资源；PlayerCommand／Ability 的 PlayerCost 沿既有来源规则。

### A. 普通战斗

| 玩家看到的行为 | 谁／目标、效果、费用／条件 | 当前与最小缺口 |
| --- | --- | --- |
| 单发射击 | 角色→选定敌人；HP−3；可付弹药1，目标存活 | 原 HP/Cost 可做；独立 damage 类别 E2 |
| 连续射击 | 角色→同一敌人两次各−2；付弹药2，固定两击 | Task0316 已支持单条 damage/heal 对每个目标 repeat 0–8；repeat 不是任意语句体循环 |
| 随机散射 | 角色→不同敌人3名各−1；付弹药1，合法候选不足取实际人数 | 缺目标集合与确定性无放回抽样，E2 |
| 双目标打击 | 角色→合法敌人2名各−2；付能量1，排序稳定 | Task0316 已支持显式 `limit: 2` 的确定性 TargetSet damage；随机抽选另属 E2R |
| 压制前排／绕袭后排 | 角色→声明排位中的存活敌人；−2；付弹药1 | 缺领域排位，不读 UI 上下位置，E5 |
| 补刀 | 角色→最低 HP 比率敌人；−3；可零费用 | 原 preference=lowestHpRatio 可做；“最低绝对 HP”是另一种偏好，E2 单列 |
| 邻近波及 | 角色→主目标及其逻辑邻居；主−3、邻−1；付能量2 | 缺逻辑邻接及逐目标系数，E5 |
| 全体小伤害 | 角色→全体存活敌人各−1；付能量2 | 缺集合，E2；标签不能赋予群体能力 |
| 蓄力射击 | 角色→敌人；固定额外付弹药2改成−5；需费用够 | 固定配方原可做；可选额外支付／按支付量增强 E5，不借 when 偷扣费 |
| 整备射击 | 角色→敌人−2并自己弹药+1；正常固定费用 | 两类变化原能共存；作者可控完整顺序与条件 E1 |
| 掩护后鼓舞 | 角色→敌人−2、指定队友资源+1；固定费用 | 当前一个主目标不能同时另选队友；E1 可自己／己方 Team，任意第二队友／全队 E2 |
| 击杀奖励 | 角色→敌人，实际由此次伤害击败才弹药+1 | U29 的 `enemyDefeated` 只承认 Party 来源对 Enemy primary 的直接致死命中，奖励写给来源 Actor 并进入 FIFO/32 次预算；Trigger Receipt v3 独立保存收款人并从 scheduler 起点重放；不把 Status tick 或 TargetSet 击杀算入 |

### B. 爆破、范围与复杂攻击

| 行为 | 谁／目标、效果、费用／条件 | 当前与缺口 |
| --- | --- | --- |
| 定点爆破 | 角色→指定敌人−5；付炸药1 | 原固定单体可做；explosive 仅标签，伤害类别 E2 |
| 同排溅射 | 角色→主目标同排各−2；付炸药1 | 缺排位＋集合，E5 |
| 区域轰击 | 角色→声明战术区域内敌人各−2；需合法区域 | 缺领域区域，不把屏幕圈选当战术范围，E5 |
| 随机爆炸波及 | 角色→从合法敌人选2名各−2；付炸药1 | E2 无放回随机集合，不能临时 Math.random |
| 对燃烧目标追加 | 角色→敌人先−3，若有燃烧再−2；付弹药1 | 缺状态和状态条件；E4，不先建无限事件系统 |
| 递减链爆 | 角色→主目标−4、邻居−2、次邻−1；付炸药2 | 缺逻辑邻接、去重和有界传播；E5 |
| 按命中数回收 | 角色→集合各−1，实际命中N则 Team+N | 缺实际结果计数；E2 仅合法集合人数，区分命中人数和实际伤害人数；结果奖励 E5 |
| 攻击改变姿态 | 角色→敌人−2并使其压制／后退 | 状态型压制 E4；位置型后退 E5，不能同名混合 |

### C. 治疗与支援

| 行为 | 谁／目标、效果、费用／条件 | 当前与缺口 |
| --- | --- | --- |
| 单体包扎 | 角色→一名存活友方+3 HP；付医疗1 | 原可做，截到 cap、不复活 |
| 群体急救 | 角色→所有受伤且存活友方各+2；付医疗2 | 缺集合及受伤过滤，E2 |
| 自动急救 | 角色→最低 HP 比率友方+3；付医疗1 | 原 preference 可做；是否玩家覆盖沿现有目标规则 |
| 按缺血恢复 | 角色→友方，恢复缺失HP的一半并向下取整；付医疗1 | 当前 TargetSet + missingHP / divFloor 可表达；普通 heal 仍不复活 |
| 加盾 | 角色→友方，提供3护盾；付能量1 | AG-1 Shield/damage pipeline 已由 Task 0320 U18 实现；独立额度与 HP 分账 |
| 单项净化 | 角色→友方，清除一类指定状态；付医疗1 | Task 0320 U16/U19 已提供按精确 Status ID 全清与部分层数消费；目标与清理范围见其合同 |
| 类别净化 | 角色→友方，清除 harmful 类状态；付医疗2 | Task 0320 U20 已提供显式 harmful/beneficial 分类与类别全清；未分类状态不匹配 |
| 以血换血 | 角色→另一友方；自身扣2 HP后对方+3；自身须能支付 | HP Cost 与普通 damage 不同，需防止自伤后非法执行／免费复活，E5；不塞进 E1 免费成本 |
| 有效治疗奖励 | 角色→友方治疗，实际恢复>0才物资+1 | 缺 actualHealed 结果条件，E5；E1 可明确检查治疗前受伤，二者不等价 |
| 按人数治疗 | 角色→友方，按集合存活人数增加治疗量；付医疗1 | 当前 Value 的 targetCount 可在 damage/heal 集合内读取所选成员人数 |
| 复苏 | 角色→倒地友方恢复指定 HP；付特殊资源2 | Task 0320 U21 已交付 AG-1 `revive` 与显式倒地 Party primary；普通 heal 仍不能复活，演练见 [[docs/examples/gameplay-b-revive]]；样例费用由各 Map Action 字段声明 |

### D. 防御与持续效果

| 行为 | 谁／目标、效果、费用／条件 | 当前与缺口 |
| --- | --- | --- |
| 本次减伤 | 角色防御／受击者；此次伤害减2 | Task 0320 U22 已提供固定 damageReduction Status；在 Shield 前按每次 hit 减免，Origin 视为 Encounter/MapRun 生命周期规则 |
| 两轮防御提高 | 角色→友方，防御修正保留2轮；付防御资源1 | U22 已提供 damageReduction Status 与回合时限；MapRun 跨遭遇寿命另见 U30 |
| 下次攻击保护 | 角色→友方，下一次实际受伤减3并消费保护 | U27 `damageProtection` 已实现：拦截整次正向 hit 并消费一层；它不是固定减 3 |
| 每轮恢复 | 角色→友方，之后2个 roundEnd 各+1 HP | Task 0318 `regen` 已支持固定 HP roundEnd；状态规则不接 AC 每秒 Tick |
| 受伤反击 | 状态持有者→伤害来源，实际受伤后反击1 | Status holder 的实际受伤事件与有限反击效果仍未实现，归 Task 0320 E4 后段裁定 |
| 接受治疗获资源 | 被治疗者在实际恢复后能量+1 | U23 `healApplied` 已给来源 Actor 回馈；将资源给受治 holder 的 Status 事件仍未实现 |
| 灼烧 | 角色→敌人，2轮末各受1伤害；付火种1 | Task 0318 已实现 Encounter-local burn 与 roundEnd；MapRun 来源/寿命按 U30 显式选择 |
| 叠层／到期 | 重施燃烧加层；到期触发一次伤害 | Task 0318 已定义同来源重施与层数上限；U26 已实现自然到期 holder 资源回馈，状态到期伤害仍未纳入 |
| 消耗层数 | 角色→敌人，消费燃烧层换伤害 | 缺层数原子消费与结果 Value，E4 后段／E5 |

### E. 资源与队伍协作

| 行为 | 谁／目标、效果、费用／条件 | 当前与缺口 |
| --- | --- | --- |
| 自己补给／花费 | 角色→自己，弹药±1；Cost 单独支付 | 原 actor effects/costs；E1 不把负 effect 冒充使用费用 |
| 转移补给 | 角色→队友，自己−1、队友+1，需真有1 | 固定单目标 delta 可拆，但转移应失败整段、不能凭空增发；E1 顺序＋余额验证，精确实际转移 Value 后续 |
| 共享消耗 | 角色→己方 Team，支付物资1 | 原 team cost，不是 PlayerCost |
| 全队分发 | 角色→每个存活友方，各自弹药+1 | 缺集合，E2；Team+1 不是全员各+1 |
| 物资充足追加 | 行动者若 Team物资≥3，额外获得收益 | 缺局内资源条件与读时机，E2；首期明确暂不支持以资源读数决定执行分支 |
| 其他角色行动支援 | 支援者在队友行动后获得协调1 | 缺回合实际来源结果／触发，E5 |
| 按存活人数收益 | 角色→Team，获得存活人数的士气 | 缺数量 Value，E2 |
| 各队友不同收益 | 主目标队友治疗，另一角色补弹，Team鼓舞 | 固定 source/primary/Team 的组合 E1；额外独立单位选择／集合 E2 |

### F. 卡牌自身与其他卡牌

| 行为 | 谁／目标、效果、费用／条件 | 当前与缺口 |
| --- | --- | --- |
| 本轮自减费 | 折扣来源→自己合法实际卡，sCost−1 | 原 card target side=self 有基础；目标须真在 CardCatalog 且费用类型合格 |
| 指定另一张卡减费 | 来源→合法 CardRef，sCost−1 | 原 cardEffects 可做；不减 PlayerCost、不补 sCost 余额 |
| 增减卡牌效果 | 来源→治疗卡 heal+2 或 damage−1 | 缺静态效果身份、匹配域、修正层，E5 |
| 下一张增强 | 来源→之后执行的第一个合格来源，额外+2 | 缺实际执行容器及消费时点，E5；不是 UI 相邻 |
| 左右相邻卡 | 来源→同一指定领域 Hand 容器的前／后元素 | logicalIndex 只有基础排序；缺明确相对选择合同，E5 |
| 同单位其他牌 | 来源→相同 Owner 的其他真实 Hand 卡 | CardCatalog 已有身份，缺集合选择／修正规则，E5 |
| 按标签附加 | 治疗类／爆破类卡满足匹配后追加 | 静态 Action Tag 已由 Task 0317 实现；缺 Prepared 来源筛选与追加规则，E5；Tag 本身不执行效果 |
| 按已准备数量 | 来源→自身或Team，按准备来源数获得收益 | 缺 prepared 只读集合／Value，E2 基础数量或 E5 复杂组合 |
| 交换执行顺序 | 来源→两个已准备来源，交换域内次序 | 高级能力；改变费用和先手规则，E5 单独评估，不进 V1 |
| 复制效果 | 来源→另一张真实卡，复制白名单 resolve 片段 | 缺复制范围／递归／来源身份，E5，只评估，不授权任意 program 引用 |
| 替换／生成／移除卡 | 来源改 Hand／Prepared 结构 | 缺领域实例生命周期／抽牌合同，E5；不创建第二牌堆或永久卡库存 |

### G. 休息、交涉与约会

| 行为 | 谁／目标、效果、费用／条件 | 当前与缺口 |
| --- | --- | --- |
| 休息恢复 | 角色→自己或队友+2 HP；可零费用 | 原有限轮 Rest 可做 |
| 交流增信任 | 角色对当前交流对象／无单位目标；Encounter trust+1 | 缺 Encounter Counter，E1；不是 AC 好感写入 |
| 观察得线索 | 角色→自己Team，clue+1 | 原局内 Team resource 可做；“具体发现过某件事”需 Flag，E1 |
| 推调查进度 | 角色→本 Encounter，progress+1 | E1 Counter，避免伪装长期统计 |
| 情绪低落时安慰 | 角色对友方／交流对象；lowMood事实成立则trust+2，否则+1 | 简单 Flag 与 when E1；复杂多值态度模型 E2/E4 |
| 根据态度回应 | 交流对象 attitude≥阈值则不同收益 | 单 Counter 条件 E1；完整分支／叙事驱动待后续，不调用 Story |
| 资源换临时物 | 角色付Team资源，获得本局钥匙 | 现有 Map Shop 可交换局内资源；独立临时 Item 身份／库存 E5，不借 AC Consumable 发放 |
| 信任达标结束交涉 | trust≥3 的 non-battle Encounter 自动完成 | E1 Counter＋受限 EndCondition，不是 Effect.finishEncounter |
| 准备度达标结束休息 | readiness≥3 后完成 | E1；与既有固定 rounds/manual 清楚互斥 |
| 选择记录局内事实 | 角色行动设置 clueFound=true，后续卡读取 | Encounter 内 E1；跨 Encounter 的 MapRun Fact E2/E5 单独状态范围 |
| 获道具留待以后用 | MapRun 临时物品跨 Encounter 保留、之后支付 | 缺本局 Item Owner 数据与映射，E5，不直接改 PlayerState.inventory |

### H. 探索与环境

| 行为 | 谁／目标、效果、费用／条件 | 当前与缺口 |
| --- | --- | --- |
| 调查节点 | 角色于当前 Node 的 Encounter 操作，progress+1 | E1；移动／开活动仍由 Map 流程负责 |
| 发现信息 | 行动设置局内 Flag，ReadModel 再允许展示对应信息 | E1 局内事实基础，具体内容 Reveal 接线后续，不枚举未发现 Story |
| 取得临时资源 | 角色→己方Team，supplies+1 | 原资源效果可做 |
| 用物品过障碍 | 来源支付本局钥匙并解除路线条件 | 缺临时物品Cost／MapRun Fact／Edge条件，E5；不是普通 effect直接移动 |
| 改环境变量 | 角色使 lightOn=true／temperature改变 | Encounter Flag/Counter E1；有独立环境实体与数值修正 E5 |
| 环境增强行动 | lightOn时额外progress+1 | E1 读本 Encounter Flag；环境外部对象／复杂数值 E5 |
| 一次性机关 | 未触发Flag时给收益并设已触发 | E1 同程序guard；跨 Node一次性机关需 MapRun Fact E2/E5 |
| 解锁后续路线 | MapRun Fact 成立让 Edge 合法 | U28 已支持 AG-1 Map 的单项 Counter 比较 / Flag 等值路线 gate；每次移动读取当前 Facts，不让效果直接越权改 Node |
| 特殊条件提前结束 | non-battle counter达标结束；战斗目标条件完成 | non-battle E1；Battle 的 failure/victory/objective 优先级 E2/E5 |
| 地图完成请求奖励／Story | Result 请求资源、好感、Area或Story入口 | GameInstance 结果事务 E5；局内Effect不直接写主世界 |

## 4. 原语候选目录与职责

以下 op 名是候选，未实现项不得作为当前合法 Schema 发布。读写只在 MapRun 独立规划状态；“当前支持”不表示已有该新字段。

| 家族／推荐表达 | 实际效果与读写 | 当前能力、阶段 | 必须验证 |
| --- | --- | --- | --- |
| hpChange(unit,delta) | 有符号变更单位HP，读cap，0HP不复活 | 原hpEffects，E1统一表达 | 截界／0HP／实际delta |
| damage(unit,amount,type?) | 扣HP，未来经盾／减伤 | 底层有HP减少，独立语义E2 | 非负量、护盾次序、不当成heal负数 |
| heal(unit,amount) | 恢复存活单位，返回实际恢复 | 底层有HP增加，独立语义E2 | cap、满血0、禁止复活 |
| revive(unit,amount) | 专门复活倒地友方 | Task 0320 U21 已实现 AG-1 倒地 Party primary 复苏与实际 Receipt/Restore 回放；E1/legacy 不变 | 合法目标限 Party；后序 Prepared 来源在原队列位置重验，已 skip 来源不回插 |
| resourceChange(account,key,delta) | Actor／Team局内余额增减 | 原effects，E1 | 帐户、声明、负余额／溢出 |
| Counter.add(id,delta) | 有界整数进度；可读比较 | 未实现，Encounter E1／MapRun后续 | 声明初始值、范围、生命周期 |
| Flag.set(id,bool) | 设置／清除布尔事实 | 未实现，Encounter E1／MapRun后续 | 声明、false不是任意删除键 |
| Status.add/remove/consume/category | 层数、时长、按 ID 消费／清除、按显式类别全清及单次伤害保护 | `burn` / `regen` 的 `statusApply` 与 roundEnd 已由 Task 0318 实现；Task 0320 U16/U19/U20/U27 已实现 AG-1 按 ID 全清、部分层数消费、类别净化与 `damageProtection`；U23/U24 为 primary 实际 Heal/Damage 增加局内资源 Trigger，U26 支持自然到期 holder 资源回馈；U30 已实现 Party MapRun-lifetime Status；其它 Status 持有事件、Modifier 与 Trigger 仍在 Task 0320 | 来源、重施、上限、结算顺序及清理 |
| Shield.add | 先吸收伤害的独立额度 | Task 0320 U18 已实现 AG-1 Shield 账本及 damage→Shield→HP 次序 | 不与HP混用，消耗及到期 |
| Modifier | 修改伤害／治疗／费用等指定计算 | 仅sCost窄例，E4/E5 | 加乘顺序、上下限、冲突 |
| prepare.discountSCost(card,n) | 当前实际卡Actor sCost成本减少 | 原scostDiscount，E1保留 | CardRef、来源时机、叠加截0，不动PlayerCost |
| Card effect modifier | 某真实卡指定效果加值 | U17 已实现唯一顶层 damage/heal amount 的 signed delta 首片；其它路径和位置待合同 | 效果静态path、回合清理、不能改已执行来源 |
| Position.move/swap | 领域阵位／邻接改变 | 未实现，E5 | 容器／位置身份，不读DOM |
| RunItem.add/remove | 本局临时物品，不是AC背包 | 未实现，E5 | 数量／权限／支付与回执 |
| Environment value | 环境变量或局内对象属性 | Counter/Flag可做基础，独立环境E5 | scope不越出Owner，影响明确 |
| sequence／when | 顺序／条件组合，不是状态实体 | 未实现，E1 | 顺序、读取通道、节点预算 |
| forTargets／repeat | 对有限集合／有限次数执行 | U12 实现确定性、有限嵌套语句体循环与 loopTarget 词法身份；Task0316 的单条 damage/heal repeat 保持独立 | 快照集合、去重、展开预算和 Trace 由 Task0320 U12 Receipt 记录；连锁仍属E5 |
| TargetSet／Value | 选择存活群体、按缺血／人数算量 | 确定性及随机 TargetSet、有限 HP/Counter/Round/count Value、来源起点 Actor/Team 资源余额 Value/条件已实现 | 随机流与 Hand RNG 分离；额度与来源时点见 Task0320 U08/U12/U13 Receipts |
| Action资格／Cost | 谁可用、可付什么 | 资格及固定资源Cost已有，扩展E2/E5 | 入场／准备／提交重验；Cost不藏在普通effect |
| EndCondition | 何时结束Encounter | 目前Battle清场／全灭、Rest轮数／manual；non-battle条件E1 | 优先级、只读判断、整轮一次收敛 |
| 外部 Result Request | 终局请求AC奖励／解锁 | 未实现，E5 | 双Owner原子性、请求幂等、发布时机 |

数值 change、Counter 和环境整数可以共享算术，但不能共享任意字段路径。Counter有明确语义寿命，资源有支付账户，HP有cap与倒地；Shield/Revive有不同规则。TargetSet、前后排、邻接归Target；资源足够归Cost／Condition；结束归EndCondition；奖励回写归Result事务，不各造一个通用Effect冒充。

## 5. 推荐最小 E1 合同与费用次序

已批准的E1合同在Task0312独立列出；批准依据与未采用备选统一见§11。规则版本 `E1-COMPAT-1` 保留旧调度；独立敏捷版本 `AG-1` 见§13。两个版本的P1–P8均已获批，尚未实现。

### 5.1 作者能写什么

新增 action.effectProgram，含准备期固定 sCost 折扣与结算期 sequence。sequence 允许 hpChange、resourceChange、counterAdd、flagSet、when（可选else）；受用对象限 source、primary、sourceTeam。when 只读 HP／HP比率、当前 Encounter 的已声明 Counter/Flag，允许有界 all/any/not，不读资源余额、Card Tag或其他行动中间结果。

E1 不提供通用算术 Value、forEach、随机目标、无限 repeat、Status、外部状态路径、MapRun Fact、PlayerCost增减、Action自定义使用条件、第二个玩家主目标。多个固定效果可以显式列出；如两次攻击，不需要先实现循环。

### 5.2 为什么首期不让条件读资源余额

现有结算先在独立状态中规划角色 HP 及自动目标是否跳过，再计算此次真正参与的费用，资源变化在费用后应用。如果立即允许“付费后还剩多少资源”影响伤害，伤害又影响后续行动是否跳过，后续行动又影响总费用，就会形成循环求解。

推荐 E1 保留现有顺序：HP／Counter／Flag 在有序规划通道即时变化，resourceChange 生成有序资源账本；确定实际来源及费用后，从**起始余额减费用**，再按账本顺序应用资源变化。E1 条件不读取资源，所以两通道不互相决定，既不引入反复试算，又不让本轮收益支付本轮前置费用。解释器产生一个计划与一份有序结果，不向真实状态先写一半。

“顺序”因此有明确首期边界：后一个 when 能看到先前 hpChange/Counter/Flag；同账户的资源增减严格按程序顺序结算；但不能写“先加资源、再检查资源”的条件。E2 要开放这种写法，须先裁定新的费用保留／跳过政策，而不是默默放宽语法。

E1以兼容旧费用为工程边界，不把支付重写列为E1必选问题。独立AG支付备选及可观察差异见§13的D02-AG；资源条件仍留E2，不能因采用敏捷就自动开放。

### 5.3 条件读哪个时刻：可理解的例子

目标HP=4/max10，程序“治疗3；若HP不足一半，再加Team物资1”：

- 按卡开始前快照读条件：仍看4，得到物资。
- 按执行到该条件时读规划状态：看7，不得物资。**推荐后者**。

作者若要“治疗前受伤就奖励”，应把条件放在治疗之前并在同一 when 内列治疗与奖励；不是让引擎自动猜“成功治疗”。实际治疗量、击杀归属、先前命中数另是结果条件，E1 不支持。

### 5.4 目标、数值、错误、预算

- 玩家主目标保存真实单位／CardRef。来源开始时在规划状态按既有自动偏好重核；显式目标不悄换，program 内 primary 固定为该来源最终解析身份，不每个effect重选最低HP。
- 提交前外来失效／伪造／跨轮引用拒绝整轮；合法目标在同轮被先前行动打倒，沿旧 HP=0不复活／实际delta0语义处理，不能突然改成随机换人或全部回滚。自动目标的既有 fallback 独立保留，E0用金样确认。
- E1 无集合，最多单个unit／card；self仅有实体行动者可用，Ability/Item 无actor时禁止source单位／actor费用，Team受用方由来源适配明确，不因enemy/party同ID串帐户。
- 普通数值使用安全整数，hpChange/resourceChange/counterAdd 为非零有符号整数，折扣为正整数，布尔为真bool。聚合用安全计算（必要时BigInt），不接受小数、NaN、Infinity、任意路径和eval；HP截0..cap，余额不足拒绝。Counter按已批准D03饱和到声明界限，严格拒绝为未采用备选；安全整数算术溢出始终拒绝，折扣仅截原始成本。
- D08工程默认：单program静态节点64、深度4、prepare叶子8，Encounter Counter/Flag共64，整轮新程序访问4096；精确计数见§11。额度不是玩法审批项，不追溯套用旧数组而破坏兼容。
- Task0316已采用并实现：TargetSet最多32目标、repeat最多8、每来源展开最多1024（同时受整轮4096 visits约束）；所有预算同时算，不允许“每层都合法、乘起来爆炸”。当前没有静态 program引用和递归；未来引入共享片段须检测引用环。

### 5.5 Counter/Flag 与结束条件

首期只给 Encounter 定义 locals.counters（id/initial/min/max）和 locals.flags（id/initial），状态在 MapRun.activeEncounter 持有。进入新Encounter／Node activity重新初始化，同Encounter推进轮次保留，checkpoint保存，退出Encounter清理；最近Receipt可保留旧变更摘要，不保留一份还可写的旧locals。

D03已批准Counter饱和，例trust=2/max3连续两次+1，实际变化为+1、0，终值3；0/min0再−1也保持0。严格拒绝备选会令上述整轮零安装。initial/min/max显式必填且必须合法；Flag initial显式bool，重复false→true→false依次可见。生命周期与布尔校验属于工程合同，无需另行玩法审批。

non-battle completion 增加 condition 分支，使用同一受限局内条件；与固定rounds/manual互斥，Battle暂不接此新分支。全部己方来源和费用／资源合法完成后检查一次，达标沿 advanceCompletedActivity 推进，不由 effect直接finish。全队倒地仍优先失败；不在program执行到一半时截断其他已付费行动。这样交涉／休息确实可达标结束，不仅“卡面说增加信任”。

## 6. E2 集合、Value 与后续 Card 合同

### E2：集合与表达式（当前确定性子片由 Task 0316 实现）

主目标在准备时保存；效果集合在执行到该语句时从独立规划状态求值，**一次解析、固定列表**。Task0316 的 damage/heal TargetSet 使用 Party roster / Encounter Enemy 定义顺序；HP排序以整数交叉相乘比较比例，同值保留领域顺序；过滤后去重。最多32名，显式 limit 在过滤／排序后截取；省略 limit 且候选超32则拒绝。默认 living，`all` 可显式含倒地单位；合法空集合无效果并记录0受用方。每名目标依次完成其 repeat 命中，后续命中读取已更新 HP。主目标和集合身份分别处理，集合不会替换 CardRef 或 Action target。

E2 后续合同现已由 Task 0320 冻结并实施：随机 TargetSet 无放回，候选不足时按实际人数执行；独立于 Hand RNG 的 Effect RNG 由 MapRun Owner 持有，Preview 克隆游标、成功 Commit 安装，Save/Resume 与 AG-1 Restore 可重放。有限语句体 `forTargets` 支持有界嵌套与词法 loopTarget 身份；资源余额 Value／条件读取来源开始时扣费后的 Owner 工作余额，不能读取自身尚未结算的奖励；`additionalTarget` 要显式选择一个非 CardRef 的领域单位，追加目标侧资源写入进入同一 detached 账本。具体边界及 Receipt 证据见 Task 0320 的 U08–U14 Receipts；U14 屏幕验收需求单见其 U14-screen-acceptance-report。

当前Value支持常量、source/primary/target HP/cap/missingHP、Counter、Round、目标集合人数及add/sub/mul/divFloor/min/max/clamp/abs；不含Actor/Team资源余额，也没有属性名字符串访问。所有中间值为安全整数；除法向负无穷取整（例−3/2→−2），除0、越界拒绝，作为伤害／治疗量时不得为负。Value节点和深度分别受界限。资源余额Value／资源条件须先冻结费用政策，否则源资格、资源状态和费用扣除相互依赖，形成循环求解。

damage/heal作者语义分离，内部共享HP账本；此时尚无盾则damage直接减HP，heal不复活。复活和真实护盾另排。已倒地目标纳入revive集合须显式过滤，普通医疗不自动选择。

### E3：静态 Action Tag 与候选池（Task 0317 已实现）

- Action、Candidate、Hand、Prepared、CardRef、Ability/Item来源和UICard继续各有职责。候选池只组织候选及权重，在现有 Hand 抽取前展开；不成为第二份Hand或永久库存，也不复用旧 Operation `CardPool`。
- Action 用完整跨包 `TagRef` 声明静态 `tags`；候选池 Tag 查询沿用 `src/engine/core/tag.ts` 的同 namespace 层级前缀匹配。TagDef 只补充展示／层级信息，不是 Action Tag 引用的前置条件；裸路径没有默认 namespace。Tag 只分类与匹配，`explosive` 不会自动触发范围伤害。
- `GameplayMapDef.candidatePools` 是 Map-local 有序定义，入口可按 Action、Tag 或嵌套 Pool 提供候选。Character／Enemy 保留直接 `actions` 并新增有序 `candidatePoolIds`；先展开直接候选，再按 pool、entry、Map Action 定义顺序展开 Tag。相同 Action 合并为一个候选、权重累加并固定首次出现位置；展开后权重超出安全整数范围拒绝。合并后仅执行一次既有资格／费用／目标筛选、Tendency 调整与 Owner RNG 无放回抽取。具体闭合合同和示例见 [[docs/plan-work/task-0317-gameplay-b-static-tags-and-candidate-pools]] 与 [[docs/examples/gameplay-b-card-tags-and-pools]]。
- E3 只提供静态候选来源。动态 Tag、Prepared 来源选择／修正、成长注入和跨 Map Pool 留到后续子题；这些都不是旧 Operation 同名能力的自动接线，后续统一由 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] 跟踪。

### E5：高级组合与 Adapter

- Prepared Tag 连携首片已由 [[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]] 实现：`preparedTagCount` 读取每轮开始冻结的 Party 实际准备来源 Tag 集合。每名 Party Character 只贡献一个有效准备 Action；已选 PlayerCommand 算入，Wait、未选候选、Ability／Item、Enemy Intent 与 UI 重复展示不计。完整 TagRef 按既有同 namespace 层级前缀规则匹配，每个来源最多计一次。
- H 连携样例先执行基础伤害，再在 `when(preparedTagCount >= 2)` 分支追加 1 点普通 `damage`。该分支仍在当前有限 Effect Program 内顺序执行，不产生事件回调、递归或额外结算队列；Receipt 按提交的 Party settlements 和 Map Action Tag 独立重算快照。
- 相对 CardRef 仍是待裁定子题。旧提议曾以同 Owner Hand 的 previous／next 作为目标，再复用 `discountSCost`；但当前每名 Owner 每轮只准备一个行动，邻接目标通常没有当前轮的受用来源，因而这一组合不能保证玩家可观察的费用变化。不能将其登记为已实现，也不保留 Task 0319 相对 CardRef 路由。未来需先定义明确的受用时点与效果，再冻结相对选择、合法性重验和 Receipt 证据。
- 效果 Modifier、交换顺序、复制／生成／移除 Card、战术位置、临时 Item、成长快照和外部 Result Adapter 仍待裁定与实施，统一由 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] 跟踪。伤害／治疗修正拟按 effectPath 与类型应用于尚未执行来源；同层加法后乘法再 clamp 仍待冻结。来源或目标离开本轮时清除，不反改已结算来源或 Receipt；循环和无界复制必须拒绝。
- U25 已为既有 `healApplied`/`damageApplied` 资源 Trigger 实现 `minimumActualAmount`：按最终实际 HP 变化比较，低于门槛不入队、不记 Trigger Trace、不占预算；不构成击杀归属、累计命中或通用结果条件。合同与演练见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U25-e5-actual-amount-trigger-threshold-contract]] 和 [[docs/examples/gameplay-b-actual-amount-threshold]]。
- U28 已为 directed Edge 增加单项 AG-1 MapRun Counter / Flag 门控；路线读取当前 MapRun 状态，候选池仍保留 Encounter 入场快照语义。合同和示例见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-e5-maprun-fact-edge-gates]] 与 [[docs/examples/gameplay-b-maprun-fact-gated-pools]]。

## 7. E4 持续状态、修正和触发的最小方向

首片已由 [[docs/plan-work/task-0318-gameplay-b-encounter-statuses]] 冻结并实现为单位持有、Encounter-local 的 `burn` / `regen`，通过 Map `statuses` 与 Action `statusApply` 声明；新状态从施加后的下一轮 roundEnd 首次触发，状态结算、回执重放、存档恢复与只读显示已接通。Task 0320 的 U16/U19/U20 已依次实现 AG-1 按精确 ID 全清、指定层数消费与按显式 `harmful`/`beneficial` 类别全清；Status Receipt v2/v3/v4 按 Map 作者语义独立于 scheduler 版本重放，E1/legacy v1 路径保持。类别不会从 Status `kind` 或 UI 样式推导，未分类实例不匹配类别净化。Task 0320 U21 已实现 AG-1 `revive`、倒地 Party primary 选择与后序来源资格回放。U22 新增 `damageReduction` Status：每层固定减免 AG-1 damage request，在 Shield 吸收前按目标/每次 hit 应用；轮末只推进 duration、不改 HP。含该状态定义的 Map 使用 Status Receipt v5；U18 Shield 顺序、E1/legacy 路径保持。U23/U24 增加有限同来源 `healApplied`/`damageApplied` 队列：仅 primary HP 实际增减触发，primary Actor 获得 MapRun 资源回馈；Shield 全吸收或最终 HP 不变时不触发，两类事件共用 32 次 Commit 预算和独立 Trigger Receipt v1。U26 为自然 roundEnd 最后 tick 增加 holder 资源回馈；按 Status Trace 排在 Action Trigger 后并共用预算，以独立 Trigger Receipt v2 重算恢复，不伪造 Action 来源。U27 已实现 `damageProtection`：正向 AG-1 damage hit 消耗一层并在 damageReduction/Shield 前拦截，Status Receipt v6 与保存恢复重放接通。Task 0320 U30 已为 Party 增加显式 MapRun-lifetime Status：Root Owner 跨 Encounter/Shop 保存恢复，Status Receipt 与 scheduler v7 重算；其他 Status 持有事件与 Modifier 仍由 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] 跟踪。作者字段和演练见 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/examples/gameplay-b-statuses]]、[[docs/examples/gameplay-b-revive]]、[[docs/examples/gameplay-b-damage-reduction]]、[[docs/examples/gameplay-b-damage-protection]]、[[docs/examples/gameplay-b-status-expiry-reward]]、[[docs/examples/gameplay-b-maprun-status]]、[[docs/examples/gameplay-b-heal-applied-resource]] 与 [[docs/examples/gameplay-b-damage-applied-resource]]。

一次性Effect发生即结束；Status是持有者身上的层数／剩余轮数；Modifier只参与明确计算点；TriggeredEffect在明确时机安排有限程序。可以由同一个MapRun计划器处理，不需要四个新引擎。

Task 0320 U25 将结果门控限于现有实际 Heal/Damage 事件的 `minimumActualAmount`；比较在 HP cap、DamageReduction 与 Shield 结算后完成。U26 已为自然 roundEnd 最后一次 Status tick 实现窄 `onExpire` holder 资源回馈；其他 Status 持有事件仍未实现，U25 不把 Action Trigger 扩展为 Status 订阅。

Task 0320 U30 为 `GameplayMapStatusDef` 增加可选 `lifetime: 'mapRun'`。此寿命仅允许 AG-1 的 Party Action 直接来源创建 Party holder 实例；状态唯一存放于 `MapRun.mapRunStatuses`，活动 Encounter 通过只读投影合并本地状态读取。Shop、节点与 Activity 转场不扣时长；每个成功的非终局 Encounter roundEnd 最多 tick 一次。Status Receipt v7 和 scheduler v7 重算 Origin、双 Owner 分区、tick Trace 与最终根状态，旧 Status v1–v6 / scheduler v5–v6 保持原格式。样例及合同见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U30-e4-maprun-status-contract]]、[[docs/examples/gameplay-b-maprun-status]]。

Task 0318 已完成首片：只支持单位级、Encounter-local、roundEnd 的 burn 与 regen；duration 以**成功 Commit 后的 Round 边界**计，不按 AC Tick 或离开页面的时间计。Round N 施加的新状态从 N+1 的 roundEnd 首次触发；同状态同来源重施刷新时长并按定义上限加层，不同来源分别持有。状态应用与 tick 进入 MapRun 同一 detached 回合计划，失败不安装部分 HP／状态。普通来源已结束 Encounter 时跳过 Status tick；否则 tick 后检查失败优先的终态。实际 Encounter／Run 终局时清除活动状态；tick 后才终局的 Receipt 保留结算后的历史状态列表供重放，普通来源先终局的 Receipt 则以空状态列表和空 tick trace 表示跳过。数值、倒地目标和稳定顺序依据见 [[docs/plan-work/task-0318-gameplay-b-encounter-statuses]]。实屏／浏览器验收按用户指示豁免，组件行为验证已完成。

首片只验证状态时间与 HP 的确定性闭环；Shield 已由 U18 完成，净化／层数消费由 U16/U19/U20 完成，U22 另完成回合限时 damageReduction，U26 完成自然到期资源回馈，U27 完成单次受击保护与 Status v6 Restore。MapRun-lifetime Party Status 已由 U30 实现；其他 Status holder 反应触发与 Modifier 仍由 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] 统一跟踪。到期顺序按 Status 单独定义，不能由通用 AC Affector 或 Tick 推断。

Encounter-lifetime Status 默认随 Encounter 清理；U30 允许 Map 显式声明 `lifetime: 'mapRun'`，并将 owner、来源、时长和跨 Encounter 时钟写入 Save/Receipt。护盾不是HP，减伤链须明确damage前、盾先后以及实际伤害0是否触发。

反击／受治回馈后片只开放 damageApplied/healApplied 等闭合事件；事件记录先排入同一个计划队列，来源不可重入同一链。建议链深4、单Commit追加32次，超预算拒绝整个计划；不能让发布AC EventBus回调在安装中继续写Run。失败时Status／资源／HP／游标全不变。更复杂onExpire和连锁到E4后段／E5。

## 8. AC 外部能力：逐项接线边界

| 能力／当前文件入口 | MapRun当前真实使用 | 可复用与后续边界 |
| --- | --- | --- |
| EffectEngine：`src/engine/effect/effect-engine.ts` | 未作为局内解释器 | 可参考声明式op与校验；现execute走MutationPort／runtime handler，不用于Preview写MapRun |
| ConditionSystem：`src/engine/expression/condition-system.ts` | Spot条件、Consumable useCondition | 可复用比较／逻辑组织工具；当前ConditionState资源/flag是AC状态，不能伪装MapRun或开放任意target |
| Affector／Trigger／EventBus：`src/engine/effect/` | 未参与MapRun局内持续状态／回合驱动 | 参考生命周期治理；局内Round独立，跨Owner事件只能安装后发布 |
| Resource／GameNum：`src/engine/` 与 AC数值服务 | 局内余额不在AC ResourceSystem | 可复用安全数值工具／公式经验；兑换、初始输入、终局奖励需显式Adapter／事务 |
| Character／Variant：runtime-game-instance.ts admission | 已校验持有、解锁并冻结身份 | 当前不是培养数值快照，不要因有variantId就显示培养战力 |
| Cultivate／Gear／Skill／星级／好感／专武 | 未导入局内HP／Action／权重 | 未来Tactical Adapter在GameInstance入场读取白名单、版本化冻结数值／资格／Pool来源；Preview不反复读成长状态 |
| Inventory／Consumable：commitMapEncounterRound | 已有mapped Item Action与库存扣1的双Owner计划 | 沿prepare/recheck/install/publish，不执行ItemDef.useEffects；本局临时物品独立 |
| Shop／Transaction：MapRunService shop与AC ShopService | Map Shop已有固定局内Offer；非AC商店 | 可复用校验／幂等经验；不要直接调用AC Shop扣持久资源 |
| Story／Talklet／Flow：MapFlowModel、共享渲染 | 展示流共用，不等于Story运行 | Counter信任不是好感；叙事／约会要通过独立结果接口，不直接startStory或改storyLog |
| Save／Snapshot：map-run-service.ts、runtime-save-codec.ts | active Run独立checkpoint | 接locals／trace／version，清档或拒绝不兼容；不写迁移兼容层 |
| PackManager／Registry／Schema：data-services、gen-engine-schema | Map表及引用／静态效果校验已接 | 新program必须贯通真实Datapack和生成Schema；不因Schema存在就宣称复杂编辑器已可用 |

外部结果建议为版本化MapRun Result请求，由GameInstance验证奖励／库存／成长等参与Owner、生成安装计划、全部canInstall通过后无回调连续安装，再发事件，以runId/resultRequestId去重。普通局内op不接收AC resourceId/StoryId写入路径；Result不能伪造长期奖励。这是E5方向，不扩展当前Consumable事务为万能事务服务。

## 9. 八张代表卡：普通中文先行

### A 普通射击（旧能力兼容，E1）

卡面：“对一名敌人造成3点伤害。”角色使用，主目标存活敌人；固定弹药1。效果为primary HP−3，底层原hpEffects已支持；E1把旧字段编译为相同hpChange。测试：扣弹药一次、HP不低于0、两次Preview无写入、旧与新规范化结果等价。

### B 掩护射击（不同受用对象与顺序，E1）

卡面：“攻击一名敌人，随后自己恢复1点弹药。”角色使用，主目标敌人，费用Actor弹药1；先primary HP−2，再source弹药+1。现有两类效果已有，顺序程序待建。最终弹药可不变，但起始没有弹药仍不能发动。测试：资源返还不能资助本轮费用、实际HP与source账户正确、故意删资源声明在装包阶段报Action/path。

### C 紧急包扎（条件组合，E1）

卡面：“治疗一名队友3 HP；如果治疗前HP不足一半，再增加1点队伍物资。”角色使用，主目标存活友方，费用Team医疗1。推荐程序先when(primary HP比率<1/2)执行hpChange(+3)＋Team物资1，else只hpChange(+3)。**推荐E1允许when带可选else，仍是同一有限分支；若不采纳，须重新设计此样例，不能擅自加入临时状态绕过合同。**测试：4/10→7/10并物资+1，5/10→8/10且不加；不是治疗后再测，也不是满血返物资。当前HP恢复底层有、条件／程序待建。

### D 范围爆破（真实集合，E2）

卡面：“对所有存活敌人各造成2点爆破伤害。”角色使用，无需额外逐个点目标，付炸药1；解析一次稳定的存活敌人集合，逐个damage2。确定性 TargetSet 与 damage/heal 已由 Task0316 支持；测试覆盖倒地过滤、声明顺序／比例排序稳定、候选空集、数值边界和超预算拒绝，不依 UI 排列。资源费用仍用既有 Cost 合同。

### E 临时强化（真实CardRef与费用阶段，E1保留／E5扩展）

卡面：“使另一张合法卡牌本轮的sCost费用减少1。”角色使用，主目标实际可受用CardRef，演示费用为自身coordination1；prepare.discountSCost1，resolve可为空。现有scostDiscount已支持，E1只规范化；“治疗量+2”是E5另一个版本。测试：同Action不同Owner不串、过期round拒绝、未prepared但合法Hand目标按原规则呈现但不冒充已执行来源、多个折扣截0、不减PlayerCost、敌方后续来源折扣顺序保留。

### F 交涉／休息（同一体系，E1）

卡面：“认真交流，使本次交涉信任+1；达到3点时完成交涉。”角色使用，无单位主目标，无费用，Counter trust初始0；counterAdd1，non-battle completion检查trust≥3。推荐D03饱和方案可直接用max3；为比较严格拒绝方案，单来源样例两者均可达第三轮完成，多来源越界差异另用trust2连续两次+1推演。也可将trust换readiness作休息。待建locals和condition completion，沿当前非战斗Round／推进机制。D05推荐前两轮不结束，第三轮全部来源合法完成后只推进一次；新Encounter重置，保存trust2恢复后仍需1次，不写好感。以上采用用户已批准方案，仍须后续产品测试验证。

### G 灼烧与引爆（未来，E4／E5）

卡面：“附加2轮燃烧；另一张引爆卡消耗燃烧层数并造成额外伤害。”角色→存活敌人；前者付火种1，Status.add；后者付弹药1，原子消费层数并damage(2＋层数×2)。不属于E1。测试：重施来源、N+1触发、消费后层数、Save时长、零层行为、失败不半消费、不得Tick推进。

### H 连携攻击（未来，E5）

卡面：“若本轮准备了至少两张爆破卡，追加一次支援攻击。”Task 0319 已交付 Party-only `preparedTagCount`：从每名角色本轮实际有效 `preparedActionId` 冻结一次，已选 PlayerCommand 计入，Wait／未选命令／Ability／Item／Enemy Intent／UI副本不计；每个来源按完整 TagRef 只计一次。程序先普通伤害2，再由 `when(count >= 2)` 顺序追加1点普通伤害；不创建递归追加链。测试覆盖层级 Tag 匹配、每角色只计一次、命令替换自然准备、单张不触发、回执按 Party settlement 重算及篡改拒绝。完整语义见 [[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]]。

以下只是**拟定作者表达**的两个短例，不是当前可直接导入JSON；外层仍需现有Action资格、target和costs，资源在初始声明中以0或正值声明。

```json
{"effectProgram":{"resolve":[
  {"op":"hpChange","unit":"primary","amount":-2},
  {"op":"resourceChange","account":"sourceActor","resourceId":"ammo","amount":1}
]}}
```

```json
{"locals":{"counters":[{"id":"trust","initial":0,"min":0,"max":3}],"flags":[]},
 "completion":{"kind":"condition","condition":{"counter":"trust","comparator":">=","value":3}}}
```

## 10. 分阶段路线：每段独立可验收

| 阶段 | 目标／最小作者样例 | 依赖与主要位置 | 非目标／测试与完成条件／遗留 |
| --- | --- | --- | --- |
| E0 合同审阅 | 核实B/C/F和旧卡，形成费用、通道、目标、预算、敏捷推荐与决策表 | Task0313 U1–U5；本Draft＋Task0312 | 文档完成可早于玩法批准；只设计，不把E0完成当产品准入 |
| E1 基础程序 | 顺序、when/else、HP/资源、Encounter Counter/Flag、non-battle结束；A/B/C/E/F | E0；gameplay-map、map-run-service、map-card-effects、Registry、ReadModel、Save | 不做集合/随机/Status/Pool；Task 0312 的 U18 浏览器验收已豁免，故施工流关闭不代表产品验收通过；AG-1 与 E2–E5 尚未完成能力统一见 Task 0320 |
| E2 集合与Value | 确定性/随机集合damage/heal、受限Value、repeat与语句体循环 | Task0316、U12–U14 已实现，含资源余额条件、MapRun Facts、显式additionalTarget与 Receipt/Save/Restore | U14 运行态自动化433/433通过；实屏限制与剩余项见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] |
| E3 静态Tag与Pool | 多来源候选合并、Fact 门控静态 Map-local Pool；Tag不自动爆破 | Task 0317 已实现静态来源；U15 已实现 MapRun Fact gate、Encounter 输入快照与 scheduler v5 Restore 重放 | Prepared筛选、成长／临时注入、动态Tag和跨 Map Pool 按 U15 明确延期/不纳入裁定，见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] |
| E4 状态与修正 | 首片 burn/regen 的 Encounter-local 状态与 roundEnd 结算；Task 0320 U16/U19/U20/U21/U22/U23/U24/U26/U27 已完成 AG-1 Status 清除/消费/净化、Revive、伤害减免、一次性保护与 Heal/Damage 资源触发；Shield/damage pipeline 见 U18 | Task 0318 已完成 Status Apply 合同与回合边界；Task 0320 U16/U19/U20/U21/U22/U23/U24/U26/U27 分别增加 ID 清除、层数消费、类别净化、`revive`、damageReduction、闭合实际 HP 事件、自然到期 holder 回馈与 damageProtection；Status v6 Restore 重算并拒绝篡改，E1/legacy v1 路径保持 | 已完成 burn/regen、Shield/damage、Status ID 清除、层数消费、类别净化、Revive、damageReduction、damageProtection、primary Heal/Damage 回馈与自然到期 holder 回馈；U30 已实现 Party MapRun Status 跨 Encounter 寿命；其他 Status 事件与 Modifier 仍由 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] 跟踪；不代表 E4 整体完成 |
| E5 高级组合／Adapter | H、相对Card、战术排位、结果条件、临时Item、成长快照／外部结果 | Prepared Tag 连携首片由 Task 0319 完成；U17 CardRef 修正、U25 实际 HP 门槛、U28 Fact Edge 门控与 U29 单体击杀回馈由 Task 0320 完成；其它范围仍在统一 Task 裁定 | Task 0319 与 U17/U25/U28/U29 均不代表 E5 整体完成；统一 Task 继续冻结、实施或明确延期剩余合同并以真实 DataPack 证明；不预建统一脚本／万能事务 |

AG-1 与 E2–E5 的未完成范围仍由 Task 0320 统一跟踪；U14/U15 与 U16–U27 的已实施首片不代表 E2–E5 整体完成，其他候选能力仍须依 Task 逐项冻结、实现或明确延期。E1 实施流另见 Task 0312；U18 验收豁免不由 Task 0320 重开。执行方不能把本文候选 op 直接当成已批准功能开工。

## 11. E0裁定记录：推荐优先，玩法与工程分开

本节保留 E1 最初批准的语义合同；后续 Task 0315 已更新 HP 原语与旧 Action 字段准入。需要实现现状时，以本文件开头的“实现状态与当前路由”以及当前数据契约为准，不把历史施工兼容路径当成当前合同。

来源：Task0313 A01–A06及U1源码证据；2026-10-21用户本轮要求“对每个待批问题，优先给出一个推荐默认方案及其可观察结果”“不要把纯粹的内部实现细节全部升级为用户审批事项”。批准记录：用户于2026-10-21在本会话回复**“全部按推荐”**，对应上一答复及Task0313 §9.2决策表P1–P8全部推荐；覆盖D01/D03/D05、D09/D10/D11的Actorless补足及D02-AG/D02-DISCOUNT/D04-AG/D05-AG。以下这些条目的推荐现为已确认合同，备选仅留作未采用方案的审阅记录。此批准不扩展E2–E5或代表产品已实现。原Unit中要求每项都列2–3方案的写法，以本轮用户要求为准。工程默认是执行方在已授权设计范围内的技术裁定，仍须后续产品Unit实现和验证。

### 11.1 D01–D08：E1已批准合同与工程默认

| ID／状态／阻塞 | 推荐默认及可观察结果 | 未采用的实质玩法备选（留档） | 证据与理由／用例 |
| --- | --- | --- | --- |
| D01 已确认；E1及AG | 在when所在位置读当前HP/Counter/Flag；可选else；E1不读资源。4/10先heal3再判半血→7/10、物资0；guard先判→7/10、物资+1；5/10两者均无奖励 | Action开始快照读值：先heal再判仍奖励+1；若要求资源条件则须另扩E2支付合同，不作E1备选 | 当前无when，U1仅证明HP规划次序；按作者书写顺序可预测。NEW01、NEW04 |
| D02 E1兼容为工程默认；AG支付已批准见§13 | E1保留起始己方聚合预检及Enemy逐个当时余额支付；己方补给不能资助同轮费用；Command无目标仍付PlayerCost，Ability/Item有效选中仍付费/扣1库存，即使HP实际0 | E1不重新开放旧支付；如要统一支付，进入独立AG版本，不能伪称等价重构 | U1阶段/费用矩阵与source-transactions；NEW02、EQ02、EQ04 |
| D03 已确认；E1及AG | Counter在安全整数加法成功后clamp到min/max。trust2/max3连续+1,+1→3，实际+1、0；min0当前0再−1→0；可重复写；Flag仅bool | 严格reject：上述任一次越声明界限使整轮拒绝、HP/费用/locals/库存均零安装；不首期增每Counter可选overflow字段 | 当前无Counter，非现有事实。饱和适合多人同时推进进度；安全整数溢出仍拒绝，不能用clamp掩盖。NEW03/04 |
| D04 E1兼容为工程默认；AG来源倒地已批准见§13 | 外来非法Scope/目标、stale整轮拒绝；起初合法的显式目标本轮倒地仍锁定，HP实际0且正常成本/资源效果；自动目标按当前HP fallback，无替补skip且Actor/Team免费，Command费保留；Actorless显式目标不自动换人 | 新AG来源倒地与终局后skip见§13；不额外要求用户重批旧显式/自动目标区别 | U1目标表、map-run-test显式/自动目标及Command用例。OLD02/03、EQ03/04、AG04/05/09 |
| D05 non-battle已确认；E1及AG | condition只在本轮全部合法来源完成后检查，失败优先；trust2/max3，首源+1，后源付Team1得奖励2→费用1、trust3、奖励2后推进一次。与rounds/manual互斥 | condition每来源后即时检查：首源达标即结束，后源不执行、不收费、无奖励；需相应跳过/退款新合同 | 当前只有rounds/manual；不由op移动Node。战斗E1维持己方整阶段再查、Enemy逐源查，AG另列。NEW05、AG10/11 |
| D06 工程默认；不另呈玩法审批 | 类型定义、局内resourceId字符串键、Owner余额分层；新program显式初值声明（可0），旧数组仍引用推导。每个Encounter/source上下文验证依赖，未声明、Actorless用sourceActor、同名Counter/Flag拒绝装载 | 无；不把更改错误诊断/字段摆放列成玩法备选 | Registry validateMapActionContent仅接knownCharacterIds/knownItemTypes，不查AC Resource Registry；initialResourceBalances。NEW06 |
| D07 工程默认；不另呈玩法审批 | 有界effectTrace、规则/格式版本、实际delta、guard受限读数；严格恢复和幂等；无迁移。排序补充见§13；Save后继续结果一致 | 无；不让用户选择trace内部存储形式 | U1保存字段/restore/事务表；EQ05、NEW07 |
| D08 工程默认；不另呈玩法审批 | 64节点/4深度/8prepare/64locals/4096轮访问；超额整轮零安装，路径诊断；旧数组不追溯加新program预算 | 无；未来性能数据可调整工程额度，不把额度大小列为玩家玩法选型 | 当前无program；静态所有分支与动态已走路径分开计数，详下。NEW07 |

D01推荐允许else、拒绝资源条件属于首期能力合同；它们不会再拆成用户必须逐字段批准的事项。D03不同时引入clamp/reject可配置系统。D05 Battle双方全灭以failure优先，延用当前优先级，AG同源完成后再判。

### 11.2 E1-COMPAT-1阶段表（P1–P3已批准，采用主方案）

| 相位 | 规则与读数 | 兼容约束 |
| --- | --- | --- |
| C0 读草稿 | 核Action/source/目标/Scope/版本，选中来源与Hand不变 | 无状态、库存、RNG写入；准备候选资格沿旧规则 |
| C1 准备 | 己方合法选中卡prepare折扣，常量相加截原Actor sCost | 不减PlayerCost；无条件，不读resolve结果 |
| C2 己方逻辑HP通道 | party Prepared依队伍顺序，随后Ability、Item；每source执行HP/locals/guard，resourceChange记账，primary在source开始绑定；Command费在skip前累计 | party能看到前一party；Ability能看到全部party；Item能看到Ability；新program不读资源。旧数组相位标签保留当前party HP→资源→Ability/Item HP次序，不把“顺序程序”误说成旧事实 |
| C3 己方费用/资源 | 按实际非skip来源聚合Actor/Team成本、Command/Ability费用，对起始余额预检；全部扣cost后依party→Ability→Item账本应用resourceChange | 正奖励不资助前置cost；新program在C2先决定guard，C3才兑现账本；账本负余额/溢出使整个计划失败。旧与新独立HP/资源操作的最终值、费用和Receipt必须等价 |
| C4 己方结束检查 | 已完成Ability/Item HP；failure→battle清敌→non-battle固定轮数/condition | condition采用已批准D05整轮后检查；E1战斗不在party中途截断Item |
| C5 Enemy | 按声明顺序；来源倒地、已有终局、无目标、费用不足分别skip；本源当时余额支付，再资源/HP；program在本源内部有序求HP/locals/guard并兑现资源账本，之后判终局 | 旧Enemy resource→HP相位保留；折扣仅给后续Enemy，不回改费用；Enemy可使用前序Enemy已回资源；无第二套旧executor |
| C6 安装 | 全部合法才经既有Owner token和GameInstance库存两阶段核对连续安装，再发事件 | Preview无安装；相同request重放零重复；任一无效计划零安装 |

新program的HP/locals通道和资源账本是同一纯计划的两个输出；C2不是先写真实HP。禁止条件/Value读资源，保证C2无需根据C3余额反复试算。E1只承诺受限制语法下的等价与可见次序，不承诺任意HP/资源混合语言。若实现金样发现差异，停对应迁移，而不删金样。

### 11.3 工程默认的完整边界

- **D03寿命与校验**：Counter的id/initial/min/max全部必填、safe integer且min≤initial≤max；允许有意声明负min。Flag id/initial必填、initial严格bool。加法先以安全计算得到数学结果，超±MAX_SAFE_INTEGER整轮拒绝，再做玩法clamp/reject；不是任意大数靠饱和通过。跨轮保留、新Encounter重置、checkpoint完整保存；未采用locals的旧图不强加新状态。
- **D06资源和上下文**：resourceId是MapRun局内键，不要求同名AC Resource存在。程序引用的sourceActor/primaryActor/sourceTeam余额必须由相应Map初始条目或Encounter Enemy初始条目声明，初值0有效；Actor资源键按现有规则对参与Actor物化，Team按阵营分池；安装必须遍历完整物化余额。Counter/Flag同Encounter共享名字域；资源有独立域，可同拼写但不得串账户。Action在Encounter A/B共用，而B漏trust→Registry定位B/Action/effectPath，不以A声明代偿。遍历所有可能引用source，包括未选中分支；Actorless保留无任何额外Action cost、仅unit主目标的资格限制，禁止source HP/sourceActor/self/card target；新program允许合法unit主目标的primary/primaryActor及来源party Team，逐上下文静态校验；新prepare替代旧cardEffects时同步card target有效性校验。Map-local Action仍不跨Map共享，未来跨Map复用必须声明依赖并逐上下文绑定，不在E1增加全局模板。
- **D07 trace最小字段**：programReceiptVersion、executionContractId；每个访问记录sourceKey/actionId、effectPath、语句种类、受用身份；变化记实际delta及必要before/after（Flag为bool），guard记结果及实际读到的白名单HP/cap/local值；0变化也留记录。费用/HP继续现有settlement投影，trace与分组互校，不能重复施加。仅保留最近成功轮，不保存全世界/函数/编译缓存。requestId、commandVersion/resultingCommitVersion、draftVersion及Scope仍沿当前幂等合同。
- **D07恢复能力**：从当前定义核合法path/op/常量/声明/分支、guard读数与计算、同字段before→after连续性、实际delta方向/截界、费用和库存最多一次；同Encounter尚存在时，对可核字段的末值与checkpoint互校。已退出Encounter仅能核前一轮摘要内部一致性与定义，不能从下一Encounter快照证明前一轮所有真实历史，也不声称防住协同伪造的完整历史。损坏path/局部链/规则或格式版本/缺locals/Scope拒绝；内容不兼容提高resumeVersion，save codec版本按产品改动同步，不写旧档迁移器。terminal result当前不落存档，不借E1新增历史Owner。
- **D08计数**：program静态64 = prepare叶子+resolve语句（含when本体）+条件树每个谓词/逻辑节点；then与else全计，数组容器不计。resolve根深度1，进入when子列表+1；条件树根1，每嵌套逻辑+1，两种深度各≤4；prepare另≤8。locals是counters+flags声明总数≤64。动态4096累计整轮所有新program来源：每访问一条语句、一个条件节点、一个prepare叶子计1；短路条件未访问节点不计，未执行分支/skip source的resolve不计；预处理只计一次。旧数组规范化仍用原有内容校验，不把新64/4096追溯限制到旧图。预算耗尽整个detached plan拒绝，不保存截断trace，不装HP/locals/费用/库存/RNG；Task0316另对每来源最多1024 E2展开单位、每集合最多32目标、每条 damage/heal 最多 repeat8。
- **D12先后**：工程推荐E0→E1-COMPAT-1→独立AG-1，后者复用已验收的原语、trace、局内状态和Owner接线；允许并行讨论，不同时改同一planner/restore。用户后续明确要求排除E1 U18并统一推进其余未完成项，因此AG-1已并入Task 0320；只更新实施路由，不重裁合同或表示U18验收通过。

### 11.4 后续范围

AG-1已批准合同的实现，以及Status触发后片、动态候选、外部成长公式／Adapter和Prepared Card组合等E2–E5剩余能力统一见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]，不阻塞E1准入。E3静态Pool多来源合并已由Task0317冻结并实现。A01–A06是Task0313已记录的人类规则，不重新开放统一排序、卡牌上限或是否改变抽牌概率。

## 12. 验证、风险与创建轮历史记录

核心风险不是缺一个op，而是费用／目标／条件形成循环、旧效果改序、卡牌身份混淆、Actor/Team/PlayerCost串账户、locals遗漏快照验证、Receipt恢复只认旧字段、效果资源未建余额、UI只读旧数组而漏新效果、Preview／随机／外部库存被意外提交。Task逐项给出验收。

创建轮历史运行（并非Task0313本轮）：`npx vitest run tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/data/gameplay-b-map-registry.test.ts`，4文件167项通过。未跑全量测试、UI浏览器、Schema生成，不将Report0311的旧失败写成本轮失败。

创建前后 `npm run check:docs` 均为同样8处既有Operation源码／测试路径失效，没有新增Draft／Task链接或路径错误；本轮不扩大修复。差异与GALHCG只读结果统一记在Task0312末节。上述为创建轮记录，只创建此Draft、Task0312与索引。本轮Task0313已回写E1与AG合同及行为用例，当前基线另为四份engine文件78项通过，详细结果见Task0313执行结论；两轮均未实现产品新功能。

路由：[[docs/ai/goal-workflow]]、[[docs/ai/context-packs/datapack-schema]]、[[docs/ai/context-packs/production]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/05-conventions/testing]]、[[docs/plan-work/report-0311-gameplay-b-maprun-engine-integration-investigation]]。

## 13. 独立敏捷执行合同（AG-1已批准，非E1施工范围）

### 13.1 已确认原则与本轮批准的精确合同

A01–A06按Task0313 §3.1记录的人类需求：本轮实际卡牌行为统一按最终敏捷排序；有基础和最高值、角色补足不破上限；最终同速才比次级、次级再同我方优先；不改抽取概率/次数/费用或效果公式；声明式、单planner/Owner；独立Runtime后续施工。本轮P4–P8推荐的精确合同已由用户2026-10-21“全部按推荐”批准，共用程序/Counter/non-battle规则随P1–P3一并确认；AG-1实施路由已由用户明确改为与E2–E5同Task推进；U18仍按豁免记录。

| ID／状态／阻塞 | 推荐默认及可观察结果 | 未采用的实质玩法备选与差异 | 来源／理由／用例 |
| --- | --- | --- | --- |
| D09 已确认；仅AG | final=min(base+actorAgility,max)。非负safe integer且base≤max；base2/actor10/max5→5，敌6先行动。旧Action未声明整组值取base=max=0；Actor补足缺省0；Actorless补足0，用其映射Action base/max | 若“补足”取max(base,actorAgility)再截cap：base4/actor3/max8→4，推荐加法→7；Actorless若借队长补足，会使同一Item随队长改变排序，推荐无借用 | 当前没有agility或培养数值快照；加法体现角色补足，Actorless不虚构actor。AG01/07 |
| D10 已确认；仅AG | 二级按base降序。双方final5，A base4/actor1，B base2/actor3→A先；换阵营仍A先；只有base也同才我方优先 | 二级按actorAgility降序→B先；不加入第三种玩法优先级 | A03已确认二级再同我方先，二级字段已随P5批准为base。base体现卡的先手特性；稳定尾键由工程确定。AG02/03 |
| D11 已确认（Actorless补足）；其余为工程合同；仅AG | Prepared/Swap后所选/Command/Enemy/Ability/Item都按真实来源入队；Actorless零补足按D09，Wait不占执行序号；未选卡不入队 | Actorless借队长补足的唯一玩法备选并入D09，不另开审批；不把缺CardRef作为排除Ability/Item的理由 | 当前CardCatalog只有party/enemy Owner，Ability/Item独立draft；用sourceKey而非伪造CardRef。AG06/07 |
| D02-AG 已确认；仅AG | 按统一队列本源开始时先付cost再执行program；高速补给可资助后续已合法选中的行动，但不能支付自己。己方当时不足整轮拒绝，Enemy不足本源unaffordable免费skip。PlayerCommand选中费1即使本源skip仍收；Ability只执行才收1，Item只执行才扣1 | 起始余额预留：合法草稿Team1、快速补给+1、两个后续各花Team1，仍拒绝整轮；推荐则余额1→2→1→0、两路效果都发生。若改为跳过也收Actor/Team/Item，将使被击倒的来源白扣，列作付费备选但不推荐 | 统一排序应有可解释的先后收益；Hand资格/权重仍按旧起始规则，不因AG扩大。自然队伍及Command可形成聚合冲突草稿，不能凭空生成起始不可抽卡。NEW02、AG04/05/07/10 |
| D02-DISCOUNT 已确认；仅AG | prepare仍是结算前固定准备阶段，双方所有轮初合法选中有实体来源先统一算折扣；后面被击倒不撤回其已生效折扣。多个折扣截到原sCost，未选Hand可作合法目标但不产生执行来源/当轮减费收益 | 改在折扣源执行时生效：慢源被高速击倒→折扣0；先执行的付费卡不享后来折扣；将有意改变准备期定义和费用可付性 | 全局预处理消除按敌方名册“后续”与真实敏捷顺序冲突；只减当前Actor sCost，不回溯、不送资源。EQ02、AG08 |
| D04-AG/D05-AG 已确认；仅AG | 本源开始先查已终局roundEnded，再查实体来源倒地defeated；均不执行、不付Actor/Team/Ability费、不扣Item，Command选中费例外；同源程序完整后查Battle终局，failure优先，后续来源全roundEnded。显式目标仍锁定且HP0变化0/正常收费；自动无替补免费skip | 战斗整队列末判：高速清敌后慢Item仍执行并扣1；来源倒地若仍执行，会让已倒地者反击，效果与推荐不同；不推荐。本轮non-battle仍按D05整轮末检查 | 先手击倒有实质战术作用；同源不截半，普通hpChange不复活。AG04/05/09/10/11 |
| D07-AG 工程默认；不另审批 | 保存可复验输入与有界实际执行序列，旧分组仅作投影；恢复重算final/tie/order，不能只信序号 | 无内部格式备选 | U1旧Receipt无统一序列。EQ05、NEW07 |
| D12 工程默认；不另审批 | 原建议为E1-COMPAT-1验收后再接AG-1；用户已明确要求将AG-1实施并入Task 0320，合同保持不变，旧Map启用敏捷须提高resumeVersion | 当前执行路由已按用户明确要求更新；只改实施顺序，不重裁已批准合同 | 避免双方持不同阶段表接同一Owner；E1不依赖D09/D10获批 |

### 13.2 字段、来源、冻结与稳定尾序

字段名称/摆放为工程建议，不要求用户逐字段选择：Action可选agility:{base,max}，出现必须成对合法；Map新增局内party补足声明（按Character），Encounter Enemy声明补足，分别冻结进Run/Encounter身份数值快照；缺省0。当前入场只有角色/Variant身份，不伪称已有培养敏捷；不实施外部Adapter，不在Preview读培养实时状态。公式以安全计算先加再min，或等价actor>=max-base时直接取max，避免安全整数相加溢出；base/max/actor输入本身越界或负数拒绝Registry/restore。

| 来源 | 是否入执行队列／真实身份 | 阵营与敏捷输入 | 稳定尾键/费用与保存 |
| --- | --- | --- | --- |
| natural Prepared | 每个有行动的活跃队员一条sourceKey；用真实Prepared CardRef | party；Action base/max+该Actor补足快照 | party声明index；正常Actor/Team费，PlayerCost0；保存所选Action/CardRef |
| Swap | 替换同Actor的那一条，不额外执行原牌或Swap行为 | party；换后Action base/max+原Actor补足 | 草稿版本改变重算；Swap自身免费，替换Action照常付费 |
| PlayerCommand | 每个Actor当前最终覆写一条；未选offer无source/CardRef | party；最终Action base/max+该Actor补足 | 沿party index；Command选中费独立累计，skip仍收1；存override/版本 |
| Enemy natural | 每个有行动Enemy一条，实际Hand选中Action | enemy；Action base/max+本Enemy补足 | Encounter Enemy声明index；费用不足unaffordable免费skip；保存其Hand/选择 |
| Ability | 选中的一条sourceKey，不伪造角色CardRef | party；映射Action base/max，actor=0 | sourceRank1；无额外Action cost，执行才付PlayerCost1；存draft/目标 |
| Item | 选中的一条sourceKey，不虚构Actor | party；映射Action base/max，actor=0 | sourceRank2；执行才库存1，GameInstance按实际消费计划协调；存映射/目标/消费摘要 |
| Actorless共性 | 只允许上述Ability/Item，不能冒用sourceActor/self | 不借队长补足；primary是其明确unit目标 | 可以primary HP/primaryActor或sourceTeam受用，新program按D06校验；不扩为无目标来源 |
| Wait/未选Hand/Candidate/UI副本 | Wait只保留旧来源无行动投影，无执行条目；其他一律不入队 | 无敏捷补足/排序键 | 不消费费用、库存或效果RNG；新快照保留空Hand，不制造Wait Action ID |

完整全序键为(-final,-base,sideRank,sourceRank,ownerDeclarationIndex,logicalIndex,sourceKey)，未采用的actor二级备选仅作为比较记录，不进入实施键；已批准第二项为-base。若推演历史actor备选，仅替换第二项；sideRank party0/enemy1，只在前两项相等时比较；party实体sourceRank0、Ability1、Item2，enemy实体0。owner index、logicalIndex取领域声明/实际卡容器，Actorless无owner index用0；sourceKey是run/map/node/activity/round/sourceKind/owner-or-source-id/action的规范元组。领域约束每Actor最多一条，不靠DOM顺序/哈希迭代/localeCompare排尾键；真正相同sourceKey重复则拒绝。

在同一draftVersion的计划入口冻结真实所选来源及敏捷数值，Preview/prepare使用相同定义和快照；Swap/Command/目标/Ability/Item草稿变更使旧token过期。只有换牌/Action变更改变该源敏捷输入，改目标也使整个计划重算。敏捷不改变Hand候选合法性、权重、抽牌游标或次数。完全未声明敏捷的旧来源都final/base0，AG尾序保持party→Ability→Item→Enemy；即便数值同速，AG的支付/战斗停轮变化仍须启用AG合同和resumeVersion。

### 13.3 AG-1阶段与跳过/终局矩阵（采用已批准主方案）

1. 只读核所有来源/Scope/版本及初始目标合法性；复制HP/locals/余额/输入快照；对选中的PlayerCommand合计选中费，起始PlayerCost不足整轮拒绝。初始化本轮trace预算，不写Owner。
2. 按D02-DISCOUNT候选准备政策计算双方常量折扣；冻结source键和数值并排序。预处理不读取后续HP或费用可付性，仅Natural/Swap后选中/PlayerCommand/Enemy的真实CardRef来源、轮初有合法card主目标时提供prepare折扣；Ability/Item禁止card target和prepare折扣，不提供也不承受Actor sCost折扣。来源后来倒地不撤回准备收益；执行时折扣为未采用的历史备选，不进入AG-1施工；未来变更必须重新裁定并同步该阶段及金样。
3. 按全序逐源：查terminal→实体来源HP→目标重核（显式锁定、自动fallback）→检查当时成本（实体Action costs、Ability仅PlayerCost1、Item仅库存1；Actorless costs非空始终拒绝，不是忽略）；party不足拒绝整个计划，enemy不足skip；执行来源先扣cost，再按程序顺序处理HP/locals及资源账本（本源结束前兑现资源），后源看见本源已兑现余额。E1的无资源条件/常量限制仍在；本源不能用自己的奖励付自己的cost。
4. 同源完整成功后，Battle依failure→victory检查；non-battle等整队列末再按D05检查condition/rounds；manual仅显式流程完成，不因空Enemy清场。任一program错误/预算失败都是零安装，游戏战斗failure则是成功提交的终态，已执行费用/Item照常落地。
5. 生成实际执行序列和旧分组投影，prepare库存扣除仅来自实际执行Item；双Owner token再次重核后连续安装，后发事件。相同请求重放返回已提交结果，不重复排序执行或消费。

| 事件 | AG-1推荐结果及支付 | 与E1差异 |
| --- | --- | --- |
| 外来/过期/伪造目标或scope | 进入队列前整轮拒绝；Command费也不安装 | 同E1，不将验证错误包装skip |
| source实体本轮被先手击倒，战斗尚未结束 | defeated；Action Actor/Team0；Command选中费1；Ability/Item没有实体source不据队长倒地skip | E1 party不被Enemy抢先，AG引入真实抢先后果 |
| 显式目标合法后倒地，尚未终局 | 保留身份，执行hpChange实际0，其他合法effects仍执行并正常付费；Actorless相同 | 保持E1既有显式语义，不免费复活 |
| 自动目标倒地 | 按当时合法存活集fallback；无目标noLegalTarget，Actor/Team0、Command1 | E1 fallback仍保留；同program内不重复挑primary |
| Enemy费用不足 | unaffordable，费用/效果0，后源继续 | 保持skip类型；可付性改按混合队列当时余额 |
| party Action成本/Ability的PlayerCost1不足，负资源余额/溢出 | 全部detached计划拒绝，HP/locals/库存/指令费均零安装 | party仍拒绝；Ability费只在实际执行时需要 |
| 先手清敌/全队倒地 | 同源完成后终局，后源全roundEnded；Actor/Team/Ability/Item0，Command选中费照收 | E1会先完成party/Ability/Item，AG慢Item可能保住库存 |
| 同一合法新program最终双方全灭 | 完整同源后failure优先，已执行费用落地；后源roundEnded | 不新增自伤原语；可用primary敌−HP和source−HP程序作为推演，普通heal不复活 |
| non-battle condition达标 | 推荐整轮末、failure优先、推进一次；后续合法来源仍付费获效果 | 新condition已随P3批准为整轮后检查，不因AG另改 |

AG补给的最小合法草稿直接复用当前map-run.test.ts的LATE_EFFECT_COMMIT_MAP及“keeps a naturally payable round when a later PlayerCommand adds a Team cost conflict”用例：Team supplies1，shiroko自然spend花1，serika因自然预算不足为Wait，但能以PlayerCommand选起始可付的serika-refill（花1后回1），PlayerCost1。旧E1聚合cost2拒绝；AG给serika final8、shiroko final2，得到serika先花1→0、回1→1，shiroko花1→0，Command费1→0，成功完成本轮。新程序表达等价于旧effects；敏捷只改执行时序，不让未满足单源起始资格的卡入Hand。此例不借Ability/Item额外Actioncost，也不改自然抽取规则。

### 13.4 可复现、存档与后续接线职责

D07-AG的executionContractId=AG-1及schedulerFormatVersion，与D07 programTrace区分。保存本轮来源身份、Action定义/Map resumeVersion、所选CardRef或Actorless映射、base/max/actor补足快照、draft/round/commit版本；定义可推导的final/base二级、阵营/尾键可在trace中作解释摘要但恢复必须独立重算并比对。实际执行序号/sourceKey/目标/skip/费用/库存/HP/locals trace进入有界序列，原settlements/enemyActions/ability/item仅按来源投影，不能靠重排旧分组数组假装实际次序。

恢复核全部输入、来源唯一性、排序键和全序、skip原因可核的状态链、effects/费用投影与版本；Guard/history验证能力限于§11.3，不从事后snapshot声称能证明所有历史。新格式不兼容时提高save格式版本及地图resumeVersion并拒绝旧checkpoint，不写迁移；AG snapshot不得缺补足快照后临时读培养。加载后下一轮沿冻结局内快照重算；相同输入/seed/游标/草稿应有同一队列与变化。

后续职责：gameplay-map契约/Registry/Schema接作者值与source校验；map-run契约及snapshot/restore接补足、规则版本和序列；map-run-service现有唯一planner接纯排序函数候选（新文件需正式Unit列白名单），source adapter统一Card/Actorless；map-card-effects接准备折扣新政策；GameInstance仅据实际Item消费协调库存；ReadModel/现有宽屏UI只展示计划的顺序和原因，不另算排序。测试候选为现有map-run、map-cards、source-transactions、save-resume及Registry相邻文件；独立Task须转化U4的AG01–AG11和EQ05/NEW07，并验证UI顺序与真实队列一致。字段命名、尾键编码和函数拆分属于工程侧，不作为剩余人类待批表。
