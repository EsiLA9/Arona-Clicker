# Unit 0312-U02：声明式作者类型与有界语法校验

状态：ready / 未执行；阶段P1。前置：0312-U01实际完成Receipt与测试。

## Goal

完整最小AST可通过纯校验、边界及未知op负例全绿；TS编译通过，现有旧作者合同未失效。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 合同 | Draft0312 §11.1–11.3；Task0313 §10 | 使用已批准D01/D03/D05和D08计数 |
| 源码 | src/data-services/contracts/gameplay-map.ts：GameplayMapActionDef/GameplayEncounterDef/GameplayEncounterCompletionDef | 扩展作者合同 |
| 规范 | docs/docs-829/05-conventions/schema-sync.md；architecture-discipline.md | 仅数据类型及纯校验，无产品反向import |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

负责人预算记录（2026-10-22）：当前作者类型145行、纯校验196行、语法测试95行，主合同净增约13行，另需实际Receipt约60–80行，预计总量约509–529行。按用户授权，本Unit手写净改动额度放宽至1000行；五文件白名单、有限语法与全部验收要求保持，不为压行数减少作者说明或边界测试。

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

GameplayMapActionDef只有旧三类效果数组，completion只有manual；相关使用处已有kind判别（gameplay-map.ts/runtime-game-instance.ts）。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- `src/data-services/contracts/gameplay-map.ts`
- 新增（执行时才创建）：src/data-services/contracts/gameplay-map-effects.ts
- 新增（执行时才创建）：src/data-services/validation/gameplay-map-effect-syntax.ts
- 新增（执行时才创建）：tests/data/gameplay-b-effect-syntax.test.ts
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u02-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不做Registry上下文/Schema生成、Runtime执行或任意递归片段引用。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. 在独立gameplay-map-effects类型文件定义有限discriminated union：prepare.discountSCost及resolve hpChange/resourceChange/counterAdd/flagSet/when(else可选)，局内Counter/Flag声明及受限条件；主文件只挂effectProgram/locals/condition completion字段与TSDoc，不引入Value/任意路径/handler。具体属性名由工程统一，不更改冻结语义。
2. 实现纯unknown输入语法校验，严格字段白名单、布尔/安全整数/非零delta、正折扣、有理HP比率、Counter initial范围、locals名字域；条件只支持白名单HP/Counter/Flag及all/any/not，资源条件拒绝。 验证未知深树先检查深度/节点再下钻，不能为了报告超额而先递归到栈溢出。
3. 按D08计静态prepare+语句+条件树，两个分支皆算/皆查；节点64/65、resolve深度4/5、条件深度4/5、prepare8/9、locals64/65逐项测试。错误保留field path和limit；不在此Unit绑定来源/余额/Registry。
4. 本Unit只提供作者类型和可单测语法函数，Registry新字段仍在U03接入前拒绝；不以类型存在宣称可装载或执行。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 完整最小AST可通过纯校验、边界及未知op负例全绿；TS编译通过，现有旧作者合同未失效。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/data/gameplay-b-effect-syntax.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 架构 | `npm run check:architecture` | 基础层无反向依赖，不新增业务写入口 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u02-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
