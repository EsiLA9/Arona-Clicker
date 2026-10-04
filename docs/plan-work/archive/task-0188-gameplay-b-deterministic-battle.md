# Task：玩法 B 确定性单场战斗原型

状态：complete — U1/U2/U3 代码、回归与浏览器首战验收完成；R11 保留暂定并交用户复核

## 目标

在最小页面中体验四名初始角色对节点 5 两名敌人的确定性战斗，完整演示准备、支付、Click 结算、下一轮和终局。

## 设计边界

- 本 Task 包含：个人牌组与 AI 优先表、前后排目标、sCost、待机、伤害/护盾/恢复、同时结算及胜负平局。此阶段显式关闭随机技能与配方，只作为基础战斗样本。
- 用户已要求按 0186–0193 顺序完成独立原型系列；0187 已完成并交接，当前开始本 Task U1。
- 共用边界：原型位于独立目录 `prototypes/gameplay-b/`，自身声明通用 TypeScript/Vite/Vitest 依赖，使用普通 DOM/CSS；不依赖 AC 的 Engine、StateMutationService、PlayerState、Registry、Datapack、Story、UI、CSS、内容、资源、存档或服务。所有原型写入集中由自身 Runtime 完成，UI 只消费只读视图；不为遵守 AC 部件约定反向引入 AC 依赖。
- 非目标：存档及迁移、AC 接入、实时循环、自动战斗、编队、手选牌、分支路线、经济/成长系统。开发 seed 与场景夹具不形成玩家操作；玩家只以 Click 推进，刷新页面可重开。
- 设计来源：[[draft-0185-gameplay-b-progressive-prototype-tasks]] 与本 Task Read Set。R06、R09 及配方匹配次序按 0186 中为完成 Goal 选择的原型暂定默认施工，不代表用户逐项确认；R07 的同 Click 伤害/治疗按净值结算是用户已确认规则。次日验收若修订暂定口径，须更新受影响测试与手算。

## 依赖与开工门槛

直接前置：[[task-0187-gameplay-b-standalone-click-prototype]] 完成并交接，以及 [[task-0186-gameplay-b-prototype-rule-baseline]] 的规则与手算交接。R06、R09、配方匹配次序采用本 Task 标记的原型暂定默认；不得将其记成用户逐项裁定。

0187 已实际交付并通过验收；每个 Unit 开工前仍须检查其归档 Receipt 与实际源码，核对导出签名、状态写入口、只读视图和随机接口。本 Task 的新战斗路径是计划落点，不预设当前已存在或具备特定签名。若实际文件、接口或调用边界与计划不符，先停止并更新本 Task 的 Unit 白名单和验证步骤，不得为套用计划重写已验收产物。

**R11 原型暂定推断（待 2026-10-04 用户验收，不是用户裁定）：**已倒地的 HP=0 队友在战斗尚未终局时可成为普通治疗目标；若该 Click 的净值恢复 HP>0，则该 Chara 复起，但本次准备阶段已过，最早从下一轮重新选择行动。此口径依据 0186 R07 的“伤害与治疗按净值汇总”及 0184 营地能恢复倒地角色的条文推断；如用户验收时不同意，调整 R06/R07 实施与相关测试。AI 仍按最低 HP 受伤队友选择目标，同值依名册顺序。

## 当前事实与代码落点

| 已核实事实 | 依据 | 对施工的影响 |
| --- | --- | --- |
| 0181–0184 为规则/内容/UI/引擎候选，尚非当前机制 | 对应 Draft 的状态与边界 | 不把建议或历史例子当成已实现能力 |
| 0187-U1–U3 已交付独立包、model/random/Runtime、确定性场所测试与三栏技术页面 | `docs/plan-work/archive/task-0187-gameplay-b-standalone-click-prototype.md` 的 U1/U2/U3 Receipt 与实际原型源码 | 首战扩展前核对真实导出签名；不重写已验收接口 |
| 2026-10-02 检查时 `prototypes/gameplay-b/` 目录尚不存在 | 本 Task 初稿记录 | 仅为历史检查结果，不代表当前目录状态 |
| 主仓库已有通用 TS/Vite/Vitest | 根 `package.json` | 工具可另行声明，自身配置不能依赖主仓库 |
| 初始演示战斗计划为 4 名我方角色对节点 5 的 2 名敌人 | 本 Task 目标；0186 的场景与编队基线 | 可用战斗夹具额外验证最终 4 前排 + 2 后排；不将其误写成首战可玩路线 |

## Must Read / Read Set

- [[docs/docs-829/00-INDEX]]、[[docs/ai/PROJECT-CONSTITUTION]]。
- [[draft-0182-gameplay-b-director]]、[[draft-0184-gameplay-b-sample-engine]]，只读本阶段涉及小节。
- [[task-0187-gameplay-b-standalone-click-prototype]] 的交接/Receipt；[[task-0186-gameplay-b-prototype-rule-baseline]] 的对应规则与案例。
- 本 Task 每个切片列出的目标文件及其直接相关测试；开工后按实际产物定位，不默认读全部原型代码。

## 施工切片

各 Unit 严格按 U1→U2→U3 执行。Unit 中列出的源码落点是允许修改范围，不表示 0187 已交付这些接口。每个 Unit 开工前按 [[docs/ai/templates/patch-unit]] 复述 Goal、Allowed Files、Explicit Non-goals 和 Stop Conditions；核实前置 Receipt 与实际签名后才施工。每个 Unit 含本 Task 文档在内共 3–5 个白名单文件、约 300–500 行净改动；超预算先停止并交回拆分，不增加白名单。

### Patch Unit 0188-U1：冻结每轮行动与意图

#### Goal

使用实际交接的独立 Runtime 边界，为节点 5 首战准备我方普通牌和敌方意图；冻结支付、行动者、目标及目标列表，Click 前不再重选。技能检定与配方匹配在本 Unit 中关闭。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 权威路由与协议 | `docs/docs-829/00-INDEX.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md` | Unit、白名单、停止条件与收据规则 |
| 规则基线 | `docs/plan-work/archive/task-0186-gameplay-b-prototype-rule-baseline.md`：R06–R08、sCost 基线与案例 2、5、6 | 选择支付、目标、行动与回合时点；区分已确认与原型暂定值 |
| 内容与引擎草案 | `docs/plan-work/draft-0182-gameplay-b-director.md`：六人优先表与首战敌方内容；`docs/plan-work/draft-0184-gameplay-b-sample-engine.md`：状态及战斗时序小节 | 对齐本阶段所需的牌、目标条件和事件语义 |
| 前置交接 | `docs/plan-work/archive/task-0187-gameplay-b-standalone-click-prototype.md`：U1/U2/U3 Receipt 与实际导出 | 核对 Runtime、model、只读视图和随机接口的真实签名；不可从拟定路径推断签名 |
| 目标 | 本 Task 的 U1、本 Unit 白名单中的原型文件 | 确认局部上下文与施工边界 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含文档、原型文件与工具输出 |
| 文档 Read Set | 4–7 篇；只读上表涉及章节 |
| 历史文档 | 仅 0186 规则基线一篇，作为本系列当前原型基线 |
| 超预算处理 | 停止并上报；不扩读 AC 源码或整份历史规划 |

#### Optional Read Set

- 无。若上表未写清某张首战牌的目标或合法条件，停止并报告精确缺项，不自行搜索或补造规则。

#### Do Not Read by Default

- AC 的源码与测试、运行时代码、根 package/配置、与本 Unit 无关的 prototype 文件、`docs/plan-work/archive/**` 中除 0186 与本 Task 明确要求读取的 0187 外的文档。

#### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 首战使用四名初始角色；队伍总体设计为初始 2 前排 + 2 后排，两名中途加入者均加入前排，最终 4 前排 + 2 后排 | `task-0186-gameplay-b-prototype-rule-baseline.md`：已确认边界、案例 6 | 0188 首战页面只展示四名起始成员；六人队形用战斗夹具覆盖 |
| 每名 Chara 每轮至多选择一张普通牌；免费随机技能另算，但本 Task 暂不启用 | 0186：规则基线 R03/R04 | 0189 才实现技能 |
| sCost 在一场战斗内跨回合保留，战斗结束后清除；上限 5、开场 2、第二轮起回复 1、待机后回复 1 等具体数值是原型候选 | 0186：sCost 基线与案例 2、6 | 作为可复核原型数据，不宣称用户确认数值 |
| 芽衣医疗、千世现场包扎、玲奈掩护可在指定条件下越过支付后保留线，但仍须付全额费用；这是 R06 原型暂定默认 | 0186：R06、案例 2 | 非用户逐项裁定；普通牌不因此重新选择 |
| 轮初存活者完成已准备行动；同 Click 伤害与治疗按净值汇总，治疗能抵消致命伤 | 0186：R07、案例 5/6；用户已确认 | 结算细节见 U2 |
| 0187 已完成独立包、Runtime、事件、只读视图和浏览器入口交付 | `docs/plan-work/archive/task-0187-gameplay-b-standalone-click-prototype.md`：U1/U2/U3 Receipt | 真实类型、函数和签名以原型源码为准，开工时已核对 |

#### Constraints

- 所有状态写入只能通过 0187 实际交付并核实的 prototype Runtime；视图不写状态，不引入 AC 代码或依赖。
- 每轮准备依 Draft 0184 顺序：第 2 轮起先给存活我方角色回复候选 sCost，再按敌人固定循环生成并锁定敌方意图/目标，最后按我方名单顺序检查 AI 优先表、选择并支付普通牌；之后冻结整轮等待 Click。本 Task 不进入技能骰阶段。
- 首战敌人、AI 倾向和目标条件以 Draft 0182 与 0186 的对应内容为准；普通敌方攻击在仍有存活前排时不能选后排，前排全空时可选任一存活角色；明确声明为任意排/后排的攻击可越过前排保护。攻击目标在准备阶段锁定，队列同值规则按 Draft 0184 的名单顺序。
- sCost 的候选数字集中作为可复核原型数据；首轮不额外回复、后续轮初回复、仍存活的待机者在 Click 结算后回复及上限逻辑按 Draft 0184 与 0186 案例核对。若内容草案与基线冲突，停止并上报。
- R06 三项豁免只在规定条件与目标合法时生效；仍需付全卡费，资源连全额费用也不够则跳到下一优先项。普通牌选择后不因配方重选；本 Task 不做配方。
- R11 原型暂定：轮初倒地角色可被普通治疗复起；一次 Click 中只按净值更新 HP，复起者不能追补已经冻结的当前轮行动，只能在下一轮重新准备后行动。此规则是从已有净值/营地恢复机制的推断，非用户逐项确认，必须在 Receipt 标注。
- 不消耗随机流；不执行随机技能骰。R09 攻击标记保持为 0189 的原型暂定默认，本 Task 不实现或消费该标记。

#### Allowed Files

- `prototypes/gameplay-b/src/model.ts`
- `prototypes/gameplay-b/src/battle/prepare.ts`
- `prototypes/gameplay-b/src/content/first-battle.ts`
- `prototypes/gameplay-b/tests/battle-prepare.test.ts`
- `docs/plan-work/task-0188-gameplay-b-deterministic-battle.md`

#### Explicit Non-goals

- 不实现伤害结算、cardTag 配方、随机技能、营地、Boss 战、地图路线、存档或玩家选牌。
- 不重写 0187 已验收的 model/Runtime 接口；如需改变其公开签名或修改白名单外文件，停止上报。

#### Stop Conditions

遵守 `PROJECT-CONSTITUTION` 六类停止条件。另有以下专项停止项：任何计划落点不存在或真实签名不符；目标、无前排兜底或 AI 条件与 Read Set 冲突；需要改白名单外文件；实现必须额外选定未记录机制或偏离 R11 原型暂定；验证结果与手算不一致。此时记录事实与阻断，不猜接口或规则。

#### Completion Criteria

- [x] 每个轮初存活我方角色最多准备一张普通牌；支付只发生一次，并冻结角色、牌、支付后 sCost、目标及轮序。
- [x] R06 原型暂定三个紧急例外按条件执行：芽衣医疗/千世包扎要求受伤队友 HP≤半血，玲奈掩护要求存在敌冲锋且目标合法；全费不足、条件不成立或无合法目标均跳过当前项，继续优先表。千世/玲奈用测试夹具覆盖，不提前加入首战内容。纺希狙击的出牌前最低 sCost 门槛与支付后保留线分别处理。
- [x] 芽衣医疗测试覆盖最低 HP 合法目标为轮初倒地队友的情境，按 R11 原型暂定将其锁定为治疗目标，不在准备阶段使其立即行动。
- [x] 内容包含节点 5 首战两名敌人；敌人意图与目标在 Click 前冻结，不因同时伤亡而重选。
- [x] 测试覆盖初始 2+2 和最终 4+2 夹具、前排保护、首战狙击例外、前排全空时的目标回退、同值目标名单顺序、资源/保留线分支和 R06 例外；千世、玲奈例外由测试夹具覆盖，不加入首战内容。
- [x] 同输入、配置与冻结前状态生成相同准备结果；本 Unit 不调用 RNG、不启用技能或配方。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 准备行为 | 在 `prototypes/gameplay-b/` 执行 `npm test -- tests/battle-prepare.test.ts` | 优先表、支付、目标冻结、队形与 R06 暂定分支通过 |
| 类型 | 在 `prototypes/gameplay-b/` 执行 `npm run typecheck` | 严格类型检查通过 |
| 接口与边界 | 复核 0187 Receipt、真实导出签名及本 Unit 白名单 | 只扩展实际交付接口；无 AC import、无越界写入 |

## Receipt 0188-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `prototypes/gameplay-b/src/model.ts` 增加 U1 准备快照契约；新增 `prototypes/gameplay-b/src/battle/prepare.ts`、`prototypes/gameplay-b/src/content/first-battle.ts` 与 `prototypes/gameplay-b/tests/battle-prepare.test.ts`；本 Task 更新 U1 验收状态与收据 |
| 未完成内容 | 伤害/护盾/治疗结算和 R11 复起时点留 U2；随机技能及配方留 0189 |
| 范围外变更 | 无 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `prototypes/gameplay-b/`：`npm test -- tests/battle-prepare.test.ts` | 通过 | 1 个文件，9 项测试通过 |
| 类型检查 | `prototypes/gameplay-b/`：`npm run typecheck` | 通过 | `tsc --noEmit` |
| 文档检查 | 项目根目录：`npm run check:docs` | 通过 | 扫描 538 篇 Markdown，errors: 0 |
| 接口与边界 | 核对归档 0187 Receipt 与原型真实签名；检查 U1 白名单 | 通过 | Runtime/model/random 接口保持原样；准备函数不调用 RNG；无 AC import |
| 行数预算 | 以 0187 交接快照为原型基线 | 通过 | U1 代码净增 402 行；加本 Receipt 共计 433 行，低于 500 行 |

### 遇到问题

- 首次类型检查发现 `BattleRow` 类型导入遗漏；补入白名单内 `prepare.ts` 后重新检查通过。

### 需上游确认项

- R11（HP=0 队友可作为普通治疗目标、净值后复起但本 Click 不补行动）仍是原型暂定推断，等待 2026-10-04 用户验收；本次没有将其记录为用户裁定。R06 仍按基线标记为原型暂定默认。

### 事实更新建议

- 本 Unit 的准备输出是确定性冻结快照；不修改 0187 Runtime，也不消费随机流。R11 未进入当前系统机制事实文档。

### Patch Unit 0188-U2：同步结算与终局判定

#### Goal

对 U1 冻结的行动计算伤害、临时护盾和已准备恢复，按单一净值更新双方 HP，并在战斗结束后阻止下一轮。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 权威路由与协议 | `docs/docs-829/00-INDEX.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md` | Unit、白名单、停止条件与收据规则 |
| 结算基线 | `docs/plan-work/archive/task-0186-gameplay-b-prototype-rule-baseline.md`：R07、sCost 案例 2/5/6 与 R05 案例 3 | 净值 HP、已准备行动、护盾、恢复、结束时点和手算输入 |
| 引擎草案 | `docs/plan-work/draft-0184-gameplay-b-sample-engine.md`：combat resolution、event order、只读视图相关小节 | 对齐建议的阶段边界；与 0186 冲突时以 0186/用户确认项为准 |
| 前置交接 | 本 Task U1 Receipt、U1 白名单文件；`docs/plan-work/archive/task-0187-gameplay-b-standalone-click-prototype.md` 的 Runtime 签名与已交付 Receipt | 只处理被冻结轮；核实已有状态、事件和推进接口 |
| 目标 | 本 Task 的 U2 | 确认结算范围与验收边界 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含必要源码、测试与命令输出 |
| 文档 Read Set | 4–7 篇；只读上表所列相关章节 |
| 历史文档 | 仅 0186 规则基线一篇 |
| 超预算处理 | 停止并上报；不得泛读全仓或 AC 源码 |

#### Optional Read Set

- 无。必须扩读或更改另一个 Unit 时，先停止并由上游更新 Read Set/白名单。

#### Do Not Read by Default

- AC 的源码与测试目录、根运行时/配置、与单场战斗无关的原型或历史计划。

#### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 同一 Click 中轮初存活者完成已准备行动；伤害与治疗按净值汇总，治疗可抵消致命伤 | `task-0186-gameplay-b-prototype-rule-baseline.md`：R07、案例 5/6；用户已确认 | 不采用“先死亡便取消同 Click 治疗”顺序 |
| HP 在一次净值更新后限制在 `0..hpMax`；胜、负、全灭平局都属于本 Task 的验收范围 | 0186 案例 5/6；本 Task 测试与验收 | 只有双方终值均归零时才是平局 |
| 普通攻击基础伤害按 `max(1, ATK−DEF)`，之后应用修正并以 0 为最低；目标护盾取来源最大值，先吸收汇总伤害 | `draft-0184-gameplay-b-sample-engine.md`：普通攻击公式及结算步骤 4–5 | R09 与配方修正本 Task 关闭；该文档中的 R09 仍标为原型暂定 |

#### Constraints

- 只接收准备阶段冻结的行动；不得在结算中重选角色、牌、目标或重新支付，不消费随机数。
- 对各已准备行动先按 `max(1, ATK−DEF)` 求基础伤害，再应用该行动明确的数值修正；最终伤害最低为 0。这是本原型的计算约定，未被单独裁定为产品规则。
- 聚合本 Click 对每个目标的伤害、已准备治疗和临时护盾；同一目标临时护盾不相加，取本轮生成值的最大者，吸收该目标汇总伤害一次。计算 `HP' = clamp(HP + 治疗 - max(0, 汇总伤害 - 护盾), 0, HPmax)`，所有目标完成计算后一次写回；轮末清除未用临时护盾。该口径来自引擎 Draft 的原型规则，不上升为用户逐项裁定。
- 任何轮初存活行动者都完成本轮已准备行动；锁定目标即使同时归零也不重新选目标，HP 下限产生的过量伤害不转移。
- R11 原型暂定：HP=0 队友可被普通治疗选为目标；净值后 HP>0 则恢复战斗能力，但不得加入已冻结的当前轮行动。
- 在净值 HP 更新并清除护盾后，仍存活的待机者先按候选值回复 sCost；随后判终局。双方同时全灭为平局，其余只有一方全灭则另一方胜。终局不准备下一轮，并按单场战斗边界清除当前 sCost。
- 0189 配方与技能尚未接入；禁止为未来机制预先加入分支或改变 U1 牌语义。

#### Allowed Files

- `prototypes/gameplay-b/src/model.ts`
- `prototypes/gameplay-b/src/battle/resolve.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/tests/battle-resolve.test.ts`
- `docs/plan-work/task-0188-gameplay-b-deterministic-battle.md`

#### Explicit Non-goals

- 不实现配方、随机技能、六人正式路线或 Boss 特殊攻击；不重做 U1 准备逻辑及 0187 的独立页面。
- 不改变 U1/0187 已交付字段的语义或既有函数签名；本 Unit 可在白名单内的 `model.ts` 增加结算结果/delta/event 类型供 U2 消费。若需改变已冻结准备记录含义或 Runtime 公共签名，先停止并更新本 Unit。

#### Stop Conditions

遵守 `PROJECT-CONSTITUTION` 六类停止条件。若 U1 冻结记录缺字段、HP/盾/治疗手算无法与 0186 对齐、需要改变 0187 接口或 U1 冻结字段语义、护盾/目标/倒地语义与 Read Set 冲突、需改白名单外文件、或定向验证失败/无法执行，停止并记录最小复现。

#### Completion Criteria

- [x] 多个攻击、最大护盾与治疗汇总后只更新一次 HP；治疗封顶，过量伤害不转移，未用盾轮末清除。
- [x] 同轮伤害可由已准备治疗抵消致命伤；轮初存活者即使同轮归零仍完成其准备行动。
- [x] 按 R11 原型暂定，轮初 HP=0 的治疗目标获得正净恢复后可复起；本 Click 不补做行动，下一轮才重新进入准备。
- [x] 测试覆盖护盾候选取最大、伤害/治疗净值、HP 上下限、目标锁定、过量伤害、同时击倒、胜利、失败与平局。
- [x] 测试覆盖对轮初倒地者的普通治疗复起、同 Click 不补行动、下一轮可重新准备；该口径保持原型暂定。
- [x] 每个有效 Click 只结算一份冻结行动；结算后的存活待机者按规则回复，再判终局；终局后无下一轮，重复 Click 不追加战斗结算或事件。
- [x] 手算输入与测试逐步状态一致；护盾聚合和最低伤害后的修正明确标作原型实现约定。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 结算行为 | 在 `prototypes/gameplay-b/` 执行 `npm test -- tests/battle-resolve.test.ts` | 净值、护盾、同步行动、终局及过量伤害测试通过 |
| 类型 | 在 `prototypes/gameplay-b/` 执行 `npm run typecheck` | 严格类型检查通过 |
| 手算复核 | 对照 0186 案例 5/6 与本 Unit 约定逐步复算 | 状态、事件和胜负一致；差异有明确归因 |

## Receipt 0188-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；U3 可开工 |
| 实际修改 | `prototypes/gameplay-b/src/model.ts` 增加同步结算状态/增量/结果类型；新增 `prototypes/gameplay-b/src/battle/resolve.ts`；在 `prototypes/gameplay-b/src/runtime.ts` 新增独立 `GameplayBBattleRuntime` 与只读战斗视图，保留已交付 `GameplayBRuntime` 签名；新增 `prototypes/gameplay-b/tests/battle-resolve.test.ts`；本 Task 更新 U2 验收和收据。 |
| 结算路径 | 初始 Click 前冻结首轮；每次 Click 仅结算当前冻结轮。HP 按所有攻击、最大临时盾与治疗净值一次更新；锁定目标、同时行动和过量伤害语义不变；继续战斗时才准备下一轮。RNG 不参与战斗结算。 |
| 手算核对 | R07：HP 2 的轮初存活攻击者造成 3 点伤害并受到 2 点攻击，同时接受 2 点已准备治疗，最终 HP=2，敌人 HP=0，判胜；护盾例：目标 HP=5，承受 4+3=7 点伤害、临时盾候选 2/1，保留盾 2 后 HP=0；溢出 5 点不转给其他角色。 |
| 未完成内容 | 随机技能与 cardTag 配方留 0189；首战三栏集成及浏览器验收留 U3。 |
| 范围外变更 | 无；无 AC 导入、持久化、网络请求或随机调用。 |

### U2 测试与验证

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向结算测试 | `prototypes/gameplay-b/`：`npm test -- tests/battle-resolve.test.ts` | 通过 | 1 个文件，12 项测试通过 |
| 原型全量测试 | `prototypes/gameplay-b/`：`npm test` | 通过 | 3 个文件，27 项测试通过，含 0187 和 U1 回归 |
| 类型检查 | `prototypes/gameplay-b/`：`npm run typecheck` | 通过 | `tsc --noEmit` |
| 文档检查 | 项目根目录：`npm run check:docs` | 通过 | 扫描 538 篇 Markdown，0 errors |
| 空白/边界检查 | `git diff --check`；对 U2 新增代码搜索外部导入/网络/存储入口 | 通过 | 仅见工作区既有 CRLF 转换提示；边界搜索无匹配 |

### U2 暂定项与限制

- **R11 仍是原型暂定推断，等待 2026-10-04 用户验收，不是用户裁定。**本次用测试实现“HP=0 队友可以被普通治疗选中；净值后 HP>0 则复起；本次冻结轮不补行动，下一轮可重新准备”。
- 临时护盾取目标当轮最大候选值；攻击基础伤害取 `max(1, ATK−DEF)` 后再加明确的攻击增量且最低为 0；同轮多个攻击增量按最大值、不叠加处理。这些是原型计算约定，不上升为正式机制结论。
- U2 增加并行的 `GameplayBBattleRuntime`，用于后续 U3 接入；原有 0187 `GameplayBRuntime` 未改变。终局清空当前战斗 sCost，且重复 Click 不变更状态、计数或事件。
- 本战斗 Runtime 暂不提供技能检定的随机注入/抽取接口；0189-U2 必须在其施工白名单中明确扩展 `runtime.ts` 与 `random.ts`（或提交等价的窄接口），不能将本次“无 RNG 结算”误读成已经支持技能随机重放。
- `git diff --check` 在仓库范围输出多份既有文件的 CRLF 转换提示；本 Unit 修改文件无空白错误。边界检索没有匹配，退出码 1 表示无结果。

### Patch Unit 0188-U3：集成首战展示与完整回归

#### Goal

把已验收的准备和同步结算接到独立原型首战入口，展示双方角色、冻结行动、Click 结果、事件账目及终局。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 权威路由与协议 | `docs/docs-829/00-INDEX.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md` | Unit、白名单、停止条件与收据规则 |
| UI 与运行时草案 | `docs/plan-work/draft-0183-gameplay-b-ui.md`：三栏布局小节；`docs/plan-work/draft-0184-gameplay-b-sample-engine.md`：getView/事件/结算时序小节 | 保持只读呈现与 Click 推进语义 |
| 规则基线 | `docs/plan-work/archive/task-0186-gameplay-b-prototype-rule-baseline.md`：R06–R08、案例 2/5/6 | 检查可见行动、伤害账目与终局文本 |
| 前置交接 | 本 Task U1/U2 Receipt；归档 Task 0187 实际启动入口、视图、Runtime 导出与浏览器启动 Receipt | 仅扩展已交付入口/视图，核对真实调用签名，不假设页面结构 |
| 目标测试 | 白名单中的 `prototypes/gameplay-b/tests/runtime.test.ts` 及其实际调用符号 | 保留 0187 Runtime 用例并增加首战流程回归 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含局部 UI、Runtime、测试与浏览器输出 |
| 文档 Read Set | 4–7 篇；只读上表指定小节 |
| 历史文档 | 仅 0186 规则基线一篇 |
| 超预算处理 | 停止并上报；不扩读 AC UI 或无关原型 |

#### Optional Read Set

- 无。视觉或浏览器问题若要求修改白名单外样式/入口，先停止并更新 Unit。

#### Do Not Read by Default

- AC 的 UI 源码目录、AC CSS/资源、主应用入口、与首战无关的 UI 系统或旧快照。

#### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 0187 的最终目标包含独立三栏技术样本和单一 Click 推进入口 | `docs/plan-work/archive/task-0187-gameplay-b-standalone-click-prototype.md`：目标、P2 | 真实 DOM/视图签名以完成的 Receipt 和原型源码为准 |
| 玩家只用 Click 推进；首战可显示 2 前排 + 2 后排，较完整的 4+2 用于夹具验证 | 本 Task 目标；0186 队伍基线 | 此 Unit 不接入地图路线 |
| `getView()`/只读投影与事件日志属于原型边界要求 | 0186 字段契约、0187-U2 目标 | 只读语义已定，具体结构需从真实交接核对 |

#### Constraints

- 只显示已冻结的准备数据和已产生的结算事件；重复读取/渲染不得支付 sCost、改变 Runtime 或消耗随机状态。
- 页面只提供单一推进 Click；玩家不选牌、不选目标、不选 seed。测试 seed/战斗夹具由开发入口传入，不新增玩家菜单。
- 中栏按先前准备、Click 结算、下一轮准备分段记录；左右栏显示我方 Chara 数据和敌方数据。内容从只读视图读取，不在 DOM 层另算伤害或胜负。
- 此首战关闭 0189 的配方与随机技能，不宣传为完整十二节点路线或平衡验证。

#### Allowed Files

- `prototypes/gameplay-b/src/main.ts`
- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`
- `docs/plan-work/task-0188-gameplay-b-deterministic-battle.md`

#### Explicit Non-goals

- 不改 Runtime 文件、模型、CSS、HTML、build 配置或 AC UI；只通过已交付的 Runtime/view 接口组装首战。
- 不接入十二节点路线、营地、Boss、随机技能、cardTag 合成或新玩家输入。

#### Stop Conditions

遵守 `PROJECT-CONSTITUTION` 六类停止条件。若 0187 已验收的实际入口/Runtime 或只读视图无法支持首战账目、需要改白名单外文件、浏览器验收失败或无法执行时，停止并报告；不得在 UI 自行重算战斗或通过新输入绕过接口缺项。

#### Completion Criteria

- [x] 实际启动入口配置节点 5 的四名初始我方 Chara 与两名敌人，左右侧数据和中间准备/结算日志来自只读战斗视图。
- [x] 首个 Click 只结算当前冻结轮；继续时准备下一轮并分段记录；三种终局均不再准备下一轮。
- [x] 一个按钮是唯一玩家输入；每次 Click 推进一轮；入口未加入手动选牌、选目标、随机技能或配方操作。
- [x] Runtime 测试保留 0187 原有用例，并覆盖首战连续 Click、冻结轮与结算对账、三种终局及终局 Click 幂等。
- [x] 浏览器冒烟中无控制台错误；重复读取视图及页面滚动不修改状态或增加事件。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 相关回归 | 在 `prototypes/gameplay-b/` 执行 `npm test -- tests/runtime.test.ts tests/battle-prepare.test.ts tests/battle-resolve.test.ts` | 0187 Runtime、U1/U2 与首战流程测试均通过 |
| 全包类型/构建 | 在 `prototypes/gameplay-b/` 执行 `npm run typecheck` 与 `npm run build` | 严格类型检查和独立构建通过 |
| 浏览器首战 | 在 `prototypes/gameplay-b/` 执行 `npm run dev`，完成首战至终局 | 单 Click 推进、左右栏和日志/终局符合本 Unit；无控制台错误 |
| 独立边界 | 检查 U3 白名单 diff 与运行请求 | 不依赖 AC 文件、资源、CSS 或服务 |

#### Execution Receipt 0188-U3

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；浏览器验收由根代理于 2026-10-03 执行。 |
| 实际修改 | prototypes/gameplay-b/src/main.ts 将独立入口切换为 firstBattle 与 GameplayBBattleRuntime；src/view.ts 新增战斗三栏投影，展示双方 HP/ATK/DEF、我方当前 sCost、冻结行动/目标、敌方意图、每轮结算账目与终局；tests/runtime.test.ts 保留原 0187 场所 Runtime 用例并增加首战准备只读、单 Click 冻结轮结算、下一轮准备及胜利/失败/平局幂等测试。未改 CSS、HTML、Runtime、model、内容或 AC 文件。 |
| 行为边界 | 初始四人（2 前排 + 2 后排）对阵两名敌人；页面唯一推进按钮调用一次 click()。准备记录只在视图读取时展示；Click 结算对应冻结的 lastResolution.prepared，继续时才展示下一轮准备。终局按钮保留幂等 handler guard；终局后 Runtime 不准备新轮、重复 Click 不改变快照。 |
| 暂定项 | R11 仍为原型暂定推断：轮初 HP=0 的普通治疗目标净值复起后本 Click 不补行动。U3 未改变或升格此规则。0189 技能与 cardTag 配方仍关闭。 |
| 未完成 | 无。未验收随机技能、配方、路线或平衡性，它们分别留给 0189–0193。 |

#### U3 自动化与包级验证

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向 Runtime 测试 | npm test -- tests/runtime.test.ts（在 prototypes/gameplay-b/） | 通过 | 11 项测试通过；包括原 0187 的 6 项场所用例 |
| 全包测试 | npm test（在 prototypes/gameplay-b/） | 通过 | 3 个测试文件、32 项测试通过 |
| 类型检查 | npm run typecheck（在 prototypes/gameplay-b/） | 通过 | tsc --noEmit --project ./tsconfig.json |
| 独立构建 | npm run build（在 prototypes/gameplay-b/） | 通过 | Vite 8.3.2 构建成功 |
| 浏览器验收 | Codex in-app browser，临时 1280×720 视口；四次 Click 完成首战，终局后重复 Click；窄视口滚动日志 | 通过 | 3 栏几何：party x18/w283、center x317/w646、enemy x979/w283；document 1280×720，无溢出；唯一按钮 x799/y638/w139/h46。首战第 1→4 轮后胜利，日志数值与双方 HP/sCost 更新一致；终局再 Click 后 AX 树不变。窄视口滚动时事件数保持 50；Console error/warn 均为空；viewport override 已重置 |

#### 根代理浏览器验收记录（2026-10-03）

- 第 1 轮：冲撞者 HP 8→5；纺希 HP 8→6；由理承受 2 点攻击并由掩护 2 盾完全吸收。
- 第 2 轮：冲撞者 HP 5→1；水枪射手 HP 6→3。
- 第 3 轮：冲撞者 HP 1→0；纺希同 Click 承受 2 点攻击并恢复 2，净 HP 4→4。
- 第 4 轮：水枪射手 HP 3→0，页面显示“首战胜利”、战斗 sCost 清零；终局后再次输入无新事件。
- Console 的 error/warn 过滤结果均为空。滚动日志没有新增记录（50 项仍为 50）；完成固定视口检查后已重置 viewport override。

## Context Budget 与停止条件

- 单个代码 Unit 目标上下文 10k–30k token；纯文档 5k–15k。可选读取只限直接相关的模型/调用方/测试；历史快照和 AC 业务源码默认不读。
- 遵守 [[docs/ai/PROJECT-CONSTITUTION]] 六类停止条件：白名单外修改、超预算、Read Set 失控、事实冲突、未裁定机制/范围扩张、必需验证失败或无法执行。
- 不修改根 package、主应用启动/构建、AC 源码、生成 Schema 或已有依赖目录。独立原型不是当前 AC 机制，不向 docs-829 写入“已实现”结论。
- 发现前置缺陷应记录失败案例并回相应 Task 修复和重验，不能在 UI 或内容层绕开错误规则。

## 测试与验收

- [x] 首轮基础值初始化后不额外回复；第二轮起回复、待机额外回复、上限及支付符合基线。
- [x] 攻击/防御、护盾取最大/清除、恢复上限、同轮致命行动、目标锁定与溢出不转移均有测试。
- [x] 前排保护、无前排兜底及明示狙击例外可观察。
- [x] 胜利、失败、同时全灭平局均有可重放夹具；每有效 Click 只结算当前一轮。
- [x] 最短活动路线仍通过；未启用配方/随机技能标记明确，不据此宣布全玩法平衡。

### 验证入口

相关测试文件为 `prototypes/gameplay-b/tests/runtime.test.ts`、`prototypes/gameplay-b/tests/battle-prepare.test.ts` 和 `prototypes/gameplay-b/tests/battle-resolve.test.ts`。在仓库根执行 `npm --prefix prototypes/gameplay-b test -- tests/runtime.test.ts tests/battle-prepare.test.ts tests/battle-resolve.test.ts`、`npm --prefix prototypes/gameplay-b run typecheck`、`npm --prefix prototypes/gameplay-b run build`；筛选参数相对于 `prototypes/gameplay-b/` 包根。之后以 `npm --prefix prototypes/gameplay-b run dev` 启动并完成浏览器首战冒烟，核对一轮账目与终局。

上述原型命令依赖 Task 0187 实际交付的脚本；命令尚未执行不代表通过。文档变更另在仓库根执行 `npm run check:docs` 与受影响文件的 diff 空白检查；新文件另行检查，不能依赖不包含未跟踪文件的普通 diff。

## 当前核验（2026-10-03）

- U1/U2/U3 均完成；独立战斗 Runtime、同步净值结算、四人首战三栏 UI 已交付。R11 复起时点仍为原型暂定推断，留待用户 2026-10-04 验收。
- 原型全测 32/32、类型检查、构建、`npm run check:docs`（538 篇 Markdown、0 errors）通过；1280×720 浏览器完成四轮首战、终局幂等、日志滚动与 Console 验收，viewport override 已恢复。
- 原型仍只在 `prototypes/gameplay-b/`，不依赖 AC Engine/UI/内容/资源/存档/服务；战斗 RNG 尚未实现，将在 0189 内接入技能准备。

## Execution Receipt 与交接

U1/U2/U3 均记录实际修改、未完成内容、命令与结果及需验收项。交接至少包含实际文件/接口、规则编号、测试/seed、运行步骤和未解决问题，不以“应该通过”代替证据。

本 Task 全部验收通过，交接 [[task-0189-gameplay-b-card-recipes-and-skills]]。归档前记录最终核验，更新索引及受影响入口，再运行终态文档检查。

## 剩余工作

完整行动合成与技能由 Task 0189 补充，路线生命周期由 Task 0190 补充。

## 相关路由

- [[draft-0185-gameplay-b-progressive-prototype-tasks]]
- [[task-0187-gameplay-b-standalone-click-prototype]]
- [[task-0189-gameplay-b-card-recipes-and-skills]]
