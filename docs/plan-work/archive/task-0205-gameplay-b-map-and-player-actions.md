# Task 0205 — 玩法 B 地图图结构与玩家主动行动

状态：done — U1–U4B Runtime、游乐园分支/回环图、场景选择、共享 Cost、有限卡组与目标选择 UI 完成；原型 152/152、类型/构建/文档检查通过；浏览器实走分支、两类选择、卡牌、回环上限、持有物捷径/兜底、Cost 离场封顶、凭物品消费进入设备井及战斗 Click。

## 目标

扩展独立的 `prototypes/gameplay-b/` 迷你 Demo 引擎，使游乐园路线可用统一有向节点图表达分支与回环，并支持持有物出口条件、场景逐角色/全局行为选择、路线共享玩家 Cost、离场携带上限及有限玩家主动卡组。交付一张覆盖这些能力的游乐园多区域地图与事件样例。

本 Task 覆盖玩法 B 地图和玩家主动玩法扩展，不接入 AC Runtime、通用 Engine 或 Datapack。

## 设计边界

- **包含：**场景图、出口评估与选择、有限节点访问、持有物状态与组合判定、两种场景行为模式、批次 Cost 校验/扣除、场景 Cost 收益/离场携带上限、有限路线卡组、地图/场景 UI、事件日志及同主题内容样例。
- **明确非目标：**AC 集成；通用脚本/表达式；任意运行时编辑器；地图随机生成；角色 Cost 主动技能；战斗内玩家主动卡；角色编队/成长；无限洗牌循环。
- **角色随机技能：**保持现有角色战斗机制，不改语义。
- **已裁定来源：**`draft-0204-gameplay-b-map-and-player-actions.md` 的“用户裁定”表。该 Draft 的候选规则仍待用户审阅，未经确认不视为当前机制事实。

## 首期候选实现规则

1. 地图是有向图；出口按条件与目标 `maxVisits` 过滤。所有非终止场景必须有不依赖物品的兜底出口，并声明出口最终被访问上限全部关闭时的终态。场景完成后显示可用出口，玩家选择并确认后离开。
2. 出口条件是持有物条件表达式：叶节点仅检查指定物品是否拥有，组合支持 `all`、`any`、`not`。物品 ID 去重；默认仅检查不消费，出口可显式声明提交时消费的物品。
3. 地图可配置区域/楼层展示标签，跨区/层仍通过普通出口。
4. 场景按 `maxVisits` 限制访问次数。每次访问重置该次活动次数/战斗，并重新执行每次入场效果；首次入场效果只执行一次。HP、物品、Cost 和已用卡牌状态持续。
5. 场景配置 `individual` 或 `global` 行为模式以及每次访问的行动批次数。Individual 下每名 HP>0 的在队角色各选一个行为；Global 下全队共选一个行为。确认整批时，每个批次只消耗一个行动次数。
6. 一批内所有角色行为与玩家卡费用先汇总校验，再原子扣除；不足则禁止提交。之后按固定角色/配置顺序结算骰子、卡牌与行为结果。
7. 路线共享 Cost 与角色战斗 sCost 分离。进入场景时尝试增加配置的 `costGain`；选择出口时将余额压至当前节点 `maxCarryCost`，再切换节点。离场上限不约束场景内余额。
8. 玩家卡组每局固定且有限：seed 洗牌，开局抽至手牌上限，每次进入节点抽配置张数；打出的卡进入不回洗的已用区，抽牌堆耗尽后不再补牌。手牌跨节点保留。玩家卡首期只在场景行动批次使用。
9. 场景事件、资源、物品、访问次数、已用卡和随机位置都由 Route Runtime 持有；View 为只读投影。地图循环由 `maxVisits` 有限终止；内容验证拒绝没有上限的节点和无法继续的非终止节点。

以上是当前实施候选基线，不标记为用户逐条确认；若用户后续调整，或实现证据与候选冲突，先更新 Draft/Task，再继续相关 Unit。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 路线节点 union、Route 输入与 Route Runtime 位于同一 Runtime 文件；输入用有序数组。 | `prototypes/gameplay-b/src/runtime.ts`：`GameplayBRouteNode`、`GameplayBRouteRuntimeInput`、`GameplayBRouteRuntime` | 需要替换数组后继为节点 ID 图与出口命令。 |
| 活动结束和战斗胜利都进入数组下一项；入场事件按 node ID 去重。 | `prototypes/gameplay-b/src/runtime.ts`：`resolveActivityClick()`、`resolveBattleClick()`、`enterNode()` | 需引入访问计数、首次/每次入场效果和待选出口阶段。 |
| 路线只读投影位于 model；当前没有 Cost/物品/卡组/选择阶段投影。 | `prototypes/gameplay-b/src/model.ts`：`GameplayBRouteView`、`RouteEventRecord` | 新状态需形成冻结只读字段及可审计事件。 |
| 主页面按 park-route 查内容，进度标签固定为 12；活动日志文案按固定 ParkTextEntries 映射。 | `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`update()` 与事件转写处 | UI 需移除 12 节点/顺序路线假设，并显示出口、场景行为、Cost/卡组/物品。 |
| 现有路线测试覆盖短路线、活动结算与完整公园回放。 | `prototypes/gameplay-b/tests/route-runtime.test.ts`、`location-activity.test.ts`、`park-demo.test.ts`、`short-route.test.ts` | 保留既有行为回归，并增加图循环、选择与资源结算证据。 |

`prototypes/gameplay-b/` 当前在 Git 工作区中为未跟踪目录；实施时必须保留并在现有实际文件上增量工作。

## 施工切片

### P0：配置语义与边界验收

- 审阅并冻结 Draft 候选规则。
- 重核 UI 挂载、事件文本/预览关联、现有 Runtime 测试与构建入口，更新各 Patch Unit 的 Read Set 和 Allowed Files。

### P1：地图图、出口条件与物品状态

- 定义图节点、出口、持有物条件树、出口选择阶段与只读投影。
- 支持出口条件过滤、提交时物品消费、`maxVisits`、首次/每次进入事件和图环回访。
- 迁移公园内容结构，保留固定路线作为现有行为基准。

### P2：两种场景行为和共享 Cost

- 引入场景行为配置与玩家选择命令。
- 支持逐角色批次及全局行为、行为结果预览、同批 Cost 汇总校验及原子结算。
- 支持入场 Cost 收益、出口时按场景携带上限收敛，以及相关日志。

### P3：有限玩家卡组

- 实现 seeded 抽牌、手牌上限、场景补牌、玩家出牌、Cost 支付、效果/物品修改、已用牌不回洗。
- 卡牌只在场景行动阶段使用；不改变战斗角色行动卡或角色随机技能。

### P4：游乐园多区域样例与交互验收

- 交付有回环的游乐园地图，至少包含一个物品门槛出口、一个兜底出口、两种行为模式、Cost 溢出/携带上限、玩家卡获得/使用/耗尽路径。
- 在 UI 中展示区域/楼层、访问轨迹、可用出口、行为选择、玩家 Cost/手牌/物品与事件日志。
- 核验正常路线、持有物快捷路线、回环上限路线及失败/终止路径。

各 Patch Unit 限 3–5 个文件、约 300–500 行净改动；若模型、Runtime 与 UI 同时变更超过预算，须拆独立 Unit 并逐步交接。施工中不得清理本地既有原型目录。

## 测试与验收

- [ ] Runtime 同 seed、同选择序列下，节点访问、Cost、物品、卡组、随机结果、事件序列与终态完全一致。
- [ ] 图验证允许有环但要求访问有上限；错误节点引用、重复 ID、无兜底出口、未定义的无出口终态和非法条件配置在开局前被拒绝。
- [ ] 场景完成后只显示条件满足且尚可访问的出口；物品门槛、选边时原子消耗、回环回访和访问上限都可从 View/事件核对。
- [ ] Individual 与 Global 行为选择按规则扣一次行动额度；Cost 不足时状态、手牌、物品、HP、随机游标和事件均不部分改变。
- [ ] 同批行为/玩家卡费用一次校验支付；场景入场收益及离场携带上限可复核；角色 sCost 未被路线 Cost 污染。
- [ ] 有限卡组固定 seed 可复现；牌只从抽牌堆进入手牌、打出后不回洗，空堆不再补牌，卡牌目标/时机/费用非法时拒绝输入。
- [ ] 新游乐园地图的图路线、门槛路线、回环路线可浏览器游玩到清晰终态；事件日志不遗漏分支选择与资源变更。
- [ ] 现有 park demo 与独立原型定向测试、全测、typecheck、build 通过；不引入 AC Runtime import。

## Patch Unit 0205-U1：地图图与持有物出口选择

### Goal

在 Route Runtime 增加可选的显式有向图模式：场景完成后按出口条件展示可选目标，玩家提交出口后进入目标节点；条件首期支持持有物逻辑树，节点访问上限有限，未能继续时进入明确终态。原数组顺序模式继续供既有演示使用，后续 Unit 再迁移游乐园内容与 UI。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `draft-0204-gameplay-b-map-and-player-actions.md`：用户裁定与地图候选规则 | 当前设计边界 |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`：C2–C7、停止条件 | Unit 文件与验证纪律 |
| 源码 | `prototypes/gameplay-b/src/runtime.ts`：`GameplayBRouteNode`、`GameplayBRouteRuntime` | 路线状态、推进和事件写入 |
| 源码 | `prototypes/gameplay-b/src/model.ts`：`GameplayBRouteView`、`RouteEventRecord` | 冻结 View 契约 |
| 源码 | `prototypes/gameplay-b/src/view.ts`：路线事件类型到 UI 标签的映射 | 新增 Runtime 事件必须保留完整事件呈现 |
| 测试 | `prototypes/gameplay-b/tests/route-runtime.test.ts` | 现有通用路线 Runtime 夹具 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分 Unit；不扩展到 UI 或内容迁移 |

### Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 路线当前从数组首项开始；活动结束、战斗胜利按数组索引前进。 | `runtime.ts`：构造函数、`resolveActivityClick()`、`resolveBattleClick()` | U1 可新增显式图输入，同时保留数组兼容路径。 |
| Route View 当前没有可选出口、物品或访问次数。 | `model.ts`：`GameplayBRouteView` | U1 只增加出点所需投影；UI 消费留后续 Unit。 |
| 当前事件带连续 sequence 与 click。 | `model.ts`：`RouteEventRecord`；Runtime：`appendEvent()` | 出口出现/选择应追加事件。 |

### Constraints

- 原型继续与 AC Runtime 隔离；必须带 Vitest 回归；规则/隔离边界按 AGENTS.md 和项目 Constitution。
- 本 Unit 不迁移 `parkRouteNodes`，不修改 UI 结构或交互，仅补齐 Runtime 新事件对应的既有标签；不新增玩家 Cost、行为模式、场景卡组效果。
- 当前工作区的 `prototypes/gameplay-b/` 是未跟踪目录；不得清理、替换或重建目录。

### Allowed Files

- `prototypes/gameplay-b/src/model.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/src/view.ts`（仅补新路线事件标签）
- `prototypes/gameplay-b/tests/route-runtime.test.ts`

### Stop Conditions

沿用 `docs/ai/PROJECT-CONSTITUTION.md` 的六条停止条件；尤其新增其他 UI 结构或内容文件、需要超过 4 个白名单文件、或改变候选条件语义时停止并先修订范围。`view.ts` 限于新事件类型的日志标签，不改页面交互或结构。

### Completion Criteria

- [x] 显式图从指定 start node 开始，允许节点互指成环并按 `maxVisits` 限制目标访问。
- [x] 活动完成/战斗胜利后进入可选出口阶段；只投影条件成立且可访问目标的出口；有效选择后记录并进入目标。
- [x] 持有物 `has-item` 条件支持 `all` / `any` / `not` 组合；消费列表只在选边提交时生效。
- [x] 出口选择非法或持有物不足时无状态、随机游标、事件副作用；无出口时走声明的终态。
- [x] 原数组线性输入的现有路线测试仍通过；新增有向环、条件出口、物品消费、访问上限与无副作用测试。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/route-runtime.test.ts`，工作目录 `prototypes/gameplay-b` | 通过 |
| 类型检查 | `npm run typecheck`，工作目录 `prototypes/gameplay-b` | 无新增错误 |

### U1 Execution Receipt（2026-10-03）

- **实际修改：**`prototypes/gameplay-b/src/model.ts` 增加路线出口/持有物/访问次数投影与出口事件；`prototypes/gameplay-b/src/runtime.ts` 增加显式图输入、组合持有物条件、候选出口过滤、选边提交/物品消费、访问次数和无出口终态，同时保留旧数组顺序模式；`prototypes/gameplay-b/src/view.ts` 补齐事件类型标签；`prototypes/gameplay-b/tests/route-runtime.test.ts` 增加条件树、出口选择、原子消费、图回环/上限、战斗胜利后出点和非法图配置用例。
- **定向测试：**`npx vitest run tests/route-runtime.test.ts` — 通过，1 file / 10 tests。
- **类型检查：**`npm run typecheck` — 通过。
- **全量回归：**`npm test` — 通过，16 files / 139 tests。
- **独立构建：**`npm run build` — Vite production build 成功。
- **未完成：**新图 Runtime 尚未接入页面选择 UI 与游乐园主路线；按 P2–P4 后续切片继续。
- **设计状态：**U1 使用的是 Draft 中仍待用户裁定的候选规则；具体默认值可按用户反馈修订。

## Patch Unit 0205-U2：场景行为选择与路线 Cost

### Goal

为显式图活动节点提供 `individual` 与 `global` 两种场景行为选择，按整批校验并支付共享玩家 Cost；每次进场应用场景 Cost 收益，选出口时按本场景携带上限收敛。场景行为使用现有纯 `resolveActivity()` 检定/HP 结算，并允许配置成功后获得持有物。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `draft-0204-gameplay-b-map-and-player-actions.md`：场景行为、Cost 候选规则 | 选择/支付语义 |
| 源码 | `prototypes/gameplay-b/src/runtime.ts`：U1 图状态、`resolveActivityClick()` | 接入选择批次、Cost 状态与现有推进 |
| 源码 | `prototypes/gameplay-b/src/locations/activity.ts`：`resolveActivity()` | 复用已核验的纯活动检定/HP 解析 |
| 源码 | `prototypes/gameplay-b/src/model.ts`：U1 Route View/Event | 只读选择投影与事件类型 |
| 源码 | `prototypes/gameplay-b/src/view.ts`：Route event label | 为新增日志类型提供类型完备标签 |
| 测试 | `prototypes/gameplay-b/tests/route-runtime.test.ts` | 图与新场景交互行为回归 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 1 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆为选择/Cost 两 Unit；不扩展到 UI 交互或卡组 |

### Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Activity resolver 接受有序 party snapshot 与预先骰值，返回 HP delta、个人结果、事件和全队倒地判定。 | `prototypes/gameplay-b/src/locations/activity.ts`：`resolveActivity()`、`ActivityResolution` | U2 不改纯活动算法，可按所选角色/目标构建输入。 |
| U1 图节点已有 `activityCount`、Cost/出点尚未接入；活动处理函数只从节点固定 `activity` 取规则。 | `prototypes/gameplay-b/src/runtime.ts`：`GameplayBRouteNode`、`resolveActivityClick()` | 通过可选 `sceneChoices` 保留线性旧模式。 |

### Constraints

- 按 Task 采用候选规则；Cost 为路线级共享值，与角色 `sCost` 分离。
- 选择命令只修改待确认选择；确认前不扣资源、不掷骰、不写结果事件。
- 整批 Cost 不足或选择不完整时拒绝确认，保证 HP / 物品 / RNG / 活动批次均不推进。
- 不改 `locations/activity.ts` 的检定公式；不加入玩家主动卡（U3）；不迁移公园内容或 UI（U4）。

### Allowed Files

- `prototypes/gameplay-b/src/model.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/src/view.ts`（仅新增事件标签）
- `prototypes/gameplay-b/tests/route-runtime.test.ts`

### Stop Conditions

沿用 Constitution 六条停止条件；需改 `locations/activity.ts`、新增效果类型、UI 行为或增出白名单文件时停止并扩展范围。单 Unit 净改动保持约 300–500 行。

### Completion Criteria

- [ ] Individual 模式要求所有 HP>0 队员各选一个行为；Global 模式只要求一个行为并按 targetMode 校验目标。
- [ ] 行为预选可覆盖；选项次序稳定；确认后按固定名册/配置顺序结算并扣一个活动批次。
- [ ] 同批行为 Cost 汇总后一次支付；Cost 不足/漏选时无 HP、物品、RNG、批次或事件副作用。
- [ ] 场景入场 Cost 收益只在进入时应用；场景退出时按配置携带上限裁切并写事件；离场前在当前场景可使用新获得的 Cost。
- [ ] 行为可声明获得物品，个人/全局成功结果按内容规则入账；旧线性活动行为保持不变。
- [ ] 新增 Individual/Global、目标限制、Cost 原子拒绝/支付、离场封顶和物品结果定向测试通过。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/route-runtime.test.ts`，工作目录 `prototypes/gameplay-b` | 通过 |
| 类型检查 | `npm run typecheck`，工作目录 `prototypes/gameplay-b` | 无新增错误 |

### U2 Execution Receipt（2026-10-03）

- **实际修改：**`prototypes/gameplay-b/src/runtime.ts` 增加场景行为配置、逐角色/全局选择方法、选择投影、整批 Cost 预检/支付、成功物品奖励、入场 Cost 收益和离场上限收敛；`prototypes/gameplay-b/src/model.ts` 增加 Cost/场景选择投影与事件类型；`prototypes/gameplay-b/src/view.ts` 补充事件标签；`prototypes/gameplay-b/tests/route-runtime.test.ts` 覆盖 Individual/Global 模式、目标限制、选择覆盖、不完整/超费无副作用、物品奖励、Cost 进场、回访与离场封顶。
- **定向测试：**`npx vitest run tests/route-runtime.test.ts` — 通过，1 file / 14 tests。
- **类型检查：**`npm run typecheck` — 通过。
- **全量回归：**`npm test` — 通过，16 files / 144 tests。
- **独立构建：**`npm run build` — Vite production build 成功。
- **未完成：**当前仍由 Runtime API/只读投影承载；玩家选择 UI、牌组和游乐园图内容尚未接入。
- **设计状态：**行为费用按角色汇总、首次/每次入场资源规则等采用可修订候选语义，尚未收到逐项用户裁定。


## Patch Unit 0205-U3：有限玩家主动卡组

### Goal

让路线输入可声明一副固定有限卡组；Route Runtime 按 seed 洗牌，在开局与场景进入时抽牌，在场景行动批次中打出一张或多张卡。卡牌与行为费用共用玩家 Cost；效果可治疗目标角色、提高角色本批个人检定或获得持有物，已用卡不回到抽牌堆。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | draft-0204-gameplay-b-map-and-player-actions.md：玩家 Cost 与有限卡组候选规则 | 首期卡组边界 |
| 源码 | prototypes/gameplay-b/src/runtime.ts：U2 场景批次/Cost | 与场景行为同批校验和支付 |
| 源码 | prototypes/gameplay-b/src/model.ts：Route View 投影 | 手牌、抽牌堆、已用区展示 |
| 源码 | prototypes/gameplay-b/src/view.ts：路线事件标签 | 新抽牌/打牌事件完整呈现 |
| 测试 | prototypes/gameplay-b/tests/route-runtime.test.ts | 有限卡组 API 和原子性验证 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 1 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分 Runtime 状态与效果结算，不扩展到 UI/内容迁移 |

### Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 场景行为批次已经汇总 Cost、原子校验后扣费，并提供只读场景选择投影。 | prototypes/gameplay-b/src/runtime.ts：getSceneChoiceView()、resolveSceneChoiceClick() | 卡牌可加入同批扣费与解析。 |
| 持有物已在 Runtime 维护并可由出点条件消费。 | prototypes/gameplay-b/src/runtime.ts：heldItems、chooseExit() | 卡牌获得物品复用同一状态。 |
| Route View 为冻结投影，事件由连续 sequence/click 标识。 | prototypes/gameplay-b/src/model.ts：GameplayBRouteView、RouteEventRecord | 抽牌、打牌、效果需留可回放日志。 |

### Constraints

- 按固定有限牌组实施；每张物理卡使用唯一 ID，seed 洗牌；已用卡耗尽，不回洗。
- 开局按 openingHandSize 抽牌；每次后续场景进入按 drawPerNodeEntry 补牌，受 handLimit 限制；抽牌堆空后不再抽。
- 每批可选出 0 张或多张在手卡牌；行为费与牌费合并，批次确认时一次支付。不可负 Cost、过牌或重复打出同一实体卡。
- 首期卡牌只在带场景选择的活动场景使用；效果限治疗、提高指定目标个人检定和获得持有物；不改战斗行动、角色随机技能或 locations/activity.ts。
- 保留抽牌堆顺序、手牌、已用区、待打牌选择的唯一路线状态来源；View 只读。

### Allowed Files

- prototypes/gameplay-b/src/model.ts
- prototypes/gameplay-b/src/runtime.ts
- prototypes/gameplay-b/src/view.ts（仅新卡牌事件标签与检定加值结果呈现）
- prototypes/gameplay-b/tests/route-runtime.test.ts

### Stop Conditions

沿用 Constitution 六条停止条件；需增加效果种类、战斗使用时机、洗回/构筑规则或 UI 交互时先更新 Draft/Task 并扩充 Unit。净改动保持约 300–500 行。

### Completion Criteria

- [x] Route 输入验证有限卡组 ID、牌费、效果目标与抽牌/手牌参数。
- [x] 同 seed 得到同洗牌/抽牌序列；开局、每次节点进入按配置抽牌，手牌受上限约束。
- [x] 选择/取消路线卡可复核；同批牌费+行为费汇总，Cost 不足时 HP、物品、牌区、随机游标、行动批次和事件均不推进。
- [x] 确认后卡牌先结算、再结算行为；治疗、个人检定加值和物品效果进入 Route 状态/事件；牌移入已用区且不回洗。
- [x] 新增固定有限抽取、同批用卡/持有物门槛、治疗效果、空牌堆不补及费用不足无副作用测试。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/route-runtime.test.ts，工作目录 prototypes/gameplay-b | 通过 |
| 类型检查 | npm run typecheck，工作目录 prototypes/gameplay-b | 无新增错误 |

### U3 Execution Receipt（2026-10-03）

- **实际修改：**prototypes/gameplay-b/src/model.ts 声明有限卡组、卡牌效果与只读抽牌堆/手牌/已用区投影；prototypes/gameplay-b/src/runtime.ts 增加 seeded 洗牌、开局/入场抽牌、目标校验、场景批次同费支付、治疗/检定加值/获得物品效果及已用区；prototypes/gameplay-b/src/view.ts 显示新卡牌事件与检定原骰+加值；prototypes/gameplay-b/tests/route-runtime.test.ts 覆盖固定 seed 抽取、有限卡与不回洗、治疗/物品/检定加值、持有物捷径、费用不足原子拒绝和错误卡组。
- **定向测试：**npx vitest run tests/route-runtime.test.ts — 通过，1 file / 17 tests。
- **类型检查：**npm run typecheck — 通过。
- **全量回归：**npm test — 通过，16 files / 147 tests。
- **独立构建：**npm run build — Vite production build 成功。
- **未完成：**有限卡组和行为仍没有页面选择 UI；新游乐园图内容已另行建立，但主页面尚未切换到它。
- **设计状态：**卡牌仅在场景选择批次使用，沿用可修订候选规则；用户尚未对玩法边界逐项反馈。

## Patch Unit 0205-U4A：游乐园分区地图与事件内容

### Goal

用现有图 Runtime 配置一张延续游乐园巡查主题的 13 节点地图，覆盖地面园区/地下设备层、电玩馆—镜面迷宫回环、碰碰车战斗支线、持有物开启的地下通道、两种场景行为、玩家 Cost 与有限卡组。

### Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | draft-0204-gameplay-b-map-and-player-actions.md：游乐园地图样例方向 | 内容覆盖要求 |
| 源码 | prototypes/gameplay-b/src/runtime.ts：图节点、场景行为、Route 输入 | 内容配置契约 |
| 源码 | prototypes/gameplay-b/src/content/park-route.ts：parkInitialParty | 重用已存在初始队伍 |
| 源码 | prototypes/gameplay-b/src/content/enemies.ts：parkEncounters | 重用既有战斗遭遇 |
| 源码 | prototypes/gameplay-b/src/content/short-route.ts：chiseContent、reinaContent | 营地角色加入内容 |
| 测试 | prototypes/gameplay-b/tests/park-graph-route.test.ts | 新图结构和固定选择轨迹验证 |

### Constraints

- 只增加游乐园独立图内容和简单分区标签；不改既有 parkRouteNodes/park-demo 回放。
- Scene card/effect 使用 U1–U3 Runtime 已支持的字段，不创建文案隐式效果。
- 各非终止节点有无条件兜底出口、有限 maxVisits 和明确 no-exit 收束文本。
- 本 Unit 不接主页面、不写 CSS；地图内容展示由 U4B 负责。

### Allowed Files

- prototypes/gameplay-b/src/runtime.ts（仅新增可选 area 内容字段与投影）
- prototypes/gameplay-b/src/content/park-graph-route.ts
- prototypes/gameplay-b/tests/park-graph-route.test.ts

### Completion Criteria

- [x] 新内容包含 13 个场所节点，按地面园区/地下设备层分区。
- [x] 图包含 service → arcade/aid 分支、arcade ↔ maze 回环、maze → bumper fight 支线、ferris → pass/radio gated control room 快捷路及后台兜底。
- [x] 地图至少覆盖 Individual 与 Global 场景；事件选择含 HP/检定/持有物变化。
- [x] 节点 Cost、离场上限、maxVisits、卡组与角色加入均使用 Runtime 配置。
- [x] 定向内容测试能构造 Route Runtime、复现固定动作轨迹并核对分支/回环/区域。

### U4A Execution Receipt（2026-10-03）

- **实际修改：**prototypes/gameplay-b/src/content/park-graph-route.ts 新增地面/地下设备层 13 节点分支图、模式各异的场景行动、物品门槛与消费、Cost/携带上限和 8 张有限卡组；prototypes/gameplay-b/src/runtime.ts 投影可选 area 标签；prototypes/gameplay-b/tests/park-graph-route.test.ts 核验地图分区、回环、持有物门槛与固定服务亭—电玩馆行动轨迹。
- **定向测试：**npx vitest run tests/park-graph-route.test.ts — 通过，1 file / 2 tests。
- **类型检查：**npm run typecheck — 通过。
- **未完成：**页面尚未消费 area 标签、场景模式、手牌和出点列表；U4B 接入 UI。

## Patch Unit 0205-U4B：地图、场景选择与卡组 UI

### Goal

把 graph route API 接到独立玩法 B 页面：地图按区域/楼层显示，当前可走出口可选择；场景按 Individual/Global 模式显示行为选择；路线卡、Cost、物品与行动批次费用可见。主入口切换到新游乐园图，保留战斗行动编辑与线性路线内容/测试兼容。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 技能 | frontend-design 与 docs/ai/frontend-design-project-overlay.md | 设计方向、DOM budget、刷新和交互连续性 |
| 源码 | prototypes/gameplay-b/src/view.ts：mountRouteGameView、update、updateAdvanceAvailability | 现有稳定 UI owner、日志、预览与 battle edit flow |
| 源码 | prototypes/gameplay-b/src/main.ts | Runtime API 的 UI 命令分派与新主入口 |
| 源码 | prototypes/gameplay-b/src/content/park-graph-route.ts | 新地图、area、行为和玩家卡配置 |
| 样式 | prototypes/gameplay-b/src/style.css：desk、location、activity、player-edit | 沿用调色/字体/交互控件与断点 |

### 设计方向

- **视觉基线：**保留现有巡查值勤台调色与字体 token（雾绿、纸白、票券黄、砖红；系统中文字体与等宽状态字），不重做三栏架构。
- **页面工作：**让玩家看清当前所在区域、Cost/物品/手牌，按场景类型做选择，场景完成后选一个可用出点。
- **版式草图：**

    左队伍卡          中央巡查台                                  右遭遇/敌方
                      场所名 + 地面/地下标记
                      园区图：区域分组 / 当前点 / 到访次数
                      Cost / 持有物 / 抽牌堆
                      场景选择：逐角色各选 / 全局单选 / 手牌出牌
                      可走出口（仅场景完成后显示）
                      事件日志（保持既有独立滚动）
                      Click 确认批次                    右敌方队伍/战斗状态

- **签名元素：**地图采用游园巡查线路牌样式；同一组稳定地点标记跨场景更新“当前/到访”，具体分支只在完成场景时突出显示，地面与设备层以地点分区标题区分。

### DOM budget

- 新增 1 个地图导航 region（含 2 个区域组和每个地点 1 个稳定标记，当前配置共 13 个）。
- 新增 1 个地图资源摘要节点；复用标题、场所描述、当前行为卡与事件日志。
- 新增 1 个场景选择 region：Individual 最多 6 个稳定角色选择控件；Global 复用一组行为/目标控件；卡手最多 4 张卡控件，每张有目标效果的卡提供目标选择器。
- 新增 1 个出口选项 region，每个可用出口 1 个按钮，当前内容最多 3 项。
- 复用现有 eventList、eventScroll、party card、battle preview/edit panel、advanceButton；不新增全页 wrapper 或每次选择重建的 UI 树。
- behavior patch：Cost、选择、按钮 pressed/disabled、当前地点/访问次数、items 和手牌摘要。
- region patch：只有节点定义或手牌实体集合变化时更新 scene selection contents；只有完成/离开场景时更新出口选项组。
- full render：仅初次 mount；普通选择、抽牌、Cost 变化和 Click 结算均不 full render。

### Interaction preservation

- 路线日志与战斗预览滚动互不联动；追加事件沿用当前贴底跟随、上滚阅读锚点保持。
- 行为选择和选卡更新原有控件 selected 状态；控件结构签名不变时保留 focus/hover 与 DOM identity。
- 选出口后把焦点移至稳定地图中的新当前地点标记；不带动日志或页面滚动。
- 节点列表标记始终稳定；出点和当前路线变化只改 class/text/hidden，必要时局部更新出口 region。

### Allowed Files

- prototypes/gameplay-b/src/view.ts
- prototypes/gameplay-b/src/main.ts
- prototypes/gameplay-b/src/style.css

### Stop Conditions

沿用 Constitution 六条停止条件；新增稳定 UI owner、卡牌新效果、Runtime 新字段、编辑器集成或需修改测试文件时，先扩充 Unit。必须保留现有 battle edit/drag/focus/scroll 行为。

### Completion Criteria

- [x] 主入口加载 parkGraphRouteInput；新局从固定 seed / 西门开始，原 park route 校验/数据仍由原文件和测试覆盖。
- [x] 地面园区和地下设备层显示为同一地图图的分区；current / visit counts / 分支出点来自 Runtime View。
- [x] Cost、物品名、手牌/抽牌堆/已用卡、行为费和卡费可见；有目标效果的主动卡可指定角色。
- [x] Individual 模式每名可行动角色各选一个行为；Global 模式只选一个行为；玩家卡可选/取消；确认按 ready/affordable gating。
- [x] 场景完成后显示 Runtime 当前可用出口并可进入目标节点。
- [x] 玩家选择/普通 Click 不重建稳定场景选择控件或地图节点；日志向上滚动后结算追加事件仍保留阅读位置；选出口后键盘焦点移至新当前节点标记。
- [x] 现有普通战斗行动卡、技能预览和战斗 Click 保持可用；整卡拖拽/目标更改行为由 [[task-0205-gameplay-b-whole-card-drag-and-target-choice]] 覆盖，本 Task 浏览器确认路线进入 Boss 战并结算一轮。
- [x] 浏览器实走游园服务亭分支、电玩馆—镜面迷宫回环与回访上限、持有物开放地下捷径与无凭证后台兜底、卡牌/行为共费、离场 Cost 上限及设备井战斗 Click。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 测试 | npm test，工作目录 prototypes/gameplay-b | 全部通过 |
| 类型检查 | npm run typecheck，工作目录 prototypes/gameplay-b | 无新增错误 |
| 构建 | npm run build，工作目录 prototypes/gameplay-b | Vite build 成功 |
| 浏览器 | 新主入口 1280×720，并检查 1024px 窄屏 | 分支游玩、焦点/滚动/战斗交互连续 |

## 当前核验（2026-10-03）

- `git status --short -- prototypes/gameplay-b`：目录显示未跟踪；没有执行写入、清理或恢复操作。
- 源码入口核对并实施 U1–U3：`runtime.ts`、`model.ts`、`view.ts` 与 `route-runtime.test.ts`；当前定向 17/17、全量 147/147、typecheck 与 Vite build 均通过。

### U4B Execution Receipt（2026-10-03）

- **实际修改：**`prototypes/gameplay-b/src/main.ts` 切换到 `parkGraphRouteInput` 并分派场景选择、卡牌和出点命令；`prototypes/gameplay-b/src/view.ts` 加入分区地图、到访标记、Cost/持有物/牌区摘要、Individual/Global 选择控件、主动卡目标选择与可用出口按钮；`prototypes/gameplay-b/src/style.css` 延续原雾绿/票券纸面视觉并加入紧凑地图与选择样式。原战斗编辑组件和旧路线内容文件保留。
- **浏览器实走：**本地 `127.0.0.1:5174` 确认固定 seed 从西门开始；选择广播联络卡与全局行动后一次性扣 1 Cost、获得员工广播持有物；完成场景仅显示开放出口；选择连廊、服务亭分支并进入代币电玩馆；验证逐角色四个下拉选择都能写入并令确认按钮可用；重载后验证紧急照明卡可以将作用目标从小栞改选为由理并被选入批次。过程中看到区域分组、到访数、Cost、物品、手牌/抽牌堆/已用牌显示更新。
- **后续浏览器实走：**回环路线记录电玩馆第二次访问与离场 Cost 从 7 按上限收敛至 5；迷宫完成后只显示未达访问上限的出口。持有维修通行证和员工广播时，摩天轮检修廊出现“进入地下设备层”捷径；控制室列出凭维修通行证/广播两种门，选择通行证路线后日志记录消费 `maintenance-pass` 并进入中央舞台设备井。Boss 页面显示冻结战斗预览，第一次 Click 结算后进入第 2 轮。另一局未持维修凭证，从服务亭选择急救补给站并进入检修廊；持有“急救补给包”仍只显示后台兜底出口。
- **交互连续性：**对路线日志向上滚动后确认场景批次并追加新事件，截图仍停留在记录 01；行为选项更新不替换其选择控件；选择出口后焦点落到新的地图当前节点标记。
- **响应式：**1280×720 三栏首屏与 1024×768 两栏/敌方下排布局浏览器检查通过；1024 下三栏压缩问题已通过把中屏断点从 1020px 提至 1100px 修正。
- **构建：**`npm run build` — Vite production build 成功。
- **类型检查：**`npm run typecheck` — 通过。
- **全量测试：**`npm test` — 通过，17 files / 152 tests。此前短暂出现的两项失败在当前文件状态下不再复现。
- **独立构建：**`npm run build` — Vite production build 成功。
- **文档检查：**根 `npm run check:docs` — 574 篇 Markdown，0 errors。
- **终态核验：**玩法 B 原型全量 17 个测试文件 / 152 项通过；typecheck 与 Vite build 成功；根文档检查扫描 574 篇 Markdown、0 errors。验收符合 Draft 的用户裁定边界；循环受有限访问次数约束，首版出口条件只查持有物，楼层作为同一图的区域分组。Task 完成，可归档。

## 剩余工作

- 本 Task 内：无剩余工作。
- 最终方向外剩余：战斗内玩家卡、可编辑牌组构筑、复杂任务目标/脚本、随机地图生成、角色 Cost 主动技能，均不在本 Task。

## 相关路由

- `draft-0204-gameplay-b-map-and-player-actions`
- `docs/ai/PROJECT-CONSTITUTION`
- `docs/ai/task-read-set-routing`
