# Task：Gameplay B C4 战斗 HP、敌人、能力 / 道具与失败结算

**状态：approved / active — U1–U3 已完成并经主控独立复核；U4 Workspace 施工中**

## 目标

在 C3 已交付的同一 MapRun / Encounter / Hand / Commit 闭环上增加最小战斗：固定队伍有明确且跨遭遇保留的 HP；战斗节点有 Encounter-local 敌人；角色行动、敌人行动、玩家能力与物品在同一版本化 Commit 中结算；敌人全灭时遭遇成功回图；固定队伍全员 HP 归零时 MapRun 失败。

本 Task 不把旧 Operation Combat 改名搬入新玩法，也不创建第二个战斗 Runtime Owner。作者内容以 Map、Node、Encounter、Action、角色倾向和本 Task 定义的战斗数据表达。

## 设计目标：玩法与数据应具备的结构和关系

```text
Map
├── 固定队伍
├── 每名队员的局内 HP 起始值 / 上限
└── Nodes / Edges
     └── Node
          └── Encounter
               ├── 敌人名单与各自 HP / 固定行动
               ├── 角色行动候选（沿用 C3 Hand / Tendency）
               ├── 玩家能力选项
               └── 可用道具选项

MapRun：持有队伍当前 HP、PlayerCost、位置及跨 Encounter 状态
Encounter：持有敌人当前 HP、角色 Hand / Prepared / Target、能力 / 道具草稿
Commit：一次验证并结算所有玩家选择及敌人行动，然后推进、胜利回图或失败
```

### 战斗回合预期

```text
Draw / 角色手牌
  ↓
玩家准备角色行动，可选择 C3 Swap / PlayerCost Command
  ↓
玩家可另选能力与道具（不进入角色 Hand）
  ↓
正式 Commit：完整校验费用、目标、库存与版本
  ↓
按稳定顺序结算角色行动、能力、道具
  ├─ 敌人全灭 → Encounter 成功，清理局部状态并回到当前 Node
  └─ 敌人仍存活 → 每个存活敌人行动一次
                    ├─ 队伍全员 HP = 0 → MapRun 失败
                    └─ 否则 → 下一轮 Draw
```

**来源各自独立，结算原子共用：**Character Action 来自 Hand；Player Ability 来自 Encounter 明确开放的能力选项；Item 来自既有 PlayerState 库存。三者沿用同一目标合法性、HP 上下界、MapRun Commit 版本和提交收据，但费用账户、消耗和来源记录不得混为一类。

## 已冻结规则与 C4 默认值

### 已冻结

- C3 的 Draw、Hand、Prepared Action、免费 Swap、PlayerCost Command 和正式 Commit 规则保持不变；Ability / Item 不进入 Character Hand。Ability / Item 作为额外来源按下表次数、费用与叠加规则结算，不占 Swap / Command 共享槽。
- 友方当前 HP 属于 MapRun-local，跨 Encounter 保留；敌人 HP、敌人行动和当前战斗结算属于 Encounter-local；既有背包库存属于 Persistent PlayerState。
- HP 不从角色长期养成值隐式导入；Map 对固定队伍每名角色各声明唯一一条 MapRun-local `initial HP` / `max HP` 配置，`max` 为正安全整数，`initial` 在 `1..max` 范围内。
- 固定队伍全员 HP 归零时当前 Run 失败；单人倒下不失败；失败不发成功奖励、不允许继续或重试当前 Run；玩家可手动返回后从 Spot 开一个新的完整 Run。
- HP、敌人、能力、道具及其结算扩展 C3 的同一 MapRun Owner 与 Commit；不得新增第二个可写 Run / Combat Owner。
- 旧 Gameplay B Operation / EventRun 不迁移，不作为新战斗数据的隐式来源。

### 负责人已冻结的 C4 最小默认值（2026-10-18）

负责人已整体冻结下表全部默认值；这些值是 U1–U5 的产品合同。

| 决策 | 已冻结规则 | 目的 |
|---|---|---|
| HP 初始合法性 | 每名固定队员恰好一条 HP 配置；`initial` 必须是 `1..max`，禁止从全员 0 HP 的新 MapRun 开始；若合法内容通过其他效果把全队降至 0，按已冻结规则立即失败 | 避免初始即全灭却能在 Map 上移动 |
| Enemy roster / HP | Battle roster 非空；Enemy ID 在 Encounter 内稳定且唯一；Enemy `max HP` 为正安全整数，`initial HP` 为 `1..max`；活动 Encounter 保存 current HP 并按内容上限校验 | 避免敌人身份 / 上限由 Runtime 或旧 Actor 隐式推导 |
| Battle 与终局 | `enemies` 非空即为 Battle；敌人全灭自动胜利回图、Battle 不可手动完成；完整玩家阶段后先判队伍全灭再判敌人全灭；HP=0 的角色不能行动或**新选为**目标，首版不复活。本轮在 Commit 起始状态合法的目标被更早效果击倒时按下一行处理 | 固定单一胜负出口，符合全员 HP=0 失败条件 |
| Ability / Item 叠加与成本 | Ability 每轮最多 1 次、固定花费 1 PlayerCost；Item 每轮最多 1 件、消耗 1 个 Consumable 库存。二者均可与全队角色行动及另一种玩家来源并存，且不占 C3 Swap / Command 槽；Ability 无额外 Action cost，Item 无 PlayerCost / Actor / Team cost。Ability 与 PlayerCommand 同轮时，二者 PlayerCost 按同一 Commit 起始余额合并校验 | 让来源与成本明确，不扩展行动替换规则 |
| Ability / Item 作者关系 | Encounter 显式开放 Ability；Item 在 Encounter 内一对一映射 `itemId → Map-local actionId`。二者复用 Action 目标 / 效果规则，只使用无执行者子集：不得要求角色资格、`self/actor`、Actor / Team cost 或 actor-relative effect；`useCondition` 在 Preview 展示、Commit 按当前状态重验 | 避免伪造角色 ID，也不复制第二份效果 DSL |
| Enemy 行动与目标 | 每个存活敌人每轮固定造成声明的伤害一次；选当前 HP 最低的存活队员，同 HP 时按 Map 固定队伍顺序；角色行动、Ability、Item 完整结算后，敌人按 Encounter 声明顺序行动 | 不引入 Enemy Hand、倾向、Planner 或随机目标状态 |
| 本轮重复目标与胜利时点 | Commit 开始时验证目标存活；若本轮更早效果已使目标 HP 到 0，后续原本合法的行动仍执行、费用 / Item 消耗仍结算、对该目标的实际 HP 变化为 0；跑完全部玩家来源后先判全队失败，再判敌人全灭胜利。敌方行动开始后每次攻击后检查失败 | 明确集火、过量伤害、Ability / Item 消耗与整轮顺序，避免半轮中断 |
| 来源执行者与目标 | Ability / Item 没有角色执行者；只开放明确的 Enemy / Commit 起始时存活队员目标，不伪造角色 ID，不使用 Actor/self 成本与效果。角色行动、Ability、Item 只可伤害 Enemy 或治疗在 Commit 起始状态时仍存活的队员；不能伤害友方或复活 0 HP 角色 | 避免把 C3 Character Action 的执行者语义错误套用到其他来源，也避免同一玩家阶段出现友方全灭与敌方全灭冲突 |
| Item 映射与使用条件 | Item 映射按 Encounter 生效，同一 Encounter 中 `itemId` 最多映射一个 Map-local Action；只接受 Consumable；Preview 读取 useCondition 展示可用性，Commit 按当前状态重新检查 | 让物品效果归当前遭遇配置并防止预览后条件过期 |
| 已结束 Run 的结果与重试 | MapRun 保留最近一笔 Encounter 终态 receipt，覆盖“战斗胜利后 Run 继续”的 Save / Load 去重；失败页 / 终态回执只在当前 Runtime 保留至手动返回。同 Runtime 重放终态 requestId 返回同一结果。“失败页不提供继续 / 重试”只约束当前 Runtime；显式加载失败前的旧 Save 视为玩家主动回滚，可恢复那个 checkpoint 中的 Run。该回滚不等于失败后自动重试 | 不新增可被旧 Save 回滚的永久失败账本；避免把 UI 重试与明确恢复旧存档混为一谈 |

## 当前背景：C3 已提供什么、尚缺什么

- C3 的 `MapRunService` 是唯一可写 Owner，已保存固定队伍、MapRun 资源、Encounter Hand / Target / Override / RNG / round 与最近提交收据；Commit 先构建完整计划，再一次安装新 Run。
- C3 目前目标只支持无目标、自身和队伍角色；效果只支持 Actor / Team 普通资源，没有 HP、Enemy、Ability、Item 或失败结果类型。
- Map 当前没有队员 HP 起始值 / 上限，Character 与 Variant 也没有适合作为本玩法战斗 HP 的静态来源。
- 现有 `ItemService.useItem()` 会立即修改 PlayerState 背包并触发普通 PlayerState Effect；它不能被直接调用来结算 MapRun HP，否则可能出现扣道具成功、战斗效果失败的部分写入。
- `StateMutationService` 已有 Shop / Spot 的批量事务模式，可作为 PlayerState 物品账本与 MapRun Owner 同步提交的实现参考；不应绕过状态写入服务直接操作库存。
- 正常 Spot → Datapack → Registry → Resolver → Controller → MapRun 入口已在 C1a / C3 跑通。C4 继续扩展该入口；Datapack Editor 的完整作者支持由 C5 收口。
- Task 0287 的最终 D2 还包括 Rest 与 Shop；C4 只交付 Battle，Rest / Shop 内容与验证留给 C5，不借 C4 增加通用 Encounter 类型系统。

## C4 行为合同

### 1. HP 与 Enemy 状态

- Map 对固定队伍每名角色明确提供唯一一条 `initial HP` 与 `max HP`；`max > 0`、`1 ≤ initial ≤ max`，均为安全整数。HP 不从角色长期养成值导入；MapRun 初始化时将其复制为局内当前 HP。
- MapRun 保存固定队员的当前 HP；上限来自 Map 内容，并受 `resumeVersion` 保护。成功离开一个 Encounter 后，队伍 HP 原值带到下一 Encounter；结束 Run 后清理。
- Battle Encounter 必须定义非空敌人 roster；每个 Enemy 有 Encounter-local 稳定 ID、初始 HP、上限 HP 和固定伤害行动。Enemy ID 在 Encounter 内唯一；`max HP` 是正安全整数，初始 HP 在 `1..max HP` 范围内。
- 活动 Encounter 保存每个 Enemy 的 ID 与当前 HP。离开遭遇时清除 Enemy 状态；Restore 时按当前 Map 定义校验 roster、HP 范围、目标和提交收据后再安装。
- HP 不是普通 Actor / Team resource。HP 改变必须走有上下界的专用效果；正向恢复不超过上限，负向伤害不低于 0，回执记录实际 HP 变化。
- HP 为 0 的角色不再抽取 Action、不接受敌方攻击，也不能作为**新提交目标**；首版不提供复活。其他存活队员继续行动。全队 HP 为 0 是唯一 C4 失败条件。若本轮起始时已合法选中的目标在先前效果后降至 0，则按下方冻结规则处理，不与此规则冲突。

### 2. 行动、目标和胜负

- C3 Map-local Action 扩展到可合法选择存活 Enemy；需要支援时也可选存活队员。UI、命令、预览、Commit 和 Restore 使用带阵营的目标身份，不能只保存一个含义不明的字符串。
- 玩家角色行动、Ability、Item 的所有费用和效果均从 Commit 起始状态统一核验。任一参与者、目标、费用、库存、HP 边界或版本无效，整次提交拒绝，所有状态不变。
- 回合结算顺序固定为：固定队伍顺序的角色行动 → 玩家 Ability → 玩家 Item → Enemy 行动。Commit 内部先完成合法性与总费用计划；结算记录保留各来源。
- Commit 开始状态校验所有角色 / Ability / Item 目标。若早先玩家效果使一个目标在同轮内降到 0，后续仍按起始时确认的目标执行，费用 / Item 消耗照常结算，对该目标的实际 HP 变化为 0；完整玩家阶段结束后先检查队伍失败、再检查 Enemy 全灭胜利。若敌人仍存活，每个活敌人依次攻击，每次攻击后检查队伍是否全灭。
- 带非空敌人 roster 的 Encounter 就是 Battle，不能使用 C1a 手动完成；普通无敌人 Encounter 可继续使用既有完成语义。Battle 胜利清除 Encounter-local 状态、标记 Node Encounter 完成并回到同一 Node。
- 成功击败敌人是 Encounter 成功，不自动结束整张 Map；到达出口仍由 Map 规则决定 Run 成功。

### 3. Player Ability 与 Item

- Ability 与 Item 分别声明和校验；都不是 Character Action、不进入 Character Hand。每轮至多一个 Ability 和一件 Item；均可与全队角色行动及另一种玩家来源并存，也不占 C3 Swap / Command 槽。
- Ability 使用 Encounter 显式提供的 Map-local Action 引用作为目标与效果来源，每轮至多一次并消耗 1 PlayerCost；不另收 Action cost。不得创建第二套 Ability 效果 DSL，也不把旧角色技能系统当作其定义来源。
- Item 使用既有 `ItemDef` 身份与 PlayerState per-Init `inventory` 数量；Encounter 用 `itemId → actionId` 一对一声明战斗可用物品。对应 Item 必须为 Consumable，每轮至多使用一件并在成功 Commit 扣除 1 件库存；映射 Action 沿用 Map-local Action 的目标与效果，不复制效果 DSL，也不执行 `ItemDef.useEffects` 的通用 PlayerState EffectEngine 路径来改局内 HP。`useCondition` 在 Preview 读取展示、Commit 按当前状态重新检查。
- Ability / Item 没有“执行角色”。不得伪造 Character ID 来通过 C3 执行者检查；若 C3 Action 的现有定义强制要求 Character 执行者，施工时应抽取共同的纯目标 / 效果解析。Ability / Item Action 只允许明确 Enemy 或 Commit 起始时存活队员目标，不允许 `self/actor`、Actor resource 成本或 actor-relative effect。
- 跨 Owner 事务必须保持唯一写权限：GameInstance / 运行时组合层协调两个 Owner 的已验证提交；StateMutationService 只写 PlayerState，MapRunService 只写 MapRun。先在无写入阶段校验库存、Item 条件、内容、全部行动并分别构造 next PlayerState / Stats delta 与 nextRun；全部有效后，在同一同步调用栈内安装两份状态并记录 Stats，不执行 `await`、派发事件或调用用户代码，之后统一派发事件。两个 Owner 的安装必须是已准备状态的一次无失败替换，Stats 更新也必须无失败；若不能保证无失败，则需回滚或停止该 Unit。任何 listener 都不得观察到一边已更新、另一边未更新的中间态。StateMutationService 不得接管 MapRun 写权限，协调层也不得直接写任一 Owner 内部字段。
- 禁止先单独 `removeItem()` 再跑 MapRun Commit，也禁止在库存检查前安装 Run。活动 Encounter 的最近 `requestId` 重试或从 Save / Load 恢复后重放，复用 C3 receipt，不能二次扣物品、重做伤害或重复推进轮次；更早的请求只允许因过期版本而零副作用拒绝。MapRun-local 保留最近一笔战斗 Commit receipt，使战斗胜利、Encounter 清理后仍能去重并随仍活动的 MapRun Save / Load；失败终态回执只留在当前 Runtime。无论是否返回已有结果，所有旧命令都必须零副作用拒绝或返回已提交结果，不得再次写状态或发奖励。显式加载失败前旧 Save 视为玩家主动回滚，可恢复该 checkpoint 中的 Run。

### 4. 终态、存档和 Workspace

- 每次成功 HP 变化提交后，在同一原子边界确定 Encounter 胜利或 MapRun 失败；失败立即清除活动 Run 与 MapRun-local 状态、不发成功奖励，并生成只读失败结果。
- 新 MapRun 入口拒绝全队初始 HP 为 0 的内容；若 Restore 或其他合法状态转移让玩家进入 Encounter 时全队 HP 已为 0，立即形成失败结果，不创建可继续但无人可行动的遭遇。
- 失败结果停留在 `map:runId` Workspace，直到玩家显式返回游戏；失败页面不提供继续、撤退或当前 Run 重试。返回 Spot 后可建立不同 `runId` 的完整新 Run，初始化 HP、费用和其他 MapRun-local 状态。
- 活动 Run 的 HP、Enemy、能力 / Item 草稿、轮次和 receipt 存在已有 MapRun checkpoint；扩展后提高 Map `resumeVersion` 并拒绝旧版本活动快照，不新增 SaveData 顶层 Owner。
- 失败结果不跨 Save / Load 持久化，只在当前 Runtime 保留至手动返回；同 Runtime 重放终态 requestId 返回同一结果。显式加载失败前旧 Save 可恢复其 checkpoint。PlayerState 库存不会因失败回滚已成功提交的 Item 消耗。仍活动的 MapRun 在胜利离开 Encounter 后保留最新 Encounter receipt，以便保存后重放不重复结算；不承诺无限历史 requestId 去重。
- Query / Workspace 只读投影队伍 HP、Enemy HP、合法目标、能力 / 道具可用性、各自费用 / 消耗、最近提交结果与失败原因。失败终态只提供手动返回入口。

## 明确不做

- 不建新的 CombatService / CombatRun / Encounter Save Owner；不从旧 Operation Actor、EventRun、Location、Scene、Profile、CardPool 或 Planner 导入战斗语义。
- 不把 HP 塞进通用 Actor / Team resource；不从长期角色养成推导战斗 HP。
- 不为敌人创建 Hand、Tendency、通用 AI Planner、多阶段 Boss 或脚本系统。
- 不实现撤退、失败后当前 Run 重试、战斗中途奖励结算、角色装备 / 成长公式或玩家牌组构筑；首版不支持复活。
- 不实现 Rest / Shop；不在此 Task 支持独立 Datapack Editor 全量 Map 编辑；两者分别按 Task 0287 C5 收敛。
- 不手改 `engine-defs.gen.json` 或其他生成 Schema；不以长期适配器保留旧 Operation 作为新内容权威。

## Patch Units

### U1 — Battle 内容定义与 Registry 校验

**读集：**`src/data-services/contracts/gameplay-map.ts`、`registry-validate.ts`、`registry.ts`、Map Datapack / Spot resolver、当前 Gameplay B 样例及 Registry 测试。

**可写集：**Gameplay Map 源合同、维护中的 Registry 校验与其定向测试、当前新 Map 样例；必要的导出 barrel。不得改生成 Schema。

**交付与验收：**加入显式队伍 HP、Enemy roster / 初始与上限 HP / 行动、Encounter Ability / Item mapping、战斗目标与有界 HP 效果的最小内容表达；Registry 对重复 Enemy ID、非正 max HP、越界 initial HP、缺失队员 HP 配置、无效 Action / Item 引用、非 Consumable Item、来源不兼容 Action 与不合法战斗完成规则拒绝加载。真实 Datapack 经正式 Registry 加载样例。活动 Run 的 current HP 不属于静态内容字段；其 checkpoint 校验由 U2 负责。

**Receipt — 2026-10-18 完成：**增加 `GameplayMapDef.initialPartyHp`、Encounter-local Enemy roster、显式 Ability / Item Action 引用、`enemy` / `partyCharacter` 目标和有界 `hpEffects`；Registry 拒绝非法 HP、重复 Enemy、Battle 手动完成、缺失 / 错误 Action 与 Consumable Item 引用及 actorless 来源不兼容内容。已以正常 Datapack 经 Registry 加载 Battle 样例。为保持 C3 消费者可编译，只扩宽两个只读 target-kind 类型，未添加 Enemy 运行行为。独立复核通过；另补充拒绝 Enemy 目标上的 Actor `recipient: target` 资源效果。验证：`npx vitest run tests/data/gameplay-b-map-registry.test.ts` 105/105、`npx vitest run tests/engine/gameplay-b-map-run.test.ts` 28/28、`npx tsc --noEmit`、`git diff --check` 均通过。current HP 和 Run 结算留给 U2。

### U2 — MapRun HP、Enemy 快照、统一 Battle Commit 与终态

**读集：**C3 `map-run.ts` / `map-run-service.ts`、Action Preview / Hand Resolver、Save / Restore、C2 / C3 receipts 与 Run / Encounter 测试。

**可写集：**MapRun 合同、唯一 MapRunService / 对应纯 Resolver、MapRun Save / Restore 校验与其定向测试。不得新增 Runtime Owner 或在本 Unit 接 UI。

**交付与验收：**初始化并跨 Encounter 保存友方当前 HP；进入 Encounter 时创建 Enemy-local HP；将阵营目标、玩家行动和固定敌方行动纳入现有 Commit；提交失败零写入；Restore 原子验证 party HP 与内容 roster、Enemy 身份及每个 current HP 均在定义上限内；Enemy 全灭自动成功回图；全队 HP 归零形成失败并清理 Run；一个队员倒下仍可继续。具名验证：角色 A 击倒 Enemy X 后，角色 B（或后续 Ability / Item）仍指向 X 时，后续费用 / 库存照规则结算、该段实际 HP delta 为 0；完整玩家阶段结束后判胜且不执行敌方攻击。终态请求重放、失败结果显示与失败前 checkpoint 的显式加载行为满足冻结后的策略。

**Receipt — 2026-10-18 完成并经主控独立复核：**在唯一 `MapRunService` 中加入 MapRun-local party current HP、Encounter-local Enemy HP 和阵营目标；Commit 构建完整的资源 / HP / 敌方回合 / 终态计划后一次安装，失败为 runtime-only 结果。Enemy 全灭自动胜利、不执行敌方回合；存活敌人按内容顺序攻击当时 HP 最低的存活队员，平手按固定队伍顺序，每次攻击后检查全灭。0 HP 队员为空 Hand、不能行动或成为新目标；合法同轮目标被先手击倒后，后续费用仍结算、实际 HP delta 为 0。活动 MapRun 最新 Encounter receipt 跨胜利清理保留；活动 checkpoint 按内容身份 / HP 上限校验且不重抽 Hand/RNG；终态失败 replay 与失败前旧 checkpoint 显式回滚通过。主控独立复核并补充新 Run 立即成功时清理旧失败摘要的边缘回归。验证：MapRun / Save-Resume / Runtime integration 3 文件 41/41；追加终态生命周期回归后 MapRun 31/31；`npx tsc --noEmit` 与 `git diff --check` 通过（仅工作树已有 CRLF 提示）。U3 的跨 PlayerState 库存原子事务与 U4 UI 仍未实施。

### U3 — Ability / Item 来源、费用与跨状态原子提交

**读集：**Runtime Commands / GameInstance 注入、`StateMutationService`、Shop / Spot transaction、ItemService、Save / Load 与 C4 Commit receipt。

**可写集：**Ability / Item 命令合同与只读候选解析、窄的 StateMutation transaction port、GameInstance 组合接线、MapRun提交中必要的串行扩展及其测试；不得调用通用 ItemService 旁路修改局内 HP。

**交付与验收：**Ability 与 Item 有独立来源、资格、费用 / 消耗和回执字段；与角色行动共享版本 / 目标 / HP 事务且没有伪造执行者。若冻结为 Ability 可与 PlayerCommand 同轮使用，则按同一起始 PlayerCost 余额合并验证。库存不足、useCondition 在 Preview 后失效、目标 / Cost / HP / 版本无效时，PlayerState inventory、Stats、MapRun HP / Enemy / round / Hand / RNG / commitVersion / receipt 均不变且无事件；成功时组合层依 owner 边界安装 PlayerState 与 MapRun 后再发事件，事件 listener 同步读取时只能观察完整提交后的两边状态且库存事件恰好一次；保存已选 Item draft 不扣物、Load 后 Commit 只扣一次；保存已 Commit 的活动 Run 后重放同 request 不重复扣库存、更新 Stats、发事件或应用效果。

**Receipt — 2026-10-18 完成并经独立审查：**Ability / Item 使用独立 Encounter-local 草稿、来源目标与回执字段；Ability 每轮 1 次、支付 1 PlayerCost，Item 每轮 1 件、成功提交时扣除 1 个 Consumable。GameInstance 先构建 MapRun 计划，再重验 Item 定义 / 类型 / `useCondition` / 库存并准备库存扣除；双方均预检通过后在同步调用栈内安装 MapRun、PlayerState 和 Stats，最后发布一次库存事件。Replay 跳过库存扣除和事件；未协调的 `MapRunService.commitEncounterRound()` 会拒绝带 Item 的提交。ReadModel 公开 Ability / Item 候选与 `useCondition` 可用性，并提供 runtime-only 失败结果。独立审查未发现 GameInstance 主路径 blocker；审查指出的“Item 导致失败后同 request replay”回归已补充，并在 `gameplay-b-map-source-transactions.test.ts` 定向重跑 **7/7** 通过。U1–U3 定向白名单 **5 文件、153 项**通过，`npx tsc --noEmit` 与 `git diff --check` 通过（既有换行提示除外）。审查另记录 service standalone 的公开 prepare/install primitive 可被主动直接调用，但实际 GameInstance owner 为 `#private`、只读 façade 不暴露该对象且普通 commit wrapper 会拒绝 Item；当前正常运行入口不可达，作为内部 API 防御项记录而非主路径 blocker。U4 UI 尚未实施。

### U4 — 战斗 Workspace、失败结果与命令交互

**读集：**Map Workspace / View DTO、MapRunQuery、GameCommands 与 Controller 地图交互 / 子区域刷新、成功结果页面和 UI 测试。

**可写集：**C4 Query / Workspace View / Map Workspace / Controller / CSS 及定向 UI 测试。沿用当前视觉体系和 Encounter 局部刷新，不重做 Map 导航。

**交付与验收：**显示双方当前 / 上限 HP、准备行动及双方目标、Ability / Item 分立选择、各自费用与库存、战斗结果；失败结果只读并有返回游戏按钮；无可支付 / 非法目标状态明确，命令失败不改变 Run。

### U5 — 正式入口端到端、回归、文档和独立验收

**读集：**C1–C3 正常 Spot → Datapack → Registry → Resolver → Controller → MapRun 验收、C4 U1–U4 收据、C5 目标及机制文档。

**可写集：**Gameplay B 新样例、定向端到端 / 回归测试、Task 0287 / Task 0291 收据与需要维护的机制说明；旧 Operation 专属数据的退役仍留给 C5。

**交付与验收：**从正式 Spot 入口进入 Map A，在 Battle Encounter 完成至少一次角色攻击、一次 Swap、一次 PlayerCost Command、一次 Ability、一次 Item 与敌方攻击；专门覆盖两名角色或角色加 Ability / Item 指向同一 Enemy，先手击倒目标后后续仍支付冻结成本 / 消耗库存、HP delta 为 0，完成全部玩家行动后胜利且不触发敌方攻击；分别完成全队败北；败北后手动返回并从 Spot 新开 Run，并验证失败前旧 Save 的明确策略；证明 HP / 物品 / PlayerCost 生命周期与合同一致。Item Commit 触发败北时已提交的物品消耗保留且不发成功奖励。另一名未参与施工的 Agent 或主控独立核对状态所有权、原子性、回放 / 存档、UI 可读性及完整测试证据。

## 通用实施纪律

- 每个 Unit 先确认当前源码与调用方；跨出可写集先向总控说明，不扩大 Unit。
- 倾向由不同 Luna Max 子 Agent 承担互不冲突的 Unit；U2 与 U3 都改动 MapRun Commit 的部分必须串行接入。最终独立审查者不得是该 Unit 施工者。
- 项目测试约定要求重要状态 / 跨层改动补行为回归。仅运行白名单内针对性测试、类型检查、`git diff --check` 与文档检查；不以施工者声明替代独立复核。
- 修改内容身份、Map `resumeVersion`、Registry 引用或 Run checkpoint 时同步维护相关序列化 / 校验测试；不改生成 Schema。
- PlayerState 是长期权威，MapRunService 是玩法 B 局内权威。跨 Owner 事务只能通过窄的显式协调入口；监听者不可观察到一边已扣物品、另一边尚未提交的中间态。
- 本 Task 只授权 C4 Battle 范围。C5 仍负责从零重建剩余 Gameplay B 样例、作者编辑入口、旧 Gameplay B 专属数据退役及旧存档失效处置。

## 负责人冻结记录

负责人于 **2026-10-18** 通过“冻结全部建议默认值”确认以下规则：

1. **HP / Enemy 数据：**固定队伍每名角色由 Map 明确配置一条 HP `initial` / `max`，初值为 `1..max`；Battle 必须有非空 Enemy roster，Enemy ID 在 Encounter 内唯一，HP 为正安全整数且初值不超过上限。
2. **胜负与轮次：**敌人全灭自动胜利回图；完整玩家行动阶段结束后先判全队失败、再判敌方全灭；HP 为 0 的队员不行动、不成为新目标，首版不复活；玩家阶段开始时合法但被前序行动击倒的目标仍完成后续结算，费用 / 物品照扣且实际 HP delta 为 0。
3. **Ability / Item 叠加：**每轮最多一个 Ability（1 PlayerCost）和一件 Consumable Item（消耗 1 件）；均可与所有角色行动及彼此并存，且不占 C3 的 Swap / Command 槽。Ability 与 PlayerCommand 同轮时合并校验 PlayerCost。
4. **来源与目标：**Encounter 显式开放 Ability；Item 由 `itemId → Map-local actionId` 映射。两者不伪造角色执行者，只允许无 Actor/self 成本与 actor-relative 效果的 Action；目标限 Enemy 或提交起始时仍存活的队员。
5. **Enemy 行动：**每个存活敌人按内容顺序每轮造成固定伤害；目标为当前 HP 最低的存活队员，同值按固定队伍顺序决胜；每次敌方攻击后检查全队失败。
6. **终态与存档：**失败页仅在当前 Runtime 保留到手动返回，不提供当前 Run 继续 / 重试；同 Runtime 重放终态 requestId 返回同一结果。显式加载失败前旧 Save 视为玩家主动回滚，可恢复其中 checkpoint。

U1–U5 可按上述冻结合同依序施工。Task 0287 的最终 D2 中 Rest / Shop 仍须在 C5 验收，不因本 Task 延后而删掉。

