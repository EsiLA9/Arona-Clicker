# Unit 0312-U10：新Effect程序接权威Planner与原子Commit

状态：completed — 本页仅保留施工计划；实际修改与验证结果以对应实施 Receipt 为准。
> 现行作者合同与迁移结果以 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和对应 Receipt 为准；本页的旧字段与 legacy 执行说明只记录当时施工计划，不是当前作者入口。

### 2026-10-22 实际接线核对与拆分

依据U06–U09实际Receipt：U06已有`planMapEffectSource`、外部`visit`和资源意图账本；U07的`settlementChangesFor`与`applyHpEffects`分别保留旧相位；U08提供`activeEncounter.locals`和复制函数；U09提供`cardPlan.prepareMetadata`。U08/U09根复验3 files / 24 tests通过；两代理报告全局类型、架构与文档检查通过。

实际估算：`map-run-service.ts`新增380–450/删除120–180，净增260–270；`map-effect-planner.ts`净增10–25；新测试560–650；Receipt70–90，合计900–1035行，且尚需contract补版本/访问/资源实际余额字段。原白名单漏掉这些真实接线点，不能用压缩测试掩盖超额。

负责人按本Unit原定拆分条款放行 [[docs/plan-work/task-0312-units/task-0312-u10a-program-planning]]（纯规划）→ [[docs/plan-work/task-0312-units/task-0312-u10b-program-installation]]（公开安装）。每个子Unit手写净改动上限1000行，逐文件预算和白名单见子Unit；不改变E1语义与本页全部验收要求。U11/U12均等待U10B完成，不允许仅凭U10A启动。下表历史“等待前置”描述由本段实际记录取代；原Work Items仍是U10总验收清单。

开工附加条件：负责人根据U06–U09实际Receipt完成下述预算估算及接口核对后才放行。当前尚无前置实现，不能把规划文字当作实际估算；用户2026-10-22已授权按需放宽至1000行，负责人可记录该额度后放行，不因超过500行自动拆分。

## Goal

新程序由公开Preview/Commit链真实生效，旧金样不变，失败零安装、幂等/外部库存不重复；共用语义核但调度仍E1旧序。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 源码 | src/arona-clicker/services/map/map-run-service.ts：resolveEncounterCommitPlan/previewEncounterCommit/prepareEncounterRoundCommit/canInstall/install | 唯一权威执行/安装 |
| 前置 | src/data-services/normalization/gameplay-map-effect-program.ts；src/arona-clicker/services/map/map-effect-planner.ts；src/arona-clicker/services/map/map-encounter-locals.ts；src/arona-clicker/contracts/map/map-run.ts | 共享指令/locals/trace |
| 外部事务 | src/arona-clicker/runtime/runtime-game-instance.ts：commitMapEncounterRound；source-transactions现有测试 | 不改两Owner连续安装合同 |
| 合同 | Draft0312 §11.2、NEW01–NEW04、EQ01–EQ05 | 只采用E1-COMPAT-1 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt，手写净改动常规500行，负责人可按用户2026-10-22授权记录放宽至最多1000行；白名单不随之扩大。生成协议diff单列不计手写行数。超过60k上下文、预计超文件或1000行上限先交负责人调整/拆分。

### 开工前预算与接线核对（负责人填写后放行）

核对U06纯source函数/访问入口、U07兼容相位调用、U08 locals复制/安装挂接点、U09 prepare元数据；只记录已落盘的符号与Receipt。按下表逐文件填写新增/删除/净行数估计，既有可直接复用测试写0并附测试名，不以未实现helper抵减预算。估算记录写入本Unit本小节，由负责人维护，不要求施工代理越白名单。

| 工作量 | 核对依据 | 当前估算状态 |
| --- | --- | --- |
| 权威纯规划接入、source/成本/旧相位适配 | U06/U07实际导出及planner调用点 | 等待前置Receipt，未估 |
| prepare/resolve单一预算及trace汇总 | U06访问入口/U09元数据 | 等待前置Receipt，未估 |
| locals/Receipt/nextRun准备与安装接线 | U08实际状态复制和prepared token | 等待前置Receipt，未估 |
| 新增测试、旧用例复用与事务反例 | 各测试名及可达fixture；规划与公开Commit分别列出 | 等待前置Receipt，未估 |
| 实际Receipt及总量 | 上述逐文件总计；500行常规额度，负责人可按授权记录放宽至≤1000行 | 未放行 |

若预计501–1000行且目标仍清晰，负责人可记录放宽额度并保留本Unit，不预建抽象包装。若超过1000行或实际需要分别验收，优先拆“纯规划接入”和“公开Commit/事务验收”：前者验公开Preview计划/trace/预算与零写，仍阻止未完整安装的新program Commit；后者才移除保护，验证locals/Receipt安装、幂等及跨Owner库存事务。由负责人定义子Unit/白名单/测试映射并同步U11/U12依赖，保留全部E1合同与金样，不由执行代理自行扩范围或删用例。未拆分时完成本Unit全部原验收。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

Preview与Commit同用resolveEncounterCommitPlan；安装后状态从detached plan映射，不应另加效果补写入口。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- `src/arona-clicker/services/map/map-run-service.ts`
- 新增（执行时才创建）：src/arona-clicker/services/map/map-effect-planner.ts
- 新增（执行时才创建）：tests/engine/gameplay-b-effect-program.test.ts
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u10-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不在VM内部写party/Enemy固定循环或新增Scheduler/Actorless执行费政策，不支持资源条件或表达式。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. 移除U03引入并由U07保留的effectProgram执行过渡拒绝；按C0–C6调U06单source规划：party逻辑HP/locals后Ability/Item逻辑通道，形成有序资源账本；起始余额聚合己方非skip Actor/Team成本后兑现资源。legacy仍按原相位标签。Enemy仍逐个当时余额支付/资源/HP并处理后续Enemy折扣。
2. 在外层绑定source/primary和阵营账户，自动目标按当前HP fallback、显式不换人/HP0 delta0；非法Scope/stale整轮拒绝，natural noLegalTarget免费但Command选中费保留。Actorless仅已有unit目标、无额外Action costs，合法选中仍付Ability1/Item1，清敌也保留E1己方整阶段。 直接自定义MapContentResolver不经Registry时也须调用共享校验/受限context重核，禁止因去掉过渡拒绝而放行非法program。
3. resolveEncounterCommitPlan每次调用唯一创建并持有本轮budget：在E1实际prepare阶段将U09纯元数据消费一次，resolve访问由U06通过此轮注入入口报告；任何helper不得另外累加prepare或重置总额。每次Preview和prepare各自从0规划，重放不再执行。汇总E1-COMPAT-1实际trace与旧投影，零delta/guard读数/path保留；Counter/Flag结果通过detached nextRun安装进下一轮locals，trace只作为最近回执。费用/余额/溢出/预算错误全拒绝。
4. 接入现有Prepared token/replayed/itemId流程，绝不新增真实状态写入口；纯Preview重复零写，same request零重复，Item仍由GameInstance校验库存并连续安装。NEW02用真实LATE_EFFECT_COMMIT_MAP Command聚合冲突草稿，不能伪造余额0可抽付费牌。
5. 补整轮4096/4097可达fixture（64来源各64叶子，再添1叶子来源），seed/Hand由Owner生成；NEW01/03/04、EQ01新旧配对、混合旧新来源和Enemy/Ability/Item程序均验证。condition完成仍由U11接，不能在叶子内推进活动。
6. 增加“prepare实际访问P、resolve实际访问R”的计数断言：候选查询不消耗budget；两次同状态Preview及一次prepare各自均为P+R而非跨调用累加；同源prepare不因card资格查询/U06重复计入。对接近4096的含prepare场景验边界，保持legacy不追溯、skip resolve不计。不要把访问去重用作重复规划或执行的掩盖。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 新程序由公开Preview/Commit链真实生效，旧金样不变，失败零安装、幂等/外部库存不重复；共用语义核但调度仍E1旧序。
- [ ] 负责人已记录基于实际前置Receipt的逐文件/测试估算，500行以内或按用户授权记录≤1000行额度；超过1000行时已先拆分并同步依赖，不为压行数提前抽象。
- [ ] prepare和resolve预算均归本轮Planner唯一累计，候选查询/重复Preview/幂等重放无双计或跨调用累计。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-program.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-effect-card-prepare.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-run.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 架构 | `npm run check:architecture` | 基础层无反向依赖，不新增业务写入口 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u10-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
