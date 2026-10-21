# Unit 0312-U12：有界Effect Receipt恢复校验器

状态：ready / 未执行；阶段P3。前置：0312-U10实际完成Receipt与测试。

## Goal

对U10真实产生的E1 trace正例与独立篡改反例全绿，有界校验规则与不能证明的历史边界明确。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 类型 | src/arona-clicker/contracts/map-effects.ts；src/arona-clicker/contracts/map-run.ts | 实际trace格式/投影 |
| 源码 | src/arona-clicker/services/map-run-service.ts：restoreEncounterCommitReceipt/restoreActorlessSourceSettlement | 现有恢复契约与分组 |
| 合同 | Draft0312 §11.3 D07、EQ05/NEW07（只E1部分） | 校验能力有界、不证明完整历史 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。最多4个变更文件加自己的Receipt；常规500行，负责人可按用户2026-10-22授权记录放宽至最多1000行，不扩大白名单。生成协议diff单列不计手写行数。超过60k上下文、预计超文件或1000行先交负责人调整/拆分。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

checkpoint没有完整上一轮世界状态；只可核定义/trace内部链与尚存在的Encounter末值，不能重放证明全部历史。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- 新增（执行时才创建）：src/arona-clicker/services/map-effect-receipt-validator.ts
- 新增（执行时才创建）：tests/engine/gameplay-b-effect-receipt.test.ts
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u12-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不造完整历史状态、迁移器或AG排序序列校验，尚不更改Owner安装/恢复。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

开工先把U10实际Receipt的trace字段/path/guard读取/投影版本与本Unit验证项逐一对照，引用实际符号；字段摆放不同由负责人按总Task局部更新入口与白名单，不为匹配假设格式重塑已正确实现的trace。若校验器加负例预计超500行，负责人可按授权记录≤1000行额度；超过1000行或确需独立验收再拆分。不能删损坏用例、提前通用包装或增加完整历史Owner来简化证明。

1. 实现纯unknown receipt trace验证入口，核programReceiptVersion/executionContractId=E1-COMPAT-1、Scope/source/action/effectPath/op、目标/账户合法性，利用规范化定义，不信任存入的guard布尔值。
2. 核受限guard读值/逻辑与分支、常量/安全整数/HP截界/Counter饱和/Flag、同字段before→after连续性、实际delta及旧settlement一致；预算与访问/未走分支关系有界。不要求旧legacy receipt新增trace。
3. 同Encounter仍活时可核locals/HP末值与快照；Encounter已退出时仅核当前定义+摘要内部一致，不拿下一Encounter初值证明上轮读数。费用/库存不重复应用，trace不能成为活Owner或补写依据。
4. 反例逐字段破坏path/source/Scope/规则或格式版本/guard读取/分支/连续性/实际delta/末值/分组投影/超预算；验证失败返回可诊断错误且不修改输入，合法零变化trace通过。AG scheduler/order/base/max字段全不进入E1格式。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 对U10真实产生的E1 trace正例与独立篡改反例全绿，有界校验规则与不能证明的历史边界明确。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-receipt.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 架构 | `npm run check:architecture` | 基础层无反向依赖，不新增业务写入口 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u12-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
