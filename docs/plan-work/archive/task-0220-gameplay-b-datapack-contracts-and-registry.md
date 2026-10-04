# Task 0220 — 玩法 B Datapack 定义与 Registry 校验

状态：completed — 2026-10-05。四张 Operation 内容表、引用校验、Registry-backed Runtime resolver、正式游乐园 Datapack 示例与 Schema 同步均已完成并验证。

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

- [x] 正式事件可只通过声明式内容完成地点、学生配置、动作、Intent、目标和出口定义；新增内容不要求修改 Action/Route Resolver。
- [x] 缺失 Action、学生 Profile、Location、Route 或 Predicate 引用能在 Registry 加载阶段报告准确路径并阻止无效事件启动。
- [x] 重复 ID、越界轨道、无效引用/Route 目标和违反内容上限的定义给出可定位诊断；不实现全图拓扑诊断。
- [x] Event、Location、Action、StudentOperationProfile 的稳定 ID 都通过对应三段式类型校验；嵌入局部 ID 在所属定义内校验，交叉引用解析到完整顶层 ID，并沿用现有 Registry 行为。
- [x] SceneActionDef 与 PlayerSceneCardDef 都只引用 OperationActionDef，不复制目标、条件或效果；SceneAction scope、PlayerCost、玩家卡时机与副本数均能校验。
- [x] EventDef 要求正整数 `resumeVersion`，内容声明 `eventId + resumeVersion` 供 Task 0219 的存档恢复校验使用；作者改动规则后可显式递增版本；加载流程不计算 Datapack graph Hash。
- [x] 内容加载只验证已声明字段与引用；能否完成路线由固定 Seed 示例运行验收，不构建全图可达性分析。
- [x] 事件访问、SceneAction 批次与玩家牌组均有适合 V1 示例的有限上限；路线循环有明确访问上限。
- [x] 同一正式 Gameplay-B Datapack 可从 Registry 解析并经 GameInstance 启动，供 Task 0221/0222 复用，不维护第二份正式示例。
- [x] 已运行 `npm run gen:schema` 并通过 Schema 同步测试；生成文件由既有生成流程更新。
- [x] 定向 Registry、Operation Runtime、准入、Schema 测试通过，确认原有 Datapack/Registry 行为保持有效。

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

## 实施裁定

- Operation 作者数据是 Datapack / Registry 的声明内容；静态结构放在 `src/data-services/contracts/operation.ts`，Registry 只负责四张表、稳定 ID 与静态引用校验。该内容合同不导入 AronaClicker Runtime；Runtime 从 Registry 读取后组装现有 EventRun 入场 DTO。
- 固定表为 `operationEvents`、`operationLocations`、`operationActions`、`studentOperationProfiles`，对应 `operation-event`、`operation-location`、`operation-action`、`student-operation-profile`。跨表引用始终使用完整 ID；Route、Objective、SceneAction、SceneCard 等仍嵌入 Event / Location 并使用所属范围内 ID。
- Event 必须声明正整数 `resumeVersion`，并以 `initId` 指定挂靠的 AC 世界线；首份游乐园示例挂在 `base:init:schale_office`。Datapack Schema 只按既有生成流程同步，不建设 Operation 专用编辑器。
- 静态上限保持少量且可解释：每 Event 最多 20 个 Location、访问最多 100 次；每 Location 最多 10 个 SceneAction 批次；卡组最多 40 张副本、手牌最多 12 张。Runtime 已只保留最近 32 条 Resolution，不再增加日志策略。
- 不新增通用 Registry 插件、内容 Hash、可达性分析或兼容层；operation 专用的有限字段/引用检查就地复用现有 `Registry.load()` 验证入口。

## Patch Unit Plan

### Unit 1 — Datapack 内容合同与稳定类型

- **Goal：**确立四类顶层 Operation 作者定义与 Datapack 字段，并让 AronaClicker Runtime 类型复用该静态合同。
- **Allowed Files：**`src/data-services/contracts/operation.ts`（新增）、`src/data-services/contracts/datapack.ts`、`src/engine/core/entity-id.ts`、`src/arona-clicker/contracts/operation.ts`、`operation-action.ts`、`operation-participant.ts`、`operation-skill.ts`、`student-operation-profile.ts`、`src/arona-clicker/services/operation-runtime-service.ts`（仅修正分离后的 Runtime 输入类型断言，不改结算行为）。
- **Read Set：**本 Task；`datapack-contracts.md`、`entity-id.ts`、Operation Runtime 合同文件。
- **Completion Criteria：**四类顶层定义类型有单一静态权威；Event 用 `locationIds` 指向独立 Location，嵌入参与者规格和学生技能规则；新增稳定 `typeName`；Runtime 继续可通过原合同入口消费共享类型。
- **Non-goals：**不做 Registry 校验、不改 EventRun 状态、不接 UI。
- **Stop Conditions：**需要改动 Unit 白名单、迁移存档或改变既定 Action/Card 边界时停止并记录。

### Unit 2 — Registry 表、引用验证与加载原子性

- **Goal：**四张 Operation 表能随现有 Datapack 清单合并、覆盖、查询与清空，非法内容在 Registry 加载阶段被拒绝。
- **Allowed Files：**`src/data-services/registry/registry.ts`、`registry-validate.ts`、`src/data-services/registry/operation-content-validation.ts`（新增）、`tests/engine/registry.test.ts`。
- **Read Set：**`Registry` 表步骤和 load/validate 路径、`validateDatapack`、现有 Registry 测试、Unit 1 合同。
- **Completion Criteria：**检查表内重复和 ID 类型；用当前 Registry + 本包定义校验 Event→Location、Location→Route、Action、Profile、Character、Predicate 与其他局部引用；无效包不改变已加载 Registry。
- **Non-goals：**不做地图全图可达性、跨包自动命名空间补全或编辑 UI。
- **Stop Conditions：**若现有多包覆盖规则不能支持稳定 ID 引用，则暂停并记录具体冲突，不新增平行 Registry。

### Unit 3 — Registry-backed Runtime Resolver 与正式示例

- **Goal：**同一份声明式游乐园 Datapack 可经 Registry resolver 构造 Runtime 入场内容，并用于之后的作者工作流和默认试玩入口。
- **Allowed Files：**`src/arona-clicker/services/registry-operation-content-resolver.ts`（新增）、`src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`（新增）、`src/arona-clicker/runtime-game-instance.ts`、`src/arona-clicker/services/operation-participant-admission.ts`（仅校验 Datapack Event 的 Init 归属）、`src/app/runtime-bootstrap.ts`、`tests/engine/gameplay-b-scene-action-sample.test.ts`、`tools/datapack-editor/schema/engine-schema.sync.test.ts`、`tools/datapack-editor/schema/engine-defs.gen.json`（仅由生成命令更新）、`docs/docs-829/03-data-structures/datapack-contracts.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`。
- **Read Set：**Operation Admission / ContentResolver 入口和测试；base Datapack 的 `base:init:schale_office` ID；Unit 1–2 Receipt。
- **Completion Criteria：**Runtime resolver 只从 Registry 按完整 ID 解析内容；正式示例覆盖地点路线、SceneAction、持有物、Cost、玩家有限卡组、学生 Profile、目标和结局；Event 只能从其声明的 Init 启动；同一示例经 `GameInstance` 开始运行。Schema 使用既有生成命令同步；Task 0221/0222 复用这份内容，不复制第二份。
- **Non-goals：**不做默认入口 UI、作者编辑器或聊天交互；这些留给 Task 0221/0222。
- **Stop Conditions：**若要修改 base 发布包或独立 UI 才能让示例运行，保持示例为正式可加载 Datapack，记录对 Task 0222 的接线需求。

## 当前核验与剩余工作

已核对 Datapack、Registry、实体 ID、默认内容与 Schema 边界，确认 Registry 通过统一 `tableSteps` 合并/清空表，`validateDatapack` 在提交前接收当前 Registry 引用上下文，生成器会从 Datapack 聚合接口发现表。Unit 1–3 均已完成：正式示例由 Registry resolver 解析，Init 准入边界、Schema 与机制文档已同步。

## Unit Receipts

### Unit 1 — Datapack 内容合同与稳定类型（completed）

- 新建 `src/data-services/contracts/operation.ts` 作为 Event、Location、Action、StudentOperationProfile 与嵌入子定义的静态权威；Event 内容声明 `initId`、`resumeVersion`、`locationIds`、参与者与技能规则。
- `Datapack` 增加四个可选顶层表；`ENTITY_TYPES` 加入四个稳定 `typeName`。
- AC Operation 合同从原路径 re-export 静态类型，Runtime Event DTO 将 Registry Location IDs 表达为解析后的 Location 数组；Runtime 输入边界只调整类型断言，没有改变结算逻辑。
- 验证：`npx tsc --noEmit` 通过。Registry/Schema 行为测试留给 Unit 2/3。

### Unit 2 — Registry 表、引用验证与加载原子性（completed）

- `Registry` 通过统一 `tableSteps` 合并、覆盖、查询和清空四张表；`Registry.load()` / `validate()` 将现有 Init、Character 及 Operation 定义传给 `validateDatapack`。
- Registry 校验 Operation 四张表的重复项和精确 `typeName`，并检查 Event 的 `initId + resumeVersion + Location 列表 + Route 目标 + Predicate`、参与者/Profile/Action、SceneAction、持有物、Cost、卡组有限上限等直接引用。
- 现有 Runtime Admission 保留行动合法性复核；Registry 不引入全图可达性、编辑器或通用校验框架。已有成功内容遇到无效包时不会被覆盖。
- 验证：`npx vitest run tests/engine/registry.test.ts`：43 tests 通过；`npx tsc --noEmit` 通过；`npm run check:architecture` 通过。

### Unit 3 — Registry-backed Runtime Resolver 与正式示例（completed）

- 新建 `registry-operation-content-resolver.ts`，默认从现有 Registry 读取 Operation Event、Location、Action 和 StudentOperationProfile，并组成既有准入合同；无注入 resolver 时 RuntimeGameInstance 也走该路径。
- 新建正式 `gameplay-b-datapack.ts` 游乐园 Datapack，涵盖独立地点、分支/持有物路线、SceneAction、共享 PlayerCost、有限玩家卡组、学生 Profile、目标与结局。示例挂在 `base:init:schale_office`，不复制旧切片逻辑。
- 保留旧 Runtime 示例入口作为兼容测试样例；正式集成测试改为加载 `defaultDatapack + gameplayBCarouselDatapack`，直接通过 `createAppRuntime()` / GameInstance 启动，并验证从不匹配的 Millennium Init 启动会被拒绝。
- Resolver 解析使用稳定 ID；Event `initId` 在参与者准入处与当前 Init 比对。既有手工 Runtime fixture 未声明 `initId` 时仍可供原有底层测试使用。
- `npm run gen:schema` 将四张 Datapack 表及内容合同同步进生成 Schema；Schema 测试覆盖表定义。操作只使用既有生成器。
- 更新 Datapack 合同及 Operation Runtime 机制文档，说明 Registry 作者表、Resolver、Init 入口和版本字段的责任边界。
- 验证：针对 Registry、正式示例、旧样例、参与者准入、学生自治与 Schema 同步运行 6 个 Vitest 文件，共 73 tests 通过；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 均通过。

## Receipt

- **Contract:** 静态 Operation 内容合同位于 Data Services，不反向依赖产品 Runtime；四张 Registry 表复用既有加载、覆盖、查询与清空流程。
- **Runtime:** Operation ContentResolver 从当前 Registry 解析；正式 Event 只允许由声明的 Init 进入。动作效果和卡牌仍以 OperationAction 为单一权威定义。
- **Content:** 一份正式游乐园 Datapack 可通过 Registry 与 GameInstance 运行，作为后续作者验证和默认试玩入口的共同样例。
- **Bounds:** Event Location/访问次数、SceneAction 批次、卡组张数与手牌均有显式小上限；不引入通用插件、内容 Hash 或可达性分析。
- **Validation:** 73 项定向测试、TypeScript、Architecture 与 Docs 检查全部通过。Schema 经生成器同步。
- **GALHCG:** 已复用并更新 Operation EventRun Runtime、Operation Student Profile Admission、Registry、Data Services、Datapack Editor 与 Engine Schema sync 概念的直接证据和必要关系；新增 Operation → Registry 依赖，并为新合同、校验器、Resolver、正式样例与生成 Schema 增加映射。未创建新 Concept。Operation EventRun Runtime Evidence 保持 20 项，避免超过单次 freshness 核验范围。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[docs/docs-829/05-conventions/schema-sync]]
