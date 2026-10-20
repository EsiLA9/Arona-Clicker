# Task：Gameplay B 最终语义收敛、数据结构迁移与最小玩法闭环实施

**状态：approved / active — 阶段 A / B / C1 / C1a / C2 / C3、C4 U1–U3 完成；C4 U4 施工中**

**前置依据：**
- [[archive/report-0285-gameplay-b-core-semantics-reduction]]：当前实现调查与复杂度定性；阶段 A 必须回到源码复核。
- [[archive/task-0286-gameplay-b-minimal-semantic-target]]：最小玩法语义探索任务。
- [[archive/report-0286-gameplay-b-minimal-semantic-ruling]]：Map / Node / Encounter 与最小循环的推荐默认值，供阶段 B 确认或调整。
- [[draft-0287-gameplay-b-phase-b-contract]]：阶段 B 总合同；Character Hand / Prepared Action / Swap / Player Command / Commit、Map / Node / Encounter、状态生命周期、内容入口与 Save / Resume 均已于 2026-10-17 冻结。
- `docs/docs-829/`：现行 Runtime、Datapack、View 等机制说明。
- 本 Task 以下定义的最终产品预期。

## 任务状态与事实边界

- 本 Task 已获负责人授权，阶段 A 只读调查、阶段 B 行为 / 数据 / 内容 / 存档合同以及 C1 / C1a / C2 施工均已完成；施工记录分别见 [[task-0288-gameplay-b-map-node-vertical-slice]] 与 [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle]]。C3 按 [[task-0290-gameplay-b-action-draw-hand-swap-commit]] 推进：U1–U6 全部完成并通过独立复核；后续进入 C4。
- 2026-10-17 负责人明确裁定：**Character Hand 与独立换牌必须保留为核心交互**。角色必须按 Tendency 从当前 Encounter 的合法行为中抽取有限候选；玩家能看到当前手牌、准备行动与目标，并通过独立换牌改变准备行动。换牌不能并入 PlayerCost 指令，也不能因 View 刷新、重复 Preview 或 UI 重开而重抽。该裁定不是待比较选项，也不得降级为高级能力。
- 2026-10-17 负责人批准并冻结 [[draft-0287-gameplay-b-phase-b-contract]] 的 Hand / Swap 子合同五项默认值：每轮最多抽 3 张且不放回；Prepared Action 默认取首张；每队每轮共用一个覆盖槽；候选内 Swap 免费；Hand 外 PlayerCost Command 每次花费 1 点，并与 Swap 共用覆盖槽；只有成功 Commit 才进入下一轮并抽新 Hand。
- 2026-10-17 负责人继续批准并冻结 [[draft-0287-gameplay-b-phase-b-contract]] 的其余阶段 B 默认值：Map/Node/Encounter 关系、相邻移动与遭遇结束回图、三种状态作用域、固定准入队伍、Ability / Item 来源分立、真实 C1a Map Entry，以及 Gameplay B 内容重建和旧 Operation Run 明确失效策略。
- 2026-10-18 负责人补充冻结失败规则：固定队伍全员 HP 归零时结束当前 MapRun；不发成功奖励、不支持撤退或继续 / 重试当前 Run，但允许之后从 Spot 新开完整 MapRun；失败结果页保留到手动返回游戏。失败触发与结果 UI 依赖 C4 的 HP 数据，按 C4 接入，不在 C2 空建状态。
- 阶段 B 的行为、数据、内容与存档合同已整体冻结。后续按 C1/C1a → C2 → C3 → C4 → C5 分阶段施工；每阶段仍须有独立 Read / Write Set、验收与独立复核，不得以整体授权跳过阶段边界。
- 先前 Gameplay B 相关的活动 Draft、Task、Report 与已结束 Goal Set 已按负责人要求移入 `archive/`；其中的结论是历史材料或调查线索，不自动成为本 Task 的设计约束。现行机制事实仍以源码、测试和 `docs/docs-829/` 为准。
- 已有实现调查可帮助阶段 A 定位 `OperationEvent`、`Location`、`Scene`、`Action`、Runtime、View 和存档链路；施工方案必须按届时源码重新验证，不能仅凭旧报告推断。
- 本 Task 的目标模型描述预期玩家体验与内容语义，不要求逐字照搬为同名代码类型。

## 既有 Gameplay B 数据包内容的重建范围

本 Task 明确允许：在本 Task 获批、阶段 A 完成、阶段 B 冻结目标合同后，后续施工阶段**抛弃、删除或替换现有数据包中专属 Gameplay B 的玩法内容，并从零编写新的实际内容**。旧 `OperationEvent / Location / Scene / SceneAction` 内容不需要逐条迁成新结构，不要求为保留旧玩法内容建立长期兼容层；迁移矩阵可以将其列为 `Retire`，并以新内容重新验证真实运行链路。

这项授权只覆盖 Gameplay B 专属内容记录及其专属示例，不自动覆盖同一 Datapack 中的通用角色、资源、效果、条件、资产、包元数据或其他玩法内容。阶段 A 已在调查报告识别包、记录及共享边界；阶段 B 已在冻结合同列出拟重建、删除、保留的边界。若某条记录同时服务其他玩法，施工时仍须先拆清归属，不得因“从零重建 Gameplay B”顺手删除共享内容。

允许从零重建内容**不等于**默许破坏长期 PlayerState 或静默丢弃用户存档。存档版本变化、旧 Run 的继续/失效/重置和用户可见迁移提示已在阶段 B 冻结；本 Task 不要求保留旧 Gameplay B 内容兼容，但要求按批准策略处置存档与非 Gameplay B 数据。

本授权是后续阶段的设计范围，不是本轮立即删改数据的指令。阶段 A 不写入任何源码、Schema、Runtime、UI 或 Datapack 内容。

## 当前执行记录

- 2026-10-17：负责人授权启动总控 Task；阶段 A 只读调查完成，报告见 [[report-0287-gameplay-b-core-migration-investigation]]。
- 2026-10-17：负责人裁定 Character Hand 与独立 Swap 属于核心玩法，并批准冻结 Hand / Swap / Player Command / Commit 子合同的 5 项默认值；Task、C3/D3 验收与阶段 B Draft 已更新。
- 2026-10-17：负责人批准并冻结阶段 B 其余 8 项 Map / Encounter / 生命周期 / 作者内容 / 退役 / Save-Resume 默认值；阶段 B 整体冻结，转入 C1 / C1a 施工。
- 三个 Luna Max 子 Agent 分别核对 Datapack / Registry、Runtime / 状态 / 存档、UI / 样例 / 测试，并继续复核阶段 B 其它决策；未写代码或运行测试。总控结合源码、既有 Stage A 报告与 Agent 结果形成完整合同建议。
- 已将阶段 B 的行为、状态生命周期、Map 内容关系、C1a、旧内容处置及 Save / Resume 默认值汇入 [[draft-0287-gameplay-b-phase-b-contract]]；负责人已批准全部合同。
- 2026-10-17：建立 [[task-0288-gameplay-b-map-node-vertical-slice]] 与 U1–U8 Patch Unit，按依赖开始 Map 数据合同和正常入口竖切片；旧 Operation 内容保留至 C5。
- 2026-10-18：Task 0288 的 U1–U8 C1 / C1a 施工与 U9 合同回归收口均完成。Registry、Resolver、MapRun、Save / Resume、Workspace、普通 Datapack Spot 入口与默认包 UI 端到端均通过目标验证；非施工者复跑并审查 C1a，详见 Task 0288 各 Receipt。
- 2026-10-18：独立复核将 U5 一项过时的 Load 清空断言改为符合 U6 Save / Resume 合同，并补充 Registry 对 `resumeVersion` 正安全整数校验；U9 定向测试 25/25、类型检查和文档检查通过。
- 2026-10-18：建立 [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle]] 承接 C2 固定队伍、初始 PlayerCost 与 MapRun 状态恢复；失败合同已冻结，实际 HP 触发与失败结果显示安排在 C4，避免在 HP 尚不存在时建立空状态或手动失败按钮。
- 2026-10-18：Task 0289 的 U1–U5 全部完成。固定队伍准入、MapRun-local Party / PlayerCost、checkpoint / Variant 校验、成功结果清理与 Workspace 显示均通过独立复核。
- 2026-10-18：C1 / C2 联合回归 8 个测试文件、60 项通过；`npx tsc --noEmit` 与 `npm run check:docs` 通过。C2 失败终态按负责人冻结的“全队 HP 归零”规则安排在 C4，与 HP 数据和原子结算一并实现。
- 2026-10-18：负责人冻结 C4 失败终态细节：固定队伍全员 HP 归零时终止当前 Run；失败结果页留在当前 Workspace，直到手动返回；之后允许从 Spot 新开完整 MapRun。两份只读预检确认 C3 继续由 MapRun 唯一 Owner 承载 Hand / Prepared / Override / RNG / Commit，且不得直接复用旧 Operation 作者层级。
- 2026-10-18：建立 [[task-0290-gameplay-b-action-draw-hand-swap-commit]]，明确 C3 以 Map-local Action 与 Encounter 候选为作者语义，显式初始化 MapRun-local Actor / Team resource，并建立真实 Action 费用 / 效果提交路径；C4 在同一提交管线上扩展 HP / Enemy / Ability / Item 与败北处理。生成 Schema 继续服从根 AGENTS 禁改边界。
- 2026-10-18：C3 U1 完成 Map-local Action / Encounter Tendency 作者合同、Registry 引用及闭合字段校验和新样例。独立复核发现未知字段会被忽略后，已补合同外字段拒绝和重复准入测试；复核通过。定向 Registry 测试 72/72、TypeScript、diff 检查通过；U2 Hand / checkpoint 已委派施工。
- 2026-10-18：C3 U2 完成 MapRun-local Encounter Hand、确定性抽样状态、Actor / Team 资源可支付过滤及 checkpoint 重演校验；Encounter 结束清理 Hand / RNG 并保留 MapRun 资源。独立只读复核通过；三组定向测试 20/20、TypeScript 与白名单文件空白检查通过。U3 开始实施 Prepared Action、Target、免费 Swap 与 PlayerCost Command 草稿。
- 2026-10-18：C3 U3 完成 Hand 首项 Prepared、Target 选择、免费候选内 Swap 与精确 1 PlayerCost 的手牌外 Command；单一 Encounter 共享 Override、复合 Node / round / draftVersion token、checkpoint 恢复校验与无效请求零写入通过独立复核。补充错误 round 与 PlayerCommand Save / Load 回归后，定向测试 24/24、TypeScript、diff 检查通过。U4 开始接入整轮原子 Commit 与真实资源效果。
- 2026-10-18：C3 U4 完成版本化整队 Commit 与正常 GameCommands 接线；全队 Action costs 按提交起始余额联合支付，再顺序应用 Actor / Team Effects，任何失败均零写入，成功后才推进并抽取下一轮。Save / Load 后同请求去重通过；Restore 拒绝多 Override / 超额 PlayerCost receipt，失效 Action Commit 也零写入。独立复核通过；定向测试 38/38、TypeScript 与白名单检查通过。U5 开始接入正式 Preview 与 Map Workspace。
- 2026-10-18：C3 U5 完成只读 Workspace 投影、共享纯 Commit Preview、Controller / GameCommands 命令接线和全队 Hand / Prepared / Target / Override / 资源 / 回执 UI；行动命令维持现有 Map Workspace region refresh，Encounter 子区域局部刷新留给 U6。U5 定向测试 36/36；Map / Registry / Resolver / Runtime Integration / Save-Resume / 正常入口 / Workspace 回归 8 文件 123/123；`npx tsc --noEmit`、白名单 `git diff --check` 与尾随空白扫描通过。独立只读复核无阻塞项；复核指出失效焦点当前回到地图标题，U6 将覆盖遭遇区内焦点回退与连续性。详见 C3 Task 0290 的 U5 Receipt。
- 2026-10-18：C3 U6 完成稳定 Encounter 子区刷新与正式 Datapack / Registry / Resolver / Spot / Controller / MapRun 竖切片；双角色 Hand、免费 Swap、过期请求不重抽、PlayerCommand、资源结算与回原 Node 均通过。8 个 Map 回归文件 124/124、TypeScript 与白名单检查通过；独立复核无阻塞项。computer-use 浏览器验收因 Edge 两次激活失败按技能规程停止，已记录限制；源码与自动化 UI 入口验证通过。C3 U1–U6 全部完成，详见 Task 0290 的 U6 Receipt。
- 2026-10-18：进入 C4 前，三个只读 Luna Max 子 Agent 分别复核 HP / Enemy 状态归属、MapRun / Save / Commit 运行链路和 Ability / Item 来源与库存事务；另有两名 Agent 独立审阅 C4 合同。结论确认继续由唯一 `MapRunService` 持有局内权威；友方 HP 属 MapRun-local、Enemy HP 属 Encounter-local；普通 `ItemService.useItem()` 不能安全用于局内 HP，需由组合层协调 PlayerState 与预构建 MapRun 快照提交。C4 执行合同见 [[task-0291-gameplay-b-hp-enemy-ability-item]]；HP 初始合法性、Battle 终局与检查顺序、Ability / Item 叠加与作者映射、敌方行动、终态保存 / 重试及失败前旧 checkpoint 能否显式回滚等默认值尚待负责人冻结，故未改 C4 代码。Rest / Shop 与条件分支仍保留在 C5 / D2 验收范围。
- 2026-10-18：并行准备 C5 执行合同：确认 `Datapack.maps`、Map Registry / Resolver 和 `Spot.mapEntry` 已在运行时存在，但独立 Datapack Editor 尚无 `maps` 表；当前生成 Schema 也没有 Map 类型，而根 `AGENTS.md` 禁止手改生成文件。源码显示可用 Editor 维护的 `TableMeta.custom` Schema 注册 Maps 表，并由专门字段覆盖及编辑 / Package roundtrip 测试防止漂移。独立审阅后，Task 0292 已补旧 Run 清理确认 / 取消、Shop 扣款与临时货品原子性、Exit 一次性奖励、C4 永久 Consumable 与 C5 临时货品边界，以及 D5 空白入口作者测试。旧内容调用方审计确认：当前 `gameplay-b-datapack.ts` 混合 C1–C3 Map 与旧 Operation records 且同一 Spot 同时挂两个入口；Map tests 仍依赖这份混合样例，需先拆包 / 换 fixture；`gameplay-b-strategy-park` 作为不同 modName 的 bundle 可能残留在 PackManager 持久快照；旧 `operationRun` Restore reject 目前仅写 DevLog；共享 Operation Entry / Registry / Runtime 仍有通用消费者。Task 0292 因此加入干净样例迁移、bundle 快照清理与用户确认旧 Run 失效的验收；文档检查通过。C5 实现细节仍按最小建议处理，U1–U6 施工依赖 C4 完成及独立复核。
- 2026-10-18：负责人通过“冻结全部建议默认值”批准 Task 0291 的 HP / Enemy 内容、逐轮结算顺序、Ability / Item 叠加与来源 / 目标、敌方行动、全队失败以及失败前旧存档显式回滚规则。Task 0291 状态更新为 approved / active；按 U1→U2→U3→U4→U5 串行推进。U1 已由 Luna Max 子 Agent 实施，主控独立复核通过；Battle 内容与 Registry 用例 105/105、C3 MapRun 回归 28/28、TypeScript 和 diff 检查通过。
- 2026-10-18：U2 已由另一名 Luna Max 子 Agent 实施；主控独立复核同轮击倒 / 费用、胜利与敌方回合顺序、低 HP / 平手选敌、HP=0 限制、Save/Restore / RNG / 终态回执与失败回滚，补充立即成功新 Run 清理旧失败摘要回归。MapRun / Save-Resume / Runtime integration 3 文件 41/41，新增边缘回归后 MapRun 31/31，TypeScript 与 diff 检查通过。现在进入 U3 Ability / Item 与 PlayerState / MapRun 跨 Owner 原子提交。
- 2026-10-18：C4 U3 由 Luna Max 子 Agent 完成 Ability / Item 来源草稿、GameInstance 跨 Owner prepare / preflight / 安装 / 事件发布、存档恢复与失败结果查询；主控独立审查未发现 GameInstance 提交路径 blocker，并补充 Item 致败同 request replay 不重复扣除 / 记 Stats / 发事件的回归（U3 定向 7/7）。U1–U3 白名单 5 文件、153 项通过，TypeScript 与 diff 检查通过；进入 U4 战斗 Workspace 与失败结果 UI。

## 当前背景：上一轮源码调查基线

下表摘录 2026-10-16 的只读调查，帮助理解为什么要重做语义；它是阶段 A 的查找线索，不替代批准后对当前源码、样例和存档的重新核验。

| 当前实现基线 | 核验线索 | 对本 Task 的影响 |
|---|---|---|
| 一个 `OperationEvent` 代表整段任务，包含多个 `Location`；同一 `EventRun` 跨地点运行。 | `src/data-services/contracts/operation.ts`、`src/arona-clicker/services/operation-runtime-service.ts` | 不能把现有 Event 直接视为目标中的一次 Encounter。 |
| Datapack 顶层有 Event、Location、Action、学生 Profile、Strategy Profile、Card Pool 六类玩法 B 定义；Scene、Route、SceneAction、Objective / Outcome 等嵌在上层定义中。 | `src/data-services/contracts/operation.ts`、`src/data-services/contracts/datapack.ts`、[[docs/docs-829/03-data-structures/datapack-contracts]] | 调查必须覆盖顶层与嵌套定义，并逐项决定复用、重写或退役；不因旧分表存在而保留。 |
| 当前路线是在地点完成后提交 `Route` 推进；样例虽展示地图，也没有独立的自由地图移动状态。 | `src/arona-clicker/services/operation-runtime-service.ts`、`tests/engine/gameplay-b-route-sample.test.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts` | 目标必须让玩家在 Map 状态自主移动，并把地图位置与遭遇阶段分开。 |
| 角色候选行为是按权重生成的 Action ID 列表；倾向权重与候选后的自动计划优先级由不同路径处理。 | `src/arona-clicker/services/operation-card-candidate-resolver.ts`、`src/arona-clicker/services/operation-plan-preparation.ts` | 抽取倾向、自然行为、自动决策和玩家干预需要在行为合同中分别定义。 |
| 现有 Combat 干预修改角色行动/目标但不扣 PlayerCost；真实玩家牌组主要用于 Scene。 | `src/arona-clicker/services/operation-intervention-preview.ts`、`src/arona-clicker/services/operation-player-scene-deck.ts`、`tests/engine/operation-player-scene-deck.test.ts` | 玩家指令、Ability 与 Item 需要按目标规则核定实际入口和费用，不可把旧 UI 当作行为已具备。 |
| Strategy Park 展示地图的信息部分来自样例专用地图表，并行于 Operation 内容。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts`、`src/ui/components/operation-workspace.ts` | 新内容应有清楚的地图数据权威来源，避免继续维护相互复制的展示与运行定义。 |

详细调查及更多依赖见 [[archive/report-0285-gameplay-b-core-semantics-reduction]]。上述基线只解释现状，不限制最终可以复用、重写或退役哪些实现。

## 一、最终目标

本 Task 的目标不是继续完善现有 Operation 系统，也不只是增加一个简化编辑入口，而是**使 Gameplay B 的实际内容数据、玩家行为、Runtime 状态与作者工作流，最终服从一套最小且明确的玩法模型**。

最终 Gameplay B 必须能够通过以下循环运行：

```text
Map
 │
 ├─ Nodes
 └─ Edges
       │
       ↓
玩家选择相邻可通行 Node
       │
       ↓
进入当前 Node
       │
       ↓
Encounter（如果存在）
       │
       ├─ Participants
       ├─ Available Actions
       ├─ Encounter State
       └─ End Condition
       │
       ↓
Character Tendency
       │
       ↓
Draw finite Behavior Candidates
       ↓
Character Hand → Prepared Action + Target
       │
       ↓
玩家观察并决定
       │
       ├─ 接受当前准备行动
       ├─ 使用独立 Swap 在 Hand 内换牌
       ├─ 消耗 PlayerCost 指令手牌之外的合法行动
       ├─ 玩家主动 Ability
       └─ 使用 Item
       │
       ↓
Action Validation / Cost / Effect
       │
       ↓
Encounter State 改变
       │
       ├─ 未完成 → 继续行动
       │
       └─ 完成 → 记录结果
                    │
                    ↓
                 返回 Map
                    │
                    ↓
                 继续移动
```

目标是使一个简单关卡只需要作者理解：

**Map、Node、Edge、Encounter、Character/Tendency、Action、Condition、Effect，以及玩家可使用的资源。**

以上为语义关系，并不强制新增同名 TypeScript 类或独立服务。

### 1.1 最终结果必须满足

1. 一个简单线性地图可以独立运行，不需要将整段地图编写成现有 `OperationEvent → Location → Scene` 任务流程。
2. 普通 Node 不需要 Encounter；一个普通 Encounter 不需要显式 Scene/Phase。
3. 玩家在地图状态下自主选择可通行的相邻 Node，不需要每次先完成 Location Objective 才能提交 Route。
4. 角色按照自身 Tendency 从当前 Encounter 合法行动中加权、不放回地抽取有限候选，形成 Character Hand；玩家可观察手牌、Prepared Action 与目标。
5. 玩家可以使用与 PlayerCost 分离的独立 Swap 改变 Prepared Action；PlayerCost Command 用于突破自然手牌候选的有限控制。
6. 抽取、当前准备行动与未提交换牌在 Preview、View 刷新、UI 重开和存档恢复时保持稳定；只有正式 Commit 成功后才按规则进入下一轮。
7. Hand 候选、Prepared Action 与 Swap 草稿属于 Encounter-local，不得无理由跨遭遇继承。
8. 自动 Planner 不得替代玩家 Swap，也不得在玩家换牌后、正式 Commit 前覆盖选择。
9. Character 自主行为、Swap、PlayerCost Command、玩家技能及道具能够以各自合法的来源参与 Action/Effect 结算。
10. Encounter 结束后返回 Map，地图位置、节点状态与跨遭遇资源仍然正确。
11. Battle、Rest、Shop 与 Branch 不要求四套互不相干的核心引擎。
12. 普通作者不需要理解旧 Operation 的全部分层才能创建一张小地图。
13. 旧系统中没有必要的语义必须真正合并、退役或降为可选高级能力，而不是仅在 UI 上改名隐藏。
14. 不破坏必要的原子提交、权限校验、稳定 ID、确定性随机与存档正确性。
15. 最终实际 Datapack 内容可以按新目标从零编写；正常内容通路不要求保留旧 Gameplay B 专属条目或由旧条目作权威来源。
16. 每项运行状态都归属 Encounter-local、Map-run-local 或 Persistent PlayerState 中的唯一范围，且创建、继承、结算、写回与清理时机明确。
17. 在增加完整 Encounter 玩法前，已用真实 Datapack 经正常 Registry / Resolver / 游戏入口跑通 Map → Node → 简单 Encounter → 回 Map 的最小竖切片。

**最终成功标准是实际游戏与内容数据收敛，而不是增加一个新的简化包装层。**

---

## 二、最终目标模型与约束

### 2.1 Map 与 Encounter 的所有权

**Map 负责：**
- Node 和有向 Edge 的关系。
- 当前玩家位置。
- Edge 的可通行条件。
- Node 的已访问、已完成或当前状态。
- 必要的跨 Node 资源与进度。
- 当前地图结束时机。

**Encounter 负责：**
- 当前一次遭遇的参与者。
- 局部 Actor / Enemy 状态。
- 当前可用行为。
- 行为轮次与效果。
- 当前遭遇的完成、失败或退出条件。
- 本次遭遇产生的结果。

不得继续把“地图移动”和“遭遇阶段推进”视为同一件事。

建议的运行关系：

```text
MapRun
├─ currentNodeId
├─ nodeProgress
├─ map-local party / resources
└─ activeEncounterState?
```

这只是状态归属的示意，不要求实际创建 `MapRun` 与 `EncounterRun` 两个新的持久 Owner。

一个现有 Runtime Owner 可以继续承担这些状态，只要逻辑所有权正确且没有互相冲突的可写副本。

### 2.2 Node 的最小规则

第一阶段以一个 Node 至多关联一个当前可触发 Encounter 为基准。

Node 可没有 Encounter，直接用于起点、出口或普通移动。

推荐基准行为：

- Map 初始具有明确起点。
- 玩家沿 Edge 移动到相邻 Node。
- 未完成的 Node Encounter 在进入时触发。
- Encounter 进行时不能同时执行地图移动。
- Encounter 完成后，玩家返回地图并停留在该 Node。
- 默认已完成的 Encounter 不会在普通重访时重复触发。
- Node 重访只由实际存在且满足条件的 Edge 决定。
- 到达预设出口可以结束本次 Map Run。

重复遭遇、随机遭遇、多 Encounter、自由中断战斗以及复杂地图任务，不属于最小版本的必需能力。

这些基准规则已在阶段 B 经负责人确认并冻结，实施时以 [[draft-0287-gameplay-b-phase-b-contract]] 为准。

### 2.3 Encounter 的最小规则

Encounter 不以 `combat / scene / shop` 三套 Runtime 分类作为第一原则。

第一阶段优先通过：

```text
Participants
+
Available Actions
+
State
+
End Condition
```

表达行为差异。

例如：

- **Battle：**双方行动，HP 变化，敌方全部倒下后结束。
- **Rest：**友方产生休息、交流等行为，达到规定轮次后结束。
- **Shop：**玩家选择可用交换内容，支付费用并获得物品，允许离开。
- **Branch：**由 Map Edge 负责，不必包装为 Encounter。

不同场景可以有不同的交互节奏。**共享结算逻辑不代表购物必须抽角色卡，也不代表所有场景必须执行完整战斗轮次。**

### 2.4 Character Tendency 与 Behavior Card

玩法 B 最有区别性的核心机制是：

```text
当前 Encounter 的 Action 集合
             ∩
当前 Character 的合法 Action 集合
             ↓
合法性与可执行性过滤
             ↓
Character Tendency 加权、不放回抽取有限候选
             ↓
Character Hand（Encounter-local 候选集合）
             ↓
Prepared Action + Target
             ↓
接受 / 独立 Swap / PlayerCost Command
             ↓
Commit
```

必须保留以下区分：

- Tendency 决定各个合法行为进入 Character Hand 的相对概率。
- Hand 是有限的候选行为集合；每轮每名角色有明确且可观察的 Prepared Action 与 Target。
- Swap 是与 PlayerCost 分离的独立操作，必须保留为核心交互；具体采用候选内切换、次数、费用与合法性已在阶段 B 冻结。
- PlayerCost Command 是另一种操作，用于突破自然 Hand 对玩家可控行为的限制；可指定范围、费用与 Swap 槽关系已在阶段 B 冻结。
- 当前 Hand、Prepared Action 与未提交 Swap 草稿都属于 Encounter-local，不得无理由带入下一 Encounter。
- 本轮候选不得因为 View 刷新、重复 Preview、UI 重开或存档恢复而免费重新随机；只有正式 Commit 成功后才能依合同进入下一轮 Draw。
- 自动 Planner 不得替代玩家 Swap，也不得在玩家完成 Swap 后、正式 Commit 前覆盖该选择。
- 自动 Planner 不应替代角色倾向抽卡成为玩法核心。

第一阶段原则上不需要实体角色抽牌堆、弃牌堆、物理手牌实例和卡组构筑；Character Hand 是当前 Encounter 保存的候选行动快照。

但**Hand 张数、抽取时点、Prepared Action 如何确定、Swap 的具体形式/次数/费用/合法性、PlayerCost Command 的可指定范围与费用、非法操作的事务行为、敌方怎样准备行动**，必须形成明确的行为合同。

不得以“玩家免费从全部合法 Action 中任选”替代 Tendency + Hand，也不得以无法控制的自动执行替代玩家 Swap。

### 2.5 PlayerCost / Ability / Item

不同来源不需要使用完全相同的数据结构。

```text
Character behavior
Player command
Player ability
Item use
       │
       ↓
合法 Action Request
       │
       ↓
统一目标、费用和状态校验
       │
       ↓
原子结算 Effect
```

PlayerCost、Actor Cost、Team Cost、物品数量等可以分别管理。

共享的是合法性检查和结算保障，不强制统一持有、抽取、冷却、消耗和生命周期。

不得因为要支持玩家技能与物品，就新增一套万能 ActionSource/ItemCard/SkillCard 架构。

### 2.6 不得新增的核心复杂度

第一阶段不得以架构完整性为理由，引入以下必需结构：

- 每个 Encounter 都要显式创建 Scene。
- 每个 Character 都要建立 Profile + CardPool + StrategyProfile。
- 每个行为都需要独立 SceneAction 包装。
- Map 每次转移必须通过 Objective / Outcome / Route。
- 每种 Encounter 有自己的 Action/Effect Engine。
- 所有玩家技能、物品和角色行为强制共享完整 Card 生命周期。
- 为简单事件建立可编程任务树、万能脚本 DSL 或多级工作流。
- 为旧 Operation 另建一套长期并行运行的新 Operation/Encounter 体系。

高级能力可以保留，但不允许反向定义最小模型。

---

## 三、第一阶段必须实现的玩家行为

本 Task 的最低可运行产品，以一张纯线性地图为准：

```text
A：入口
    │
    ▼
B：废弃走廊
    │
    └─ Battle Encounter
       ├─ 一名友方 Character
       ├─ 一名 Enemy
       ├─ 至少两张实际抽出的 Character Hand 候选
       ├─ 一个可见的 Prepared Action 与 Target
       ├─ 一次独立 Swap，并提交后实际执行换后的行动
       ├─ 一次与 Swap 可区分的 PlayerCost Command
       └─ 战斗成功
    │
    ▼
C：出口
    │
    ▼
Map Run 完成
```

### 必须可观察的实际操作

玩家进入 A，点击前往 B，遭遇开始。角色按 Tendency 抽出多张有限候选，玩家能看到完整 Hand、当前准备行动及其目标。

玩家能够接受当前准备行动，使用独立 Swap 从当前 Hand 中换到另一合法候选并正式提交，或消耗 PlayerCost 使用合同允许的 Player Command。

提交后正确支付费用，敌人和角色根据行动产生状态变化。战斗持续至胜利或失败。

胜利后 Encounter 结束，玩家位于 B，而不是被旧 Route 系统自动推进至 C。

玩家随后主动点击移动至 C，地图关卡结束。

基准要求还包括：失败路径能够明确终止或返回符合已裁定的状态；无效 Action 不得扣费；重复提交不得重复造成伤害或奖励。

**这一个关卡是所有后续施工的最低验收基准。**

后续再扩展为：

```text
A → Battle → Rest → Shop → Exit
```

验证 HP、PlayerCost、物品及节点状态在不同 Encounter 间正确保留。

不为了这条扩展路线提前引入完整经济系统或卡牌构筑系统。

---

## 四、阶段 A：分派独立调查 Agent

**这是批准后必须执行的第一个阶段。在阶段 A 交付并通过审阅前，不允许分派正式迁移施工。**

主 AI 应分派一名专门的调查 Agent，以只读方式分析当前 Gameplay B 的数据定义、生产与运行链路、UI、样例、测试以及存档依赖。

若执行环境不支持子 Agent，主 AI 必须明确说明，并以独立的只读调查阶段完成同等交付，不得假称已经分派。

### A1. 调查内容

调查 Agent 必须核实以下关系：

```text
Datapack
    ↓
Registry / Resolver
    ↓
Operation Entry
    ↓
Event Definition
    ↓
Location / Scene / Action
    ↓
Runtime State
    ↓
Card Candidate / Planner
    ↓
Player Intervention
    ↓
Preview / Commit
    ↓
Resolution
    ↓
OperationView / UI
    ↓
Save / Resume
```

调查至少覆盖：

- `OperationEventContentDef`
- `OperationLocationDef`
- `OperationSceneDef`
- `OperationSceneActionDef`
- `OperationActionDef`
- `StudentOperationProfileDef`
- `OperationCardPoolDef`
- `OperationStrategyProfileDef`
- `Character Hand`
- `PlayerSceneDeck`
- `RouteEdge`
- `Objective / Outcome`
- `Actor / Team`
- `EventRun / OperationView`
- Entry、Registry、SaveData、样例与对应测试。

可复用 [[archive/report-0285-gameplay-b-core-semantics-reduction]] 的事实线索和 Read Set，但必须与当前源码重新核对，不能把旧报告当成当前源码的替代。

### A2. 对每个旧概念提交迁移判定

调查 Agent 必须给出：

| 必填调查项 | 要求 |
|---|---|
| 当前职责 | 实际解决什么问题 |
| 定义位置 | Schema、Contract 或内容来源 |
| 读写位置 | 谁读取、谁维护状态 |
| 目标语义 | 对应 Map、Node、Encounter、Action 等哪部分 |
| 是否仍必需 | 核心、内部、进阶、废弃候选 |
| 建议改造 | 复用、合并、拆分、迁移、删除 |
| 依赖与风险 | 哪些调用方、样例、存档受影响 |
| 验证方式 | 用什么测试证明改造正确 |

不能只写“可以隐藏在编辑器中”。需要明确：**旧数据结构是否仍是运行时的权威数据来源。**

### A3. 特别调查状态生命周期与重复所有权

必须逐项调查当前静态定义与运行状态的真实 Owner、创建/继承/写入/保存/重置位置，并评估目标模型中每项运行状态应归入 Encounter-local、Map-run-local 或 Persistent PlayerState。至少核对：

- 长期角色、永久资源、成长与奖励写回。
- 本次 Map Run 的当前位置、节点进度、跨 Encounter HP / PlayerCost、临时物品与地图进度。
- 当前 Encounter 的敌我局部状态、行为候选/目标、轮次与结算记录。
- Encounter 成功、失败、撤退、地图结束、保存与恢复时，哪些状态继承、结算、写回或清理。

同时必须确认改造后是否存在：

- Map 与 Location 各保存一份互相冲突的路径图。
- Node 与 Encounter 都决定下一地点。
- EventRun 与新 MapRun 各自维护同一玩家位置。
- Character Profile、CardPool、StrategyProfile 与新 Tendency 同时决定同一个行为权重。
- SceneAction 与 Action 维护两份不一致的行为效果。
- 新旧 Objective/Outcome 同时判定 Encounter 完成。
- 地图展示文件与 Datapack 重复保存节点文案或身份。

**同一事实只能有一个权威所有者，其余必须是引用、派生或明确标记的缓存。**

### A4. 调查 Agent 必须交付的数据迁移图

至少评估以下候选方向：

```text
旧体系                             目标语义

OperationEvent ────────────→ Map / Encounter
OperationLocation ─────────→ Node / Encounter
RouteEdge ─────────────────→ Edge
Scene ─────────────────────→ 默认内部阶段 / 高级 Phase
SceneAction ───────────────→ Action 的可用入口
StudentProfile ────────────→ Character 行为资格与 Tendency
CardPool ──────────────────→ 可用 Action 及候选权重
StrategyProfile ───────────→ Tendency 权重
ActionDef ─────────────────→ Action
Objective / Outcome ───────→ Condition / End Result
PurchaseOffer ─────────────→ 可用交换行为
EventRun ──────────────────→ Map / Encounter 局内状态
OperationView ─────────────→ 目标模型的只读投影
```

**此表不是预先批准的迁移方案。**

调查 Agent 必须说明哪些关系可以直接迁移，哪些需要拆分职责，哪些需要新行为，以及哪些旧结构可以直接复用而不改动。

例如 `OperationEvent` 既负责整段任务，又承载参与者和终局状态，不能机械地替换为一个 `Encounter`。

### A5. 调查 Agent 的最终报告

必须提交一份可执行的改造报告，包括：

1. 当前真实数据依赖图。
2. 最小目标语义与当前实现差异。
3. 旧对象到新语义的逐项迁移矩阵。
4. 必须新增或改变的玩家行为。
5. 可以复用且无需重建的 Runtime 机制。
6. 应退役的重复状态、对象与旧入口。
7. 现有样例、测试和 Save/Resume 的影响范围。
8. 推荐的最小施工顺序及每阶段可观察结果。
9. 当前仍无法确认的事实与需要负责人裁定的选择。
10. Encounter-local / Map-run-local / Persistent PlayerState 状态范围表：每项状态的唯一 Owner、创建与继承方式、写入者、跨阶段转换、写回时点、存档行为及清理时机。

报告必须以具体文件、字段、调用路径和测试为依据。

**阶段 A 的准入门槛：**完成只读报告并经负责人审阅、冻结关键设计取舍后，才允许施工。本 Task 已于 2026-10-17 满足该门槛，当前施工范围由 [[task-0288-gameplay-b-map-node-vertical-slice]] 管理。

### A6. Datapack 内容重建边界调查

阶段 A 必须单独盘点实际 Datapack 中 Gameplay B 内容的归属与重建范围：

- 列出当前参与 Gameplay B 的包、入口、文件及内容定义，并核实哪些是 Gameplay B 专属、哪些为跨玩法共享。
- 标记可整体废弃重写的 Gameplay B 记录；不把“发布过”或“已有数据”本身当作必须兼容的理由。
- 识别同文件或同包中的非 Gameplay B 内容、共享引用与资产，避免误删。
- 记录现有样例、编辑器入口、Registry / 校验和 SaveData 对这些内容的依赖。
- 给出从零创建最小可玩样例的内容清单，以及现有旧条目的删除 / 替换 / 保留建议。

阶段 A 只读，不执行删除、覆盖或批量迁移。

---

## 五、阶段 B：冻结最终行为合同与施工方案

**阶段 B 已于 2026-10-17 完成。** 本节保留阶段验收要求；实际冻结结果以 [[draft-0287-gameplay-b-phase-b-contract]] 为准，后续施工不得把已冻结规则重新当作开放选择。

阶段 B 要求基于调查事实形成最终的目标合同。

这一阶段不允许泛泛地写“重构为新的 Map/Encounter 架构”，必须明确：

### B1. 玩法行为合同

阶段 B 必须将以下六个环节作为彼此区分的规则逐项定义，不得用一个含糊的“角色干预”字段代替：

| 环节 | 合同必须回答的问题 |
|---|---|
| **Draw** | 哪些角色在何时抽取；Tendency 如何影响概率；从 Encounter 合法行动中抽几张；抽取是否不放回；候选不足时如何处理；随机上下文如何确定。 |
| **Hand** | Hand 对哪些角色可见；候选如何保存；是否只保存 Action ID 或还包含目标；它如何随 Encounter-local 状态创建、保存、恢复与清理。不得默认引入物理卡牌、抽牌堆或弃牌堆。 |
| **Prepared Action** | 每轮每名角色如何从 Hand 得到当前准备行动；其目标如何确定与展示；无玩家操作时由什么规则提交。 |
| **Swap** | 玩家如何改变 Prepared Action；必须裁定候选内切换、弃牌重抽或两者并存；冻结每角色或全队每轮的次数/有效覆盖槽、资源费用、目标选择和非法换牌行为。Swap 必须独立于 PlayerCost Command。 |
| **Player Command** | 如何支付 PlayerCost 并指定行动；是否允许选择 Hand 以外的合法行动、可选范围、次数与费用；与 Swap 是否共享覆盖槽或互斥；非法指令怎样原子拒绝。 |
| **Commit** | 提交时校验哪些快照/版本；如何一次性应用效果与费用；何时推进轮次和随机状态；何时生成下一轮 Hand；提交失败时哪些状态必须完全不变。 |

同时冻结：

- 地图移动、进入 Encounter 和返回地图的顺序。
- 一次 Encounter 的开始、运行、成功、失败及退出规则。
- Draw、Hand、Prepared Action、Swap、Player Command、Commit 与下一轮刷新规则。
- PlayerCost 指令的合法性、费用和作用范围，并与普通 Swap 分开说明。
- 玩家 Ability / Item 的最小实际交互方式。
- 跨 Encounter HP、Cost、物品与节点进度的状态保留方式。
- 一次地图关卡如何结束与结算。

以下已经是负责人确认的产品约束，不再作为阶段 B 可删减选项：保留多张有限候选组成的 Character Hand；保留独立 Swap；候选、Prepared Action 与换牌草稿不因预览/UI 生命周期改变而免费重抽；PlayerCost Command 与 Swap 语义不同；自动 Planner 不得覆盖玩家已作出的换牌。

负责人于 2026-10-17 批准并冻结本子合同的具体值：

- 每轮每名角色最多抽 3 张互不重复的合法行动候选；按 Tendency 加权且不放回。合法候选少于 3 张时少抽，不为凑数重抽。
- 默认 Prepared Action 是该角色本轮 Hand 中第一张抽到的候选；其默认合法目标与结果可观察。
- 每轮全队共用一个有效手动覆盖槽。Swap 只从当前 Hand 选另一候选，不弃牌、不补牌、不重抽，免费，不扣 PlayerCost；未提交草稿可修改或清除，正式 Commit 至多结算一个覆盖选择。
- PlayerCost Command 只选该角色当前 Encounter 合法范围内、但不在本轮 Hand 的行动；每条费用为 1 PlayerCost，与 Swap 共用同一覆盖槽，不得在同一轮叠加。
- 只有成功 Commit 后才推进本 Encounter 的下一轮并生成下一轮 Hand；预览、重绘、UI 重开、拒绝命令和失败提交均不得重新抽取或改变费用/结算状态。

Hand / Swap / Player Command 与 Map、Encounter 状态写回、Ability / Item、旧内容及存档处置合同均已在阶段 B 完成冻结；具体默认值见 [[draft-0287-gameplay-b-phase-b-contract]]。

未裁定的选项不得被施工 Agent 自行填成高级框架。

### B2. 目标数据合同

要求定义每个语义对象的：

- 作用与所有者。
- 静态 Definition 与运行 State 的边界。
- 必要引用与最小字段。
- 允许省略的可选字段。
- 与现有 AC Character / PlayerState / Datapack 的关系。
- 迁移和兼容边界。

并且必须逐项为所有有运行时状态的数据标明唯一生命周期范围：

| 状态范围 | 生命周期与典型内容 | 写回原则 |
|---|---|---|
| **Encounter-local** | 当前敌方 HP、每名角色的 Character Hand / 候选、Prepared Action 与目标、未提交 Swap / Player Command 草稿、轮次、临时遭遇标记及结算历史。 | 遭遇创建时初始化；在本次 Encounter 内更新；遭遇结束后按结算合同提取结果，再清理或归档；不得自动带入下一遭遇。 |
| **Map-run-local** | 当前 Node、节点访问/完成状态、跨遭遇 HP、剩余 PlayerCost、临时持有物与本次地图进度。 | Map Run 开始时创建或从明确起点状态继承；遭遇之间保留；Map Run 结束时按规则结算、写回明确奖励或整体清理。 |
| **Persistent PlayerState** | 已拥有角色、长期成长、永久资源和明确授予的长期物品/奖励。 | 仅由明确的持久化奖励/成长结算写入；不得因临时遭遇或地图持有状态而隐式修改。 |

对每一项状态还必须写明：创建时机、继承来源、允许的写入者、跨 Encounter 传递方式、成功/失败/撤退时的结算、写回时点、存档行为及清理时机。若状态在作用域之间转换，必须通过明确的结算或授予步骤转换，不能让同一个字段同时代表两个作用域。

例如：角色在 B 节点遭遇中花费 2 点 PlayerCost，进入 C 节点休息时，本次 Map Run 的剩余 PlayerCost 仍应体现这笔消耗；敌人本轮准备行为和 Character Hand 属于 Encounter-local，不应带到 C 的下一场遭遇。Map Run 中取得的临时通行证属于 Map-run-local，除非明确结算为永久奖励，不得自动进入长期 PlayerState 背包。

角色的候选 Hand、当前 Prepared Action / Target，以及尚未正式提交的 Swap 或 Player Command 草稿也必须归 Encounter-local；View 重建、Preview、UI 关闭重开和 Save / Resume 不得触发新抽取或丢失已确认的准备行动。成功 Commit 后，才依本合同为同一 Encounter 的下一轮生成新 Hand；Encounter 结束即清理这些局部状态。

**禁止以同一字段、双向同步副本或两个可写 Owner 在不同作用域重复维护互相冲突的权威状态。**Runtime Owner 可以与上述生命周期范围一一对应，也可以不对应；合同规定的是状态语义与写回时机，不强制创建三个 Owner。

此时才允许确定具体 Schema，但应以**最小可表达数据**为基础。

### B3. 旧结构处置合同

每一个现有主要结构必须被明确归为：

- **Reuse：**原样复用必要能力。
- **Transform：**将职责或数据迁入目标结构。
- **Internal：**继续作为内部实现，不再承担独立作者语义。
- **Advanced：**保留给明确的高级功能，但不阻塞最小关卡。
- **Retire：**迁移完成后退役其独立入口、权威数据或实现。

不可将全部旧对象无条件归入 `Advanced`，以此永久保留当前复杂体系。

也不得未经验证直接删除仍被旧内容、存档、调用方引用的结构。

**本阶段的通过条件是最终状态、迁移路径与退役边界明确，而不是完成某一份宏大架构说明。**

### B4. 实际内容与 Datapack 处置合同

- 明确哪些既有 Gameplay B 条目直接废弃、哪些可复用、哪些需要重写；不得把“尽量迁移所有旧内容”设为默认目标。
- 明确新 Datapack 内容从零开始的最小可玩清单，以及它怎样通过正常 Registry / Resolver / 游戏入口加载。
- 明确同包共享内容和非 Gameplay B 内容的保留边界。
- 明确旧 Gameplay B 内容不再被读取为权威来源的时点与退役证据。
- 明确 Save / Resume 与旧 Run 的兼容、失效或重置策略。数据包玩法内容允许抛弃，但存档策略不可留给施工者自行猜测。

阶段 B 对具体删除清单和运行版本边界作出裁定；此项不要求负责人再次裁定“能否丢弃旧 Gameplay B 专属内容”，该权限已由本 Task 目标明确给出。

---

## 六、阶段 C：分派施工任务

仅在阶段 B 获得批准后，主 AI 才可以建立并分派独立施工 Task。

施工顺序建议如下，最终以调查结果和真实依赖为准。

### C1. Map / Node / Edge 最小移动

交付：

- 地图定义及合法相邻移动。
- 当前 Node 与 Map 状态。
- 普通 Node / 出口 Node。
- 不依赖 Location Completion 的移动。
- 基础 Map View。

验收：A→B→C 可以手动逐节点移动，不能跳到不存在的节点或穿越被阻断的 Edge。

### C1a. 最小 Datapack → Runtime 端到端骨架

紧接 C1、在扩展 Encounter 规则和行为系统前，建立一条极薄但真实的内容链路。其目的不是提前实现战斗，而是尽早证明目标语义可以由正常作者数据入口驱动 Runtime，避免 C1～C4 都只靠直接构造的测试对象，直到 C5 才发现内容模型无法落地。

交付：

- 一个最小 Gameplay B Datapack，至少声明 Map、Node、Edge 及一个挂接在 B Node 的最简单 Encounter。
- 通过普通 Datapack / Spot 入口明确引用 Map ID；接入正式 Registry / Resolver、游戏入口与 Map View；不得将新 Map 暗中包装成旧 `OperationEvent`，不得建立 demo-only loader，也不得以测试夹具直造目标 Runtime 对象替代内容加载。
- 玩家从 Map A 移动至 B，B 触发简单 Encounter；通过一个最小的合法完成动作/条件结束遭遇并返回 Map B。
- Map View 显示当前 Node 与可移动的相邻 Node；非相邻节点或被拒绝的移动不能改变 MapRun 状态。
- Encounter 进行期间 UI 显示地图移动锁定，Runtime 也拒绝地图移动命令；回图后玩家仍位于 B，继续移动至 C 仍由玩家主动选择。
- 玩家在正常游戏入口可观察到当前位置、节点移动、遭遇触发、移动锁定、结果和回图；验收不是只看 Resolver 返回或 Engine 单元测试。

本切片暂不要求 Battle、Enemy、角色抽卡、Tendency、PlayerCost、Ability、Item 或完整费用/效果系统；结束 Encounter 的最简行为只用于验证内容与 Runtime 连通，后续可由真实规则替换。

验收：从正常 Datapack 入口加载并运行 **Datapack → Registry / Resolver → Map A → Move B → Encounter → End → Return to Map B**；没有旧 `OperationEvent / Location / Scene` 被隐藏地强制作为新内容的作者前置。该骨架的独立施工合同与验收记录见 [[task-0288-gameplay-b-map-node-vertical-slice]]，不得推迟到 C5。

### C2. Encounter 进入、生命周期与回图

交付：

- Node 触发 Encounter。
- Encounter 活动标记、地图锁定和成功回图状态归属明确；在 C3 / C4 有真实局内可变数据前不预建空 HP / Hand / Action 对象。
- Encounter 运行期间地图移动锁定。
- 遭遇完成后返回当前 Node。
- Node 清除与重访规则。
- 根据 Map 定义准入固定队伍与初始 PlayerCost；队伍身份、实际 Variant 身份和余额属于唯一 MapRun Owner，准入只读 PlayerState。
- Save / Resume 往返恢复上述 MapRun 状态，不覆盖已消耗的 PlayerCost。
- Map 到出口成功时清理 Party、PlayerCost、位置与进度等 MapRun-local 状态；若当前 Workspace 仍要展示结果，只保留不可继续、不可恢复的最小只读结果。
- 每项已实现运行时数据标明 Encounter-local、MapRun-local 或 Persistent PlayerState 生命周期，且创建、继承、写回与清理时点符合阶段 B 合同。

验收：一次遭遇成功后 Map 仍位于原 Node，重复进入不重开；B 节点至 C 节点期间 Party 与已结算的 PlayerCost 保持一致；合法活动 Run 保存恢复后状态一致；Map 成功终止不再把完整临时 Run 留在可操作 Owner 中。

失败合同已冻结：固定队伍全员 HP 归零时终止当前 MapRun，不发成功奖励、不提供撤退或当前 Run 重试；清除临时 MapRun 状态并保留只读失败结果页，直到玩家手动返回游戏。玩家之后可从 Spot 新开完整 MapRun。C2 只处理 HP 尚不存在时的 MapRun 与成功终态；HP 触发、失败结果查询 / UI 与失败后的新 Run 入口在 C4 有真实 HP 状态后实现，不得增加手动失败按钮。

### C3. Character 行为抽取与玩家干预

交付：

- **Draw：**每轮仅按阶段 B 规定的时点，对当前 Encounter 中仍合法的角色 Action 候选做 Tendency 加权抽取；优先复用现有加权、不放回候选生成机制。抽牌只由正式进入 Encounter / 成功 Commit 推进，不由 View、Preview 或 UI 生命周期触发。
- **Hand：**保存本轮抽出的有限候选集合，并投影给玩家查看；不为换牌新建实体卡堆、弃牌堆或物理卡实例。
- **Prepared Action：**明确保存每个角色当前准备行动及目标，并向玩家展示。无玩家操作时按冻结的默认规则保留并提交。
- **Swap：**实现阶段 B 已冻结的独立换牌规则；验证候选范围、次数、费用与目标。成功换牌后保持玩家选择直至 Commit，不得被自动 Planner 覆盖。
- **Player Command：**实现独立的 PlayerCost 指令范围、成本和校验；结果与 Swap 的费用和可指定行为范围可明确区分。
- **Commit：**重验当前版本、整队准备行动、目标和费用，按固定队伍顺序原子执行一轮；Swap / Command 只替换一名角色的准备行动。只有成功提交才清理旧轮草稿、推进轮次并生成下一轮 Hand。C3 建立唯一 MapRun 提交管线及最小真实资源效果，不留空 Commit。全员 Wait 可提交无效果轮次，但仍只在成功 Commit 后 Draw。

验收：不同倾向影响候选概率；角色不能执行非法行为；无效干预不扣 Cost；玩家不能通过反复刷新 UI 免费重抽。

**C3 独立验收必须逐项观察：**

1. 角色从合法候选中抽出多张不同 Action，Tendency 权重影响抽取概率，候选数不足时按冻结规则处理。
2. 玩家能看见完整 Hand、当前 Prepared Action 和 Target。
3. 玩家对 Hand 内另一合法候选执行 Swap；Commit 后结算的是换后的 Action / Target，而不是原准备行动。
4. 不在 Hand、已禁用、无合法目标或资源不可支付的 Swap 被拒绝；拒绝前后 Run 状态、Hand、准备行动、随机状态、费用和结算历史不变。Actor / Team 资源余额由 Map 显式初始化，不能从 PlayerState 或旧 EventRun 隐式取得。
5. PlayerCost Command 与普通 Swap 产生可区分的成本和结果，并按冻结范围验证手牌外行动。
6. 重复 Preview、重绘 View、关闭并重开 UI、存档恢复都不会重新抽牌，也不会丢失当前准备行动或有效换牌草稿。
7. 换牌完成后到正式 Commit 之前，自动 Planner 不会覆盖玩家选择；Commit 成功后才按合同推进并抽取下一轮候选。
8. Swap 与 PlayerCost Command 的每轮次数/共享槽行为符合冻结合同；同一回合的非法或过期请求不消耗次数、不扣费用。
9. 至少两个队员的整轮 Commit 真实结算所选 Action / Target 与一项可观察 Actor / Team resource 效果；费用、效果、轮次、历史与下一轮 Hand 原子一致。

### C4. HP、Enemy、Ability / Item 与结算扩展

交付：

- 在 C3 建立的同一 MapRun 版本化 Commit / Action / Effect 管线上扩展 Character / Enemy HP 状态；不得另建一套 Combat Commit。
- Player Ability 与 Item 按已冻结合同接入。
- 不同费用账户分别校验。
- 原子提交，失败无部分写入。
- 正确的目标、资源、状态与结果投影。
- 为固定队伍建立明确的 MapRun-local HP 起始值与上限来源；不从 PlayerState 长期养成 HP 隐式导入。若现有内容不能提供该来源，先补充最小、可校验的作者定义，再实现失败判定。
- 每次成功提交可能改变队伍 HP 的原子转移后（角色 Action、敌方 Action、Ability、Item 或遭遇效果），检查固定队伍 HP；全员 HP 为 0 时终止当前 MapRun、清除运行状态、不发成功奖励，并生成只读失败结果。单个角色倒下不触发失败。
- 若进入 Encounter 时固定队伍 HP 已全为 0，必须在允许任何行动前结束 MapRun；不能留下没有可行动角色的可继续遭遇。
- 失败结果页停留在当前 `map:runId` Workspace 直到手动返回游戏；当前失败 Run 不可继续 / 重试，但普通 Spot 入口之后允许创建新的完整 MapRun。

验收：玩家指令、能力和道具可通过各自合法入口实际生效，而不是只有 UI 占位；任一 HP 改变来源都能触发同一败北检查。部分角色 HP 归零仍可继续，全队 HP 归零则恰好终止当前 MapRun 并显示失败结果，PlayerState 不回滚且不发成功奖励；手动返回后能从 Spot 创建全新 Run，且不继承失败 Run 的 MapRun-local 状态。

### C5. 内容迁移与旧语义退役

交付：

- 完善 C1a 的实际 Datapack 样例，使其覆盖阶段 B 已冻结的完整最小玩法；再按计划重建 Rest、Shop、条件路径等其余定向样例。
- 接收 C4 未覆盖的阶段 D2 内容验收：Battle 由 C4 验证；Rest 必须验证行为轮次、资源恢复与回图；Shop 必须验证资源交换、余额不足拒绝与不重复支付；Branch 必须由 Edge 表达并验证。
- 为新 Map / Encounter / Map-local Action 提供清楚、受支持的内容编辑入口；遵守根 `AGENTS.md` 禁改生成 Schema 的边界，优先使用维护中的 Editor 源 Schema，不得手改或生成覆盖 `engine-defs.gen.json`。
- 旧数据引用关系按阶段 B 方案处理。
- 对阶段 B 列为 `Retire` 的旧 Gameplay B 专属条目执行删除或替换，不要求逐条迁移；需要复用的共享定义按清单保留。
- 必要的非 Gameplay B 共享样例与数据受控保留。
- 重复权威来源、废弃路径按已批准清单移除。
- 存档兼容或明确版本失效处理。

验收：最终正常内容通路不再要求作者提供已退役的旧分层数据；真实新内容能够独立加载、进入并跑通最小地图，旧 Gameplay B 条目不再作为其权威来源；Battle、Rest、Shop 与 Edge Branch 的阶段 D2 验收都有各自结果记录。

**施工 Agent 不得把“新增适配器使旧系统勉强支持新语义”作为默认最终交付。适配器可以是迁移阶段手段，但最终必须达到阶段 B 定义的收敛状态。**

本阶段允许删除旧 Gameplay B 专属内容定义及其失效入口，以新 Datapack 内容替代；删除范围以阶段 B 清单为准。施工不应仅将新 UI 包装在旧 Gameplay B 数据上，最终样例必须真正由新内容定义驱动。

---

## 七、阶段 D：独立验收 Agent

调查 Agent、施工 Agent 和最终验收职责必须明确分离。

施工 Agent 可以执行定向自测，但最终验收应交给另一名负责检查结果的 Agent，或由主 AI 在独立验收阶段执行。

验收不能只依赖施工 Agent 的完成声明。

### D1. 最小玩家闭环

必须实际运行：

```text
Map A
 ↓
Move B
 ↓
Enter Encounter
 ↓
Character Draw
 ↓
Player Intervention
 ↓
Action + Cost + Effect
 ↓
Victory
 ↓
Return to Map B
 ↓
Move C
 ↓
Map Complete
```

检查每一步的可见状态及其变化。

### D2. 三种 Encounter 验收

**Battle：**角色抽卡、敌方行动、Cost 指令、HP 变化、胜利/失败。

**Rest：**角色行为及轮次结算、资源恢复、完成后回图。

**Shop：**资源交换、余额不足拒绝、不重复支付、不要求运行战斗专属规则。

并验证 Branch 由 Edge 表达，而不是另起任务分支系统。

### D3. 状态与事务验收

至少检查：

- 不可达 Node 不能被移动命令直接进入。
- Encounter 进行时不能未经允许移动。
- Action 不合法时不发生费用或效果变化。
- 重复命令不会重复支付或重复发奖。
- 同一 Run 的过期计划不能提交。
- RNG 与存档恢复后行为一致。
- Character Hand 在 Encounter 内按冻结规则生成；Preview、View 重建、UI 重开和 Save / Resume 不改变候选、Prepared Action 或有效 Swap 草稿。
- 合法 Swap 能改变 Prepared Action，正式 Commit 后实际执行换牌结果；非法 Swap 不改变 Run、随机游标、费用或结算历史。
- PlayerCost Command 与普通 Swap 的可指定范围、费用与结算结果符合合同，且在运行结果中可以区分。
- 玩家完成 Swap 后至 Commit 前，自动 Planner 不覆盖 Prepared Action 或 Target。
- 下一轮 Draw 只发生在正式 Commit 成功之后；每个 Encounter 结束后清理 Character Hand、Prepared Action 与 Swap 草稿。
- 已完成遭遇默认不被重复刷取。
- 跨 Encounter 的 HP、Cost、物品与节点状态符合合同。
- B 节点遭遇中消耗的 PlayerCost 进入 C 节点后仍保持已消耗；Enemy 准备行为、目标和 Character Hand 不跨遭遇残留。
- Map Run 内取得的临时通行证不会自动写入 Persistent PlayerState；只有明确授予并结算的长期奖励才写回。
- Map Run 成功、失败、撤退、存档恢复和清理时，各作用域状态按 B2 合同创建、继承、结算、写回或清除，不发生双重权威或遗漏清理。
- 失败和中断不产生不一致的部分状态。

### D4. 旧架构收敛验收

调查 Agent 的迁移矩阵应再次逐项审计：

```text
旧概念
  ↓
现在由谁负责？
  ↓
是否还存在第二个权威来源？
  ↓
作者是否仍被迫配置它？
  ↓
旧入口是否已经迁移或明确退役？
  ↓
相应测试是否覆盖？
```

不得出现：

- 新旧地图长期各自维护独立位置。
- 新旧行为倾向同时决定同一角色动作。
- 新 Encounter 外套完整旧 Operation 任务编排作为不可省略前置。
- UI 展示新语义，但真实命令仍然执行不同的旧语义。
- 旧接口无限期保留而没有明确实际用途和去向。

### D5. 作者侧最小内容验收

交给不依赖旧 Operation 术语的内容作者一份空白玩法 B 内容入口，确认其只需按照以下概念就能创建最小关卡：

```text
Map
  ├─ A：入口
  ├─ B：遭遇
  └─ C：出口

Encounter B
  ├─ Character
  ├─ Enemy
  ├─ Available Actions
  └─ End Condition

Character
  └─ Tendency

Action
  └─ Effect
```

不得要求作者先手工创建无实际玩法意义的 Scene、StrategyProfile、CardPool、Objective、Outcome、Team 或多层任务包装。

必要的技术定义可由内部规则生成，也可以合理复用既有数据；不必为了美观新建同名类。

作者侧验收还必须检查并运行一份真实 Datapack 样例：它应按新语义从零编写，经正常内容加载路径启动，并且不暗中依赖已列为退役的旧 Gameplay B 定义。只在空白编辑入口上演示、实际样例仍由旧内容驱动，不算通过。

---

## 八、工作分派与总控规则

主 AI 是本 Task 的唯一总控者，负责裁定依赖、接收调查结果、建立施工任务与最终验收，不得把整个任务直接交给单一施工 Agent 自行决定所有架构。

执行顺序为：

```text
总控 Task
    │
    ▼
调查 Agent（只读）
    │
    ▼
调查报告 / 迁移矩阵
    │
    ▼
负责人确认关键裁定
    │
    ▼
冻结目标行为与数据合同
    │
    ▼
独立施工 Task
    │
    ├─ Map
    ├─ Datapack → Runtime 竖切片
    ├─ Encounter
    ├─ Behavior
    ├─ Action / Cost / Effect
    └─ Migration / Retirement
    │
    ▼
独立验收 Agent
    │
    ▼
问题修复 / 复验
    │
    ▼
最终收敛报告
```

### 执行约束

1. 每一个施工 Task 必须有独立 Read Set、Write Set、依赖、非目标和验收测试。
2. 不得在调查阶段修改 Runtime 或 Schema。
3. 不得在尚未确认目标数据所有权时批量迁移内容。
4. 每完成一个施工阶段必须留下可运行、可测试的状态；不得长期保留两个互相冲突的可写 Runtime。
5. 新增概念必须对应玩家体验、必要的数据所有权或 Runtime 正确性要求。
6. 不能因某种高级玩法“未来可能需要”而扩充当前最小模型。
7. 允许为兼容旧内容建立临时迁移路径，但必须明确最终退役条件。
8. 不以代码行数或类数量作为简单性的唯一衡量；以核心语义数量、作者必要配置、运行职责和重复数据所有权判断。
9. 调查与施工发现目标合同存在实质性冲突时，暂停相关施工并提交裁定，不允许 Agent 自行追加更复杂的框架来回避冲突。
10. 不得把某个子任务通过测试当作整体玩法 B 已经完成。

---

## 九、最终交付物

总控 Task 最终完成时必须提供：

1. **目标语义与行为合同**：最终实际采用的 Map、Encounter、Character、Action、Cost 等规则。
2. **数据迁移对照表**：每项旧数据结构对应的新位置、保留理由或退役结果。
3. **源码变更清单**：新旧内容定义、Resolver、Runtime、View、UI、Save/Resume 实际修改情况。
4. **完整可玩样例**：至少三节点线性战斗关卡，以及 Rest、Shop 和条件路径的定向样例。
5. **自动化测试结果**：Engine、UI、Datapack 校验、存档及必要回归测试。
6. **作者最小内容示例**：展示不依赖旧 Operation 分层即可创作和加载的内容。
7. **退役清单**：已移除的结构、保留为高级能力的结构、仍存在的过渡适配器及其退出条件。
8. **最终验收报告**：由独立验收阶段出具，逐条说明是否满足目标及尚未解决的问题。

任务状态只有在完整产品闭环和对应数据收敛验收通过后，才能标为 `completed`。

---

## 十、明确非目标

本 Task 不要求：

- 开发通用 RPG/任务树/剧情脚本引擎。
- 一次支持无限开放地图、随机地图或复杂地形。
- 实现多 Encounter、多 Phase、复杂场景嵌套。
- 重新开发 AC 的全部 Character、Item、Resource 系统。
- 强制 Player Ability、Item、Character Card 使用同一种物理卡。
- 一次完成复杂 Party Change、Combination、玩家卡组构筑、完整 Shop Economy 和通用 Reward Pool。
- 因语义收敛就删除现有必要的 Preview/Commit、Registry、稳定 ID、Save/Resume 和原子事务保障。
- 本 Task 不要求继续兼容或逐条迁移既有 Gameplay B 专属 Datapack 内容；阶段 C 可按阶段 B 清单将其抛弃并从零重写。
- 不在已核实边界外删除非 Gameplay B 共享内容，也不未经明确的存档处置方案就破坏长期 PlayerState 或静默丢弃 Run 存档。
- 以保留当前 Operation 全部架构为前提，为其继续添加新的包装对象。

## 最终判定原则

本 Task 最终必须回答的不是：

> “当前 Operation 能不能支持新 Map/Encounter？”

而是：

> **“玩家实际玩到的是否已经是 Map → Node → Encounter → Character Behavior → Player Intervention → Effect → Map，作者是否能够直接使用这套简单语义，且旧 Operation 的不必要复杂结构已经不再决定它？”**

只有这三个条件同时成立，才视为 Gameplay B 的核心语义收敛完成：

**玩家体验正确、内容表达简单、运行数据所有权清楚。**
