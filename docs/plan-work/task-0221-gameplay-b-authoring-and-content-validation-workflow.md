# Task 0221 — 玩法 B 内容创作与校验工作流

状态：proposed — 等待 Task 0220 完成

## 目标

让内容作者能通过 AC 正式 Datapack 路径创建、校验、加载并迭代一个完整事件；内容流程能指出常见引用/流程错误，避免每个地点都需要改操作 Runtime。

## Why

新的数据合同只有成为可用创作流程才形成可扩展内容能力。作者需要知道哪些字段必填、路线拓扑是否闭合、引用是否有效；带 EventState 的动态目标能否达到由有界运行测试判断。

## Scope

- 用 Task 0220 的合同与 Builder 定义作者写入位置、最小完整示例、ID 和引用约定、验证反馈。
- 作者合同与验证覆盖 Task 0224 的逐人/全局 SceneAction、共享 PlayerCost、逐地点 Cost 增量/离场上限，以及 Task 0225 的固定有限玩家场景卡组和卡牌时机/目标/效果引用。
- 用测试/验证内容包交付一份由多个地点构成的中性事件，展示至少一次有因果后果的路线选择；正式默认发行内容由 Task 0222 交付。
- 静态校验每个事件至少有合法入口、合法终态、拓扑可达地点和有界回访；动态 Predicate/Effect 组合下的目标可满足性由固定 Seed/有界 Runtime 样例验证，不做全状态穷举。
- 确定包作者看到的静态诊断和 Runtime 诊断分工；加载错误不晚于事件选择/开始前呈现。
- 游戏内 Runtime Editor 的现有责任限于其当前世界内容编辑边界；v1 事件作者工作流走 Datapack 内容。若未来需要运行中创建/编辑事件图，须以作者任务另立范围和 Task。
- 验证 fixture 留在测试/验证内容包；正式默认应用内容按 `src/arona-clicker/content/default-datapack.ts` 路由由 Task 0222 维护。

## Non-goals

- 不实现完整图形关卡编辑器、实时事件脚本编辑、可视化路线拖拽或通用社区创作平台。
- 不改造 Runtime Editor 为 Datapack 的通用 CRUD 工具。
- 不写入 `docs/newPlan/`，不创建独立的专用编辑器产品。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| 内容 authoring policy 与 DefFactory 描述类型字段、校验器、字段消费者和物化路径。 | `src/data-services/contracts/datapack.ts`；GALHCG `concept:content-authoring-policy`、`concept:content-definition-builders` | Operation 字段要进入有消费者、有验证的正规作者面。 |
| 游戏内 Runtime Editor 当前管理 Init/Area/Spot/Enhancement 内容会话；独立 schema editor 是不同产品入口。 | `docs/docs-829/06-wiki/60-engineering-support/schema-editor.md`；`src/ui/runtime-editor`；`src/arona-clicker/services/runtime-content-coordinator.ts` | 不因都叫 Editor 而将 Operation Event 内容塞入现有 Spot/Area 编辑流程。 |

## Data / API

- 作者可见定义：事件目标与轨道、地点参与者/行为、逐人/全局选择模式、可见 Intent、持有物 RouteEdge 条件、路线 Cost、有限场景卡组、局部和终局结果。
- 内容诊断：pack/事件/地点/引用 ID/字段路径、错误级别和修复方向；重试加载不留下半注册定义。
- 多地点示例只作为测试/验证内容；产品默认发布事件由 Task 0222 明确归属到 AronaClicker 内容。
- Authoring API 保持在 Datapack/Registry contract 层；运行命令与活动 Run 编辑不是内容作者接口。

## Runtime Flow

作者编辑 Datapack 定义 → 内容加载器和 Builder 字段/引用/拓扑校验 → Registry 返回静态诊断 → 固定 Seed 的有限 Runtime 样例核验动态目标 → 作者读取定位诊断 → 修正并重载 → OperationRuntime 开始已验证事件。

## Acceptance

- [ ] 作者无需修改 OperationRuntime 源码即可建立新 Event、新 Location、新 Action、新学生 Profile 和有出口的地点图。
- [ ] 作者能声明 Individual/Global SceneAction，配置每 Location 的 `costGain` / `maxCarryCost`、Event 级共享 PlayerCost 和有界场景卡组；卡牌只能被 SceneAction 引用，不会被配置进战斗 Click。
- [ ] 校验能定位缺失选择模式、越界 Cost、无效卡牌/目标、重复卡实例及违反卡组/地点/日志硬上限的定义。
- [ ] 静态校验能发现拓扑孤立/不可达的必需地点、未使用动作、无效学生/动作/目标引用、无终止结果和无界回访。
- [ ] 校验报告明确静态验证不证明含动态 Predicate 的目标一定可满足；目标可满足性由有限 Runtime fixtures 覆盖。
- [ ] 诊断明确定位到 pack、Event、Location 与字段；正确内容经过导入/加载后与源定义保持一致。
- [ ] 多地点验证样例可在 Runtime 集成层以固定 Seed 启动、提交、选择路线并达到至少两类不同事件结果；该项不代替玩家入口的浏览器验收。
- [ ] 加载无效内容时合法 Registry 与已运行 EventRun 不出现部分替换。
- [ ] 作者可以使用现有 Datapack 定义入口维护内容；Runtime Editor 不获得未裁定的通用事件图 CRUD 职责。

## Tests

- **Unit：**ID/值域/引用、拓扑可达性与诊断路径。
- **Runtime：**内容重载前后运行中 Run 快照不被部分覆盖；定义变更后的 Run 恢复遵守版本校验。
- **Integration：**完整验证 pack 从作者输入到 Registry 到可启动 EventRun；固定 Seed 样例验证动态目标与结局；失败包能定位错误。
- **UI：**只验收内容选择/诊断进入现有 AC 工作流的结果；不要求新建专属编辑器。

## Dependencies

- 依赖 Task 0220 的稳定 Datapack/Registry 合同。
- 依赖 Task 0217–0219 的目标、路线与存档定义，以及 Task 0224/0225 的 SceneAction、PlayerCost 和玩家卡组语义用于完整样例/诊断。

## Documentation / GALHCG

- 完成后按 `docs/docs-829/05-conventions/doc-maintenance.md` 更新 Authoring、Pack Loading、运行时校验与创作入口路由。
- GALHCG 记录稳定的 Operation 内容作者流程及对应合同/Registry/验证器/测试 maps_to；具体事件、ID 和诊断字符串不建 Concept。
- Read Set：`docs/docs-829/05-conventions/doc-maintenance.md`、`docs/docs-829/05-conventions/schema-sync.md`、`docs/docs-829/06-wiki/20-data-services/definition-authoring.md`、`docs/docs-829/06-wiki/60-engineering-support/schema-editor.md`、`src/data-services/contracts/datapack.ts`、Runtime Editor 协调器与验证测试。

## 当前核验与剩余工作

当前核对了 AuthoringPolicy、Builder、默认内容入口及两种编辑器职责；未建立正式作者界面、未实现内容、未运行测试。若 Datapack 路径不足以支持目标作者，先补作者任务证据再立运行时编辑 Task。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
- [[docs/docs-829/05-conventions/schema-sync]]
