# Unit 0312-U15：Runtime查询投影Preview与真实回执

状态：completed — 本页仅保留施工计划；实际修改与验证结果以对应实施 Receipt 为准。
> 现行作者合同与迁移结果以 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和对应 Receipt 为准；本页的旧字段与 legacy 执行说明只记录当时施工计划，不是当前作者入口。

## Goal

卡/来源/Preview/最近Receipt全链不丢新效果或locals，view脱离Owner且反复读取零写；不产生第二次规划安装。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 源码 | src/arona-clicker/runtime/runtime-game-instance.ts：getMapEncounterView/getMapEncounterWorkspaceView/previewMapEncounterSources及actionView/recentCommit/commitPreview装配 | 现有action/source/receipt投影截断点 |
| 源码 | src/arona-clicker/contracts/runtime/runtime.ts：MapWorkspaceActionView/CommitPreviewView/RecentCommitView；src/arona-clicker/contracts/map/map-run.ts：MapRunEncounterSourceOption | 现有数据边界 |
| 依赖 | src/arona-clicker/services/map/map-effect-summary.ts；src/arona-clicker/contracts/map/map-effects.ts | 只读声明摘要与Owner实际计划 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

运行门面有两处action.hpEffects直读和recentCommit分组复制，原投影没有locals/guard摘要。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `tests/engine/gameplay-b-effect-projection.test.ts`：U14已创建，U15扩充真实Runtime投影用例并保留其原声明摘要用例。
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u15-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不修改UI布局或原子Item事务，不实现调度顺序投影。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. Action/Hand/Command/Enemy/Ability/Item投影统一使用U14声明摘要，保留旧兼容字段供现有UI；SourceOption合法性依U03/U10规则，不只检查旧effects数组。
2. 把Owner Commit Preview的实际效果/locals/必要分支摘要及persisted recentReceipt传给readmodel，不在门面重算条件或副作用；只显示已可核的信息，未知／不合法计划保留诊断。
3. 补condition进度只读显示数据和跨Encounter最近回执边界；声明量与实际delta分开，0delta可见，旧分组继续用旧名称查询。可选新字段不使无program旧view失效。
4. 通过GameInstance真实queries反复读取，比较Run/Hand/RNG/draft/库存不变；NEW01/03/Flag及Ability/Item新program的view均与Owner preview/receipt一致，常量折扣不变PlayerCost。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 卡/来源/Preview/最近Receipt全链不丢新效果或locals，view脱离Owner且反复读取零写；不产生第二次规划安装。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-projection.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts tests/engine/gameplay-b-map-relations.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 架构 | `npm run check:architecture` | 基础层无反向依赖，不新增业务写入口 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u15-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
