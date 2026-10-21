# Unit 0313-U2：Effect E1 合同审阅与回写

状态：complete — 本轮文档工作与Receipt已完成；不代表玩法批准或产品实现。实际交付见 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u2-receipt]]。

## Goal

把E1未决语义裁定为可核对合同或明确待批分支，回写原Draft与Task，保留旧调度等价边界。

## Must Read / Read Set

先读 [[docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission]] 和 [[docs/ai/PROJECT-CONSTITUTION]]；只读下表命中段落，不整文件堆入上下文。表中未写完整前缀的services/contracts/runtime相邻路径均在 `src/arona-clicker/`，engine测试相邻文件均在 `tests/engine/`。

| 类型 | 路径／符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | 本Task §3/§5、U1证据；Draft0312 §5/§9/§11、Task0312 §3–§8 | D01–D08审阅及精确回写点 |
| 规范 | [[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]] | 只设计Owner／版本／作者合同，不改字段 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`；`src/data-services/registry/registry-validate.ts`：validateMapActionContent | source兼容、局内键、card target旧必填规则 |
| 源码 | `src/arona-clicker/services/map-run-service.ts`：initialResourceBalances、resolveEncounterCommitPlan、advanceCompletedActivity、restore系列 | 对照U1证据定向读取 |
| 测试 | `tests/data/gameplay-b-map-registry.test.ts` 的Action／Encounter校验；`tests/engine/gameplay-b-map-run.test.ts` 的费用／目标命名用例 | 明确哪些已实现，哪些只是提案 |

## Context Budget

| 项 | 预算／规则 |
| --- | --- |
| 目标上下文 | 20k–40k token，按函数／命名测试分段读取；工具输出计入 |
| 文档 Read Set | 3–8篇命中段落；Unit/Receipt只读所依赖的结论 |
| 历史文档 | 默认0；仅U1明确指定Report0311历史快照和必要0309证据 |
| 超预算处理 | 超60k先交上游缩小／拆分，不全仓扫描；净修改≤500行、文件≤5 |

## Optional Read Set

只在trace恢复边界仍不清楚时，有界读 `src/arona-clicker/contracts/save-data.ts` 和命中的save codec字段；不扩读外部Effect Runtime。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本Unit明确指定的直接证据除外）。
- 旧Operation/EventRun CardPool、无关Engine Effect／Trigger全实现、整个UI或独立编辑器。
- 生成Schema、构建产物、依赖目录和全仓历史。

## Confirmed Facts

| 事实 | 依据（路径／符号） | 备注 |
| --- | --- | --- |
| 当前没有Encounter Counter/Flag或when | GameplayMapActionDef／GameplayEncounterDef | 不写成产品已支持 |
| 旧资源键可由costs/effects推导 | MapRunService.initialResourceBalances | 新程序显式声明是推荐兼容政策，非当前强制 |
| card目标当前要求旧cardEffects | registry-validate.ts：validateMapActionContent | E1新prepare表达须同步作者校验合同 |

## Constraints

- 本Unit创建时仅列说明；现已进入E0执行，创建轮不算执行证据，实际工作见Receipt。
- 遵循本Task裁定状态和A01–A06；人类批准须有原话／日期／来源，AI推荐不算批准。
- 当前事实冲突按停止条件交上游；未批分歧按既定任务要求记录有限方案，不自行选定，不因等待批准而伪造完成。
- Owner／存档／声明式边界按 [[docs/docs-829/05-conventions/architecture-discipline]]，文档状态按 [[docs/ai/goal-workflow]]。

## Allowed Files

- `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md`
- `docs/plan-work/task-0312-gameplay-b-effect-program-v1.md`
- `docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission.md`
- `docs/plan-work/archive/task-0313-units/receipts/task-0313-u2-receipt.md`

只允许新增列明未来产物／自己的Receipt，更新Task只写实际进度、证据及本Unit授权结论；不扩大其它Unit范围。不编辑产品源码、产品测试、数据包、Schema或协作协议。

## Explicit Non-goals

- 执行E1或敏捷Runtime、写测试实现／原型调度器、修改已有数据或准备页。
- 全局Action Registry、共享模板、通用注入、外部成长Adapter、第二Owner／完整历史状态系统。
- 为消除既有检查错误而修无关文档，或代替人类批准玩法。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 六条：越白名单／新增未列路径／超预算；Read Set外新增阅读超过2文件；事实冲突；实现需要未裁定选型或扩范围；必需验证失败／不可解释。中断写Receipt与缺失信息，只暂停受影响工作，由上游更新边界后续行。

待批选项可按本Unit规定产出“方案+差异+推荐+阻塞ID”，这是设计文档的完成方式，不是允许施工代理替人类定案。既有check:docs八处错误若前后一致，按Task基线口径记录，不自动触发无关修复。

## Work Items

1. 在Draft的E0裁定表登记D01–D08。已批准条目准确引用人类依据；其余提供2–3个有行为差异的方案、推荐与阻塞归属。不要通过“任务完成”批准玩法。
2. 对D01/D02画E1旧调度阶段表，逐项规定Effect顺序、when读当前HP/Counter/Flag、可选else及全分支静态验证、资源账本与起始费用、资源条件暂禁、sCostDiscount时机。用guard前／后、先回血后判定、回资源但起始费不足推演；不能说“全部Effect完全顺序”。
3. 对D03比较：饱和Counter、严格拒绝、显式有限overflow策略（如clamp/reject）。至少trust=2/max3两次+1、min0当前0再−1、initial越界、极大加法各给结果与复杂度；区分玩法上下限与安全整数溢出。推荐可以与0312旧提案不同，但待批状态必须保留。确定跨轮保留、Encounter切换重置、checkpoint一致性、Flag只bool的合同状态。
4. D04/D05保留E1旧语法兼容基准；新program的source/primary绑定、合法后倒地与非法引用、non-battle condition／rounds／manual互斥、全队失败优先／整轮完成时机分别给精确结果及批准状态。敏捷新规则移交U3，不塞入E1。
5. D06列“类型定义／local resourceId键／实际余额”分层，核实是否真的引用AC Resource Registry；列sourceActor/primaryActor/sourceTeam及Actorless各使用上下文的依赖校验。Action被两Encounter引用而一方缺local必须有作者错误样例；程序键物化范围、初值0、locals命名冲突、跨Map可复用的依赖边界明确。只给未来Tag/Pool/成长Adapter接点，不做共享模板或全局Registry。
6. D07确定需要提交审批的最小trace/save字段表：path/source/target/实际delta/local前后/必要guard证据，哪些可从当前snapshot重核、哪些不能。覆盖幂等、resumeVersion与格式变化拒绝、no migration；不引入历史状态Owner。
7. D08审阅64/4/8/64/4096的计数对象、静态未走分支、条件访问、全轮source累积、超预算零安装、旧内容策略。给最小/边界/越界测试输入，区分E1推荐与E2集合预算。
8. 在Draft §5/§9/§11及Task0312 §3–§6/§8就地同步；对尚待批的Counter等不得让一处写严格拒绝、另一处写已采用clamp。用合同ID链接待批状态，局部正文均标清适用版本。

## Completion Criteria

- [x] D01–D08有状态、证据、方案/结果、推荐、受阻范围；必要批准有真实来源。
- [x] 顺序／费用／locals／目标／终局／依赖验证／trace／预算各有作者可理解规则或有限待批选择。
- [x] 两份0312相关正文一致；未批条目未伪造冻结，E1未扩大敏捷施工范围。
- [x] Receipt记录实际回写段落、待批ID及对E1的阻塞。

## Verification

| 项 | 命令／方式 | 期望结果 |
| --- | --- | --- |
| 语义对照 | 逐条核对D01–D08与Draft／Task对应段落及guard／Counter／费用样例 | 不存在相反规则、批准来源可查 |
| 修改边界 | 查看文件差异 | 产品代码／Schema／fixture未改 |
| 文档／链接 | `npm run check:docs`，记录相对本Task基线的新增项；不新增无效WikiLink | 无本Unit新增错误；非零既有错误不写成通过 |
| 空白／范围 | `git --no-pager diff --check`；新未跟踪md另查尾随空白 | 无新增空白错误且文件不越白名单 |

## Receipt

执行结束或中断时才创建 `docs/plan-work/archive/task-0313-units/receipts/task-0313-u2-receipt.md`，按 [[docs/ai/templates/execution-receipt]] 记录实际变更、实际验证、未完成和待批ID。GALHCG收尾可统一合并到U5，注明“待U5统一只读复核”，不得每次编辑刷新地图。
