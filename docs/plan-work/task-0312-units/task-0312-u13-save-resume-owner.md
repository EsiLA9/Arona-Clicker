# Unit 0312-U13：Owner快照与严格Save/Resume贯通

状态：ready / 未执行；阶段P3。前置：0312-U11实际完成Receipt与测试、0312-U12实际完成Receipt与测试。

## Goal

公开Save/Load含locals/trace可严格恢复并继续，新旧内容兼容边界明确且无迁移；恢复失败零安装，幂等和库存事件次数正确。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 源码 | src/arona-clicker/services/map-run-service.ts：snapshotOf/restoreEncounterSnapshot/restoreRunState/restoreEncounterCommitReceipt/restoreSaveSnapshot/createSaveSnapshot | 全部保存/恢复入口 |
| 源码 | src/arona-clicker/runtime-save-codec.ts：buildSaveData；runtime-save.ts恢复接线；src/arona-clicker/contracts/save-data.ts | 现有SaveData.mapRun直接序列化 |
| 前置 | src/arona-clicker/services/map-effect-receipt-validator.ts；src/arona-clicker/services/map-encounter-locals.ts | 纯校验接入 |
| 金样 | EQ05、NEW03/04/05/07 | 跨轮、跨Encounter、幂等恢复 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。最多4个变更文件加自己的Receipt；常规500行，负责人可按用户2026-10-22授权记录放宽至最多1000行，不扩大白名单。生成协议diff单列不计手写行数。超过60k上下文、预计超文件或1000行先交负责人调整/拆分。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

SaveData.mapRun直接JSON复制MapRunSaveSnapshot；Owner恢复严格按字段校验，不能只新增interface。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- `src/arona-clicker/services/map-run-service.ts`
- `src/arona-clicker/contracts/map-run.ts`
- 新增（执行时才创建）：tests/engine/gameplay-b-effect-save-resume.test.ts
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u13-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不新增顶层历史状态/结果存档Owner、AG输入或存档迁移。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

开工先读取U10/U11/U12实际Receipt，列“实际快照/trace字段→序列化→Owner restore→末值互校→公开Save/Load断言”映射。工程路径/符号变化由负责人局部修订白名单，不修改已批准恢复能力边界；预计超500行可按用户授权记录≤1000行额度，超1000行或需独立验收再拆接线与公开恢复验收，不提前包装、不扩大版本迁移或历史系统范围。

1. 接U12至legacy/new/混合Receipt恢复，扩activeEncounter locals/最近trace的严格字段与复制/冻结；带新声明缺locals、bool非法、Counter越界、未知键/Scope/版本/分组损坏全部拒绝，保持Owner未安装。
2. 定义E1 programReceiptVersion/executionContractId与MapRun checkpoint新格式的最小版本边界；不兼容内容提高resumeVersion，不写旧档迁移。不改顶层SaveData.version 1.0.0或通用codec权限，现有MapRun嵌套数据透传无需复制第二份状态；若直接证明需改顶层封装，先上交调整白名单。
3. 经GameInstance真实Save/Load测试：含合法Item草稿、trust2保存再+1恰好完成、Flag反复修改、HP0与零delta、混合旧新Action、多activity上一Encounter trace残留；恢复后的后续结果与相同种子不停局完全一致。
4. 同request重复Commit/Save/Load后不重复扣Actor/Team/PlayerCost/库存/Counter；冲突request拒绝。新格式损坏拒绝，未用新合同的旧Map沿原读法合法。不要将terminal Run伪造为可恢复active checkpoint。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 公开Save/Load含locals/trace可严格恢复并继续，新旧内容兼容边界明确且无迁移；恢复失败零安装，幂等和库存事件次数正确。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-save-resume.test.ts tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 架构 | `npm run check:architecture` | 基础层无反向依赖，不新增业务写入口 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u13-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
