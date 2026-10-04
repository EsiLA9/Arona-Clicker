# Task 0218 — 玩法 B 因果地点与路线选择

状态：proposed — 等待 Task 0217 完成

## 目标

把 Event 建成可处置的问题地点图。玩家选择先处理什么会改变后续地点压力、可见事实、可用行动或事件结局；路线选择是单独的事件决策。

## Why

路线的产品价值来自事件因果和资源取舍。若节点只改变奖励或下一场敌人，地图不会成为玩法 B 决策的一部分。

## Scope

- `OperationLocationDef` 之间建立统一有向 RouteEdge，支持分支、回环及可选的区域/楼层展示分组；分组只影响地图呈现，不改变图语义。
- 首期 Route Gate 只允许检查一个可选的 `requiredHeldItemId`，读 EventRun 的局内持有物；不建设布尔表达式、AC PlayerState.inventory、数值轨道、事实表达式或通用 ConditionSystem。
- 出口可声明是否在成功转场时消费该持有物；校验和消费只发生在统一转场提交中。
- 路线转场只有一个公共提交入口 `transitionRoute(routeId)`。多出口由玩家传入所选 ID；单出口自动推进时也由 Runtime 将唯一出口 ID 交给同一入口，不得另写自动转场分支。
- `transitionRoute` 先依据当前 Run 计算完整的新状态，再复用 0215 已有的“先计算、后一次写回”原则提交；不新增通用事务框架。Task 0224 将 Cost 截断/地点 Cost 增量接入此转场，Task 0225 将新地点抽牌接入此转场。
- 转场的单次提交顺序为：验证出口与 Gate → 计算持有物消费 → 记录旧地点结果 → 应用离场 `maxCarryCost`（由 0224 接入）→ 切换地点并登记访问 → 应用新地点 `costGain`（由 0224 接入）→ 抽新地点卡牌（由 0225 接入）→ 一次性写回。任一步校验失败，Run、持有物、Cost、地点与牌区均不变化。
- 当前 Location 完成后展示可用出口、未开放原因、访问记录和简要的已知风险/收益。
- 0 条合法出口时进入 Task 0217 的 Event 终止判定；1 条合法出口时自动转场；2 条以上合法出口时玩家发出独立 Route 命令选一条。
- 单出口自动转场和多出口选择都不创建 PreparedBeat/Resolution、不扣行动资源、不推进 Beat/Click 计数。
- 正式示例包含分支、至少一条回环，以及一条由持有物打开的路线；玩家能看到两条路线的简短已知取舍。
- 每个 Location 有目标/失败终态或有限 Beat 上限；Event 的 `maxLocationVisits` 限制本局累计进入地点的次数，使回环最终停止。
- 静态内容校验只需确认入口和 Route 目标 Location 存在；不做全图可达性、死路证明或循环拓扑分析。固定示例与运行验收负责证明可通关。

## Non-goals

- 不做程序化地图生成、任意路径规划 DSL 或通用世界导航图。
- 不把 Event Location 映射成 AC Area/Spot。
- 不以奖励挑选代替至少一种可观察的事件状态后果。

## Gameplay UI Deferred Scope

- 本 Task 实现地图拓扑、持有物门槛、Route 命令与 RouteView，不设计或施工路线图 UI、聊天流选项或确认控件。
- RouteView 可提供可用出口、锁定原因、访问记录和已知风险/收益，供 Task 0222 的三栏 UI 消费。
- 最终 UI 中固定地点信息可进入中央信息流；路线选择交互形式留给 Task 0222，与我方角色卡 / 敌方信息三栏一并设计。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| Area 属于 Init 空间；Spot 表示有功能/购买/升级等产品行为的场所实体。 | `docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`；`src/data-services/contracts/world.ts`；`src/arona-clicker/services/spot-service.ts` | 一次事件内临时问题地点采用独立 OperationLocation。 |
| Condition / Effect / Trigger 的声明已有明确状态写入、事件与生命周期职责。 | `docs/docs-829/04-mechanisms/engine/effect-trigger.md` | 首期持有物 Gate 仍留在 Operation EventRun，不调用通用 ConditionSystem 或 PlayerState inventory。 |

## Data / API

- `RouteEdge`：Location 内唯一的 `routeId`、目标 Location ID、可选的 `requiredHeldItemId`、是否在成功转场时消费该物品、简短路线说明；作为 Location 内容的嵌入值。
- `LocationProgress`：访问次数、已完成 Beat 数、状态、局部结果与离开原因，属于 EventRun。
- `OperationLocationDef`：声明目标/失败条件或有限 Beat 上限，并可选带不具机制含义的区域/楼层分组标签；Event 内容声明 `maxLocationVisits`。
- `RouteView`：只包含当前 Location 的出口、持有物检查结果、简短路线说明和不可用原因，不含可写内容引用或整张图副本。唯一写入口为 `transitionRoute(routeId)`；自动与手动转场都调用它。
- EventRun 保存当前地点、访问历史与独立持有物集合；Area/Spot 不新增关联字段，AC 长期 inventory 不参与路线条件。
- 运行时直接检查当前 Location 声明的出口；本版不增加路线索引或全图缓存。

## Runtime Flow

Location 终止 → 评估当前地点出口 → 0 条可用时评估 Event 终局 → 1 条可用时将唯一出口交给 `transitionRoute(routeId)` → 2 条以上时投影路线取舍并等待玩家选择后调用同一入口 → 入口先计算验证与整份新 Run，再一次提交地点结果、出口物品消费及转场；Task 0224/0225 分别把 Cost 和抽牌步骤接入这条提交路径 → 开始下一 Beat。任何转场都不调用 Beat Resolver，也不创建 Resolution。

## Acceptance

- [ ] 至少一处有两个首选出口，二者都可取但不互相支配；RouteView 在提交选择前提供已知利益和遗留风险/未处理问题，之后状态按所选分支兑现。UI 呈现与交互由 Task 0222 验收。
- [ ] 多出口需要一个独立 Route 命令；单出口自动推进。两者都不创建 Resolution、扣战术资源或增加 Beat/Click 计数。
- [ ] 自动单出口与显式多出口只通过 `transitionRoute(routeId)` 改变地点；地点状态、出口物品消费、Route 日志及后续 Task 接入的 Cost/抽牌都由该入口计算并一次提交，不另建第二条转场写入路径。
- [ ] 任一步转场校验失败时，EventRun、LocationProgress、持有物和路线状态不变；Task 0224/0225 的 Cost 与卡牌抽取失败也服从同一原子边界。
- [ ] 无合法出口时不等待无法完成的 Route 输入、不创建 Resolution 或额外 Beat；调用 Event 终止判定并显示结果依据。
- [ ] 锁定路线说明缺少的 `requiredHeldItemId`；Gate 只检查 EventRun 持有物，不读写 AC PlayerState.inventory，也不解析通用条件表达式。
- [ ] 消费型出口只在成功转场时原子移除要求物品；条件不满足或出口选择过期时持有物保持不变。
- [ ] 固定示例能走过一条回环，并用行动取得的持有物打开另一条路线；达到 Event 总访问上限后正常进入终止结果。
- [ ] 静态校验确认入口与每条 Route 的目标 Location 存在；不实现全图拓扑分析。运行时只检查当前 Location 声明的出口。
- [ ] Event 总访问上限会阻止无限续环；到达上限时产生明确的终止结果。
- [ ] 回访上限、跳过地点代价和事件终局结果在 Runtime/View/日志中一致。
- [ ] OperationLocation 与 Area/Spot 可并存且各自保留原有语义。

## Tests

- **Unit：**持有物 Gate、路线目标引用、访问/Beat 上限与锁定原因。
- **Runtime：**单出口自动转场与多出口显式选择均经 `transitionRoute`；注入出口、持有物及后续 Cost/抽牌校验失败，确认整份 Run 保持不变；至少两条不同路线的结果可复现。
- **Integration：**Route 命令→EventRun→新 Location View；无战术 Resolution 产生。
- **Projection/API：**地点完成状态、可用/锁定出口、锁定原因与回访/跳过影响能由 RouteView/Runtime 命令读写；不做浏览器地图或聊天交互 UI。

## Dependencies

- 依赖 Task 0217 的 EventState、Predicate 与 Location/Event Outcome。
- 事件终局前的多地点续局依赖 Task 0213–0216。

## Documentation / GALHCG

- 本 Task Receipt 收集 Location/Route 机制页和 Concept 候选及证据路径，不在单 Task 收尾时写 GALHCG。
- Task 0218 完成后，一次性委派子 Agent 汇总 Task 0217–0218 的 Objective/Outcome 与 Location/Route 语义，批量更新机制文档/GALHCG 并验证 freshness；只记录稳定语义，单个路线边与地点配置不建 Concept。
- Read Set：`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`、`docs/docs-829/03-data-structures/registry.md`、`docs/docs-829/04-mechanisms/engine/effect-trigger.md`、Task 0217 源码与测试。

## 当前核验与剩余工作

当前只核对 Area/Spot、Registry 与运行条件的职责；未实现、未运行测试。首期 Route Gate 只检查单个 EventRun 局内持有物；将来若需支持复合 Predicate 或玩家全局条件，另立任务裁定，不在本 Task 扩展。玩法交互 UI 暂缓至 Task 0222。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0217-gameplay-b-objectives-and-partial-outcomes]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
