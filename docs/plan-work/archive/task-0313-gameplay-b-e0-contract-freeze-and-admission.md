# Task 0313：Gameplay B E0 合同审阅与施工准入

状态：complete（E0文档交付）— U1–U5均完成并归档；当前实现证据、推荐合同、行为用例和准入材料齐备。八项玩法选择已由用户2026-10-21“全部按推荐”批准；E1可拆产品Unit，敏捷等待E1前置实现，两者均未实现。

本文回答：施工者如何核实当前 MapRun，回写 Effect E1 合同并形成独立敏捷度 Runtime 施工的准入材料。

## 1. 目标、依赖与文档归属

本 Task 是 [[docs/plan-work/task-0312-gameplay-b-effect-program-v1]] 的前置设计冻结工作，来源为用户 2026-10-21《Sol 策划请求：调查并建立 Gameplay B E0 可施工子 Task》。长期原语规划仍在 [[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]]；本 Task 只定义调查、裁定记录、样例与验收，不建立第三份完整效果设计。

为什么先做 E0：0312 的费用双通道、Counter 越界与目标失效尚待冻结；本次新增统一敏捷度将打破当前敌我分阶段结算，必须先划清“E1 保持旧行为”与“敏捷度有意改变行为”，才能给两个产品 Task 一致的接线合同。

- **创建轮范围（历史记录）**：本 Task、五份 Unit、必要索引登记；不执行任何 Unit，不回填虚构结果，不改产品源码。
- **本轮 E0 执行范围**：只读源码／现有测试、运行既有定向测试、推演输入输出、更新指定文档与 Receipt。允许设计完成而产品施工继续等待玩法批准。
- **明确非目标**：实现 Scheduler／敏捷字段、Effect Program、Counter／Flag、Schema、测试产品代码、准备页或外部培养 Adapter；不生成新敏捷度实施 Task 编号，不扩大成全仓审计。
- 已完成 [[docs/plan-work/task-0309-maprun-staging-and-reentry-workspace]] 不再阻塞；Report 0311 仅作历史线索，其“准备页／旧 UI slice 失败”不能代替当前结果。

| 文档 | 唯一职责及 E0 回写 |
| --- | --- |
| Draft 0312 | 玩法设计理由、备选及批准记录；新增一个 E0 裁定表和独立敏捷度合同节，更新已有冲突段落 |
| Task 0312 | E1 可施工合同／验收；替换其 E0/P0 简述为本 Task 依赖，明确 E1 采用哪一版执行合同 |
| Task 0313（本文） | Unit 状态、证据路由、决策 ID、准入结论；不复制冻结后的完整字段合同 |
| task-0313-units/current-behavior-evidence.md（U1 未来产物） | 有界的当前源码／测试证据，不写未来玩法正文 |
| task-0313-units/behavior-cases.md（U4 未来产物） | 带合同 ID 的输入／预期／回归分类，不另立设计权威 |

产物由对应Unit在白名单内创建，实际完成状态以§9执行结论为准；创建阶段未产出，不能沿用其历史“未创建”断言作为执行结果。合同正文以 Draft 的裁定记录和 Task 0312 的 E1 实施合同相互核对。本文决策表只是工作清单。

## 2. 已核实的调查入口（2026-10-21）

基线 HEAD `dff0061`；当前工作树含未提交的 0312 草案及协作协议改动。执行者须记录自己的 HEAD、相关路径差异，不覆盖既有工作。以下只用于制定 Read Set，U1 仍需按开工工作树核证。

| 当前事实 | 源码／测试位置 | 对 E0 的意义 |
| --- | --- | --- |
| 作者 Action 尚无敏捷度或 effectProgram；旧字段为 costs/effects/hpEffects/cardEffects | `src/data-services/contracts/gameplay-map.ts`：GameplayMapActionDef、GameplayEncounterDef | 新敏捷度、Counter／Flag 均是未来合同，不称已接线 |
| 己方先规划 HP／目标与跳过，再聚合起始余额费用，应用资源，然后 Ability/Item HP，检查终局，最后 Enemy 逐个执行 | `src/arona-clicker/services/map-run-service.ts`：resolveEncounterCommitPlan（当前约959–1493行） | “统一排序”会改真实结算；不能只改卡面顺序 |
| 己方 noLegalTarget 可不付 Actor/Team 成本，但 PlayerCommand 的 PlayerCost 累计先于 skip；敌方检查当时余额，不足则 unaffordable | 同函数 requiredCosts、playerCostRequired、enemyActionCostsArePayable；`tests/engine/gameplay-b-map-run.test.ts` 中 “keeps an already paid PlayerCommand fee…” 等 | 禁止概括成所有 skip 免费／所有来源起始余额预检 |
| 显式目标不悄换，自动目标会按规划 HP fallback；HP0 普通治疗实际delta0；Enemy 有 defeated/noLegalTarget/unaffordable/roundEnded | 同函数 applyHpEffects、preparedEnemyActions；map-run.test.ts 中 “preserves a manually confirmed sole default target…” 等 | 合法后倒地与伪造目标必须分开 |
| 费用折扣先于支付，己方预处理，敌方只影响后续 Enemy；常量相加并截到原始 sCost | `services/map-card-effects.ts`：resolveMapCardEffects/mapScostCost；planner enemyDiscounts/enemyOrder | 混合排序后的折扣适用对象与时机必须显式裁定 |
| CardRef 有 run/map/node/activity/round Scope；CardInstance 有 Owner、zone、logicalIndex | `contracts/map-cards.ts`、`services/map-card-catalog.ts`：catalogMapRunCards | 未用候选／UI 副本不参与结算，Actorless 不伪造角色 CardRef |
| Preview／Commit 共用 planner，prepared token 后安装 | MapRunService.previewEncounterCommit/prepareEncounterRoundCommit/canInstallPreparedEncounterCommit/installPreparedEncounterCommit | 排序输入及解释结果须可复现，不能 UI 或 Commit 各算一版 |
| Item 通过 GameInstance 协调库存计划，两 Owner 重核、连续安装后才发事件 | `src/arona-clicker/runtime-game-instance.ts`：commitMapEncounterRound；source-transactions.test.ts | 若 Item 被跳过，库存是否扣除是明确合同，不能仍一律返回 itemId 扣一件 |
| Receipt 分己方 settlements、enemyActions、ability、item；没有统一执行序列；恢复严格验证字段、次序与费用 | `contracts/map-run.ts`：MapRunEncounterCommitReceipt；MapRunService.restoreEncounterCommitReceipt/restoreEncounterSnapshot/restoreRunState | 新排序不能靠重排旧分组数组表达；需定义有界摘要和恢复版本 |
| 余额键从旧 costs/effects 与 initial 声明物化；新 Encounter 种子由 Owner 分配 | MapRunService.initialResourceBalances/initializeEncounterSeed/createEncounterSnapshot | 核实类型定义与局内余额区别；确定性风险只定向核证，不借机重做 RNG |
| 0309 已 complete，实际 slice 先 map-entry 再 start／continue | Task 0309 状态；`tests/ui/gameplay-b-map-vertical-slice.test.ts` | 不继承 Report 0311 的历史入口失败结论 |

表中 `services/`、`contracts/` 缩写均相对 `src/arona-clicker/`。行号仅定位，符号与最新代码优先。

## 3. 裁定状态与必须覆盖的合同清单

每条裁定记录ID、状态、精确推荐规则及可观察结果、来源、代码证据、推荐理由、批准依据（如有）及受阻Task/用例ID。按用户2026-10-21本轮要求：先给推荐默认，只有实质玩法差异才列备选；工程默认不全部升级为审批。AI推荐不算人类批准。D06/D07/D08及兼容/实施次序中的技术选择可据证据作工程裁定，改变玩家结果的分歧仍建议待批。

五种状态（本轮增加工程默认，以落实用户要求）：
- **已确认**：人类明确要求的规则；后续用户明确批准的条目也归此类，必须附依据。
- **待核实**：当前源码事实；核实后写入 U1 证据并标记“已核实事实”，不自动升级成未来玩法批准。
- **建议待批**：影响玩法但无批准；推荐与分支预期都必须保留。
- **后续范围**：E0 不实现，按影响区分是否阻塞当前准入。
- **工程默认**：不改变玩法选择的技术合同，或按已有要求保留旧行为的接线决策；给依据、结果和验证职责，不伪称人类玩法批准，也不加入必选审批表。

### 3.1 已确认需求（不可作为重新开放的选型）

| ID | 用户已明确的规则 |
| --- | --- |
| A01 | 所有本轮实际参与结算的卡牌行为按最终敏捷度统一排序，改变真实结算顺序 |
| A02 | 卡牌有基础及最高敏捷度，角色侧补足；补足不能突破卡牌上限 |
| A03 | 只有最终敏捷度相同时才比较下一级；下一级再相等时我方优先 |
| A04 | 敏捷度当前只影响执行顺序，不影响抽取概率、行动次数、费用或效果数值；排序带来的死亡／跳过后果须另作合同，不能暗改数值公式 |
| A05 | 数据包声明式，无任意 Handler；仍由 MapRun 唯一 planner／Owner，Preview、Commit、Receipt、Save/Resume 一致 |
| A06 | 敏捷 Runtime 独立后续施工，不混入 Task 0312 的 E1 Effect Program；本 E0 仅设计与文档 |

`min(base + actorAgility, max)`、Actorless补足0、缺省base=max=0和二级比较base，已随用户2026-10-21“全部按推荐”批准（P4/P5）；工程字段位置不另升级为玩法审批。

### 3.2 Unit处理清单（本轮玩法已批准；原问题保留作追踪）

| ID／主责 | 当前状态 | 要裁定／核实的具体问题；交付证据 |
| --- | --- | --- |
| D01／U2 | 已确认（P1–P8批准记录见§10） | Action 内 sequence 与 when/else 的读取时刻；HP／Counter／Flag后读可见，资源读数限制；4/10先heal3再判断 vs guard前置，两者分支输出 |
| D02／U2→U3 | 已核实事实＋已确认／工程默认（见§10） | 己方起始余额聚合与 Enemy 逐个支付的当前差别；高速补给能否资助低速费用、跳过谁付何种成本、sCostDiscount阶段及失效源折扣。E1兼容与敏捷新规则各有一张阶段表 |
| D03／U2 | 已确认（P1–P8批准记录见§10） | Counter饱和／严格／显式有限策略；trust=2、max=3、两次+1、负增量低于min、重复修改、safe integer溢出、initial范围、跨轮／新Encounter／存档；Flag仅bool |
| D04／U2→U3 | 已核实事实＋已确认／工程默认（见§10） | 外来非法目标、合法后倒地、自动fallback、来源倒地、skip支付；每种来源在混合排序中均有规则 |
| D05／U2→U3 | 已确认（P1–P8批准记录见§10） | 战斗即时停轮或阶段结束停轮、未执行治疗／Ability／Item、双方全灭优先级；非战斗condition整轮后检查及与rounds/manual互斥 |
| D06／U2 | 已核实事实＋工程默认（本轮） | resourceId局内键 vs AC Resource类型定义；声明／余额物化、每个引用Encounter locals、所有source上下文验证；跨Map复用扩展边界 |
| D07／U2→U3 | 已核实事实＋工程默认（本轮） | Receipt必要实际delta／path／guard摘要、排序可复现输入、checkpoint严格验证、幂等、resumeVersion／格式版本；不保存完整历史世界 |
| D08／U2 | 工程默认（本轮） | 原建议program64／depth4／prepare8／locals64／round4096如何计数、预算失败是否全回滚、旧内容是否豁免；后续集合32／repeat8／expansion1024不作为E1实现 |
| D09／U3 | 已确认（P1–P8批准记录见§10） | 敏捷字段位置、数值域、base≤max、缺省值、角色补足来源／快照、公式／溢出；无现成角色培养快照时的最小局内声明方案 |
| D10／U3 | 已确认（P1–P8批准记录见§10） | 第二级比较：基础敏捷度等有限方案；完全同速的稳定尾键。比较(final=5, base=4)与(final=5, base=2)必须有不同方案的顺序 |
| D11／U3 | 已核实事实＋已确认／工程默认（见§10） | Prepared／Swap／PlayerCommand／Ability／Item／Actorless／Enemy／Wait是否生成调度条目、所属阵营／Actorless补足、换牌后重排、排序快照时机 |
| D12／U4→U5 | 已核实事实＋工程默认（本轮） | 旧表达迁移等价清单与敏捷有意变更清单、E1/敏捷先后关系、共同接线依赖、执行合同版本与各自阻塞项 |

E1 op／字段也仍按 Task 0312 待审状态处理；U2审阅其全部最小合同，不仅看新增 D03。资源条件、Status、集合、Card Tag／CardPool、外部成长 Adapter不因调查敏捷来源而提前进入产品范围。

## 4. 施工 Unit 与顺序

采用 [[docs/ai/PROJECT-CONSTITUTION]]；超过三个 Unit，故拆同级目录。每 Unit 开工前复述 Goal／Allowed Files／Non-goals／Stop Conditions；结束按 [[docs/ai/templates/execution-receipt]] 写实际 Receipt，不预填通过。

| Unit | 独立交付与可观察完成点 | 依赖 |
| --- | --- | --- |
| [[docs/plan-work/archive/task-0313-units/u1-current-behavior]] | 当前阶段／费用／目标／终局／保存证据表及0312差异，既有测试实测 | 无 |
| [[docs/plan-work/archive/task-0313-units/u2-effect-contract]] | 在Draft／Task0312对应位置回写E1裁定，待批项有有限方案和阻塞标记 | U1证据可用 |
| [[docs/plan-work/archive/task-0313-units/u3-agility-contract]] | Draft增加独立敏捷合同，混合来源阶段与E1兼容边界明确 | U1、U2的现有结论；不强求先批准 |
| [[docs/plan-work/archive/task-0313-units/u4-behavior-baselines]] | 旧基准／E1迁移／敏捷新行为三组可转测试输入输出与裁定关联 | U2、U3已记录所有分歧 |
| [[docs/plan-work/archive/task-0313-units/u5-writeback-and-admission]] | 文档逐段消歧、两张施工准入表、独立敏捷Task需求交接及实际验收证据 | U1–U4文档工作完成 |

预计每Unit 3–5个写入文件、约300–500行净改动以内；Read Set按符号有界读取。只读测试执行不等于新增测试实现。

Receipt允许未来创建的精确路径为 `docs/plan-work/archive/task-0313-units/receipts/task-0313-u1-receipt.md` 至 `u5.md`，各Unit只能写自己的Receipt。不得提前制造Receipt文件或虚构批准／执行状态。

## 5. 回写与后续准入判定

### 回写映射（本轮U2／U3／U5执行）

| 位置 | 必须修改的合同，避免保留相反正文 |
| --- | --- |
| Draft0312 §5.1–5.5／§11 | when、费用两通道、Counter越界、目标、结束、预算及裁定状态；统一ID，明确E1与敏捷规则版本 |
| Draft0312 §9 A/B/C/E/F、§10 | 样例与Counter政策一致；E0改为本Task依赖，敏捷列为独立目标；E2–E5边界保留 |
| Draft0312 新增“敏捷执行合同／E0裁定记录” | A01–A06来源、D09–D11推荐／批准、Source矩阵、排序／支付／跳过／终局合同与验收ID |
| Task0312 §3–§6／§8 | 精确E1语义、旧行为等价、trace/save/作者校验；删改与已采用合同冲突的断言（如一律Counter越界失败） |
| Task0312 §7 E0/P0、状态、§9 | 明确依赖0313结果，E1继续禁止Scheduler；保留历史测试日期，不把E0测试伪装为原轮结果 |
| 本Task与索引 | Unit实际状态、证据、pending列表、E1／敏捷分别准入；索引不宣布未批合同可施工 |

### E0文档完成与产品准入是两个判定

E0可标记文档工作 complete 的条件：五个 Unit 有实际Receipt；事实证据、原文回写与样例完整；每个待批条目有有限方案、推荐、行为差异、阻塞归属；无文档冲突。未批准可明确写“建议待批”，不能写“合同全冻结”。暂停／中断的Unit仍不得计完成。

U5必须分别填写：`可施工 / 等待批准 / 等待事实证据 / 等待前置实现`，并列裁定ID／证据／下一动作：

- **Task0312 E1准入**：D01–D08及D12中影响E1的条目全部有批准或明确的非玩法技术裁定依据；旧格式基准完整、纯计划／Owner／存档和作者校验可拆正式产品Unit；明确采用旧调度兼容合同。敏捷第二比较未批可仅阻塞敏捷，但若支付／终局共享合同还会改变E1，则E1也等待。
- **独立敏捷Runtime准入**：D02／D04／D05／D07／D09–D12全部必要分歧有批准；有完整source排序表、Actorless政策、折扣／费用／skip／终局样例、版本和保存策略。不得以现有CardRef仅有角色Owner而排除Ability／Item调查。
- **先后建议须审阅**：优先E0→E1旧调度等价→独立敏捷重排。可并行设计，不默认并行修改同一planner/restore；若拟先做敏捷，须先重写Task0312兼容基准与目标合同并获批准，禁止双方按不同阶段表各自开工。
- U5在本文追加“敏捷Runtime后续需求交接”：目标／非目标、获批合同链接、候选文件职责、依赖、必跑用例与剩余批准；它是下个Task的准入材料，不是本次顺手实现或预授权。

## 6. 测试、验收与提交

本 Task 没有产品代码／测试新增白名单。U1允许运行指定既有测试；U4产出文档化fixture输入及期望，后续产品Task转成自动化测试。不得为达到E0完成伪装原型运行时已实现。

- [x] U1记录实际阶段、费用与skip差异、目标、终局、Receipt／checkpoint／随机路径，证据带当前文件符号或测试名。
- [x] D01–D12无遗漏，状态与批准来源可追踪，任何未批项均未被升级为实施合同。
- [x] U4每例具备初态、草稿／来源、执行规则版本、顺序、目标、费用／库存、HP／locals、终局、Receipt／恢复断言；未批准只能给分支期望。
- [x] E1旧行为等价与敏捷新顺序分开，当前无法支持的新行为不以既有测试通过作证明。
- [x] Draft／Task0312对应段落全部同步，不只新增一个“覆盖上文”的附录。
- [x] 两张准入表和后续敏捷需求交接完整；E0完成不等于产品准入通过。
- [x] 文档链接／唯一文件名／白名单／空白差异核对完成；仅本Task所属文件可纳入提交，不使用全量暂存覆盖并行改动。

文档验证：`npm run check:docs`、`git --no-pager diff --check`；新未跟踪文档另查尾随空白。既有错误记录基线与新增差异；与本次无关且前后一致的8处旧Operation路径错误不要求越界修复，也不能记成check通过。新错误或无法解释的失败按停止条件上交。

Unit完成／中断均写Receipt；未要求本轮自动提交Git。若后续明确提交，显式选择本Task白名单文件，提交说明区分“E0设计交付”与“玩法获批／功能实现”。完成或冻结后的归档按现有工作流，由收尾者同步所有引用，不在尚未执行时归档。

## 7. 创建轮核验与剩余工作（2026-10-21历史记录）

本轮只完成Task与Unit创建、索引维护，未执行U1–U5、未批准任何玩法、未改产品源码或产品测试。创建前文档检查有8处既有Operation路径错误。创建后的验证及GALHCG只读结果记录在下方；不沿用上一轮167项通过作为本轮执行证据。

- 最终 `npm run check:docs` 扫描1081篇，仍为创建前相同8处旧Operation路径错误，无本次新增错误；检查整体非零，未记作通过。创建中发现的一处save codec路径已改为当前真实路径并重检。
- `git --no-pager diff --check -- docs/plan-work/00-index.md` 通过；六个新增文档独立尾随空白检查无命中。未运行游戏测试、类型检查、Schema生成或浏览器验收，因为本轮只创建施工说明。
- 工作期间另有产品测试文件出现未提交差异，不属本次修改，未回退／暂存／纳入交付；0312原文也未在本轮修改，回写留给U2/U3/U5。

剩余：执行U1–U5、获得必要玩法批准、分别建立E1产品Unit与敏捷Runtime正式Task，之后才实现产品。E2–E5仍是长期方向。

## 8. 创建轮GALHCG记录与相关路由（本轮结果另见§9）

- 发现：已以工作目录核对project_id=acprogram；graph_search“Gameplay B”命中当前Map-only概念及旧Operation概念，回源码区分，不沿旧CardPool推断MapRun能力。
- 收尾：六个新增Task／Unit路径的changed检查均返回unreferenced_path（无直接Evidence或maps_to），不等于文件不存在。索引为content_changed，owner_offset 0、5两页读完共9个owner，末页complete=true；未扩图审计。查询不授权改图／刷新／写freshness，本轮均未写入。
- 未来E0收尾由U5合并直接影响路径统一复核，逐页读完owner／Evidence；无维护授权只记录诊断，不改图。

路由：[[docs/ai/goal-workflow]]、[[docs/ai/PROJECT-CONSTITUTION]]、[[docs/ai/templates/patch-unit]]、[[docs/ai/templates/execution-receipt]]、[[docs/ai/galhcg-project-map]]、[[docs/docs-829/05-conventions/doc-maintenance]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/05-conventions/testing]]。

## 9. E0执行结论与准入（2026-10-21本轮）

### 开工边界及上游修正

Goal：依次执行U1–U5，交付设计文档，不实现产品。U2允许两份0312、总Task和自己的Receipt；U3允许Draft、总Task和自己的Receipt；U4允许behavior-cases、总Task和自己的Receipt；U5允许两份0312、总Task、索引和自己的Receipt。Non-goals与停止条件沿各Unit：越界/超预算、事实冲突或新增必需验证失败须定位并交负责人调整，不伪造批准。

本轮U2文档检查出现新的R2重名：计划指定的receipts/u1.md与archive/task-0300-units/receipts/u1.md冲突。负责人据实际检查修正五个Unit的Receipt白名单为task-0313-uN-receipt.md，迁移刚生成的U1回执，同步证据/Task引用；核验后按goal-workflow将本Task及units整体归档，更新两份0312与索引及内部引用。只迁移本系列，不改旧归档，不扩大产品范围；这是内部文档命名修正，无玩法审批。五个Unit入口已随实际Receipt更新执行状态，原创建轮语句仅作历史边界。U1四文件78项通过，U2主文D01–D08完成推荐/工程分类，后续见本节最终状态。

### 9.1 产物、审查与执行状态

- U1：[[docs/plan-work/archive/task-0313-units/current-behavior-evidence]]，四文件78项通过（46/18/7/7）；实际 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u1-receipt]]。
- U2：Draft0312 §5/§9/§11和Task0312 §3–§8主体回写；实际 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u2-receipt]]。E1保留旧调度；U2交付当时D01/D03/D05待批，后续用户已批准（见§10）；其余技术规格有默认结论。
- U3：Draft0312 §13独立AG-1数值/source/排序/支付/折扣/跳过/终局/保存合同；实际 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u3-receipt]]。未实现Scheduler、字段、培养Adapter或UI。
- U4：[[docs/plan-work/archive/task-0313-units/behavior-cases]]，OLD/E1-EQ/E1-NEW/AG分组覆盖D01–D12及最低矩阵，真实草稿/目标/费用/终局/预算推演，未新增或运行新产品测试；实际 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u4-receipt]]。
- U5：主体消歧、八项决策、两张准入及独立敏捷接续材料完成；文档核验和归档引用同步完成，GALHCG直接范围已只读核查。实际 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u5-receipt]]。

U1证据中“全skip免费”一栏由负责人改为防误读说明，原Task并未断言所有skip免费；这次审阅澄清读法，不虚构原文错误。第二位Luna作独立只读合同审查：Actorless成本与prepare资格、合法补给草稿三项已闭合；随后指出U1来源矩阵的Actorless成本措辞，负责人对照Registry/isActorlessSourceAction一并修正。U4另复核旧Enemy先查sourceHP而AG先查terminal的区别、动态预算可构造性及地图/Encounter资源声明范围。未留下需要扩大产品或用户审批的技术问题。

### 9.2 产品选择表（P1–P8已全部批准）

批准人：用户；日期：2026-10-21；本会话原话：**“全部按推荐”**。用户对应上一答复及本表P1–P8，全部采用推荐栏；备选为未采用留档，不构成并列实施选项。完整批准结果同步Draft0312 §11/§13。批准合同不等于产品已实现。

| 选择ID | 适用产品 | 已批准方案及可观察结果 | 未采用的实质玩法备选（留档） |
| --- | --- | --- | --- |
| P1／D01 | E1、AG共用程序 | when到达时读当前值，允许else，E1不读资源；HP4先治3再判半血不奖励，先判则奖励 | 卡开始快照读值：先治再判仍奖励 |
| P2／D03 | E1、AG共用Counter | 饱和到min/max；trust2/max3两次+1→3，实际+1、0，不因进度溢出废整轮 | 严格越界整轮拒绝 |
| P3／D05 | E1、AG的non-battle | 全轮合法效果完成后判condition；达标后仍结算本轮后续来源 | 每来源后即时结束，后续不执行/不收费 |
| P4／D09+D11 | 仅AG | final=min(base+角色补足,max)；Actorless补足0，缺省base=max=0；2+10/cap5→5 | min(max(base,角色补足),max)：4和3合成4而非7；Actorless借队长会改变道具先后 |
| P5／D10 | 仅AG | 最终同速先比基础敏捷，再同我方先；final5的base4在base2前 | 次级比角色补足：同例补足3的base2在补足1的base4前 |
| P6／D02-AG | 仅AG | 逐源先支付后效果；高速补给可资助后续；来源skip免Actor/Team/Ability/Item费，Command选中费仍收1 | 起始预留则高速补给不能救聚合缺费；skip也付执行费会白扣资源/道具 |
| P7／D02-DISCOUNT | 仅AG | 准备期双方先统一折扣，来源后倒地不撤；慢支援倒地仍已帮队友减费 | 折扣源执行时才生效，被抢先击倒则无折扣 |
| P8／D04-AG+D05-AG | 仅AG | 实体来源倒地不出手；同源完成即判战斗终局，失败优先；清敌后慢Item不执行、不耗库存 | 倒地仍行动/整队列末判：可能反击、慢Item仍消耗 |

D02/D04的E1旧兼容、D06资源/引用校验、D07 trace/restore版本与恢复能力、D08预算计数、D12先E1后AG，以及字段名/函数拆分/稳定尾键均由工程侧按证据决定，不在审批表。Status、Pool、外部成长等后续范围也不混入本次必选项。P6执行费是否付仅对真正skip有意义：显式合法目标后来倒地但仍未终局，按保留规则执行HP delta0，其他effects和费用照常，不能误当免费skip。

### 9.3 两张产品准入表

**Task0312 E1**

| 判定 | 依据/剩余ID | 下一动作 |
| --- | --- | --- |
| 可施工（合同准入通过） | P1/D01、P2/D03、P3/D05已批准；其余E1项为兼容事实或工程默认；采用E1-COMPAT-1，U1及U4为行为基准 | 可拆正式产品阶段P1–P3的Unit/白名单并实施验证；本次批准回写未执行产品Unit |
| 事实证据 | 当前MapRun阶段/source/费用/目标/终局/Save已核，U1基线78通过；新program没有运行证据 | 在产品Unit先转化EQ/NEW文档用例；新Encounter prepare种子路径补最小定向断言，不报告未复现bug |

**独立敏捷Runtime**

| 判定 | 依据/剩余ID | 下一动作 |
| --- | --- | --- |
| 玩法合同已批准 | 共用P1–P3及敏捷P4–P8均已获批；采用AG-1，D07-AG/D12为工程默认；A01–A06不重开选择 | 按下一节准备独立正式Task；不再等待玩法批准，实施仍受下一行E1前置依赖约束 |
| 等待前置实现 | 工程推荐E1-COMPAT-1原语/trace/locals/restore先通过验收；当前均未实现 | 可并行设计，不默认并行修改同一planner/restore；不在0312夹带Scheduler |

“事实证据已具备”只指设计所需的当前事实，不等于新玩法运行测试已通过。新Encounter种子路径的后续定向测试是产品Unit的回归任务，不要求用户选择RNG内部实现，也不借机扩大为随机系统重构。

### 9.4 敏捷Runtime后续需求交接

- **目标/非目标**：所有实际来源由MapRun唯一planner按批准后的敏捷合同执行并可解释；不改变候选资格/抽牌权重/次数/费用数值公式，不接培养Adapter、不做Status/集合/Pool/任意Handler，不新建状态Owner。批准来源沿A01–A06；P1–P8已由本轮用户“全部按推荐”批准，获批合同见Draft §11/§13及本文§10。
- **权威合同**：Draft0312 §11 E1-COMPAT-1与§13 AG-1；全部裁定ID保留，共享费用/目标/终局的版本差异已列。Task0312只做旧兼容E1。用户若改P1/P2/P3，两个合同与相应用例同步；只改P4–P8无需重新审批未受影响E1。
- **候选职责**：gameplay-map作者值/Registry严格校验/生成Schema；map-run来源与数值快照/有界序列；现有planner接纯排序和source适配；map-card-effects新准备政策；GameInstance依据实际Item消费做双Owner计划；ReadModel和现有宽屏鼠标UI展示同一计划次序及原因，不单独计算。所有新增文件在正式产品Unit冻结，不把候选路径冒充已有API。
- **事务/保存**：草稿版本改变重排并使旧token失效；同源完整后终局；skip成本矩阵不得遗漏Command例外；program/排序格式与内容resumeVersion严格拒绝不兼容checkpoint；排序重算和trace链互校，不声称从事后状态验证完整历史；库存只在实际消费的来源安装一次，事件在两Owner安装后发布。
- **必跑用例**：U4 OLD/EQ保留E1旧语法等价，NEW验证条件/locals/作者负例/预算，AG01–AG11验证真实次序/同速/Actorless/Swap/抢先倒地/折扣/支付/终局/库存，EQ05验证幂等Save/Resume；额外捕获跨activity prepare seed分配边界。运行现有source-transactions、map-cards、map-run、save-resume及Registry相邻测试，字段落地时生成Schema/同步测试/类型与架构检查，最终宽屏UI展示与Commit对齐。
- **接续限制**：本轮不分配新Task编号，不创建产品Unit，不提交Git；E0完成不等于E1或敏捷Runtime已实现、已批准或可立即施工。

### 9.5 最终验证与交付边界

- U1指定四份engine测试78/78通过（run46、cards18、source-transactions7、save-resume7）；U4的新程序/敏捷用例只作文档推演，不虚报运行通过。独立Luna审查与主Agent复核修正Actorless成本/折扣、补给合法草稿、OLD/AG的Enemy skip优先级、共同HP目标、作者声明层级和预算输入。
- 本轮文档检查保留8处原有Operation路径错误；原计划Receipt短名产生的新增R2重名已修正。归档后再次核对全部链接与唯一文件名；整体check:docs非零，不能记为全通过。空白检查与新增未跟踪文件尾随空白另核，详U5回执。
- 归档只移动本Task及整个task-0313-units到archive，白名单/内部引用/Task0312/索引同步；Draft0312继续活跃；E0交付当时Task0312为contract-review，用户后续批准后已更新为contract-ready（见§10）。未改产品源码/测试/数据包/生成文件，未暂存或提交Git，未覆盖原有工作树改动。
- GALHCG归档后按直接文件逐路径只读changed复核；索引content_changed，owner_offset0和5两页共9项（6条Evidence、3条maps_to导航）读完，末页complete=true；其余本轮新规划文件无直接Evidence/maps_to，返回unreferenced_path不等于文件缺失。无维护授权，不编辑图/刷新/写freshness；查询参数曾因owner_limit上界及changed不接受evidence_limit被拒，按实际返回与帮助调整后才取得有效结果，未将失败调用算核验。
- 剩余工作为正式产品Unit拆分、E1实现验收及独立敏捷Task的接续实现；P1–P8必要玩法选择已批准。当前无需要用户裁定的内部实现细节；后续Status/Pool/成长等仍在后续范围。

- 地图最终直接范围为16份文档：索引外15份（包括U5新回执）均unreferenced_path；索引两页owner已读完。归档迁移的补充只读盘点complete=true、all_evidence_complete=true、review_complete=true，旧Task/units在当前图均0 File/关系/Evidence，impacts=0；旧磁盘路径已缺失是本轮已归档的预期，新Task文件/units目录存在。工具的old_path_missing提示不作为继续图迁移的授权，本轮不做图迁移/刷新，未留下产品准入需要用户处理的地图事项。

- 最终实测：归档和五份回执全部落盘后check:docs扫描1088篇、退出1，仍是同8处旧错误，无新增；diff --check退出0，16份直接文档尾随空白0处。U1–U5设计交付complete；后续用户已批准P1–P8，E1合同准入通过，敏捷只等待E1前置实现。

## 10. 用户批准回写（2026-10-21）

用户在审阅上一答复的P1–P8推荐及可观察结果后，明确回复：**“全部按推荐”**。这是本会话人类批准来源，覆盖八项全部推荐：D01、D03、D05的共用程序/Counter/non-battle规则；D09/D11的加法补足/上限/缺省/Actorless0；D10以base作二级、再同我方先；D02-AG逐源支付及skip成本/Command例外；D02-DISCOUNT准备期双方先统一折扣、来源后倒地不撤；D04-AG/D05-AG来源倒地skip、同源后Battle检查、failure优先。D06/D07/D08/D12等工程默认照原交付执行，不重开审批。

批准结果同步Draft0312、Task0312、本文准入表和索引；U4行为基线的推荐分支成为已批准测试期望，备选分支仅作未采用方案记录。U1–U5 Receipt保留实际执行当时的“待批”历史，不倒改成当时已获批。本次只回写决定与准入，没有实现产品、创建新产品Task或提交Git；E2–E5不在本轮批准范围。

现在：E1-COMPAT-1合同ready，可拆正式产品Unit；AG-1玩法合同已冻结，按原工程次序等待E1原语/locals/trace/restore实现与验收后接续。没有剩余人类玩法审批项。

批准回写验证：check:docs扫描1088篇，仍为同8处旧Operation路径错误，无新增错误；整体退出1，不记全通过。diff --check退出0，五份本次直接文档尾随空白独立核对。GALHCG仅对这五路径只读changed复核：四份无直接Evidence/maps_to；索引content_changed，owner_offset0/5两页共9项已读完，末页complete=true，无图编辑/刷新/freshness写入。本次无源码修改，未重跑无变化的产品测试。
