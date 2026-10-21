# Unit 0312-U17：可装载的作者示例与五张验收卡

状态：ready / 未执行；阶段P3。前置：0312-U04实际完成Receipt与测试、0312-U13实际完成Receipt与测试、0312-U16实际完成Receipt与测试。

## Goal

作者能定位并复制一份真实装载且有设施入口的例图；五类卡均具合法来源/目标/资源和明确操作步骤，无旧内容批量迁移。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 源码 | src/arona-clicker/content/gameplay-b-map-datapack.ts：gameplayBMapDatapack.spots/maps；def-factory/spot | 正式可选bundle与设施入口 |
| 合同 | Task本文示例A/B/C/E/F；Draft0312 §11；E0行为金样E1部分 | 作者可直接参考 |
| 装载 | src/data-services/contracts/datapack.ts；registry-map-content-resolver.ts；现有Registry样例测试 | 必须走合法加载/引用链 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

gameplay-b bundle当前提供八张Map及设施mapEntry；可追加独立例图而不批量重写八张旧图。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- 新增（执行时才创建）：src/arona-clicker/content/gameplay-b-effect-program-example.ts
- `src/arona-clicker/content/gameplay-b-map-datapack.ts`
- 新增（执行时才创建）：tests/data/gameplay-b-effect-example.test.ts
- 新增（执行时才创建）：docs/examples/gameplay-b-effect-program-e1.md
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u17-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不增加CardPool/Tag/成长数据，示例不是平衡调整或旧地图规则改写。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. 新增纯声明GameplayMapDef示例（不含handler），包含A射击、B伤害+自身补给、C条件治疗、E真实CardRef减费、F信任/Flag交涉；两个或多个有序activity容纳战斗与non-battle，明确初始资源（含0）、locals与completion condition、合法队伍/候选、出口和resumeVersion。
2. 在既有可选gameplay-b包追加一个例图和对应Spot.mapEntry，旧八张Map正文/版本不变、不强制新包常开。示例TypeScript只是现有打包的数据载体，无任意函数/执行器；同样可序列化为数据。
3. 通过真实Registry装载例图、resolve并创建Owner；schema验证/上下文依赖/零余额/Activity完成组合全通过，旧包合法性保持。不通过裸VM JSON冒充Datapack验收。
4. 新增作者指南说明字段、when时点、费用限制、Counter饱和、Flag寿命、source/primary/Actorless/资源键区别，给可复制完整Action及Encounter引用；链接真实例图和测试。明确无资源条件、无AG、无Status/Pool，说明提高resumeVersion而非迁移旧档。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 作者能定位并复制一份真实装载且有设施入口的例图；五类卡均具合法来源/目标/资源和明确操作步骤，无旧内容批量迁移。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/data/gameplay-b-effect-example.test.ts tests/data/gameplay-b-effect-registry.test.ts tests/data/gameplay-b-map-registry.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u17-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
