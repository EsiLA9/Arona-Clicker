# Unit 0313-U1：现状核实与差异定位

状态：complete — 本轮文档工作与Receipt已完成；不代表玩法批准或产品实现。实际交付见 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u1-receipt]]。

## Goal

形成有源码与既有测试支撑的当前MapRun阶段、费用、目标、终局与存档证据，供后续合同审阅引用。

## Must Read / Read Set

先读 [[docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission]] 和 [[docs/ai/PROJECT-CONSTITUTION]]；只读下表命中段落，不整文件堆入上下文。表中未写完整前缀的services/contracts/runtime相邻路径均在 `src/arona-clicker/`，engine测试相邻文件均在 `tests/engine/`。

| 类型 | 路径／符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | 本Task、Draft0312 §2/§5/§11、Task0312 §2–§5 | 列出待核事实，不当作源码事实 |
| 文档 | Report0311 §2/§3；Task0309状态与最后验收段 | 各只读命中片段，核实历史差异 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`：Action/Encounter/资源/来源声明 | 当前作者合同 |
| 源码 | `src/arona-clicker/services/map-run-service.ts`：initialResourceBalances、resolveEncounterCommitPlan、prepareEncounterRoundCommit、restoreEncounterCommitReceipt、restoreEncounterSnapshot、restoreRunState、initializeEncounterSeed | 按函数分段读取，覆盖阶段／保存 |
| 源码 | `src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`：resolveGameplayBActionPreview；`services/map-card-effects.ts`：resolveMapCardEffects/mapScostCost | 准备／目标与折扣 |
| 源码 | `src/arona-clicker/contracts/map-run.ts`：Receipt/EncounterSnapshot/SaveSnapshot；`runtime-game-instance.ts`：commitMapEncounterRound | Preview/Commit数据与外部事务 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`：目标fallback／PlayerCommand skip／敌方声明顺序／原子Commit命名用例 | 只读命中用例及fixture |
| 测试 | `tests/engine/gameplay-b-map-cards.test.ts`、`gameplay-b-map-source-transactions.test.ts`、`gameplay-b-map-save-resume.test.ts` | 折扣、外部库存、Receipt／恢复 |
| 测试 | `tests/data/gameplay-b-map-registry.test.ts` 的Action／source验证；`tests/ui/gameplay-b-map-vertical-slice.test.ts` 的map-entry路径 | 验证入口与0309事实 |

## Context Budget

| 项 | 预算／规则 |
| --- | --- |
| 目标上下文 | 20k–40k token，按函数／命名测试分段读取；工具输出计入 |
| 文档 Read Set | 3–8篇命中段落；Unit/Receipt只读所依赖的结论 |
| 历史文档 | 默认0；仅U1明确指定Report0311历史快照和必要0309证据 |
| 超预算处理 | 超60k先交上游缩小／拆分，不全仓扫描；净修改≤500行、文件≤5 |

## Optional Read Set

若保存封装无法定位，再有界读 `src/arona-clicker/runtime-save-codec.ts`／`src/arona-clicker/runtime-save.ts` 命中函数；入口事实不足才读0309收尾Receipt（最多1份）。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本Unit明确指定的直接证据除外）。
- 旧Operation/EventRun CardPool、无关Engine Effect／Trigger全实现、整个UI或独立编辑器。
- 生成Schema、构建产物、依赖目录和全仓历史。

## Confirmed Facts

| 事实 | 依据（路径／符号） | 备注 |
| --- | --- | --- |
| 单planner涵盖Preview与Commit | MapRunService.resolveEncounterCommitPlan及prepareEncounterRoundCommit | 不另造探针executor |
| Ability/Item的HP在己方资源之后，Enemy在后续循环 | resolveEncounterCommitPlan：pendingHpActions/preparedEnemyActions | 不描述成所有来源逐条交织 |
| receipt恢复按固定party和enemy分组验证 | restoreEncounterCommitReceipt | 排序需要新的可复现表达边界 |

## Constraints

- 本Unit创建时仅列说明；现已进入E0执行，创建轮不算执行证据，实际工作见Receipt。
- 遵循本Task裁定状态和A01–A06；人类批准须有原话／日期／来源，AI推荐不算批准。
- 当前事实冲突按停止条件交上游；未批分歧按既定任务要求记录有限方案，不自行选定，不因等待批准而伪造完成。
- Owner／存档／声明式边界按 [[docs/docs-829/05-conventions/architecture-discipline]]，文档状态按 [[docs/ai/goal-workflow]]。

## Allowed Files

- `docs/plan-work/archive/task-0313-units/current-behavior-evidence.md`
- `docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission.md`
- `docs/plan-work/archive/task-0313-units/receipts/task-0313-u1-receipt.md`

只允许新增列明未来产物／自己的Receipt，更新Task只写实际进度、证据及本Unit授权结论；不扩大其它Unit范围。不编辑产品源码、产品测试、数据包、Schema或协作协议。

## Explicit Non-goals

- 执行E1或敏捷Runtime、写测试实现／原型调度器、修改已有数据或准备页。
- 全局Action Registry、共享模板、通用注入、外部成长Adapter、第二Owner／完整历史状态系统。
- 为消除既有检查错误而修无关文档，或代替人类批准玩法。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 六条：越白名单／新增未列路径／超预算；Read Set外新增阅读超过2文件；事实冲突；实现需要未裁定选型或扩范围；必需验证失败／不可解释。中断写Receipt与缺失信息，只暂停受影响工作，由上游更新边界后续行。

待批选项可按本Unit规定产出“方案+差异+推荐+阻塞ID”，这是设计文档的完成方式，不是允许施工代理替人类定案。既有check:docs八处错误若前后一致，按Task基线口径记录，不自动触发无关修复。

## Work Items

1. 在证据文件记录HEAD／日期／相关未提交差异；核对本Task事实表，任何差异写明当前符号和影响，交上游调整受影响Unit。不要以Report的旧测试失败得出当前失败。
2. 逐步记录“准备／折扣→己方HP及skip→聚合费用→资源→Ability/Item HP→终局→Enemy每个cost/resource/HP/折扣/终局→安装／推进”。每步列读取状态、暂存变化、真正安装点、对应函数和测试名。
3. 用来源矩阵覆盖natural、Swap、PlayerCommand、Enemy、Ability、Item、Wait；分别填写来源有效性、主目标、费用类型、费用预检时刻、skip与支付、终局后未执行来源、库存副作用。明确PlayerCommand skip仍可能花PlayerCost，不能只列Actor成本。
4. 记录自动／显式目标、非法外来Scope、合法后倒地、来源失效、HP0正值、同轮击败／失败规则，附当前测试名；缺测就写“缺当前自动化证据”，不给未来规则补批准。
5. 按字段列Receipt／checkpoint保存了什么、恢复重核什么、幂等键、终局持久化边界、定义与resumeVersion；记录抽牌seed/cursor与新Encounter构造是否在纯prepare／Preview路径触及随机分配。没有最小复现不得称RNG已发现bug；本Unit不新增产品测试。
6. 输出“0312段落→当前事实→推荐／事实混淆→后续裁定ID”差异表。不得在本Unit改Draft／Task0312语义。
7. 运行下表指定现有测试，逐文件记数量／退出码；失败定位到具体测试和日志摘要，不越界修复。

## Completion Criteria

- [x] 证据文件含执行阶段、source矩阵、目标／终局、Receipt／Save/RNG字段表、0312差异表；每条事实有当前符号或测试名。
- [x] Task0309已完成与Report历史差异被明确记录，没有重做准备页。
- [x] 四份既有基线测试有实际结果；额外只读检查未冒充功能验证。
- [x] 本Task只更新U1实际进度／证据链接，其余Unit不勾完成；实际Receipt写完。

## Verification

| 项 | 命令／方式 | 期望结果 |
| --- | --- | --- |
| 既有定向测试 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-save-resume.test.ts` | 全通过；失败按停止规则提交证据，不修改源码 |
| 事实复核 | 对照命名测试及函数分支检查矩阵每格 | 无“全skip免费”等错误概括 |
| 文档／链接 | `npm run check:docs`，记录相对本Task基线的新增项；不新增无效WikiLink | 无本Unit新增错误；非零既有错误不写成通过 |
| 空白／范围 | `git --no-pager diff --check`；新未跟踪md另查尾随空白 | 无新增空白错误且文件不越白名单 |

## Receipt

执行结束或中断时才创建 `docs/plan-work/archive/task-0313-units/receipts/task-0313-u1-receipt.md`，按 [[docs/ai/templates/execution-receipt]] 记录实际变更、实际验证、未完成和待批ID。GALHCG收尾可统一合并到U5，注明“待U5统一只读复核”，不得每次编辑刷新地图。
