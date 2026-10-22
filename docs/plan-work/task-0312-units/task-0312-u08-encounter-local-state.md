# Unit 0312-U08：Encounter locals状态与跨轮生命周期

状态：ready / 未执行；阶段P2。前置：0312-U03实际完成Receipt与测试、0312-U07实际完成Receipt与测试。

## Goal

locals在真实Encounter生命周期中有唯一Owner、跨轮不重置、换Encounter不泄漏，旧Map无新增强制字段；不可变快照测试通过。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 源码 | src/arona-clicker/services/map-run-service.ts：createEncounterSnapshot/snapshotOf/openNodeContent/advanceCompletedActivity/prepareEncounterRoundCommit/resolveEncounterCommitPlan | 进入/跨轮/离开真实生命周期，以及U03实际locals过渡门 |
| 合同 | src/arona-clicker/contracts/map-run.ts：MapRunEncounterSnapshot/CommitReceipt/Preview/SaveSnapshot；src/arona-clicker/contracts/map-effects.ts | locals及trace的typed挂接点 |
| E0 | D03/D06/D07、NEW03/04 | 初值/寿命/快照 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

负责人预算记录（2026-10-22）：依据当前接口与施工代理校准，合同约10–20行、locals helper50–90行、MapRun接线40–80行、生命周期测试180–260行、Receipt35–55行，总约315–505行。为保留完整跨轮/跨Activity/快照隔离验证，按用户授权将本Unit手写净改动额度放宽至1000行；五文件白名单和初始化/生命周期职责不变，不提前执行程序或恢复新存档字段。

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

每次round通过createEncounterSnapshot重建Hand；若把locals总按initial重建会丢进度（prepareEncounterRoundCommit）。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- `src/arona-clicker/contracts/map-run.ts`
- 新增（执行时才创建）：src/arona-clicker/services/map-encounter-locals.ts
- `src/arona-clicker/services/map-run-service.ts`
- 新增（执行时才创建）：tests/engine/gameplay-b-effect-lifecycle.test.ts
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u08-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不做condition自动完成、新程序Commit或Save恢复新字段（分别U11/U13），不增加Run级locals。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

职责核对：本Unit只负责locals生命周期与快照；counterAdd/flagSet的纯语义在U06，接入真实整轮规划与安装在U10。不得增加临时执行命令、测试专用业务写入口或提前接程序来证明生命周期。

负责人局部接线修订（2026-10-22）：依据 [[docs/plan-work/task-0312-units/receipts/task-0312-u03-receipt]] 及实际 `resolveEncounterCommitPlan`，U03新增了独立locals拒绝门。原计划未指定该门移除节点；现明确在本Unit完成状态持有后移除**仅locals声明**的拒绝，允许旧Action/Wait配合已持有的locals走真实跨轮生命周期。effectProgram与condition completion拒绝分别保留至U10/U11。文件白名单及依赖不变，只增加同文件符号阅读；不提前执行程序，不改变玩法或金样。

1. 新增显式Encounter locals runtime类型和初始化/复制/校验小helper，只持有activeEncounter唯一活状态。为U10的trace/preview/receipt留可选typed字段引用U06类型；旧内容不强加locals或新字段。
2. createEncounterSnapshot区分新Encounter初始化与同Encounter下一轮保留；openNodeContent/advanceCompletedActivity/失败/离开清理，下一activity重置；snapshotOf深拷贝冻结locals/trace，不能浅拷贝可写引用。
3. initialResourceBalances安装仍遍历完整初始声明物化键，程序新增余额不会被旧数组推导漏掉；EnemyActor/Team亦核声明，保持阵营隔离。
4. 通过真实进入/Wait推进/手动切activity检查初始/保留/重置与快照隔离；本Unit不执行counterAdd（U10负责），不先写坏档默认回填。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] locals在真实Encounter生命周期中有唯一Owner、跨轮不重置、换Encounter不泄漏，旧Map无新增强制字段；不可变快照测试通过。
- [ ] 生命周期测试使用初值、合法Wait跨轮及正常活动切换，不提前执行counterAdd/flagSet；程序执行/安装仍留U10。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-lifecycle.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-save-resume.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 架构 | `npm run check:architecture` | 基础层无反向依赖，不新增业务写入口 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u08-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
