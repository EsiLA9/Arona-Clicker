# Unit 0312-U19：当前机制沉淀与敏捷任务接续准入

状态：completed — U19 文档收尾已按 [[docs/plan-work/task-0312-units/receipts/task-0312-u19-receipt]] 完成；其前置 U18 按用户指示豁免，没有实机或完整纵向验收证据。

本文件的 Unit 计划记录原定工作范围；实际修改、未执行项与结果以 Receipt 为准。由于 U18 被豁免，本 Unit 的原计划目标“E1验收完成可解除AG前置”并未达成。该前置关系是本 Unit 编写时的旧路由；用户后来明确要求将 AG-1 实施并入 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]，不重开 U18。当前 Map Action 合同与旧数组迁移以 [[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 为准。

## Goal（原计划；后续路由已更新）

原计划要求机制、作者指南、Task/索引和实际证据一致，并以E1验收完成作为AG的前置解除条件。U18后来按用户指示豁免；再后续用户明确要求将已批准的AG-1实施纳入Task 0320，因此这里不再作为当前施工路由。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 实际结果 | U01–U18 Receipt/测试/浏览器证据及U17作者指南 | 只能宣称已实现部分 |
| 规范 | docs/ai/goal-workflow.md；docs/docs-829/05-conventions/doc-maintenance.md；docs/ai/galhcg-project-map.md | 当前事实/计划/归档和只读收尾 |
| 已批后续（历史路由） | Draft0312 §13 AG-1；Task0313 §9.3/§10 | 原计划为E1完成后再实施；现行实施路由见Task 0320，E1豁免仍不等于产品验收通过 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

E1与AG-1是不同执行合同；E0通过不等于产品实现。本Unit编写时规划为E1验收后才解除AG实现前置；该先后已被用户后续指示取代，AG-1现由Task 0320实施。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`
- `docs/plan-work/task-0312-gameplay-b-effect-program-v1.md`
- `docs/plan-work/00-index.md`
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u19-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不虚构测试/批准或直接做AG产品施工、不动无关协议/历史/测试。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. 以实际实现更新Datapack契约页的Map声明/locals/校验/Owner与作者指南入口；refresh-update仅记录新摘要/进度消费与实际局部刷新证据，不把Task当机制事实源。未产生新视觉约定则不造style条目。
2. 逐Unit审核Actual Receipt、测试命令/退出码/未完成/范围外改动，对照OLD/EQ/NEW映射确保没有以删改旧期望掩盖回归；预算/trace/无第二Owner等作严格结构审查。
3. 更新本Task/索引为实际complete或明确未完成，附AG可接续的已验收接口/locals/trace/restore/Owner约束与剩余风险；不在此Task创建或实现AG，不把E2–E5提前列为完成。
4. 累计直接影响路径后按GALHCG changed统一只读复核、读完分页owners/Evidence；无维护授权不改图/刷新/freshness。现行文档全部链接检查、diff空白检查，旧8处错误前后一致单列。归档须在实际核验后按工作流同步Task+units引用，未授权路径移动先交回负责人。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 当前机制、作者指南、Task/索引和实际证据一致；E1验收完成可解除AG的前置实现依赖，后续范围仍独立。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u19-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
