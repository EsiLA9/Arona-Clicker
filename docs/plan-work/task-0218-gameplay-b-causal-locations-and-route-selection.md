# Task 0218 — 玩法 B 因果地点与路线选择

状态：completed — 单一 Location 合同、路线选择/自动转场、持有物 Gate、有界回环、路线投影、固定样例、机制文档与 GALHCG 均已闭环。

## 目标

把 Event 建成可处置的问题地点图。玩家选择先处理什么会改变后续地点压力、可见事实、可用行动或事件结局；路线选择是单独的事件决策。

## Why

路线的产品价值来自事件因果和资源取舍。若节点只改变奖励或下一场敌人，地图不会成为玩法 B 决策的一部分。

## Scope

- `OperationLocationDef` 之间建立统一有向 RouteEdge，支持分支、回环及可选的区域/楼层展示分组；分组只影响地图呈现，不改变图语义。
- 首期 Route Gate 只允许检查一个可选的 `requiredHeldItemId`，读 EventRun 的局内持有物；不建设布尔表达式、AC PlayerState.inventory、数值轨道、事实表达式或通用 ConditionSystem。
- 出口可声明是否在成功转场时消费该持有物；校验和消费只发生在统一转场提交中。
- 路线转场只有一个公共提交入口 `transitionRoute({ runId, planVersion, routeId })`。多出口由玩家传入所选 ID；单出口自动推进时也将唯一出口 ID 交给同一入口，不得另写自动转场分支。
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
- `RouteView`：只包含当前 Location 的出口、持有物检查结果、简短路线说明和不可用原因，不含可写内容引用或整张图副本。唯一写入口为 `transitionRoute({ runId, planVersion, routeId })`；自动与手动转场都调用它。
- EventRun 保存当前地点、含离开结果的转场记录与独立持有物集合；Area/Spot 不新增关联字段，AC 长期 inventory 不参与路线条件。
- 运行时直接检查当前 Location 声明的出口；本版不增加路线索引或全图缓存。

## Runtime Flow

Location 终止 → 评估当前地点出口 → 0 条可用时评估 Event 终局 → 1 条可用时将唯一出口交给 `transitionRoute({ runId, planVersion, routeId })` → 2 条以上时投影路线取舍并等待玩家选择后调用同一入口 → 入口先计算验证与整份新 Run，再一次提交地点结果、出口物品消费及转场；Task 0224/0225 分别把 Cost 和抽牌步骤接入这条提交路径 → 开始下一 Beat。任何转场都不调用 Beat Resolver，也不创建 Resolution。

## Acceptance

- [x] 正式固定样例提供多个有不同代价的出口；RouteView 在提交前提供路线说明与持有物门槛，状态按选择推进。视觉交互由 Task 0222 验收。
- [x] 多出口需要独立 Route 命令；单出口自动推进。两者都不创建 Resolution、扣战术资源或增加 Beat/Click 计数。
- [x] 自动单出口与显式多出口只通过 `transitionRoute({ runId, planVersion, routeId })` 改变地点；地点结果、出口物品消费和 Route 日志由同一入口计算并一次提交。
- [x] 入口、版本、地点完成状态、Route Gate 与目标位置在写入前校验；失败时 EventRun、LocationProgress 与持有物不变。Cost/抽牌原子步骤留给 0224/0225 接入同一入口。
- [x] 无可用出口时不等待 Route 输入、不创建 Resolution 或额外 Beat；自动评估 Event 终局。
- [x] 锁定路线投影缺少的 `requiredHeldItemId` 原因；Gate 只检查 EventRun 持有物，不读写 AC PlayerState.inventory，也不解析通用条件表达式。
- [x] 消费型出口只在成功转场时原子移除要求物品；过期命令与不可用路线不改变持有物或 Run。
- [x] 固定样例经 Action 获得持有物、进入门禁路线、沿回环返回，并在访问上限到达后正常结束。
- [x] 静态校验确认入口与每条 Route 的目标 Location 存在；不实现全图拓扑分析。运行时只检查当前 Location 声明的出口。
- [x] Event 总访问上限会阻止无限续环；到达上限时产生明确终止结果。
- [x] 回访结果保存在 `routeHistory`；访问数、上限和终止状态投影到 OperationView。地点跳过代价与 Cost 携带由 0224 接入。
- [x] OperationLocation 与 Area/Spot 可并存且各自保留原有语义。

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
- Task 0218 收尾已将 Task 0217–0218 的 Objective/Outcome 与 Location/Route 稳定语义批量更新到当前机制文档/GALHCG 并核验 freshness；只记录稳定语义，单个路线边与地点配置不建 Concept。
- Read Set：`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`、`docs/docs-829/03-data-structures/registry.md`、`docs/docs-829/04-mechanisms/engine/effect-trigger.md`、Task 0217 源码与测试。

## 当前核验与剩余工作

本 Task 已实现 `OperationLocationDef` 单一地点内容结构、可环路 RouteEdge、持有物 Gate、转场历史、访问上限、锁定原因 View、版本保护的唯一转场入口，以及旋转木马固定路线样例。`transitionRoute` 在 detached 候选 Run 上校验 Gate、消费持有物、重置地点进度、记录离开结果和访问，再准备目标地点；全部成功后只替换一次 owner 状态。自动单出口也调用同一公共命令。机制页、OperationView 页及 GALHCG 概念/文件映射均已更新。尚未实现的路线图 UI、Cost 携带/地点增量、场景卡抽取、Datapack Registry 作者契约与存档属于 Task 0222、0224、0225、0220 和 0219，不阻塞本 Task。

## Receipt 0218

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 将 `OperationEventDef.locationIds + locationTactics` 合并为单一 `locations[]`；新增 RouteEdge、版本化 `transitionRoute`、纯 Route 可用性求值、转场历史和访问上限；OperationView 投影出口、锁定原因、转场历史和访问数；新增旋转木马持证分支/环路样例；迁移对应事件 fixture 与 Runtime 测试；更新 operation-runtime、operation-view 当前机制文档及本 Task。 |
| 未完成内容 | Task 0218 范围内无未完成项。Cost 携带与地点增量、玩家场景卡抽取、正式 Registry 契约、存档与正式 UI 由后续 Task 接手。 |
| 范围外变更 | 无；工作区内其他主题/Datapack 变更未纳入本阶段提交。 |
| GALHCG 影响闭环 | 显式绑定 `acprogram`。定向刷新本 Task 触及的 contracts、services、operation-samples、tests/engine 与 docs/docs-829 路径；更新既有 `concept:operation-event-run-runtime` 摘要与 40 条 `maps_to`，新增 5 条实现/样例/测试映射；Concept 保留 20 条核心 Evidence。刷新/解析后的 40 个文件路径均成功取得可用 `version_token`；Concept + 40 条映射共 41 个 owner freshness 核验为 fresh。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run --reporter=dot --silent tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-route-sample.test.ts tests/engine/gameplay-b-operation-sample.test.ts tests/engine/operation-resolution-planner.test.ts tests/engine/operation-participant-admission.test.ts tests/engine/student-operation-runtime.test.ts tests/engine/operation-plan-preparation.test.ts tests/engine/operation-combination-resolver.test.ts tests/engine/operation-intervention-preview.test.ts tests/engine/operation-target-selection.test.ts tests/engine/operation-tactical-rng.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts` | 通过 | 12 个文件、117 个测试；未运行浏览器地图 UI。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 迁移后的统一 Location 合同与 Route facade 无类型错误。 |
| 文档检查 | `npm run check:docs` | 通过 | 0 errors；扫描 643 篇 Markdown。 |
| GALHCG | 定向 `refresh`、`resolve_paths`、`preview_many`、`plan_map_updates`、逐批 `update_map(dry_run=true → commit)`、`verify_freshness` | 通过 | 每批预检完整且 valid；Concept 与全部 40 条 maps_to freshness 均为 fresh。 |
| 差异检查 | `git diff --check` | 通过 | 未发现空白错误。 |

| 遇到问题 | 内容 |
| --- | --- |
| 已处理的迁移问题 | 旧测试 fixture 分散使用 `locationIds/locationTactics`；统一迁移到单一 Location 对象后，静态校验与目标内容均通过。 |
| 需上游确认项 | 无。 |
| 事实更新建议 | Runtime 的自动单出口与玩家路线选择共用 `transitionRoute({ runId, planVersion, routeId })`；它在一次 owner 写回前计算持有物消费、来源结果、访问历史和目标地点准备。 |

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0217-gameplay-b-objectives-and-partial-outcomes]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
