# Task 0213 — 玩法 B Event Runtime 与局内状态边界

状态：proposed — 设计契约已完成；依赖无，等待独立启动

## 目标

在 AC 产品 Runtime 中建立一场操作事件的运行实例，使事件可以开始、拥有局部状态、推进到终局并返回明确结果。一次运行的临时现场数据由 EventRun 所有，不污染 PlayerState 或 InitSnapshot。

## Why

后续行动、地点、目标和存档都需要一个稳定的状态 owner。先立下事件级边界，避免把临时 HP、现场危险、准备计划或路径记录变成长期玩家字段。

## Scope

- 设计 `OperationEventDef` 与唯一权威写模型 `EventRun`；EventState、ActorState、LocationProgress 是其局部子状态，不另设可变 owner。首个定义可由测试夹具输入，Datapack authoring 留给 Task 0220。
- EventState 支持有上下限的数值轨道和已知事实集合；每个运行拥有独立副本。
- 明确事件从未开始、进行中、成功、部分成功、失败的生命周期；本 Task 可先实现进行中及终止状态，后续 Task 补齐终局判定规则。
- 确定事件 Runtime 属于 AronaClicker 产品层，由 GameInstance/RuntimeWiring 组合。
- 准备纯状态读取面，供后续学生参与与结算消费。
- EventRun 生命周期只发布开始、地点进入/完成和事件终局等边界事件；轨道、Actor 字段和内部结算不逐项派发全局事件。

## Non-goals

- 不新增通用 Engine Event、Condition、Effect 或状态脚本语言。
- 不建地图路径、行动准备 UI、角色成长、路线奖励或持久存档格式。
- 不把 EventRun 放入 PlayerState、InitSnapshot 或 GameNum。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| GameInstance 与 RuntimeWiring 组合产品服务、Engine、状态与只读视图。 | `docs/docs-829/01-architecture/run-logic.md`；`src/arona-clicker/runtime-game-instance.ts`；`src/arona-clicker/runtime-wiring.ts` | 操作服务属于产品 Runtime 装配边界。 |
| PlayerState 区分长期状态与 per-Init 状态；InitSnapshot 的成员由 `PER_INIT_FIELD_SPECS` 决定。 | `docs/docs-829/03-data-structures/player-state.md`；`src/arona-clicker/state/per-init-fields.ts` | 局内状态需要自己的 owner。 |

## Data / API

- `OperationEventDef`：事件 ID、初始地点 ID、初始 EventState、终局结果定义的引用。
- `EventRun`：运行 ID、事件 ID、当前地点、生命周期、EventState/ActorState/LocationProgress 聚合、确定性随机种子/游标的预留位置。
- `EventState`：声明过的数值轨道与已知事实；校验边界并提供稳定快照。
- 定义交付先经产品 Runtime 的输入边界；不提前固化函数签名、序列化键或通用类型名。

## Runtime Flow

`GameInstance` 创建操作服务 → 服务读取一个有效事件定义并建立 EventRun → 初始化事件轨道/事实及起始地点 → 接收局内状态转移 → 终止时产出不可变 EventResult → 后续系统读取结果。

## Acceptance

- [ ] 同一个 EventDefinition 启动两次会得到相互隔离的 EventRun；修改其中一局的轨道、事实或参与者局部状态不会影响另一局。
- [ ] 未声明的状态 key、越界数值和无效地点引用在入口校验时得到可读诊断，不会留下半初始化运行。
- [ ] 终局 EventResult 明确区分事件 ID、运行 ID、结果种类和局部状态摘要；终局运行不可再次推进。
- [ ] 创建、推进和结束 EventRun 不修改 PlayerState、InitSnapshot 或全局 GameNum。
- [ ] 产品 Runtime 能显式创建和结束操作服务；销毁服务后局内对象不会被其他 Runtime 复用。
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

当前只核对了 AC 文档和 Runtime/状态边界；未实现、未运行测试。后续实施需从当前源码确定最小 API，并把行为验收记录在施工 Receipt。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[docs/ai/task-read-set-routing]]
- [[docs/ai/PROJECT-CONSTITUTION]]
