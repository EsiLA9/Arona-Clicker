# Task 0221 — 玩法 B 内容创作与校验工作流

状态：completed（2026-10-05）— 复用正式游乐园 Datapack 与既有 Runtime/Registry 校验、加载路径，最小作者循环及错误回退已验证。

## 目标

让内容作者能通过 AC 正式 Datapack 路径创建、校验、加载并迭代一个完整事件；内容流程能指出常见引用/流程错误，避免每个地点都需要改操作 Runtime。

## Why

新的数据合同只有成为可用创作流程才形成可扩展内容能力。作者需要知道哪些字段必填、Route 指向的 Location 是否存在、引用是否有效；固定示例是否可通关由运行验收判断。

## Scope

- 用 Task 0220 的合同维护一个正式 Gameplay-B Datapack 示例事件；Task 0222 直接使用这份内容，不复制第二份样例。
- 只验收一条最小作者循环：编辑正式内容 → `validate` → `load` → 启动事件 → 修改内容 → `reload` → 看到新结果或定位明确的校验错误。
- 验证覆盖事件 ID、行动引用、Location/Route、SceneAction、PlayerCost、有限卡组与 `resumeVersion`；复用 Task 0220 的 Registry 校验，不另建作者规则系统。
- 固定 Seed 运行正式示例，确认内容可启动、可推进，改动后能重新加载。
- 错误诊断指出 Event、Location 和字段路径；无效 reload 不部分替换 Registry，也不改写已运行 Run。
- 不做图形编辑器、图形地图、编辑器 CRUD 或 Runtime Editor 扩展。Datapack 源文件和现有命令就是 v1 作者入口。

## Non-goals

- 不实现完整图形关卡编辑器、实时事件脚本编辑、可视化路线拖拽或通用社区创作平台。
- 不改造 Runtime Editor 为 Datapack 的通用 CRUD 工具。
- 不写入 `docs/newPlan/`，不创建独立的专用编辑器产品。

## Gameplay UI Deferred Scope

- 本 Task 的内容作者入口与诊断按 Datapack/Registry 当前合同处理；不得顺手施工玩家侧 Gameplay B Surface、行动卡交互或聊天流控件。
- Task 0222 才基于最终内容/View/命令 API 设计并验收玩家体验。内容作者的校验流程不属于玩家信息流 UI。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| 内容 authoring policy 与 DefFactory 描述类型字段、校验器、字段消费者和物化路径。 | `src/data-services/contracts/datapack.ts`；GALHCG `concept:content-authoring-policy`、`concept:content-definition-builders` | Operation 字段要进入有消费者、有验证的正规作者面。 |
| 游戏内 Runtime Editor 当前管理 Init/Area/Spot/Enhancement 内容会话；独立 schema editor 是不同产品入口。 | `docs/docs-829/06-wiki/60-engineering-support/schema-editor.md`；`src/ui/runtime-editor`；`src/arona-clicker/services/runtime-content-coordinator.ts` | 不因都叫 Editor 而将 Operation Event 内容塞入现有 Spot/Area 编辑流程。 |

## Data / API

- 作者可见定义：一个完整示例事件所需的 Event、Location、参与者、Action、Route、SceneAction、Cost、PlayerSceneCard 和结局字段。
- 内容诊断：pack/事件/地点/引用 ID/字段路径、错误级别和修复方向；重试加载不留下半注册定义。
- 正式 Gameplay-B 示例内容由 Task 0221 维护；Task 0222 将同一内容接入产品入口并完成试玩，不创建重复副本。
- 沿用 Datapack/Registry 的 validate/load 入口；不另建作者 API、编辑器或活动 Run 编辑流程。

## Runtime Flow

作者编辑正式 Gameplay-B Datapack → `validate` → `load` → OperationRuntime 启动同一示例事件 → 作者修改内容 → `reload` → 显示新定义或字段路径诊断；无效内容不会部分替换 Registry。

## Acceptance

- [x] 作者可直接编辑正式 Gameplay-B Datapack，不改 OperationRuntime 源码；同一示例经 Runtime 候选配置校验、加载和事件启动。
- [x] Task 0220 正式示例保留有界回环、持有物 Gate、SceneAction、PlayerCost 和有限玩家卡组；Task 0222 继续复用该单一内容源。
- [x] 有效修改 initial Location 并递增 `resumeVersion` 后 reload；新 Run 使用新 Location 与版本，不复制事件样例。
- [x] 无效 Route target 的诊断包括 Pack namespace、完整 Event/Location ID 与 `routeEdges[].targetLocationId` 路径；候选校验/Apply 不部分替换 Registry，也不改动活动 Run。
- [x] 以固定内容 Seed 完成 Runtime 启动与后续样例回归；既有静态校验覆盖引用/值域和终止路线，不穷举动态 Predicate。
- [x] Runtime Editor 不获得通用 Operation 事件图 CRUD；v1 只依赖 Datapack 内容、Runtime 校验/加载与 reload 入口。

## Tests

- **Unit：**示例内容的 ID/引用/值域诊断。
- **Runtime：**有效 reload 供新 Run 使用；无效 reload 不部分替换 Registry 或改写活动 Run；resumeVersion 变更拒绝旧快照。
- **Integration：**编辑 → validate → load → 启动 → 修改 → reload 的单事件流程。
- **UI：**不建设编辑器 UI；只核对错误和加载结果可被现有入口读到。

## Dependencies

- 依赖 Task 0220 的稳定 Datapack/Registry 合同。
- 依赖 Task 0217–0219 的目标、路线与存档定义，以及 Task 0224/0225 的 SceneAction、PlayerCost 和玩家卡组语义用于完整样例/诊断。

## Documentation / GALHCG

- Receipt 记录作者入口与诊断的直接源码证据；更新实际受影响的机制事实即可。全图 freshness 扫描和额外 Concept 扩展为 post-v1，不阻塞示例事件作者循环。
- Read Set：`docs/docs-829/05-conventions/doc-maintenance.md`、`docs/docs-829/05-conventions/schema-sync.md`、`docs/docs-829/06-wiki/20-data-services/definition-authoring.md`、`docs/docs-829/06-wiki/60-engineering-support/schema-editor.md`、`src/data-services/contracts/datapack.ts`、Runtime Editor 协调器与验证测试。

## 已完成总结

正式游乐园示例经候选 Pack Configuration 校验、PackManager Apply/Runtime reload、Operation 启动和内容编辑往返验收。无效内容在候选 Registry 校验阶段被拒绝，旧 Registry 与活动 Run 保持不变；有效修改递增 `resumeVersion` 后由新 Run 消费，旧 Save checkpoint 得到可查询的版本拒绝。无新增作者服务、编辑器或产品 Runtime 行为。

## Unit Receipt

### Unit 1 — 正式 Operation Datapack 作者往返验收（completed）

- **实际修改：**新增 `tests/engine/gameplay-b-authoring-workflow.test.ts`；在定义作者文档说明 Operation 四张 Datapack 表、候选 Registry validate/apply/reload 路径、字段诊断和 `resumeVersion` 规则。
- **正式示例：**只复用 `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`；测试仅在独立 Datapack 副本上模拟作者修改，不落地第二份产品内容。
- **验证：**`npx vitest run --silent tests/engine/gameplay-b-authoring-workflow.test.ts tests/engine/registry.test.ts tests/engine/gameplay-b-save-resume.test.ts tests/engine/gameplay-b-scene-action-sample.test.ts tests/engine/gameplay-b-route-sample.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts tests/engine/operation-scene-actions.test.ts tests/engine/gameplay-b-operation-sample.test.ts`：8 个文件、75 项测试通过；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git diff --check` 均通过。
- **未完成：**无。Datapack 编辑界面、CLI 与通用作者 API 保持 post-v1。
- **GALHCG：**按本 Task 收尾的大阶段点定向维护 ContentAuthoringPolicy/Registry 的现有关联并纳入新集成测试；无新增 Concept、无全图 freshness 扫描。所有本次直接 Evidence 在写后复核为 fresh/unchanged。

## 实施裁定

- 正式示例沿用 [[archive/task-0220-gameplay-b-datapack-contracts-and-registry]] 创建的 `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`；本 Task 不复制事件或添加新的产品内容包。
- Operation 四张内容表直接属于正式 Datapack / Registry 契约，不经过 Runtime Editor 的 Spot/Area/Init `ContentAuthoringPolicy` CRUD。
- 作者路径使用已有 `AronaClickerRuntime.validatePackConfiguration()` 对候选启用集建立 Registry 并校验，再由 `applyPackConfiguration()` 经既有 PackManager 路径加载/重载。常见错误继续使用 Registry 的稳定 Event/Location 字段路径诊断，不增加平行诊断系统。
- 兼容既有存档的事件内容变更要递增 `resumeVersion`；旧 checkpoint 拒绝恢复是预期结果。
- v1 的作者验收是源码与 Runtime API 的集成测试及文档说明；不新增 UI、CLI、脚本、编辑 API 或 schema 字段。

## Patch Unit Plan

### Unit 1 — 正式 Operation Datapack 作者往返验收

- **Goal：**使用同一正式游乐园 Datapack 证明候选内容可校验、加载、启动；无效引用不会替换 Registry 或污染活动 Run；有效字段与 `resumeVersion` 修改经 reload 后作用于新 Run。
- **Allowed Files：**`tests/engine/gameplay-b-authoring-workflow.test.ts`（新增）、`docs/docs-829/06-wiki/20-data-services/definition-authoring.md`、本 Task。
- **Read Set：**本 Task；`docs/docs-829/05-conventions/schema-sync.md`；`docs/docs-829/06-wiki/20-data-services/definition-authoring.md`；`src/data-services/contracts/datapack.ts`；`src/data-services/registry/registry.ts` 与 Operation 内容验证器；`src/arona-clicker/runtime.ts`、正式 `gameplay-b-datapack.ts`；PackManager / Registry / Gameplay B 集成测试。
- **Completion Criteria：**单条固定示例工作流覆盖 `validate → apply/load → start → 修改有效字段并递增 resumeVersion → validate/reload → 新 Run 观察修改`；无效 Location 引用诊断包含正式 Event ID 和字段路径，候选 apply 不改变活动 Registry/Run；旧版本 checkpoint 被拒绝；无新 UI/CLI/专用 CRUD。
- **Non-goals：**不新建作者服务、Editor API、Runtime Editor 扩展、Datapack 表/Schema 字段或第二份示例事件。
- **Stop Conditions：**若现有候选 Registry 校验与 PackManager 应用路径无法保证无效内容不会触发 reload，停止并记录可复现差异；不得先添加通用事务或诊断框架。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
- [[docs/docs-829/05-conventions/schema-sync]]
