# Unit 0312-U01：把旧行为金样落成可运行基准

状态：ready / 未执行；阶段P1。前置：E0最终合同准入已通过，无产品前置。

## Goal

新OLD基线在未改产品源码时全绿；每个skip/费用分通道/目标窗口可独立运行，所有初态由真实Owner流程可达。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| E0 | behavior-cases OLD01、EQ02–EQ05及Skip补全；U1证据/Receipt | 取真实旧行为，不取AG期望 |
| 源码 | src/arona-clicker/services/map-run-service.ts：resolveEncounterCommitPlan/prepareEncounterRoundCommit | 固定旧阶段与skip |
| 测试 | tests/engine/gameplay-b-map-run.test.ts；gameplay-b-map-cards.test.ts；gameplay-b-map-source-transactions.test.ts；gameplay-b-map-save-resume.test.ts 的E0命名用例 | 复用合法Owner启动/Variant/Hand/草稿构造 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

负责人开工预算记录（2026-10-22）：依据施工代理定向核对，真实Owner共享fixture约150–190行、独立旧行为金样约350–400行、实际Receipt约60–80行，总计约560–670行。按用户已授权的按需放宽规则，本Unit手写净改动额度放宽至1000行；原三文件白名单、全部行为覆盖与验收标准保持。不得为压行数伪造Hand或合并不同skip窗口，超过1000行仍先交负责人调整。

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

当前party先处理、Enemy后按声明序结算；PlayerCommand noLegalTarget仍可能付PlayerCost（resolveEncounterCommitPlan）。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- 新增（执行时才创建）：tests/engine/gameplay-b-effect-test-fixtures.ts
- 新增（执行时才创建）：tests/engine/gameplay-b-effect-legacy-goldens.test.ts
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u01-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不实现新语法、重构旧planner或添加AG排序预期。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. 新增小型共享fixture，只含合法Map/Registry角色与Variant装配、固定创建种子、Owner真实命令及快照比较；不直接伪造Hand/cursor/CardRef/version，不从其它大测试文件import带执行副作用的测试。
2. 把OLD01、EQ02旧折扣、EQ03显式目标HP0/自动fallback、EQ04自然/Command skip及Enemy defeated/unaffordable/roundEnded独立落成OLD测试；补Enemy card无合法目标的noLegalTarget旧行为缺测。保留另一活目标，分别构造非终局与全灭窗口。
3. 覆盖party→Ability→Item→Enemy顺序、清敌后Actorless仍执行/收费、Item原子扣库存及重放、Save后继续；逐例标E0 ID、初态、期望旧投影。预留同一fixture的新版表达生成入口，但此Unit不写effectProgram或任何红色占位测试。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 新OLD基线在未改产品源码时全绿；每个skip/费用分通道/目标窗口可独立运行，所有初态由真实Owner流程可达。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-save-resume.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u01-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
