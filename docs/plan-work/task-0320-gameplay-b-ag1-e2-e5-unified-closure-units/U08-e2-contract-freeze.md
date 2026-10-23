# Unit 0320-U08：E2 范围与作者合同冻结

## Goal

在 E2 源码施工前，核实现有能力并冻结 P2 纳入项、最小作者语义、状态生命周期、预算、Receipt/Restore 与 E5 接线边界；本 Unit 只改任务文档与索引。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 白名单与停止条件 |
| Task / Draft | Task 0320；Draft 0312 §3、§5.1–5.5、§6、§8、§13 | E2 示例、E1 边界、AG-1 来源时点与外部接线边界 |
| 前置 Task | Task 0316–0319 | 确认确定性 TargetSet、静态 Tag/Pool、Encounter Status、Prepared Tag 的已完范围 |
| 作者合同 | `src/data-services/contracts/gameplay-map-effects.ts` | 当前闭合 AST、TargetSet/Value/Condition 与预算 |
| Owner | `src/arona-clicker/contracts/map/map-run.ts`、`src/arona-clicker/services/map/map-run-service.ts` | Run/Encounter State、单目标草稿、AG-1 scheduler snapshot/Receipt |
| Planner | `src/arona-clicker/services/map/map-effect-planner.ts`、`src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts` | detached 规划、集合解析与当前单位目标候选 |
| 路线 | `src/data-services/contracts/gameplay-map.ts`、`src/data-services/registry/registry-validate.ts` | Edge 当前条件与引用校验边界 |
| 测试 | `tests/data/gameplay-b-effect-syntax.test.ts`、`tests/engine/gameplay-b-effect-planner.test.ts`、`tests/engine/gameplay-b-map-ag1-restore.test.ts` | 已有语法拒绝、确定性 planner 与 AG-1 历史重算证据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 18k tokens；只核对命中的合同与符号 |
| 文档 Read Set | 8 篇/节；不顺序通读其它 Task 文档 |
| 历史文档 | 0 篇；Draft §3 行为样例是范围来源 |
| 超预算处理 | 需改变 MapRun Owner、Scheduler Restore 或扩大 Schema 范围时，拆为独立 Unit 并先修订 Task |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 确定性 TargetSet 仅由 damage/heal 消费，支持 living/all、定义/HP比例顺序、limit≤32；随机顺序拒绝 | `gameplay-map-effects.ts`、`map-effect-planner.ts`、`tests/data/gameplay-b-effect-syntax.test.ts` | 不把现有 `repeat` 当通用循环 |
| 当前 Value 读取 HP、Counter、Round、TargetSet人数；Actor/Team资源余额条件未实现 | `gameplay-map-effects.ts`、`map-effect-planner.ts` | 资源变化目前是有序账本 |
| 每个 Party Character 草稿至多保存一个主单位/CardRef目标；TargetSet 是定义规则抽取，不是第二个玩家选择 | `map-run.ts`、`gameplay-b-action-preview-resolver.ts`、`map-effect-planner.ts` | 领域身份不从 UI 坐标推导 |
| Encounter locals 随 Encounter 退出清理，MapRun 没有通用 Fact 状态 | `map-run.ts`、`map-run-service.ts` | `visitedNodeIds` 等不是可由 Effect 读写的 Fact |
| Edge 当前只接受 `teamResourceAtLeast` | `gameplay-map.ts`、`registry-validate.ts`、`map-run-service.ts` | Fact 驱动路线解锁归 P5/E5 |
| AG-1 来源按顺序先支付固定成本，再执行完整效果；后续来源可见前序来源兑现结果 | Draft 0312 §13.3、U05 Receipt | Task 0320 P2 已指定余额条件按来源开始可见余额求值 |

## Frozen P2 Contract

### E2R 随机 TargetSet

- 在现有 side/filter 上允许 `order: 'random'`；随机顺序和定义/HP比例排序互斥，且必须带 `limit: 1..32` 作为抽取数量。过滤后无放回抽取；候选不足取实际人数。空集合合法且不消耗随机游标。
- 抽取顺序就是目标/循环执行顺序；Receipt 保存身份顺序及随机状态前后。
- MapRun Owner 持有与 Hand RNG 分离的 `effectRandomState`（算法、seed、cursor 独立）。算法 `counter-addressed-murmur3-fmix32-v1` 固定如下：所有运算按 uint32 回绕，`fmix32(k)` 依次执行 `k ^= k >>> 16; k = imul(k, 0x85ebca6b); k ^= k >>> 13; k = imul(k, 0xc2b2ae35); return (k ^ (k >>> 16)) >>> 0`。新 Encounter 的 `handInitialSeed` 指该 Encounter 初始 Hand `randomState.seed`（任何 Hand 抽取前）；Effect seed 为 `fmix32((handInitialSeed ^ 0x45464658) >>> 0)`。在非负 safe-integer cursor `c` 处取原始字时，`low = c >>> 0`、`high = floor(c / 2^32) >>> 0`，`word = fmix32((seed ^ low ^ imul(high ^ 0x9e3779b9, 0x85ebca6b)) >>> 0)`。cursor 表示下一个原始字索引，每次原始字（包括被拒绝的字）消耗后加一；到达 `Number.MAX_SAFE_INTEGER` 时拒绝继续抽取，不回绕。对范围 `n` 的无偏整数抽样取 `limit = floor(2^32 / n) * n`，重复取字直到 `word < limit`，结果为 `word % n`。过滤后的候选保持原有确定性顺序，并用部分 Fisher–Yates 每次从剩余候选抽取；最多抽 `min(limit, 候选数)` 个，结果顺序即执行顺序。空集合不消耗随机游标。新 Encounter 在初始 Hand seed 上用独立域标记确定性派生；同一 Encounter 后续 Round/恢复沿用 Effect 状态，不从已推进的 Hand cursor 重新派生。解释器不调用 `Math.random`。状态跨 Round 持续、新 Encounter 重新派生，并进入 checkpoint 与 scheduler start snapshot。
- Preview 只在 detached 副本抽取；成功 Commit 才安装新 cursor。失败、过期、重试、Restore 验证不推进 Owner 状态；Hand RNG 的算法、seed、cursor和候选概率不受影响。

### 任意受限语句体 `forTargets`

- 有限 TargetSet 加有序 Effect Statement body。到达语句时只解析一次并固定目标身份/顺序，然后逐个成员完整执行 body；不会重选集合或替换来源 primary/CardRef。
- body 可包含现有有限 resolve 语句与 `when`；不允许 prepare、AC 外部写入或无界引用/递归。嵌套循环有界，沿用静态节点64/深度4、TargetSet32、单来源展开1024与整轮4096 visits；嵌套预算乘积共同计数，超限或任一 body 错误整轮零安装。
- 新增词法只读 `loopTarget` 引用，仅在当前循环 body 可见；内层遮蔽外层，退出内层恢复外层。现有 damage/heal 的 `target` Value 仍指当前命中单位，不改变旧含义。
- Trace/Receipt 保存 loop 的固定目标列表与 iteration identity/order；Restore 从 AG-1 scheduler start snapshot 重跑 planner，比较 loop 访问、结果和随机游标。

### 资源余额 Value / Condition

- 增加只读 `resourceBalance(account, resourceId)` Value 和 `resourceAtLeast(account, resourceId, value)` 条件；账户限 `sourceActor`、`primaryActor`、`additionalActor`、`loopTargetActor` 与 `sourceTeam`。余额只读取已声明 Map-local resource；引用未物化账户或缺失资源时拒绝，不默认补0。
- `resourceChange.delta` 仍为固定的非零 signed safe integer，不允许 Value。当前 `resourceChange.account` 保持已接线的 `sourceActor | primaryActor | sourceTeam`；将 `additionalActor` / `loopTargetActor` 作为写入账户，需要后续 Runtime Planner 同时绑定额外目标身份/当前循环成员，在独立运行时 Unit 实现。P2 的“额外队友获得资源”仍是待完成结果，不得因读账户语法通过而视为已交付。
- 账户资源可用性必须与 MapRun Owner 的实际物化规则一致：Party Actor 资源由任一 Map `initialActorResources` 声明或任一 Action 的 Actor-scoped cost 声明，并按 Party 身份物化；Party Team 资源由 Map `initialTeamResources` 或 Action Team-scoped cost 声明；Enemy Actor 与 Enemy Team 资源分别由当前 Encounter 的 `initialResources` 和 `initialEnemyTeamResources` 声明。只有已物化账户上的缺值表示0；未物化身份/资源仍拒绝。
- 在每个来源开始时读一次可见工作余额：固定成本支付后、该来源效果前。整个来源 resolve 内读数冻结；本源 `resourceChange` 不改变同源 guard/amount 的读值。前序来源完整兑现的变化对后续来源可见；资源条件不决定本源可付性，来源不能用自身收益付自身固定成本。
- Ability/Item 无 `sourceActor`；合法 Primary/Additional Unit 可对应 Actor；Actorless `sourceTeam` 指 Party Team。PlayerCost 与 Item inventory 不是 MapRun Actor/Team 资源。
- 条件阈值为非负安全整数；`resourceChange` 仍为固定 signed integer，本阶段不让费用或资源效果自身依赖 Value。

### 显式额外目标与 MapRun Facts

- P2 纳入一个作者声明、每来源最多一个的额外单位目标：Party Character 或 Enemy，不是 CardRef/TargetSet；要求 Action 已有单位主目标，且只给可由玩家选择的 Party/PlayerCommand/Ability/Item 来源使用，Enemy 自然来源不得声明。按领域 ID 选择并在 Preview/Commit/Restore 重验当前 Run/Map/Node/Activity/Round scope；需与主目标不同，Party 来源的额外 Party 目标还须与来源者不同。显式目标不自动 fallback；若更快来源先将其击倒，沿 AG-1 显式目标实际0变化语义处理。
- `additionalActor` 可作 Actor 账户；不扩为任意数量目标。依据 Draft §3 A「掩护后鼓舞」：敌方主目标受击，另选队友获得资源。群体/随机走 TargetSet、`forTargets`/E2R；排位、邻接、区域和链式传播仍属 E5。
- P2 增加 MapRun-local 有界 Counters/Flags：由 Map 定义初始化，属于单次 MapRun；跨 Encounter/Node 保留并进入 detached planner、scheduler start snapshot、Receipt 与 Save/Resume。新 Run 重新初始化，Run 清除时一并清除；与 Encounter locals、长期 AC/Story 状态分离。
- MapRun Fact 读写不直接移动 Node；Fact 驱动 Edge 解锁、跨 Map Pool、临时 Item Owner/消费归 P5/E5。扩展 AG-1 replay snapshot 时升级 scheduler 格式版本及相关 Map `resumeVersion`；不编写旧存档迁移。

### E2 作者 AST 拼写与执行合同

- 所有新增 E2 AST 构造（随机 TargetSet、`forTargets`、资源余额 Value/Condition、MapRun Fact Value/Condition/Statement）和 Action `additionalTarget` 只可用于显式 `executionContractId: 'AG-1'` 的 Map；省略执行合同或声明 `E1-COMPAT-1` 时，Registry 按具体 Action/Encounter 上下文拒绝这些 E2 构造。原有 E1 AST 行为与省略字段的兼容路径不变。MapRun Facts 作者声明/根状态本身仍可在 E1 Map 存在，但 E1 Effect Program 不可读写它。
- 随机 TargetSet 沿用 `GameplayMapEffectTargetSetDef` 的 `order: 'random'` 与 `limit: 1..32`，不新增 seed/算法作者参数；缺省 order 仍为 `definition`。`order: 'random'` 必须有 limit，任何确定性 order 都不得将 random 与排序组合。
- 任意语句体循环的唯一 AST 形状为 `{ op: 'forTargets', targetSet: <GameplayMapEffectTargetSetDef>, body: <ordered statement[]> }`。到达该语句时解析一次 `targetSet`，固定该次序作为本层循环成员；`body` 中 `loopTarget` 指当前成员，内层 `forTargets` 遮蔽外层并在退出后恢复。`loopTarget` 可用于单位引用、HP Value 与 Actor 账户余额读取；当前 `resourceChange` 写账户不含 `loopTargetActor`，需在有循环成员身份的后续 Planner Unit 接线。现有 damage/heal 的 `target` Value 仍指该次 damage/heal 当前命中的单位。循环可嵌套但受既定总预算限制，不得引入 prepare、递归或无界执行。
- 资源读取 Value 形状为 `{ kind: 'resourceBalance', account, resourceId }`；条件形状为 `{ kind: 'resourceAtLeast', account, resourceId, value }`，其中 `value` 是非负 safe integer。读账户闭合集合为 `sourceActor | primaryActor | additionalActor | loopTargetActor | sourceTeam`；写账户暂保持当前已接线集合 `sourceActor | primaryActor | sourceTeam`，待后续 Runtime Planner Unit 增加额外/循环身份绑定。缺失/未物化账户或未声明资源仍拒绝，不将资源缺失默认成0；余额按本合同的来源开始时点读取，写入按语句顺序进入 detached 工作账本。
- MapRun Counter Value 形状为 `{ kind: 'mapRunCounter', counterId }`；比较条件为 `{ kind: 'mapRunCounter', counterId, comparison, value }`；Flag 条件为 `{ kind: 'mapRunFlag', flagId, value }`。Counter 写入形状为 `{ op: 'mapRunCounterAdd', counterId, delta }`；Flag 写入形状为 `{ op: 'mapRunFlagSet', flagId, value }`。Fact ID 引用 MapRun `mapRunFacts` 的独立 Counter/Flag 命名域；条件只允许位于 Action Effect Program 的 `when`，读取本源当前 detached 计划状态，之前的有序 Fact 写入对本源后续语句及后续来源可见。P2 不允许 Encounter completion 条件读取 MapRun Facts：completion 不处于来源级顺序计划中，后续推进门控另行冻结。`mapRunCounterAdd` 采用 Draft 已批准的 D03 饱和到声明 min/max；加法若先溢出 safe-integer 范围仍拒绝整轮，不以饱和掩盖。
- `GameplayMapActionDef` 以 `additionalTarget?: 'partyCharacter' | 'enemy'` 声明单个额外目标的领域身份。它必须和已有单位主目标并存；不支持无主目标或 CardRef 主目标。该 Action 只能出现在玩家可选择的 Party/PlayerCommand/Ability/Item 来源上下文，任何 Enemy 自然行动上下文均不得声明/使用它。运行态选择保存在该来源的 MapRun Draft/Save 中，按领域 ID 在 Preview、Commit、Save/Resume、Receipt/Restore 逐层重验；未选择不允许 Commit。Receipt 与 AG-1 起点快照记录锁定身份；不自动换人，若其已被更快来源击倒则实际结果为0。`additionalActor` 读取该身份的 Actor 资源余额。
- U09c 已把 scheduler 格式升级到 v2；后续将 `effectRandomState` 加入 scheduler 起点快照时必须再升级到 v3，拒绝旧 v2 格式并提高相关测试 Map `resumeVersion`，不增加迁移路径。

## Constraints

- Task 0316–0319 已完成部分保持兼容；不重做静态 Tag/Pool、burn/regen、Prepared Tag combo。
- E1-COMPAT-1 与 E1 U18 豁免状态不变；不把本阶段自动化或屏幕报告写作 E1 浏览器验收通过。
- 架构边界、Schema 同步与测试按 `AGENTS.md` 和命中的当前规范执行。

## Allowed Files

- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md`
- `docs/plan-work/00-index.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U08-e2-contract-freeze.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U08-receipt.md`

## Explicit Non-goals

- 不改生产代码、作者示例、生成 Schema 或 Draft 0312 历史提案文字。
- 不新增 Edge Fact 条件、Story/AC 长期事实、PlayerState 写入、临时 Item、跨 Map Pool、随机 Hand 抽取或 UI 坐标目标。
- 不修改、不刷新或写 GALHCG freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若范围与 Draft 行为样例或当前源码冲突、需新增另一状态 Owner、或作者语义无法在 AG-1 回执中独立重放，停止并报告具体事实。

## Completion Criteria

- [x] E2R、受限循环、资源 Value/Condition 的现有支持与真实缺口有源码/测试依据。
- [x] 按 Draft 行为样例裁定额外单位目标；明确 MapRun Facts 与 Edge/临时 Item 阶段边界。
- [x] 冻结随机集合、抽取顺序、无偏抽样、Owner 独立状态与 Preview/Commit/Restore 语义。
- [x] 冻结循环绑定、嵌套、Trace 与总预算。
- [x] 冻结资源账户、来源开始可见余额与 Actorless 限制。
- [x] 冻结资源读取账户、来源开始可见余额和 Owner 物化来源；确认新 Actor 写账户需由 Planner Runtime Unit 单独接线。
- [x] 冻结新增 E2 AST 节点、额外目标作者字段形状、AG-1 准入边界与 scheduler v3 后续升级规则。
- [x] 明确 MapRun Fact Condition 只在 Action Effect Program 中使用，不开放 Encounter completion 读取。
- [x] 更新 Task 0320 P2/P5 路由与索引。
- [x] 文档链接/结构检查与 `git --no-pager diff --check` 通过，并在 Receipt 记录。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接/结构 | `npm run check:docs` | 新增路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Contract clarification addendum（2026-10-22）

源码复核发现，U08 原文没有明确 Owner 的资源物化范围，且 MapRun Facts 的读取时点以“本源当前 detached 计划状态”描述，但 Encounter completion 不是来源计划。先冻结以下边界：五账户集合限定于 resourceBalance/resourceAtLeast 读取，当前 resourceChange 写账户仍为 sourceActor/primaryActor/sourceTeam；additionalActor/loopTargetActor 写入依赖 Planner 对额外身份/循环成员的接线，保留为 P2 必交能力并由后续 Runtime Unit 承接。资源声明范围与 MapRun Owner 初始化规则对齐；MapRun Fact 条件限定 Action Effect Program `when`，不开放 Encounter completion。该补充不改变 delta、来源时点、AG-1 或 E5 路线边界。
