# Task 0225 — 玩法 B 有限玩家场景卡组

状态：completed — 固定场景牌组、独立派生初始牌序、起始/地点抽牌和同批结算均已实现并验证；Task 0220/0219/0221/0222 可依赖此状态语义。

## 目标

为一场 Event 提供固定、有限的玩家场景卡组，以 EventRun 独立维护 drawPile、hand、discard 三个区域；所有抽牌可由事件 Seed 复现，卡牌只用于非战斗场景。

## Why

玩家需要在地点间安排有限的主动工具。固定卡组让卡牌成为路线内的 Cost 决策，而不是角色技能或长期构筑；显式卡牌区域和稳定抽牌顺序让选择、存档与结算都可解释。

## Scope

- 为每场 Event 配置固定卡组与抽牌规则；每个物理卡牌实例有唯一 ID，同名多张牌仍是不同实例。不提供购买、构筑、事件间继承或局内增生卡组。
- EventRun 只维护 drawPile、hand、discard 三个互斥区域并保留抽牌顺序。Task 0213 的 `played` 分区是早期低层占位；本 Task 将移除这项未使用状态，打出的牌直接从 hand 移入 discard。无存档迁移要求，按项目策略清档。
- 起始抽牌数、每次进入 Location 的抽牌数和手牌上限由事件内容明确给出；首期样例提供确定值。达到手牌上限时停止抽牌，未抽卡留在 draw。
- 卡组顺序由 Event Seed 确定；使用独立的卡组随机流或等价派生序列，不改变 Task 0215 的战术 Resolution 随机游标。
- 每个 `PlayerSceneCardDef` 是薄包装，只声明 `id`、`actionId`、`playerCost`、`timing` 和 `copies`；目标、资格条件和效果只在所引用的 `OperationActionDef` 中定义，不得重复存储。
- 每个抽出的物理卡牌实例具有由 `(deckSeed, cardDefId, copyOrdinal)` 确定的 `cardInstanceId`。EventRun 保存抽牌顺序及实例所在区域，不另建卡牌对象系统。
- 卡牌可在 Task 0224 的 SceneAction 批次中选择；其 PlayerCost 与同批 SceneAction 费用共同校验、一次扣除。有效提交后卡牌对应 ActionDef 效果进入该批唯一 Resolution，并将卡牌从 hand 移入 discard；无效或资源不足时 Run 与卡牌区域保持不变。
- 手牌跨 Location 保留；打出后进入 discard 且不回洗，drawPile 耗尽后不再抽牌。v1 没有单独“弃牌”命令；discard 只用于存放已打出的卡。
- 卡牌只允许在非战斗 SceneAction 时机使用；效果复用 OperationActionDef 与统一 Target/Effect/Resolution 规则，不建立独立 CardResolver。
- 为 Task 0219 精确存档、Task 0220 内容合同与上限、Task 0221 作者校验及 Task 0222 正式事件样例提供稳定的卡组状态语义。

## Non-goals

- 不提供角色消耗 PlayerCost 的技能，不把卡牌变成角色行动或战斗 Click 卡。
- 不增加弃牌区回洗、循环牌库、随机生成牌、牌组构筑、商店购买、跨 Event 卡牌库存或独立 `played` 区。
- 不单独实现卡牌费用扣除器、卡牌 Resolver 或第二种结算记录；费用与结果复用 Task 0224 / Task 0215。
- 不扩展任意脚本效果、通用卡牌框架或独立卡牌编辑器。

## Gameplay UI Deferred Scope

- 本 Task 实现 EventRun 有限牌堆、抽牌/区域转移、场景费用与 Resolution API；可定义供后续 UI 使用的只读牌区投影。
- 不设计牌区如何占用左/中/右栏、不将学生行动拆成卡牌多列，也不加入信息聊天流内出牌/选目标控件；Task 0222 再将 Runtime 的 SceneCard 实例与角色卡视觉区分并设计正式交互。
- 玩家有限 SceneCard 牌组状态与我方角色卡上显示的学生当前计划/行为不是同一 Runtime 对象或同一牌区。

## 设计依据与 AC 现状边界

- 固定有限卡组、Seed 抽牌、已打出牌不回洗及仅场景使用，是 Draft 0204 的玩法输入；V1 采用 drawPile/hand/discard 三分区，打出牌直接进入 discard。
- Task 0215 的统一 Resolution 与 Task 0219 的 Run 快照均为 proposed 设计目标，不能当作当前源码已支持卡牌状态的依据。
- 本 Task 可先通过 Task 0213 的 EventDefinition 临时 TypeScript 输入建立有限牌库运行规则，不等待 Datapack / Registry 合同；Task 0220 后续把稳定定义字段正规化并加入数值/数量硬上限，不改变卡组运行语义。

## Data / API

- Event 的固定卡组声明包含有限 PlayerSceneCardDef、每个定义的副本数、起始抽牌数、入场抽牌数和手牌上限；PlayerSceneCardDef 只引用 OperationActionDef 并声明 PlayerCost 和时机。
- EventRun 只保存三类区域中的 `cardInstanceId` 与 draw 顺序/位置；ActionDef 定义、OperationView 与缓存均从 Datapack/Registry 重建。
- SceneActionBatch 只接受当前 hand 中的卡牌实例 ID；同一实例不能重复选择，也不能同时出现在多个区域。
- 已打出的卡从 hand 进入 discard；首期不设计其他弃牌来源或弃牌命令。discard 不回到 draw。
- 卡组内容数量有限且每张实例 ID 唯一；本 Task 验证区域互斥，不另做 at-cap/overflow 性能夹具。

## Runtime Flow

建立 EventRun → 依 Event Seed 生成固定 draw 顺序并执行起始抽牌 → 进入 Location 时由 Task 0218 的 `transitionRoute(routeId)` 在同一提交中抽牌至 hand 上限 → 玩家将零张或多张 hand 实例附加到 SceneAction 批次 → Task 0224 汇总费用并整体提交 → 成功时执行引用的 OperationActionDef 并把实例从 hand 移至 discard；拒绝时 Run 不变 → 后续地点转场继续抽牌，drawPile 耗尽则停止。

## Acceptance

- [x] 相同 Event 与 Seed 产生相同的物理 `cardInstanceId` 和初始 draw 顺序；独立派生的牌组洗牌不推进 Task 0215 战术随机流。
- [x] 每张物理卡有唯一实例 ID；副本不会合并成一张牌，同一实例在任一时刻只属于一个区域。
- [x] 起始抽牌、地点入场抽牌和手牌上限由内容明确控制；达到上限不丢牌，抽牌堆耗尽后不从其他区域补牌。
- [x] 手牌可跨 Location 保留；成功打出的卡从 hand 进入 discard，discard 不回洗到 draw；不存在独立 played 区或玩家弃牌命令。
- [x] 一张卡只能从当前 hand 选择，并且只能在非战斗 SceneAction 批次使用；战斗 Beat 或不匹配场景时机的使用被拒绝。
- [x] PlayerSceneCardDef 只引用 OperationActionDef；选卡与 SceneAction 同批校验，费用只计一次，效果与行动进入同一 Resolution，成功后实例只从 hand 移到 discard 一次。
- [x] 实际转场进入 Location 时，抽牌由 `transitionRoute(routeId)` 统一提交；转场任一部分失败时，地点、Cost、持有物、抽牌顺序及牌区均保持不变。
- [x] 资源不足、无效目标、重复卡实例、卡牌不在手牌或批次过期时整批拒绝；PlayerCost、事件状态、战术 RNG 和所有卡牌区域保持不变。
- [x] 同一 Seed 与输入序列产生相同卡牌抽取、区域变化及 Resolution 记录；Run 持有的物理卡数量由声明副本数约束。

## Tests

- **Unit：**卡牌薄包装引用、确定性实例 ID、三分区互斥、手牌上限、draw 耗尽及 hand→discard 转移。
- **Runtime：**Seed 重放、SceneAction 联合费用提交、拒绝原子性、战斗时机拒绝与卡组状态隔离。
- **Integration：**Task 0224 SceneAction → 一次费用扣除 → 单一 Resolution → hand→discard。Route 转场进入地点时由 `transitionRoute(routeId)` 统一抽牌；Task 0219 验收恢复后不重抽、不重放。
- **Content：**Task 0220 验证简单有限值和引用；Task 0221 的正式示例覆盖抽牌、留牌和耗尽路径，Task 0222 复用该内容。
- **Projection/API：**提供 hand、抽牌与已用状态的只读投影契约；不实现牌区/聊天 UI，浏览器流程由 Task 0222 验收。

## Dependencies

- 依赖 Task 0224 的 EventRun PlayerCost、SceneAction 批次原子提交与统一 Resolution；并传递依赖 Task 0213–0218。Task 0220 是后续声明合同/内容校验 Task，不是本 Runtime 卡组逻辑的前置。
- Task 0219、0220、0221、0222 的存档、内容合同、作者流程与正式样例均须依赖 Task 0225；本 Task 不修改这些既有任务文档。

## Receipt（2026-10-05）

- 内容合同：`OperationEventDef.playerSceneDeck` 声明固定牌定义、起始/入场抽牌数和手牌上限；`PlayerSceneCardDef` 只引用 ActionDef 并声明 PlayerCost、scene 时机和副本数。
- 实例与抽牌：`operation-player-scene-deck.ts` 依 `(event Seed, cardDefId, copyOrdinal)` 生成稳定 `cardInstanceId`，用独立派生 shuffle 对顺序洗牌；Run 保存顺序与 drawPile/hand/discard，后续抽牌不推进战术 RNG，也不回洗 discard。
- 提交：`OperationSceneActionBatchCommand.cards` 只能选择当前手牌实例；Planner 从冻结 Event 内容解析对应 Action/费用，和 SceneAction 费用一并验证。统一 Resolution 应用效果，原子提交同时扣费并执行 hand→discard。
- 投影：OperationView 暴露手牌实例的 Action ID/PlayerCost、draw/discard 数量及手牌上限，未实现交互 UI。
- 示例与测试：游乐园样例现覆盖起始/地点抽牌、牌组 Seed、卡与 SceneAction 联合费用、目标效果、hand→discard 以及随后路线转场；`operation-player-scene-deck.test.ts` 与 `operation-scene-actions.test.ts` 验证实例稳定、手牌上限、拒绝原子性、不回洗和 RNG 隔离。
- 核验：同批定向 Operation 回归 62 tests 通过，`npx tsc --noEmit` 通过；机制页与 GALHCG 已合并更新。GALHCG 复用现有 `Operation EventRun Runtime` / `Operation Student Profile Admission` Concepts，没有新建近义概念；运行时节点保留 20 份可一次完整核验的核心 Evidence，全部 47 条直接 `maps_to` 和 1 条相关关系均完成新鲜度核验。发现 8 条历史 Evidence 因测试/样例内容变化而 stale，已用当前版本令牌更新并复核为 fresh。作者内容硬上限、存档编码、正式 Datapack 与玩家 UI 由 Task 0220、0219、0221、0222 承接。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[draft-0204-gameplay-b-map-and-player-actions]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[task-0221-gameplay-b-authoring-and-content-validation-workflow]]
- [[task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice]]
