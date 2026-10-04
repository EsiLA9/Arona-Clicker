# Task 0213 — 玩法 B Event Runtime 与局内状态边界

状态：active — 首个实施阶段；按下列 Patch Unit 逐步交付

## 目标

在 AC 产品 Runtime 中建立一场操作事件的运行实例，使事件可以开始、拥有局部状态、推进到终局并返回明确结果。一次运行的临时现场数据由 EventRun 所有，不污染 PlayerState 或 InitSnapshot。

## Why

后续行动、地点、目标和存档都需要一个稳定的状态 owner。先立下事件级边界，避免把临时 HP、现场危险、准备计划或路径记录变成长期玩家字段。

## Scope

- 设计 `OperationEventDef` 与唯一权威写模型 `EventRun`；EventState、ActorState、LocationProgress 是其局部子状态，不另设可变 owner。首个定义可由测试夹具输入，Datapack authoring 留给 Task 0220。
- EventRun 预留唯一的路线玩家状态子对象，承接跨 Location 的共享 PlayerCost 与有限场景卡组分区；具体入场增量、离场上限、抽牌与打牌规则由 Task 0224/0225 实现，不把它们放进 PlayerState 或学生 Actor 资源。
- EventState 支持有上下限的数值轨道和已知事实集合；每个运行拥有独立副本。
- 明确事件从未开始、进行中、成功、部分成功、失败的生命周期；本 Task 可先实现进行中及终止状态，后续 Task 补齐终局判定规则。
- 确定事件 Runtime 属于 AronaClicker 产品层，由 GameInstance/RuntimeWiring 组合。
- Operation 生命周期事件使用产品运行时本地订阅面，只发布开始、地点进入/完成和事件终局；不为局内每项轨道、事实、Actor、Cost 或牌区变化扩充通用 Engine GameEvent。
- 准备纯状态读取面，供后续学生参与与结算消费。

## Non-goals

- 不新增通用 Engine Event、Condition、Effect 或状态脚本语言。
- 不建地图路径、行动准备 UI、角色成长、路线奖励或持久存档格式。
- 不把 EventRun 放入 PlayerState、InitSnapshot 或 GameNum。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| GameInstance 与 RuntimeWiring 组合产品服务、Engine、状态与只读视图；每个 GameInstance 自己创建 EventBus 和实例状态。 | `docs/docs-829/01-architecture/run-logic.md`；`src/arona-clicker/runtime-game-instance.ts:GameInstance`；`src/arona-clicker/runtime-wiring.ts:wireGameInstance` | 操作服务属于产品 Runtime 装配边界，不使用跨 Runtime 单例。 |
| PlayerState 区分长期状态与 per-Init 状态；InitSnapshot 的成员由 `PER_INIT_FIELD_SPECS` 决定。 | `docs/docs-829/03-data-structures/player-state.md`；`src/arona-clicker/state/per-init-fields.ts` | 局内状态需要自己的 owner。 |
| GameInstance 目前没有整体 dispose API；reset/reload 会停止 Tick 并重建 PlayerState，clear EventBus queue 不会撤销其订阅者。 | `src/arona-clicker/runtime-game-instance.ts:reset`；`src/arona-clicker/runtime-reset.ts:resetRuntime`；`src/engine/core/event-bus.ts:clear` | 新 Operation 服务需要独立 clear/dispose；清队列不能代替局内 Run 清理。 |

## Data / API

- `OperationEventDef`：稳定事件 ID、初始地点 ID、用于校验地点引用的最小 Location ID 集合、初始 EventState/ActorState/路线玩家状态；行为与声明式内容合同留给后续 Task 扩展。
- `EventRun`：运行 ID、事件 ID、当前地点、生命周期、EventState/ActorState/共享 PlayerRouteState/LocationProgress 聚合和确定性随机种子/游标；这些子对象始终由同一 Run 所有。
- `EventState`：声明过且有限的数值轨道、已知事实与事件持有物；校验边界并提供稳定快照。
- `ActorState`：局内参与者 ID/类型、HP 与有限战术资源的副本；Task 0214 再加入 Character 身份与 StudentOperationProfile，不复用持久角色进度。
- `PlayerRouteState`：路线级共享 PlayerCost 与有限场景卡组的抽牌堆/手牌/弃牌堆/已打出分区状态；场景行为和玩家场景卡消费 PlayerCost，学生 Actor 资源与之分离。离场上限由每个 Location 的 `maxCarryCost` 决定，Task 0224 实现截断。
- `LocationProgress`：每个已声明 Location 的访问次数与完成状态；本 Task 仅维护状态，不建立路线边或动态地图逻辑。
- 定义交付先经产品 Runtime 的输入边界；不提前固化函数签名、序列化键或通用类型名。

## Runtime Flow

`GameInstance/RuntimeWiring` 为每个 GameInstance 创建独立操作服务 → 服务读取有效事件定义并建立 EventRun → 初始化轨道、事实、参与者副本、路线玩家状态及起始地点 → 仅接收经服务校验的局内状态转移 → 终止时产出不可变 EventResult → 后续系统读取结果。服务清理与 Runtime reset/load/reload 边界明确衔接。

## Acceptance

- [ ] 两个 GameInstance 使用同一个 EventDefinition 启动会得到相互隔离的 EventRun；修改其中一局的轨道、事实或参与者局部状态不会影响另一局。
- [ ] 未声明的状态 key、越界数值和无效地点引用在入口校验时得到可读诊断，不会留下半初始化运行。
- [ ] 终局 EventResult 明确区分事件 ID、运行 ID、结果种类和局部状态摘要；终局运行不可再次推进。
- [ ] 创建、推进和结束 EventRun 不修改 PlayerState、InitSnapshot 或全局 GameNum。
- [ ] GameInstance/RuntimeWiring 为每个 Runtime 创建独立操作服务；Runtime reset/load/reload 清除不再有效的当前 Run，整体 dispose 会终止服务并释放其局内对象；其他 Runtime 不会复用这些对象。
- [ ] EventRun 是运行期唯一可变事实源；缓存或投影可丢弃重建，不复制为第二套写模型。
- [ ] 一个 Beat/Location/Run 转移只产生对应边界事件；Actor/track/fact 的多个局内 delta 汇总后写回，不为每项状态变化通知 EventBus。

## Tests

- **Unit：**轨道边界、事实增删、生命周期状态校验。
- **Runtime：**两局隔离、无效定义拒绝、终局幂等、Runtime 重建后无隐式局内状态。
- **Integration：**GameInstance 装配的操作服务能创建 EventRun；读写边界检查不反向依赖 UI。
- **UI：**本 Task 不交付 UI。

## Dependencies

- 无。
- Task 0214 与 Task 0215 均依赖本 Task 的运行状态 owner。

## Documentation / GALHCG

- 实现稳定后更新 `docs/docs-829/01-architecture/data-flow.md`、相关产品模块卡与新增操作 Runtime 机制页。
- 只有 EventRun/EventState 的语义稳定且有真实实现证据时，才在 GALHCG 建立产品 Concept；测试辅助状态不入图。
- Read Set：`docs/docs-829/00-INDEX.md`、`docs/docs-829/01-architecture/run-logic.md`、`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md`、目标源码与测试。

## 当前核验与剩余工作

此前只核对 AC 文档和 Runtime/状态边界；本 Goal 已进入实施。地点表、局部 Actor 基础字段和路线玩家状态当前作为 Run owner 的最小骨架；Task 0214/0215/0217/0218/0224/0225 逐步添加角色、结算、目标、路线与卡牌行为。每个 Patch Unit 均须记录行为验收和实际验证结果。

## Patch Units

### Unit 0213-U1：独立 EventRun 状态与局部转移

#### Goal

建立可拒绝无效定义、初始化互相隔离的 EventRun、校验局部状态转移并产出不可变终局结果的产品域服务。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/00-INDEX.md` | 项目机制入口 |
| 文档 | `docs/docs-829/01-architecture/run-logic.md` | Runtime 组合与生命周期 |
| 文档 | `docs/docs-829/03-data-structures/player-state.md` | 排除 PlayerState / InitSnapshot 归属 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md` | 区分局内 Run 写入与玩家状态 Mutation |
| 源码 | `src/arona-clicker/contracts/operation.ts` | Operation Run 公开数据形状（若 U1 正在新建则按本 Task 契约实现） |
| 源码 | `src/arona-clicker/services/operation-definition-validation.ts` | 无状态事件定义/引用校验 |
| 源码 | `src/arona-clicker/services/operation-runtime-service.ts` | Run owner 与局部转移 |
| 源码 | `src/engine/core/event-bus.ts` | 核对不扩充全局 GameEvent 的边界 |
| 测试 | `tests/engine/operation-runtime-service.test.ts` | 单服务行为与诊断验证 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token |
| 文档 Read Set | 4 篇；只读 Run、状态和 Mutation 边界 |
| 历史文档 | 默认 0 篇；此 Unit 不需要追溯早期原型规则 |
| 超预算处理 | 超过 60k token 时拆分实现或回交高层 AI |

#### Optional Read Set

- `docs/docs-829/05-conventions/architecture-discipline.md`：仅当修改边界出现疑问时读取。

#### Do Not Read by Default

- `docs/plan-work/archive/**`；UI、Save、Datapack Editor 与无关 Engine 子系统。

#### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| GameInstance 与 RuntimeWiring 是产品服务组合入口。 | `src/arona-clicker/runtime-game-instance.ts:GameInstance`；`src/arona-clicker/runtime-wiring.ts:wireGameInstance` | U1 先实现独立领域服务，不改组合根。 |
| PlayerState / InitSnapshot 有独立生命周期与字段登记。 | `src/arona-clicker/types/state.ts`；`src/arona-clicker/state/per-init-fields.ts:PER_INIT_FIELD_SPECS` | EventRun 不进入这些数据结构。 |
| EventBus 是通用 Engine EventBus，`clear()` 会移除订阅者。 | `src/engine/core/event-bus.ts:EventBus` | Operation 内部仅发布生命周期边界的本地事件，不修改 Engine 事件联合。 |

#### Constraints

- EventRun 是局内唯一可变事实源；读取面为 detached 副本。
- 内容定义校验是纯函数模块；OperationRuntimeService 只负责建立和操作已通过校验的 Run，不把声明校验/诊断表与可变 Run 生命周期混在同一个服务职责中。
- 定义完整校验成功前不注册半初始化 Run；轨道、事实、持有物、Actor、地点和路线玩家状态均由 Run 私有副本持有。
- 终局后任何局内转移均被拒绝；结果包含 Event/Run ID、显式结果种类和局部摘要。
- 事件边界使用服务本地订阅；不注入 PlayerState、InitSnapshot、StateMutationService、GameNum 或 UI。

#### Allowed Files

- `src/arona-clicker/contracts/operation.ts`
- `src/arona-clicker/services/operation-definition-validation.ts`
- `src/arona-clicker/services/operation-runtime-service.ts`
- `tests/engine/operation-runtime-service.test.ts`
- `docs/plan-work/task-0213-gameplay-b-event-runtime-and-session-state.md`

#### Explicit Non-goals

- 不接入 GameInstance / RuntimeWiring；不建路线边、行动 Resolver、角色 Profile 或 UI。
- 不实现 Cost 增加/离场上限、玩家卡抽取/使用、Save/Resume 或 Datapack / Registry 合同；状态 owner 只为后续 Task 留下具体的路线玩家状态槽位。
- 不修改通用 Engine Event、PlayerState、InitSnapshot、GameNum 或 SaveData。

#### Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件执行默认 6 条；发现 Task 与当前源码或类型约束不符时停止并回报。

#### Completion Criteria

- [x] EventDefinition 校验轨道值域、事实/物品/地点 ID、初始参与者与路线状态；无效定义产生可读诊断且不留下 Run。
- [x] 两个独立 Runtime 使用同一 EventDefinition 时，轨道/事实/持有物/Actor/地点/玩家路线局部状态互不影响。
- [x] 合法状态转移只修改所属 EventRun；越界轨道、未声明键与终局后写入被拒绝。
- [x] 创建、局部转移与终止只通知 Run / Location 生命周期边界；批内状态 delta 不逐项发事件。
- [x] 定向单元测试与类型检查通过。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-runtime-service.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 差异核对 | `git diff --check` | 无空白错误 |

#### Receipt 0213-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（首次因停止条件 2 中断；根据用户最新授权放宽行数预算并明确职责分离后续做完成） |
| 实际修改 | 新增并修订 src/arona-clicker/contracts/operation.ts、src/arona-clicker/services/operation-definition-validation.ts、src/arona-clicker/services/operation-runtime-service.ts、tests/engine/operation-runtime-service.test.ts；删除事件级 maxPlayerCost，仅保留非负有限 PlayerCost；牌区统一为 drawPile/hand/discard/played；生命周期通知期拒绝重入写入并隔离 listener 异常；完善畸形 delta 的原子拒绝 |
| 未完成内容 | 无 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 定向查询未发现现存 Operation Runtime Concept；四个新路径的 review_changes 均返回 unreferenced_path。U1 不建 Concept，留待 U3 基于稳定实现建立映射。 |

##### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | npx vitest run tests/engine/operation-runtime-service.test.ts | 通过 | 13/13；覆盖定义验证、Run 隔离、无事件级 Cost 上限与四牌区、畸形 delta 原子拒绝、终局及本地通知边界 |
| 类型检查 | npx tsc --noEmit | 通过 | 无错误 |
| 差异核对 | git diff --check | 通过 | 无空白错误 |
| 人工验收 | 检查 EventRun 不依赖 PlayerState、全局 EventBus 或 UI | 通过 | 服务仅保存自身 Run；生命周期事件为本地只读通知，通知中拒绝运行转移，listener 异常不影响其他 listener 或已提交转移 |
| GALHCG | lookup、search(mode=path)、四条 review_changes(path=...) | 未建图 | 新验证模块没有现存 Concept / maps_to；U1 不建图，留待 U3 维护 |

##### 遇到问题

- 首次实施因常规行数预算中断；收到用户最新授权后按职责边界抽出无状态定义验证模块，再完成本 Unit。
- 代码审查发现生命周期 listener 可重入修改运行，以及畸形 membership delta 会抛原生异常；本次修订增加通知期命令拒绝、逐 listener 异常隔离和严格数组/条目校验。
- 移除未获确认的事件级 `maxPlayerCost`；`PlayerCost` 仅校验非负有限值，Location 离场截断留给 Task 0224。

##### 需上游确认项

- 无。

##### 事实更新建议

- 无；本 Unit 未接入 GameInstance，也未形成需要写入当前机制文档的已集成事实。

### Unit 0213-U2：GameInstance 装配与局内服务生命周期

#### Goal

把 OperationRuntimeService 接入每个 GameInstance，并令 reset/load/reload 与显式 dispose 清理正确。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/01-architecture/run-logic.md` | 装配与运行生命周期 |
| 文档 | `docs/docs-829/03-data-structures/player-state.md` | PlayerState 与局内状态隔离 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts:GameInstance` | init/load/reset/dispose 边界 |
| 源码 | `src/arona-clicker/runtime-wiring.ts:wireGameInstance` | 产品 Runtime 装配 |
| 源码 | `src/arona-clicker/runtime-reset.ts:resetRuntime` | 现有 reset 顺序 |
| 源码 | `src/arona-clicker/services/operation-runtime-service.ts` | 已实现 Run 服务 |
| 测试 | `tests/engine/operation-runtime-service.test.ts` | 依赖的服务契约 |
| 测试 | `tests/engine/game-instance.test.ts` | GameInstance 测试生命周期范式 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k token 时拆分或回交，不扩大本 Unit 范围 |

#### Optional Read Set

- `src/arona-clicker/runtime-options.ts` 与 `tests/engine/runtime-operation-observation.test.ts`：仅在自定义 Wiring 或 volatile Store 生命周期需要核对时读取。

#### Do Not Read by Default

- `docs/plan-work/archive/**`；不相关 Runtime 服务、UI、存档 DTO 和 Data Services 实现。

#### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 每个 GameInstance 经 Wiring 创建自己的 EventBus 与领域服务。 | `src/arona-clicker/runtime-game-instance.ts:constructor`；`src/arona-clicker/runtime-wiring.ts:wireGameInstance` | Operation 服务不使用跨实例单例。 |
| 当前整体 reset 会清事件队列，但 Engine EventBus 的订阅生命周期继续存在。 | `src/arona-clicker/runtime-reset.ts:resetRuntime`；`src/engine/core/event-bus.ts:EventBus.clear` | Operation Run 必须由自己的服务显式清理。 |

#### Constraints

- `GameInstance` 对外只暴露 OperationRuntime 的命令与只读读取面；不暴露内部可变 EventRun。
- reset/load/reload 边界清除尚未持久化的 Run；stop Tick 不改变事件状态；dispose 使服务不可继续使用。
- 不让 OperationRuntime 读取/写入 PlayerState、InitSnapshot 或一般 EventBus。

#### Allowed Files

- `src/arona-clicker/runtime-game-instance.ts`
- `src/arona-clicker/runtime-wiring.ts`
- `src/arona-clicker/index.ts`
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`
- `docs/plan-work/task-0213-gameplay-b-event-runtime-and-session-state.md`

#### Explicit Non-goals

- 不实现 Init 限制、Datapack 内容加载、玩家卡牌或 UI 入口；临时样例将在 Task 0216 限定到 `base:init:schale_office`。
- 不改变现有 Engine EventBus 或 GameInstance 的其他服务生命周期。

#### Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件执行默认 6 条；遇到无法安全清理 Run 的生命周期入口时停止并回报。

#### Completion Criteria

- [x] 每个 GameInstance 都装配独立 OperationRuntimeService；相同事件定义在两个实例内运行不会共享可变局内对象。
- [x] GameInstance init/reset/load/reload 会清除当前未存档 Run；stop 只停止 Tick；dispose 会停止 Tick 并显式结束 OperationRuntimeService。
- [x] 定向集成测试证明生命周期边界和 AC PlayerState 不受影响。
- [x] 定向测试与类型检查通过。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/gameplay-b-event-runtime-integration.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构检查 | `npm run check:architecture` | 通过 |

#### Receipt 0213-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/runtime-wiring.ts` 为每个 GameInstance 创建独立 OperationRuntimeService；`runtime-game-instance.ts` 提供 no-op/custom Wiring fallback，并在 init/load/reset 清除 Run，新增 dispose 关闭该局内服务且停止 Tick；新增 `tests/engine/gameplay-b-event-runtime-integration.test.ts`。 |
| 未完成内容 | 无 |
| 范围外变更 | 未修改通用 EventBus、PlayerState、InitSnapshot 或 SaveData。 |
| GALHCG 影响闭环 | `review_changes` 显示 runtime-game-instance.ts 与 runtime-wiring.ts 的既有 Evidence / maps_to 已过期，集成测试路径目前 unreferenced；不在 U2 扩图，留给 U3 按完成实现统一维护。 |

##### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts` | 通过 | 17/17；含双实例隔离、状态归属、生命周期、重入/诊断边界 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无错误 |
| 架构检查 | `npm run check:architecture` | 通过 | 数据服务依赖边界无违规 |
| 差异核对 | `git diff --check` | 通过 | 无空白错误 |

##### 人工验收

- 自定义空 Wiring 会获得独立 OperationRuntimeService fallback，已有 Runtime 注入形态不因本次装配要求失效。
- `stop()` 不清除 EventRun；`init/reset/load/reload` 清除未持久化 Run；dispose 停止 Tick 并释放 OperationRuntimeService 的 Run 与本地订阅者。
- Run 只写入 OperationRuntimeService 自己的 owner；集成测试前后 PlayerState 快照相同。

### Unit 0213-U3：稳定机制文档与 GALHCG 证据

#### Goal

根据已经实施并验证的 Run Runtime 更新当前架构文档、机制页与 GALHCG 映射。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/00-INDEX.md` | 当前文档唯一入口 |
| 文档 | `docs/docs-829/01-architecture/data-flow.md` | 补充新 Runtime 数据流 |
| 文档 | `docs/docs-829/02-modules/arona-clicker.md` | 产品模块职责卡 |
| 文档 | `docs/docs-829/04-mechanisms/00-index.md` | 新机制路由 |
| 文档 | `docs/ai/galhcg-project-map.md` | 地图查询/证据维护协议 |
| 源码 | `src/arona-clicker/contracts/operation.ts`；`src/arona-clicker/services/operation-runtime-service.ts` | 以当前实现描述稳定机制 |
| 测试 | `tests/engine/operation-runtime-service.test.ts`；`tests/engine/gameplay-b-event-runtime-integration.test.ts` | 文档与测试行为一致 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k token 时先拆文档 Unit，不扩大范围 |

#### Optional Read Set

- `docs/docs-829/01-architecture/run-logic.md`：仅当数据流页不足以说明 Runtime 入口时读取。

#### Do Not Read by Default

- `docs/plan-work/archive/**`；与 EventRun 无关的机制、编辑器和 UI 文档。

#### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Operation Runtime 属于 AronaClicker 产品 Runtime，不属于通用 Engine。 | Task 0213 已核实的 GameInstance/Wiring 路由与新服务实现 | 文档仅记录完成且经过测试的当前行为。 |
| EventRun 局部状态独立于 PlayerState 与 InitSnapshot。 | `src/arona-clicker/services/operation-runtime-service.ts`；对应测试 | 当前事实以实现和测试为准。 |

#### Constraints

- 只写本 Unit 已验证的机制，不复制未来 Task 的路线、目标、卡牌或存档设计。
- GALHCG Concept 仅在有真实服务实现及测试证据时创建；写 maps_to 前先 `review_changes` / 获取当前 version token。

#### Allowed Files

- `docs/docs-829/01-architecture/data-flow.md`
- `docs/docs-829/02-modules/arona-clicker.md`
- `docs/docs-829/04-mechanisms/00-index.md`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`（新建）
- `docs/plan-work/task-0213-gameplay-b-event-runtime-and-session-state.md`

#### Explicit Non-goals

- 不更新 Datapack、Save、UI 或尚未实施的 SceneAction / Route / Card 机制。
- 不写未来玩法内容为当前实现事实。

#### Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件执行默认 6 条；机制行为与实现或测试不符时停止并回报。

#### Completion Criteria

- [ ] 当前架构页说明 GameInstance/Wiring 到 OperationRuntime 的 owner 边界。
- [ ] 新机制页说明 EventRun 唯一事实源、EventState/ActorState/LocationProgress、生命周期边界和重置方式。
- [ ] 模块卡、机制索引可从 docs-829 入口路由到新机制页。
- [ ] GALHCG 仅为已实现稳定概念建立节点/关系，Evidence 的当前路径与版本 token 经核对。
- [ ] `npm run check:docs` 与定向 GALHCG `review_changes` 无未处理项。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档检查 | `npm run check:docs` | 无错误 |
| GALHCG | 对本 Unit 直接修改的路径运行 `review_changes`，必要时 `update_map` | 受影响关系有依据；无无关大范围刷新 |

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[docs/ai/task-read-set-routing]]
- [[docs/ai/PROJECT-CONSTITUTION]]
