# Draft：Gameplay B 阶段 B — 最终行为、数据与内容合同

状态：approved / frozen — 负责人于 2026-10-17 批准阶段 B 全部行为、数据、内容和存档默认值。本文是后续 C 阶段施工的冻结合同；具体施工仍须按 [[task-0287-gameplay-b-semantic-convergence-and-minimal-loop]] 拆分任务和 Patch Unit。

本文是 [[task-0287-gameplay-b-semantic-convergence-and-minimal-loop]] 的阶段 B 最终合同。它记录已冻结的 Character Hand / Swap 行为，以及负责人后来批准的 Map / Encounter / 状态 / 内容 / Save-Resume 默认值。

## 已确定的产品约束

以下不是可删减选项：

1. 角色按照 Tendency，从当前 Encounter 对该角色开放且当前合法的行动中抽取**多张有限候选**，组成 Character Hand。
2. 每轮都有明确的 Prepared Action 和 Target；玩家可以看见完整 Hand、当前准备行动和目标。
3. 玩家有独立 Swap 操作来改变 Prepared Action。Swap 与 PlayerCost Command 是两种不同规则。
4. PlayerCost Command 用来突破自然 Hand 的有限候选范围；其可指定范围和费用要由阶段 B 明确。
5. 重复 View、Preview、UI 关闭/重开与存档恢复不能免费重新抽取。成功 Commit 后，才依合同生成下一轮候选。
6. Hand、Prepared Action、目标、Swap 草稿和 Player Command 草稿都是 Encounter-local，不会无理由带到下一次 Encounter。
7. 优先复用当前的 Tendency/加权不放回候选生成、合法目标预检、原子 Commit 和 Save/Resume 校验；不为 Swap 新建物理卡牌、抽牌堆、弃牌堆或一般卡组构筑体系。
8. 自动 Planner 不得代替玩家 Swap，也不得在已确认的 Swap 之后、Commit 之前覆盖玩家选择。

## 当前实现中可复用的部分

- `resolveOperationCharacterHand()` 已按合法候选做加权、不放回抽取；未显式指定张数时默认 3 张，内容字段可把张数设在 1–10。候选不足时 Hand 少于目标张数。见 `src/arona-clicker/services/operation-card-candidate-resolver.ts` 与 `src/data-services/contracts/operation.ts` 的 `characterHandSize`。
- `EventRun.characterHands` 已保存 Action ID 和诊断信息；Run 开始、成功提交后重算。抽取使用稳定的确定性上下文；纯 View/Preview 与 intervention revise 不推进随机游标。相关实现位于 `src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/operation-intervention-preview.ts`。
- 当前 `OperationInterventionDraft` 可以将一名学生的准备行动改成其当前 Hand 内的另一个 Action，并校验 Action、目标和 Actor/Team 支付能力；它不是抽牌，也不消费 PlayerCost。它只有一个全局学生草稿槽，切换其它角色前需清除已有草稿。
- 当前 View 同时投影 `characterHand`、准备计划和干预草稿；Operation Workspace 已有自动计划与可替换行动托盘，Controller 可清除或更新干预。相关入口为 `src/arona-clicker/services/operation-view-projector.ts`、`src/ui/components/operation-workspace.ts`、`src/ui/controller-actions-operation.ts`。现有 UI 不展示候选权重，是否要展示权重仍不是核心合同要求。
- 当前 Save/Resume checkpoint 保存 Hand、PreparedBeat、干预草稿和随机状态，恢复时重新计算并校验；Commit 采用 detached Run 和原子替换，提交重试不会重复结算。对应测试见 `tests/engine/operation-runtime-service.test.ts` 与 `tests/engine/gameplay-b-save-resume.test.ts`。
- 当前没有战斗中的 PlayerCost Command，也没有 Hand 外行动指令。PlayerCost 现用于 SceneAction、玩家 Scene Card 和购买；它不能自动视为 Combat 指令。
- 当前候选切换与自动准备行动已有 Engine / UI 测试覆盖，但 PlayerCost Combat Command 没有对应入口；C3 需要为这条新行为增加独立的 Engine 与 UI 验收，Scene 批次相关测试不能代替。

这些是代码现况，不表示必须保留旧 Operation 的外层结构或旧数据包内容。阶段 B 仍须验证目标模型如何复用它们。

## 已冻结的 Hand / Swap / Player Command / Commit 子合同

| 环节 | 建议规则 | 状态 |
|---|---|---|
| **Draw** | 每次 Encounter 开始时，以及本轮成功 Commit 后，为每名仍在场且可行动的友方角色抽取最多 **3 张互不重复**的合法 Action。按 Tendency 加权且不放回。合法候选少于 3 张时全部进入 Hand，不重抽；没有合法候选时显示明确的 Wait / 无可行动作状态，不进行随机重试。 | 负责人已冻结：最多 3 张；候选不足少抽且不重抽。 |
| **Hand** | Hand 只存 Encounter-local 的候选 Action 身份及本轮抽取依据；它不是实体牌区。当前轮的 Hand 在整个准备、预览和提交流程中保持不变；只有 Commit 成功后才生成下一轮 Hand。 | 负责人已冻结核心与生命周期要求。 |
| **Prepared Action** | 每名角色默认以本轮 Hand 中第一张抽到的 Action 作为自然准备行动；Target 由该 Action 的合法目标规则确定并展示。自动 Planner 可以补足合法目标或无玩家输入时的提交计划，但不能重新选择 Hand 外行动。 | 负责人已冻结首张候选作为默认准备行动。 |
| **Swap** | 只允许选择某名角色当前 Hand 中另一张 Action；不弃牌、不补牌、不抽新候选。每轮全队只有一个有效的手动覆盖槽：本轮可在 Swap 与 PlayerCost Command 中择一。Swap 免费，不扣 PlayerCost；草稿未 Commit 前可以修改或清除，但最终只提交一个覆盖结果。行动和目标必须重新通过当前 Encounter 合法性、资源与目标检查；非法 Swap 不改变 Run、Prepared Action、费用、随机状态或结算历史。 | 负责人已冻结：候选内切换、每队每轮一个共享覆盖槽、免费。 |
| **Player Command** | 每轮全队最多一条，和 Swap 共用同一覆盖槽。只能指定某名角色当前 Encounter 合法行动范围内、但不在本轮 Hand 中的 Action；每条花费 **1 PlayerCost**。费用随 Map Run 保留，并在与 Action 效果同一 Commit 中原子扣除。不能支付、行动非法或目标非法时整条指令失败且不扣费。 | 负责人已冻结：Hand 外行动、每队每轮共享覆盖槽、每条 1 PlayerCost。 |
| **Commit** | Commit 使用当前 Run / Encounter 版本和已确认的 Prepared Action、Target、Swap 或 Command。提交时再次校验合法性与可支付性；一次性结算费用、Action/Effect、结果和随机状态。只有整笔提交成功，才推进 Encounter round 并生成下一轮 Hand / Prepared Action；失败时所有状态原样保留。 | 负责人已冻结“成功 Commit 后才刷新”；与总体 Map / Encounter 提交规则一并实施。 |

### 选择以上建议的原因

- “Hand 内选牌”直接复用当前 Intervention 规则，不为换牌引进第二套抽牌系统。
- 一次免费候选内 Swap 让玩家能调整本轮自然行为，同时仍受 Tendency 产出的有限 Hand 约束。
- PlayerCost 只用于超出 Hand 的额外控制，玩家能明确理解“免费在候选中改选”与“花资源强制指定”的差别。
- 每队每轮一个 override 槽，复用当前只有一个 `InterventionDraft` 的状态形状；同一轮不会同时叠加免费 Swap 和 PlayerCost Command。
- 3 张沿用现有候选生成器的默认值；若合法行动不足 3 个，手牌缩小而不放回、不重抽，行为可预测。
- Commit 是唯一推进轮次及下一次 Draw 的事务边界；预览和界面生命周期只是读取或暂存，不改变随机状态。

## 最小运行状态与生命周期

| 状态 | 唯一语义范围 | 创建 / 更新 | 清理 / 写回 |
|---|---|---|---|
| 当轮 Hand 与 Draw 身份 | Encounter-local | Encounter 开始或上一轮 Commit 成功后创建；由确定性随机上下文抽取；Preview 只读。 | Encounter 结束时清理；存档恢复时读取并校验，不重新随机。 |
| Prepared Action 与 Target | Encounter-local | 从 Hand 建立；Swap / Player Command 只形成当前 Encounter 的准备结果。 | 成功 Commit 后结算并创建下一轮值；遭遇结束时清理。 |
| Swap / Player Command 草稿 | Encounter-local | 玩家输入并经 Preview 验证后暂存；每队每轮共用一个 override 槽，内容可在 Commit 前修订或清除。 | Commit 成功时随本轮一并结算并清除；取消/拒绝不得留下费用或随机变化。 |
| PlayerCost 余额 | Map-run-local | Map Run 创建时按合同初始化；Player Command 的实际扣费和其它获准变化通过 Map Run 写入。 | 不因进入下一 Encounter 自动恢复；Map Run 结束时才依总体奖励/清理合同处置。 |
| Actor / Team 行动费用与生命值 | 按总体 B2 合同确定；不与 PlayerCost 共用字段 | Action Commit 原子读写。 | 不得把 Command 费用混入 Actor / Team resource。 |

UI、View、保存 checkpoint 和 Preview 均不得成为上述运行状态的第二权威 Owner。它们只能读取或携带当前 Runtime 状态的版本化快照。

## C3 验收口径

1. 用真实合法行动构造至少 3 个候选，确认一轮 Draw 实际产生多张互不重复的候选 Hand；对不同 Tendency 的大量确定性种子核对权重差异。
2. 玩家可以看见完整 Hand、Prepared Action 和 Target。
3. 玩家在 Hand 中选另一行动 Swap；在 Commit 前重复 Preview / 重绘 View / 重开 UI，准备行动保持该选择；提交后实际结算换后的 Action 与 Target。
4. 不在 Hand 的 Swap、失效 Action、无合法 Target 或无法支付 Actor/Team cost 的 Swap 被拒绝；Hand、Prepared Action、PlayerCost、Actor/Team 状态、随机状态和历史完全不变。
5. PlayerCost Command 与 Swap 有不同的范围与成本：Swap 只从 Hand 免费选择；Command 按冻结的 Hand 外范围花费 PlayerCost。测试能观察到余额变化及不同 Action 结果。
6. Swap 与 PlayerCost Command 共用每队每轮一个有效覆盖槽；最终只能结算其中一种。被拒绝的操作不占槽、不扣资源；更改未提交草稿不产生额外结算。
7. 自动 Planner 不覆盖当前玩家已 Swap 的 Prepared Action / Target；以版本过期的 Commit 不能执行旧结果。
8. 成功 Commit 才进入下一轮和产生新 Hand；提交重试、View / Preview 重复及 Save / Resume 不重复结算或额外抽取。
9. Encounter 结束时清理 Hand、准备行动和草稿；在同一 Map 的下一 Encounter 中重新生成它们，但 PlayerCost 仍保留已结算余额。

## 冻结记录与剩余阶段门

负责人于 **2026-10-17** 选择“冻结并继续”，批准并冻结以下五项：

1. 每轮最多 3 张（沿用当前默认值），候选不足时少抽、不重抽。
2. Prepared Action 默认取第一张抽出的候选，目标由行动目标规则默认选取。
3. Swap 采用“只从当前 Hand 选另一张”，不弃牌重抽；每队每轮一个有效覆盖槽、免费，提交前可以修改或清除。
4. PlayerCost Command 仅选 Hand 外合法行动，与 Swap 共用每队每轮一个有效覆盖槽；每条花费 1 PlayerCost。
5. 成功 Commit 才推进轮次与抽取下一轮 Hand；无合法候选时明确显示 Wait / 无行动，不尝试刷新 RNG。

阶段 B 总合同尚未全部完成。本 Draft 下文提出 Map / Node / Encounter、状态生命周期、Ability / Item、内容处置、Save / Resume 与 C1a 的默认值，供负责人审阅。

## 其余阶段 B 合同：负责人已批准的默认值

以下根据 Task 0287、阶段 A 报告及 Luna Max 子 Agent 对当前 Registry / Runtime / UI 的复核形成；负责人已于 2026-10-17 选择“冻结并继续”，批准以下默认值。施工仍须遵守 C 阶段的分步验收与写入边界。

### Map / Node / Encounter 的最小关系

```text
Datapack Map
├── startNodeId / exitNodeIds
├── Nodes
│   ├── A：入口
│   ├── B：可选 Encounter
│   └── C：出口
└── Edges：A → B、B → C
```

建议规则：

1. 一个 Map 定义包含起点、出口、Nodes 和 Edges；Edge 表示可直接移动的相邻关系。首版不需要区域、随机地图、自由坐标编辑或任务路线树。
2. Node 可以没有 Encounter；首版每个 Node 最多挂一个 Encounter。Encounter 内容与 Node 绑定，普通作者无需另外编排 Event → Location → Scene。
3. MapRun 从起点创建。起点若配置未完成 Encounter，则进入后立即触发；移动到相邻 Node 时也立即触发该 Node 的未完成 Encounter。无 Encounter 或已完成的 Node 保持 Map 状态。
4. Encounter 活跃时，Map 移动被 Runtime 拒绝，UI 同时显示移动锁定。成功结束后标记 Node 遭遇完成，回到同一 Node；不会自动走向下一个 Node。
5. 已完成 Encounter 的 Node 重访不重开遭遇。普通重访仍须通过实际相邻 Edge；不可达 Node 不能直接移动到达。
6. 到达任一 exit Node 时，MapRun 结束并结算一次明确写出的奖励。
7. 固定队伍中的所有角色 HP 均降到 0 时，Encounter 失败并终止整个 MapRun；失败不发放成功奖励、不保留可继续或重试的当前 Run，也不提供撤退命令。MapRun 临时状态清理，PlayerState 不回滚。玩家可以之后从普通 Spot 入口开始一场全新的 MapRun；新 Run 从地图起点和初始值建立，不继承失败 Run。失败结果页在当前 Map Workspace 保留，直到玩家手动返回游戏。

失败条件以固定队伍全员 HP 归零为准；单个角色倒下不单独结束遭遇。MapRun 终止后不能继续或重试原 Run，但普通 Spot 入口允许创建全新的 Run。失败后不回滚已提交的 PlayerState 变化，且不发成功奖励。

新玩法的友方 HP 起始值及上限来源尚未由负责人指定。C4 必须先调查并提出最小、明确的来源；不得从 PlayerState 长期养成 HP 隐式导入。

### 唯一状态 Owner 与生命周期

建议仍由 GameInstance 内一个私有 Runtime Owner 承载运行状态；**生命周期分层不是要求新增三个独立可写服务**。MapRun 可包含一个可空的 `activeEncounter` 快照，但同一事实只有一个可写权威。

| 状态范围 | 建议唯一内容 | 写入、继承与清理 |
|---|---|---|
| **Persistent PlayerState** | 已拥有/解锁角色、长期成长、永久资源、永久库存物品，以及已经明确授予的永久奖励。 | MapRun 开始时读取准入需要的角色/库存信息。只有明确的一次性奖励结算或已提交的 Item 使用能写入；失败、临时 HP、PlayerCost、MapRun 临时物品不得隐式写回。 |
| **Map-run-local** | `mapId`、当前位置、节点访问/完成标记、固定队伍身份、友方 HP 与跨遭遇 Actor/Team 资源、PlayerCost 余额、临时物品、MapRun 进度与必要的地图级标记。 | MapRun 开始时根据 Map 定义和准入角色建立；Encounter 结算可以原子更新它；移动到下一 Encounter 时继续使用同一值；MapRun 成功/失败后按奖励合同结算并清理。PlayerCost 不因进入 Encounter 或新 Node 自动恢复，只有明示效果可补充。 |
| **Encounter-local** | 当前参与者的局部状态、敌方 HP / 资源、当前轮次、合法行为快照、Character Hand、Prepared Action / Target、Swap / Player Command 覆盖草稿、Encounter 标记和本次 Encounter 结算历史。 | 进入 Encounter 时从其定义和 MapRun 初值构造；Commit 在 Run 的事务中结算；成功/失败/获准撤退时只提取合同明确允许的结果，然后清理手牌、准备行动、目标、草稿、敌方状态与局部历史。 |

角色的身份可以引用 AC Character ID，但战斗中的 HP / 当前资源是 MapRun 或 Encounter 的运行值，不回写到 Persistent PlayerState 的养成值。友方跨遭遇 HP 和其明确可继承资源建议放 MapRun；敌人和遭遇轮次放 Encounter。条件与效果必须标明读写作用域，不能假称现有只读 PlayerState 的通用 Condition 已经支持这两层运行状态。

### Player Ability / Item 的边界

建议采用来源分立、结算保障共用的最小做法：

- Character 自然行为、Hand Swap、PlayerCost Command、Player Ability 和 Item Use 是不同来源，不强制变成同一张实体卡或使用同一套抽取、冷却、持有数据。
- 它们可以进入同一个“检查当前来源权限 → 检查目标与费用 → 原子应用 Effect”的结算边界；各自仍以自己的状态记录费用和消耗。
- Ability 与 Item 不进入 Character Hand。C1a 不要求 Ability / Item；C4 再各用至少一个真实例子验证实际效果和事务性。
- Item Use 引用现有 AC Item 与 PlayerState 库存；消耗数量只在成功 Commit 时扣除。MapRun 临时物品仍由 MapRun 持有，不伪装成永久库存 Item。任何 Effect 写入遭遇角色 HP 等局部状态时，必须通过同一次原子 Encounter 结算提交。
- 只实现满足本 Task 样例所需的窄 Ability / Item 入口，不建立通用 `ActionSource`、`ItemCard`、`SkillCard`、物理牌区或万能能力构筑架构。Ability 的实际可用权、费用与冷却必须使用一个清晰来源；若数据源目前不存在，C4 再以最小的可验证定义补充，不把旧 `StudentSkillRule` 当作玩家主动 Ability。

以上原则与本项目当前 AC `ItemDef` / `PlayerState.inventory` 有关，但现有 `ItemService.useItem()` 只处理 PlayerState 效果；是否让战斗 Item 直接影响 Encounter-local HP，需要在 C4 的 Action Request / Effect 事务中显式接通，不能由 `ItemService` 旁路写入。

### 最小 Datapack 作者语义

建议新内容不再要求 `OperationEvent` / `Location` / `Scene` 分层，也不让普通作者建立 `StudentProfile + CardPool + StrategyProfile` 三件套：

| 数据 | 建议表达 |
|---|---|
| **Map** | 一个顶层 Map 定义，包含稳定 ID、名称、起点、出口和内嵌 Nodes / Edges。Node 可带标题、说明、展示位置；坐标仅供地图展示，不是第二份可写路径图。 |
| **Node** | Map 内局部 ID、展示信息、最多一个可选 Encounter 内容块。 |
| **Edge** | Map 内局部起点 / 终点；默认无条件可走。首版 C1a 不使用条件 Edge。后续条件只能读取明确的 MapRun-local 状态。 |
| **Encounter** | Node 内可选内容块，包含参与者、可用 Action ID、局部初始状态、结束条件和成功/失败结果；不需要 Scene / Phase。 |
| **Action** | 继续使用一处权威的目标、费用与 Effect 定义。Encounter 只引用可用 Action，避免再由 SceneAction 复制一份效果。 |
| **Participant / Tendency** | 继续引用 AC Character ID。角色在该 Encounter 中的 Action 资格与 Tendency 权重只在一个地方配置（建议与 Encounter 的角色参与者同行内联），Tendency 仅决定候选概率，不覆盖 Action 合法性。 |
| **Condition / Effect** | 首版只实现表达 A→B→C 和最简 Encounter 结束所需的条件/效果；MapRun / Encounter 条件明确注明作用域，不引入任意脚本 DSL。 |
| **入口** | 由普通 Datapack Spot 明确引用 `mapId`；建议新增 Map Entry 语义。旧 `operationEntry` 继续只表示旧 Event，在退役期不被暗中重解释为 Map。 |

这是内容合同建议，不是现有 Schema 事实，也不要求这些字段名照搬成 TypeScript 类型。Map 的队伍是固定示例还是从玩家当前 roster 选择，建议 C1/C1a 使用固定、已拥有/已解锁的指定角色；动态编队放在后续扩展，避免为三节点样例先做队伍编辑系统。

### 旧内容处置与 C1a 验收

建议按阶段顺序处置旧 Gameplay B 内容：

| 内容 | 建议处置 | 边界 |
|---|---|---|
| `gameplay-b@1.0.0` 中 Carousel / Atomic Scene / Purchase / Rest 等 Gameplay B Operation 记录及对应专属入口 | C5 按新 Map 内容替换或删除；不逐条迁移。 | 包元数据与仍共享的 base 内容必须单独审查。 |
| `gameplay-b-strategy-park@1.0.0` 的整段 13-Location 路线、Operation 动作 / Profile / Pool 等 Gameplay B 样例 | C5 按新 Map 内容替换或删除；地图可以从零设计。 | 不要求保留旧路线、字段或内容 ID；不得连带删除共享角色与通用效果。 |
| Strategy Park 静态地图 UI 常量、按 Event ID 的专属渲染分支、Carousel 专属 resolver fallback | 新 Map View 和正式 Registry / Resolver 竖切片通过后再退役。 | `carousel-safety-slice` 是运行时直连旁支，不是正式 Datapack / Registry 入口，不能作为新 Map 的内容来源。 |
| base Init / Area / Character / Variant / 永久 Item / 通用 Registry、PackManager、保存和事务设施 | 保留并只做必要接线。 | Gameplay B 专属重建不授权删除共享 AC 系统。 |
| `prototypes/gameplay-b/` | 维持独立，不随 Gameplay B bundle 清理。 | 它不进入 AC 正常内容加载链；如要清理另行授权。 |

对主要旧结构的处置建议：

| 旧结构 | 建议判定 | 目标语义 / 处理方式 |
|---|---|---|
| `OperationEvent` | **Retire** 为 Gameplay B 内容语义；其兼容字段只在旧 Run 处置边界内短期识别。 | 整张地图由 Map 定义；每次运行由 MapRun 保存。不得继续用一个 Event 同时拥有整张地图、当前地点和遭遇终局。 |
| `OperationLocation` / `RouteEdge` | **Transform**。 | 专属内容改为 Node / Edge；直接邻接移动替代“完成 Location 后提交 Route”。 |
| `Scene` / `SceneAction` | 普通作者路径 **Retire**；有具体需求时再作为内部阶段或高级 Action offer 能力评估。 | 简单 Encounter 不要求 Scene；可执行规则集中到 Encounter 可用 Action 与唯一 Action 效果定义。 |
| `OperationActionDef` | **Reuse / Transform**。 | 尽量保留目标、费用、合法性、Effect 单一来源；调整引用，使 Encounter 与各行动来源共享合法检查和原子结算。 |
| `StudentProfile` | **Transform / Internal**。 | 准入检查和冻结快照可以继续内部使用；普通作者不再被迫建立 Profile 才能配置 Character 的 Encounter 参与和 Tendency。 |
| `CardPool` / `StrategyProfile` | 核心作者语义 **Retire**；候选加权、不放回算法 **Internal / Reuse**。 | Tendency 的唯一作者来源随 Encounter 参与者的 Action 权重表达；不要让多个旧来源同时改写权重。 |
| `PlayerSceneDeck` | 从角色 Hand 路径中明确隔离；若通用 Scene 卡组不再有目标用处则 **Advanced / Retire**。 | Character Hand 仅为 Encounter-local Action 候选；不变成实体牌区。 |
| `Objective` / `Outcome` | **Transform**。 | Node / Encounter 的完成与 MapRun 终局分别由清晰的 End Condition 和一次性 Result/Reward 负责；退役重复判定同一终局的旧路径。 |
| `EventRun` / `PreparedBeat` / `InterventionDraft` | **Internal / Transform**，不另存第二份可写地图状态。 | 可复用单一 Runtime Owner、计划快照、版本校验、原子提交与草稿思路；其状态语义改为 MapRun + 可空 Encounter-local 状态。 |
| `OperationView` / Strategy Park 专属地图布局 | **Transform / Retire**。 | View 继续只读投影；删除按 Event ID 分支和重复权威布局，改为从 Map 内容投影 Node / Edge / Encounter。 |
| `CombinationRule` / `StudentSkillRule` | **Advanced / Retire** 候选。 | 不阻挡 MVP；被保留时作为可选高级触发能力，不取代 Tendency、Player Ability 或 Hand。 |

建议 C1a 在旧内容退役之前先跑通正常的新内容链：

```text
Datapack / PackManager
  → Registry 校验并登记 Map
  → Map Resolver
  → 普通 Spot Map Entry
  → Map A：显示相邻移动
  → 移动到 B：触发简单 Encounter
  → 结束 Encounter：返回 Map B
  → 玩家移动到 C：MapRun 完成
```

C1a 不需要战斗、敌方策略、Tendency / Character Hand、PlayerCost、Ability 或 Item。它只证明新作者语义经过正常 Datapack / Registry / Resolver / 游戏入口驱动真实 Runtime 与 View；不能用测试夹具直接构造 MapRun 冒充端到端验收。

UI 至少投影当前 Node、可通行相邻 Edge 和 Encounter 活动状态；玩家只从当前节点附近发起移动。Encounter 活跃时，移动控件显示锁定与原因，Runtime 同时拒绝直接构造的移动命令。Encounter 结束后显示结果并返回 Map B，之后移动到 C 仍需玩家主动操作。第一版不要求地图坐标画布或 Strategy Park 式静态布局表。

### Save / Resume、Run 失效和收尾

- 一个 GameInstance 同时只有一个活动 MapRun；UI 只保存稳定的 Run ID / 返回上下文，不另存当前位置或玩家资源。
- SaveData 将 Persistent PlayerState 与 MapRun checkpoint 分开；checkpoint 包含 Map ID / 内容版本、当前位置与 Node 状态、MapRun 资源、临时物品及活动 Encounter（Hand、Prepared Action、Target、Swap/Command 草稿和随机上下文）。
- Resume 校验 Map 仍存在且版本兼容后，原样恢复 checkpoint；不重新抽 Hand、不重置 PlayerCost、不重复执行最后 Commit。
- 旧 `operationRun` 不自动转换成 MapRun，也不更改 PlayerState。若用户已存旧活动 Run，恢复时明确提示“旧玩法内容已更新，原运行不能继续，可开始新地图”；确认清理后才移除旧 Run checkpoint。
- MapRun 成功只发放定义明确的一次性奖励；失败不发放成功奖励。奖励写回与 Run terminal 结果在同一一次性边界中保证不会重复发放。MapRun 终止后清除活动局内状态，Persistent PlayerState 继续保留。

### 负责人已冻结的选择与待 C4 明确的 HP 起始值

负责人于 **2026-10-17** 批准并冻结以下默认值，并于 **2026-10-18** 补充冻结失败触发与返回规则：

1. Node、Edge、Encounter 内嵌关系；一个 Node 至多一个 Encounter；新内容通过单独 Map Entry 从普通 Spot 进入。
2. 移动到有未完成 Encounter 的 Node 时立即进入；Encounter 成功后回到原 Node；已完成遭遇不重开；出口 Node 结束 MapRun。
3. 固定队伍全员 HP 归零时失败并终止 MapRun；不发成功奖励、不提供撤退，也不允许继续 / 重试当前失败 Run。失败后清理 MapRun 临时状态，保留且不回滚 PlayerState；失败结果页留在当前 Map Workspace，直到玩家手动返回游戏。之后允许从 Spot 新开一场从起点开始的完整 MapRun。
4. 一个 MapRun 内友方 HP / 跨 Encounter Actor/Team 资源 / PlayerCost / 临时物品属于 MapRun-local；敌方 HP / 轮次 / Hand / Prepared Action / Target / 草稿属于 Encounter-local；长期角色、永久库存与成长属于 PlayerState。
5. Party 在第一版由 Map 内容指定并引用已拥有/解锁角色；动态选队和从长期成长自动导入战斗 HP 暂缓。MapRun 的 PlayerCost 初值由 Map 定义显式设置，不在节点间自动恢复。
6. Ability 与 Item 保持来源、消耗和生命周期分立，共用合法性、目标、原子 Effect 提交；C4 各实现至少一个真实例子；C1a 不承担两者。
7. Gameplay B 专属旧内容按上表在新 C1a 链路运行后重建 / 退役；共享 base 内容和独立 prototype 保留。
8. Map ID / 内容版本不兼容时拒绝恢复旧 Run、给出提示并保留 PlayerState；不迁移旧 Operation Run。
9. 全队 HP 归零触发失败，但 HP 的初始值与上限来源尚未冻结；C4 必须提出最小显式来源，禁止从 PlayerState 长期养成 HP 隐式导入。

阶段 B 已整体冻结。主 AI 现在按冻结合同建立具有独立 Read / Write Set 的 C1 / C1a 施工 Task 与 Patch Unit，之后再按依赖推进 C2、C3、C4、C5，并委派 Luna Max 子 Agent 执行独立实施与验收。
