# Unit 0313-U3：敏捷合同与独立施工依赖

状态：complete — 本轮文档工作与Receipt已完成；不代表玩法批准或产品实现。实际交付见 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u3-receipt]]。

## Goal

形成敏捷真实执行顺序的完整source／阶段合同和有限待批选项，作为独立Runtime Task的准入材料。

## Must Read / Read Set

先读 [[docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission]] 和 [[docs/ai/PROJECT-CONSTITUTION]]；只读下表命中段落，不整文件堆入上下文。表中未写完整前缀的services/contracts/runtime相邻路径均在 `src/arona-clicker/`，engine测试相邻文件均在 `tests/engine/`。

| 类型 | 路径／符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | 本Task A01–A06/D02/D04/D05/D07/D09–D12、U1证据、U2回写的Draft／Task0312 | 已确认与建议分开 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`；`src/arona-clicker/contracts/map-run.ts`、`map-cards.ts` | Action／角色快照缺口、来源、Receipt分组 |
| 源码 | `src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`：resolveGameplayBActionPreview；`map-card-catalog.ts`：catalogMapRunCards | Prepared、Swap、Command与真实卡身份 |
| 源码 | `src/arona-clicker/services/gameplay-b-hand-resolver.ts`：resolveCandidates/drawGameplayBHands | 不改变候选过滤、费用可用性、抽取权重/RNG |
| 源码 | `src/arona-clicker/services/map-run-service.ts`：resolveEncounterCommitPlan、prepare/restore系列；`map-card-effects.ts` | 混合调度与折扣／费用／目标重核 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts`：commitMapEncounterRound及Map入场身份装配 | Actorless库存事务、入场快照边界 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts` 敌方声明顺序／skip；`gameplay-b-map-source-transactions.test.ts` 来源顺序／失败库存；`gameplay-b-map-cards.test.ts` Swap/Command身份 | 有意改变与必须保持的边界 |

## Context Budget

| 项 | 预算／规则 |
| --- | --- |
| 目标上下文 | 20k–40k token，按函数／命名测试分段读取；工具输出计入 |
| 文档 Read Set | 3–8篇命中段落；Unit/Receipt只读所依赖的结论 |
| 历史文档 | 默认0；仅U1明确指定Report0311历史快照和必要0309证据 |
| 超预算处理 | 超60k先交上游缩小／拆分，不全仓扫描；净修改≤500行、文件≤5 |

## Optional Read Set

若角色快照来源仍不明确，先定位当前Map入场装配相邻函数再有界读取；新增路径只能记候选，未存在的建议路径不得记现有API。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本Unit明确指定的直接证据除外）。
- 旧Operation/EventRun CardPool、无关Engine Effect／Trigger全实现、整个UI或独立编辑器。
- 生成Schema、构建产物、依赖目录和全仓历史。

## Confirmed Facts

| 事实 | 依据（路径／符号） | 备注 |
| --- | --- | --- |
| CardInstance仅有partyCharacter/enemy Owner，Ability/Item独立draft | map-cards.ts；map-run.ts | Actorless排序不能假装已是角色手牌 |
| 当前Enemy声明顺序，非敏捷排序 | resolveEncounterCommitPlan：preparedEnemyActions | 旧行为变更需独立验收 |
| Item无论后续局内终局仍受当前prepared item计划协调 | GameInstance.commitMapEncounterRound；source-transactions命名用例 | 新skip／扣库存政策必须显式 |

## Constraints

- 本Unit创建时仅列说明；现已进入E0执行，创建轮不算执行证据，实际工作见Receipt。
- 遵循本Task裁定状态和A01–A06；人类批准须有原话／日期／来源，AI推荐不算批准。
- 当前事实冲突按停止条件交上游；未批分歧按既定任务要求记录有限方案，不自行选定，不因等待批准而伪造完成。
- Owner／存档／声明式边界按 [[docs/docs-829/05-conventions/architecture-discipline]]，文档状态按 [[docs/ai/goal-workflow]]。

## Allowed Files

- `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md`
- `docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission.md`
- `docs/plan-work/archive/task-0313-units/receipts/task-0313-u3-receipt.md`

只允许新增列明未来产物／自己的Receipt，更新Task只写实际进度、证据及本Unit授权结论；不扩大其它Unit范围。不编辑产品源码、产品测试、数据包、Schema或协作协议。

## Explicit Non-goals

- 执行E1或敏捷Runtime、写测试实现／原型调度器、修改已有数据或准备页。
- 全局Action Registry、共享模板、通用注入、外部成长Adapter、第二Owner／完整历史状态系统。
- 为消除既有检查错误而修无关文档，或代替人类批准玩法。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 六条：越白名单／新增未列路径／超预算；Read Set外新增阅读超过2文件；事实冲突；实现需要未裁定选型或扩范围；必需验证失败／不可解释。中断写Receipt与缺失信息，只暂停受影响工作，由上游更新边界后续行。

待批选项可按本Unit规定产出“方案+差异+推荐+阻塞ID”，这是设计文档的完成方式，不是允许施工代理替人类定案。既有check:docs八处错误若前后一致，按Task基线口径记录，不自动触发无关修复。

## Work Items

1. 在Draft0312新增独立敏捷合同节及裁定ID。A01–A06引用本Task的人类来源，不重新开放是否统一排序、上限或只影响执行次序。
2. D09给字段候选位置、base/max/actor补足数值域、旧Action默认值、base>max错误、负数／safe integer溢出处理与精确公式建议。解释min(base+actor,max)及溢出前安全计算。区分当前角色只有身份快照与未来培养Adapter；推荐最小局内可声明补足来源，不读取Preview时实时培养值，不实施Adapter。
3. D10比较2–3种第二级字段与稳定尾键。至少给双方final5，base4对base2的差异；完全同速必须我方优先，并给同阵营多个来源的确定尾序（不能用DOM或不稳定容器序）。次级字段尚未批准，所有预期用条件式写。
4. D11做完整source表：自然Prepared、Swap替换、PlayerCommand、Enemy、Ability、Item、Actorless与Wait／skip。逐格写实际source身份／阵营、是否入排序候选、base/max来源、补足、稳定尾键、何时冻结／重算、是否需存档。卡牌候选／Hand未Prepared／未选Command不新增行动；Ability/Item不能因无CardRef而逃过调查。Actorless的补足0或其他方案须比较并待批。
5. 给“准备草稿→预处理折扣／费用计划→排序→逐源目标重核及HP/locals→终局→原子安装”的候选阶段图，D02明确高速+资源能否资助后续、我敌费用策略是否统一、skip的Actor/Team/PlayerCost/库存分别处理。与U2旧兼容表逐行列差异；准备期折扣来自后来被击倒的来源是否保留、敌方折扣不再能用名册后续来定义，必须给有限政策和样例。
6. D04/D05逐项给非法引用整轮拒绝、显式合法目标后倒地、自动fallback、来源倒地、无目标、费用不足、全敌／全我倒地、未执行治疗／Ability／Item、同轮双方全灭、non-battle整轮后退出。每类列是否执行／skip reason／是否支付／是否继续，未批则分方案，不能统一归为整轮失败。
7. D07列排序可复现输入：规则版本、source key、Action定义身份、base/max/补足快照、final及tie keys、草稿版本、实际序号/skip。划分定义可推导与需持久化字段，旧分组Receipt如何引用新有界序列，恢复不能凭排序数组自证正确；给save版本/幂等/换牌重排/加载后下一轮规则。
8. D12列文件职责及依赖：作者字段/Registry/Schema、planner与纯排序帮助函数候选、source适配、Receipt/restore/GameInstance事务/只读顺序投影。只写独立后续施工需求，不修改产品、不建第二Owner，不把调度实现塞入0312。

## Completion Criteria

- [x] 所有实际source有排序/费用/目标/skip/终局矩阵，Actorless与Wait明确，无UI排序替代真实执行。
- [x] 公式、第二比较、旧默认、补足快照、尾键、存档与版本均有规则状态和具体差异。
- [x] 敏捷新语义与E1旧兼容差异逐项列明，D02/D04/D05/D07共享合同无遗漏。
- [x] 独立Runtime所需接线职责／前置／待批ID齐全；无Scheduler或培养功能实现。

## Verification

| 项 | 命令／方式 | 期望结果 |
| --- | --- | --- |
| 排序推演 | 比较最终不同、最终同/次级不同、双方完全同、同阵营完全同、Actorless、换牌 | 每方案可得确定全序；未批不伪称唯一 |
| 事务推演 | 高速击倒Item相关角色／全队结束／Item未执行，核对库存政策 | 零或一次扣除明确，仍由既有双Owner安装 |
| 文档／链接 | `npm run check:docs`，记录相对本Task基线的新增项；不新增无效WikiLink | 无本Unit新增错误；非零既有错误不写成通过 |
| 空白／范围 | `git --no-pager diff --check`；新未跟踪md另查尾随空白 | 无新增空白错误且文件不越白名单 |

## Receipt

执行结束或中断时才创建 `docs/plan-work/archive/task-0313-units/receipts/task-0313-u3-receipt.md`，按 [[docs/ai/templates/execution-receipt]] 记录实际变更、实际验证、未完成和待批ID。GALHCG收尾可统一合并到U5，注明“待U5统一只读复核”，不得每次编辑刷新地图。
