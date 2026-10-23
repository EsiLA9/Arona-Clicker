# Unit 0312-U18：合法数据包完整纵向验收

状态：waived by user — 用户于2026-10-22明确要求跳过本Unit验收；未执行测试、浏览器操作或截图，也没有U18 Receipt。
> 现行作者合同与迁移结果以 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和对应 Receipt 为准；本页的旧字段与 legacy 执行说明只记录当时施工计划，不是当前作者入口。

## Goal

真实合法Datapack完整链路及宽屏交互有实际证据，OLD/EQ/NEW结果全绿、失败原子/幂等/恢复成立；尚未运行项不得标通过。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 示例 | src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example.ts；docs/examples/gameplay-b-effect-program-e1.md | 同一份真实内容贯穿验收 |
| 现有链 | tests/ui/gameplay-b-map-vertical-slice.test.ts；tests/engine/gameplay-b-map-source-transactions.test.ts；src/arona-clicker/runtime/runtime-game-instance.ts：commitMapEncounterRound | 设施/准备页/Controller/Runtime/库存 |
| 合同 | OLD/EQ/NEW映射表与U01–U17实际Receipt | 最终联合行为覆盖 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

0309 map-entry已完成；既有UI slice按map-entry-open/start/leave/continue进入，不应退回Spot直启动。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- 新增（执行时才创建）：tests/engine/gameplay-b-effect-runtime-integration.test.ts
- 新增（执行时才创建）：tests/ui/gameplay-b-effect-vertical-slice.test.ts
- `docs/plan-work/task-0312-gameplay-b-effect-program-v1.md`
- `docs/plan-work/task-0312-units/evidence/task-0312-e1-final.png`
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u18-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不实现AG队列或在验收Unit顺手改产品代码，不把8处既有文档错误算通过。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. 以U17同一例图从base+可选包加载/Registry校验→设施入口→已完成map-entry→真实Hand/准备/目标/CardRef→两次Preview→Commit→实际Receipt→Save/Load→继续和condition完成→出口，运行GameInstance与UI公开入口，不调用内部VM绕过完整链。
2. E0 EQ01–EQ05和NEW01–NEW07分别断言已批准E1期望；补外部Item useCondition变动/无库存/stale token/程序中途非法/预算拒绝全部零安装，保存后重放不重复扣费或事件。仍按旧分阶段执行，未来AG01–AG11不得混成E1成功断言。
3. 宽屏鼠标浏览器实走A/B/C/E/F、预览/失败反馈、保存恢复、2/3信任多人推进和整轮完成；核卡面/分支/0delta/Flow与实际余额、scroll/稳定节点/局部更新，截图保存唯一白名单证据文件，观察细节记Receipt。自动化DOM测试不冒充浏览器验收。
4. 本Task更新实际验收状态、缺陷与剩余事项。运行本Task定向套件、类型/架构/Schema同步/文档检查；不重跑无变化全仓测试。新增相关失败先定位根因，需改白名单外实现交回所属Unit，不在此Unit越界补代码。
5. Receipt必须分开写“自动化DOM/集成测试”和“真实浏览器实测”。前者记命令、环境、文件/数量/退出码；后者记浏览器及启动入口、实际例图/队伍/版本、逐步操作与观察、截图路径/限制。只跑模拟DOM、只做静态截图、浏览器不可用或未亲自操作时，实测一栏必须写未执行及原因，不能沿用测试点击记录宣称实测完成；对应浏览器完成条件仍未完成。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 真实合法Datapack完整链路及宽屏交互有实际证据，OLD/EQ/NEW结果全绿、失败原子/幂等/恢复成立；尚未运行项不得标通过。
- [ ] 自动化DOM测试与真实浏览器操作分栏记录，两类证据各自成立；测试模拟交互未被当作浏览器实测。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-runtime-integration.test.ts tests/ui/gameplay-b-effect-vertical-slice.test.ts tests/ui/gameplay-b-map-vertical-slice.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-save-resume.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 架构 | `npm run check:architecture` | 基础层无反向依赖，不新增业务写入口 |
| 最终联合验证 | 按总Task §6所有新增E1定向测试+既有受影响回归、Schema同步测试；宽屏鼠标实际浏览器 | OLD/EQ/NEW分组正确，完整合法Datapack链路/恢复/事务有证据 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u18-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
