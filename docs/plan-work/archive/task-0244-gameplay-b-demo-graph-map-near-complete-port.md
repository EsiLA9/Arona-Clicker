# Task 0244：Gameplay B Demo 十三地点图移植与 Operation 接线

状态：completed — 13 地点地图、默认试玩包、Office 入口、全图只读呈现与经典 Operation 战斗均已接通，并完成无浏览器虚拟回放与回归检查。

## 目标

把原型 Gameplay B Demo 的实际入口地图 `parkGraphRouteInput` 近完整移植并接入 AC Operation：地点、区域、图拓扑、分支/回环、物品门、地点访问上限、各地点的活动/遭遇关联，以及玩家看到的全图状态都能对应到原型。样例必须能从游戏内清楚的地图试玩入口启动，并包含使用当前 Operation 战斗回合/角色行动牌/目标/对手行动结算的经典战斗地点，可供手动或 headless 测试；不得只注册不可启动的地图数据，或把战斗地点改成现场 SceneAction。

这是一项地图移植，不以复制地点名称或保留现有 12 点成功路线作为完成标准。完整 Operation 样例还需提供可复现的无浏览器虚拟游玩记录。

## 原型事实与范围裁定

Gameplay B 原型有两份不同的园区路线：

- `prototypes/gameplay-b/src/content/park-route.ts` 是 README 所列的 12 地点线性主路线；它有完整的胜利回放测试。
- 原型实际入口 `prototypes/gameplay-b/src/main.ts` 创建的是 `parkGraphRouteInput`，由 `prototypes/gameplay-b/src/content/park-graph-route.ts` 定义，是 13 地点、含环路与地下控制室的图。`park-graph-route.test.ts` 只覆盖配置和到电玩馆的部分游玩，没有完整通关回放。

本 Task 以**实际入口的 13 地点图**为地图基线。12 地点路线仅作原型历史内容参考；不得将旧线性路线的测试/浏览器记录误称为 13 地点图的完整实测。

AC 当前 `gameplay-b-strategy-park` 是独立策略/抽卡验证实例：它有对应的 12 个地点和 3 场战斗，但路线较线性，缺地下控制室；镜面迷宫没有原图四向分支；电玩馆、摩天轮地点行为也被重新设计。原策略池、角色 Hand 与三场现有战斗样例是该实例的验证目的，移植时须保留这些覆盖并清楚标出与原型战斗内容的差异。

## 目标图基线

地点及主要行为来自 `park-graph-route.ts`；边的可达性、物品条件、访问上限和场所交互次数属于地图验收对象。

| 节点 | 地点 | 地图行为摘要 |
| --- | --- | --- |
| node-1 | 西门临时执勤点 | 全队领取巡查任务或检查装备；唯一出口至连廊；最多访问 1 次。 |
| node-2 | 林荫连廊 | 追踪轮迹或联系服务亭；两次场所活动；随后至服务亭；最多 1 次。 |
| node-3 | 游园服务亭 | 全队休整或获得员工广播凭证；分流至电玩馆或急救站；最多访问 2 次。 |
| node-4 | 代币电玩馆 | 每名队员调查维修抽屉或控制台；可取得维修通行证；可去镜面迷宫或回服务亭；最多 2 次。 |
| node-5 | 失控碰碰车区 | 可选战斗；胜利后至急救站；最多 1 次。 |
| node-6 | 急救补给站 | 急救或整理补给；原型在此招募千世并为下一场战斗提供初始 sCost 加成；至摩天轮检修廊；最多 1 次。 |
| node-7 | 镜面迷宫 | 每名队员跟随标记或搜索侧廊；可回电玩馆、去碰碰车/急救站/摩天轮；最多 2 次。 |
| node-8 | 摩天轮检修廊 | 每名队员检查面板或寻找员工入口；可无条件去后台，或持维修通行证/员工广播之一进入控制室；最多 2 次。 |
| node-9 | 烟花排练广场 | 战斗；胜利后进入舞台设备井；最多 1 次。 |
| node-10 | 后台休息室 | 全队休整或检查道具；原型在此招募玲奈并为后续 Boss 战提供回复加成；进入烟花排练广场；最多 1 次。 |
| node-11 | 中央舞台设备井 | Boss 战；胜利后前往东出口；最多 1 次。 |
| node-12 | 东出口交接处 | 路线终点，完成交接；最多 1 次。 |
| node-13 | 地下设备层控制室 | 复位电源或登记记录；可返回摩天轮，或使用并消费维修通行证/员工广播之一进入 Boss；最多 2 次。 |

| 起点 | 目标 | 原型边语义 |
| --- | --- | --- |
| 1 | 2 | 西门 → 林荫连廊 |
| 2 | 3 | 连廊 → 服务亭 |
| 3 | 4 / 6 | 服务亭分流至电玩馆或急救站 |
| 4 | 7 / 3 | 电玩馆至迷宫，或返回服务亭 |
| 7 | 4 / 5 / 6 / 8 | 迷宫的四向路线 |
| 5 | 6 | 碰碰车战后至急救站 |
| 6 | 8 | 急救站至摩天轮检修廊 |
| 8 | 10 / 13 | 8→10 无门槛；8→13 要求维修通行证或员工广播之一，不在此边消费凭证 |
| 10 | 9 | 后台休息室 → 烟花排练广场 |
| 9 | 11 | 烟花排练广场 → Boss |
| 13 | 8 / 11 | 13→8 无门槛；13→11 分别有维修证/员工广播路线，选择时消费对应凭证 |
| 11 | 12 | Boss → 东出口 |

区域为“地面园区”（node-1 至 node-10、node-12）与“地下设备层”（node-13、node-11）。回环受每节点 `maxVisits` 约束，不能只用一个 Event 总访问上限代替每地点上限。

## AC 现状核查

- AC 的 `gameplay-b-strategy-park.ts` 有 12 个 OperationLocation，已有角色策略、Hand、路线费用、3 场战斗、关键凭证与头尾交接的独立数据样例。
- AC 地图目前没有 node-13；node-4→node-7 / 返回 node-3、node-7 四路选择、node-8→node-13 条件边和 node-13 分流均不完整。没有逐 Location 的访问上限、区域字段、全图 OperationView 投影或地点专属的无可用出口反馈。
- `OperationRouteEdgeDef` 只表达单个 `requiredHeldItemId` 与可选消费；原图 node-8→node-13 是二选一凭证 Gate。Operation Event 只有总访问上限，没有原图逐 Location 的 `maxVisits`。
- Operation Location 可用 `actionMode`、`sceneActionBatches`、`sceneActions` 表达地点互动范围与批次；现有 Operation Action 可表达固定效果、Item、Fact、Track、HP 等。但没有原型式 ATK/DEF 六面骰检定 DSL、动态角色入队、下一战临时修饰、检定加值场景卡或节点 `noAvailableExitText` 合同。
- 原型地图由 `view.ts` 画出全节点/边，并强调当前开放出口可选；AC OperationView 只投影当前地点、访问状态与当前位置出口，Operation Workspace 没有全图展示。

## 施工范围

1. 扩展当前独立 `gameplay-b-strategy-park` Operation 样例，使目标地图包含以上全部 13 个地点、区域、边、Gate 与访问上限；原 Event ID 与 Strategy/Hand 验证不能因新地点而丢失。三处战斗节点保留为真正的 Operation 战斗，并能在 UI 中操作和结算。
2. 增加最小、封闭的 Operation 路线表达，使二选一凭证门、每节点访问上限、凭证消费和“无可用出口”的地点语义均能在 Registry 校验、Runtime 路线查询/转场、Run/Resume 与 OperationView 中一致表达。优先复用既有 `locationProgress.visitCount`；不新增任意脚本条件 DSL。
3. 在 OperationView 暴露只读的完整地点/边/区域图投影，并在 Operation Workspace 展示全图及当前/已访问/未访问/开放出口状态。地图节点是展示锚点；路线仍通过当前地点的命令入口选择，UI 不直接写 Runtime 状态。
4. 将原型地点的互动选择与胜利战斗在 AC Operation 合同中建立地点级对应，保留 `activityCount` / global/individual 互动的关键结构、节点成本与关键凭证来源。无法使用现有 Operation 合同表达的原型机制须显式标为差异，不能通过地点名称对齐冒充规则一致。
5. 把地图样例与应用/试玩入口接通：Datapack/Registry 在对应试玩模式可用，用户能从游戏内入口启动该 Event 并进入 Operation Workspace；入口与 13 地点全图状态可辨认。不得只依靠测试手工注入 Registry 才能启动。
6. 提供无浏览器的确定性虚拟游玩入口和可审阅 transcript；覆盖完整可完成路线、node-5 可选经典战斗、node-8 的双凭证 Gate、node-13 回摩天轮、两种分别消费凭证的 Boss 入口、迷宫/电玩馆回访、访问上限以及 node-9 / node-11 经典战斗。至少一项 UI/Runtime 行为验证需实际启动地图并提交战斗 Beat，证明这是战斗场景而非静态图。

## 明确不在本 Task

- 不改正式 `gameplay-b@1.0.0` 旋转木马安全行动及其一次性战斗拓扑。
- 不复制 Gameplay B 原型的完整战斗 AI、敌人逐轮意图、角色招募与队伍增员、下一战 sCost/回复修饰、骰点属性检定算法、技能配方与检定加值玩家卡；这些机制当前 AC Operation 尚未提供完整等价合同，应该单独立项，不伪称地图 Task 已移植。地图中的战斗节点仍需有真实 AC Operation 战斗内容，并复用已有经典战斗回合机制。
- 不施工 Datapack/Schema Editor，不要求浏览器验收，不引入通用世界模拟或任意路线脚本。

## 文本—待裁定与潜在解决方案

| 缺口 | 地图层面影响 | 本 Task 的处理方向 |
| --- | --- | --- |
| `any(pass, radio)` Gate 当前不能被单一 `requiredHeldItemId` 精确表达 | 若拆成两条同终点路线，会在地图上重复显示出口，且与原图一个 Gate 两种凭证语义不同 | 增加有限 `anyOfHeldItemIds` 路线字段并做 Registry 校验；不扩展任意 AND/OR/NOT DSL。若实现审查发现更稳妥方案，在 Unit 文档记录并保持单个可视 Gate。 |
| 原型每地点 `maxVisits` 当前只有 Event 总访问预算 | 回环及回访限制无法按原图重现 | 在 Location 声明上限，转场按目标地点 `visitCount` 限制，并投影锁定原因；Resume 校验同一限制。 |
| 全图 area/边与地点专属无路可走反馈没有 OperationView 表达 | 玩家只能看当前路线卡，无法核对完整地图或理解已封锁节点 | Location 声明稳定 `areaId`，OperationView 提供只读图数据；无路可走时使用节点定义文案说明结局/接管原因。 |
| Dice checks、动态招募与下一战 modifier 缺少 AC 等价规则 | 可以还原路线，但不能声称整套原型玩法已复刻 | 本 Task 保持“地图移植”边界，使用 AC Action/SceneAction 的等价可玩内容；未移植的玩法机制列为后续差异，不在此新增大范围 Runtime 子系统。 |

## 验收

- Operation 注册内容精确包含 13 个地点和两大区域；每个地点的命名、主要互动/遭遇和对外边与源表有映射记录。
- 所有源图边和条件可从 OperationView 检查；总访问预算不能替代单点访问限制；凭证 Gate 不重复渲染成两个出口；选择控制室 Boss 路线只消费对应凭证。
- 地图可视化包含全图节点及路线；当前点、已访问点、未访问点、被 Gate/访问上限锁定的出口可辨认；只有当前开放路线能由玩家提交。
- 用户可从游戏内试玩入口启动此 13 地点 Event；进入 node-5 / node-9 / node-11 时，能看到 Operation 行动牌与对手行动计划，并至少完成一轮真实战斗结算。
- headless 测试逐边/逐 Gate 覆盖地图；至少有不经控制室的标准路线、凭证进入地下控制室路线、radio 与 maintenance-pass 两条控制室 Boss 路线，以及回访上限与可选碰碰车战测试。
- headless transcript 显示路线决策、获得/消费凭证、位置访问计数、各场景行动和最终结果；相同 seed 可重复。
- 原型规则差异（固定三人阵容、无动态招募、无下一战修改器、无属性骰点等）在映射表中列明，不计作本 Task 已完成的 Demo gameplay parity。
- Operation Contract/Runtime/View 与现有 Carousel/Strategy Hand 行为回归通过；类型检查、相关架构检查（如适用）、diff 检查与 GALHCG 精确路径复核通过。不得声称做过浏览器验收。

## 实施结果

- Strategy Park 现在是默认启用的 `gameplay-b-strategy-park@1.0.0` bundled pack；Office Operation 入口按 Event ID 区分 Carousel 与策略园试玩，支持各自启动/恢复，仍使用固定 Hoshino / Serika / Shiroko roster。
- AC Operation 数据已覆盖 13 个地点和 20 条路线：电玩馆/迷宫回访、可选碰碰车战、四向迷宫、摩天轮「维修通行证或员工广播凭证」单出口、控制室回环、两种分别消费凭证的 Boss 路线，以及逐地点访问上限。没有新增任意路线 DSL；区域、地点标签/位置、行动文案和接管提示放在策略园展示 sidecar。
- `OperationView.map` 只读投影完整节点和路线；仅当前地点出边标记可用/锁定，其余边保持未评估。Operation Workspace 显示地面园区和地下设备层全图，实际路线仍使用现有 `transitionRoute` 命令。修复了 Workspace DOM morph 对 SVG 元素跳过属性更新的问题，使当前出口颜色/状态随 Operation region 更新。
- 碰碰车、烟花广场和舞台设备井继续使用真实 Operation 战斗回合、角色 Hand/行动牌、对手行动计划和结算，未替换为 SceneAction。官方试玩可从办公室进入策略园起点。
- 行为差异仍如本 Task 范围声明：没有移植原型动态招募、下一战临时加成、属性骰点/技能配方或完整敌方 AI。
- 无浏览器确定性回放 seed `241024`：主线胜利通过碰碰车 / 烟花 / Boss，分别结算 3 / 3 / 4 Beat；两条控制室支线分别验证维修通行证与员工广播凭证的消费、经摩天轮回环再入控制室。三条路线重复回放一致。
- 验收记录：`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 通过；策略园 sample/virtual-play、OperationView projector、bundle wiring、Office controller 与 Strategy Park map UI 定向 Vitest 通过；`git diff --check` 无空白错误。没有进行浏览器验收。

## 完成的施工 Units

1. `U1 — Operation map route semantics`：有限 OR-item route gate、per-location visit cap、blocked-route outcome 文案与 Registry/Runtime/Save-Resume/OperationView 行为测试。
2. `U2 — 13-location Strategy Park graph and classic battles`：Area/位置/互动/遭遇映射、13 点完整边图与三处可玩的 Operation 战斗，保留策略抽卡验证身份。
3. `U3 — Map UI entry, projection and virtual traversal`：接通可启动的试玩入口、只读地图表现、current/visited/locked states、全路径 headless replay/transcript 及原型差异映射。

## 调查依据

- 原型入口与地图：`prototypes/gameplay-b/src/main.ts`、`prototypes/gameplay-b/src/content/park-graph-route.ts`、`prototypes/gameplay-b/src/runtime.ts`、`prototypes/gameplay-b/src/view.ts`。
- 原型另一份线性图与文档：`prototypes/gameplay-b/src/content/park-route.ts`、`prototypes/gameplay-b/README.md`。
- 原型测试边界：`prototypes/gameplay-b/tests/park-graph-route.test.ts`、`prototypes/gameplay-b/tests/park-demo.test.ts`。
- AC 数据/流程/测试：`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`src/arona-clicker/contracts/operation.ts`、`src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/services/operation-route-evaluator.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/ui/components/operation-workspace.ts`、`tests/engine/gameplay-b-strategy-park-sample.test.ts`、`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`。
- [[archive/task-0241-gameplay-b-strategy-pools-and-interaction-context]]：已完成策略/Hand 技术 Task 与当前独立 Strategy Park 样例的历史实现边界；不是原型地图等价证明。
