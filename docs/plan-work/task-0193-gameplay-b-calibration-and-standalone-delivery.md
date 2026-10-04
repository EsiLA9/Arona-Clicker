# Task：玩法 B 可重放校准与独立交付

状态：active — Task 0192 已于 2026-10-03 完成归档；0193-U1/U2 已完成，当前推进 0193-U3 隔离交付验证

## 目标

以固定 seed 数据检查整局确定性与状态合法性；只在证据支持时校准已有数值参数；最后证明原型可在项目外独立复制、安装、构建和运行。

## 设计边界

- 本 Task 分为 0193-U1 固定 seed 诊断、0193-U2 证据支持的参数校准、0193-U3 项目外隔离交付，依序执行。
- U1 已取得固定 seed 测量；当前仍无真人体验反馈。测量、工程冒烟、代理观察、用户体验反馈须分别记载来源，不得互相替代或提前描述为通过。
- 固定 seed 覆盖验证同输入的确定性、运行状态合法性，以及可复现的通关/失败/平局终态。样本结果分布只是诊断数据，不设通关率或胜率目标，不单凭结果分布证明平衡或体验质量。
- 500 Click 仅为单次测量运行的诊断上限，用于发现可能的停滞/软锁。达到上限时停止该次诊断并记录，不写入游戏规则、不自动制造失败/平局，也不作为玩家超时条件。
- 校准只允许改动证据支持且在前置实际交接中已定义为可调的数值参数；每次尽量只调整一项并使用同一固定 seed 集做前后对照。不得改变已确认语义、点击推进边界、场所/战斗时序、目标规则、配方匹配顺序、技能免费性、胜负/平局定义或路线结构。若问题来自规则/实现缺陷，退回对应 Task 修复。
- 最终复制到操作系统的临时目录，目录须由本 Unit 新建、经规范化确认位于仓库外，并在 Receipt 记录路径和清理结果；这只是一次验证副本，不发布长期分发包。
- 共用边界：原型仅位于 `prototypes/gameplay-b/`，使用自己的通用 TypeScript/Vite/Vitest 依赖与普通 DOM/CSS；不得依赖、修改或接入 AC Engine、StateMutationService、PlayerState、Registry、Datapack、Story、UI、AC 资源、存档、服务或根配置。玩家只用 Click 推进，刷新可重开。
- 非目标：新增机制、调平所有 seed 的通关结果、自动改变游戏规则、AC 移植/集成、发布或上传、创建持久化安装包、存档/迁移、实时循环、自动战斗、玩家选牌、路线分支或经济成长系统。

## 依赖与开工门槛

直接前置 `task-0192-gameplay-b-three-column-ui-acceptance.md` 已于 2026-10-03 完成并归档；0187–0191 同样完成并归档。0193-U1/U2 已完成，U3 正在验证仓库外副本；Task 当前的逐 Unit Receipt 如实记录状态，每个 Unit 仍按实际文件核对具体字段和入口，不从旧计划路径推断现状。

每个 Unit 的输入/导出、结束阶段、胜负表示、种子入口、只读视图、内容路径和 npm 脚本均以 0187–0192 的实际交接和源文件为准。本 Task 以下文件表是拟定的目标白名单，不表示文件、函数、字段或签名已存在。缺少必要接口/夹具、实际路径或脚本名称不一致时，先停工并修订对应 Unit；问题属于前置产物时退回负责的 Task，不猜接口、不重写已验收产物。

## 当前已核实事实

| 已核实事实 | 依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 0187–0192 均已完成并归档；0192-U3 在固定 seed `park-inspection-demo` 下实际完成 12 节点、26 Click 路线，正式 Runtime 使用 `GameplayBRouteRuntime` | 0187–0192 最终 Receipt、`prototypes/gameplay-b/src/main.ts`、`prototypes/gameplay-b/src/runtime.ts`、`prototypes/gameplay-b/tests/park-demo.test.ts` | U1 使用 Runtime 直接构造与只读 `getView()`，不复用浏览器页面或改 Runtime |
| 0187-U1 已交付独立 package 配置和安装/脚本 Receipt | `task-0187-gameplay-b-standalone-click-prototype.md` U1 Receipt | 仅证明 package 配置；不证明整局代码、最终 bundle 或项目外隔离构建已通过 |
| 0193-U1 已完成；两个固定 seed 的完整重复轨迹一致，均在 26 Click 通关；U2 未取得真人体验反馈 | 本文 U1 Execution Receipt、`prototypes/gameplay-b/tests/calibration.test.ts` | U1 统计只作描述性诊断，不据此单独得出平衡/体验结论 |
| 测量方案中的 500 Click 是诊断上限，不是玩法终止条件 | 本 Task 设计边界 | 诊断器不得把上限转成战斗/路线失败规则 |
| U1/U2 已交接，无多尺寸界面兼容验收目标；U3 需从临时副本实走一条固定 seed 路线 | 本 Task 0193-U1/U2 Receipt、用户本轮要求 | 验证对象为独立启动后的实际 Click 推进与完整路线效果 |

## Must Read / Read Set

- 路由与施工纪律：`docs/docs-829/00-INDEX.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md`。
- 规则来源：`task-0186-gameplay-b-prototype-rule-baseline.md` 对应已确认语义、暂定规则及手算案例。参数校准不得把暂定内容写成已确认。
- 前置交接：`task-0187-gameplay-b-standalone-click-prototype.md`、`task-0188-gameplay-b-deterministic-battle.md`、`task-0189-gameplay-b-card-recipes-and-skills.md`、`task-0190-gameplay-b-camp-route-lifecycle.md`、`task-0191-gameplay-b-complete-park-demo.md`、`task-0192-gameplay-b-three-column-ui-acceptance.md` 的最终状态、Receipt、白名单产物和直接测试。
- 只读必要原型文件：按 Unit 读取其白名单目标及 0187–0192 交接明确点名的直接调用方/测试。源码路径、导出和脚本命令须当场按实际文件核实；不得按计划表批量浏览或默认存在。

## Patch Unit 0193-U1（P0）：固定 seed 整局诊断

### Goal

使用最终 Demo 的实际入口和固定 seed 集重放整局，采集确定性、状态合法性、终态与诊断指标；不改变游戏规则。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 前置 Receipt | 0187–0192 各 Task 的最终交接 Receipt | 核实完整 Demo、种子入口、终态值、现有回归夹具及实际脚本 |
| 运行入口 | Receipt 实际列出的 `prototypes/gameplay-b/src/main.ts` 或 Runtime 导出 | 仅确认测试调用的真实构造/推进 API；不能按此拟定路径猜签名 |
| 模型与内容 | 0187–0192 实际交付的 Runtime 状态、最终路线/遭遇/角色配置 | 明确不变量与可观测统计字段，限定 seed 测量覆盖范围 |
| 测试 | 现有通关、失败、平局及运行时测试（以实际交接路径为准） | 复用可重放场景；若终态无可构造夹具则退回相应 Task |
| 本 Unit 目标 | 拟新增 `prototypes/gameplay-b/tests/calibration.test.ts`、`prototypes/gameplay-b/tests/calibration-seeds.ts` | 建立固定 seed 清单、汇总/验证而不复制玩法逻辑 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，包括前置交接、直接源码/测试及命令输出 |
| 文档 Read Set | 默认 3–8 篇；前置 Task 只读交接/Receipt 和本 Unit 涉及部分 |
| 历史文档 | 0 篇；不追读无关历史方案 |
| 超预算处理 | 不扫全原型树；按停止条件退回/拆分 |

### Optional Read Set

- 如统计字段无法从交接列出的视图或测试解释，先停下并申请读取一个直接生产该字段的调用方；不得靠扫描源码寻找字段。

### Do Not Read by Default

- AC 运行时代码、与整局运行无关的 UI 样式/资源、Task 0193 之后的方向草案。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 0187–0192 当前尚无完整前置交接，0187 在 P2、0188–0192 为 proposed | 六份 Task 当前状态行 | 开工时重新核验；不能视为将来状态 |
| 0193-U1 已记录固定 seed、配置指纹、逐 Click 轨迹重复比较与实际指标 | 本文 Execution Receipt 0193-U1 | 两条样本结果不构成全局通关率或平衡结论 |
| 500 Click 被限定为诊断上限 | 本文设计边界 | 不可转换成游戏规则或玩家失败条件 |

### Constraints

- 固定并记录 seed 清单、测试运行命令、起始配置版本、实际构造入口和统计定义；同 seed/配置/Click 序列须比较完整的可观测终态与事件，而非仅比较胜负。
- 覆盖目标是确定性、合法状态和终态表达；通关/失败/平局使用前置已存在的可重放夹具验证。不要求 0–99 的随机样本都出现三类结果，也不要求某一通关率。
- 汇总 Click 数、战斗轮数、倒地数、待机、配方及技能使用等可从只读结果直接观察的指标，仅作描述性诊断；不得设置未裁定的优劣阈值。
- 诊断运行至 500 Click 若仍未终止，记录 `diagnostic cap reached` 和当时状态，停止该次模拟；不得写入玩家战斗失败、终止路线或胜负逻辑。
- 不调整配置数值、不变更 Runtime/视图、不为方便测量伪造或跳过 Click。

### Allowed Files

- `prototypes/gameplay-b/tests/calibration.test.ts`
- `prototypes/gameplay-b/tests/calibration-seeds.ts`
- `docs/plan-work/task-0193-gameplay-b-calibration-and-standalone-delivery.md`（仅追加本 Unit 实际 Receipt）

### Explicit Non-goals

- 不修改角色、敌人、配方、路线、战斗公式或任何 Runtime；不加入玩家看不到的规则。
- 不以批量胜率作为平衡结论，不宣称 seed 集覆盖了所有玩法状态。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件：需改白名单外文件；需新增未列文件或超过 3–5 文件/300–500 行；需读 Read Set 外超过 2 个文件；源码/测试和事实冲突；需自行裁定规则或扩展目标；必需验证失败/无法执行/结果不可解释。另：0187–0192 缺少最终 Runtime/终态/测试交接或现有确定性状态无法构造时，停止并退回对应前置 Task；诊断上限不得用作补造终态的理由。

### Completion Criteria

- [x] 固定 seed 清单和运行配置可由测试重复调用；同一 seed/配置/Click 序列的状态、事件和终态逐项一致。
- [x] 诊断集验证状态不变量；真实通关、失败、平局用例由前置可重放 fixture 覆盖，不要求自然 seed 集必然产生每一类终态。
- [x] 记录每个 seed 的终态、Click 数、战斗轮数和可直接观察的倒地/待机/配方/技能统计；明确它们是描述性诊断值。
- [x] 500 Click 只触发诊断器停止与报告；未写入运行时或 UI 规则。
- [x] Receipt 记录 seed 集、环境、统计定义、任何诊断上限命中和精确命令；不写未实际测得的数值。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 固定 seed 回归 | 在 `prototypes/gameplay-b/` 按实际 package 脚本运行校准定向测试 | 所有固定 seed 可重放、输出确定，状态符合已交接的不变量 |
| 终态夹具 | 运行前置通关/失败/平局直接测试 | 三种终态各有可复现样例；若缺样例则停止退回前置 |
| 诊断限额 | 检查 500 Click 分支和 Receipt | 上限只产生诊断记录并停止模拟，不改变游戏状态规则 |
| 差异审查 | 检查 U1 文件白名单 | 仅两测试文件与本 Task Receipt 有变更 |

### Execution Receipt 0193-U1

**状态：complete（2026-10-03）**

- **交接与起始配置：**使用 `GameplayBRouteRuntime({ seed, nodes, initialParty })`；`parkRouteNodes` 与 `parkInitialParty` 来自 `prototypes/gameplay-b/src/content/park-route.ts`。包版本 `gameplay-b-prototype@0.1.0`；配置标识为 `park-route-v1:fnv1a32-34e64765`（对节点与初始队伍 JSON 的 FNV-1a 32 位指纹）。整局 seed 显式传入；战斗 seed 由 Runtime 按 `route-battle:${masterSeed}:${node.id}:${battleSequence}` 派生。
- **固定 seed：**`park-inspection-demo`（正式入口 seed）、`gameplay-b-calibration-01`（固定诊断变体）；每个 seed 以同一配置和逐次 `click()` 推进两遍。每次完整 Route View 轨迹均作深比较，包含所有 Click 后状态、事件、当前冻结回合、技能检查、配方计划、结算投影及终态。
- **运行环境：**Windows PowerShell；Node `v26.7.0`；npm `11.19.0`；2026-10-03。定向命令 `npm test -- --reporter=verbose --silent=false tests/calibration.test.ts`；完整命令 `npm test`、`npm run typecheck`、`npm run build`，均在 `prototypes/gameplay-b/` 执行。

指标只描述这两个固定配置样本，不代表总体胜率、平衡结论或用户体验反馈。`battleRoundsByNode` 是每次战斗 Click 一轮；倒地指标统计逐次 HP 从正值变为 0 的角色数；`activityDice` 统计活动结果事件携带的骰数；`observeActions` 统计冻结回合中的待机行动；技能指标统计冻结回合内的检查、触发与免费动作；`recipeMatches` 统计冻结配方计划的命中数。

| Seed | 终态 / Click | 战斗轮数（Node 5 / 9 / 11） | 活动骰 | 我方 / 敌方倒地转变 | 待机 | 技能检查 / 触发 | 免费技能动作 | 配方命中 | 500 Click 命中 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `park-inspection-demo` | complete / 26 | 15（4 / 5 / 6） | 36 | 0 / 8 | 13 | 77 / 14 | 13 | 15 | 否 |
| `gameplay-b-calibration-01` | complete / 26 | 15（4 / 5 / 6） | 36 | 0 / 8 | 15 | 77 / 16 | 16 | 17 | 否 |

- **状态断言：**每个初始/Click 后快照检查节点索引与数量、唯一队伍和战斗者 ID、角色 HP 为整数且在 `[0, hpMax]`、战斗 sCost 在 `[0, 5]`、非战斗场所 sCost 清空、事件序号连续且 click 有序、terminal 与 result 对应；非终态每次 Click 恰好使 Click 计数增加 1。
- **终态夹具：**完整 `npm test` 包含 `prototypes/gameplay-b/tests/park-demo.test.ts` 的完整通关、Route 失败、Route 平局及终态重复 Click 幂等覆盖；本校准集不要求自然 seed 产生三类结果。
- **诊断上限：**两个实测 seed 均未达到 500 Click。额外以诊断上限 1 执行分支检查，采集器返回 `diagnosticCapReached=true`、`result=ongoing`、`terminal=false`；它不制造失败或更改 Runtime。500 是采集器默认上限，不是游戏规则。
- **验证结果：**定向诊断 1 文件 / 2 项通过；完整套件 13 文件 / 109 项通过；`npm run typecheck` 通过；`npm run build` 通过（Vite 8.3.2，22 个模块）。施工差异限于本 Unit 两个新增测试文件及本 Receipt，没有改角色/敌人/配方/路线配置、Runtime 或 UI。

## Patch Unit 0193-U2（P1）：证据支持的参数校准

### Goal

用 U1 的实际测量、手算与可追溯观察定位一个明确问题，只校准证据支持且原型定义为可调的数值参数，并以同一 seed 集复测；证据不足时不改数值。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规则基线 | `task-0186-gameplay-b-prototype-rule-baseline.md` 的已确认语义、暂定标记和案例 | 将必须保留的语义与可调整数值区分 |
| 前置交接 | 0187–0192 最终 Receipt 及角色/敌人/配方/路线配置来源 | 确认字段含义、调用关系及前置 Task 的验收边界 |
| 本 Task 测量 | 0193-U1 Receipt、测试及固定 seed 输出 | 仅据实际观测定位问题，不从预想结果倒推数值 |
| 可调配置候选 | 实际交接中对应的 `prototypes/gameplay-b/src/content/characters.ts`、`enemies.ts`、`recipes.ts`、`park-route.ts` | 仅修改真实存在且交接确认是数值配置的字段 |
| 回归测试 | 实际角色/敌人/配方/路线测试与 U1 定向测试 | 验证语义不变、局部修改没有破坏整局 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含 U1 数据、相关配置/测试和 0186 规则片段 |
| 文档 Read Set | 默认 3–8 篇；只读支持所选参数和语义边界的材料 |
| 历史文档 | 0 篇；不以旧数值方案替代本轮证据 |
| 超预算处理 | 一次只校准一个问题；需跨更多文件时停止并重拆 Unit |

### Optional Read Set

- 仅当选定字段的来源/单位不能从 Read Set 判断时，申请读取一个直接配置消费者；在确认前不编辑参数。

### Do Not Read by Default

- AC 内容或源码、没有被 U1 数据指向的其他 Chara/路线数值、历史体验推测和无关 UI 实现。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| U1 有两条固定 seed 的实际完整结果，但尚无可重复的数值问题案例或真人体验反馈 | 本文 U1 Execution Receipt、固定 seed 完整轨迹 | 不据两个 seed 的分布推导难度、技能强度或配方频率目标 |
| `characters.ts`、`enemies.ts`、`recipes.ts`、`park-route.ts` 是 U2 允许审查/修改的路径；常规初战 Chara/敌方定义在 `first-battle.ts`，中途角色与 camp 数值在 `short-route.ts`，后两者不在 U2 白名单 | U2 Allowed Files；`prototypes/gameplay-b/src/content/` 实际文件 | 当前无证据指向白名单外参数；若以后需调整，先修订 Task 范围，不越界修改 |
| 用户已确认语义不能在校准阶段更改 | 0186 基线中相应决定；本 Task Goal | 暂定内容也不得冒充用户决定；冲突需退回裁定 |

### Constraints

- 先在 Receipt 形成可审查的问题描述：对应 seed/事件、影响面、当前值、拟调整单一参数、预期观察项和规则基线映射。测量分布只能提出线索，需有确定性重现、手算或明确的体验观察支持修改。
- 只调整前置实际代码明确归为可调的已有数值；每轮限一项，以同一 U1 seed 集比较 before/after，并保留未变化语义的测试证据。
- 不改字段含义、路线拓扑/节点顺序、Click 频率、AI 条件/牌序、角色的卡组资格/目标、配方顺序、效果类别、技能免费性/触发时点、伤害结算时序或胜负判定。
- 体验观察需记载观察者和方式；工程代理的浏览器冒烟不等于用户反馈。没有真人反馈时明确标注“未取得”，不得写成体验已认可。
- 如无足够证据支持调整，允许零代码改动；Receipt 应写明审查过的证据与不改的理由，不为完成阶段强行改数。

### Allowed Files

- `prototypes/gameplay-b/src/content/characters.ts`
- `prototypes/gameplay-b/src/content/enemies.ts`
- `prototypes/gameplay-b/src/content/recipes.ts`
- `prototypes/gameplay-b/src/content/park-route.ts`
- `docs/plan-work/task-0193-gameplay-b-calibration-and-standalone-delivery.md`（仅记录实际对照数据与本 Unit Receipt）

### Explicit Non-goals

- 不做全局平衡优化、胜率目标优化或主观体验包装；不重构内容格式或修实现缺陷。
- 不调整固定 seed 清单来隐藏不利结果；不修改 U1 测量口径。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件。另：没有 U1 的实际输出/可追溯问题案例、参数字段不在真实交接中明确可调、需改变用户已确认语义、需跨越白名单到战斗 Runtime/UI、或同一 seed 对照不能解释影响时停止。实现缺陷退回对应前置 Task；规则冲突退回产品/规则裁定，不用数值掩盖。

### Completion Criteria

- [x] 对所审查的证据逐项记录来源；若执行调整，问题由可重复案例支持，且仅更改明确允许调整的数值参数。
- [x] before/after 使用同一 seed 集、同一环境与统计口径，记录实际值和差异；未调整时记录证据不足/无需调整的依据。
- [x] 验证所有既有确认语义未变化；受影响的定向测试和 U1 固定 seed 回归通过。
- [x] 体验证据标明观察者与实际过程；未取得用户反馈时明确记为未评估，不推断用户认可。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 配置回归 | 按实际 package 脚本运行被修改内容对应的定向测试 | 配置引用与基础场景仍有效 |
| 前后对照 | 使用 U1 原封不动的 seed 集与测量方式重跑 | 结果差异可追溯到单项参数；不得以指标目标强行判定胜负质量 |
| 语义审查 | 按 0186 已确认表逐项对照改动与事件 | 没有改变确认语义、时序或点击边界 |
| Receipt 检查 | 核对观察者、seed、参数 diff 与实际反馈来源 | 不混淆测量、代理冒烟和用户反馈 |

### Execution Receipt 0193-U2

**状态：complete（2026-10-03，零代码校准）**

- **审查依据：**0193-U1 两个固定 seed 的双重完整 Route View 轨迹相等；两个 seed 都是 `complete / 26 Click / 15 战斗轮`，各有 `0` 我方倒地转变、`8` 敌方倒地转变，分别记录 13/15 次待机、14/16 次技能触发、15/17 次配方命中。U1 全部指标及定义见上方 Receipt；失败/平局由前置 `prototypes/gameplay-b/tests/park-demo.test.ts` 的固定 Route fixtures 覆盖。
- **规则依据：**0186 将 seed 分布限定为描述性诊断，不作为平衡目标；多个 sCost、Camp 与检定数值仍标记为原型候选。用户确认的配方输出与“校准镜”语义不可借数值校准改变。两个样本无卡点、非预期终态或重复数值缺陷指向某个可调参数；“零我方倒地”没有已裁定阈值，不据此单独判断过易。
- **候选范围核对：**当前 U2 白名单中的技能触发率等候选没有问题案例指向；`first-battle.ts` 包含常规初始 Chara/敌人及相应 sCost 数据，`short-route.ts` 包含中途加入 Chara 与 Camp 数值，但均不在 U2 Allowed Files。因当前证据不指向这些字段，没有申请扩展范围或修改它们。若后续人工游玩反馈明确指出相关参数，再先修订白名单/拆 Task。
- **Before/after：**before 是 U1 Receipt 的两 seed 完整指标；本 Unit 无内容/规则源码改动。U2 复跑同一 seed 集后，配置指纹仍为 `park-route-v1:fnv1a32-34e64765`，统计逐项与 before 相同（变化均为 0）。此对照只说明无代码改动下可重现，不代表参数已平衡。
- **体验来源：**没有取得真人用户游玩反馈，用户体验仍标记为“未评估”。Agent 对固定轨迹的只读审查与自动测试仅是工程诊断，不等同玩家认可。
- **验证：**`npm test -- --reporter=verbose --silent=false tests/calibration.test.ts` 2/2 通过并再次输出原始指标；`npm test` 13 文件 / 109 项通过；`npm run typecheck` 通过。没有数值 diff；0193-U2 只更新本 Task 的 Receipt。

## Patch Unit 0193-U3（P2）：项目外隔离交付验证

### Goal

把最终原型复制到仓库外新建的临时目录，在脱离 AC 仓库、父级依赖与路径的条件下安装、测试、类型检查、构建并启动页面；记录证据后清理临时副本。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 前置交接 | 0187–0192 最终 Receipt、边界核查及构建结果 | 确认交付清单、实际启动步骤、需携带的源码/资产和已知限制 |
| 包配置 | 实际 `prototypes/gameplay-b/package.json`、`package-lock.json`、`tsconfig.json`、Vite 配置 | 核对包脚本、锁文件、别名与构建 root；不得假设脚本签名 |
| 说明文档 | 实际 `prototypes/gameplay-b/README.md` | 确保隔离副本有可按步骤执行的安装/测试/启动说明 |
| 测试/产物 | 最终定向及整局回归；实际构建输出和静态依赖 | 确认复制清单能包含运行所需文件且不携带 AC 外部依赖 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含清单核对、独立目录命令和产物检查 |
| 文档 Read Set | 默认 3–8 篇；只读 0187–0192 交付相关段和本 README |
| 历史文档 | 0 篇；不读无关安装/发布历史 |
| 超预算处理 | 暂停复制验证并收窄副本，不扩大到 AC 工程整体 |

### Optional Read Set

- 如打包后有资产缺失，只读取实际浏览器错误指向的一个被引用文件；回查路径是否属于原型包自身。

### Do Not Read by Default

- AC 根 package/config、AC 业务源、仓库外用户目录内容和无关项目；不得扫描或复制整个仓库作为诊断捷径。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 0187-U1 提供独立 package manifest、lockfile 和脚本配置 | `task-0187-gameplay-b-standalone-click-prototype.md` U1 Receipt | 不证明最终 demo 可以在项目外完整运行 |
| 0193-U3 临时副本安装、测试、构建及固定路线试玩均已通过；安全清理命令被自动策略拦截，副本仍在临时目录 | 本文 Execution Receipt 0193-U3 | 清理确认前 U3 与 Task 保持未完成，不虚报归档 |
| 0193 的独立交付目标是玩法 B 原型，不是 AC 发布或集成 | 本 Task 目标与共用边界 | 不将临时目录变为长期发布地点 |

### Constraints

- 复制前核对 0187–0192 的实际交付清单与最终入口；临时副本仅含原型自身所需文件，排除 `.git`、`node_modules`、既有 `dist`、AC 工程文件和个人数据。
- 临时路径必须由 U3 新建于操作系统 temp 根之下且在仓库规范路径之外；复制前后记录规范路径。禁止把仓库根、其他项目目录或预存目录当作清理目标。
- 在副本中按实际 README/script 执行 clean install、test、typecheck、build、dev 与本地浏览器检查；dev 只需本机访问，检查已构建/请求的资源均在副本范围内。
- 检查构建与源引用无 AC 路径别名、父级 node_modules 依赖、AC 资源请求、存储读取或外部业务源码引用；npm registry 仅作为包安装来源，需记录锁文件解析来源及安装结果。
- Receipt 记录操作系统、Node/npm 版本、准确临时路径、排除项、命令/结果、构建产物检查和清理结果。失败时保留必要证据并说明，不得谎报已清理。
- 完成核对后只清理 U3 新建的唯一临时目录；删除前再次确认最终规范路径仍位于 temp 根内且不是仓库或用户数据路径。

### Allowed Files

- `prototypes/gameplay-b/README.md`
- `prototypes/gameplay-b/package.json`
- `prototypes/gameplay-b/package-lock.json`
- `docs/plan-work/task-0193-gameplay-b-calibration-and-standalone-delivery.md`（仅记录外部构建证据与本 Unit Receipt）

### Explicit Non-goals

- 不发布、上传、部署或安装到用户机器；不提交临时副本、`node_modules` 或构建产物。
- 不复制 AC 工程、不建立长期维护的发行目录，不在仓库根添加启动脚本。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件。另：0187–0192 未完成实际交接；实际包/脚本与 Read Set 不一致；构建需要读取仓库外/父级代码；临时路径不能规范化确认在仓库外；必需命令失败或结果无法解释；需修改白名单外文件时，停止并记录。若怀疑已有目录可能含用户数据，绝不递归删除，先停下交回。

### Completion Criteria

- [x] README 对安装、定向/完整测试、类型检查、构建、启动、刷新重开给出实际可用命令；脚本和 lockfile 与 0187–0192 交接一致。
- [x] 使用仓库外新建临时目录，排除父级配置、`node_modules`、旧 `dist` 和 AC 文件后，独立安装及 test/typecheck/build/dev 均完成并记录实际结果。
- [x] 浏览器检查确认页面和资源从副本服务，功能/终态可按交接步骤复现，不访问 AC 代码/资源或存储。
- [ ] Receipt 记录 Node/npm 版本、路径、命令、构建输出和边界检查，并确认临时副本已安全清理；如果无法安全清理，明确列为未完成阻断。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 副本准备 | 在 OS temp 根创建唯一目录，规范化确认在项目外，复制原型清单并排除开发/构建目录 | 副本不依赖仓库父级文件或 node_modules |
| clean install | 在副本执行 `npm ci` | 仅使用原型 package/lockfile 安装成功 |
| 独立工程命令 | 副本中执行 `npm test`、`npm run typecheck`、`npm run build` | 按 package script 全部通过，构建输出在副本内 |
| 页面验证 | 副本中按 README 启动 dev 并浏览器走查一局 | 无缺失资源、AC 路径请求或控制台错误；Click 与终态可复现 |
| 边界与清理 | 搜索副本中的 AC 路径/别名，记录产物；确认路径后删除 U3 唯一临时目录 | 无项目外源码依赖，临时副本清理完成 |

### Execution Receipt 0193-U3

**状态：partial — 2026-10-03；清理操作等待用户确认**

- **环境：**Windows 11 家庭中文版；Node `v26.7.0`；npm `11.19.0`。包名/版本为 `gameplay-b-prototype@0.1.0`，lockfileVersion `3`。
- **复制清单：**只复制 `README.md`、`package.json`、`package-lock.json`、`tsconfig.json`、`index.html`、`src/`、`tests/`。复制前临时目录不存在；排除了 `.git`、`node_modules`、旧 `dist`、AC 工程文件和其他用户数据。规范路径为 `C:\Users\15229\AppData\Local\Temp\gameplay-b-u3-f95caa55c8d849b0a3746e173374e4cb`，已验证在系统 Temp 下且在仓库外。
- **命令与结果（均在副本执行）：**`npm ci` 成功（added 37 packages）；`npm test -- tests/calibration.test.ts` 1 文件 / 2 项通过；`npm test -- tests/park-demo.test.ts` 1 文件 / 6 项通过；`npm test` 13 文件 / 109 项通过；`npm run typecheck` 通过；`npm run build` 通过（Vite 8.3.2，22 modules）。`npm ls --depth=0` 仅列出原型直接依赖 TypeScript 7.0.2、Vite 8.3.2、Vitest 5.0.3。lockfile 的 81 个 resolved package URL 全部来自 `registry.npmjs.org`。
- **Dev / 游玩结果：**以 `npm run dev -- --host 127.0.0.1 --port 5187 --strictPort` 启动，Vite ready；页面返回 HTTP 200。单个浏览器窗口从开局一路 Click 26 次到 Node 12，终态按钮“巡查完成”且 disabled；节点 5/9/11 分别推进 4/5/6 个战斗回合，节点 6 后队伍为 5 人、节点 10 后为 6 人（最终 4 前排 + 2 后排），路线事件 192 条。刷新后回到固定 seed 开局的 Node 1、4 人队伍与可用 Click 按钮。此处验证实际游玩路线，不进行多尺寸/兼容性比较。
- **资源与边界：**浏览器页 origin 为 `http://127.0.0.1:5187`；页面脚本入口为同源 `/@vite/client` 与 `/src/main.ts`。原型 `src/` 静态 import 均为原型内相对路径；在 `src/` 与 `index.html` 未找到外部 URL、fetch/XHR、浏览器存储调用或 AC 路径。浏览器日志 error/warn 为 `[]`。构建产物只在副本内 `dist/`，包含 `index.html` 与本地 JS/CSS bundle。
- **清理阻断：**浏览器测试标签已关闭，4 个本次创建的 dev-server 进程已停止。清理前再次核验目标为上面唯一的新建 Temp 路径，确认路径仍在系统 Temp 且不在仓库。PowerShell 对该路径的 `Remove-Item -LiteralPath ... -Recurse -Force` 被本机自动安全策略拒绝（工具返回 `blocked by policy`）；没有尝试其他执行通道绕开拦截。临时副本目前保留在上述路径，U3 清理项及 Task 归档仍未完成；取得用户确认后再从文件管理器移入回收站清理并复核。

## Context Budget 与全局停止条件

- 每个代码 Unit 包含本 Task Receipt 在内限 3–5 个白名单文件、约 300–500 行净改动；不以目录通配扩张白名单。测量结果记在 U1 Receipt，不新增未列结果文件。
- 遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六类停止条件：白名单外修改、预算超限/新增文件、Read Set 越界、与源码/交接冲突、需自行裁定规则或扩展目标、必需验证失败/无法执行/不可解释。
- 0187–0192 的实际交接是施工门槛，Task 计划不证明接口已存在；任何前置缺陷退回对应 Task。
- 不把校准参数或原型暂定规则写入 docs-829 正式机制；不改 AC 源码、根 package、生成 Schema、AC 资源或其他 Task/Draft。

## 测试与验收

- [x] 固定 seed 同输入可重放，状态合法；通关、失败、平局分别由可复现样例验证。
- [x] seed 统计作为诊断数据解释，不用自然种子分布替代平衡或玩法体验结论；500 Click 只是诊断上限，不是失败规则。
- [x] 仅在证据支持时调整数值参数；同一 seed 集有前后对照，用户已确认语义保持不变；没有足够证据时零改动并说明。
- [x] 代理浏览器冒烟与用户体验反馈分开记载；未取得用户反馈时不声称用户认可。
- [ ] 原型从项目外临时副本 clean install、test、typecheck、build、dev 和浏览器走查通过；副本不依赖 AC/父目录，最终已安全清理。

## 验证入口

在 `prototypes/gameplay-b/` 运行 U1/U2 定向测试和 package 命令；具体 script 名称及参数以 0187 实际交接为准。U3 必须在唯一仓库外临时副本复跑 `npm ci`、`npm test`、`npm run typecheck`、`npm run build` 与 `npm run dev`，再完成浏览器检查。所有实测数据、工程输出和体验反馈来源写入相应 Unit Receipt；不得预填测试/体验结论。

文档检查仅在实际执行时记录真实结果；核对新文档行尾空白和源码路径，不能依赖忽略未跟踪文件的普通 diff。

## Execution Receipt 与交接

三个 Unit 的 Receipt 均以内联追加于对应小节。每个 Receipt 只记录实际修改、未完成内容、命令与结果、问题与上游确认项。U1 交付 seed 测量和可复现终态入口；U2 交付参数前后对照或零改动理由；U3 交付项目外复现步骤、隔离证据及临时目录清理状态。全部工程验收完成后本 Task 系列结束，不自动授权 AC 集成。

## 剩余工作

0193-U1/U2 已完成，U3 的隔离安装、构建和完整游玩已通过；剩余本机安全策略拦截的临时副本清理。清理完成后做终态核验、归档 Task 并更新索引。后续玩法改造或 AC 接入另立 Task。

## 相关路由

- `draft-0185-gameplay-b-progressive-prototype-tasks.md`
- `task-0186-gameplay-b-prototype-rule-baseline.md`
- `task-0187-gameplay-b-standalone-click-prototype.md`
- `task-0188-gameplay-b-deterministic-battle.md`
- `task-0189-gameplay-b-card-recipes-and-skills.md`
- `task-0190-gameplay-b-camp-route-lifecycle.md`
- `task-0191-gameplay-b-complete-park-demo.md`
- `task-0192-gameplay-b-three-column-ui-acceptance.md`
