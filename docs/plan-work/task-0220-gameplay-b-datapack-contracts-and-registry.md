# Task 0220 — 玩法 B Datapack 定义与 Registry 校验

状态：proposed — 等待 Task 0213–0218 与 Task 0224/0225 的 Runtime 语义稳定

## 目标

让 Operation Event、Location、Action 与学生 Profile 进入声明式 Datapack/Registry；参与者、组合规则、目标、结果与路线作为所属定义内的嵌入内容，使新事件主要通过内容定义建立。

## Why

若运行时规则和单局内容混写在产品代码，新增事件就会继续要求编辑 Runtime。Datapack/Registry 是 AC 已有的正式内容汇总边界。

## Scope

- 根据 Task 0213–0218 的稳定语义声明四类顶层定义：Operation Event、Location、Action、StudentOperationProfile。各自使用对应类型的稳定三段式 ID（`modName:typeName:idName`），其中 `typeName` 分别固定为 `operation-event`、`operation-location`、`operation-action`、`student-operation-profile`；登记这些类型并做格式、类型和引用校验，不依赖 Registry 自动补命名空间。
- ParticipantSpec、二输入 CombinationRule、Objective/Outcome、RouteEdge、TargetSpec 与 ActionTag 作为所属定义内的嵌入内容；引用顶层定义时使用完整稳定 ID。首期 RouteEdge 只可声明一个可选 `requiredHeldItemId`，不引入通用 Gate 表或 Predicate 表。
- 在 Location 内容中声明有限 SceneAction 批次。`SceneActionDef` 是薄包装，包含 `id`、`actionId`、`scope`、`playerCost`；实际目标、资格条件和效果只由 OperationActionDef 提供。
- RouteEdge 可检查一个可选的 EventRun 局内持有物；不读取轨道、事实、计时或 PlayerState.inventory。
- 在 Event 内容中声明共享 PlayerCost、显式正整数 `resumeVersion`、`maxLocationVisits` 与有限 PlayerSceneCardDef。PlayerSceneCardDef 是薄包装，包含 `id`、`actionId`、`playerCost`、`timing`、`copies`；卡牌和 SceneAction 不复制 OperationActionDef 的目标、条件或效果。
- `resumeVersion` 是作者显式维护的事件内容兼容号。恢复时比较存档中的 `eventId + resumeVersion`；事件的非兼容改动由作者递增此字段。不得计算已解析 Datapack 图的内容 Hash。
- 复用现有 DefFactory/Builder 与 Registry 加载校验路径；只增加本批内容需要的定义和字段验证，遵循现有 ID、重复项和覆盖规则，不另建 Registry 或作者框架。
- 使用一份正式 Gameplay-B Datapack 示例证明合同与 Registry 行为；Task 0221 用它验证作者循环，Task 0222 将同一份内容接入默认入口，不复制第二份样例。
- 若定义进入 `src/engine/types/**`，遵守 Schema 同步并由生成器更新产物；仅产品域规则优先留在 `src/arona-clicker/` 内容合同。
- 为地点访问、SceneAction 批次、卡组副本和 Resolution 日志设置适合单个 V1 示例的简单有限值；不建设 at-cap/overflow 压测体系。
- 静态验证覆盖 ID/引用/值域、入口存在和 Route 目标存在；不分析全图可达性或穷举动态状态。

## Non-goals

- 不把任意 TypeScript 回调、运行时脚本或外部代码作为 Datapack 字段。
- 不重构现有所有 Datapack 表、独立编辑器或内容打包流程。
- 不把 EventState 轨道硬编码成 PlayerState 字段，不把 Location 合并进 Area/Spot。

## Gameplay UI Deferred Scope

- 本 Task 只定义 Operation 内容合同、Registry 校验与 EventDef.resumeVersion；不施工 Gameplay B 的玩家界面、聊天流交互或路线/场景选择控件。
- 可为 Task 0222 暴露目录、View 数据和内容诊断 API；三栏布局与玩家交互表现不在本 Task 冻结。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| Datapack 契约定义声明式内容，Registry 汇总定义、索引并验证重复 ID/引用。 | `docs/docs-829/03-data-structures/datapack-contracts.md`；`docs/docs-829/03-data-structures/registry.md`；`src/data-services/contracts/datapack.ts`；`src/data-services/registry/registry.ts` | 新玩法内容加入现有内容加载路，不自行建平行 Registry。 |
| 正式应用的默认内容入口位于 AronaClicker 内容层。 | `AGENTS.md`；`src/arona-clicker/content/default-datapack.ts` | 发布事件内容在产品默认包中维护。 |
| 引擎类型字段/枚举变更须使用 Schema 生成器，生成产物不可手改。 | `docs/docs-829/05-conventions/schema-sync.md` | 类型落点在进 Task 时需有证据；同步由项目流程处理。 |
| Datapack 实体遵循 `modName:typeName:idName`，`ENTITY_TYPES` 是显式类型表；Registry 单包验证重复 ID/引用，多包同 ID 按加载顺序由后加载定义覆盖。 | `src/engine/core/entity-id.ts`；`src/data-services/registry/registry-validate.ts`；`src/data-services/registry/registry.ts` | Operation 顶层身份须登记稳定类型并明确碰撞行为；内容兼容由 EventDef 的显式 `resumeVersion` 控制，不新增 Registry 内容 Hash。 |

## Data / API

- `OperationEventDef`、`OperationLocationDef`、`OperationActionDef`、`StudentOperationProfileDef` 进入 Datapack/Registry 顶层内容合同；定义属于内容声明层，Operation Resolver 和产品行为留在 AronaClicker Runtime，不由基础 Data Services 反向依赖产品运行时代码。
- 顶层 ID 使用已登记的三段式 `typeName`；嵌入对象使用所属定义内的局部 ID，不进入全局 Registry；继续遵循现有 Registry 的重复与覆盖语义。
- Objective/Outcome、Predicate、OperationEffect 保持封闭、小型、可校验的联合数据，不扩展成任意表达式引擎。
- `OperationActionDef` 是行为的唯一权威定义，负责 target、requirements 与 effects。`OperationLocationDef` 嵌入的 `SceneActionDef` 只声明 `actionId`、`individual/global` scope 与 PlayerCost；`OperationEventDef` 声明共享 PlayerCost、`resumeVersion`、`maxLocationVisits` 和有限卡组；PlayerSceneCardDef 只包装 ActionDef 引用及牌费/时机/副本数。
- Task 0219 使用 `eventId + resumeVersion` 校验继续运行；作者在非兼容内容改动时手动递增版本。不得序列化整个 resolved graph 来计算自动兼容 Hash。主 SaveData 版本仍只负责 AC 存档格式。
- Registry 查询按 ID 和事件结构导航；校验错误要指出所属 pack、事件/地点 ID 与字段路径。
- 默认内容使用领域 Builder/DefFactory；字段不直接开放未消费的 `Extra` 作逃生口。

## Runtime Flow

Datapack 来源解析 → Operation 定义 Builder/Validation → Registry 汇总与引用校验 → OperationRuntime 读取已验证的 Event/Location/Action → 以配置启动或推进 EventRun。

## Acceptance

- [ ] 一个新事件可只通过声明式内容完成地点、学生配置、动作、Intent、目标和出口定义；新增内容不要求修改 Action/Route Resolver。
- [ ] 缺失 Action、学生 Profile、Location、Route 或 Predicate 引用能在 Registry 加载阶段报告准确路径并阻止无效事件启动。
- [ ] 重复 ID、越界轨道、无效引用/Route 目标和违反内容上限的定义给出可定位诊断；不实现全图拓扑诊断。
- [ ] Event、Location、Action、StudentOperationProfile 的稳定 ID 都通过对应三段式类型校验；嵌入局部 ID 在所属定义内校验，交叉引用解析到完整顶层 ID，并沿用现有 Registry 行为。
- [ ] SceneActionDef 与 PlayerSceneCardDef 都只引用 OperationActionDef，不复制目标、条件或效果；SceneAction scope、PlayerCost、玩家卡时机与副本数均能校验。
- [ ] EventDef 要求正整数 `resumeVersion`；Task 0219 可用 `eventId + resumeVersion` 识别不兼容 Run，作者改动规则后可显式递增版本；加载流程不计算 Datapack graph Hash。
- [ ] 内容加载只验证已声明字段与引用；能否完成路线由固定 Seed 示例运行验收，不构建全图可达性分析。
- [ ] 事件访问、SceneAction 批次与玩家牌组均有适合 V1 示例的有限上限；路线循环有明确访问上限。
- [ ] Task 0221 的正式示例从 Datapack 到 Registry 再到 Runtime 可运行；Task 0222 复用同一份内容接入默认入口。
- [ ] 若变更 Engine Schema，`npm run gen:schema` 后生成内容与定义源保持一致；生成文件无手工编辑。
- [ ] 现有 Datapack/Registry 行为与无关内容表保持原语义。

## Tests

- **Unit：**各定义字段验证与 Builder 默认值。
- **Runtime：**已验证 Definition 构造 Run、动作/状态配置能被 Resolver 消费。
- **Integration：**正式 Gameplay-B Datapack→Registry→示例 Event；不合法引用稳定失败并保留上一个有效 Registry。
- **API：**无需 Operation Editor；验证 Registry/View 的只读合同可供后续 UI 消费，不实现 Gameplay B 操作界面。

## Dependencies

- 依赖 Task 0213–0218 的实体与行为语义、Task 0224/0225 的 SceneAction/PlayerCost/有限场景卡组运行语义；允许用已稳定的 TypeScript/fixture 内容转为正式声明合同。
- Task 0221 依赖本 Task 的内容表、默认值和诊断合同。

## Documentation / GALHCG

- 本 Task Receipt 记录合同与直接证据。V1 只维护实现所需的机制事实与直接受影响的文档关系；全图 freshness 扫描和额外 Concept 扩展为 post-v1，不阻塞示例事件闭环。
- Read Set：`docs/docs-829/03-data-structures/datapack-contracts.md`、`registry.md`、`docs/docs-829/04-mechanisms/data-services/pack-loading.md`、`docs/docs-829/05-conventions/schema-sync.md`、目标合同/Registry 源码与测试。

## 当前核验与剩余工作

当前核对了 Datapack、Registry、实体 ID、默认内容及 Schema 边界；未创建字段、未生成 Schema、未运行测试。本 Task 增加 EventDef 显式 `resumeVersion`，不实现自动内容 Hash。Operation 类型进入基础内容声明合同时不得反向依赖 AronaClicker Runtime；产品专属定义默认留在 AronaClicker 边界。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[docs/docs-829/05-conventions/schema-sync]]
