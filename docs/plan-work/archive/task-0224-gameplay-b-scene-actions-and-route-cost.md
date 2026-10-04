# Task 0224 — 玩法 B 场景行为与路线 Cost

状态：completed — Individual/Global 场景批次、共享 PlayerCost 与原子路线衔接已实现；Task 0225 的卡牌支付与区域迁移也已在同一批次闭环验收。

## 目标

让 Operation Location 能按内容选择逐人或全局场景行为，并以 EventRun 持有路线级共享 PlayerCost。建立一次原子费用/Resolution 入口，供 Task 0225 的玩家场景卡接入同一批次。

## Why

场景选择要让玩家决定谁处理什么，或以一项行为影响指定目标；共享 Cost 需要在整批提交时一次结算，避免部分角色已行动后才发现资源不足。路线 Cost 与角色和战斗资源分开，使跨地点取舍可预测。

## Scope

- 为场景处置定义 actionMode：individual 或 global。选择属于非战斗 SceneAction 批次，不受战斗 Beat 的 Sensei 单人干预额度限制。
- 每个非战斗 Location 配置有限的 SceneAction 批次数；一次有效批次只消耗一个额度，额度用尽后按 Task 0217 的目标/地点终止规则完成地点。地点访问上限由 Task 0218 约束，避免回环无限重复获得批次。
- Individual：玩家对每名在场且可行动的角色分别选一种场景行为。Global：玩家只选一项场景行为，并按该行为的合法目标范围作用于一名、多人或全队。
- `SceneActionDef` 是薄包装：`id`、`actionId`、`scope`、`playerCost`。目标、资格条件和效果只在被引用的 `OperationActionDef` 中定义；SceneAction 不复制第二份 Action 规则。
- 场景行为选择先形成待提交批次；同批卡牌通过当前手牌 `cardInstanceId` 接入。Runtime 从已验证的 SceneActionDef / PlayerSceneCardDef 读取 PlayerCost，并与行为费用汇总校验、扣除一次；命令不得接收调用方任意指定的费用数值或效果。Task 0225 将牌组实例接入同一费用与 Resolution 边界。
- 接入 Task 0215 的唯一 Resolution 容器与统一 Runtime 提交边界；不另建场景专用结算或费用扣除流程。
- 在 EventRun 中维护路线级共享 PlayerCost，与学生 HP、角色局部资源及战斗 Beat 资源分开。新 EventRun 使用事件配置的起始余额，缺省为 0；不从 PlayerState 读取或写回。
- Location 可配置每次进入的 costGain 与成功离开时的 maxCarryCost。每次访问最多应用一次 costGain；成功离开时将余额限制为 min(当前余额, maxCarryCost)，再进入下一地点并应用其 costGain。
- Cost 变化作为 Task 0218 唯一 `transitionRoute(routeId)` 提交路径的一部分；本 Task 不新增另一条自动/手动转场路径。出口预览、无效/过期选择、Event 终止或转场任一步失败都不改变 Cost。持有物门槛、出口图与回环访问上限仍由 Task 0218 负责。
- 提供只读投影所需的 actionMode、合法行为与目标、批次费用明细、Cost 余额及离场上限；正式 UI 端到端验收由 Task 0222 覆盖。

## Non-goals

- 不改变 Task 0215 的战斗 Beat、Sensei 干预次数或战斗资源规则；场景卡不能用于战斗 Beat。
- 不在本 Task 定义有限卡组、抽牌区或卡牌效果；由 Task 0225 提供卡牌输入并复用此批次费用与结算边界。
- 不实现玩家持有物条件、出口消耗或路线环；这些由 Task 0218 定义。
- 不新增角色消耗 PlayerCost 的主动技能，不把 PlayerCost 存入 PlayerState 或 InitSnapshot。

## Gameplay UI Deferred Scope

- 本 Task 允许定义并施工 SceneActionSelection、individual/global 批次、费用汇总、命令与只读投影；这些是服务/API 合同，不授权实现玩家侧选择界面。
- 不把逐人选择做成独立多栏计划列表，也不把选择、Cost 或确认按钮嵌入聊天消息。角色卡及信息流的正式布局/输入由 Task 0222 决定。
- 本 Task 只用 Runtime/Projection 测试验证服务行为；浏览器交互验收延后至 Task 0222。

## 设计依据与 AC 现状边界

- Individual / Global、共用玩家 Cost、逐场景 costGain 与离场 maxCarryCost 是 Draft 0204 已确认的玩法输入。
- Task 0215 将统一 Resolution 作为 AC 玩法设计目标；Task 0218 将路线选择定义为独立于战斗 Beat 的事件命令。这些是 proposed 设计契约，不代表当前源码已有对应接口。
- Task 0213–0218 的实际 Runtime 接口与状态 owner 须在施工时按当时源码和测试核对；本 Task 不预设 TypeScript 文件位置或签名。

## Data / API

- Location 声明 actionMode、可用 `SceneActionDef`、每次访问的有限批次数、costGain 与 maxCarryCost；SceneActionDef 只引用 `OperationActionDef` 并声明 PlayerCost。
- EventRun 持有 PlayerCost 余额与按访问区分的入场收益记录。
- SceneActionBatch 汇总逐人/全局行为选择及被选玩家卡的 `cardInstanceId`；费用和效果都从已验证内容定义读取，调用方不能注入任意费用/效果。整批形成单一 PlayerCost 总额。Task 0225 将卡牌实例接入。
- Resolution 记录已校验的行为、卡牌效果、PlayerCost 扣除及局部结果；结果容器沿用 Task 0215 当前 Runtime 契约。
- EventRun 的起始 PlayerCost 与本 Event 的安全值域来自事件输入，起始余额缺省 0；本 Task 可先由 TypeScript/fixture 定义验证规则。Task 0220 随后把该声明正规化为 Datapack 字段并冻结作者内容硬上限，因此 Task 0224 不等待 Task 0220 才能实现。

## Runtime Flow

进入 Location 时由 Task 0218 的统一转场提交应用一次 costGain → 在剩余批次额度内按 actionMode 形成 SceneActionBatch → 汇总被引用 ActionDef 与当前手牌卡牌的费用并整体校验 → 拒绝时 Run、额度、随机游标、Cost 和卡牌状态不变；接受时一次扣费、应用局部效果、递减一个批次额度并追加一个 Resolution → 达成地点目标或额度用尽后计算出口 → 自动或显式选择都调用 `transitionRoute(routeId)`；该入口先将 maxCarryCost 与新地点 costGain 一并纳入新 Run，再原子提交。

## Acceptance

- [x] Individual 批次要求玩家对每名在场且可行动角色分别选一种合法场景行为；漏选、重复选人或非法目标均阻止提交。失去行动资格的角色不需要选择。
- [x] 每个 Location 访问的 SceneAction 批次数有显式有限值；有效提交恰好减少一次，拒绝/无效命令不消耗额度，达到目标或额度上限后进入地点完成/出口判断。
- [x] Global 批次只包含一项场景行为；ActionDef 目标关系可限定单人、多目标或同队集合中的目标，目标超出范围时拒绝整批。
- [x] SceneAction 批次不消耗、不占用也不受战斗 Beat 的单人 Sensei 干预额度限制；战斗 Beat 仍沿 Task 0215 原规则处理。
- [x] 一批内所选 SceneAction 和玩家卡的费用只从已验证的定义读取并合并为一个总额；不接受调用方传入任意费用。余额不足时整批原子拒绝，不扣费、不应用部分效果、不改变输入状态、不推进随机流或场景行动次数。
- [x] 合法提交只扣 PlayerCost 一次，并通过统一 Resolution 记录该批行为及所有可观察变化；同一批次不能重复提交造成二次扣费或重复效果。
- [x] SceneActionDef 与 PlayerSceneCardDef 均只引用 OperationActionDef；费用由被引用的薄包装提供，效果/目标只来自 OperationActionDef，命令不能注入任意费用或效果。
- [x] SceneAction 与战斗资源分别读写；场景卡不进入战斗。
- [x] 每次 Location 访问的 costGain 恰好应用一次，并以 `locationEntryCostHistory` 记录；允许回访时每个新访问再次发放。
- [x] maxCarryCost 只在成功离开 Location 时应用，单出口自动转场与显式路线选择结果一致；下一地点的 costGain 在离场上限生效后应用。
- [x] 单出口自动转场与多出口显式选择均通过 Task 0218 的 `transitionRoute(routeId)`；Cost 截断、地点切换、下一地点 costGain 和入场抽牌一次计算并提交，任一步失败时整份 EventRun 不变化。
- [x] 出口预览、过期出口、无效选择和 Event 终止不会提前截断余额或产生战术 Resolution。
- [x] 固定 Seed 与相同输入得到相同费用、场景结果及 Resolution 顺序；场景费用失败不会消耗战术 RNG。

## Tests

- **Unit：**actionMode 输入完整性、个人与全局目标资格、有限批次数、费用汇总和离场上限。
- **Runtime：**余额不足时的拒绝原子性、一次提交一次扣费/Resolution/批次递减、costGain 的访问幂等、离场上限与下一地点入场顺序。
- **Integration：**SceneAction 与统一 Task 0215 Resolution、Task 0218 单/多出口转场协作；确认费用仅从已验证的 SceneActionDef 与 hand 中的 cardInstanceId 得出。真实卡牌牌区联动由 Task 0225 验收，战斗资源不受影响。
- **Projection/API：**核验只读投影、命令结果与错误回执；正式浏览器交互由 Task 0222 验收。

## Dependencies

- 依赖 Task 0213–0218 的 EventRun、学生/动作、统一 Resolution、Location 与路线命令。此 Task 冻结玩法语义；Datapack 数值硬上限由后续 Task 0220 加入合同，不构成当前 Runtime 实施前置。
- Task 0225 依赖本 Task 的批次提交与共享费用合同，并将卡牌实例、效果与区域变化接入。
- Task 0219、0220、0221、0222 的存档、内容合同、作者流程与正式切片均须依赖 Task 0224 和 Task 0225；本 Task 不修改这些既有任务文档。

## Receipt（2026-10-05）

- Runtime 合同：`OperationLocationDef.actionMode / sceneActions / sceneActionBatches / costGain / maxCarryCost`；薄 SceneActionDef 引用 ActionDef；EventRun 记录 `sceneActionBatchesUsed`、PlayerCost 和每次地点进入的余额记录。
- API：`previewSceneActionBatch()` 与 `commitSceneActionBatch()` 加入 GameInstance 的 Operation facade。输入只含 Run/version、逐人/全局选择、目标和可选手牌实例 ID，不接受费用或效果字段。
- Resolution：`planOperationResolution()` 增加场景批次规划分支，复用同一数值/事实/持有物聚合与 `OperationResolution`；一次原子提交行动效果、费用、批次数和 hand→discard。
- Route：唯一 `transitionRoute()` 现将来源 `maxCarryCost`、目标地点 `costGain`、入场抽牌纳入同一 detached 候选 Run；单出口与显式选择仍走同一路径。
- 示例：新增 `carousel-scene-action-slice.ts`，覆盖 Individual/Global、多个目标、持有员工证、路线门禁/消费、路线 Cost、SceneCard 联合费用、地点抽牌与结局。
- 验收：`operation-scene-actions.test.ts`、`operation-player-scene-deck.test.ts`、`gameplay-b-scene-action-sample.test.ts`；同批定向 Operation 回归共 62 tests 通过，`npx tsc --noEmit` 通过。GALHCG 与机制文档按 0224–0225 批次统一更新。
- 后续：不阻塞的正式 Datapack/Registry 合同、Save/Resume、作者校验工作流及三栏交互验收分别由 Task 0220、0219、0221、0222 承接。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[draft-0204-gameplay-b-map-and-player-actions]]
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
