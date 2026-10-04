# Task 0221 — 玩法 B 内容创作与校验工作流

状态：proposed — 等待 Task 0220 完成

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

- [ ] 作者可直接编辑一个正式 Gameplay-B Datapack，不改 OperationRuntime 源码；同一示例通过 `validate`、`load` 并能启动。
- [ ] 示例事件包含有界回环、一个持有物 Gate、一个 SceneAction、PlayerCost 和有限玩家卡组；该内容由 Task 0222 直接复用。
- [ ] 作者修改一个有效字段后执行 `reload`，后续新 Run 读取修改结果；不复制出第二个事件样例。
- [ ] 作者制造一个无效引用后执行 `validate/reload`，诊断指出 pack、Event/Location 与字段路径，且无效内容不部分替换 Registry 或污染活动 Run。
- [ ] 示例以固定 Seed 可运行；静态校验确认基本引用、值域和终止路线，不穷举动态 Predicate。
- [ ] Runtime Editor 不获得通用事件图编辑职责；v1 工作流只依赖 Datapack 文件、现有校验/加载入口和 Runtime。

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

## 当前核验与剩余工作

当前核对了 AuthoringPolicy、Builder、默认内容入口及编辑器职责；未实现正式示例与编辑循环。Task 0221 以 Datapack 源文件和现有 validate/load/reload 入口完成最小工作流，不追加作者工具体系。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
- [[docs/docs-829/05-conventions/schema-sync]]
